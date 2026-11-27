import { one } from '@/lib/db';

// 상태 확인용. GitHub Actions 가 주기적으로 호출해 Supabase 무료 프로젝트가 일시 정지되지 않게 합니다.
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const row = await one('select count(*)::int as employees from employees');
    return Response.json({ ok: true, employees: row.employees }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ ok: false }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
