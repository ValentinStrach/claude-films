"""Extrait d'une présentation PowerPoint le texte, les notes, les images et un rendu de chaque slide.

  python tools/slides.py source/deck.pptx [--no-png]

Sorties (dans source/, jamais versionné) :
  slides.txt          texte de chaque slide dans l'ordre de la présentation, notes et images référencées
  media/              images embarquées (pictos, illustrations, captures), sous leur nom d'origine
  slides_png/sNN.png  rendu de chaque slide, si LibreOffice (soffice) et pdftoppm (Poppler) sont installés
"""
import os
import posixpath
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parent.parent
NS = {
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "p": "http://schemas.openxmlformats.org/presentationml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "rel": "http://schemas.openxmlformats.org/package/2006/relationships",
}
SOFFICE = ["C:/Program Files/LibreOffice/program/soffice.exe", "/Applications/LibreOffice.app/Contents/MacOS/soffice"]


def rels(z, part):
    """Relations d'une partie du paquet : {rId: (type court, chemin cible dans le zip)}."""
    d, name = posixpath.split(part)
    path = posixpath.join(d, "_rels", name + ".rels")
    if path not in z.namelist():
        return {}
    out = {}
    for r in ET.fromstring(z.read(path)).findall("rel:Relationship", NS):
        if r.get("TargetMode") == "External":
            continue
        out[r.get("Id")] = (r.get("Type").rsplit("/", 1)[-1], posixpath.normpath(posixpath.join(d, r.get("Target"))))
    return out


def paragraphs(root, skip_placeholders=()):
    """Texte de chaque paragraphe (a:p), dans l'ordre du document ; formes à espace réservé ignoré écartées."""
    out = []
    for sp in root.iter(f"{{{NS['p']}}}sp"):
        ph = sp.find(".//p:nvPr/p:ph", NS)
        if ph is not None and ph.get("type") in skip_placeholders:
            continue
        for para in sp.iter(f"{{{NS['a']}}}p"):
            text = "".join(t.text or "" for t in para.iter(f"{{{NS['a']}}}t")).strip()
            if text:
                out.append(text)
    # Tableaux et groupes hors p:sp (graphicFrame) : leurs paragraphes sont lus à part.
    for gf in root.iter(f"{{{NS['p']}}}graphicFrame"):
        for para in gf.iter(f"{{{NS['a']}}}p"):
            text = "".join(t.text or "" for t in para.iter(f"{{{NS['a']}}}t")).strip()
            if text:
                out.append(text)
    return out


def find_soffice():
    return os.environ.get("SOFFICE") or shutil.which("soffice") or next((p for p in SOFFICE if Path(p).exists()), None)


def render_png(pptx, out_dir):
    soffice, pdftoppm = find_soffice(), shutil.which("pdftoppm")
    if not soffice or not pdftoppm:
        print("rendu PNG ignoré : soffice (LibreOffice, ou variable SOFFICE) et pdftoppm (Poppler) sont nécessaires")
        return
    with tempfile.TemporaryDirectory() as tmp:
        # Profil LibreOffice temporaire : la conversion marche même si LibreOffice est déjà ouvert.
        profile = Path(tmp, "profile").as_uri()
        subprocess.run([soffice, f"-env:UserInstallation={profile}", "--headless", "--convert-to", "pdf", "--outdir", tmp, str(pptx)],
                       check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        pdf = Path(tmp, pptx.stem + ".pdf")
        subprocess.run([pdftoppm, "-png", "-scale-to-x", "1920", "-scale-to-y", "-1", str(pdf), str(Path(tmp, "s"))], check=True)
        out_dir.mkdir(parents=True, exist_ok=True)
        pages = sorted(Path(tmp).glob("s-*.png"), key=lambda p: int(p.stem.split("-")[-1]))
        for i, page in enumerate(pages, 1):
            shutil.move(page, out_dir / f"s{i:02d}.png")
        print(f"{len(pages)} slide(s) rendue(s) dans {out_dir}")


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if len(args) != 1:
        sys.exit(__doc__)
    pptx = Path(args[0]).resolve()
    src = ROOT / "source"
    media = src / "media"
    media.mkdir(parents=True, exist_ok=True)
    lines, copied = [], set()
    with zipfile.ZipFile(pptx) as z:
        pres = "ppt/presentation.xml"
        prels = rels(z, pres)
        ids = ET.fromstring(z.read(pres)).findall("p:sldIdLst/p:sldId", NS)
        for n, sid in enumerate(ids, 1):
            part = prels[sid.get(f"{{{NS['r']}}}id")][1]
            root = ET.fromstring(z.read(part))
            hidden = " (masquée)" if root.get("show") == "0" else ""
            lines.append(f"===== SLIDE {n}{hidden} =====")
            lines += [f"  {t}" for t in paragraphs(root)]
            for kind, target in rels(z, part).values():
                if kind == "image" and target in z.namelist():
                    name = posixpath.basename(target)
                    if name not in copied:
                        (media / name).write_bytes(z.read(target))
                        copied.add(name)
                    lines.append(f"  [image] media/{name}")
                elif kind == "notesSlide":
                    notes = paragraphs(ET.fromstring(z.read(target)), skip_placeholders=("sldNum", "sldImg", "hdr", "ftr", "dt"))
                    lines += [f"  [notes] {t}" for t in notes]
            lines.append("")
    (src / "slides.txt").write_text("\n".join(lines), encoding="utf-8")
    print(f"{len(ids)} slide(s), {len(copied)} image(s) -> {src / 'slides.txt'}, {media}")
    if "--no-png" not in sys.argv:
        render_png(pptx, src / "slides_png")


if __name__ == "__main__":
    main()
