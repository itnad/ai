#!/usr/bin/env python3
"""Report which video-generation providers are usable and whether FFmpeg is present.
Never prints credential values."""
from __future__ import annotations

import importlib
import json
import shutil
import subprocess
import sys

from common import PROVIDER_KEYS, has_key, load_env_file


def main() -> int:
    load_env_file()
    report = {"ffmpeg": None, "ffprobe": None, "providers": {}, "python_libs": {}}
    for tool in ("ffmpeg", "ffprobe"):
        p = shutil.which(tool)
        ver = None
        if p:
            ver = subprocess.run([tool, "-version"], capture_output=True, text=True).stdout.splitlines()[0]
        report[tool] = {"path": p, "version": ver}
    libs = {"veo": "google.genai", "runway": "requests", "fal_kling": "fal_client",
            "replicate": "replicate", "vision_review": "anthropic"}
    for k, mod in libs.items():
        try:
            importlib.import_module(mod)
            report["python_libs"][mod] = True
        except Exception:
            report["python_libs"][mod] = False
    usable = []
    for prov, (env, label) in PROVIDER_KEYS.items():
        ok = has_key(prov)
        report["providers"][prov] = {"label": label, "env_var": env, "key_present": ok,
                                     "sdk_installed": report["python_libs"].get(libs[prov], False)}
        if ok:
            usable.append(prov)
    report["usable_providers"] = usable
    print(json.dumps(report, indent=2, ensure_ascii=False))
    if not report["ffmpeg"]["path"]:
        print("ERROR: ffmpeg missing", file=sys.stderr)
        return 2
    if not usable:
        print("\nNO VIDEO GENERATION PROVIDER AVAILABLE: set one of "
              + ", ".join(v[0] for v in PROVIDER_KEYS.values()) + " in .env", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
