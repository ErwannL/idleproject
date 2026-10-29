"""Illustrations « HD » des 8 skins de héros (lot `skins`).

Sorties : assets/hd/<id>.png (RGBA 256×256, pixel art 1×, fond transparent, pieds vers y=244)
et la planche tools/art/preview_hd_skins.png (illustration ×2 + sprite du jeu ×4).

Méthode : chaque pièce (membre, mèche, plaque, pli de tissu) est un masque booléen (polygones lissés,
traits à rayon variable, ellipses) ombré par sa « hauteur » interne (érosions successives → normale →
lumière haut-gauche), quantifié sur une rampe à décalage de teinte avec tramage Bayer ponctuel. Les bords
intérieurs reçoivent un contour teinté, la silhouette un contour #1a1226 et un liseré d'accent à droite.
Les couleurs reprennent celles des sprites (tools/art/skins_a.py, tools/art/skins_b.py).

Usage : python3 tools/art/hd_skins.py [id ...]
"""
import math
import os
import random
import sys

import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT_DIR = os.path.join(ROOT, 'assets', 'hd')
SPRITES = os.path.join(ROOT, 'assets', 'sprites')
PREVIEW = os.path.join(ROOT, 'tools', 'art', 'preview_hd_skins.png')

W = H = 256
GROUND = 244
OUTC = '#1a1226'
YY, XX = np.mgrid[0:H, 0:W]
LIGHT = np.array([-0.52, -0.68, 0.52])
LIGHT = LIGHT / np.linalg.norm(LIGHT)
_B4 = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0 - 0.47
BAYER = np.tile(_B4, (H // 4, W // 4))


# ------------------------------------------------------------------ couleurs

def rgb(c):
    if isinstance(c, str):
        c = c.lstrip('#')
        return np.array([int(c[i:i + 2], 16) for i in (0, 2, 4)], dtype=float)
    return np.asarray(c, dtype=float)


def hexc(a):
    a = np.clip(np.round(a), 0, 255).astype(int)
    return '#%02x%02x%02x' % tuple(a)


def mix(a, b, t):
    return hexc(rgb(a) * (1 - t) + rgb(b) * t)


def dark_line(ramp):
    """Contour intérieur teinté : le plus sombre de la rampe tiré vers le contour."""
    return mix(ramp[0], OUTC, 0.45)


# ------------------------------------------------------------------ géométrie

def rot(p, ang, c=(0, 0)):
    a = math.radians(ang)
    x, y = p[0] - c[0], p[1] - c[1]
    return (c[0] + x * math.cos(a) - y * math.sin(a), c[1] + x * math.sin(a) + y * math.cos(a))


def catmull(pts, closed=False, seg=8):
    """Courbe lisse passant par les points."""
    pts = [tuple(p) for p in pts]
    if len(pts) < 3:
        return pts
    out = []
    n = len(pts)
    rng_ = range(n) if closed else range(n - 1)
    for i in rng_:
        p0 = pts[(i - 1) % n] if closed else pts[max(i - 1, 0)]
        p1 = pts[i]
        p2 = pts[(i + 1) % n] if closed else pts[i + 1]
        p3 = pts[(i + 2) % n] if closed else pts[min(i + 2, n - 1)]
        for s in range(seg):
            t = s / seg
            t2, t3 = t * t, t * t * t
            out.append(tuple(0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2
                                    + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3) for k in (0, 1)))
    if not closed:
        out.append(pts[-1])
    return out


def resample(path, step=0.5):
    out = [path[0]]
    for (x0, y0), (x1, y1) in zip(path, path[1:]):
        d = math.hypot(x1 - x0, y1 - y0)
        n = max(1, int(d / step))
        for i in range(1, n + 1):
            out.append((x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n))
    return out


def poly(pts, smooth=False):
    if smooth:
        pts = catmull(pts, closed=True)
    img = Image.new('L', (W, H), 0)
    ImageDraw.Draw(img).polygon([(float(x) - 0.5, float(y) - 0.5) for x, y in pts], fill=1)
    return np.array(img, dtype=bool)


def ell(cx, cy, rx, ry, ang=0.0):
    dx, dy = XX + 0.5 - cx, YY + 0.5 - cy
    if ang:
        a = math.radians(ang)
        dx, dy = dx * math.cos(a) + dy * math.sin(a), -dx * math.sin(a) + dy * math.cos(a)
    return (dx / rx) ** 2 + (dy / ry) ** 2 <= 1.0


def stroke(pts, radii, smooth=True):
    """Trait épais à rayon variable (rayons interpolés le long des points de contrôle)."""
    if isinstance(radii, (int, float)):
        radii = [radii] * len(pts)
    path = catmull(pts) if smooth and len(pts) > 2 else [tuple(p) for p in pts]
    # rayon le long du chemin : interpolé selon l'abscisse relative
    lens = [0.0]
    for (x0, y0), (x1, y1) in zip(path, path[1:]):
        lens.append(lens[-1] + math.hypot(x1 - x0, y1 - y0))
    tot = lens[-1] or 1.0
    m = np.zeros((H, W), bool)
    samp = resample(path, 0.6)
    sl = [0.0]
    for (x0, y0), (x1, y1) in zip(samp, samp[1:]):
        sl.append(sl[-1] + math.hypot(x1 - x0, y1 - y0))
    st = sl[-1] or 1.0
    for (x, y), l in zip(samp, sl):
        u = l / st * (len(radii) - 1)
        i = min(int(u), len(radii) - 2) if len(radii) > 1 else 0
        r = radii[0] if len(radii) == 1 else radii[i] + (radii[i + 1] - radii[i]) * (u - i)
        if r <= 0.05:
            continue
        x0, x1 = max(0, int(x - r - 1)), min(W, int(x + r + 2))
        y0, y1 = max(0, int(y - r - 1)), min(H, int(y + r + 2))
        if x0 >= x1 or y0 >= y1:
            continue
        sub = (XX[y0:y1, x0:x1] + 0.5 - x) ** 2 + (YY[y0:y1, x0:x1] + 0.5 - y) ** 2 <= r * r
        m[y0:y1, x0:x1] |= sub
    return m


def rect_rot(cx, cy, w, h, ang):
    pts = [(-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2)]
    return [(cx + p[0], cy + p[1]) for p in (rot(q, ang) for q in pts)]


def shift(m, dx, dy):
    out = np.zeros_like(m)
    ys = slice(max(0, dy), H + min(0, dy))
    yd = slice(max(0, -dy), H + min(0, -dy))
    xs = slice(max(0, dx), W + min(0, dx))
    xd = slice(max(0, -dx), W + min(0, -dx))
    out[ys, xs] = m[yd, xd]
    return out


def erode(m, sq=False):
    e = m & shift(m, 1, 0) & shift(m, -1, 0) & shift(m, 0, 1) & shift(m, 0, -1)
    if sq:
        e &= shift(m, 1, 1) & shift(m, -1, -1) & shift(m, 1, -1) & shift(m, -1, 1)
    return e


def dilate(m, sq=False):
    d = m | shift(m, 1, 0) | shift(m, -1, 0) | shift(m, 0, 1) | shift(m, 0, -1)
    if sq:
        d |= shift(m, 1, 1) | shift(m, -1, -1) | shift(m, 1, -1) | shift(m, -1, 1)
    return d


def blur(a, n=1):
    for _ in range(n):
        p = np.pad(a, 1, mode='edge')
        a = (p[:-2, :-2] + p[:-2, 1:-1] + p[:-2, 2:] + p[1:-1, :-2] + p[1:-1, 1:-1] + p[1:-1, 2:]
             + p[2:, :-2] + p[2:, 1:-1] + p[2:, 2:]) / 9.0
    return a


def height(m, r):
    h = np.zeros((H, W))
    e = m.copy()
    for k in range(int(r)):
        h += e
        e = erode(e, sq=(k % 2 == 1))
        if not e.any():
            break
    return blur(h, 1) * m


_noise_rng = np.random.default_rng(7)
NOISE = _noise_rng.random((H, W))


def noise(seed, scale=1):
    r = np.random.default_rng(seed).random((H // scale + 2, W // scale + 2))
    r = np.kron(r, np.ones((scale, scale)))[:H, :W]
    return r


# ------------------------------------------------------------------ canevas

class Art:
    def __init__(self, accent):
        self.rgb = np.zeros((H, W, 3))
        self.a = np.zeros((H, W), bool)
        self.pid = np.zeros((H, W), int)
        self.norim = np.zeros((H, W), bool)
        self.n = 0
        self.accent = accent
        self.fx = []  # effets posés après les finitions

    # --- pose brute
    def fill(self, m, c, pid=None, norim=False):
        self.rgb[m] = rgb(c)
        self.a |= m
        if pid is None:
            self.n += 1
            pid = self.n
        self.pid[m] = pid
        if norim:
            self.norim |= m
        return pid

    def px(self, x, y, c, only=False):
        x, y = int(round(x)), int(round(y))
        if 0 <= x < W and 0 <= y < H and (not only or self.a[y, x]):
            self.rgb[y, x] = rgb(c)
            if not only:
                self.a[y, x] = True

    def pxs(self, pts, c, only=False):
        for p in pts:
            self.px(p[0], p[1], c, only)

    def line(self, pts, c, smooth=True, only=True, clip=None):
        path = catmull(pts) if smooth and len(pts) > 2 else pts
        seen = set()
        for x, y in resample(path, 0.35):
            k = (int(math.floor(x)), int(math.floor(y)))
            if k in seen:
                continue
            seen.add(k)
            if clip is not None and not (0 <= k[0] < W and 0 <= k[1] < H and clip[k[1], k[0]]):
                continue
            self.px(k[0], k[1], c, only)
        return seen

    def mask_line(self, pts, smooth=True):
        m = np.zeros((H, W), bool)
        path = catmull(pts) if smooth and len(pts) > 2 else pts
        for x, y in resample(path, 0.35):
            xi, yi = int(math.floor(x)), int(math.floor(y))
            if 0 <= xi < W and 0 <= yi < H:
                m[yi, xi] = True
        return m

    # --- pièce ombrée
    def part(self, m, ramp, r=6, bias=0.0, contrast=1.0, tex=None, clip=None, dither=0.25, line=True,
             light=None, bulge=1.0, grad=None, edge='dr', norim=False, linecol=None, lit_edge=True, spec=None):
        m = m.copy()
        if clip is not None:
            m &= clip
        if not m.any():
            return m
        n = len(ramp)
        z = height(m, r) / max(r, 1)
        z = np.sqrt(np.clip(1 - (1 - np.clip(z, 0, 1)) ** 2, 0, 1)) * r * bulge
        z = blur(z, 2 if r >= 4 else 1)
        gy, gx = np.gradient(z)
        nx, ny, nz = -gx, -gy, np.ones_like(z)
        ln = np.sqrt(nx * nx + ny * ny + nz * nz)
        L = LIGHT if light is None else np.array(light) / np.linalg.norm(light)
        lam = (nx * L[0] + ny * L[1] + nz * L[2]) / ln
        v = (lam - 0.12) / 0.78
        v = 0.5 + (v - 0.5) * contrast + bias
        if grad is not None:  # (y0, y1, amount) : assombrit vers le bas
            y0, y1, amt = grad
            v = v - amt * np.clip((YY - y0) / max(1, (y1 - y0)), 0, 1)
        if tex is not None:
            v = v + tex
        # rampe paire : les surfaces de face tomberaient pile sur une frontière (tramage en pointillés) -> demi-pas
        idx = np.clip(np.floor(v * n + BAYER * dither + (0.5 if n % 2 == 0 else 0.0)), 0, n - 1).astype(int)
        cols = np.array([rgb(c) for c in ramp])
        out = cols[idx]
        if spec is not None:  # (seuil, couleur) : reflet spéculaire (Blinn) pour métal, gemmes, cheveux
            th, sc = spec
            hv = L + np.array([0, 0, 1.0])
            hv = hv / np.linalg.norm(hv)
            sp = (nx * hv[0] + ny * hv[1] + nz * hv[2]) / ln
            out[(sp > th) & m] = rgb(sc)
        if line:
            lc = rgb(linecol or dark_line(ramp))
            right = m & ~shift(m, -1, 0)
            down = m & ~shift(m, 0, -1)
            left = m & ~shift(m, 1, 0)
            up = m & ~shift(m, 0, 1)
            if edge == 'all':
                e = right | down | left | up
            else:
                e = right | down
                if not lit_edge:
                    e |= left | up
            out[e] = lc
            if edge == 'dr' and lit_edge:
                # bords éclairés : un ton intermédiaire (contour sélectif plus clair)
                el = (left | up) & ~e
                out[el] = (cols[min(1, n - 1)] * 0.5 + lc * 0.5)
        self.rgb[m] = out[m]
        self.a |= m
        self.n += 1
        self.pid[m] = self.n
        if norim:
            self.norim |= m
        return m

    # --- détails
    def fold(self, pts, dark, light=None, clip=None, off=(-1, 0)):
        """Pli : creux sombre + arête claire décalée côté lumière."""
        if light:
            self.line([(x + off[0], y + off[1]) for x, y in pts], light, clip=clip)
        self.line(pts, dark, clip=clip)

    def dots(self, m, c, prob, seed=1, only=True):
        r = np.random.default_rng(seed).random((H, W))
        sel = m & (r < prob)
        if only:
            sel &= self.a
        self.rgb[sel] = rgb(c)

    def gem(self, cx, cy, rx, ry, ramp, glint='#ffffff', sparkle=False):
        m = ell(cx, cy, rx, ry)
        self.part(m, ramp, r=max(2, int(min(rx, ry))), contrast=1.6, dither=0.2, linecol=mix(ramp[0], OUTC, 0.6),
                  lit_edge=False)
        # facette basse lumineuse (réfraction)
        self.px(cx + rx * 0.3, cy + ry * 0.45, ramp[-2], only=True)
        self.px(cx - rx * 0.35, cy - ry * 0.4, glint, only=True)
        if rx >= 3:
            self.px(cx - rx * 0.35 + 1, cy - ry * 0.4, ramp[-1], only=True)
        if sparkle:
            self.sparkle(cx - rx * 0.35, cy - ry * 0.4, 3, glint)

    def sparkle(self, x, y, s, c, c2=None):
        x, y = int(round(x)), int(round(y))
        self.fx.append(('spark', x, y, s, c, c2))

    def rivet(self, x, y, ramp):
        self.px(x, y, ramp[-1], only=True)
        self.px(x + 1, y, ramp[-3], only=True)
        self.px(x, y + 1, ramp[-3], only=True)
        self.px(x + 1, y + 1, ramp[0], only=True)

    def glow(self, m, col, strength=0.45, rad=2):
        """Halo additif autour d'un masque lumineux (sur les pixels déjà posés)."""
        g = m.astype(float)
        g = blur(g, rad)
        g = np.clip(g * 2.2, 0, 1) * strength
        sel = (g > 0.04) & ~m & self.a
        c = rgb(col)
        self.rgb[sel] = self.rgb[sel] * (1 - g[sel, None]) + c * g[sel, None]

    # --- finitions
    def finish(self, rim=True, rim_w=2):
        a = self.a
        outer = a & ~(shift(a, 1, 0) & shift(a, -1, 0) & shift(a, 0, 1) & shift(a, 0, -1))
        # liseré d'accent (côté droit) : pixels juste à l'intérieur du bord droit
        if rim:
            acc = rgb(self.accent)
            inner = a & ~outer
            edge_r = inner & ~shift(a & ~outer, -1, 0)  # voisin de droite = contour
            cand = edge_r & ~self.norim
            for k in range(rim_w):
                t = 0.62 if k == 0 else 0.3
                sel = shift(cand, -k, 0) & inner & ~self.norim if k else cand
                lum = self.rgb[sel].mean(axis=1, keepdims=True) / 255.0
                self.rgb[sel] = self.rgb[sel] * (1 - t) + (acc * (0.55 + 0.6 * lum)).clip(0, 255) * t
        # contour : les pixels extérieurs de la silhouette deviennent le contour sombre,
        # puis 1 px de contour à l'extérieur là où la silhouette est fine (pas de trou)
        self.rgb[outer] = rgb(OUTC)
        self.apply_fx()

    def apply_fx(self):
        for f in self.fx:
            if f[0] == 'spark':
                _, x, y, s, c, c2 = f
                c2 = c2 or c
                for k in range(-s, s + 1):
                    cc = c if abs(k) <= s // 2 else c2
                    self.px(x + k, y, cc)
                    self.px(x, y + k, cc)
                if s >= 3:
                    for dx, dy in ((1, 1), (-1, -1), (1, -1), (-1, 1)):
                        self.px(x + dx, y + dy, c2)
            elif f[0] == 'px':
                _, x, y, c = f
                self.px(x, y, c)

    def fxpx(self, x, y, c):
        self.fx.append(('px', x, y, c))

    def image(self):
        arr = np.zeros((H, W, 4), np.uint8)
        arr[..., :3] = np.clip(np.round(self.rgb), 0, 255).astype(np.uint8)
        arr[..., 3] = np.where(self.a, 255, 0)
        return Image.fromarray(arr, 'RGBA')


# ------------------------------------------------------------------ visage

def eye(A, x, y, w, h, iris, lash=OUTC, white='#fff8f4', near=True, look=1, brow=None, lid=0, glow=None):
    """Œil 3/4 : (x, y) = coin haut-gauche de l'ouverture. iris : 3-4 couleurs sombre -> clair."""
    # blanc
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            A.px(xx, yy, white)
    # iris : occupe presque toute la hauteur, décalé vers le regard
    iw = max(2, w - (2 if near else 1))
    ix = x + (w - iw if look > 0 else 0)
    for yy in range(y, y + h):
        for xx in range(ix, ix + iw):
            t = (yy - y) / max(1, h - 1)
            c = iris[0] if t < 0.3 else (iris[1] if t < 0.7 else iris[min(2, len(iris) - 1)])
            A.px(xx, yy, c)
    # pupille
    pc = mix(iris[0], OUTC, 0.6)
    px0 = ix + iw // 2 - (1 if iw >= 4 else 0)
    for yy in range(y + 1, y + h - 1 - (1 if h > 5 else 0)):
        A.px(px0, yy, pc)
        if iw >= 4:
            A.px(px0 + 1, yy, pc)
    if glow:
        A.px(px0, y + h - 2, glow)
    # reflets
    A.px(ix, y + 1, '#ffffff')
    if h >= 6 and iw >= 3:
        A.px(ix + 1, y + 1, '#ffffff')
        A.px(ix, y + 2, '#ffffff')
    A.px(ix + iw - 1, y + h - 2, iris[-1])
    # paupière / cils : trait épais au-dessus, débordant au coin externe
    for xx in range(x - (0 if near else 1), x + w + (1 if near else 0)):
        A.px(xx, y - 1 + lid, lash)
        if lid:
            for yy in range(y, y + lid):
                A.px(xx, yy, lash)
    if near:
        A.px(x + w, y, lash)
        A.px(x + w + 1, y - 1, lash)
    else:
        A.px(x - 1, y, lash)
        A.px(x - 2, y - 1, lash)
    # ligne basse discrète
    for xx in range(x + 1, x + w - 1):
        A.px(xx, y + h, mix(lash, white, 0.45))


def aeye(A, x, y, w, h, iris, outer=-1, lash=OUTC, white='#fffaf6', glow=None, lid=0, lash2=None):
    """Œil « anime » 3/4 : (x, y) = coin haut-gauche de l'ouverture ; outer = côté du coin externe (-1 g., +1 d.).
    iris : sombre -> clair (3 à 4 couleurs)."""
    lash2 = lash2 or mix(lash, white, 0.25)
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            A.px(xx, yy, white)
    # ombre de paupière sur le blanc
    for xx in range(x, x + w):
        A.px(xx, y, mix(white, '#8a7ab0', 0.45))
    iw = max(2, w - 2) if w > 4 else max(2, w - 1)
    ix = x + (w - iw) // 2 + (1 if outer < 0 and w > 4 else 0)
    iy0, iy1 = y, y + h
    for yy in range(iy0, iy1):
        t = (yy - iy0) / max(1, iy1 - iy0 - 1)
        for xx in range(ix, ix + iw):
            edge = xx in (ix, ix + iw - 1)
            if edge and yy in (iy0, iy1 - 1) and iw > 3:
                continue
            c = iris[0] if t < 0.34 else (iris[1] if t < 0.72 else iris[2])
            if edge and t > 0.3:
                c = iris[1] if t > 0.72 else iris[0]
            A.px(xx, yy, c)
    pc = mix(iris[0], OUTC, 0.55)
    pw = 2 if iw >= 4 else 1
    p0 = ix + (iw - pw) // 2
    for yy in range(iy0 + 1, iy1 - 2):
        for k in range(pw):
            A.px(p0 + k, yy, pc)
    if glow:
        for k in range(pw):
            A.px(p0 + k, iy1 - 2, glow)
    # reflets
    A.px(ix + (0 if iw < 4 else 1), iy0 + 1, '#ffffff')
    if h >= 6:
        A.px(ix + (0 if iw < 4 else 1), iy0 + 2, '#ffffff')
        if iw >= 4:
            A.px(ix + 2, iy0 + 1, '#ffffff')
    A.px(ix + iw - 1 - (1 if iw >= 4 else 0), iy1 - 2, iris[-1])
    if len(iris) > 3:
        A.px(ix + iw - 2, iy1 - 3, iris[3])
    # cils : trait épais au-dessus, arqué, avec flèche au coin externe
    for xx in range(x - 1, x + w + 1):
        A.px(xx, y - 1, lash)
        A.px(xx, y - 2 + lid, lash) if 0 < xx - x < w - 1 else None
    for k in range(lid):
        for xx in range(x, x + w):
            A.px(xx, y + k, lash)
    ox = x - 1 if outer < 0 else x + w
    A.px(ox, y, lash)
    A.px(ox + outer, y + 1, lash)
    A.px(ox + outer, y - 1, lash2)
    A.px(ox + 2 * outer, y - 2, lash2)
    # cil bas
    for xx in range(x + 1, x + w - 1):
        A.px(xx, y + h, lash2 if xx != x + 1 else mix(lash2, white, 0.5))


def brow(A, pts, c, w=1):
    A.line(pts, c, smooth=len(pts) > 2, only=False)
    if w > 1:
        A.line([(x, y + 1) for x, y in pts[:max(2, len(pts) - 1)]], c, smooth=False, only=False)


def mouth(A, x, y, kind='smile', lip='#c8506a', dark='#6a1a2a'):
    if kind == 'smile':
        A.pxs([(x - 2, y - 1), (x - 1, y), (x, y), (x + 1, y)], dark)
        A.px(x, y + 1, lip)
    elif kind == 'small':
        A.pxs([(x - 1, y), (x, y), (x + 1, y)], dark)
        A.px(x, y + 1, lip)
    elif kind == 'smirk':
        A.pxs([(x - 2, y), (x - 1, y), (x, y), (x + 1, y - 1), (x + 2, y - 2)], dark)
        A.px(x, y + 1, lip)
    elif kind == 'line':
        A.pxs([(x - 2, y), (x - 1, y), (x, y), (x + 1, y)], dark)
        A.px(x - 1, y + 1, lip)
    elif kind == 'open':
        A.pxs([(x - 2, y), (x - 1, y), (x, y), (x + 1, y), (x + 2, y)], dark)
        A.pxs([(x - 1, y + 1), (x, y + 1), (x + 1, y + 1)], '#a02a3a')
        A.pxs([(x - 1, y + 2), (x, y + 2)], lip)
        A.px(x - 1, y + 1, '#ffffff')
        A.px(x, y + 1, '#ffffff')
    elif kind == 'fang':
        A.pxs([(x - 2, y), (x - 1, y), (x, y), (x + 1, y), (x + 2, y - 1)], dark)
        A.px(x - 1, y + 1, '#ffffff')
        A.px(x + 1, y + 1, '#ffffff')
        A.px(x, y + 1, lip)


def blush(A, pts, c):
    for x, y in pts:
        A.px(x, y, c, only=True)
        A.px(x + 1, y - 1, c, only=True)


def head3q(A, cx, cy, skin, rx=18, ry=19, chin=(7, 22), jaw=1.0):
    """Tête 3/4 vers la droite : crâne + mâchoire (menton décalé à droite). Renvoie le masque."""
    m = ell(cx, cy, rx, ry)
    m |= poly([(cx - rx + 2, cy + 2), (cx + rx - 1, cy - 2), (cx + rx - 2, cy + 9), (cx + chin[0] + 5 * jaw, cy + chin[1] - 4),
               (cx + chin[0], cy + chin[1]), (cx + chin[0] - 6, cy + chin[1] - 1), (cx - rx + 5, cy + 12)], smooth=True)
    A.part(m, skin, r=10, contrast=0.75, bias=0.08, lit_edge=False)
    return m


def lock(A, pts, radii, ramp, r=4, bias=0.0, strands=True, hi=None, spec=None, clip=None, contrast=1.0):
    """Mèche de cheveux effilée, ombrée, avec une raie sombre et un reflet."""
    m = stroke(pts, radii)
    if clip is not None:
        m &= clip
    A.part(m, ramp, r=r, bias=bias, spec=spec, contrast=contrast)
    if strands and len(pts) >= 2:
        path = catmull(pts) if len(pts) > 2 else pts
        n = len(path)
        mid = [(x + 0.8, y) for x, y in path[n // 6: n - n // 5]]
        if len(mid) > 1:
            A.line(mid, ramp[1], smooth=False, clip=m)
        if hi:
            top = [(x - 1.2, y) for x, y in path[n // 8: n // 2]]
            if len(top) > 1:
                A.line(top, hi, smooth=False, clip=m)
    return m


def hand(A, cx, cy, skin, r=5.5, fingers=3, ang=0, closed=True):
    m = ell(cx, cy, r, r * 0.85, ang)
    A.part(m, skin, r=3, bias=0.1)
    if closed:
        for k in range(fingers):
            dx = -r * 0.5 + k * (r / max(1, fingers - 1)) * 0.9
            p0 = rot((dx, -r * 0.2), ang)
            p1 = rot((dx, r * 0.6), ang)
            A.line([(cx + p0[0], cy + p0[1]), (cx + p1[0], cy + p1[1])], skin[1], smooth=False, clip=m)
    return m


def cast_shadow(A, src, target, dx, dy, col, only=None):
    """Ombre portée de src décalée (dx, dy) sur target ; only : couleurs remplaçables (par défaut : toutes)."""
    sh = shift(src, dx, dy) & target & ~src
    if only is not None:
        ok = np.zeros((H, W), bool)
        for c in only:
            ok |= np.all(np.abs(A.rgb - rgb(c)) < 1, axis=2)
        sh &= ok
    A.rgb[sh] = rgb(col)
    return sh


def anime_head(A, cx, cy, skin, iris, brow_c, lash=OUTC, mouth_kind='smile', lip='#d0586a', mouth_dark='#6a1a2a',
               blush_c='#f08a9a', glow=None, eye_h=11, white='#fffaf6', brow_ang=0, neck=None):
    """Visage 3/4 vers la droite (crâne centré en cx, cy ; menton vers cx+5, cy+22). Renvoie le masque de la tête."""
    m = ell(cx, cy, 19, 20)
    m |= poly([(cx - 17, cy + 3), (cx + 18, cy + 1), (cx + 17, cy + 10), (cx + 12, cy + 17), (cx + 6, cy + 22), (cx + 2, cy + 22),
               (cx - 6, cy + 19), (cx - 13, cy + 13)], smooth=True)
    A.part(m, skin, r=16, contrast=0.4, bias=0.22, lit_edge=False)
    if neck is not None:
        cast_shadow(A, m, neck, 1, 3, skin[1])
    # ombre propre du côté opposé (mâchoire droite) : bande diagonale
    far = m & ((XX - cx) * 0.75 + (YY - cy) * 0.55 > 15.5) & erode(m)
    A.rgb[far] = rgb(skin[2])
    A.rgb[far & ((XX - cx) * 0.75 + (YY - cy) * 0.55 > 19)] = rgb(mix(skin[1], skin[2], 0.5))
    # yeux
    aeye(A, cx - 12, cy + 1, 10, eye_h, iris, outer=-1, lash=lash, white=white, glow=glow)
    aeye(A, cx + 6, cy + 1, 6, eye_h, iris, outer=1, lash=lash, white=white, glow=glow)
    # sourcils
    b = brow_ang
    brow(A, [(cx - 13, cy - 3 + b), (cx - 8, cy - 5), (cx - 2, cy - 4 - b)], brow_c)
    brow(A, [(cx + 5, cy - 4 - b), (cx + 9, cy - 5), (cx + 13, cy - 3 + b)], brow_c)
    # nez (arête claire, ombre portée à droite et dessous)
    A.px(cx + 8, cy + 11, skin[-1])
    A.px(cx + 8, cy + 12, skin[-1])
    A.px(cx + 10, cy + 13, skin[1])
    A.px(cx + 9, cy + 14, skin[1])
    A.px(cx + 8, cy + 14, skin[2])
    # bouche
    mouth(A, cx + 4, cy + 18, mouth_kind, lip=lip, dark=mouth_dark)
    # joues
    blush(A, [(cx - 10, cy + 15), (cx - 7, cy + 15), (cx - 4, cy + 15), (cx + 9, cy + 15)], blush_c)
    return m


def aura(A, m, cols, seed=0, sparse=0.5):
    """Halo de lumière tramé hors silhouette (pixels pleins, sans alpha) : cols du plus proche au plus loin."""
    cur = m.copy()
    rr = np.random.default_rng(seed).random((H, W))
    chk = ((XX + YY) % 2 == 0)
    for i, c in enumerate(cols):
        nxt = dilate(cur, sq=(i % 2 == 1))
        ring = nxt & ~cur & ~A.a
        if i == len(cols) - 1:
            ring &= (rr < sparse)
        elif i > 0:
            ring &= chk | (rr < 0.25)
        A.rgb[ring] = rgb(c)
        A.a |= ring
        A.norim |= ring
        cur = nxt


def feather_wing(A, root, wrist, ramp, tip=None, rows=((1.0, 6, 11), (0.62, 5, 9), (0.36, 4.2, 8)), a_root=100, a_wrist=200,
                 l_root=34, l_wrist=70, bone_r=6, seed=0, bias=0.0, tipfrac=0.22, curl=8):
    """Aile à plumes : rangées (échelle de longueur, demi-largeur, nombre) des rémiges aux couvertures.
    Angles en degrés (0 = droite, 90 = bas)."""
    rr = random.Random(seed)
    mid = ((root[0] + wrist[0]) / 2, (root[1] + wrist[1]) / 2 - 10)
    bone = catmull([root, mid, wrist])
    allm = np.zeros((H, W), bool)
    for ri, (ls, wd, n) in enumerate(rows):
        for k in range(n):
            t = k / max(1, n - 1)
            idx = int(t * (len(bone) - 1))
            bx, by = bone[idx]
            a = math.radians(a_root + (a_wrist - a_root) * t + rr.uniform(-3, 3))
            L = (l_root + (l_wrist - l_root) * t ** 1.3) * ls
            ex, ey = bx + math.cos(a) * L, by + math.sin(a) * L
            # légère courbure de la plume
            perp = (-math.sin(a), math.cos(a))
            mx, my = bx + math.cos(a) * L * 0.55 + perp[0] * curl * ls, by + math.sin(a) * L * 0.55 + perp[1] * curl * ls
            f = stroke([(bx, by), (mx, my), (ex, ey)], [wd * 0.8, wd, 0.8])
            A.part(f, ramp, r=3, bias=bias + 0.05 * ri, contrast=1.1)
            if tip:
                # extrémité dorée
                tm = f & ~stroke([(bx, by), (mx, my), (bx + math.cos(a) * L * (1 - tipfrac), by + math.sin(a) * L * (1 - tipfrac))],
                                 [wd * 0.8 + 1, wd + 1, wd * 0.6 + 1])
                A.part(tm, tip, r=2, line=True, bias=0.05)
            # rachis
            A.line([(bx + (mx - bx) * 0.3, by + (my - by) * 0.3), (mx, my), (ex - math.cos(a) * 4, ey - math.sin(a) * 4)],
                   ramp[1] if ri == 0 else ramp[2], clip=f)
            allm |= f
    # bras de l'aile : bourrelet de petites plumes
    arm = stroke([root, mid, wrist], [bone_r, bone_r * 1.1, bone_r * 0.7])
    A.part(arm, ramp, r=4, bias=bias + 0.12)
    for i in range(0, len(bone) - 1, 3):
        x, y = bone[i]
        A.line([(x - 2, y + bone_r * 0.6), (x + 2, y + bone_r * 0.9)], ramp[2], smooth=False, clip=arm)
    return allm | arm


def hair_front(A, cx, cy, ramp, clumps=None, spec_c=None, bias=0.0, cap=(22, 20), ring=True):
    """Calotte + frange en mèches pointues (relatives à la tête cx, cy). clumps : (dx, dy pointe, demi-largeur, courbure)."""
    spec_c = spec_c or ramp[-1]
    capm = ell(cx - 1, cy - 4, cap[0], cap[1]) & (YY < cy - 2)
    A.part(capm, ramp, r=8, bias=bias, spec=(0.975, spec_c))
    if clumps is None:
        clumps = [(-18, 12, 5, -2), (-11, 7, 6, -1), (-3, 4, 5, 0), (4, 8, 5, 1), (11, 5, 5, 2), (17, 11, 4, 3)]
    for i, (dx, dy, w, bend) in enumerate(clumps):
        x0 = cx + dx
        m = poly([(x0 - w - 1, cy - 14), (x0 + w + 1, cy - 15), (x0 + w * 0.5 + bend, cy + dy * 0.5 - 4), (x0 + bend, cy + dy),
                  (x0 - w * 0.6 + bend * 0.5, cy + dy * 0.4 - 4)], smooth=True)
        A.part(m, ramp, r=3, bias=bias + 0.04 * ((i + 1) % 2), spec=(0.975, spec_c))
        A.line([(x0 + 1, cy - 10), (x0 + bend * 0.7 + 0.5, cy + dy - 3)], ramp[1], clip=m)
        capm = capm | m
    if ring:
        pts = []
        for a in range(196, 300, 4):
            r_ = math.radians(a)
            pts.append((cx - 1 + 16 * math.cos(r_), cy - 6 + 13 * math.sin(r_)))
        A.line(pts, ramp[-2], only=True)
        A.line([(x, y - 1) for x, y in pts[3:-6]], spec_c, only=True)
    return capm


# ------------------------------------------------------------------ registre

CHARS = {}


def character(cid):
    def deco(f):
        CHARS[cid] = f
        return f
    return deco


# ================================================================== GROMBAR
GB_BLK = ['#050409', '#0a0812', '#120f1c', '#1a1628', '#262138', '#38324e', '#5a5478', '#9690bc']
GB_GOLD = ['#4a1e0c', '#7a3a10', '#b06818', '#e8a830', '#ffd860', '#fff6c0']
GB_BEARD = ['#2a0604', '#4e0c06', '#801a0a', '#b02810', '#e0501e', '#ff8a3a', '#ffc070']
GB_CAPE = ['#1e040c', '#3a0814', '#5a0c1c', '#901628', '#c8283a', '#f05a5a']
GB_CAPE_IN = ['#14040a', '#26061a', '#3e0a26', '#5a1234']
GB_SKIN = ['#5a2e34', '#8a4a44', '#c07668', '#e8a488', '#ffd0b4', '#ffe8d8']
GB_ERM = ['#3e3e5c', '#6a6a8a', '#a4a4be', '#d6d6e6', '#f4f4fa', '#ffffff']
GB_RUBY = ['#3a0410', '#7a0a1c', '#c0182c', '#ff5a6a', '#ffd0d8']
GB_SAPH = ['#06143a', '#0a2a6a', '#1a6ae8', '#7ac8ff', '#e0f4ff']
GB_IRIS = ['#0a3a6a', '#2a8ae0', '#bfe8ff']
GB_RUNE = ['#c83a0a', '#ff8a1a', '#ffd04a', '#fff6c0']
GB_WOOD = ['#1a0c0c', '#2e1612', '#4a2418', '#6e3a20', '#9a5a2e']
GB_LEATH = ['#140a0e', '#24121a', '#3a1e26', '#583038', '#7a4a4a']
METAL_SPEC = (0.982, '#d4d0f0')


def rune_glyph(A, x, y, kind, s=1, core=GB_RUNE[3], mid=GB_RUNE[2], halo=None, carve=None):
    """Rune lumineuse (glyphes nordiques simplifiés), taille s."""
    G = {
        0: [((0, 0), (0, 6)), ((0, 0), (3, 2)), ((3, 2), (0, 4)), ((0, 3), (3, 6))],
        1: [((2, 0), (2, 6)), ((0, 0), (2, 2)), ((4, 0), (2, 2))],
        2: [((2, 0), (0, 2)), ((2, 0), (4, 2)), ((0, 2), (4, 6)), ((4, 2), (0, 6))],
        3: [((0, 0), (0, 6)), ((4, 0), (4, 6)), ((0, 0), (4, 6)), ((4, 0), (0, 6))],
        4: [((0, 0), (0, 6)), ((0, 1), (3, 0)), ((0, 3), (3, 2))],
        5: [((2, 0), (2, 6)), ((0, 2), (2, 0)), ((4, 2), (2, 0))],
        6: [((2, 0), (2, 6)), ((0, 1), (4, 5)), ((4, 1), (0, 5))],
    }
    m = np.zeros((H, W), bool)
    for (a, b) in G[kind % 7]:
        m |= A.mask_line([(x + a[0] * s, y + a[1] * s), (x + b[0] * s, y + b[1] * s)], smooth=False)
    m &= A.a
    if carve:
        A.rgb[shift(m, 1, 1) & A.a & ~m] = rgb(carve)
    if halo:
        A.glow(m, halo, 0.55, 1)
    A.rgb[m] = rgb(mid)
    A.rgb[m & (YY < y + 3 * s)] = rgb(core)
    return m


def beard_flow(A, m, x_c, y0, y1, n, ramp, seed, conv=0.5, lo=1, hi=5):
    """Mèches de barbe / fourrure : traits sombres qui suivent l'écoulement + arêtes claires."""
    rr = random.Random(seed)
    ys, xs = np.nonzero(m)
    for i in range(n):
        k = rr.randrange(len(xs))
        x, y = float(xs[k]), float(ys[k])
        ln = rr.uniform(14, 34)
        pts = [(x, y)]
        for s in range(4):
            y2 = pts[-1][1] + ln / 4
            x2 = pts[-1][0] + (x_c - pts[-1][0]) * conv * (ln / 4) / max(8, (y1 - y0)) * 3 + rr.uniform(-1.2, 1.2)
            pts.append((x2, y2))
        A.line(pts, ramp[lo] if i % 3 else ramp[0], clip=m)
        if i % 2 == 0:
            A.line([(p[0] - 1, p[1]) for p in pts[:3]], ramp[hi], clip=m)


def rounded_rect(cx, cy, w, h, ang, r):
    """Rectangle tourné à coins arrondis."""
    pts = []
    for (sx, sy, a0) in ((1, -1, -90), (1, 1, 0), (-1, 1, 90), (-1, -1, 180)):
        ccx, ccy = sx * (w / 2 - r), sy * (h / 2 - r)
        for k in range(5):
            a = math.radians(a0 + k * 22.5)
            pts.append((ccx + r * math.cos(a), ccy + r * math.sin(a)))
    return poly([(cx + p[0], cy + p[1]) for p in (rot(q, ang) for q in pts)])


@character('grombar')
def grombar():
    A = Art(accent='#ffb040')
    gl = GB_GOLD
    # ---------------- cape (derrière)
    hem = [(156, 236), (140, 241), (122, 238), (102, 243), (82, 239), (62, 243), (44, 239), (24, 242)]
    cape = poly([(76, 96), (150, 96), (160, 160), (160, 230)] + hem + [(20, 214), (28, 172), (44, 132), (60, 104)], smooth=False)
    A.part(cape, GB_CAPE, r=10, contrast=1.15, grad=(110, 244, 0.3))
    for (x0, x1) in ((68, 48), (78, 70), (92, 98), (104, 118), (58, 30)):
        A.fold([(x0, 108), (x0 - 6 + (x1 - x0) * 0.3, 160), (x1, 238)], GB_CAPE[1], GB_CAPE[4], clip=cape)
    for (x0, x1) in ((64, 40), (86, 84)):
        A.line([(x0 + 4, 140), (x0 + (x1 - x0) * 0.5, 190), (x1 + 3, 236)], GB_CAPE[2], clip=cape)
    lin = poly([(24, 242), (20, 214), (32, 218), (46, 240)])
    A.part(lin & cape, GB_CAPE_IN, r=4)
    trim = A.mask_line([(60, 104), (44, 132), (28, 172), (20, 214), (24, 242)]) | A.mask_line(hem[::-1])
    trim = dilate(trim) & cape
    A.part(trim, gl, r=1, line=False, dither=0.2)
    for x in range(30, 156, 8):
        A.px(x, 240 + ((x // 8) % 2), gl[5], only=True)

    # ---------------- jambes (cuissards, grèves, bottes à revers d'hermine)
    legs = []
    for (hip, knee, ank, toe, b) in (((100, 194), (94, 212), (92, 226), (110, 243), -0.06), ((136, 194), (142, 212), (146, 226), (170, 243), 0.04)):
        leg = stroke([hip, knee, ank], [15, 12, 11])
        A.part(leg, GB_BLK, r=7, bias=b, spec=METAL_SPEC)
        A.line([(knee[0] - 6, knee[1] + 4), (ank[0] - 7, ank[1] - 2)], GB_BLK[5], clip=leg)
        bx, by = ank
        boot = rounded_rect(bx - 1, by + 9, 28, 20, 0, 5) | ell(toe[0] - 10, toe[1] - 7, 13, 8)
        boot &= YY <= toe[1] + 1
        A.part(boot, GB_BLK, r=7, bias=b + 0.04, spec=METAL_SPEC)
        cap = boot & ell(toe[0] - 6, toe[1] - 7, 10, 9) & (XX > bx + 6)
        A.part(cap, gl, r=4, contrast=1.4, spec=(0.98, gl[5]))
        A.line([(bx + 7, by + 6), (bx + 6, toe[1] - 2)], gl[1], smooth=False, clip=cap)
        sole = boot & (YY >= toe[1] - 1)
        A.fill(sole, GB_BLK[1], pid=A.n)
        for x in range(bx - 13, toe[0], 5):
            A.px(x, toe[1] - 1, GB_BLK[4], only=True)
        cuffb = stroke([(bx - 15, by + 1), (bx, by - 1), (bx + 14, by)], 5)
        A.part(cuffb, GB_ERM, r=3, tex=(NOISE - 0.5) * 0.4, dither=0.5)
        for x in range(bx - 15, bx + 15, 3):
            A.px(x, by + 5 + (x % 2), GB_ERM[2], only=True)
        A.pxs([(bx - 6, by - 2), (bx - 6, by - 1), (bx - 6, by), (bx - 7, by + 1), (bx - 5, by + 1)], '#120e18', only=True)
        A.pxs([(bx + 6, by - 2), (bx + 6, by - 1), (bx + 6, by), (bx + 5, by + 1), (bx + 7, by + 1)], '#120e18', only=True)
        legs.append(knee)

    # ---------------- torse
    torso = poly([(72, 100), (160, 98), (170, 140), (164, 184), (76, 186), (64, 140)], smooth=True)
    A.part(torso, GB_BLK, r=14, contrast=1.3, bias=-0.04, tex=(noise(3, 2) - 0.5) * 0.05, spec=METAL_SPEC)
    for y0 in (130, 154):
        A.fold([(66, y0), (118, y0 + 5), (168, y0)], GB_BLK[0], gl[2], clip=torso, off=(0, -1))
    # filets dorés gravés sur les flancs
    for side in (0, 1):
        x0 = 70 if side == 0 else 164
        d = 1 if side == 0 else -1
        A.line([(x0 + d * 4, 108), (x0 + d * 2, 126)], gl[2], clip=torso)
        A.line([(x0 + d * 3, 136), (x0 + d * 4, 150)], gl[2], clip=torso)
    for (x, y) in ((76, 134), (160, 132), (78, 160), (158, 158), (74, 110), (162, 108)):
        A.rivet(x, y, gl)
    # volutes dorées gravées + runes du plastron
    for (pts) in ([(84, 112), (78, 118), (80, 124), (86, 122)], [(152, 112), (158, 118), (156, 124), (150, 122)],
                  [(86, 140), (80, 146), (84, 150)], [(150, 140), (156, 146), (152, 150)]):
        A.line(pts, gl[3], clip=torso)
        A.line([(x + 1, y + 1) for x, y in pts], GB_BLK[0], clip=torso)
    rune_glyph(A, 80, 160, 5, 1, halo=GB_RUNE[1], carve=GB_BLK[0])
    rune_glyph(A, 152, 159, 1, 1, halo=GB_RUNE[1], carve=GB_BLK[0])

    # ---------------- tassettes (jupe de plaques)
    for i, (x0, x1) in enumerate(((70, 98), (94, 122), (118, 146), (142, 168))):
        yb = 210 - abs(i - 1.5) * 3
        t = poly([(x0, 182), (x1, 182), (x1 + 3, yb), (x0 - 2, yb + 1)])
        A.part(t, GB_BLK, r=6, bias=0.06 - 0.04 * i, spec=METAL_SPEC)
        rim = t & ((YY >= yb - 4) | ~erode(erode(t)))
        A.part(rim & t & (YY > 186), gl, r=2, line=False, contrast=1.3)
        rune_glyph(A, (x0 + x1) // 2 - 2, 190, i + 2, 1, halo=GB_RUNE[1])
    # genouillères (par-dessus)
    for knee in legs:
        kp = ell(knee[0] + 1, knee[1], 10.5, 8.5)
        A.part(kp, GB_BLK, r=5, contrast=1.3, bias=0.08, spec=METAL_SPEC)
        A.part(kp & ~erode(erode(kp)), gl, r=2, line=False, contrast=1.3)
        A.part(poly([(knee[0] - 2, knee[1] - 2), (knee[0] + 1, knee[1] - 13), (knee[0] + 4, knee[1] - 2)]), gl, r=2, contrast=1.3)
        A.gem(knee[0] + 1, knee[1] + 1, 2.2, 2.2, GB_RUBY)
    # ceinture et boucle
    belt = poly([(68, 170), (168, 168), (168, 185), (70, 187)])
    A.part(belt, GB_LEATH, r=4)
    A.line([(70, 172), (168, 170)], gl[3], smooth=False)
    A.line([(70, 184), (168, 182)], gl[1], smooth=False)
    for x in range(74, 166, 10):
        A.rivet(x, 177, gl)

    # ---------------- bras arrière (poing sur la hanche)
    upper = stroke([(80, 112), (62, 128), (52, 146)], [13, 12, 10])
    A.part(upper, GB_BLK, r=7, spec=METAL_SPEC)
    A.line([(70, 116), (56, 134)], GB_BLK[5], clip=upper)
    fore = stroke([(52, 148), (56, 164), (66, 176)], [10, 10, 9])
    A.part(fore, GB_BLK, r=6, spec=METAL_SPEC)
    cou = ell(53, 146, 9.5, 8.5)
    A.part(cou, GB_BLK, r=4, contrast=1.3, bias=0.1, spec=METAL_SPEC)
    A.part(cou & ~erode(erode(cou)), gl, r=1, line=False, contrast=1.3)
    A.gem(53, 146, 2.5, 2.5, GB_RUBY)
    cuff = stroke([(56, 162), (62, 170)], 9.5)
    A.part(cuff, GB_BLK, r=4, bias=0.05, spec=METAL_SPEC)
    A.part(cuff & ~erode(erode(cuff)) & (YY > 160), gl, r=1, line=False, contrast=1.3)
    fist = ell(70, 178, 10, 9)
    A.part(fist, GB_BLK, r=5, bias=0.08, spec=METAL_SPEC)
    for k in range(3):
        A.line([(66 + k * 4, 172), (67 + k * 4, 182)], GB_BLK[1])
        A.px(65 + k * 4, 174, GB_BLK[6], only=True)

    # ---------------- pauldron arrière
    pf = ell(76, 110, 20, 17, -10)
    A.part(pf, GB_BLK, r=9, spec=METAL_SPEC)
    pfr = pf & ~erode(erode(erode(pf)))
    A.part(pfr & (YY > 100), gl, r=2, line=False, contrast=1.3)
    # ---------------- col d'hermine
    erm = stroke([(64, 104), (90, 96), (116, 94), (142, 96), (166, 104)], [10, 11, 11, 11, 10])
    fur_tex = (noise(11, 1) - 0.5) * 0.3 + (np.sin(XX * 1.3 + YY * 0.4) * 0.08)
    A.part(erm, GB_ERM, r=7, tex=fur_tex, dither=0.7)
    for x in range(62, 170, 4):
        yb = 104 + int(4 * math.sin((x - 64) / 104 * math.pi)) + 8
        A.px(x, yb + 1, GB_ERM[2])
        A.px(x + 1, yb + 2, GB_ERM[1])
    for (x, y) in ((74, 104), (96, 100), (124, 99), (150, 101), (85, 97), (138, 97), (160, 106)):
        A.pxs([(x, y), (x, y + 1), (x, y + 2), (x - 1, y + 3), (x + 1, y + 3)], '#120e18', only=True)

    # ---------------- tête : cheveux arrière
    hairb = ell(104, 68, 25, 26) | stroke([(92, 70), (86, 92), (84, 108)], [14, 12, 7])
    A.part(hairb, GB_BEARD, r=9, tex=(np.sin(XX * 0.9 + YY * 0.3) * 0.1), spec=(0.975, GB_BEARD[6]))
    for k in range(7):
        A.line([(80 + k * 5, 50 + k), (78 + k * 4, 78), (82 + k * 3, 104)], GB_BEARD[1] if k % 2 else GB_BEARD[2], clip=hairb)
    ear = ell(96, 74, 5, 7)
    A.part(ear, GB_SKIN, r=3)
    A.line([(96, 71), (95, 76)], GB_SKIN[1])
    A.gem(96, 81, 1.6, 1.6, GB_GOLD[2:] + [GB_GOLD[5]])
    # visage
    face = ell(118, 70, 21, 23)
    A.part(face, GB_SKIN, r=12, contrast=0.9, bias=0.06, lit_edge=False)
    A.line([(110, 52), (126, 51)], GB_SKIN[2])
    A.line([(112, 55), (124, 54)], GB_SKIN[3])
    for (x, y) in ((106, 76), (107, 76), (108, 77), (127, 77), (128, 76)):
        A.px(x, y, '#e07a6a')
    aeye(A, 104, 64, 7, 5, GB_IRIS, outer=-1, white='#f4ece8', lid=1)
    aeye(A, 122, 64, 5, 5, GB_IRIS, outer=1, white='#efe4e0', lid=1)
    for x in range(103, 112):
        A.px(x, 70, GB_SKIN[2])
    for x in range(121, 128):
        A.px(x, 70, GB_SKIN[2])
    # sourcils broussailleux froncés
    for (pts, rr_) in (([(119, 62), (126, 58), (134, 60)], [3, 3.4, 2]), ([(98, 60), (106, 57), (115, 62)], [2, 3.4, 3])):
        bm = stroke(pts, rr_)
        A.part(bm, GB_BEARD, r=2, bias=0.18, tex=(NOISE - 0.5) * 0.4)
    A.line([(120, 60), (126, 57), (131, 58)], GB_BEARD[6])
    A.line([(100, 58), (106, 56), (111, 58)], GB_BEARD[6])
    # nez
    nose = ell(130, 74, 7, 6)
    A.part(nose, GB_SKIN, r=5, bias=0.12, contrast=1.2)
    A.pxs([(127, 71), (128, 71), (127, 72)], GB_SKIN[5])
    A.pxs([(133, 78), (134, 78), (135, 77)], GB_SKIN[1])

    # ---------------- barbe
    beard = poly([(96, 74), (102, 80), (114, 82), (126, 80), (140, 78), (148, 90), (152, 112), (148, 138), (140, 160),
                  (124, 172), (106, 170), (94, 152), (88, 126), (88, 98)], smooth=True)
    btex = np.sin((XX - 0.3 * YY) * 0.8) * 0.1 + (noise(5, 1) - 0.5) * 0.1
    A.part(beard, GB_BEARD, r=14, tex=btex, contrast=1.1, spec=(0.975, GB_BEARD[6]))
    beard_flow(A, beard, 118, 80, 170, 70, GB_BEARD, 4, conv=0.6)
    # nattes
    for (x0, y0, x1, y1) in ((108, 164, 104, 204), (130, 162, 136, 202)):
        n = 7
        for i in range(n):
            t = i / (n - 1)
            x = x0 + (x1 - x0) * t + (2 if i % 2 else -2)
            y = y0 + (y1 - y0) * t
            seg = ell(x, y, 7 - t * 2.5, 4.4, 28 if i % 2 else -28)
            A.part(seg, GB_BEARD, r=3, bias=0.06, tex=(NOISE - 0.5) * 0.2)
            A.line([(x - 3, y - 2 * (1 if i % 2 else -1)), (x + 2, y + 1.5 * (1 if i % 2 else -1))], GB_BEARD[5], smooth=False, clip=seg)
        for (t, wd, hh) in ((0.4, 7, 4), (0.86, 6, 3)):
            rx_, ry_ = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
            ring = rounded_rect(rx_, ry_, wd * 2, hh * 2 + 1, 0, 2)
            A.part(ring, gl, r=3, contrast=1.4, spec=(0.98, gl[5]))
            A.line([(rx_ - wd + 2, ry_ + 0.5), (rx_ + wd - 2, ry_ + 0.5)], gl[1], smooth=False)
            A.px(rx_ - wd + 2, ry_ - hh + 1, gl[5])
        tip = ell(x1, y1 + 3, 4, 5)
        A.part(tip, GB_BEARD, r=3, bias=0.15)
    # moustache
    for (pts, rr_) in (([(130, 79), (118, 84), (106, 90), (98, 100)], [5, 6, 4, 2]),
                       ([(132, 80), (141, 86), (147, 96), (148, 106)], [5, 5, 3, 1.5])):
        mm = stroke(pts, rr_)
        A.part(mm, GB_BEARD, r=4, bias=0.22, tex=np.sin(XX * 1.4 + YY * 1.4) * 0.1)
    A.line([(126, 82), (114, 87), (104, 94)], GB_BEARD[6])
    A.line([(134, 82), (141, 88)], GB_BEARD[6])
    A.line([(122, 92), (130, 91)], '#4a1010', smooth=False)
    A.line([(123, 93), (129, 92)], GB_BEARD[2], smooth=False)

    # ---------------- couronne
    band = poly([(90, 50), (118, 45), (146, 46), (146, 58), (118, 56), (90, 60)])
    crown = band.copy()
    fl = ((93, 16, 6), (107, 22, 7), (124, 30, 8), (141, 20, 7))
    for (bx, h_, w_) in fl:
        by = 50 - (bx - 90) * 0.06
        crown |= poly([(bx - w_, by + 2), (bx - w_ * 0.4, by - h_ * 0.45), (bx, by - h_), (bx + w_ * 0.4, by - h_ * 0.45), (bx + w_, by + 2)])
        crown |= ell(bx, by - h_ - 1, 3, 3)
    # arceaux (pointes basses entre les fleurons)
    for bx in (100, 116, 133):
        by = 50 - (bx - 90) * 0.06
        crown |= poly([(bx - 3, by + 1), (bx, by - 7), (bx + 3, by + 1)])
    A.part(crown, gl, r=5, contrast=1.35, tex=(noise(9, 1) - 0.5) * 0.06, spec=(0.98, gl[5]))
    A.part(band, gl, r=4, contrast=1.25, bias=0.05)
    A.line([(91, 51), (118, 46), (145, 47)], gl[5])
    A.line([(91, 59), (118, 55), (145, 57)], gl[1])
    for (bx, h_, w_) in fl:
        by = 50 - (bx - 90) * 0.06
        A.line([(bx - 1, by - h_ + 3), (bx - 2, by)], gl[5])
        A.line([(bx + 2, by - h_ * 0.4), (bx + w_ - 2, by)], gl[1])
    for x in range(93, 146, 4):
        A.px(x, 53 - (x - 90) * 0.06, gl[1], only=True)
    A.gem(99, 53, 3, 3, GB_RUBY)
    A.gem(124, 51, 4, 4, GB_SAPH, sparkle=True)
    A.gem(140, 52, 2.5, 3, GB_RUBY)
    A.gem(124, 19, 2.5, 2.5, GB_RUBY)
    A.gem(107, 26, 2, 2, GB_SAPH)
    A.gem(141, 28, 2, 2, GB_SAPH)

    # ---------------- pauldron avant (trois lames)
    for (dy, rx, ry) in ((22, 17, 9), (14, 19, 10)):
        lame = ell(158, 106 + dy, rx, ry, 15)
        A.part(lame, GB_BLK, r=6, spec=METAL_SPEC)
        A.part(lame & ~erode(erode(lame)) & (YY > 106 + dy - 2), gl, r=1, line=False)
    pn = ell(156, 106, 23, 18, 12)
    A.part(pn, GB_BLK, r=11, contrast=1.2, tex=(noise(21, 2) - 0.5) * 0.05, spec=METAL_SPEC)
    pnr = pn & ~erode(erode(erode(pn)))
    A.part(pnr, gl, r=2, line=False, contrast=1.35)
    A.line([(140, 96), (154, 90), (170, 94)], gl[5], clip=pnr)
    # pointe de pauldron
    spk = poly([(150, 94), (160, 74), (164, 92)])
    A.part(spk, gl, r=3, contrast=1.3)
    A.line([(156, 90), (159, 78)], gl[5])
    rune_glyph(A, 152, 100, 0, 2, halo=GB_RUNE[1], carve=GB_BLK[0])
    for (x, y) in ((140, 110), (172, 112), (156, 120)):
        A.rivet(x, y, gl)

    # ---------------- marteau runique
    sb, st = (166, 240), (200, 52)
    shaft = stroke([sb, st], 5, smooth=False)
    A.part(shaft, GB_WOOD, r=3, tex=np.sin(YY * 0.9 + XX * 0.2) * 0.1)
    for t in np.arange(0.28, 0.52, 0.035):
        x, y = sb[0] + (st[0] - sb[0]) * t, sb[1] + (st[1] - sb[1]) * t
        A.line([(x - 5, y + 2), (x + 5, y - 1)], GB_LEATH[4], smooth=False, clip=shaft)
        A.line([(x - 5, y + 3), (x + 5, y)], GB_LEATH[1], smooth=False, clip=shaft)
    for t in (0.06, 0.25, 0.55, 0.78):
        x, y = sb[0] + (st[0] - sb[0]) * t, sb[1] + (st[1] - sb[1]) * t
        ring = stroke([(x - 0.4, y + 2.5), (x + 0.4, y - 2.5)], 6.4, smooth=False)
        A.part(ring, gl, r=3, contrast=1.35, spec=(0.98, gl[5]))
    pom = poly([(sb[0] - 8, sb[1] - 9), (sb[0] + 8, sb[1] - 10), (sb[0] + 6, sb[1] + 1), (sb[0], sb[1] + 4), (sb[0] - 6, sb[1] + 2)])
    A.part(pom, gl, r=4, contrast=1.35)
    A.gem(sb[0], sb[1] - 4, 2.5, 2.5, GB_RUBY)
    # tête du marteau : bloc biseauté, faces de frappe évasées cerclées d'or, cœur runique
    ang = 10
    cx, cy = 202, 56
    P = lambda dx, dy: (cx + rot((dx, dy), ang)[0], cy + rot((dx, dy), ang)[1])
    core = rounded_rect(cx, cy, 50, 36, ang, 5)
    A.part(core, GB_BLK, r=10, contrast=1.25, tex=(noise(13, 1) - 0.5) * 0.06, spec=METAL_SPEC)
    panel = rounded_rect(*P(0, 0), 30, 24, ang, 4)
    A.part(panel, GB_BLK, r=5, bias=-0.12, contrast=0.8)
    for side in (-1, 1):
        face_m = rounded_rect(*P(side * 29, 0), 14, 50, ang, 3)
        A.part(face_m, GB_BLK, r=6, contrast=1.3, bias=0.1, spec=METAL_SPEC)
        band_m = rounded_rect(*P(side * 23, 0), 5, 46, ang, 1)
        A.part(band_m, gl, r=2, contrast=1.35)
        cap_m = rounded_rect(*P(side * 35, 0), 4, 44, ang, 1)
        A.part(cap_m, gl, r=1, line=False, contrast=1.2)
        for dy in (-18, -6, 6, 18):
            A.rivet(*[int(v) for v in P(side * 29, dy)], gl)
    tp = P(0, -18)
    spike = poly([(tp[0] - 8, tp[1] + 2), (tp[0] + 1, tp[1] - 14), (tp[0] + 8, tp[1] + 1)])
    A.part(spike, gl, r=3, contrast=1.35)
    A.line([(tp[0] - 2, tp[1] - 2), (tp[0], tp[1] - 10)], gl[5])
    # sceau runique : cercle + rune centrale, incandescents
    ring = ell(*P(0, 0), 10, 10) & ~ell(*P(0, 0), 8, 8)
    ring &= A.a
    A.glow(ring, GB_RUNE[0], 0.6, 2)
    A.rgb[ring] = rgb(GB_RUNE[2])
    A.rgb[ring & (YY < P(0, 0)[1] - 3)] = rgb(GB_RUNE[3])
    c0 = P(0, 0)
    rune_glyph(A, int(c0[0]) - 4, int(c0[1]) - 6, 6, 2, halo=GB_RUNE[0])
    for k in range(8):
        a = math.radians(k * 45 + 22)
        A.px(c0[0] + 12 * math.cos(a), c0[1] + 12 * math.sin(a), GB_RUNE[1], only=True)
    for side in (-1, 1):
        for dy in (-11, 11):
            q = P(side * 13, dy)
            A.px(q[0], q[1], GB_RUNE[2], only=True)

    # ---------------- bras avant (gantelet sur le manche)
    up = stroke([(160, 116), (174, 134), (180, 148)], [13, 12, 10])
    A.part(up, GB_BLK, r=7, spec=METAL_SPEC)
    cou2 = ell(176, 138, 9.5, 8.5, 30)
    A.part(cou2, GB_BLK, r=4, contrast=1.3, bias=0.1, spec=METAL_SPEC)
    A.part(cou2 & ~erode(erode(cou2)), gl, r=1, line=False, contrast=1.3)
    A.gem(176, 138, 2, 2, GB_RUBY)
    gaunt = stroke([(180, 146), (182, 156)], 10.5)
    A.part(gaunt, GB_BLK, r=5, contrast=1.2, bias=0.05, spec=METAL_SPEC)
    A.part(gaunt & ~erode(erode(gaunt)) & (YY > 150), gl, r=1, line=False, contrast=1.3)
    rune_glyph(A, 179, 147, 1, 1, core=GB_RUNE[3], mid=GB_RUNE[1])
    fist2 = ell(182, 162, 10.5, 8.5)
    A.part(fist2, GB_BLK, r=5, bias=0.08, spec=METAL_SPEC)
    for k in range(4):
        A.line([(175 + k * 4, 157), (176 + k * 4, 168)], GB_BLK[1])
        A.px(174 + k * 4, 159, GB_BLK[6], only=True)

    A.finish()
    # forge : halo de braise autour de la tête du marteau et du sceau
    aura(A, ring | rune_glyph(A, int(c0[0]) - 4, int(c0[1]) - 6, 6, 2), [GB_RUNE[2], GB_RUNE[1], GB_RUNE[0]], seed=5, sparse=0.3)
    aura(A, core | spike, ['#ffb040', GB_RUNE[0]], seed=6, sparse=0.18)
    rr = random.Random(11)
    for i in range(22):
        x = rr.randint(150, 250)
        y = rr.randint(8, 130)
        if A.a[max(0, y - 1):y + 2, max(0, x - 1):x + 2].any():
            continue
        A.px(x, y, GB_RUNE[rr.randint(1, 3)])
        if rr.random() < 0.4:
            A.px(x, y + 1, GB_RUNE[0])
    A.fx = []
    A.sparkle(236, 18, 3, '#fff6c0', GB_RUNE[2])
    A.sparkle(42, 62, 2, '#fff6c0', GB_RUNE[1])
    A.sparkle(170, 24, 2, '#fff6c0', GB_RUNE[1])
    A.apply_fx()
    return A


# ================================================================== DEMONESS
DM_HAIR = ['#050308', '#0a0510', '#120a1c', '#1c1028', '#2a1838', '#4e2e66', '#8a5aa8']
DM_IRIS = ['#8a0a10', '#ff3a2a', '#ffe04a', '#fff6b0']
DM_HORN = ['#1a0810', '#3a0e18', '#5e1622', '#8a2230', '#b8343a', '#e05a4a', '#ff9a7a']
DM_RED = ['#24040a', '#3a0610', '#6e0c1e', '#a8182c', '#e0343c', '#ff7a6a']
DM_BLK = ['#06040a', '#0c0812', '#1a1424', '#2c2238', '#463858', '#6e5e88', '#9a8ab8']
DM_WING = ['#160308', '#24060e', '#4e0c1c', '#82162c', '#b8283a', '#e8525a']
DM_BONE = ['#0a050c', '#160a14', '#241424', '#3a2234', '#5a3448']
DM_SKIN = ['#6e3440', '#a05860', '#dc9488', '#f4b8a4', '#fcd0bc', '#ffe8dc']
DM_GOLD = ['#5a2a0c', '#9a5418', '#d8902a', '#f6c650', '#fff0a0']
DM_FIRE = ['#8a1408', '#e0401a', '#ff8a1a', '#ffd04a', '#fff6c0']


def flame(A, x, y, h, w, seed, cols=DM_FIRE, lean=0.0):
    """Langue de feu montante (dessinée comme effet, par-dessus)."""
    rr = random.Random(seed)
    wob = rr.uniform(1.5, 3.0) * (1 if rr.random() < 0.5 else -1)
    pts = [(x, y + 2), (x + lean * h * 0.2 + wob, y - h * 0.3), (x + lean * h * 0.5 - wob, y - h * 0.62), (x + lean * h * 0.8 + wob * 0.5, y - h)]
    m = stroke(pts, [w, w * 1.05, w * 0.55, 0.3])
    core = stroke(pts[:3], [w * 0.6, w * 0.5, 0.3])
    return m, core


@character('demoness')
def demoness():
    A = Art(accent='#ff6a3a')
    cx, cy = 120, 52
    # ---------------- ailes (derrière)
    def wing(root, wrist, tips, ramp, bone, scale=1.0, dark=0.0):
        mem_pts = [root, wrist]
        for i, t in enumerate(tips):
            mem_pts.append(t)
            if i < len(tips) - 1:
                nt = tips[i + 1]
                mx_, my_ = (t[0] + nt[0]) / 2, (t[1] + nt[1]) / 2
                # échancrure entre deux doigts (vers la racine)
                mem_pts.append((mx_ + (root[0] - mx_) * 0.22, my_ + (root[1] - my_) * 0.22))
        mem_pts.append((root[0] - 2, root[1] + 26 * scale))
        mem = poly(mem_pts)
        A.part(mem, ramp, r=8, bias=-0.05 - dark, contrast=1.1, grad=(0, 160, 0.2))
        # nervures de membrane
        for t in tips:
            A.line([wrist, ((wrist[0] + t[0]) / 2 + 2, (wrist[1] + t[1]) / 2 + 2), t], ramp[1], clip=mem)
        # os : bras de l'aile + doigts
        A.part(stroke([root, ((root[0] + wrist[0]) / 2, (root[1] + wrist[1]) / 2 - 4), wrist], [4 * scale, 3.4 * scale, 3 * scale]),
               bone, r=3, bias=0.1 - dark)
        for t in tips:
            A.part(stroke([wrist, t], [2.4 * scale, 1.0], smooth=False), bone, r=2, bias=0.05 - dark)
        claw = poly([(wrist[0] - 2, wrist[1]), (wrist[0] + 3, wrist[1] - 9 * scale), (wrist[0] + 3, wrist[1] + 1)])
        A.part(claw, DM_HORN, r=2, bias=0.2)
        return mem
    wing((136, 92), (160, 40), [(178, 22), (192, 44), (190, 70), (170, 88)], DM_WING, DM_BONE, 0.8, dark=0.12)
    wing((102, 96), (52, 34), [(14, 22), (6, 70), (22, 112), (50, 132), (80, 128)], DM_WING, DM_BONE, 1.0)

    # ---------------- cheveux arrière (longue masse noire)
    hb = ell(cx - 2, cy - 6, 24, 23) | poly([(96, 50), (144, 50), (148, 74), (140, 100), (126, 130), (110, 152), (88, 148), (80, 120), (84, 80)], smooth=True)
    A.part(hb, DM_HAIR, r=10, bias=-0.22, spec=(0.975, DM_HAIR[5]))
    for k in range(7):
        x0 = 92 + k * 6
        A.line([(x0, 50), (x0 - 4 + k, 100), (x0 - 6 + k * 1.5, 146)], DM_HAIR[0] if k % 2 else DM_HAIR[3], clip=hb)

    # ---------------- queue
    tail = stroke([(108, 142), (82, 166), (66, 196), (70, 222), (88, 228), (98, 220)], [5, 4.5, 4, 3.5, 3, 2.5])
    A.part(tail, DM_BLK, r=3, bias=0.05, spec=(0.98, DM_BLK[6]))
    spade = poly([(96, 222), (104, 206), (112, 212), (110, 220), (116, 224), (104, 230)], smooth=True)
    A.part(spade, DM_RED, r=4, contrast=1.3, bias=0.05)

    # ---------------- jambes
    # jambe arrière
    A.part(stroke([(110, 146), (106, 170), (103, 192), (102, 212), (100, 230)], [13, 10.5, 7.5, 8, 5]), DM_SKIN, r=7, bias=-0.1)
    bootb = stroke([(106, 172), (103, 192), (102, 212), (100, 230)], [10, 8, 8.5, 5.8])
    bootb |= ell(105, 238, 9, 6)
    bootb &= YY <= 244
    A.part(bootb, DM_BLK, r=5, bias=-0.05, spec=(0.975, DM_BLK[6]))
    A.part(poly([(96, 236), (100, 236), (100, 244), (97, 244)]), DM_BLK, r=1)  # talon
    # jambe avant
    A.part(stroke([(134, 146), (139, 170), (143, 192), (146, 212), (148, 230)], [13, 11, 7.5, 8, 5]), DM_SKIN, r=7)
    bootf = stroke([(139, 172), (143, 192), (146, 212), (148, 230)], [10.5, 8, 8.5, 6])
    bootf |= ell(154, 238, 10, 6)
    bootf &= YY <= 244
    A.part(bootf, DM_BLK, r=5, spec=(0.975, DM_BLK[6]))
    A.part(poly([(142, 234), (147, 234), (146, 244), (143, 244)]), DM_BLK, r=1)
    for (x0, y0) in ((94, 170), (128, 170)):
        cuff = poly([(x0, y0 + 2), (x0 + 22, y0 - 1), (x0 + 23, y0 + 4), (x0 + 1, y0 + 7)])
        A.part(cuff, DM_RED, r=2, contrast=1.2)
        A.line([(x0 + 1, y0 + 6), (x0 + 22, y0 + 3)], DM_GOLD[3])
    for y in range(182, 226, 7):  # lacets
        A.px(144 + (y - 182) * 0.1, y, DM_RED[4], only=True)
        A.px(145 + (y - 182) * 0.1, y + 1, DM_RED[3], only=True)

    # ---------------- bras arrière (paume levée : boule de feu)
    A.part(stroke([(100, 92), (86, 110), (76, 120)], [8.5, 6.5, 5.5]), DM_BLK, r=5, bias=-0.06)
    A.part(stroke([(84, 112), (77, 119)], 6), DM_RED, r=2, contrast=1.2)
    hand(A, 72, 120, DM_SKIN, r=5, closed=False, ang=20)
    # ---------------- jupe (volants rouges, ourlet doré)
    sk = poly([(100, 124), (140, 124), (152, 140), (160, 158), (148, 162), (132, 164), (114, 166), (96, 164), (84, 158), (92, 140)], smooth=True)
    A.part(sk, DM_RED, r=9, contrast=1.2, spec=(0.98, DM_RED[5]))
    for x0, x1 in ((106, 98), (118, 116), (130, 134), (140, 150)):
        A.fold([(x0, 128), (x1, 162)], DM_RED[1], DM_RED[4], clip=sk)
    # volant noir sous la jupe
    under = poly([(84, 156), (160, 154), (156, 166), (88, 168)])
    A.part(under & ~sk, DM_BLK, r=3)
    hem = A.mask_line([(84, 158), (96, 164), (114, 166), (132, 164), (148, 162), (160, 158)])
    A.part(dilate(hem) & sk, DM_GOLD, r=1, line=False)
    for x in range(88, 160, 6):
        A.gem(x, 163 - abs(x - 118) * 0.05, 1.3, 1.3, DM_RED[2:])

    # ---------------- corset
    tor = poly([(98, 86), (144, 86), (150, 100), (146, 112), (138, 126), (106, 128), (98, 112), (96, 98)], smooth=True)
    A.part(tor, DM_BLK, r=10, contrast=1.2, spec=(0.975, DM_BLK[6]))
    # poitrine
    bust = poly([(104, 94), (140, 92), (148, 102), (142, 112), (124, 112), (106, 110)], smooth=True) & tor
    A.part(bust, DM_BLK, r=6, bias=0.04, spec=(0.975, DM_BLK[6]))
    A.line([(126, 104), (128, 111)], DM_BLK[1], clip=bust)
    # laçage rouge en croix + bordure dorée
    for k in range(5):
        y = 106 + k * 4
        A.line([(116, y), (126, y + 3)], DM_RED[4], smooth=False)
        A.line([(126, y), (116, y + 3)], DM_RED[3], smooth=False)
    A.line([(98, 125), (120, 128), (141, 124)], DM_GOLD[3])
    A.line([(100, 88), (122, 93), (144, 88)], DM_GOLD[2])
    A.gem(121, 96, 3, 3, ['#3a0410', '#8a0a1c', '#e0202c', '#ff7a6a', '#ffe0d0'], sparkle=True)
    # col et épaules
    neck = stroke([(122, 70), (122, 86)], 6.5)
    A.part(neck, DM_SKIN, r=3, bias=-0.22)
    choker = stroke([(116, 79), (127, 78)], 2.2, smooth=False)
    A.part(choker, DM_BLK, r=1)
    A.px(122, 81, DM_GOLD[3])
    A.px(122, 82, DM_RED[4])
    # épaulettes : petites pointes cornues sur un liseré rouge
    for (x, y) in ((100, 88), (143, 88)):
        A.part(ell(x, y + 2, 8, 5), DM_RED, r=3, contrast=1.2)
        A.part(poly([(x - 4, y), (x + 1, y - 10), (x + 4, y)]), DM_HORN, r=2, bias=0.15)

    # ---------------- tête
    headm = anime_head(A, cx, cy, DM_SKIN, DM_IRIS, DM_HAIR[3], mouth_kind='smile', lip='#e0606a', mouth_dark='#5a0a1a',
               blush_c='#f07a8a', glow=DM_IRIS[3], brow_ang=1, neck=neck)
    ear = poly([(103, 56), (84, 44), (106, 64)])
    A.part(ear, DM_SKIN, r=2)
    # ---------------- cornes
    for (pts, rad) in (([(106, 38), (98, 26), (88, 18), (78, 16), (72, 20)], [5.5, 5, 4, 2.5, 0.8]),
                       ([(128, 36), (136, 24), (135, 14), (128, 9), (121, 11)], [6, 5.5, 4.5, 2.6, 0.8])):
        hm = stroke(pts, rad)
        A.part(hm, DM_HORN, r=4, contrast=1.2, spec=(0.975, DM_HORN[6]))
        path = resample(catmull(pts), 4.0)
        for (x, y) in path[1:-2]:
            A.px(x + 1, y + 1, DM_HORN[1], only=True)
            A.px(x + 2, y + 1, DM_HORN[1], only=True)
    # ---------------- frange et mèches avant
    fr = [((104, 34), (101, 54)), ((110, 30), (109, 50)), ((117, 30), (118, 47)), ((124, 30), (127, 49)), ((131, 32), (135, 47)),
          ((137, 36), (141, 56))]
    A.part(ell(120, 38, 22, 12) & ~(YY > 42), DM_HAIR, r=5, bias=-0.1, spec=(0.975, DM_HAIR[5]))
    hfm = np.zeros((H, W), bool)
    for i, (a, b) in enumerate(fr):
        hfm |= lock(A, [a, ((a[0] + b[0]) / 2 - 1, (a[1] + b[1]) / 2), b], [4.5, 3.5, 0.6], DM_HAIR, r=3, bias=-0.15, hi=DM_HAIR[5] if i % 2 else None,
             spec=(0.975, DM_HAIR[5]))
    cast_shadow(A, hfm, headm, 0, 2, DM_SKIN[2], only=DM_SKIN[3:])
    # longues mèches latérales
    lock(A, [(102, 38), (97, 66), (96, 96), (90, 120)], [6, 6.5, 4.5, 1], DM_HAIR, r=4, bias=-0.2, hi=DM_HAIR[4])
    lock(A, [(140, 40), (146, 64), (150, 90), (156, 110)], [5, 5.5, 4, 1], DM_HAIR, r=4, bias=-0.2, hi=DM_HAIR[5])
    # reflet « anneau » sur le dessus
    A.line([(106, 31), (112, 29), (118, 29)], DM_HAIR[6], only=True)

    # ---------------- faux (manche, lame, flammes)
    sb, st = (190, 240), (178, 30)
    A.part(stroke([sb, st], 3.2, smooth=False), DM_BLK, r=2, bias=0.05, spec=(0.97, DM_BLK[6]))
    for t in (0.25, 0.55, 0.85):
        x, y = sb[0] + (st[0] - sb[0]) * t, sb[1] + (st[1] - sb[1]) * t
        A.part(stroke([(x, y - 2), (x, y + 2)], 4.4, smooth=False), DM_GOLD, r=2, contrast=1.3)
    A.part(poly([(186, 236), (194, 236), (190, 245)]), DM_HORN, r=2)
    # lame en croissant
    outer = [(176, 32), (192, 20), (212, 18), (232, 26), (244, 42), (248, 64)]
    inner = [(248, 64), (236, 46), (220, 36), (200, 34), (184, 42)]
    blade = poly(catmull(outer) + catmull(inner), smooth=False)
    A.part(blade, DM_BLK, r=6, contrast=1.2, spec=(0.97, DM_BLK[6]))
    edge = blade & ~erode(erode(erode(blade))) & ~shift(blade, 0, -4)
    A.part(edge, DM_RED, r=1, line=False, bias=0.1)
    A.line([(186, 38), (200, 32), (220, 33), (236, 42)], DM_RED[4], clip=blade)
    # gravure runique incandescente
    for (x, y) in ((198, 27), (212, 25), (226, 30)):
        A.px(x, y, DM_FIRE[3], only=True)
        A.px(x + 1, y, DM_FIRE[2], only=True)
    sock = ell(179, 34, 6, 7)
    A.part(sock, DM_GOLD, r=3, contrast=1.3)
    A.gem(179, 34, 2.2, 2.2, DM_RED[1:])
    A.part(poly([(172, 30), (176, 16), (182, 28)]), DM_HORN, r=2, bias=0.1)

    # ---------------- bras avant (gant noir, tient le manche)
    A.part(stroke([(142, 92), (158, 114), (176, 132)], [8.5, 6.5, 5.5]), DM_BLK, r=5, spec=(0.975, DM_BLK[6]))
    A.part(stroke([(170, 126), (178, 134)], 6), DM_RED, r=2, contrast=1.2)
    A.line([(167, 129), (174, 137)], DM_GOLD[3])
    hand(A, 185, 138, DM_SKIN, r=5.5, fingers=4)
    A.pxs([(181, 135), (181, 136)], DM_RED[2])

    A.finish()
    # flammes sur la lame et braises
    for i, (x, y, h_) in enumerate(((196, 21, 12), (212, 19, 16), (228, 25, 14), (241, 38, 11))):
        m, core = flame(A, x, y, h_, 4.2, i, lean=-0.35)
        m &= ~A.a | (YY < y)
        A.rgb[m] = rgb(DM_FIRE[1])
        A.rgb[dilate(m) & ~m & ~A.a] = rgb(DM_FIRE[0])
        A.a |= dilate(m)
        A.rgb[core & m] = rgb(DM_FIRE[3])
        A.rgb[erode(core) & m] = rgb(DM_FIRE[4])
    # boule de feu au creux de la main
    fb = ell(70, 106, 8, 8)
    for i, (dx, h_) in enumerate(((-5, 12), (0, 17), (5, 11))):
        m, core = flame(A, 70 + dx, 104, h_, 4.0, 20 + i, lean=-0.2)
        fb |= m
    fb &= ~A.a | (YY < 114)
    A.rgb[fb] = rgb(DM_FIRE[1])
    A.a |= fb
    inner_f = erode(erode(fb))
    A.rgb[inner_f] = rgb(DM_FIRE[2])
    A.rgb[erode(erode(inner_f)) & ell(70, 106, 6, 6)] = rgb(DM_FIRE[3])
    A.rgb[ell(69, 107, 3, 3)] = rgb(DM_FIRE[4])
    aura(A, fb, [DM_FIRE[0], DM_FIRE[1]], seed=12, sparse=0.3)
    rr = random.Random(5)
    for i in range(26):
        x, y = rr.randint(130, 252), rr.randint(0, 120)
        if A.a[max(0, y - 1):y + 2, max(0, x - 1):x + 2].any():
            continue
        A.px(x, y, DM_FIRE[rr.randint(2, 4)])
        if rr.random() < 0.5:
            A.px(x, y + 1, DM_FIRE[1])
    for (x, y) in ((30, 150), (44, 170), (160, 190), (176, 210)):
        A.px(x, y, DM_FIRE[3])
        A.px(x, y + 1, DM_FIRE[1])
    return A


# ================================================================== SERAPH
SE_SKIN = ['#7a4048', '#b06a56', '#e8a888', '#f8c8a8', '#ffdcc0', '#fff2e4']
SE_HAIR = ['#5a2240', '#8e3e5a', '#cc7088', '#f2a6b2', '#ffd6d6', '#fff4f2']
SE_IRIS = ['#0a3a6a', '#1aa8d8', '#a8f4ff', '#e0ffff']
SE_WING = ['#4a4a80', '#7270a8', '#aeb4e2', '#dfe4f8', '#f5f7ff', '#ffffff']
SE_TIP = ['#7a3e18', '#b0701e', '#eab53a', '#ffe27a']
SE_ROBE = ['#5a5890', '#8a88b8', '#bec2e2', '#e4e8f8', '#f8faff', '#ffffff']
SE_GOLD = ['#5a2a10', '#7a3e18', '#c0761e', '#eab53a', '#ffe27a', '#fffbd0']
SE_GEM = ['#06264a', '#0a4a8a', '#2a9af0', '#a8f0ff', '#ffffff']
SE_BLADE = ['#c0a060', '#ffe7a0', '#fff6d0', '#ffffff']
SE_BLUE = ['#0e1a4a', '#1a3080', '#2a50b8', '#4a7ae0', '#90b8ff']


@character('seraph')
def seraph():
    A = Art(accent='#ffe27a')
    cx, cy = 121, 55
    gold = SE_GOLD
    # ---------------- ailes
    feather_wing(A, (138, 92), (178, 42), SE_WING, tip=SE_TIP[1:], a_root=55, a_wrist=-30, l_root=30, l_wrist=60,
                 rows=((1.0, 7.5, 9), (0.64, 7, 8), (0.38, 6, 8)), seed=2, bias=-0.12, curl=-5)
    feather_wing(A, (104, 94), (56, 38), SE_WING, tip=SE_TIP[1:], a_root=112, a_wrist=206, l_root=38, l_wrist=56,
                 rows=((1.0, 8.5, 11), (0.64, 8, 10), (0.38, 6.5, 9)), seed=1, curl=6)
    # ---------------- cheveux arrière
    hb = ell(cx - 2, cy - 6, 25, 24) | poly([(98, 50), (146, 50), (152, 76), (146, 104), (138, 132), (124, 148), (104, 146), (92, 124), (90, 84)], smooth=True)
    A.part(hb, SE_HAIR, r=10, bias=-0.1, spec=(0.975, SE_HAIR[5]))
    for k in range(7):
        x0 = 94 + k * 7
        A.line([(x0, 50), (x0 - 2 + k * 0.5, 100), (x0 - 4 + k * 1.5, 144)], SE_HAIR[1] if k % 2 else SE_HAIR[3], clip=hb)

    # ---------------- robe
    robe = poly([(100, 86), (144, 86), (152, 120), (158, 168), (170, 236), (152, 242), (122, 244), (94, 242), (76, 236), (88, 168),
                 (96, 120)], smooth=True)
    A.part(robe, SE_ROBE, r=14, contrast=1.1, grad=(130, 244, 0.25))
    for (x0, x1) in ((104, 88), (112, 104), (138, 152), (146, 164)):
        A.fold([(x0, 132), ((x0 + x1) / 2 + 2, 190), (x1, 238)], SE_ROBE[1], SE_ROBE[5], clip=robe)
    for (x0, x1) in ((100, 94), (150, 158)):
        A.line([(x0, 160), (x1, 236)], SE_ROBE[2], clip=robe)
    # pan central brodé
    panel = poly([(116, 126), (132, 126), (140, 242), (110, 243)])
    A.part(panel & robe, SE_BLUE, r=5, bias=0.05)
    A.part(dilate(A.mask_line([(116, 126), (110, 243)], smooth=False)) & robe, gold, r=1, line=False)
    A.part(dilate(A.mask_line([(132, 126), (140, 242)], smooth=False)) & robe, gold, r=1, line=False)
    for y in range(140, 236, 16):
        xm = 124 + (y - 126) * 0.05
        A.gem(xm, y, 2, 2.5, gold[2:])
        A.line([(xm - 4, y + 5), (xm, y + 9), (xm + 4, y + 5)], gold[3], smooth=False)
    hem = A.mask_line([(76, 236), (94, 242), (122, 244), (152, 242), (170, 236)])
    A.part((hem | shift(hem, 0, -1) | shift(hem, 0, -2)) & robe, gold, r=1, line=False)
    for x in range(80, 168, 6):
        A.px(x, 239 + (0 if x < 122 else 0), gold[5], only=True)
    # bottes dorées sous l'ourlet
    for (x, y) in ((100, 242), (146, 242)):
        b = ell(x, y, 10, 5) & (YY <= 244)
        A.part(b & ~robe, gold, r=3, contrast=1.3)

    # ---------------- bras arrière (paume lumineuse)
    sl = stroke([(102, 92), (90, 114), (98, 132)], [9, 9, 10])
    A.part(sl, SE_ROBE, r=6, bias=-0.1)
    A.part(stroke([(94, 128), (100, 134)], 6), gold, r=2, contrast=1.3)
    hand(A, 104, 138, SE_SKIN, r=5, closed=False)

    # ---------------- cuirasse dorée
    plate = poly([(102, 88), (144, 88), (150, 104), (142, 120), (106, 122), (98, 104)], smooth=True)
    A.part(plate, gold, r=10, contrast=1.3, spec=(0.98, gold[5]))
    A.line([(124, 92), (124, 118)], gold[1], clip=plate)
    A.line([(123, 92), (123, 118)], gold[4], clip=plate)
    for (pts) in ([(108, 96), (114, 104), (110, 112)], [(140, 96), (134, 104), (138, 112)]):
        A.line(pts, gold[2], clip=plate)
    A.gem(124, 104, 4.5, 5, SE_GEM, sparkle=True)
    belt = poly([(98, 120), (150, 118), (152, 128), (98, 130)])
    A.part(belt, gold, r=3, contrast=1.2)
    A.gem(124, 124, 2.5, 2.5, SE_GEM)
    # col
    neck = stroke([(123, 72), (123, 86)], 6.5)
    A.part(neck, SE_SKIN, r=3, bias=-0.22)
    collar = stroke([(108, 86), (122, 90), (138, 86)], 3)
    A.part(collar, SE_ROBE, r=2, bias=0.1)

    # ---------------- tête
    headm = anime_head(A, cx, cy, SE_SKIN, SE_IRIS, SE_HAIR[1], mouth_kind='smile', lip='#e07a8a', blush_c='#ffa0b0', neck=neck)
    hfm = hair_front(A, cx, cy, SE_HAIR, spec_c=SE_HAIR[5])
    cast_shadow(A, hfm, headm, 0, 2, SE_SKIN[2], only=SE_SKIN[3:])
    lock(A, [(cx - 18, cy - 10), (cx - 22, cy + 16), (cx - 22, cy + 46), (cx - 26, cy + 64)], [6, 6.5, 4.5, 1], SE_HAIR, r=4,
         hi=SE_HAIR[4])
    lock(A, [(cx + 19, cy - 8), (cx + 25, cy + 14), (cx + 28, cy + 40), (cx + 33, cy + 56)], [5, 5.5, 4, 1], SE_HAIR, r=4,
         hi=SE_HAIR[4])
    # auréole
    ring = ell(118, 18, 24, 7, -6) & ~ell(118, 18, 19, 3.6, -6)
    A.part(ring, SE_GOLD, r=2, contrast=1.4, bias=0.15, line=True)
    A.line([(100, 14), (110, 12), (122, 11)], SE_GOLD[5], only=True)

    # ---------------- épaulière dorée (avant)
    pa = ell(146, 94, 12, 9, 20)
    A.part(pa, gold, r=6, contrast=1.3, spec=(0.98, gold[5]))
    A.part(pa & ~erode(erode(pa)) & (YY > 94), gold, r=1, line=False, bias=-0.3)
    A.gem(146, 93, 2.2, 2.2, SE_GEM)

    # ---------------- épée radieuse
    hx_, hy_ = 172, 120
    d = (216 - 178, 6 - 104)
    ln = math.hypot(*d)
    ux, uy = d[0] / ln, d[1] / ln
    base = (178, 104)
    tipp = (base[0] + ux * 104, base[1] + uy * 104)
    px_, py_ = -uy, ux
    blade = poly([(base[0] + px_ * 4.5, base[1] + py_ * 4.5), (base[0] - px_ * 4.5, base[1] - py_ * 4.5),
                  (tipp[0] - ux * 14 - px_ * 4, tipp[1] - uy * 14 - py_ * 4), tipp,
                  (tipp[0] - ux * 14 + px_ * 4, tipp[1] - uy * 14 + py_ * 4)])
    A.part(blade, SE_BLADE, r=3, contrast=1.2, bias=0.1, linecol='#c09040')
    A.line([base, (tipp[0] - ux * 6, tipp[1] - uy * 6)], '#ffffff', smooth=False, clip=blade)  # fil central
    A.line([(base[0] - px_ * 2, base[1] - py_ * 2), (tipp[0] - ux * 14 - px_ * 2, tipp[1] - uy * 14 - py_ * 2)], SE_BLADE[1],
           smooth=False, clip=blade)
    # garde ailée
    g0 = (base[0] + ux * 1, base[1] + uy * 1)
    guard = stroke([(g0[0] + px_ * 13, g0[1] + py_ * 13 - 4), (g0[0] + px_ * 5, g0[1] + py_ * 5), (g0[0], g0[1]),
                    (g0[0] - px_ * 5, g0[1] - py_ * 5), (g0[0] - px_ * 13, g0[1] - py_ * 13 - 4)], [1.5, 3, 3.5, 3, 1.5])
    A.part(guard, gold, r=3, contrast=1.3, spec=(0.98, gold[5]))
    A.gem(g0[0], g0[1], 2.5, 2.5, SE_GEM)
    grip = stroke([(base[0] - ux * 4, base[1] - uy * 4), (base[0] - ux * 20, base[1] - uy * 20)], 2.8, smooth=False)
    A.part(grip, SE_BLUE, r=2)
    pomm = ell(base[0] - ux * 22, base[1] - uy * 22, 3.2, 3.2)
    A.part(pomm, gold, r=2, contrast=1.3)
    # bras avant (manche large, main sur la poignée)
    sl2 = stroke([(144, 94), (160, 110), (168, 120)], [9, 9, 10])
    A.part(sl2, SE_ROBE, r=6)
    A.fold([(150, 100), (162, 116)], SE_ROBE[1], SE_ROBE[5], clip=sl2)
    A.part(stroke([(164, 118), (170, 124)], 6.5), gold, r=2, contrast=1.3)
    hand(A, hx_ + 1, hy_ - 4, SE_SKIN, r=5.5, fingers=4, ang=-30)

    A.finish()
    # lumière : halo tramé autour de la lame + éclats
    aura(A, blade, ['#fff6d0', '#ffe27a', '#eab53a'], seed=3, sparse=0.35)
    A.sparkle(tipp[0], tipp[1] - 2, 5, '#ffffff', SE_GOLD[4])
    for (x, y, s) in ((236, 40, 2), (196, 70, 2), (60, 20, 2), (30, 150, 3), (210, 150, 2), (180, 200, 2), (70, 200, 1)):
        A.sparkle(x, y, s, '#ffffff', SE_GOLD[4])
    rr = random.Random(9)
    for i in range(18):
        x, y = rr.randint(20, 250), rr.randint(5, 230)
        if not A.a[max(0, y - 1):y + 2, max(0, x - 1):x + 2].any():
            A.px(x, y, SE_GOLD[rr.randint(3, 5)])
    A.apply_fx()
    return A


# ================================================================== FAIRY
F_SKIN = ['#7a4048', '#b06a5a', '#e8a088', '#f8c4a8', '#ffdcc4', '#fff0e4']
F_HAIR = ['#5a1a44', '#8a2e64', '#c85a96', '#f48cc0', '#ffc4de', '#fff0f8']
F_IRIS = ['#0e5a50', '#22b89a', '#a8ffe0', '#e0fff4']
F_LEAF = ['#0a2a1a', '#123e26', '#1e6e34', '#3aa444', '#7cd85a', '#c4f496']
F_PETAL = ['#4a0e30', '#7a1a4e', '#c8407e', '#f878b0', '#ffb4d4', '#ffe8f2']
F_WING = ['#4a5aa8', '#6a72c8', '#98b4f0', '#c4e2ff', '#e8f6ff', '#ffffff']
F_WING2 = ['#6a3a98', '#9a5ac0', '#c890e6', '#e8c4f8', '#f8e6ff', '#ffffff']
F_GOLD = ['#7a4a10', '#c08a20', '#ffe27a', '#fff6c0']


def butterfly(A, root, pts, ramp, border, ang=0.0, sc=1.0, veins=5, spots=None, bias=0.0):
    """Aile de papillon : pts en coordonnées locales (racine en 0,0), tournés de ang et mis à l'échelle."""
    P_ = [(root[0] + q[0], root[1] + q[1]) for q in (rot((p[0] * sc, p[1] * sc), ang) for p in pts)]
    m = poly(P_, smooth=True)
    # éclairci vers la racine, bordure foncée
    d = np.hypot(XX - root[0], YY - root[1])
    dmax = max(math.hypot(p[0] - root[0], p[1] - root[1]) for p in P_)
    tex = -0.45 * np.clip(d / dmax, 0, 1) + 0.25
    A.part(m, ramp, r=6, bias=bias, tex=tex, contrast=0.6, dither=0.5)
    band = m & ~erode(erode(erode(m)))
    A.part(band, border, r=1, line=True, bias=0.1)
    # nervures
    n = len(P_)
    for k in range(veins):
        p = P_[int((k + 0.5) / veins * n) % n]
        A.line([root, ((root[0] * 0.6 + p[0] * 0.4) + 1, (root[1] * 0.6 + p[1] * 0.4)), p], border[1], clip=m)
    if spots:
        for (u, v, r_) in spots:
            q = rot((u * sc, v * sc), ang)
            A.part(ell(root[0] + q[0], root[1] + q[1], r_, r_) & m, ['#ffffff', '#ffffff', '#fff6ff'], r=1, line=False)
    return m


def flower(A, x, y, R, petal, core, n=5, ang=0):
    m = np.zeros((H, W), bool)
    for k in range(n):
        a = ang + k * 360 / n
        px_, py_ = rot((R * 0.55, 0), a)
        pm = ell(x + px_, y + py_, R * 0.55, R * 0.38, a)
        A.part(pm, petal, r=3, bias=0.05)
        A.line([(x + px_ * 0.3, y + py_ * 0.3), (x + px_ * 1.2, y + py_ * 1.2)], petal[2], smooth=False, clip=pm)
        m |= pm
    c = ell(x, y, R * 0.3, R * 0.3)
    A.part(c, core, r=2, contrast=1.3)
    A.px(x - R * 0.1, y - R * 0.12, core[-1], only=True)
    return m | c


@character('fairy')
def fairy():
    A = Art(accent='#9af0ff')
    cx, cy = 121, 55
    # ---------------- ailes de papillon
    up = [(0, 0), (-20, -30), (-44, -62), (-70, -70), (-84, -52), (-78, -24), (-50, -4)]
    lo = [(0, 0), (-34, 8), (-56, 28), (-58, 52), (-40, 58), (-18, 36)]
    butterfly(A, (140, 98), [(-x, y) for x, y in up], F_WING, F_WING[:3], sc=0.62, bias=-0.15,
              spots=[(-60, -50, 2)])
    butterfly(A, (140, 104), [(-x, y) for x, y in lo], F_WING2, F_WING2[:3], sc=0.6, bias=-0.15)
    butterfly(A, (106, 98), up, F_WING, F_WING[:3], sc=1.0, spots=[(-66, -54, 3), (-74, -34, 2), (-56, -62, 2)])
    butterfly(A, (106, 106), lo, F_WING2, F_WING2[:3], sc=1.0, spots=[(-46, 40, 2.5), (-50, 26, 2)])

    # ---------------- cheveux arrière (longs, ondulés)
    hb = ell(cx - 2, cy - 6, 25, 24) | poly([(96, 50), (148, 50), (156, 80), (150, 112), (152, 136), (136, 150), (112, 152), (94, 140),
                                               (96, 110), (88, 84)], smooth=True)
    A.part(hb, F_HAIR, r=10, bias=-0.1, spec=(0.975, F_HAIR[5]))
    for k in range(8):
        x0 = 94 + k * 7
        A.line([(x0, 56), (x0 - 3 + k, 86), (x0 + 2, 116), (x0 - 2 + k * 0.5, 148)], F_HAIR[1] if k % 2 else F_HAIR[3], clip=hb)

    # ---------------- jambes et bottes-feuilles
    for (pts, rad, foot, side) in (([(110, 150), (106, 172), (104, 194), (103, 214), (101, 232)], [12, 10, 7, 7.5, 4.5], (107, 239), -1),
                                   ([(134, 150), (139, 172), (143, 194), (146, 214), (149, 230)], [12, 10.5, 7, 7.5, 4.5], (156, 237), 1)):
        A.part(stroke(pts, rad), F_SKIN, r=7, bias=-0.08 if side < 0 else 0.02)
        boot = stroke(pts[2:], [7.5, 8, 5.5]) | ell(foot[0], foot[1], 9, 5.5)
        boot &= YY >= pts[2][1] + 4
        boot &= YY <= 244
        A.part(boot, F_LEAF, r=5, bias=-0.05 if side < 0 else 0.05)
        # revers en feuilles pointues
        y0 = pts[2][1] + 4
        x0 = pts[2][0]
        for k, dx in enumerate((-8, -2, 4)):
            lf = poly([(x0 + dx - 4, y0 + 4), (x0 + dx + 1, y0 - 8 + k), (x0 + dx + 5, y0 + 4)])
            A.part(lf, F_LEAF, r=2, bias=0.1)
        A.part(ell(foot[0] + 8, foot[1] - 4, 2.5, 2.5), F_PETAL, r=1)  # pompon
    # ---------------- jupe de pétales
    for i, (a, L, layer) in enumerate(((-150, 40, 0), (-125, 44, 0), (-100, 46, 0), (-75, 46, 0), (-50, 42, 0),
                                       (-140, 34, 1), (-112, 38, 1), (-88, 38, 1), (-62, 36, 1))):
        ar = math.radians(-a)
        base = (122, 124)
        tip = (base[0] + math.cos(ar) * L * 0.95, base[1] + math.sin(ar) * L * 0.85)
        m = poly([base, ((base[0] + tip[0]) / 2 + math.sin(ar) * 9, (base[1] + tip[1]) / 2 - math.cos(ar) * 6), tip,
                  ((base[0] + tip[0]) / 2 - math.sin(ar) * 9, (base[1] + tip[1]) / 2 + math.cos(ar) * 6)], smooth=True)
        A.part(m, F_PETAL, r=6, bias=(-0.15 if layer == 0 else 0.05))
        A.line([((base[0] * 2 + tip[0]) / 3, (base[1] * 2 + tip[1]) / 3), ((base[0] + tip[0] * 3) / 4, (base[1] + tip[1] * 3) / 4)],
               F_PETAL[2], clip=m)
    # ---------------- bras arrière (main ouverte, paillettes)
    A.part(stroke([(102, 92), (90, 108), (80, 120)], [7, 5.5, 4.5]), F_SKIN, r=4, bias=-0.1)
    puff_b = ell(101, 94, 9, 8)
    A.part(puff_b, F_PETAL, r=5, bias=-0.05)
    A.line([(96, 90), (99, 100)], F_PETAL[2], clip=puff_b)
    hand(A, 77, 123, F_SKIN, r=4.8, closed=False)
    # ---------------- corsage de feuilles
    neck = stroke([(123, 72), (123, 86)], 6.5)
    A.part(neck, F_SKIN, r=3, bias=-0.22)
    bod = poly([(104, 86), (142, 86), (148, 100), (142, 116), (138, 128), (106, 128), (102, 112), (98, 100)], smooth=True)
    A.part(bod, F_LEAF, r=9, contrast=1.1, spec=(0.98, F_LEAF[5]))
    A.line([(122, 92), (121, 126)], F_LEAF[1], clip=bod)
    for k in range(5):
        y = 96 + k * 6
        A.line([(121, y), (112, y - 4)], F_LEAF[2], smooth=False, clip=bod)
        A.line([(122, y), (132, y - 4)], F_LEAF[2], smooth=False, clip=bod)
    for k, x in enumerate(range(102, 146, 7)):  # bordure en pointes de feuilles
        lf = poly([(x - 4, 124), (x + 1, 136 + (k % 2) * 3), (x + 5, 124)])
        A.part(lf, F_LEAF, r=2, bias=0.05)
    A.part(stroke([(104, 86), (122, 90), (142, 86)], 2.5), F_LEAF, r=1, bias=0.25)
    flower(A, 122, 92, 7, F_PETAL[1:], F_GOLD)
    # ---------------- tête
    headm = anime_head(A, cx, cy, F_SKIN, F_IRIS, F_HAIR[1], mouth_kind='open', lip='#ff8aa0', blush_c='#ff90b8', neck=neck)
    hfm = hair_front(A, cx, cy, F_HAIR, spec_c=F_HAIR[5], clumps=[(-18, 12, 5, -2), (-11, 6, 6, -1), (-3, 2, 5, 0), (5, 7, 5, 1),
                                                          (12, 4, 5, 2), (18, 12, 4, 3)])
    cast_shadow(A, hfm, headm, 0, 2, F_SKIN[2], only=F_SKIN[3:])
    # oreille pointue de fée
    ear = poly([(cx - 17, cy + 4), (cx - 32, cy - 8), (cx - 14, cy + 11)])
    A.part(ear, F_SKIN, r=2)
    # mèches latérales ondulées
    lock(A, [(cx - 19, cy - 8), (cx - 24, cy + 12), (cx - 20, cy + 32), (cx - 26, cy + 52), (cx - 22, cy + 66)],
         [6, 6.5, 5.5, 4, 1], F_HAIR, r=4, hi=F_HAIR[4])
    lock(A, [(cx + 19, cy - 6), (cx + 24, cy + 12), (cx + 22, cy + 30), (cx + 28, cy + 46)], [5, 5, 4, 1], F_HAIR, r=4, hi=F_HAIR[4])
    # couronne de fleurs
    for i, (dx, dy, R, col) in enumerate(((-20, -14, 6, F_PETAL[1:]), (-11, -21, 7, F_PETAL[2:] + ['#ffffff']), (0, -24, 6.5, F_PETAL[1:]),
                                          (11, -22, 6, ['#7a5a10', '#ffcc40', '#ffe27a', '#fff6c0', '#ffffff']),
                                          (20, -15, 6, F_PETAL[2:] + ['#ffffff']))):
        lf = ell(cx + dx + 5, cy + dy + 3, 4, 2.2, 30)
        A.part(lf, F_LEAF, r=1, bias=0.1)
        flower(A, cx + dx, cy + dy, R, col, F_GOLD if i != 3 else ['#c08a20', '#fff6c0', '#ffffff'], ang=i * 17)

    # ---------------- baguette fleurie (bras avant levé)
    wb, wt = (176, 128), (184, 30)
    A.part(stroke([wb, wt], 2.4, smooth=False), F_LEAF, r=2, bias=0.1)
    for t in np.arange(0.05, 0.9, 0.12):  # spirale dorée
        x, y = wb[0] + (wt[0] - wb[0]) * t, wb[1] + (wt[1] - wb[1]) * t
        A.px(x - 1, y, F_GOLD[2], only=True)
        A.px(x, y - 1, F_GOLD[3], only=True)
    for (t, s_) in ((0.62, 1), (0.8, -1)):
        x, y = wb[0] + (wt[0] - wb[0]) * t, wb[1] + (wt[1] - wb[1]) * t
        A.part(ell(x + s_ * 6, y - 3, 6, 2.8, -30 * s_), F_LEAF, r=2, bias=0.1)
    A.part(stroke([(144, 92), (160, 104), (174, 94)], [7, 5.5, 4.5]), F_SKIN, r=4)
    puff = ell(146, 94, 10, 8.5)
    A.part(puff, F_PETAL, r=5)
    A.line([(141, 90), (145, 101)], F_PETAL[2], clip=puff)
    A.line([(149, 88), (153, 99)], F_PETAL[2], clip=puff)
    hand(A, 177, 92, F_SKIN, r=5.2, fingers=4, ang=80)
    fm = flower(A, 185, 26, 15, F_PETAL[1:], F_GOLD, n=6, ang=10)
    flower(A, 185, 26, 8, F_PETAL[2:] + ['#ffffff'], F_GOLD, n=5, ang=40)
    A.gem(185, 26, 3, 3, ['#7a4a10', '#c08a20', '#ffe27a', '#fff6c0', '#ffffff'])

    A.finish()
    aura(A, fm, ['#ffe8f8', '#ffb4e0', '#9af0ff'], seed=4, sparse=0.3)
    for (x, y, s_, c2) in ((214, 14, 4, '#ffb4e0'), (160, 12, 2, '#9af0ff'), (220, 60, 2, '#ffb4e0'), (200, 90, 3, '#9af0ff'),
                           (60, 150, 2, '#ffb4e0'), (40, 120, 2, '#9af0ff'), (180, 170, 2, '#ffb4e0'), (70, 104, 3, '#ffffff')):
        A.sparkle(x, y, s_, '#ffffff', c2)
    rr = random.Random(2)
    for i in range(30):  # poussière de fée qui retombe
        x, y = rr.randint(150, 240), rr.randint(30, 200)
        if not A.a[max(0, y - 1):y + 2, max(0, x - 1):x + 2].any():
            A.px(x, y, rr.choice(['#ffffff', '#ffe27a', '#9af0ff', '#ffb4e0']))
    A.apply_fx()
    return A


# ================================================================== VALKYRIE
V_SKIN = ['#7a4048', '#b06a5a', '#e8a088', '#f8c4a8', '#ffdcc4', '#fff0e4']
V_HAIR = ['#5a3a10', '#94621a', '#d4a232', '#f2cc58', '#fff0a0', '#fffbe0']
V_IRIS = ['#12306a', '#2f7cf6', '#9ad8ff', '#e0f4ff']
V_SILVER = ['#1e2234', '#2e3448', '#5a6680', '#929eb8', '#d0d8e8', '#f0f4fa', '#ffffff']
V_BLUE = ['#080f30', '#0e1a4a', '#1a3080', '#2a50b8', '#4a7ae0', '#90b8ff']
V_CAPE = ['#060a24', '#0a1238', '#16246a', '#22389e', '#3a58c8', '#6a8ae8']
V_WING = ['#3a4a78', '#5a6a98', '#a0b0d4', '#dce6f4', '#f4f8ff', '#ffffff']
V_GOLD = ['#5a2a10', '#9a5a18', '#d89a2a', '#f6c850', '#fff0a0', '#fffbe0']
V_WOOD = ['#1a0e10', '#2e1a16', '#4a2a1c', '#6e4428', '#9a6a3a']
V_SPEC = (0.978, '#ffffff')


@character('valkyrie')
def valkyrie():
    A = Art(accent='#9ad8ff')
    cx, cy = 121, 55
    S, G = V_SILVER, V_GOLD
    # ---------------- ailes dorsales
    feather_wing(A, (138, 94), (174, 48), V_WING, a_root=55, a_wrist=-25, l_root=26, l_wrist=50,
                 rows=((1.0, 7, 8), (0.64, 6.5, 7), (0.38, 5.5, 7)), seed=5, bias=-0.15, curl=-5)
    feather_wing(A, (104, 96), (58, 44), V_WING, a_root=115, a_wrist=204, l_root=34, l_wrist=52,
                 rows=((1.0, 8, 10), (0.64, 7.5, 9), (0.38, 6.2, 9)), seed=6, curl=6)
    # ---------------- cape
    cape = poly([(100, 88), (144, 88), (150, 140), (140, 200), (120, 226), (96, 234), (72, 238), (78, 200), (88, 150)], smooth=True)
    A.part(cape, V_CAPE, r=10, grad=(120, 240, 0.25))
    for (x0, x1) in ((98, 80), (108, 96), (118, 112)):
        A.fold([(x0, 120), ((x0 + x1) / 2 - 3, 180), (x1, 232)], V_CAPE[1], V_CAPE[4], clip=cape)
    # ---------------- natte dorsale (derrière) + cheveux arrière
    hb = ell(cx - 2, cy - 6, 24, 23) | poly([(100, 50), (144, 50), (146, 76), (130, 92), (104, 90), (96, 70)], smooth=True)
    A.part(hb, V_HAIR, r=10, bias=-0.1, spec=(0.975, V_HAIR[5]))
    # ---------------- jambes : collant bleu, jambières d'argent
    for (pts, rad, foot, side) in (([(110, 150), (106, 172), (104, 194), (103, 214), (101, 232)], [12, 10, 7.5, 7.5, 5], (107, 239), -1),
                                   ([(134, 150), (139, 172), (143, 194), (146, 214), (149, 230)], [12, 10.5, 7.5, 7.5, 5], (157, 238), 1)):
        A.part(stroke(pts, rad), V_BLUE, r=7, bias=-0.1 if side < 0 else 0.0)
        greave = stroke(pts[2:], [9, 9, 6.5]) | ell(foot[0], foot[1], 10, 6)
        greave &= (YY >= pts[2][1]) & (YY <= 244)
        A.part(greave, S, r=6, bias=-0.05 if side < 0 else 0.05, spec=V_SPEC)
        A.line([(pts[2][0] + 1, pts[2][1] + 6), (pts[4][0] + 1, pts[4][1])], S[2], clip=greave)
        knee = ell(pts[2][0] + side, pts[2][1] + 1, 8, 7)
        A.part(knee, S, r=4, spec=V_SPEC)
        A.part(knee & ~erode(knee) & (YY > pts[2][1] + 2), G, r=1, line=False)
        A.gem(pts[2][0] + side, pts[2][1] + 1, 2, 2, V_BLUE[1:])
        sole = greave & (YY >= 242)
        A.fill(sole, S[1], pid=A.n)
        # petite aile à la cheville
        ax, ay = pts[4]
        A.part(poly([(ax - 3, ay - 2), (ax - 14, ay - 10), (ax - 10, ay - 4), (ax - 13, ay - 2), (ax - 3, ay + 2)]), V_WING, r=2, bias=0.1)
    # ---------------- jupe bleue + tassettes
    sk = poly([(100, 124), (144, 124), (154, 150), (160, 170), (122, 174), (84, 170), (92, 148)], smooth=True)
    A.part(sk, V_BLUE, r=9, contrast=1.1)
    for (x0, x1) in ((108, 98), (120, 118), (132, 138), (142, 152)):
        A.fold([(x0, 130), (x1, 170)], V_BLUE[1], V_BLUE[4], clip=sk)
    hem = A.mask_line([(84, 170), (122, 174), (160, 170)])
    A.part((hem | shift(hem, 0, -1)) & sk, G, r=1, line=False)
    for i, (x0, x1) in enumerate(((98, 116), (114, 132), (130, 148))):
        t = poly([(x0, 126), (x1, 126), (x1 + 2, 150 - (i == 1) * 0), (x0 + (x1 - x0) / 2, 156), (x0 - 2, 150)])
        A.part(t, S, r=5, spec=V_SPEC, bias=0.02 - i * 0.03)
        A.part(t & ~erode(erode(t)) & (YY > 130), G, r=1, line=False)
        A.rivet((x0 + x1) // 2, 134, G)
    # ---------------- bras arrière
    A.part(stroke([(102, 92), (90, 114), (96, 134)], [8, 6.5, 5.5]), V_BLUE, r=5, bias=-0.1)
    A.part(stroke([(91, 118), (96, 132)], 6.5), S, r=3, spec=V_SPEC)
    hand(A, 99, 138, V_SKIN, r=5)
    # ---------------- cuirasse
    neck = stroke([(123, 72), (123, 86)], 6.5)
    A.part(neck, V_SKIN, r=3, bias=-0.22)
    plate = poly([(102, 86), (144, 86), (150, 100), (146, 114), (140, 128), (104, 128), (98, 112), (96, 98)], smooth=True)
    A.part(plate, S, r=10, contrast=1.25, spec=V_SPEC)
    bust = poly([(104, 94), (140, 92), (148, 102), (142, 112), (124, 112), (106, 110)], smooth=True)
    A.part(bust, S, r=6, bias=0.05, spec=V_SPEC)
    A.line([(125, 104), (127, 111)], S[2], clip=bust)
    # filigrane doré et emblème ailé
    A.line([(104, 113), (124, 116), (144, 112)], G[3], clip=plate)
    A.line([(104, 114), (124, 117), (144, 113)], G[1], clip=plate)
    A.line([(103, 126), (122, 128), (140, 126)], G[2], clip=plate)
    A.gem(124, 98, 3.5, 3.5, V_BLUE[1:] + ['#ffffff'], sparkle=True)
    for s_ in (-1, 1):
        A.line([(124 + s_ * 4, 98), (124 + s_ * 9, 95), (124 + s_ * 13, 96)], G[3], clip=plate)
        A.line([(124 + s_ * 4, 100), (124 + s_ * 10, 99)], G[2], clip=plate)
    gorget = stroke([(108, 86), (123, 90), (138, 86)], 3.5)
    A.part(gorget, S, r=2, spec=V_SPEC)
    A.line([(110, 88), (123, 92), (136, 88)], G[3])
    # ---------------- tête et casque
    anime_head(A, cx, cy, V_SKIN, V_IRIS, V_HAIR[1], mouth_kind='smile', lip='#e07a7a', blush_c='#f4a0a8', neck=neck, brow_ang=1)
    # frange sous le casque
    for i, (dx, dy, w, b) in enumerate(((-17, 8, 5, -2), (-10, 3, 5, -1), (-2, 1, 4, 0), (6, 4, 4, 1), (14, 6, 4, 2))):
        x0 = cx + dx
        m = poly([(x0 - w, cy - 8), (x0 + w, cy - 8), (x0 + b + 1, cy + dy)], smooth=False)
        A.part(m, V_HAIR, r=3, bias=0.05, spec=(0.975, V_HAIR[5]))
    lock(A, [(cx + 18, cy - 4), (cx + 22, cy + 12), (cx + 23, cy + 24)], [5, 4, 1], V_HAIR, r=3, hi=V_HAIR[4])
    lock(A, [(cx - 18, cy - 4), (cx - 22, cy + 14), (cx - 20, cy + 28)], [5, 4.5, 1], V_HAIR, r=3, hi=V_HAIR[4])
    helm = ell(cx - 1, cy - 8, 23, 19) & (YY < cy - 5)
    helm |= poly([(cx - 22, cy - 8), (cx - 19, cy + 8), (cx - 14, cy + 10), (cx - 14, cy - 6)])  # garde-joue
    A.part(helm, S, r=10, contrast=1.3, spec=V_SPEC)
    A.line([(cx - 2, cy - 26), (cx + 2, cy - 7)], S[2], clip=helm)  # arête
    A.line([(cx - 3, cy - 26), (cx + 1, cy - 7)], S[5], clip=helm)
    brim = stroke([(cx - 23, cy - 7), (cx - 5, cy - 9), (cx + 12, cy - 8), (cx + 22, cy - 5)], 2.6)
    A.part(brim, G, r=2, contrast=1.3)
    A.gem(cx + 1, cy - 9, 2.5, 2.5, V_BLUE[1:] + ['#ffffff'])
    for (x, y) in ((cx - 14, cy - 12), (cx + 12, cy - 11), (cx - 18, cy + 2)):
        A.rivet(x, y, G)
    # ailes du casque
    for (bx, by, sc, dk) in ((cx - 18, cy - 14, 1.0, 0.0), (cx + 12, cy - 22, 0.7, -0.15)):
        for k in range(4):
            a = math.radians(-150 + k * 22)
            L = (24 - k * 3) * sc
            f = stroke([(bx, by), (bx + math.cos(a) * L * 0.6, by + math.sin(a) * L * 0.6 - 2), (bx + math.cos(a) * L, by + math.sin(a) * L)],
                       [3.5 * sc, 3.6 * sc, 0.8])
            A.part(f, V_WING, r=2, bias=0.05 * k + dk)
        A.part(ell(bx, by, 4 * sc, 3.5 * sc), G, r=2, contrast=1.3)
    # ---------------- épaulières (arrière puis avant)
    for (x, y, sc, b) in ((101, 92, 0.8, -0.12),):
        for k in range(2, -1, -1):
            pm = ell(x + k * 2, y + k * 5, 13 * sc - k, 9 * sc, 15)
            A.part(pm, S, r=6, bias=b + k * 0.02, spec=V_SPEC)
            A.part(pm & ~erode(erode(pm)) & (YY > y + k * 5), G, r=1, line=False)
    # ---------------- lance (bras avant)
    sb, st = (178, 244), (189, 44)
    A.part(stroke([sb, st], 2.8, smooth=False), V_WOOD, r=2, tex=np.sin(YY * 1.1) * 0.08)
    for t in (0.1, 0.48, 0.92):
        x, y = sb[0] + (st[0] - sb[0]) * t, sb[1] + (st[1] - sb[1]) * t
        A.part(stroke([(x, y - 2), (x, y + 2)], 4, smooth=False), G, r=2, contrast=1.3)
    # fanion bleu
    pen = poly([(188, 56), (220, 62), (232, 70), (218, 72), (228, 82), (187, 76)], smooth=False)
    A.part(pen, V_CAPE, r=5, bias=0.1)
    A.part(dilate(A.mask_line([(189, 58), (220, 63)], smooth=False)) & pen, G, r=1, line=False)
    A.fold([(196, 62), (212, 72)], V_CAPE[1], V_CAPE[5], clip=pen)
    # lame en feuille
    blade = poly([(184, 44), (182, 30), (190, 10), (198, 30), (195, 44)], smooth=False)
    A.part(blade, S, r=4, contrast=1.3, spec=V_SPEC)
    A.line([(189, 43), (190, 14)], S[6], smooth=False, clip=blade)
    A.line([(191, 43), (192, 18)], S[2], smooth=False, clip=blade)
    col = stroke([(181, 46), (197, 46)], 3, smooth=False)
    A.part(col, G, r=2, contrast=1.3)
    for s_ in (-1, 1):
        A.part(poly([(189 + s_ * 6, 46), (189 + s_ * 16, 38), (189 + s_ * 12, 46), (189 + s_ * 6, 49)]), V_WING, r=2, bias=0.1)
    A.gem(189, 47, 2, 2, V_BLUE[1:])
    A.part(stroke([(144, 94), (160, 112), (174, 126)], [8, 6.5, 5.5]), V_BLUE, r=5)
    vam = stroke([(162, 114), (174, 126)], 6.8)
    A.part(vam, S, r=3, spec=V_SPEC)
    A.part(vam & ~erode(vam) & shift(vam, 2, 2), G, r=1, line=False)
    for (x, y, sc, b) in ((146, 92, 1.0, 0.04),):
        for k in range(2, -1, -1):
            pm = ell(x + k * 2, y + k * 5, 13 * sc - k, 9 * sc, 15)
            A.part(pm, S, r=6, bias=b + k * 0.02, spec=V_SPEC)
            A.part(pm & ~erode(erode(pm)) & (YY > y + k * 5), G, r=1, line=False)
    # ---------------- natte sur l'épaule avant
    for i in range(10):
        t = i / 9
        x = 138 + 12 * t + (2 if i % 2 else -2)
        y = 70 + 64 * t
        seg = ell(x, y, 6.2 - t * 1.8, 5.2, 35 if i % 2 else -35)
        A.part(seg, V_HAIR, r=3, bias=0.05, spec=(0.975, V_HAIR[5]))
        A.line([(x - 3, y - 2 * (1 if i % 2 else -1)), (x + 2, y + 1.5 * (1 if i % 2 else -1))], V_HAIR[4], smooth=False, clip=seg)
    A.part(poly([(146, 132), (156, 131), (157, 137), (147, 138)]), G, r=2, contrast=1.3)
    A.part(stroke([(152, 138), (153, 150)], [3.2, 0.6]), V_HAIR, r=2, bias=0.1)
    hand(A, 183, 130, V_SKIN, r=5.5, fingers=4, ang=-80)

    A.finish()
    A.sparkle(190, 9, 3, '#ffffff', V_IRIS[2])
    for (x, y, s_) in ((230, 20, 3), (40, 30, 2), (214, 110, 2), (30, 150, 2), (200, 180, 2), (150, 18, 2)):
        A.sparkle(x, y, s_, '#ffffff', V_IRIS[2])
    A.apply_fx()
    return A


# ================================================================== WITCH
WI_SKIN = ['#7a4048', '#a8604e', '#e39a78', '#f6c0a0', '#ffd4b0', '#fff0dc']
WI_HAIR = ['#081a2c', '#0e2a44', '#16626e', '#21a096', '#56d8bc', '#b4fbe6']
WI_HAIR2 = ['#24104a', '#4e2488', '#8048c4', '#b88af0', '#e6ccff']
WI_IRIS = ['#7a2a06', '#f09a20', '#fff09a', '#fffbe0']
WI_HAT = ['#0c0320', '#180632', '#30105e', '#521e94', '#7a3ac4', '#a872e6']
WI_BAND = ['#06020c', '#0c0418', '#1c0a32', '#2c1248', '#3e1a60']
WI_ROBE = ['#08040e', '#10071a', '#200f30', '#341a48', '#4c2866', '#6c3e8a']
WI_MOON = ['#6a4a10', '#b88a2a', '#f6dc7a', '#fff6c8', '#ffffff']
WI_POT = ['#06261a', '#0e4a2a', '#2aa84a', '#8af06a', '#e8ffd0']
WI_WOOD = ['#140a0a', '#24140e', '#3e2416', '#5e3a20', '#86582e']
WI_ORB = ['#24104a', '#5a2a9a', '#a060f0', '#d8b0ff', '#ffffff']


@character('witch')
def witch():
    A = Art(accent='#b88af0')
    cx, cy = 121, 58
    # ---------------- cheveux arrière (longs, ondulés, mèches violettes)
    hb = ell(cx - 2, cy - 6, 25, 24) | poly([(94, 50), (148, 52), (154, 84), (150, 120), (156, 152), (138, 166), (112, 168), (90, 156),
                                               (92, 120), (86, 86)], smooth=True)
    A.part(hb, WI_HAIR, r=10, bias=-0.1, spec=(0.975, WI_HAIR[5]))
    for k in range(9):
        x0 = 92 + k * 7
        A.line([(x0, 60), (x0 - 4 + k, 92), (x0 + 3, 124), (x0 - 2 + k * 0.4, 164)], WI_HAIR[1] if k % 2 else WI_HAIR[2], clip=hb)
    for pts in ([(96, 80), (92, 120), (100, 160)], [(146, 90), (150, 130), (144, 160)]):
        A.part(stroke(pts, [3, 4, 1]) & hb, WI_HAIR2, r=2, bias=0.05)
    # ---------------- bottes
    for (pts, foot, side) in ((([(108, 200), (104, 220), (102, 234)]), (108, 239), -1), (([(138, 200), (144, 220), (148, 232)]), (156, 238), 1)):
        b = stroke(pts, [8, 7, 5.5]) | ell(foot[0], foot[1], 9.5, 6)
        b &= YY <= 244
        A.part(b, ['#0c0612', '#1c0e26', '#2e1a3e', '#4a2e62', '#7a5a9a'], r=5, bias=-0.05 if side < 0 else 0.05)
        A.part(ell(foot[0] + 8, foot[1] - 3, 3, 4, 30), ['#1c0e26', '#2e1a3e', '#4a2e62', '#7a5a9a'], r=2)  # pointe recourbée
        for y in range(pts[0][1] + 6, 230, 6):
            A.px(pts[0][0] + (y - pts[0][1]) * 0.15 * side + 2, y, WI_MOON[1], only=True)
    # ---------------- robe
    robe = poly([(102, 86), (144, 86), (150, 112), (146, 130), (158, 170), (172, 214), (160, 222), (140, 226), (122, 222), (100, 226),
                 (80, 222), (72, 214), (90, 170), (98, 130), (96, 108)], smooth=True)
    A.part(robe, WI_ROBE, r=14, contrast=1.15, grad=(140, 226, 0.15))
    for (x0, x1) in ((106, 90), (114, 104), (130, 140), (140, 158), (122, 122)):
        A.fold([(x0, 136), ((x0 + x1) / 2 + 2, 180), (x1, 222)], WI_ROBE[1], WI_ROBE[4], clip=robe)
    hem = A.mask_line([(72, 214), (80, 222), (100, 226), (122, 222), (140, 226), (160, 222), (172, 214)])
    band = (hem | shift(hem, 0, -1) | shift(hem, 0, -2)) & robe
    A.part(band, WI_MOON, r=1, line=False)
    # broderies : lunes et étoiles dorées près de l'ourlet
    for (x, y, k) in ((90, 206, 0), (112, 212, 1), (134, 208, 0), (154, 204, 1), (100, 190, 2), (146, 186, 2)):
        if k == 0:
            m = ell(x, y, 4, 4) & ~ell(x + 2, y - 1, 3.4, 3.4)
            A.rgb[m & A.a] = rgb(WI_MOON[2])
            A.rgb[m & A.a & (XX < x - 1)] = rgb(WI_MOON[3])
        else:
            s_ = 2 if k == 1 else 1
            for d in range(-s_, s_ + 1):
                A.px(x + d, y, WI_MOON[2], only=True)
                A.px(x, y + d, WI_MOON[2], only=True)
            A.px(x, y, WI_MOON[4], only=True)
    # ceinture + fiole verte
    belt = poly([(98, 126), (148, 124), (149, 132), (98, 134)])
    A.part(belt, WI_BAND, r=2)
    A.gem(122, 129, 3, 3, WI_MOON[1:])
    pot_neck = poly([(104, 132), (110, 132), (110, 138), (104, 138)])
    A.part(pot_neck, ['#5a6a80', '#9aaac0', '#c4d8e8', '#ffffff'], r=1)
    A.part(ell(107, 131, 3.6, 2), ['#4a2a10', '#6e3e1e', '#9a6230'], r=1)
    pot = ell(107, 146, 8, 9)
    A.part(pot, WI_POT, r=5, contrast=1.3, bias=0.05)
    A.part(ell(107, 149, 6, 5) & pot, WI_POT, r=3, bias=0.25)
    A.px(103, 141, '#ffffff', only=True)
    A.px(103, 142, WI_POT[4], only=True)
    A.px(104, 140, WI_POT[4], only=True)
    # ---------------- bras arrière (main levée : magie)
    A.part(stroke([(102, 92), (86, 104), (74, 94)], [9, 9, 10]), WI_ROBE, r=6, bias=-0.05)
    A.fold([(96, 92), (82, 100)], WI_ROBE[1], WI_ROBE[4], clip=stroke([(102, 92), (86, 104), (74, 94)], [9, 9, 10]))
    cuff = stroke([(76, 98), (72, 90)], 7)
    A.part(cuff, WI_ROBE, r=3, bias=0.1)
    A.part(cuff & ~erode(cuff) & (YY < 96), WI_MOON, r=1, line=False)
    hand(A, 70, 84, WI_SKIN, r=5, closed=False, ang=-30)
    # ---------------- buste et col
    neck = stroke([(123, 74), (123, 88)], 6.5)
    A.part(neck, WI_SKIN, r=3, bias=-0.22)
    bod = poly([(102, 88), (144, 88), (150, 102), (144, 116), (138, 128), (106, 128), (100, 114), (96, 100)], smooth=True)
    A.part(bod, WI_ROBE, r=9, contrast=1.2, bias=0.05)
    A.part(poly([(106, 94), (140, 92), (146, 102), (140, 112), (124, 112), (108, 110)], smooth=True), WI_ROBE, r=6, bias=0.1)
    # laçage doré
    for k in range(4):
        y = 104 + k * 5
        A.line([(119, y), (127, y + 3)], WI_MOON[1], smooth=False)
        A.line([(127, y), (119, y + 3)], WI_MOON[2], smooth=False)
    col_ = poly([(104, 88), (112, 78), (122, 86), (134, 78), (142, 88), (130, 94), (114, 94)])
    A.part(col_, WI_HAT, r=3, bias=0.1)
    A.gem(122, 90, 3, 3, WI_ORB)
    # ---------------- tête
    headm = anime_head(A, cx, cy, WI_SKIN, WI_IRIS, WI_HAIR[1], mouth_kind='open', lip='#e8707a', blush_c='#f08a90', neck=neck, brow_ang=-1)
    hfm = hair_front(A, cx, cy, WI_HAIR, spec_c=WI_HAIR[5], clumps=[(-18, 11, 5, -2), (-10, 5, 6, -1), (-2, 3, 5, 1), (6, 7, 5, 1),
                                                            (13, 3, 4, 2), (18, 10, 4, 3)])
    cast_shadow(A, hfm, headm, 0, 2, WI_SKIN[2], only=WI_SKIN[3:])
    lock(A, [(cx - 19, cy - 8), (cx - 24, cy + 14), (cx - 22, cy + 36), (cx - 28, cy + 58), (cx - 24, cy + 72)],
         [6, 7, 6, 4, 1], WI_HAIR, r=4, hi=WI_HAIR[4])
    lock(A, [(cx + 19, cy - 6), (cx + 25, cy + 14), (cx + 24, cy + 34), (cx + 30, cy + 50)], [5, 5.5, 4, 1], WI_HAIR, r=4, hi=WI_HAIR[4])
    # ---------------- chapeau
    brim = ell(cx - 2, cy - 12, 46, 11, -5)
    A.part(brim, WI_HAT, r=6, contrast=1.2, bias=0.02)
    A.line([(cx - 46, cy - 8), (cx - 10, cy - 2), (cx + 36, cy - 10)], WI_HAT[1], clip=brim)  # dessous ombré
    cone = poly([(cx - 21, cy - 14), (cx + 19, cy - 18), (cx + 8, cy - 40), (cx - 2, cy - 50), (cx - 16, cy - 56), (cx - 38, cy - 48),
                 (cx - 28, cy - 47), (cx - 16, cy - 40)], smooth=True)
    A.part(cone, WI_HAT, r=10, contrast=1.2, spec=(0.98, WI_HAT[5]))
    A.fold([(cx - 6, cy - 26), (cx - 6, cy - 38), (cx - 16, cy - 48)], WI_HAT[1], WI_HAT[4], clip=cone)
    hband = poly([(cx - 22, cy - 15), (cx + 19, cy - 19), (cx + 17, cy - 26), (cx - 20, cy - 23)])
    A.part(hband, WI_BAND, r=2, bias=0.1)
    # boucle en croissant + étoiles
    m = ell(cx + 2, cy - 21, 5, 5) & ~ell(cx + 4, cy - 22, 4, 4.4)
    A.part(m, WI_MOON, r=2, contrast=1.3, line=False)
    for (x, y) in ((cx - 12, cy - 34), (cx - 24, cy - 50), (cx + 6, cy - 32)):
        A.pxs([(x, y), (x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)], WI_MOON[2], only=True)
        A.px(x, y, WI_MOON[4], only=True)
    tipm = ell(cx - 38, cy - 47, 3.6, 3.6)
    A.part(tipm, WI_MOON, r=2, contrast=1.3)
    # ---------------- bâton (lune et orbe)
    sb, st = (182, 244), (176, 46)
    staff = stroke([sb, (180, 180), (176, 120), (179, 80), st], [3.2, 3.0, 3.2, 2.8, 3.0])
    A.part(staff, WI_WOOD, r=2, tex=(NOISE - 0.5) * 0.2)
    for (y, s_) in ((150, 1), (100, -1)):
        A.part(ell(178 + s_ * 3, y, 2.6, 2), WI_WOOD, r=1, bias=0.1)  # nœuds
    A.part(stroke([(176, 136), (178, 130), (176, 124)], 3.8, smooth=False), WI_MOON, r=2, contrast=1.3)
    crescent = ell(176, 32, 17, 17) & ~ell(184, 26, 15, 15)
    A.part(crescent, WI_MOON, r=4, contrast=1.35, spec=(0.98, '#ffffff'))
    orb = ell(181, 30, 7, 7)
    A.part(orb, WI_ORB, r=5, contrast=1.5, bias=0.1, linecol=WI_ORB[0])
    A.px(178, 27, '#ffffff', only=True)
    A.px(179, 27, '#ffffff', only=True)
    A.px(178, 28, WI_ORB[3], only=True)
    # ---------------- bras avant
    sl = stroke([(144, 92), (160, 112), (170, 124)], [9, 9, 10])
    A.part(sl, WI_ROBE, r=6)
    A.fold([(150, 98), (162, 116)], WI_ROBE[1], WI_ROBE[5], clip=sl)
    cuf = stroke([(166, 124), (172, 130)], 7)
    A.part(cuf, WI_ROBE, r=3, bias=0.1)
    A.part(cuf & ~erode(cuf) & (YY > 126), WI_MOON, r=1, line=False)
    hand(A, 178, 132, WI_SKIN, r=5.2, fingers=4, ang=-80)

    A.finish()
    aura(A, orb, ['#e6ccff', '#b88af0', '#8048c4'], seed=7, sparse=0.35)
    # magie dans la main arrière
    mg = ell(66, 74, 5, 5)
    A.rgb[mg & ~A.a] = rgb(WI_POT[3])
    A.a |= mg
    aura(A, mg, [WI_POT[4], WI_POT[3], WI_POT[2]], seed=8, sparse=0.4)
    A.px(65, 73, '#ffffff')
    for (x, y, s_, c2) in ((200, 14, 3, '#b88af0'), (150, 10, 2, '#f6dc7a'), (40, 60, 3, '#56d8bc'), (56, 40, 2, '#b88af0'),
                           (210, 70, 2, '#f6dc7a'), (30, 110, 2, '#b88af0'), (200, 160, 2, '#56d8bc'), (52, 98, 1, '#8af06a')):
        A.sparkle(x, y, s_, '#ffffff', c2)
    A.apply_fx()
    return A


# ================================================================== VAMPIRE
VA_SKIN = ['#3e3058', '#6e5c8a', '#b4a6cc', '#d4cae4', '#e6e0f0', '#faf6ff']
VA_HAIR = ['#04030a', '#07060e', '#141024', '#231c3a', '#3a3060', '#6a5c9a', '#9a8cc8']
VA_IRIS = ['#5e020c', '#d01c2c', '#ff8a7a', '#ffd0c8']
VA_COAT = ['#08040e', '#120a1c', '#22142e', '#342044', '#4c3062', '#6e4c8c']
VA_BLACK = ['#05040a', '#0a0812', '#161226', '#241e3a', '#383054', '#5a5080']
VA_RED = ['#1e0208', '#2e040c', '#64091a', '#a01428', '#d82e3e', '#ff7a72']
VA_VEST = ['#1a040c', '#2a0612', '#4e0c1e', '#7a1428', '#a82a38', '#d65a5a']
VA_SHIRT = ['#4a4870', '#7c78a0', '#c4c2dc', '#eeecf8', '#ffffff']
VA_GLOVE = ['#3a2e58', '#5a4a78', '#9a8cb8', '#d4cce4', '#eee8f6']
VA_GOLD = ['#5a2a10', '#9a5a18', '#d8a030', '#f6d070', '#fff4c0']
VA_STEEL = ['#2a2e44', '#4a5270', '#8a94b0', '#c8d0e4', '#f4f8ff', '#ffffff']


def bat(A, x, y, s, flap=0):
    body = ell(x, y, 2.2 * s, 2.6 * s)
    wl = poly([(x - 1, y - 1), (x - 6 * s, y - 4 * s - flap), (x - 10 * s, y - 2 * s - flap), (x - 8 * s, y + 1), (x - 5 * s, y),
               (x - 3 * s, y + 2)])
    wr = poly([(x + 1, y - 1), (x + 6 * s, y - 4 * s - flap), (x + 10 * s, y - 2 * s - flap), (x + 8 * s, y + 1), (x + 5 * s, y),
               (x + 3 * s, y + 2)])
    A.part(wl | wr, ['#140a24', '#24123a', '#3a2050', '#5a3478'], r=2, bias=0.1)
    A.part(body, ['#140a24', '#24123a', '#3a2050', '#5a3478'], r=2, bias=0.15)
    A.px(x - 1, y - 1, '#ff4a4a')
    A.px(x + 1, y - 1, '#ff4a4a')


@character('vampire')
def vampire():
    A = Art(accent='#ff4a5a')
    cx, cy = 122, 54
    # ---------------- grande cape (extérieur noir, doublure rouge)
    cape = poly([(98, 84), (148, 84), (166, 120), (184, 180), (196, 236), (170, 230), (150, 238), (124, 232), (96, 240), (70, 232),
                 (46, 240), (60, 180), (80, 120)], smooth=False)
    A.part(cape, VA_RED, r=12, contrast=1.1, grad=(100, 240, 0.35))
    for (x0, x1) in ((90, 60), (100, 86), (146, 172), (154, 186)):
        A.fold([(x0, 110), ((x0 + x1) / 2, 170), (x1, 232)], VA_RED[1], VA_RED[4], clip=cape)
    # bord extérieur noir retourné (côté gauche)
    outer_l = poly([(80, 120), (60, 180), (46, 240), (70, 232), (66, 190), (84, 140)])
    A.part(outer_l, VA_BLACK, r=5, bias=0.05)
    outer_r = poly([(166, 120), (184, 180), (196, 236), (178, 228), (172, 184), (160, 140)])
    A.part(outer_r, VA_BLACK, r=5, bias=-0.05)
    # ---------------- jambes
    for (pts, foot, side) in ((([(112, 152), (108, 194), (104, 232)]), (110, 239), -1), (([(136, 152), (142, 194), (148, 230)]), (158, 238), 1)):
        A.part(stroke(pts, [11, 8.5, 6.5]), VA_BLACK, r=6, bias=-0.08 if side < 0 else 0.02)
        A.line([(pts[0][0] + 3 * side, pts[0][1] + 6), (pts[2][0] + 2 * side, pts[2][1] - 6)], VA_BLACK[3], clip=stroke(pts, [11, 8.5, 6.5]))
        boot = stroke([pts[1], pts[2]], [8.5, 7]) | ell(foot[0], foot[1], 10, 5.5)
        boot &= (YY >= pts[1][1] + 6) & (YY <= 244)
        A.part(boot, VA_BLACK, r=5, bias=0.08, spec=(0.975, VA_BLACK[5]))
        A.part(stroke([(pts[1][0] - 8, pts[1][1] + 8), (pts[1][0] + 8, pts[1][1] + 6)], 2.4, smooth=False) & boot, VA_GOLD, r=1)
    # ---------------- redingote (pans)
    coat = poly([(100, 86), (146, 86), (152, 118), (156, 150), (162, 196), (146, 192), (136, 160), (122, 150), (108, 160), (98, 196),
                 (84, 192), (92, 150), (96, 118)], smooth=True)
    A.part(coat, VA_COAT, r=10, contrast=1.15, spec=(0.98, VA_COAT[5]))
    for pts in ([(100, 140), (94, 190)], [(148, 140), (154, 188)], [(110, 156), (102, 194)]):
        A.fold(pts, VA_COAT[0], VA_COAT[4], clip=coat)
    A.part(dilate(A.mask_line([(84, 192), (98, 196)], smooth=False)) & coat, VA_GOLD, r=1, line=False)
    A.part(dilate(A.mask_line([(146, 192), (162, 196)], smooth=False)) & coat, VA_GOLD, r=1, line=False)
    # gilet rouge
    vest = poly([(110, 92), (136, 92), (140, 140), (124, 150), (106, 140)], smooth=False)
    A.part(vest, VA_VEST, r=6, contrast=1.15)
    for y in (106, 118, 130):
        A.gem(124, y, 1.8, 1.8, VA_GOLD[1:])
    A.line([(126, 112), (134, 120), (138, 118)], VA_GOLD[3], smooth=True)  # chaîne de montre
    # revers du col
    for s_ in (-1, 1):
        lap = poly([(123 + s_ * 2, 92), (123 + s_ * 16, 88), (123 + s_ * 18, 104), (123 + s_ * 6, 132)])
        A.part(lap, VA_COAT, r=4, bias=0.12 if s_ < 0 else 0.0)
        A.line([(123 + s_ * 3, 94), (123 + s_ * 7, 128)], VA_GOLD[2], smooth=False, clip=lap)
    # jabot blanc + broche rubis
    jab = poly([(116, 86), (130, 86), (132, 98), (128, 112), (124, 106), (120, 112), (114, 98)], smooth=True)
    A.part(jab, VA_SHIRT, r=4, bias=0.05)
    for y in (96, 102, 108):
        A.line([(118, y), (124, y + 2), (130, y)], VA_SHIRT[1], clip=jab)
    A.gem(123, 92, 3.6, 3.6, VA_RED[1:], sparkle=True)
    A.part(ell(123, 92, 5, 5) & ~ell(123, 92, 3.6, 3.6), VA_GOLD, r=1, line=False)
    # ---------------- bras arrière (main gantée, griffe)
    A.part(stroke([(100, 92), (88, 116), (92, 138)], [9, 7.5, 6.5]), VA_COAT, r=5, bias=-0.08)
    A.part(stroke([(89, 128), (92, 138)], 7), VA_SHIRT, r=2)  # manchette
    hand(A, 93, 143, VA_GLOVE, r=4.6, fingers=4)
    # ---------------- col dressé (derrière la tête)
    col = poly([(96, 88), (84, 52), (100, 64), (110, 76), (136, 76), (150, 60), (164, 46), (152, 88)], smooth=False)
    A.part(col, VA_RED, r=6, bias=0.0)
    col_out = col & ~erode(erode(col))
    A.part(col_out, VA_BLACK, r=1, line=False)
    # cou
    neck = stroke([(124, 70), (124, 88)], 6.5)
    A.part(neck, VA_SKIN, r=3, bias=-0.22)
    # ---------------- tête
    hb = ell(cx - 3, cy - 6, 22, 21) | poly([(100, 50), (142, 50), (144, 70), (104, 72)])
    A.part(hb, VA_HAIR, r=8, bias=-0.1, spec=(0.975, VA_HAIR[5]))
    head = anime_head(A, cx, cy, VA_SKIN, VA_IRIS, VA_HAIR[1], mouth_kind='fang', lip='#a0405a', mouth_dark='#3a0a1a',
                      blush_c='#c8a0c8', glow=VA_IRIS[3], eye_h=8, brow_ang=2, neck=neck, lash=OUTC)
    # cernes / pommettes creusées
    A.line([(cx - 11, cy + 11), (cx - 4, cy + 11)], VA_SKIN[2])
    A.line([(cx + 14, cy + 8), (cx + 13, cy + 14)], VA_SKIN[2])
    # oreille pointue
    A.part(poly([(cx - 17, cy + 2), (cx - 30, cy - 10), (cx - 14, cy + 12)]), VA_SKIN, r=2)
    # cheveux plaqués en arrière, pointe en V au front
    top = ell(cx - 2, cy - 6, 22, 19) & (YY < cy - 3)
    top &= ~poly([(cx - 14, cy - 2), (cx + 2, cy - 10), (cx + 18, cy - 4), (cx + 18, cy + 4), (cx - 14, cy + 4)])
    top |= poly([(cx - 4, cy - 12), (cx + 2, cy - 2), (cx + 7, cy - 11)])
    A.part(top, VA_HAIR, r=8, spec=(0.97, VA_HAIR[6]))
    for k in range(6):
        A.line([(cx + 10 - k * 4, cy - 10), (cx - k * 5, cy - 22), (cx - 16 - k * 2, cy - 18 + k * 2)], VA_HAIR[3] if k % 2 else VA_HAIR[5],
               clip=top)
    # mèche rebelle
    lock(A, [(cx + 8, cy - 8), (cx + 13, cy + 2), (cx + 11, cy + 9)], [3, 2.5, 0.6], VA_HAIR, r=2, hi=VA_HAIR[5])
    # ---------------- rapière (bras avant)
    A.part(stroke([(146, 92), (160, 114), (170, 128)], [9, 7.5, 6.5]), VA_COAT, r=5, spec=(0.98, VA_COAT[5]))
    A.part(stroke([(166, 124), (171, 130)], 7.2), VA_SHIRT, r=2)
    hx_, hy_ = 176, 134
    d = (236 - hx_, 214 - hy_)
    ln = math.hypot(*d)
    ux, uy = d[0] / ln, d[1] / ln
    b0 = (hx_ + ux * 8, hy_ + uy * 8)
    tip = (hx_ + ux * 118, hy_ + uy * 118)
    blade = stroke([b0, tip], [2.8, 1.0], smooth=False)
    A.part(blade, VA_STEEL, r=2, contrast=1.3, spec=(0.97, '#ffffff'), norim=True)
    A.line([b0, (tip[0] - ux * 3, tip[1] - uy * 3)], VA_STEEL[4], smooth=False, clip=blade)
    # garde : coquille et branches dorées
    shell = ell(b0[0] - ux * 2, b0[1] - uy * 2, 6.5, 4, math.degrees(math.atan2(uy, ux)) + 90)
    A.part(shell, VA_GOLD, r=3, contrast=1.3, spec=(0.98, VA_GOLD[4]))
    A.part(stroke([(b0[0] + 6, b0[1] - 6), (hx_ - 6, hy_ - 2), (hx_ - 8, hy_ + 6)], 1.4), VA_GOLD, r=1)
    A.part(stroke([(b0[0] - 7, b0[1] + 4), (b0[0] + 7, b0[1] - 4)], 1.6, smooth=False), VA_GOLD, r=1)
    hand(A, hx_, hy_, VA_GLOVE, r=4.8, fingers=4, ang=40)
    A.gem(hx_ - ux * 8, hy_ - uy * 8, 2.6, 2.6, VA_RED[1:])

    A.finish()
    # chauves-souris + gouttes de sang + brume rouge
    for (x, y, s_, f) in ((40, 40, 1.4, 3), (200, 40, 1.2, -2), (222, 80, 0.9, 2), (60, 90, 0.9, -1), (180, 14, 0.8, 1)):
        bat(A, x, y, s_, f)
    for (x, y) in ((tip[0] - 2, tip[1] + 6), (tip[0] - 4, tip[1] + 14), (210, 200)):
        A.pxs([(x, y), (x, y + 1), (x - 1, y + 2), (x, y + 2), (x + 1, y + 2), (x, y + 3)], VA_RED[3])
        A.px(x - 1, y + 2, VA_RED[5])
    for (x, y, s_) in ((30, 200, 2), (226, 150, 2), (150, 20, 2)):
        A.sparkle(x, y, s_, '#ff8a8a', VA_RED[3])
    A.apply_fx()
    return A


# ================================================================== NINJA
N_SKIN = ['#7a4048', '#a8604e', '#e39a78', '#f6c0a0', '#ffcfa6', '#ffe6cc']
N_HAIR = ['#030308', '#05050c', '#0e0e1c', '#1a1a2e', '#2c2e48', '#4c5070', '#7a80a8']
N_IRIS = ['#5a2a06', '#e08a1a', '#ffe07a', '#fff6c0']
N_GARB = ['#05050f', '#0a0a1e', '#151a3a', '#232b58', '#34427e', '#5266a8']
N_SCARF = ['#24040a', '#3a0610', '#760e1e', '#c01e2c', '#ee463c', '#ff9a7a']
N_WRAP = ['#2a2a40', '#5a5a7a', '#9a9ab4', '#d4d4e4', '#f0f0f8']
N_STEEL = ['#1e2234', '#3a4258', '#7a86a0', '#c4ccdc', '#eef2fa', '#ffffff']
N_SHADOW = ['#1a0e30', '#2a1a4a', '#4a2e7a', '#7a5ab0']
N_HILT = ['#0a0608', '#1a0e10', '#2e1a1a', '#4a2a22']


def wraps(A, m, p0, p1, n, col_d, col_l):
    """Bandages en spirale le long d'un segment (clip au masque)."""
    for k in range(n):
        t = (k + 0.5) / n
        x, y = p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t
        A.line([(x - 6, y - 2), (x + 6, y + 2)], col_d, smooth=False, clip=m)
        A.line([(x - 6, y - 3), (x + 6, y + 1)], col_l, smooth=False, clip=m)


@character('ninja')
def ninja():
    A = Art(accent='#ff5a4a')
    cx, cy = 122, 56
    # ---------------- longues bandes de l'écharpe (derrière, au vent)
    for (pts, rad, b) in (([(112, 84), (90, 80), (64, 88), (40, 82), (18, 92)], [6, 6, 5.5, 5, 2], -0.1),
                          ([(110, 88), (86, 96), (62, 110), (42, 108), (24, 122)], [5.5, 5.5, 5, 4.5, 1.5], 0.0)):
        m = stroke(pts, rad)
        A.part(m, N_SCARF, r=4, bias=b, contrast=1.15)
        A.line(pts[1:], N_SCARF[2], clip=m)
        A.line([(x, y - 3) for x, y in pts[1:4]], N_SCARF[5], clip=m)
    # ---------------- jambes (posture basse, genou avant plié)
    legs = []
    for (pts, foot, side) in ((([(110, 150), (96, 186), (92, 230)]), (98, 238), -1), (([(136, 150), (158, 182), (160, 228)]), (168, 238), 1)):
        leg = stroke(pts, [12, 9, 7])
        A.part(leg, N_GARB, r=7, bias=-0.1 if side < 0 else 0.03)
        A.fold([(pts[0][0] + 2 * side, pts[0][1] + 8), (pts[1][0] + side, pts[1][1] - 4)], N_GARB[1], N_GARB[4], clip=leg)
        # bandes de mollet
        calf = stroke([pts[1], pts[2]], [8, 6.5]) & (YY > pts[1][1] + 6)
        A.part(calf, N_WRAP, r=4, bias=-0.1 if side < 0 else 0.0)
        wraps(A, calf, (pts[1][0], pts[1][1] + 8), pts[2], 6, N_WRAP[1], N_WRAP[3])
        # tabi
        ft = ell(foot[0], foot[1], 10, 5.5) | stroke([pts[2], (pts[2][0], pts[2][1] + 6)], 6)
        ft &= (YY >= pts[2][1] - 2) & (YY <= 244)
        A.part(ft, N_GARB, r=4, bias=0.05)
        A.line([(foot[0] + 3, foot[1] - 4), (foot[0] + 3, foot[1] + 4)], N_GARB[0], smooth=False, clip=ft)
        legs.append(pts)
    # ---------------- bras arrière : kunai en main, tendu derrière
    arm_b = stroke([(102, 94), (84, 112), (68, 122)], [8, 6.5, 5.5])
    A.part(arm_b, N_GARB, r=5, bias=-0.08)
    fb = stroke([(84, 112), (70, 121)], 6.2)
    A.part(fb, N_WRAP, r=3, bias=-0.05)
    wraps(A, fb, (84, 112), (70, 121), 3, N_WRAP[1], N_WRAP[3])
    # kunai
    k0 = (60, 128)
    kb = poly([(k0[0] + 4, k0[1]), (k0[0] - 2, k0[1] + 4), (k0[0] - 16, k0[1] + 24), (k0[0] - 1, k0[1] + 10), (k0[0] + 2, k0[1] + 6)])
    A.part(kb, N_STEEL, r=2, contrast=1.3, norim=True)
    A.line([(k0[0] + 1, k0[1] + 3), (k0[0] - 13, k0[1] + 21)], N_STEEL[4], smooth=False, clip=kb)
    A.part(stroke([(k0[0] + 3, k0[1] + 1), (k0[0] + 10, k0[1] - 9)], 2.2, smooth=False), N_HILT, r=1)
    A.part(ell(k0[0] + 12, k0[1] - 12, 3.4, 3.4), N_STEEL, r=2)
    A.px(k0[0] + 12, k0[1] - 12, N_GARB[0])
    hand(A, 64, 124, N_SKIN, r=4.6, fingers=4, ang=40)
    # ---------------- torse (veste croisée, ceinture rouge)
    tor = poly([(100, 88), (146, 88), (152, 104), (146, 126), (148, 150), (100, 152), (98, 126), (94, 104)], smooth=True)
    A.part(tor, N_GARB, r=10, contrast=1.15, spec=(0.98, N_GARB[5]))
    A.fold([(110, 92), (128, 124), (132, 146)], N_GARB[0], N_GARB[4], clip=tor)  # croisement
    A.fold([(138, 92), (128, 112)], N_GARB[1], N_GARB[4], clip=tor)
    A.fold([(104, 110), (106, 140)], N_GARB[1], N_GARB[3], clip=tor)
    # plastron de mailles léger
    for y in range(96, 120, 3):
        for x in range(112 + (y % 2), 140, 3):
            if A.a[y, x] and tor[y, x]:
                A.px(x, y, N_GARB[2], only=True)
    sash = poly([(96, 128), (150, 126), (151, 138), (97, 140)], smooth=False)
    A.part(sash, N_SCARF, r=4, contrast=1.15)
    A.fold([(100, 134), (148, 132)], N_SCARF[1], N_SCARF[4], clip=sash)
    knot = ell(108, 136, 6, 5)
    A.part(knot, N_SCARF, r=3, bias=0.1)
    A.part(stroke([(106, 140), (100, 156), (102, 166)], [3.5, 3, 1]), N_SCARF, r=2)
    A.part(stroke([(110, 140), (112, 158)], [3.2, 1]), N_SCARF, r=2, bias=-0.1)
    # jupe-pantalon (hakama court)
    hk = poly([(98, 140), (150, 138), (156, 162), (140, 168), (124, 156), (106, 166), (90, 160)], smooth=False)
    A.part(hk, N_GARB, r=8, bias=-0.03)
    A.fold([(112, 146), (100, 168)], N_GARB[1], N_GARB[4], clip=hk)
    A.fold([(138, 146), (150, 168)], N_GARB[1], N_GARB[4], clip=hk)
    # ---------------- tête : cheveux en pics + catogan
    tail = stroke([(cx - 16, cy - 10), (cx - 30, cy - 18), (cx - 44, cy - 14), (cx - 54, cy - 20)], [6, 5, 4, 1])
    A.part(tail, N_HAIR, r=4, spec=(0.975, N_HAIR[6]))
    hb = ell(cx - 2, cy - 4, 22, 21)
    A.part(hb, N_HAIR, r=8)
    neck = stroke([(124, 72), (124, 88)], 6.5)
    A.part(neck, N_GARB, r=3, bias=-0.15)
    head = anime_head(A, cx, cy, N_SKIN, N_IRIS, N_HAIR[2], mouth_kind='small', eye_h=8, brow_ang=3, neck=neck)
    # masque (bas du visage)
    mask = head & (YY > cy + 11) | poly([(cx - 16, cy + 10), (cx + 18, cy + 10), (cx + 14, cy + 30), (cx - 10, cy + 32)])
    mask &= ~(YY > cy + 34)
    A.part(mask, N_GARB, r=6, bias=0.05)
    A.line([(cx - 14, cy + 12), (cx + 2, cy + 13), (cx + 18, cy + 11)], N_GARB[4])
    A.fold([(cx + 8, cy + 14), (cx + 9, cy + 22)], N_GARB[1], N_GARB[4], clip=mask)
    A.fold([(cx - 6, cy + 16), (cx + 2, cy + 26)], N_GARB[1], N_GARB[3], clip=mask)
    # mèches en pics
    spikes = [(-20, -14, -30, -30), (-12, -18, -18, -40), (-2, -20, -2, -42), (8, -18, 14, -36), (16, -14, 26, -24), (18, -6, 28, -6)]
    for (bx, by, tx, ty) in spikes:
        m = poly([(cx + bx - 7, cy + by + 6), (cx + tx, cy + ty), (cx + bx + 7, cy + by + 4)], smooth=False)
        A.part(m, N_HAIR, r=3, spec=(0.97, N_HAIR[6]))
    A.part(ell(cx - 1, cy - 8, 21, 14) & (YY < cy - 2), N_HAIR, r=6, spec=(0.975, N_HAIR[6]))
    # frange sur le bandeau
    for (dx, dy, w, b) in ((-6, 2, 4, 0), (4, 4, 4, 1), (12, 1, 3, 2)):
        A.part(poly([(cx + dx - w, cy - 8), (cx + dx + w, cy - 8), (cx + dx + b, cy + dy)]), N_HAIR, r=2, bias=0.05)
    # bandeau + plaque d'acier
    band = poly([(cx - 22, cy - 6), (cx + 18, cy - 10), (cx + 19, cy - 4), (cx - 21, cy + 1)])
    A.part(band, N_GARB, r=2, bias=0.15)
    plate = poly([(cx - 6, cy - 9), (cx + 14, cy - 11), (cx + 15, cy - 4), (cx - 5, cy - 2)])
    A.part(plate, N_STEEL, r=3, contrast=1.3, spec=(0.97, '#ffffff'))
    A.line([(cx - 1, cy - 6), (cx + 3, cy - 8), (cx + 7, cy - 6), (cx + 10, cy - 8)], N_STEEL[1], smooth=False, clip=plate)
    for (x, y) in ((cx - 4, cy - 5), (cx + 13, cy - 7)):
        A.px(x, y, N_STEEL[5], only=True)
    # nœud du bandeau qui flotte
    A.part(stroke([(cx - 22, cy - 3), (cx - 34, cy + 2), (cx - 44, cy - 2)], [3, 2.5, 0.8]), N_GARB, r=2, bias=0.1)
    A.part(stroke([(cx - 22, cy - 2), (cx - 32, cy + 8), (cx - 40, cy + 10)], [3, 2.5, 0.8]), N_GARB, r=2)
    # col de l'écharpe rouge
    sc = stroke([(104, 84), (116, 90), (132, 90), (144, 84)], [6, 7, 7, 6])
    A.part(sc, N_SCARF, r=4, contrast=1.15)
    A.fold([(108, 86), (124, 92), (140, 86)], N_SCARF[1], N_SCARF[4], clip=sc)
    # ---------------- bras avant : katana tendu
    arm_f = stroke([(144, 92), (160, 106), (174, 112)], [8, 6.5, 5.5])
    A.part(arm_f, N_GARB, r=5, spec=(0.98, N_GARB[5]))
    ff = stroke([(160, 106), (172, 112)], 6.2)
    A.part(ff, N_WRAP, r=3)
    wraps(A, ff, (160, 106), (172, 112), 3, N_WRAP[1], N_WRAP[3])
    hx_, hy_ = 180, 114
    ang = math.radians(-28)
    ux, uy = math.cos(ang), math.sin(ang)
    px_, py_ = -uy, ux
    # poignée (tsuka) derrière la main
    tsuka = stroke([(hx_ - ux * 14, hy_ - uy * 14), (hx_ + ux * 8, hy_ + uy * 8)], 2.8, smooth=False)
    A.part(tsuka, N_HILT, r=2)
    for k in range(-12, 8, 4):
        A.px(hx_ + ux * k, hy_ + uy * k, N_SCARF[3], only=True)
    A.part(ell(hx_ - ux * 15, hy_ - uy * 15, 3, 3), N_STEEL, r=1)
    # cordon et pompon rouges
    A.part(stroke([(hx_ - ux * 15, hy_ - uy * 15), (hx_ - ux * 18, hy_ + 8), (hx_ - ux * 14, hy_ + 16)], [1.2, 1.2, 2.6]), N_SCARF, r=1)
    # tsuba
    tsb = ell(hx_ + ux * 10, hy_ + uy * 10, 2.6, 6.5, math.degrees(ang))
    A.part(tsb, ['#3a2a10', '#7a5a20', '#c8a040', '#f6d070'], r=2, contrast=1.3)
    # lame légèrement courbe
    b0 = (hx_ + ux * 12, hy_ + uy * 12)
    L = 96
    pts_back = [(b0[0] + ux * L * t + px_ * (-2.5 - 3 * t * t), b0[1] + uy * L * t + py_ * (-2.5 - 3 * t * t)) for t in np.linspace(0, 1, 12)]
    pts_edge = [(b0[0] + ux * L * t + px_ * (2.5 - 3 * t * t * 1.2), b0[1] + uy * L * t + py_ * (2.5 - 3 * t * t * 1.2)) for t in np.linspace(0, 1, 12)]
    blade = poly(pts_back + pts_edge[::-1], smooth=False)
    A.part(blade, N_STEEL, r=3, contrast=1.3, spec=(0.97, '#ffffff'), norim=True)
    A.line(pts_edge[:-1], N_STEEL[5], smooth=False, clip=blade)  # fil
    A.line([((a[0] + b[0]) / 2, (a[1] + b[1]) / 2) for a, b in zip(pts_back[:-2], pts_edge[:-2])], N_STEEL[2], smooth=False, clip=blade)  # hamon
    hand(A, hx_, hy_, N_SKIN, r=5, fingers=4, ang=-28)

    A.finish()
    # traînées d'ombre et éclat sur la lame
    tipp = pts_back[-1]
    A.sparkle(tipp[0] - 2, tipp[1] + 2, 4, '#ffffff', '#c4ccdc')
    rr = random.Random(3)
    for i in range(14):
        x, y = rr.randint(20, 90), rr.randint(150, 240)
        m = stroke([(x, y), (x - rr.randint(8, 20), y + rr.randint(-2, 2))], [1.6, 0.4], smooth=False) & ~A.a
        A.rgb[m] = rgb(N_SHADOW[rr.randint(1, 3)])
        A.a |= m
    for (x, y, s_) in ((236, 30, 2), (200, 12, 3), (40, 40, 2)):
        A.sparkle(x, y, s_, '#ffffff', N_SHADOW[3])
    # shuriken plantés / en vol
    for (x, y) in ((214, 150), (34, 60)):
        for (dx, dy) in ((0, -4), (4, 0), (0, 4), (-4, 0), (0, -3), (3, 0), (0, 3), (-3, 0)):
            A.px(x + dx, y + dy, N_STEEL[3])
        for (dx, dy) in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
            A.px(x + dx, y + dy, N_STEEL[2])
        A.px(x, y, N_GARB[0])
    A.apply_fx()
    return A


# ================================================================== sortie

def render(cid):
    A = CHARS[cid]()
    img = A.image()
    os.makedirs(OUT_DIR, exist_ok=True)
    img.save(os.path.join(OUT_DIR, cid + '.png'))
    return img


ORDER = ['grombar', 'demoness', 'seraph', 'fairy', 'valkyrie', 'witch', 'vampire', 'ninja']


def preview(ids):
    cell_w, cell_h = 512 + 24 + 200, 512 + 16
    cols = 2
    rows = (len(ids) + cols - 1) // cols
    sheet = Image.new('RGBA', (cols * cell_w + 16, rows * cell_h + 16), (22, 18, 34, 255))
    for i, cid in enumerate(ids):
        p = os.path.join(OUT_DIR, cid + '.png')
        if not os.path.exists(p):
            continue
        im = Image.open(p).convert('RGBA')
        ox, oy = 16 + (i % cols) * cell_w, 16 + (i // cols) * cell_h
        bg = Image.new('RGBA', (512, 512), (44, 38, 62, 255))
        sheet.alpha_composite(bg, (ox, oy))
        sheet.alpha_composite(im.resize((512, 512), Image.NEAREST), (ox, oy))
        sp = Image.open(os.path.join(SPRITES, 'skin_%s_idle.png' % cid)).convert('RGBA')
        sp = sp.resize((sp.width * 4, sp.height * 4), Image.NEAREST)
        sheet.alpha_composite(sp, (ox + 512 + 12, oy + 512 - sp.height - 8))
    sheet.save(PREVIEW)


def main(argv):
    ids = argv or [c for c in ORDER if c in CHARS]
    for cid in ids:
        render(cid)
        print('ok', cid)
    preview([c for c in ORDER])


if __name__ == '__main__':
    main(sys.argv[1:])
