# newai 보안 정책

작성일: 2026-11-27 · 버전: 0.1(구현 전)

## 1. 원칙

1. **되돌리기 어려운 일은 사람이 한다.** push, 배포, 공개, 전역 설정 변경, 대량 삭제, 이력·DB 파괴.
2. **여러 겹으로 막는다.** 한 겹이 뚫려도 다른 겹이 막도록 서로 독립적으로 둔다.
3. **판단은 기록한다.** 자동이든 사람이든 모든 결정과 차단을 이유와 함께 남긴다.
4. **정책은 사람만 고친다.** 하네스 코드와 정책 파일은 에이전트가 승인 없이 못 고친다.

## 2. 판정 단계

| 단계 | 뜻 | 자동 진행 |
|---|---|---|
| allow | 즉시 허용 | 예 |
| wait | 결정 카드를 띄우고 대기 시간을 반드시 채운다. 마감 시 1순위가 자동 선택 가능하면 진행 | 대기 후 예 |
| human | 사람이 고를 때까지 기다린다. 알림을 다시 보낸다(30분 간격) | 아니요 |
| deny | 거부하고 이유를 에이전트에게 알린다 | 아니요 |

`/careful on`이면 wait가 모두 human으로 바뀐다.

## 3. 대상별 규칙

| 대상 | 단계 | 예 |
|---|---|---|
| git push, 강제 push | deny(에이전트) / 릴리스 버튼만 | `git push`, 스크립트 안의 push |
| 배포·공개 | deny | `npm publish`, `vercel --prod`, `gh pr create`, `gh release` |
| 이력 파괴 | human | `git reset --hard`, `git clean -fdx`, `rebase`, `branch -D`, `filter-repo` |
| 대량 삭제 | human | `rm -rf` 넓은 대상, `find -delete`, `Remove-Item -Recurse` |
| DB 파괴 | human | `DROP`, `TRUNCATE`, 조건 없는 `DELETE`, `migrate reset` |
| 비밀 파일 읽기·쓰기 | human | `.env`, `*.pem`, `id_rsa`, `credentials.json` |
| 시스템·전역 설정 | human | `setx`, `reg add`, `schtasks`, `crontab`, `~/.claude/settings.json` |
| 하네스 코드·정책 | human | `INSTALL_DIR` 아래, `policy.yaml`, `config.yaml`, `secrets.yaml` |
| 작업 폴더 밖 쓰기 | wait | 다른 프로젝트, 홈 폴더 |
| 외부 통신 | wait | `curl`, `ssh`, WebFetch, WebSearch, check-web 외부 주소 |
| 패키지 내려받기 | wait | `npm install`, `pip install` |
| 그 외 작업 폴더 안 읽기·쓰기·실행 | allow | |

선택지 문구에 push·배포·공개가 들어 있으면 자동 선택에서 뺀다(`auto_select_exclude`).

Bash 명령은 맞는 규칙을 모두 찾고 가장 엄격한 단계를 쓴다. 명령 안에 보호 경로나 비밀 파일 이름이 있으면 그것만으로도 사람 승인이다. `.env.example`, `*.pub`처럼 비밀이 아닌 파일은 `secret_files_exclude`로 뺀다.

### 끌 수 없는 기본 규칙
정책 파일과 무관하게 코드에서 항상 적용한다. 모두 사람 승인이다.
- `GIT_CONFIG_COUNT`·`GIT_CONFIG_KEY_n` 같은 push 차단용 환경 변수를 건드림
- `pushInsteadOf` 언급
- `env -u`, `env -i`, `unset GIT_...`처럼 환경 변수를 지움
- `git -c url....`, `git --config-env`로 설정을 명령에서 덮어씀

## 4. 겹별 구현

| 겹 | 구현 | 막는 것 |
|---|---|---|
| 1. 선택지 필터 | 결정 엔진이 `autoSelectable=false` 표시 | 질문을 통한 push·배포 |
| 2. PreToolUse 훅 + `canUseTool` | `policy.yaml` 규칙으로 Bash·파일·웹 도구 판정 | 직접 명령 |
| 3. git 환경 변수 | 에이전트 환경에 `GIT_CONFIG_COUNT=N`, `GIT_CONFIG_KEY_i=url.newai-blocked://.pushInsteadOf`, 값은 `/`, `https://`, `http://`, `ssh://`, `git@`, `file://`, Windows 드라이브(`C:` 등) | 스크립트·빌드 도구 안의 push |
| 4. 안내 스크립트 | PATH 앞에 `git-remote-newai-blocked` 두어 "push는 릴리스 단계에서" 한국어 메시지 출력 | 오류 문구 혼란 |
| 5. 자격 증명 분리 | 에이전트 환경에서 `GH_TOKEN`, `GITHUB_TOKEN`, `NPM_TOKEN` 등 제거, `GIT_TERMINAL_PROMPT=0` | 토큰을 이용한 우회 |
| 6. 경로 감시 | 파일 도구 경로와 Bash 리다이렉트 대상을 `normPath`로 정규화해 판정 | 폴더 밖·보호 경로 쓰기 |
| 7. 판단 모델 격리 | 빈 폴더, `settingSources: []`, 도구 없음 | 다른 프로젝트 기억에 의한 판단 오염 |
| 8. 서버 접근 제어 | 127.0.0.1 바인딩, 로컬 토큰, Origin 검사, 릴리스 버튼은 1회용 확인 토큰 | 다른 웹페이지에서의 요청 위조 |

실측: 3번 겹으로 로컬 경로·https 원격·스크립트 안의 push가 모두 막히고 fetch는 영향이 없었다(`feasibility.md`).

## 5. 알려진 한계

- Bash 명령 문자열 검사는 `eval`, 인코딩, 다른 언어 스크립트로 우회될 수 있다. 그래서 git 환경 변수와 자격 증명 분리를 함께 쓴다.
- 에이전트가 `env -u GIT_CONFIG_COUNT`처럼 환경 변수를 지우면 3번 겹은 사라진다. 이 패턴은 2번 겹에서 human으로 잡고, 5번 겹 때문에 토큰도 없다.
- `user@host:repo` 같은 짧은 SSH 주소는 접두사로 다 막을 수 없다. 5번 겹과 2번 겹에 의존한다.
- 완전한 격리가 필요하면 운영체제 수준 격리(별도 사용자 계정, 컨테이너)를 추가로 검토한다. 이번 범위에는 넣지 않는다.

## 6. 비밀 관리

- 비밀은 `NEWAI_HOME/secrets.yaml`에만 둔다(Windows는 사용자 전용 ACL, 그 외 권한 600).
- 로그·이벤트·보고서에 쓰기 전에 알려진 토큰 형식을 가린다.
- Telegram·Slack 버튼 응답은 허용된 chat/사용자 ID와 카드별 1회용 서명을 모두 확인한다.

## 7. 전역 설정 변경 절차

브리지 설치, 자동 실행 등록처럼 사용자 전역 환경을 바꾸는 명령은 모두 같은 절차를 따른다.
1. 바꿀 파일과 바뀌는 내용(diff)을 보여 준다.
2. 사용자가 `y`를 입력해야 진행한다. 기본값은 "아니요".
3. 바꾸기 전 백업을 만든다(`*.newai-backup-<시각>`).
4. 넣은 항목에는 표식을 달아 제거 명령이 그 항목만 지울 수 있게 한다.

## 8. 릴리스 단계에서만 푸는 것

- push와 PR 생성은 대시보드 릴리스 화면의 버튼으로만, 하네스 서버 프로세스가 사용자 자격 증명으로 실행한다.
- 버튼마다 확인 대화상자와 1회용 확인 토큰을 거친다.
- 원격 응답(Telegram·Slack)으로는 push·PR 버튼을 제공하지 않는다.
