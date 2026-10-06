#!/usr/bin/env python3
"""Original score + sound design for 'Light in the Ice', synthesised from scratch with numpy/scipy.
Reads cues.json (exported from the film timeline) so every effect lands on its visual event."""
import json, math, sys
import numpy as np
import scipy.signal as ss
from scipy.io import wavfile

SR = 48000
DUR = 222.0
N = int(SR * (DUR + 1.0))
rng = np.random.default_rng(2026)
BUS = {k: np.zeros((2, N), np.float64) for k in ('music', 'sfx', 'amb', 'dry')}
cues = json.load(open(sys.argv[1] if len(sys.argv) > 1 else 'cues.json'))

# ---------------------------------------------------------------- basics
NOTE = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
def midi(name):
    if isinstance(name, (int, float)): return name
    n = NOTE[name[0]]; i = 1
    while i < len(name) and name[i] in '#b':
        n += 1 if name[i] == '#' else -1; i += 1
    return n + 12 * (int(name[i:]) + 1)
def hz(m): return 440.0 * 2 ** ((midi(m) - 69) / 12)
def panlaw(p):
    a = (np.clip(p, -1, 1) + 1) * math.pi / 4
    return np.cos(a), np.sin(a)
def place(bus, sig, t, gain=1.0, pan=0.0):
    i0 = int(round(t * SR))
    if sig.ndim == 1:
        l, r = panlaw(pan); sig = np.vstack([sig * l, sig * r])
    if i0 < 0: sig = sig[:, -i0:]; i0 = 0
    n = min(sig.shape[1], N - i0)
    if n > 0: BUS[bus][:, i0:i0 + n] += sig[:, :n] * gain
def place_pan(bus, sig, t, p0, p1, gain=1.0):
    p = np.linspace(p0, p1, len(sig)); l, r = panlaw(p)
    place(bus, np.vstack([sig * l, sig * r]), t, gain)
def tarr(d): return np.arange(int(d * SR)) / SR
def lp(x, fc, order=2): return ss.sosfilt(ss.butter(order, min(fc, SR * 0.45), 'low', fs=SR, output='sos'), x, axis=-1)
def hp(x, fc, order=2): return ss.sosfilt(ss.butter(order, fc, 'high', fs=SR, output='sos'), x, axis=-1)
def bp(x, f1, f2, order=2): return ss.sosfilt(ss.butter(order, [f1, min(f2, SR * 0.45)], 'band', fs=SR, output='sos'), x, axis=-1)
def ar(n, att, rel, hold=None):
    """raised-cosine attack/release envelope over n samples"""
    t = np.arange(n) / SR; d = n / SR
    a = np.where(t < att, 0.5 - 0.5 * np.cos(np.pi * np.clip(t / max(att, 1e-4), 0, 1)), 1.0)
    rs = d - rel if hold is None else hold
    r = np.where(t > rs, 0.5 + 0.5 * np.cos(np.pi * np.clip((t - rs) / max(rel, 1e-4), 0, 1)), 1.0)
    return a * r
def noise(n): return rng.standard_normal(n)
def pink(n):
    X = np.fft.rfft(rng.standard_normal(n)); f = np.fft.rfftfreq(n, 1 / SR); f[0] = 1
    y = np.fft.irfft(X / np.sqrt(f), n); return y / (np.std(y) + 1e-9)
def brown(n):
    y = np.cumsum(rng.standard_normal(n)); y = hp(y, 15); return y / (np.std(y) + 1e-9)

TBL = {}
def table(k, tilt):
    key = (k, round(tilt, 2))
    if key not in TBL:
        x = np.arange(4096) / 4096; tb = np.zeros(4097)
        for j in range(1, k + 1): tb[:4096] += np.sin(2 * np.pi * j * x) / j ** tilt
        tb[4096] = tb[0]; tb /= np.max(np.abs(tb)); TBL[key] = tb
    return TBL[key]
def osc(freq, n, tilt=1.0, maxf=9000.0, ph0=None):
    f0 = float(np.max(freq)); k = int(max(1, min(48, maxf // max(f0, 1))))
    tb = table(k, tilt)
    ph = (np.cumsum(np.broadcast_to(freq, (n,)) / SR) + (rng.random() if ph0 is None else ph0)) % 1.0
    idx = ph * 4096; i = idx.astype(np.int32); fr = idx - i
    return tb[i] * (1 - fr) + tb[i + 1] * fr

# ---------------------------------------------------------------- instruments
def pad(notes, t0, dur, gain=0.08, att=2.5, rel=3.5, cutoff=1600, tilt=1.35, voices=3, det=0.0045, vib=0.0022, bus='music', trem=0.0, width=1.0):
    n = int((dur + rel) * SR); t = np.arange(n) / SR
    out = np.zeros((2, n)); notes = [midi(x) for x in notes]
    for j, m in enumerate(notes):
        f = hz(m)
        for v in range(voices):
            dv = (v - (voices - 1) / 2) * det
            lfo = 1 + vib * np.sin(2 * np.pi * (4.1 + 0.33 * v + 0.13 * j) * t + rng.random() * 6) * np.clip(t / 1.5, 0, 1)
            s = osc(f * (1 + dv) * lfo, n, tilt=tilt, maxf=min(9000, cutoff * 4))
            p = (((v / (voices - 1)) * 2 - 1) * 0.75 if voices > 1 else 0) * width + (j / max(1, len(notes) - 1) - 0.5) * 0.25
            l, r = panlaw(p); out[0] += s * l; out[1] += s * r
    out = lp(out, cutoff)
    e = ar(n, att, rel, hold=dur)
    if trem > 0: e = e * (1 - trem * 0.5 * (1 + np.sin(2 * np.pi * 6.5 * t)))
    out *= e * gain / math.sqrt(len(notes) * voices)
    place(bus, out, t0)
def bell(m, t0, gain=0.1, dur=5.0, ratio=1.41, index=2.2, pan=0.0, decay=1.8, bus='music'):
    f = hz(m); n = int(dur * SR); t = np.arange(n) / SR
    I = index * np.exp(-t / 0.5)
    s = np.sin(2 * np.pi * f * t + I * np.sin(2 * np.pi * f * ratio * t))
    s += 0.35 * np.sin(2 * np.pi * f * 2.01 * t) * np.exp(-t / (decay * 0.35))
    s += 0.18 * np.sin(2 * np.pi * f * 3.98 * t) * np.exp(-t / (decay * 0.15))
    a = np.exp(-t / decay) * (1 - np.exp(-t / 0.0025))
    place(bus, s * a, t0, gain, pan)
def pluck(m, t0, gain=0.05, dur=2.0, bright=1.0, pan=0.0, bus='music'):
    f = hz(m); n = int(dur * SR); t = np.arange(n) / SR; s = np.zeros(n)
    for k in range(1, 9):
        fk = f * k * (1 + 0.0003 * k * k)
        if fk > 15000: break
        s += np.sin(2 * np.pi * fk * t + rng.random() * 6) / k ** 1.4 * np.exp(-t * (1.6 + 1.1 * k * bright))
    s *= (1 - np.exp(-t / 0.0015)) * ar(n, 0.0, 0.3)
    place(bus, s, t0, gain, pan)
def glass(m, t0, gain=0.04, pan=0.0, dur=1.6, bus='sfx'):
    f = hz(m); n = int(dur * SR); t = np.arange(n) / SR
    s = np.sin(2 * np.pi * f * t + 1.3 * np.exp(-t / 0.08) * np.sin(2 * np.pi * f * 3.5 * t))
    s += 0.25 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t / 0.18)
    s *= np.exp(-t / 0.45) * (1 - np.exp(-t / 0.001))
    place(bus, s, t0, gain, pan)
def boom(t0, gain=0.5, f0=72.0, f1=30.0, dur=3.5, decay=1.0, noise_amt=0.35, bus='sfx', pan=0.0):
    n = int(dur * SR); t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t / 0.22)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / decay) * (1 - np.exp(-t / 0.004))
    nb = lp(noise(n), 260) * np.exp(-t / 0.12) * noise_amt * 2.5
    s = np.tanh((s + nb) * 1.4) / 1.4
    place(bus, s, t0, gain, pan)
def sweep(t0, dur, fa, fb, gain=0.1, bw=0.55, shape='whoosh', p0=0.0, p1=None, bus='sfx', src=None):
    n = int(dur * SR)
    x = noise(n) if src is None else src[:n]
    f, tt, Z = ss.stft(x, fs=SR, nperseg=2048)
    fc = fa * (fb / fa) ** np.clip(tt / dur, 0, 1)
    M = np.exp(-0.5 * (np.log2((f[:, None] + 20) / fc[None, :]) / bw) ** 2)
    _, y = ss.istft(Z * M, fs=SR, nperseg=2048); y = y[:n]
    if len(y) < n: y = np.pad(y, (0, n - len(y)))
    u = np.arange(n) / n
    if shape == 'whoosh': e = np.sin(np.pi * u) ** 2 * (0.3 + 0.7 * u) ; e = e / e.max()
    elif shape == 'swell': e = u ** 3
    elif shape == 'fall': e = np.exp(-u * 4) * (1 - np.exp(-u * 60))
    else: e = np.ones(n)
    y = y / (np.std(y) + 1e-9) * e
    place_pan(bus, y, t0, p0, p0 if p1 is None else p1, gain)
def cymbal_swell(t0, dur, gain=0.06, bus='sfx'):
    n = int(dur * SR); u = np.arange(n) / n
    s = hp(noise(n), 5000) * u ** 4
    s2 = hp(noise(n), 5000) * u ** 4
    place(bus, np.vstack([s, s2]) / 1.0, t0, gain)
def crash(t0, gain=0.08, dur=5.0, bus='sfx'):
    n = int(dur * SR); t = np.arange(n) / SR
    a = np.exp(-t / 1.4) * (1 - np.exp(-t / 0.003))
    s = np.vstack([hp(noise(n), 2500), hp(noise(n), 2500)]) * a
    s = lp(s, 9000)
    place(bus, s, t0, gain)
def click(t0, gain=0.03, pan=0.0, f=4200, bus='sfx'):
    n = int(0.06 * SR); t = np.arange(n) / SR
    s = hp(noise(n), 3000) * np.exp(-t / 0.0025) + 0.5 * np.sin(2 * np.pi * f * t) * np.exp(-t / 0.012)
    place(bus, s, t0, gain, pan)
def tone_glide(t0, dur, fa, fb, gain=0.03, p0=0.0, p1=0.0, att=0.05, rel=0.5, tilt=3.0, bus='music'):
    n = int(dur * SR); u = np.arange(n) / n
    f = fa * (fb / fa) ** u
    s = osc(f, n, tilt=tilt, maxf=6000) * ar(n, att, rel)
    place_pan(bus, s, t0, p0, p1, gain)
def choir(notes, t0, dur, gain=0.05, att=2.0, rel=3.0, bus='music'):
    n = int((dur + rel) * SR); out = np.zeros((2, n))
    for j, m in enumerate(notes):
        f = hz(m); t = np.arange(n) / SR
        for v in range(3):
            lfo = 1 + 0.004 * np.sin(2 * np.pi * (5.1 + 0.3 * v) * t + v)
            s = osc(f * (1 + (v - 1) * 0.004) * lfo, n, tilt=1.0, maxf=8000)
            fm = bp(s, 600, 850) * 1.0 + bp(s, 1050, 1350) * 0.5 + bp(s, 2400, 2800) * 0.25
            l, r = panlaw((v - 1) * 0.7); out[0] += fm * l; out[1] += fm * r
    out *= ar(n, att, rel, hold=dur) * gain / math.sqrt(len(notes) * 3)
    place(bus, out, t0)
def creak(t0, gain=0.04, pan=0.0):
    d = rng.uniform(0.35, 0.9); n = int(d * SR); t = np.arange(n) / SR
    f0 = rng.uniform(260, 900)
    grains = np.zeros(n)
    k = 0.0
    while k < d:
        i = int(k * SR); g = int(0.004 * SR)
        if i + g < n: grains[i:i + g] += noise(g) * np.hanning(g)
        k += rng.uniform(0.004, 0.02) * (1 + 2 * k / d)
    s = bp(grains, f0 * 0.85, f0 * 1.2, order=2) * 3 + lp(grains, 300) * 0.5
    s *= ar(n, 0.02, d * 0.4)
    place('amb', s, t0, gain, pan)

# ---------------------------------------------------------------- MUSIC
def arp(t0, t1, chords, step, gain=0.04, octave=12, bright=0.9, fade_in=2.0, pattern=(0, 2, 1, 3, 2, 1), bus='music'):
    """chords: list of (time, [notes]) ; plays chord tones one step at a time"""
    t = t0; i = 0
    while t < t1:
        ch = [c for c in chords if c[0] <= t + 1e-6][-1][1]
        notes = [midi(x) + octave for x in ch]
        m = notes[pattern[i % len(pattern)] % len(notes)]
        v = gain * (0.75 + 0.25 * rng.random()) * min(1.0, (t - t0) / fade_in + 0.15) * min(1.0, (t1 - t) / 1.5)
        pluck(m, t, v, dur=1.8, bright=bright, pan=0.45 * math.sin(i * 1.7), bus=bus)
        t += step; i += 1
def ostinato(t0, t1, roots, step, gain=0.04, cut0=600, cut1=1500, pattern=(0, 12, 7, 12), bus='music'):
    t = t0; i = 0
    while t < t1:
        r = midi([c for c in roots if c[0] <= t + 1e-6][-1][1])
        m = r + pattern[i % len(pattern)]
        n = int(0.3 * SR); tt = np.arange(n) / SR
        s = osc(hz(m), n, tilt=1.0, maxf=4000)
        cf = cut0 + (cut1 - cut0) * (t - t0) / max(1e-3, t1 - t0)
        s = lp(s, cf) * np.exp(-tt / 0.11) * (1 - np.exp(-tt / 0.002))
        acc = 1.0 if i % 4 == 0 else 0.7
        place(bus, s, t, gain * acc, 0.25 * math.sin(i * 0.9))
        t += step; i += 1
def pulses(t0, t1, period, gain=0.12):
    t = t0
    while t < t1:
        boom(t, gain, f0=62, f1=38, dur=0.9, decay=0.28, noise_amt=0.05, bus='music'); t += period

def compose():
    # A · cold open
    pad(['D2', 'A2'], 0.0, 13.6, 0.085, att=4.0, rel=3.0, cutoff=420, tilt=1.6)
    pad(['A4', 'C#5', 'E5', 'F#5'], 2.0, 11.0, 0.045, att=5.0, rel=3.0, cutoff=2600, tilt=2.0, vib=0.004)
    pad(['D3', 'A3', 'F#4'], 4.6, 9.0, 0.05, att=3.5, rel=2.5, cutoff=1300)
    for k in range(10):
        t = 8.5 + k * 0.47 + rng.uniform(-0.08, 0.08)
        bell(['D6', 'E6', 'F#6', 'A6', 'B6', 'C#7', 'E7'][int(rng.integers(0, 7))], t, 0.012, dur=3, pan=rng.uniform(-0.7, 0.7), decay=1.2)
    # B · question / title
    pad(['B1', 'F#2'], 15.0, 3.6, 0.13, att=2.0, rel=1.5, cutoff=420)
    pad(['D4', 'F#4', 'C#5'], 15.0, 3.6, 0.05, att=2.5, rel=1.5, cutoff=1800)
    pad(['G1', 'D2'], 18.6, 2.4, 0.13, att=0.8, rel=0.6, cutoff=420)
    pad(['B3', 'F#4', 'C#5'], 18.6, 2.4, 0.05, att=0.8, rel=0.6, cutoff=2200)
    pad(['D1', 'D2', 'A2'], 21.0, 0.6, 0.22, att=0.03, rel=6.5, cutoff=380)
    pad(['D3', 'A3', 'F#4', 'A4', 'E5'], 21.0, 0.8, 0.11, att=0.04, rel=6.0, cutoff=2400)
    pad(['A4', 'D5', 'E5'], 21.4, 4.0, 0.03, att=2.5, rel=2.0, cutoff=3000, tilt=2.2)
    for t, m in [(22.2, 'A5'), (23.1, 'F#5'), (24.0, 'E5'), (25.2, 'D5')]: bell(m, t, 0.05, dur=5, decay=2.2, pan=0.1)
    # C1 · ghost particle
    C1 = [(27.0, ['D3', 'A3', 'C#4', 'F#4']), (31.0, ['B2', 'F#3', 'A3', 'C#4', 'D4']), (35.0, ['G2', 'D3', 'F#3', 'A3', 'B3']), (39.0, ['A2', 'E3', 'A3', 'D4']), (41.0, ['A2', 'E3', 'A3', 'C#4'])]
    bass1 = {27.0: 'D2', 31.0: 'B1', 35.0: 'G1', 39.0: 'A1', 41.0: 'A1'}
    for i, (t, ch) in enumerate(C1):
        d = (C1[i + 1][0] if i + 1 < len(C1) else 43.4) - t
        pad(ch, t, d, 0.06, att=1.6, rel=1.8, cutoff=1500)
        pad([bass1[t]], t, d, 0.1, att=1.5, rel=1.8, cutoff=300)
    arp(28.0, 43.0, C1, 60 / 140 / 2 * 2, gain=0.035, octave=12)
    pulses(28.0 + 2 * 60 / 140, 42.6, 2 * 60 / 140, 0.09)
    # C2 · messengers
    C2 = [(43.2, ['E2', 'B2', 'D3', 'F#3', 'G3']), (47.0, ['G2', 'D3', 'F#3', 'B3']), (51.0, ['F#2', 'D3', 'A3', 'E4']), (55.0, ['B2', 'F#3', 'A3', 'D4']), (57.5, ['A2', 'E3', 'A3', 'C#4'])]
    for i, (t, ch) in enumerate(C2):
        d = (C2[i + 1][0] if i + 1 < len(C2) else 59.6) - t
        pad(ch, t, d, 0.055, att=1.8, rel=2.0, cutoff=1400)
    arp(43.4, 54.5, C2, 60 / 140, gain=0.022, octave=12, pattern=(0, 2, 3, 1))
    pulses(43.4, 54.0, 60 / 70, 0.06)
    # D1 · surface
    pad(['D2', 'A2'], 60.0, 9.2, 0.09, att=3.0, rel=1.2, cutoff=380)
    pad(['A5', 'D6', 'E6'], 60.5, 8.6, 0.018, att=3.0, rel=1.2, cutoff=6000, tilt=2.5, trem=0.4)
    # D2 · descent
    pad(['D1', 'A1', 'D2'], 69.5, 11.6, 0.12, att=1.0, rel=1.5, cutoff=260)
    pad(['D3', 'F3', 'A3', 'C4'], 74.5, 6.8, 0.04, att=3.0, rel=1.5, cutoff=1000)
    # D3 · array
    D3 = [(81.5, ['Bb1', 'F2', 'D3', 'A3', 'C4']), (86.0, ['A1', 'F2', 'C3', 'A3', 'F4']), (90.0, ['C2', 'G2', 'E3', 'A3', 'D4']), (94.0, ['D2', 'A2', 'E3', 'A3', 'D4'])]
    for i, (t, ch) in enumerate(D3):
        d = (D3[i + 1][0] if i + 1 < len(D3) else 97.6) - t
        pad(ch, t, d, 0.065, att=1.8, rel=2.2, cutoff=1500 + i * 250)
    ostinato(86.2, 97.2, [(86.0, 'A1'), (90.0, 'C2'), (94.0, 'D2')], 60 / 140 / 2, gain=0.035, cut0=500, cut1=1300)
    pad(['A4', 'D5', 'E5', 'A5'], 92.4, 5.0, 0.04, att=3.0, rel=1.8, cutoff=4000, tilt=1.8)
    # E · DOM
    pad(['G2', 'D3', 'F#3', 'B3'], 98.0, 6.5, 0.045, att=2.0, rel=2.0, cutoff=1100)
    pad(['F#2', 'D3', 'A3', 'E4'], 104.5, 6.3, 0.045, att=2.0, rel=1.6, cutoff=1100)
    for t, m in [(99.0, 'D5'), (100.2, 'A4'), (101.4, 'F#5'), (102.6, 'E5'), (104.4, 'D5'), (105.6, 'B4'), (106.8, 'A4'), (108.4, 'F#4')]:
        pluck(m, t, 0.05, dur=3.0, bright=0.5, pan=0.15)
    # F · Cherenkov
    pad(['A1', 'E2'], 111.0, 4.8, 0.13, att=2.0, rel=0.6, cutoff=320)
    pad(['A3', 'Bb3', 'E4'], 111.0, 4.4, 0.025, att=3.0, rel=0.8, cutoff=900)
    pad(['D2', 'A2', 'F#3', 'A3'], 115.6, 12.4, 0.07, att=1.5, rel=2.0, cutoff=900)
    pad(['D5', 'F#5', 'A5', 'E6'], 116.2, 8.0, 0.04, att=3.5, rel=3.0, cutoff=6000, tilt=1.8, trem=0.5)
    F1 = [(128.0, ['B1', 'F#2', 'A3', 'D4']), (131.0, ['G1', 'D2', 'B3', 'F#4']), (134.0, ['E2', 'B2', 'G3', 'F#4']), (137.0, ['A1', 'E2', 'D4', 'E4']), (141.0, ['D2', 'A2', 'F#3', 'C#4', 'E4'])]
    for i, (t, ch) in enumerate(F1):
        d = (F1[i + 1][0] if i + 1 < len(F1) else 144.8) - t
        pad(ch, t, d, 0.06, att=1.6, rel=1.8, cutoff=1300)
    arp(128.5, 144.4, F1, 60 / 120, gain=0.02, octave=24, pattern=(0, 3, 2, 1), bright=1.3)
    # G1 · background
    G1 = [(145.0, ['D2', 'A2', 'F3', 'A3']), (149.0, ['Bb1', 'F2', 'D3', 'F3']), (152.5, ['C2', 'G2', 'E3', 'G3'])]
    for i, (t, ch) in enumerate(G1):
        d = (G1[i + 1][0] if i + 1 < len(G1) else 156.2) - t
        pad(ch, t, d, 0.06, att=1.0, rel=1.2, cutoff=1000)
    ostinato(145.4, 156.0, [(145.0, 'D2'), (149.0, 'Bb1'), (152.5, 'C2')], 0.125, gain=0.04, cut0=450, cut1=1700, pattern=(0, 12, 7, 12, 3, 12, 7, 10))
    sweep(152.2, 4.0, 200, 3000, 0.05, shape='swell', bw=0.8)
    # G2 · veto
    G2 = [(156.2, ['D2', 'A2', 'E3', 'F3', 'C4']), (160.4, ['Bb1', 'F2', 'D3', 'A3']), (163.6, ['F2', 'C3', 'A3', 'E4']), (167.6, ['G2', 'D3', 'F3', 'A3', 'Bb3']), (170.0, ['A1', 'E2', 'G3', 'D4'])]
    for i, (t, ch) in enumerate(G2):
        d = (G2[i + 1][0] if i + 1 < len(G2) else 172.2) - t
        pad(ch, t, d, 0.06, att=1.2, rel=1.6, cutoff=1100)
    ostinato(156.2, 162.8, [(156.2, 'D2'), (160.4, 'Bb1')], 0.125, gain=0.03, cut0=900, cut1=700, pattern=(0, 12, 7, 12, 3, 12, 7, 10))
    arp(165.2, 172.0, [(163.6, ['F3', 'C4', 'A4', 'E5']), (167.6, ['G3', 'D4', 'F4', 'Bb4']), (170.0, ['A3', 'E4', 'G4', 'D5'])], 0.25, gain=0.03, octave=0)
    # H · discovery
    H1 = [(172.0, ['D2', 'A2', 'F3', 'C4', 'E4']), (177.4, ['Bb1', 'F2', 'D3', 'A3']), (181.0, ['G1', 'D2', 'Bb3', 'D4', 'A4']), (185.4, ['Bb1', 'F2', 'A3', 'D4', 'E4']),
          (186.9, ['F2', 'C3', 'A3', 'G4', 'C5']), (189.8, ['Bb1', 'F2', 'D3', 'A3', 'C4']), (191.8, ['C2', 'G2', 'E3', 'G3', 'C4']), (193.2, ['A1', 'E2', 'D3', 'G3', 'E4'])]
    for i, (t, ch) in enumerate(H1):
        d = (H1[i + 1][0] if i + 1 < len(H1) else 194.6) - t
        pad(ch, t, d, 0.065 + 0.012 * i, att=1.2 if i else 2.0, rel=1.2, cutoff=1100 + 180 * i)
    ostinato(181.2, 189.7, [(181.0, 'G1'), (185.4, 'Bb1'), (186.9, 'F1')], 0.25, gain=0.035, cut0=500, cut1=1100)
    ostinato(189.8, 194.5, [(189.8, 'Bb1'), (191.8, 'C2'), (193.2, 'A1')], 0.125, gain=0.045, cut0=900, cut1=2400, pattern=(0, 12, 7, 12, 0, 12, 10, 12))
    pulses(189.8, 194.4, 0.5, 0.12)
    # climax
    pad(['D1', 'D2'], 194.6, 5.4, 0.22, att=0.04, rel=2.4, cutoff=300)
    pad(['D3', 'A3', 'D4', 'F#4', 'A4', 'C#5', 'E5', 'F#5'], 194.6, 5.6, 0.14, att=0.06, rel=2.4, cutoff=3200, voices=4)
    choir(['A3', 'D4', 'F#4', 'A4'], 194.8, 5.4, 0.08, att=1.2, rel=2.4)
    for t, m in [(196.0, 'A5'), (196.9, 'F#5'), (197.8, 'E5'), (199.0, 'D5')]: bell(m, t, 0.06, dur=5, decay=2.4)
    # I · epilogue
    I1 = [(201.0, ['G1', 'D2', 'B3', 'F#4', 'A4']), (204.5, ['F#1', 'D2', 'A3', 'D4', 'E4']), (208.0, ['E2', 'B2', 'G3', 'D4', 'F#4']), (211.5, ['A1', 'E2', 'D4', 'E4', 'A4'])]
    for i, (t, ch) in enumerate(I1):
        d = (I1[i + 1][0] if i + 1 < len(I1) else 214.5) - t
        pad(ch, t, d, 0.06, att=2.0, rel=2.2, cutoff=1300)
    pad(['D1', 'D2', 'A2', 'F#3', 'C#4', 'E4', 'A4'], 214.5, 4.6, 0.07, att=2.0, rel=3.0, cutoff=1500)
    arp(201.6, 212.0, I1, 60 / 66, gain=0.03, octave=12, bright=0.6, pattern=(0, 2, 4, 3, 1, 2))
    pad(['F#4', 'A4', 'D5', 'E5'], 210.0, 6.0, 0.04, att=3.0, rel=2.5, cutoff=4500, tilt=1.8)

# ---------------------------------------------------------------- SFX from cues
PENTA = ['D', 'E', 'F#', 'A', 'B']
def penta(i, base_oct=5):
    return f"{PENTA[i % 5]}{base_oct + i // 5}"
def depthAt(lt):
    io = lambda x: 4 * x ** 3 if x < .5 else 1 - (-2 * x + 2) ** 3 / 2
    sm = lambda a, b, x: (lambda u: u * u * (3 - 2 * u))(min(1, max(0, (x - a) / (b - a))))
    if lt < 5.6: return 10 + (1420 - 10) * io(min(1, max(0, lt / 5.6)))
    return 1420 + (2405 - 1420) * (io(min(1, max(0, (lt - 5.6) / 6.4))) * 0.6 + sm(0, 6.4, lt - 5.6) * 0.4)

last_pass = -9
def sfx(c):
    global last_pass
    t, ty = c['t'], c['type']; pan = c.get('pan', 0.0)
    if ty == 'bell': bell(c.get('note', 74), t, 0.06 * c.get('vel', 0.5) / 0.5, dur=7, decay=2.6)
    elif ty == 'streak_whoosh': sweep(t, 2.2, 300, 5000, 0.07, shape='whoosh', p0=0, p1=0); tone_glide(t + 0.2, 1.9, 1760, 880, 0.012, att=0.4, rel=1.2, tilt=4)
    elif ty == 'riser': sweep(t, c['dur'], 180, 7000, 0.07, shape='swell', bw=0.7); cymbal_swell(t, c['dur'], 0.05); tone_glide(t, c['dur'], 220, 880, 0.015, att=c['dur'] * 0.8, rel=0.05, tilt=2)
    elif ty == 'impact': boom(t, 0.75, f0=80, f1=31, dur=5, decay=1.6); crash(t, 0.05, dur=6); sweep(t, 3.0, 2500, 300, 0.05, shape='fall', bw=1.0)
    elif ty == 'chapter': sweep(t, 1.6, 2000, 6000, 0.018, shape='whoosh', bw=0.4); glass('A6', t + 0.15, 0.015, pan=-0.6)
    elif ty == 'pass':
        if t - last_pass < 1.2: return
        last_pass = t; sweep(t, 0.9, 500, 2800, 0.045, shape='whoosh', p0=-0.8, p1=0.8)
    elif ty == 'emit':
        k = c['kind']
        if k == 'photon': tone_glide(t, 1.2, 1600, 2200, 0.02, p0=-0.6, p1=-0.3, att=0.02, rel=0.5, tilt=4); glass('A6', t, 0.025, pan=-0.6)
        if k == 'proton':
            n = int(3.4 * SR); tt = np.arange(n) / SR
            s = lp(osc(110 * (1 + 0.25 * tt), n, tilt=1.0, maxf=3000), 700) * ar(n, 0.05, 1.5)
            place_pan('sfx', s, t, -0.6, 0.4, 0.035)
        if k == 'nu':
            n = int(3.0 * SR); tt = np.arange(n) / SR
            s = (np.sin(2 * np.pi * 1318.5 * tt) + 0.3 * np.sin(2 * np.pi * 2637 * tt + 0.3 * np.sin(2 * np.pi * 5 * tt))) * ar(n, 0.15, 0.6)
            place_pan('sfx', s, t, -0.7, 0.7, 0.03)
    elif ty == 'absorb': sweep(t, 1.4, 1500, 300, 0.04, shape='fall', p0=-0.3, bw=0.8)
    elif ty == 'deflect': sweep(t, c['dur'], 600, 1800, 0.035, shape='whoosh', p0=0.0, p1=0.5, bw=0.5)
    elif ty == 'arrive': bell('D5', t, 0.05, decay=2.2, pan=0.6); bell('A5', t + 0.06, 0.035, decay=2.0, pan=0.6); boom(t, 0.18, f0=70, f1=40, dur=2, decay=0.6, noise_amt=0.1, pan=0.4)
    elif ty == 'wind':
        n = int(c['dur'] * SR); x = pink(n); y = pink(n)
        lfo = 0.6 + 0.4 * np.sin(2 * np.pi * np.arange(n) / SR * 0.17 + 1.0) * np.sin(2 * np.pi * np.arange(n) / SR * 0.05)
        s = np.vstack([bp(x, 250, 1400), bp(y, 280, 1500)]) * lfo * ar(n, 1.5, 1.0)
        s += np.vstack([hp(noise(n), 4000), hp(noise(n), 4000)]) * 0.08 * lfo * ar(n, 1.5, 1.0)
        place('amb', s, t, 0.09)
    elif ty == 'drill':
        n = int(c['dur'] * SR); tt = np.arange(n) / SR
        hum = lp(osc(55 * (1 + 0.003 * np.sin(2 * np.pi * 0.3 * tt)), n, tilt=1.1, maxf=2000), 420)
        pump = 0.7 + 0.3 * np.sin(2 * np.pi * 1.15 * tt)
        hiss = bp(noise(n), 1800, 5000) * 0.35 * (0.8 + 0.2 * np.sin(2 * np.pi * 0.4 * tt))
        s = lp((hum * pump + hiss), 2200) * ar(n, 2.0, 1.0)
        place('amb', s, t, 0.05, 0.05)
    elif ty == 'plunge':
        sweep(t, c['dur'], 5000, 160, 0.09, shape='whoosh', bw=0.9)
        boom(t + c['dur'] - 0.3, 0.35, f0=60, f1=28, dur=3, decay=1.0, noise_amt=0.4)
    elif ty == 'descent':
        d = c['dur']; n = int(d * SR); tt = np.arange(n) / SR
        dep = np.array([depthAt(x) for x in tt[::480]]); vel = np.abs(np.gradient(dep, 0.01)); vel = np.interp(tt, tt[::480], vel)
        g = vel / vel.max()
        rum = np.vstack([lp(brown(n), 140), lp(brown(n), 140)]) * (0.25 + 0.75 * g)
        air = np.vstack([bp(pink(n), 300, 1600), bp(pink(n), 300, 1600)]) * (0.05 + 0.4 * g ** 1.5)
        place('amb', (rum + air) * ar(n, 0.3, 1.0), t, 0.11)
        for k in range(9): creak(t + 1.2 + k * 1.15 + rng.uniform(-0.3, 0.3), 0.05, pan=rng.uniform(-0.8, 0.8))
    elif ty == 'dom_pass': glass(penta(c['k'] % 10 + 2, 5), t, 0.012 * c.get('gain', 1), pan=0.35, dur=1.2)
    elif ty == 'threshold': bell('D4', t, 0.05, decay=3); bell('A4', t + 0.05, 0.04, decay=3); bell('E5', t + 0.1, 0.03, decay=3); sweep(t - 0.6, 1.4, 400, 3000, 0.03)
    elif ty == 'string_drop':
        r = c['r']; idx = int(r / 86 * 13) + (r % 3)
        pluck(penta(idx, 4), t, 0.03 + 0.012 * (r % 4 == 0), dur=1.6, bright=1.4, pan=pan * 0.8, bus='sfx')
    elif ty == 'stat_tick': click(t, 0.025, 0.4); glass('A6', t, 0.02, pan=0.4)
    elif ty == 'label_tick': click(t, 0.02, 0.3); glass('E6', t, 0.015, pan=0.3)
    elif ty == 'draw_sweep': sweep(t, c['dur'], 400, 3500, 0.02, shape='whoosh', bw=0.6)
    elif ty == 'photon_ping': glass(['A5', 'D6', 'E6', 'F#6'][int(c['q'] * 3.99)], t, 0.022, pan=-0.25)
    elif ty == 'nu_approach': sweep(t, c['dur'], 150, 2600, 0.05, shape='swell', bw=0.6, p0=-0.6, p1=0.0); tone_glide(t, c['dur'], 220, 440, 0.012, att=c['dur'] * 0.9, rel=0.05)
    elif ty == 'vertex': boom(t, 0.7, f0=85, f1=30, dur=5, decay=1.4, noise_amt=0.5); crash(t, 0.035, dur=4); [bell(m, t + 0.02 * i, 0.04, decay=2.5, pan=(i - 1) * 0.4) for i, m in enumerate(['A4', 'E5', 'B5'])]
    elif ty == 'muon':
        n = int(c['dur'] * SR); tt = np.arange(n) / SR
        s = np.sin(2 * np.pi * 1760 * tt) * 0.5 + 0.3 * lp(osc(220, n, tilt=1.0, maxf=6000), 1500) * 0.4
        s = s * ar(n, 0.05, 3.0)
        place_pan('sfx', s, t, -0.5, 0.6, 0.02)
    elif ty == 'cone_swell': sweep(t, 3.0, 800, 6000, 0.02, shape='swell', bw=0.5)
    elif ty == 'hit_ping':
        u = c.get('u', 0.5); q = c.get('q', 0.5)
        glass(penta(int(u * 9) + 1, 5), t, 0.006 + 0.016 * q, pan=pan)
    elif ty == 'track_zip': sweep(t, c['dur'], 400, 5000, 0.05, shape='whoosh', p0=pan - 0.4, p1=pan + 0.4, bw=0.5)
    elif ty == 'cascade_bloom': boom(t, 0.3, f0=70, f1=36, dur=3, decay=0.9, noise_amt=0.15, pan=pan * 0.5); sweep(t - 0.6, 1.0, 300, 2000, 0.03, shape='swell', p0=pan); bell('D4', t, 0.03, pan=pan); bell('A4', t + 0.04, 0.025, pan=pan)
    elif ty == 'cr_hit': boom(t, 0.06, f0=95, f1=50, dur=0.9, decay=0.25, noise_amt=0.3, pan=pan); sweep(t, 0.35, 1500, 3500, 0.012, shape='fall', p0=pan)
    elif ty == 'mu_click': click(t, 0.014, pan=pan, f=rng.uniform(3500, 5200))
    elif ty == 'shell_on': bell('D4', t, 0.03, decay=2.5, pan=-0.2); bell('A3', t + 0.1, 0.03, decay=2.5, pan=0.2); sweep(t, 1.6, 600, 2400, 0.015)
    elif ty == 'reject':
        boom(t, 0.3, f0=60, f1=34, dur=2.5, decay=0.7, noise_amt=0.3)
        n = int(1.4 * SR); tt = np.arange(n) / SR
        s = lp(osc(hz('C#2'), n, tilt=1.0, maxf=2000) + osc(hz('D2'), n, tilt=1.0, maxf=2000), 500) * np.exp(-tt / 0.4)
        place('sfx', s, t, 0.05); tone_glide(t + 0.05, 0.6, 880, 698, 0.012, att=0.01, rel=0.3)
    elif ty == 'accept': [bell(m, t + 0.07 * i, 0.05, decay=2.6, pan=(i - 1) * 0.3) for i, m in enumerate(['D5', 'F#5', 'A5'])]
    elif ty == 'pev_boom':
        big = c.get('big', 0)
        sweep(t - 0.9, 0.95, 200, 2500, 0.04 + 0.03 * big, shape='swell')
        boom(t, 0.6 + 0.3 * big, f0=80, f1=29, dur=6, decay=1.5 + 0.8 * big, noise_amt=0.45, pan=pan * 0.5)
        crash(t, 0.03 + 0.04 * big, dur=5)
        notes = ['D4', 'A4', 'D5', 'F#5'] if big else (['D4', 'A4', 'E5'] if pan < 0 else ['E4', 'B4', 'F#5'])
        for i, m in enumerate(notes): bell(m, t + 0.03 * i, 0.05, decay=3.0, pan=pan * 0.5 + (i - 1) * 0.2)
    elif ty == 'bead': i = c['i']; glass(penta(i % 15 + 3, 4), t, 0.022, pan=-0.4 + 0.8 * (i % 26) / 26, dur=1.0); click(t, 0.01, 0)
    elif ty == 'expected': bell('A3', t, 0.04, decay=2.0, ratio=1.0, index=0.8, pan=-0.2)
    elif ty == 'sigma4': boom(t, 0.3, f0=70, f1=36, dur=3, decay=0.9); crash(t, 0.02, 3)
    elif ty == 'climax':
        boom(t, 1.0, f0=90, f1=28, dur=8, decay=2.2, noise_amt=0.6); crash(t, 0.09, dur=7)
        sweep(t, 4.0, 3000, 400, 0.04, shape='fall', bw=1.2)
    elif ty == 'source_chime':
        i = c['i']; ms = [('D5', 'A5'), ('E5', 'B5'), ('F#5', 'C#6')][i]
        bell(ms[0], t, 0.05, decay=3.0, pan=-0.3); bell(ms[1], t + 0.08, 0.035, decay=3.0, pan=0.3); sweep(t - 0.2, 1.4, 500, 3000, 0.015)
    elif ty == 'final_swell': sweep(t, 2.5, 200, 2500, 0.02, shape='swell')
    elif ty == 'name_swell': sweep(t - 1.2, 1.4, 200, 1800, 0.025, shape='swell', bw=0.8)
    elif ty == 'rain_bed':
        d = c['dur']; n = int(d * SR); tt = np.arange(n) / SR
        imp = np.zeros((2, n)); rate = 15 + 70 * (tt / d)
        k = 0.0
        while k < d - 0.01:
            i = int(k * SR); imp[int(rng.integers(0, 2)), i] += rng.uniform(0.3, 1.0)
            k += rng.exponential(1.0 / (15 + 70 * k / d))
        cr = bp(imp, 2200, 9000) * 2.0
        wash = np.vstack([bp(pink(n), 800, 5000), bp(pink(n), 800, 5000)]) * 0.04 * (0.4 + 0.6 * tt / d)
        place('amb', (cr + wash) * ar(n, 1.0, 1.0), t, 0.18)
    # bed cues are scored in compose()

def reverb_ir(rt=3.6, seed=3):
    r = np.random.default_rng(seed); n = int(rt * SR); t = np.arange(n) / SR
    ir = np.zeros((2, n))
    for c in range(2):
        b = lp(r.standard_normal(n), 7000); d = lp(r.standard_normal(n), 1800)
        ir[c] = b * np.exp(-t / (rt / 6.9 * 0.55)) + 0.9 * d * np.exp(-t / (rt / 6.9))
        ir[c] *= (1 - np.exp(-t / 0.012))
        for k in range(10):
            i = int(r.uniform(0.008, 0.07) * SR); ir[c, i] += r.uniform(-0.6, 0.6) * 3
    ir /= np.sqrt(np.sum(ir ** 2, axis=1, keepdims=True))
    return ir

def main():
    compose()
    for c in cues: sfx(c)
    ir = reverb_ir()
    wet = np.zeros((2, N))
    BUS['music'] = BUS['music'] - 0.45 * lp(BUS['music'], 140, order=2)
    for bus, amt in (('music', 0.55), ('sfx', 0.38), ('amb', 0.25)):
        x = BUS[bus]
        for ch in range(2): wet[ch] += ss.oaconvolve(x[ch] * amt, ir[ch])[:N]
    dry = BUS['music'] * 0.8 + BUS['sfx'] * 0.85 + BUS['amb'] * 0.9 + BUS['dry']
    mix = dry + wet * 0.9
    mix = hp(mix, 24, order=2)
    # gentle glue compression (RMS follower) + soft clip
    env = np.sqrt(lp(np.mean(mix ** 2, axis=0), 6.0, order=1).clip(1e-10))
    thr = np.percentile(env, 97)
    g = np.where(env > thr, (thr / env) ** 0.35, 1.0)
    mix *= g
    mix /= np.max(np.abs(mix)) + 1e-9
    mix = np.tanh(mix * 1.15) / np.tanh(1.15)
    # fade tail
    nt = int(DUR * SR); mix = mix[:, :nt]
    fo = int(1.6 * SR); mix[:, -fo:] *= np.linspace(1, 0, fo) ** 2
    mix *= 0.89
    wavfile.write(sys.argv[2] if len(sys.argv) > 2 else 'score.wav', SR, mix.T.astype(np.float32))
    # loudness profile for checking
    sec = mix.reshape(2, -1, SR)[:, :int(DUR)].mean(axis=0) if False else None
    rms = [20 * np.log10(np.sqrt(np.mean(mix[:, i * SR:(i + 1) * SR] ** 2)) + 1e-9) for i in range(int(DUR))]
    print('rms dB per 6s:', ' '.join(f'{np.mean(rms[i:i+6]):.0f}' for i in range(0, int(DUR), 6)))

if __name__ == '__main__':
    main()
