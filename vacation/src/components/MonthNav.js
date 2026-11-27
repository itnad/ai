import Link from 'next/link';
import { addMonths, formatYmKo } from '@/lib/dates';

export default function MonthNav({ ym, basePath, extra = '' }) {
  return (
    <div className="monthnav">
      <Link href={`${basePath}?ym=${addMonths(ym, -1)}${extra}`} aria-label="이전 달">◀</Link>
      <h2>{formatYmKo(ym)}</h2>
      <Link href={`${basePath}?ym=${addMonths(ym, 1)}${extra}`} aria-label="다음 달">▶</Link>
    </div>
  );
}
