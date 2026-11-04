# Dancing With the Wind (바람을 붙잡고 춤을 췄구나) — 90s AI 뮤직비디오 제작 파이프라인

실사 기반 초현실 시네마틱 뮤직비디오 90초 테스트 영상을 **AI 영상 생성 API + FFmpeg**로 만드는 프로젝트입니다.

| 항목 | 값 |
|---|---|
| 길이 | 정확히 90.000 s (2160 프레임) |
| 포맷 | 1920×1080, 16:9, 24 fps, MP4 / H.264 (yuv420p, High 4.1) |
| 샷 수 | 15 (각 4–7 s, 생성은 8 s 단위) |
| 최종 파일 | `output/dancing_with_the_wind_90s.mp4` |
| 대사/자막/로고 | 없음 (프롬프트 + 네거티브 프롬프트로 금지) |
| 음악 | 추후 제공 원곡을 `--music` 옵션으로 믹스 |

## 현재 상태 (2026-11-04 기준) — 중요

* **영상 생성 API 키가 없어 실제 AI 영상은 아직 생성되지 않았습니다.**
  환경 점검 결과 Veo / Runway / fal(Kling) / Replicate 어느 키도 없었고,
  컨테이너의 GCP 토큰과 AWS 자격증명은 무효(placeholder)로 확인되었습니다.
* FFmpeg 6.1.1은 설치되어 있어 편집 파이프라인은 **플레이스홀더 슬레이트**로 끝까지 검증했습니다
  (`output/PIPELINE_TEST_placeholder_slates_90s.mp4`, 정확히 90 s / 2160 프레임 / 1080p / 24 fps).
  이 파일은 **AI 생성 영상이 아니며** 편집·규격 검증용 테스트 출력물입니다.
* 키를 `.env`에 넣고 `run_pipeline.sh`를 실행하면 생성 → 검증 → 편집이 한 번에 돌아갑니다.

## 파일 구성

```
dancing-with-the-wind/
├── shot_plan.json          # 15샷 타임라인 (합계 90.0s), 카메라/액션/트랜지션
├── character_bible.json    # 주인공 지호: 고정 외형 + 5단계 연령 디스크립터, 여인, 군중, 가족, 친구, 소품
├── visual_bible.json       # 스타일 프리픽스/서픽스, 네거티브, 장소 7곳, 막별 팔레트/조명, 연속성 체크 항목
├── prompts/                # build_prompts.py 산출물: S01.txt … S15.txt, prompts.json
├── scripts/
│   ├── check_env.py        # 키 존재 여부(값 미출력), ffmpeg, SDK 설치 점검
│   ├── build_prompts.py    # 바이블 + 샷플랜 → 영어 프롬프트
│   ├── estimate_cost.py    # 모델별 예상 비용
│   ├── generate.py         # 영상 생성 (veo | runway | fal_kling | replicate), --dry-run / --chain / --retake
│   ├── verify_clips.py     # 길이/해상도/fps/디코딩 무결성 검사 → clips/verify_report.json
│   ├── consistency_check.py# 컷 경계 밝기/색 점프, 컨택트시트, (선택) Claude 비전 연속성 리뷰
│   └── assemble.py         # 정규화 → xfade/concat → 페이드 → 정확히 90s 인코딩
├── run_pipeline.sh         # 전체 실행
├── clips/   frames/   output/   refs/   # 생성 클립 / 중간 파일 / 결과물 / 샷별 참조 이미지(선택)
└── .env.example            # 필요한 키 이름
```

## 실행 방법

```bash
cd dancing-with-the-wind
pip install -r requirements.txt          # 필요한 provider SDK만 설치해도 됨
cp .env.example .env && $EDITOR .env     # 키 입력 (커밋 금지, .gitignore 처리됨)

python3 scripts/check_env.py             # 사용 가능한 provider 확인
python3 scripts/build_prompts.py         # prompts/ 생성
python3 scripts/estimate_cost.py         # 비용 확인 후 승인
python3 scripts/generate.py --provider veo --dry-run   # 전송 내용 미리보기 (비용 0)
python3 scripts/generate.py --provider veo             # 실제 생성 (확인 프롬프트 있음, --yes로 생략)
python3 scripts/verify_clips.py
python3 scripts/consistency_check.py --vision          # ANTHROPIC_API_KEY 있을 때만 --vision
python3 scripts/generate.py --provider veo --shots S09,S12 --retake   # 문제 샷만 재생성
python3 scripts/assemble.py --music /path/to/song.wav   # 음악 없으면 --music 생략 (무음 비디오)
```
또는 `./run_pipeline.sh veo --yes` 한 줄.

### provider별 메모
| provider | 모델 | 길이 | 해상도 | 비고 |
|---|---|---|---|---|
| `veo` | `veo-3.1-generate-preview` (또는 `--model veo-3.1-fast-generate-preview`) | 8 s | 1080p | text-to-video + 시작 이미지 지원, 오디오 포함(편집 시 제거) |
| `fal_kling` | `fal-ai/kling-video/v2.5-turbo/pro` | 10 s | 1080p | text/image-to-video, 가장 저렴한 1080p |
| `runway` | `gen4_turbo` | 10 s | 720p→업스케일 | **image-to-video 전용**: `refs/<id>.png` 또는 `--chain` 필요 |
| `replicate` | `--model` 필수 | 모델별 | 모델별 | 범용 어댑터 |

`--chain`은 `shot_plan.json`에서 `chain_from_prev: true`인 샷(S06, S12, S13, S15)에 이전 클립 마지막 프레임을 시작 이미지로 넘겨 인물 연속성을 높입니다.
`refs/<id>.png`가 있으면 그 이미지가 우선합니다 (예: 주인공 얼굴 레퍼런스).

## 예상 비용 (15샷, 1회 생성 / 재생성 1.5배 가정, USD, 2026-11-04 웹 조사 기준)

| 모델 | $/s | 1회 | 재생성 포함 |
|---|---|---|---|
| Veo 3.1 1080p | 0.40 | 48.00 | 72.00 |
| Veo 3.1 Fast 1080p | 0.12 | 14.40 | 21.60 |
| Veo 3.1 Lite 1080p | 0.08 | 9.60 | 14.40 |
| Kling 2.5 Turbo Pro (fal.ai) | 0.07 | 10.50 | 15.75 |
| Runway Gen-4 Turbo 720p | 0.05 | 7.50 | 11.25 |
| Sora 2 Pro 1080p | 0.70 | 84.00 | 126.00 (API 제공 여부 미확인) |

가격은 각 사 공식 페이지에서 재확인 후 승인하세요. `generate.py`는 실제 전송 전 과금 초(秒)를 보여주고 확인을 받습니다.

## 편집 규칙 (assemble.py)
* 각 클립을 1920×1080(레터박스 패드)·24 fps·yuv420p로 정규화하고 샷 길이 + 다음 디졸브 겹침만큼 트림
* `xfade_out_s > 0` 샷은 cross-dissolve, 0은 하드컷 (막 전환 S01→S02, S09→S10 하드컷)
* 시작 1 s 페이드인, 끝 2 s 페이드아웃, `trim=90` 후 프레임 수 2160 검증
* `in_point_s`를 샷에 추가하면 8 s 생성 클립 중 원하는 구간을 선택할 수 있음

## 스토리 → 샷 매핑
| 샷 | 시간 | 연령 | 내용 |
|---|---|---|---|
| S01 | 0–6 | 20대 | 을지로 골목, 바람을 움켜쥐려는 청년 |
| S02 | 6–12 | 20대 | 가족 식탁을 떠남 → 황금 부조로 굳음 |
| S03 | 12–18 | 20대 | 포장마차 친구들을 떠남 → 금박 조각상 |
| S04 | 18–24 | 30대 | 깨진 거울, 첫 흰머리, 오르골이 금으로 벽에 박힘 |
| S05 | 24–31 | 30대 | 끝없는 황금 계단, 맞바람 |
| S06 | 31–37 | 40대 | 계속 오름, 궁전 문이 열림 |
| S07 | 37–43 | 50대 | 가면 군중의 환호 속 입장 |
| S08 | 43–50 | 50대 | 여인과 왈츠, 왕관 |
| S09 | 50–56 | 50대 | 군중의 기계적 반복, 도자기 같은 여인 |
| S10 | 56–62 | 50대 | 벽이 갈라지고 사진·편지·오르골 조각이 쏟아짐 |
| S11 | 62–68 | 50대 | 발레리나 조각을 쥔 손, 깨달음 |
| S12 | 68–75 | 50대 | 마지막 춤, 여인과 궁전이 금가루로 사라짐 |
| S13 | 75–80 | 70대 | 빈손을 바라봄 |
| S14 | 80–86 | 70대 | 폐허가 된 출발 골목 |
| S15 | 86–90 | 70대 | 어두운 길로 걸어감, 페이드아웃 |
