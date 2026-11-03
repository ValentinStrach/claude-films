"""Place les répliques de la voix off dans le temps et en déduit le minutage du film.

Entrées : script/narration.json, audio/voice/*.wav (audio/tts.py build).
Sorties : anim/timing.js (minutage des scènes et des répliques, généré : ne pas éditer),
          audio/voice.wav (piste voix complète), out/film.srt (sous-titres du film seul).
Une réplique sans fichier audio reçoit une durée estimée (2,7 mots/s) : le film reste rendable sans voix.
"""
import json
import sys
import wave
from pathlib import Path

import numpy as np

from tts import clip

ROOT = Path(__file__).resolve().parent.parent
SR = 48000
SILENCE = 10 ** (-45 / 20)
MARGIN = int(0.04 * SR)


def voiced_span(x):
    """Début et fin de la parole, en écartant les bruits brefs (claquements, souffles) isolés par un silence."""
    hop = SR // 100
    n = len(x) // hop
    rms = np.sqrt((x[: n * hop].reshape(n, hop) ** 2).mean(axis=1))
    on = np.flatnonzero(rms > SILENCE)
    if not len(on):
        return 0, len(x)
    # Segments séparés de plus de 0,3 s de silence. Un segment de bord est un bruit s'il dure moins
    # de 0,25 s, ou moins de 0,6 s en étant 6 dB plus faible que la voix.
    segs = [(seg[0], seg[-1] + 1) for seg in np.split(on, np.flatnonzero(np.diff(on) > 30) + 1)]
    level = lambda sg: 20 * np.log10(rms[sg[0]:sg[1]].mean() + 1e-9)
    voice = 20 * np.log10(rms[on].mean())
    noise = lambda sg: sg[1] - sg[0] < 25 or (sg[1] - sg[0] < 60 and level(sg) < voice - 6)
    while len(segs) > 1 and noise(segs[0]):
        segs.pop(0)
    while len(segs) > 1 and noise(segs[-1]):
        segs.pop()
    return segs[0][0] * hop, segs[-1][1] * hop


def read_trimmed(path):
    """Échantillons float de la réplique, sans les silences ni les bruits isolés de début et de fin."""
    with wave.open(str(path), "rb") as w:
        assert w.getframerate() == SR and w.getnchannels() == 1 and w.getsampwidth() == 2
        x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    a, b = voiced_span(x)
    return x[max(0, a - MARGIN): b + MARGIN]


def srt_time(t):
    ms = int(round(t * 1000))
    return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    script = json.loads((ROOT / "script/narration.json").read_text(encoding="utf-8"))
    d = script["timing"]
    t = 0.0
    scenes, clips, subs = [], [], []
    for sc in script["scenes"]:
        t0 = t
        t += sc.get("lead", d["lead"])
        cues = []
        for i, line in enumerate(sc["lines"]):
            if i:
                t += line.get("gap", d["gap"])
            f = clip(script, sc, i)[1]
            if f.exists():
                x = read_trimmed(f)
                dur = len(x) / SR
                clips.append((t, x))
            else:
                dur = len(line["text"].split()) / 2.7
            cues.append({"t": round(t - t0, 3), "d": round(dur, 3), "v": line["v"], "text": line["text"]})
            subs.append((t, t + dur, line["text"]))
            t += dur
        t += sc.get("tail", d["tail"])
        scenes.append({"id": sc["id"], "t0": round(t0, 3), "t1": round(t, 3), "cues": cues})

    total = round(t, 3)
    js = ("// Généré par audio/timing.py depuis script/narration.json : ne pas éditer à la main.\n"
          f"export const DURATION = {total};\n"
          f"export const SCENES = {json.dumps(scenes, ensure_ascii=False, indent=1)};\n")
    (ROOT / "anim/timing.js").write_text(js, encoding="utf-8")

    track = np.zeros(int(total * SR) + 1, dtype=np.float32)
    for start, x in clips:
        i = int(start * SR)
        track[i:i + len(x)] += x[: len(track) - i]
    with wave.open(str(ROOT / "audio/voice.wav"), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(track, -1, 1) * 32767).astype(np.int16).tobytes())

    (ROOT / "out").mkdir(exist_ok=True)
    srt = "\n".join(f"{k + 1}\n{srt_time(a)} --> {srt_time(b)}\n{txt}\n" for k, (a, b, txt) in enumerate(subs))
    (ROOT / "out/film.srt").write_text(srt, encoding="utf-8")
    missing = sum(len(s["lines"]) for s in script["scenes"]) - len(clips)
    print(f"{len(scenes)} scènes, {total:.1f} s" + (f", {missing} réplique(s) estimée(s)" if missing else ""))
    for s in scenes:
        print(f"  {s['id']:<13} {s['t0']:7.1f} -> {s['t1']:7.1f}  ({s['t1'] - s['t0']:.1f} s)")


if __name__ == "__main__":
    main()
