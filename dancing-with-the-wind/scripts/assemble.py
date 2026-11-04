#!/usr/bin/env python3
"""Cut the generated clips into the final 90.000 s / 1920x1080 / 24 fps / H.264 MP4.

    python3 scripts/assemble.py                       # requires every clips/<id>.mp4
    python3 scripts/assemble.py --placeholder         # missing clips -> labelled slates (pipeline test ONLY, not AI video)
    python3 scripts/assemble.py --music song.wav      # mux the provided music (trimmed to 90 s)

Steps: normalize each clip (scale/pad to 1920x1080, 24 fps, trim to its slot + dissolve overlap)
-> one filtergraph of xfade (dissolves) / concat (hard cuts) -> fade in/out -> exact 2160 frames.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

from common import CLIPS, FINAL_NAME, FPS, FRAMES, HEIGHT, OUTPUT, TOTAL_S, WIDTH, require_ffmpeg, shot_plan, validate_plan, video_info

NORM_VF = (f"scale={WIDTH}:{HEIGHT}:force_original_aspect_ratio=decrease:flags=lanczos,"
           f"pad={WIDTH}:{HEIGHT}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps={FPS},format=yuv420p")


def run(cmd: list[str]) -> None:
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(r.stderr[-3000:], file=sys.stderr)
        raise SystemExit(f"command failed: {' '.join(cmd[:3])} ...")


def make_slate(shot: dict, length_s: float, dest: Path) -> None:
    """Labelled placeholder (NOT AI-generated) so the edit can be tested without clips."""
    text = (f"PLACEHOLDER SLATE - NOT AI GENERATED|{shot['id']}  {shot['start_s']:.1f}s - "
            f"{shot['start_s']+shot['duration_s']:.1f}s|{shot['age_stage']}  {shot['location']}|{shot['camera']}")
    lines = text.split("|")
    draw = ",".join(
        f"drawtext=text='{l.replace(chr(39), '')}':fontcolor=white:fontsize={54 if i == 0 else 36}:"
        f"x=(w-text_w)/2:y=h/2-120+{i*70}" for i, l in enumerate(lines))
    src = (f"gradients=s={WIDTH}x{HEIGHT}:r={FPS}:d={length_s}:c0=0x202838:c1=0x6b5a2a:c2=0x101014:"
           f"speed=0.03:type=linear")
    run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", src, "-vf", f"{draw},format=yuv420p",
         "-t", f"{length_s}", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-r", str(FPS), str(dest)])


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--placeholder", action="store_true", help="substitute labelled slates for missing clips")
    ap.add_argument("--music", type=Path, default=None, help="audio file to mux (trimmed to 90 s)")
    ap.add_argument("--out", type=Path, default=OUTPUT / FINAL_NAME)
    ap.add_argument("--crf", default="17")
    args = ap.parse_args()
    require_ffmpeg()
    plan = shot_plan()
    validate_plan(plan)
    shots = plan["shots"]
    FRAMES.mkdir(exist_ok=True); OUTPUT.mkdir(exist_ok=True); args.out.parent.mkdir(parents=True, exist_ok=True)

    # 1) normalize ---------------------------------------------------------
    norm, lengths, used_placeholder = [], [], []
    for i, s in enumerate(shots):
        prev_x = shots[i - 1]["xfade_out_s"] if i else 0.0
        length = round(s["duration_s"] + prev_x, 3)          # overlap for the dissolve coming from shot i-1
        src = CLIPS / f"{s['id']}.mp4"
        dest = FRAMES / f"norm_{s['id']}.mp4"
        if not src.exists():
            if not args.placeholder:
                raise SystemExit(f"missing {src}. Generate it first, or pass --placeholder for a slate-only test build.")
            make_slate(s, length, dest)
            used_placeholder.append(s["id"])
        else:
            info = video_info(src)
            if info["duration_s"] + 0.05 < length:
                raise SystemExit(f"{s['id']}: clip is {info['duration_s']}s, needs {length}s")
            in_point = float(s.get("in_point_s", 0.0))
            run(["ffmpeg", "-y", "-v", "error", "-ss", f"{in_point}", "-i", str(src), "-t", f"{length}",
                 "-vf", NORM_VF, "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "14", "-r", str(FPS), str(dest)])
        norm.append(dest); lengths.append(length)

    # 2) filtergraph ---------------------------------------------------------
    inputs = []
    for p in norm:
        inputs += ["-i", str(p)]
    # every input gets the same timebase/pts origin; xfade/concat refuse mismatched timebases
    parts = [f"[{i}:v]settb=AVTB,setpts=PTS-STARTPTS[c{i}]" for i in range(len(shots))]
    cur, cur_len = "[c0]", lengths[0]
    for i in range(1, len(shots)):
        x = shots[i - 1]["xfade_out_s"]
        nxt, out = f"[c{i}]", f"[v{i}]"
        if x > 0:
            offset = round(cur_len - x, 3)
            parts.append(f"{cur}{nxt}xfade=transition=fade:duration={x}:offset={offset},settb=AVTB{out}")
            cur_len = cur_len + lengths[i] - x
        else:
            parts.append(f"{cur}{nxt}concat=n=2:v=1:a=0,settb=AVTB{out}")
            cur_len = cur_len + lengths[i]
        cur = out
    fade_out_start = TOTAL_S - 2.0
    parts.append(f"{cur}fade=t=in:st=0:d=1.0,fade=t=out:st={fade_out_start}:d=2.0,"
                 f"trim=duration={TOTAL_S},setpts=PTS-STARTPTS,fps={FPS},format=yuv420p[vout]")
    graph = ";".join(parts)
    if abs(cur_len - TOTAL_S) > 0.01:
        raise SystemExit(f"internal: graph length {cur_len} != {TOTAL_S}")

    cmd = ["ffmpeg", "-y", "-v", "error"] + inputs
    maps = ["-map", "[vout]"]
    if args.music:
        cmd += ["-i", str(args.music)]
        maps += ["-map", f"{len(norm)}:a:0", "-c:a", "aac", "-b:a", "320k",
                 "-af", f"atrim=duration={TOTAL_S},afade=t=out:st={TOTAL_S-2}:d=2"]
    else:
        maps += ["-an"]
    cmd += ["-filter_complex", graph] + maps + [
        "-c:v", "libx264", "-preset", "slow", "-crf", args.crf, "-profile:v", "high", "-level", "4.1",
        "-pix_fmt", "yuv420p", "-r", str(FPS), "-vsync", "cfr", "-t", f"{TOTAL_S}",
        "-movflags", "+faststart", str(args.out)]
    run(cmd)

    # 3) verify --------------------------------------------------------------
    info = video_info(args.out)
    ok = (info["frames"] == int(TOTAL_S * FPS) and info["width"] == WIDTH and info["height"] == HEIGHT
          and abs(info["fps"] - FPS) < 0.01 and info["codec"] == "h264")
    report = {"output": str(args.out), "placeholder_shots": used_placeholder,
              "is_ai_generated_content": not used_placeholder, "spec_ok": ok, **info}
    (OUTPUT / "assemble_report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    if used_placeholder:
        print(f"\nWARNING: {len(used_placeholder)} shot(s) are placeholder slates, not AI video: {', '.join(used_placeholder)}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
