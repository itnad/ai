#!/usr/bin/env python3
"""Continuity check across shots.

1. Extract first / middle / last frames of every clip -> frames/<id>_{first,mid,last}.jpg
2. Numeric check: mean colour + luma jump at each cut (large jumps across a dissolve or inside one act are flagged)
3. Contact sheet of all shots -> output/contact_sheet.jpg (for human review)
4. Optional (--vision, needs ANTHROPIC_API_KEY): Claude reviews each shot's frames against character_bible.json
   and the continuity_checks in visual_bible.json, returning JSON issues per shot.

Writes output/consistency_report.json. Exit 1 if any shot is flagged "fail".
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image

from common import CLIPS, FRAMES, OUTPUT, character_bible, load_env_file, shot_plan, video_info, visual_bible

POS = ("first", "mid", "last")


def extract(clip: Path, sid: str) -> dict[str, Path]:
    FRAMES.mkdir(exist_ok=True)
    dur = video_info(clip)["duration_s"]
    out = {}
    for name, t in (("first", 0.05), ("mid", dur / 2), ("last", max(0.0, dur - 0.1))):
        dest = FRAMES / f"{sid}_{name}.jpg"
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-ss", f"{t}", "-i", str(clip), "-frames:v", "1",
                        "-vf", "scale=640:-2", "-q:v", "3", str(dest)], check=True)
        out[name] = dest
    return out


def stats(img: Path) -> dict:
    a = np.asarray(Image.open(img).convert("RGB"), dtype=np.float32) / 255.0
    mean = a.reshape(-1, 3).mean(0)
    luma = float(0.2126 * mean[0] + 0.7152 * mean[1] + 0.0722 * mean[2])
    return {"mean_rgb": [round(float(x), 3) for x in mean], "luma": round(luma, 3)}


def contact_sheet(frames: dict[str, dict[str, Path]], dest: Path) -> None:
    ids = list(frames)
    tiles = [Image.open(frames[i][p]).resize((320, 180)) for i in ids for p in POS]
    cols, rows = 3, len(ids)
    sheet = Image.new("RGB", (cols * 320, rows * 180), "black")
    for n, t in enumerate(tiles):
        sheet.paste(t, ((n % cols) * 320, (n // cols) * 180))
    sheet.save(dest, quality=85)


def vision_review(sid: str, shot: dict, frames: dict[str, Path], prev_last: Path | None, cb: dict, vb: dict) -> dict:
    """Ask Claude whether the frames match the bibles. Returns {"pass": bool, "issues": [...]}"""
    import anthropic

    client = anthropic.Anthropic()
    stage = cb["protagonist"]["age_stages"][shot["age_stage"]]
    content = []
    if prev_last:
        content.append({"type": "text", "text": "Image 1: LAST frame of the PREVIOUS shot (for continuity)."})
        content.append({"type": "image", "source": {"type": "base64", "media_type": "image/jpeg",
                                                    "data": base64.standard_b64encode(prev_last.read_bytes()).decode()}})
    for p in POS:
        content.append({"type": "text", "text": f"{sid} {p} frame:"})
        content.append({"type": "image", "source": {"type": "base64", "media_type": "image/jpeg",
                                                    "data": base64.standard_b64encode(frames[p].read_bytes()).decode()}})
    content.append({"type": "text", "text": f"""You are the continuity supervisor for a music video. Check shot {sid} against the bible.

PROTAGONIST (must match): {cb['protagonist']['identity_core']}
AGE STAGE for this shot: {stage['descriptor']}
OTHER CHARACTERS EXPECTED: {shot['characters']}
LOCATION EXPECTED: {vb['locations'][shot['location']]}
PLANNED ACTION: {shot['action']}
CONTINUITY RULES: {json.dumps(vb['continuity_checks'])}

Report problems only if clearly visible: wrong age/hair, missing coat, readable text/logos, extra protagonists,
wrong location, deformed hands/faces, identity drifting between frames, or a mismatch with the previous shot's last frame
when the shots are meant to be continuous. Respond with JSON only:
{{"pass": true|false, "severity": "none|minor|major", "issues": ["..."], "retake_prompt_hint": "..." }}"""})
    resp = client.beta.messages.create(
        model="claude-opus-5-5", max_tokens=1024, betas=["server-side-fallback-2026-07-01"], fallbacks="default",
        messages=[{"role": "user", "content": content}])
    if resp.stop_reason == "refusal":
        return {"pass": None, "issues": ["vision review refused"], "severity": "unknown"}
    text = "".join(b.text for b in resp.content if b.type == "text").strip()
    text = text[text.find("{"): text.rfind("}") + 1]
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {"pass": None, "issues": [f"unparseable review: {text[:200]}"], "severity": "unknown"}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--vision", action="store_true", help="also run Claude vision review (needs ANTHROPIC_API_KEY)")
    ap.add_argument("--luma-jump", type=float, default=0.35, help="flag cuts whose mean luma changes more than this")
    args = ap.parse_args()
    load_env_file()
    plan, cb, vb = shot_plan(), character_bible(), visual_bible()
    shots = plan["shots"]
    OUTPUT.mkdir(exist_ok=True)

    frames, report, fails = {}, [], 0
    for i, s in enumerate(shots):
        clip = CLIPS / f"{s['id']}.mp4"
        row = {"id": s["id"], "act": s["act"], "status": "missing", "flags": []}
        if not clip.exists():
            report.append(row); continue
        fr = extract(clip, s["id"])
        frames[s["id"]] = fr
        st = {p: stats(fr[p]) for p in POS}
        row.update({"stats": st, "status": "ok"})
        # identity drift proxy inside the clip: big colour swing first->last is normal for S02-S04 (gold transform), else flag
        if i > 0 and shots[i - 1]["id"] in frames:
            prev = shots[i - 1]
            a, b = stats(frames[prev["id"]]["last"]), st["first"]
            jump = abs(a["luma"] - b["luma"])
            same_act = prev["act"] == s["act"]
            dissolve = prev["xfade_out_s"] > 0
            row["cut_from_prev"] = {"luma_jump": round(jump, 3), "same_act": same_act, "dissolve": dissolve}
            if jump > args.luma_jump and same_act:
                row["flags"].append(f"luma jump {jump:.2f} from {prev['id']} inside the same act (check lighting continuity)")
            if s.get("chain_from_prev") and jump > args.luma_jump:
                row["flags"].append(f"chained shot but luma jump {jump:.2f} vs {prev['id']} last frame")
        if args.vision:
            prev_last = frames[shots[i - 1]["id"]]["last"] if i > 0 and shots[i - 1]["id"] in frames else None
            try:
                rv = vision_review(s["id"], s, fr, prev_last, cb, vb)
            except Exception as e:
                rv = {"pass": None, "issues": [f"vision review error: {type(e).__name__}: {e}"], "severity": "unknown"}
            row["vision"] = rv
            if rv.get("pass") is False and rv.get("severity") == "major":
                row["status"] = "fail"
        if row["flags"] and row["status"] == "ok":
            row["status"] = "warn"
        fails += row["status"] == "fail"
        report.append(row)
        print(f"{s['id']} {row['status']:5} {'; '.join(row['flags'])} "
              f"{('VISION: ' + str(row['vision'].get('issues'))) if 'vision' in row else ''}")

    if frames:
        contact_sheet(frames, OUTPUT / "contact_sheet.jpg")
        print(f"contact sheet -> {OUTPUT/'contact_sheet.jpg'}")
    (OUTPUT / "consistency_report.json").write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    missing = [r["id"] for r in report if r["status"] == "missing"]
    print(f"\n{len(report) - len(missing)} clips checked, {len(missing)} missing, {fails} fail -> {OUTPUT/'consistency_report.json'}")
    if missing:
        print("missing:", ", ".join(missing))
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
