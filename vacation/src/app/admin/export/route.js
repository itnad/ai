import { isAdmin, formatPhone } from '@/lib/auth';
import { getSummaries, getRecords, getYearMatrix, remaining } from '@/lib/data';
import { currentYm, isValidYm, monthRange, formatDateTimeKo } from '@/lib/dates';
import { typeLabel } from '@/lib/leave';

function cell(v) {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// 엑셀에서 한글이 깨지지 않도록 UTF-8 BOM 을 붙인 CSV 로 내려줍니다.
function csv(filename, header, rows) {
  const body = [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
  return new Response(`﻿${body}`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Cache-Control': 'no-store',
    },
  });
}

export async function GET(request) {
  if (!(await isAdmin())) return new Response('관리자 로그인이 필요합니다.', { status: 401 });
  const { searchParams } = new URL(request.url);
  const kind = searchParams.get('kind');
  const ym = isValidYm(searchParams.get('ym')) ? searchParams.get('ym') : currentYm();

  if (kind === 'records') {
    const rows = await getRecords(monthRange(ym));
    return csv(`휴가상세_${ym}.csv`,
      ['이름', '부서', '종류', '시작일', '종료일', '일수', '메모', '등록자', '등록일시'],
      rows.map((r) => [r.name, r.department, typeLabel(r.type), r.start_date, r.end_date, r.days, r.memo,
        r.created_by === 'admin' ? '관리자' : '본인', formatDateTimeKo(r.created_at)]));
  }

  if (kind === 'year') {
    const y = Number(searchParams.get('year')) || Number(ym.slice(0, 4));
    const rows = await getYearMatrix(y);
    return csv(`연차현황_${y}.csv`,
      ['이름', '부서', '부여', ...Array.from({ length: 12 }, (_, i) => `${i + 1}월`), '연차 합계', '잔여', '기타휴가 합계'],
      rows.map((r) => [r.name, r.department, r.granted ?? '', ...r.months.map((m) => m || ''), r.used,
        r.granted == null ? '' : r.granted - r.used, r.other || '']));
  }

  const year = Number(ym.slice(0, 4));
  const rows = await getSummaries({ year, ym });
  const m = Number(ym.slice(5));
  return csv(`휴가현황_${ym}.csv`,
    ['이름', '부서', '전화번호', `${m}월 연차`, `${m}월 기타휴가`, `${year}년 연차 사용`, '부여', '잔여', '입력 완료', '완료 일시'],
    rows.map((s) => [s.name, s.department, formatPhone(s.phone), s.used_month, s.other_month, s.used_year,
      s.granted ?? '', remaining(s) ?? '', s.confirmed_at ? 'O' : 'X', formatDateTimeKo(s.confirmed_at)]));
}
