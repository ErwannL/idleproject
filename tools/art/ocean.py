"""v9.2.0 (monde marin) : monstres et boss du monde 11, le Royaume englouti (chibi 16 bits, lumière en haut à gauche).

  Communs : sea_bladefish (poisson-lame), sea_jelly (méduse), sea_crab (crabe, marche sur le fond), sea_eel (anguille),
            sea_puffer (poisson-globe), sea_octopus (poulpe), sea_shark (requin), sea_merfolk (triton au trident)
  Boss    : mini_crab_king (étape 5), mid_kraken (10), hard_megalodon (15), boss_leviathan (méga boss, 20)
  Icône   : set_ocean (emblème de la Parure des marées, 12×12)

Chaque créature regarde à GAUCHE et produit trois images de même taille : <nom> (nage 1), <nom>_b (nage 2 : queue,
cloche ou tentacules dans l'autre phase) et <nom>_atk (attaque). L'ondulation continue (queue qui bat, cloche qui pulse,
corps d'anguille) est ajoutée au rendu (src/render/ocean-fx.js) ; les images donnent la pose.
Ombrage « contre-ombré » des poissons : dos sombre, flanc moyen, ventre clair, reflet le long du dos.
Couleurs fixes, contour '#1a1226', sortie déterministe. Usage : python3 tools/art/ocean_build.py (fusion dans art.js).
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from enemies import Canvas, OUT, INK, WHITE, shade_mask, dk, GOLD  # noqa: E402
from enemies2 import ell, rell, tube, rshade, rball, shade, lay, poly, triple  # noqa: E402

# ------------------------------------------------------------------ palettes
SILVER = ['#1c2a44', '#2e4a72', '#4a78a8', '#7eb0d4', '#c8e6f4']
SILVER_B = ['#5a7488', '#9ab8c8', '#d4e8f0', '#f4fcff']
FIN_BLUE = ['#123050', '#1e5a8a', '#3a8ec0', '#7cc8e8']
JELLY = ['#3a1a5a', '#7a3aa8', '#b06ad8', '#e0a8f4', '#fae4ff']
JELLY_GLOW = ['#2ad0e8', '#8af4ff', '#eaffff']
CRAB = ['#4a0e0a', '#8a2014', '#c8441e', '#f07a3a', '#ffbc7a']
CRAB_B = ['#8a4a2a', '#d08a5a', '#f4c494', '#fff0d0']
EEL = ['#16261a', '#2a4a26', '#4a7a30', '#82ac3a', '#c4dc6a']
EEL_B = ['#8a7a2a', '#d0bc4a', '#f4e47a', '#fffbc8']
ZAP = ['#3ab0ff', '#9ae8ff', '#ffffff']
PUFF = ['#5a3a0a', '#a06a14', '#e0a82a', '#f8d860', '#fff4b0']
PUFF_B = ['#a08a5a', '#e0d0a0', '#fff6dc', '#ffffff']
OCTO = ['#2a0a2e', '#5a1a5a', '#9a3a8a', '#d06ab0', '#f4b0dc']
OCTO_S = ['#6a2a5a', '#b06aa0', '#e8b0d8']
SHARK = ['#1a2232', '#2e3e56', '#4e6680', '#7e98b0', '#c0d0de']
SHARK_B = ['#8a9aa8', '#c8d4dc', '#eef4f8', '#ffffff']
MER = ['#0e3a3a', '#1a6a62', '#2ea08a', '#62ccae', '#b0f0d8']
MER_SKIN = ['#3a5a6a', '#5a8a9a', '#8abcc8', '#c4e8ee', '#f0ffff']
MER_HAIR = ['#0a2a3a', '#145a6a', '#2a8a9a', '#5ac0c8']
CORAL = ['#6a1428', '#b02a4a', '#e85a7a', '#ffa0b8']
PEARL = ['#8a9ab0', '#c8d4e4', '#f0f6ff', '#ffffff']
LEVI = ['#06222a', '#0e3e48', '#18646e', '#2a9294', '#62c8bc', '#b4f0e0']
LEVI_B = ['#5a7a6a', '#9ac0a8', '#d4ecd4', '#f4fff0']
LEVI_FIN = ['#2a0e3a', '#5a1a6a', '#9a3a9a', '#d870c8', '#ffb4ec']
TEETH = ['#a8a090', '#e8e4d4', '#ffffff']
MOUTH = ['#2a0a12', '#5a1424', '#8a2a3a']


# ------------------------------------------------------------------ outils

def body_mask(x0, x1, yc, rt, rb):
    """Corps défini par une ligne médiane yc(x) et des demi-épaisseurs dessus rt(x) / dessous rb(x)."""
    m = set()
    for x in range(int(math.floor(x0)), int(math.ceil(x1)) + 1):
        c, a, b = yc(x + 0.5), rt(x + 0.5), rb(x + 0.5)
        if a <= 0.2 and b <= 0.2:
            continue
        for y in range(int(math.floor(c - a)) - 1, int(math.ceil(c + b)) + 1):
            if c - a <= y + 0.5 <= c + b:
                m.add((x, y))
    return m


def countershade(c, mask, yc, rt, rb, BACK, BELLY, x_front=None, shine=True):
    """Dos sombre → flanc → ventre clair ; reflet sur le dos, avant un peu plus lumineux (lumière en haut à gauche)."""
    xs = [p[0] for p in mask]
    xa, xb = min(xs), max(xs)
    for (x, y) in mask:
        cy, a, b = yc(x + 0.5), max(rt(x + 0.5), 0.6), max(rb(x + 0.5), 0.6)
        v = (y + 0.5 - cy) / (a if y + 0.5 < cy else b)
        front = 1 - (x - xa) / max(1, xb - xa)
        if v < -0.62:
            col = BACK[1]
        elif v < -0.15:
            col = BACK[2] if front < 0.55 else BACK[3]
        elif v < 0.3:
            col = BACK[3] if front < 0.7 else BACK[4] if len(BACK) > 4 else BACK[3]
        elif v < 0.78:
            col = BELLY[2]
        else:
            col = BELLY[1]
        c.set(x, y, col)
    if shine:
        for x in range(xa + 2, xa + int((xb - xa) * 0.65)):
            cy, a = yc(x + 0.5), rt(x + 0.5)
            y = int(math.floor(cy - a * 0.55))
            if (x, y) in mask and (x + y) % 5:
                c.set(x, y, BACK[-1])


def eye(c, x, y, size=2, iris='#ffe25a', glow=False):
    if size >= 3:
        c.rect(x - 1, y - 1, 3, 3, WHITE)
        c.rect(x - 1, y, 2, 2, iris)
        c.set(x - 1, y, INK); c.set(x - 1, y + 1, INK)
        c.set(x + 1, y - 1, '#ffffff')
    elif size == 2:
        c.rect(x, y, 2, 2, iris if glow else WHITE)
        c.set(x, y + 1, INK)
        c.set(x, y, INK if not glow else '#ffffff')
    else:
        c.set(x, y, INK)


def fin(c, pts, R, contrast=0.3):
    m = poly(pts)
    shade(c, m, R, contrast=contrast)
    return m


def fin_rays(c, base, tips, col):
    for t in tips:
        c.line(base[0], base[1], t[0], t[1], col)


def bubbles(c, pts):
    for (x, y, r) in pts:
        if r <= 1:
            c.set(x, y, '#c8f4ff')
        else:
            for (px, py) in ell(x, y, r, r):
                if abs(math.hypot(px + 0.5 - x, py + 0.5 - y) - r) < 0.75:
                    c.set(px, py, '#a8e8ff')
            c.set(x - r * 0.4, y - r * 0.4, '#ffffff')


def zap(c, pts, cols=ZAP):
    for (a, b) in zip(pts, pts[1:]):
        c.line(a[0], a[1], b[0], b[1], cols[1])
    for p in pts[1:-1]:
        c.set(p[0], p[1], cols[2])


def teeth_row(c, x0, x1, y, down=True, step=2):
    for x in range(int(x0), int(x1) + 1, step):
        c.set(x, y, TEETH[2])
        c.set(x, y + (1 if down else -1), TEETH[1])


# ================================================================ communs

def sea_bladefish_draw(f):
    """Poisson-lame (espadon) : rostre en lame d'acier, nageoire dorsale en voile."""
    c = Canvas(40, 18)
    tail = (-2.5, 2.5, 0)[f]  # battement de queue
    atk = f == 2

    def yc(x):
        return 9 + (0.0 if x < 22 else tail * ((x - 22) / 14) ** 1.6)

    def rt(x):
        return 0 if x < 7 or x > 34 else 4.6 * math.sin(math.pi * (x - 7) / 27) ** 0.7

    def rb(x):
        return 0 if x < 7 or x > 34 else 3.8 * math.sin(math.pi * (x - 7) / 27) ** 0.8

    # nageoire caudale en croissant
    ty = yc(34)
    fin(c, [(33, ty), (40, ty - 7 + tail * 0.4), (38, ty), (40, ty + 6 + tail * 0.4)], FIN_BLUE)
    # voile dorsale
    fin(c, [(12, 6), (16, -1 + (1 if f == 1 else 0)), (22, 1), (26, 5)], FIN_BLUE)
    fin_rays(c, (17, 6), [(16, 1), (19, 1), (22, 3)], FIN_BLUE[0])
    m = body_mask(6, 35, yc, rt, rb)
    countershade(c, m, yc, rt, rb, SILVER, SILVER_B)
    # rayures sombres
    for x in (16, 20, 24):
        for y in range(int(yc(x) - rt(x)) + 1, int(yc(x) + 1)):
            c.setf(x, y, SILVER[1])
    # rostre (lame)
    L = 9 if atk else 6
    c.line(7 - L, 8 + (0 if not atk else 0), 7, 8, '#e8f0f8')
    c.line(7 - L + 1, 9, 7, 9, '#8aa0b8')
    c.set(7 - L, 8, WHITE)
    # pectorale
    fin(c, [(14, 11), (19, 12), (15, 15 + (1 if f == 1 else 0))], dk(FIN_BLUE, 0.04))
    eye(c, 10, 7, 2, glow=atk, iris='#ff4a3a')
    if atk:
        bubbles(c, [(27, 2, 1), (30, 4, 1), (36, 1, 2)])
    return c


def sea_jelly_draw(f):
    """Méduse spectrale : cloche translucide qui pulse, points lumineux, tentacules ondulants."""
    c = Canvas(26, 34)
    squeeze = (0, 1, 0)[f]
    atk = f == 2
    bw, bh = (9.5 + squeeze * 1.6, 7.5 - squeeze * 1.2)
    cx, cy = 13, 9 + squeeze
    # tentacules (derrière la cloche), ondulants
    for i, tx in enumerate((7, 10, 13, 16, 19)):
        pts = []
        for k in range(9):
            yy = cy + 4 + k * (2.2 if not atk else 2.0)
            ph = (k * 0.8 + i * 1.3 + f * 1.6)
            xx = tx + math.sin(ph) * (1.2 + k * 0.15) - (k * 0.9 if atk else 0)
            pts.append((xx, yy))
        for a, b in zip(pts, pts[1:]):
            c.line(a[0], a[1], b[0], b[1], JELLY[2] if i % 2 else JELLY[3])
        c.set(pts[-1][0], pts[-1][1], JELLY_GLOW[1])
    # bras oraux (rubans) au centre
    for k in range(7):
        x = cx - 1 + math.sin(k * 0.9 + f) * 1.5 - (k * 0.6 if atk else 0)
        c.rect(int(x), int(cy + 4 + k * 2), 2, 2, JELLY[1] if k % 2 else JELLY[2])
    # cloche
    bell = {(x, y) for (x, y) in ell(cx, cy, bw, bh) if y <= cy + 3}
    rshade(c, bell, cx, cy, bw, bh, JELLY)
    # bord festonné
    for x in range(int(cx - bw) + 1, int(cx + bw)):
        if x % 2 == 0:
            c.set(x, cy + 4, JELLY[2])
    # organes lumineux
    for (gx, gy) in ((cx - 3, cy - 1), (cx + 2, cy - 2), (cx, cy + 1), (cx + 5, cy + 1), (cx - 6, cy + 1)):
        c.set(gx, gy, JELLY_GLOW[1 if not atk else 2])
    c.set(cx - 4, cy - 4, JELLY[4]); c.set(cx - 3, cy - 5, WHITE)
    if atk:
        zap(c, [(4, 20), (1, 23), (3, 26), (-1, 29)], [JELLY_GLOW[0], JELLY_GLOW[1], WHITE])
        zap(c, [(9, 24), (6, 28), (8, 31)], [JELLY_GLOW[0], JELLY_GLOW[1], WHITE])
    return c


def sea_crab_draw(f):
    """Crabe des récifs : carapace rouge, pinces, pattes qui marchent sur le fond."""
    c = Canvas(36, 22)
    G = 21
    atk = f == 2
    lift = 1 if f == 1 else 0
    # pattes (arrière-plan)
    for i, lx in enumerate((12, 16, 20, 24)):
        up = (i + f) % 2
        knee = (lx + 3, 13 - up)
        c.line(lx, 13, knee[0], knee[1], CRAB[1])
        c.line(knee[0], knee[1], lx + 4 + (i % 2), G, CRAB[1])
        c.set(lx + 4 + (i % 2), G, CRAB[0])
    # carapace
    shell = ell(19, 12 - lift, 10.5, 6.5)
    rshade(c, shell, 19, 11 - lift, 10.5, 6.5, CRAB)
    # tubercules
    for (x, y) in ((15, 8), (19, 7), (23, 8), (17, 10), (21, 10)):
        c.setf(x, y - lift, CRAB[4])
        c.setf(x + 1, y + 1 - lift, CRAB[1])
    # ventre
    for x in range(12, 27):
        c.setf(x, 16 - lift, CRAB_B[1])
    # yeux pédonculés
    for ex in (12, 15):
        c.line(ex, 7 - lift, ex - 1, 3 - lift, CRAB[2])
        rball(c, ex - 1, 2.5 - lift, 1.4, 1.4, ['#1a1226', '#2a2a3a', '#ffffff', '#ffffff'])
    # pinces
    def claw(x, y, open_, big):
        r = 3.6 if big else 2.6
        shade(c, tube([(13, 13 - lift), (x + 4, y + 2)], [1.6, 1.4]), CRAB)
        rball(c, x, y, r + 0.6, r, CRAB)
        # mors
        c.line(x - r - 1, y - (2 if open_ else 0), x - 1, y, CRAB[3])
        c.line(x - r - 1, y + (2 if open_ else 1), x - 1, y + 1, CRAB[1])
        if open_:
            for k in range(int(r)):
                c.set(x - 1 - k, y + 0, MOUTH[0])
    if atk:
        claw(3, 6, True, True)
    else:
        claw(6, 12 - lift, f == 1, True)
    claw(9, 16 - lift, False, False)
    return c


def sea_eel_draw(f):
    """Anguille électrique : corps sinueux jaune-vert, taches électriques, mâchoire ouverte à l'attaque."""
    c = Canvas(52, 18)
    ph = (0.0, math.pi, 0.6)[f]
    atk = f == 2

    def yc(x):
        k = max(0, (x - 8) / 40)
        return 9 + math.sin(x * 0.28 + ph) * 3.2 * k

    def rt(x):
        return 0 if x < 3 or x > 49 else 3.2 * (1 - max(0, (x - 12) / 40)) ** 0.6 + (0.6 if x < 10 else 0)

    rb = rt
    # nageoire dorsale continue
    for x in range(14, 48, 1):
        y = yc(x) - rt(x) - 1
        if x % 3:
            c.set(x, y, EEL[3] if x % 2 else EEL[2])
    m = body_mask(2, 49, yc, rt, rb)
    countershade(c, m, yc, rt, rb, EEL, EEL_B)
    # taches électriques
    for x in range(14, 46, 5):
        c.setf(x, int(yc(x)), ZAP[1])
        c.setf(x + 1, int(yc(x)), ZAP[0])
    # tête
    hx = 5
    if atk:
        c.line(1, 8, 9, 10, MOUTH[0])
        c.rect(0, 9, 6, 3, MOUTH[1])
        teeth_row(c, 1, 6, 9, True)
        zap(c, [(-1, 6), (-5, 3), (-3, 9), (-8, 11)])
        zap(c, [(20, 2), (24, -1), (28, 2)])
    else:
        c.line(1, 10, 7, 10 + (0 if f == 0 else 1), INK)
    eye(c, hx + 1, 6, 2, iris='#ffea4a', glow=atk)
    return c


def sea_puffer_draw(f):
    """Poisson-globe : boule jaune hérissée ; gonflé à l'attaque."""
    c = Canvas(30, 28)
    atk = f == 2
    r = 10.5 if atk else 8
    cx, cy = 15, 14
    # queue
    tw = (2, -2, 0)[f]
    fin(c, [(cx + r - 1, cy), (cx + r + 6, cy - 4 + tw), (cx + r + 5, cy + 4 + tw)], ['#7a4a0a', '#c0841a', '#f0b83a', '#ffe08a'])
    # piquants
    n = 16 if atk else 11
    for i in range(n):
        a = i * 2 * math.pi / n + 0.2
        L = 3.5 if atk else 2
        x0, y0 = cx + math.cos(a) * (r - 0.5), cy + math.sin(a) * (r - 0.5)
        c.line(x0, y0, cx + math.cos(a) * (r + L), cy + math.sin(a) * (r + L), PUFF[1])
        c.set(cx + math.cos(a) * (r + L), cy + math.sin(a) * (r + L), PUFF[4])
    body = ell(cx, cy, r, r * (0.92 if atk else 0.85))
    rshade(c, body, cx, cy, r, r, PUFF)
    # ventre clair
    for (x, y) in body:
        if y > cy + r * 0.35:
            c.set(x, y, PUFF_B[1] if y < cy + r * 0.7 else PUFF_B[0])
    # taches
    for (x, y) in ((cx + 2, cy - 5), (cx + 5, cy - 2), (cx - 1, cy - 3), (cx + 4, cy + 2)):
        c.setf(x, y, PUFF[1])
    # nageoire pectorale
    pf = (0, 2, 0)[f]
    fin(c, [(cx + 1, cy + 1), (cx + 6, cy - 1 + pf), (cx + 5, cy + 4 + pf)], ['#a06a14', '#e0a82a', '#fff4b0'])
    eye(c, cx - int(r * 0.45), cy - 3, 3, iris='#3a2a0a')
    # bouche
    if atk:
        c.rect(cx - int(r) - 1, cy + 1, 2, 2, MOUTH[1])
        c.set(cx - int(r) - 1, cy + 1, MOUTH[0])
    else:
        c.set(cx - int(r), cy + 2, MOUTH[1]); c.set(cx - int(r) + 1, cy + 2, MOUTH[0])
    return c


def tentacle(c, root, ang, L, curl, w0, R, suckers=None, seg=10):
    """Tentacule effilé (angle en degrés, 90 = vers le bas), qui s'enroule (curl en degrés par segment)."""
    pts = [root]
    a = math.radians(ang)
    x, y = root
    step = L / seg
    for k in range(seg):
        a += math.radians(curl) * (k / seg) * 2
        x += math.cos(a) * step
        y += math.sin(a) * step
        pts.append((x, y))
    widths = [w0 * (1 - k / (seg + 1)) + 0.4 for k in range(seg + 1)]
    m = tube(pts, widths)
    shade(c, m, R, contrast=0.32)
    if suckers:
        for k in range(1, seg - 1, 2):
            px, py = pts[k]
            c.setf(px + 0.5, py + widths[k] * 0.6, suckers)
    return pts


def sea_octopus_draw(f):
    """Poulpe des grottes : tête violette en bulbe, huit bras qui ondulent (fouet en avant à l'attaque)."""
    c = Canvas(34, 30)
    atk = f == 2
    hx, hy = 18, 9
    ph = (0, 1, 0.5)[f]
    back = dk(OCTO, -0.08)
    # bras arrière
    for i, (ang, curl) in enumerate(((60, 20), (80, -15), (100, 18), (120, -20))):
        tentacle(c, (hx - 3 + i * 2.5, hy + 7), ang + math.sin(ph * 3 + i) * 10, 15, curl * (1 if f != 1 else -1), 2.2, back)
    # tête
    head = ell(hx + 1, hy, 8, 8.5)
    rshade(c, head, hx + 1, hy, 8, 8.5, OCTO)
    for (x, y) in ((hx + 3, hy - 4), (hx + 6, hy - 1), (hx, hy - 6), (hx + 4, hy + 2)):
        c.setf(x, y, OCTO_S[2])
    # bras avant
    if atk:
        tentacle(c, (hx - 4, hy + 6), 185, 22, -2, 2.4, OCTO, OCTO_S[2], seg=12)
        tentacle(c, (hx - 2, hy + 8), 160, 16, 8, 2.2, OCTO, OCTO_S[2])
    else:
        tentacle(c, (hx - 4, hy + 6), 125 + ph * 10, 16, 22 if f == 0 else -18, 2.4, OCTO, OCTO_S[2])
        tentacle(c, (hx - 1, hy + 8), 95 - ph * 10, 15, -20 if f == 0 else 20, 2.3, OCTO, OCTO_S[2])
    tentacle(c, (hx + 3, hy + 8), 70 + ph * 12, 14, 22, 2.2, OCTO, OCTO_S[2])
    # yeux (gros, à pupille horizontale)
    for ex in (hx - 4, hx + 1):
        c.rect(ex - 1, hy + 1, 3, 3, '#f8e070')
        c.rect(ex - 1, hy + 2, 3, 1, INK)
        c.set(ex - 1, hy + 1, WHITE)
    c.line(hx - 6, hy, hx - 2, hy + 0, OCTO[1])
    return c


def sea_shark_draw(f):
    """Requin de récif : silhouette fuselée, aileron, ventre blanc, gueule dentée à l'attaque."""
    c = Canvas(48, 22)
    tail = (-3, 3, 0)[f]
    atk = f == 2

    def yc(x):
        return 11 + (0 if x < 26 else tail * ((x - 26) / 14) ** 1.7)

    def rt(x):
        return 0 if x < 2 or x > 40 else 5.6 * math.sin(math.pi * (x - 2) / 38) ** 0.6

    def rb(x):
        return 0 if x < 2 or x > 40 else 4.2 * math.sin(math.pi * (x - 2) / 38) ** 0.75
    ty = yc(40)
    fin(c, [(38, ty - 1), (47, ty - 10 + tail * 0.5), (44, ty), (46, ty + 6 + tail * 0.5), (38, ty + 1)], dk(SHARK, 0.02))
    # aileron dorsal
    fin(c, [(15, 7), (20, -2), (23, -1), (24, 6)], SHARK)
    m = body_mask(1, 41, yc, rt, rb)
    countershade(c, m, yc, rt, rb, SHARK, SHARK_B)
    # fentes branchiales
    for x in (12, 14, 16):
        c.line(x, yc(x) - 2, x, yc(x) + 1, SHARK[1])
    # pectorale
    fin(c, [(15, 14), (22, 15), (17, 21 + (1 if f == 1 else 0))], dk(SHARK, -0.04))
    if atk:
        c.rect(1, 11, 9, 4, MOUTH[1])
        c.rect(2, 12, 7, 2, MOUTH[0])
        teeth_row(c, 2, 9, 11, True)
        teeth_row(c, 2, 9, 14, False)
        eye(c, 7, 8, 2, iris='#ff3a3a', glow=True)
    else:
        c.line(2, 13, 9, 14, INK)
        teeth_row(c, 4, 8, 14, False, 2)
        eye(c, 7, 8, 1)
    return c


def trident(c, a, b, cols=GOLD):
    c.line(a[0], a[1], b[0], b[1], cols[1])
    ang = math.atan2(b[1] - a[1], b[0] - a[0])
    ux, uy = math.cos(ang), math.sin(ang)
    px, py = -uy, ux
    for s in (-3, 0, 3):
        x0, y0 = b[0] + px * s, b[1] + py * s
        c.line(x0, y0, x0 + ux * 5, y0 + uy * 5, cols[3])
        c.set(x0 + ux * 5, y0 + uy * 5, cols[4])
    c.line(b[0] + px * 3, b[1] + py * 3, b[0] - px * 3, b[1] - py * 3, cols[2])


def sea_merfolk_draw(f):
    """Triton guerrier : buste humanoïde à peau bleutée, queue de poisson, crête-nageoire, trident doré."""
    c = Canvas(34, 40)
    atk = f == 2
    sw = (0, 2, -1)[f]
    # queue (courbe en S), écailles turquoise
    pts = [(17, 20), (19 + sw * 0.4, 26), (17 - sw * 0.6, 31), (21 + sw, 35)]
    m = tube(pts, [4.6, 4.2, 3.0, 1.6])
    shade(c, m, MER, contrast=0.32)
    for (x, y) in m:
        if (x + y * 2) % 5 == 0:
            c.set(x, y, MER[4])
    tx, ty = pts[-1]
    fin(c, [(tx, ty), (tx + 7, ty - 2 + sw), (tx + 3, ty + 4), (tx - 3, ty + 5 - sw)], LEVI_FIN[1:])
    # bras arrière
    shade(c, tube([(19, 12), (22, 17), (21, 20)], [1.6, 1.4, 1.2]), dk(MER_SKIN, -0.08))
    # torse
    torso = ell(17, 15, 5, 6.5)
    rshade(c, torso, 17, 15, 5, 6.5, MER_SKIN)
    # ceinture de coquillages
    for x in range(12, 23):
        c.set(x, 19, CORAL[1] if x % 3 else PEARL[2])
    # tête
    rball(c, 15, 6, 4.4, 4.4, MER_SKIN)
    # cheveux / crête qui flottent vers l'arrière
    hair = [(17, 2), (23, 1 + sw * 0.5), (27, 4 + sw), (24, 6), (19, 5)]
    shade(c, poly(hair), MER_HAIR, contrast=0.3)
    fin(c, [(18, 4), (21, 1), (20, 7)], LEVI_FIN[1:])
    eye(c, 12, 5, 2, iris='#ffe24a', glow=True)
    c.set(12, 9, MOUTH[1])
    # bras avant + trident
    if atk:
        shade(c, tube([(14, 12), (9, 14), (5, 13)], [1.7, 1.5, 1.3]), MER_SKIN)
        trident(c, (14, 14), (-8, 12))
        bubbles(c, [(26, 10, 1), (28, 14, 2), (25, 18, 1)])
    else:
        shade(c, tube([(14, 12), (11, 16), (10, 18)], [1.7, 1.5, 1.3]), MER_SKIN)
        trident(c, (12, 30), (4, -2 + sw))
    return c


# ================================================================ boss

def mini_crab_king_draw(f):
    """Roi crabe : grande carapace couronnée, bernacles, une pince énorme."""
    c = Canvas(58, 42)
    G = 41
    atk = f == 2
    lift = 1 if f == 1 else 0
    for i, lx in enumerate((22, 27, 32, 37, 42)):
        up = (i + f) % 2
        knee = (lx + 4, 26 - up * 2)
        shade(c, tube([(lx, 26), knee, (lx + 6 + (i % 2), G)], [1.8, 1.5, 1.0]), dk(CRAB, -0.05))
    shell = ell(33, 22 - lift, 18, 11)
    rshade(c, shell, 33, 21 - lift, 18, 11, CRAB)
    # bernacles et algues
    for (x, y) in ((26, 15), (31, 13), (38, 14), (42, 18), (35, 19), (28, 20)):
        rball(c, x, y - lift, 1.6, 1.4, ['#5a5a50', '#9a9a88', '#d4d4c0', '#ffffff'])
    for x in (44, 46, 48):
        for k in range(4 + x % 3):
            c.set(x + (k % 2), 23 + k - lift, '#3a8a4a' if k % 2 else '#5ab05a')
    # ventre
    for x in range(20, 47):
        c.setf(x, 30 - lift, CRAB_B[1])
    # couronne d'or et de corail
    cx, cy = 30, 11 - lift
    c.rect(cx - 6, cy - 1, 13, 3, GOLD[2])
    c.rect(cx - 6, cy - 1, 13, 1, GOLD[3])
    for k, h in enumerate((4, 6, 5, 7, 4)):
        x = cx - 6 + k * 3
        c.line(x, cy - 1, x, cy - h, GOLD[2] if k % 2 else GOLD[3])
        c.set(x, cy - h, CORAL[2] if k % 2 else PEARL[2])
    # yeux
    for ex in (22, 26):
        c.line(ex, 14 - lift, ex - 1, 8 - lift, CRAB[2])
        rball(c, ex - 1, 7.5 - lift, 1.8, 1.8, ['#1a1226', '#3a1a1a', '#ffd040', '#ffffff'])
    # petite pince
    shade(c, tube([(22, 26 - lift), (14, 30)], [2.2, 2.0]), CRAB)
    rball(c, 12, 30, 3.6, 3, CRAB)
    # grande pince
    if atk:
        base, tip = (20, 20 - lift), (4, 4)
        open_ = 4
    else:
        base, tip = (20, 22 - lift), (7, 18 - (2 if f == 1 else 0))
        open_ = 1 if f == 1 else 0
    shade(c, tube([base, ((base[0] + tip[0]) / 2 + 2, (base[1] + tip[1]) / 2 + 2), tip], [3.4, 3.0, 2.8]), CRAB)
    rball(c, tip[0], tip[1], 6.5, 5.2, CRAB)
    c.line(tip[0] - 11, tip[1] - 1 - open_, tip[0] - 2, tip[1] - 1, CRAB[3])
    c.line(tip[0] - 10, tip[1] - open_, tip[0] - 2, tip[1], CRAB[2])
    c.line(tip[0] - 10, tip[1] + 2 + open_ // 2, tip[0] - 2, tip[1] + 2, CRAB[1])
    if open_:
        for k in range(8):
            c.set(tip[0] - 2 - k, tip[1] + 1, MOUTH[0])
    for k in range(0, 8, 2):
        c.set(tip[0] - 3 - k, tip[1] - 1, CRAB[4])
    if atk:
        bubbles(c, [(0, 12, 2), (-4, 8, 1), (2, -1, 1)])
    return c


def mid_kraken_draw(f):
    """Kraken des grottes : manteau immense, yeux luisants, forêt de tentacules (fouet géant à l'attaque)."""
    c = Canvas(70, 64)
    atk = f == 2
    hx, hy = 40, 18
    ph = (0.0, 1.0, 0.4)[f]
    back = dk(OCTO, -0.1)
    for i, (ang, curl, L) in enumerate(((45, 22, 30), (70, -18, 34), (95, 20, 36), (115, -22, 34), (135, 18, 30))):
        tentacle(c, (hx - 8 + i * 4, hy + 14), ang + math.sin(ph * 2.5 + i) * 8, L, curl * (1 if f != 1 else -1), 4.0, back, seg=14)
    mantle = ell(hx + 4, hy - 2, 15, 17) | ell(hx + 10, hy - 10, 10, 9)
    rshade(c, mantle, hx + 5, hy - 4, 17, 19, OCTO)
    for (x, y, r) in ((hx + 6, hy - 12, 2.2), (hx + 12, hy - 4, 1.8), (hx + 1, hy - 8, 1.6), (hx + 9, hy + 4, 1.6), (hx - 2, hy - 1, 1.3)):
        rball(c, x, y, r, r, OCTO_S)
    # yeux luisants
    for ex in (hx - 7, hx + 1):
        rball(c, ex, hy + 4, 3.4, 3.2, ['#5a2a00', '#e08a10', '#ffd040', '#fff6b0'])
        c.rect(ex - 2, hy + 4, 5, 1, INK)
        c.set(ex - 2, hy + 2, WHITE)
    c.line(hx - 11, hy + 1, hx - 4, hy + 2, OCTO[1])
    c.line(hx - 3, hy + 1, hx + 4, hy + 0, OCTO[1])
    # tentacules avant
    if atk:
        tentacle(c, (hx - 8, hy + 12), 190, 40, -3, 4.4, OCTO, OCTO_S[2], seg=16)
        tentacle(c, (hx - 4, hy + 14), 160, 28, 10, 3.8, OCTO, OCTO_S[2], seg=12)
        bubbles(c, [(4, 20, 2), (0, 30, 1), (8, 12, 1)])
    else:
        tentacle(c, (hx - 8, hy + 12), 140 + ph * 12, 30, 26 if f == 0 else -24, 4.4, OCTO, OCTO_S[2], seg=14)
        tentacle(c, (hx - 3, hy + 14), 110 - ph * 10, 32, -24 if f == 0 else 24, 4.2, OCTO, OCTO_S[2], seg=14)
    tentacle(c, (hx + 4, hy + 14), 80 + ph * 10, 30, 24, 4.0, OCTO, OCTO_S[2], seg=14)
    return c


def hard_megalodon_draw(f):
    """Mégalodon : requin colossal balafré, rangées de dents, nageoires déchiquetées."""
    c = Canvas(84, 40)
    tail = (-5, 5, 0)[f]
    atk = f == 2

    def yc(x):
        return 20 + (0 if x < 44 else tail * ((x - 44) / 26) ** 1.7)

    def rt(x):
        return 0 if x < 2 or x > 70 else 11 * math.sin(math.pi * (x - 2) / 68) ** 0.55

    def rb(x):
        return 0 if x < 2 or x > 70 else 8 * math.sin(math.pi * (x - 2) / 68) ** 0.7
    MEG = ['#121820', '#24303e', '#3c4e60', '#5e7488', '#98aec0']
    ty = yc(70)
    fin(c, [(67, ty - 1), (83, ty - 17 + tail * 0.6), (77, ty), (82, ty + 11 + tail * 0.6), (67, ty + 2)], dk(MEG, 0.02))
    fin(c, [(28, 11), (36, -4), (40, -3), (38, 0), (42, 10)], MEG)
    c.set(37, -3, MEG[0]); c.set(38, -2, MEG[0])  # entaille
    m = body_mask(1, 71, yc, rt, rb)
    countershade(c, m, yc, rt, rb, MEG, SHARK_B)
    # cicatrices
    for (x0, y0) in ((30, 14), (46, 17), (52, 13)):
        c.line(x0, y0, x0 + 5, y0 + 3, '#c8d4dc')
        c.line(x0 + 1, y0 - 0, x0 + 6, y0 + 3, MEG[1])
    for x in (20, 23, 26, 29):
        c.line(x, yc(x) - 4, x - 1, yc(x) + 3, MEG[1])
    fin(c, [(26, 25), (40, 27), (30, 38 + (2 if f == 1 else 0))], dk(MEG, -0.04))
    if atk:
        c.poly([(0, 18), (16, 21), (16, 26), (2, 33)], MOUTH[1])
        c.poly([(2, 20), (14, 22), (14, 25), (3, 30)], MOUTH[0])
        teeth_row(c, 1, 15, 19, True)
        teeth_row(c, 3, 15, 30, False)
        eye(c, 12, 14, 2, iris='#ff2a2a', glow=True)
        bubbles(c, [(-4, 14, 2), (-2, 26, 1), (-7, 22, 1)])
    else:
        c.line(2, 24, 16, 25, INK)
        teeth_row(c, 4, 15, 25, False)
        eye(c, 12, 15, 2, iris='#c82020', glow=True)
    return c


def boss_leviathan_draw(f):
    """Léviathan : serpent des abysses enroulé, tête de dragon marin à crête, nageoires violettes, runes lumineuses."""
    c = Canvas(104, 76)
    atk = f == 2
    ph = (0.0, 0.9, 0.3)[f]
    # corps : spirale qui part de la tête (en haut à gauche) et s'enroule derrière vers la queue à droite
    pts = []
    for k in range(40):
        t = k / 39
        x = 22 + t * 70 + math.sin(t * 5.2 + ph) * 8 * t
        y = 26 + math.sin(t * 6.3 + 1.2 + ph) * 20 * (0.4 + t * 0.6) + t * 14
        pts.append((x, y))
    widths = [9.5 * (1 - 0.8 * (k / 39) ** 1.3) + 1 for k in range(40)]
    # nageoire dorsale le long du corps (derrière)
    for k in range(2, 38, 2):
        x, y = pts[k]
        w = widths[k]
        h = 5 + 3 * math.sin(k * 0.7 + ph)
        fin(c, [(x - 2, y - w + 1), (x + 1, y - w - h), (x + 3, y - w + 1)], LEVI_FIN[1:])
    body = tube(pts, widths)
    rshade(c, body, 55, 34, 46, 30, LEVI)
    # ventre clair sous la ligne médiane
    for k in range(1, 39):
        x, y = pts[k]
        w = widths[k]
        for dy in range(int(w * 0.35), int(w) - 1):
            c.setf(x, y + dy, LEVI_B[1] if dy < w * 0.7 else LEVI_B[0])
            c.setf(x + 1, y + dy, LEVI_B[2] if dy < w * 0.55 else LEVI_B[1])
    # écailles et runes lumineuses
    for k in range(3, 38, 3):
        x, y = pts[k]
        c.setf(x, y - widths[k] * 0.4, LEVI[5])
        c.setf(x + 1, y - widths[k] * 0.4 + 1, LEVI[3])
    for k in (6, 13, 20, 27, 34):
        x, y = pts[k]
        c.setf(x, y, '#8af4ff'); c.setf(x + 1, y, '#eaffff'); c.setf(x, y + 1, '#2ad0e8')
    # queue en éventail
    tx, ty = pts[-1]
    fin(c, [(tx - 2, ty), (tx + 10, ty - 9 + ph * 4), (tx + 6, ty), (tx + 11, ty + 8 - ph * 4)], LEVI_FIN[1:])
    # tête
    hx, hy = 16, 22
    jaw = 6 if atk else 0
    head = ell(hx + 4, hy, 11, 8) | ell(hx - 6, hy + 2, 8, 5)
    rshade(c, head, hx, hy - 1, 14, 9, LEVI)
    # mâchoire
    if atk:
        c.poly([(hx - 15, hy + 3), (hx + 6, hy + 4), (hx + 6, hy + 8 + jaw), (hx - 12, hy + 6 + jaw)], MOUTH[1])
        c.poly([(hx - 12, hy + 4), (hx + 4, hy + 5), (hx + 4, hy + 7 + jaw), (hx - 10, hy + 5 + jaw)], MOUTH[0])
        teeth_row(c, hx - 13, hx + 4, hy + 4, True)
        teeth_row(c, hx - 10, hx + 4, hy + 6 + jaw, False)
        lower = ell(hx - 3, hy + 9 + jaw, 9, 2.6)
        rshade(c, lower, hx - 3, hy + 9 + jaw, 9, 2.6, LEVI)
        bubbles(c, [(hx - 22, hy + 2, 3), (hx - 26, hy + 9, 2), (hx - 19, hy - 6, 1), (hx - 30, hy - 2, 2)])
    else:
        c.line(hx - 13, hy + 5, hx + 5, hy + 6, INK)
        teeth_row(c, hx - 10, hx + 2, hy + 6, False, 3)
    # crête et cornes-nageoires
    fin(c, [(hx + 2, hy - 6), (hx + 10, hy - 20 - ph * 2), (hx + 12, hy - 7)], LEVI_FIN[1:])
    fin(c, [(hx + 9, hy - 5), (hx + 20, hy - 15 + ph * 2), (hx + 16, hy - 2)], LEVI_FIN[1:])
    fin(c, [(hx + 12, hy + 2), (hx + 22, hy + 6), (hx + 13, hy + 7)], LEVI_FIN[1:])
    # barbillons
    c.line(hx - 12, hy + 6, hx - 16, hy + 12 + ph * 2, LEVI[4])
    c.line(hx - 8, hy + 7, hx - 10, hy + 14 - ph * 2, LEVI[4])
    # œil
    rball(c, hx - 2, hy - 2, 2.6, 2.2, ['#2a6a00', '#8ae020', '#e8ff7a', '#ffffff'])
    c.line(hx - 2, hy - 4, hx - 2, hy, INK)
    c.line(hx - 6, hy - 5, hx + 1, hy - 5, LEVI[0])
    # narine
    c.set(hx - 13, hy, INK)
    return c


# ================================================================ icône d'ensemble

def set_ocean():
    """Coquillage nacré et trident (Parure des marées), 12×12."""
    from lib import Canvas as Plain
    c = Plain(12, 12)
    SHELL = ['#0e4a5a', '#1a8a9a', '#3ad0e0', '#a8f4f8', '#ffffff']
    for y in range(12):
        for x in range(12):
            dx, dy = x + 0.5 - 6, y + 0.5 - 7.5
            if dy <= 0.8 and dx * dx / 30 + dy * dy / 26 <= 1:
                ang = math.atan2(dy, dx)
                rib = int((ang + math.pi) / (math.pi / 6)) % 2
                c.set(x, y, SHELL[2 + rib] if dy < -2 else SHELL[1 + rib])
    for x in range(3, 9):
        c.set(x, 8, SHELL[1])
    c.rect(4, 9, 4, 2, SHELL[1]); c.set(5, 9, SHELL[2]); c.set(6, 9, SHELL[2])
    c.set(4, 3, SHELL[4]); c.set(5, 2, SHELL[3])
    c.set(9, 1, '#ffe27a'); c.set(10, 2, '#eab53a')
    c.outline(OUT)
    return c


NAMES = ['sea_bladefish', 'sea_jelly', 'sea_crab', 'sea_eel', 'sea_puffer', 'sea_octopus', 'sea_shark', 'sea_merfolk',
         'mini_crab_king', 'mid_kraken', 'hard_megalodon', 'boss_leviathan']


def build():
    g = globals()
    out = {}
    for name in NAMES:
        a, b, k = triple(g[name + '_draw'])
        out[name] = (a, {})
        out[name + '_b'] = (b, {})
        out[name + '_atk'] = (k, {})
    out['set_ocean'] = (set_ocean(), {})
    return out


if __name__ == '__main__':
    from lib import sheet
    items = []
    for name in NAMES:
        for suf in ('', '_b', '_atk'):
            pass
    built = build()
    sheet([(k, v[0]) for k, v in built.items()], sys.argv[1] if len(sys.argv) > 1 else '/tmp/ocean_preview.png', scale=4, cols=6)
