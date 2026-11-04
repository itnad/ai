"""Shared helpers for the Dancing With the Wind pipeline."""
from __future__ import annotations

import json
import os
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CLIPS = ROOT / "clips"
FRAMES = ROOT / "frames"
OUTPUT = ROOT / "output"
PROMPTS = ROOT / "prompts"
REFS = ROOT / "refs"
FINAL_NAME = "dancing_with_the_wind_90s.mp4"

FPS = 24
WIDTH, HEIGHT = 1920, 1080
TOTAL_S = 90.0

# provider -> (env var name, human label). Values are never printed.
PROVIDER_KEYS = {
    "veo": ("GEMINI_API_KEY", "Google Veo 3.1 (Gemini API)"),
    "runway": ("RUNWAYML_API_SECRET", "Runway Gen-4 Turbo"),
    "fal_kling": ("FAL_KEY", "fal.ai Kling 2.5 Turbo Pro"),
    "replicate": ("REPLICATE_API_TOKEN", "Replicate (model via --model)"),
}


def load_env_file() -> None:
    """Load ROOT/.env into os.environ without overriding existing vars."""
    env = ROOT / ".env"
    if not env.exists():
        return
    for line in env.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        k, v = k.strip(), v.strip().strip('"').strip("'")
        if k and v and k not in os.environ:
            os.environ[k] = v


def load_json(name: str) -> dict:
    return json.loads((ROOT / name).read_text(encoding="utf-8"))


def shot_plan() -> dict:
    return load_json("shot_plan.json")


def character_bible() -> dict:
    return load_json("character_bible.json")


def visual_bible() -> dict:
    return load_json("visual_bible.json")


def has_key(provider: str) -> bool:
    return bool(os.environ.get(PROVIDER_KEYS[provider][0]))


def ffprobe_json(path: Path) -> dict:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-print_format", "json", "-show_format",
         "-show_streams", "-count_frames", str(path)],
        capture_output=True, text=True, check=True).stdout
    return json.loads(out)


def video_info(path: Path) -> dict:
    """Return duration/width/height/fps/frames/codec for a file."""
    j = ffprobe_json(path)
    v = next((s for s in j["streams"] if s["codec_type"] == "video"), None)
    if v is None:
        raise ValueError(f"no video stream in {path}")
    num, den = v["r_frame_rate"].split("/")
    fps = float(num) / float(den)
    dur = float(v.get("duration") or j["format"].get("duration") or 0)
    frames = int(v.get("nb_read_frames") or v.get("nb_frames") or 0)
    return {
        "path": str(path), "duration_s": round(dur, 4), "width": int(v["width"]),
        "height": int(v["height"]), "fps": round(fps, 4), "frames": frames,
        "codec": v["codec_name"], "pix_fmt": v.get("pix_fmt"),
        "has_audio": any(s["codec_type"] == "audio" for s in j["streams"]),
        "size_bytes": int(j["format"]["size"]),
    }


def require_ffmpeg() -> None:
    for tool in ("ffmpeg", "ffprobe"):
        if shutil.which(tool) is None:
            raise SystemExit(f"{tool} not found in PATH")


def validate_plan(plan: dict) -> None:
    shots = plan["shots"]
    t = 0.0
    for i, s in enumerate(shots):
        if abs(s["start_s"] - t) > 1e-6:
            raise SystemExit(f"{s['id']}: start_s {s['start_s']} != expected {t}")
        t += s["duration_s"]
        prev_x = shots[i - 1]["xfade_out_s"] if i else 0.0
        need = s["duration_s"] + prev_x
        if need > s["gen_duration_s"] + 1e-6:
            raise SystemExit(f"{s['id']}: needs {need}s but gen_duration_s={s['gen_duration_s']}")
    if abs(t - plan["total_duration_s"]) > 1e-6:
        raise SystemExit(f"timeline sums to {t}s, expected {plan['total_duration_s']}")
    if shots[-1]["xfade_out_s"] != 0:
        raise SystemExit("last shot must have xfade_out_s = 0")
