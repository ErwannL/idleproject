"""Ennemis, boss et compagnons v5 (pixel art 16 bits, ombrage à décalage de teinte).

Les ennemis regardent à GAUCHE (ils marchent vers le héros), les compagnons à DROITE.
Chaque sprite est recadré au plus près ; la dernière ligne correspond aux pieds (sauf volants).
"""
import math

from lib import Canvas as _Canvas, ramp, shift, mix

OUT = '#1a1226'
WHITE = '#fbfbff'
INK = '#1a1226'


# ---------------------------------------------------------------- outils

M = 6  # marge invisible : on peut dessiner en coordonnées négatives, le contour reste entier


class Canvas(_Canvas):
    """Canvas avec marge : coordonnées logiques décalées de M (recadré à la fin)."""

    def __init__(self, w, h):
        super().__init__(w + 2 * M, h + 2 * M)

    def set(self, x, y, c):
        super().set(x + M, y + M, c)

    def setf(self, x, y, c):
        super().setf(x + M, y + M, c)

    def get(self, x, y):
        return super().get(int(round(x)) + M, int(round(y)) + M)

    def copy(self):
        n = _Canvas(self.w, self.h)
        n.px = [row[:] for row in self.px]
        return n

    def outline(self, color=None, diagonal=False, skip=()):
        tmp = _Canvas(self.w, self.h)
        tmp.px = self.px
        tmp.outline(color, diagonal, skip)
        return self

    def paste(self, other, ox, oy, flip=False):
        for y in range(other.h):
            for x in range(other.w):
                c = other.px[y][x]
                if c is not None:
                    _Canvas.set(self, ox + x, oy + y, c)

def crop(c, margin=0):
    x0, y0, x1, y1 = c.bounds()
    n = _Canvas(x1 - x0 + 1 + margin * 2, y1 - y0 + 1 + margin * 2)
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            n.px[y - y0 + margin][x - x0 + margin] = c.px[y][x]
    return n


def finish(c, outline=True):
    if outline:
        c.outline(OUT)
    return crop(c)


def mask_of(draw):
    m = Canvas(120, 120)
    draw(m)
    return {(x - M, y - M) for y in range(m.h) for x in range(m.w) if m.px[y][x] is not None}


def shade_mask(c, mask, colors, light=(-0.6, -0.8), bias=0.0, edge=True, contrast=0.32):
    """Remplit un masque avec une rampe, éclairé en haut à gauche (bords clairs/sombres)."""
    if not mask:
        return
    xs = [p[0] for p in mask]
    ys = [p[1] for p in mask]
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    rx, ry = max(1.0, (max(xs) - min(xs)) / 2 + 0.5), max(1.0, (max(ys) - min(ys)) / 2 + 0.5)
    n = len(colors)
    lx, ly = light
    for (x, y) in mask:
        dx, dy = (x - cx) / rx, (y - cy) / ry
        v = 0.5 + bias + (dx * lx + dy * ly) * contrast
        if edge:
            if (x - 1, y) not in mask or (x, y - 1) not in mask:
                v += 0.18
            if (x + 1, y) not in mask or (x, y + 1) not in mask:
                v -= 0.2
        idx = max(0, min(n - 1, int(v * n)))
        c.set(x, y, colors[idx])


def spoly(c, pts, colors, **kw):
    shade_mask(c, mask_of(lambda m: m.poly(pts, '#000000')), colors, **kw)


def sell(c, cx, cy, rx, ry, colors, light=(-0.6, -0.8)):
    """Ellipse ombrée, lumière venant d'en haut à gauche."""
    c.shaded_ellipse(cx, cy, rx, ry, colors, light=light)


def sline(c, x0, y0, x1, y1, colors, width=2, **kw):
    shade_mask(c, mask_of(lambda m: m.line(x0, y0, x1, y1, '#000000', width)), colors, **kw)


def dome(c, cx, top, bottom, rx, colors, flare=0.6, light=(0.55, 0.85)):
    """Goutte de slime : dôme arrondi en haut, base aplatie un peu évasée."""
    h = bottom - top + 1
    ry = h * 0.62
    cy = top + ry
    n = len(colors)
    mask = {}
    for y in range(top, bottom + 1):
        yc = y + 0.5
        if yc < cy:
            k = math.sqrt(max(0.0, 1 - ((yc - cy) / ry) ** 2))
        else:
            t = (yc - cy) / max(0.01, bottom + 1 - cy)
            k = 1 + flare / rx * t * t
        hw = rx * k
        for x in range(int(cx - hw - 1), int(cx + hw + 2)):
            if abs(x + 0.5 - cx) <= hw:
                mask[(x, y)] = True
    for (x, y) in mask:
        dx = (x + 0.5 - cx) / rx
        dy = (y + 0.5 - cy) / ry
        if dy > 0:
            dy *= 0.55
        d = min(1.0, dx * dx + dy * dy)
        nz = math.sqrt(1 - d)
        dot = -(dx * light[0] + dy * light[1]) * 0.75 + nz * 0.55
        v = (dot + 0.25) / 1.25
        if y >= bottom - 1:
            v -= 0.18
        c.set(x, y, colors[max(0, min(n - 1, int(v * n)))])
    return mask


def cute_eye(c, x, y, h=3, w=2, iris=INK):
    """Gros œil brillant : ovale sombre et reflet blanc en haut à gauche."""
    for yy in range(h):
        for xx in range(w):
            c.set(x + xx, y + yy, iris)
    c.set(x, y, WHITE)
    if h >= 4 and w == 2:
        c.set(x + 1, y + h - 1, '#5a5a9a')
    if h >= 4 and w >= 3:
        c.set(x + 1, y, WHITE); c.set(x, y + 1, WHITE)
        c.set(x + w - 1, y + h - 1, '#5a6aa8')
    elif h >= 3:
        c.set(x + w - 1, y + h - 1, '#4a4a7a')


def membrane_wing(c, shoulder, wrist, tips, body_pt, colors, bone, scallop=0.32):
    """Aile membraneuse : bras épaule→poignet, doigts vers les pointes, bord festonné."""
    pts = [shoulder, wrist]
    for i, t in enumerate(tips):
        pts.append(t)
        nxt = tips[i + 1] if i + 1 < len(tips) else body_pt
        mx, my = (t[0] + nxt[0]) / 2, (t[1] + nxt[1]) / 2
        pts.append((mx + (wrist[0] - mx) * scallop, my + (wrist[1] - my) * scallop))
    pts.append(body_pt)
    spoly(c, pts, colors, bias=0.04)
    for t in tips:
        c.line(wrist[0], wrist[1], t[0], t[1], bone[1])
        c.set(t[0], t[1], bone[2])
    c.line(shoulder[0], shoulder[1], wrist[0], wrist[1], bone[1])
    c.line(shoulder[0], shoulder[1] - 1, wrist[0], wrist[1] - 1, bone[2])
    c.set(wrist[0], wrist[1] - 1, bone[2])


def glow(c, x, y, cols):
    """Œil luminescent : cœur clair + halo."""
    c.set(x, y, cols[-1])
    if len(cols) > 1:
        c.setf(x + 1, y, cols[-2])


def sparkle(c, x, y, col):
    c.set(x, y, col)


# ---------------------------------------------------------------- palettes

G_SLIME = ['#15483a', '#22803e', '#36b03c', '#68d84a', '#b4f27e']
G_SKIN = ramp('#5fa83a', 5, 0.3, 0.06)
LEATHER = ramp('#8a5a32', 5, 0.3, 0.05)
WOOD = ramp('#8a5e3a', 4, 0.26, 0.05)
STEEL = ramp('#9aa6b8', 5, 0.34, 0.03)
RUST = ramp('#a0562a', 5, 0.28, 0.05)
BONE = ['#4c4258', '#8e8478', '#bfb69c', '#e2dcc4', '#fbf8ea']
GOLD = ['#7a3e18', '#c0761e', '#eab53a', '#ffe27a', '#fffbd0']
RED_GEM = ['#5a0f2a', '#b0203a', '#ff4a5a', '#ffb0b0']
BLUE_GEM = ['#1a2a6a', '#2a62d0', '#5ab4ff', '#d8f4ff']
GREEN_GEM = ['#0f4a3a', '#1ea06a', '#5ee8a0', '#d8ffe8']


def crown(c, x, y, w, h, gems=True, points=3):
    """Couronne d'or (x, y = coin haut gauche du bandeau)."""
    base_y = y + h - 3
    c.rect(x, base_y, w, 3, GOLD[2])
    for xx in range(x, x + w):
        c.set(xx, base_y, GOLD[3])
        c.set(xx, base_y + 2, GOLD[1])
    # pointes
    for i in range(points):
        px = x + round(i * (w - 1) / (points - 1))
        for k in range(h - 3):
            yy = base_y - 1 - k
            half = max(0, (h - 4 - k) // 2) if i not in (0, points - 1) else 0
            for dx in range(-half, half + 1):
                c.set(px + dx, yy, GOLD[2] if dx <= 0 else GOLD[1])
        c.set(px, y, GOLD[4])
    c.set(x, base_y, GOLD[4])
    if gems:
        mid = x + w // 2
        c.set(mid, base_y + 1, RED_GEM[2]); c.set(mid - 1, base_y + 1, RED_GEM[3]) if w > 8 else None
        if w > 8:
            c.set(x + 2, base_y + 1, BLUE_GEM[2]); c.set(x + w - 3, base_y + 1, GREEN_GEM[2])


# ---------------------------------------------------------------- slimes

def slime_core(c, cx, top, bottom, rx, R, eye_h=3, eye_w=2, face_dx=-0.35, blush='#ff7a9a', mouth=True,
               spec=WHITE, eye_gap=None):
    mask = dome(c, cx, top, bottom, rx, R)
    h = bottom - top + 1
    # liseré de lumière rebondie en bas à droite (translucide)
    for (x, y) in mask:
        if y == bottom - 2 and x > cx + rx * 0.2 and (x + 1, y) in mask and (x + 2, y) not in mask:
            c.set(x, y, R[2])
    # gros reflet spéculaire en haut à gauche
    hx, hy = cx - rx * 0.55, top + h * 0.22
    c.ellipse(hx + 1.2, hy + 0.9, max(1.4, rx * 0.22), max(1.0, h * 0.09), R[4], only_inside=True)
    c.set(hx, hy + 1, spec); c.set(hx + 1, hy, spec); c.set(hx + 2, hy - 0.4, R[4])
    c.set(hx, hy + 2, R[4])
    # bord supérieur foncé sous le contour (volume)
    for (x, y) in mask:
        if (x, y - 1) not in mask and x > cx + rx * 0.35:
            c.set(x, y, R[1])
    if rx > 12:
        # reflet en arc le long du bord haut-gauche
        for a in range(150, 250, 6):
            t = math.radians(a)
            x = cx + math.cos(t) * rx * 0.78
            y = top + h * 0.62 + math.sin(t) * h * 0.5
            c.setf(x, y, R[4])
        c.set(hx + 1, hy + 1, spec); c.set(hx + 2, hy, spec); c.set(hx, hy + 2, spec)
    c.set(hx + 3.5, hy + 1.6, spec) if rx > 7 else None
    # visage tourné de côté
    fx = cx + rx * face_dx
    gap = eye_gap if eye_gap is not None else max(3, int(rx * 0.55))
    ey = top + int(h * 0.38)
    e1, e2 = int(round(fx - gap / 2 - eye_w / 2)), int(round(fx + gap / 2 - eye_w / 2 + 1))
    cute_eye(c, e1, ey, eye_h, eye_w)
    cute_eye(c, e2, ey, eye_h, eye_w)
    if blush:
        c.set(e1 - 1, ey + eye_h, blush); c.set(e2 + eye_w, ey + eye_h, blush)
    if mouth:
        mx = int(round((e1 + e2 + eye_w) / 2)) - 1
        my = ey + eye_h
        c.set(mx, my, R[0]); c.set(mx + 1, my, R[0])
        if rx > 12:
            c.set(mx - 1, my - 1, R[0]); c.set(mx + 2, my - 1, R[0]); c.set(mx, my + 1, '#c84a5a'); c.set(mx + 1, my + 1, '#e86a7a')
    return mask


def slime():
    c = Canvas(26, 22)
    slime_core(c, 11, 2, 16, 9.5, G_SLIME, eye_h=4, eye_gap=5)
    # petite goutte qui perle
    c.set(19, 15, G_SLIME[2]); c.set(20, 16, G_SLIME[1])
    return finish(c)


def boss_slime_king():
    c = Canvas(52, 46)
    R = ['#16503a', '#24803e', '#3fae3a', '#74d644', '#b8f070']
    slime_core(c, 22, 8, 37, 20.5, R, eye_h=6, eye_w=3, face_dx=-0.3, eye_gap=9)
    # bulles internes / gemmes englouties
    for (x, y, r) in ((31, 27, 1.6), (35, 21, 1.1), (12, 31, 1.2)):
        c.ellipse(x, y, r, r, R[3], only_inside=True)
        c.set(x - 0.5, y - 0.5, R[4])
    c.set(28, 32, BLUE_GEM[2]); c.set(29, 32, BLUE_GEM[1]); c.set(28, 31, BLUE_GEM[3])
    # couronne inclinée
    cr = Canvas(52, 46)
    crown(cr, 14, 0, 17, 10, points=3)
    cr.set(22, 2, RED_GEM[2]); cr.set(22, 3, RED_GEM[1]); cr.set(21, 2, RED_GEM[3])
    cr.outline(OUT)
    c.paste(cr, 0, 3)
    # gouttes au sol
    c.set(43, 37, R[2]); c.set(42, 37, R[1]); c.set(43, 36, R[3])
    return finish(c)


def pet_slime():
    c = Canvas(18, 16)
    R = ['#8a4a1a', '#cf8a20', '#f2c23a', '#ffe680', '#fffbd8']
    slime_core(c, 8, 2, 14, 7, R, eye_h=4, face_dx=0.18, blush='#ff8a6a', eye_gap=3)
    c.set(13, 2, WHITE); c.set(14, 1, '#ffe680'); c.set(12, 1, '#ffe680'); c.set(13, 0, '#ffe680'); c.set(13, 3, '#ffe680')
    c.outline(OUT)
    # faces left by construction (face_dx>0 means right)
    return crop(c)


# ---------------------------------------------------------------- goblin

def goblin():
    c = Canvas(28, 30)
    # jambes et bottes
    spoly(c, [(12, 20), (15, 20), (15, 25), (12, 25)], [shift(x, dl=-0.08) for x in G_SKIN])
    spoly(c, [(7, 20), (10, 20), (10, 25), (7, 25)], G_SKIN)
    spoly(c, [(11, 25), (17, 25), (17, 27), (10, 27)], [shift(x, dl=-0.06) for x in LEATHER])
    spoly(c, [(5, 25), (11, 25), (11, 27), (4, 27)], LEATHER)
    # tunique en cuir
    spoly(c, [(7, 13), (16, 13), (18, 22), (5, 22)], LEATHER)
    for x in range(5, 19):
        c.setf(x, 18, LEATHER[0])
        c.setf(x, 21, LEATHER[1] if x % 2 else LEATHER[0])
    c.set(9, 18, GOLD[2]); c.set(10, 18, GOLD[1])
    c.set(12, 15, LEATHER[0]); c.set(12, 16, LEATHER[0])  # couture
    # bras arrière
    sline(c, 16, 15, 18, 19, G_SKIN, 3)
    # tête
    spoly(c, [(14, 6), (24, 2), (19, 10), (16, 11)], G_SKIN)  # grande oreille
    c.line(17, 7, 22, 4, G_SKIN[1])
    sell(c, 11, 8, 6.5, 5.6, G_SKIN)
    spoly(c, [(6, 6), (1, 4), (5, 10)], G_SKIN)  # oreille avant
    c.line(2, 5, 5, 7, G_SKIN[1])
    sell(c, 4.6, 9.4, 1.8, 1.4, G_SKIN)  # nez
    c.set(4, 9, G_SKIN[4])
    # yeux jaunes méchants
    for ex in (6, 10):
        c.set(ex, 7, '#ffe14a'); c.set(ex + 1, 7, '#ffe14a')
        c.set(ex, 7, INK)
        c.set(ex - 1, 6, G_SKIN[0]); c.set(ex, 6, G_SKIN[0]); c.set(ex + 1, 6, G_SKIN[1])
    c.set(10, 7, INK); c.set(11, 7, '#ffe14a'); c.set(11, 8, '#c89a1a')
    c.set(6, 7, INK); c.set(7, 7, '#ffe14a'); c.set(7, 8, '#c89a1a')
    # bouche + croc
    for x in range(6, 11):
        c.set(x, 11, G_SKIN[0])
    c.set(7, 12, WHITE); c.set(10, 12, WHITE)
    # capuchon / bandeau de cuir
    for x in range(7, 16):
        c.setf(x, 3, LEATHER[3] if x < 11 else LEATHER[2])
        c.setf(x, 4, LEATHER[1])
    # bras avant + gourdin
    sline(c, 9, 15, 6, 18, G_SKIN, 3)
    c.line(5, 19, 3, 11, WOOD[1], 2)
    c.line(4, 19, 2, 12, WOOD[2])
    sell(c, 2.5, 9.5, 2.4, 3, WOOD)
    c.set(1, 8, WOOD[3]); c.set(3, 11, WOOD[0])
    c.set(0, 9, STEEL[3]); c.set(4, 8, STEEL[3])  # clous
    sell(c, 5.5, 18.5, 1.8, 1.6, G_SKIN)
    return finish(c)


# ---------------------------------------------------------------- loups

def wolf_draw(s, FUR, BELLY, eye, dark_mane=None, scars=False):
    """Loup de profil tourné à gauche ; s = échelle (1 = 30×20)."""
    W, H = int(32 * s) + 4, int(21 * s) + 4

    def P(pts):
        return [(x * s + 1, y * s + 1) for x, y in pts]

    c = Canvas(W, H)
    far = [shift(x, dl=-0.1) for x in FUR]
    # queue touffue
    spoly(c, P([(23, 9), (27, 4), (30, 3), (30.5, 6), (28, 10), (25, 12)]), FUR)
    c.line(27 * s + 1, 5 * s + 1, 29.5 * s + 1, 4 * s + 1, BELLY[-1])
    # pattes arrière-plan
    spoly(c, P([(8, 12), (10, 12), (10.5, 18), (8, 18.6)]), far)
    spoly(c, P([(20, 12), (23, 12), (21.5, 18), (19.5, 18.6)]), far)
    # corps
    sell(c, 17 * s + 1, 10 * s + 1, 9 * s, 5 * s, FUR)
    # ventre clair
    for (x, y) in mask_of(lambda m: m.ellipse(17 * s + 1, 13 * s + 1, 7 * s, 2.2 * s, '#000')):
        c.setf(x, y, BELLY[1])
    # cuisse
    sell(c, 23 * s + 1, 11.5 * s + 1, 3.6 * s, 3.6 * s, FUR)
    spoly(c, P([(22, 13), (25.5, 13), (26, 18), (23.5, 18.6)]), FUR)
    spoly(c, P([(10, 11), (13.5, 11), (13, 18.6), (10.5, 18.6)]), FUR)
    # pieds
    for fx in (9.2, 11.8, 20.6, 24.8):
        sell(c, fx * s + 1, 18.6 * s + 1, 1.6 * s, 1 * s, FUR if fx in (11.8, 24.8) else far)
    # poitrail et cou
    sell(c, 10 * s + 1, 9.5 * s + 1, 4.6 * s, 4.6 * s, FUR)
    for (x, y) in mask_of(lambda m: m.ellipse(9 * s + 1, 11.5 * s + 1, 2.6 * s, 2.8 * s, '#000')):
        c.setf(x, y, BELLY[2])
    # crinière hérissée
    mane = dark_mane or FUR
    spoly(c, P([(9, 4), (12, 2.5), (13, 4.5), (15, 3.2), (16, 5.5), (19, 4.6), (18, 7), (11, 8)]), mane)
    # tête
    sell(c, 7 * s + 1, 7 * s + 1, 4.4 * s, 3.9 * s, FUR)
    spoly(c, P([(8, 4.5), (9.6, 0), (11.5, 5)]), FUR)  # oreille
    c.set(9.6 * s + 1, 2.6 * s + 1, BELLY[0])
    c.set(9.6 * s + 1, 3.6 * s + 1, BELLY[0])
    spoly(c, P([(5.5, 4.5), (6.4, 1), (8, 4)]), far)
    # museau
    spoly(c, P([(0.4, 7.4), (5, 5.8), (7, 8), (6, 10.8), (1.2, 10.4)]), FUR)
    for (x, y) in mask_of(lambda m: m.poly(P([(1, 9.6), (6, 9.2), (6, 10.8), (1.2, 10.4)]), '#000')):
        c.setf(x, y, BELLY[1])
    # truffe
    c.set(0.5 * s + 1, 7.6 * s + 1, INK)
    if s > 1.2:
        c.set(1.5 * s + 1, 7.4 * s + 1, INK); c.set(0.5 * s + 1, 8.4 * s + 1, INK)
        c.set(1.2 * s + 1, 7.2 * s + 1, '#6a6a8a')
    # gueule
    c.line(1.2 * s + 1, 10 * s + 1, 5.5 * s + 1, 9.6 * s + 1, INK)
    c.set(2.2 * s + 1, 10.6 * s + 1, WHITE)
    c.set(4.2 * s + 1, 10.4 * s + 1, WHITE)
    # œil
    ex, ey = 5.2 * s + 1, 6.6 * s + 1
    c.set(ex, ey, eye[1]); c.set(ex - 1, ey, eye[2])
    c.set(ex - 1, ey - 1, FUR[0]); c.set(ex, ey - 1, FUR[0]); c.set(ex + 1, ey - 1, FUR[0])
    if s > 1.2:
        c.set(ex - 2, ey, eye[1]); c.set(ex - 1, ey, eye[3]); c.set(ex, ey + 1, eye[0]); c.set(ex - 1, ey + 1, eye[1])
        c.set(ex + 1, ey, eye[0]); c.set(ex - 2, ey + 1, eye[0])
        c.set(ex - 2, ey - 1, FUR[0]); c.set(ex - 3, ey - 2, FUR[0])
    if scars:
        for i in range(3):
            c.line((15 + i * 1.6) * s + 1, 8 * s + 1, (16.4 + i * 1.6) * s + 1, 11 * s + 1, '#b04a5a')
        c.line(6 * s + 1, 4.8 * s + 1, 8.2 * s + 1, 8.2 * s + 1, '#c86a7a')
    return c


def wolf():
    FUR = ['#2e2f48', '#4c5068', '#737a8e', '#a2a8b6', '#d0d4dc']
    BELLY = ['#6a6e84', '#b6b8c4', '#dadce4', '#f4f4f8']
    eye = ['#7a2a10', '#e8a020', '#ffe070', '#fff8d0']
    return finish(wolf_draw(1, FUR, BELLY, eye))


def wolf_ice():
    FUR = ['#3c5a94', '#6a94c8', '#a6cbea', '#dceefa', '#ffffff']
    BELLY = ['#7aa4d4', '#d4ecfa', '#eef8ff', '#ffffff']
    eye = ['#1a3aa0', '#3ab8ff', '#a8f0ff', '#ffffff']
    c = wolf_draw(1, FUR, BELLY, eye, dark_mane=['#3c5a94', '#5a86c4', '#8ab8e8', '#c4e4fa', '#f0faff'])
    # éclats de glace sur l'échine
    for x, y in ((13, 3), (16, 4), (19, 5)):
        c.set(x, y - 1, '#c8f4ff'); c.set(x, y, '#6ad0ff')
    c.set(3, 7, '#8ae8ff')
    return finish(c)


def boss_alpha_wolf():
    FUR = ['#1a1428', '#2e2a40', '#4a465c', '#6e6a80', '#9a96a8']
    BELLY = ['#3a3648', '#6a6478', '#8e889a', '#b4aec0']
    eye = ['#8a3a00', '#ffc81e', '#fff27a', '#ffffff']
    c = wolf_draw(1.55, FUR, BELLY, eye, dark_mane=['#120c1e', '#221a30', '#3a3048', '#5a4e66', '#7a6e88'], scars=True)
    return finish(c)


# ---------------------------------------------------------------- champignon

def mushroom():
    c = Canvas(24, 26)
    CAP = ['#5a1028', '#a01e32', '#e0383a', '#ff7058', '#ffb48a']
    STEM = ['#8a6a5a', '#c8a888', '#ecd8b8', '#fff4dc']
    # petites jambes
    spoly(c, [(7, 19), (9, 19), (9, 22), (6, 22)], STEM[:3])
    spoly(c, [(12, 19), (14, 19), (15, 22), (12, 22)], STEM[:3])
    c.rect(5, 22, 4, 1, '#6a4a3a'); c.rect(11, 22, 5, 1, '#6a4a3a')
    # pied / visage
    sell(c, 10.5, 15, 5.8, 5, STEM)
    # chapeau
    mask = mask_of(lambda m: m.ellipse(11, 8.5, 10, 7, '#000'))
    mask = {(x, y) for (x, y) in mask if y <= 11}
    shade_mask(c, mask, CAP, contrast=0.4)
    for x in range(2, 21):
        c.setf(x, 11, CAP[0]) if (x, 11) in mask else None
    # lamelles sous le chapeau
    for x in range(5, 17):
        c.set(x, 12, STEM[0] if x % 2 else '#6a4a40')
    # taches blanches
    for (x, y, r) in ((6, 5, 1.7), (12, 3.6, 1.4), (16.5, 7.5, 1.6), (9.5, 8.5, 1.1), (3.5, 9, 0.9)):
        c.ellipse(x, y, r, r * 0.9, '#f8eee4', only_inside=True)
        c.setf(x + 0.6, y + 0.6, '#d8c4c4')
    c.set(5, 3, '#ffd0b8'); c.set(4, 4, '#ffd0b8')
    # visage colérique (tourné à gauche)
    for ex in (5, 10):
        c.rect(ex, 15, 2, 3, INK)
        c.set(ex, 15, WHITE)
        c.set(ex + 1, 17, '#c8302a')
    c.line(4, 13, 7, 14, '#5a2a2a'); c.line(12, 13, 9, 14, '#5a2a2a')
    c.set(7, 19, '#5a2a2a'); c.set(8, 18, '#5a2a2a'); c.set(9, 18, '#5a2a2a'); c.set(10, 19, '#5a2a2a')
    c.set(4, 18, '#f0907a'); c.set(12, 18, '#f0907a')
    return finish(c)


# ---------------------------------------------------------------- chauve-souris

def bat(up):
    c = Canvas(28, 22)
    WING = ['#1e1230', '#3e2464', '#64409a', '#8e68c8', '#b898ea']
    BODY = ['#24183a', '#46306c', '#6c4ca0', '#9a7ad0', '#c8b0f0']
    cx, cy = 13, 10
    BONEW = [WING[0], WING[2], WING[3]]
    if up:
        sh, wr, tips, bp = (15, 9), (18, 2), [(22, -1), (26, 2), (25, 8)], (17, 12)
    else:
        sh, wr, tips, bp = (15, 9), (20, 10), [(25, 9), (26, 14), (22, 17)], (16, 13)
    m = lambda p: (2 * cx - p[0], p[1])
    membrane_wing(c, sh, wr, tips, bp, [shift(x, dl=-0.06) for x in WING], BONEW)
    membrane_wing(c, m(sh), m(wr), [m(t) for t in tips], m(bp), WING, BONEW)
    sell(c, cx, cy, 3.6, 4.2, BODY)
    # oreilles
    spoly(c, [(10, 7), (10, 2), (13, 6)], BODY)
    spoly(c, [(13, 6), (15, 2), (16, 7)], BODY)
    c.set(11, 4, '#e88ab8'); c.set(15, 4, '#c86a98')
    # visage (légèrement tourné à gauche)
    c.set(11, 9, '#ffe24a'); c.set(14, 9, '#ffe24a')
    c.set(11, 10, '#ff6a2a'); c.set(14, 10, '#ff6a2a')
    c.set(12, 12, WHITE); c.set(14, 12, WHITE)
    c.set(13, 11, BODY[0])
    c.set(10, 8, BODY[0]); c.set(15, 8, BODY[0])
    # petites pattes
    c.set(12, 14, BODY[1]); c.set(14, 14, BODY[1])
    return finish(c)


# ---------------------------------------------------------------- squelettes

def bone_line(c, x0, y0, x1, y1, w=2):
    sline(c, x0, y0, x1, y1, BONE[1:], w)


def skeleton():
    c = Canvas(24, 34)
    # jambes
    bone_line(c, 12, 20, 13, 31)
    bone_line(c, 8, 20, 7, 31)
    sell(c, 12.5, 25.5, 1.4, 1.2, BONE)
    sell(c, 7.5, 25.5, 1.4, 1.2, BONE)
    c.rect(4, 31, 5, 2, BONE[2]); c.rect(4, 32, 5, 1, BONE[1])
    c.rect(12, 31, 5, 2, BONE[2]); c.rect(12, 32, 5, 1, BONE[1])
    # bassin
    sell(c, 10, 19.5, 4, 1.8, BONE)
    # colonne + côtes
    for y in range(11, 19):
        c.set(10, y, BONE[2] if y % 2 else BONE[1])
    for i, y in enumerate((12, 14, 16)):
        w = 5 - i
        c.line(10 - w, y + 1, 10 + w, y + 1, BONE[1])
        c.line(10 - w, y, 10 + w, y, BONE[3])
        c.set(10 - w, y + 1, BONE[2])
    c.line(5, 11, 15, 11, BONE[2])
    # bras arrière
    bone_line(c, 15, 12, 16, 18, 2)
    # crâne
    sell(c, 10, 6, 5.6, 5, BONE)
    spoly(c, [(5, 7), (12, 7), (12, 11), (6, 11)], BONE[1:], bias=0.1)
    # orbites (rouge braise, tournées à gauche)
    c.ellipse(6.5, 6.5, 1.6, 1.7, INK)
    c.ellipse(11, 6.5, 1.6, 1.7, INK)
    c.set(6, 6, '#ff5a3a'); c.set(10, 6, '#ff5a3a'); c.set(6, 7, '#a02020')
    c.set(8, 9, INK)
    for x in range(6, 12, 2):
        c.set(x, 10, INK)
    c.set(7, 2, BONE[4]); c.set(6, 3, BONE[4])
    c.set(13, 4, BONE[1])
    # épée rouillée
    BL = ['#4a3a3a', '#7a7470', '#a8a6a2', '#d8d6d0']
    c.line(2, 2, 3, 14, BL[2], 2)
    c.line(2, 2, 2.5, 14, BL[3])
    c.line(3.5, 3, 4, 14, BL[1])
    c.set(2, 1, BL[3])
    for x, y in ((2, 5), (3, 6), (3, 9), (2, 11), (3, 12), (4, 8)):
        c.set(x, y, RUST[2] if (x + y) % 2 else RUST[1])
    c.set(3, 4, '#3a1a1a'); c.set(4, 11, None)
    c.line(0, 15, 6, 15, STEEL[1])
    c.set(0, 15, STEEL[3]); c.set(1, 15, STEEL[3])
    c.line(3, 16, 3, 18, WOOD[1])
    bone_line(c, 6, 12, 4, 17, 2)
    return finish(c)


def boss_bone_lord():
    c = Canvas(40, 52)
    CAPE = ['#1a0a24', '#3a1040', '#62185a', '#8e2a72', '#b8509a']
    DARKSTEEL = ['#1a1a2e', '#33344e', '#55587a', '#8086a6', '#c0c8de']
    # cape derrière
    spoly(c, [(12, 14), (26, 14), (31, 46), (27, 44), (24, 47), (20, 44), (16, 47), (12, 44), (8, 46)], CAPE)
    for x in (13, 18, 23, 27):
        c.line(x, 18, x + (x - 18) * 0.3, 43, CAPE[1])
    # jambes
    bone_line(c, 21, 31, 22, 45, 3)
    bone_line(c, 15, 31, 13, 45, 3)
    sell(c, 21.5, 38, 2, 1.6, BONE)
    sell(c, 14, 38, 2, 1.6, BONE)
    spoly(c, [(9, 44), (16, 44), (16, 47), (8, 47)], DARKSTEEL)
    spoly(c, [(19, 44), (26, 44), (26, 47), (18, 47)], DARKSTEEL)
    # bassin + jupe d'armure
    spoly(c, [(12, 27), (25, 27), (27, 34), (10, 34)], DARKSTEEL)
    for x in range(10, 28, 3):
        c.setf(x, 33, DARKSTEEL[0]); c.setf(x, 32, DARKSTEEL[0])
    # cage thoracique sous plastron
    spoly(c, [(11, 15), (26, 15), (25, 28), (12, 28)], BONE[1:])
    for i, y in enumerate(range(17, 27, 2)):
        c.line(12, y, 25, y, BONE[0])
    for y in range(16, 28):
        c.set(18, y, BONE[3] if y % 2 else BONE[2])
    c.ellipse(19, 21, 1.6, 1.6, '#ff4a6a')  # cœur maudit
    c.set(18, 20, '#ffc0d0')
    # épaulières
    sell(c, 11, 15.5, 4.5, 3.5, DARKSTEEL)
    sell(c, 26, 15.5, 4.5, 3.5, DARKSTEEL)
    for x, y in ((8, 13), (11, 11), (27, 11), (30, 13)):
        c.set(x, y - 1, DARKSTEEL[4]); c.set(x, y, DARKSTEEL[3])
    c.set(9, 14, GOLD[3]); c.set(25, 14, GOLD[2])
    # bras arrière
    bone_line(c, 29, 17, 31, 26, 2)
    # crâne
    sell(c, 18, 8, 7, 6.2, BONE)
    spoly(c, [(12, 9), (21, 9), (21, 14), (13, 14)], BONE[1:], bias=0.1)
    c.ellipse(13.5, 8.5, 2.1, 2.2, INK)
    c.ellipse(19.5, 8.5, 2.1, 2.2, INK)
    c.set(13, 8, '#5affd8'); c.set(19, 8, '#5affd8'); c.set(14, 8, '#2ab0a0'); c.set(20, 8, '#2ab0a0')
    c.set(13, 9, '#1a7a80'); c.set(19, 9, '#1a7a80')
    c.set(16, 11, INK); c.set(17, 11, INK)
    for x in range(13, 21, 2):
        c.set(x, 13, INK)
    c.line(13, 12, 20, 12, BONE[1])
    # couronne
    cr = Canvas(40, 52)
    crown(cr, 11, 0, 15, 7, points=4)
    cr.outline(OUT)
    c.paste(cr, 0, 0)
    # grande lame (bras avant)
    c.line(5, 2, 6, 31, DARKSTEEL[3], 3)
    c.line(4, 3, 4.6, 31, DARKSTEEL[4])
    c.line(7, 3, 7.4, 31, DARKSTEEL[1])
    c.line(5.6, 4, 6.1, 30, '#9a6ad8')  # gorge enchantée
    c.set(5, 1, DARKSTEEL[4]); c.set(5, 0, WHITE)
    spoly(c, [(1, 31), (11, 31), (11, 33), (1, 33)], GOLD)
    c.set(6, 32, RED_GEM[2])
    c.line(6, 34, 6, 38, LEATHER[1], 2)
    sell(c, 6, 39.5, 1.6, 1.5, GOLD)
    bone_line(c, 11, 18, 8, 26, 3)
    sell(c, 7.5, 27, 2, 1.8, BONE)
    return finish(c)


# ---------------------------------------------------------------- spectres

def wraith():
    c = Canvas(24, 30)
    R = ['#22164a', '#3e2c84', '#5e4cbc', '#8a7ce0', '#c0b4f8']
    # corps en lambeaux
    body = [(6, 5), (14, 3), (17, 9), (18, 18), (20, 27), (16, 22), (13, 27), (11, 22), (7, 27), (6, 21), (2, 25), (4, 16)]
    spoly(c, body, R, contrast=0.4)
    # transparence : tramage qui s'estompe dans les lambeaux
    for (x, y) in mask_of(lambda m: m.poly(body, '#000')):
        if y > 20 and (x + y) % 2 == 0:
            c.set(x, y, R[1] if y < 24 else R[0])
        elif y > 23:
            c.set(x, y, R[2])
    # capuche
    sell(c, 10, 7, 5.6, 5.4, R)
    c.ellipse(8.4, 8.6, 3.4, 3.4, '#120a24')
    c.set(6, 8, '#7af8ff'); c.set(10, 8, '#7af8ff'); c.set(7, 8, '#2ab8e8'); c.set(11, 8, '#2ab8e8')
    c.set(6, 7, '#e0ffff')
    c.set(8, 11, '#2a1a4a')
    # bras griffus tendus à gauche
    spoly(c, [(8, 13), (12, 13), (6, 18), (2, 17)], R)
    c.line(2, 17, 0, 16, R[3]); c.line(2, 18, 0, 19, R[3]); c.line(3, 18, 1, 20, R[2])
    c.set(14, 12, R[4]); c.set(13, 14, R[3])
    # lueur
    for x, y in ((15, 8), (16, 14), (4, 22)):
        c.setf(x, y, R[4])
    return finish(c)


def boss_spectral_queen():
    c = Canvas(40, 50)
    R = ['#183a6a', '#2a66a8', '#4ea0dc', '#8ad4f4', '#d4f6ff']
    DRESS = ['#1a2a5a', '#2a4a8e', '#3e74c4', '#6aa8e6', '#b0e0fa']
    body = [(11, 16), (24, 16), (27, 30), (31, 44), (27, 41), (24, 46), (20, 41), (16, 46), (12, 41), (8, 45), (5, 40), (8, 28)]
    spoly(c, body, DRESS, contrast=0.4)
    for (x, y) in mask_of(lambda m: m.poly(body, '#000')):
        if y > 38 and (x + y) % 2 == 0 and y > 41:
            c.set(x, y, None)
    for x in (12, 17, 22, 26):
        c.line(x, 22, x + (x - 18) * 0.5, 40, DRESS[1])
    c.line(14, 20, 10, 38, DRESS[4])
    # corsage + broche
    spoly(c, [(12, 15), (23, 15), (22, 24), (13, 24)], R)
    c.set(17, 18, BLUE_GEM[3]); c.set(18, 18, BLUE_GEM[2]); c.set(17, 19, BLUE_GEM[1]); c.set(18, 19, BLUE_GEM[1])
    # cheveux flottants
    spoly(c, [(13, 4), (25, 5), (30, 14), (33, 24), (28, 20), (26, 25), (22, 14)], ['#3a5aa0', '#6a9ad8', '#a8d4f6', '#e4f8ff'])
    c.line(25, 8, 31, 20, '#e4f8ff')
    # visage
    sell(c, 16, 10, 5.2, 5.6, ['#5a8ac0', '#9ac8ea', '#d4f0fc', '#f4fcff'])
    c.set(13, 10, INK); c.set(13, 11, '#3ad0ff'); c.set(17, 10, INK); c.set(17, 11, '#3ad0ff')
    c.set(12, 9, '#5a8ac0'); c.set(16, 9, '#5a8ac0')
    c.set(14, 14, '#4a6aa8'); c.set(15, 14, '#4a6aa8')
    spoly(c, [(19, 4), (22, 6), (22, 13), (19, 10)], ['#3a5aa0', '#6a9ad8', '#a8d4f6'])
    # bras tendu à gauche, magie de glace
    spoly(c, [(12, 18), (14, 20), (6, 25), (4, 23)], R)
    c.ellipse(3, 23, 2.6, 2.6, '#6ae0ff')
    c.ellipse(3, 23, 1.4, 1.4, '#e0ffff')
    c.set(0, 20, '#a8f0ff'); c.set(5, 19, '#a8f0ff'); c.set(1, 27, '#6ae0ff')
    # couronne de glace
    cr = Canvas(40, 50)
    pts = [(10, 6), (11, 0), (13, 4), (15, -1), (17, 4), (19, 0), (21, 6)]
    cr.poly(pts + [(21, 7), (10, 7)], '#a8e8ff')
    for x, y in ((11, 1), (15, 0), (19, 1)):
        cr.set(x, y, WHITE)
    for x in range(10, 22):
        cr.setf(x, 6, '#4a90d0')
    cr.set(15, 4, '#3a6ae8'); cr.set(15, 5, '#2a3aa8')
    cr.outline(OUT)
    c.paste(cr, 0, 1)
    # étincelles givrées
    for x, y in ((33, 32), (35, 30), (2, 33)):
        c.set(x, y, '#d4f6ff')
    return finish(c)


# ---------------------------------------------------------------- désert

def scorpion():
    c = Canvas(32, 22)
    R = ['#5a1e10', '#a0441a', '#e07a28', '#ffae4a', '#ffe08a']
    # pattes
    for i, x in enumerate((10, 13, 16, 19)):
        c.line(x, 13, x - 2, 17, R[0])
        c.line(x - 2, 17, x - 3, 18, R[0])
        c.line(x + 1, 13, x + 3, 17, R[1])
        c.line(x + 3, 17, x + 4, 18, R[1])
    # queue segmentée
    seg = [(22, 12, 3.4, 3), (25, 9.5, 3, 2.8), (26.5, 6, 2.6, 2.6), (25.5, 3, 2.4, 2.3), (22.5, 1.6, 2.2, 1.9)]
    for x, y, rx, ry in seg:
        sell(c, x, y, rx, ry, R)
    # dard
    spoly(c, [(21, 0.5), (17, 2.6), (21, 3)], ['#3a1a2a', '#8a3a5a', '#e06a8a', '#ffc0d0'])
    c.set(17, 2, '#ffe0e8')
    # corps
    sell(c, 15, 12, 7.5, 3.6, R)
    for x in (12, 16, 20):
        for y in range(9, 15):
            p = c.get(x, y)
            if p is not None:
                c.set(x, y, R[max(0, R.index(p) - 1)] if p in R else p)
    sell(c, 8, 12, 3.6, 3, R)
    # pinces (arrière, plus sombre puis avant)
    Rd = [shift(x, dl=-0.08) for x in R]
    sline(c, 8, 13, 5, 15, Rd, 2)
    sell(c, 3.6, 15, 2.8, 2.1, Rd)
    spoly(c, [(2, 13.2), (-1.5, 13.6), (-1, 14.6), (1.6, 14.8)], Rd)
    spoly(c, [(2, 15.8), (-0.6, 16.6), (1.5, 17.2), (3.5, 17)], Rd)
    sline(c, 8, 11, 5, 9, R, 2)
    sell(c, 3.6, 8.6, 3, 2.3, R)
    spoly(c, [(2, 6.6), (-2, 6.4), (-1.6, 7.6), (1.4, 8.2)], R)
    spoly(c, [(1.6, 9.4), (-1, 10.2), (1.4, 10.8), (3.5, 10.8)], R)
    c.set(2, 7, R[4]); c.set(3, 7, R[4])
    # yeux
    c.set(7, 10, INK); c.set(8, 10, INK); c.set(7, 9, WHITE)
    return finish(c)


def mummy():
    c = Canvas(24, 32)
    B = ['#5a4a3a', '#8e7a5e', '#c2ae88', '#e4d4b0', '#f8f0dc']
    # jambes
    spoly(c, [(11, 20), (15, 20), (15, 28), (11, 28)], [shift(x, dl=-0.08) for x in B])
    spoly(c, [(5, 20), (10, 20), (9, 28), (5, 28)], B)
    c.rect(3, 27, 6, 2, B[1]); c.rect(11, 27, 6, 2, B[0])
    # torse
    spoly(c, [(5, 10), (16, 10), (16, 21), (5, 21)], B)
    # bras arrière tendu
    spoly(c, [(13, 11), (17, 12), (11, 15), (8, 14)], [shift(x, dl=-0.08) for x in B])
    # tête
    sell(c, 10, 6, 5.2, 5, B)
    # bandelettes
    for (x, y) in list(mask_of(lambda m: m.rect(0, 0, 24, 32, '#000'))):
        p = c.get(x, y)
        if p is None:
            continue
        if (y + (x // 4)) % 3 == 0:
            c.set(x, y, shift(p, dl=-0.09))
        elif (y + (x // 4)) % 3 == 1 and p == B[2]:
            c.set(x, y, B[3])
    # fente des yeux luisants
    for x in range(5, 12):
        c.set(x, 6, '#2a1a10')
    c.set(6, 6, '#7aff5a'); c.set(9, 6, '#7aff5a'); c.set(7, 6, '#2aa83a'); c.set(10, 6, '#2aa83a')
    # bras avant tendu vers la gauche
    spoly(c, [(8, 11), (10, 13), (2, 15), (1, 12)], B)
    for x in (3, 5, 7):
        c.setf(x, 13, B[1])
    # bandelette flottante
    c.line(16, 16, 20, 18, B[3]); c.line(20, 18, 22, 21, B[2]); c.line(17, 17, 21, 19, B[1])
    c.set(6, 3, B[4]); c.set(7, 2, B[4])
    return finish(c)


# ---------------------------------------------------------------- yéti

def yeti():
    c = Canvas(32, 36)
    FUR = ['#5a6a9a', '#98a8d0', '#cad6ee', '#eef3fc', '#ffffff']
    SKIN = ['#1a2a6a', '#2e4ea8', '#4a7ad8', '#8ab4f4']
    # jambes
    spoly(c, [(15, 24), (21, 24), (22, 33), (15, 33)], [shift(x, dl=-0.08) for x in FUR])
    spoly(c, [(7, 24), (13, 24), (13, 33), (6, 33)], FUR)
    sell(c, 9, 33, 4, 1.6, SKIN)
    sell(c, 19, 33, 4, 1.6, [shift(x, dl=-0.06) for x in SKIN])
    # bras arrière
    spoly(c, [(20, 12), (25, 13), (27, 26), (22, 27)], [shift(x, dl=-0.08) for x in FUR])
    # corps massif
    sell(c, 14, 17, 9.6, 9, FUR)
    # touffes de poils
    for x, y in ((6, 12), (9, 9), (20, 10), (23, 15), (5, 20), (22, 22), (12, 26)):
        c.setf(x, y, FUR[1]); c.setf(x + 1, y + 1, FUR[1])
    # tête (encastrée dans le corps)
    sell(c, 10, 8, 6.4, 6, FUR)
    for x, y in ((6, 2), (9, 1), (12, 2)):
        c.set(x, y, FUR[3]); c.set(x, y - 1, FUR[4])
    # visage bleu
    spoly(c, [(4, 7), (12, 7), (12, 13), (5, 13)], SKIN)
    c.set(6, 8, INK); c.set(10, 8, INK)
    c.set(6, 9, '#ffe24a'); c.set(10, 9, '#ffe24a')
    c.set(5, 8, SKIN[0]); c.set(9, 8, SKIN[0]); c.set(7, 8, SKIN[0]); c.set(11, 8, SKIN[0])
    for x in range(5, 12):
        c.set(x, 11, INK)
    c.set(6, 12, WHITE); c.set(10, 12, WHITE)
    c.set(6, 10, SKIN[3])
    # bras avant (gros poing)
    spoly(c, [(6, 14), (11, 15), (6, 25), (2, 24)], FUR)
    sell(c, 3.5, 25.5, 3, 2.6, SKIN)
    c.set(2, 24, SKIN[3])
    return finish(c)


# ---------------------------------------------------------------- démons

def imp():
    c = Canvas(24, 28)
    R = ['#4a0a1e', '#8a1a2a', '#d0302e', '#ff6a4a', '#ffb08a']
    WING = ['#2a0a1a', '#5a1428', '#8a2638', '#c04a4a']
    # aile
    membrane_wing(c, (13, 11), (17, 3), [(22, 1), (24, 6), (21, 11)], (14, 14), WING, [WING[0], R[1], R[3]])
    # queue en pointe
    c.line(14, 19, 18, 20, R[1]); c.line(18, 20, 20, 17, R[1])
    spoly(c, [(19, 16), (22, 15), (21, 18)], R)
    # jambes
    spoly(c, [(10, 18), (13, 18), (13, 23), (11, 23)], R[:4])
    spoly(c, [(6, 18), (9, 18), (8, 23), (5, 23)], R[:4])
    c.rect(4, 23, 4, 1, R[0]); c.rect(10, 23, 4, 1, R[0])
    # corps bedonnant
    sell(c, 9.5, 15, 5, 4.6, R)
    for (x, y) in mask_of(lambda m: m.ellipse(8.5, 16, 2.8, 2.6, '#000')):
        c.setf(x, y, R[3])
    c.set(7, 15, R[4])
    # tête
    sell(c, 9, 7.5, 5.4, 5, R)
    # cornes
    spoly(c, [(5, 4), (3, -0.5), (7, 3)], ['#5a4a3a', '#a89a7a', '#f0e6c8'])
    spoly(c, [(10, 3), (12, -0.5), (13, 4)], ['#4a3a2a', '#8a7a5a', '#d0c4a0'])
    # yeux jaunes + sourire
    c.set(5, 7, '#ffe24a'); c.set(6, 7, '#ffe24a'); c.set(9, 7, '#ffe24a'); c.set(10, 7, '#ffe24a')
    c.set(5, 7, INK); c.set(9, 7, INK)
    c.set(4, 6, R[0]); c.set(5, 6, R[0]); c.set(9, 6, R[0]); c.set(10, 6, R[0])
    for x in range(5, 11):
        c.set(x, 10, INK)
    c.set(4, 9, INK); c.set(11, 9, INK)
    c.set(6, 11, WHITE); c.set(9, 11, WHITE)
    # petite fourche / griffe
    sline(c, 6, 13, 3, 15, R, 2)
    c.line(1, 6, 2, 20, WOOD[1])
    spoly(c, [(0, 5), (4, 5), (3, 7), (1, 7)], STEEL)
    c.set(0, 3, STEEL[4]); c.set(0, 4, STEEL[3]); c.set(2, 3, STEEL[4]); c.set(2, 4, STEEL[3]); c.set(4, 3, STEEL[4]); c.set(4, 4, STEEL[3])
    sell(c, 2.5, 15, 1.6, 1.5, R)
    return finish(c)


def boss_demon_king():
    c = Canvas(46, 54)
    R = ['#2a0614', '#5a0e22', '#9a1a26', '#d8382c', '#ff7a4a']
    ARM = ['#140a18', '#2a1a30', '#4a3450', '#74587a', '#a88aa8']
    FIRE = ['#8a1a0a', '#e04a10', '#ff9a1e', '#ffe060', '#fffbd0']
    WING = ['#1a0410', '#3e0a1c', '#6a1428', '#9a2a38']
    # ailes immenses
    membrane_wing(c, (26, 17), (34, 5), [(42, 3), (45, 11), (43, 19), (37, 25)], (29, 27), WING, [WING[0], R[2], R[3]])
    # aura de flammes au sol
    for x0 in range(4, 36, 5):
        spoly(c, [(x0, 50), (x0 + 2, 45 - (x0 % 3)), (x0 + 5, 50)], FIRE, bias=0.1)
    # jambes
    spoly(c, [(20, 34), (26, 34), (27, 48), (20, 48)], [shift(x, dl=-0.08) for x in R])
    spoly(c, [(11, 34), (17, 34), (16, 48), (10, 48)], R)
    spoly(c, [(8, 46), (17, 46), (17, 50), (7, 50)], ARM)
    spoly(c, [(19, 46), (28, 46), (28, 50), (19, 50)], ARM)
    # pagne / ceinture
    spoly(c, [(10, 30), (27, 30), (29, 38), (8, 38)], ARM)
    c.set(18, 32, GOLD[3]); c.set(19, 32, GOLD[2]); c.set(18, 33, GOLD[1]); c.set(19, 33, GOLD[1])
    for x in range(8, 30):
        c.setf(x, 30, GOLD[2] if x < 20 else GOLD[1])
    # torse musclé
    spoly(c, [(9, 16), (28, 16), (27, 31), (10, 31)], R)
    c.line(18, 19, 18, 29, R[1])
    c.line(12, 22, 17, 22, R[1]); c.line(20, 22, 25, 22, R[1])
    for y in (25, 27):
        c.line(14, y, 22, y, R[1])
    c.set(13, 18, R[4]); c.set(14, 18, R[4]); c.set(12, 19, R[4])
    # rune enflammée
    c.set(18, 20, FIRE[3]); c.set(18, 21, FIRE[2])
    # épaulières à pointes
    sell(c, 9, 16.5, 5, 4, ARM)
    sell(c, 28, 16.5, 5, 4, ARM)
    for x, y in ((6, 11), (10, 11), (28, 11), (32, 11)):
        c.line(x, y, x + (1 if x < 20 else 0), y + 3, ARM[3])
        c.set(x, y, ARM[4])
    # bras arrière
    spoly(c, [(29, 19), (33, 19), (34, 30), (30, 30)], [shift(x, dl=-0.08) for x in R])
    sell(c, 32, 31, 2.6, 2.4, R)
    # tête
    sell(c, 17, 9, 6, 6, R)
    spoly(c, [(11, 10), (17, 10), (16, 16), (12, 15)], R)
    # cornes
    spoly(c, [(12, 7), (7, 5), (4, 0), (9, 2), (13, 4)], ['#2a2028', '#5a4a52', '#9a8a8a', '#e0d4c4'])
    spoly(c, [(20, 4), (24, 1), (26, -3), (27, 3), (23, 7)], ['#1e161e', '#4a3a42', '#7a6a6a', '#b0a49a'])
    # couronne
    cr = Canvas(46, 54)
    crown(cr, 11, 0, 13, 7, points=3)
    cr.outline(OUT)
    c.paste(cr, 0, -1)
    # yeux de feu
    for ex in (12, 17):
        c.set(ex, 9, FIRE[4]); c.set(ex + 1, 9, FIRE[2])
        c.set(ex - 1, 8, R[0]); c.set(ex, 8, R[0]); c.set(ex + 1, 8, R[1])
    # gueule
    for x in range(11, 17):
        c.set(x, 13, INK)
    c.set(12, 14, WHITE); c.set(15, 14, WHITE); c.set(12, 12, WHITE)
    # bras avant + boule de feu
    spoly(c, [(8, 18), (12, 20), (6, 28), (3, 26)], R)
    sell(c, 4, 29, 4.2, 4.2, FIRE)
    c.ellipse(3.6, 28.6, 1.8, 1.8, FIRE[4])
    c.set(1, 24, FIRE[3]); c.set(6, 23, FIRE[2]); c.set(0, 27, FIRE[2])
    return finish(c)


# ---------------------------------------------------------------- dragon

def boss_ash_dragon():
    c = Canvas(66, 50)
    R = ['#3a0a12', '#7a1a1a', '#c0381e', '#ec6a2a', '#ffa850']
    BELLY = ['#7a3a1a', '#c8782a', '#f0b04a', '#ffe08a']
    WING = ['#2a0a1a', '#5a1424', '#902a2a', '#c84e34']
    MEMB = ['#3a0e1a', '#6e1e26', '#a43a30', '#d8683e']
    EMBER = ['#ff6a1a', '#ffb02a', '#ffe680', '#ffffd0']
    # aile arrière
    membrane_wing(c, (33, 20), (41, 5), [(50, 1), (57, 6), (56, 13), (50, 19)], (40, 22),
                  [shift(x, dl=-0.1) for x in MEMB], [WING[0], WING[1], WING[2]])
    # queue
    spoly(c, [(40, 30), (48, 32), (54, 35), (58, 33), (57, 39), (50, 40), (40, 37)], R)
    spoly(c, [(56, 33), (61, 28), (60, 36)], R[1:])
    for x in range(44, 56, 4):
        c.set(x, 31 + (x - 40) // 6, R[4])
    # pattes arrière
    spoly(c, [(36, 30), (44, 30), (45, 42), (40, 45), (36, 43)], [shift(x, dl=-0.06) for x in R])
    spoly(c, [(34, 43), (44, 43), (45, 46), (33, 46)], R)
    # corps
    sell(c, 33, 30, 13, 9, R)
    for (x, y) in mask_of(lambda m: m.ellipse(30, 35, 10, 4.5, '#000')):
        if c.get(x, y) is not None:
            c.set(x, y, BELLY[1] if y % 2 else BELLY[2])
    # écailles dorsales
    for x in range(24, 44, 3):
        y = 21 - int(3 * math.sin((x - 20) / 26 * math.pi))
        spoly(c, [(x, y + 2), (x + 1.5, y - 2), (x + 3, y + 2)], ['#2a0a1a', '#5a1a2a', '#8a2a3a'])
    # patte avant
    spoly(c, [(22, 31), (28, 31), (27, 42), (22, 44)], R)
    spoly(c, [(17, 42), (27, 42), (27, 46), (16, 46)], R)
    for x in (17, 20, 23):
        c.set(x, 46, '#f8e8d0'); c.set(x - 1, 46, '#c0b0a0')
    # cou
    spoly(c, [(14, 12), (21, 12), (27, 26), (19, 30), (14, 20)], R)
    for y in range(15, 29, 2):
        c.setf(17 + (y - 14) * 0.45, y, BELLY[2])
        c.setf(18 + (y - 14) * 0.45, y, BELLY[1])
    # tête
    sell(c, 13, 10, 6, 5, R)
    spoly(c, [(1, 10), (9, 7), (12, 10), (11, 15), (2, 14)], R)
    spoly(c, [(3, 14), (11, 13.5), (10, 17), (4, 16)], [shift(x, dl=-0.06) for x in R])
    # cornes
    spoly(c, [(14, 6), (22, 0), (19, 7)], ['#2a2028', '#6a5a5a', '#c8bca8', '#f0e8d8'])
    spoly(c, [(11, 6), (13, 0), (15, 5)], ['#2a2028', '#6a5a5a', '#c8bca8'])
    # œil + naseau
    c.set(10, 9, EMBER[3]); c.set(11, 9, EMBER[1]); c.set(9, 8, INK); c.set(10, 8, INK); c.set(11, 8, R[0])
    c.set(2, 10, INK); c.set(3, 10, R[0])
    # gueule et crocs
    c.line(2, 14, 10, 14, INK)
    for x in (3, 5, 8):
        c.set(x, 15, WHITE)
    c.set(4, 13, WHITE)
    # souffle de braises
    c.set(0, 16, EMBER[1]); c.set(1, 17, EMBER[0]); c.set(0, 13, EMBER[2])
    # aile avant
    membrane_wing(c, (27, 22), (33, 3), [(42, 0), (50, 5), (49, 13), (43, 19), (36, 24)], (31, 27), MEMB,
                  [WING[0], WING[2], WING[3]])
    # braises flottantes
    for x, y in ((54, 20), (57, 24), (50, 25), (8, 22), (5, 26)):
        c.set(x, y, EMBER[2])
    c.set(55, 21, EMBER[0])
    # lueur ventrale
    for x, y in ((27, 36), (30, 37), (33, 36)):
        c.set(x, y, EMBER[2])
    return finish(c)


# ---------------------------------------------------------------- compagnons (face à droite)

def pet_cat():
    c = Canvas(20, 18)
    F = ['#6a2a10', '#b05218', '#e88a2a', '#ffbe5a', '#ffe4a8']
    # queue
    c.line(3, 13, 1, 6, F[1], 2)
    c.line(2, 12, 0, 6, F[2])
    c.set(1, 5, F[4])
    # corps
    sell(c, 7.5, 12, 5, 3.4, F)
    for x in (5, 7, 9):
        c.setf(x, 10, F[1])
    # pattes
    for x in (4, 7, 10):
        c.rect(x, 14, 2, 2, F[2]); c.set(x, 15, F[3])
    # tête
    sell(c, 12.5, 7, 4.6, 4.2, F)
    spoly(c, [(9, 5), (9.5, 1), (12, 3.5)], F)
    spoly(c, [(13.5, 3.5), (16, 1), (16.5, 5)], F)
    c.set(10, 3, '#ff9aaa'); c.set(15, 3, '#ff9aaa')
    for (x, y) in mask_of(lambda m: m.ellipse(13.5, 9, 2.6, 1.8, '#000')):
        c.setf(x, y, F[4])
    cute_eye(c, 11, 6, 2, 1)
    cute_eye(c, 15, 6, 2, 1)
    c.set(13, 8, '#ff7a8a')
    c.set(12, 9, F[1]); c.set(14, 9, F[1])
    for x in (5, 7):
        c.setf(x, 12, F[1])
    return finish(c)


def pet_owl():
    c = Canvas(18, 20)
    F = ['#3a2014', '#6a3e22', '#9a6a3a', '#c89a5e', '#ecd09a']
    # corps
    sell(c, 8, 10, 6, 7, F)
    # ventre plumes
    for (x, y) in mask_of(lambda m: m.ellipse(9, 12, 3.6, 4.4, '#000')):
        c.setf(x, y, F[4] if (x + y) % 3 else F[3])
    # aile
    spoly(c, [(2, 8), (6, 9), (7, 15), (3, 16)], F)
    for y in (11, 13):
        c.setf(4, y, F[1]); c.setf(5, y, F[1])
    # aigrettes
    spoly(c, [(3, 4), (2, 0), (6, 3)], F)
    spoly(c, [(11, 3), (14, 0), (14, 4)], F)
    # disques faciaux
    c.ellipse(6.5, 6.5, 2.6, 2.4, F[4])
    c.ellipse(11.5, 6.5, 2.6, 2.4, F[4])
    c.ellipse(6.8, 6.6, 1.6, 1.6, '#ffc83a')
    c.ellipse(11.8, 6.6, 1.6, 1.6, '#ffc83a')
    c.set(7, 6, INK); c.set(12, 6, INK); c.set(7, 7, INK); c.set(12, 7, INK)
    c.set(6, 6, WHITE); c.set(11, 6, WHITE)
    c.set(9, 8, '#f0a020'); c.set(9, 9, '#a85a10')
    # pattes
    c.set(6, 17, '#f0a020'); c.set(7, 17, '#f0a020'); c.set(10, 17, '#f0a020'); c.set(11, 17, '#f0a020')
    return finish(c)


def pet_fairy():
    c = Canvas(18, 20)
    WING = ['#2a5ab0', '#5aa0f0', '#9ad4ff', '#e0f6ff']
    SKIN = ['#b06a5a', '#f0b090', '#ffdcc0', '#fff4e8']
    DRESS = ['#1a6a5a', '#2aa87a', '#5ee0a0', '#b0ffd0']
    HAIR = ['#8a4a10', '#d89a20', '#ffd84a', '#fff4a0']
    # ailes (derrière, vers la gauche)
    spoly(c, [(7, 9), (1, 2), (0, 6), (3, 10)], WING)
    spoly(c, [(7, 10), (1, 11), (2, 15), (6, 12)], [shift(x, dl=-0.06) for x in WING])
    c.set(2, 4, WHITE); c.set(3, 5, WING[3])
    # robe
    spoly(c, [(8, 9), (12, 9), (14, 16), (6, 16)], DRESS)
    c.line(7, 15, 13, 15, DRESS[3])
    # jambes
    c.set(9, 17, SKIN[1]); c.set(11, 17, SKIN[1])
    # tête
    sell(c, 10.5, 5.5, 3.8, 3.8, SKIN)
    spoly(c, [(6.5, 5), (8, 1), (13, 1), (14.5, 4), (12, 3.5), (9, 4), (8, 8)], HAIR)
    cute_eye(c, 11, 5, 2, 1)
    cute_eye(c, 13, 5, 2, 1)
    c.set(12, 8, '#e86a7a'); c.set(14, 7, '#ff9aaa')
    # baguette
    c.line(14, 11, 16, 8, WOOD[2])
    c.set(16, 7, '#ffe680'); c.set(17, 6, WHITE); c.set(15, 6, '#ffe680'); c.set(17, 8, '#ffe680')
    sell(c, 13.5, 11, 1.2, 1.2, SKIN)
    return finish(c)


def pet_golem():
    """Petit golem de pierre (face à droite) avec cristaux bleus."""
    c = Canvas(20, 20)
    S = ['#2e2a3a', '#545266', '#807e8e', '#aaa8b4', '#d4d2da']
    Sd = [shift(x, dl=-0.08) for x in S]
    CRY = ['#1a3a8a', '#2a8ae0', '#6ad8ff', '#d8faff']
    # bras arrière
    sell(c, 4, 11, 2.4, 3.4, Sd)
    # jambes trapues
    spoly(c, [(5, 14), (8, 14), (8, 18), (4, 18)], Sd)
    spoly(c, [(10, 14), (13, 14), (14, 18), (10, 18)], S)
    # torse rocheux
    sell(c, 9, 10.5, 6, 5, S)
    c.line(6, 12, 8, 14, S[0]); c.line(11, 7, 12, 9, S[1])
    # cristal du torse
    c.set(9, 11, CRY[3]); c.set(10, 11, CRY[2]); c.set(9, 12, CRY[2]); c.set(10, 12, CRY[1])
    # tête
    spoly(c, [(9, 2), (15, 2), (16, 7), (9, 7)], S)
    c.set(13, 4, CRY[3]); c.set(14, 4, CRY[2]); c.set(16, 4, None)
    c.set(15, 4, CRY[3])
    c.set(12, 3, S[0]); c.set(13, 3, S[0]); c.set(14, 3, S[0]); c.set(15, 3, S[0])
    c.set(14, 6, S[0]); c.set(15, 6, S[0])
    # cristaux sur l'épaule
    spoly(c, [(3, 7), (4, 1), (6, 7)], CRY)
    spoly(c, [(6, 7), (7.5, 3), (9, 7)], CRY[:3])
    c.set(4, 2, CRY[3])
    # mousse
    c.set(10, 6, '#6ab04a'); c.set(11, 6, '#8ad05a'); c.set(3, 13, '#6ab04a')
    # bras avant (gros poing)
    sell(c, 15, 11.5, 2.6, 3.6, S)
    sell(c, 15.5, 14.5, 2, 1.6, S)
    return finish(c)


def pet_wisp():
    c = Canvas(18, 20)
    F = ['#a02a0a', '#e85a14', '#ff9a24', '#ffd25a', '#fff8c8']
    flame = [(8, 0), (10, 4), (13, 3), (14, 9), (15, 13), (12, 17), (6, 17), (3, 13), (4, 8), (6, 6), (7, 2)]
    shade_mask(c, mask_of(lambda m: m.poly(flame, '#000')), F, contrast=0.3)
    # cœur chaud
    c.ellipse(9.5, 12, 3.6, 3.8, F[3])
    c.ellipse(9.2, 12.5, 2.2, 2.4, F[4])
    cute_eye(c, 9, 10, 2, 1)
    cute_eye(c, 12, 10, 2, 1)
    c.set(10, 13, F[1]); c.set(11, 13, F[1])
    for x, y in ((2, 4), (15, 1), (16, 6)):
        c.set(x, y, F[3])
    return finish(c)


# ---------------------------------------------------------------- export

def build():
    out = {
        'slime': slime(),
        'goblin': goblin(),
        'wolf': wolf(),
        'wolf_ice': wolf_ice(),
        'mushroom': mushroom(),
        'bat_up': bat(True),
        'bat_down': bat(False),
        'skeleton': skeleton(),
        'wraith': wraith(),
        'scorpion': scorpion(),
        'mummy': mummy(),
        'yeti': yeti(),
        'imp': imp(),
        'boss_slime_king': boss_slime_king(),
        'boss_alpha_wolf': boss_alpha_wolf(),
        'boss_bone_lord': boss_bone_lord(),
        'boss_spectral_queen': boss_spectral_queen(),
        'boss_ash_dragon': boss_ash_dragon(),
        'boss_demon_king': boss_demon_king(),
        'pet_slime': pet_slime(),
        'pet_cat': pet_cat(),
        'pet_owl': pet_owl(),
        'pet_fairy': pet_fairy(),
        'pet_golem': pet_golem(),
        'pet_wisp': pet_wisp(),
    }
    return {k: (v, {}) for k, v in out.items()}
