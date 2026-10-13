"""Construit le minutage du film : début de chaque ligne et de chaque mot, qui chante, battements,
enveloppe de voix pour la bouche des personnages.

Source des débuts de ligne, par ordre de préférence :
  1. analysis/taps.json (calage à la main avec anim/tapper.html) ;
  2. sinon, une estimation : grille de BEATS_PER_LINE temps par ligne depuis le début de chaque
     section (SECTION_BEATS, à relever sur les graphiques de core/analysis/plot.py et analysis/plot_vocals.py).

Sortie : anim/timing.js (module ES chargé par le film).
Usage : python3 films/<film>/analysis/timing.py
"""
import json
import re
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
FPS_FILM = 30

# Estimation : index (dans features.npz) du temps où commence la première ligne de chaque section.
SECTION_BEATS = {"intro": 0, "c1": 16}
BEATS_PER_LINE = 8
# Exceptions à la grille, en temps depuis le début de la section : {("v1", 7): 54}.
LINE_BEATS = {}
# Lignes parlées, hors grille : {("out", 0): (début, fin)} en secondes.
FIXED = {}
LINE_MAX = 4.2


def load_lyrics():
    src = (ROOT / "anim/lyrics.js").read_text()
    sections = []
    for m in re.finditer(r"\{ id: '(\w+)', label: '([^']*)', lines: \[(.*?)\] \}", src, re.S):
        lines = re.findall(r"""\{ who: '(\w+)', text: (['"])((?:\\.|(?!\2).)*)\2 \}""", m.group(3))
        sections.append((m.group(1), [(l[2].replace("\\'", "'"), l[0]) for l in lines]))
    return sections


def syllables(word):
    w = word.lower()
    w = re.sub(r"[^a-zàâäéèêëîïôöùûüÿœæç'-]", "", w)
    if not w:
        return 0
    groups = re.findall(r"[aeiouyàâäéèêëîïôöùûüÿœæ]+", w)
    n = len(groups)
    if n > 1 and re.search(r"[^aeiouyàâäéèêëîïôöùûüÿœæ]e?s?$", w) and w.endswith(("e", "es")):
        n -= 1
    return max(1, n)


def split_words(text):
    # La ponctuation isolée (« : », « ! », « » ») reste collée au mot précédent, les ouvrantes
    # (« « », « ... » en tête) au mot suivant, avec une espace insécable.
    words, pending = [], ""
    for tok in text.split():
        if re.search(r"\w", tok):
            words.append(pending + tok)
            pending = ""
        elif tok in ("«", "(") or not words:
            pending += tok + " "
        else:
            words[-1] += " " + tok
    if pending:
        words.append(pending.strip())
    return words


def main():
    feat = np.load(ROOT / "analysis/features.npz")
    voc = np.load(ROOT / "analysis/vocals.npz")
    beats = feat["beats"]
    env, vfps = voc["env_db"].astype(np.float64), float(voc["fps"])
    duration = float(feat["times"][-1])

    # Enveloppe de voix normalisée 0..1 (pour la bouche), lissage attaque rapide / relâche lente.
    lo, hi = np.percentile(env, 20), np.percentile(env, 99)
    e = np.clip((env - lo) / (hi - lo), 0, 1) ** 1.3
    n_film = int(duration * FPS_FILM) + 1
    idx = np.clip((np.arange(n_film) / FPS_FILM * vfps).astype(int), 0, len(e) - 1)
    raw = e[idx]
    mouth = np.zeros_like(raw)
    for i in range(1, len(raw)):
        a = 0.75 if raw[i] > mouth[i - 1] else 0.35
        mouth[i] = mouth[i - 1] + a * (raw[i] - mouth[i - 1])

    # Attaques vocales : montées rapides de l'enveloppe (pour caler les mots).
    d = np.diff(np.convolve(env, np.ones(3) / 3, mode="same"), prepend=env[0])
    onset_frames = [i for i in range(2, len(d) - 2) if d[i] > 1.2 and d[i] == d[i - 2:i + 3].max()]
    onsets = np.array(onset_frames) / vfps

    def snap(t, radius):
        if not len(onsets):
            return t
        j = np.argmin(np.abs(onsets - t))
        return float(onsets[j]) if abs(onsets[j] - t) <= radius else t

    # Grille de battements prolongée aux deux bouts, et conversion temps musical <-> secondes.
    p0, p1 = np.median(np.diff(beats[:20])), np.median(np.diff(beats[-20:]))
    ext = np.concatenate([beats[0] - p0 * np.arange(40, 0, -1), beats, beats[-1] + p1 * np.arange(1, 40)])
    b2t = lambda x: float(np.interp(x + 40, np.arange(len(ext)), ext))
    t2b = lambda t: float(np.interp(t, ext, np.arange(len(ext)))) - 40

    sections = load_lyrics()
    taps_path = ROOT / "analysis/taps.json"
    taps = json.loads(taps_path.read_text())["lines"] if taps_path.exists() else None
    tapped, skipped = {}, set()
    for tp in taps or []:
        key = (tp["section"], tp["index"])
        if tp.get("skipped"):
            skipped.add(key)
        elif tp.get("t") is not None:
            tapped[key] = float(tp["t"])
    source = "taps" if tapped else "estimate"

    def on_half_beat(t):
        # Un appui à moins de 80 ms d'un demi-temps est aimanté dessus.
        x = round(t2b(t) * 2) / 2
        return b2t(x) if abs(b2t(x) - t) < 0.08 else t

    starts = []  # (début, fin imposée ou None)
    prev_key, prev_beat = None, None
    for sid, lines in sections:
        for i, _ in enumerate(lines):
            key = (sid, i)
            if key in tapped:
                t0, fixed_end = on_half_beat(tapped[key]), None
            elif key in FIXED:
                t0, fixed_end = FIXED[key]
            else:
                if tapped and prev_key is not None and prev_key[0] == sid and prev_beat is not None:
                    x = prev_beat + BEATS_PER_LINE  # on suit le dernier appui de la section
                else:
                    x = SECTION_BEATS[sid] + LINE_BEATS.get(key, i * BEATS_PER_LINE)
                t0, fixed_end = b2t(x), None
            starts.append((t0, fixed_end))
            prev_key, prev_beat = key, t2b(t0)

    for k in range(1, len(starts)):
        if starts[k][0] <= starts[k - 1][0] + 0.3:
            print(f"  attention : ligne {k} ({starts[k][0]:.2f} s) trop proche ou avant la précédente ({starts[k - 1][0]:.2f} s)")

    out_lines = []
    k = 0
    for sid, lines in sections:
        for i, (text, who) in enumerate(lines):
            t0, fixed_end = starts[k]
            beat_len = b2t(t2b(t0) + 1) - t0
            if fixed_end is not None:
                t1 = fixed_end
            elif k + 1 < len(starts):
                t1 = min(starts[k + 1][0] - 0.05, t0 + LINE_MAX)
            else:
                t1 = min(duration, t0 + LINE_MAX + 0.4)  # le crochet final est tenu
            if k + 1 < len(starts):
                t1 = min(t1, starts[k + 1][0] - 0.05)
            words = split_words(text)

            # Répartition au prorata des syllabes, puis aimantation sur les attaques vocales.
            def spread(ws, a, b):
                syl = np.array([max(1, syllables(w)) for w in ws], float)
                cum = np.concatenate([[0], np.cumsum(syl)]) / syl.sum()
                out = []
                for j, w in enumerate(ws):
                    x = a + cum[j] * (b - a)
                    out.append({"w": w, "t0": round(x if j == 0 else snap(x, 0.12), 3)})
                return out

            # Ligne avec écho entre parenthèses : la phrase sur 4 temps, puis l'écho du chœur sur les 4 suivants.
            echo_at = next((j for j, w in enumerate(words) if w.startswith("(")), None)
            if echo_at:
                half = 4 * beat_len
                wt = spread(words[:echo_at], t0, t0 + half * 0.8) + spread(words[echo_at:], t0 + half, min(t1, t0 + half * 1.8))
            else:
                # Débit des couplets : environ 0,3 s par syllabe ; la fin de ligne est tenue.
                nsyl = sum(max(1, syllables(w)) for w in words)
                wt = spread(words, t0, t0 + min((t1 - t0) * 0.85, 0.3 * nsyl))
            for j in range(len(wt)):
                wt[j]["t1"] = round(wt[j + 1]["t0"] if j + 1 < len(wt) else t1, 3)
            line = {"section": sid, "index": i, "who": who, "text": text, "start": round(t0, 3), "end": round(t1, 3), "words": wt}
            if (sid, i) in skipped:
                line["skip"] = True
            out_lines.append(line)
            k += 1

    sec = {}
    for l in out_lines:
        s = sec.setdefault(l["section"], {"start": l["start"], "end": l["end"]})
        s["end"] = l["end"]

    data = {
        "source": source,
        "duration": round(duration, 3),
        "bpm": round(60 / float(np.median(np.diff(beats))), 2),
        "beats": [round(float(b), 3) for b in beats],
        "sections": sec,
        "lines": out_lines,
        "mouth": [round(float(m), 3) for m in mouth],
    }
    js = "// Généré par analysis/timing.py : ne pas modifier à la main.\nexport const TIMING = " + json.dumps(data, ensure_ascii=False) + ";\n"
    (ROOT / "anim/timing.js").write_text(js)
    print(f"source={source} lignes={len(out_lines)} bpm={data['bpm']} durée={data['duration']}")
    for sid, s in sec.items():
        print(f"  {sid:6s} {s['start']:7.2f} -> {s['end']:7.2f}")
    for l in out_lines:
        print(f"    {l['section']:5s} {l['index']}  {l['start']:7.2f}  {l['who']:8s} {l['text']}")


if __name__ == "__main__":
    main()
