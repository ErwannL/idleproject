"""Décors v5 : calques de parallaxe par zone (PNG raccordables horizontalement).

Calques (ancrés sur la ligne du sol, sauf le plafond des grottes) :
  far    : lointain (montagnes, château…)     largeur 384, hauteur 84
  mid    : intermédiaire (arbres, bannières…) largeur 384, hauteur 70
  ground : sol (herbe, chemin)                largeur 128, hauteur 26 (4 px au-dessus de la ligne du sol)
  clouds : nuages                              largeur 384, hauteur 44 (ancré en haut)
  top    : plafond des grottes                 largeur 256, hauteur 30 (ancré en haut)
"""
import math
from lib import Canvas, ramp, shift, mix, rng, hex2rgb

OUT = '#1a1226'


class Wrap(Canvas):
    """Canvas dont l'axe x boucle (pour des calques raccordables)."""
    def set(self, x, y, c):
        x, y = int(round(x)) % self.w, int(round(y))
        if 0 <= y < self.h:
            self.px[y][x] = c

    def setf(self, x, y, c):
        x, y = int(round(x)) % self.w, int(round(y))
        if 0 <= y < self.h and self.px[y][x] is not None:
            self.px[y][x] = c

    def get(self, x, y):
        x = int(x) % self.w
        return self.px[y][x] if 0 <= y < self.h else None

    def inside(self, x, y):
        return 0 <= y < self.h


def noise1(x, period, seed, octaves=3):
    """Bruit périodique lisse (somme de sinus) sur [−1, 1]."""
    r = rng(seed)
    v, amp, tot = 0.0, 1.0, 0.0
    for o in range(octaves):
        k = (o + 1) * (1 + o)
        ph = r.random() * 6.283
        v += amp * math.sin(2 * math.pi * k * x / period + ph)
        tot += amp
        amp *= 0.5
    return v / tot


def ridge(c, base_y, amp, colors, seed, octaves=3, top_light=True, period=None, sharp=False):
    """Bande de relief remplie jusqu'en bas, ombrée par la pente."""
    period = period or c.w
    hs = []
    for x in range(c.w):
        n = noise1(x, period, seed, octaves)
        if sharp:
            n = 1 - abs(n) * 2
        hs.append(base_y - amp * n)
    for x in range(c.w):
        top = int(round(hs[x]))
        slope = hs[(x + 1) % c.w] - hs[x - 1]
        for y in range(max(0, top), c.h):
            depth = y - top
            if depth == 0:
                col = colors[-1] if top_light and slope >= 0 else colors[-2]
            elif depth < 3 and slope > 0.4:
                col = colors[-2]
            elif slope < -0.5 and depth < 6:
                col = colors[1]
            else:
                col = colors[2] if depth < 10 else colors[1] if depth < 24 else colors[0]
            c.set(x, y, col)
    return hs


def dither_band(c, y0, y1, col, density, seed):
    r = rng(seed)
    for y in range(y0, y1):
        for x in range(c.w):
            if c.get(x, y) is not None and r.random() < density:
                c.set(x, y, col)


# ------------------------------------------------------------------ objets de décor

def deciduous(c, x, base, size, leaf, trunk, seed):
    """Arbre feuillu : grappes de feuillage ombrées."""
    r = rng(seed)
    th = int(size * 0.55)
    for y in range(base - th, base + 1):
        for dx in range(-1, 2):
            c.set(x + dx, y, trunk[2] if dx < 0 else trunk[1] if dx == 0 else trunk[0])
    c.set(x - 2, base, trunk[1]); c.set(x + 2, base, trunk[0])
    cy = base - th - size * 0.35
    blobs = [(0, 0, size * 0.62, size * 0.48)]
    for _ in range(5):
        blobs.append((r.uniform(-0.55, 0.55) * size, r.uniform(-0.45, 0.25) * size, size * r.uniform(0.3, 0.42), size * r.uniform(0.26, 0.36)))
    blobs.sort(key=lambda b: b[1])
    for bx, by, rx, ry in blobs:
        c.shaded_ellipse(x + bx, cy + by, rx, ry, leaf, light=(-0.5, -0.85))
    # touffes de lumière tramées
    for _ in range(int(size * 1.4)):
        px = x + r.uniform(-0.6, 0.3) * size
        py = cy + r.uniform(-0.6, 0.0) * size
        if c.get(int(px) % c.w, int(py)) is not None:
            c.set(px, py, leaf[-1])


def pine(c, x, base, height, leaf, trunk, snow=None):
    tiers = max(3, height // 7)
    c.rect(x - 1, base - 4, 3, 5, trunk[1])
    c.set(x - 1, base - 4, trunk[2])
    for i in range(tiers):
        t = i / tiers
        top = base - 4 - height + int(height * t * 0.85)
        bot = top + int(height * 0.42)
        half = 2 + int((height * 0.33) * (0.35 + t * 0.75))
        for y in range(top, bot):
            k = (y - top) / max(1, bot - top)
            w = int(half * k)
            for dx in range(-w, w + 1):
                col = leaf[3] if dx < -w * 0.4 else leaf[2] if dx < w * 0.35 else leaf[1]
                if y == bot - 1:
                    col = leaf[0]
                c.set(x + dx, y, col)
            if snow and k < 0.5:
                for dx in range(-w, -w + max(1, w // 2)):
                    c.set(x + dx, y, snow)
        if snow:
            for dx in range(-half, half // 3):
                c.setf(x + dx, bot - 2, snow)


def castle(c, x, base, scale, wall, roof, window, banner):
    """Château lointain avec tours à toits pointus."""
    s = scale
    W_ = int(46 * s)
    left = x - W_ // 2
    wall_top = base - int(18 * s)
    c.rect(left, wall_top, W_, base - wall_top + 1, wall[2])
    for xx in range(left, left + W_, 3):
        c.rect(xx, wall_top - 2, 2, 2, wall[2])
    c.rect(left, wall_top, W_, 1, wall[3])
    for yy in range(wall_top + 3, base, 4):
        c.rect(left, yy, W_, 1, wall[1])
    # porte
    c.rect(x - 3, base - int(8 * s), 6, int(8 * s) + 1, wall[0])
    towers = [(-0.5, 1.15, 0.9), (0.5, 1.15, 0.9), (-0.18, 1.6, 1.0), (0.2, 1.45, 0.85), (0.0, 2.1, 1.1)]
    for fx, fh, fw in towers:
        tx = int(x + fx * W_)
        tw = int(8 * s * fw)
        top = base - int(18 * s * fh)
        for yy in range(top, base + 1):
            for xx in range(tx - tw // 2, tx + tw // 2 + 1):
                k = (xx - (tx - tw // 2)) / max(1, tw)
                c.set(xx, yy, wall[3] if k < 0.25 else wall[2] if k < 0.7 else wall[1])
        rh = int(tw * 1.3)
        for i in range(rh):
            w = int((tw / 2 + 1) * (i / rh))
            for xx in range(tx - w, tx + w + 1):
                c.set(xx, top - rh + i, roof[2] if xx < tx else roof[1])
        c.set(tx, top - rh - 1, roof[2])
        c.set(tx, top - rh - 2, banner); c.set(tx + 1, top - rh - 2, banner); c.set(tx + 2, top - rh - 1, banner)
        for wy in range(top + 3, base - 4, 6):
            c.set(tx, wy, window); c.set(tx, wy + 1, window)


def banner_pole(c, x, base, cloth, trim, pole):
    h = 30
    for y in range(base - h, base + 1):
        c.set(x, y, pole[1]); c.set(x + 1, y, pole[0])
    c.set(x, base - h - 1, trim[2]); c.set(x + 1, base - h - 1, trim[1])
    for y in range(base - h + 2, base - h + 16):
        k = y - (base - h + 2)
        for xx in range(x + 2, x + 10):
            if k > 11 and abs(xx - (x + 6)) < (k - 11):
                continue
            c.set(xx, y, cloth[2] if xx < x + 4 else cloth[1] if xx < x + 8 else cloth[0])
    for xx in range(x + 2, x + 10):
        c.set(xx, base - h + 2, trim[1])
    # emblème
    for y in range(base - h + 6, base - h + 11):
        c.set(x + 6, y, trim[2])
    for xx in range(x + 4, x + 9):
        c.set(xx, base - h + 8, trim[1])


def rock(c, x, base, w, h, colors):
    c.shaded_ellipse(x, base - h / 2, w / 2, h / 2, colors, light=(-0.6, -0.8))
    for xx in range(int(x - w / 2), int(x + w / 2) + 1):
        c.setf(xx, base, colors[0])


def crystal(c, x, base, h, colors):
    w = max(2, h // 3)
    pts = [(x - w, base), (x - w, base - h * 0.6), (x, base - h), (x + w, base - h * 0.6), (x + w, base)]
    c.poly(pts, colors[2])
    c.poly([(x - w, base), (x - w, base - h * 0.6), (x, base - h), (x, base)], colors[3])
    c.line(x, base - h + 1, x, base, colors[1])
    c.set(x - w + 1, base - h * 0.6, colors[4] if len(colors) > 4 else colors[3])


def cactus(c, x, base, h, colors):
    for y in range(base - h, base + 1):
        c.set(x - 1, y, colors[3]); c.set(x, y, colors[2]); c.set(x + 1, y, colors[1]); c.set(x + 2, y, colors[0])
    c.set(x, base - h - 1, colors[2]); c.set(x + 1, base - h - 1, colors[1])
    ay = base - int(h * 0.55)
    for xx in range(x - 5, x - 1):
        c.set(xx, ay, colors[2]); c.set(xx, ay + 1, colors[1])
    for y in range(ay - 6, ay + 1):
        c.set(x - 5, y, colors[3]); c.set(x - 4, y, colors[1])
    by = base - int(h * 0.4)
    for xx in range(x + 3, x + 7):
        c.set(xx, by, colors[2]); c.set(xx, by + 1, colors[1])
    for y in range(by - 5, by + 1):
        c.set(x + 6, y, colors[2]); c.set(x + 7, y, colors[0])


def dead_tree(c, x, base, h, colors, seed):
    r = rng(seed)
    c.rect(x - 1, base - h, 3, h + 1, colors[1])
    for y in range(base - h, base + 1):
        c.set(x - 1, y, colors[2])
    for i in range(4):
        y0 = base - h + 3 + i * (h // 5)
        d = -1 if i % 2 else 1
        length = r.randint(5, 10)
        c.line(x, y0, x + d * length, y0 - length * 0.7, colors[1])
        c.line(x + d * length, y0 - length * 0.7, x + d * (length + 3), y0 - length * 0.7 - 3, colors[0])


def grave(c, x, base, colors):
    c.rect(x - 4, base - 9, 9, 10, colors[2])
    c.ellipse(x + 0.5, base - 9, 4.5, 3, colors[2])
    for y in range(base - 11, base + 1):
        c.setf(x - 4, y, colors[3]); c.setf(x + 4, y, colors[1])
    c.rect(x - 1, base - 8, 3, 1, colors[0]); c.rect(x, base - 10, 1, 6, colors[0])


def pyramid(c, x, base, h, colors):
    for i in range(h):
        y = base - h + i
        w = i
        for xx in range(x - w, x + w + 1):
            c.set(xx, y, colors[3] if xx < x else colors[1])
        if i % 4 == 3:
            for xx in range(x - w, x + w + 1):
                c.set(xx, y, colors[2] if xx < x else colors[0])


def stalagmite(c, x, base, h, colors, down=False):
    w = max(2, h // 4)
    for i in range(h):
        y = base - i if not down else base + i
        k = 1 - i / h
        half = int(w * k + 0.5)
        for dx in range(-half, half + 1):
            c.set(x + dx, y, colors[3] if dx < 0 else colors[2] if dx == 0 else colors[1])


def flowers(c, x, base, cols, seed):
    r = rng(seed)
    for i in range(3):
        fx = x + r.randint(-3, 3)
        c.set(fx, base - 1, '#3f8a3a')
        c.set(fx, base - 2, cols[r.randint(0, len(cols) - 1)])


def cloud(c, x, y, w, colors):
    r = rng(int(x * 7 + y))
    puffs = [(0, 0, w * 0.3, w * 0.16)]
    for i in range(4):
        puffs.append((r.uniform(-0.35, 0.35) * w, r.uniform(-0.12, 0.02) * w, w * r.uniform(0.14, 0.22), w * r.uniform(0.1, 0.16)))
    for px, py, rx, ry in puffs:
        c.shaded_ellipse(x + px, y + py, rx, ry, colors, light=(-0.3, -0.95))
    for xx in range(int(x - w * 0.5), int(x + w * 0.5)):
        for yy in range(int(y + w * 0.06), int(y + w * 0.2)):
            if c.get(xx, yy) is not None:
                c.set(xx, yy, colors[1])


# ------------------------------------------------------------------ zones

def ground_layer(top, top_light, top_dark, soil, soil_dark, pebble, seed, path=None, tufts=None, extra=None):
    """Sol de 128×26 : 4 px de bordure d'herbe au-dessus de la ligne du sol (y=4)."""
    c = Wrap(128, 26)
    r = rng(seed)
    for x in range(128):
        edge = 3 + (1 if noise1(x, 128, seed, 2) > 0.3 else 0)
        for y in range(edge, 26):
            c.set(x, y, soil)
        for y in range(edge, 8):
            c.set(x, y, top if y > edge else top_light)
        c.set(x, 8, top_dark)
        if r.random() < 0.5:
            c.set(x, 9, top_dark)
    # touffes d'herbe dépassant au-dessus
    for _ in range(26):
        x = r.randint(0, 127)
        h = r.randint(1, 3)
        for y in range(4 - h, 4):
            c.set(x, y, top_light if y == 4 - h else top)
    if path:
        for x in range(128):
            for y in range(12, 22):
                if (y - 12) < 9 + noise1(x, 128, seed + 3, 2) * 1.5:
                    c.set(x, y, path[1])
            c.set(x, 12, path[2])
    if path:
        for _ in range(60):
            x, y = r.randint(0, 127), r.randint(13, 21)
            c.set(x, y, path[0] if r.random() < 0.6 else path[2])
    for _ in range(40):
        x, y = r.randint(0, 127), r.randint(11, 25)
        c.set(x, y, pebble); c.set(x + 1, y, shift(pebble, dl=-0.12))
    for _ in range(70):
        x, y = r.randint(0, 127), r.randint(10, 25)
        if c.get(x, y) == soil:
            c.set(x, y, soil_dark)
    if tufts:
        for _ in range(10):
            flowers(c, r.randint(0, 127), 5, tufts, r.randint(0, 9999))
    if extra:
        extra(c, r)
    return c


def zone_plains():
    far = Wrap(384, 84)
    ridge(far, 46, 9, ramp('#7f9fc4', 5, 0.18), 11, period=384, sharp=True)
    castle(far, 190, 74, 1.55, ramp('#a8b4cc', 4, 0.2), ramp('#4a72c8', 4, 0.24), '#ffe9a0', '#d84a4a')
    castle(far, 330, 74, 0.6, ramp('#9aa8c4', 4, 0.2), ramp('#5a7fc8', 4, 0.22), '#ffe9a0', '#d84a4a')
    ridge(far, 72, 6, ramp('#79b06c', 5, 0.2), 12, period=384)
    mid = Wrap(384, 70)
    hills = ramp('#4f9a3e', 5, 0.24)
    ridge(mid, 56, 6, hills, 21, period=384)
    leaf = ramp('#3f9a3a', 5, 0.28, 0.06)
    trunk = ramp('#6b4428', 3, 0.2)
    r = rng(5)
    xs = [18, 62, 100, 268, 300, 352]
    for i, x in enumerate(xs):
        deciduous(mid, x, 60, r.randint(16, 24), leaf, trunk, 100 + i)
    pole = ramp('#6b4428', 2, 0.15)
    banner_pole(mid, 130, 64, ramp('#2f62b8', 3, 0.22), ramp('#e8b64a', 3, 0.2), pole)
    banner_pole(mid, 296, 64, ramp('#2f62b8', 3, 0.22), ramp('#e8b64a', 3, 0.2), pole)
    for x in range(0, 384, 9):  # haies
        mid.shaded_ellipse(x + (x * 7 % 5), 66, 5, 3.4, ramp('#3a8a3a', 4, 0.2), light=(-0.4, -0.9))
    ground = ground_layer('#4f9a3e', '#8ad65c', '#3a7a30', '#8a5a33', '#6b4426', '#b08a5a', 31,
                          path=ramp('#b78a55', 3, 0.15), tufts=['#ff6fa8', '#ffe066', '#ffffff', '#7fc8ff'])
    return far, mid, ground


def zone_forest():
    far = Wrap(384, 84)
    ridge(far, 40, 8, ramp('#2f5a5a', 5, 0.14), 41, period=384, sharp=True)
    for i, x in enumerate(range(0, 384, 11)):
        pine(far, x + (i * 5 % 7), 70 + (i % 3), 26 + (i * 7 % 10), ramp('#2c5a4e', 4, 0.14), ramp('#3a2a20', 3, 0.1))
    mid = Wrap(384, 70)
    ridge(mid, 58, 4, ramp('#2f6a3a', 5, 0.2), 43, period=384)
    leaf = ramp('#2f7a3e', 5, 0.24, 0.05)
    trunk = ramp('#4a3020', 3, 0.18)
    for i, x in enumerate([10, 50, 88, 140, 190, 240, 280, 340]):
        if i % 3 == 1:
            deciduous(mid, x, 62, 22, leaf, trunk, 200 + i)
        else:
            pine(mid, x, 64, 44 + (i * 5 % 9), ramp('#25603a', 4, 0.2), trunk)
    ground = ground_layer('#2f6a3a', '#5aa04a', '#244f2c', '#4a3424', '#382618', '#6a5a48', 47,
                          tufts=['#e8384f', '#f2e6c8'])
    return far, mid, ground


def zone_caves():
    far = Wrap(384, 84)
    ridge(far, 30, 10, ramp('#2a2440', 5, 0.12), 61, period=384, sharp=True)
    r = rng(62)
    for _ in range(14):
        crystal(far, r.randint(0, 383), r.randint(60, 80), r.randint(6, 12), ramp('#7a5ad0', 5, 0.25))
    mid = Wrap(384, 70)
    ridge(mid, 58, 5, ramp('#3a3352', 5, 0.18), 63, period=384)
    for i, x in enumerate(range(8, 384, 34)):
        stalagmite(mid, x, 66, 18 + (i * 7 % 14), ramp('#5a5070', 4, 0.2))
        crystal(mid, x + 16, 66, 10 + (i * 5 % 8), ramp('#4fc8e8', 5, 0.28) if i % 2 else ramp('#c86ae8', 5, 0.28))
    top = Wrap(256, 30)
    for x in range(256):
        h = 4 + int(3 * (noise1(x, 256, 65, 3) + 1))
        for y in range(0, h):
            top.set(x, y, '#241f36' if y < h - 1 else '#3a3352')
    for i, x in enumerate(range(5, 256, 19)):
        stalagmite(top, x + (i * 3 % 5), 4, 10 + (i * 11 % 14), ramp('#4a4262', 4, 0.2), down=True)
    ground = ground_layer('#4a4262', '#6a6088', '#342e48', '#2e2840', '#221d30', '#5a5070', 67)
    return far, mid, ground, top


def zone_desert():
    far = Wrap(384, 84)
    ridge(far, 64, 5, ramp('#e0a868', 5, 0.18), 81, period=384)
    pyramid(far, 110, 66, 28, ramp('#d49a52', 4, 0.2))
    pyramid(far, 150, 68, 18, ramp('#d49a52', 4, 0.2))
    pyramid(far, 300, 66, 22, ramp('#d49a52', 4, 0.2))
    ridge(far, 74, 4, ramp('#e8b878', 5, 0.18), 82, period=384)
    mid = Wrap(384, 70)
    ridge(mid, 60, 5, ramp('#e2b06a', 5, 0.2), 83, period=384)
    for i, x in enumerate([30, 95, 170, 250, 330]):
        cactus(mid, x, 64, 16 + (i * 5 % 8), ramp('#4a9a4a', 4, 0.24))
    for i, x in enumerate([60, 210, 290]):
        rock(mid, x, 66, 14, 8, ramp('#b07a48', 4, 0.22))
    ground = ground_layer('#e8bb76', '#f6d79a', '#c8964e', '#d49c58', '#b88444', '#a87a48', 87,
                          extra=lambda c, r: [c.set(r.randint(0, 127), r.randint(10, 24), '#f0e6d0') for _ in range(6)])
    return far, mid, ground


def zone_mountains():
    far = Wrap(384, 84)
    hs = ridge(far, 40, 22, ramp('#6a84a8', 5, 0.2), 101, period=384, sharp=True)
    for x in range(384):
        top = int(round(hs[x]))
        for y in range(top, min(84, top + 6)):
            far.set(x, y, '#f4f8ff' if y - top < 4 else '#cfdcef')
    ridge(far, 70, 6, ramp('#9ab0c8', 5, 0.16), 102, period=384)
    mid = Wrap(384, 70)
    ridge(mid, 60, 4, ramp('#d8e4f2', 5, 0.14), 103, period=384)
    for i, x in enumerate(range(6, 384, 26)):
        pine(mid, x + (i * 7 % 9), 64, 30 + (i * 9 % 14), ramp('#2c5a50', 4, 0.2), ramp('#4a3020', 3, 0.18), snow='#f4f8ff')
    ground = ground_layer('#e6eef8', '#ffffff', '#b8c8de', '#9aaec8', '#8297b2', '#c8d6e8', 107)
    return far, mid, ground


def zone_cursed():
    far = Wrap(384, 84)
    ridge(far, 52, 10, ramp('#3a1d3a', 5, 0.12), 121, period=384, sharp=True)
    castle(far, 160, 74, 1.1, ramp('#2a1d2e', 4, 0.12), ramp('#4a1d30', 4, 0.14), '#ff7a3a', '#9a1d2a')
    ridge(far, 74, 5, ramp('#2a1630', 5, 0.12), 122, period=384)
    mid = Wrap(384, 70)
    ridge(mid, 60, 4, ramp('#3a2240', 5, 0.18), 123, period=384)
    for i, x in enumerate([20, 90, 160, 240, 320]):
        dead_tree(mid, x, 64, 26 + (i * 5 % 9), ramp('#3a2a2e', 3, 0.16), 300 + i)
    for i, x in enumerate([55, 130, 200, 280, 360]):
        grave(mid, x, 66, ramp('#6a6478', 4, 0.2))
    ground = ground_layer('#3a2448', '#5a3a68', '#2a1838', '#2a1a2e', '#1e1222', '#4a3a50', 127,
                          extra=lambda c, r: [c.set(x, y, '#ff6a2a') for x, y in
                                              [(r.randint(0, 127), r.randint(12, 24)) for _ in range(8)]])
    return far, mid, ground


def clouds_layer(colors, seed, alpha_dark=False):
    c = Wrap(384, 44)
    r = rng(seed)
    for i in range(6):
        cloud(c, i * 64 + r.randint(0, 30), r.randint(12, 26), r.randint(34, 56), colors)
    return c


ZONES = {
    'plains': (zone_plains, ramp('#ffffff', 4, 0.12)[::-1][::-1]),
    'forest': (zone_forest, ramp('#9ab8c0', 4, 0.12)),
    'caves': (zone_caves, None),
    'desert': (zone_desert, ramp('#fff0d8', 4, 0.1)),
    'mountains': (zone_mountains, ramp('#ffffff', 4, 0.12)),
    'cursed': (zone_cursed, ramp('#7a4a6a', 4, 0.14)),
}


def build(out_dir):
    import os
    os.makedirs(out_dir, exist_ok=True)
    written = []
    for i, (zone, (fn, cloud_cols)) in enumerate(ZONES.items()):
        layers = fn()
        names = ['far', 'mid', 'ground', 'top'][:len(layers)]
        for name, layer in zip(names, layers):
            path = f'{out_dir}/{zone}_{name}.png'
            layer.to_png(path)
            written.append(path)
        if cloud_cols:
            path = f'{out_dir}/{zone}_clouds.png'
            clouds_layer(cloud_cols, 500 + i).to_png(path)
            written.append(path)
    return written


if __name__ == '__main__':
    import sys
    print(len(build(sys.argv[1])), 'calques')
