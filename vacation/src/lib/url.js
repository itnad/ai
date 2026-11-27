// 서버 액션 후 결과 메시지를 쿼리스트링으로 전달합니다.
export function withFlash(path, { msg, err } = {}) {
  const [base, qs = ''] = path.split('?');
  const params = new URLSearchParams(qs);
  if (msg) params.set('msg', msg);
  if (err) params.set('err', err);
  const s = params.toString();
  return s ? `${base}?${s}` : base;
}

export function fmtDays(n) {
  if (n == null) return '-';
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
