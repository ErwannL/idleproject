"""Boss « durs » (étape 15 de chaque monde) : plus grands que les boss moyens, aura lumineuse.

  hard_scarecrow       Épouvantail maudit (monde 1, plaines)
  hard_werewolf        Loup-garou (monde 2, forêt sombre)
  hard_necromancer     Nécromancien (monde 3, grottes de cristal)
  hard_anubis          Gardien chacal (monde 4, désert)
  hard_frost_giant     Géant du givre (monde 5, montagnes gelées)
  hard_demon_general   Général démon (monde 6, terres maudites)

Chaque boss : <nom> (repos), <nom>_b (marche / respiration), <nom>_atk (attaque),
trois images sur exactement le même canvas. Tournés vers la GAUCHE, pieds sur la dernière ligne.
Chibi 16 bits, lumière en haut à gauche, contour '#1a1226'. Module autonome (aucun aléa).
"""
import math

from lib import Canvas
from knight import spine_fill

OUT = '#1a1226'
WHITE = '#ffffff'
LIGHT = (-0.6, -0.8)
PAD = 40


# ================================================================ outils

class Layer(Canvas):
    """Calque à marge : coordonnées logiques (0..w-1), on peut dessiner hors cadre sans erreur."""

    def __init__(self, w, h):
        super().__init__(w + 2 * PAD, h + 2 * PAD)
        self.lw, self.lh = w, h

    def set(self, x, y, c):
        super().set(x + PAD, y + PAD, c)

    def setf(self, x, y, c):
        super().setf(x + PAD, y + PAD, c)

    def get(self, x, y):
        x, y = int(round(x)) + PAD, int(round(y)) + PAD
        return self.px[y][x] if 0 <= x < self.w and 0 <= y < self.h else None


def stamp(dst, src, outline=OUT):
    """Contour de la pièce puis collage (séparations internes nettes)."""
    if outline:
        src.outline(outline)
    for y in range(src.h):
        row = src.px[y]
        for x in range(src.w):
            if row[x] is not None:
                dst.px[y][x] = row[x]
    return dst


def mask_of(draw, w=120, h=120):
    m = Layer(w, h)
    draw(m)
    return {(x - PAD, y - PAD) for y in range(m.h) for x in range(m.w) if m.px[y][x] is not None}


def shade(c, mask, R, contrast=0.36, bias=0.0, edge=True, light=LIGHT, only_inside=False):
    """Remplit un masque avec une rampe, éclairage haut-gauche + liseré clair / sombre."""
    if not mask:
        return
    xs = [p[0] for p in mask]
    ys = [p[1] for p in mask]
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    rx, ry = max(1.0, (max(xs) - min(xs)) / 2 + 0.5), max(1.0, (max(ys) - min(ys)) / 2 + 0.5)
    n = len(R)
    for (x, y) in mask:
        dx, dy = (x - cx) / rx, (y - cy) / ry
        v = 0.5 + bias + (dx * light[0] + dy * light[1]) * contrast
        if edge:
            if (x - 1, y) not in mask or (x, y - 1) not in mask:
                v += 0.2
            if (x + 1, y) not in mask or (x, y + 1) not in mask:
                v -= 0.22
        (c.setf if only_inside else c.set)(x, y, R[max(0, min(n - 1, int(v * n)))])


def spoly(c, pts, R, **kw):
    m = mask_of(lambda t: t.poly(pts, '#000'))
    shade(c, m, R, **kw)
    return m


def ball(c, cx, cy, rx, ry, R, light=(-0.55, -0.65, 0.52), cuts=(-0.05, 0.33, 0.68, 0.93), only_inside=False):
    """Volume rond à bandes nettes (5 tons)."""
    lx, ly, lz = light
    n = math.sqrt(lx * lx + ly * ly + lz * lz)
    lx, ly, lz = lx / n, ly / n, lz / n
    for y in range(int(cy - ry - 1), int(cy + ry + 2)):
        for x in range(int(cx - rx - 1), int(cx + rx + 2)):
            dx = (x + 0.5 - cx) / max(rx, 0.01)
            dy = (y + 0.5 - cy) / max(ry, 0.01)
            d = dx * dx + dy * dy
            if d > 1:
                continue
            nz = math.sqrt(1 - d)
            v = dx * lx + dy * ly + nz * lz
            idx = sum(1 for k in cuts if v > k)
            (c.setf if only_inside else c.set)(x, y, R[min(idx, len(R) - 1)])


def tube_mask(spine, widths):
    return mask_of(lambda m: spine_fill(m, spine, widths, lambda t, s, x, y: '#000'))


def tube(c, spine, widths, R, **kw):
    m = tube_mask(spine, widths)
    shade(c, m, R, **kw)
    return m


def horn(c, spine, widths, R):
    """Corne / pointe effilée : arête claire côté haut, pointe très claire."""
    def f(t, s, x, y):
        if s < -0.45:
            return R[3] if t < 0.8 else R[4]
        if s > 0.5:
            return R[0]
        return R[2] if t < 0.65 else R[3]
    spine_fill(c, spine, widths, f)


def flame_tongue(c, bx, base, wd, hgt, bend, phase, F):
    """Langue de flamme (F : 5 tons sombre -> blanc), pointe vers le haut."""
    for y in range(int(math.ceil(base - hgt)), int(base) + 1):
        u = max(0.0, min(1.0, (base - y) / hgt))
        cx = bx + bend * u * u + math.sin(u * 6 + phase) * 0.8
        half = wd * (1 - u) ** 0.7 * (0.7 + 0.3 * min(1, u * 5))
        for x in range(int(cx - half - 1), int(cx + half + 2)):
            d = abs(x + 0.5 - cx) / max(half, 0.01)
            if d > 1:
                continue
            k = 4 - int(d * 2.2 + u * 2.4)
            c.set(x, y, F[max(0, min(4, k))])


def arc_fx(c, cx, cy, R, sy, a0, a1, thick, F, lead=0.7, fade=0.3):
    """Croissant d'attaque de l'angle a0 (traînée) vers a1 (tête), en degrés (y vers le bas, sens libre) :
    bord extérieur blanc, traînée pointillée."""
    span = a1 - a0
    sg = 1 if span > 0 else -1
    for y in range(int(cy - R * sy - 2), int(cy + R * sy + 3)):
        for x in range(int(cx - R - 2), int(cx + R + 3)):
            dx = x + 0.5 - cx
            dy = (y + 0.5 - cy) / sy
            r = math.hypot(dx, dy)
            a = math.degrees(math.atan2(dy, dx))
            t = ((a - a0) * sg) % 360 / abs(span)
            if not 0 <= t <= 1:
                continue
            prof = (t / lead) ** 0.75 if t < lead else math.cos((t - lead) / (1 - lead) * math.pi / 2) ** 0.6
            wt = thick * prof
            if wt < 0.6 or not (R - wt <= r <= R):
                continue
            s = (R - r) / wt
            if t < fade and (x + y) % 2 and t < fade * 0.6:
                continue
            idx = len(F) - 1 - int(s * len(F))
            if t < fade:
                idx -= 1
            c.set(x, y, F[max(0, min(len(F) - 1, idx))])


def lens(c, p0, p1, w, R):
    """Trait de griffe effilé aux deux bouts (R : sombre -> blanc, 4 tons)."""
    (x0, y0), (x1, y1) = p0, p1
    dx, dy = x1 - x0, y1 - y0
    n = math.hypot(dx, dy) or 1
    nx, ny = -dy / n, dx / n
    mx, my = (x0 + x1) / 2, (y0 + y1) / 2
    c.poly([p0, (mx + nx * w, my + ny * w), p1, (mx - nx * w, my - ny * w)], R[1])
    c.poly([(x0 + dx * 0.1, y0 + dy * 0.1), (mx + nx * w * 0.5, my + ny * w * 0.5), (x1 - dx * 0.1, y1 - dy * 0.1),
            (mx - nx * w * 0.5, my - ny * w * 0.5)], R[2])
    c.line(x0 + dx * 0.25, y0 + dy * 0.25, x1 - dx * 0.25, y1 - dy * 0.25, R[3])


def glow_ring(c, color, color2=None, every=1):
    """Aura : halo d'un pixel autour de la silhouette (après contour), en pointillé si every > 1."""
    src = [row[:] for row in c.px]
    for y in range(1, c.h - 1):
        for x in range(1, c.w - 1):
            if src[y][x] is not None:
                continue
            if any(src[y + dy][x + dx] is not None for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                if (x + y) % every == 0:
                    c.px[y][x] = color if (color2 is None or (x * 3 + y) % 5) else color2


def dots(c, pts, col_fn):
    """Particules (n'écrase pas la silhouette)."""
    for p in pts:
        x, y, k = p
        if c.get(x, y) is None:
            c.set(x, y, col_fn(k))


def sparkle(c, x, y, col, core=WHITE):
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        if c.get(x + dx, y + dy) is None:
            c.set(x + dx, y + dy, col)
    c.set(x, y, core)


def finalize(c, w, h):
    out = Canvas(w, h)
    for y in range(h):
        for x in range(w):
            out.px[y][x] = c.px[y + PAD][x + PAD]
    return out


FLYING_BOSSES = {'phoenix', 'void_watcher'}  # volants : le bas peut aussi s'agrandir (pas de pieds au sol)


def group_box(layers, w, h, bottom=False):
    """Boîte logique commune aux images d'un boss : le cadre w×h, agrandi juste assez pour ne rien couper,
    symétriquement en largeur (ancrage bas-centre inchangé) et vers le haut ; les pieds restent en bas."""
    e = t = b = 0
    for c in layers:
        xs, ys = [], []
        for y in range(c.h):
            row = c.px[y]
            for x in range(c.w):
                if row[x] is not None:
                    xs.append(x)
                    ys.append(y)
        e = max(e, PAD - min(xs), max(xs) - (PAD + w - 1))
        t = max(t, PAD - min(ys))
        b = max(b, max(ys) - (PAD + h - 1))
    return (-e, -t, w - 1 + e, h - 1 + (b if bottom else 0))


def finalize_box(c, box):
    """Recadre la zone logique box = (x0, y0, x1, y1) dans un Canvas simple."""
    x0, y0, x1, y1 = box
    out = Canvas(x1 - x0 + 1, y1 - y0 + 1)
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            out.px[y - y0][x - x0] = c.px[y + PAD][x + PAD]
    return out


def frames_boxed(fn, reduce=None):
    """Trois images fn(0..2) recadrées sur une même boîte qui ne coupe rien (voir group_box)."""
    res = [fn(f) for f in (0, 1, 2)]
    w, h = res[0][1]
    box = group_box([c for c, _ in res], w, h, bottom=fn.__name__ in FLYING_BOSSES)
    out = []
    for c, _ in res:
        cv = finalize_box(c, box)
        out.append((reduce(cv) if reduce else cv, 0))
    return out


def clipped(c, w, h):
    n = 0
    for y in range(c.h):
        for x in range(c.w):
            if c.px[y][x] is not None and not (PAD <= x < PAD + w and PAD <= y < PAD + h):
                n += 1
    return n


def claws(c, pts, R):
    """Petites griffes claires (pointes vers le bas-gauche)."""
    for x, y in pts:
        c.set(x, y, R[2])
        c.set(x - 1, y + 1, R[3])


# ================================================================ 1. ÉPOUVANTAIL MAUDIT (plaines)

SCW, SCH = 56, 62
PUMP = ['#6a2008', '#b4440c', '#ec7a14', '#ffae3a', '#ffe08a']
STRAW = ['#6a4a14', '#a8781e', '#d8ac38', '#f4d672', '#fff2b8']
COAT = ['#1e1a2e', '#36304e', '#52486a', '#746888', '#9a8eaa']
JEANS = ['#16243a', '#243c5a', '#3a5a7c', '#5a7ea0', '#8aaac4']
HAT = ['#120c16', '#241a26', '#3e2e34', '#5e4646', '#86685a']
WOOD = ['#3e2214', '#6e3e1e', '#9e6230', '#c88e4a', '#ecc07a']
BLADE = ['#2a2e44', '#565c7a', '#9098b0', '#d0d8e6', '#ffffff']
FIRE = ['#7a1a06', '#d2460c', '#ff8a1a', '#ffd04a', '#fff6c0']
VINE = ['#1a3a14', '#2e6020', '#4a8a2c', '#78b440']


def crow(c, x, y, f, perched=False):
    """Corbeau (bec vers la gauche) : corps, aile qui bat, œil rouge."""
    R = HAT
    t = Layer(c.lw, c.lh)
    ball(t, x + 2, y + 1, 3, 2.2, R)
    ball(t, x - 1, y - 1, 1.8, 1.8, R)
    t.set(x - 3, y - 1, STRAW[3]); t.set(x - 4, y, STRAW[1])
    if perched:
        t.line(x + 4, y + 2, x + 7, y + 1, R[1])
        t.set(x + 1, y + 3, STRAW[2]); t.set(x + 3, y + 3, STRAW[2])
        t.line(x + 1, y, x + 4, y + 1, R[3])
    else:
        t.line(x + 4, y + 1, x + 7, y + 2, R[1])
        if f % 2 == 0:
            spoly(t, [(x + 1, y), (x + 4, y - 5), (x + 8, y - 6), (x + 5, y - 2), (x + 3, y + 1)], R, contrast=0.5)
        else:
            spoly(t, [(x + 1, y + 1), (x + 4, y + 5), (x + 8, y + 6), (x + 5, y + 2), (x + 3, y)], R, contrast=0.5)
    stamp(c, t)
    c.set(x - 1, y - 2, FIRE[3])


def straw_tuft(c, x, y, dirs, R=STRAW):
    for i, (dx, dy) in enumerate(dirs):
        c.line(x, y, x + dx, y + dy, R[2 + (i % 2)])
        c.set(x + dx, y + dy, R[4] if i % 2 == 0 else R[3])


def scarecrow(f):
    W, H = SCW, SCH
    G = H - 2
    new = lambda: Layer(W, H)
    c = new()
    atk = f == 2
    by = 1 if f == 1 else 0
    lean = -2 if atk else 0          # tête et buste penchés vers l'avant en attaque
    X = 2                            # décalage horizontal global
    T = 4                            # décalage vertical du buste

    # ---- piquet / croix dans le dos (silhouette d'épouvantail)
    t = new()
    tube(t, [(X + 34, 14 + by), (X + 34, G - 8)], [1.6, 1.6], WOOD, bias=-0.1)
    tube(t, [(X + 22 + lean, 25 + T + by), (X + 50, 24 + T + by)], [1.4, 1.4], WOOD, bias=-0.1)
    stamp(c, t)

    # ---- bras arrière (droite) : manche en lambeaux le long de la traverse, main de paille
    t = new()
    tube(t, [(X + 37, 26 + T + by), (X + 45, 25 + T + by), (X + 48, 27 + T + by)], [3.4, 3.2, 2.8], COAT, bias=-0.14)
    t.set(X + 47, 30 + T + by, COAT[1]); t.set(X + 44, 29 + T + by, COAT[1])
    stamp(c, t)
    straw_tuft(c, X + 49, 28 + T + by, [(3, -2), (3, 0), (3, 2), (1, 3)])

    # ---- jambes : pantalon rapiécé, bottes usées
    if f == 1:
        legs = [((X + 31, 47), (X + 35, 52), (X + 37, G - 3)), ((X + 27, 47), (X + 23, 52), (X + 21, G - 3))]
    elif atk:
        legs = [((X + 32, 47), (X + 38, 52), (X + 41, G - 3)), ((X + 26, 47), (X + 20, 52), (X + 16, G - 3))]
    else:
        legs = [((X + 32, 47), (X + 33, 52), (X + 34, G - 3)), ((X + 26, 47), (X + 25, 52), (X + 24, G - 3))]
    for i, sp in enumerate(legs):
        t = new()
        tube(t, list(sp), [3.4, 3.0, 2.8], JEANS, bias=-0.15 if i == 0 else 0)
        if i == 1:
            px_, py_ = sp[1]
            t.rect(px_ - 1, py_ - 1, 3, 3, WOOD[2])
            t.set(px_ - 1, py_ - 1, WOOD[3]); t.set(px_ + 1, py_ + 1, WOOD[1])
        stamp(c, t)
        fx_ = sp[2][0]
        t = new()
        spoly(t, [(fx_ - 4, G - 3), (fx_ + 2, G - 3), (fx_ + 3, G), (fx_ - 5, G), (fx_ - 6, G - 1)],
              HAT, contrast=0.4, bias=0.05 if i else -0.05)
        stamp(c, t)
        straw_tuft(c, fx_ - 1, G - 4, [(-2, -1), (2, -1), (-3, 0)])

    # ---- manteau en lambeaux
    t = new()
    sw = 1 if f == 1 else 0
    L0 = X + 19 + lean
    yb = T + by
    hem = [(L0 - 3, 50 + sw), (X + 20, 47), (X + 22, 52 - sw), (X + 25, 48), (X + 28, 53 + sw), (X + 31, 48),
           (X + 34, 52 - sw), (X + 37, 47 + sw), (X + 40, 51), (X + 39, 34 + yb)]
    m = spoly(t, [(L0 + 2, 23 + yb), (X + 37, 23 + yb), (X + 40, 27 + yb)] + hem[::-1] + [(L0 - 1, 33 + yb)],
              COAT, contrast=0.42)
    t.rect(X + 33, 34 + yb, 4, 4, WOOD[2])
    t.line(X + 33, 34 + yb, X + 36, 34 + yb, WOOD[3])
    for k in range(4):
        t.set(X + 32, 34 + yb + k, OUT if k % 2 else STRAW[4])
    t.rect(L0 + 1, 41, 3, 3, VINE[1])
    t.set(L0 + 1, 41, VINE[3])
    for k in range(3):
        t.set(X + 28 + lean // 2, 29 + yb + k * 4, STRAW[3])
    for x in range(L0 - 2, X + 41):
        if (x, 43 + by) in m:
            t.set(x, 43 + by, STRAW[1] if x % 2 else STRAW[2])
    t.set(X + 27, 44 + by, STRAW[3]); t.set(X + 26, 45 + by, STRAW[2]); t.set(X + 28, 46 + by, STRAW[1])
    stamp(c, t)
    straw_tuft(c, X + 20, 50, [(-2, 2), (0, 3)])
    straw_tuft(c, X + 35, 51, [(1, 3), (-1, 3)])
    straw_tuft(c, X + 38, 35 + yb, [(3, 1), (3, 3)])

    # ---- tête : citrouille sculptée (grosse, chibi)
    hx, hy = X + 27 + lean, 19 + by
    t = new()
    ball(t, hx, hy, 11, 8.5, PUMP)
    for dx in (-8, 8):
        for y in range(int(hy - 7), int(hy + 8)):
            xx = hx + dx * (1 - ((y - hy) / 9) ** 2) ** 0.5 - 0.5
            if t.get(xx, y) is not None:
                t.set(xx, y, PUMP[1] if dx >= 0 else PUMP[2])
    stamp(c, t)
    # visage sculpté (décalé vers l'avant / la gauche) : yeux de feu en colère, sourire dentelé
    fx0 = hx - 3
    ix, iy = int(fx0), int(hy)
    c.poly([(fx0 - 7, hy - 3.5), (fx0 - 1, hy - 1), (fx0 - 2, hy + 1.5), (fx0 - 6, hy + 1.5)], OUT)
    c.poly([(fx0 + 2, hy - 1), (fx0 + 8, hy - 3.5), (fx0 + 7, hy + 1.5), (fx0 + 3, hy + 1.5)], OUT)
    for x, y in ((ix - 5, iy), (ix - 4, iy), (ix - 3, iy), (ix + 3, iy), (ix + 4, iy), (ix + 5, iy),
                 (ix - 5, iy - 1), (ix - 4, iy - 1), (ix + 4, iy - 1), (ix + 5, iy - 1)):
        c.setf(x, y, FIRE[3])
    c.setf(ix - 4, iy, FIRE[4]); c.setf(ix + 4, iy, FIRE[4])
    mh = 4 if atk else 3
    my = hy + 3
    c.poly([(fx0 - 8, my), (fx0 + 9, my - 1), (fx0 + 8, my + mh - 1), (fx0 + 4, my + mh), (fx0 - 4, my + mh),
            (fx0 - 7, my + mh - 1)], OUT)
    iy = int(my)
    for x in range(ix - 6, ix + 8):
        for y in range(iy + 1, iy + mh):
            c.setf(x, y, FIRE[3] if y < iy + mh - 1 else FIRE[2])
        if atk and x % 2:
            c.setf(x, iy + 1, FIRE[4])
    for x in (ix - 5, ix - 1, ix + 3, ix + 7):
        c.setf(x, iy, PUMP[2]); c.setf(x + 1, iy, PUMP[1])
    for x in (ix - 3, ix + 1, ix + 5):
        c.setf(x, iy + mh, PUMP[2]); c.setf(x, iy + mh - 1, PUMP[1])
    # cicatrice recousue sur la joue
    c.line(hx + 7, hy - 3, hx + 9, hy + 3, OUT)
    for k in range(3):
        c.line(hx + 6 + k * 0.7, hy - 2 + k * 2, hx + 9 + k * 0.7, hy - 3 + k * 2, STRAW[3])

    # ---- chapeau pointu à large bord
    t = new()
    spoly(t, [(hx - 14, hy - 7), (hx + 12, hy - 10), (hx + 14, hy - 8), (hx + 3, hy - 6), (hx - 12, hy - 5)],
          HAT, contrast=0.3)
    tip = (hx + 11, hy - 18 + by)
    spoly(t, [(hx - 7, hy - 8), (hx - 4, hy - 13), (hx + 1, hy - 16), tip, (hx + 6, hy - 13), (hx + 8, hy - 9)],
          HAT, contrast=0.4)
    for x in range(int(hx - 7), int(hx + 9)):
        if t.get(x, hy - 10) is not None:
            t.set(x, hy - 10, WOOD[2] if x % 4 else WOOD[3])
            t.set(x, hy - 9, WOOD[1])
    t.set(hx - 1, hy - 14, OUT); t.set(hx, hy - 14, OUT); t.set(hx, hy - 13, FIRE[1])
    stamp(c, t)
    straw_tuft(c, hx - 12, hy - 5, [(-2, 2), (-1, 3), (0, 3)])
    straw_tuft(c, hx + 11, hy - 6, [(2, 2), (1, 3)])

    # ---- faux
    t = new()
    if atk:
        # faux abattue : manche vers l'avant, lame qui fauche vers le bas
        a0, a1 = (X + 30, 22), (X + 3, 41)
        tube(t, [a0, a1], [1.6, 1.6], WOOD)
        bx_, by_ = a1
        spoly(t, [(bx_ - 2, by_ - 1), (bx_ + 1, by_ - 2), (bx_ + 6, by_ + 2), (bx_ + 13, by_ + 6), (bx_ + 19, by_ + 7),
                  (bx_ + 11, by_ + 9), (bx_ + 4, by_ + 6), (bx_ - 1, by_ + 2)], BLADE, contrast=0.45)
        t.line(bx_ + 1, by_ - 1, bx_ + 12, by_ + 5, BLADE[4])
        t.set(bx_ + 18, by_ + 7, BLADE[4])
    else:
        sway = 1 if f == 1 else 0
        top = (X + 13 + sway, 2)
        tube(t, [(X + 11, G - 8), top], [1.6, 1.6], WOOD)
        spoly(t, [(top[0] - 1, top[1] + 2), (top[0] + 1, top[1] - 1), (top[0] - 6, top[1] - 1), (top[0] - 11, top[1] + 2),
                  (top[0] - 13, top[1] + 8), (top[0] - 8, top[1] + 3)], BLADE, contrast=0.45)
        t.line(top[0] - 1, top[1] - 1, top[0] - 8, top[1], BLADE[4])
        t.set(top[0] - 12, top[1] + 6, BLADE[4])
    stamp(c, t)

    # ---- bras avant : manche vers la faux, main de paille
    t = new()
    if atk:
        tube(t, [(X + 24, 30), (X + 18, 30), (X + 14, 31)], [3.6, 3.2, 2.8], COAT)
        hand = (X + 12, 31)
    else:
        tube(t, [(X + 24, 30 + by), (X + 18, 32 + by), (X + 15, 32 + by)], [3.6, 3.2, 2.8], COAT)
        hand = (X + 12, 32 + by)
    stamp(c, t)
    t = new()
    ball(t, hand[0], hand[1], 2.4, 2.2, STRAW)
    stamp(c, t)
    straw_tuft(c, hand[0] - 1, hand[1] + 2, [(-2, 2), (0, 3), (-3, 0)])

    # ---- corbeaux
    if atk:
        crow(c, X + 43, 6, 0)
        crow(c, X + 44, 40, 1)
    else:
        crow(c, X + 44, 24 + by, 0, perched=True)
        crow(c, X + 42, 7 + by * 2, f)

    # ---- effets : arc de faux, aura orange, braises
    if atk:
        fx = new()
        arc_fx(fx, X + 26, 30, 26, 1.0, 250, 140, 12, FIRE, lead=0.6)
        for y in range(fx.h):
            for x in range(fx.w):
                if c.px[y][x] is not None:
                    fx.px[y][x] = None
        stamp(c, fx, None)
    glow_ring(c, FIRE[1], FIRE[2], every=2)
    emb = ((1, 32, 3), (36, 2, 2), (54, 52, 2), (4, 57, 3), (52, 16, 3)) if f != 1 else \
          ((2, 29, 2), (37, 0, 3), (54, 49, 3), (5, 54, 2), (52, 13, 2))
    dots(c, emb, lambda k: FIRE[k])
    return c, (W, H)


# ================================================================ 2. LOUP-GAROU (forêt sombre)

WWW, WWH = 60, 60
FUR = ['#1c1a2a', '#312f48', '#4a4864', '#6c6a8a', '#9c9ab8']
FURL = ['#4a4250', '#6e6470', '#988c94', '#c0b2b2', '#e4d8d2']       # poitrail / ventre
WEYE = ['#c06a10', '#ffc832', '#fff6a0']
MAW = ['#4a0a16', '#9a1a2a', '#e0485a']
CLAW = ['#4c4258', '#a0988c', '#e6dfc6', '#ffffff']
MOON = ['#6a7aa8', '#a8b4d4', '#d8e0f0', '#f4f8ff']
MIST = ['#3a3e5c', '#565c7e', '#7e86a6']
SLASH = ['#5a3a8a', '#a07ad0', '#e4d4ff', '#ffffff']


def tufts(c, pts, R, w=1.6, **kw):
    """Mèches de fourrure en pointe (bord déchiqueté) : (x, y, dx, dy) base -> pointe."""
    for x, y, dx, dy in pts:
        nx, ny = -dy, dx
        ln = math.hypot(nx, ny) or 1
        nx, ny = nx / ln * w, ny / ln * w
        spoly(c, [(x - nx, y - ny), (x + dx, y + dy), (x + nx, y + ny)], R, contrast=0.5, **kw)


def jag_mask(pts, w=1.8):
    """Masque de mèches en pointe : (x, y, dx, dy) base -> pointe."""
    m = set()
    for x, y, dx, dy in pts:
        nx, ny = -dy, dx
        ln = math.hypot(nx, ny) or 1
        nx, ny = nx / ln * w, ny / ln * w
        m |= mask_of(lambda t: t.poly([(x - nx, y - ny), (x + dx, y + dy), (x + nx, y + ny)], '#000'))
    return m


def fur_strokes(c, mask, col, step=(7, 3, 11), length=2, dx=1, dy=1, skip=None):
    """Petits traits de fourrure à l'intérieur d'un masque (motif déterministe)."""
    a, b, n = step
    for (x, y) in mask:
        if (x * a + y * b) % n:
            continue
        if any((x + ex, y + ey) not in mask for ex in (-2, 0, 2) for ey in (-2, 0, 2)):
            continue
        if skip and skip(x, y):
            continue
        for k in range(length):
            c.setf(x + dx * k, y + dy * k, col)


def werewolf(f):
    W, H = WWW, WWH
    G = H - 2
    new = lambda: Layer(W, H)
    c = new()
    atk = f == 2
    by = 1 if f == 1 else 0
    lx = -3 if atk else 0                     # bond vers l'avant en attaque
    FB = [FUR[0], FUR[0], FUR[1], FUR[2], FUR[3]]   # plan arrière

    # ---- lune derrière (halo)
    t = new()
    mx, my = 46, 12
    t.ellipse(mx, my, 10, 10, MOON[0])
    t.ellipse(mx, my, 9, 9, MOON[1])
    ball(t, mx, my, 8, 8, [MOON[1], MOON[2], MOON[2], MOON[3], MOON[3]])
    for (x, y, r) in ((43, 10, 1.6), (49, 15, 1.2), (47, 7, 1)):
        t.ellipse(x, y, r, r, MOON[1], only_inside=True)
    stamp(c, t, None)

    # ---- queue touffue
    t = new()
    sw = 2 if f == 1 else 0
    tm = tube_mask([(45 + lx, 42 + by), (51, 45 + sw), (55, 50 + sw), (56, 54 + sw)], [3.0, 4.2, 3.4, 1.0])
    tm |= jag_mask([(51, 48 + sw, 3, 3), (55, 52 + sw, 3, 2), (53, 44 + sw, 4, -1), (56, 53 + sw, 1, 4)])
    shade(t, tm, FB, contrast=0.45)
    fur_strokes(t, tm, FUR[0])
    for (x, y) in tm:
        if y >= 54 + sw:
            t.set(x, y, FURL[2])
    stamp(c, t)

    # ---- bras lointain (derrière le corps)
    t = new()
    if atk:
        arm = [(40 + lx, 26), (47, 30), (52, 26)]
    else:
        arm = [(40, 27 + by), (45, 35 + by), (44, 42 + by)]
    tube(t, arm, [4.0, 3.2, 2.8], FB)
    ball(t, arm[-1][0], arm[-1][1] + 1, 3.0, 2.6, FB)
    stamp(c, t)
    ax_, ay_ = arm[-1]
    if atk:
        claws(c, [(ax_ + 2, ay_ - 2), (ax_ + 3, ay_), (ax_ + 1, ay_ - 3)], CLAW)
    else:
        claws(c, [(ax_ - 2, ay_ + 3), (ax_, ay_ + 4), (ax_ + 2, ay_ + 3)], CLAW)

    # ---- jambes digitigrades (cuisse, jarret, patte)
    if f == 1:
        lg = [((40, 42), (45, 48), (42, 54), (44, G)), ((32, 43), (29, 49), (26, 54), (25, G))]
    elif atk:
        lg = [((40, 42), (47, 47), (48, 53), (51, G)), ((31, 43), (25, 48), (20, 54), (18, G))]
    else:
        lg = [((40, 42), (46, 48), (44, 54), (46, G)), ((32, 43), (29, 49), (28, 54), (28, G))]
    for i, (hip, knee, hock, paw) in enumerate(lg):
        R = FUR if i else FB
        t = new()
        hip = (hip[0] + lx, hip[1] + by)
        lm = mask_of(lambda m: m.ellipse(hip[0], hip[1] + 1, 6, 5.5, '#000'))
        lm |= tube_mask([hip, knee, hock], [4.6, 3.4, 2.2]) | tube_mask([hock, (paw[0], paw[1] - 2)], [2.2, 2.2])
        lm |= jag_mask([(knee[0] + 1, knee[1], 3, 1), (hip[0] + 4, hip[1] + 4, 3, 2), (hock[0] + 1, hock[1], 2, 1)])
        shade(t, lm, R, contrast=0.45)
        fur_strokes(t, lm, R[0])
        spoly(t, [(paw[0] - 5, G - 3), (paw[0] + 2, G - 4), (paw[0] + 3, G), (paw[0] - 6, G)], R)
        stamp(c, t)
        claws(c, [(paw[0] - 6, G - 1), (paw[0] - 4, G - 1), (paw[0] - 2, G - 1)], CLAW)

    # ---- torse massif voûté : une seule silhouette hirsute
    t = new()
    ox = lx
    bm = mask_of(lambda m: (m.ellipse(34 + ox, 30 + by, 13, 12, '#000'), m.ellipse(37 + ox, 39 + by, 8, 6, '#000'),
                            m.ellipse(35 + ox, 24 + by, 10, 7, '#000')))
    bm |= jag_mask([(31 + ox, 18 + by, 5, -3), (36 + ox, 18 + by, 6, -2), (41 + ox, 20 + by, 6, 0), (45 + ox, 24 + by, 5, 3),
                    (46 + ox, 29 + by, 4, 4), (46 + ox, 35 + by, 3, 4), (43 + ox, 42 + by, 3, 3)], w=2.4)
    shade(t, bm, FUR, contrast=0.48)
    fur_strokes(t, bm, FUR[1], step=(7, 3, 13), length=3)
    # poitrail clair en pointes
    pm = mask_of(lambda m: m.poly([(22 + ox, 24 + by), (31 + ox, 25 + by), (31 + ox, 36 + by), (29 + ox, 41 + by),
                                    (27 + ox, 38 + by), (25 + ox, 41 + by), (23 + ox, 36 + by), (21 + ox, 30 + by)], '#000'))
    shade(t, pm, FURL, only_inside=True)
    for k in range(3):
        t.line(23 + ox, 30 + by + k * 3, 27 + ox, 31 + by + k * 3, FURL[1])
    stamp(c, t)

    # ---- tête de loup (museau effilé vers la gauche)
    hx, hy = (20 + lx, 17 + by) if not atk else (14, 19)
    up = -1 if atk else 0
    t = new()
    spoly(t, [(hx - 2, hy - 4), (hx + 1, hy - 14), (hx + 5, hy - 4)], FB, contrast=0.5)       # oreille lointaine
    stamp(c, t)
    t = new()
    hm = mask_of(lambda m: m.ellipse(hx + 3, hy, 8.5, 7.5, '#000'))
    hm |= mask_of(lambda m: m.poly([(hx - 2, hy - 5 + up), (hx - 6, hy - 3 + up), (hx - 10, hy - 2 + up),
                                    (hx - 11, hy + up), (hx - 10, hy + 2), (hx + 2, hy + 3)], '#000'))
    hm |= jag_mask([(hx + 9, hy + 3, 5, 3), (hx + 7, hy + 6, 2, 4), (hx + 10, hy - 2, 5, 1)], w=2.0)
    shade(t, hm, FUR, contrast=0.5)
    fur_strokes(t, hm, FUR[1], step=(5, 3, 9), skip=lambda x, y: x < hx + 3)
    stamp(c, t)
    # mâchoire inférieure (claire)
    t = new()
    if atk:
        jm = mask_of(lambda m: m.poly([(hx - 7, hy + 7), (hx - 2, hy + 3), (hx + 4, hy + 3), (hx + 4, hy + 6),
                                       (hx - 6, hy + 9)], '#000'))
    else:
        jm = mask_of(lambda m: m.poly([(hx - 8, hy + 2), (hx + 3, hy + 2), (hx + 4, hy + 5), (hx - 5, hy + 5)], '#000'))
    jm |= jag_mask([(hx + 1, hy + 5, -1, 4), (hx + 4, hy + 5, 1, 4)], w=1.8)
    shade(t, jm, FURL, contrast=0.4, bias=-0.1)
    stamp(c, t)
    if atk:
        c.poly([(hx - 9, hy + 1.5), (hx + 2, hy + 1.5), (hx - 1, hy + 4), (hx - 6, hy + 7)], MAW[0])
        c.line(hx - 5, hy + 5, hx - 1, hy + 3, MAW[1])
        c.set(hx - 3, hy + 4, MAW[2])
        for x in (hx - 9, hx - 6, hx - 2):
            c.set(x, hy + 2, CLAW[3]); c.set(x, hy + 3, CLAW[2])
        c.set(hx - 6, hy + 6, CLAW[3]); c.set(hx - 5, hy + 5, CLAW[3])
    else:
        c.line(hx - 9, hy + 2, hx + 2, hy + 2, OUT)
        c.set(hx - 8, hy + 3, CLAW[3]); c.set(hx - 4, hy + 3, CLAW[3])
        c.set(hx - 6, hy + 1, CLAW[3]); c.set(hx - 1, hy + 3, CLAW[2])
    # truffe + arête du museau
    ny_ = hy - 1 + up
    c.rect(hx - 12, ny_ - 1, 2, 2, OUT); c.set(hx - 11, ny_ - 1, FUR[3])
    c.line(hx - 8, ny_ - 2, hx - 3, ny_ - 3, FUR[4])
    # œil jaune furieux sous un sourcil lourd
    ex, ey = int(hx - 1), int(hy - 4)
    c.rect(ex - 1, ey, 5, 2, WEYE[1])
    c.set(ex - 1, ey, WEYE[2]); c.set(ex, ey, WEYE[2]); c.set(ex + 3, ey + 1, WEYE[0])
    c.set(ex + 1, ey, OUT); c.set(ex + 1, ey + 1, OUT)
    c.line(ex - 3, ey - 2, ex + 4, ey, OUT)
    c.line(ex - 2, ey - 1, ex + 4, ey - 1, OUT)
    c.set(ex - 2, ey + 1, WEYE[0])
    # oreille proche
    t = new()
    spoly(t, [(hx + 3, hy - 5), (hx + 7, hy - 16), (hx + 11, hy - 4)], FUR, contrast=0.5)
    t.poly([(hx + 5, hy - 6), (hx + 7, hy - 12), (hx + 9, hy - 6)], FURL[0])
    t.line(hx + 7, hy - 7, hx + 7, hy - 10, MAW[1])
    stamp(c, t)

    # ---- bras proche
    t = new()
    if atk:
        arm = [(29, 27), (20, 29), (10, 33)]          # coup de griffes vers l'avant
    else:
        arm = [(31 + lx, 27 + by), (28, 37 + by), (19, 42 + by)]
    am = mask_of(lambda m: m.ellipse(arm[0][0], arm[0][1], 5.5, 5.5, '#000'))
    am |= tube_mask(arm, [4.4, 3.4, 3.0])
    hx2, hy2 = arm[-1]
    am |= mask_of(lambda m: m.ellipse(hx2 - 1, hy2 + 1, 3.6, 3.2, '#000'))
    am |= jag_mask([(arm[1][0] + 1, arm[1][1] + 2, 3, 3), (arm[0][0] + 3, arm[0][1] + 4, 3, 3)], w=2.0)
    shade(t, am, FUR, contrast=0.45)
    fur_strokes(t, am, FUR[1])
    stamp(c, t)
    for k in range(4):
        if atk:
            x0, y0 = hx2 - 3, hy2 - 1 + k * 1.6
            c.line(x0, y0, x0 - 3, y0 + 1, CLAW[2]); c.set(x0 - 3, y0 + 1, CLAW[3])
        else:
            x0, y0 = hx2 - 4 + k * 1.6, hy2 + 3
            c.line(x0, y0, x0 - 1, y0 + 2, CLAW[2]); c.set(x0 - 1, y0 + 2, CLAW[3])

    # ---- effets
    if atk:
        fx = new()
        for k in range(3):
            lens(fx, (15 + k * 5, 24 + k * 2), (1 + k * 5, 53), 2.4, SLASH)
        stamp(c, fx, None)
    glow_ring(c, '#4a3c78', '#8a6ad0', every=2)
    # brume au sol (tramée)
    mist = new()
    ph = 3 if f == 1 else 0
    for k, (x, w, h) in enumerate(((4, 10, 2), (17, 12, 2.5), (34, 10, 2), (52, 10, 2.2))):
        mist.ellipse(x + ph, G - 1, w / 2, h, MIST[k % 2])
        mist.ellipse(x + ph - 1, G - 1.5, w / 3, h / 2, MIST[2])
    for y in range(mist.h):
        for x in range(mist.w):
            if mist.px[y][x] is not None and c.px[y][x] is None and (x + y) % 2 == 0:
                c.px[y][x] = mist.px[y][x]
    dots(c, ((6, 30, 1), (55, 28, 2), (10, 46, 1), (55, 2, 2)) if f != 1 else
         ((5, 28, 2), (56, 26, 1), (11, 43, 2), (56, 4, 1)), lambda k: MIST[k])
    return c, (W, H)


# ================================================================ 3. NÉCROMANCIEN (grottes de cristal)

NCW, NCH = 56, 60
ROBE = ['#110b19', '#21152d', '#352344', '#4c335f', '#6a4b80']
NG = ['#0c3a24', '#16883e', '#3ee062', '#a6ffa8', '#eeffee']        # magie verte
BONE = ['#4c4258', '#8e8478', '#c4b99e', '#e6dfc6', '#fcf9ec']
STAFF = ['#1e1414', '#3a2622', '#5a3c30', '#7e5a44', '#a07a5a']
CRYS = ['#2a1a5a', '#5a3ab0', '#9a7aea', '#d8c8ff']                  # cristal violet (monde 3)


def skull(c, x, y, s=1, R=BONE, eye=NG, jaw_open=False):
    """Petit crâne flottant (regard à gauche) : s=1 petit, s=2 moyen."""
    t = Layer(c.lw, c.lh)
    rx, ry = 2.6 * s, 2.3 * s
    ball(t, x, y, rx, ry, R)
    t.rect(int(x - rx + 1), int(y + ry - 1), int(rx * 1.6), 2 if s == 1 else 3, R[2])
    stamp(c, t)
    if s == 1:
        ex, ey = int(x - rx * 0.55), int(y)
        c.set(ex, ey, eye[2]); c.set(ex + 2, ey, eye[2])
        c.set(ex + 1, ey + 1, OUT)
    else:
        ex, ey = int(x - rx * 0.75), int(y - 1)
        for ox_ in (0, 3):
            c.rect(ex + ox_, ey, 2, 2, OUT)
            c.set(ex + ox_, ey, eye[3]); c.set(ex + ox_ + 1, ey + 1, eye[2])
        c.line(ex - 1, ey - 1, ex + 1, ey, OUT); c.line(ex + 3, ey, ex + 5, ey - 1, OUT)
        c.set(ex + 2, ey + 2, OUT)
    yy = int(y + ry) - (1 if s > 1 else 0)
    for k in range(int(rx * 1.4)):
        if k % 2:
            c.set(int(x - rx + 1) + k, yy, OUT)
            if s > 1:
                c.set(int(x - rx + 1) + k, yy + 1, OUT)
    if jaw_open:
        c.set(int(x - rx + 1), yy + 1, OUT)


def ghost_flame(c, x, y, h, phase, R=NG):
    """Flamme verte qui s'échappe vers le haut-droite."""
    flame_tongue(c, x, y, 2.4, h, 2.5, phase, [R[0], R[1], R[2], R[3], R[4]])


def necromancer(f):
    W, H = NCW, NCH
    G = H - 2
    new = lambda: Layer(W, H)
    c = new()
    atk = f == 2
    by = 1 if f == 1 else 0
    X = 2

    # ---- cercle runique au sol
    t = new()
    cx_, cy_ = X + 27, G - 1
    for a in range(0, 360, 3):
        r = math.radians(a)
        px, py = cx_ + math.cos(r) * 22, cy_ - 0.5 + math.sin(r) * 2.6
        t.set(px, py, NG[1] if (a // 3) % 5 else NG[3])
    for a in range(10, 360, 40):
        r = math.radians(a + (20 if f == 1 else 0))
        px, py = cx_ + math.cos(r) * 18, cy_ + math.sin(r) * 2.2
        t.set(px, py, NG[2]); t.set(px + 1, py, NG[3])
    stamp(c, t, None)

    # ---- flammes vertes derrière (aura)
    t = new()
    ph = 1.2 if f == 1 else 0
    for k, (x, hgt) in enumerate(((X + 18, 14), (X + 25, 20), (X + 33, 24), (X + 40, 16))):
        flame_tongue(t, x, G - 3, 3.2, hgt + (2 if (k + f) % 2 else 0), 3 + k, ph + k, [NG[0], NG[0], NG[1], NG[1], NG[2]])
    stamp(c, t, None)

    # ---- bras lointain : main squelettique levée qui tient une flamme
    t = new()
    sx, sy = X + 36, 26 + by
    hand = (X + 44, 18 + by) if not atk else (X + 40, 22)
    tube(t, [(sx, sy), ((sx + hand[0]) / 2 + 2, sy - 1), hand], [3.4, 3.0, 3.6], [ROBE[0], ROBE[0], ROBE[1], ROBE[2], ROBE[3]])
    stamp(c, t)
    t = new()
    ball(t, hand[0], hand[1], 1.8, 1.6, BONE)
    for k in range(4):
        t.line(hand[0] - 1.5 + k * 1.1, hand[1] - 1, hand[0] - 2.5 + k * 1.6, hand[1] - 4 + abs(k - 1.5) * 0.6, BONE[2 if k else 3])
    stamp(c, t)
    t = new()
    ghost_flame(t, hand[0], hand[1] - 3, 9 + (2 if f == 1 else 0), 1.5 + f)
    for y in range(t.h):
        for x in range(t.w):
            if t.px[y][x] is not None and c.px[y][x] is not None:
                t.px[y][x] = None
    stamp(c, t, None)

    # ---- robe : grande silhouette en cloche, bas déchiqueté
    t = new()
    sw = 1 if f == 1 else -1 if atk else 0
    hem = []
    for k in range(9):
        x = X + 12 + k * 3.6
        hem.append((x + sw, G - (0 if k % 2 == 0 else 3)))
    rm = mask_of(lambda m: m.poly([(X + 21, 20 + by), (X + 35, 20 + by), (X + 40, 32 + by), (X + 44, 50)] +
                                  list(reversed(hem)) + [(X + 10, 50), (X + 16, 32 + by)], '#000'))
    rm = {p for p in rm if p[1] <= G}
    shade(t, rm, ROBE, contrast=0.4)
    # plis verticaux
    for k, x in enumerate((X + 19, X + 25, X + 31, X + 37)):
        for y in range(34 + by, G):
            if (x, y) in rm:
                t.setf(x, y, ROBE[1] if k else ROBE[0])
    # bande runique verte au centre
    for y in range(28 + by, G - 2):
        t.setf(X + 28, y, NG[1] if y % 4 else NG[3])
        if y % 4 == 0:
            t.setf(X + 27, y, NG[2]); t.setf(X + 29, y, NG[2])
    # ceinture de crânes
    stamp(c, t)
    for x in range(X + 17, X + 40):
        if c.get(x, 36 + by) is not None:
            c.set(x, 36 + by, BONE[1] if x % 2 else BONE[2])
            c.set(x, 37 + by, OUT if x % 2 else BONE[0])
    skull(c, X + 27, 37 + by, 1)

    # ---- capuche + crâne
    hx, hy = (X + 25, 15 + by) if not atk else (X + 23, 16)
    t = new()
    spoly(t, [(hx - 9, hy + 8), (hx - 10, hy - 1), (hx - 6, hy - 8), (hx + 2, hy - 12), (hx + 9, hy - 13), (hx + 13, hy - 10),
              (hx + 10, hy - 7), (hx + 11, hy + 2), (hx + 13, hy + 9)], ROBE, contrast=0.42)
    stamp(c, t)
    # creux sombre de la capuche
    t = new()
    t.ellipse(hx - 2, hy + 1, 6, 6.5, ROBE[0])
    stamp(c, t, None)
    # crâne
    t = new()
    ball(t, hx - 3, hy, 4.6, 4.4, BONE)
    t.rect(hx - 6, hy + 3, 5, 3, BONE[2])
    t.set(hx - 6, hy + 3, BONE[3])
    stamp(c, t)
    # ombre de la capuche sur le haut du crâne
    for x in range(int(hx - 8), int(hx + 3)):
        for y in range(int(hy - 5), int(hy - 2)):
            if c.get(x, y) in BONE:
                c.set(x, y, ROBE[0] if y < hy - 3 else BONE[0])
    # orbites vertes brillantes
    ey = int(hy)
    c.rect(hx - 7, ey - 1, 2, 2, OUT); c.rect(hx - 4, ey - 1, 2, 2, OUT)
    c.set(hx - 7, ey - 1, NG[3]); c.set(hx - 4, ey - 1, NG[3])
    c.set(hx - 6, ey, NG[2]); c.set(hx - 3, ey, NG[2])
    c.set(hx - 5, ey + 2, OUT)
    for x in range(int(hx - 6), int(hx - 1)):
        if x % 2 == 0:
            c.set(x, hy + 4, OUT)
    if atk:
        c.rect(hx - 6, int(hy + 5), 4, 1, NG[2])
    # traînées lumineuses des yeux
    c.set(hx - 8, ey - 2, NG[2]); c.set(hx - 9, ey - 3, NG[1])

    # ---- mantelet déchiqueté à liseré vert
    t = new()
    mm = mask_of(lambda m: m.poly([(hx - 6, hy + 6), (hx + 2, hy + 4), (hx + 13, hy + 8), (hx + 15, hy + 14),
                                   (hx + 11, hy + 12), (hx + 9, hy + 16), (hx + 6, hy + 12), (hx + 3, hy + 16),
                                   (hx, hy + 12), (hx - 3, hy + 15), (hx - 6, hy + 11)], '#000'))
    shade(t, mm, ROBE, contrast=0.5, bias=0.08)
    for (x, y) in mm:
        if (x, y + 1) not in mm:
            t.set(x, y, NG[1])
    stamp(c, t)

    # ---- bâton à crâne + bras proche
    t = new()
    if atk:
        top, bot = (X + 5, 13), (X + 20, G - 4)
    else:
        top, bot = (X + 8, 11 + by), (X + 9, G - 1)
    tube(t, [bot, top], [1.6, 1.6], STAFF)
    stamp(c, t)
    # ailettes en os autour du crâne du bâton
    t = new()
    for dx, dy in ((-3, -4), (3, -4)):
        horn(t, [top, (top[0] + dx, top[1] + dy)], [1.2, 0.4], BONE)
    stamp(c, t)
    skull(c, top[0], top[1] - 1, 2, jaw_open=atk)
    t = new()
    ghost_flame(t, top[0] + 1, top[1] - 4, 6 + (2 if f == 1 else 0), 0.6 * f)
    for y in range(t.h):
        for x in range(t.w):
            if t.px[y][x] is not None and c.px[y][x] is not None:
                t.px[y][x] = None
    stamp(c, t, None)
    # bras (manche large) qui tient le bâton
    t = new()
    if atk:
        grip = (X + 10, 30)
    else:
        grip = (X + 9, 31 + by)
    sm = tube_mask([(X + 21, 24 + by), (X + 16, 30 + by), grip], [3.4, 4.0, 4.4])
    shade(t, sm, ROBE, contrast=0.45)
    stamp(c, t)
    t = new()
    ball(t, grip[0] - 1, grip[1] + 0.5, 2.0, 2.0, BONE)
    t.line(grip[0] - 2, grip[1] - 1, grip[0] + 1, grip[1] - 1, BONE[3])
    stamp(c, t)

    # ---- crânes flottants
    sk = ((X + 47, 34 - by * 2), (X + 3, 44 + by * 2)) if not atk else ((X + 48, 30), (X + 45, 44))
    for i, (x, y) in enumerate(sk):
        tt = new()
        ghost_flame(tt, x + 2, y - 1, 6, f + i, NG)
        stamp(c, tt, None)
        skull(c, x, y, 1)

    # ---- effets d'attaque : orbe vert lancé vers la gauche
    if atk:
        fx = new()
        ox, oy = 6, 32
        sx_, sy_ = X + 4, 13
        for k in range(6):
            u0, u1 = k / 6, (k + 1) / 6
            j0 = (1.6 if k % 2 else -1.6) if 0 < k else 0
            j1 = (1.6 if (k + 1) % 2 else -1.6) if k < 5 else 0
            x0, y0 = sx_ + (ox + 3 - sx_) * u0 + j0, sy_ + (oy - sy_) * u0
            x1, y1 = sx_ + (ox + 3 - sx_) * u1 + j1, sy_ + (oy - sy_) * u1
            fx.line(x0, y0, x1, y1, NG[2], width=2.2)
            fx.line(x0, y0, x1, y1, NG[4])
        fx.ellipse(ox + 3, oy, 7, 7, NG[1])
        fx.ellipse(ox + 3, oy, 5.4, 5.4, NG[2])
        fx.ellipse(ox + 2.5, oy - 0.5, 3.4, 3.4, NG[3])
        fx.ellipse(ox + 2, oy - 1, 1.6, 1.6, NG[4])
        for k in range(8):
            a = k * 45 + 10
            r = math.radians(a)
            fx.set(ox + 3 + math.cos(r) * 9.5, oy + math.sin(r) * 9.5, NG[2 if k % 2 else 3])
        for y in range(fx.h):
            for x in range(fx.w):
                if fx.px[y][x] is not None and c.px[y][x] is not None and fx.px[y][x] == NG[1]:
                    fx.px[y][x] = None
        stamp(c, fx, None)
    glow_ring(c, NG[0], NG[1], every=2)
    # cristaux violets flottants (grotte de cristal)
    for (x, y) in (((X + 47, 8), (X + 20, 4)) if f != 1 else ((X + 47, 6), (X + 20, 2))):
        t = new()
        t.poly([(x, y - 3), (x + 2, y), (x, y + 3), (x - 2, y)], CRYS[1])
        t.poly([(x, y - 3), (x, y + 3), (x - 2, y)], CRYS[2])
        t.set(x - 1, y - 1, CRYS[3])
        stamp(c, t)
    dots(c, ((X + 14, 6, 2), (X + 50, 22, 3), (X + 3, 30, 2), (X + 44, 48, 2)) if f != 1 else
         ((X + 15, 4, 3), (X + 50, 19, 2), (X + 2, 33, 3), (X + 45, 50, 3)), lambda k: NG[k])
    return c, (W, H)


# ================================================================ 4. GARDIEN CHACAL (désert)

ANW, ANH = 56, 62
JACK = ['#0a0a16', '#181a2c', '#2a2c46', '#42466a', '#62688e']
AGOLD = ['#6a3414', '#b0661a', '#e0a630', '#ffd86a', '#fff6c8']
LAPIS = ['#0e1a4a', '#1c3488', '#2e5ac8', '#5a8aee', '#a0c4ff']
LINEN = ['#6a6070', '#a89e98', '#d8d0c0', '#f4eedc', '#ffffff']
BEYE = ['#1a6ad0', '#5ac8ff', '#d8f8ff']
TURQ = '#2ab0a0'
SAND = ['#8a5a2a', '#d8a050', '#ffe0a0']


def khopesh(c, hand, ang, R=AGOLD):
    """Khépesh : poignée puis lame en crochet. ang : direction de la lame (degrés, y vers le bas)."""
    a = math.radians(ang)
    ux, uy = math.cos(a), math.sin(a)
    nx, ny = -uy, ux                      # normale (côté du crochet)
    hx, hy = hand
    p = lambda u, v: (hx + ux * u + nx * v, hy + uy * u + ny * v)
    t = Layer(c.lw, c.lh)
    tube(t, [p(-2, 0), p(4, 0)], [1.2, 1.2], JACK)
    spoly(t, [p(3, -1.1), p(7, -1.4), p(11, -3.2), p(15, -3.6), p(18, -2.2), p(19.5, 0.8), p(18.5, 4.2),
              p(17.2, 2.0), p(15, 0.4), p(11.5, 0.2), p(8, 1.2), p(3, 1.1)], R, contrast=0.5)
    t.line(*p(7.5, -1.8), *p(11, -3.4), R[4])
    t.line(*p(12, -3.6), *p(17, -2.8), R[4])
    t.line(*p(18.3, -1.6), *p(19.2, 1), R[3])
    stamp(c, t)
    gx, gy = p(3.5, 0)
    c.set(gx, gy, LAPIS[3])


def anubis(f):
    W, H = ANW, ANH
    G = H - 2
    new = lambda: Layer(W, H)
    c = new()
    atk = f == 2
    by = 1 if f == 1 else 0
    X = 1

    # ---- bâton was (main lointaine), derrière
    t = new()
    sx = X + 42
    tube(t, [(sx, 9 + by), (sx, G)], [1.2, 1.2], JACK, bias=0.2)
    # tête du was (museau d'animal stylisé) et fourche
    spoly(t, [(sx - 1, 9 + by), (sx - 1, 5 + by), (sx - 5, 4 + by), (sx - 4, 2 + by), (sx + 2, 3 + by), (sx + 1, 9 + by)],
          AGOLD, contrast=0.5)
    for x in (sx - 1, sx + 1):
        t.set(x, G, AGOLD[2])
    t.set(sx - 1, G - 1, AGOLD[2]); t.set(sx + 1, G - 1, AGOLD[2])
    for y in (20, 34, 48):
        t.set(sx - 1, y + by, AGOLD[3]); t.set(sx, y + by, AGOLD[2]); t.set(sx + 1, y + by, AGOLD[1])
    stamp(c, t)

    # ---- bras lointain (tient le was)
    t = new()
    tube(t, [(X + 34, 25 + by), (X + 40, 30 + by), (sx - 1, 34 + by)], [3.4, 2.8, 2.6], JACK, bias=-0.15)
    stamp(c, t)
    t = new()
    t.rect(X + 38, 29 + by, 3, 3, AGOLD[2])
    t.set(X + 38, 29 + by, AGOLD[3])
    ball(t, sx, 34 + by, 2, 2, JACK)
    stamp(c, t)

    # ---- némès (coiffe rayée) derrière la tête
    hx, hy = (X + 20, 14 + by) if not atk else (X + 18, 15)
    sw = 1 if f == 1 else 0
    t = new()
    nm = mask_of(lambda m: m.poly([(hx + 1, hy - 6), (hx + 9, hy - 5), (hx + 13, hy + 2), (hx + 15 + sw, hy + 14),
                                   (hx + 8, hy + 12), (hx + 3, hy + 4)], '#000'))
    shade(t, nm, LAPIS, contrast=0.4)
    for (x, y) in nm:
        if (y - hy) % 3 == 0:
            t.set(x, y, AGOLD[2] if (x, y - 1) in nm else AGOLD[3])
    stamp(c, t)

    # ---- jambes
    if f == 1:
        lg = [((X + 31, 46), (X + 34, 52), (X + 35, G - 2)), ((X + 26, 46), (X + 22, 52), (X + 20, G - 2))]
    elif atk:
        lg = [((X + 31, 46), (X + 36, 52), (X + 39, G - 2)), ((X + 25, 46), (X + 19, 51), (X + 15, G - 2))]
    else:
        lg = [((X + 31, 46), (X + 32, 52), (X + 33, G - 2)), ((X + 25, 46), (X + 24, 52), (X + 23, G - 2))]
    for i, (hip, knee, ank) in enumerate(lg):
        t = new()
        R = JACK
        tube(t, [hip, knee, ank], [3.4, 2.8, 2.2], R, bias=-0.15 if i == 0 else 0)
        # jambière d'or (bande sous le genou)
        for y in (knee[1] + 1, knee[1] + 2):
            for x in range(knee[0] - 3, knee[0] + 4):
                t.setf(x, y, AGOLD[3] if y == knee[1] + 1 else AGOLD[1])
        stamp(c, t)
        t = new()
        ax_ = ank[0]
        spoly(t, [(ax_ - 4, G - 1), (ax_ + 2, G - 2), (ax_ + 2, G), (ax_ - 5, G)], AGOLD, contrast=0.4,
              bias=-0.1 if i == 0 else 0)
        stamp(c, t)

    # ---- pagne de lin (shendyt) + tablier lapis
    t = new()
    km = mask_of(lambda m: m.poly([(X + 21, 37 + by), (X + 36, 37 + by), (X + 38, 47 + by), (X + 19, 48 + by)], '#000'))
    shade(t, km, LINEN, contrast=0.4)
    for (x, y) in km:
        if (x - y // 3) % 3 == 0 and y > 39 + by:
            t.set(x, y, LINEN[1])
    am = mask_of(lambda m: m.poly([(X + 24, 39 + by), (X + 30, 39 + by), (X + 31, 49 + by), (X + 23, 49 + by)], '#000'))
    shade(t, am, LAPIS, contrast=0.4)
    for (x, y) in am:
        if (y - by) % 3 == 0:
            t.set(x, y, AGOLD[2])
    # ceinture d'or
    for x in range(X + 20, X + 38):
        t.setf(x, 37 + by, AGOLD[3]); t.setf(x, 38 + by, AGOLD[2])
    t.set(X + 27, 38 + by, LAPIS[3])
    stamp(c, t)

    # ---- torse (peau noire, sculpté)
    t = new()
    tm = mask_of(lambda m: m.poly([(X + 18, 23 + by), (X + 37, 23 + by), (X + 35, 31 + by), (X + 33, 38 + by),
                                   (X + 23, 38 + by), (X + 20, 31 + by)], '#000'))
    shade(t, tm, JACK, contrast=0.45)
    t.line(X + 27, 31 + by, X + 27, 37 + by, JACK[1])
    for y in (33, 35):
        t.line(X + 24, y + by, X + 26, y + by, JACK[1]); t.line(X + 28, y + by, X + 30, y + by, JACK[1])
    stamp(c, t)
    # grand collier ousekh (bandes or / lapis / turquoise)
    t = new()
    cm = mask_of(lambda m: m.ellipse(X + 27, 23 + by, 11, 6.5, '#000'))
    cm = {p for p in cm if p[1] >= 21 + by}
    bands = [AGOLD[3], LAPIS[2], AGOLD[2], TURQ, AGOLD[1], LAPIS[1]]
    for (x, y) in cm:
        d = math.hypot((x + 0.5 - X - 27) / 11, (y + 0.5 - 21 - by) / 7.5)
        k = int(d * 6)
        col = bands[min(5, k)]
        if col == AGOLD[3] and x > X + 30:
            col = AGOLD[2]
        t.set(x, y, col)
    for x in range(X + 17, X + 38, 2):
        if (x, 28 + by) in cm or (x, 29 + by) in cm:
            t.setf(x, 29 + by, AGOLD[3])
    stamp(c, t)

    # ---- tête de chacal
    t = new()
    spoly(t, [(hx + 1, hy - 4), (hx + 3, hy - 13), (hx + 7, hy - 4)], JACK, bias=-0.15)     # oreille lointaine
    stamp(c, t)
    t = new()
    up = -1 if atk else 0
    hm = mask_of(lambda m: m.ellipse(hx + 2, hy, 6, 5.5, '#000'))
    hm |= mask_of(lambda m: m.poly([(hx - 2, hy - 4 + up), (hx - 12, hy - 1 + up), (hx - 13, hy + 1 + up),
                                    (hx - 11, hy + 2), (hx + 2, hy + 4)], '#000'))
    shade(t, hm, JACK, contrast=0.5, bias=0.06)
    stamp(c, t)
    t = new()
    if atk:
        jm = mask_of(lambda m: m.poly([(hx - 10, hy + 5), (hx - 2, hy + 2), (hx + 3, hy + 3), (hx + 2, hy + 6),
                                       (hx - 9, hy + 6)], '#000'))
    else:
        jm = mask_of(lambda m: m.poly([(hx - 10, hy + 2), (hx + 2, hy + 3), (hx + 2, hy + 5), (hx - 8, hy + 4)], '#000'))
    shade(t, jm, JACK, bias=-0.1)
    stamp(c, t)
    if atk:
        c.poly([(hx - 11, hy + 1.5), (hx + 1, hy + 2.5), (hx - 9, hy + 5)], '#3a0a1a')
        c.set(hx - 9, hy + 2, LINEN[4]); c.set(hx - 6, hy + 2, LINEN[4]); c.set(hx - 7, hy + 4, LINEN[4])
    else:
        c.line(hx - 10, hy + 2, hx + 1, hy + 3, OUT)
    c.rect(hx - 14, hy - 1 + up, 2, 2, OUT)                           # truffe
    c.line(hx - 10, hy - 2 + up, hx - 3, hy - 4 + up, JACK[4])        # arête du museau
    # bandeau d'or du némès sur le front
    for x in range(int(hx - 2), int(hx + 8)):
        if c.get(x, hy - 4) is not None:
            c.set(x, hy - 4, AGOLD[3]); c.set(x, hy - 3, AGOLD[1])
    # œil bleu lumineux + trait de khôl
    ex, ey = int(hx - 3), int(hy - 2)
    c.rect(ex, ey, 4, 2, BEYE[1])
    c.set(ex, ey, BEYE[2]); c.set(ex + 1, ey, BEYE[2])
    c.set(ex + 3, ey + 1, BEYE[0])
    c.line(ex - 2, ey - 1, ex + 4, ey - 1, OUT)
    c.line(ex + 4, ey + 2, ex + 7, ey + 2, OUT)
    c.set(ex - 1, ey + 1, BEYE[0])
    # oreille proche (liseré or)
    t = new()
    spoly(t, [(hx + 2, hy - 4), (hx + 6, hy - 14), (hx + 10, hy - 3)], JACK, contrast=0.5)
    t.poly([(hx + 4, hy - 5), (hx + 6, hy - 11), (hx + 8, hy - 5)], AGOLD[1])
    t.line(hx + 5, hy - 6, hx + 6, hy - 9, AGOLD[2])
    stamp(c, t)
    # pan de némès devant l'épaule
    t = new()
    pm = mask_of(lambda m: m.poly([(hx + 4, hy + 3), (hx + 8, hy + 3), (hx + 8 + sw, hy + 11), (hx + 4 + sw, hy + 11)], '#000'))
    shade(t, pm, LAPIS, contrast=0.4)
    for (x, y) in pm:
        if (y - hy) % 3 == 0:
            t.set(x, y, AGOLD[2])
    stamp(c, t)

    # ---- bras proche + khépesh
    if atk:
        arm = [(X + 21, 26), (X + 15, 29), (X + 11, 32)]
        blade_ang = 130
    else:
        arm = [(X + 21, 26 + by), (X + 16, 32 + by), (X + 12, 35 + by)]
        blade_ang = -125
    if not atk:
        khopesh(c, arm[-1], blade_ang)
    t = new()
    tube(t, arm, [3.6, 3.0, 2.8], JACK)
    ball(t, arm[0][0] + 1, arm[0][1] - 1, 3.2, 2.8, AGOLD)        # épaulière d'or
    stamp(c, t)
    t = new()
    ex_, ey_ = arm[1]
    hx_, hy_ = arm[2]
    t.line((ex_ + hx_) / 2, (ey_ + hy_) / 2 - 1, (ex_ + hx_) / 2 + (hx_ - ex_) * 0.3, (ey_ + hy_) / 2 + (hy_ - ey_) * 0.3, AGOLD[2], width=3)
    ball(t, hx_, hy_, 2, 2, JACK)
    stamp(c, t)
    if atk:
        khopesh(c, arm[-1], blade_ang)

    # ---- effets
    if atk:
        fx = new()
        AF = [LAPIS[1], LAPIS[2], BEYE[1], AGOLD[3], AGOLD[4]]
        arc_fx(fx, X + 23, 31, 22, 1.05, 262, 125, 10, AF, lead=0.65)
        for y in range(fx.h):
            for x in range(fx.w):
                if c.px[y][x] is not None:
                    fx.px[y][x] = None
        stamp(c, fx, None)
    glow_ring(c, LAPIS[1], BEYE[0], every=2)
    dots(c, ((X + 4, 50, 1), (X + 48, 18, 2), (X + 50, 46, 1), (X + 10, 8, 2), (X + 30, 2, 1)) if f != 1 else
         ((X + 5, 48, 2), (X + 49, 15, 1), (X + 51, 44, 2), (X + 11, 6, 1), (X + 31, 1, 2)), lambda k: SAND[k])
    return c, (W, H)


# ================================================================ 5. GÉANT DU GIVRE (montagnes gelées)

FGW, FGH = 62, 62
GSKIN = ['#1a2658', '#2a4486', '#3c66b2', '#5e94d6', '#94c4ee']
ICE = ['#2a5e94', '#4a9ed2', '#8ad4f2', '#d0f2ff', '#ffffff']
GFUR = ['#3e3236', '#6a5650', '#94806e', '#bea88e', '#e2d2b4']
GLEATH = ['#2a1a1a', '#4a2e24', '#6e4632', '#946446', '#b88a62']
FROST = ['#3a7ac0', '#8ad4f2', '#e8fbff']


def ice_shard(c, base, tip, w, R=ICE):
    """Éclat de glace : losange effilé, face claire / face sombre."""
    (bx, by_), (tx, ty) = base, tip
    dx, dy = tx - bx, ty - by_
    n = math.hypot(dx, dy) or 1
    nx, ny = -dy / n * w / 2, dx / n * w / 2
    t = Layer(c.lw, c.lh)
    mx, my = bx + dx * 0.3, by_ + dy * 0.3
    t.poly([(bx, by_), (mx + nx, my + ny), (tx, ty), (mx - nx, my - ny)], R[1])
    t.poly([(bx, by_), (mx - nx, my - ny), (tx, ty)], R[2] if nx < 0 else R[0])
    t.line(mx, my, tx, ty, R[3])
    t.set(tx, ty, R[4])
    stamp(c, t)


def snowflake(c, x, y, col, core=WHITE):
    for dx, dy in ((1, 1), (-1, -1), (1, -1), (-1, 1)):
        if c.get(x + dx, y + dy) is None:
            c.set(x + dx, y + dy, col)
    if c.get(x, y) is None:
        c.set(x, y, core)


def frost_giant(f):
    W, H = FGW, FGH
    G = H - 2
    new = lambda: Layer(W, H)
    c = new()
    atk = f == 2
    by = 1 if f == 1 else 0
    X = 6 if atk else 4

    # ---- bras lointain (derrière)
    t = new()
    if atk:
        arm = [(X + 42, 27), (X + 48, 33), (X + 49, 39)]
    else:
        arm = [(X + 42, 27 + by), (X + 48, 35 + by), (X + 47, 42 + by)]
    tube(t, arm, [5.0, 4.2, 3.6], GSKIN, bias=-0.18)
    ball(t, arm[-1][0], arm[-1][1] + 1, 3.8, 3.4, GSKIN, cuts=(0.2, 0.55, 0.85, 1.1))
    for y in (arm[1][1] + 1, arm[1][1] + 2, arm[1][1] + 3):
        for x in range(arm[1][0] - 4, arm[1][0] + 4):
            t.setf(x, y, GLEATH[2] if y == arm[1][1] + 1 else GLEATH[1])
    stamp(c, t)

    # ---- jambes courtes et massives, bottes de fourrure
    if f == 1:
        lg = [((X + 38, 44), (X + 41, 53)), ((X + 28, 44), (X + 24, 53))]
    elif atk:
        lg = [((X + 38, 44), (X + 44, 53)), ((X + 27, 44), (X + 21, 53))]
    else:
        lg = [((X + 38, 44), (X + 40, 53)), ((X + 28, 44), (X + 27, 53))]
    for i, (hip, foot) in enumerate(lg):
        t = new()
        tube(t, [hip, foot], [5.2, 4.4], GSKIN, bias=-0.15 if i == 0 else 0)
        stamp(c, t)
        t = new()
        fx_ = foot[0]
        bm = mask_of(lambda m: (m.ellipse(fx_, G - 5, 5.4, 3.6, '#000'),
                                m.poly([(fx_ - 8, G - 3), (fx_ + 5, G - 4), (fx_ + 6, G), (fx_ - 9, G)], '#000')))
        shade(t, bm, GFUR, contrast=0.45, bias=-0.12 if i == 0 else 0)
        for (x, y) in bm:
            if (x * 3 + y * 5) % 7 == 0 and (x, y + 1) in bm:
                t.set(x, y, GFUR[1])
        t.line(fx_ - 8, G, fx_ + 5, G, GLEATH[1])
        stamp(c, t)

    # ---- corps massif (peau bleue) + pagne de fourrure
    t = new()
    tm = mask_of(lambda m: (m.ellipse(X + 33, 31 + by, 15, 13, '#000'), m.ellipse(X + 33, 40 + by, 12, 7, '#000')))
    shade(t, tm, GSKIN, contrast=0.45)
    # pectoraux / abdominaux
    t.line(X + 26, 33 + by, X + 31, 35 + by, GSKIN[1])
    t.line(X + 33, 30 + by, X + 33, 41 + by, GSKIN[1])
    for y in (37, 40):
        t.line(X + 29, y + by, X + 32, y + by, GSKIN[1])
    # cicatrices de givre
    for (x0, y0, x1, y1) in ((X + 37, 33, X + 40, 37), (X + 22, 38, X + 25, 41)):
        t.line(x0, y0 + by, x1, y1 + by, ICE[3])
    stamp(c, t)
    t = new()
    lm = mask_of(lambda m: m.poly([(X + 20, 42 + by), (X + 46, 42 + by), (X + 45, 47), (X + 42, 49), (X + 39, 47),
                                   (X + 35, 50), (X + 31, 47), (X + 27, 50), (X + 23, 47), (X + 19, 48)], '#000'))
    shade(t, lm, GLEATH, contrast=0.4, bias=0.05)
    for x in range(X + 20, X + 47):
        t.setf(x, 42 + by, GLEATH[4]); t.setf(x, 43 + by, GLEATH[3])
    # boucle de ceinture : crâne de glace
    t.rect(X + 30, 42 + by, 4, 3, ICE[2]); t.set(X + 30, 42 + by, ICE[4]); t.set(X + 33, 44 + by, ICE[0])
    stamp(c, t)

    # ---- manteau de fourrure sur les épaules
    t = new()
    fm = mask_of(lambda m: (m.ellipse(X + 34, 22 + by, 15, 6.5, '#000'),
                            m.poly([(X + 19, 22 + by), (X + 49, 22 + by), (X + 48, 30 + by), (X + 44, 28 + by), (X + 41, 31 + by),
                                    (X + 37, 28 + by), (X + 33, 31 + by), (X + 29, 28 + by), (X + 25, 31 + by),
                                    (X + 21, 28 + by)], '#000')))
    shade(t, fm, GFUR, contrast=0.45)
    for (x, y) in fm:
        if (x * 5 + y * 3) % 9 == 0 and (x, y + 1) in fm:
            t.set(x, y, GFUR[1])
            t.setf(x + 1, y + 1, GFUR[1])
    # sangle de cuir en travers
    for k in range(14):
        x, y = X + 38 - k, 24 + by + k * 1.3
        t.set(x, y, GLEATH[3]); t.set(x + 1, y, GLEATH[2]); t.set(x + 2, y, GLEATH[1])
    stamp(c, t)

    # ---- éclats de glace qui jaillissent du sol (attaque), derrière la massue
    if atk:
        for (bx, tx, ty, w) in ((X - 2, X - 4, G - 13, 3.4), (X + 4, X + 3, G - 18, 4), (X + 10, X + 13, G - 14, 3.4),
                                (X + 16, X + 20, G - 8, 2.6), (X + 1, X - 1, G - 6, 2.6)):
            ice_shard(c, (bx, G), (tx, ty), w)

    # ---- bras proche + massue de glace
    if atk:
        arm = [(X + 25, 26), (X + 17, 31), (X + 11, 37)]
        club = ((X + 11, 37), (X + 1, 52))
    else:
        arm = [(X + 26, 27 + by), (X + 19, 35 + by), (X + 11, 37 + by)]
        club = ((X + 11, 38 + by), (X + 4, 12 + by))
    # massue : manche en cuir, tête de cristal
    t = new()
    (cx0, cy0), (cx1, cy1) = club
    dx, dy = cx1 - cx0, cy1 - cy0
    n = math.hypot(dx, dy)
    ux, uy = dx / n, dy / n
    tube(t, [(cx0 - ux * 3, cy0 - uy * 3), (cx0 + ux * n * 0.45, cy0 + uy * n * 0.45)], [1.8, 1.8], GLEATH)
    stamp(c, t)
    t = new()
    hcx, hcy = cx0 + ux * n * 0.8, cy0 + uy * n * 0.8
    nx, ny = -uy, ux
    cm = mask_of(lambda m: m.poly([(cx0 + ux * n * 0.42 + nx * 2, cy0 + uy * n * 0.42 + ny * 2),
                                   (hcx + nx * 5.5 - ux * 2, hcy + ny * 5.5 - uy * 2),
                                   (cx1 + ux * 2 + nx * 3, cy1 + uy * 2 + ny * 3),
                                   (cx1 + ux * 4, cy1 + uy * 4),
                                   (cx1 + ux * 2 - nx * 3, cy1 + uy * 2 - ny * 3),
                                   (hcx - nx * 5.5 - ux * 2, hcy - ny * 5.5 - uy * 2),
                                   (cx0 + ux * n * 0.42 - nx * 2, cy0 + uy * n * 0.42 - ny * 2)], '#000'))
    shade(t, cm, ICE, contrast=0.5, bias=0.05)
    # facettes
    t.line(cx0 + ux * n * 0.45, cy0 + uy * n * 0.45, cx1 + ux * 4, cy1 + uy * 4, ICE[3])
    stamp(c, t)
    # pointes de glace sur la massue
    for s_ in (-1, 1):
        ice_shard(c, (hcx + nx * 4 * s_, hcy + ny * 4 * s_), (hcx + nx * 8 * s_ + ux, hcy + ny * 8 * s_ + uy), 2.4)
    t = new()
    tube(t, arm, [5.4, 4.6, 4.0], GSKIN)
    ball(t, arm[0][0] + 2, arm[0][1] - 1, 5.5, 4.6, GFUR)            # épaule en fourrure
    for y in (arm[1][1] + 1, arm[1][1] + 2, arm[1][1] + 3):
        for x in range(int(arm[1][0]) - 5, int(arm[1][0]) + 4):
            t.setf(x, y, GLEATH[3] if y == arm[1][1] + 1 else GLEATH[2])
    ball(t, arm[-1][0], arm[-1][1], 3.8, 3.6, GSKIN)
    stamp(c, t)

    # ---- tête : couronne de glace, sourcils lourds, barbe de glace
    hx, hy = (X + 23, 17 + by) if not atk else (X + 21, 18)
    t = new()
    for (bx, tx, ty, w) in ((hx - 4, hx - 7, hy - 15, 3.4), (hx + 1, hx + 1, hy - 17, 4), (hx + 6, hx + 9, hy - 14, 3.4)):
        ice_shard(t, (bx, hy - 5), (tx, ty), w)
    stamp(c, t)
    t = new()
    ball(t, hx + 1, hy, 9, 8, GSKIN)
    stamp(c, t)
    # couronne : bandeau de glace
    t = new()
    for x in range(int(hx - 8), int(hx + 10)):
        if c.get(x, hy - 6) is not None:
            t.set(x, hy - 6, ICE[3]); t.set(x, hy - 5, ICE[1])
    stamp(c, t, None)
    # yeux glacés lumineux sous un sourcil lourd
    ex, ey = int(hx - 7), int(hy - 2)
    for ox_ in (0, 6):
        c.rect(ex + ox_, ey, 4, 2, FROST[2])
        c.set(ex + ox_ + 3, ey + 1, FROST[1]); c.set(ex + ox_ + 2, ey + 1, FROST[1])
        c.set(ex + ox_ + 1, ey, OUT)
    c.line(ex - 1, ey - 2, ex + 4, ey - 1, OUT); c.line(ex + 5, ey - 1, ex + 10, ey - 2, OUT)
    c.line(ex - 1, ey - 1, ex + 10, ey - 1, OUT)
    c.line(ex, ey - 3, ex + 4, ey - 2, GSKIN[4])
    # nez fort
    t = new()
    ball(t, hx - 4, hy + 1.5, 2.4, 2.2, GSKIN)
    stamp(c, t)
    # barbe de glace (mèches en pointe)
    t = new()
    bmask = mask_of(lambda m: m.poly([(hx - 9, hy + 2), (hx - 6, hy + 4), (hx + 2, hy + 4), (hx + 8, hy + 2), (hx + 9, hy + 7),
                                      (hx + 5, hy + 16 + by), (hx + 2, hy + 12), (hx - 1, hy + 19 + by), (hx - 3, hy + 12),
                                      (hx - 7, hy + 16 + by), (hx - 8, hy + 10), (hx - 11, hy + 12)], '#000'))
    shade(t, bmask, ICE, contrast=0.45, bias=0.1)
    for (x, y) in bmask:
        if (x - hx) % 3 == 0 and (x, y + 1) in bmask and y > hy + 6:
            t.set(x, y, ICE[1])
    stamp(c, t)
    # bouche (grondement) dans la barbe
    if atk:
        c.rect(hx - 6, int(hy + 5), 6, 3, '#10183a')
        for x in range(int(hx - 6), int(hx), 2):
            c.set(x, hy + 5, ICE[4])
        c.set(hx - 4, hy + 7, ICE[4])
    else:
        c.line(hx - 6, hy + 6, hx - 1, hy + 6, '#10183a')
    # moustache
    t = new()
    spoly(t, [(hx - 10, hy + 5), (hx - 5, hy + 3), (hx + 1, hy + 4), (hx - 4, hy + 5), (hx - 9, hy + 7)], ICE, contrast=0.5, bias=0.18)
    stamp(c, t)

    # ---- effets
    if atk:
        # onde de choc et éclats de glace qui jaillissent du sol
        fx = new()
        fx.ellipse(X + 5, G - 1, 13, 2.4, FROST[0])
        fx.ellipse(X + 5, G - 1, 9, 1.6, FROST[1])
        for y in range(fx.h):
            for x in range(fx.w):
                if fx.px[y][x] is not None and c.px[y][x] is None:
                    c.px[y][x] = fx.px[y][x]
        for (x, y) in ((X - 2, G - 20), (X + 12, G - 22), (X + 20, G - 15), (X + 3, G - 24)):
            sparkle(c, x, y, FROST[1])
    glow_ring(c, FROST[0], FROST[1], every=2)
    flakes = ((X + 52, 8), (X + 2, 10), (X + 54, 30), (X + 38, 4), (X + 56, 50)) if f != 1 else \
             ((X + 52, 11), (X + 3, 13), (X + 55, 33), (X + 39, 7), (X + 55, 53))
    for x, y in flakes:
        snowflake(c, x, y, FROST[1])
    return c, (W, H)


# ================================================================ 6. GÉNÉRAL DÉMON (terres maudites)

DGW, DGH = 62, 62
DARM = ['#0c0810', '#1c1420', '#302430', '#4a3844', '#6c5662']        # armure noire
DRED = ['#3e0610', '#7a1018', '#c42222', '#ff5a3a', '#ffb48a']        # rouge infernal
DSKIN = ['#4a0c14', '#8a1c22', '#c23a30', '#e86a48']
DMEMB = ['#1e0610', '#3a0a18', '#5e1222', '#8a2228', '#b84030']
DHORN = ['#2a1c22', '#5a4644', '#968068', '#d4c29e', '#fff4d4']
HELL = ['#6a0c06', '#c8300a', '#ff7a14', '#ffd040', '#fff6c0']
DEYE = ['#ff8a1a', '#ffe060', '#ffffff']


def bat_wing(c, shoulder, wrist, tips, attach, R, bone, scallop=0.3):
    pts = [shoulder, wrist]
    for i, t in enumerate(tips):
        pts.append(t)
        nxt = tips[i + 1] if i + 1 < len(tips) else attach
        mx, my = (t[0] + nxt[0]) / 2, (t[1] + nxt[1]) / 2
        pts.append((mx + (wrist[0] - mx) * scallop, my + (wrist[1] - my) * scallop))
    pts.append(attach)
    m = mask_of(lambda q: q.poly(pts, '#000'))
    shade(c, m, R, contrast=0.3, bias=0.05)
    for (x, y) in m:
        if any((x + dx, y + dy) not in m for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
            c.set(x, y, R[3])
    for t in tips:
        c.line(wrist[0], wrist[1], t[0], t[1], bone[1])
        c.set(t[0], t[1], bone[3])
    c.line(shoulder[0], shoulder[1], wrist[0], wrist[1], bone[1], width=2.2)
    c.line(shoulder[0] - 0.5, shoulder[1] - 0.8, wrist[0] - 0.5, wrist[1] - 0.8, bone[2])
    c.set(wrist[0], wrist[1] - 1, DHORN[3]); c.set(wrist[0] - 1, wrist[1] - 2, DHORN[4])


def demon_general(f):
    W, H = DGW, DGH
    G = H - 2
    new = lambda: Layer(W, H)
    c = new()
    atk = f == 2
    by = 1 if f == 1 else 0
    X = 2
    WB = [DARM[0], DARM[1], DARM[2], DARM[3]]

    # ---- flammes infernales derrière (aura)
    t = new()
    for k, (x, hgt) in enumerate(((X + 14, 12), (X + 22, 18), (X + 32, 22), (X + 42, 16), (X + 50, 11))):
        flame_tongue(t, x, G - 1, 3.6, hgt + (3 if (k + f) % 2 else 0), 2 + k * 0.5, f * 1.3 + k, [HELL[0], HELL[0], HELL[1], HELL[1], HELL[2]])
    stamp(c, t, None)

    # ---- ailes (lointaine puis proche) derrière le corps
    t = new()
    if f == 1:
        bat_wing(t, (X + 34, 24 + by), (X + 30, 8), [(X + 26, 2), (X + 20, 7), (X + 18, 15)], (X + 30, 26 + by),
                 [DMEMB[0], DMEMB[0], DMEMB[1], DMEMB[2], DMEMB[3]], WB)
    else:
        bat_wing(t, (X + 34, 24 + by), (X + 29, 6), [(X + 24, 0), (X + 17, 5), (X + 15, 13)], (X + 30, 26 + by),
                 [DMEMB[0], DMEMB[0], DMEMB[1], DMEMB[2], DMEMB[3]], WB)
    stamp(c, t)
    t = new()
    if f == 1:
        bat_wing(t, (X + 39, 24 + by), (X + 50, 12), [(X + 58, 12), (X + 59, 22), (X + 56, 31), (X + 50, 36)], (X + 43, 34),
                 DMEMB, WB)
    elif atk:
        bat_wing(t, (X + 39, 24), (X + 47, 5), [(X + 55, 1), (X + 59, 10), (X + 58, 21), (X + 52, 30)], (X + 43, 33),
                 DMEMB, WB)
    else:
        bat_wing(t, (X + 39, 24), (X + 48, 7), [(X + 56, 4), (X + 59, 14), (X + 57, 25), (X + 51, 33)], (X + 43, 33),
                 DMEMB, WB)
    stamp(c, t)

    # ---- cape déchirée
    t = new()
    sw = 1 if f == 1 else 0
    cm = mask_of(lambda m: m.poly([(X + 26, 22 + by), (X + 40, 23 + by), (X + 45, 40), (X + 47 + sw, 52), (X + 43, 49),
                                   (X + 41 + sw, 55), (X + 37, 50), (X + 34, 54), (X + 31, 46)], '#000'))
    shade(t, cm, DRED, contrast=0.4, bias=-0.15)
    stamp(c, t)

    # ---- bras lointain
    t = new()
    if atk:
        arm = [(X + 36, 26), (X + 42, 32), (X + 45, 38)]
    else:
        arm = [(X + 36, 26 + by), (X + 40, 34 + by), (X + 38, 41 + by)]
    tube(t, arm, [3.8, 3.2, 3.0], DARM, bias=-0.15)
    ball(t, arm[-1][0], arm[-1][1], 2.6, 2.4, DARM)
    stamp(c, t)

    # ---- jambes en armure (genouillères à pointe)
    if f == 1:
        lg = [((X + 33, 42), (X + 36, 50), (X + 37, G - 3)), ((X + 26, 42), (X + 22, 50), (X + 20, G - 3))]
    elif atk:
        lg = [((X + 33, 42), (X + 39, 49), (X + 42, G - 3)), ((X + 26, 42), (X + 20, 48), (X + 15, G - 3))]
    else:
        lg = [((X + 33, 42), (X + 34, 50), (X + 35, G - 3)), ((X + 26, 42), (X + 25, 50), (X + 24, G - 3))]
    for i, (hip, knee, ank) in enumerate(lg):
        t = new()
        tube(t, [hip, knee, ank], [4.0, 3.4, 3.0], DARM, bias=-0.12 if i == 0 else 0.02)
        # rainure rouge
        t.line(hip[0] - 1, hip[1] + 2, knee[0] - 1, knee[1] - 1, DRED[2])
        stamp(c, t)
        t = new()
        ax_ = ank[0]
        spoly(t, [(ax_ - 6, G - 2), (ax_ - 2, G - 4), (ax_ + 3, G - 4), (ax_ + 3, G), (ax_ - 7, G)], DARM,
              bias=-0.1 if i == 0 else 0.05)
        stamp(c, t)
        t = new()
        horn(t, [(knee[0] + 1, knee[1]), (knee[0] - 2, knee[1] - 1), (knee[0] - 5, knee[1] - 3)], [2.0, 1.2, 0.3], DHORN)
        ball(t, knee[0] + 1, knee[1], 2.6, 2.4, DARM)
        stamp(c, t)

    # ---- torse en armure noire, liserés rouges, cœur de lave
    t = new()
    tm = mask_of(lambda m: m.poly([(X + 18, 22 + by), (X + 39, 22 + by), (X + 37, 32 + by), (X + 34, 42 + by),
                                   (X + 23, 42 + by), (X + 20, 32 + by)], '#000'))
    shade(t, tm, DARM, contrast=0.48)
    t.line(X + 21, 32 + by, X + 28, 36 + by, DRED[2])
    t.line(X + 36, 32 + by, X + 29, 36 + by, DRED[1])
    for x in range(X + 22, X + 36):
        t.setf(x, 39 + by, DRED[1]); t.setf(x, 40 + by, DARM[3] if x % 3 else DRED[3])
    # cœur de lave
    t.poly([(X + 28, 28 + by), (X + 31, 31 + by), (X + 28, 35 + by), (X + 25, 31 + by)], DRED[2])
    t.poly([(X + 28, 29 + by), (X + 30, 31 + by), (X + 28, 33 + by), (X + 26, 31 + by)], HELL[3])
    t.set(X + 27, 30 + by, HELL[4])
    stamp(c, t)
    # tassette (jupe de plaques)
    t = new()
    for k, x in enumerate((X + 21, X + 26, X + 31)):
        spoly(t, [(x, 41 + by), (x + 6, 41 + by), (x + 5, 47 + by), (x + 3, 48 + by), (x + 1, 47 + by)], DARM,
              contrast=0.5, bias=0.05 - k * 0.04)
        t.line(x + 1, 46 + by, x + 3, 47 + by, DRED[2])
    stamp(c, t)

    # ---- tête : visage rouge, casque noir, grandes cornes
    hx, hy = (X + 23, 15 + by) if not atk else (X + 21, 16)
    t = new()
    horn(t, [(hx + 5, hy - 5), (hx + 10, hy - 8), (hx + 13, hy - 11), (hx + 13, hy - 15)], [2.6, 2.0, 1.4, 0.4],
         [DHORN[0], DHORN[0], DHORN[1], DHORN[2], DHORN[3]])                    # corne lointaine
    stamp(c, t)
    t = new()
    SK = DSKIN + [DSKIN[3]]
    ball(t, hx, hy, 7.5, 7, SK)
    spoly(t, [(hx - 7, hy + 1), (hx + 5, hy + 1), (hx + 5, hy + 6), (hx - 1, hy + 9), (hx - 6, hy + 7)], SK, contrast=0.4)
    stamp(c, t)
    # casque noir : calotte, nasal, protège-nuque
    t = new()
    hm = mask_of(lambda m: m.poly([(hx - 8, hy - 2), (hx - 7, hy - 6), (hx - 2, hy - 9), (hx + 4, hy - 9), (hx + 8, hy - 5),
                                   (hx + 9, hy + 5), (hx + 6, hy + 8), (hx + 4, hy + 1), (hx + 2, hy - 2)], '#000'))
    shade(t, hm, DARM, contrast=0.5, bias=0.1)
    for (x, y) in hm:
        if (x, y + 1) not in hm and y < hy:
            t.set(x, y, DRED[2])
    t.line(hx - 3, hy - 8, hx + 5, hy - 7, DARM[4])
    stamp(c, t)
    # yeux de braise (grands)
    ex, ey = int(hx - 7), int(hy - 1)
    c.rect(ex, ey, 4, 2, DEYE[1]); c.set(ex, ey, DEYE[2]); c.set(ex + 1, ey, DEYE[2]); c.set(ex + 3, ey + 1, DEYE[0])
    c.rect(ex + 6, ey, 3, 2, DEYE[1]); c.set(ex + 6, ey, DEYE[2]); c.set(ex + 8, ey + 1, DEYE[0])
    c.set(ex + 4, ey + 1, DSKIN[0]); c.set(ex + 5, ey + 1, DSKIN[0])
    c.line(ex - 1, ey - 1, ex + 8, ey - 1, OUT)
    # pommettes / nez
    c.set(ex + 4, ey + 3, DSKIN[0]); c.set(ex + 3, ey + 3, DSKIN[1])
    # bouche à crocs
    my = int(hy + 5)
    if atk:
        c.rect(hx - 7, my - 1, 8, 4, '#200408')
        c.line(hx - 6, my + 2, hx, my + 2, DRED[2])
        for x in (hx - 7, hx - 4, hx - 1):
            c.set(x, my - 1, WHITE); c.set(x, my, WHITE)
        c.set(hx - 6, my + 2, WHITE); c.set(hx - 2, my + 2, WHITE)
    else:
        c.line(hx - 7, my, hx, my, '#200408')
        c.set(hx - 6, my + 1, WHITE); c.set(hx - 2, my + 1, WHITE)
        c.set(hx - 6, my + 2, WHITE)
    # corne proche, recourbée vers le haut
    t = new()
    horn(t, [(hx - 2, hy - 7), (hx - 6, hy - 10), (hx - 7, hy - 13), (hx - 5, hy - 15)], [2.8, 2.2, 1.4, 0.4], DHORN)
    stamp(c, t)

    # ---- épaulières à pointes
    t = new()
    ball(t, X + 36, 22 + by, 5, 4, [DARM[0], DARM[1], DARM[2], DARM[3], DARM[3]])
    stamp(c, t)
    t = new()
    for k in range(3):
        horn(t, [(X + 34 + k * 3, 20 + by), (X + 35 + k * 4, 16 + by - k)], [1.6, 0.3], DHORN)
    stamp(c, t)

    # ---- épée flamboyante + bras proche
    if atk:
        arm = [(X + 21, 27), (X + 15, 31), (X + 10, 35)]
        blade = ((X + 10, 35), (X - 0, 52))
    else:
        arm = [(X + 21, 27 + by), (X + 16, 33 + by), (X + 13, 37 + by)]
        blade = ((X + 13, 37 + by), (X + 6, 6 + by))
    (h0x, h0y), (b1x, b1y) = blade
    dx, dy = b1x - h0x, b1y - h0y
    n = math.hypot(dx, dy)
    ux, uy = dx / n, dy / n
    nx, ny = -uy, ux
    if not atk:
        # flammes le long de la lame (derrière)
        t = new()
        for k in range(4):
            u = 0.35 + k * 0.17
            flame_tongue(t, h0x + dx * u + 2, h0y + dy * u + 1, 2.6, 7 + k, 2, f + k, HELL)
        stamp(c, t, None)
    t = new()
    p = lambda u, v: (h0x + ux * u + nx * v, h0y + uy * u + ny * v)
    bm = mask_of(lambda m: m.poly([p(3, -2), p(n - 5, -2), p(n, 0), p(n - 5, 2), p(3, 2)], '#000'))
    shade(t, bm, [DARM[1], DARM[2], DARM[3], DARM[4]], contrast=0.4)
    for (x, y) in bm:
        u = (x + 0.5 - h0x) * ux + (y + 0.5 - h0y) * uy
        v = (x + 0.5 - h0x) * nx + (y + 0.5 - h0y) * ny
        if abs(v) < 0.8 and u > 4:
            t.set(x, y, HELL[3] if u < n - 4 else HELL[4])
        elif abs(v) > 1.5:
            t.set(x, y, HELL[2])
    # garde en cornes + poignée
    t.line(*p(3, -5), *p(3, 5), DARM[3], width=2)
    t.set(*p(2, -6), DHORN[3]); t.set(*p(2, 6), DHORN[3])
    tube(t, [p(-4, 0), p(2, 0)], [1.2, 1.2], DRED)
    t.set(*p(-5, 0), HELL[3])
    stamp(c, t)
    t = new()
    tube(t, arm, [3.8, 3.2, 3.0], DARM)
    ball(t, arm[0][0] + 1, arm[0][1], 4.2, 3.4, DARM)
    ball(t, arm[-1][0], arm[-1][1], 2.6, 2.6, DARM)
    stamp(c, t)
    c.line(arm[1][0] - 2, arm[1][1], arm[1][0] + 1, arm[1][1] + 2, DRED[2])

    # ---- effets
    if atk:
        fx = new()
        arc_fx(fx, X + 26, 30, 26, 1.0, 262, 125, 11, HELL, lead=0.65)
        for y in range(fx.h):
            for x in range(fx.w):
                if c.px[y][x] is not None:
                    fx.px[y][x] = None
        stamp(c, fx, None)
        t = new()
        for k in range(3):
            flame_tongue(t, X + 3 + k * 5, G - 1, 3, 9 - k * 2, 1, k, HELL)
        stamp(c, t, None)
    glow_ring(c, DRED[1], DRED[2], every=2)
    dots(c, ((X + 4, 20, 3), (X + 54, 40, 2), (X + 10, 4, 2), (X + 40, 1, 3), (X + 2, 46, 2)) if f != 1 else
         ((X + 5, 17, 2), (X + 55, 37, 3), (X + 11, 2, 3), (X + 41, 3, 2), (X + 3, 43, 3)), lambda k: HELL[k])
    return c, (W, H)


# ================================================================ export

def frames(fn):
    return frames_boxed(fn)


BOSSES = {
    'hard_scarecrow': scarecrow,
    'hard_werewolf': werewolf,
    'hard_necromancer': necromancer,
    'hard_anubis': anubis,
    'hard_frost_giant': frost_giant,
    'hard_demon_general': demon_general,
}


def build():
    out = {}
    for name, fn in BOSSES.items():
        a, b, k = [cv for cv, _ in frames(fn)]
        out[name] = (a, {})
        out[name + '_b'] = (b, {})
        out[name + '_atk'] = (k, {})
    return out
