# dancing-with-the-wind

## 서비스 개요
"바람을 붙잡고 춤을 췄구나 (Dancing With the Wind)" 90초 시네마틱 뮤직비디오를
AI 영상 생성 API(Veo 3.1 / Runway Gen-4 / Kling via fal.ai / Replicate)로 클립 단위로 생성하고
FFmpeg로 정확히 90초(2160프레임 @24fps, 1920x1080, H.264)로 편집하는 파이프라인.

## 기술 스택
- Python 3.11+ (requests, pillow, numpy; 선택: google-genai, runwayml, fal-client, replicate, anthropic)
- FFmpeg / ffprobe 6.x

## 핵심 파일
- shot_plan.json        : 15개 샷, 타임코드, 생성 길이, 트랜지션 (합계 정확히 90.0s)
- character_bible.json  : 주인공(지호) 연령 단계별 고정 외형, 여인, 군중
- visual_bible.json     : 스타일 프리픽스/네거티브, 장소, 팔레트, 카메라 규칙
- prompts/              : build_prompts.py가 생성한 샷별 영어 프롬프트
- scripts/check_env.py  : API 키 존재 여부(값 미출력), ffmpeg 점검
- scripts/estimate_cost.py : 모델별 예상 비용
- scripts/generate.py   : 영상 생성 (--provider, --dry-run, 이미 생성된 샷 건너뜀)
- scripts/verify_clips.py : 길이/해상도/fps/무결성 검사
- scripts/assemble.py   : 정규화 + xfade + 정확히 90s 출력 (--placeholder 모드는 슬레이트 영상)
- scripts/consistency_check.py : 샷 경계 색/밝기 연속성 + 컨택트시트 + (선택) Claude 비전 리뷰

## 주의사항
- API 키는 절대 로그/커밋에 출력하지 말 것 (.env는 gitignore)
- 유료 생성(generate.py 실제 실행)은 사용자 승인 후에만
- placeholder/animatic 출력물을 AI 생성 영상이라고 표현하지 말 것
- 최종 파일명: output/dancing_with_the_wind_90s.mp4
