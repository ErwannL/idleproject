"""Skins de héros (lot A) : Fée, Diablesse, Valkyrie, Roi Grombar.

Chaque skin est un personnage complet qui REMPLACE le corps du chevalier (aucun casque, armure,
cape ni écu n'est posé par-dessus) ; seule l'arme équipée est dessinée sur `hand`.

Contrat (build) : pour chaque id de SKINS,
  skin_<id>_<pose>  : 14 poses = les 12 de knight.POSES + 'aim' (arc bandé) et 'shoot' (flèche lâchée),
                      canvas 48 de large, pieds sur y=47, corps centré comme le chevalier (pied vers x≈20),
                      face à droite ; extra {'hand', 'rot', 'head', 'torso', 'oy'} — hand/rot identiques
                      au chevalier pour les 12 poses standard ; 'oy' (≤ 0) : le calque est plus haut que
                      48 px quand ailes / cornes / couronne dépassent, à remonter de -oy (comme helmet_default).
  skin_<id>_icon    : portrait 24×24 (tête et épaules) pour les menus.
Couleurs hexadécimales fixes uniquement (pas de calques teintables).
"""
import math

import knight
from knight import ball, limb, spine_fill
from allies_ssr import (new, stamp, spoly, mask_of, lock, head, sparkle, along, perp, rot, leaf,
                        OUT, WHITE, SKIN, MOUTH, GOLD, HX, HY, PADX)

W, H = 48, 48
GROUND = 47

SKINS = ('fairy', 'demoness', 'valkyrie', 'grombar')

# ---------------------------------------------------------------- poses

POSES = dict(knight.POSES)
#                 torse    tête     pied arr.  pied av.  main      rot  bras arrière
POSES['aim'] = ((0, 0), (0, 0), (-3, 0), (3, 0), (33, 29), 0, 'draw')
POSES['shoot'] = ((-1, 0), (-1, 0), (-3, 0), (3, 0), (32, 29), 0, 'release')
ORDER = list(knight.POSES) + ['aim', 'shoot']

# « vie » : phase (0..3, battement d'ailes / ondulation) et balancement (cheveux, queue, cape :
# < 0 traîne vers l'arrière, > 0 projeté vers l'avant)
LIFE = {
    'idle': (0, 0), 'idle2': (2, 1),
    'walk1': (1, -1), 'walk2': (2, -2), 'walk3': (3, -1), 'walk4': (0, -2),
    'attack1': (1, 1), 'attack2': (2, -2), 'attack3': (3, -3),
    'cast': (2, -1), 'hurt': (3, 2), 'victory': (0, 0),
    'aim': (1, 0), 'shoot': (2, -1),
}
EXPR = {'attack1': 'fierce', 'attack2': 'shout', 'attack3': 'shout', 'cast': 'shout', 'hurt': 'hurt',
        'victory': 'joy', 'aim': 'focus', 'shoot': 'fierce'}


class Pose:
    def __init__(self, name):
        (self.tx, self.ty), (hx, hy), (self.bdx, self.blift), (self.fdx, self.flift), hand, self.rot, self.back = POSES[name]
        self.name = name
        self.hdx, self.hdy = hx, hy
        self.hx, self.hy = HX + hx, HY + hy
        self.hand = hand
        self.ph, self.sw = LIFE[name]
        self.expr = EXPR.get(name, 'calm')

    def extra(self):
        return {'hand': {'x': self.hand[0], 'y': self.hand[1]}, 'rot': self.rot,
                'head': {'x': self.hdx, 'y': self.hdy}, 'torso': {'x': self.tx, 'y': self.ty}}


# bras arrière : (épaule, coude, main) ; 'forward' et 'draw' passent devant le buste
BACK_ARM = {
    'low': ((15, 27), (13, 31), (13, 34)),
    'back': ((15, 27), (11, 30), (9, 32)),
    'flail': ((15, 27), (11, 25), (9, 22)),
    'hip': ((15, 27), (11, 30), (14, 33)),
    'forward': ((19, 28), (25, 31), (30, 31)),
    'draw': ((16, 27), (11, 27), (20, 28)),
    'release': ((15, 27), (11, 26), (8, 24)),
}
FRONT_BACK = ('forward', 'draw')


def back_arm_pts(P, dy=0):
    s, e, h = BACK_ARM[P.back]
    o = lambda p: (p[0] + P.tx, p[1] + P.ty + dy)  # noqa: E731
    return o(s), o(e), o(h)


def front_arm_pts(P, sy=28):
    s = (27 + P.tx, sy + P.ty)
    hx_, hy_ = P.hand
    ex = (s[0] + hx_) / 2 + (1.5 if hy_ > s[1] else 1)
    ey = (s[1] + hy_) / 2 + (1.5 if hy_ < s[1] else 1)
    if hy_ >= s[1] + 4:
        ex, ey = s[0] + 0.5, hy_ - 1
    return s, (round(ex), round(ey)), P.hand


# ---------------------------------------------------------------- outils communs

def dk(R):
    return [R[0], R[0], R[1], R[2], R[3]]


def arm(c, sh, el, hd, R3, hand_cols, cuff=None, far=False, width=3.4, hand_r=2.0):
    p = new()
    rr = [R3[0], R3[0], R3[1]] if far else R3
    limb(p, [sh, el, hd], width, rr)
    if cuff:
        mx = hd[0] + (el[0] - hd[0]) * 0.45
        my = hd[1] + (el[1] - hd[1]) * 0.45
        r = 1.6 * width / 3.4
        p.ellipse(mx, my, r, r, cuff[0] if far else cuff[1])
    p.shaded_ellipse(hd[0] + 0.5, hd[1] + 0.5, hand_r, hand_r * 0.95, hand_cols[:3] if far else hand_cols)
    stamp(c, p)


def leg(c, hip, foot_x, lift, R3, boot, far, width=3.6, boot_r=(3.2, 2.6), cuff=None, toe=0):
    """Jambe ombrée + botte arrondie vers l'avant (jambe arrière plus sombre)."""
    p = new()
    fy = GROUND - lift
    rr = [R3[0], R3[0], R3[1]] if far else R3
    limb(p, [hip, (foot_x + 0.5, fy - 4)], width, rr)
    bt = dk(boot) if far else boot
    ball(p, foot_x + 1.0, fy - 2.4, boot_r[0], boot_r[1], bt)
    for x in range(foot_x - 3, foot_x + 6):
        for y in (fy - 1, fy):
            if p.get(x, y) is not None or (y == fy and foot_x - 1 <= x <= foot_x + 3):
                p.set(x, y, bt[1] if y == fy - 1 else bt[0])
    if toe:
        p.set(foot_x + 4, fy - 1, bt[2]); p.set(foot_x + 5, fy - 2, bt[2])
    p.set(foot_x - 1, fy - 4, bt[3]); p.set(foot_x, fy - 4, bt[4] if not far else bt[3])
    if cuff:
        for x in range(foot_x - 2, foot_x + 3):
            p.setf(x, fy - 5, cuff[0] if far else cuff[1])
    stamp(c, p)


def legs(c, P, R3, boot, hip_y=38, **kw):
    hip_off = P.tx * 0.5
    leg(c, (17.5 + hip_off, hip_y), 17 + P.bdx, P.blift, R3, boot, True, **kw)
    leg(c, (23.5 + hip_off, hip_y), 23 + P.fdx, P.flift, R3, boot, False, **kw)


def face_fx(c, P, skin=SKIN, glow=None):
    """Expressions par-dessus le visage de head() : douleur (> <), concentration, cri, joie."""
    hx, hy = P.hx, P.hy
    ex0, ex1, ey = int(hx + 1), int(hx + 5), int(hy)
    mx, my = int(hx + 4), int(hy + 5)
    if P.expr == 'hurt':
        for ex in (ex0, ex1):
            for dx in (-1, 0, 1, 2):
                for dy in range(0, 4):
                    c.set(ex + dx, ey + dy, skin[2])
        c.set(ex0, ey + 1, OUT); c.set(ex0 + 1, ey + 2, OUT); c.set(ex0, ey + 3, OUT)
        c.set(ex1 + 1, ey + 1, OUT); c.set(ex1, ey + 2, OUT); c.set(ex1 + 1, ey + 3, OUT)
        c.set(mx, my, OUT); c.set(mx + 1, my, OUT); c.set(mx, my + 1, MOUTH)
        # goutte de sueur
        c.set(hx + 9, hy - 4, '#bfe8ff'); c.set(hx + 9, hy - 3, '#7ac0f0'); c.set(hx + 10, hy - 3, '#bfe8ff')
    elif P.expr == 'joy':
        for ex in (ex0, ex1):
            for dx in (-1, 0, 1, 2):
                for dy in range(0, 4):
                    c.set(ex + dx, ey + dy, skin[2])
            c.set(ex, ey + 2, OUT); c.set(ex + 1, ey + 1, OUT); c.set(ex + 2, ey + 2, OUT)
        c.set(ex0 - 1, ey + 2, skin[2])
        c.set(mx, my, OUT); c.set(mx + 1, my, OUT); c.set(mx + 2, my, OUT)
        c.set(mx, my + 1, MOUTH); c.set(mx + 1, my + 1, '#e0506a')
    elif P.expr in ('shout', 'fierce'):
        c.set(ex0, ey - 1, OUT); c.set(ex0 + 1, ey, OUT)
        c.set(ex1 + 1, ey - 1, OUT); c.set(ex1, ey, OUT)
        if P.expr == 'shout':
            c.set(mx, my, OUT); c.set(mx + 1, my, OUT)
            c.set(mx, my + 1, MOUTH); c.set(mx + 1, my + 1, '#e0506a')
    elif P.expr == 'focus':
        # œil avant plissé (visée)
        for dx in (-1, 0, 1, 2):
            for dy in range(0, 4):
                c.set(ex0 + dx, ey + dy, skin[2])
        c.set(ex0 - 1, ey + 2, OUT); c.set(ex0, ey + 2, OUT); c.set(ex0 + 1, ey + 2, OUT)
    if glow and P.expr not in ('hurt', 'joy'):
        for ex in (ex0, ex1):
            if P.expr != 'focus' or ex == ex1:
                c.set(ex + 1, ey + 2, glow[1]); c.set(ex, ey + 2, glow[0])


def flower(c, x, y, petal, core, big=False):
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        c.set(x + dx, y + dy, petal)
    if big:
        for dx, dy in ((1, 1), (-1, -1), (1, -1), (-1, 1)):
            c.set(x + dx, y + dy, petal)
        for dx, dy in ((2, 0), (-2, 0), (0, 2), (0, -2)):
            c.set(x + dx, y + dy, petal)
    c.set(x, y, core)


def sparkles(c, pts, cols):
    for (x, y, big) in pts:
        if c.get(x, y) is None:
            sparkle(c, x, y, cols, big)


def blit_behind(c, src):
    """Pose `src` seulement là où `c` est vide."""
    for y in range(src.h):
        for x in range(src.w):
            v = src.px[y][x]
            if v is not None and c.px[y][x] is None:
                c.px[y][x] = v


# ================================================================ 1. FÉE

F_HAIR = ['#8a2e64', '#c85a96', '#f48cc0', '#ffc4de', '#fff0f8']
F_IRIS = ['#0e5a50', '#22b89a', '#a8ffe0']
F_LEAF = ['#123e26', '#1e6e34', '#3aa444', '#7cd85a', '#c4f496']
F_PETAL = ['#7a1a4e', '#c8407e', '#f878b0', '#ffb4d4', '#ffe8f2']
F_WING = ['#6a72c8', '#98b4f0', '#c4e2ff', '#e8f6ff', '#ffffff']
F_WING2 = ['#9a5ac0', '#c890e6', '#e8c4f8', '#f8e6ff', '#ffffff']
F_WOUT = '#4a3c96'
F_GLOW = ['#ffffff', '#ffb4e0']
F_GLOW2 = ['#ffffff', '#9af0ff']
F_GOLD = ['#ffe27a', '#fff6c0']

# Ailes de papillon (repère : racine), ailes supérieures pointues, inférieures arrondies
F_UP = [(0, 0), (-2, -7), (-4, -13), (-7, -19), (-11, -23), (-14.5, -23.5), (-16, -20), (-15.5, -14), (-13, -8), (-8, -2.5)]
F_LO = [(0, 1), (-5, 2), (-10, 5), (-13.5, 9.5), (-13, 14), (-9, 15.5), (-5.5, 12), (-2, 6)]


def bfly_wing(c, root, pts, deg, R, rim, spot=None, veins=True, scale=1.0):
    P_ = [rot((root[0] + x * scale, root[1] + y * scale), root, deg) for x, y in pts]
    m = mask_of(lambda t: t.poly(P_, '#000'))
    if not m:
        return
    far_d = max(math.hypot(x - root[0], y - root[1]) for x, y in P_)
    p = new()
    for (x, y) in m:
        d = math.hypot(x + 0.5 - root[0], y + 0.5 - root[1]) / far_d
        edge = any((x + dx, y + dy) not in m for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
        if edge:
            col = rim
        elif d < 0.3:
            col = R[1]
        elif d < 0.55:
            col = R[2]
        elif d < 0.8:
            col = R[3]
        else:
            col = R[4] if d > 0.9 else R[3]
        p.set(x, y, col)
    if veins:
        for k in range(2, len(P_) - 1, 2):
            tx_, ty_ = P_[k]
            for i in range(3, 14):
                u = i / 16
                vx, vy = root[0] + (tx_ - root[0]) * u, root[1] + (ty_ - root[1]) * u
                if (int(vx), int(vy)) in m:
                    p.setf(vx, vy, R[1] if u < 0.5 else R[2])
    if spot:
        (sx, sy), col, col2 = spot
        q = rot((root[0] + sx * scale, root[1] + sy * scale), root, deg)
        p.ellipse(q[0], q[1], 1.6, 1.4, col, only_inside=True)
        p.setf(q[0] - 0.5, q[1] - 0.5, col2)
    stamp(c, p, F_WOUT)


def fairy_wings(c, P, far):
    flap = [0, 7, 13, 6][P.ph]
    if P.name == 'victory':
        flap = 2
    if P.name == 'hurt':
        flap = 15
    if far:
        root = (20 + P.tx, 24 + P.ty)
        R = [F_WING[0], F_WING[1], F_WING[1], F_WING[2], F_WING[3]]
        R2 = [F_WING2[0], F_WING2[1], F_WING2[1], F_WING2[2], F_WING2[3]]
        bfly_wing(c, root, F_LO, flap * 0.5 + 18, R2, F_WING2[1], veins=False, scale=0.8)
        bfly_wing(c, root, F_UP, flap + 26, R, F_WING[1], veins=False, scale=0.8)
    else:
        root = (18 + P.tx, 26 + P.ty)
        bfly_wing(c, root, F_LO, flap * 0.6, F_WING2, F_WING2[1], spot=((-9, 10), F_PETAL[2], F_PETAL[4]))
        bfly_wing(c, root, F_UP, flap - 4, F_WING, F_WING[1], spot=((-12, -17), F_PETAL[3], WHITE))


def petal(c, x, y, a, ln, R, wd=1.8):
    tip = along((x, y), a, ln)
    mid = along((x, y), a, ln * 0.55)
    nx, ny = perp(a)
    spoly(c, [(x - nx * 0.8, y - ny * 0.8), (mid[0] + nx * wd, mid[1] + ny * wd), tip, (mid[0] - nx * wd, mid[1] - ny * wd),
              (x + nx * 0.8, y + ny * 0.8)], R, contrast=0.55)


def fairy(P):
    c = new()
    tx, ty, hx, hy, sw = P.tx, P.ty, P.hx, P.hy, P.sw
    # poussière de fée (derrière)
    sp = [[(4, 30, True), (40, 8, False), (8, 4, False), (44, 22, True)],
          [(3, 27, False), (41, 5, True), (10, 2, True), (45, 26, False)],
          [(5, 33, True), (43, 11, False), (6, 6, True), (42, 19, False)],
          [(2, 35, False), (39, 3, True), (12, 3, False), (46, 30, True)]][P.ph]
    fairy_wings(c, P, far=True)
    fairy_wings(c, P, far=False)
    # longue chevelure rose ondulée, derrière
    lock(c, [(hx - 4, hy - 5), (hx - 9, hy), (hx - 9.5 + sw * 0.5, hy + 6), (hx - 8 + sw, hy + 11), (hx - 9.5 + sw * 1.5, hy + 15)],
         [4.2, 4.6, 4.0, 3.0, 1.0], F_HAIR)
    # bras arrière
    if P.back not in FRONT_BACK:
        s, e, h = back_arm_pts(P)
        arm(c, s, e, h, [SKIN[0], SKIN[1], SKIN[2]], [SKIN[0], SKIN[1], SKIN[2], SKIN[2]], cuff=(F_PETAL[1], F_PETAL[1]))
    # jambes fines + chaussons-feuilles à pointe recourbée
    legs(c, P, [SKIN[1], SKIN[2], SKIN[3]], F_LEAF, width=3.0, boot_r=(2.8, 2.3), toe=1, cuff=(F_PETAL[1], F_PETAL[3]))
    # jupe : corolle de pétales roses sous des feuilles vertes
    t = new()
    for i, x in enumerate(range(12, 31, 3)):
        petal(t, x + tx, 34 + ty, 90 + (x - 21) * 4.5, 7 + (i % 2), F_PETAL, wd=2.0)
    stamp(c, t)
    t = new()
    for i, x in enumerate(range(13, 30, 3)):
        leaf(t, x + tx + 1, 31 + ty, 90 + (x - 21) * 4, 6 - (i % 2), F_LEAF)
    stamp(c, t)
    # taille + corsage de feuilles, col de pétales
    t = new()
    spoly(t, [(15 + tx, 30 + ty), (27 + tx, 30 + ty), (28 + tx, 34 + ty), (14 + tx, 34 + ty)], F_LEAF)
    ball(t, 21 + tx, 27.5 + ty, 5.4, 4.8, F_LEAF)
    for k in range(-4, 5):
        t.setf(21 + k + tx, 26 + abs(k) // 2 + ty, F_LEAF[1])
    for x in range(15, 28):
        t.setf(x + tx, 31 + ty, F_PETAL[2] if x % 3 else F_PETAL[3])
        t.setf(x + tx, 32 + ty, F_PETAL[1])
    stamp(c, t)
    t = new()
    for (x, y, a) in ((18, 24, 200), (21, 24, 270), (24, 24, 340)):
        petal(t, x + tx, y + ty + 1, a, 3, F_PETAL, wd=1.4)
    stamp(c, t)
    flower(c, 24 + tx, 31 + ty, F_PETAL[3], F_GOLD[0])
    if P.back in FRONT_BACK:
        s, e, h = back_arm_pts(P)
        arm(c, s, e, h, [SKIN[0], SKIN[1], SKIN[2]], [SKIN[0], SKIN[1], SKIN[2], SKIN[2]], cuff=(F_PETAL[1], F_PETAL[1]))
    # tête
    head(c, hx, hy, F_HAIR, F_IRIS, mouth='smile', fringe=[8, 6, 2, 0, 2, 3, 0, -1, 1, 2, -1, -3],
         blush='#ff90b8')
    face_fx(c, P)
    # oreille pointue d'elfe (devant la masse de cheveux)
    t = new()
    spoly(t, [(hx - 2.5, hy + 0.5), (hx - 10, hy - 3), (hx - 2, hy + 4)], [SKIN[1], SKIN[1], SKIN[2], SKIN[3], SKIN[3]])
    t.setf(hx - 4, hy + 1, SKIN[1]); t.setf(hx - 5, hy, SKIN[1])
    stamp(c, t)
    c.set(hx - 4, hy + 2, '#ff90b8')
    # mèche avant (devant l'oreille)
    lock(c, [(hx - 1.5, hy - 1), (hx - 2.5 + sw * 0.3, hy + 5), (hx - 1.5 + sw * 0.5, hy + 9)], [1.8, 2.0, 0.8], F_HAIR)
    # couronne de fleurs : feuilles puis fleurs le long du crâne
    t = new()
    for (dx, dy, a) in ((-8, -2, 160), (-6, -6, 210), (-2, -8.5, 250), (2.5, -8.5, 290), (6, -6.5, 330)):
        leaf(t, hx + dx, hy + dy, a, 3.5, F_LEAF)
    stamp(c, t)
    t = new()
    for (dx, dy, petal_c, core, big) in ((-7.5, -4.5, F_PETAL[2], F_GOLD[0], False), (-4.5, -8, WHITE, F_GOLD[0], False),
                                         (0, -9.5, F_PETAL[3], F_PETAL[1], True), (4.5, -8.5, F_GOLD[0], '#f08a3a', False),
                                         (7.5, -5.5, F_PETAL[2], WHITE, False)):
        flower(t, hx + dx, hy + dy, petal_c, core, big)
    stamp(c, t, F_PETAL[0])
    c.set(hx - 0.5, hy - 10.5, WHITE)
    # bras d'arme (peau, manche bouffante en pétale)
    s, e, h = front_arm_pts(P)
    arm(c, s, e, h, [SKIN[1], SKIN[2], SKIN[3]], SKIN, cuff=(F_PETAL[1], F_PETAL[3]))
    t = new()
    ball(t, 26.5 + tx, 26.5 + ty, 3.3, 2.9, F_PETAL)
    for x in range(23, 30):
        t.setf(x + tx, 28 + ty, F_LEAF[2])
    stamp(c, t)
    sparkles(c, sp, F_GLOW)
    sparkles(c, [(x + 3, y + 9, False) for (x, y, _) in sp[:2]], F_GLOW2)
    if P.name in ('cast', 'attack2', 'shoot'):
        hx_, hy_ = P.hand
        sparkles(c, [(hx_ + 5, hy_ - 4, True), (hx_ + 8, hy_ + 2, False), (hx_ + 3, hy_ + 5, True)], F_GLOW)
    return c


# ================================================================ 2. DIABLESSE

DM_HAIR = ['#0c0610', '#1a0f24', '#2a1838', '#3e2252', '#74468c']
DM_IRIS = ['#6a0a10', '#ff3a2a', '#ffe04a']
DM_GLOW = ['#ffe04a', '#ff5a2a']
DM_HORN = ['#160a12', '#34121e', '#5e1a2a', '#a8323a', '#ff9070']
DM_RED = ['#3a0610', '#6e0c1e', '#a8182c', '#e0343c', '#ff7a6a']
DM_BLK = ['#0c0812', '#1a1424', '#2c2238', '#463858', '#6e5e88']
DM_WING = ['#24060e', '#4e0c1c', '#82162c', '#b8283a', '#e8525a']
DM_BONE = ['#120a14', '#241424']
DM_GOLD = GOLD
DM_SKIN = ['#a05860', '#dc9488', '#fcd0bc', '#ffe8dc']
DM_EMBER = ['#ffe04a', '#ff5a2a']


def spade_tail(c, P):
    sw = P.sw
    k = [0, 1, 2, 1][P.ph]
    base = (14 + P.tx, 36 + P.ty)
    pts = [base, (10.5, 41), (7, 42 - k * 0.3), (4 + sw * 0.15, 40.5 - k * 0.5), (3.5 + sw * 0.2, 37.5 - k), (4.5 + sw * 0.2, 34 - k)]
    pts = [pts[0]] + [(x + max(P.tx, 0) * 0.5, y + P.ty) for x, y in pts[1:]]
    p = new()

    def sh(t, s, x, y):
        if s < -0.35:
            return DM_BLK[3]
        if s > 0.45:
            return DM_BLK[0]
        return DM_BLK[2] if t < 0.6 else DM_BLK[1]
    spine_fill(p, pts, [2.2, 2.0, 1.8, 1.6, 1.4, 1.1], sh)
    stamp(c, p)
    # pointe en pique (cœur renversé) au bout
    tip = pts[-1]
    a = math.degrees(math.atan2(tip[1] - pts[-2][1], tip[0] - pts[-2][0]))
    q0 = along(tip, a, 0.5)
    q1 = along(tip, a, 6.5)
    nx, ny = perp(a)
    m1 = along(tip, a, 2.2)
    t = new()
    spoly(t, [(q0[0], q0[1]), (m1[0] + nx * 3.4, m1[1] + ny * 3.4), (q1[0], q1[1]), (m1[0] - nx * 3.4, m1[1] - ny * 3.4)],
          DM_RED, contrast=0.6)
    t.setf(m1[0], m1[1], DM_RED[4])
    stamp(c, t)


def demon_wing(c, P, far):
    flap = [0, -3, -5, -2][P.ph]
    if P.name == 'victory':
        flap = -6
    if P.name == 'hurt':
        flap = 3
    tx, ty = P.tx, P.ty
    if far:
        sh_ = (19 + tx, 24 + ty)
        wr = (17 + tx, 9 + ty + flap)
        tips = [(13 + tx, 3 + ty + flap), (9 + tx, 8 + ty + flap // 2), (9 + tx, 15 + ty)]
        body = (16 + tx, 27 + ty)
    else:
        sh_ = (16 + tx, 25 + ty)
        wr = (7 + tx, 14 + ty + flap)
        tips = [(2.5 + max(tx, -1), 8 + ty + flap), (1.5 + max(tx, -1), 15 + ty + flap // 2), (2 + max(tx, -1), 22 + ty), (6 + tx, 27 + ty)]
        body = (13 + tx, 30 + ty)
    pts = [sh_, wr]
    for i, tp in enumerate(tips):
        pts.append(tp)
        nxt = tips[i + 1] if i + 1 < len(tips) else body
        mx, my = (tp[0] + nxt[0]) / 2, (tp[1] + nxt[1]) / 2
        pts.append((mx + (wr[0] - mx) * 0.3, my + (wr[1] - my) * 0.3))
    pts.append(body)
    R = dk(DM_WING) if far else DM_WING
    p = new()
    spoly(p, pts, R, bias=0.05, contrast=0.4)
    p.line(sh_[0], sh_[1], wr[0], wr[1], DM_BONE[1], width=2)
    for tp in tips:
        p.line(wr[0], wr[1], tp[0], tp[1], DM_BONE[1])
    p.set(wr[0], wr[1] - 1, DM_HORN[3]); p.set(wr[0], wr[1] - 2, DM_HORN[4])
    stamp(c, p)


def demon_horn(c, base, pts, w0):
    p = new()

    def sh(t, s, x, y):
        if t > 0.8:
            return DM_HORN[4] if s < 0.2 else DM_HORN[3]
        if t > 0.6:
            return DM_HORN[3] if s < 0 else DM_HORN[2]
        if s < -0.4:
            return DM_HORN[3]
        if s > 0.4:
            return DM_HORN[0]
        return DM_HORN[2] if (int(t * 12) % 3) else DM_HORN[1]
    n = len(pts)
    spine_fill(p, [base] + pts, [w0] + [w0 * (1 - (i + 1) / n) + 0.4 for i in range(n)], sh)
    stamp(c, p)


def demoness(P):
    c = new()
    tx, ty, hx, hy, sw = P.tx, P.ty, P.hx, P.hy, P.sw
    emb = [[(5, 40), (42, 14), (9, 6)], [(4, 37), (43, 11), (11, 4)], [(6, 42), (44, 17), (8, 8)], [(3, 39), (41, 9), (12, 3)]][P.ph]
    for (x, y) in emb:
        c.set(x, y, DM_EMBER[0]); c.set(x, y + 1, DM_EMBER[1])
    demon_wing(c, P, far=False)
    spade_tail(c, P)
    # longue chevelure noire aux reflets violets
    lock(c, [(hx - 4, hy - 5), (hx - 9, hy + 1), (hx - 9.5 + sw * 0.5, hy + 7), (hx - 8 + sw, hy + 12), (hx - 9.5 + sw * 1.5, hy + 15)],
         [4.0, 4.4, 3.8, 2.8, 0.8], DM_HAIR)
    if P.back not in FRONT_BACK:
        s, e, h = back_arm_pts(P)
        arm(c, s, e, h, DM_BLK[1:4], DM_BLK[1:5], far=True, cuff=(DM_GOLD[1], DM_GOLD[2]))
    # cuissardes noires (cuisses nues au-dessus), semelles rouges, boucle dorée
    hip_off = tx * 0.5
    for (hip, fx, lift, far) in (((17.5 + hip_off, 38), 17 + P.bdx, P.blift, True), ((23.5 + hip_off, 38), 23 + P.fdx, P.flift, False)):
        p = new()
        fy = GROUND - lift
        rr = [DM_SKIN[0], DM_SKIN[1], DM_SKIN[1]] if far else DM_SKIN[1:4]
        limb(p, [hip, (fx + 0.5, fy - 4)], 3.4, rr)
        stamp(c, p)
        p = new()
        top = (hip[0] + (fx + 0.5 - hip[0]) * 0.35, hip[1] + (fy - 4 - hip[1]) * 0.35)
        limb(p, [top, (fx + 0.5, fy - 4)], 3.6, [DM_BLK[0], DM_BLK[0], DM_BLK[1]] if far else DM_BLK[1:4])
        bt = dk(DM_BLK) if far else DM_BLK
        ball(p, fx + 1.0, fy - 2.4, 3.0, 2.5, bt)
        for x in range(fx - 3, fx + 6):
            for y in (fy - 1, fy):
                if p.get(x, y) is not None or (y == fy and fx - 1 <= x <= fx + 3):
                    p.set(x, y, bt[1] if y == fy - 1 else DM_RED[1 if far else 2])
        # talon
        p.set(fx - 2, fy, DM_RED[1]); p.set(fx - 2, fy - 1, bt[1])
        for x in range(int(top[0]) - 2, int(top[0]) + 3):
            p.setf(x, int(top[1]), DM_RED[2] if not far else DM_RED[1])
        p.setf(fx + 1, fy - 5, DM_GOLD[3] if not far else DM_GOLD[1])
        p.set(fx - 1, fy - 4, bt[3])
        stamp(c, p)
    # jupe courte rouge à pans pointus, liseré or, jupon noir
    t = new()
    spoly(t, [(14 + tx, 31 + ty), (28 + tx, 31 + ty), (31 + tx, 39 + ty), (11 + tx, 39 + ty)], DM_BLK, contrast=0.4)
    stamp(c, t)
    t = new()
    hem = [(14 + tx, 31 + ty), (28 + tx, 31 + ty), (31 + tx, 38 + ty), (28 + tx, 36.5 + ty), (25.5 + tx, 39 + ty),
           (22 + tx, 36.5 + ty), (19 + tx, 39 + ty), (16 + tx, 36.5 + ty), (13 + tx, 38.5 + ty), (11 + tx, 37 + ty)]
    spoly(t, hem, DM_RED, contrast=0.45)
    for y in range(32, 40):
        for x in range(10, 33):
            if t.get(x + tx, y + ty) is not None and t.get(x + tx, y + ty + 1) is None:
                t.set(x + tx, y + ty, DM_GOLD[2] if x < 22 else DM_GOLD[1])
    for x in (17, 21, 25):
        t.setf(x + tx, 33 + ty, DM_RED[1]); t.setf(x + tx + (1 if x > 21 else -1 if x < 21 else 0), 35 + ty, DM_RED[1])
    stamp(c, t)
    # corset noir, plastron rouge, laçage doré
    t = new()
    ball(t, 21 + tx, 27.8 + ty, 5.8, 5.0, DM_BLK)
    spoly(t, [(18 + tx, 24 + ty), (24 + tx, 24 + ty), (23 + tx, 32 + ty), (19 + tx, 32 + ty)], DM_RED, only_inside=True, contrast=0.5)
    for y in range(26, 32, 2):
        t.setf(20 + tx, y + ty, DM_GOLD[3]); t.setf(21 + tx, y + 1 + ty, DM_GOLD[2]); t.setf(22 + tx, y + ty, DM_GOLD[2])
    for x in range(15, 28):
        t.setf(x + tx, 32 + ty, DM_GOLD[2] if x < 22 else DM_GOLD[1])
        t.setf(x + tx, 33 + ty, DM_BLK[0])
    t.setf(21 + tx, 32 + ty, DM_RED[4])
    stamp(c, t)
    # tour de cou doré à pendentif
    t = new()
    for x in range(int(hx - 3), int(hx + 3)):
        t.set(x, hy + 7.5, DM_BLK[1])
    t.set(hx, hy + 8.5, DM_RED[3]); t.set(hx, hy + 9.5, DM_GOLD[2])
    stamp(c, t)
    if P.back in FRONT_BACK:
        s, e, h = back_arm_pts(P)
        arm(c, s, e, h, DM_BLK[1:4], DM_BLK[1:5], far=True, cuff=(DM_GOLD[1], DM_GOLD[2]))
    # corne lointaine, tête, corne proche
    demon_horn(c, (hx - 2.5, hy - 6.5), [(hx - 3.5, hy - 11), (hx - 6, hy - 14), (hx - 9, hy - 14.5), (hx - 11, hy - 13)], 2.4)
    head(c, hx, hy, DM_HAIR, DM_IRIS, mouth='fang', brows='angry', fringe=[8, 6, 2, 0, 2, 1, -1, 0, 1, -1, -2, -3],
         skin=DM_SKIN, blush='#f07a8a')
    face_fx(c, P, skin=DM_SKIN, glow=DM_GLOW)
    # longue mèche devant l'épaule
    lock(c, [(hx - 2, hy - 1), (hx - 2.5 + sw * 0.3, hy + 6), (hx - 1 + sw * 0.5, hy + 11)], [1.8, 2.2, 0.8], DM_HAIR)
    demon_horn(c, (hx + 1.5, hy - 7), [(hx + 2, hy - 11.5), (hx + 0.5, hy - 15), (hx - 2.5, hy - 16.5), (hx - 5, hy - 15.5)], 2.8)
    # lueur des yeux (traînée en attaque)
    if P.expr in ('shout', 'fierce'):
        ey = int(hy) + 2
        for k in range(1, 4):
            c.set(int(hx) + 1 - k, ey - (k > 1), DM_GLOW[1] if k < 3 else DM_RED[2])
    # bras d'arme : gant noir, bracelet doré
    s, e, h = front_arm_pts(P)
    arm(c, s, e, h, [DM_SKIN[1], DM_SKIN[2], DM_SKIN[3]], DM_BLK[1:5], cuff=(DM_GOLD[1], DM_GOLD[3]))
    # épaulière à pointe
    t = new()
    ball(t, 26.8 + tx, 26.6 + ty, 3.6, 3.0, DM_BLK)
    spoly(t, [(26 + tx, 24.5 + ty), (30.5 + tx, 21.5 + ty), (29 + tx, 26 + ty)], DM_HORN)
    for x in range(23, 31):
        t.setf(x + tx, 28 + ty, DM_GOLD[2])
    t.setf(25 + tx, 25 + ty, DM_BLK[4])
    stamp(c, t)
    if P.name in ('cast', 'attack2', 'shoot'):
        hx_, hy_ = P.hand
        for (x, y) in ((hx_ + 5, hy_ - 3), (hx_ + 8, hy_ + 2), (hx_ + 3, hy_ + 5)):
            c.set(x, y, DM_EMBER[0]); c.set(x, y + 1, DM_EMBER[1])
    return c


# ================================================================ 3. VALKYRIE

V_HAIR = ['#94621a', '#d4a232', '#f2cc58', '#fff0a0', '#fffbe0']
V_IRIS = ['#12306a', '#2f7cf6', '#9ad8ff']
V_SILVER = ['#2e3448', '#5a6680', '#929eb8', '#d0d8e8', '#ffffff']
V_BLUE = ['#0e1a4a', '#1a3080', '#2a50b8', '#4a7ae0', '#90b8ff']
V_CAPE = ['#0a1238', '#16246a', '#22389e', '#3a58c8', '#6a8ae8']
V_WING = ['#5a6a98', '#a0b0d4', '#dce6f4', '#f4f8ff', '#ffffff']
V_GOLD = GOLD
V_GLOW = ['#ffffff', '#a8d8ff']

# aile pliée/entrouverte : bord d'attaque puis rémiges (base a, base b, pointe), racine (16, 25)
V_ROOT = (16, 25)
V_ARM = [(16, 25), (13, 19), (10, 14), (6.5, 10.5), (3.5, 9.5), (2, 11)]
V_FEATH = [((2, 11), (5, 10.5), (0.5, 17)),
           ((3.5, 11), (7, 12), (0.5, 22)),
           ((5.5, 13), (9, 15), (1.5, 27)),
           ((8, 15.5), (11.5, 19), (4, 31)),
           ((10.5, 19), (14, 23), (8, 33)),
           ((13, 22), (16, 26), (12, 33))]


def v_feather(c, base_a, base_b, tip, R, sep):
    mid = ((base_a[0] + base_b[0]) / 2, (base_a[1] + base_b[1]) / 2)
    ln = math.hypot(tip[0] - mid[0], tip[1] - mid[1]) or 1
    ux, uy = (tip[0] - mid[0]) / ln, (tip[1] - mid[1]) / ln
    bulge = (base_b[0] + (tip[0] - base_b[0]) * 0.6 + 1.0, base_b[1] + (tip[1] - base_b[1]) * 0.6)
    m = mask_of(lambda t: t.poly([base_a, base_b, bulge, tip], '#000'))
    p = new()
    for (x, y) in m:
        t = ((x + 0.5 - mid[0]) * ux + (y + 0.5 - mid[1]) * uy) / ln
        if t > 0.82:
            col = R[1]
        elif (x - 1, y) not in m or (x, y - 1) not in m:
            col = R[4]
        elif (x + 1, y) not in m:
            col = R[1]
        else:
            col = R[3] if t < 0.45 else R[2]
        p.set(x, y, col)
    stamp(c, p, sep)


def valk_wing(c, P, far):
    deg = [-4, 1, 6, 0][P.ph]
    if P.name == 'victory':
        deg = -6
    if P.name == 'hurt':
        deg = 10
    dx, dy = P.tx + 2, P.ty
    if far:
        dx, dy, deg = dx + 3, dy - 1, deg + 30
    R = V_WING if not far else [V_WING[0], V_WING[0], V_WING[1], V_WING[2], V_WING[2]]
    root = (V_ROOT[0] + dx, V_ROOT[1] + dy)
    sc = 0.96 if not far else 0.8
    T = lambda pt: rot((root[0] + (pt[0] - V_ROOT[0]) * sc, root[1] + (pt[1] - V_ROOT[1]) * sc), root, deg)  # noqa: E731
    w = new()
    for (ba, bb, tp) in V_FEATH:
        v_feather(w, T(ba), T(bb), T(tp), R, R[1] if not far else R[0])
    cov = new()
    armp = [T(p) for p in V_ARM]
    for (x0, y0), (x1, y1) in zip(armp, armp[1:]):
        cov.line(x0, y0, x1, y1, R[3], width=3.4)
    for (x, y) in armp[1:-1]:
        cov.ellipse(x + 1.2, y + 2.0, 1.9, 1.7, R[3])
    for (x0, y0), (x1, y1) in zip(armp, armp[1:]):
        cov.line(x0 - 0.6, y0 - 0.8, x1 - 0.6, y1 - 0.8, R[4])
    stamp(w, cov, R[2] if not far else R[1])
    stamp(c, w)


def braid(c, P):
    """Longue natte blonde : maillons alternés, ruban bleu et anneau doré."""
    sw = P.sw
    hx, hy = P.hx, P.hy
    spine = [(hx - 6, hy + 1), (hx - 8.5, hy + 6), (hx - 9 + sw * 0.5, hy + 12), (hx - 8 + sw, hy + 18), (hx - 9 + sw * 1.5, hy + 22)]
    pts = []
    for (x0, y0), (x1, y1) in zip(spine, spine[1:]):
        for k in range(4):
            u = k / 4
            pts.append((x0 + (x1 - x0) * u, y0 + (y1 - y0) * u))
    pts.append(spine[-1])
    p = new()
    for i, (x, y) in enumerate(pts[:-3]):
        off = 0.7 if i % 2 else -0.7
        r = 2.0 - i * 0.03
        ball(p, x + off, y, r, 1.6, [V_HAIR[0], V_HAIR[1], V_HAIR[2], V_HAIR[3], V_HAIR[4]])
    stamp(c, p)
    end = pts[-4]
    t = new()
    t.ellipse(end[0], end[1] + 1.2, 1.6, 1.0, V_BLUE[3])
    t.set(end[0] - 1, end[1] + 1, V_BLUE[4])
    t.set(end[0] + 1, end[1] + 2, V_BLUE[1])
    # houppe
    for k, (dx, dy) in enumerate(((-1, 3), (0, 3), (1, 3), (-1, 4), (0, 4), (0, 5), (1, 4))):
        t.set(end[0] + dx, end[1] + dy, V_HAIR[3] if k < 3 else V_HAIR[2])
    stamp(c, t)


def helm_wing(c, base, deg, scale, far=False):
    """Petite aile de heaume : 3 plumes en éventail vers l'arrière/haut."""
    R = V_WING if not far else [V_WING[0], V_WING[1], V_WING[1], V_WING[2], V_WING[3]]
    feathers = [((0, 0), (1.5, -1.5), (-3, -11)), ((-0.5, 0.5), (0.5, -1), (-7, -8.5)), ((-1, 1), (0, 0), (-9.5, -4))]
    w = new()
    for (a, b, tp) in feathers:
        A = rot((base[0] + a[0] * scale, base[1] + a[1] * scale), base, deg)
        B = rot((base[0] + b[0] * scale + 1.5, base[1] + b[1] * scale + 1.5), base, deg)
        Tp = rot((base[0] + tp[0] * scale, base[1] + tp[1] * scale), base, deg)
        v_feather(w, A, B, Tp, R, R[1])
    stamp(c, w)


def valkyrie(P):
    c = new()
    tx, ty, hx, hy, sw = P.tx, P.ty, P.hx, P.hy, P.sw
    sp = [[(43, 6, True), (4, 40, False)], [(44, 9, False), (3, 37, True)], [(42, 4, False), (5, 42, True)], [(45, 11, True), (2, 38, False)]][P.ph]
    sparkles(c, sp, V_GLOW)
    valk_wing(c, P, far=True)
    valk_wing(c, P, far=False)
    # cape courte bleue (jusqu'aux hanches), ourlet ondulant
    t = new()
    ph = P.ph * 1.6
    hem = [(x, 37.5 + ty + 1.0 * math.sin(x * 0.9 + ph) - (14 - x) * 0.25 * (sw < -1)) for x in range(8, 22)]
    left_x = 9 + sw * 0.6 + tx
    pts = [(14 + tx, 23 + ty), (24 + tx, 23 + ty), (23 + tx, 32 + ty), (21 + tx, 37 + ty)] + \
          [(x + tx * 0.5, y) for x, y in hem[::-1] if x + tx * 0.5 > left_x] + [(left_x, 37 + ty), (left_x + 1.5, 30 + ty), (12 + tx, 25 + ty)]
    spoly(t, pts, V_CAPE, contrast=0.5)
    for i, fx in enumerate((11, 14, 17)):
        t.line(fx + 2 + tx, 27 + ty, fx + tx + sw * 0.2, 37 + ty, V_CAPE[1] if i % 2 else V_CAPE[0])
    for y in range(24, 42):
        for x in range(0, 30):
            if t.get(x, y) is not None and t.get(x, y + 1) is None:
                t.set(x, y, V_GOLD[2])
    stamp(c, t)
    braid(c, P)
    if P.back not in FRONT_BACK:
        s, e, h = back_arm_pts(P)
        arm(c, s, e, h, V_BLUE[1:4], V_SILVER[1:5], far=True, cuff=(V_SILVER[1], V_SILVER[3]))
    # jambières bleues, grèves et solerets d'argent
    legs(c, P, V_BLUE[1:4], V_SILVER, cuff=(V_GOLD[1], V_GOLD[2]))
    for (fx, lift, far) in ((17 + P.bdx, P.blift, True), (23 + P.fdx, P.flift, False)):
        fy = GROUND - lift
        hip_x = (17.5 if far else 23.5) + tx * 0.5
        for y in range(fy - 8, fy - 4):
            u = (y - 38) / max(1, fy - 4 - 38)
            cx = hip_x + (fx + 0.5 - hip_x) * u
            c.setf(cx - 1, y, V_SILVER[2 if far else 3]); c.setf(cx, y, V_SILVER[1 if far else 2])
        kx = hip_x + (fx + 0.5 - hip_x) * 0.45
        c.setf(kx - 1, 41 - lift // 2, V_SILVER[3 if far else 4]); c.setf(kx, 41 - lift // 2, V_SILVER[2])
    # jupe bleue à lames d'argent
    t = new()
    spoly(t, [(14 + tx, 31 + ty), (28 + tx, 31 + ty), (30.5 + tx, 39 + ty), (11.5 + tx, 39 + ty)], V_BLUE, contrast=0.45)
    for x in range(10, 33):
        t.setf(x + tx, 38 + ty, V_SILVER[3] if x < 22 else V_SILVER[2]); t.setf(x + tx, 39 + ty, V_SILVER[1])
    for x in (16, 21, 26):
        for y in range(33, 38):
            t.setf(x + tx + (y - 33) * (x - 21) / 10, y + ty, V_BLUE[1])
    stamp(c, t)
    t = new()
    for (x0, x1) in ((13, 18), (24, 29)):
        spoly(t, [(x0 + tx, 31 + ty), (x1 + tx, 31 + ty), (x1 + 1 + tx, 35.5 + ty), (x0 - 1 + tx, 35.5 + ty)], V_SILVER, contrast=0.5)
    stamp(c, t)
    # cuirasse d'argent, gemme bleue, ceinture
    t = new()
    ball(t, 21 + tx, 28 + ty, 6.2, 5.3, V_SILVER)
    for k in range(5):
        t.setf(17 + k + tx, 24 + k + ty, V_BLUE[3]); t.setf(25 - k + tx, 24 + k + ty, V_BLUE[2])
    t.setf(21 + tx, 28 + ty, V_BLUE[3]); t.setf(21 + tx, 29 + ty, V_BLUE[1]); t.setf(20 + tx, 28 + ty, V_BLUE[4])
    t.setf(17 + tx, 26 + ty, V_SILVER[4]); t.setf(18 + tx, 25 + ty, V_SILVER[4])
    for x in range(14, 29):
        t.setf(x + tx, 32 + ty, V_GOLD[2] if x < 22 else V_GOLD[1]); t.setf(x + tx, 33 + ty, V_BLUE[0])
    t.setf(21 + tx, 32 + ty, V_GOLD[4])
    stamp(c, t)
    if P.back in FRONT_BACK:
        s, e, h = back_arm_pts(P)
        arm(c, s, e, h, V_BLUE[1:4], V_SILVER[1:5], far=True, cuff=(V_SILVER[1], V_SILVER[3]))
    # aile de heaume lointaine (derrière la tête)
    head(c, hx, hy, V_HAIR, V_IRIS, mouth='small', fringe=[8, 6, 3, 1, 2, 2, 1, 0, 1, 2, 0, -1], blush='#f4a0a8')
    face_fx(c, P)
    # heaume d'argent : calotte au-dessus des yeux, couvre-nuque, bandeau doré, nasal court
    t = new()
    cx_, cy_ = hx - 0.5, hy - 2.2
    for y in range(int(cy_ - 9), int(hy - 1)):
        for x in range(int(cx_ - 10), int(cx_ + 10)):
            dx, dy = (x + 0.5 - cx_) / 8.9, (y + 0.5 - cy_) / 8.0
            if dx * dx + dy * dy <= 1 and (y < hy - 3.5 or x < hx - 3):
                t.set(x, y, '#000')
    for y in range(int(hy - 3), int(hy + 4)):
        for x in range(int(hx - 9), int(hx - 3)):
            dx, dy = (x + 0.5 - (hx - 3)) / 6.0, (y + 0.5 - (hy - 3)) / 7.0
            if dx * dx + dy * dy <= 1:
                t.set(x, y, '#000')
    m = {(x, y) for y in range(-PADX, H) for x in range(-PADX, W + PADX) if t.get(x, y) is not None}
    t = new()
    for (x, y) in m:
        dx, dy = (x + 0.5 - cx_) / 8.9, (y + 0.5 - cy_) / 8.0
        v = -0.55 * dx - 0.75 * dy + 0.4 * math.sqrt(max(0, 1 - dx * dx - dy * dy))
        col = V_SILVER[3] if v > 0.75 else V_SILVER[2] if v > 0.2 else V_SILVER[1] if v > -0.3 else V_SILVER[0]
        t.set(x, y, col)
    for (x, y) in m:
        if (x, y + 1) not in m and y > hy - 6:
            t.set(x, y, V_GOLD[2] if x < hx else V_GOLD[1])
        if (x, y + 1) not in m and (x, y + 2) not in m and y < hy - 3 and y > hy - 6 and x > hx - 3:
            pass
    # arête centrale + rivets
    for y in range(int(hy - 10), int(hy - 3)):
        t.setf(hx + 0.5 - (y - hy + 10) * 0.1, y, V_SILVER[4] if y < hy - 7 else V_SILVER[3])
    t.setf(hx + 6, hy - 5, V_GOLD[3]); t.setf(hx - 5, hy - 4, V_GOLD[3])
    stamp(c, t)
    # nasal
    c.set(hx + 7, hy - 3, V_SILVER[3]); c.set(hx + 7, hy - 2, V_SILVER[2]); c.set(hx + 8, hy - 3, OUT); c.set(hx + 8, hy - 2, OUT)
    c.set(hx + 7, hy - 1, OUT)
    # mèche de frange sous le casque, sur le front
    c.set(hx + 2, hy - 3, V_HAIR[3]); c.set(hx + 3, hy - 3, V_HAIR[2]); c.set(hx + 4, hy - 3, V_HAIR[2])
    # aile de heaume proche (sur la tempe)
    helm_wing(c, (hx - 4, hy - 4), -5 + [0, 4, 8, 4][P.ph], 0.85)
    c.set(hx - 4, hy - 4, V_GOLD[3]); c.set(hx - 3, hy - 4, V_GOLD[2]); c.set(hx - 4, hy - 3, V_GOLD[1])
    # bras d'arme : manche bleue, gantelet d'argent
    s, e, h = front_arm_pts(P)
    arm(c, s, e, h, V_BLUE[1:4], V_SILVER[1:5], cuff=(V_SILVER[2], V_SILVER[3]))
    t = new()
    ball(t, 26.8 + tx, 26.4 + ty, 4.1, 3.5, V_SILVER)
    for x in range(22, 32):
        t.setf(x + tx, 29 + ty, V_GOLD[2]); t.setf(x + tx, 30 + ty, V_BLUE[1])
    t.setf(25 + tx, 24 + ty, V_SILVER[4]); t.setf(26 + tx, 24 + ty, V_SILVER[4])
    # motif d'aile gravé
    for (x, y) in ((27, 26), (28, 25), (29, 25), (28, 27)):
        t.setf(x + tx, y + ty, V_BLUE[3])
    stamp(c, t)
    # fermoir de cape
    c.set(14 + tx, 24 + ty, V_GOLD[3]); c.set(15 + tx, 24 + ty, V_GOLD[2]); c.set(14 + tx, 25 + ty, V_GOLD[2])
    if P.name in ('cast', 'attack2', 'shoot'):
        hx_, hy_ = P.hand
        sparkles(c, [(hx_ + 5, hy_ - 4, True), (hx_ + 8, hy_ + 2, False)], V_GLOW)
    return c


# ================================================================ 4. ROI GROMBAR

G_BLK = ['#0a0810', '#18151f', '#28243a', '#423d58', '#6e6890']
G_GOLD = ['#6a3010', '#b06818', '#e8a830', '#ffd860', '#fff6c0']
G_RUNE = ['#c83a0a', '#ff8a1a', '#ffd04a', '#fff6c0']
G_BEARD = ['#3a0806', '#741408', '#b02810', '#e0501e', '#ff9040']
G_ERM = ['#7a7a96', '#b8b8cc', '#e4e4f0', '#ffffff']
G_CAPE = ['#2e0610', '#5a0c1c', '#901628', '#c8283a', '#f05a5a']
G_SKIN = ['#8a4a44', '#d08672', '#f6b89a', '#ffdcc4']
G_RUBY = ['#5a0614', '#c0182c', '#ff5a6a', '#ffd0d8']
G_IRIS = ['#0a3a6a', '#2a8ae0', '#bfe8ff']
G_EMBER = ['#fff09a', '#ff8a1a']


def rune(c, x, y, kind, col, hi):
    """Petit glyphe runique 3×4 lumineux."""
    pats = {
        0: ((0, 0), (0, 1), (0, 2), (0, 3), (1, 0), (2, 1), (1, 2)),          # ᚱ
        1: ((1, 0), (1, 1), (1, 2), (1, 3), (0, 1), (2, 1), (0, 2), (2, 2)),  # ᛉ approx.
        2: ((1, 0), (0, 1), (2, 1), (1, 2), (0, 3), (2, 3)),                  # ᛟ
    }
    for i, (dx, dy) in enumerate(pats[kind % 3]):
        c.setf(x + dx, y + dy, hi if i == 0 else col)


def grombar_cape(c, P):
    tx, ty, sw = P.tx, P.ty, P.sw
    ph = P.ph * 1.7
    left = []
    for y in range(24, 46):
        u = (y - 24) / 21
        x = 12 - 7.5 * math.sin(u * math.pi / 2) ** 0.8 + 1.0 * math.sin(y * 0.5 + ph) * u + sw * 0.9 * u
        left.append((x + tx * (1 - u), y))
    x0 = left[-1][0]
    hem = [(x, 45.6 + 1.1 * math.sin(x * 0.75 - ph)) for x in [x0 + i for i in range(0, 22)] if x <= 22]
    pts = [(14 + tx, 23 + ty), (24 + tx, 23 + ty), (24 + tx, 34 + ty), (22, 43)] + hem[::-1] + left[::-1]
    p = new()
    spoly(p, pts, G_CAPE, contrast=0.4)
    for i, fx in enumerate((4.5, 9, 13.5, 18)):
        txx = fx + 1.0 * math.sin(fx * 0.75 - ph) + sw * 0.4
        y1 = 45 + 1.1 * math.sin(fx * 0.75 - ph) - 1
        xs = 12 + i * 1.6 + tx
        p.line(xs, 28 + ty, txx, y1, G_CAPE[1])
        p.line(xs + 1, 29 + ty, txx + 1, y1, G_CAPE[0] if i % 2 else G_CAPE[1])
        p.line(xs - 1, 30 + ty, txx - 1, y1 - 1, G_CAPE[3])
    # galon doré + doublure d'hermine à l'ourlet
    for x in range(-2, 26):
        for y in range(47, 26, -1):
            if p.get(x, y) is not None:
                p.set(x, y, G_GOLD[2] if x % 4 else G_GOLD[3])
                p.setf(x, y - 1, G_GOLD[1])
                break
    for y in range(26, 47):
        for x in range(-4, 24):
            if p.get(x, y) is not None:
                if p.get(x - 1, y) is None:
                    p.set(x, y, G_GOLD[2])
                break
    stamp(c, p)


def grombar_head(c, P):
    hx, hy, sw = P.hx, P.hy, P.sw
    bsw = sw * 0.4
    # masse de cheveux roux sous la couronne + mèches de nuque
    hb = new()
    ball(hb, hx - 1.4, hy - 0.6, 8.0, 7.6, G_BEARD)
    stamp(c, hb)
    lock(c, [(hx - 6, hy - 1), (hx - 9, hy + 3), (hx - 9 + bsw, hy + 7)], [3.6, 3.2, 1.0], G_BEARD)
    # visage
    face = new()
    fcx, fcy, frx, fry = hx + 2.6, hy + 0.6, 6.5, 5.9
    for y in range(H):
        for x in range(W):
            dx, dy = (x + 0.5 - fcx) / frx, (y + 0.5 - fcy) / fry
            d = dx * dx + dy * dy
            if d <= 1:
                face.set(x, y, G_SKIN[1] if (d > 0.55 and (dx * 0.5 + dy) > 0.45) else G_SKIN[2])
    stamp(c, face)
    t = new()
    t.ellipse(hx - 2.2, hy + 1.5, 1.5, 2.0, G_SKIN[2])
    t.setf(hx - 2, hy + 1.5, G_SKIN[1]); t.setf(hx - 2, hy + 2.5, G_SKIN[0])
    stamp(c, t)
    # yeux : petits, vifs, sous des sourcils broussailleux
    ey = int(hy)
    eyes = (int(hx + 3.5), int(hx + 7.5))
    for ex in eyes:
        c.set(ex, ey, OUT); c.set(ex + 1, ey, OUT)
        c.set(ex, ey + 1, OUT); c.set(ex + 1, ey + 1, G_IRIS[1])
        c.set(ex + 1, ey, WHITE if ex == eyes[0] else OUT)
    if P.expr == 'hurt':
        for ex in eyes:
            for dx in (0, 1):
                c.set(ex + dx, ey, G_SKIN[2]); c.set(ex + dx, ey + 1, G_SKIN[2])
        c.set(eyes[0], ey, OUT); c.set(eyes[0] + 1, ey + 1, OUT)
        c.set(eyes[1] + 1, ey, OUT); c.set(eyes[1], ey + 1, OUT)
    elif P.expr == 'joy':
        for ex in eyes:
            c.set(ex, ey, G_SKIN[2]); c.set(ex + 1, ey, G_SKIN[2])
            c.set(ex, ey + 1, OUT); c.set(ex + 1, ey + 1, OUT)
    elif P.expr == 'focus':
        c.set(eyes[0], ey, G_SKIN[2]); c.set(eyes[0] + 1, ey, G_SKIN[2])
    elif P.expr in ('shout', 'fierce'):
        c.set(eyes[1] + 1, ey + 1, G_RUNE[2])  # regard de braise
        c.set(eyes[0] + 1, ey + 1, G_RUNE[1])
    t = new()
    if P.expr in ('shout', 'fierce'):
        t.line(hx + 2, hy - 2.2, hx + 5.5, hy - 1.0, G_BEARD[2], width=1.6)
        t.line(hx + 7, hy - 1.0, hx + 9.5, hy - 2.2, G_BEARD[2], width=1.6)
    else:
        t.line(hx + 2, hy - 1.4, hx + 5.5, hy - 1.8, G_BEARD[2], width=1.6)
        t.line(hx + 7, hy - 1.8, hx + 9.5, hy - 1.4, G_BEARD[2], width=1.6)
    for x in range(int(hx + 2), int(hx + 10)):
        if t.get(x, int(hy - 2)) is not None:
            t.set(x, int(hy - 2), G_BEARD[3])
    stamp(c, t, G_BEARD[0])
    # barbe immense
    bm = mask_of(lambda t: t.poly([(hx - 3, hy + 2), (hx - 0.5, hy + 4), (hx + 3, hy + 4), (hx + 8, hy + 4.5), (hx + 11, hy + 4),
                                    (hx + 11.5, hy + 8), (hx + 10 + bsw * 0.5, hy + 11.5), (hx + 7 + bsw, hy + 14),
                                    (hx + 2.5 + bsw, hy + 14.5), (hx - 1 + bsw * 0.5, hy + 12.5), (hx - 3.5, hy + 7.5)], '#000'))
    p = new()
    for (x, y) in bm:
        v = 0.44 - (x - hx - 4) * 0.03 - (y - hy - 8) * 0.04 + 0.2 * math.sin((x + 0.5) * 1.9 + (y + 0.5) * 0.7)
        if (x - 1, y) not in bm or (x, y - 1) not in bm:
            v += 0.18
        if (x + 1, y) not in bm or (x, y + 1) not in bm:
            v -= 0.25
        p.set(x, y, G_BEARD[max(0, min(4, int(v * 5)))])
    stamp(c, p)
    # deux grosses nattes à anneaux d'or
    for (bx, by0, drift) in ((hx + 2.5 + bsw, hy + 12.5, bsw * 1.2), (hx + 7.5 + bsw, hy + 12, bsw * 1.4)):
        p = new()
        n = 5
        for i in range(n):
            xx = bx + drift * i / n + (0.6 if i % 2 else -0.6)
            ball(p, xx, by0 + i * 1.8, 2.3 - i * 0.12, 1.5, G_BEARD)
        stamp(c, p)
        r = new()
        ry_ = by0 + 2.6 * 1.8
        rx_ = bx + drift * 0.55
        r.rect(int(rx_ - 2), int(ry_), 4, 2, G_GOLD[2])
        r.set(int(rx_ - 2), int(ry_), G_GOLD[4]); r.set(int(rx_ - 1), int(ry_), G_GOLD[3]); r.set(int(rx_ + 1), int(ry_ + 1), G_GOLD[1])
        tip_y = by0 + (n - 1) * 1.8 + 1.6
        tx_ = bx + drift
        r.ellipse(tx_, tip_y + 0.6, 1.4, 1.4, G_BEARD[3])
        r.set(tx_ - 1, tip_y, G_BEARD[4])
        stamp(c, r)
    # nez rond
    t = new()
    t.shaded_ellipse(hx + 9.6, hy + 2.6, 1.7, 1.5, G_SKIN)
    t.set(hx + 9, hy + 2, G_SKIN[3])
    stamp(c, t, G_SKIN[0])
    c.set(hx + 3, ey + 3, '#e86a5a'); c.set(hx + 4, ey + 3, '#e86a5a')
    # moustache tombante
    t = new()
    t.ellipse(hx + 6.0, hy + 5.0, 3.4, 1.4, G_BEARD[3])
    t.ellipse(hx + 10.5, hy + 5.0, 1.8, 1.3, G_BEARD[3])
    t.line(hx + 3, hy + 5.5, hx + 2, hy + 8, G_BEARD[3], width=1.6)
    t.line(hx + 11.5, hy + 5.5, hx + 12, hy + 8, G_BEARD[3], width=1.4)
    for x in range(int(hx + 3), int(hx + 13)):
        t.setf(x, hy + 4.0, G_BEARD[4])
        t.setf(x, hy + 6.0, G_BEARD[2])
    stamp(c, t, OUT)
    if P.expr in ('shout', 'joy', 'hurt'):
        c.set(hx + 6, hy + 7, OUT); c.set(hx + 7, hy + 7, OUT); c.set(hx + 8, hy + 7, OUT)
        c.set(hx + 6, hy + 8, MOUTH); c.set(hx + 7, hy + 8, '#e0506a'); c.set(hx + 8, hy + 8, OUT)
        if P.expr != 'hurt':
            c.set(hx + 6, hy + 7, WHITE); c.set(hx + 7, hy + 7, WHITE)
    # couronne d'or massive : bandeau, 3 grands fleurons et 2 petits, gemmes
    t = new()
    band = [(hx - 8, hy - 5.2), (hx + 9, hy - 6.6), (hx + 9.2, hy - 3.6), (hx - 8, hy - 2.4)]
    spoly(t, band, G_GOLD, contrast=0.5)
    for (dx, hgt, wd) in ((-5, 4.5, 2.0), (0.5, 6.0, 2.2), (6, 4.5, 2.0), (-2.2, 2.4, 1.2), (3.3, 2.4, 1.2)):
        xb = hx + dx
        yb = hy - 5.2 - (dx + 8) / 17 * 1.4
        spoly(t, [(xb - wd, yb + 0.6), (xb - wd * 0.5, yb - hgt * 0.55), (xb, yb - hgt), (xb + wd * 0.5, yb - hgt * 0.55), (xb + wd, yb + 0.6)],
              G_GOLD, contrast=0.6)
        if hgt > 3:
            t.ellipse(xb, yb - hgt - 0.3, 1.0, 1.0, G_GOLD[3])
    for x in range(int(hx - 8), int(hx + 10)):
        t.setf(x, hy - 5.2 - (x - hx + 8) / 17 * 1.4, G_GOLD[4] if x < hx else G_GOLD[3])
    stamp(c, t, OUT)
    for (dx, col) in ((-5, G_RUBY), (0.5, ['#0a2a6a', '#1a6ae8', '#7ac8ff', '#e0f4ff']), (6, G_RUBY)):
        x = hx + dx
        y = hy - 4.6 - (dx + 8) / 17 * 1.4
        c.set(x - 0.5, y, col[2]); c.set(x + 0.5, y, col[1])
        c.set(x - 0.5, y + 1, col[1]); c.set(x + 0.5, y + 1, col[0])
    tip = (hx + 0.5, hy - 5.2 - 8.5 / 17 * 1.4 - 6.3)
    c.set(tip[0], tip[1], G_RUBY[2])


def grombar(P):
    c = new()
    tx, ty, hx, hy, sw = P.tx, P.ty, P.hx, P.hy, P.sw
    emb = [[(4, 18), (41, 30), (8, 6), (44, 12)], [(5, 15), (42, 27), (10, 4), (45, 9)],
           [(3, 20), (43, 33), (7, 9), (42, 15)], [(6, 13), (40, 26), (11, 7), (46, 18)]][P.ph]
    for (x, y) in emb:
        c.set(x, y, G_EMBER[0]); c.set(x, y + 1, G_EMBER[1])
    grombar_cape(c, P)
    if P.back not in FRONT_BACK:
        s, e, h = back_arm_pts(P)
        arm(c, s, e, h, G_BLK[1:4], G_BLK[1:5], far=True, cuff=(G_GOLD[1], G_GOLD[2]), width=4.2, hand_r=2.3)
    # jambes courtes et épaisses : grèves noires, genouillères d'or, gros solerets
    hip_off = tx * 0.5
    for (hip, fx, lift, far) in (((17.5 + hip_off, 39), 17 + P.bdx, P.blift, True), ((23.5 + hip_off, 39), 23 + P.fdx, P.flift, False)):
        leg(c, hip, fx, lift, G_BLK[1:4], G_BLK, far, width=4.6, boot_r=(3.8, 2.9))
        fy = GROUND - lift
        kx = hip[0] + (fx + 0.5 - hip[0]) * 0.4
        c.set(kx - 1, 42 - lift // 2, G_GOLD[2 if far else 3]); c.set(kx, 42 - lift // 2, G_GOLD[1 if far else 2])
        c.setf(fx + 3, fy - 1, G_GOLD[2 if not far else 1])
    # braconnière : lames noires à bord doré, runes
    t = new()
    for i, y in enumerate((33, 35.5, 38)):
        spoly(t, [(13 - i * 0.7 + tx, y + ty), (29 + i * 0.7 + tx, y + ty), (29.5 + i * 0.7 + tx, y + 2.5 + ty), (12.5 - i * 0.7 + tx, y + 2.5 + ty)],
              G_BLK, contrast=0.4)
        for x in range(11, 33):
            if t.get(x + tx, int(y + 2) + ty) is not None and t.get(x + tx, int(y + 3) + ty) is None:
                t.set(x + tx, int(y + 2) + ty, (G_GOLD[2] if x < 22 else G_GOLD[1]) if i == 2 else G_BLK[0])
            if t.get(x + tx, int(y) + ty) is not None and i > 0:
                t.set(x + tx, int(y) + ty, G_BLK[3] if x < 22 else G_BLK[2])
    stamp(c, t)
    t = new()
    for (x, k) in ((16, 1), (25, 2)):
        rune(c, x + tx, 36 + ty, k, G_RUNE[1], G_RUNE[2])
    # plastron noir massif, filets d'or
    t = new()
    ball(t, 21 + tx, 29 + ty, 8.2, 6.2, G_BLK)
    for y in range(23, 35):
        for x in range(12, 31):
            v = t.get(x + tx, y + ty)
            if v is not None and (t.get(x + tx - 1, y + ty) is None or t.get(x + tx + 1, y + ty) is None):
                t.set(x + tx, y + ty, G_GOLD[2] if x < 21 else G_GOLD[1])
    rune(t, 14 + tx, 25 + ty, 2, G_RUNE[1], G_RUNE[2])
    rune(t, 14 + tx, 30 + ty, 1, G_RUNE[1], G_RUNE[2])
    stamp(c, t)
    # ceinture d'or à boucle-enclume, rune ardente
    t = new()
    spoly(t, [(12 + tx, 32 + ty), (30 + tx, 32 + ty), (30 + tx, 35 + ty), (12 + tx, 35 + ty)], G_GOLD, contrast=0.4)
    for x in range(12, 31):
        t.setf(x + tx, 32 + ty, G_GOLD[3]); t.setf(x + tx, 35 + ty, G_GOLD[0])
    spoly(t, [(23 + tx, 31 + ty), (29 + tx, 31 + ty), (29 + tx, 36 + ty), (23 + tx, 36 + ty)], G_BLK, contrast=0.3)
    stamp(c, t)
    t = new()
    for x in range(24, 29):
        t.set(x + tx, 32 + ty, G_GOLD[3] if x < 26 else G_GOLD[2])
    t.set(25 + tx, 33 + ty, G_GOLD[2]); t.set(26 + tx, 33 + ty, G_GOLD[2]); t.set(26 + tx, 34 + ty, G_GOLD[1])
    t.set(24 + tx, 34 + ty, G_GOLD[1]); t.set(25 + tx, 34 + ty, G_GOLD[2]); t.set(27 + tx, 34 + ty, G_GOLD[1]); t.set(28 + tx, 34 + ty, G_GOLD[1])
    stamp(c, t, None)
    c.set(26 + tx, 33 + ty, G_RUNE[[2, 3, 2, 1][P.ph]])
    # col d'hermine
    t = new()
    for i, x in enumerate(range(12, 31, 3)):
        ball(t, x + tx + 0.5, 24.2 + ty + (0.5 if i % 2 else 0), 2.4, 2.0, [G_ERM[0], G_ERM[1], G_ERM[2], G_ERM[3], G_ERM[3]])
    for (x, y) in ((14, 25), (20, 24), (26, 25)):
        t.setf(x + tx, y + ty, OUT); t.setf(x + tx, y + 1 + ty, OUT)
    stamp(c, t)
    if P.back in FRONT_BACK:
        s, e, h = back_arm_pts(P, dy=0)
        arm(c, s, e, h, G_BLK[1:4], G_BLK[1:5], far=True, cuff=(G_GOLD[1], G_GOLD[2]), width=4.2, hand_r=2.3)
    # bras d'arme : brassard noir, manchette d'or, gantelet
    s, e, h = front_arm_pts(P)
    arm(c, s, e, h, G_BLK[1:4], G_BLK[1:5], cuff=(G_GOLD[1], G_GOLD[3]), width=4.4, hand_r=2.4)
    c.set(h[0] + 1, h[1] - 1, G_GOLD[3])
    # épaulière colossale à deux lames, bord d'or, rune
    t = new()
    ball(t, 28.2 + tx, 27.8 + ty, 4.8, 3.6, G_BLK)
    for x in range(22, 35):
        t.setf(x + tx, 30 + ty, G_GOLD[2]); t.setf(x + tx, 31 + ty, G_GOLD[1])
    stamp(c, t)
    t = new()
    ball(t, 27.8 + tx, 25.6 + ty, 4.4, 3.0, G_BLK)
    for x in range(21, 34):
        if t.get(x + tx, 26 + ty) is not None and t.get(x + tx, 27 + ty) is None:
            t.set(x + tx, 26 + ty, G_GOLD[2])
    rune(t, 28 + tx, 23 + ty, 2, G_RUNE[1], G_RUNE[2])
    t.setf(25 + tx, 24 + ty, G_BLK[4]); t.setf(26 + tx, 23 + ty, G_BLK[4])
    stamp(c, t)
    grombar_head(c, P)
    if h[1] < 31:  # bras levé : passe devant la barbe (sans recouvrir l'épaulière)
        m0 = (s[0] + (e[0] - s[0]) * 0.55, s[1] + (e[1] - s[1]) * 0.55)
        arm(c, m0, e, h, G_BLK[1:4], G_BLK[1:5], cuff=(G_GOLD[1], G_GOLD[3]), width=4.4, hand_r=2.4)
    # gantelet (au-dessus de la barbe : la prise de l'arme reste visible)
    g = new()
    g.shaded_ellipse(h[0] + 0.5, h[1] + 0.5, 2.4, 2.3, G_BLK[1:5])
    g.set(h[0] + 1, h[1] - 1, G_GOLD[3]); g.set(h[0], h[1] - 1, G_GOLD[2])
    stamp(c, g)
    if P.name in ('cast', 'attack2', 'shoot', 'victory'):
        hx_, hy_ = P.hand
        for (x, y) in ((hx_ + 5, hy_ - 3), (hx_ + 8, hy_ + 2), (hx_ + 3, hy_ + 5), (hx_ - 3, hy_ - 5)):
            c.set(x, y, G_EMBER[0]); c.set(x, y + 1, G_EMBER[1])
    return c


# ---------------------------------------------------------------- export

DRAW = {'fairy': fairy, 'demoness': demoness, 'valkyrie': valkyrie, 'grombar': grombar}
ICON_BOX = {'fairy': (13, 3), 'demoness': (13, 0), 'valkyrie': (13, 3), 'grombar': (12, 4)}  # coin haut-gauche (repère idle)


def frames(sid):
    """{pose: (PadCanvas, Pose)} pour un skin."""
    fn = DRAW[sid]
    return {name: (fn(Pose(name)), Pose(name)) for name in ORDER}


def build():
    out = {}
    for sid in SKINS:
        fr = frames(sid)
        top = 0
        for cv, _ in fr.values():
            x0, y0, x1, y1 = cv.bounds()
            top = max(top, cv.pad - y0)
        for name, (cv, P) in fr.items():
            extra = P.extra()
            extra['oy'] = -top
            out[f'skin_{sid}_{name}'] = (cv.crop_box((0, -top, W - 1, H - 1)), extra)
        ix, iy = ICON_BOX[sid]
        out[f'skin_{sid}_icon'] = (fr['idle'][0].crop_box((ix, iy, ix + 23, iy + 23)), {})
    return out


# ---------------------------------------------------------------- planche de contrôle

def preview_sheet(path):
    from PIL import Image
    from lib import hex2rgb, preview_color
    sprites = build()
    sword, grip = knight.framed(*knight.weapon_sword())
    S = 4
    cell_w, cell_h = 64, 72
    cols = len(ORDER) + 1
    img = Image.new('RGBA', (cell_w * S * cols, cell_h * S * len(SKINS) + 70 * len(SKINS)), (58, 74, 94, 255))

    def put(cv, ox, oy, scale):
        for y in range(cv.h):
            for x in range(cv.w):
                v = preview_color(cv.px[y][x])
                if v is None:
                    continue
                rgb = hex2rgb(v) + (255,)
                for yy in range(scale):
                    for xx in range(scale):
                        X, Y = ox + x * scale + xx, oy + y * scale + yy
                        if 0 <= X < img.width and 0 <= Y < img.height:
                            img.putpixel((X, Y), rgb)

    def rotated(cv, g, turns):
        for _ in range(turns):
            n = knight.Canvas(cv.h, cv.w)
            for y in range(cv.h):
                for x in range(cv.w):
                    n.px[x][cv.h - 1 - y] = cv.px[y][x]
            g = (cv.h - 1 - g[1], g[0])
            cv = n
        return cv, g

    row_h = cell_h * S + 70
    for r, sid in enumerate(SKINS):
        for i, name in enumerate(ORDER):
            cv, ex = sprites[f'skin_{sid}_{name}']
            ox = i * cell_w * S + 8 * S
            base_y = r * row_h + 20 * S  # y=0 du repère 48×48
            put(cv, ox, base_y + ex['oy'] * S, S)
            wc, wg = rotated(sword, grip, ex['rot'] // 90)
            put(wc, ox + (ex['hand']['x'] - wg[0]) * S, base_y + (ex['hand']['y'] - wg[1]) * S, S)
            # aperçu 1×
            put(cv, ox, r * row_h + cell_h * S + 4 + ex['oy'], 1)
            put(wc, ox + ex['hand']['x'] - wg[0], r * row_h + cell_h * S + 4 + ex['hand']['y'] - wg[1], 1)
        icon, _ = sprites[f'skin_{sid}_icon']
        put(icon, len(ORDER) * cell_w * S + 4 * S, r * row_h + 20 * S, S)
        put(icon, len(ORDER) * cell_w * S + 4 * S, r * row_h + cell_h * S + 4, 1)
    img.save(path)


if __name__ == '__main__':
    import os
    preview_sheet(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'preview_skins_a.png'))
