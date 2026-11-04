#!/usr/bin/env python3
"""Estimate generation cost per provider for the shot plan.
Prices are list prices found on 2026-11-04; verify on each provider's pricing page before approving."""
from __future__ import annotations

import argparse

from common import shot_plan

# USD per second of generated video (per clip second, 16:9). source + date in README.
PRICES = {
    "veo-3.1 (1080p)":        {"usd_per_s": 0.40, "clip_s": 8, "note": "Gemini API, ai.google.dev pricing, audio included"},
    "veo-3.1-fast (1080p)":   {"usd_per_s": 0.12, "clip_s": 8, "note": "Gemini API"},
    "veo-3.1-lite (1080p)":   {"usd_per_s": 0.08, "clip_s": 8, "note": "Gemini API, lowest quality tier"},
    "runway gen4_turbo (720p)": {"usd_per_s": 0.05, "clip_s": 10, "note": "5 credits/s x $0.01; image-to-video only; 720p -> upscale needed"},
    "kling 2.5 turbo pro (fal)": {"usd_per_s": 0.07, "clip_s": 10, "note": "fal.ai $0.35/5s + $0.07/s; 1080p"},
    "sora-2-pro (1080p)":     {"usd_per_s": 0.70, "clip_s": 8, "note": "OpenAI; API availability unverified as of 2026-11"},
}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--retake-factor", type=float, default=1.5,
                    help="expected generations per shot incl. retakes (1.0 = no retakes)")
    args = ap.parse_args()
    shots = shot_plan()["shots"]
    n = len(shots)
    print(f"shots: {n}   retake factor: {args.retake_factor}\n")
    print(f"{'model':30} {'$/s':>6} {'clip':>5} {'1 pass':>9} {'with retakes':>13}  note")
    for name, p in PRICES.items():
        clip_s = p["clip_s"]
        one = n * clip_s * p["usd_per_s"]
        print(f"{name:30} {p['usd_per_s']:>6.2f} {clip_s:>4}s {one:>9.2f} {one*args.retake_factor:>13.2f}  {p['note']}")
    print("\nAll prices USD list price as of 2026-11-04 (web sources, not verified against live pricing pages).")


if __name__ == "__main__":
    main()
