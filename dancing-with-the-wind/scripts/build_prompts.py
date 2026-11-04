#!/usr/bin/env python3
"""Compose the English generation prompt for every shot from shot_plan + bibles.
Writes prompts/<id>.txt and prompts/prompts.json."""
from __future__ import annotations

import json

from common import PROMPTS, character_bible, shot_plan, validate_plan, visual_bible


def describe_characters(shot: dict, cb: dict) -> list[str]:
    parts = []
    prot = cb["protagonist"]
    stage = prot["age_stages"][shot["age_stage"]]
    for c in shot["characters"]:
        if c == "protagonist":
            parts.append(f"The protagonist: {prot['identity_core']}; {stage['descriptor']}.")
            continue
        name, _, form = c.partition(":")
        sup = cb["supporting"][name]
        text = sup["identity_core"]
        if form and form in sup:
            text += f"; {sup[form]}"
        elif name == "the_woman":
            text += f"; {sup['ideal_form']}"
        parts.append(f"Also present: {text}.")
    return parts


def build(shot: dict, cb: dict, vb: dict) -> dict:
    act = vb["acts"][shot["act"]]
    loc = vb["locations"][shot["location"]]
    lines = [vb["style_prefix"]]
    lines += describe_characters(shot, cb)
    lines.append(f"Setting: {loc}.")
    lines.append(f"Camera: {shot['camera']}.")
    lines.append(f"Action: {shot['action']}")
    lines.append(f"Mood: {shot['mood']}. Color palette: {act['palette']}. Lighting: {act['lighting']}.")
    lines.append("Wind visibly moves his hair, the hem of his coat and loose debris throughout the shot.")
    lines.append(vb["style_suffix"])
    prompt = " ".join(lines)
    return {
        "id": shot["id"],
        "duration_s": shot["duration_s"],
        "gen_duration_s": shot["gen_duration_s"],
        "aspect_ratio": vb["format"]["aspect_ratio"],
        "age_stage": shot["age_stage"],
        "location": shot["location"],
        "chain_from_prev": shot.get("chain_from_prev", False),
        "prompt": prompt,
        "negative_prompt": vb["negative_prompt"],
    }


def main() -> None:
    plan, cb, vb = shot_plan(), character_bible(), visual_bible()
    validate_plan(plan)
    PROMPTS.mkdir(exist_ok=True)
    out = []
    for shot in plan["shots"]:
        p = build(shot, cb, vb)
        (PROMPTS / f"{p['id']}.txt").write_text(p["prompt"] + "\n\nNEGATIVE: " + p["negative_prompt"] + "\n", encoding="utf-8")
        out.append(p)
    (PROMPTS / "prompts.json").write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
    for p in out:
        print(f"{p['id']}  {p['duration_s']:>4}s  gen {p['gen_duration_s']}s  {len(p['prompt'].split())} words")
    print(f"wrote {len(out)} prompts to {PROMPTS}")


if __name__ == "__main__":
    main()
