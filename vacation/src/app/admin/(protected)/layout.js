import { requireAdmin } from '@/lib/auth';
import AdminNav from '@/components/AdminNav';
import { adminLogoutAction } from '../actions';

export default async function AdminLayout({ children }) {
  await requireAdmin();
  return (
    <>
      <header className="topbar">
        <div className="container wide spread">
          <div className="row" style={{ gap: 16 }}>
            <h1>휴가 관리</h1>
            <AdminNav />
          </div>
          <form action={adminLogoutAction}><button className="secondary small">로그아웃</button></form>
        </div>
      </header>
      <main className="container wide stack">{children}</main>
    </>
  );
}
