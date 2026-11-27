# vacation

## 서비스 개요
직원이 휴가 사용 내역을 직접 입력하고, 관리자가 월별 현황을 한눈에 보고 엑셀로 내려받는 사내 휴가 기록 시스템.
매달 카톡으로 개별 확인하던 작업을 대체한다. 승인 절차 없이 기록만 한다.

## 업무 규칙
- 보유(부여) 연차와 잔여 일수는 관리하지 않는다. 직원별로 언제 며칠 썼는지와 회계연도(1월 1일 ~ 12월 31일) 누적 사용일만 집계한다.
- 종류: 연차, 오전 반차, 오후 반차(0.5일)는 '연차 사용'으로 집계. 병가, 경조사, 기타는 '기타 휴가'로 따로 집계.
- 휴가 일수는 주말과 `holidays` 테이블의 공휴일을 빼고 계산한다 (`src/lib/leave.js`).
- 달을 넘기는 기간은 월별 기록으로 나눠 저장한다. 한 기록은 항상 한 달 안에 있다 (DB check 제약).
- 같은 날짜 중복 등록 불가. 단, 같은 날 오전 반차 + 오후 반차는 허용.
- 직원이 월말에 "입력 완료"를 누르면 그 달은 직원이 수정할 수 없다. 관리자가 취소하면 다시 수정 가능.
- 관리자는 잠긴 달에도 대리 등록/삭제 가능.
- 휴가 등록 건수는 기록 행 수가 아니라 등록 횟수. 달을 넘긴 휴가는 같은 트랜잭션(같은 created_at)으로 저장되므로 `count(distinct created_at)` 으로 1건으로 센다.
- 휴가 기록을 추가·삭제할 때마다 `employees.last_entry_at`, `last_entry_by` 를 갱신한다 (`touchEmployee`).

## 기술 스택
- Next.js 16 App Router + Server Actions (JavaScript, TypeScript 미사용)
- PostgreSQL (`pg` 드라이버). ORM 없음, SQL 직접 작성.
- 인증: 직원은 이름 + 전화번호, 관리자는 `ADMIN_PASSWORD`. HMAC 서명 쿠키 (`src/lib/auth.js`).

## 배포 구성 (결정됨, 바꾸려면 사용자와 먼저 상의)
- **Cloudflare Workers 무료** 에 OpenNext(`@opennextjs/cloudflare`)로 배포. 설정은 `wrangler.jsonc`, `open-next.config.ts`.
- **Supabase Postgres 무료** 를 **Cloudflare Hyperdrive** 를 거쳐 접속 (바인딩 이름 `HYPERDRIVE`, 캐시 끔).
- Vercel(무료는 비상업 전용)과 Netlify(크레딧 소진 시 정지)는 검토 후 제외. 근거와 절차는 `DEPLOY.md`.
- 자동 배포: `.github/workflows/vacation-deploy.yml`. Supabase 정지 방지: `.github/workflows/vacation-keepalive.yml` 이 `/api/health` 호출.

## Cloudflare 런타임 주의
- `src/lib/db.js` 는 Workers 에서 요청마다 새 풀(`maxUses: 1`)을 만들고 Hyperdrive 연결 문자열을 씁니다. Node 에서는 `DATABASE_URL` 전역 풀. 전역 DB 클라이언트를 Workers 에서 재사용하지 말 것.
- 무료 Workers 한도: 압축 후 코드 3MB, 요청당 CPU 10ms. 무거운 라이브러리 추가 전 `npx wrangler deploy --dry-run` 으로 크기 확인.
- Node 전용 API(fs, child_process 등)를 서버 코드에서 쓰지 말 것.

## 주요 파일
- `db/schema.sql` : 테이블 정의 (여러 번 실행해도 안전)
- `db/holidays.sql` : 공휴일 기본값
- `src/lib/leave.js` : 휴가 종류, 일수 계산, 겹침 판정 (순수 함수, 단위 테스트 대상)
- `src/lib/data.js` : 조회/저장 쿼리
- `src/app/me/` : 직원 화면
- `src/app/admin/(protected)/` : 관리자 화면 (월별 현황, 휴가 기록, 직원, 공휴일)
- `src/app/admin/export/route.js` : 엑셀(CSV, UTF-8 BOM) 다운로드
- `src/app/api/health/route.js` : 상태 확인 (DB 조회 포함)
- `DEPLOY.md` : 배포 결정 기록과 설정 절차

## 주의사항
- 스키마를 바꾸면 `db/schema.sql` 을 idempotent 하게 유지하고 README 에 이행 SQL 을 적는다.
- `npm test` (휴가 계산 단위 테스트) 와 `npm run cf:build` 가 통과해야 한다.
- 화면 문구는 한국어, 직원 화면은 모바일 우선.
