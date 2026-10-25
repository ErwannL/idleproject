"""Mini-boss d'étape 5 de chaque monde (chibi 16 bits, lumière en haut à gauche).

Plus imposants que les ennemis normaux (~25-40 px), moins que les méga boss d'étape 10 (~60-70 px).
Chaque mini-boss regarde à GAUCHE et a trois images sur le même canvas (pieds sur la dernière ligne,
sauf volants) :
  <nom>       : repos
  <nom>_b     : 2e image de marche / respiration / vol
  <nom>_atk   : pose d'attaque
Couleurs hexadécimales fixes uniquement.
"""
import math

from lib import mix, shift
from enemies import (Canvas, part, shade_mask, spoly, sell, sline, mask_of, dk, crop_to, mossify,
                     OUT, INK, WHITE, STEEL, BONE, GOLD, WOOD, LEATHER, PURPLE_GLOW, ICE)

G = 46  # ligne du sol (coordonnées logiques)
MAX_COLORS = 56

NAMES = ('mini_goblin_warlord', 'mini_treant', 'mini_crystal_golem', 'mini_pharaoh',
         'mini_frost_witch', 'mini_reaper')


def trio(fn):
    """Trois images (repos, _b, _atk) contournées et recadrées sur la même boîte englobante."""
    frames = [fn(f) for f in range(3)]
    for c in frames:
        c.outline(OUT)
    bs = [c.bounds() for c in frames]
    box = (min(b[0] for b in bs), min(b[1] for b in bs), max(b[2] for b in bs), max(b[3] for b in bs))
    return [reduce_colors(crop_to(c, box)) for c in frames]


def reduce_colors(c, limit=MAX_COLORS):
    """Fusionne les couleurs les plus proches (la moins fréquente prend la plus fréquente) jusqu'à la limite."""
    from lib import hex2rgb
    while True:
        count = {}
        for row in c.px:
            for p in row:
                if p is not None:
                    count[p] = count.get(p, 0) + 1
        if len(count) <= limit:
            return c
        cols = list(count)
        best = None
        for i in range(len(cols)):
            a = hex2rgb(cols[i])
            for j in range(i + 1, len(cols)):
                b = hex2rgb(cols[j])
                d = sum((a[k] - b[k]) ** 2 for k in range(3))
                if best is None or d < best[0]:
                    best = (d, cols[i], cols[j])
        _, a, b = best
        if b == OUT or (a != OUT and count[a] < count[b]):
            a, b = b, a
        # b disparaît au profit de a
        c.recolor({b: a})


def ring(c, cx, cy, r, cols, a0=0, a1=360, step=6, w=1.0):
    for a in range(a0, a1, step):
        t = math.radians(a)
        c.set(cx + math.cos(t) * r, cy + math.sin(t) * r, cols[0] if 110 < a % 360 < 290 else cols[1])


def trail(c, cx, cy, r0, r1, a0, a1, cols):
    """Arc de mouvement (traînée d'arme) : de a0 à a1, couleurs du bord intérieur vers l'extérieur."""
    n = len(cols)
    lo, hi = min(a0, a1), max(a0, a1)
    for a10 in range(int(lo * 10), int(hi * 10), 15):
        a = a10 / 10
        t = math.radians(a)
        k = (a - lo) / max(1, hi - lo)
        if a0 > a1:
            k = 1 - k
        rr1 = r0 + (r1 - r0) * (0.35 + 0.65 * k)
        r = r0
        while r <= rr1:
            u = (r - r0) / max(0.01, r1 - r0)
            c.set(cx + math.cos(t) * r, cy + math.sin(t) * r, cols[min(n - 1, int(u * n))])
            r += 0.5


def diamond(c, x, y, h, w, R, glow=True):
    """Petit cristal flottant (losange) ombré."""
    spoly(c, [(x, y - h), (x + w, y), (x, y + h), (x - w, y)], R, contrast=0.5)
    if glow:
        c.set(x - 1 if w > 1.5 else x, y - 1, R[-1])


# ================================================================ 1. chef de guerre gobelin (plaines)

GW_SKIN = ['#1c3418', '#335c22', '#4e8a2e', '#7cb642', '#b4de72']
GW_FUR = ['#241a16', '#43332a', '#685040', '#8e7458', '#b89c78']
GW_PANTS = ['#1e1820', '#3a2c34', '#5a4248', '#7a5e5e', '#9c8078']
WARPAINT = '#d0302a'
WARPAINT_D = '#8a1a20'
GW_EYE = '#ffe04a'
HORN = ['#5a4a3e', '#9a8a70', '#cdbf9c', '#ece2c4', '#fffbec']


def scimitar(t, hand, ang, length=17, R=STEEL):
    """Cimeterre large : lame courbe qui s'élargit vers la pointe (ang en degrés, 0 = droite)."""
    a = math.radians(ang)
    ux, uy = math.cos(a), math.sin(a)
    px, py = -uy, ux  # perpendiculaire (côté tranchant)
    hx, hy = hand
    pts_spine, pts_edge = [], []
    for i in range(0, 11):
        u = i / 10
        d = 3 + u * length
        bend = 2.6 * u * u  # courbure vers le dos
        wdt = 1.6 + 2.6 * math.sin(min(1.0, u * 1.25) * math.pi * 0.55)
        if u > 0.85:
            wdt *= (1 - u) / 0.15 * 0.9 + 0.1
        bx, by = hx + ux * d - px * bend, hy + uy * d - py * bend
        pts_spine.append((bx - px * 0.8, by - py * 0.8))
        pts_edge.append((bx + px * wdt, by + py * wdt))
    poly = pts_spine + pts_edge[::-1]
    spoly(t, poly, R, contrast=0.5, bias=0.08)
    # fil clair + gouttière
    for (x, y) in pts_edge[2:-1]:
        t.setf(x - px * 0.6, y - py * 0.6, R[4])
    for (x, y) in pts_spine[2:-3]:
        t.setf(x + px * 1.2, y + py * 1.2, R[1])
    # garde et poignée
    gx, gy = hx + ux * 2.4, hy + uy * 2.4
    t.line(gx - px * 2.5, gy - py * 2.5, gx + px * 2.8, gy + py * 2.8, GOLD[2], 2)
    t.set(gx - px * 2.5, gy - py * 2.5, GOLD[4])
    t.line(hx - ux * 2, hy - uy * 2, hx + ux * 1.4, hy + uy * 1.4, LEATHER[1], 2)
    t.set(hx - ux * 3, hy - uy * 3, GOLD[3])


def gw_head(c, hx, hy, atk=False):
    def head(t):
        # oreille arrière
        spoly(t, [(hx + 5, hy - 1), (hx + 14, hy - 6), (hx + 11, hy), (hx + 6, hy + 3)], dk(GW_SKIN, -0.06))
        t.line(hx + 7, hy - 1, hx + 11, hy - 4, GW_SKIN[0])
        sell(t, hx, hy, 8.4, 7.0, GW_SKIN)
        sell(t, hx - 2, hy + 4.4, 7.0, 3.6, GW_SKIN)  # mâchoire carrée
        # oreille avant
        spoly(t, [(hx - 6, hy), (hx - 15, hy - 5), (hx - 12, hy + 1), (hx - 6, hy + 4)], GW_SKIN)
        t.line(hx - 12, hy - 3, hx - 7, hy + 1, GW_SKIN[1])
        t.set(hx - 14, hy - 5, GW_SKIN[4])
        # peinture de guerre : bandeau rouge sur les yeux + griffures sur la joue
        for x in range(int(hx - 9), int(hx + 4)):
            for y in range(int(hy - 2), int(hy + 2)):
                t.setf(x, y, WARPAINT if y < hy + 1 else WARPAINT_D)
        for k in range(3):
            t.line(hx + 3 + k * 2, hy + 1, hx + 2 + k * 2, hy + 4, WARPAINT)
        # yeux jaunes furieux
        ey = int(hy - 1)
        for ex in (int(hx - 8), int(hx - 2)):
            t.rect(ex, ey, 3, 2, GW_EYE)
            t.set(ex, ey + 1, INK); t.set(ex + 1, ey + 1, INK); t.set(ex, ey, WHITE)
            t.set(ex + 2, ey + 1, '#c89a2a')
        t.line(hx - 9, ey - 2, hx - 5, ey - 1, INK)
        t.line(hx - 2, ey - 1, hx + 2, ey - 2, INK)
        # nez crochu
        spoly(t, [(hx - 6, hy + 1), (hx - 11, hy + 3), (hx - 6, hy + 4)], GW_SKIN, bias=0.1)
        # bouche + défenses
        my = int(hy + 5)
        if atk:
            t.rect(int(hx - 9), my - 1, 8, 4, INK)
            t.rect(int(hx - 8), my + 1, 6, 2, '#7a1a2a')
            t.set(hx - 6, my + 2, '#e0506a')
            for xx in (hx - 9, hx - 2):
                t.set(xx, my + 2, HORN[4]); t.set(xx, my + 1, HORN[4]); t.set(xx, my, HORN[3])
        else:
            t.line(hx - 9, my + 1, hx - 1, my + 1, INK)
            t.set(hx - 9, my, INK)
            for xx in (hx - 8, hx - 3):
                t.set(xx, my, HORN[4]); t.set(xx, my - 1, HORN[3]); t.set(xx + 1, my, HORN[2])
        t.set(hx - 5, my + 3, GW_SKIN[1]); t.set(hx - 4, my + 3, GW_SKIN[1])
    part(c, head)
    # casque à cornes
    hm = mask_of(lambda m: m.ellipse(hx + 0.5, hy - 2.5, 9.2, 7.2, '#000'))
    hm = {(x, y) for (x, y) in hm if y <= hy - 4}
    hm |= mask_of(lambda m: m.rect(int(hx - 9), int(hy - 5), 19, 2, '#000'))

    def helm(t):
        # cornes (derrière puis devant), recourbées vers le haut
        spoly(t, [(hx + 4, hy - 8), (hx + 8, hy - 6), (hx + 12, hy - 10), (hx + 13, hy - 16), (hx + 10, hy - 12)],
              dk(HORN, -0.06), contrast=0.5)
        spoly(t, [(hx - 2, hy - 9), (hx - 6, hy - 6), (hx - 10, hy - 10), (hx - 11, hy - 17), (hx - 8, hy - 13)],
              HORN, contrast=0.5)
        t.set(hx + 13, hy - 16, HORN[4]); t.set(hx - 11, hy - 17, HORN[4])
        for k in (1, 3):
            t.setf(hx - 6 - k, hy - 8 - k, HORN[1])
            t.setf(hx + 8 + k * 0.7, hy - 8 - k, HORN[1])
        shade_mask(t, hm, STEEL, contrast=0.48)
        for x in range(int(hx - 9), int(hx + 10)):
            t.set(x, hy - 5, STEEL[3] if x < hx else STEEL[2])
            t.set(x, hy - 4, STEEL[1])
        for x in (hx - 7, hx - 2, hx + 3, hx + 7):
            t.set(x, hy - 5, STEEL[4])
        # crête centrale
        t.line(hx - 1, hy - 10, hx - 1, hy - 5, STEEL[4])
        t.line(hx, hy - 10, hx, hy - 5, STEEL[2])
    part(c, helm)


def gw_draw(f):
    c = Canvas(60, 56)
    atk = f == 2
    oy = 1 if f == 1 else 0
    ox = -1 if atk else 0
    # jambes trapues
    fl, bl = (14, 26) if f != 1 else (17, 23)
    if atk:
        fl, bl = 11, 27
    spoly(c, [(bl, 36 + oy), (bl + 6, 36 + oy), (bl + 6, G - 2), (bl, G - 2)], dk(GW_PANTS, -0.1))
    sell(c, bl + 2.4, G - 1, 4.2, 1.9, dk(LEATHER, -0.1))
    spoly(c, [(fl, 36 + oy), (fl + 6, 36 + oy), (fl + 6, G - 2), (fl, G - 2)], GW_PANTS)
    sell(c, fl + 2.2, G - 1, 4.4, 1.9, LEATHER)
    for x in range(fl, fl + 6):
        c.setf(x, G - 4, LEATHER[3] if x % 2 else LEATHER[2])
    # bras arrière + cimeterre levé (repos)
    if not atk:
        sline(c, 31 + ox, 27 + oy, 37, 21 + oy, dk(GW_SKIN, -0.06), 5)
        sline(c, 36, 22 + oy, 37, 19 + oy, LEATHER, 4)
        part(c, lambda t: scimitar(t, (37, 18 + oy - f * 0.5), -78 + f * 4))
        sell(c, 37, 18.5 + oy, 2.6, 2.4, dk(GW_SKIN, -0.04))
    else:
        # bouclier ramené en arrière pour l'élan
        def bshield(t):
            sell(t, 34, 29, 6.2, 6.8, dk(WOOD, -0.08))
            ring(t, 34, 29, 5.6, (STEEL[1], STEEL[2]))
        part(c, bshield)
    # torse massif
    tm = mask_of(lambda m: m.ellipse(23 + ox, 30 + oy, 10.5, 8.6, '#000'))
    shade_mask(c, tm, GW_SKIN, contrast=0.42)
    c.line(19 + ox, 27 + oy, 21 + ox, 31 + oy, GW_SKIN[1])  # pectoraux
    c.line(24 + ox, 33 + oy, 26 + ox, 33 + oy, GW_SKIN[1])
    c.line(27 + ox, 26 + oy, 30 + ox, 29 + oy, WARPAINT_D)  # cicatrice
    # bandoulière + ceinture
    c.line(16 + ox, 24 + oy, 30 + ox, 37 + oy, LEATHER[1], 2)
    c.line(16 + ox, 23 + oy, 30 + ox, 36 + oy, LEATHER[3])
    for x in range(13, 34):
        c.setf(x + ox, 36 + oy, LEATHER[0]); c.setf(x + ox, 37 + oy, LEATHER[2])
    # pagne en peau
    pts = [(14 + ox, 37 + oy), (32 + ox, 37 + oy), (31 + ox, 42 + oy), (28 + ox, 40 + oy), (25 + ox, 43 + oy),
           (22 + ox, 40 + oy), (19 + ox, 43 + oy), (16 + ox, 40 + oy), (13 + ox, 42 + oy)]
    part(c, lambda t: spoly(t, pts, GW_FUR, contrast=0.45))
    for x in range(15, 31, 3):
        c.setf(x + ox, 39 + oy, GW_FUR[1])
    # boucle crâne
    sell(c, 21.5 + ox, 37 + oy, 2.2, 2, BONE)
    c.set(21 + ox, 37 + oy, INK); c.set(22 + ox, 37 + oy, INK)
    # peau de bête sur les épaules
    def pelt(t):
        pm = mask_of(lambda m: m.ellipse(24 + ox, 24 + oy, 10, 4.4, '#000'))
        for x in range(14 + ox, 35 + ox, 2):
            pm |= {(x, 28 + oy + (x % 3 == 0)), (x, 27 + oy)}
        shade_mask(t, pm, GW_FUR, contrast=0.5)
        for x in range(16 + ox, 33 + ox, 3):
            t.setf(x, 23 + oy, GW_FUR[4]); t.setf(x + 1, 25 + oy, GW_FUR[1])
    part(c, pelt)
    # tête
    gw_head(c, 17 + ox * 2, 15 + oy + (1 if atk else 0), atk)
    if not atk:
        # bouclier rond en bois cerclé d'acier (devant)
        def shield(t):
            sell(t, 10, 32 + oy, 7, 7.6, WOOD)
            ring(t, 10, 32 + oy, 6.6, (STEEL[1], STEEL[3]), step=4)
            t.line(10, 25 + oy, 10, 39 + oy, WOOD[1])
            t.line(6, 26 + oy, 6, 38 + oy, WOOD[2])
            t.line(14, 26 + oy, 14, 38 + oy, WOOD[1])
            # griffes rouges peintes
            for k in range(3):
                t.line(6 + k * 2.5, 28 + oy, 8 + k * 2.5, 35 + oy, WARPAINT)
            sell(t, 10, 32 + oy, 1.8, 1.8, STEEL)
            t.set(9, 31 + oy, WHITE)
        part(c, shield)
    else:
        # bras arrière abattant le cimeterre vers l'avant
        def arm(t):
            sline(t, 31, 27, 20, 28, GW_SKIN, 5)
            sline(t, 20, 28, 9, 28, GW_SKIN, 4)
            sline(t, 14, 28, 10, 28, LEATHER, 4)
            sell(t, 7.5, 28, 2.8, 2.6, GW_SKIN)
        trail(c, 14, 28, 12, 21, 250, 150, ['#55607a', '#8e9ab4', '#d4dcea'])
        part(c, lambda t: scimitar(t, (7, 28), 150, 17))
        part(c, arm)
        sell(c, 7.5, 28, 2.8, 2.6, GW_SKIN)
        c.set(6, 27, GW_SKIN[4])
    return c


def mini_goblin_warlord():
    return trio(gw_draw)


# ================================================================ 2. tréant corrompu (forêt sombre)

BARK = ['#1c1418', '#35262a', '#54403a', '#77604c', '#9c8462']
BARK_D = dk(BARK, -0.06)
CANOPY = ['#0e1e1c', '#183428', '#24502e', '#3c6e34', '#679440']
SHROOM = ['#3a0e4a', '#6e1e7a', '#a83aa8', '#de7ad6', '#ffd0f4']
TR_GLOW = ['#5ac81e', '#b4ff3a', '#f4ffc0']


def branch_arm(c, pts, R, w0=4, twigs=()):
    for i in range(len(pts) - 1):
        wd = max(2, w0 - i)
        sline(c, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], R, wd)
    end = pts[-1]
    for (dx, dy) in twigs:
        sline(c, end[0], end[1], end[0] + dx, end[1] + dy, R, 2)
        c.set(end[0] + dx, end[1] + dy, R[3])


def tr_draw(f):
    c = Canvas(60, 58)
    atk = f == 2
    sway = 1 if f == 1 else 0
    oy = 0
    # bras arrière (droite) : branche levée avec feuillage
    bk = [(30, 22), (37, 17 - sway), (41, 10 - sway)]
    if atk:
        bk = [(30, 22), (38, 20), (44, 15)]
    branch_arm(c, bk, BARK_D, 4, twigs=((3, -2), (1, -4), (4, 1)))
    lx, ly = bk[-1]
    sell(c, lx + 1, ly - 2, 4, 3.2, dk(CANOPY, -0.04))
    # racines
    roots = [((16, 40), (9 - sway, G)), ((19, 42), (15, G)), ((28, 42), (33 + sway, G)), ((30, 40), (38, G))]
    if atk:
        roots = [((16, 40), (7, G)), ((19, 42), (14, G)), ((28, 42), (34, G)), ((30, 40), (39, G))]
    for (a, b) in roots:
        spoly(c, [(a[0] - 2, a[1]), (a[0] + 2, a[1]), (b[0] + 1.5, b[1]), (b[0] - 1.5, b[1])], BARK, contrast=0.4)
        c.set(b[0], b[1], BARK[0])
    # tronc
    trunk = [(14, G - 1), (33, G - 1), (31, 36), (32, 24), (30, 13), (16, 13), (14, 24), (15, 36)]
    tm = mask_of(lambda m: m.poly(trunk, '#000'))
    shade_mask(c, tm, BARK, contrast=0.42)
    # sillons d'écorce (verticaux, ondulés)
    for k, x0 in enumerate((17, 21, 27, 30)):
        for y in range(15, G - 1):
            if (y + k * 3) % 9 in (0, 1):
                continue
            x = x0 + round(math.sin(y * 0.45 + k) * 0.8)
            if c.get(x, y) in BARK[2:]:
                c.set(x, y, BARK[1])
    for y in range(16, 40, 5):
        c.setf(16, y, BARK[4])
    # visage creusé dans le tronc
    ey = 22
    def face(t):
        t.ellipse(19.5, ey + 0.5, 2.6, 2.0, BARK[0])
        t.ellipse(26.5, ey + 0.5, 2.6, 2.0, BARK[0])
    face(c)
    g0, g1, g2 = TR_GLOW
    for ex in (18, 25):
        c.rect(ex, ey, 3, 2, g0)
        c.set(ex + 1, ey, g1); c.set(ex, ey, g2 if not atk else g1)
        if atk:
            c.rect(ex, ey, 3, 2, g1); c.set(ex, ey, g2); c.set(ex + 1, ey, g2)
    # sourcils d'écorce froncés
    c.line(16, ey - 3, 21, ey - 1, BARK[4]); c.line(16, ey - 2, 21, ey, BARK[1])
    c.line(24, ey - 1, 29, ey - 3, BARK[3]); c.line(24, ey, 29, ey - 2, BARK[1])
    # bouche dentelée
    my = 28
    mh = 5 if atk else 3
    c.ellipse(22.5, my + mh / 2, 4.6, mh / 2 + 0.4, BARK[0])
    c.ellipse(22.5, my + mh / 2 + 0.6, 3.4, mh / 2 - 0.3, '#2a0e1e')
    for x in range(19, 27, 2):
        c.set(x, my, BARK[3]); c.set(x + 1, my + mh, BARK[3])
    if atk:
        c.set(22, my + 2, TR_GLOW[0]); c.set(23, my + 3, TR_GLOW[0])
    # champignons sur le flanc
    def shroom(t, x, y, r):
        sline(t, x, y, x - 0.5, y + 2, BONE, 2)
        spoly(t, [(x - r, y + 0.5), (x - r * 0.6, y - r * 0.6), (x + r * 0.6, y - r * 0.6), (x + r, y + 0.5)], SHROOM, contrast=0.5)
        t.set(x - 1, y - 1, SHROOM[4])
    part(c, lambda t: (shroom(t, 33, 31, 3.4), shroom(t, 33, 36, 2.4), shroom(t, 14, 40, 2.2)))
    # couronne de feuillage sombre
    blobs = [(11, 11, 5.5, 4.5), (17, 5, 6.5, 5), (26, 3, 7, 5), (34, 8, 6, 5), (37, 14, 4, 3.5),
             (8, 16, 3.5, 3), (21, 12, 8, 4), (30, 14, 6, 3.6)]
    cm = set()
    for (bx, by, rx, ry) in blobs:
        cm |= mask_of(lambda m: m.ellipse(bx + sway, by + sway * 0.5, rx, ry, '#000'))
    def canopy(t):
        shade_mask(t, cm, CANOPY, contrast=0.48)
        # touffes de feuilles (texture)
        for (x, y) in sorted(cm):
            h = (x * 5 + y * 3) % 7
            if h == 0 and t.get(x, y) in CANOPY[2:]:
                t.set(x, y, CANOPY[4] if y < 8 else CANOPY[3])
                t.setf(x + 1, y + 1, CANOPY[1])
            elif h == 3 and t.get(x, y) in CANOPY[:3]:
                t.set(x, y, CANOPY[0])
        # lianes pendantes
        for k, x in enumerate(range(7 + sway, 41 + sway, 4)):
            ys = [y for (xx, y) in cm if xx == x]
            if ys and not (13 < x - sway < 31):
                ln = 3 + (k * 5) % 4
                y0 = max(ys)
                t.line(x, y0, x - sway * 0.0 + (k % 2), y0 + ln, CANOPY[2])
                t.set(x + (k % 2), y0 + ln + 1, CANOPY[3])
        # champignons et spores lumineux dans la couronne
        shroom(t, 9 + sway, 8, 2.8)
        shroom(t, 36 + sway, 5, 2.4)
        for (x, y) in ((16, 3), (26, 1), (30, 12), (12, 13)):
            t.set(x + sway, y + (f == 1), TR_GLOW[1])
    part(c, canopy)
    # bras avant (gauche) : branche griffue
    if atk:
        fa = [(16, 36), (9, 29), (3, 20)]
        tw = ((-4, -3), (-5, 0), (-4, 3), (-1, -4))
    elif f == 1:
        fa = [(16, 33), (10, 35), (5, 37)]
        tw = ((-3, 3), (0, 4), (-4, 0))
    else:
        fa = [(16, 33), (10, 34), (4, 36)]
        tw = ((-3, 3), (0, 4), (-4, 0))
    part(c, lambda t: branch_arm(t, fa, BARK, 5, tw))
    c.setf(fa[1][0], fa[1][1] - 2, CANOPY[3]); c.setf(fa[1][0] + 1, fa[1][1] - 2, CANOPY[2])
    if atk:
        # griffes en mouvement : traînées
        for k, (dx, dy) in enumerate(tw[:3]):
            x, y = fa[-1][0] + dx, fa[-1][1] + dy
            c.line(x + 3, y + 3, x + 6, y + 6, '#7a604c' if k % 2 else '#9c8462')
        for (x, y) in ((-6, 15), (-5, 21), (-3, 25)):
            c.set(x, y, TR_GLOW[1])
    return c


def mini_treant():
    return trio(tr_draw)


# ================================================================ 3. golem de cristal (grottes de cristal)

CG_ROCK = ['#16142a', '#2c2846', '#45406a', '#655e8e', '#8e88b0']
CG_ROCK_D = dk(CG_ROCK, -0.07)
CG_HEAD = ['#2c2848', '#4e4a72', '#726c98', '#9a94ba', '#c4c0dc']
CRY_P = ['#3a1470', '#6a2ac0', '#a45af0', '#d8a8ff', '#f8eaff']
CRY_C = ['#103a6a', '#1e74c0', '#3ac0f0', '#a0f0ff', '#effcff']


def crystal(c, x, base, h, w, R, lean=0.0):
    tip = (x + lean * h, base - h)
    spoly(c, [(x - w / 2, base), (x - w / 2 + lean * h * 0.5, base - h * 0.62), tip,
              (x + w / 2 + lean * h * 0.5, base - h * 0.55), (x + w / 2, base)], R, contrast=0.55, bias=0.05)
    # facette claire
    c.line(x - w / 4 + lean * 2, base - 1, tip[0], tip[1] + 1, R[3])
    c.set(tip[0], tip[1], R[4])


def cg_draw(f):
    c = Canvas(64, 60)
    atk = f == 2
    oy = 1 if f == 1 else 0
    ox = -2 if atk else 0
    glow = f == 1
    # cristaux du dos (derrière le corps)
    spikes = [(22, 16, 10, 4, CRY_C, -0.2), (27, 15, 15, 5, CRY_P, 0.05), (33, 16, 11, 4.4, CRY_C, 0.3),
              (37, 21, 9, 4, CRY_P, 0.5), (39, 27, 6, 3, CRY_C, 0.7)]
    for (x, b, h, w, R, l) in spikes:
        part(c, lambda t: crystal(t, x + ox, b + oy, h, w, R, l))
    # bras arrière (pendant, derrière)
    sell(c, 35 + ox, 22 + oy, 5, 5, CG_ROCK_D)
    sell(c, 38 + ox, 30 + oy, 4.4, 4.6, CG_ROCK_D)
    sell(c, 38.5 + ox, 37 + oy, 5, 4.2, CG_ROCK_D)
    # jambes
    lx, rx = (14, 27) if f != 1 else (16, 25)
    if atk:
        lx, rx = 12, 29
    spoly(c, [(rx, 32), (rx + 8, 32), (rx + 9, G), (rx - 1, G)], CG_ROCK_D)
    spoly(c, [(lx, 32), (lx + 8, 32), (lx + 9, G), (lx - 1, G)], CG_ROCK)
    for x0 in (lx, rx):
        c.setf(x0 + 1, G - 4, CG_ROCK[1]); c.setf(x0 + 4, G - 3, CG_ROCK[1]); c.setf(x0 + 7, G - 4, CG_ROCK[1])
        c.line(x0, 38, x0 + 3, 39, CG_ROCK[1])
    # bassin
    sell(c, 25 + ox * 0.5, 32 + oy, 10, 4, dk(CG_ROCK, -0.03))
    # torse massif, haut
    tm = mask_of(lambda m: m.ellipse(25 + ox, 23 + oy, 12.5, 9.5, '#000'))
    shade_mask(c, tm, CG_ROCK, contrast=0.44)
    for (a, b) in (((22, 15), (26, 19)), ((26, 19), (25, 22)), ((31, 25), (34, 29)), ((17, 27), (21, 30))):
        c.line(a[0] + ox, a[1] + oy, b[0] + ox, b[1] + oy, CG_ROCK[1])
    # noyau de cristal dans la poitrine
    core = CRY_P if not glow else [CRY_P[1], CRY_P[2], CRY_P[3], CRY_P[4], WHITE]
    cx, cy = 26 + ox, 25 + oy
    c.ellipse(cx, cy, 3.4, 3.8, CG_ROCK[0])
    spoly(c, [(cx, cy - 3), (cx + 2.2, cy), (cx, cy + 3), (cx - 2.2, cy)], core, contrast=0.6)
    c.set(cx - 1, cy - 1, WHITE)
    for (x, y) in ((cx - 4, cy - 3), (cx + 4, cy + 2), (cx - 3, cy + 4)):
        c.setf(x, y, CRY_P[2] if glow or atk else CRY_P[1])
    # tête carrée, posée en avant entre les épaules
    hx, hy = 14 + ox, 13 + oy + (2 if atk else 0)
    def head(t):
        hm = mask_of(lambda m: m.poly([(hx - 7, hy - 5), (hx + 4, hy - 7), (hx + 8, hy - 1), (hx + 6, hy + 6),
                                       (hx - 5, hy + 7), (hx - 8, hy + 1)], '#000'))
        shade_mask(t, hm, CG_HEAD, contrast=0.5, bias=0.04)
        # arcade lourde + orbites
        t.rect(int(hx - 7), int(hy - 1), 11, 4, CG_HEAD[0])
        t.line(hx - 7, hy - 2, hx + 4, hy - 3, CG_HEAD[4])
        t.line(hx - 7, hy - 3, hx + 3, hy - 4, CG_HEAD[3])
        ec = CRY_C[4] if (glow or atk) else CRY_C[3]
        for ex in (hx - 6, hx - 1):
            t.rect(int(ex), int(hy), 3, 2, CRY_C[2])
            t.set(ex, hy, ec); t.set(ex + 1, hy, ec)
            t.set(ex + 2, hy + 1, CRY_C[1])
        # mâchoire / bouche
        if atk:
            t.rect(int(hx - 5), int(hy + 3), 7, 2, CG_HEAD[0]); t.line(hx - 4, hy + 4, hx + 1, hy + 4, CRY_C[2])
        else:
            t.line(hx - 5, hy + 4, hx + 1, hy + 4, CG_HEAD[0])
        t.line(hx + 4, hy, hx + 5, hy + 3, CG_HEAD[1])
    part(c, head)
    part(c, lambda t: (crystal(t, hx + 2, hy - 4, 6, 2.6, CRY_P, 0.35), crystal(t, hx - 2, hy - 4, 4, 2.2, CRY_C, -0.1)))
    # éclats sur l'épaule avant
    part(c, lambda t: crystal(t, 22 + ox, 17 + oy, 7, 3, CRY_C, -0.25))
    # bras avant énorme
    def arm(t):
        if atk:
            # poing écrasé au sol devant
            sell(t, 17, 23, 6, 5.6, CG_ROCK)
            sell(t, 9, 30, 5.2, 5.4, CG_ROCK)
            sell(t, 3, 39, 7, 6.6, CG_ROCK)
            t.line(-3, 40, 1, 43, CG_ROCK[1]); t.line(3, 37, 4, 44, CG_ROCK[1]); t.line(-1, 35, 2, 36, CG_ROCK[1])
            crystal(t, 7, 28, 7, 3, CRY_P, 0.35)
        else:
            s = 1 if f == 1 else 0
            sell(t, 16, 23 + oy, 6, 5.6, CG_ROCK)
            sell(t, 11 + s * 0.5, 30 + oy, 5.2, 5.4, CG_ROCK)
            sell(t, 9 + s, 38 + oy * 0.5, 6.6, 6, CG_ROCK)
            t.line(4 + s, 39, 7 + s, 42, CG_ROCK[1]); t.line(9 + s, 37, 10 + s, 43, CG_ROCK[1])
            t.line(6 + s, 34, 9 + s, 35, CG_ROCK[4])
            crystal(t, 10 + s, 28 + oy, 7, 3, CRY_P, -0.4)
    part(c, arm)
    if atk:
        # éclats qui jaillissent du sol + onde de choc
        for (x, h, w, R, l) in ((-7, 7, 3, CRY_P, -0.3), (-11, 10, 3.6, CRY_C, -0.15), (-15, 6, 2.8, CRY_P, -0.4),
                                (-4, 4, 2.4, CRY_C, 0.0)):
            part(c, lambda t: crystal(t, x, G, h, w, R, l))
        for (x, y) in ((-8, 30), (-13, 32), (-5, 33), (-17, 37), (0, 30)):
            c.set(x, y, CRY_C[3])
        c.line(-17, G - 1, 8, G - 1, CRY_C[2])
    else:
        for (x, y) in ((3 + f, 14 - f), (44, 10 + f), (42 - f, 17)):
            c.set(x, y, CRY_P[3] if f else CRY_C[3])
    return c


def mini_crystal_golem():
    return trio(cg_draw)


# ================================================================ 4. pharaon maudit (désert)

WRAP = ['#3a2e2a', '#7a6650', '#b8a07a', '#ddc9a0', '#f4ead0']
LAPIS = ['#0c163e', '#182f7a', '#2652be', '#4a82e4', '#8ab8ff']
TURQ = ['#0e4a4a', '#1a8a7e', '#36c4aa', '#8af0d4']
CURSE = ['#1a5a1e', '#3ac83a', '#9aff5a', '#eaffc0']


def wrap_lines(c, mask, R):
    """Bandelettes : bandes diagonales alternées sur les pixels de la rampe R."""
    for (x, y) in mask:
        p = c.get(x, y)
        if p not in R:
            continue
        k = (y - x // 3) % 4
        if k == 0:
            c.set(x, y, shift(p, dl=-0.1))
        elif k == 1 and p == R[2]:
            c.set(x, y, R[3])


def crook(t, top, bot, f=0):
    """Sceptre-crosse : hampe à bandes or / lapis, crosse recourbée en haut (vers la gauche)."""
    (x0, y0), (x1, y1) = top, bot
    sline(t, x0, y0, x1, y1, GOLD, 2)
    n = int(abs(y1 - y0))
    for k in range(0, n, 3):
        u = k / max(1, n)
        t.setf(x0 + (x1 - x0) * u, y0 + (y1 - y0) * u, LAPIS[2])
        t.setf(x0 + (x1 - x0) * u + 1, y0 + (y1 - y0) * u, LAPIS[1])
    # crosse
    for a in range(0, 200, 8):
        r = math.radians(-a)
        t.ellipse(x0 - 2.6 + math.cos(r) * 2.6, y0 - 1 + math.sin(r) * 3, 1.1, 1.1, GOLD[2] if a < 120 else GOLD[1])
    t.set(x0 - 1, y0 - 4, GOLD[4]); t.set(x0, y0 - 3, GOLD[3])
    t.set(x0 - 5, y0, GOLD[3])


def ph_draw(f):
    c = Canvas(56, 56)
    atk = f == 2
    oy = 1 if f == 1 else 0
    B = WRAP
    fx, bx = (13, 22) if f != 1 else (15, 20)
    if atk:
        fx, bx = 12, 23
    # lappets du némès derrière les épaules
    spoly(c, [(22, 16 + oy), (30, 16 + oy), (31, 30 + oy), (24, 30 + oy)], dk(GOLD, -0.06))
    for y in range(18, 30, 3):
        c.line(23, y + oy, 30, y + oy, LAPIS[1]); c.line(23, y + 1 + oy, 30, y + 1 + oy, LAPIS[2])
    # jambes bandées
    spoly(c, [(bx, 36 + oy), (bx + 5, 36 + oy), (bx + 5, G - 1), (bx, G - 1)], dk(B, -0.1))
    sell(c, bx + 2, G - 0.6, 3.4, 1.4, dk(B, -0.12))
    spoly(c, [(fx, 36 + oy), (fx + 5, 36 + oy), (fx + 5, G - 1), (fx, G - 1)], B)
    sell(c, fx + 1.5, G - 0.6, 3.6, 1.4, B)
    # bras arrière
    spoly(c, [(26, 25 + oy), (30, 26 + oy), (31, 34 + oy), (28, 35 + oy)], dk(B, -0.1))
    # torse
    tm = mask_of(lambda m: m.poly([(13, 23 + oy), (28, 23 + oy), (29, 36 + oy), (12, 36 + oy)], '#000'))
    shade_mask(c, tm, B, contrast=0.4)
    wrap_lines(c, mask_of(lambda m: m.rect(0, 0, 56, 56, '#000')), B)
    # pagne royal (shendyt) + ceinture dorée
    def kilt(t):
        spoly(t, [(11, 34 + oy), (30, 34 + oy), (31, 41 + oy), (21, 42 + oy), (10, 41 + oy)], ['#6a5a4a', '#bcae96', '#e8dec8', '#faf4e6', '#ffffff'], contrast=0.4)
        for x in range(11, 31):
            t.set(x, 34 + oy, GOLD[2] if x % 4 else LAPIS[2]); t.set(x, 35 + oy, GOLD[1])
        for x in (14, 18, 22, 26):
            t.line(x, 37 + oy, x + 1, 41 + oy, '#bcae96')
        spoly(t, [(18, 36 + oy), (22, 36 + oy), (21.5, 42 + oy), (18.5, 42 + oy)], GOLD, contrast=0.5)
        t.set(19, 38 + oy, LAPIS[2]); t.set(20, 40 + oy, LAPIS[2])
    part(c, kilt)
    # collier ousekh (bandes or / turquoise / lapis)
    def collar(t):
        for k, col in enumerate((GOLD[3], TURQ[2], GOLD[2], LAPIS[2], GOLD[1])):
            t.ellipse(20.5, 23 + oy, 9.4 - k * 0.0, 5.6 - k * 0.0, col) if k == 0 else None
        cm = mask_of(lambda m: m.ellipse(20.5, 23 + oy, 9.4, 5.6, '#000'))
        cm = {(x, y) for (x, y) in cm if y >= 22 + oy}
        for (x, y) in cm:
            d = math.hypot((x + 0.5 - 20.5) / 9.4, (y + 0.5 - 23 - oy) / 5.6)
            band = int(d * 5)
            col = (LAPIS[1], GOLD[2], TURQ[2], GOLD[3], LAPIS[2])[min(4, band)]
            if band == 3 and x % 2:
                col = GOLD[4]
            t.set(x, y, col)
    part(c, collar)
    # tête : visage bandé dans l'ombre du némès
    hx, hy = 17, 14 + oy
    def head(t):
        # némès : coiffe rayée or / lapis qui encadre le visage, pans évasés jusqu'aux épaules
        nm = mask_of(lambda m: m.ellipse(hx + 0.5, hy - 1.5, 9.4, 7.6, '#000'))
        nm |= mask_of(lambda m: m.poly([(hx - 9.5, hy - 1), (hx - 5, hy - 1), (hx - 5.5, hy + 11), (hx - 11, hy + 11)], '#000'))
        nm |= mask_of(lambda m: m.poly([(hx + 5, hy - 2), (hx + 10, hy - 2), (hx + 12, hy + 11), (hx + 6, hy + 11)], '#000'))
        shade_mask(t, nm, GOLD, contrast=0.4)
        for (x, y) in nm:
            if (y - int(hy)) % 2 == 0 and y > hy - 7:
                col = t.get(x, y)
                t.set(x, y, LAPIS[3] if col in GOLD[3:] else (LAPIS[2] if col == GOLD[2] else LAPIS[1]))
        # bandeau frontal
        for x in range(int(hx - 9), int(hx + 10)):
            t.setf(x, hy - 5, GOLD[4] if x < hx else GOLD[3]); t.setf(x, hy - 4, GOLD[1])
        # visage momifié
        fm = mask_of(lambda m: m.ellipse(hx - 0.5, hy + 2.2, 5.6, 5.8, '#000'))
        shade_mask(t, fm, B, contrast=0.4, bias=0.05)
        wrap_lines(t, fm, B)
        # bande d'ombre des yeux + yeux verts luisants
        t.rect(int(hx - 6), int(hy), 11, 3, '#20160e')
        g = CURSE
        for ex in (hx - 5, hx + 0):
            t.rect(int(ex), int(hy + 1), 2, 2, g[2] if not atk else g[3])
            t.set(ex, hy + 1, g[3] if not atk else WHITE)
            t.set(ex + 1, hy + 2, g[1])
        t.line(hx - 6, hy - 1, hx - 3, hy, B[0]); t.line(hx, hy, hx + 3, hy - 1, B[0])  # sourcils froncés
        t.line(hx - 6, hy + 4, hx + 3, hy + 3, B[1])
        # bouche
        if atk:
            t.rect(int(hx - 3), int(hy + 5), 3, 2, INK); t.set(hx - 2, hy + 6, '#3a8a2a')
        else:
            t.line(hx - 3, hy + 5, hx, hy + 5, INK)
        # fausse barbe tressée
        spoly(t, [(hx - 2.5, hy + 7), (hx + 0.5, hy + 7), (hx, hy + 12), (hx - 2, hy + 12)], GOLD, contrast=0.5)
        for y in range(int(hy + 8), int(hy + 12), 2):
            t.line(hx - 2, y, hx, y, LAPIS[2])
        # uraeus (cobra doré) sur le front
        sline(t, hx - 2, hy - 5, hx - 3, hy - 9, GOLD, 2)
        sell(t, hx - 3.4, hy - 9.6, 1.8, 1.6, GOLD)
        t.set(hx - 4, hy - 10, RED_EYE)
    part(c, head)
    # sceptre + bras avant
    if atk:
        def scep(t):
            crook(t, (2, 11), (12, 33), f)
        part(c, scep)
        part(c, lambda t: (sline(t, 15, 25, 9, 22, B, 4), sell(t, 8, 22, 2.3, 2.2, B)))
        # malédiction verte
        for (x, y, r) in ((-3, 8, 3.2), (-8, 6, 2.2), (-12, 9, 1.6)):
            sell(c, x, y, r, r, [CURSE[0], CURSE[1], CURSE[2], CURSE[3]])
        c.set(-4, 7, WHITE)
        for (x, y) in ((-6, 3), (-10, 12), (1, 4), (-15, 6), (-1, 13)):
            c.set(x, y, CURSE[2])
        # mini-crâne dans l'orbe
        c.set(-4, 8, CURSE[0]); c.set(-2, 8, CURSE[0]); c.set(-3, 10, CURSE[0])
    else:
        s = 1 if f == 1 else 0
        part(c, lambda t: crook(t, (7, 13 + oy), (8, G), f))
        part(c, lambda t: (sline(t, 14, 25 + oy, 10, 30 + oy, B, 4), sell(t, 8.6, 30 + oy, 2.3, 2.2, B)))
        c.set(16 + s, 13, CURSE[2])
    return c


RED_EYE = '#ff4a5a'


def mini_pharaoh():
    return trio(ph_draw)


# ================================================================ 5. sorcière des glaces (montagnes gelées)

FW_ROBE = ['#101c4a', '#1c357e', '#2f5ab8', '#5288dc', '#8ab8f2']
FW_FUR = ['#7c8eb8', '#b4c4e2', '#dce6f6', '#f4f8ff', '#ffffff']
FW_SKIN = ['#2e4a8e', '#5a86c8', '#8cb8ec', '#bcdcff']
FW_HAIR = ['#8a9cc8', '#c4d2ee', '#eef3ff', '#ffffff']
FW_EYE = '#3ad8ff'


def fw_draw(f):
    c = Canvas(56, 60)
    atk = f == 2
    oy = -1 if f == 1 else 0
    s = 1 if f == 1 else -1
    # mèches arrière (cheveux blancs longs)
    spoly(c, [(20, 14 + oy), (25, 14 + oy), (28 - s * 0.5, 29 + oy), (25, 27 + oy), (23 + s * 0.5, 30 + oy), (21, 24 + oy)],
          FW_HAIR, contrast=0.4)
    # bras arrière
    spoly(c, [(22, 23 + oy), (27, 24 + oy), (29, 32 + oy), (26, 33 + oy)], dk(FW_ROBE, -0.08))
    # robe évasée qui flotte (ourlet de fourrure)
    hem_y = G - 2 + oy
    robe = [(13, 21 + oy), (25, 21 + oy), (33 + s * 0.5, hem_y), (5 - s * 0.5, hem_y)]
    rm = mask_of(lambda m: m.poly(robe, '#000'))
    shade_mask(c, rm, FW_ROBE, contrast=0.42)
    for x0, x1 in ((15, 10), (19, 18), (23, 27)):
        c.line(x0, 25 + oy, x1, hem_y - 1, FW_ROBE[1])
    c.line(13, 24 + oy, 7, hem_y - 1, FW_ROBE[4])
    # motifs de givre dorés-argent sur la robe
    for (x, y) in ((12, 36), (17, 38), (23, 36), (28, 40), (9, 41)):
        c.setf(x, y + oy, FW_FUR[2]); c.setf(x - 1, y + 1 + oy, FW_FUR[1]); c.setf(x + 1, y + 1 + oy, FW_FUR[1])
    # ourlet de fourrure (bord moelleux)
    def hem(t):
        hm = mask_of(lambda m: m.rect(int(4 - s * 0.5), int(hem_y - 2), int(31 + s), 3, '#000'))
        for x in range(4, 36, 3):
            hm |= mask_of(lambda m: m.ellipse(x + (f == 1), hem_y, 1.8, 1.6, '#000'))
        hm = {(x, y) for (x, y) in hm if (x, hem_y - 1) in rm or (x, hem_y - 2) in rm or (x - 1, hem_y - 1) in rm}
        shade_mask(t, hm, FW_FUR, contrast=0.4, bias=0.05)
    part(c, hem)
    # brume de givre sous la robe (elle lévite)
    for (x, y) in ((8, G), (14, G), (21, G), (28, G)):
        c.set(x + (f == 1), y, '#a8dcff')
        c.set(x + 1 + (f == 1), y, '#e4f8ff')
    # bordure de fourrure sur l'ouverture du manteau
    for y in range(int(23 + oy), int(hem_y - 1)):
        x = 15 - (y - 23 - oy) * 0.28
        c.setf(x, y, FW_FUR[3]); c.setf(x + 1, y, FW_FUR[1])
    # ceinture
    for x in range(10, 29):
        c.setf(x, 28 + oy, ICE[1]); c.setf(x, 29 + oy, FW_ROBE[0])
    diamond(c, 18, 28.5 + oy, 2, 1.5, ICE)
    # col de fourrure
    sell(c, 19.5, 21 + oy, 8, 3.2, FW_FUR)
    for x in range(13, 27, 2):
        c.setf(x, 23 + oy, FW_FUR[1])
    # tête
    hx, hy = 17, 15 + oy
    def head(t):
        sell(t, hx, hy, 6.2, 6.0, FW_SKIN)
        # frange blanche
        spoly(t, [(hx - 7, hy - 1), (hx - 5, hy - 5), (hx + 6, hy - 6), (hx + 7, hy + 4), (hx + 5, hy + 7),
                  (hx + 3, hy + 1), (hx + 2, hy - 2), (hx - 2, hy - 2), (hx - 5, hy - 2)], FW_HAIR, contrast=0.45)
        # yeux perçants
        ey = int(hy)
        for ex in (hx - 6, hx - 1):
            t.rect(int(ex), ey, 2, 3, FW_EYE)
            t.set(ex, ey, WHITE); t.set(ex + 1, ey + 2, '#1a6ab8'); t.set(ex, ey + 2, '#7af0ff')
        t.line(hx - 7, ey - 1, hx - 4, ey, INK)
        t.line(hx - 1, ey, hx + 2, ey - 1, INK)
        # nez pointu de sorcière
        spoly(t, [(hx - 3, hy + 2), (hx - 8, hy + 4.5), (hx - 3, hy + 4)], FW_SKIN, bias=0.1)
        # bouche (rictus / cri)
        if atk:
            t.rect(int(hx - 4), int(hy + 5), 4, 2, INK); t.set(hx - 3, hy + 6, '#8a2a5a'); t.set(hx - 4, hy + 5, WHITE)
        else:
            t.line(hx - 4, hy + 6, hx - 1, hy + 5, INK)
            t.set(hx, hy + 4, INK)
    part(c, head)
    # chapeau pointu à bord de fourrure, pointe recourbée vers l'arrière
    tilt = s * 0.6
    def hat(t):
        spoly(t, [(hx - 7, hy - 5), (hx + 8, hy - 6), (hx + 7, hy - 10), (hx + 9 + tilt, hy - 14),
                  (hx + 14 + tilt, hy - 16), (hx + 10 + tilt, hy - 17), (hx + 4, hy - 14), (hx, hy - 9)],
              FW_ROBE, contrast=0.48)
        t.line(hx + 3, hy - 13, hx, hy - 8, FW_ROBE[4])
        t.set(hx + 14 + tilt, hy - 16, ICE[3])
        # bord de fourrure
        sell(t, hx + 0.5, hy - 5, 10, 2.2, FW_FUR)
        for x in range(int(hx - 8), int(hx + 10), 2):
            t.setf(x, hy - 4, FW_FUR[1])
        # cristal-broche
        diamond(t, hx + 2, hy - 8, 2.0, 1.4, ICE)
    part(c, hat)
    # cristaux flottants
    orb = [((33, 12), (36, 22), (2, 20)), ((34, 10), (35, 24), (3, 17)), ((-4, 10), (-8, 16), (-12, 12))][f]
    for i, (x, y) in enumerate(orb):
        part(c, lambda t: diamond(t, x, y + oy, 3 if i == 0 else 2.4, 1.6 if i else 2, ICE))
    # bâton de glace + bras avant
    if atk:
        part(c, lambda t: sline(t, 14, 33, 2, 9, ['#2a4a9a', '#5a9ae0', '#a8dcff', '#e4f8ff'], 2))
        def top(t):
            diamond(t, 0, 6, 4.4, 2.4, ICE)
            diamond(t, -2.5, 8, 2.2, 1.2, ICE); diamond(t, 2.6, 8, 2.2, 1.2, ICE)
        part(c, top)
        part(c, lambda t: (spoly(t, [(14, 22), (18, 23), (10, 25), (7, 24)], FW_ROBE), sell(t, 7, 24, 2.1, 2, FW_SKIN)))
        sell(c, 7, 24, 2.1, 2, FW_SKIN)
        # rafale de stalactites
        for (x, y, l) in ((-6, 4, 6), (-9, 10, 7), (-5, 15, 5)):
            part(c, lambda t: spoly(t, [(x, y), (x + l, y - 1.4), (x + l, y + 1.4)], ICE, contrast=0.5))
            c.set(x, y, WHITE)
        for (x, y) in ((-12, 7), (-14, 13), (-3, 19), (-10, 2)):
            c.set(x, y, ICE[3])
    else:
        part(c, lambda t: sline(t, 7 + (f == 1) * 0.5, 9 + oy, 8, G - 3 + oy, ['#2a4a9a', '#5a9ae0', '#a8dcff', '#e4f8ff'], 2))
        def top(t):
            diamond(t, 7, 6 + oy, 4.4, 2.4, ICE)
            diamond(t, 4.3, 8 + oy, 2.2, 1.2, ICE); diamond(t, 9.8, 8 + oy, 2.2, 1.2, ICE)
        part(c, top)
        part(c, lambda t: (spoly(t, [(14, 23 + oy), (17, 24 + oy), (11, 29 + oy), (8, 28 + oy)], FW_ROBE),
                           sell(t, 8.5, 28 + oy, 2.1, 2, FW_SKIN)))
        sell(c, 8.5, 28 + oy, 2.1, 2, FW_SKIN)
        c.set(7 + f * 3, 3 + oy - f, WHITE)
    return c


def mini_frost_witch():
    return trio(fw_draw)


# ================================================================ 6. faucheuse (terres maudites)

RP_CLOAK = ['#0c0816', '#1c1430', '#2c2048', '#44346c', '#66529a']
RP_BLADE = ['#2a2a40', '#55586e', '#8e94ac', '#c8cee0', '#f4f6ff']
RP_SHAFT = ['#1a1012', '#3a2420', '#5a3a2e', '#7a5440']
RP_FLAME = PURPLE_GLOW


def scythe(t, top, bot, side=-1, L=17, curl=9):
    """Faux : manche droit (top->bot) ; lame partant de top, perpendiculaire (side choisit le côté),
    qui se recourbe vers le bas du manche. Tranchant sur le bord intérieur."""
    sline(t, top[0], top[1], bot[0], bot[1], RP_SHAFT, 2)
    ax, ay = top[0] - bot[0], top[1] - bot[1]
    n = math.hypot(ax, ay)
    ux, uy = ax / n, ay / n
    px, py = -uy * side, ux * side
    spine, edge = [], []
    for i in range(13):
        u = i / 12
        d = u * L
        drop = (u ** 1.7) * curl
        bx = top[0] + px * d - ux * drop
        by = top[1] + py * d - uy * drop
        wdt = 4.6 * (1 - u) ** 0.75 + 0.5
        spine.append((bx + ux * 1.0, by + uy * 1.0))
        edge.append((bx - ux * wdt, by - uy * wdt))
    spoly(t, spine + edge[::-1], RP_BLADE, contrast=0.5, bias=0.06)
    for (x, y) in edge[1:-2]:
        t.setf(x + ux * 0.7, y + uy * 0.7, RP_BLADE[4])
    for (x, y) in spine[1:-3]:
        t.setf(x - ux * 0.9, y - uy * 0.9, RP_BLADE[1])
    t.set(spine[-1][0], spine[-1][1], RP_BLADE[4])
    # collier d'os à la jonction
    t.ellipse(top[0] - ux * 2, top[1] - uy * 2, 1.4, 1.4, BONE[2])
    t.set(top[0] - ux * 2 - 0.5, top[1] - uy * 2 - 0.5, BONE[4])


def rp_flame(c, x, base, h, seed):
    w = 2.2
    b = math.sin(seed) * 1.2
    spoly(c, [(x - w, base), (x - w * 0.4 + b * 0.5, base - h * 0.6), (x + b, base - h), (x + w * 0.5 + b * 0.3, base - h * 0.5), (x + w, base)],
          [RP_FLAME[1], RP_FLAME[2], RP_FLAME[3], RP_FLAME[4]], contrast=0.5)


def rp_draw(f):
    c = Canvas(64, 64)
    atk = f == 2
    oy = -2 if f == 1 else 0
    s = 1 if f == 1 else -1
    # manche arrière (bras tendu vers le haut du manche, derrière)
    # cape : corps conique qui se termine en lambeaux
    hem = G - 4 + oy
    body = [(12, 16 + oy), (28, 14 + oy), (33, 26 + oy), (36 + s, hem - 2), (32, hem - 5), (30 + s, hem + 1), (26, hem - 4),
            (22 - s, hem + 2), (18, hem - 3), (14 + s, hem), (11, hem - 4), (8, hem - 7), (8, 28 + oy)]
    bm = mask_of(lambda m: m.poly(body, '#000'))
    # flammes violettes sous la cape
    for i, x in enumerate((13, 18, 23, 28, 33)):
        rp_flame(c, x + s * 0.5, hem + 4 - (i % 2), 6 + (i * 3 + f) % 3, i + f * 2)
    shade_mask(c, bm, RP_CLOAK, contrast=0.4, bias=0.04)
    for x0, x1 in ((16, 13), (21, 21), (26, 29)):
        c.line(x0, 22 + oy, x1, hem - 3, RP_CLOAK[1])
    c.line(12, 20 + oy, 9, 32 + oy, RP_CLOAK[4])
    # bordure violette du bas
    for (x, y) in bm:
        if (x, y + 1) not in bm and y > 30 + oy:
            c.set(x, y, RP_FLAME[1])
            c.setf(x, y - 1, RP_CLOAK[3])
    # chaîne / ceinture d'os
    for x in range(10, 33, 2):
        c.setf(x, 28 + oy + (x % 4 == 0), BONE[2])
    # capuche
    hx, hy = 18, 12 + oy
    def hood(t):
        spoly(t, [(hx + 2, hy - 8), (hx + 13, hy - 3 + s * 0.5), (hx + 9, hy + 5)], RP_CLOAK)
        sell(t, hx, hy, 8.4, 8.2, RP_CLOAK)
        t.ellipse(hx - 2.2, hy + 1.6, 5.2, 5.6, '#05030a')
        # crâne dans l'ombre
        sell(t, hx - 2.6, hy + 1.2, 3.8, 3.8, BONE[1:])
        t.rect(int(hx - 6), int(hy), 3, 2, INK); t.rect(int(hx - 1), int(hy), 3, 2, INK)
        ec = RP_FLAME[4] if atk else RP_FLAME[3]
        t.set(hx - 5, hy, ec); t.set(hx - 6, hy + 1, RP_FLAME[2]); t.set(hx - 5, hy + 1, RP_FLAME[2])
        t.set(hx - 1, hy, ec); t.set(hx, hy + 1, RP_FLAME[2])
        t.set(hx - 3, hy + 2, BONE[0])
        for x in range(int(hx - 5), int(hx + 1), 2):
            t.set(x, hy + 4, INK)
        t.line(hx - 9, hy - 1, hx - 5, hy - 7, RP_CLOAK[4])
        t.line(hx - 8, hy + 3, hx - 7, hy + 6, RP_CLOAK[3])
    part(c, hood)
    # aura de lueurs
    for (x, y) in ((3, 20 + f * 2), (39, 14 - f), (38, 34 + f), (2, 36 - f)):
        c.set(x, y + oy, RP_FLAME[3])
        c.set(x, y + oy - 1, RP_FLAME[2])
    if atk:
        # coup de faux : manche tenu à l'horizontale, lame plongeant devant, traînée violette
        trail(c, 17, 24, 14, 19, 268, 140, [RP_FLAME[1], RP_FLAME[2], RP_FLAME[3]])
        part(c, lambda t: scythe(t, (1, 20), (32, 26), -1, 15, 7))
        part(c, lambda t: spoly(t, [(18, 18), (25, 19), (16, 25), (11, 24)], RP_CLOAK))
        sell(c, 12, 23, 2, 1.8, BONE); c.set(11, 22, BONE[4])
        sell(c, 25, 25, 1.8, 1.7, BONE)
    else:
        top, bot = (31, -1 + oy), (11, 44 + oy)
        part(c, lambda t: scythe(t, top, bot, -1, 18, 11))
        # manche avant + mains osseuses sur le manche
        part(c, lambda t: spoly(t, [(15, 19 + oy), (20, 20 + oy), (22, 25 + oy), (17, 27 + oy)], RP_CLOAK))
        hx2 = top[0] + (bot[0] - top[0]) * (21 + oy - top[1]) / (bot[1] - top[1])
        sell(c, hx2, 22 + oy, 2.1, 1.9, BONE); c.set(hx2 - 1, 21 + oy, BONE[4])
        hx3 = top[0] + (bot[0] - top[0]) * (33 + oy - top[1]) / (bot[1] - top[1])
        sell(c, hx3 + 0.5, 34 + oy, 1.9, 1.7, BONE)
    return c


def mini_reaper():
    return trio(rp_draw)


# ================================================================ export

def build():
    g = globals()
    out = {}
    for name in NAMES:
        a, b, k = g[name]()
        out[name] = (a, {})
        out[name + '_b'] = (b, {})
        out[name + '_atk'] = (k, {})
    return out
