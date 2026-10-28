"""Décors des thèmes d'interface : coin (40x40), cimier (56x22), ornement d'onglet (20x8),
séparateur (96x7), texture sans raccord (64x64), 2 particules.

Repère du coin : (0, 0) = coin haut-gauche du panneau (même échelle que panel.png). Le cadre
du panneau occupe les 16 premiers px ; l'ornement le recouvre et déborde ~8 px vers l'intérieur.
"""
import math
import random

import ui_px as X
from ui_px import Canvas, lerp
import ui_theme_styles as S


def halo(im, c, levels=((1, 120), (2, 60), (3, 22))):
    X.glow(im, im.opaque_pts(), c, levels, under=True)


def T(pts):
    """Symétrie par la diagonale (bras haut -> bras gauche)."""
    return X.transpose(pts)


def both(pts):
    return set(pts) | X.transpose(pts)


def wrap_disc(cx, cy, r, w=64, h=64):
    return {(x % w, y % h) for (x, y) in X.disc(cx, cy, r)}


def wdist(x, y, cx, cy, w=64, h=64):
    dx = min(abs(x - cx), w - abs(x - cx))
    dy = min(abs(y - cy), h - abs(y - cy))
    return math.hypot(dx, dy)


def wvec(x, y, cx, cy, w=64, h=64):
    dx = (x - cx + w / 2) % w - w / 2
    dy = (y - cy + h / 2) % h - h / 2
    return dx, dy


def texture_from(fn, base, seed=1, noise=0.0):
    """fn(x, y) -> décalage de teinte (-1..1) ; couleur = base +/- 1 crans."""
    im = Canvas(64, 64)
    nz = X.tile_noise(64, 64, 16, seed) if noise else None
    for y in range(64):
        for x in range(64):
            v = fn(x, y)
            if nz and not isinstance(v, tuple):
                v += (nz[y][x] - 0.5) * noise
            im.set(x, y, v if isinstance(v, tuple) else base(v))
    return im


def tone(base, light, dark):
    def f(v):
        if v >= 0:
            return lerp(base, light, min(1, v))
        return lerp(base, dark, min(1, -v))
    return f


def hbar(im, x0, x1, y, ramp, K, taper=6):
    """Barre horizontale 1 px cerclée, effilée aux bouts (alpha)."""
    for x in range(x0, x1 + 1):
        e = min(x - x0, x1 - x)
        a = 255 if e >= taper else int(70 + 185 * e / taper)
        im.blend(x, y - 1, K, a)
        im.blend(x, y + 1, K, a)
        im.blend(x, y, ramp[3] if e >= taper else ramp[2], a)


# ====================================================================== ROYAL

class Royal(S.Royal):
    def corner(self):
        im = Canvas(40, 40)
        g, K = self.G, self.K
        gd = (g[0], g[1], g[2], g[3], g[3])
        arm = X.thick(X.bezier([(13, 4.5), (21, 0.8), (27, 8.5), (35, 3.6)]), 2.7, 1.3)
        vol = X.thick(X.spiral(33.6, 7.6, 3.7, 0.6, -math.pi / 2, 0.95, 50), 1.0)
        sub = X.thick(X.bezier([(19, 5), (20, 10), (23, 12.5), (26, 10.8)]), 1.5, 0.7) | \
            X.thick(X.spiral(25, 9.4, 1.6, 0.3, math.pi * 0.3, 0.8, 30), 0.5)
        leaf = X.poly([(12, 15), (15, 12), (21, 17), (25, 25), (17, 21)])
        X.group(im, [(both(sub), gd), (both(arm | vol), g), (leaf, g, 3)], K)
        for q in X.line(16, 16, 22, 22):
            im.set(q[0], q[1], g[1])
        X.obj(im, X.disc(25.5, 25.5, 2.1), self.SAPH, K, mode='ball')
        im.set(25, 24, WHITE)
        # cartouche : rosace d'or, anneau ponctué, rubis taillé
        X.obj(im, X.disc(9.5, 9.5, 9.0), g, K, cap=3)
        X.fill(im, X.ring(9.5, 9.5, 6.0, 6.9), g[0])
        for k in range(8):
            a = k * math.pi / 4 + math.pi / 8
            im.set(int(round(9.5 + 7.8 * math.cos(a))), int(round(9.5 + 7.8 * math.sin(a))), g[4])
        X.fill(im, X.disc(9.5, 9.5, 5.6), self.n1)
        X.obj(im, X.poly([(9.5, 4.2), (14.8, 9.5), (9.5, 14.8), (4.2, 9.5)]), self.RUBY, None, cap=3)
        X.fill(im, X.poly([(9.5, 7.5), (11.5, 9.5), (9.5, 11.5), (7.5, 9.5)]), self.RUBY[3])
        X.fill(im, {(8, 7), (7, 8), (8, 8)}, self.RUBY[4])
        halo(im, (255, 210, 110))
        X.sparkle(im, 30, 14, WHITE, g[3], 2)
        X.sparkle(im, 14, 30, WHITE, g[3], 2)
        return im

    def crest(self):
        im = Canvas(56, 22)
        g, K = self.G, self.K
        # lauriers d'or de part et d'autre
        for fx in (False, True):
            stem = X.thick(X.bezier([(15, 19), (8, 19), (3, 14), (4, 8)]), 0.6)
            leaves = set()
            for t, side in ((0.15, 1), (0.3, -1), (0.45, 1), (0.6, -1), (0.75, 1), (0.92, -1)):
                bx, by = X.bezier([(15, 19), (8, 19), (3, 14), (4, 8)], 100)[int(t * 100)]
                leaves |= X.ellipse(bx - 1.5 * side * 0.4, by - 1.6, 1.0, 1.9) if side > 0 else \
                    X.ellipse(bx + 1.6, by + 0.2 - 1.0, 1.9, 1.0)
            part = stem | leaves
            if fx:
                part = X.mirror_x(part, 56)
            X.group(im, [(part, (g[0], g[1], g[2], g[3], g[3]))], K)
        # velours
        X.fill(im, X.poly([(17.5, 13), (19, 7), (28, 4), (37, 7), (38.5, 13)]), self.A[1])
        X.fill(im, X.poly([(19.5, 13), (21, 9), (28, 6.5), (35, 9), (36.5, 13)]), self.A[2])
        # fleurons
        tips = [(15.5, 7), (21.5, 4.6), (28, 2.6), (34.5, 4.6), (40.5, 7)]
        body = X.rect(14, 12, 42, 13)
        for (tx, ty) in tips:
            body |= X.poly([(tx - 2.8, 13.5), (tx, ty), (tx + 2.8, 13.5)])
        band = X.rect(13, 14, 43, 19)
        X.group(im, [(body, g), (band, g, 3)], K)
        for (tx, ty) in tips:
            r = 1.7 if tx == 28 else 1.35
            X.obj(im, X.disc(tx, ty - 1.4, r), ((150, 150, 176), (200, 200, 222), (232, 232, 246), WHITE, WHITE), K, mode='ball')
        X.obj(im, X.poly([(28, 13.6), (31.2, 16.8), (28, 20), (24.8, 16.8)]), self.RUBY, K, cap=3)
        im.set(27, 15, self.RUBY[4])
        for cx in (19.5, 36.5):
            X.obj(im, X.disc(cx, 16.8, 1.6), self.SAPH, K, mode='ball')
        for cx in (15, 24, 32, 41):
            im.set(cx, 16, WHITE)
            im.set(cx, 17, (200, 200, 220))
        halo(im, (255, 210, 110))
        return im

    def tab_deco(self):
        im = Canvas(20, 8)
        g, K = self.G, self.K
        for fx in (False, True):
            s = X.thick(X.bezier([(7, 4), (4, 6), (1.5, 4.5), (2.5, 2.5)]), 0.9, 0.5)
            X.obj(im, X.mirror_x(s, 20) if fx else s, g, K)
        X.obj(im, X.poly([(9.5, 0.6), (13, 4), (9.5, 7.4), (6, 4)]) | X.poly([(10.5, 0.6), (13.9, 4), (10.5, 7.4), (7, 4)]), g, K)
        X.obj(im, X.poly([(10, 2), (12, 4), (10, 6), (8, 4)]), self.RUBY, None)
        im.set(9, 3, self.RUBY[4])
        return im

    def divider(self):
        im = Canvas(96, 7)
        g, K = self.G, self.K
        hbar(im, 2, 40, 3, g, K, 14)
        hbar(im, 55, 93, 3, g, K, 14)
        for fx in (False, True):
            s = X.thick(X.bezier([(41, 3), (38, 0.8), (35, 2), (36.5, 3.2)]), 0.6) | \
                X.thick(X.bezier([(41, 3), (38, 5.2), (35, 4), (36.5, 2.8)]), 0.6)
            X.obj(im, X.mirror_x(s, 96) if fx else s, g, K)
        X.obj(im, X.poly([(47.5, -0.4), (51.5, 3), (47.5, 6.4), (43.5, 3)]) | X.poly([(48.5, -0.4), (52.5, 3), (48.5, 6.4), (44.5, 3)]), g, K)
        X.obj(im, X.poly([(48, 1), (50, 3), (48, 5), (46, 3)]) | X.poly([(48, 1), (50, 3), (48, 5), (46, 3)]), self.RUBY, None)
        im.set(47, 2, self.RUBY[4])
        for x in (30, 66):
            X.obj(im, {(x, 3)}, g, K)
            im.set(x, 3, g[4])
        return im

    def texture(self):
        base = self.FILL
        f = tone(base, (20, 33, 78), (10, 17, 46))

        def fn(x, y):
            v = 0
            for (cx, cy) in ((16, 16), (48, 48)):
                dx, dy = wvec(x, y, cx, cy)
                r = math.hypot(dx, dy)
                a = math.atan2(dy, dx)
                if r < 4 + 2.5 * abs(math.cos(2 * a)):
                    v = 1
                elif 9.5 < r < 10.6 + 1.2 * math.cos(8 * a):
                    v = 0.8
                elif r < 12 and abs(math.cos(4 * a)) > 0.97:
                    v = 0.6
            # treillis en ogive entre les médaillons
            u, w = (x + y) % 32, (x - y) % 32
            if v == 0 and (abs(u - 16) < 0.6 or abs(w - 16) < 0.6):
                v = 0.55 if (x // 2) % 2 == 0 else 0.3
            return v
        return texture_from(fn, f, seed=3, noise=0.35)

    def particles(self):
        g = self.G
        p1 = Canvas(7, 7)
        for k, c in ((1, g[4]), (2, g[3]), (3, g[2])):
            for dx, dy in ((k, 0), (-k, 0), (0, k), (0, -k)):
                p1.set(3 + dx, 3 + dy, c)
        for dx, dy in ((1, 1), (-1, 1), (1, -1), (-1, -1)):
            p1.set(3 + dx, 3 + dy, (g[2][0], g[2][1], g[2][2], 150))
        p1.set(3, 3, WHITE)
        p2 = Canvas(5, 5)
        X.obj(p2, X.poly([(2, 0.5), (3.6, 2), (2, 3.5), (0.4, 2)]), g, (self.G[0][0], self.G[0][1], self.G[0][2]))
        p2.set(1, 2, g[4]); p2.set(2, 1, WHITE)
        return p1, p2



def glyph(im, x, y, kind, c, c2=None):
    """Petites runes 3x3 / 3x4."""
    G = {
        0: ["X.X", "XXX", ".X.", ".X."],
        1: ["XX.", "X.X", "XX.", "X.."],
        2: [".X.", "X.X", ".X.", "X.X"],
        3: ["X..", "XX.", "X.X", "X.."],
        4: ["XXX", ".X.", "X.X", "X.X"],
        5: [".XX", "X..", ".X.", "..X"],
    }[kind % 6]
    for j, row in enumerate(G):
        for i, ch in enumerate(row):
            if ch == 'X':
                im.set(x + i, y + j, c)


def wrap_line(im, x0, y0, x1, y1, c, a=255):
    for (x, y) in X.line(x0, y0, x1, y1):
        X.wrap_set(im, x, y, c, a)


# ====================================================================== SYLVAN

class Sylvan(S.Sylvan):
    BARK = ((22, 13, 8), (44, 28, 16), (70, 46, 26), (102, 70, 40), (138, 100, 60))
    MOSS = ((20, 50, 18), (40, 90, 30), (70, 130, 44), (110, 170, 60), (160, 210, 90))

    def leaf_at(self, im, x, y, a, L=6.5, W=2.1, ramp=None):
        ramp = ramp or self.L
        S_ = X.leaf(x, y, a, L, W)
        X.outline(im, S_, self.K)
        X.bevel(im, S_, ramp, 2)
        for q in X.leaf_vein(x, y, a, L)[1:-1]:
            if q in S_:
                im.set(q[0], q[1], ramp[1])

    def branch(self, ctrl, r0, r1, n=90, seed=1):
        rnd = random.Random(seed)
        pts = X.bezier(ctrl, n)
        out = set()
        for i, (x, y) in enumerate(pts):
            t = i / n
            r = r0 + (r1 - r0) * t + 0.5 * math.sin(t * 17 + seed)
            out |= X.disc(x, y, max(0.6, r))
        # nœuds
        for t in (0.3, 0.62):
            x, y = pts[int(t * n)]
            out |= X.disc(x + rnd.uniform(-1, 1), y + rnd.uniform(-1, 1), r0 * (1 - t) + r1 * t + 1.0)
        return out

    def corner(self):
        im = Canvas(40, 40)
        K, b = self.K, self.BARK
        top = self.branch([(3, 6), (13, 2), (24, 9), (39, 5)], 3.6, 1.2, seed=1)
        left = self.branch([(6, 3), (2, 15), (9, 25), (5, 39)], 3.6, 1.2, seed=2)
        twig1 = X.thick(X.bezier([(22, 7), (25, 12), (30, 14)]), 1.3, 0.6)
        twig2 = X.thick(X.bezier([(7, 22), (12, 25), (14, 30)]), 1.3, 0.6)
        X.group(im, [(twig1 | twig2, b), (top | left, b, 3)], K)
        # mousse sur le dessus des branches
        for (x, y) in X.bezier([(5, 3), (13, -1), (24, 6), (34, 3)], 40)[::3]:
            im.set(int(x), int(y), self.MOSS[3])
            im.set(int(x) + 1, int(y), self.MOSS[2])
        # stries d'écorce
        for (x0, y0, x1, y1) in ((12, 4, 17, 4), (27, 8, 32, 7), (4, 12, 4, 17), (8, 27, 7, 32)):
            for q in X.line(x0, y0, x1, y1):
                im.set(q[0], q[1], b[0])
        # feuilles (grandes, nervurées)
        for (x, y, a, L, aut) in ((16, 4, -0.95, 8.5, 0), (20, 8, 0.75, 8, 0), (30, 9, 1.0, 7.5, 1), (33, 4, -0.7, 7, 0),
                                  (30, 14, 0.4, 6, 0),
                                  (4, 16, 2.52, 8.5, 0), (8, 20, 0.82, 8, 0), (9, 30, 0.57, 7.5, 1), (4, 33, 2.27, 7, 0),
                                  (14, 30, 1.15, 6, 0)):
            self.leaf_at(im, x, y, a, L, 2.6 if L > 7 else 2.1, self.AUT if aut else None)
        # grappe de baies
        for q in X.line(10, 10, 14, 14):
            im.set(q[0], q[1], b[3])
        for (x, y) in ((13, 14), (16.5, 13), (14.5, 17), (18, 16.5), (16, 20)):
            X.orb(im, x, y, 1.7, self.BERRY, K)
        halo(im, (120, 200, 90), ((1, 70), (2, 30)))
        return im

    def crest(self):
        im = Canvas(56, 22)
        K = self.K
        ant = ((70, 50, 34), (130, 100, 70), (186, 156, 112), (226, 204, 160), (250, 238, 206))
        for fx in (False, True):
            beam = X.thick(X.bezier([(25, 18), (16, 17), (9, 10), (4, 1)], 80), 2.1, 0.8)
            t1 = X.thick(X.bezier([(14, 15), (12, 9), (14, 3)]), 1.3, 0.5)
            t2 = X.thick(X.bezier([(9, 11), (5, 9), (1, 8)]), 1.2, 0.5)
            t3 = X.thick(X.bezier([(19, 17), (18, 11), (21, 6)]), 1.2, 0.5)
            a = beam | t1 | t2 | t3
            if fx:
                a = X.mirror_x(a, 56)
            X.group(im, [(a, ant, 2)], K)
        for k in range(7):
            ang = math.pi * (0.95 + k * 0.183)
            x, y = 28 + 4.6 * math.cos(ang) * 1.0, 15.5 + 3.4 * math.sin(ang)
            self.leaf_at(im, x, y, ang, 5.0, 1.7, self.AUT if k in (1, 5) else None)
        for k in range(4):
            ang = math.pi * (0.2 + k * 0.2)
            self.leaf_at(im, 28 + 3 * math.cos(ang), 16 + 2 * math.sin(ang), ang, 4.5, 1.5)
        X.orb(im, 28, 14.5, 3.2, ((10, 60, 30), (20, 120, 60), (50, 190, 90), (150, 250, 170), (230, 255, 235)), K)
        for (x, y) in ((22, 19.5), (34, 19.5)):
            X.orb(im, x, y, 1.6, self.BERRY, K)
        halo(im, (120, 200, 90), ((1, 80), (2, 30)))
        return im

    def tab_deco(self):
        im = Canvas(20, 8)
        X.group(im, [(X.thick(X.bezier([(2, 6), (10, 4.5), (18, 6)]), 0.6), self.BARK)], self.K)
        self.leaf_at(im, 9, 5, -2.3, 5, 1.6)
        self.leaf_at(im, 11, 5, -0.8, 5, 1.6)
        X.orb(im, 10, 5.5, 1.4, self.BERRY, self.K)
        return im

    def divider(self):
        im = Canvas(96, 7)
        b = self.BARK
        for x in range(4, 92):
            e = min(x - 4, 91 - x)
            y = 3 + (1 if (x // 9) % 2 and e > 6 else 0) * 0
            a = 255 if e > 10 else 60 + 19 * e
            im.blend(x, y, b[3] if e > 10 else b[2], a)
            im.blend(x, y + 1, self.K, a)
        for k, x in enumerate((14, 24, 34, 61, 71, 81)):
            up = k % 2 == 0
            S_ = X.leaf(x, 3, -0.9 if up else 0.9, 3.4, 1.0) if x < 48 else X.leaf(x, 3, -2.24 if up else 2.24, 3.4, 1.0)
            X.fill(im, S_, self.L[3] if up else self.L[2])
        for (x, a) in ((44, -2.6), (52, -0.55), (48, -1.57)):
            S_ = X.leaf(48 + (x - 48) * 0.3, 3.5, a, 4.2, 1.4)
            X.obj(im, S_, self.L, self.K)
        for (x, y) in ((45.5, 4.5), (50.5, 4.5)):
            X.orb(im, x, y, 1.3, self.BERRY, self.K)
        return im

    def texture(self):
        base = (16, 31, 18)
        f = tone(base, (21, 38, 23), (11, 23, 13))
        nz = X.tile_noise(64, 64, 32, 11, 2)

        def fn(x, y):
            g = math.sin(2 * math.pi * (y / 16.0) + 4.0 * nz[y][x] + 0.8 * math.sin(2 * math.pi * x / 64))
            v = 0.5 * g
            if y % 16 == 0:
                v = -1
            elif y % 16 == 1:
                v = 0.6
            # joints décalés des planches
            j = (y // 16) * 24 % 64
            if x == j and y % 16:
                v = -0.9
            # nœud
            for (cx, cy) in ((20, 8), (50, 40)):
                d = wdist(x, y, cx, cy)
                if d < 3.2:
                    v = -0.8 if d < 1.2 else (0.5 if d > 2.3 else -0.3)
            return v
        return texture_from(fn, f, seed=5, noise=0.25)

    def particles(self):
        p1 = Canvas(7, 7)
        S_ = X.leaf(0.6, 6.0, -0.785, 7.4, 2.0)
        X.bevel(p1, S_, self.L, 2)
        for q in X.line(1, 5, 4, 2):
            p1.set(q[0], q[1], self.L[1])
        p2 = Canvas(7, 7)
        X.bevel(p2, S_, self.AUT, 2)
        for q in X.line(1, 5, 4, 2):
            p2.set(q[0], q[1], self.AUT[1])
        return p1, p2


# ====================================================================== FORGE

class Forge(S.Forge):
    def rivet(self, im, x, y, r=1.4):
        X.obj(im, X.disc(x, y, r), (self.I[0], self.I[1], self.I[3], self.I[4], (228, 228, 236)), self.K, mode='ball')

    def corner(self):
        im = Canvas(40, 40)
        K, I, E = self.K, self.I, self.E
        ramp = (I[0], I[1], I[2], I[3], I[4])
        top = X.poly([(0, 0), (37, 0), (39, 3), (39, 6), (37, 9), (0, 9)])
        left = X.transpose(top)
        gus = X.poly([(8, 8), (24, 8), (8, 24)])
        X.group(im, [(gus, (I[0], I[1], I[1], I[2], I[3])), (top | left, ramp, 2)], K)
        # fissures incandescentes
        for (pts) in (((16, 2), (18, 4), (17, 6)), ((2, 18), (4, 20), (3, 23)), ((14, 15), (16, 13))):
            for q in X.polyline(list(pts)):
                im.set(q[0], q[1], E[2])
        for x in (17, 25, 33):
            self.rivet(im, x, 4.5)
            self.rivet(im, 4.5, x)
        self.rivet(im, 15, 15, 1.5)
        # bossage rond + rune de braise
        X.obj(im, X.disc(10, 10, 9.2), (I[0], I[1], I[2], I[3], I[4]), K, cap=3)
        X.fill(im, X.ring(10, 10, 6.0, 6.8), I[0])
        X.fill(im, X.disc(10, 10, 5.8), (36, 14, 6))
        rune = set(X.polyline([(10, 5), (10, 15)])) | set(X.polyline([(10, 7), (13, 9)])) | \
            set(X.polyline([(10, 10), (7, 12)])) | set(X.polyline([(10, 11), (13, 13)]))
        X.glow(im, rune, E[1], ((1, 200), (2, 110)), under=False)
        X.fill(im, rune, E[3])
        X.fill(im, {(10, 9), (10, 10)}, E[4])
        for k in range(6):
            a = k * math.pi / 3
            self.rivet(im, 10 + 7.8 * math.cos(a), 10 + 7.8 * math.sin(a), 0.8)
        halo(im, (255, 110, 30), ((1, 60), (2, 24)))
        return im

    def crest(self):
        im = Canvas(56, 22)
        K, I, E = self.K, self.I, self.E
        wood = ((50, 26, 12), (96, 56, 26), (140, 90, 44), (180, 128, 70), (214, 170, 110))
        for fx in (False, True):
            h = X.thick(X.bezier([(40, 21), (13, 4)]), 1.1)
            head = X.poly([(9.5, -0.5), (17.5, 3.5), (15.5, 8.5), (7.5, 4.5)])
            if fx:
                h, head = X.mirror_x(h, 56), X.mirror_x(head, 56)
            X.group(im, [(h, wood)], K)
            X.obj(im, head, I, K, cap=2)
        anvil = X.poly([(10, 8), (15, 7.5), (42, 7.5), (42, 11.5), (35, 11.5), (33, 14), (33, 16), (38, 17),
                        (39, 20.5), (17, 20.5), (18, 17), (23, 16), (23, 14), (21, 11.5), (16, 11.5)])
        X.obj(im, anvil, (I[0], I[1], I[2], I[3], I[4]), K, cap=2)
        # pièce chauffée à blanc sur l'enclume
        bar = X.rect(23, 5, 34, 6)
        X.glow(im, bar, E[1], ((1, 200), (2, 120), (3, 50)), under=False)
        X.obj(im, bar, (E[1], E[2], E[3], E[4], (255, 255, 240)), (60, 10, 0), mode='ball')
        for (x, y) in ((20, 2), (38, 1), (25, 0), (44, 4), (13, 3), (31, 1)):
            im.set(x, y, E[4])
            im.blend(x + 1, y, E[2], 160)
            im.blend(x, y + 1, E[2], 120)
        halo(im, (255, 110, 30), ((1, 50), (2, 20)))
        return im

    def tab_deco(self):
        im = Canvas(20, 8)
        I, E = self.I, self.E
        fl = X.poly([(10, -0.5), (12.5, 3), (12, 5.5), (8, 5.5), (7.5, 3)])
        X.glow(im, fl, E[1], ((1, 160), (2, 70)), under=False)
        X.fill(im, fl, E[2])
        X.fill(im, X.poly([(10, 1.5), (11.5, 4), (10, 5.5), (8.5, 4)]), E[3])
        im.set(10, 4, E[4])
        X.obj(im, X.rect(5, 5, 14, 7), I, self.K, cap=1)
        for x in (3, 16):
            X.obj(im, X.disc(x, 6, 0.8), I, self.K, mode='ball')
        return im

    def divider(self):
        im = Canvas(96, 7)
        I, E = self.I, self.E
        bar = X.poly([(3, 3), (6, 2), (90, 2), (93, 3), (90, 4), (6, 4)])
        X.obj(im, bar, (I[0], I[1], I[2], I[3], I[4]), self.K, cap=1)
        for x in range(14, 84, 12):
            if abs(x - 48) > 6:
                im.set(x, 3, I[4])
                im.set(x + 1, 3, I[1])
        hexb = X.poly([(48 + 3.6 * math.cos(a), 3 + 3.6 * math.sin(a)) for a in [k * math.pi / 3 for k in range(6)]])
        X.obj(im, hexb, (I[0], I[1], I[3], I[4], (220, 220, 228)), self.K, cap=1)
        core = X.disc(48, 3, 1.3)
        X.glow(im, core, E[1], ((1, 160),), under=False)
        X.fill(im, core, E[3])
        im.set(48, 3, E[4])
        return im

    def texture(self):
        base = self.FILL
        f = tone(base, (31, 25, 22), (19, 14, 13))
        cs = [(16 * i + 8 * (j % 2), 16 * j) for j in range(4) for i in range(4)]
        rnd = random.Random(9)
        dimples = [(rnd.randrange(64), rnd.randrange(64)) for _ in range(40)]

        def fn(x, y):
            ds = sorted((wdist(x, y, cx, cy), (cx, cy)) for (cx, cy) in cs)
            (d0, c0), (d1, _) = ds[0], ds[1]
            if d1 - d0 < 1.0:
                return -1
            dx, dy = wvec(x, y, c0[0], c0[1])
            v = -0.25 * (dx + dy) / 10.0
            if d1 - d0 < 2.0:
                v += 0.5 if dy < 0 or dx < 0 else -0.5
            for (px, py) in dimples:
                dd = wdist(x, y, px, py)
                if dd < 1.6:
                    v += -0.4 if dd < 0.8 else 0.3
            return v
        return texture_from(fn, f, seed=8, noise=0.2)

    def particles(self):
        E = self.E
        p1 = Canvas(5, 5)
        X.glow(p1, X.disc(2, 2, 1), E[1], ((1, 160), (2, 60)), under=False)
        X.fill(p1, X.disc(2, 2, 1), E[2])
        p1.set(2, 2, E[4])
        p2 = Canvas(7, 7)
        for k, a in ((1, 255), (2, 200), (3, 110)):
            for dx, dy in ((k, 0), (-k, 0), (0, k), (0, -k)):
                p2.blend(3 + dx, 3 + dy, E[3], a)
        for dx, dy in ((1, 1), (-1, 1), (1, -1), (-1, -1)):
            p2.blend(3 + dx, 3 + dy, E[2], 140)
        p2.set(3, 3, (255, 255, 230))
        return p1, p2


# ====================================================================== ARCANE

class Arcane(S.Arcane):
    def corner(self):
        im = Canvas(40, 40)
        K, Sv, C, V = self.K, self.S, self.CY, self.V
        # cercle runique (quart) : anneaux argent + bande de runes
        ring_out = {(x, y) for (x, y) in X.ring(1, 1, 30.4, 31.6) if x >= 0 and y >= 0}
        ring_in = {(x, y) for (x, y) in X.ring(1, 1, 24.4, 25.6) if x >= 0 and y >= 0}
        X.glow(im, ring_out | ring_in, C[2], ((1, 110), (2, 40)), under=False)
        X.fill(im, {(x, y) for (x, y) in X.ring(1, 1, 25.6, 30.4) if x >= 0 and y >= 0}, (*V[0], 200))
        X.fill(im, ring_out, Sv[3])
        X.fill(im, ring_in, Sv[2])
        for k, deg in enumerate((14, 30, 46, 62, 78)):
            a = math.radians(deg)
            gx, gy = 1 + 28 * math.cos(a), 1 + 28 * math.sin(a)
            glyph(im, int(round(gx)) - 1, int(round(gy)) - 2, k, C[3])
        for deg in (22, 38, 54, 70):
            a = math.radians(deg)
            for rr in (25, 31):
                im.set(int(round(1 + rr * math.cos(a))), int(round(1 + rr * math.sin(a))), C[4])
        dots = {(int(round(1 + 19 * math.cos(math.radians(d)))), int(round(1 + 19 * math.sin(math.radians(d)))))
                for d in range(8, 90, 9)}
        X.fill(im, dots, C[2])
        # médaillon + grand cristal flottant vers l'intérieur
        X.obj(im, X.disc(8, 8, 7.6), Sv, K, cap=2)
        X.fill(im, X.disc(8, 8, 5.4), V[0])
        X.fill(im, X.ring(8, 8, 3.8, 4.6), C[1])
        cr = X.crystal(15, 15, math.pi / 4, 11.5, 4.6, back=0.45)
        X.glow(im, cr, C[2], ((1, 170), (2, 90), (3, 40)), under=False)
        X.obj(im, cr, C, K, cap=3)
        # arête du cristal
        for q in X.line(8, 8, 22, 22):
            if q in cr:
                im.set(q[0], q[1], C[3])
        for (x, y) in ((11, 11), (12, 12)):
            im.set(x, y, C[4])
        for (x, y) in ((28, 12), (12, 28), (35, 33)):
            X.sparkle(im, x, y, WHITE, C[3], 2)
        return im

    def crest(self):
        im = Canvas(56, 22)
        K, Sv, C, V = self.K, self.S, self.CY, self.V
        # rayons
        for deg in range(200, 345, 18):
            a = math.radians(deg)
            for rr in range(13, 19):
                im.blend(int(round(28 + rr * math.cos(a))), int(round(13 + rr * math.sin(a))), C[2], 220 - (rr - 13) * 35)
        tri = X.poly([(28, -0.5), (41, 20.5), (15, 20.5)])
        inner = X.poly([(28, 4.5), (36.5, 18), (19.5, 18)])
        X.glow(im, tri, (150, 110, 255), ((1, 120), (2, 50)), under=False)
        X.obj(im, tri, Sv, K, cap=1)
        X.fill(im, inner, V[1])
        eye = X.ellipse(28, 13, 5.2, 2.6)
        X.fill(im, eye, (230, 236, 250))
        X.outline(im, eye, K)
        X.obj(im, X.disc(28, 13, 2.2), C, None, mode='ball')
        X.fill(im, {(28, 13), (28, 12), (28, 14)}, K)
        im.set(27, 12, WHITE)
        for (x, y, k) in ((9, 11, 0), (47, 11, 1)):
            X.glow(im, {(x, y)}, C[2], ((1, 200), (2, 90), (3, 30)), under=False)
            X.sparkle(im, x, y, WHITE, C[3], 3)
        for (x, y) in ((4, 16), (52, 16), (14, 4), (42, 4)):
            im.set(x, y, self.MAG[3])
        return im

    def tab_deco(self):
        im = Canvas(20, 8)
        C = self.CY
        X.glow(im, {(10, 4)}, C[2], ((1, 200), (2, 110), (3, 40)), under=False)
        X.sparkle(im, 10, 4, WHITE, C[3], 3)
        for x in (4, 16):
            im.set(x, 4, C[2])
        for x in (1, 19):
            im.set(x, 4, C[1])
        return im

    def divider(self):
        im = Canvas(96, 7)
        Sv, C = self.S, self.CY
        hbar(im, 3, 41, 3, Sv, self.K, 16)
        hbar(im, 54, 92, 3, Sv, self.K, 16)
        cr = X.crystal(48, 3, 0, 5.4, 2.6, back=0.5)
        X.glow(im, cr, C[2], ((1, 150), (2, 60)), under=False)
        X.obj(im, cr, C, self.K, cap=2)
        for x, k in ((30, 2), (63, 4)):
            glyph(im, x, 1, k, C[3])
        for x in (39, 57):
            im.set(x, 3, C[4])
        return im

    def texture(self):
        base = self.FILL
        f = tone(base, (34, 22, 70), (18, 9, 40))
        rnd = random.Random(21)
        stars = [(rnd.randrange(64), rnd.randrange(64), rnd.random()) for _ in range(46)]
        im = texture_from(lambda x, y: 0, f, seed=21, noise=0.5)
        cons = [(stars[i], stars[i + 1]) for i in range(0, 12, 2)]
        for (a, b) in cons:
            if wdist(a[0], a[1], b[0], b[1]) < 22:
                dx, dy = wvec(b[0], b[1], a[0], a[1])
                wrap_line(im, a[0], a[1], a[0] + dx, a[1] + dy, (30, 19, 62))
        for k in range(0, 360, 6):
            a = math.radians(k)
            X.wrap_set(im, int(round(32 + 22 * math.cos(a))), int(round(32 + 22 * math.sin(a))), (29, 18, 60))
        for (x, y, r) in stars:
            X.wrap_set(im, x, y, (40, 28, 80) if r > 0.75 else (33, 21, 66))
        return im

    def particles(self):
        C = self.CY
        p1 = Canvas(7, 7)
        rune = {(3, 1), (3, 2), (3, 3), (3, 4), (3, 5), (2, 2), (4, 2), (2, 4), (4, 5), (1, 1), (5, 1)}
        X.glow(p1, rune, C[2], ((1, 120),), under=False)
        X.fill(p1, rune, C[3])
        p1.set(3, 3, WHITE)
        p2 = Canvas(5, 5)
        X.glow(p2, X.disc(2, 2, 1), self.MAG[2], ((1, 150), (2, 60)), under=False)
        X.fill(p2, X.disc(2, 2, 1), self.MAG[3])
        p2.set(2, 2, self.MAG[4])
        return p1, p2


def drip(im, x, y0, L, ramp, K):
    """Coulure verticale terminée par une goutte."""
    col = {(x, y) for y in range(y0, y0 + L)}
    if L > 4:
        col |= {(x + 1, y) for y in range(y0, y0 + L // 2)}
    S_ = col | X.disc(x + 0.3, y0 + L + 0.5, 1.3)
    X.outline(im, S_, K)
    X.fill(im, S_, ramp[2])
    for y in range(y0, y0 + L):
        im.set(x, y, ramp[3])
    im.set(x, y0 + L, ramp[4])
    return S_


def tendril(im, ctrl, r0, r1, col_, core, a=150, curl=None, puff=0.7, dark=None):
    """Volute de fumée épaisse : halo, corps semi-transparent bouffant, cœur lumineux."""
    path = X.bezier(ctrl, 90)
    if curl:
        path += curl
    n = len(path)
    outer, inner = set(), set()
    for k, (x, y) in enumerate(path):
        t = k / max(1, n - 1)
        r = max(0.4, r0 + (r1 - r0) * t) * (1 + puff * 0.35 * math.sin(k * 0.45))
        outer |= X.disc(x, y, r)
        inner |= X.disc(x - 0.3, y - 0.3, r * 0.45)
    X.glow(im, outer, col_, ((1, a // 3), (2, a // 7)), under=True)
    for (x, y) in outer:
        im.blend(x, y, dark or col_, a * 3 // 4)
    for (x, y) in inner:
        im.blend(x, y, col_, a)
    for k, (x, y) in enumerate(path):
        if k % 3 != 2:
            im.blend(int(round(x - 0.6)), int(round(y - 0.6)), core, 170)
    return outer


# ====================================================================== NECRO

class Necro(S.Necro):
    HORN = ((34, 28, 26), (70, 60, 52), (112, 100, 84), (160, 146, 120), (206, 196, 170))

    def bone(self, im, x0, y0, x1, y1, w=1.6, knob=2.3):
        a = math.atan2(y1 - y0, x1 - x0)
        nx, ny = -math.sin(a), math.cos(a)
        shaft = X.thick(X.bezier([(x0, y0), (x1, y1)]), w)
        ends = set()
        for (x, y) in ((x0, y0), (x1, y1)):
            ends |= X.disc(x + nx * knob * 0.6, y + ny * knob * 0.6, knob) | X.disc(x - nx * knob * 0.6, y - ny * knob * 0.6, knob)
        X.group(im, [(shaft | ends, self.B, 2)], self.K)

    def skull_big(self, im, cx, cy, s, glow=True):
        sk, ey, no, te = X.skull_pts(cx, cy, s)
        X.obj(im, sk, self.B, self.K, cap=2)
        X.fill(im, ey | no, self.K)
        X.fill(im, te, self.K)
        # fissure
        for q in X.line(cx + 1.5 * s, cy - 4.6 * s, cx + 0.6 * s, cy - 2.6 * s):
            im.set(q[0], q[1], self.B[0])
        for (ex, ey_) in ((cx - 1.9 * s, cy + 0.2 * s), (cx + 1.9 * s, cy + 0.2 * s)):
            p = X.disc(ex, ey_, 0.6 * s)
            if glow:
                X.glow(im, p, self.ICH[2], ((1, 160), (2, 60)), under=False)
            X.fill(im, p, self.ICH[3])
            im.set(int(round(ex)), int(round(ey_)), self.ICH[4])

    def corner(self):
        im = Canvas(40, 40)
        self.bone(im, 14, 4.5, 36, 4.5, 1.7, 2.4)
        self.bone(im, 4.5, 14, 4.5, 36, 1.7, 2.4)
        self.bone(im, 4, 21, 21, 4, 1.4, 2.0)
        self.bone(im, 5, 5, 23, 23, 1.4, 2.0)
        for (x, y0, L) in ((18, 7, 6), (26, 7, 10), (31, 7, 4)):
            S_ = drip(im, x, y0, L, self.ICH, self.K)
        for (x, y0, L) in ((7, 25, 5),):
            drip(im, x, y0, L, self.ICH, self.K)
        self.skull_big(im, 10.5, 9.5, 1.75)
        # ichor sous la mâchoire
        drip(im, 10, 19, 5, self.ICH, self.K)
        halo(im, (90, 220, 80), ((1, 60), (2, 26)))
        return im

    def crest(self):
        im = Canvas(56, 22)
        H = self.HORN
        for fx in (False, True):
            horn = set()
            path = X.bezier([(23, 7), (17, 0), (8, 0), (4, 8), (8, 12)], 90)
            for k, (x, y) in enumerate(path):
                t = k / 90
                horn |= X.disc(x, y, 2.6 * (1 - t) + 0.4)
            if fx:
                horn = X.mirror_x(horn, 56)
            X.group(im, [(horn, H, 2)], self.K)
            for k in range(1, 6):
                x, y = path[k * 14]
                x = 55 - x if fx else x
                im.set(int(round(x)), int(round(y)) + 1, H[0])
        self.skull_big(im, 27.5, 11.2, 1.65)
        drip(im, 25, 19, 1, self.ICH, self.K)
        drip(im, 30, 19, 1, self.ICH, self.K)
        halo(im, (90, 220, 80), ((1, 60), (2, 24)))
        return im

    def tab_deco(self):
        im = Canvas(20, 8)
        for (x0, x1) in ((1, 6), (13, 18)):
            S_ = X.rect(x0, 3, x1, 4) | X.disc(x0, 3.5, 1.1) | X.disc(x1, 3.5, 1.1)
            X.obj(im, S_, self.B, self.K, cap=1)
        sk, ey, no, te = X.skull_pts(9.5, 3.4, 0.62)
        X.obj(im, sk, self.B, self.K, cap=1)
        X.fill(im, ey, self.ICH[3])
        return im

    def divider(self):
        im = Canvas(96, 7)
        b = self.B
        for x in range(4, 92, 3):
            e = min(x - 4, 91 - x)
            h = 1 if e < 12 else 2
            if abs(x - 48) < 6:
                continue
            S_ = X.rect(x, 3 - (h - 1), x + 1, 3 + (h - 1))
            a = 255 if e > 8 else 110 + 18 * e
            for (px, py) in X.border_of(S_):
                im.blend(px, py, self.K, a)
            for (px, py) in S_:
                im.blend(px, py, b[3] if py <= 3 else b[1], a)
        sk, ey, no, te = X.skull_pts(47.5, 2.6, 0.68)
        X.obj(im, sk, b, self.K, cap=1)
        X.fill(im, ey, self.ICH[3])
        return im

    def texture(self):
        base = self.FILL
        f = tone(base, (21, 26, 23), (11, 14, 12))
        nz = X.tile_noise(64, 64, 32, 31, 3)
        im = texture_from(lambda x, y: (nz[y][x] - 0.5) * 1.4, f, seed=31, noise=0.3)
        rnd = random.Random(4)
        for _ in range(7):
            x, y = rnd.randrange(64), rnd.randrange(64)
            a = rnd.uniform(0, 2 * math.pi)
            for k in range(rnd.randrange(8, 18)):
                a += rnd.uniform(-0.7, 0.7)
                x2, y2 = x + 2 * math.cos(a), y + 2 * math.sin(a)
                wrap_line(im, int(round(x)), int(round(y)), int(round(x2)), int(round(y2)), (9, 11, 10))
                x, y = x2, y2
        return im

    def particles(self):
        x_ = self.ICH
        p1 = Canvas(7, 9)
        fl = X.poly([(3, 0), (5.2, 4), (5.5, 6.5), (3, 8.6), (0.5, 6.5), (0.8, 4)])
        X.fill(p1, fl, (*x_[1], 150))
        X.fill(p1, X.poly([(3, 2.5), (4.4, 5.2), (3, 7.6), (1.6, 5.2)]), (*x_[2], 220))
        X.fill(p1, X.disc(3, 6, 1), x_[3])
        p1.set(3, 6, x_[4])
        p2 = Canvas(7, 7)
        sk, ey, no, te = X.skull_pts(3, 2.6, 0.62)
        X.glow(p2, sk, x_[2], ((1, 120),), under=False)
        X.fill(p2, sk, x_[3])
        X.fill(p2, ey, (10, 40, 10))
        return p1, p2


# ====================================================================== DESERT

class Desert(S.Desert):
    CARN = ((80, 14, 6), (150, 36, 16), (210, 70, 30), (250, 130, 80), (255, 200, 170))

    def corner(self):
        im = Canvas(40, 40)
        a, t, g, l = self.SA, self.TQ, self.G, self.LAP
        steps = X.poly([(0, 0), (38, 0), (38, 4), (30, 4), (30, 8), (20, 8), (20, 12), (12, 12), (12, 20), (8, 20),
                        (8, 30), (4, 30), (4, 38), (0, 38)])
        X.obj(im, steps, a, self.K, cap=2)
        # collier gravé sur les degrés
        for x in range(13, 37, 4):
            for y in (1, 2):
                im.set(x, y, [g[3], t[2], l[2]][(x // 4) % 3])
                im.set(y, x, [g[3], t[2], l[2]][(x // 4) % 3])
            im.set(x + 3, 1, self.K); im.set(x + 3, 2, self.K)
            im.set(1, x + 3, self.K); im.set(2, x + 3, self.K)
        # soleil à rayons
        for k in range(16):
            ang = k * math.pi / 8
            L = 12.5 if k % 2 == 0 else 10.5
            ray = X.line(10 + 8.5 * math.cos(ang), 10 + 8.5 * math.sin(ang), 10 + L * math.cos(ang), 10 + L * math.sin(ang))
            X.fill(im, set(ray), g[3] if k % 2 == 0 else g[2])
        X.obj(im, X.disc(10, 10, 7.6), g, self.K, cap=3)
        X.obj(im, X.disc(10, 10, 4.2), self.CARN, g[0], mode='ball')
        im.set(8, 8, self.CARN[4])
        # scarabée turquoise vers l'intérieur
        cx, cy = 22, 22
        body = set(X.P(X.rot([(x, y) for (x, y) in X.ellipse(cx, cy + 0.6, 3.0, 3.9)], cx, cy, -math.pi / 4)))
        head = set(X.P(X.rot([(x, y) for (x, y) in X.ellipse(cx, cy - 4.0, 1.8, 1.3)], cx, cy, -math.pi / 4)))
        legs = set()
        for s_ in (-1, 1):
            for dy in (-1.5, 0.5, 2.5):
                legs |= set(X.P(X.rot(X.line(cx + 2.6 * s_, cy + dy, cx + 4.4 * s_, cy + dy + 1.2), cx, cy, -math.pi / 4)))
        X.fill(im, legs, self.K)
        X.obj(im, head, g, self.K, cap=1)
        X.obj(im, body, t, self.K, cap=2)
        for q in X.P(X.rot([(cx, cy - 1.4 + k * 0.5) for k in range(10)], cx, cy, -math.pi / 4)):
            if q in body:
                im.set(q[0], q[1], t[1])
        X.fill(im, set(X.P(X.rot([(cx - 1.2, cy - 1.6)], cx, cy, -math.pi / 4))), t[4])
        halo(im, (255, 200, 90), ((1, 80), (2, 30)))
        return im

    def crest(self):
        im = Canvas(56, 22)
        t, g, l = self.TQ, self.G, self.LAP
        for fx in (False, True):
            def mx(P_):
                return X.mirror_x(P_, 56) if fx else P_
            # aile stylisée : couvertures d'or, rang turquoise, rémiges lapis aux pointes en dents
            cells = {}
            for x in range(1, 24):
                tt = (23 - x) / 22.0
                top = 6.5 - 5.0 * tt ** 1.2
                bot = 17.0 - 10.0 * tt ** 1.0 + (1.2 if x % 3 == 0 else 0)
                for y in range(int(math.ceil(top)), int(bot) + 1):
                    u = (y - top) / max(1, bot - top)
                    band_ = 0 if u < 0.3 else 1 if u < 0.62 else 2
                    cells[(x, y)] = band_
            U = set(cells)
            X.outline(im, mx(U), self.K)
            ramps = (g, t, l)
            for (x, y), bd in cells.items():
                r_ = ramps[bd]
                up = cells.get((x, y - 1)) != bd
                dn = cells.get((x, y + 1)) != bd
                c = r_[3] if up else r_[1] if dn else r_[2]
                if bd > 0 and x % 3 == 0 and not up:
                    c = r_[0]
                q = next(iter(mx({(x, y)})))
                im.set(q[0], q[1], c)
            cob = X.thick(X.bezier([(23.5, 16), (21.5, 11), (23.2, 6.5)]), 1.0)
            X.obj(im, mx(cob), g, self.K)
            X.fill(im, mx({(23, 6)}), self.CARN[2])
        X.obj(im, X.disc(27.5, 10, 5.4), g, self.K, cap=3)
        X.obj(im, X.disc(27.5, 10, 3.4), self.CARN, g[0], mode='ball')
        im.set(26, 8, self.CARN[4])
        halo(im, (255, 200, 90), ((1, 80), (2, 30)))
        return im

    def tab_deco(self):
        im = Canvas(20, 8)
        for fx in (False, True):
            w = X.poly([(8, 2.5), (1, 1.5), (3, 4.5), (8, 5.5)])
            X.obj(im, X.mirror_x(w, 20) if fx else w, self.TQ, self.K, cap=1)
        X.obj(im, X.disc(9.5, 3.8, 2.6), self.G, self.K, cap=1)
        im.set(9, 3, self.CARN[2]); im.set(10, 4, self.CARN[1])
        return im

    def divider(self):
        im = Canvas(96, 7)
        g, t, l = self.G, self.TQ, self.LAP
        hbar(im, 4, 41, 3, g, self.K, 10)
        hbar(im, 54, 91, 3, g, self.K, 10)
        for x in range(16, 40, 6):
            for xx in (x, 95 - x):
                X.fill(im, {(xx, 3)}, t[2] if (x // 6) % 2 else l[2])
        lotus = X.poly([(48, -0.5), (50, 2.5), (53, 1), (51.5, 5.5), (44.5, 5.5), (43, 1), (46, 2.5)])
        X.obj(im, lotus, t, self.K, cap=1)
        X.fill(im, X.poly([(48, 1.5), (49.5, 4.5), (46.5, 4.5)]), g[3])
        X.fill(im, X.rect(44, 6, 51, 6), g[2])
        return im

    def texture(self):
        base = self.FILL
        f = tone(base, (60, 32, 23), (43, 22, 15))
        glyphs = {
            'eye': [(0, 2), (1, 1), (2, 1), (3, 1), (4, 2), (3, 3), (2, 3), (1, 3), (2, 2), (2, 4), (3, 5)],
            'ankh': [(1, 0), (0, 1), (2, 1), (1, 2), (0, 3), (1, 3), (2, 3), (1, 4), (1, 5), (1, 6)],
            'wave': [(0, 1), (1, 0), (2, 1), (3, 0), (4, 1), (5, 0)],
            'bird': [(0, 3), (1, 2), (2, 2), (3, 3), (2, 4), (3, 5), (4, 5), (1, 1)],
        }
        place = [('eye', 6, 4), ('ankh', 40, 3), ('wave', 22, 22), ('bird', 52, 20), ('ankh', 10, 36),
                 ('eye', 30, 38), ('wave', 46, 54), ('bird', 18, 52)]
        marks = set()
        for (k, ox, oy) in place:
            for (dx, dy) in glyphs[k]:
                marks.add(((ox + dx) % 64, (oy + dy) % 64))

        def fn(x, y):
            if y % 16 == 15:
                return -1
            if y % 16 == 0:
                return 0.6
            if x % 32 == ((y // 16) % 2) * 16 + 4:
                return -0.9
            if (x, y) in marks:
                return -0.75
            return 0
        return texture_from(fn, f, seed=13, noise=0.45)

    def particles(self):
        p1 = Canvas(5, 5)
        for (x, y, c) in ((1, 2, self.SA[3]), (2, 1, self.SA[4]), (3, 3, self.SA[2]), (2, 2, self.SA[3])):
            p1.set(x, y, c)
        p1.blend(0, 3, self.SA[2], 120)
        p1.blend(4, 1, self.SA[2], 120)
        p2 = Canvas(7, 7)
        X.glow(p2, {(3, 3)}, self.TQ[2], ((1, 200), (2, 110), (3, 40)), under=False)
        X.sparkle(p2, 3, 3, WHITE, self.TQ[3], 3)
        return p1, p2


# ====================================================================== FROST

class Frost(S.Frost):
    SNOW = ((150, 186, 210), (196, 222, 238), (228, 242, 250), (248, 252, 255), (255, 255, 255))

    def icicle(self, im, x, y0, L, w=1.5):
        S_ = X.poly([(x - w, y0), (x + w, y0), (x + 0.2, y0 + L)])
        X.obj(im, S_, self.I, self.K, cap=1)
        for y in range(y0, y0 + int(L * 0.6)):
            im.set(int(x - w * 0.3), y, self.I[4])
        return S_

    def corner(self):
        im = Canvas(40, 40)
        I, K = self.I, self.K
        rnd = random.Random(3)
        for x in range(15, 39, 3):
            L = rnd.choice([5, 7, 9, 12, 14]) * (1 - (x - 15) / 36)
            self.icicle(im, x + rnd.uniform(-0.4, 0.4), 4, max(3, L), 1.5 if L > 6 else 1.1)
        for y in range(15, 37, 4):
            L = rnd.choice([4, 5, 6, 7]) * (1 - (y - 15) / 40)
            X.obj(im, X.shard(3, y, rnd.uniform(-0.25, 0.35), max(3, L + 2), 1.5), I, K, cap=1)
        snow = set()
        for x in range(0, 40):
            hgt = 2.6 + 0.9 * math.sin(x * 0.55) - x * 0.025
            snow |= {(x, y) for y in range(0, int(round(hgt)) + 1)}
            snow |= {(y, x) for y in range(0, int(round(hgt)) + 1)}
        X.outline(im, snow, K)
        X.fill(im, snow, self.SNOW[3])
        X.fill(im, {(x, y) for (x, y) in snow if (x, y + 1) not in snow or (x + 1, y) not in snow}, self.SNOW[1])
        # médaillon de glace + grand flocon
        X.glow(im, X.disc(11.5, 11.5, 10.5), (150, 220, 255), ((1, 110), (2, 50), (3, 20)), under=False)
        X.obj(im, X.disc(11.5, 11.5, 10.6), ((10, 30, 50), (16, 44, 70), (24, 60, 92), (60, 120, 160), (140, 200, 230)), K, cap=3)
        F = X.flake(11.5, 11.5, 9.6, arms=6, a0=-math.pi / 2, br=(0.42, 0.7), brl=0.55) | X.disc(11.5, 11.5, 1.8)
        X.outline(im, F, (6, 16, 28))
        X.fill(im, F, I[4])
        X.fill(im, X.disc(11.5, 11.5, 1.0), I[2])
        for k in range(6):
            a = -math.pi / 2 + k * math.pi / 3
            im.set(int(round(11.5 + 9.6 * math.cos(a))), int(round(11.5 + 9.6 * math.sin(a))), WHITE)
        halo(im, (150, 220, 255), ((1, 60), (2, 24)))
        for (x, y) in ((27, 20), (20, 28), (33, 27)):
            X.sparkle(im, x, y, WHITE, I[3], 2)
        return im

    def crest(self):
        im = Canvas(56, 22)
        I, K = self.I, self.K
        spikes = [(28, 0.0, 0, 3.4), (22.5, 3.5, -0.18, 2.8), (33.5, 3.5, 0.18, 2.8), (17.5, 7, -0.36, 2.4),
                  (38.5, 7, 0.36, 2.4), (13, 10, -0.55, 2.0), (43, 10, 0.55, 2.0), (9, 13, -0.75, 1.6), (47, 13, 0.75, 1.6)]
        for (tx, ty, a, w) in spikes[::-1]:
            S_ = X.poly([(tx - w + math.sin(a) * 2, 17), (tx + math.sin(a) * (17 - ty) * 0.6, ty),
                         (tx + w + math.sin(a) * 2, 17)])
            X.obj(im, S_, I, K, cap=2)
        band = X.poly([(8, 15), (48, 15), (46, 20), (10, 20)])
        X.obj(im, band, I, K, cap=2)
        for x in range(11, 46, 4):
            im.set(x, 17, I[4])
        X.glow(im, X.disc(28, 16.5, 3), (150, 220, 255), ((1, 160), (2, 60)), under=False)
        F = X.flake(28, 16.5, 3.4, arms=6, a0=-math.pi / 2, br=(0.6,), brl=0.5)
        X.outline(im, F, K)
        X.fill(im, F, WHITE)
        halo(im, (150, 220, 255), ((1, 70), (2, 26)))
        return im

    def tab_deco(self):
        im = Canvas(20, 8)
        I = self.I
        parts = [X.poly([(10, -0.4), (11.8, 7.5), (8.2, 7.5)]), X.poly([(6.5, 2.0), (8.3, 7.5), (5.0, 7.5)]),
                 X.poly([(13.5, 2.0), (15.0, 7.5), (11.7, 7.5)])]
        X.glow(im, set().union(*parts), (150, 220, 255), ((1, 110), (2, 40)), under=False)
        for p in parts:
            X.obj(im, p, I, self.K, cap=1)
        for x in (2, 18):
            X.sparkle(im, x, 5, WHITE, I[3], 1)
        return im

    def divider(self):
        im = Canvas(96, 7)
        I = self.I
        hbar(im, 3, 41, 3, I, self.K, 14)
        hbar(im, 54, 92, 3, I, self.K, 14)
        for x in (36, 59):
            X.obj(im, X.poly([(x, 0.6), (x + 2.2, 3), (x, 5.4), (x - 2.2, 3)]), I, self.K, cap=1)
        rows = ["...X...", ".X.X.X.", "..XXX..", "XXXOXXX", "..XXX..", ".X.X.X.", "...X..."]
        F = {(45 + i, j) for j, r in enumerate(rows) for i, ch in enumerate(r) if ch != '.'}
        X.glow(im, F, (150, 220, 255), ((1, 110),), under=False)
        X.fill(im, F, I[4])
        X.fill(im, {(48, 3)}, I[1])
        for (x, y) in ((48, 0), (48, 6), (45, 3), (51, 3)):
            im.set(x, y, WHITE)
        return im

    def texture(self):
        base = self.FILL
        f = tone(base, (19, 38, 52), (10, 23, 33))
        im = texture_from(lambda x, y: 0, f, seed=17, noise=0.5)
        rnd = random.Random(17)
        for _ in range(9):
            x, y = rnd.randrange(64), rnd.randrange(64)
            a0 = rnd.uniform(0, math.pi * 2)
            for k in range(6):
                a = a0 + k * math.pi / 3
                L = rnd.uniform(3, 6)
                wrap_line(im, x, y, int(round(x + L * math.cos(a))), int(round(y + L * math.sin(a))), (20, 39, 53))
                bx, by = x + L * 0.55 * math.cos(a), y + L * 0.55 * math.sin(a)
                for s_ in (-1, 1):
                    b = a + s_ * math.pi / 3
                    wrap_line(im, int(round(bx)), int(round(by)), int(round(bx + 1.6 * math.cos(b))),
                              int(round(by + 1.6 * math.sin(b))), (18, 36, 49))
        return im

    def particles(self):
        I = self.I
        p1 = Canvas(9, 9)
        F = X.flake(4, 4, 4, arms=6, a0=-math.pi / 2, br=(0.55,), brl=0.6)
        X.glow(p1, F, (150, 220, 255), ((1, 60),), under=False)
        X.fill(p1, F, I[3])
        X.fill(p1, X.flake(4, 4, 2, arms=6, a0=-math.pi / 2, br=(), brl=0), I[4])
        p1.set(4, 4, WHITE)
        p2 = Canvas(5, 5)
        F2 = X.flake(2, 2, 2, arms=4, a0=0, br=(), brl=0) | {(1, 1), (3, 1), (1, 3), (3, 3)}
        X.fill(p2, F2, (*I[3], 220))
        p2.set(2, 2, WHITE)
        return p1, p2


# ====================================================================== SAKURA

class Sakura(S.Sakura):
    BR = ((14, 6, 6), (36, 18, 16), (60, 32, 28), (88, 52, 44), (120, 78, 66))
    LEAFG = ((20, 50, 20), (40, 90, 36), (70, 140, 60), (120, 190, 100), (190, 230, 160))

    def bud(self, im, x, y):
        X.obj(im, X.ellipse(x, y, 1.1, 1.5), self.PK, self.K, cap=1)
        im.set(int(x), int(y) + 1, self.PK[0])

    def petal(self, im, x, y, a, c=None):
        S_ = set(X.P(X.rot([(x - 1, y), (x, y), (x + 1, y), (x, y + 1), (x - 1, y - 1)], x, y, a)))
        X.fill(im, S_, c or self.PK[2])

    def corner(self):
        im = Canvas(40, 40)
        K, b = self.K, self.BR
        top = X.thick(X.bezier([(3, 5), (12, 1), (24, 7), (39, 4)], 80), 2.4, 0.7)
        left = X.thick(X.bezier([(5, 3), (1, 13), (8, 24), (4, 39)], 80), 2.4, 0.7)
        tw1 = X.thick(X.bezier([(20, 5), (24, 11), (29, 13)]), 1.0, 0.5)
        tw2 = X.thick(X.bezier([(5, 19), (11, 23), (13, 29)]), 1.0, 0.5)
        X.group(im, [(tw1 | tw2, b), (top | left, b, 2)], K)
        for (x, y) in ((35, 7), (30, 1.6), (14, 9.5), (7, 33), (1.8, 29), (9.5, 14), (26, 14), (14, 26)):
            self.bud(im, x, y)
        for (x, y, r, pr) in ((7, 7, 3.3, 2.1), (18, 4.5, 2.6, 1.6), (4.5, 18, 2.6, 1.6), (29, 11, 2.3, 1.45),
                              (11, 29, 2.3, 1.45), (24, 2.5, 2.0, 1.3)):
            self.blossom(im, lambda p: p, x, y, r, pr)
        for (x, y, a, c) in ((21, 18, 0.5, None), (34, 15, 1.2, self.PK[3]), (16, 34, 2.0, None), (25, 25, 0.9, self.PK[3])):
            self.petal(im, x, y, a, c)
        halo(im, (255, 160, 200), ((1, 70), (2, 26)))
        return im

    def crest(self):
        im = Canvas(56, 22)
        l, v, g = self.LQ, self.VER, self.G
        for fx in (False, True):
            br = X.thick(X.bezier([(15, 13), (9, 9), (4, 11), (1, 7)]), 1.0, 0.5)
            X.group(im, [(X.mirror_x(br, 56) if fx else br, self.BR)], self.K)
            for (x, y, r, pr) in ((9, 9.5, 2.4, 1.5), (3.5, 12, 2.0, 1.3), (14, 16, 2.0, 1.3)):
                self.blossom(im, lambda p: p, 55 - x if fx else x, y, r, pr)
            self.bud(im, 52.5 if fx else 2.5, 5.5)
        for x0 in (18, 36):
            X.obj(im, X.rect(x0, 5, x0 + 1, 21), v, self.K, cap=1)
        X.obj(im, X.rect(16, 9, 39, 10), v, self.K, cap=1)
        kas = set()
        for x in range(13, 43):
            e = min(x - 13, 42 - x)
            lift = max(0, 3 - e) * 0.9
            for y in range(int(round(2 - lift)), int(round(5 - lift * 0.3))):
                kas.add((x, y))
        X.obj(im, kas, l, self.K, cap=2)
        X.fill(im, {(x, 2) for x in range(16, 40)}, l[4])
        X.obj(im, X.rect(26, 5, 29, 9), g, self.K, cap=1)
        halo(im, (255, 160, 200), ((1, 60), (2, 22)))
        return im

    def tab_deco(self):
        im = Canvas(20, 8)
        X.group(im, [(X.thick(X.bezier([(1, 6), (10, 4), (19, 6)]), 0.5), self.BR)], self.K)
        self.bud(im, 4, 4.5)
        self.bud(im, 16, 4.5)
        self.blossom(im, lambda p: p, 10, 3.6, 2.0, 1.35)
        return im

    def divider(self):
        im = Canvas(96, 7)
        b = self.BR
        for x in range(4, 92):
            e = min(x - 4, 91 - x)
            y = 3 + (1 if 20 < x < 34 or 62 < x < 76 else 0)
            a = 255 if e > 10 else 70 + 18 * e
            im.blend(x, y, b[3], a)
            im.blend(x, y + 1, self.K, a)
        for x in (22, 74):
            self.bud(im, x, 2.5)
        for x in (34, 62):
            self.blossom(im, lambda p: p, x, 3, 1.3, 1.0)
        self.blossom(im, lambda p: p, 48, 3.3, 2.0, 1.35)
        return im

    def texture(self):
        base = self.FILL
        f = tone(base, (42, 18, 38), (30, 11, 27))

        def fn(x, y):
            best = None
            for j in range(-1, 6):
                cy = j * 8 + 8
                off = 8 if j % 2 else 0
                for i in range(-1, 5):
                    cx = i * 16 + off
                    dx, dy = wvec(x, y, cx, cy)
                    if dy > 0.5:
                        continue
                    r = math.hypot(dx, dy)
                    if r < 8.5:
                        if best is None or cy > best[0]:
                            best = (cy, r)
            if best is None:
                return 0
            r = best[1]
            return 0.75 if (r % 2.8) < 0.9 else 0
        return texture_from(fn, f, seed=19, noise=0.25)

    def particles(self):
        p1 = Canvas(7, 6)
        S_ = X.ellipse(3, 3, 2.8, 2.0) - {(6, 2), (6, 3), (5, 3)}
        X.bevel(p1, S_, self.PK, 1)
        p1.set(1, 2, self.PK[4])
        p2 = Canvas(5, 5)
        S2 = X.ellipse(2, 2, 2.0, 1.4)
        X.fill(p2, S2, (255, 240, 246, 230))
        p2.set(1, 1, WHITE)
        p2.set(3, 3, (230, 200, 214))
        return p1, p2


# ====================================================================== SHADOW

class Shadow(S.Shadow):
    OBS = ((10, 6, 20), (26, 18, 46), (48, 34, 80), (96, 74, 150), (190, 160, 255))

    def shard_set(self, im, parts):
        o, v = self.OBS, self.V
        U = set().union(*parts)
        X.glow(im, U, v[2], ((1, 190), (2, 100), (3, 40)), under=False)
        for p in parts:
            X.outline(im, p, v[3])
            X.bevel(im, p, o, 2)

    def corner(self):
        im = Canvas(40, 40)
        v, cr = self.V, self.CR
        tendril(im, [(8, 6), (17, 0), (27, 9), (36, 3)], 3.8, 1.2, v[1], v[3], 210,
                X.spiral(34.5, 6.6, 3.3, 0.4, -math.pi / 2, 0.95, 30), dark=v[0])
        tendril(im, [(6, 8), (0, 17), (9, 27), (3, 36)], 3.8, 1.2, v[1], v[3], 210,
                X.spiral(6.6, 34.5, 3.3, 0.4, math.pi, -0.95, 30), dark=v[0])
        tendril(im, [(12, 12), (21, 14), (25, 22), (19, 26)], 2.6, 0.8, v[1], v[2], 190, dark=v[0])
        sh = [X.shard(2, 9, 0.2, 18, 2.8), X.shard(9, 2, math.pi / 2 - 0.2, 18, 2.8),
              X.shard(4, 16, 0.75, 11, 2.2), X.shard(16, 4, math.pi / 2 - 0.75, 11, 2.2),
              X.crystal(13, 13, math.pi / 4, 15.5, 6.2, back=0.4)]
        self.shard_set(im, sh)
        for q in X.line(4, 4, 22, 22):
            if q in sh[-1]:
                im.set(q[0], q[1], self.OBS[3])
        orb = X.disc(13, 13, 4.3)
        X.glow(im, orb, v[2], ((1, 230), (2, 130), (3, 50)), under=False)
        X.obj(im, orb, (self.O[0], self.O[0], self.O[1], self.O[2], v[1]), self.K, mode='ball')
        X.fill(im, X.ellipse(13, 13, 3.2, 1.6), cr[2])
        X.fill(im, X.ellipse(13, 13, 1.4, 0.9), cr[3])
        X.fill(im, {(13, 12), (13, 13), (13, 14)}, self.K)
        im.set(14, 12, cr[4])
        for (x, y) in ((30, 17), (17, 30), (26, 29)):
            X.glow(im, {(x, y)}, cr[2], ((1, 120),), under=False)
            im.set(x, y, cr[3])
        return im

    def crest(self):
        im = Canvas(56, 22)
        o, v, cr = self.O, self.V, self.CR
        for fx in (False, True):
            c1 = [(19, 13), (12, 18), (5, 12), (8.5, 6.5)]
            sp = X.spiral(9, 9.4, 2.9, 0.3, -math.pi * 0.85, 0.9, 20)
            if fx:
                c1 = [(55 - x, y) for (x, y) in c1]
                sp = [(55 - x, y) for (x, y) in sp]
            tendril(im, c1, 3.0, 1.0, v[1], v[3], 210, sp, dark=v[0])
        parts = [X.shard(x, 7.8, a, L, 1.9) for (x, a, L) in
                 ((22, -math.pi / 2 - 0.5, 6.5), (34, -math.pi / 2 + 0.5, 6.5), (28, -math.pi / 2, 8))]
        self.shard_set(im, parts)
        eye = X.poly([(16.5, 13), (22, 8.5), (28, 7.2), (34, 8.5), (39.5, 13), (34, 17.5), (28, 18.8), (22, 17.5)])
        X.glow(im, eye, v[2], ((1, 220), (2, 120), (3, 50)), under=False)
        X.outline(im, eye, self.K)
        X.fill(im, eye, (44, 20, 72))
        X.fill(im, X.ellipse(28, 13, 9.5, 4.0) & eye, (76, 32, 120))
        X.obj(im, X.disc(28, 13, 4.0), (cr[0], cr[1], cr[2], cr[3], cr[4]), None, mode='ball')
        X.fill(im, {(28, y) for y in range(10, 17)} | {(27, 12), (27, 13), (27, 14)}, self.K)
        im.set(26, 11, (255, 230, 240))
        return im

    def tab_deco(self):
        im = Canvas(20, 8)
        v, cr = self.V, self.CR
        eye = X.poly([(4, 4), (7, 1.5), (10, 1), (13, 1.5), (16, 4), (13, 6.5), (10, 7), (7, 6.5)])
        X.glow(im, eye, v[2], ((1, 160),), under=False)
        X.outline(im, eye, self.K)
        X.fill(im, eye, (60, 26, 100))
        X.fill(im, X.disc(10, 4, 1.8), cr[2])
        X.fill(im, {(10, 3), (10, 4), (10, 5)}, self.K)
        im.set(9, 3, cr[4])
        return im

    def divider(self):
        im = Canvas(96, 7)
        o, v, cr = self.O, self.V, self.CR
        for x in range(2, 94):
            e = min(x - 2, 93 - x)
            a = 255 if e > 16 else 30 + 14 * e
            wob = int(round(0.8 * math.sin(x * 0.35))) if e < 16 else 0
            im.blend(x, 3 + wob, v[3] if e > 16 else v[2], a)
            im.blend(x, 2 + wob, v[1], a // 3)
            im.blend(x, 4 + wob, v[1], a // 3)
        d = X.poly([(48, -0.5), (52, 3), (48, 6.5), (44, 3)]) | X.poly([(47, -0.5), (51, 3), (47, 6.5), (43, 3)])
        X.glow(im, d, v[2], ((1, 140),), under=False)
        X.outline(im, d, v[3])
        X.bevel(im, d, o, 2)
        X.fill(im, {(47, 3), (48, 3), (47, 2), (48, 4)}, cr[3])
        return im

    def texture(self):
        base = self.FILL
        f = tone(base, (17, 11, 29), (8, 5, 14))
        nz = X.tile_noise(64, 64, 32, 41, 3)
        nz2 = X.tile_noise(64, 64, 16, 42, 2)

        def fn(x, y):
            v = (nz[y][x] - 0.5) * 1.6
            r = abs(nz2[y][x] - 0.5)
            if r < 0.022:
                return (19, 11, 34)
            return v
        return texture_from(fn, f, seed=41, noise=0.2)

    def particles(self):
        v = self.V
        p1 = Canvas(9, 9)
        for (cx, cy, r, a) in ((4, 5, 3.2, 70), (3, 4, 2.4, 90), (5.5, 3.5, 2.0, 90), (4, 4.5, 1.4, 120)):
            for q in X.disc(cx, cy, r):
                p1.blend(q[0], q[1], v[2] if r < 2 else v[1], a)
        p1.blend(3, 3, v[4], 160)
        p2 = Canvas(5, 5)
        S2 = X.disc(2, 2, 1.6)
        X.outline(p2, S2, v[2])
        X.fill(p2, S2, (8, 4, 16))
        X.fill(p2, X.border_of(S2) & {(0, 0), (4, 0), (0, 4), (4, 4)}, (0, 0, 0, 0))
        p2.set(1, 1, v[3])
        return p1, p2

WHITE = (255, 255, 255)

DECOR_CLASSES = {'royal': Royal, 'sylvan': Sylvan, 'forge': Forge, 'arcane': Arcane, 'necro': Necro,
                 'desert': Desert, 'frost': Frost, 'sakura': Sakura, 'shadow': Shadow}


def make_decor(theme):
    D = DECOR_CLASSES[theme]()
    p1, p2 = D.particles()
    return {'corner': D.corner(), 'crest': D.crest(), 'tab_deco': D.tab_deco(), 'divider': D.divider(),
            'texture': D.texture(), 'particle1': p1, 'particle2': p2}
