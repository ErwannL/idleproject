"""Alliés invocables de rareté SSR (chibi 16 bits) : 48×48, face à DROITE, pieds sur y=47.

Contrat (build) : pour chaque id de ALLIES,
  ally_<id>      : pose de repos
  ally_<id>_b    : repos alterné (ailes / cheveux / aura bougent, léger rebond)
  ally_<id>_atk  : attaque / incantation vers l'avant
Tous sur le même canvas 48×48, corps centré vers x≈22 (ailes et aura peuvent déborder).
Couleurs hexadécimales fixes uniquement (pas de calques teintables).
"""
import math

from lib import Canvas, PadCanvas
from knight import ball, limb, spine_fill

W, H = 48, 48
GROUND = 47
PADX = 16  # marge invisible : rien n'est coupé au bord (recadrage dans allies_anim)
OUT = '#1a1226'
WHITE = '#ffffff'
LIGHT = (-0.6, -0.8)

ALLIES = ('archangel', 'demon_queen', 'ice_empress', 'shadow_lord', 'sylvan_guardian')

# ---------------------------------------------------------------- palettes communes

SKIN = ['#a8604e', '#e39a78', '#ffcfa6', '#ffe6cc']
BLUSH = '#f7889a'
MOUTH = '#8a2a3a'

GOLD = ['#7a3e18', '#c0761e', '#eab53a', '#ffe27a', '#fffbd0']
BLUE = ['#152a6e', '#1f50b8', '#3a88ee', '#7cc6ff', '#d4f2ff']
LIGHTB = ['#5a78c8', '#98b8f2', '#d0e4ff', '#f2f8ff', '#ffffff']


# ---------------------------------------------------------------- outils

def new():
    return PadCanvas(W, H, PADX)


def stamp(dst, src, outline=OUT):
    """Contourne la pièce puis la pose (contour par pièce = séparations lisibles)."""
    if outline:
        src.outline(outline)
    dst.paste(src, 0, 0)
    return dst


class _Mask(Canvas):
    """Canvas à marge pour construire des masques en coordonnées libres (même négatives)."""
    PAD = 24

    def __init__(self):
        super().__init__(W + 2 * self.PAD, H + 2 * self.PAD)

    def set(self, x, y, c):
        super().set(x + self.PAD, y + self.PAD, c)

    def setf(self, x, y, c):
        super().setf(x + self.PAD, y + self.PAD, c)


def mask_of(draw):
    m = _Mask()
    draw(m)
    p = _Mask.PAD
    return {(x - p, y - p) for y in range(m.h) for x in range(m.w) if m.px[y][x] is not None}


def shade(c, mask, colors, contrast=0.36, bias=0.0, edge=True, light=LIGHT, only_inside=False):
    """Remplit un masque avec une rampe éclairée en haut à gauche (liseré clair / sombre)."""
    if not mask:
        return
    xs = [p[0] for p in mask]
    ys = [p[1] for p in mask]
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    rx, ry = max(1.0, (max(xs) - min(xs)) / 2 + 0.5), max(1.0, (max(ys) - min(ys)) / 2 + 0.5)
    n = len(colors)
    for (x, y) in mask:
        dx, dy = (x - cx) / rx, (y - cy) / ry
        v = 0.5 + bias + (dx * light[0] + dy * light[1]) * contrast
        if edge:
            if (x - 1, y) not in mask or (x, y - 1) not in mask:
                v += 0.2
            if (x + 1, y) not in mask or (x, y + 1) not in mask:
                v -= 0.22
        (c.setf if only_inside else c.set)(x, y, colors[max(0, min(n - 1, int(v * n)))])


def spoly(c, pts, colors, **kw):
    shade(c, mask_of(lambda m: m.poly(pts, '#000')), colors, **kw)


def sline(c, x0, y0, x1, y1, colors, width=2, **kw):
    shade(c, mask_of(lambda m: m.line(x0, y0, x1, y1, '#000', width)), colors, **kw)


def along(p, a, d):
    r = math.radians(a)
    return (p[0] + math.cos(r) * d, p[1] + math.sin(r) * d)


def perp(a):
    r = math.radians(a)
    return (-math.sin(r), math.cos(r))


def sparkle(c, x, y, cols, big=False):
    """Étincelle : point brillant, croix pour les grandes (cols : [cœur, branches])."""
    c.set(x, y, cols[0])
    if big:
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            c.set(x + dx, y + dy, cols[1])


def aura(c, pts, cols):
    for i, (x, y, big) in enumerate(pts):
        sparkle(c, x, y, cols, big)


def strand_shade(R):
    """Ombrage de mèche (spine_fill) : liseré clair côté extérieur, brin clair ondulé."""
    def f(t, s, x, y):
        if s < -0.55:
            return R[3]
        if s > 0.45:
            return R[0] if t > 0.6 else R[1]
        if abs(s + 0.1 - 0.2 * math.sin(t * 9)) < 0.16 and t < 0.8:
            return R[3] if t < 0.35 else R[2]
        return R[2] if t < 0.7 else R[1]
    return f


def lock(c, spine, widths, R, outline=OUT):
    p = new()
    spine_fill(p, spine, widths, strand_shade(R))
    stamp(c, p, outline)


# ---------------------------------------------------------------- tête chibi

HX, HY = 21.5, 15.5  # centre de la tête (repos)

DEFAULT_FRINGE = [8, 6, 2, 0, 1, 2, 0, -1, 0, 1, -1, -2]


def eye(c, x, y, iris, far=False):
    """Grand œil d'anime 2×4 : cils, reflet blanc, iris dégradé (sombre en haut)."""
    c.set(x, y, OUT); c.set(x + 1, y, OUT)
    c.set(x, y + 1, WHITE); c.set(x + 1, y + 1, iris[0])
    c.set(x, y + 2, iris[0]); c.set(x + 1, y + 2, iris[1])
    c.set(x, y + 3, iris[1]); c.set(x + 1, y + 3, iris[2])
    if far:
        c.set(x + 2, y, OUT)
    else:
        c.set(x - 1, y, OUT)


def head(c, hx, hy, hair, iris, mouth='smile', fringe=DEFAULT_FRINGE, brows=None, back_mass=True,
         blush=BLUSH, skin=SKIN):
    """Tête : masse de cheveux, visage clair tourné à droite, frange en dents de scie, grands yeux."""
    hb = new()
    ball(hb, hx - 0.6, hy - 1.4, 8.2, 7.8, hair)
    if back_mass:
        stamp(c, hb.copy())
    # visage : aplat clair, ombre au bord bas-droit (style du chevalier)
    face = new()
    fcx, fcy, frx, fry = hx + 1.5, hy + 1.3, 6.9, 6.3
    for y in range(H):
        for x in range(W):
            dx, dy = (x + 0.5 - fcx) / frx, (y + 0.5 - fcy) / fry
            d = dx * dx + dy * dy
            if d <= 1:
                col = skin[2]
                if d > 0.6 and (dx * 0.5 + dy) > 0.45:
                    col = skin[1]
                face.set(x, y, col)
    stamp(c, face)
    # frange / calotte : pixels de la masse au-dessus de la ligne de frange, et tout l'arrière
    bangs = new()
    x0 = int(hx - 2.5)
    for y in range(-PADX, H + PADX):
        for x in range(-PADX, W + PADX):
            col = hb.get(x, y)
            if col is None:
                continue
            u = x - x0
            if u < 0:
                bangs.set(x, y, col)
            else:
                off = fringe[u] if u < len(fringe) else -4
                if y < hy - 2 + off:
                    bangs.set(x, y, col)
    # texture : anneau de lumière (reflet d'anime), mèches sombres vers les pointes de la frange
    bx, by, brx, bry = hx - 0.6, hy - 1.4, 8.2, 7.8
    hairset = set(hair)
    for y in range(-PADX, H + PADX):
        for x in range(-PADX, W + PADX):
            if bangs.get(x, y) is None:
                continue
            dx, dy = (x + 0.5 - bx) / brx, (y + 0.5 - by) / bry
            d = math.hypot(dx, dy)
            if 0.5 < d < 0.66 and dy < -0.15 and dx < 0.45:
                bangs.set(x, y, hair[4] if dx < 0 else hair[3])
    for u in range(1, min(len(fringe), 12) - 1):
        if fringe[u] < fringe[u - 1] and fringe[u] <= fringe[u + 1] and u > 2:
            continue
        if fringe[u] > fringe[u - 1] and fringe[u] >= fringe[u + 1] and u > 2:
            tx, ty = int(x0 + u), int(hy - 2 + fringe[u] - 1)
            for k in range(1, 4):
                if bangs.get(tx - k // 2, ty - k) in hairset:
                    bangs.set(tx - k // 2, ty - k, hair[1])
    for k in range(6):
        for sx in (hx - 4, hx - 7):
            xx, yy = int(sx - k * 0.5), int(hy - 3 + k)
            if bangs.get(xx, yy) in hairset:
                bangs.set(xx, yy, hair[1])
    stamp(c, bangs)
    # ombre portée de la frange sur le front
    for y in range(H - 1, 0 - PADX, -1):
        for x in range(-PADX, W + PADX):
            if c.get(x, y) == skin[2] and c.get(x, y - 1) == OUT and bangs.get(x, y - 2) is not None:
                c.set(x, y, skin[1])
    # yeux, sourcils, bouche, joues
    ex0, ex1, ey = int(hx + 1), int(hx + 5), int(hy)
    eye(c, ex0, ey, iris)
    eye(c, ex1, ey, iris, far=True)
    if brows == 'angry':
        c.set(ex0, ey - 2, OUT); c.set(ex0 + 1, ey - 1, OUT)
        c.set(ex1 + 1, ey - 2, OUT); c.set(ex1, ey - 1, OUT)
    mx, my = int(hx + 4), int(hy + 5)
    if mouth == 'smile':
        c.set(mx, my, MOUTH); c.set(mx + 1, my, MOUTH)
    elif mouth == 'small':
        c.set(mx + 1, my, MOUTH)
    elif mouth == 'smirk':
        c.set(mx, my, MOUTH); c.set(mx + 1, my, MOUTH); c.set(mx + 2, my - 1, MOUTH)
    elif mouth == 'open':
        c.set(mx, my, OUT); c.set(mx + 1, my, OUT)
        c.set(mx, my + 1, MOUTH); c.set(mx + 1, my + 1, '#e0506a')
    elif mouth == 'fang':
        c.set(mx, my, MOUTH); c.set(mx + 1, my, MOUTH); c.set(mx + 2, my - 1, MOUTH)
        c.set(mx + 1, my + 1, WHITE)
    if blush:
        c.set(ex0 - 1, ey + 4, blush); c.set(ex0, ey + 4, blush)
        c.set(ex1 + 1, ey + 4, blush); c.set(ex1 + 2, ey + 4, blush)


# ---------------------------------------------------------------- corps

STANCE = {0: (0, 0), 1: (0, 0), 2: (-2, 3)}


def legs(c, f, R3, BOOT, hip_y=36, far_dark=None):
    """Deux jambes + bottes arrondies vers l'avant (la jambe arrière est plus sombre)."""
    bdx, fdx = STANCE[f]
    for hip_x, foot_x, far in ((17.5, 17 + bdx, True), (23.5, 23 + fdx, False)):
        p = new()
        rr = (far_dark or [R3[0], R3[0], R3[1]]) if far else R3
        limb(p, [(hip_x, hip_y), (foot_x + 0.5, 43)], 3.6, rr)
        fx = foot_x
        bt = BOOT if not far else [BOOT[0], BOOT[0], BOOT[1], BOOT[1], BOOT[2]]
        ball(p, fx + 1.0, 44.6, 3.2, 2.6, bt)
        for x in range(fx - 2, fx + 5):
            for y in (46, 47):
                if p.get(x, y) is not None or (x <= fx + 3 and y == 47 and x >= fx - 1):
                    p.set(x, y, bt[1] if y == 46 else bt[0])
        p.set(fx - 1, 43, bt[3]); p.set(fx, 43, bt[4] if not far else bt[3])
        stamp(c, p)


def arm(c, shoulder, elbow, hand, R3, hand_cols, cuff=None, far=False, hand_r=2.0):
    p = new()
    rr = [R3[0], R3[0], R3[1]] if far else R3
    limb(p, [shoulder, elbow, hand], 3.4, rr)
    if cuff:
        mx = hand[0] + (elbow[0] - hand[0]) * 0.45
        my = hand[1] + (elbow[1] - hand[1]) * 0.45
        p.ellipse(mx, my, 1.6, 1.6, cuff[0] if far else cuff[1])
    p.shaded_ellipse(hand[0] + 0.5, hand[1] + 0.5, hand_r, hand_r * 0.95, hand_cols[:3] if far else hand_cols)
    stamp(c, p)


def elbow_of(s, h, bend=1.5):
    ex = (s[0] + h[0]) / 2 + (bend if h[1] > s[1] else bend * 0.6)
    ey = (s[1] + h[1]) / 2 + (bend if h[1] < s[1] else bend * 0.6)
    if h[1] >= s[1] + 4 and h[0] - s[0] < 7:
        ex, ey = s[0] + 0.5, h[1] - 1.5
    return (round(ex), round(ey))


# ---------------------------------------------------------------- armes

def blade(c, hand, a, length, width, edge, core, dark, start=2.0, tip_len=4.0):
    """Lame droite le long de a : bord éclairé (haut-gauche), âme, bord ombré."""
    p0 = along(hand, a, start)
    p1 = along(hand, a, start + length - tip_len)
    tip = along(hand, a, start + length)
    nx, ny = perp(a)
    hw = width / 2
    pts = [(p0[0] + nx * hw, p0[1] + ny * hw), (p1[0] + nx * hw, p1[1] + ny * hw), tip,
           (p1[0] - nx * hw, p1[1] - ny * hw), (p0[0] - nx * hw, p0[1] - ny * hw)]
    m = mask_of(lambda t: t.poly(pts, '#000'))
    # côté éclairé : celui dont la normale pointe vers la lumière
    lit = 1 if (nx * LIGHT[0] + ny * LIGHT[1]) > 0 else -1
    for (x, y) in m:
        # distance signée à l'axe
        d = ((x + 0.5 - p0[0]) * nx + (y + 0.5 - p0[1]) * ny) * lit
        c.set(x, y, edge if d > hw * 0.35 else dark if d < -hw * 0.35 else core)
    return m


def grip(c, hand, a, back, fwd, col, guard=None, glen=3.5, guard_at=1.4, pommel=None):
    g0 = along(hand, a, -back)
    g1 = along(hand, a, fwd)
    c.line(g0[0], g0[1], g1[0], g1[1], col, width=2)
    if guard:
        gc = along(hand, a, guard_at)
        nx, ny = perp(a)
        c.line(gc[0] - nx * glen, gc[1] - ny * glen, gc[0] + nx * glen, gc[1] + ny * glen, guard[1], width=2)
        c.set(gc[0] - nx * glen, gc[1] - ny * glen, guard[2])
        c.set(gc[0], gc[1], guard[2])
    if pommel:
        pp = along(hand, a, -back - 0.8)
        c.shaded_ellipse(pp[0] + 0.5, pp[1] + 0.5, 1.5, 1.5, pommel)


def trail(c, cx, cy, r0, r1, a0, a1, cols, step=2):
    """Arc de traînée (attaque) : anneau partiel, plus clair vers l'intérieur."""
    for y in range(int(cy - r1 - 1), int(cy + r1 + 2)):
        for x in range(int(cx - r1 - 1), int(cx + r1 + 2)):
            dx, dy = x + 0.5 - cx, y + 0.5 - cy
            r = math.hypot(dx, dy)
            if not (r0 <= r <= r1):
                continue
            a = math.degrees(math.atan2(dy, dx))
            if not (a0 <= a <= a1):
                continue
            t = (r - r0) / max(0.01, r1 - r0)
            u = (a - a0) / max(0.01, a1 - a0)
            idx = min(len(cols) - 1, int((1 - abs(t - 0.6)) * u * len(cols) * 1.3))
            if idx >= 0 and (u > 0.25 or (x + y) % 2 == 0) and c.get(x, y) is None:
                c.set(x, y, cols[idx])


# ---------------------------------------------------------------- poses

def pose(f):
    """Décalages communs : (ox, oy) buste, (hx, hy) tête."""
    if f == 0:
        return 0, 0, 0, 0
    if f == 1:
        return 0, 1, 0, 1
    return 1, 0, 2, 0


# ================================================================ 1. archange

A_HAIR = ['#a0641a', '#e4ac30', '#fde060', '#fff4a8', '#fffce8']
A_IRIS = ['#1a3a9a', '#2f7cf6', '#8fe0ff']
A_WING = ['#3a58b8', '#7aa4ee', '#c4dcff', '#eef6ff', '#ffffff']
A_GLOW = ['#ffffff', '#8fe0ff']
A_HALO = ['#fff8c0', '#ffd84a']


def rot(pt, o, deg):
    r = math.radians(deg)
    dx, dy = pt[0] - o[0], pt[1] - o[1]
    return (o[0] + dx * math.cos(r) - dy * math.sin(r), o[1] + dx * math.sin(r) + dy * math.cos(r))


# Aile (repère : racine à l'épaule (16, 24)) : bord d'attaque, plumes (base a, base b, pointe)
WING_ARM = [(16, 24), (13, 17), (10, 11), (7, 6), (4, 3.5), (1.5, 4.5)]
WING_FEATHERS = [((1.5, 4.5), (5, 4.5), (-0.5, 12)),
                 ((3.5, 5), (7, 7), (-0.5, 18)),
                 ((5.5, 7), (9, 10.5), (0.5, 24)),
                 ((7.5, 10), (11, 14), (2.5, 29)),
                 ((9.5, 13), (13, 18), (6.5, 33)),
                 ((12, 17), (15.5, 23), (11, 35))]
WING_ROOT = (16, 24)


def feather_poly(c, base_a, base_b, tip, R, tipcol, sep):
    mid = ((base_a[0] + base_b[0]) / 2, (base_a[1] + base_b[1]) / 2)
    ln = math.hypot(tip[0] - mid[0], tip[1] - mid[1]) or 1
    ux, uy = (tip[0] - mid[0]) / ln, (tip[1] - mid[1]) / ln
    # léger renflement côté intérieur (bas-droite) pour une plume arrondie
    bulge = (base_b[0] + (tip[0] - base_b[0]) * 0.6 + 1.0, base_b[1] + (tip[1] - base_b[1]) * 0.6)
    pts = [base_a, base_b, bulge, tip]
    m = mask_of(lambda t: t.poly(pts, '#000'))
    p = new()
    for (x, y) in m:
        t = ((x + 0.5 - mid[0]) * ux + (y + 0.5 - mid[1]) * uy) / ln
        if t > 0.8:
            col = tipcol[0] if (x - 1, y) not in m else tipcol[1]
        elif (x - 1, y) not in m or (x, y - 1) not in m:
            col = R[4]
        elif (x + 1, y) not in m:
            col = R[1]
        else:
            col = R[3] if t < 0.45 else R[2]
        p.set(x, y, col)
    stamp(c, p, sep)


def feather_wing(c, dx, dy, deg, far=False):
    """Aile d'ange : longues rémiges festonnées (pointes bleues) sous un bord d'attaque blanc."""
    R = A_WING if not far else [A_WING[0], A_WING[0], A_WING[1], A_WING[2], A_WING[2]]
    tipcol = [A_WING[1], A_WING[0]] if not far else [A_WING[0], A_WING[0]]
    T = lambda pt: rot((pt[0] + dx, pt[1] + dy), (WING_ROOT[0] + dx, WING_ROOT[1] + dy), deg)
    w = new()
    for (ba, bb, tp) in WING_FEATHERS:
        feather_poly(w, T(ba), T(bb), T(tp), R, tipcol, R[1] if not far else R[0])
    # couvertures : bourrelet blanc le long du bord d'attaque, festonné en dessous
    cov = new()
    arm = [T(p) for p in WING_ARM]
    for (x0, y0), (x1, y1) in zip(arm, arm[1:]):
        cov.line(x0, y0, x1, y1, R[3], width=3.6)
    for i, (x, y) in enumerate(arm[1:-1]):
        cov.ellipse(x + 1.2, y + 2.2, 2.0, 1.8, R[3])
    for (x0, y0), (x1, y1) in zip(arm, arm[1:]):
        cov.line(x0 - 0.6, y0 - 0.8, x1 - 0.6, y1 - 0.8, R[4])
    stamp(w, cov, R[2] if not far else R[1])
    stamp(c, w)


def archangel(f):
    ox, oy, hx_, hy_ = pose(f)
    c = new()
    hx, hy = HX + hx_, HY + hy_
    # aura arrière
    aura(c, [[(3, 6, True), (44, 12, False), (2, 30, False), (40, 4, True)],
             [(4, 9, False), (43, 8, True), (1, 26, True), (38, 2, False)],
             [(2, 4, True), (45, 18, True), (0, 33, False), (30, 2, False)]][f], A_GLOW)
    # ailes (lointaine puis proche)
    fl = [0, 9, -6][f]
    feather_wing(c, 6 + ox, -2 + oy, fl * 0.7 + 8, far=True)
    feather_wing(c, ox, oy, fl)
    # bras arrière + bouclier
    arm(c, (16 + ox, 27 + oy), (13 + ox, 31 + oy), (12 + ox, 34 + oy), A_WING[1:4], SKIN, far=True)
    sh = new()
    sx, sy = 10 + ox + (1 if f == 2 else 0), 31 + oy
    spoly(sh, [(sx - 4, sy - 5), (sx + 4, sy - 5), (sx + 4.5, sy + 1), (sx, sy + 7), (sx - 4.5, sy + 1)], GOLD)
    spoly(sh, [(sx - 2.5, sy - 3.5), (sx + 2.5, sy - 3.5), (sx + 3, sy + 1), (sx, sy + 5), (sx - 3, sy + 1)], BLUE, contrast=0.5)
    for k in range(-2, 4):
        sh.set(sx, sy + k, GOLD[3])
    for k in range(-2, 3):
        sh.set(sx + k, sy - 1, GOLD[3])
    sh.set(sx, sy - 1, WHITE)
    stamp(c, sh)
    # jambes : bottes dorées, jambières bleues
    legs(c, f, BLUE[1:4], GOLD)
    # jupe bleue à liseré d'or + tassettes dorées
    t = new()
    spoly(t, [(14 + ox, 31 + oy), (28 + ox, 31 + oy), (31 + ox, 40), (11 + ox, 40)], BLUE)
    for x in range(10, 33):
        t.setf(x + ox, 39, GOLD[2]); t.setf(x + ox, 40, GOLD[1])
    spoly(t, [(18 + ox, 32 + oy), (24 + ox, 32 + oy), (24.5 + ox, 39), (21 + ox, 41), (17.5 + ox, 39)], A_WING, only_inside=False, contrast=0.4)
    for y in range(33 + oy, 40):
        t.setf(18 + ox, y, GOLD[2]); t.setf(24 + ox, y, GOLD[1])
    t.setf(21 + ox, 36, GOLD[3]); t.setf(21 + ox, 35, GOLD[2]); t.setf(21 + ox, 37, GOLD[2])
    stamp(c, t)
    # cuirasse dorée bombée, ceinture bleue à gemme
    t = new()
    spoly(t, [(15 + ox, 24 + oy), (27 + ox, 24 + oy), (26.5 + ox, 29 + oy), (25 + ox, 33 + oy), (17 + ox, 33 + oy), (15.5 + ox, 29 + oy)],
          GOLD, contrast=0.5)
    for y in range(25, 32):
        t.setf(21 + ox, y + oy, GOLD[3]); t.setf(22 + ox, y + oy, GOLD[1])
    for x in range(14, 29):
        t.setf(x + ox, 32 + oy, BLUE[1]); t.setf(x + ox, 33 + oy, BLUE[0])
    t.set(21 + ox, 32 + oy, '#8fe0ff'); t.set(22 + ox, 32 + oy, '#2f7cf6')
    # motif d'aile sur le plastron
    for (x, y) in ((19, 27), (20, 28), (21, 28), (22, 28), (23, 27), (18, 26), (24, 26)):
        t.setf(x + ox, y + oy, GOLD[4])
    t.setf(21 + ox, 29 + oy, BLUE[2])
    stamp(c, t)
    # tête, cheveux dorés, auréole
    lock(c, [(hx - 7, hy - 2), (hx - 9, hy + 3), (hx - 8.5 - f % 2, hy + 8)], [3.0, 2.6, 1.0], A_HAIR)
    head(c, hx, hy, A_HAIR, A_IRIS, mouth='open' if f == 2 else 'smile', brows='calm')
    halo = new()
    hcx, hcy = hx - 1.0, hy - 12.2 - (1 if f == 1 else 0)
    for y in range(int(hcy - 4), int(hcy + 4)):
        for x in range(int(hcx - 9), int(hcx + 9)):
            d = ((x + 0.5 - hcx) / 6.4) ** 2 + ((y + 0.5 - hcy) / 2.3) ** 2
            if 0.3 <= d <= 1.0:
                halo.set(x, y, A_HALO[0] if y + 0.5 < hcy - 0.5 else A_HALO[1] if x + 0.5 < hcx + 3 else GOLD[2])
    stamp(c, halo, GOLD[1])
    # épée de lumière + bras avant
    if f == 2:
        hand, a = (31 + ox, 29), -15
    else:
        hand, a = (33 + ox, 34 + oy), -84
    w = new()
    blen = 12 if f == 2 else 17
    blade(w, hand, a, blen, 3.2, '#d4f6ff', WHITE, '#4fb0ff', start=2.4)
    grip(w, hand, a, 2.5, 1.0, BLUE[1], guard=GOLD, glen=3.2, guard_at=1.6, pommel=GOLD[1:4])
    stamp(c, w)
    s = (27 + ox, 28 + oy)
    arm(c, s, elbow_of(s, hand), hand, A_WING[1:4], SKIN, cuff=(GOLD[1], GOLD[2]))
    # épaulière avant dorée à plume
    t = new()
    ball(t, 26.5 + ox, 26.5 + oy, 3.7, 3.2, GOLD)
    for x in range(23, 31):
        t.setf(x + ox, 29 + oy, BLUE[2]); t.setf(x + ox, 30 + oy, BLUE[1])
    t.setf(26 + ox, 24 + oy, GOLD[4]); t.setf(25 + ox, 25 + oy, GOLD[4])
    stamp(c, t)
    # éclat de la lame
    tipp = along(hand, a, blen + 2.4)
    if f == 2:
        trail(c, hand[0], hand[1], 10, 14, -84, -24, ['#1c46c8', '#2f7cf6', '#4fb0ff', '#8fe0ff', '#d4f6ff'])
        sparkle(c, tipp[0] + 1, tipp[1], A_GLOW, True)
    else:
        sparkle(c, tipp[0] + (2 if f else -2), tipp[1] + 3, A_GLOW, f == 1)
    return c


# ================================================================ 2. reine démone

D_HAIR = ['#5a0a1e', '#a0182a', '#e0383a', '#ff7a5a', '#ffc0a0']
D_IRIS = ['#5a0a1e', '#e0383a', '#ffd04a']
D_ARMOR = ['#24081a', '#4a0e22', '#7a1a2e', '#b02c38', '#e86a5a']
D_HORN = ['#120a1c', '#2a1a3a', '#4a3060', '#7a5a8e', '#b49ac8']
D_WING = ['#1e0820', '#3e0e34', '#6a1846', '#9a2a52', '#d04a5a']
D_BONE = ['#1e0a1a', '#3e1028']
FIRE = ['#7a1408', '#d23a0e', '#ff7a14', '#ffbe32', '#fff09a']
D_GLOW = ['#fff09a', '#ff7a14']


def bat_wing(c, shoulder, wrist, tips, body_pt, R, bone, far=False):
    p = new()
    pts = [shoulder, wrist]
    for i, t in enumerate(tips):
        pts.append(t)
        nxt = tips[i + 1] if i + 1 < len(tips) else body_pt
        mx, my = (t[0] + nxt[0]) / 2, (t[1] + nxt[1]) / 2
        pts.append((mx + (wrist[0] - mx) * 0.3, my + (wrist[1] - my) * 0.3))
    pts.append(body_pt)
    Rr = [R[0], R[0], R[1], R[2], R[3]] if far else R
    spoly(p, pts, Rr, bias=0.05, contrast=0.4)
    p.line(shoulder[0], shoulder[1], wrist[0], wrist[1], bone[1], width=2)
    for t in tips:
        p.line(wrist[0], wrist[1], t[0], t[1], bone[1])
    # griffe au poignet
    p.set(wrist[0], wrist[1] - 1, D_HORN[3]); p.set(wrist[0], wrist[1] - 2, D_HORN[4])
    stamp(c, p)


def horn(c, base, pts, R, w0=2.4):
    p = new()

    def sh(t, s, x, y):
        if t > 0.82:
            return R[4]
        if s < -0.4:
            return R[3]
        if s > 0.4:
            return R[0]
        return R[2] if (int(t * 10) % 3) else R[1]
    spine_fill(p, [base] + pts, [w0, w0 * 0.85, w0 * 0.6, 0.6][:len(pts) + 1] if len(pts) == 3 else
               [w0] + [w0 * (1 - (i + 1) / len(pts)) + 0.4 for i in range(len(pts))], sh)
    stamp(c, p)


def flame(c, bx, base, wd, hgt, bend, seed):
    """Petite flamme dressée (pointe ondulée), cœur clair."""
    pts = [(bx - wd, base), (bx - wd * 0.6, base - hgt * 0.5), (bx + bend, base - hgt),
           (bx + wd * 0.7, base - hgt * 0.45), (bx + wd, base)]
    m = mask_of(lambda t: t.poly(pts, '#000'))
    for (x, y) in m:
        k = (base - y) / max(1, hgt)
        dx = abs(x + 0.5 - bx) / max(1, wd)
        v = 1 - k * 0.8 - dx * 0.5 + (0.12 if (x + y + seed) % 3 == 0 else 0)
        c.set(x, y, FIRE[max(1, min(4, int(v * 5)))])


def demon_queen(f):
    ox, oy, hx_, hy_ = pose(f)
    c = new()
    hx, hy = HX + hx_, HY + hy_
    aura(c, [[(3, 34, False), (42, 6, True), (6, 4, False), (45, 30, False)],
             [(2, 31, True), (44, 4, False), (8, 2, True), (46, 26, False)],
             [(4, 36, False), (46, 10, False), (5, 2, True), (40, 40, True)]][f], D_GLOW)
    fl = [0, -3, 3][f]
    # ailes de chauve-souris
    bat_wing(c, (18 + ox, 25 + oy), (11 + ox, 9 + oy + fl), [(5, 6 + fl), (1, 14 + fl // 2), (3, 22)],
             (14 + ox, 30 + oy), D_WING, D_BONE, far=True)
    bat_wing(c, (16 + ox, 26 + oy), (6 + ox, 13 + oy + fl), [(0, 9 + fl), (-1, 19 + fl // 2), (2, 27), (8, 32)],
             (14 + ox, 32 + oy), D_WING, D_BONE)
    # longue chevelure rouge derrière
    sway = [0, 1, -1][f]
    lock(c, [(hx - 5, hy - 4), (hx - 10, hy + 2), (hx - 11 + sway, hy + 10), (hx - 9 + sway, hy + 17), (hx - 11 + sway * 2, hy + 22)],
         [4.2, 4.6, 4.2, 3.2, 1.0], D_HAIR)
    # bras arrière (gantelet sombre)
    arm(c, (16 + ox, 27 + oy), (13 + ox, 31 + oy), (13 + ox, 34 + oy), D_ARMOR[1:4], D_ARMOR[1:5], far=True)
    legs(c, f, D_ARMOR[1:4], D_ARMOR)
    # jupe à pans pointus, armure rouge sombre
    t = new()
    spoly(t, [(14 + ox, 31 + oy), (28 + ox, 31 + oy), (32 + ox, 41), (28 + ox, 39), (25 + ox, 42), (21 + ox, 39),
              (17 + ox, 42), (14 + ox, 39), (10 + ox, 41)], D_ARMOR, contrast=0.45)
    for x in range(12, 31):
        t.setf(x + ox, 33 + oy, GOLD[1])
    stamp(c, t)
    t = new()
    ball(t, 21 + ox, 28 + oy, 6.4, 5.4, D_ARMOR)
    # plastron en V doré + gemme de feu
    for k in range(5):
        t.setf(17 + k + ox, 25 + k + oy, GOLD[2]); t.setf(25 - k + ox, 25 + k + oy, GOLD[1])
    t.setf(21 + ox, 29 + oy, FIRE[3]); t.setf(21 + ox, 30 + oy, FIRE[2]); t.setf(20 + ox, 29 + oy, FIRE[4])
    for x in range(14, 29):
        t.setf(x + ox, 32 + oy, D_ARMOR[0])
    stamp(c, t)
    # cornes (lointaine, puis proche)
    horn(c, (hx - 2, hy - 6), [(hx - 3, hy - 10), (hx - 7, hy - 12.5), (hx - 9, hy - 16)], D_HORN, 2.0)
    head(c, hx, hy, D_HAIR, D_IRIS, mouth='open' if f == 2 else 'fang', brows='angry',
         fringe=[8, 6, 2, 0, 2, 1, -1, 0, 1, -1, -2, -3])
    horn(c, (hx + 2, hy - 6), [(hx + 2, hy - 10), (hx - 1, hy - 13), (hx - 2, hy - 17)], D_HORN, 2.4)
    # hallebarde de feu
    if f == 2:
        hand, a = (29 + ox, 30), -5
    else:
        hand, a = (33 + ox, 34 + oy), -88
    w = new()
    p0 = along(hand, a, -11 if f != 2 else -9)
    du = -2.5 if f == 2 else 0
    p1 = along(hand, a, 18 + du)
    w.line(p0[0], p0[1], p1[0], p1[1], '#3a1a2a', width=2)
    nx, ny = perp(a)
    for k in range(-10, 18, 4):
        q = along(hand, a, k)
        w.set(q[0] - nx * 0.5, q[1] - ny * 0.5, '#6a3a4a')
    # fer de hache : croissant vers l'avant
    hb = along(hand, a, 13)
    side = -1  # perpendiculaire « avant » (pointe vers la droite quand l'arme est verticale)
    if nx * side < 0:
        side = 1
    fwd = (nx * side, ny * side)
    ux, uy = math.cos(math.radians(a)), math.sin(math.radians(a))

    def P(u, v):
        return (hand[0] + ux * u + fwd[0] * v, hand[1] + uy * u + fwd[1] * v)
    # fer en croissant : douille contre la hampe, tranchant convexe vers l'avant
    AXE = ['#2a1a30', '#4a3a58', '#7a6a8e', '#b4a8c8', '#ece4f6']
    pts = [P(u + du, v) for (u, v) in ((10, 0.5), (8.5, 3.5), (6, 7), (8.5, 8.6), (12.5, 9.2), (16.5, 8.6), (19, 7), (16.5, 3.5), (15, 0.5))]
    m = mask_of(lambda t: t.poly(pts, '#000'))
    for (x, y) in m:
        # v : distance vers l'avant
        v = (x + 0.5 - hand[0]) * fwd[0] + (y + 0.5 - hand[1]) * fwd[1]
        u = (x + 0.5 - hand[0]) * ux + (y + 0.5 - hand[1]) * uy - du
        if v > 7.4:
            col = FIRE[3] if u > 12.5 else FIRE[2]
        elif v > 6.4:
            col = AXE[4] if u > 12 else AXE[3]
        else:
            col = AXE[2] if u > 12.5 else AXE[1]
        w.set(x, y, col)
    for k in (11.5, 13.5):
        q = P(k + du, 3.5)
        w.set(q[0], q[1], AXE[0])
    q = P(12.5 + du, 3.5)
    w.set(q[0], q[1], FIRE[2])
    hb = P(12.5 + du, 0)
    # pique supérieure et ergot arrière
    tip = along(hand, a, 22 + du * 1.4)
    spoly(w, [(p1[0] - nx * 1.2, p1[1] - ny * 1.2), tip, (p1[0] + nx * 1.2, p1[1] + ny * 1.2)],
          ['#3a2a40', '#6a5a78', '#a49ab4', '#dcd4e8'])
    w.set(hb[0], hb[1], FIRE[3])
    stamp(c, w)
    # flammes sur le fer
    fl_c = new()
    edge = (hb[0] + fwd[0] * 8.5, hb[1] + fwd[1] * 8.5)
    if f == 2:
        for i, (dx, dy, wd, hg) in enumerate(((0, 0, 2.2, 6), (3, -3, 1.8, 5), (-3, 4, 2.0, 5), (4, 3, 1.6, 4))):
            flame(fl_c, edge[0] + dx, edge[1] + dy, wd, hg, -1.2, i)
    else:
        for i, (dx, dy, wd, hg) in enumerate(((1, -2, 1.8, 6 + f), (2, 3, 1.6, 4), (-1, -5, 1.4, 4 - f))):
            flame(fl_c, edge[0] + dx, edge[1] + dy, wd, hg, (-1) ** (i + f), i + f)
    stamp(c, fl_c, FIRE[0])
    s = (27 + ox, 28 + oy)
    arm(c, s, elbow_of(s, hand), hand, D_ARMOR[1:4], D_ARMOR[1:5], cuff=(GOLD[1], GOLD[2]))
    # épaulière à pointe
    t = new()
    ball(t, 27 + ox, 26.5 + oy, 4.2, 3.6, D_ARMOR)
    spoly(t, [(27 + ox, 24 + oy), (32 + ox, 21 + oy), (30 + ox, 26 + oy)], D_HORN)
    for x in range(23, 32):
        t.setf(x + ox, 29 + oy, GOLD[1])
    stamp(c, t)
    if f == 2:
        trail(c, hand[0], hand[1], 15, 19, -78, -8, FIRE)
    for (x, y) in [((3, 40), (40, 20)), ((4, 37), (42, 17)), ((44, 44), (38, 42))][f]:
        c.set(x, y, FIRE[3]); c.set(x, y - 1, FIRE[2])
    return c


# ================================================================ 3. impératrice des glaces

I_HAIR = ['#5a6a9e', '#98a8d0', '#cad6ee', '#eef3fc', '#ffffff']
I_IRIS = ['#1a3a8a', '#3ac8ff', '#c4f6ff']
ICE = ['#2a4a9a', '#5a9ae0', '#a8dcff', '#e4f8ff', '#ffffff']
GOWN = ['#14286a', '#2448a8', '#3a7ad8', '#7ab4f4', '#c8e8ff']
GOWN_W = ['#7a90c8', '#b8c8ea', '#e4ecfa', '#f6faff', '#ffffff']
SILVER = ['#3a4462', '#6a789e', '#a8b6d4', '#e2eaf6']
I_GLOW = ['#ffffff', '#a8f0ff']


def crystal(c, x, base, h, w, R=ICE, lean=0.0):
    spoly(c, [(x - w, base), (x - w * 0.6, base - h * 0.6), (x + lean, base - h), (x + w * 0.6, base - h * 0.6), (x + w, base)],
          R, contrast=0.55)
    c.set(x + lean - 0.3, base - h + 1, R[4])


def snowflake(c, x, y, col='#e4f8ff', core=WHITE):
    c.set(x, y, core)
    for dx, dy in ((1, 1), (-1, -1), (1, -1), (-1, 1)):
        c.set(x + dx, y + dy, col)


def ice_empress(f):
    ox, oy, hx_, hy_ = pose(f)
    c = new()
    hx, hy = HX + hx_, HY + hy_
    for (x, y) in [((4, 10), (42, 4), (3, 40), (45, 38)), ((5, 7), (43, 7), (2, 37), (44, 41)),
                   ((3, 12), (46, 6), (4, 42), (43, 44))][f]:
        snowflake(c, x, y)
    aura(c, [[(8, 22, False), (40, 26, True)], [(7, 25, True), (41, 23, False)], [(6, 20, False), (12, 4, True)]][f], I_GLOW)
    sway = [0, 1, -1][f]
    # longue chevelure argentée jusqu'aux reins
    lock(c, [(hx - 4, hy - 5), (hx - 10, hy), (hx - 11 + sway, hy + 9), (hx - 10 + sway, hy + 17), (hx - 12 + sway * 2, hy + 24)],
         [4.6, 5.2, 5.0, 4.0, 1.2], I_HAIR)
    lock(c, [(hx - 7, hy - 2), (hx - 8, hy + 8), (hx - 6 + sway, hy + 16), (hx - 7 + sway, hy + 21)], [3.4, 3.4, 2.6, 0.8], I_HAIR)
    # bras arrière (manche blanche bouffante)
    arm(c, (16 + ox, 27 + oy), (13 + ox, 31 + oy), (13 + ox, 34 + oy), GOWN_W[1:4], SKIN, far=True, cuff=(ICE[1], ICE[2]))
    # robe en cloche : bleu profond, tablier blanc, ourlet de glace
    t = new()
    skirt = [(16 + ox, 31 + oy), (26 + ox, 31 + oy), (30 + ox, 37), (34 + ox, 44), (33, 46), (9, 46), (8 + ox, 44), (12 + ox, 37)]
    spoly(t, skirt, GOWN, contrast=0.42)
    spoly(t, [(19 + ox, 32 + oy), (24 + ox, 32 + oy), (28 + ox, 45), (15 + ox, 45)], GOWN_W, only_inside=True, contrast=0.4)
    for x in range(8, 35):
        t.setf(x, 45, ICE[3] if x % 3 else WHITE); t.setf(x, 46, ICE[1])
    for x in range(10 + ox, 33 + ox, 4):  # plis
        t.setf(x, 41, GOWN[0]); t.setf(x, 42, GOWN[0]); t.setf(x, 43, GOWN[1])
    for (x, y) in ((21, 36), (22, 39), (21, 42)):  # flocons brodés
        t.setf(x + ox, y, ICE[2])
    stamp(c, t)
    # pointes de souliers
    t = new()
    for fx in (16 + STANCE[f][0], 25 + STANCE[f][1]):
        t.set(fx, 47, SILVER[2]); t.set(fx + 1, 47, SILVER[3]); t.set(fx + 2, 47, SILVER[1])
    stamp(c, t)
    c.set(33, 47, None)  # garder la base propre
    # corsage
    t = new()
    ball(t, 21 + ox, 28 + oy, 5.8, 5.0, GOWN)
    spoly(t, [(18 + ox, 24 + oy), (24 + ox, 24 + oy), (21 + ox, 32 + oy)], GOWN_W, only_inside=True)
    t.setf(21 + ox, 27 + oy, '#3ac8ff'); t.setf(21 + ox, 28 + oy, ICE[0]); t.setf(20 + ox, 27 + oy, WHITE)
    for x in range(15, 28):
        t.setf(x + ox, 32 + oy, SILVER[2])
    stamp(c, t)
    # col de fourrure / cristaux d'épaule
    t = new()
    for x, y in ((15, 25), (17, 23), (25, 23), (27, 25)):
        crystal(t, x + ox, y + 2 + oy, 4, 1.4)
    stamp(c, t)
    head(c, hx, hy, I_HAIR, I_IRIS, mouth='small' if f != 2 else 'open', brows='calm', blush='#f4a8c8')
    # mèche avant longue (devant l'oreille)
    lock(c, [(hx - 2, hy + 1), (hx - 2.5, hy + 6), (hx - 1.5, hy + 10)], [1.6, 1.8, 0.7], I_HAIR)
    # couronne de glace
    t = new()
    cy = hy - 6
    spoly(t, [(hx - 6, cy + 1), (hx + 5, cy - 1), (hx + 5, cy + 1), (hx - 6, cy + 3)], SILVER + [SILVER[3]])
    for (dx, h, w, lean) in ((-5, 4, 1.3, -0.5), (-2, 7, 1.6, -0.3), (1.5, 9, 1.8, 0.2), (4.5, 5, 1.3, 0.5)):
        crystal(t, hx + dx, cy + 1 - dx * 0.18, h, w, lean=lean)
    t.set(hx + 1, cy, '#3ac8ff')
    stamp(c, t)
    # bâton de cristal
    if f == 2:
        hand, a = (31 + ox, 28), -55
    else:
        hand, a = (33 + ox, 34 + oy), -88
    w = new()
    p0 = along(hand, a, -12 if f != 2 else -8)
    p1 = along(hand, a, 13)
    w.line(p0[0], p0[1], p1[0], p1[1], SILVER[1], width=2)
    nx, ny = perp(a)
    for k in range(-12, 13, 1):
        q = along(hand, a, k)
        w.set(q[0] + nx * 0.5, q[1] + ny * 0.5, SILVER[3] if k % 4 else SILVER[2])
    for k in (-6, 6):
        q = along(hand, a, k)
        w.set(q[0], q[1], ICE[2])
    # fourche + cristal flottant
    top = along(hand, a, 13)
    for sgn in (-1, 1):
        q = along(top, a + sgn * 40, 4)
        w.line(top[0], top[1], q[0], q[1], SILVER[2])
    stamp(c, w)
    t = new()
    cc = along(hand, a, [19, 20, 17][f])
    r = math.radians(a)
    ux, uy = math.cos(r), math.sin(r)
    gem = [(cc[0] - ux * 5, cc[1] - uy * 5), (cc[0] + nx * 2.6, cc[1] + ny * 2.6), (cc[0] + ux * 6, cc[1] + uy * 6), (cc[0] - nx * 2.6, cc[1] - ny * 2.6)]
    spoly(t, gem, ICE, contrast=0.6)
    t.set(cc[0] - 0.5, cc[1] - 0.5, WHITE)
    stamp(c, t, ICE[0])
    if f == 2:
        # salve de cristaux de glace vers l'avant
        b = new()
        for (dx, dy, h, wd) in ((5, 1, 4, 1.5), (2, 6, 4, 1.3), (-3, -7, 3, 1.2)):
            q = (cc[0] + dx, cc[1] + dy)
            spoly(b, [(q[0] - 3, q[1] - wd), (q[0] + h, q[1]), (q[0] - 3, q[1] + wd)], ICE, contrast=0.5)
        stamp(c, b, ICE[0])
        aura(c, [(cc[0] + 1, cc[1] - 5, True), (cc[0] - 4, cc[1] + 4, True)], I_GLOW)
    else:
        sparkle(c, cc[0] + 4, cc[1] - 3 + f * 2, I_GLOW, True)
    s = (27 + ox, 28 + oy)
    arm(c, s, elbow_of(s, hand), hand, GOWN_W[1:4], SKIN, cuff=(ICE[1], ICE[2]))
    # mancheron bouffant
    t = new()
    ball(t, 26.5 + ox, 26.5 + oy, 3.4, 3.0, GOWN_W)
    for x in range(23, 30):
        t.setf(x + ox, 28 + oy, ICE[2])
    stamp(c, t)
    return c


# ================================================================ 4. seigneur des ombres

S_ARM = ['#16122c', '#2e284c', '#4c4476', '#7870a8', '#b8b2e4']
S_CAPE = ['#12081e', '#24103a', '#3c1a5a', '#5a2a80']
VIO = ['#3a0a6a', '#7a2ad0', '#b85aff', '#e4b0ff', '#fff0ff']
S_GLOW = ['#fff0ff', '#b85aff']


def shadow_lord(f):
    ox, oy, hx_, hy_ = pose(f)
    c = new()
    hx, hy = HX + hx_, HY + hy_
    aura(c, [[(4, 14, True), (44, 36, False), (2, 40, False), (11, 3, False)],
             [(5, 11, False), (45, 33, True), (3, 37, True), (13, 2, False)],
             [(3, 16, False), (8, 4, True), (1, 36, True), (46, 42, False)]][f], S_GLOW)
    # volutes d'énergie au sol
    for (x, y) in [((8, 45), (33, 44), (6, 41)), ((9, 44), (34, 45), (5, 42)), ((6, 44), (37, 43), (4, 40))][f]:
        c.set(x, y, VIO[2]); c.set(x, y - 1, VIO[1])
    # cape en lambeaux
    sw = [0, -1, -3][f]
    t = new()
    cape = [(18 + ox, 23 + oy), (13 + ox, 25 + oy), (8 + ox + sw, 34), (5 + sw, 42), (7 + sw, 40), (8 + sw, 45),
            (11 + sw, 41), (13, 46), (15, 42), (17, 45), (19, 40), (21 + ox, 30 + oy)]
    spoly(t, cape, S_CAPE, contrast=0.45)
    for (x0, y0, x1, y1) in ((12, 28, 9 + sw, 40), (15, 29, 14, 42)):
        t.line(x0 + ox, y0 + oy, x1, y1, S_CAPE[0])
    t.line(13 + ox, 26 + oy, 7 + sw, 39, S_CAPE[3])
    stamp(c, t)
    # liseré violet de la cape
    for (x, y) in ((5 + sw, 42), (8 + sw, 45), (13, 46), (17, 45)):
        c.set(x, y - 1, VIO[1])
    arm(c, (16 + ox, 27 + oy), (13 + ox, 31 + oy), (13 + ox, 34 + oy), S_ARM[1:4], S_ARM[1:5], far=True)
    legs(c, f, S_ARM[1:4], S_ARM)
    # faltes + cuirasse noire, runes violettes
    t = new()
    spoly(t, [(14 + ox, 31 + oy), (28 + ox, 31 + oy), (31 + ox, 40), (11 + ox, 40)], S_ARM, contrast=0.4)
    for x in range(11, 32):
        t.setf(x + ox, 36, S_ARM[0]); t.setf(x + ox, 39, VIO[1])
    stamp(c, t)
    t = new()
    ball(t, 21 + ox, 28 + oy, 6.8, 5.8, S_ARM)
    for (x, y) in ((21, 26), (21, 27), (20, 28), (22, 28), (21, 29), (21, 30)):
        t.setf(x + ox, y + oy, VIO[2])
    t.setf(21 + ox, 28 + oy, VIO[4])
    for x in range(14, 29):
        t.setf(x + ox, 32 + oy, S_ARM[0]); t.setf(x + ox, 33 + oy, S_ARM[1])
    t.setf(21 + ox, 33 + oy, VIO[3])
    stamp(c, t)
    # panache en lambeaux, violet sombre, derrière le heaume
    pw = [0, 1, -1][f]

    def psh(t, sd, x, y):
        if sd < -0.5:
            return VIO[1] if t < 0.75 else S_CAPE[3]
        if sd > 0.45:
            return S_CAPE[0]
        if abs(sd - 0.2 * math.sin(t * 12)) < 0.16:
            return S_CAPE[3]
        return S_CAPE[2] if t < 0.6 else S_CAPE[1]
    p = new()
    spine_fill(p, [(hx - 1, hy - 7), (hx - 4, hy - 11.5), (hx - 10, hy - 12), (hx - 14, hy - 8 + pw),
                   (hx - 16 + pw, hy - 2 + pw), (hx - 15 + pw * 2, hy + 4)], [2.0, 3.0, 3.6, 3.4, 2.6, 0.8], psh)
    for k in range(4):  # effilochures
        p.set(hx - 18 + pw + k % 2, hy - 4 + k * 3 + pw, None)
    stamp(c, p)
    # gorgerin à liseré violet (sépare le heaume du buste)
    t = new()
    spoly(t, [(hx - 6, hy + 6), (hx + 6, hy + 6), (hx + 7, hy + 9), (hx - 6, hy + 9)], S_ARM)
    for x in range(int(hx - 6), int(hx + 8)):
        t.setf(x, hy + 8, VIO[1])
    stamp(c, t)
    HORN_S = [S_ARM[0], S_ARM[1], S_ARM[2], S_ARM[3], VIO[3]]
    horn(c, (hx - 3, hy - 5), [(hx - 6, hy - 10), (hx - 6, hy - 14), (hx - 3, hy - 17)], HORN_S, 2.2)
    # heaume fermé : calotte, masque facial avancé, crête
    t = new()
    ball(t, hx, hy, 8.4, 7.8, S_ARM)
    for y in range(int(hy - 8), int(hy + 2)):
        t.setf(hx - 1, y, S_ARM[3]); t.setf(hx, y, S_ARM[1])
    stamp(c, t)
    t = new()
    spoly(t, [(hx + 1, hy - 4), (hx + 7, hy - 4), (hx + 9.5, hy + 1), (hx + 8.5, hy + 6), (hx + 5, hy + 8.5), (hx + 1, hy + 7)],
          [S_ARM[1], S_ARM[2], S_ARM[3], S_ARM[3], S_ARM[4]], contrast=0.45)
    stamp(c, t)
    # fente en T lumineuse
    vy = int(hy)
    for x in range(int(hx + 2), int(hx + 10)):
        c.set(x, vy, OUT)
    for y in range(vy + 1, vy + 5):
        c.set(int(hx + 6), y, OUT)
    glow = VIO[4] if f != 1 else VIO[3]
    c.set(hx + 3, vy, glow); c.set(hx + 4, vy, VIO[3]); c.set(hx + 8, vy, glow); c.set(hx + 7, vy, VIO[2])
    c.set(hx + 6, vy + 2, VIO[1])
    for (x, y) in ((hx + 3, vy + 3), (hx + 3, vy + 5), (hx + 8, vy + 3)):
        c.set(x, y, S_ARM[0])
    if f == 2:  # traînée lumineuse des yeux
        for k in range(1, 4):
            c.set(hx + 3 - k, vy - (k > 1), VIO[2] if k < 3 else VIO[1])
    for (x, y) in ((hx - 5, hy - 5), (hx - 4, hy - 6), (hx - 6, hy - 4), (hx - 3, hy - 7)):
        c.setf(x, y, S_ARM[4])
    horn(c, (hx + 3, hy - 5), [(hx + 5, hy - 10), (hx + 4, hy - 14), (hx + 1, hy - 17)], HORN_S, 2.6)
    # espadon colossal
    if f == 2:
        hand, a = (31 + ox, 30), -40
    else:
        hand, a = (33 + ox, 34 + oy), -76
    w = new()
    blade(w, hand, a, 22 if f != 2 else 15, 5.0, '#c8c4ec', S_ARM[3], S_ARM[1], start=2.6, tip_len=5)
    # rune / fil d'énergie violette au centre
    for k in range(5, (22 if f != 2 else 15) - 2):
        q = along(hand, a, k)
        w.set(q[0], q[1], VIO[2] if k % 3 else VIO[3])
    grip(w, hand, a, 3.5, 1.0, S_CAPE[2], guard=[S_ARM[1], S_ARM[3], VIO[3]], glen=4.5, guard_at=2.0,
         pommel=[VIO[0], VIO[1], VIO[2]])
    stamp(c, w)
    # lueur violette le long du tranchant
    gl = new()
    nx, ny = perp(a)
    for k in range(6, (22 if f != 2 else 15), 3 if f != 1 else 2):
        q = along(hand, a, k + f)
        side = 3.4 if (k // 3) % 2 else -3.4
        gl.set(q[0] + nx * side, q[1] + ny * side, VIO[2] if k % 2 else VIO[3])
    for y in range(-PADX, H + PADX):
        for x in range(-PADX, W + PADX):
            if gl.get(x, y) and c.get(x, y) is None:
                c.set(x, y, gl.get(x, y))
    s = (27 + ox, 28 + oy)
    arm(c, s, elbow_of(s, hand), hand, S_ARM[1:4], S_ARM[1:5], cuff=(VIO[1], VIO[2]))
    # épaulière à pointes
    t = new()
    ball(t, 27 + ox, 26.5 + oy, 4.8, 4.0, S_ARM)
    spoly(t, [(27 + ox, 24 + oy), (33 + ox, 21 + oy), (31 + ox, 26 + oy)], S_ARM)
    spoly(t, [(29 + ox, 27 + oy), (34 + ox, 26 + oy), (31 + ox, 29 + oy)], S_ARM)
    for x in range(23, 33):
        t.setf(x + ox, 29 + oy, VIO[1])
    t.setf(26 + ox, 25 + oy, S_ARM[4])
    stamp(c, t)
    if f == 2:
        trail(c, hand[0], hand[1], 15, 19, -105, -48, VIO)
    return c


# ================================================================ 5. gardienne sylvestre

G_HAIR = ['#0e4a4a', '#16887a', '#2ec8a0', '#7cf0c4', '#d4fff0']
G_IRIS = ['#0f4a3a', '#1ea06a', '#a8ffb0']
LEAF = ['#123a20', '#1f6a2a', '#38a034', '#6ed04a', '#b4f080']
WOOD = ['#3e2214', '#6e3e1e', '#9e6230', '#c88e4a', '#ecc07a']
ANTLER = ['#4a2a1a', '#8a5a34', '#c49a62', '#f0d4a0']
ORB = ['#0f4a3a', '#1ea06a', '#5ee8a0', '#b8ffd0', '#ffffff']
FLOWER = ['#ff7ab4', '#ffd0e8', '#ffe24a']
G_GLOW = ['#f4ffd0', '#8ef07a']


def leaf(c, x, y, a, ln=4, R=LEAF):
    """Feuille pointue le long de l'angle a."""
    tip = along((x, y), a, ln)
    mid = along((x, y), a, ln * 0.45)
    nx, ny = perp(a)
    spoly(c, [(x, y), (mid[0] + nx * 1.6, mid[1] + ny * 1.6), tip, (mid[0] - nx * 1.6, mid[1] - ny * 1.6)], R, contrast=0.6)
    c.line(x, y, mid[0], mid[1], R[1])


def sylvan_guardian(f):
    ox, oy, hx_, hy_ = pose(f)
    c = new()
    hx, hy = HX + hx_, HY + hy_
    aura(c, [[(5, 8, True), (42, 6, False), (3, 32, False), (45, 30, True)],
             [(6, 5, False), (43, 9, True), (2, 29, True), (44, 33, False)],
             [(4, 10, False), (37, 4, True), (3, 35, True), (46, 40, False)]][f], G_GLOW)
    # feuilles flottantes
    fl = new()
    for (x, y, a) in [((8, 16, 200), (40, 40, 30), (2, 22, 120)), ((7, 18, 220), (41, 38, 10), (3, 19, 140)),
                      ((6, 14, 190), (44, 22, 330), (40, 44, 60))][f]:
        leaf(fl, x, y, a, 3)
    stamp(c, fl)
    sway = [0, 1, -1][f]
    # longue chevelure verte (derrière) avec lianes
    lock(c, [(hx - 4, hy - 5), (hx - 10, hy + 1), (hx - 10 + sway, hy + 9), (hx - 8 + sway, hy + 15), (hx - 10 + sway * 2, hy + 21)],
         [4.4, 4.8, 4.4, 3.2, 1.0], G_HAIR)
    t = new()
    for (x, y, a) in ((hx - 11 + sway, hy + 9, 200), (hx - 9 + sway, hy + 16, 160)):
        leaf(t, x, y, a, 3)
    stamp(c, t)
    # bras arrière
    arm(c, (16 + ox, 27 + oy), (13 + ox, 31 + oy), (13 + ox, 34 + oy), [SKIN[0], SKIN[1], SKIN[2]], SKIN, far=True,
        cuff=(LEAF[1], LEAF[2]))
    # jambes nues + sandales de lianes
    legs(c, f, [SKIN[1], SKIN[2], SKIN[3]], WOOD, far_dark=[SKIN[0], SKIN[1], SKIN[1]])
    for fx in (17 + STANCE[f][0], 23 + STANCE[f][1]):
        for y in (39, 41):
            c.setf(fx + (y - 39) // 2, y, LEAF[1])
            c.setf(fx + 1 + (y - 39) // 2, y, LEAF[2])
    # robe de feuilles : jupe en couches de feuilles pointues
    t = new()
    spoly(t, [(15 + ox, 30 + oy), (27 + ox, 30 + oy), (29 + ox, 36 + oy), (13 + ox, 36 + oy)], LEAF)
    stamp(c, t)
    t = new()
    for i, x in enumerate(range(12, 31, 3)):
        leaf(t, x + ox, 34 + oy, 90 + (x - 21) * 3, 6 + (i % 2), LEAF)
    stamp(c, t)
    t = new()
    for i, x in enumerate(range(14, 30, 3)):
        leaf(t, x + ox + 1, 31 + oy, 90 + (x - 21) * 3, 5, [LEAF[1], LEAF[2], LEAF[3], LEAF[4], LEAF[4]])
    stamp(c, t)
    # corsage de feuilles + ceinture de liane fleurie
    t = new()
    ball(t, 21 + ox, 27.5 + oy, 5.6, 4.8, LEAF)
    for k in range(-4, 5):
        t.setf(21 + k + ox, 26 + abs(k) // 2 + oy, LEAF[1])
    for x in range(15, 28):
        t.setf(x + ox, 31 + oy, WOOD[2] if x % 2 else WOOD[1])
    t.setf(24 + ox, 31 + oy, FLOWER[0]); t.setf(25 + ox, 30 + oy, FLOWER[0]); t.setf(25 + ox, 31 + oy, FLOWER[2])
    stamp(c, t)
    # bois de cerf (lointain puis proche)
    t = new()
    b0 = (hx - 4, hy - 6)
    t.line(b0[0], b0[1], b0[0] - 3, b0[1] - 5, ANTLER[1], width=2)
    t.line(b0[0] - 2, b0[1] - 3, b0[0], b0[1] - 7, ANTLER[1])
    t.line(b0[0] - 3, b0[1] - 5, b0[0] - 6, b0[1] - 7, ANTLER[1])
    stamp(c, t)
    head(c, hx, hy, G_HAIR, G_IRIS, mouth='open' if f == 2 else 'smile', brows='calm',
         fringe=[8, 7, 2, 0, 1, 3, 0, -1, 1, 0, -2, -3])
    t = new()
    b1 = (hx + 1, hy - 6)
    t.line(b1[0], b1[1], b1[0] - 1, b1[1] - 6, ANTLER[2], width=2)
    t.line(b1[0] - 1, b1[1] - 3, b1[0] + 2, b1[1] - 6, ANTLER[2])
    t.line(b1[0] - 1, b1[1] - 6, b1[0] - 4, b1[1] - 8, ANTLER[2])
    t.set(b1[0] - 1, b1[1] - 6, ANTLER[3]); t.set(b1[0] + 2, b1[1] - 6, ANTLER[3]); t.set(b1[0] - 4, b1[1] - 8, ANTLER[3])
    stamp(c, t)
    # couronne de feuilles et fleur dans les cheveux
    t = new()
    for (x, y, a) in ((hx - 6, hy - 5, 200), (hx - 3, hy - 7, 240), (hx + 4, hy - 6, 310)):
        leaf(t, x, y, a, 4)
    stamp(c, t)
    c.set(hx - 7, hy - 2, FLOWER[0]); c.set(hx - 6, hy - 2, FLOWER[1]); c.set(hx - 7, hy - 1, FLOWER[0]); c.set(hx - 8, hy - 2, FLOWER[0])
    c.set(hx - 7, hy - 3, FLOWER[0]); c.set(hx - 7, hy - 2, FLOWER[2])
    # bâton de bois noueux à orbe
    if f == 2:
        hand, a = (32 + ox, 29), -55
    else:
        hand, a = (33 + ox, 34 + oy), -86
    w = new()
    p0 = along(hand, a, -12 if f != 2 else -9)
    p1 = along(hand, a, 12)
    nx, ny = perp(a)
    pts = [p0]
    for k in range(-8, 13, 5):
        q = along(hand, a, k)
        pts.append((q[0] + nx * (0.6 if (k // 5) % 2 else -0.6), q[1] + ny * (0.6 if (k // 5) % 2 else -0.6)))
    pts.append(p1)
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        w.line(x0, y0, x1, y1, WOOD[2], width=2.2)
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        w.line(x0 - nx, y0 - ny, x1 - nx, y1 - ny, WOOD[1])
    top = along(hand, a, 16)
    # branches qui enserrent l'orbe
    for sgn in (-1, 1):
        q = along(p1, a + sgn * 50, 4)
        q2 = along(q, a - sgn * 30, 4)
        w.line(p1[0], p1[1], q[0], q[1], WOOD[2], width=1.6)
        w.line(q[0], q[1], q2[0], q2[1], WOOD[3])
    q = along(p1, a + 70, 3)
    leaf(w, q[0], q[1], a + 60, 4)
    stamp(c, w)
    o = new()
    rr = 3.0 + (0.4 if f == 2 else 0)
    o.shaded_ellipse(top[0] + 0.5, top[1] + 0.5, rr, rr, ORB[:4])
    o.set(top[0] - 1, top[1] - 1, WHITE)
    stamp(c, o, ORB[0])
    # halo de l'orbe
    for k in range(8):
        ang = k * 45 + f * 20
        q = along((top[0] + 0.5, top[1] + 0.5), ang, rr + 2.2 + (k % 2))
        if c.get(int(q[0]), int(q[1])) is None and (k + f) % 2 == 0:
            c.set(q[0], q[1], ORB[3] if k % 4 else ORB[2])
    s = (27 + ox, 28 + oy)
    arm(c, s, elbow_of(s, hand), hand, [SKIN[1], SKIN[2], SKIN[3]], SKIN, cuff=(LEAF[1], LEAF[3]))
    t = new()
    leaf(t, 25 + ox, 25 + oy, 10, 5)
    leaf(t, 26 + ox, 26 + oy, 60, 4)
    stamp(c, t)
    if f == 2:
        # rafale de magie végétale
        b = new()
        for (dx, dy, aa) in ((6, -2, -10), (9, 3, 20), (4, -7, -40)):
            leaf(b, top[0] + dx, top[1] + dy, aa, 4)
        stamp(c, b)
        aura(c, [(top[0] + 4, top[1] + 6, True), (top[0] - 2, top[1] - 5, True)], G_GLOW)
    return c


# ---------------------------------------------------------------- export

DRAW = {
    'archangel': archangel,
    'demon_queen': demon_queen,
    'ice_empress': ice_empress,
    'shadow_lord': shadow_lord,
    'sylvan_guardian': sylvan_guardian,
}


def build():
    out = {}
    for aid in ALLIES:
        fn = DRAW[aid]
        out[f'ally_{aid}'] = (fn(0).crop_logical(), {})  # recadré sans coupe dans allies_anim
        out[f'ally_{aid}_b'] = (fn(1).crop_logical(), {})
        out[f'ally_{aid}_atk'] = (fn(2).crop_logical(), {})
    return out
