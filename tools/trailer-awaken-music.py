#!/usr/bin/env python3
"""v9.3.1 : bande-son ORIGINALE du trailer « AWAKEN YOUR LEGEND » (40 s), entièrement synthétisée ici (aucun
échantillon ni musique tierce : aucune question de licence). Registre « fantasy épique » simplifié :
grondement et yeux du Colosse (0-5 s), nappes de cordes et timbales sur chaque héros (5-12 s), carillons des familiers
(12-18 s), percussions qui accélèrent sur les boss (18-29,5 s), silence, puis impact et accord final sur le logo.
Les instants des impacts suivent docs/promo/trailer-awaken/stage.html.
  python3 tools/trailer-awaken-music.py sortie.wav
"""
import sys, wave
import numpy as np

SR = 48000
DUR = 40.0
N = int(SR * DUR)
t = np.arange(N) / SR
L = np.zeros(N); R = np.zeros(N)
rng = np.random.default_rng(7)

def add(sig, at, pan=0.0, gain=1.0):
    i = int(at * SR); j = min(N, i + len(sig))
    if j <= i: return
    s = sig[: j - i] * gain
    L[i:j] += s * (1 - max(0, pan)); R[i:j] += s * (1 + min(0, pan))

def env(n, a=0.01, r=0.3, sustain=None):
    e = np.ones(n); ai = max(1, int(a * SR)); e[:ai] = np.linspace(0, 1, ai)
    tt = np.arange(n) / SR
    rel = np.exp(-np.maximum(0, tt - a) / max(r, 1e-3)) if sustain is None else np.ones(n)
    return e * rel

def lowpass(x, cutoff):
    a = np.exp(-2 * np.pi * cutoff / SR); y = np.zeros_like(x); acc = 0.0
    for k in range(len(x)): acc = (1 - a) * x[k] + a * acc; y[k] = acc
    return y

def lp_fast(x, cutoff):  # passe-bas d'ordre 1 vectorisé par blocs (approximation suffisante pour des nappes)
    from numpy.fft import rfft, irfft, rfftfreq
    X = rfft(x); f = rfftfreq(len(x), 1 / SR); X /= np.sqrt(1 + (f / cutoff) ** 2) ** 2
    return irfft(X, len(x))

def boom(d=2.5, f0=110, f1=32, noise=0.5):
    n = int(d * SR); tt = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-tt * 6); ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) * np.exp(-tt * 1.6)
    nz = lp_fast(rng.standard_normal(n), 400) * np.exp(-tt * 5) * noise
    return np.tanh((s + nz) * 1.6) * 0.9

def timpani(d=1.2, f=73):
    n = int(d * SR); tt = np.arange(n) / SR
    s = np.sin(2 * np.pi * f * tt * (1 + 0.04 * np.exp(-tt * 20))) * np.exp(-tt * 3.5)
    s += 0.4 * np.sin(2 * np.pi * f * 1.5 * tt) * np.exp(-tt * 6)
    s += lp_fast(rng.standard_normal(n), 900) * np.exp(-tt * 30) * 0.6
    return s * 0.8

def kick():
    n = int(0.45 * SR); tt = np.arange(n) / SR
    f = 45 + 110 * np.exp(-tt * 30); return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 7)

def snare():
    n = int(0.3 * SR); tt = np.arange(n) / SR
    nz = rng.standard_normal(n); nz = nz - lp_fast(nz, 1200)
    return (nz * np.exp(-tt * 14) * 0.5 + np.sin(2 * np.pi * 190 * tt) * np.exp(-tt * 20) * 0.4)

def hat():
    n = int(0.08 * SR); tt = np.arange(n) / SR; nz = rng.standard_normal(n); nz = nz - lp_fast(nz, 6000)
    return nz * np.exp(-tt * 60) * 0.25

def whoosh(d=0.45, up=True):
    n = int(d * SR); tt = np.arange(n) / SR; nz = rng.standard_normal(n)
    out = np.zeros(n); seg = 2048
    for k in range(0, n, seg):
        u = k / n; c = 300 + 5000 * (u if up else 1 - u)
        out[k:k + seg] = lp_fast(nz[k:k + seg], c) - lp_fast(nz[k:k + seg], c * 0.3)
    return out * np.sin(np.pi * tt / d) * 0.8

def bell(f=1318.5, d=1.6):
    n = int(d * SR); tt = np.arange(n) / SR
    return sum(a * np.sin(2 * np.pi * f * m * tt) * np.exp(-tt * (2 + m)) for m, a in [(1, .5), (2.76, .2), (5.4, .1)]) * 0.5

def saw(f, n):
    tt = np.arange(n) / SR; return 2 * ((f * tt) % 1) - 1

def pad(freqs, d, cutoff=1400, a=0.6, r=1.2):
    n = int(d * SR); s = np.zeros(n)
    for f in freqs:
        for det in (-0.12, 0.0, 0.12): s += saw(f * 2 ** (det / 12), n)
    s = lp_fast(s / (3 * len(freqs)), cutoff)
    e = np.minimum(1, np.arange(n) / (a * SR)) * np.minimum(1, (n - np.arange(n)) / (r * SR))
    return s * e

def riser(d=1.6):
    n = int(d * SR); tt = np.arange(n) / SR; nz = rng.standard_normal(n)
    hp = nz - lp_fast(nz, 2500); f = 200 + 1200 * (tt / d) ** 2
    return (hp * (tt / d) ** 2 * 0.5 + np.sin(2 * np.pi * np.cumsum(f) / SR) * (tt / d) ** 3 * 0.25)

NOTE = lambda m: 440 * 2 ** ((m - 69) / 12)
# --- 1. Réveil (0-5 s) : drone grave et grondement, montée, impact sur l'éclair des yeux (4,6 s)
dr = (np.sin(2 * np.pi * 36.7 * t) * 0.35 + np.sin(2 * np.pi * 55 * t) * 0.2) * np.clip(t / 2.0, 0, 1) * (t < 5.0)
rumble = lp_fast(rng.standard_normal(N), 90) * 3.0 * np.clip(t / 1.5, 0, 1) * (t < 5.2)
L += dr + rumble; R += dr + rumble * 0.9
add(riser(1.8), 2.85, gain=0.8)
add(boom(3.0), 4.62, gain=1.1)
add(whoosh(0.4), 4.4, gain=0.5)
# --- 2. Héros (4,75-12 s) : nappe Dm - Bb - F - C, timbale + souffle à chaque révélation
prog = [(50, 53, 57, 62), (46, 50, 53, 58), (53, 57, 60, 65), (48, 52, 55, 60)]
for k, ch in enumerate(prog):
    add(pad([NOTE(m) for m in ch], 2.1, 1800), 4.8 + k * 1.8, gain=0.55)
    add(pad([NOTE(ch[0] - 12)], 2.1, 400), 4.8 + k * 1.8, gain=0.35)
for i in range(6):
    at = 4.75 + i * 0.86
    add(timpani(f=NOTE(38 + (i % 2) * 5)), at, gain=0.9); add(whoosh(0.3, up=False), at - 0.05, pan=(-.4 if i % 2 else .4), gain=0.45)
add(boom(1.8, 90, 40, 0.3), 9.91, gain=0.7); add(bell(NOTE(86), 2.0), 9.95, gain=0.35)
# --- 3. Familiers (12-18 s) : portail (souffle montant), carillons à chaque apparition
add(whoosh(1.4, up=True), 12.0, gain=0.6); add(riser(1.3), 12.2, gain=0.4)
for i, m in enumerate([81, 84, 88, 86]): add(bell(NOTE(m)), 13.6 + i * 0.8, pan=(.3 if i % 2 else -.3), gain=0.6); add(timpani(0.8, NOTE(45)), 13.6 + i * 0.8, gain=0.45)
add(bell(NOTE(93), 2.4), 16.8, gain=0.45)
for k, ch in enumerate([(57, 60, 64, 69), (53, 57, 60, 65), (55, 59, 62, 67)]):
    add(pad([NOTE(m) for m in ch], 2.2, 2600, a=0.3), 12.0 + k * 2.0, gain=0.35)
# --- 4. Boss (18-29,5 s) : percussions 120 puis 150 BPM, nappes graves, impacts sur les coupes
beat = 0.5; x = 18.0
while x < 29.4:
    add(kick(), x, gain=0.9)
    if int((x - 18) / beat) % 2 == 1: add(snare(), x, gain=0.7)
    add(hat(), x + beat / 2, pan=.3); add(hat(), x, pan=-.3)
    if x > 25.8: add(hat(), x + beat / 4, pan=.1); add(hat(), x + 3 * beat / 4, pan=-.1)
    beat = 0.5 if x < 25.8 else 0.4; x += beat
for k, ch in enumerate([(38, 50, 53, 57), (34, 46, 50, 53), (41, 48, 53, 57), (36, 48, 52, 55), (38, 50, 53, 57), (34, 46, 50, 53)]):
    add(pad([NOTE(m) for m in ch], 2.1, 1200 + 300 * k, a=0.1, r=0.4), 18.0 + k * 1.9, gain=0.5)
for at in (18.0, 19.1, 20.3, 21.4, 22.5, 24.3, 25.8, 27.6): add(boom(1.2, 140, 45, 0.6), at, gain=0.55); add(whoosh(0.3), at - 0.2, gain=0.5)
add(riser(1.9), 27.6, gain=0.9)
# --- 5. Silence (29,5-30,2), puis impact et accord final (Dm add9 → D majeur) sur le logo
add(boom(4.5, 120, 28, 0.8), 30.2, gain=1.3)
add(pad([NOTE(m) for m in (38, 50, 57, 62, 64, 69)], 6.4, 2200, a=0.05, r=2.5), 30.2, gain=0.8)
add(pad([NOTE(m) for m in (38, 50, 54, 57, 62, 66)], 3.4, 2600, a=0.4, r=2.0), 36.6, gain=0.75)
for i, m in enumerate([74, 78, 81, 86]): add(bell(NOTE(m), 2.5), 31.7 + i * 0.12, gain=0.35)
add(timpani(1.5, NOTE(38)), 36.6, gain=0.9); add(bell(NOTE(90), 3.0), 37.3, gain=0.4)
silence = (t >= 29.55) & (t < 30.2)
L[silence] *= 0.0; R[silence] *= 0.0
fade = np.clip((DUR - t) / 1.2, 0, 1); L *= fade; R *= fade
peak = max(np.abs(L).max(), np.abs(R).max()); L = np.tanh(L / peak * 1.3) * 0.89; R = np.tanh(R / peak * 1.3) * 0.89
data = (np.stack([L, R], 1) * 32767).astype('<i2')
with wave.open(sys.argv[1], 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(data.tobytes())
print(sys.argv[1], f'{DUR} s')
