import Link from 'next/link';
import { headers } from 'next/headers';
import { requireAdmin, formatPhone } from '@/lib/auth';
import { getSummaries, getRecords, describeByEmployee } from '@/lib/data';
import { currentYm, isValidYm, monthRange, formatYmKo, formatDateTimeKo, todayKST } from '@/lib/dates';

const todayKSTOf = (value) => todayKST(new Date(value));
import { fmtDays } from '@/lib/url';
import Flash from '@/components/Flash';
import MonthNav from '@/components/MonthNav';
import CopyButton from '@/components/CopyButton';
import ConfirmButton from '@/components/ConfirmButton';
import { unconfirmAction } from '../actions';

function daysText(used, other) {
  const parts = [`연차 ${fmtDays(used)}일`];
  if (other) parts.push(`기타 ${fmtDays(other)}일`);
  return parts.join(' · ');
}

function isThisMonth(value, ym) {
  return todayKSTOf(value).slice(0, 7) === ym;
}

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
  const byRecent = sp.sort === 'recent';

  const all = await getSummaries({ year, ym });
  const usage = describeByEmployee(await getRecords(monthRange(ym)));
  const confirmed = all.filter((s) => s.confirmed_at);
  const pending = all.filter((s) => !s.confirmed_at);
  const filtered = pendingOnly ? pending : all;
  const rows = byRecent
    ? [...filtered].sort((x, y) => (y.last_entry_at ? new Date(y.last_entry_at) : 0) - (x.last_entry_at ? new Date(x.last_entry_at) : 0))
    : filtered;
  const monthCount = all.reduce((sum, s) => sum + s.month_count, 0);
  const totalUsed = all.reduce((sum, s) => sum + s.used_month, 0);
  const canConfirm = ym <= nowYm;

  const url = await siteUrl();
  const reminder = `[휴가 기록 안내]\n${formatYmKo(ym)} 휴가 사용 내역을 입력하고 '입력 완료'를 눌러 주세요.\n사용한 휴가가 없어도 입력 완료는 꼭 눌러 주세요.\n👉 ${url}`;
  const pendingNames = pending.map((s) => s.name).join(', ');
  const qs = (over = {}) => {
    const p = new URLSearchParams({ ym });
    const f = 'f' in over ? over.f : pendingOnly ? 'pending' : '';
    const sort = 'sort' in over ? over.sort : byRecent ? 'recent' : '';
    if (f) p.set('f', f);
    if (sort) p.set('sort', sort);
    return `/admin?${p.toString()}`;
  };
  const back = qs();

  return (
    <>
      <Flash searchParams={sp} />
      <MonthNav ym={ym} basePath="/admin" extra={qs().replace(`/admin?ym=${ym}`, '')} />

      <div className="stats">
        <div className="stat"><div className="label">재직</div><div className="value">{all.length}<small>명</small></div></div>
        <div className="stat accent"><div className="label">입력 완료</div><div className="value">{confirmed.length}<small>명</small></div></div>
        <div className="stat"><div className="label">{Number(ym.slice(5))}월 등록</div><div className="value">{monthCount}<small>건</small></div><div className="small muted">연차 {fmtDays(totalUsed)}일</div></div>
      </div>

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

      <div className="toolbar">
        <div className="toolbar-group">
          <div className="seg" role="group" aria-label="보기">
            <Link href={qs({ f: '' })} className={pendingOnly ? '' : 'on'}>전체</Link>
            <Link href={qs({ f: 'pending' })} className={pendingOnly ? 'on' : ''}>미입력만</Link>
          </div>
          <div className="seg" role="group" aria-label="정렬">
            <Link href={qs({ sort: '' })} className={byRecent ? '' : 'on'}>부서·이름순</Link>
            <Link href={qs({ sort: 'recent' })} className={byRecent ? 'on' : ''}>최근 입력순</Link>
          </div>
        </div>
        <div className="downloads">
          <span className="small muted">엑셀</span>
          <a className="btn secondary small" href={`/admin/export?kind=summary&ym=${ym}`}>월 현황</a>
          <a className="btn secondary small" href={`/admin/export?kind=records&ym=${ym}`}>월 상세</a>
          <a className="btn secondary small" href={`/admin/export?kind=year&year=${year}`}>{year}년</a>
        </div>
      </div>

      <div className="table-wrap cards-sm">
        <table>
          <thead>
            <tr>
              <th>이름</th>
              <th className="hide-md">부서</th>
              <th className="num">{Number(ym.slice(5))}월 등록</th>
              <th className="hide-sm">{Number(ym.slice(5))}월 사용 내역</th>
              <th className="num">{year}년 등록</th>
              <th>최근 입력·수정</th>
              <th>입력 완료</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={7} className="empty">{all.length === 0 ? '등록된 직원이 없어요. 직원 메뉴에서 등록해 주세요.' : '해당하는 직원이 없어요.'}</td></tr>
            )}
            {rows.map((s) => (
              <tr key={s.id}>
                <td className="nowrap c-name">
                  <Link href={`/admin/records?ym=${ym}&emp=${s.id}`}>{s.name}</Link>
                  <div className="small muted hide-sm">{formatPhone(s.phone)}</div>
                  {s.department && <div className="small muted show-md">{s.department}</div>}
                </td>
                <td className="hide-md nowrap">{s.department}</td>
                <td className="num nowrap c-line" data-label={`${Number(ym.slice(5))}월 등록`}>
                  <span className="v">
                    {s.month_count ? (
                      <><strong>{s.month_count}건</strong><span className="sub">{daysText(s.used_month, s.other_month)}</span></>
                    ) : <span className="muted">-</span>}
                  </span>
                </td>
                <td className={`small c-block ${usage.get(s.id) ? '' : 'is-empty'}`} data-label="사용 내역">{usage.get(s.id) ?? <span className="muted">-</span>}</td>
                <td className="num nowrap c-line" data-label={`${year}년 등록`}>
                  <span className="v">
                    {s.year_count ? (
                      <><strong>{s.year_count}건</strong><span className="sub">{daysText(s.used_year, s.other_year)}</span></>
                    ) : <span className="muted">-</span>}
                  </span>
                </td>
                <td className="nowrap c-line" data-label="최근 입력·수정">
                  <span className="v">
                    {s.last_entry_at ? (
                      <>
                        <span className={isThisMonth(s.last_entry_at, nowYm) ? '' : 'muted'}>{formatDateTimeKo(s.last_entry_at)}</span>
                        <span className="sub muted">{s.last_entry_by === 'admin' ? '관리자 입력' : '본인 입력'}</span>
                      </>
                    ) : <span className="muted">입력 없음</span>}
                  </span>
                </td>
                <td className="nowrap c-status">
                  {s.confirmed_at ? (
                    <form action={unconfirmAction}>
                      <span className="badge ok">완료</span>
                      <input type="hidden" name="employeeId" value={s.id} />
                      <input type="hidden" name="name" value={s.name} />
                      <input type="hidden" name="ym" value={ym} />
                      <input type="hidden" name="back" value={back} />
                      <ConfirmButton className="ghost small" message={`${s.name}님의 ${formatYmKo(ym)} 입력 완료를 취소할까요?\n직원이 다시 수정할 수 있게 됩니다.`}>취소</ConfirmButton>
                      <div className="small muted">{formatDateTimeKo(s.confirmed_at)}</div>
                    </form>
                  ) : canConfirm ? (
                    <span className="badge warn">미입력</span>
                  ) : (
                    <span className="badge">예정</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small muted" style={{ margin: 0 }}>
        건수는 직원이 휴가를 등록한 횟수이고, 일수의 연차는 반차를 포함합니다. 오늘 이후로 등록된 예정 휴가도 들어갑니다.
        병가·경조사·기타는 기타로 따로 셉니다. 최근 입력·수정은 휴가를 등록하거나 삭제한 마지막 시각이며, 이번 달이 아니면 흐리게 표시됩니다.
      </p>
    </>
  );
}
