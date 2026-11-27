import { requireAdmin } from '@/lib/auth';
import AdminNav from '@/components/AdminNav';
import { adminLogoutAction } from '../actions';

export default async function AdminLayout({ children }) {
  await requireAdmin();
  return (
    <>
      <header className="topbar">
        <div className="container wide admin-head">
          <h1>휴가 관리</h1>
          <AdminNav />
          <form action={adminLogoutAction}><button className="secondary small">로그아웃</button></form>
        </div>
      </header>
      <main className="container wide stack">{children}</main>
    </>
  );
}
