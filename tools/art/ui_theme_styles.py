"""Les 9 styles de thème (cadres 9-slice). Voir ui_theme_base.Base pour la structure commune."""
import math

import ui_px as X
from ui_px import lerp
from ui_theme_base import (Base, SQ, CUT, RND, framed, paint, vgrad, band, dup_row, glow_rings, clean_mid,
                           side_set, SIDES, M4)

WHITE = (255, 255, 255)


# ====================================================================== ROYAL

class Royal(Base):
    """Velours bleu nuit, moulure d'or à perles et pirouettes, rubis et saphirs."""
    K = (5, 8, 26)
    n0, n1, n2, n3 = (9, 15, 40), (14, 24, 62), (22, 36, 88), (34, 56, 122)
    G = ((84, 48, 10), (160, 108, 34), (214, 164, 64), (248, 214, 112), (255, 246, 200))
    M = G
    A = ((70, 10, 26), (120, 20, 44), (170, 34, 60), (222, 74, 96))       # velours cramoisi
    RUBY = ((70, 6, 20), (150, 18, 44), (214, 46, 70), (255, 120, 130), (255, 214, 214))
    SAPH = ((10, 20, 70), (24, 60, 160), (60, 130, 240), (140, 200, 255), (230, 246, 255))
    GLOW = (70, 96, 170)
    FILL = (14, 24, 62)
    ALT_FILL = (20, 32, 80)
    SLOT_FILL = (9, 16, 44)
    TIP_FILL = (12, 20, 54, 244)
    TAB_OFF = (20, 32, 78)
    TAB_ON = {3: (60, 104, 200), 8: (32, 58, 140)}
    PROF = {'panel': RND[3], 'alt': RND[2], 'tab': RND[3], 'btn': RND[2], 'badge': RND[3], 'slot': RND[2],
            'tip': RND[2]}
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

    def pal(self):
        g0, g1, g2, g3, g4 = self.G
        return {'o': g0, 'd': g1, 'g': g2, 'h': g3, 'w': g4, 'K': self.K}

    def gem(self, im, m, cx, cy, r, ramp):
        S = m(X.disc(cx, cy, r))
        X.obj(im, S, ramp, self.K)
        # reflet blanc : pixel le plus haut-gauche
        p = min(S, key=lambda q: q[0] + q[1])
        im.set(p[0] + 1, p[1] + 1 if r > 1.6 else p[1], ramp[-1])

    def band_panel(self, im):
        # perles et pirouettes (bead & reel) dans la moulure, période 8 (x2 dans 16)
        band(im, ["owhohwwhowhohwwh", "ohdodggdohdodggd"], self.pal(), a0=2)

    def orn_panel(self, im, m):
        g = self.G
        # bras en fer de lance le long de la moulure
        for S in (X.thick(X.bezier([(9, 3.5), (12, 3.5), (15, 3.2)]), 1.1, 0.6),
                  X.thick(X.bezier([(3.5, 9), (3.5, 12), (3.2, 15)]), 1.1, 0.6)):
            X.obj(im, m(S), g, self.K)
        # volutes intérieures
        for pts in (X.spiral(11.5, 9, 0.6, 2.4, math.pi, 0.85, 30), X.spiral(9, 11.5, 0.6, 2.4, -math.pi / 2, -0.85, 30)):
            S = X.P(pts)
            X.outline(im, m(S), self.K)
            X.fill(im, m(S), g[3])
        # rosette d'or + rubis
        X.obj(im, m(X.disc(5.5, 5.5, 5.2)), g, self.K)
        X.fill(im, m(X.ring(5.5, 5.5, 3.2, 4.0)), g[1])
        self.gem(im, m, 5.5, 5.5, 2.6, self.RUBY)

    def orn_alt(self, im, m):
        g = self.G
        S = X.thick(X.bezier([(7, 2.5), (9, 2.5)]), 0.6) | X.thick(X.bezier([(2.5, 7), (2.5, 9)]), 0.6)
        X.obj(im, m(S), g, self.K)
        X.obj(im, m(X.disc(3.5, 3.5, 3.2)), g, self.K)
        self.gem(im, m, 3.5, 3.5, 1.5, self.SAPH)

    def orn_tab(self, im, m, active):
        g = self.G
        if active:
            X.obj(im, m(X.poly([(0, 0), (7.5, 0), (0, 7.5)])), g, self.K)
            self.gem(im, m, 2.5, 2.5, 1.3, self.RUBY)
        else:
            X.obj(im, m(X.poly([(0, 0), (5.5, 0), (0, 5.5)])), (g[0], g[1], g[1], g[2], g[2]), self.K)

    def orn_slot(self, im, m):
        X.obj(im, m(X.disc(2.5, 2.5, 2.1)), self.G, self.K)
        im.set(*next(iter(m({(2, 2)}))), self.SAPH[3])

    def orn_tip(self, im, m):
        X.obj(im, m(X.poly([(0, 0), (6.5, 0), (0, 6.5)])), self.G, self.K)
        self.gem(im, m, 2.2, 2.2, 1.0, self.RUBY)

    def orn_btn(self, im, m, k):
        p = next(iter(m({(2, 2)})))
        im.set(p[0], p[1], self.G[4])

    def btn_rim(self, k):
        g = self.G
        return (g[1], g[0], g[1]) if k == 'gold' else (g[3], g[1], g[2])

    def badge(self, k):
        o, sh, base, hi = self.BADGE[k]
        g = self.G
        rim = (g[2], g[0], g[1]) if k == 'gold' else (g[3], g[1], g[2])
        return framed(12, 12, self.PROF['badge'], [self.K, rim, (hi, sh, base)], base)

    def header(self):
        g = self.G
        im = X.Canvas(48, 24)
        # plaque de velours : corps + médaillons losanges aux bouts
        body = X.rect(6, 3, 41, 20)
        m = [[(x, y) in body for x in range(48)] for y in range(24)]
        grad = vgrad({5: (70, 116, 220), 9: (42, 82, 180), 13: (26, 52, 130), 19: (12, 22, 70)})
        paint(im, m, [self.K, (g[4], g[1], g[3]), (g[2], g[2], g[2]), (g[1], g[3], g[2]), self.K,
                      (self.A[3], self.A[1], self.A[2]), self.K], grad)
        # perles d'or sur la moulure (uniformes en x) : ligne lumineuse
        for cx in (6, 41):
            S = X.poly([(cx, 2), (cx + 7.6, 11.5), (cx, 21), (cx - 7.6, 11.5)])
            S = {p for p in S if 0 <= p[0] < 48}
            X.obj(im, S, g, self.K)
            inner = X.poly([(cx, 5), (cx + 5.2, 11.5), (cx, 18), (cx - 5.2, 11.5)])
            X.obj(im, inner, (self.n0, self.n1, self.n2, self.n3, self.n3), g[0])
            gem = X.poly([(cx, 7.6), (cx + 3.2, 11.5), (cx, 15.4), (cx - 3.2, 11.5)])
            X.obj(im, gem, self.RUBY, self.K)
            im.set(cx - 1, 10, self.RUBY[4])
            im.set(cx, 9, self.RUBY[4])
        clean_mid(im)
        return dup_row(im, 11)



def vine_rows(depth, period=16, amp=1.2, leaves=((3, -1), (11, 1)), grain=()):
    """Bande de liane ondulante (+ feuilles) : renvoie rows[depth] de longueur period."""
    g = [['.'] * period for _ in range(depth)]
    mid = (depth - 1) / 2.0
    for t in range(period):
        r = int(round(mid + amp * math.sin(2 * math.pi * t / period)))
        g[max(0, min(depth - 1, r))][t] = 'v'
    for (t, side) in leaves:
        r = int(round(mid + amp * math.sin(2 * math.pi * t / period)))
        for k, ch in ((0, 'L'), (1, 'l')):
            rr = r + side * (1 if k == 0 else 1)
            tt = t + k
            if 0 <= rr < depth:
                g[rr][tt % period] = ch
        rr = r + 2 * side
        if 0 <= rr < depth:
            g[rr][(t + 1) % period] = 'L'
    for (t, r) in grain:
        if g[r][t] == '.':
            g[r][t] = 'y'
    return [''.join(row) for row in g]


# ====================================================================== SYLVAN

class Sylvan(Base):
    """Bois noueux vivant : écorce, cernes, liane feuillue, baies rouges, lueur de mousse."""
    K = (16, 10, 6)
    W = ((44, 26, 12), (74, 44, 20), (106, 66, 30), (140, 92, 44), (178, 126, 68))
    L = ((10, 38, 14), (28, 82, 30), (58, 132, 44), (108, 182, 70), (186, 230, 124))
    AUT = ((70, 20, 6), (150, 54, 12), (214, 104, 24), (246, 168, 60), (255, 222, 140))
    BERRY = ((60, 4, 14), (140, 16, 36), (210, 40, 56), (255, 120, 120), (255, 220, 220))
    M = W
    A = ((14, 44, 16), (40, 96, 36), (76, 150, 52), (150, 214, 96))
    GLOW = (60, 130, 56)
    FILL = (14, 32, 18)
    ALT_FILL = (20, 42, 24)
    SLOT_FILL = (12, 24, 14)
    TIP_FILL = (12, 28, 16, 244)
    TAB_OFF = (22, 40, 24)
    TAB_ON = {3: (56, 116, 50), 8: (30, 70, 34)}
    PROF = {'panel': RND[2], 'alt': RND[2], 'tab': RND[2], 'btn': RND[2], 'badge': RND[3], 'slot': RND[2],
            'tip': RND[2]}
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

    def mold(self):
        w0, w1, w2, w3, w4 = self.W
        return [(w4, w1, w3), (w3, w1, w2), (w2, w2, w2), (w1, w3, w2), (w0, w2, w1)]

    def band_panel(self, im):
        rows = vine_rows(4, grain=((0, 0), (1, 0), (6, 3), (7, 3), (8, 3), (13, 0), (14, 0)))
        pal = {'v': self.L[1], 'L': self.L[3], 'l': self.L[2], 'y': self.W[1]}
        band(im, rows, pal, a0=1)

    def log(self, im, cx, cy, r, mapf=lambda p: p):
        w = self.W
        X.outline(im, mapf(X.disc(cx, cy, r)), self.K)
        X.bevel(im, mapf(X.disc(cx, cy, r)), (w[1], w[2], w[3], w[4], w[4]), 1)
        for rr, c in ((r - 1.6, w[1]), (r - 3.0, w[2]), (r - 4.2, w[1])):
            if rr > 0.6:
                X.fill(im, mapf(X.ring(cx, cy, rr - 0.7, rr)), c)
        X.fill(im, mapf({(int(cx), int(cy))}), w[0])

    def leafy(self, im, S, ramp=None):
        X.obj(im, S, ramp or self.L, self.K)

    def orn_panel(self, im, m):
        self.log(im, 6, 6, 6.2, m)
        self.leafy(im, m(X.leaf(11, 4, -0.15, 5.5, 1.7)))
        self.leafy(im, m(X.leaf(4, 11, 1.72, 5.5, 1.7)))
        self.leafy(im, m(X.leaf(10, 9, 0.75, 5.0, 1.6)), self.AUT)
        for (bx, by) in ((12, 12), (14, 11)):
            X.obj(im, m(X.disc(bx, by, 1.1)), self.BERRY, self.K, mode='ball')

    def orn_alt(self, im, m):
        self.log(im, 3.5, 3.5, 3.6, m)
        self.leafy(im, m(X.leaf(6, 6, 0.78, 3.6, 1.2)))

    def orn_tab(self, im, m, active):
        if active:
            self.leafy(im, m(X.leaf(1, 1, 0.78, 6.5, 2.0)))
        else:
            X.obj(im, m(X.disc(2.5, 2.5, 1.6)), self.W, self.K)

    def orn_slot(self, im, m):
        self.leafy(im, m(X.leaf(1, 1, 0.78, 4.5, 1.3)))

    def orn_tip(self, im, m):
        self.leafy(im, m(X.leaf(1, 1, 0.78, 6.0, 1.8)))

    def btn_rim(self, k):
        w = self.W
        return (w[3], w[0], w[2])

    def badge(self, k):
        o, sh, base, hi = self.BADGE[k]
        prof = ([4, 2, 1, 1], [1], [1], [4, 2, 1, 1])  # feuille
        im = framed(12, 12, prof, [self.K, (hi, sh, base)], base)
        for q in ((2, 9), (3, 8), (8, 3), (9, 2)):
            im.set(q[0], q[1], lerp(base, hi, .45))
        return im

    def header(self):
        w, l = self.W, self.L
        im = X.Canvas(48, 24)
        m = [[(5 <= x <= 42 and 4 <= y <= 19) for x in range(48)] for y in range(24)]
        grad = vgrad({7: (40, 84, 40), 12: (26, 58, 28), 18: (14, 34, 18)})
        paint(im, m, [self.K, (w[4], w[1], w[3]), (w[3], w[1], w[2]), (w[1], w[3], w[2]), self.K,
                      (self.A[1], self.A[0], self.A[0])], grad)
        for cx in (6.5, 40.5):
            self.log(im, cx, 11.5, 6.4)
            fx = cx > 20
            for (x0, y0, a) in ((cx + (-3 if fx else 3), 5.5, -1.2 if not fx else -1.94),
                                (cx + (-3 if fx else 3), 17.5, 1.2 if not fx else 1.94)):
                self.leafy(im, X.leaf(x0, y0, a, 5.0, 1.6))
            X.obj(im, X.disc(cx + (-5 if fx else 5), 3.2, 1.1), self.BERRY, self.K, mode='ball')
        clean_mid(im)
        return dup_row(im, 11)


# ====================================================================== FORGE

class Forge(Base):
    """Fer forgé lourd : plaques rivetées, boulons, filet de braise incandescente."""
    K = (8, 6, 6)
    I = ((26, 24, 26), (46, 44, 48), (70, 68, 74), (104, 102, 110), (160, 158, 166))
    C = ((64, 26, 8), (134, 64, 24), (194, 108, 50), (240, 166, 96))
    E = ((110, 24, 4), (200, 70, 12), (255, 140, 30), (255, 210, 90), (255, 248, 200))
    M = I
    A = (E[0], E[1], E[2], E[3])
    GLOW = (150, 56, 14)
    FILL = (26, 20, 18)
    ALT_FILL = (34, 26, 22)
    SLOT_FILL = (16, 12, 12)
    TIP_FILL = (24, 18, 16, 244)
    TAB_OFF = (36, 28, 24)
    TAB_ON = {3: (84, 56, 40), 8: (52, 34, 26)}
    PROF = {'panel': SQ, 'alt': CUT(1), 'tab': CUT(2), 'btn': CUT(1), 'badge': CUT(1), 'slot': SQ,
            'tip': CUT(1)}
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

    def mold(self):
        i0, i1, i2, i3, i4 = self.I
        return [(i4, i1, i3), (i3, i1, i2), (i2, i1, i2), (i2, i2, i2), (i1, i3, i1)]

    def acc(self):
        e = self.E
        return (e[3], e[2], e[3])

    def gl(self, n, fill=None, s=0.55):
        return glow_rings(fill or self.FILL, self.GLOW, n, .6, 1.8)

    def band_panel(self, im):
        i0, i1, i2, i3, i4 = self.I
        rows = ["Kh.....hw.....d.",
                "Kh....hwgd....d.",
                "Kh....hgdd....d.",
                "Kh.....dd.....d.",
                "Kh............d."]
        band(im, rows, {'K': self.K, 'h': i3, 'w': i4, 'g': i2, 'd': i0}, a0=1)

    def bolt(self, im, S):
        X.obj(im, S, self.I, self.K, cap=1)

    def orn_panel(self, im, m):
        i0, i1, i2, i3, i4 = self.I
        plate = X.rect(0, 0, 13, 13) - X.poly([(9, 14), (14, 9), (14, 14)])
        X.outline(im, m(plate), self.K)
        X.bevel(im, m(plate), (i0, i1, i2, i3, i4), 2)
        hexb = X.poly([(6.5 + 3.8 * math.cos(a), 6.5 + 3.8 * math.sin(a)) for a in
                       [k * math.pi / 3 + math.pi / 6 for k in range(6)]])
        X.obj(im, m(hexb), (i0, i1, i3, i4, (220, 220, 228)), self.K, cap=1)
        X.fill(im, m(X.disc(6.5, 6.5, 1.3)), self.E[2])
        X.fill(im, m({(6, 6)}), self.E[4])
        X.glow(im, m(X.disc(6.5, 6.5, 1.3)), self.E[2], ((1, 110),), under=False)
        for (x, y) in ((11, 2), (2, 11)):
            X.obj(im, m(X.disc(x, y, 1.0)), self.I, self.K, cap=1)

    def orn_alt(self, im, m):
        i = self.I
        X.obj(im, m(X.rect(0, 0, 8, 8) - X.poly([(5, 9), (9, 5), (9, 9)])), i, self.K)
        X.obj(im, m(X.disc(4, 4, 1.7)), i, self.K, cap=1)
        X.fill(im, m({(4, 4)}), self.E[2])

    def orn_tab(self, im, m, active):
        X.obj(im, m(X.disc(3, 3, 1.2)), self.I, self.K, cap=1)
        if active:
            X.fill(im, m({(3, 3)}), self.E[3])

    def orn_btn(self, im, m, k):
        p = next(iter(m({(2, 2)})))
        im.set(p[0], p[1], self.BTN[k][4])
        q = next(iter(m({(3, 3)})))
        im.set(q[0], q[1], self.BTN[k][0])

    def orn_slot(self, im, m):
        X.obj(im, m(X.disc(2, 2, 1.1)), self.I, self.K, cap=1)

    def orn_tip(self, im, m):
        X.obj(im, m(X.disc(2.5, 2.5, 1.3)), self.I, self.K, cap=1)

    def btn_rim(self, k):
        i = self.I
        return (i[3], i[0], i[2])

    def button(self, k):
        o, sh, base, lt, hi = self.BTN[k]
        i = self.I
        rings = [self.K, (i[3], i[0], i[2]), (hi, o, lt), (lt, sh, base)]
        im = framed(16, 16, self.PROF['btn'], rings, base)
        for x in range(2, 14):        # flanc épais en bas
            im.set(x, 12, sh)
        self.each(im, self.orn_btn, k, clip=5)
        self.glint(im, k)
        return im

    def tab(self, active):
        im = super().tab(active)
        if active:
            e = self.E
            for x in range(8, 24):
                im.set(x, 26, e[1])
                im.set(x, 27, e[2])
            for y in range(26, 28):
                for x in range(4, 8):
                    im.set(x, y, lerp(e[1], im.px[y][3][:3], (8 - x) / 5))
                    im.set(31 - x, y, im.px[y][x])
        return im

    def header(self):
        i0, i1, i2, i3, i4 = self.I
        e = self.E
        im = X.Canvas(48, 24)
        m = [[(3 <= x <= 44 and 2 <= y <= 21) or (6 <= y <= 17 and (x <= 2 or x >= 45)) for x in range(48)]
             for y in range(24)]
        grad = vgrad({6: (64, 46, 36), 12: (44, 32, 26), 18: (26, 18, 16)})
        paint(im, m, [self.K, (i4, i1, i3), (i3, i1, i2), (i2, i2, i2), (i1, i3, i2), self.K,
                      (e[3], e[2], e[3]), self.K], grad)
        for x in range(10, 38):
            im.set(x, 16, e[0])
        for (fx) in (False, True):
            br = X.rect(0, 1, 11, 22) - X.poly([(12, 6), (8, 1), (12, 1)]) - X.poly([(12, 17), (8, 22), (12, 22)])
            if fx:
                br = X.mirror_x(br, 48)
            X.obj(im, br, (i0, i1, i2, i3, i4), self.K, cap=2)
            cx = 40.5 if fx else 6.5
            for cy in (5.5, 17.5):
                hexb = X.poly([(cx + 2.6 * math.cos(a), cy + 2.6 * math.sin(a)) for a in
                               [k * math.pi / 3 + math.pi / 6 for k in range(6)]])
                X.obj(im, hexb, (i0, i1, i3, i4, (220, 220, 228)), self.K, cap=1)
            core = X.poly([(cx, 8.5), (cx + 2.5, 11.5), (cx, 14.5), (cx - 2.5, 11.5)])
            X.obj(im, core, (e[0], e[1], e[2], e[3], e[4]), self.K, cap=2)
        clean_mid(im)
        return dup_row(im, 11)


# ====================================================================== ARCANE

def rune_rows():
    return ["..cC.....Cc.....",
            "..C.c...c.C..c..",
            "..cC.....Cc....."]


class Arcane(Base):
    """Argent runique sur velours violet : runes cyan lumineuses, cristaux, étoiles."""
    K = (8, 4, 20)
    V = ((16, 8, 34), (26, 14, 54), (38, 22, 76), (58, 36, 108), (84, 58, 150))
    S = ((52, 50, 84), (92, 96, 124), (142, 148, 178), (198, 204, 228), (246, 248, 255))
    CY = ((10, 50, 90), (24, 112, 156), (64, 206, 236), (150, 240, 255), (230, 255, 255))
    MAG = ((60, 10, 70), (130, 40, 160), (200, 90, 230), (240, 170, 255), (255, 230, 255))
    M = S
    A = (CY[0], CY[1], CY[2], CY[3])
    GLOW = (100, 70, 200)
    FILL = (24, 13, 50)
    ALT_FILL = (32, 18, 64)
    SLOT_FILL = (14, 8, 32)
    TIP_FILL = (18, 10, 40, 244)
    TAB_OFF = (30, 18, 60)
    TAB_ON = {3: (80, 52, 150), 8: (46, 28, 96)}
    PROF = {'panel': CUT(4), 'alt': CUT(3), 'tab': CUT(3), 'btn': CUT(3), 'badge': CUT(3), 'slot': CUT(3),
            'tip': CUT(2)}
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

    def mold(self):
        s, v = self.S, self.V
        return [(s[4], s[1], s[3]), (s[2], s[1], s[2]), (v[0], v[0], v[0]), (v[1], v[1], v[1]),
                (v[0], v[0], v[0]), (s[1], s[3], s[2])]

    def panel(self):
        rings = [self.K] + self.mold() + [self.K, (self.CY[3], self.CY[2], self.CY[3])] + \
            [lerp(self.FILL, self.CY[2], .35), lerp(self.FILL, self.GLOW, .5), lerp(self.FILL, self.GLOW, .3),
             lerp(self.FILL, self.GLOW, .15), lerp(self.FILL, self.GLOW, .06)]
        im = framed(48, 48, self.PROF['panel'], rings, self.FILL)
        self.band_panel(im)
        self.each(im, self.orn_panel, clip=16)
        return im

    def band_panel(self, im):
        band(im, rune_rows(), {'c': self.CY[2], 'C': self.CY[3]}, a0=3)

    def medallion(self, im, m, cx, cy, r, big=True):
        s, v = self.S, self.V
        X.obj(im, m(X.disc(cx, cy, r)), s, self.K, cap=1)
        X.fill(im, m(X.disc(cx, cy, r - 1.4)), v[0])
        X.fill(im, m(X.disc(cx, cy, r - 2.2)), v[2])
        cr = X.crystal(cx, cy, -math.pi / 4, r - 1.6, (r - 1.6) * 0.5)
        X.obj(im, m(cr), self.CY, self.K, cap=2)

    def orn_panel(self, im, m):
        self.medallion(im, m, 6.5, 6.5, 6.4)
        for (x, y) in ((13, 3), (3, 13)):
            X.fill(im, m({(x, y)}), self.CY[4])
            X.fill(im, m({(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)}), self.CY[1])

    def orn_alt(self, im, m):
        self.medallion(im, m, 4, 4, 3.8)

    def orn_tab(self, im, m, active):
        c = self.CY if active else (self.V[1], self.V[2], self.S[1], self.S[2], self.S[3])
        X.obj(im, m(X.crystal(3, 3, -math.pi / 4, 3.2, 1.6)), c, self.K, cap=1)

    def orn_slot(self, im, m):
        X.fill(im, m({(4, 4)}), self.CY[3])
        X.fill(im, m({(3, 4), (4, 3)}), self.CY[1])

    def orn_tip(self, im, m):
        X.obj(im, m(X.crystal(3, 3, -math.pi / 4, 2.6, 1.3)), self.CY, self.K, cap=1)

    def btn_rim(self, k):
        s = self.S
        return (s[3], s[1], s[2])

    def header(self):
        s, c = self.S, self.CY
        im = X.Canvas(48, 24)
        m = [[False] * 48 for _ in range(24)]
        for y in range(3, 21):
            d = abs(y - 11.5)
            for x in range(48):
                if 7 + max(0, d - 5) * 0.8 <= x <= 40 - max(0, d - 5) * 0.8:
                    m[y][x] = True
        grad = vgrad({6: (88, 58, 160), 11: (52, 32, 106), 18: (26, 14, 56)})
        paint(im, m, [self.K, (s[4], s[1], s[3]), (s[2], s[1], s[2]), self.K, (c[3], c[1], c[2]), self.K], grad)
        for cx in (6.5, 40.5):
            X.obj(im, X.disc(cx, 11.5, 6.6), s, self.K, cap=1)
            X.fill(im, X.disc(cx, 11.5, 5.2), self.V[0])
            X.fill(im, X.ring(cx, 11.5, 3.6, 4.3), c[1])
            cr = X.crystal(cx, 11.5, -math.pi / 2, 5.6, 2.4, back=0.5)
            X.glow(im, cr, c[2], ((1, 120),), under=False)
            X.obj(im, cr, c, self.K, cap=2)
        clean_mid(im)
        return dup_row(im, 11)


# ====================================================================== NECRO

class Necro(Base):
    """Os et vertèbres, crânes aux yeux verts, ichor vert luminescent qui suinte."""
    K = (6, 6, 8)
    B = ((72, 64, 50), (126, 114, 90), (176, 164, 136), (216, 206, 178), (246, 240, 220))
    ICH = ((16, 50, 18), (36, 110, 32), (84, 192, 62), (160, 250, 110), (226, 255, 196))
    M = B
    A = (ICH[0], ICH[1], ICH[2], ICH[3])
    GLOW = (50, 150, 50)
    FILL = (16, 20, 18)
    ALT_FILL = (22, 26, 24)
    SLOT_FILL = (10, 12, 12)
    TIP_FILL = (14, 18, 16, 244)
    TAB_OFF = (24, 28, 26)
    TAB_ON = {3: (40, 70, 42), 8: (22, 38, 24)}
    PROF = {'panel': SQ, 'alt': SQ, 'tab': RND[1], 'btn': ([4, 2, 1, 1], [4, 2, 1, 1], [1], [1]),
            'badge': ([3, 1, 1], [3, 1, 1], [], []), 'slot': SQ, 'tip': SQ}
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

    def mold(self):
        b = self.B
        return [(b[3], b[1], b[2]), (b[4], b[2], b[3]), (b[3], b[3], b[3]), (b[2], b[4], b[3]), (b[1], b[3], b[2])]

    def band_panel(self, im):
        b = self.B
        rows = ["Kw.....sKw.....s",
                "Kw......Kw......",
                "Kw......Kw......",
                "K......sK......s",
                "K......sK......s"]
        band(im, rows, {'K': b[0], 'w': b[4], 's': b[1]}, a0=1)
        # gouttes d'ichor (bord haut seulement : elles pendent)
        drip = ["....X...........", "....X.......x...", "....x...........", "....o..........."]
        band(im, drip, {'X': self.ICH[3], 'x': self.ICH[2], 'o': self.ICH[1]}, a0=8, sides=('top',))

    def skull(self, im, m, cx, cy, s, eyes=True):
        sk, ey, no, te = X.skull_pts(cx, cy, s)
        X.obj(im, m(sk), self.B, self.K, cap=2)
        X.fill(im, m(ey), self.K)
        if eyes:
            for (ex, ey_) in ((cx - 1.9 * s, cy + 0.2 * s), (cx + 1.9 * s, cy + 0.2 * s)):
                X.fill(im, m({(int(round(ex)), int(round(ey_)))}), self.ICH[3])
        X.fill(im, m(no | te), self.K)

    def orn_panel(self, im, m):
        b = self.B
        X.orb(im, *m.pt(13.5, 3), 1.8, b, self.K)
        X.orb(im, *m.pt(3, 13.5), 1.8, b, self.K)
        self.skull(im, m, 6.5, 6.0, 1.25)

    def orn_alt(self, im, m):
        self.skull(im, m, 4.5, 4.0, 0.8, eyes=True)

    def orn_tab(self, im, m, active):
        S_ = m(X.disc(2.5, 2.5, 1.9))
        X.obj(im, S_, self.B, self.K, cap=1)
        if active:
            X.fill(im, m({(2, 2)}), self.ICH[3])

    def orn_slot(self, im, m):
        X.obj(im, m(X.disc(2, 2, 1.5)), self.B, self.K, cap=1)

    def orn_tip(self, im, m):
        X.obj(im, m(X.disc(2.5, 2.5, 1.8)), self.B, self.K, cap=1)

    def btn_rim(self, k):
        b = self.B
        return (b[3], b[0], b[2])

    def button(self, k):
        im = super().button(k)
        o, sh, base, lt, hi = self.BTN[k]
        for x in range(2, 14):
            im.set(x, 13, lerp(sh, o, .4))
        return im

    def header(self):
        b, x_ = self.B, self.ICH
        im = X.Canvas(48, 24)
        m = [[(6 <= x <= 41 and 4 <= y <= 19) for x in range(48)] for y in range(24)]
        grad = vgrad({7: (40, 48, 42), 12: (28, 34, 30), 18: (14, 18, 16)})
        paint(im, m, [self.K, (b[4], b[1], b[3]), (b[3], b[2], b[3]), (b[2], b[3], b[2]), self.K,
                      (x_[1], x_[0], x_[0]), self.K], grad)
        for cx in (6.5, 40.5):
            for cy in (4.5, 18.5):
                X.orb(im, cx + (-3 if cx < 20 else 3), cy, 2.4, b, self.K)
            self.skull(im, lambda p: p, cx, 10.5, 1.15)
        clean_mid(im)
        return dup_row(im, 11)


# ====================================================================== DESERT

class Desert(Base):
    """Grès taillé à degrés, collier égyptien or/turquoise/lapis, soleil d'or, scarabées."""
    K = (24, 12, 6)
    SA = ((92, 58, 30), (140, 96, 50), (182, 136, 78), (214, 174, 112), (242, 214, 160))
    TQ = ((6, 50, 56), (14, 92, 94), (40, 168, 158), (140, 234, 214), (220, 255, 245))
    G = ((90, 50, 8), (170, 110, 30), (238, 186, 58), (255, 222, 120), (255, 248, 210))
    LAP = ((14, 20, 70), (30, 50, 140), (60, 96, 200), (120, 160, 240), (200, 220, 255))
    M = SA
    A = (G[0], G[1], G[2], G[3])
    GLOW = (150, 92, 40)
    FILL = (52, 27, 19)
    ALT_FILL = (64, 34, 24)
    SLOT_FILL = (32, 16, 12)
    TIP_FILL = (40, 20, 14, 244)
    TAB_OFF = (64, 34, 24)
    TAB_ON = {3: (110, 60, 38), 8: (76, 40, 28)}
    STEP3 = [3, 3, 3, 1]
    STEP2 = [2, 2]
    PROF = {'panel': [4, 4, 4, 4, 2, 2], 'alt': STEP3, 'tab': STEP2, 'btn': STEP2, 'badge': STEP2, 'slot': STEP2,
            'tip': STEP2}
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

    def mold(self):
        a = self.SA
        return [(a[4], a[1], a[3]), (a[3], a[1], a[2]), (a[2], a[2], a[2]), (a[2], a[2], a[2]), (a[1], a[3], a[2])]

    def band_panel(self, im):
        rows = ["KgggKtttKlllKttt", "KgggKtttKlllKttt", "KdddKsssKbbbKsss"]
        pal = {'K': self.K, 'g': self.G[3], 'd': self.G[1], 't': self.TQ[2], 's': self.TQ[1], 'l': self.LAP[2],
               'b': self.LAP[1]}
        band(im, rows, pal, a0=2)

    def sun(self, im, m, cx, cy, r):
        for k in range(8):
            a = k * math.pi / 4
            q = X.line(cx + (r + 0.5) * math.cos(a), cy + (r + 0.5) * math.sin(a),
                       cx + (r + 2.5) * math.cos(a), cy + (r + 2.5) * math.sin(a))
            X.fill(im, m(set(q)), self.G[3])
        X.obj(im, m(X.disc(cx, cy, r)), self.G, self.K, cap=2)

    def orn_panel(self, im, m):
        a = self.SA
        blk = X.rect(0, 0, 11, 11)
        X.obj(im, m(blk), a, self.K, cap=2)
        X.obj(im, m(X.rect(2, 2, 9, 9)), (a[0], a[1], a[2], a[3], a[3]), self.K, cap=1)
        self.sun(im, m, 5.5, 5.5, 2.4)
        for (x, y) in ((14, 3), (3, 14)):
            X.obj(im, m(X.poly([(x, y - 1.6), (x + 1.6, y), (x, y + 1.6), (x - 1.6, y)])), self.TQ, self.K, cap=1)

    def orn_alt(self, im, m):
        X.obj(im, m(X.poly([(4, 1.2), (6.8, 4), (4, 6.8), (1.2, 4)])), self.TQ, self.K, cap=1)

    def orn_tab(self, im, m, active):
        if active:
            X.obj(im, m(X.poly([(3.5, 1), (6, 3.5), (3.5, 6), (1, 3.5)])), self.G, self.K, cap=1)

    def orn_slot(self, im, m):
        X.fill(im, m({(3, 3)}), self.TQ[3])

    def orn_tip(self, im, m):
        X.obj(im, m(X.poly([(3.5, 1.2), (5.8, 3.5), (3.5, 5.8), (1.2, 3.5)])), self.TQ, self.K, cap=1)

    def btn_rim(self, k):
        a = self.SA
        return (a[3], a[0], a[2])

    def header(self):
        a, t, g = self.SA, self.TQ, self.G
        im = X.Canvas(48, 24)
        m = [[False] * 48 for _ in range(24)]
        for y in range(2, 22):
            d = abs(y - 11.5)
            x0 = 2 * int((d + 0.5) // 2.2) + 1
            for x in range(x0, 48 - x0):
                m[y][x] = True
        paint(im, m, [self.K, (a[4], a[1], a[3]), (a[3], a[1], a[2]), (a[2], a[2], a[2]), self.K,
                      (t[2], t[0], t[1]), self.K], vgrad({8: (96, 52, 34), 13: (72, 38, 26), 18: (48, 24, 16)}))
        for cx in (7.5, 39.5):
            sc = X.ellipse(cx, 11.5, 3.6, 5.2)
            X.obj(im, sc, t, self.K, cap=2)
            for q in X.line(cx, 7, cx, 16):
                im.set(q[0], q[1], t[0])
            X.fill(im, X.ellipse(cx, 6.2, 1.8, 1.3), g[2])
            for (dx) in (-4.5, 4.5):
                X.fill(im, set(X.line(cx + dx * 0.6, 9, cx + dx, 7)) | set(X.line(cx + dx * 0.6, 14, cx + dx, 16)), self.K)
        clean_mid(im)
        return dup_row(im, 11)


# ====================================================================== FROST

class Frost(Base):
    """Glace cristalline : biseaux facettés, givre, pointes de glace, flocons."""
    K = (8, 22, 36)
    I = ((40, 82, 112), (80, 142, 178), (132, 192, 222), (192, 234, 248), (250, 255, 255))
    M = I
    A = ((40, 100, 140), (90, 170, 210), (160, 230, 250), (240, 255, 255))
    GLOW = (90, 170, 210)
    FILL = (14, 30, 42)
    ALT_FILL = (20, 40, 54)
    SLOT_FILL = (10, 22, 32)
    TIP_FILL = (12, 26, 38, 244)
    TAB_OFF = (22, 42, 56)
    TAB_ON = {3: (60, 112, 140), 8: (32, 64, 84)}
    PROF = {'panel': CUT(5), 'alt': CUT(4), 'tab': CUT(3), 'btn': CUT(3), 'badge': CUT(3), 'slot': CUT(3),
            'tip': CUT(2)}
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

    def mold(self):
        i = self.I
        return [(i[4], i[1], i[3]), (i[3], i[1], i[2]), (i[2], i[0], i[1]), (i[1], i[2], i[1]), (i[0], i[1], i[0])]

    def band_panel(self, im):
        rows = ["...w.......W....",
                "..wh......Wh....",
                ".wh......Wh...w.",
                "wh......Wh......",
                "h......Wh.......",
                ]
        band(im, rows, {'w': self.I[4], 'h': self.I[3], 'W': self.I[4]}, a0=1)
        # pointes de givre vers l'intérieur
        spikes = ["..XX......X.....", "..Xx......x.....", "..x.............", "..o............."]
        band(im, spikes, {'X': self.I[3], 'x': self.I[2], 'o': lerp(self.I[1], self.FILL, .4)}, a0=8)

    def flk(self, im, m, cx, cy, r):
        F = X.flake(cx, cy, r, arms=8, a0=0, br=(0.55,), brl=0.5)
        X.outline(im, m(F), self.K, diag=False)
        X.fill(im, m(F), self.I[4])
        X.fill(im, m({(int(cx), int(cy))}), WHITE)

    def orn_panel(self, im, m):
        X.obj(im, m(X.disc(6.5, 6.5, 6.0)), (self.I[0], self.I[1], self.I[1], self.I[2], self.I[3]), self.K, cap=2)
        self.flk(im, m, 6, 6, 5)
        for (x, y, a) in ((13, 2, 0.0), (2, 13, math.pi / 2)):
            X.obj(im, m(X.shard(x - 2, y, a, 4.5, 1.3)), self.I, self.K, cap=1)

    def star(self, im, m, cx, cy):
        X.fill(im, m({(cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)}), self.I[2])
        X.fill(im, m({(cx + 2, cy), (cx - 2, cy), (cx, cy + 2), (cx, cy - 2)}), self.I[1])
        X.fill(im, m({(cx, cy)}), WHITE)

    def orn_alt(self, im, m):
        self.star(im, m, 4, 4)

    def orn_tab(self, im, m, active):
        if active:
            self.star(im, m, 3, 3)
        else:
            X.fill(im, m({(3, 3)}), self.I[3])

    def orn_slot(self, im, m):
        X.fill(im, m({(3, 3), (2, 3), (3, 2)}), self.I[4])

    def orn_tip(self, im, m):
        self.star(im, m, 3, 3)

    def btn_rim(self, k):
        i = self.I
        return (i[3], i[0], i[2])

    def header(self):
        i = self.I
        im = X.Canvas(48, 24)
        m = [[False] * 48 for _ in range(24)]
        for y in range(3, 21):
            for x in range(8, 40):
                m[y][x] = True
        paint(im, m, [self.K, (i[4], i[1], i[3]), (i[3], i[1], i[2]), self.K, (self.A[2], self.A[0], self.A[1]), self.K],
              vgrad({6: (52, 104, 132), 12: (32, 68, 90), 18: (16, 36, 50)}))
        for fx in (False, True):
            sh = []
            for (y, L, W) in ((11.5, 9.5, 3.4), (5.5, 6.5, 2.3), (17.5, 6.5, 2.3), (2.5, 4.0, 1.4), (20.5, 4.0, 1.4)):
                p = X.shard(9.5, y, math.pi, L, W)
                sh.append(X.mirror_x(p, 48) if fx else p)
            for p in sh[::-1]:
                X.obj(im, p, i, self.K, cap=2)
        clean_mid(im)
        return dup_row(im, 11)


# ====================================================================== SAKURA

class Sakura(Base):
    """Laque noire et vermillon, ferrures d'or (kanagu), fleurs de cerisier."""
    K = (8, 4, 6)
    LQ = ((14, 8, 12), (26, 14, 22), (44, 26, 36), (70, 44, 58), (110, 78, 90))
    VER = ((80, 8, 14), (140, 22, 26), (196, 42, 40), (234, 96, 80), (255, 170, 150))
    G = ((90, 56, 14), (150, 104, 40), (214, 166, 70), (250, 216, 124), (255, 246, 210))
    PK = ((124, 40, 72), (204, 92, 134), (242, 152, 184), (255, 214, 228), (255, 245, 250))
    YEL = (250, 220, 96)
    M = LQ
    A = (G[0], G[1], G[2], G[3])
    GLOW = (170, 70, 120)
    FILL = (36, 14, 32)
    ALT_FILL = (46, 18, 40)
    SLOT_FILL = (22, 8, 18)
    TIP_FILL = (30, 10, 26, 244)
    TAB_OFF = (44, 18, 38)
    TAB_ON = {3: (110, 44, 90), 8: (62, 24, 54)}
    PROF = {'panel': SQ, 'alt': SQ, 'tab': SQ, 'btn': RND[1], 'badge': RND[3], 'slot': SQ, 'tip': SQ}
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

    def mold(self):
        l, v = self.LQ, self.VER
        return [(l[4], l[1], l[3]), (l[2], l[1], l[2]), (v[3], v[1], v[2]), (v[2], v[2], v[2]), (v[1], v[3], v[2])]

    def band_panel(self, im):
        rows = ["....g.......wpp.", "...gGg......ppP.", "....g.........P."]
        band(im, rows, {'g': self.G[2], 'G': self.G[4], 'w': self.PK[4], 'p': self.PK[2], 'P': self.PK[1]}, a0=3)

    def blossom(self, im, m, cx, cy, r=2.3, pr=1.45):
        S_ = X.blossom_pts(cx, cy, r, pr)
        X.outline(im, m(S_), self.K)
        X.bevel(im, m(S_), self.PK, 2)
        X.fill(im, m({(int(round(cx)), int(round(cy)))}), self.YEL)
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            X.fill(im, m({(int(round(cx)) + dx, int(round(cy)) + dy)}), self.PK[1])
        X.fill(im, m({(int(round(cx)), int(round(cy)))}), self.YEL)

    def orn_panel(self, im, m):
        g = self.G
        cap = X.poly([(0, 0), (13, 0), (13, 3), (8, 4), (4, 8), (3, 13), (0, 13)])
        X.obj(im, m(cap), g, self.K, cap=2)
        for (x, y) in ((10, 1.6), (1.6, 10)):
            X.fill(im, m({(int(x), int(y))}), g[0])
        self.blossom(im, m, 5, 5, 2.4, 1.6)

    def orn_alt(self, im, m):
        X.obj(im, m(X.poly([(0, 0), (8, 0), (8, 2), (2, 8), (0, 8)])), self.G, self.K, cap=1)

    def orn_tab(self, im, m, active):
        if active:
            self.blossom(im, m, 3, 3, 1.6, 1.1)
        else:
            X.obj(im, m(X.poly([(0, 0), (5, 0), (0, 5)])), (self.G[0], self.G[1], self.G[1], self.G[2], self.G[2]), self.K)

    def orn_slot(self, im, m):
        X.obj(im, m(X.poly([(0, 0), (4.5, 0), (0, 4.5)])), self.G, self.K, cap=1)

    def orn_tip(self, im, m):
        self.blossom(im, m, 3, 3, 1.6, 1.1)

    def btn_rim(self, k):
        g = self.G
        return (g[1], g[0], g[1]) if k == 'gold' else (g[3], g[1], g[2])

    def header(self):
        l, v, g = self.LQ, self.VER, self.G
        im = X.Canvas(48, 24)
        m = [[False] * 48 for _ in range(24)]
        for y in range(24):
            for x in range(48):
                e = min(x, 47 - x)
                body = 5 <= y <= 20 and e >= 5
                if body:
                    m[y][x] = True
        paint(im, m, [self.K, (v[3], v[1], v[2]), v[2], (g[3], g[1], g[2]), self.K],
              vgrad({8: (96, 34, 70), 13: (70, 22, 52), 18: (40, 12, 32)}))
        # kasagi : linteau noir aux bouts relevés
        kas = set()
        for x in range(48):
            e = min(x, 47 - x)
            lift = max(0, 3 - e) * 0.8
            for y in range(int(round(1 - lift)), int(round(5 - lift * 0.4))):
                kas.add((x, y))
        X.obj(im, {p for p in kas if p[1] >= 0}, l, self.K, cap=2)
        for x in range(1, 47):
            im.set(x, 1, l[4]) if 2 <= x <= 45 else None
        # pilier rouge + fleurs aux bouts
        for cx in (7.5, 39.5):
            X.obj(im, X.rect(int(cx) - 1, 5, int(cx) + 1, 20), v, self.K, cap=1)
            self.blossom(im, lambda p: p, cx + (-3.5 if cx < 20 else 3.5), 9, 2.4, 1.5)
            self.blossom(im, lambda p: p, cx + (-2.5 if cx < 20 else 2.5), 16.5, 1.8, 1.2)
        clean_mid(im)
        return dup_row(im, 11)


# ====================================================================== SHADOW

class Shadow(Base):
    """Obsidienne et néant : éclats tranchants aux arêtes violettes luminescentes, filet
    cramoisi, lueurs éthérées."""
    K = (0, 0, 0)
    O = ((6, 4, 12), (16, 12, 28), (30, 22, 50), (50, 38, 82), (84, 68, 130))
    V = ((60, 20, 110), (110, 40, 190), (160, 90, 250), (214, 170, 255), (248, 230, 255))
    CR = ((70, 4, 20), (140, 14, 40), (210, 40, 70), (255, 110, 130), (255, 200, 210))
    M = O
    A = (CR[0], CR[1], CR[2], CR[3])
    GLOW = (110, 40, 190)
    FILL = (12, 8, 20)
    ALT_FILL = (18, 12, 30)
    SLOT_FILL = (6, 4, 12)
    TIP_FILL = (10, 6, 18, 246)
    TAB_OFF = (20, 14, 34)
    TAB_ON = {3: (70, 34, 120), 8: (36, 18, 64)}
    PROF = {'panel': [6, 4, 5, 2, 2, 1], 'alt': [4, 2, 3, 1], 'tab': [3, 2, 1], 'btn': [3, 1, 1],
            'badge': [2, 1], 'slot': [3, 2, 1], 'tip': [3, 1, 1]}
    BTN = {
        'gold':   ((50, 40, 20), (176, 156, 110), (226, 210, 168), (240, 230, 200), (255, 250, 236)),
        'blue':   ((20, 6, 40), (60, 20, 120), (96, 40, 176), (140, 80, 226), (220, 180, 255)),
        'purple': ((30, 4, 34), (90, 16, 96), (130, 30, 132), (176, 70, 180), (240, 170, 240)),
        'gray':   ((8, 6, 14), (40, 34, 56), (62, 54, 84), (94, 84, 124), (170, 160, 200)),
        'red':    ((40, 2, 12), (110, 10, 34), (160, 22, 52), (210, 60, 90), (255, 160, 180)),
    }
    BADGE = {
        'green': ((4, 24, 14), (24, 96, 60), (38, 136, 84), (130, 230, 170)),
        'gray':  ((8, 6, 14), (40, 34, 56), (60, 52, 82), (120, 110, 150)),
        'gold':  ((50, 40, 20), (180, 160, 112), (228, 212, 170), (255, 246, 220)),
        'red':   ((40, 2, 12), (106, 10, 32), (156, 22, 50), (230, 100, 130)),
    }

    def mold(self):
        o, v = self.O, self.V
        return [(v[3], v[1], v[2]), (o[3], o[1], o[2]), (o[2], o[0], o[1]), (o[1], o[2], o[1]), (v[1], v[0], v[1])]

    def gl(self, n, fill=None, s=0.55):
        return glow_rings(fill or self.FILL, self.GLOW, n, .7, 1.6)

    def band_panel(self, im):
        o, v = self.O, self.V
        rows = ["hhhhhhh.dddd....",
                ".hhhhh...dd...c.",
                "..hhh.......cC..",
                ]
        band(im, rows, {'h': o[4], 'd': o[0], 'c': v[2], 'C': v[3]}, a0=2)

    def shards(self, im, m, big=True):
        o, v = self.O, self.V
        parts = [X.shard(0, 0, math.pi / 4, 15 if big else 9, 3.4 if big else 2.2),
                 X.shard(0, 3, 0.18, 13 if big else 8, 2.0 if big else 1.4),
                 X.shard(3, 0, math.pi / 2 - 0.18, 13 if big else 8, 2.0 if big else 1.4)]
        for p in parts[1:] + parts[:1]:
            S_ = m(p)
            X.outline(im, S_, v[2])
            X.bevel(im, S_, (o[0], o[1], o[2], o[3], o[4]), 2)

    def orn_panel(self, im, m):
        self.shards(im, m, True)
        X.orb(im, *m.pt(5, 5), 1.7, self.CR, self.K)

    def orn_alt(self, im, m):
        self.shards(im, m, False)

    def orn_tab(self, im, m, active):
        S_ = m(X.shard(0, 0, math.pi / 4, 7, 1.8))
        X.outline(im, S_, self.V[2] if active else self.O[3])
        X.bevel(im, S_, self.O, 1)

    def orn_slot(self, im, m):
        X.fill(im, m({(3, 3)}), self.V[3])
        X.fill(im, m({(2, 3), (3, 2)}), self.V[1])

    def orn_tip(self, im, m):
        S_ = m(X.shard(0, 0, math.pi / 4, 7, 1.8))
        X.outline(im, S_, self.V[2])
        X.bevel(im, S_, self.O, 1)

    def btn_rim(self, k):
        v, o = self.V, self.O
        if k == 'gold':
            return ((200, 180, 120), (90, 70, 40), (150, 130, 80))
        if k == 'red':
            return (self.CR[3], self.CR[0], self.CR[2])
        return (v[3], v[0], v[2])

    def badge(self, k):
        o, sh, base, hi = self.BADGE[k]
        return framed(12, 12, self.PROF['badge'], [self.K, (self.V[2], self.V[0], self.V[1]), (hi, sh, base)], base)

    def header(self):
        o, v, cr = self.O, self.V, self.CR
        im = X.Canvas(48, 24)
        m = [[False] * 48 for _ in range(24)]
        for y in range(3, 21):
            for x in range(9, 39):
                m[y][x] = True
        grad = vgrad({6: (40, 24, 70), 12: (24, 14, 44), 17: (16, 8, 30), 20: (40, 16, 70)})
        paint(im, m, [self.K, (v[3], v[1], v[2]), (o[3], o[1], o[2]), self.K, (cr[2], cr[0], cr[1]), self.K], grad)
        for fx in (False, True):
            parts = []
            for (y, L, W, a) in ((11.5, 10.5, 3.2, math.pi), (5, 7.5, 2.0, math.pi + 0.5), (18, 7.5, 2.0, math.pi - 0.5),
                                 (1.5, 5, 1.3, math.pi + 0.9), (21.5, 5, 1.3, math.pi - 0.9)):
                p = X.shard(10.5, y, a, L, W)
                parts.append(X.mirror_x(p, 48) if fx else p)
            for p in parts[1:] + parts[:1]:
                X.outline(im, p, v[2])
                X.bevel(im, p, o, 2)
            cx = 40.5 if fx else 6.5
            orb = X.disc(cx, 11.5, 2.6)
            X.glow(im, orb, v[2], ((1, 180), (2, 80)), under=False)
            X.obj(im, orb, (o[0], o[0], o[1], v[1], v[3]), self.K, mode='ball')
            X.fill(im, {(int(cx), 11), (int(cx), 12)}, cr[3])
        clean_mid(im)
        return dup_row(im, 11)

CLASSES = {'royal': Royal, 'sylvan': Sylvan, 'forge': Forge, 'arcane': Arcane, 'necro': Necro,
           'desert': Desert, 'frost': Frost, 'sakura': Sakura, 'shadow': Shadow}
