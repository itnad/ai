import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { query } from '@/lib/db';
import { currentYm, formatDateKo } from '@/lib/dates';
import Flash from '@/components/Flash';
import ConfirmButton from '@/components/ConfirmButton';
import { addHolidayAction, deleteHolidayAction } from '../../actions';

export default async function AdminHolidays({ searchParams }) {
  await requireAdmin();
  const sp = await searchParams;
  const nowYear = Number(currentYm().slice(0, 4));
  const y = Number(sp.year);
  const year = Number.isInteger(y) && y >= 2000 && y <= 2100 ? y : nowYear;
  const holidays = await query(
    'select date, name from holidays where date between make_date($1,1,1) and make_date($1,12,31) order by date',
    [year],
  );

  return (
    <>
      <Flash searchParams={sp} />
      <div className="spread">
        <h2>{year}년 공휴일 {holidays.length}일</h2>
        <div className="row">
          <Link className="btn secondary small" href={`/admin/holidays?year=${year - 1}`}>◀</Link>
          <Link className="btn secondary small" href={`/admin/holidays?year=${year + 1}`}>▶</Link>
        </div>
      </div>
      <p className="small muted" style={{ margin: 0 }}>
        평일에 있는 공휴일만 등록하면 됩니다. 주말은 자동으로 빠집니다. 임시공휴일이 발표되면 여기에 추가하세요.
      </p>

      <section className="card" style={{ maxWidth: 560 }}>
        {holidays.length === 0 ? (
          <p className="empty">등록된 공휴일이 없어요.</p>
        ) : (
          <ul className="list">
            {holidays.map((h) => (
              <li key={h.date}>
                <span><strong>{formatDateKo(h.date)}</strong> <span className="muted">{h.name}</span></span>
                <form action={deleteHolidayAction}>
                  <input type="hidden" name="date" value={h.date} />
                  <ConfirmButton className="ghost small" message={`${h.date} ${h.name}을(를) 삭제할까요?`}>삭제</ConfirmButton>
                </form>
              </li>
            ))}
          </ul>
        )}
        <form action={addHolidayAction} className="fields">
          <div><label htmlFor="h-date">날짜</label><input id="h-date" name="date" type="date" required defaultValue={`${year}-01-01`} /></div>
          <div><label htmlFor="h-name">이름</label><input id="h-name" name="name" required placeholder="임시공휴일" /></div>
          <div className="field-wide"><button className="secondary">추가</button></div>
        </form>
      </section>
    </>
  );
}
