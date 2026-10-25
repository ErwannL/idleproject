"""Brutes du monde 5 (montagnes gelées), redessinées de zéro : yéti et troll (ogre).

Ennemis ordinaires mais costauds, face à GAUCHE, pieds sur la dernière ligne du canvas.
  <nom>      : repos
  <nom>_b    : pas de marche (jambes / bras alternés, balancement du corps)
  <nom>_atk  : attaque (coup de poing du yéti, coup de massue du troll)
Les trois images d'un personnage partagent exactement le même canvas (yéti 40×38, troll 48×46).
Couleurs hexadécimales fixes uniquement ; contour '#1a1226'.
"""
import math

from lib import Canvas

OUT = '#1a1226'
WHITE = '#ffffff'
INK = '#1a1226'
LIGHT = (-0.6, -0.8)


# ---------------------------------------------------------------- outils

def frac(v):
    return v - math.floor(v)


def h2(x, y, k=0):
    """Hachage entier déterministe (texture)."""
    n = ((x + 101) * 73856093) ^ ((y + 37) * 19349663) ^ (k * 83492791)
    return (n ^ (n >> 13)) & 0xffff


class Layer(Canvas):
    """Calque à coordonnées libres (marge), recadré sur le canvas final par put()."""
    P = 16

    def __init__(self, w, h):
        super().__init__(w + 2 * self.P, h + 2 * self.P)

    def set(self, x, y, c):
        super().set(x + self.P, y + self.P, c)

    def setf(self, x, y, c):
        super().setf(x + self.P, y + self.P, c)

    def get(self, x, y):
        return super().get(int(round(x)) + self.P, int(round(y)) + self.P)

    def mask(self):
        p = self.P
        return {(x - p, y - p) for y in range(self.h) for x in range(self.w) if self.px[y][x] is not None}


def mask_of(draw):
    m = Layer(64, 64)
    draw(m)
    return m.mask()


def ell_mask(cx, cy, rx, ry):
    return {(x, y) for y in range(int(cy - ry - 1), int(cy + ry + 2)) for x in range(int(cx - rx - 1), int(cx + rx + 2))
            if ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1}


def poly_mask(pts):
    return mask_of(lambda m: m.poly(pts, '#000'))


def shade(c, mask, R, contrast=0.4, bias=0.0, edge=True, light=LIGHT, box=None):
    """Rampe éclairée en haut à gauche + liseré clair (haut-gauche) / sombre (bas-droite)."""
    if not mask:
        return
    if box is None:
        xs = [p[0] for p in mask]
        ys = [p[1] for p in mask]
        box = (min(xs), min(ys), max(xs), max(ys))
    cx, cy = (box[0] + box[2]) / 2, (box[1] + box[3]) / 2
    rx, ry = max(1.0, (box[2] - box[0]) / 2 + 0.5), max(1.0, (box[3] - box[1]) / 2 + 0.5)
    n = len(R)
    for (x, y) in mask:
        dx, dy = (x - cx) / rx, (y - cy) / ry
        v = 0.5 + bias + (dx * light[0] + dy * light[1]) * contrast
        if edge:
            if (x - 1, y) not in mask or (x, y - 1) not in mask:
                v += 0.2
            if (x + 1, y) not in mask or (x, y + 1) not in mask:
                v -= 0.22
        c.set(x, y, R[max(0, min(n - 1, int(v * n)))])


def round_shade(c, mask, cx, cy, rx, ry, R, cuts=(0.0, 0.3, 0.6, 0.86), lz=0.55):
    """Volume arrondi (normale d'ellipse) à bandes douces ; pour ventres, crânes, poings."""
    lx, ly = -0.55, -0.65
    nn = math.sqrt(lx * lx + ly * ly + lz * lz)
    lx, ly, lzn = lx / nn, ly / nn, lz / nn
    for (x, y) in mask:
        dx = (x + 0.5 - cx) / rx
        dy = (y + 0.5 - cy) / ry
        d = min(1.0, dx * dx + dy * dy)
        nz = math.sqrt(1 - d)
        v = dx * lx + dy * ly + nz * lzn
        c.set(x, y, R[min(len(R) - 1, sum(1 for k in cuts if v > k))])


def put(c, t, sep=OUT):
    """Pose le calque t sur c ; trace un liseré `sep` sur ce qu'il recouvre (séparation des volumes)."""
    m = t.mask()
    p = t.P
    if sep:
        for (x, y) in m:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if (nx, ny) in m or not (0 <= nx < c.w and 0 <= ny < c.h):
                    continue
                if c.px[ny][nx] is not None and c.px[ny][nx] != OUT:
                    c.px[ny][nx] = sep
    for (x, y) in m:
        if 0 <= x < c.w and 0 <= y < c.h:
            c.px[y][x] = t.px[y + p][x + p]
    return m


def tufts(cx, cy, rx, ry, teeth=9, amp=0.2, phase=0.0, below=0.0):
    """Masse de fourrure : ellipse dont le bas (dy > below) est découpé en mèches pointues."""
    mask = set()
    for (x, y) in ell_mask(cx, cy, rx, ry):
        dx, dy = (x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry
        r = math.hypot(dx, dy)
        if dy / max(r, 1e-6) > below:
            a = math.atan2(dy, dx)
            tri = abs(2 * frac(a / (2 * math.pi) * teeth + phase) - 1)  # 1 = pointe, 0 = creux
            if r > 1 - amp * (1 - tri):
                continue
        mask.add((x, y))
    return mask


def fur_limb(pts, widths, teeth=1.6, amp=0.4, phase=0.0):
    """Membre de fourrure le long d'une polyligne ; le côté bas/arrière porte des mèches."""
    mask = set()
    total = sum(math.hypot(b[0] - a[0], b[1] - a[1]) for a, b in zip(pts, pts[1:])) or 1
    acc = 0.0
    for i, (a, b) in enumerate(zip(pts, pts[1:])):
        L = math.hypot(b[0] - a[0], b[1] - a[1]) or 1
        ux, uy = (b[0] - a[0]) / L, (b[1] - a[1]) / L
        w0, w1 = widths[i], widths[i + 1]
        wm = max(w0, w1)
        for y in range(int(min(a[1], b[1]) - wm - 1), int(max(a[1], b[1]) + wm + 2)):
            for x in range(int(min(a[0], b[0]) - wm - 1), int(max(a[0], b[0]) + wm + 2)):
                px, py = x + 0.5 - a[0], y + 0.5 - a[1]
                t = max(0.0, min(1.0, (px * ux + py * uy) / L))
                qx, qy = px - ux * t * L, py - uy * t * L
                d = math.hypot(qx, qy)
                w = w0 + (w1 - w0) * t
                if qy * 0.85 + qx * 0.5 > 0.3 * w:
                    g = (acc + t * L) / total
                    tri = abs(2 * frac(g * teeth * len(pts) + phase) - 1)
                    w = w * (1 - amp * (1 - tri))
                if d <= w:
                    mask.add((x, y))
        acc += L
    return mask


def fur_marks(c, mask, R, seed=0, step=4, flow=1):
    """Mèches stylisées : petits accents en V (ton sombre) en quinconce, reflets sur le côté éclairé."""
    idx = {col: i for i, col in enumerate(R)}
    xs = [p[0] for p in mask]
    ys = [p[1] for p in mask]
    for y in range(min(ys) + 2, max(ys) - 1, 3):
        off = (y // 3) % 2 * (step // 2) + seed % step
        for x in range(min(xs) + off, max(xs), step):
            jx = x + (h2(x, y, seed) % 3) - 1
            pts = [(jx, y), (jx + flow, y + 1)]
            if not all((px, py) in mask and (px - 1, py) in mask and (px + 1, py) in mask and (px, py + 1) in mask
                       for (px, py) in pts):
                continue
            i = idx.get(c.get(jx, y))
            if i is None:
                continue
            if i >= 1:
                for (px, py) in pts:
                    c.set(px, py, R[i - 1])
                if i >= 3:
                    c.set(jx - flow, y, R[min(len(R) - 1, i + 1)])


def disc_curve(p0, p1, p2, r0, r1, n=14):
    """Corne : disques le long d'une courbe de Bézier, rayon décroissant."""
    m = set()
    for k in range(n + 1):
        t = k / n
        x = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0]
        y = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]
        r = r0 + (r1 - r0) * t
        m |= ell_mask(x, y, max(0.55, r), max(0.55, r))
    return m


def burst(c, x, y, cols, r=4, rays=8, rot=0.0):
    """Étoile d'impact."""
    for k in range(rays):
        a = rot + k * 2 * math.pi / rays
        ln = r if k % 2 == 0 else r * 0.55
        for s in range(1, int(round(ln)) + 1):
            c.set(x + math.cos(a) * s, y + math.sin(a) * s, cols[0] if s <= ln * 0.5 else cols[1])
    c.set(x, y, cols[0])


def along(p, a, d):
    r = math.radians(a)
    return (p[0] + math.cos(r) * d, p[1] + math.sin(r) * d)


def perp(a):
    r = math.radians(a)
    return (-math.sin(r), math.cos(r))


def finish(c):
    c.outline(OUT)
    return c


# ================================================================ YÉTI (40×38)

YW, YH = 40, 38
Y_FUR = ['#414c94', '#6a82c0', '#a2bce6', '#d4e4f8', '#f8fcff']
Y_FUR_D = ['#2e366c', '#4a5a96', '#7489bf', '#9fb4dc', '#c2d2ee']  # plan arrière
Y_SKIN = ['#252e4c', '#3c4e78', '#5a74a0', '#86a0c6', '#b8cce6']
Y_SKIN_D = ['#1f2640', '#334266', '#4c6290', '#6f88b2', '#97adcf']
HORN = ['#5a4e5e', '#958a7c', '#c9bea2', '#ebe4cc', '#fcf9ec']
Y_EYE = '#fff1a8'
Y_MOUTH = '#4e1636'
Y_TONGUE = '#c24a6e'
ICEFX = ['#ffffff', '#b8ecff', '#6aaee8', '#3a6ab8']


def y_fist(c, x, y, R, r=3.4, punch=False, sep=OUT):
    t = Layer(YW, YH)
    m = ell_mask(x, y, r, r * 0.92)
    round_shade(t, m, x, y, r, r * 0.92, R)
    if punch:
        # jointures vers l'avant (gauche)
        for k in (-1.4, 0, 1.4):
            t.setf(x - r + 1.2, y + k, R[4] if k < 0 else R[3])
        t.setf(x + 0.6, y + 1.2, R[1]); t.setf(x - 0.4, y + 1.2, R[1])
        t.setf(x + 1.6, y + 0.2, R[1])
    else:
        # doigts repliés vers le bas
        for k in (-1.2, 0.4):
            t.setf(x + k, y + r * 0.62, R[1])
        t.setf(x - r * 0.5, y - 0.6, R[1]); t.setf(x - r * 0.5 + 1, y - 0.6, R[3])
    put(c, t, sep)


def y_leg(c, hip, foot, F, S, lift=0):
    fx, fy = foot
    fy -= lift
    t = Layer(YW, YH)
    m = fur_limb([hip, (fx + 0.8, fy - 3)], [4.0, 3.6], teeth=0.9, amp=0.35)
    shade(t, m, F, contrast=0.36)
    fur_marks(t, m, F, seed=int(hip[0]))
    put(c, t, F[0])
    # pied : semelle large, trois orteils vers la gauche
    t = Layer(YW, YH)
    m = ell_mask(fx, fy - 1.4, 4.4, 2.2)
    if not lift:
        m = {(x, y) for (x, y) in m if y <= fy} | {(x, fy) for x in range(int(fx - 3), int(fx + 4))}
    round_shade(t, m, fx, fy - 1.4, 4.4, 2.2, S, cuts=(-0.2, 0.25, 0.6, 0.9))
    for k in (0, 2):
        t.setf(fx - 3 + k, fy - 1, S[1])
    t.setf(fx - 4, fy - 1, HORN[3]); t.setf(fx - 2, fy - 1, None) if False else None
    put(c, t, OUT)
    # mèches qui retombent sur la cheville
    t = Layer(YW, YH)
    m = tufts(fx + 0.6, fy - 4.2, 3.8, 2.0, teeth=7, amp=0.55, below=-0.2)
    shade(t, m, F, contrast=0.3, bias=0.05)
    put(c, t, F[0])


def y_arm(c, pts, hand, F, S, far=False, punch=False, seed=0):
    t = Layer(YW, YH)
    m = fur_limb(pts, [4.4, 4.0, 3.4][:len(pts)], teeth=1.3, amp=0.42, phase=0.2)
    shade(t, m, F, contrast=0.38, bias=0.08)
    fur_marks(t, m, F, seed=seed)
    put(c, t, OUT)
    # manchon de fourrure au poignet
    t = Layer(YW, YH)
    ex, ey = pts[-2]
    wx = hand[0] + (ex - hand[0]) * 0.55
    wy = hand[1] + (ey - hand[1]) * 0.55
    if punch:
        m = tufts(wx, wy, 2.4, 3.6, teeth=6, amp=0.5, below=-2, phase=0.25)
    else:
        m = tufts(wx, wy, 3.6, 2.6, teeth=7, amp=0.5, below=-0.1)
    shade(t, m, F, contrast=0.3, bias=0.06)
    put(c, t, F[0])
    y_fist(c, hand[0], hand[1], S, r=3.3 if far else 3.6, punch=punch)


def y_head(c, hx, hy, mode):
    """Tête : dôme de fourrure, masque bleu-gris tourné à gauche, cornes recourbées vers l'avant."""
    # cornes (derrière le crâne)
    t = Layer(YW, YH)
    for (p0, p1, p2, r0) in (((hx + 3.5, hy - 6.5), (hx + 8, hy - 8), (hx + 6.5, hy - 12), 1.8),
                             ((hx - 3.5, hy - 6.5), (hx - 8, hy - 7.5), (hx - 7, hy - 12.2), 2.0)):
        m = disc_curve(p0, p1, p2, r0, 0.5)
        shade(t, m, HORN, contrast=0.5)
        for k in (0.3, 0.55):  # anneaux
            x = (1 - k) ** 2 * p0[0] + 2 * (1 - k) * k * p1[0] + k * k * p2[0]
            y = (1 - k) ** 2 * p0[1] + 2 * (1 - k) * k * p1[1] + k * k * p2[1]
            t.setf(x, y, HORN[1]); t.setf(x + 1, y, HORN[1])
    put(c, t, OUT)
    # crâne de fourrure
    t = Layer(YW, YH)
    m = tufts(hx, hy, 8.8, 8.0, teeth=13, amp=0.22, below=0.35)
    for (dx, dy) in ((0.5, -8.4), (3.2, -7.8)):  # épis du sommet
        m |= poly_mask([(hx + dx - 1.6, hy + dy + 2.2), (hx + dx + 0.6, hy + dy - 0.6), (hx + dx + 1.6, hy + dy + 2.2)])
    shade(t, m, Y_FUR, contrast=0.42, bias=0.06)
    fur_marks(t, m, Y_FUR, seed=4, step=5)
    put(c, t, OUT)
    # masque du visage (dessous de l'arcade) — décalé vers l'avant
    t = Layer(YW, YH)
    fcx, fcy = hx - 3.2, hy + 2.2
    fm = {(x, y) for (x, y) in ell_mask(fcx, fcy, 6.2, 5.2) if y >= hy - 2}
    # pointe de fourrure entre les yeux
    fm -= {(int(fcx) - 0, hy - 2), (int(fcx) - 1, hy - 2), (int(fcx), hy - 1)}
    round_shade(t, fm, fcx - 0.5, fcy - 1, 6.6, 5.8, Y_SKIN, cuts=(-0.3, 0.12, 0.5, 0.82))
    # museau clair
    for (x, y) in ell_mask(fcx - 1.6, fcy + 1.6, 3.6, 1.9):
        if (x, y) in fm:
            t.set(x, y, Y_SKIN[3])
    t.setf(fcx - 3.5, fcy + 0.7, Y_SKIN[4]); t.setf(fcx - 2.5, fcy + 0.7, Y_SKIN[4])
    ey = hy - 1
    e1, e2 = int(fcx - 4.5), int(fcx + 1)  # œil avant (3 px), œil arrière (2 px)
    # yeux : sclère pâle, pupille tournée vers la gauche, paupière froncée (coin intérieur)
    for (x0, w) in ((e1, 3), (e2, 2)):
        for xx in range(w):
            t.set(x0 + xx, ey, Y_EYE)
            t.set(x0 + xx, ey + 1, Y_EYE)
        t.set(x0, ey + 1, INK); t.set(x0, ey, INK)
        if w == 3:
            t.set(x0 + 1, ey + 1, INK)
            t.set(x0 + 2, ey, INK)  # coin intérieur abaissé
        else:
            t.set(x0, ey, INK)
        t.set(x0, ey + 2, Y_SKIN[1]); t.set(x0 + 1, ey + 2, Y_SKIN[1])  # cerne
    # narines
    t.set(fcx - 4, fcy + 1, Y_SKIN[0]); t.set(fcx - 2, fcy + 1, Y_SKIN[0])
    my = int(fcy + 3)
    if mode == 'roar':
        x0 = int(fcx - 5)
        t.rect(x0, my - 1, 7, 3, INK)
        t.rect(x0 + 1, my, 5, 1, Y_MOUTH)
        t.set(x0 + 2, my + 1, Y_TONGUE); t.set(x0 + 3, my + 1, Y_TONGUE); t.set(x0 + 4, my + 1, Y_MOUTH)
        t.set(x0 + 1, my + 1, Y_MOUTH); t.set(x0 + 5, my + 1, Y_MOUTH)
        for x in (x0 + 1, x0 + 5):  # crocs du haut
            t.set(x, my - 1, WHITE)
        for x in (x0, x0 + 6):  # défenses du bas
            t.set(x, my + 1, WHITE); t.set(x, my, WHITE); t.set(x, my - 1, HORN[3])
    else:
        x0 = int(fcx - 5)
        t.line(x0, my, x0 + 6, my, INK)
        t.set(x0 + 6, my - 1 + (mode == 'walk'), INK)
        for x in (x0 + 1, x0 + 5):  # défenses qui remontent
            t.set(x, my - 1, WHITE); t.set(x, my - 2, HORN[3])
        t.set(x0 + 2, my + 1, Y_SKIN[1]); t.set(x0 + 3, my + 1, Y_SKIN[1])
    put(c, t, Y_FUR[0])
    # barbe de fourrure sous le menton (joue arrière)
    t = Layer(YW, YH)
    m = tufts(hx + 4.2, hy + 4.6, 2.8, 3.0, teeth=5, amp=0.55, below=-0.2)
    shade(t, m, Y_FUR, contrast=0.3, bias=0.05)
    put(c, t, Y_FUR[1])


def yeti_draw(f):
    """f : 0 repos, 1 pas de marche, 2 coup de poing."""
    c = Canvas(YW, YH)
    G = YH - 1
    bob = (0, 1, 1)[f]
    lean = (0, 0, -2)[f]
    hx, hy = 14 + lean, 13 + bob
    bx, by = 23 + lean * 0.5, 22 + bob
    # ---- bras arrière
    if f == 0:
        y_arm(c, [(29, 16 + bob), (34, 22), (34.5, 27)], (34.5, 29.5), Y_FUR_D, Y_SKIN_D, far=True, seed=5)
    elif f == 1:
        y_arm(c, [(29, 17 + bob), (33.5, 23), (31.5, 28)], (30.5, 30.5), Y_FUR_D, Y_SKIN_D, far=True, seed=5)
    else:
        y_arm(c, [(28, 18 + bob), (33, 22), (34.5, 25)], (35, 27.5), Y_FUR_D, Y_SKIN_D, far=True, seed=5)
    # ---- jambes : (hanche, pied, soulevé)
    if f == 0:
        far_leg, near_leg = ((27, 29), (28, G), 0), ((19, 29), (18, G), 0)
    elif f == 1:
        far_leg, near_leg = ((27, 30), (31, G), 0), ((19, 30), (14, G), 2)
    else:
        far_leg, near_leg = ((27, 30), (32, G), 0), ((18, 30), (13, G), 0)
    y_leg(c, *far_leg[:2], Y_FUR_D, Y_SKIN_D, far_leg[2])
    # ---- corps
    t = Layer(YW, YH)
    m = tufts(bx, by, 9.4, 10.4, teeth=14, amp=0.16, phase=0.3, below=0.3)
    shade(t, m, Y_FUR, contrast=0.44, bias=0.03)
    fur_marks(t, m, Y_FUR, seed=1)
    put(c, t, OUT)
    # poitrail clair festonné
    t = Layer(YW, YH)
    m = tufts(bx - 4.5, by + 1.5, 5.0, 6.4, teeth=9, amp=0.4, below=0.1)
    shade(t, m, Y_FUR[2:] + [WHITE], contrast=0.34, bias=0.1)
    put(c, t, Y_FUR[1])
    # ---- jambe avant
    y_leg(c, *near_leg[:2], Y_FUR, Y_SKIN, near_leg[2])
    # ---- tête
    y_head(c, hx, hy, ('idle', 'walk', 'roar')[f])
    # ---- bras avant
    if f == 0:
        y_arm(c, [(18, 20 + bob), (13, 24), (10.5, 27.5)], (9.5, 30), Y_FUR, Y_SKIN, seed=7)
    elif f == 1:
        y_arm(c, [(18, 21 + bob), (15.5, 26), (15, 28.5)], (15, 31), Y_FUR, Y_SKIN, seed=7)
    else:
        # onde de choc / éclats de glace devant le poing
        e = Layer(YW, YH)
        for (x, y, h, dy) in ((5, 19, 4, -1.5), (5, 33, 4, 1.5)):
            m = poly_mask([(x + 2, y - 1.3), (x - h, y + dy), (x + 2, y + 1.3)])
            shade(e, m, ICEFX[::-1], contrast=0.5)
        put(c, e, None)
        y_arm(c, [(18, 22 + bob), (13.5, 25), (10.5, 26)], (8, 26), Y_FUR, Y_SKIN, punch=True, seed=7)
        for (x, y) in ((17, 19), (18, 29)):
            for s in range(4):
                c.set(x + s, y, ICEFX[1] if s else WHITE)
    c = finish(c)
    if f == 2:
        for (rad, col) in ((5.6, ICEFX[0]), (7.6, ICEFX[1])):
            for deg in range(140, 222, 4):
                r = math.radians(deg)
                x, y = 8 + math.cos(r) * rad, 26 + math.sin(r) * rad * 1.1
                if c.get(int(round(x)), int(round(y))) is None:
                    c.set(x, y, col)
    return c


def yeti_frames():
    return [yeti_draw(f) for f in range(3)]


# ================================================================ TROLL / OGRE (48×46)

OW, OH = 48, 46
O_SKIN = ['#26342e', '#405848', '#617c58', '#87a272', '#b4c896']
O_SKIN_D = ['#1f2a26', '#34463c', '#4e664a', '#6c8660', '#8ea67c']
O_BELLY = ['#56603e', '#7f8c58', '#a8b474', '#cdd496', '#ecedc0']
O_WART = '#4a6446'
O_NOSE = ['#3a2c30', '#6a5446', '#987a5e', '#c09e78', '#e2c69a']
LEATHER = ['#3a1e14', '#6a3a1e', '#9a5a2a', '#c4823e', '#e8b070']
PELT = ['#2c1e18', '#4c3424', '#6e4e36', '#94704e', '#b8946a']
WOOD = ['#3e2214', '#6e3e1e', '#9e6230', '#c88e4a', '#ecc07a']
IRON = ['#2a2e44', '#4e5672', '#7c88a4', '#b4c0d4', '#eef2f8']
TUSK = ['#6a5e50', '#b0a48a', '#e2d8bc', '#fbf6e4']
O_HAIR = ['#1a1620', '#2e2630', '#463a44', '#5e4e58']
O_EYE = '#ffd23a'
O_MOUTH = '#6a1a26'
DUST = ['#f2f4f8', '#c4cad8', '#8a94aa', '#5a6480']


def o_leg(c, hip, foot, R, lift=0):
    fx, fy = foot
    fy -= lift
    t = Layer(OW, OH)
    knee = ((hip[0] + fx) / 2 - 1, (hip[1] + fy) / 2)
    m = mask_of(lambda mm: (mm.line(hip[0], hip[1], knee[0], knee[1], '#000', width=8),
                            mm.line(knee[0], knee[1], fx + 1, fy - 3, '#000', width=7)))
    shade(t, m, R, contrast=0.4)
    t.setf(knee[0] - 2, knee[1] - 1, R[3])
    t.setf(knee[0] - 1, knee[1] + 1, R[1]); t.setf(knee[0], knee[1] + 1, R[1])
    put(c, t, OUT)
    # pied large, orteils griffus
    t = Layer(OW, OH)
    m = ell_mask(fx, fy - 1.8, 5.0, 2.6)
    if not lift:
        m = {(x, y) for (x, y) in m if y <= fy} | {(x, fy) for x in range(int(fx - 4), int(fx + 5))}
    round_shade(t, m, fx, fy - 1.8, 5.0, 2.6, R, cuts=(-0.2, 0.25, 0.6, 0.9))
    for k in (0, 2):
        t.setf(fx - 3 + k, fy - 1, R[1])
    put(c, t, OUT)
    t = Layer(OW, OH)
    t.set(fx - 5, fy - 1, TUSK[3]); t.set(fx - 5, fy, TUSK[1]); t.set(fx - 3, fy, TUSK[2])
    put(c, t, None)


def o_arm(c, pts, R, w=(4.2, 3.6, 3.0)):
    t = Layer(OW, OH)
    m = set()
    for (a, b), wa in zip(zip(pts, pts[1:]), w):
        m |= mask_of(lambda mm, a=a, b=b, wa=wa: mm.line(a[0], a[1], b[0], b[1], '#000', width=int(round(wa * 2))))
    shade(t, m, R, contrast=0.4)
    put(c, t, OUT)
    # épaule massive
    t = Layer(OW, OH)
    sx, sy = pts[0]
    m = ell_mask(sx, sy + 0.5, 4.4, 4.0)
    round_shade(t, m, sx, sy + 0.5, 4.4, 4.0, R)
    put(c, t, R[1])


def o_bracer(c, a, b, R=LEATHER):
    """Bracelet de cuir entre a (coude) et b (main)."""
    t = Layer(OW, OH)
    wx, wy = b[0] + (a[0] - b[0]) * 0.38, b[1] + (a[1] - b[1]) * 0.38
    ang = math.degrees(math.atan2(b[1] - a[1], b[0] - a[0]))
    nx, ny = perp(ang)
    p0, p1 = along((wx, wy), ang, -1.4), along((wx, wy), ang, 1.4)
    m = poly_mask([(p0[0] + nx * 3.6, p0[1] + ny * 3.6), (p1[0] + nx * 3.6, p1[1] + ny * 3.6),
                   (p1[0] - nx * 3.6, p1[1] - ny * 3.6), (p0[0] - nx * 3.6, p0[1] - ny * 3.6)])
    shade(t, m, R, contrast=0.4)
    t.setf(wx + nx * 1.5, wy + ny * 1.5, IRON[3])
    put(c, t, OUT)


def o_fist(c, x, y, R, r=3.6):
    t = Layer(OW, OH)
    m = ell_mask(x, y, r, r * 0.92)
    round_shade(t, m, x, y, r, r * 0.92, R)
    t.setf(x - 1, y + 1.4, R[1]); t.setf(x + 0.6, y + 1.4, R[1])
    t.setf(x - r * 0.5, y - 0.6, R[1]); t.setf(x - r * 0.5 + 1, y - 0.6, R[3])
    put(c, t, OUT)


def club(c, grip, a, ln=20):
    """Massue de bois : manche fin -> tête épaisse arrondie, cerclage et clous de fer."""
    nx, ny = perp(a)

    def at(u, s):
        q = along(grip, a, ln * u)
        return (q[0] + nx * s, q[1] + ny * s)
    t = Layer(OW, OH)
    pts = [at(-0.34, 1.3), at(0.35, 1.5), at(0.62, 3.6), at(0.86, 4.6), at(0.98, 3.8), at(1.04, 1.8), at(1.06, 0),
           at(1.04, -1.8), at(0.98, -3.8), at(0.86, -4.6), at(0.62, -3.6), at(0.35, -1.5), at(-0.34, -1.3)]
    m = poly_mask(pts)
    shade(t, m, WOOD, contrast=0.55)
    # veinure le long du manche, nœud
    for k in range(-3, int(ln * 0.95), 3):
        q = along(grip, a, k)
        t.setf(q[0] + nx * 0.5, q[1] + ny * 0.5, WOOD[1])
    q = at(0.78, -1.6)
    t.setf(q[0], q[1], WOOD[0]); t.setf(q[0] + 1, q[1], WOOD[1])
    # cerclage de fer
    for s in range(-5, 6):
        q = at(0.66, s * 0.8)
        t.setf(q[0], q[1], IRON[3] if s < 0 else IRON[2])
        q = at(0.66 + 1 / ln, s * 0.8)
        t.setf(q[0], q[1], IRON[1])
    # têtes de clous
    for (u, s) in ((0.82, -2.0), (0.9, 1.2), (0.97, -0.6)):
        q = at(u, s)
        t.setf(q[0], q[1], IRON[4]); t.setf(q[0] + 1, q[1] + 1, IRON[1])
    put(c, t, OUT)
    # clous qui dépassent du bord (pointes courtes)
    t = Layer(OW, OH)
    for (u, side) in ((0.76, 1), (0.92, 1), (0.84, -1), (0.98, -1)):
        w = 4.6 if u < 0.95 else 3.9
        for e in (0.6, 1.6):
            q = at(u, side * (w + e))
            t.set(q[0], q[1], IRON[3] if e < 1 else IRON[4])
    q = at(1.06 + 1.6 / ln, 0)
    t.set(q[0], q[1], IRON[4])
    put(c, t, None)


def o_head(c, hx, hy, mode):
    """Tête de troll : crâne bas, gros nez crochu, mâchoire prognathe à défenses, oreille pointue, crête."""
    roar = mode == 'roar'
    # oreille pointue (arrière)
    t = Layer(OW, OH)
    m = poly_mask([(hx + 4, hy - 2), (hx + 12, hy - 5.5), (hx + 8, hy + 1.5), (hx + 4.5, hy + 3)])
    shade(t, m, O_SKIN, contrast=0.5)
    t.setf(hx + 6, hy, O_SKIN[1]); t.setf(hx + 7, hy - 1, O_SKIN[1]); t.setf(hx + 8, hy - 2, O_SKIN[1])
    put(c, t, OUT)
    t = Layer(OW, OH)
    t.set(hx + 9, hy - 2, '#e8b64a'); t.set(hx + 9, hy - 1, '#a8742a')  # anneau d'oreille
    put(c, t, None)
    # crête de cheveux noirs (pointes vers l'arrière)
    t = Layer(OW, OH)
    m = set()
    for (px, py, h) in ((hx - 3.5, hy - 6.2, 2.6), (hx - 0.5, hy - 7.0, 3.6), (hx + 3, hy - 6.8, 4.0), (hx + 6.2, hy - 5.0, 3.2)):
        m |= poly_mask([(px - 2.2, py + 1.5), (px + 0.4 + h * 0.5, py - h), (px + 2.4, py + 1.5)])
    shade(t, m, O_HAIR, contrast=0.5)
    put(c, t, OUT)
    # crâne
    t = Layer(OW, OH)
    m = ell_mask(hx + 0.5, hy - 0.5, 7.6, 7.0)
    round_shade(t, m, hx + 0.5, hy - 0.5, 7.6, 7.0, O_SKIN)
    put(c, t, OUT)
    # mâchoire inférieure (devant, plus large que le crâne)
    t = Layer(OW, OH)
    jx, jy = hx - 1.4, hy + 4.8 + (1 if roar else 0)
    m = ell_mask(jx, jy, 6.6, 3.3)
    round_shade(t, m, jx, jy - 1, 6.6, 3.8, O_SKIN, cuts=(-0.1, 0.25, 0.6, 0.9))
    put(c, t, OUT)
    mouth_y = int(jy - 2.4)
    if roar:
        c.rect(int(hx - 6), mouth_y - 1, 7, 2, INK)
        c.rect(int(hx - 5), mouth_y, 5, 1, O_MOUTH)
        c.set(int(hx - 3), mouth_y, '#d8506a'); c.set(int(hx - 2), mouth_y, '#d8506a')
    # défenses qui remontent de la mâchoire (avant : grande, arrière : petite)
    t = Layer(OW, OH)
    for (tx, h) in ((hx - 5.4, 4), (hx + 0.2, 3)):
        tx = int(round(tx))
        base = mouth_y + 1
        for k in range(h):
            y = base - k
            if k < h - 1:
                t.set(tx, y, TUSK[3] if k < h - 2 else TUSK[2])
                t.set(tx + 1, y, TUSK[1])
            else:
                t.set(tx, y, TUSK[2])
    put(c, t, OUT)
    # gros nez crochu (dépasse du profil, pend sur la lèvre)
    t = Layer(OW, OH)
    nx_, ny_ = hx - 8.2, hy + 1.8
    m = ell_mask(nx_, ny_, 2.8, 2.5) | poly_mask([(nx_ + 1, ny_ - 1.6), (hx - 4.6, hy - 3), (hx - 3, hy - 2), (nx_ + 2.4, ny_ + 1)])
    round_shade(t, m, nx_ + 0.5, ny_ - 1, 3.4, 3.6, O_NOSE, cuts=(-0.1, 0.25, 0.55, 0.85))
    t.setf(nx_ - 0.6, ny_ + 1.4, O_NOSE[0]); t.setf(nx_ + 0.6, ny_ + 1.4, O_NOSE[0])
    put(c, t, OUT)
    # arcade sourcilière épaisse et froncée
    ex, ey = int(hx - 4), int(hy - 1)
    t = Layer(OW, OH)
    m = poly_mask([(ex - 1.2, ey - 1.8), (ex + 2.6, ey - 0.6), (ex + 7.5, ey - 2.6), (ex + 7.5, ey - 0.4),
                   (ex + 2.6, ey + 0.6), (ex - 1.2, ey)])
    shade(t, m, O_SKIN, contrast=0.35, bias=0.12)
    put(c, t, O_SKIN[0])
    # yeux : enfoncés, lueur jaune, pupille vers la gauche, paupière froncée
    for (x0, w) in ((ex, 3), (ex + 5, 2)):
        for xx in range(w):
            c.set(x0 + xx, ey + 1, O_EYE)
            c.set(x0 + xx, ey + 2, O_SKIN[0])
        c.set(x0, ey + 1, INK)
        c.set(x0 + w - 1, ey + 1, '#e08a1a' if w == 3 else O_EYE)
    c.set(ex + 2, ey, INK); c.set(ex + 5, ey, INK)  # froncement
    # verrues
    c.set(hx + 3, hy - 3, O_WART); c.set(hx + 4, hy - 3, O_SKIN[3])
    c.set(hx + 2, jy + 1, O_WART)


def ogre_draw(f):
    """f : 0 repos (massue dressée devant), 1 pas de marche, 2 coup de massue au sol."""
    c = Canvas(OW, OH)
    G = OH - 1
    bob = (0, 1, 2)[f]
    lean = (0, 0, -3)[f]
    hx, hy = 21 + lean, 13 + bob + (1 if f == 2 else 0)
    tx, ty = 27 + lean * 0.4, 29 + bob
    # ---- trace du coup de massue (derrière tout)
    if f == 2:
        tr = Layer(OW, OH)
        cx_, cy_ = 15, 35
        for deg in range(-152, -96, 2):
            r = math.radians(deg)
            for rr, col in ((22, DUST[1]), (21, DUST[0]), (19, DUST[2])):
                if deg > -110 and rr == 19:
                    continue
                tr.set(cx_ + math.cos(r) * rr, cy_ + math.sin(r) * rr, col)
        put(c, tr, None)
    # ---- bras arrière
    if f == 0:
        far = [(36, 22 + bob), (40, 29), (39.5, 33)]
    elif f == 1:
        far = [(36, 23 + bob), (39, 30), (36.5, 34)]
    else:
        far = [(34, 24 + bob), (39, 28), (40, 23)]
    o_arm(c, far, O_SKIN_D)
    o_bracer(c, far[1], far[2], [LEATHER[0]] + LEATHER[:4])
    o_fist(c, far[2][0], far[2][1] + 2, O_SKIN_D, r=3.4)
    # ---- jambes
    if f == 0:
        legs = (((33, 38), (35, G), 0), ((23, 38), (21, G), 0))
    elif f == 1:
        legs = (((33, 39), (38, G), 0), ((23, 39), (17, G), 2))
    else:
        legs = (((33, 39), (38, G), 0), ((22, 39), (16, G), 0))
    o_leg(c, *legs[0][:2], O_SKIN_D, legs[0][2])
    # ---- torse voûté + bosse du dos
    t = Layer(OW, OH)
    m = ell_mask(tx, ty, 11.6, 10.6) | ell_mask(tx + 4, ty - 6, 7.2, 6.0)
    shade(t, m, O_SKIN, contrast=0.5, bias=-0.05)
    for (x, y) in ((tx + 6, ty - 7), (tx + 8, ty - 4), (tx + 3, ty - 9)):  # verrues
        t.setf(x, y, O_WART)
    put(c, t, OUT)
    # ---- pagne de peau
    t = Layer(OW, OH)
    by = ty + 7
    m = poly_mask([(tx - 11, by), (tx + 11, by - 1), (tx + 12, by + 5), (tx + 7, by + 8), (tx + 3, by + 6),
                   (tx - 1, by + 9), (tx - 5, by + 7), (tx - 9, by + 8), (tx - 12, by + 5)])
    shade(t, m, PELT, contrast=0.4)
    for x in range(int(tx - 10), int(tx + 11), 3):
        t.setf(x, by + 3 + (x % 2), PELT[1]); t.setf(x + 1, by + 4 + (x % 2), PELT[1])
    put(c, t, OUT)
    # ---- ceinture de cuir
    t = Layer(OW, OH)
    m = poly_mask([(tx - 12, by - 1.4), (tx + 12, by - 2.6), (tx + 12, by + 0.6), (tx - 12, by + 1.8)])
    shade(t, m, LEATHER, contrast=0.3)
    for x in range(int(tx - 11), int(tx + 12), 3):
        t.setf(x, by, LEATHER[1])
    put(c, t, OUT)
    # ---- ventre rebondi (déborde sur la ceinture)
    t = Layer(OW, OH)
    vx, vy = tx - 5, ty + 1.5
    m = ell_mask(vx, vy, 8.0, 7.0)
    round_shade(t, m, vx - 0.5, vy - 0.5, 8.4, 7.4, O_BELLY, cuts=(-0.15, 0.25, 0.58, 0.86))
    t.setf(vx - 1, vy + 3, O_BELLY[0]); t.setf(vx, vy + 3, O_BELLY[1])  # nombril
    for x in range(int(vx - 5), int(vx + 5)):  # pli de poitrine
        t.setf(x, vy - 3.5 + (1 if x > vx else 0), O_BELLY[1])
    put(c, t, O_SKIN[0])
    # ---- jambe avant
    o_leg(c, *legs[1][:2], O_SKIN, legs[1][2])
    # ---- tête
    o_head(c, hx, hy, 'roar' if f == 2 else 'idle')
    # ---- massue + bras avant
    if f == 0:
        hand = (10, 33)
        near, ang, ln = [(18, 24 + bob), (13, 29), hand], -102, 20
    elif f == 1:
        hand = (10.5, 34)
        near, ang, ln = [(18, 25 + bob), (13, 30), hand], -95, 20
    else:
        hand = (15, 35)
        dust = Layer(OW, OH)
        for (x, y, r) in ((10, G - 1.2, 2.2), (13.5, G - 0.8, 1.4)):
            m = ell_mask(x, y, r, r * 0.8)
            round_shade(dust, m, x, y, r, r * 0.8, DUST[::-1] + [WHITE])
        put(c, dust, DUST[3])
        near, ang, ln = [(19, 26 + bob), (17, 32), hand], 150, 16
    o_arm(c, near, O_SKIN)
    o_bracer(c, near[1], near[2])
    club(c, hand, ang, ln=ln)
    o_fist(c, near[2][0], near[2][1], O_SKIN, r=3.7)
    c = finish(c)
    if f == 2:
        for (x, y) in ((9, 37), (0, 35), (5, 34), (13, 40), (11, 34)):
            c.set(x, y, WHITE)
        for (x, y) in ((8, 36), (1, 34), (12, 39)):
            c.set(x, y, DUST[1])
    return c


def ogre_frames():
    return [ogre_draw(f) for f in range(3)]


# ---------------------------------------------------------------- export

def build():
    out = {}
    for name, frames in (('yeti', yeti_frames()), ('ogre', ogre_frames())):
        out[name] = (frames[0], {})
        out[name + '_b'] = (frames[1], {})
        out[name + '_atk'] = (frames[2], {})
    return out
