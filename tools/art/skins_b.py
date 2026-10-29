"""Skins de héros (lot B) : Vampire, Ninja, Sorcière, Séraphin.

Chaque skin REMPLACE le corps du chevalier (tête, coiffure, tenue et accessoires compris) ;
seule l'arme équipée est dessinée par-dessus, sa poignée posée sur `hand` et tournée de `rot`.

Contrat (build) : pour chaque id de SKINS,
  skin_<id>_<pose>  : 14 poses = les 12 de knight.POSES + 'aim' (arc bandé) + 'shoot' (corde lâchée)
                      48 px de large, pieds sur la dernière ligne, ancre des pieds vers x≈20, face à droite ;
                      extra {'hand', 'rot', 'head', 'torso', 'oy'} (hand / rot / head / torso repris du
                      chevalier ; oy <= 0 : le calque est plus haut que 48 px quand chapeau, ailes ou
                      auréole dépassent, et se dessine remonté de -oy comme helmet_default).
  skin_<id>_icon    : portrait 24×24 (tête et épaules) pour les menus.
Couleurs hexadécimales fixes uniquement (pas de calques teintables).
"""
import math

from lib import Canvas
import knight
from knight import ball, limb, spine_fill
from allies_ssr import (new, stamp, lock, head, shade, spoly, mask_of, sparkle, elbow_of, rot,
                        GOLD, WHITE, OUT, BLUSH)

W, H = 48, 48
SKINS = ('vampire', 'ninja', 'witch', 'seraph')

# ---------------------------------------------------------------- poses

# (torse, tête, pied arrière (dx, levée), pied avant, main, rot, bras arrière) : knight.POSES + arc
POSES = dict(knight.POSES)
POSES['aim'] = ((0, 0), (0, 0), (-3, 0), (3, 0), (33, 29), 0, 'draw')
POSES['shoot'] = ((-1, 0), (-1, 0), (-3, 0), (3, 0), (32, 29), 0, 'release')
ORDER = ('idle', 'idle2', 'walk1', 'walk2', 'walk3', 'walk4', 'attack1', 'attack2', 'attack3',
         'cast', 'hurt', 'victory', 'aim', 'shoot')

# phase d'ondulation (cheveux, cape, écharpe, ailes) et force du vent de chaque pose
PHASE = {'idle': 0.0, 'idle2': 1.6, 'walk1': 0.0, 'walk2': 1.6, 'walk3': 3.2, 'walk4': 4.8,
         'attack1': 1.0, 'attack2': 2.6, 'attack3': 4.2, 'cast': 2.0, 'hurt': 3.6, 'victory': 5.0,
         'aim': 0.8, 'shoot': 2.4}
WIND = {'idle': 0.25, 'idle2': 0.4, 'walk1': 0.9, 'walk2': 1.0, 'walk3': 0.9, 'walk4': 1.0,
        'attack1': 0.5, 'attack2': 1.3, 'attack3': 1.1, 'cast': 0.8, 'hurt': 1.0, 'victory': 0.7,
        'aim': 0.4, 'shoot': 0.8}
# battement d'ailes (degrés, + = vers le haut / l'arrière)
FLAP = {'idle': 0, 'idle2': 5, 'walk1': -3, 'walk2': 4, 'walk3': -3, 'walk4': 4,
        'attack1': 12, 'attack2': -10, 'attack3': -6, 'cast': 6, 'hurt': -12, 'victory': 16,
        'aim': 2, 'shoot': -4}


class Ctx:
    def __init__(self, pose, icon=False):
        (self.tx, self.ty), (hx, hy), (self.bdx, self.blift), (self.fdx, self.flift), hand, self.rot, self.back = POSES[pose]
        self.pose = pose
        self.hand = hand
        self.hox, self.hoy = hx, hy
        self.hx, self.hy = 21.5 + hx, 15.5 + hy
        self.ph = PHASE[pose]
        self.wind = WIND[pose]
        self.flap = FLAP[pose]
        self.icon = icon
        self.k = ORDER.index(pose)

    def extra(self):
        return {'hand': {'x': self.hand[0], 'y': self.hand[1]}, 'rot': self.rot,
                'head': {'x': self.hox, 'y': self.hoy}, 'torso': {'x': self.tx, 'y': self.ty}}


def far3(R):
    return [R[0], R[0], R[1]]


# ---------------------------------------------------------------- pièces communes

def legs(c, x, pants, boot, hip_y=37, toe=None, wraps=None):
    """Jambes (lointaine plus sombre) et bottes arrondies vers l'avant, levée du pied par pose.
    toe : couleur d'une pointe recourbée (sorcière) ; wraps : bandes molletières (ninja)."""
    for hip_x, foot_x, lift, far in ((17.5 + x.tx * 0.5, 17 + x.bdx, x.blift, True),
                                     (23.5 + x.tx * 0.5, 23 + x.fdx, x.flift, False)):
        p = new()
        rr = far3(pants) if far else pants
        fy = 47 - lift
        limb(p, [(hip_x, hip_y), (foot_x + 0.5, fy - 4)], 3.6, rr)
        if wraps:
            for yy in range(int(fy - 9), int(fy - 3), 2):
                for xx in range(int(foot_x - 2), int(foot_x + 4)):
                    if p.get(xx, yy) is not None:
                        p.set(xx, yy, wraps[0] if far else wraps[1])
        bt = boot if not far else [boot[0], boot[0], boot[1], boot[1], boot[2]]
        ball(p, foot_x + 1.0, fy - 2.4, 3.2, 2.6, bt)
        for xx in range(foot_x - 2, foot_x + 5):
            for yy in (fy - 1, fy):
                if p.get(xx, yy) is not None or (xx <= foot_x + 3 and yy == fy and xx >= foot_x - 1):
                    p.set(xx, yy, bt[1] if yy == fy - 1 else bt[0])
        p.set(foot_x - 1, fy - 4, bt[3]); p.set(foot_x, fy - 4, bt[4] if not far else bt[3])
        if toe:
            p.set(foot_x + 4, fy - 1, toe if not far else bt[1]); p.set(foot_x + 5, fy - 2, toe if not far else bt[1])
            p.set(foot_x + 5, fy - 1, bt[0])
        stamp(c, p)


def arm(c, shoulder, elbow, hand, R3, hand_cols, cuff=None, far=False, hand_r=2.0, bell=None, width=3.4):
    """Bras : manche ombrée, manchette (ou manche évasée `bell`), main posée exactement sur `hand`."""
    p = new()
    rr = far3(R3) if far else R3
    limb(p, [shoulder, elbow, hand], width, rr)
    mx = hand[0] + (elbow[0] - hand[0]) * 0.45
    my = hand[1] + (elbow[1] - hand[1]) * 0.45
    if bell:
        b = bell if not far else [bell[0], bell[0], bell[1], bell[1]]
        bx = hand[0] + (elbow[0] - hand[0]) * 0.32
        by = hand[1] + (elbow[1] - hand[1]) * 0.32
        p.ellipse(bx, by + 0.8, 2.6, 2.4, b[1])
        p.ellipse(bx - 0.4, by + 0.3, 1.8, 1.6, b[2])
        p.set(bx + 1, by + 2, b[0]); p.set(bx, by + 2.6, b[3])
    elif cuff:
        p.ellipse(mx, my, 1.6, 1.6, cuff[0] if far else cuff[1])
    p.shaded_ellipse(hand[0] + 0.5, hand[1] + 0.5, hand_r, hand_r * 0.95, hand_cols[:3] if far else hand_cols)
    stamp(c, p)


def back_arm_behind(c, x, R3, hand_cols, **kw):
    """Bras lointain dessiné derrière le buste (modes low / back / flail / hip / release)."""
    tx, ty = x.tx, x.ty
    sh = (16 + tx, 27 + ty)
    m = x.back
    if m == 'low':
        sway = {'walk1': 2, 'walk3': -2}.get(x.pose, 0)
        arm(c, sh, (13 + tx + sway * 0.5, 31 + ty), (13 + tx + sway, 34 + ty), R3, hand_cols, far=True, **kw)
    elif m == 'back':
        arm(c, sh, (11 + tx, 30 + ty), (9 + tx, 32 + ty), R3, hand_cols, far=True, **kw)
    elif m == 'flail':
        arm(c, sh, (11 + tx, 25 + ty), (9 + tx, 22 + ty), R3, hand_cols, far=True, **kw)
    elif m == 'hip':
        arm(c, sh, (11 + tx, 30 + ty), (14 + tx, 33 + ty), R3, hand_cols, far=True, **kw)
    elif m == 'release':
        arm(c, sh, (12 + tx, 26 + ty), (9 + tx, 24 + ty), R3, hand_cols, far=True, **kw)


def back_arm_front(c, x, R3, hand_cols, **kw):
    """Bras lointain passant devant le buste (cast : tendu vers l'avant ; aim : corde tirée à la poitrine)."""
    tx, ty = x.tx, x.ty
    if x.back == 'forward':
        arm(c, (19 + tx, 28 + ty), (25 + tx, 31 + ty), (30 + tx, 31 + ty), R3, hand_cols, far=True, **kw)
    elif x.back == 'draw':
        arm(c, (17 + tx, 27 + ty), (13 + tx, 28 + ty), (22 + tx, 28 + ty), R3, hand_cols, far=True, **kw)


def front_arm(c, x, R3, hand_cols, **kw):
    s = (27 + x.tx, 28 + x.ty)
    hand = x.hand
    if x.back in ('draw', 'release'):  # bras d'arc tendu à hauteur d'épaule
        el = (s[0] + (hand[0] - s[0]) * 0.5, s[1] + (hand[1] - s[1]) * 0.5 + 0.4)
    else:
        el = elbow_of(s, hand)
    arm(c, s, el, hand, R3, hand_cols, **kw)


def bat(c, x, y, flap, body='#3a2050', wing='#5a3478', eye='#ff4a4a'):
    """Chauve-souris de 7×4 px."""
    p = new()
    p.set(x, y, body); p.set(x + 1, y, body); p.set(x, y + 1, body); p.set(x + 1, y + 1, body)
    p.set(x, y - 1, body); p.set(x + 1, y - 1, body)  # oreilles (contour en V)
    if flap == 0:
        for dx, dy in ((-1, 0), (-2, -1), (-3, -1), (-3, 0), (2, 0), (3, -1), (4, -1), (4, 0)):
            p.set(x + dx, y + dy, wing)
    else:
        for dx, dy in ((-1, 0), (-2, 1), (-3, 1), (-2, 0), (2, 0), (3, 1), (4, 1), (3, 0)):
            p.set(x + dx, y + dy, wing)
    stamp(c, p)
    c.set(x + 1, y, eye)


def star(c, x, y, cols, big=False):
    c.set(x, y, cols[0])
    if big:
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            c.set(x + dx, y + dy, cols[1])


def face_set(c, x, skin):
    """Pixels de peau du visage (pour masques, oreilles)."""
    out = set()
    for y in range(int(x.hy - 8), int(x.hy + 9)):
        for xx in range(int(x.hx - 8), int(x.hx + 12)):
            if c.get(xx, y) in skin:
                out.add((xx, y))
    return out


# ================================================================ 1. Vampire

V_SKIN = ['#6e5c8a', '#b4a6cc', '#e6e0f0', '#faf6ff']
V_HAIR = ['#07060e', '#141024', '#231c3a', '#3a3060', '#6a5c9a']
V_IRIS = ['#3e020c', '#d01c2c', '#ff8a7a']
V_BLACK = ['#0a0812', '#161226', '#241e3a', '#383054', '#5a5080']
V_COAT = ['#120a1c', '#22142e', '#342044', '#4c3062', '#6e4c8c']
V_RED = ['#2e040c', '#64091a', '#a01428', '#d82e3e', '#ff7a72']
V_VEST = ['#2a0612', '#4e0c1e', '#7a1428', '#a82a38', '#d65a5a']
V_SHIRT = ['#7c78a0', '#c4c2dc', '#eeecf8', '#ffffff']
V_PANTS = ['#16121f', '#282238', '#3c3452']
V_BOOT = ['#0a0810', '#181426', '#2a243c', '#4a4268', '#a49cd0']
V_HAND = ['#5a4a78', '#9a8cb8', '#d4cce4', '#eee8f6']
V_MIST = ['#4a0614', '#8a1020', '#c82434', '#ff6a6a']


def vamp_cape(c, x):
    tx, ty, ph, wd = x.tx, x.ty, x.ph, x.wind
    left = []
    for y in range(23, 45):
        u = (y - 23) / 21
        xx = 13 + tx - (6.5 + 2.6 * wd) * u ** 0.8 + 1.3 * math.sin(y * 0.45 + ph) * u
        left.append((max(1.2, xx), y))
    x0 = left[-1][0]
    hem = []
    for i in range(0, 30):
        xx = x0 + i
        if xx > 24 + tx:
            break
        hem.append((xx, 44.5 + 1.4 * math.sin(xx * 0.7 - ph * 1.3) * (1 - i / 34)))
    pts = [(14 + tx, 22 + ty), (20 + tx, 22 + ty), (23 + tx, 30 + ty), (24.5 + tx, 38)] + hem[::-1] + left[::-1]
    m = mask_of(lambda t: t.poly(pts, '#000'))
    p = new()
    xs = {}
    for (px, py) in m:
        xs.setdefault(py, []).append(px)
    # intérieur cramoisi tourné vers nous, bord extérieur noir retourné côté vent
    for (px, py) in m:
        row = xs[py]
        lo, hi = min(row), max(row)
        d = px - lo
        u = (py - 22) / 23
        band = 2 + int(1.6 * u + 0.8 * math.sin(py * 0.5 + ph))
        if d < band:
            col = V_BLACK[4] if d == 0 else V_BLACK[3] if d == 1 else V_BLACK[2]
        else:
            t = (px - lo - band) / max(1, hi - lo - band)
            col = V_RED[3] if t < 0.3 else V_RED[2] if t < 0.75 else V_RED[1]
            if py < 26 + ty:
                col = V_RED[1]
        p.set(px, py, col)
    # plis en éventail depuis l'épaule (creux sombre + arête claire)
    for i, fx in enumerate((6.5, 11.5, 16.5)):
        f = max(4.0, fx - wd * (3 - i) + tx)
        y1 = 44 + 1.4 * math.sin(f * 0.7 - ph * 1.3) - 1
        p.line(15 + i * 2 + tx, 28 + ty, f, y1, V_RED[0])
        p.line(14 + i * 2 + tx, 29 + ty, f - 1, y1 - 1, V_RED[3])
    for (px, py) in m:
        if (px - 1, py) not in m or (px - 2, py) not in m:
            if p.get(px, py) in (V_RED[0], V_RED[3]):
                p.set(px, py, V_BLACK[3])
    # ourlet : liseré noir ondulant
    for px in range(0, 26 + tx):
        col_y = [py for (qx, py) in m if qx == px]
        if not col_y:
            continue
        by = max(col_y)
        p.set(px, by, V_BLACK[1])
        if math.sin(px * 0.7 - ph * 1.3) > 0.2:
            p.set(px, by - 1, V_BLACK[2])
    stamp(c, p)


def vamp_collar(c, x):
    """Haut col dressé derrière la nuque (extérieur noir, intérieur cramoisi)."""
    hx, hy = x.hx, x.hy
    sw = 0.6 * math.sin(x.ph)
    p = new()
    outer = [(14 + x.tx, 26.5 + x.ty), (hx - 12.5 + sw, hy - 6), (hx - 10, hy - 3), (hx - 6.5, hy + 4.5), (19.5 + x.tx, 24.5 + x.ty)]
    spoly(p, outer, V_BLACK, contrast=0.4)
    inner = [(15.5 + x.tx, 25.5 + x.ty), (hx - 11.5 + sw, hy - 4.2), (hx - 9.6, hy - 1.6), (hx - 7.2, hy + 4.8), (18 + x.tx, 25 + x.ty)]
    spoly(p, inner, V_RED[1:5], contrast=0.5, bias=0.12)
    stamp(c, p)


def vamp_torso(c, x):
    tx, ty, ph = x.tx, x.ty, x.ph
    p = new()
    # habit noir (buste) + gilet cramoisi + jabot
    spoly(p, [(15 + tx, 23 + ty), (27 + tx, 23 + ty), (26.5 + tx, 29 + ty), (26 + tx, 34 + ty), (16 + tx, 34 + ty), (15 + tx, 29 + ty)],
          V_COAT, contrast=0.4)
    spoly(p, [(19 + tx, 23.5 + ty), (25.5 + tx, 23.5 + ty), (25.5 + tx, 32 + ty), (23 + tx, 35 + ty), (19.5 + tx, 32.5 + ty)],
          V_VEST, contrast=0.45, only_inside=True)
    for y in range(24, 34):
        p.setf(19 + tx, y + ty, V_COAT[4])  # revers de l'habit
    for y in (28, 30, 32):
        p.setf(24 + tx, y + ty, GOLD[3]); p.setf(24 + tx, y + 1 + ty, GOLD[1])
    # jabot de dentelle blanche
    for (jx, jy, cc) in ((22, 23, 2), (23, 23, 3), (24, 23, 2), (22, 24, 1), (23, 24, 2), (24, 24, 3), (25, 24, 2),
                         (23, 25, 1), (24, 25, 2), (25, 25, 3), (23, 26, 2), (24, 26, 1), (24, 27, 1)):
        p.set(jx + tx, jy + ty, V_SHIRT[cc])
    p.set(24 + tx, 25 + ty, V_RED[3])  # broche rubis
    p.set(23 + tx, 25 + ty, V_RED[2])
    # ceinture fine
    for xx in range(16, 27):
        p.setf(xx + tx, 34 + ty, V_COAT[0])
    stamp(c, p)


def vamp_head(c, x):
    hx, hy = x.hx, x.hy
    # mèches de nuque plaquées vers l'arrière
    lock(c, [(hx - 5, hy - 5), (hx - 9.5, hy - 2), (hx - 10.5 - 0.6 * x.wind, hy + 2)], [3.2, 2.6, 0.8], V_HAIR)
    head(c, hx, hy, V_HAIR, V_IRIS, mouth='fang',
         fringe=[8, 6, 2, -2, -3, -4, -3, -2, -4, -5, -6, -7], blush=None, skin=V_SKIN)
    # reflets plaqués vers l'arrière
    for (sx, sy, ln) in ((hx + 3, hy - 6, 6), (hx + 1, hy - 8, 6), (hx - 1, hy - 4, 4)):
        for j in range(ln):
            q = (sx - j, sy + j * 0.35)
            if c.get(*q) in V_HAIR:
                c.set(*q, V_HAIR[4] if j < ln // 2 else V_HAIR[3])
    # mèche rebelle sur le front
    c.set(hx + 4, hy - 4, V_HAIR[3]); c.set(hx + 5, hy - 3, V_HAIR[2]); c.set(hx + 5, hy - 2, V_HAIR[1])
    c.set(hx + 6, hy - 2, OUT); c.set(hx + 5, hy - 1, OUT)
    # oreille pointue
    ex, ey = int(hx - 1), int(hy + 1)
    for (dx, dy, cc) in ((0, 0, 2), (0, 1, 1), (-1, -1, 2), (-2, -2, 3), (-1, 0, 2), (1, 1, 2), (1, 2, 1), (0, 2, 1)):
        c.set(ex + dx, ey + dy, V_SKIN[cc])
    c.set(ex - 3, ey - 3, OUT); c.set(ex - 3, ey - 2, OUT); c.set(ex - 2, ey - 1, OUT); c.set(ex - 1, ey + 1, OUT)
    c.set(ex, ey + 3, OUT); c.set(ex + 1, ey + 3, OUT)
    # cernes aristocratiques
    c.set(int(hx + 1), int(hy + 4), V_SKIN[1]); c.set(int(hx + 6), int(hy + 4), V_SKIN[1])


def vamp_fx(c, x, front):
    k, ph = x.k, x.ph
    if not front:
        # brume rouge au sol, derrière
        # volutes de brume rouge au ras du sol
        for i, (bx, by) in enumerate(((2, 45), (33, 46), (8, 41))):
            bx += int(round(1.5 * math.sin(ph + i * 2.1)))
            curl = [(0, 0, 1), (1, 0, 2), (2, -1, 2), (3, -1, 3), (4, -2, 2), (3, -3, 1)] if (k + i) % 2 else \
                   [(0, 0, 1), (1, -1, 2), (2, -1, 3), (3, -2, 2), (2, -3, 1)]
            for (dx, dy, cc) in curl:
                c.set(bx + dx, by + dy, V_MIST[cc])
        return
    spots = [((4, 3), (39, 13)), ((5, 2), (40, 10)), ((3, 4), (38, 14)), ((6, 2), (41, 11))]
    a, b = spots[k % 4]
    bat(c, a[0], a[1], k % 2)
    if x.pose not in ('victory', 'attack1'):
        bat(c, b[0] + (1 if k % 3 == 0 else 0), b[1], (k + 1) % 2)
    else:
        bat(c, 41, 6, (k + 1) % 2)


def vampire(x):
    c = new()
    vamp_fx(c, x, False)
    vamp_cape(c, x)
    back_arm_behind(c, x, V_COAT[1:4], V_HAND, cuff=(V_SHIRT[1], V_SHIRT[2]))
    legs(c, x, V_PANTS, V_BOOT)
    vamp_torso(c, x)
    back_arm_front(c, x, V_COAT[1:4], V_HAND, cuff=(V_SHIRT[1], V_SHIRT[2]))
    vamp_head(c, x)
    vamp_collar(c, x)
    front_arm(c, x, V_COAT[2:5], V_HAND, cuff=(V_RED[2], V_RED[3]))
    # épaule de l'habit + chaîne de cape dorée
    p = new()
    ball(p, 26.5 + x.tx, 26.5 + x.ty, 3.4, 2.8, V_COAT)
    stamp(c, p)
    for i in range(5):
        c.set(18 + i + x.tx, 24 + (1 if 0 < i < 4 else 0) + x.ty, GOLD[3] if i % 2 else GOLD[2])
    vamp_fx(c, x, True)
    return c


# ================================================================ 2. Ninja

N_SKIN = ['#a8604e', '#e39a78', '#ffcfa6', '#ffe6cc']
N_HAIR = ['#05050c', '#0e0e1c', '#1a1a2e', '#2c2e48', '#4c5070']
N_IRIS = ['#5a2a06', '#e08a1a', '#ffe07a']
N_GARB = ['#0a0a1e', '#151a3a', '#232b58', '#34427e', '#5266a8']
N_SCARF = ['#3a0610', '#760e1e', '#c01e2c', '#ee463c', '#ff9a7a']
N_WRAP = ['#5a5a7a', '#9a9ab4', '#d4d4e4']
N_STEEL = ['#3a4258', '#7a86a0', '#c4ccdc', '#ffffff']
N_SHADOW = ['#2a1a4a', '#4a2e7a']


def scarf_shade(R):
    def f(t, s, x, y):
        if s < -0.45:
            return R[3]
        if s > 0.45:
            return R[1]
        if t > 0.85:
            return R[1]
        return R[2]
    return f


def ninja_scarf_tails(c, x):
    tx, ty, ph, wd = x.tx, x.ty, x.ph, x.wind
    kx, ky = 15 + tx, 23.5 + ty
    for n, (ln, amp, wid, off) in enumerate(((17, 2.4, 1.9, 0.0), (12, 2.0, 1.5, 2.2))):
        spine = []
        for i in range(6):
            u = i / 5
            dx = -ln * u * (0.75 + 0.3 * wd)
            dy = (2.5 + 3 * (1 - wd)) * u * u + amp * math.sin(u * 4.2 - ph * 1.6 + off) * u + n * 3.2 * u - 1.5 * (1 - n) * u
            spine.append((max(2.6, kx + dx), ky + dy))
        p = new()
        spine_fill(p, spine, [wid, wid * 1.05, wid, wid * 0.9, wid * 0.7, 0.6], scarf_shade(N_SCARF))
        # bout effiloché
        ex, ey = spine[-1]
        p.set(ex - 1, ey + 1, N_SCARF[1])
        stamp(c, p)


def ninja_torso(c, x):
    tx, ty, ph = x.tx, x.ty, x.ph
    p = new()
    # tunique cintrée + pans courts
    spoly(p, [(15.5 + tx, 23 + ty), (26.5 + tx, 23 + ty), (26 + tx, 29 + ty), (25.5 + tx, 33 + ty), (27 + tx, 38),
              (21 + tx, 37.5), (15 + tx, 38.5), (16.5 + tx, 33 + ty), (16 + tx, 29 + ty)], N_GARB, contrast=0.45)
    # croisure du kimono
    for k in range(6):
        p.setf(25 - k + tx, 24 + k + ty, N_GARB[4] if k < 5 else N_GARB[3])
        p.setf(24 - k + tx, 24 + k + ty, N_GARB[1])
    for yy in range(35, 38):
        p.setf(21 + tx, yy, N_GARB[0])
    # ceinture rouge (obi) + noeud et pans
    for xx in range(15, 28):
        p.setf(xx + tx, 32 + ty, N_SCARF[3] if xx < 21 else N_SCARF[2]); p.setf(xx + tx, 33 + ty, N_SCARF[1])
    stamp(c, p)
    p = new()
    sw = int(round(math.sin(ph) * 1 + x.wind))
    spoly(p, [(15 + tx, 32 + ty), (17 + tx, 33 + ty), (14 - sw + tx, 38), (12.5 - sw + tx, 37)], N_SCARF[1:5], contrast=0.4)
    p.ellipse(15.5 + tx, 32.5 + ty, 1.4, 1.2, N_SCARF[2])
    stamp(c, p)
    # shuriken à la ceinture
    sx, sy = 23 + tx, 33 + ty
    for (dx, dy, cc) in ((0, 0, 1), (1, -1, 2), (-1, 1, 2), (1, 1, 2), (-1, -1, 3), (0, -1, 1), (0, 1, 1), (-1, 0, 1), (1, 0, 1)):
        if abs(dx) + abs(dy) != 1:
            c.set(sx + dx, sy + dy, N_STEEL[cc])
        else:
            c.set(sx + dx, sy + dy, N_STEEL[0])
    c.set(sx, sy, OUT)


def ninja_neck(c, x):
    """Écharpe nouée autour du cou (devant le buste, sous la tête)."""
    tx, ty = x.tx, x.ty
    p = new()
    spoly(p, [(14 + tx, 21.5 + ty), (27 + tx, 21.5 + ty), (27.5 + tx, 25 + ty), (14 + tx, 25.5 + ty)], N_SCARF, contrast=0.5)
    for xx in range(15, 27, 3):
        p.setf(xx + tx, 24 + ty, N_SCARF[1])
    p.ellipse(15 + tx, 23.5 + ty, 1.8, 1.6, N_SCARF[2])
    p.set(14 + tx, 23 + ty, N_SCARF[3])
    stamp(c, p)


def ninja_head(c, x):
    hx, hy, ph, wd = x.hx, x.hy, x.ph, x.wind
    # mèches en épis à l'arrière
    for (bx, by, ex, ey) in ((-4, -6, -9, -11), (-7, -4, -12.5, -7), (-1, -7, -3, -12.5), (-8, -1, -12.5, -2)):
        lock(c, [(hx + bx, hy + by), (hx + (bx + ex) / 2, hy + (by + ey) / 2 + 0.5), (hx + ex - 0.3 * wd, hy + ey)],
             [2.6, 1.8, 0.6], N_HAIR)
    head(c, hx, hy, N_HAIR, N_IRIS, mouth='none', brows='angry',
         fringe=[8, 6, 3, 1, 2, 3, 1, 0, 2, 1, -1, -2], blush=None, skin=N_SKIN)
    # masque sur le bas du visage (nez couvert, petit relief)
    face = face_set(c, x, N_SKIN)
    top = int(hy + 4)
    for (fx, fy) in face:
        if fy >= top:
            t = (fx - (hx - 2)) / 10
            col = N_GARB[3] if fy == top else N_GARB[2] if t < 0.75 else N_GARB[1]
            c.set(fx, fy, col)
    c.set(int(hx + 8), top + 1, N_GARB[2]); c.set(int(hx + 9), top + 1, OUT); c.set(int(hx + 8), top, OUT)
    c.set(int(hx + 4), top + 3, N_GARB[1]); c.set(int(hx + 5), top + 2, N_GARB[1])
    # bandeau frontal + plaque d'acier gravée
    band = new()
    for xx in range(int(hx - 9), int(hx + 9)):
        yy = hy - 4 + ((xx - hx) / 9.0) ** 2 * 1.5
        if c.get(xx, yy) is not None and c.get(xx, yy) != OUT:
            band.set(xx, yy, N_GARB[3] if xx < hx else N_GARB[2])
            band.set(xx, yy + 1, N_GARB[1])
    stamp(c, band, None)
    pl = new()
    spoly(pl, [(hx + 1, hy - 5.5), (hx + 7, hy - 5), (hx + 7, hy - 2), (hx + 1, hy - 2.5)], N_STEEL, contrast=0.6)
    pl.set(hx + 3, hy - 4, N_STEEL[0]); pl.set(hx + 4, hy - 3, N_STEEL[0]); pl.set(hx + 5, hy - 4, N_STEEL[0])
    stamp(c, pl)
    # noeud et pans du bandeau
    for n, ln in enumerate((9, 7)):
        spine = []
        for i in range(5):
            u = i / 4
            spine.append((max(2.0, hx - 8.2 - ln * u * (0.75 + 0.3 * wd)), hy - 4.5 + n * 2 * u + (1.5 - 1.4 * wd) * u + 1.3 * math.sin(u * 4.5 - ph * 1.7 + n * 1.5) * u))
        p = new()
        spine_fill(p, spine, [1.1, 1.0, 1.0, 0.8, 0.5], scarf_shade(N_GARB[1:]))
        stamp(c, p)


def ninja_fx(c, x):
    if x.pose.startswith('walk') or x.pose in ('attack2', 'attack3', 'shoot'):
        # traits de vitesse / ombre fugace
        k = x.k
        for i, yy in enumerate((30 + k % 3, 36, 41 - k % 2)):
            x0 = 2 + (k + i * 2) % 4
            ln = 4 + (i + k) % 3
            for j in range(ln):
                if (j + i) % 3 != 2:
                    c.set(x0 + j, yy, N_SHADOW[1] if j > ln // 2 else N_SHADOW[0])


def ninja(x):
    c = new()
    ninja_fx(c, x)
    ninja_scarf_tails(c, x)
    back_arm_behind(c, x, N_GARB[1:4], N_GARB[1:5], cuff=(N_WRAP[0], N_WRAP[1]), width=3.0)
    legs(c, x, N_GARB[1:4], [N_HAIR[0], N_HAIR[1], N_GARB[1], N_GARB[2], N_GARB[3]], wraps=(N_WRAP[0], N_WRAP[1]))
    ninja_torso(c, x)
    back_arm_front(c, x, N_GARB[1:4], N_GARB[1:5], cuff=(N_WRAP[0], N_WRAP[1]), width=3.0)
    ninja_neck(c, x)
    ninja_head(c, x)
    front_arm(c, x, N_GARB[2:5], N_GARB[1:5], cuff=(N_WRAP[1], N_WRAP[2]), width=3.0)
    p = new()
    ball(p, 26.5 + x.tx, 26.5 + x.ty, 3.0, 2.5, N_GARB)
    stamp(c, p)
    return c


# ================================================================ 3. Sorcière

WI_SKIN = ['#a8604e', '#e39a78', '#ffd4b0', '#fff0dc']
WI_HAIR = ['#0e2a44', '#16626e', '#21a096', '#56d8bc', '#b4fbe6']
WI_HAIR2 = ['#24104a', '#4e2488', '#8048c4', '#b88af0', '#e6ccff']
WI_IRIS = ['#5a1a06', '#f09a20', '#fff09a']
WI_HAT = ['#180632', '#30105e', '#521e94', '#7a3ac4', '#a872e6']
WI_BAND = ['#0c0418', '#1c0a32', '#2c1248']
WI_ROBE = ['#10071a', '#200f30', '#341a48', '#4c2866', '#6c3e8a']
WI_MOON = ['#b88a2a', '#f6dc7a', '#fff6c8']
WI_POT = ['#0e4a2a', '#2aa84a', '#8af06a', '#e8ffd0']
WI_BOOT = ['#0c0612', '#1c0e26', '#2e1a3e', '#4a2e62', '#7a5a9a']
WI_STAR = ['#fff6c8', '#f6dc7a']


def witch_hair_back(c, x):
    hx, hy, ph, wd = x.hx, x.hy, x.ph, x.wind
    sw = 1.2 * math.sin(ph) - 0.8 * wd
    # mèches violettes dessous, cascade turquoise dessus
    lock(c, [(hx - 4, hy - 3), (hx - 10, hy + 2), (hx - 12 + sw, hy + 9), (hx - 11 + sw * 1.4, hy + 15),
             (hx - 13 + sw * 2, hy + 19)], [3.8, 4.2, 3.8, 2.6, 0.8], WI_HAIR2)
    lock(c, [(hx - 3, hy - 4), (hx - 8.5, hy + 1), (hx - 10 + sw * 0.8, hy + 8), (hx - 8.5 + sw, hy + 14),
             (hx - 9.5 + sw * 1.5, hy + 18)], [4.2, 4.6, 4.0, 2.8, 0.8], WI_HAIR)


def hat_shade(t, s, x, y):
    if t > 0.93:
        return WI_HAT[2]
    if s < -0.4:
        return WI_HAT[4] if t < 0.55 else WI_HAT[3]
    if s > 0.45:
        return WI_HAT[1]
    if s > 0.1:
        return WI_HAT[2]
    return WI_HAT[3]


def witch_hat(c, x):
    hx, hy, ph, wd = x.hx, x.hy, x.ph, x.wind
    by = hy - 6.5
    flop = 1.0 * math.sin(ph * 0.9) + 1.2 * wd
    if x.icon:
        spine = [(hx - 0.5, by - 0.5), (hx - 1.8, by - 5), (hx - 4.5, by - 7.2), (hx - 8.5, by - 6.5), (hx - 11, by - 4)]
        widths = [6.2, 4.4, 2.8, 1.7, 0.8]
    else:
        spine = [(hx - 0.5, by - 0.5), (hx - 1.2, by - 7), (hx - 3.5, by - 12), (hx - 7.5 - flop * 0.5, by - 15),
                 (hx - 11.5 - flop, by - 14.5 + flop * 0.6)]
        widths = [6.4, 4.8, 3.2, 1.9, 0.9]
    p = new()
    spine_fill(p, spine, widths, hat_shade)
    for yy in range(int(by) + 1, int(by) + 9):
        for xx in range(int(hx - 10), int(hx + 10)):
            p.set(xx, yy, None)
    # bandeau sombre + boucle dorée
    for xx in range(int(hx - 7), int(hx + 7)):
        for yy in (int(by - 4), int(by - 3), int(by - 2)):
            if p.get(xx, yy) is not None:
                p.set(xx, yy, WI_BAND[2] if yy == int(by - 4) else WI_BAND[1] if yy == int(by - 3) else WI_BAND[0])
    bx = int(hx + 1)
    for (dx, dy, cc) in ((0, -5, 2), (1, -5, 3), (2, -5, 2), (0, -4, 2), (2, -4, 1), (0, -3, 1), (1, -3, 1), (2, -3, 0)):
        p.set(bx + dx, int(by) + dy, GOLD[cc + 1])
    p.set(bx + 1, int(by) - 4, WI_BAND[1])
    # étoiles brodées
    for (sx, sy) in ((hx - 3, by - 7), (hx - 1, by - 10), (hx + 1.5, by - 7.5)):
        if not x.icon or sy > by - 6:
            p.setf(sx, sy, WI_STAR[0])
    p.setf(hx - 2, by - 7, WI_STAR[1]); p.setf(hx - 4, by - 7, WI_STAR[1]); p.setf(hx - 3, by - 6, WI_STAR[1]); p.setf(hx - 3, by - 8, WI_STAR[1])
    stamp(c, p)
    # large bord
    p = new()
    for yy in range(int(by - 2), int(by + 3)):
        for xx in range(int(hx - 15), int(hx + 15)):
            dx, dy = (xx + 0.5 - (hx - 0.5)) / 13.2, (yy + 0.5 - (by + 0.4)) / 2.4
            if dx * dx + dy * dy <= 1:
                if dy < -0.25:
                    col = WI_HAT[3] if dx < 0.3 else WI_HAT[2]
                elif dy > 0.4:
                    col = WI_HAT[0]
                else:
                    col = WI_HAT[2] if dx < 0.2 else WI_HAT[1]
                p.set(xx, yy, col)
    # bord légèrement relevé à l'avant
    p.set(hx + 12, by - 1, WI_HAT[2]); p.set(hx + 13, by - 2, WI_HAT[3])
    stamp(c, p)
    # pointe de chapeau : petite étoile pendue
    if not x.icon:
        tx_, ty_ = spine[-1]
        c.set(tx_ - 1, ty_ + 1, OUT); c.set(tx_ - 1, ty_ + 2, WI_MOON[0])
        star(c, int(tx_ - 1), int(ty_ + 3), WI_STAR, True)


def witch_robe(c, x):
    tx, ty, ph = x.tx, x.ty, x.ph
    hemw = [(10.5 + tx, 44), (14 + tx, 45), (17 + tx, 44), (20 + tx, 45), (23 + tx, 44), (26.5 + tx, 45), (30.5 + tx, 44)]
    sw = 0.8 * math.sin(ph) - 0.6 * x.wind
    hem = [(hx_ + sw * (1 - (hx_ - 10) / 22), hy_ + (0.6 * math.sin(hx_ * 0.9 - ph * 1.5))) for hx_, hy_ in hemw]
    pts = [(15.5 + tx, 23 + ty), (26 + tx, 23 + ty), (26.5 + tx, 31 + ty)] + hem[::-1] + [(15 + tx, 31 + ty)]
    pts = [(15.5 + tx, 23 + ty), (26 + tx, 23 + ty), (26.5 + tx, 31 + ty), hem[-1]] + hem[::-1][1:-1] + [hem[0], (15 + tx, 31 + ty)]
    m = mask_of(lambda t: t.poly(pts, '#000'))
    p = new()
    rows = {}
    for (px, py) in m:
        rows.setdefault(py, []).append(px)
    for (px, py) in m:
        r = rows[py]
        t = (px - min(r)) / max(1, max(r) - min(r))
        col = WI_ROBE[3] if t < 0.18 else WI_ROBE[2] if t < 0.6 else WI_ROBE[1] if t < 0.92 else WI_ROBE[0]
        p.set(px, py, col)
    # plis
    for (fx, y0) in ((17.5, 35), (21, 34), (24.5, 36)):
        for yy in range(y0, 45):
            p.setf(fx + tx + (yy - y0) // 4 * (1 if fx > 21 else -1 if fx < 21 else 0), yy, WI_ROBE[1])
    # ourlet doré + croissants de lune
    for xx in range(8, 34):
        col = [py for (qx, py) in m if qx == xx + tx]
        if col:
            by = max(col)
            p.set(xx + tx, by, WI_MOON[0]); p.setf(xx + tx, by - 1, WI_ROBE[0])
    for (mx, my) in ((14, 40), (23.5, 39), (19, 36.5)):
        mx += tx
        for (dx, dy, cc) in ((0, -1, 1), (-1, 0, 1), (-1, 1, 1), (0, 2, 1), (1, 2, 0), (0, 0, 2)):
            p.setf(mx + dx, my + dy, WI_MOON[cc] if (dx, dy) != (0, 0) else WI_ROBE[2])
        p.setf(mx, my, WI_ROBE[2]); p.setf(mx, my + 1, WI_ROBE[2])
    for (sx, sy) in ((17, 42), (26, 41), (12.5, 43)):
        p.setf(sx + tx, sy, WI_STAR[1])
    # col en V à liseré doré et broche de lune
    for k in range(5):
        p.setf(19 + k * 0.5 + tx, 23 + k + ty, WI_MOON[1]); p.setf(24.5 - k * 0.5 + tx, 23 + k + ty, WI_MOON[0])
    for k in range(4):
        p.setf(20 + k * 0.5 + tx, 23 + k + ty, WI_SKIN[2]); p.setf(23.5 - k * 0.5 + tx, 23 + k + ty, WI_SKIN[1])
    p.setf(21 + tx, 23 + ty, WI_SKIN[2]); p.setf(22 + tx, 23 + ty, WI_SKIN[2]); p.setf(22 + tx, 24 + ty, WI_SKIN[1])
    # ceinture tressée
    for xx in range(14, 29):
        p.setf(xx + tx, 32 + ty, WI_HAT[2] if xx % 2 else WI_HAT[3]); p.setf(xx + tx, 33 + ty, WI_HAT[1])
    stamp(c, p)
    # petite pèlerine violette à liseré d'or, fermée par une lune
    p = new()
    sc = [(14 + tx, 22.5 + ty), (27.5 + tx, 22.5 + ty), (28.5 + tx, 27 + ty)]
    for i, xx in enumerate((28, 25.5, 23, 20.5, 18, 15.5, 13.5)):
        sc.append((xx + tx, 27.5 + ty + (0.8 if i % 2 else 0)))
    spoly(p, sc, WI_HAT[1:5], contrast=0.45)
    m = mask_of(lambda t: t.poly(sc, '#000'))
    for (px, py) in m:
        if (px, py + 1) not in m:
            p.set(px, py, WI_HAT[0] if px % 3 else WI_HAT[1])
    for k in range(4):
        p.setf(20 + k * 0.5 + tx, 22.5 + k + ty, WI_SKIN[2]); p.setf(23.5 - k * 0.5 + tx, 22.5 + k + ty, WI_SKIN[1])
        p.setf(21 + tx, 22.5 + k * 0.6 + ty, WI_SKIN[2]); p.setf(22 + tx, 22.5 + k * 0.6 + ty, WI_SKIN[2])
    stamp(c, p)
    for (dx, dy, cc) in ((1, 0, 1), (0, 1, 2), (0, 2, 1), (1, 3, 0)):
        c.set(22 + tx + dx, 24 + ty + dy, WI_MOON[cc])


def potion(c, x):
    """Petite fiole lumineuse accrochée à la ceinture."""
    px, py = 18 + x.tx, 34 + x.ty
    glow = (x.k % 2) == 0
    p = new()
    p.ellipse(px + 0.5, py + 2.5, 2.0, 2.0, WI_POT[2])
    p.set(px - 1, py + 2, WI_POT[3]); p.set(px, py + 1, WI_POT[3]); p.set(px, py + 2, WI_POT[3] if glow else WI_POT[2])
    p.set(px + 1, py + 3, WI_POT[1]); p.set(px + 1, py + 4, WI_POT[1]); p.set(px, py + 4, WI_POT[1])
    p.set(px, py, '#c4d8e8'); p.set(px + 1, py, '#8aa0b8')
    p.set(px, py - 1, '#9a6230'); p.set(px + 1, py - 1, '#6e3e1e')
    stamp(c, p)
    # lueur
    for (dx, dy) in (((-3, 1), (3, 4)), ((-2, 5), (3, 0)))[x.k % 2]:
        c.set(px + dx, py + dy, WI_POT[2] if glow else WI_POT[3])


def witch_head(c, x):
    hx, hy = x.hx, x.hy
    head(c, hx, hy, WI_HAIR, WI_IRIS, mouth='smirk' if x.pose not in ('hurt',) else 'open',
         fringe=[8, 6, 2, 0, 2, 3, 1, 0, 2, 1, -1, -2], blush=BLUSH, skin=WI_SKIN)
    # mèche avant tombant sur l'épaule
    sw = 0.5 * math.sin(x.ph)
    lock(c, [(hx - 2, hy - 1), (hx - 2.5 + sw, hy + 4), (hx - 1.5 + sw, hy + 9)], [2.2, 2.0, 0.8], WI_HAIR)
    witch_hat(c, x)


def witch_fx(c, x):
    k = x.k
    pts = [((4, 10, True), (41, 18, False), (2, 28, False)), ((5, 12, False), (42, 15, True), (3, 25, True)),
           ((3, 8, False), (40, 20, True), (1, 30, False)), ((6, 11, True), (43, 17, False), (2, 27, True))][k % 4]
    for (sx, sy, big) in pts:
        star(c, sx, sy, ['#e6ccff', '#b88af0'] if sx < 20 else WI_STAR, big)


def witch(x):
    c = new()
    witch_fx(c, x)
    witch_hair_back(c, x)
    bell = [WI_ROBE[1], WI_ROBE[2], WI_ROBE[3], WI_MOON[1]]
    back_arm_behind(c, x, WI_ROBE[1:4], WI_SKIN, bell=bell)
    legs(c, x, ['#1a0a24', '#2c1236', '#46205a'], WI_BOOT, toe=WI_BOOT[3])
    witch_robe(c, x)
    potion(c, x)
    back_arm_front(c, x, WI_ROBE[1:4], WI_SKIN, bell=bell)
    witch_head(c, x)
    front_arm(c, x, WI_ROBE[2:5], WI_SKIN, bell=[WI_ROBE[1], WI_ROBE[3], WI_ROBE[4], WI_MOON[1]])
    p = new()
    ball(p, 26.5 + x.tx, 26.5 + x.ty, 3.2, 2.7, WI_ROBE)
    stamp(c, p)
    return c


# ================================================================ 4. Séraphin

SE_SKIN = ['#b06a56', '#e8a888', '#ffdcc0', '#fff2e4']
SE_HAIR = ['#8e3e5a', '#cc7088', '#f2a6b2', '#ffd6d6', '#fff4f2']
SE_IRIS = ['#0a4a6a', '#1aa8d8', '#a8f4ff']
SE_WING = ['#7270a8', '#aeb4e2', '#dfe4f8', '#f5f7ff', '#ffffff']
SE_TIP = ['#eab53a', '#b0701e']
SE_ROBE = ['#8a88b8', '#bec2e2', '#e4e8f8', '#f8faff', '#ffffff']
SE_GOLD = ['#7a3e18', '#c0761e', '#eab53a', '#ffe27a', '#fffbd0']
SE_GEM = ['#0a4a8a', '#2a9af0', '#a8f0ff']
SE_GLOW = ['#ffffff', '#ffe27a']
SE_HALO = ['#fffbd0', '#ffe27a', '#eab53a']

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
    bulge = (base_b[0] + (tip[0] - base_b[0]) * 0.6 + 1.0, base_b[1] + (tip[1] - base_b[1]) * 0.6)
    m = mask_of(lambda t: t.poly([base_a, base_b, bulge, tip], '#000'))
    p = new()
    for (x, y) in m:
        t = ((x + 0.5 - mid[0]) * ux + (y + 0.5 - mid[1]) * uy) / ln
        if t > 0.82:
            col = tipcol[0] if (x - 1, y) not in m else tipcol[1]
        elif (x - 1, y) not in m or (x, y - 1) not in m:
            col = R[4]
        elif (x + 1, y) not in m:
            col = R[1]
        else:
            col = R[3] if t < 0.45 else R[2]
        p.set(x, y, col)
    stamp(c, p, sep)


def wing(c, dx, dy, deg, scale=1.0, far=False, sx=1.0):
    R = SE_WING if not far else [SE_WING[0], SE_WING[0], SE_WING[1], SE_WING[2], SE_WING[2]]
    tipcol = SE_TIP if not far else [SE_GOLD[1], SE_GOLD[0]]
    o = (WING_ROOT[0] + dx, WING_ROOT[1] + dy)

    def T(pt):
        q = (WING_ROOT[0] + (pt[0] - WING_ROOT[0]) * scale * sx + dx, WING_ROOT[1] + (pt[1] - WING_ROOT[1]) * scale + dy)
        return rot(q, o, deg)
    w = new()
    for (ba, bb, tp) in WING_FEATHERS:
        feather_poly(w, T(ba), T(bb), T(tp), R, tipcol, R[1] if not far else R[0])
    cov = new()
    arm_ = [T(p) for p in WING_ARM]
    for (x0, y0), (x1, y1) in zip(arm_, arm_[1:]):
        cov.line(x0, y0, x1, y1, R[3], width=3.6)
    for (x, y) in arm_[1:-1]:
        cov.ellipse(x + 1.2, y + 2.2, 2.0, 1.8, R[3])
    for (x0, y0), (x1, y1) in zip(arm_, arm_[1:]):
        cov.line(x0 - 0.6, y0 - 0.8, x1 - 0.6, y1 - 0.8, R[4])
    # liseré d'or le long du bord d'attaque
    for (x0, y0), (x1, y1) in zip(arm_[:3], arm_[1:4]):
        cov.set((x0 + x1) / 2 + 1, (y0 + y1) / 2 + 1.6, SE_GOLD[3] if not far else SE_GOLD[2])
    stamp(w, cov, R[2] if not far else R[1])
    stamp(c, w)


def seraph_robe(c, x):
    tx, ty, ph = x.tx, x.ty, x.ph
    sw = 0.9 * math.sin(ph) - 0.8 * x.wind
    # longue robe blanche fendue (pans flottants), liseré d'or
    p = new()
    back = [(15 + tx, 30 + ty), (19 + tx, 31 + ty), (17.5 + tx, 44.5), (13 + sw + tx, 44.5 + 0.6 * math.sin(ph)), (10.5 + sw * 1.4 + tx, 43)]
    spoly(p, back, SE_ROBE, contrast=0.45)
    front = [(19 + tx, 31 + ty), (27 + tx, 31 + ty), (29.5 + sw * 0.4 + tx, 43.5), (25.5 + tx, 44.5 + 0.5 * math.sin(ph + 1)), (21 + tx, 43.5)]
    spoly(p, front, SE_ROBE, contrast=0.45)
    for (pts_) in (back, front):
        m = mask_of(lambda t: t.poly(pts_, '#000'))
        for (px, py) in m:
            if (px, py + 1) not in m:
                p.set(px, py, SE_GOLD[2]); p.setf(px, py - 1, SE_GOLD[3] if px % 3 else SE_GOLD[2])
    for yy in range(33, 43):
        p.setf(23 + tx + (yy - 33) // 5, yy, SE_ROBE[1])
        p.setf(15 + tx - (yy - 33) // 5, yy, SE_ROBE[1])
    stamp(c, p)
    # cuirasse dorée + ceinture à gemme
    p = new()
    spoly(p, [(15.5 + tx, 23 + ty), (26.5 + tx, 23 + ty), (26 + tx, 29 + ty), (24.5 + tx, 33 + ty), (17.5 + tx, 33 + ty), (16 + tx, 29 + ty)],
          SE_ROBE, contrast=0.45)
    ball(p, 22 + tx, 28.5 + ty, 5.0, 4.6, SE_GOLD, only_inside=True)
    for yy in range(25, 33):
        p.setf(22 + tx, yy + ty, SE_GOLD[3] if yy < 29 else SE_GOLD[2])
    # aile gravée sur le plastron
    for (wx, wy) in ((19, 27), (20, 28), (21, 28), (18, 26), (24, 28), (25, 27)):
        p.setf(wx + tx, wy + ty, SE_GOLD[4] if wx < 22 else SE_GOLD[3])
    p.setf(22 + tx, 29 + ty, SE_GEM[1])
    for xx in range(15, 28):
        p.setf(xx + tx, 33 + ty, SE_GOLD[2] if xx < 22 else SE_GOLD[1]); p.setf(xx + tx, 34 + ty, SE_GOLD[0])
    stamp(c, p)
    c.set(22 + tx, 33 + ty, SE_GEM[2]); c.set(23 + tx, 33 + ty, SE_GEM[1]); c.set(22 + tx, 34 + ty, SE_GEM[0]); c.set(23 + tx, 34 + ty, SE_GEM[0])
    # col montant blanc
    for xx in range(19, 25):
        c.set(xx + tx, 23 + ty, SE_ROBE[4] if xx < 22 else SE_ROBE[3])


def seraph_head(c, x):
    hx, hy, ph, wd = x.hx, x.hy, x.ph, x.wind
    sw = 0.8 * math.sin(ph) - 0.7 * wd
    lock(c, [(hx - 5, hy - 2), (hx - 8.5, hy + 2), (hx - 9 + sw, hy + 7), (hx - 8 + sw * 1.4, hy + 11)],
         [3.2, 3.4, 2.6, 0.8], SE_HAIR)
    head(c, hx, hy, SE_HAIR, SE_IRIS, mouth='open' if x.pose in ('victory', 'attack2', 'cast') else 'smile',
         fringe=[8, 6, 2, 0, 1, 2, 0, -1, 1, 2, 0, -2], skin=SE_SKIN)
    # mèche sur la joue + petit diadème ailé
    lock(c, [(hx - 1.5, hy - 1), (hx - 1.8 + sw * 0.3, hy + 4), (hx - 1, hy + 7)], [1.8, 1.6, 0.6], SE_HAIR)
    for (dx, dy, cc) in ((-4, -6, 2), (-3, -6.5, 3), (-2, -6.8, 3), (-1, -7, 2), (0, -7, 2)):
        pass


def seraph_halo(c, x):
    hx, hy = x.hx, x.hy
    bob = (x.k % 2) * 0.6
    hcx, hcy = hx - 1.5, hy - 11.5 - bob
    p = new()
    for yy in range(int(hcy - 4), int(hcy + 4)):
        for xx in range(int(hcx - 9), int(hcx + 9)):
            d = ((xx + 0.5 - hcx) / 6.6) ** 2 + ((yy + 0.5 - hcy) / 2.2) ** 2
            if 0.32 <= d <= 1.0:
                p.set(xx, yy, SE_HALO[0] if yy + 0.5 < hcy - 0.4 else SE_HALO[1] if xx + 0.5 < hcx + 3 else SE_HALO[2])
    stamp(c, p, SE_GOLD[1])
    # éclat du halo
    c.set(hcx - 4, hcy - 2, WHITE)


def seraph_fx(c, x, front):
    k = x.k
    if not front:
        pts = [((3, 38, False), (42, 22, True), (36, 4, False)), ((2, 35, True), (43, 25, False), (38, 3, True)),
               ((4, 40, False), (41, 20, False), (35, 6, True)), ((1, 37, True), (44, 23, True), (39, 5, False))][k % 4]
        for (sx, sy, big) in pts:
            sparkle(c, sx, sy, SE_GLOW, big)
        # motes de lumière montantes
        for i in range(3):
            mx = 6 + i * 13 + (k * 3 + i * 5) % 5
            my = 44 - (k * 4 + i * 7) % 12
            c.set(mx, my, SE_GOLD[3]); c.set(mx, my + 1, SE_GOLD[2])
    elif x.pose in ('cast', 'victory'):
        hx, hy = x.hand
        for (dx, dy) in ((-3, -3), (3, -2), (-2, 3)):
            sparkle(c, hx + dx, hy + dy, SE_GLOW, True)


def seraph(x):
    c = new()
    seraph_fx(c, x, False)
    fl = x.flap
    wings = new()
    wing(wings, 8 + x.tx, -5 + x.ty, fl * 0.7 + 14, scale=1.0, far=True, sx=0.95)
    wing(wings, 4 + x.tx, -2 + x.ty, fl + 2, scale=1.08, sx=0.92)
    # les ailes ne sortent jamais du cadre à gauche (largeur imposée de 48 px)
    shift_x = max(0, wings.pad - wings.bounds()[0])
    c.paste(wings, shift_x, 0)
    back_arm_behind(c, x, SE_ROBE[1:4], SE_SKIN, cuff=(SE_GOLD[1], SE_GOLD[2]))
    legs(c, x, SE_ROBE[1:4], SE_GOLD)
    seraph_robe(c, x)
    back_arm_front(c, x, SE_ROBE[1:4], SE_SKIN, cuff=(SE_GOLD[1], SE_GOLD[2]))
    seraph_head(c, x)
    seraph_halo(c, x)
    front_arm(c, x, SE_ROBE[2:5], SE_SKIN, cuff=(SE_GOLD[2], SE_GOLD[3]))
    # épaulière dorée à plumet
    p = new()
    ball(p, 26.5 + x.tx, 26.5 + x.ty, 3.7, 3.1, SE_GOLD)
    for xx in range(23, 31):
        p.setf(xx + x.tx, 29 + x.ty, SE_ROBE[3])
    p.setf(26 + x.tx, 24 + x.ty, SE_GOLD[4]); p.setf(25 + x.tx, 25 + x.ty, SE_GOLD[4])
    stamp(c, p)
    c.set(27 + x.tx, 27 + x.ty, SE_GEM[1])
    seraph_fx(c, x, True)
    return c


# ---------------------------------------------------------------- assemblage

DRAW = {'vampire': vampire, 'ninja': ninja, 'witch': witch, 'seraph': seraph}


def frames(sid):
    """Les 14 poses d'un skin, recadrées sur une hauteur commune (oy identique pour toutes)."""
    raw = [(pose, DRAW[sid](Ctx(pose))) for pose in ORDER]
    pad = raw[0][1].pad
    top = 0
    for _, cv in raw:
        top = max(top, pad - cv.bounds()[1])
    out = {}
    for pose, cv in raw:
        crop = cv.crop_box((0, -top, W - 1, H - 1))
        extra = Ctx(pose).extra()
        extra['oy'] = -top
        out[f'skin_{sid}_{pose}'] = (crop, extra)
    return out


ICON_BOX = {'vampire': (10, 5), 'ninja': (10, 3), 'witch': (10, 1), 'seraph': (10, 2)}


def icon(sid):
    """Portrait 24×24 : tête et épaules (pose de repos, sans effets au sol)."""
    cv = DRAW[sid](Ctx('idle', icon=True))
    x0, y0 = ICON_BOX[sid]
    return cv.crop_box((x0, y0, x0 + 23, y0 + 23))


def build():
    out = {}
    for sid in SKINS:
        out.update(frames(sid))
        out[f'skin_{sid}_icon'] = (icon(sid), {})
    return out
