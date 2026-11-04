#!/usr/bin/env python3
"""Inline src/*.js into src/template.html -> dancing_with_the_wind_anime.html"""
from pathlib import Path
root = Path(__file__).resolve().parent
js = "\n".join(p.read_text(encoding="utf-8") for p in sorted((root / "src").glob("*.js")))
html = (root / "src" / "template.html").read_text(encoding="utf-8").replace("/*__JS__*/", js)
out = root / "dancing_with_the_wind_anime.html"
out.write_text(html, encoding="utf-8")
print(f"{out.name}: {len(html)/1024:.1f} KiB")
