# newai 사용 설명서 (초안)

> **상태: 구현 중.** 지금 동작하는 것은 `harness doctor`, `harness init`, `harness policy check`, `harness config get/set`뿐이다. 나머지는 각 구현 단계가 끝날 때 실제 동작에 맞춰 고친다.

## 1. 설치

필요한 것: Node.js 22.18 이상, Claude Code(로그인 완료), Git, (선택) GitHub CLI `gh`.
빌드는 필요 없다. Node가 TypeScript 소스를 그대로 실행한다.

```bash
cd newai
npm install
npm link
harness doctor
```

`npm install -g`로 설치하면 소스가 `node_modules` 안에 놓여 실행되지 않는다. 반드시 저장소 폴더에서 `npm link`를 쓴다.

처음 실행하면 데이터 폴더(Windows `%APPDATA%\newai`, 그 외 `~/.newai`)에 기본 설정이 만들어진다.

## 2. 시작하기

```bash
newai
```

- 서버가 꺼져 있으면 뒤에서 켜고 대화 화면을 연다.
- 원하는 것을 그냥 입력한다. 예: `할 일 관리 웹 화면 만들어 줘`
- 질문이 생기면 화면 아래에 결정 카드가 뜬다. 대기 시간이 지나면 1순위로 진행한다.
- 웹 화면은 `/open`으로 연다. 터미널과 같은 대화가 보인다.

## 3. 결정 카드 조작

| 키 | 동작 |
|---|---|
| ↑ ↓ 또는 j k | 추천안 이동 |
| 1 2 3 | 바로 고르기 |
| Enter | 확정 |
| p | 골라 두기(마감 때 적용) |
| i | 직접 입력 |
| Space | 타이머 멈춤/재개 |

화살표가 안 먹으면 `harness keytest`로 어떤 바이트가 들어오는지 확인하고 대체 키를 쓴다.

## 4. 자주 쓰는 명령

| 명령 | 설명 |
|---|---|
| `/p 요청` | 요구사항부터 검증까지 파이프라인 실행 |
| `/timeout 5m` | 대기 시간 변경(즉시 적용) |
| `/project 이름` | 프로젝트 전환·생성 |
| `/status` | 서버·큐·카드 상태 |
| `/report` | 최근 보고서 |
| `/careful on` | 자리에 있을 때: 대기 후 자동 진행을 사람 승인으로 바꿈 |
| `/exit` | 화면만 닫음(작업은 계속) |

## 5. 검토와 push

push와 PR 생성은 newai가 하지 않는다. 대시보드의 "릴리스" 화면에서 변경 내용과 결정 기록, 검증 결과를 보고 버튼을 직접 누른다.

## 6. 선택 기능

```bash
harness bridge install      # 평소 Claude Code 질문도 결정 카드로(전역 설정 변경 전 확인)
harness autostart install   # Windows 로그인 시 자동 실행(등록 전 확인)
```

Telegram 원격 답변은 `secrets.yaml`에 봇 토큰과 chat ID를 넣고 `config.yaml`의 `notify.telegram: true`로 켠다.

## 7. 정책 확인

어떤 명령이 막히는지 미리 볼 수 있다.

```bash
harness policy check "git push origin main"
```

```bash
harness policy check --write ../other/file.txt --workdir .
```

결과는 즉시 허용, 대기 필수, 사람 승인, 거부 중 하나와 이유다. 정책은 데이터 폴더의 `policy.yaml`에서 고친다.

## 8. 설정 바꾸기

```bash
harness config set decision.timeout 5m
```

잘못된 값이면 저장하지 않고 한국어로 이유를 알려 준다. 파일의 주석은 그대로 남는다.

## 9. 문제 해결

| 증상 | 확인 |
|---|---|
| 개선한 기능이 반영 안 됨 | `/status`의 서버 버전과 코드 버전 비교. 다르면 작업이 끝난 뒤 자동 재시작 |
| 작업이 멈춘 것 같음 | `/status`에서 "이어가기 대기" 사유와 재개 시각 확인 |
| 화살표 키 안 됨 | `harness keytest`, 대체 키 j/k·숫자 |
