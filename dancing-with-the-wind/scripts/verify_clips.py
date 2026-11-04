#!/usr/bin/env python3
"""Check every generated clip: exists, decodes fully, long enough, resolution/fps.
Writes clips/verify_report.json. Exit 1 if any required clip is missing/invalid."""
from __future__ import annotations

import argparse
import json
import subprocess
import sys

from common import CLIPS, require_ffmpeg, shot_plan, video_info


def decodes_cleanly(path) -> tuple[bool, str]:
    r = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-f", "null", "-"],
                       capture_output=True, text=True)
    return (r.returncode == 0 and not r.stderr.strip()), r.stderr.strip()[:300]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--allow-missing", action="store_true")
    args = ap.parse_args()
    require_ffmpeg()
    plan = shot_plan()
    shots = plan["shots"]
    rows, bad = [], 0
    print(f"{'shot':5} {'status':8} {'dur':>6} {'need':>6} {'res':>10} {'fps':>6} {'frames':>6}  note")
    for i, s in enumerate(shots):
        p = CLIPS / f"{s['id']}.mp4"
        prev_x = shots[i - 1]["xfade_out_s"] if i else 0.0
        need = s["duration_s"] + prev_x
        row = {"id": s["id"], "path": str(p), "needed_s": need, "status": "missing", "issues": []}
        if not p.exists():
            rows.append(row)
            bad += 0 if args.allow_missing else 1
            print(f"{s['id']:5} {'MISSING':8} {'-':>6} {need:>6.2f}")
            continue
        try:
            info = video_info(p)
        except Exception as e:
            row["issues"].append(f"ffprobe failed: {e}")
            row["status"] = "corrupt"; bad += 1; rows.append(row)
            print(f"{s['id']:5} {'CORRUPT':8}  {e}")
            continue
        row.update(info)
        ok, err = decodes_cleanly(p)
        if not ok:
            row["issues"].append(f"decode errors: {err}")
        if info["duration_s"] + 0.05 < need:
            row["issues"].append(f"too short: {info['duration_s']}s < {need}s needed")
        if abs(info["width"] / info["height"] - 16 / 9) > 0.02:
            row["issues"].append(f"aspect {info['width']}x{info['height']} is not 16:9 (will be padded)")
        if info["height"] < 1080:
            row["issues"].append(f"height {info['height']} < 1080 (will be upscaled)")
        if abs(info["fps"] - 24) > 0.5:
            row["issues"].append(f"fps {info['fps']} != 24 (will be resampled)")
        hard = [x for x in row["issues"] if x.startswith(("decode", "too short"))]
        row["status"] = "fail" if hard else ("warn" if row["issues"] else "ok")
        bad += 1 if hard else 0
        rows.append(row)
        print(f"{s['id']:5} {row['status'].upper():8} {info['duration_s']:>6.2f} {need:>6.2f} "
              f"{str(info['width'])+'x'+str(info['height']):>10} {info['fps']:>6.2f} {info['frames']:>6}  {'; '.join(row['issues'])}")
    (CLIPS / "verify_report.json").write_text(json.dumps(rows, indent=2), encoding="utf-8")
    print(f"\n{len(rows)} shots checked, {bad} blocking problems -> {CLIPS/'verify_report.json'}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
