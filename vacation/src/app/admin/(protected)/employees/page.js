import { requireAdmin, formatPhone } from '@/lib/auth';
import { query } from '@/lib/db';
import Flash from '@/components/Flash';
import { addEmployeeAction, updateEmployeeAction, bulkImportAction } from '../../actions';

export default async function AdminEmployees({ searchParams }) {
  await requireAdmin();
  const sp = await searchParams;
  const employees = await query('select * from employees order by active desc, department, name');
  const activeCount = employees.filter((e) => e.active).length;

  return (
    <>
      <Flash searchParams={sp} />
      <h2>직원 {activeCount}명</h2>

      <div className="table-wrap">
        <div className="emp-row head">
          <span>이름</span><span>전화번호</span><span>부서</span><span>재직</span><span></span>
        </div>
        {employees.length === 0 && <p className="empty">등록된 직원이 없어요. 아래에서 추가하세요.</p>}
        {employees.map((e) => (
          <form key={e.id} action={updateEmployeeAction} className="emp-row">
            <input type="hidden" name="id" value={e.id} />
            <input className="e-name" name="name" defaultValue={e.name} aria-label="이름" required />
            <input className="e-phone" name="phone" defaultValue={formatPhone(e.phone)} aria-label="전화번호" inputMode="tel" required />
            <input className="e-dept" name="department" defaultValue={e.department} aria-label="부서" placeholder="부서" />
            <label className="chk"><input type="checkbox" name="active" defaultChecked={e.active} /> 재직</label>
            <button className="secondary small e-save">저장</button>
          </form>
        ))}
      </div>
      <p className="small muted" style={{ margin: 0 }}>퇴사자는 재직 체크를 풀고 저장하세요. 기록은 남고 현황표와 로그인에서만 빠집니다.</p>

      <section className="card">
        <h2>직원 추가</h2>
        <form action={addEmployeeAction} className="fields">
          <div><label htmlFor="n-name">이름</label><input id="n-name" name="name" required /></div>
          <div><label htmlFor="n-phone">전화번호</label><input id="n-phone" name="phone" inputMode="tel" required placeholder="010-1234-5678" /></div>
          <div><label htmlFor="n-dept">부서</label><input id="n-dept" name="department" /></div>
          <div className="field-wide"><button>추가</button></div>
        </form>
      </section>

      <section className="card">
        <h2>엑셀에서 한꺼번에 등록</h2>
        <p className="small muted" style={{ margin: 0 }}>
          엑셀에서 이름, 전화번호, 부서 세 칸을 복사해 붙여넣으세요. 쉼표로 구분해도 됩니다.
          같은 전화번호가 이미 있으면 이름과 부서를 갱신합니다.
        </p>
        <form action={bulkImportAction} className="stack">
          <textarea name="rows" placeholder={'홍길동, 010-1234-5678, 영업팀\n김철수, 010-2345-6789, 개발팀'} required />
          <button>일괄 등록</button>
        </form>
      </section>
    </>
  );
}
