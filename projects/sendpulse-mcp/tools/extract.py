# Cut the four source slides (assets/src/scr_1..4.webp, 2000x1125) into transparent layers for the film.
# Every slide sits on one flat background colour (#023347), so:
#   - type (logo, headline words) is unmixed against that colour: alpha = |I - B| / |F - B|, colour = F;
#   - cards, pills and icons are cut with a rounded-rect mask fitted to their border;
#   - the UI groups on slides 3-4 are cut with a "differs from the background" mask, holes filled;
#   - the smooth glows behind slides 2-4 become background plates (elements removed, then blurred).
# Output: assets/cut/*.png and film/cut.js (window.CUT = {id: {x, y, w, h, src}} in source pixels).
import json, os
import numpy as np, cv2
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets/src')
OUT = os.path.join(ROOT, 'assets/cut')
os.makedirs(OUT, exist_ok=True)
BG = np.array([2, 51, 71], np.float32)
CUT = {}

def load(i):
    return np.asarray(Image.open(f'{SRC}/scr_{i}.webp').convert('RGB')).astype(np.float32)

def save(name, rgb, alpha, x, y):
    a = np.clip(alpha, 0, 1)
    ys, xs = np.nonzero(a > 0.004)
    if len(xs) == 0: raise SystemExit(f'{name}: empty')
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    rgba = np.dstack([np.clip(rgb, 0, 255), a * 255])[y0:y1, x0:x1].round().astype(np.uint8)
    Image.fromarray(rgba, 'RGBA').save(f'{OUT}/{name}.png', optimize=True)
    CUT[name] = dict(x=int(x + x0), y=int(y + y0), w=int(x1 - x0), h=int(y1 - y0), src=f'../assets/cut/{name}.png')

def unmix(img, box, fg=None, pad=6, plate=None):
    """Single-colour type over the known background: alpha from the distance to the background."""
    x0, y0, x1, y1 = box; x0 -= pad; y0 -= pad; x1 += pad; y1 += pad
    I = img[y0:y1, x0:x1]
    B = BG if plate is None else plate[y0:y1, x0:x1]
    d = np.abs(I - B).max(2)
    if fg is None:   # the element's own colour: mean of its most saturated pixels
        k = d > np.percentile(d, 99.0) * 0.9
        fg = I[k].mean(0)
    F = np.array(fg, np.float32)
    den = np.abs(F - (B if B.ndim == 1 else B)).max(-1)
    a = np.clip(d / np.maximum(den, 1), 0, 1)
    a[a < 0.03] = 0
    rgb = np.broadcast_to(F, I.shape).copy()
    save_box = (x0, y0)
    return rgb, a, save_box

def rrect_mask(h, w, r, ss=4):
    """Anti-aliased rounded rectangle, supersampled."""
    m = np.zeros((h * ss, w * ss), np.uint8)
    R = r * ss
    cv2.rectangle(m, (R, 0), (w * ss - R - 1, h * ss - 1), 255, -1)
    cv2.rectangle(m, (0, R), (w * ss - 1, h * ss - R - 1), 255, -1)
    for cx, cy in [(R, R), (w * ss - R - 1, R), (R, h * ss - R - 1), (w * ss - R - 1, h * ss - R - 1)]:
        cv2.circle(m, (cx, cy), R, 255, -1)
    return cv2.resize(m, (w, h), interpolation=cv2.INTER_AREA).astype(np.float32) / 255

def refine(img, box, search=10):
    """Snap a rough box to the element's outer border: the outermost strong edge within +-search px."""
    x0, y0, x1, y1 = box
    d = np.abs(img - BG).max(2)
    H, W = d.shape
    def edge(profile, lo, hi, outer_first):
        idx = range(lo, hi) if outer_first else range(hi - 1, lo - 1, -1)
        thr = 0.5 * max(profile[lo:hi].max(), 1)
        for i in idx:
            if profile[i] >= thr: return i
        return None
    midy = slice(max(y0 + (y1 - y0) // 3, 0), min(y1 - (y1 - y0) // 3, H))
    midx = slice(max(x0 + (x1 - x0) // 3, 0), min(x1 - (x1 - x0) // 3, W))
    col = d[midy].mean(0); row = d[:, midx].mean(1)
    nx0 = edge(col, max(x0 - search, 0), min(x0 + search, W), True) if x0 > 0 else 0
    nx1 = (edge(col, max(x1 - search, 0), min(x1 + search, W), False) + 1) if x1 < W else W
    ny0 = edge(row, max(y0 - search, 0), min(y0 + search, H), True) if y0 > 0 else 0
    ny1 = (edge(row, max(y1 - search, 0), min(y1 + search, H), False) + 1) if y1 < H else H
    return (nx0 if nx0 is not None else x0, ny0 if ny0 is not None else y0,
            nx1 if nx1 is not None else x1, ny1 if ny1 is not None else y1)

def card(img, name, box, r, snap=True, bottom_open=False):
    b = refine(img, box) if snap else box
    x0, y0, x1, y1 = b
    h, w = y1 - y0, x1 - x0
    m = rrect_mask(h + (r * 2 if bottom_open else 0), w, r)[:h]
    save(name, img[y0:y1, x0:x1], m, x0, y0)
    return b

def group(img, name, xr, yr, thr=34, extra=None, exclude=()):
    """A cluster of UI cards: everything that differs from the background inside the region, holes filled."""
    x0, x1 = xr; y0, y1 = yr
    I = img[y0:y1, x0:x1]
    d = np.abs(I - BG).max(2)
    m = (d > thr).astype(np.uint8)
    for ex0, ey0, ex1, ey1 in exclude:   # absolute source boxes owned by a neighbouring group
        m[max(ey0 - y0, 0):max(ey1 - y0, 0), max(ex0 - x0, 0):max(ex1 - x0, 0)] = 0
    n, lab, st, _ = cv2.connectedComponentsWithStats(m, connectivity=8)
    keep = np.zeros_like(m)
    for k in range(1, n):
        if st[k, cv2.CC_STAT_AREA] >= 60: keep[lab == k] = 1
    # fill holes: flood the background from the border of a padded copy
    p = cv2.copyMakeBorder(keep, 1, 1, 1, 1, cv2.BORDER_CONSTANT, value=0)
    # a region touching the frame edge must stay filled: pad with 1 where the region is the frame edge
    H, W = img.shape[:2]
    if x0 == 0: p[:, 0] = np.maximum(p[:, 0], p[:, 1])
    if x1 == W: p[:, -1] = np.maximum(p[:, -1], p[:, -2])
    if y1 == H: p[-1, :] = np.maximum(p[-1, :], p[-2, :])
    ff = p.copy(); mask = np.zeros((ff.shape[0] + 2, ff.shape[1] + 2), np.uint8)
    seeds = [(c, 0) for c in range(ff.shape[1]) if ff[0, c] == 0] + [(0, r_) for r_ in range(ff.shape[0]) if ff[r_, 0] == 0]
    seeds += [(ff.shape[1] - 1, r_) for r_ in range(ff.shape[0]) if ff[r_, -1] == 0]
    seeds += [(c, ff.shape[0] - 1) for c in range(ff.shape[1]) if ff[-1, c] == 0]
    for s in seeds:
        if ff[s[1], s[0]] == 0: cv2.floodFill(ff, mask, s, 2)
    filled = (ff != 2).astype(np.float32)[1:-1, 1:-1]
    if extra is not None: filled = np.maximum(filled, extra)
    # soft 1 px edge: alpha from the distance to the background on the rim, solid inside
    er = cv2.erode(filled, np.ones((3, 3), np.uint8))
    rim = (filled > 0) & (er == 0)
    a = filled.copy()
    a[rim] = np.clip(d[rim] / 120, 0.35, 1)
    save(name, I, a, x0, y0)

def plate(img, boxes, sigma=30):
    """Background with elements removed: normalized convolution over the visible background."""
    w = np.ones(img.shape[:2], np.float32)
    for x0, y0, x1, y1 in boxes: w[max(y0, 0):y1, max(x0, 0):x1] = 0
    num = cv2.GaussianBlur(img * w[..., None], (0, 0), sigma)
    den = cv2.GaussianBlur(w, (0, 0), sigma)[..., None]
    return num / np.maximum(den, 1e-4)

# ------------------------------------------------------------------ slide 1: logo, headline, cards, ratings
s1 = load(1)
for nm, box in [('logo_word', (640, 122, 1236, 233)), ('logo_pulse', (1236, 122, 1358, 233))]:
    rgb, a, (x, y) = unmix(s1, box, pad=4)
    save(nm, rgb, a, x, y)
WORDS = [  # line, word boxes (x0, x1); line y range
    (1, (296, 380), [(380, 792), (820, 1046), (1074, 1239), (1274, 1618)]),
    (2, (400, 504), [(500, 939), (969, 1341), (1374, 1503)]),
    (3, (505, 608), [(586, 896), (926, 1413)]),
]
for ln, (ya, yb), ws in WORDS:
    for k, (xa, xb) in enumerate(ws):
        rgb, a, (x, y) = unmix(s1, (xa, ya, xb, yb), pad=3)
        save(f'h{ln}_{k}', rgb, a, x, y)
for k, (xa, xb) in enumerate([(147, 555), (580, 988), (1013, 1421), (1446, 1854)]):
    card(s1, f'cat{k}', (xa, 659, xb, 928), 44)
card(s1, 'ratings', (147, 983, 1854, 1125), 44, bottom_open=True)

# ------------------------------------------------------------------ slide 2 (scr_4): MCP pill + six app icons, glow plate
s4 = load(4)
pill = card(s4, 'mcp_pill', (685, 481, 1315, 643), 52)
ICONS = {'claude': (291, 229, 515, 453), 'cursor': (768, 72, 992, 296), 'arc': (1507, 152, 1731, 376),
         'openai': (114, 695, 338, 919), 'copilot': (648, 868, 872, 1092), 'bot': (1568, 712, 1792, 936)}
for nm, b in ICONS.items():
    card(s4, f'ic_{nm}', b, 50)
g = s4.mean(2)
bump = g - cv2.medianBlur(g.astype(np.uint8), 9).astype(np.float32)
lines = (bump > 2).astype(np.uint8)
lines = cv2.dilate(lines, np.ones((5, 5), np.uint8))
w = (1 - lines).astype(np.float32)
for b in list(ICONS.values()) + [pill]:
    x0, y0, x1, y1 = b; w[y0 - 8:y1 + 8, x0 - 8:x1 + 8] = 0
num = cv2.GaussianBlur(s4 * w[..., None], (0, 0), 24); den = cv2.GaussianBlur(w, (0, 0), 24)[..., None]
p4 = num / np.maximum(den, 1e-4)
p4 = cv2.GaussianBlur(p4, (0, 0), 6)
glow = np.clip((p4 - BG).max(2) / 30, 0, 1)   # alpha of the orbit glow over the flat background
save('orbit_glow', np.broadcast_to(BG, p4.shape) + (p4 - BG) / np.maximum(glow[..., None], 1e-3), glow, 0, 0)

# ------------------------------------------------------------------ slides 3 and 4: pills on top, UI groups below, top glow plate
s3, s2 = load(3), load(2)
P3 = {'email': (254, 102, 554, 231), 'chatbot': (809, 107, 1191, 236), 'automation': (1383, 103, 1871, 230)}
P4 = {'popups': (180, 104, 574, 230), 'landing': (725, 104, 1276, 230), 'crm': (1510, 104, 1794, 230)}
for nm, b in P3.items(): card(s3, f'pill_{nm}', b, 62)
for nm, b in P4.items(): card(s2, f'pill_{nm}', b, 62)
group(s3, 'g3_left', (0, 724), (360, 1125), exclude=[(690, 360, 724, 372)])
group(s3, 'g3_mid', (690, 1312), (300, 940), exclude=[(690, 372, 724, 940)])
group(s3, 'g3_right', (1312, 2000), (330, 1125))
group(s2, 'g4_left', (0, 642), (300, 1125))
group(s2, 'g4_mid', (642, 1356), (290, 1125))
group(s2, 'g4_right', (1356, 2000), (360, 1125))
# top glow: slide 3 with pills and groups removed, dots removed by the blur
pt = plate(s3, [(b[0] - 10, b[1] - 10, b[2] + 10, b[3] + 14) for b in P3.values()] + [(0, 300, 2000, 1125)], sigma=22)
pt[300:] = pt[299]    # below the cards the plate is flat: repeat the last clean row, then fade it out
fade = np.clip((np.arange(1125) - 240) / 120, 0, 1)[:, None, None]
pt = pt * (1 - fade) + BG * fade
pt = cv2.GaussianBlur(pt, (0, 0), 8)
ga = np.clip((pt - BG).max(2) / 104, 0, 1)
# (the top glow is drawn in film.js: a fitted radial gradient is cleaner than this plate)

with open(os.path.join(ROOT, 'film/cut.js'), 'w') as f:
    f.write('// GENERATED by tools/extract.py: cut-out layers in source pixels (2000x1125)\nwindow.CUT = ' + json.dumps(CUT, indent=1) + ';\n')
print(len(CUT), 'layers')
for k, v in CUT.items(): print(f"  {k:14s} {v['x']:5d} {v['y']:5d} {v['w']:5d} {v['h']:5d}")
