'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS = [
  { href: '/admin', label: '월별 현황' },
  { href: '/admin/records', label: '휴가 기록' },
  { href: '/admin/employees', label: '직원' },
  { href: '/admin/holidays', label: '공휴일' },
];

export default function AdminNav() {
  const path = usePathname();
  return (
    <nav className="nav">
      {ITEMS.map((it) => {
        const active = it.href === '/admin' ? path === '/admin' : path.startsWith(it.href);
        return <Link key={it.href} href={it.href} className={active ? 'active' : ''}>{it.label}</Link>;
      })}
    </nav>
  );
}
