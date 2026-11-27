-- 휴가 기록 시스템 스키마. 여러 번 실행해도 안전합니다.

create table if not exists employees (
  id          serial primary key,
  name        text not null,
  phone       text not null unique,          -- 숫자만 저장 (예: 01012345678)
  department  text not null default '',
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- 회계연도(1월 1일 ~ 12월 31일)별 연차 부여 일수
create table if not exists leave_grants (
  employee_id int not null references employees(id) on delete cascade,
  year        int not null,
  days        numeric(4,1) not null check (days >= 0),
  primary key (employee_id, year)
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
