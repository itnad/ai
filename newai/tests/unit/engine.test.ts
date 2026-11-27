import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { FakeClock } from '../../src/decision/clock.ts';
import { DecisionEngine, EngineError } from '../../src/decision/engine.ts';
import { FakeScorer, weightedScore } from '../../src/decision/scorer.ts';
import { MemoryDecisionStore, SqliteDecisionStore } from '../../src/decision/store.ts';
import type { Resolution } from '../../src/decision/types.ts';
import { openDb } from '../../src/db/db.ts';

const W = { goal: 30, reversible: 20, scope: 15, env: 15, rules: 10, cost: 10 };
const excluded = (t: string) => /push|배포|푸시/i.test(t);
let n = 0;
function make(o: { scorer?: FakeScorer; timeoutMs?: number; store?: MemoryDecisionStore | SqliteDecisionStore; clock?: FakeClock } = {}) {
  const clock = o.clock ?? new FakeClock();
  const engine = new DecisionEngine({ scorer: o.scorer ?? new FakeScorer(), weights: W, timeoutMs: o.timeoutMs ?? 60_000, isExcluded: excluded, clock, store: o.store, idGen: () => `dc_${++n}` });
  return { engine, clock };
}
const ask = (options: string[], extra: Record<string, unknown> = {}) => ({ source: 'ask' as const, question: '어떻게 할까요?', options: options.map((label) => ({ label })), level: 'wait' as const, ...extra });

test('점수 높은 순으로 최대 3개, 대기 시간이 지나면 1순위 자동 선택', async () => {
  const { engine, clock } = make({ scorer: new FakeScorer({ A: 3, B: 9, C: 6, D: 8 }) });
  const card = await engine.create(ask(['A', 'B', 'C', 'D']));
  assert.deepEqual(card.candidates.map((c) => c.label), ['B', 'D', 'C']);
  assert.equal(card.candidates[0].score, 90);
  let res: Resolution | undefined;
  engine.wait(card.id).then((r) => { res = r; });
  await clock.advance(59_000);
  assert.equal(res, undefined, '마감 전에는 결정되지 않음');
  await clock.advance(1_000);
  const got = (): Resolution | undefined => res;
  assert.equal(got()?.resolvedBy, 'auto');
  assert.deepEqual(got()?.answer, { kind: 'choice', index: 0, label: 'B', value: undefined });
});

test('push·배포 선택지는 점수가 높아도 자동 선택하지 않는다', async () => {
  const { engine, clock } = make({ scorer: new FakeScorer({ '원격에 push': 10, '로컬 커밋만': 6 }) });
  const card = await engine.create(ask(['원격에 push', '로컬 커밋만']));
  assert.equal(card.candidates[0].label, '원격에 push');
  assert.equal(card.candidates[0].autoSelectable, false);
  const p = engine.wait(card.id);
  await clock.advance(60_000);
  const r = await p;
  assert.equal(r.answer.kind === 'choice' && r.answer.label, '로컬 커밋만');
});

test('자동 선택 가능한 안이 없으면 마감 후에도 사람을 기다린다', async () => {
  const { engine, clock } = make();
  const events: string[] = [];
  engine.on('needs_human', (c) => events.push(c.id));
  const card = await engine.create(ask(['push 하기', '배포하기']));
  await clock.advance(10 * 60_000);
  assert.equal(engine.get(card.id)?.status, 'pending');
  assert.equal(engine.get(card.id)?.deadlineAt, null);
  assert.deepEqual(events, [card.id]);
  engine.answer(card.id, { index: 1 });
  assert.equal(engine.get(card.id)?.resolvedBy, 'human');
});

test('사람 승인(human) 카드는 마감이 없고, 골라 두기는 즉시 적용', async () => {
  const { engine, clock } = make();
  const card = await engine.create(ask(['허용', '거부'], { level: 'human' }));
  assert.equal(card.deadlineAt, null);
  assert.equal(card.candidates.every((c) => !c.autoSelectable), true);
  await clock.advance(60 * 60_000);
  assert.equal(engine.get(card.id)?.status, 'pending');
  engine.preselect(card.id, 1);
  const ans = engine.get(card.id)?.answer;
  assert.equal(ans?.kind === 'choice' && ans.label, '거부');
  assert.equal(engine.get(card.id)?.resolvedBy, 'human');
});

test('골라 두기: 마감 때 1순위 대신 골라 둔 답을 적용', async () => {
  const { engine, clock } = make();
  const card = await engine.create(ask(['A', 'B', 'C']));
  engine.preselect(card.id, 2);
  const p = engine.wait(card.id);
  await clock.advance(60_000);
  const r = await p;
  assert.equal(r.resolvedBy, 'preselect');
  assert.equal(r.answer.kind === 'choice' && r.answer.label, 'C');
});

test('직접 입력과 즉시 고르기', async () => {
  const { engine } = make();
  const c1 = await engine.create(ask(['A', 'B']));
  const r1 = engine.answer(c1.id, { text: '  둘 다 아니고 CLI로  ' });
  assert.deepEqual(r1.answer, { kind: 'text', text: '둘 다 아니고 CLI로' });
  assert.throws(() => engine.answer(c1.id, { index: 0 }), EngineError);
  const c2 = await engine.create(ask(['A', 'B']));
  assert.throws(() => engine.answer(c2.id, { text: '   ' }), /비어/);
  assert.throws(() => engine.answer(c2.id, { index: 5 }), /없는 추천안/);
});

test('타이머 멈춤: 멈춘 시간만큼 마감이 늦어진다', async () => {
  const { engine, clock } = make();
  const card = await engine.create(ask(['A', 'B']));
  await clock.advance(30_000);
  engine.pause(card.id);
  await clock.advance(10 * 60_000);
  assert.equal(engine.get(card.id)?.status, 'paused');
  engine.resume(card.id);
  assert.equal(engine.get(card.id)?.deadlineAt, card.createdAt + 60_000 + 10 * 60_000);
  await clock.advance(29_000);
  assert.equal(engine.get(card.id)?.status, 'pending');
  await clock.advance(1_000);
  assert.equal(engine.get(card.id)?.resolvedBy, 'auto');
});

test('대기 시간 변경은 떠 있는 카드에도 즉시 적용', async () => {
  const { engine, clock } = make({ timeoutMs: 20 * 60_000 });
  const card = await engine.create(ask(['A', 'B']));
  await clock.advance(30_000);
  engine.setTimeoutMs(20_000);
  await clock.advance(0);
  assert.equal(engine.get(card.id)?.resolvedBy, 'auto', '이미 20초가 지났으므로 바로 결정');
  const c2 = await engine.create(ask(['A', 'B']));
  engine.setTimeoutMs(5 * 60_000);
  await clock.advance(60_000);
  assert.equal(engine.get(c2.id)?.status, 'pending');
  await clock.advance(4 * 60_000);
  assert.equal(engine.get(c2.id)?.resolvedBy, 'auto');
});

test('판단 모델이 실패하면 원래 순서로 점수를 매기고 기록한다', async () => {
  const { engine } = make({ scorer: new FakeScorer({}, undefined, true) });
  const card = await engine.create(ask(['첫째', '둘째']));
  assert.equal(card.scoredBy, 'rule');
  assert.deepEqual(card.candidates.map((c) => c.label), ['첫째', '둘째']);
});

test('선택지가 2개면 판단 모델 제안 1개를 더한다', async () => {
  const scorer = new FakeScorer({ 예: 7, 아니오: 4, '절충안': 6 }, { label: '절충안', description: '일부만' });
  const { engine } = make({ scorer });
  const card = await engine.create(ask(['예', '아니오'], { allowPropose: true }));
  assert.deepEqual(card.candidates.map((c) => [c.label, !!c.proposed]), [['예', false], ['절충안', true], ['아니오', false]]);
  assert.equal(scorer.calls[0].allowPropose, true);
});

test('고정 후보(권한 카드)는 점수화를 건너뛴다', async () => {
  const scorer = new FakeScorer();
  const { engine } = make({ scorer });
  const card = await engine.create({ source: 'permission', question: 'curl 실행?', options: [], level: 'wait',
    fixed: [{ label: '허용', score: 60, reason: '대기 후 진행', value: 'allow' }, { label: '거부', score: 40, reason: '', value: 'deny' }] });
  assert.equal(scorer.calls.length, 0);
  assert.equal(card.scoredBy, 'fixed');
  assert.equal(card.candidates[0].value, 'allow');
});

test('가중 점수 계산', () => {
  assert.equal(weightedScore({ goal: 10, reversible: 10, scope: 10, env: 10, rules: 10, cost: 10 }, W), 100);
  assert.equal(weightedScore({ goal: 10, reversible: 0, scope: 0, env: 0, rules: 0, cost: 0 }, W), 30);
  assert.equal(weightedScore({ goal: 99, reversible: -5, scope: 5, env: 5, rules: 5, cost: 5 }, W), 55);
});

test('재시작: 저장된 카드를 되살리고, 지난 마감은 바로 처리', async () => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'newai-dc-')), 'newai.db');
  const db = openDb(f);
  const clock = new FakeClock();
  const a = make({ store: new SqliteDecisionStore(db), clock });
  const c1 = await a.engine.create(ask(['A', 'B']));
  await clock.advance(10_000);
  const c2 = await a.engine.create(ask(['X', 'Y']));
  a.engine.preselect(c2.id, 1);
  // 서버가 죽었다가 2분 뒤 다시 켜짐
  const clock2 = new FakeClock(clock.now() + 120_000);
  const b = make({ store: new SqliteDecisionStore(db), clock: clock2 });
  const restored = b.engine.restore();
  assert.equal(restored.length, 2);
  assert.equal(b.engine.get(c1.id)?.resolvedBy, 'auto');
  assert.equal(b.engine.get(c2.id)?.resolvedBy, 'preselect');
  const saved = new SqliteDecisionStore(db).get(c2.id);
  assert.equal(saved?.answer?.kind === 'choice' && saved.answer.label, 'Y');
  db.close();
});

test('메모리 저장소도 같은 동작', async () => {
  const store = new MemoryDecisionStore();
  const { engine } = make({ store });
  const c = await engine.create(ask(['A', 'B']));
  engine.pause(c.id);
  assert.equal(store.get(c.id)?.status, 'paused');
});
