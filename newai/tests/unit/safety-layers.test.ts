import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { makeCanUseTool } from '../../src/decision/adapters.ts';
import { FakeClock } from '../../src/decision/clock.ts';
import { DecisionEngine } from '../../src/decision/engine.ts';
import { FakeScorer } from '../../src/decision/scorer.ts';
import { buildAgentEnv, ensureBlockerScripts } from '../../src/safety/git-env.ts';
import { makePreToolUseHook } from '../../src/safety/hooks.ts';
import { Policy, writeTargets } from '../../src/safety/policy.ts';
import { classifyTool } from '../../src/safety/tool-classify.ts';

const TEMPLATE = fs.readFileSync(path.join(import.meta.dirname, '../../templates/policy.yaml'), 'utf8');
const policy = Policy.parse(TEMPLATE, { installDir: '/opt/newai', home: '/home/u/.newai', platform: 'linux' });
const W = { goal: 30, reversible: 20, scope: 15, env: 15, rules: 10, cost: 10 };
const sig = { signal: new AbortController().signal } as Parameters<ReturnType<typeof makeCanUseTool>>[2];

function setup(scorer = new FakeScorer()) {
  const clock = new FakeClock();
  const engine = new DecisionEngine({ scorer, weights: W, timeoutMs: 20_000, isExcluded: (t) => policy.isAutoSelectExcluded(t), clock });
  const logs: string[] = [];
  const canUse = makeCanUseTool({ engine, policy, workdir: '/work/p', log: (e) => logs.push(`${e.tool}:${e.outcome}`) });
  return { clock, engine, canUse, logs };
}

test('리다이렉트·tee 대상 추출', () => {
  assert.deepEqual(writeTargets('echo hi > out.txt'), ['out.txt']);
  assert.deepEqual(writeTargets('cmd >> /tmp/log 2>&1'), ['/tmp/log']);
  assert.deepEqual(writeTargets('npm test 2> err.log | tee -a "report.txt"'), ['report.txt']);
  assert.deepEqual(writeTargets('ls > /dev/null 2>&1'), []);
  assert.deepEqual(writeTargets('[ $a -gt 3 ] && echo ok'), []);
});

test('Bash 리다이렉트로 작업 폴더 밖·보호 경로 쓰기도 잡는다', () => {
  assert.equal(policy.classifyBashIn('echo x > notes.txt', '/work/p').level, 'allow');
  assert.equal(policy.classifyBashIn('echo x > ../other/notes.txt', '/work/p').level, 'wait');
  assert.equal(policy.classifyBashIn('echo x | tee /home/u/.newai/config.yaml', '/work/p').level, 'human');
});

test('도구 판정: 쓰기·읽기·웹·알 수 없는 도구', () => {
  const c = (toolName: string, input: Record<string, unknown>) => classifyTool(policy, { toolName, input, workdir: '/work/p' }).level;
  assert.equal(c('Write', { file_path: '/work/p/a.ts' }), 'allow');
  assert.equal(c('Edit', { file_path: '/opt/newai/src/x.ts' }), 'human');
  assert.equal(c('Read', { file_path: '/work/p/.env' }), 'human');
  assert.equal(c('Read', { file_path: '/work/p/src/a.ts' }), 'allow');
  assert.equal(c('Glob', { pattern: '**/*.ts' }), 'allow');
  assert.equal(c('WebFetch', { url: 'http://localhost:3000' }), 'allow');
  assert.equal(c('WebFetch', { url: 'https://example.com' }), 'wait');
  assert.equal(c('WebSearch', { query: 'x' }), 'wait');
  assert.equal(c('mcp__github__create_pr', {}), 'wait');
  assert.equal(c('SomethingNew', {}), 'wait');
  assert.equal(c('Bash', { command: 'git push' }), 'deny');
});

test('AskUserQuestion: 카드가 되고, 마감 후 1순위가 answers에 들어간다', async () => {
  const { clock, engine, canUse } = setup(new FakeScorer({ 한국어: 9, 영어: 5 }));
  const input = { questions: [{ question: '언어는?', header: '언어', multiSelect: false, options: [{ label: '영어', description: '' }, { label: '한국어', description: '' }] }] };
  let result: Awaited<ReturnType<typeof canUse>> | undefined;
  canUse('AskUserQuestion', input, sig).then((r) => { result = r; });
  await clock.advance(0);
  assert.equal(engine.open().length, 1);
  await clock.advance(20_000);
  assert.ok(result && result.behavior === 'allow');
  assert.deepEqual((result.updatedInput as { answers: unknown }).answers, { '언어는?': '한국어' });
});

test('AskUserQuestion 여러 질문: 사람이 하나는 직접 입력, 하나는 자동', async () => {
  const { clock, engine, canUse } = setup();
  const input = { questions: [
    { question: 'Q1?', header: 'a', multiSelect: false, options: [{ label: 'A1', description: '' }, { label: 'A2', description: '' }] },
    { question: 'Q2?', header: 'b', multiSelect: false, options: [{ label: 'B1', description: '' }, { label: 'B2', description: '' }] },
  ] };
  const p = canUse('AskUserQuestion', input, sig);
  await clock.advance(0);
  const [c1] = engine.open();
  engine.answer(c1.id, { text: '직접 쓴 답' });
  await clock.advance(20_000);
  const r = await p;
  assert.ok(r.behavior === 'allow');
  assert.deepEqual((r.updatedInput as { answers: unknown }).answers, { 'Q1?': '직접 쓴 답', 'Q2?': 'B1' });
});

test('계획 승인: 자동이면 승인, 사람이 직접 입력하면 보완 요청으로 전달', async () => {
  const a = setup(new FakeScorer({ '계획 승인': 8, '보완 요청': 4 }));
  const p1 = a.canUse('ExitPlanMode', { plan: '1. 화면 만들기' }, sig);
  await a.clock.advance(20_000);
  assert.equal((await p1).behavior, 'allow');
  const b = setup();
  const p2 = b.canUse('ExitPlanMode', { plan: 'x' }, sig);
  await b.clock.advance(0);
  b.engine.answer(b.engine.open()[0].id, { text: '테스트 단계를 넣어 주세요' });
  const r2 = await p2;
  assert.ok(r2.behavior === 'deny' && /테스트 단계를 넣어 주세요/.test(r2.message));
});

test('권한: 허용은 바로, 거부는 바로, 대기는 마감 후 허용, 사람 승인은 계속 대기', async () => {
  const { clock, engine, canUse } = setup();
  assert.equal((await canUse('Bash', { command: 'npm test' }, sig)).behavior, 'allow');
  const denied = await canUse('Bash', { command: 'git push origin main' }, sig);
  assert.ok(denied.behavior === 'deny' && /push/.test(denied.message));
  const pWait = canUse('Bash', { command: 'curl https://example.com' }, sig);
  await clock.advance(20_000);
  assert.equal((await pWait).behavior, 'allow');
  let human: Awaited<ReturnType<typeof canUse>> | undefined;
  canUse('Bash', { command: 'git reset --hard' }, sig).then((r) => { human = r; });
  await clock.advance(3_600_000);
  assert.equal(human, undefined, '사람 승인은 자동으로 풀리지 않음');
  const card = engine.open()[0];
  assert.equal(card.level, 'human');
  engine.answer(card.id, { index: card.candidates.findIndex((c) => c.value === 'deny') });
  await clock.advance(0);
  const got = (): Awaited<ReturnType<typeof canUse>> | undefined => human;
  assert.equal(got()?.behavior, 'deny');
});

test('resume 방식: 콜백은 바로 멈추고 카드는 남는다', async () => {
  const clock = new FakeClock();
  const engine = new DecisionEngine({ scorer: new FakeScorer(), weights: W, timeoutMs: 20_000, isExcluded: () => false, clock });
  const deferred: string[] = [];
  const canUse = makeCanUseTool({ engine, policy, workdir: '/work/p', deliver: 'resume', onDeferred: (cs) => deferred.push(...cs.map((c) => c.id)) });
  const r = await canUse('AskUserQuestion', { questions: [{ question: 'Q?', header: 'h', multiSelect: false, options: [{ label: 'A', description: '' }, { label: 'B', description: '' }] }] }, sig);
  assert.ok(r.behavior === 'deny' && r.interrupt === true);
  assert.equal(deferred.length, 1);
  assert.equal(engine.get(deferred[0])?.status, 'pending');
});

test('PreToolUse 훅: 거부는 deny, 대기·사람 승인은 ask, 허용과 질문 도구는 통과', async () => {
  const hook = makePreToolUseHook({ policy, workdir: '/work/p' });
  const call = (tool_name: string, tool_input: Record<string, unknown>) =>
    hook({ hook_event_name: 'PreToolUse', tool_name, tool_input, session_id: 's', transcript_path: '', cwd: '/work/p' } as Parameters<typeof hook>[0], undefined, { signal: new AbortController().signal });
  const d = (r: unknown) => (r as { hookSpecificOutput?: { permissionDecision?: string } }).hookSpecificOutput?.permissionDecision;
  assert.equal(d(await call('Bash', { command: 'git push' })), 'deny');
  assert.equal(d(await call('Read', { file_path: '.env' })), 'ask');
  assert.equal(d(await call('Bash', { command: 'curl https://x.com' })), 'ask');
  assert.equal(d(await call('Bash', { command: 'ls' })), undefined);
  assert.equal(d(await call('AskUserQuestion', {})), undefined);
});

test('git push 차단 환경: 로컬·https·스크립트 안 push 실패, fetch는 정상, 기존 GIT_CONFIG 유지', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'newai-git-'));
  const binDir = path.join(root, 'bin');
  ensureBlockerScripts(binDir);
  const git = (args: string[], cwd: string, env: NodeJS.ProcessEnv = process.env) => spawnSync('git', args, { cwd, env, encoding: 'utf8' });
  git(['init', '-q', '--bare', 'remote.git'], root);
  const work = path.join(root, 'work');
  git(['init', '-q', work], root);
  git(['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'init'], work);
  git(['remote', 'add', 'origin', path.join(root, 'remote.git')], work);
  git(['remote', 'add', 'gh', 'https://github.com/example/x.git'], work);
  const base = { ...process.env, GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'user.name', GIT_CONFIG_VALUE_0: '기존설정', GH_TOKEN: 'secret' };
  const env = buildAgentEnv(base, { binDir });
  assert.equal(env.GH_TOKEN, undefined, 'push용 토큰 제거');
  assert.equal(env.GIT_CONFIG_KEY_0, 'user.name', '기존 GIT_CONFIG 유지');
  assert.equal(git(['config', 'user.name'], work, env).stdout.trim(), '기존설정');
  for (const args of [['push', 'origin', 'HEAD:main'], ['push', 'gh', 'HEAD:main']]) {
    const r = git(args, work, env);
    assert.notEqual(r.status, 0, args.join(' '));
    assert.match(r.stderr, /git push가 막혀 있습니다/);
  }
  fs.writeFileSync(path.join(work, 'deploy.sh'), 'git push origin HEAD:main\n');
  const s = spawnSync('sh', ['deploy.sh'], { cwd: work, env, encoding: 'utf8' });
  assert.notEqual(s.status, 0);
  assert.match(s.stderr, /막혀 있습니다/);
  assert.equal(git(['fetch', 'origin'], work, env).status, 0, 'fetch는 막지 않음');
  assert.equal(git(['ls-remote', '--heads', 'origin'], work, env).stdout.trim(), '', '원격에 아무것도 올라가지 않음');
  assert.equal(git(['push', 'origin', 'HEAD:main'], work).status, 0, '차단 환경이 아니면(릴리스 단계) push 가능');
});

test('Windows용 차단 접두사에는 드라이브 문자와 UNC가 들어간다', () => {
  const env = buildAgentEnv({ Path: 'C:\\Windows' }, { binDir: 'C:\\newai\\bin', platform: 'win32' });
  const values = Object.entries(env).filter(([k]) => k.startsWith('GIT_CONFIG_VALUE_')).map(([, v]) => v);
  assert.ok(values.includes('C:') && values.includes('d:') && values.includes('\\\\'));
  assert.equal(env.Path, 'C:\\newai\\bin;C:\\Windows');
});

test('따옴표 안의 > 와 화살표 함수는 리다이렉트가 아니다', () => {
  assert.deepEqual(writeTargets(`node -e "const f = async () => { console.log('a > b') }"`), []);
  assert.deepEqual(writeTargets(`node -e 'x => x' > "out file.txt"`), ['out file.txt']);
  assert.deepEqual(writeTargets(`echo "a" > b.txt`), ['b.txt']);
});

test('읽기 전용 역할: 하네스 임시 폴더 안 쓰기는 허용, 밖은 거부', async () => {
  const { readOnlyGuard } = await import('../../src/safety/role-guard.ts');
  const call = (toolName: string, input: Record<string, unknown>) => readOnlyGuard({ toolName, input, workdir: '/work/p', writable: ['/home/u/.newai/reports/j1/scratch'] });
  assert.equal(call('Write', { file_path: '/home/u/.newai/reports/j1/scratch/check.js' }), null);
  assert.equal(call('Write', { file_path: '/work/p/index.html' })?.level, 'deny');
  assert.equal(call('Bash', { command: 'mkdir -p /home/u/.newai/reports/j1/scratch && cat > /home/u/.newai/reports/j1/scratch/c.js <<EOF' }), null);
  assert.equal(call('Bash', { command: 'mkdir build' })?.level, 'deny');
  assert.equal(call('Bash', { command: 'rm -f /work/p/a.txt' })?.level, 'deny');
  assert.equal(call('Bash', { command: `node -e "(async () => { const b = await import('playwright') })()"` }), null);
  assert.equal(call('Bash', { command: 'git commit -m x' })?.level, 'deny');
  assert.equal(call('Bash', { command: 'npx jest' }), null);
});

test('정책: 임시 폴더 쓰기는 작업 폴더 밖이어도 대기 없이 허용', () => {
  assert.equal(policy.classifyWrite('/tmp/s/a.js', '/work/p', ['/tmp/s']).level, 'allow');
  assert.equal(policy.classifyWrite('/tmp/other/a.js', '/work/p', ['/tmp/s']).level, 'wait');
  assert.equal(policy.classifyBashIn('echo x > /tmp/s/out.txt', '/work/p', ['/tmp/s']).level, 'allow');
});
