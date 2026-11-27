import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { ConfigSchema, type Config } from '../../src/core/config.ts';
import { ensureHome, findInstallDir, layout } from '../../src/core/paths.ts';
import { openDb } from '../../src/db/db.ts';
import { FakeClock } from '../../src/decision/clock.ts';
import { DecisionEngine } from '../../src/decision/engine.ts';
import { FakeScorer } from '../../src/decision/scorer.ts';
import { SqliteDecisionStore } from '../../src/decision/store.ts';
import { createJob, getJob, setJobStatus } from '../../src/queue/jobs.ts';
import { createProject } from '../../src/queue/projects.ts';
import { Policy } from '../../src/safety/policy.ts';
import { FakeDriver, untilAborted, type FakeStep } from '../../src/runner/driver.ts';
import { loadRoles } from '../../src/runner/roles.ts';
import { Runner, type JobReport } from '../../src/runner/runner.ts';
import type { Size } from '../../src/runner/sizer.ts';
import { RuleTail } from '../../src/runner/tail.ts';

const GOOD = '작업을 마쳤습니다.\n\n## 실행 방법\n`node app.js`\n\n## 실제로 확인한 것\n`node app.js` 를 실행해 정상 출력을 확인했습니다.\n\n## 보류 항목\n없음';
const PASS = '기준: 실행된다\n판정: 통과\n근거: node app.js 정상\n종합 판정: 통과';
const FAIL = '기준: 실행된다\n판정: 실패\n근거: 오류 발생\n종합 판정: 실패';
const ok = (text = GOOD, cost = 0.01): FakeStep => () => ({ text, toolUses: ['Bash'], totalCostUsd: cost });

interface Setup { runner: Runner; driver: FakeDriver; clock: FakeClock; jobId: string; db: ReturnType<typeof openDb>; config: Config; home: string; workdir: string; engine: DecisionEngine }

function setup(o: { steps: FakeStep[]; routing?: 'auto' | 'single' | 'full'; size?: Size; request?: string; cfg?: (c: Config) => void; scorer?: FakeScorer }): Setup {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'newai-run-'));
  const paths = { installDir: findInstallDir(), home };
  ensureHome(paths);
  const L = layout(home);
  const db = openDb(L.db);
  const config = ConfigSchema.parse({ decision: { timeout: '20s' }, roles: { routing: o.routing ?? 'single' } });
  o.cfg?.(config);
  const roles = loadRoles(L.roles);
  const policy = Policy.load(L.policy, paths);
  const clock = new FakeClock();
  const engine = new DecisionEngine({ scorer: o.scorer ?? new FakeScorer(), weights: config.scoring.weights, timeoutMs: 20_000, isExcluded: (t) => policy.isAutoSelectExcluded(t), clock, store: new SqliteDecisionStore(db) });
  const project = createProject(db, L.projects, 'p1');
  const driver = new FakeDriver(o.steps);
  const runner = new Runner({
    db, config, roles, policy, paths, engine, driver, clock, agentEnv: {}, tail: new RuleTail(),
    sizer: { size: async () => ({ size: o.size ?? 'medium', reason: '시험용 고정 크기', by: 'rule' }) },
  });
  const job = createJob(db, { projectId: project.id, request: o.request ?? '인사 프로그램 만들어 줘' });
  return { runner, driver, clock, jobId: job.id, db, config, home, workdir: project.path, engine };
}

async function drive(s: Setup, opts: { recovering?: boolean; step?: number } = {}): Promise<JobReport> {
  let done = false;
  let val: JobReport | undefined;
  let err: unknown;
  s.runner.run(s.jobId, { recovering: opts.recovering }).then((v) => { done = true; val = v; }, (e) => { done = true; err = e; });
  for (let i = 0; i < 20_000 && !done; i++) await s.clock.advance(opts.step ?? 1000);
  if (!done) throw new Error('작업이 끝나지 않음');
  if (err) throw err;
  return val!;
}

const interruptions = (s: Setup) => s.db.prepare('SELECT cause, detail, wait_until, created_at, resumed_at FROM interruptions WHERE job_id = ? ORDER BY id').all(s.jobId) as { cause: string; detail: string; wait_until: string | null; created_at: string; resumed_at: string | null }[];

test('single: 한 번에 끝나면 완료, 보고서·비용·기록이 남는다', async () => {
  const s = setup({ steps: [ok(GOOD, 0.02)] });
  const r = await drive(s);
  assert.equal(r.status, 'done');
  assert.equal(s.driver.requests.length, 1);
  assert.equal(s.driver.requests[0].role, 'implementer');
  assert.match(s.driver.requests[0].systemAppend, /AskUserQuestion/);
  assert.match(s.driver.requests[0].systemAppend, /한국어/);
  assert.equal(getJob(s.db, s.jobId)?.status, 'done');
  assert.equal(Math.round(r.costUsd * 100), 2);
  const md = fs.readFileSync(r.reportPath, 'utf8');
  for (const h of ['## 사람이 확인할 항목', '## 중단과 이어가기', '## 보류 항목']) assert.ok(md.includes(h), h);
  assert.equal((s.db.prepare('SELECT count(*) AS n FROM project_history').get() as { n: number }).n, 1);
});

test('완료 검사: 부족하면 같은 대화로 보완 지시(최대 2번)', async () => {
  const s = setup({ steps: [ok('다 했어요.'), ok('다 했어요. 실행 방법: node app.js'), ok(GOOD)] });
  const r = await drive(s);
  assert.equal(r.status, 'done');
  assert.equal(r.followups, 2);
  assert.equal(s.driver.requests[1].resume, 's1');
  assert.equal(s.driver.requests[2].resume, 's1');
  assert.match(s.driver.requests[1].prompt, /빠져 있습니다/);
});

test('완료 검사: 2번 보완해도 부족하면 사람 확인 필요', async () => {
  const s = setup({ steps: [ok('끝'), ok('끝'), ok('끝')] });
  const r = await drive(s);
  assert.equal(r.status, 'needs_human');
  assert.ok(r.humanItems.some((h) => h.includes('보완 미완')));
  assert.equal(s.driver.requests.length, 3);
});

test('명령을 한 번도 실행하지 않았으면 실제 확인 부족으로 본다', async () => {
  const s = setup({ steps: [() => ({ text: GOOD, toolUses: [] }), ok(GOOD)] });
  const r = await drive(s);
  assert.equal(r.followups, 1);
  assert.match(s.driver.requests[1].prompt, /명령을 한 번도 실행하지 않음/);
});

test('보고 끝 글 질문은 결정 카드가 되고, 마감 후 답을 같은 대화로 보낸다', async () => {
  const s = setup({ steps: [ok(`${GOOD}\n\n테스트 코드도 추가할까요?`), ok(GOOD)] });
  const r = await drive(s);
  assert.equal(r.status, 'done');
  assert.equal(r.tailQuestions, 1);
  assert.equal(s.driver.requests[1].resume, 's1');
  assert.match(s.driver.requests[1].prompt, /사용자 답: 제안대로 진행/);
  const card = s.db.prepare("SELECT source, resolved_by FROM decisions WHERE job_id = ?").get(s.jobId) as { source: string; resolved_by: string };
  assert.deepEqual({ ...card }, { source: 'tail', resolved_by: 'auto' });
  assert.ok(r.autoDecisions.length === 1);
});

test('보고 끝 질문에서 "여기서 마무리"가 고르면 더 진행하지 않는다', async () => {
  const s = setup({ steps: [ok(`${GOOD}\n\n배포도 할까요?`)], scorer: new FakeScorer({ '제안대로 진행': 2, '여기서 마무리': 9 }) });
  const r = await drive(s);
  assert.equal(s.driver.requests.length, 1);
  assert.equal(r.status, 'done');
});

test('역할 분담: 독립 테스트 실패 → 디버거(새 대화) → 다시 테스트 통과', async () => {
  const testerStep: FakeStep = async (req) => {
    const denied = await req.canUseTool('Write', { file_path: path.join(s.workdir, 'x.txt'), content: 'x' }, { signal: new AbortController().signal } as never);
    assert.equal(denied.behavior, 'deny', '테스트 담당은 파일을 못 고침');
    const bash = await req.canUseTool('Bash', { command: 'git commit -am x' }, { signal: new AbortController().signal } as never);
    assert.equal(bash.behavior, 'deny');
    return { text: FAIL, toolUses: ['Bash'] };
  };
  const s: Setup = setup({ routing: 'auto', steps: [ok(GOOD), testerStep, ok('고쳤습니다'), () => ({ text: PASS, toolUses: ['Bash'] })] });
  const r = await drive(s);
  assert.equal(r.status, 'done');
  assert.deepEqual(s.driver.requests.map((q) => q.role), ['implementer', 'tester', 'debugger', 'tester']);
  assert.equal(s.driver.requests[1].resume, null, '테스트는 새 대화');
  assert.equal(s.driver.requests[2].resume, null, '디버거도 새 대화');
  assert.deepEqual(s.driver.requests[1].tools, ['Read', 'Glob', 'Grep', 'Bash']);
  assert.ok(s.driver.requests[0].agents?.researcher, '구현 담당은 조사 하위 에이전트를 쓸 수 있음');
  assert.equal(r.debugRuns, 1);
  assert.deepEqual(r.tests.map((t) => t.overall), ['fail', 'pass']);
});

test('역할 분담: 디버거 2번 후에도 실패면 사람 확인 필요', async () => {
  const fail = (): ReturnType<FakeStep> => ({ text: FAIL, toolUses: ['Bash'] });
  const s = setup({ routing: 'auto', steps: [ok(GOOD), fail, ok('고침1'), fail, ok('고침2'), fail] });
  const r = await drive(s);
  assert.equal(r.status, 'needs_human');
  assert.equal(r.debugRuns, 2);
  assert.ok(r.humanItems.some((h) => h.includes('독립 테스트 실패')));
});

test('테스트 판정 형식이 없으면 한 번 다시 요청한다', async () => {
  const s = setup({ routing: 'auto', steps: [ok(GOOD), () => ({ text: '잘 됩니다', toolUses: ['Bash'] }), () => ({ text: PASS })] });
  const r = await drive(s);
  assert.equal(r.status, 'done');
  assert.equal(s.driver.requests[2].resume, 's2');
  assert.match(s.driver.requests[2].prompt, /판정 형식이 없습니다/);
});

test('이어가기: 작업 시간 한도 → 같은 세션으로 바로 이어감', async () => {
  const s = setup({ steps: [untilAborted({ totalCostUsd: 0.03 }), ok(GOOD, 0.05)], cfg: (c) => { c.runner.wall_clock_limit = '10s'; } });
  const r = await drive(s);
  assert.equal(r.status, 'done');
  assert.equal(s.driver.requests[1].resume, 's1');
  assert.match(s.driver.requests[1].prompt, /작업 시간 한도/);
  const it = interruptions(s);
  assert.equal(it[0].cause, 'wall_clock');
  assert.ok(it[0].resumed_at);
  assert.equal(Math.round(r.costUsd * 100), 5, '누적 비용은 차이로 기록(0.03 + 0.02)');
});

test('이어가기: 1회 비용 한도 → 일일 한도 안이면 바로 새 1회분', async () => {
  const s = setup({ steps: [() => ({ outcome: 'budget', totalCostUsd: 5 }), ok(GOOD, 7)] });
  const r = await drive(s);
  assert.equal(r.status, 'done');
  assert.equal(interruptions(s)[0].cause, 'budget');
  assert.equal(r.costUsd, 7, '이어진 세션의 누적 합계 7은 5 + 2로 기록');
});

test('이어가기: 일일 비용 한도를 넘으면 다음 날 0시까지 기다린다', async () => {
  const s = setup({ steps: [() => ({ outcome: 'budget', totalCostUsd: 2 }), ok(GOOD, 2.5)], cfg: (c) => { c.runner.budget_per_day_usd = 1; } });
  const t0 = s.clock.now();
  const r = await drive(s, { step: 10 * 60_000 });
  assert.equal(r.status, 'done');
  const it = interruptions(s)[0];
  assert.match(it.detail, /일일 비용 한도/);
  const midnight = new Date(t0); midnight.setHours(24, 0, 0, 0);
  assert.equal(Date.parse(it.wait_until!), midnight.getTime());
  assert.ok(Date.parse(it.resumed_at!) >= midnight.getTime());
});

test('이어가기: 사용량 한도 → 재설정 시각 + 여유 시간까지 기다린다', async () => {
  let resetsAt = 0;
  const s = setup({ steps: [() => { resetsAt = s.clock.now() + 2 * 3_600_000; return { outcome: 'error', apiError: 'rate_limit', resetsAt, errors: ['limit reached'] }; }, ok(GOOD)] });
  const r = await drive(s, { step: 60_000 });
  assert.equal(r.status, 'done');
  const it = interruptions(s)[0];
  assert.equal(it.cause, 'usage_limit');
  assert.equal(Date.parse(it.wait_until!), resetsAt + 2 * 60_000);
  assert.ok(Date.parse(it.resumed_at!) >= resetsAt + 2 * 60_000);
});

test('이어가기: 오류 문구 안의 재설정 시각도 읽는다', async () => {
  let epoch = 0;
  const s = setup({ steps: [() => { epoch = Math.floor(s.clock.now() / 1000) + 3600; return { outcome: 'error', errors: [`Claude AI usage limit reached|${epoch}`] }; }, ok(GOOD)] });
  await drive(s, { step: 60_000 });
  assert.equal(Date.parse(interruptions(s)[0].wait_until!), epoch * 1000 + 120_000);
});

test('이어가기: 네트워크 오류 → 30초, 60초, 120초 간격으로', async () => {
  const net: FakeStep = () => ({ outcome: 'error', errors: ['fetch failed'] });
  const s = setup({ steps: [net, net, net, ok(GOOD)] });
  const r = await drive(s);
  assert.equal(r.status, 'done');
  const waits = interruptions(s).map((i) => (Date.parse(i.wait_until!) - Date.parse(i.created_at)) / 1000);
  assert.deepEqual(waits, [30, 60, 120]);
});

test('이어가기: 상한을 넘으면 실패가 아니라 사람 확인 필요', async () => {
  const net: FakeStep = () => ({ outcome: 'error', errors: ['ECONNRESET'] });
  const s = setup({ steps: [net, net, net], cfg: (c) => { c.resume.network.max_attempts = 2; } });
  const r = await drive(s);
  assert.equal(r.status, 'needs_human');
  assert.ok(r.humanItems.some((h) => h.includes('상한 초과')));
  assert.ok(fs.readFileSync(r.reportPath, 'utf8').includes('네트워크 오류'));
});

test('이어가기: 서버 재시작 후 같은 세션으로 이어간다', async () => {
  const s = setup({ steps: [ok(GOOD)] });
  setJobStatus(s.db, s.jobId, 'running', { sessionId: 'sX' });
  const r = await drive(s, { recovering: true });
  assert.equal(r.status, 'done');
  assert.equal(s.driver.requests[0].resume, 'sX');
  assert.match(s.driver.requests[0].prompt, /서버 재시작/);
  const it = interruptions(s)[0];
  assert.equal(it.cause, 'restart');
  assert.equal((Date.parse(it.wait_until!) - Date.parse(it.created_at)) / 1000, 30);
});

test('사람이 멈추면 취소', async () => {
  const s = setup({ steps: [untilAborted()] });
  const p = drive(s);
  await s.clock.advance(0);
  s.runner.stop(s.jobId);
  const r = await p;
  assert.equal(r.status, 'cancelled');
  assert.equal(getJob(s.db, s.jobId)?.status, 'cancelled');
});

test('민감한 변경이면 리뷰어 → 높음·중간 지적을 구현 세션에서 고치고 다시 테스트', async () => {
  const implWrites: FakeStep = (req) => {
    fs.writeFileSync(path.join(req.cwd, 'run.js'), "const { exec } = require('child_process');\nexec('ls ' + process.argv[2]);\n");
    return { text: GOOD, toolUses: ['Bash'] };
  };
  const review = '심각도: 높음\n분류: 보안\n위치: run.js:2\n내용: 사용자 입력을 셸 명령에 그대로 붙임\n\n심각도: 낮음\n분류: 품질\n위치: run.js:1\n내용: 이름';
  const s = setup({ routing: 'auto', steps: [implWrites, () => ({ text: PASS }), () => ({ text: review }), ok('execFile로 바꿨습니다'), () => ({ text: PASS })] });
  const r = await drive(s);
  assert.deepEqual(s.driver.requests.map((q) => q.role), ['implementer', 'tester', 'reviewer', 'implementer', 'tester']);
  assert.equal(s.driver.requests[3].resume, 's1', '지적 수정은 구현 세션을 이어서');
  assert.ok(r.review.ran && r.review.reasons.includes('셸 실행'));
  assert.equal(r.review.findings.length, 2);
  assert.ok(r.review.fixed);
  assert.equal(r.status, 'done');
  assert.ok(r.humanItems.some((h) => h.startsWith('보안 지적(높음)')));
});

test('민감하지 않은 변경은 리뷰하지 않는다', async () => {
  const implWrites: FakeStep = (req) => { fs.writeFileSync(path.join(req.cwd, 'hello.txt'), '안녕\n'); return { text: GOOD, toolUses: ['Bash'] }; };
  const s = setup({ routing: 'auto', steps: [implWrites, () => ({ text: PASS })] });
  const r = await drive(s);
  assert.equal(r.review.ran, false);
  assert.equal(s.driver.requests.length, 2);
});

test('사용자가 영어를 명시하면 한국어 검사를 하지 않고 영어로 지시한다', async () => {
  const EN = 'Done.\n\nHow to run: `node app.js`\n\nVerified: ran `node app.js`, output ok.\n\nPending: none';
  const s = setup({ request: 'Please answer in English. Make a greeting script.', steps: [ok(EN)] });
  const r = await drive(s);
  assert.equal(r.language, 'en');
  assert.equal(r.followups, 0);
  assert.match(s.driver.requests[0].systemAppend, /영어\(English\)로/);
});

test('resume 전달 방식: 질문에서 멈췄다가 답이 정해지면 같은 대화로 알려 준다', async () => {
  const ask: FakeStep = async (req) => {
    const r = await req.canUseTool('AskUserQuestion', { questions: [{ question: '언어?', header: '언어', multiSelect: false, options: [{ label: 'TS', description: '' }, { label: 'JS', description: '' }] }] }, { signal: new AbortController().signal } as never);
    assert.ok(r.behavior === 'deny' && r.interrupt);
    return { text: '', toolUses: [] };
  };
  const s = setup({ steps: [ask, ok(GOOD)], cfg: (c) => { c.decision.deliver = 'resume'; } });
  const r = await drive(s);
  assert.equal(r.status, 'done');
  assert.equal(s.driver.requests[1].resume, 's1');
  assert.match(s.driver.requests[1].prompt, /언어\? → TS/);
});

test('새 대화에 이전 작업 기록과 프로젝트 규칙을 넣는다', async () => {
  const s = setup({ steps: [ok(GOOD), ok(GOOD)] });
  await drive(s);
  s.db.prepare("INSERT INTO rules(id, scope, project_id, text, origin, status, created_at) SELECT 'r1','project', project_id, '파일 이름은 영어 소문자로', 'manual', 'active', 'x' FROM jobs WHERE id = ?").run(s.jobId);
  const projectId = getJob(s.db, s.jobId)!.projectId!;
  const job2 = createJob(s.db, { projectId, request: '두 번째 요청' });
  const s2: Setup = { ...s, jobId: job2.id };
  await drive(s2);
  const sys = s.driver.requests[1].systemAppend;
  assert.match(sys, /이 프로젝트의 이전 작업/);
  assert.match(sys, /인사 프로그램 만들어 줘/);
  assert.match(sys, /파일 이름은 영어 소문자로/);
});
