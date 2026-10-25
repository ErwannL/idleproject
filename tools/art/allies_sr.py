"""Alliés invocables de rareté SR (chibi 16 bits), face à DROITE.

Chaque allié : trois images sur le même canvas 40×40, pieds sur y=39, corps centré vers x=18.
  ally_<id>      : attente
  ally_<id>_b    : attente / marche (respiration, pas)
  ally_<id>_atk  : attaque (arme portée vers l'avant / sort lancé / arc bandé)
Style : grosse tête (≈42 % de la hauteur), grands yeux, ombrage à décalage de teinte,
lumière en haut à gauche, contour sélectif sombre. Les SR ont des liserés, accessoires
et quelques pixels d'aura.
"""
import math

from lib import Canvas, mix, shift

W, H = 40, 40
GROUND = 39
OUT = '#1a1226'
WHITE = '#ffffff'
LIGHT = (-0.6, -0.8)
SEP = '#33263f'  # séparation interne (plus douce que le contour)

# ---------------------------------------------------------------- palettes (sombre -> clair)

SKIN = ['#b0584a', '#e09678', '#ffcfa8', '#ffe6cc', '#fff4e8']
TAN = ['#7a3c2a', '#b86e48', '#dc9a68', '#f2c08e', '#ffe0b8']
BLUSH = '#ff8a9c'
MOUTH = '#8a2a3a'

GOLD = ['#7a3e18', '#c0761e', '#eab53a', '#ffe27a', '#fffbd0']
STEEL = ['#2a2e44', '#4e5672', '#7c88a4', '#b4c0d4', '#eef2f8']
LEATHER = ['#3a1e14', '#6a3a1e', '#9a5a2a', '#c4823e', '#e8b070']
WOOD = ['#3e2214', '#6e3e1e', '#9e6230', '#c88e4a', '#ecc07a']

# 1. paladin d'azur
PAL_HAIR = ['#0e0c1e', '#1c1a34', '#2e2e52', '#4a5080', '#7884b8']
PAL_ARM = ['#141f5c', '#2140a8', '#3a6ce0', '#72a8ff', '#c8e6ff']
PAL_EYE = ['#0e2a8a', '#2a6ae8', '#7ac8ff']
PAL_FX = ['#10227a', '#1c46c8', '#2f7cf6', '#4fb0ff', '#8fe0ff', '#d4f6ff', '#ffffff']
PAL_BLADE = ['#1c46c8', '#3a8cf6', '#8fd8ff', '#dcf6ff', '#ffffff']

# 2. lame rose
ROSE_HAIR = ['#7a1e52', '#c43c86', '#f070b0', '#ffa8d2', '#ffe0f0']
ROSE_ARM = ['#120e1e', '#211a32', '#342a4c', '#4e4270', '#7a6ea0']
ROSE_PINK = ['#7a1442', '#c42a6e', '#ff5aa0', '#ff9ac8', '#ffdcec']
ROSE_EYE = ['#6a0a32', '#e0306e', '#ff9ac0']
ROSE_BLADE = ['#6a0a1a', '#c01a2a', '#ff3a3a', '#ff9a80', '#fff0e0']
ROSE_FX = ['#4a0614', '#8a0a1e', '#d01a2a', '#ff4a3a', '#ff8a6a', '#ffd0c0', '#ffffff']

# 3. sorcière
WIT_HAIR = ['#5c5a8a', '#9a9cc8', '#cfd2ee', '#eef0ff', '#ffffff']
WIT_HAT = ['#1e0a3a', '#3c1a6a', '#5c2c9e', '#8452d0', '#b892f4']
WIT_DRESS = ['#2a0e3c', '#521e74', '#7a34a6', '#a462d2', '#d2a6f0']
WIT_EYE = ['#4a0a7a', '#a040f0', '#e0a8ff']
WIT_ORB = ['#3a0a6a', '#7a2ad0', '#b85aff', '#e4b0ff', '#fff0ff']
WIT_FX = ['#2a0850', '#4a1290', '#7a2ad0', '#a650ff', '#d090ff', '#f0d8ff', '#ffffff']

# 4. archère elfe
ELF_HAIR = ['#8a5418', '#cc9230', '#f0c64e', '#ffe88e', '#fff8d4']
ELF_LEA = ['#2e1810', '#5a3218', '#8a5228', '#b87a40', '#e0aa6a']
ELF_GRN = ['#0e3a24', '#1a6a34', '#34a040', '#6ed254', '#b8f08a']
ELF_EYE = ['#0a4a2a', '#22b050', '#9af0a0']
ELF_FX = ['#0a3a1a', '#11702a', '#22b040', '#4ee060', '#9cff8a', '#dcffd0', '#ffffff']

# 5. grand prêtre
PRI_HAIR = ['#94621a', '#d4a232', '#f2cc58', '#fff0a0', '#fffbe0']
PRI_ROBE = ['#5a5e94', '#9aa0cc', '#d6dcf0', '#f6f8ff', '#ffffff']
PRI_EYE = ['#0a5a6a', '#20b0c8', '#a0f0ff']
PRI_FX = ['#7a3e10', '#c0761e', '#f0b030', '#ffd860', '#fff09a', '#fffbe0', '#ffffff']
PRI_BLUE = ['#122a6a', '#2050b0', '#3a86e8', '#8ac4ff', '#dff0ff']

# 6. ninja
NIN_HAIR = ['#0c0818', '#1a1230', '#2c2250', '#463878', '#6a5ca6']
NIN_GI = ['#0e0e1a', '#1a1a2e', '#2a2a46', '#40406a', '#62629a']
NIN_PUR = ['#2a0848', '#5a1690', '#8a30d0', '#b868ff', '#e2b8ff']
NIN_EYE = ['#3a0a6a', '#a040ff', '#e8b0ff']
NIN_BLADE = ['#3a0a70', '#7a2ad8', '#b070ff', '#e4c8ff', '#ffffff']
NIN_FX = ['#200640', '#3e0e80', '#6a20c8', '#9a50ff', '#c890ff', '#ecd8ff', '#ffffff']

# 7. barbare
BAR_HAIR = ['#7a7068', '#b8b0a4', '#e4ded2', '#f8f4ec', '#ffffff']
BAR_FUR = ['#3a2418', '#634030', '#8e664a', '#b8946c', '#e0c49a']
BAR_PAINT = '#d0202a'
BAR_KILT = ['#3a1210', '#66201a', '#943426', '#c05434', '#e8885a']
BAR_EYE = ['#7a1a0a', '#e05a1a', '#ffc070']
BAR_AXE = ['#3a1018', '#7a2a30', '#b8a4a8', '#e8dce0', '#ffffff']
BAR_FX = ['#4a0408', '#8a0a10', '#d0201a', '#ff5a2a', '#ff9a5a', '#ffd8b0', '#ffffff']


def dk(R):
    """Rampe assombrie (plan arrière)."""
    return [R[0], R[0], R[1], R[2], R[3]]


# ---------------------------------------------------------------- masques

def m_ellipse(cx, cy, rx, ry):
    out = set()
    for y in range(int(cy - ry - 1), int(cy + ry + 2)):
        for x in range(int(cx - rx - 1), int(cx + rx + 2)):
            if ((x + 0.5 - cx) / max(rx, 0.01)) ** 2 + ((y + 0.5 - cy) / max(ry, 0.01)) ** 2 <= 1:
                out.add((x, y))
    return out


def m_poly(pts):
    c = Canvas(W + 20, H + 20)
    c.poly([(x + 10, y + 10) for x, y in pts], '#000000')
    return {(x - 10, y - 10) for y in range(c.h) for x in range(c.w) if c.px[y][x] is not None}


def m_line(pts, width):
    out = set()
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        n = int(max(abs(x1 - x0), abs(y1 - y0)) * 3) + 1
        for i in range(n + 1):
            t = i / n
            out |= m_ellipse(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, width / 2, width / 2)
    return out


def m_tube(pts, widths):
    """Ruban effilé le long d'une polyligne (mèches, queues, écharpes)."""
    out = set()
    seg = len(pts) - 1
    for i in range(seg):
        (x0, y0), (x1, y1) = pts[i], pts[i + 1]
        n = int(max(abs(x1 - x0), abs(y1 - y0)) * 3) + 1
        for k in range(n + 1):
            t = k / n
            w = widths[i] + (widths[i + 1] - widths[i]) * t
            out |= m_ellipse(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, w / 2, w / 2)
    return out


def m_spikes(cx, cy, r, spikes):
    """Mèches en pointe autour d'un centre : (angle°, longueur au-delà de r, demi-largeur°)."""
    out = set()
    for ang, ln, wd in spikes:
        a = math.radians(ang)
        a0, a1 = math.radians(ang - wd), math.radians(ang + wd)
        rr = r - 1.5
        out |= m_poly([(cx + math.cos(a0) * rr, cy + math.sin(a0) * rr),
                       (cx + math.cos(a) * (r + ln), cy + math.sin(a) * (r + ln)),
                       (cx + math.cos(a1) * rr, cy + math.sin(a1) * rr)])
    return out


def shade(mask, R, flat=0.6):
    """Ombrage cellulaire : liseré clair haut/gauche, sombre bas/droite, flanc droit ombré."""
    layer = {}
    rows = {}
    for x, y in mask:
        a, b = rows.get(y, (x, x))
        rows[y] = (min(a, x), max(b, x))
    for x, y in mask:
        a, b = rows[y]
        t = (x - a) / max(1, b - a)
        up = (x, y - 1) not in mask
        lf = (x - 1, y) not in mask
        rt = (x + 1, y) not in mask
        dn = (x, y + 1) not in mask
        if up or lf:
            i = 4 if (up and lf) else 3
        elif rt or dn:
            i = 0 if (rt and dn) else 1
        else:
            i = 2 if t < flat else 1
        layer[(x, y)] = R[i]
    return layer


def ball(cx, cy, rx, ry, R, cuts=(-0.05, 0.33, 0.68, 0.93)):
    lx, ly, lz = -0.55, -0.65, 0.52
    n = math.sqrt(lx * lx + ly * ly + lz * lz)
    lx, ly, lz = lx / n, ly / n, lz / n
    layer = {}
    for x, y in m_ellipse(cx, cy, rx, ry):
        dx = (x + 0.5 - cx) / max(rx, 0.01)
        dy = (y + 0.5 - cy) / max(ry, 0.01)
        nz = math.sqrt(max(0.0, 1 - dx * dx - dy * dy))
        v = dx * lx + dy * ly + nz * lz
        layer[(x, y)] = R[sum(1 for k in cuts if v > k)]
    return layer


def fill(mask, col):
    return {p: col for p in mask}


# ---------------------------------------------------------------- composition

class Sprite:
    def __init__(self):
        self.c = Canvas(W, H)

    def put(self, layer, sep=True):
        """Pose un calque ; assombrit ce qu'il recouvre en bordure (séparation interne douce)."""
        if sep:
            for (x, y) in layer:
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    q = (x + dx, y + dy)
                    if q in layer:
                        continue
                    p = self.c.get(*q)
                    if p is not None and p != OUT:
                        self.c.px[q[1]][q[0]] = SEP
        for (x, y), col in layer.items():
            self.c.set(x, y, col)

    def fx(self, layer, over=False):
        """Effets (sans contour) : seulement sur le vide sauf `over`."""
        for (x, y), col in layer.items():
            if 0 <= x < W and 0 <= y < H and (over or self.c.px[y][x] is None):
                self.c.px[y][x] = col

    def finish(self):
        self.c.outline(OUT)
        return self.c


def offset(layer, dx, dy):
    return {(x + dx, y + dy): c for (x, y), c in layer.items()}


def merge(*layers):
    out = {}
    for l in layers:
        out.update(l)
    return out


# ---------------------------------------------------------------- objets (dessinés verticaux, pointe en haut)

class Item:
    """Petit dessin local (dict) pointe vers le haut, avec point de prise (grip)."""

    def __init__(self):
        self.px = {}

    def set(self, x, y, c):
        self.px[(int(round(x)), int(round(y)))] = c

    def rect(self, x, y, w, h, c):
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                self.set(xx, yy, c)

    def layer(self, mask_layer):
        self.px.update(mask_layer)


def place(item, grip, hand, deg):
    """Pivote l'objet de `deg` degrés (sens horaire, 0 = pointe en haut, 90 = vers la droite)."""
    a = math.radians(deg)
    ca, sa = math.cos(a), math.sin(a)
    gx, gy = grip
    hx, hy = hand
    if deg % 360 == 0:
        return {(x - gx + hx, y - gy + hy): c for (x, y), c in item.px.items()}
    pts = list(item.px)
    # boîte de destination
    corners = []
    for x, y in pts:
        u, v = x + 0.5 - gx - 0.5, y + 0.5 - gy - 0.5
        corners.append((hx + u * ca - v * sa, hy + u * sa + v * ca))
    x0 = int(min(p[0] for p in corners)) - 2
    x1 = int(max(p[0] for p in corners)) + 2
    y0 = int(min(p[1] for p in corners)) - 2
    y1 = int(max(p[1] for p in corners)) + 2
    out = {}
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            dx, dy = x - hx, y - hy
            u = dx * ca + dy * sa
            v = -dx * sa + dy * ca
            q = (int(math.floor(u + gx + 0.5)), int(math.floor(v + gy + 0.5)))
            if q in item.px:
                out[(x, y)] = item.px[q]
    return out


def sword_item(length, blade, guard, grip_c, width=2, tip_glint=True, pommel=None, curve=0):
    """Épée verticale : lame `width` px, garde, poignée, pommeau. Renvoie (Item, grip)."""
    it = Item()
    top = 1
    gy = top + length  # ligne de garde
    for y in range(top, gy):
        bend = int(round(curve * ((gy - y) / length) ** 2))
        if width == 2:
            it.set(2 - bend, y, blade[3]); it.set(3 - bend, y, blade[2])
        else:
            it.set(2 - bend, y, blade[3]); it.set(3 - bend, y, blade[2]); it.set(4 - bend, y, blade[1])
    bt = int(round(curve))
    it.set(2 - bt, top - 1, blade[4] if tip_glint else blade[3])
    it.set(2 - bt, top + 1, blade[4]); it.set(2 - bt, top + 2, blade[4])
    # garde
    for x in range(0, 5 + (width - 2)):
        it.set(x, gy, guard[2] if x < 2 else guard[1])
    it.set(0, gy - 1, guard[1]); it.set(4 + width - 2, gy - 1, guard[0])
    it.set(1, gy, guard[3])
    # poignée
    for y in range(gy + 1, gy + 4):
        it.set(2, y, grip_c[2] if y % 2 else grip_c[1]); it.set(3, y, grip_c[0])
    p = pommel or guard
    it.set(2, gy + 4, p[2]); it.set(3, gy + 4, p[1])
    return it, (2.5, gy + 2)


# ---------------------------------------------------------------- poses

POSES = {
    #        torse (dx,dy) tête (dx,dy) pied arr. (dx,lift) pied av.  mode
    'idle': dict(t=(0, 0), h=(0, 0), bf=(0, 0), ff=(0, 0), mode='idle', fr=0),
    'b':    dict(t=(0, 1), h=(0, 1), bf=(-1, 0), ff=(1, 1), mode='idle', fr=1),
    'atk':  dict(t=(1, 1), h=(2, 1), bf=(-3, 0), ff=(3, 0), mode='atk', fr=2),
}

HIP_Y = 30
HEAD = (19.5, 11.0)
HEAD_R = (8.0, 7.4)


def leg(sp, hip, foot_x, lift, pants, boot, far, boot_h=3, toe=1, cuff=None):
    fy = GROUND - lift
    P = dk(pants) if far else pants
    B = dk(boot) if far else boot
    knee = (hip[0] + (foot_x - hip[0]) * 0.5, (hip[1] + fy - boot_h) / 2)
    m = m_line([hip, knee, (foot_x, fy - boot_h + 0.5)], 3.2)
    lay = shade(m, P)
    bm = set()
    for y in range(fy - boot_h + 1, fy + 1):
        for x in range(int(foot_x) - 1, int(foot_x) + 2 + (toe if y >= fy - 1 else 0)):
            bm.add((x, y))
    lay.update(shade(bm, B))
    for x in range(int(foot_x) - 1, int(foot_x) + 2 + toe):
        lay[(x, fy)] = B[0]
    if cuff:
        C = dk(cuff) if far else cuff
        for x in range(int(foot_x) - 1, int(foot_x) + 2):
            lay[(x, fy - boot_h + 1)] = C[3] if x == int(foot_x) - 1 else C[2]
    sp.put(lay)


def legs(sp, P, pants, boot, **kw):
    tx, ty = P['t']
    (bdx, bl), (fdx, fl) = P['bf'], P['ff']
    leg(sp, (16 + tx * 0.5, HIP_Y + ty), 15 + bdx, bl, pants, boot, True, **kw)
    leg(sp, (20 + tx * 0.5, HIP_Y + ty), 21 + fdx, fl, pants, boot, False, **kw)


def arm(sp, pts, sleeve, hand_r, far=False, width=3.0, cuff=None, fist=1.6):
    S = dk(sleeve) if far else sleeve
    lay = shade(m_line(pts[:-1] + [pts[-1]], width), S)
    if cuff:
        C = dk(cuff) if far else cuff
        (x0, y0), (x1, y1) = pts[-2], pts[-1]
        cx, cy = x1 + (x0 - x1) * 0.3, y1 + (y0 - y1) * 0.3
        lay.update(fill(m_ellipse(cx, cy, 1.6, 1.6), C[2]))
        lay[(int(cx - 0.5), int(cy - 0.5))] = C[3]
    hx, hy = pts[-1]
    lay.update(ball(hx, hy, fist, fist, dk(hand_r) if far else hand_r))
    sp.put(lay)


# ---------------------------------------------------------------- tête

DEFAULT_BANG = {15: 17, 16: 15, 17: 10, 18: 8, 19: 9, 20: 7, 21: 8, 22: 9, 23: 7, 24: 8, 25: 9, 26: 8, 27: 10}


def head(sp, P, skin, hair, eye_r, bang=None, girl=True, mouth='smile', brow=False,
         hair_mask_extra=None, ring=True, paint=None, mask_face=None, blush=True, eye_shape='normal'):
    hx, hy = P['h']
    cx, cy = HEAD[0] + hx, HEAD[1] + hy
    bang = bang or DEFAULT_BANG
    headm = m_ellipse(cx, cy, *HEAD_R)
    face = {(x, y) for (x, y) in headm if (x - hx) in bang and y - hy >= bang[x - hx]}
    hairm = (m_ellipse(cx - 0.3, cy - 1.4, HEAD_R[0] + 0.8, HEAD_R[1] + 0.6) | headm) - face
    if hair_mask_extra:
        hairm |= {(x + hx, y + hy) for x, y in hair_mask_extra}
        hairm -= face
    lay = {}
    # visage
    for (x, y) in face:
        col = skin[2]
        if (x, y - 1) not in face:
            col = skin[1]  # ombre portée de la frange
        elif (x + 1, y) not in face or (x, y + 1) not in face:
            col = skin[1]
        elif (x - 1, y) not in face and (x, y - 1) in face:
            col = skin[3]
        lay[(x, y)] = col
    # cheveux
    hl = shade(hairm, hair, flat=0.55)
    if ring:  # anneau de lumière (reflet anime)
        for (x, y) in hairm:
            rx = x - hx
            yb = 4.6 + 0.05 * (rx - 17) ** 2
            if abs(y - hy - yb) < 0.6 and 11 <= rx <= 24 and (x, y - 1) in hairm:
                hl[(x, y)] = hair[4] if (rx % 3) else hair[3]
            elif abs(y - hy - yb - 1) < 0.6 and 12 <= rx <= 23 and rx % 2 == 0 and (x, y + 1) in hairm:
                hl[(x, y)] = hair[3]
    # pointes de frange plus sombres
    for x in range(15, 28):
        y = bang.get(x)
        if y is None:
            continue
        p = (x + hx, y - 1 + hy)
        if p in hl and p[1] - hy >= 6:
            hl[p] = hair[1]
    lay.update(hl)
    sp.put(lay, sep=False)
    # traits du visage
    f = {}
    ey = 11 + hy
    eyes = ((19 + hx, ey), (23 + hx, ey))
    for i, (ex, ey_) in enumerate(eyes):
        far = i == 0
        if eye_shape == 'fierce':
            f[(ex, ey_)] = OUT; f[(ex + 1, ey_)] = OUT
            f[(ex, ey_ + 1)] = WHITE; f[(ex + 1, ey_ + 1)] = eye_r[1]
            f[(ex, ey_ + 2)] = eye_r[0]; f[(ex + 1, ey_ + 2)] = eye_r[2]
        elif far:
            f[(ex, ey_)] = OUT; f[(ex + 1, ey_)] = OUT
            f[(ex, ey_ + 1)] = WHITE; f[(ex + 1, ey_ + 1)] = eye_r[0]
            f[(ex, ey_ + 2)] = eye_r[1]; f[(ex + 1, ey_ + 2)] = eye_r[1]
            f[(ex, ey_ + 3)] = eye_r[2]; f[(ex + 1, ey_ + 3)] = eye_r[1]
        else:  # oeil proche : 3 px de large
            for k in range(3):
                f[(ex + k, ey_)] = OUT
            f[(ex, ey_ + 1)] = WHITE; f[(ex + 1, ey_ + 1)] = eye_r[0]; f[(ex + 2, ey_ + 1)] = eye_r[0]
            f[(ex, ey_ + 2)] = eye_r[1]; f[(ex + 1, ey_ + 2)] = WHITE; f[(ex + 2, ey_ + 2)] = eye_r[1]
            f[(ex, ey_ + 3)] = eye_r[2]; f[(ex + 1, ey_ + 3)] = eye_r[2]; f[(ex + 2, ey_ + 3)] = eye_r[1]
        if girl and not far:
            f[(ex + 3, ey_ - 1)] = OUT  # cil
        if girl and far:
            f[(ex - 1, ey_ - 1)] = OUT
    if brow:
        bc = brow if isinstance(brow, str) else OUT
        f[(19 + hx, ey - 2)] = bc; f[(20 + hx, ey - 1)] = bc
        f[(24 + hx, ey - 1)] = bc; f[(23 + hx, ey - 1)] = bc; f[(25 + hx, ey - 2)] = bc; f[(26 + hx, ey - 2)] = bc
    my = 16 + hy
    if mask_face:
        for (x, y) in face:
            if y >= 15 + hy:
                f[(x, y)] = mask_face[2] if (x - 1, y) in face and (x, y - 1) in face else mask_face[3]
                if (x + 1, y) not in face or (x, y + 1) not in face:
                    f[(x, y)] = mask_face[1]
    elif mouth == 'smile':
        f[(22 + hx, my)] = MOUTH
    elif mouth == 'open':
        f[(22 + hx, my)] = MOUTH; f[(23 + hx, my)] = MOUTH; f[(22 + hx, my + 1)] = '#e0506a'
    elif mouth == 'grin':
        f[(21 + hx, my - 1)] = MOUTH; f[(22 + hx, my)] = WHITE; f[(23 + hx, my)] = WHITE
        f[(24 + hx, my - 1)] = MOUTH; f[(22 + hx, my + 1)] = MOUTH; f[(23 + hx, my + 1)] = MOUTH
    elif mouth == 'calm':
        f[(22 + hx, my)] = mix(MOUTH, skin[1], 0.4); f[(23 + hx, my)] = mix(MOUTH, skin[1], 0.4)
    if blush and not mask_face:
        f[(18 + hx, 15 + hy)] = BLUSH; f[(26 + hx, 15 + hy)] = BLUSH
    if paint:
        for p in paint:
            f[(p[0] + hx, p[1] + hy)] = BAR_PAINT
    for p, col in f.items():
        if p in face or col == OUT:
            sp.c.set(p[0], p[1], col)
    return face, hairm


def sparkle(layer, x, y, R, big=False):
    layer[(x, y)] = R[-1]
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        layer[(x + dx, y + dy)] = R[-3]
    if big:
        for dx, dy in ((2, 0), (-2, 0), (0, 2), (0, -2)):
            layer[(x + dx, y + dy)] = R[-5]


def arc(cx, cy, R, thick, a0, a1, FX, sy=1.0, lead=0.65, fade=0.35):
    """Croissant d'énergie : bord d'attaque clair, traînée qui s'effiloche."""
    out = {}
    n = len(FX)
    for y in range(H):
        for x in range(W):
            dx = x + 0.5 - cx
            dy = (y + 0.5 - cy) / sy
            r = math.hypot(dx, dy)
            a = math.degrees(math.atan2(dy, dx))
            t = (a - a0) / (a1 - a0)
            if not 0 <= t <= 1:
                continue
            prof = (t / lead) ** 0.7 if t < lead else math.cos((t - lead) / (1 - lead) * math.pi / 2) ** 0.6
            wt = thick * prof
            if wt < 0.6 or not (R - wt <= r <= R):
                continue
            s = (R - r) / wt
            if t < fade:
                if (x + y) % 2 and t < fade * 0.6:
                    continue
                s = min(1, s + (fade - t) / fade * 0.5)
            out[(x, y)] = FX[max(0, min(n - 1, n - 1 - int(s * n)))]
    return out


# ================================================================ 1. paladin d'azur

def azure_paladin(P):
    sp = Sprite()
    tx, ty = P['t']
    hx, hy = P['h']
    atk = P['mode'] == 'atk'
    # cape courte bleu nuit derrière
    cape = m_poly([(13 + tx, 19 + ty), (19 + tx, 19 + ty), (17 + tx, 31 + ty), (11 + tx - P['fr'] % 2, 33 + ty), (9 + tx - (1 if atk else 0), 31 + ty)])
    lay = shade(cape, dk(PAL_ARM))
    for y in range(29 + ty, 34 + ty):
        for x in range(8, 18):
            if (x, y) in cape and (x, y + 1) not in cape:
                lay[(x, y)] = GOLD[1]
    sp.put(lay)
    # bras arrière (tient le bouclier)
    bh = (12 + tx, 27 + ty) if not atk else (11 + tx, 25 + ty)
    arm(sp, [(15 + tx, 21 + ty), (13 + tx, 24 + ty), bh], PAL_ARM, STEEL, far=True)
    legs(sp, P, PAL_ARM, STEEL, cuff=GOLD)
    # buste : cuirasse bleue, faulds dorés
    skirt = m_poly([(13.5 + tx, 27 + ty), (23.5 + tx, 27 + ty), (25 + tx, 32 + ty), (12 + tx, 32 + ty)])
    lay = shade(skirt, PAL_ARM)
    for x in range(11 + tx, 26 + tx):
        if (x, 31 + ty) in skirt:
            lay[(x, 31 + ty)] = GOLD[2] if x < 19 + tx else GOLD[1]
    for y in range(28 + ty, 32 + ty):
        lay[(18 + tx, y)] = PAL_ARM[0]
    sp.put(lay)
    lay = ball(18.5 + tx, 23.5 + ty, 5.6, 5.4, PAL_ARM)
    for x in range(13 + tx, 25 + tx):
        if (x, 27 + ty) in lay:
            lay[(x, 27 + ty)] = GOLD[2] if x < 20 + tx else GOLD[1]
    lay[(19 + tx, 27 + ty)] = GOLD[4]
    # emblème doré sur le plastron
    lay[(20 + tx, 22 + ty)] = GOLD[3]; lay[(20 + tx, 23 + ty)] = GOLD[2]; lay[(21 + tx, 23 + ty)] = GOLD[1]
    lay[(19 + tx, 23 + ty)] = GOLD[3]; lay[(20 + tx, 24 + ty)] = GOLD[1]
    sp.put(lay)
    # tête
    bang = {15: 16, 16: 14, 17: 9, 18: 8, 19: 9, 20: 7, 21: 9, 22: 8, 23: 7, 24: 9, 25: 8, 26: 9, 27: 11}
    spikes = m_spikes(19, 10, 8, [(-160, 3, 12), (-130, 3, 12), (-100, 2.5, 12), (-70, 2, 12), (-40, 2, 12),
                                  (175, 2.5, 10), (150, 2, 10)])
    head(sp, P, SKIN, PAL_HAIR, PAL_EYE, bang=bang, girl=False, mouth='smile', brow=PAL_HAIR[0],
         hair_mask_extra=spikes)
    # diadème doré + gemme
    lay = {}
    for x in range(16, 27):
        y = 6 if x < 21 else 6
        lay[(x + hx, y + hy)] = GOLD[3] if x < 21 else GOLD[2]
    lay[(21 + hx, 5 + hy)] = PAL_BLADE[3]; lay[(21 + hx, 6 + hy)] = PAL_BLADE[1]; lay[(22 + hx, 6 + hy)] = GOLD[1]
    sp.put(lay)
    # épaulière avant
    lay = ball(22.5 + tx, 20 + ty, 3.6, 2.8, PAL_ARM)
    for x in range(19 + tx, 27 + tx):
        if (x, 22 + ty) in lay:
            lay[(x, 22 + ty)] = GOLD[2] if x < 23 + tx else GOLD[1]
    sp.put(lay)
    # bouclier rond (bras arrière, devant le flanc)
    scx, scy = (10.5 + tx, 27 + ty) if not atk else (10 + tx, 25 + ty)
    lay = ball(scx, scy, 5.2, 5.6, GOLD)
    inner = ball(scx + 0.2, scy + 0.1, 4.0, 4.4, PAL_ARM)
    lay.update(inner)
    for d in (-2, -1, 0, 1, 2):
        lay[(int(scx) + d, int(scy))] = GOLD[2] if d < 1 else GOLD[1]
        lay[(int(scx), int(scy) + d)] = GOLD[3] if d < 0 else GOLD[1]
    lay[(int(scx), int(scy))] = GOLD[4]
    lay[(int(scx) - 2, int(scy) - 3)] = PAL_ARM[4]
    sp.put(lay)
    # bras avant + épée
    if not atk:
        hand = (25 + tx, 27 + ty)
        arm(sp, [(22 + tx, 21 + ty), (24 + tx, 24 + ty), hand], PAL_ARM, STEEL, cuff=GOLD)
        it, g = sword_item(12, PAL_BLADE, GOLD, LEATHER, pommel=PAL_BLADE)
        sw = place(it, g, (hand[0] + 1, hand[1]), 22)
    else:
        hand = (27 + tx, 23 + ty)
        it, g = sword_item(8, PAL_BLADE, GOLD, LEATHER, pommel=PAL_BLADE)
        sw = place(it, g, (hand[0], hand[1]), 80)
    sp.put(sw)
    if atk:
        arm(sp, [(22 + tx, 21 + ty), (25 + tx, 23 + ty), hand], PAL_ARM, STEEL, cuff=GOLD)
    c = sp.finish()
    fx = {}
    if atk:
        fx.update(arc(8, 24, 31, 8, -42, 32, PAL_FX, sy=0.8, lead=0.7))
        sparkle(fx, 37, 13, PAL_FX)
    else:
        f = P['fr']
        for (x, y) in ((27, 8 - f), (29, 14 + f), (26, 4 + f)):
            fx[(x + tx, y + ty)] = PAL_FX[5 if (x + f) % 2 else 4]
        fx[(23 + tx, 6 + 2 * f)] = PAL_FX[3]
    sp.fx(fx)
    return c


# ================================================================ 2. lame rose

def rose_blade(P):
    sp = Sprite()
    tx, ty = P['t']
    hx, hy = P['h']
    atk = P['mode'] == 'atk'
    sw = P['fr'] % 2
    # couettes (derrière)
    t1 = [(14, 5), (9, 6), (5, 10), (3, 16 + sw), (4, 22 + sw), (6, 26)]
    t2 = [(15, 8), (11, 11), (9, 16), (9, 22 - sw), (11, 27)]
    if atk:
        t1 = [(14, 5), (9, 5), (4, 8), (1, 13), (1, 19), (3, 23)]
        t2 = [(15, 8), (10, 10), (6, 15), (6, 21), (8, 25)]
    for pts, ws, R in ((t2, [3, 4, 4, 3, 1], dk(ROSE_HAIR)), (t1, [3, 4.5, 5, 4.5, 3, 1], ROSE_HAIR)):
        m = m_tube([(x + hx, y + hy) for x, y in pts], ws)
        lay = shade(m, R)
        for i, (x, y) in enumerate(pts[1:-1]):
            lay[(x + hx + 1, y + hy)] = R[3]
        sp.put(lay)
    # bras arrière
    arm(sp, [(15 + tx, 21 + ty), (13 + tx, 24 + ty), (12 + tx, 27 + ty) if not atk else (11 + tx, 25 + ty)],
        ROSE_ARM, ROSE_ARM, far=True)
    legs(sp, P, ['#1a1428', '#2a2240', '#3a3058', '#4e4474', '#6a5e94'], ROSE_ARM, cuff=ROSE_PINK, boot_h=4)
    # jupe courte plissée (noire, liseré rose)
    skirt = m_poly([(14 + tx, 26 + ty), (23 + tx, 26 + ty), (26 + tx, 32 + ty), (11 + tx, 32 + ty)])
    lay = shade(skirt, ROSE_ARM)
    for x in range(10 + tx, 27 + tx):
        if (x, 31 + ty) in skirt:
            lay[(x, 31 + ty)] = ROSE_PINK[2] if x < 20 + tx else ROSE_PINK[1]
    for x in (15, 18, 21, 24):
        for y in range(28, 31):
            if (x + tx, y + ty) in skirt:
                lay[(x + tx, y + ty)] = ROSE_ARM[0]
    sp.put(lay)
    # corselet sombre, plastron à liseré rose
    body = m_poly([(14 + tx, 18 + ty), (23 + tx, 18 + ty), (23 + tx, 27 + ty), (14 + tx, 27 + ty)])
    lay = shade(body, ROSE_ARM)
    for y in range(20 + ty, 27 + ty):
        lay[(19 + tx, y)] = ROSE_PINK[2]
    lay[(18 + tx, 21 + ty)] = ROSE_PINK[3]; lay[(20 + tx, 21 + ty)] = ROSE_PINK[1]
    for x in range(14 + tx, 24 + tx):
        lay[(x, 26 + ty)] = ROSE_PINK[0] if x > 19 + tx else ROSE_PINK[1]
    lay[(19 + tx, 26 + ty)] = GOLD[3]
    sp.put(lay)
    # tête
    bang = {15: 16, 16: 13, 17: 9, 18: 8, 19: 10, 20: 7, 21: 8, 22: 10, 23: 8, 24: 7, 25: 9, 26: 10, 27: 12}
    head(sp, P, SKIN, ROSE_HAIR, ROSE_EYE, bang=bang, girl=True, mouth='open' if atk else 'smile')
    # rubans rouges aux attaches
    lay = {}
    for (x, y), col in (((13, 4), ROSE_BLADE[2]), ((14, 4), ROSE_BLADE[3]), ((12, 3), ROSE_BLADE[2]),
                        ((12, 5), ROSE_BLADE[1]), ((14, 6), ROSE_BLADE[1]), ((11, 3), ROSE_BLADE[1])):
        lay[(x + hx, y + hy)] = col
    sp.put(lay)
    # épaulière sombre à pointe
    lay = ball(22.5 + tx, 20 + ty, 3.4, 2.6, ROSE_ARM)
    lay[(20 + tx, 19 + ty)] = ROSE_PINK[3]; lay[(21 + tx, 18 + ty)] = ROSE_PINK[2]
    for x in range(19 + tx, 26 + tx):
        if (x, 22 + ty) in lay:
            lay[(x, 22 + ty)] = ROSE_PINK[1]
    sp.put(lay)
    it, g = sword_item(11, ROSE_BLADE, ROSE_PINK, ROSE_ARM, width=3, pommel=GOLD)
    if not atk:
        hand = (24 + tx, 27 + ty)
        arm(sp, [(22 + tx, 21 + ty), (24 + tx, 24 + ty), hand], ROSE_ARM, ROSE_ARM, cuff=ROSE_PINK)
        sp.put(place(it, g, (hand[0] + 1, hand[1]), 125))
    else:
        hand = (27 + tx, 19 + ty)
        sp.put(place(it, g, (hand[0], hand[1]), 50))
        arm(sp, [(22 + tx, 21 + ty), (25 + tx, 20 + ty), hand], ROSE_ARM, ROSE_ARM, cuff=ROSE_PINK)
    c = sp.finish()
    fx = {}
    if atk:
        fx.update(arc(16, 26, 23, 6, -80, 30, ROSE_FX, sy=0.9, lead=0.75))
        fx.update(arc(16, 26, 17, 2, -60, 20, ROSE_FX, sy=0.9))
        # pétales
        for x, y in ((36, 9), (38, 21), (33, 4)):
            fx[(x, y)] = ROSE_PINK[3]; fx[(x + 1, y)] = ROSE_PINK[2]
    else:
        f = P['fr']
        fx[(35, 35 - f)] = ROSE_PINK[3]; fx[(36, 35 - f)] = ROSE_PINK[2]
        fx[(31, 30 + f)] = ROSE_FX[5]
        fx[(5 + tx, 3 + f)] = ROSE_PINK[3]
    sp.fx(fx)
    return c


# ================================================================ 3. sorcière

def witch(P):
    sp = Sprite()
    tx, ty = P['t']
    hx, hy = P['h']
    atk = P['mode'] == 'atk'
    f = P['fr'] % 2
    # longue chevelure argentée dans le dos
    hair_back = m_poly([(12 + hx, 8 + hy), (17 + hx, 10 + hy), (17 + tx, 31 + ty), (13 + tx - f, 32 + ty),
                        (9 + tx - (2 if atk else f), 30 + ty), (8 + hx, 18 + hy)])
    lay = shade(hair_back, WIT_HAIR)
    for y in range(14, 31):
        for x in (12, 14):
            p = (x + tx + (y % 3 == 0), y + ty)
            if p in hair_back and (p[0] + 1, p[1]) in hair_back:
                lay[p] = WIT_HAIR[1]
    sp.put(lay)
    # bras arrière (manche évasée)
    arm(sp, [(15 + tx, 21 + ty), (13 + tx, 25 + ty), (13 + tx, 28 + ty)], WIT_DRESS, SKIN, far=True, width=3.6)
    # bottines sous la robe
    legs(sp, P, WIT_DRESS, ['#1a1028', '#2c1c40', '#46305e', '#644a84', '#8a70ac'], boot_h=3)
    # robe longue évasée
    dress = m_poly([(14 + tx, 18 + ty), (23 + tx, 18 + ty), (24 + tx, 25 + ty), (27 + tx, 36 + ty), (24 + tx, 37 + ty),
                    (18 + tx, 37.5 + ty), (12 + tx, 37 + ty), (9 + tx - f, 36 + ty), (13 + tx, 25 + ty)])
    lay = shade(dress, WIT_DRESS)
    for (x, y) in list(dress):
        if (x, y + 1) not in dress:
            lay[(x, y)] = GOLD[2] if x < 19 + tx else GOLD[1]
            if (x, y - 1) in dress:
                lay[(x, y - 1)] = WIT_DRESS[0]
    # plis
    for y in range(29 + ty, 36 + ty):
        lay[(15 + tx - (y - 29 - ty) // 3, y)] = WIT_DRESS[1]
        lay[(21 + tx + (y - 29 - ty) // 3, y)] = WIT_DRESS[1]
    # ceinture + boucle lune
    for x in range(13 + tx, 25 + tx):
        if (x, 25 + ty) in lay:
            lay[(x, 25 + ty)] = WIT_HAT[0]
    lay[(19 + tx, 25 + ty)] = GOLD[3]; lay[(20 + tx, 25 + ty)] = GOLD[2]
    # col blanc
    for x in range(17 + tx, 23 + tx):
        lay[(x, 19 + ty)] = WIT_HAIR[3]
    sp.put(lay)
    # tête (frange longue, mèches qui encadrent le visage)
    bang = {15: 17, 16: 16, 17: 10, 18: 9, 19: 8, 20: 9, 21: 8, 22: 9, 23: 8, 24: 9, 25: 9, 26: 12, 27: 16}
    side = [(27, y) for y in range(10, 20)] + [(28, y) for y in range(12, 19)] + [(26, y) for y in range(17, 21)]
    head(sp, P, SKIN, WIT_HAIR, WIT_EYE, bang=bang, girl=True, mouth='open' if atk else 'smile',
         hair_mask_extra=side)
    # grand chapeau pointu
    bob = 0
    brim = m_ellipse(19.5 + hx, 6.5 + hy + bob, 12, 2.4)
    cone = m_poly([(12 + hx, 6.5 + hy), (26 + hx, 6.5 + hy), (23 + hx, 2 + hy), (19 + hx, -0.5 + hy),
                   (13 + hx, -1 + hy), (8 + hx, 1 + hy + f), (14 + hx, 2 + hy)])
    cone = {p for p in cone if p[1] >= 0}
    lay = shade(brim, WIT_HAT)
    lay.update(shade(cone, WIT_HAT))
    for x in range(12 + hx, 27 + hx):
        if (x, 5 + hy) in cone:
            lay[(x, 5 + hy)] = GOLD[2] if x < 20 + hx else GOLD[1]
            lay[(x, 4 + hy)] = WIT_HAT[0] if (x, 4 + hy) in cone else lay.get((x, 4 + hy))
    for x in range(12 + hx, 27 + hx):
        if (x, 4 + hy) in lay and lay[(x, 4 + hy)] is None:
            del lay[(x, 4 + hy)]
    lay = {k: v for k, v in lay.items() if v is not None}
    # boucle étoile
    lay[(18 + hx, 5 + hy)] = GOLD[4]; lay[(18 + hx, 4 + hy)] = GOLD[3]; lay[(19 + hx, 5 + hy)] = GOLD[3]
    lay[(17 + hx, 5 + hy)] = GOLD[3]; lay[(18 + hx, 6 + hy)] = GOLD[1]
    # dessous du bord dans l'ombre
    for x in range(8 + hx, 32 + hx):
        if (x, 8 + hy) in brim:
            lay[(x, 8 + hy)] = WIT_HAT[0]
    sp.put(lay)
    # bras avant + bâton à orbe
    if not atk:
        hand = (26 + tx, 27 + ty)
        st = place(staff_item(), (0, 14), hand, 0)
        sp.put(st)
        arm(sp, [(22 + tx, 21 + ty), (24 + tx, 25 + ty), hand], WIT_DRESS, SKIN, width=3.6, cuff=GOLD)
        orb_c = (hand[0] + 2.5, hand[1] - 14 + 0.5)
    else:
        hand = (26 + tx, 22 + ty)
        st = place(staff_item(), (2, 14), hand, 35)
        sp.put(st)
        arm(sp, [(22 + tx, 21 + ty), (24 + tx, 22 + ty), hand], WIT_DRESS, SKIN, width=3.6, cuff=GOLD)
        a = math.radians(35)
        orb_c = (hand[0] + 0.5 + 14 * math.sin(a), hand[1] + 0.5 - 14 * math.cos(a))
    c = sp.finish()
    fx = {}
    ox, oy = orb_c
    if atk:
        # rayon / étoiles violettes vers l'avant
        for x in range(int(ox) + 2, 40):
            k = x - int(ox)
            for dy in (-1, 0, 1):
                if abs(dy) == 1 and k % 3 == 0:
                    continue
                fx[(x, int(oy) + dy)] = WIT_FX[6 if dy == 0 and k > 2 else 4 if dy == 0 else 3]
        for (x, y) in m_ellipse(ox, oy, 4.6, 4.6) - m_ellipse(ox, oy, 3.4, 3.4):
            if (x + y) % 2 == 0:
                fx[(x, y)] = WIT_FX[3]
        sparkle(fx, int(ox), int(oy) - 5, WIT_FX, big=True)
        for x, y in ((32, 3), (38, 16), (29, 5), (36, 21)):
            sparkle(fx, x, y, WIT_FX)
    else:
        for x, y in ((int(ox) - 3, int(oy) - 2 + f), (int(ox) + 3, int(oy) + 1 - f), (int(ox) + 1, int(oy) - 4)):
            fx[(x, y)] = WIT_FX[5 if (x + f) % 2 else 4]
    sp.fx(fx)
    return c


def staff_item():
    """Bâton de bois noueux, orbe violette dans une griffe dorée. Prise en (2, 14)."""
    it = Item()
    for y in range(3, 28):
        it.set(1, y, WOOD[3] if y % 5 else WOOD[2]); it.set(2, y, WOOD[2]); it.set(3, y, WOOD[1])
    it.layer(ball(2.5, 0.5, 2.6, 2.6, WIT_ORB))
    it.set(1, -1, WHITE)
    it.set(0, 2, GOLD[2]); it.set(4, 2, GOLD[1]); it.set(-1, 0, GOLD[2]); it.set(5, 0, GOLD[1])
    it.set(1, 3, GOLD[3]); it.set(2, 3, GOLD[2]); it.set(3, 3, GOLD[1])
    it.set(1, 7, GOLD[2]); it.set(2, 7, GOLD[2]); it.set(3, 7, GOLD[1])
    return it


# ================================================================ 4. archère elfe

def elf_archer(P):
    sp = Sprite()
    tx, ty = P['t']
    hx, hy = P['h']
    atk = P['mode'] == 'atk'
    f = P['fr'] % 2
    # carquois dans le dos, plumes vertes
    q = m_poly([(9 + tx, 15 + ty), (12 + tx, 13 + ty), (17 + tx, 27 + ty), (14 + tx, 29 + ty)])
    lay = shade(q, LEATHER)
    for p in ((10, 13), (9, 12), (11, 11), (10, 10), (12, 12), (12, 10)):
        lay[(p[0] + tx, p[1] + ty)] = ELF_GRN[3] if p[1] % 2 else ELF_GRN[2]
    lay[(10 + tx, 17 + ty)] = GOLD[2]; lay[(11 + tx, 16 + ty)] = GOLD[3]
    sp.put(lay)
    # cheveux longs dans le dos (tresse)
    hb = m_tube([(14 + hx, 9 + hy), (12 + hx, 14 + hy), (12 + tx - f, 20 + ty), (13 + tx - f, 25 + ty)], [6, 5.5, 3.5, 1.5])
    lay = shade(hb, ELF_HAIR)
    for y in range(15, 25, 2):
        p = (12 + tx - f, y + ty)
        if p in hb:
            lay[p] = ELF_HAIR[1]
    sp.put(lay)
    # cape courte verte
    cape = m_poly([(13 + tx, 18 + ty), (18 + tx, 18 + ty), (15 + tx, 28 + ty), (10 + tx - f, 29 + ty)])
    sp.put(shade(cape, dk(ELF_GRN)))
    # bras arrière
    if atk:
        arm(sp, [(16 + tx, 21 + ty), (20 + tx, 22 + ty), (23 + tx, 20 + ty)], ELF_LEA, SKIN, far=True)
    else:
        arm(sp, [(15 + tx, 21 + ty), (13 + tx, 24 + ty), (13 + tx, 27 + ty)], ELF_LEA, SKIN, far=True)
    legs(sp, P, ['#3a2a20', '#5a4232', '#7a5c44', '#9a7a5a', '#c0a07a'], ELF_LEA, boot_h=5, cuff=ELF_GRN)
    # tunique verte + gilet de cuir
    tun = m_poly([(14 + tx, 18 + ty), (23 + tx, 18 + ty), (24 + tx, 31 + ty), (21 + tx, 32 + ty), (18 + tx, 31 + ty),
                  (15 + tx, 32 + ty), (13 + tx, 31 + ty)])
    lay = shade(tun, ELF_GRN)
    vest = m_poly([(14 + tx, 19 + ty), (23 + tx, 19 + ty), (23 + tx, 27 + ty), (14 + tx, 27 + ty)])
    lay.update(shade(vest, ELF_LEA))
    for y in range(19 + ty, 27 + ty):
        lay[(20 + tx, y)] = ELF_GRN[2] if y < 23 + ty else ELF_LEA[0]
    for x in range(14 + tx, 24 + tx):
        lay[(x, 26 + ty)] = LEATHER[0]
    lay[(18 + tx, 26 + ty)] = GOLD[3]; lay[(19 + tx, 26 + ty)] = GOLD[2]
    # sangle du carquois en travers
    for i in range(7):
        lay[(16 + tx + i, 19 + ty + i)] = LEATHER[1]
    lay[(19 + tx, 22 + ty)] = GOLD[3]
    sp.put(lay)
    # tête : oreille pointue + feuille
    bang = {15: 16, 16: 15, 17: 9, 18: 8, 19: 7, 20: 8, 21: 9, 22: 7, 23: 8, 24: 9, 25: 9, 26: 10, 27: 13}
    face, hairm = head(sp, P, SKIN, ELF_HAIR, ELF_EYE, bang=bang, girl=True, mouth='calm' if atk else 'smile',
                       hair_mask_extra=[(26, 12), (27, 12), (27, 11), (26, 11)])
    ear = m_poly([(15 + hx, 11 + hy), (16.5 + hx, 13 + hy), (14.5 + hx, 14 + hy), (9 + hx, 8 + hy - f * 0)])
    lay = shade(ear, SKIN)
    lay[(13 + hx, 11 + hy)] = SKIN[1]; lay[(14 + hx, 12 + hy)] = SKIN[1]
    sp.put(lay)
    lay = {}
    for (x, y), col in (((17, 3), ELF_GRN[3]), ((18, 3), ELF_GRN[2]), ((18, 2), ELF_GRN[4]), ((19, 2), ELF_GRN[3]),
                        ((16, 4), ELF_GRN[2]), ((17, 4), ELF_GRN[1]), ((20, 1), ELF_GRN[3]), ((15, 4), GOLD[3])):
        lay[(x + hx, y + hy)] = col
    sp.put(lay)
    # arc long
    if not atk:
        hand = (25 + tx, 27 + ty)
        bow = bow_layer(hand[0] + 2, hand[1], 12, 3, 0)
        sp.put(bow)
        arm(sp, [(22 + tx, 21 + ty), (24 + tx, 25 + ty), hand], ELF_LEA, SKIN, cuff=ELF_GRN)
    else:
        hand = (29 + tx, 21 + ty)
        arm(sp, [(22 + tx, 21 + ty), (26 + tx, 21 + ty), hand], ELF_LEA, SKIN, cuff=ELF_GRN)
        bow = bow_layer(hand[0], hand[1], 13, 4, 6, string_x=24 + tx)
        sp.put(bow)
        sp.put(ball(24 + tx, 20 + ty, 1.6, 1.6, SKIN))  # main qui tire la corde
    c = sp.finish()
    fx = {}
    if atk:
        ay = 20 + ty
        for x in range(23 + tx, 39):
            fx[(x, ay)] = ELF_FX[5] if x > 33 else ELF_FX[4]
        fx[(39, ay)] = WHITE; fx[(38, ay - 1)] = ELF_FX[4]; fx[(38, ay + 1)] = ELF_FX[4]
        fx[(37, ay - 1)] = ELF_FX[3]; fx[(37, ay + 1)] = ELF_FX[3]
        for x in range(22 + tx, 26 + tx):
            fx[(x, ay - 1)] = ELF_FX[3]; fx[(x, ay + 1)] = ELF_FX[3]
        for x in range(27 + tx, 37, 2):
            fx[(x, ay - 2)] = ELF_FX[2]; fx[(x + 1, ay + 2)] = ELF_FX[2]
        sp.fx(fx, over=True)
        sp.fx({(33, 15): ELF_FX[5], (36, 25): ELF_FX[4], (31, 13): ELF_FX[3]})
    else:
        fl = P['fr']
        fx[(5, 9 + fl)] = ELF_FX[5]; fx[(30 + tx, 20 - fl)] = ELF_FX[4]; fx[(31, 32 + fl)] = ELF_FX[3]
        sp.fx(fx)
    return c


def bow_layer(gx, gy, half, bulge, extra, string_x=None):
    """Arc long vertical tenu en (gx, gy) ; ventre vers la droite. Corde vers string_x."""
    lay = {}
    tips = []
    for s in (-1, 1):
        prev = None
        for k in range(0, half * 3 + 1):
            t = k / (half * 3)
            y = gy + s * t * half
            x = gx + bulge * math.sin((1 - t) * math.pi / 2) * 0.6 + bulge * 0.4 * (1 - t * t) - extra * t * t * 0.4
            px = (int(round(x)), int(round(y)))
            lay[px] = WOOD[3] if s < 0 else WOOD[2]
            lay[(px[0] + 1, px[1])] = WOOD[1]
            prev = px
        tips.append(prev)
    # ornements dorés aux pointes, poignée de cuir
    for tp in tips:
        lay[tp] = GOLD[3]; lay[(tp[0] - 1, tp[1])] = GOLD[2]
    for dy in (-1, 0, 1):
        p = (int(round(gx + bulge)), gy + dy)
        lay[p] = LEATHER[2]
    lay[(int(round(gx + bulge)), gy - 2)] = GOLD[2]
    lay[(int(round(gx + bulge)), gy + 2)] = GOLD[2]
    # corde
    sx = string_x
    (x0, y0), (x1, y1) = tips
    pts = [(x0, y0), (sx, gy), (x1, y1)] if sx is not None else [(x0, y0), (x1, y1)]
    for (ax, ay), (bx, by) in zip(pts, pts[1:]):
        n = int(max(abs(bx - ax), abs(by - ay))) * 2 + 1
        for i in range(n + 1):
            t = i / n
            p = (int(round(ax + (bx - ax) * t)), int(round(ay + (by - ay) * t)))
            if p not in lay:
                lay[p] = '#e8e0c8'
    return lay


# ================================================================ 5. grand prêtre

def high_priest(P):
    sp = Sprite()
    tx, ty = P['t']
    hx, hy = P['h']
    atk = P['mode'] == 'atk'
    f = P['fr'] % 2
    # étole bleue qui flotte derrière
    st = m_tube([(15 + tx, 20 + ty), (12 + tx, 26 + ty), (10 + tx - f, 32 + ty)], [3, 3, 2.5])
    lay = shade(st, PRI_BLUE)
    lay[(10 + tx - f, 32 + ty)] = GOLD[2]; lay[(11 + tx - f, 32 + ty)] = GOLD[1]
    sp.put(lay)
    arm(sp, [(15 + tx, 21 + ty), (13 + tx, 25 + ty), (14 + tx, 28 + ty)], PRI_ROBE, SKIN, far=True, width=3.8)
    legs(sp, P, PRI_ROBE, ['#5a3a22', '#8a5a30', '#b88040', '#dca866', '#f4d090'], boot_h=2)
    # robe longue blanche
    robe = m_poly([(14 + tx, 18 + ty), (23 + tx, 18 + ty), (24 + tx, 27 + ty), (26 + tx, 37 + ty), (11 + tx - f, 37 + ty),
                   (13 + tx, 27 + ty)])
    lay = shade(robe, PRI_ROBE)
    for (x, y) in list(robe):
        if (x, y + 1) not in robe:
            lay[(x, y)] = GOLD[2] if x < 19 + tx else GOLD[1]
    # bande dorée centrale + croix solaire
    for y in range(20 + ty, 37 + ty):
        lay[(20 + tx + (y - 20 - ty) // 8, y)] = GOLD[2]
        lay[(21 + tx + (y - 20 - ty) // 8, y)] = GOLD[1]
    for y in range(29 + ty, 36 + ty):
        lay[(16 + tx - (y - 29 - ty) // 3, y)] = PRI_ROBE[1]
    # ceinture
    for x in range(13 + tx, 25 + tx):
        if (x, 26 + ty) in lay:
            lay[(x, 26 + ty)] = PRI_BLUE[2] if x < 20 + tx else PRI_BLUE[1]
    lay[(20 + tx, 26 + ty)] = GOLD[4]; lay[(21 + tx, 26 + ty)] = GOLD[2]
    sp.put(lay)
    # mantelet / col doré
    cap = m_poly([(13 + tx, 18 + ty), (25 + tx, 18 + ty), (26 + tx, 22 + ty), (12 + tx, 22 + ty)])
    lay = shade(cap, PRI_ROBE)
    for x in range(12 + tx, 27 + tx):
        if (x, 22 + ty) in cap or (x, 21 + ty) in cap:
            lay[(x, 21 + ty)] = GOLD[3] if x < 19 + tx else GOLD[2]
    lay[(19 + tx, 21 + ty)] = PRI_BLUE[3]; lay[(20 + tx, 21 + ty)] = PRI_BLUE[2]
    sp.put(lay)
    # tête : cheveux courts blonds, raie sur le côté
    bang = {15: 15, 16: 13, 17: 9, 18: 8, 19: 7, 20: 7, 21: 8, 22: 8, 23: 9, 24: 8, 25: 9, 26: 10, 27: 11}
    head(sp, P, SKIN, PRI_HAIR, PRI_EYE, bang=bang, girl=False, mouth='open' if atk else 'smile', brow=PRI_HAIR[0])
    # couronne de laurier dorée
    lay = {}
    for x in range(13, 18):
        lay[(x + hx, 6 + hy - (1 if x > 15 else 0))] = GOLD[3] if x % 2 else GOLD[2]
    lay[(12 + hx, 7 + hy)] = GOLD[1]; lay[(14 + hx, 5 + hy)] = GOLD[4]
    sp.put(lay)
    # bâton solaire
    if not atk:
        hand = (26 + tx, 26 + ty)
        sp.put(place(sun_staff(), (1, 20), hand, 0))
        arm(sp, [(22 + tx, 21 + ty), (24 + tx, 24 + ty), hand], PRI_ROBE, SKIN, width=3.8, cuff=GOLD)
        sun = (hand[0] + 2.5, hand[1] - 20 + 1.5)
    else:
        hand = (26 + tx, 20 + ty)
        sp.put(place(sun_staff(), (3, 12), hand, 40))
        arm(sp, [(22 + tx, 21 + ty), (24 + tx, 21 + ty), hand], PRI_ROBE, SKIN, width=3.8, cuff=GOLD)
        a = math.radians(40)
        sun = (hand[0] + 0.5 + 10.5 * math.sin(a), hand[1] + 0.5 - 10.5 * math.cos(a))
    c = sp.finish()
    fx = {}
    sx, sy = int(sun[0]), int(sun[1])
    if atk:
        for ang in range(0, 360, 30):
            a = math.radians(ang)
            for r in range(6, 9 if ang % 60 == 0 else 8):
                fx[(int(round(sx + math.cos(a) * r)), int(round(sy + math.sin(a) * r)))] = PRI_FX[6 - (r - 6)]
        for x, y in ((36, 22), (33, 30), (38, 14)):
            sparkle(fx, x, y, PRI_FX)
    else:
        for x, y in ((sx - 5, sy + 2 - f), (sx + 5, sy - 1 + f), (sx + 1, sy - 6 + f)):
            fx[(x, y)] = PRI_FX[5 if (x + f) % 2 else 4]
    sp.fx(fx)
    return c


def sun_staff():
    """Bâton doré surmonté d'un soleil rayonnant. Prise en (3, 20)."""
    it = Item()
    for y in range(4, 34):
        it.set(2, y, GOLD[3] if y % 6 else GOLD[4]); it.set(3, y, GOLD[2]); it.set(4, y, GOLD[1])
    it.layer(ball(3.5, 1.5, 3.2, 3.2, PRI_FX[1:6]))
    it.set(3, 1, PRI_FX[6]); it.set(2, 0, PRI_FX[6])
    for ang in range(0, 360, 45):
        a = math.radians(ang)
        for r in (4, 5):
            if r == 5 and ang % 90:
                continue
            it.set(3.5 + math.cos(a) * r - 0.5, 1.5 + math.sin(a) * r - 0.5, GOLD[3] if r == 4 else GOLD[2])
    it.set(2, 6, PRI_BLUE[3]); it.set(3, 6, PRI_BLUE[2]); it.set(4, 6, PRI_BLUE[1])
    return it


# ================================================================ 6. ninja

def ninja(P):
    sp = Sprite()
    tx, ty = P['t']
    hx, hy = P['h']
    atk = P['mode'] == 'atk'
    f = P['fr'] % 2
    # longue queue de cheval
    if atk:
        pts = [(13, 5), (8, 5), (3, 8), (0, 12), (-1, 16)]
    else:
        pts = [(13, 5), (9, 6), (6, 10), (5 - f, 17), (6 - f, 24), (8 - f, 28)]
    m = m_tube([(x + hx, y + hy) for x, y in pts], [3.5, 4.5, 4.5, 4, 2.5, 1][:len(pts)])
    lay = shade(m, NIN_HAIR)
    for x, y in pts[1:-1]:
        lay[(x + hx + 1, y + hy)] = NIN_HAIR[3]
    sp.put(lay)
    # bandeau : pans flottants
    # écharpe flottante
    sc = [(15 + tx, 19 + ty), (11 + tx, 20 + ty + f), (7 + tx, 22 + ty), (4 + tx, 21 + ty + f)] if not atk else \
        [(15 + tx, 19 + ty), (10 + tx, 18 + ty), (5 + tx, 18 + ty), (1 + tx, 16 + ty)]
    sp.put(shade(m_tube(sc, [3, 3, 2.5, 1.5]), NIN_PUR))
    arm(sp, [(15 + tx, 21 + ty), (13 + tx, 24 + ty), (12 + tx, 27 + ty) if not atk else (10 + tx, 24 + ty)],
        NIN_GI, NIN_GI, far=True)
    legs(sp, P, NIN_GI, ['#101018', '#20202e', '#363648', '#4e4e66', '#707090'], boot_h=3,
         cuff=['#3a3a52', '#56567a', '#8a8ab0', '#b8b8d8', '#e0e0f4'])
    body = m_poly([(14 + tx, 18 + ty), (23 + tx, 18 + ty), (23.5 + tx, 30 + ty), (13.5 + tx, 30 + ty)])
    lay = shade(body, NIN_GI)
    # col croisé
    for i in range(5):
        lay[(17 + tx + i, 19 + ty + i)] = NIN_GI[4] if i < 3 else NIN_GI[3]
    # ceinture violette
    for x in range(13 + tx, 25 + tx):
        for y in (26, 27):
            if (x, y + ty) in lay:
                lay[(x, y + ty)] = NIN_PUR[2] if y == 26 else NIN_PUR[1]
    lay[(14 + tx, 26 + ty)] = NIN_PUR[3]
    sp.put(lay)
    # tête : masque sur le bas du visage
    bang = {15: 16, 16: 14, 17: 9, 18: 7, 19: 9, 20: 8, 21: 7, 22: 9, 23: 8, 24: 8, 25: 10, 26: 9, 27: 11}
    head(sp, P, SKIN, NIN_HAIR, NIN_EYE, bang=bang, girl=True, eye_shape='normal',
         mask_face=['#0e0e1a', '#22223a', '#34345a', '#4a4a7a'])
    # bandeau frontal (plaque d'acier)
    lay = {}
    for x in range(15, 28):
        y = 7 if x < 22 else 7
        lay[(x + hx, y + hy)] = NIN_PUR[2] if x < 22 else NIN_PUR[1]
    for x in range(21, 25):
        lay[(x + hx, 6 + hy)] = STEEL[3]; lay[(x + hx, 7 + hy)] = STEEL[2]
    lay[(21 + hx, 6 + hy)] = STEEL[4]
    sp.put(lay)
    it, g = sword_item(14, NIN_BLADE, ['#20202e', '#363648', GOLD[2], GOLD[3]], NIN_PUR, width=2, curve=1.2,
                       pommel=NIN_PUR)
    if not atk:
        hand = (24 + tx, 25 + ty)
        sp.put(place(it, g, (hand[0] + 1, hand[1]), 45))
        arm(sp, [(22 + tx, 21 + ty), (24 + tx, 23 + ty), hand], NIN_GI, NIN_GI,
            cuff=['#3a3a52', '#56567a', '#8a8ab0', '#b8b8d8'])
    else:
        hand = (27 + tx, 22 + ty)
        arm(sp, [(22 + tx, 21 + ty), (25 + tx, 22 + ty), hand], NIN_GI, NIN_GI,
            cuff=['#3a3a52', '#56567a', '#8a8ab0', '#b8b8d8'])
        sp.put(place(it, g, (hand[0], hand[1]), 95))
    c = sp.finish()
    fx = {}
    if atk:
        # traits de vitesse + entaille
        for y, x0, x1 in ((15, 2, 10), (31, 0, 8), (35, 3, 9), (11, 30, 39)):
            for x in range(x0, x1):
                if (x + y) % 3:
                    fx[(x, y)] = NIN_FX[3 if x < (x0 + x1) / 2 else 4]
        fx.update(arc(20, 30, 19, 3, -75, -5, NIN_FX, sy=0.6, lead=0.8))
    else:
        fl = P['fr']
        fx[(12 + tx, 37 - fl)] = NIN_FX[4]; fx[(33, 30 + fl)] = NIN_FX[5]; fx[(9 + tx, 33 + fl)] = NIN_FX[3]
    sp.fx(fx)
    return c


# ================================================================ 7. barbare

def barbarian(P):
    sp = Sprite()
    tx, ty = P['t']
    hx, hy = P['h']
    atk = P['mode'] == 'atk'
    f = P['fr'] % 2
    axe = axe_item()
    if atk:
        hand = (25 + tx, 24 + ty)
        ax = place(axe, (5, 18), hand, 100)
    else:
        hand = (24 + tx, 26 + ty)
        ax = place(axe, (5, 30), hand, -55)
    # bras arrière (nu, bracelet)
    arm(sp, [(14 + tx, 21 + ty), (12 + tx, 25 + ty), (12 + tx, 28 + ty) if not atk else (10 + tx, 25 + ty)],
        TAN, TAN, far=True, width=3.6, cuff=LEATHER, fist=1.9)
    legs(sp, P, ['#3a2418', '#5a3a26', '#7a5636', '#9a744c', '#c09a6a'], BAR_FUR, boot_h=4, cuff=BAR_FUR, toe=1)
    # pagne de fourrure
    kilt = m_poly([(13 + tx, 26 + ty), (24 + tx, 26 + ty), (26 + tx, 33 + ty), (11 + tx, 33 + ty)])
    lay = shade(kilt, BAR_KILT)
    for x in range(10 + tx, 27 + tx):
        if (x, 32 + ty) in kilt and x % 2:
            del lay[(x, 32 + ty)]
    for x in range(10 + tx, 27 + tx, 3):
        if (x, 30 + ty) in lay:
            for y in range(28 + ty, 32 + ty):
                if (x, y) in lay:
                    lay[(x, y)] = BAR_KILT[0]
    sp.put(lay)
    # torse nu musclé
    body = m_poly([(13 + tx, 18 + ty), (24 + tx, 18 + ty), (24.5 + tx, 24 + ty), (23 + tx, 27 + ty), (14 + tx, 27 + ty),
                   (12.5 + tx, 24 + ty)])
    lay = shade(body, TAN)
    lay[(19 + tx, 21 + ty)] = TAN[1]; lay[(20 + tx, 22 + ty)] = TAN[1]; lay[(18 + tx, 22 + ty)] = TAN[1]
    lay[(19 + tx, 24 + ty)] = TAN[1]; lay[(20 + tx, 24 + ty)] = TAN[1]
    lay[(16 + tx, 20 + ty)] = TAN[3]; lay[(17 + tx, 20 + ty)] = TAN[3]
    # peinture de guerre sur le torse
    lay[(21 + tx, 20 + ty)] = BAR_PAINT; lay[(22 + tx, 21 + ty)] = BAR_PAINT; lay[(21 + tx, 22 + ty)] = BAR_PAINT
    # ceinture à boucle crâne
    for x in range(12 + tx, 26 + tx):
        for y in (26, 27):
            if (x, y + ty) in lay or (x, y + ty) in kilt:
                lay[(x, y + ty)] = LEATHER[2] if y == 26 else LEATHER[0]
    lay[(19 + tx, 26 + ty)] = STEEL[4]; lay[(20 + tx, 26 + ty)] = STEEL[3]
    lay[(19 + tx, 27 + ty)] = STEEL[2]; lay[(20 + tx, 27 + ty)] = STEEL[1]
    sp.put(lay)
    if not atk:
        sp.put(ax)  # la hache repose sur l'épaule
    # crinière sauvage
    spikes = m_spikes(18.5, 10.5, 8.5, [(-155, 4, 17), (-118, 4, 17), (-82, 3.5, 17), (-48, 3, 16),
                                        (-18, 1.5, 12), (178, 4, 16), (145, 3, 15)])
    bang = {15: 17, 16: 15, 17: 10, 18: 8, 19: 9, 20: 7, 21: 9, 22: 8, 23: 7, 24: 9, 25: 9, 26: 10, 27: 13}
    head(sp, P, TAN, BAR_HAIR, BAR_EYE, bang=bang, girl=False, mouth='grin', brow=True, eye_shape='fierce',
         hair_mask_extra=spikes, paint=[(23, 15), (23, 16), (25, 15), (25, 16), (19, 15), (19, 16), (21, 6), (21, 7)], blush=False)
    # mantelet de fourrure sur les épaules
    fur = m_ellipse(18 + tx, 19 + ty, 7, 2.2)
    lay = shade(fur, BAR_FUR)
    for x in range(10 + tx, 28 + tx):
        if (x, 21 + ty) in fur and x % 2 == 0:
            lay[(x, 22 + ty)] = BAR_FUR[1]
    for x in range(11 + tx, 27 + tx, 2):
        if (x, 18 + ty) in lay:
            lay[(x, 18 + ty)] = BAR_FUR[4]
    sp.put(lay)
    lay = ball(23.5 + tx, 20 + ty, 3.5, 2.8, BAR_FUR)
    lay[(23 + tx, 18 + ty)] = STEEL[4]; lay[(24 + tx, 18 + ty)] = STEEL[2]  # dent / griffe
    sp.put(lay)
    if atk:
        sp.put(ax)
    arm(sp, [(23 + tx, 21 + ty), (25 + tx, 23 + ty) if not atk else (25 + tx, 22 + ty), hand], TAN, TAN,
        width=3.8, cuff=LEATHER, fist=1.9)
    c = sp.finish()
    fx = {}
    if atk:
        fx.update(arc(18, 30, 21, 6, -95, 20, BAR_FX, sy=0.95, lead=0.72))
        for x, y in ((35, 37), (38, 33), (32, 38)):
            fx[(x, y)] = BAR_FX[4]
    else:
        fl = P['fr']
        for x, y in ((31, 2 + fl), (24, 6 - fl), (33, 10 + fl)):
            fx[(x + tx, y)] = BAR_FX[4 if (x + fl) % 2 else 3]
    sp.fx(fx)
    return c


def axe_item():
    """Grande hache à double tranchant, fer rougeoyant. Prise en (5, 26)."""
    it = Item()
    for y in range(2, 33):
        it.set(4, y, WOOD[3] if y % 4 else WOOD[2]); it.set(5, y, WOOD[2]); it.set(6, y, WOOD[1])
    for y in (16, 17, 18):
        it.set(4, y, LEATHER[3]); it.set(5, y, LEATHER[2]); it.set(6, y, LEATHER[1])
    # deux fers en croissant
    for s in (-1, 1):
        pts = [(5, 3), (5 + s * 6, 0), (5 + s * 8, 3), (5 + s * 8.5, 7), (5 + s * 8, 11), (5 + s * 6, 14), (5, 11)]
        m = m_poly(pts)
        lay = shade(m, BAR_AXE)
        for (x, y) in m:
            edge = all((x + s * k, y) not in m for k in (1,))
            if edge:
                lay[(x, y)] = BAR_FX[5] if y < 7 else BAR_FX[4]
            elif all((x + s * k, y) in m for k in (1,)) and (x + s * 2, y) not in m:
                lay[(x, y)] = BAR_FX[3]
        # rune rouge
        lay[(5 + s * 4, 6)] = BAR_FX[2]; lay[(5 + s * 4, 7)] = BAR_FX[3]; lay[(5 + s * 4, 8)] = BAR_FX[2]
        it.layer(lay)
    # douille et pointe
    for y in range(3, 12):
        it.set(4, y, STEEL[3]); it.set(5, y, STEEL[2]); it.set(6, y, STEEL[1])
    it.set(5, 0, STEEL[4]); it.set(5, 1, STEEL[3]); it.set(5, 2, STEEL[2]); it.set(4, 1, STEEL[4])
    it.set(5, 7, BAR_FX[4])
    it.set(5, 33, STEEL[2]); it.set(4, 33, STEEL[3]); it.set(6, 33, STEEL[1])
    return it


# ---------------------------------------------------------------- assemblage

ALLIES = [
    ('azure_paladin', azure_paladin),
    ('rose_blade', rose_blade),
    ('witch', witch),
    ('elf_archer', elf_archer),
    ('high_priest', high_priest),
    ('ninja', ninja),
    ('barbarian', barbarian),
]


def build():
    """Renvoie {nom: (canvas, extra)}."""
    out = {}
    for aid, fn in ALLIES:
        out[f'ally_{aid}'] = (fn(POSES['idle']), {})
        out[f'ally_{aid}_b'] = (fn(POSES['b']), {})
        out[f'ally_{aid}_atk'] = (fn(POSES['atk']), {})
    return out
