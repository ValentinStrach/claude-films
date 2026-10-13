"""Vue d'ensemble visuelle (Pillow) : spectrogramme vocal + courbe de voix + battements.

Une bande de 30 s par ligne, graduée à la seconde.
Usage : python3 core/analysis/plot.py <film> debut fin sortie.png (sortie relative au dossier du film)
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

# <film> : nom (films/<nom>/ du dépôt) ou chemin vers le dossier du film, comme core/render/render.mjs.
ROOT = Path(sys.argv[1]).resolve() if ("/" in sys.argv[1] or "\\" in sys.argv[1] or sys.argv[1].startswith(".")) \
    else Path(__file__).resolve().parents[2] / "films" / sys.argv[1]
f = np.load(ROOT / "analysis/features.npz")
times, voc, rms, beats = f["times"], f["voc_db"], f["rms_db"], f["beats"]
vs = f["vocspec"].astype(np.float32)
fps = float(f["fps"])

t0, t1, out = float(sys.argv[2]), float(sys.argv[3]), sys.argv[4]
PX_PER_S = 60
ROW_S = 30
SPEC_H, CURVE_H, GAP = 110, 90, 26
rows = int(np.ceil((t1 - t0) / ROW_S))
img = Image.new("RGB", (ROW_S * PX_PER_S + 40, rows * (SPEC_H + CURVE_H + GAP) + 10), "white")
d = ImageDraw.Draw(img)
vmax = np.percentile(vs, 99.5)
vtop = voc.max()

for r in range(rows):
    a = t0 + r * ROW_S
    b = min(t1, a + ROW_S)
    y0 = r * (SPEC_H + CURVE_H + GAP) + 5
    i0, i1 = int(a * fps), int(b * fps)
    block = vs[:, i0:i1]
    if block.shape[1] == 0:
        continue
    g = np.clip(block / vmax, 0, 1)[::-1]
    w = int((b - a) * PX_PER_S)
    spec_img = Image.fromarray((255 * (1 - g)).astype(np.uint8)).resize((w, SPEC_H))
    img.paste(spec_img, (20, y0))
    cy = y0 + SPEC_H
    pts = []
    for x in range(w):
        ti = int((a + x / PX_PER_S) * fps)
        v = max(-40.0, voc[min(ti, len(voc) - 1)] - vtop)
        pts.append((20 + x, cy + CURVE_H - (v + 40) / 40 * CURVE_H))
    d.line(pts, fill=(200, 30, 30), width=1)
    for bt in beats[(beats >= a) & (beats < b)]:
        x = 20 + (bt - a) * PX_PER_S
        d.line([(x, cy + CURVE_H - 12), (x, cy + CURVE_H)], fill=(60, 60, 60), width=1)
    for s in range(int(np.ceil(a)), int(b) + 1):
        x = 20 + (s - a) * PX_PER_S
        d.line([(x, y0), (x, cy + CURVE_H)], fill=(120, 170, 255) if s % 5 else (0, 90, 255), width=1)
        if s % 1 == 0:
            d.text((x + 2, cy + CURVE_H + 2), str(s), fill=(0, 0, 0))
(ROOT / out).parent.mkdir(parents=True, exist_ok=True)
img.save(ROOT / out)
print(ROOT / out)
