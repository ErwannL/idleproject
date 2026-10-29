"""Illustrations HD (256×256) : le chevalier et ses 5 variantes de couleur, et les 6 familiers.

Lot « knights_pets » (voir la spec commune des illustrations HD) :
  assets/hd/hero_<id>.png  : knight, paladin, guardian, fortune_knight, berserker, dragon_knight
  assets/hd/pet_<id>.png   : golden_slime, cat, owl, fairy, golem, wisp
  tools/art/preview_hd_knights_pets.png : planche d'aperçu (illustration ×2 + sprite du jeu ×4)

Le chevalier est dessiné une seule fois avec des rampes recolorables (palette du héros, src/data/heroes.js :
B/P tabard et cape, W dorures, K plumet) ; chaque variante ajoute sa touche (arme, écu, auréole, ailes…).
Pixel art à 1× : formes en masques numpy, ombrage par la normale d'un relief (distance au bord) quantifié sur
des rampes à décalage de teinte, tramage ponctuel, contour sélectif #1a1226 (traits intérieurs teintés),
lumière en haut à gauche, liseré de lumière à droite dans la couleur d'accent.

Usage : python3 tools/art/hd_knights_pets.py
"""
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import hex2rgb, rgb2hex, mix, shift  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
OUTDIR = os.path.join(ROOT, 'assets', 'hd')
SPRITES = os.path.join(ROOT, 'assets', 'sprites')

W = H = 256
GROUND = 244
OUT = '#1a1226'
SHADOW_TINT = '#2a1f52'
YY, XX = np.mgrid[0:H, 0:W]
CHECK = ((XX + YY) % 2) == 0
LIGHT = np.array([-0.52, -0.66, 0.54])
LIGHT = LIGHT / np.linalg.norm(LIGHT)


# =============================================================== couleurs

def rgb(c):
    return np.array(hex2rgb(c) if isinstance(c, str) else c, dtype=float)


def lighten(c, d):
    return shift(c, dl=d)


def make_ramp(dark, base, light, n=6, hue=True):
    """Rampe sombre -> clair passant par base ; ombres vers le bleu-violet, lumières vers le chaud."""
    out = []
    for i in range(n):
        t = i / (n - 1)
        if t < 0.5:
            c = mix(dark, base, t * 2)
            if hue:
                c = mix(c, '#3a2a6a', 0.10 * (1 - t * 2))
        else:
            c = mix(base, light, (t - 0.5) * 2)
            if hue:
                c = mix(c, '#fff0c0', 0.10 * (t - 0.5) * 2)
        out.append(c)
    return out


def hero_ramp(B, P, n=7):
    dark = shift(mix(P, '#1a1030', 0.45), ds=0.05)
    light = shift(B, dl=0.16, ds=0.05)
    return make_ramp(dark, mix(P, B, 0.55), light, n)


def trim_ramp(Wc, n=6):
    return make_ramp(shift(mix(Wc, '#3a1a20', 0.62), ds=0.1), Wc, mix(Wc, '#fffbe8', 0.7), n)


STEEL = ['#1c2132', '#2c3448', '#46526a', '#66748a', '#8593a8', '#a3b1c2', '#c3cedb', '#e2e9f1', '#ffffff']
LEATHER = ['#2e1a1c', '#4a2a22', '#6e3f2a', '#8f5a36', '#b07a4a', '#cf9d68']
SKIN = ['#7a3e3e', '#a8604e', '#cf7f64', '#e39a78', '#f4b892', '#ffcfa6', '#ffe6cc']
HAIR = ['#24121a', '#3a2020', '#5a3424', '#7a4a30', '#9a6440', '#b98258']
UNDER = ['#1a1830', '#2b2748', '#3d3a62', '#55527e']
BLUSH = '#f28a8a'


# =============================================================== masques

def blank():
    return np.zeros((H, W), bool)


def poly(pts):
    im = Image.new('L', (W, H), 0)
    ImageDraw.Draw(im).polygon([(float(x), float(y)) for x, y in pts], fill=1)
    return np.array(im, bool)


def ell(cx, cy, rx, ry, ang=0.0):
    a = math.radians(ang)
    dx, dy = XX + 0.5 - cx, YY + 0.5 - cy
    u = dx * math.cos(a) + dy * math.sin(a)
    v = -dx * math.sin(a) + dy * math.cos(a)
    return (u / max(rx, 0.01)) ** 2 + (v / max(ry, 0.01)) ** 2 <= 1.0


def capsule(pts, widths):
    """Ruban à largeur variable le long d'une polyligne (union de disques)."""
    if not isinstance(widths, (list, tuple)):
        widths = [widths] * len(pts)
    m = blank()
    for (x0, y0), (x1, y1), w0, w1 in zip(pts, pts[1:], widths, widths[1:]):
        n = int(max(abs(x1 - x0), abs(y1 - y0)) * 2) + 2
        for i in range(n + 1):
            t = i / n
            r = (w0 + (w1 - w0) * t) / 2
            m |= ell(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r, r)
    return m


def rect(x0, y0, x1, y1):
    return (XX >= x0) & (XX <= x1) & (YY >= y0) & (YY <= y1)


def shifted(m, dx, dy):
    out = blank()
    ys = slice(max(0, dy), H + min(0, dy))
    yd = slice(max(0, -dy), H + min(0, -dy))
    xs = slice(max(0, dx), W + min(0, dx))
    xd = slice(max(0, -dx), W + min(0, -dx))
    out[ys, xs] = m[yd, xd]
    return out


def dilate(m, diag=False):
    o = m | shifted(m, 1, 0) | shifted(m, -1, 0) | shifted(m, 0, 1) | shifted(m, 0, -1)
    if diag:
        o |= shifted(m, 1, 1) | shifted(m, -1, -1) | shifted(m, 1, -1) | shifted(m, -1, 1)
    return o


def erode(m, diag=False):
    return ~dilate(~m, diag)


def dist(m, R):
    d = np.zeros((H, W))
    cur = m.copy()
    for i in range(int(R) + 1):
        if not cur.any():
            break
        d += cur
        cur = erode(cur, diag=(i % 2 == 1))
    return d


def blur(a, n=1):
    for _ in range(n):
        p = np.pad(a, 1, mode='edge')
        a = (p[:-2, :-2] + p[:-2, 1:-1] + p[:-2, 2:] + p[1:-1, :-2] + p[1:-1, 1:-1] + p[1:-1, 2:]
             + p[2:, :-2] + p[2:, 1:-1] + p[2:, 2:]) / 9.0
    return a


def spine_coords(spine, widths, bbox_pad=None):
    """Pour un ruban : masque, t (0..1 le long), s (-1..1 en travers, signe = côté)."""
    samples = []
    for i in range(len(spine) - 1):
        (x0, y0), (x1, y1) = spine[i], spine[i + 1]
        n = max(2, int(math.hypot(x1 - x0, y1 - y0) * 2))
        for k in range(n):
            u = k / n
            samples.append((x0 + (x1 - x0) * u, y0 + (y1 - y0) * u))
    samples.append(spine[-1])
    S = np.array(samples)
    tot = len(S) - 1
    seglen = np.r_[0, np.cumsum(np.hypot(*np.diff(S, axis=0).T))]
    tl = seglen / seglen[-1]
    wmax = max(widths)
    x0, x1 = int(S[:, 0].min() - wmax - 2), int(S[:, 0].max() + wmax + 3)
    y0, y1 = int(S[:, 1].min() - wmax - 2), int(S[:, 1].max() + wmax + 3)
    x0, y0 = max(0, x0), max(0, y0)
    x1, y1 = min(W, x1), min(H, y1)
    px = XX[y0:y1, x0:x1] + 0.5
    py = YY[y0:y1, x0:x1] + 0.5
    D = (px[..., None] - S[:, 0]) ** 2 + (py[..., None] - S[:, 1]) ** 2
    bi = D.argmin(-1)
    best = np.sqrt(D.min(-1))
    t = tl[bi]
    f = t * (len(widths) - 1)
    j = np.minimum(len(widths) - 2, f.astype(int))
    wa = np.array(widths)
    wv = wa[j] + (wa[j + 1] - wa[j]) * (f - j)
    a = S[np.maximum(0, bi - 1)]
    b = S[np.minimum(tot, bi + 1)]
    tx, ty = b[..., 0] - a[..., 0], b[..., 1] - a[..., 1]
    cross = tx * (py - S[bi][..., 1]) - ty * (px - S[bi][..., 0])
    side = np.where(cross > 0, 1.0, -1.0)
    mask = blank()
    T = np.zeros((H, W))
    Sg = np.zeros((H, W))
    inside = best <= wv
    mask[y0:y1, x0:x1] = inside
    T[y0:y1, x0:x1] = t
    Sg[y0:y1, x0:x1] = side * best / np.maximum(wv, 0.01)
    return mask, T, Sg


# =============================================================== ombrage

def relief(m, R, k=1.0, profile='round'):
    d = dist(m, R)
    t = np.clip(d / R, 0, 1)
    if profile == 'round':
        h = R * np.sqrt(1 - (1 - t) ** 2)
    elif profile == 'bevel':
        h = R * t
    else:
        h = R * (1 - (1 - t) ** 2)
    h = blur(h, 2)
    gy, gx = np.gradient(h)
    n = np.dstack([-gx * k, -gy * k, np.ones_like(h)])
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    return n


def lightv(n, L=LIGHT):
    return n[..., 0] * L[0] + n[..., 1] * L[1] + n[..., 2] * L[2]


def quant(v, ramp, lo, hi, dither=0.14, mask=None):
    """v -> index flottant dans la rampe, tramage en damier près des transitions."""
    n = len(ramp)
    f = np.clip((v - lo) / (hi - lo) * n, 0, n - 1e-6)
    i = np.floor(f).astype(int)
    fr = f - i
    i = np.where((fr < dither) & CHECK & (i > 0), i - 1, i)
    pal = np.array([rgb(c) for c in ramp])
    return pal[i]


def shade(m, ramp, R=8, lo=-0.35, hi=1.05, k=1.0, bias=None, dither=0.14, profile='round', L=LIGHT):
    n = relief(m, R, k, profile)
    v = lightv(n, L)
    if bias is not None:
        v = v + bias
    return quant(v, ramp, lo, hi, dither)


# =============================================================== figure

class Fig:
    def __init__(self):
        self.col = np.zeros((H, W, 3))
        self.a = blank()

    def put(self, m, colors, line=True, lc=None, shadow=None):
        """Pose une pièce. line : trait teinté autour, sur ce qui est dessous. shadow=(dx,dy,force) ombre portée."""
        if shadow:
            dx, dy, s = shadow
            sh = shifted(m, dx, dy) & ~m & self.a
            self.col[sh] = self.col[sh] * (1 - s) + rgb(SHADOW_TINT) * s
        if line:
            ring = dilate(m) & ~m & self.a
            c = rgb(lc if lc else OUT)
            self.col[ring] = c
        if isinstance(colors, np.ndarray) and colors.ndim == 3:
            self.col[m] = colors[m]
        else:
            self.col[m] = rgb(colors)
        self.a |= m

    def paint(self, m, color, alpha=1.0):
        """Détail à l'intérieur des pièces existantes (pas de nouveau pixel)."""
        m = m & self.a
        if isinstance(color, np.ndarray) and color.ndim == 3:
            self.col[m] = color[m] if alpha >= 1 else self.col[m] * (1 - alpha) + color[m] * alpha
        else:
            self.col[m] = rgb(color) if alpha >= 1 else self.col[m] * (1 - alpha) + rgb(color) * alpha

    def px(self, x, y, color):
        x, y = int(round(x)), int(round(y))
        if 0 <= x < W and 0 <= y < H:
            self.col[y, x] = rgb(color)
            self.a[y, x] = True

    def pxf(self, x, y, color):
        x, y = int(round(x)), int(round(y))
        if 0 <= x < W and 0 <= y < H and self.a[y, x]:
            self.col[y, x] = rgb(color)

    def template(self, x, y, rows, pal, force=True):
        for j, row in enumerate(rows):
            for i, ch in enumerate(row):
                if ch in pal:
                    (self.px if force else self.pxf)(x + i, y + j, pal[ch])

    def get(self, x, y):
        return rgb2hex(self.col[y, x]) if self.a[y, x] else None

    def finish(self, accent, rim=True, glow=None):
        col = self.col.copy()
        a = self.a.copy()
        if rim:
            edge = a & ~shifted(a, -1, 0)  # voisin de droite vide
            edge &= ~(shifted(edge, 0, 1) & shifted(edge, 0, -1) & False)
            acc = rgb(accent)
            col[edge] = col[edge] * 0.35 + acc * 0.65
        ring = dilate(a) & ~a
        col[ring] = rgb(OUT)
        a = a | ring
        img = np.zeros((H, W, 4), np.uint8)
        img[..., :3] = np.clip(np.round(col), 0, 255).astype(np.uint8)
        img[..., 3] = np.where(a, 255, 0)
        if glow is not None:
            # particules / effets ajoutés après le contour (déjà contourés)
            gm, gc = glow
            img[gm, :3] = gc[gm]
            img[gm, 3] = 255
        return Image.fromarray(img, 'RGBA')


def line_px(f, pts, color, force=False):
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        n = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
        for i in range(n + 1):
            t = i / n
            (f.px if force else f.pxf)(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, color)


def sparkle(f, x, y, size, cols):
    """Étincelle en croix (cols : [sombre, moyen, clair])."""
    f.px(x, y, cols[2])
    for k in range(1, size + 1):
        c = cols[1] if k < size else cols[0]
        for dx, dy in ((k, 0), (-k, 0), (0, k), (0, -k)):
            f.px(x + dx, y + dy, c)
    if size >= 3:
        for dx, dy in ((1, 1), (-1, -1), (1, -1), (-1, 1)):
            f.px(x + dx, y + dy, cols[0])


# =============================================================== chevalier

HEROES = {
    'knight': dict(B='#2f62b8', P='#1d3b78', W='#e8b64a', K='#3b7de0'),
    'paladin': dict(B='#e8e2d0', P='#a9a08a', W='#e8b64a', K='#f2d083'),
    'guardian': dict(B='#3f7f4a', P='#24502c', W='#cfd6e0', K='#63d98a'),
    'fortune_knight': dict(B='#c99a2e', P='#8a6418', W='#ffffff', K='#ffffff'),
    'berserker': dict(B='#b8322f', P='#7a1d1d', W='#e8b64a', K='#ff5a4a'),
    'dragon_knight': dict(B='#2a1f3d', P='#150f22', W='#ff8a3d', K='#ff8a3d'),
}


class Pal:
    def __init__(self, B, P, W, K, steel=None):
        self.hero = hero_ramp(B, P)
        self.trim = trim_ramp(W)
        kd = shift(mix(K, '#1a1040', 0.5), ds=0.05)
        self.plume = make_ramp(kd, K, mix(K, '#ffffff', 0.55), 6)
        self.accent = mix(K, '#ffffff', 0.45)
        self.steel = steel or STEEL
        self.line_hero = mix(self.hero[0], OUT, 0.5)
        self.line_trim = mix(self.trim[0], OUT, 0.45)
        self.line_steel = mix(self.steel[1], OUT, 0.55)


def steel_part(f, pal, m, R=8, lo=-0.5, hi=1.22, k=1.0, bias=None, far=0, line=True, shadow=None, profile='round'):
    ramp = pal.steel[:len(pal.steel) - far] if far else pal.steel
    f.put(m, shade(m, ramp, R, lo, hi, k, bias, profile=profile), line=line, lc=pal.line_steel if line else None,
          shadow=shadow)


def trim_band(f, pal, m, R=2, line=False):
    f.put(m, shade(m, pal.trim, R, -0.4, 0.95), line=line, lc=pal.line_trim)


def rivet(f, pal, x, y, big=False):
    t = pal.trim
    if big:
        f.template(x - 1, y - 1, ['.ab', 'abc', 'bcd'], {'a': t[4], 'b': t[3], 'c': t[2], 'd': t[0]}, force=False)
    else:
        f.pxf(x, y, t[4]); f.pxf(x + 1, y, t[2]); f.pxf(x, y + 1, t[2]); f.pxf(x + 1, y + 1, t[0])


def draw_cape(f, pal, torn=False):
    left = [(104, 98), (90, 118), (74, 146), (60, 178), (50, 206), (42, 232)]
    hem = []
    for i in range(0, 22):
        x = 42 + i * 5.2
        y = 233 + 4.5 * math.sin(x * 0.115 + 0.6) + (x - 42) * 0.02
        if torn and i % 4 == 1:
            y -= 9
        hem.append((x, y))
    right = [(156, 232), (158, 180), (158, 128), (152, 98)]
    pts = left + hem + right
    m = poly(pts)
    ang = np.arctan2(YY - 92.0, XX - 128.0)
    rr = np.hypot(YY - 92.0, XX - 128.0)
    folds = np.sin(ang * 26 + 0.8 + 0.0 * rr) * np.clip((rr - 18) / 70, 0, 1)
    bias = 0.34 * folds - 0.12
    cols = shade(m, pal.hero, R=12, lo=-0.55, hi=1.05, bias=bias)
    f.put(m, cols, line=True, lc=pal.line_hero)
    # doublure visible sous l'ourlet ondulé + ourlet doré
    hy = np.interp(XX, [p[0] for p in hem], [p[1] for p in hem])
    lining = m & (YY > hy - 6) & (np.sin(XX * 0.115 + 0.6) > 0.15)
    f.paint(lining, shade(m, [pal.hero[0], pal.hero[1], pal.hero[2]], R=3, lo=-0.4, hi=1.0))
    border = m & (YY > hy - 3) & ~lining
    f.paint(border, quant(lightv(relief(m, 3)) + 0.1, pal.trim[1:], -0.4, 1.0))
    # bord gauche replié (doublure sombre)
    edge = m & ~shifted(m, 3, 0) & (YY > 130)
    f.paint(edge, pal.hero[1])


def draw_plume(f, pal, spine=None, widths=None):
    spine = spine or [(127, 44), (125, 30), (116, 20), (101, 16), (85, 20), (72, 31), (63, 47), (58, 66), (58, 86), (62, 100)]
    widths = widths or [3.5, 6, 8, 9.5, 10, 9.5, 8.5, 7, 4.5, 1.2]
    m, T, S = spine_coords(spine, widths)
    # côté extérieur (haut / gauche) éclairé
    strands = np.sin(S * 5.2 + T * 46)
    v = -S * 0.55 + 0.22 * strands + 0.25 - 0.25 * T
    cols = quant(v, pal.plume, -0.7, 0.9, dither=0.1)
    f.put(m, cols, line=True, lc=mix(pal.plume[0], OUT, 0.5))
    # mèche secondaire sous le panache
    m2, T2, S2 = spine_coords([(112, 46), (96, 44), (84, 52), (78, 66), (80, 80)], [3, 5, 5, 3.5, 1])
    m2 &= ~m
    v2 = -S2 * 0.5 + 0.2 * np.sin(S2 * 5 + T2 * 40) - 0.15
    f.put(m2, quant(v2, pal.plume, -0.7, 0.9, dither=0.1), line=True, lc=mix(pal.plume[0], OUT, 0.5))


def draw_leg(f, pal, hip, knee, ankle, toe_dx, far):
    k = 1 if far else 0
    ramp_far = pal.steel[:-1] if far else pal.steel
    # cuissot
    thigh = capsule([hip, knee], [24, 19])
    steel_part(f, pal, thigh, R=8, far=k, lo=-0.45 + 0.1 * k)
    for yy in (hip[1] + 9, hip[1] + 18):
        band = thigh & (YY == yy)
        f.paint(band, pal.steel[1 + 0])
        f.paint(shifted(band, 0, 1) & thigh, pal.steel[5 - 2 * k])
    # grève
    shin = capsule([knee, ankle], [18, 14])
    steel_part(f, pal, shin, R=7, far=k, bias=np.where(XX < (knee[0] + ankle[0]) / 2 - 1, 0.1, -0.05),
               shadow=None)
    # arête de la grève
    line_px(f, [(knee[0] - 1, knee[1] + 9), (ankle[0] - 1, ankle[1] - 3)], ramp_far[-1])
    # genouillère (cubitière) à aileron
    kx, ky = knee
    wing = ell(kx - 8, ky + 1, 6, 8, 20) & ~ell(kx - 3, ky + 1, 4, 6)
    steel_part(f, pal, wing & ~ell(kx, ky, 8.5, 7.5), R=3, far=k + 1)
    cop = ell(kx, ky, 9, 8)
    steel_part(f, pal, cop, R=6, far=k, lo=-0.6, shadow=(1, 3, 0.35))
    rivet(f, pal, kx - 1, ky - 1, big=True)
    # soleret
    ax, ay = ankle
    sab = poly([(ax - 9, ay - 2), (ax + 6, ay - 2), (ax + toe_dx - 2, GROUND - 7), (ax + toe_dx + 5, GROUND - 1),
                (ax + toe_dx + 3, GROUND), (ax - 10, GROUND), (ax - 11, GROUND - 6)])
    steel_part(f, pal, sab, R=5, far=k, lo=-0.4, shadow=(0, 2, 0.4))
    for i, xx in enumerate(range(ax - 6, ax + toe_dx - 2, 6)):
        f.paint(sab & (XX == xx) & (YY < GROUND - 1), pal.steel[2])
        f.paint(sab & (XX == xx + 1) & (YY < GROUND - 1), pal.steel[6 - k])
    f.paint(sab & (YY == GROUND), pal.steel[1])
    # bande dorée de cheville
    cuff = capsule([(ax - 8, ay - 2), (ax + 6, ay - 2)], 3.2)
    trim_band(f, pal, cuff, line=True)


def draw_torso(f, pal, ornate=False, scars=False):
    # bras arrière (caché par l'écu) + épaulière arrière
    arm = capsule([(162, 112), (176, 132), (178, 146)], [14, 13, 12])
    steel_part(f, pal, arm, R=6, far=2)
    pf = ell(162, 104, 15, 12)
    steel_part(f, pal, pf, R=8, far=1)
    trim_band(f, pal, pf & ~shifted(pf, 0, 3) & (YY > 104))
    # cotte de mailles entre les jambes
    mail = poly([(112, 168), (154, 168), (150, 198), (116, 198)])
    mc = np.where(((XX // 2 + YY // 2) % 2 == 0), 1, 0)
    cols = np.array([rgb(UNDER[1]), rgb(UNDER[2])])[mc]
    cols[(YY % 3) == 0] = rgb(UNDER[0])
    f.put(mail, cols, line=True)
    # faltes (jupe de lames)
    faulds = poly([(106, 150), (162, 150), (171, 182), (97, 182)])
    steel_part(f, pal, faulds, R=10, lo=-0.55, k=0.8, bias=-0.04 * ((YY - 150) % 11))
    for yy in (160, 170, 181):
        f.paint(faulds & (YY == yy), pal.steel[1])
        f.paint(faulds & (YY == yy - 1), pal.steel[2])
        f.paint(faulds & (YY == yy - 10), pal.steel[6])
    trim_band(f, pal, faulds & (YY >= 179))
    for xx in range(101, 170, 9):
        rivet(f, pal, xx, 174)
    # pan de tabard
    tab = poly([(123, 150), (151, 150), (154, 194), (137, 203), (120, 194)])
    folds = 0.22 * np.sin((XX - 123) * 0.55 + (YY - 150) * 0.05)
    cols = shade(tab, pal.hero, R=5, lo=-0.5, hi=1.15, bias=folds - 0.05 * (XX > 145))
    f.put(tab, cols, line=True, lc=pal.line_hero, shadow=(2, 2, 0.3))
    edge = tab & ~erode(erode(erode(tab)))
    f.paint(edge, quant(lightv(relief(tab, 3)) + 0.05 * (XX < 138), pal.trim, -0.5, 1.0))
    f.paint(edge & ~erode(tab), mix(pal.trim[0], OUT, 0.3))
    # emblème du tabard : petite croix dorée
    f.paint(rect(135, 164, 137, 186) | rect(129, 170, 143, 172), pal.trim[3])
    f.paint(rect(137, 164, 137, 186) | rect(129, 172, 143, 172), pal.trim[1])
    # cuirasse
    chest = poly([(106, 96), (160, 94), (167, 116), (162, 142), (154, 154), (112, 154), (103, 140), (101, 116)])
    ridge = 138 + (YY - 96) * 0.05
    bias = np.where(XX > ridge, -0.18, 0.04)
    steel_part(f, pal, chest, R=22, lo=-0.55, hi=1.2, k=1.3, bias=bias, shadow=(1, 3, 0.35))
    f.paint(chest & (np.abs(XX - ridge) < 0.6) & (YY > 102), pal.steel[6])
    f.paint(chest & (np.abs(XX - ridge - 1) < 0.6) & (YY > 102), pal.steel[3])
    # reflets spéculaires
    for x, y in ((114, 112), (115, 112), (114, 113), (113, 114), (116, 111), (117, 111), (113, 116), (113, 117)):
        f.pxf(x, y, pal.steel[8])
    # encolure dorée
    neck = chest & ~shifted(chest, 0, 3) & (YY < 102)
    trim_band(f, pal, neck)
    # gravure (filigrane doré)
    for tt in np.linspace(0, 1, 60):
        y = 104 + 22 * tt
        f.pxf(112 + 24 * tt, y, pal.trim[3])
        f.pxf(112 + 24 * tt, y + 1, pal.trim[0])
        f.pxf(160 - 20 * tt, y - 2, pal.trim[1])
        f.pxf(160 - 20 * tt, y - 1, pal.trim[0])
    for x, y in ((136, 127), (139, 125), (137, 130), (138, 130)):
        f.pxf(x, y, pal.trim[2])
    if ornate:
        for y in range(110, 146, 6):
            rivet(f, pal, 120, y)
            rivet(f, pal, 152, y)
        f.paint(ell(138, 124, 6, 6) & chest, pal.trim[2])
        f.paint(ell(137.5, 123.5, 4, 4) & chest, pal.trim[4])
        f.paint(ell(138, 124, 2, 2) & chest, pal.trim[1])
    # ceinture
    belt = poly([(104, 144), (162, 142), (160, 153), (106, 155)])
    f.put(belt, shade(belt, LEATHER, R=3, lo=-0.5, hi=1.0), line=True, lc=mix(LEATHER[0], OUT, 0.5))
    for xx in range(108, 160, 4):
        f.pxf(xx, 149, LEATHER[5])
    buckle = (rect(130, 142, 141, 155) & ~rect(133, 145, 138, 152)) | rect(139, 141, 141, 156)
    trim_band(f, pal, buckle, line=True)
    f.paint(rect(133, 145, 138, 152), LEATHER[1])
    f.paint(rect(134, 148, 140, 149), pal.trim[2])
    f.paint(rect(134, 149, 140, 149), pal.trim[0])
    # gorgerin
    gor = poly([(114, 86), (150, 84), (156, 100), (110, 102)])
    steel_part(f, pal, gor, R=6, lo=-0.6, shadow=(0, 2, 0.3))
    for yy in (91, 96):
        f.paint(gor & (YY == yy), pal.steel[2])
        f.paint(gor & (YY == yy + 1), pal.steel[6])


def ridge_x(tt):
    return 138 + (108 + 34 * tt - 96) * 0.05


def draw_head(f, pal, scars=False, dragon=False, halo=False):
    # calotte + queue de sallet
    dome = ell(130, 64, 24, 24)
    tail = poly([(110, 66), (107, 86), (97, 98), (112, 97), (128, 88)])
    helm = dome | tail
    bias = np.where((XX - 130) ** 2 + (YY - 64) ** 2 < 15 ** 2, 0.0, -0.05)
    steel_part(f, pal, helm, R=16, lo=-0.6, hi=1.15, k=1.2, bias=bias)
    # arête de la calotte
    for tt in np.linspace(0, 1, 50):
        a = math.radians(-100 + 75 * tt)
        x, y = 130 + 22 * math.cos(a) * 0.35 - 4, 64 + 23.5 * math.sin(a)
    # bourrelet doré bas de la calotte + rivets
    rim = helm & (np.abs(np.hypot((XX - 130) / 24, (YY - 64) / 24) - 0.93) < 0.06) & (YY > 66) & (XX < 134)
    trim_band(f, pal, rim)
    for a in range(110, 175, 16):
        x = 130 + 21.5 * math.cos(math.radians(a))
        y = 64 + 21.5 * math.sin(math.radians(a))
        rivet(f, pal, x, y)
    # ouverture du visage
    face = poly([(134, 61), (153, 60), (156, 68), (159, 75), (156, 79), (157, 84), (152, 90), (141, 92), (134, 89)])
    frame = dilate(dilate(dilate(face))) & helm & ~face
    trim_band(f, pal, frame & (XX < 156), line=False)
    skin_v = lightv(relief(face, 7, 0.9)) + np.where(XX < 139, -0.35, 0) + np.where(YY < 66, -0.3, 0)
    f.put(face, quant(skin_v, SKIN[1:], -0.4, 1.1, dither=0.1), line=True, lc=mix(SKIN[0], OUT, 0.3))
    # cheveux : frange en mèches
    hair = blank()
    for i, x0 in enumerate(range(133, 156, 4)):
        tip = 67 + (2 if i % 2 else 0) + (1 if i == 2 else 0)
        hair |= poly([(x0, 59), (x0 + 6, 59), (x0 + 4.5, tip - 2), (x0 + 2.5, tip + 1)])
    hair &= face | shifted(face, 0, 2)
    hv = 0.4 * np.sin(XX * 1.1) - (YY - 60) * 0.06
    f.put(hair & face, quant(hv, HAIR[1:], -0.6, 0.6, dither=0.1), line=False)
    f.paint(face & ~shifted(face, 0, 1) | (hair & face & (YY == 60)), HAIR[1])
    # sourcils, yeux, nez, bouche
    BR = HAIR[0]
    if scars:
        BR = '#2a1414'
    for x, y in ((136, 70), (137, 69), (138, 69), (139, 68), (140, 68), (141, 68), (137, 70), (138, 70), (139, 69), (140, 69)):
        f.pxf(x, y, BR)
    for x, y in ((148, 68), (149, 68), (150, 68), (151, 69), (148, 69), (149, 69)):
        f.pxf(x, y, BR)
    if scars:  # sourcils froncés
        f.pxf(141, 69, BR); f.pxf(147, 69, BR)
    eye = {'K': OUT, 'w': '#f4f0ff', 'v': '#c9c2e8', 'b': '#2a3a78', 'i': '#4f7ad0', 'h': '#ffffff'}
    if dragon:
        eye.update({'b': '#7a2a10', 'i': '#ff8a3d'})
    if scars:
        eye.update({'b': '#5a1414', 'i': '#c83a2a'})
    f.template(136, 71, ['.KKKKK', 'KwhbbK', 'wvbbib', '.vwib.'], eye, force=False)
    f.template(148, 71, ['KKKK', 'hbbK', 'bbi.', 'wi..'], eye, force=False)
    f.pxf(141, 75, SKIN[3])
    # nez
    f.pxf(156, 77, SKIN[2]); f.pxf(155, 78, SKIN[1]); f.pxf(154, 78, SKIN[2])
    # joues
    f.pxf(137, 78, BLUSH); f.pxf(139, 78, BLUSH); f.pxf(138, 79, BLUSH)
    # bouche (sourire assuré)
    if scars:
        for x in range(145, 152):
            f.pxf(x, 84, '#5a2030')
        f.pxf(146, 85, '#ffffff'); f.pxf(148, 85, '#ffffff'); f.pxf(150, 85, '#ffffff')
        f.pxf(152, 83, '#5a2030')
    else:
        for x in range(146, 152):
            f.pxf(x, 84, '#7a3040')
        f.pxf(145, 83, '#7a3040'); f.pxf(152, 83, '#7a3040')
        f.pxf(148, 85, SKIN[2]); f.pxf(149, 85, SKIN[2])
    # menton ombré
    f.paint(face & ~shifted(face, 0, -2) & (YY > 86), SKIN[2])
    if scars:
        for x, y in ((140, 72), (141, 73), (142, 74), (143, 75), (144, 76), (145, 77)):
            f.pxf(x, y, '#b05050')
        f.pxf(141, 72, '#e8a090')
    # visière relevée à grille
    vis = poly([(121, 50), (150, 47), (160, 54), (159, 62), (150, 61), (123, 60)])
    steel_part(f, pal, vis, R=5, lo=-0.5, k=1.0, shadow=(0, 3, 0.45))
    for x in range(136, 159, 3):
        f.paint(vis & (XX == x) & (YY > 52) & (YY < 60), OUT)
        f.paint(vis & (XX == x + 1) & (YY > 52) & (YY < 60), pal.steel[2])
    f.paint(vis & ~shifted(vis, 0, 1) & (YY > 50), pal.steel[7])
    trim_band(f, pal, vis & (YY >= 59))
    # charnière (rosace dorée)
    ros = ell(124, 69, 4.5, 4.5)
    trim_band(f, pal, ros, R=3, line=True)
    f.pxf(124, 69, pal.trim[0]); f.pxf(123, 68, pal.trim[5])
    f.paint(capsule([(124, 64), (126, 56)], 2), pal.trim[2])
    # reflets de la calotte
    for x, y in ((114, 52), (115, 51), (116, 50), (113, 54), (117, 49), (118, 49), (112, 56), (113, 57), (120, 47)):
        f.pxf(x, y, pal.steel[8])
    # douille du panache
    sock = poly([(122, 39), (130, 39), (129, 44), (123, 44)])
    trim_band(f, pal, sock, R=2, line=True)


def draw_sword(f, pal, x=78, top=138, gold=False, ember=False):
    blade_top, tip = top + 32, 241
    # lame à deux pans
    blade = poly([(x - 5, blade_top), (x + 5, blade_top), (x + 4, tip - 12), (x, tip), (x - 4, tip - 12)])
    bl = np.where(XX < x, 6, 4)
    bl = np.where(XX < x - 3, 7, bl)
    bl = np.where(XX > x + 2, 3, bl)
    cols = np.array([rgb(c) for c in pal.steel])[bl]
    f.put(blade, cols, line=True, lc=pal.line_steel)
    f.paint(blade & (XX == x) & (YY < tip - 16) & (YY > blade_top + 4), pal.steel[2])  # gouttière
    for y in range(blade_top + 6, tip - 20, 13):
        f.pxf(x - 3, y, pal.steel[8]); f.pxf(x - 3, y + 1, pal.steel[8])
    f.pxf(x - 1, tip - 4, pal.steel[8])
    if ember:
        glow = blade & (((XX - x) % 5 == 0) & ((YY * 3 + XX) % 9 < 3))
        f.paint(blade & (XX >= x + 1), '#5a2a3a')
        f.paint(blade & (XX >= x + 3), '#3a1a2a')
        f.paint(blade & (XX == x + 1) & (YY > blade_top + 3), '#ff8a3d')
        f.paint(blade & (XX == x + 2) & (YY > blade_top + 3) & ((YY // 3) % 2 == 0), '#ffd27a')
    gr = GOLD if gold else ['#1a2a5a', '#22489a', '#2f62b8', '#4f8ae8', '#8fc0ff', '#d4ecff']
    # garde recourbée
    guard = capsule([(x - 17, top + 25), (x - 12, top + 29), (x + 12, top + 29), (x + 17, top + 25)], [5, 6, 6, 5])
    f.put(guard, shade(guard, gr, R=3, lo=-0.4, hi=1.0), line=True, lc=mix(gr[0], OUT, 0.4))
    gem = ell(x + 0.5, top + 29.5, 3.2, 3.2)
    f.put(gem, shade(gem, pal.trim if not gold else ['#3a0a20', '#8a1a3a', '#d03050', '#ff7090', '#ffd0e0'], R=3), line=True)
    f.pxf(x - 1, top + 28, '#ffffff')
    # poignée en cuir tressé
    grip = rect(x - 3, top + 7, x + 3, top + 25)
    gc = np.array([rgb(LEATHER[i]) for i in (1, 2, 3, 4)])[np.clip(((YY + (XX - x) // 2) % 4), 0, 3)]
    f.put(grip, gc, line=True)
    # pommeau
    pom = ell(x + 0.5, top + 3.5, 5.5, 5)
    f.put(pom, shade(pom, gr, R=4, lo=-0.5, hi=1.0), line=True, lc=mix(gr[0], OUT, 0.4))
    f.pxf(x - 2, top + 1, '#ffffff')


def gauntlet(f, pal, cx, cy, far=False):
    fist = ell(cx, cy, 9, 8)
    steel_part(f, pal, fist, R=5, lo=-0.5, far=1 if far else 0)
    for i in range(3):
        y = cy - 3 + i * 3
        f.paint(fist & (YY == y) & (XX > cx - 2), pal.steel[2])
        f.paint(fist & (YY == y + 1) & (XX > cx - 2), pal.steel[6])
    f.paint(fist & (XX == cx - 3) & (YY > cy - 5), pal.steel[3])


def draw_near_arm(f, pal, hand=(80, 153), raise_=False):
    hx, hy = hand
    upper = capsule([(98, 110), (90, 132)], [16, 14])
    steel_part(f, pal, upper, R=6, lo=-0.5)
    fore = capsule([(88, 136), (hx + 1, hy - 8)], [14, 13])
    steel_part(f, pal, fore, R=6, lo=-0.5, shadow=(1, 2, 0.3))
    cuff = capsule([(hx - 6, hy - 9), (hx + 8, hy - 9)], 5) & dilate(fore)
    trim_band(f, pal, cuff, line=True)
    cop = ell(88, 134, 8, 7)
    steel_part(f, pal, cop, R=5, lo=-0.6)
    rivet(f, pal, 87, 133, big=True)
    gauntlet(f, pal, hx, hy)


def draw_pauldron(f, pal, ornate=False):
    # lames sous l'épaulière
    for i, (cy, rx) in enumerate(((124, 15), (118, 17))):
        lame = ell(98, cy, rx, 8) & (YY > cy - 2)
        steel_part(f, pal, lame, R=4, lo=-0.5, shadow=(1, 2, 0.3))
        trim_band(f, pal, lame & ~shifted(lame, 0, 2))
    p = ell(100, 106, 20, 15)
    steel_part(f, pal, p, R=12, lo=-0.6, k=1.2, shadow=(2, 3, 0.4))
    edge = p & ~erode(erode(erode(p))) & (YY > 103)
    f.paint(edge, quant(lightv(relief(p, 4)), pal.trim, -0.6, 1.0))
    f.paint(p & ~erode(p) & (YY > 103), pal.line_trim)
    for x, y in ((90, 98), (91, 97), (92, 97), (89, 99), (93, 96), (88, 100)):
        f.pxf(x, y, pal.steel[8])
    for x in (86, 98, 110):
        rivet(f, pal, x, 113 - (2 if x == 98 else 0))
    if ornate:
        for tt in np.linspace(0, 1, 26):
            f.pxf(90 + 20 * tt, 104 - 6 * math.sin(tt * math.pi), pal.trim[3])


def kite_shield(cx=178, top=110, w=54, h=86, tower=False):
    if tower:
        return poly([(cx - w / 2, top), (cx + w / 2, top - 4), (cx + w / 2 + 2, top + h - 12), (cx, top + h + 2),
                     (cx - w / 2 - 1, top + h - 10)])
    return poly([(cx - w / 2, top + 2), (cx, top - 3), (cx + w / 2, top + 1), (cx + w / 2 - 2, top + h * 0.42),
                 (cx + 8, top + h * 0.82), (cx, top + h), (cx - 8, top + h * 0.82), (cx - w / 2 + 2, top + h * 0.42)])


def draw_shield(f, pal, kind='cross', tower=False, cx=178, top=110):
    w, h = (60, 108) if tower else (54, 86)
    m = kite_shield(cx, top, w, h, tower)
    # épaisseur (tranche) côté gauche
    side = shifted(m, -4, 1) & ~m
    f.put(side, shade(side, pal.steel[:6], R=2, lo=-0.3), line=True, lc=pal.line_steel)
    face = erode(erode(erode(erode(m))))
    border = m & ~face
    f.put(border, quant(lightv(relief(m, 5, 1.2)) + 0.05, pal.trim, -0.55, 1.0), line=True, lc=pal.line_trim)
    f.put(face, shade(face, pal.hero, R=20, lo=-0.5, hi=1.05, k=1.2, bias=-0.1 * ((XX - cx) / 20)), line=True,
          lc=pal.line_trim)
    # liseré intérieur sombre
    f.paint(face & ~erode(face), mix(pal.hero[0], OUT, 0.3))
    # rivets de bordure
    bd = border & ~erode(border)
    for i, (y, x) in enumerate(zip(*np.nonzero(border & erode(erode(m)) & ~erode(erode(erode(m)))))):
        if (x * 3 + y * 7) % 23 == 0:
            rivet(f, pal, x, y)
    cyc = top + (h * 0.36 if not tower else h * 0.4)
    if kind in ('cross', 'sun', 'dragon', 'tree'):
        vbar = rect(cx - 3, top + 8, cx + 3, top + h - 14) & face
        hbar = rect(cx - w / 2 + 8, cyc - 3, cx + w / 2 - 8, cyc + 3) & face
        cr = vbar | hbar
        if kind in ('dragon', 'tree'):
            cr = blank()
        if cr.any():
            f.put(cr, quant(lightv(relief(cr, 3, 1.3)) + 0.05, pal.trim, -0.5, 1.0), line=True, lc=pal.line_trim)
    if kind == 'sun':
        rays = blank()
        for a in range(0, 360, 30):
            r0, r1 = 9, 18
            ra = math.radians(a + 15)
            rays |= capsule([(cx + r0 * math.cos(ra), cyc + r0 * math.sin(ra)), (cx + r1 * math.cos(ra), cyc + r1 * math.sin(ra))], [3, 1])
        rays &= face & ~dilate(rect(cx - 3, 0, cx + 3, 255) | rect(0, cyc - 3, 255, cyc + 3))
        f.put(rays, pal.trim[3], line=False)
    if kind == 'coin':
        coin = ell(cx, cyc + 4, 14, 14)
        f.put(coin, shade(coin, GOLD, R=6, lo=-0.5), line=True, lc=pal.line_trim)
        inner = ell(cx, cyc + 4, 9, 9)
        f.paint(inner & ~ell(cx + 0.7, cyc + 4.7, 9, 9), GOLD[1])
        f.paint(ell(cx, cyc + 4, 9, 9) & ~ell(cx - 0.8, cyc + 3.2, 9, 9), GOLD[5])
        # symbole « couronne »
        f.template(int(cx) - 5, int(cyc), ['b...b...b', 'bb.bbb.bb', 'bbbbbbbbb', '.bbbbbbb.', '.ccccccc.'],
                   {'b': GOLD[1], 'c': GOLD[0]}, force=False)
    if kind == 'dragon':
        # dragon stylisé (tête et aile) en dorure
        head = poly([(cx - 14, cyc + 2), (cx - 2, cyc - 10), (cx + 10, cyc - 8), (cx + 16, cyc - 2), (cx + 6, cyc - 2),
                     (cx + 12, cyc + 6), (cx + 2, cyc + 4), (cx - 6, cyc + 14), (cx - 4, cyc + 4)])
        f.put(head & face, quant(lightv(relief(head, 3, 1.3)), pal.trim, -0.5, 1.0), line=True, lc=pal.line_trim)
        f.pxf(cx + 4, cyc - 5, '#fff2c0'); f.pxf(cx + 5, cyc - 5, OUT)
        horn = capsule([(cx - 2, cyc - 9), (cx - 10, cyc - 16)], [3, 1])
        f.put(horn & face, pal.trim[2], line=False)
    if kind == 'tree':
        # chêne du gardien (feuille / arbre stylisé)
        trunk = rect(cx - 2, cyc + 2, cx + 2, top + h - 22) & face
        crown = (ell(cx, cyc - 4, 15, 11) | ell(cx - 9, cyc + 2, 8, 6) | ell(cx + 9, cyc + 2, 8, 6)) & face
        f.put(trunk, quant(lightv(relief(trunk, 3, 1.3)), pal.trim, -0.5, 1.0), line=True, lc=pal.line_trim)
        leaves = quant(lightv(relief(crown, 6, 1.2)) + 0.15 * np.sin(XX * 0.9 + YY * 0.7), pal.plume, -0.5, 1.0)
        f.put(crown, leaves, line=True, lc=pal.line_trim)
        f.paint(crown & ~erode(crown), pal.trim[2])
        for x, y in ((cx - 6, cyc - 6), (cx + 4, cyc - 9), (cx + 8, cyc), (cx - 10, cyc + 2), (cx, cyc - 2)):
            f.pxf(x, y, pal.plume[-1])
    # boss / gemme centrale
    if kind in ('cross', 'sun'):
        g = ell(cx + 0.5, cyc + 0.5, 4.5, 4.5)
        f.put(g, shade(g, ['#3a0a20', '#8a1a3a', '#d03050', '#ff7090', '#ffd0e0'] if kind == 'cross' else
                       ['#6a3a10', '#b07020', '#f0b030', '#ffe080', '#fffbe0'], R=3), line=True)
        f.pxf(cx - 1, cyc - 1, '#ffffff')
    # reflet du métal de l'écu
    for k in range(6):
        f.pxf(cx - w / 2 + 7 + k, top + 9 + k // 2, pal.hero[-1])
    return m


def knight(hid):
    pal = Pal(**HEROES[hid])
    f = Fig()
    v = hid
    if v == 'paladin':
        draw_halo(f, pal)
    draw_cape(f, pal, torn=(v == 'berserker'))
    if v == 'dragon_knight':
        draw_dragon_wings(f, pal)
    else:
        draw_plume(f, pal)
    draw_leg(f, pal, (146, 172), (158, 204), (164, 233), 16, far=True)
    draw_leg(f, pal, (118, 172), (110, 204), (105, 233), 15, far=False)
    draw_torso(f, pal, ornate=(v == 'fortune_knight'))
    draw_head(f, pal, scars=(v == 'berserker'), dragon=(v == 'dragon_knight'))
    if v == 'paladin':
        draw_mace(f, pal)
    elif v == 'berserker':
        draw_axe(f, pal)
    else:
        draw_sword(f, pal, gold=(v == 'fortune_knight'), ember=(v == 'dragon_knight'))
    draw_pauldron(f, pal, ornate=(v == 'fortune_knight'))
    draw_near_arm(f, pal)
    kind = {'knight': 'cross', 'paladin': 'sun', 'guardian': 'tree', 'fortune_knight': 'coin',
            'berserker': 'cross', 'dragon_knight': 'dragon'}[v]
    draw_shield(f, pal, kind, tower=(v == 'guardian'), top=106 if v == 'guardian' else 110)
    extras(f, pal, v)
    return post_fx(f.finish(pal.accent), v, pal)


GOLD = trim_ramp('#e8b64a')
EMBER = ['#7a1a10', '#c83a10', '#ff6a1a', '#ff9a3d', '#ffd27a', '#fff4d0']


def draw_halo(f, pal):
    ring = ell(131, 58, 38, 38) & ~ell(131, 58, 34, 34)
    v = lightv(relief(ring, 2, 1.0)) + 0.1
    f.put(ring, quant(v, GOLD[1:], -0.5, 1.0), line=True, lc=mix(GOLD[0], OUT, 0.3))
    inner = ell(131, 58, 33, 33) & ~ell(131, 58, 31, 31)
    f.put(inner & (CHECK | (YY < 50)), '#fff4c0', line=False)


def draw_dragon_wings(f, pal):
    mem = make_ramp('#1a0a20', '#5a2238', '#c8503a', 6)
    bone = ['#1c1426', '#2e2440', '#4a3a5e', '#6e5a80', '#9a86a8']
    for side in (1, -1):
        if side == 1:   # aile côté nuque (grande)
            base = (116, 50)
            tips = [(66, 6), (52, 30), (54, 58), (66, 80)]
            elbow = (88, 22)
        else:           # aile côté visage (petite, derrière la calotte)
            base = (140, 44)
            tips = [(176, 8), (186, 30), (180, 46)]
            elbow = (160, 18)
        outline = [base, elbow] + tips + [(base[0] - 4 * side, base[1] + 14)]
        # membrane festonnée entre les doigts
        m = poly(outline)
        for a, b in zip(tips, tips[1:]):
            mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
            vx, vy = mx - base[0], my - base[1]
            nrm = math.hypot(vx, vy)
            m &= ~ell(mx + vx / nrm * 5, my + vy / nrm * 5, 9, 9)
        v = lightv(relief(m, 6, 0.8)) + 0.25 * np.sin(np.arctan2(YY - base[1], XX - base[0]) * 14)
        f.put(m, quant(v, mem, -0.6, 1.1), line=True, lc=mix(mem[0], OUT, 0.4))
        # nervures (doigts osseux)
        bones = blank()
        bones |= capsule([base, elbow], [5, 3.5])
        for t in tips:
            bones |= capsule([elbow, t], [3, 1.2])
        f.put(bones, shade(bones, bone, R=2, lo=-0.4, hi=1.0), line=True, lc=OUT)
        # griffe
        f.put(ell(elbow[0], elbow[1], 3, 3), '#ff9a3d', line=True)
        f.pxf(elbow[0] - 1, elbow[1] - 1, '#fff4d0')


def draw_mace(f, pal):
    haft = capsule([(86, 182), (73, 104)], [5, 5])
    f.put(haft, shade(haft, LEATHER, R=2, lo=-0.4, hi=1.0), line=True, lc=mix(LEATHER[0], OUT, 0.5))
    for i in range(0, 70, 5):
        f.pxf(86 - 13 * i / 78 - 1, 182 - i, LEATHER[5])
    pom = ell(86.5, 184, 4.5, 4.5)
    f.put(pom, shade(pom, GOLD, R=3), line=True, lc=mix(GOLD[0], OUT, 0.3))
    collar = ell(74, 108, 6, 3.5, -10)
    f.put(collar, shade(collar, GOLD, R=2), line=True, lc=mix(GOLD[0], OUT, 0.3))
    # tête à ailettes
    hx, hy = 71, 94
    flanges = blank()
    for a in range(0, 360, 45):
        r = math.radians(a)
        flanges |= poly([(hx + 4 * math.cos(r + 0.5), hy + 4 * math.sin(r + 0.5) * 1.2),
                         (hx + 13 * math.cos(r), hy + 13 * math.sin(r) * 1.15),
                         (hx + 4 * math.cos(r - 0.5), hy + 4 * math.sin(r - 0.5) * 1.2)])
    flanges |= ell(hx, hy, 8, 9)
    steel_part(f, pal, flanges, R=4, lo=-0.5, hi=1.2)
    core = ell(hx, hy, 6, 7)
    f.put(core, shade(core, GOLD, R=4), line=True, lc=mix(GOLD[0], OUT, 0.3))
    f.pxf(hx - 2, hy - 3, '#ffffff')
    top = ell(hx, hy - 13, 3, 3)
    f.put(top, shade(top, GOLD, R=2), line=True)


def draw_axe(f, pal):
    haft = capsule([(87, 186), (74, 82)], [6, 6])
    f.put(haft, shade(haft, LEATHER, R=2, lo=-0.4, hi=1.0), line=True, lc=mix(LEATHER[0], OUT, 0.5))
    for i in range(0, 96, 6):
        y = 186 - i
        x = 87 - 13 * i / 104
        f.pxf(x - 1, y, LEATHER[0]); f.pxf(x, y - 1, LEATHER[0])
    # lame en croissant (vers l'extérieur) + pointe arrière
    blade = poly([(76, 86), (60, 78), (46, 70), (40, 86), (40, 104), (46, 120), (60, 112), (78, 106)])
    blade &= ~ell(30, 95, 9, 15)
    steel_part(f, pal, blade, R=7, lo=-0.5, hi=1.2)
    edge = blade & ~shifted(blade, 3, 0) & (XX < 52)
    f.paint(edge, pal.steel[7])
    f.paint(blade & ~shifted(blade, 1, 0) & (XX < 52), pal.steel[8])
    spike = poly([(80, 90), (95, 95), (80, 102)])
    steel_part(f, pal, spike, R=3)
    band = poly([(70, 84), (82, 86), (81, 108), (69, 106)])
    f.put(band, shade(band, GOLD, R=3, lo=-0.5), line=True, lc=mix(GOLD[0], OUT, 0.3))
    for y in (89, 96, 103):
        rivet(f, pal, 75, y)
    # entailles de combat
    for x, y in ((46, 84), (47, 85), (52, 104), (53, 103), (44, 96)):
        f.pxf(x, y, pal.steel[2])
    tip = poly([(74, 82), (78, 72), (82, 84)])
    steel_part(f, pal, tip, R=2)


def coin(f, x, y, r=5, edge=False, ramp=GOLD):
    if edge:  # pièce vue de tranche
        m = ell(x, y, r, max(1.5, r * 0.4))
    else:
        m = ell(x, y, r, r)
    f.put(m, shade(m, ramp, R=max(2, r // 2), lo=-0.5, hi=1.0), line=True, lc=mix(ramp[0], OUT, 0.3))
    if not edge and r >= 4:
        f.paint(ell(x, y, r - 2, r - 2) & ~ell(x - 0.7, y - 0.7, r - 2, r - 2), ramp[5])
        f.paint(ell(x, y, r - 2, r - 2) & ~ell(x + 0.7, y + 0.7, r - 2, r - 2), ramp[1])
        f.pxf(x - 1, y - 2, '#ffffff')


def extras(f, pal, v):
    if v == 'fortune_knight':
        # tas de pièces aux pieds + pièces qui volent
        for (x, y, r, e) in ((188, 241, 5, True), (199, 241, 5, True), (194, 237, 5, True), (210, 241, 5, True),
                             (204, 236, 5, True), (198, 232, 5, True), (184, 236, 5, False), (214, 232, 5, False),
                             (50, 241, 5, True), (61, 241, 5, True), (56, 236, 5, False), (40, 237, 4, False)):
            coin(f, x, y, r, e)
        for (x, y, r, e) in ((214, 96, 5, False), (226, 120, 4, True), (36, 140, 4, False), (222, 72, 3, False)):
            coin(f, x, y, r, e)
    if v == 'berserker':
        # balafres sur l'écu
        for pts in (((160, 128), (176, 146)), ((186, 160), (196, 140)), ((164, 138), (172, 150))):
            line_px(f, list(pts), pal.hero[0])
            line_px(f, [(pts[0][0] + 1, pts[0][1]), (pts[1][0] + 1, pts[1][1])], pal.hero[-1])


def post_fx(img, v, pal):
    """Effets ajoutés après le contour (lumineux, sans contour)."""
    a = np.array(img)
    r = np.random.RandomState({'paladin': 3, 'dragon_knight': 7, 'fortune_knight': 11}.get(v, 1))

    def put(x, y, c):
        if 0 <= x < W and 0 <= y < H:
            a[y, x, :3] = hex2rgb(c)
            a[y, x, 3] = 255

    def spark(x, y, n, cols):
        put(x, y, cols[2])
        for k in range(1, n + 1):
            for dx, dy in ((k, 0), (-k, 0), (0, k), (0, -k)):
                put(x + dx, y + dy, cols[1] if k < n else cols[0])

    if v == 'dragon_knight':
        for _ in range(26):
            x = int(r.uniform(40, 220))
            y = int(r.uniform(120, 240))
            if a[y, x, 3] and r.rand() < 0.6:
                continue
            c = EMBER[r.randint(2, 6)]
            put(x, y, c)
            if r.rand() < 0.5:
                put(x, y - 1, EMBER[1])
            if r.rand() < 0.3:
                put(x + 1, y, EMBER[2])
        for x, y in ((44, 150), (214, 70), (200, 196), (30, 200)):
            spark(x, y, 2, [EMBER[2], EMBER[4], EMBER[5]])
    if v == 'paladin':
        for x, y in ((92, 30), (176, 34), (196, 76), (60, 72), (210, 120)):
            spark(x, y, 2 + (x % 2), ['#e8b64a', '#ffe08a', '#ffffff'])
    if v == 'fortune_knight':
        for x, y in ((206, 88), (232, 112), (30, 130), (176, 226), (64, 226)):
            spark(x, y, 2, ['#e8b64a', '#ffe08a', '#ffffff'])
    if v == 'knight':
        for x, y in ((64, 160), (212, 104)):
            spark(x, y, 2, ['#4f8ae8', '#8fc0ff', '#ffffff'])
    return Image.fromarray(a, 'RGBA')


# =============================================================== aperçu

def js_shade(color, t):
    """Même formule que src/render/pixel.js shade()."""
    c = hex2rgb(color)
    tg = (255, 250, 230) if t > 0 else (20, 12, 40)
    k = abs(t)
    return rgb2hex(tuple(round(v + (tg[i] - v) * k) for i, v in enumerate(c)))


def game_hero_sprite(hid):
    """Sprite du chevalier en jeu (idle, cape a, casque, écu, épée), recoloré avec la palette du héros."""
    pal = HEROES[hid]
    rec = {'#2f62b8': pal['B'], '#1d3b78': pal['P'], '#e8b64a': pal['W'], '#3b7de0': pal['K'],
           '#5a8ae0': js_shade(pal['B'], 0.3), '#122550': js_shade(pal['P'], -0.4),
           '#ffe08a': js_shade(pal['W'], 0.4), '#a8742a': js_shade(pal['W'], -0.35), '#22489a': js_shade(pal['K'], -0.35)}
    rec = {hex2rgb(k): hex2rgb(v) for k, v in rec.items()}

    def load(n):
        im = Image.open(os.path.join(SPRITES, n + '.png')).convert('RGBA')
        a = np.array(im)
        for k, v in rec.items():
            m = (a[..., 0] == k[0]) & (a[..., 1] == k[1]) & (a[..., 2] == k[2])
            a[m, :3] = v
        return Image.fromarray(a, 'RGBA')
    c = Image.new('RGBA', (56, 56), (0, 0, 0, 0))
    ox, oy = 4, 6
    c.alpha_composite(load('cape_a'), (ox, oy))
    c.alpha_composite(load('shield'), (ox + 5, oy + 29))
    c.alpha_composite(load('hero_idle'), (ox, oy))
    helm = load('helmet_default')
    c.alpha_composite(helm, (ox, oy - (helm.height - 48)))
    sw = Image.open(os.path.join(SPRITES, 'weapon_sword.png')).convert('RGBA')
    c.alpha_composite(sw, (ox + 32 - 4, oy + 35 - 23))
    return c


PET_SPRITES = {'golden_slime': 'pet_slime', 'cat': 'pet_cat', 'owl': 'pet_owl', 'fairy': 'pet_fairy',
               'golem': 'pet_golem', 'wisp': 'pet_wisp'}


def preview_sheet(items, path):
    """items : [(nom, illustration 256², sprite du jeu)] — illustration ×2 et sprite ×4, fond sombre."""
    cols = 3
    cw, ch = 512 + 16 + 56 * 4 + 24, 512 + 24
    rows = (len(items) + cols - 1) // cols
    sheet = Image.new('RGBA', (cw * cols, ch * rows), (24, 22, 38, 255))
    d = ImageDraw.Draw(sheet)
    for i, (name, ill, spr) in enumerate(items):
        x0, y0 = (i % cols) * cw + 8, (i // cols) * ch + 8
        d.rectangle([x0, y0, x0 + 511, y0 + 511], fill=(44, 40, 66, 255))
        sheet.alpha_composite(ill.resize((512, 512), Image.NEAREST), (x0, y0))
        sx, sy = x0 + 512 + 16, y0 + 512 - spr.height * 4
        d.rectangle([sx - 4, sy - 4, sx + spr.width * 4 + 3, y0 + 511], fill=(44, 40, 66, 255))
        sheet.alpha_composite(spr.resize((spr.width * 4, spr.height * 4), Image.NEAREST), (sx, sy))
        d.text((x0 + 4, y0 + 2), name, fill=(220, 220, 240, 255))
    sheet.save(path)


# =============================================================== sortie

def save(img, name):
    os.makedirs(OUTDIR, exist_ok=True)
    img.save(os.path.join(OUTDIR, name + '.png'))


def main(only=()):
    items = []
    for hid in HEROES:
        if only and hid not in only:
            continue
        img = knight(hid)
        save(img, 'hero_' + hid)
        items.append(('hero_' + hid, img, game_hero_sprite(hid)))
    for pid, fn in PETS.items():
        if only and pid not in only:
            continue
        img = fn()
        save(img, 'pet_' + pid)
        items.append(('pet_' + pid, img, Image.open(os.path.join(SPRITES, PET_SPRITES[pid] + '.png')).convert('RGBA')))
    if not only:
        preview_sheet(items, os.path.join(ROOT, 'tools', 'art', 'preview_hd_knights_pets.png'))
    return items


# =============================================================== familiers

def big_eye(f, cx, cy, rx, ry, iris, pupil=OUT, look=(1, 0), lid=None):
    """Grand œil brillant : contour, iris en dégradé, pupille, 2 reflets."""
    m = ell(cx, cy, rx, ry)
    f.put(m, OUT, line=False)
    inner = ell(cx, cy, rx - 1, ry - 1)
    ir = make_ramp(mix(iris, OUT, 0.6), iris, mix(iris, '#ffffff', 0.5), 5)
    v = (YY - (cy - ry)) / (2 * ry) + 0.15 * ((XX - cx) / rx)
    f.paint(inner, quant(v * 1.6 - 0.4, ir, -0.4, 1.2, dither=0.12))
    pm = ell(cx + look[0] * rx * 0.15, cy + ry * 0.05, rx * 0.5, ry * 0.55)
    f.paint(pm & inner, pupil)
    f.paint(ell(cx - rx * 0.35, cy - ry * 0.4, max(1.2, rx * 0.32), max(1.2, ry * 0.26)) & inner, '#ffffff')
    f.paint(ell(cx + rx * 0.35, cy + ry * 0.45, max(0.8, rx * 0.15), max(0.8, ry * 0.12)) & inner, '#ffffff')
    if lid:
        f.paint(m & (YY < cy - ry + 2), lid)


def blush(f, cx, cy, rx, ry, c=BLUSH):
    f.paint(ell(cx, cy, rx, ry) & (CHECK | ell(cx, cy, rx * 0.6, ry * 0.6)), c)


def pet_slime():
    f = Fig()
    G = make_ramp('#5a2a10', '#e8a820', '#fff6c0', 8)
    body = ell(128, 186, 96, 72) | ell(124, 150, 70, 58) | capsule([(114, 104), (108, 88), (112, 80)], [30, 16, 6])
    body &= (YY <= 244)
    body &= ~((YY > 230) & ~ell(128, 222, 100, 26))
    bias = 0.12 * np.clip((YY - 200) / 44, 0, 1) * -1
    f.put(body, shade(body, G, R=40, lo=-0.55, hi=1.15, k=1.1, bias=bias, dither=0.16), line=False)
    # cœur translucide plus clair (gélatine)
    core = ell(120, 172, 62, 48)
    f.paint(core, quant(lightv(relief(core, 30)) + 0.2, G[3:], -0.4, 1.1, dither=0.18), alpha=0.55)
    # pièce prise dans la gelée
    cm = ell(176, 214, 11, 6, -20)
    f.paint(cm, '#c8841a')
    f.paint(ell(175, 213, 8, 4, -20), '#f8d060')
    f.paint(ell(173, 212, 3, 1.5, -20), '#fff2b0')
    # bulles
    for x, y, r in ((70, 200, 4), (86, 220, 2.5), (196, 176, 3), (58, 176, 2)):
        f.paint(ell(x, y, r, r) & ~ell(x - 0.8, y - 0.8, r - 1, r - 1), G[6])
        f.pxf(x - 1, y - 1, '#ffffff')
    # reflets brillants
    f.paint(ell(84, 132, 18, 10, -40), '#fffbe8')
    f.paint(ell(80, 136, 12, 5, -40), '#ffffff')
    f.paint(ell(112, 102, 5, 3, -30), '#ffffff')
    f.paint(ell(64, 168, 4, 7, -10), G[7])
    # base : flaque plus sombre + gouttes
    f.paint(body & ~shifted(body, 0, -3) & (YY > 226), G[2])
    f.paint(body & ~shifted(body, 0, -1) & (YY > 226), G[1])
    # visage
    big_eye(f, 110, 160, 10, 15, '#3a2010', look=(1, 0))
    big_eye(f, 160, 160, 10, 15, '#3a2010', look=(1, 0))
    blush(f, 90, 186, 11, 5)
    blush(f, 182, 186, 11, 5)
    f.template(127, 180, ['K....K', '.KKKK.', '.KppK.', '..KK..'], {'K': OUT, 'p': '#e86a7a'}, force=False)
    # étincelle
    f.put(blank(), OUT, line=False)
    img = f.finish('#fff2a0')
    return add_sparks(img, [(212, 96, 4), (226, 116, 2), (40, 120, 2)], ['#e8b64a', '#ffe08a', '#ffffff'])


def add_sparks(img, pts, cols):
    a = np.array(img)

    def put(x, y, c):
        if 0 <= x < W and 0 <= y < H:
            a[y, x, :3] = hex2rgb(c)
            a[y, x, 3] = 255
    for x, y, n in pts:
        for k in range(1, n + 1):
            for dx, dy in ((k, 0), (-k, 0), (0, k), (0, -k)):
                put(x + dx, y + dy, cols[1] if k < n else cols[0])
        if n >= 3:
            for dx, dy in ((1, 1), (-1, -1), (1, -1), (-1, 1)):
                put(x + dx, y + dy, cols[0])
        put(x, y, cols[2])
    return Image.fromarray(a, 'RGBA')


def pet_cat():
    f = Fig()
    OR = make_ramp('#5a2010', '#e8862a', '#ffd9a0', 7)
    CR = make_ramp('#a86a4a', '#ffd9a8', '#fff6e8', 5)
    STR = '#b04a18'
    # queue
    tail, T, S = spine_coords([(92, 226), (62, 222), (44, 200), (42, 170), (52, 146), (66, 136)], [9, 9, 8.5, 8, 7, 5])
    tv = -S * 0.5 + 0.2
    tc = quant(tv, OR, -0.7, 0.9)
    f.put(tail, tc, line=True)
    f.paint(tail & (np.sin(T * 34) > 0.55), STR)
    f.paint(tail & (T > 0.86), CR[3])
    # corps assis
    body = ell(122, 196, 54, 50) | ell(104, 214, 52, 32)
    body &= YY <= 244
    f.put(body, shade(body, OR, R=24, lo=-0.5, hi=1.1), line=True)
    # rayures du dos (courbes)
    for k in range(5):
        a0 = 150 + k * 9
        stripe = blank()
        for tt in np.linspace(0, 1, 40):
            ang = math.radians(170 + 50 * tt)
            r = 50 - k * 1
            stripe |= ell(122 + r * math.cos(ang) * (1 + 0.05 * k), a0 + 12 * math.sin(tt * math.pi) + 18, 2.2, 1.6)
        f.paint(stripe & body & (XX < 130), STR)
    # cuisse arrière
    haunch = ell(88, 214, 34, 28)
    f.put(haunch, shade(haunch, OR, R=16, lo=-0.5, hi=1.15), line=True, lc=mix(OR[0], OUT, 0.4))
    for k in range(3):
        f.paint(haunch & (np.abs(np.hypot(XX - 96, YY - 214) - (18 + k * 7)) < 1.4) & (XX < 90), STR)
    hp = ell(78, 238, 16, 6)
    f.put(hp, shade(hp, CR, R=4), line=True)
    # poitrail crème
    chest = ell(150, 186, 26, 36)
    f.paint(chest, shade(chest, CR, R=14, lo=-0.4, hi=1.1))
    # fourrure du poitrail (mèches)
    for x in range(132, 170, 6):
        line_px(f, [(x, 160 + (x % 4)), (x + 3, 170 + (x % 5))], CR[1])
    # pattes avant
    for lx, far in ((150, True), (170, False)):
        leg = capsule([(lx - 4, 200), (lx, 236)], [18, 16])
        f.put(leg, shade(leg, OR if not far else OR[:-1], R=7, lo=-0.5), line=True)
        paw = ell(lx + 2, 237, 11, 7)
        f.put(paw, shade(paw, CR, R=4), line=True)
        for d in (-3, 2):
            f.pxf(lx + 2 + d, 240, CR[0]); f.pxf(lx + 2 + d, 239, CR[0])
        f.paint(leg & (np.abs(YY - 212) < 1.2) & (XX < lx + 6), STR)
        f.paint(leg & (np.abs(YY - 222) < 1.2) & (XX < lx + 6), STR)
    # collier rouge + grelot doré
    col = poly([(126, 146), (172, 140), (176, 148), (130, 156)])
    f.put(col, shade(col, ['#4a0a1a', '#8a1a2a', '#c8303a', '#ff6a6a'], R=3), line=True)
    bell = ell(160, 157, 6, 6)
    f.put(bell, shade(bell, GOLD, R=4), line=True)
    f.pxf(160, 160, OUT); f.pxf(158, 155, '#ffffff')
    # tête
    head = ell(146, 110, 48, 40)
    ears = poly([(108, 96), (106, 50), (136, 78)]) | poly([(156, 76), (184, 46), (188, 96)])
    f.put(ears, shade(ears, OR, R=8, lo=-0.5), line=True)
    inner = poly([(113, 88), (112, 60), (130, 78)]) | poly([(162, 78), (181, 56), (183, 90)])
    f.paint(inner, quant(lightv(relief(inner, 4)), ['#a8505a', '#e88a9a', '#ffb8c0'], -0.4, 1.0))
    for x, y in ((114, 70), (116, 74), (178, 64), (176, 70)):
        f.pxf(x, y, CR[4])
    cheeks = poly([(98, 112), (88, 126), (104, 128)]) | poly([(192, 110), (204, 124), (188, 128)])
    head |= cheeks
    f.put(head, shade(head, OR, R=24, lo=-0.5, hi=1.1), line=True)
    # rayures du front (M)
    for x0 in (130, 140, 150):
        f.paint(capsule([(x0, 74), (x0 + 3, 90)], [3, 1]), STR)
    f.paint(capsule([(110, 100), (118, 104)], [2.5, 1]) | capsule([(106, 110), (114, 112)], [2.5, 1]), STR)
    f.paint(capsule([(190, 102), (182, 105)], [2.5, 1]) | capsule([(194, 112), (186, 113)], [2.5, 1]), STR)
    # museau crème
    muz = ell(158, 126, 24, 16) | ell(140, 128, 14, 12)
    f.paint(muz, shade(muz, CR, R=10, lo=-0.4))
    big_eye(f, 134, 106, 9, 12, '#5aa83a')
    big_eye(f, 172, 106, 8, 12, '#5aa83a')
    f.template(152, 120, ['.ppp.', 'pqqqp', '.ppp.', '..K..'], {'p': '#c85a6a', 'q': '#ff9aa8', 'K': OUT}, force=False)
    f.template(145, 124, ['K.......K', '.K..K..K.', '..KK.KK..'], {'K': '#5a2020'}, force=False)
    blush(f, 124, 124, 7, 3)
    blush(f, 184, 124, 6, 3)
    # moustaches (hors du contour : dessinées après)
    img = f.finish('#ffe0a0')
    a = np.array(img)
    for pts in (((190, 124), (222, 118)), ((190, 128), (222, 130)), ((112, 126), (84, 120)), ((112, 130), (84, 134))):
        (x0, y0), (x1, y1) = pts
        n = int(abs(x1 - x0))
        for i in range(n + 1):
            x = int(round(x0 + (x1 - x0) * i / n)); y = int(round(y0 + (y1 - y0) * i / n))
            if a[y, x, 3] == 0 or i > 6:
                a[y, x] = (255, 246, 232, 255)
    return Image.fromarray(a, 'RGBA')


def pet_owl():
    f = Fig()
    BR = make_ramp('#3a1e14', '#a8743e', '#e8c88c', 7)
    CRM = make_ramp('#a07a50', '#ecd4a0', '#fff6dc', 5)
    # livres sous les pattes (érudit)
    book1 = poly([(64, 224), (196, 220), (198, 244), (62, 244)])
    f.put(book1, shade(book1, ['#2a0a20', '#5a1a30', '#8a2a3a', '#b84a4a', '#d87060'], R=4), line=True)
    pages = poly([(70, 228), (190, 225), (190, 236), (70, 239)])
    f.paint(pages, '#f4ecd8')
    for y in (230, 233, 236):
        f.paint(pages & (YY == y), '#c8b898')
    f.paint(rect(60, 240, 200, 244) & book1, '#5a1a30')
    f.paint(rect(120, 220, 126, 244) & book1, GOLD[3])
    book2 = poly([(80, 206), (180, 202), (182, 222), (78, 224)])
    f.put(book2, shade(book2, ['#0a1a3a', '#1a3a6a', '#2a5aa0', '#4a7ac8', '#80a8e0'], R=4), line=True)
    pg2 = poly([(86, 210), (176, 207), (176, 216), (86, 219)])
    f.paint(pg2, '#f4ecd8')
    f.paint(pg2 & ((YY % 3) == 0), '#c8b898')
    f.paint(rect(150, 202, 155, 224) & book2, GOLD[3])
    # corps (œuf)
    body = ell(128, 140, 62, 72) & (YY < 210)
    feath = 0.18 * np.sin(XX * 0.45) * np.sin(YY * 0.5)
    f.put(body, shade(body, BR, R=30, lo=-0.55, hi=1.1, bias=feath), line=True)
    # ventre crème avec chevrons
    belly = ell(132, 162, 40, 44) & (YY < 206)
    f.paint(belly, shade(belly, CRM, R=18, lo=-0.4))
    for y in range(132, 204, 9):
        for x in range(100, 166, 10):
            xo = x + (5 if (y // 9) % 2 else 0)
            f.template(xo, y, ['K...K', '.K.K.', '..K..'], {'K': BR[2]}, force=False)
    # ailes repliées avec écailles de plumes
    for side, cx in ((-1, 76), (1, 184)):
        wing = ell(cx, 156, 22, 50, -10 * side) & (YY < 204)
        f.put(wing, shade(wing, BR, R=12, lo=-0.5, hi=1.0 if side < 0 else 0.8), line=True)
        for y in range(118, 200, 8):
            for x in range(cx - 18, cx + 20, 9):
                xo = x + (4 if (y // 8) % 2 else 0)
                f.paint(wing & ell(xo, y, 5, 4) & ~ell(xo, y - 1.5, 5, 4), BR[1])
                f.pxf(xo - 2, y - 2, BR[5])
        tip = poly([(cx - 10 * side, 196), (cx + 6 * side, 214), (cx + 16 * side, 196)])
        f.put(tip, shade(tip, BR, R=4), line=True)
    # pattes
    for x in (110, 150):
        foot = ell(x, 206, 10, 5) | capsule([(x - 6, 204), (x - 8, 210)], 3) | capsule([(x + 6, 204), (x + 8, 210)], 3)
        f.put(foot, shade(foot, ['#7a3a08', '#c8640a', '#f8a020', '#ffd060'], R=3), line=True)
    # tête : disque facial, aigrettes
    tufts = poly([(78, 92), (70, 40), (104, 70)]) | poly([(154, 70), (190, 38), (184, 92)])
    f.put(tufts, shade(tufts, BR, R=7, lo=-0.5), line=True)
    for x, y in ((76, 52), (80, 60), (186, 50), (182, 60)):
        f.pxf(x, y, BR[5])
    head = ell(130, 96, 60, 44)
    f.put(head, shade(head, BR, R=26, lo=-0.55, hi=1.1, bias=feath), line=True)
    # mouchetures
    rs = np.random.RandomState(4)
    for _ in range(60):
        x, y = rs.randint(70, 190), rs.randint(56, 200)
        if f.a[y, x] and not belly[y, x]:
            f.pxf(x, y, BR[5] if rs.rand() < 0.5 else BR[1])
    disc = ell(108, 98, 26, 24) | ell(154, 98, 26, 24)
    f.paint(disc, shade(disc, CRM, R=12, lo=-0.4))
    f.paint(disc & ~erode(erode(disc)), BR[3])
    big_eye(f, 108, 98, 15, 15, '#f8b818')
    big_eye(f, 154, 98, 15, 15, '#f8b818')
    # sourcils de savant
    f.paint(capsule([(92, 76), (118, 80)], [3, 2]) | capsule([(144, 80), (170, 76)], [2, 3]), BR[0])
    # bec
    beak = poly([(124, 108), (138, 108), (131, 126)])
    f.put(beak, shade(beak, ['#7a3a08', '#c8640a', '#f8a020', '#ffd060'], R=3), line=True)
    f.pxf(128, 110, '#ffe0a0')
    # lunettes rondes dorées (érudit) — monocle sur l'œil droit
    mono = ell(154, 98, 18, 18) & ~ell(154, 98, 16, 16)
    f.paint(mono, GOLD[4])
    f.paint(mono & (XX > 156) & (YY > 98), GOLD[2])
    img = f.finish('#ffe2a0')
    a = np.array(img)
    for i in range(22):  # chaînette du monocle
        x, y = 171 + i // 2, 104 + i * 2
        if 0 <= y < H and a[y, x, 3] == 0 or i % 3 == 0:
            a[y, x] = (*hex2rgb(GOLD[3 + (i % 2)]), 255)
    return Image.fromarray(a, 'RGBA')


def pet_fairy():
    f = Fig()
    WG = ['#3a78c8', '#6aaef0', '#a8daff', '#d8f2ff', '#ffffff']
    # ailes (derrière)
    for (cx, cy, rx, ry, ang) in ((88, 100, 34, 52, -35), (176, 92, 30, 48, 30), (92, 160, 22, 30, 30), (166, 156, 20, 28, -30)):
        w = ell(cx, cy, rx, ry, ang)
        v = lightv(relief(w, 10)) + 0.25 * np.sin(np.hypot(XX - 128, YY - 128) * 0.35)
        f.put(w, quant(v, WG, -0.4, 1.1, dither=0.2), line=True, lc='#2a5a9a')
        # nervures
        for k in (-0.6, 0, 0.6):
            a = math.radians(ang) + k * 0.4
            line_px(f, [(128, 128), (cx + math.cos(math.atan2(cy - 128, cx - 128) + k * 0.3) * rx * 0.6,
                                     cy + math.sin(math.atan2(cy - 128, cx - 128) + k * 0.3) * ry * 0.6)], WG[1])
        f.paint(w & ~erode(erode(w)), WG[3])
    # jambes
    for x in (118, 136):
        leg = capsule([(x, 196), (x - 2, 232)], [9, 7])
        f.put(leg, shade(leg, SKIN[1:], R=4), line=True)
        shoe = ell(x, 236, 8, 5)
        f.put(shoe, shade(shoe, ['#1a4a2a', '#2a7a3a', '#4aa84a', '#8ad87a'], R=3), line=True)
        f.pxf(x + 6, 234, '#ffe08a')
    # robe (feuilles)
    GR = make_ramp('#0a3a2a', '#3ac888', '#c8ffe0', 7)
    dress = poly([(110, 128), (146, 128), (152, 150), (176, 200), (128, 210), (80, 200), (104, 150)])
    dv = 0.3 * np.sin((XX - 128) * 0.28 + (YY - 128) * 0.02)
    f.put(dress, shade(dress, GR, R=14, lo=-0.5, hi=1.1, bias=dv), line=True)
    # ourlet en pétales
    for x in range(84, 176, 12):
        pet = ell(x + 6, 202 + 2 * math.sin(x), 8, 7)
        f.put(pet, shade(pet, GR, R=4, lo=-0.4), line=True)
        f.pxf(x + 6, 199, GR[6])
    f.paint(rect(108, 146, 150, 150) & dress, '#ffe08a')
    f.paint(rect(108, 150, 150, 150) & dress, '#c88a2a')
    # bras
    arm_l = capsule([(108, 134), (96, 160), (102, 176)], [10, 8, 7])
    f.put(arm_l, shade(arm_l, SKIN[1:], R=4), line=True)
    arm_r = capsule([(148, 134), (166, 124), (180, 108)], [10, 8, 7])
    # baguette étoilée
    wand = capsule([(176, 118), (194, 72)], 3)
    f.put(wand, shade(wand, LEATHER, R=2), line=True)
    star = poly([(196 + 15 * math.cos(math.radians(-90 + 36 * i)) * (1 if i % 2 == 0 else 0.45),
                  62 + 15 * math.sin(math.radians(-90 + 36 * i)) * (1 if i % 2 == 0 else 0.45)) for i in range(10)])
    f.put(star, shade(star, GOLD, R=5, lo=-0.4), line=True)
    f.pxf(193, 58, '#ffffff'); f.pxf(194, 58, '#ffffff')
    f.put(arm_r, shade(arm_r, SKIN[1:], R=4), line=True)
    f.put(ell(180, 110, 6, 6), shade(ell(180, 110, 6, 6), SKIN[1:], R=3), line=True)
    # tête
    HR = make_ramp('#7a4a10', '#f0c040', '#fff8c8', 7)
    back = ell(124, 80, 40, 40) | capsule([(96, 84), (84, 110), (90, 132)], [26, 20, 8])
    bv = 0.3 * np.sin(XX * 0.8 + YY * 0.2)
    f.put(back, shade(back, HR, R=10, lo=-0.5, hi=1.1, bias=bv), line=True)
    neck = rect(122, 116, 134, 130)
    f.put(neck, SKIN[2], line=True)
    face = ell(136, 92, 30, 30) & (YY > 66)
    f.put(face, quant(lightv(relief(face, 12)) + 0.15, SKIN[2:], -0.4, 1.1), line=True,
          lc=mix(SKIN[0], OUT, 0.3))
    # frange en mèches
    bang = blank()
    for x0, tip in ((104, 92), (114, 84), (124, 80), (134, 84), (146, 78), (156, 86)):
        bang |= poly([(x0 - 2, 56), (x0 + 12, 56), (x0 + 8, tip - 10), (x0 + 3, tip)])
    top = ell(130, 66, 38, 22) | bang
    hv = 0.3 * np.sin(XX * 0.9 + YY * 0.15) + lightv(relief(top, 7))
    f.put(top, quant(hv, HR, -0.5, 1.1), line=True, lc=mix(HR[0], OUT, 0.4))
    for x0 in range(100, 166, 7):
        line_px(f, [(x0, 56), (x0 + 4, 70 + (x0 % 9))], HR[2])
    for x, y in ((112, 52), (116, 50), (120, 49), (124, 48)):
        f.pxf(x, y, '#ffffff')
    # couronne de fleurs
    for x, y, c in ((100, 66, '#ff8ab8'), (114, 52, '#ffffff'), (132, 46, '#ff8ab8'), (150, 50, '#ffd040')):
        fl = ell(x, y, 5, 5)
        f.put(fl, c, line=True)
        f.pxf(x, y, '#ffe060' if c != '#ffd040' else '#c86a10')
    big_eye(f, 130, 98, 6, 9, '#2a8a5a')
    big_eye(f, 153, 98, 5, 9, '#2a8a5a')
    f.paint(capsule([(124, 86), (135, 84)], 1.5) | capsule([(149, 85), (157, 86)], 1.5), HR[1])
    blush(f, 125, 110, 5, 2.5)
    blush(f, 160, 109, 4, 2.5)
    f.template(141, 112, ['K...K', '.KKK.'], {'K': '#7a3040'}, force=False)
    img = f.finish('#c8ffe8')
    return add_sparks(img, [(216, 44, 3), (206, 92, 2), (60, 60, 2), (52, 180, 2), (206, 170, 2), (176, 30, 1)],
                      ['#6aaef0', '#d8f2ff', '#ffffff'])


def pet_golem():
    f = Fig()
    ST = ['#1e1c2c', '#33313f', '#4e4c5e', '#6c6a7c', '#8c8a9c', '#aeacbc', '#cecde0', '#eeeef8']
    CRY = ['#0a2a6a', '#1a5ac8', '#3aa0f8', '#8ad8ff', '#e0f8ff']
    rs = np.random.RandomState(9)

    def rock(m, R=12, bias=None, far=0):
        tex = 0.12 * np.sin(XX * 0.7 + YY * 0.3) * np.sin(YY * 0.5 - XX * 0.2)
        b = tex if bias is None else tex + bias
        f.put(m, shade(m, ST[:len(ST) - far], R=R, lo=-0.55, hi=1.15, bias=b, profile='bevel'), line=True,
              lc=mix(ST[0], OUT, 0.4))
        # mouchetures
        ys, xs = np.nonzero(m & erode(erode(m)))
        for i in rs.choice(len(ys), max(1, len(ys) // 60), replace=False):
            f.pxf(xs[i], ys[i], ST[2] if rs.rand() < 0.6 else ST[6])

    def crack(pts):
        line_px(f, pts, ST[0])
        line_px(f, [(x + 1, y + 1) for x, y in pts], ST[5])
    # jambes
    for x in (100, 156):
        leg = poly([(x - 18, 206), (x + 18, 206), (x + 20, 244), (x - 20, 244)])
        rock(leg, R=8, far=1)
    # bras arrière
    armb = ell(60, 170, 24, 30, 10)
    rock(armb, R=12, far=1)
    # corps
    body = poly([(70, 110), (186, 104), (200, 150), (194, 212), (64, 214), (58, 150)])
    rock(body, R=26)
    crack([(80, 190), (92, 178), (90, 166)])
    crack([(176, 196), (184, 184)])
    crack([(150, 120), (160, 128), (158, 138)])
    # cristal du poitrail
    gem = poly([(128, 166), (140, 176), (134, 196), (122, 196), (116, 176)])
    f.put(gem, quant(lightv(relief(gem, 5, 1.6)), CRY, -0.4, 1.0), line=True)
    f.pxf(124, 174, '#ffffff'); f.pxf(125, 173, '#ffffff')
    # tête intégrée : yeux cristal, bouche rose
    for cx in (104, 152):
        sock = ell(cx, 142, 12, 10)
        f.paint(sock, ST[1])
        eye = ell(cx + 1, 143, 7, 8)
        f.paint(eye, quant(lightv(relief(eye, 4, 1.5)), CRY, -0.4, 1.0))
        f.pxf(cx - 1, 139, '#ffffff'); f.pxf(cx, 139, '#ffffff'); f.pxf(cx - 1, 140, '#ffffff')
    f.paint(ell(130, 162, 7, 3.5), '#e86a8a')
    f.paint(ell(130, 161, 5, 1.5), '#ff9ab0')
    blush(f, 86, 160, 7, 3, '#c87a9a')
    blush(f, 172, 160, 7, 3, '#c87a9a')
    # bras avant (gros poing)
    armf = ell(198, 176, 26, 30, -10)
    rock(armf, R=12)
    crack([(200, 160), (206, 172)])
    fist = ell(206, 206, 22, 18)
    rock(fist, R=10)
    for x in (196, 206, 216):
        f.paint(fist & (XX == x) & (YY > 200), ST[1])
    # mousse et pousses sur la tête
    MO = ['#1a3a14', '#2a6a1a', '#4a9a2a', '#7ac83a', '#b8f070']
    moss = ell(128, 108, 54, 10) | ell(98, 104, 16, 8) | ell(162, 102, 18, 9)
    mv = 0.4 * np.sin(XX * 1.3) * np.cos(YY * 1.1) + lightv(relief(moss, 4))
    f.put(moss, quant(mv, MO, -0.6, 1.2), line=True)
    for x in range(72, 186, 7):
        f.paint(ell(x, 117 + (x % 3), 3, 2.5) & body, MO[1 + (x % 2)])
    for (bx, by, ang, h) in ((116, 100, -20, 30), (130, 98, 5, 38), (144, 100, 25, 28)):
        stem = capsule([(bx, by), (bx + math.sin(math.radians(ang)) * h, by - h)], [3, 2])
        f.put(stem, MO[2], line=True)
        tx, ty = bx + math.sin(math.radians(ang)) * h, by - h
        for side in (-1, 1):
            leaf = ell(tx + side * 7, ty - 2, 8, 4, side * -25)
            f.put(leaf, quant(lightv(relief(leaf, 3)), MO, -0.4, 1.0), line=True)
            f.paint(capsule([(tx, ty), (tx + side * 12, ty - 4)], 1), MO[1])
    # fleur
    fl = ell(84, 98, 6, 6)
    f.put(fl, '#ffffff', line=True)
    f.pxf(84, 98, '#ffd040'); f.pxf(85, 98, '#e8a020')
    img = f.finish('#9ad8ff')
    return add_sparks(img, [(222, 136, 2), (40, 116, 2)], ['#3aa0f8', '#8ad8ff', '#ffffff'])


def pet_wisp():
    f = Fig()
    FL = ['#5a0a08', '#a81a08', '#e04410', '#ff7a1a', '#ffaa2a', '#ffd25a', '#fff09a', '#fffbe8']
    # langues de flamme (ondulées)
    tongues = blank()
    for spine, wd in (([(124, 140), (114, 100), (124, 64), (146, 36), (142, 20)], [90, 64, 40, 16, 1]),
                      ([(96, 150), (80, 116), (86, 90), (76, 72)], [50, 36, 16, 1]),
                      ([(160, 146), (176, 114), (170, 92), (182, 76)], [48, 32, 14, 1]),
                      ([(72, 196), (54, 170), (58, 148)], [26, 14, 1]),
                      ([(184, 196), (204, 168), (198, 150)], [26, 14, 1])):
        m, T, S = spine_coords(spine, [w / 2 for w in wd])
        tongues |= m
    core = ell(128, 176, 72, 64)
    fire = (tongues | core) & (YY < 242)
    rr = np.hypot((XX - 126) / 66, (YY - 182) / 74)
    v = 1.25 - rr + 0.06 * np.sin(YY * 0.35 - XX * 0.12) + 0.25 * lightv(relief(fire, 14))
    f.put(fire, quant(v, FL, -0.2, 1.3, dither=0.18), line=False)
    # contour intérieur rougeoyant
    f.paint(fire & ~erode(fire), FL[1])
    f.paint(fire & ~erode(erode(fire)) & erode(fire), FL[2])
    # visage
    big_eye(f, 110, 170, 13, 20, '#5a1a08')
    big_eye(f, 152, 170, 12, 20, '#5a1a08')
    blush(f, 90, 198, 9, 4, '#ff5a3a')
    blush(f, 172, 198, 9, 4, '#ff5a3a')
    f.template(124, 196, ['K.....K', '.KKKKK.', '..KppK.', '...KK..'], {'K': '#5a0a08', 'p': '#ff6a5a'}, force=False)
    img = f.finish('#ffe08a')
    a = np.array(img)
    # flammèches et braises (sans contour)
    r = np.random.RandomState(5)
    for _ in range(18):
        x, y = int(r.uniform(40, 220)), int(r.uniform(20, 236))
        if a[y, x, 3]:
            continue
        c = hex2rgb(FL[r.randint(3, 7)])
        a[y, x] = (*c, 255)
        if r.rand() < 0.6:
            a[y - 1, x] = (*hex2rgb(FL[2]), 255)
    img = Image.fromarray(a, 'RGBA')
    return add_sparks(img, [(214, 80, 3), (40, 92, 2), (222, 196, 2), (34, 200, 2)], ['#e04410', '#ffaa2a', '#fffbe8'])


PETS = {'golden_slime': pet_slime, 'cat': pet_cat, 'owl': pet_owl, 'fairy': pet_fairy, 'golem': pet_golem,
        'wisp': pet_wisp}

if __name__ == '__main__':
    main(sys.argv[1:])
