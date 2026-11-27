// 날짜는 모두 'YYYY-MM-DD' 문자열, 월은 'YYYY-MM' 문자열로 다룹니다.
// 계산은 UTC 기준으로 해서 서버 시간대와 무관하게 동작합니다.

export const TZ = 'Asia/Seoul';
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export function todayKST(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
}

export function currentYm(now = new Date()) {
  return todayKST(now).slice(0, 7);
}

function toUTC(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUTC(dt) {
  return dt.toISOString().slice(0, 10);
}

export function isValidDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return fromUTC(toUTC(s)) === s;
}

export function isValidYm(s) {
  return typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
}

export function lastDayOfMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  return fromUTC(new Date(Date.UTC(y, m, 0)));
}

export function monthRange(ym) {
  return { start: `${ym}-01`, end: lastDayOfMonth(ym) };
}

export function addMonths(ym, n) {
  const [y, m] = ym.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + n, 1));
  return fromUTC(dt).slice(0, 7);
}

export function addDays(s, n) {
  const dt = toUTC(s);
  dt.setUTCDate(dt.getUTCDate() + n);
  return fromUTC(dt);
}

export function dayOfWeek(s) {
  return toUTC(s).getUTCDay();
}

export function* eachDate(start, end) {
  for (let d = start; d <= end; d = addDays(d, 1)) yield d;
}

export function diffDays(start, end) {
  return Math.round((toUTC(end) - toUTC(start)) / 86400000);
}

export function formatYmKo(ym) {
  const [y, m] = ym.split('-').map(Number);
  return `${y}년 ${m}월`;
}

export function formatDateKo(s) {
  const [, m, d] = s.split('-').map(Number);
  return `${m}/${d}(${WEEKDAYS[dayOfWeek(s)]})`;
}

export function formatRangeKo(start, end) {
  return start === end ? formatDateKo(start) : `${formatDateKo(start)} ~ ${formatDateKo(end)}`;
}

// 11/23~24, 11/30~12/2, 11/27 처럼 짧게 표시
export function formatRangeShort(start, end) {
  const [, sm, sd] = start.split('-').map(Number);
  if (start === end) return `${sm}/${sd}`;
  const [, em, ed] = end.split('-').map(Number);
  return sm === em ? `${sm}/${sd}~${ed}` : `${sm}/${sd}~${em}/${ed}`;
}

export function formatDateTimeKo(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: TZ, month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(value));
}
