"""Ennemis ordinaires des mondes 7 à 10 (chibi 16 bits, lumière en haut à gauche).

  Monde 7  Marais putride   : toad, bog_zombie, leech_fly (volant), lizardman
  Monde 8  Îles célestes    : harpy (volante), cloud_spirit (flotte), griffin_cub, sky_automaton
  Monde 9  Cœur du volcan   : magma_slime, salamander, ash_wraith (volant), obsidian_beetle
  Monde 10 Royaume du Néant : void_eye (volant), star_stalker, shadow_knight, voidling

Chaque ennemi regarde à GAUCHE et produit trois images de même taille :
  <nom>      repos
  <nom>_b    2e image de marche / vol (pattes, ailes, tentacules qui changent)
  <nom>_atk  attaque
Pieds sur la dernière ligne du canvas, sauf pour les volants.
Couleurs hexadécimales fixes ; contour '#1a1226'. Sortie déterministe.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from enemies import (group_box, Canvas, M, OUT, INK, WHITE, part, crop_to, mask_of, shade_mask, spoly,  # noqa: E402
                     dome, dk, GOLD, WOOD, LEATHER, BONE)


# ================================================================ outils

def triple(fn):
    """Trois images fn(0..2), contour, recadrées sur la même boîte."""
    fr = [fn(i) for i in range(3)]
    for c in fr:
        c.outline(OUT)
    box = group_box(fr)
    return [crop_to(c, box) for c in fr]


def ell(cx, cy, rx, ry):
    return {(x, y) for y in range(int(cy - ry - 1), int(cy + ry + 2)) for x in range(int(cx - rx - 1), int(cx + rx + 2))
            if ((x + 0.5 - cx) / max(rx, 0.01)) ** 2 + ((y + 0.5 - cy) / max(ry, 0.01)) ** 2 <= 1}


def rell(cx, cy, rx, ry, ang):
    """Ellipse tournée (ang en degrés)."""
    a = math.radians(ang)
    ca, sa = math.cos(a), math.sin(a)
    r = max(rx, ry) + 1
    out = set()
    for y in range(int(cy - r - 1), int(cy + r + 2)):
        for x in range(int(cx - r - 1), int(cx + r + 2)):
            dx, dy = x + 0.5 - cx, y + 0.5 - cy
            u, v = dx * ca + dy * sa, -dx * sa + dy * ca
            if (u / rx) ** 2 + (v / ry) ** 2 <= 1:
                out.add((x, y))
    return out


def poly(pts):
    return mask_of(lambda m: m.poly(pts, '#000'))


def tube(pts, widths):
    """Membre effilé le long d'une polyligne (widths = demi-largeurs aux sommets)."""
    mask = set()
    for i, (a, b) in enumerate(zip(pts, pts[1:])):
        L = math.hypot(b[0] - a[0], b[1] - a[1]) or 1e-6
        ux, uy = (b[0] - a[0]) / L, (b[1] - a[1]) / L
        w0, w1 = widths[i], widths[i + 1]
        wm = max(w0, w1)
        for y in range(int(min(a[1], b[1]) - wm - 1), int(max(a[1], b[1]) + wm + 2)):
            for x in range(int(min(a[0], b[0]) - wm - 1), int(max(a[0], b[0]) + wm + 2)):
                px, py = x + 0.5 - a[0], y + 0.5 - a[1]
                t = max(0.0, min(1.0, (px * ux + py * uy) / L))
                d = math.hypot(px - ux * t * L, py - uy * t * L)
                if d <= w0 + (w1 - w0) * t:
                    mask.add((x, y))
    return mask


def bez(p0, p1, p2, n=12):
    out = []
    for k in range(n + 1):
        t = k / n
        out.append(((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0],
                    (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]))
    return out


def opaque(c):
    return {(x - M, y - M) for y in range(c.h) for x in range(c.w) if c.px[y][x] is not None}


def shade(c, mask, R, **kw):
    shade_mask(c, mask, R, **kw)


def rshade(c, mask, cx, cy, rx, ry, R, cuts=None, lz=0.55):
    """Volume arrondi (normale d'ellipse) — ventres, têtes, carapaces."""
    n = len(R)
    cuts = cuts or [(-0.25 + 1.1 * i / (n - 1)) for i in range(n - 1)]
    lx, ly = -0.55, -0.65
    nn = math.sqrt(lx * lx + ly * ly + lz * lz)
    lx, ly, lzn = lx / nn, ly / nn, lz / nn
    for (x, y) in mask:
        dx = (x + 0.5 - cx) / rx
        dy = (y + 0.5 - cy) / ry
        d = min(1.0, dx * dx + dy * dy)
        nz = math.sqrt(1 - d)
        v = dx * lx + dy * ly + nz * lzn
        c.set(x, y, R[min(n - 1, sum(1 for k in cuts if v > k))])


def rball(c, cx, cy, rx, ry, R):
    rshade(c, ell(cx, cy, rx, ry), cx, cy, rx, ry, R)


def inner(c, mask, col):
    for (x, y) in mask:
        c.setf(x, y, col)


def lay(c, fn):
    """Pièce posée avec liseré de séparation."""
    return part(c, fn)


def burst(c, x, y, cols, r=4, rays=8, rot=0.0):
    for k in range(rays):
        a = rot + k * 2 * math.pi / rays
        ln = r if k % 2 == 0 else r * 0.55
        for s in range(1, int(round(ln)) + 1):
            c.set(x + math.cos(a) * s, y + math.sin(a) * s, cols[0] if s <= ln * 0.5 else cols[1])
    c.set(x, y, cols[0])


def feather_wing(c, sx, sy, a0, a1, lens, R, w=1.6, covert=None, tips=None):
    """Aile à plumes : rémiges en éventail depuis l'épaule (angles en degrés, 0 = droite, -90 = haut).
    Masse ombrée d'un seul tenant, plumes séparées par un trait sombre, pointes teintées (tips)."""
    n = len(lens)
    feathers = []
    mask = set()
    for i in range(n):
        a = math.radians(a0 + (a1 - a0) * i / max(1, n - 1))
        L = lens[i]
        ux, uy = math.cos(a), math.sin(a)
        m = tube([(sx + ux * L * 0.15, sy + uy * L * 0.15), (sx + ux * L, sy + uy * L)], [w + 0.9, w * 0.7])
        feathers.append((ux, uy, L))
        mask |= m
    if covert:
        cx, cy, rx, ry, ang = covert
        mask |= rell(cx, cy, rx, ry, ang)
    xs = [p[0] for p in mask]
    ys = [p[1] for p in mask]

    def draw(t):
        rshade(t, mask, (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, (max(xs) - min(xs)) / 2 + 1,
               (max(ys) - min(ys)) / 2 + 1, R, lz=0.8)
        for i, (ux, uy, L) in enumerate(feathers):
            if tips:
                for k in range(int(L * 0.62), int(L) + 1):
                    for d in (-1, 0, 1):
                        x, y = sx + ux * k - uy * d * 0.8, sy + uy * k + ux * d * 0.8
                        if (round(x), round(y)) in mask:
                            t.set(x, y, tips[min(len(tips) - 1, 1 + (d < 0) + (k == int(L * 0.62)))])
            if i < n - 1:
                ux2, uy2, L2 = feathers[i + 1]
                bx, by = (ux + ux2) / 2, (uy + uy2) / 2
                Lm = min(L, L2)
                for k in range(int(Lm * 0.45), int(Lm) + 1):
                    t.set(sx + bx * k, sy + by * k, R[1] if not tips or k < Lm * 0.62 else tips[0])
    lay(c, draw)
    return mask


def bolt(c, pts, cols=('#fffbe0', '#ffe04a', '#e09a1a')):
    """Éclair en zigzag (cœur clair, bords dorés)."""
    for a, b in zip(pts, pts[1:]):
        c.line(a[0] + 1, a[1], b[0] + 1, b[1], cols[2])
        c.line(a[0] - 1, a[1], b[0] - 1, b[1], cols[1])
    for a, b in zip(pts, pts[1:]):
        c.line(a[0], a[1], b[0], b[1], cols[0])


def slit_eye(c, x, y, iris, pupil=INK, glint=WHITE, w=3, h=3):
    c.rect(x, y, w, h, iris[1])
    c.rect(x, y, w, 1, iris[2])
    c.set(x, y, iris[3] if len(iris) > 3 else glint)
    for yy in range(h):
        c.set(x + w // 2, y + yy, pupil)
    c.set(x, y + h - 1, iris[0])


# ================================================================ MONDE 7 — MARAIS PUTRIDE

TOAD = ['#14302a', '#265a34', '#418a3c', '#70b44c', '#b0dc72']
TOAD_BELLY = ['#5a3a6a', '#9a70a8', '#c8a8d4', '#ece0f2']
TOAD_SPOT = ['#33104a', '#5e2480', '#9444b8', '#c886e0']
TOAD_EYE = ['#7a3a08', '#e09a1a', '#ffd84a', '#fff4b0']
POISON = ['#4a1060', '#8a2ab0', '#c060e8', '#ecb0ff']
TONGUE = ['#7a1a3a', '#c8406a', '#f080a0', '#ffc0d0']


def toad_draw(f):
    c = Canvas(34, 24)
    G = 22
    dy = -3 if f == 1 else (-1 if f == 2 else 0)
    hx = -1 if f == 2 else 0
    far = dk(TOAD, -0.1)
    # patte arrière lointaine
    if f == 1:
        shade(c, tube([(23, 14 + dy), (28, 19), (29, G)], [2.4, 1.6, 1.2]), far)
        c.rect(28, G, 4, 1, far[1])
    else:
        rball(c, 24, 15, 3.6, 3.2, far)
    # corps
    body = ell(18, 14 + dy, 10.5, 7) | ell(10 + hx, 12.5 + dy, 8.2, 6.6)
    rshade(c, body, 15, 12 + dy, 13, 8.5, TOAD)
    # ventre / gorge
    belly = (ell(10 + hx, 18 + dy, 7.5, 3.4) | ell(17, 19 + dy, 7, 2.4)) & body
    shade(c, belly, TOAD_BELLY, contrast=0.2, bias=0.1, edge=False)
    for x in range(5 + hx, 15 + hx, 2):
        c.setf(x, 17 + dy, TOAD_BELLY[1])
    # taches violettes venimeuses
    for (sx, sy, r) in ((18, 8.5, 2.2), (23.5, 11, 1.8), (14, 7.8, 1.3), (26, 15.5, 1.5), (20.5, 13, 1.2)):
        m = ell(sx, sy + dy, r + 0.3, r) & body
        shade(c, m, TOAD_SPOT[1:], contrast=0.3, edge=False)
        c.setf(sx - r * 0.4, sy + dy - r * 0.4, TOAD_SPOT[3])
    # verrues
    for (wx, wy) in ((7, 10), (11, 9), (16, 11), (22, 16), (13, 13)):
        c.setf(wx + hx, wy + dy, TOAD[4])
        c.setf(wx + hx + 1, wy + dy + 1, TOAD[1])
    # yeux globuleux
    for (ex, ey, R) in ((13.5 + hx, 6.4 + dy, far), (7 + hx, 6.8 + dy, TOAD)):
        rball(c, ex, ey, 3.2, 3, R)
        ix, iy = int(ex - 2), int(ey - 1.6)
        c.rect(ix, iy, 3, 2, TOAD_EYE[2])
        c.set(ix, iy, TOAD_EYE[3])
        c.rect(ix, iy + 2, 3, 1, TOAD_EYE[1])
        c.rect(ix, iy + 1, 3, 1, INK)
        c.line(ix - 1, iy - 1, ix + 3, iy - 1 + (1 if R is TOAD else 0), R[0])
    # bouche
    my = 13 + dy
    if f == 2:
        spoly(c, [(0 + hx, my - 1), (12 + hx, my + 1), (11 + hx, my + 3), (2 + hx, my + 4)], ['#3a0a1a', '#6a1428', '#8a2038'], edge=False)
        c.line(0 + hx, my - 1, 12 + hx, my + 1, INK)
        # langue qui fouette
        shade(c, tube([(5 + hx, my + 2), (-2, my + 2.5), (-9, my + 1)], [1.3, 1.1, 1.1]), TONGUE, contrast=0.2)
        rball(c, -10, my + 1, 2.2, 2, TONGUE)
        c.set(-11, my, TONGUE[3])
        # bave empoisonnée
        for (px, py) in ((-6, my + 4), (-4, my + 6), (1, my + 6), (-9, my + 4)):
            c.set(px, py, POISON[2]); c.set(px, py - 1, POISON[3])
    else:
        for x in range(1 + hx, 13 + hx):
            c.set(x, my + (1 if x > 4 else 0) + (1 if x > 9 else 0), INK)
        c.set(1 + hx, my - 1, INK)
        c.set(13 + hx, my + 1, TOAD[1])
    # pattes avant
    if f == 1:
        shade(c, tube([(9, 16 + dy), (7, 20), (6, G)], [2.0, 1.5, 1.3]), TOAD)
        c.rect(3, G, 5, 1, TOAD[2]); c.set(3, G, TOAD[3]); c.set(5, G - 1, TOAD[2])
    else:
        shade(c, tube([(9 + hx, 17 + dy), (7 + hx, 20), (6 + hx, G)], [2.2, 1.6, 1.4]), TOAD)
        c.rect(3 + hx, G, 6, 1, TOAD[2]); c.set(3 + hx, G, TOAD[3]); c.set(5 + hx, G - 1, TOAD[3])
    # patte arrière proche (cuisse pliée ou tendue)
    if f == 1:
        lay(c, lambda t: (rshade(t, ell(23, 13 + dy, 4.6, 3.6), 23, 13 + dy, 4.6, 3.6, TOAD),
                          shade(t, tube([(25, 15 + dy), (27, 19), (26, G)], [2.0, 1.6, 1.3]), TOAD)))
        c.rect(24, G, 6, 1, TOAD[2]); c.set(24, G, TOAD[3])
    else:
        lay(c, lambda t: (rshade(t, ell(23, 16 + dy * 0.5, 5, 4), 23, 16, 5, 4, TOAD),
                          shade(t, tube([(26, 19), (21, 21), (18, G)], [1.6, 1.5, 1.2]), TOAD)))
        c.rect(15, G, 5, 1, TOAD[2]); c.set(15, G, TOAD[3]); c.set(16, G - 1, TOAD[3])
    return c


ZSKIN = ['#26342c', '#43593f', '#677f58', '#93a878', '#c2d0a0']
ZRAG = ['#22181a', '#3e2c24', '#5e4432', '#7e6046', '#a08060']
ALGAE = ['#0c2618', '#174a24', '#2a7830', '#4ea83a', '#8ad060']
ZEYE = '#f8f070'


def algae_strands(c, pts, f, ln=4):
    """Algues qui pendent : filaments verts terminés par une goutte."""
    for i, (x, y) in enumerate(pts):
        L = ln + (i * 7 + f) % 3
        sway = 1 if (i + f) % 2 else 0
        for k in range(L):
            c.set(x + (sway if k > L // 2 else 0), y + k, ALGAE[2] if k < L - 1 else ALGAE[1])
        c.set(x, y, ALGAE[3])


def bog_zombie_draw(f):
    c = Canvas(30, 34)
    G = 32
    far = dk(ZSKIN, -0.1)
    sw = 0 if f != 1 else 1
    # jambes
    if f == 1:
        legs = [((14, 22), (16, G), far), ((11, 22), (9, G), ZSKIN)]
    elif f == 2:
        legs = [((15, 22), (19, G), far), ((11, 22), (7, G), ZSKIN)]
    else:
        legs = [((14, 22), (12, G), far), ((11, 22), (14, G), ZSKIN)]
    for hip, foot, R in legs:
        shade(c, tube([hip, ((hip[0] + foot[0]) / 2 + 0.5, (hip[1] + G) / 2), (foot[0], G - 1)], [2.2, 1.7, 1.6]), R)
        c.rect(foot[0] - 2, G, 4, 1, R[1]); c.set(foot[0] - 2, G, R[2])
    # bras lointain
    if f == 2:
        shade(c, tube([(16, 13), (14, 6), (10, 1)], [1.8, 1.5, 1.4]), far)
        for k in range(3):
            c.line(10, 1, 8 - k, -1 + k, far[0])
    else:
        shade(c, tube([(15, 14), (9, 13 + sw), (3, 14 + sw)], [1.8, 1.5, 1.3]), far)
        c.line(1, 13 + sw, 3, 14 + sw, far[0]); c.line(1, 15 + sw, 3, 15 + sw, far[0])
    # torse voûté + haillons
    lean = 2 if f == 2 else 0
    torso = poly([(8 - lean, 12), (16, 11), (19, 15), (18, 23), (9, 23)])
    shade(c, torso, ZSKIN, contrast=0.4)
    rag = poly([(9 - lean, 14), (18, 13), (19, 21), (18, 25), (16.5, 23), (15, 26), (13, 23.5), (11, 26), (10, 23)])
    lay(c, lambda t: shade(t, rag, ZRAG, contrast=0.4))
    # côtes visibles dans une déchirure
    for y in (16, 18):
        c.line(11, y, 13, y + 0.5, ZSKIN[3])
    c.line(12, 15, 12, 19, ZRAG[0])
    # ceinture de corde
    c.line(9, 21, 18, 20, ZRAG[4]); c.set(13, 22, ZRAG[3]); c.set(13, 23, ZRAG[3])
    # algues sur les épaules
    shade(c, ell(15, 12, 4.4, 2.2), ALGAE[1:], contrast=0.3)
    algae_strands(c, [(12, 13), (14, 14), (17, 13), (19, 15)], f, 4)
    # tête penchée
    hy = 7 + (1 if f == 1 else 0) + (1 if f == 2 else 0)
    hx = 8 - lean
    head = ell(hx, hy, 5.2, 5)
    rshade(c, head, hx, hy, 5.2, 5, ZSKIN)
    # mâchoire pendante
    jaw = poly([(hx - 4.5, hy + 2), (hx + 2, hy + 2.5), (hx + 1.5, hy + 5.5 + (1 if f == 2 else 0)), (hx - 4, hy + 5 + (2 if f == 2 else 0))])
    shade(c, jaw, ZSKIN, contrast=0.3)
    c.line(hx - 4, hy + 3, hx + 1, hy + 3, '#3a0a14')
    if f == 2:
        c.rect(int(hx - 4), int(hy + 3), 5, 2, '#3a0a14')
        c.set(hx - 3, hy + 4, '#7a1a2a'); c.set(hx - 2, hy + 4, '#7a1a2a')
    c.set(hx - 3, hy + 2, BONE[3]); c.set(hx - 1, hy + 3, BONE[3]); c.set(hx + 1, hy + 2, BONE[3])
    # yeux : un globe jaune luisant, une orbite creuse
    ex, ey = int(hx - 4), int(hy - 1)
    c.rect(ex, ey, 2, 2, ZEYE); c.set(ex, ey, WHITE); c.set(ex + 1, ey + 1, '#c8a020')
    c.rect(ex + 3, ey, 2, 2, '#1a1a14'); c.set(ex + 4, ey + 1, '#3a2a14')
    c.line(ex - 1, ey - 1, ex + 1, ey - 1, ZSKIN[0])
    # cheveux d'algues
    shade(c, poly([(hx - 3, hy - 5), (hx + 3, hy - 5.5), (hx + 6, hy - 1), (hx + 5, hy + 4), (hx + 3, hy - 1), (hx - 1, hy - 3)]), ALGAE, contrast=0.35)
    algae_strands(c, [(int(hx + 4), int(hy + 2)), (int(hx + 2), int(hy)), (int(hx - 2), int(hy - 3))], f, 3)
    # bras proche tendu (ou balayage griffu)
    if f == 2:
        lay(c, lambda t: shade(t, tube([(13, 15), (7, 19), (1, 19)], [2.0, 1.7, 1.6]), ZSKIN))
        for k in range(3):
            c.line(1, 18 + k, -2, 17 + k * 2, ZSKIN[1])
            c.set(-2, 17 + k * 2, BONE[3])
        # traînée de griffure
        for k in range(3):
            c.line(-5 + k * 2, 11 + k, -3 + k * 2, 21 + k, '#b8e070' if k == 1 else '#6aa83a')
    else:
        lay(c, lambda t: shade(t, tube([(12, 15), (6, 16 - sw), (1, 16 - sw)], [2.0, 1.7, 1.5]), ZSKIN))
        for k in range(3):
            c.set(-1, 15 - sw + k, ZSKIN[1] if k != 1 else ZSKIN[3])
        c.set(-2, 16 - sw, BONE[3])
    algae_strands(c, [(6, 17 - (0 if f == 2 else sw)), (9, 17 - (0 if f == 2 else sw))] if f != 2 else [(5, 20), (8, 20)], f, 3)
    return c


LF_BODY = ['#1e1a1e', '#3a3230', '#5e5244', '#8a7a5a', '#b8a87a']
LF_BLOOD = ['#3a0a2a', '#7a1440', '#b82a4e', '#e8606a', '#ffb0a0']
LF_WING = ['#5a8a7a', '#8ac0a8', '#bce8d0', '#e8fff0']
LF_EYE = ['#5a0a10', '#b0201a', '#ff4a2a', '#ffb090']


def leech_fly_draw(f):
    c = Canvas(30, 28)
    tilt = 2 if f == 2 else 0
    oy = 1 if f == 1 else 0
    # aile lointaine
    if f == 1:
        wings = [(19, 11 + oy, 7, 2.2, 15), (21, 12 + oy, 7.5, 2.4, 25)]
    elif f == 2:
        wings = [(19, 4, 7, 2.2, -50), (22, 7, 7.5, 2.4, -25)]
    else:
        wings = [(18, 3 + oy, 7, 2.2, -65), (21, 4 + oy, 7.5, 2.4, -45)]
    wx, wy, rx, ry, a = wings[0]
    shade(c, rell(wx, wy, rx, ry, a), dk(LF_WING, -0.06), contrast=0.3)
    # pattes lointaines
    for (ax, ay, bx, by, ex, ey) in ((14, 13, 14, 18, 16, 23),):
        c.line(ax, ay + oy, bx, by + oy, LF_BODY[1]); c.line(bx, by + oy, ex, ey + oy, LF_BODY[1])
    # abdomen gonflé de sang (strié)
    ab = rell(23 - tilt, 15 + oy - tilt, 6.8, 3.8, 30 - tilt * 6)
    rshade(c, ab, 23 - tilt, 15 + oy - tilt, 6.8, 3.8, LF_BLOOD)
    for k in range(3):
        x0 = 20 + k * 3 - tilt
        for (x, y) in ab:
            if x == x0 or x == x0 + 1 and y > 15 + oy - tilt + k:
                c.set(x, y, LF_BODY[1] if x == x0 else LF_BLOOD[0])
    c.set(20 - tilt, 13 + oy - tilt, LF_BLOOD[4]); c.set(21 - tilt, 12 + oy - tilt, LF_BLOOD[4])
    # thorax
    rball(c, 15, 10 + oy, 4.2, 3.8, LF_BODY)
    for (x, y) in ((14, 8), (16, 8), (15, 7)):
        c.setf(x, y + oy, LF_BODY[4])
    # aile proche
    wx, wy, rx, ry, a = wings[1]
    m = rell(wx, wy, rx, ry, a)
    lay(c, lambda t: shade(t, m, LF_WING, contrast=0.3, bias=0.05))
    ca, sa = math.cos(math.radians(a)), math.sin(math.radians(a))
    c.line(wx - ca * rx * 0.8, wy - sa * rx * 0.8, wx + ca * rx * 0.8, wy + sa * rx * 0.8, LF_WING[0])
    c.setf(wx - ca * 2 - sa, wy - sa * 2 + ca, LF_WING[3])
    # tête et yeux composés
    hx, hy = 9 - tilt, 10 + oy + tilt * 0.5
    rball(c, hx, hy, 3.4, 3.2, LF_BODY)
    rball(c, hx - 0.6, hy - 0.4, 2.5, 2.4, LF_EYE)
    c.set(hx - 2, hy - 2, WHITE); c.set(hx - 1, hy - 1, LF_EYE[3])
    for (x, y) in ((hx - 1, hy + 1), (hx + 1, hy - 1)):
        c.setf(x, y, LF_EYE[1])
    # antennes plumeuses
    c.line(hx - 1, hy - 3, hx - 3, hy - 6, LF_BODY[2]); c.set(hx - 4, hy - 6, LF_BODY[3]); c.set(hx - 3, hy - 7, LF_BODY[3])
    # trompe
    if f == 2:
        tip = (hx - 13, hy + 8)
    else:
        tip = (hx - 8, hy + 8 - oy)
    c.line(hx - 2, hy + 2, tip[0], tip[1], LF_BODY[0])
    c.line(hx - 2, hy + 1, tip[0], tip[1] - 1, LF_BODY[2])
    c.set(tip[0], tip[1], LF_BLOOD[2])
    if f == 2:
        c.set(tip[0] - 1, tip[1] + 1, LF_BLOOD[3]); c.set(tip[0], tip[1] + 2, LF_BLOOD[2])
        for k in range(3):
            c.set(tip[0] + 3 + k * 2, tip[1] - 4 + k, '#e8f0d0')
    # pattes proches (longues, fléchies, pendantes)
    if f == 1:
        legs = ((12, 13, 10, 17, 9, 22), (15, 14, 17, 18, 18, 23))
    elif f == 2:
        legs = ((12, 13, 10, 17, 12, 22), (15, 14, 18, 17, 21, 21))
    else:
        legs = ((12, 13, 11, 18, 8, 23), (15, 14, 16, 19, 15, 24))
    for (ax, ay, bx, by, ex, ey) in legs:
        c.line(ax, ay + oy, bx, by + oy, LF_BODY[3]); c.line(bx, by + oy, ex, ey + oy, LF_BODY[2])
        c.set(bx, by + oy, LF_BODY[4]); c.set(ex, ey + oy, LF_BODY[1])
    return c


LIZ = ['#0e2e30', '#1a5848', '#2a8a5a', '#56b86a', '#9ee08a']
LIZ_BELLY = ['#8a6a2a', '#c49a3e', '#e8c868', '#fff0a8']
LIZ_FIN = ['#5a1420', '#a8302a', '#e0603a', '#ffa868']
LIZ_EYE = ['#6a3a00', '#e0a010', '#ffe84a', '#fffbd0']


def spear(c, a, b, head_len=5):
    ux, uy = b[0] - a[0], b[1] - a[1]
    L = math.hypot(ux, uy)
    ux, uy = ux / L, uy / L
    hb = (b[0] - ux * head_len, b[1] - uy * head_len)
    c.line(a[0], a[1], hb[0], hb[1], WOOD[1])
    c.line(a[0] - uy * 0.6, a[1] + ux * 0.6, hb[0] - uy * 0.6, hb[1] + ux * 0.6, WOOD[3])
    px, py = -uy, ux
    spoly(c, [(hb[0] + px * 2, hb[1] + py * 2), (b[0], b[1]), (hb[0] - px * 2, hb[1] - py * 2),
              (hb[0] - ux * 1, hb[1] - uy * 1)], BONE, contrast=0.4)
    c.line(hb[0] - ux * 1.5 + px, hb[1] - uy * 1.5 + py, hb[0] - ux * 1.5 - px, hb[1] - uy * 1.5 - py, LIZ_FIN[1])
    c.set(hb[0] - ux * 2.5 + px * 1.5, hb[1] - uy * 2.5 + py * 1.5, LIZ_FIN[2])


def lizardman_draw(f):
    c = Canvas(34, 36)
    G = 34
    far = dk(LIZ, -0.1)
    lean = 2 if f == 2 else 0
    # queue
    tail = tube(bez((19, 23), (27, 27), (32, G - 1) if f != 1 else (31, G - 2), 10), [3.0] + [3.0 - 2.6 * k / 10 for k in range(1, 11)])
    shade(c, tail, LIZ, contrast=0.4)
    for k in range(4):
        c.setf(22 + k * 2.4, 25 + k * 1.6, LIZ_BELLY[1])
    # jambes (digitigrades)
    if f == 1:
        legs = [((18, 23), (21, 28), (18, G), far), ((15, 23), (13, 28), (11, G), LIZ)]
    elif f == 2:
        legs = [((19, 23), (23, 28), (22, G), far), ((14, 23), (10, 27), (7, G), LIZ)]
    else:
        legs = [((17, 23), (19, 28), (17, G), far), ((15, 23), (15, 28), (13, G), LIZ)]
    for hip, knee, foot, R in legs:
        shade(c, tube([hip, knee, (foot[0] + 1, G - 1)], [2.6, 1.8, 1.3]), R)
        c.rect(foot[0] - 2, G, 4, 1, R[1]); c.set(foot[0] - 3, G, INK); c.set(foot[0] - 2, G, R[3])
    # bras lointain (tient la lance en arrière)
    if f == 2:
        shade(c, tube([(17 - lean, 15), (20, 18), (22, 17)], [1.6, 1.4, 1.4]), far)
    else:
        shade(c, tube([(17, 15), (19, 19), (17, 21)], [1.6, 1.4, 1.4]), far)
    # torse
    torso = poly([(10 - lean, 13), (17 - lean, 12), (19, 17), (18, 24), (12, 24), (11 - lean * 0.5, 18)])
    shade(c, torso, LIZ, contrast=0.4)
    belly = poly([(11 - lean, 15), (14 - lean, 14), (15, 24), (12, 24)])
    shade(c, belly & torso, LIZ_BELLY, contrast=0.3, edge=False)
    for y in (17, 19, 21):
        c.setf(12 - lean * (24 - y) / 12, y, LIZ_BELLY[0]); c.setf(13 - lean * (24 - y) / 12, y, LIZ_BELLY[0])
    # écailles du dos
    for (x, y) in ((17, 14), (18, 17), (17, 20)):
        c.setf(x - lean * 0.3, y, LIZ[1])
    # pagne
    lay(c, lambda t: spoly(t, [(11, 22), (19, 22), (19, 26), (17, 28), (15, 26), (13, 28), (11, 26)], LEATHER))
    c.line(11, 22, 19, 22, LEATHER[0]); c.set(15, 22, GOLD[3]); c.set(14, 22, GOLD[2])
    # tête de lézard (museau vers la gauche)
    hx, hy = 12 - lean, 8 + (1 if f == 1 else 0)
    # crête
    for k, (x, y, h) in enumerate(((hx + 2, hy - 3, 3), (hx + 4, hy - 2, 4), (hx + 6, hy, 3.5), (hx + 6, hy + 3, 3))):
        spoly(c, [(x - 1.2, y + 1), (x + h * 0.6, y - h * 0.8), (x + 1.4, y + 1.5)], LIZ_FIN)
    head = poly([(hx - 9, hy + 1), (hx - 8, hy - 1), (hx - 3, hy - 3), (hx + 2, hy - 4), (hx + 5, hy - 1), (hx + 5, hy + 4),
                 (hx + 1, hy + 5), (hx - 8, hy + 3)])
    rshade(c, head, hx - 1, hy, 7, 4.5, LIZ)
    # mâchoire
    if f == 2:
        jaw = poly([(hx - 8, hy + 3), (hx + 1, hy + 4), (hx + 2, hy + 6), (hx - 6, hy + 6)])
        spoly(c, [(hx - 8, hy + 2), (hx + 1, hy + 3), (hx - 6, hy + 5)], ['#3a0a1a', '#6a1428', '#a02a3a'], edge=False)
        shade(c, jaw, LIZ_BELLY, contrast=0.3)
        for x in (hx - 7, hx - 4, hx - 1):
            c.set(x, hy + 2, WHITE)
        c.set(hx - 6, hy + 5, WHITE)
    else:
        jaw = poly([(hx - 8, hy + 2.5), (hx + 1, hy + 4), (hx + 1, hy + 5.5), (hx - 6, hy + 4.5)])
        shade(c, jaw & opaque(c) | jaw, LIZ_BELLY, contrast=0.3)
        c.line(hx - 8, hy + 2, hx + 1, hy + 3, INK)
        c.set(hx - 5, hy + 3, WHITE)
    c.set(hx - 8, hy, INK)  # narine
    # œil de reptile
    slit_eye(c, int(hx - 2), int(hy - 2), LIZ_EYE)
    c.line(hx - 3, hy - 3, hx + 1, hy - 3, LIZ[0])
    # bras proche + lance
    if f == 2:
        shade(c, tube([(14 - lean, 15), (9, 17), (4, 17)], [1.8, 1.5, 1.6]), LIZ)
        spear(c, (24, 17), (-10, 17), 6)
        rball(c, 4, 17, 1.8, 1.7, LIZ)
        c.line(-3, 14, -7, 14, '#dfe8d0'); c.line(-1, 20, -5, 20, '#dfe8d0')
    else:
        sy = 1 if f == 1 else 0
        spear(c, (7, G - 1), (5, 0 + sy), 6)
        shade(c, tube([(13, 15), (10, 19), (7, 19 + sy)], [1.8, 1.5, 1.5]), LIZ)
        rball(c, 6.5, 18.5 + sy, 1.8, 1.8, LIZ)
    return c


# ================================================================ MONDE 8 — ÎLES CÉLESTES

H_FEATH = ['#3e3a7a', '#6a72b8', '#9eb4e4', '#d4e6fa', '#ffffff']
H_TIP = ['#1a3a6a', '#2a6aa8', '#4aa0d8', '#8ad0f0']
H_SKIN = ['#b0645a', '#de9476', '#f6c09c', '#ffe4cc']
H_HAIR = ['#6a3a10', '#b07a1e', '#e2b03a', '#fff08a']
TALON = ['#6a3a10', '#b8701a', '#f0a830', '#ffd870']


def harpy_draw(f):
    c = Canvas(36, 32)
    oy = 2 if f == 1 else 0
    far = dk(H_FEATH, -0.12)
    if f == 1:
        wa = (20, 75)
    elif f == 2:
        wa = (-65, -5)
    else:
        wa = (-90, -30)
    # aile lointaine
    feather_wing(c, 20, 10 + oy, wa[0] - 12, wa[1] - 12, [10, 13, 15, 16, 15, 12], far, tips=dk(H_TIP, -0.1))
    # queue en éventail
    for k, a in enumerate((20, 38, 56)):
        r = math.radians(a)
        m = tube([(18, 18 + oy), (18 + math.cos(r) * 9, 18 + oy + math.sin(r) * 9)], [1.6, 1.1])
        shade(c, m, H_FEATH if k != 1 else H_TIP, contrast=0.3)
    # pattes d'oiseau
    if f == 2:
        for (hx, kx, tx, ty, R) in ((17, 13, 6, 24, dk(TALON, -0.08)), (15, 10, 3, 21, TALON)):
            shade(c, tube([(hx, 19), (kx, 22)], [2.2, 1.8]), H_FEATH)
            c.line(kx, 22, tx, ty, R[2]); c.line(kx, 23, tx, ty + 1, R[1])
            for d in ((-2, -1), (-2, 1), (0, 2)):
                c.line(tx, ty, tx + d[0], ty + d[1], INK)
    else:
        for (hx, fx, R) in ((17, 18, dk(TALON, -0.08)), (15, 14, TALON)):
            shade(c, tube([(hx, 19 + oy), (fx, 22 + oy)], [2.2, 1.8]), H_FEATH)
            c.line(fx, 23 + oy, fx, 27 + oy, R[2]); c.line(fx + 1, 23 + oy, fx + 1, 26 + oy, R[1])
            c.line(fx, 27 + oy, fx - 2, 29 + oy, INK); c.line(fx + 1, 27 + oy, fx + 2, 29 + oy, INK); c.set(fx - 1, 28 + oy, INK)
    # corps couvert de plumes
    body = ell(16, 15 + oy, 4.6, 5.6)
    rshade(c, body, 16, 15 + oy, 4.6, 5.6, H_FEATH)
    for (x, y) in ((14, 16), (16, 18), (15, 13)):
        c.setf(x, y + oy, H_FEATH[2]); c.setf(x + 1, y + 1 + oy, H_FEATH[1])
    # aile proche (derrière la tête)
    feather_wing(c, 19, 11 + oy, wa[0], wa[1], [11, 14, 16, 17, 16, 13], H_FEATH, tips=H_TIP,
                 covert=(19 + math.cos(math.radians(sum(wa) / 2)) * 3, 11 + oy + math.sin(math.radians(sum(wa) / 2)) * 3,
                         4, 2.4, sum(wa) / 2))
    # buste
    rball(c, 14, 10 + oy, 3.2, 2.6, H_SKIN)
    # tête
    hx, hy = 12, 6 + oy + (1 if f == 2 else 0)
    hair_back = poly([(hx - 1, hy - 5), (hx + 6, hy - 4), (hx + 8, hy + 3), (hx + 6, hy + 8), (hx + 4, hy + 4), (hx + 2, hy + 8), (hx + 1, hy + 2)])
    lay(c, lambda t: shade(t, hair_back, H_HAIR, contrast=0.35))
    rball(c, hx, hy, 4.4, 4.2, H_SKIN)
    shade(c, poly([(hx - 5, hy - 1), (hx - 3, hy - 5), (hx + 3, hy - 5.5), (hx + 5, hy - 2), (hx + 1, hy - 3), (hx - 2, hy - 1)]), H_HAIR, contrast=0.4)
    # plume d'ornement
    c.line(hx + 2, hy - 5, hx + 4, hy - 9, H_TIP[2]); c.set(hx + 4, hy - 10, H_TIP[3]); c.set(hx + 3, hy - 8, H_TIP[1])
    # yeux perçants
    ey = int(hy - 1)
    for ex in (int(hx - 3), int(hx)):
        c.rect(ex, ey, 2, 2, '#3ac0e8'); c.set(ex, ey + 1, INK); c.set(ex, ey, WHITE)
    c.line(hx - 4, ey - 1, hx - 2, ey, INK); c.line(hx, ey, hx + 2, ey - 1, INK)
    c.set(hx - 4, ey + 2, '#f08a8a'); c.set(hx + 1, ey + 2, '#f08a8a')
    if f == 2:
        c.rect(int(hx - 2), ey + 3, 2, 2, '#5a1424'); c.set(hx - 2, ey + 3, WHITE)
    else:
        c.set(hx - 2, ey + 3, '#a04048'); c.set(hx - 1, ey + 3, '#a04048')
    return c


CLOUD = ['#4a5a9a', '#7a8cc8', '#b4c4ec', '#e2ecfc', '#ffffff']
STORM = ['#2a2e5a', '#444c84', '#6670a8', '#8e98c8']
BOLT = ('#fffbe0', '#ffe04a', '#e09a1a')
C_EYE = ['#1a6aa8', '#4ac0f0', '#b8f4ff', '#ffffff']


def cloud_spirit_draw(f):
    c = Canvas(34, 28)
    p = 1 if f == 1 else 0
    G = 26
    angry = f == 2
    # nuage d'orage dessous
    under = ell(15, 15, 11.5, 4.5) | ell(9, 16, 5, 3.5) | ell(21, 16 - p, 5, 3.5)
    shade(c, under, STORM, contrast=0.3)
    # traîne vaporeuse jusqu'au sol
    for k, (x, y, r) in enumerate(((18, 19, 2.6), (20 + p, 21.5, 2.0), (21 + p, 23.6, 1.5), (20 + p * 2, 25.2, 1.0))):
        shade(c, ell(x, y, r, r * 0.9), STORM, contrast=0.3)
    # gouttes de pluie
    for (x, y) in ((8, 20), (12, 22), (14, 19), (6, 23)):
        c.set(x - p, y + p, '#8ad0ff'); c.set(x - p, y + p + 1, '#4a8ad8')
    # puffs principaux
    puffs = [(15, 10, 9, 6.5), (8, 11 + p, 5.2, 4.6), (22, 11 - p, 5.6, 4.8), (13, 5, 5.2, 4.4), (19.5, 6 + p, 4.4, 3.8),
             (26, 13, 3.4, 3)]
    for (x, y, rx, ry) in sorted(puffs, key=lambda q: -q[0]):
        m = ell(x, y, rx, ry)
        lay(c, lambda t, m=m, x=x, y=y, rx=rx, ry=ry: rshade(t, m, x, y, rx, ry, CLOUD))
    # bras-nuages
    if angry:
        rball(c, 1, 9, 3, 2.6, CLOUD)
        rball(c, 27, 6, 2.6, 2.4, CLOUD)
    else:
        rball(c, 3, 13 + p, 2.6, 2.3, CLOUD)
        rball(c, 28, 10 - p, 2.4, 2.2, CLOUD)
    # visage
    ey = 9 + p
    for ex in (8, 14):
        c.rect(ex, ey, 3, 3, C_EYE[1]); c.rect(ex, ey, 3, 1, C_EYE[2]); c.set(ex, ey, WHITE)
        c.set(ex + 2, ey + 2, C_EYE[0])
    if angry:
        c.line(7, ey - 2, 10, ey - 1, INK); c.line(14, ey - 1, 17, ey - 2, INK)
        c.rect(10, ey + 5, 4, 3, INK); c.rect(11, ey + 6, 2, 2, '#3a3a7a')
        c.set(10, ey + 5, WHITE); c.set(13, ey + 5, WHITE)
    else:
        c.line(7, ey - 1, 10, ey - 1 + (0 if p else 1), STORM[0]); c.line(14, ey, 17, ey - 1, STORM[0])
        c.line(10, ey + 5, 13, ey + 5, INK); c.set(9, ey + 4, INK)
    # étincelles
    for (x, y) in ((25, 3 + p), (4, 5 - p)):
        c.set(x, y, BOLT[1]); c.set(x + 1, y - 1, BOLT[0])
    # éclairs
    if angry:
        bolt(c, [(6, 18), (2, 21), (4, 22), (-3, G - 1)], BOLT)
        bolt(c, [(13, 18), (11, 21), (13, 22), (10, G - 1)], BOLT)
        burst(c, -3, G - 4, ('#fffbe0', '#ffe04a'), 3, 8)
    else:
        bolt(c, [(11 + p * 4, 18), (9 + p * 4, 21), (11 + p * 4, 21.5), (9 + p * 4, 24)], BOLT)
    return c


GR_HEAD = ['#5a5a8a', '#9aa0c8', '#d0d8f0', '#f2f6ff', '#ffffff']
GR_LION = ['#5a3218', '#9a5e26', '#d09440', '#f0c474', '#fff0b8']
GR_BEAK = ['#7a4210', '#c8801c', '#f4b83a', '#ffe680']
GR_WING = ['#3e4a8a', '#7088c4', '#a8c4ec', '#dceafc', '#ffffff']


def griffin_cub_draw(f):
    c = Canvas(34, 28)
    G = 26
    farL = dk(GR_LION, -0.12)
    farB = dk(GR_BEAK, -0.12)
    rear = f == 2
    # aile lointaine
    if rear:
        feather_wing(c, 18, 9, -110, -60, [7, 9, 9, 8], dk(GR_WING, -0.1))
    else:
        feather_wing(c, 19, 11, -80 + f * 25, -35 + f * 25, [6, 8, 8, 7], dk(GR_WING, -0.1))
    # queue à pompon
    tail_end = (32, 9) if f != 1 else (32, 12)
    shade(c, tube(bez((25, 16), (30, 16), tail_end, 8), [1.3] * 9), GR_LION)
    rball(c, tail_end[0], tail_end[1] - 1, 2.2, 2.4, GR_WING)
    # pattes lointaines
    if rear:
        legs_far = [((12, 13), (9, 10), farB, True), ((24, 19), (26, G), farL, False)]
    elif f == 1:
        legs_far = [((13, 19), (15, G), farB, True), ((24, 19), (22, G), farL, False)]
    else:
        legs_far = [((13, 19), (12, G), farB, True), ((24, 19), (26, G), farL, False)]
    for hip, foot, R, front in legs_far:
        shade(c, tube([hip, foot], [2, 1.3]), R if not front else dk(GR_HEAD, -0.12))
        if front and not rear:
            c.line(foot[0] - 2, G, foot[0] + 1, G, R[1])
    # corps de lionceau
    body = ell(19, 16 + (1 if rear else 0), 8.5, 5.4)
    rshade(c, body, 19, 16, 8.5, 5.4, GR_LION)
    inner(c, ell(19, 20, 6, 1.6), GR_LION[4])
    rball(c, 24, 17, 4, 4, GR_LION)
    # pattes proches arrière
    if rear:
        hind = ((24, 19), (21, G))
    elif f == 1:
        hind = ((24, 19), (27, G))
    else:
        hind = ((24, 19), (23, G))
    shade(c, tube([hind[0], ((hind[0][0] + hind[1][0]) / 2 + 1, 23), (hind[1][0], G - 1)], [2.4, 1.6, 1.4]), GR_LION)
    c.rect(hind[1][0] - 2, G, 4, 1, GR_LION[2]); c.set(hind[1][0] - 2, G, GR_LION[3])
    # poitrail plumeux
    chest = ell(12, 14 + (-2 if rear else 0), 5.4, 5.6)
    rshade(c, chest, 12, 14, 5.4, 5.6, GR_HEAD)
    for (x, y) in ((10, 16), (13, 17), (11, 19), (14, 14)):
        c.setf(x, y - (2 if rear else 0), GR_HEAD[1])
    # patte avant proche (serres)
    if rear:
        shade(c, tube([(10, 13), (6, 9), (3, 8)], [2, 1.6, 1.4]), GR_HEAD)
        for d in ((-2, -2), (-3, 0), (-2, 2)):
            c.line(3, 8, 3 + d[0], 8 + d[1], GR_BEAK[2])
            c.set(3 + d[0], 8 + d[1], INK)
        for k in range(3):
            c.line(-3 + k, 12 + k * 2, 0 + k, 10 + k * 2, '#ffffff')
    else:
        fx = 10 if f != 1 else 8
        shade(c, tube([(11, 17), (fx, 22), (fx, G - 1)], [2.2, 1.6, 1.3]), GR_HEAD)
        c.line(fx - 3, G, fx + 1, G, GR_BEAK[2]); c.set(fx - 3, G, INK); c.set(fx - 1, G, GR_BEAK[3])
    # aile proche
    if rear:
        feather_wing(c, 17, 10, -150, -95, [7, 9, 10, 9], GR_WING, covert=(18, 10, 3.6, 2.2, -120))
    else:
        feather_wing(c, 18, 12, -105 + f * 30, -45 + f * 30, [7, 9, 10, 8], GR_WING, covert=(19, 12, 3.6, 2.2, -70 + f * 30))
    # tête d'aigle (grosse, chibi)
    hx, hy = 9, 7 + (-2 if rear else 0) + (1 if f == 1 else 0)
    head = ell(hx, hy, 5.4, 5)
    rshade(c, head, hx, hy, 5.4, 5, GR_HEAD)
    # aigrettes
    spoly(c, [(hx + 3, hy - 3), (hx + 8, hy - 6), (hx + 5, hy - 1)], GR_WING)
    spoly(c, [(hx + 4, hy - 1), (hx + 9, hy - 2), (hx + 5, hy + 1)], GR_WING)
    # bec crochu
    if rear:
        spoly(c, [(hx - 4, hy - 1), (hx - 9, hy - 0.5), (hx - 9, hy + 1.5), (hx - 4, hy + 0.5)], GR_BEAK)
        spoly(c, [(hx - 4, hy + 2), (hx - 8, hy + 3.5), (hx - 4, hy + 4)], farB)
        c.set(hx - 9, hy + 2, GR_BEAK[1])
    else:
        spoly(c, [(hx - 4, hy - 1.5), (hx - 9, hy), (hx - 8, hy + 3), (hx - 4, hy + 2.5)], GR_BEAK)
        c.set(hx - 8, hy + 3, GR_BEAK[0]); c.line(hx - 8, hy + 1.5, hx - 4, hy + 1.5, GR_BEAK[0])
    c.set(hx - 6, hy - 1, GR_BEAK[3])
    # gros œil doré
    ex, ey = int(hx - 3), int(hy - 2)
    c.rect(ex, ey, 3, 3, GR_BEAK[2]); c.rect(ex, ey + 1, 2, 2, INK); c.set(ex, ey, WHITE); c.set(ex + 2, ey + 2, GR_BEAK[1])
    c.line(ex - 1, ey - 1, ex + 3, ey - 1 + (1 if rear else 0), GR_HEAD[0])
    return c


AUTO_W = ['#4a5070', '#8a92b4', '#c6cce4', '#eef0fa', '#ffffff']
CORE = ['#0a3a7a', '#1a8ad8', '#5ad8ff', '#d8ffff']


def sky_automaton_draw(f):
    c = Canvas(30, 36)
    G = 34
    farW = dk(AUTO_W, -0.14)
    farG = dk(GOLD, -0.12)
    atk = f == 2
    # anneau doré flottant derrière la tête
    hy0 = 6 + (1 if f == 1 else 0)
    ring = ell(17, hy0 - 5, 6, 2.2) - ell(17, hy0 - 5, 4.2, 1.0)
    shade(c, ring, GOLD, contrast=0.4)
    # jambes segmentées
    if f == 1:
        legs = [((16, 22), (17, 27), (19, G), farW, farG), ((13, 22), (12, 27), (10, G), AUTO_W, GOLD)]
    elif atk:
        legs = [((16, 22), (19, 27), (21, G), farW, farG), ((13, 22), (10, 27), (8, G), AUTO_W, GOLD)]
    else:
        legs = [((16, 22), (16, 27), (16, G), farW, farG), ((13, 22), (13, 27), (12, G), AUTO_W, GOLD)]
    for hip, knee, foot, R, Gd in legs:
        shade(c, tube([hip, knee], [1.8, 1.5]), R)
        shade(c, tube([knee, (foot[0], G - 1)], [1.9, 2.2]), R)
        rball(c, knee[0], knee[1], 1.6, 1.6, Gd)
        spoly(c, [(foot[0] - 3.5, G + 1), (foot[0] - 2, G - 1.5), (foot[0] + 2, G - 1.5), (foot[0] + 2, G + 1)], Gd)
    # bras lointain
    shade(c, tube([(19, 14), (21, 19), (20, 23)], [1.6, 1.5, 1.4]), farW)
    rball(c, 20, 24, 2, 2, farG)
    # torse en tonneau
    torso = poly([(9, 12), (20, 12), (21, 17), (18, 23), (11, 23), (8, 17)])
    rshade(c, torso, 14, 15, 7, 7, AUTO_W)
    c.line(9, 12, 20, 12, GOLD[3]); c.line(9, 13, 20, 13, GOLD[1])
    c.line(11, 22, 18, 22, GOLD[2]); c.line(11, 23, 18, 23, GOLD[1])
    c.line(14, 14, 14, 21, AUTO_W[2]); c.line(15, 15, 15, 21, AUTO_W[1])
    # cœur d'énergie
    glow = CORE if not atk else ['#1a8ad8', '#5ad8ff', '#d8ffff', '#ffffff']
    rball(c, 13, 17, 2.5, 2.5, GOLD)
    rball(c, 13, 17, 1.6, 1.6, glow)
    c.set(12, 16, WHITE)
    # bassin
    spoly(c, [(10, 23), (19, 23), (18, 25), (11, 25)], GOLD)
    # tête : heaume ovoïde à visière
    hy = 6 + (1 if f == 1 else 0)
    head = ell(14, hy, 5, 4.6)
    rshade(c, head, 14, hy, 5, 4.6, AUTO_W)
    spoly(c, [(13, hy - 6.5), (16, hy - 9), (17, hy - 4), (14, hy - 3)], GOLD)  # crête
    visor = poly([(8.5, hy - 0.5), (16, hy - 1), (16, hy + 2), (9, hy + 2)])
    shade(c, visor, ['#0a1430', '#142650', '#1e3a70'], edge=False)
    ex = 10 if not atk else 9
    c.rect(ex, int(hy), 4, 1, CORE[2]); c.set(ex, int(hy), CORE[3]); c.set(ex + 3, int(hy), CORE[1])
    c.line(9, hy + 2.5, 16, hy + 2.5, GOLD[1])
    c.set(18, int(hy) + 1, GOLD[2]); c.set(18, int(hy), GOLD[3])
    # épaulière dorée + bras proche
    if atk:
        shade(c, tube([(11, 15), (6, 16), (2, 16)], [1.8, 1.6, 1.6]), AUTO_W)
        rball(c, 1, 16, 2.6, 2.6, GOLD)
        # rayon d'énergie
        for x in range(-12, -1):
            c.set(x, 15, CORE[2]); c.set(x, 16, CORE[3]); c.set(x, 17, CORE[2])
            if x % 2 == 0:
                c.set(x, 14, CORE[1]); c.set(x, 18, CORE[1])
        burst(c, -2, 16, (WHITE, CORE[2]), 4, 8, 0.4)
    else:
        sw = 1 if f == 1 else 0
        shade(c, tube([(10, 15), (8 - sw, 20), (9 - sw, 23)], [1.8, 1.6, 1.6]), AUTO_W)
        rball(c, 9 - sw, 24, 2.3, 2.3, GOLD)
    rball(c, 10, 13, 3, 2.6, GOLD)
    c.set(9, 12, GOLD[4])
    return c


# ================================================================ MONDE 9 — CŒUR DU VOLCAN

LAVA = ['#6a1006', '#c02e0a', '#ff6a12', '#ffb43a', '#fff4a0']
CRUST = ['#140c16', '#2a1e28', '#463440', '#6a5258']
EMBER = ['#ffe08a', '#ff8a1a', '#c83a0a']
LAVA_B = ['#7a1408', '#c4300c', '#ee5a10', '#ff8c1c', '#ffbe40']


def magma_slime_draw(f):
    c = Canvas(30, 24)
    G = 22
    atk = f == 2
    if f == 1:
        top, rx, cx = 7, 11, 15
    else:
        top, rx, cx = 4, 10, 15 - (1 if atk else 0)
    mask = dome(c, cx, top, G, rx, LAVA_B, flare=1.2)
    h = G - top
    # calotte de croûte refroidie (bord ondulé), fissures incandescentes
    cap = {(x, y) for (x, y) in mask if y < top + h * 0.36 + math.sin(x * 1.3) * 1.2 + (1.5 if x > cx + 3 else 0)}
    rshade(c, cap, cx - 2, top + 3, rx, h * 0.5, CRUST, cuts=[-0.1, 0.3, 0.65])
    for (x, y) in cap:
        if (x, y + 1) not in cap and (x, y + 1) in mask:
            c.set(x, y + 1, LAVA_B[4])
    for cr in (((cx - 5, top + 1), (cx - 3, top + 3), (cx - 4, top + 5)), ((cx + 2, top), (cx + 3, top + 3)),
               ((cx + 6, top + 3), (cx + 8, top + 6))):
        for a, b in zip(cr, cr[1:]):
            c.line(a[0], a[1], b[0], b[1], LAVA_B[3])
        c.setf(cr[0][0], cr[0][1], LAVA_B[4])
    c.setf(cx - 6, top + 2, CRUST[3]); c.setf(cx - 5, top + 1.5, CRUST[3])
    # coulures au pied
    for x in (cx - rx + 1, cx + 3, cx + rx - 2):
        c.set(x, G + 1, LAVA_B[2]); c.set(x + 1, G + 1, LAVA_B[1])
    # visage
    ey = top + int(h * 0.42) + 1
    fx = cx - 3
    if atk:
        for ex in (fx - 4, fx + 1):
            c.rect(ex, ey, 2, 3, INK); c.set(ex, ey, '#fff4a0')
        c.line(fx - 5, ey - 2, fx - 3, ey - 1, INK); c.line(fx + 1, ey - 1, fx + 3, ey - 2, INK)
        c.rect(fx - 3, ey + 4, 4, 3, INK); c.rect(fx - 2, ey + 5, 2, 2, '#4a0a04')
        # crachat de lave
        rball(c, -6, ey + 1, 3, 2.6, LAVA)
        c.set(-7, ey, LAVA[4]); c.set(-2, ey + 3, LAVA[3]); c.set(-1, ey + 4, LAVA[2]); c.set(-3, ey + 2, LAVA[3])
        for (x, y) in ((-9, ey - 2), (-10, ey + 4), (-4, ey - 2)):
            c.set(x, y, EMBER[1])
    else:
        for ex in (fx - 4, fx + 1):
            c.rect(ex, ey, 2, 3, INK); c.set(ex, ey, WHITE); c.set(ex + 1, ey + 2, LAVA_B[1])
        c.line(fx - 1, ey + 4, fx, ey + 4, INK); c.set(fx - 2, ey + 3, INK); c.set(fx + 1, ey + 3, INK)
        c.set(fx - 5, ey + 3, LAVA_B[4]); c.set(fx + 3, ey + 3, LAVA_B[4])
    # braises qui s'élèvent
    for (x, y) in ((cx + 2, top - 3 - f), (cx - 4, top - 2 + f), (cx + 7, top - 1)):
        c.set(x, y, EMBER[0 if (x + f) % 2 else 1])
    return c


SAL = ['#3a0610', '#760e1a', '#b4221e', '#e4502a', '#ff9a4a']
SAL_BELLY = ['#a04a10', '#e08a2a', '#ffc050', '#fff0a0']
FIRE = ['#a01e08', '#ff5a10', '#ffa020', '#ffe060', '#fffbe0']


def flame(c, x, base, h, w, lean=0.0, cols=FIRE):
    pts = [(x - w / 2, base), (x - w * 0.35 + lean * 0.4, base - h * 0.5), (x + lean, base - h), (x + w * 0.35 + lean * 0.5, base - h * 0.45), (x + w / 2, base)]
    spoly(c, pts, cols[1:4], edge=False, contrast=0.5)
    c.set(x + lean * 0.5, base - h * 0.4, cols[4])


def salamander_draw(f):
    c = Canvas(40, 20)
    G = 18
    far = dk(SAL, -0.12)
    atk = f == 2
    # pattes lointaines
    sw = 1 if f == 1 else -1
    for (hx, hy, fx) in ((12, 12, 11 - sw * 2), (24, 12, 25 + sw * 2)):
        shade(c, tube([(hx, hy), (fx + 1, G - 2), (fx, G)], [1.6, 1.2, 1.1]), far)
        c.line(fx - 1, G, fx + 1, G, far[1])
    # queue ondulante, flamme au bout
    tip = (36, 7) if f != 1 else (37, 10)
    tail = tube(bez((25, 12), (32, 15), tip, 10), [3.2] + [3.2 - 2.8 * k / 10 for k in range(1, 11)])
    shade(c, tail, SAL, contrast=0.4)
    flame(c, tip[0] + 0.5, tip[1] + 1, 6, 3, 1.2 - f * 0.8)
    # corps
    body = ell(17, 11.5, 9.5, 4)
    rshade(c, body, 17, 11.5, 9.5, 4, SAL)
    inner(c, ell(17, 14.5, 7.5, 1.4), SAL_BELLY[1])
    # crête de flammes
    for k, x in enumerate((11, 14.5, 18, 21.5, 25)):
        h = (4.5, 5.5, 5, 4, 3)[k] + ((k + f) % 2)
        flame(c, x, 9 - (0.5 if k in (1, 2) else 0), h, 2.6, 0.8)
    # taches jaunes
    for (x, y) in ((13, 11), (18, 10), (22, 12), (28, 11), (31, 12)):
        c.setf(x, y, SAL[4]); c.setf(x + 1, y, SAL[3])
    # tête plate
    hx, hy = 7, 10 - (1 if atk else 0)
    rball(c, hx, hy, 5.6, 3.6, SAL)
    inner(c, ell(hx - 1, hy + 2.6, 4.5, 1.2), SAL_BELLY[1])
    # œil saillant sur le dessus
    rball(c, hx, hy - 3, 2.6, 2.2, SAL)
    c.rect(int(hx - 2), int(hy - 4), 3, 2, '#ffe84a'); c.set(hx - 2, hy - 4, WHITE)
    c.set(hx - 1, hy - 4, INK); c.set(hx - 1, hy - 3, INK)
    c.line(hx - 3, hy - 5, hx + 1, hy - 5.5, SAL[0])
    c.set(hx - 5, hy - 1, INK)  # narine
    if atk:
        # gueule ouverte et souffle de feu
        spoly(c, [(hx - 6, hy + 0.5), (hx + 2, hy + 0.5), (hx - 4, hy + 4)], ['#2a0606', '#5a0c0c', '#7a1410'], edge=False)
        my = hy + 1.5
        for (x, r, col) in ((-12, 3.6, FIRE[0]), (-9, 3.4, FIRE[1]), (-5, 2.8, FIRE[2]), (-2, 2.0, FIRE[3]), (1, 1.3, FIRE[4])):
            for (px, py) in ell(x, my, r + 0.6, r):
                c.set(px, py, col)
        for (x, y, col) in ((-15, my - 3, FIRE[1]), (-16, my + 2, FIRE[0]), (-13, my + 4, FIRE[1]), (-10, my - 5, FIRE[2]),
                            (-6, my + 4, FIRE[2]), (-7, my - 4, FIRE[3])):
            c.set(x, y, col)
        c.set(-4, my - 1, FIRE[4]); c.set(-6, my, FIRE[3])
    else:
        c.line(hx - 6, hy + 1, hx + 2, hy + 1.5, INK)
        c.set(hx + 3, hy + 0.5, INK)
    # pattes proches
    for (hx2, hy2, fx) in ((10, 13, 8 + sw * 2), (23, 13, 22 - sw * 2)):
        shade(c, tube([(hx2, hy2), (fx - 1, G - 2), (fx, G)], [1.9, 1.4, 1.2]), SAL)
        c.line(fx - 2, G, fx + 1, G, SAL[2]); c.set(fx - 2, G, SAL[4])
    return c


ASH = ['#1e1a20', '#3e383e', '#686064', '#9a928c', '#ccc4b8']
ASH_EYE = ['#ffe080', '#ff8a1a', '#c83a0a']


def ash_wraith_draw(f):
    c = Canvas(30, 32)
    oy = 1 if f == 1 else 0
    atk = f == 2
    lx = -2 if atk else 0
    # traîne de cendre en lambeaux
    s = 1 if f == 1 else -1
    tail = [(7 + lx, 12 + oy), (17 + lx, 11 + oy), (21, 17 + oy), (25 + s, 22 + oy), (27, 27 + oy), (22, 24 + oy), (20 + s, 28 + oy),
            (17, 23 + oy), (14 - s, 27 + oy), (12, 21 + oy), (9, 23 + oy), (8 + lx, 17 + oy)]
    body = poly(tail)
    shade(c, body, ASH, contrast=0.42)
    # braises dans le tissu
    for (x, y) in ((18, 20), (22, 25), (12, 18), (15, 24)):
        c.setf(x + (f % 2), y + oy, EMBER[2])
    c.setf(19 + (f % 2), 21 + oy, EMBER[1])
    # bras lointain
    if atk:
        shade(c, tube([(15, 13), (8, 11), (1, 11)], [1.5, 1.3, 1.1]), dk(ASH, -0.1))
    else:
        shade(c, tube([(16, 14), (11, 17 - s), (8, 19 - s)], [1.5, 1.3, 1.1]), dk(ASH, -0.1))
    # capuche
    hx, hy = 11 + lx, 8 + oy
    hood = poly([(hx - 5, hy + 5), (hx - 6, hy), (hx - 3, hy - 5), (hx + 2, hy - 7), (hx + 6, hy - 4), (hx + 9, hy - 6),
                 (hx + 7, hy - 1), (hx + 7, hy + 5)])
    rshade(c, hood, hx, hy - 1, 7, 6.5, ASH)
    face = ell(hx - 1.5, hy + 0.5, 3.4, 3.4)
    shade(c, face, ['#08060a', '#140e14', '#1e161c'], edge=False, contrast=0.2)
    # yeux de braise
    for ex in (int(hx - 4), int(hx - 1)):
        c.set(ex, int(hy), ASH_EYE[0]); c.set(ex + 1, int(hy), ASH_EYE[1]); c.set(ex, int(hy) + 1, ASH_EYE[2])
    if atk:
        c.line(hx - 4, hy + 3, hx, hy + 3, ASH_EYE[2]); c.set(hx - 3, hy + 3, ASH_EYE[1])
    # bras proche : griffe calcinée
    if atk:
        lay(c, lambda t: shade(t, tube([(12, 14), (5, 15), (-2, 13)], [1.7, 1.5, 1.2]), ASH))
        for k in range(3):
            c.line(-2, 13, -5, 11 + k * 2, '#2a1a14'); c.set(-5, 11 + k * 2, EMBER[1])
        burst(c, -7, 13, (EMBER[0], EMBER[1]), 4, 8, 0.3)
    else:
        lay(c, lambda t: shade(t, tube([(12, 14), (6, 17 + s), (3, 18 + s)], [1.7, 1.5, 1.2]), ASH))
        for k in range(3):
            c.line(3, 18 + s, 0, 17 + s + k, '#2a1a14')
        c.set(0, 18 + s, EMBER[1])
    # fissures de braise sur le bras
    c.setf(8, 16 + (s if not atk else -1), EMBER[1])
    # cendres volantes
    for (x, y) in ((24, 8 - f), (3, 4 + f), (26, 15 + f), (20, 3)):
        c.set(x, y, ASH[3] if (x + f) % 3 else EMBER[1])
    return c


OBS = ['#08060c', '#16101e', '#2a2038', '#4a3c62', '#8a7cb8']
OBS_LAVA = ['#ffe080', '#ff8a1a', '#c8300a']


def obsidian_beetle_draw(f):
    c = Canvas(38, 24)
    G = 22
    atk = f == 2
    dx = (-2 if atk else 0) + 1
    sets = {0: (-1, 1, -1), 1: (1, -1, 1), 2: (-1, 0, 1)}[f]
    # pattes lointaines (courtes, sombres)
    for k, (hx, fx) in enumerate(((15, 13), (21, 22), (27, 30))):
        fx += sets[k] * -2
        kx = (hx + fx) / 2 + 1
        c.line(hx + dx * 0.5, 16, kx, 17, OBS[1]); c.line(kx, 17, fx, G - 1, OBS[1])
    # carapace en dôme (verre volcanique)
    cx = 21 + dx * 0.5
    shell = ell(cx, 13.5, 11.5, 9.5) - {(x, y) for x in range(-20, 60) for y in range(18, 40)}
    rshade(c, shell, cx - 1, 11, 11.5, 9.5, OBS, cuts=[-0.1, 0.25, 0.55, 0.82], lz=0.5)
    # bord inférieur de la carapace
    for (x, y) in shell:
        if (x, y + 1) not in shell:
            c.set(x, y, OBS[0])
            c.set(x, y - 1, OBS[2] if x < cx else OBS[1])
    # séparation des élytres
    for y in range(5, 17):
        c.setf(cx + 2 + (y - 5) * 0.3, y, OBS[0])
    # fissures de lave
    cracks = [[(13, 10), (16, 12), (15, 15)], [(26, 7), (28, 10), (31, 12), (31, 15)], [(19, 5), (20, 8), (18, 10)], [(24, 13), (26, 16)]]
    for cr in cracks:
        for a, b in zip(cr, cr[1:]):
            c.line(a[0] + dx * 0.5, a[1], b[0] + dx * 0.5, b[1], OBS_LAVA[1])
        for (x, y) in cr[1:-1]:
            c.setf(x + dx * 0.5, y, OBS_LAVA[0])
        x, y = cr[-1]
        c.setf(x + dx * 0.5, y, OBS_LAVA[2])
    # reflet spéculaire
    for (x, y) in ((14, 7), (15, 6), (16, 6), (17, 5)):
        c.setf(x + dx * 0.5, y, OBS[4])
    c.setf(15 + dx * 0.5, 8, '#d8d0f8'); c.setf(14 + dx * 0.5, 8, OBS[3])
    # tête, corne de rhinocéros
    hx, hy = 7 + dx, 14 + (1 if atk else 0)
    rball(c, hx + 1, hy, 4.4, 3.8, OBS[1:] + ['#b8b0e0'])
    if atk:
        p0, p1, p2 = (hx - 2, hy), (hx - 8, hy), (hx - 12, hy - 4)
    else:
        p0, p1, p2 = (hx - 2, hy), (hx - 7, hy - 1), (hx - 7, hy - 10)
    horn = tube(bez(p0, p1, p2, 8), [3.0, 2.6, 2.3, 2.0, 1.7, 1.4, 1.1, 0.8, 0.5])
    rshade(c, horn, (p0[0] + p2[0]) / 2, (p0[1] + p2[1]) / 2, 4, 5, OBS[1:] + ['#b8b0e0'], cuts=[-0.1, 0.25, 0.55, 0.82])
    c.set(p2[0], p2[1], OBS_LAVA[0]); c.set(p2[0] + 0.5, p2[1] + 1, OBS_LAVA[1])
    c.line(p1[0] + 1, p1[1] - 1, p2[0] + 0.5, p2[1] + 1.5, OBS_LAVA[2])
    # petite corne du pronotum
    spoly(c, [(hx + 3, hy - 3), (hx + 2, hy - 7), (hx + 6, hy - 3)], OBS)
    # mandibule
    c.line(hx - 3, hy + 3, hx - 5, hy + 3, OBS[3]); c.set(hx - 5, hy + 2, OBS[3])
    # œil de braise
    c.rect(int(hx - 1), int(hy - 1), 2, 2, OBS_LAVA[1]); c.set(hx - 1, hy - 1, OBS_LAVA[0])
    if atk:
        burst(c, p2[0] - 2, p2[1] - 1, (OBS_LAVA[0], OBS_LAVA[1]), 4, 8, 0.2)
        for (x, y) in ((p2[0] - 5, p2[1] + 4), (p2[0] + 1, p2[1] - 5)):
            c.set(x, y, OBS_LAVA[1])
    # pattes proches (segmentées)
    for k, (hx2, fx) in enumerate(((12, 8), (18, 17), (24, 27))):
        fx += sets[k] * 2
        kx, ky = (hx2 + fx) / 2 + (-1 if k == 0 else 1), 16
        shade(c, tube([(hx2 + dx * 0.5, 17), (kx, ky), (fx, G)], [1.2, 0.9, 0.6]), OBS[2:] + ['#b8b0e0'], contrast=0.3)
        c.set(kx, ky - 1, OBS_LAVA[1]); c.set(fx - 1, G, OBS[3])
    return c


# ================================================================ MONDE 10 — ROYAUME DU NÉANT

VFLESH = ['#140620', '#2e0e48', '#521e72', '#7e3aa0', '#b070d0']
VSCLERA = ['#6a5a90', '#b8acd8', '#e8e2f8', '#ffffff']
VIRIS = ['#5a0a4a', '#b01a8a', '#ff4ac8', '#ffb0f0']
BEAM = ['#ffffff', '#ffb0f0', '#ff4ac8', '#a01a8a']


def void_eye_draw(f):
    c = Canvas(30, 34)
    oy = 1 if f == 1 else 0
    atk = f == 2
    cx, cy = 15, 11 + oy
    # tentacules
    ph = (0, 2.6, 1.2)[f]
    for k, (bx, L, amp) in enumerate(((8, 16, 2.0), (12, 20, 2.4), (16, 21, 2.4), (20, 18, 2.2), (23, 14, 1.8))):
        pts, ws = [], []
        for i in range(9):
            t = i / 8
            pts.append((bx + math.sin(t * 5 + ph + k * 1.3) * amp * t + (t * 2 if atk else 0), cy + 6 + t * L))
            ws.append(1.9 * (1 - t) + 0.45)
        R = VFLESH if k % 2 == 0 else dk(VFLESH, -0.08)
        shade(c, tube(pts, ws), R, contrast=0.35)
        for i in (2, 4, 6):
            c.setf(pts[i][0] - 1, pts[i][1], VFLESH[4])
    # globe de chair
    rshade(c, ell(cx, cy, 10, 9.5), cx, cy, 10, 9.5, VFLESH)
    # veines
    for (a, b) in (((7, cy - 6), (9, cy - 3)), ((22, cy - 6), (21, cy - 3)), ((24, cy + 3), (21, cy + 2))):
        c.line(a[0], a[1], b[0], b[1], VFLESH[1])
    # œil
    open_ = 5.5 if atk else (4.6 if f == 0 else 4.0)
    sc = ell(cx - 1.5, cy, 6.5, open_)
    rshade(c, sc, cx - 1.5, cy, 6.5, open_, VSCLERA)
    ix = cx - 4
    rshade(c, ell(ix, cy, 3.4, min(3.4, open_ - 0.5)) & sc, ix, cy, 3.4, 3.4, VIRIS)
    c.rect(int(ix - 0.5), int(cy - 2), 1, 4 if not atk else 3, INK)
    if atk:
        c.rect(int(ix - 1), int(cy - 1), 2, 2, WHITE)
    else:
        c.set(ix - 2, cy - 2, WHITE); c.set(ix - 1, cy - 2, WHITE)
    # paupières
    for (x, y) in sc:
        if (x, y - 1) not in sc:
            c.set(x, y - 1, VFLESH[1])
        if (x, y + 1) not in sc:
            c.set(x, y + 1, VFLESH[1])
    # rayon
    if atk:
        for x in range(-14, int(ix) - 2):
            c.set(x, cy - 1, BEAM[1]); c.set(x, cy, BEAM[0]); c.set(x, cy + 1, BEAM[1])
            c.set(x, cy - 2, BEAM[2] if x % 2 else BEAM[3]); c.set(x, cy + 2, BEAM[2] if x % 2 == 0 else BEAM[3])
        burst(c, -14, cy, (BEAM[0], BEAM[2]), 4, 8, 0.4)
    # particules
    for (x, y) in ((26, 2 + oy), (3, 4 - oy), (27, 18)):
        c.set(x, y, VIRIS[3])
    return c


COSMOS = ['#08081e', '#14184a', '#232c7a', '#3c4eae', '#6a86dc']
NEBULA = ['#4a0a5a', '#9a2aa0', '#e05ad0', '#ffb0f0']
STAR_C = ['#ffffff', '#bff4ff', '#fff2a0']
CAT_EYE = ['#0a6a8a', '#2ad8ff', '#c0fbff']


def stars(c, mask, seed=0, every=11):
    k = 0
    for (x, y) in sorted(mask):
        k += 1
        h = (x * 73 + y * 151 + seed * 37) % every
        if h == 0 and (x - 1, y) in mask and (x + 1, y) in mask and (x, y - 1) in mask and (x, y + 1) in mask:
            col = STAR_C[(x + y) % 3]
            c.set(x, y, col)
            if (x * 7 + y) % 4 == 0:
                c.setf(x - 1, y, COSMOS[3]); c.setf(x + 1, y, COSMOS[3])


def star_stalker_draw(f):
    c = Canvas(38, 26)
    G = 24
    far = dk(COSMOS, -0.04)
    atk = f == 2
    by = -3 if atk else 0
    # queue en arc, étoile au bout
    tip = (36, 2) if f != 1 else (37, 5)
    if atk:
        tip = (37, 8)
    shade(c, tube(bez((27, 13 + by * 0.5), (35, 15), tip, 10), [1.6] * 11), COSMOS)
    burst(c, tip[0], tip[1], (STAR_C[0], STAR_C[2]), 2.6, 8)
    # pattes lointaines
    if atk:
        legsF = [((13, 12 + by), (5, 10)), ((26, 14), (31, G))]
    elif f == 1:
        legsF = [((13, 14), (14, G)), ((26, 14), (24, G))]
    else:
        legsF = [((13, 14), (11, G)), ((26, 14), (28, G))]
    for a, b in legsF:
        shade(c, tube([a, ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 1), b], [1.8, 1.3, 1.1]), far)
    # corps élancé
    body = rell(20, 12 + by * 0.5, 9.5, 4.2, -8 if atk else 0)
    rshade(c, body, 20, 12 + by * 0.5, 9.5, 4.2, COSMOS)
    stars(c, body, f)
    # pattes proches
    if atk:
        legsN = [((14, 13 + by), (4, 13)), ((25, 15), (29, G))]
    elif f == 1:
        legsN = [((14, 15), (10, G)), ((25, 15), (28, G))]
    else:
        legsN = [((14, 15), (14, G)), ((25, 15), (24, G))]
    for i, (a, b) in enumerate(legsN):
        shade(c, tube([a, ((a[0] + b[0]) / 2 + (1 if i else -0.5), (a[1] + b[1]) / 2 + 0.5), b], [2.2, 1.5, 1.3]), COSMOS)
        if atk and i == 0:
            for d in (-1, 1, 3):
                c.line(b[0], b[1], b[0] - 3, b[1] + d - 1, STAR_C[1])
        else:
            c.line(b[0] - 2, G, b[0] + 1, G, COSMOS[3])
    # crinière de nébuleuse
    mane = poly([(9, 3 + by), (12, 0 + by), (14, 3 + by), (17, 1 + by), (17, 5 + by), (20, 5 + by), (17, 9 + by), (19, 12 + by), (14, 12 + by), (9, 12 + by)])
    shade(c, mane, NEBULA, contrast=0.4)
    for (x, y) in ((13, 4), (16, 7), (12, 10)):
        c.setf(x, y + by, STAR_C[0])
    # tête de félin
    hx, hy = 8, 8 + by + (1 if f == 1 else 0)
    rshade(c, ell(hx, hy, 5, 4.4), hx, hy, 5, 4.4, COSMOS)
    spoly(c, [(hx - 3, hy - 2), (hx - 3, hy - 7), (hx, hy - 3)], COSMOS)
    spoly(c, [(hx + 1, hy - 3), (hx + 3, hy - 7.5), (hx + 4, hy - 2)], COSMOS)
    c.set(hx - 2, hy - 4, NEBULA[2]); c.set(hx + 2, hy - 4, NEBULA[2])
    # museau
    rshade(c, ell(hx - 3.5, hy + 1.5, 2.4, 1.8), hx - 3.5, hy + 1.5, 2.4, 1.8, COSMOS)
    c.set(hx - 6, hy + 1, NEBULA[3])
    # yeux luisants
    ex, ey = int(hx - 3), int(hy - 1)
    c.rect(ex, ey, 3, 2, CAT_EYE[1]); c.set(ex, ey, CAT_EYE[2]); c.set(ex + 1, ey, INK); c.set(ex + 1, ey + 1, INK)
    c.set(ex + 4, ey, CAT_EYE[1])
    if atk:
        c.rect(int(hx - 6), int(hy + 2), 4, 2, INK); c.set(hx - 6, hy + 2, WHITE); c.set(hx - 3, hy + 2, WHITE)
        c.set(hx - 5, hy + 3, '#a01a6a')
    else:
        c.set(hx - 5, hy + 3, INK); c.set(hx - 4, hy + 3, INK)
    c.set(hx - 7, hy + 2, STAR_C[1]); c.set(hx - 8, hy + 1, STAR_C[1])  # moustaches
    return c


SK = ['#120a20', '#261640', '#40286a', '#64449e', '#9a7ad4']
SK_TRIM = ['#3a2a5a', '#6a5aa0', '#a69ad8', '#e0dcfa']
SK_CAPE = ['#08040e', '#160c24', '#281840', '#3c2660']
SK_GLOW = ['#7a1aa0', '#c84af0', '#f0a0ff', '#ffffff']
SK_BLADE = ['#140c22', '#2e2048', '#4e3a78', '#8a72c0']


def greatsword(c, grip, ang, ln=22):
    a = math.radians(ang)
    ux, uy = math.cos(a), math.sin(a)
    px, py = -uy, ux
    tip = (grip[0] + ux * ln, grip[1] + uy * ln)
    base = (grip[0] + ux * 3, grip[1] + uy * 3)
    pts = [(base[0] + px * 2, base[1] + py * 2), (tip[0] - ux * 3 + px * 1.6, tip[1] - uy * 3 + py * 1.6), tip,
           (tip[0] - ux * 3 - px * 1.6, tip[1] - uy * 3 - py * 1.6), (base[0] - px * 2, base[1] - py * 2)]
    spoly(c, pts, SK_BLADE, contrast=0.4)
    c.line(base[0] + ux, base[1] + uy, tip[0] - ux * 2, tip[1] - uy * 2, SK_GLOW[1])
    c.line(base[0] + ux * 2 + px * 0.7, base[1] + uy * 2 + py * 0.7, tip[0] - ux * 4 + px * 0.7, tip[1] - uy * 4 + py * 0.7, SK_GLOW[2])
    # garde
    c.line(base[0] + px * 3.5, base[1] + py * 3.5, base[0] - px * 3.5, base[1] - py * 3.5, SK_TRIM[2])
    c.line(base[0] + px * 3.5 + ux, base[1] + py * 3.5 + uy, base[0] - px * 3.5 + ux, base[1] - py * 3.5 + uy, SK_TRIM[1])
    # poignée + pommeau
    c.line(grip[0] - ux * 2, grip[1] - uy * 2, grip[0] + ux * 2, grip[1] + uy * 2, LEATHER[1])
    c.set(grip[0] - ux * 3, grip[1] - uy * 3, SK_GLOW[2])
    return tip


def shadow_knight_draw(f):
    c = Canvas(34, 38)
    G = 36
    farA = dk(SK, -0.06)
    atk = f == 2
    s = 1 if f == 1 else 0
    # cape en lambeaux
    if atk:
        cape = [(14, 10), (20, 10), (26, 18), (30, 29), (27, 27), (26, 31), (23, 28), (21, 32), (18, 27)]
    else:
        cape = [(13, 10), (19, 10), (23, 18), (25 + s, 31), (23, 29), (22 - s, 33), (20, 30), (18, 34 - s), (16, 29)]
    shade(c, poly(cape), SK_CAPE, contrast=0.35)
    # bras lointain
    if not atk:
        shade(c, tube([(18, 14), (17, 19), (12, 20 - s)], [1.9, 1.7, 1.7]), farA)
    # jambes
    if f == 1:
        legs = [((16, 24), (18, G), farA), ((12, 24), (10, G), SK)]
    elif atk:
        legs = [((17, 24), (22, G), farA), ((12, 24), (7, G), SK)]
    else:
        legs = [((16, 24), (16, G), farA), ((12, 24), (12, G), SK)]
    for hip, foot, R in legs:
        shade(c, tube([hip, ((hip[0] + foot[0]) / 2, 30), (foot[0], G - 1)], [2.6, 2.2, 2.4]), R)
        rball(c, (hip[0] + foot[0]) / 2 - 0.5, 30, 1.9, 1.7, SK_TRIM)
        spoly(c, [(foot[0] - 4, G + 1), (foot[0] - 2.5, G - 2), (foot[0] + 2.5, G - 2), (foot[0] + 2.5, G + 1)], R)
    # torse cuirassé
    torso = poly([(8, 13), (19, 12), (20, 18), (18, 25), (10, 25), (8, 18)])
    rshade(c, torso, 13, 16, 7, 8, SK)
    c.line(13, 14, 13, 23, SK[1]); c.line(12, 15, 12, 22, SK[3])
    rball(c, 13, 18, 1.7, 1.7, SK_GLOW[1:])
    c.line(9, 24, 19, 24, SK_TRIM[2]); c.line(9, 25, 19, 25, SK_TRIM[1])
    spoly(c, [(9, 25), (19, 25), (20, 28), (8, 28)], SK)
    c.line(13, 25, 13, 28, SK[0])
    # heaume à cornes recourbées vers l'arrière
    hy = 7 + s
    hx = 12 - (1 if atk else 0)
    shade(c, tube(bez((hx + 2, hy - 3), (hx + 5, hy - 7), (hx + 8, hy - 6), 8), [1.6, 1.5, 1.3, 1.1, 0.9, 0.8, 0.6, 0.5, 0.4]), SK_TRIM, contrast=0.4)
    rshade(c, ell(hx, hy, 5, 5.2), hx, hy, 5, 5.2, SK)
    shade(c, tube(bez((hx - 1, hy - 4), (hx + 1, hy - 9), (hx + 6, hy - 9), 8), [1.8, 1.6, 1.4, 1.2, 1.0, 0.8, 0.7, 0.5, 0.4]), SK_TRIM, contrast=0.4)
    # visière : fente luisante
    c.rect(int(hx - 5), int(hy - 0.5), 6, 2, INK)
    c.set(hx - 4, hy - 0.5, SK_GLOW[2]); c.set(hx - 3, hy - 0.5, SK_GLOW[3]); c.set(hx - 2, hy - 0.5, SK_GLOW[2])
    c.set(hx - 4, hy + 0.5, SK_GLOW[0]); c.set(hx - 3, hy + 0.5, SK_GLOW[1])
    c.line(hx - 2, hy + 2, hx - 2, hy + 4, SK[0])
    c.line(hx - 4, hy - 3, hx - 1, hy - 4, SK[4])
    # épaulières
    rball(c, 17, 12.5, 3, 2.6, dk(SK, -0.04))
    if atk:
        # arc de taille violet (croissant)
        arc = ell(9, 19, 13, 13) - ell(11.5, 19, 12, 12.5)
        arc = {(x, y) for (x, y) in arc if x < 5}
        for (x, y) in arc:
            d = abs(y - 20) / 13
            c.set(x, y, SK_GLOW[3] if d < 0.3 else SK_GLOW[2] if d < 0.6 else SK_GLOW[1])
        shade(c, tube([(10, 15), (6, 17), (3, 18)], [2, 1.8, 1.8]), SK)
        greatsword(c, (3, 18), 178, 22)
        rball(c, 3, 18, 2, 2, SK_TRIM)
    else:
        # garde haute : lame pointée vers le haut, en avant
        # épée plantée pointe en bas, devant lui
        greatsword(c, (6, 18 - s), 98, 18 + s)
        shade(c, tube([(10, 15), (7, 17), (6, 18 - s)], [2, 1.8, 1.8]), SK)
        rball(c, 6, 18 - s, 1.9, 1.9, SK_TRIM)
    rball(c, 9, 13, 3.4, 2.8, SK)
    c.set(8, 12, SK_TRIM[3]); c.set(7, 13, SK_TRIM[2])
    return c


VL = ['#0a0614', '#1e1036', '#3a1e62', '#5c3896', '#9068cc']
VL_GLOW = ['#0a8aa8', '#3ae8ff', '#c8fcff']
VL_HORN = ['#3a2a3a', '#6a5a72', '#a69ab0', '#e0d8ec']


def voidling_draw(f):
    c = Canvas(26, 24)
    G = 22
    atk = f == 2
    oy = -2 if f == 1 else 0
    lx = -2 if atk else 0
    # queue à pointe
    c.line(16, 16 + oy, 21, 15 + oy, VL[2]); c.line(21, 15 + oy, 23, 12 + oy, VL[2])
    spoly(c, [(22, 10 + oy), (25, 9 + oy), (24, 13 + oy)], VL_GLOW)
    # ailerons
    wy = 0 if f != 1 else 2
    spoly(c, [(15, 9 + oy), (20, 3 + oy + wy), (23, 5 + oy + wy), (20, 7 + oy + wy), (21, 10 + oy + wy), (16, 12 + oy)], dk(VL, -0.02))
    # pattes
    if f == 1:
        feet = ((9, G), (14, G))
        for (x, y) in feet:
            shade(c, tube([(x + 1, 15 + oy), (x, G - 1)], [1.6, 1.4]), VL)
    else:
        feet = ((8 + lx, G), (14, G))
        for (x, y) in feet:
            shade(c, tube([(x + 1, 17), (x, G - 1)], [1.7, 1.4]), VL)
    for (x, y) in feet:
        c.rect(x - 2, G, 4, 1, VL[2]); c.set(x - 2, G, VL[3])
    # corps-boule
    bx, by = 12 + lx, 11 + oy
    rshade(c, ell(bx, by, 7.5, 7), bx, by, 7.5, 7, VL)
    for (x, y) in ((bx + 3, by + 3), (bx + 5, by - 1), (bx + 1, by + 5)):
        c.setf(x, y, STAR_C[1])
    c.setf(bx - 4, by - 5, VL[4]); c.setf(bx - 3, by - 6, '#c0a8ec')
    # cornes
    spoly(c, [(bx - 5, by - 4), (bx - 7, by - 10), (bx - 2, by - 6)], VL_HORN)
    spoly(c, [(bx + 1, by - 6.5), (bx + 3, by - 11), (bx + 4, by - 5)], VL_HORN)
    # yeux
    ey = int(by - 3)
    for ex in (int(bx - 6), int(bx - 1)):
        c.rect(ex, ey, 3, 2, VL_GLOW[1]); c.set(ex, ey, VL_GLOW[2])
    c.line(bx - 7, ey - 1, bx - 4, ey, INK); c.line(bx - 1, ey, bx + 2, ey - 1, INK)
    # sourire à dents
    if atk:
        mouth = poly([(bx - 8, by), (bx + 3, by - 0.5), (bx + 2, by + 5), (bx - 6, by + 5)])
        for (x, y) in mouth:
            c.set(x, y, '#12081e')
        for x in range(int(bx - 7), int(bx + 3), 2):
            c.set(x, by, VL_GLOW[2]); c.set(x + 1, by + 4, VL_GLOW[1])
        c.set(bx - 3, by + 3, '#a01a6a'); c.set(bx - 2, by + 3, '#d03a8a')
    else:
        my = int(by + 1)
        c.rect(int(bx - 5), my, 6, 2, INK)
        c.set(bx - 6, my - 1, INK); c.set(bx + 1, my - 1, INK)
        for x in (bx - 5, bx - 3, bx - 1):
            c.set(x, my, VL_GLOW[2])
        c.set(bx - 4, my + 1, VL_GLOW[1]); c.set(bx - 2, my + 1, VL_GLOW[1])
    # petits bras
    if atk:
        shade(c, tube([(bx - 3, by + 4), (bx - 8, by + 3)], [1.5, 1.2]), VL)
        for d in (-1, 0, 1):
            c.set(bx - 9, by + 3 + d, VL_GLOW[2])
    else:
        shade(c, tube([(bx - 4, by + 4), (bx - 7, by + 6 + (1 if f == 1 else 0))], [1.4, 1.1]), VL)
    return c


# ================================================================ export

NAMES = ['toad', 'bog_zombie', 'leech_fly', 'lizardman',
         'harpy', 'cloud_spirit', 'griffin_cub', 'sky_automaton',
         'magma_slime', 'salamander', 'ash_wraith', 'obsidian_beetle',
         'void_eye', 'star_stalker', 'shadow_knight', 'voidling']
FLYING = {'leech_fly', 'harpy', 'ash_wraith', 'void_eye'}


def build():
    g = globals()
    out = {}
    for name in NAMES:
        a, b, k = triple(g[name + '_draw'])
        out[name] = (a, {})
        out[name + '_b'] = (b, {})
        out[name + '_atk'] = (k, {})
    return out
