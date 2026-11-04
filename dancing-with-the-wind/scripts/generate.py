#!/usr/bin/env python3
"""Generate one clip per shot through a video-generation API.

    python3 scripts/generate.py --provider veo --dry-run          # show what would be sent, no cost
    python3 scripts/generate.py --provider veo                    # generate all missing shots
    python3 scripts/generate.py --provider veo --shots S05,S06 --retake
    python3 scripts/generate.py --provider fal_kling --chain      # use previous clip's last frame as start image

Existing clips/<id>.mp4 are skipped unless --retake. Each generation writes clips/<id>.json metadata.
Credential values are never printed. Nothing is sent to any API in --dry-run mode.
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import subprocess
import sys
import time
from pathlib import Path

import requests

from common import CLIPS, FRAMES, PROMPTS, PROVIDER_KEYS, REFS, has_key, load_env_file, video_info

DEFAULT_MODELS = {
    "veo": "veo-3.1-generate-preview",        # alternatives: veo-3.1-fast-generate-preview
    "runway": "gen4_turbo",
    "fal_kling": "fal-ai/kling-video/v2.5-turbo/pro",
    "replicate": None,                          # must be passed with --model
}


# ---------------------------------------------------------------- helpers
def extract_last_frame(video: Path, out_png: Path) -> Path:
    FRAMES.mkdir(exist_ok=True)
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-sseof", "-0.1", "-i", str(video),
                    "-frames:v", "1", "-update", "1", str(out_png)], check=True)
    return out_png


def start_image_for(shot: dict, prev_shot: dict | None, chain: bool) -> Path | None:
    """Reference/start image: explicit refs/<id>.png wins, else previous clip's last frame when chaining."""
    ref = REFS / f"{shot['id']}.png"
    if ref.exists():
        return ref
    if chain and shot.get("chain_from_prev") and prev_shot:
        prev_clip = CLIPS / f"{prev_shot['id']}.mp4"
        if prev_clip.exists():
            return extract_last_frame(prev_clip, FRAMES / f"{prev_shot['id']}_last.png")
    return None


def data_uri(path: Path) -> str:
    mime = "image/png" if path.suffix.lower() == ".png" else "image/jpeg"
    return f"data:{mime};base64," + base64.b64encode(path.read_bytes()).decode()


def download(url: str, dest: Path) -> None:
    with requests.get(url, stream=True, timeout=600) as r:
        r.raise_for_status()
        with open(dest, "wb") as f:
            for chunk in r.iter_content(1 << 20):
                f.write(chunk)


# ---------------------------------------------------------------- providers
def gen_veo(shot: dict, model: str, start_image: Path | None, dest: Path, resolution: str) -> dict:
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    cfg = types.GenerateVideosConfig(
        aspect_ratio="16:9", resolution=resolution, duration_seconds=int(shot["gen_duration_s"]),
        negative_prompt=shot["negative_prompt"], number_of_videos=1, person_generation="allow_adult")
    kwargs = {}
    if start_image:
        kwargs["image"] = types.Image.from_file(location=str(start_image))
    op = client.models.generate_videos(model=model, prompt=shot["prompt"], config=cfg, **kwargs)
    while not op.done:
        time.sleep(10)
        op = client.operations.get(op)
    if op.error:
        raise RuntimeError(f"Veo error: {op.error}")
    vid = op.response.generated_videos[0]
    client.files.download(file=vid.video)
    vid.video.save(str(dest))
    return {"operation": getattr(op, "name", None)}


def gen_runway(shot: dict, model: str, start_image: Path | None, dest: Path, resolution: str) -> dict:
    if start_image is None:
        raise RuntimeError(f"{shot['id']}: Runway {model} is image-to-video; put a start image at refs/{shot['id']}.png or use --chain")
    key = os.environ["RUNWAYML_API_SECRET"]
    headers = {"Authorization": f"Bearer {key}", "X-Runway-Version": "2024-11-06", "Content-Type": "application/json"}
    dur = 10 if shot["gen_duration_s"] > 5 else 5
    body = {"model": model, "promptImage": data_uri(start_image), "promptText": shot["prompt"][:1000],
            "ratio": "1280:720", "duration": dur}
    r = requests.post("https://api.dev.runwayml.com/v1/image_to_video", headers=headers, json=body, timeout=60)
    r.raise_for_status()
    task_id = r.json()["id"]
    while True:
        time.sleep(10)
        t = requests.get(f"https://api.dev.runwayml.com/v1/tasks/{task_id}", headers=headers, timeout=60).json()
        if t["status"] == "SUCCEEDED":
            download(t["output"][0], dest)
            return {"task_id": task_id}
        if t["status"] in ("FAILED", "CANCELLED"):
            raise RuntimeError(f"Runway task {task_id}: {t.get('failure') or t['status']}")


def gen_fal_kling(shot: dict, model: str, start_image: Path | None, dest: Path, resolution: str) -> dict:
    import fal_client

    dur = "10" if shot["gen_duration_s"] > 5 else "5"
    args = {"prompt": shot["prompt"], "duration": dur, "aspect_ratio": "16:9",
            "negative_prompt": shot["negative_prompt"], "cfg_scale": 0.5}
    if start_image:
        args["image_url"] = fal_client.upload_file(str(start_image))
        endpoint = f"{model}/image-to-video"
    else:
        endpoint = f"{model}/text-to-video"
    result = fal_client.subscribe(endpoint, arguments=args, with_logs=False)
    download(result["video"]["url"], dest)
    return {"endpoint": endpoint, "request": {k: v for k, v in args.items() if k != "prompt"}}


def gen_replicate(shot: dict, model: str, start_image: Path | None, dest: Path, resolution: str) -> dict:
    import replicate

    if not model:
        raise RuntimeError("--model is required for replicate (e.g. google/veo-3.1 or kwaivgi/kling-v2.5-turbo-pro)")
    inp = {"prompt": shot["prompt"], "aspect_ratio": "16:9", "duration": int(shot["gen_duration_s"]),
           "negative_prompt": shot["negative_prompt"]}
    if start_image:
        inp["image"] = open(start_image, "rb")
    out = replicate.run(model, input=inp)
    if isinstance(out, list):
        out = out[0]
    with open(dest, "wb") as f:
        f.write(out.read() if hasattr(out, "read") else requests.get(str(out), timeout=600).content)
    return {"model": model}


PROVIDERS = {"veo": gen_veo, "runway": gen_runway, "fal_kling": gen_fal_kling, "replicate": gen_replicate}


# ---------------------------------------------------------------- main
def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--provider", required=True, choices=PROVIDERS)
    ap.add_argument("--model", default=None)
    ap.add_argument("--shots", default=None, help="comma list, e.g. S01,S02 (default: all)")
    ap.add_argument("--retake", action="store_true", help="regenerate even if the clip exists")
    ap.add_argument("--chain", action="store_true", help="use previous clip's last frame as start image for chain_from_prev shots")
    ap.add_argument("--resolution", default="1080p")
    ap.add_argument("--dry-run", action="store_true", help="print the plan, send nothing")
    ap.add_argument("--yes", action="store_true", help="skip the interactive cost confirmation")
    args = ap.parse_args()

    load_env_file()
    prompts = json.loads((PROMPTS / "prompts.json").read_text(encoding="utf-8"))
    wanted = set(args.shots.split(",")) if args.shots else {p["id"] for p in prompts}
    model = args.model or DEFAULT_MODELS[args.provider]
    CLIPS.mkdir(exist_ok=True)

    todo = [p for p in prompts if p["id"] in wanted and (args.retake or not (CLIPS / f"{p['id']}.mp4").exists())]
    total_s = sum(p["gen_duration_s"] for p in todo)
    print(f"provider={args.provider} model={model} shots={len(todo)} generated_seconds={total_s}")
    if args.dry_run:
        for p in todo:
            print(f"\n--- {p['id']} ({p['gen_duration_s']}s, chain={p['chain_from_prev']}) ---\n{p['prompt']}")
        print("\nDRY RUN: nothing was sent.")
        return 0
    if not has_key(args.provider):
        env, label = PROVIDER_KEYS[args.provider]
        print(f"ERROR: {label} needs {env} (set it in .env). Aborting before any request.", file=sys.stderr)
        return 1
    if not todo:
        print("nothing to do (all clips exist; use --retake)")
        return 0
    if not args.yes:
        ans = input(f"This will bill {total_s}s of video on {args.provider}. Continue? [y/N] ")
        if ans.strip().lower() != "y":
            print("aborted")
            return 1

    by_id = {p["id"]: p for p in prompts}
    ids = [p["id"] for p in prompts]
    failures = 0
    for p in todo:
        prev = by_id[ids[ids.index(p["id"]) - 1]] if ids.index(p["id"]) > 0 else None
        dest = CLIPS / f"{p['id']}.mp4"
        start_image = start_image_for(p, prev, args.chain)
        print(f"[{p['id']}] generating via {args.provider} (start_image={start_image.name if start_image else None}) ...", flush=True)
        t0 = time.time()
        try:
            meta = PROVIDERS[args.provider](p, model, start_image, dest, args.resolution)
            info = video_info(dest)
            meta.update({"provider": args.provider, "model": model, "shot": p["id"], "seconds": round(time.time() - t0, 1),
                         "start_image": str(start_image) if start_image else None, "video": info,
                         "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S")})
            (CLIPS / f"{p['id']}.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
            print(f"[{p['id']}] ok {info['duration_s']}s {info['width']}x{info['height']} {info['fps']}fps ({meta['seconds']}s)")
        except Exception as e:  # keep going, report at the end
            failures += 1
            print(f"[{p['id']}] FAILED: {type(e).__name__}: {e}", file=sys.stderr)
            if dest.exists() and dest.stat().st_size == 0:
                dest.unlink()
    print(f"\ndone: {len(todo) - failures} ok, {failures} failed")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
