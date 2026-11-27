import { query, one, transaction } from './db.js';
import { DEDUCT_TYPES, planLeave, findConflict, typeLabel } from './leave.js';
import { formatRangeKo, monthRange, formatYmKo } from './dates.js';

export async function getHolidaySet(start, end, q = query) {
  const rows = await q('select date from holidays where date between $1 and $2', [start, end]);
  return new Set(rows.map((r) => r.date));
}

/**
 * 직원별 요약. year 의 부여/사용 합계와 ym 의 월간 사용, 월말 확인 여부를 돌려줍니다.
 * employeeId 를 주면 그 직원 한 명만, 아니면 재직 중인 전 직원.
 */
export async function getSummaries({ year, ym, employeeId = null }) {
  return query(
    `select e.id, e.name, e.department, e.phone,
            g.days as granted,
            coalesce(sum(r.days) filter (where r.type = any($3)), 0) as used_year,
            coalesce(sum(r.days) filter (where r.type <> all($3)), 0) as other_year,
            coalesce(sum(r.days) filter (where r.type = any($3) and to_char(r.start_date, 'YYYY-MM') = $2), 0) as used_month,
            coalesce(sum(r.days) filter (where r.type <> all($3) and to_char(r.start_date, 'YYYY-MM') = $2), 0) as other_month,
            c.confirmed_at
       from employees e
       left join leave_grants g on g.employee_id = e.id and g.year = $1
       left join leave_records r on r.employee_id = e.id
             and r.start_date >= make_date($1, 1, 1) and r.start_date <= make_date($1, 12, 31)
       left join monthly_confirmations c on c.employee_id = e.id and c.ym = $2
      where e.active and ($4::int is null or e.id = $4)
      group by e.id, g.days, c.confirmed_at
      order by e.department, e.name`,
    [year, ym, DEDUCT_TYPES, employeeId],
  );
}

export function remaining(summary) {
  return summary.granted == null ? null : summary.granted - summary.used_year;
}

export async function getRecords({ employeeId = null, start, end }) {
  return query(
    `select r.*, e.name, e.department
       from leave_records r join employees e on e.id = r.employee_id
      where r.start_date between $1 and $2 and ($3::int is null or r.employee_id = $3)
      order by r.start_date, e.name`,
    [start, end, employeeId],
  );
}

export async function isConfirmed(employeeId, ym) {
  return Boolean(await one('select 1 from monthly_confirmations where employee_id = $1 and ym = $2', [employeeId, ym]));
}

/**
 * 휴가를 등록합니다. 달을 넘기는 기간은 달별로 나눠 저장합니다.
 * asAdmin 이면 월말 확인으로 잠긴 달에도 등록할 수 있습니다.
 */
export async function addLeave({ employeeId, type, start, end, memo = '', asAdmin = false }) {
  return transaction(async (tx) => {
    // 같은 직원의 동시 등록으로 중복이 생기지 않게 직원 행을 잠급니다.
    const emp = await tx.query('select id from employees where id = $1 and active for update', [employeeId]);
    if (emp.length === 0) return { error: '직원 정보를 찾을 수 없습니다.' };

    const rangeEnd = end && end > start ? end : start;
    const holidays = await getHolidaySet(start, rangeEnd, tx.query);
    const plan = planLeave({ type, start, end }, holidays);
    if (plan.error) return plan;

    const first = plan.pieces[0].start;
    const last = plan.pieces[plan.pieces.length - 1].end;

    if (!asAdmin) {
      const months = [...new Set(plan.pieces.map((p) => p.start.slice(0, 7)))];
      const locked = await tx.query(
        'select ym from monthly_confirmations where employee_id = $1 and ym = any($2)',
        [employeeId, months],
      );
      if (locked.length > 0) {
        return { error: `${formatYmKo(locked[0].ym.trim())}은 이미 입력 완료한 달이라 수정할 수 없어요. 관리자에게 확인 취소를 요청해 주세요.` };
      }
    }

    const existing = await tx.query(
      'select type, start_date, end_date from leave_records where employee_id = $1 and start_date <= $3 and end_date >= $2',
      [employeeId, first, last],
    );
    for (const p of plan.pieces) {
      const c = findConflict(type, p.start, p.end, existing);
      if (c) return { error: `${formatRangeKo(c.start_date, c.end_date)}에 이미 ${typeLabel(c.type)} 기록이 있어요.` };
    }

    const cleanMemo = String(memo ?? '').trim().slice(0, 200);
    for (const p of plan.pieces) {
      await tx.query(
        `insert into leave_records (employee_id, type, start_date, end_date, days, memo, created_by)
         values ($1, $2, $3, $4, $5, $6, $7)`,
        [employeeId, type, p.start, p.end, p.days, cleanMemo, asAdmin ? 'admin' : 'self'],
      );
    }
    const days = plan.pieces.reduce((s, p) => s + p.days, 0);
    return { ok: true, days, ym: first.slice(0, 7) };
  });
}

export async function deleteLeave({ recordId, employeeId = null, asAdmin = false }) {
  const rec = await one('select * from leave_records where id = $1', [recordId]);
  if (!rec || (!asAdmin && rec.employee_id !== employeeId)) return { error: '기록을 찾을 수 없습니다.' };
  if (!asAdmin && (await isConfirmed(rec.employee_id, rec.start_date.slice(0, 7)))) {
    return { error: '이미 입력 완료한 달의 기록은 삭제할 수 없어요. 관리자에게 확인 취소를 요청해 주세요.' };
  }
  await query('delete from leave_records where id = $1', [recordId]);
  return { ok: true, ym: rec.start_date.slice(0, 7) };
}

export async function confirmMonth(employeeId, ym) {
  await query(
    'insert into monthly_confirmations (employee_id, ym) values ($1, $2) on conflict do nothing',
    [employeeId, ym],
  );
}

export async function unconfirmMonth(employeeId, ym) {
  await query('delete from monthly_confirmations where employee_id = $1 and ym = $2', [employeeId, ym]);
}

// 연간 표: 직원 × 1~12월 연차 차감 사용일수
export async function getYearMatrix(year) {
  const rows = await query(
    `select e.id, e.name, e.department, g.days as granted,
            extract(month from r.start_date)::int as month,
            coalesce(sum(r.days) filter (where r.type = any($2)), 0) as used,
            coalesce(sum(r.days) filter (where r.type <> all($2)), 0) as other
       from employees e
       left join leave_grants g on g.employee_id = e.id and g.year = $1
       left join leave_records r on r.employee_id = e.id
             and r.start_date >= make_date($1, 1, 1) and r.start_date <= make_date($1, 12, 31)
      where e.active
      group by e.id, g.days, month
      order by e.department, e.name`,
    [year, DEDUCT_TYPES],
  );
  const byId = new Map();
  for (const r of rows) {
    if (!byId.has(r.id)) {
      byId.set(r.id, { id: r.id, name: r.name, department: r.department, granted: r.granted, months: Array(12).fill(0), used: 0, other: 0 });
    }
    const row = byId.get(r.id);
    if (r.month) {
      row.months[r.month - 1] = r.used;
      row.used += r.used;
      row.other += r.other;
    }
  }
  return [...byId.values()];
}

export { monthRange };
