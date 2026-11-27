# newai 명세

작성일: 2026-11-27 · 버전: 0.1(구현 전) · 근거: `design.md`

## 1. 코드 구조 (`newai/`)

```
newai/
  package.json            bin: newai, harness
  src/
    core/      paths.ts normPath.ts config.ts version.ts atomicFile.ts env-detect.ts lang.ts
    db/        schema.sql db.ts
    decision/  engine.ts card.ts timer.ts scorer.ts fakeScorer.ts
    safety/    policy.ts classify-bash.ts path-guard.ts git-env.ts hooks.ts
    runner/    runner.ts completion-check.ts tail-question.ts resume-planner.ts cost.ts
    queue/     queue.ts scheduler.ts worktree.ts projects.ts
    pipeline/  pipeline.ts verdict.ts
    release/   release.ts
    servers/   server-check.ts
    learn/     rules.ts history.ts
    notify/    desktop.ts telegram.ts slack.ts
    bridge/    install.ts hook.ts
    server/    http.ts api.ts ws.ts auth.ts lifecycle.ts
    tui/       app.ts render.ts keys.ts keytest.ts
    web/       (Preact) chat/ dashboard/
    cli/       newai.ts harness.ts check-web.ts clean.ts autostart.ts
  templates/   policy.yaml config.yaml pipelines/default.yaml servers.yaml
  tests/       unit/ integration/ tty/ web/ e2e/ soak/
  docs/
```

## 2. 데이터 폴더 (`NEWAI_HOME`)

```
config.yaml  policy.yaml  servers.yaml  secrets.yaml(권한 600)
pipelines/*.yaml   newai.db   server.port   server.token
logs/  reports/  screenshots/  _projects/  worktrees/  judge-sandbox/
```

처음 실행 시 `templates/`에서 복사한다. 이미 있으면 덮어쓰지 않는다.

## 3. 설정 파일

### 3.1 `config.yaml`
```yaml
language: ko                 # 기본 보고 언어. 사용자가 요청에 명시하면 그것이 우선
server: { port: 47321, host: 127.0.0.1 }
decision:
  timeout: 1m                # 20s | 1m | 5m | 10m | 20m
  deliver: hold              # hold(콜백 대기) | resume(중단 후 이어가기)
scoring:
  model: claude-haiku-5-5
  weights: { goal: 30, reversible: 20, scope: 15, env: 15, rules: 10, cost: 10 }
runner:
  model: claude-opus-5-5
  max_concurrent: 2
  wall_clock_limit: 90m      # 작업 1회 실행 상한
  budget_per_run_usd: 5
  budget_per_day_usd: 50
  completion_followups: 2
  tail_question_max: 3
resume:
  usage_limit: { max_per_day: 6, grace: 2m }
  network: { base: 30s, max: 10m, max_attempts: 6, max_total: 2h }
  restart: { delay: 30s, max_attempts: 3 }
  wall_clock: { max_attempts: 3 }
projects: { commit_default: false, history_items: 5 }
notify: { desktop: true, telegram: false, slack: false }
web_check: { allow_hosts: [localhost, 127.0.0.1, "::1"] }
```

### 3.2 `policy.yaml`
판정 단계: `allow`(즉시 허용) · `wait`(대기 필수, 마감 시 점수 1순위가 자동 선택 가능하면 진행) · `human`(사람만) · `deny`(거부).
위에서부터 처음 맞는 규칙을 쓴다. 자세한 근거는 `security-policy.md`.
```yaml
version: 1
protected_paths:              # human
  - ${INSTALL_DIR}
  - ${NEWAI_HOME}/policy.yaml
  - ${NEWAI_HOME}/config.yaml
  - ${NEWAI_HOME}/secrets.yaml
secret_files: [".env", ".env.*", "*.pem", "*.key", "id_rsa*", "id_ed25519*", "credentials*.json", "*.pfx", ".npmrc", ".pypirc"]
bash:
  - { level: deny,  match: '\bgit\s+push\b',                     reason: push는 릴리스 단계에서 사람만 }
  - { level: deny,  match: '\b(gh\s+pr\s+(create|merge)|gh\s+release|npm\s+publish|vercel\s+(--prod|deploy)|firebase\s+deploy|kubectl\s+apply|terraform\s+apply)\b', reason: 배포·공개 }
  - { level: human, match: '\bgit\s+(reset\s+--hard|clean\s+-[a-z]*f|filter-branch|filter-repo|rebase|branch\s+-D|reflog\s+expire|update-ref\s+-d)\b', reason: 이력 파괴 }
  - { level: human, match: '\brm\s+-[a-z]*r[a-z]*f?\b.*(/|\*|~|\.\.)|\bfind\b.*-delete|\bRemove-Item\b.*-Recurse', reason: 대량 삭제 }
  - { level: human, match: '(?i)\b(drop\s+(table|database|schema)|truncate\s+table|dropdb|migrate\s+reset|db\s+reset)\b', reason: DB 파괴 }
  - { level: human, match: '(?i)\bdelete\s+from\s+\w+\s*;?\s*$', reason: 조건 없는 DELETE }
  - { level: human, match: '\b(setx|reg\s+add|schtasks|crontab|systemctl\s+--user\s+enable)\b', reason: 시스템·전역 설정 }
  - { level: wait,  match: '\b(curl|wget|Invoke-WebRequest|iwr|ssh|scp|rsync|ftp|nc)\b', reason: 외부 통신 }
  - { level: wait,  match: '\b(npm|pnpm|yarn)\s+(install|add|i)\b|\bpip\s+install\b', reason: 패키지 내려받기 }
  - { level: allow, match: '.*' }
files:
  write_outside_workdir: wait
  read_secret_file: human
  write_protected: human
web:
  local_hosts: allow          # localhost, 127.0.0.1, ::1
  other: wait                 # WebFetch, WebSearch, check-web 외부 주소
auto_select_exclude: [push, deploy, publish, release, "배포", "푸시", "공개"]   # 선택지 문구에 있으면 자동 선택 제외
```

### 3.3 `pipelines/default.yaml`
```yaml
name: default
stages:
  - { id: requirements, model: claude-opus-5-5, output: docs/requirements.md, prompt: requirements.md.tmpl }
  - { id: design,       model: claude-opus-5-5, input: [docs/requirements.md], output: docs/design.md, prompt: design.md.tmpl }
  - { id: spec,         model: claude-opus-5-5, input: [docs/design.md], output: docs/spec.md, prompt: spec.md.tmpl }
  - { id: implement,    model: claude-opus-5-5, input: [docs/spec.md], output: docs/implementation.md, prompt: implement.md.tmpl }
  - { id: verify,       model: claude-sonnet-5-5, input: [docs/spec.md, docs/implementation.md], output: docs/verification.md, prompt: verify.md.tmpl,
      verdict: { pattern: '^판정:\s*(통과|실패)', fix_stage: implement, max_retries: 2 } }
  - { id: commit,       when: commit_enabled, action: git-commit }
```
단계 추가·삭제는 이 목록을 고치면 된다. `model`이 없으면 `runner.model`.

### 3.4 `servers.yaml`
```yaml
servers:
  - name: api-prod
    url: https://api.example.com/health
    expect: { status: 200, contains: '"ok"', max_ms: 2000 }
    log_command: ssh deploy@api.example.com 'tail -n 200 /var/log/app.log'
    log_command_allowed: true      # 사용자가 등록한 명령이므로 대기 없이 실행 허용
    schedule: "*/30 * * * *"
```

### 3.5 `secrets.yaml`
`telegram: {bot_token, chat_ids: []}`, `slack: {app_token, bot_token, channel}`. 로그·보고서·에이전트 환경에 절대 넣지 않는다.

## 4. 데이터베이스 (`newai.db`, WAL)

| 표 | 주요 열 |
|---|---|
| projects | id, name, path(normPath), kind(new/existing), commit_enabled, language, created_at |
| jobs | id, project_id, kind(chat/pipeline/server-check/batch), request, status, after_job_id, session_id, pipeline_stage, attempt, cost_usd, created_at, started_at, finished_at |
| sessions | id(SDK 세션 ID), job_id, last_total_cost_usd, model |
| events | id, job_id, ts, type, payload(json) |
| decisions | id, job_id, source(ask/plan/permission/tail/clarify/bridge), question(json), candidates(json), policy_level, status(pending/paused/resolved/cancelled), preselected, resolved_by(human/auto/preselect/policy), answer(json), created_at, deadline_at, paused_ms, resolved_at |
| interruptions | id, job_id, cause, detail, wait_until, attempt, resumed_at |
| rules | id, scope(project/global), project_id, text, origin(auto/manual), status(active/proposed/disabled), created_at |
| project_history | id, project_id, job_id, summary, pending_items, cancelled_unanswered |
| schedules | id, cron, kind, payload, enabled, last_run_at |
| settings | key, value (`decision.timeout` 등 즉시 반영 값) |

## 5. HTTP API (127.0.0.1)

모든 요청: 헤더 `Authorization: Bearer <server.token>`, `X-Newai-Client-Version`. 브라우저 요청은 `Origin`이 서버 주소와 같아야 한다. 응답 헤더 `X-Newai-Server-Version`.

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | /api/health | 상태, 서버 버전, 디스크 코드 버전, 재시작 대기 여부 |
| POST | /api/jobs | 요청 등록 `{text, project?, kind?, after?}` |
| GET | /api/jobs?status= | 목록 |
| GET | /api/jobs/:id | 상세 + 이벤트 |
| POST | /api/jobs/:id/stop | 중지 |
| GET | /api/decisions?status=pending | 열린 카드 |
| POST | /api/decisions/:id/answer | `{choice}` 또는 `{text}` 즉시 적용 |
| POST | /api/decisions/:id/preselect | `{choice}` 마감 시 적용 |
| POST | /api/decisions/:id/pause · /resume | 타이머 멈춤·재개 |
| GET·PUT | /api/settings/timeout | 대기 시간 조회·변경(즉시 반영) |
| GET·POST·PATCH·DELETE | /api/rules | 규칙 관리, 전역 승격 요청 |
| GET | /api/reports/:jobId · /api/reports/daily | 보고서 |
| GET | /api/release/:jobId | diff, 결정, 판정 |
| POST | /api/release/:jobId/push · /pr | 사람 버튼 전용(확인 토큰 필요) |
| POST | /api/hook | 브리지 훅 요청(카드가 풀릴 때까지 대기) |
| GET·POST | /api/schedules, /api/servers | 일정·서버 검토 |

### WebSocket `/ws` 이벤트
`job.updated`, `job.log`(SDK 메시지 요약), `decision.created`, `decision.tick`(5초마다 남은 시간), `decision.resolved`, `settings.changed`, `server.restart_pending`.

## 6. 결정 카드 형식
```json
{
  "id": "dc_01H...", "jobId": "job_...", "source": "ask",
  "question": "어떤 화면 형태로 만들까요?",
  "candidates": [
    {"rank":1,"label":"웹 화면","score":86,"autoSelectable":true,"reason":"사람이 쓰는 프로그램, 브라우저 설치됨",
     "breakdown":{"goal":9,"reversible":8,"scope":9,"env":9,"rules":8,"cost":7}},
    {"rank":2,"label":"터미널 프로그램","score":71,"autoSelectable":true,"reason":"..."},
    {"rank":3,"label":"데스크톱 앱","score":52,"autoSelectable":true,"reason":"..."}
  ],
  "policyLevel": "wait", "deadlineAt": "2026-11-27T10:01:00Z", "paused": false, "preselected": null
}
```

## 7. 명령

### 7.1 `newai` 대화 명령
| 명령 | 동작 |
|---|---|
| (그냥 입력) | 현재 프로젝트에 요청. 작업 중이면 예약(큐) |
| /p 요청 | 파이프라인으로 실행 |
| /new | 새 대화(현재 프로젝트 유지) |
| /project [이름] | 프로젝트 목록·전환·생성 |
| /rules [add 텍스트 / rm ID / promote ID] | 규칙 관리 |
| /report [작업ID / daily] | 보고서 |
| /timeout [20s/1m/5m/10m/20m] | 대기 시간 조회·변경 |
| /commit [on/off] | 현재 프로젝트 커밋 허용 |
| /clarify [on/off] | 시작 전 핵심 질문 켜기·끄기 |
| /careful [on/off] | 모든 wait를 human으로 격상(자리에 있을 때) |
| /status | 서버·큐·카드·버전 상태 |
| /open | 웹 화면 열기 |
| /stop [작업ID] | 작업 중지 |
| /exit | 화면 종료(서버와 큐는 계속) |

결정 카드 키: ↑↓ 또는 j/k 이동, 1~3 바로 고르기, Enter 확정, p 골라 두기, i 직접 입력, Space 타이머 멈춤/재개.

### 7.2 `harness` 관리 명령
| 명령 | 동작 | 종료 코드 |
|---|---|---|
| serve [--port --home] | 서버 실행(전경) | |
| stop / status / doctor | 서버 중지 / 상태 / 환경 점검 | |
| check-web URL [옵션] | 7.3 | 0 통과, 2 사용 오류, 3 기대 실패, 4 접속 실패 |
| keytest | 키 입력 바이트 표시 | |
| clean [--dry-run] | 정리 대상 목록 → 확인 후 삭제 | |
| bridge install / uninstall | 확인 후 전역 Claude Code 설정 변경 | |
| hook | 브리지 훅 실행(설정에서 호출) | |
| autostart install / uninstall | 확인 후 작업 스케줄러 등록·해제 | |
| policy check "명령" | 정책 판정 결과 출력 | |
| report [작업ID] | 보고서 출력 | |

### 7.3 `harness check-web`
```
harness check-web http://127.0.0.1:5173 \
  --size 1280x800 \
  --click "text=시작" --type "#name=홍길동" --press Enter \
  --reload \
  --expect "text=환영합니다" --expect-title "홈" \
  --screenshot out.png --allow-console-errors 0
```
- 동작은 적힌 순서대로. 클릭은 실제 마우스 이벤트이며 가려진 요소는 오류로 끝낸다.
- 콘솔 오류·페이지 오류를 모아 출력. 허용 개수를 넘으면 종료 코드 3.
- 이 PC 밖 주소는 `--allow-external`이 있고 정책이 허용할 때만.

## 8. 브리지 훅 규약
- 입력: Claude Code 훅 표준 입력 JSON(`hook_event_name`, `tool_name`, `tool_input`, `session_id`, `cwd`).
- AskUserQuestion → 출력 `{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow","updatedInput":{...tool_input,"answers":{질문:답}}}}` (실측 통과 형식).
- PermissionRequest → `{"hookSpecificOutput":{"hookEventName":"PermissionRequest","decision":{"behavior":"allow"|"deny", ...}}}`.
- 서버 없음·시간 초과 → 출력 없이 종료 코드 0.

## 9. 시스템 프롬프트 추가 문구(요지)
1. 보고·질문은 `{언어}`로 한다(사용자가 명시한 언어가 우선).
2. 사용자에게 선택을 물을 때는 글로 묻지 말고 AskUserQuestion을 쓴다. 다음 단계를 글로 제안하지 않는다.
3. 보고 끝에 실행 방법, 실제로 실행해 본 명령과 결과, 보류 항목을 쓴다.
4. 웹 화면을 만들면 `harness check-web`으로 실제 클릭 확인을 한다.
5. push·배포·전역 설정 변경은 하지 않는다.
6. (프로젝트 규칙, 이전 작업 기록, 취소된 요청, 환경 감지 결과)

## 10. 시험 명세

| 종류 | 대상 | 도구 | 합격 기준 |
|---|---|---|---|
| 단위 | normPath, 정책 판정, 타이머(가짜 시계), 점수 합산, 판정 줄 읽기, 비용 차이, 중단 분류 | node:test | 전부 통과 |
| 통합(가짜) | 결정 엔진 + FakeScorer, 러너 반복(완료 검사 2회, 끝 질문, 이어가기 5종) + 가짜 SDK | node:test | 시나리오별 상태 전이·횟수 상한 일치 |
| 터미널 | 렌더링(깜빡임 없음 = 프레임당 write 1회, 화면 지우기 시퀀스 없음), 키 해석 | node-pty | 출력 스냅숏 일치 |
| 웹 | 대시보드 카드 키보드 조작, 대기 시간 변경 즉시 반영, 릴리스 버튼 확인창 | `harness check-web` | 종료 코드 0 |
| 실제 E2E | 시험용 하네스(다른 포트·임시 NEWAI_HOME), 짧은 요청 | 실제 Claude | 첫 요청으로 웹 화면 + check-web + 한국어 보고 |
| 장시간 | 1~2시간 무인: 파이프라인 + 후속 요청 + 일부러 낸 중단(서버 강제 종료, 네트워크 차단, 비용 한도, 가짜 사용량 한도) | 스크립트 | 모두 이어 감, 보고서에 "사람이 확인할 항목" |
