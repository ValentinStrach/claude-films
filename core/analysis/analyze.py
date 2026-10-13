"""Analyse de la chanson : tempo, battements, énergie et activité vocale.

Lit films/<film>/audio/song.wav, produit films/<film>/analysis/features.npz.
Usage : python3 core/analysis/analyze.py <film>
"""
import sys
from pathlib import Path

import numpy as np
from scipy.io import wavfile
from scipy.ndimage import median_filter, uniform_filter1d
from scipy.signal import resample_poly, stft

# <film> : nom (films/<nom>/ du dépôt) ou chemin vers le dossier du film, comme core/render/render.mjs.
ROOT = Path(sys.argv[1]).resolve() if ("/" in sys.argv[1] or "\\" in sys.argv[1] or sys.argv[1].startswith(".")) \
    else Path(__file__).resolve().parents[2] / "films" / sys.argv[1]
SR = 22050
HOP = 220          # ~10 ms
NFFT = 1024


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


def load():
    sr, x = read_wav(ROOT / "audio/song.wav")
    x = resample_poly(x, SR, sr, axis=0)
    return x[:, 0], x[:, 1]


def spec(sig):
    _, _, z = stft(sig, fs=SR, nperseg=NFFT, noverlap=NFFT - HOP, boundary=None, padded=False)
    return np.abs(z).astype(np.float32)


def hpss(mag):
    harm = median_filter(mag, size=(1, 31))
    perc = median_filter(mag, size=(31, 1))
    mask = harm**2 / (harm**2 + perc**2 + 1e-9)
    return mag * mask, mag * (1 - mask)


def tempo_and_beats(onset, fps, bpm_prior=120.0):
    o = onset - onset.mean()
    ac = np.correlate(o, o, mode="full")[len(o) - 1:]
    lags = np.arange(len(ac))
    bpm = np.where(lags > 0, 60.0 * fps / np.maximum(lags, 1), 0)
    ok = (bpm > 60) & (bpm < 200)
    weight = np.exp(-0.5 * (np.log2(np.maximum(bpm, 1) / bpm_prior) / 0.4) ** 2)
    score = np.where(ok, ac * weight, -np.inf)
    lag = int(np.argmax(score))
    # Affinage sous-échantillon (parabole).
    if 1 < lag < len(ac) - 1:
        a, b, c = ac[lag - 1], ac[lag], ac[lag + 1]
        lag = lag + 0.5 * (a - c) / (a - 2 * b + c + 1e-9)
    period = float(lag)
    # Suivi de battements par programmation dynamique (Ellis 2007).
    n = len(onset)
    score = onset.astype(np.float64).copy()
    back = np.full(n, -1)
    lo, hi = int(round(period * 0.5)), int(round(period * 2))
    for i in range(n):
        j0, j1 = max(0, i - hi), i - lo
        if j1 <= j0:
            continue
        js = np.arange(j0, j1)
        pen = -100.0 * (np.log((i - js) / period)) ** 2
        cand = score[js] + pen
        k = int(np.argmax(cand))
        score[i] = onset[i] + cand[k]
        back[i] = js[k]
    i = int(np.argmax(score[-int(period * 2):])) + n - int(period * 2)
    beats = []
    while i >= 0:
        beats.append(i)
        i = back[i]
    return 60.0 * fps / period, np.array(beats[::-1]) / fps


def main():
    left, right = load()
    mid, side = (left + right) / 2, (left - right) / 2
    M, S = spec(mid), spec(side)
    freqs = np.fft.rfftfreq(NFFT, 1 / SR)
    fps = SR / HOP
    times = np.arange(M.shape[1]) / fps

    Hm, Pm = hpss(M)
    band = (freqs > 250) & (freqs < 4000)
    # Voix ≈ partie harmonique centrée, dans la bande vocale, moins ce qui est large en stéréo.
    voc = np.clip(Hm[band] - 0.9 * S[band], 0, None).sum(axis=0)
    voc_db = 20 * np.log10(voc + 1e-6)
    rms = np.sqrt((M**2).mean(axis=0))
    rms_db = 20 * np.log10(rms + 1e-6)

    logm = np.log1p(100 * M)
    flux = np.clip(np.diff(logm, axis=1), 0, None).sum(axis=0)
    flux = np.concatenate([[0], flux])
    flux = flux - uniform_filter1d(flux, 50)
    flux = np.clip(flux, 0, None)
    flux /= flux.max() + 1e-9
    bpm, beats = tempo_and_beats(flux, fps)

    # Chroma pour repérer les refrains répétés.
    pitch = 12 * np.log2(np.maximum(freqs, 1) / 440.0) + 69
    chroma = np.zeros((12, M.shape[1]), np.float32)
    sel = (freqs > 80) & (freqs < 5000)
    for b in np.where(sel)[0]:
        chroma[int(round(pitch[b])) % 12] += Hm[b]
    chroma /= chroma.sum(axis=0, keepdims=True) + 1e-9

    np.savez_compressed(
        ROOT / "analysis/features.npz", times=times, voc_db=voc_db, rms_db=rms_db, flux=flux,
        beats=beats, bpm=bpm, chroma=chroma, fps=fps,
        vocspec=np.log1p(50 * np.clip(Hm[band] - 0.9 * S[band], 0, None)).astype(np.float16), vocfreqs=freqs[band],
    )
    print(f"durée {times[-1]:.2f} s, tempo {bpm:.2f} BPM, {len(beats)} battements, premier à {beats[0]:.2f} s")


if __name__ == "__main__":
    main()
