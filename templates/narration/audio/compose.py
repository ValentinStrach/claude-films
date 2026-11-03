"""Musique de fond, synthétisée en numpy sans échantillon : fa majeur, 96 BPM (mesure de 2,5 s).

Sections : chaque scène de script/narration.json qui porte "music" ouvre une section de ce rôle, calée sur son
début (anim/timing.js) arrondi à la mesure. Rôles : open (nappe et clochettes), title (groove et mélodie),
panel (montée vers un panneau de chapitre, groove suspendu), body (groove léger sous la voix), end (cadence
finale tenue). Sortie : audio/music.wav (48 kHz, stéréo, 16 bits), de la durée du film.
"""
import json
import sys
import wave
from pathlib import Path

import numpy as np
from scipy.signal import lfilter, oaconvolve

ROOT = Path(__file__).resolve().parent.parent
SR = 48000
BPM = 96
BEAT = 60 / BPM
BAR = 4 * BEAT
TABLE = 2048

_js = (ROOT / "anim/timing.js").read_text(encoding="utf-8")
DURATION = float(_js.split("DURATION =", 1)[1].split(";", 1)[0])
SCENES = {s["id"]: s for s in json.loads(_js.split("SCENES = ", 1)[1].strip().rstrip(";"))}
N = int(round(DURATION * SR))
LAST = max(1, int(DURATION / BAR - 1.5))  # accord final : au moins une mesure et demie de résonance

_script = json.loads((ROOT / "script/narration.json").read_text(encoding="utf-8"))
SECTIONS = [(s["id"], s["music"]) for s in _script["scenes"] if s.get("music")]
if not SECTIONS or SECTIONS[0][0] != _script["scenes"][0]["id"]:
    SECTIONS.insert(0, (_script["scenes"][0]["id"], "open"))

sys.stdout.reconfigure(encoding="utf-8")
rng = np.random.default_rng(7)

# Accord : (basse, nappe) en MIDI, voix menées autour de la 4.
CH = {
    "F": (41, [57, 60, 65]), "F/A": (45, [57, 60, 65]), "C": (48, [55, 60, 64]), "Dm7": (50, [57, 60, 65]),
    "Bb": (46, [58, 62, 65]), "Bbmaj7": (46, [57, 62, 65]), "Gm7": (43, [58, 62, 65]), "Am7": (45, [55, 60, 64]),
}
PROG = {
    "open": ["F", "Am7", "Bbmaj7", "C"], "title": ["F", "Dm7", "Bb", "C"], "panel": ["Bbmaj7", "Am7", "Gm7", "C"],
    "body": ["F", "Bbmaj7", "Dm7", "C"], "end": ["Bb", "C", "Am7", "Dm7", "Gm7", "C", "F"],
}
BACKWARD = {"open", "panel", "end"}  # progression calée sur la fin de section : la suite part de la tonique
# Par mesure : (temps, note MIDI, durée en temps).
MELODY = {
    "title": [
        [(0, 72, .5), (.5, 77, .5), (1, 76, 1), (2, 74, 1), (3, 72, 1)],
        [(0, 74, 1.5), (1.5, 72, .5), (2, 69, 2)],
        [(0, 70, .5), (.5, 74, .5), (1, 77, 1.5), (2.5, 74, .5), (3, 74, 1)],
        [(0, 72, 2), (2, 76, 1), (3, 79, 1)],
        [(0, 81, 1), (1, 79, .5), (1.5, 77, .5), (2, 72, 2)],
        [(0, 74, .5), (.5, 77, .5), (1, 81, 1.5), (2.5, 79, .5), (3, 77, 1)],
        [(0, 77, 1), (1, 74, 1), (2, 70, 1.5), (3.5, 72, .5)],
        [(0, 74, 1), (1, 76, 1), (2, 79, 2)],
    ],
    "body": [
        [(0, 72, 2), (2, 69, 1), (3, 72, 1)],
        [(0, 74, 1.5), (1.5, 77, .5), (2, 74, 2)],
        [(0, 77, 1), (1, 74, 1), (2, 72, 1.5), (3.5, 69, .5)],
        [(0, 67, 3), (3, 72, 1)],
    ],
    "end": [
        [(0, 74, 1.5), (1.5, 72, .5), (2, 70, 2)],
        [(0, 72, 1), (1, 76, 1), (2, 79, 2)],
        [(0, 76, 1.5), (1.5, 72, .5), (2, 69, 2)],
        [(0, 74, 1), (1, 77, 1), (2, 81, 2)],
        [(0, 79, 1.5), (1.5, 77, .5), (2, 74, 1), (3, 70, 1)],
        [(0, 72, 1), (1, 76, 1), (2, 79, 1), (3, 76, 1)],
        [(0, 77, 4)],
    ],
}
# Par rôle : grosse caisse (temps), basse (temps, durée, intervalle), pas des arpèges, piano (temps, durée).
GROOVE = {
    "title": dict(kick=[0, 2.5], bass=[(0, 1, 0), (1, 1, 7), (2.5, 1.5, 0)], arp=.5, keys=[(0, 2), (2, 2)], level=.8),
    "body": dict(kick=[0], bass=[(0, 3, 0), (3, 1, 7)], arp=1, keys=[(0, 4)], level=.6),
    "end": dict(kick=[0, 2.5], bass=[(0, 1, 0), (1, 1, 7), (2.5, 1.5, 0)], arp=.5, keys=[(0, 2), (2, 2)], level=.9),
}
ARP = [0, 1, 2, 3, 2, 1, 2, 1]


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def env(n, attack, decay):
    t = np.arange(n) / SR
    return np.minimum(1, t / max(attack, 1e-4)) * np.exp(-t * decay)


def release(t, dur, rate):
    return np.exp(-np.maximum(t - dur, 0) * rate)


def lowpass(x, cutoff):
    a = np.exp(-2 * np.pi * cutoff / SR)
    return lfilter([1 - a], [1, -a], x)


def highpass(x, cutoff):
    return x - lowpass(x, cutoff)


def saw(f, n, voices=3, detune=0.006):
    """Dent de scie à bande limitée (table d'onde), voix légèrement désaccordées."""
    k = np.arange(1, max(1, int(3000 / f)) + 1)
    table = (np.sin(2 * np.pi * np.outer(k, np.arange(TABLE) / TABLE)) / k[:, None]).sum(0)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for v in range(voices):
        fv = f * (1 + detune * (v - (voices - 1) / 2))
        out += table[((fv * t + rng.random()) * TABLE).astype(np.int64) % TABLE]
    return out / voices


def pad(notes, dur, bright=900, attack=0.5):
    n = int(SR * (dur + 1.5))
    t = np.arange(n) / SR
    s = sum(saw(hz(m), n) for m in notes) / len(notes)
    return lowpass(lowpass(s, bright), bright) * np.minimum(1, t / attack) * release(t, dur, 3)


def swell(notes, dur):
    """Nappe qui enfle et s'éclaircit jusqu'au temps fort suivant."""
    n = int(SR * dur)
    x = np.arange(n) / n
    s = sum(saw(hz(m), n) for m in notes) / len(notes)
    return (lowpass(lowpass(s, 400), 400) * (1 - x) + lowpass(lowpass(s, 2500), 2500) * x) * x ** 2


def epiano(f, dur):
    """Piano électrique FM feutré : modulateur 1:1 dont l'indice retombe vite."""
    n = int(SR * (dur + 1.0))
    t = np.arange(n) / SR
    s = np.sin(2 * np.pi * f * t + (0.3 + np.exp(-t * 8)) * np.sin(2 * np.pi * f * t))
    return s * env(n, 0.006, 1.4) * release(t, dur, 10)


def marimba(f, dur):
    """FM : modulateur à 4x dont l'indice s'éteint vite (attaque boisée)."""
    n = int(SR * (dur + 0.8))
    t = np.arange(n) / SR
    return np.sin(2 * np.pi * f * t + 1.6 * np.exp(-t * 16) * np.sin(2 * np.pi * 4 * f * t)) * env(n, 0.002, 3.0)


def pluck(f, dur):
    """Corde pincée : harmoniques d'autant plus brèves qu'elles sont aiguës."""
    n = int(SR * (dur + 0.6))
    t = np.arange(n) / SR
    s = sum(np.sin(2 * np.pi * k * f * t) * np.exp(-t * (4 + 7 * k)) / k ** 1.5 for k in range(1, 6))
    return s * np.minimum(1, t / 0.002) * release(t, dur, 15)


def glock(f, dur):
    n = int(SR * (dur + 1.2))
    t = np.arange(n) / SR
    s = sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t * d) for r, a, d in [(1, 1, 2.2), (2.76, .4, 5), (5.4, .2, 9)])
    return s * env(n, 0.001, 0.4)


def bass(f, dur, decay=1.5):
    n = int(SR * (dur + 0.3))
    t = np.arange(n) / SR
    s = np.sin(2 * np.pi * f * t) + 0.3 * np.sin(4 * np.pi * f * t) + 0.1 * np.sin(6 * np.pi * f * t)
    return s * env(n, 0.006, decay) * release(t, dur, 25)


def kick():
    n = int(SR * 0.4)
    t = np.arange(n) / SR
    return np.sin(2 * np.pi * (48 * t + 90 / 30 * (1 - np.exp(-t * 30)))) * env(n, 0.002, 9)


def noise(dur, decay, hp, lp, attack=0.001):
    """Bruit filtré au-dessus de la voix (shaker, charleston, cymbale)."""
    n = int(SR * dur)
    return lowpass(highpass(highpass(rng.standard_normal(n), hp), hp), lp) * env(n, attack, decay)


def riser(dur):
    """Crash doux inversé : souffle aigu qui enfle jusqu'au temps fort et s'arrête net."""
    n = int(SR * dur)
    return lowpass(highpass(highpass(rng.standard_normal(n), 4000), 4000), 10000) * (np.arange(n) / n) ** 3


L, R = np.zeros(N), np.zeros(N)
DL, DR = np.zeros(N), np.zeros(N)  # basse et grosse caisse, sans réverbération


def add(sig, at, gain=1.0, pan=0.0, dry=False):
    """Ajoute sig à l'instant at (s), pan de -1 (gauche) à 1 (droite)."""
    i = int(round(at * SR))
    j = min(N, i + len(sig))
    if i >= j:
        return
    lg, rg = np.cos((pan + 1) * np.pi / 4) * 1.414, np.sin((pan + 1) * np.pi / 4) * 1.414
    left, right = (DL, DR) if dry else (L, R)
    left[i:j] += sig[: j - i] * gain * lg
    right[i:j] += sig[: j - i] * gain * rg


def play(bar, role, name, k, rel):
    t0 = bar * BAR
    root, notes = CH[name]
    hold = DURATION - t0 if bar == LAST else BAR
    for pan in (-0.45, 0.45):
        add(pad(notes, hold, 1500 if role == "end" else 900, 1.5 if bar == 0 else 0.5), t0, 0.14, pan)
    if role == "end":
        add(pad([m + 12 for m in notes], hold, 2200), t0, 0.04)
    bells = [notes[0] + 12, notes[1] + 12, notes[2] + 12, notes[0] + 24]
    if role in ("open", "panel"):
        for j, m in enumerate(bells):
            add(glock(hz(m), 0.6), t0 + j * BEAT, 0.06, 0.5 - j * 0.33)
        add(bass(hz(root), BAR, 0.5), t0, 0.22 if role == "panel" else 0.16, dry=True)
        if role == "panel":
            for m in [root + 12] + notes:
                add(epiano(hz(m), BAR), t0, 0.06, -0.25)
        return
    g = GROOVE[role]
    if bar == LAST:
        add(kick(), t0, 0.24, dry=True)
        add(noise(3.0, 1.2, 5000, 11000, 0.01), t0, 0.05, 0.2)
        add(bass(hz(root), hold, 0.35), t0, 0.26, dry=True)
        for m in [root + 12] + notes:
            add(epiano(hz(m), hold), t0, 0.07, -0.25)
        for j, m in enumerate(bells[1:] + [notes[1] + 24]):
            add(glock(hz(m), 2.0), t0 + j * BEAT / 2, 0.05, 0.45 - j * 0.3)
    else:
        lv = g["level"]
        for b in g["kick"]:
            add(kick(), t0 + b * BEAT, 0.24 * lv, dry=True)
        for b, d, iv in g["bass"]:
            add(bass(hz(root + iv), d * BEAT * 0.95), t0 + b * BEAT, 0.22, dry=True)
        for b, d in g["keys"]:
            for m in [root + 12] + notes:
                add(epiano(hz(m), d * BEAT * 0.9), t0 + b * BEAT, 0.05, -0.25)
        for j in range(8):
            add(noise(0.07, 70, 6500, 12000), t0 + j * BEAT / 2, (0.15 if j % 2 else 0.09) * lv, 0.35)
        step = g["arp"]
        for j in range(int(4 / step)):
            add(pluck(hz(bells[ARP[j % 8]]), step * BEAT), t0 + j * step * BEAT, 0.07, -0.45 if j % 2 else 0.45)
    # Mélodie continue au titre et en conclusion, une phrase de 4 mesures sur 8 sous la voix.
    if role in ("title", "end") or rel // 4 % 2 == 0:
        mel = MELODY[role]
        for b, m, d in mel[(rel if role == "title" else k) % len(mel)]:
            add(marimba(hz(m), d * BEAT), t0 + b * BEAT, 0.15, 0.1)
            if role == "end":
                add(glock(hz(m + 12), d * BEAT), t0 + b * BEAT, 0.025, -0.3)


starts = [0]
for s, _ in SECTIONS[1:]:
    starts.append(min(LAST, max(starts[-1] + 1, int(round(SCENES[s]["t0"] / BAR)))))
starts.append(LAST + 1)
chords = {}
for i, (_, role) in enumerate(SECTIONS):
    b0, b1 = starts[i], starts[i + 1]
    prog = PROG[role]
    for bar in range(b0, b1):
        k = (bar - b1 if role in BACKWARD else bar - b0) % len(prog)
        chords[bar] = prog[k]
        play(bar, role, prog[k], k, bar - b0)

for i, (_, role) in enumerate(SECTIONS[1:], 1):
    t = starts[i] * BAR
    if role == "panel" and starts[i] - 1 in chords:
        add(riser(BAR), t - BAR, 0.12, 0.2)
        add(swell([m + 12 for m in CH[chords[starts[i] - 1]][1]], BAR), t - BAR, 0.08)
        add(kick(), t, 0.24, dry=True)
        add(noise(3.0, 1.4, 5000, 11000, 0.01), t, 0.06, -0.2)
    else:
        add(riser(2 * BEAT), t - 2 * BEAT, 0.07, 0.2)
        add(noise(2.5, 1.6, 5000, 11000, 0.01), t, 0.04, -0.2)

# Réverbération : réponse impulsionnelle synthétique (bruit à décroissance exponentielle, 2,2 s), énergie unité.
t_ir = np.arange(int(SR * 2.2)) / SR
wet = []
for bus in (L, R):
    ir = lowpass(rng.standard_normal(len(t_ir)) * np.exp(-t_ir * 2.8), 5000)
    wet.append(oaconvolve(bus, ir / np.sqrt((ir ** 2).sum()))[:N])
mix = np.stack([DL + L + 0.3 * wet[0], DR + R + 0.3 * wet[1]], axis=1)
mix[-2 * SR:] *= np.linspace(1, 0, 2 * SR)[:, None] ** 2
mix *= 0.89 / np.abs(mix).max()

out = ROOT / "audio/music.wav"
with wave.open(str(out), "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(np.round(mix * 32767).astype("<i2").tobytes())
print(f"{out} ({N / SR:.3f} s, {BPM} BPM, mesure {BAR:.2f} s)")
for (scene, role), b in zip(SECTIONS, starts):
    print(f"  {scene:<13} scène {SCENES[scene]['t0']:7.2f} s -> mesure {b:3d} ({b * BAR:7.2f} s)  {role}")
print(f"  accord final          -> mesure {LAST:3d} ({LAST * BAR:7.2f} s)")
