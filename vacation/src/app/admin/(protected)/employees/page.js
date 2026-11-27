import Link from 'next/link';
import { requireAdmin, formatPhone } from '@/lib/auth';
import { query } from '@/lib/db';
import { currentYm } from '@/lib/dates';
import { fmtDays } from '@/lib/url';
import Flash from '@/components/Flash';
import { addEmployeeAction, updateEmployeeAction, bulkImportAction, bulkGrantAction } from '../../actions';

export default async function AdminEmployees({ searchParams }) {
  await requireAdmin();
  const sp = await searchParams;
  const nowYear = Number(currentYm().slice(0, 4));
  const y = Number(sp.year);
  const year = Number.isInteger(y) && y >= 2000 && y <= 2100 ? y : nowYear;

  const employees = await query(
    `select e.*, g.days as granted
       from employees e left join leave_grants g on g.employee_id = e.id and g.year = $1
      order by e.active desc, e.department, e.name`,
    [year],
  );
  const activeCount = employees.filter((e) => e.active).length;
  const missing = employees.filter((e) => e.active && e.granted == null).length;

  return (
    <>
      <Flash searchParams={sp} />

      <div className="spread">
        <h2>직원 {activeCount}명</h2>
        <div className="row">
          <span className="small muted">연차 부여 기준 연도</span>
          <Link className="btn secondary small" href={`/admin/employees?year=${year - 1}`}>◀</Link>
          <strong>{year}년</strong>
          <Link className="btn secondary small" href={`/admin/employees?year=${year + 1}`}>▶</Link>
        </div>
      </div>

      {missing > 0 && (
        <section className="card">
          <h3>{year}년 부여 일수 미설정 {missing}명</h3>
          <div className="row">
            <form action={bulkGrantAction} className="row">
              <input type="hidden" name="year" value={year} />
              <input type="hidden" name="mode" value="fixed" />
              <input name="days" inputMode="decimal" placeholder="15" style={{ width: 80 }} required />
              <button className="secondary small">일 일괄 설정</button>
            </form>
            <form action={bulkGrantAction}>
              <input type="hidden" name="year" value={year} />
              <input type="hidden" name="mode" value="copy" />
              <button className="secondary small">{year - 1}년 일수 그대로 복사</button>
            </form>
          </div>
          <p className="small muted" style={{ margin: 0 }}>이미 설정된 직원은 바뀌지 않습니다. 개인별 일수는 아래 표에서 고치세요.</p>
        </section>
      )}

      <div className="table-wrap">
        <div className="emp-row head">
          <span>이름</span><span>전화번호</span><span>부서</span><span>{year}년 부여</span><span>재직</span><span></span>
        </div>
        {employees.length === 0 && <p className="empty">등록된 직원이 없어요. 아래에서 추가하세요.</p>}
        {employees.map((e) => (
          <form key={e.id} action={updateEmployeeAction} className="emp-row">
            <input type="hidden" name="id" value={e.id} />
            <input type="hidden" name="year" value={year} />
            <input name="name" defaultValue={e.name} aria-label="이름" required />
            <input name="phone" defaultValue={formatPhone(e.phone)} aria-label="전화번호" inputMode="tel" required />
            <input name="department" defaultValue={e.department} aria-label="부서" placeholder="부서" />
            <input name="days" defaultValue={e.granted == null ? '' : fmtDays(e.granted)} aria-label="부여 일수" inputMode="decimal" placeholder="미설정" />
            <label className="chk"><input type="checkbox" name="active" defaultChecked={e.active} /> 재직</label>
            <button className="secondary small">저장</button>
          </form>
        ))}
      </div>

      <section className="card">
        <h2>직원 추가</h2>
        <form action={addEmployeeAction} className="fields">
          <input type="hidden" name="year" value={year} />
          <div><label htmlFor="n-name">이름</label><input id="n-name" name="name" required /></div>
          <div><label htmlFor="n-phone">전화번호</label><input id="n-phone" name="phone" inputMode="tel" required placeholder="010-1234-5678" /></div>
          <div><label htmlFor="n-dept">부서</label><input id="n-dept" name="department" /></div>
          <div><label htmlFor="n-days">{year}년 부여 일수</label><input id="n-days" name="days" inputMode="decimal" placeholder="15" /></div>
          <div className="field-wide"><button>추가</button></div>
        </form>
      </section>

      <section className="card">
        <h2>엑셀에서 한꺼번에 등록</h2>
        <p className="small muted" style={{ margin: 0 }}>
          엑셀에서 이름, 전화번호, 부서, 부여일수 네 칸을 복사해 붙여넣으세요. 쉼표로 구분해도 됩니다.
          같은 전화번호가 이미 있으면 정보를 갱신합니다.
        </p>
        <form action={bulkImportAction} className="stack">
          <input type="hidden" name="year" value={year} />
          <textarea name="rows" placeholder={'홍길동, 010-1234-5678, 영업팀, 15\n김철수, 010-2345-6789, 개발팀, 16'} required />
          <button>{year}년 기준으로 일괄 등록</button>
        </form>
      </section>
    </>
  );
}
