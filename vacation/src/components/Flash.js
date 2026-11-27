export default function Flash({ searchParams }) {
  const msg = searchParams?.msg;
  const err = searchParams?.err;
  if (!msg && !err) return null;
  return <div className={`flash ${err ? 'err' : 'ok'}`} role="status">{err || msg}</div>;
}
