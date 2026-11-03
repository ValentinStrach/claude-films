"""Planche contact des images de out/stills/ (les 9 plus récentes, ou celles passées en argument).

  python render/sheet.py [image.png ...] -> out/sheet.jpg
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
files = [Path(f) for f in sys.argv[1:]] or sorted((ROOT / "out/stills").glob("*.png"), key=lambda p: p.stat().st_mtime)[-9:]
W, H, COLS = 640, 360, 3
rows = (len(files) + COLS - 1) // COLS
sheet = Image.new("RGB", (COLS * W, rows * H), "white")
for i, f in enumerate(files):
    im = Image.open(f).convert("RGB").resize((W, H), Image.LANCZOS)
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, 150, 22], fill="red")
    d.text((5, 5), f.stem.split("_t_")[-1] + " s", fill="white")
    sheet.paste(im, ((i % COLS) * W, (i // COLS) * H))
out = ROOT / "out/sheet.jpg"
sheet.save(out, quality=88)
print(out)
