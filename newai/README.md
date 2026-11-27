# newai

Claude Code를 감싸는 개발 자동화 하네스. 사람이 없어도 멈추지 않고, 합리적으로 판단해서 계속 진행한다.
push·배포 같은 되돌리기 어려운 일은 사람이 한다.

**현재 상태: 구현 ① 저장소·설정·정책 완료.** 동작하는 명령: `harness doctor`, `harness init`, `harness policy check`, `harness config get/set`.

```bash
npm install
npm test
node bin/harness.js doctor
```

| 문서 | 내용 |
|---|---|
| [docs/feasibility.md](docs/feasibility.md) | 실현 가능성 검토와 실제 확인 결과 |
| [docs/requirements.md](docs/requirements.md) | 요구사항 |
| [docs/design.md](docs/design.md) | 설계 |
| [docs/spec.md](docs/spec.md) | 명세(파일 형식, API, 명령, 시험) |
| [docs/security-policy.md](docs/security-policy.md) | 보안 정책 |
| [docs/plan.md](docs/plan.md) | 단계별 구현 계획과 무인 시나리오 |
| [docs/user-guide.md](docs/user-guide.md) | 사용 설명서(초안) |
