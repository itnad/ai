'use server';

import { redirect } from 'next/navigation';
import { loginAdmin, logoutAdmin, requireAdmin, normalizePhone } from '@/lib/auth';
import { addLeave, deleteLeave, unconfirmMonth } from '@/lib/data';
import { query, transaction } from '@/lib/db';
import { currentYm, isValidYm, isValidDate, formatYmKo } from '@/lib/dates';
import { withFlash, fmtDays } from '@/lib/url';

function back(formData, fallback) {
  const to = String(formData.get('back') || fallback);
  return to.startsWith('/admin') ? to : fallback;
}

function parseYear(v) {
  const y = Number(v);
  return Number.isInteger(y) && y >= 2000 && y <= 2100 ? y : Number(currentYm().slice(0, 4));
}

function parseDays(v) {
  if (v === null || v === undefined || String(v).trim() === '') return null;
  const n = Number(String(v).trim());
  if (!Number.isFinite(n) || n < 0 || n > 99 || Math.round(n * 2) !== n * 2) return NaN;
  return n;
}

function validPhone(p) {
  return /^0\d{8,10}$/.test(p);
}

// ── 로그인 ───────────────────────────────────────────
export async function adminLoginAction(formData) {
  const ok = await loginAdmin(String(formData.get('password') ?? ''));
  if (!ok) redirect(withFlash('/admin/login', { err: '비밀번호가 올바르지 않습니다.' }));
  redirect('/admin');
}

export async function adminLogoutAction() {
  await logoutAdmin();
  redirect('/admin/login');
}

// ── 월말 확인 ────────────────────────────────────────
export async function unconfirmAction(formData) {
  await requireAdmin();
  const ym = formData.get('ym');
  if (isValidYm(ym)) await unconfirmMonth(Number(formData.get('employeeId')), ym);
  redirect(withFlash(back(formData, '/admin'), { msg: `${formData.get('name')}님의 ${formatYmKo(ym)} 입력 완료를 취소했어요. 직원이 다시 수정할 수 있습니다.` }));
}

// ── 휴가 기록 ────────────────────────────────────────
export async function adminAddLeaveAction(formData) {
  await requireAdmin();
  const ym = isValidYm(formData.get('ym')) ? formData.get('ym') : currentYm();
  const result = await addLeave({
    employeeId: Number(formData.get('employeeId')),
    type: formData.get('type'),
    start: formData.get('start'),
    end: formData.get('end'),
    memo: formData.get('memo'),
    asAdmin: true,
  });
  if (result.error) redirect(withFlash(`/admin/records?ym=${ym}`, { err: result.error }));
  redirect(withFlash(`/admin/records?ym=${result.ym}`, { msg: `${fmtDays(result.days)}일 휴가를 등록했어요.` }));
}

export async function adminDeleteLeaveAction(formData) {
  await requireAdmin();
  const result = await deleteLeave({ recordId: Number(formData.get('id')), asAdmin: true });
  redirect(withFlash(back(formData, '/admin/records'), result.error ? { err: result.error } : { msg: '기록을 삭제했어요.' }));
}

// ── 직원 ─────────────────────────────────────────────
async function setGrant(q, employeeId, year, days) {
  if (days === null) return;
  await q(
    `insert into leave_grants (employee_id, year, days) values ($1, $2, $3)
     on conflict (employee_id, year) do update set days = excluded.days`,
    [employeeId, year, days],
  );
}

export async function addEmployeeAction(formData) {
  await requireAdmin();
  const year = parseYear(formData.get('year'));
  const to = `/admin/employees?year=${year}`;
  const name = String(formData.get('name') ?? '').trim();
  const phone = normalizePhone(formData.get('phone'));
  const department = String(formData.get('department') ?? '').trim();
  const days = parseDays(formData.get('days'));
  if (!name) redirect(withFlash(to, { err: '이름을 입력해 주세요.' }));
  if (!validPhone(phone)) redirect(withFlash(to, { err: '전화번호 형식을 확인해 주세요. 예: 010-1234-5678' }));
  if (Number.isNaN(days)) redirect(withFlash(to, { err: '부여 일수는 0.5일 단위 숫자로 입력해 주세요.' }));

  const dup = await query('select name from employees where phone = $1', [phone]);
  if (dup.length) redirect(withFlash(to, { err: `이미 같은 전화번호로 등록된 직원(${dup[0].name})이 있어요.` }));

  await transaction(async (tx) => {
    const [emp] = await tx.query('insert into employees (name, phone, department) values ($1, $2, $3) returning id', [name, phone, department]);
    await setGrant(tx.query, emp.id, year, days);
  });
  redirect(withFlash(to, { msg: `${name}님을 등록했어요.` }));
}

export async function updateEmployeeAction(formData) {
  await requireAdmin();
  const year = parseYear(formData.get('year'));
  const to = `/admin/employees?year=${year}`;
  const id = Number(formData.get('id'));
  const name = String(formData.get('name') ?? '').trim();
  const phone = normalizePhone(formData.get('phone'));
  const department = String(formData.get('department') ?? '').trim();
  const days = parseDays(formData.get('days'));
  const active = formData.get('active') === 'on';
  if (!name) redirect(withFlash(to, { err: '이름을 입력해 주세요.' }));
  if (!validPhone(phone)) redirect(withFlash(to, { err: `${name}: 전화번호 형식을 확인해 주세요.` }));
  if (Number.isNaN(days)) redirect(withFlash(to, { err: `${name}: 부여 일수는 0.5일 단위 숫자로 입력해 주세요.` }));

  const dup = await query('select name from employees where phone = $1 and id <> $2', [phone, id]);
  if (dup.length) redirect(withFlash(to, { err: `같은 전화번호를 쓰는 다른 직원(${dup[0].name})이 있어요.` }));

  await transaction(async (tx) => {
    await tx.query('update employees set name = $2, phone = $3, department = $4, active = $5 where id = $1', [id, name, phone, department, active]);
    if (days === null) await tx.query('delete from leave_grants where employee_id = $1 and year = $2', [id, year]);
    else await setGrant(tx.query, id, year, days);
  });
  redirect(withFlash(to, { msg: `${name}님 정보를 저장했어요.` }));
}

// 한 줄에 한 명: 이름, 전화번호, 부서, 부여일수 (부서와 부여일수는 생략 가능)
export async function bulkImportAction(formData) {
  await requireAdmin();
  const year = parseYear(formData.get('year'));
  const to = `/admin/employees?year=${year}`;
  const lines = String(formData.get('rows') ?? '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const errors = [];
  const rows = [];
  lines.forEach((line, i) => {
    const cols = line.split(/\t|,/).map((c) => c.trim());
    const [name, rawPhone, department = '', rawDays = ''] = cols;
    if (i === 0 && name === '이름') return; // 머리글 줄 건너뛰기
    const phone = normalizePhone(rawPhone);
    const days = parseDays(rawDays);
    if (!name || !validPhone(phone)) errors.push(`${i + 1}번째 줄: 이름 또는 전화번호 확인`);
    else if (Number.isNaN(days)) errors.push(`${i + 1}번째 줄: 부여일수 확인`);
    else rows.push({ name, phone, department, days });
  });
  if (errors.length) redirect(withFlash(to, { err: `저장하지 않았어요. ${errors.slice(0, 5).join(' / ')}` }));
  if (rows.length === 0) redirect(withFlash(to, { err: '입력된 직원이 없습니다.' }));

  let added = 0;
  let updated = 0;
  await transaction(async (tx) => {
    for (const r of rows) {
      const [emp] = await tx.query(
        `insert into employees (name, phone, department) values ($1, $2, $3)
         on conflict (phone) do update set name = excluded.name, department = excluded.department, active = true
         returning id, (xmax = 0) as inserted`,
        [r.name, r.phone, r.department],
      );
      if (emp.inserted) added += 1; else updated += 1;
      await setGrant(tx.query, emp.id, year, r.days);
    }
  });
  redirect(withFlash(to, { msg: `새로 등록 ${added}명, 기존 정보 갱신 ${updated}명.` }));
}

export async function bulkGrantAction(formData) {
  await requireAdmin();
  const year = parseYear(formData.get('year'));
  const to = `/admin/employees?year=${year}`;
  const mode = formData.get('mode');
  if (mode === 'copy') {
    const rows = await query(
      `insert into leave_grants (employee_id, year, days)
       select g.employee_id, $1, g.days from leave_grants g join employees e on e.id = g.employee_id
        where g.year = $1 - 1 and e.active
       on conflict do nothing returning employee_id`,
      [year],
    );
    redirect(withFlash(to, { msg: `${year - 1}년 부여 일수를 ${rows.length}명에게 복사했어요. 이미 설정된 직원은 그대로 둡니다.` }));
  }
  const days = parseDays(formData.get('days'));
  if (days === null || Number.isNaN(days)) redirect(withFlash(to, { err: '부여 일수를 0.5일 단위 숫자로 입력해 주세요.' }));
  const rows = await query(
    `insert into leave_grants (employee_id, year, days)
     select id, $1, $2 from employees where active
     on conflict do nothing returning employee_id`,
    [year, days],
  );
  redirect(withFlash(to, { msg: `부여 일수가 없던 ${rows.length}명에게 ${fmtDays(days)}일을 설정했어요.` }));
}

// ── 공휴일 ───────────────────────────────────────────
export async function addHolidayAction(formData) {
  await requireAdmin();
  const date = formData.get('date');
  const name = String(formData.get('name') ?? '').trim();
  const to = `/admin/holidays?year=${String(date).slice(0, 4)}`;
  if (!isValidDate(date) || !name) redirect(withFlash('/admin/holidays', { err: '날짜와 이름을 입력해 주세요.' }));
  await query('insert into holidays (date, name) values ($1, $2) on conflict (date) do update set name = excluded.name', [date, name]);
  redirect(withFlash(to, { msg: `${date} ${name}을(를) 저장했어요. 이미 등록된 휴가 일수는 자동으로 바뀌지 않습니다.` }));
}

export async function deleteHolidayAction(formData) {
  await requireAdmin();
  const date = formData.get('date');
  if (isValidDate(date)) await query('delete from holidays where date = $1', [date]);
  redirect(withFlash(`/admin/holidays?year=${String(date).slice(0, 4)}`, { msg: '공휴일을 삭제했어요.' }));
}
