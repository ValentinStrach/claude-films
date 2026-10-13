"""Planche de lecture de la voix isolée : spectrogramme log-fréquence (au-dessus de 200 Hz),
enveloppe de voix, battements numérotés (b24 = 24e temps de features.npz) et, en rouge, les
débuts de ligne de anim/timing.js s'il existe.

Usage : python3 films/<film>/analysis/plot_vocals.py debut fin sortie.png [secondes_par_ligne]
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import uniform_filter1d

ROOT = Path(__file__).resolve().parent.parent
v = np.load(ROOT / "analysis/vocals.npz")
f = np.load(ROOT / "analysis/features.npz")
logspec, fps = v["logspec"].astype(np.float32)[20:], float(v["fps"])
env = uniform_filter1d(v["env_db"].astype(np.float64), 4)
beats = f["beats"]
starts = []
tj = ROOT / "anim/timing.js"
if tj.exists():
    s = tj.read_text(encoding="utf-8")
    starts = [l["start"] for l in json.loads(s[s.index("{"):s.rstrip().rindex(";")])["lines"]]

t0, t1, out = float(sys.argv[1]), float(sys.argv[2]), sys.argv[3]
ROW_S = float(sys.argv[4]) if len(sys.argv) > 4 else 10.0
PX = int(900 / ROW_S)
SPEC_H, CURVE_H, GAP = 170, 90, 26
rows = int(np.ceil((t1 - t0) / ROW_S))
img = Image.new("RGB", (int(ROW_S * PX) + 40, rows * (SPEC_H + CURVE_H + GAP) + 10), "white")
d = ImageDraw.Draw(img)
vmax = np.percentile(logspec, 99.5)
for r in range(rows):
    a = t0 + r * ROW_S
    b = min(t1, a + ROW_S)
    y0 = r * (SPEC_H + CURVE_H + GAP) + 5
    i0, i1 = int(a * fps), int(b * fps)
    w = int((b - a) * PX)
    g = np.clip(logspec[:, i0:i1] / vmax, 0, 1)[::-1]
    img.paste(Image.fromarray((255 * (1 - g) ** 1.3).astype(np.uint8)).resize((w, SPEC_H)), (20, y0))
    cy = y0 + SPEC_H
    top = np.percentile(env[max(0, i0 - 500):i1 + 500], 98)
    pts = []
    for x in range(w):
        e = max(-30.0, env[min(int((a + x / PX) * fps), len(env) - 1)] - top)
        pts.append((20 + x, cy + CURVE_H - (e + 30) / 30 * CURVE_H))
    d.line(pts, fill=(200, 30, 30), width=2)
    for k, bt in enumerate(beats):
        if a <= bt < b:
            x = 20 + (bt - a) * PX
            d.line([(x, cy + CURVE_H - 10), (x, cy + CURVE_H)], fill=(40, 40, 40), width=1)
            if k % 4 == 0:
                d.text((x + 1, cy + CURVE_H - 22), f"b{k}", fill=(0, 120, 0))
    for st in starts:
        if a <= st < b:
            x = 20 + (st - a) * PX
            d.line([(x, y0), (x, cy + CURVE_H)], fill=(255, 0, 0), width=2)
    s = np.ceil(a)
    while s < b:
        x = 20 + (s - a) * PX
        d.line([(x, y0), (x, y0 + 8)], fill=(0, 90, 255), width=1)
        d.text((x + 2, cy + CURVE_H + 2), f"{int(s)}", fill=(0, 0, 0))
        s += 1
(ROOT / out).parent.mkdir(parents=True, exist_ok=True)
img.save(ROOT / out)
print(ROOT / out)
