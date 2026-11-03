"""Décors v6 : scènes de défilement denses façon side-scroller 16 bits.

Chaque zone est une pile de calques PNG raccordables horizontalement (canvas `Wrap`),
du plus lointain au plus proche. `build(out_dir)` écrit les PNG `<zone>_<calque>.png` et
renvoie le manifeste :

  {zone: {"sky": [hex haut -> bas], "ground": "#hex sous la ligne du sol",
          "layers": [{"file", "factor", "anchor", "y", "front", "drift"?}, ...]}}

  factor : vitesse de parallaxe (sol = 1)
  anchor : "ground" -> y = bord haut du calque relatif à groundY (négatif = au-dessus)
           "top"    -> y = depuis le haut de la vue
  front  : dessiné devant les personnages (bande basse, sous les pieds uniquement)
  drift  : défilement automatique en px/s (nuages)

Le dégradé du ciel couvre la vue de 0 à groundY, la couleur "ground" de groundY au bas de la vue,
puis les calques sont peints dans l'ordre.
"""
import math
from lib import Canvas, ramp, shift, mix, rng, hex2rgb

# ====================================================================== canvas

class Local(Canvas):
    """Canvas d'objet : accepte des coordonnées flottantes dans rect()."""
    def rect(self, x, y, w, h, c):
        x, y = int(round(x)), int(round(y))
        Canvas.rect(self, x, y, int(round(w)), int(round(h)), c)


class Wrap(Local):
    """Canvas dont l'axe x boucle (calques raccordables).
    `top` : marge ajoutée au-dessus (coordonnées y logiques de -top à h-1) pour les éléments qui
    montent plus haut que le cadre (colonnes, troncs, panaches) : visibles dans une vue très haute."""
    def __init__(self, w, h, top=0):
        Local.__init__(self, w, h + top)
        self.top = top

    def set(self, x, y, c):
        x, y = int(round(x)) % self.w, int(round(y)) + self.top
        if 0 <= y < self.h:
            self.px[y][x] = c

    def setf(self, x, y, c):
        x, y = int(round(x)) % self.w, int(round(y)) + self.top
        if 0 <= y < self.h and self.px[y][x] is not None:
            self.px[y][x] = c

    def get(self, x, y):
        y = int(y) + self.top
        return self.px[y][int(x) % self.w] if 0 <= y < self.h else None

    def inside(self, x, y):
        return -self.top <= y < self.h - self.top


def rgba_of(p):
    r, g, b = hex2rgb(p)
    return (r, g, b, int(p[7:9], 16) if len(p) == 9 else 255)


def save_png(c, path):
    """PNG indexé (avec transparence par entrée) si ≤ 255 couleurs, RGBA sinon."""
    from PIL import Image
    cols, idx = {}, []
    for row in c.px:
        for p in row:
            if p is None:
                idx.append(0)
                continue
            i = cols.get(p)
            if i is None:
                i = cols[p] = len(cols) + 1
            idx.append(i)
    if len(cols) <= 255:
        img = Image.new('P', (c.w, c.h))
        img.putdata(idx)
        pal, alphas = [0, 0, 0], [0]
        for p, _ in sorted(cols.items(), key=lambda kv: kv[1]):
            r, g, b, a = rgba_of(p)
            pal += [r, g, b]
            alphas.append(a)
        img.putpalette(pal)
        img.save(path, optimize=True, transparency=bytes(alphas))
    else:
        img = Image.new('RGBA', (c.w, c.h))
        inv = {i: rgba_of(p) for p, i in cols.items()}
        inv[0] = (0, 0, 0, 0)
        img.putdata([inv[i] for i in idx])
        img.save(path, optimize=True)


def haze(c, col, t0, t1=None, y0=0, y1=None, steps=10):
    """Mélange chaque pixel vers `col` (brume), de t0 (y0) à t1 (y1)."""
    t1 = t0 if t1 is None else t1
    top = getattr(c, 'top', 0)  # marge haute d'un Wrap : y0 / y1 sont en coordonnées logiques
    y1 = c.h - top if y1 is None else y1
    cache = {}
    for y in range(c.h):
        k = max(0.0, min(1.0, (y - top - y0) / max(1, y1 - y0)))
        t = round((t0 + (t1 - t0) * k) * steps) / steps
        if t <= 0:
            continue
        row = c.px[y]
        for x in range(c.w):
            p = row[x]
            if p is None:
                continue
            v = cache.get((p, t))
            if v is None:
                v = cache[(p, t)] = mix(p[:7], col, t) + p[7:]
            row[x] = v


def glow(c, x, y, r, col, a=0.32, rings=None, opaque=0.7):
    """Halo lumineux par paliers : semi-transparent sur le vide, éclaircit l'opaque."""
    rings = rings or max(2, min(6, int(r / 2.2)))
    for yy in range(int(y - r) - 1, int(y + r) + 2):
        if not c.inside(0, yy):
            continue
        for xx in range(int(x - r) - 1, int(x + r) + 2):
            d = math.hypot(xx + 0.5 - x, yy + 0.5 - y) / r
            if d >= 1:
                continue
            k = a * (math.ceil((1 - d) * rings) / rings) ** 1.6
            if k < 0.03:
                continue
            cur = c.get(xx, yy)
            if cur is None:
                if isinstance(c, Wrap) or c.inside(xx, yy):
                    c.set(xx, yy, col + '%02x' % int(255 * k))
            elif len(cur) == 9:
                a0 = int(cur[7:9], 16) / 255
                na = 1 - (1 - a0) * (1 - k)
                c.set(xx, yy, mix(cur[:7], col, k / na) + '%02x' % int(255 * na))
            else:
                c.set(xx, yy, mix(cur, col, k * opaque))


class PadLocal(Local):
    """Canvas d'objet à marge invisible : `fn` dessine en coordonnées locales (0..w-1, 0..h-1) comme
    sur un Local, mais ce qui déborde du cadre (cimes, drapeaux, branches) est conservé au lieu d'être coupé."""
    def __init__(self, w, h, pad=48):
        Canvas.__init__(self, w + 2 * pad, h + 2 * pad)
        self.rw, self.rh = self.w, self.h
        self.w, self.h, self.pad = w, h, pad

    def set(self, x, y, c):
        x, y = int(round(x)) + self.pad, int(round(y)) + self.pad
        if 0 <= x < self.rw and 0 <= y < self.rh:
            self.px[y][x] = c

    def setf(self, x, y, c):
        x, y = int(round(x)) + self.pad, int(round(y)) + self.pad
        if 0 <= x < self.rw and 0 <= y < self.rh and self.px[y][x] is not None:
            self.px[y][x] = c

    def get(self, x, y):
        x, y = int(round(x)) + self.pad, int(round(y)) + self.pad
        return self.px[y][x] if 0 <= x < self.rw and 0 <= y < self.rh else None

    def inside(self, x, y):
        return -self.pad <= x < self.w + self.pad and -self.pad <= y < self.h + self.pad

    def raw(self):
        r = Canvas(self.rw, self.rh)
        r.px = self.px
        return r


def place(c, x, base, w, h, fn, *args, outline=True, ol=None, **kw):
    """Dessine un objet sur un petit canvas local (contour sélectif) puis le colle.
    `fn(t, lx, lb, ...)` reçoit le centre x et la base locaux ; les points renvoyés
    (lumières…) sont convertis en coordonnées du calque. Le canvas local a une marge invisible :
    un objet qui dépasse de la boîte (w, h) n'est jamais rogné."""
    w, h = int(w), int(h)
    t = PadLocal(w, h)
    lx, lb = w // 2, h - 2
    res = fn(t, lx, lb, *args, **kw)
    raw = t.raw()
    if outline:
        raw.outline(ol)
    ox, oy = int(x) - lx, int(base) - lb
    c.paste(raw, ox - t.pad, oy - t.pad)
    if res:
        return [(p[0] + ox, p[1] + oy) + tuple(p[2:]) for p in res]
    return []


def R(base, n=5, spread=0.3, hue=0.05):
    return ramp(base, n, spread, hue)


# ====================================================================== relief

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


def ridge(c, base_y, amp, colors, seed, octaves=3, period=None, sharp=False, bottom=None):
    """Bande de relief remplie jusqu'en bas, ombrée par la pente (lumière en haut à gauche)."""
    period = period or c.w
    bottom = c.h if bottom is None else bottom
    hs = []
    for x in range(c.w):
        n = noise1(x, period, seed, octaves)
        if sharp:
            n = 1 - abs(n) * 2
        hs.append(base_y - amp * n)
    for x in range(c.w):
        top = int(round(hs[x]))
        slope = hs[(x + 1) % c.w] - hs[x - 1]
        for y in range(max(0, top), bottom):
            d = y - top
            if d == 0:
                col = colors[-1] if slope <= 0.2 else colors[-2]
            elif slope < -0.35 and d < 4 - slope * 3:
                col = colors[-2]
            elif slope > 0.35 and d < 8:
                col = colors[1]
            else:
                col = colors[2] if d < 12 else colors[1] if d < 30 else colors[0]
            c.set(x, y, col)
    return hs


def peaks(c, base_y, amp, rock, snow, seed, snow_line, period=None):
    """Montagnes pointues à facettes : flanc gauche éclairé, flanc droit ombré, neige en tête."""
    period = period or c.w
    hs = [base_y - amp * (1 - abs(noise1(x, period, seed, 3)) * 2) for x in range(c.w)]
    r = rng(seed + 7)
    for x in range(c.w):
        top = int(round(hs[x]))
        slope = hs[(x + 1) % c.w] - hs[x - 1]
        lit = slope < -0.15
        shade = slope > 0.15
        for y in range(max(0, top), c.h):
            d = y - top
            if d == 0:
                col = rock[4] if lit else rock[2]
            elif d < amp * 0.9:
                col = rock[3] if lit else rock[1] if shade else rock[2]
                if lit and d > amp * 0.55 and (x + y) % 2 == 0:
                    col = rock[2]
            else:
                col = rock[2] if d < amp * 1.4 else rock[1]
            c.set(x, y, col)
        if top < snow_line:
            depth = int((snow_line - top) * 0.6) + r.randint(0, 3)
            for y in range(top, top + depth):
                c.set(x, y, snow[-1] if lit else snow[-2] if shade else snow[-1])
            c.set(x, top + depth, snow[0])
    return hs


# ====================================================================== objets

def foliage(c, cx, cy, rx, ry, leaf, seed, n=None, rim=True):
    """Feuillage en grappes ombrées (lumière haut-gauche) avec petits reflets de feuilles."""
    r = rng(seed)
    n = n or max(5, int((rx + ry) / 3.0))
    clumps = [(0.0, ry * 0.12, rx * 0.64, ry * 0.64)]
    for _ in range(n):
        a = r.uniform(0, 2 * math.pi)
        d = r.uniform(0.3, 0.78)
        s = r.uniform(0.3, 0.44)
        clumps.append((math.cos(a) * d * rx * 0.72, math.sin(a) * d * ry * 0.66, rx * s + 1, ry * s * 1.05 + 1))
    clumps.sort(key=lambda b: -(b[1] + b[0] * 0.35))
    for bx, by, crx, cry in clumps:
        lt = -(bx / rx * 0.45 + by / ry * 0.9)
        cols = leaf[1:] if lt > 0.3 else leaf[:4] if lt > -0.3 else leaf[:3]
        if rim:
            c.ellipse(cx + bx, cy + by, crx + 0.9, cry + 0.9, leaf[0])
        c.shaded_ellipse(cx + bx, cy + by, crx, cry, cols, light=(-0.55, -0.83))
    for _ in range(n * 2):
        bx, by, crx, cry = r.choice(clumps)
        if by > ry * 0.1:
            continue
        hx = cx + bx - crx * 0.3 + r.uniform(-1.5, 1.5)
        hy = cy + by - cry * 0.55 + r.uniform(-0.5, 1)
        if c.get(int(hx), int(hy)) is not None:
            c.set(hx, hy, leaf[-1]); c.set(hx + 1, hy, leaf[-1])
            c.set(hx - 1, hy + 1, leaf[-2]); c.set(hx + 2, hy + 1, leaf[-2])


def round_tree(c, x, base, size, leaf, trunk, seed, roots=True, tk=0.7):
    r = rng(seed)
    th = int(size * tk)
    tw = max(3, int(size * 0.17))
    x0 = x - tw // 2
    for y in range(base - th - 6, base + 1):
        for i in range(tw):
            k = i / max(1, tw - 1)
            c.set(x0 + i, y, trunk[3] if k < 0.25 else trunk[2] if k < 0.7 else trunk[1])
    if roots:
        for i in range(4):
            e = 4 - i
            for d in range(1, e + 1):
                c.set(x0 - d, base - i, trunk[2] if d < e else trunk[1])
                c.set(x0 + tw - 1 + d, base - i, trunk[1] if d < e else trunk[0])
    for _ in range(th // 3):
        xx = x0 + r.randint(0, tw - 1)
        yy = r.randint(base - th, base - 3)
        c.set(xx, yy, trunk[0]); c.set(xx, yy + 1, trunk[0])
    if tk > 0.5:
        c.line(x, base - th + 3, x - size * 0.28, base - th - size * 0.16, trunk[2], 2)
        c.line(x, base - th + 1, x + size * 0.3, base - th - size * 0.2, trunk[1], 2)
    foliage(c, x, base - th - size * 0.3, size * 0.62, size * 0.48, leaf, seed + 1)


def bush(c, x, base, w, h, leaf, seed):
    foliage(c, x, base - h * 0.5, w * 0.5, h * 0.55, leaf, seed, n=max(3, int(w / 5)))
    for xx in range(int(x - w * 0.45), int(x + w * 0.45)):
        c.setf(xx, base, leaf[0])


def pine(c, x, base, h, leaf, trunk, snow=None, seed=0):
    """Sapin à étages tombants ; `snow` (rampe claire) poudre les étages par le haut-gauche."""
    c.rect(x - 1, base - 5, 3, 6, trunk[1])
    c.set(x - 1, base - 5, trunk[2]); c.set(x - 1, base - 4, trunk[2])
    tiers = max(3, h // 8)
    top = base - 4 - h
    for i in range(tiers):
        t0 = i / tiers
        ty = top + int(h * t0 * 0.78)
        by = top + int(h * (t0 + 1 / tiers) * 0.78) + int(h * 0.16)
        maxw = 1.5 + h * 0.34 * ((i + 1.5) / (tiers + 0.5))
        for y in range(ty, by + 1):
            k = (y - ty) / max(1, by - ty)
            w = maxw * (k ** 0.85)
            iw = int(w)
            for dx in range(-iw, iw + 1):
                s = dx / max(1.0, w)
                col = leaf[3] if s < -0.4 else leaf[2] if s < 0.3 else leaf[1]
                if y == by and (dx + i) % 3 == 0:
                    col = leaf[0]
                c.set(x + dx, y, col)
            if snow and k < 0.75:
                # neige sur le bord haut de l'étage (côté gauche surtout)
                if iw > 0:
                    c.set(x - iw, y, snow[-1])
                    if dx > -iw:
                        c.set(x - iw + 1, y, snow[-2])
                    if k < 0.35:
                        c.set(x + iw, y, snow[-2])
        for dx in range(-int(maxw) + 1, int(maxw), 3):
            c.set(x + dx, by + 1, leaf[1])
        if snow:
            for dx in range(-int(maxw * 0.9), int(maxw * 0.4)):
                if c.get(x + dx, by - 1) is not None and (dx + i) % 4 != 0:
                    c.set(x + dx, by - 1, snow[-2])
                    c.set(x + dx, by - 2, snow[-1])
    if snow:
        c.set(x, top - 1, snow[-1])


def castle(c, x, base, s, wall, roof, window, flag, spiky=False):
    """Château : courtine crénelée, donjon et tours à toits pointus."""
    W_ = int(46 * s)
    left = x - W_ // 2
    wall_top = base - int(18 * s)
    for yy in range(wall_top, base + 1):
        for xx in range(left, left + W_):
            c.set(xx, yy, wall[2] if (yy - wall_top) % 4 else wall[1])
    for xx in range(left, left + W_, 3):
        c.rect(xx, wall_top - 2, 2, 2, wall[2])
        c.set(xx, wall_top - 2, wall[3])
    c.rect(left, wall_top, W_, 1, wall[3])
    gw = max(3, int(5 * s))
    c.rect(x - gw // 2, base - int(9 * s), gw, int(9 * s) + 1, wall[0])
    c.ellipse(x, base - int(9 * s), gw / 2, gw / 2.5, wall[0])
    towers = [(-0.5, 1.2, 0.9), (0.5, 1.15, 0.9), (-0.2, 1.65, 1.0), (0.22, 1.5, 0.85), (0.0, 2.15, 1.15)]
    lights = []
    for fx, fh, fw in towers:
        tx = int(x + fx * W_)
        tw = max(4, int(8 * s * fw))
        top = base - int(18 * s * fh)
        for yy in range(top, base + 1):
            for xx in range(tx - tw // 2, tx + tw // 2 + 1):
                k = (xx - (tx - tw // 2)) / max(1, tw)
                c.set(xx, yy, wall[3] if k < 0.3 else wall[2] if k < 0.72 else wall[1])
        for xx in range(tx - tw // 2 - 1, tx + tw // 2 + 2):
            c.set(xx, top, wall[3] if xx <= tx else wall[2])
        rh = int(tw * (1.9 if spiky else 1.3))
        for i in range(rh):
            w = (tw / 2 + 1) * (i / rh)
            for xx in range(int(tx - w), int(tx + w) + 1):
                c.set(xx, top - rh + i, roof[3] if xx < tx else roof[1])
            if spiky and i == rh - 1:
                c.set(tx - int(w) - 1, top - rh + i, roof[1]); c.set(tx + int(w) + 1, top - rh + i, roof[0])
        c.set(tx, top - rh - 1, roof[2]); c.set(tx, top - rh - 2, roof[2])
        if flag:
            c.set(tx + 1, top - rh - 2, flag); c.set(tx + 2, top - rh - 2, flag); c.set(tx + 1, top - rh - 1, flag)
        for wy in range(top + 3, base - 5, max(4, int(6 * s))):
            c.set(tx, wy, window); c.set(tx, wy + 1, window)
            lights.append((tx, wy))
    return lights


def banner(c, x, base, h, cloth, trim, pole, emblem='crown'):
    """Bannière sur mât : tissu à queue d'aronde, galon et emblème dorés."""
    for y in range(base - h, base + 1):
        c.set(x, y, pole[2]); c.set(x + 1, y, pole[1])
    c.set(x, base - h - 1, trim[2]); c.set(x + 1, base - h - 1, trim[1]); c.set(x, base - h - 2, trim[2])
    for xx in range(x - 1, x + 13):
        c.set(xx, base - h + 2, pole[2]); c.set(xx, base - h + 3, pole[0])
    c.set(x + 12, base - h + 1, trim[2])
    L = int(h * 0.58)
    cw = 10
    cx0 = x + 2
    y0 = base - h + 4
    for yy in range(L):
        for i in range(cw):
            if yy > L - 5 and abs(i - (cw - 1) / 2) < (yy - (L - 5)) * 1.2:
                continue
            col = cloth[3] if i < 2 else cloth[2] if i < 7 else cloth[1]
            if i in (0, cw - 1) or yy == 0:
                col = trim[1] if yy < L - 4 else col
            if yy == 1:
                col = trim[0] if 0 < i < cw - 1 else col
            c.set(cx0 + i, y0 + yy, col)
    ex, ey = cx0 + cw // 2, y0 + L // 2 - 1
    if emblem == 'crown':
        for dx in (-2, 0, 2):
            c.set(ex + dx - 1 + 1, ey - 2, trim[2])
        for dx in range(-2, 3):
            c.set(ex + dx, ey - 1, trim[2]); c.set(ex + dx, ey, trim[1])
        for dx in range(-1, 2):
            c.set(ex + dx, ey + 1, trim[1])
        c.set(ex, ey + 2, trim[0])
    elif emblem == 'skull':
        for dx in range(-1, 2):
            c.set(ex + dx, ey - 1, trim[2]); c.set(ex + dx, ey, trim[1])
        c.set(ex - 1, ey, cloth[0]); c.set(ex + 1, ey, cloth[0]); c.set(ex, ey + 1, trim[1])
    else:  # flocon / losange
        for d in range(3):
            c.set(ex - d, ey - 2 + d, trim[2]); c.set(ex + d, ey - 2 + d, trim[1])
            c.set(ex - d, ey + 2 - d, trim[1]); c.set(ex + d, ey + 2 - d, trim[0])


def lantern(c, x, y, metal, light):
    """Lanterne (x, y = centre) ; renvoie le point lumineux."""
    c.rect(x - 2, y - 3, 5, 7, metal[1])
    c.rect(x - 1, y - 2, 3, 5, light[1])
    c.set(x - 1, y - 2, light[2]); c.set(x, y - 1, light[2]); c.set(x, y, light[2])
    c.rect(x - 2, y - 4, 5, 1, metal[2]); c.set(x, y - 5, metal[2])
    c.rect(x - 1, y + 4, 3, 1, metal[0])
    return [(x, y)]


def lantern_post(c, x, base, h, wood, metal, light):
    for y in range(base - h, base + 1):
        c.set(x, y, wood[3]); c.set(x + 1, y, wood[2]); c.set(x + 2, y, wood[1])
    for xx in range(x, x + 10):
        c.set(xx, base - h, wood[2]); c.set(xx, base - h + 1, wood[1])
    c.line(x + 2, base - h + 6, x + 6, base - h + 2, wood[1])
    c.set(x + 8, base - h + 2, metal[0]); c.set(x + 8, base - h + 3, metal[0])
    c.rect(x - 1, base - 1, 5, 2, wood[1])
    return lantern(c, x + 8, base - h + 8, metal, light)


def fence(c, x0, length, base, h, wood, snow=None, step=7):
    for x in range(x0, x0 + length):
        for ry in (base - int(h * 0.78), base - int(h * 0.38)):
            c.set(x, ry, wood[3]); c.set(x, ry + 1, wood[1])
            if snow and (x * 7) % 5:
                c.set(x, ry - 1, snow[-1])
    for px in range(x0, x0 + length - 1, step):
        for y in range(base - h, base + 1):
            c.set(px, y, wood[3]); c.set(px + 1, y, wood[2]); c.set(px + 2, y, wood[1])
        c.set(px + 1, base - h - 1, wood[2])
        c.set(px + 1, base - h + 3, wood[0])
        if snow:
            c.set(px, base - h - 1, snow[-1]); c.set(px + 1, base - h - 2, snow[-1]); c.set(px + 2, base - h - 1, snow[-2])


def rope_fence(c, x0, length, base, h, wood, rope, step=12):
    posts = list(range(x0, x0 + length, step))
    for i, px in enumerate(posts):
        for y in range(base - h, base + 1):
            c.set(px, y, wood[2]); c.set(px + 1, y, wood[1])
        c.set(px, base - h - 1, wood[3])
        if i + 1 < len(posts):
            nx = posts[i + 1]
            for xx in range(px + 2, nx):
                t = (xx - px) / (nx - px)
                sag = 3 * math.sin(math.pi * t)
                c.set(xx, base - h + 2 + sag, rope[1])
                c.set(xx, base - h + 8 + sag * 0.7, rope[0])


def mushroom(c, x, base, s, cap, stem, dots='#fff6e8'):
    c.rect(x - 1, base - s, 2 + (s > 3), s + 1, stem[1])
    c.set(x - 1, base - s, stem[2])
    c.shaded_ellipse(x + 0.5, base - s, s * 0.9 + 1, s * 0.55 + 0.5, cap)
    c.set(x - 1, base - s - 1, dots)
    if s > 3:
        c.set(x + 2, base - s, dots)


def flowers(c, x, base, cols, seed, n=3):
    r = rng(seed)
    for _ in range(n):
        fx = x + r.randint(-3, 3)
        hh = r.randint(1, 3)
        for y in range(base - hh, base):
            c.set(fx, y, '#3f8a3a')
        c.set(fx, base - hh - 1, r.choice(cols))


def rock(c, x, base, w, h, colors):
    c.shaded_ellipse(x, base - h / 2, w / 2, h / 2, colors, light=(-0.6, -0.8))


def crystal(c, x, base, h, w, tilt, cols):
    """Cristal facetté (cols : 5 tons sombre -> clair)."""
    tx = x + tilt
    pts = [(x - w, base), (x - w + tilt * 0.75, base - h * 0.72), (tx, base - h),
           (x + w + tilt * 0.75, base - h * 0.72), (x + w, base)]
    c.poly(pts, cols[1])
    c.poly([(x - w, base), (x - w + tilt * 0.75, base - h * 0.72), (tx, base - h), (x + tilt * 0.3, base)], cols[3])
    c.line(tx, base - h + 1, x + tilt * 0.3, base, cols[4])
    c.line(x - w + tilt * 0.75 + 1, base - h * 0.72, tx, base - h + 1, cols[4])
    c.set(tx, base - h, '#ffffff')


def crystal_cluster(c, x, base, h, cols, seed):
    r = rng(seed)
    crystal(c, x - h * 0.35, base, h * 0.55, max(1.5, h * 0.12), -h * 0.25, cols)
    crystal(c, x + h * 0.38, base, h * 0.5, max(1.5, h * 0.11), h * 0.22, cols)
    crystal(c, x, base, h, max(2, h * 0.17), r.uniform(-1, 1), cols)
    if h > 10:
        crystal(c, x + h * 0.15, base, h * 0.35, max(1.5, h * 0.09), h * 0.15, cols)
    return [(x, base - h * 0.5, h)]


def waterfall(c, x, y0, y1, w, cols, seed, foam=True):
    """Chute d'eau à stries verticales (cols : sombre -> clair, ≥ 4)."""
    r = rng(seed)
    for i in range(w):
        off = r.randint(0, 30)
        L = r.randint(5, 11)
        base_col = cols[1] if i in (0, w - 1) else cols[2]
        for y in range(y0, y1):
            k = (y + off) % L
            col = cols[3] if k == 0 or (k == 1 and i % 2) else base_col
            c.set(x + i, y, col)
    for i in range(-1, w + 1):
        c.set(x + i, y0, cols[3])
    if foam:
        for k in range(w // 2 + 2):
            c.ellipse(x + r.uniform(-2, w + 1), y1 - 1, r.uniform(1.5, 3.2), 1.6, cols[3])
        for k in range(w):
            c.set(x + r.randint(-2, w + 1), y1 - 2, '#ffffff')


def water(c, x0, x1, y0, y1, cols, seed):
    r = rng(seed)
    for x in range(x0, x1):
        for y in range(y0, y1):
            d = y - y0
            c.set(x, y, cols[3] if d == 0 else cols[2] if d < 3 else cols[1] if d < 8 else cols[0])
    for _ in range((x1 - x0) * (y1 - y0) // 30):
        x, y = r.randint(x0, x1 - 4), r.randint(y0 + 2, y1 - 1)
        L = r.randint(2, 5)
        for i in range(L):
            c.set(x + i, y, cols[3] if y - y0 < 5 else cols[2])


def lily(c, x, y, leaf, flower=None):
    c.ellipse(x, y, 3.5, 1.3, leaf[2])
    for xx in range(int(x - 3), int(x + 3)):
        c.set(xx, y + 1, leaf[1])
    c.set(x + 1, y, leaf[0]); c.set(x + 2, y - 1, None if False else leaf[3])
    c.set(x - 2, y - 1, leaf[3])
    if flower:
        c.set(x - 1, y - 1, flower); c.set(x - 1, y - 2, flower); c.set(x, y - 1, '#ffffff')


def cliff(c, x0, x1, top, bot, rock_c, seed, cap=None, drips=True, icicles=None):
    """Falaise à facettes verticales, chapeau (herbe/neige) et coulures."""
    r = rng(seed)
    xs = x0
    while xs < x1:
        fw = r.randint(4, 8)
        t2 = top + r.randint(0, 2)
        for xx in range(xs, min(x1, xs + fw)):
            i = xx - xs
            col = rock_c[3] if i == 0 else rock_c[2] if i < fw - 2 else rock_c[1]
            for y in range(t2, bot):
                dk = (y - top) / max(1, bot - top)
                c.set(xx, y, col if dk < 0.65 else rock_c[max(0, [3, 2, 1][min(2, i if i < 2 else 2)] - 1)])
        for _ in range(max(1, (bot - top) // 9)):
            y = r.randint(top + 4, bot - 2)
            for xx in range(xs, min(x1, xs + fw)):
                c.set(xx, y, rock_c[0])
                c.set(xx, y + 1, rock_c[3] if xx == xs else rock_c[2])
        xs += fw
    for y in range(top, bot):
        c.set(x0, y, rock_c[4]); c.set(x1 - 1, y, rock_c[0])
    if cap:
        for xx in range(x0 - 2, x1 + 2):
            for y in range(top - 2, top + 2):
                c.set(xx, y, cap[4] if y == top - 2 else cap[3] if y < top + 1 else cap[2])
            if drips:
                d = r.randint(0, 3) + (r.random() < 0.15) * r.randint(2, 5)
                for k in range(d):
                    c.set(xx, top + 2 + k, cap[2] if k < d - 1 else cap[1])
            if icicles and r.random() < 0.3:
                L = r.randint(2, 6)
                for k in range(L):
                    c.set(xx, top + 2 + k, icicles[-1] if k < L // 2 else icicles[-2])


def mesa(c, x0, x1, top, bot, rock_c, seed):
    """Butte à strates horizontales, flanc droit ombré, éboulis à la base."""
    r = rng(seed)
    bands = []
    y = top
    while y < bot:
        bh = r.randint(3, 7)
        bands.append((y, bh))
        y += bh
    w = x1 - x0
    for x in range(x0 - 8, x1 + 8):
        for y in range(top, bot):
            k = (y - top) / max(1, bot - top)
            spread = max(0.0, k - 0.6) / 0.4 * 8
            jag = int(2 * noise1(y, 64, seed, 2))
            if x < x0 - spread + jag or x > x1 + spread + jag:
                continue
            bi = next(i for i, (by, bh) in enumerate(bands) if by <= y < by + bh)
            fx = (x - x0) / max(1, w)
            col = rock_c[3] if bi % 2 == 0 else rock_c[2]
            if fx > 0.68:
                col = rock_c[1] if bi % 2 == 0 else rock_c[0]
            if y == bands[bi][0]:
                col = rock_c[4] if fx < 0.68 else rock_c[2]
            if y == top:
                col = rock_c[4]
            c.set(x, y, col)
    for _ in range(w // 6):
        xx = r.randint(x0 + 2, x1 - 2)
        for y in range(top + 2, top + r.randint(6, 16)):
            c.setf(xx, y, rock_c[1])


def arch(c, cx, base, w, h, th, rock_c, seed):
    """Arche rocheuse (anneau supérieur d'ellipse), strates horizontales."""
    rx, ry = w / 2, h
    for y in range(int(base - h) - 1, int(base) + 1):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            dx, dy = (x + 0.5 - cx), (y + 0.5 - base)
            if (dx / rx) ** 2 + (dy / ry) ** 2 > 1:
                continue
            if (dx / (rx - th)) ** 2 + (dy / (ry - th)) ** 2 < 1:
                continue
            band = int(y - base) // 4
            col = rock_c[3] if band % 2 else rock_c[2]
            if dx > rx * 0.45:
                col = rock_c[1]
            c.set(x, y, col)


def sun(c, x, y, r, cols):
    glow(c, x, y, r * 2.6, cols[0], a=0.28, rings=4)
    c.ellipse(x, y, r, r, cols[1])
    c.ellipse(x - 1, y - 1, r * 0.8, r * 0.8, cols[2])
    c.ellipse(x - 2, y - 2, r * 0.45, r * 0.45, cols[3])


def skull(c, x, base, s, bone):
    """Crâne géant de bête, couché, museau vers la droite, corne recourbée."""
    horn(c, (x - 3 * s, base - 10 * s), (x - 17 * s, base - 12 * s), (x - 13 * s, base - 25 * s), 2.6 * s, 0.6, bone)
    c.shaded_ellipse(x - 2 * s, base - 7 * s, 8 * s, 6.5 * s, bone)
    c.poly([(x, base - 12 * s), (x + 15 * s, base - 7.5 * s), (x + 17 * s, base - 4 * s), (x + 16 * s, base), (x + 1 * s, base)], bone[2])
    c.poly([(x, base - 12 * s), (x + 15 * s, base - 7.5 * s), (x + 5 * s, base - 8 * s)], bone[3])
    c.line(x + 2 * s, base - 3 * s, x + 16 * s, base - 3 * s, bone[0])
    for i in range(int(4 * s), int(15 * s), 2):
        c.set(x + i, base - 3 * s + 1, bone[4]); c.set(x + i + 1, base - 3 * s - 1, bone[4])
    c.ellipse(x + 1 * s, base - 8 * s, 2.8 * s, 2.4 * s, bone[0])
    c.ellipse(x + 1.4 * s, base - 7.6 * s, 1.6 * s, 1.4 * s, '#2a1208')
    c.ellipse(x + 13 * s, base - 6 * s, 1.0 * s, 0.8 * s, bone[0])
    c.line(x - 7 * s, base - 4 * s, x - 3 * s, base - 2 * s, bone[1])
    c.line(x + 6 * s, base - 9 * s, x + 9 * s, base - 6 * s, bone[1])


def ribcage(c, x, base, s, bone, n=5):
    """Cage thoracique : arches osseuses décroissantes le long d'une colonne."""
    for i in range(n):
        k = i / max(1, n - 1)
        cx = x - 16 * s + i * 8 * s
        h = (15 - 6 * k) * s
        rw = (6 - 2 * k) * s
        for t in range(0, 40):
            a = math.pi * t / 39
            px = cx + math.cos(math.pi - a) * rw
            py = base - math.sin(a) * h
            c.ellipse(px, py, 1.2 * s, 1.2 * s, bone[3] if a < 1.4 else bone[2] if a < 2.2 else bone[1])
    for xx in range(int(x - 20 * s), int(x + 22 * s)):
        y = base - (15 - 6 * (xx - x + 20 * s) / (42 * s)) * s
        c.set(xx, y - 1, bone[4]); c.set(xx, y, bone[2]); c.set(xx, y + 1, bone[1])


def watchtower(c, x, base, h, wood, flag):
    """Tour de guet en bois : pieds croisés, plate-forme, toit, fanion rouge."""
    w = 14
    pt = base - h + 12
    for side in (-1, 1):
        c.line(x + side * (w // 2 + 2), base, x + side * (w // 2 - 1), pt, wood[2 if side < 0 else 1], 2)
    c.line(x - 3, base, x - 2, pt, wood[1], 1)
    c.line(x + 3, base, x + 2, pt, wood[1], 1)
    seg = (base - pt) // 3
    for i in range(3):
        ya, yb = pt + i * seg, pt + (i + 1) * seg
        c.line(x - w // 2, ya + 1, x + w // 2, yb - 1, wood[0])
        c.line(x + w // 2, ya + 1, x - w // 2, yb - 1, wood[1])
        c.rect(x - w // 2 - 1, yb - 1, w + 3, 1, wood[2])
    c.rect(x - w // 2 - 3, pt - 1, w + 7, 3, wood[2])
    c.rect(x - w // 2 - 3, pt - 1, w + 7, 1, wood[3])
    for px in (x - w // 2 - 2, x - 1, x + w // 2 + 2):
        c.rect(px, pt - 8, 2, 7, wood[2])
    c.rect(x - w // 2 - 3, pt - 6, w + 7, 1, wood[3])
    c.poly([(x - w // 2 - 5, pt - 8), (x, pt - 16), (x + w // 2 + 5, pt - 8)], wood[1])
    c.poly([(x - w // 2 - 5, pt - 8), (x, pt - 16), (x, pt - 8)], wood[2])
    c.rect(x - w // 2 - 5, pt - 8, w + 11, 1, wood[0])
    c.rect(x, pt - 26, 1, 10, wood[1])
    for i in range(8):
        for j in range(5):
            if j > 3 and i > 5:
                continue
            c.set(x + 1 + i, pt - 26 + j + (1 if i in (3, 4, 5) else 0), flag[2] if j < 2 else flag[1])
    c.set(x + 1, pt - 26, flag[3])


def cactus(c, x, base, h, cols):
    for y in range(base - h, base + 1):
        c.set(x - 1, y, cols[3]); c.set(x, y, cols[2]); c.set(x + 1, y, cols[2]); c.set(x + 2, y, cols[1])
    c.set(x, base - h - 1, cols[3]); c.set(x + 1, base - h - 1, cols[2])
    ay = base - int(h * 0.55)
    for xx in range(x - 5, x - 1):
        c.set(xx, ay, cols[2]); c.set(xx, ay + 1, cols[1])
    for y in range(ay - 6, ay + 1):
        c.set(x - 5, y, cols[3]); c.set(x - 4, y, cols[1])
    by = base - int(h * 0.4)
    for xx in range(x + 3, x + 7):
        c.set(xx, by, cols[2]); c.set(xx, by + 1, cols[1])
    for y in range(by - 5, by + 1):
        c.set(x + 6, y, cols[2]); c.set(x + 7, y, cols[1])
    for y in range(base - h + 2, base - 1, 3):
        c.set(x, y, cols[4])


def tent(c, x, base, w, h, cloth, stripe):
    c.poly([(x - w // 2, base), (x, base - h), (x + w // 2, base)], cloth[2])
    c.poly([(x, base - h), (x + w // 2, base), (x + 2, base)], cloth[1])
    for i in range(-w // 2 + 2, w // 2 - 1, 4):
        c.line(x, base - h, x + i, base, stripe)
    c.poly([(x - 3, base), (x, base - h * 0.45), (x + 3, base)], cloth[0])
    c.rect(x, base - h - 4, 1, 4, '#5a3a20')


def crate(c, x, base, s, wood):
    c.rect(x - s // 2, base - s + 1, s, s, wood[2])
    c.rect(x - s // 2, base - s + 1, s, 1, wood[3])
    c.rect(x - s // 2, base, s, 1, wood[0])
    c.line(x - s // 2 + 1, base - s + 2, x + s // 2 - 2, base - 1, wood[1])
    for y in range(base - s + 1, base + 1):
        c.set(x - s // 2, y, wood[3]); c.set(x + s // 2 - 1, y, wood[1])


def barrel(c, x, base, wood, band):
    for y in range(base - 9, base + 1):
        w = 3 + (1 if 1 < base - y < 8 else 0)
        for xx in range(x - w, x + w + 1):
            k = (xx - x + w) / (2 * w)
            c.set(xx, y, wood[3] if k < 0.3 else wood[2] if k < 0.75 else wood[1])
    for yy in (base - 7, base - 2):
        for xx in range(x - 4, x + 5):
            c.setf(xx, yy, band)


def stall(c, x, base, wood, cloth, goods):
    """Étal de marché : auvent rayé festonné, comptoir, marchandises."""
    w = 32
    x0 = x - w // 2
    for px in (x0 + 1, x0 + w - 3):
        c.rect(px, base - 26, 2, 27, wood[2]); c.rect(px + 1, base - 26, 1, 27, wood[1])
    c.rect(x0, base - 10, w, 11, wood[2])
    c.rect(x0, base - 10, w, 2, wood[3])
    for xx in range(x0 + 3, x0 + w, 5):
        c.rect(xx, base - 8, 1, 9, wood[1])
    c.rect(x0, base, w, 1, wood[0])
    # marchandises
    gx = x0 + 3
    for i, g in enumerate(goods):
        c.ellipse(gx + i * 5 + 2, base - 12, 2.2, 2, g)
        c.set(gx + i * 5 + 1, base - 13, shift(g, dl=0.2))
    # auvent
    for y in range(base - 30, base - 22):
        for xx in range(x0 - 3, x0 + w + 3):
            col = cloth[0] if ((xx - x0 + 3) // 4) % 2 == 0 else cloth[1]
            if y == base - 30:
                col = shift(col, dl=0.12)
            c.set(xx, y, col)
    for xx in range(x0 - 3, x0 + w + 3):
        if (xx - x0 + 3) % 4 in (1, 2):
            c.set(xx, base - 22, cloth[0] if ((xx - x0 + 3) // 4) % 2 == 0 else cloth[1])
    c.poly([(x0 - 4, base - 30), (x, base - 37), (x0 + w + 3, base - 30)], wood[2])
    c.poly([(x, base - 37), (x0 + w + 3, base - 30), (x, base - 30)], wood[1])


def hut(c, x, base, w, h, wood, roof, snow, window):
    x0 = x - w // 2
    for y in range(base - h, base + 1):
        for xx in range(x0, x0 + w):
            c.set(xx, y, wood[2] if (y - base) % 3 else wood[1])
        c.set(x0, y, wood[3]); c.set(x0 + w - 1, y, wood[0])
    c.rect(x0 + 3, base - 9, 5, 10, wood[0])
    c.rect(x0 + w - 9, base - h + 4, 5, 4, window)
    c.set(x0 + w - 7, base - h + 4, wood[1]); c.set(x0 + w - 7, base - h + 7, wood[1])
    rh = w // 2 + 2
    c.poly([(x0 - 4, base - h), (x, base - h - rh), (x0 + w + 4, base - h)], roof[2])
    c.poly([(x, base - h - rh), (x0 + w + 4, base - h), (x, base - h)], roof[1])
    if snow:
        for xx in range(x0 - 4, x0 + w + 5):
            d = abs(xx - x) / (w / 2 + 4)
            ty = base - h - rh * (1 - d)
            for k in range(3):
                c.set(xx, ty + k - 1, snow[-1] if k < 2 else snow[-2])
        for xx in range(x0 - 3, x0 + w + 4, 3):
            c.set(xx, base - h + 1, snow[-2]); c.set(xx, base - h + 2, snow[-3])
    c.rect(x0 + w - 6, base - h - rh + 2, 3, 6, wood[0])
    return [(x0 + w - 7, base - h + 6)]


def floating_rock(c, x, cy, w, rock_c, snow):
    hw = w / 2
    pts = [(x - hw, cy), (x - hw * 0.6, cy + w * 0.35), (x - hw * 0.15, cy + w * 0.75), (x + hw * 0.2, cy + w * 0.55),
           (x + hw * 0.55, cy + w * 0.3), (x + hw, cy)]
    c.poly(pts, rock_c[2])
    c.poly([(x + hw * 0.15, cy), (x + hw * 0.2, cy + w * 0.55), (x + hw * 0.55, cy + w * 0.3), (x + hw, cy)], rock_c[1])
    c.poly([(x - hw, cy), (x - hw * 0.6, cy + w * 0.35), (x - hw * 0.45, cy)], rock_c[3])
    c.ellipse(x, cy, hw + 1, 2.5, snow[-1])
    c.ellipse(x + 2, cy + 0.8, hw * 0.8, 1.5, snow[-2])
    for i in range(int(-hw) + 2, int(hw) - 1, 3):
        c.set(x + i, cy + 2, snow[-3]); c.set(x + i, cy + 3, snow[-3])


def bridge_arches(c, x0, x1, deck, base, stone, seed):
    for x in range(x0, x1):
        for y in range(deck, base):
            c.set(x, y, stone[2] if (y - deck) % 5 else stone[1])
    span = 22
    for ax in range(x0 + 6, x1 - 6, span):
        for x in range(int(ax), int(ax + span - 6)):
            for y in range(deck + 5, base + 1):
                if ((x + 0.5 - (ax + span / 2 - 3)) / (span / 2 - 4)) ** 2 + ((y + 0.5 - base) / (base - deck - 6)) ** 2 <= 1:
                    c.set(x, y, None)
    for x in range(x0 - 1, x1 + 1):
        c.set(x, deck - 1, stone[4]); c.set(x, deck, stone[3])
        if x % 3 == 0:
            c.set(x, deck - 2, stone[3])


def demon_head(c, x, base, s, stone, eye):
    """Tête de démon colossale : buste, cornes, arcade, yeux et gueule ardents."""
    c.poly([(x - 28 * s, base), (x - 18 * s, base - 14 * s), (x + 18 * s, base - 14 * s), (x + 28 * s, base)], stone[1])
    c.poly([(x - 28 * s, base), (x - 18 * s, base - 14 * s), (x - 5 * s, base - 14 * s), (x - 8 * s, base)], stone[2])
    for side in (-1, 1):
        horn(c, (x + side * 8 * s, base - 33 * s), (x + side * 26 * s, base - 34 * s), (x + side * 21 * s, base - 54 * s), 3.6 * s, 0.6, stone)
    c.shaded_ellipse(x, base - 27 * s, 12 * s, 13 * s, stone)
    c.poly([(x - 11 * s, base - 24 * s), (x + 11 * s, base - 24 * s), (x + 8 * s, base - 12 * s), (x - 8 * s, base - 12 * s)], stone[1])
    c.poly([(x - 11 * s, base - 24 * s), (x - 1 * s, base - 24 * s), (x - 2 * s, base - 12 * s), (x - 8 * s, base - 12 * s)], stone[2])
    c.poly([(x - 11 * s, base - 33 * s), (x, base - 29 * s), (x + 11 * s, base - 33 * s), (x + 11 * s, base - 31 * s), (x, base - 27 * s), (x - 11 * s, base - 31 * s)], stone[0])
    for side in (-1, 1):
        ex = x + side * 5.5 * s
        c.poly([(ex - 3 * s, base - 28.5 * s + (1 if side < 0 else 0) * s), (ex + 3 * s, base - 28.5 * s + (0 if side < 0 else 1) * s),
                (ex + side * 1.5 * s, base - 25.5 * s)], eye[0])
        c.set(ex, base - 27 * s, eye[2]); c.set(ex - side, base - 27 * s, eye[1])
    c.poly([(x - 7 * s, base - 20 * s), (x + 7 * s, base - 20 * s), (x + 5 * s, base - 14 * s), (x - 5 * s, base - 14 * s)], '#1a0606')
    c.rect(x - 5 * s, base - 17 * s, 10 * s, 2 * s, eye[0])
    for i in (-5, -2, 1, 4):
        c.poly([(x + i * s, base - 20 * s), (x + (i + 1.6) * s, base - 20 * s), (x + (i + 0.8) * s, base - 16.5 * s)], stone[4])
    c.line(x - 1, base - 26 * s, x - 1, base - 22 * s, stone[0])
    return [(x - 5.5 * s, base - 27 * s, 6 * s), (x + 5.5 * s, base - 27 * s, 6 * s), (x, base - 16 * s, 8 * s)]


def flame(c, x, base, h, cols):
    """Flamme (cols : rouge sombre, orange, jaune, blanc)."""
    for i, (k, col) in enumerate(zip((1.0, 0.75, 0.5, 0.25), cols)):
        hh = h * k
        w = max(1, h * 0.38 * k)
        c.poly([(x - w, base), (x - w * 0.6, base - hh * 0.5), (x + (1 if i % 2 else -1) * 0.6, base - hh),
                (x + w * 0.7, base - hh * 0.45), (x + w, base)], col)
        c.ellipse(x, base - 0.3, w, w * 0.6, col)


def pillar_brazier(c, x, base, h, stone, metal, fire):
    w = 9
    x0 = x - w // 2
    for y in range(base - h, base + 1):
        for xx in range(x0, x0 + w):
            i = xx - x0
            col = stone[3] if i < 2 else stone[2] if i < w - 2 else stone[1]
            if (y - base) % 8 == 0:
                col = stone[0]
            c.set(xx, y, col)
    for yy, ww in ((base - h, w + 4), (base - 3, w + 4), (base - h + 3, w + 2)):
        c.rect(x - ww // 2, yy, ww, 3, stone[2])
        c.rect(x - ww // 2, yy, ww, 1, stone[3])
    by = base - h - 1
    c.poly([(x - 7, by - 4), (x + 7, by - 4), (x + 4, by), (x - 4, by)], metal[1])
    c.rect(x - 7, by - 5, 15, 1, metal[2])
    flame(c, x, by - 5, 13, fire)
    return [(x, by - 9, 14)]


def chain(c, x0, y0, x1, y1, sag, col):
    n = int(abs(x1 - x0) + abs(y1 - y0)) + 1
    for i in range(n + 1):
        t = i / n
        x = x0 + (x1 - x0) * t
        y = y0 + (y1 - y0) * t + sag * math.sin(math.pi * t)
        if i % 3 == 0:
            c.set(x, y - 1, col[1]); c.set(x, y + 1, col[0])
        elif i % 3 == 1:
            c.set(x, y, col[2])
        else:
            c.set(x, y, col[1])


def hanging_chain(c, x, y0, L, col):
    for i in range(L):
        if i % 3 == 0:
            c.set(x - 1, y0 + i, col[1]); c.set(x + 1, y0 + i, col[0])
        else:
            c.set(x, y0 + i, col[2] if i % 3 == 1 else col[1])


def stalactite(c, x, top, h, cols, w=None):
    w = w or max(2, h // 4)
    for i in range(h):
        k = 1 - i / h
        half = w * k ** 0.8
        for dx in range(-int(half), int(half) + 1):
            c.set(x + dx, top + i, cols[3] if dx < -half * 0.3 else cols[2] if dx < half * 0.4 else cols[1])
    c.set(x, top + h, cols[1])


def stalagmite(c, x, base, h, cols, w=None):
    w = w or max(2, h // 4)
    for i in range(h):
        k = 1 - i / h
        half = w * k ** 0.8
        for dx in range(-int(half), int(half) + 1):
            c.set(x + dx, base - i, cols[3] if dx < -half * 0.3 else cols[2] if dx < half * 0.4 else cols[1])


def ladder(c, x, y0, y1, wood):
    for y in range(y0, y1 + 1):
        c.set(x, y, wood[2]); c.set(x + 5, y, wood[1])
        if (y - y0) % 3 == 1:
            for xx in range(x + 1, x + 5):
                c.set(xx, y, wood[3])


def scaffold(c, x0, w, base, h, wood, metal, light, seed):
    """Échafaudage de mine : poteaux, traverses, croisillons, plancher, échelle, lanterne."""
    deck = base - h
    for px in (x0, x0 + w - 3):
        for y in range(deck, base + 1):
            c.set(px, y, wood[3]); c.set(px + 1, y, wood[2]); c.set(px + 2, y, wood[1])
    c.line(x0 + 2, deck + 3, x0 + w - 3, base - 2, wood[1], 2)
    c.line(x0 + w - 3, deck + 3, x0 + 2, base - 2, wood[0], 2)
    mid = deck + h // 2
    c.rect(x0, mid, w, 2, wood[2]); c.rect(x0, mid, w, 1, wood[3])
    c.rect(x0 - 4, deck - 3, w + 8, 4, wood[2])
    for xx in range(x0 - 4, x0 + w + 4, 4):
        c.set(xx, deck - 2, wood[0]); c.set(xx, deck - 1, wood[0])
    c.rect(x0 - 4, deck - 3, w + 8, 1, wood[3])
    c.rect(x0 - 4, deck + 1, w + 8, 1, wood[0])
    # garde-corps
    for px in (x0 - 3, x0 + w // 2, x0 + w + 1):
        c.rect(px, deck - 9, 2, 6, wood[2])
    c.rect(x0 - 3, deck - 9, w + 6, 1, wood[3])
    ladder(c, x0 + w // 3, deck - 2, base, wood)
    lx = x0 + w - 8
    c.set(lx, deck + 2, metal[0]); c.set(lx, deck + 3, metal[0])
    return lantern(c, lx, deck + 8, metal, light)


def rope_bridge(c, x0, x1, y, sag, wood, rope):
    for px in (x0, x1):
        c.rect(px - 1, y - 9, 3, 30, wood[2])
        c.rect(px, y - 9, 1, 30, wood[3])
        c.set(px, y - 10, wood[3])
    for x in range(x0 + 2, x1 - 1):
        t = (x - x0) / (x1 - x0)
        yy = y + sag * math.sin(math.pi * t)
        c.set(x, yy, wood[3] if x % 3 else wood[0]); c.set(x, yy + 1, wood[1] if x % 3 else wood[0])
        ry = y - 7 + sag * 0.8 * math.sin(math.pi * t)
        c.set(x, ry, rope[1])
        if x % 5 == 0:
            for k in range(int(ry) + 1, int(yy)):
                c.set(x, k, rope[0])


def mossy_pillar(c, x, base, w, h, stone, moss, seed):
    r = rng(seed)
    x0 = x - w // 2
    tops = [base - h + r.randint(0, 5) for _ in range(w)]
    for i in range(w):
        for y in range(tops[i], base + 1):
            col = stone[3] if i < 2 else stone[2] if i < w - 2 else stone[1]
            if (y - base) % 7 == 0 or (i + (y - base) // 7 * 4) % 9 == 0:
                col = stone[0]
            c.set(x0 + i, y, col)
    for i in range(-1, w + 1):
        t = tops[max(0, min(w - 1, i))]
        for k in range(3):
            c.set(x0 + i, t - 1 + k, moss[4] if k == 0 else moss[3] if k == 1 else moss[2])
        d = r.randint(0, 4)
        for k in range(d):
            c.set(x0 + i, t + 2 + k, moss[2] if k < d - 1 else moss[1])
    for _ in range(w // 3):
        vx = x0 + r.randint(0, w - 1)
        for k in range(r.randint(4, h // 2)):
            c.set(vx + (k // 4) % 2, tops[0] + 2 + k, moss[1] if k % 3 else moss[3])


def big_tree(c, x, base, tw, h, bark, moss, leaf, seed):
    """Arbre colossal moussu : racines étalées, écorce cannelée, lianes, houppier en haut."""
    r = rng(seed)
    top = base - h
    roots = []
    for side in (-1, 1):
        for j in range(3):
            sx = x + side * (tw * 0.3 + j * 2)
            ex = x + side * (tw * 0.8 + j * tw * 0.4 + r.randint(0, 4))
            sy = base - tw * (1.0 - j * 0.22)
            for t in range(25):
                a = t / 24
                roots.append((side, sx + (ex - sx) * a, sy + (base - sy) * (1 - (1 - a) ** 2), (4.6 - a * 3.4) * (1 - j * 0.18)))
    for side, px, py, rr in roots:
        c.ellipse(px, py, rr + 1, rr + 1, bark[0])
    for y in range(top, base + 1):
        k = (y - top) / max(1, h)
        half = tw / 2 + (max(0, k - 0.72) / 0.28) ** 2 * tw * 0.45
        for dx in range(-int(half), int(half) + 1):
            s = dx / half
            col = bark[3] if s < -0.55 else bark[2] if s < 0.25 else bark[1] if s < 0.75 else bark[0]
            c.set(x + dx, y, col)
    for i in range(int(tw // 3)):
        gx = x - tw // 2 + 2 + i * 3 + r.randint(0, 1)
        for y in range(top, base - 2):
            if (y + i * 5) % 17 < 13:
                c.set(gx, y, bark[0] if gx > x else bark[1])
    for side, px, py, rr in roots:
        c.ellipse(px, py, rr, rr, bark[2] if side < 0 else bark[1])
    for side, px, py, rr in roots:
        c.set(px, py - rr + 0.5, moss[3] if side < 0 else moss[2])
        c.set(px - 1, py - rr + 0.5, moss[4] if side < 0 else moss[3])
    for _ in range(int(h / 5)):
        mx = x + r.uniform(-tw * 0.6, -tw * 0.05)
        my = r.uniform(top, base - 4)
        c.ellipse(mx, my, r.uniform(1.5, 3), r.uniform(1, 2.2), moss[2], only_inside=True)
        c.setf(mx - 1, my - 1, moss[3])
    for _ in range(4):
        vx = x + r.uniform(-tw * 0.5, tw * 0.5)
        L_ = r.randint(int(h * 0.2), int(h * 0.6))
        for k in range(L_):
            c.set(vx + math.sin(k * 0.3) * 0.8, top + k, leaf[1] if k % 4 else leaf[3])
    foliage(c, x, top + 12, tw * 2.0, 20, leaf, seed + 3, n=14)
    for i in range(5):
        vines(c, x + r.uniform(-tw * 1.6, tw * 1.6), top + 22, r.randint(10, 34), leaf, seed + i)


def forest_tree(c, x, base, tw, bark, moss, leaf, seed, top=0, side=0):
    """Arbre de futaie : tronc géant qui monte jusqu'à `top` (hors de la vue), branches feuillues
    étagées des deux côtés (la plus basse vers 70-95 px du sol : visible même dans une vue basse)."""
    r = rng(seed + 11)
    big_tree(c, x, base, tw, base - top, bark, moss, leaf, seed)
    y = base - r.randint(56, 76)
    k = side
    while y > top + 20:
        sd = -1 if k % 2 == 0 else 1
        ln = r.uniform(tw * 0.5 + 10, tw * 0.5 + 24)
        sx = x + sd * tw * 0.35
        ex, ey = x + sd * ln, y - ln * r.uniform(0.35, 0.6)
        c.line(sx, y + 2, ex, ey, bark[1], 3)
        c.line(sx, y + 1, ex, ey - 1, bark[2], 1)
        foliage(c, ex, ey - 4, r.uniform(19, 27), r.uniform(11, 15), leaf, seed + int(y) * 7, n=13)
        if r.random() < 0.7:
            foliage(c, x - sd * r.uniform(4, tw * 0.5), y - r.randint(16, 26), r.uniform(12, 17), r.uniform(8, 10), leaf, seed + int(y) * 3, n=8)
        for i in range(2):
            vines(c, ex + r.uniform(-8, 8), ey + 4, r.randint(6, 18), leaf, seed + int(y) + i)
        y -= r.randint(34, 50)
        k += 1


def vines(c, x, y0, L, leaf, seed):
    r = rng(seed)
    for k in range(L):
        vx = x + math.sin(k * 0.25 + seed) * 1.2
        c.set(vx, y0 + k, leaf[1])
        if k % 3 == 0:
            c.set(vx + (1 if (k // 3) % 2 else -1), y0 + k, leaf[3])
    if r.random() < 0.6:
        c.set(x, y0 + L, leaf[4]); c.set(x - 1, y0 + L, leaf[3])


def firefly(c, x, y):
    glow(c, x, y, 3.5, '#f8f070', a=0.35, rings=2)
    c.set(x, y, '#fffbd0')


def cloud(c, x, y, w, colors, seed):
    r = rng(seed)
    puffs = [(0, 0, w * 0.28, w * 0.17)]
    for i in range(5):
        puffs.append((r.uniform(-0.36, 0.36) * w, r.uniform(-0.14, 0.02) * w, w * r.uniform(0.12, 0.2), w * r.uniform(0.1, 0.16)))
    for px, py, rx, ry in puffs:
        c.shaded_ellipse(x + px, y + py, rx, ry, colors, light=(-0.3, -0.95))
    bot = int(y + w * 0.07)
    for xx in range(int(x - w * 0.55), int(x + w * 0.55)):
        for yy in range(bot, int(y + w * 0.25)):
            if c.get(xx, yy) is not None:
                c.set(xx, yy, None)
        if c.get(xx, bot - 1) is not None:
            c.set(xx, bot - 1, colors[0])
            c.set(xx, bot - 2, colors[1])


def streak_cloud(c, x, y, w, cols, seed):
    r = rng(seed)
    for i in range(3):
        cx = x + r.uniform(-w * 0.3, w * 0.3)
        cy = y + i * 2 - 2
        ww = w * r.uniform(0.4, 0.7)
        c.ellipse(cx, cy, ww / 2, 1.6, cols[0])
        c.ellipse(cx - 1, cy - 0.7, ww / 2 - 2, 0.9, cols[1])


def horn(c, p0, p1, p2, r0, r1, cols, steps=30):
    """Corne (courbe de Bézier quadratique, rayon décroissant) ombrée à gauche."""
    pts = []
    for i in range(steps + 1):
        t = i / steps
        x = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0]
        y = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]
        pts.append((x, y, r0 + (r1 - r0) * t))
    for x, y, rr in pts:
        c.ellipse(x, y, rr + 0.6, rr + 0.6, cols[0])
    for x, y, rr in pts:
        c.ellipse(x, y, rr, rr, cols[2])
    for i, (x, y, rr) in enumerate(pts):
        c.set(x - rr * 0.5, y - rr * 0.5, cols[3])
        if i % 5 == 2 and rr > 1.2:
            c.set(x + rr * 0.6, y, cols[1])


def boulders(c, x, base, w, h, cols, seed):
    r = rng(seed)
    n = max(2, int(w / 7))
    items = []
    for i in range(n):
        bx = x - w / 2 + (i + 0.5) * w / n + r.uniform(-2, 2)
        bh = h * r.uniform(0.5, 1.0) * (1 - abs(bx - x) / w)
        items.append((bx, bh, w / n * r.uniform(0.6, 0.85)))
    items.sort(key=lambda b: -b[1])
    for bx, bh, bw in items:
        c.ellipse(bx, base - bh / 2, bw + 0.8, bh / 2 + 0.8, cols[0])
        c.shaded_ellipse(bx, base - bh / 2, bw, bh / 2, cols[1:])
        c.set(bx - bw * 0.4, base - bh * 0.75, cols[-1])


def crag(c, x, base, w, h, cols, seed):
    """Formation rocheuse dentelée : flancs éclairés à gauche, fissures horizontales."""
    r = rng(seed)
    x0 = int(x - w / 2)
    tops = []
    spikes = [(r.uniform(-0.45, 0.45), r.uniform(0.45, 1.0), r.uniform(0.06, 0.16)) for _ in range(max(2, int(w / 10)))]
    for i in range(int(w)):
        t = (i + 0.5) / w * 2 - 1
        env = max(0.0, 1 - t * t) ** 0.5
        hh = 0.35 * env
        for sx, sh, sw in spikes:
            d = abs(t - sx) / sw
            if d < 1:
                hh = max(hh, sh * (1 - d) * env ** 0.3)
        tops.append(base - h * hh)
    for i in range(int(w)):
        top = int(round(tops[i]))
        slope = tops[min(len(tops) - 1, i + 1)] - tops[max(0, i - 1)]
        lit = slope < -0.2
        shade = slope > 0.2
        for y in range(top, base + 1):
            d = y - top
            col = cols[3] if lit and d < 10 else cols[1] if shade and d < 10 else cols[2]
            if d == 0:
                col = cols[4] if lit else cols[2]
            if (y + (i // 6) * 3) % 9 == 0 and d > 2:
                col = cols[0]
            c.set(x0 + i, y, col)


def icefall(c, x, y0, y1, w, seed):
    """Cascade gelée : colonnes de glace bleutées, stalactites de glace en bas."""
    r = rng(seed)
    cols = ['#5a9ad8', '#8ac4ee', '#bfe6fa', '#f0fbff']
    for i in range(w):
        end = y1 - r.randint(0, 5)
        for y in range(y0, end):
            k = (y - y0 + i * 3) % 11
            col = cols[3] if i == 1 or k == 0 else cols[2] if i < w - 2 else cols[1]
            if (y + i * 7) % 13 == 0:
                col = cols[0]
            c.set(x + i, y, col)
        for k in range(r.randint(1, 4)):
            c.set(x + i, end + k, cols[2] if k == 0 else cols[1])
    for i in range(-1, w + 1):
        c.set(x + i, y0, cols[3])
    c.ellipse(x + w / 2, y1, w / 2 + 3, 2, cols[2])
    c.ellipse(x + w / 2 - 1, y1 - 0.5, w / 2 + 1, 1, cols[3])


def lava_crag(c, x, base, w, h, cols, seed):
    crag(c, x, base, w, h, cols, seed)
    r = rng(seed + 1)
    x0 = int(x - w / 2)
    for _ in range(int(w / 8)):
        px, py = x0 + r.randint(2, int(w) - 3), base - r.randint(2, int(h * 0.5))
        for _ in range(r.randint(3, 7)):
            c.setf(px, py, '#ff8a20')
            c.setf(px + 1, py, '#c8300c')
            py += 1
            px += r.choice((-1, 0, 1))


# ====================================================================== sol

def block_ground(w, seed, top, face, deep, kind, mortar=None, flower_cols=None):
    """Sol en blocs de pierre (ligne du sol = rangée 8 du calque, calque haut de 36 px).
    kind : grass | moss | sand | snow | rock | lava"""
    H, G = 36, 8
    c = Wrap(w, H)
    r = rng(seed)
    rows = [(G + 3, 9), (G + 12, 8), (G + 20, 8), (G + 28, 8)]
    lava = ['#7a1408', '#d8400c', '#ff8a1e', '#ffd25a']
    for ri, (y0, bh) in enumerate(rows):
        ws, tot = [], 0
        while tot < w:
            bw = r.randint(12, 21)
            ws.append(bw)
            tot += bw
        ws[-1] -= tot - w
        if ws[-1] < 7:
            ws[-2] += ws.pop()
        x = r.randint(0, 20) + ri * 7
        fc = [mix(f, deep, min(0.8, ri * 0.24)) for f in face]
        mc = mortar if mortar and ri < 3 else fc[0]
        for bw in ws:
            block(c, x, y0, bw, bh, fc, mc, r, kind, lava if kind == 'lava' else None)
            x += bw
    for x in range(w):
        c.set(x, H - 1, deep)
    # dessus
    for x in range(w):
        n = noise1(x, w, seed + 3, 3)
        if kind in ('grass', 'moss'):
            c.set(x, G, top[4]); c.set(x, G + 1, top[3]); c.set(x, G + 2, top[3])
            d = 1 + int(1.6 * (n + 1)) + (r.random() < 0.12) * r.randint(2, 5)
            for k in range(d):
                c.set(x, G + 3 + k, top[2] if k < d - 1 else top[1])
            c.set(x, G + 3 + d, mix(face[0], deep, 0.5))
            if kind == 'moss' and r.random() < 0.06:
                for k in range(r.randint(4, 12)):
                    c.set(x, G + 3 + d + k, top[1] if k % 3 else top[3])
        elif kind == 'sand':
            c.set(x, G, top[4]); c.set(x, G + 1, top[3]); c.set(x, G + 2, top[2])
            d = int(1.2 * (n + 1)) + (r.random() < 0.1) * 2
            for k in range(d):
                c.set(x, G + 3 + k, top[2] if k < d - 1 else top[1])
            c.set(x, G + 3 + d, mix(face[0], deep, 0.3))
        elif kind == 'snow':
            c.set(x, G - 1, top[4]); c.set(x, G, top[4]); c.set(x, G + 1, top[3]); c.set(x, G + 2, top[2])
            d = int(1.4 * (n + 1)) + (r.random() < 0.15)
            for k in range(d):
                c.set(x, G + 3 + k, top[2] if k < d - 1 else top[1])
            if r.random() < 0.22:
                L = r.randint(2, 6)
                for k in range(L):
                    c.set(x, G + 3 + d + k, '#e8f8ff' if k < L - 1 else '#9ed4f0')
        elif kind == 'rock':
            c.set(x, G, top[4]); c.set(x, G + 1, top[3]); c.set(x, G + 2, top[2])
            c.set(x, G + 3, top[1])
        elif kind == 'lava':
            c.set(x, G, top[3]); c.set(x, G + 1, top[2]); c.set(x, G + 2, top[1])
            c.set(x, G + 3, top[0])
            if r.random() < 0.08:
                c.set(x, G + 1, lava[2]); c.set(x, G + 2, lava[1])
    # touffes / reliefs au-dessus de la ligne du sol
    for x in range(w):
        if kind in ('grass', 'moss') and r.random() < 0.4:
            hh = r.randint(1, 3)
            for k in range(hh):
                c.set(x, G - 1 - k, top[4] if k == hh - 1 else top[3])
        elif kind == 'snow' and r.random() < 0.05:
            c.ellipse(x, G - 0.5, r.uniform(2, 4), 1.5, top[4])
        elif kind == 'sand' and r.random() < 0.04:
            c.set(x, G - 1, top[3]); c.set(x + 1, G - 1, top[2])
        elif kind == 'rock' and r.random() < 0.06:
            c.set(x, G - 1, top[3]); c.set(x + 1, G - 1, top[2])
    if flower_cols:
        for _ in range(w // 18):
            flowers(c, r.randint(0, w - 1), G, flower_cols, r.randint(0, 9999), n=2)
    return c


def block(c, x, y, bw, bh, fc, mc, r, kind, lava=None):
    for yy in range(y, y + bh):
        for xx in range(x, x + bw):
            i, j = xx - x, yy - y
            if i == 0 or j == 0:
                col = mc
            elif j == 1 or i == 1:
                col = fc[3]
            elif j == bh - 1 or i == bw - 1:
                col = fc[1]
            else:
                col = fc[2]
            c.set(xx, yy, col)
    for (cx, cy) in ((x + 1, y + 1), (x + bw - 1, y + 1), (x + 1, y + bh - 1), (x + bw - 1, y + bh - 1)):
        c.set(cx, cy, mc)
    c.set(x + 2, y + 2, fc[4])
    for _ in range(bw * bh // 16):
        c.set(x + r.randint(2, bw - 2), y + r.randint(2, bh - 2), fc[1] if r.random() < 0.6 else fc[3])
    if r.random() < 0.3:
        px, py = x + r.randint(3, bw - 4), y + 1
        for _ in range(r.randint(3, 6)):
            c.set(px, py, lava[2] if lava else fc[0])
            if lava:
                c.set(px + 1, py, lava[1])
            py += 1
            px += r.choice((-1, 0, 1))
            if py >= y + bh:
                break
    if kind == 'rock' and bw > 9 and r.random() < 0.18:
        cols = R('#58c8f0', 5, 0.3) if r.random() < 0.5 else R('#b060e8', 5, 0.3)
        cx = x + r.randint(4, bw - 4)
        crystal(c, cx, y + bh - 2, 5, 1.5, 0, cols)


def front_strip(w, seed, kind, cols, extra=None):
    """Bande de premier plan (sous les pieds) : touffes, cailloux. 16 px de haut."""
    c = Wrap(w, 16)
    r = rng(seed)
    x = r.randint(0, 20)
    while x < w - 12:
        t = r.random()
        if kind in ('grass', 'moss', 'snow') and t < 0.6:
            n = r.randint(5, 9)
            for b in range(n):
                bx = x + b * 1.3 + r.uniform(-1, 1)
                hh = r.randint(4, 10) if kind != 'snow' else r.randint(3, 6)
                lean = r.uniform(-0.35, 0.35)
                for k in range(hh):
                    c.set(bx + lean * k, 15 - k, cols[3] if k > hh - 3 else cols[2] if k > 2 else cols[1])
            if kind == 'snow':
                c.ellipse(x + 5, 15, 7, 3.5, cols[4])
                c.ellipse(x + 4, 14, 5, 2, '#ffffff')
        elif extra and t < 0.8:
            extra(c, x, 15, r)
        else:
            rw = r.randint(5, 10)
            c.shaded_ellipse(x + rw / 2, 15 - rw * 0.25, rw / 2, rw * 0.4, cols[:4] if kind != 'lava' else cols)
        x += r.randint(26, 60)
    c.outline()
    return c


# ====================================================================== zones

def L(name, canvas, factor, y, anchor='ground', front=False, drift=None):
    if anchor == 'ground':
        y -= getattr(canvas, 'top', 0)  # marge haute d'un Wrap : le bas du calque reste au même endroit
    return {'name': name, 'canvas': canvas, 'factor': factor, 'y': y, 'anchor': anchor, 'front': front, 'drift': drift}


def clouds_layer(w, h, colors, seed, n=7, ymin=10, ymax=40, wmin=30, wmax=64):
    w, n = w * 2, n * 2  # calque large : le même nuage ne revient pas dans une vue de 500+ px
    c = Wrap(w, h)
    r = rng(seed)
    for i in range(n):
        cloud(c, i * (w // n) + r.randint(0, w // n // 2), r.randint(ymin, ymax), r.randint(wmin, wmax), colors, seed * 10 + i)
    return c


# ---------------------------------------------------------------------- plaines

def zone_plains():
    sky = ['#3d8ee0', '#64aeee', '#98cff4', '#cdeaf8']
    haze_c = '#b4daf4'
    out = []
    out.append(L('clouds', clouds_layer(512, 70, ['#8fb8e0', '#bcd8f0', '#e2f0fa', '#ffffff'], 11), 0.03, 2, 'top', drift=2))

    far = Wrap(512, 124); GB = 122
    peaks(far, GB - 58, 26, R('#5a80c8', 5, 0.24), ['#8aa6d4', '#cfe0f4', '#f8fbff'], 12, GB - 66)
    ridge(far, GB - 36, 9, R('#6c94d0', 5, 0.2), 13, sharp=True)
    ridge(far, GB - 22, 5, R('#86b88a', 5, 0.2), 14)
    haze(far, haze_c, 0.12, 0.45, 0, GB)
    out.append(L('far', far, 0.08, -GB))

    fh = Wrap(512, 112); GB = 110
    grass = R('#5cb03c', 5, 0.3)
    rockc = R('#8e8274', 5, 0.3)
    ridge(fh, GB - 34, 6, R('#6cb04c', 5, 0.24), 15)
    water(fh, 0, 512, GB - 22, GB, ['#3a78c0', '#5a9ad8', '#86c0ec', '#d0ecfa'], 16)
    cliffs = [(40, 118, GB - 40), (196, 324, GB - 44), (392, 452, GB - 36)]
    for i, (x0, x1, top) in enumerate(cliffs):
        cliff(fh, x0, x1, top, GB - 14, rockc, 17 + i, cap=grass)
    place(fh, 262, GB - 45, 70, 56, castle, 0.95, R('#a8b4c8', 4, 0.24), R('#3a62c0', 4, 0.28), '#ffe9a0', '#d84a4a')
    place(fh, 425, GB - 37, 40, 40, castle, 0.5, R('#a0acc4', 4, 0.22), R('#4a70c8', 4, 0.26), '#ffe9a0', None)
    wf = ['#5a9ad8', '#8cc4ee', '#c4e4fa', '#ffffff']
    waterfall(fh, 112, GB - 36, GB - 14, 5, wf, 20)
    waterfall(fh, 199, GB - 40, GB - 14, 6, wf, 21)
    waterfall(fh, 318, GB - 40, GB - 14, 4, wf, 22)
    waterfall(fh, 393, GB - 32, GB - 14, 3, wf, 23)
    leaf_far = R('#4a9c3a', 5, 0.28, 0.06)
    trunk = R('#6b4428', 4, 0.24)
    r = rng(24)
    for x in [50, 62, 78, 96, 212, 226, 300, 312, 404, 446, 140, 152, 166, 476, 490, 504, 8, 20]:
        top = next((t for x0, x1, t in cliffs if x0 <= x < x1), GB - 30)
        place(fh, x, top - 1, 22, 22, round_tree, r.randint(9, 12), leaf_far, trunk, x, tk=0.35)
    ridge(fh, GB - 8, 3, R('#56a03a', 5, 0.24), 25)
    haze(fh, haze_c, 0.3, 0.2, 0, GB)
    out.append(L('hills', fh, 0.18, -GB))

    mid = Wrap(512, 118); GB = 116
    ridge(mid, GB - 14, 3, R('#4c9436', 5, 0.24), 26)
    leaf = R('#43a03a', 5, 0.32, 0.07)
    trunk = R('#6e4528', 4, 0.26)
    r = rng(27)
    for x, s in [(22, 36), (78, 28), (150, 40), (214, 26), (282, 38), (352, 30), (420, 40), (476, 28), (116, 22), (246, 22), (386, 22)]:
        place(mid, x, GB - 6, int(s * 1.6), int(s * 1.9), round_tree, s, leaf, trunk, 300 + x)
    for x in range(0, 512, 11):
        bush(mid, x + r.randint(0, 5), GB - 3, r.randint(12, 18), r.randint(7, 10), R('#3a8c34', 5, 0.28), 400 + x)
    haze(mid, '#9ccff4', 0.12, 0.2, 0, GB)
    out.append(L('trees', mid, 0.4, -GB))

    near = Wrap(384, 64); GB = 62
    wood = R('#8a5a32', 4, 0.3)
    metal = R('#4a4458', 3, 0.2)
    light = ['#f0a030', '#ffd060', '#fff4c0']
    for x0, ln in [(4, 46), (150, 36), (244, 40)]:
        place(near, x0 + ln // 2, GB, ln + 6, 16, lambda t, lx, lb: fence(t, 2, ln, lb, 11, wood))
    place(near, 60, GB, 30, 48, banner, 42, R('#2f5cc0', 4, 0.3), R('#e8b64a', 3, 0.3), wood)
    place(near, 330, GB, 30, 48, banner, 42, R('#2f5cc0', 4, 0.3), R('#e8b64a', 3, 0.3), wood)
    lt = place(near, 214, GB, 28, 44, lantern_post, 38, wood, metal, light)
    place(near, 112, GB, 46, 44, stall, wood, ['#d8402e', '#f4ead0'], ['#e83a3a', '#f0c030', '#68c040', '#e87a2a', '#e83a3a'])
    place(near, 135, GB, 12, 12, crate, 8, wood)
    place(near, 88, GB, 12, 14, barrel, wood, '#5a5468')
    for x in [30, 196, 290, 366]:
        place(near, x, GB, 14, 12, mushroom, 4, R('#e0403a', 4, 0.3), ['#c8b8a0', '#f0e6d0', '#ffffff'])
    for x in [16, 176, 268, 300, 350]:
        place(near, x, GB, 18, 12, bush, 14, 9, R('#3f9e3a', 5, 0.3), x)
    for x in [44, 128, 186, 258, 318, 372]:
        flowers(near, x, GB, ['#ff6fa8', '#ffe066', '#ffffff', '#7fc8ff'], x)
    for x, y in lt:
        glow(near, x, y, 9, '#ffd060', a=0.4)
    out.append(L('near', near, 0.7, -GB))

    g = block_ground(256, 29, R('#5cb83c', 5, 0.3, 0.07), R('#7a6c62', 5, 0.3), '#1e1814', 'grass',
                     flower_cols=['#ff6fa8', '#ffe066', '#ffffff'])
    out.append(L('ground', g, 1.0, -8))
    fr = front_strip(320, 30, 'grass', R('#2f7a2c', 5, 0.3))
    out.append(L('front', fr, 1.25, 7, front=True))
    return sky, '#1e1814', out


def zone_forest():
    sky = ['#0f3a3c', '#1a5a58', '#2a7e74', '#52a490']
    hz = '#5cb0a0'
    out = []
    # voûte de feuillage (haut de la vue) : large, bord inférieur irrégulier, lianes
    can = Wrap(768, 44)
    leafc = R('#22684a', 5, 0.26, 0.06)
    r = rng(41)
    for x in range(0, 768, 9):
        dip = 4 + 5 * (noise1(x, 768, 48, 3) + 1)
        foliage(can, x + r.randint(0, 6), r.randint(0, int(dip)), r.randint(9, 16), r.randint(6, 11), leafc, x + 7, rim=True)
    for x in range(3, 768, 13):
        vines(can, x + r.randint(0, 6), 8 + r.randint(0, 6), r.randint(8, 28), R('#38904e', 5, 0.3), x)
    out.append(L('canopy', can, 0.3, 0, 'top'))

    # futaie lointaine : troncs qui montent jusqu'en haut de la plus grande vue, feuillages étagés
    GB = 158
    far = Wrap(768, 160, top=320 - GB)
    trunkf = R('#2c625c', 5, 0.14)
    leaff = R('#2f745e', 5, 0.16)
    ridge(far, GB - 30, 6, R('#2a6a62', 5, 0.14), 43)
    x = 0
    while x < 768:
        xx = x + r.randint(0, 10)
        tw = r.choice((6, 8, 10, 12, 14, 16))
        for y in range(-far.top, GB - 20):
            for dx in range(-tw // 2, tw // 2 + 1):
                sh = dx / (tw / 2)
                far.set(xx + dx, y, trunkf[3] if sh < -0.5 else trunkf[2] if sh < 0.4 else trunkf[1])
        fy = GB - r.randint(60, 90)
        while fy > -far.top:
            sd = r.choice((-1, 1))
            bx = xx + sd * r.randint(8, 16)
            far.line(xx, fy + 8, bx, fy, trunkf[1], 2)
            foliage(far, bx, fy, r.randint(16, 26), r.randint(10, 15), leaff, r.randint(0, 999), rim=False)
            fy -= r.randint(40, 70)
        x += r.randint(30, 52)
    haze(far, '#6ec8b2', 0.5, 0.6, 0, GB)
    out.append(L('far', far, 0.07, -GB))

    fm = Wrap(512, 128); GB = 126
    stone = R('#5a7e76', 5, 0.24)
    moss = R('#4cae4e', 5, 0.3, 0.06)
    water(fm, 0, 512, GB - 22, GB, ['#1f7270', '#2f948a', '#5cbcac', '#acead8'], 44)
    for cx in (90, 330):
        arch(fm, cx, GB - 18, 70, 64, 10, stone, cx)
        for xx in range(cx - 35, cx + 36):
            for k in range(2):
                fm.setf(xx, int(GB - 18 - 64 + k + abs(xx - cx) ** 2 / 90), moss[3])
    for x in [30, 170, 250, 420, 480]:
        place(fm, x, GB - 18, 20, 90, mossy_pillar, 10, r.randint(40, 70), stone, moss, x)
    for x in (200, 450):
        waterfall(fm, x, GB - 70, GB - 20, 5, ['#2f948a', '#6ed0c0', '#b8f4e6', '#ffffff'], x)
    for x in range(0, 512, 23):
        lily(fm, x + r.randint(0, 10), GB - 16 + r.randint(0, 10), R('#3aa04a', 4, 0.3))
    haze(fm, hz, 0.36, 0.24, 0, GB)
    out.append(L('ruins', fm, 0.2, -GB))

    # arbres géants : troncs jusqu'en haut de la vue (jamais coupés), branches feuillues étagées,
    # largeurs et hauteurs variées sur un calque large (pas de motif répété visible)
    GB = 128
    mid = Wrap(1024, 130, top=320 - GB)
    bark = R('#5e4a34', 5, 0.32, 0.05)
    mossm = R('#4eaa42', 5, 0.32, 0.07)
    leafm = R('#2c8a4a', 5, 0.32, 0.06)
    water(mid, 0, 1024, GB - 10, GB, ['#1a6a66', '#2a8a82', '#4cb2a2', '#9ae4cc'], 45)
    plat = R('#56726a', 5, 0.28)
    for i, (x0, x1, top) in enumerate([(120, 184, GB - 36), (520, 572, GB - 28), (790, 846, GB - 32)]):
        cliff(mid, x0, x1, top, GB - 6, plat, 140 + i, cap=mossm)
    trees = [(60, 24, 0), (262, 18, 1), (400, 28, 0), (640, 20, 1), (742, 16, 0), (905, 26, 1)]
    for x, tw, side in trees:
        forest_tree(mid, x, GB - 8, tw, bark, mossm, leafm, x, top=-mid.top, side=side)
    place(mid, 213, GB - 6, 70, 50, lambda t, lx, lb: rope_bridge(t, 3, 62, lb - 30, 4, R('#7a5232', 4, 0.3), ['#8a7050', '#c8a878']))
    place(mid, 600, GB - 6, 56, 50, lambda t, lx, lb: rope_bridge(t, 3, 50, lb - 26, 4, R('#7a5232', 4, 0.3), ['#8a7050', '#c8a878']))
    for x in [196, 490, 690, 980]:
        place(mid, x, GB - 6, 22, 60, mossy_pillar, 12, r.randint(30, 46), R('#5a766e', 5, 0.26), mossm, x + 1)
    for x in range(0, 1024, 19):
        bush(mid, x + r.randint(0, 6), GB - 6, r.randint(10, 16), r.randint(6, 10), R('#33964a', 5, 0.3), x + 5)
    for x in range(10, 1024, 16):
        lily(mid, x + r.randint(0, 6), GB - 3 + r.randint(0, 2), R('#4ab44a', 4, 0.3), '#f080b0' if r.random() < 0.3 else None)
    haze(mid, hz, 0.12, 0.16, 0, GB)
    for _ in range(26):
        firefly(mid, r.randint(0, 1023), r.randint(20, GB - 30))
    out.append(L('trees', mid, 0.42, -GB))

    near = Wrap(384, 64); GB = 62
    wood = R('#7a5232', 4, 0.3)
    rope = ['#8a7050', '#c8a878']
    place(near, 120, GB, 110, 40, lambda t, lx, lb: rope_bridge(t, 3, 105, lb - 20, 4, wood, rope))
    for x in (40, 260, 330):
        place(near, x, GB, 20, 40, mossy_pillar, 9, r.randint(18, 28), R('#5a786e', 5, 0.28), R('#58b44a', 5, 0.3), x)
    for x in [16, 190, 230, 300, 360]:
        place(near, x, GB, 20, 14, bush, 16, 10, R('#33984a', 5, 0.3), x)
    for x in [60, 210, 280]:
        place(near, x, GB, 14, 12, mushroom, 4, R('#7a48c8', 4, 0.34), ['#a8b8a8', '#d8e8d8', '#ffffff'], dots='#c8f0ff')
    for _ in range(10):
        firefly(near, r.randint(0, 383), r.randint(10, GB - 14))
    out.append(L('near', near, 0.7, -GB))

    g = block_ground(256, 46, R('#40a64a', 5, 0.32, 0.06), R('#4e665e', 5, 0.28), '#0e1816', 'moss')
    out.append(L('ground', g, 1.0, -8))
    out.append(L('front', front_strip(320, 47, 'moss', R('#1f6a3a', 5, 0.3)), 1.25, 7, front=True))
    return sky, '#0e1816', out


def zone_caves():
    sky = ['#06050e', '#0d0a1e', '#151232', '#1c1840']
    out = []
    r = rng(61)
    rockc = R('#3a3474', 5, 0.24)
    ceil = Wrap(512, 64)
    for x in range(512):
        h = 10 + int(5 * (noise1(x, 512, 62, 3) + 1))
        for y in range(h):
            ceil.set(x, y, rockc[1] if y < h - 2 else rockc[2])
    for i, x in enumerate(range(4, 512, 11)):
        stalactite(ceil, x + r.randint(0, 6), 12, r.randint(8, 46 if i % 4 == 0 else 26), rockc)
    haze(ceil, '#221c48', 0.4)
    out.append(L('ceiling_far', ceil, 0.12, 0, 'top'))

    far = Wrap(512, 180, top=140); GB = 178
    wall = R('#262050', 5, 0.16)
    ridge(far, 40, 14, wall, 63, sharp=True)
    for i, x in enumerate(range(0, 512, 46)):
        xx = x + r.randint(0, 20)
        w = r.randint(10, 20)
        for y in range(-far.top, GB):
            for dx in range(-w // 2, w // 2 + 1):
                s = dx / (w / 2)
                far.set(xx + dx, y, wall[3] if s < -0.5 else wall[2] if s < 0.3 else wall[1])
    ridge(far, GB - 50, 16, R('#2c2658', 5, 0.18), 64, sharp=True)
    glows = []
    for i, x in enumerate(range(20, 512, 64)):
        cols = R('#5ab0f0', 5, 0.3) if i % 2 else R('#a860e8', 5, 0.3)
        y = GB - 52 + r.randint(-14, 10)
        glows += [(gx, gy, gh, cols[3]) for gx, gy, gh in crystal_cluster(far, x + r.randint(0, 20), y, r.randint(14, 24), cols, x)]
    haze(far, '#1c1838', 0.35)
    for gx, gy, gh, col in glows:
        glow(far, gx, gy, gh * 1.2, col, a=0.3)
    out.append(L('far', far, 0.08, -GB))

    fm = Wrap(512, 132); GB = 130
    rock2 = R('#3a3470', 5, 0.24)
    water(fm, 0, 512, GB - 18, GB, ['#122a5a', '#1c4a8a', '#3a7ac8', '#8ad0f8'], 65)
    mounds = [(28, 50, 44), (158, 76, 58), (325, 50, 36), (445, 56, 62)]
    for x, w, h in mounds:
        place(fm, x, GB - 14, w + 6, h + 6, crag, w, h, rock2, x)
    for x in (52, 196, 350):
        waterfall(fm, x, GB - 48, GB - 16, 5, ['#2a5aa8', '#4a90e0', '#8ad0f8', '#e0f8ff'], x)
    glows = []
    for (x, w, h), cols in zip(mounds, [R('#b060e8', 5, 0.3), R('#58c8f0', 5, 0.3), R('#58c8f0', 5, 0.3), R('#e060c8', 5, 0.3)]):
        glows += [(a, b, hh, cols[3]) for a, b, hh in place(fm, x, GB - 14 - int(h * 0.8), 30, 26, crystal_cluster, 14, cols, x)]
    for x in range(230, 290, 12):
        stalagmite(fm, x, GB - 16, r.randint(12, 30), rock2)
    haze(fm, '#1e1a40', 0.25)
    for a, b, hh, col in glows:
        glow(fm, a, b, hh * 1.3, col, a=0.32)
    for x in range(0, 512, 4):
        fm.setf(x, GB - 18, '#9ad8ff')
    out.append(L('pools', fm, 0.22, -GB))

    top2 = Wrap(384, 34)
    rk = R('#2a2456', 5, 0.2)
    for x in range(384):
        h = 3 + int(3 * (noise1(x, 384, 66, 3) + 1))
        for y in range(h):
            top2.set(x, y, rk[1])
        top2.set(x, h, rk[2])
    for i, x in enumerate(range(6, 384, 17)):
        stalactite(top2, x + r.randint(0, 8), 4, r.randint(6, 22 if i % 3 else 30), rk)
    out.append(L('ceiling', top2, 0.4, 0, 'top'))

    mid = Wrap(512, 110); GB = 108
    wood = R('#7a5030', 4, 0.3)
    metal = R('#3a3448', 3, 0.2)
    light = ['#e89030', '#ffc860', '#fff0c0']
    rock3 = R('#3c3670', 5, 0.26)
    ridge(mid, GB - 12, 4, rock3, 67)
    lights = []
    lights += place(mid, 70, GB - 8, 70, 70, lambda t, lx, lb: scaffold(t, 6, 56, lb, 46, wood, metal, light, 1))
    lights += place(mid, 330, GB - 8, 60, 90, lambda t, lx, lb: scaffold(t, 6, 46, lb, 64, wood, metal, light, 2))
    for x, w, h in [(195, 70, 34), (450, 60, 26)]:
        place(mid, x, GB - 4, w + 6, h + 6, crag, w, h, rock3, x)
    glows = []
    for x, top, cols in [(195, 30, R('#58c8f0', 5, 0.32)), (450, 22, R('#b060e8', 5, 0.32)), (250, 8, R('#b060e8', 5, 0.32)), (130, 8, R('#58c8f0', 5, 0.32))]:
        glows += [(a, b, h, cols[3]) for a, b, h in place(mid, x, GB - top, 32, 30, crystal_cluster, 16, cols, x)]
    haze(mid, '#1a1636', 0.12)
    for a, b, h, col in glows:
        glow(mid, a, b, h * 1.2, col, a=0.32)
    for x, y in lights:
        glow(mid, x, y, 9, '#ffc860', a=0.35)
    out.append(L('mine', mid, 0.45, -GB))

    near = Wrap(384, 60); GB = 58
    glows, lights = [], []
    for x, cols, h in [(30, R('#58c8f0', 5, 0.34), 14), (150, R('#b060e8', 5, 0.34), 11), (250, R('#e060c8', 5, 0.34), 9), (340, R('#58c8f0', 5, 0.34), 12)]:
        glows += [(a, b, hh, cols[3]) for a, b, hh in place(near, x, GB, 26, 22, crystal_cluster, h, cols, x)]
    for x in (90, 104):
        place(near, x, GB, 12, 12, crate, 8, wood)
    place(near, 97, GB - 8, 12, 12, crate, 7, wood)
    lights += place(near, 200, GB, 28, 40, lantern_post, 32, wood, metal, light)
    for x in (60, 280, 300):
        place(near, x, GB, 20, 12, rock, 12, 7, R('#3e3870', 4, 0.26))
    for a, b, h, col in glows:
        glow(near, a, b, h * 1.1, col, a=0.3)
    for x, y in lights:
        glow(near, x, y, 8, '#ffc860', a=0.35)
    out.append(L('near', near, 0.7, -GB))

    g = block_ground(256, 68, R('#5a5490', 5, 0.3), R('#3a3462', 5, 0.24), '#0c0a18', 'rock')
    out.append(L('ground', g, 1.0, -8))

    def shard(c, x, base, r):
        crystal(c, x, base, r.randint(4, 7), 1.5, r.uniform(-2, 2), R('#58c8f0' if r.random() < 0.5 else '#b060e8', 5, 0.3))
    out.append(L('front', front_strip(320, 69, 'rock', R('#2a2448', 5, 0.22), extra=shard), 1.25, 7, front=True))
    return sky, '#0c0a18', out


def zone_desert():
    sky = ['#d8502a', '#ea7436', '#f49e50', '#fac880']
    hz = '#f6b878'
    out = []
    sn = Wrap(512, 64)
    sun(sn, 128, 24, 14, ['#fff0a0', '#ffd870', '#ffeaa0', '#fff8d8'])
    out.append(L('sun', sn, 0.01, 0, 'top'))
    sk = Wrap(512, 90)
    r = rng(81)
    for i in range(8):
        streak_cloud(sk, i * 64 + r.randint(0, 30), r.randint(10, 64), r.randint(40, 80), ['#e8784a', '#f8b07a'], i)
    out.append(L('clouds', sk, 0.03, 0, 'top', drift=1))

    far = Wrap(512, 110); GB = 108
    rf = R('#c86a3e', 5, 0.18)
    ridge(far, GB - 28, 6, rf, 82)
    for x0, x1, top in [(10, 50, 58), (90, 116, 48), (200, 250, 54), (400, 440, 60), (470, 500, 44)]:
        mesa(far, x0, x1, GB - top, GB - 20, rf, x0)
    arch(far, 160, GB - 22, 50, 42, 9, rf, 83)
    place(far, 330, GB - 24, 80, 56, castle, 1.15, R('#d89058', 4, 0.2), R('#c07040', 4, 0.2), '#5a2a18', None)
    haze(far, '#f4a868', 0.42, 0.55)
    out.append(L('far', far, 0.07, -GB))

    fm = Wrap(512, 104); GB = 102
    rc = R('#b85a32', 5, 0.26)
    ridge(fm, GB - 22, 6, R('#e8a058', 5, 0.24), 84)
    for x0, x1, top in [(30, 80, 66), (250, 290, 74), (290, 330, 54), (440, 470, 60)]:
        mesa(fm, x0, x1, GB - top, GB - 12, rc, x0 + 1)
    arch(fm, 160, GB - 14, 64, 56, 11, rc, 85)
    ridge(fm, GB - 10, 4, R('#eab068', 5, 0.24), 86)
    haze(fm, hz, 0.26, 0.18)
    out.append(L('canyon', fm, 0.18, -GB))

    mid = Wrap(512, 100); GB = 98
    bone = R('#e8dcc0', 5, 0.28)
    wood = R('#7a4a28', 4, 0.3)
    flagc = R('#c8282a', 4, 0.3)
    ridge(mid, GB - 14, 5, R('#eeb86c', 5, 0.24), 87)
    for x, w, h in [(140, 34, 54), (392, 30, 44), (500, 22, 30)]:
        place(mid, x, GB - 10, w + 6, h + 6, crag, w, h, R('#c0683a', 5, 0.28), x)
    place(mid, 90, GB - 8, 70, 50, skull, 1.5, bone)
    place(mid, 330, GB - 8, 90, 44, ribcage, 1.5, bone)
    place(mid, 200, GB - 10, 40, 70, watchtower, 56, wood, flagc)
    place(mid, 450, GB - 10, 40, 60, watchtower, 46, wood, flagc)
    for x in (30, 260, 400):
        place(mid, x, GB - 9, 22, 30, cactus, 20, R('#4a9a3a', 5, 0.3))
    haze(mid, hz, 0.12)
    out.append(L('bones', mid, 0.42, -GB))

    near = Wrap(384, 60); GB = 58
    place(near, 70, GB, 90, 20, lambda t, lx, lb: rope_fence(t, 2, 84, lb, 12, wood, ['#8a6040', '#c8a070']))
    place(near, 250, GB, 60, 20, lambda t, lx, lb: rope_fence(t, 2, 50, lb, 12, wood, ['#8a6040', '#c8a070']))
    for x, h in [(20, 22), (170, 16), (330, 26)]:
        place(near, x, GB, 22, 34, cactus, h, R('#3f9a3e', 5, 0.32))
    place(near, 140, GB, 22, 20, barrel, wood, '#4a3a38')
    place(near, 128, GB, 12, 12, crate, 9, wood)
    place(near, 300, GB, 40, 30, tent, 30, 22, R('#c84a30', 4, 0.3), '#f0d8a0')
    place(near, 200, GB, 30, 48, banner, 40, flagc, R('#e8b64a', 3, 0.3), wood, emblem='skull')
    for x in (110, 230, 360):
        place(near, x, GB, 18, 12, rock, 12, 7, R('#b0683a', 4, 0.3))
    out.append(L('near', near, 0.7, -GB))

    g = block_ground(256, 88, R('#f2bc6a', 5, 0.28), R('#c07a40', 5, 0.28), '#3a1c10', 'sand')
    out.append(L('ground', g, 1.0, -8))
    out.append(L('front', front_strip(320, 89, 'sand', R('#9a5a30', 5, 0.3)), 1.25, 7, front=True))
    return sky, '#3a1c10', out


def zone_mountains():
    sky = ['#2a66cc', '#4a8ce0', '#82baf0', '#c6e4fa']
    hz = '#cce4f8'
    snow = ['#9ab8e0', '#d4e6f8', '#ffffff']
    icy = ['#b8e0f8', '#e8f8ff']
    out = []
    out.append(L('clouds', clouds_layer(512, 70, ['#9ab8e0', '#c4daf2', '#e8f2fc', '#ffffff'], 101), 0.03, 4, 'top', drift=3))

    far = Wrap(512, 150); GB = 148
    peaks(far, GB - 64, 40, R('#5a7ab8', 5, 0.26), snow, 102, GB - 76)
    peaks(far, GB - 40, 18, R('#6a8ec8', 5, 0.22), snow, 103, GB - 48)
    haze(far, hz, 0.2, 0.5, 0, GB)
    out.append(L('far', far, 0.05, -GB))

    fm = Wrap(512, 134); GB = 132
    rockc = R('#5a6c9c', 5, 0.28)
    snowr = R('#e8f2fc', 5, 0.14)
    ridge(fm, GB - 24, 6, R('#c8dcf0', 5, 0.16), 104)
    cliff(fm, 150, 260, GB - 46, GB - 10, rockc, 105, cap=snowr, icicles=icy)
    place(fm, 205, GB - 47, 70, 60, castle, 1.0, R('#b4d0f0', 4, 0.24), R('#5a8ad8', 4, 0.26), '#80d8ff', '#3a6ad0')
    bridge_arches(fm, 300, 420, GB - 40, GB - 12, R('#7a8cb8', 5, 0.26), 106)
    for x0, x1, top in [(270, 304, 46), (416, 450, 44)]:
        cliff(fm, x0, x1, GB - top, GB - 10, rockc, x0, cap=snowr, icicles=icy)
    icefall(fm, 254, GB - 43, GB - 12, 6, 107)
    icefall(fm, 430, GB - 41, GB - 12, 5, 108)
    floating_rock(fm, 80, GB - 84, 26, rockc, snow)
    floating_rock(fm, 480, GB - 92, 18, rockc, snow)
    r = rng(109)
    for x in range(0, 512, 9):
        if 150 <= x < 260:
            continue
        pine(fm, x + r.randint(0, 4), GB - 10, r.randint(12, 20), R('#2c5a66', 4, 0.2), R('#3a2a20', 3, 0.1), snow=snow)
    ridge(fm, GB - 8, 3, R('#dce8f6', 5, 0.12), 110)
    haze(fm, hz, 0.3, 0.2)
    out.append(L('castle', fm, 0.15, -GB))

    mid = Wrap(512, 110); GB = 108
    ridge(mid, GB - 16, 5, R('#d8e6f6', 5, 0.14), 111)
    icer = R('#4a6cb0', 5, 0.3)
    cliff(mid, 60, 120, GB - 40, GB, icer, 112, cap=snowr, icicles=icy)
    cliff(mid, 330, 380, GB - 52, GB, icer, 113, cap=snowr, icicles=icy)
    icefall(mid, 112, GB - 37, GB - 4, 8, 114)
    icefall(mid, 372, GB - 49, GB - 4, 8, 115)
    for x in [10, 30, 140, 170, 200, 236, 270, 300, 400, 430, 460, 490]:
        h = r.randint(30, 56)
        place(mid, x, GB - 6, int(h * 0.8) + 6, h + 10, pine, h, R('#24564e', 4, 0.24), R('#4a3020', 3, 0.18), snow=snow, seed=x)
    for x, top in [(90, 40), (355, 52)]:
        place(mid, x, GB - top - 1, 26, 30, pine, 20, R('#24564e', 4, 0.24), R('#4a3020', 3, 0.18), snow=snow, seed=x)
    haze(mid, hz, 0.14)
    out.append(L('pines', mid, 0.4, -GB))

    near = Wrap(384, 64); GB = 62
    wood = R('#7a5232', 4, 0.3)
    lights = []
    for x0, ln in [(4, 40), (190, 50)]:
        place(near, x0 + ln // 2, GB, ln + 6, 18, lambda t, lx, lb: fence(t, 2, ln, lb, 11, wood, snow=snow))
    lights += place(near, 120, GB, 50, 50, hut, 30, 20, wood, R('#6a3a2a', 4, 0.26), snow, '#ffd060')
    place(near, 300, GB, 30, 48, banner, 42, R('#2f5cc0', 4, 0.3), R('#e8b64a', 3, 0.3), wood, emblem='snow')
    for x in (60, 270, 350):
        place(near, x, GB, 22, 30, pine, 22, R('#24564e', 4, 0.24), R('#4a3020', 3, 0.18), snow=snow, seed=x)
    for x in (170, 250):
        place(near, x, GB, 16, 20, crystal_cluster, 9, R('#8ad8f8', 5, 0.3), x)
    for x, y in lights:
        glow(near, x, y, 8, '#ffd060', a=0.4)
    out.append(L('near', near, 0.7, -GB))

    g = block_ground(256, 116, R('#e4eefa', 5, 0.16), R('#56709c', 5, 0.28), '#141c30', 'snow')
    out.append(L('ground', g, 1.0, -8))
    out.append(L('front', front_strip(320, 117, 'snow', ['#6a8ab8', '#9ab8dc', '#c8dcf0', '#e8f2fc', '#f4f8ff']), 1.25, 7, front=True))
    return sky, '#141c30', out


def zone_cursed():
    sky = ['#180406', '#420a0c', '#781410', '#b0301a']
    hz = '#9a2a18'
    fire = ['#c8200c', '#ff6a14', '#ffc030', '#fff4b0']
    lavaf = ['#c8300c', '#ff7a18', '#ffc040', '#fff0a0']
    out = []
    mn = Wrap(512, 60)
    glow(mn, 150, 22, 26, '#ff3020', a=0.25)
    mn.ellipse(150, 22, 13, 13, '#ff5a30')
    mn.ellipse(150, 22, 12, 12, '#d82818')
    mn.ellipse(151.5, 22, 10.5, 11, '#3a0608')
    mn.ellipse(153, 22.5, 7.5, 8, '#2a0406')
    out.append(L('moon', mn, 0.01, 0, 'top'))
    sk = Wrap(512, 90)
    r = rng(121)
    for i in range(8):
        streak_cloud(sk, i * 64 + r.randint(0, 30), r.randint(12, 80), r.randint(40, 90), ['#5a1010', '#7a1c14'], i + 50)
    out.append(L('smoke', sk, 0.03, 0, 'top', drift=1.5))

    far = Wrap(512, 130); GB = 128
    peaks(far, GB - 38, 24, R('#4a1418', 5, 0.14), ['#5a1a1a', '#6a2018', '#7a2a1a'], 122, -999)
    for x in range(0, 512, 13):
        stalagmite(far, x + r.randint(0, 8), GB - 26, r.randint(16, 56), R('#3a0e12', 4, 0.12), w=r.randint(3, 6))
    haze(far, '#8a2216', 0.4, 0.55)
    out.append(L('far', far, 0.06, -GB))

    fm = Wrap(512, 120); GB = 118
    st = R('#341a1e', 5, 0.2)
    ridge(fm, GB - 24, 6, R('#2a1214', 5, 0.14), 123, sharp=True)
    glows = []
    glows += place(fm, 140, GB - 18, 80, 80, demon_head, 1.25, st, ['#ff6a14', '#ffc030', '#fff4b0'])
    lights = place(fm, 380, GB - 22, 80, 70, castle, 1.15, R('#2a1a20', 4, 0.14), R('#3a1418', 4, 0.14), '#ff7a2a', '#9a1d2a', spiky=True)
    for x, w, h in [(268, 44, 56), (488, 40, 48)]:
        place(fm, x, GB - 14, w + 6, h + 6, lava_crag, w, h, st, x)
    waterfall(fm, 272, GB - 46, GB - 14, 5, lavaf, 124)
    waterfall(fm, 486, GB - 40, GB - 14, 4, lavaf, 125)
    water(fm, 0, 512, GB - 16, GB, ['#a02008', '#e04a10', '#ff8a20', '#ffd060'], 126)
    haze(fm, hz, 0.28, 0.12)
    for x, y, rr in glows:
        glow(fm, x, y, rr, '#ff8a20', a=0.35)
    for x, y in lights:
        glow(fm, x, y, 3, '#ff7a2a', a=0.35, rings=2)
    for x in (272, 486):
        glow(fm, x + 2, GB - 30, 12, '#ff7a18', a=0.22)
    out.append(L('demon', fm, 0.15, -GB))

    mid = Wrap(512, 110, top=212); GB = 108
    st2 = R('#3a2228', 5, 0.24)
    metal = R('#4a3c40', 4, 0.24)
    ridge(mid, GB - 12, 4, R('#241014', 5, 0.14), 127)
    glows = []
    for x, h in [(40, 64), (160, 50), (300, 70), (430, 56)]:
        glows += place(mid, x, GB - 8, 24, h + 30, pillar_brazier, h, st2, metal, fire)
    chain(mid, 44, GB - 8 - 56, 156, GB - 8 - 44, 14, metal)
    chain(mid, 304, GB - 8 - 62, 426, GB - 8 - 48, 16, metal)
    for x in (100, 230, 370, 490):
        hanging_chain(mid, x, -mid.top, mid.top + r.randint(30, 60), metal)
    place(mid, 226, GB - 2, 60, 50, lava_crag, 54, 42, st2, 128)
    place(mid, 372, GB - 2, 40, 30, lava_crag, 34, 22, st2, 129)
    waterfall(mid, 232, GB - 34, GB - 4, 5, lavaf, 129)
    water(mid, 180, 290, GB - 6, GB, ['#a02008', '#e04a10', '#ff8a20', '#ffd060'], 130)
    haze(mid, hz, 0.12)
    for x, y, rr in glows:
        glow(mid, x, y, rr, '#ff8a20', a=0.35)
    glow(mid, 234, GB - 20, 12, '#ff7a18', a=0.25)
    for x in range(184, 290, 14):
        glow(mid, x, GB - 5, 7, '#ff8a20', a=0.25)
    out.append(L('pillars', mid, 0.4, -GB))

    near = Wrap(384, 64); GB = 62
    glows = []
    for x in (80, 290):
        glows += place(near, x, GB, 24, 60, pillar_brazier, 30, st2, metal, fire)
    for x in (20, 140, 200, 340):
        place(near, x, GB, 18, 14, rock, 12, 8, R('#2e2024', 4, 0.24))
    place(near, 240, GB, 40, 20, ribcage, 0.7, R('#c8b8a0', 5, 0.28), n=4)
    for x, y, rr in glows:
        glow(near, x, y, rr * 0.8, '#ff8a20', a=0.35)
    out.append(L('near', near, 0.7, -GB))

    g = block_ground(256, 130, R('#4a2a2c', 5, 0.24), R('#2c2226', 5, 0.22), '#0e0808', 'lava', mortar='#a02a0c')
    out.append(L('ground', g, 1.0, -8))

    def ember_rock(c, x, base, r):
        c.shaded_ellipse(x + 4, base - 3, 5, 3.5, R('#2a1c20', 4, 0.2))
        c.set(x + 3, base - 4, '#ff8a20'); c.set(x + 4, base - 4, '#ffc040')
    out.append(L('front', front_strip(320, 131, 'lava', R('#24181c', 4, 0.2), extra=ember_rock), 1.25, 7, front=True))
    return sky, '#0e0808', out


NEAR_VEIL = {'plains': '#9ccff4', 'forest': '#3a8a80', 'caves': '#1a1636', 'desert': '#f0a868',
             'mountains': '#c6e4fa', 'cursed': '#5a1410'}

ZONES = {
    'plains': zone_plains,
    'forest': zone_forest,
    'caves': zone_caves,
    'desert': zone_desert,
    'mountains': zone_mountains,
    'cursed': zone_cursed,
}


def build(out_dir):
    """Écrit les calques PNG et renvoie le manifeste {zone: {sky, ground, layers}}."""
    import os
    os.makedirs(out_dir, exist_ok=True)
    manifest = {}
    zones, veil = dict(ZONES), dict(NEAR_VEIL)
    try:  # mondes 7 à 11 (tools/art/scenery2.py), facultatifs
        import scenery2
        zones.update(scenery2.ZONES)
        veil.update(scenery2.NEAR_VEIL)
    except ImportError:
        pass
    import ocean_scenery  # v9.2.0 (monde marin)
    zones.update(ocean_scenery.ZONES)
    veil.update(ocean_scenery.NEAR_VEIL)
    for zone, fn in zones.items():
        sky, ground, layers = fn()
        entries = []
        for lay in layers:
            if lay['name'] == 'near':
                # léger voile : sépare le plan proche des personnages qui marchent devant
                haze(lay['canvas'], veil[zone], 0.1)
            fname = f"{zone}_{lay['name']}.png"
            save_png(lay['canvas'], os.path.join(out_dir, fname))
            e = {'file': fname, 'factor': lay['factor'], 'anchor': lay['anchor'], 'y': lay['y'], 'front': lay['front']}
            if lay['drift']:
                e['drift'] = lay['drift']
            entries.append(e)
        manifest[zone] = {'sky': sky, 'ground': ground, 'layers': entries}
    return manifest


if __name__ == '__main__':
    import json
    import sys
    print(json.dumps(build(sys.argv[1]), indent=1))
