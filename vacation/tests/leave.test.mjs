import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planLeave, splitByMonth, countWorkdays, findConflict } from '../src/lib/leave.js';
import { currentYm, todayKST, addMonths, lastDayOfMonth, isValidDate } from '../src/lib/dates.js';

const holidays = new Set(['2026-12-25', '2027-01-01']);

test('주말과 공휴일은 휴가 일수에서 빠진다', () => {
  // 2026-12-21(월) ~ 12-27(일), 25일 성탄절
  assert.equal(countWorkdays('2026-12-21', '2026-12-27', holidays), 4);
});

test('달을 넘기는 휴가는 월별로 나뉜다', () => {
  assert.deepEqual(splitByMonth('2026-12-30', '2027-01-04'), [
    { start: '2026-12-30', end: '2026-12-31' },
    { start: '2027-01-01', end: '2027-01-04' },
  ]);
  const plan = planLeave({ type: 'annual', start: '2026-12-30', end: '2027-01-04' }, holidays);
  // 12/30(수), 12/31(목) = 2일 / 1/1 공휴일, 1/2~3 주말, 1/4(월) = 1일
  assert.deepEqual(plan.pieces.map((p) => p.days), [2, 1]);
});

test('근무일이 없는 조각은 저장하지 않는다', () => {
  // 2026-10-31(토) ~ 11-02(월)
  const plan = planLeave({ type: 'annual', start: '2026-10-31', end: '2026-11-02' }, holidays);
  assert.equal(plan.pieces.length, 1);
  assert.equal(plan.pieces[0].start, '2026-11-01');
  assert.equal(plan.pieces[0].days, 1);
});

test('반차는 0.5일, 종료일은 무시', () => {
  const plan = planLeave({ type: 'am_half', start: '2026-11-27', end: '2026-11-30' }, holidays);
  assert.deepEqual(plan.pieces, [{ start: '2026-11-27', end: '2026-11-27', days: 0.5 }]);
});

test('주말이나 공휴일 반차는 거부', () => {
  assert.ok(planLeave({ type: 'pm_half', start: '2026-11-28' }, holidays).error);
  assert.ok(planLeave({ type: 'pm_half', start: '2026-12-25' }, holidays).error);
});

test('잘못된 입력은 거부', () => {
  assert.ok(planLeave({ type: 'nope', start: '2026-11-27' }, holidays).error);
  assert.ok(planLeave({ type: 'annual', start: '2026-02-30' }, holidays).error);
  assert.ok(planLeave({ type: 'annual', start: '2026-11-27', end: '2026-11-26' }, holidays).error);
  assert.ok(planLeave({ type: 'annual', start: '2026-11-28', end: '2026-11-29' }, holidays).error);
  assert.ok(planLeave({ type: 'annual', start: '2026-01-01', end: '2026-06-30' }, holidays).error);
});

test('겹치는 기록 판정: 같은 날 오전·오후 반차만 허용', () => {
  const am = [{ type: 'am_half', start_date: '2026-11-27', end_date: '2026-11-27' }];
  assert.equal(findConflict('pm_half', '2026-11-27', '2026-11-27', am), null);
  assert.ok(findConflict('am_half', '2026-11-27', '2026-11-27', am));
  assert.ok(findConflict('annual', '2026-11-26', '2026-11-27', am));
  assert.equal(findConflict('annual', '2026-11-30', '2026-11-30', am), null);
});

test('날짜 도우미', () => {
  assert.equal(addMonths('2026-12', 1), '2027-01');
  assert.equal(addMonths('2026-01', -1), '2025-12');
  assert.equal(lastDayOfMonth('2028-02'), '2028-02-29');
  assert.equal(isValidDate('2026-13-01'), false);
  // 한국 시간 자정 직후는 이미 다음 날
  assert.equal(todayKST(new Date('2026-11-30T15:30:00Z')), '2026-12-01');
  assert.equal(currentYm(new Date('2026-11-30T15:30:00Z')), '2026-12');
});
