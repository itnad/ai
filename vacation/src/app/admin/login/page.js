import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isAdmin } from '@/lib/auth';
import Flash from '@/components/Flash';
import { adminLoginAction } from '../actions';

export default async function AdminLoginPage({ searchParams }) {
  if (await isAdmin()) redirect('/admin');
  const sp = await searchParams;
  return (
    <main className="container">
      <div className="login stack">
        <h1>관리자 로그인</h1>
        <Flash searchParams={sp} />
        <form action={adminLoginAction} className="card">
          <div>
            <label htmlFor="password">비밀번호</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required />
          </div>
          <button type="submit" className="block">로그인</button>
        </form>
        <p className="small" style={{ textAlign: 'center' }}><Link href="/" className="muted">직원 로그인으로</Link></p>
      </div>
    </main>
  );
}
