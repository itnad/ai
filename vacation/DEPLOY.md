# 배포 구성: Cloudflare Workers + Supabase

## 결정 (2026-11-27)

| 역할 | 서비스 | 요금제 |
|---|---|---|
| 화면과 서버 | Cloudflare Workers (Next.js 를 OpenNext 로 변환) | 무료 |
| DB 연결 중계 | Cloudflare Hyperdrive | 무료 |
| 데이터베이스 | Supabase Postgres | 무료 |
| 자동 배포, 정지 방지 | GitHub Actions | 무료 |

### 왜 이 조합인가
- **Vercel 무료 요금제 제외:** 약관상 개인적이고 비상업적인 용도만 허용합니다. 회사 업무 도구는 맞지 않습니다.
- **Netlify 무료 요금제 제외:** 월 크레딧을 다 쓰면 다음 달까지 사이트가 멈추고, 무료 요금제는 자동 충전이 안 됩니다. 월말에 직원이 몰려 입력할 때 멈추면 곤란합니다.
- **Supabase 단독 불가:** Supabase 는 DB 와 백엔드 기능만 제공하고 웹 화면 호스팅은 하지 않습니다.
- **Cloudflare 선택:** 무료 요금제를 업무용으로 쓸 수 있고, 지금 Next.js 코드를 거의 그대로 올릴 수 있습니다.
- **Hyperdrive 사용:** Workers 는 요청마다 DB 연결을 새로 맺어야 합니다. Hyperdrive 가 Supabase 까지의 연결 유지와 보안 연결 검증을 대신해서 응답이 빠르고 계산 시간 한도에도 유리합니다.

### 알고 있는 제약
- **Workers 무료 코드 크기:** 압축 후 3MB 까지입니다. 2026-11-27 기준 이 앱은 약 1.1MB 입니다. 기능을 크게 늘리면 `npx wrangler deploy --dry-run` 으로 다시 확인하세요.
- **Workers 무료 계산 시간:** 요청 하나당 CPU 10ms 입니다. DB 응답 대기 시간은 포함되지 않습니다. 운영 중 "Exceeded CPU" 오류가 보이면 Workers 유료 요금제(월 5달러)로 올리면 풀립니다.
- **Supabase 일시 정지:** 일주일간 DB 사용이 적으면 멈춥니다. `vacation-keepalive` 워크플로우가 주 2회 DB 를 조회해 막습니다.
- **GitHub 예약 실행 중지:** 공개 저장소에서 60일 동안 커밋이 없으면 GitHub 가 예약 워크플로우를 멈출 수 있습니다. Actions 탭에서 다시 켜면 됩니다.
- **DB 용량:** Supabase 무료는 500MB 입니다. 이 시스템은 50명이 몇 년 써도 수 MB 수준입니다.

---

## 처음 설정 (한 번만)

준비물: Supabase 계정, Cloudflare 계정, Node.js 20 이상이 설치된 PC.

### 1. Supabase
1. https://supabase.com 에서 새 프로젝트를 만듭니다. 지역은 **Northeast Asia (Seoul)** 를 고릅니다. DB 비밀번호는 따로 적어 둡니다.
2. 왼쪽 **SQL Editor** 에서 `db/schema.sql` 내용을 붙여넣고 실행합니다. 이어서 `db/holidays.sql` 도 실행합니다.
3. 상단 **Connect** 를 눌러 **Session pooler** 주소를 복사합니다. 포트가 `5432` 이고 호스트가 `...pooler.supabase.com` 인 주소입니다. `[YOUR-PASSWORD]` 는 DB 비밀번호로 바꿉니다.
   - Direct connection 주소(`db.프로젝트ID.supabase.co`)는 IPv6 전용이라 Hyperdrive 에서 쓰지 않습니다.

### 2. Cloudflare
PC 에서 이 저장소의 `vacation` 폴더로 이동해 실행합니다.

```bash
npm install
npx wrangler login
```

Hyperdrive 를 만듭니다. 조회 결과 캐시는 꺼야 휴가를 등록한 직후 목록에 바로 보입니다.

```bash
npx wrangler hyperdrive create vacation-db --caching-disabled --connection-string="1번에서 복사한 Session pooler 주소"
```

출력된 `id` 를 `wrangler.jsonc` 의 `REPLACE_WITH_HYPERDRIVE_ID` 자리에 넣고 커밋합니다. 이 id 는 비밀값이 아닙니다.

처음 배포하고 비밀값을 넣습니다.

```bash
npm run deploy
npx wrangler secret put SESSION_SECRET
npx wrangler secret put ADMIN_PASSWORD
```

- `SESSION_SECRET` 에는 32자 이상 무작위 문자열을 넣습니다. 예: `openssl rand -base64 32` 결과.
- `ADMIN_PASSWORD` 는 관리자 화면 비밀번호입니다.
- 배포가 끝나면 `https://vacation.<계정 서브도메인>.workers.dev` 주소가 나옵니다. 회사 도메인을 쓰려면 Cloudflare 대시보드의 Worker 설정에서 Custom Domain 을 추가합니다.

확인: 브라우저에서 `https://배포주소/api/health` 를 열어 `{"ok":true,...}` 가 나오면 DB 까지 연결된 것입니다.

### 3. GitHub 자동 배포와 정지 방지
저장소 **Settings → Secrets and variables → Actions** 에서 추가합니다.

| 종류 | 이름 | 값 |
|---|---|---|
| Secret | `CLOUDFLARE_API_TOKEN` | Cloudflare **My Profile → API Tokens → Create Token → "Edit Cloudflare Workers" 템플릿** 으로 만든 토큰 |
| Secret | `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 대시보드 Workers 화면 오른쪽의 Account ID |
| Variable | `VACATION_URL` | 배포 주소. 예: `https://vacation.xxx.workers.dev` |

- 이후 `vacation/` 이 main 에 반영되면 `vacation-deploy` 워크플로우가 테스트 후 자동 배포합니다.
- `vacation-keepalive` 워크플로우가 월·목 오전에 상태 확인 주소를 호출합니다. Actions 탭에서 수동 실행해 한 번 확인해 두세요.

---

## 일상 작업

| 하려는 일 | 명령 |
|---|---|
| 로컬 개발 (Node) | `.env.local` 작성 후 `npm run dev` |
| Cloudflare 와 같은 환경으로 로컬 실행 | 아래 참고 |
| 수동 배포 | `npm run deploy` |
| 운영 로그 보기 | `npx wrangler tail` |
| 비밀값 변경 | `npx wrangler secret put 이름` |
| DB 주소 변경 | `npx wrangler hyperdrive update <id> --connection-string="..."` |

Cloudflare 와 같은 런타임으로 로컬에서 확인하려면 `.dev.vars.example` 을 `.dev.vars` 로 복사하고 실행합니다. Hyperdrive 로컬 연결 주소에는 비밀번호가 꼭 들어 있어야 합니다.

```bash
CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE="postgresql://user:password@127.0.0.1:5432/vacation" npm run preview
```

## 문제가 생기면
- **사이트가 열리지만 로그인 후 오류:** `npx wrangler tail` 로 로그를 봅니다. `SESSION_SECRET` 이나 `ADMIN_PASSWORD` 가 빠졌는지 확인합니다.
- **`/api/health` 가 `ok:false`:** Supabase 대시보드에서 프로젝트가 Paused 인지 확인하고 Restore 합니다.
- **"Exceeded CPU" 오류:** Workers 무료 계산 시간 한도입니다. Cloudflare 대시보드에서 Workers Paid 로 올립니다.
