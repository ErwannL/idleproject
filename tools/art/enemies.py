"""Ennemis, boss et compagnons v6 (chibi 16 bits, ombrage à décalage de teinte, lumière en haut à gauche).

Les ennemis regardent à GAUCHE (ils marchent vers le héros), les compagnons à DROITE.
Chaque sprite est recadré au plus près ; la dernière ligne correspond aux pieds (sauf volants).
Les ennemis ont deux images d'animation : <nom> et <nom>_b (même taille de canvas).
"""
import math

from lib import Canvas as _Canvas, ramp, shift, mix

OUT = '#1a1226'
WHITE = '#fbfbff'
INK = '#1a1226'
LIGHT = (-0.6, -0.8)  # direction vers la source : haut-gauche

# ---------------------------------------------------------------- canvas à marge

M = 22  # marge invisible : on dessine en coordonnées logiques, même négatives
M_OLD = 10  # ancienne marge (les recadrages restent identiques tant que rien ne la dépasse)


class Canvas(_Canvas):
    """Canvas avec marge : coordonnées logiques décalées de M (recadré à la fin)."""

    def __init__(self, w, h):
        super().__init__(w + 2 * M, h + 2 * M)
        self.lw, self.lh = w, h

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


def raw_mask(c):
    return {(x, y) for y in range(c.h) for x in range(c.w) if c.px[y][x] is not None}


def part(c, fn, line=True, dl=-0.3):
    """Dessine une pièce par-dessus c ; trace un liseré sombre sur ce qu'elle recouvre (séparation)."""
    t = Canvas(c.lw, c.lh)
    fn(t)
    m = raw_mask(t)
    if line:
        for (x, y) in m:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if (nx, ny) in m or not (0 <= nx < c.w and 0 <= ny < c.h):
                    continue
                p = c.px[ny][nx]
                if p is not None and p != OUT:
                    c.px[ny][nx] = mix(p, OUT, 0.62)
    for (x, y) in m:
        c.px[y][x] = t.px[y][x]
    return m


def crop_to(c, box):
    x0, y0, x1, y1 = box
    n = _Canvas(x1 - x0 + 1, y1 - y0 + 1)
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            n.px[y - y0][x - x0] = c.px[y][x]
    return n


def finish(c, outline=True):
    if outline:
        c.outline(OUT)
    return crop_to(c, group_box([c]))


def group_box(frames):
    """Boîte commune de plusieurs images (Canvas à marge).

    Boîte englobante de toutes les images ; si un dessin dépasse l'ancienne marge (M_OLD, où il était
    coupé), la boîte s'agrandit symétriquement en largeur (personnage toujours centré, ancré par le bas)
    et vers le haut. Sans dépassement, la boîte est exactement l'ancienne.
    """
    bs = [c.bounds() for c in frames]
    new = (min(b[0] for b in bs), min(b[1] for b in bs), max(b[2] for b in bs), max(b[3] for b in bs))
    d = M - M_OLD
    lo_x, lo_y = d, d
    hi_x, hi_y = frames[0].w - 1 - d, frames[0].h - 1 - d
    xs, ys = [], []
    for c in frames:
        for y in range(max(0, lo_y), min(c.h, hi_y + 1)):
            row = c.px[y]
            for x in range(max(0, lo_x), min(c.w, hi_x + 1)):
                if row[x] is not None:
                    xs.append(x)
                    ys.append(y)
    old = (min(xs), min(ys), max(xs), max(ys))
    if old == new:
        return new
    e = max(old[0] - new[0], new[2] - old[2])
    return (old[0] - e, new[1], old[2] + e, max(old[3], new[3]))


def pair(fn):
    """Deux images (fn(0), fn(1)) recadrées sur la même boîte englobante."""
    a, b = fn(0), fn(1)
    a.outline(OUT)
    b.outline(OUT)
    box = group_box([a, b])
    return crop_to(a, box), crop_to(b, box)


def mask_of(draw):
    m = Canvas(160, 160)
    draw(m)
    return {(x - M, y - M) for y in range(m.h) for x in range(m.w) if m.px[y][x] is not None}


def shade_mask(c, mask, colors, light=LIGHT, bias=0.0, edge=True, contrast=0.34):
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


def sell(c, cx, cy, rx, ry, colors, light=LIGHT):
    """Ellipse ombrée, lumière venant d'en haut à gauche."""
    c.shaded_ellipse(cx, cy, rx, ry, colors, light=light)


def sline(c, x0, y0, x1, y1, colors, width=2, **kw):
    shade_mask(c, mask_of(lambda m: m.line(x0, y0, x1, y1, '#000000', width)), colors, **kw)


def fill(c, mask, col):
    for (x, y) in mask:
        c.setf(x, y, col)


def dome_mask(cx, top, bottom, rx, flare=0.8):
    """Goutte : dôme arrondi en haut, base aplatie un peu évasée."""
    h = bottom - top + 1
    ry = h * 0.62
    cy = top + ry
    mask = set()
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
                mask.add((x, y))
    return mask, cy, ry


def dome(c, cx, top, bottom, rx, colors, flare=0.8, light=LIGHT):
    mask, cy, ry = dome_mask(cx, top, bottom, rx, flare)
    n = len(colors)
    for (x, y) in mask:
        dx = (x + 0.5 - cx) / rx
        dy = (y + 0.5 - cy) / ry
        if dy > 0:
            dy *= 0.55
        d = min(1.0, dx * dx + dy * dy)
        nz = math.sqrt(1 - d)
        dot = (dx * light[0] + dy * light[1]) * 0.75 + nz * 0.55
        v = (dot + 0.25) / 1.25
        if y >= bottom - 1:
            v -= 0.18
        c.set(x, y, colors[max(0, min(n - 1, int(v * n)))])
    return mask


# ---------------------------------------------------------------- visages

def eye(c, x, y, w=2, h=3, iris=INK, glint=WHITE, low=None):
    """Gros œil brillant : bloc sombre, reflet blanc en haut à gauche."""
    for yy in range(h):
        for xx in range(w):
            c.set(x + xx, y + yy, iris)
    if w >= 3 and h >= 4:
        c.set(x, y + 1, glint); c.set(x + 1, y + 1, glint); c.set(x + 1, y, glint)
    else:
        c.set(x, y, glint)
    if low:
        c.set(x + w - 1, y + h - 1, low)


def sclera_eye(c, x, y, w=3, h=3, white=WHITE, pupil=INK, look=-1, lid=None):
    """Œil à sclère (gobelins, loups…) : blanc + pupille tournée vers la gauche."""
    c.rect(x, y, w, h, white)
    px = x if look < 0 else x + w - 1
    c.set(px, y + h - 1, pupil)
    c.set(px, y + h - 2 if h > 1 else y, pupil)
    if w >= 3:
        c.set(px + (1 if look < 0 else -1), y + h - 1, pupil)
    if lid:
        for xx in range(w):
            c.set(x + xx, y, lid)


def brow(c, x0, y0, x1, y1, col=INK):
    c.line(x0, y0, x1, y1, col)


def smile(c, x, y, w=3, col=INK):
    """Petit sourire : coins relevés."""
    c.set(x, y, col)
    for xx in range(1, w - 1):
        c.set(x + xx, y + 1, col)
    c.set(x + w - 1, y, col)


def frown(c, x, y, w=3, col=INK):
    c.set(x, y + 1, col)
    for xx in range(1, w - 1):
        c.set(x + xx, y, col)
    c.set(x + w - 1, y + 1, col)


def open_mouth(c, x, y, w=3, h=2, inner='#7a1a2a', tongue='#e0506a', teeth=True, col=INK):
    c.rect(x, y, w, h, col)
    if h >= 2 and w >= 2:
        for xx in range(1, w - 1):
            c.set(x + xx, y + h - 1, inner)
        if w >= 3:
            c.set(x + w // 2, y + h - 1, tongue)
    if teeth:
        c.set(x, y, WHITE)
        if w >= 4:
            c.set(x + w - 1, y, WHITE)


def blush(c, x, y, col='#ff7a9a'):
    c.setf(x, y, col)
    c.setf(x + 1, y, col)


# ---------------------------------------------------------------- palettes

G_SLIME = ['#13503a', '#1d873c', '#38b83a', '#7ade48', '#c6f68a']
B_SLIME = ['#1a2a78', '#2456c8', '#3a8eee', '#7cc6ff', '#d2f0ff']
I_SLIME = ['#2e4f9e', '#4a8ad8', '#7cc0f2', '#b6e6ff', '#f2fcff']
F_SLIME = ['#7a1408', '#d23a0e', '#ff7a14', '#ffbe32', '#fff09a']
GOLD_SLIME = ['#7a3e10', '#cc8418', '#f4c234', '#ffe680', '#fffbd8']
G_SKIN = ['#1e4a24', '#357a2c', '#56a83a', '#86cc4e', '#c2ec7e']
LEATHER = ['#3a1e14', '#6a3a1e', '#9a5a2a', '#c4823e', '#e8b070']
WOOD = ['#3e2214', '#6e3e1e', '#9e6230', '#c88e4a', '#ecc07a']
STEEL = ['#2a2e44', '#4e5672', '#7c88a4', '#b4c0d4', '#eef2f8']
DSTEEL = ['#1a1a2e', '#33344e', '#55587a', '#8086a6', '#c0c8de']
RUST = ramp('#a0562a', 5, 0.28, 0.05)
BONE = ['#4c4258', '#8e8478', '#c4b99e', '#e6dfc6', '#fcf9ec']
GOLD = ['#7a3e18', '#c0761e', '#eab53a', '#ffe27a', '#fffbd0']
RED_GEM = ['#5a0f2a', '#b0203a', '#ff4a5a', '#ffb0b0']
BLUE_GEM = ['#1a2a6a', '#2a62d0', '#5ab4ff', '#d8f4ff']
GREEN_GEM = ['#0f4a3a', '#1ea06a', '#5ee8a0', '#d8ffe8']
PURPLE_GLOW = ['#3a0a6a', '#7a2ad0', '#b85aff', '#e4b0ff', '#fff0ff']
LEAF = ['#123a20', '#1f6a2a', '#38a034', '#6ed04a', '#b4f080']
MOSS = ['#1e4a1e', '#3a7a26', '#5ea832', '#8ed04a']


def dk(R, d=-0.08):
    """Version assombrie d'une rampe (membres du plan arrière)."""
    return [shift(x, dl=d) for x in R]


def crown(c, x, y, w, h, gems=True, points=3):
    """Couronne d'or (x, y = coin haut gauche)."""
    base_y = y + h - 3
    c.rect(x, base_y, w, 3, GOLD[2])
    for xx in range(x, x + w):
        c.set(xx, base_y, GOLD[3])
        c.set(xx, base_y + 2, GOLD[1])
    for i in range(points):
        px = x + round(i * (w - 1) / (points - 1))
        for k in range(h - 3):
            yy = base_y - 1 - k
            half = max(0, (h - 4 - k) // 2) if i not in (0, points - 1) else 0
            for dx in range(-half, half + 1):
                c.set(px + dx, yy, GOLD[2] if dx <= 0 else GOLD[1])
        c.set(px, y, GOLD[4])
        c.set(px, y - 1, GOLD[3])
    c.set(x, base_y, GOLD[4])
    if gems:
        mid = x + w // 2
        c.set(mid, base_y + 1, RED_GEM[2])
        if w > 8:
            c.set(mid - 1, base_y + 1, RED_GEM[3])
            c.set(x + 2, base_y + 1, BLUE_GEM[2]); c.set(x + w - 3, base_y + 1, GREEN_GEM[2])


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


# ---------------------------------------------------------------- slimes

def slime_body(c, cx, top, bottom, rx, R, flare=0.8):
    mask = dome(c, cx, top, bottom, rx, R, flare)
    h = bottom - top + 1
    # lumière rebondie (translucide) en bas à droite
    for (x, y) in mask:
        if y == bottom - 2 and x > cx + 1 and (x + 1, y) in mask and (x + 2, y) not in mask:
            c.set(x, y, R[3])
            c.set(x, y - 1, R[2])
    # reflet spéculaire en haut à gauche
    hx, hy = cx - rx * 0.52, top + h * 0.2
    c.ellipse(hx + 0.6, hy + 0.9, max(1.3, rx * 0.2), max(1.0, h * 0.1), R[4], only_inside=True)
    c.set(hx - 0.4, hy + 1.2, WHITE); c.set(hx + 0.6, hy + 0.2, WHITE)
    if rx > 12:
        c.set(hx + 1.6, hy + 0.2, WHITE); c.set(hx - 0.4, hy + 2.2, WHITE)
        for a in range(150, 250, 5):
            t = math.radians(a)
            c.setf(cx + math.cos(t) * rx * 0.82, top + h * 0.62 + math.sin(t) * h * 0.52, R[4])
    c.setf(hx + 3, hy + 0.5, R[4])
    return mask


def slime_face(c, fx, ey, mood, R, ew=2, eh=4, gap=4, mouth_col=None):
    """Visage de slime ; fx = centre du visage, ey = haut des yeux."""
    mc = mouth_col or INK
    e1 = int(round(fx - gap / 2 - ew))
    e2 = int(round(fx + gap / 2))
    lo = mix(INK, R[2], 0.45)
    if mood == 'angry':
        eh2 = eh - 1
        eye(c, e1, ey + 1, ew, eh2, low=lo)
        eye(c, e2, ey + 1, ew, eh2, low=lo)
        brow(c, e1 - 1, ey - 1, e1 + ew - 1, ey, INK)
        brow(c, e2, ey, e2 + ew, ey - 1, INK)
        open_mouth(c, int(fx) - 1 - (ew > 2), ey + eh + 1, 3 + (ew > 2) * 2, 2)
    elif mood == 'sad':
        eye(c, e1, ey + 1, ew, eh - 1, low=lo)
        eye(c, e2, ey + 1, ew, eh - 1, low=lo)
        brow(c, e1 - 1, ey, e1 + ew - 1, ey - 1, R[0])
        brow(c, e2, ey - 1, e2 + ew, ey, R[0])
        frown(c, int(fx) - 1, ey + eh + 1, 3, mc)
    elif mood == 'calm':
        eye(c, e1, ey, ew, eh, low=lo)
        eye(c, e2, ey, ew, eh, low=lo)
        c.set(int(fx) - 1 + 1, ey + eh + 1, mc); c.set(int(fx) + 1, ey + eh + 1, mc)
        blush(c, e1 - 1, ey + eh); blush(c, e2 + ew - 1, ey + eh)
    elif mood == 'smug':
        for e in (e1, e2):
            c.rect(e, ey + 1, ew, eh - 1, INK)
            c.set(e, ey + 1, WHITE)
            for xx in range(ew):
                c.set(e + xx, ey + 1, R[0])
            c.set(e, ey + 2, WHITE)
        brow(c, e1 - 1, ey - 1, e1 + ew, ey, INK)
        brow(c, e2 - 1, ey, e2 + ew, ey - 1, INK)
        smile(c, int(fx) - 2, ey + eh + 1, 5, mc)
    else:  # happy
        eye(c, e1, ey, ew, eh, low=lo)
        eye(c, e2, ey, ew, eh, low=lo)
        smile(c, int(fx) - 1, ey + eh, 3 + (ew > 2) * 2, mc)
        blush(c, e1 - 2, ey + eh); blush(c, e2 + ew, ey + eh)
    return e1, e2


def slime_draw(R, mood, extra=None):
    def fn(f):
        c = Canvas(30, 26)
        top, rx = (2, 9.5) if f == 0 else (4, 10.5)
        bottom = 17
        slime_body(c, 11, top, bottom, rx, R)
        slime_face(c, 9 - f * 0.4, top + 5 + (f == 0), mood, R)
        if extra:
            extra(c, f, top)
        return c
    return pair(fn)


ICE = ['#2a4a9a', '#5a9ae0', '#a8dcff', '#e4f8ff', '#ffffff']


def ice_crystal(c, x, base, h, w, R=ICE):
    """Cristal de glace (pointe vers le haut)."""
    pts = [(x - w / 2, base), (x - w / 2 + 0.3, base - h * 0.55), (x, base - h), (x + w / 2, base - h * 0.5), (x + w / 2, base)]
    part(c, lambda t: spoly(t, pts, R, contrast=0.5))
    c.line(x - 0.2, base - h + 1, x - 0.2, base - 1, R[4])


def slime():
    return slime_draw(G_SLIME, 'happy')


def slime_blue():
    return slime_draw(B_SLIME, 'sad')


def slime_ice():
    def extra(c, f, top):
        ice_crystal(c, 11, top + 2, 7 + (f == 0), 4)
        ice_crystal(c, 7, top + 3, 5, 3)
        ice_crystal(c, 15, top + 3, 4 + (f == 0), 3)
        c.set(4, top + 3, ICE[4]); c.set(19, top + 1 - f, ICE[3])
    return slime_draw(I_SLIME, 'calm', extra)


def flame_shade(c, mask, F, cx, cy, rx, ry):
    n = len(F)
    for (x, y) in mask:
        d = math.sqrt(((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2)
        v = 1.05 - d * 0.85
        if (x - 1, y) not in mask or (x, y - 1) not in mask:
            v += 0.08
        if (x + 1, y) not in mask:
            v -= 0.15
        c.set(x, y, F[max(0, min(n - 1, int(v * n)))])


def slime_fire():
    def fn(f):
        c = Canvas(30, 30)
        cx, bottom = 11, 21
        body, _, _ = dome_mask(cx, 9 + f, bottom, 10 + f * 0.6)
        s = 1 if f else -1
        tongues = [
            [(1, 16), (0, 6 + f), (5, 11)],
            [(3, 13), (5 + s, 2 + f), (9, 9)],
            [(7, 10), (11 - s, -1 + f * 2), (15, 9)],
            [(13, 11), (17 + s, 3 + f), (19, 12)],
            [(18, 14), (22, 8 + f), (21, 17)],
        ]
        mask = set(body)
        for t in tongues:
            mask |= mask_of(lambda m: m.poly(t, '#000'))
        flame_shade(c, mask, F_SLIME, cx - 1, bottom - 5, 12, 12)
        # langues intérieures claires
        c.line(5 + s, 5 + f, 6, 10, F_SLIME[3]); c.line(11 - s, 2 + f * 2, 11, 7, F_SLIME[3])
        slime_face(c, 9, 12 + f, 'angry', F_SLIME, mouth_col=INK)
        # étincelles
        c.set(16, 0 + f, F_SLIME[3]); c.set(2 + f, 2, F_SLIME[2])
        return c
    return pair(fn)


def boss_slime_king():
    c = Canvas(60, 56)
    R = ['#124a36', '#1e823c', '#3cb03a', '#78d846', '#c0f282']
    slime_body(c, 26, 12, 49, 24.5, R, flare=1.6)
    # bulles internes / gemmes englouties
    for (x, y, r) in ((38, 36, 2), (42, 28, 1.4), (14, 41, 1.5), (33, 43, 1.1)):
        c.ellipse(x, y, r, r, R[3], only_inside=True)
        c.setf(x - 0.6, y - 0.6, R[4])
    c.setf(30, 44, BLUE_GEM[2]); c.setf(31, 44, BLUE_GEM[1]); c.setf(30, 43, BLUE_GEM[3])
    c.setf(44, 40, GOLD[3]); c.setf(45, 40, GOLD[2]); c.setf(44, 41, GOLD[1])
    # visage
    fx, ey = 22, 25
    for ex in (fx - 9, fx + 3):
        c.rect(ex, ey, 5, 6, INK)
        c.set(ex, ey, R[2]); c.set(ex + 4, ey, R[2])
        c.set(ex + 1, ey + 1, WHITE); c.set(ex + 2, ey + 1, WHITE); c.set(ex + 1, ey + 2, WHITE)
        c.set(ex + 3, ey + 4, '#3a6a8a'); c.set(ex + 3, ey + 5, '#3a6a8a')
    brow(c, fx - 11, ey - 3, fx - 4, ey - 1, INK); brow(c, fx - 11, ey - 2, fx - 5, ey - 1, INK)
    brow(c, fx + 2, ey - 1, fx + 9, ey - 3, INK); brow(c, fx + 3, ey - 1, fx + 9, ey - 2, INK)
    # sourire narquois avec crocs
    mx, my = fx - 4, ey + 8
    for x in range(mx, mx + 9):
        c.set(x, my + (1 if mx < x < mx + 8 else 0), INK)
    for x in range(mx + 2, mx + 7):
        c.set(x, my + 2, INK)
        c.set(x, my + 1, '#7a1a2a')
    c.set(mx + 3, my + 2, '#e0506a'); c.set(mx + 4, my + 2, '#e0506a')
    c.set(mx + 2, my + 1, WHITE); c.set(mx + 6, my + 1, WHITE)
    blush(c, fx - 12, ey + 7); blush(c, fx + 9, ey + 7)
    # couronne inclinée
    def cr(t):
        crown(t, 16, 0, 21, 12, points=5)
        t.set(26, 5, RED_GEM[3]); t.set(27, 5, RED_GEM[2]); t.set(26, 6, RED_GEM[2]); t.set(27, 6, RED_GEM[1])
    part(c, cr)
    # gouttes au sol
    c.set(53, 49, R[2]); c.set(52, 49, R[1]); c.set(53, 48, R[3])
    c.set(1, 49, R[2]); c.set(2, 49, R[1])
    return finish(c)


def pet_slime():
    c = Canvas(20, 18)
    R = GOLD_SLIME
    slime_body(c, 9, 2, 14, 7.5, R)
    slime_face(c, 11, 6, 'happy', R, ew=2, eh=3, gap=3)
    # étincelle
    c.set(15, 1, WHITE); c.set(16, 1, R[3]); c.set(14, 1, R[3]); c.set(15, 0, R[3]); c.set(15, 2, R[3])
    return finish(c)


# ---------------------------------------------------------------- champignons

def mushroom_draw(CAP, SPOTC, mood, skin=None):
    STEM = skin or ['#7a5a4a', '#c0987a', '#ecd2ae', '#fff2da']

    def fn(f):
        c = Canvas(26, 28)
        b = f  # f=1 : corps écrasé d'un pixel
        # pieds
        fa, fb = (5, 12) if f == 0 else (7, 10)
        sell(c, fb + 0.5, 21, 2.2, 1.4, dk(STEM, -0.12))
        # bras arrière
        sell(c, 14.5, 16 + b, 1.6, 1.8, dk(STEM, -0.1))
        # corps / visage
        sell(c, 9.5, 15.5 + b * 0.5, 5.4, 5.2, STEM)
        sell(c, fa + 0.5, 21, 2.2, 1.4, STEM)
        # chapeau
        mask = mask_of(lambda m: m.ellipse(10, 9.5 + b, 10, 8.5, '#000'))
        mask = {(x, y) for (x, y) in mask if y <= 10 + b}

        def capf(t):
            shade_mask(t, mask, CAP, contrast=0.42)
            for (x, y) in mask:
                if y == 10 + b:
                    t.set(x, y, CAP[1] if x < 10 else CAP[0])
            for (x, y, r) in ((5, 5, 1.9), (11, 3, 1.5), (15.5, 6.5, 1.8), (9.5, 7.5, 1.1), (2, 9, 0.9), (18, 9.5, 0.8)):
                t.ellipse(x, y + b, r, r * 0.9, SPOTC[1], only_inside=True)
                t.setf(x - 0.5, y - 0.5 + b, SPOTC[2])
                t.setf(x + 0.6, y + 0.7 + b, SPOTC[0])
            t.set(4, 3 + b, CAP[4]); t.set(3, 4 + b, CAP[4])
        part(c, capf)
        # lamelles
        for x in range(5, 15):
            c.setf(x, 11 + b, STEM[0] if x % 2 else STEM[1])
        # visage tourné à gauche
        ey = 13 + b
        if mood == 'angry':
            eye(c, 5, ey, 2, 3); eye(c, 10, ey, 2, 3)
            brow(c, 4, ey - 1, 6, ey, INK); brow(c, 10, ey, 12, ey - 1, INK)
            c.set(5, ey, STEM[2]); c.set(11, ey, STEM[2])
            open_mouth(c, 7, ey + 4, 3, 2)
        else:
            eye(c, 5, ey, 2, 3); eye(c, 10, ey, 2, 3)
            brow(c, 4, ey - 1, 6, ey - 1, STEM[0]); brow(c, 10, ey - 1, 12, ey - 2, STEM[0])
            frown(c, 7, ey + 4, 3)
        blush(c, 3, ey + 3); blush(c, 12, ey + 3)
        # bras avant
        sell(c, 4, 17 + b, 1.6, 1.8, STEM)
        return c
    return pair(fn)


def mushroom():
    return mushroom_draw(['#5a0e26', '#a41c30', '#e23a36', '#ff7a5a', '#ffb88e'],
                         ['#c8b4b0', '#fbf2ea', '#ffffff'], 'angry')


def mushroom_green():
    return mushroom_draw(['#163a1a', '#2a6a26', '#4c9a32', '#80c84a', '#c0ec84'],
                         ['#a8b07a', '#eef0b0', '#fffff0'], 'grumpy')


# ---------------------------------------------------------------- gobelins

GOB_EYE = '#ffe45a'


def goblin_legs(c, f, oy, PANTS, BOOT):
    fx, bx = (5, 11) if f == 0 else (7, 9)
    spoly(c, [(bx, 20 + oy), (bx + 3, 20 + oy), (bx + 3, 24), (bx, 24)], dk(PANTS, -0.1))
    sell(c, bx + 1.8, 24.6, 2.4, 1.3, dk(BOOT, -0.1))
    spoly(c, [(fx, 20 + oy), (fx + 3, 20 + oy), (fx + 3, 24), (fx, 24)], PANTS)
    sell(c, fx + 1.2, 24.6, 2.5, 1.3, BOOT)


def goblin_head(c, oy, SKIN, hood=False, helmet=False, mood='angry'):
    # oreille arrière
    if not helmet:
        spoly(c, [(13, 7 + oy), (20, 2 + oy), (18, 7 + oy), (14, 11 + oy)], dk(SKIN, -0.06))
        c.line(15, 7 + oy, 18, 4 + oy, SKIN[0])
    sell(c, 9, 9 + oy, 6.6, 5.8, SKIN)
    # mâchoire un peu proéminente
    sell(c, 7, 12 + oy, 4.6, 2.6, SKIN)
    if not hood:
        spoly(c, [(4, 8 + oy), (-2, 4 + oy), (0, 8 + oy), (4, 11 + oy)], SKIN)  # oreille avant
        c.line(0, 6 + oy, 3, 8 + oy, SKIN[1])
        c.set(-1, 5 + oy, SKIN[4])
    # yeux (sclère jaune, pupille à gauche)
    ey = 8 + oy
    for ex in (3, 8):
        c.rect(ex, ey, 3, 3, GOB_EYE)
        c.set(ex + 2, ey + 2, '#c89a2a')
        c.set(ex, ey + 1, INK); c.set(ex, ey + 2, INK); c.set(ex + 1, ey + 1, INK); c.set(ex + 1, ey + 2, INK)
        c.set(ex, ey + 1, '#ffffff')
    if mood == 'angry':
        brow(c, 2, ey - 2, 5, ey - 1, SKIN[0]); brow(c, 2, ey - 1, 5, ey, SKIN[0])
        brow(c, 8, ey, 11, ey - 2, SKIN[0]); brow(c, 8, ey - 1, 10, ey - 2, SKIN[0])
    # nez pointu
    spoly(c, [(3, 11 + oy), (-0.5, 12 + oy), (3, 13 + oy)], SKIN, bias=0.1)
    c.set(3, 12 + oy, SKIN[1])
    # bouche + crocs
    for x in range(3, 10):
        c.set(x, 14 + oy if x not in (3, 9) else 13 + oy, INK)
    c.set(4, 13 + oy, WHITE); c.set(8, 13 + oy, WHITE)
    c.set(5, 15 + oy, SKIN[1]); c.set(6, 15 + oy, SKIN[1])


def goblin_torso(c, oy, TUNIC, SKIN):
    sell(c, 15, 16.5 + oy, 1.8, 2.2, dk(SKIN, -0.1))  # bras arrière
    spoly(c, [(6, 15 + oy), (13, 15 + oy), (15, 21 + oy), (4, 21 + oy)], TUNIC)
    for x in range(4, 16):
        c.setf(x, 19 + oy, LEATHER[0])
    c.setf(8, 19 + oy, GOLD[3]); c.setf(9, 19 + oy, GOLD[1])
    for x in range(5, 15, 3):
        c.setf(x, 21 + oy, TUNIC[0])


GOB_TUNIC = ['#3a1e14', '#6a3a1e', '#9a5a2a', '#c4823e', '#e8b070']
GOB_PANTS = ['#1e1a22', '#3a3240', '#5a4c58', '#7a6a72', '#a0909a']


def goblin():
    def fn(f):
        c = Canvas(30, 32)
        oy = -f
        goblin_legs(c, f, oy, GOB_PANTS, LEATHER)
        goblin_torso(c, oy, GOB_TUNIC, G_SKIN)
        goblin_head(c, oy, G_SKIN)
        # gourdin tenu devant, pointé vers le haut
        def club(t):
            sline(t, 2, 20 + oy, -2, 9 + oy, WOOD, 2)
            sell(t, -2.5, 7.5 + oy, 2.4, 3.6, WOOD)
            t.set(-4, 6 + oy, STEEL[4]); t.set(-1, 5 + oy, STEEL[4]); t.set(-1, 9 + oy, STEEL[3])
        part(c, club)
        sell(c, 2.5, 18.5 + oy, 2, 1.8, G_SKIN)  # poing
        return c
    return pair(fn)


def goblin_shaman():
    HOOD = ['#3a0a14', '#7a1420', '#b8262a', '#e8503a', '#ff8a5a']
    def fn(f):
        c = Canvas(30, 34)
        oy = -f
        goblin_legs(c, f, oy, GOB_PANTS, LEATHER)
        # robe
        spoly(c, [(6, 14 + oy), (13, 14 + oy), (16, 23 + oy), (3, 23 + oy)], HOOD)
        for x in range(3, 17):
            c.setf(x, 22 + oy, HOOD[0] if x % 3 else HOOD[1])
        c.setf(9, 18 + oy, BONE[3]); c.setf(10, 18 + oy, BONE[2])
        goblin_head(c, oy, G_SKIN, hood=True)
        # capuche : dôme rouge avec ouverture pour le visage + pointe en arrière
        hm = mask_of(lambda m: m.ellipse(9.5, 9 + oy, 7.8, 7.4, '#000'))
        hm |= mask_of(lambda m: m.poly([(12, 3 + oy), (19, 7 + oy), (16, 11 + oy)], '#000'))
        face = mask_of(lambda m: m.ellipse(6.5, 11 + oy, 5.4, 4.6, '#000'))
        hm = {(x, y) for (x, y) in hm if (x, y) not in face and y <= 15 + oy}
        part(c, lambda t: shade_mask(t, hm, HOOD, contrast=0.4))
        for (x, y) in face:
            if (x, y - 1) in hm and c.get(x, y) is not None:
                c.set(x, y, mix(c.get(x, y), INK, 0.45))
        # bâton à crâne
        def staff(t):
            sline(t, 0, 4 + oy, 1, 25, WOOD, 2)
            sell(t, -0.5, 1 + oy, 3.2, 3, BONE)
            t.rect(-2, 1 + oy, 2, 2, INK); t.set(1, 1 + oy, INK); t.set(-1, 2 + oy, '#ff5a3a')
            t.set(-1, 4 + oy, INK); t.set(1, 4 + oy, INK)
            spoly(t, [(1.5, -1 + oy), (4.5, -4 + oy), (3, 0.5 + oy)], BONE)
            spoly(t, [(-2.5, -1 + oy), (-4, -4.5 + oy), (-1, -1.5 + oy)], BONE)
            t.set(4, 6 + oy, '#6ae86a'); t.set(-4, 7 - f + oy, '#b0ff8a')
        part(c, staff)
        sell(c, 1.5, 15.5 + oy, 2, 1.8, G_SKIN)
        return c
    return pair(fn)


def goblin_armored():
    def fn(f):
        c = Canvas(32, 34)
        oy = -f
        goblin_legs(c, f, oy, dk(STEEL, -0.05), LEATHER)
        # gourdin levé (bras arrière)
        def club(t):
            sline(t, 15, 16 + oy, 19, 4 + oy, WOOD, 2)
            sell(t, 19.5, 2.5 + oy, 2.5, 3.5, WOOD)
            t.set(18, 1 + oy, WOOD[4]); t.set(21, 4 + oy, WOOD[0])
        club(c)
        sell(c, 15.5, 16 + oy, 2, 2, G_SKIN)
        # torse en cotte de mailles
        spoly(c, [(6, 15 + oy), (13, 15 + oy), (15, 21 + oy), (4, 21 + oy)], STEEL)
        for y in range(16, 21):
            for x in range(4 + (y % 2), 16, 2):
                c.setf(x, y + oy, STEEL[1])
        goblin_head(c, oy, G_SKIN, helmet=True)
        # casque
        hm = mask_of(lambda m: m.ellipse(9.5, 7.5 + oy, 7.6, 6.2, '#000'))
        hm = {(x, y) for (x, y) in hm if y <= 7 + oy}
        hm |= mask_of(lambda m: m.rect(1, 7 + oy, 16, 2, '#000'))
        def helm(t):
            shade_mask(t, hm, STEEL, contrast=0.45)
            for x in range(1, 18):
                t.set(x, 8 + oy, STEEL[1])
                t.set(x, 7 + oy, STEEL[3] if x < 9 else STEEL[2])
            for x in (4, 9, 14):
                t.set(x, 7 + oy, STEEL[4])
            # nasal
            t.rect(5, 8 + oy, 1, 4, STEEL[2]); t.set(5, 11 + oy, STEEL[1])
            # cornes courtes
            spoly(t, [(13, 2 + oy), (18, -2 + oy), (16, 4 + oy)], BONE)
        part(c, helm)
        # bouclier rond (devant)
        def shield(t):
            sell(t, 3, 19 + oy, 5.2, 5.2, WOOD)
            for a in range(0, 360, 8):
                r = math.radians(a)
                t.set(3 + math.cos(r) * 4.6, 19 + oy + math.sin(r) * 4.6, STEEL[3] if 120 < a < 300 else STEEL[1])
            t.line(3, 15 + oy, 3, 23 + oy, WOOD[1])
            sell(t, 2.5, 18.5 + oy, 1.8, 1.8, STEEL)
            t.set(2, 18 + oy, WHITE)
        part(c, shield)
        return c
    return pair(fn)


# ---------------------------------------------------------------- sanglier

BOAR = ['#2a160e', '#55301c', '#86522e', '#b07a46', '#d8a870']
BOAR_MANE = ['#24140c', '#432818', '#684026', '#90643a']
SNOUT = ['#5a2e28', '#a05a4a', '#d0886e', '#f2b49a']


def boar():
    def fn(f):
        c = Canvas(34, 24)
        legs = (9, 12, 21, 24)
        sw = (-1, 1, 1, -1) if f == 0 else (1, -1, -1, 1)
        oy = -f * 0.5
        for i in (1, 2):
            x = legs[i]
            spoly(c, [(x, 13), (x + 3, 13), (x + 2.6 + sw[i], 19), (x + 0.4 + sw[i], 19)], dk(BOAR, -0.12))
            c.rect(int(x + 0.4 + sw[i]), 19, 3, 1, BOAR_MANE[0])
        c.line(28, 7, 30, 5, BOAR[1]); c.set(31, 6, BOAR[1]); c.set(30, 4, BOAR[2])
        # corps
        sell(c, 18, 10.5 + oy, 11, 6.4, BOAR)
        # crête de soies (dents de scie)
        pts = [(7, 9 + oy)]
        for i, x in enumerate(range(8, 27, 2)):
            base = 5.6 + abs(x - 13) * 0.16 + oy
            pts.append((x, base - (2.6 if i % 2 == 0 else 0.4) * (1.2 - abs(x - 13) / 30)))
        pts += [(27, 8 + oy), (24, 8.6 + oy), (12, 9 + oy)]
        spoly(c, pts, BOAR_MANE, contrast=0.5)
        for x in range(10, 24, 4):
            c.setf(x, 6 + oy + abs(x - 13) * 0.16, BOAR_MANE[3])
        for i in (0, 3):
            x = legs[i]
            spoly(c, [(x, 13), (x + 3, 13), (x + 2.6 + sw[i], 19), (x + 0.4 + sw[i], 19)], BOAR)
            c.rect(int(x + 0.4 + sw[i]), 19, 3, 1, BOAR_MANE[0])
            c.set(int(x + 1.4 + sw[i]), 19, BOAR_MANE[2])
        # tête
        def head(t):
            sell(t, 8, 11 + oy, 6.4, 5.6, BOAR)
            spoly(t, [(8, 7 + oy), (11.5, 1.5 + oy), (13.5, 8 + oy)], BOAR)
            t.set(11, 5 + oy, SNOUT[1]); t.set(11, 6 + oy, SNOUT[0]); t.set(12, 6 + oy, SNOUT[1])
            sell(t, 2, 12.5 + oy, 3, 2.7, SNOUT)
            t.set(0, 12 + oy, SNOUT[0]); t.set(2, 12 + oy, SNOUT[0])
            # œil furieux
            ey = round(9 + oy)
            t.rect(5, ey, 3, 2, WHITE); t.set(5, ey + 1, INK); t.set(6, ey + 1, INK); t.set(5, ey, '#ff6a4a')
            t.line(4, ey - 2, 8, ey - 1, BOAR_MANE[0]); t.line(4, ey - 1, 7, ey - 1, BOAR_MANE[0])
            # bouche + défense
            t.line(3, 15 + oy, 8, 15 + oy, BOAR_MANE[0])
            for (x, y, col) in ((5, 15, BONE[1]), (4, 15, BONE[2]), (3, 14, BONE[3]), (2, 13, BONE[4]), (2, 12, BONE[4]), (4, 14, BONE[2])):
                t.set(x, y + oy, col)
            for x, y in ((11, 9), (10, 13)):
                t.setf(x, y + oy, BOAR[4])
        part(c, head)
        for x, y in ((16, 9), (21, 10), (25, 11)):
            c.setf(x, y + oy, BOAR[4])
        return c
    return pair(fn)


# ---------------------------------------------------------------- loups

def wolf_draw(s, f, FUR, BELLY, eye_col, dark_mane=None, scars=False):
    """Loup qui gronde, tourné à gauche ; s = échelle (1 ≈ 32×22)."""
    W, H = int(34 * s) + 4, int(24 * s) + 4

    def P(pts):
        return [(x * s, y * s) for x, y in pts]

    def E(cx, cy, rx, ry, R):
        sell(c, cx * s, cy * s, rx * s, ry * s, R)

    c = Canvas(W, H)
    far = dk(FUR, -0.1)
    mane = dark_mane or FUR
    sw = (-1.5, 1.5, 1.5, -1.5) if f == 0 else (1.2, -1.2, -1.2, 1.2)
    oy = 0 if f == 0 else -0.5
    # queue touffue
    spoly(c, P([(24, 9 + oy), (28, 5), (31.5, 3), (32, 6), (29, 10), (25.5, 12)]), FUR)
    c.line(28.5 * s, 5 * s, 31 * s, 3.8 * s, BELLY[-1])

    def leg(xt, dx, R, hind=False):
        xb = xt + dx
        spoly(c, P([(xt, 11 + oy), (xt + 3.4, 11 + oy), (xb + 2.8, 19), (xb + 0.6, 19)]), R)
        E(xb + 1.6, 19.6, 1.9, 1.0, R)
    leg(10.5, sw[1], far)
    leg(21, sw[2], far, True)
    # corps
    E(18, 10 + oy, 9, 5.2, FUR)
    for (x, y) in mask_of(lambda m: m.ellipse(17 * s, (13.2 + oy) * s, 7 * s, 2.2 * s, '#000')):
        c.setf(x, y, BELLY[1])
    E(23.5, 11 + oy, 3.8, 4, FUR)  # cuisse
    leg(8, sw[0], FUR)
    leg(23, sw[3], FUR, True)
    # poitrail
    E(11, 9.5 + oy, 4.8, 4.8, FUR)
    for (x, y) in mask_of(lambda m: m.ellipse(9.6 * s, (11.6 + oy) * s, 2.8 * s, 3 * s, '#000')):
        c.setf(x, y, BELLY[2])
    # crinière hérissée
    spoly(c, P([(9, 4 + oy), (12, 2 + oy), (13, 4.4 + oy), (15.4, 2.6 + oy), (16.4, 5.2 + oy), (19.6, 4.2 + oy),
                (18.6, 7 + oy), (11, 8 + oy)]), mane)
    def sellc(t, cx, cy, rx, ry, R):
        sell(t, cx * s, cy * s, rx * s, ry * s, R)

    def head(c):
        sellc(c, 8, 7.5 + oy, 4.6, 4, FUR)
        spoly(c, P([(8.5, 4.5 + oy), (10.5, -0.5 + oy), (12.4, 5.2 + oy)]), FUR)  # oreille
        c.line(10.4 * s, 1.8 * s, 10.6 * s, 3.8 * s, BELLY[0])
        spoly(c, P([(6, 4.6 + oy), (7, 0.5 + oy), (8.8, 4 + oy)]), far)
        # mâchoire supérieure (museau retroussé)
        spoly(c, P([(0, 7.6 + oy), (5, 5.6 + oy), (7.5, 8 + oy), (6.5, 10 + oy), (0.6, 9.8 + oy)]), FUR)
        # gueule ouverte
        spoly(c, P([(0.8, 9.8 + oy), (6.6, 9.6 + oy), (6.4, 12 + oy), (2.4, 12.4 + oy)]), ['#3a0a14', '#7a1428', '#b0283a'], edge=False)
        # mâchoire inférieure
        spoly(c, P([(2, 12.4 + oy), (6.8, 11.4 + oy), (7.4, 13.4 + oy), (3, 13.8 + oy)]), FUR)
        for (x, y) in mask_of(lambda m: m.poly(P([(2.6, 12.8 + oy), (7, 12.4 + oy), (7.2, 13.6 + oy), (3, 13.8 + oy)]), '#000')):
            c.setf(x, y, BELLY[1])
        # crocs
        for x in (1.2, 4.6):
            c.set(x * s, 10 * s + oy * s, WHITE)
            if s > 1.2:
                c.set(x * s, 10 * s + oy * s + 1, WHITE)
        c.set(3.4 * s, 12 * s + oy * s, WHITE)
        c.set(5.8 * s, 11.6 * s + oy * s, WHITE)
        # truffe
        c.set(0, 7.6 * s + oy * s, INK); c.set(1, 7.6 * s + oy * s, INK)
        if s > 1.2:
            c.set(0, 8.6 * s + oy * s, INK); c.set(1, 6.8 * s + oy * s, '#6a6a8a')
        # rides du museau
        c.line(3 * s, 7.2 * s + oy * s, 4.6 * s, 6.6 * s + oy * s, FUR[1])
        # œil furieux
        ex, ey = round(6 * s), round((6.4 + oy) * s)
        c.rect(ex - 1, ey, 3, 2, eye_col[2])
        c.set(ex - 1, ey, eye_col[3]); c.set(ex - 1, ey + 1, INK); c.set(ex, ey + 1, INK); c.set(ex + 1, ey + 1, eye_col[0])
        c.line(ex - 2, ey - 2, ex + 2, ey - 1, INK)
        if s > 1.2:
            c.rect(ex - 2, ey, 5, 3, eye_col[2])
            c.set(ex - 2, ey, eye_col[3]); c.set(ex - 1, ey, eye_col[3])
            c.rect(ex - 1, ey + 1, 2, 2, INK); c.set(ex + 2, ey + 2, eye_col[0]); c.set(ex + 1, ey + 2, eye_col[1])
            c.line(ex - 3, ey - 2, ex + 3, ey - 1, INK); c.line(ex - 3, ey - 1, ex + 3, ey, INK)
    part(c, head)
    if scars:
        for i in range(3):
            c.line((15 + i * 1.6) * s, 8 * s, (16.4 + i * 1.6) * s, 11 * s, '#b04a5a')
        c.line(7 * s, 4.6 * s, 9 * s, 8.4 * s, '#c86a7a')
    return c


WOLF_FUR = ['#2a2c44', '#4a4e68', '#727a90', '#a2a8b8', '#d2d6de']
WOLF_BELLY = ['#6a6e84', '#b8bac6', '#dcdee6', '#f6f6fa']


def wolf():
    eye_c = ['#7a2a10', '#e8a020', '#ffe070', '#fff8d0']
    return pair(lambda f: wolf_draw(1, f, WOLF_FUR, WOLF_BELLY, eye_c, dark_mane=dk(WOLF_FUR, -0.08)))


def wolf_ice():
    FUR = ['#3c5a94', '#6a94c8', '#a6cbea', '#dceefa', '#ffffff']
    BELLY = ['#7aa4d4', '#d4ecfa', '#eef8ff', '#ffffff']
    eye_c = ['#1a3aa0', '#3ab8ff', '#a8f0ff', '#ffffff']

    def fn(f):
        c = wolf_draw(1, f, FUR, BELLY, eye_c, dark_mane=['#3c5a94', '#5a86c4', '#8ab8e8', '#c4e4fa', '#f0faff'])
        oy = -f
        for x, y in ((12, 1), (15, 2), (18, 3)):
            c.set(x, y + oy, '#e8fcff'); c.set(x, y + 1 + oy, '#6ad0ff'); c.set(x + 1, y + 1 + oy, '#3a8ae0')
        return c
    return pair(fn)


def boss_alpha_wolf():
    FUR = ['#140f22', '#2a2440', '#463e5e', '#6a6282', '#948ca8']
    BELLY = ['#3a3448', '#6a6278', '#8e869c', '#b4acc2']
    eye_c = ['#8a0a0a', '#ff3a1e', '#ffb04a', '#ffffff']
    c = wolf_draw(1.75, 0, FUR, BELLY, eye_c, dark_mane=['#0c0818', '#1c1428', '#30243e', '#4a3c5a', '#6a5a7a'], scars=True)
    return finish(c)


# ---------------------------------------------------------------- mandragore

ROOT = ['#4a200e', '#86441c', '#c07632', '#e8a658', '#ffd696']


def mandrake():
    def fn(f):
        c = Canvas(20, 24)
        oy = -f
        # feuilles
        lift = 1 if f else 0
        def leaves(t):
            t.line(8, 9 + oy, 8, 5 + oy, LEAF[2])
            spoly(t, [(8, 7 + oy), (5, 6.5 + oy - lift), (1, 3 + oy - lift), (3, 1 + oy - lift), (7, 3 + oy)], LEAF, contrast=0.45)
            spoly(t, [(8.5, 7 + oy), (10, 3 + oy), (13.5, 0 + oy + lift), (16, 2.5 + oy + lift), (12, 6.5 + oy)], dk(LEAF, -0.04), contrast=0.45)
            t.line(7, 5 + oy, 3, 2 + oy - lift, LEAF[1])
            t.line(9.5, 5.5 + oy, 14, 1.5 + oy + lift, LEAF[1])
            t.set(3, 2 + oy - lift, LEAF[4]); t.set(4, 2 + oy - lift, LEAF[4])
        leaves(c)
        # pieds racines
        la, lb = (5, 10) if f == 0 else (6.5, 9)
        sell(c, lb, 18.6, 1.6, 1.4, dk(ROOT, -0.1))
        sell(c, 13.5, 13.5 + oy, 1.5, 1.5, dk(ROOT, -0.1))
        # corps (racine dodue)
        sell(c, 8.5, 13.5 + oy * 0.5, 5.6, 5.2, ROOT)
        spoly(c, [(7, 8.6 + oy), (10, 8.6 + oy), (9, 10 + oy)], ROOT)
        sell(c, la, 18.6, 1.6, 1.4, ROOT)
        # stries
        c.setf(12, 12 + oy, ROOT[1]); c.setf(12, 15, ROOT[1]); c.setf(11, 17, ROOT[1])
        # visage
        ey = 12 + oy
        eye(c, 4, ey, 2, 3); eye(c, 8, ey, 2, 3)
        if f:
            smile(c, 5, ey + 3, 3)
        else:
            c.set(6, ey + 4, INK); c.set(5, ey + 4, INK)
        blush(c, 2, ey + 3); blush(c, 10, ey + 3)
        sell(c, 2.5, 14.5 + oy, 1.5, 1.5, ROOT)  # bras
        return c
    return pair(fn)


# ---------------------------------------------------------------- œil-chauve-souris

EB_BODY = ['#22103a', '#45206a', '#6e36a0', '#9e62d0', '#cfa0f2']
EB_WING = ['#1a0c2c', '#3c1c5c', '#62328e', '#8a56be', '#b488e6']


def bat():
    def fn(f):
        c = Canvas(36, 30)
        cx, cy = 15, 11 + f
        bone = [EB_WING[0], EB_WING[3], EB_WING[4]]
        if f == 0:
            sh, wr, tips, bp = (5, -1), (10, -7), [(14, -10), (17, -7), (17, -1)], (6, 3)
        else:
            sh, wr, tips, bp = (5, 0), (10, 3), [(15, 2), (17, 7), (13, 10)], (5, 5)
        def R(p):
            return (cx + p[0], cy + p[1])
        def L(p):
            return (cx - p[0], cy + p[1])
        membrane_wing(c, R(sh), R(wr), [R(t) for t in tips], R(bp), dk(EB_WING, -0.06), bone)
        membrane_wing(c, L(sh), L(wr), [L(t) for t in tips], L(bp), EB_WING, bone)
        c.line(cx - 2, cy + 7, cx - 3, cy + 9, EB_BODY[1]); c.line(cx + 2, cy + 7, cx + 3, cy + 9, EB_BODY[1])
        sell(c, cx, cy, 7.4, 7.2, EB_BODY)
        spoly(c, [(cx - 6, cy - 4), (cx - 5.5, cy - 10), (cx - 2, cy - 6)], EB_BODY)
        spoly(c, [(cx + 2, cy - 6), (cx + 5.5, cy - 10), (cx + 6, cy - 4)], EB_BODY)
        # grand œil
        ex, ey = cx - 1, cy - 0.5
        sell(c, ex, ey, 5.2, 5, ['#7a6aa0', '#c8c0dc', '#f4f0fc', '#ffffff'])
        sell(c, ex - 0.8, ey + 0.2, 3.3, 3.4, ['#4a0868', '#8a1eb0', '#c84ae8', '#f09aff'])
        c.rect(int(ex - 2.5), int(ey - 0.5), 2, 3, INK)
        c.set(int(ex - 1.5), int(ey - 0.5), INK)
        c.set(int(ex - 2.5), int(ey - 1.5), WHITE); c.set(int(ex - 1.5), int(ey - 1.5), WHITE); c.set(int(ex - 3.5), int(ey - 0.5), WHITE)
        c.set(int(ex), int(ey + 2.5), '#f09aff')
        # paupière froncée
        c.line(ex - 5, ey - 4.5, ex + 4, ey - 3.5, EB_BODY[0])
        c.line(ex - 5, ey - 5.5, ex + 1, ey - 5, EB_BODY[4])
        # bouche à crocs
        c.line(cx - 3, cy + 6, cx + 2, cy + 6, INK)
        c.set(cx - 2, cy + 7, WHITE); c.set(cx + 1, cy + 7, WHITE)
        return c
    return pair(fn)


# ---------------------------------------------------------------- squelettes

def bone_line(c, x0, y0, x1, y1, w=2, R=None):
    sline(c, x0, y0, x1, y1, (R or BONE)[1:], w)


def skull(c, cx, cy, s=1.0, eye_col='#ff5a3a', crack=False):
    """Crâne chibi tourné à gauche (cx, cy = centre du crâne)."""
    sell(c, cx, cy, 6.2 * s, 5.6 * s, BONE)
    spoly(c, [(cx - 5 * s, cy + 2 * s), (cx + 2.5 * s, cy + 2 * s), (cx + 2.5 * s, cy + 6 * s), (cx - 4 * s, cy + 6 * s)],
          BONE[1:], bias=0.12)
    for ex in (cx - 3.2 * s, cx + 1.6 * s):
        c.ellipse(ex, cy + 0.8 * s, 1.7 * s, 2 * s, INK)
        c.set(ex - 0.6 * s, cy + 0.4 * s, eye_col)
        if s > 1.2:
            c.set(ex - 0.6 * s + 1, cy + 0.4 * s, eye_col); c.set(ex - 0.6 * s, cy + 0.4 * s + 1, mix(eye_col, INK, 0.5))
    c.set(cx - 1, cy + 3 * s, INK); c.set(cx - 1, cy + 3 * s - 1, BONE[1])
    ty = cy + 5 * s
    c.line(cx - 4 * s, ty - 1, cx + 2 * s, ty - 1, BONE[1])
    for x in range(int(cx - 4 * s), int(cx + 2.5 * s), 2):
        c.set(x, ty, INK)
    c.set(cx - 4 * s, cy - 3.5 * s, BONE[4]); c.set(cx - 3 * s, cy - 4.2 * s, BONE[4])
    if crack:
        c.line(cx + 1, cy - 5 * s, cx + 2, cy - 2.8 * s, BONE[0]); c.set(cx + 3, cy - 2.4 * s, BONE[0])


def skeleton_base(c, f, oy, back_arm=True):
    fx, bx = (4, 12) if f == 0 else (6.5, 9.5)
    bone_line(c, 10, 19 + oy, bx, 26)
    sell(c, bx - 0.5, 26.5, 2.2, 1.1, dk(BONE, -0.08))
    bone_line(c, 7, 19 + oy, fx, 26)
    sell(c, fx - 0.5, 26.5, 2.2, 1.1, BONE)
    sell(c, 8.5, 19 + oy, 3.6, 1.6, BONE)
    if back_arm:
        bone_line(c, 12, 13 + oy, 13, 18 + oy)
    # cage thoracique
    sell(c, 8.5, 14.5 + oy, 3.8, 3, BONE)
    for y in (14, 16):
        c.line(5.6, y + oy, 11, y + oy, BONE[0])
    for y in range(12, 19):
        c.set(9, y + oy, BONE[3] if y % 2 else BONE[2])


def skeleton():
    def fn(f):
        c = Canvas(26, 32)
        oy = -f
        skeleton_base(c, f, oy)
        skull(c, 8, 6.5 + oy)
        # épée rouillée tenue devant
        def sword(t):
            sline(t, 1, 15 + oy, 0, 3 + oy, STEEL, 2)
            t.line(-0.4, 4 + oy, -0.4, 14 + oy, STEEL[4])
            t.set(0, 2 + oy, STEEL[4])
            for x, y in ((1, 7), (0, 10), (1, 12)):
                t.set(x, y + oy, RUST[2])
            t.rect(-2, 15 + oy, 6, 1, GOLD[1]); t.set(-2, 15 + oy, GOLD[3])
            t.rect(0, 16 + oy, 2, 2, LEATHER[2])
        part(c, sword)
        bone_line(c, 6, 13 + oy, 2, 16 + oy)
        sell(c, 1.5, 16.5 + oy, 1.5, 1.4, BONE)
        return c
    return pair(fn)


def skeleton_shield():
    def fn(f):
        c = Canvas(28, 34)
        oy = -f
        # épée levée derrière (bras arrière)
        def sword(t):
            sline(t, 14, 17 + oy, 18, 4 + oy, STEEL, 2)
            t.set(19, 3 + oy, STEEL[4])
            t.line(12, 16 + oy, 16, 18 + oy, GOLD[1])
        sword(c)
        skeleton_base(c, f, oy, back_arm=False)
        bone_line(c, 12, 13 + oy, 14, 17 + oy)
        skull(c, 8, 6.5 + oy, crack=True)
        # bouclier rond cloûté
        def shield(t):
            sell(t, 3, 17 + oy, 5, 5.4, ['#2a1a1e', '#4e3226', '#76502e', '#9a7040', '#c09a5a'])
            for a in range(0, 360, 7):
                r = math.radians(a)
                t.set(3 + math.cos(r) * 4.6, 17 + oy + math.sin(r) * 5, STEEL[3] if 110 < a < 290 else STEEL[1])
            sell(t, 2.5, 16.5 + oy, 1.8, 1.8, STEEL)
            t.set(2, 16 + oy, WHITE)
            t.line(3, 13 + oy, 3, 14 + oy, STEEL[1]); t.line(3, 19 + oy, 3, 20 + oy, STEEL[1])
        part(c, shield)
        return c
    return pair(fn)


def skeleton_archer():
    def fn(f):
        c = Canvas(28, 34)
        oy = -f
        # carquois dans le dos
        def quiver(t):
            spoly(t, [(11, 9 + oy), (14, 8 + oy), (16, 16 + oy), (13, 17 + oy)], LEATHER)
            for x, y, col in ((12, 6, '#e05a4a'), (13, 5, WHITE), (14, 6, '#e05a4a')):
                t.line(x, y + oy, x, 8 + oy, WOOD[3]); t.set(x, y + oy, col)
        quiver(c)
        skeleton_base(c, f, oy)
        skull(c, 8, 6.5 + oy)
        # arc
        def bow(t):
            pts = []
            for i in range(17):
                k = i / 16
                pts.append((1.5 - 3.2 * math.sin(k * math.pi), 6 + oy + k * 17))
            for a, b2 in zip(pts, pts[1:]):
                t.line(a[0], a[1], b2[0], b2[1], WOOD[2], 2)
                t.set(a[0] - 0.5, a[1], WOOD[3])
            t.line(1.5, 6 + oy, 1.5, 23 + oy, '#e8e4d8')
            t.set(-1.5, 14 + oy, LEATHER[2]); t.set(-1.5, 15 + oy, LEATHER[2])
        part(c, bow)
        # flèche encochée
        c.line(-3, 14 + oy, 5, 14 + oy, WOOD[3])
        c.set(-4, 14 + oy, STEEL[3]); c.set(-3, 13 + oy, STEEL[2]); c.set(-3, 15 + oy, STEEL[2])
        bone_line(c, 6, 13 + oy, 0, 14 + oy)
        sell(c, -0.5, 14.5 + oy, 1.4, 1.3, BONE)
        return c
    return pair(fn)


# ---------------------------------------------------------------- liche

ROBE = ['#1c0a2e', '#3c1660', '#60268e', '#8a44b8', '#b874e0']


def lich():
    def fn(f):
        c = Canvas(28, 38)
        oy = -f
        s = 1 if f else -1
        # bras arrière (manche)
        spoly(c, [(15, 13 + oy), (19, 14 + oy), (20, 21 + oy), (17, 21 + oy)], dk(ROBE, -0.08))
        # robe évasée, ourlet en lambeaux
        hem = [(21, 31), (19 + s * 0.5, 33), (16, 31.5), (13 - s * 0.5, 33), (10, 31.5), (7 + s * 0.5, 33), (4, 31.5), (2, 33)]
        robe = [(7, 12 + oy), (16, 12 + oy), (22, 30)] + hem + [(1, 31)]
        spoly(c, robe, ROBE, contrast=0.4)
        for x in (8, 12, 16):
            c.line(x + 1, 16 + oy, x + (x - 11) * 0.5, 30, ROBE[1])
        c.line(6, 16 + oy, 3, 30, ROBE[4])
        # ceinture et orfèvrerie
        for x in range(5, 19):
            c.setf(x, 20 + oy, GOLD[2] if x < 12 else GOLD[1])
        c.setf(10, 21 + oy, PURPLE_GLOW[3]); c.setf(10, 22 + oy, PURPLE_GLOW[2])
        # capuche
        spoly(c, [(13, 4 + oy), (21, 9 + oy), (17, 12 + oy)], ROBE)
        sell(c, 11, 9 + oy, 7, 7, ROBE)
        c.ellipse(9, 10.6 + oy, 4.6, 4.6, '#12061e')
        # crâne dans l'ombre
        sell(c, 8.5, 10.5 + oy, 3.8, 3.6, BONE[1:])
        c.rect(5, 9 + oy, 3, 3, INK); c.rect(9, 9 + oy, 3, 3, INK)
        c.set(6, 10 + oy, PURPLE_GLOW[4]); c.set(7, 10 + oy, PURPLE_GLOW[3]); c.set(6, 11 + oy, PURPLE_GLOW[2])
        c.set(10, 10 + oy, PURPLE_GLOW[4]); c.set(11, 10 + oy, PURPLE_GLOW[2])
        for x in (6, 8, 10):
            c.set(x, 13 + oy, INK)
        c.set(8, 12 + oy, BONE[0])
        # bord de capuche éclairé
        c.line(4, 8 + oy, 7, 5 + oy, ROBE[4])
        # bâton à orbe
        def staff(t):
            sline(t, 1, 8 + oy, 2.6, 33, ['#1a1020', '#3a2430', '#5a3a40', '#7a5a52'], 2)
            sell(t, 0.5, 4 + oy, 3.2, 3.2, PURPLE_GLOW)
            t.set(-0.5, 3 + oy, WHITE); t.set(0, 2 + oy, PURPLE_GLOW[4])
            for (x0, y0, x1, y1) in ((-2.5, 6.5, -3.5, 2), (3.5, 6.5, 4, 1.5)):
                t.line(x0, y0 + oy, x1, y1 + oy, '#4a3446')
            for x, y in ((-5, 3 + f * 2), (6, 4 - f), (-5, 8 + f), (5, 9 - f)):
                t.set(x, y + oy, PURPLE_GLOW[3])
        part(c, staff)
        # manche avant + main osseuse
        spoly(c, [(7, 13 + oy), (10, 14 + oy), (5, 19 + oy), (2, 18 + oy)], ROBE)
        c.set(2, 17 + oy, BONE[3]); c.set(1, 18 + oy, BONE[2]); c.set(3, 18 + oy, BONE[2])
        return c
    return pair(fn)


# ---------------------------------------------------------------- fantôme

GHOST = ['#5a4a8e', '#9a8ece', '#d4cef0', '#f2f0ff', '#ffffff']


def wraith():
    def fn(f):
        c = Canvas(26, 26)
        oy = f
        s = 1 if f else -1
        body = mask_of(lambda m: m.ellipse(10, 9 + oy, 8, 8, '#000'))
        tail = [(2, 9 + oy), (18, 9 + oy), (19, 15 + oy), (22 + s, 20 + oy), (17, 18 + oy), (15 + s * 0.5, 20.5 + oy),
                (12, 18 + oy), (9 - s * 0.5, 20.5 + oy), (6, 18 + oy), (3, 20 + oy), (2, 15 + oy)]
        body |= mask_of(lambda m: m.poly(tail, '#000'))
        shade_mask(c, body, GHOST, contrast=0.38, bias=0.06)
        # bras
        sell(c, 1.5, 11.5 + oy - f, 2.4, 1.6, GHOST)
        sell(c, 19, 11 + oy + f, 2, 1.5, dk(GHOST, -0.05))
        # visage surpris
        ey = 6 + oy
        eye(c, 5, ey, 2, 4); eye(c, 10, ey, 2, 4)
        c.ellipse(8, 13.2 + oy, 1.7, 2.3, '#2a1838')
        c.set(8, 14 + oy, '#c84a6a'); c.set(7, 14 + oy, '#a83a5a')
        blush(c, 3, ey + 4, '#ffa0c0'); blush(c, 12, ey + 4, '#ffa0c0')
        c.set(4, 3 + oy, WHITE); c.set(5, 2 + oy, WHITE)
        return c
    return pair(fn)


# ---------------------------------------------------------------- golem de pierre

STONE = ['#24222e', '#43435a', '#6a6a7e', '#9494a4', '#c2c2cc']


def mossify(c, mask, seed=0, depth=2):
    """Mousse sur les bords supérieurs (déterministe)."""
    for (x, y) in mask:
        if (x, y - 1) in mask:
            continue
        h = (x * 7 + seed * 13) % 5
        if h < 3:
            for k in range(depth if h else depth + 1):
                c.setf(x, y + k, MOSS[3 - k] if k < 3 else MOSS[0])
            if h == 0:
                c.set(x, y - 1, MOSS[2])


def golem():
    def fn(f):
        c = Canvas(42, 44)
        oy = -f * 0.5
        lx, rx_ = (11, 22) if f == 0 else (13, 20)
        Sd = dk(STONE, -0.08)
        # bras arrière
        sell(c, 31, 19 + oy, 5, 5.6, Sd)
        sell(c, 33, 27 + oy, 4.4, 5, Sd)
        sell(c, 33.5, 32.5 + oy, 4.4, 3.4, Sd)
        # jambes trapues
        spoly(c, [(rx_, 30), (rx_ + 6, 30), (rx_ + 7, 38), (rx_ - 1, 38)], Sd)
        spoly(c, [(lx, 30), (lx + 6, 30), (lx + 7, 38), (lx - 1, 38)], STONE)
        # torse rocheux
        tm = mask_of(lambda m: m.ellipse(21, 22 + oy, 12, 9.5, '#000'))
        shade_mask(c, tm, STONE, contrast=0.42)
        mossify(c, tm, 1)
        c.line(22, 16 + oy, 25, 20 + oy, STONE[1]); c.line(25, 20 + oy, 24, 24 + oy, STONE[1])
        c.line(16, 26 + oy, 20, 29 + oy, STONE[1]); c.line(28, 25 + oy, 30, 28 + oy, STONE[1])
        c.set(26, 24 + oy, GREEN_GEM[3]); c.set(27, 24 + oy, GREEN_GEM[2]); c.set(26, 25 + oy, GREEN_GEM[2]); c.set(27, 25 + oy, GREEN_GEM[1])
        # tête (bloc plus clair, bien détaché)
        HEAD = ['#34323f', '#5a5a70', '#828296', '#aeaebc', '#d6d6de']
        hm = mask_of(lambda m: m.ellipse(14, 10 + oy, 7.2, 6.2, '#000'))
        def head(t):
            shade_mask(t, hm, HEAD, contrast=0.4)
            mossify(t, hm, 3)
            ey = round(10 + oy)
            # orbites creusées + yeux luisants
            t.ellipse(12.5, ey + 1.2, 5.2, 2.2, HEAD[1], only_inside=True)
            for ex in (8, 14):
                t.rect(ex, ey, 3, 2, '#ffd84a')
                t.set(ex, ey, '#fff6c0'); t.set(ex + 2, ey + 1, '#e08a1a')
            # arcade sourcilière froncée
            t.line(7, ey - 2, 11, ey - 1, HEAD[0]); t.line(13, ey - 1, 18, ey - 3, HEAD[0])
            t.line(7, ey - 3, 11, ey - 2, HEAD[4])
            # bouche
            t.line(9, ey + 4, 15, ey + 4, INK)
            t.set(9, ey + 3, INK); t.set(15, ey + 3, INK)
            t.line(19, 8 + oy, 20, 11 + oy, HEAD[1])
        part(c, head)
        # bras avant (gros poing)
        am = mask_of(lambda m: m.ellipse(8, 21 + oy, 5.6, 6, '#000'))
        def arm(t):
            shade_mask(t, am, STONE, contrast=0.42)
            mossify(t, am, 5)
            sell(t, 6, 29 + oy, 4.8, 4.6, STONE)
            sell(t, 5.5, 34.5 + oy, 5, 3.6, STONE)
            t.line(2, 34 + oy, 4, 35 + oy, STONE[1]); t.line(6, 33 + oy, 7, 36 + oy, STONE[1])
            t.line(4, 24 + oy, 7, 26 + oy, STONE[1])
        part(c, arm)
        return c
    return pair(fn)


# ---------------------------------------------------------------- ogre

OGRE = ['#3a1c14', '#6e3820', '#a8623a', '#d6935c', '#f6c690']


def ogre():
    def fn(f):
        c = Canvas(48, 48)
        oy = -f
        lx, rx_ = (12, 23) if f == 0 else (14, 21)
        Od = dk(OGRE, -0.1)
        # jambes
        spoly(c, [(rx_, 31), (rx_ + 6, 31), (rx_ + 6, 41), (rx_, 41)], Od)
        sell(c, rx_ + 2.5, 41.5, 4.2, 1.8, dk(LEATHER, -0.1))
        spoly(c, [(lx, 31), (lx + 6, 31), (lx + 6, 41), (lx, 41)], OGRE)
        sell(c, lx + 2, 41.5, 4.4, 1.8, LEATHER)
        for x in range(lx, lx + 6):
            c.setf(x, 38, LEATHER[1] if x % 2 else LEATHER[2])
        # bras arrière
        spoly(c, [(28, 14 + oy), (33, 15 + oy), (34, 26 + oy), (30, 27 + oy)], Od)
        sell(c, 32, 28 + oy, 3, 2.8, Od)
        # torse + ventre
        sell(c, 20, 23 + oy, 11, 9, OGRE)
        sell(c, 20, 16 + oy, 10, 6, OGRE)
        c.line(18, 19 + oy, 18, 21 + oy, OGRE[1]); c.set(17, 26 + oy, OGRE[1]); c.set(18, 26 + oy, OGRE[1])
        # bandoulière de cuir
        c.line(12, 13 + oy, 28, 26 + oy, LEATHER[1], 2)
        c.line(12, 12 + oy, 28, 25 + oy, LEATHER[3])
        c.set(21, 19 + oy, STEEL[3]); c.set(25, 22 + oy, STEEL[3])
        # pagne + ceinture
        spoly(c, [(9, 27 + oy), (31, 27 + oy), (30, 35 + oy), (24, 33 + oy), (19, 36 + oy), (14, 33 + oy), (10, 35 + oy)], LEATHER)
        for x in range(9, 32):
            c.setf(x, 27 + oy, LEATHER[0]); c.setf(x, 28 + oy, LEATHER[1])
        c.rect(17, 27 + oy, 3, 3, GOLD[2]); c.set(17, 27 + oy, GOLD[4]); c.set(18, 28 + oy, LEATHER[0])
        # tête
        def head(t):
            sell(t, 16, 9 + oy, 6.8, 6.2, OGRE)
            sell(t, 13.5, 13 + oy, 5, 3, OGRE)  # mâchoire lourde
            spoly(t, [(11, 5 + oy), (7, -1 + oy), (13, 3 + oy)], BONE)
            spoly(t, [(19, 3 + oy), (23, -2 + oy), (22, 5 + oy)], dk(BONE, -0.08))
            ey = round(7 + oy)
            for ex in (9, 15):
                t.rect(ex, ey + 1, 3, 2, WHITE)
                t.set(ex, ey + 1, '#ffd84a'); t.set(ex, ey + 2, INK); t.set(ex + 1, ey + 2, INK)
            t.line(8, ey - 1, 12, ey + 1, OGRE[0]); t.line(8, ey, 11, ey + 1, OGRE[0])
            t.line(15, ey + 1, 19, ey - 1, OGRE[0])
            sell(t, 13, ey + 4.5, 2.2, 1.7, OGRE)
            t.set(12, ey + 5, OGRE[0]); t.set(14, ey + 5, OGRE[0])
            t.line(9, ey + 8, 17, ey + 8, INK)
            t.set(10, ey + 7, BONE[4]); t.set(16, ey + 7, BONE[4]); t.set(10, ey + 6, BONE[3]); t.set(16, ey + 6, BONE[3])
            t.set(12, ey + 9, OGRE[1]); t.set(13, ey + 9, OGRE[1])
        part(c, head)
        # bras avant + massue cloutée
        part(c, lambda t: (sell(t, 11, 18.5 + oy, 4, 3.6, OGRE),
                           spoly(t, [(8, 18 + oy), (13, 19 + oy), (8, 27 + oy), (3, 26 + oy)], OGRE)))
        def club(t):
            sline(t, 4, 30 + oy, -2, 14 + oy, WOOD, 3)
            sell(t, -3, 10 + oy, 4.6, 6.2, ['#2a1610', '#4e2c1a', '#7a4a28', '#a4703e', '#c89860'])
            for (x, y) in ((-8, 9), (-6, 4), (-2, 3), (2, 7), (2, 13), (-7, 14), (-3, 17)):
                t.set(x, y + oy, STEEL[3])
            for (x, y) in ((-7, 9), (-5, 5), (-2, 4), (1, 7), (1, 12), (-6, 13)):
                t.set(x, y + oy, STEEL[1])
            t.set(-5, 8 + oy, STEEL[4]); t.set(-3, 7 + oy, STEEL[2])
            t.rect(-6, 15 + oy, 7, 1, STEEL[2]); t.set(-6, 15 + oy, STEEL[4])
        part(c, club)
        sell(c, 4, 26.5 + oy, 3, 2.8, OGRE)
        return c
    return pair(fn)


# ---------------------------------------------------------------- désert

SCORP = ['#3e0a12', '#7a161a', '#bf2c22', '#ea5c34', '#ff9a64']


def scorpion_draw(f, s=1.0, R=SCORP):
    def P(pts):
        return [(x * s, y * s) for x, y in pts]
    c = Canvas(int(38 * s) + 4, int(28 * s) + 4)
    Rd = dk(R, -0.12)
    lw = max(1, int(s))
    # pattes (alternées)
    for i, x in enumerate((12, 15, 18, 21)):
        k = (1 if (i + f) % 2 else -1)
        c.line(x * s, 15 * s, (x - 2 + k * 0.7) * s, 17 * s, Rd[1], lw + 1)
        c.line((x - 2 + k * 0.7) * s, 17 * s, (x - 3 + k) * s, 20 * s, Rd[1], lw)
        c.set((x - 3 + k) * s, 20 * s, Rd[3])
    # queue segmentée
    sw = 0.6 if f else 0
    seg = [(24, 12.5, 3.8, 3.4), (27.5, 9, 3.4, 3.2), (29, 5, 3, 3), (27.6, 1.6, 2.8, 2.6), (24, 0 + sw, 2.6, 2.2)]
    for x, y, rx, ry in seg:
        sell(c, x * s, y * s, rx * s, ry * s, R)
        c.set((x - rx * 0.4) * s, (y - ry * 0.5) * s, R[4])
    spoly(c, P([(22, -0.6 + sw), (17, 2.4 + sw), (22, 2.4 + sw)]), ['#3a1a2a', '#8a3a5a', '#e06a8a', '#ffc0d0'])
    c.set(17 * s, 2 * s + sw, '#ffe0e8')
    # corps segmenté
    sell(c, 17, 13.5, 8.4, 4.4, R)
    for x in (14, 18, 22):
        c.line(x * s, 9.6 * s, (x + 0.6) * s, 17 * s, R[1])
    # pince arrière
    sline(c, 9 * s, 14 * s, 6 * s, 17 * s, Rd, 2 + lw)
    sell(c, 4 * s, 17.4 * s, 3.4 * s, 2.6 * s, Rd)
    spoly(c, P([(2, 15.4), (-2.4, 15 + f), (-2, 16.6 + f), (1.6, 17)]), Rd)
    spoly(c, P([(1.6, 18.4), (-1.4, 19.4), (1.4, 20), (4, 19.8)]), Rd)
    # tête
    sell(c, 9 * s, 13 * s, 4.8 * s, 4 * s, R)
    # pince avant (grosse, levée)
    sline(c, 9 * s, 11 * s, 6 * s, 7.4 * s, R, 2 + lw)
    sell(c, 3.6 * s, 6.4 * s, 4.4 * s, 3.4 * s, R)
    spoly(c, P([(1.6, 3.6), (-3.4, 2.6 - f), (-3, 4.6 - f), (0.6, 5.4)]), R)
    spoly(c, P([(1, 7.6), (-2.6, 8.4), (0.4, 9.6), (4, 9.2)]), R)
    c.set(2 * s, 4.6 * s, R[4]); c.set(3 * s, 4.6 * s, R[4]); c.set(1 * s, 5 * s, R[4])
    # visage furieux
    ex, ey = round(6 * s), round(11 * s)
    for dx in (0, 4):
        c.rect(ex + dx, ey, 2, 2, '#ffe24a'); c.set(ex + dx, ey + 1, INK); c.set(ex + dx + 1, ey + 1, INK)
    c.line(ex - 1, ey - 2, ex + 1, ey - 1, INK); c.line(ex + 4, ey - 1, ex + 6, ey - 2, INK)
    c.line(ex, ey + 3, ex + 5, ey + 3, INK); c.set(ex + 1, ey + 4, WHITE); c.set(ex + 4, ey + 4, WHITE)
    return c


def scorpion():
    return pair(lambda f: scorpion_draw(f))


MUMMY = ['#4e3e30', '#8a765a', '#c0ab86', '#e2d2ae', '#f8f0da']


def mummy():
    def fn(f):
        c = Canvas(28, 32)
        oy = -f
        fx, bx = (5, 11) if f == 0 else (7, 9)
        B = MUMMY
        spoly(c, [(bx, 19 + oy), (bx + 3, 19 + oy), (bx + 3, 25), (bx, 25)], dk(B, -0.1))
        spoly(c, [(fx, 19 + oy), (fx + 3, 19 + oy), (fx + 3, 25), (fx, 25)], B)
        sell(c, bx + 1, 25.5, 2.4, 1.1, dk(B, -0.12)); sell(c, fx + 1, 25.5, 2.4, 1.1, B)
        # bras arrière tendu
        spoly(c, [(12, 14 + oy), (15, 15 + oy), (8, 17 + oy), (6, 16 + oy)], dk(B, -0.1))
        # torse
        spoly(c, [(6, 13 + oy), (14, 13 + oy), (15, 20 + oy), (5, 20 + oy)], B)
        # tête chibi
        sell(c, 9.5, 7.5 + oy, 6.6, 6.2, B)
        # bandelettes (diagonales)
        for (x, y) in mask_of(lambda m: m.rect(0, 0, 28, 32, '#000')):
            p = c.get(x, y)
            if p is None or p not in B:
                continue
            k = (y - x // 3) % 4
            if k == 0:
                c.set(x, y, shift(p, dl=-0.1))
            elif k == 1 and p == B[2]:
                c.set(x, y, B[3])
        # fente des yeux : un œil luisant
        ey = round(7 + oy)
        c.rect(3, ey, 9, 3, '#2a1a14')
        c.rect(4, ey, 3, 3, '#0e0a08')
        c.set(4, ey + 1, '#b4ff6a'); c.set(5, ey + 1, '#5ae03a'); c.set(4, ey, '#eaffc0')
        c.set(9, ey + 1, '#3a8a2a'); c.set(10, ey + 1, '#2a5a1a')
        c.line(2, ey - 1, 12, ey - 1 + 1, B[3])
        c.line(6, ey + 3, 13, ey + 2, B[1])
        c.set(6, ey + 5, INK); c.set(7, ey + 5, INK); c.set(8, ey + 5, INK)
        # bras avant tendu
        spoly(c, [(7, 13 + oy), (10, 15 + oy), (2, 17 + oy), (1, 14 + oy)], B)
        c.setf(3, 15 + oy, B[1]); c.setf(5, 14 + oy, B[1])
        # bandelette flottante
        bw = f
        c.line(15, 9 + oy, 19, 11 + oy + bw, B[3]); c.line(19, 11 + oy + bw, 21, 14 + oy, B[2])
        c.line(16, 10 + oy, 20, 12 + oy + bw, B[1])
        return c
    return pair(fn)


YETI = ['#5a6a9a', '#98a8d0', '#cad6ee', '#eef3fc', '#ffffff']
YETI_SKIN = ['#1a2a6a', '#2e4ea8', '#4a7ad8', '#8ab4f4']


def yeti():
    def fn(f):
        c = Canvas(34, 38)
        oy = -f
        lx, rx_ = (7, 16) if f == 0 else (9, 14)
        Fd = dk(YETI, -0.08)
        spoly(c, [(rx_, 25 + oy), (rx_ + 6, 25 + oy), (rx_ + 6, 32), (rx_, 32)], Fd)
        sell(c, rx_ + 2.6, 32.5, 4, 1.4, dk(YETI_SKIN, -0.06))
        spoly(c, [(lx, 25 + oy), (lx + 6, 25 + oy), (lx + 6, 32), (lx, 32)], YETI)
        sell(c, lx + 2.4, 32.5, 4, 1.4, YETI_SKIN)
        # bras arrière
        spoly(c, [(20, 13 + oy), (25, 14 + oy), (27, 25 + oy), (22, 26 + oy)], Fd)
        sell(c, 25, 26 + oy, 3, 2.6, dk(YETI_SKIN, -0.05))
        # corps massif
        sell(c, 14, 18 + oy, 9.6, 9, YETI)
        for x, y in ((6, 13), (9, 10), (21, 11), (23, 16), (6, 21), (21, 23), (12, 26)):
            c.setf(x, y + oy, YETI[1]); c.setf(x + 1, y + 1 + oy, YETI[1])
        # tête
        sell(c, 11, 9 + oy, 7, 6.6, YETI)
        for x, y in ((6, 2), (9, 1), (12, 1), (15, 2)):
            c.set(x, y + oy, YETI[3]); c.set(x, y - 1 + oy, YETI[4])
        # visage bleu
        fm = mask_of(lambda m: m.ellipse(9, 11 + oy, 5.4, 4.4, '#000'))
        part(c, lambda t: shade_mask(t, fm, YETI_SKIN, contrast=0.3, bias=0.1), line=False)
        ey = round(9 + oy)
        eye(c, 5, ey, 2, 3); eye(c, 10, ey, 2, 3)
        brow(c, 4, ey - 1, 6, ey - 1, YETI_SKIN[0]); brow(c, 10, ey - 1, 12, ey - 1, YETI_SKIN[0])
        open_mouth(c, 6, ey + 4, 5, 2)
        c.set(10, ey + 4, WHITE)
        # bras avant (gros poing)
        spoly(c, [(6, 15 + oy), (11, 16 + oy), (6, 26 + oy), (2, 25 + oy)], YETI)
        sell(c, 3.5, 26.5 + oy, 3.2, 2.8, YETI_SKIN)
        c.set(2, 25 + oy, YETI_SKIN[3])
        return c
    return pair(fn)


IMP = ['#4a0a1e', '#8a1a2a', '#d0302e', '#ff6a4a', '#ffb08a']
IMP_WING = ['#2a0a1a', '#5a1428', '#8a2638', '#c04a4a']


def imp():
    def fn(f):
        c = Canvas(28, 30)
        oy = -f
        R = IMP
        # aile (battement)
        if f == 0:
            membrane_wing(c, (13, 12 + oy), (17, 4 + oy), [(22, 1 + oy), (24, 6 + oy), (21, 11 + oy)], (14, 15 + oy), IMP_WING, [IMP_WING[0], R[1], R[3]])
        else:
            membrane_wing(c, (13, 12 + oy), (19, 8 + oy), [(24, 7 + oy), (24, 12 + oy), (20, 15 + oy)], (14, 15 + oy), IMP_WING, [IMP_WING[0], R[1], R[3]])
        # queue en pointe
        c.line(13, 20 + oy, 17, 21 + oy, R[1]); c.line(17, 21 + oy, 19, 18 + oy, R[1])
        spoly(c, [(18, 17 + oy), (21, 15.5 + oy), (20.5, 19 + oy)], R)
        fx, bx = (5, 10) if f == 0 else (7, 8)
        spoly(c, [(bx, 19 + oy), (bx + 3, 19 + oy), (bx + 3, 24), (bx + 1, 24)], dk(R[:4], -0.1))
        spoly(c, [(fx, 19 + oy), (fx + 3, 19 + oy), (fx + 2, 24), (fx, 24)], R[:4])
        c.rect(bx, 24, 4, 1, R[0]); c.rect(fx - 1, 24, 4, 1, R[0])
        # corps bedonnant
        sell(c, 9, 16.5 + oy, 4.6, 4.2, R)
        for (x, y) in mask_of(lambda m: m.ellipse(8.4, 17.4 + oy, 2.6, 2.4, '#000')):
            c.setf(x, y, R[3])
        # tête chibi
        sell(c, 9, 8.5 + oy, 6.4, 5.8, R)
        spoly(c, [(4, 5 + oy), (1, 0 + oy), (6, 3 + oy)], ['#5a4a3a', '#a89a7a', '#f0e6c8'])
        spoly(c, [(11, 3 + oy), (14, -1.5 + oy), (14.5, 4 + oy)], ['#4a3a2a', '#8a7a5a', '#d0c4a0'])
        ey = round(7 + oy)
        for ex in (4, 9):
            c.rect(ex, ey, 3, 3, '#ffe24a')
            c.set(ex, ey + 1, INK); c.set(ex, ey + 2, INK); c.set(ex + 1, ey + 2, INK)
            c.set(ex + 2, ey + 2, '#e0901a')
        brow(c, 3, ey - 1, 6, ey, R[0]); brow(c, 9, ey, 12, ey - 1, R[0])
        # grand sourire espiègle
        for x in range(4, 11):
            c.set(x, ey + 5 if 4 < x < 10 else ey + 4, INK)
        c.set(5, ey + 6, INK); c.set(9, ey + 6, INK)
        for x in range(6, 9):
            c.set(x, ey + 6, '#7a1a2a')
        c.set(5, ey + 5, WHITE); c.set(9, ey + 5, WHITE)
        # fourche
        def fork(t):
            t.line(1, 6 + oy, 2, 24, WOOD[1], 1)
            t.line(0, 7 + oy, 1, 24, WOOD[3], 1)
            spoly(t, [(-2, 5 + oy), (4, 5 + oy), (3, 7 + oy), (-1, 7 + oy)], STEEL)
            for x in (-2, 1, 4):
                t.set(x, 2 + oy, STEEL[4]); t.set(x, 3 + oy, STEEL[3]); t.set(x, 4 + oy, STEEL[2])
        part(c, fork)
        sell(c, 2, 16 + oy, 1.6, 1.5, R)
        sline(c, 7, 15 + oy, 3, 16 + oy, R, 2)
        return c
    return pair(fn)


# ---------------------------------------------------------------- boss

def boss_bone_lord():
    c = Canvas(48, 60)
    CAPE = ['#1a0a24', '#3a1040', '#62185a', '#8e2a72', '#b8509a']
    D = DSTEEL
    # cape derrière
    spoly(c, [(12, 18), (28, 18), (34, 50), (30, 48), (26, 51), (22, 48), (18, 51), (14, 48), (9, 50)], CAPE)
    for x in (14, 19, 24, 29):
        c.line(x, 22, x + (x - 20) * 0.3, 47, CAPE[1])
    # jambes
    bone_line(c, 22, 35, 23, 49, 3)
    bone_line(c, 16, 35, 14, 49, 3)
    sell(c, 22.5, 42, 2, 1.6, BONE); sell(c, 15, 42, 2, 1.6, BONE)
    spoly(c, [(9, 48), (17, 48), (17, 51), (8, 51)], D)
    spoly(c, [(20, 48), (27, 48), (27, 51), (19, 51)], dk(D, -0.06))
    # jupe d'armure
    spoly(c, [(12, 30), (27, 30), (29, 38), (10, 38)], D)
    for x in range(10, 30, 3):
        c.setf(x, 37, D[0]); c.setf(x, 36, D[0])
    for x in range(12, 28):
        c.setf(x, 30, GOLD[2] if x < 20 else GOLD[1])
    # cage thoracique
    spoly(c, [(12, 18), (27, 18), (26, 31), (13, 31)], BONE[1:])
    for y in range(20, 30, 2):
        c.line(13, y, 26, y, BONE[0])
    for y in range(19, 31):
        c.set(19, y, BONE[3] if y % 2 else BONE[2])
    c.ellipse(20, 24, 1.8, 1.8, '#3affd8'); c.set(19, 23, '#d0fff4')
    # épaulières à pointes
    sell(c, 28, 18.5, 5, 4, dk(D, -0.05))
    sell(c, 11, 18.5, 5.2, 4, D)
    for x, y in ((8, 15), (12, 13), (28, 14), (32, 15)):
        c.line(x, y, x, y - 3, D[3]); c.set(x, y - 4, D[4])
    c.set(9, 17, GOLD[3]); c.set(26, 17, GOLD[2])
    # bras arrière
    bone_line(c, 31, 20, 33, 29)
    sell(c, 33.5, 30, 1.8, 1.6, BONE)
    # crâne chibi + couronne
    skull(c, 18, 10, s=1.45, eye_col='#5affd8')
    def cr(t):
        crown(t, 9, -1, 18, 9, points=5)
    part(c, cr)
    # grande épée (bras avant)
    def sword(t):
        sline(t, 4, 2, 5, 34, D, 4)
        t.line(3, 3, 3.6, 33, D[4])
        t.line(5, 4, 5.4, 32, '#9a6ad8')
        t.set(4, 1, D[4]); t.set(4, 0, WHITE)
        spoly(t, [(-1, 34), (11, 34), (11, 36), (-1, 36)], GOLD)
        t.set(5, 35, RED_GEM[2])
        t.line(5, 37, 5, 41, LEATHER[1], 2)
        sell(t, 5, 42.5, 1.8, 1.6, GOLD)
    part(c, sword)
    bone_line(c, 11, 21, 7, 29, 3)
    sell(c, 6, 30, 2.2, 2, BONE)
    return finish(c)


def boss_spectral_queen():
    c = Canvas(48, 58)
    R = ['#183a6a', '#2a66a8', '#4ea0dc', '#8ad4f4', '#d4f6ff']
    DRESS = ['#1a2a5a', '#2a4a8e', '#3e74c4', '#6aa8e6', '#b0e0fa']
    HAIR = ['#3a5aa0', '#6a9ad8', '#a8d4f6', '#e4f8ff']
    # cheveux flottants (derrière)
    spoly(c, [(12, 4), (25, 4), (32, 13), (38, 24), (33, 22), (34, 30), (28, 22), (24, 14)], HAIR)
    c.line(26, 8, 33, 21, HAIR[3])
    # robe spectrale : traîne qui s'efface en volutes
    body = [(11, 18), (24, 18), (28, 30), (34, 41), (40, 50), (33, 47), (30, 51), (25, 46), (20, 50), (16, 45), (11, 49), (7, 44), (4, 47), (6, 34)]
    m = mask_of(lambda t: t.poly(body, '#000'))
    shade_mask(c, m, DRESS, contrast=0.42)
    for (x, y) in m:
        if y > 42 and (x + y) % 2 == 0:
            c.set(x, y, DRESS[1] if y < 46 else None)
    for x in (12, 17, 22, 27):
        c.line(x, 24, x + (x - 18) * 0.6, 42, DRESS[1])
    c.line(14, 22, 9, 40, DRESS[4])
    # corsage + broche
    spoly(c, [(12, 17), (23, 17), (22, 26), (13, 26)], R)
    c.set(17, 20, BLUE_GEM[3]); c.set(18, 20, BLUE_GEM[2]); c.set(17, 21, BLUE_GEM[1]); c.set(18, 21, BLUE_GEM[1])
    # col de glace
    for x, y in ((11, 16), (14, 15), (21, 15), (24, 16)):
        spoly(c, [(x - 1, y + 2), (x, y - 2), (x + 1.5, y + 2)], ICE)
    # visage pâle
    sell(c, 16, 10, 6, 6.2, ['#5a8ac0', '#9ac8ea', '#d4f0fc', '#f4fcff'])
    spoly(c, [(10, 8), (13, 3), (21, 3), (23, 9), (19, 6), (14, 6), (11, 11)], HAIR)
    ey = 10
    for ex in (12, 17):
        c.rect(ex, ey, 2, 3, INK)
        c.set(ex, ey, '#d8fcff'); c.set(ex + 1, ey + 2, '#3ad0ff'); c.set(ex, ey + 2, '#2a8ac8')
        c.line(ex - 1, ey - 1, ex + 1, ey - 1, '#2a4a80')
    c.set(11, ey + 1, '#2a4a80')
    c.line(14, 15, 16, 15, '#3a5a98')
    blush(c, 11, 13, '#a8c8f8'); blush(c, 18, 13, '#a8c8f8')
    # bras tendu à gauche, magie de glace
    spoly(c, [(12, 20), (14, 22), (6, 27), (4, 25)], R)
    c.ellipse(3, 25, 3.2, 3.2, '#6ae0ff')
    c.ellipse(3, 25, 1.8, 1.8, '#e0ffff')
    c.set(2, 24, WHITE)
    for x, y in ((-1, 21), (6, 20), (0, 30), (-2, 26)):
        c.set(x, y, '#a8f0ff')
    # couronne de glace
    def cr(t):
        pts = [(9, 6), (10, -1), (12.5, 3), (16, -3), (19.5, 3), (22, -1), (23, 6)]
        spoly(t, pts + [(23, 7), (9, 7)], ICE, contrast=0.5)
        for x, y in ((10, 0), (16, -2), (22, 0)):
            t.set(x, y, WHITE)
        t.set(16, 3, '#3a6ae8'); t.set(16, 4, '#2a3aa8'); t.set(15, 3, '#8ab8ff')
    part(c, cr)
    for x, y in ((37, 36), (40, 33), (2, 36), (42, 44)):
        c.set(x, y, '#d4f6ff')
    return finish(c)


# -- dragon helpers (boss_ash_dragon)

def dragon_spike(c, x, base, h, w, colors, lean=0.4):
    """Pique dorsale : triangle ombré, pointe claire, penché vers l'arrière (droite)."""
    tip = (x + w / 2 + lean * h, base - h)
    spoly(c, [(x, base), tip, (x + w, base)], colors, contrast=0.5)
    c.set(tip[0], tip[1] + 0.5, colors[-1])


def dragon_claws(c, x0, y, n, col_hi, col_lo, step=3):
    """Griffes : petits crochets clairs tournés vers la gauche, posés sur la dernière ligne."""
    for i in range(n):
        x = x0 + i * step
        c.set(x, y, col_hi)
        c.set(x - 1, y, col_lo)
        c.set(x, y - 1, col_lo)


def dragon_belly(c, mask, P, rows=2):
    """Plastron ventral : bandes horizontales ombrées (clair en haut à gauche)."""
    if not mask:
        return
    xs = [p[0] for p in mask]
    x0, x1 = min(xs), max(xs)
    for (x, y) in mask:
        if c.get(x, y) is None:
            continue
        if y % (rows + 1) == 0:
            col = P[1]
        else:
            t = (x - x0) / max(1, x1 - x0)
            col = P[3] if (t < 0.45 and y % (rows + 1) == 1) else P[2]
        c.set(x, y, col)


def dragon_scales(c, x0, y0, x1, y1, R):
    """Motif d'écailles : petits arcs plus sombres en quinconce sur les zones lumineuses."""
    down = {R[4]: R[3], R[3]: R[2]}
    for y in range(y0, y1, 4):
        off = 3 if (y // 4) % 2 else 0
        for x in range(x0 + off, x1, 6):
            for dx, dy in ((0, 0), (1, 1), (2, 0)):
                col = c.get(x + dx, y + dy)
                if col in down:
                    c.set(x + dx, y + dy, down[col])


def boss_ash_dragon():
    c = Canvas(72, 58)
    R = ['#0d0916', '#1c1430', '#2f2346', '#46365e', '#6a5384']
    BELLY = ['#4a1418', '#9a3424', '#d06a34', '#f0a052', '#ffd088']
    SPIKE = ['#5a1018', '#b02e22', '#e8602a', '#ffa040', '#ffe08a']
    MEMB = ['#30081a', '#5e1226', '#902430', '#c24234', '#e86a40']
    WBONE = [R[0], R[2], R[4]]
    HORN = ['#2a1e2a', '#6a5a5e', '#b8a890', '#ece2c8', '#fffbea']
    EMBER = ['#ff5a1a', '#ffa02a', '#ffe070', '#fffbd0']
    MOUTH = '#4a0812'

    # aile arrière (plus sombre)
    membrane_wing(c, (38, 26), (33, 3), [(41, 1), (49, 4), (50, 14), (44, 24)], (42, 30),
                  [mix(m, R[1], 0.5) for m in MEMB], dk(WBONE, -0.05), scallop=0.25)
    # piques dorsales (bases cachées par le cou et le corps)
    for x, base, h in ((21, 19, 7), (27, 22, 9), (33, 26, 10), (39, 28, 8)):
        dragon_spike(c, x - 3, base, h, 6, SPIKE)
    # patte avant lointaine
    Rf = dk(R, -0.03)
    spoly(c, [(32, 40), (38, 40), (38, 52), (32, 52)], Rf)
    spoly(c, [(29, 51), (39, 51), (39, 55), (28, 55)], Rf)
    dragon_claws(c, 29, 55, 3, HORN[2], HORN[1])
    # queue
    tail = [(46, 31), (55, 36), (61, 42), (66, 44), (67, 47), (62, 49), (55, 47), (46, 45)]
    spoly(c, tail, R, contrast=0.4)
    for x, h in ((54, 4), (59, 4), (63, 3)):
        y = 36 + (x - 52) * 0.75
        dragon_spike(c, x - 1.5, y + 1, h, 3, SPIKE, lean=0.6)
    spoly(c, [(64, 45), (69, 41), (69, 49)], SPIKE)
    # corps
    sell(c, 38, 36, 14, 10.5, R)
    belly = mask_of(lambda m: m.ellipse(35, 43, 12, 5, '#000'))
    dragon_belly(c, {p for p in belly if c.get(*p) is not None}, BELLY)
    # patte arrière proche
    def hind(t):
        sell(t, 49, 41, 7, 8, R)
        spoly(t, [(46, 45), (53, 45), (52, 52), (46, 52)], R)
        spoly(t, [(42, 51), (53, 51), (54, 55), (41, 55)], R)
        dragon_claws(t, 42, 55, 3, HORN[3], HORN[2])
    part(c, hind)
    dragon_scales(c, 24, 26, 58, 50, R)
    # cou
    neck = [(17, 18), (25, 18), (36, 28), (31, 44), (18, 42), (14, 32)]
    spoly(c, neck, R)
    nb = mask_of(lambda m: m.poly([(12, 31), (18, 31), (24, 37), (27, 45), (19, 45), (14, 38)], '#000'))
    dragon_belly(c, nb, BELLY, rows=1)
    # tête
    def head(t):
        spoly(t, [(13, 14), (16, 7), (22, 3), (19, 9), (17, 15)], dk(HORN, -0.1))
        sell(t, 15, 20, 8.5, 7, R)
        spoly(t, [(1, 21), (4, 18.5), (10, 17), (17, 19), (17, 27), (2, 26.5)], R)
        spoly(t, [(4, 30.5), (16, 28), (19, 32), (7, 34)], dk(R, -0.05))
        t.poly([(3, 26.5), (17, 27), (16, 29), (5, 30.5)], MOUTH)
        t.line(7, 29, 13, 28.5, '#c8384a')
        for x in (3, 7, 11):
            t.set(x, 27, WHITE)
        t.set(4, 27, HORN[3])
        for x in (6, 10):
            t.set(x, 30, WHITE)
        t.set(8, 28, EMBER[1]); t.set(9, 28, EMBER[2]); t.set(10, 28, EMBER[3]); t.set(11, 28, EMBER[1]); t.set(12, 28, EMBER[0]); t.set(9, 29, EMBER[0])
        t.set(2, 21, INK); t.set(3, 21, R[1])
        t.line(3, 19, 7, 18, R[4])
        # gros œil brillant
        ex, ey = 9, 16
        t.rect(ex, ey, 5, 4, EMBER[2])
        t.rect(ex, ey, 5, 1, EMBER[3])
        t.set(ex + 4, ey + 3, EMBER[0]); t.set(ex + 3, ey + 3, EMBER[1])
        t.rect(ex + 1, ey + 1, 2, 3, INK)
        t.set(ex + 1, ey + 1, WHITE)
        t.line(7, 14, 15, 16, INK); t.line(8, 13, 14, 14.5, R[4])
        # corne avant
        spoly(t, [(17, 15), (21, 9), (30, 5), (25, 11), (21, 17)], HORN, contrast=0.5)
        t.set(29, 5, HORN[4]); t.set(21, 10, HORN[3]); t.set(22, 9, HORN[4])
        t.line(19, 15, 24, 10.5, HORN[1])
        spoly(t, [(19, 24), (27, 26), (21, 28)], SPIKE)
    part(c, head)
    # patte avant proche
    def fore(t):
        sell(t, 27, 42, 6, 6, R)
        spoly(t, [(22, 44), (30, 44), (29, 52), (23, 52)], R)
        spoly(t, [(17, 51), (29, 51), (30, 55), (16, 55)], R)
        dragon_claws(t, 17, 55, 3, HORN[3], HORN[2])
    part(c, fore)
    # aile avant
    membrane_wing(c, (40, 28), (48, 4), [(58, 1), (66, 7), (68, 17), (62, 25), (52, 30)], (46, 33),
                  MEMB, WBONE, scallop=0.25)
    # braises
    for x, y, k in ((0, 29, 1), (0, 32, 2), (1, 34, 0)):
        c.set(x, y, EMBER[k])
    return finish(c)


def boss_demon_king():
    c = Canvas(52, 60)
    R = ['#2a0614', '#5a0e22', '#9a1a26', '#d8382c', '#ff7a4a']
    ARM = ['#140a18', '#2a1a30', '#4a3450', '#74587a', '#a88aa8']
    FIRE = ['#8a1a0a', '#e04a10', '#ff9a1e', '#ffe060', '#fffbd0']
    WING = ['#1a0410', '#3e0a1c', '#6a1428', '#9a2a38']
    membrane_wing(c, (26, 18), (35, 4), [(44, 1), (48, 10), (46, 19), (39, 26)], (29, 28), WING, [WING[0], R[2], R[3]])
    for x0 in range(2, 38, 5):
        spoly(c, [(x0, 53), (x0 + 2, 47 - (x0 % 3)), (x0 + 5, 53)], FIRE, bias=0.1)
    spoly(c, [(20, 36), (26, 36), (27, 50), (20, 50)], dk(R, -0.08))
    spoly(c, [(11, 36), (17, 36), (16, 50), (10, 50)], R)
    spoly(c, [(8, 48), (17, 48), (17, 52), (7, 52)], ARM)
    spoly(c, [(19, 48), (28, 48), (28, 52), (19, 52)], dk(ARM, -0.05))
    spoly(c, [(10, 32), (27, 32), (29, 40), (8, 40)], ARM)
    c.rect(18, 33, 2, 2, GOLD[2]); c.set(18, 33, GOLD[4])
    for x in range(8, 30):
        c.setf(x, 32, GOLD[2] if x < 20 else GOLD[1])
    # torse
    spoly(c, [(8, 18), (29, 18), (26, 33), (11, 33)], R)
    c.line(18, 21, 18, 31, R[1])
    c.line(12, 24, 17, 24, R[1]); c.line(20, 24, 25, 24, R[1])
    for y in (27, 29):
        c.line(14, y, 22, y, R[1])
    c.set(18, 22, FIRE[3]); c.set(18, 23, FIRE[2])
    # épaulières
    sell(c, 28, 18.5, 5, 4, dk(ARM, -0.05))
    sell(c, 9, 18.5, 5.2, 4, ARM)
    for x, y in ((6, 13), (10, 12), (28, 12), (32, 13)):
        c.line(x, y, x + (1 if x < 20 else 0), y + 3, ARM[3]); c.set(x, y, ARM[4])
    spoly(c, [(29, 21), (33, 21), (34, 32), (30, 32)], dk(R, -0.08))
    sell(c, 32, 33, 2.6, 2.4, R)
    # tête
    sell(c, 17, 10.5, 7.6, 7, R)
    spoly(c, [(11, 12), (18, 12), (17, 18.5), (12, 18)], R)
    spoly(c, [(12, 8), (6, 6), (2, 0), (8, 3), (13, 5)], ['#2a2028', '#5a4a52', '#9a8a8a', '#e0d4c4'])
    spoly(c, [(21, 5), (25, 2), (27, -3), (28, 3), (24, 8)], ['#1e161e', '#4a3a42', '#7a6a6a', '#b0a49a'])
    part(c, lambda t: crown(t, 11, 0, 13, 7, points=3))
    ey = 10
    for ex in (10, 16):
        c.rect(ex, ey, 4, 3, FIRE[3]); c.set(ex, ey, FIRE[4]); c.set(ex + 1, ey, FIRE[4])
        c.rect(ex, ey + 1, 2, 2, INK); c.set(ex + 3, ey + 2, FIRE[1])
    brow(c, 9, ey - 2, 14, ey, INK); brow(c, 9, ey - 1, 13, ey, R[0]); brow(c, 16, ey, 21, ey - 2, INK)
    for x in range(10, 19):
        c.set(x, 15 if x not in (10, 18) else 14, INK)
    for x in range(12, 17):
        c.set(x, 16, '#5a0a10')
    c.set(11, 15, WHITE); c.set(17, 15, WHITE); c.set(13, 15, WHITE); c.set(15, 15, WHITE)
    c.set(14, 16, '#e0506a')
    # bras avant + boule de feu
    spoly(c, [(8, 20), (12, 22), (6, 30), (3, 28)], R)
    sell(c, 4, 31, 4.6, 4.6, FIRE)
    c.ellipse(3.6, 30.6, 2, 2, FIRE[4])
    for x, y in ((1, 25), (6, 24), (-1, 29), (8, 28)):
        c.set(x, y, FIRE[3])
    return finish(c)


# ---------------------------------------------------------------- compagnons (face à droite)

def pet_cat():
    c = Canvas(20, 18)
    F = ['#6a2a10', '#b05218', '#e88a2a', '#ffbe5a', '#ffe4a8']
    c.line(3, 13, 1, 6, F[1], 2); c.line(2, 12, 0, 6, F[2]); c.set(1, 5, F[4])
    sell(c, 7.5, 12, 5, 3.4, F)
    for x in (5, 7, 9):
        c.setf(x, 10, F[1])
    for x in (4, 7, 10):
        c.rect(x, 14, 2, 2, F[2]); c.set(x, 15, F[3])
    sell(c, 12.5, 7, 5, 4.4, F)
    spoly(c, [(8.5, 5), (9, 0.5), (12, 3.5)], F)
    spoly(c, [(13.5, 3.5), (16.5, 0.5), (17, 5)], F)
    c.set(10, 2, '#ff9aaa'); c.set(15, 2, '#ff9aaa')
    for (x, y) in mask_of(lambda m: m.ellipse(14, 9.2, 2.8, 1.8, '#000')):
        c.setf(x, y, F[4])
    eye(c, 11, 6, 2, 3); eye(c, 15, 6, 2, 3)
    c.set(14, 9, '#ff7a8a')
    c.set(13, 10, F[1]); c.set(15, 10, F[1])
    blush(c, 9, 9); blush(c, 16, 9)
    for x in (5, 7):
        c.setf(x, 12, F[1])
    return finish(c)


def pet_owl():
    c = Canvas(18, 20)
    F = ['#3a2014', '#6a3e22', '#9a6a3a', '#c89a5e', '#ecd09a']
    sell(c, 8.5, 10.5, 6.4, 7, F)
    for (x, y) in mask_of(lambda m: m.ellipse(9.5, 12.5, 3.6, 4.2, '#000')):
        c.setf(x, y, F[4] if (x + y) % 3 else F[3])
    spoly(c, [(2, 8), (6, 9), (7, 15), (3, 16)], F)
    for y in (11, 13):
        c.setf(4, y, F[1]); c.setf(5, y, F[1])
    spoly(c, [(3, 5), (2, 0), (6, 3)], F)
    spoly(c, [(11, 3), (15, 0), (14.5, 5)], F)
    c.ellipse(6.5, 6.5, 2.8, 2.6, F[4]); c.ellipse(11.5, 6.5, 2.8, 2.6, F[4])
    c.ellipse(6.8, 6.6, 1.8, 1.8, '#ffc83a'); c.ellipse(11.8, 6.6, 1.8, 1.8, '#ffc83a')
    for ex in (7, 12):
        c.rect(ex, 6, 1, 2, INK); c.set(ex - 1 + 1, 6, INK); c.set(ex - 1, 6, WHITE)
    c.set(9, 8, '#f0a020'); c.set(9, 9, '#a85a10')
    for x in (6, 7, 10, 11):
        c.set(x, 18, '#f0a020')
    return finish(c)


def pet_fairy():
    c = Canvas(18, 20)
    WING = ['#2a5ab0', '#5aa0f0', '#9ad4ff', '#e0f6ff']
    SKIN = ['#b06a5a', '#f0b090', '#ffdcc0', '#fff4e8']
    DRESS = ['#1a6a5a', '#2aa87a', '#5ee0a0', '#b0ffd0']
    HAIR = ['#8a4a10', '#d89a20', '#ffd84a', '#fff4a0']
    spoly(c, [(7, 9), (1, 2), (0, 6), (3, 10)], WING)
    spoly(c, [(7, 10), (1, 11), (2, 15), (6, 12)], dk(WING, -0.06))
    c.set(2, 4, WHITE); c.set(3, 5, WING[3])
    spoly(c, [(8, 9), (12, 9), (14, 16), (6, 16)], DRESS)
    c.line(7, 15, 13, 15, DRESS[3])
    c.set(9, 17, SKIN[1]); c.set(11, 17, SKIN[1])
    sell(c, 10.5, 5.5, 4.2, 4, SKIN)
    spoly(c, [(6, 5), (8, 0.5), (13, 0.5), (15, 4), (12, 3), (9, 4), (8, 8)], HAIR)
    eye(c, 10, 5, 2, 3); eye(c, 13, 5, 1, 3)
    blush(c, 9, 8); blush(c, 14, 8)
    c.set(12, 8, '#e86a7a')
    c.line(14, 11, 16, 8, WOOD[2])
    c.set(16, 7, '#ffe680'); c.set(17, 6, WHITE); c.set(15, 6, '#ffe680'); c.set(17, 8, '#ffe680'); c.set(16, 5, '#ffe680')
    sell(c, 13.5, 11, 1.2, 1.2, SKIN)
    return finish(c)


def pet_golem():
    """Mini golem chibi (face à droite) : grosse tête ronde, yeux brillants, pousse de mousse."""
    c = Canvas(22, 22)
    S = ['#3a3848', '#646278', '#9290a6', '#bebccc', '#e6e4ee']
    Sd = dk(S, -0.08)
    CRY = ['#1a3a8a', '#2a8ae0', '#6ad8ff', '#d8faff']
    sell(c, 7, 17, 2.4, 1.5, Sd)
    sell(c, 13, 17, 2.6, 1.5, S)
    sell(c, 10, 13.5, 4.8, 3.2, S)
    c.set(10, 14, CRY[3]); c.set(11, 14, CRY[2]); c.set(10, 15, CRY[2]); c.set(11, 15, CRY[1])
    sell(c, 3.8, 12.5, 2.2, 2.4, Sd)
    hm = mask_of(lambda t: t.ellipse(10.5, 7, 6.6, 5.4, '#000'))
    def head(t):
        shade_mask(t, hm, S, contrast=0.42)
        mossify(t, hm, 2, depth=1)
        t.line(5, 9, 6, 11, S[1]); t.line(15, 3, 16, 5, S[1])
        for ex in (10, 14):
            t.rect(ex, 6, 2, 3, INK)
            t.set(ex, 6, WHITE); t.set(ex + 1, 8, CRY[2])
        smile(t, 11, 10, 4, S[0])
        blush(t, 8, 10); blush(t, 16, 10)
    part(c, head)
    c.line(10, 1, 10, 0, LEAF[2])
    spoly(c, [(10, 0.5), (7, -0.5), (8, -1.8)], LEAF)
    spoly(c, [(10.5, 0.5), (13, -2), (13.8, -0.2)], LEAF)
    part(c, lambda t: sell(t, 17.2, 12.5, 2.2, 2.4, S))
    return finish(c)


def pet_wisp():
    c = Canvas(18, 20)
    F = ['#a02a0a', '#e85a14', '#ff9a24', '#ffd25a', '#fff8c8']
    flame = [(9, 0), (11, 4), (14, 3), (15, 9), (15, 13), (12, 17), (6, 17), (3, 13), (3, 8), (6, 6), (7, 2)]
    flame_shade(c, mask_of(lambda m: m.poly(flame, '#000')), F, 9.5, 12, 7, 9)
    eye(c, 9, 9, 2, 3); eye(c, 12, 9, 2, 3)
    smile(c, 10, 12, 3, F[0])
    for x, y in ((2, 4), (15, 0), (17, 6)):
        c.set(x, y, F[3])
    return finish(c)


# ---------------------------------------------------------------- export

REGULAR = ['slime', 'slime_blue', 'slime_ice', 'slime_fire', 'mushroom', 'mushroom_green',
           'goblin', 'goblin_shaman', 'goblin_armored', 'boar', 'wolf', 'wolf_ice', 'mandrake', 'bat',
           'skeleton', 'skeleton_shield', 'skeleton_archer', 'lich', 'wraith', 'golem', 'ogre',
           'scorpion', 'mummy', 'yeti', 'imp']
BOSSES = ['boss_slime_king', 'boss_alpha_wolf', 'boss_bone_lord', 'boss_spectral_queen', 'boss_ash_dragon',
          'boss_demon_king']
PETS = ['pet_slime', 'pet_cat', 'pet_owl', 'pet_fairy', 'pet_golem', 'pet_wisp']


def build():
    g = globals()
    out = {}
    for name in REGULAR:
        a, b = g[name]()
        out[name] = a
        out[name + '_b'] = b
    for name in BOSSES + PETS:
        out[name] = g[name]()
    return {k: (v, {}) for k, v in out.items()}
