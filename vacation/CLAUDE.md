# vacation

## 서비스 개요
직원이 휴가 사용 내역을 직접 입력하고, 관리자가 월별 현황을 한눈에 보고 엑셀로 내려받는 사내 휴가 기록 시스템.
매달 카톡으로 개별 확인하던 작업을 대체한다. 승인 절차 없이 기록만 한다.

## 업무 규칙
- 연차는 회계연도(1월 1일 ~ 12월 31일) 기준. 연도별 부여 일수는 `leave_grants` 에 관리자가 입력한다.
- 종류: 연차, 오전 반차, 오후 반차(0.5일)는 연차에서 차감. 병가, 경조사, 기타는 차감하지 않고 따로 집계.
- 휴가 일수는 주말과 `holidays` 테이블의 공휴일을 빼고 계산한다 (`src/lib/leave.js`).
- 달을 넘기는 기간은 월별 기록으로 나눠 저장한다. 한 기록은 항상 한 달 안에 있다 (DB check 제약).
- 같은 날짜 중복 등록 불가. 단, 같은 날 오전 반차 + 오후 반차는 허용.
- 직원이 월말에 "입력 완료"를 누르면 그 달은 직원이 수정할 수 없다. 관리자가 취소하면 다시 수정 가능.
- 관리자는 잠긴 달에도 대리 등록/삭제 가능.

## 기술 스택
- Next.js 16 App Router + Server Actions (JavaScript, TypeScript 미사용)
- PostgreSQL (`pg` 드라이버, 운영은 Supabase 권장). ORM 없음, SQL 직접 작성.
- 인증: 직원은 이름 + 전화번호, 관리자는 `ADMIN_PASSWORD`. HMAC 서명 쿠키 (`src/lib/auth.js`).
- 배포: Vercel

## 주요 파일
- `db/schema.sql` : 테이블 정의 (여러 번 실행해도 안전)
- `db/holidays.sql` : 공휴일 기본값
- `src/lib/leave.js` : 휴가 종류, 일수 계산, 겹침 판정 (순수 함수, 단위 테스트 대상)
- `src/lib/data.js` : 조회/저장 쿼리
- `src/app/me/` : 직원 화면
- `src/app/admin/(protected)/` : 관리자 화면 (월별 현황, 휴가 기록, 직원·연차, 공휴일)
- `src/app/admin/export/route.js` : 엑셀(CSV, UTF-8 BOM) 다운로드

## 주의사항
- 스키마를 바꾸면 `db/schema.sql` 을 idempotent 하게 유지하고 README 에 이행 SQL 을 적는다.
- `npm test` (휴가 계산 단위 테스트) 와 `npm run build` 가 통과해야 한다.
- 화면 문구는 한국어, 직원 화면은 모바일 우선.
