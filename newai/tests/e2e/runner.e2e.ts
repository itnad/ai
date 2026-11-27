// 실제 Claude E2E(③ 러너). 임시 데이터 폴더, 대기 20초, 모든 역할 같은 모델(기본 Haiku).
// 첫 구현 세션을 10초 뒤 일부러 끊어 "네트워크 오류"로 만들고, 같은 세션으로 이어 가는지 본다.
// 실행: node tests/e2e/runner.e2e.ts [모델]
import '../../src/core/quiet.ts';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setConfigValue } from '../../src/core/config.ts';
import { ensureHome, findInstallDir, layout } from '../../src/core/paths.ts';
import { createJob } from '../../src/queue/jobs.ts';
import { createProject } from '../../src/queue/projects.ts';
import { SdkDriver, type SessionDriver, type TurnRequest, type TurnResult } from '../../src/runner/driver.ts';
import { createRuntime } from '../../src/runtime.ts';

const model = process.argv[2] ?? 'claude-haiku-5-5';
const home = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'newai-e2e-run-')), 'home');
ensureHome({ installDir: findInstallDir(), home });
await setConfigValue(layout(home).config, 'decision.timeout', '20s');

/** 첫 구현 세션만 10초 뒤 끊고 네트워크 오류처럼 돌려준다. */
class InterruptOnce implements SessionDriver {
  private readonly real = new SdkDriver();
  injected = false;
  calls: { role: string; resume: string | null | undefined; sessionId: string | null; outcome: string }[] = [];
  async run(req: TurnRequest): Promise<TurnResult> {
    let r: TurnResult;
    if (!this.injected && req.role === 'implementer') {
      this.injected = true;
      const ac = new AbortController();
      req.signal.addEventListener('abort', () => ac.abort());
      const t = setTimeout(() => ac.abort(), 10_000);
      r = await this.real.run({ ...req, signal: ac.signal });
      clearTimeout(t);
      if (r.outcome === 'aborted') r = { ...r, outcome: 'error', errors: ['fetch failed: E2E에서 일부러 낸 네트워크 중단'] };
    } else {
      r = await this.real.run(req);
    }
    this.calls.push({ role: req.role, resume: req.resume, sessionId: r.sessionId, outcome: r.outcome });
    return r;
  }
}

const driver = new InterruptOnce();
const t0 = Date.now();
const ts = () => `[${String(Math.round((Date.now() - t0) / 1000)).padStart(4)}초]`;
const rt = await createRuntime({ home, modelOverride: model, driver, onEvent: (e) => console.log(`${ts()} ${e.role ? `[${e.role}] ` : ''}${e.text.replace(/\n/g, ' ').slice(0, 200)}`) });
rt.engine.on('created', (c) => console.log(`${ts()} 결정 카드(${c.source}): ${c.question.split('\n')[0].slice(0, 120)} / ${c.candidates.map((x) => `${x.label} ${x.score}점`).join(', ')}`));
rt.engine.on('resolved', (r) => console.log(`${ts()} 결정: ${r.answer.kind === 'choice' ? r.answer.label : r.answer.text} (${r.resolvedBy})`));

const project = createProject(rt.db, rt.L.projects, 'hello-web');
const request = 'hello.html 웹 페이지 하나를 만드세요. 제목(h1)은 "안녕하세요 newai"이고, 버튼을 누르면 아래에 "눌렀습니다" 문구가 나타나야 합니다. 외부 라이브러리 없이 HTML 파일 하나로 만드세요.';
const job = createJob(rt.db, { projectId: project.id, request });
const r = await rt.runner.run(job.id);

console.log('\n===== 결과 =====');
console.log('상태:', r.status, `/ 작업 크기 ${r.size} (${r.sizeReason})`);
console.log('세션 호출:', JSON.stringify(driver.calls));
console.log('중단과 이어가기:', JSON.stringify(r.interruptions));
console.log('완료 검사 보완:', r.followups, '/ 남은 부족:', r.completionMissing.join(', ') || '없음', '/ 끝 질문 카드:', r.tailQuestions);
console.log('독립 테스트:', JSON.stringify(r.tests));
console.log('리뷰:', JSON.stringify(r.review));
console.log('비용:', r.costUsd.toFixed(4), JSON.stringify(r.costByRole));
console.log('사람이 확인할 항목:', r.humanItems);
console.log('보고서:', r.reportPath);
const html = path.join(project.path, 'hello.html');
console.log('hello.html:', fs.existsSync(html) ? `${fs.statSync(html).size}바이트` : '(없음)');
const firstImpl = driver.calls.find((c) => c.role === 'implementer');
const resumedImpl = driver.calls.find((c, i) => i > 0 && c.role === 'implementer' && c.resume === firstImpl?.sessionId);
const checks = {
  '작업 완료': r.status === 'done',
  '네트워크 중단 기록': r.interruptions.some((i) => i.cause === 'network'),
  '같은 세션으로 이어감': !!firstImpl?.sessionId && !!resumedImpl,
  '독립 테스트 통과': r.tests.at(-1)?.overall === 'pass',
  'hello.html 생성': fs.existsSync(html),
  '보고서 생성': fs.existsSync(r.reportPath),
};
for (const [k, v] of Object.entries(checks)) console.log(`  ${v ? '[통과]' : '[실패]'} ${k}`);
const ok = Object.values(checks).every(Boolean);
console.log(ok ? '판정: 통과' : '판정: 실패');
rt.db.close();
process.exit(ok ? 0 : 1);
