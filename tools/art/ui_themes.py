"""Cadres 9-slice propres à chaque thème d'interface (hors Chevalier).

Chaque thème a son propre STYLE de dorures / cadres (forme des bords, ornements de coin,
forme des boutons), pas seulement sa palette. Les 16 cadres reprennent EXACTEMENT les
dimensions et les valeurs 9-slice de assets/ui/frames/frames.json (générés par
ui_frames.py) : seul l'URL de l'image change côté CSS.

Usage :
  python3 tools/art/ui_themes.py                     # écrit assets/ui/themes/<id>/*.png + vérifie
  python3 tools/art/ui_themes.py --preview DOSSIER   # + planches d'aperçu (9-slice, x3)
  python3 tools/art/ui_themes.py --check             # vérifie seulement les dimensions

Règles 9-slice respectées :
  * zones de bord étirées (stretch) : uniformes sur leur longueur, ornements dans les coins ;
  * `panel` (repeat round) : motifs périodiques de 16 px sur les barres ;
  * centre (fill) uni.
"""
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)

import ui_frames as UF  # noqa: E402
from ui_frames import Img  # noqa: E402

THEMES = ['royal', 'sylvan', 'forge', 'arcane', 'necro', 'desert', 'frost', 'sakura', 'shadow']
NAMES = list(UF.FRAMES.keys())

# ====================================================================== outils


def lerp(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(len(a)))


def vgrad(stops):
    """Dégradé vertical : stops = {y: couleur} ; hors bornes = couleur extrême."""
    ys = sorted(stops)

    def f(x, y):
        if y <= ys[0]:
            return stops[ys[0]]
        if y >= ys[-1]:
            return stops[ys[-1]]
        for a, b in zip(ys, ys[1:]):
            if a <= y <= b:
                return lerp(stops[a], stops[b], (y - a) / (b - a))
    return f


# profils de coin haut-gauche : début de ligne (x) pour chaque ligne y
SQ = []


def CUT(c):
    return list(range(c, 0, -1))


RND = {1: [1], 2: [2, 1], 3: [3, 1, 1], 4: [4, 2, 1, 1], 5: [5, 3, 2, 1, 1]}


def mask_from_prof(w, h, prof):
    """prof : liste (même coin x4) ou tuple (hg, hd, bg, bd)."""
    if isinstance(prof, tuple):
        tl, tr, bl, br = prof
    else:
        tl = tr = bl = br = prof
    m = [[True] * w for _ in range(h)]
    for p, fx, fy in ((tl, False, False), (tr, True, False), (bl, False, True), (br, True, True)):
        for y, s in enumerate(p):
            for x in range(s):
                xx = w - 1 - x if fx else x
                yy = h - 1 - y if fy else y
                m[yy][xx] = False
    return m


def rect_mask(W, H, x0, y0, x1, y1, prof=SQ):
    sub = mask_from_prof(x1 - x0 + 1, y1 - y0 + 1, prof)
    m = [[False] * W for _ in range(H)]
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            m[y][x] = sub[y - y0][x - x0]
    return m


def depth_map(mask):
    """Profondeur par érosion en croix (anneaux de 1 px, 8-connexes)."""
    h, w = len(mask), len(mask[0])
    D = [[-1] * w for _ in range(h)]
    cur = {(x, y) for y in range(h) for x in range(w) if mask[y][x]}
    d = 0
    while cur:
        nxt = set()
        for (x, y) in cur:
            if all((x + dx, y + dy) in cur for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                nxt.add((x, y))
        for p in cur - nxt:
            D[p[1]][p[0]] = d
        cur = nxt
        d += 1
    return D


def paint(im, mask, rings, fill, ox=0, oy=0):
    """Anneaux successifs depuis le bord ; rings[i] = couleur | (hg, bd) | (hg, bd, neutre) | None."""
    D = depth_map(mask)
    h, w = len(mask), len(mask[0])

    def dd(x, y):
        return D[y][x] if 0 <= x < w and 0 <= y < h else -1
    for y in range(h):
        for x in range(w):
            d = D[y][x]
            if d < 0:
                continue
            if d < len(rings):
                r = rings[d]
                if r is None:
                    continue
                if isinstance(r, tuple) and len(r) in (2, 3) and isinstance(r[0], (tuple, str)):
                    tl = dd(x, y - 1) < d or dd(x - 1, y) < d
                    br = dd(x, y + 1) < d or dd(x + 1, y) < d
                    if tl and br:
                        c = r[2] if len(r) == 3 else r[0]
                    elif br:
                        c = r[1]
                    else:
                        c = r[0]
                else:
                    c = r
            else:
                c = fill(x + ox, y + oy) if callable(fill) else fill
            im.set(x + ox, y + oy, c)
    return D


def framed(w, h, prof, rings, fill):
    im = Img(w, h)
    paint(im, mask_from_prof(w, h, prof), rings, fill)
    return im


def plate(im, x0, y0, x1, y1, rings, fill, prof=SQ):
    w, h = x1 - x0 + 1, y1 - y0 + 1
    paint(im, mask_from_prof(w, h, prof), rings, fill, x0, y0)


def side_set(im, side, t, a, c):
    """Écrit sur un bord : t = position le long du bord, a = profondeur depuis l'extérieur."""
    if side == 'top':
        im.set(t, a, c)
    elif side == 'bottom':
        im.set(t, im.h - 1 - a, c)
    elif side == 'left':
        im.set(a, t, c)
    else:
        im.set(im.w - 1 - a, t, c)


SIDES = ('top', 'bottom', 'left', 'right')


def stamp_rows(im, rows, pal, ox, oy, fx=False, fy=False):
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch in ' .':
                continue
            xx = ox + (len(row) - 1 - x if fx else x)
            yy = oy + (len(rows) - 1 - y if fy else y)
            im.set(xx, yy, pal[ch])


def corners(im, rows, pal, mirror=True, inset=0):
    """Pose un motif dans les 4 coins ; mirror=False garde l'éclairage haut-gauche."""
    n, m = len(rows), len(rows[0])
    for fx in (False, True):
        for fy in (False, True):
            ox = im.w - m - inset if fx else inset
            oy = im.h - n - inset if fy else inset
            stamp_rows(im, rows, pal, ox, oy, fx and mirror, fy and mirror)


def blob(im, pts, color_fn, outline):
    """Remplit un ensemble de points puis le cerne (contour 4-voisins)."""
    s = set(pts)
    for (x, y) in s:
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            q = (x + dx, y + dy)
            if q not in s and outline is not None:
                im.set(q[0], q[1], outline)
    for (x, y) in s:
        im.set(x, y, color_fn(x, y))


def disc_pts(cx, cy, r):
    return [(x, y) for y in range(int(cy - r - 1), int(cy + r + 2))
            for x in range(int(cx - r - 1), int(cx + r + 2))
            if (x - cx) ** 2 + (y - cy) ** 2 <= r * r]


def ball(im, cx, cy, r, ramp, outline):
    """Sphère/bosse ombrée (lumière haut-gauche). ramp = sombre -> clair (4 teintes)."""
    def c(x, y):
        dx, dy = (x - cx) / max(r, .5), (y - cy) / max(r, .5)
        v = -(dx + dy) * 0.7 + 0.25 - 0.35 * (dx * dx + dy * dy)
        i = 0 if v < -0.45 else 1 if v < 0.0 else 2 if v < 0.45 else 3
        return ramp[i]
    blob(im, disc_pts(cx, cy, r), c, outline)


def diamond(im, cx, cy, r, outline, light, dark, core=None):
    pts = [(cx + dx, cy + dy) for dy in range(-r, r + 1) for dx in range(-r, r + 1) if abs(dx) + abs(dy) <= r]

    def c(x, y):
        if core is not None and (x, y) == (cx, cy):
            return core
        return light if (x - cx) + (y - cy) < 0 else dark
    blob(im, pts, c, outline)


# ====================================================================== rampes communes

# ====================================================================== ROYAL

class Royal:
    K = (5, 8, 26)
    n0, n1, n2, n3 = (9, 15, 40), (14, 24, 62), (20, 34, 84), (30, 50, 112)
    g0, g1, g2, g3, g4 = (84, 48, 10), (160, 108, 34), (214, 164, 64), (248, 214, 112), (255, 246, 200)
    BTN = {
        'gold':   ((70, 38, 6), (176, 116, 30), (232, 176, 58), (252, 214, 110), (255, 248, 210)),
        'blue':   ((6, 14, 50), (24, 56, 150), (38, 92, 210), (80, 142, 244), (190, 226, 255)),
        'purple': ((24, 8, 50), (72, 30, 128), (108, 54, 186), (150, 100, 230), (218, 190, 255)),
        'gray':   ((14, 18, 30), (54, 62, 82), (82, 92, 116), (120, 132, 160), (196, 206, 226)),
        'red':    ((44, 6, 14), (124, 22, 36), (180, 38, 52), (224, 82, 86), (255, 182, 176)),
    }
    BADGE = {
        'green': ((6, 30, 14), (26, 104, 50), (42, 150, 72), (130, 226, 140)),
        'gray':  ((14, 18, 30), (54, 62, 82), (80, 90, 112), (150, 162, 186)),
        'gold':  ((70, 38, 6), (186, 126, 36), (238, 186, 70), (255, 238, 160)),
        'red':   ((44, 6, 14), (120, 22, 34), (172, 38, 50), (240, 120, 116)),
    }

    def fleur(self, im, big):
        """Équerre de filigrane d'or + petit losange, coin haut-gauche (posée en miroir)."""
        t = Img(16, 16)
        g2, g3, g4, g1, K = self.g2, self.g3, self.g4, self.g1, self.K
        if big:
            # bras fins le long des filets (profondeur 6), terminés par une volute
            for i in range(9, 14):
                t.set(i, 6, g2)
                t.set(6, i, g2)
            t.set(14, 7, g2); t.set(13, 8, g1); t.set(14, 5, g1)
            t.set(7, 14, g2); t.set(8, 13, g1); t.set(5, 14, g1)
            # fleur : losange central + pétales
            diamond(t, 6, 6, 3, K, g3, g1, core=g4)
            t.set(6, 6, g4); t.set(5, 6, (120, 190, 255)); t.set(6, 5, (120, 190, 255))
            t.set(6, 6, (220, 240, 255)); t.set(7, 6, (60, 120, 220)); t.set(6, 7, (60, 120, 220))
        else:
            for i in range(6, 9):
                t.set(i, 4, g2)
                t.set(4, i, g2)
            t.set(9, 5, g1); t.set(5, 9, g1)
            diamond(t, 4, 4, 2, K, g3, g1, core=g4)
        UF.stamp_img4(im, t)

    def panel(self):
        top = vgrad({5: self.n3, 15: self.n1})
        rings = [self.K, (self.g3, self.g2, self.g3), self.n2, self.n2, (self.g1, self.g0, self.g1), self.n0]
        im = framed(48, 48, RND[3], rings, top)
        # petits maillons de filigrane tous les 16 px (repeat round)
        for s in SIDES:
            for t in (23, 24):
                side_set(im, s, t, 2, self.g3 if s in ('top', 'left') else self.g2)
                side_set(im, s, t, 3, self.g1)
            for t in (22, 25):
                side_set(im, s, t, 2, self.g1)
            side_set(im, s, 16, 2, self.g0)
            side_set(im, s, 31, 2, self.g0)
        self.fleur(im, True)
        return im

    def panel_alt(self):
        fill = vgrad({4: self.n3, 9: self.n2})
        rings = [self.K, (self.g3, self.g1, self.g2), self.n1, (self.g1, self.g0, self.g1)]
        im = framed(32, 32, RND[2], rings, fill)
        self.fleur(im, False)
        return im

    def header(self):
        im = Img(48, 25)
        m = [[3 <= y <= 21 and 4 <= x <= 43 for x in range(48)] for y in range(25)]
        for y in (3, 21):
            for x in (4, 43):
                m[y][x] = False
        grad = vgrad({5: (66, 112, 214), 9: (40, 78, 176), 13: (26, 52, 130), 18: (14, 26, 74)})
        paint(im, m, [self.K, (self.g3, self.g1, self.g2), self.K], grad)
        for x in range(6, 42):  # soulignement doré
            im.set(x, 18, self.g2)
            im.set(x, 19, self.g0)
        # embouts : losanges d'or à l'axe
        for cx in (5, 42):
            diamond(im, cx, 12, 5, self.K, self.g3, self.g1)
            diamond(im, cx, 12, 2, self.g0, self.n3, self.n1, core=self.g4)
        return im

    def tab(self, active):
        if active:
            fill = vgrad({3: (54, 96, 186), 7: (30, 56, 132)})
            rings = [self.K, (self.g3, self.g2, self.g3), (60, 100, 190)]
            im = framed(32, 32, RND[3], rings, fill)
            for x in range(4, 28):  # lueur dorée en bas
                im.set(x, 29, self.g4)
                im.set(x, 28, self.g2)
                im.set(x, 27, (96, 104, 140))
            im.set(3, 29, self.g3); im.set(28, 29, self.g3)
            for (x, y) in ((3, 3), (28, 3)):
                im.set(x, y, self.g4)
        else:
            fill = vgrad({3: self.n3, 8: self.n2})
            rings = [self.K, (self.g2, self.g1, self.g1), self.n0]
            im = framed(32, 32, RND[3], rings, fill)
            for (x, y) in ((3, 3), (28, 3), (3, 28), (28, 28)):
                im.set(x, y, self.g1)
        return im

    def button(self, k):
        o, sh, base, lt, hi = self.BTN[k]
        rim = (self.g1, self.g0, self.g1) if k == 'gold' else (self.g3, self.g1, self.g2)
        im = framed(16, 16, RND[2], [o, rim, (hi, sh, lt)], base)
        for x in range(3, 13):
            im.set(x, 3, lt)
            im.set(x, 4, lerp(lt, base, 0.5))
            im.set(x, 12, lerp(base, sh, 0.5))
        im.set(3, 2, (255, 255, 255)); im.set(4, 2, (255, 255, 255))
        return im

    def badge(self, k):
        o, sh, base, hi = self.BADGE[k]
        rim = self.g1 if k == 'gold' else self.g2
        return framed(12, 12, RND[3], [o, (rim, self.g0, rim), (hi, sh, base)], base)

    def slot(self):
        return framed(24, 24, RND[2], [self.K, (self.g2, self.g0, self.g1), self.K,
                                        ((5, 9, 26), (24, 38, 84))], (10, 17, 44))

    def tooltip(self):
        im = framed(24, 24, RND[2], [self.K, (self.g3, self.g1, self.g2), self.n1,
                                      (self.g1, self.g0, self.g1)], (12, 20, 52, 244))
        t = Img(8, 8)
        diamond(t, 3, 3, 1, None, self.g4, self.g2)
        UF.stamp_img4(im, t)
        return im


# ====================================================================== SYLVAN

# feuilles dessinées à la main (a sombre .. d clair, nervure b)
LEAF_D = [          # diagonale, pointe en haut à droite, tige en bas à gauche
    ".....KKK",
    "...KKcdK",
    "..KccdbK",
    ".KccdbaK",
    ".KcdbaK.",
    "KcdbaK..",
    "KdaKK...",
    "KK......",
]
LEAF_S = [
    "..KKK",
    ".KcdK",
    "KcdbK",
    "KdaK.",
    "KKK..",
]


class Sylvan:
    K = (16, 10, 6)
    w0, w1, w2, w3, w4 = (44, 26, 12), (74, 44, 20), (106, 66, 30), (140, 92, 44), (178, 126, 68)
    l0, l1, l2, l3, l4 = (10, 38, 14), (28, 82, 30), (58, 132, 44), (108, 182, 70), (186, 230, 124)
    f0, f1, f2 = (8, 22, 12), (16, 38, 22), (24, 52, 30)
    BTN = {
        'gold':   ((60, 34, 4), (178, 120, 30), (226, 174, 62), (246, 210, 112), (255, 244, 196)),
        'blue':   ((8, 34, 12), (30, 86, 30), (48, 126, 42), (88, 170, 64), (180, 232, 140)),
        'purple': ((30, 8, 36), (76, 30, 92), (112, 50, 130), (156, 92, 172), (220, 178, 230)),
        'gray':   ((22, 16, 10), (66, 56, 44), (96, 84, 68), (136, 122, 100), (200, 188, 160)),
        'red':    ((40, 6, 8), (118, 26, 22), (170, 44, 34), (214, 86, 66), (255, 176, 150)),
    }
    BADGE = {
        'green': ((8, 34, 12), (30, 98, 34), (52, 148, 52), (140, 220, 110)),
        'gray':  ((22, 16, 10), (64, 56, 44), (92, 82, 68), (150, 138, 116)),
        'gold':  ((60, 34, 4), (186, 128, 36), (232, 182, 70), (255, 232, 150)),
        'red':   ((40, 6, 8), (116, 26, 22), (166, 44, 34), (236, 122, 100)),
    }

    def lpal(self):
        return {'K': self.K, 'a': self.l1, 'b': self.l2, 'c': self.l3, 'd': self.l4,
                'w': self.w4, 'x': self.w3, 'y': self.w1, 'z': self.w0}

    def grain(self, im):
        """Veinures supplémentaires périodiques (panel) : nœud + brins sombres/clairs."""
        for s in SIDES:
            lit = s in ('top', 'left')
            for t in range(17, 23):
                side_set(im, s, t, 3, self.w1)
            for t in range(26, 31):
                side_set(im, s, t, 2, self.w4 if lit else self.w3)
                side_set(im, s, t, 4, self.w2)
            for (t, a, c) in ((23, 2, self.w1), (24, 2, self.w0), (25, 2, self.w1),
                              (23, 3, self.w0), (24, 3, self.K), (25, 3, self.w0)):
                side_set(im, s, t, a, c)

    def end_grain(self, im, x0, y0, n):
        """Bloc de coin en bois de bout : cernes concentriques."""
        rings = [self.K, (self.w4, self.w1, self.w3), self.w2, self.w3, self.w1, self.w3]
        plate(im, x0, y0, x0 + n - 1, y0 + n - 1, rings, self.w1, RND[2])

    def panel(self):
        rings = [self.K, (self.w4, self.w2, self.w3), (self.w2, self.w1), (self.w3, self.w2), (self.w1, self.w0),
                 self.K, (self.l1, self.l0), self.f0]
        im = framed(48, 48, RND[2], rings, self.f1)
        self.grain(im)
        for (x, y) in ((0, 0), (38, 0), (0, 38), (38, 38)):
            self.end_grain(im, x, y, 10)
        t = Img(16, 16)
        stamp_rows(t, LEAF_D, self.lpal(), 8, 8, fy=True)
        stamp_rows(t, LEAF_S, self.lpal(), 10, 1)
        stamp_rows(t, LEAF_S, self.lpal(), 1, 10, fx=True, fy=True)
        UF.stamp_img4(im, t)
        return im

    def panel_alt(self):
        rings = [self.K, (self.w3, self.w1, self.w2), (self.w2, self.w0), self.K, self.f0]
        im = framed(32, 32, RND[1], rings, self.f2)
        t = Img(16, 16)
        stamp_rows(t, LEAF_D, self.lpal(), 2, 2, fy=True)
        UF.stamp_img4(im, t)
        return im

    def header(self):
        im = Img(48, 25)
        m = rect_mask(48, 25, 5, 4, 42, 20, RND[3])
        grad = vgrad({8: (34, 70, 38), 16: (16, 38, 22)})
        paint(im, m, [self.K, (self.w4, self.w2, self.w3), (self.w2, self.w1), (self.w3, self.w1),
                      self.K], grad)
        for x in range(9, 39):  # veine du bois
            im.set(x, 6, self.w2)
        lp = self.lpal()
        stamp_rows(im, LEAF_D, lp, 0, 2, fx=True)
        stamp_rows(im, LEAF_D, lp, 0, 15, fx=True, fy=True)
        stamp_rows(im, LEAF_D, lp, 40, 2)
        stamp_rows(im, LEAF_D, lp, 40, 15, fy=True)
        return im

    def tab(self, active):
        if active:
            im = framed(32, 32, RND[2], [self.K, (self.w4, self.w2, self.w3), (self.w2, self.w1), self.K,
                                          (self.l3, self.l1, self.l2)],
                        vgrad({4: (44, 96, 46), 7: (28, 66, 34)}))
            t = Img(16, 16)
            stamp_rows(t, LEAF_S, self.lpal(), 2, 2, fy=True)
            UF.stamp_img4(im, t)
        else:
            im = framed(32, 32, RND[2], [self.K, (self.w3, self.w1, self.w2), (self.w2, self.w0), self.K,
                                          self.f0], self.f1)
        return im

    def button(self, k):
        o, sh, base, lt, hi = self.BTN[k]
        im = framed(16, 16, RND[1], [self.K, (self.w3, self.w1, self.w2), (hi, sh, lt), (lt, sh, base)], base)
        for x in range(3, 13):
            im.set(x, 12, sh)
        return im

    def badge(self, k):
        o, sh, base, hi = self.BADGE[k]
        prof = ([4, 2, 1, 1], [1], [1], [4, 2, 1, 1])  # forme de feuille
        im = framed(12, 12, prof, [o, (hi, sh, base)], base)
        im.set(9, 2, hi)  # nervure
        im.set(2, 9, sh)
        return im

    def slot(self):
        return framed(24, 24, RND[1], [self.K, (self.w2, self.w3, self.w2), (self.w1, self.w2), self.K,
                                        ((6, 14, 8), (22, 42, 26))], (12, 26, 16))

    def tooltip(self):
        im = framed(24, 24, RND[1], [self.K, (self.w3, self.w1, self.w2), self.K, self.f0], (12, 28, 16, 244))
        t = Img(12, 12)
        stamp_rows(t, LEAF_S, self.lpal(), 1, 1, fy=True)
        UF.stamp_img4(im, t)
        return im


# ====================================================================== FORGE

class Forge:
    K = (8, 6, 6)
    i0, i1, i2, i3, i4 = (26, 24, 26), (46, 44, 48), (70, 68, 74), (104, 102, 110), (156, 154, 162)
    c0, c1, c2, c3 = (64, 26, 8), (134, 64, 24), (194, 108, 50), (240, 166, 96)
    e1, e2, e3 = (130, 34, 6), (226, 96, 18), (255, 196, 80)
    f0, f1, f2 = (16, 12, 12), (28, 22, 20), (40, 30, 26)
    BTN = {
        'gold':   ((50, 26, 4), (150, 96, 24), (214, 156, 48), (240, 196, 92), (255, 236, 170)),
        'blue':   ((6, 14, 28), (30, 56, 92), (50, 88, 138), (88, 130, 180), (170, 204, 236)),
        'purple': ((24, 8, 34), (70, 32, 98), (104, 54, 140), (146, 96, 182), (210, 180, 236)),
        'gray':   ((10, 10, 12), (48, 46, 50), (78, 76, 82), (112, 110, 118), (170, 168, 176)),
        'red':    ((36, 6, 4), (120, 28, 14), (176, 52, 22), (222, 100, 46), (255, 184, 120)),
    }
    BADGE = {
        'green': ((6, 24, 10), (30, 86, 36), (54, 134, 56), (130, 206, 110)),
        'gray':  ((10, 10, 12), (48, 46, 50), (76, 74, 80), (136, 134, 142)),
        'gold':  ((50, 26, 4), (160, 104, 28), (222, 166, 58), (255, 226, 140)),
        'red':   ((36, 6, 4), (116, 28, 14), (170, 52, 22), (240, 130, 80)),
    }

    def bolt(self, im, x, y, n):
        """Boulon carré n x n (n>=4) à tête biseautée, éclairé haut-gauche."""
        plate(im, x, y, x + n - 1, y + n - 1, [self.K, (self.i4, self.i1, self.i3)], self.i2)
        if n >= 5:
            im.set(x + 1, y + 1, (210, 208, 214))

    def corner_plate(self, im, n, bolt_n, copper=True):
        for (x, y) in ((0, 0), (im.w - n, 0), (0, im.h - n), (im.w - n, im.h - n)):
            rings = [self.K, (self.i3, self.i0, self.i2)]
            if copper:
                rings.append((self.c2, self.c0, self.c1))
            plate(im, x, y, x + n - 1, y + n - 1, rings, self.i2)
            o = (n - bolt_n) // 2
            self.bolt(im, x + o, y + o, bolt_n)

    def panel(self):
        rings = [self.K, (self.i3, self.i1, self.i2), (self.i2, self.i1), (self.i2, self.i0), (self.i1, self.i0),
                 self.K, (self.c3, self.c1, self.c2), self.K, (self.f0, self.e1, self.f0)]
        im = framed(48, 48, SQ, rings, self.f1)
        for s in SIDES:  # jointures de plaques + rivet, période 16
            for a in range(1, 5):
                side_set(im, s, 16, a, self.K)
                side_set(im, s, 17, a, self.i3 if a < 4 else self.i2)
            for (t, a, c) in ((23, 2, self.i4), (24, 2, self.i2), (23, 3, self.i2), (24, 3, self.i0)):
                side_set(im, s, t, a, c)
        self.corner_plate(im, 12, 6)
        return im

    def panel_alt(self):
        rings = [self.K, (self.i3, self.i1, self.i2), (self.i2, self.i0), self.K, (self.c2, self.c0, self.c1), self.K]
        im = framed(32, 32, SQ, rings, self.f2)
        self.corner_plate(im, 8, 4, copper=False)
        return im

    def header(self):
        im = Img(48, 25)
        m = [[(2 <= y <= 22 and 3 <= x <= 44) or (6 <= y <= 18 and (x <= 2 or x >= 45)) for x in range(48)]
             for y in range(25)]
        grad = vgrad({6: (58, 42, 34), 18: (24, 18, 16)})
        paint(im, m, [self.K, (self.i3, self.i0, self.i2), (self.i2, self.i0), self.K,
                      (self.c3, self.c1, self.c2), self.K], grad)
        for x in range(8, 40):  # braise sous le texte
            im.set(x, 17, self.e1)
        for x in (0, 45):  # tenons latéraux
            for y in range(7, 18):
                im.set(x + 1, y, self.i2 if x == 0 else self.i1)
        for (x, y) in ((4, 5), (4, 15), (39, 5), (39, 15)):
            self.bolt(im, x, y, 5)
        return im

    def tab(self, active):
        if active:
            im = framed(32, 32, CUT(1), [self.K, (self.i4, self.i1, self.i2), (self.i2, self.i0),
                                          (self.c3, self.c1, self.c2), self.K],
                        vgrad({4: (70, 50, 40), 7: (46, 32, 26)}))
            for x in range(5, 27):
                im.set(x, 26, self.e2)
                im.set(x, 25, self.e1)
                im.set(x, 24, (80, 40, 24))
            for x in (6, 25):
                im.set(x, 26, self.e3)
        else:
            im = framed(32, 32, CUT(1), [self.K, (self.i3, self.i0, self.i2), (self.i2, self.i0), self.K],
                        self.f2)
        for (x, y) in ((2, 2), (29, 2), (2, 29), (29, 29)):
            im.set(x, y, self.i4)
        return im

    def button(self, k):
        o, sh, base, lt, hi = self.BTN[k]
        im = framed(16, 16, CUT(1), [self.K, (hi, sh, lt), (lt, sh, base)], base)
        dark = lerp(sh, o, 0.5)
        for x in range(1, 15):  # bloc épais : 3 px de flanc en bas
            im.set(x, 12, sh)
            im.set(x, 13, dark)
            im.set(x, 14, dark if 1 < x < 14 else o)
        for x in range(2, 14):
            im.set(x, 11, lerp(base, sh, .35))
        for (x, y) in ((3, 3), (12, 3)):  # rivets
            im.set(x, y, hi)
            im.set(x, y + 1, o)
        return im

    def badge(self, k):
        o, sh, base, hi = self.BADGE[k]
        im = framed(12, 12, SQ, [o, (hi, sh, base)], base)
        for (x, y) in ((1, 1), (10, 1), (1, 10), (10, 10)):
            im.set(x, y, o)
        return im

    def slot(self):
        im = framed(24, 24, SQ, [self.K, (self.i1, self.i3, self.i2), (self.i0, self.i2), self.K,
                                  (self.f0, self.f2)], (14, 10, 10))
        for (x, y) in ((1, 1), (22, 1), (1, 22), (22, 22)):
            im.set(x, y, self.i4)
        return im

    def tooltip(self):
        im = framed(24, 24, SQ, [self.K, (self.i3, self.i0, self.i2), self.K, (self.c1, self.c0)],
                    (22, 16, 14, 244))
        for (x, y) in ((1, 1), (21, 1), (1, 21), (21, 21)):
            im.rect(x, y, 2, 2, self.i2)
            im.set(x, y, self.i4)
            im.set(x + 1, y + 1, self.i1)
        return im


# ====================================================================== ARCANE

class Arcane:
    K = (8, 4, 20)
    v0, v1, v2, v3 = (16, 8, 34), (26, 14, 54), (38, 22, 76), (58, 36, 108)
    s1, s2, s3, s4 = (92, 96, 124), (142, 148, 178), (198, 204, 228), (244, 246, 255)
    c1, c2, c3 = (24, 112, 156), (64, 206, 236), (190, 252, 255)
    BTN = {
        'gold':   ((50, 30, 10), (168, 120, 44), (228, 182, 80), (246, 216, 128), (255, 248, 214)),
        'blue':   ((6, 18, 48), (24, 66, 140), (34, 104, 190), (70, 156, 230), (170, 232, 255)),
        'purple': ((22, 6, 46), (70, 26, 130), (104, 48, 186), (148, 96, 228), (216, 186, 255)),
        'gray':   ((14, 12, 26), (54, 52, 76), (82, 80, 108), (122, 120, 152), (192, 192, 220)),
        'red':    ((40, 4, 20), (118, 20, 58), (170, 36, 78), (216, 80, 118), (255, 176, 200)),
    }
    BADGE = {
        'green': ((4, 28, 24), (22, 104, 84), (36, 150, 112), (140, 240, 200)),
        'gray':  ((14, 12, 26), (54, 52, 76), (80, 78, 106), (150, 148, 182)),
        'gold':  ((50, 30, 10), (176, 128, 48), (232, 188, 88), (255, 240, 170)),
        'red':   ((40, 4, 20), (116, 20, 56), (164, 36, 76), (236, 120, 156)),
    }

    def medallion(self, im, cx, cy, r):
        """Médaillon circulaire : anneau d'argent, fond violet, rune cyan au centre."""
        pts = disc_pts(cx, cy, r)

        def c(x, y):
            d = math.hypot(x - cx, y - cy)
            lit = (x - cx) + (y - cy) < 0
            if d > r - 1.1:
                return self.s3 if lit else self.s1
            if r >= 5 and d > r - 2.1:
                return self.v0
            if r >= 5 and d > r - 3.1:
                return self.s2 if lit else self.s1
            return self.v2
        blob(im, pts, c, self.K)
        icx, icy = int(round(cx)), int(round(cy))
        if r >= 5:
            for dx, dy in ((0, -2), (0, 2), (-2, 0), (2, 0)):
                im.set(icx + dx, icy + dy, self.c1)
            im.set(icx, icy, self.c3)
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                im.set(icx + dx, icy + dy, self.c2)
        else:
            im.set(icx, icy, self.c3)
            im.set(icx + 1, icy, self.c2); im.set(icx, icy + 1, self.c2)

    def panel(self):
        rings = [self.K, (self.s3, self.s1, self.s2), self.v0, self.v2, self.v0, (self.s2, self.s1), self.K]
        im = framed(48, 48, CUT(4), rings, self.v1)
        for s in SIDES:  # runes lumineuses, période 16 (8 px)
            for t in (23, 24):
                side_set(im, s, t, 3, self.c3)
                side_set(im, s, t, 2, self.c1)
                side_set(im, s, t, 4, self.c1)
            side_set(im, s, 22, 3, self.c2); side_set(im, s, 25, 3, self.c2)
            side_set(im, s, 16, 3, self.c1); side_set(im, s, 31, 3, self.c1)
        for (cx, cy) in ((6, 6), (41, 6), (6, 41), (41, 41)):
            self.medallion(im, cx, cy, 6.4)
        return im

    def panel_alt(self):
        rings = [self.K, (self.s3, self.s1, self.s2), self.v0, (self.s1, self.v0), self.K]
        im = framed(32, 32, CUT(3), rings, self.v2)
        for (cx, cy) in ((4, 4), (27, 4), (4, 27), (27, 27)):
            self.medallion(im, cx, cy, 3.6)
        return im

    def header(self):
        im = Img(48, 25)
        m = [[5 <= y <= 19 and 6 <= x <= 41 for x in range(48)] for y in range(25)]
        grad = vgrad({7: (74, 48, 132), 12: (46, 28, 92), 17: (24, 12, 50)})
        paint(im, m, [self.K, (self.s3, self.s1, self.s2), self.K], grad)
        for x in range(12, 36):
            im.set(x, 16, self.c1)
        for x in (12, 35):
            im.set(x, 16, self.c2)
        for cx in (6, 41):
            self.medallion(im, cx, 12, 6.4)
        return im

    def tab(self, active):
        if active:
            im = framed(32, 32, CUT(3), [self.K, (self.s4, self.s2, self.s3), self.K, (self.c3, self.c1, self.c2)],
                        vgrad({4: (70, 46, 124), 7: (46, 28, 90)}))
            for (x, y) in ((4, 4), (27, 4), (4, 27), (27, 27)):
                im.set(x, y, self.c3)
        else:
            im = framed(32, 32, CUT(3), [self.K, (self.s2, self.s1), self.K, self.v0], self.v1)
            for (x, y) in ((4, 4), (27, 4), (4, 27), (27, 27)):
                im.set(x, y, self.c1)
        return im

    def button(self, k):
        o, sh, base, lt, hi = self.BTN[k]
        im = framed(16, 16, CUT(3), [self.K, (self.s3, self.s1, self.s2), (hi, sh, lt)], base)
        for x in range(4, 12):
            im.set(x, 3, lt)
            im.set(x, 12, sh)
        for (x, y) in ((3, 3), (12, 3), (3, 12), (12, 12)):
            im.set(x, y, lt if y == 3 else sh)
        return im

    def badge(self, k):
        o, sh, base, hi = self.BADGE[k]
        return framed(12, 12, CUT(3), [o, (hi, sh, base)], base)

    def slot(self):
        im = framed(24, 24, CUT(3), [self.K, (self.s2, self.s1), self.K, ((10, 4, 24), self.v2)], (14, 8, 30))
        for (x, y) in ((4, 4), (19, 4), (4, 19), (19, 19)):
            im.set(x, y, self.c1)
        return im

    def tooltip(self):
        im = framed(24, 24, CUT(2), [self.K, (self.s3, self.s1, self.s2), self.v0], (16, 10, 36, 244))
        t = Img(8, 8)
        diamond(t, 2, 2, 1, None, self.c3, self.c2)
        UF.stamp_img4(im, t)
        return im


# ====================================================================== NECRO

SKULL = [
    "..KKKKKKK..",
    ".K4444433K.",
    "K444443332K",
    "K4KKK3KKK2K",
    "K4KgK3KgK2K",
    "K3KKK3KKK1K",
    "K3332K2221K",
    ".K33KKK21K.",
    ".K2K2K2K1K.",
    ".KK2K2K1KK.",
    "..KKKKKKK..",
]

SKULL_S = [
    "..KKKKK..",
    ".K44433K.",
    "K4444332K",
    "K4KK3KK2K",
    "K3gK3Kg1K",
    "K333K221K",
    ".K3KKK1K.",
    ".KK2K1KK.",
    "..KKKKK..",
]


class Necro:
    K = (6, 6, 8)
    b0, b1, b2, b3, b4 = (72, 64, 50), (126, 114, 90), (176, 164, 136), (216, 206, 178), (246, 240, 220)
    d0, d1, d2 = (8, 8, 10), (16, 16, 20), (26, 26, 32)
    x1, x2, x3 = (28, 84, 30), (84, 192, 62), (186, 255, 140)
    BTN = {
        'gold':   ((48, 40, 24), (150, 138, 104), (200, 190, 156), (226, 218, 190), (250, 246, 228)),
        'blue':   ((4, 26, 26), (20, 80, 78), (30, 118, 112), (64, 164, 150), (160, 236, 214)),
        'purple': ((22, 6, 32), (64, 28, 92), (96, 48, 132), (138, 90, 176), (204, 172, 230)),
        'gray':   ((10, 10, 12), (44, 44, 50), (70, 70, 78), (102, 102, 112), (160, 160, 170)),
        'red':    ((30, 2, 4), (96, 10, 16), (142, 22, 28), (188, 54, 56), (240, 140, 130)),
    }
    BADGE = {
        'green': ((6, 22, 6), (36, 104, 30), (60, 150, 44), (160, 240, 120)),
        'gray':  ((10, 10, 12), (44, 44, 50), (68, 68, 76), (126, 126, 136)),
        'gold':  ((48, 40, 24), (156, 144, 110), (206, 196, 162), (248, 242, 220)),
        'red':   ((30, 2, 4), (94, 10, 16), (138, 22, 28), (220, 100, 96)),
    }

    def pal(self):
        return {'K': self.K, '1': self.b1, '2': self.b2, '3': self.b3, '4': self.b4, 'g': self.x3}

    def knob(self, im, cx, cy, r):
        ball(im, cx, cy, r, (self.b1, self.b2, self.b3, self.b4), self.K)

    def bone_rings(self):
        # os cylindrique : clair au-dessus (barre haute) comme en dessous (barre basse inversée)
        return [self.K, (self.b3, self.b1), (self.b4, self.b2), (self.b2, self.b4), (self.b1, self.b3), self.K]

    def panel(self):
        rings = self.bone_rings() + [(self.x1, (16, 40, 18)), self.d0]
        im = framed(48, 48, SQ, rings, self.d1)
        for s in SIDES:  # segments d'os de 16 px : fût affiné, articulations renflées
            for t in range(19, 29):
                side_set(im, s, t, 0, None)
                side_set(im, s, t, 1, self.K)
            for t in (18, 29):
                side_set(im, s, t, 0, self.K if t == 29 else self.K)
            for a in range(1, 5):
                side_set(im, s, 16, a, self.K)
            for t in (17, 31):
                side_set(im, s, t, 1, self.b4 if s in ('top', 'left') else self.b2)
        for s in SIDES:  # coins : fût prolongé jusqu'aux crânes
            for t in list(range(10, 13)):
                side_set(im, s, t, 0, None)
                side_set(im, s, t, 1, self.K)
                side_set(im, s, im.w - 1 - t, 0, None)
                side_set(im, s, im.w - 1 - t, 1, self.K)
        for (x, y) in ((0, 0), (37, 0), (0, 37), (37, 37)):
            stamp_rows(im, SKULL, self.pal(), x, y)
        return im

    def panel_alt(self):
        rings = [self.K, (self.b3, self.b1), (self.b2, self.b3), self.K, self.x1, self.d0]
        im = framed(32, 32, SQ, rings, self.d2)
        for (x, y) in ((0, 0), (23, 0), (0, 23), (23, 23)):
            stamp_rows(im, SKULL_S, self.pal(), x, y)
        return im

    def header(self):
        im = Img(48, 25)
        m = [[4 <= y <= 20 and 6 <= x <= 41 for x in range(48)] for y in range(25)]
        paint(im, m, [self.K, (self.b3, self.b1), (self.b4, self.b2), (self.b2, self.b3), self.K,
                      (self.x2, self.x1), self.d0], vgrad({10: self.d2, 16: self.d1}))
        for cx in (4.5, 42.5):  # têtes d'os doubles (fémur)
            self.knob(im, cx, 7.5, 4.3)
            self.knob(im, cx, 16.5, 4.3)
            for y in (11, 12, 13):
                for x in range(int(cx) - 2, int(cx) + 3):
                    im.set(x, y, self.b2 if x < cx + 1 else self.b1)
                im.set(int(cx) - 3, y, self.K)
                im.set(int(cx) + 3 if cx > 20 else int(cx) + 3, y, self.K)
        return im

    def tab(self, active):
        if active:
            im = framed(32, 32, SQ, [self.K, (self.b4, self.b2), (self.b2, self.b3), self.K, (self.x3, self.x1, self.x2),
                                      (self.x1, (20, 50, 22))], vgrad({4: (34, 54, 36), 7: (20, 32, 22)}))
        else:
            im = framed(32, 32, SQ, [self.K, (self.b3, self.b1), (self.b1, self.b2), self.K, self.d0], self.d2)
        t = Img(16, 16)
        ball(t, 2, 2, 2.3, (self.b1, self.b2, self.b3, self.b4), self.K)
        for (x, y) in ((0, 0), (27, 0), (0, 27), (27, 27)):
            for j in range(5):
                for i in range(5):
                    p = t.px[j][i]
                    if p[3]:
                        im.px[y + j][x + i] = p
        return im

    def button(self, k):
        o, sh, base, lt, hi = self.BTN[k]
        prof = ([4, 2, 1, 1], [4, 2, 1, 1], [], [])  # pierre tombale
        im = framed(16, 16, prof, [o, (hi, sh, lt)], base)
        for x in range(4, 12):
            im.set(x, 2, lt)
        for x in range(1, 15):
            im.set(x, 13, sh)
        for x in range(2, 14):
            im.set(x, 14, lerp(sh, o, .5))
        return im

    def badge(self, k):
        o, sh, base, hi = self.BADGE[k]
        return framed(12, 12, ([3, 1, 1], [3, 1, 1], [], []), [o, (hi, sh, base)], base)

    def slot(self):
        im = framed(24, 24, SQ, [self.K, (self.b2, self.b1), self.K, (self.d0, self.d2)], (10, 10, 12))
        for (x, y) in ((1, 1), (20, 1), (1, 20), (20, 20)):
            ball(im, x + 1, y + 1, 1.6, (self.b1, self.b2, self.b3, self.b4), self.K)
        return im

    def tooltip(self):
        im = framed(24, 24, SQ, [self.K, (self.b3, self.b1), self.K, (16, 34, 18)], (10, 10, 12, 244))
        for (x, y) in ((2, 2), (21, 2), (2, 21), (21, 21)):
            ball(im, x, y, 1.6, (self.b1, self.b2, self.b3, self.b4), self.K)
        return im


# ====================================================================== DESERT

class Desert:
    K = (24, 12, 6)
    a0, a1, a2, a3, a4 = (92, 58, 30), (140, 96, 50), (182, 136, 78), (214, 174, 112), (242, 214, 160)
    t1, t2, t3 = (14, 92, 94), (40, 168, 158), (140, 234, 214)
    f0, f1, f2 = (34, 16, 12), (54, 26, 20), (70, 36, 26)
    g1, g2, g3 = (170, 110, 30), (238, 186, 58), (255, 240, 160)
    BTN = {
        'gold':   ((60, 34, 6), (184, 128, 34), (234, 182, 60), (250, 214, 110), (255, 244, 196)),
        'blue':   ((4, 32, 34), (14, 84, 86), (22, 118, 116), (52, 164, 154), (150, 232, 212)),
        'purple': ((24, 8, 38), (66, 30, 100), (98, 50, 140), (140, 90, 180), (206, 176, 230)),
        'gray':   ((26, 20, 14), (74, 64, 52), (104, 94, 80), (142, 130, 112), (204, 192, 170)),
        'red':    ((44, 10, 4), (128, 40, 20), (172, 62, 32), (212, 104, 64), (255, 184, 140)),
    }
    BADGE = {
        'green': ((6, 30, 22), (24, 104, 74), (40, 150, 104), (140, 228, 180)),
        'gray':  ((26, 20, 14), (72, 64, 52), (100, 90, 78), (156, 146, 128)),
        'gold':  ((60, 34, 6), (190, 134, 40), (238, 190, 72), (255, 236, 160)),
        'red':   ((44, 10, 4), (124, 40, 20), (166, 62, 32), (234, 136, 96)),
    }
    STEP3 = [3, 3, 3, 1]
    STEP2 = [2, 2]

    def sun(self, im, cx, cy):
        for (dx, dy) in ((-3, 0), (3, 0), (0, -3), (0, 3), (-2, -2), (2, -2), (-2, 2), (2, 2)):
            im.set(cx + dx, cy + dy, self.g1 if dx + dy > 0 else self.g2)
        ball(im, cx, cy, 1.6, (self.g1, self.g2, self.g2, self.g3), self.K)

    def panel(self):
        rings = [self.K, (self.a4, self.a2, self.a3), (self.a3, self.a2), self.a0, (self.a3, self.a1),
                 (self.a2, self.a1), self.K, (self.t3, self.t1, self.t2), self.K, (self.f0, self.f2)]
        im = framed(48, 48, self.STEP3, rings, self.f1)
        for s in SIDES:  # appareil de blocs décalés, période 16
            for t in (16, 24):
                for a in (1, 2):
                    side_set(im, s, t, a, self.a0)
                    side_set(im, s, t + 1, a, self.a4 if a == 1 else self.a3)
            for t in (20, 28):
                for a in (4, 5):
                    side_set(im, s, t, a, self.a0)
                    side_set(im, s, t + 1, a, self.a3)
        for s in SIDES:  # joints dans les coins
            for t in (12, 35):
                for a in (1, 2):
                    side_set(im, s, t, a, self.a0)
        for (x, y) in ((5, 5), (42, 5), (5, 42), (42, 42)):
            plate(im, x - 4, y - 4, x + 4, y + 4, [self.K, (self.a4, self.a1, self.a3)], self.a2, CUT(2))
            self.sun(im, x, y)
        return im

    def panel_alt(self):
        rings = [self.K, (self.a3, self.a1, self.a2), (self.a2, self.a1), self.K, (self.t3, self.t1, self.t2), self.K]
        im = framed(32, 32, self.STEP2, rings, self.f1)
        for s in SIDES:
            for t in (7, 24):
                side_set(im, s, t, 1, self.a0)
                side_set(im, s, t, 2, self.a0)
        for (x, y) in ((4, 4), (27, 4), (4, 27), (27, 27)):
            diamond(im, x, y, 2, self.K, self.t3, self.t1, core=self.t2)
        return im

    def header(self):
        im = Img(48, 25)
        m = [[False] * 48 for _ in range(25)]
        for y in range(3, 22):
            d = abs(y - 12)
            x0 = 2 * ((d + 1) // 2)
            for x in range(x0, 48 - x0):
                m[y][x] = True
        paint(im, m, [self.K, (self.a4, self.a2, self.a3), (self.a3, self.a1), self.K,
                      (self.t3, self.t1, self.t2), self.K], vgrad({8: (84, 44, 30), 16: (52, 24, 18)}))
        for cx in (8, 39):
            diamond(im, cx, 12, 2, self.K, self.g3, self.g1, core=self.g2)
        return im

    def tab(self, active):
        if active:
            im = framed(32, 32, self.STEP2, [self.K, (self.a4, self.a2, self.a3), (self.a3, self.a1), self.K,
                                              (self.t3, self.t1, self.t2)], vgrad({4: (96, 50, 34), 7: (70, 36, 26)}))
            for (x, y) in ((5, 5), (26, 5), (5, 26), (26, 26)):
                im.set(x, y, self.g3)
        else:
            im = framed(32, 32, self.STEP2, [self.K, (self.a3, self.a1, self.a2), (self.a1, self.a0), self.K,
                                              self.f0], self.f1)
        return im

    def button(self, k):
        o, sh, base, lt, hi = self.BTN[k]
        im = framed(16, 16, self.STEP2, [self.K, (self.a3, self.a1, self.a2), (hi, sh, lt)], base)
        for x in range(3, 13):
            im.set(x, 3, lt)
            im.set(x, 12, sh)
        return im

    def badge(self, k):
        o, sh, base, hi = self.BADGE[k]
        return framed(12, 12, self.STEP2, [o, (hi, sh, base)], base)

    def slot(self):
        return framed(24, 24, self.STEP2, [self.K, (self.a2, self.a3, self.a2), (self.a1, self.a2), self.K,
                                            (self.f0, self.f2)], (28, 14, 10))

    def tooltip(self):
        im = framed(24, 24, self.STEP2, [self.K, (self.a3, self.a1, self.a2), self.K, (self.t2, self.t1)],
                    (30, 16, 12, 244))
        for (x, y) in ((4, 4), (19, 4), (4, 19), (19, 19)):
            diamond(im, x, y, 1, None, self.t3, self.t2)
        return im


# ====================================================================== FROST

class Frost:
    K = (8, 22, 36)
    i0, i1, i2, i3, i4 = (40, 82, 112), (80, 142, 178), (132, 192, 222), (192, 234, 248), (250, 255, 255)
    f0, f1, f2 = (14, 28, 38), (22, 42, 54), (30, 56, 70)
    BTN = {
        'gold':   ((60, 44, 10), (186, 150, 62), (232, 202, 110), (246, 228, 160), (255, 252, 230)),
        'blue':   ((6, 24, 46), (24, 74, 124), (36, 108, 166), (76, 156, 206), (190, 236, 255)),
        'purple': ((22, 12, 46), (68, 44, 124), (100, 70, 168), (142, 114, 210), (214, 200, 250)),
        'gray':   ((14, 22, 30), (56, 70, 84), (84, 100, 114), (122, 140, 156), (196, 214, 226)),
        'red':    ((40, 6, 20), (116, 24, 50), (160, 40, 66), (204, 84, 104), (255, 186, 200)),
    }
    BADGE = {
        'green': ((4, 30, 26), (22, 108, 92), (40, 154, 126), (150, 240, 214)),
        'gray':  ((14, 22, 30), (56, 70, 84), (82, 98, 112), (150, 168, 182)),
        'gold':  ((60, 44, 10), (190, 156, 68), (236, 208, 120), (255, 244, 200)),
        'red':   ((40, 6, 20), (112, 24, 48), (154, 40, 64), (232, 128, 148)),
    }

    def flake(self, im, cx, cy, r):
        pts = set()
        for k in range(0, r + 1):
            for (dx, dy) in ((k, 0), (-k, 0), (0, k), (0, -k)):
                pts.add((cx + dx, cy + dy))
            if k <= r - 1:
                for (dx, dy) in ((k, k), (-k, k), (k, -k), (-k, -k)):
                    pts.add((cx + dx, cy + dy))
        if r >= 4:
            b = r - 1
            for (dx, dy) in ((b, 1), (b, -1), (-b, 1), (-b, -1), (1, b), (-1, b), (1, -b), (-1, -b)):
                pts.add((cx + dx, cy + dy))

        def c(x, y):
            if (x, y) == (cx, cy):
                return self.i4
            return self.i4 if (x - cx) + (y - cy) <= 0 else self.i2
        blob(im, pts, c, self.K)

    def panel(self):
        rings = [self.K, (self.i4, self.i1, self.i3), (self.i3, self.i1), (self.i2, self.i0), (self.i1, self.i0),
                 self.K, ((70, 130, 160), (40, 80, 104)), self.f0]
        im = framed(48, 48, CUT(5), rings, self.f1)
        for s in SIDES:  # facettes de cristal en diagonale, période 16
            hi = self.i4 if s in ('top', 'left') else self.i3
            for k in range(4):
                side_set(im, s, 18 + k, 4 - k, hi)
                side_set(im, s, 19 + k, 4 - k, self.i0)
            for k in range(2):
                side_set(im, s, 27 + k, 2 - k, hi)
        for (cx, cy) in ((5, 5), (42, 5), (5, 42), (42, 42)):
            self.flake(im, cx, cy, 5)
        return im

    def panel_alt(self):
        rings = [self.K, (self.i4, self.i1, self.i3), (self.i2, self.i0), self.K, self.f0]
        im = framed(32, 32, CUT(4), rings, self.f2)
        t = Img(10, 10)  # éclat de glace en diagonale
        for k in range(5):
            t.set(k + 1, k + 1, self.i4)
            t.set(k + 2, k + 1, self.i2)
            t.set(k + 1, k + 2, self.i1)
        for k in range(1, 6):
            t.set(k + 2, k, self.K)
            t.set(k, k + 2, self.K)
        t.set(0, 0, self.K); t.set(1, 0, self.K); t.set(0, 1, self.K)
        UF.stamp_img4(im, t)
        return im

    def header(self):
        im = Img(48, 25)
        m = [[False] * 48 for _ in range(25)]
        for y in range(1, 24):
            d = abs(y - 12)
            x0 = d + (2 if d % 4 in (2, 3) else 0)  # bout en éclats de glace
            for x in range(x0, 48 - x0):
                m[y][x] = True
        paint(im, m, [self.K, (self.i4, self.i1, self.i3), (self.i2, self.i0), self.K],
              vgrad({5: (48, 96, 122), 12: (30, 64, 84), 19: (16, 34, 46)}))
        for x in range(12, 36):
            im.set(x, 5, (90, 150, 180))
        return im

    def tab(self, active):
        if active:
            im = framed(32, 32, CUT(3), [self.K, (self.i4, self.i2, self.i3), (self.i3, self.i1), self.K,
                                          ((120, 210, 236), (60, 140, 176))],
                        vgrad({4: (44, 86, 106), 7: (30, 58, 74)}))
            for (x, y) in ((5, 5), (26, 5), (5, 26), (26, 26)):
                im.set(x, y, self.i4)
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    im.set(x + dx, y + dy, self.i2)
        else:
            im = framed(32, 32, CUT(3), [self.K, (self.i3, self.i0, self.i1), (self.i1, self.i0), self.K], self.f1)
        return im

    def button(self, k):
        o, sh, base, lt, hi = self.BTN[k]
        im = framed(16, 16, CUT(3), [o, (hi, sh, lt), (lt, sh, base)], base)
        for (x, y) in ((3, 2), (2, 3), (4, 2), (2, 4), (3, 3)):  # facette éclairée
            im.set(x, y, hi)
        for (x, y) in ((12, 13), (13, 12), (11, 13), (13, 11), (12, 12)):
            im.set(x, y, sh)
        return im

    def badge(self, k):
        o, sh, base, hi = self.BADGE[k]
        im = framed(12, 12, CUT(3), [o, (hi, sh, base)], base)
        im.set(2, 2, hi)
        return im

    def slot(self):
        return framed(24, 24, CUT(3), [self.K, (self.i1, self.i3, self.i2), self.K, (self.f0, self.f2)], (12, 24, 32))

    def tooltip(self):
        im = framed(24, 24, CUT(2), [self.K, (self.i3, self.i1, self.i2), self.K], (14, 28, 38, 244))
        for (x, y) in ((3, 3), (20, 3), (3, 20), (20, 20)):
            im.set(x, y, self.i4)
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                im.set(x + dx, y + dy, self.i2)
        return im


# ====================================================================== SAKURA

class Sakura:
    K = (8, 4, 6)
    l0, l1, l2, l3 = (22, 14, 18), (38, 24, 30), (66, 44, 52), (110, 78, 86)
    g1, g2, g3 = (150, 104, 40), (214, 166, 70), (250, 216, 124)
    p0, p1, p2, p3 = (124, 40, 72), (204, 92, 134), (242, 152, 184), (255, 214, 228)
    y = (250, 220, 96)
    f0, f1, f2 = (28, 10, 24), (44, 18, 40), (60, 26, 54)
    BTN = {
        'gold':   ((60, 36, 6), (184, 132, 40), (232, 186, 74), (250, 220, 128), (255, 248, 214)),
        'blue':   ((8, 12, 40), (30, 42, 110), (46, 66, 150), (86, 108, 192), (180, 196, 246)),
        'purple': ((28, 10, 44), (82, 44, 124), (118, 72, 168), (160, 116, 210), (226, 200, 250)),
        'gray':   ((16, 14, 16), (60, 54, 60), (88, 82, 90), (124, 118, 128), (196, 190, 200)),
        'red':    ((44, 6, 4), (130, 22, 14), (186, 40, 24), (226, 86, 56), (255, 184, 160)),
    }
    BADGE = {
        'green': ((8, 30, 14), (38, 104, 50), (62, 150, 74), (160, 230, 160)),
        'gray':  ((16, 14, 16), (60, 54, 60), (86, 80, 88), (150, 144, 154)),
        'gold':  ((60, 36, 6), (190, 138, 46), (236, 192, 84), (255, 238, 170)),
        'red':   ((44, 6, 4), (126, 22, 14), (180, 40, 24), (240, 128, 104)),
    }

    def blossom(self, im, cx, cy, big=True):
        if big:
            pts = set()
            for k in range(5):
                a = -math.pi / 2 + k * 2 * math.pi / 5
                px, py = cx + 2.3 * math.cos(a), cy + 2.3 * math.sin(a)
                pts |= set(disc_pts(px, py, 1.45))
            pts.add((cx, cy))

            def c(x, y):
                if (x, y) == (cx, cy):
                    return self.y
                d = (x - cx) + (y - cy)
                return self.p3 if d < -2 else self.p2 if d < 1 else self.p1
            blob(im, pts, c, self.K)
            for (dx, dy) in ((1, 0), (0, 1), (-1, 0), (0, -1)):
                im.set(cx + dx, cy + dy, self.p0)
            im.set(cx, cy, self.y)
        else:
            pts = [(cx, cy), (cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1)]
            blob(im, pts, lambda x, y: self.y if (x, y) == (cx, cy) else self.p2, self.K)

    def corner_branch(self, im, n, big):
        t = Img(n, n)
        br = (52, 30, 26)
        if big:
            for k in range(3, 12):
                t.set(k, 2, br)
            t.set(12, 1, br); t.set(13, 1, br)
            self.blossom(t, 4, 4, True)
            self.blossom(t, 11, 3, False)
        else:
            self.blossom(t, 3, 3, False)
        UF.stamp_img4(im, t)

    def panel(self):
        rings = [self.K, (self.l3, self.l1, self.l2), (self.l1, self.l0), (self.l1, self.l0), self.l0,
                 (self.g3, self.g1, self.g2), self.K, self.f0]
        im = framed(48, 48, SQ, rings, self.f1)
        for s in SIDES:  # pétale qui tombe + point d'or, période 16
            side_set(im, s, 21, 2, self.p2)
            side_set(im, s, 22, 2, self.p3)
            side_set(im, s, 22, 3, self.p1)
            side_set(im, s, 29, 3, self.g1)
        self.corner_branch(im, 16, True)
        return im

    def panel_alt(self):
        rings = [self.K, (self.l2, self.l0, self.l1), self.l0, (self.g3, self.g1, self.g2), self.K]
        im = framed(32, 32, SQ, rings, self.f1)
        self.corner_branch(im, 8, False)
        return im

    def header(self):
        im = Img(48, 25)
        m = [[False] * 48 for _ in range(25)]
        for y in range(25):
            for x in range(48):
                e = min(x, 47 - x)  # linteau aux bouts relevés (torii)
                body = 4 <= y <= 20 and e >= 4
                beam = 2 <= y <= 7 and e >= 2
                tip = (e == 0 and 0 <= y <= 3) or (e == 1 and 1 <= y <= 5)
                if body or beam or tip:
                    m[y][x] = True
        paint(im, m, [self.K, (self.l3, self.l1, self.l2), self.l0, (self.g3, self.g1, self.g2), self.K],
              vgrad({8: (74, 32, 64), 16: (40, 14, 36)}))
        for x in range(3, 45):  # sous-face du linteau
            im.set(x, 8, self.K)
        for x in range(4, 44):
            im.set(x, 9, self.l1)
        self.blossom(im, 6, 17, True)
        self.blossom(im, 41, 17, True)
        return im

    def tab(self, active):
        if active:
            im = framed(32, 32, SQ, [self.K, (self.l3, self.l1, self.l2), self.l0, (self.g3, self.g2, self.g3),
                                      self.K], vgrad({4: (90, 40, 78), 7: self.f2}))
            for x in range(5, 27):
                im.set(x, 26, self.p1)
            t = Img(16, 16)
            self.blossom(t, 3, 3, True)
            UF.stamp_img4(im, t)
        else:
            im = framed(32, 32, SQ, [self.K, (self.l2, self.l0, self.l1), self.l0, (self.g2, self.g1), self.K],
                        self.f1)
        return im

    def button(self, k):
        o, sh, base, lt, hi = self.BTN[k]
        rim = (self.g1, (90, 60, 20), self.g1) if k == 'gold' else (self.g3, self.g1, self.g2)
        im = framed(16, 16, RND[1], [self.K, rim, (lt, sh, base)], base)
        for (x, y) in ((2, 3), (3, 3), (4, 3), (3, 4)):  # reflet de laque
            im.set(x, y, hi)
        return im

    def badge(self, k):
        o, sh, base, hi = self.BADGE[k]
        return framed(12, 12, RND[3], [o, (hi, sh, base)], base)  # sceau rond (hanko)

    def slot(self):
        return framed(24, 24, SQ, [self.K, (self.l2, self.l0, self.l1), (self.g2, self.g1), self.K], (18, 8, 16))

    def tooltip(self):
        im = framed(24, 24, SQ, [self.K, self.l1, (self.g3, self.g1, self.g2), self.K], (26, 10, 24, 244))
        t = Img(8, 8)
        self.blossom(t, 2, 2, False)
        UF.stamp_img4(im, t)
        return im


# ====================================================================== SHADOW

class Shadow:
    K = (0, 0, 0)
    c0, c1, c2 = (10, 10, 12), (18, 18, 22), (36, 36, 42)
    s0, s1, s2 = (70, 72, 82), (120, 124, 136), (176, 180, 192)
    FILL = (13, 13, 16)
    BTN = {
        'gold':   (None, (176, 140, 60), (214, 176, 84), (240, 212, 130), None),
        'blue':   (None, (24, 44, 84), (40, 66, 118), (96, 128, 184), None),
        'purple': (None, (44, 26, 70), (70, 44, 108), (134, 108, 176), None),
        'gray':   (None, (34, 34, 40), (52, 52, 60), (104, 106, 118), None),
        'red':    (None, (70, 16, 20), (112, 30, 34), (180, 92, 94), None),
    }
    BADGE = {
        'green': (None, None, (40, 112, 64), (110, 180, 130)),
        'gray':  (None, None, (52, 52, 60), (104, 106, 118)),
        'gold':  (None, None, (214, 176, 84), (246, 222, 150)),
        'red':   (None, None, (116, 30, 34), (184, 96, 98)),
    }

    def panel(self):
        return framed(48, 48, SQ, [self.K, (self.s1, self.s0), self.K, self.c2, self.c0], self.FILL)

    def panel_alt(self):
        return framed(32, 32, SQ, [self.K, (self.s0, (44, 46, 52)), self.K], (17, 17, 21))

    def header(self):
        im = Img(48, 25)
        m = [[4 <= y <= 20 and (x - (20 - y) // 2 >= 0) and (47 - x - (y - 4) // 2 >= 0) for x in range(48)]
             for y in range(25)]
        paint(im, m, [self.K, (self.s1, self.s0), self.K], vgrad({6: (30, 30, 36), 18: (14, 14, 18)}))
        return im

    def tab(self, active):
        if active:
            im = framed(32, 32, SQ, [self.K, (self.s2, self.s1), self.K], (30, 30, 36))
            for x in range(3, 29):
                im.set(x, 28, self.s2)
        else:
            im = framed(32, 32, SQ, [self.K, ((58, 60, 68), (40, 40, 46)), self.K], self.c1)
        return im

    def button(self, k):
        _, sh, base, lt, _ = self.BTN[k]
        return framed(16, 16, SQ, [self.K, lt], base)

    def badge(self, k):
        _, _, base, hi = self.BADGE[k]
        return framed(12, 12, SQ, [self.K, hi], base)

    def slot(self):
        return framed(24, 24, SQ, [self.s0, self.K], (8, 8, 10))

    def tooltip(self):
        return framed(24, 24, SQ, [self.K, self.s0, self.K], (10, 10, 12, 248))


# ====================================================================== build

CLASSES = {'royal': Royal, 'sylvan': Sylvan, 'forge': Forge, 'arcane': Arcane, 'necro': Necro,
           'desert': Desert, 'frost': Frost, 'sakura': Sakura, 'shadow': Shadow}


def make_frames(theme):
    T = CLASSES[theme]()
    out = {
        'panel': T.panel(), 'panel_alt': T.panel_alt(), 'header': T.header(),
        'tab': T.tab(False), 'tab_active': T.tab(True), 'slot': T.slot(), 'tooltip': T.tooltip(),
    }
    for k in ('gold', 'blue', 'purple', 'gray', 'red'):
        out['btn_' + k] = T.button(k)
    for k in ('green', 'gray', 'gold', 'red'):
        out['badge_' + k] = T.badge(k)
    return out


def knight_meta():
    with open(os.path.join(ROOT, 'assets', 'ui', 'frames', 'frames.json')) as f:
        return json.load(f)


def build(out_root):
    meta = knight_meta()
    for theme in THEMES:
        d = os.path.join(out_root, theme)
        os.makedirs(d, exist_ok=True)
        frames = make_frames(theme)
        for name in NAMES:
            im = frames[name]
            assert (im.w, im.h) == (meta[name]['w'], meta[name]['h']), (theme, name)
            im.save(os.path.join(d, name + '.png'))
    return len(THEMES) * len(NAMES)


def check(out_root):
    """Chaque PNG de thème a exactement les dimensions de son homologue Chevalier."""
    from PIL import Image
    meta = knight_meta()
    n = 0
    for theme in THEMES:
        for name in NAMES:
            kp = os.path.join(ROOT, 'assets', 'ui', 'frames', meta[name]['file'])
            tp = os.path.join(out_root, theme, name + '.png')
            assert os.path.exists(tp), tp
            ks, ts = Image.open(kp).size, Image.open(tp).size
            assert ks == ts == (meta[name]['w'], meta[name]['h']), (tp, ts, ks)
            bad = stretch_issues(Image.open(tp).convert('RGBA'), meta[name])
            assert not bad, (tp, bad[:4])
            n += 1
    return n


def stretch_issues(im, m):
    """Bords étirés uniformes sur leur longueur, centre uni (sauf `round` : centre seulement)."""
    px = im.load()
    w, h = im.size
    t, r, b, l = m['slice']
    bad = []
    if m['repeat'] == 'stretch':
        for y in list(range(t)) + list(range(h - b, h)):
            if len({px[x, y] for x in range(l, w - r)}) > 1:
                bad.append(('ligne', y))
        for x in list(range(l)) + list(range(w - r, w)):
            if len({px[x, y] for y in range(t, h - b)}) > 1:
                bad.append(('colonne', x))
    if len({px[x, y] for x in range(l, w - r) for y in range(t, h - b)}) > 1:
        bad.append(('centre',))
    return bad


# ====================================================================== aperçu

def nine_slice(src, sl, rep, W, H):
    """Rendu 9-slice façon CSS border-image (largeur de bord = slice, en px source)."""
    from PIL import Image
    t, r, b, l = sl
    w, h = src.size
    out = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    xs = [(0, l, 0, l), (l, w - r, l, W - r), (w - r, w, W - r, W)]
    ys = [(0, t, 0, t), (t, h - b, t, H - b), (h - b, h, H - b, H)]
    for (sy0, sy1, dy0, dy1) in ys:
        for (sx0, sx1, dx0, dx1) in xs:
            tw, th = dx1 - dx0, dy1 - dy0
            if tw <= 0 or th <= 0 or sx1 <= sx0 or sy1 <= sy0:
                continue
            piece = src.crop((sx0, sy0, sx1, sy1))
            pw, ph = sx1 - sx0, sy1 - sy0
            if rep == 'round':
                nx = max(1, round(tw / pw)) if (sx0, sx1) == (l, w - r) else 1
                ny = max(1, round(th / ph)) if (sy0, sy1) == (t, h - b) else 1
                cw, ch = tw / nx, th / ny
                for j in range(ny):
                    for i in range(nx):
                        x0, y0 = dx0 + int(round(i * cw)), dy0 + int(round(j * ch))
                        x1, y1 = dx0 + int(round((i + 1) * cw)), dy0 + int(round((j + 1) * ch))
                        out.paste(piece.resize((x1 - x0, y1 - y0), Image.NEAREST), (x0, y0))
            else:
                out.paste(piece.resize((tw, th), Image.NEAREST), (dx0, dy0))
    return out


SIZES = {
    'panel': [(48, 48), (130, 86)], 'panel_alt': [(32, 32), (96, 52)], 'header': [(48, 25), (130, 34)],
    'tab': [(32, 32), (60, 22)], 'tab_active': [(32, 32), (60, 22)], 'slot': [(24, 24), (36, 36)],
    'tooltip': [(24, 24), (90, 40)],
}


def preview(out_root, dest, scale=3):
    from PIL import Image, ImageDraw
    os.makedirs(dest, exist_ok=True)
    meta = knight_meta()

    def sheet(folder):
        ims = []
        for name in NAMES:
            src = Image.open(os.path.join(folder, name + '.png')).convert('RGBA')
            m = meta[name]
            sizes = SIZES.get(name, [(m['w'], m['h']), (56, 18) if name.startswith('btn') else (30, 12)])
            for (W, H) in sizes:
                ims.append((name, nine_slice(src, m['slice'], m['repeat'], W, H)))
        # mise en page sur 2 colonnes logiques
        pad = 6
        rows, row, x, rw = [], [], 0, 400
        for name, im in ims:
            if x + im.width > rw and row:
                rows.append(row)
                row, x = [], 0
            row.append(im)
            x += im.width + pad
        rows.append(row)
        H = sum(max(i.height for i in r) + pad for r in rows) + pad
        canvas = Image.new('RGBA', (rw + pad * 2, H), (40, 44, 52, 255))
        y = pad
        for r in rows:
            x = pad
            for im in r:
                canvas.alpha_composite(im, (x, y))
                x += im.width + pad
            y += max(i.height for i in r) + pad
        return canvas

    knight = sheet(os.path.join(ROOT, 'assets', 'ui', 'frames'))
    for theme in THEMES:
        s = sheet(os.path.join(out_root, theme))
        both = Image.new('RGBA', (knight.width + s.width + 4, max(knight.height, s.height)), (0, 0, 0, 255))
        both.alpha_composite(knight, (0, 0))
        both.alpha_composite(s, (knight.width + 4, 0))
        s.resize((s.width * scale, s.height * scale), Image.NEAREST).save(os.path.join(dest, theme + '.png'))
        both.resize((both.width * 2, both.height * 2), Image.NEAREST).save(os.path.join(dest, theme + '_vs_knight.png'))
    # planche de toutes les sources brutes
    cols = []
    for theme in ['knight'] + THEMES:
        folder = os.path.join(ROOT, 'assets', 'ui', 'frames') if theme == 'knight' else os.path.join(out_root, theme)
        cols.append([Image.open(os.path.join(folder, n + '.png')).convert('RGBA') for n in NAMES])
    cw = 48 + 4
    H = sum(meta[n]['h'] + 4 for n in NAMES)
    raw = Image.new('RGBA', (cw * len(cols), H), (40, 44, 52, 255))
    for i, col_ in enumerate(cols):
        y = 0
        for im in col_:
            raw.alpha_composite(im, (i * cw, y))
            y += im.height + 4
    raw.resize((raw.width * 3, raw.height * 3), Image.NEAREST).save(os.path.join(dest, 'all_sources.png'))


if __name__ == '__main__':
    out = os.path.join(ROOT, 'assets', 'ui', 'themes')
    args = sys.argv[1:]
    if '--check' not in args:
        n = build(out)
        print('%d cadres -> %s' % (n, out))
    print('vérif dimensions + 9-slice OK : %d PNG' % check(out))
    if '--preview' in args:
        dest = args[args.index('--preview') + 1]
        preview(out, dest)
        print('aperçus ->', dest)
