import Link from 'next/link';
import { headers } from 'next/headers';
import { requireAdmin, formatPhone } from '@/lib/auth';
import { getSummaries, remaining } from '@/lib/data';
import { currentYm, isValidYm, formatYmKo, formatDateTimeKo } from '@/lib/dates';
import { fmtDays } from '@/lib/url';
import Flash from '@/components/Flash';
import MonthNav from '@/components/MonthNav';
import CopyButton from '@/components/CopyButton';
import ConfirmButton from '@/components/ConfirmButton';
import { unconfirmAction } from '../actions';

async function siteUrl() {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? '';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

export default async function AdminOverview({ searchParams }) {
  await requireAdmin();
  const sp = await searchParams;
  const nowYm = currentYm();
  const ym = isValidYm(sp.ym) ? sp.ym : nowYm;
  const year = Number(ym.slice(0, 4));
  const pendingOnly = sp.f === 'pending';

  const all = await getSummaries({ year, ym });
  const confirmed = all.filter((s) => s.confirmed_at);
  const pending = all.filter((s) => !s.confirmed_at);
  const noGrant = all.filter((s) => s.granted == null);
  const rows = pendingOnly ? pending : all;
  const totalUsed = all.reduce((sum, s) => sum + s.used_month, 0);
  const canConfirm = ym <= nowYm;

  const url = await siteUrl();
  const reminder = `[휴가 기록 안내]\n${formatYmKo(ym)} 휴가 사용 내역을 입력하고 '입력 완료'를 눌러 주세요.\n사용한 휴가가 없어도 입력 완료는 꼭 눌러 주세요.\n👉 ${url}`;
  const pendingNames = pending.map((s) => s.name).join(', ');
  const back = `/admin?ym=${ym}${pendingOnly ? '&f=pending' : ''}`;

  return (
    <>
      <Flash searchParams={sp} />
      <MonthNav ym={ym} basePath="/admin" extra={pendingOnly ? '&f=pending' : ''} />

      <div className="stats">
        <div className="stat"><div className="label">재직 인원</div><div className="value">{all.length}<small>명</small></div></div>
        <div className="stat accent"><div className="label">입력 완료</div><div className="value">{confirmed.length}<small>명</small></div></div>
        <div className="stat"><div className="label">이번 달 연차 사용</div><div className="value">{fmtDays(totalUsed)}<small>일</small></div></div>
      </div>

      {noGrant.length > 0 && (
        <div className="banner warn">
          {year}년 연차 부여 일수가 없는 직원이 {noGrant.length}명 있어요. 잔여 일수를 계산하려면{' '}
          <Link href={`/admin/employees?year=${year}`}>직원·연차</Link>에서 설정해 주세요.
        </div>
      )}

      {canConfirm && (
        <section className="card">
          <div className="spread">
            <h2>미입력 {pending.length}명</h2>
            <div className="row">
              <CopyButton text={pendingNames}>명단 복사</CopyButton>
              <CopyButton text={reminder}>카톡 안내문 복사</CopyButton>
            </div>
          </div>
          <p className="small muted" style={{ margin: 0 }}>
            {pending.length === 0 ? '모든 직원이 입력을 완료했어요. 🎉' : pendingNames}
          </p>
        </section>
      )}

      <div className="spread">
        <div className="row">
          <Link href={`/admin?ym=${ym}`} className={`btn small ${pendingOnly ? 'secondary' : ''}`}>전체</Link>
          <Link href={`/admin?ym=${ym}&f=pending`} className={`btn small ${pendingOnly ? '' : 'secondary'}`}>미입력만</Link>
        </div>
        <div className="row">
          <a className="btn secondary small" href={`/admin/export?kind=summary&ym=${ym}`}>월 현황 엑셀</a>
          <a className="btn secondary small" href={`/admin/export?kind=records&ym=${ym}`}>월 상세 엑셀</a>
          <a className="btn secondary small" href={`/admin/export?kind=year&year=${year}`}>{year}년 연간 엑셀</a>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>이름</th>
              <th className="hide-sm">부서</th>
              <th className="num">{Number(ym.slice(5))}월 연차</th>
              <th className="num hide-sm">{Number(ym.slice(5))}월 기타</th>
              <th className="num">올해 사용</th>
              <th className="num">부여</th>
              <th className="num">잔여</th>
              <th>입력</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={8} className="empty">{all.length === 0 ? '등록된 직원이 없어요. 직원·연차 메뉴에서 등록해 주세요.' : '해당하는 직원이 없어요.'}</td></tr>
            )}
            {rows.map((s) => {
              const left = remaining(s);
              return (
                <tr key={s.id}>
                  <td className="nowrap">
                    <Link href={`/admin/records?ym=${ym}&emp=${s.id}`}>{s.name}</Link>
                    <div className="small muted hide-sm">{formatPhone(s.phone)}</div>
                  </td>
                  <td className="hide-sm">{s.department}</td>
                  <td className="num">{s.used_month ? fmtDays(s.used_month) : '-'}</td>
                  <td className="num hide-sm">{s.other_month ? fmtDays(s.other_month) : '-'}</td>
                  <td className="num">{fmtDays(s.used_year)}</td>
                  <td className="num">{s.granted == null ? <span className="badge warn">미설정</span> : fmtDays(s.granted)}</td>
                  <td className={`num ${left != null && left < 0 ? 'neg' : ''}`}>{left == null ? '-' : fmtDays(left)}</td>
                  <td className="nowrap">
                    {s.confirmed_at ? (
                      <form action={unconfirmAction} className="row" style={{ gap: 4 }}>
                        <span className="badge ok" title={formatDateTimeKo(s.confirmed_at)}>완료</span>
                        <input type="hidden" name="employeeId" value={s.id} />
                        <input type="hidden" name="name" value={s.name} />
                        <input type="hidden" name="ym" value={ym} />
                        <input type="hidden" name="back" value={back} />
                        <ConfirmButton className="ghost small" message={`${s.name}님의 ${formatYmKo(ym)} 입력 완료를 취소할까요?\n직원이 다시 수정할 수 있게 됩니다.`}>취소</ConfirmButton>
                      </form>
                    ) : canConfirm ? (
                      <span className="badge warn">미입력</span>
                    ) : (
                      <span className="badge">예정</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
