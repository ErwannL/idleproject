"""Illustrations HD (256×256, pixel art 1×) des compagnons SSR / SR — lot « allies_top ».

Sorties : assets/hd/ally_<id>.png (+ planche tools/art/preview_hd_allies_top.png).
Lancer : python3 tools/art/hd_allies_top.py [id ...]

Moteur autonome (numpy + Pillow) :
  - masques booléens 256×256 (ellipses, polygones, tubes à largeur variable, mèches) ;
  - ombrage « bombé » par carte de distance → normale → lumière haut-gauche, quantifié sur une rampe
    à décalage de teinte avec tramage Bayer ponctuel ;
  - trait intérieur teinté là où une pièce recouvre une autre, contour extérieur #1a1226,
    liseré de lumière (rim light) à droite, couleur d'accent du personnage ;
  - calques d'effets (arrière / avant) non contourés.
Personnages : vue 3/4 tournée vers la droite, pieds sur y≈244, lumière en haut à gauche.
"""
import math
import os
import random
import sys

import numpy as np
from PIL import Image, ImageDraw

N = 256
GROUND = 244
OUT = '#1a1226'
WHITE = '#ffffff'
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))

YY, XX = np.mgrid[0:N, 0:N].astype(float)
YY += 0.5
XX += 0.5
_B4 = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0
BAY = np.tile(_B4, (N // 4, N // 4))
CHECK = ((np.mgrid[0:N, 0:N][0] + np.mgrid[0:N, 0:N][1]) % 2 == 0)

# lumière : direction vers la source (haut-gauche, un peu vers l'avant)
_L = np.array([-0.58, -0.68, 0.45])
_L = _L / np.linalg.norm(_L)


# ================================================================ couleurs

def rgb(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], dtype=float)


def hexs(c):
    return '#%02x%02x%02x' % tuple(int(max(0, min(255, round(v)))) for v in c)


def mix(a, b, t):
    return hexs(rgb(a) * (1 - t) + rgb(b) * t)


def dk(R, k=1):
    """Rampe assombrie (pièces à l'arrière-plan)."""
    out = [mix(R[0], OUT, 0.35 * k)] + list(R[:-1])
    return [mix(c, '#2a1e4a', 0.12 * k) for c in out]


def lt(R):
    return list(R[1:]) + [mix(R[-1], WHITE, 0.6)]


def line_of(c):
    return mix(c, OUT, 0.55)


# ================================================================ masques

def empty():
    return np.zeros((N, N), bool)


def ell(cx, cy, rx, ry, rot=0.0):
    if rot:
        r = math.radians(rot)
        dx, dy = XX - cx, YY - cy
        u = dx * math.cos(r) + dy * math.sin(r)
        v = -dx * math.sin(r) + dy * math.cos(r)
        return (u / rx) ** 2 + (v / ry) ** 2 <= 1
    return ((XX - cx) / rx) ** 2 + ((YY - cy) / ry) ** 2 <= 1


def poly(pts):
    im = Image.new('L', (N, N), 0)
    ImageDraw.Draw(im).polygon([(float(x), float(y)) for x, y in pts], fill=255)
    return np.array(im) > 0


def spline(pts, step=0.5):
    """Catmull-Rom échantillonné tous les ~step px."""
    pts = [tuple(map(float, p)) for p in pts]
    if len(pts) == 2:
        (x0, y0), (x1, y1) = pts
        n = max(2, int(math.hypot(x1 - x0, y1 - y0) / step))
        return [(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n) for i in range(n + 1)]
    P = [pts[0]] + pts + [pts[-1]]
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        n = max(2, int(math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step))
        for k in range(n):
            t = k / n
            t2, t3 = t * t, t * t * t
            out.append(tuple(0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2
                                    + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3) for j in (0, 1)))
    out.append(pts[-1])
    return out


def _interp(ws, t):
    if not isinstance(ws, (list, tuple)):
        return ws
    if len(ws) == 1:
        return ws[0]
    f = t * (len(ws) - 1)
    i = min(int(f), len(ws) - 2)
    return ws[i] + (ws[i + 1] - ws[i]) * (f - i)


def tube(pts, ws, step=0.5):
    """Tube de largeur variable (ws : largeur constante ou liste répartie le long de la courbe)."""
    sp = spline(pts, step)
    L = [0.0]
    for a, b in zip(sp, sp[1:]):
        L.append(L[-1] + math.hypot(b[0] - a[0], b[1] - a[1]))
    tot = max(L[-1], 1e-6)
    m = empty()
    for (x, y), l in zip(sp, L):
        r = max(0.35, _interp(ws, l / tot) / 2)
        x0, x1 = max(0, int(x - r - 1)), min(N, int(x + r + 2))
        y0, y1 = max(0, int(y - r - 1)), min(N, int(y + r + 2))
        if x0 >= x1 or y0 >= y1:
            continue
        m[y0:y1, x0:x1] |= (XX[y0:y1, x0:x1] - x) ** 2 + (YY[y0:y1, x0:x1] - y) ** 2 <= r * r
    return m


def ring(cx, cy, rx, ry, th, rot=0.0):
    return ell(cx, cy, rx, ry, rot) & ~ell(cx, cy, rx - th, ry - th * ry / rx, rot)


def _sh(m, dx, dy):
    o = np.zeros_like(m)
    ys = slice(max(0, dy), N + min(0, dy))
    yd = slice(max(0, -dy), N + min(0, -dy))
    xs = slice(max(0, dx), N + min(0, dx))
    xd = slice(max(0, -dx), N + min(0, -dx))
    o[ys, xs] = m[yd, xd]
    return o


def erode(m, diag=False):
    e = m & _sh(m, 1, 0) & _sh(m, -1, 0) & _sh(m, 0, 1) & _sh(m, 0, -1)
    if diag:
        e &= _sh(m, 1, 1) & _sh(m, -1, -1) & _sh(m, 1, -1) & _sh(m, -1, 1)
    return e


def dilate(m, diag=False):
    e = m | _sh(m, 1, 0) | _sh(m, -1, 0) | _sh(m, 0, 1) | _sh(m, 0, -1)
    if diag:
        e |= _sh(m, 1, 1) | _sh(m, -1, -1) | _sh(m, 1, -1) | _sh(m, -1, 1)
    return e


def dist(m, cap=40):
    d = np.zeros((N, N), float)
    cur = m.copy()
    k = 0
    while cur.any() and k < cap:
        d += cur
        k += 1
        cur = erode(cur, diag=(k % 2 == 0))
    return d


def blur(a, r=1, n=2):
    for _ in range(n):
        b = np.pad(a, r, mode='edge')
        c = b.cumsum(0)
        c = np.vstack([c[2 * r:2 * r + 1] * 0 + c[2 * r], c[2 * r + 1:] - c[:-2 * r - 1]]) if False else None
        acc = np.zeros_like(a)
        for dy in range(-r, r + 1):
            for dx in range(-r, r + 1):
                acc += b[r + dy:r + dy + N, r + dx:r + dx + N]
        a = acc / (2 * r + 1) ** 2
    return a


def edge(m):
    return m & ~erode(m)


def thick_line(pts, w=1.0):
    return tube(pts, w, step=0.35)


def px_line(pts, step=0.35):
    """Trait d'1 pixel (sans épaississement)."""
    m = empty()
    for x, y in spline(pts, step):
        xi, yi = int(math.floor(x)), int(math.floor(y))
        if 0 <= xi < N and 0 <= yi < N:
            m[yi, xi] = True
    return m


# ================================================================ ombrage

def shade(m, R, rnd=6.0, k_n=1.0, k_p=0.28, bias=0.0, dith=0.3, tex=None, light=None, box=None):
    """Indices dans la rampe R pour chaque pixel du masque (tableau N×N d'indices, -1 hors masque)."""
    d = dist(m, cap=int(rnd) + 2)
    t = np.clip(d / rnd, 0, 1)
    h = rnd * np.sqrt(np.clip(1 - (1 - t) ** 2, 0, 1))
    h = blur(h, 1, 2 if rnd >= 4 else 1)
    gy, gx = np.gradient(h)
    nz = 1.0
    nrm = np.sqrt(gx * gx + gy * gy + nz * nz)
    Lx, Ly, Lz = _L if light is None else light
    lam = (-gx * Lx - gy * Ly + nz * Lz) / nrm
    ys, xs = np.nonzero(m)
    if len(xs) == 0:
        return np.full((N, N), -1)
    if box is None:
        x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    else:
        x0, y0, x1, y1 = box
    cx, cy = (x0 + x1) / 2 + 0.5, (y0 + y1) / 2 + 0.5
    rx, ry = max(2.0, (x1 - x0) / 2 + 1), max(2.0, (y1 - y0) / 2 + 1)
    pos = ((XX - cx) / rx * -0.6 + (YY - cy) / ry * -0.8)
    v = 0.52 + (lam - Lz) * k_n + pos * k_p + bias
    if tex is not None:
        v = v + tex
    n = len(R)
    idx = np.floor(v * n + (BAY - 0.5) * dith).astype(int)
    idx = np.clip(idx, 0, n - 1)
    idx[~m] = -1
    return idx


def strands(m, a=0.0, freq=0.9, amp=0.16, seed=0, along=None):
    """Texture de mèches : bandes ondulées orientées (angle a en degrés)."""
    r = math.radians(a)
    u = -(XX * math.sin(r)) + YY * math.cos(r)
    w = XX * math.cos(r) + YY * math.sin(r)
    rr = random.Random(seed)
    ph = rr.random() * 6
    return amp * np.sin(u * 0 + w * freq + np.sin(u * 0.08 + ph) * 2.0)


def noise(seed, amp=0.15, scale=1):
    rr = np.random.RandomState(seed)
    n = rr.rand(N // scale + 1, N // scale + 1)
    n = np.kron(n, np.ones((scale, scale)))[:N, :N]
    return (n - 0.5) * 2 * amp


# ================================================================ image

class Pic:
    def __init__(self, accent):
        self.col = np.zeros((N, N, 3), float)
        self.a = np.zeros((N, N), bool)
        self.rimok = np.zeros((N, N), bool)
        self.back = np.zeros((N, N, 4), float)
        self.front = np.zeros((N, N, 4), float)
        self.accent = accent

    # --- pièces opaques (contourées)
    def put_idx(self, m, idx, R, line='auto', rim=True):
        m = m & (idx >= 0) & (YY < GROUND + 1)  # rien sous la ligne de sol
        if not m.any():
            return m
        pal = np.array([rgb(c) for c in R])
        if line:
            b = edge(m)
            behind = dilate(self.a & ~m) & b
            lc = rgb(line_of(R[0]) if line == 'auto' else line)
        self.col[m] = pal[idx[m]]
        if line:
            self.col[behind] = lc
        self.a |= m
        self.rimok[m] = rim
        return m

    def fill(self, m, R, line='auto', rim=True, **kw):
        if isinstance(R, str):
            R = [R]
        if len(R) == 1:
            idx = np.where(m, 0, -1)
        else:
            idx = shade(m, R, **kw)
        return self.put_idx(m, idx, R, line, rim)

    def flat(self, m, c, line=None, rim=True):
        return self.fill(m, [c], line=line, rim=rim)

    def paint(self, m, c, only=True):
        """Peint sur les pixels déjà opaques (détails)."""
        if only:
            m = m & self.a
        self.col[m] = rgb(c)
        self.a |= m

    def pset(self, x, y, c):
        x, y = int(x), int(y)
        if 0 <= x < N and 0 <= y < N:
            self.col[y, x] = rgb(c)
            self.a[y, x] = True

    def get(self, x, y):
        return hexs(self.col[int(y), int(x)]) if self.a[int(y), int(x)] else None

    # --- effets
    def fx(self, m, c, layer='front', alpha=1.0):
        L = self.front if layer == 'front' else self.back
        L[m, :3] = rgb(c)
        L[m, 3] = alpha * 255

    def fxpx(self, x, y, c, layer='front'):
        x, y = int(x), int(y)
        if 0 <= x < N and 0 <= y < N:
            L = self.front if layer == 'front' else self.back
            L[y, x, :3] = rgb(c)
            L[y, x, 3] = 255

    def sparkle(self, x, y, cols, size=1, layer='front'):
        """Étincelle en croix (size 0 : point, 1 : croix, 2 : étoile à 4 branches longues)."""
        c0, c1 = cols[0], cols[1]
        self.fxpx(x, y, c0, layer)
        if size >= 1:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                self.fxpx(x + dx, y + dy, c1, layer)
        if size >= 2:
            c2 = cols[2] if len(cols) > 2 else c1
            for dx, dy in ((2, 0), (-2, 0), (0, 2), (0, -2)):
                self.fxpx(x + dx, y + dy, c2, layer)
            for dx, dy in ((0, 3), (0, -3)):
                self.fxpx(x + dx, y + dy, c2, layer)

    # --- finitions
    def finish(self, rim_strength=0.6):
        a = self.a
        right_empty = a & ~_sh(a, -1, 0)
        rim = right_empty & self.rimok
        acc = rgb(self.accent)
        self.col[rim] = self.col[rim] * (1 - rim_strength) + acc * rim_strength
        # second pixel du liseré, plus doux, sur les bords verticaux
        rl = _sh(rim, -1, 0)
        rim2 = a & rl & _sh(rl, 0, 1) & _sh(rl, 0, -1) & ~rim & self.rimok
        self.col[rim2] = self.col[rim2] * (1 - rim_strength * 0.35) + acc * rim_strength * 0.35
        # contour extérieur
        o = ~a & dilate(a)
        self.col[o] = rgb(OUT)
        a = a | o
        img = np.zeros((N, N, 4), float)
        img[:] = self.back
        img[a, :3] = self.col[a]
        img[a, 3] = 255
        fm = self.front[:, :, 3] > 0
        img[fm] = self.front[fm]
        return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8), 'RGBA')


# ================================================================ palettes communes

SKIN = ['#8e4446', '#c97a68', '#f0aa88', '#ffd2b0', '#ffebd6']
TAN = ['#6a3226', '#a8603e', '#d48e5e', '#f0b884', '#ffdcb0']
GOLD = ['#6e3414', '#b0661a', '#e0a432', '#ffd862', '#fff6c0']
SILVER = ['#2c3048', '#545c7c', '#8a96b4', '#c4cee2', '#f2f6fc']
STEEL = ['#2a2e44', '#4e5672', '#7c88a4', '#b4c0d4', '#eef2f8']
LEATHER = ['#2e160e', '#5a3018', '#8a5028', '#b87a40', '#e0aa6a']
WOOD = ['#34190e', '#5e3418', '#8e5628', '#bc8040', '#e4b270']
MOUTH = '#7a2234'
BLUSH = '#f5869a'


# ================================================================ visage et tête

def neck(p, hx, hy, skin=SKIN, w=11):
    m = tube([(hx + 3, hy + 18), (hx + 2, hy + 30), (hx + 1, hy + 38)], [w, w, w + 2])
    p.fill(m, skin, rnd=4, bias=-0.22, k_p=0.1)
    # ombre portée du menton
    sh = m & (YY < hy + 26 + (XX - hx) * 0.1)
    p.paint(sh & CHECK | (sh & (YY < hy + 24)), skin[1])


def eye(p, x, y, w, h, iris, far=False, lid=OUT, closed=False, white='#f6f2fa', fierce=False):
    """Œil anime, coin supérieur gauche (x, y). iris : [sombre, moyen, clair]. Regard vers la droite."""
    if closed:
        for i in range(-1, w + 1):
            p.pset(x + i, y + h // 2 + (1 if 0 <= i < w - 1 else 0), lid)
        return
    top = y + (2 if fierce else 0)
    # blanc (colonne côté intérieur/extérieur)
    for yy in range(top + 1, y + h):
        for xx in range(x, x + w):
            p.pset(xx, yy, white)
    ix0 = x + (2 if not far else 1)
    ix1 = x + w
    if far:
        ix1 = x + w - 1
    for yy in range(top + 1, y + h):
        for xx in range(ix0, ix1):
            t = (yy - y) / h
            c = iris[0] if t < 0.4 else (iris[1] if t < 0.78 else iris[2])
            if (xx == ix0 or xx == ix1 - 1) and t >= 0.4:
                c = iris[1] if t >= 0.78 else mix(iris[0], iris[1], 0.5)
            p.pset(xx, yy, c)
    # pupille
    pcx = (ix0 + ix1) // 2
    for yy in range(top + 2, y + h - 3):
        p.pset(pcx, yy, mix(iris[0], OUT, 0.7))
        if ix1 - ix0 >= 5:
            p.pset(pcx + 1, yy, mix(iris[0], OUT, 0.5))
    # reflets
    p.pset(ix0, top + 2, WHITE)
    p.pset(ix0 + 1, top + 2, WHITE)
    p.pset(ix0, top + 3, WHITE)
    if ix1 - ix0 >= 4:
        p.pset(ix0 + 1, top + 3, WHITE)
    p.pset(ix1 - 1, y + h - 2, mix(iris[2], WHITE, 0.7))
    # paupière supérieure épaisse (2 px) + cils
    for xx in range(x - 1, x + w + 1):
        p.pset(xx, top, lid)
    for xx in range(x, x + w):
        if xx < ix0 + 1 or xx >= ix1 - 1:
            p.pset(xx, top + 1, lid)
    if fierce:
        for xx in range(x - 1, x + w + 1):
            p.pset(xx, top - 1 + (1 if (xx < x + w // 2) == (not far) else 0), lid)
    if not far:
        p.pset(x - 2, top + 1, lid)
        p.pset(x - 2, top - 1, lid)
        p.pset(x - 1, top - 1, lid)
    else:
        p.pset(x + w + 1, top + 1, lid)
        p.pset(x + w, top - 1, lid)
    # paupière inférieure
    lw = mix(lid, '#c86a6a', 0.5)
    for xx in range(x + 1, x + w):
        p.pset(xx, y + h, lw)


def face(p, hx, hy, iris, skin=SKIN, mouth='smile', brow=None, brow_mode='calm', blush=True,
         ear='human', eye_h=11, lash=OUT, closed=False, fierce=False, jaw=1.0):
    """Visage 3/4 droite. (hx, hy) : centre du crâne. Crâne ≈ rx 19, ry 20, menton ≈ hy+25."""
    skull = ell(hx, hy, 19, 20)
    j = jaw
    jm = poly([(hx - 16, hy + 2), (hx - 13, hy + 13), (hx - 2, hy + 22 * j), (hx + 6, hy + 25 * j),
               (hx + 11, hy + 24.5 * j), (hx + 16, hy + 19 * j), (hx + 20, hy + 9), (hx + 20, hy - 2)])
    m = skull | jm
    p.fill(m, skin, rnd=10, bias=0.2, k_p=0.22, k_n=0.6, dith=0.2)
    p.face_m = m.copy()
    p.face_skin = skin
    if ear == 'human':
        e = ell(hx - 9, hy + 8, 3.2, 5)
        p.fill(e, skin, rnd=2, bias=0.0)
        p.paint(px_line([(hx - 9, hy + 6), (hx - 9, hy + 10)]), skin[1])
    ey = hy + 2
    eye(p, hx - 1, ey, 9, eye_h, iris, far=False, lid=lash, closed=closed, fierce=fierce)
    eye(p, hx + 13, ey, 5, eye_h, iris, far=True, lid=lash, closed=closed, fierce=fierce)
    bc = brow or mix(lash, skin[1], 0.3)
    if brow_mode == 'angry':
        bl = [(hx - 2, ey - 5), (hx + 4, ey - 3), (hx + 8, ey - 1)]
        br = [(hx + 13, ey - 1), (hx + 18, ey - 4)]
    elif brow_mode == 'sad':
        bl = [(hx - 2, ey - 3), (hx + 7, ey - 6)]
        br = [(hx + 13, ey - 6), (hx + 18, ey - 4)]
    else:
        bl = [(hx - 2, ey - 3), (hx + 2, ey - 5), (hx + 8, ey - 5)]
        br = [(hx + 13, ey - 5), (hx + 16, ey - 5), (hx + 18, ey - 4)]
    p.paint(px_line(bl), bc)
    p.paint(px_line([(a + 1, b + 1) for a, b in bl[:2]]), bc)
    p.paint(px_line(br), bc)
    # nez (ombre sous la pointe + reflet)
    p.pset(hx + 18, hy + 12, skin[1])
    p.pset(hx + 17, hy + 13, skin[1])
    p.pset(hx + 19, hy + 10, skin[4])
    my = hy + 18
    if mouth == 'smile':
        for xx in range(hx + 9, hx + 15):
            p.pset(xx, my, MOUTH)
        p.pset(hx + 8, my - 1, MOUTH)
        p.pset(hx + 15, my - 1, MOUTH)
        for xx in range(hx + 10, hx + 14):
            p.pset(xx, my + 1, mix(skin[2], MOUTH, 0.3))
    elif mouth == 'smirk':
        for xx in range(hx + 9, hx + 14):
            p.pset(xx, my, MOUTH)
        p.pset(hx + 14, my - 1, MOUTH)
        p.pset(hx + 15, my - 2, MOUTH)
    elif mouth == 'open':
        for xx in range(hx + 9, hx + 15):
            p.pset(xx, my - 1, MOUTH)
        for xx in range(hx + 10, hx + 14):
            p.pset(xx, my, '#b03a52')
            p.pset(xx, my + 1, '#e07080')
            p.pset(xx, my + 2, MOUTH)
        p.pset(hx + 9, my, MOUTH); p.pset(hx + 14, my, MOUTH)
        p.pset(hx + 10, my, WHITE); p.pset(hx + 11, my, WHITE)
    elif mouth == 'grit':
        for xx in range(hx + 7, hx + 16):
            p.pset(xx, my - 1, MOUTH)
            p.pset(xx, my + 2, MOUTH)
        for xx in range(hx + 8, hx + 15):
            p.pset(xx, my, WHITE)
            p.pset(xx, my + 1, '#d8d0d8')
        for xx in (hx + 7, hx + 15):
            p.pset(xx, my, MOUTH); p.pset(xx, my + 1, MOUTH)
        p.pset(hx + 11, my, '#a8a0b0'); p.pset(hx + 11, my + 1, '#a8a0b0')
        p.pset(hx + 9, my + 1, WHITE); p.pset(hx + 13, my + 1, WHITE)
    elif mouth == 'none':
        pass
    else:  # calm
        for xx in range(hx + 10, hx + 14):
            p.pset(xx, my, MOUTH)
        p.pset(hx + 11, my + 1, mix(skin[2], MOUTH, 0.3))
    if blush:
        bm = (ell(hx + 2, hy + 15, 4.5, 1.6) | ell(hx + 16, hy + 15, 2.5, 1.5)) & ~CHECK
        p.paint(bm, BLUSH)


def elf_ear(p, hx, hy, skin):
    em = spoly([(hx - 10, hy + 2), (hx - 22, hy - 6), (hx - 32, hy - 14), (hx - 24, hy + 2), (hx - 14, hy + 12)])
    p.fill(em, skin, rnd=3, bias=0.1)
    p.paint(px_line([(hx - 26, hy - 8), (hx - 15, hy + 5)]) & em, skin[1])
    p.paint(px_line([(hx - 27, hy - 10), (hx - 16, hy + 2)]) & em, skin[3])


def hair_shadow(p, hair_m, depth=2):
    """Ombre portée de la frange sur le visage."""
    fm = getattr(p, 'face_m', None)
    if fm is None:
        return
    sk = rgb(p.face_skin[3]), rgb(p.face_skin[2]), rgb(p.face_skin[4])
    zone = fm & ~hair_m & (_sh(hair_m, 0, 1) | _sh(hair_m, 0, 2) | (_sh(hair_m, 0, 3) & CHECK))
    cols = p.col[zone]
    isskin = (np.abs(cols - sk[0]).sum(1) < 4) | (np.abs(cols - sk[2]).sum(1) < 4)
    ys, xs = np.nonzero(zone)
    for y, x, ok in zip(ys, xs, isskin):
        if ok:
            p.col[y, x] = rgb(p.face_skin[2])


def lock(p, pts, w, R, rnd=3.0, line='auto', tex_a=None, bias=0.0, rim=True, k_p=0.28):
    """Mèche : tube effilé shadé (w : largeur à la racine, ou liste)."""
    ws = w if isinstance(w, (list, tuple)) else [w, w * 1.05, w * 0.8, w * 0.45, 1.0]
    w = max(ws)
    m = tube(pts, ws)
    tex = None
    if tex_a is not None:
        tex = strands(m, tex_a, freq=0.55, amp=0.12)
    p.fill(m, R, rnd=rnd, line=line, tex=tex, bias=bias, rim=rim, k_p=k_p)
    # brin de lumière
    sp = spline(pts, 0.5)
    n = len(sp)
    hl = []
    for i in range(int(n * 0.12), int(n * 0.55)):
        x, y = sp[i]
        hl.append((x - w * 0.12, y))
    if len(hl) > 2 and w >= 5:
        p.paint(px_line(hl[::3]) & m, R[-1])
    return m


def hair_sheen(p, m, cx, cy, r, R):
    """Anneau de brillance (reflet « angel ring ») sur une masse de cheveux."""
    d = np.sqrt((XX - cx) ** 2 + ((YY - cy) * 1.15) ** 2)
    band = m & (np.abs(d - r) < 1.6) & (XX < cx + r * 0.6) & (YY < cy + 2)
    zig = band & ((XX.astype(int) // 3 % 2 == 0) | (np.abs(d - r) < 0.8))
    p.paint(zig, R[-2])
    p.paint(band & (np.abs(d - r) < 0.6) & (XX < cx - r * 0.2), R[-1])


# ================================================================ pièces génériques

def limb(p, pts, ws, R, rnd=5, line='auto', bias=0.0, rim=True, tex=None, k_p=0.25):
    m = tube(pts, ws)
    p.fill(m, R, rnd=rnd, line=line, bias=bias, rim=rim, tex=tex, k_p=k_p)
    return m


def hand(p, x, y, R=SKIN, r=5.5, fist=True, ang=0, line='auto'):
    """Main fermée (poing) vue de 3/4, doigts vers la droite."""
    m = ell(x, y, r, r * 0.9, ang)
    p.fill(m, R, rnd=3, line=line, bias=0.05)
    if fist:
        for i in range(3):
            yy = y - r * 0.45 + i * r * 0.45
            p.paint(px_line([(x + r * 0.15, yy), (x + r * 0.75, yy)]) & m, R[1])
        p.pset(x - r * 0.3, y - r * 0.5, R[-1])
    return m


def spoly(pts, step=0.6):
    """Polygone lissé (Catmull-Rom fermé)."""
    pts = list(pts)
    ext = [pts[-1]] + pts + [pts[0], pts[1]]
    out = []
    for i in range(1, len(ext) - 2):
        out.extend(_seg_mid(ext[i - 1], ext[i], ext[i + 1], ext[i + 2], step))
    return poly(out)


def _seg_mid(p0, p1, p2, p3, step):
    n = max(2, int(math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step))
    out = []
    for k in range(n):
        t = k / n
        t2, t3 = t * t, t * t * t
        out.append(tuple(0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2
                                + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3) for j in (0, 1)))
    return out


def leg(p, hip, knee, ankle, R, ws=(21, 17, 13, 15, 10), rnd=6, **kw):
    """Jambe galbée : cuisse → genou → mollet → cheville."""
    calf = (knee[0] * 0.55 + ankle[0] * 0.45 - 1.5, knee[1] * 0.55 + ankle[1] * 0.45)
    mid = (hip[0] * 0.5 + knee[0] * 0.5, hip[1] * 0.5 + knee[1] * 0.5)
    return limb(p, [hip, mid, knee, calf, ankle], [ws[0], ws[0] * 0.9, ws[1], ws[2], ws[3], ws[4]], R, rnd=rnd, **kw)


def boot(p, top, ankle, toe_len, R, ws=(17, 14, 13), cuff=None, sole=None, rnd=5, line='auto'):
    """Botte : tige (top → cheville) + pied pointant vers la droite, semelle sur GROUND."""
    shin = tube([top, ((top[0] + ankle[0]) / 2, (top[1] + ankle[1]) / 2), ankle], list(ws))
    ax, ay = ankle
    g = GROUND
    foot = spoly([(ax - 7, ay - 2), (ax + 3, ay - 3), (ax + toe_len - 4, g - 6), (ax + toe_len + 1, g - 2),
                  (ax + toe_len, g), (ax - 8, g), (ax - 9, g - 5)])
    m = shin | foot
    p.fill(m, R, rnd=rnd, line=line)
    if sole:
        p.paint(m & (YY > g - 2.5), sole)
    if cuff:
        c = dilate(shin & (YY > top[1] - ws[0] / 2 - 1) & (YY < top[1] + 4), diag=True)
        c = c & ~_sh(c, 0, -0) & (YY > top[1] - ws[0] / 2) | (c & (YY > top[1] - ws[0] / 2))
        p.fill(c, cuff, rnd=2, k_p=0.5)
    return m


def arm(p, sh, el, wr, R, ws=(14, 11, 11, 9), rnd=5, **kw):
    fa = (el[0] * 0.6 + wr[0] * 0.4, el[1] * 0.6 + wr[1] * 0.4)
    return limb(p, [sh, el, fa, wr], list(ws), R, rnd=rnd, **kw)


def fold(p, pts, dark, light=None, within=None):
    """Pli de tissu : trait sombre + trait clair décalé vers la gauche (côté lumière)."""
    m = px_line(pts)
    if within is not None:
        m &= within
    p.paint(m, dark)
    if light:
        lm = _sh(m, -1, 0) & ~m
        if within is not None:
            lm &= within
        p.paint(lm, light)


def rivets(p, pts, R):
    for x, y in pts:
        p.pset(x, y, R[-1])
        p.pset(x + 1, y + 1, R[0])
        p.pset(x + 1, y, R[2])
        p.pset(x, y + 1, R[1])


def gem(p, x, y, r, R, line=OUT):
    """Gemme ronde à facettes avec éclat."""
    m = ell(x, y, r, r)
    p.fill(m, R, rnd=max(1.5, r * 0.8), line=line, bias=-0.05, k_p=0.5)
    p.pset(x - r * 0.45, y - r * 0.45, WHITE)
    if r >= 3:
        p.pset(x - r * 0.45 + 1, y - r * 0.45, mix(R[-1], WHITE, 0.5))
        p.pset(x + r * 0.35, y + r * 0.35, R[-1])
    return m


def engrave(p, m, R, step=6, seed=1):
    """Gravures (volutes) en pointillé sombre/clair à l'intérieur d'une plaque."""
    ys, xs = np.nonzero(erode(erode(m)))
    if len(xs) == 0:
        return
    rr = random.Random(seed)
    for _ in range(int(len(xs) / (step * step))):
        i = rr.randrange(len(xs))
        x, y = xs[i], ys[i]
        a = rr.random() * 6.28
        pts = [(x + math.cos(a + k * 0.7) * k * 1.2, y + math.sin(a + k * 0.7) * k * 1.0) for k in range(4)]
        mm = px_line(pts) & erode(m)
        cur = p.col[y, x]
        p.paint(mm, hexs(cur * 0.72 + rgb(R[0]) * 0.28))


def glow(p, m, c, layer='back', dense=False):
    """Halo tramé (pixels en damier) — lueur discrète en pixel art."""
    mm = m & (CHECK if not dense else np.ones((N, N), bool))
    p.fx(mm, c, layer)


def shine(p, m, c, n=1):
    """Liseré clair en haut-gauche à l'intérieur d'une pièce (métal poli)."""
    e = m & ~_sh(m, 1, 0) | m & ~_sh(m, 0, 1)
    p.paint(e & m, c)


# ================================================================ ailes à plumes

def feather(p, base, ang, length, w, R, line='auto', vein=True, k_p=0.12, bias=0.0):
    a = math.radians(ang)
    pt = lambda t: (base[0] + math.cos(a) * length * t, base[1] + math.sin(a) * length * t)
    m = tube([pt(0), pt(0.5), pt(0.93)], [w * 0.55, w * 0.95, w, w * 0.85, w * 0.4])
    p.fill(m, R, rnd=min(4, w * 0.4), line=line, k_p=k_p, bias=bias)
    if vein and length > 16:
        p.paint(px_line([pt(0.12), pt(0.86)]) & erode(m), R[-2])
        p.paint(_sh(px_line([pt(0.12), pt(0.86)]), 1, 1) & erode(m) & ~px_line([pt(0.12), pt(0.86)]), R[1])
    return m


def feather_wing(p, bone, R, a0, a1, L0, L1, w=11, n_prim=11, cov=2, CR=None):
    """Aile : os (racine → bout). Les rémiges rayonnent de l'angle a0 (racine) à a1 (bout)."""
    sp = spline(bone, 0.5)
    at = lambda t: sp[min(len(sp) - 1, int(t * (len(sp) - 1)))]
    CR = CR or R
    PR = [mix(c, '#4a5aa8', 0.18) for c in R]
    for i in range(n_prim):
        t = 0.06 + 0.94 * i / (n_prim - 1)
        ang = a0 + (a1 - a0) * t ** 1.2
        L = L0 + (L1 - L0) * t
        feather(p, at(t), ang, L, w, PR, bias=-0.06 if i % 2 else 0.04)
    for row in range(cov):
        k = 9 + row * 3
        for i in range(k):
            t = 0.02 + 0.95 * i / (k - 1)
            ang = a0 + (a1 - a0) * t ** 1.2
            L = (L0 + (L1 - L0) * t) * (0.5 - row * 0.2)
            feather(p, at(t), ang, max(9, L), w * (1.0 - row * 0.15), CR, vein=row == 0, k_p=0.2)
    m = tube(bone, [w * 1.1, w * 1.0, w * 0.75, w * 0.45])
    p.fill(m, CR, rnd=4, bias=0.2)
    for i in range(2, len(sp) // 5):
        x, y = sp[i * 5]
        p.paint(px_line([(x - 2, y + w * 0.3), (x, y + w * 0.45), (x + 2, y + w * 0.3)]) & m, CR[2])
    return m


# ================================================================ 1. ARCHANGE (SSR)

A_HAIR = ['#7a4210', '#c07a1c', '#eab032', '#ffd95a', '#fff1a0', '#fffce0']
A_IRIS = ['#1a3a9a', '#2f7cf6', '#8fe0ff']
A_WING = ['#3a4c9e', '#6a8ee0', '#a8c8f8', '#d8eaff', '#f4faff', '#ffffff']
A_BLUE = ['#122468', '#1f4cb0', '#3a84ea', '#7cc0ff', '#d4f0ff']
A_BLADE = ['#1c46c8', '#3a8cf6', '#8fd8ff', '#dcf6ff', '#ffffff']
A_WHITE = ['#6a78b8', '#a8b8e8', '#dce6fa', '#f6f9ff', '#ffffff']


def sword(p, grip, tip, R, guard_R, grip_R, pommel_R, width=9, guard_w=26, glow_c=None, fuller=True, wings=False):
    gx, gy = grip
    L = math.hypot(tip[0] - gx, tip[1] - gy)
    ca, sa = (tip[0] - gx) / L, (tip[1] - gy) / L
    nx, ny = -sa, ca
    P = lambda t, s: (gx + ca * t + nx * s, gy + sa * t + ny * s)
    hw = width / 2
    if glow_c:
        g = tube([P(10, 0), P(L, 0)], [width + 10, width + 8, 6]) & ~tube([P(10, 0), P(L, 0)], [width + 2, width, 2])
        glow(p, g, glow_c)
    blade = poly([P(9, -hw), P(L - 14, -hw * 0.85), P(L, 0), P(L - 14, hw * 0.85), P(9, hw)])
    p.fill(blade, R, rnd=2, k_n=0.6, bias=0.05)
    if fuller:
        p.paint(px_line([P(12, -0.5), P(L - 10, -0.3)]) & blade, R[-1])
        p.paint(px_line([P(12, -hw + 1.5), P(L - 14, -hw * 0.85 + 1.5)]) & blade, R[-2])
        p.paint(px_line([P(12, hw - 1.5), P(L - 14, hw * 0.85 - 1.5)]) & blade, R[1])
    gm = tube([P(8, -guard_w / 2), P(10, -4), P(10, 4), P(8, guard_w / 2)], [5, 6, 6, 5])
    p.fill(gm, guard_R, rnd=2)
    if wings:
        for sgn in (-1, 1):
            wm = poly([P(9, sgn * guard_w * 0.4), P(18, sgn * guard_w * 0.75), P(15, sgn * guard_w * 0.42)])
            p.fill(wm, guard_R, rnd=2)
    gp = tube([P(-8, 0), P(6, 0)], 5)
    p.fill(gp, grip_R, rnd=2)
    for t in (-5, -2, 1, 4):
        p.paint(px_line([P(t, -2), P(t + 1, 2)]) & gp, grip_R[0])
    if pommel_R:
        gem(p, *P(-11, 0), 3.2, pommel_R)
    return P


def archangel():
    p = Pic('#9fd8ff')
    hx, hy = 124, 56
    halo_c = (120, 22)
    glow(p, ring(halo_c[0], halo_c[1], 31, 10.5, 6, rot=-6), '#fff2a8')
    # rayons
    for ang in (-160, -130, -105, -75, -48, -20):
        a = math.radians(ang)
        m = thick_line([(124 + math.cos(a) * 84, 128 + math.sin(a) * 84), (124 + math.cos(a) * 112, 128 + math.sin(a) * 112)], 1.0)
        p.fx(m & CHECK, '#fff6d0', 'back')
    # --- ailes
    feather_wing(p, [(140, 102), (162, 80), (188, 60), (210, 48)], dk(A_WING), 78, -14, 42, 36, w=10, n_prim=9)
    feather_wing(p, [(114, 104), (88, 80), (62, 60), (40, 50)], A_WING, 100, 198, 60, 30, w=12, n_prim=12)
    # --- cheveux arrière
    back = ell(hx - 4, hy - 3, 25, 25) | poly([(hx - 27, hy), (hx + 6, hy), (hx + 4, hy + 30), (hx - 26, hy + 36)])
    p.fill(back, A_HAIR[:5], rnd=6, tex=strands(back, 8, 0.5, 0.12), bias=-0.15)
    for pts, w in (([(hx - 20, hy + 8), (hx - 27, hy + 24), (hx - 24, hy + 40), (hx - 29, hy + 50)], 12),
                   ([(hx - 10, hy + 12), (hx - 15, hy + 28), (hx - 10, hy + 42), (hx - 13, hy + 50)], 11)):
        lock(p, pts, w, A_HAIR[:5], rnd=4, bias=-0.1)
    # --- bras arrière
    arm(p, (108, 100), (96, 120), (92, 136), dk(A_BLUE))
    # --- jambes
    leg(p, (119, 166), (112, 198), (106, 228), dk(A_WHITE))
    leg(p, (138, 166), (146, 198), (151, 230), A_WHITE)
    boot(p, (111, 200), (106, 230), 15, dk(GOLD), ws=(15, 12, 11), sole=GOLD[0])
    gm = boot(p, (146, 200), (151, 232), 17, GOLD, ws=(16, 13, 12), sole=GOLD[0])
    fold(p, [(148, 208), (151, 228)], GOLD[1], GOLD[4], gm)
    for kx, ky, R in ((111, 198, dk(GOLD)), (146, 198, GOLD)):
        km = spoly([(kx - 8, ky - 3), (kx, ky - 7), (kx + 8, ky - 3), (kx + 5, ky + 5), (kx - 5, ky + 5)])
        p.fill(km, R, rnd=3, bias=0.05)
        gem(p, kx, ky - 1, 2.2, A_BLADE)
    p.paint(px_line([(146, 216), (156, 214)]) & gm, GOLD[1])
    p.paint(px_line([(146, 215), (156, 213)]) & gm, GOLD[3])
    # --- jupon blanc + tassettes bleues
    under = spoly([(106, 144), (146, 144), (156, 176), (150, 186), (100, 188), (98, 176)])
    p.fill(under, A_WHITE, rnd=6)
    for x0 in (108, 118, 128, 138, 146):
        fold(p, [(x0, 160), (x0 + (x0 - 126) * 0.18, 186)], A_WHITE[1], A_WHITE[3], under)
    panels = [[(104, 142), (119, 142), (117, 182), (97, 176)],
              [(117, 143), (135, 143), (138, 184), (115, 183)],
              [(133, 142), (150, 141), (160, 176), (139, 184)]]
    for i, pts in enumerate(panels):
        m = spoly(pts) | poly(pts)
        R = A_BLUE if i else dk(A_BLUE)
        p.fill(m, R, rnd=5)
        bot = max(y for _, y in pts)
        inner = m & ~(_sh(m, 0, -4) == False) & _sh(m, 0, -4)
        inner = m & _sh(m, 0, -4) & _sh(m, -2, 0) & _sh(m, 2, 0)
        bb = m & ~inner
        p.paint(bb, GOLD[3] if i == 1 else (GOLD[2] if i == 0 else GOLD[1]))
        cx = sum(x for x, _ in pts) / 4
        fold(p, [(cx + 1, 150), (cx + 1 + (i - 1) * 3, 174)], R[1], R[3], m & inner)
        p.pset(cx, 147, GOLD[3])
    # --- cuirasse dorée
    chest = spoly([(103, 96), (126, 91), (148, 93), (152, 108), (146, 128), (140, 144), (114, 146), (106, 128), (101, 110)])
    p.fill(chest, GOLD, rnd=12, k_n=1.15, k_p=0.32)
    # plaques ventrales (lames)
    for y0 in (126, 134):
        p.paint(px_line([(107, y0 + 2), (128, y0), (146, y0 - 3)]) & chest, GOLD[0])
        p.paint(px_line([(107, y0 + 3), (128, y0 + 1), (146, y0 - 2)]) & chest, GOLD[3])
    fold(p, [(133, 96), (130, 116), (128, 125)], GOLD[1], GOLD[4], chest)
    # ailes gravées + gemme
    for sgn, c in ((-1, GOLD[4]), (1, GOLD[3])):
        for k in range(3):
            p.paint(px_line([(129, 108 + k), (129 + sgn * (8 + k * 2), 101 + k * 3), (129 + sgn * (14 - k), 104 + k * 3)]) & chest,
                    c if k == 0 else GOLD[1])
    engrave(p, chest & (YY > 112) & (YY < 124), GOLD, step=6, seed=4)
    gem(p, 129, 109, 4.5, A_BLADE)
    rivets(p, [(107, 102), (145, 99), (110, 138), (142, 137)], GOLD)
    belt = spoly([(106, 141), (148, 139), (149, 147), (105, 149)])
    p.fill(belt, A_BLUE, rnd=3)
    buck = spoly([(123, 139), (134, 139), (134, 149), (123, 149)])
    p.fill(buck, GOLD, rnd=2)
    gem(p, 128.5, 144, 2.2, A_BLADE)
    # --- cou, col, tête
    neck(p, hx, hy)
    collar = spoly([(110, 92), (126, 88), (142, 90), (139, 97), (126, 101), (113, 97)])
    p.fill(collar, A_BLUE, rnd=3)
    p.paint(collar & ~_sh(collar, 0, 2), GOLD[3])
    face(p, hx, hy, A_IRIS, mouth='smile', brow=A_HAIR[1], lash='#4a2a1a')
    # --- cheveux avant
    top = ell(hx - 2, hy - 8, 22, 15) & (YY < hy - 2 + (XX - hx) * 0.18)
    p.fill(top, A_HAIR, rnd=7, tex=strands(top, 20, 0.6, 0.1), bias=0.1)
    hair_sheen(p, top, hx - 3, hy - 3, 16, A_HAIR)
    fr = [
        ([(hx - 8, hy - 16), (hx - 15, hy - 2), (hx - 16, hy + 14), (hx - 13, hy + 28), (hx - 17, hy + 40)], 10),
        ([(hx - 3, hy - 18), (hx - 7, hy - 6), (hx - 7, hy + 4)], 9),
        ([(hx + 3, hy - 19), (hx + 4, hy - 8), (hx + 1, hy + 0)], 9),
        ([(hx + 9, hy - 18), (hx + 12, hy - 8), (hx + 10, hy - 1)], 8),
        ([(hx + 14, hy - 15), (hx + 19, hy - 6), (hx + 18, hy + 3)], 7),
        ([(hx + 16, hy - 12), (hx + 22, hy - 2), (hx + 21, hy + 10), (hx + 18, hy + 18)], 6),
    ]
    hm = top.copy()
    for pts, w in fr:
        hm |= lock(p, pts, w, A_HAIR, rnd=3)
    hair_shadow(p, hm)
    # --- auréole
    halo = ring(halo_c[0], halo_c[1], 22, 6.5, 3.2, rot=-6)
    p.fill(halo, ['#c07a1c', '#ffd95a', '#fff6b0', '#ffffff'], rnd=2, rim=False)
    # --- épaulière arrière
    for (cx, cy, rx, ry, rr) in ((104, 104, 12, 8, -25), (106, 98, 12, 8, -15)):
        p.fill(ell(cx, cy, rx, ry, rr), GOLD, rnd=4, bias=-0.12)
    # --- bouclier
    sh_pts = [(68, 122), (88, 118), (108, 122), (108, 150), (90, 178), (72, 152)]
    sm = spoly(sh_pts)
    p.fill(sm, GOLD, rnd=4, k_n=1.2)
    inner = spoly([(73, 127), (88, 124), (103, 127), (103, 149), (90, 170), (77, 150)])
    p.fill(inner, A_BLUE, rnd=9, bias=0.05, line=GOLD[0])
    cross = poly([(86, 126), (91, 126), (91, 168), (86, 164)]) | poly([(75, 138), (103, 136), (103, 141), (75, 143)])
    p.fill(cross & inner, GOLD, rnd=2, bias=0.15, line=GOLD[0])
    gem(p, 88.5, 139.5, 4, A_BLADE)
    rivets(p, [(71, 125), (88, 121), (105, 125), (106, 147), (90, 175), (74, 150)], GOLD)
    p.paint(px_line([(77, 131), (83, 129)]), A_BLUE[4])
    # --- bras avant + épée
    arm(p, (148, 100), (160, 118), (166, 132), A_BLUE)
    brace = tube([(158, 118), (167, 134)], [14, 13])
    p.fill(brace, GOLD, rnd=4)
    p.paint(px_line([(157, 121), (164, 132)]) & brace, GOLD[4])
    sword(p, (170, 137), (204, 26), A_BLADE, GOLD, LEATHER, A_BLADE, width=10, guard_w=26, glow_c='#7cc8ff', wings=True)
    hand(p, 170, 137, SKIN, r=6)
    for (cx, cy, rx, ry, rr) in ((151, 106, 14, 9, 18), (150, 98, 15, 10, 10)):
        p.fill(ell(cx, cy, rx, ry, rr), GOLD, rnd=5)
    m = ell(150, 98, 15, 10, 10)
    p.paint(px_line([(138, 100), (150, 104), (163, 102)]) & m, GOLD[1])
    gem(p, 151, 97, 2.6, A_BLADE)
    # --- effets avant
    for (x, y, s) in ((214, 76, 2), (192, 160, 1), (34, 196, 1), (226, 124, 0), (66, 28, 1), (176, 16, 1), (214, 200, 0), (20, 120, 0)):
        p.sparkle(x, y, ['#ffffff', '#8fe0ff', '#4fb0ff'], s)
    for (x, y, a) in ((198, 186, 30), (46, 218, -20), (228, 156, 60)):
        m = tube([(x, y), (x + math.cos(math.radians(a)) * 9, y + math.sin(math.radians(a)) * 9)], [3, 4, 1])
        p.fx(m, A_WING[3])
        p.fx(m & edge(m) & (YY > y + 2), A_WING[1])
    return p


# ================================================================ effets communs

FIRE = ['#6a1006', '#c4300c', '#ff6a14', '#ffb02e', '#ffe680', '#fffbe0']


def flame_fx(p, x, y, h, w, seed=0, R=FIRE, layer='front', sway=0.25):
    """Flamme : langues imbriquées (sombre → cœur clair), sans contour."""
    rr = random.Random(seed)
    tongues = [(0, 1.0)] + [(rr.uniform(-0.5, 0.5), rr.uniform(0.45, 0.75)) for _ in range(2)]
    for lvl in range(len(R) - 1):
        k = 1 - lvl / (len(R) - 1)
        for dx, hh in tongues:
            bx = x + dx * w * 0.6
            th = h * hh * (0.35 + 0.65 * k)
            tip = (bx + sway * th * (1 if seed % 2 else -1), y - th)
            mid = (bx - sway * th * 0.4 * (1 if seed % 2 else -1), y - th * 0.5)
            m = tube([(bx, y), mid, tip], [w * k * hh, w * k * 0.75 * hh, max(1, w * k * 0.15)])
            p.fx(m, R[lvl], layer)


def ember(p, x, y, c0='#ffe680', c1='#ff6a14'):
    p.fxpx(x, y, c0)
    p.fxpx(x, y + 1, c1)


def bat_wing(p, sh, wr, tips, R, bone_R, scallop=0.32):
    """Aile de chauve-souris : membrane entre les doigts (bords festonnés), os par-dessus."""
    pts = [sh, wr] + tips + [sh]
    mem = poly([sh, wr] + tips)
    # festons : on creuse entre chaque paire de pointes
    chain = tips + [(sh[0], sh[1] + 30)]
    for a, b in zip(chain, chain[1:]):
        mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
        L = math.hypot(b[0] - a[0], b[1] - a[1])
        # centre du creux poussé vers l'extérieur (loin du poignet)
        vx, vy = mx - wr[0], my - wr[1]
        vl = math.hypot(vx, vy) or 1
        cx, cy = mx + vx / vl * L * 0.42, my + vy / vl * L * 0.42
        mem &= ~ell(cx, cy, L * 0.62, L * 0.62)
    tex = None
    p.fill(mem, R, rnd=8, k_p=0.4, bias=-0.05)
    # nervures claires dans la membrane
    for t in tips:
        p.paint(px_line([(wr[0] + (t[0] - wr[0]) * 0.15, wr[1] + (t[1] - wr[1]) * 0.15), (wr[0] + (t[0] - wr[0]) * 0.55 + 3, wr[1] + (t[1] - wr[1]) * 0.55 + 3)]) & mem, R[-2])
    limb(p, [sh, ((sh[0] + wr[0]) / 2, (sh[1] + wr[1]) / 2 - 6), wr], [9, 7, 6], bone_R, rnd=3)
    for t in tips:
        limb(p, [wr, t], [5, 2.5], bone_R, rnd=2)
    # griffe au poignet
    claw = tube([wr, (wr[0] + (wr[0] - sh[0]) * 0.12, wr[1] - 9)], [5, 1])
    p.fill(claw, ['#2a1a30', '#7a6a8e', '#ece4f6'], rnd=2)
    return mem


def horn(p, pts, w, R, rings=True):
    m = tube(pts, [w, w * 0.9, w * 0.65, w * 0.35, 1.2])
    p.fill(m, R, rnd=4)
    if rings:
        sp = spline(pts, 0.5)
        for i in range(4, int(len(sp) * 0.7), 7):
            x, y = sp[i]
            x2, y2 = sp[min(len(sp) - 1, i + 2)]
            a = math.atan2(y2 - y, x2 - x)
            nx, ny = -math.sin(a), math.cos(a)
            ww = w * 0.6
            p.paint(px_line([(x - nx * ww, y - ny * ww), (x + nx * ww, y + ny * ww)]) & m, R[1])
    return m


# ================================================================ 2. REINE DÉMONE (SSR)

D_HAIR = ['#4a0616', '#8a1424', '#c82a32', '#f05a4a', '#ff9a78', '#ffd0b8']
D_IRIS = ['#5a0a1e', '#e0383a', '#ffd04a']
D_ARMOR = ['#1e0616', '#3e0c1e', '#6a1628', '#9c2634', '#d0504a', '#f08a70']
D_HORN = ['#120a1c', '#2a1a3a', '#4a3060', '#7a5a8e', '#b49ac8']
D_WING = ['#1a0618', '#360c2c', '#5e1640', '#8a2450', '#b8405a']
D_BONE = ['#14081a', '#2e1430', '#4e2444', '#7a3e5a']
D_AXE = ['#1e1226', '#3a2c4a', '#635674', '#9c90b0', '#d6ccea', '#ffffff']
D_SKIN = ['#8a3e48', '#c87468', '#eea488', '#ffcdb0', '#ffe6d4']


def demon_queen():
    p = Pic('#ff5a2a')
    hx, hy = 124, 60
    # --- lueur de braise derrière
    # cercle infernal au sol (runes tramées)
    circ = ring(128, 236, 78, 10, 2) | ring(128, 236, 66, 8, 1)
    p.fx(circ & CHECK, '#ff6a14', 'back')
    for k in range(10):
        a = k / 10 * 6.283
        x, y = 128 + math.cos(a) * 72, 236 + math.sin(a) * 9
        p.fx(ell(x, y, 1.5, 1), '#ffb02e', 'back')
    # --- ailes
    bat_wing(p, (140, 102), (182, 62), [(232, 44), (240, 92), (222, 128), (190, 140)], dk(D_WING), D_BONE)
    bat_wing(p, (112, 102), (66, 52), [(14, 30), (8, 84), (22, 128), (54, 150), (88, 150)], D_WING, D_BONE)
    # --- queue
    tail = tube([(112, 168), (88, 190), (70, 214), (54, 222), (40, 214)], [9, 8, 6, 5, 4])
    p.fill(tail, D_ARMOR, rnd=3)
    spade = poly([(42, 214), (30, 198), (28, 214), (22, 226), (38, 224)])
    p.fill(spade, D_ARMOR, rnd=3)
    # --- cheveux arrière (longs, flottant vers la gauche)
    back = ell(hx - 5, hy - 2, 25, 26) | spoly([(hx - 28, hy), (hx + 4, hy + 4), (hx - 2, hy + 60), (hx - 18, hy + 96),
                                               (hx - 46, hy + 104), (hx - 40, hy + 60)])
    p.fill(back, dk(D_HAIR[:5]), rnd=7, tex=strands(back, 12, 0.45, 0.12), bias=-0.05)
    for pts, w in (([(hx - 20, hy + 10), (hx - 34, hy + 40), (hx - 38, hy + 76), (hx - 52, hy + 108)], 14),
                   ([(hx - 10, hy + 16), (hx - 20, hy + 50), (hx - 20, hy + 84), (hx - 30, hy + 112)], 12),
                   ([(hx - 28, hy + 2), (hx - 44, hy + 26), (hx - 52, hy + 56), (hx - 64, hy + 80)], 10)):
        lock(p, pts, w, dk(D_HAIR[:5]), rnd=4, bias=0.05)
    # --- bras arrière (gantelet griffu sur la hanche)
    arm(p, (108, 100), (94, 120), (104, 140), dk(D_ARMOR), ws=(13, 10, 10, 9))
    gaunt = ell(105, 141, 7, 6)
    p.fill(gaunt, dk(D_HORN), rnd=3)
    # --- jambes (cuissardes)
    leg(p, (118, 164), (112, 198), (106, 228), dk(D_SKIN), ws=(19, 14, 11, 13, 9))
    leg(p, (138, 164), (148, 198), (152, 230), D_SKIN, ws=(20, 15, 12, 14, 9))
    boot(p, (112, 182), (106, 230), 15, dk(D_ARMOR), ws=(16, 13, 11), sole=OUT)
    bm = boot(p, (148, 182), (152, 232), 17, D_ARMOR, ws=(17, 14, 12), sole=OUT)
    # talons + genouillères à pointe
    for kx, ky, R in ((112, 196, dk(D_HORN)), (148, 196, D_HORN)):
        km = poly([(kx - 7, ky - 4), (kx + 7, ky - 5), (kx + 5, ky + 6), (kx - 5, ky + 6)])
        p.fill(km, R, rnd=3)
        sp_ = poly([(kx + 3, ky - 4), (kx + 12, ky - 9), (kx + 6, ky + 2)])
        p.fill(sp_, R, rnd=2)
    for x0 in (98, 140):
        p.fill(poly([(x0, GROUND - 4), (x0 + 4, GROUND - 4), (x0 + 3, GROUND), (x0 + 1, GROUND)]), D_HORN, rnd=1)
    fold(p, [(150, 206), (152, 228)], D_ARMOR[1], D_ARMOR[4], bm)
    # --- jupe longue fendue
    skirt_b = spoly([(108, 142), (140, 142), (136, 180), (124, 222), (114, 230), (106, 222), (94, 236),
                     (84, 226), (72, 232), (80, 204), (96, 172)])
    p.fill(skirt_b, dk(D_ARMOR), rnd=7)
    for x0, x1 in ((104, 96), (112, 104), (120, 114)):
        fold(p, [(x0, 152), (x1, 222)], D_ARMOR[0], D_ARMOR[2], skirt_b)
    skirt_f = spoly([(128, 142), (150, 140), (160, 160), (166, 186), (156, 184), (142, 164)])
    p.fill(skirt_f, D_ARMOR, rnd=5)
    fold(p, [(150, 150), (160, 180)], D_ARMOR[1], D_ARMOR[4], skirt_f)
    # bordure dorée de la jupe
    for sm in (skirt_b, skirt_f):
        b = sm & ~_sh(sm, 0, -2)
        p.paint(b & (YY > 160), GOLD[2])
        p.paint(sm & ~_sh(sm, 0, -1) & (YY > 160), GOLD[1])
    # tassettes en écailles
    for i, (x0, y0) in enumerate(((106, 142), (120, 144), (134, 142), (146, 140))):
        sc = spoly([(x0, y0), (x0 + 14, y0), (x0 + 12, y0 + 16), (x0 + 6, y0 + 20), (x0 + 1, y0 + 14)])
        p.fill(sc, D_HORN if i else dk(D_HORN), rnd=4)
        p.pset(x0 + 6, y0 + 6, GOLD[3])
    # --- corset
    chest = spoly([(104, 96), (126, 92), (148, 94), (150, 110), (144, 128), (140, 146), (112, 147), (107, 128), (102, 110)])
    p.fill(chest, D_ARMOR, rnd=11, k_n=1.1)
    # buste (deux galbes) + décolleté
    for cx, cy, rx, ry, R in ((118, 108, 11, 9, dk(D_ARMOR)), (138, 107, 12, 10, D_ARMOR)):
        p.fill(ell(cx, cy, rx, ry), R, rnd=7)
    dec = poly([(124, 96), (134, 96), (129, 108)])
    p.fill(dec, D_SKIN, rnd=3, line=None)
    # laçage doré
    for k in range(5):
        y = 118 + k * 5
        p.paint(px_line([(124, y), (132, y + 3)]) & chest, GOLD[3])
        p.paint(px_line([(132, y), (124, y + 3)]) & chest, GOLD[1])
    fold(p, [(110, 116), (113, 142)], D_ARMOR[1], D_ARMOR[4], chest)
    # chaîne dorée en écharpe
    for k in range(13):
        x, y = 108 + k * 3.1, 100 + k * 3.4
        p.paint(ell(x, y, 1.6, 1.4) & ~ell(x, y, 0.6, 0.5), GOLD[3] if k % 2 else GOLD[2])
    belt = poly([(108, 141), (146, 139), (147, 145), (107, 147)])
    p.fill(belt, GOLD, rnd=2, bias=-0.1)
    for x in range(112, 146, 6):
        p.paint(px_line([(x, 140), (x, 147)]) & belt, GOLD[0])
    gem(p, 127, 143.5, 3.2, ['#5a0a1e', '#c01a2a', '#ff5a3a', '#ffb08a', '#ffffff'])
    # --- cou + tête
    neck(p, hx, hy, D_SKIN, w=10)
    collar = spoly([(108, 92), (114, 80), (118, 92), (130, 96), (142, 90), (146, 80), (150, 92), (140, 99), (114, 99)])
    p.fill(collar, D_HORN, rnd=3)
    face(p, hx, hy, D_IRIS, skin=D_SKIN, mouth='smirk', brow=D_HAIR[0], brow_mode='angry', lash='#2a0a14', blush=False)
    p.pset(hx + 13, hy + 19, WHITE)  # croc
    p.pset(hx + 13, hy + 20, '#d8d0e0')
    # lèvres rouges
    for xx in range(hx + 9, hx + 14):
        p.pset(xx, hy + 19, '#c02040') if xx != hx + 13 else None
    # --- cheveux avant
    top = ell(hx - 2, hy - 8, 22, 15) & (YY < hy - 2 + (XX - hx) * 0.2)
    p.fill(top, D_HAIR, rnd=7, tex=strands(top, 25, 0.6, 0.1), bias=0.22)
    hair_sheen(p, top, hx - 3, hy - 3, 16, D_HAIR)
    hm = top.copy()
    for pts, w in [
        ([(hx - 8, hy - 16), (hx - 16, hy - 2), (hx - 17, hy + 16), (hx - 13, hy + 34), (hx - 18, hy + 50)], 11),
        ([(hx - 2, hy - 19), (hx - 6, hy - 6), (hx - 9, hy + 4)], 10),
        ([(hx + 5, hy - 19), (hx + 6, hy - 8), (hx + 3, hy + 1)], 9),
        ([(hx + 11, hy - 17), (hx + 14, hy - 7), (hx + 11, hy - 1)], 8),
        ([(hx + 15, hy - 14), (hx + 21, hy - 4), (hx + 22, hy + 6), (hx + 19, hy + 22)], 7),
    ]:
        hm |= lock(p, pts, w, D_HAIR, rnd=3)
    hair_shadow(p, hm)
    # --- cornes
    horn(p, [(hx - 6, hy - 14), (hx - 10, hy - 28), (hx - 20, hy - 38), (hx - 34, hy - 40)], 10, dk(D_HORN))
    horn(p, [(hx + 6, hy - 17), (hx + 6, hy - 32), (hx - 2, hy - 44), (hx - 14, hy - 48)], 11, D_HORN)
    gem(p, hx + 4, hy - 13, 2.6, ['#5a0a1e', '#c01a2a', '#ff5a3a', '#ffb08a', '#ffffff'])
    # --- épaulières à pointes
    for (cx, cy, R, flip) in ((104, 100, dk(D_HORN), -1), (150, 100, D_HORN, 1)):
        m = ell(cx, cy, 12, 9, flip * 15)
        p.fill(m, R, rnd=4)
        for k, (dx, dy) in enumerate(((flip * 6, -14), (flip * 14, -8))):
            spk = poly([(cx + flip * (k * 6 - 4), cy - 5), (cx + dx, cy + dy), (cx + flip * (k * 6 + 2), cy - 3)])
            p.fill(spk, R, rnd=2)
        p.paint(px_line([(cx - 10, cy + 4), (cx + 10, cy + 5)]) & m, GOLD[2])
    # --- hache
    shaft = [(150, 236), (178, 52)]
    sm = tube(shaft, 6)
    p.fill(sm, D_BONE, rnd=2)
    for t in np.linspace(0.15, 0.85, 9):
        x = shaft[0][0] + (shaft[1][0] - shaft[0][0]) * t
        y = shaft[0][1] + (shaft[1][1] - shaft[0][1]) * t
        p.paint(px_line([(x - 3, y), (x + 3, y - 2)]) & sm, D_BONE[0])
    # fer : croissant double
    ax, ay = 176, 70
    blade = spoly([(ax - 2, ay - 10), (ax + 22, ay - 30), (ax + 38, ay - 8), (ax + 40, ay + 14), (ax + 28, ay + 36),
                   (ax + 4, ay + 18), (ax - 2, ay + 8)])
    blade &= ~ell(ax + 6, ay + 4, 9, 12)
    p.fill(blade, D_AXE[:5], rnd=5, k_n=1.1, bias=-0.12)
    edge_m = blade & ~_sh(blade, -4, 0) | (blade & ~_sh(blade, -3, 0))
    p.paint(edge_m & (XX > ax + 22), D_AXE[4])
    p.paint(blade & ~_sh(blade, -1, 0) & (XX > ax + 22), D_AXE[5])
    back_spike = poly([(ax - 2, ay - 4), (ax - 22, ay + 2), (ax - 2, ay + 10)])
    p.fill(back_spike, D_AXE, rnd=2)
    for k in range(3):
        p.paint(px_line([(ax + 10 + k * 5, ay - 14 + k * 2), (ax + 14 + k * 5, ay + 20 - k * 2)]) & blade, D_AXE[1])
    gem(p, ax + 4, ay + 1, 4, ['#5a0a1e', '#c01a2a', '#ff5a3a', '#ffb08a', '#ffffff'])
    spike = tube([(178, 52), (181, 34)], [5, 1])
    p.fill(spike, D_AXE, rnd=2)
    # --- bras avant
    arm(p, (150, 104), (160, 124), (163, 142), D_ARMOR, ws=(14, 11, 11, 10))
    g = tube([(160, 128), (163, 142)], [13, 12])
    p.fill(g, D_HORN, rnd=3)
    p.paint(px_line([(158, 130), (166, 128)]) & g, GOLD[2])
    hand(p, 165, 145, D_SKIN, r=6)
    # --- flammes
    flame_fx(p, 214, 76, 34, 12, seed=1)
    flame_fx(p, 206, 96, 22, 9, seed=2)
    flame_fx(p, 222, 104, 18, 8, seed=3)
    for i, (x, y) in enumerate(((200, 40), (226, 30), (60, 170), (190, 196), (214, 150), (40, 70), (96, 24), (232, 182))):
        ember(p, x, y)
    flame_fx(p, 94, 244, 10, 8, seed=5)
    flame_fx(p, 168, 244, 12, 8, seed=6)
    return p


# ================================================================ 3. IMPÉRATRICE DES GLACES (SSR)

I_HAIR = ['#4a5690', '#7a88c0', '#adbae0', '#d6def4', '#f0f4ff', '#ffffff']
I_IRIS = ['#1a3a8a', '#3ac8ff', '#c4f6ff']
ICE = ['#1e3c8a', '#3a78d0', '#6ab4f4', '#a8e0ff', '#e0f8ff', '#ffffff']
GOWN = ['#0e1e5a', '#1c3c9a', '#2c64c8', '#5a9ae8', '#9ccaff', '#d4ecff']
GOWN_W = ['#5a6aa8', '#8c9cd4', '#bccaf0', '#e4ecfc', '#f8fbff', '#ffffff']
I_SKIN = ['#8a5a6a', '#c88c90', '#f0bca8', '#ffdcc8', '#fff0e6']


def crystal(p, x, y, h, w, R, lean=0.0, line='auto'):
    """Cristal de glace (losange allongé, facettes)."""
    tx, ty = x + lean * h, y - h
    pts = [(x - w / 2, y - h * 0.25), (x, y), (x + w / 2, y - h * 0.25), (tx + w * 0.15, ty + h * 0.12), (tx, ty),
           (tx - w * 0.15, ty + h * 0.12)]
    m = poly(pts)
    p.fill(m, R, rnd=2, k_p=0.6, line=line)
    p.paint(px_line([(x - w * 0.1, y - 2), (tx - w * 0.05, ty + 2)]) & m, R[-1])
    p.paint(px_line([(x + w * 0.25, y - h * 0.25), (tx + w * 0.1, ty + h * 0.15)]) & m, R[1])
    return m


def snowflake(p, x, y, r, c0=WHITE, c1='#a8e0ff', layer='front'):
    for k in range(6):
        a = k * math.pi / 3
        for i in range(1, r + 1):
            p.fxpx(x + round(math.cos(a) * i), y + round(math.sin(a) * i), c1 if i < r else c0, layer)
    p.fxpx(x, y, c0, layer)


def ice_empress():
    p = Pic('#bfe9ff')
    hx, hy = 124, 60
    # --- aura de givre (anneau tramé + éclats)
    p.fx(ring(124, 128, 98, 98, 2) & CHECK & (YY < 200), '#a8e0ff', 'back')
    for k in range(14):
        a = math.radians(-180 + k * 13)
        x, y = 124 + math.cos(a) * 104, 128 + math.sin(a) * 104
        if 6 < x < 250 and y > 6:
            p.fx(ell(x, y, 1.2, 1.2), '#e0f8ff', 'back')
    # --- cape (derrière), doublure bleue, bord de fourrure
    cape = spoly([(108, 92), (144, 92), (164, 160), (170, 236), (124, 244), (70, 242), (62, 200), (84, 140)])
    p.fill(cape, GOWN, rnd=8, bias=-0.15)
    for x0, x1 in ((96, 76), (108, 96), (152, 166)):
        fold(p, [(x0, 120), (x1, 236)], GOWN[0], GOWN[3], cape)
    # --- cheveux arrière très longs
    back = ell(hx - 4, hy - 2, 25, 26) | spoly([(hx - 28, hy), (hx + 6, hy + 6), (hx + 2, hy + 90), (hx - 18, hy + 150),
                                               (hx - 52, hy + 156), (hx - 42, hy + 70)])
    p.fill(back, dk(I_HAIR[:5]), rnd=7, tex=strands(back, 8, 0.45, 0.12), bias=0.05)
    for pts, w in (([(hx - 22, hy + 10), (hx - 36, hy + 60), (hx - 40, hy + 110), (hx - 54, hy + 160)], 15),
                   ([(hx - 10, hy + 16), (hx - 18, hy + 70), (hx - 16, hy + 120), (hx - 28, hy + 166)], 13),
                   ([(hx - 30, hy + 4), (hx - 50, hy + 50), (hx - 56, hy + 100), (hx - 68, hy + 140)], 10)):
        lock(p, pts, w, dk(I_HAIR[:5]), rnd=4, bias=0.12)
    # --- robe à crinoline
    gown = spoly([(110, 138), (144, 136), (160, 170), (180, 222), (186, 244), (66, 244), (74, 214), (96, 168)])
    p.fill(gown, GOWN, rnd=12, k_n=1.0)
    # pan central blanc (tablier) à volants
    apron = spoly([(118, 140), (138, 139), (150, 190), (158, 243), (98, 243), (106, 190)])
    p.fill(apron, GOWN_W, rnd=8)
    for x0, x1 in ((116, 108), (124, 122), (132, 136), (140, 148)):
        fold(p, [(x0, 150), (x1, 240)], GOWN_W[1], GOWN_W[4], apron)
    # volants : 3 rangées festonnées
    for k, y0 in enumerate((178, 204, 232)):
        row = gown & (YY > y0) & (YY < y0 + 7 + 3 * np.sin(XX * 0.6))
        p.paint(row & ~apron, GOWN[3])
        p.paint(row & ~apron & ~_sh(row, 0, -1), GOWN[1])
        p.paint(row & apron, GOWN_W[3])
        p.paint(row & apron & ~_sh(row, 0, -1), GOWN_W[1])
    for x0, x1 in ((90, 76), (102, 92), (152, 168), (162, 178)):
        fold(p, [(x0, 168), (x1, 240)], GOWN[1], GOWN[4], gown & ~apron)
    # ourlet argenté + cristaux
    hem = gown & ~_sh(gown, 0, -3)
    p.paint(hem, SILVER[3])
    p.paint(gown & ~_sh(gown, 0, -1), SILVER[1])
    for x in range(78, 182, 14):
        gem(p, x, 238, 1.8, ICE)
    # --- bras arrière (paume ouverte, flocon magique)
    arm(p, (106, 100), (90, 120), (82, 134), dk(GOWN), ws=(13, 11, 10, 9))
    cuff = tube([(86, 128), (80, 138)], 12)
    p.fill(cuff, GOWN_W, rnd=3)
    hand(p, 78, 138, I_SKIN, r=5.5, fist=False)
    # --- corsage
    chest = spoly([(106, 96), (126, 92), (146, 94), (148, 112), (142, 130), (138, 144), (114, 145), (110, 128), (104, 110)])
    p.fill(chest, GOWN, rnd=11, k_n=1.05)
    for cx, cy, rx, ry, R in ((117, 109, 10, 8, dk(GOWN)), (137, 108, 11, 9, GOWN)):
        p.fill(ell(cx, cy, rx, ry), R, rnd=6)
    stom = poly([(122, 116), (136, 116), (134, 140), (129, 148), (124, 140)])
    p.fill(stom, GOWN_W, rnd=4)
    for k in range(4):
        p.pset(129, 121 + k * 6, SILVER[3]); p.pset(130, 122 + k * 6, SILVER[1])
    p.paint(px_line([(108, 140), (128, 147), (146, 138)]), SILVER[3])
    p.paint(px_line([(108, 141), (128, 148), (146, 139)]), SILVER[1])
    # --- cou, collier, tête
    neck(p, hx, hy, I_SKIN, w=10)
    dec = poly([(112, 95), (128, 92), (144, 95), (128, 104)])
    p.fill(dec, I_SKIN, rnd=4, line=None)
    for k in range(5):
        gem(p, 117 + k * 5, 99 + (2 if k in (1, 3) else (4 if k == 2 else 0)), 1.6, ICE, line=SILVER[0])
    face(p, hx, hy, I_IRIS, skin=I_SKIN, mouth='calm', brow=I_HAIR[1], lash='#2a2a5a', blush=True)
    # --- cheveux avant
    top = ell(hx - 2, hy - 8, 22, 15) & (YY < hy - 2 + (XX - hx) * 0.2)
    p.fill(top, I_HAIR, rnd=7, tex=strands(top, 25, 0.6, 0.1), bias=0.12)
    hair_sheen(p, top, hx - 3, hy - 3, 16, I_HAIR)
    hm = top.copy()
    for pts, w in [
        ([(hx - 8, hy - 16), (hx - 16, hy - 2), (hx - 17, hy + 16), (hx - 13, hy + 40), (hx - 18, hy + 70)], 11),
        ([(hx - 2, hy - 19), (hx - 6, hy - 6), (hx - 8, hy + 4)], 10),
        ([(hx + 5, hy - 19), (hx + 6, hy - 8), (hx + 3, hy + 2)], 9),
        ([(hx + 11, hy - 17), (hx + 14, hy - 7), (hx + 12, hy + 0)], 8),
        ([(hx + 15, hy - 14), (hx + 21, hy - 4), (hx + 22, hy + 10), (hx + 20, hy + 44), (hx + 24, hy + 62)], 8),
    ]:
        hm |= lock(p, pts, w, I_HAIR, rnd=3)
    hair_shadow(p, hm)
    # --- couronne de glace
    band = tube([(hx - 16, hy - 15), (hx - 2, hy - 20), (hx + 16, hy - 17)], 4)
    p.fill(band, SILVER, rnd=2)
    for (dx, h, w, ln) in ((-12, 12, 6, -0.25), (-5, 18, 7, -0.1), (3, 26, 8, 0.0), (11, 18, 7, 0.1), (17, 11, 5, 0.25)):
        crystal(p, hx + dx, hy - 16 - (1 if dx < 8 else 0), h, w, ICE, lean=ln)
    gem(p, hx + 3, hy - 19, 2.8, ['#0e2a8a', '#2a6ae8', '#3ac8ff', '#c4f6ff', '#ffffff'])
    # --- étole de fourrure blanche sur les épaules
    for cx, cy, rx, ry, R in ((106, 100, 13, 10, dk(GOWN_W)), (148, 99, 15, 12, GOWN_W)):
        m = ell(cx, cy, rx, ry)
        p.fill(m, R, rnd=6, tex=noise(7, 0.12))
        for k in range(6):
            a = math.radians(30 + k * 25)
            x, y = cx + math.cos(a) * (rx - 2), cy + math.sin(a) * (ry - 2)
            p.paint(px_line([(x, y), (x + 1, y + 2)]) & m, R[1])
    # --- sceptre de glace
    shaft = [(170, 242), (182, 44)]
    sm = tube(shaft, 5)
    p.fill(sm, SILVER, rnd=2)
    for t in (0.3, 0.55, 0.78):
        x = shaft[0][0] + (shaft[1][0] - shaft[0][0]) * t
        y = shaft[0][1] + (shaft[1][1] - shaft[0][1]) * t
        p.fill(ell(x, y, 4.5, 2.5), SILVER, rnd=1)
    # croissant d'argent + gros cristal
    cres = ring(182, 34, 15, 15, 3.2) & (YY > 26)
    p.fill(cres, SILVER, rnd=2)
    crystal(p, 182, 52, 40, 15, ICE, lean=0.0)
    for dx, h, ln in ((-9, 18, -0.35), (9, 18, 0.35)):
        crystal(p, 182 + dx, 46, h, 7, ICE, lean=ln)
    glow(p, ell(182, 32, 23, 23) & ~ell(182, 32, 18, 18), '#a8e0ff')
    # --- bras avant
    arm(p, (150, 104), (162, 124), (172, 136), GOWN, ws=(13, 11, 10, 9))
    cuff = tube([(166, 128), (172, 136)], 13)
    p.fill(cuff, GOWN_W, rnd=3)
    hand(p, 175, 138, I_SKIN, r=6)
    # --- magie : flocon dans la paume arrière, éclats
    glow(p, ell(76, 122, 13, 13), '#a8e0ff', 'front')
    for (x, y, r) in ((76, 120, 6), (212, 92, 4), (40, 70, 4), (220, 190, 3), (34, 170, 3), (200, 22, 3), (60, 214, 2)):
        snowflake(p, x, y, r)
    for (x, y) in ((96, 110), (66, 100), (226, 140), (190, 120), (52, 130)):
        p.sparkle(x, y, ['#ffffff', '#a8e0ff'], 1)
    return p


# ================================================================ 4. SEIGNEUR DE L'OMBRE (SSR)

S_ARM = ['#0e0a1c', '#1c1730', '#2e2850', '#4a4276', '#736ca4', '#aaa4d8']
S_CAPE = ['#0c0616', '#1a0c2e', '#2e1648', '#4a2470', '#6a3a98']
VIO = ['#2a0a5a', '#5a1ab0', '#8a3aff', '#b878ff', '#e4c4ff', '#ffffff']
SHADOW_FX = ['#1a0630', '#3a0c70', '#6a1ad0', '#9a50ff', '#d0a8ff', '#ffffff']


def fur_mantle(p, pts, R, seed=0, tuft=5):
    """Fourrure : masse + touffes pointues sur le bord inférieur."""
    m = spoly(pts)
    ys, xs = np.nonzero(m & ~_sh(m, 0, -1))
    rr = random.Random(seed)
    tufts = empty()
    for i in range(0, len(xs), 3):
        x, y = xs[i], ys[i]
        if y < np.nonzero(m)[0].mean():
            continue
        tufts |= tube([(x, y - 2), (x + rr.uniform(-2, 1), y + rr.uniform(3, tuft))], [4, 1])
    m = m | tufts
    p.fill(m, R, rnd=4, tex=noise(seed + 11, 0.14))
    for i in range(0, len(xs), 4):
        x, y = xs[i], ys[i]
        p.paint(px_line([(x, y - 6), (x - 1, y - 2)]) & m, R[1])
    return m


def plate(p, pts, R, trim=None, rnd=5, bias=0.0, trim_w=2, line='auto'):
    m = spoly(pts)
    p.fill(m, R, rnd=rnd, bias=bias, line=line)
    if trim:
        b = m & ~(_sh(m, 0, -trim_w))
        p.paint(b, trim[0])
        p.paint(m & ~_sh(m, 0, -1), trim[1] if len(trim) > 1 else trim[0])
    return m


def shadow_lord():
    p = Pic('#a855ff')
    hx, hy = 126, 62
    # --- volutes d'ombre au sol (arrière)
    for i, (x, h) in enumerate(((58, 34), (86, 48), (178, 44), (206, 28), (36, 18), (226, 16))):
        flame_fx(p, x, 244, h, 12, seed=i, R=SHADOW_FX[:5], layer='back', sway=0.3)
    # --- cape en lambeaux
    cape = spoly([(112, 92), (146, 92), (150, 140), (160, 200), (150, 236), (140, 226), (128, 244), (116, 228),
                  (100, 242), (88, 222), (68, 238), (62, 210), (44, 222), (54, 180), (76, 130), (96, 100)])
    p.fill(cape, S_CAPE, rnd=9, k_p=0.4, bias=-0.22)
    for x0, x1 in ((96, 66), (106, 90), (116, 112), (140, 150)):
        fold(p, [(x0, 110), (x1, 226)], S_CAPE[0], S_CAPE[3], cape)
    p.paint(cape & ~_sh(cape, 0, -2) & (YY > 170), VIO[1])
    p.paint(cape & ~_sh(cape, 0, -1) & (YY > 170), VIO[2])
    # --- panache violet (derrière le heaume)
    for pts, w, R in (([(hx - 4, hy - 20), (hx - 22, hy - 24), (hx - 40, hy - 14), (hx - 52, hy + 6), (hx - 62, hy + 26)], 14, dk(VIO[:5])),
                      ([(hx - 2, hy - 20), (hx - 18, hy - 30), (hx - 36, hy - 26), (hx - 54, hy - 12), (hx - 70, hy - 4)], 11, VIO[:5])):
        lock(p, pts, w, R, rnd=4)
    # --- bras arrière : gantelet, flamme d'ombre
    arm(p, (102, 100), (88, 122), (84, 140), dk(S_ARM), ws=(16, 13, 13, 12))
    gl = tube([(88, 126), (84, 142)], 15)
    p.fill(gl, dk(S_ARM), rnd=4)
    hand(p, 84, 146, dk(S_ARM), r=7)
    # --- jambes
    leg(p, (116, 170), (110, 200), (104, 228), dk(S_ARM), ws=(22, 17, 14, 15, 12))
    leg(p, (140, 170), (150, 200), (154, 230), S_ARM, ws=(23, 18, 15, 16, 12))
    boot(p, (110, 202), (104, 230), 18, dk(S_ARM), ws=(17, 15, 14), sole=OUT)
    bm = boot(p, (150, 202), (154, 232), 20, S_ARM, ws=(18, 16, 15), sole=OUT)
    for kx, ky, R in ((110, 199, dk(S_ARM)), (150, 199, S_ARM)):
        km = spoly([(kx - 9, ky - 3), (kx, ky - 9), (kx + 9, ky - 3), (kx + 6, ky + 6), (kx - 6, ky + 6)])
        p.fill(km, R, rnd=3)
        sp_ = poly([(kx + 4, ky - 6), (kx + 14, ky - 12), (kx + 8, ky + 1)])
        p.fill(sp_, R, rnd=2)
        p.pset(kx, ky - 1, VIO[3]); p.pset(kx + 1, ky - 1, VIO[2])
    for y0 in (214, 222):
        p.paint(px_line([(144, y0), (162, y0 - 2)]) & bm, S_ARM[0])
        p.paint(px_line([(144, y0 + 1), (162, y0 - 1)]) & bm, S_ARM[4])
    # --- tassettes
    for i, pts in enumerate(([(102, 148), (122, 150), (120, 184), (98, 178)],
                             [(118, 150), (140, 150), (142, 188), (118, 186)],
                             [(136, 148), (156, 146), (166, 180), (142, 186)])):
        R = S_ARM if i else dk(S_ARM)
        m = plate(p, pts, R, trim=(VIO[1], VIO[2]), rnd=4)
        for k in (1, 2):
            yk = pts[0][1] + k * 11
            p.paint(px_line([(pts[0][0] - 2, yk), (pts[1][0] + 4, yk + (2 if i == 2 else 0))]) & m, R[0])
            p.paint(px_line([(pts[0][0] - 2, yk + 1), (pts[1][0] + 4, yk + 1 + (2 if i == 2 else 0))]) & m, R[3])
    # --- cuirasse
    chest = spoly([(98, 94), (126, 87), (154, 91), (160, 110), (152, 134), (146, 152), (110, 154), (102, 134), (94, 112)])
    p.fill(chest, S_ARM, rnd=13, k_n=1.15, k_p=0.32)
    fold(p, [(134, 92), (131, 120), (128, 150)], S_ARM[1], S_ARM[4], chest)
    for y0 in (134, 143):
        p.paint(px_line([(104, y0 + 2), (128, y0), (150, y0 - 3)]) & chest, S_ARM[0])
        p.paint(px_line([(104, y0 + 3), (128, y0 + 1), (150, y0 - 2)]) & chest, S_ARM[4])
    engrave(p, chest & (YY < 128), S_ARM, step=7, seed=9)
    # rune-cœur violette
    core = poly([(129, 104), (137, 114), (129, 126), (121, 114)])
    p.fill(core, VIO, rnd=3, line=OUT, bias=0.15)
    p.paint(px_line([(129, 107), (129, 123)]), VIO[5])
    p.paint(px_line([(124, 114), (134, 114)]), VIO[4])
    glow(p, ell(129, 114, 15, 15) & ~ell(129, 114, 10, 12), VIO[3], 'front')
    for x0 in (112, 146):
        p.paint(px_line([(x0, 102), (x0 + (6 if x0 < 129 else -6), 118)]) & chest, VIO[2])
    rivets(p, [(104, 104), (152, 100), (108, 146), (146, 144)], S_ARM)
    # --- gorgerin + heaume
    gorg = spoly([(110, 84), (142, 82), (146, 94), (128, 100), (108, 94)])
    p.fill(gorg, S_ARM, rnd=4)
    p.paint(gorg & ~_sh(gorg, 0, -2), VIO[1])
    # cornes (arrière)
    HORN_S = S_ARM[:4] + [VIO[3]]
    horn(p, [(hx - 10, hy - 12), (hx - 22, hy - 22), (hx - 28, hy - 38), (hx - 22, hy - 47)], 10, dk(HORN_S))
    helm = spoly([(hx - 19, hy - 2), (hx - 15, hy - 17), (hx - 2, hy - 24), (hx + 12, hy - 21), (hx + 20, hy - 9),
                  (hx + 22, hy + 8), (hx + 16, hy + 22), (hx + 2, hy + 26), (hx - 12, hy + 22), (hx - 19, hy + 12)])
    p.fill(helm, S_ARM, rnd=10, k_n=1.1)
    crest = tube([(hx + 6, hy - 25), (hx - 4, hy - 22), (hx - 14, hy - 10), (hx - 18, hy + 4)], [6, 7, 6, 4])
    p.fill(crest, S_ARM, rnd=3, bias=0.15)
    cheek = spoly([(hx - 8, hy + 6), (hx + 4, hy + 4), (hx + 6, hy + 24), (hx - 6, hy + 24)])
    p.fill(cheek, S_ARM, rnd=4, bias=-0.05)
    rivets(p, [(hx - 4, hy + 10), (hx - 3, hy + 18)], S_ARM)
    mask = spoly([(hx + 2, hy - 12), (hx + 20, hy - 10), (hx + 27, hy + 2), (hx + 24, hy + 16), (hx + 12, hy + 26),
                  (hx + 3, hy + 22)])
    p.fill(mask, S_ARM, rnd=6, bias=0.1, k_p=0.4)
    p.paint(px_line([(hx + 4, hy - 10), (hx + 20, hy - 8)]) & mask, S_ARM[5])
    # fente en T lumineuse + yeux
    vy = hy + 2
    slit = poly([(hx + 4, vy - 2), (hx + 23, vy - 2), (hx + 23, vy + 2), (hx + 4, vy + 2)]) | \
        poly([(hx + 13, vy), (hx + 16, vy), (hx + 16, vy + 16), (hx + 13, vy + 16)])
    p.paint(slit & mask, OUT)
    for (ex, ew) in ((hx + 6, 5), (hx + 18, 4)):
        for k in range(ew):
            p.pset(ex + k, vy, VIO[4] if 0 < k < ew - 1 else VIO[2])
            p.pset(ex + k, vy - 1, VIO[2] if 0 < k < ew - 1 else VIO[1])
        p.pset(ex + 1, vy, VIO[5]); p.pset(ex + 2, vy, VIO[5])
    for k in range(5):
        p.pset(hx + 6 + k * 3, vy + 9, S_ARM[0])  # trous de respiration
        p.pset(hx + 6 + k * 3, vy + 12, S_ARM[0]) if k < 3 else None
    glow(p, ell(hx + 12, vy, 14, 4) & ~mask, VIO[3], 'front')
    horn(p, [(hx + 6, hy - 18), (hx + 16, hy - 30), (hx + 18, hy - 40), (hx + 12, hy - 50)], 11, HORN_S)
    # --- épaulières superposées à pointes
    for (cx, cy, R, fl) in ((100, 100, dk(S_ARM), -1), (156, 100, S_ARM, 1)):
        for k in range(3):
            m = ell(cx + fl * k * 2, cy + 6 - k * 6, 16 - k * 2, 9, fl * 14)
            p.fill(m, R, rnd=5)
            p.paint(m & ~_sh(m, 0, -2), VIO[1])
        for k in range(2):
            spk = poly([(cx + fl * (k * 7 - 4), cy - 10), (cx + fl * (6 + k * 8), cy - 26 + k * 8), (cx + fl * (k * 7 + 4), cy - 8)])
            p.fill(spk, R, rnd=2)
    # --- espadon
    P = sword(p, (172, 146), (216, 24), S_ARM, S_ARM, S_CAPE, VIO, width=16, guard_w=34, glow_c=VIO[3], fuller=False)
    for t in range(18, 120, 6):
        p.paint(ell(*P(t, 0), 1.3, 1.3), VIO[3] if t % 12 else VIO[4])
    p.paint(px_line([P(14, 0), P(124, 0)]), VIO[2])
    for t in range(14, 118, 9):
        p.pset(*P(t, 0), VIO[4])
    edge_l = px_line([P(12, -6.5), P(116, -5.5)])
    p.paint(edge_l, S_ARM[5])
    # --- bras avant
    arm(p, (156, 106), (166, 126), (172, 140), S_ARM, ws=(16, 13, 13, 12))
    gl = tube([(166, 128), (172, 142)], 15)
    p.fill(gl, S_ARM, rnd=4)
    p.paint(gl & ~_sh(gl, 0, -2), VIO[2])
    hand(p, 174, 147, S_ARM, r=7)
    # --- flamme d'ombre dans la main arrière + particules
    flame_fx(p, 84, 140, 30, 13, seed=3, R=SHADOW_FX)
    for (x, y) in ((60, 60), (40, 110), (210, 120), (196, 190), (228, 70), (30, 160), (70, 20), (180, 60), (236, 150)):
        p.fxpx(x, y, VIO[4]); p.fxpx(x + 1, y, VIO[2]); p.fxpx(x, y + 1, VIO[2])
    for (x, y) in ((50, 140), (220, 210), (100, 30)):
        p.sparkle(x, y, [VIO[5], VIO[3]], 1)
    return p


# ================================================================ 5. GARDIENNE SYLVESTRE (SSR)

G_HAIR = ['#0a3a40', '#0f6a66', '#1ea488', '#3ed0a4', '#86f0c8', '#d4fff0']
G_IRIS = ['#0f4a3a', '#1ea06a', '#a8ffb0']
LEAF = ['#0e3018', '#1a5a24', '#2e8a2e', '#58b83e', '#96e060', '#d0f890']
ANTLER = ['#3a1e10', '#6a3e20', '#9a6a3a', '#c89a62', '#f0d4a0']
ORB = ['#0a3a2a', '#14805a', '#3ad08a', '#8af0b8', '#d8ffe8', '#ffffff']
FLOWER = ['#a02a6a', '#e0559a', '#ff8ac0', '#ffc8e2', '#fff0f8']
G_SKIN = ['#8a4e44', '#c8846a', '#f0b48e', '#ffd6b6', '#ffece0']


def leaf(p, x, y, ang, ln, w, R, line='auto', rib=True, layer=None):
    a = math.radians(ang)
    ca, sa = math.cos(a), math.sin(a)
    nx, ny = -sa, ca
    pts = [(x, y), (x + ca * ln * 0.35 + nx * w / 2, y + sa * ln * 0.35 + ny * w / 2), (x + ca * ln, y + sa * ln),
           (x + ca * ln * 0.35 - nx * w / 2, y + sa * ln * 0.35 - ny * w / 2)]
    m = spoly(pts, 0.4) | poly(pts)
    if layer:
        p.fx(m, R[2], layer)
        p.fx(m & ~_sh(m, 1, 1), R[3], layer)
        p.fx(m & ~_sh(m, -1, -1), R[1], layer)
        return m
    p.fill(m, R, rnd=2, line=line, k_p=0.5)
    if rib and ln > 8:
        p.paint(px_line([(x + ca * 2, y + sa * 2), (x + ca * ln * 0.8, y + sa * ln * 0.8)]) & m, R[-2])
    return m


def flower(p, x, y, r=3, R=FLOWER, layer=None):
    for k in range(5):
        a = k * 1.2566 - 1.57
        m = ell(x + math.cos(a) * r * 0.7, y + math.sin(a) * r * 0.7, r * 0.55, r * 0.55)
        if layer:
            p.fx(m, R[2 + (k % 2)], layer)
        else:
            p.fill(m, R, rnd=1.5)
    if layer:
        p.fxpx(x, y, '#ffe24a', layer)
    else:
        p.pset(x, y, '#ffe24a'); p.pset(x + 1, y, '#e0a020')


def antler(p, base, pts, branches, R, w=6):
    m = tube([base] + pts, [w, w * 0.85, w * 0.65, w * 0.45, 1.5])
    for (i, ang, ln) in branches:
        sp = spline([base] + pts, 0.5)
        q = sp[int(i * (len(sp) - 1))]
        a = math.radians(ang)
        m |= tube([q, (q[0] + math.cos(a) * ln * 0.6, q[1] + math.sin(a) * ln * 0.6 - 2), (q[0] + math.cos(a) * ln, q[1] + math.sin(a) * ln)],
                  [w * 0.55, w * 0.4, 1.3])
    p.fill(m, R, rnd=3)
    return m


def sylvan_guardian():
    p = Pic('#63d98a')
    hx, hy = 122, 60
    # --- halo de lucioles/feuilles (arrière)
    p.fx(ring(128, 120, 100, 100, 1.5) & CHECK & (YY < 190), '#8ef07a', 'back')
    for (x, y, a) in ((22, 60, 30), (230, 40, 120), (14, 150, -20), (238, 160, 200), (40, 20, 60)):
        leaf(p, x, y, a, 10, 5, LEAF, layer='back')
    # --- cheveux arrière : grande masse sarcelle
    back = ell(hx - 6, hy, 28, 28) | spoly([(hx - 32, hy), (hx + 8, hy + 6), (hx + 6, hy + 60), (hx - 6, hy + 120),
                                           (hx - 44, hy + 128), (hx - 50, hy + 60)])
    p.fill(back, dk(G_HAIR[:5]), rnd=8, tex=strands(back, 8, 0.45, 0.12), bias=0.05)
    for pts, w in (([(hx - 24, hy + 10), (hx - 40, hy + 50), (hx - 44, hy + 90), (hx - 56, hy + 130)], 16),
                   ([(hx - 10, hy + 18), (hx - 20, hy + 60), (hx - 16, hy + 100), (hx - 26, hy + 136)], 14),
                   ([(hx - 32, hy + 2), (hx - 54, hy + 40), (hx - 60, hy + 80), (hx - 70, hy + 106)], 11)):
        lock(p, pts, w, dk(G_HAIR[:5]), rnd=4, bias=0.12)
    for (x, y, a) in ((hx - 44, hy + 70, 120), (hx - 30, hy + 104, 70), (hx - 58, hy + 30, 160)):
        leaf(p, x, y, a, 12, 6, LEAF)
    # --- bras arrière : paume ouverte, lumière de vie
    arm(p, (106, 102), (90, 122), (84, 138), dk(G_SKIN), ws=(12, 10, 10, 9))
    vine = px_line([(92, 124), (88, 128), (86, 132), (90, 134)])
    p.paint(vine, LEAF[2])
    hand(p, 82, 142, G_SKIN, r=5.5, fist=False)
    # --- jambes + bottes de cuir lacées
    leg(p, (118, 168), (112, 200), (106, 228), dk(G_SKIN), ws=(18, 13, 11, 12, 9))
    leg(p, (136, 168), (146, 200), (150, 230), G_SKIN, ws=(19, 14, 11, 13, 9))
    boot(p, (111, 206), (106, 230), 14, dk(LEATHER), ws=(14, 12, 11), sole=LEATHER[0])
    bm = boot(p, (147, 206), (150, 232), 16, LEATHER, ws=(15, 13, 12), sole=LEATHER[0])
    for k in range(4):
        y = 210 + k * 5
        p.paint(px_line([(143, y), (153, y + 2)]) & bm, LEATHER[0])
        p.paint(px_line([(143, y + 1), (153, y + 3)]) & bm, LEATHER[3])
    for (x, y, a) in ((104, 204, -150), (144, 204, -30), (150, 204, -60)):
        leaf(p, x, y, a, 9, 5, LEAF)
    # --- jupe de feuilles : 3 étages
    for tier, (y0, n, ln, R) in enumerate(((168, 9, 26, dk(LEAF)), (156, 8, 24, LEAF), (144, 7, 20, LEAF))):
        for i in range(n):
            t = i / (n - 1)
            x = 104 - tier * -2 + t * (44 - tier * 4)
            ang = 100 - (t - 0.5) * 40
            leaf(p, x, y0 - 14, ang, ln, 11, R)
    # --- buste : corset de feuilles
    chest = spoly([(106, 96), (126, 92), (146, 94), (148, 112), (142, 130), (138, 146), (114, 147), (110, 128), (104, 110)])
    p.fill(chest, LEAF, rnd=11, k_n=1.05)
    for i, (x, y, a) in enumerate(((112, 100, 70), (122, 98, 80), (134, 98, 95), (144, 100, 110), (116, 114, 80),
                                   (128, 112, 90), (140, 114, 100), (120, 128, 85), (134, 128, 95))):
        leaf(p, x, y, a, 15, 9, LEAF if i % 2 else dk(LEAF))
    belt = spoly([(110, 140), (144, 138), (145, 145), (109, 147)])
    p.fill(belt, LEATHER, rnd=2)
    gem(p, 127, 142.5, 3, ORB)
    # --- cou + tête
    neck(p, hx, hy, G_SKIN, w=10)
    face(p, hx, hy, G_IRIS, skin=G_SKIN, mouth='smile', brow=G_HAIR[1], lash='#0a2a24', blush=True)
    # --- bois (cornes) avant de la frange
    antler(p, (hx - 8, hy - 16), [(hx - 14, hy - 30), (hx - 26, hy - 42), (hx - 40, hy - 48)],
           [(0.4, -100, 16), (0.7, -140, 12), (0.25, -170, 12)], dk(ANTLER), w=6)
    antler(p, (hx + 6, hy - 18), [(hx + 8, hy - 30), (hx + 2, hy - 42), (hx - 4, hy - 50)],
           [(0.35, -40, 16), (0.6, -70, 11), (0.85, -10, 9)], ANTLER, w=7)
    # --- cheveux avant
    top = ell(hx - 2, hy - 8, 23, 15) & (YY < hy - 2 + (XX - hx) * 0.2)
    p.fill(top, G_HAIR, rnd=7, tex=strands(top, 25, 0.6, 0.1), bias=0.15)
    hair_sheen(p, top, hx - 3, hy - 3, 16, G_HAIR)
    hm = top.copy()
    for pts, w in [
        ([(hx - 8, hy - 16), (hx - 17, hy - 2), (hx - 19, hy + 18), (hx - 15, hy + 40), (hx - 20, hy + 64)], 12),
        ([(hx - 2, hy - 19), (hx - 6, hy - 6), (hx - 8, hy + 4)], 10),
        ([(hx + 5, hy - 19), (hx + 6, hy - 8), (hx + 3, hy + 2)], 9),
        ([(hx + 11, hy - 17), (hx + 14, hy - 7), (hx + 12, hy + 0)], 8),
        ([(hx + 15, hy - 14), (hx + 21, hy - 4), (hx + 22, hy + 10), (hx + 19, hy + 30)], 7),
    ]:
        hm |= lock(p, pts, w, G_HAIR, rnd=3)
    hair_shadow(p, hm)
    # couronne de feuilles + fleurs
    for (x, y, a) in ((hx - 16, hy - 12, -150), (hx - 10, hy - 18, -120), (hx + 14, hy - 17, -60)):
        leaf(p, x, y, a, 11, 6, LEAF)
    flower(p, hx - 14, hy - 10, 4)
    flower(p, hx - 20, hy + 2, 3)
    flower(p, hx + 12, hy - 18, 3)
    # --- épaules : feuilles
    for (x, y, a, R) in ((100, 96, 160, dk(LEAF)), (104, 94, 120, dk(LEAF)), (150, 94, 20, LEAF), (146, 92, 60, LEAF)):
        leaf(p, x + 6 * (1 if a < 90 else -1), y, a, 16, 9, R)
    # --- bâton noueux + orbe de vie
    shaft = [(166, 244), (170, 180), (166, 120), (172, 64)]
    sm = tube(shaft, [7, 6, 6, 7])
    p.fill(sm, WOOD, rnd=3)
    for (y0) in (200, 160, 110, 84):
        p.paint(px_line([(162, y0), (176, y0 - 3)]) & sm, WOOD[0])
    glow(p, ell(174, 44, 22, 22) & ~ell(174, 44, 13, 13), '#8af0b8')
    orb = ell(174, 44, 11, 11)
    p.fill(orb, ORB, rnd=6, line=OUT, k_p=0.5)
    p.paint(ell(169, 39, 3, 2.5), ORB[5])
    p.paint(ell(178, 50, 3, 2) & orb, ORB[4])
    for pts in (([(172, 66), (160, 56), (160, 40), (168, 30)]), ([(172, 66), (186, 54), (188, 38), (180, 28)]),
                ([(170, 64), (176, 50), (170, 36), (176, 30)])):
        m = tube(pts, [5, 4, 3, 1.5])
        p.fill(m, WOOD, rnd=2)
    for (x, y, a) in ((158, 54, -160), (188, 48, -10), (184, 30, -60), (162, 34, -130), (176, 90, 10), (162, 140, 170)):
        leaf(p, x, y, a, 10, 6, LEAF)
    flower(p, 160, 64, 3)
    # --- bras avant
    arm(p, (148, 104), (158, 122), (164, 136), G_SKIN, ws=(12, 10, 10, 9))
    p.paint(px_line([(156, 124), (161, 128), (158, 130), (163, 133)]), LEAF[2])
    hand(p, 168, 138, G_SKIN, r=5.5)
    # --- effets avant : feuilles tourbillonnantes, lucioles, fleurs au sol
    for (x, y, a) in ((66, 120, 20), (60, 150, 140), (200, 140, -30), (214, 100, 60), (40, 100, -60), (220, 200, 30),
                      (34, 200, 110)):
        leaf(p, x, y, a, 9, 5, LEAF, layer='front')
    for (x, y) in ((82, 130), (74, 116), (90, 112), (196, 70), (50, 70), (228, 120), (26, 132), (206, 222)):
        p.sparkle(x, y, ['#f4ffd0', '#8ef07a'], 1 if (x + y) % 3 else 0)
    glow(p, ell(80, 126, 12, 12), '#b8ffd0', 'front')
    for (x, R) in ((78, FLOWER), (186, FLOWER), (96, ['#a07a10', '#e0b020', '#ffe24a', '#fff4a0', '#ffffff'])):
        for k in range(3):
            leaf(p, x + k * 4 - 4, 244, -90 - (k - 1) * 25, 10, 4, LEAF)
        flower(p, x, 234, 3, R)
    return p


# ================================================================ 6. PALADIN D'AZUR (SR)

PAL_HAIR = ['#0a0a1c', '#16163a', '#262a58', '#3c4682', '#6a78b8', '#a0b0e0']
PAL_ARM = ['#0e1a50', '#1c3a98', '#2e62d4', '#5a96f4', '#9cc8ff', '#dcf0ff']
PAL_EYE = ['#0e2a8a', '#2a6ae8', '#7ac8ff']
PAL_BLADE = ['#1c46c8', '#3a8cf6', '#8fd8ff', '#dcf6ff', '#ffffff']


def azure_paladin():
    p = Pic('#4fa3ff')
    hx, hy = 124, 60
    # --- cape courte bleu nuit
    cape = spoly([(110, 94), (144, 94), (150, 150), (138, 196), (100, 200), (84, 184), (94, 130)])
    p.fill(cape, dk(PAL_ARM), rnd=8, bias=-0.05)
    for x0, x1 in ((100, 92), (112, 108)):
        fold(p, [(x0, 120), (x1, 194)], PAL_ARM[0], PAL_ARM[2], cape)
    p.paint(cape & ~_sh(cape, 0, -3) & (YY > 160), GOLD[1])
    # --- bras arrière (tient le bouclier)
    arm(p, (106, 100), (94, 120), (90, 136), dk(PAL_ARM), ws=(14, 11, 11, 10))
    # --- jambes
    leg(p, (118, 166), (112, 198), (106, 228), dk(PAL_ARM), ws=(20, 15, 12, 14, 10))
    leg(p, (138, 166), (146, 198), (151, 230), PAL_ARM, ws=(21, 16, 13, 15, 10))
    boot(p, (112, 202), (106, 230), 15, dk(STEEL), ws=(15, 13, 12), sole=STEEL[0], cuff=dk(GOLD))
    bm = boot(p, (146, 202), (151, 232), 17, STEEL, ws=(16, 14, 13), sole=STEEL[0], cuff=GOLD)
    for kx, ky, R in ((112, 196, dk(STEEL)), (146, 196, STEEL)):
        p.fill(ell(kx, ky, 8, 6), R, rnd=3)
    fold(p, [(149, 210), (151, 228)], STEEL[1], STEEL[4], bm)
    # --- tassettes bleues, bord doré
    for i, pts in enumerate(([(106, 142), (122, 144), (120, 178), (102, 174)],
                             [(120, 144), (138, 144), (140, 180), (118, 180)],
                             [(136, 142), (150, 141), (158, 172), (142, 178)])):
        R = PAL_ARM if i else dk(PAL_ARM)
        m = plate(p, pts, R, trim=(GOLD[2], GOLD[3]), rnd=4, trim_w=3)
    # --- cuirasse
    chest = spoly([(103, 96), (126, 91), (148, 93), (152, 110), (146, 130), (140, 146), (112, 147), (107, 128), (101, 110)])
    p.fill(chest, PAL_ARM, rnd=12, k_n=1.1)
    fold(p, [(133, 96), (130, 118), (128, 144)], PAL_ARM[1], PAL_ARM[4], chest)
    # emblème doré (croix)
    em = poly([(126, 104), (131, 104), (131, 124), (126, 124)]) | poly([(120, 110), (137, 110), (137, 114), (120, 114)])
    p.fill(em & chest, GOLD, rnd=2, line=GOLD[0])
    p.paint(chest & ~_sh(chest, 0, 2) & (YY > 120), GOLD[2])
    belt = spoly([(108, 140), (146, 138), (147, 146), (107, 148)])
    p.fill(belt, LEATHER, rnd=2)
    buck = poly([(124, 139), (132, 139), (132, 147), (124, 147)])
    p.fill(buck, GOLD, rnd=2)
    # --- cou + tête
    neck(p, hx, hy, SKIN, w=12)
    gorg = spoly([(110, 90), (128, 88), (144, 90), (140, 98), (126, 100), (112, 98)])
    p.fill(gorg, PAL_ARM, rnd=3)
    p.paint(gorg & ~_sh(gorg, 0, -2), GOLD[2])
    # cheveux arrière
    back = ell(hx - 4, hy - 2, 24, 24)
    p.fill(back, dk(PAL_HAIR[:5]), rnd=6, bias=0.05)
    face(p, hx, hy, PAL_EYE, skin=SKIN, mouth='smile', brow=PAL_HAIR[1], lash='#0a0a1c', blush=False, eye_h=10, jaw=1.02)
    p.paint(px_line([(hx - 2, hy - 3), (hx + 8, hy - 4)]), PAL_HAIR[1])  # sourcils épais
    p.paint(px_line([(hx + 13, hy - 4), (hx + 18, hy - 3)]), PAL_HAIR[1])
    # cheveux en épis
    top = ell(hx - 2, hy - 8, 22, 15) & (YY < hy - 2 + (XX - hx) * 0.2)
    p.fill(top, PAL_HAIR, rnd=7, tex=strands(top, 25, 0.6, 0.1), bias=0.12)
    hm = top.copy()
    for pts, w in [
        ([(hx - 10, hy - 14), (hx - 24, hy - 20), (hx - 34, hy - 18)], 10),
        ([(hx - 6, hy - 18), (hx - 16, hy - 30), (hx - 26, hy - 34)], 10),
        ([(hx + 0, hy - 20), (hx - 4, hy - 32), (hx - 10, hy - 40)], 10),
        ([(hx - 16, hy - 6), (hx - 28, hy - 2), (hx - 34, hy + 4)], 9),
        ([(hx - 14, hy + 0), (hx - 18, hy + 12), (hx - 16, hy + 22)], 8),
        ([(hx - 2, hy - 18), (hx - 4, hy - 6), (hx - 8, hy + 2)], 9),
        ([(hx + 6, hy - 19), (hx + 6, hy - 8), (hx + 3, hy + 1)], 9),
        ([(hx + 12, hy - 17), (hx + 15, hy - 7), (hx + 12, hy + 0)], 8),
        ([(hx + 15, hy - 14), (hx + 22, hy - 6), (hx + 22, hy + 4)], 7),
    ]:
        hm |= lock(p, pts, w, PAL_HAIR, rnd=3)
    hair_shadow(p, hm)
    # diadème doré + gemme
    circ = tube([(hx - 16, hy - 8), (hx - 2, hy - 13), (hx + 20, hy - 10)], 3)
    p.fill(circ, GOLD, rnd=1)
    gem(p, hx + 6, hy - 12, 2.6, PAL_BLADE)
    # --- épaulière arrière
    p.fill(ell(104, 100, 12, 9, -20), dk(PAL_ARM), rnd=4)
    # --- bouclier rond
    scx, scy = 86, 146
    p.fill(ell(scx, scy, 24, 26), GOLD, rnd=5)
    inner = ell(scx + 1, scy, 19, 21)
    p.fill(inner, PAL_ARM, rnd=9, line=GOLD[0])
    cr = (poly([(scx - 2, scy - 20), (scx + 3, scy - 20), (scx + 3, scy + 21), (scx - 2, scy + 21)]) |
          poly([(scx - 18, scy - 2), (scx + 20, scy - 2), (scx + 20, scy + 3), (scx - 18, scy + 3)])) & inner
    p.fill(cr, GOLD, rnd=2, line=GOLD[0], bias=0.1)
    gem(p, scx + 0.5, scy + 0.5, 4, GOLD)
    rivets(p, [(scx + 22 * math.cos(a), scy + 24 * math.sin(a)) for a in np.linspace(0, 6.28, 9)[:-1]], GOLD)
    p.paint(px_line([(scx - 12, scy - 12), (scx - 7, scy - 16)]), PAL_ARM[5])
    # --- bras avant + épée
    arm(p, (148, 102), (158, 120), (164, 134), PAL_ARM, ws=(14, 11, 11, 10))
    gl = tube([(158, 122), (165, 136)], 13)
    p.fill(gl, STEEL, rnd=3)
    p.paint(gl & ~_sh(gl, 0, -2), GOLD[2])
    sword(p, (168, 140), (198, 56), PAL_BLADE, GOLD, LEATHER, PAL_BLADE, width=8, guard_w=20)
    hand(p, 168, 140, SKIN, r=6)
    for (cx, cy, rx, ry, rr) in ((150, 104, 13, 9, 15), (149, 98, 14, 9, 10)):
        m = ell(cx, cy, rx, ry, rr)
        p.fill(m, PAL_ARM, rnd=4)
        p.paint(m & ~_sh(m, 0, -2), GOLD[2])
    # --- effets discrets
    for (x, y) in ((206, 50), (214, 70), (194, 34)):
        p.sparkle(x, y, ['#ffffff', '#8fe0ff'], 1)
    return p


# ================================================================ 7. LAME ROSE (SR)

ROSE_HAIR = ['#5a0e3c', '#a42a72', '#e05aa0', '#ff8ac4', '#ffbedc', '#fff0f8']
ROSE_ARM = ['#0c0a16', '#1a1428', '#2a223e', '#3e3458', '#5a4e7e', '#8a7eb0']
ROSE_PINK = ['#6a1040', '#b8245e', '#ff4f96', '#ff8ac0', '#ffd0e6']
ROSE_EYE = ['#6a0a32', '#e0306e', '#ff9ac0']
ROSE_BLADE = ['#5a0a18', '#b01a2a', '#ff3a3a', '#ff8a70', '#ffd8c8', '#ffffff']
RIBBON = ['#5a0a14', '#a8141e', '#e02a2a', '#ff6a5a', '#ffb0a0']


def bow(p, x, y, R, s=1.0):
    for sg in (-1, 1):
        m = spoly([(x, y), (x + sg * 9 * s, y - 6 * s), (x + sg * 11 * s, y + 1 * s), (x + sg * 8 * s, y + 6 * s)])
        p.fill(m, R, rnd=2)
        p.paint(px_line([(x + sg * 2, y), (x + sg * 8 * s, y - 2 * s)]) & m, R[1])
    for sg in (-1, 1):
        t = tube([(x, y), (x + sg * 4 * s, y + 8 * s), (x + sg * 3 * s, y + 14 * s)], [4 * s, 3.5 * s, 2 * s])
        p.fill(t, R, rnd=2)
    p.fill(ell(x, y, 3 * s, 3 * s), R, rnd=1.5)


def rose_blade():
    p = Pic('#ff6fa8')
    hx, hy = 124, 60
    # --- couettes (derrière)
    for pts, w, R in (([(hx - 14, hy - 14), (hx - 34, hy - 12), (hx - 46, hy + 10), (hx - 48, hy + 44), (hx - 40, hy + 76), (hx - 48, hy + 104)], 18, dk(ROSE_HAIR[:5])),
                      ([(hx - 8, hy - 10), (hx - 26, hy + 2), (hx - 34, hy + 30), (hx - 30, hy + 62), (hx - 22, hy + 88), (hx - 30, hy + 112)], 16, ROSE_HAIR[:5])):
        lock(p, pts, [w * 0.7, w, w * 1.05, w * 0.9, w * 0.6, 2], R, rnd=5, bias=0.05)
    back = ell(hx - 4, hy - 2, 24, 25)
    p.fill(back, dk(ROSE_HAIR[:5]), rnd=6, bias=0.05)
    # --- bras arrière
    arm(p, (106, 102), (94, 122), (92, 140), dk(ROSE_ARM), ws=(12, 10, 10, 9))
    hand(p, 92, 143, SKIN, r=5)
    # --- jambes : bas sombres, bottes à revers roses
    leg(p, (118, 160), (112, 196), (106, 228), dk(ROSE_ARM), ws=(18, 13, 11, 12, 9))
    leg(p, (136, 160), (146, 196), (151, 230), ROSE_ARM, ws=(19, 14, 11, 13, 9))
    # bande de peau (cuisse) au-dessus des bas
    for (a, b_, R) in (((118, 164), (116, 172), dk(SKIN)), ((137, 164), (139, 172), SKIN)):
        p.fill(tube([a, b_], 16), R, rnd=4)
    for (a, b_) in (((116, 172), (115, 174)), ((139, 172), (140, 174))):
        p.fill(tube([a, b_], 16), ROSE_PINK, rnd=2)
    boot(p, (111, 206), (106, 230), 15, dk(ROSE_ARM), ws=(15, 12, 11), sole=OUT, cuff=dk(ROSE_PINK))
    bm = boot(p, (147, 206), (151, 232), 17, ROSE_ARM, ws=(16, 13, 12), sole=OUT, cuff=ROSE_PINK)
    fold(p, [(149, 214), (151, 228)], ROSE_ARM[0], ROSE_ARM[3], bm)
    # --- jupe plissée noire, ourlet rose
    skirt = spoly([(108, 136), (146, 134), (160, 160), (164, 172), (94, 174), (98, 158)])
    p.fill(skirt, ROSE_ARM, rnd=7)
    for x0 in range(102, 164, 7):
        fold(p, [(126 + (x0 - 126) * 0.45, 140), (x0, 172)], ROSE_ARM[0], ROSE_ARM[3], skirt)
    p.paint(skirt & ~_sh(skirt, 0, -3), ROSE_PINK[2])
    p.paint(skirt & ~_sh(skirt, 0, -1), ROSE_PINK[1])
    # --- veste-corset sombre
    chest = spoly([(104, 96), (126, 91), (148, 93), (150, 110), (144, 128), (140, 140), (112, 141), (108, 126), (102, 110)])
    p.fill(chest, ROSE_ARM, rnd=11, k_n=1.1)
    for cx, cy, rx, ry, R in ((117, 108, 10, 8, dk(ROSE_ARM)), (137, 107, 11, 9, ROSE_ARM)):
        p.fill(ell(cx, cy, rx, ry), R, rnd=6)
    p.paint(px_line([(129, 96), (128, 140)]), ROSE_PINK[2])
    p.paint(px_line([(130, 96), (129, 140)]), ROSE_PINK[1])
    for k in range(4):
        p.pset(127, 116 + k * 6, GOLD[3]); p.pset(131, 116 + k * 6, GOLD[3])
    corset = poly([(110, 128), (146, 126), (142, 141), (112, 142)])
    p.paint(corset & chest, ROSE_PINK[1])
    p.paint(px_line([(110, 128), (146, 126)]) & chest, ROSE_PINK[3])
    for k in range(5):
        p.paint(px_line([(116 + k * 6, 130), (118 + k * 6, 139)]) & chest, ROSE_PINK[0])
    # --- cou + col + tête
    neck(p, hx, hy, SKIN, w=10)
    collar = spoly([(110, 90), (118, 84), (126, 94), (134, 84), (144, 90), (138, 98), (114, 98)])
    p.fill(collar, ROSE_ARM, rnd=3)
    p.paint(collar & ~_sh(collar, 0, -2), ROSE_PINK[2])
    face(p, hx, hy, ROSE_EYE, skin=SKIN, mouth='smile', brow=ROSE_HAIR[1], lash='#3a0a22', blush=True)
    top = ell(hx - 2, hy - 8, 22, 15) & (YY < hy - 2 + (XX - hx) * 0.2)
    p.fill(top, ROSE_HAIR, rnd=7, tex=strands(top, 25, 0.6, 0.1), bias=0.15)
    hair_sheen(p, top, hx - 3, hy - 3, 16, ROSE_HAIR)
    hm = top.copy()
    for pts, w in [
        ([(hx - 8, hy - 16), (hx - 16, hy - 2), (hx - 17, hy + 14), (hx - 14, hy + 26)], 10),
        ([(hx - 2, hy - 19), (hx - 6, hy - 6), (hx - 8, hy + 4)], 10),
        ([(hx + 5, hy - 19), (hx + 6, hy - 8), (hx + 3, hy + 2)], 9),
        ([(hx + 11, hy - 17), (hx + 14, hy - 7), (hx + 12, hy + 0)], 8),
        ([(hx + 15, hy - 14), (hx + 21, hy - 4), (hx + 22, hy + 8), (hx + 19, hy + 22)], 7),
    ]:
        hm |= lock(p, pts, w, ROSE_HAIR, rnd=3)
    hair_shadow(p, hm)
    bow(p, hx - 14, hy - 16, RIBBON, 1.0)
    # --- épaulière à pointe
    m = ell(150, 100, 13, 9, 15)
    p.fill(m, ROSE_ARM, rnd=4)
    p.paint(m & ~_sh(m, 0, -2), ROSE_PINK[2])
    spk = poly([(142, 96), (156, 86), (152, 98)])
    p.fill(spk, ROSE_ARM, rnd=2)
    # --- épée rouge tenue basse
    P = sword(p, (166, 142), (228, 222), ROSE_BLADE, ROSE_PINK, ROSE_ARM, GOLD, width=9, guard_w=20, glow_c='#ff6a6a')
    arm(p, (150, 104), (160, 124), (164, 138), ROSE_ARM, ws=(13, 10, 10, 9))
    cuff = tube([(160, 128), (164, 138)], 12)
    p.fill(cuff, ROSE_ARM, rnd=3)
    p.paint(cuff & ~_sh(cuff, 0, -2), ROSE_PINK[2])
    hand(p, 166, 142, SKIN, r=5.5)
    # --- pétales
    for (x, y) in ((206, 120), (60, 190), (214, 160), (40, 140), (196, 94)):
        p.fxpx(x, y, ROSE_PINK[3]); p.fxpx(x + 1, y, ROSE_PINK[2]); p.fxpx(x + 1, y + 1, ROSE_PINK[1])
    return p


# ================================================================ 8. SORCIÈRE (SR)

WIT_HAIR = ['#4a4878', '#7c7eb0', '#b0b4dc', '#dadcf4', '#f2f4ff', '#ffffff']
WIT_HAT = ['#160830', '#2e1460', '#4c248e', '#6e3cc0', '#9a6ae6', '#c8a8ff']
WIT_DRESS = ['#200a34', '#421a68', '#68309c', '#9254cc', '#bc8aec', '#e0c4ff']
WIT_EYE = ['#4a0a7a', '#a040f0', '#e0a8ff']
WIT_ORB = ['#2a0a5a', '#6a22c0', '#a852ff', '#d8a0ff', '#f6e4ff', '#ffffff']


def witch():
    p = Pic('#b05cff')
    hx, hy = 122, 70
    # --- longue chevelure argentée (dos)
    back = ell(hx - 4, hy - 2, 25, 25) | spoly([(hx - 28, hy), (hx + 4, hy + 6), (hx + 2, hy + 60), (hx - 10, hy + 106),
                                               (hx - 40, hy + 110), (hx - 40, hy + 50)])
    p.fill(back, dk(WIT_HAIR[:5]), rnd=7, tex=strands(back, 8, 0.45, 0.12), bias=0.1)
    for pts, w in (([(hx - 22, hy + 8), (hx - 34, hy + 50), (hx - 36, hy + 90), (hx - 46, hy + 118)], 14),
                   ([(hx - 10, hy + 14), (hx - 18, hy + 56), (hx - 16, hy + 96), (hx - 24, hy + 124)], 12)):
        lock(p, pts, w, dk(WIT_HAIR[:5]), rnd=4, bias=0.15)
    # --- bras arrière
    arm(p, (106, 110), (94, 130), (96, 148), dk(WIT_DRESS), ws=(13, 11, 12, 12))
    hand(p, 99, 152, SKIN, r=5)
    # --- robe longue
    dress = spoly([(108, 140), (142, 138), (154, 170), (166, 220), (170, 242), (84, 242), (88, 214), (100, 170)])
    p.fill(dress, WIT_DRESS, rnd=10)
    for x0, x1 in ((108, 96), (118, 112), (128, 128), (138, 146), (146, 160)):
        fold(p, [(x0, 150), (x1, 238)], WIT_DRESS[1], WIT_DRESS[3], dress)
    hem = dress & ~_sh(dress, 0, -4)
    p.paint(hem, GOLD[2])
    p.paint(dress & ~_sh(dress, 0, -1), GOLD[0])
    p.paint(hem & ~_sh(hem, 0, 1), GOLD[3])
    # pointes de bottines
    for (x, R) in ((98, dk(WIT_HAT)), (150, WIT_HAT)):
        m = spoly([(x - 6, 238), (x + 10, 237), (x + 16, 242), (x + 14, 245), (x - 6, 245)])
        m &= YY < 245
        p.fill(m, R, rnd=2)
    # --- buste
    chest = spoly([(106, 104), (126, 100), (146, 102), (148, 118), (142, 134), (140, 146), (112, 147), (108, 132), (104, 118)])
    p.fill(chest, WIT_DRESS, rnd=11, k_n=1.05)
    for cx, cy, rx, ry, R in ((117, 116, 9, 7, dk(WIT_DRESS)), (136, 115, 10, 8, WIT_DRESS)):
        p.fill(ell(cx, cy, rx, ry), R, rnd=6)
    belt = spoly([(108, 136), (144, 134), (145, 142), (107, 144)])
    p.fill(belt, WIT_HAT, rnd=2)
    buck = poly([(124, 134), (132, 134), (132, 143), (124, 143)])
    p.fill(buck, GOLD, rnd=2)
    p.paint(ell(128, 138.5, 1.8, 2) , WIT_HAT[1])
    # --- cou + col blanc
    neck(p, hx, hy, SKIN, w=10)
    collar = spoly([(110, 100), (126, 96), (142, 98), (138, 106), (126, 110), (114, 106)])
    p.fill(collar, ['#8a8ab8', '#c4c6e8', '#eceef8', '#ffffff'], rnd=3)
    gem(p, 126, 106, 2.4, WIT_ORB)
    face(p, hx, hy, WIT_EYE, skin=SKIN, mouth='smirk', brow=WIT_HAIR[1], lash='#2a1040', blush=True)
    hm = empty()
    for pts, w in [
        ([(hx - 10, hy - 14), (hx - 17, hy - 2), (hx - 18, hy + 16), (hx - 14, hy + 40), (hx - 18, hy + 66)], 11),
        ([(hx - 2, hy - 16), (hx - 6, hy - 6), (hx - 8, hy + 4)], 10),
        ([(hx + 5, hy - 16), (hx + 6, hy - 6), (hx + 3, hy + 2)], 9),
        ([(hx + 11, hy - 15), (hx + 14, hy - 6), (hx + 12, hy + 0)], 8),
        ([(hx + 15, hy - 13), (hx + 21, hy - 4), (hx + 22, hy + 10), (hx + 20, hy + 34)], 7),
    ]:
        hm |= lock(p, pts, w, WIT_HAIR, rnd=3)
    hair_shadow(p, hm)
    # --- chapeau pointu
    brim = ell(hx + 2, hy - 15, 40, 9, -4)
    p.fill(brim, WIT_HAT, rnd=5, bias=0.05)
    cone = spoly([(hx - 20, hy - 16), (hx + 22, hy - 18), (hx + 12, hy - 36), (hx + 4, hy - 46), (hx + 14, hy - 56),
                  (hx + 24, hy - 54), (hx - 2, hy - 58), (hx - 10, hy - 42)])
    p.fill(cone, WIT_HAT, rnd=8)
    fold(p, [(hx - 4, hy - 22), (hx + 2, hy - 46)], WIT_HAT[1], WIT_HAT[4], cone)
    band = cone & (YY > hy - 26) & (YY < hy - 19)
    p.paint(band, GOLD[2])
    p.paint(band & ~_sh(band, 0, -1), GOLD[1])
    p.paint(band & ~_sh(band, 0, 1), GOLD[3])
    star = poly([(hx + 2, hy - 30), (hx + 4, hy - 25), (hx + 9, hy - 24), (hx + 5, hy - 21), (hx + 6, hy - 16),
                 (hx + 2, hy - 19), (hx - 2, hy - 16), (hx - 1, hy - 21), (hx - 5, hy - 24), (hx, hy - 25)])
    p.fill(star, GOLD, rnd=1.5, line=GOLD[0])
    # --- bâton + orbe
    shaft = [(168, 244), (172, 70)]
    sm = tube(shaft, 6)
    p.fill(sm, WOOD, rnd=2)
    for y0 in (210, 170, 120, 96):
        p.paint(px_line([(165, y0), (176, y0 - 2)]) & sm, WOOD[0])
    mount = tube([(172, 72), (172, 62)], 10) | (ring(172, 50, 11, 11, 3) & (YY > 46))
    p.fill(mount, GOLD, rnd=2)
    glow(p, ell(172, 48, 20, 20) & ~ell(172, 48, 12, 12), '#b878ff')
    orb = ell(172, 48, 9, 9)
    p.fill(orb, WIT_ORB, rnd=5, line=OUT, k_p=0.5)
    p.paint(ell(168, 44, 2.5, 2), WHITE)
    # --- bras avant
    arm(p, (148, 110), (158, 128), (166, 140), WIT_DRESS, ws=(13, 11, 12, 13))
    cuff = tube([(162, 134), (167, 142)], 15)
    p.fill(cuff, WIT_DRESS, rnd=3)
    p.paint(cuff & ~_sh(cuff, 0, -2), GOLD[2])
    hand(p, 170, 142, SKIN, r=5.5)
    for (x, y) in ((196, 40), (190, 74), (150, 40)):
        p.sparkle(x, y, ['#ffffff', '#b878ff'], 1)
    return p


# ================================================================ 9. ARCHÈRE ELFE (SR)

ELF_HAIR = ['#7a4a14', '#c08a2a', '#ecbe4a', '#ffe082', '#fff4c0', '#fffcec']
ELF_LEA = ['#2a140c', '#542c16', '#844c26', '#b0763e', '#d8a464', '#f4d098']
ELF_GRN = ['#0c3420', '#186030', '#2e963c', '#5ec850', '#a4ec80', '#dcffc0']
ELF_EYE = ['#0a4a2a', '#22b050', '#9af0a0']


def elf_archer():
    p = Pic('#7fe07a')
    hx, hy = 124, 60
    # --- carquois dans le dos
    q = tube([(100, 92), (90, 150)], [14, 13])
    p.fill(q, LEATHER, rnd=4)
    p.paint(q & ~_sh(q, 0, 2) & (YY < 100), GOLD[2])
    for k, (dx, c) in enumerate(((-4, ELF_GRN), (2, ELF_GRN), (-1, ['#6a1a1a', '#b03030', '#e86060', '#ffb0a0']))):
        sh = tube([(100 + dx, 94), (106 + dx, 72)], 2)
        p.fill(sh, WOOD, rnd=1)
        fl = poly([(106 + dx, 72), (103 + dx, 78), (106 + dx, 64), (109 + dx, 76)])
        p.fill(fl, c, rnd=1)
    # --- cheveux arrière (longs, blonds)
    back = ell(hx - 4, hy - 2, 25, 25) | spoly([(hx - 28, hy), (hx + 4, hy + 6), (hx + 2, hy + 50), (hx - 14, hy + 84),
                                               (hx - 38, hy + 84), (hx - 36, hy + 40)])
    p.fill(back, dk(ELF_HAIR[:5]), rnd=7, tex=strands(back, 8, 0.45, 0.12), bias=0.1)
    for pts, w in (([(hx - 22, hy + 8), (hx - 32, hy + 40), (hx - 32, hy + 72), (hx - 40, hy + 96)], 13),
                   ([(hx - 10, hy + 14), (hx - 16, hy + 46), (hx - 12, hy + 78), (hx - 18, hy + 100)], 11)):
        lock(p, pts, w, dk(ELF_HAIR[:5]), rnd=4, bias=0.15)
    # --- bras arrière : tire la corde (main près de l'épaule)
    arm(p, (106, 102), (118, 116), (140, 112), dk(ELF_GRN), ws=(11, 9, 9, 8))
    bracer = tube([(126, 116), (138, 113)], 10)
    p.fill(bracer, dk(ELF_LEA), rnd=3)
    # --- jambes : collants verts, bottes de cuir
    leg(p, (118, 162), (112, 198), (106, 228), dk(ELF_GRN), ws=(18, 13, 11, 12, 9))
    leg(p, (136, 162), (146, 198), (151, 230), ELF_GRN, ws=(19, 14, 11, 13, 9))
    boot(p, (112, 200), (106, 230), 14, dk(ELF_LEA), ws=(15, 12, 11), sole=ELF_LEA[0], cuff=dk(ELF_LEA))
    bm = boot(p, (147, 200), (151, 232), 16, ELF_LEA, ws=(16, 13, 12), sole=ELF_LEA[0], cuff=ELF_LEA)
    for k in range(4):
        y = 208 + k * 5
        p.paint(px_line([(143, y), (154, y + 2)]) & bm, ELF_LEA[1])
    # --- jupette verte à pans
    skirt = spoly([(108, 140), (146, 138), (156, 160), (160, 176), (150, 170), (140, 178), (128, 170), (116, 178),
                   (104, 170), (96, 174), (100, 156)])
    p.fill(skirt, ELF_GRN, rnd=7)
    for x0 in (112, 124, 136, 148):
        fold(p, [(126 + (x0 - 126) * 0.5, 146), (x0, 172)], ELF_GRN[1], ELF_GRN[3], skirt)
    # --- tunique de cuir (gilet) sur chemise verte
    chest = spoly([(106, 96), (126, 91), (146, 93), (148, 110), (142, 128), (140, 142), (112, 143), (108, 126), (102, 110)])
    p.fill(chest, ELF_GRN, rnd=11, k_n=1.05)
    vest = spoly([(106, 98), (122, 94), (128, 116), (124, 142), (112, 143), (108, 126), (102, 110)]) | \
        spoly([(134, 94), (146, 94), (148, 110), (142, 128), (140, 142), (132, 142), (136, 116)])
    p.fill(vest & chest, ELF_LEA, rnd=7, line=ELF_LEA[0])
    for k in range(4):
        p.pset(126 + k % 2, 104 + k * 8, GOLD[3])
    p.fill(ell(116, 108, 8, 6) & vest, ELF_LEA, rnd=4)
    belt = spoly([(108, 136), (146, 134), (147, 142), (107, 144)])
    p.fill(belt, dk(ELF_LEA), rnd=2)
    p.fill(poly([(126, 134), (133, 134), (133, 143), (126, 143)]), GOLD, rnd=2)
    strap = tube([(108, 98), (146, 136)], 4)
    p.fill(strap & ~belt, dk(ELF_LEA), rnd=1)
    # --- cou + tête
    neck(p, hx, hy, SKIN, w=10)
    face(p, hx, hy, ELF_EYE, skin=SKIN, mouth='smile', brow=ELF_HAIR[1], lash='#2a1a0a', blush=True, ear='elf')
    top = ell(hx - 2, hy - 8, 22, 15) & (YY < hy - 2 + (XX - hx) * 0.2)
    p.fill(top, ELF_HAIR, rnd=7, tex=strands(top, 25, 0.6, 0.1), bias=0.15)
    hair_sheen(p, top, hx - 3, hy - 3, 16, ELF_HAIR)
    hm = top.copy()
    for pts, w in [
        ([(hx - 8, hy - 16), (hx - 16, hy - 4), (hx - 17, hy + 8)], 10),
        ([(hx - 2, hy - 19), (hx - 6, hy - 6), (hx - 8, hy + 4)], 10),
        ([(hx + 5, hy - 19), (hx + 6, hy - 8), (hx + 3, hy + 2)], 9),
        ([(hx + 11, hy - 17), (hx + 14, hy - 7), (hx + 12, hy + 0)], 8),
        ([(hx + 15, hy - 14), (hx + 21, hy - 4), (hx + 22, hy + 10), (hx + 20, hy + 36)], 7),
    ]:
        hm |= lock(p, pts, w, ELF_HAIR, rnd=3)
    hair_shadow(p, hm)
    elf_ear(p, hx, hy, SKIN)
    # bandeau de feuilles
    circ = tube([(hx - 18, hy - 10), (hx - 4, hy - 16), (hx + 18, hy - 13)], 3)
    p.fill(circ, ELF_GRN, rnd=1)
    for (x, y, a) in ((hx - 12, hy - 14, -130), (hx - 8, hy - 16, -60), (hx + 4, hy - 17, -100)):
        leaf(p, x, y, a, 9, 5, ELF_GRN)
    # --- arc long (main avant tendue)
    bx = 176
    bow_m = tube([(bx - 14, 30), (bx - 2, 60), (bx + 4, 112), (bx - 2, 164), (bx - 14, 196)], [3, 6, 7, 6, 3])
    p.fill(bow_m, WOOD, rnd=2)
    for y0 in (60, 164):
        p.paint(px_line([(bx - 6, y0), (bx + 3, y0 + 2)]) & bow_m, GOLD[2])
    string = px_line([(bx - 14, 30), (140, 112), (bx - 14, 196)], 0.3)
    p.paint(string, '#e8e0d0', only=False)
    p.rimok[string] = False
    arrow = tube([(140, 112), (196, 110)], 2)
    p.fill(arrow, WOOD, rnd=1)
    head = poly([(196, 106), (206, 110), (196, 114)])
    p.fill(head, STEEL, rnd=1)
    for k in range(2):
        fl = poly([(140 + k * 4, 112), (144 + k * 4, 106), (150 + k * 4, 111)])
        p.fill(fl, ELF_GRN, rnd=1)
    # bras avant tendu vers l'arc
    arm(p, (148, 102), (162, 108), (174, 112), ELF_GRN, ws=(12, 10, 9, 8))
    bracer = tube([(162, 109), (172, 112)], 10)
    p.fill(bracer, ELF_LEA, rnd=3)
    hand(p, 177, 112, SKIN, r=5)
    hand(p, 142, 112, dk(SKIN), r=5)
    sh_ = spoly([(140, 94), (152, 92), (158, 100), (150, 104), (142, 102)])
    p.fill(sh_, ELF_LEA, rnd=3)
    for (x, y) in ((212, 98), (214, 124), (34, 70)):
        p.sparkle(x, y, ['#ffffff', '#9cff8a'], 0 if x < 100 else 1)
    leaf(p, 222, 150, 30, 8, 4, ELF_GRN, layer='front')
    leaf(p, 40, 180, -40, 8, 4, ELF_GRN, layer='front')
    return p


# ================================================================ 10. GRAND PRÊTRE (SR)

PRI_HAIR = ['#7a4e14', '#c08e2a', '#eec050', '#ffe48a', '#fff6c8', '#fffcee']
PRI_ROBE = ['#4a4e88', '#8a90c4', '#c8ceec', '#eef0fc', '#ffffff']
PRI_EYE = ['#0a5a6a', '#20b0c8', '#a0f0ff']
PRI_BLUE = ['#0e2462', '#1c48a8', '#3a80e0', '#80bcff', '#d4ecff']
SUN = ['#8a4a10', '#d0861e', '#f8be34', '#ffe070', '#fff6b8', '#ffffff']


def high_priest():
    p = Pic('#ffd23f')
    hx, hy = 122, 60
    # --- étole bleue flottant derrière
    st = spoly([(112, 96), (100, 98), (90, 140), (78, 186), (70, 214), (78, 220), (88, 214), (98, 182), (110, 136)])
    p.fill(st, dk(PRI_BLUE), rnd=5)
    fold(p, [(100, 120), (84, 200)], PRI_BLUE[0], PRI_BLUE[2], st)
    p.paint(st & ~_sh(st, 0, -3) & (YY > 200), GOLD[2])
    for x in range(72, 90, 3):
        p.fill(tube([(x, 220 - (x - 72) * 0.4), (x - 1, 228 - (x - 72) * 0.4)], 1.5), GOLD, rnd=1, line=None)
    # --- bras arrière
    arm(p, (106, 100), (96, 122), (100, 140), dk(PRI_ROBE), ws=(14, 13, 14, 15))
    hand(p, 103, 144, SKIN, r=5)
    # --- robe longue blanche
    robe = spoly([(108, 132), (142, 132), (152, 170), (164, 226), (168, 242), (86, 242), (90, 214), (100, 170)])
    p.fill(robe, PRI_ROBE, rnd=10)
    for x0, x1 in ((108, 96), (116, 108), (138, 148), (146, 160)):
        fold(p, [(x0, 150), (x1, 238)], PRI_ROBE[1], PRI_ROBE[3], robe)
    # bande centrale bleue + or
    band = poly([(122, 134), (134, 134), (142, 242), (118, 242)])
    p.fill(band & robe, PRI_BLUE, rnd=4, line=GOLD[0])
    for sx in (0, 1):
        edge_ = px_line([(122 + sx * 12, 134), (118 + sx * 24, 242)]) & robe
        p.paint(edge_, GOLD[2])
    for y in range(156, 236, 18):
        cx = 128 + (y - 134) * 0.04
        cr = poly([(cx - 1, y - 5), (cx + 2, y - 5), (cx + 2, y + 5), (cx - 1, y + 5)]) | poly([(cx - 4, y - 1), (cx + 5, y - 1), (cx + 5, y + 2), (cx - 4, y + 2)])
        p.fill(cr, GOLD, rnd=1, line=None)
    hem = robe & ~_sh(robe, 0, -3)
    p.paint(hem, GOLD[2])
    p.paint(robe & ~_sh(robe, 0, -1), GOLD[0])
    for (x, R) in ((100, dk(LEATHER)), (148, LEATHER)):
        m = spoly([(x - 4, 239), (x + 10, 238), (x + 15, 242), (x + 13, 245), (x - 4, 245)]) & (YY < 245)
        p.fill(m, R, rnd=2)
    # --- buste (robe) + ceinture
    chest = spoly([(104, 96), (126, 91), (148, 93), (150, 112), (144, 130), (142, 140), (110, 141), (106, 128), (101, 112)])
    p.fill(chest, PRI_ROBE, rnd=11, k_n=1.0)
    fold(p, [(116, 112), (112, 138)], PRI_ROBE[1], PRI_ROBE[3], chest)
    fold(p, [(140, 110), (142, 136)], PRI_ROBE[1], PRI_ROBE[3], chest)
    belt = spoly([(106, 132), (146, 130), (147, 139), (105, 141)])
    p.fill(belt, PRI_BLUE, rnd=3)
    gem(p, 127, 135.5, 3.4, SUN)
    # --- cou + mantelet doré
    neck(p, hx, hy, SKIN, w=12)
    cap = spoly([(100, 98), (114, 88), (128, 92), (142, 88), (156, 98), (152, 112), (128, 118), (104, 112)])
    p.fill(cap, PRI_ROBE, rnd=6)
    p.paint(cap & ~_sh(cap, 0, -3), GOLD[2])
    p.paint(cap & ~_sh(cap, 0, -1), GOLD[1])
    for (x, y) in ((110, 104), (128, 110), (146, 104)):
        gem(p, x, y, 2, PRI_BLUE)
    # étole sur le devant
    for (pts, R) in (([(116, 92), (114, 120), (112, 138)], PRI_BLUE), ([(138, 92), (140, 120), (142, 138)], PRI_BLUE)):
        m = tube(pts, 7)
        p.fill(m, R, rnd=3)
        p.paint(m & ~_sh(m, 1, 0), GOLD[2])
    face(p, hx, hy, PRI_EYE, skin=SKIN, mouth='smile', brow=PRI_HAIR[1], lash='#3a2a10', blush=False, eye_h=10)
    p.paint(px_line([(hx - 2, hy - 3), (hx + 8, hy - 4)]), PRI_HAIR[1])
    # cheveux courts, raie de côté
    top = ell(hx - 2, hy - 7, 22, 15) & (YY < hy - 1 + (XX - hx) * 0.2)
    p.fill(top, PRI_HAIR, rnd=7, tex=strands(top, 25, 0.6, 0.1), bias=0.15)
    hair_sheen(p, top, hx - 3, hy - 2, 16, PRI_HAIR)
    hm = top.copy()
    for pts, w in [
        ([(hx - 10, hy - 14), (hx - 18, hy - 2), (hx - 18, hy + 12)], 10),
        ([(hx - 18, hy - 6), (hx - 24, hy + 6), (hx - 20, hy + 18)], 9),
        ([(hx - 4, hy - 18), (hx + 6, hy - 14), (hx + 12, hy - 4)], 10),
        ([(hx + 4, hy - 19), (hx + 14, hy - 12), (hx + 18, hy - 2)], 9),
        ([(hx + 12, hy - 17), (hx + 20, hy - 8), (hx + 22, hy + 4)], 7),
    ]:
        hm |= lock(p, pts, w, PRI_HAIR, rnd=3)
    hair_shadow(p, hm)
    # couronne de laurier dorée
    circ = tube([(hx - 20, hy - 6), (hx - 6, hy - 14), (hx + 14, hy - 14)], 3)
    p.fill(circ, GOLD, rnd=1)
    for k in range(6):
        x = hx - 18 + k * 6
        y = hy - 8 - min(k, 3) * 2
        leaf(p, x, y, -120 + k * 12, 7, 4, GOLD)
    # --- bâton solaire
    shaft = [(170, 244), (172, 60)]
    sm = tube(shaft, 6)
    p.fill(sm, GOLD, rnd=2)
    for y0 in range(80, 240, 16):
        p.paint(px_line([(168, y0), (176, y0 - 1)]) & sm, GOLD[1])
        p.paint(px_line([(168, y0 + 1), (176, y0)]) & sm, GOLD[4])
    p.fill(tube([(172, 76), (172, 70)], 10), PRI_BLUE, rnd=2)
    sx, sy = 172, 50
    glow(p, ell(sx, sy, 24, 24) & ~ell(sx, sy, 17, 17), '#ffe070')
    rays = empty()
    for k in range(12):
        a = math.radians(k * 30 - 90)
        r1 = 18 if k % 2 == 0 else 14
        rays |= poly([(sx + math.cos(a - 0.22) * 8, sy + math.sin(a - 0.22) * 8), (sx + math.cos(a) * r1, sy + math.sin(a) * r1),
                      (sx + math.cos(a + 0.22) * 8, sy + math.sin(a + 0.22) * 8)])
    p.fill(rays, SUN, rnd=2, bias=0.1)
    gem(p, sx, sy, 8, SUN)
    # --- bras avant
    arm(p, (148, 102), (160, 120), (166, 136), PRI_ROBE, ws=(14, 13, 14, 15))
    cuff = tube([(162, 130), (167, 140)], 16)
    p.fill(cuff, PRI_ROBE, rnd=3)
    p.paint(cuff & ~_sh(cuff, 0, -2), GOLD[2])
    hand(p, 170, 140, SKIN, r=5.5)
    for (x, y) in ((200, 30), (146, 34), (204, 74)):
        p.sparkle(x, y, ['#ffffff', '#ffe070'], 1)
    return p


# ================================================================ 11. NINJA (SR)

NIN_HAIR = ['#0a0816', '#16102a', '#261c48', '#3a2e6a', '#584a94', '#8070c0']
NIN_GI = ['#0a0a16', '#161628', '#24243e', '#36365a', '#50507e', '#7272a8']
NIN_PUR = ['#2a0848', '#5a1690', '#8a30d0', '#b868ff', '#e2b8ff']
NIN_EYE = ['#3a0a6a', '#a040ff', '#e8b0ff']
NIN_BLADE = ['#3a0a70', '#7a2ad8', '#b070ff', '#e4c8ff', '#ffffff']


def ninja():
    p = Pic('#9a5cff')
    hx, hy = 124, 62
    # --- longue écharpe / queue de cheval flottant derrière
    sc = tube([(hx - 16, hy - 6), (hx - 40, hy - 10), (hx - 62, hy + 4), (hx - 80, hy + 26), (hx - 96, hy + 34)], [16, 15, 13, 10, 6])
    p.fill(sc, dk(NIN_HAIR[:5]), rnd=5, bias=0.1)
    fold(p, [(hx - 30, hy - 6), (hx - 78, hy + 24)], NIN_HAIR[0], NIN_HAIR[3], sc)
    tails = tube([(hx - 12, hy + 14), (hx - 30, hy + 36), (hx - 54, hy + 52), (hx - 70, hy + 76)], [10, 9, 8, 4])
    p.fill(tails, dk(NIN_PUR), rnd=3)
    # --- bras arrière : lame inversée
    arm(p, (106, 102), (90, 118), (80, 128), dk(NIN_GI), ws=(13, 10, 10, 9))
    sword(p, (78, 130), (34, 150), NIN_BLADE, NIN_GI, NIN_PUR, None, width=6, guard_w=10, glow_c='#b070ff')
    hand(p, 78, 130, dk(NIN_GI), r=5.5)
    # --- jambes : pantalon bouffant, bandes, tabi
    leg(p, (118, 162), (110, 196), (104, 228), dk(NIN_GI), ws=(21, 17, 13, 14, 10))
    leg(p, (136, 162), (148, 196), (152, 230), NIN_GI, ws=(22, 18, 13, 15, 10))
    for (kx, ky, ax, R) in ((110, 204, 104, dk(NIN_GI)), (148, 204, 152, NIN_GI)):
        wrap = tube([(kx, ky), (ax, 230)], [14, 11])
        p.fill(wrap, R, rnd=3, bias=0.1)
        for k in range(5):
            y = ky + 3 + k * 5
            p.paint(px_line([(kx - 8, y), (kx + 8, y + 2)]) & wrap, R[1])
    boot(p, (104, 226), (104, 230), 14, dk(NIN_GI), ws=(11, 11, 11), sole=OUT)
    boot(p, (152, 228), (152, 232), 16, NIN_GI, ws=(12, 12, 12), sole=OUT)
    # --- gi : veste croisée + ceinture violette
    chest = spoly([(104, 96), (126, 91), (148, 93), (152, 112), (146, 132), (144, 160), (108, 162), (104, 132), (100, 112)])
    p.fill(chest, NIN_GI, rnd=11, k_n=1.05)
    fold(p, [(126, 94), (134, 120), (128, 150)], NIN_GI[0], NIN_GI[3], chest)
    fold(p, [(112, 112), (110, 150)], NIN_GI[0], NIN_GI[3], chest)
    fold(p, [(142, 110), (144, 150)], NIN_GI[0], NIN_GI[3], chest)
    belt = poly([(104, 136), (148, 134), (148, 144), (104, 146)])
    p.fill(belt, NIN_PUR, rnd=3)
    knot = tube([(108, 140), (100, 154), (96, 166)], [6, 5, 3]) | tube([(110, 140), (106, 156), (108, 168)], [6, 5, 3])
    p.fill(knot, NIN_PUR, rnd=2)
    # filet (cotte de mailles) au col
    net = poly([(118, 94), (134, 94), (128, 108)])
    p.fill(net, NIN_GI, rnd=2, line=None)
    p.paint(net & (((XX.astype(int) + YY.astype(int)) % 3 == 0) | ((XX.astype(int) - YY.astype(int)) % 3 == 0)), NIN_GI[4])
    # --- tête : capuche + masque
    hood = ell(hx - 3, hy - 1, 25, 25)
    p.fill(hood, NIN_HAIR, rnd=8, bias=0.05)
    face(p, hx, hy, NIN_EYE, skin=SKIN, mouth='none', brow='#16102a', brow_mode='angry', lash='#0a0816', blush=False,
         fierce=True, eye_h=10)
    mask = spoly([(hx - 16, hy + 9), (hx + 22, hy + 9), (hx + 23, hy + 20), (hx + 16, hy + 30), (hx + 18, hy + 36),
                  (hx - 10, hy + 38), (hx - 18, hy + 24)])
    p.fill(mask, NIN_GI, rnd=5, bias=0.12)
    fold(p, [(hx + 2, hy + 14), (hx + 16, hy + 18)], NIN_GI[1], NIN_GI[4], mask)
    p.paint(px_line([(hx + 20, hy + 11), (hx + 21, hy + 16)]) & mask, NIN_GI[1])
    capf = ell(hx - 2, hy - 8, 23, 15) & (YY < hy - 3 + (XX - hx) * 0.12)
    p.fill(capf, NIN_HAIR, rnd=7, bias=0.15)
    side = spoly([(hx - 22, hy - 6), (hx - 14, hy - 4), (hx - 14, hy + 24), (hx - 24, hy + 18)])
    p.fill(side, NIN_HAIR, rnd=4, bias=0.05)
    # bandeau violet + plaque d'acier
    hb = tube([(hx - 22, hy - 7), (hx - 4, hy - 11), (hx + 22, hy - 9)], 5)
    p.fill(hb, NIN_PUR, rnd=2)
    plate_ = spoly([(hx + 4, hy - 14), (hx + 18, hy - 13), (hx + 18, hy - 6), (hx + 4, hy - 7)])
    p.fill(plate_, STEEL, rnd=2)
    p.paint(px_line([(hx + 8, hy - 10), (hx + 14, hy - 10)]), STEEL[1])
    # --- bras avant : lame violette tendue
    sword(p, (172, 128), (220, 66), NIN_BLADE, NIN_GI, NIN_PUR, None, width=6, guard_w=12, glow_c='#b070ff')
    arm(p, (148, 102), (160, 120), (170, 128), NIN_GI, ws=(13, 10, 10, 9))
    wr = tube([(160, 121), (170, 128)], 10)
    p.fill(wr, NIN_GI, rnd=2, bias=0.1)
    hand(p, 172, 129, NIN_GI, r=5.5)
    # --- shuriken + particules
    for (x, y) in ((206, 160), (40, 70)):
        sh = poly([(x, y - 6), (x + 2, y - 2), (x + 6, y), (x + 2, y + 2), (x, y + 6), (x - 2, y + 2), (x - 6, y), (x - 2, y - 2)])
        p.fill(sh, STEEL, rnd=1, line=OUT)
        p.pset(x, y, OUT)
    for (x, y) in ((196, 200), (226, 110), (60, 200), (190, 40)):
        p.fxpx(x, y, NIN_PUR[3]); p.fxpx(x + 1, y + 1, NIN_PUR[2])
    return p


# ================================================================ 12. BARBARE (SR)

BAR_HAIR = ['#6a625c', '#a8a094', '#d8d0c4', '#f2ece2', '#fffaf2', '#ffffff']
BAR_FUR = ['#2e1c12', '#563828', '#806048', '#a88a66', '#d0b48a', '#f0dcb8']
BAR_KILT = ['#30100c', '#5a1c14', '#8a2c1e', '#b8482c', '#e07a4c']
BAR_EYE = ['#7a1a0a', '#e05a1a', '#ffc070']
BAR_AXE = ['#2a1a20', '#5a4a52', '#8e8088', '#c4b8be', '#ece4e8', '#ffffff']
BAR_PAINT = '#c02818'


def barbarian():
    p = Pic('#ff4a3a')
    hx, hy = 122, 60
    # --- bras arrière (tient le manche)
    arm(p, (106, 102), (106, 128), (130, 120), dk(TAN), ws=(16, 13, 13, 11))
    p.fill(tube([(114, 126), (126, 121)], 11), dk(LEATHER), rnd=2)
    # --- jambes
    leg(p, (118, 166), (110, 198), (104, 228), dk(TAN), ws=(22, 17, 14, 16, 11))
    leg(p, (138, 166), (148, 198), (152, 230), TAN, ws=(23, 18, 15, 17, 11))
    for (kx, ax_, R, F) in ((110, 104, dk(LEATHER), dk(BAR_FUR)), (148, 152, LEATHER, BAR_FUR)):
        bm = boot(p, (kx, 206), (ax_, 230), 15, R, ws=(15, 13, 12), sole=OUT)
        fur_mantle(p, [(kx - 10, 202), (kx, 198), (kx + 10, 202), (kx + 9, 208), (kx - 9, 208)], F, seed=kx, tuft=4)
        for k in range(4):
            p.paint(px_line([(kx - 8, 212 + k * 5), (kx + 6, 214 + k * 5)]) & bm, R[0])
    # --- pagne à lanières
    kilt = spoly([(106, 146), (148, 144), (156, 168), (160, 182), (148, 178), (138, 186), (126, 178), (114, 186),
                  (102, 178), (96, 182), (100, 166)])
    p.fill(kilt, BAR_KILT, rnd=7)
    for x0 in (108, 118, 130, 142, 152):
        fold(p, [(126 + (x0 - 126) * 0.6, 150), (x0, 182)], BAR_KILT[0], BAR_KILT[3], kilt)
    # --- torse nu musclé
    chest = spoly([(100, 96), (126, 90), (152, 92), (156, 112), (148, 132), (144, 148), (110, 150), (106, 132), (98, 112)])
    p.fill(chest, TAN, rnd=12, k_n=1.1)
    # pectoraux / abdos
    for cx, cy, R in ((116, 110, dk(TAN)), (140, 108, TAN)):
        m = ell(cx, cy, 12, 8)
        p.paint(m & ~_sh(m, 0, -1) & chest, TAN[1])
    for y in (124, 132, 140):
        p.paint(px_line([(124, y), (130, y)]) & chest, TAN[1])
        p.paint(px_line([(136, y - 1), (141, y - 1)]) & chest, TAN[1])
    p.paint(px_line([(132, 118), (132, 146)]) & chest, TAN[1])
    p.paint(px_line([(133, 118), (133, 146)]) & chest, TAN[3])
    # peintures de guerre rouges
    for (a, b_) in (((112, 116), (120, 104)), ((114, 120), (122, 108))):
        p.paint(thick_line([a, b_], 1.6) & chest, BAR_PAINT)
    # cicatrice
    p.paint(px_line([(138, 116), (146, 126)]) & chest, TAN[0])
    # harnais de cuir + ceinture
    strap = tube([(150, 98), (108, 146)], 6)
    p.fill(strap & chest, LEATHER, rnd=2)
    rivets(p, [(140, 110), (128, 122), (116, 136)], STEEL)
    belt = poly([(106, 142), (148, 140), (149, 150), (105, 152)])
    p.fill(belt, LEATHER, rnd=2)
    buck = spoly([(122, 140), (134, 140), (134, 152), (122, 152)])
    p.fill(buck, STEEL, rnd=2)
    p.pset(128, 146, STEEL[0])
    # --- hache à deux tranchants portée en travers (fer derrière l'épaule gauche)
    hx0, hy0 = 76, 58
    ex, ey = 172, 154
    L = math.hypot(ex - hx0, ey - hy0)
    ca, sa = (ex - hx0) / L, (ey - hy0) / L
    nx, ny = -sa, ca
    P = lambda t, s_: (hx0 + ca * t + nx * s_, hy0 + sa * t + ny * s_)
    for sg, sc in ((1, 1.25), (-1, 1.05)):
        pts = [P(-7, sg * 4), P(-12, sg * 16 * sc), P(-22, sg * 28 * sc), P(-8, sg * 33 * sc), P(8, sg * 33 * sc),
               P(20, sg * 28 * sc), P(12, sg * 16 * sc), P(7, sg * 4)]
        bl = spoly(pts)
        p.fill(bl, BAR_AXE, rnd=5, k_n=1.1)
        rim = bl & ~(_sh(bl, int(round(-nx * sg * 3)), int(round(-ny * sg * 3))))
        p.paint(rim, BAR_AXE[4])
        p.paint(ell(*P(0, sg * 18 * sc), 5, 3, math.degrees(math.atan2(sa, ca))) & bl, BAR_PAINT)
    core = spoly([P(-9, -6), P(9, -6), P(9, 6), P(-9, 6)])
    p.fill(core, BAR_AXE, rnd=2, bias=-0.15)
    rivets(p, [P(-4, -2), P(4, 2)], BAR_AXE)
    spike = poly([P(-9, -3), P(-20, 0), P(-9, 3)])
    p.fill(spike, BAR_AXE, rnd=2)
    sm = tube([P(4, 0), P(L + 10, 0)], 7)
    p.fill(sm, WOOD, rnd=2)
    for t in range(20, int(L), 12):
        p.paint(px_line([P(t, -3), P(t + 3, 3)]) & sm, WOOD[0])
    p.fill(tube([P(30, 0), P(42, 0)], 9), LEATHER, rnd=2)
    for t in (32, 36, 40):
        p.paint(px_line([P(t, -4), P(t + 2, 4)]), LEATHER[0])
    hand(p, *P(82, 0), dk(TAN), r=6.5)
    # --- cou + tête
    neck(p, hx, hy, TAN, w=14)
    # crinière blanche hérissée (arrière)
    back = ell(hx - 4, hy - 2, 26, 25)
    p.fill(back, dk(BAR_HAIR[:5]), rnd=6, bias=0.1)
    for (pts, w) in (([(hx - 14, hy - 10), (hx - 32, hy - 24), (hx - 40, hy - 34)], 13),
                     ([(hx - 20, hy + 0), (hx - 38, hy - 6), (hx - 48, hy - 6)], 12),
                     ([(hx - 20, hy + 10), (hx - 36, hy + 18), (hx - 44, hy + 28)], 11),
                     ([(hx - 4, hy - 16), (hx - 12, hy - 34), (hx - 14, hy - 44)], 12)):
        lock(p, pts, w, dk(BAR_HAIR[:5]), rnd=3, bias=0.15)
    face(p, hx, hy, BAR_EYE, skin=TAN, mouth='grit', brow=BAR_HAIR[1], brow_mode='angry', lash='#2a1408', blush=False,
         eye_h=9, fierce=True, jaw=1.06)
    p.paint(px_line([(hx - 2, hy - 4), (hx + 8, hy - 1)]), BAR_HAIR[0])
    p.paint(px_line([(hx + 13, hy - 1), (hx + 19, hy - 4)]), BAR_HAIR[0])
    # peinture rouge sous les yeux
    for x in (hx + 1, hx + 4, hx + 7, hx + 14, hx + 17):
        p.paint(px_line([(x, hy + 14), (x, hy + 16)]), BAR_PAINT)
    # cicatrice sur l'œil ? — non, barbe naissante
    stub = (p.face_m & (YY > hy + 19) & (XX > hx - 4)) & CHECK
    p.paint(stub, TAN[1])
    top = ell(hx - 2, hy - 8, 22, 14) & (YY < hy - 2 + (XX - hx) * 0.2)
    p.fill(top, BAR_HAIR, rnd=6, bias=0.1)
    hm = top.copy()
    for pts, w in [
        ([(hx - 6, hy - 16), (hx + 0, hy - 30), (hx + 6, hy - 40)], 11),
        ([(hx + 4, hy - 18), (hx + 14, hy - 28), (hx + 24, hy - 32)], 10),
        ([(hx + 12, hy - 14), (hx + 22, hy - 16), (hx + 30, hy - 14)], 8),
        ([(hx - 2, hy - 16), (hx - 6, hy - 4), (hx - 10, hy + 2)], 9),
        ([(hx + 6, hy - 17), (hx + 8, hy - 6), (hx + 6, hy + 0)], 8),
        ([(hx + 13, hy - 14), (hx + 19, hy - 6), (hx + 20, hy + 2)], 7),
    ]:
        hm |= lock(p, pts, w, BAR_HAIR, rnd=3)
    hair_shadow(p, hm)
    # --- épaulière de fourrure + crâne
    fur_mantle(p, [(94, 94), (108, 84), (124, 90), (122, 104), (106, 108), (94, 104)], dk(BAR_FUR), seed=3)
    # --- bras avant (tient le manche, bras musclé)
    arm(p, (150, 100), (164, 120), (160, 138), TAN, ws=(18, 15, 15, 12))
    p.fill(tube([(160, 128), (160, 140)], 13), LEATHER, rnd=2)
    p.paint(px_line([(152, 108), (158, 104)]), BAR_PAINT)
    p.paint(px_line([(153, 111), (159, 107)]), BAR_PAINT)
    hand(p, 162, 144, TAN, r=6.5)
    p.paint(px_line([(158, 141), (166, 147)]), TAN[1])
    fur_mantle(p, [(140, 92), (154, 84), (166, 92), (164, 104), (148, 106), (140, 102)], BAR_FUR, seed=5)
    # --- braises
    for (x, y) in ((40, 120), (212, 80), (200, 180), (60, 200)):
        ember(p, x, y, '#ffb08a', '#ff4a3a')
    return p


# ================================================================ sorties

CHARS = {}


def register():
    for k, fn in list(globals().items()):
        if callable(fn) and k in IDS:
            CHARS[k] = fn


IDS = ['archangel', 'demon_queen', 'ice_empress', 'shadow_lord', 'sylvan_guardian',
       'azure_paladin', 'rose_blade', 'witch', 'elf_archer', 'high_priest', 'ninja', 'barbarian']


def render(cid):
    p = globals()[cid]()
    return p.finish()


def preview(images, path):
    S = 2
    cell_w = N * S + 64 * 4 + 40
    cell_h = N * S + 24
    cols = 3
    ids = list(images)
    rows = (len(ids) + cols - 1) // cols
    sheet = Image.new('RGBA', (cell_w * cols, cell_h * rows), (24, 22, 36, 255))
    for i, cid in enumerate(ids):
        ox, oy = (i % cols) * cell_w + 12, (i // cols) * cell_h + 12
        bg = Image.new('RGBA', (N * S, N * S), (40, 38, 58, 255))
        sheet.paste(bg, (ox, oy))
        im = images[cid].resize((N * S, N * S), Image.NEAREST)
        sheet.alpha_composite(im, (ox, oy))
        sp = os.path.join(ROOT, 'assets', 'sprites', 'ally_%s.png' % cid)
        if os.path.exists(sp):
            s = Image.open(sp).convert('RGBA')
            s = s.resize((s.width * 4, s.height * 4), Image.NEAREST)
            sheet.alpha_composite(s, (ox + N * S + 16, oy + N * S - s.height))
    sheet.save(path)


def main(argv):
    ids = [a for a in argv if a in IDS] or [i for i in IDS if i in globals()]
    out_dir = os.path.join(ROOT, 'assets', 'hd')
    os.makedirs(out_dir, exist_ok=True)
    images = {}
    for cid in ids:
        if cid not in globals():
            continue
        im = render(cid)
        im.save(os.path.join(out_dir, 'ally_%s.png' % cid))
        images[cid] = im
        print('ok', cid)
    if not [a for a in argv if a in IDS]:
        preview(images, os.path.join(ROOT, 'tools', 'art', 'preview_hd_allies_top.png'))


if __name__ == '__main__':
    main(sys.argv[1:])
