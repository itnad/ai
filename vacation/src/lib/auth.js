import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { one } from './db.js';

const EMP_COOKIE = 'vac_emp';
const ADMIN_COOKIE = 'vac_admin';
const EMP_MAX_AGE = 60 * 60 * 24 * 30; // 30일
const ADMIN_MAX_AGE = 60 * 60 * 12; // 12시간

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error('SESSION_SECRET 환경변수(16자 이상)가 설정되지 않았습니다.');
  return s;
}

function hmac(data) {
  return crypto.createHmac('sha256', secret()).update(data).digest('base64url');
}

function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${hmac(body)}`;
}

function verify(token) {
  if (!token || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  if (!safeEqual(sig, hmac(body))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

async function setCookie(name, payload, maxAge) {
  const jar = await cookies();
  jar.set(name, sign({ ...payload, exp: Date.now() + maxAge * 1000 }), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  });
}

export function normalizePhone(value) {
  return String(value ?? '').replace(/\D/g, '');
}

export function formatPhone(digits) {
  if (/^\d{11}$/.test(digits)) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  if (/^\d{10}$/.test(digits)) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return digits;
}

// ── 직원 ─────────────────────────────────────────────
export async function loginEmployee(name, phone) {
  const n = String(name ?? '').trim();
  const p = normalizePhone(phone);
  if (!n || !p) return null;
  const emp = await one('select id, name from employees where active and phone = $1 and name = $2', [p, n]);
  if (!emp) return null;
  await setCookie(EMP_COOKIE, { id: emp.id }, EMP_MAX_AGE);
  return emp;
}

export async function currentEmployee() {
  const jar = await cookies();
  const payload = verify(jar.get(EMP_COOKIE)?.value);
  if (!payload) return null;
  return one('select id, name, department from employees where id = $1 and active', [payload.id]);
}

export async function requireEmployee() {
  const emp = await currentEmployee();
  if (!emp) redirect('/');
  return emp;
}

export async function logoutEmployee() {
  (await cookies()).delete(EMP_COOKIE);
}

// ── 관리자 ───────────────────────────────────────────
export async function loginAdmin(password) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) throw new Error('ADMIN_PASSWORD 환경변수가 설정되지 않았습니다.');
  if (!password || !safeEqual(password, expected)) return false;
  await setCookie(ADMIN_COOKIE, { admin: true }, ADMIN_MAX_AGE);
  return true;
}

export async function isAdmin() {
  const jar = await cookies();
  return Boolean(verify(jar.get(ADMIN_COOKIE)?.value)?.admin);
}

export async function requireAdmin() {
  if (!(await isAdmin())) redirect('/admin/login');
}

export async function logoutAdmin() {
  (await cookies()).delete(ADMIN_COOKIE);
}
