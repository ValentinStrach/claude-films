"""Musique du film d'exemple, entièrement synthétisée (aucun échantillon) : 100 BPM, 16 mesures + résonance.

Plan (une mesure = 4 temps = 2,4 s) :
  0-1   ouverture  : nappe et clochettes, le titre tombe mot par mot
  2-5   le matin   : ré majeur, mélodie au marimba, basse ronde, shaker
  6-9   la tempête : si mineur, cordes graves en ostinato, toms et grosse caisse, tonnerre sur les éclairs
  10-13 l'arrivée  : reprise de la mélodie, glockenspiel à l'octave, tout l'orchestre
  14-15 fin        : cadence plagale (sol → ré), accord tenu
Même tempo et mêmes temps d'éclair que anim/scenes/tempete.js (LIGHTNING) et que la grille de
core/analysis/grid_timing.mjs --bpm 100 --start 4.8.

Sortie : audio/music.wav (44,1 kHz, stéréo, 16 bits).
Usage : python films/exemple/audio/compose.py
"""
import wave
from pathlib import Path

import numpy as np
from scipy.signal import fftconvolve, lfilter

ROOT = Path(__file__).resolve().parent.parent
SR = 44100
BPM = 100
BEAT = 60 / BPM
BAR = 4 * BEAT
DURATION = 41.0
N = int(SR * DURATION)
LIGHTNING = [24, 30, 32, 37]  # temps (index depuis 0) des éclairs, comme anim/scenes/tempete.js

rng = np.random.default_rng(11)

# Accords (MIDI) mesure par mesure.
CH = {
    "D": [50, 57, 62, 66], "G": [43, 55, 59, 62], "A": [45, 57, 61, 64], "Bm": [47, 54, 59, 62],
    "Em": [40, 55, 59, 64], "F#": [42, 54, 58, 61], "Gmaj7": [43, 55, 59, 66],
}
PROG = ["D", "Gmaj7", "D", "A", "Bm", "G", "Bm", "G", "Em", "F#", "D", "A", "Bm", "G", "G", "D"]

# Mélodie du matin (4 mesures) : (temps dans la mesure, note MIDI, durée en temps).
MELODY = [
    [(0, 69, 1), (1, 66, 0.5), (1.5, 69, 0.5), (2, 74, 1.5), (3.5, 73, 0.5)],
    [(0, 71, 1), (1, 69, 1), (2, 64, 1.5), (3.5, 66, 0.5)],
    [(0, 66, 1), (1, 69, 0.5), (1.5, 71, 0.5), (2, 74, 1), (3, 76, 1)],
    [(0, 74, 1.5), (1.5, 71, 0.5), (2, 69, 1), (3, 67, 0.5), (3.5, 66, 0.5)],
]
# Reprise finale : la dernière mesure monte et se pose sur la tonique.
MELODY_END = [(0, 74, 1), (1, 76, 0.5), (1.5, 78, 0.5), (2, 81, 2)]


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def env(n, attack, decay):
    t = np.arange(n) / SR
    return np.minimum(1, t / max(attack, 1e-4)) * np.exp(-t * decay)


def marimba(f, dur):
    """FM : porteuse + modulateur à 4x dont l'indice s'éteint vite (attaque boisée)."""
    n = int(SR * (dur + 0.8))
    t = np.arange(n) / SR
    idx = 2.2 * np.exp(-t * 14)
    s = np.sin(2 * np.pi * f * t + idx * np.sin(2 * np.pi * 4 * f * t))
    s += 0.25 * np.sin(2 * np.pi * 10 * f * t) * np.exp(-t * 40)
    return s * env(n, 0.002, 3.2)


def glock(f, dur):
    n = int(SR * (dur + 1.2))
    t = np.arange(n) / SR
    s = sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t * d) for r, a, d in [(1, 1, 2.2), (2.76, 0.45, 5), (5.4, 0.25, 9)])
    return s * env(n, 0.001, 0.4)


def saw(f, n, voices=3, detune=0.008):
    """Dent de scie à bande limitée (somme d'harmoniques), plusieurs voix légèrement désaccordées."""
    t = np.arange(n) / SR
    out = np.zeros(n)
    kmax = max(1, int(6000 / f))
    for v in range(voices):
        fv = f * (1 + detune * (v - (voices - 1) / 2))
        ph = rng.random() * 2 * np.pi
        for k in range(1, min(kmax, 24) + 1):
            out += np.sin(2 * np.pi * fv * k * t + ph * k) / k
    return out / voices


def lowpass(x, cutoff):
    a = np.exp(-2 * np.pi * cutoff / SR)
    return lfilter([1 - a], [1, -a], x)


def pad(notes, dur, bright=900):
    n = int(SR * (dur + 1.5))
    s = sum(saw(hz(m), n) for m in notes) / len(notes)
    s = lowpass(lowpass(s, bright), bright)
    t = np.arange(n) / SR
    a = np.minimum(1, t / 0.8) * np.where(t < dur, 1, np.exp(-(t - dur) * 3))
    return s * a


def bass(f, dur):
    n = int(SR * (dur + 0.3))
    t = np.arange(n) / SR
    s = np.sin(2 * np.pi * f * t) + 0.3 * np.sin(4 * np.pi * f * t) + 0.12 * np.sin(6 * np.pi * f * t)
    return s * env(n, 0.005, 2.0) * np.where(t < dur, 1, np.exp(-(t - dur) * 25))


def kick():
    n = int(SR * 0.45)
    t = np.arange(n) / SR
    return np.sin(2 * np.pi * (45 * t + 110 / 25 * (1 - np.exp(-t * 25)))) * np.exp(-t * 7)


def tom(f):
    n = int(SR * 0.6)
    t = np.arange(n) / SR
    return np.sin(2 * np.pi * (f * t + f * 0.6 / 8 * (1 - np.exp(-t * 8)))) * np.exp(-t * 6) + 0.15 * rng.standard_normal(n) * np.exp(-t * 30)


def noise_hit(dur, decay, cutoff_hi=None, cutoff_lo=None):
    n = int(SR * dur)
    s = rng.standard_normal(n)
    if cutoff_lo:
        s = lowpass(s, cutoff_lo)
    if cutoff_hi:
        s = s - lowpass(s, cutoff_hi)
    return s * env(n, 0.001, decay)


def thunder():
    n = int(SR * 3.0)
    t = np.arange(n) / SR
    s = rng.standard_normal(n)
    for _ in range(4):  # 24 dB/octave : un grondement grave, pas un souffle
        s = lowpass(s, 160)
    s /= np.abs(s).max()
    s *= np.minimum(1, t / 0.03) * np.exp(-t * 1.3) * (1 + 0.6 * np.sin(2 * np.pi * 3.1 * t) ** 2)
    crack = lowpass(noise_hit(0.2, 25, cutoff_hi=1500), 4000)
    s[: len(crack)] += crack / np.abs(crack).max() * 0.25
    return s


L, R = np.zeros(N), np.zeros(N)


def add(sig, at, gain=1.0, pan=0.0):
    """Ajoute sig à l'instant at (s), pan de -1 (gauche) à 1 (droite)."""
    i = int(at * SR)
    j = min(N, i + len(sig))
    if i >= j:
        return
    lg, rg = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    L[i:j] += sig[: j - i] * gain * lg * 1.414
    R[i:j] += sig[: j - i] * gain * rg * 1.414


for bar, name in enumerate(PROG):
    t0 = bar * BAR
    notes = CH[name]
    storm = 6 <= bar <= 9
    final = bar >= 14
    # Nappe : toujours là, plus sombre pendant la tempête, tenue à la fin.
    add(pad(notes[1:], BAR * (2.2 if bar == 15 else 1)), t0, 0.16 if not storm else 0.12, -0.3)
    add(pad([m + 12 for m in notes[1:3]], BAR * (2.2 if bar == 15 else 1), 1400), t0, 0.07, 0.35)
    if bar < 2:
        # Ouverture : clochettes qui égrènent l'accord.
        for k, m in enumerate([74, 78, 81, 86] if bar == 0 else [74, 79, 83, 86]):
            add(glock(hz(m), 0.6), t0 + k * BEAT, 0.13, 0.5 - k * 0.3)
        continue
    # Basse.
    if storm:
        for k in range(8):
            add(bass(hz(notes[0] - 12 if notes[0] > 45 else notes[0]), BEAT / 2 * 0.9), t0 + k * BEAT / 2, 0.42)
    elif not final:
        for k, d in [(0, 1.5), (1.5, 0.5), (2, 2)]:
            add(bass(hz(notes[0] - 12 if notes[0] > 45 else notes[0]), d * BEAT * 0.95), t0 + k * BEAT, 0.5)
    else:
        add(bass(hz(notes[0] - 12 if notes[0] > 45 else notes[0]), BAR * (2 if bar == 15 else 1)), t0, 0.5)
    # Mélodie : matin (2-5), reprise (10-13) avec glockenspiel à l'octave.
    if 2 <= bar <= 5 or 10 <= bar <= 13:
        k = (bar - 2) % 4 if bar <= 5 else bar - 10
        phrase = MELODY_END if bar == 13 else MELODY[k]
        for b, m, d in phrase:
            add(marimba(hz(m), d * BEAT), t0 + b * BEAT, 0.3, 0.15)
            if bar >= 10:
                add(glock(hz(m + 12), d * BEAT), t0 + b * BEAT, 0.07, -0.4)
        # Contre-chant en arpège doux.
        for k8 in range(8):
            m = notes[1 + k8 % 3] + 12
            add(marimba(hz(m), BEAT / 2), t0 + k8 * BEAT / 2, 0.07 if bar <= 5 else 0.1, -0.5 if k8 % 2 else 0.5)
        # Shaker en croches.
        for k8 in range(8):
            add(noise_hit(0.08, 60, cutoff_hi=6000), t0 + k8 * BEAT / 2, 0.05 if k8 % 2 else 0.08, 0.4)
        if bar >= 10:
            for b in (0, 2):
                add(kick(), t0 + b * BEAT, 0.35)
            add(noise_hit(0.2, 22, cutoff_hi=1800), t0 + 3 * BEAT, 0.12)
    if storm:
        # Cordes graves en ostinato (croches), toms et grosse caisse.
        for k8 in range(8):
            add(lowpass(saw(hz(notes[1] - 12 + (7 if k8 % 4 == 2 else 0)), int(SR * BEAT / 2)), 1200) * env(int(SR * BEAT / 2), 0.01, 4), t0 + k8 * BEAT / 2, 0.22, -0.2)
        for b in range(4):
            add(kick(), t0 + b * BEAT, 0.55)
        for b, f in [(1.5, 140), (2.5, 110), (3, 95), (3.5, 80)]:
            add(tom(f), t0 + b * BEAT, 0.3, 0.3 if f > 100 else -0.3)
        add(lowpass(noise_hit(0.6, 5, cutoff_hi=2000), 6000), t0, 0.04)
    if final and bar == 15:
        # Dernier coup de clochette sur la tonique.
        add(glock(hz(86), 2.0), t0 + 2 * BEAT, 0.12, 0.3)

for b in LIGHTNING:
    add(thunder(), b * BEAT, 0.8, 0.2)

# Réverbération : réponse impulsionnelle synthétique (bruit à décroissance exponentielle, 2,2 s).
n_ir = int(SR * 2.2)
t_ir = np.arange(n_ir) / SR
ir_l = rng.standard_normal(n_ir) * np.exp(-t_ir * 2.8)
ir_r = rng.standard_normal(n_ir) * np.exp(-t_ir * 2.8)
ir_l, ir_r = lowpass(ir_l, 5000), lowpass(ir_r, 5000)
wet_l = fftconvolve(L, ir_l)[:N]
wet_r = fftconvolve(R, ir_r)[:N]
wet_l *= np.abs(L).max() / (np.abs(wet_l).max() + 1e-9)
wet_r *= np.abs(R).max() / (np.abs(wet_r).max() + 1e-9)
mix = np.stack([L + 0.35 * wet_l, R + 0.35 * wet_r], axis=1)

# Fondu final, saturation douce, normalisation.
fade = np.ones(N)
fade[-int(SR * 2.0):] = np.linspace(1, 0, int(SR * 2.0)) ** 2
mix *= fade[:, None]
mix = np.tanh(mix / np.abs(mix).max() * 1.4)
mix /= np.abs(mix).max() / 0.9
out = ROOT / "audio/music.wav"
with wave.open(str(out), "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((mix * 32767).astype("<i2").tobytes())
print(f"{out} ({DURATION:.1f} s, {BPM} BPM)")
