import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentEmployee } from '@/lib/auth';
import Flash from '@/components/Flash';
import { loginAction } from './actions';

export default async function LoginPage({ searchParams }) {
  if (await currentEmployee()) redirect('/me');
  const sp = await searchParams;
  return (
    <main className="container">
      <div className="login stack">
        <div>
          <h1>휴가 기록</h1>
          <p className="muted" style={{ margin: '6px 0 0' }}>이름과 전화번호로 로그인하세요.</p>
        </div>
        <Flash searchParams={sp} />
        <form action={loginAction} className="card">
          <div>
            <label htmlFor="name">이름</label>
            <input id="name" name="name" autoComplete="name" required placeholder="홍길동" />
          </div>
          <div>
            <label htmlFor="phone">전화번호</label>
            <input id="phone" name="phone" type="tel" inputMode="numeric" autoComplete="tel" required placeholder="010-1234-5678" />
          </div>
          <button type="submit" className="block">로그인</button>
        </form>
        <p className="small muted" style={{ textAlign: 'center' }}>
          <Link href="/admin/login" className="muted">관리자 로그인</Link>
        </p>
      </div>
    </main>
  );
}
