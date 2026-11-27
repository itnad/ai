-- 휴가 기록 시스템 스키마. 여러 번 실행해도 안전합니다.

create table if not exists employees (
  id          serial primary key,
  name        text not null,
  phone       text not null unique,          -- 숫자만 저장 (예: 01012345678)
  department  text not null default '',
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- 휴가 기록. 한 기록은 항상 한 달 안에 들어가도록 서버에서 월 단위로 나눠 저장합니다.
create table if not exists leave_records (
  id          serial primary key,
  employee_id int not null references employees(id) on delete cascade,
  type        text not null check (type in ('annual','am_half','pm_half','sick','family','other')),
  start_date  date not null,
  end_date    date not null,
  days        numeric(4,1) not null check (days > 0),
  memo        text not null default '',
  created_by  text not null default 'self' check (created_by in ('self','admin')),
  created_at  timestamptz not null default now(),
  check (end_date >= start_date),
  check (date_trunc('month', start_date) = date_trunc('month', end_date))
);
create index if not exists leave_records_emp_date on leave_records (employee_id, start_date);
create index if not exists leave_records_date on leave_records (start_date);

-- 직원별 월말 "입력 완료" 확인
create table if not exists monthly_confirmations (
  employee_id  int not null references employees(id) on delete cascade,
  ym           char(7) not null,                 -- 'YYYY-MM'
  confirmed_at timestamptz not null default now(),
  primary key (employee_id, ym)
);

-- 공휴일. 휴가 일수 계산 시 주말과 함께 제외합니다.
create table if not exists holidays (
  date date primary key,
  name text not null
);

-- 2026-11-27 추가: 직원별 마지막 휴가 입력·삭제 시각과 입력자('self' 또는 'admin')
alter table employees add column if not exists last_entry_at timestamptz;
alter table employees add column if not exists last_entry_by text;
update employees e
   set last_entry_at = r.max_at, last_entry_by = r.by
  from (select distinct on (employee_id) employee_id, created_at as max_at, created_by as by
          from leave_records order by employee_id, created_at desc) r
 where e.id = r.employee_id and e.last_entry_at is null;
