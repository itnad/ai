import assert from 'node:assert/strict';
import { test } from 'node:test';
import { completionCheck, detectTailQuestion, extractPending, parseFindings, parseVerdicts, sensitiveReasons } from '../../src/runner/checks.ts';
import { classifyInterruption, parseResetsAt, planResume } from '../../src/runner/resume.ts';
import { ConfigSchema } from '../../src/core/config.ts';

test('보류 항목: "없음"으로 시작하면 보류 없음', () => {
  assert.equal(extractPending('## 보류 항목\n- 없음. 커밋과 푸시는 요청되지 않아 하지 않았습니다.'), null);
  assert.equal(extractPending('보류 항목: 없음'), null);
  assert.equal(extractPending('## 보류 항목\n- 없습니다\n'), null);
  assert.match(extractPending('## 보류 항목\n- 모바일 화면 확인 못 함\n')!, /모바일/);
});

test('완료 검사 항목', () => {
  assert.deepEqual(completionCheck('## 실행 방법\nx\n## 실제로 확인한 것\ny\n## 보류 항목\n없음', { language: 'ko', ranCommands: 1 }), []);
  const m = completionCheck('Done.', { language: 'ko', ranCommands: 0 });
  assert.equal(m.length, 4);
});

test('보고 끝 질문 감지', () => {
  assert.ok(detectTailQuestion('완료했습니다.\n\n테스트도 추가할까요?'));
  assert.ok(detectTailQuestion('끝.\n\n원하시면 다크 모드도 넣겠습니다.'));
  assert.equal(detectTailQuestion('완료했습니다.\n\n보류 항목: 없음'), null);
  assert.equal(detectTailQuestion('질문이 있나요?\n\n```js\nconsole.log("?")\n```'), null);
});

test('판정·지적 읽기', () => {
  assert.equal(parseVerdicts('기준: a\n판정: 통과\n기준: b\n**판정: 실패**\n종합 판정: 통과').overall, 'fail', '하나라도 실패면 실패');
  assert.equal(parseVerdicts('- 판정: 통과').criteria.length, 1);
  assert.equal(parseVerdicts('잘 됩니다').overall, 'none');
  assert.equal(parseFindings('지적 없음').length, 0);
  assert.equal(parseFindings('심각도: 중간\n분류: 품질\n위치: a.ts:3\n내용: x')[0].severity, '중간');
});

test('민감한 변경 판정', () => {
  assert.deepEqual(sensitiveReasons(['package.json'], ''), ['의존성 목록 변경']);
  assert.ok(sensitiveReasons(['a.js'], "+db.query('SELECT * FROM u WHERE id=' + id)").includes('SQL 문 조립'));
  assert.deepEqual(sensitiveReasons(['hello.html'], '+<h1>안녕</h1>'), []);
});

test('중단 분류와 재설정 시각', () => {
  const base = { sessionId: 's', text: '', totalCostUsd: 0, errors: [], toolUses: [] };
  assert.equal(classifyInterruption({ ...base, outcome: 'aborted' }, { wallClockHit: true }), 'wall_clock');
  assert.equal(classifyInterruption({ ...base, outcome: 'aborted' }, { wallClockHit: false }), null);
  assert.equal(classifyInterruption({ ...base, outcome: 'budget' }, { wallClockHit: false }), 'budget');
  assert.equal(classifyInterruption({ ...base, outcome: 'error', apiError: 'rate_limit' }, { wallClockHit: false }), 'usage_limit');
  assert.equal(classifyInterruption({ ...base, outcome: 'error', errors: ['socket hang up'] }, { wallClockHit: false }), 'network');
  assert.equal(classifyInterruption({ ...base, outcome: 'success' }, { wallClockHit: false }), null);
  const now = new Date(2026, 10, 27, 10, 0).getTime();
  assert.equal(parseResetsAt('limit reached|1764205200', now), 1764205200_000);
  assert.equal(new Date(parseResetsAt('Your limit resets at 3pm', now)!).getHours(), 15);
  assert.equal(new Date(parseResetsAt('resets 9am', now)!).getDate(), 28, '이미 지난 시각이면 다음 날');
  const cfg = ConfigSchema.parse({});
  const p = planResume('network', { config: cfg, now, attempts: 3, usageToday: 0, networkWaitedMs: 0, spentToday: 0 });
  assert.ok(p.action === 'resume' && p.waitMs === 240_000);
});
