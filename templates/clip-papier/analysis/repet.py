"""Séparation voix / accompagnement par répétition calée sur les battements (REPET rythmique).

Les mix générés sont souvent presque mono (côtés à -8..-14 dB) : isoler le centre ne suffit pas.
En revanche l'accompagnement se répète de mesure en mesure alors que la voix change. Pour chaque
trame, on prend les trames situées à la même position dans la mesure, 1, 3, 5 et 7 mesures avant
et après (mesures impaires : la mélodie chantée, elle, revient plutôt toutes les 2 mesures), et
leur médiane estime le fond. Ce qui dépasse ce fond est la voix. Le tempo peut accélérer
légèrement, d'où le calage sur les battements plutôt qu'une période fixe.

Entrée : analysis/features.npz (battements, voir analyze.py).
Sorties : analysis/vocals.npz (enveloppe de voix + spectrogramme log-fréquence), audio/voice_est.wav
"""
from pathlib import Path

import numpy as np
from scipy.io import wavfile
from scipy.ndimage import uniform_filter1d
from scipy.signal import istft, resample_poly, stft

ROOT = Path(__file__).resolve().parent.parent
SR, HOP, NFFT = 22050, 256, 2048
OFFSETS = [-28, -20, -12, -4, 4, 12, 20, 28]  # en temps : ±1, 3, 5, 7 mesures


def read_wav(path):
    """WAV en flottants dans [-1, 1], toujours en stéréo (un WAV mono est dupliqué), quel que soit l'encodage."""
    sr, x = wavfile.read(path)
    if x.dtype.kind == "i":
        x = x.astype(np.float32) / float(np.iinfo(x.dtype).max + 1)
    elif x.dtype.kind == "u":
        x = (x.astype(np.float32) - 128) / 128
    else:
        x = x.astype(np.float32)
    if x.ndim == 1:
        x = np.stack([x, x], axis=1)
    return sr, x


def main():
    beats = np.load(ROOT / "analysis/features.npz")["beats"]
    sr, x = read_wav(ROOT / "audio/song.wav")
    x = resample_poly(x, SR, sr, axis=0)
    mid = x.mean(axis=1)
    freqs, _, Z = stft(mid, fs=SR, nperseg=NFFT, noverlap=NFFT - HOP)
    X = np.abs(Z).astype(np.float32)
    fps = SR / HOP
    n = X.shape[1]

    # Grille de battements prolongée avant le premier et après le dernier (tempo local).
    period0, period1 = np.median(np.diff(beats[:20])), np.median(np.diff(beats[-20:]))
    ext = np.concatenate([beats[0] - period0 * np.arange(40, 0, -1), beats, beats[-1] + period1 * np.arange(1, 40)])
    grid = np.arange(len(ext))
    pos = np.interp(np.arange(n) / fps, ext, grid)  # position de chaque trame en temps musicaux

    bg = np.empty_like(X)
    for j in range(n):
        ks = np.round(np.interp(pos[j] + np.array(OFFSETS), grid, ext) * fps).astype(int)
        ks = ks[(ks >= 0) & (ks < n)]
        bg[:, j] = np.median(X[:, ks], axis=1)
    V = np.clip(X - bg, 0, None)

    band = (freqs > 200) & (freqs < 4000)
    env_db = uniform_filter1d(20 * np.log10(V[band].sum(axis=0) + 1e-7), 3)
    edges = 110 * 2 ** (np.arange(0, 4 * 24 + 1) / 24)
    logspec = np.zeros((len(edges) - 1, n), np.float32)
    for i in range(len(edges) - 1):
        sel = (freqs >= edges[i]) & (freqs < edges[i + 1])
        if sel.any():
            logspec[i] = V[sel].max(axis=0)
    logspec = np.log1p(300 * logspec / (np.percentile(logspec, 99.9) + 1e-9))
    np.savez_compressed(ROOT / "analysis/vocals.npz", env_db=env_db.astype(np.float32), logspec=logspec.astype(np.float16), fps=fps)

    # Voix estimée audible (pour vérifier à l'oreille).
    _, y = istft(V * np.exp(1j * np.angle(Z)), fs=SR, nperseg=NFFT, noverlap=NFFT - HOP)
    y = y / (np.abs(y).max() + 1e-9) * 0.9
    wavfile.write(ROOT / "audio/voice_est.wav", SR, (y * 32767).astype(np.int16))
    print("ok", n, "trames", f"{fps:.2f} trames/s")


if __name__ == "__main__":
    main()
