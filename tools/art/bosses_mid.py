"""Boss moyens d'étape 10 de chaque monde (chibi 16 bits, lumière en haut à gauche).

Plus imposants que les ennemis normaux (~25-40 px) et que les mini-boss d'étape 5 : canvas de 48 à 56 px de haut.
Chaque boss regarde à GAUCHE et a trois images sur le même canvas (pieds sur la dernière ligne, sauf volants) :
  <nom>       : repos
  <nom>_b     : 2e image de marche / vol / respiration
  <nom>_atk   : pose d'attaque
Couleurs hexadécimales fixes uniquement.
"""
import math

from lib import mix, shift
from enemies import (Canvas, M, part, shade_mask, spoly, sell, sline, mask_of, dk, crop_to,
                     OUT, INK, WHITE, STEEL, BONE, GOLD, LEATHER, ICE)
from minibosses import reduce_colors

MAX_COLORS = 56

NAMES = ('mid_boar_titan', 'mid_giant_spider', 'mid_crystal_bat', 'mid_sand_worm',
         'mid_mammoth', 'mid_hellhound')


def trio(fn):
    """Trois images (repos, _b, _atk) contournées et recadrées sur la même boîte englobante."""
    frames = [fn(f) for f in range(3)]
    for c in frames:
        c.outline(OUT)
    bs = [c.bounds() for c in frames]
    box = (min(b[0] for b in bs), min(b[1] for b in bs), max(b[2] for b in bs), max(b[3] for b in bs))
    return [reduce_colors(crop_to(c, box), MAX_COLORS) for c in frames]


# ---------------------------------------------------------------- outils communs

def bez(pts, t):
    """Point d'une courbe de Bézier (de Casteljau) définie par ses points de contrôle."""
    p = list(pts)
    while len(p) > 1:
        p = [(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t) for a, b in zip(p, p[1:])]
    return p[0]


def tube_mask(pts, r0, r1, steps=None):
    """Masque d'un tube qui suit une courbe de Bézier, de rayon r0 (début) à r1 (fin)."""
    n = steps or int(sum(math.hypot(b[0] - a[0], b[1] - a[1]) for a, b in zip(pts, pts[1:])) * 2) + 2
    mask = set()
    for i in range(n + 1):
        t = i / n
        x, y = bez(pts, t)
        r = r0 + (r1 - r0) * t
        for yy in range(int(y - r - 1), int(y + r + 2)):
            for xx in range(int(x - r - 1), int(x + r + 2)):
                if (xx + 0.5 - x) ** 2 + (yy + 0.5 - y) ** 2 <= r * r + 0.15:
                    mask.add((xx, yy))
    return mask


def tube(c, pts, r0, r1, R, **kw):
    m = tube_mask(pts, r0, r1)
    shade_mask(c, m, R, **kw)
    return m


def leg_col(c, x, top, w, foot_dx, R, hoof=None, ground=None, toes=0, taper=0.6):
    """Patte en colonne (fuselée) avec sabot / pied."""
    g = ground
    mid = top + (g - top) * 0.4
    pts = [(x - 0.5, top), (x + w + 0.5, top), (x + w + 0.4 + foot_dx * 0.4, mid), (x + w - taper + foot_dx, g - 2),
           (x + taper + foot_dx, g - 2), (x - 0.4 + foot_dx * 0.4, mid)]
    spoly(c, pts, R, contrast=0.45)
    if hoof:
        fx = int(round(x + foot_dx))
        for xx in range(fx, fx + w):
            c.set(xx, g - 2, hoof[2] if xx < fx + 2 else hoof[1])
            c.set(xx, g - 1, hoof[1] if xx < fx + w - 2 else hoof[0])
        c.set(fx, g - 2, hoof[3])
        if toes:
            c.set(fx + w // 2, g - 1, OUT)
            c.set(fx + w // 2, g - 2, hoof[0])


def flame_mask_shade(c, mask, F, base_y, top_y):
    """Flammes : cœur clair en bas, pointes sombres en haut."""
    n = len(F)
    h = max(1.0, base_y - top_y)
    for (x, y) in mask:
        v = 0.95 - (base_y - y) / h * 0.75
        if (x + 1, y) not in mask or (x, y - 1) not in mask:
            v -= 0.22
        if (x - 1, y) not in mask:
            v -= 0.08
        c.set(x, y, F[max(0, min(n - 1, int(v * n)))])


def flame(c, x, base, h, w, F, lean=0.0):
    """Langue de feu (pointe vers le haut, inclinée de lean px vers la droite)."""
    pts = [(x - w / 2, base), (x - w * 0.55 + lean * 0.3, base - h * 0.45), (x + lean, base - h),
           (x + w * 0.5 + lean * 0.5, base - h * 0.4), (x + w / 2, base)]
    m = mask_of(lambda t: t.poly(pts, '#000'))
    flame_mask_shade(c, m, F, base, base - h)
    return m


def specks(c, pts, cols):
    for i, (x, y) in enumerate(pts):
        c.set(x, y, cols[i % len(cols)])


# ================================================================ 1. sanglier titan (plaines)

BT_FUR = ['#24140f', '#4a2919', '#774224', '#a56437', '#cf935a']
BT_MANE = ['#120c0e', '#28191a', '#46302b', '#6a4c40', '#8e6c58']
BT_SNOUT = ['#4e2224', '#8e4a46', '#c07a68', '#e6aa90', '#f8d4bc']
BT_HOOF = ['#141016', '#2e2630', '#544a52', '#7c7078']
BT_PLATE = STEEL
BT_LEATHER = ['#2a1810', '#58321c', '#8a542a', '#b87c40', '#e0aa66']
TUSK = ['#5a4c46', '#a49480', '#d4c8aa', '#efe8d2', '#fffdf2']
RED_EYE = ['#5a0a10', '#c0141e', '#ff3a2a', '#ffb08a']


def bt_tusk(c, pts, r0, r1):
    m = tube(c, pts, r0, r1, TUSK, contrast=0.5, bias=0.08)
    # anneaux d'usure
    for t in (0.25, 0.45):
        x, y = bez(pts, t)
        c.setf(x, y, TUSK[1]); c.setf(x + 1, y, TUSK[1])
    x, y = bez(pts, 0.96)
    c.set(x, y, TUSK[4])
    return m


def bt_draw(f):
    c = Canvas(76, 56)
    G = 52
    atk = f == 2
    oy = 2 if f == 1 else 0
    ox = -3 if atk else 0
    hy = 5 if atk else 0  # tête baissée pour la charge
    # pattes : (x, décalage du pied) — loin puis près
    if f == 0:
        far = ((25, 1), (50, -1)); near = ((17, -1), (56, 1))
    elif f == 1:
        far = ((25, -3), (50, 3)); near = ((17, 3), (56, -3))
    else:
        far = ((23, -6), (49, 5)); near = ((15, -8), (56, 7))
    for x, d in far:
        leg_col(c, x + ox * 0.5, 34 + oy, 7, d, dk(BT_FUR, -0.1), BT_HOOF, G, toes=1)
    # queue en tire-bouchon
    def tail(t):
        tube(t, [(62 + ox, 22 + oy), (68 + ox, 18 + oy), (66 + ox, 13 + oy), (63 + ox, 16 + oy)], 1.3, 0.8, BT_MANE)
        t.set(63 + ox, 15 + oy, BT_MANE[4]); t.set(64 + ox, 15 + oy, BT_MANE[3])
    tail(c)
    # corps massif
    bm = mask_of(lambda m: m.ellipse(39 + ox, 29 + oy, 23, 13.5, '#000'))
    bm |= mask_of(lambda m: m.ellipse(27 + ox, 25 + oy, 14, 12, '#000'))  # bosse d'épaule
    shade_mask(c, bm, BT_FUR, contrast=0.42)
    # ventre : soies plus claires
    for x in range(22, 58, 2):
        c.setf(x + ox, 41 + oy - (x % 4 == 0), BT_FUR[1])
    # caparaçon de cuir sur le dos
    def caparison(t):
        pts = [(31 + ox, 17 + oy), (44 + ox, 15 + oy), (56 + ox, 18 + oy), (60 + ox, 26 + oy), (58 + ox, 33 + oy),
               (54 + ox, 31 + oy), (50 + ox, 35 + oy), (45 + ox, 32 + oy), (40 + ox, 36 + oy), (35 + ox, 32 + oy),
               (30 + ox, 34 + oy), (28 + ox, 26 + oy)]
        spoly(t, pts, BT_LEATHER, contrast=0.45)
        # coutures
        for x in range(32, 58, 2):
            t.setf(x + ox, 30 + oy + (x % 3 == 0), BT_LEATHER[3])
        # plaques d'acier rivetées
        for i, (px, py) in enumerate(((35, 19), (44, 17.5), (53, 20))):
            pp = [(px - 4.5 + ox, py + 2 + oy), (px + ox, py - 2.5 + oy), (px + 4.5 + ox, py + 1.5 + oy),
                  (px + 4 + ox, py + 8 + oy), (px - 4 + ox, py + 9 + oy)]
            spoly(t, pp, BT_PLATE, contrast=0.55, bias=0.04)
            t.set(px - 2 + ox, py + 6 + oy, GOLD[3]); t.set(px + 2 + ox, py + 6 + oy, GOLD[2])
            t.line(px - 3 + ox, py + 1 + oy, px + ox, py - 1.5 + oy, BT_PLATE[4])
            # pointe
            spoly(t, [(px - 1.5 + ox, py - 1.5 + oy), (px + 1 + ox, py - 7 + oy - (i == 1)), (px + 1.5 + ox, py - 1 + oy)],
                  BT_PLATE, contrast=0.6)
    part(c, caparison)
    # crinière hérissée sur la bosse
    def mane(t):
        pts = [(12 + ox, 22 + oy + hy)]
        for i, x in enumerate(range(13, 32, 2)):
            peak = 8 + abs(x - 22) * 0.35
            pts.append((x + ox, (peak - 4 if i % 2 == 0 else peak + 1.5) + oy + hy * (32 - x) / 20))
        pts += [(32 + ox, 18 + oy), (30 + ox, 21 + oy), (18 + ox, 22 + oy + hy)]
        spoly(t, pts, BT_MANE, contrast=0.55)
        for x in range(15, 30, 3):
            t.setf(x + ox, 10 + oy + abs(x - 22) * 0.35 + hy * (32 - x) / 20, BT_MANE[4])
    part(c, mane)
    # pattes avant
    for x, d in near:
        leg_col(c, x + ox * 0.5, 36 + oy, 8, d, BT_FUR, BT_HOOF, G, toes=1)
        c.setf(x + ox * 0.5 + 2, 39 + oy, BT_FUR[4])
        # fanon de soies sombres au-dessus du sabot
        bx0 = x + ox * 0.5 + d
        for xx in range(int(bx0), int(bx0) + 8):
            c.setf(xx, G - 3, BT_MANE[2] if xx % 2 else BT_MANE[1])
            if xx % 3 == 0:
                c.setf(xx, G - 4, BT_MANE[2])
    # sangle de poitrail
    c.line(19 + ox, 33 + oy, 31 + ox, 30 + oy, BT_LEATHER[1], 2)
    c.set(25 + ox, 31 + oy, GOLD[3])
    # tête
    hx, hyy = 13 + ox, 27 + oy + hy

    def head(t):
        # oreille
        spoly(t, [(hx + 6, hyy - 7), (hx + 11, hyy - 15), (hx + 13, hyy - 5)], BT_FUR, contrast=0.6)
        t.line(hx + 9, hyy - 8, hx + 11, hyy - 12, BT_SNOUT[1])
        # crâne en coin
        pts = [(hx + 12, hyy - 9), (hx + 2, hyy - 7), (hx - 7, hyy - 1), (hx - 10, hyy + 4), (hx - 9, hyy + 9),
               (hx - 2, hyy + 11), (hx + 10, hyy + 10), (hx + 15, hyy + 2)]
        spoly(t, pts, BT_FUR, contrast=0.5)
        # chanfrein d'acier
        pp = [(hx + 10, hyy - 9), (hx + 1, hyy - 7.5), (hx - 6, hyy - 2), (hx - 3, hyy), (hx + 5, hyy - 2), (hx + 12, hyy - 4)]
        spoly(t, pp, BT_PLATE, contrast=0.6, bias=0.06)
        t.line(hx + 1, hyy - 7, hx + 9, hyy - 8, BT_PLATE[4])
        t.set(hx + 4, hyy - 5, GOLD[3]); t.set(hx + 9, hyy - 6, GOLD[2])
        # groin
        sell(t, hx - 9, hyy + 5.5, 3.2, 4.2, BT_SNOUT)
        t.set(hx - 10, hyy + 4, OUT); t.set(hx - 10, hyy + 7, OUT); t.set(hx - 9, hyy + 4, BT_SNOUT[1])
        t.set(hx - 9, hyy + 7, BT_SNOUT[1])
        # gueule
        t.line(hx - 6, hyy + 9, hx + 4, hyy + 8, BT_MANE[0])
        # œil rouge furieux sous le chanfrein
        ex, ey = hx - 1, hyy + 1
        t.rect(ex, ey, 4, 2, RED_EYE[2]); t.set(ex, ey, RED_EYE[3]); t.set(ex + 3, ey + 1, RED_EYE[1])
        t.set(ex + 1, ey, '#fff2d8')
        t.line(ex - 1, ey - 1, ex + 4, ey - 1, OUT)
        t.set(ex + 4, ey, OUT)
        # cicatrice
        t.line(hx + 6, hyy + 2, hx + 9, hyy + 6, BT_SNOUT[1])
        t.setf(hx + 11, hyy + 6, BT_FUR[4]); t.setf(hx + 2, hyy + 5, BT_FUR[3])
    part(c, head)
    # défenses massives
    if atk:
        part(c, lambda t: bt_tusk(t, [(hx - 4, hyy + 9), (hx - 14, hyy + 10), (hx - 17, hyy + 1)], 2.4, 0.7))
    else:
        part(c, lambda t: bt_tusk(t, [(hx - 4, hyy + 9), (hx - 13, hyy + 12), (hx - 14, hyy)], 2.4, 0.7))
    part(c, lambda t: bt_tusk(t, [(hx - 7, hyy + 8), (hx - 11, hyy + 8), (hx - 11, hyy + 3)], 1.4, 0.6))
    if atk:
        # poussière et lignes de vitesse
        for k, (x, y, ln) in enumerate(((60, 22, 8), (64, 30, 6), (58, 38, 9))):
            c.line(x + 4, y, x + 4 + ln, y, '#c8d4e4' if k != 1 else '#9aa8bc')
        for (x, y, r) in ((62, G - 3, 2.6), (67, G - 4, 2.0), (71, G - 2, 1.6), (56, G - 2, 1.8)):
            sell(c, x, y, r, r * 0.8, ['#7a6a5a', '#a89478', '#cdb994', '#e8d8b4'])
    return c


def mid_boar_titan():
    return trio(bt_draw)


# ================================================================ 2. araignée géante (forêt sombre)

SP_BODY = ['#0c0912', '#1b1428', '#2f2346', '#4a376c', '#6e5696']
SP_LEG = ['#0e0a14', '#1e1630', '#33264e', '#4e3c72', '#72609a']
SP_MARK = ['#4a1060', '#8e2aa8', '#d45ae6', '#ffb4ff']
SP_EYE = ['#7a0a2a', '#e01a4a', '#ff6a8a', '#ffe0ea']
VENOM = ['#2a6a1a', '#5ec02a', '#b4ff6a', '#f0ffd0']


def sp_leg(c, hip, knee, foot, R, w=2.2):
    tube(c, [hip, knee], w, w * 0.85, R, contrast=0.5)
    tube(c, [knee, foot], w * 0.8, 0.6, R, contrast=0.5)
    sell(c, knee[0], knee[1], w * 0.95, w * 0.95, R)
    # anneau articulaire violet
    c.set(knee[0], knee[1] - 1, SP_MARK[1])
    mx, my = (knee[0] * 0.6 + foot[0] * 0.4), (knee[1] * 0.6 + foot[1] * 0.4)
    c.setf(mx, my, SP_MARK[1])
    # poils
    hx, hy = (hip[0] + knee[0]) / 2, (hip[1] + knee[1]) / 2
    c.set(hx + 0.5, hy - 2.4, R[1])


def sp_draw(f):
    c = Canvas(72, 48)
    G = 46
    atk = f == 2
    oy = 1 if f == 1 else 0
    up = -5 if atk else 0  # avant du corps relevé
    cx, cy = 26, 28 + oy + up * 0.7
    # pattes : (hanche, genou, pied) côté proche ; côté loin = décalé
    if f == 0:
        lift = (0, 0, 0, 0)
        fdx = (0, 0, 0, 0)
    elif f == 1:
        lift = (4, 0, 4, 0)
        fdx = (-4, 2, -3, 2)
    else:
        lift = (0, 0, 0, 0)
        fdx = (0, -1, -1, 0)
    near = [((cx - 4, cy + 2), (cx - 17, cy - 13), (cx - 30 + fdx[0], G - 1 - lift[0])),
            ((cx - 1, cy + 3), (cx - 7, cy - 9), (cx - 15 + fdx[1], G - 1 - lift[1])),
            ((cx + 3, cy + 3), (cx + 13, cy - 4), (cx + 19 + fdx[2], G - 1 - lift[2])),
            ((cx + 5, cy + 2), (cx + 27, cy - 6), (cx + 38 + fdx[3], G - 1 - lift[3]))]
    if atk:
        near[0] = ((cx - 4, cy + 1), (cx - 10, cy - 20), (cx - 25, cy - 15))
        near[1] = ((cx - 2, cy + 2), (cx - 6, cy - 15), (cx - 20, cy - 6))
    far = []
    for i, (h, k, ft) in enumerate(near):
        alt = (3 - lift[i]) if f == 1 else 0
        if atk and i < 2:
            far.append(((h[0] + 2, h[1] - 1), (k[0] + 6, k[1] + 1), (ft[0] + 7, ft[1] + 1)))
        else:
            far.append(((h[0] + 2, h[1] - 1), (k[0] + 5, k[1] - 3), (ft[0] + 7, ft[1] - alt)))
    for h, k, ft in far:
        sp_leg(c, h, k, ft, dk(SP_LEG, -0.08), 2.0)
    # abdomen
    ax, ay = cx + 20, 22 + oy + up * 0.25

    def abdomen(t):
        am = mask_of(lambda m: m.ellipse(ax, ay, 14.5, 12, '#000'))
        shade_mask(t, am, SP_BODY, contrast=0.5)
        # motif de crâne / chevrons luisants
        for k in range(2):
            y = ay - 3 + k * 3.5
            w = 6 - k * 2
            col = SP_MARK[2] if k == 0 else SP_MARK[1]
            t.line(ax - w, y + 2, ax, y, col); t.line(ax - w, y + 3, ax, y + 1, SP_MARK[0])
            t.line(ax, y, ax + w, y + 2, col); t.line(ax, y + 1, ax + w, y + 3, SP_MARK[0])
        # crâne luisant
        sell(t, ax - 1, ay - 8, 4.2, 3.2, SP_MARK)
        t.rect(int(ax - 3), int(ay - 8), 1, 2, OUT); t.rect(int(ax), int(ay - 8), 1, 2, OUT)
        t.set(ax - 1, ay - 5, SP_MARK[1]); t.set(ax - 2, ay - 5, SP_MARK[0]); t.set(ax, ay - 5, SP_MARK[0])
        t.set(ax - 4, ay - 10, SP_MARK[3])
        # soies
        for a in range(-150, 60, 22):
            r = math.radians(a)
            x, y = ax + math.cos(r) * 14.5, ay + math.sin(r) * 12
            t.set(x + math.cos(r) * 1.2, y + math.sin(r) * 1.2, SP_BODY[1])
        # filière
        t.set(ax + 13, ay + 7, SP_BODY[3])
    part(c, abdomen)
    # céphalothorax
    def thorax(t):
        sell(t, cx, cy, 10, 7.5, SP_BODY)
        t.line(cx - 3, cy - 6, cx + 6, cy - 5, SP_BODY[4])
        t.setf(cx + 3, cy - 3, SP_MARK[1]); t.setf(cx + 4, cy - 3, SP_MARK[1])
    part(c, thorax)
    # pattes proches
    for h, k, ft in near[::-1]:
        part(c, lambda t, h=h, k=k, ft=ft: sp_leg(t, h, k, ft, SP_LEG, 2.3))
    # tête : grappe d'yeux et chélicères
    fx, fy = int(round(cx - 9)), int(round(cy + (1 if not atk else 0)))

    def face(t):
        sell(t, fx + 1, fy, 5.5, 5, SP_BODY)
        # chélicères
        op = 2 if atk else 0
        for dx, R in ((2, dk(SP_BODY, -0.04)), (-1, SP_BODY)):
            spoly(t, [(fx + dx - 2, fy + 3), (fx + dx + 2, fy + 3), (fx + dx + 1.5, fy + 8), (fx + dx - 1.5, fy + 8)], R)
        # crochets
        for dx, s in ((-1, -1), (2, 1)):
            x0 = fx + dx
            t.line(x0, fy + 8, x0 - 1 - op * (s < 0), fy + 10 + op, SP_MARK[3] if s < 0 else SP_MARK[2])
            t.set(x0 - 1 - op * (s < 0) + 1, fy + 11 + op, SP_MARK[1])
        if atk:
            t.set(fx - 3, fy + 13, VENOM[2]); t.set(fx - 3, fy + 14, VENOM[1])
            t.set(fx + 2, fy + 15, VENOM[2]); t.set(fx - 4, fy + 17, VENOM[1])
        # yeux
        for (x, y, big) in ((fx - 3, fy - 3, 1), (fx + 1, fy - 4, 1), (fx - 4, fy, 0), (fx + 4, fy - 2, 0),
                            (fx - 1, fy + 0, 0), (fx + 3, fy + 1, 0), (fx + 5, fy - 5, 0), (fx - 1, fy - 6, 0)):
            if big:
                t.rect(x, y, 2, 2, SP_EYE[2]); t.set(x, y, SP_EYE[3]); t.set(x + 1, y + 1, SP_EYE[1])
            else:
                t.set(x, y, SP_EYE[2] if (x + y) % 2 else SP_EYE[1])
    part(c, face)
    return c


def mid_giant_spider():
    return trio(sp_draw)


# ================================================================ 3. chauve-souris de cristal (grottes)

CB_FUR = ['#120e2c', '#241c52', '#3a3080', '#584eac', '#847cd4']
CB_CRY = ['#22267a', '#3452c8', '#4e94ec', '#94d2ff', '#e6faff']
CB_VIO = ['#2e1670', '#5a34c4', '#8e66ee', '#c8a8ff', '#f6ecff']
CB_EYE = ['#0a6a8a', '#2ae0ff', '#c4fbff']
CB_INNER = '#5a1a4a'


def cb_wing(c, side, shoulder, wrist, tips, body_pt):
    """Aile de cristal à facettes ; side = -1 (gauche) ou 1 (droite)."""
    rams = (CB_CRY, CB_VIO)
    pts = [wrist] + list(tips) + [body_pt]
    # panneaux de membrane entre les doigts
    panels = [[shoulder, wrist, tips[0]]]
    for i in range(len(tips)):
        a = tips[i]
        b = tips[i + 1] if i + 1 < len(tips) else body_pt
        mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
        sc = (mx + (wrist[0] - mx) * 0.28, my + (wrist[1] - my) * 0.28)
        panels.append([wrist, a, sc, b] if i + 1 < len(tips) else [wrist, a, sc, b, shoulder])
    for i, pp in enumerate(panels):
        R = rams[i % 2] if side < 0 else rams[(i + 1) % 2]
        spoly(c, pp, R, contrast=0.55, bias=0.06 - i * 0.04)
    # arêtes lumineuses (doigts de cristal)
    for t in tips:
        c.line(wrist[0], wrist[1], t[0], t[1], CB_CRY[3])
        c.set(t[0], t[1], CB_CRY[4])
    c.line(shoulder[0], shoulder[1], wrist[0], wrist[1], CB_CRY[4])
    c.line(shoulder[0], shoulder[1] + 1, wrist[0], wrist[1] + 1, CB_CRY[2])
    # éclats de cristal au poignet
    wx, wy = wrist
    spoly(c, [(wx - 1.5, wy), (wx + side * 1, wy - 6), (wx + 1.5, wy)], CB_CRY, contrast=0.6)
    c.set(wx, wy - 3, CB_CRY[4])
    del pts


def cb_draw(f):
    c = Canvas(70, 56)
    atk = f == 2
    by = 22 + (3 if f == 1 else 0) + (3 if atk else 0)
    bx = 35
    if f == 0:
        L = dict(s=(bx - 5, by - 1), w=(bx - 16, by - 14), t=[(bx - 32, by - 18), (bx - 31, by - 4), (bx - 22, by + 6)])
    elif f == 1:
        L = dict(s=(bx - 5, by - 1), w=(bx - 18, by + 2), t=[(bx - 33, by + 8), (bx - 27, by + 17), (bx - 17, by + 20)])
    else:
        L = dict(s=(bx - 5, by - 2), w=(bx - 10, by - 18), t=[(bx - 15, by - 28), (bx - 25, by - 23), (bx - 22, by - 9)])
    # aile droite : symétrique (plan arrière, légèrement plus petite)
    def mirror(p, k=0.92):
        return (bx + (bx - p[0]) * k + 1, p[1] + (1 if f != 1 else 0))
    R_ = dict(s=mirror(L['s']), w=mirror(L['w']), t=[mirror(p) for p in L['t']])
    cb_wing(c, 1, R_['s'], R_['w'], R_['t'], (bx + 3, by + 9))
    # corps
    def body(t):
        sell(t, bx, by + 4, 8.5, 10, CB_FUR)
        # ventre de fourrure plus claire
        sell(t, bx - 1, by + 7, 5, 6, [CB_FUR[2], CB_FUR[3], CB_FUR[3], CB_FUR[4], CB_FUR[4]])
        for y in range(by + 3, by + 13, 2):
            t.setf(bx - 3 + (y % 4 == 0), y, CB_FUR[2])
        # éclats de cristal sur le torse
        spoly(t, [(bx + 3, by + 1), (bx + 6, by - 4), (bx + 7, by + 2)], CB_VIO, contrast=0.6)
        # pattes griffues pendantes
        for dx in (-3, 3):
            t.line(bx + dx, by + 13, bx + dx, by + 16, CB_FUR[1])
            t.set(bx + dx - 1, by + 17, CB_CRY[3]); t.set(bx + dx + 1, by + 17, CB_CRY[3]); t.set(bx + dx, by + 17, CB_CRY[2])
    part(c, body)
    cb_wing(c, -1, L['s'], L['w'], L['t'], (bx - 4, by + 9))
    # tête
    hx, hy = bx - 2, by - 8 + (1 if atk else 0)

    def head(t):
        # oreilles de cristal
        spoly(t, [(hx - 7, hy - 2), (hx - 9, hy - 13), (hx - 2, hy - 5)], CB_CRY, contrast=0.6)
        spoly(t, [(hx + 3, hy - 5), (hx + 9, hy - 13), (hx + 8, hy - 1)], CB_VIO, contrast=0.6)
        t.line(hx - 7, hy - 4, hx - 8, hy - 10, CB_INNER)
        t.line(hx + 6, hy - 4, hx + 8, hy - 10, CB_INNER)
        sell(t, hx, hy, 8, 6.8, CB_FUR)
        # touffe
        for x in range(hx - 4, hx + 5, 2):
            t.setf(x, hy - 6, CB_FUR[4])
        # museau
        sell(t, hx - 3, hy + 3, 3.6, 2.6, CB_FUR)
        t.set(hx - 5, hy + 2, OUT); t.set(hx - 3, hy + 2, OUT)
        # yeux luisants
        for ex in (hx - 6, hx + 0):
            t.rect(ex, hy - 2, 3, 2, CB_EYE[1]); t.set(ex, hy - 2, CB_EYE[2]); t.set(ex + 2, hy - 1, CB_EYE[0])
        t.line(hx - 7, hy - 4, hx - 4, hy - 3, OUT)
        t.line(hx + 3, hy - 4, hx, hy - 3, OUT)
        if atk:
            # cri : gueule grande ouverte
            t.rect(hx - 6, hy + 3, 6, 4, CB_INNER)
            t.line(hx - 6, hy + 3, hx - 1, hy + 3, OUT)
            for x in (hx - 6, hx - 1):
                t.set(x, hy + 4, WHITE); t.set(x, hy + 5, WHITE)
            t.set(hx - 4, hy + 6, '#e0506a'); t.set(hx - 3, hy + 6, '#e0506a')
        else:
            t.line(hx - 5, hy + 4, hx - 1, hy + 4, OUT)
            t.set(hx - 5, hy + 5, WHITE); t.set(hx - 2, hy + 5, WHITE)
    part(c, head)
    if atk:
        # ondes sonores de cristal
        for k, r in enumerate((4, 8, 12)):
            col = (CB_CRY[4], CB_CRY[3], CB_VIO[3])[k]
            for a in range(130, 232, 4):
                t_ = math.radians(a)
                for dr in (0, 1):
                    c.set(hx - 6 + math.cos(t_) * (r + 3 + dr), hy + 5 + math.sin(t_) * (r + 2 + dr), col if dr == 0 else CB_CRY[2])
        for (x, y) in ((hx - 24, hy - 6), (hx - 25, hy + 15)):
            spoly(c, [(x, y), (x + 2, y - 2), (x + 4, y), (x + 2, y + 2)], CB_CRY, contrast=0.6)
    else:
        # poussière de cristal
        specks(c, [(bx - 28 + f * 2, by + 14), (bx + 26, by - 16 + f * 3), (bx + 1, by + 22)], [CB_CRY[4], CB_VIO[3]])
    return c


def mid_crystal_bat():
    return trio(cb_draw)


# ================================================================ 4. ver des sables (désert)

SW_SKIN = ['#4a2616', '#86502a', '#be8442', '#e2b464', '#f8de9e']
SW_BAND = ['#2e1810', '#5a3220', '#87522c', '#ab7240']
SW_PLATE = ['#3e2a1e', '#6e5236', '#a07c50', '#cca874', '#eedcae']
SAND = ['#7a5428', '#b0803e', '#d8b062', '#f0d490', '#fff2c8']
MAW = ['#2a0812', '#5e1424', '#9a2a3a', '#d0505a']


def sw_draw(f):
    c = Canvas(64, 60)
    G = 56
    atk = f == 2
    if f == 0:
        spine = [(40, G + 2), (42, 34), (40, 16), (22, 14)]
    elif f == 1:
        spine = [(40, G + 2), (38, 32), (44, 17), (25, 13)]
    else:
        spine = [(40, G + 2), (47, 26), (31, 10), (15, 31)]
    n = 11
    segs = []
    for i in range(n + 1):
        t = i / n
        x, y = bez(spine, t * 0.92)
        r = 9.6 - t * 1.6
        segs.append((x, y, r))
    # sable remué derrière
    sell(c, 46, G - 1, 14, 4, dk(SAND, -0.08))
    # anneaux du corps, de la base vers la tête
    for i, (x, y, r) in enumerate(segs[:-1]):
        nx, ny = segs[i + 1][0], segs[i + 1][1]

        def seg(t, x=x, y=y, r=r, i=i, nx=nx, ny=ny):
            m = mask_of(lambda m: m.ellipse(x, y, r, r, '#000'))
            shade_mask(t, m, SW_SKIN if i % 2 == 0 else SW_BAND + [SW_SKIN[3]], contrast=0.5)
            # plaque dorsale côté extérieur de la courbe (dos à droite / en haut)
            dx, dy = nx - x, ny - y
            L = math.hypot(dx, dy) or 1
            px, py = dy / L, -dx / L  # normale (côté dos)
            if px < 0:
                px, py = -px, -py
            sx, sy = x + px * (r - 1.5), y + py * (r - 1.5)
            spoly(t, [(sx - dy / L * 2.5, sy + dx / L * 2.5), (sx + px * 4, sy + py * 4), (sx + dy / L * 2.5, sy - dx / L * 2.5)],
                  SW_PLATE, contrast=0.6)
        part(c, seg)
    # tête : gueule circulaire tournée vers la gauche
    hx, hy, hr = segs[-1][0] - 1, segs[-1][1], 9.5 if not atk else 10.5
    ang = -0.15 if not atk else 0.85  # direction de la gueule (0 = gauche, + = vers le bas)

    def head(t):
        sell(t, hx, hy, hr, hr, SW_SKIN)
        # collerette de plaques
        for k in range(5):
            a = math.radians(-70 + k * 35)
            x, y = hx + math.cos(a) * (hr - 1), hy + math.sin(a) * (hr - 1)
            spoly(t, [(x - 2, y), (x + math.cos(a) * 4, y + math.sin(a) * 4), (x + 2 * math.sin(a), y + 2)], SW_PLATE, contrast=0.6)
        mx = hx - math.cos(ang) * hr * 0.42
        my = hy + math.sin(ang) * hr * 0.42
        rw, rh = (3.6, 6.4) if not atk else (5.6, 7.6)
        if atk:
            rw, rh = 6.4, 6.8
        # lèvre
        sell(t, mx, my, rw + 1.6, rh + 1.4, SW_PLATE)
        # gouffre
        t.ellipse(mx, my, rw, rh, MAW[1])
        t.ellipse(mx + 0.6, my + 0.5, rw * 0.62, rh * 0.62, MAW[0])
        t.ellipse(mx + 1, my + 0.8, rw * 0.28, rh * 0.28, OUT)
        # anneau de dents (pointes vers le centre)
        for a10 in range(0, 360, 30 if not atk else 24):
            a = math.radians(a10)
            x, y = mx + math.cos(a) * rw, my + math.sin(a) * rh
            t.set(x, y, WHITE if a10 % 60 == 0 else BONE[3])
            t.set(mx + math.cos(a) * (rw - 1), my + math.sin(a) * (rh - 1), BONE[2])
        for a10 in range(15, 360, 45):
            a = math.radians(a10)
            t.set(mx + 0.6 + math.cos(a) * rw * 0.55, my + 0.5 + math.sin(a) * rh * 0.55, BONE[1])
        # reflet de chair
        t.set(mx - rw * 0.4, my - rh * 0.6, MAW[3])
    part(c, head)
    # dune de sable devant la base
    def dune(t):
        m = mask_of(lambda m: m.ellipse(39, G + 1, 19, 7.5, '#000'))
        m = {p for p in m if p[1] <= G - 1}
        shade_mask(t, m, SAND, contrast=0.5)
        for x in range(24, 54, 4):
            t.setf(x, G - 3 - (x % 8 == 0), SAND[4])
            t.setf(x + 2, G - 2, SAND[1])
    part(c, dune)
    # sable qui retombe
    drops = [(30 + f, 30 + f * 2), (50 - f, 26 + f * 3), (52, 38 + f), (28 - f, 42), (48 + f, 44 - f)]
    if atk:
        drops = [(36, 14), (42, 20), (48, 30), (26, 10), (6, 44), (10, 48), (3, 40), (18, 50)]
    for i, (x, y) in enumerate(drops):
        c.set(x, y, SAND[3]); c.set(x, y + 1, SAND[2])
        if i % 2:
            c.set(x + 1, y + 3, SAND[2])
    if atk:
        # gerbe de sable soulevée devant
        for (x, y) in ((4, G - 4), (8, G - 7), (2, G - 9), (12, G - 3), (6, G - 12), (14, G - 8)):
            c.set(x, y, SAND[3]); c.set(x + 1, y, SAND[2]); c.set(x, y + 1, SAND[1])
    # rien sous le sol
    for y in range(G + M, c.h):
        c.px[y] = [None] * c.w
    return c


def mid_sand_worm():
    return trio(sw_draw)


# ================================================================ 5. mammouth de givre (montagnes gelées)

MM_FUR = ['#1c2236', '#36435c', '#556886', '#7c92b0', '#a8bcd4']
MM_SKIN = ['#262a3c', '#43485e', '#646a82', '#8a90a8']
MM_TUSK = ['#5e6274', '#a6b2c4', '#d6e2ee', '#f2f8ff', '#ffffff']
FROST = ['#5a90d0', '#a4d8ff', '#e2f6ff', '#ffffff']
MM_EYE = ['#0a3a6a', '#4ac8ff', '#e0fbff']


def fringe(c, x0, x1, y, R, depth=3, seed=0):
    """Frange de poils hirsute vers le bas."""
    for x in range(int(x0), int(x1)):
        k = (x * 5 + seed * 3) % 4
        d = depth if k in (0, 2) else depth - 1 - (k == 3)
        for yy in range(d):
            c.set(x, y + yy, R[1] if yy < d - 1 else R[0])
        if k == 0:
            c.set(x, y - 1, R[2])


def mm_draw(f):
    c = Canvas(72, 58)
    G = 56
    atk = f == 2
    oy = 1 if f == 1 else 0
    rear = -1 if atk else 0
    # pattes
    if f == 0:
        far = ((24, 1), (50, -1)); near = ((17, -1), (55, 1))
    elif f == 1:
        far = ((24, -2), (50, 2)); near = ((17, 2), (55, -2))
    else:
        far = ((24, -1), (50, 1)); near = ((16, -3), (56, 2))
    for x, d in far:
        leg_col(c, x, 38 + oy, 9, d, dk(MM_FUR, -0.12), MM_TUSK[:2] + MM_TUSK[1:3], G)
    # queue
    tube(c, [(63, 24 + oy), (67, 30 + oy), (66, 36 + oy)], 1.3, 1.0, MM_FUR)
    c.set(66, 37 + oy, MM_FUR[0]); c.set(65, 37 + oy, MM_FUR[1])
    # corps laineux
    bm = mask_of(lambda m: m.ellipse(41, 32 + oy + rear * 0.5, 23, 14, '#000'))
    bm |= mask_of(lambda m: m.ellipse(30, 26 + oy + rear, 15, 14, '#000'))  # bosse
    shade_mask(c, bm, MM_FUR, contrast=0.45)
    # mèches
    for i, x in enumerate(range(22, 62, 3)):
        y = 28 + oy + (i % 3)
        c.line(x, y, x + 1, y + 4, MM_FUR[1])
        c.setf(x - 1, y - 1, MM_FUR[3])
    fringe(c, 20, 64, 43 + oy, MM_FUR, 4, 0)
    # givre sur le dos
    def frost(t):
        m = set()
        for (x, y) in bm:
            if (x, y - 1) not in bm or (x, y - 2) not in bm or ((x, y - 3) not in bm and (x * 3) % 5 < 2):
                m.add((x, y))
        for (x, y) in m:
            t.set(x, y, FROST[2] if (x, y - 1) not in bm else FROST[1])
        for (x, y) in m:
            if (x, y - 1) not in bm and x % 7 == 0:
                t.set(x, y - 1, FROST[3])
        # cristaux de givre sur la bosse
        for (x, h) in ((26, 5), (32, 7), (38, 5), (46, 4)):
            ytop = min(yy for (xx, yy) in bm if xx == x)
            spoly(t, [(x - 1.5, ytop + 2), (x, ytop - h), (x + 1.5, ytop + 2)], ICE, contrast=0.6)
        # glaçons
        for x in range(24, 60, 5):
            yb = max(yy for (xx, yy) in bm if xx == x) - 13
            t.set(x, yb, FROST[1])
    frost(c)
    # pattes avant
    for x, d in near:
        if atk and x < 30:
            # patte avant levée
            spoly(c, [(x + 1, 36), (x + 9, 36), (x + 2, 46), (x - 5, 44)], MM_FUR, contrast=0.45)
            c.rect(x - 6, 44, 7, 2, MM_TUSK[1]); c.set(x - 6, 44, MM_TUSK[3])
            continue
        leg_col(c, x, 40 + oy, 9, d, MM_FUR, MM_TUSK[:2] + MM_TUSK[1:3], G, toes=1)
        fringe(c, x, x + 9, 40 + oy, MM_FUR, 3, x)
    # tête
    hx, hy = 15, 22 + oy + rear * 2

    def head(t):
        sell(t, hx + 3, hy + 2, 10, 11, MM_FUR)
        # dôme crânien
        sell(t, hx + 1, hy - 5, 7.5, 7, MM_FUR)
        # givre du crâne
        for x in range(hx - 5, hx + 7):
            yt = hy - 5 - int(math.sqrt(max(0, 49 * (1 - ((x + 0.5 - hx - 1) / 7.5) ** 2))))
            t.setf(x, yt + 1, FROST[2]); t.setf(x, yt + 2, FROST[1] if x % 3 else FROST[2])
        # oreille
        sell(t, hx + 11, hy + 1, 3.2, 4.5, dk(MM_FUR, -0.06))
        t.line(hx + 10, hy - 1, hx + 10, hy + 3, MM_FUR[0])
        # œil glacé, sourcil furieux
        t.rect(hx - 1, hy - 1, 3, 2, MM_EYE[1]); t.set(hx - 1, hy - 1, MM_EYE[2]); t.set(hx + 1, hy, MM_EYE[0])
        t.line(hx - 3, hy - 3, hx + 2, hy - 2, OUT)
        t.set(hx + 2, hy - 1, OUT)
        # poils de la joue
        for y in range(hy + 3, hy + 10, 2):
            t.setf(hx + 6, y, MM_FUR[1]); t.setf(hx + 9, y + 1, MM_FUR[1])
    part(c, head)
    # trompe
    if atk:
        tpts = [(hx - 4, hy + 4), (hx - 12, hy + 3), (hx - 13, hy - 8), (hx - 7, hy - 12)]
    else:
        sway = 1 if f == 1 else 0
        tpts = [(hx - 4, hy + 4), (hx - 9, hy + 12), (hx - 6 + sway, hy + 24), (hx - 10 + sway, hy + 27)]

    def trunk(t):
        m = tube(t, tpts, 3.6, 1.6, MM_SKIN + [MM_FUR[4]], contrast=0.5)
        for i in range(2, 12):
            x, y = bez(tpts, i / 13)
            t.setf(x + 1, y, MM_SKIN[0])
        x, y = bez(tpts, 1.0)
        t.set(x, y, MM_SKIN[0])
        return m
    # défenses (derrière la trompe : celle du fond d'abord)
    if atk:
        tk = [(hx - 1, hy + 9), (hx - 12, hy + 14), (hx - 22, hy + 6), (hx - 22, hy - 4)]
    else:
        tk = [(hx - 1, hy + 9), (hx - 9, hy + 20), (hx - 20, hy + 18), (hx - 20, hy + 7)]
    tk2 = [(p[0] + 4, p[1] - 2) for p in tk]

    def tusk(t, pts, R):
        tube(t, pts, 2.6, 0.8, R, contrast=0.55, bias=0.06)
        for u in (0.82, 0.9, 0.97):
            x, y = bez(pts, u)
            t.setf(x, y, FROST[3] if u > 0.9 else FROST[1])
    part(c, lambda t: tusk(t, tk2, dk(MM_TUSK, -0.1)))
    part(c, trunk)
    part(c, lambda t: tusk(t, tk, MM_TUSK))
    if atk:
        # bouche ouverte + barrissement glacé
        c.rect(hx - 2, hy + 6, 4, 3, '#3a1a2a'); c.set(hx - 1, hy + 8, '#c05068')
        for (x, y, r) in ((hx - 13, hy - 13, 2.2), (hx - 18, hy - 12, 1.6), (hx - 7, hy - 14, 1.4)):
            sell(c, x, y, r, r, FROST)
        for (x, y) in ((hx - 21, hy - 8), (hx - 2, hy - 15), (hx - 20, hy - 15)):
            c.set(x, y, FROST[3]); c.set(x - 1, y, FROST[1]); c.set(x + 1, y, FROST[1]); c.set(x, y - 1, FROST[1]); c.set(x, y + 1, FROST[1])
    else:
        specks(c, [(4 + f * 2, 12 + f), (66, 9 + f * 2), (60 - f, 6)], [FROST[3], FROST[1]])
    return c


def mid_mammoth():
    return trio(mm_draw)


# ================================================================ 6. chien de l'enfer à deux têtes (terres maudites)

HH_FUR = ['#0a070c', '#1a1116', '#2e1a1e', '#4a2626', '#6e3830']
HH_EMBER = ['#5a0a0a', '#a8180e', '#e8461a', '#ff9a2a', '#ffe27a']
HH_FIRE = ['#7a0e08', '#d0300e', '#ff7414', '#ffbe32', '#fff09a']
HH_EYE = ['#ff6a10', '#ffd040', '#fffbd0']


def hh_head(c, hx, hy, R, bite=0, far=False):
    """Tête de molosse tournée à gauche ; bite = ouverture de la gueule (px)."""
    def head(t):
        # oreille pointue en arrière
        spoly(t, [(hx + 4, hy - 3), (hx + 11, hy - 10), (hx + 9, hy - 1)], R, contrast=0.6)
        t.line(hx + 6, hy - 3, hx + 9, hy - 7, HH_EMBER[1])
        # crâne
        sell(t, hx + 3, hy + 1, 7.5, 6.2, R)
        # museau
        spoly(t, [(hx + 1, hy - 4), (hx - 6, hy - 1.5), (hx - 9.5, hy), (hx - 9.5, hy + 3), (hx + 2, hy + 4)], R, contrast=0.5)
        t.set(hx - 9, hy, OUT); t.set(hx - 9, hy + 1, OUT); t.set(hx - 8, hy, HH_FUR[3])
        # mâchoire inférieure
        jy = hy + 4 + bite
        spoly(t, [(hx - 7, jy - 1 + bite * 0.2), (hx + 3, hy + 3), (hx + 4, hy + 6), (hx - 6, jy + 1)], dk(R, -0.04), contrast=0.5)
        if bite:
            # intérieur de la gueule + crocs
            spoly(t, [(hx - 8, hy + 3.5), (hx + 2, hy + 3.5), (hx - 6, jy - 0.5)], ['#3a0808', '#7a1010', '#b02020'], edge=False)
            for x in range(int(hx - 8), int(hx + 1), 2):
                t.set(x, hy + 4, WHITE)
            for x in range(int(hx - 6), int(hx + 0), 2):
                t.set(x + 1, jy - 1, BONE[3])
        else:
            t.line(hx - 8, hy + 3, hx + 1, hy + 4, OUT)
            t.set(hx - 6, hy + 4, WHITE); t.set(hx - 2, hy + 5, WHITE)
        # œil brûlant
        ex, ey = hx - 1, hy - 1
        t.rect(ex, ey, 3, 2, HH_EYE[1]); t.set(ex, ey, HH_EYE[2]); t.set(ex + 2, ey + 1, HH_EYE[0])
        t.line(ex - 1, ey - 1, ex + 3, ey - 2, OUT)
        # veines de braise
        if not far:
            t.set(hx + 5, hy + 3, HH_EMBER[2]); t.set(hx + 6, hy + 2, HH_EMBER[1])
    part(c, head)


def mix_r(R, col, k):
    return [mix(x, col, k) for x in R]


def hh_mane(c, pts, f, scale=1.0):
    """Crinière de flammes : langues couchées vers l'arrière (droite)."""
    for i, (x, y) in enumerate(pts):
        h = (7 + (i + f) % 3 * 2) * scale
        flame(c, x, y, h, 4.4 * scale, HH_FIRE, lean=3.5 + ((i + f) % 2))


def hh_draw(f):
    c = Canvas(72, 52)
    G = 50
    atk = f == 2
    oy = 1 if f == 1 else 0
    lo = 2 if atk else 0
    # pattes : (x hanche, dx pied) ; pattes arrière coudées
    if f == 0:
        ff, fb, hf, hb = 0, 3, 0, -3
    elif f == 1:
        ff, fb, hf, hb = 4, -1, -4, 1
    else:
        ff, fb, hf, hb = -6, 2, 4, 2

    def fleg(t, x, dx, R):
        sline(t, x, 30 + oy + lo, x + dx * 0.5 - 0.5, 40 + oy, R, 5)
        sline(t, x + dx * 0.5 - 0.5, 40 + oy, x + dx, G - 2, R, 4)
        spoly(t, [(x + dx - 3.5, G - 3), (x + dx + 2, G - 3), (x + dx + 2, G - 1), (x + dx - 4, G - 1)], R)
        t.set(x + dx - 4, G - 1, BONE[3]); t.set(x + dx - 2, G - 1, BONE[3])

    def hleg(t, x, dx, R):
        sline(t, x, 28 + oy, x + 4, 38 + oy, R, 7)
        sline(t, x + 4, 38 + oy, x + 1 + dx, 44, R, 4)
        sline(t, x + 1 + dx, 44, x + dx, G - 2, R, 3)
        spoly(t, [(x + dx - 3.5, G - 3), (x + dx + 2, G - 3), (x + dx + 2, G - 1), (x + dx - 4, G - 1)], R)
        t.set(x + dx - 4, G - 1, BONE[3])
    FAR = dk(HH_FUR, -0.04)
    fleg(c, 27, fb, FAR)
    hleg(c, 53, hb, FAR)
    # queue enflammée
    flame(c, 63, 26 + oy, 12 + (f % 2) * 2, 5, HH_FIRE, lean=4)
    tube(c, [(58, 25 + oy), (62, 22 + oy), (64, 18 + oy)], 1.6, 1.2, HH_FUR)
    # corps
    def body(t):
        m = mask_of(lambda m: m.ellipse(27, 27 + oy + lo, 11, 9.5, '#000'))
        m |= mask_of(lambda m: m.ellipse(52, 26 + oy, 9, 7.5, '#000'))
        m |= mask_of(lambda m: m.poly([(30, 19 + oy + lo), (50, 19 + oy), (52, 30 + oy), (32, 34 + oy + lo)], '#000'))
        shade_mask(t, m, HH_FUR, contrast=0.45)
        # côtes et fissures de braise
        for k in range(3):
            t.line(33 + k * 3, 24 + oy, 34 + k * 3, 30 + oy, HH_FUR[1])
        for (x0, y0, x1, y1) in ((22, 30, 27, 33), (44, 22, 47, 26), (55, 25, 57, 28)):
            t.line(x0, y0 + oy + lo, x1, y1 + oy + lo, HH_EMBER[2])
            t.set(x0, y0 + oy + lo, HH_EMBER[3])
        # collier clouté
        t.line(17, 22 + oy + lo, 22, 31 + oy + lo, '#3a2a30', 2)
        for y in (24, 27, 30):
            t.set(18 + (y - 22) * 0.55, y + oy + lo, STEEL[3])
    part(c, body)
    # pattes proches
    part(c, lambda t: hleg(t, 49, hf, HH_FUR))
    part(c, lambda t: fleg(t, 22, ff, HH_FUR))
    # têtes : la lointaine (plus haute) puis la proche
    bite = 3 if atk else 0
    if atk:
        far_h, near_h = (21, 7), (10, 21)
    else:
        far_h, near_h = (25, 6 + oy), (13, 18 + oy)
    # cou lointain + crinière
    sline(c, 28, 20 + oy, far_h[0] + 4, far_h[1] + 3, dk(HH_FUR, -0.04), 8)
    hh_mane(c, [(far_h[0] + 8, far_h[1] - 1), (far_h[0] + 12, far_h[1] + 3), (far_h[0] + 15, far_h[1] + 7)], f, 0.9)
    # cou proche + crinière
    part(c, lambda t: sline(t, 26, 24 + oy + lo, near_h[0] + 4, near_h[1] + 3, HH_FUR, 9))
    hh_mane(c, [(near_h[0] + 8, near_h[1] - 1), (near_h[0] + 13, near_h[1] + 2), (near_h[0] + 18, near_h[1] + 4),
                (36, 21 + oy + lo)], f + 1, 0.8)
    hh_head(c, far_h[0], far_h[1], mix_r(HH_FUR, '#3a1418', 0.25), bite, far=True)
    hh_head(c, near_h[0], near_h[1], HH_FUR, bite)
    if atk:
        # morsure enflammée : gerbe de feu devant les gueules
        for (x, y, r) in ((near_h[0] - 12, near_h[1] + 6, 3.4), (near_h[0] - 16, near_h[1] + 4, 2.4),
                          (far_h[0] - 12, far_h[1] + 6, 2.6), (far_h[0] - 16, far_h[1] + 3, 1.6)):
            m = mask_of(lambda m: m.ellipse(x, y, r, r * 0.85, '#000'))
            flame_mask_shade(c, m, HH_FIRE[::-1][:1] + HH_FIRE[1:], y + r, y - r)
            c.set(x - 0.5, y, HH_FIRE[4])
        for (x, y) in ((near_h[0] - 19, near_h[1]), (near_h[0] - 14, near_h[1] + 11), (far_h[0] - 19, far_h[1] - 2)):
            c.set(x, y, HH_FIRE[3]); c.set(x + 1, y, HH_FIRE[2])
    else:
        specks(c, [(38 + f * 2, 9 + f), (45, 13 - f), (66, 11 + f * 2)], [HH_FIRE[3], HH_FIRE[2]])
    return c


def mid_hellhound():
    return trio(hh_draw)


# ---------------------------------------------------------------- export

def build():
    g = globals()
    out = {}
    for name in NAMES:
        a, b, k = g[name]()
        out[name] = (a, {})
        out[name + '_b'] = (b, {})
        out[name + '_atk'] = (k, {})
    return out
