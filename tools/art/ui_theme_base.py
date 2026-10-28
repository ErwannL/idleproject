"""Outils communs des cadres 9-slice de thème (masques, anneaux, bandes périodiques) + classe
de base `Base` : cadre riche générique (contour, biseau, moulure, filet d'accent, lueur
intérieure) que chaque thème spécialise (ornements de coin, motifs, en-tête, boutons).
"""
import math

from ui_frames import Img
import ui_frames as UF
from ui_px import lerp  # noqa: F401  (ré-exporté)
import ui_px as X

# ====================================================================== outils


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
    im = X.Canvas(w, h)
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




# ====================================================================== ajouts v2

def M4(W, H):
    """Les 4 coins : fonctions (points locaux haut-gauche) -> points image, en miroir.
    L'ombrage est calculé APRÈS la mise en miroir : lumière toujours haut-gauche."""
    out = []
    for fy in (False, True):
        for fx in (False, True):
            def m(pts, fx=fx, fy=fy):
                return {((W - 1 - x) if fx else x, (H - 1 - y) if fy else y) for (x, y) in pts}
            m.pt = (lambda x, y, fx=fx, fy=fy: ((W - 1 - x) if fx else x, (H - 1 - y) if fy else y))
            out.append(m)
    return out


def band(im, rows, pal, a0=0, period=16, phase=0, sides=SIDES, t0=0, t1=None):
    """Motif périodique le long des 4 bords. rows[0] est toujours visuellement en haut
    (barres haut/bas) ou à gauche (barres gauche/droite) : éclairage cohérent."""
    n = len(rows)
    for s in sides:
        L = im.w if s in ('top', 'bottom') else im.h
        for i, row in enumerate(rows):
            a = a0 + (i if s in ('top', 'left') else n - 1 - i)
            for t in range(t0, L - t0 if t1 is None else t1):
                ch = row[(t + phase) % period]
                if ch in ' .':
                    continue
                side_set(im, s, t, a, pal[ch])


def dup_row(im, y):
    """Insère une copie de la ligne y (image de hauteur h -> h + 1)."""
    out = X.Canvas(im.w, im.h + 1)
    for yy in range(out.h):
        src = yy if yy <= y else yy - 1
        out.px[yy] = list(im.px[src])
    return out


def clean_mid(im, l=14, r=14, ref=None):
    """Colonnes centrales étirées = copie d'une colonne de référence (uniformes en x)."""
    ref = im.w // 2 if ref is None else ref
    for y in range(im.h):
        for x in range(l, im.w - r):
            im.px[y][x] = im.px[y][ref]


def glow_rings(fill, glow, n, s=0.55, p=1.4):
    return [lerp(fill, glow, s * (1 - i / n) ** p) for i in range(n)]


class Base:
    """Cadre riche générique. Les thèmes surchargent palettes, profils et ornements."""
    K = (0, 0, 0)
    M = ((40, 40, 40), (80, 80, 80), (120, 120, 120), (170, 170, 170), (220, 220, 220))
    A = ((60, 40, 10), (150, 100, 30), (220, 170, 60), (255, 230, 140))
    GLOW = (60, 80, 140)
    FILL = (16, 20, 34)
    ALT_FILL = (22, 28, 46)
    SLOT_FILL = (10, 12, 22)
    TIP_FILL = (14, 18, 32, 244)
    TAB_OFF = (20, 26, 44)
    TAB_ON = {3: (50, 70, 130), 7: (30, 44, 90)}
    HEAD = {6: (50, 80, 160), 18: (20, 32, 70)}
    PROF = {'panel': SQ, 'alt': SQ, 'tab': SQ, 'btn': RND[2], 'badge': RND[3], 'slot': SQ, 'tip': SQ}
    BTN = {}
    BADGE = {}

    # ---- briques
    def mold(self):
        m0, m1, m2, m3, m4 = self.M
        return [(m4, m1, m3), (m3, m1, m2), (m2, m2, m2), (m1, m3, m2), (m0, m2, m1)]

    def acc(self):
        a0, a1, a2, a3 = self.A
        return (a3, a1, a2)

    def gl(self, n, fill=None, s=0.55):
        return glow_rings(fill or self.FILL, self.GLOW, n, s)

    # ---- ornements (à surcharger) : m transforme des points locaux haut-gauche
    def orn_panel(self, im, m):
        pass

    def orn_alt(self, im, m):
        pass

    def orn_tab(self, im, m, active):
        pass

    def orn_slot(self, im, m):
        pass

    def orn_tip(self, im, m):
        pass

    def orn_btn(self, im, m, k):
        pass

    def band_panel(self, im):
        pass

    def each(self, im, f, *a, clip=None):
        """Dessine l'ornement dans les 4 coins ; clip=n : tout pixel hors des carrés n x n
        des coins est restauré (les bords étirés restent uniformes)."""
        before = [list(r) for r in im.px]
        for m in M4(im.w, im.h):
            f(im, m, *a)
        if clip:
            for y in range(im.h):
                for x in range(im.w):
                    inx = x < clip or x >= im.w - clip
                    iny = y < clip or y >= im.h - clip
                    if not (inx and iny):
                        im.px[y][x] = before[y][x]

    # ---- cadres
    def panel(self):
        rings = [self.K] + self.mold() + [self.K, self.acc(), self.K] + self.gl(5)
        im = framed(48, 48, self.PROF['panel'], rings, self.FILL)
        self.band_panel(im)
        self.each(im, self.orn_panel, clip=16)
        return im

    def panel_alt(self):
        m0, m1, m2, m3, m4 = self.M
        rings = [self.K, (m4, m1, m3), (m2, m2, m2), (m1, m3, m2), self.K, self.acc(), self.K] + \
            self.gl(2, self.ALT_FILL)
        im = framed(32, 32, self.PROF['alt'], rings, self.ALT_FILL)
        self.each(im, self.orn_alt, clip=10)
        return im

    def tab(self, active):
        m0, m1, m2, m3, m4 = self.M
        if active:
            fill = vgrad(self.TAB_ON)
            on = self.TAB_ON[max(self.TAB_ON)]
            rings = [self.K, (m4, m1, m3), (m2, m3, m2), self.K, self.acc()] + glow_rings(on, self.GLOW, 2, .6)
        else:
            fill = self.TAB_OFF
            rings = [self.K, (m3, m0, m2), (m1, m2, m1), self.K, lerp(self.TAB_OFF, (0, 0, 0), .4)]
        im = framed(32, 32, self.PROF['tab'], rings, fill)
        self.each(im, self.orn_tab, active, clip=8)
        return im

    def btn_rim(self, k):
        m0, m1, m2, m3, m4 = self.M
        return (m3, m0, m2)

    def button(self, k):
        o, sh, base, lt, hi = self.BTN[k]
        rings = [self.K, self.btn_rim(k), (hi, sh, lt), (lerp(lt, base, .5), lerp(sh, base, .4), base)]
        im = framed(16, 16, self.PROF['btn'], rings, base)
        self.each(im, self.orn_btn, k, clip=5)
        self.glint(im, k)
        return im

    def glint(self, im, k):
        """Reflet spéculaire dans le coin haut-gauche (hors zones étirées)."""
        hi = self.BTN[k][4]
        for (x, y) in ((3, 2), (2, 3)):
            if im.px[y][x][3]:
                im.set(x, y, lerp(hi, (255, 255, 255), .6))
        if im.px[3][3][3]:
            im.set(3, 3, hi)

    def badge(self, k):
        o, sh, base, hi = self.BADGE[k]
        m0, m1, m2, m3, m4 = self.M
        return framed(12, 12, self.PROF['badge'], [self.K, (m3, m0, m2), (hi, sh, base)], base)

    def slot(self):
        m0, m1, m2, m3, m4 = self.M
        f = self.SLOT_FILL
        rings = [self.K, (m4, m1, m3), (m1, m3, m2), self.K, (lerp(f, (0, 0, 0), .6), lerp(f, m2, .35)),
                 (lerp(f, (0, 0, 0), .3), lerp(f, m2, .15))]
        im = framed(24, 24, self.PROF['slot'], rings, f)
        self.each(im, self.orn_slot, clip=6)
        return im

    def tooltip(self):
        m0, m1, m2, m3, m4 = self.M
        f = self.TIP_FILL
        rings = [self.K, (m4, m1, m3), (m1, m3, m2), self.K, self.acc(), self.K] + \
            [(*c, f[3]) for c in glow_rings(f[:3], self.GLOW, 2, .5)]
        im = framed(24, 24, self.PROF['tip'], rings, f)
        self.each(im, self.orn_tip, clip=8)
        return im

    def header(self):
        raise NotImplementedError
