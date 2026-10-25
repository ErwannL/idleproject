"""Alliés invocables de rareté R (chibi 16 bits, face à DROITE, lumière en haut à gauche).

Chaque allié : 3 images sur le même canvas 40×40, pieds sur y=39, corps centré vers x≈18 :
  ally_<id>      repos
  ally_<id>_b    repos / marche (petit rebond, un pas)
  ally_<id>_atk  attaque (arme portée vers l'avant, sort lancé, arc bandé)
Couleurs fixes (pas de calques teintables).
"""
import math

from lib import Canvas, mix

W, H = 40, 40
G = 39  # ligne des pieds
OUT = '#1a1226'
INK = '#1a1226'
WHITE = '#fbfbff'
BLUSH = '#ff8a9a'
MOUTH = '#8a2a3a'
MOUTH_IN = '#c8384a'

# ---------------------------------------------------------------- palettes (sombre -> clair, teinte décalée)

SKIN = ['#8e4a4a', '#d0806a', '#f6b48e', '#ffd4b0', '#ffeedc']
STEEL = ['#2a2e44', '#4e5672', '#7c88a4', '#b4c0d4', '#eef2f8']
DSTEEL = ['#120f22', '#221f3a', '#383a5c', '#5c6488', '#98a2c8']
HELM = ['#1a1830', '#33355a', '#525a84', '#7e88b2', '#c4cce8']
BLUE = ['#141e5e', '#1f3fa8', '#2f6ee0', '#5aa0ff', '#b0dcff']
RED = ['#3e0a26', '#86142e', '#cc2632', '#ff5c46', '#ffa880']
GOLD = ['#6e3418', '#b8701e', '#e8b236', '#ffe27a', '#fffbd0']
LEATHER = ['#33190f', '#62341b', '#94562a', '#c4823e', '#ecb874']
DLEATHER = ['#241018', '#422230', '#643a3e', '#8a5a4e', '#b48466']
BROWN_HAIR = ['#2a1410', '#552a1a', '#864624', '#b46c2e', '#e0a050']
GREEN = ['#0c2a26', '#16503a', '#24823e', '#4cb24a', '#9ee070']
MOSS = ['#1a2a1e', '#2c4630', '#46663e', '#6a8a4a', '#9ab268']
WOOD = ['#3a1e14', '#6a3a1e', '#9a5e2e', '#c88c48', '#ecc07a']
FIRE_HAIR = ['#6e1e12', '#b8461a', '#ec7a26', '#ffb44a', '#ffe496']
BLONDE = ['#7a4a1a', '#bc8226', '#eebe44', '#ffe27e', '#fff8cc']
CLOTH_W = ['#4a4a7a', '#8a90bc', '#c6cce8', '#eef0fc', '#ffffff']
NAVY = ['#0e1240', '#1a2a78', '#2a48b0', '#4a78dc', '#8ab4ff']
PURPLE = ['#1a0c32', '#361862', '#5e2a98', '#8e4ed0', '#c69cff']
SHADOW = ['#110c1e', '#221a38', '#352a56', '#4e4278', '#7a6aa8']
SILVER_HAIR = ['#545478', '#8e92b8', '#c8cce6', '#eef0fa', '#ffffff']
BRONZE = ['#46200e', '#84461a', '#bc782a', '#e6a64c', '#ffd88a']
GINGER = ['#561a0c', '#963010', '#d65a1a', '#f88c36', '#ffc272']

# yeux : (sombre, iris, clair)
EYE_BLUE = ('#1a2a78', '#2f6ee0', '#8ad0ff')
EYE_AMBER = ('#5a2a10', '#b86a1e', '#f4b44a')
EYE_GREEN = ('#0e4030', '#1e9a52', '#7ee88a')
EYE_RED = ('#5a0a1a', '#d02a30', '#ff9a5a')
EYE_SKY = ('#1a3a88', '#3a8ef0', '#b0e8ff')
EYE_VIOLET = ('#6a1ac0', '#c070ff', '#f4d8ff')
EYE_BROWN = ('#2e1408', '#6a3a1a', '#b07a3a')


# ---------------------------------------------------------------- outils

def L():
    return Canvas(W, H)


def stamp(dst, src, outline=OUT):
    """Contourne la pièce puis la pose (séparations internes lisibles)."""
    if outline:
        src.outline(outline)
    dst.paste(src, 0, 0)
    return dst


def mask(c):
    return {(x, y) for y in range(c.h) for x in range(c.w) if c.px[y][x] is not None}


def m_poly(pts):
    t = L()
    t.poly(pts, '#000000')
    return mask(t)


def m_ell(cx, cy, rx, ry):
    t = L()
    t.ellipse(cx, cy, rx, ry, '#000000')
    return mask(t)


def m_line(x0, y0, x1, y1, w):
    t = L()
    t.line(x0, y0, x1, y1, '#000000', width=w)
    return mask(t)


def shade(c, m, R, contrast=0.36, bias=0.0, edge=True, light=(-0.6, -0.8)):
    """Remplit un masque avec une rampe : lumière en haut à gauche, liserés clair/sombre."""
    if not m:
        return
    xs = [p[0] for p in m]
    ys = [p[1] for p in m]
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    rx, ry = max(1.0, (max(xs) - min(xs)) / 2 + 0.5), max(1.0, (max(ys) - min(ys)) / 2 + 0.5)
    n = len(R)
    for (x, y) in m:
        dx, dy = (x - cx) / rx, (y - cy) / ry
        v = 0.5 + bias - (dx * light[0] + dy * light[1]) * -contrast
        if edge:
            if (x - 1, y) not in m or (x, y - 1) not in m:
                v += 0.18
            if (x + 1, y) not in m or (x, y + 1) not in m:
                v -= 0.2
        c.set(x, y, R[max(0, min(n - 1, int(v * n)))])


def ball(c, cx, cy, rx, ry, R, cuts=(-0.05, 0.33, 0.68, 0.93), only_inside=False):
    """Volume à bandes nettes (5 tons)."""
    lx, ly, lz = -0.55, -0.65, 0.52
    n = math.sqrt(lx * lx + ly * ly + lz * lz)
    lx, ly, lz = lx / n, ly / n, lz / n
    for y in range(int(cy - ry - 1), int(cy + ry + 2)):
        for x in range(int(cx - rx - 1), int(cx + rx + 2)):
            dx = (x + 0.5 - cx) / max(rx, 0.01)
            dy = (y + 0.5 - cy) / max(ry, 0.01)
            d = dx * dx + dy * dy
            if d > 1:
                continue
            v = dx * lx + dy * ly + math.sqrt(1 - d) * lz
            idx = sum(1 for k in cuts if v > k)
            (c.setf if only_inside else c.set)(x, y, R[idx])


def bar(c, p0, p1, w, R3):
    """Barre épaisse : liseré clair côté haut-gauche, sombre de l'autre côté."""
    lo, mid, hi = R3
    (x0, y0), (x1, y1) = p0, p1
    c.line(x0, y0, x1, y1, mid, width=w)
    if w < 2.5:
        return
    dx, dy = x1 - x0, y1 - y0
    n = math.hypot(dx, dy) or 1
    nx, ny = -dy / n, dx / n
    if nx * -0.7 + ny * -0.7 < 0:
        nx, ny = -nx, -ny
    o = w / 2 - 0.8
    c.line(x0 - nx * o, y0 - ny * o, x1 - nx * o, y1 - ny * o, lo)
    c.line(x0 + nx * o, y0 + ny * o, x1 + nx * o, y1 + ny * o, hi)


def stick(c, p0, p1, R, w=1):
    """Hampe fine (1-2 px) : couleur claire en haut, sombre en bas."""
    (x0, y0), (x1, y1) = p0, p1
    steps = int(max(abs(x1 - x0), abs(y1 - y0)) * 2) + 1
    for i in range(steps + 1):
        t = i / steps
        x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
        c.set(x, y, R[2])
        if w == 2:
            c.set(x + 1, y, R[1])
            c.set(x, y, R[3])


def blade(c, base, tip, w, R, edge_hi=None):
    """Lame droite : tranchant clair en haut, dos sombre, pointe effilée."""
    (x0, y0), (x1, y1) = base, tip
    dx, dy = x1 - x0, y1 - y0
    ln = math.hypot(dx, dy) or 1
    ux, uy = dx / ln, dy / ln
    nx, ny = -uy, ux
    if nx * -0.6 + ny * -0.8 < 0:
        nx, ny = -nx, -ny
    hw = w / 2
    tip_len = min(ln * 0.35, w * 1.2 + 1)
    pts = [(x0 + nx * hw, y0 + ny * hw), (x1 - ux * tip_len + nx * hw, y1 - uy * tip_len + ny * hw),
           (x1, y1), (x1 - ux * tip_len - nx * hw, y1 - uy * tip_len - ny * hw), (x0 - nx * hw, y0 - ny * hw)]
    m = m_poly(pts)
    for (x, y) in m:
        px, py = x + 0.5 - x0, y + 0.5 - y0
        s = px * nx + py * ny  # >0 côté lumière
        c.set(x, y, R[3] if s > hw * 0.25 else R[2] if s > -hw * 0.35 else R[1])
    if edge_hi:
        c.line(x0 + nx * (hw - 0.6), y0 + ny * (hw - 0.6), x1 - ux * 1.5, y1 - uy * 1.5, edge_hi)
    return m


def sparkle(c, x, y, cols):
    c.set(x, y, cols[0])
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        c.set(x + dx, y + dy, cols[1])


# ---------------------------------------------------------------- poses

def pose(kind, **over):
    p = {
        'idle': dict(tx=0, ty=0, hx=0, hy=0, bf=(15, 0), ff=(21, 0), fh=(25, 27), bh=(12, 27)),
        'b': dict(tx=0, ty=1, hx=0, hy=1, bf=(14, 0), ff=(23, 1), fh=(25, 28), bh=(12, 28)),
        'atk': dict(tx=1, ty=0, hx=2, hy=0, bf=(13, 0), ff=(25, 0), fh=(30, 23), bh=(11, 25)),
    }[kind]
    p['kind'] = kind
    p.update(over)
    return p


def legs(c, p, PANTS, BOOTS, hip=30, hips=(16, 20), boot_h=3):
    """Deux jambes courtes + bottes arrondies vers l'avant ; la jambe arrière est assombrie."""
    for far, (fx, lift), hx0 in ((True, p['bf'], hips[0]), (False, p['ff'], hips[1])):
        part = L()
        k = 1 if far else 0
        hy = hip + p['ty']
        foot = G - lift
        top = foot - boot_h
        hxp = hx0 + p['tx'] * 0.5
        for y in range(int(hy), top + 1):
            t = (y - hy) / max(1, top - hy)
            cx = hxp + (fx - hxp) * t
            x0 = int(round(cx - 1.5))
            for i, x in enumerate(range(x0, x0 + 3)):
                part.set(x, y, PANTS[max(0, [3, 2, 1][i] - k)])
        for y in range(top, foot + 1):
            r = y - top
            xa, xb = fx - 2, fx + 1 + (1 if r >= 1 else 0)
            for x in range(xa, xb + 1):
                t = (x - xa) / max(1, xb - xa)
                idx = 3 if t < 0.3 else 2 if t < 0.75 else 1
                if r == 0:
                    idx += 1
                if y == foot:
                    idx = 0 if t > 0.4 else 1
                part.set(x, y, BOOTS[max(0, min(4, idx - k))])
        stamp(c, part)


def torso(c, p, R, top=19, bot=30, wt=11, wb=12, cx=18.5, detail=None, contrast=0.4):
    """Buste trapézoïdal aux épaules arrondies ; detail(part, ox, oy) pour les ornements."""
    ox, oy = p['tx'], p['ty']
    part = L()
    m = m_poly([(cx - wt / 2 + ox + 1, top + oy), (cx + wt / 2 + ox - 1, top + oy), (cx + wt / 2 + ox, top + 2 + oy),
                (cx + wb / 2 + ox, bot + oy), (cx - wb / 2 + ox, bot + oy), (cx - wt / 2 + ox, top + 2 + oy)])
    shade(part, m, R, contrast=contrast)
    if detail:
        detail(part, ox, oy)
    stamp(c, part)


def arm(c, shoulder, hand, R, HAND=SKIN, far=False, w=3.2, cuff=None, hand_r=1.6):
    part = L()
    if far:
        R = [R[0], R[0], R[1], R[2], R[3]]
    bar(part, shoulder, hand, w, (R[1], R[2], R[3]))
    if cuff:
        mx = hand[0] + (shoulder[0] - hand[0]) * 0.3
        my = hand[1] + (shoulder[1] - hand[1]) * 0.3
        part.ellipse(mx, my, 1.5, 1.5, cuff[1] if far else cuff[2])
    hr = [HAND[0], HAND[1], HAND[1], HAND[2], HAND[3]] if far else [HAND[1], HAND[2], HAND[2], HAND[3], HAND[4]]
    ball(part, hand[0] + 0.5, hand[1] + 0.5, hand_r, hand_r, hr)
    stamp(c, part)


HEAD = (18.5, 10.5, 8.0, 7.6)  # centre, rayons


def head(c, p, iris, mood=None, dy=0, mouth=True, blush=True, skin=SKIN, eyes=True):
    """Tête ronde : peau, grands yeux brillants (2×3), joues, bouche."""
    hx, hy = p['hx'], p['hy'] + dy
    mood = mood or ('atk' if p['kind'] == 'atk' else 'idle')
    part = L()
    cx, cy, rx, ry = HEAD
    ball(part, cx + hx, cy + hy, rx, ry, [skin[1], skin[2], skin[2], skin[3], skin[3]])
    if eyes:
        face(part, hx, hy, iris, mood, mouth, blush)
    stamp(c, part)


def face(c, hx, hy, iris, mood='idle', mouth=True, blush=True, ey=10):
    for i, ex in enumerate((18, 23)):
        x, y = ex + hx, ey + hy
        if mood == 'happy':  # yeux fermés en arc
            c.set(x, y + 1, INK); c.set(x + 1, y + 1, INK); c.set(x - 1, y + 2, INK); c.set(x + 2, y + 2, INK)
            continue
        c.set(x, y, INK); c.set(x + 1, y, INK)
        c.set(x, y + 1, WHITE); c.set(x + 1, y + 1, iris[0])
        c.set(x, y + 2, iris[1]); c.set(x + 1, y + 2, iris[2])
        if i == 0:
            c.set(x - 1, y, INK)  # cil extérieur
        else:
            c.set(x + 2, y, INK)
        if mood == 'atk':  # sourcils froncés
            c.set(x + (1 if i == 0 else 0), y - 1, INK)
    if blush:
        c.setf(16 + hx, 13 + hy, BLUSH); c.setf(25 + hx, 13 + hy, BLUSH)
    if mouth:
        mx, my = 21 + hx, 14 + hy
        if mood == 'atk':
            c.set(mx, my, INK); c.set(mx + 1, my, INK)
            c.set(mx, my + 1, MOUTH_IN); c.set(mx + 1, my + 1, INK)
        else:
            c.set(mx, my, MOUTH); c.set(mx + 1, my, MOUTH)


def hair(c, p, R, bang=7, spikes=(), back=(), shine=True, dy=0, cut_face=True, extra_m=None, face_c=(22.5, 13.5, 6.2, 6.5),
         bang_pat=(0, 1, 2, 1)):
    hx, hy = p['hx'], p['hy'] + dy
    m = m_ell(18.3 + hx, 9.6 + hy, 8.9, 8.0)
    for pts in spikes:
        m |= m_poly([(x + hx, y + hy) for x, y in pts])
    for pts in back:
        m |= m_poly([(x + hx, y + hy) for x, y in pts])
    if extra_m:
        m |= extra_m
    if cut_face:
        fc = m_ell(face_c[0] + hx, face_c[1] + hy, face_c[2], face_c[3])
        m = {(x, y) for (x, y) in m
             if not ((x, y) in fc and y > bang + hy + bang_pat[(x - hx) % len(bang_pat)])}
    part = L()
    shade(part, m, R, contrast=0.42)
    if shine:  # reflet en anneau (style anime)
        for x in range(12, 22):
            y = 4.6 + (x - 16.5) ** 2 / 9.0
            if (x + hx, int(y + hy)) in m and x % 3 != 2:
                part.set(x + hx, y + hy, R[4] if x < 17 else R[3])
    stamp(c, part)
    return m


def ear(c, p, skin=SKIN, x=15.5, y=12.5):
    part = L()
    ball(part, x + p['hx'], y + p['hy'], 1.4, 1.9, [skin[1], skin[2], skin[2], skin[3], skin[3]])
    part.set(x + p['hx'], y + p['hy'], skin[1])
    stamp(c, part)


def cape(c, p, R, top=19, length=34, back=8, wave=0):
    """Cape qui flotte derrière (à gauche)."""
    ox, oy = p['tx'], p['ty']
    sw = {'idle': 0, 'b': 1, 'atk': -2}[p['kind']] + wave
    pts = [(14 + ox, top + oy), (21 + ox, top + oy), (19 + ox, length - 2), (16 + ox, length), (12 + ox, length + 1),
           (back + sw, length - 1), (back + 1 + sw * 0.5, length - 6), (11 + ox, top + 3 + oy)]
    part = L()
    m = m_poly(pts)
    shade(part, m, R, contrast=0.5, bias=-0.08)
    # plis verticaux
    for (x, y) in m:
        if (x - ox) in (11, 14) and y > top + 5 + oy:
            part.set(x, y, R[1])
    stamp(c, part)


# ---------------------------------------------------------------- 1. écuyer

def squire(kind):
    over = {}
    if kind == 'atk':
        over = dict(fh=(30, 22), bh=(11, 24))
    p = pose(kind, **over)
    c = L()
    ox, oy = p['tx'], p['ty']
    cape(c, p, BLUE)
    arm(c, (14 + ox, 21 + oy), p['bh'], STEEL, HAND=LEATHER, far=True)
    legs(c, p, STEEL, STEEL)

    def det(t, ox, oy):
        for y in range(21 + oy, 30 + oy):  # tabard bleu
            for x in range(17 + ox, 21 + ox):
                t.setf(x, y, BLUE[3] if x == 17 + ox else BLUE[2] if x < 20 + ox else BLUE[1])
        for x in range(12 + ox, 26 + ox):
            t.setf(x, 27 + oy, LEATHER[1]); t.setf(x, 28 + oy, LEATHER[0])
        t.setf(18 + ox, 27 + oy, GOLD[3]); t.setf(19 + ox, 27 + oy, GOLD[2])
        t.setf(15 + ox, 21 + oy, STEEL[4]); t.setf(14 + ox, 22 + oy, STEEL[4])
    torso(c, p, STEEL, detail=det)
    head(c, p, EYE_BLUE)
    hx, hy = p['hx'], p['hy']
    # plumet bleu (vers l'arrière)
    part = L()
    pm = m_poly([(17 + hx, 3 + hy), (19 + hx, 0 + hy), (15 + hx, -0.5 + hy), (9 + hx, 1 + hy), (5 + hx, 5 + hy),
                 (4 + hx, 10 + hy), (7 + hx, 7 + hy), (11 + hx, 4.5 + hy)])
    shade(part, pm, BLUE, contrast=0.5)
    for x in range(8, 17):
        part.setf(x + hx, 2 + hy + (1 if x < 11 else 0), BLUE[4])
    stamp(c, part)
    # casque : calotte d'acier, ouverture du visage, visière
    part = L()
    m = m_ell(18.4 + hx, 9.4 + hy, 9.0, 7.9)
    m |= m_poly([(9.5 + hx, 10 + hy), (16 + hx, 10 + hy), (16 + hx, 17.5 + hy), (10.5 + hx, 16.5 + hy)])
    opening = {(x, y) for (x, y) in m_ell(22.6 + hx, 13.6 + hy, 6.0, 5.6) if y >= 9 + hy}
    m = {q for q in m if q not in opening}
    shade(part, m, STEEL, contrast=0.45)
    for x in range(10, 28):  # bandeau doré du front
        part.setf(x + hx, 8 + hy, GOLD[2] if x < 20 else GOLD[1])
    part.setf(13 + hx, 4 + hy, STEEL[4]); part.setf(14 + hx, 4 + hy, STEEL[4]); part.setf(12 + hx, 5 + hy, STEEL[4])
    for y in range(10, 16, 2):  # rivets de la joue
        part.setf(13 + hx, y + hy, STEEL[1])
    stamp(c, part)
    # mèches brunes sous le casque
    for x in (19, 20, 22, 23, 25):
        c.set(x + hx, 9 + hy, BROWN_HAIR[2] if x < 22 else BROWN_HAIR[1])
    c.set(21 + hx, 9 + hy, BROWN_HAIR[3])
    face(c, hx, hy, EYE_BLUE, 'atk' if kind == 'atk' else 'idle', mouth=False, blush=False)
    # épée longue (énergie bleue)
    part = L()
    hxp, hyp = p['fh']
    BL = [STEEL[1], '#6a9ae8', '#b8e0ff', '#ffffff']
    if kind == 'atk':
        blade(part, (hxp + 2, hyp - 2), (38, hyp - 15), 3.6, BL, edge_hi='#ffffff')
        part.line(hxp - 1, hyp - 3, hxp + 3, hyp, GOLD[2], width=1)
        part.set(hxp - 1, hyp - 3, GOLD[3])
    else:
        blade(part, (hxp + 1, hyp - 2), (hxp + 3, hyp - 16), 3.6, BL, edge_hi='#ffffff')
        part.line(hxp - 1, hyp - 1, hxp + 3, hyp - 2, GOLD[2])
        part.set(hxp - 1, hyp - 1, GOLD[3])
        part.set(hxp, hyp + 2, LEATHER[1]); part.set(hxp, hyp + 3, GOLD[2])
    stamp(c, part)
    arm(c, (22 + ox, 21 + oy), p['fh'], STEEL, HAND=LEATHER, cuff=GOLD)
    # épaulière avant
    part = L()
    ball(part, 22 + ox, 20.5 + oy, 3.0, 2.4, STEEL)
    for x in range(19, 26):
        part.setf(x + ox, 22 + oy, BLUE[2])
    stamp(c, part)
    # énergie bleue
    if kind == 'atk':
        arc(c, (29, 25), 12, -75, 35, ['#1c46c8', '#4fb0ff', '#d4f6ff'], th=2.5)
        sparkle(c, 37, 4, ('#ffffff', '#8fe0ff'))
    else:
        tipx, tipy = p['fh'][0] + 3, p['fh'][1] - 16
        sparkle(c, tipx + 2, tipy - 1 + (1 if kind == 'b' else 0), ('#ffffff', '#4fb0ff'))
    return c


def arc(c, center, r, a0, a1, cols, th=2.0):
    """Arc d'effet (traînée de coup) entre deux angles (degrés, 0 = droite, sens horaire)."""
    cx, cy = center
    part = L()
    for y in range(H):
        for x in range(W):
            dx, dy = x + 0.5 - cx, y + 0.5 - cy
            d = math.hypot(dx, dy)
            a = math.degrees(math.atan2(dy, dx))
            if not (a0 <= a <= a1) or not (r - th <= d <= r):
                continue
            u = (a - a0) / max(1, a1 - a0)  # 0 début .. 1 fin
            s = (r - d) / th
            if u < 0.2 and (x + y) % 2:
                continue
            col = cols[2] if s < 0.45 and u > 0.3 else cols[1] if u > 0.15 else cols[0]
            part.set(x, y, col)
    stamp(c, part, outline=None)


# ---------------------------------------------------------------- 2. mercenaire

def mercenary(kind):
    over = {}
    if kind == 'atk':
        over = dict(fh=(29, 25), bh=(11, 25))
    p = pose(kind, **over)
    c = L()
    ox, oy = p['tx'], p['ty']
    hx, hy = p['hx'], p['hy']
    # pans de l'écharpe rouge flottant derrière
    part = L()
    sw = {'idle': 0, 'b': 1, 'atk': -1}[kind]
    m = m_poly([(15 + ox, 18 + oy), (10, 20 + sw), (5, 19 + sw), (7, 21.5 + sw), (3, 23 + sw * 2), (9, 23.5 + sw),
                (15 + ox, 21 + oy)])
    shade(part, m, RED, contrast=0.5)
    stamp(c, part)
    arm(c, (14 + ox, 21 + oy), p['bh'], LEATHER, far=True)
    legs(c, p, DLEATHER, LEATHER)

    def det(t, ox, oy):
        for x in range(12 + ox, 26 + ox):  # ceinture
            t.setf(x, 27 + oy, DLEATHER[1]); t.setf(x, 28 + oy, DLEATHER[0])
        t.setf(19 + ox, 27 + oy, GOLD[3]); t.setf(20 + ox, 27 + oy, GOLD[1])
        t.line(14 + ox, 21 + oy, 22 + ox, 27 + oy, DLEATHER[2])  # baudrier
        t.setf(16 + ox, 23 + oy, STEEL[3]); t.setf(21 + ox, 23 + oy, LEATHER[1])
    torso(c, p, LEATHER, detail=det)
    # épée large : au repos posée sur l'épaule (lame derrière la tête)
    hxp, hyp = p['fh']
    BL = [STEEL[0], STEEL[2], STEEL[3], STEEL[4]]
    head(c, p, EYE_AMBER)
    ear(c, p)
    hair(c, p, BROWN_HAIR, bang=6, bang_pat=(0, 2, 1, 2, 0, 1),
         spikes=[[(11, 4), (6, 1), (12, 1.5)], [(14, 2), (13, -2), (18, 1.5)], [(19, 2), (22, -1), (23, 3)],
                 [(9, 9), (3, 8), (10, 13)], [(10, 13), (5, 15), (11, 16)], [(23, 3), (28, 3), (26, 7)]])
    # écharpe autour du cou
    part = L()
    m = m_ell(19 + ox, 18.6 + oy, 5.6, 2.2)
    shade(part, m, RED, contrast=0.6)
    stamp(c, part)
    # garde + poignée
    if kind == 'atk':
        arc(c, (27, 25), 12, -95, 30, ['#c87a3a', '#ffd08a', '#ffffff'], th=2.5)
    part = L()
    if kind == 'atk':
        blade(part, (hxp + 2, hyp + 1), (38, hyp + 10), 4.6, BL, edge_hi=WHITE)
        part.line(hxp + 1, hyp - 2, hxp + 3, hyp + 3, GOLD[1], width=1)
        part.set(hxp + 1, hyp - 2, GOLD[3])
    else:
        blade(part, (hxp + 1, hyp - 2), (hxp + 7, hyp - 17), 4.6, BL, edge_hi=WHITE)
        part.line(hxp - 2, hyp - 3, hxp + 3, hyp - 1, GOLD[2])
        part.set(hxp - 2, hyp - 3, GOLD[3])
        part.set(hxp, hyp + 2, DLEATHER[2]); part.set(hxp, hyp + 3, GOLD[2])
    stamp(c, part)
    arm(c, (22 + ox, 21 + oy), p['fh'], LEATHER, cuff=DLEATHER)
    part = L()  # épaulière de cuir
    ball(part, 22 + ox, 20.8 + oy, 2.8, 2.2, LEATHER)
    stamp(c, part)
    return c


# ---------------------------------------------------------------- 3. rôdeuse

def ranger(kind):
    over = {}
    if kind == 'atk':
        over = dict(tx=0, hx=0, fh=(30, 22), bh=(21, 22), bf=(13, 0), ff=(24, 0))
    p = pose(kind, **over)
    c = L()
    ox, oy = p['tx'], p['ty']
    hx, hy = p['hx'], p['hy']
    # carquois (flèches vertes) dans le dos
    part = L()
    bar(part, (11 + ox, 28 + oy), (14 + ox, 18 + oy), 3.2, (WOOD[1], WOOD[2], WOOD[3]))
    stamp(c, part)
    for i, (x, y) in enumerate(((13, 16), (14.5, 15.5), (12, 16.5))):
        c.set(x + ox, y + oy, GREEN[3]); c.set(x + ox, y - 1 + oy, GREEN[4] if i == 0 else GREEN[2])
    cape(c, p, GREEN, length=33, back=9)
    if kind != 'atk':
        arm(c, (14 + ox, 21 + oy), p['bh'], GREEN, HAND=LEATHER, far=True)
    legs(c, p, MOSS, LEATHER)

    def det(t, ox, oy):
        for x in range(12 + ox, 26 + ox):
            t.setf(x, 26 + oy, WOOD[1]); t.setf(x, 27 + oy, WOOD[0])
        t.setf(20 + ox, 26 + oy, GOLD[2])
        for y in range(19 + oy, 26 + oy):  # lacets
            t.setf(21 + ox, y, LEATHER[1] if y % 2 else LEATHER[3])
    torso(c, p, LEATHER, detail=det)
    head(c, p, EYE_GREEN, mood='idle' if kind != 'atk' else 'focus')
    if kind == 'atk':  # visée : un œil fermé
        c.set(23 + hx, 11 + hy, SKIN[2]); c.set(24 + hx, 11 + hy, SKIN[2]); c.set(23 + hx, 12 + hy, SKIN[2])
        c.set(24 + hx, 12 + hy, SKIN[2]); c.set(23 + hx, 10 + hy, SKIN[2]); c.set(25 + hx, 10 + hy, SKIN[2])
        c.set(23 + hx, 11 + hy, INK); c.set(24 + hx, 11 + hy, INK)
    hair(c, p, BROWN_HAIR, bang=8, shine=False)
    # capuche verte à pointe
    part = L()
    m = m_ell(18.2 + hx, 9.6 + hy, 9.4, 8.6)
    m |= m_poly([(12 + hx, 3 + hy), (2 + hx, 8 + hy), (4 + hx, 10 + hy), (11 + hx, 11 + hy)])
    m |= m_poly([(10 + hx, 12 + hy), (16 + hx, 15 + hy), (17 + hx, 19 + hy), (11 + hx, 19 + hy)])
    fo = m_ell(22.6 + hx, 13.6 + hy, 6.2, 6.4)
    m = {(x, y) for (x, y) in m if not ((x, y) in fo and y >= 7 + hy)}
    shade(part, m, GREEN, contrast=0.45)
    for (x, y) in m:  # bord intérieur de la capuche plus sombre
        if (x + 1, y) in fo or (x, y + 1) in fo:
            if y >= 7 + hy:
                part.set(x, y, GREEN[1])
    stamp(c, part)
    hxp, hyp = p['fh']
    part = L()
    if kind == 'atk':
        # arc bandé : branches vers la corde tirée
        bx = hxp + 1
        top, bot = (bx - 3, hyp - 11), (bx - 3, hyp + 11)
        for t in range(0, 41):
            u = t / 40
            y = top[1] + (bot[1] - top[1]) * u
            x = bx - 3 + math.sin(u * math.pi) * 4
            part.set(x, y, WOOD[2] if u < 0.5 else WOOD[1])
            part.set(x - 1, y, WOOD[3] if u < 0.5 else WOOD[2])
        stamp(c, part)
        c.line(top[0] - 1, top[1], p['bh'][0], p['bh'][1], '#e8e0c8')
        c.line(bot[0] - 1, bot[1], p['bh'][0], p['bh'][1], '#e8e0c8')
        # flèche verte
        part = L()
        part.line(p['bh'][0] - 1, hyp, 35, hyp, WOOD[3])
        part.poly([(35, hyp - 2), (39, hyp + 0.5), (35, hyp + 3)], GREEN[3])
        part.set(36, hyp, GREEN[4]); part.set(35, hyp, '#eaffd0')
        part.set(p['bh'][0] - 1, hyp - 1, GREEN[3]); part.set(p['bh'][0], hyp - 1, GREEN[3])
        stamp(c, part)
        for x in (37, 38):
            c.set(x - 6, hyp - 3, GREEN[4])
        sparkle(c, 38, hyp - 4, ('#ffffff', GREEN[4]))
        arm(c, (15 + ox, 21 + oy), p['bh'], GREEN, HAND=LEATHER, far=True)
    else:
        bx = hxp + 1
        top, bot = (bx, hyp - 11), (bx, hyp + 10)
        for t in range(0, 41):
            u = t / 40
            y = top[1] + (bot[1] - top[1]) * u
            x = bx + math.sin(u * math.pi) * 3.5
            part.set(x, y, WOOD[2] if u < 0.5 else WOOD[1])
            part.set(x + 1, y, WOOD[1] if u < 0.5 else WOOD[0])
        part.set(bx, top[1], GREEN[3]); part.set(bx, bot[1], GREEN[2])
        stamp(c, part)
        c.line(bx - 1, top[1] + 1, bx - 1, bot[1] - 1, '#e8e0c8')
    arm(c, (22 + ox, 21 + oy), p['fh'], GREEN, HAND=LEATHER, cuff=LEATHER)
    return c


# ---------------------------------------------------------------- 4. pyromancienne

def flame_orb(c, x, y, r, frame):
    part = L()
    for i, (dx, h, w) in enumerate(((-1.5, 4, 1.4), (0, 6, 1.8), (1.5, 4, 1.4))):
        bx = x + dx
        for yy in range(int(y - r - h), int(y)):
            u = (y - yy) / (r + h)
            half = w * (1 - u) * 1.6
            sway = math.sin(u * 5 + frame * 2 + i) * 0.6
            for xx in range(int(bx - half - 1), int(bx + half + 2)):
                if abs(xx + 0.5 - bx - sway) <= half:
                    part.set(xx, yy, '#ff5a1e' if u > 0.65 else '#ff9a2a')
    ball(part, x, y, r, r, ['#b8200e', '#ff5a1e', '#ff9a2a', '#ffd24a', '#fff6c8'])
    stamp(c, part, outline='#5a0e10')


def pyromancer(kind):
    over = {}
    if kind == 'atk':
        over = dict(fh=(29, 21), bh=(28, 24))
    p = pose(kind, **over)
    c = L()
    ox, oy = p['tx'], p['ty']
    hx, hy = p['hx'], p['hy']
    # cheveux longs derrière (blond orangé)
    part = L()
    sw = {'idle': 0, 'b': 1, 'atk': -2}[kind]
    m = m_poly([(10 + hx, 9 + hy), (17 + hx, 11 + hy), (17 + ox, 22 + oy), (13 + ox, 27 + oy), (8 + sw, 26),
                (6 + sw, 22), (8 + hx, 15 + hy)])
    shade(part, m, FIRE_HAIR, contrast=0.45)
    for y in range(14, 26):
        part.setf(11 + (y % 3 == 0) + ox, y + oy, FIRE_HAIR[1])
    stamp(c, part)
    arm(c, (14 + ox, 21 + oy), p['bh'], RED, far=True)
    legs(c, p, DLEATHER, DLEATHER, hip=32, boot_h=2)

    def det(t, ox, oy):
        for x in range(10 + ox, 28 + ox):
            t.setf(x, 25 + oy, GOLD[1]); t.setf(x, 24 + oy, DLEATHER[1])
        t.setf(18 + ox, 24 + oy, GOLD[3]); t.setf(19 + ox, 24 + oy, GOLD[2])
        for x in range(10 + ox, 28 + ox, 2):  # ourlet festonné
            t.setf(x, 34 + oy, RED[0])
        for y in range(26 + oy, 34 + oy):
            t.setf(15 + ox, y, RED[1]); t.setf(21 + ox, y, RED[2])
    # robe évasée
    torso(c, p, RED, top=19, bot=35, wt=10, wb=17, detail=det, contrast=0.45)
    head(c, p, EYE_RED)
    hair(c, p, FIRE_HAIR, bang=8, bang_pat=(0, 1, 2, 1, 0), shine=False,
         back=[[(10, 12), (15, 12), (15, 18), (11, 18)]], face_c=(22.6, 13.8, 6.2, 6.4))
    # mèche avant qui encadre le visage
    part = L()
    m = m_poly([(26 + hx, 9 + hy), (28 + hx, 10 + hy), (27.5 + hx, 17 + hy), (26 + hx, 15 + hy)])
    shade(part, m, FIRE_HAIR)
    stamp(c, part)
    # énorme chapeau de sorcière (bord large, pointe pliée vers l'arrière)
    part = L()
    cone = m_poly([(12 + hx, 6 + hy), (24 + hx, 6 + hy), (20 + hx, 1 + hy), (15 + hx, 0 + hy), (8 + hx, 0 + hy),
                   (3 + hx, 2 + hy), (9 + hx, 2 + hy), (13 + hx, 2 + hy)])
    shade(part, cone, RED, contrast=0.5)
    brim = m_ell(18.5 + hx, 6.6 + hy, 12.5, 2.4)
    shade(part, brim, [RED[0], RED[1], RED[2], RED[3], RED[3]], contrast=0.5, bias=-0.1)
    for x in range(12, 25):  # ruban doré
        part.setf(x + hx, 4 + hy, GOLD[2] if x < 19 else GOLD[1])
        part.setf(x + hx, 5 + hy, GOLD[1] if x < 19 else GOLD[0])
    part.setf(17 + hx, 4 + hy, '#ffffff'); part.setf(17 + hx, 5 + hy, '#ff9a2a')  # boucle étoilée
    part.set(3 + hx, 3 + hy, GOLD[3])
    stamp(c, part)
    # bâton à orbe de feu
    hxp, hyp = p['fh']
    part = L()
    if kind == 'atk':
        bar(part, (hxp - 6, hyp + 7), (hxp + 4, hyp - 5), 2.2, (WOOD[1], WOOD[2], WOOD[3]))
        stamp(c, part)
        flame_orb(c, hxp + 5, hyp - 7, 2.6, 1)
        # boule de feu lancée
        part = L()
        ball(part, 36, 22, 2.8, 2.6, ['#b8200e', '#ff5a1e', '#ffb02a', '#ffe46a', '#ffffff'])
        for i, x in enumerate(range(28, 34)):
            part.set(x, 22 + (i % 2), '#ff9a2a' if i > 2 else '#ff5a1e')
            if i > 1:
                part.set(x, 21 - (i % 2), '#ffd24a')
        stamp(c, part, outline='#7a1810')
        sparkle(c, 33, 18, ('#ffffff', '#ffd24a'))
        sparkle(c, 37, 27, ('#fff6c8', '#ff9a2a'))
    else:
        bar(part, (hxp + 1, hyp + 9 - p['ty']), (hxp + 1, hyp - 13), 2.2, (WOOD[1], WOOD[2], WOOD[3]))
        stamp(c, part)
        flame_orb(c, hxp + 1.5, hyp - 14, 2.4, 0 if kind == 'idle' else 1)
    arm(c, (22 + ox, 21 + oy), p['fh'], RED, cuff=GOLD)
    if kind == 'atk':
        arm(c, (21 + ox, 22 + oy), p['bh'], RED, cuff=GOLD)
    return c


# ---------------------------------------------------------------- 5. prêtresse

def priestess(kind):
    over = {}
    if kind == 'atk':
        over = dict(tx=0, hx=1, fh=(28, 20), bh=(24, 25), bf=(14, 0), ff=(23, 0))
    p = pose(kind, **over)
    c = L()
    ox, oy = p['tx'], p['ty']
    hx, hy = p['hx'], p['hy']
    # voile long derrière
    part = L()
    sw = {'idle': 0, 'b': 1, 'atk': -2}[kind]
    m = m_poly([(10 + hx, 8 + hy), (18 + hx, 8 + hy), (17 + ox, 22 + oy), (14 + ox, 28 + oy), (8 + sw, 28),
                (6 + sw, 22), (8 + hx, 14 + hy)])
    shade(part, m, NAVY, contrast=0.45)
    stamp(c, part)
    arm(c, (14 + ox, 21 + oy), p['bh'], CLOTH_W, far=True)
    legs(c, p, NAVY, BLUE, hip=32, boot_h=2)

    def det(t, ox, oy):
        for y in range(20 + oy, 36 + oy):  # pan bleu central, liseré doré
            for x in range(18 + ox, 22 + ox):
                t.setf(x, y, NAVY[3] if x == 18 + ox else NAVY[2])
            t.setf(17 + ox, y, GOLD[2]); t.setf(22 + ox, y, GOLD[1])
        t.setf(19 + ox, 23 + oy, GOLD[3]); t.setf(20 + ox, 23 + oy, GOLD[3]); t.setf(19 + ox, 22 + oy, GOLD[3])
        t.setf(19 + ox, 24 + oy, GOLD[2]); t.setf(18 + ox, 23 + oy, GOLD[3])
        for x in range(10 + ox, 29 + ox):
            t.setf(x, 34 + oy, NAVY[2] if x % 2 else NAVY[1])
    torso(c, p, CLOTH_W, top=19, bot=35, wt=10, wb=17, detail=det, contrast=0.4)
    head(c, p, EYE_SKY, mood='happy' if kind == 'b' else None)
    hair(c, p, BLONDE, bang=8, bang_pat=(0, 1, 1, 2, 1, 1), shine=False)
    # voile (bleu) + guimpe blanche autour du visage
    part = L()
    m = m_ell(18.3 + hx, 9.4 + hy, 9.2, 8.4)
    m |= m_poly([(10 + hx, 12 + hy), (16 + hx, 14 + hy), (16 + hx, 19 + hy), (10 + hx, 18 + hy)])
    fo = m_ell(22.6 + hx, 13.8 + hy, 6.4, 6.6)
    m = {(x, y) for (x, y) in m if not ((x, y) in fo and y >= 6 + hy)}
    shade(part, m, NAVY, contrast=0.45)
    ring = m_ell(22.6 + hx, 13.8 + hy, 8.2, 8.4)
    for (x, y) in m:
        if (x, y) in ring and y >= 5 + hy:
            part.set(x, y, CLOTH_W[3] if x < 21 + hx and y < 9 + hy else CLOTH_W[2])
    stamp(c, part)
    # auréole dorée
    part = L()
    hb = 1 if kind == 'b' else 0
    hm = m_ell(17 + hx, 1.5 + hb, 6.2, 1.7)
    for (x, y) in hm:
        if not all(q in hm for q in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1))):
            part.set(x, y, GOLD[4] if x < 15 + hx else GOLD[3] if y <= 1 + hb else GOLD[2])
    stamp(c, part, outline='#a8742a')
    hxp, hyp = p['fh']
    part = L()
    GST = (GOLD[1], GOLD[2], GOLD[3])
    if kind == 'atk':
        top = (hxp + 3, hyp - 9)
        bar(part, (hxp - 2, hyp + 8), top, 2.2, GST)
    else:
        top = (hxp + 1, hyp - 14)
        bar(part, (hxp + 1, hyp + 10 - p['ty']), top, 2.2, GST)
    # croix / étoile dorée au sommet
    tx_, ty_ = top
    part.rect(int(tx_) - 2, int(ty_) - 1, 5, 2, GOLD[2])
    part.rect(int(tx_) - 1, int(ty_) - 4, 2, 7, GOLD[2])
    part.set(tx_ - 2, ty_ - 1, GOLD[4]); part.set(tx_ - 1, ty_ - 4, GOLD[4]); part.set(tx_ - 1, ty_ - 1, GOLD[3])
    part.set(tx_ + 2, ty_, GOLD[1]); part.set(tx_, ty_ + 2, GOLD[1])
    part.set(tx_ - 1, ty_, '#7ad0ff'); part.set(tx_, ty_, '#3a8ef0')
    stamp(c, part, outline='#5a2a14')
    if kind == 'atk':  # éclat de lumière sacrée
        part = L()
        cx, cy = tx_ + 4, ty_ - 1
        for ang, ln in ((0, 7), (45, 4.5), (90, 5), (135, 4), (180, 3), (270, 5), (315, 4.5), (22, 3.5), (338, 5.5)):
            a = math.radians(ang)
            for i in range(int(ln * 3)):
                d = i / 3
                w = 1.2 * (1 - d / ln)
                col = '#ffffff' if d < ln * 0.45 else '#fff3a8' if d < ln * 0.8 else '#ffd24a'
                part.ellipse(cx + math.cos(a) * d, cy - math.sin(a) * d, max(0.5, w), max(0.5, w), col)
        part.ellipse(cx, cy, 1.8, 1.8, '#ffffff')
        stamp(c, part, outline='#e8a030')
        sparkle(c, 37, 20, ('#ffffff', '#ffe27a'))
        sparkle(c, 29, 3, ('#ffffff', '#ffe27a'))
    else:
        c.set(tx_ + 3, ty_ - 3 + (1 if kind == 'b' else 0), '#fff6c8')
    arm(c, (22 + ox, 21 + oy), p['fh'], CLOTH_W, cuff=GOLD)
    if kind == 'atk':
        arm(c, (21 + ox, 22 + oy), p['bh'], CLOTH_W, cuff=GOLD)
    return c


# ---------------------------------------------------------------- 6. lancier

def lancer(kind):
    over = {}
    if kind == 'atk':
        over = dict(tx=2, hx=3, fh=(29, 24), bh=(22, 25), bf=(12, 0), ff=(26, 0))
    p = pose(kind, **over)
    c = L()
    ox, oy = p['tx'], p['ty']
    hx, hy = p['hx'], p['hy']
    cape(c, p, RED, length=35, back=7)
    if kind != 'atk':
        arm(c, (14 + ox, 21 + oy), p['bh'], DSTEEL, HAND=DLEATHER, far=True)
    legs(c, p, DSTEEL, DSTEEL)

    def det(t, ox, oy):
        for x in range(12 + ox, 26 + ox):
            t.setf(x, 27 + oy, RED[1]); t.setf(x, 28 + oy, RED[0])
        t.setf(19 + ox, 27 + oy, GOLD[2])
        for y in range(20 + oy, 26 + oy):
            t.setf(20 + ox, y, DSTEEL[1])
        t.setf(15 + ox, 21 + oy, DSTEEL[4]); t.setf(14 + ox, 22 + oy, DSTEEL[3])
    torso(c, p, DSTEEL, detail=det)
    # panache rouge
    part = L()
    pm = m_poly([(17 + hx, 3 + hy), (20 + hx, -0.5 + hy), (14 + hx, -0.5 + hy), (7 + hx, 0.5 + hy), (2 + hx, 5 + hy),
                 (1 + hx, 13 + hy), (5 + hx, 8 + hy), (10 + hx, 5 + hy)])
    shade(part, pm, RED, contrast=0.5)
    for x in range(7, 16):
        part.setf(x + hx, 1 + hy + (1 if x < 10 else 0), RED[4])
    stamp(c, part)
    # heaume fermé : visière à fente, deux yeux lumineux
    part = L()
    m = m_ell(18.5 + hx, 10.2 + hy, 8.6, 8.4)
    m |= m_poly([(12 + hx, 14 + hy), (27 + hx, 13 + hy), (26 + hx, 19 + hy), (13 + hx, 19 + hy)])
    shade(part, m, HELM, contrast=0.5)
    for x in range(17, 28):  # fente
        part.setf(x + hx, 10 + hy, INK); part.setf(x + hx, 11 + hy, INK)
        part.setf(x + hx, 9 + hy, DSTEEL[4] if x < 23 else DSTEEL[3])
        part.setf(x + hx, 12 + hy, DSTEEL[2])
    for ex in (19, 24):  # regards
        part.setf(ex + hx, 10 + hy, '#ffe8a0'); part.setf(ex + 1 + hx, 10 + hy, '#ff7a3a')
        part.setf(ex + hx, 11 + hy, '#ff7a3a')
    for y in range(13, 18):  # nervure frontale du mufle
        part.setf(24 + hx, y + hy, DSTEEL[1])
        for x in (21, 23, 26):
            if y % 2:
                part.setf(x + hx, y + hy, INK)
    for x in range(10, 28):
        part.setf(x + hx, 6 + hy, GOLD[2] if x < 20 else GOLD[1])  # bandeau doré
    part.setf(13 + hx, 4 + hy, DSTEEL[4]); part.setf(12 + hx, 5 + hy, DSTEEL[4])
    stamp(c, part)
    # lance
    hxp, hyp = p['fh']
    part = L()
    SH = (WOOD[0], WOOD[1], WOOD[2], WOOD[3])
    if kind == 'atk':
        stick(part, (6, hyp), (32, hyp), SH, w=1)
        part.line(6, hyp + 1, 32, hyp + 1, WOOD[1])
        blade(part, (32, hyp + 0.5), (39.5, hyp + 0.5), 3.4, [STEEL[1], STEEL[2], STEEL[3], STEEL[4]])
        part.set(32, hyp - 1, RED[3]); part.set(32, hyp + 2, RED[2]); part.set(31, hyp + 2, RED[1])
    else:
        sx = hxp + 1
        part.line(sx, 38, sx, 8, WOOD[2]); part.line(sx + 1, 38, sx + 1, 8, WOOD[1])
        blade(part, (sx + 0.5, 8), (sx + 0.5, 0), 3.4, [STEEL[1], STEEL[2], STEEL[3], STEEL[4]])
        part.set(sx - 1, 8, RED[3]); part.set(sx + 2, 8, RED[2]); part.set(sx - 1, 9, RED[2])
    stamp(c, part)
    if kind == 'atk':
        for y, x0, x1 in ((hyp - 4, 18, 26), (hyp + 4, 15, 22), (hyp - 7, 24, 29)):
            c.line(x0, y, x1, y, '#ffd0b0' if y < hyp else '#ff9a7a')
        arm(c, (15 + ox, 22 + oy), p['bh'], DSTEEL, HAND=DLEATHER, far=True)
    arm(c, (22 + ox, 21 + oy), p['fh'], DSTEEL, HAND=DLEATHER, cuff=RED)
    part = L()
    ball(part, 22 + ox, 20.5 + oy, 3.0, 2.4, DSTEEL)
    part.setf(22 + ox, 20 + oy, RED[3])
    stamp(c, part)
    return c


# ---------------------------------------------------------------- 7. ombre (assassin)

def dagger(c, hand, d, R, glow):
    """Dague (lame violette) : d = direction (dx, dy) de la lame."""
    part = L()
    x, y = hand
    dx, dy = d
    blade(part, (x + dx * 1.5, y + dy * 1.5), (x + dx * 7, y + dy * 7), 2.4, R, edge_hi=glow)
    part.line(x + dy * 1.5 + dx, y - dx * 1.5 + dy, x - dy * 1.5 + dx, y + dx * 1.5 + dy, GOLD[1])
    stamp(c, part)


def shadow(kind):
    over = {}
    if kind == 'atk':
        over = dict(tx=2, ty=1, hx=3, hy=1, fh=(31, 23), bh=(22, 27), bf=(11, 0), ff=(26, 0))
    p = pose(kind, **over)
    c = L()
    ox, oy = p['tx'], p['ty']
    hx, hy = p['hx'], p['hy']
    DG = [PURPLE[1], '#b070ff', '#e0b8ff', '#ffffff']
    # longue écharpe violette flottante
    part = L()
    sw = {'idle': 0, 'b': 2, 'atk': -2}[kind]
    m = m_poly([(15 + ox, 17 + oy), (9, 17 + sw), (2, 15 + sw), (5, 18 + sw), (1, 21 + sw), (8, 20.5 + sw),
                (15 + ox, 20 + oy)])
    shade(part, m, PURPLE, contrast=0.5)
    stamp(c, part)
    if kind != 'atk':
        dagger(c, p['bh'], (0.15, 1), DG, None)
        arm(c, (14 + ox, 21 + oy), p['bh'], SHADOW, HAND=SHADOW, far=True)
    legs(c, p, SHADOW, PURPLE)

    def det(t, ox, oy):
        for x in range(12 + ox, 26 + ox):
            t.setf(x, 26 + oy, PURPLE[2]); t.setf(x, 27 + oy, PURPLE[1])
        t.setf(20 + ox, 26 + oy, '#d8b0ff')
        t.line(14 + ox, 20 + oy, 21 + ox, 26 + oy, PURPLE[1])  # sangle
        t.setf(17 + ox, 23 + oy, '#e0e0f0')
    torso(c, p, SHADOW, detail=det, contrast=0.45)
    head(c, p, EYE_VIOLET, mouth=False, blush=False)
    ear(c, p)
    hair(c, p, SILVER_HAIR, bang=6, bang_pat=(0, 1, 0, 2, 0, 1),
         spikes=[[(12, 4), (5, 2), (11, 1)], [(10, 9), (1, 10), (10, 13)], [(10, 13), (3, 17), (11, 16)],
                 [(15, 2), (16, -1), (20, 2)], [(21, 2), (25, 0), (24, 4)]])
    # masque : couvre le bas du visage
    part = L()
    m = {(x, y) for (x, y) in m_ell(21.5 + hx, 13.5 + hy, 6.2, 5.2) if y >= 13 + hy}
    m |= m_ell(19.5 + ox * 0.5 + hx * 0.5, 18.3 + oy, 5.2, 1.8)
    shade(part, m, PURPLE, contrast=0.45, bias=-0.05)
    for x in range(17, 27):
        part.setf(x + hx, 13 + hy, PURPLE[3] if x < 22 else PURPLE[2])
    stamp(c, part)
    c.set(16 + hx, 12 + hy, BLUSH) if kind == 'b' else None
    hxp, hyp = p['fh']
    if kind == 'atk':
        arc(c, (26, 26), 11, -80, 35, [PURPLE[2], '#b070ff', '#f0d8ff'], th=2.5)
        dagger(c, (hxp, hyp), (1, -0.2), DG, '#ffffff')
        arm(c, (22 + ox, 21 + oy), p['fh'], SHADOW, HAND=SHADOW, cuff=PURPLE)
        dagger(c, p['bh'], (1, 0.5), DG, '#ffffff')
        arm(c, (19 + ox, 22 + oy), p['bh'], SHADOW, HAND=SHADOW, cuff=PURPLE)
        sparkle(c, 37, 14, ('#ffffff', '#c69cff'))
    else:
        dagger(c, (hxp, hyp), (0.35, 1) if kind == 'idle' else (0.3, 1), DG, '#ffffff')
        arm(c, (22 + ox, 21 + oy), p['fh'], SHADOW, HAND=SHADOW, cuff=PURPLE)
    return c


# ---------------------------------------------------------------- 8. nain

def dwarf(kind):
    over = dict(hy=3)
    if kind == 'b':
        over = dict(hy=4)
    if kind == 'atk':
        over = dict(tx=1, hx=2, hy=3, fh=(29, 21), bh=(26, 23), bf=(13, 0), ff=(25, 0))
    p = pose(kind, **over)
    if kind != 'atk':
        p['fh'] = (p['fh'][0] + 1, p['fh'][1] + 1)
    c = L()
    ox, oy = p['tx'], p['ty']
    hx, hy = p['hx'], p['hy']
    hxp, hyp = p['fh']
    # grande hache (derrière pour le repos : manche tenu devant)
    if kind == 'atk':
        arm(c, (21 + ox, 23 + oy), p['bh'], BRONZE, HAND=SKIN, far=True, w=3.8)
    else:
        arm(c, (13 + ox, 23 + oy), (11 + ox, 30 + oy), BRONZE, HAND=SKIN, far=True, w=3.8)
    legs(c, p, BROWN_HAIR, LEATHER, hip=32, hips=(15.5, 21), boot_h=3)

    def det(t, ox, oy):
        for x in range(10 + ox, 28 + ox):
            t.setf(x, 30 + oy, LEATHER[1]); t.setf(x, 31 + oy, LEATHER[0])
        t.rect(17 + ox, 30 + oy, 4, 2, GOLD[2])
        t.setf(17 + ox, 30 + oy, GOLD[4]); t.setf(20 + ox, 31 + oy, GOLD[0])
        for x in range(11 + ox, 27 + ox, 3):
            t.setf(x, 28 + oy, BRONZE[1])
    torso(c, p, BRONZE, top=20, bot=33, wt=15, wb=17, detail=det, contrast=0.45)
    head(c, p, EYE_BROWN, mouth=False, blush=False, eyes=False)
    face(c, hx, hy, EYE_BROWN, 'atk' if kind == 'atk' else 'idle', mouth=False, blush=False)
    c.set(16 + hx, 14 + hy, BLUSH); c.set(26 + hx, 14 + hy, BLUSH)
    # barbe rousse touffue en pointe (couvre le bas du visage et la poitrine)
    part = L()
    sw = {'idle': 0, 'b': 0, 'atk': 1}[kind]
    m = m_poly([(14 + hx, 14 + hy), (17 + hx, 16 + hy), (21 + hx, 16 + hy), (25 + hx, 15 + hy), (28 + hx, 13 + hy),
                (28 + hx, 18 + hy), (26 + hx + sw, 23 + hy), (22 + hx + sw, 28 + hy), (18 + hx, 25 + hy),
                (15 + hx, 20 + hy)])
    for (x, y) in m:
        u = (x - 14 - hx) / 14
        v = 0.75 - u * 0.45 - (y - 14 - hy) * 0.025
        col = GINGER[min(4, max(0, int(v * 5)))]
        if (x * 2 + y) % 5 == 0 and y > 17 + hy:
            col = GINGER[1]
        if (x * 2 + y) % 5 == 2 and y > 16 + hy and u < 0.6:
            col = GINGER[3]
        part.set(x, y, col)
    # moustache
    for x in range(18, 28):
        part.set(x + hx, 15 + hy if 19 < x < 26 else 16 + hy, GINGER[4] if x < 22 else GINGER[3])
    part.set(22 + hx + sw, 26 + hy, GOLD[3]); part.set(22 + hx + sw, 27 + hy, GOLD[1])  # perle de tresse
    stamp(c, part)
    c.set(22 + hx, 14 + hy, SKIN[1]); c.set(23 + hx, 14 + hy, SKIN[1])  # nez
    c.set(22 + hx, 13 + hy, SKIN[3])
    # casque de bronze à cornes, nasal
    part = L()
    m = {(x, y) for (x, y) in m_ell(18.5 + hx, 10.2 + hy, 8.9, 8.4) if y <= 8 + hy}
    m |= m_poly([(10 + hx, 8 + hy), (16 + hx, 8 + hy), (16 + hx, 14 + hy), (11 + hx, 13 + hy)])
    m |= {(21 + hx, 9 + hy), (21 + hx, 10 + hy), (21 + hx, 11 + hy)}
    shade(part, m, BRONZE, contrast=0.5)
    for x in range(9, 29):  # bord riveté
        part.setf(x + hx, 8 + hy, BRONZE[3] if x < 18 else BRONZE[2])
        part.setf(x + hx, 7 + hy, BRONZE[1] if x % 3 else GOLD[3])
    part.setf(21 + hx, 9 + hy, BRONZE[3]); part.setf(21 + hx, 11 + hy, BRONZE[1])
    part.setf(14 + hx, 2 + hy, BRONZE[4]); part.setf(13 + hx, 3 + hy, BRONZE[4]); part.setf(15 + hx, 2 + hy, BRONZE[4])
    stamp(c, part)
    part = L()  # corne
    hm = m_poly([(11 + hx, 4 + hy), (7 + hx, 3 + hy), (4 + hx, -1 + hy), (5 + hx, 3 + hy), (9 + hx, 7 + hy)])
    shade(part, hm, ['#6a5a4a', '#a8988a', '#d8d0c0', '#f4f0e6', '#ffffff'])
    stamp(c, part)
    # hache
    part = L()
    AX = [STEEL[0], STEEL[1], STEEL[2], STEEL[3], STEEL[4]]
    if kind == 'atk':
        a0, a1 = (hxp - 5, hyp + 6), (hxp + 5, hyp - 7)
        bar(part, a0, a1, 2.2, (WOOD[1], WOOD[2], WOOD[3]))
        stamp(c, part)
        part = L()
        hm = m_poly([(a1[0] - 1, a1[1] - 1), (a1[0] + 3, a1[1] - 5), (a1[0] + 7, a1[1] - 3), (a1[0] + 7.5, a1[1] + 4),
                     (a1[0] + 5, a1[1] + 8), (a1[0] + 2, a1[1] + 3), (a1[0] - 1, a1[1] + 2)])
        shade(part, hm, AX, contrast=0.45)
        for (x, y) in hm:
            if (x + 1, y) not in hm:
                part.set(x, y, '#ffffff')
        stamp(c, part)
        arc(c, (24, 28), 14, -75, 10, ['#a85a2a', '#ffc070', '#fff6d8'], th=2.5)
    else:
        sx = hxp + 1
        bar(part, (sx, 37), (sx, 10 + p['ty']), 2.4, (WOOD[1], WOOD[2], WOOD[3]))
        stamp(c, part)
        part = L()
        ty0 = 10 + p['ty']
        hm = m_poly([(sx, ty0 + 0), (sx + 4, ty0 - 3), (sx + 8, ty0 - 2), (sx + 8.5, ty0 + 5), (sx + 7, ty0 + 9),
                     (sx + 3.5, ty0 + 6), (sx, ty0 + 6)])
        hm |= m_poly([(sx, ty0 + 1), (sx - 3, ty0 - 1), (sx - 3, ty0 + 5), (sx, ty0 + 4)])
        shade(part, hm, AX, contrast=0.45)
        for (x, y) in hm:
            if (x + 1, y) not in hm and x > sx + 4:
                part.set(x, y, '#ffffff')
        part.setf(sx + 1, ty0 + 2, GOLD[2]); part.setf(sx + 1, ty0 + 3, GOLD[1])
        stamp(c, part)
    arm(c, (24 + ox, 23 + oy), p['fh'], BRONZE, HAND=SKIN, cuff=LEATHER, w=3.8)
    return c


# ---------------------------------------------------------------- assemblage

ALLIES = [('squire', squire), ('mercenary', mercenary), ('ranger', ranger), ('pyromancer', pyromancer),
          ('priestess', priestess), ('lancer', lancer), ('shadow', shadow), ('dwarf', dwarf)]


def build():
    """Renvoie {nom: (canvas, extra)}."""
    out = {}
    for aid, fn in ALLIES:
        out[f'ally_{aid}'] = (fn('idle'), {})
        out[f'ally_{aid}_b'] = (fn('b'), {})
        out[f'ally_{aid}_atk'] = (fn('atk'), {})
    return out
