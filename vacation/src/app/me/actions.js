'use server';

import { redirect } from 'next/navigation';
import { requireEmployee } from '@/lib/auth';
import { addLeave, deleteLeave, confirmMonth } from '@/lib/data';
import { currentYm, formatYmKo, isValidYm } from '@/lib/dates';
import { withFlash, fmtDays } from '@/lib/url';

export async function addLeaveAction(formData) {
  const emp = await requireEmployee();
  const result = await addLeave({
    employeeId: emp.id,
    type: formData.get('type'),
    start: formData.get('start'),
    end: formData.get('end'),
    memo: formData.get('memo'),
  });
  const backYm = isValidYm(formData.get('ym')) ? formData.get('ym') : currentYm();
  if (result.error) redirect(withFlash(`/me?ym=${backYm}`, { err: result.error }));
  redirect(withFlash(`/me?ym=${result.ym}`, { msg: `${fmtDays(result.days)}일 휴가를 등록했어요.` }));
}

export async function deleteLeaveAction(formData) {
  const emp = await requireEmployee();
  const result = await deleteLeave({ recordId: Number(formData.get('id')), employeeId: emp.id });
  const ym = isValidYm(formData.get('ym')) ? formData.get('ym') : currentYm();
  redirect(withFlash(`/me?ym=${ym}`, result.error ? { err: result.error } : { msg: '기록을 삭제했어요.' }));
}

export async function confirmAction(formData) {
  const emp = await requireEmployee();
  const ym = formData.get('ym');
  if (!isValidYm(ym) || ym > currentYm()) redirect(withFlash('/me', { err: '지난 달이나 이번 달만 입력 완료할 수 있어요.' }));
  await confirmMonth(emp.id, ym);
  redirect(withFlash(`/me?ym=${ym}`, { msg: `${formatYmKo(ym)} 입력 완료! 감사합니다.` }));
}
