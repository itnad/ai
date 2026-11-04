#!/usr/bin/env bash
# Full pipeline. Usage: ./run_pipeline.sh <provider> [extra generate.py args]
# e.g. ./run_pipeline.sh veo --yes     |     ./run_pipeline.sh fal_kling --chain
set -euo pipefail
cd "$(dirname "$0")"
PROVIDER="${1:?provider: veo | runway | fal_kling | replicate}"; shift || true
python3 scripts/check_env.py
python3 scripts/build_prompts.py
python3 scripts/estimate_cost.py
python3 scripts/generate.py --provider "$PROVIDER" "$@"
python3 scripts/verify_clips.py
python3 scripts/consistency_check.py ${ANTHROPIC_API_KEY:+--vision} || echo "consistency check flagged shots - review output/consistency_report.json, retake with: python3 scripts/generate.py --provider $PROVIDER --shots <ids> --retake"
python3 scripts/assemble.py ${MUSIC:+--music "$MUSIC"}
echo "final: output/dancing_with_the_wind_90s.mp4"
