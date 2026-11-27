import { requireEmployee } from '@/lib/auth';
import { getSummaries, getRecords } from '@/lib/data';
import { currentYm, todayKST, isValidYm, monthRange, formatYmKo, formatRangeKo, formatDateTimeKo } from '@/lib/dates';
import { typeLabel, LEAVE_TYPES } from '@/lib/leave';
import { fmtDays } from '@/lib/url';
import Flash from '@/components/Flash';
import MonthNav from '@/components/MonthNav';
import LeaveForm from '@/components/LeaveForm';
import ConfirmButton from '@/components/ConfirmButton';
import { logoutAction } from '../actions';
import { addLeaveAction, deleteLeaveAction, confirmAction } from './actions';

export default async function MyPage({ searchParams }) {
  const emp = await requireEmployee();
  const sp = await searchParams;
  const nowYm = currentYm();
  const ym = isValidYm(sp.ym) ? sp.ym : nowYm;
  const year = Number(ym.slice(0, 4));

  const [summary] = await getSummaries({ year, ym, employeeId: emp.id });
  const records = await getRecords({ employeeId: emp.id, ...monthRange(ym) });
  const yearRecords = await getRecords({ employeeId: emp.id, start: `${year}-01-01`, end: `${year}-12-31` });

  const confirmed = Boolean(summary?.confirmed_at);
  const isFuture = ym > nowYm;
  const defaultDate = ym === nowYm ? todayKST() : `${ym}-01`;

  return (
    <>
      <header className="topbar">
        <div className="container spread">
          <div>
            <h1>휴가 기록</h1>
            <div className="small muted">{emp.name}님{emp.department ? ` · ${emp.department}` : ''}</div>
          </div>
          <form action={logoutAction}><button className="secondary small">로그아웃</button></form>
        </div>
      </header>

      <main className="container stack">
        <Flash searchParams={sp} />

        <section>
          <div className="stats">
            <div className="stat accent"><div className="label">올해 연차</div><div className="value">{fmtDays(summary?.used_year ?? 0)}<small>일</small></div></div>
            <div className="stat"><div className="label">{Number(ym.slice(5))}월 연차</div><div className="value">{fmtDays(summary?.used_month ?? 0)}<small>일</small></div></div>
            <div className="stat"><div className="label">기타 휴가</div><div className="value">{fmtDays(summary?.other_year ?? 0)}<small>일</small></div></div>
          </div>
          <p className="small muted" style={{ margin: '6px 0 0' }}>
            {year}년 1월 1일부터의 합계이고, 연차는 반차(0.5일)를 포함합니다{summary?.planned_year ? `. 앞으로 쓸 예정인 ${fmtDays(summary.planned_year)}일도 포함돼 있어요` : ''}. 병가·경조사·기타는 기타 휴가로 따로 셉니다.
          </p>
        </section>

        <MonthNav ym={ym} basePath="/me" />

        {confirmed ? (
          <div className="banner ok">✓ {formatYmKo(ym)} 입력 완료 ({formatDateTimeKo(summary.confirmed_at)}). 수정이 필요하면 관리자에게 요청해 주세요.</div>
        ) : isFuture ? (
          <div className="banner info">예정된 휴가를 미리 등록할 수 있어요. 입력 완료는 해당 달이 되면 할 수 있습니다.</div>
        ) : (
          <div className="banner warn">
            <div className="spread">
              <span>{formatYmKo(ym)} 휴가를 모두 입력했다면 입력 완료를 눌러 주세요. 사용한 휴가가 없어도 눌러야 합니다.</span>
              <form action={confirmAction}>
                <input type="hidden" name="ym" value={ym} />
                <ConfirmButton message={`${formatYmKo(ym)} 휴가 입력을 완료할까요?\n완료 후에는 직접 수정할 수 없어요.`}>입력 완료</ConfirmButton>
              </form>
            </div>
          </div>
        )}

        <section className="card">
          <div className="spread">
            <h2>{formatYmKo(ym)} 내역</h2>
            <span className="small muted">연차 {fmtDays(summary?.used_month ?? 0)}일{summary?.other_month ? ` · 기타 ${fmtDays(summary.other_month)}일` : ''}</span>
          </div>
          {records.length === 0 ? (
            <p className="empty">등록된 휴가가 없어요.</p>
          ) : (
            <ul className="list">
              {records.map((r) => (
                <li key={r.id}>
                  <div>
                    <div><strong>{formatRangeKo(r.start_date, r.end_date)}</strong></div>
                    <div className="small muted">
                      <span className={`badge ${LEAVE_TYPES[r.type]?.deduct ? 'primary' : ''}`}>{typeLabel(r.type)}</span>{' '}
                      {fmtDays(r.days)}일{r.memo ? ` · ${r.memo}` : ''}{r.created_by === 'admin' ? ' · 관리자 등록' : ''}
                    </div>
                  </div>
                  {!confirmed && (
                    <form action={deleteLeaveAction}>
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="ym" value={ym} />
                      <ConfirmButton className="danger small" message="이 기록을 삭제할까요?">삭제</ConfirmButton>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {!confirmed && (
          <section className="card">
            <h2>휴가 등록</h2>
            <LeaveForm key={ym} action={addLeaveAction} defaultDate={defaultDate} ym={ym} />
          </section>
        )}

        <details className="card">
          <summary>{year}년 전체 내역 ({yearRecords.length}건)</summary>
          {yearRecords.length === 0 ? (
            <p className="empty">올해 등록된 휴가가 없어요.</p>
          ) : (
            <ul className="list">
              {yearRecords.map((r) => (
                <li key={r.id}>
                  <span>{formatRangeKo(r.start_date, r.end_date)}</span>
                  <span className="small muted">{typeLabel(r.type)} · {fmtDays(r.days)}일</span>
                </li>
              ))}
            </ul>
          )}
        </details>
      </main>
    </>
  );
}
