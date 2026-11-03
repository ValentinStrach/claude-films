"""Mixage : voix off au centre, musique baissée pendant la parole, sonie finale -16 LUFS.

Entrées : audio/voice.wav (audio/timing.py, 48 kHz mono) et audio/music.wav (audio/compose.py, 48 kHz stéréo).
Sortie : audio/mix.wav (48 kHz, stéréo, 16 bits), de la durée de la musique. Sans voix synthétisée : musique seule.
"""
import sys
import wave
from pathlib import Path

import numpy as np
from scipy.ndimage import minimum_filter1d, uniform_filter1d
from scipy.signal import lfilter

ROOT = Path(__file__).resolve().parent.parent
SR = 48000
HOP = SR // 100  # trames de 10 ms
VOICE_DB, MUSIC_DB, DUCK_DB = -18.0, -20.0, 13.0
ATTACK, RELEASE, LOOKAHEAD = 0.12, 0.6, 0.12
TARGET_LUFS, CEILING_DB = -16.0, -1.5


def read(name):
    with wave.open(str(ROOT / "audio" / name), "rb") as w:
        assert w.getframerate() == SR and w.getsampwidth() == 2, name
        x = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2") / 32768
        return x.reshape(-1, w.getnchannels())


def db(power):
    return 10 * np.log10(np.maximum(power, 1e-20))


def frame_power(x):
    """Puissance moyenne par trame de 10 ms, tous canaux confondus."""
    x = np.pad(x, ((0, -len(x) % HOP), (0, 0)))
    return (x ** 2).reshape(-1, HOP * x.shape[1]).mean(axis=1)


def loudness(x):
    """Sonie intégrée UIT-R BS.1770 (filtre K à 48 kHz, blocs de 400 ms, portes -70 LUFS et -10 LU)."""
    y = lfilter([1.53512485958697, -2.69169618940638, 1.19839281085285],
                [1, -1.69065929318241, 0.73248077512799], x, axis=0)
    y = lfilter([1, -2, 1], [1, -1.99004745483398, 0.99007225036621], y, axis=0)
    c = np.concatenate([[0], np.cumsum((y ** 2).sum(axis=1))])
    blk = int(0.4 * SR)
    i = np.arange(0, len(y) - blk + 1, blk // 4)
    z = (c[i + blk] - c[i]) / blk
    z = z[-0.691 + db(z) > -70]
    z = z[db(z) > db(z.mean()) - 10]
    return -0.691 + db(z.mean())


def limit(x, ceiling):
    """Limiteur à anticipation de 5 ms, sans dépassement du plafond."""
    # Moyenne glissante d'un minimum glissant de même largeur : à chaque crête, le gain reste sous le gain requis.
    w = 2 * int(0.005 * SR) + 1
    g = np.minimum(1, ceiling / np.maximum(np.abs(x).max(axis=1), 1e-9))
    return x * uniform_filter1d(minimum_filter1d(g, w), w)[:, None]


sys.stdout.reconfigure(encoding="utf-8")
music = read("music.wav")
n = len(music)
voice = read("voice.wav")[:, :1]
voice = np.pad(voice, ((0, max(0, n - len(voice))), (0, 0)))[:n]

pv = frame_power(voice)
has_voice = pv.max() > 1e-10
speech = db(pv) > np.percentile(db(pv), 95) - 35
if has_voice:
    voice = voice * 10 ** (VOICE_DB / 20) / np.sqrt(pv[speech].mean())

# Enveloppe de la voix : RMS par trame lissé (attaque, relâche), avancé de LOOKAHEAD pour baisser avant la parole.
rms = np.sqrt(frame_power(voice))
up, down = np.exp(-1 / (ATTACK * 100)), np.exp(-1 / (RELEASE * 100))
env = np.empty_like(rms)
e = 0.0
for i, v in enumerate(rms):
    a = up if v > e else down
    e = a * e + (1 - a) * v
    env[i] = e
k = int(LOOKAHEAD * 100)
env = np.append(env[k:], np.zeros(k))
# Baisse complète à 10 dB sous le niveau de la voix, nulle à 30 dB sous.
duck = np.clip((20 * np.log10(np.maximum(env, 1e-10)) - VOICE_DB + 30) / 20, 0, 1)
gain = 10 ** (-DUCK_DB * np.interp(np.arange(n), (np.arange(len(duck)) + 0.5) * HOP, duck) / 20)

music = music * 10 ** (MUSIC_DB / 20) / np.sqrt(frame_power(music)[duck == 0].mean()) * gain[:, None]
mix = voice + music
norm = 10 ** ((TARGET_LUFS - loudness(mix)) / 20)
mix *= norm
before = np.abs(mix).max()
mix = limit(mix, 10 ** (CEILING_DB / 20))

out = ROOT / "audio/mix.wav"
with wave.open(str(out), "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(np.round(mix * 32767).astype("<i2").tobytes())
pv, pm = frame_power(voice * norm), frame_power(music * norm)
print(f"{out} : {n / SR:.3f} s, {loudness(mix):.1f} LUFS" + ("" if has_voice else " (sans voix : musique seule)"))
if has_voice:
    print(f"  voix (parole)         {db(pv[speech].mean()):6.1f} dBFS RMS")
    print(f"  musique sous la voix  {db(pm[duck == 1].mean()):6.1f} dBFS RMS")
print(f"  musique hors parole   {db(pm[duck == 0].mean()):6.1f} dBFS RMS")
print(f"  crête du mix          {20 * np.log10(np.abs(mix).max()):6.1f} dBFS (avant limiteur {20 * np.log10(before):.1f})")
