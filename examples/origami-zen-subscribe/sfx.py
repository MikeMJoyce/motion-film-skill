"""Synthesised sound for the plate: paper unfold, mouse clicks, a koto pluck on "Subscribed",
a temple-style bell with petal chimes, paper fold at the end. Writes out/sfx.wav (48 kHz stereo, 6 s).
Times mirror the T object in plate.html. Only numpy is needed:  python3 sfx.py
"""
import wave
from pathlib import Path

import numpy as np

SR, DUR = 48000, 6.0
T = dict(inn=0.12, click1=2.12, subscribed=2.22, click2=3.30, bell=3.38, out=5.22)
# horizontal position on screen -> stereo pan (-1 left .. 1 right)
PAN_BTN, PAN_BELL = (1243 / 1920 - .5) * 1.2, (1472 / 1920 - .5) * 1.2
rng = np.random.default_rng(11)
mix = np.zeros((int(SR * DUR), 2))


def band(x, lo, hi):
    """Band-pass by zeroing FFT bins outside [lo, hi] with soft edges."""
    f = np.fft.rfftfreq(len(x), 1 / SR)
    g = np.clip((f - lo * .7) / (lo * .3), 0, 1) * np.clip((hi * 1.3 - f) / (hi * .3), 0, 1)
    return np.fft.irfft(np.fft.rfft(x) * g, len(x))


def put(sig, t, gain=1.0, pan=0.0):
    i = int(t * SR)
    sig = sig[: max(0, len(mix) - i)] * gain
    l, r = np.sqrt((1 - pan) / 2), np.sqrt((1 + pan) / 2)  # equal-power pan
    mix[i : i + len(sig), 0] += sig * l
    mix[i : i + len(sig), 1] += sig * r


def env(n, a, d):
    t = np.arange(n) / SR
    return np.minimum(t / a, 1) * np.exp(-t / d)


def paper(length, reverse=False):
    """Crisp paper rustle: band-limited noise with a crackle of small grains."""
    n = int(length * SR)
    t = np.arange(n) / SR
    shape = np.sin(np.pi * np.clip(t / length, 0, 1)) ** 1.5
    crackle = (rng.random(n) < 0.004) * rng.normal(0, 3, n)
    x = band(rng.normal(0, 1, n), 1800, 9000) * shape + band(crackle, 2500, 12000) * shape
    x += band(rng.normal(0, 1, n), 300, 1200) * shape * .35  # body of the sheet
    return x[::-1] if reverse else x


def click():
    """Mouse click: press and release transients with a small plastic resonance."""
    n = int(.12 * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for off, g in ((0, 1.0), (.065, .55)):
        k = int(off * SR)
        m = n - k
        tt = t[:m]
        out[k:] += g * (band(rng.normal(0, 1, m), 2000, 12000) * np.exp(-tt / .0025)
                        + .6 * np.sin(2 * np.pi * 3100 * tt) * np.exp(-tt / .006))
    return out


def koto(freq, length=1.6):
    """Plucked string (Karplus-Strong), soft and woody."""
    n, p = int(length * SR), int(SR / freq)
    buf = band(rng.normal(0, 1, p * 8), 200, 6000)[:p]
    out = np.zeros(n)
    for i in range(n):
        out[i] = buf[i % p]
        buf[i % p] = .996 * .5 * (buf[i % p] + buf[(i + 1) % p])
    return out * env(n, .002, .7)


def bell(f0=880.0, length=2.6):
    """Small bell: inharmonic partials, the higher ones die faster, wobble follows the on-screen swing."""
    n = int(length * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for ratio, amp, dec in ((1, 1, 1.1), (2.0, .55, .7), (2.76, .45, .5), (5.40, .25, .25), (8.93, .12, .12)):
        beat = 1 + .004 * np.sin(2 * np.pi * 1.5 * t)
        out += amp * np.sin(2 * np.pi * f0 * ratio * beat * t) * np.exp(-t / dec)
    swing = 1 + .25 * np.exp(-t * 2.6) * np.sin(2 * np.pi * 3.2 * t)  # 3.2 Hz like the animation
    strike = band(rng.normal(0, 1, n), 3000, 10000) * np.exp(-t / .004)
    return (out * swing + strike * .5) * np.minimum(t / .002, 1)


def chime(f, length=1.2):
    n = int(length * SR)
    t = np.arange(n) / SR
    return (np.sin(2 * np.pi * f * t) + .3 * np.sin(2 * np.pi * f * 2.76 * t)) * env(n, .003, .35)


put(paper(.55), T['inn'] - .05, .22)
put(click(), T['click1'], .55, PAN_BTN)
put(koto(392.0), T['subscribed'], .32, PAN_BTN)          # G4
put(koto(587.3), T['subscribed'] + .09, .24, PAN_BTN)    # D5, a soft fifth
put(click(), T['click2'], .55, PAN_BELL)
put(bell(), T['bell'], .26, PAN_BELL)
# petals: a few high pentatonic chimes scattered over the burst
for i, f in enumerate((1568, 1760, 2093, 2349, 1976, 2637)):
    put(chime(f), T['bell'] + .12 + i * .11 + rng.random() * .05, .05, PAN_BELL + rng.uniform(-.25, .25))
put(paper(.6, reverse=True), T['out'], .2)

# gentle fades and peak normalisation to -1 dBFS
fade = int(.01 * SR)
mix[:fade] *= np.linspace(0, 1, fade)[:, None]
mix[-fade:] *= np.linspace(1, 0, fade)[:, None]
mix *= 10 ** (-1 / 20) / np.abs(mix).max()

out = Path(__file__).parent / 'out' / 'sfx.wav'
out.parent.mkdir(exist_ok=True)
with wave.open(str(out), 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((mix * 32767).astype('<i2').tobytes())
print(out)
