import { addDays, dayOfWeek, diffDays, eachDate, isValidDate, lastDayOfMonth } from './dates.js';

// deduct: 연차 잔여일수에서 차감하는지 여부
export const LEAVE_TYPES = {
  annual:  { label: '연차',      deduct: true,  half: false },
  am_half: { label: '오전 반차', deduct: true,  half: true },
  pm_half: { label: '오후 반차', deduct: true,  half: true },
  sick:    { label: '병가',      deduct: false, half: false },
  family:  { label: '경조사',    deduct: false, half: false },
  other:   { label: '기타',      deduct: false, half: false },
};

export const DEDUCT_TYPES = Object.keys(LEAVE_TYPES).filter((t) => LEAVE_TYPES[t].deduct);
export const MAX_RANGE_DAYS = 62;

export function typeLabel(type) {
  return LEAVE_TYPES[type]?.label ?? type;
}

export function isWorkday(date, holidaySet) {
  const dow = dayOfWeek(date);
  return dow !== 0 && dow !== 6 && !holidaySet.has(date);
}

export function countWorkdays(start, end, holidaySet) {
  let n = 0;
  for (const d of eachDate(start, end)) if (isWorkday(d, holidaySet)) n += 1;
  return n;
}

// 기간을 달 경계로 나눕니다. 예: 11/28~12/2 → [11/28~11/30, 12/1~12/2]
export function splitByMonth(start, end) {
  const pieces = [];
  let s = start;
  while (s <= end) {
    const monthEnd = lastDayOfMonth(s.slice(0, 7));
    const e = monthEnd < end ? monthEnd : end;
    pieces.push({ start: s, end: e });
    s = addDays(e, 1);
  }
  return pieces;
}

/**
 * 입력값을 검증하고 저장할 기록 조각들을 만듭니다.
 * 반환: { error } 또는 { pieces: [{ start, end, days }] }
 */
export function planLeave({ type, start, end }, holidaySet) {
  const def = LEAVE_TYPES[type];
  if (!def) return { error: '휴가 종류를 선택해 주세요.' };
  if (!isValidDate(start)) return { error: '시작일을 확인해 주세요.' };

  if (def.half) {
    if (!isWorkday(start, holidaySet)) return { error: '반차는 근무일에만 등록할 수 있어요. 주말이나 공휴일인지 확인해 주세요.' };
    return { pieces: [{ start, end: start, days: 0.5 }] };
  }

  if (!end) end = start;
  if (!isValidDate(end)) return { error: '종료일을 확인해 주세요.' };
  if (end < start) return { error: '종료일이 시작일보다 빠릅니다.' };
  if (diffDays(start, end) >= MAX_RANGE_DAYS) return { error: `한 번에 ${MAX_RANGE_DAYS}일까지만 등록할 수 있어요.` };

  const pieces = splitByMonth(start, end)
    .map((p) => ({ ...p, days: countWorkdays(p.start, p.end, holidaySet) }))
    .filter((p) => p.days > 0);
  if (pieces.length === 0) return { error: '선택한 기간에 근무일이 없습니다. 주말과 공휴일은 휴가 일수에서 빠집니다.' };
  return { pieces };
}

// 기존 기록과 날짜가 겹치는지 확인합니다. 같은 날 오전 반차와 오후 반차는 함께 쓸 수 있습니다.
export function findConflict(type, start, end, existing) {
  for (const r of existing) {
    if (r.end_date < start || r.start_date > end) continue;
    const bothHalf = LEAVE_TYPES[type]?.half && LEAVE_TYPES[r.type]?.half;
    if (bothHalf && r.type !== type && start === end && r.start_date === r.end_date && r.start_date === start) continue;
    return r;
  }
  return null;
}
