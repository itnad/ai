#!/usr/bin/env python3
"""montage PNGs in a dir into a labelled grid: sheet.py <dir> <out.png> [cols]"""
import sys, glob, os
from PIL import Image, ImageDraw
d, out = sys.argv[1], sys.argv[2]
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 2
files = sorted(glob.glob(os.path.join(d, "f*.png")))
ims = [Image.open(f).convert("RGB") for f in files]
w, h = ims[0].size
rows = (len(ims) + cols - 1) // cols
sheet = Image.new("RGB", (cols * w, rows * h), "black")
dr = ImageDraw.Draw(sheet)
for i, (f, im) in enumerate(zip(files, ims)):
    x, y = (i % cols) * w, (i // cols) * h
    sheet.paste(im, (x, y))
    fr = int(os.path.basename(f)[1:5])
    dr.rectangle([x, y, x + 90, y + 22], fill="black")
    dr.text((x + 4, y + 4), f"{fr/24:.2f}s", fill="white")
sheet.save(out)
print(out, sheet.size)
