# itnad/ai

단일 레포지토리에서 여러 서비스를 관리하는 AI 자동화 시스템입니다.
GitHub Issue로 작업을 요청하면 Claude Code가 해당 서비스 코드를 자동으로 수정하고 배포합니다.

---

## 레포지토리 구조

```
itnad/ai/
├── .github/
│   ├── workflows/
│   │   ├── ai-issue-task.yml      # 메인 워크플로우 (서비스 감지 → Claude 작업 → 배포)
│   │   └── issue-auto-label.yml   # 이슈 생성 시 서비스 라벨 자동 부착
│   └── ISSUE_TEMPLATE/
│       └── ai-task.yml            # AI 작업 요청 이슈 템플릿
│
├── [service-name]/                # 서비스별 폴더
│   ├── service.config.json        # 서비스 메타데이터 + 배포 설정
│   ├── CLAUDE.md                  # AI가 이 서비스 작업 시 참조할 컨텍스트
│   └── src/                      # 실제 소스
│
└── ai-request.html                # 작업 요청 웹페이지 (로컬 실행)
```

---

## 작업 흐름

```
ai-request.html에서 서비스 선택 + 작업 내용 입력
    ↓
GitHub Issue 자동 생성
    ↓
issue-auto-label.yml → "service:서비스명" 라벨 부착
    ↓
ai-issue-task.yml 트리거
    ↓
Claude Code → 해당 서비스 폴더만 작업 후 커밋
    ↓
service.config.json 읽어 배포 플랫폼 분기
    ↓
배포 완료
```

---

## 새 서비스 추가 방법

### 1. 폴더 생성 및 service.config.json 작성

```bash
mkdir my-new-service
```

`my-new-service/service.config.json`:
```json
{
  "name": "my-new-service",
  "type": "static",
  "description": "서비스 설명",
  "stack": {
    "frontend": "react",
    "backend": "none"
  },
  "deploy": {
    "platform": "vercel",
    "region": "icn1"
  },
  "build": {
    "command": "npm run build",
    "output_dir": "dist"
  }
}
```

**type 값:**
| 값 | 설명 |
|---|---|
| `static` | 정적 SPA (React, Vue 등) |
| `fullstack` | Next.js, SvelteKit 등 |
| `api` | 백엔드 API 서버 |
| `hybrid` | 프론트 + 백엔드 분리 |

**deploy.platform 값:**
| 값 | 설명 |
|---|---|
| `vercel` | Vercel 배포 |
| `render` | Render.com 배포 (Deploy Hook 방식) |
| `github-pages` | GitHub Pages 배포 |
| `none` | 배포 없음 (Claude 작업만) |

### 2. CLAUDE.md 작성

`my-new-service/CLAUDE.md`:
```markdown
# my-new-service

## 서비스 개요
이 서비스는 ...

## 기술 스택
- Frontend: React + Vite
- Backend: 없음

## 주의사항
- ...

## 주요 파일
- src/main.jsx : 진입점
- src/components/ : 컴포넌트 모음
```

### 3. 워크플로우 파일 업데이트

`.github/workflows/ai-issue-task.yml`의 Render 배포 섹션에 환경변수 추가:
```yaml
MY_NEW_SERVICE: ${{ secrets.RENDER_DEPLOY_HOOK_MY_NEW_SERVICE }}
```

### 4. GitHub Secrets 등록

`Settings → Secrets and variables → Actions`에서 필요한 시크릿 추가:

| 플랫폼 | 시크릿명 | 값 |
|---|---|---|
| 공통 | `ANTHROPIC_API_KEY` | Anthropic API 키 |
| Vercel | `VERCEL_TOKEN` | Vercel 토큰 |
| Vercel | `VERCEL_ORG_ID` | Vercel Org ID |
| Vercel | `VERCEL_PROJECT_ID_서비스명대문자` | 각 서비스별 프로젝트 ID |
| Render | `RENDER_DEPLOY_HOOK_서비스명대문자` | Render Deploy Hook URL |

### 5. 이슈 템플릿 업데이트

`.github/ISSUE_TEMPLATE/ai-task.yml`의 options에 서비스명 추가:
```yaml
options:
  - my-new-service
```

### 6. 요청 페이지 업데이트

`ai-request.html`의 SERVICES 배열에 추가:
```javascript
{ name: 'my-new-service', type: 'static', color: '#3fb950' },
```

---

## 기존 알려진 이슈 및 해결책

| 오류 | 원인 | 해결 |
|---|---|---|
| `Could not fetch an OIDC token` | `id-token: write` 권한 누락 | workflow permissions에 추가 |
| 커밋 없이 Success | Workflow 권한이 read-only | Settings → Actions → General → Read and write permissions |
| `401 Unauthorized` (HTML 페이지) | PAT 토큰 만료 또는 권한 부족 | 토큰 재발급, `repo` 권한 포함 |
| `error_max_turns` | max_turns 부족 | 50으로 설정 (현재 적용됨) |
| permission_denials_count 높음 | allowed_tools 미지정 | 명시적으로 지정 (현재 적용됨) |

---

## Vercel 폴더별 프로젝트 설정

같은 레포를 여러 Vercel 프로젝트가 각자 다른 폴더를 바라보도록 설정:

1. Vercel 대시보드 → Add New Project
2. Repository: `itnad/ai` 선택
3. **Root Directory**: 서비스 폴더명 입력 (예: `socceroid`)
4. 프로젝트명: `ai-socceroid` 식으로 구분

폴더 외 파일이 변경될 때는 해당 프로젝트가 재배포되지 않습니다.
