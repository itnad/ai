import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { getRecords } from '@/lib/data';
import { query } from '@/lib/db';
import { currentYm, todayKST, isValidYm, monthRange, formatYmKo, formatRangeKo, formatDateTimeKo } from '@/lib/dates';
import { typeLabel, LEAVE_TYPES } from '@/lib/leave';
import { fmtDays } from '@/lib/url';
import Flash from '@/components/Flash';
import MonthNav from '@/components/MonthNav';
import LeaveForm from '@/components/LeaveForm';
import ConfirmButton from '@/components/ConfirmButton';
import { adminAddLeaveAction, adminDeleteLeaveAction } from '../../actions';

export default async function AdminRecords({ searchParams }) {
  await requireAdmin();
  const sp = await searchParams;
  const nowYm = currentYm();
  const ym = isValidYm(sp.ym) ? sp.ym : nowYm;
  const empId = Number(sp.emp) || null;

  const employees = await query('select id, name, department from employees where active order by department, name');
  const records = await getRecords({ employeeId: empId, ...monthRange(ym) });
  const selected = empId ? employees.find((e) => e.id === empId) : null;
  const extra = empId ? `&emp=${empId}` : '';
  const back = `/admin/records?ym=${ym}${extra}`;

  return (
    <>
      <Flash searchParams={sp} />
      <MonthNav ym={ym} basePath="/admin/records" extra={extra} />
      {selected && (
        <div className="row">
          <span className="badge primary">{selected.name}님 기록만 보는 중</span>
          <Link href={`/admin/records?ym=${ym}`} className="small">전체 보기</Link>
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>이름</th>
              <th className="hide-sm">부서</th>
              <th>기간</th>
              <th>종류</th>
              <th className="num">일수</th>
              <th className="hide-sm">메모</th>
              <th className="hide-sm">등록</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 && <tr><td colSpan={8} className="empty">{formatYmKo(ym)}에 등록된 휴가가 없어요.</td></tr>}
            {records.map((r) => (
              <tr key={r.id}>
                <td className="nowrap"><Link href={`/admin/records?ym=${ym}&emp=${r.employee_id}`}>{r.name}</Link></td>
                <td className="hide-sm">{r.department}</td>
                <td className="nowrap">{formatRangeKo(r.start_date, r.end_date)}</td>
                <td><span className={`badge ${LEAVE_TYPES[r.type]?.deduct ? 'primary' : ''}`}>{typeLabel(r.type)}</span></td>
                <td className="num">{fmtDays(r.days)}</td>
                <td className="hide-sm">{r.memo}</td>
                <td className="hide-sm small muted nowrap">{r.created_by === 'admin' ? '관리자' : '본인'} · {formatDateTimeKo(r.created_at)}</td>
                <td>
                  <form action={adminDeleteLeaveAction}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="back" value={back} />
                    <ConfirmButton className="danger small" message={`${r.name}님의 ${formatRangeKo(r.start_date, r.end_date)} ${typeLabel(r.type)} 기록을 삭제할까요?`}>삭제</ConfirmButton>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="card" style={{ maxWidth: 640 }}>
        <h2>관리자 대리 등록</h2>
        <p className="small muted" style={{ margin: 0 }}>기존 엑셀 자료를 옮기거나 직원 대신 등록할 때 씁니다. 입력 완료된 달에도 등록됩니다.</p>
        <LeaveForm key={ym} action={adminAddLeaveAction} defaultDate={ym === nowYm ? todayKST() : `${ym}-01`} ym={ym} employees={employees} />
      </section>
    </>
  );
}
