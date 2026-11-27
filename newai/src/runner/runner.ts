// 러너: 작업 하나를 끝까지 진행한다.
// 구현 → 완료 검사·보고 끝 질문 → 독립 테스트(실패 시 디버거) → 민감한 변경이면 리뷰어 → 보고서.
// 모든 세션 호출은 중단 원인별 이어가기를 거친다(F9.1).
import fs from 'node:fs';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import type { Config } from '../core/config.ts';
import { parseDuration } from '../core/config.ts';
import { detectExplicitLanguage, resolveLanguage } from '../core/lang.ts';
import { layout, type Paths } from '../core/paths.ts';
import { answerText, makeCanUseTool } from '../decision/adapters.ts';
import { realClock, type Clock } from '../decision/clock.ts';
import type { DecisionEngine } from '../decision/engine.ts';
import type { Card } from '../decision/types.ts';
import { activeRules, addHistory, cancelledUnanswered, recentHistory } from '../learn/history.ts';
import { getJob, logEvent, setJobStatus, type JobStatus } from '../queue/jobs.ts';
import { getProject, type Project } from '../queue/projects.ts';
import { makePreToolUseHook } from '../safety/hooks.ts';
import type { Policy } from '../safety/policy.ts';
import { readOnlyGuard } from '../safety/role-guard.ts';
import { collectChanges, headCommit } from './changes.ts';
import { completionCheck, detectTailQuestion, extractPending, parseFindings, parseVerdicts, sensitiveReasons, type Finding, type Verdicts } from './checks.ts';
import { costByRole, recordCost, spentSince } from './cost.ts';
import type { SessionDriver, TurnResult } from './driver.ts';
import * as P from './prompts.ts';
import { classifyInterruption, planResume, type Cause } from './resume.ts';
import { ROLE_KO, type RoleName, type RolesFile } from './roles.ts';
import { countProjectFiles, type Size, type Sizer } from './sizer.ts';
import { STOP_LABEL, type TailConverter } from './tail.ts';

export interface RunnerEvent { jobId: string; type: 'phase' | 'tool' | 'text' | 'interrupt' | 'check' | 'verdict' | 'review' | 'size' | 'done'; role?: RoleName; text: string }

export interface RunnerDeps {
  db: DatabaseSync;
  config: Config;
  roles: RolesFile;
  policy: Policy;
  paths: Paths;
  engine: DecisionEngine;
  driver: SessionDriver;
  sizer: Sizer;
  tail: TailConverter;
  agentEnv: Record<string, string>;
  envSummary?: string;
  clock?: Clock;
  onEvent?: (e: RunnerEvent) => void;
}

export interface JobReport {
  jobId: string;
  status: JobStatus;
  size: Size;
  sizeReason: string;
  language: string;
  implementerReport: string;
  completionMissing: string[];
  followups: number;
  tailQuestions: number;
  tests: { attempt: number; overall: Verdicts['overall']; criteria: Verdicts['criteria'] }[];
  debugRuns: number;
  review: { ran: boolean; reasons: string[]; findings: Finding[]; fixed: boolean };
  interruptions: { cause: Cause; detail: string; waitMs: number }[];
  costUsd: number;
  costByRole: Record<string, number>;
  pendingItems: string | null;
  humanItems: string[];
  autoDecisions: string[];
  reportPath: string;
}

class NeedsHuman extends Error {}
class Cancelled extends Error {}

interface Phase { role: RoleName; sessionId: string | null; toolUses: string[]; deferred: Card[] }

interface RunCtx {
  jobId: string;
  request: string;
  project: Project;
  workdir: string;
  language: string;
  pctx: P.PromptContext;
  report: JobReport;
  impl: Phase;
  baseHead: string | null;
  reportDir: string;
}

const phase = (role: RoleName, sessionId: string | null = null): Phase => ({ role, sessionId, toolUses: [], deferred: [] });
const startOfToday = (now: number) => { const d = new Date(now); d.setHours(0, 0, 0, 0); return d; };

export class Runner {
  private readonly d: RunnerDeps;
  private readonly clock: Clock;
  private readonly aborts = new Map<string, AbortController>();
  private readonly cancelled = new Set<string>();

  constructor(d: RunnerDeps) {
    this.d = d;
    this.clock = d.clock ?? realClock;
  }

  private emit(e: RunnerEvent): void { this.d.onEvent?.(e); }
  private sleep(ms: number): Promise<void> { return ms <= 0 ? Promise.resolve() : new Promise((r) => this.clock.setTimer(r, ms)); }

  /** 실행 중인 작업을 멈춘다(사람이 /stop). */
  stop(jobId: string): void {
    this.cancelled.add(jobId);
    this.aborts.get(jobId)?.abort();
  }

  async run(jobId: string, opts: { recovering?: boolean } = {}): Promise<JobReport> {
    const { db, config } = this.d;
    const job = getJob(db, jobId);
    if (!job) throw new Error(`없는 작업입니다: ${jobId}`);
    const project = job.projectId ? getProject(db, job.projectId) : null;
    if (!project) throw new Error(`작업의 프로젝트를 찾지 못했습니다: ${jobId}`);
    const workdir = project.path;
    const language = resolveLanguage({ explicit: detectExplicitLanguage(job.request), project: project.language, config: config.language });
    const reportDir = path.join(layout(this.d.paths.home).reports, jobId);
    const scratch = path.join(reportDir, 'scratch');
    fs.mkdirSync(scratch, { recursive: true });

    const report: JobReport = {
      jobId, status: 'running', size: 'medium', sizeReason: '', language, implementerReport: '', completionMissing: [], followups: 0, tailQuestions: 0,
      tests: [], debugRuns: 0, review: { ran: false, reasons: [], findings: [], fixed: false }, interruptions: [], costUsd: 0, costByRole: {},
      pendingItems: null, humanItems: [], autoDecisions: [], reportPath: path.join(reportDir, 'report.md'),
    };
    const ctx: RunCtx = {
      jobId, request: job.request, project, workdir, language, report, reportDir, baseHead: headCommit(workdir),
      impl: phase('implementer', opts.recovering ? job.sessionId : null),
      pctx: {
        language, rules: activeRules(db, project.id), cancelled: cancelledUnanswered(db, project.id),
        history: recentHistory(db, project.id, config.projects.history_items), env: this.d.envSummary ?? '', scratch,
      },
    };
    setJobStatus(db, jobId, 'running');

    try {
      const routing = config.roles.routing;
      const sized = routing === 'single' ? { size: 'small' as Size, reason: '역할 분담 끔(single)' }
        : routing === 'full' ? { size: 'large' as Size, reason: '항상 전체 구성(full)' }
        : await this.d.sizer.size({ request: job.request, kind: job.kind, projectFiles: countProjectFiles(workdir) });
      report.size = sized.size;
      report.sizeReason = sized.reason;
      logEvent(db, jobId, 'size', sized);
      this.emit({ jobId, type: 'size', text: `작업 크기: ${sized.size} (${sized.reason})` });

      let first = job.request;
      if (opts.recovering) {
        first = ctx.impl.sessionId ? P.resumePrompt('restart') : job.request;
        await this.interruption(ctx, 'restart', { outcome: 'error', errors: ['서버 재시작'], text: '', totalCostUsd: 0, toolUses: [], sessionId: ctx.impl.sessionId });
      }
      this.emit({ jobId, type: 'phase', role: 'implementer', text: '구현 시작' });
      let r = await this.turn(ctx, ctx.impl, first);
      r = await this.finishLoop(ctx, r);
      report.implementerReport = r.text;
      fs.writeFileSync(path.join(reportDir, 'implementer.md'), r.text);

      let testsPassed = routing === 'single';
      if (routing !== 'single') testsPassed = await this.testPhase(ctx, r.text);
      const reviewOk = await this.reviewPhase(ctx, routing !== 'single');
      if (!reviewOk) testsPassed = false;
      report.status = testsPassed && report.completionMissing.length === 0 ? 'done' : 'needs_human';
    } catch (e) {
      if (e instanceof Cancelled || this.cancelled.has(jobId)) { report.status = 'cancelled'; report.humanItems.push('사용자가 작업을 멈췄습니다.'); }
      else if (e instanceof NeedsHuman) { report.status = 'needs_human'; report.humanItems.push(e.message); }
      else { report.status = 'failed'; report.humanItems.push(`하네스 오류: ${(e as Error).message}`); }
    } finally {
      this.aborts.delete(jobId);
      this.cancelled.delete(jobId);
    }
    this.finalize(ctx);
    return report;
  }

  /** 세션 한 번 실행 + 중단 시 원인별 대기 후 같은 세션으로 이어가기 */
  private async turn(ctx: RunCtx, ph: Phase, prompt: string): Promise<TurnResult> {
    const { db, config, roles, policy, engine } = this.d;
    const def = roles.roles[ph.role];
    const model = def.model ?? config.runner.model;
    const extraCheck = def.read_only ? readOnlyGuard : undefined;
    const writable = ctx.pctx.scratch ? [ctx.pctx.scratch] : [];
    let p = prompt;
    for (;;) {
      if (this.cancelled.has(ctx.jobId)) throw new Cancelled();
      const ac = new AbortController();
      this.aborts.set(ctx.jobId, ac);
      let wallHit = false;
      const timer = this.clock.setTimer(() => { wallHit = true; ac.abort(); }, parseDuration(config.runner.wall_clock_limit));
      setJobStatus(db, ctx.jobId, 'running');
      let r: TurnResult;
      try {
        r = await this.d.driver.run({
          role: ph.role, prompt: p, resume: ph.sessionId, cwd: ctx.workdir, model,
          systemAppend: P.systemAppend(ph.role, ctx.pctx), tools: def.tools, maxTurns: def.max_turns,
          agents: ph.role === 'implementer' || ph.role === 'debugger' ? this.agents() : undefined,
          maxBudgetUsd: config.runner.budget_per_run_usd,
          canUseTool: makeCanUseTool({
            engine, policy, workdir: ctx.workdir, jobId: ctx.jobId, deliver: config.decision.deliver, extraCheck, writable,
            context: () => ({ request: ctx.request, language: ctx.language, project: ctx.project.name, rules: ctx.pctx.rules, env: ctx.pctx.env }),
            onDeferred: (cs) => ph.deferred.push(...cs),
            log: (e) => logEvent(db, ctx.jobId, 'decision', { role: ph.role, ...e }),
          }),
          hooks: { PreToolUse: [{ hooks: [makePreToolUseHook({ policy, workdir: ctx.workdir, extraCheck, writable, log: (e) => logEvent(db, ctx.jobId, 'hook', { role: ph.role, ...e }) })] }] },
          env: this.d.agentEnv, signal: ac.signal,
          onEvent: (e) => {
            if (e.type === 'tool_use') { logEvent(db, ctx.jobId, 'tool', { role: e.role, name: e.name }); this.emit({ jobId: ctx.jobId, type: 'tool', role: e.role, text: `${e.name} ${JSON.stringify(e.input ?? '').slice(0, 160)}` }); }
            if (e.type === 'text' && e.text) this.emit({ jobId: ctx.jobId, type: 'text', role: e.role, text: e.text.slice(0, 400) });
          },
        });
      } finally {
        this.clock.clearTimer(timer);
      }
      if (r.sessionId) {
        ph.sessionId = r.sessionId;
        if (ph.role === 'implementer') setJobStatus(db, ctx.jobId, 'running', { sessionId: r.sessionId });
      }
      ph.toolUses.push(...r.toolUses);
      recordCost(db, { jobId: ctx.jobId, sessionId: r.sessionId, role: ph.role, model, totalCostUsd: r.totalCostUsd });
      if (this.cancelled.has(ctx.jobId)) throw new Cancelled();

      // resume 방식: 멈춘 질문의 답을 기다렸다가 같은 세션으로 전달
      if (ph.deferred.length) {
        const cards = ph.deferred.splice(0);
        setJobStatus(db, ctx.jobId, 'waiting_decision');
        const res = await Promise.all(cards.map((c) => engine.wait(c.id)));
        p = P.deferredAnswerPrompt(res.map((x) => ({ question: x.card.question, answer: answerText(x.answer) })));
        continue;
      }

      const cause = classifyInterruption(r, { wallClockHit: wallHit });
      if (!cause) {
        if (r.outcome === 'aborted') throw new Cancelled();
        if (r.outcome === 'max_turns') ctx.report.humanItems.push(`${ROLE_KO[ph.role]} 대화가 최대 턴 수에 도달했습니다.`);
        return r;
      }
      await this.interruption(ctx, cause, r);
      p = ph.sessionId ? P.resumePrompt(cause) : p;
    }
  }

  /** 중단 기록, 계획, 대기. 상한을 넘으면 NeedsHuman */
  private async interruption(ctx: RunCtx, cause: Cause, r: TurnResult): Promise<void> {
    const { db, config } = this.d;
    const now = this.clock.now();
    const attempts = (db.prepare('SELECT count(*) AS n FROM interruptions WHERE job_id = ? AND cause = ?').get(ctx.jobId, cause) as { n: number }).n;
    const today = startOfToday(now).toISOString();
    const usageToday = (db.prepare("SELECT count(*) AS n FROM interruptions WHERE cause = 'usage_limit' AND created_at >= ?").get(today) as { n: number }).n;
    const waited = db.prepare("SELECT created_at, wait_until FROM interruptions WHERE job_id = ? AND cause = 'network'").all(ctx.jobId) as { created_at: string; wait_until: string | null }[];
    const networkWaitedMs = waited.reduce((s, w) => s + (w.wait_until ? Date.parse(w.wait_until) - Date.parse(w.created_at) : 0), 0);
    const plan = planResume(cause, {
      config, now, attempts, usageToday, networkWaitedMs, spentToday: spentSince(db, startOfToday(now)),
      resetsAt: r.resetsAt, errorText: [r.apiError ?? '', ...r.errors, r.text].join(' '),
    });
    const waitMs = plan.action === 'resume' ? plan.waitMs : 0;
    const info = db.prepare('INSERT INTO interruptions(job_id, cause, detail, wait_until, attempt, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(ctx.jobId, cause, plan.detail, plan.action === 'resume' ? new Date(now + waitMs).toISOString() : null, attempts + 1, new Date(now).toISOString());
    ctx.report.interruptions.push({ cause, detail: plan.detail, waitMs });
    this.emit({ jobId: ctx.jobId, type: 'interrupt', text: `중단(${P.causeKo(cause)}): ${plan.detail}` });
    if (plan.action === 'give_up') throw new NeedsHuman(`자동 이어가기 상한 초과: ${plan.detail}`);
    setJobStatus(db, ctx.jobId, 'suspended');
    await this.sleep(waitMs);
    db.prepare('UPDATE interruptions SET resumed_at = ? WHERE id = ?').run(new Date(this.clock.now()).toISOString(), info.lastInsertRowid);
  }

  /** 완료 검사(보완 지시 최대 N번)와 보고 끝 글 질문 → 결정 카드(최대 M번) */
  private async finishLoop(ctx: RunCtx, first: TurnResult): Promise<TurnResult> {
    const { config, engine, db } = this.d;
    let r = first;
    let followups = 0;
    let tails = 0;
    for (;;) {
      const ran = ctx.impl.toolUses.filter((t) => t === 'Bash' || t === 'PowerShell').length;
      const missing = completionCheck(r.text, { language: ctx.language, ranCommands: ran });
      if (missing.length && followups < config.runner.completion_followups) {
        followups++;
        this.emit({ jobId: ctx.jobId, type: 'check', text: `완료 검사 보완 지시 ${followups}: ${missing.join(', ')}` });
        logEvent(db, ctx.jobId, 'completion_followup', { n: followups, missing });
        r = await this.turn(ctx, ctx.impl, P.followupPrompt(missing));
        continue;
      }
      ctx.report.completionMissing = missing;
      const q = detectTailQuestion(r.text);
      if (q && tails < config.runner.tail_question_max) {
        tails++;
        const tc = await this.d.tail.convert(q, ctx.request);
        setJobStatus(db, ctx.jobId, 'waiting_decision');
        const res = await engine.request({
          jobId: ctx.jobId, source: 'tail', header: '다음 단계', question: tc.question, options: tc.options, level: 'wait',
          context: { request: ctx.request, language: ctx.language, project: ctx.project.name, rules: ctx.pctx.rules, extra: `보고 끝:\n${q}` },
        });
        if (res.answer.kind === 'choice' && res.answer.label === STOP_LABEL) break;
        r = await this.turn(ctx, ctx.impl, P.tailAnswerPrompt(q, answerText(res.answer)));
        continue;
      }
      break;
    }
    ctx.report.followups = followups;
    ctx.report.tailQuestions = tails;
    if (ctx.report.completionMissing.length) ctx.report.humanItems.push(`완료 검사 보완 미완: ${ctx.report.completionMissing.join(', ')}`);
    return r;
  }

  /** 독립 테스트. 실패하면 디버거(새 대화) 후 다시 테스트. 최대 재시도 후에도 실패면 false */
  private async testPhase(ctx: RunCtx, implReport: string): Promise<boolean> {
    const { roles } = this.d;
    const maxRetries = roles.roles.debugger.max_retries ?? 2;
    let lastReport = implReport;
    for (let attempt = 0; ; attempt++) {
      const v = await this.runTester(ctx, lastReport, attempt);
      if (v.overall === 'pass') return true;
      const failed = v.criteria.filter((c) => !c.pass).map((c) => c.name).join(', ') || '판정 없음';
      if (roles.routing.on_test_fail === 'none' || attempt >= maxRetries) {
        ctx.report.humanItems.push(`독립 테스트 실패(${attempt + 1}번 시도): ${failed}`);
        return false;
      }
      this.emit({ jobId: ctx.jobId, type: 'phase', role: 'debugger', text: `디버거 투입(${attempt + 1}/${maxRetries}): ${failed}` });
      const dbg = phase('debugger');
      const dr = await this.turn(ctx, dbg, P.debuggerPrompt(ctx.request, fs.readFileSync(path.join(ctx.reportDir, `tester-${attempt + 1}.md`), 'utf8'), lastReport));
      fs.writeFileSync(path.join(ctx.reportDir, `debugger-${attempt + 1}.md`), dr.text);
      ctx.report.debugRuns++;
      lastReport = dr.text;
    }
  }

  private async runTester(ctx: RunCtx, implReport: string, attempt: number): Promise<Verdicts> {
    this.emit({ jobId: ctx.jobId, type: 'phase', role: 'tester', text: `독립 테스트 ${attempt + 1}번째` });
    const t = phase('tester');
    let tr = await this.turn(ctx, t, P.testerPrompt(ctx.request, implReport));
    let v = parseVerdicts(tr.text);
    if (v.overall === 'none') {
      tr = await this.turn(ctx, t, '판정 형식이 없습니다. 기준마다 "기준: / 판정: 통과 또는 실패 / 근거:" 형식으로, 마지막에 "종합 판정:" 줄을 넣어 다시 보고하세요.');
      v = parseVerdicts(tr.text);
    }
    fs.writeFileSync(path.join(ctx.reportDir, `tester-${attempt + 1}.md`), tr.text);
    ctx.report.tests.push({ attempt: attempt + 1, overall: v.overall, criteria: v.criteria });
    logEvent(this.d.db, ctx.jobId, 'verdict', { attempt: attempt + 1, ...v });
    this.emit({ jobId: ctx.jobId, type: 'verdict', role: 'tester', text: `판정: ${v.overall === 'pass' ? '통과' : v.overall === 'fail' ? '실패' : '판정 없음'} (${v.criteria.map((c) => `${c.name}=${c.pass ? '통과' : '실패'}`).join(', ')})` });
    return v.overall === 'none' ? { ...v, overall: 'fail' } : v;
  }

  /** 민감한 변경이면 리뷰어. 높음·중간 지적은 구현 세션에서 한 번 고치고 테스트를 다시 돌린다. */
  private async reviewPhase(ctx: RunCtx, retest: boolean): Promise<boolean> {
    const mode = this.d.roles.routing.review;
    if (mode === 'never') return true;
    const ch = collectChanges(ctx.workdir, ctx.baseHead);
    if (!ch.files.length) return true;
    const reasons = mode === 'always' ? ['항상 검토 설정'] : sensitiveReasons(ch.files, ch.diff);
    if (!reasons.length) return true;
    ctx.report.review.ran = true;
    ctx.report.review.reasons = reasons;
    this.emit({ jobId: ctx.jobId, type: 'phase', role: 'reviewer', text: `품질·보안 리뷰(${reasons.join(', ')})` });
    const rv = phase('reviewer');
    const rr = await this.turn(ctx, rv, P.reviewerPrompt(ch.diff, reasons));
    fs.writeFileSync(path.join(ctx.reportDir, 'reviewer.md'), rr.text);
    const findings = parseFindings(rr.text);
    ctx.report.review.findings = findings;
    logEvent(this.d.db, ctx.jobId, 'review', { reasons, findings });
    const important = findings.filter((f) => f.severity !== '낮음');
    this.emit({ jobId: ctx.jobId, type: 'review', role: 'reviewer', text: `지적 ${findings.length}개(높음·중간 ${important.length}개)` });
    for (const f of findings.filter((x) => x.severity === '높음' && /보안/.test(x.category))) {
      ctx.report.humanItems.push(`보안 지적(높음) 릴리스 전 확인: ${f.location} ${f.content}`);
    }
    if (!important.length) return true;
    const text = important.map((f) => `- [${f.severity}/${f.category}] ${f.location}: ${f.content}`).join('\n');
    this.emit({ jobId: ctx.jobId, type: 'phase', role: 'implementer', text: '리뷰 지적 수정' });
    const fix = await this.turn(ctx, ctx.impl, P.fixFindingsPrompt(text));
    ctx.report.review.fixed = true;
    ctx.report.implementerReport += `\n\n## 리뷰 지적 수정\n${fix.text}`;
    if (!retest) return true;
    const v = await this.runTester(ctx, fix.text, ctx.report.tests.length);
    if (v.overall !== 'pass') { ctx.report.humanItems.push('리뷰 지적 수정 후 다시 한 독립 테스트가 실패했습니다.'); return false; }
    return true;
  }

  private agents(): Record<string, AgentDefinition> {
    const r = this.d.roles.roles.researcher;
    return {
      researcher: {
        description: '코드·문서·웹 조사를 맡는 읽기 전용 조사 담당. 많이 읽어야 할 때 맡기고 요약만 돌려받는다.',
        prompt: '당신은 조사 담당입니다. 파일을 고치지 않습니다. 찾은 내용을 출처(파일 경로·주소)와 함께 짧게 요약해 돌려줍니다. 보고는 한국어로 씁니다.',
        tools: r.tools, model: r.model, maxTurns: r.max_turns,
      },
    };
  }

  private finalize(ctx: RunCtx): void {
    const { db } = this.d;
    const rep = ctx.report;
    const job = getJob(db, ctx.jobId);
    rep.costUsd = job?.costUsd ?? 0;
    rep.costByRole = costByRole(db, ctx.jobId);
    rep.pendingItems = extractPending(rep.implementerReport);
    const auto = db.prepare("SELECT question, answer, resolved_by FROM decisions WHERE job_id = ? AND resolved_by IN ('auto','preselect')").all(ctx.jobId) as { question: string; answer: string; resolved_by: string }[];
    rep.autoDecisions = auto.map((a) => {
      const q = (JSON.parse(a.question) as { question: string }).question.split('\n')[0];
      const ans = JSON.parse(a.answer) as { label?: string; text?: string };
      return `${q} → ${ans.label ?? ans.text} (${a.resolved_by === 'auto' ? '자동' : '골라 둔 답'})`;
    });
    if (rep.autoDecisions.length) rep.humanItems.push(`사람 없이 자동으로 정한 결정 ${rep.autoDecisions.length}개(결정 기록 확인 권장)`);
    if (rep.pendingItems) rep.humanItems.push(`보류 항목: ${rep.pendingItems.split('\n')[0]}`);
    if (rep.status === 'done' || rep.status === 'needs_human') {
      addHistory(db, ctx.project.id, ctx.jobId, `${ctx.request.slice(0, 80)} → ${rep.status === 'done' ? '완료' : '사람 확인 필요'}`, rep.pendingItems);
    }
    fs.writeFileSync(rep.reportPath, renderReport(ctx, rep));
    setJobStatus(db, ctx.jobId, rep.status);
    logEvent(db, ctx.jobId, 'done', { status: rep.status, humanItems: rep.humanItems });
    this.emit({ jobId: ctx.jobId, type: 'done', text: `작업 끝: ${rep.status}` });
  }
}

const STATUS_KO: Record<string, string> = { done: '완료', needs_human: '사람 확인 필요', failed: '실패', cancelled: '취소' };

export function renderReport(ctx: { request: string; project: Project }, r: JobReport): string {
  const lines = [
    `# 작업 보고서 ${r.jobId}`, '',
    `- 프로젝트: ${ctx.project.name} (${ctx.project.path})`,
    `- 결과: **${STATUS_KO[r.status] ?? r.status}**`,
    `- 작업 크기: ${r.size} (${r.sizeReason})`,
    `- 보고 언어: ${r.language}`,
    `- 비용: $${r.costUsd.toFixed(4)} (${Object.entries(r.costByRole).map(([k, v]) => `${ROLE_KO[k as RoleName] ?? k} $${v.toFixed(4)}`).join(', ') || '기록 없음'})`,
    '', '## 요청', ctx.request,
    '', '## 사람이 확인할 항목', ...(r.humanItems.length ? r.humanItems.map((h) => `- ${h}`) : ['- 없음']),
    '', '## 독립 테스트',
    ...(r.tests.length ? r.tests.map((t) => `- ${t.attempt}번째: ${t.overall === 'pass' ? '통과' : t.overall === 'fail' ? '실패' : '판정 없음'} (${t.criteria.map((c) => `${c.name}=${c.pass ? '통과' : '실패'}`).join('; ')})`) : ['- 실행하지 않음']),
    `- 디버거 투입: ${r.debugRuns}번`,
    '', '## 품질·보안 리뷰',
    r.review.ran ? `- 이유: ${r.review.reasons.join(', ')}` : '- 실행하지 않음(민감한 변경 없음)',
    ...r.review.findings.map((f) => `- [${f.severity}/${f.category}] ${f.location}: ${f.content}`),
    ...(r.review.ran ? [`- 지적 수정: ${r.review.fixed ? '함' : '필요 없음'}`] : []),
    '', '## 완료 검사',
    `- 보완 지시: ${r.followups}번, 보고 끝 질문을 카드로 바꿈: ${r.tailQuestions}번`,
    `- 남은 부족: ${r.completionMissing.join(', ') || '없음'}`,
    '', '## 중단과 이어가기', ...(r.interruptions.length ? r.interruptions.map((i) => `- ${P.causeKo(i.cause)}: ${i.detail}`) : ['- 없음']),
    '', '## 자동으로 정한 결정', ...(r.autoDecisions.length ? r.autoDecisions.map((a) => `- ${a}`) : ['- 없음']),
    '', '## 보류 항목', r.pendingItems ?? '없음',
    '', '## 구현 담당 보고 원문', r.implementerReport || '(없음)',
  ];
  return lines.join('\n') + '\n';
}
