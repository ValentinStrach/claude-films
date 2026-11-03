"""Voix off du film : synthèse locale Piper, ou voix enregistrées à la main.

Chaque voix de script/narration.json a soit un modèle Piper ("model" : chemin d'un .onnx, relatif au film),
soit "record": true. Une réplique synthétisée est mise en cache sous le hash de ce qui est prononcé ;
une réplique enregistrée se dépose dans audio/record/<scène>-<n>.<wav|mp3|m4a|...> (n à partir de 1).

  python audio/tts.py build    -> audio/voice/*.wav (48 kHz mono) : synthèse des répliques Piper modifiées,
                                  conversion des enregistrements de audio/record/
  python audio/tts.py todo     -> répliques sans voix, avec le fichier attendu et le texte à dire
  python audio/tts.py sample M -> audio/samples/<modèle>.wav, une même phrase pour comparer des modèles Piper
"""
import hashlib
import importlib.util
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SAMPLE = "Bonjour, et bienvenue. Cette phrase sert à comparer les voix : le vif zéphyr jubile sur les kumquats du clown gracieux."


def to_wav48(src, out):
    """Convertit n'importe quel fichier audio en WAV 48 kHz mono 16 bits (format attendu par timing.py)."""
    out.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-ar", "48000", "-ac", "1", "-sample_fmt", "s16", str(out)], check=True)


def piper(text, model, out):
    if not importlib.util.find_spec("piper"):
        sys.exit("Piper absent de ce Python : uv pip install -p <framework>/.venv piper-tts")
    with tempfile.TemporaryDirectory() as tmp:
        raw = Path(tmp, "raw.wav")
        # PYTHONUTF8 : sous Windows, Piper lirait sinon l'entrée en cp1252 et épellerait les lettres accentuées.
        r = subprocess.run([sys.executable, "-m", "piper", "-m", str(ROOT / model), "-f", str(raw)],
                           input=text.encode("utf-8"), stdout=subprocess.DEVNULL, stderr=subprocess.PIPE,
                           env={**os.environ, "PYTHONUTF8": "1"})
        if r.returncode:
            sys.exit(f"Piper a échoué ({model}) : {r.stderr.decode('utf-8', 'replace').strip()[-400:]}")
        to_wav48(raw, out)


def clip(script, scene, i):
    """Texte prononcé et fichier de voix de la réplique i (0..) d'une scène.

    Texte prononcé : « say » de la réplique, sinon son texte, puis le lexique « say » du script.
    « take » (entier) force une nouvelle prise du même texte en synthèse.
    """
    line = scene["lines"][i]
    cast = script["voices"][line["v"]]
    spoken = line.get("say", line["text"])
    for word, sound in script.get("say", {}).items():
        spoken = spoken.replace(word, sound)
    if cast.get("record"):
        return spoken, ROOT / "audio/voice" / f"{scene['id']}-{i + 1}.wav"
    take = f"|{line['take']}" if line.get("take") else ""
    h = hashlib.sha1(f"{cast['model']}|{spoken}{take}".encode("utf-8")).hexdigest()[:12]
    return spoken, ROOT / "audio/voice" / f"{h}.wav"


def lines(script):
    for scene in script["scenes"]:
        for i, line in enumerate(scene["lines"]):
            yield scene, i, line, script["voices"][line["v"]]


def build(script):
    """Seules les répliques modifiées sont refaites ; un enregistrement plus récent que sa conversion la remplace."""
    n = 0
    for scene, i, line, cast in lines(script):
        spoken, out = clip(script, scene, i)
        if cast.get("record"):
            src = sorted((ROOT / "audio/record").glob(f"{scene['id']}-{i + 1}.*"))
            if src and (not out.exists() or src[0].stat().st_mtime > out.stat().st_mtime):
                to_wav48(src[0], out)
                n += 1
                print(f"{scene['id']}-{i + 1}: {src[0].name}")
        elif not out.exists():
            piper(spoken, cast["model"], out)
            n += 1
            print(f"{scene['id']}-{i + 1}: {spoken[:60]}")
    print(f"{n} réplique(s) produite(s)")
    todo(script, quiet=True)


def todo(script, quiet=False):
    missing = [(s, i, line, c) for s, i, line, c in lines(script) if not clip(script, s, i)[1].exists()]
    for scene, i, line, cast in missing:
        if not quiet:
            where = f"audio/record/{scene['id']}-{i + 1}.wav" if cast.get("record") else f"Piper ({cast['model']})"
            print(f"{where}\n  {line['text']}")
    print(f"{len(missing)} réplique(s) sans voix (durée estimée par timing.py)" if missing else "toutes les répliques ont leur voix")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd in ("build", "todo"):
        script = json.loads((ROOT / "script/narration.json").read_text(encoding="utf-8"))
        build(script) if cmd == "build" else todo(script)
    elif cmd == "sample" and len(sys.argv) > 2:
        for m in sys.argv[2:]:
            out = ROOT / "audio/samples" / f"{Path(m).stem}.wav"
            piper(SAMPLE, m, out)
            print(out)
    else:
        sys.exit(__doc__)
