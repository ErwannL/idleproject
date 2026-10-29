"""Illustrations « HD » des alliés de rareté R (256×256, pixel art 1×, vue 3/4 vers la droite).

Mêmes personnages que les sprites de tools/art/allies_r.py (couleurs, costumes, armes),
en proportions héroïques. Lumière haut-gauche, ombres bleu-violet, liseré de couleur d'accent à droite,
contour sélectif #1a1226. Sorties : assets/hd/ally_<id>.png + tools/art/preview_hd_allies_r.png.

Méthode : chaque pièce est un masque (polygones, ellipses, tubes) ombré automatiquement : un champ de hauteur
(distance au bord) donne une normale, éclairée puis quantifiée sur une rampe de couleurs avec un tramage
de Bayer limité aux transitions. Les détails (yeux, rivets, plis, gravures) sont posés à la main par-dessus.

Usage : python3 tools/art/hd_allies_r.py
"""
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from lib import hex2rgb, mix, shift  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(HERE))
S = 256
G = 244  # ligne de sol
OUT = '#1a1226'
INK = '#1a1226'
WHITE = '#fbfbff'

# ---------------------------------------------------------------- palettes (reprises du sprite, étendues)

SKIN = ['#6e3446', '#a4566a', '#d0806a', '#f0a888', '#ffcfac', '#ffe8d4']
STEEL = ['#232741', '#3b4260', '#5a6584', '#7f8ca8', '#a8b6cc', '#d4dcea', '#f6f8fc']
DSTEEL = ['#0e0c1c', '#1a1830', '#2a2a48', '#3e4266', '#5a6288', '#8a94bc', '#c0c8e6']
HELM = ['#141228', '#24254a', '#383d68', '#525a88', '#727eaa', '#a2acd2', '#d4daf2']
BLUE = ['#10164a', '#16267a', '#1f3fa8', '#2a5cd0', '#3f80f0', '#6aaaff', '#b0dcff']
RED = ['#2e0820', '#5e0e2a', '#8e1630', '#c42632', '#ec4a3c', '#ff7c56', '#ffb088']
GOLD = ['#5a2a16', '#8e4e1a', '#c07c22', '#e8b236', '#ffd866', '#fff2b0']
LEATHER = ['#2a1310', '#4a2617', '#6e3c20', '#94582a', '#b87a3a', '#dca460', '#f4cc8a']
DLEATHER = ['#1c0c16', '#2e1622', '#442432', '#5e3a40', '#7e5650', '#a47a66']
BROWN_HAIR = ['#21100e', '#3e1e14', '#62321c', '#8a4c24', '#b06c30', '#d89448', '#f0b868']
GREEN = ['#0a2024', '#0f3a32', '#16583e', '#228040', '#3aa84a', '#6ccc5a', '#aee87a']
MOSS = ['#141e1c', '#1e3028', '#2c4632', '#3e5e3c', '#58784a', '#7e9a5e']
WOOD = ['#2a1412', '#4a2618', '#6e3e22', '#985e30', '#c08446', '#e4b070']
FIRE_HAIR = ['#561410', '#8e2c14', '#c4501c', '#ec7a26', '#ffa840', '#ffd070', '#fff0b0']
BLONDE = ['#5e3418', '#8e5a1e', '#c08a2a', '#e8b840', '#ffd86a', '#fff0a8']
CLOTH_W = ['#3e3e6c', '#62679a', '#8e94c2', '#bcc2e2', '#e2e6f6', '#fbfcff']
NAVY = ['#0a0c30', '#121a56', '#1c2a80', '#2840a8', '#3a5ccc', '#5a86ea', '#90b8ff']
PURPLE = ['#16082a', '#2a1050', '#43207a', '#5e2ea2', '#8048c8', '#a678e6', '#d0b0ff']
SHADOWC = ['#0c0816', '#160f26', '#211a38', '#2e254c', '#3e3464', '#544a80', '#7466a6']
SILVER = ['#3e3c62', '#5e6088', '#8a8eb4', '#b4b8d8', '#dadcf0', '#f4f4fc']
BRONZE = ['#34160c', '#5a2c12', '#84461a', '#ae6824', '#d48e36', '#f0b45a', '#ffe0a0']
GINGER = ['#401008', '#6e200c', '#a03a12', '#d05a1a', '#f08430', '#ffb058', '#ffdc96']
IVORY = ['#4e4038', '#7a6a5c', '#a8988a', '#d0c6b6', '#ece6da', '#ffffff']

# yeux : (sombre, iris, clair)
EYE_BLUE = ('#16226a', '#2f6ee0', '#8ad0ff')
EYE_AMBER = ('#4a200c', '#b86a1e', '#f4b44a')
EYE_GREEN = ('#0a3628', '#1e9a52', '#7ee88a')
EYE_RED = ('#4a0814', '#d02a30', '#ff9a5a')
EYE_SKY = ('#163478', '#3a8ef0', '#b0e8ff')
EYE_VIOLET = ('#4a1290', '#b060ff', '#f0d0ff')
EYE_BROWN = ('#2a1206', '#6a3a1a', '#b07a3a')

LIGHT = np.array([-0.52, -0.68, 0.52])
LIGHT = LIGHT / np.linalg.norm(LIGHT)
_B4 = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0
BAYER = np.tile(_B4, (S // 4, S // 4))
YY, XX = np.mgrid[0:S, 0:S]


def rgb(h):
    return np.array(hex2rgb(h), dtype=np.uint8)


# ---------------------------------------------------------------- masques

def _draw(fn):
    img = Image.new('L', (S, S), 0)
    fn(ImageDraw.Draw(img))
    return np.array(img) > 0


def poly(pts):
    return _draw(lambda d: d.polygon([(float(x), float(y)) for x, y in pts], fill=255))


def ell(cx, cy, rx, ry):
    return _draw(lambda d: d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=255))


def capsule(p0, p1, r0, r1=None):
    """Tube conique entre deux disques."""
    r1 = r0 if r1 is None else r1
    (x0, y0), (x1, y1) = p0, p1
    dx, dy = x1 - x0, y1 - y0
    ln = math.hypot(dx, dy) or 1
    nx, ny = -dy / ln, dx / ln
    m = poly([(x0 + nx * r0, y0 + ny * r0), (x1 + nx * r1, y1 + ny * r1),
              (x1 - nx * r1, y1 - ny * r1), (x0 - nx * r0, y0 - ny * r0)])
    return m | ell(x0, y0, r0, r0) | ell(x1, y1, r1, r1)


def tube(pts, radii):
    m = np.zeros((S, S), bool)
    for i in range(len(pts) - 1):
        m |= capsule(pts[i], pts[i + 1], radii[i], radii[i + 1])
    return m


def seg(p0, p1, w=1):
    return _draw(lambda d: d.line([tuple(p0), tuple(p1)], fill=255, width=w))


def bez(p0, p1, p2, n=24):
    return [((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0],
             (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]) for t in (i / n for i in range(n + 1))]


def path(pts, w=1):
    return _draw(lambda d: d.line([tuple(p) for p in pts], fill=255, width=w, joint='curve' if w > 2 else None))


def shift_m(m, dx, dy):
    o = np.zeros_like(m)
    ys = slice(max(dy, 0), S + min(dy, 0))
    yd = slice(max(-dy, 0), S + min(-dy, 0))
    xs = slice(max(dx, 0), S + min(dx, 0))
    xd = slice(max(-dx, 0), S + min(-dx, 0))
    o[ys, xs] = m[yd, xd]
    return o


def erode(m, diag=False):
    e = m.copy()
    e[1:, :] &= m[:-1, :]
    e[:-1, :] &= m[1:, :]
    e[:, 1:] &= m[:, :-1]
    e[:, :-1] &= m[:, 1:]
    e[0, :] = e[-1, :] = False
    e[:, 0] = e[:, -1] = False
    if diag:
        e[1:, 1:] &= m[:-1, :-1]
        e[:-1, :-1] &= m[1:, 1:]
        e[1:, :-1] &= m[:-1, 1:]
        e[:-1, 1:] &= m[1:, :-1]
    return e


def dilate(m):
    d = m.copy()
    d[1:, :] |= m[:-1, :]
    d[:-1, :] |= m[1:, :]
    d[:, 1:] |= m[:, :-1]
    d[:, :-1] |= m[:, 1:]
    return d


def border(m):
    return m & ~erode(m)


def blur(a):
    p = np.pad(a, 1, mode='edge')
    return sum(p[1 + dy:S + 1 + dy, 1 + dx:S + 1 + dx] for dy in (-1, 0, 1) for dx in (-1, 0, 1)) / 9.0


def field(m, rad=None, flat=1.0):
    """Lumière (lambert) et composante x de la normale d'une forme gonflée."""
    d = np.zeros((S, S))
    cur = m
    i = 0
    while cur.any() and i < 60:
        d += cur
        cur = erode(cur, diag=(i % 2 == 1))
        i += 1
    R = rad or max(1.0, min(d.max(), 9.0))
    u = np.clip(d / R, 0, 1)
    h = np.sqrt(np.clip(1 - (1 - u) ** 2, 0, 1)) * R
    h = blur(blur(h))
    gy, gx = np.gradient(h)
    k = 0.85 / flat
    nx, ny, nz = -gx * k, -gy * k, np.ones_like(h)
    n = np.sqrt(nx * nx + ny * ny + nz * nz)
    nx, ny, nz = nx / n, ny / n, nz / n
    lam = nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]
    return lam, nx


# ---------------------------------------------------------------- toile

class Pic:
    def __init__(self, accent):
        self.c = np.zeros((S, S, 3), np.uint8)
        self.a = np.zeros((S, S), bool)
        self.nx = np.zeros((S, S))
        self.accent = accent
        self.fx_c = np.zeros((S, S, 3), np.uint8)
        self.fx_a = np.zeros((S, S), bool)
        self.norim = np.zeros((S, S), bool)

    def paint(self, m, R, rad=None, bias=0.0, con=1.0, lin=0.5, dith=0.4, line=True, clip=False, tex=None,
              flat=1.0, edge=None, lit_edge=True, rim=True):
        """Pose une pièce ombrée. R : rampe sombre -> clair."""
        if clip:
            m = m & self.a
        if not m.any():
            return m
        lam, nx = field(m, rad, flat)
        ys, xs = np.nonzero(m)
        cx, cy = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2
        hw, hh = max(4, (xs.max() - xs.min()) / 2), max(4, (ys.max() - ys.min()) / 2)
        lx, ly = (XX - cx) / hw, (YY - cy) / hh
        t = 0.5 + (lam - 0.55) * 1.05 * con - (lx * 0.45 + ly * 0.55) * lin * 0.6 + bias
        if tex is not None:
            t = t + tex
        n = len(R)
        q = t * n + (BAYER - 0.5) * dith
        idx = np.clip(np.floor(q), 0, n - 1).astype(int)
        cols = np.array([hex2rgb(c) for c in R], np.uint8)
        new = cols[idx]
        if line:
            prev = self.a & ~m
            touch = m & (shift_m(prev, 1, 0) | shift_m(prev, -1, 0) | shift_m(prev, 0, 1) | shift_m(prev, 0, -1))
            dark = rgb(edge or mix(R[0], OUT, 0.5))
            lite = rgb(R[min(n - 1, 2)])
            # contour sélectif : les bords tournés vers la lumière restent clairs
            litm = touch & (lam > 0.82) if lit_edge else np.zeros_like(touch)
            new[touch & ~litm] = dark
            new[litm] = lite
        self.c[m] = new[m]
        self.a |= m
        self.nx[m] = nx[m]
        if not rim:
            self.norim |= m
        else:
            self.norim &= ~m
        return m

    def fill(self, m, col, clip=True):
        if clip:
            m = m & self.a
        self.c[m] = rgb(col)
        self.a |= m
        return m

    def px(self, x, y, col, clip=False):
        x, y = int(round(x)), int(round(y))
        if 0 <= x < S and 0 <= y < S and (not clip or self.a[y, x]):
            self.c[y, x] = rgb(col)
            self.a[y, x] = True

    def get(self, x, y):
        return '#%02x%02x%02x' % tuple(self.c[y, x])

    def line(self, pts, col, w=1, clip=True):
        return self.fill(path(pts, w), col, clip)

    def fold(self, pts, dark, lite=None, clip=True, side=(-1, -1)):
        """Pli : trait sombre + reflet décalé vers la lumière."""
        m = path(pts, 1)
        if lite:
            self.fill(shift_m(m, side[0], 0) & ~m, lite, clip)
        self.fill(m, dark, clip)

    def finish(self):
        a = self.a
        # liseré de lumière (rim light) côté droit
        right_edge = a & ~shift_m(a, -1, 0) & ~self.norim
        ur = a & ~shift_m(a, -1, 1) & ~self.norim
        r1 = (right_edge | (ur & (self.nx > 0.2))) & (YY < G - 1)
        r2 = shift_m(r1, -1, 0) & a & ~r1 & (self.nx > 0.35) & ~self.norim
        acc = np.array(hex2rgb(self.accent), float)
        c = self.c.astype(float)
        lum = c.mean(axis=2, keepdims=True)
        for m, k in ((r1, 0.5), (r2, 0.22)):
            kk = k * np.clip(0.55 + lum / 255, 0, 1)
            c[m] = (c * (1 - kk) + acc * kk)[m]
        self.c = c.astype(np.uint8)
        # contour extérieur
        o = dilate(a) & ~a
        self.c[o] = rgb(OUT)
        self.a = a | o
        # effets par-dessus (sans contour noir)
        self.c[self.fx_a] = self.fx_c[self.fx_a]
        self.a |= self.fx_a

    def fx(self, m, col):
        self.fx_c[m] = rgb(col)
        self.fx_a |= m

    def fxpx(self, x, y, col):
        x, y = int(round(x)), int(round(y))
        if 0 <= x < S and 0 <= y < S:
            self.fx_c[y, x] = rgb(col)
            self.fx_a[y, x] = True

    def image(self):
        arr = np.zeros((S, S, 4), np.uint8)
        arr[..., :3] = self.c
        arr[..., 3] = np.where(self.a, 255, 0)
        return Image.fromarray(arr, 'RGBA')


# ---------------------------------------------------------------- effets

def sparkle(p, x, y, size, cols):
    """Étoile à 4 branches (cols : centre, branches, pointes)."""
    p.fxpx(x, y, cols[0])
    for d in range(1, size + 1):
        col = cols[1] if d < size else cols[2]
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            p.fxpx(x + dx * d, y + dy * d, col)
    if size >= 3:
        for dx, dy in ((1, 1), (-1, -1), (1, -1), (-1, 1)):
            p.fxpx(x + dx, y + dy, cols[2])


def glint(p, x, y, col='#ffffff'):
    p.px(x, y, col)
    p.px(x - 1, y, mix(col, p.get(int(x) - 1, int(y)), 0.5))


# ---------------------------------------------------------------- corps

def eye(p, x, y, w, iris, near=True, lid=INK, brow=None, brow_dy=-3, brow_tilt=0, closed=False, skin=SKIN,
        lash=False):
    """Œil 3/4 (x, y = coin haut-gauche). near : œil côté spectateur (plus large)."""
    h = 5 if near else 4
    if lash:  # cils marqués
        if near:
            p.px(x - 2, y - 1, lid); p.px(x - 1, y - 1, lid)
        else:
            p.px(x + w + 1, y - 1, lid)
        for i in range(w):
            p.px(x + i, y - 1 if (near and i < 2) else y, lid)
    if closed:
        for i in range(w):
            p.px(x + i, y + 2 + (1 if 0 < i < w - 1 else 0), lid)
        p.px(x - 1, y + 2, lid)
    else:
        for i in range(-1 if near else 0, w + 1):
            p.px(x + i, y, lid)
        p.px(x - 1 if near else x + w, y + 1, lid)  # cil extérieur
        for j in range(1, h):
            for i in range(w):
                p.px(x + i, y + j, WHITE if (i == 0 or (near and i == w - 1 and j > 1)) else iris[1])
        # iris : haut sombre, pupille, bas clair
        ix0, ix1 = x + 1, x + w - (1 if near else 0)
        for i in range(ix0, ix1):
            p.px(i, y + 1, iris[0])
        for i in range(ix0, ix1):
            p.px(i, y + h - 1, iris[2])
        pc = (ix0 + ix1 - 1) / 2
        p.px(pc, y + 2, INK)
        if near:
            p.px(pc + 1, y + 2, INK)
            p.px(pc, y + 3, iris[0])
        p.px(ix0, y + 2, WHITE)  # éclat
        if near:
            p.px(ix1 - 1, y + h - 2, iris[2])
        for i in range(w):
            p.px(x + i, y + h, skin[2])  # paupière basse
    if brow:
        for i in range(-1, w + 1):
            t = (i + 1) / (w + 1)
            p.px(x + i, y + brow_dy + round(brow_tilt * (t - 0.5)) - (1 if 0.2 < t < 0.7 else 0), brow)
        p.px(x + (w if brow_tilt > 0 else -1), y + brow_dy + 1, brow)


def head_base(p, hc, skin=SKIN, ear=True, jaw=0, fem=False):
    """Tête 3/4 vers la droite. hc = (cx, cy) centre du crâne. Renvoie le masque de peau du visage."""
    cx, cy = hc
    f = 1 if fem else 0
    m = ell(cx - 1, cy - 2, 17, 18)
    m |= poly([(cx - 13, cy + 4), (cx - 6, cy + 14 + jaw - f), (cx + 4, cy + 19 + jaw - f), (cx + 10, cy + 21 + jaw - f),
               (cx + 14 - f, cy + 20 + jaw - f), (cx + 17 - f, cy + 16), (cx + 18, cy + 12), (cx + 19, cy + 10),
               (cx + 22 - f, cy + 8), (cx + 22 - f, cy + 6), (cx + 18, cy - 1), (cx + 17, cy - 4), (cx + 15, cy - 12),
               (cx + 8, cy - 18)])
    p.paint(m, skin, con=0.7, lin=0.25, bias=0.2, flat=2.0, lit_edge=False)
    # ombres : dessous de mâchoire, joue lointaine, arrière du visage
    jawsh = m & ~shift_m(m, 0, -3) & (YY > cy + 8)
    p.fill(jawsh & (XX < cx + 15), skin[2])
    p.fill(m & ~shift_m(m, 0, -1) & (YY > cy + 8), skin[1])
    far = m & (XX >= cx + 16) & (YY > cy + 9)
    p.fill(far, skin[3])
    p.fill(m & (XX < cx - 6) & (YY > cy - 4), skin[3])
    # nez : arête claire, ombre portée
    p.px(cx + 19, cy + 2, skin[5]); p.px(cx + 20, cy + 4, skin[5]); p.px(cx + 20, cy + 5, skin[4])
    p.px(cx + 18, cy + 9, skin[2]); p.px(cx + 19, cy + 9, skin[2]); p.px(cx + 20, cy + 9, skin[3])
    p.px(cx + 17, cy + 8, skin[3])
    # pommette
    p.px(cx + 7, cy + 9, mix(skin[4], '#ff8a9a', 0.45)); p.px(cx + 8, cy + 9, mix(skin[4], '#ff8a9a', 0.45))
    p.px(cx + 9, cy + 9, mix(skin[4], '#ff8a9a', 0.3))
    if ear:
        e = ell(cx - 8, cy + 3, 4, 6)
        p.paint(e, skin, con=0.8, bias=0.05, flat=1.5)
        p.line([(cx - 8, cy + 0), (cx - 7, cy + 6)], skin[2])
        p.px(cx - 9, cy - 1, skin[5])
    return m


def cast_shadow(p, over, onto, col, depth=2, dx=1):
    """Ombre portée d'une pièce (cheveux, casque) sur une autre (visage)."""
    sh = np.zeros((S, S), bool)
    for k in range(1, depth + 1):
        sh |= shift_m(over, dx, k)
    p.fill(sh & onto & ~over, col)


def mouth(p, x, y, kind='smile', col='#8a2a3a', lip=None):
    if kind == 'smile':
        p.px(x, y, col); p.px(x + 1, y + 1, col); p.px(x + 2, y + 1, col); p.px(x + 3, y + 1, col); p.px(x + 4, y, col)
        if lip:
            p.px(x + 2, y + 2, lip)
    elif kind == 'smirk':
        p.px(x, y + 1, col); p.px(x + 1, y + 1, col); p.px(x + 2, y + 1, col); p.px(x + 3, y, col); p.px(x + 4, y - 1, col)
        if lip:
            p.px(x + 1, y + 2, lip)
    elif kind == 'firm':
        for i in range(4):
            p.px(x + i, y, col)
        if lip:
            p.px(x + 1, y + 1, lip); p.px(x + 2, y + 1, lip)
    elif kind == 'open':
        p.px(x, y, col); p.px(x + 4, y, col)
        for i in range(1, 4):
            p.px(x + i, y, col); p.px(x + i, y + 1, '#c8384a'); p.px(x + i, y + 2, col)
        p.px(x + 1, y + 1, '#fbe8e8'); p.px(x + 2, y + 1, '#fbe8e8')


def hand(p, c, R, r=5.5, grip=True, knuckle_dir=1):
    """Poing (tenant une arme) : volume + jointures."""
    x, y = c
    m = ell(x, y, r, r * 0.92)
    p.paint(m, R, con=1.1)
    if grip:
        for i in range(3):
            yy = y - r * 0.45 + i * r * 0.42
            p.line([(x + knuckle_dir * (r - 3.5), yy), (x + knuckle_dir * (r - 1.5), yy)], R[1])
    return m


def boot(p, ankle, toe_x, top, R, cuff=None, w=8.0):
    ax, ay = ankle
    m = poly([(ax - w, top), (ax + w - 1, top), (ax + w, ay + 2), (toe_x - 5, G - 9), (toe_x, G - 5), (toe_x + 1, G),
              (ax - w - 1, G), (ax - w, ay)])
    m |= ell(toe_x - 5, G - 4.5, 6, 4.5)
    p.paint(m, R, con=1.1, lin=0.5)
    # semelle
    p.line([(ax - w - 1, G), (toe_x + 1, G)], R[0])
    p.line([(ax - w, G - 1), (toe_x, G - 1)], mix(R[0], R[1], 0.5))
    if cuff:
        cm = poly([(ax - w - 1.5, top - 2), (ax + w + 1, top - 2), (ax + w + 1.5, top + 6), (ax - w - 2, top + 6)])
        p.paint(cm, cuff, con=0.9)
    return m



def buckle(p, x, y, w, h, hole):
    """Boucle de ceinture dorée (cadre + ardillon)."""
    p.paint(poly([(x, y), (x + w, y), (x + w, y + h), (x, y + h)]), GOLD, con=1.2)
    p.fill(poly([(x + 3, y + 3), (x + w - 2, y + 3), (x + w - 2, y + h - 2), (x + 3, y + h - 2)]), hole)
    p.line([(x + w // 2 + 1, y + 3), (x + w // 2 + 1, y + h - 3)], GOLD[3])
    p.px(x + 1, y + 1, GOLD[5])


LEG_B = ((116, 150), (110, 194), (106, 228), 120)
LEG_F = ((138, 150), (146, 194), (152, 228), 168)


def legs(p, PANTS, BOOT, top=214, radii=(11, 8, 6.5), cuff=None, dk=-0.14, wb=8, legs=(LEG_B, LEG_F), knee=None,
         con=1.1, folds=True):
    """Deux jambes (arrière assombrie) + bottes."""
    for i, (hip, kn, ank, toe) in enumerate(legs):
        d = dk if i == 0 else 0.0
        p.paint(tube([hip, kn, ank], list(radii)), PANTS, bias=d, con=con)
        if folds:
            p.fold([(kn[0] - 4, kn[1] - 2), (kn[0] + 2, kn[1] + 2)], PANTS[1], PANTS[3])
            p.fold([(hip[0] - 2, hip[1] + 12), (kn[0] + 3, kn[1] - 12)], PANTS[1], PANTS[3])
        if knee:
            knee(p, kn, d)
        boot(p, ank, toe, top, BOOT, w=wb)
        if cuff:
            cm = poly([(ank[0] - wb - 2, top - 3), (ank[0] + wb + 1, top - 4), (ank[0] + wb + 2, top + 5),
                       (ank[0] - wb - 2, top + 5)])
            p.paint(cm, cuff, bias=d + 0.05, con=0.9)
            p.line([(ank[0] - wb - 1, top + 4), (ank[0] + wb + 1, top + 4)], cuff[1])


def spikes_mask(base, tips):
    """Masse de cheveux : base + mèches courbes (x0, y0, x1, y1, tx, ty[, courbure])."""
    m = base.copy()
    for t in tips:
        x0, y0, x1, y1, tx, ty = t[:6]
        bend = t[6] if len(t) > 6 else 0.25
        # contrôle : milieu base->pointe décalé perpendiculairement (mèche qui ondule)
        def ctrl(ax, ay):
            mx, my = (ax + tx) / 2, (ay + ty) / 2
            dx, dy = tx - ax, ty - ay
            return mx - dy * bend, my + dx * bend
        m |= poly(bez((x0, y0), ctrl(x0, y0), (tx, ty), 10) + bez((tx, ty), ctrl(x1, y1), (x1, y1), 10)[1:])
    return m


def strands(p, tips, R, k=0.55):
    """Mèches : reflet clair près de la base, trait sombre vers la pointe."""
    for t in tips:
        x0, y0, x1, y1, tx, ty = t[:6]
        mx, my = (x0 + x1) / 2, (y0 + y1) / 2
        p.line([(mx + (tx - mx) * 0.15, my + (ty - my) * 0.15), (mx + (tx - mx) * k, my + (ty - my) * k)], R[1])
        p.line([(mx + (tx - mx) * 0.1 - 2, my + (ty - my) * 0.1), (mx + (tx - mx) * 0.4 - 2, my + (ty - my) * 0.4)],
               R[-2])


# ---------------------------------------------------------------- 1. écuyer

def squire():
    p = Pic('#5aa8ff')
    hc = (128, 52)
    # cape bleue derrière
    cape = poly(bez((104, 84), (82, 150), (70, 224)) + [(96, 230), (122, 226), (140, 214), (146, 160), (142, 88)])
    p.paint(cape, BLUE, con=0.9, bias=-0.12, lin=0.6)
    for x0, x1 in ((96, 80), (110, 100), (124, 122)):
        p.fold(bez((x0 + 8, 100), (x0, 160), (x1, 222)), BLUE[1], BLUE[3])
    # plumet
    pl = poly(bez((122, 30), (96, 22), (76, 46)) + bez((76, 46), (72, 66), (80, 92)) + bez((80, 92), (86, 64), (104, 44))
              + [(124, 40)])
    p.paint(pl, BLUE, con=1.0, lin=0.5)
    for k in range(5):
        p.fold(bez((118 - k * 3, 32 + k), (92 - k * 2, 34 + k * 4), (80 + k, 70 + k * 4)), BLUE[2], BLUE[5])
    # bras arrière (acier)
    p.paint(tube([(108, 94), (100, 122), (102, 144)], [8, 6.5, 6]), STEEL, bias=-0.14, con=1.3)
    hand(p, (103, 148), LEATHER, 6, knuckle_dir=-1)
    # jambes (arrière plus sombre)
    for hip, knee, ank, toe, dk in (((116, 150), (110, 194), (106, 228), 120, -0.14),
                                    ((138, 150), (146, 194), (152, 228), 168, 0.0)):
        p.paint(tube([hip, knee, ank], [11, 8, 6.5]), STEEL, bias=dk, con=1.3)
        boot(p, ank, toe, 220, STEEL, w=8)
        p.paint(poly([(ank[0] - 9, 216), (ank[0] + 8, 216), (ank[0] + 9, 222), (ank[0] - 9, 222)]), LEATHER, bias=dk)
        for yy in range(knee[1] + 10, 214, 6):  # lames de la grève
            u = (yy - knee[1]) / (ank[1] - knee[1])
            xc = knee[0] + (ank[0] - knee[0]) * u
            p.fold([(xc - 6, yy), (xc + 6, yy + 1)], STEEL[1], STEEL[5])
        km = ell(knee[0] + 2, knee[1], 9, 7.5)
        p.paint(km, STEEL, bias=dk + 0.08, con=1.4)
        p.paint(ell(knee[0] + 3, knee[1] + 1, 3, 2.5), BLUE, bias=dk)
        p.px(knee[0] - 2, knee[1] - 4, STEEL[6])
    # tassettes (jupe d'acier)
    sk = poly([(108, 126), (148, 126), (158, 164), (100, 164)])
    p.paint(sk, STEEL, lin=0.7, con=1.3)
    for yy in (140, 152):
        p.fold([(102, yy), (156, yy)], STEEL[1], STEEL[5])
    # buste en V
    torso = poly([(106, 88), (114, 82), (142, 82), (150, 88), (157, 104), (149, 128), (109, 128), (101, 106)])
    p.paint(torso, STEEL, con=1.4, lin=0.6)
    p.fold(bez((123, 86), (118, 108), (121, 126)), STEEL[2], STEEL[5])  # arête du plastron
    p.fold(bez((106, 108), (114, 116), (122, 114)), STEEL[2], STEEL[5])
    for (x, y) in ((108, 96), (108, 120), (114, 124)):
        p.px(x, y, STEEL[6]); p.px(x + 1, y + 1, STEEL[1])
    # tabard bleu (devant, décalé à droite en 3/4)
    tb = poly([(126, 92), (148, 92), (150, 128), (155, 190), (127, 194), (124, 128)])
    p.paint(tb, BLUE, con=0.9, lin=0.5)
    p.line([(126, 92), (124, 128), (127, 194)], GOLD[3])
    p.line([(148, 92), (150, 128), (155, 190)], GOLD[2])
    p.line([(127, 194), (155, 190)], GOLD[2])
    p.line([(127, 192), (154, 188)], BLUE[1])
    for xx in (133, 143):
        p.fold([(xx, 140), (xx + 2, 190)], BLUE[1], BLUE[4])
    # blason : losange d'or, gemme bleue
    bx, by = 137, 110
    for i in range(7):
        p.line([(bx - i, by - 6 + i), (bx + i, by - 6 + i)], GOLD[4] if i < 3 else GOLD[3])
        p.line([(bx - i, by + 6 - i), (bx + i, by + 6 - i)], GOLD[2])
    p.fill(ell(bx, by, 2.5, 2.5), BLUE[3])
    p.px(bx - 1, by - 1, '#b0dcff'); p.px(bx + 1, by + 1, BLUE[1])
    # ceinture
    belt = poly([(106, 124), (152, 122), (152, 130), (106, 132)])
    p.paint(belt, LEATHER, con=0.8)
    p.line([(106, 125), (152, 123)], LEATHER[5])
    buckle(p, 134, 120, 10, 12, LEATHER[1])
    # cou + tête
    p.paint(poly([(120, 64), (137, 64), (138, 86), (119, 86)]), SKIN, bias=-0.22, lit_edge=False)
    p.paint(ell(128, 84, 14, 5), STEEL, con=1.3)  # gorgerin
    face = head_base(p, hc)
    # mèches brunes sous le casque
    hair = poly([(108, 38), (150, 36), (151, 46), (148, 44), (147, 50), (144, 45), (141, 52), (137, 45), (133, 51),
                 (130, 45), (126, 50), (122, 45), (116, 54), (110, 52)])
    p.paint(hair, BROWN_HAIR, con=1.1, lin=0.6, bias=0.05)
    for x0 in (124, 132, 140, 147):
        p.line([(x0 + 2, 40), (x0, 47)], BROWN_HAIR[2])
        p.line([(x0 - 1, 40), (x0 - 2, 44)], BROWN_HAIR[5])
    cast_shadow(p, hair, face, SKIN[3], depth=2)
    # yeux, bouche
    eye(p, 130, 52, 7, EYE_BLUE, near=True, brow=BROWN_HAIR[1], brow_dy=-4, brow_tilt=-1)
    eye(p, 143, 52, 4, EYE_BLUE, near=False, brow=BROWN_HAIR[1], brow_dy=-4, brow_tilt=1)
    mouth(p, 138, 66, 'smile', '#8a2a3a', SKIN[3])
    # casque : calotte + couvre-nuque + garde-joue
    helm = ell(127, 44, 21, 18) & (YY < 45)
    helm |= poly([(106, 40), (122, 42), (124, 60), (120, 74), (110, 72), (106, 58)])
    p.paint(helm, STEEL, con=1.25, lin=0.5)
    band = poly([(106, 40), (149, 40), (150, 45), (106, 45)])
    p.paint(band, GOLD, con=1.0, clip=True)
    p.line([(108, 41), (148, 41)], GOLD[4], clip=True)
    for (x, y) in ((112, 52), (112, 60), (116, 67), (110, 32), (124, 28)):
        p.px(x, y, STEEL[6]); p.px(x + 1, y + 1, STEEL[1])
    p.fold(bez((126, 26), (126, 34), (128, 40)), STEEL[2], STEEL[6])  # crête
    p.px(116, 30, STEEL[6]); p.px(117, 29, STEEL[6]); p.px(115, 31, STEEL[5])
    # épée longue à lame bleue (devant)
    gx, gy = 168, 124
    bm = poly([(gx - 4, gy - 2), (gx + 4, gy - 2), (gx + 6 - 1, 34), (gx + 3, 24), (gx - 0.5, 34)])
    p.paint(bm, ['#1c2c70', '#2c5cc0', '#4f8ef0', '#86c0ff', '#c4e8ff', '#ffffff'], con=1.0, lin=0.8, flat=2.5,
            edge='#16205a')
    p.line([(gx, gy - 6), (gx + 2.5, 36)], '#ffffff')  # gouttière / fil
    p.line([(gx + 1, gy - 6), (gx + 3.5, 36)], '#4f8ef0')
    p.paint(poly([(gx - 15, gy - 3), (gx + 15, gy - 5), (gx + 16, gy + 1), (gx - 15, gy + 3)]), GOLD, con=1.2)
    p.paint(ell(gx, gy - 1, 4, 4), GOLD)
    p.px(gx - 1, gy - 2, '#8ad0ff'); p.px(gx, gy - 2, '#2f6ee0'); p.px(gx - 1, gy - 1, '#2f6ee0')
    p.paint(capsule((gx, gy + 3), (gx - 1, gy + 26), 3), LEATHER)
    for yy in range(gy + 6, gy + 24, 3):
        p.line([(gx - 3, yy), (gx + 2, yy + 1)], LEATHER[1])
    p.paint(ell(gx - 1, gy + 29, 4.5, 4), GOLD)
    # bras avant
    p.paint(tube([(146, 94), (156, 116), (166, 128)], [8, 6.5, 6]), STEEL, con=1.1)
    p.paint(ell(157, 117, 5.5, 5), STEEL, con=1.2)  # coude
    hand(p, (168, 132), LEATHER, 6.5)
    p.paint(capsule((162, 128), (165, 124), 5.5), LEATHER, con=0.9)  # manchette
    # épaulière avant (bord bleu)
    sp = ell(146, 92, 13, 10) & (YY < 100)
    p.paint(sp, STEEL, con=1.3)
    for k, yy in enumerate((97, 99)):
        p.line([(134 + k, yy), (158 - k, yy)], BLUE[3] if k == 0 else BLUE[1], clip=True)
    p.px(141, 87, STEEL[6]); p.px(142, 86, STEEL[6]); p.px(150, 92, STEEL[1])
    # éclat bleu
    sparkle(p, gx + 4, 21, 4, ('#ffffff', '#b0e0ff', '#4fb0ff'))
    sparkle(p, gx + 14, 54, 2, ('#ffffff', '#8fd0ff', '#3f80f0'))
    p.finish()
    return p



# ---------------------------------------------------------------- 2. mercenaire

def mercenary():
    p = Pic('#ff5a4a')
    hc = (128, 52)
    # pans de l'écharpe rouge flottant derrière
    for pts, dk in (([(118, 80), (96, 84), (76, 80), (60, 88), (70, 92), (62, 104), (82, 98), (100, 96), (120, 90)], -0.1),
                    ([(118, 84), (100, 94), (86, 108), (74, 126), (90, 122), (102, 108), (122, 92)], -0.2)):
        m = poly(pts)
        p.paint(m, RED, bias=dk, con=1.0)
    p.fold(bez((112, 86), (90, 88), (68, 96)), RED[1], RED[4])
    p.fold(bez((114, 90), (98, 100), (84, 118)), RED[1], RED[4])
    for x, y in ((62, 104), (65, 103), (74, 126), (77, 125)):
        p.line([(x, y), (x - 3, y + 4)], RED[3], clip=False)
    # bras arrière : poing sur la hanche
    p.paint(tube([(108, 94), (94, 114), (104, 130)], [8, 6.5, 6]), LEATHER, bias=-0.12)
    p.paint(capsule((96, 116), (103, 127), 6.5), DLEATHER, bias=-0.1)  # brassard
    hand(p, (106, 132), LEATHER, 6, knuckle_dir=1)
    legs(p, DLEATHER, LEATHER, top=212, cuff=LEATHER)
    # basque de cuir
    sk = poly([(108, 126), (150, 126), (156, 160), (102, 162)])
    p.paint(sk, LEATHER, con=1.0, lin=0.6)
    for xx in (118, 130, 142):
        p.line([(xx, 132), (xx + (xx - 129) * 0.15, 161)], LEATHER[1])
    p.line([(102, 161), (156, 159)], LEATHER[0])
    for xx in range(106, 154, 4):
        p.px(xx, 158, LEATHER[5])
    # buste (pourpoint de cuir)
    torso = poly([(106, 88), (114, 82), (142, 82), (150, 88), (157, 104), (149, 128), (109, 128), (101, 106)])
    p.paint(torso, LEATHER, con=1.1, lin=0.6)
    p.fold(bez((126, 90), (124, 108), (126, 124)), LEATHER[2], LEATHER[4])
    for y in range(94, 124, 6):  # coutures matelassées
        for x in range(108, 150, 3):
            if torso[y, x] and (x // 3 + y // 6) % 2 == 0:
                p.px(x, y, LEATHER[2])
    # baudrier
    bd = poly([(110, 86), (118, 84), (152, 122), (146, 128)])
    p.paint(bd, DLEATHER, con=0.8, clip=True)
    p.line([(114, 85), (150, 124)], DLEATHER[4], clip=True)
    for t in (0.3, 0.6):
        x, y = 114 + 36 * t, 85 + 39 * t
        p.paint(ell(x + 1, y, 2.5, 2.5), STEEL, clip=True)
    # ceinture
    p.paint(poly([(106, 124), (152, 122), (152, 130), (106, 132)]), DLEATHER, con=0.8)
    p.line([(106, 125), (152, 123)], DLEATHER[4])
    buckle(p, 132, 120, 10, 12, DLEATHER[1])
    p.paint(poly([(112, 130), (120, 130), (119, 146), (111, 146)]), DLEATHER, con=0.8)  # bourse
    p.line([(111, 134), (120, 134)], DLEATHER[0])
    p.px(115, 136, GOLD[3])
    # bras avant (haut) + épaulière en lames de cuir
    p.paint(capsule((146, 94), (160, 118), 8, 6.5), LEATHER, con=1.1)
    for k, (y0, rx) in enumerate(((86, 13), (92, 12), (98, 10))):
        m = ell(146, y0 + 4, rx, 7) & (YY < y0 + 7)
        p.paint(m, LEATHER, con=1.2, bias=0.06 - k * 0.04)
        p.line([(146 - rx + 2, y0 + 6), (146 + rx - 2, y0 + 6)], LEATHER[1], clip=True)
    for x in (139, 146, 153):
        p.px(x, 88, STEEL[5]); p.px(x + 1, 89, STEEL[1])
    # cou, écharpe
    p.paint(poly([(120, 64), (137, 64), (138, 86), (119, 86)]), SKIN, bias=-0.22, lit_edge=False)
    sc = ell(128, 80, 17, 8) | poly([(112, 78), (146, 74), (148, 86), (112, 88)])
    p.paint(sc, RED, con=1.0, lin=0.6)
    p.fold(bez((114, 80), (128, 86), (146, 78)), RED[1], RED[4])
    p.fold(bez((116, 84), (130, 89), (144, 85)), RED[1], RED[5])
    # épée large posée sur l'épaule (passe derrière la tête)
    dx, dy = -0.867, -0.498
    hx_, hy_ = 160, 102
    gx, gy = hx_ + 10 * dx, hy_ + 10 * dy
    tx, ty = gx + 96 * dx, gy + 96 * dy
    nx, ny = -dy, dx
    w = 5.5
    bl = poly([(gx + nx * w, gy + ny * w), (tx + 9 * -dx + nx * w, ty + 9 * -dy + ny * w), (tx, ty),
               (tx + 9 * -dx - nx * w, ty + 9 * -dy - ny * w), (gx - nx * w, gy - ny * w)])
    p.paint(bl, STEEL, con=1.6, lin=1.0, flat=2.5)
    p.line([(gx + nx * (w - 1.5), gy + ny * (w - 1.5)), (tx + 8 * -dx + nx * (w - 1.5), ty + 8 * -dy + ny * (w - 1.5))],
           STEEL[6])  # fil
    p.line([(gx, gy), (tx + 20 * -dx, ty + 20 * -dy)], STEEL[2])  # gouttière
    p.line([(gx + nx, gy + ny), (tx + 20 * -dx + nx, ty + 20 * -dy + ny)], STEEL[4])
    for k in (30, 64):  # encoches
        x, y = gx + k * dx - nx * w, gy + k * dy - ny * w
        p.px(x, y, STEEL[1]); p.px(x + dx, y + dy, STEEL[1])
    # tête
    face = head_base(p, hc)
    eye(p, 130, 53, 7, EYE_AMBER, near=True, brow=BROWN_HAIR[1], brow_dy=-4, brow_tilt=2)
    eye(p, 143, 53, 4, EYE_AMBER, near=False, brow=BROWN_HAIR[1], brow_dy=-4, brow_tilt=-2)
    mouth(p, 137, 66, 'smirk', '#7a2030', SKIN[3])
    p.line([(124, 62), (127, 64)], SKIN[2])  # cicatrice
    p.px(125, 63, SKIN[5])
    # cheveux en pointes
    base = (ell(124, 38, 22, 17) & (YY < 46)) | poly([(104, 34), (120, 36), (118, 50), (115, 62), (104, 60)])
    tips = [(104, 32, 118, 24, 94, 15, 0.15), (116, 24, 130, 22, 117, 10, 0.15), (128, 22, 142, 26, 140, 11, 0.1),
            (138, 26, 150, 34, 160, 18, 0.1), (146, 34, 152, 42, 166, 34, 0.1), (104, 34, 104, 48, 86, 36),
            (104, 46, 108, 60, 88, 62, -0.1), (108, 56, 116, 64, 102, 76, -0.1),
            (120, 40, 132, 40, 125, 54, -0.15), (129, 40, 140, 40, 137, 53, -0.15), (137, 38, 148, 40, 148, 50, -0.2)]
    hair = spikes_mask(base, tips) & ~ell(121, 55, 4, 6)
    p.paint(hair, BROWN_HAIR, con=1.1, lin=0.7)
    strands(p, tips, BROWN_HAIR)
    cast_shadow(p, hair, face, SKIN[3], depth=2)
    # avant-bras + main sur la poignée
    p.paint(capsule((160, 118), (160, 106), 6.5), DLEATHER, con=1.0)  # brassard
    p.line([(155, 112), (165, 112)], DLEATHER[0])
    p.paint(capsule((hx_ - 2 * dx, hy_ - 2 * dy), (hx_ - 9 * dx, hy_ - 9 * dy), 3), DLEATHER)
    p.paint(ell(hx_ - 12 * dx, hy_ - 12 * dy, 4, 4), GOLD)
    p.px(hx_ - 12 * dx - 1, hy_ - 12 * dy - 1, GOLD[5])
    hand(p, (hx_, hy_), LEATHER, 6)
    p.paint(capsule((gx + nx * 12, gy + ny * 12), (gx - nx * 12, gy - ny * 12), 2.4), GOLD, con=1.2)
    p.paint(ell(gx + nx * 13, gy + ny * 13, 3, 3), GOLD)
    p.paint(ell(gx - nx * 13, gy - ny * 13, 3, 3), GOLD)
    p.paint(ell(gx, gy, 3.5, 3.5), GOLD)
    p.px(gx, gy, RED[4]); p.px(gx - 1, gy - 1, RED[6])
    sparkle(p, tx + 6, ty - 2, 3, ('#ffffff', '#ffd8c8', '#ff7a5a'))
    p.finish()
    return p



# ---------------------------------------------------------------- outils d'armes / effets

def flame(p, x, y, r, h, sway=0.0, cols=('#a8200e', '#ff5a1e', '#ffa030', '#ffe070', '#fffbe0'), side=True):
    """Flamme en couches (effet, sans contour noir)."""
    def tongue(cx, cy, rr, hh, sw):
        return (poly(bez((cx - rr, cy), (cx - rr * 1.3, cy - hh * 0.55), (cx + sw, cy - hh), 12)
                     + bez((cx + sw, cy - hh), (cx + rr * 1.2, cy - hh * 0.45), (cx + rr, cy), 12))
                | ell(cx, cy, rr, rr * 0.85))
    layers = [(1.0, 1.0), (0.78, 0.8), (0.56, 0.58), (0.36, 0.36), (0.18, 0.16)]
    for i, ((kr, kh), col) in enumerate(zip(layers, cols)):
        m = tongue(x, y + (i * r * 0.12), r * kr, h * kh, sway * kh)
        if side and i == 0:
            m |= tongue(x - r * 0.7, y + r * 0.2, r * 0.45, h * 0.55, sway * 0.4 - 3)
            m |= tongue(x + r * 0.7, y + r * 0.2, r * 0.45, h * 0.5, sway * 0.4 + 3)
        if side and i == 1:
            m |= tongue(x - r * 0.55, y + r * 0.2, r * 0.3, h * 0.38, sway * 0.4 - 2)
        p.fx(m, col)


def bow(p, gx, gy, top, bot, bulge, R, wrap):
    """Arc long : branches courbes (poignée la plus à droite), pointes recourbées, corde."""
    half = (bot - top) / 2
    cy = (top + bot) / 2
    pts, rad = [], []
    for i in range(41):
        u = -1 + i / 20
        y = cy + u * half
        x = gx - bulge * u * u + 4 * max(0.0, abs(u) - 0.86) / 0.14
        pts.append((x, y))
        rad.append(2.6 - 1.4 * abs(u))
    m = tube(pts, rad)
    p.paint(m, R, con=1.2, lin=0.3, flat=1.5)
    for i in range(0, 41, 3):  # veinage
        x, y = pts[i]
        p.px(x - 0.5, y, R[1], clip=True)
    gm = poly([(gx - 4, gy - 8), (gx + 3, gy - 8), (gx + 3, gy + 8), (gx - 4, gy + 8)])
    p.paint(gm & dilate(dilate(m)), wrap, con=0.9)
    for yy in range(int(gy - 7), int(gy + 8), 2):
        p.line([(gx - 3, yy), (gx + 2, yy + 1)], wrap[1])
    return pts


def staff(p, x0, y0, x1, y1, R, r=2.6):
    m = capsule((x0, y0), (x1, y1), r)
    p.paint(m, R, con=1.2, flat=1.2)
    return m


# ---------------------------------------------------------------- 3. rôdeur

def ranger():
    p = Pic('#5ad46a')
    hc = (128, 54)
    # carquois dans le dos (flèches à empennage vert)
    for i, (ax, ay) in enumerate(((110, 64), (116, 62), (104, 68))):
        p.paint(capsule((ax, ay), (ax - 6, ay + 20), 1.2), WOOD)
        fm = poly([(ax - 3, ay + 4), (ax, ay - 8), (ax + 3, ay + 4)])
        p.paint(fm, GREEN, con=1.1, bias=0.05 - i * 0.08)
        p.line([(ax, ay - 6), (ax, ay + 3)], GREEN[1])
    q = poly([(100, 82), (114, 76), (124, 136), (110, 142)])
    p.paint(q, LEATHER, con=1.0, lin=0.7)
    for t in (0.15, 0.85):
        p.line([(100 + 14 * t + 0, 82 - 6 * t + 0), (110 + 14 * t, 142 - 6 * t)], LEATHER[1])
    p.paint(poly([(98, 80), (115, 73), (117, 80), (100, 87)]), DLEATHER, con=0.8)
    # cape verte
    cape = poly(bez((106, 84), (84, 150), (78, 212)) + [(98, 216), (118, 212), (132, 200), (140, 150), (140, 90)])
    p.paint(cape, GREEN, con=0.9, bias=-0.14, lin=0.6)
    for x0, x1 in ((98, 86), (112, 104)):
        p.fold(bez((x0 + 6, 100), (x0 - 2, 160), (x1, 210)), GREEN[1], GREEN[3])
    # bras arrière
    p.paint(tube([(108, 94), (100, 122), (102, 144)], [7.5, 6, 5.5]), GREEN, bias=-0.12)
    p.paint(capsule((100, 124), (102, 140), 6), LEATHER, bias=-0.1)
    hand(p, (103, 147), LEATHER, 5.5, knuckle_dir=-1)
    legs(p, MOSS, LEATHER, top=198, cuff=LEATHER, radii=(10.5, 7.5, 6))
    # tunique de cuir à pans
    sk = poly([(108, 124), (150, 124), (158, 170), (140, 164), (128, 172), (114, 164), (100, 170)])
    p.paint(sk, LEATHER, con=1.0, lin=0.6)
    for xx in (114, 128, 140):
        p.fold([(xx, 132), (xx + (xx - 126) * 0.1, 166)], LEATHER[1], LEATHER[4])
    torso = poly([(106, 88), (114, 82), (142, 82), (150, 88), (156, 104), (149, 128), (109, 128), (102, 106)])
    p.paint(torso, LEATHER, con=1.1, lin=0.6)
    for y in range(96, 122, 5):  # laçage
        p.line([(136, y), (140, y + 3)], LEATHER[1])
        p.line([(140, y), (136, y + 3)], LEATHER[5])
    p.line([(138, 92), (138, 124)], LEATHER[2])
    # ceinture de bois/cuir + bourse
    p.paint(poly([(106, 124), (152, 122), (152, 130), (106, 132)]), WOOD, con=0.8)
    p.line([(106, 125), (152, 123)], WOOD[4])
    buckle(p, 136, 120, 9, 11, WOOD[1])
    p.paint(ell(118, 138, 6, 7), DLEATHER, con=0.9)
    p.line([(113, 134), (123, 134)], DLEATHER[0])
    p.px(118, 136, GOLD[3])
    # bras avant (haut)
    p.paint(capsule((146, 94), (156, 116), 7.5, 6.5), GREEN, con=1.1)
    p.paint(poly([(122, 64), (136, 64), (137, 82), (121, 82)]), SKIN, bias=-0.22, lit_edge=False)
    # mantelet de la capuche
    man = poly([(104, 72), (150, 70), (157, 92), (150, 104), (130, 108), (106, 104), (98, 90)])
    p.paint(man, GREEN, con=1.0, lin=0.6)
    for xx in (114, 128, 142):
        p.fold(bez((xx, 76), (xx - 1, 92), (xx - 2, 104)), GREEN[2], GREEN[4])
    p.line([(106, 104), (130, 108), (150, 104)], GREEN[1])
    # tête
    face = head_base(p, hc)
    eye(p, 130, 55, 7, EYE_GREEN, near=True, brow=BROWN_HAIR[1], brow_dy=-4, brow_tilt=-1)
    eye(p, 143, 55, 4, EYE_GREEN, near=False, brow=BROWN_HAIR[1], brow_dy=-4, brow_tilt=1)
    mouth(p, 138, 68, 'firm', '#7a2a30', SKIN[3])
    hair = poly([(110, 36), (152, 36), (152, 48), (148, 46), (146, 52), (142, 46), (139, 53), (135, 46), (131, 52),
                 (127, 46), (123, 52), (118, 46), (114, 60), (108, 60)])
    p.paint(hair, BROWN_HAIR, con=1.1, lin=0.6)
    for x0 in (128, 136, 144):
        p.line([(x0 + 1, 40), (x0 - 1, 48)], BROWN_HAIR[2])
        p.line([(x0 - 2, 40), (x0 - 3, 45)], BROWN_HAIR[5])
    cast_shadow(p, hair, face, SKIN[3])
    # capuche à pointe
    hood = ell(125, 48, 25, 25) | poly(bez((112, 28), (84, 18), (58, 30)) + bez((58, 30), (82, 34), (104, 56)))
    hood |= poly([(102, 52), (118, 60), (122, 76), (104, 76)])
    opening = ell(140, 60, 15, 19) & (YY >= 36) & (XX >= 118)
    hood &= ~opening
    p.paint(hood, GREEN, con=1.1, lin=0.7)
    rim = hood & dilate(opening)
    p.fill(rim, GREEN[1])
    p.fill(dilate(rim) & hood & ~rim & (XX > 120), GREEN[2])
    p.fold(bez((104, 30), (84, 26), (66, 30)), GREEN[2], GREEN[5])
    p.fold(bez((118, 26), (108, 40), (110, 58)), GREEN[2], GREEN[5])
    p.fold(bez((132, 25), (122, 34), (120, 40)), GREEN[2], GREEN[5])
    cast_shadow(p, hood, face, SKIN[3], depth=2)
    # arc long tenu devant
    gx, gy = 166, 130
    pts = bow(p, gx, gy, 40, 220, 12, WOOD, GREEN)
    p.line([(pts[0][0] - 2, pts[0][1] + 2), (pts[-1][0] - 2, pts[-1][1] - 2)], '#e8e0c8', clip=False)
    for (x, y) in (pts[0], pts[-1]):
        p.paint(ell(x, y, 2.5, 2.5), GOLD)
    # avant-bras + main sur la poignée
    p.paint(capsule((156, 116), (162, 128), 6.5), LEATHER, con=1.0)  # brassard
    p.line([(155, 120), (162, 116)], LEATHER[1]); p.line([(157, 124), (164, 120)], LEATHER[1])
    hand(p, (gx - 1, gy), LEATHER, 6)
    sparkle(p, pts[0][0] + 6, pts[0][1] - 4, 2, ('#ffffff', '#c8ffb0', '#5ad46a'))
    p.finish()
    return p


# ---------------------------------------------------------------- 4. pyromancienne

def pyromancer():
    p = Pic('#ff8a3a')
    hc = (128, 58)
    # longue chevelure derrière
    hb = poly(bez((112, 42), (90, 70), (92, 150)) + [(104, 146), (112, 154), (122, 140)] + bez((122, 140), (126, 100), (128, 60)))
    p.paint(hb, FIRE_HAIR, con=1.0, lin=0.6, bias=-0.05)
    for k in range(4):
        p.fold(bez((112 + k * 4, 50), (96 + k * 5, 90), (98 + k * 6, 146 - k * 3)), FIRE_HAIR[2], FIRE_HAIR[5])
    # bras arrière : main sur la hanche
    p.paint(tube([(110, 94), (98, 116), (108, 132)], [7, 6, 5.5]), RED, bias=-0.12)
    p.paint(capsule((100, 120), (106, 130), 6.5), RED, bias=-0.05)
    p.paint(ell(105, 130, 5, 4), GOLD)
    hand(p, (110, 134), SKIN, 5, knuckle_dir=1)
    # bottines sous la robe
    for ank, toe in (((112, 234), 124), ((146, 234), 162)):
        boot(p, ank, toe, 226, DLEATHER, w=7)
    # robe évasée
    sk = poly([(110, 120), (148, 120)] + bez((148, 120), (166, 170), (180, 234)) + [(160, 240), (130, 238), (104, 240), (82, 234)]
              + bez((82, 234), (94, 170), (110, 120)))
    p.paint(sk, RED, con=1.0, lin=0.6)
    for x0, x1, dk in ((108, 92, 0), (120, 112, 1), (132, 134, 1), (142, 156, 1), (148, 170, 0)):
        p.fold(bez((x0 + 4, 130), (x0 + (x1 - x0) * 0.4, 180), (x1, 234)), RED[1], RED[4])
    hem = sk & ~shift_m(sk, 0, -6)
    p.fill(hem, RED[1])
    p.fill(sk & ~shift_m(sk, 0, -6) & shift_m(sk, 0, -6 + 2) & ~shift_m(sk, 0, -4), GOLD[2])
    p.fill(sk & shift_m(sk & ~shift_m(sk, 0, -6), 0, -1) & ~hem, GOLD[3])
    for x in range(86, 178, 6):  # flammes brodées sur l'ourlet
        for k in range(4):
            p.px(x + k * 0.5, 228 - k * 2, GOLD[3] if k < 3 else GOLD[4], clip=True)
    # cou + corsage
    p.paint(poly([(123, 68), (135, 68), (137, 90), (121, 90)]), SKIN, bias=-0.1, lit_edge=False)
    torso = poly([(108, 88), (116, 84), (122, 84), (129, 92), (136, 84), (140, 84), (148, 88), (152, 104), (146, 124),
                  (112, 124), (104, 106)])
    p.paint(torso, RED, con=1.1, lin=0.6)
    p.paint(poly([(104, 116), (152, 114), (151, 124), (105, 126)]), GOLD, con=0.9)
    p.line([(105, 117), (151, 115)], GOLD[4])
    p.paint(ell(134, 120, 5, 5), GOLD, con=1.2)
    p.fill(ell(134, 120, 2.5, 2.5), '#ff7a2a')
    p.px(133, 119, '#ffe070')
    for y in range(94, 112, 4):  # laçage doré
        p.line([(132, y), (137, y + 2)], GOLD[3])
    p.line([(122, 85), (129, 92), (136, 85)], GOLD[3])  # décolleté
    # tête
    face = head_base(p, hc, fem=True, ear=False)
    eye(p, 130, 58, 7, EYE_RED, near=True, brow=FIRE_HAIR[1], brow_dy=-5, brow_tilt=-1, lash=True)
    eye(p, 143, 58, 4, EYE_RED, near=False, brow=FIRE_HAIR[1], brow_dy=-5, brow_tilt=1, lash=True)
    mouth(p, 137, 71, 'smile', '#b02a3a', '#e86a6a')
    # frange + mèche côté visage
    fr = poly([(108, 40), (152, 40), (152, 52), (149, 50), (147, 56), (143, 49), (139, 55), (135, 48), (131, 54), (127, 47),
               (122, 52), (118, 46), (116, 62), (108, 64)])
    fr |= poly(bez((148, 46), (156, 64), (152, 90)) + [(146, 82), (148, 60)])
    fr |= poly([(104, 40), (124, 40), (122, 56), (118, 70), (110, 76), (104, 66)])
    p.paint(fr, FIRE_HAIR, con=1.1, lin=0.6)
    for x0 in (126, 134, 142):
        p.line([(x0 + 1, 44), (x0 - 1, 51)], FIRE_HAIR[2])
        p.line([(x0 - 2, 44), (x0 - 3, 48)], FIRE_HAIR[6])
    p.fold(bez((150, 52), (154, 66), (151, 84)), FIRE_HAIR[2], FIRE_HAIR[5])
    cast_shadow(p, fr, face, SKIN[3])
    # grand chapeau pointu (pointe pliée vers l'arrière)
    cone = poly([(106, 40), (112, 24), (106, 18), (92, 20), (76, 28), (86, 14), (104, 8), (122, 8), (132, 14), (142, 26),
                 (150, 40)])
    p.paint(cone, RED, con=1.1, lin=0.8)
    p.fold(bez((112, 24), (120, 18), (130, 14)), RED[1], RED[5])  # pli de la pointe
    p.fold(bez((122, 38), (124, 26), (126, 16)), RED[2], RED[5])
    band = cone & (YY >= 30) & (YY <= 37)
    p.paint(band, GOLD, con=1.0, lit_edge=False)
    p.line([(108, 31), (148, 31)], GOLD[4], clip=True)
    # boucle étoilée
    for dx_, dy_ in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)):
        p.px(128 + dx_, 34 + dy_, '#fffbe0' if (dx_, dy_) == (0, 0) else '#ffa030')
    brim = ell(127, 42, 38, 7)
    p.paint(brim, RED, con=1.0, lin=0.7, bias=-0.04)
    p.fill(brim & ~shift_m(brim, 0, -2), RED[1])
    p.line([(92, 41), (126, 37)], RED[5], clip=True)
    cast_shadow(p, brim, face | fr, SKIN[2], depth=3, dx=0)
    p.fill(shift_m(brim, 0, 3) & fr & ~brim, FIRE_HAIR[1])
    # bâton à orbe de feu
    sx = 166
    staff(p, sx, 238, sx + 2, 60, WOOD)
    for y in range(80, 230, 10):
        p.line([(sx - 2, y), (sx + 2, y + 2)], WOOD[1])
    claw = poly([(sx - 6, 50), (sx - 3, 62), (sx + 6, 62), (sx + 9, 50), (sx + 4, 58), (sx + 1, 58)])
    p.paint(claw, GOLD, con=1.2)
    p.paint(ell(sx + 1.5, 49, 6, 6), ['#7a1810', '#b8200e', '#ff5a1e', '#ff9a2a', '#ffd24a', '#fff6c8'], con=1.3)
    # bras avant (manche rouge, poignet doré)
    p.paint(tube([(144, 94), (154, 114), (162, 124)], [7.5, 6.5, 6.5]), RED, con=1.1)
    p.paint(ell(160, 122, 6, 6), GOLD, con=1.1)
    hand(p, (sx + 1, 128), SKIN, 5.5)
    p.paint(ell(144, 92, 9, 7) & (YY < 98), RED, con=1.2)  # épaule bouffante
    flame(p, sx + 1.5, 46, 7, 30, sway=-5)
    for (x, y, c) in ((150, 22, '#ffd24a'), (186, 34, '#ff9a2a'), (178, 12, '#ffe070'), (156, 8, '#ff9a2a')):
        p.fxpx(x, y, c)
        p.fxpx(x, y + 1, '#ff5a1e')
    p.finish()
    return p


# ---------------------------------------------------------------- 5. prêtresse

def priestess():
    p = Pic('#ffe680')
    hc = (128, 58)
    # voile long derrière
    vl = poly(bez((110, 44), (88, 90), (90, 164)) + [(104, 168), (122, 160), (128, 110), (130, 60)])
    p.paint(vl, NAVY, con=0.9, bias=-0.1, lin=0.6)
    p.fold(bez((106, 60), (94, 110), (98, 160)), NAVY[1], NAVY[4])
    p.fold(bez((116, 70), (108, 120), (112, 160)), NAVY[1], NAVY[4])
    # bras arrière (manche blanche)
    p.paint(tube([(110, 94), (102, 120), (104, 142)], [7, 7, 8]), CLOTH_W, bias=-0.15)
    # chaussures
    for ank, toe in (((112, 234), 124), ((146, 234), 162)):
        boot(p, ank, toe, 228, BLUE, w=7)
    # robe blanche
    sk = poly([(110, 120), (148, 120)] + bez((148, 120), (162, 170), (172, 236)) + [(150, 240), (104, 240), (86, 236)]
              + bez((86, 236), (96, 170), (110, 120)))
    p.paint(sk, CLOTH_W, con=1.0, lin=0.7)
    for x0, x1 in ((110, 96), (120, 112), (156, 166)):
        p.fold(bez((x0 + 4, 130), (x0 + (x1 - x0) * 0.4, 180), (x1, 234)), CLOTH_W[1], CLOTH_W[4])
    hem = sk & ~shift_m(sk, 0, -7)
    p.paint(hem, NAVY, con=0.8, lit_edge=False)
    p.fill(hem & ~shift_m(hem, 0, 1), GOLD[3])
    torso = poly([(108, 88), (116, 82), (140, 82), (148, 88), (152, 104), (146, 124), (112, 124), (104, 106)])
    p.paint(torso, CLOTH_W, con=1.1, lin=0.6)
    # étole bleue centrale à liseré d'or
    st = poly([(128, 80), (146, 80), (148, 124), (156, 234), (128, 236), (126, 124)])
    p.paint(st, NAVY, con=0.9, lin=0.5)
    p.line([(128, 80), (126, 124), (128, 236)], GOLD[3])
    p.line([(146, 80), (148, 124), (156, 234)], GOLD[2])
    p.fold([(137, 130), (140, 230)], NAVY[1], NAVY[4])
    for y in range(140, 230, 14):  # motifs dorés
        p.px(134 + (y - 140) * 0.03, y, GOLD[3]); p.px(146 + (y - 140) * 0.07, y + 7, GOLD[2])
    # étoile sacrée
    sx_, sy_ = 137, 100
    for i in range(6):
        p.line([(sx_ - i * 0.5, sy_ - 7 + i), (sx_ + i * 0.5, sy_ - 7 + i)], GOLD[4])
        p.line([(sx_ - i * 0.5, sy_ + 7 - i), (sx_ + i * 0.5, sy_ + 7 - i)], GOLD[2])
        p.line([(sx_ - 7 + i, sy_ - i * 0.5), (sx_ - 7 + i, sy_ + i * 0.5)], GOLD[3])
        p.line([(sx_ + 7 - i, sy_ - i * 0.5), (sx_ + 7 - i, sy_ + i * 0.5)], GOLD[2])
    p.fill(ell(sx_ + 0.5, sy_ + 0.5, 2, 2), '#3a8ef0')
    p.px(sx_, sy_, '#b0e8ff')
    # ceinture tressée dorée
    p.paint(poly([(106, 120), (150, 118), (150, 124), (106, 126)]), GOLD, con=0.9)
    for x in range(108, 150, 3):
        p.px(x, 121, GOLD[1]); p.px(x + 1, 123, GOLD[4])
    # guimpe blanche (cou et épaules) + tête
    gm = poly([(116, 70), (146, 70), (154, 86), (138, 94), (118, 92), (108, 84)])
    p.paint(gm, CLOTH_W, con=0.9, lin=0.6)
    p.fold(bez((118, 82), (132, 90), (148, 82)), CLOTH_W[2], CLOTH_W[5])
    face = head_base(p, hc, fem=True, ear=False)
    eye(p, 130, 58, 7, EYE_SKY, near=True, brow=BLONDE[2], brow_dy=-5, brow_tilt=0, lash=True)
    eye(p, 143, 58, 4, EYE_SKY, near=False, brow=BLONDE[2], brow_dy=-5, brow_tilt=0, lash=True)
    mouth(p, 137, 71, 'smile', '#b0404a', '#e88080')
    # voile : capuche bleue + bandeau blanc autour du visage
    hood = ell(124, 52, 24, 25) | poly([(102, 56), (120, 62), (120, 84), (104, 86)])
    ow = ell(139, 62, 18, 23) & (YY >= 32) & (XX >= 114)
    o = ell(142, 61, 12, 16) & (YY >= 40) & (XX >= 122)
    p.paint(hood & ~ow, NAVY, con=1.0, lin=0.7)
    p.fold(bez((112, 36), (104, 56), (108, 80)), NAVY[1], NAVY[5])
    p.fold(bez((124, 30), (116, 40), (116, 60)), NAVY[2], NAVY[5])
    wm = ((ow & ~o) & (hood | (YY > 60))) | (poly([(118, 74), (144, 76), (150, 88), (116, 90)]) & ~o)
    wm &= ~((XX > 145) & (YY < 77))
    p.paint(wm, CLOTH_W, con=0.9, lin=0.5, lit_edge=False, bias=0.12)
    cast_shadow(p, wm, face, SKIN[3], depth=1)
    fr = poly([(124, 46), (132, 43), (140, 43), (146, 46), (147, 51), (144, 49), (142, 54), (139, 49), (135, 53),
               (132, 48), (128, 52), (125, 50), (123, 56)])
    p.paint(fr, BLONDE, con=1.1, lin=0.6, bias=0.15)
    for x0 in (131, 138, 144):
        p.line([(x0, 45), (x0 - 1, 50)], BLONDE[2])
        p.line([(x0 - 2, 45), (x0 - 3, 48)], BLONDE[5])
    cast_shadow(p, fr, face & ~fr, SKIN[3])
    # auréole
    ring = ell(124, 22, 20, 6) & ~ell(124, 22, 16, 3.4)
    p.paint(ring, GOLD, con=1.2, rim=False)
    p.line([(110, 19), (118, 17)], GOLD[5])
    # bâton doré à étoile
    sx = 166
    staff(p, sx, 238, sx + 1, 44, GOLD)
    for y in (120, 140):
        p.paint(ell(sx + 0.5, y, 4, 2.5), GOLD, con=1.2)
    cm = poly([(sx - 2, 14), (sx + 3, 14), (sx + 3, 48), (sx - 2, 48)]) | poly([(sx - 12, 26), (sx + 13, 26), (sx + 13, 31),
                                                                                (sx - 12, 31)])
    cm |= ell(sx + 0.5, 28.5, 8, 8) & ~ell(sx + 0.5, 28.5, 5, 5)
    p.paint(cm, GOLD, con=1.3)
    p.paint(ell(sx + 0.5, 28.5, 4, 4), ['#10246a', '#1a3a98', '#2a62d0', '#3a8ef0', '#7ac0ff', '#d8f4ff'], con=1.4)
    p.px(sx - 1, 27, '#ffffff')
    for (x, y) in ((sx - 12, 28), (sx + 13, 28), (sx + 0.5, 14)):
        p.paint(ell(x, y, 2.5, 2.5), GOLD)
    # bras avant (manche large blanche, poignet doré)
    p.paint(tube([(144, 94), (154, 114), (160, 122)], [7.5, 7.5, 9]), CLOTH_W, con=1.1)
    p.paint(capsule((154, 120), (164, 126), 4), GOLD, con=1.0)
    hand(p, (sx + 1, 128), SKIN, 5.5)
    sparkle(p, sx + 18, 16, 3, ('#ffffff', '#fff3a8', '#ffd24a'))
    sparkle(p, sx - 16, 10, 2, ('#ffffff', '#fff3a8', '#ffd24a'))
    sparkle(p, 96, 30, 2, ('#ffffff', '#fff3a8', '#ffd24a'))
    p.finish()
    return p



# ---------------------------------------------------------------- 6. lancier

def lancer():
    p = Pic('#e84a5f')
    # cape rouge
    cape = poly(bez((106, 84), (78, 150), (64, 226)) + [(90, 232), (118, 226), (136, 214), (142, 160), (142, 88)])
    p.paint(cape, RED, con=0.9, bias=-0.12, lin=0.6)
    for x0, x1 in ((94, 76), (108, 96), (122, 116)):
        p.fold(bez((x0 + 8, 100), (x0, 160), (x1, 224)), RED[1], RED[4])
    p.fill(cape & ~shift_m(cape, 0, -3), RED[1])
    # panache rouge
    pl = poly(bez((126, 26), (96, 16), (74, 40)) + bez((74, 40), (66, 70), (72, 104)) + bez((72, 104), (84, 66), (104, 40))
              + [(126, 34)])
    p.paint(pl, RED, con=1.0, lin=0.5)
    for k in range(5):
        p.fold(bez((122 - k * 3, 28 + k), (90 - k * 2, 30 + k * 4), (76 + k, 72 + k * 5)), RED[2], RED[5])
    # bras arrière
    p.paint(tube([(108, 94), (100, 122), (102, 144)], [8, 6.5, 6]), DSTEEL, bias=-0.12, con=1.3)
    hand(p, (103, 148), DLEATHER, 6, knuckle_dir=-1)

    def knee(p, kn, d):
        p.paint(ell(kn[0] + 2, kn[1], 9, 7.5), DSTEEL, bias=d + 0.08, con=1.4)
        p.px(kn[0] + 3, kn[1], RED[4]); p.px(kn[0] + 2, kn[1], RED[2])
        p.px(kn[0] - 2, kn[1] - 4, DSTEEL[6])
    legs(p, DSTEEL, DSTEEL, top=216, knee=knee, con=1.3, folds=False)
    for (hip, kn, ank, toe) in (LEG_B, LEG_F):
        for yy in range(kn[1] + 10, 214, 6):
            u = (yy - kn[1]) / (ank[1] - kn[1])
            xc = kn[0] + (ank[0] - kn[0]) * u
            p.fold([(xc - 6, yy), (xc + 6, yy + 1)], DSTEEL[1], DSTEEL[4])
    # tassettes
    sk = poly([(108, 126), (148, 126), (158, 164), (100, 164)])
    p.paint(sk, DSTEEL, lin=0.7, con=1.3)
    for yy in (138, 150):
        p.fold([(102, yy), (156, yy)], DSTEEL[0], DSTEEL[4])
    p.fill(sk & ~shift_m(sk, 0, -2), RED[2])
    # cuirasse
    torso = poly([(106, 88), (114, 82), (142, 82), (150, 88), (157, 104), (149, 128), (109, 128), (101, 106)])
    p.paint(torso, DSTEEL, con=1.5, lin=0.6)
    p.fold(bez((126, 86), (121, 108), (124, 126)), DSTEEL[1], DSTEEL[5])
    p.fold(bez((106, 104), (118, 112), (130, 110)), DSTEEL[1], DSTEEL[4])
    for (x, y) in ((108, 94), (110, 120), (146, 96)):
        p.px(x, y, DSTEEL[6]); p.px(x + 1, y + 1, DSTEEL[0])
    # gravure dorée sur le plastron
    p.line(bez((130, 92), (138, 98), (136, 112)), GOLD[2])
    p.line(bez((131, 92), (139, 98), (137, 112)), GOLD[4])
    p.paint(poly([(106, 124), (152, 122), (152, 130), (106, 132)]), RED, con=0.8)
    p.line([(106, 125), (152, 123)], RED[5])
    buckle(p, 134, 120, 10, 12, RED[1])
    # gorgerin + heaume fermé
    p.paint(ell(128, 82, 15, 6), DSTEEL, con=1.3)
    helm = ell(127, 50, 21, 23) | poly([(108, 56), (150, 52), (154, 68), (144, 78), (116, 80), (108, 70)])
    p.paint(helm, HELM, con=1.5, lin=0.6)
    # arête frontale + fente de la visière
    p.fold(bez((136, 28), (146, 42), (148, 76)), HELM[2], HELM[6])
    slit = poly([(128, 50), (153, 48), (153, 53), (128, 55)])
    p.fill(slit, INK)
    p.line([(128, 49), (153, 47)], HELM[6])
    p.line([(128, 56), (153, 54)], HELM[1])
    for ex, w in ((134, 5), (147, 3)):  # regards ardents
        p.line([(ex, 51), (ex + w, 51)], '#ff7a3a')
        p.line([(ex + 1, 52), (ex + w - 1, 52)], '#ffe8a0')
        p.fxpx(ex + w + 1, 50, '#ffb070')
    for row, y in enumerate((60, 64, 68)):  # trous de respiration
        for x in range(136 + row, 152 - row, 3):
            p.px(x, y, INK, clip=True); p.px(x, y + 1, HELM[4], clip=True)
    p.paint(helm & (YY >= 40) & (YY <= 43), GOLD, con=1.0, lit_edge=False)
    p.line([(108, 40), (146, 38)], GOLD[4], clip=True)
    for (x, y) in ((112, 58), (114, 68), (118, 30)):
        p.px(x, y, HELM[6]); p.px(x + 1, y + 1, HELM[0])
    p.paint(ell(124, 27, 4, 3), GOLD)  # porte-panache
    # lance
    sx = 168
    staff(p, sx, 240, sx + 1, 44, WOOD, r=2.4)
    for y in range(70, 236, 12):
        p.line([(sx - 2, y), (sx + 2, y + 1)], WOOD[1])
    p.paint(capsule((sx + 0.5, 40), (sx + 0.5, 50), 3.5), GOLD, con=1.2)
    for y in (43, 47):
        p.line([(sx - 3, y), (sx + 4, y)], GOLD[1], clip=True)
    head_ = poly([(sx - 3, 40), (sx - 7, 30), (sx - 1, 16), (sx + 1, 12), (sx + 3, 16), (sx + 9, 30), (sx + 4, 40)])
    p.paint(head_, STEEL, con=1.5, flat=2.0)
    p.line([(sx + 0.5, 16), (sx + 0.5, 38)], STEEL[2])
    p.line([(sx - 0.5, 18), (sx - 0.5, 37)], STEEL[6])
    # glands rouges
    for i, (tx_, ty_) in enumerate(((sx - 12, 74), (sx - 7, 78), (sx - 16, 66))):
        m = poly(bez((sx - 2, 50), (sx - 4 - i * 2, 60), (tx_, ty_)) + [(tx_ + 4, ty_ - 1)] + bez((sx + 1, 52), (sx - i, 62),
                                                                                                   (tx_ + 4, ty_ - 1)))
        p.paint(m, RED, con=1.0, bias=0.05 - i * 0.08)
    # bras avant
    p.paint(tube([(146, 94), (156, 116), (164, 126)], [8, 6.5, 6]), DSTEEL, con=1.3)
    p.paint(ell(157, 117, 5.5, 5), DSTEEL, con=1.4)
    p.paint(capsule((160, 122), (164, 126), 6), RED, con=0.9)
    hand(p, (sx + 1, 130), DLEATHER, 6.5)
    # épalière à liseré rouge et gemme
    sp = ell(146, 92, 14, 11) & (YY < 101)
    p.paint(sp, DSTEEL, con=1.5)
    p.line([(133, 99), (159, 99)], RED[3], clip=True)
    p.line([(133, 100), (159, 100)], RED[1], clip=True)
    p.paint(ell(147, 91, 3, 3), RED, con=1.3)
    p.px(146, 90, RED[6])
    sparkle(p, sx + 6, 10, 2, ('#ffffff', '#ffc0c8', '#e84a5f'))
    p.finish()
    return p


# ---------------------------------------------------------------- 7. ombre

def dagger(p, hand_c, tip, R, glow, w=3.5):
    """Dague en prise inversée : lame violette lumineuse, garde dorée."""
    hx, hy = hand_c
    tx, ty = tip
    dx, dy = tx - hx, ty - hy
    ln = math.hypot(dx, dy)
    ux, uy = dx / ln, dy / ln
    nx, ny = -uy, ux
    bx, by = hx + ux * 7, hy + uy * 7
    m = poly([(bx + nx * w, by + ny * w), (tx - ux * 7 + nx * w * 0.9, ty - uy * 7 + ny * w * 0.9), (tx, ty),
              (tx - ux * 7 - nx * w * 0.6, ty - uy * 7 - ny * w * 0.6), (bx - nx * w, by - ny * w)])
    p.paint(m, R, con=1.3, flat=2.0)
    p.line([(bx + nx * (w - 1), by + ny * (w - 1)), (tx - ux * 3, ty - uy * 3)], glow)
    p.paint(capsule((hx + ux * 6 + nx * 6, hy + uy * 6 + ny * 6), (hx + ux * 6 - nx * 6, hy + uy * 6 - ny * 6), 1.8), GOLD)
    p.paint(ell(hx - ux * 7, hy - uy * 7, 3, 3), GOLD)


def shadow():
    p = Pic('#b46bff')
    hc = (128, 54)
    DG = ['#1e0a3a', '#43207a', '#7a40c8', '#a868ff', '#d6b0ff', '#ffffff']
    # longue écharpe violette flottante
    for pts, dk in (([(118, 76), (92, 72), (64, 62), (34, 64), (52, 72), (30, 82), (62, 80), (90, 84), (120, 86)], 0.0),
                    ([(118, 82), (96, 92), (70, 100), (44, 118), (62, 114), (52, 128), (78, 112), (100, 100), (122, 90)],
                     -0.14)):
        p.paint(poly(pts), PURPLE, bias=dk, con=1.0)
    p.fold(bez((114, 78), (80, 70), (44, 68)), PURPLE[1], PURPLE[4])
    p.fold(bez((114, 86), (88, 96), (58, 116)), PURPLE[1], PURPLE[4])
    # bras arrière + dague
    p.paint(tube([(108, 94), (98, 120), (100, 140)], [7.5, 6, 5.5]), SHADOWC, bias=-0.1, con=1.2)
    for y in range(122, 140, 3):
        p.line([(95, y), (104, y + 2)], SHADOWC[4])
    dagger(p, (100, 146), (92, 182), DG, '#f0d8ff')
    hand(p, (100, 145), SHADOWC, 5.5, knuckle_dir=-1)

    def knee(p, kn, d):
        for k in range(3):
            p.line([(kn[0] - 6, kn[1] + 6 + k * 4), (kn[0] + 7, kn[1] + 8 + k * 4)], SHADOWC[4 if d == 0 else 3])
    legs(p, SHADOWC, PURPLE, top=206, radii=(10, 7.5, 6), knee=knee, cuff=PURPLE, con=1.2)
    # tunique courte à pans
    sk = poly([(108, 124), (150, 124), (158, 162), (144, 156), (130, 166), (116, 156), (100, 162)])
    p.paint(sk, SHADOWC, con=1.1, lin=0.6)
    p.fold([(122, 130), (120, 158)], SHADOWC[1], SHADOWC[4])
    p.fold([(140, 130), (142, 156)], SHADOWC[1], SHADOWC[4])
    torso = poly([(106, 88), (114, 82), (142, 82), (150, 88), (156, 104), (148, 128), (110, 128), (102, 106)])
    p.paint(torso, SHADOWC, con=1.3, lin=0.6)
    p.fold(bez((124, 88), (120, 108), (124, 126)), SHADOWC[1], SHADOWC[5])
    # sangles croisées + ceinture
    for a, b in (((110, 86), (152, 124)), ((148, 88), (114, 126))):
        m = capsule(a, b, 2.5)
        p.paint(m & torso, PURPLE, con=0.8)
    p.paint(ell(131, 106, 4, 4), SILVER, con=1.3)
    for (x, y) in ((118, 96), (142, 116)):
        p.paint(poly([(x - 2, y - 3), (x + 2, y - 3), (x + 2, y + 3), (x - 2, y + 3)]), STEEL, clip=True)  # lames de jet
    p.paint(poly([(106, 124), (152, 122), (152, 130), (106, 132)]), PURPLE, con=0.8)
    p.line([(106, 125), (152, 123)], PURPLE[5])
    p.paint(ell(138, 126, 5, 5), SILVER, con=1.2)
    p.fill(ell(138, 126, 2, 2), PURPLE[4])
    # cou, tête
    p.paint(poly([(122, 64), (136, 64), (137, 86), (121, 86)]), SKIN, bias=-0.22, lit_edge=False)
    face = head_base(p, hc)
    eye(p, 130, 55, 7, EYE_VIOLET, near=True, brow=SILVER[0], brow_dy=-4, brow_tilt=3)
    eye(p, 143, 55, 4, EYE_VIOLET, near=False, brow=SILVER[0], brow_dy=-4, brow_tilt=-2)
    for i in range(7):  # paupière tombante : regard aiguisé
        p.px(130 + i, 56, INK if i > 1 else SKIN[2])
    # masque violet sur le bas du visage
    mk = (face | dilate(face)) & (YY >= 62)
    mk |= poly([(116, 60), (124, 60), (124, 86), (116, 86)])
    mk |= ell(128, 82, 16, 6)
    p.paint(mk, PURPLE, con=1.0, lin=0.5, bias=-0.05)
    p.line([(122, 63), (154, 61)], PURPLE[5])
    p.fold(bez((132, 70), (140, 74), (152, 70)), PURPLE[1], PURPLE[4])
    p.fold(bez((122, 74), (130, 80), (146, 78)), PURPLE[1], PURPLE[4])
    # cheveux argentés en pointes balayées vers l'arrière
    base = (ell(125, 40, 21, 15) & (YY < 46)) | poly([(104, 34), (120, 36), (118, 52), (116, 62), (104, 58)])
    tips = [(104, 30, 118, 24, 80, 18, 0.1), (112, 24, 130, 22, 92, 10, 0.1), (126, 22, 142, 26, 121, 10, 0.15),
            (138, 26, 150, 36, 152, 14, 0.1), (104, 36, 104, 48, 72, 40, 0.05), (104, 46, 106, 58, 76, 62, -0.05),
            (106, 56, 114, 62, 92, 74, -0.1),
            (120, 40, 134, 40, 128, 56, -0.1), (132, 40, 144, 40, 142, 52, -0.15), (142, 38, 150, 42, 152, 50, -0.2)]
    hair = spikes_mask(base, tips) & ~ell(121, 56, 4, 6)
    p.paint(hair, SILVER, con=1.1, lin=0.7)
    strands(p, tips, SILVER)
    cast_shadow(p, hair, face, SKIN[3], depth=2)
    # bras avant + dague inversée
    p.paint(tube([(146, 94), (156, 114), (162, 124)], [7.5, 6, 5.5]), SHADOWC, con=1.2)
    for y in range(110, 124, 3):
        p.line([(153, y), (162, y - 2)], SHADOWC[5])
    dagger(p, (164, 126), (176, 160), DG, '#f0d8ff')
    hand(p, (164, 125), SHADOWC, 5.5)
    p.paint(ell(146, 90, 11, 8) & (YY < 96), SHADOWC, con=1.3)
    p.line([(136, 94), (156, 94)], PURPLE[3], clip=True)
    sparkle(p, 178, 164, 3, ('#ffffff', '#e0c0ff', '#a868ff'))
    sparkle(p, 88, 186, 2, ('#ffffff', '#e0c0ff', '#a868ff'))
    for (x, y) in ((196, 120), (186, 98), (60, 160), (72, 190)):
        p.fxpx(x, y, '#a868ff'); p.fxpx(x, y - 1, '#5e2ea2')
    p.finish()
    return p


# ---------------------------------------------------------------- 8. nain guerrier

def dwarf():
    p = Pic('#ffa630')
    hc = (124, 98)
    # bras arrière
    p.paint(tube([(98, 122), (88, 150), (92, 172)], [11, 9, 8]), BRONZE, bias=-0.12, con=1.2)
    p.paint(capsule((88, 154), (91, 168), 8.5), LEATHER, bias=-0.1)
    hand(p, (92, 176), SKIN, 7, knuckle_dir=-1)
    legs_ = (((108, 186), (104, 210), (102, 228), 116), ((142, 186), (148, 210), (150, 228), 168))
    legs(p, BROWN_HAIR, LEATHER, top=212, radii=(13, 11, 9), legs=legs_, cuff=LEATHER, wb=11)
    # tassettes de bronze
    sk = poly([(96, 168), (156, 168), (164, 200), (90, 200)])
    p.paint(sk, DLEATHER, con=1.2, lin=0.7)
    for xx in (110, 126, 142):
        p.line([(xx, 176), (xx + (xx - 126) * 0.12, 200)], DLEATHER[1])
    p.fill(sk & ~shift_m(sk, 0, -3), BRONZE[3])
    for xx in range(98, 160, 8):
        p.px(xx, 196, GOLD[4]); p.px(xx + 1, 197, LEATHER[0])
    # cuirasse large
    torso = poly([(94, 120), (104, 112), (150, 112), (160, 120), (168, 140), (160, 172), (98, 172), (88, 142)])
    p.paint(torso, BRONZE, con=1.4, lin=0.6)
    for y in (132, 150):
        p.fold([(92, y), (164, y)], BRONZE[1], BRONZE[5])
        for x in range(96, 164, 7):
            if torso[y + 3, x]:
                p.px(x, y + 3, GOLD[4]); p.px(x + 1, y + 4, BRONZE[0])
    # ceinture et grande boucle
    p.paint(poly([(94, 164), (162, 162), (162, 174), (94, 176)]), LEATHER, con=0.8)
    p.line([(94, 165), (162, 163)], LEATHER[5])
    p.paint(poly([(122, 158), (146, 158), (146, 180), (122, 180)]), GOLD, con=1.3)
    p.paint(ell(134, 169, 6, 6), BRONZE, con=1.3)
    p.fill(ell(134, 169, 2.5, 2.5), '#ffa630')
    p.px(133, 168, '#fff0b0')
    # bras avant (haut) + épaulière
    p.paint(capsule((150, 124), (164, 144), 11, 9), BRONZE, con=1.2)
    sp = ell(154, 122, 13, 10) & (YY < 129)
    p.paint(sp, BRONZE, con=1.5)
    p.fold([(142, 127), (166, 127)], BRONZE[1], BRONZE[5])
    p.px(150, 116, BRONZE[6]); p.px(151, 115, BRONZE[6])
    # tête
    face = head_base(p, hc)
    p.paint(ell(146, 104, 5.5, 5), SKIN, con=1.0, bias=0.1)  # gros nez
    p.px(144, 102, SKIN[5]); p.px(148, 107, SKIN[2])
    eye(p, 126, 98, 6, EYE_BROWN, near=True, brow=GINGER[1], brow_dy=-4, brow_tilt=2)
    eye(p, 138, 98, 4, EYE_BROWN, near=False, brow=GINGER[1], brow_dy=-4, brow_tilt=-1)
    for x in range(124, 135):  # sourcils broussailleux
        p.px(x, 93 + (1 if x > 131 else 0), GINGER[3])
    # barbe rousse touffue en pointe, tresse
    bd = poly([(106, 98), (114, 108), (126, 112), (140, 110), (152, 106), (158, 110), (160, 126), (156, 146), (148, 160),
               (140, 168), (132, 160), (118, 150), (108, 132), (104, 112)])
    p.paint(bd, GINGER, con=1.1, lin=0.6)
    for i, x0 in enumerate(range(108, 160, 6)):
        top = 108 + abs(x0 - 134) * 0.1
        p.fold(bez((x0, top), (x0 + 2 + (x0 - 134) * 0.1, top + 24), (x0 + (134 - x0) * 0.3, top + 44)), GINGER[2],
               GINGER[5])
    p.paint(capsule((140, 164), (140, 184), 3.2, 2.5), GINGER, con=1.1)  # tresse
    for y in (168, 174, 180):
        p.line([(138, y), (142, y + 2)], GINGER[1])
    p.paint(ell(140, 186, 3.5, 3.5), GOLD, con=1.3)
    p.px(139, 185, GOLD[5])
    # moustache
    mu = poly([(128, 108), (140, 104), (150, 108), (158, 116), (152, 118), (144, 112), (136, 112), (126, 118), (120, 116)])
    p.paint(mu, GINGER, con=1.0, bias=0.12)
    p.line([(130, 109), (140, 106)], GINGER[6])
    # casque de bronze à cornes et nasal
    helm = (ell(124, 90, 23, 20) & (YY < 94)) | poly([(100, 88), (116, 88), (114, 108), (102, 106)])
    p.paint(helm, BRONZE, con=1.5, lin=0.6)
    rim = helm & (YY >= 86) & (YY <= 92)
    p.paint(rim, BRONZE, con=1.0, bias=0.12, lit_edge=False)
    for x in range(102, 148, 6):
        p.px(x, 89, GOLD[4]); p.px(x + 1, 90, BRONZE[0])
    p.fold(bez((124, 70), (132, 76), (136, 88)), BRONZE[2], BRONZE[6])
    nas = poly([(140, 86), (146, 86), (146, 104), (142, 104)])
    p.paint(nas, BRONZE, con=1.3)
    p.px(143, 88, BRONZE[6])
    cast_shadow(p, helm, face, SKIN[3], depth=2)
    # cornes ivoire
    for pts in (((104, 82), (84, 74), (80, 44), (98, 70), (110, 74)), ((138, 74), (150, 66), (158, 42), (156, 70), (146, 80))):
        a, b, c_, d_, e_ = pts
        hm = poly(bez(a, b, c_) + bez(c_, d_, e_))
        p.paint(hm, IVORY, con=1.2, lin=0.6)
        for k in range(3):
            u = 0.25 + k * 0.22
            x = a[0] + (c_[0] - a[0]) * u
            y = a[1] + (c_[1] - a[1]) * u
            p.line([(x - 3, y + 2), (x + 3, y - 1)], IVORY[2])
    # grande hache (manche + fer en croissant)
    sx = 172
    staff(p, sx, 240, sx + 1, 34, WOOD, r=3)
    for y in range(150, 236, 9):
        p.line([(sx - 3, y), (sx + 3, y + 2)], LEATHER[1])
    ax = poly(bez((sx + 2, 40), (sx + 14, 40), (sx + 22, 20)) + bez((sx + 22, 20), (sx + 34, 54), (sx + 22, 92))
              + bez((sx + 22, 92), (sx + 14, 74), (sx + 2, 74)))
    p.paint(ax, STEEL, con=1.5, lin=0.8, flat=1.8)
    edge = ax & ~shift_m(ax, -2, 0)
    p.fill(edge & (XX > sx + 18), STEEL[6])
    back = poly([(sx - 2, 44), (sx - 14, 40), (sx - 18, 56), (sx - 14, 72), (sx - 2, 68)])
    p.paint(back, STEEL, con=1.4)
    p.paint(poly([(sx - 4, 38), (sx + 6, 38), (sx + 6, 78), (sx - 4, 78)]), BRONZE, con=1.3)
    for y in (44, 58, 72):
        p.px(sx + 1, y, GOLD[4]); p.px(sx + 2, y + 1, BRONZE[0])
    p.paint(poly([(sx - 2, 28), (sx + 1, 20), (sx + 4, 28), (sx + 3, 38), (sx - 1, 38)]), STEEL, con=1.3)  # pique
    # rune gravée
    p.line([(sx + 16, 50), (sx + 16, 64)], GOLD[3]); p.line([(sx + 16, 54), (sx + 20, 50)], GOLD[3])
    p.line([(sx + 16, 58), (sx + 20, 62)], GOLD[3])
    # avant-bras + main sur le manche
    p.paint(capsule((163, 144), (169, 154), 8.5), LEATHER, con=1.0)
    p.line([(157, 148), (168, 142)], LEATHER[1]); p.line([(160, 152), (171, 146)], LEATHER[1])
    hand(p, (sx + 1, 158), SKIN, 7)
    sparkle(p, sx + 30, 30, 3, ('#ffffff', '#ffe0a0', '#ffa630'))
    p.finish()
    return p


# ---------------------------------------------------------------- assemblage

ALLIES = [('squire', squire), ('mercenary', mercenary), ('ranger', ranger), ('pyromancer', pyromancer),
          ('priestess', priestess), ('lancer', lancer), ('shadow', shadow), ('dwarf', dwarf)]


def preview(items, path):
    pad = 12
    cell_w = 256 * 2 + 40 * 4 + pad * 3
    cols = 2
    rows = (len(items) + cols - 1) // cols
    sheet = Image.new('RGBA', (cols * cell_w + pad, rows * (512 + pad) + pad), (30, 26, 44, 255))
    for i, (aid, img) in enumerate(items):
        x0 = pad + (i % cols) * cell_w
        y0 = pad + (i // cols) * (512 + pad)
        sheet.paste((44, 40, 64, 255), (x0, y0, x0 + 512, y0 + 512))
        big = img.resize((512, 512), Image.NEAREST)
        sheet.alpha_composite(big, (x0, y0))
        sp = os.path.join(ROOT, 'assets', 'sprites', f'ally_{aid}.png')
        if os.path.exists(sp):
            s = Image.open(sp).convert('RGBA')
            s = s.resize((s.width * 4, s.height * 4), Image.NEAREST)
            sheet.alpha_composite(s, (x0 + 512 + pad, y0 + 512 - s.height))
    sheet.save(path)


def main(only=None):
    os.makedirs(os.path.join(ROOT, 'assets', 'hd'), exist_ok=True)
    items = []
    for aid, fn in ALLIES:
        if only and aid not in only:
            continue
        img = fn().image()
        img.save(os.path.join(ROOT, 'assets', 'hd', f'ally_{aid}.png'))
        items.append((aid, img))
    preview(items, os.path.join(HERE, 'preview_hd_allies_r.png'))


if __name__ == '__main__':
    main(sys.argv[1:] or None)
