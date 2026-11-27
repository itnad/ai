'use server';

import { redirect } from 'next/navigation';
import { loginEmployee, logoutEmployee } from '@/lib/auth';
import { withFlash } from '@/lib/url';

export async function loginAction(formData) {
  const emp = await loginEmployee(formData.get('name'), formData.get('phone'));
  if (!emp) redirect(withFlash('/', { err: '이름과 전화번호가 등록된 정보와 다릅니다. 관리자에게 문의해 주세요.' }));
  redirect('/me');
}

export async function logoutAction() {
  await logoutEmployee();
  redirect('/');
}
