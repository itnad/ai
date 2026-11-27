'use client';

import { useState } from 'react';
import { LEAVE_TYPES } from '@/lib/leave';

// 휴가 등록 폼. 반차를 고르면 종료일 입력을 숨깁니다.
export default function LeaveForm({ action, defaultDate, ym, employees = null, submitLabel = '등록' }) {
  const [type, setType] = useState('annual');
  const [start, setStart] = useState(defaultDate);
  const [end, setEnd] = useState(defaultDate);
  const half = LEAVE_TYPES[type]?.half;

  return (
    <form action={action} className="fields">
      {ym && <input type="hidden" name="ym" value={ym} />}
      {employees && (
        <div className="field-wide">
          <label htmlFor="employeeId">직원</label>
          <select id="employeeId" name="employeeId" required defaultValue="">
            <option value="" disabled>직원 선택</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>{e.department ? `${e.name} · ${e.department}` : e.name}</option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label htmlFor="type">종류</label>
        <select id="type" name="type" value={type} onChange={(e) => setType(e.target.value)}>
          {Object.entries(LEAVE_TYPES).map(([k, v]) => (
            <option key={k} value={k}>{v.label}{v.deduct ? '' : ' (연차 미차감)'}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="start">{half ? '날짜' : '시작일'}</label>
        <input
          id="start" name="start" type="date" required value={start}
          onChange={(e) => {
            setStart(e.target.value);
            if (!end || end < e.target.value) setEnd(e.target.value);
          }}
        />
      </div>
      {!half && (
        <div>
          <label htmlFor="end">종료일</label>
          <input id="end" name="end" type="date" required value={end} min={start} onChange={(e) => setEnd(e.target.value)} />
        </div>
      )}
      <div className="field-wide">
        <label htmlFor="memo">메모 (선택)</label>
        <input id="memo" name="memo" maxLength={200} placeholder="예: 가족 여행" />
      </div>
      <div className="field-wide">
        <button type="submit" className="block">{submitLabel}</button>
        <p className="small muted" style={{ margin: '6px 0 0' }}>
          주말과 공휴일은 자동으로 빠지고, 반차는 0.5일로 계산됩니다.
        </p>
      </div>
    </form>
  );
}
