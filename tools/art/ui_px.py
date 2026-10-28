"""Primitives de dessin pixel art pour les thèmes d'interface (ui_themes.py / ui_decor.py).

Tout travaille sur des ensembles de points entiers (x, y) : on construit une forme
(disque, polygone, trait épais, courbe de Bézier), puis on l'ombre (lumière haut-gauche),
on la cerne, on lui ajoute un halo semi-transparent.
"""
import math
import random

from ui_frames import Img, col


def lerp(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(min(len(a), len(b))))


def lum(c):
    """Luminance relative WCAG d'une couleur RGB 0..255."""
    def ch(v):
        v /= 255.0
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    return 0.2126 * ch(c[0]) + 0.7152 * ch(c[1]) + 0.0722 * ch(c[2])


def contrast(a, b):
    la, lb = lum(a), lum(b)
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)


def hexc(s):
    s = s.lstrip('#')
    return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4))


# ====================================================================== toile

class Canvas(Img):
    """Img + mélange alpha, transparent par défaut."""

    def get(self, x, y):
        if 0 <= x < self.w and 0 <= y < self.h:
            return self.px[y][x]
        return (0, 0, 0, 0)

    def blend(self, x, y, c, a=255):
        if not (0 <= x < self.w and 0 <= y < self.h) or c is None:
            return
        c = col(c)
        a = a * c[3] / 255.0 / 255.0
        if a <= 0:
            return
        d = self.px[y][x]
        da = d[3] / 255.0
        oa = a + da * (1 - a)
        if oa <= 0:
            return
        rgb = tuple(int(round((c[i] * a + d[i] * da * (1 - a)) / oa)) for i in range(3))
        self.px[y][x] = (*rgb, int(round(oa * 255)))

    def paste(self, other, ox, oy, fx=False, fy=False):
        for y in range(other.h):
            for x in range(other.w):
                p = other.px[y][x]
                if p[3] == 0:
                    continue
                xx = ox + (other.w - 1 - x if fx else x)
                yy = oy + (other.h - 1 - y if fy else y)
                self.blend(xx, yy, p[:3], p[3])

    def opaque_pts(self):
        return {(x, y) for y in range(self.h) for x in range(self.w) if self.px[y][x][3] > 0}


# ====================================================================== formes

def P(pts):
    return {(int(round(x)), int(round(y))) for (x, y) in pts}


def disc(cx, cy, r):
    return {(x, y) for y in range(int(math.floor(cy - r - 1)), int(math.ceil(cy + r + 2)))
            for x in range(int(math.floor(cx - r - 1)), int(math.ceil(cx + r + 2)))
            if (x - cx) ** 2 + (y - cy) ** 2 <= r * r + 0.01}


def ellipse(cx, cy, rx, ry):
    return {(x, y) for y in range(int(cy - ry - 1), int(cy + ry + 2))
            for x in range(int(cx - rx - 1), int(cx + rx + 2))
            if ((x - cx) / max(rx, .01)) ** 2 + ((y - cy) / max(ry, .01)) ** 2 <= 1.0}


def ring(cx, cy, r0, r1):
    return {(x, y) for (x, y) in disc(cx, cy, r1) if (x - cx) ** 2 + (y - cy) ** 2 >= r0 * r0}


def rect(x0, y0, x1, y1):
    return {(x, y) for y in range(y0, y1 + 1) for x in range(x0, x1 + 1)}


def poly(pts):
    """Remplissage d'un polygone (règle pair-impair, centres de pixels)."""
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    out = set()
    n = len(pts)
    for y in range(int(math.floor(min(ys))), int(math.ceil(max(ys))) + 1):
        for x in range(int(math.floor(min(xs))), int(math.ceil(max(xs))) + 1):
            px, py = x + 0.0, y + 0.0
            inside = False
            j = n - 1
            for i in range(n):
                xi, yi = pts[i]
                xj, yj = pts[j]
                if (yi > py) != (yj > py):
                    xc = xi + (py - yi) * (xj - xi) / (yj - yi)
                    if px < xc:
                        inside = not inside
                j = i
            if inside:
                out.add((x, y))
    return out


def line(x0, y0, x1, y1):
    """Bresenham (extrémités incluses)."""
    x0, y0, x1, y1 = int(round(x0)), int(round(y0)), int(round(x1)), int(round(y1))
    pts = []
    dx, dy = abs(x1 - x0), -abs(y1 - y0)
    sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
    err = dx + dy
    while True:
        pts.append((x0, y0))
        if x0 == x1 and y0 == y1:
            break
        e2 = 2 * err
        if e2 >= dy:
            err += dy
            x0 += sx
        if e2 <= dx:
            err += dx
            y0 += sy
    return pts


def polyline(pts):
    out = []
    for a, b in zip(pts, pts[1:]):
        seg = line(a[0], a[1], b[0], b[1])
        out.extend(seg if not out else seg[1:])
    return out


def bezier(ctrl, n=60):
    """Points flottants le long d'une Bézier (degré quelconque)."""
    out = []
    for i in range(n + 1):
        t = i / n
        pts = list(ctrl)
        while len(pts) > 1:
            pts = [((1 - t) * a[0] + t * b[0], (1 - t) * a[1] + t * b[1]) for a, b in zip(pts, pts[1:])]
        out.append(pts[0])
    return out


def curve(ctrl, n=60):
    """Courbe de Bézier 1 px, sans trous (points entiers reliés)."""
    fp = bezier(ctrl, n)
    return polyline([(int(round(x)), int(round(y))) for x, y in fp])


def thick(path, r0, r1=None):
    """Union de disques le long d'un chemin flottant ; rayon r0 -> r1 (effilé)."""
    r1 = r0 if r1 is None else r1
    out = set()
    n = len(path)
    for i, (x, y) in enumerate(path):
        r = r0 + (r1 - r0) * (i / max(1, n - 1))
        if r < 0.5:
            out.add((int(round(x)), int(round(y))))
        else:
            out |= disc(x, y, r)
    return out


def spiral(cx, cy, r0, r1, a0, turns, n=80):
    """Spirale d'Archimède (volute) en points flottants."""
    pts = []
    for i in range(n + 1):
        t = i / n
        a = a0 + t * turns * 2 * math.pi
        r = r0 + (r1 - r0) * t
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def mirror_x(pts, w):
    return {(w - 1 - x, y) for (x, y) in pts}


def mirror_y(pts, h):
    return {(x, h - 1 - y) for (x, y) in pts}


def transpose(pts):
    return {(y, x) for (x, y) in pts}


def shift(pts, dx, dy):
    return {(x + dx, y + dy) for (x, y) in pts}


def border_of(S, diag=False):
    nb = ((1, 0), (-1, 0), (0, 1), (0, -1))
    if diag:
        nb += ((1, 1), (1, -1), (-1, 1), (-1, -1))
    return {(x + dx, y + dy) for (x, y) in S for dx, dy in nb} - set(S)


# ====================================================================== rendu

def fill(im, S, c, a=255):
    for (x, y) in S:
        if a >= 255:
            im.set(x, y, c)
        else:
            im.blend(x, y, c, a)


def outline(im, S, c, diag=False):
    for (x, y) in border_of(S, diag):
        im.set(x, y, c)


def shade(im, S, ramp, light=(-1, -1), edge=True):
    """Ombrage : bords éclairés = ramp[-1], bords à l'ombre = ramp[0], intérieur selon la
    projection sur l'axe de lumière (ramp[1:-1])."""
    S = set(S)
    if not S:
        return
    lx, ly = light
    proj = {p: p[0] * -lx + p[1] * -ly for p in S}   # grand = loin de la lumière
    lo, hi = min(proj.values()), max(proj.values())
    span = max(1e-6, hi - lo)
    mids = ramp[1:-1] if len(ramp) > 2 else ramp
    for p in S:
        x, y = p
        lit = (x + lx, y) not in S or (x, y + ly) not in S
        dark = (x - lx, y) not in S or (x, y - ly) not in S
        if edge and lit and not dark:
            c = ramp[-1]
        elif edge and dark and not lit:
            c = ramp[0]
        else:
            t = (proj[p] - lo) / span
            i = min(len(mids) - 1, int((1 - t) * len(mids)))
            c = mids[i]
        im.set(x, y, c)


def depth(S, cap=99):
    """Profondeur (1 = bord) par érosion 4-voisins, plafonnée."""
    S = set(S)
    D = {}
    cur = set(S)
    d = 1
    while cur and d <= cap:
        inner = {p for p in cur if all((p[0] + dx, p[1] + dy) in cur for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))}
        for p in cur - inner:
            D[p] = d
        cur = inner
        d += 1
    for p in cur:
        D[p] = cap
    return D


def bevel(im, S, ramp, cap=2, light=(-1, -1), th=(0.06, 0.36, 0.66, 0.86)):
    """Ombrage en relief : hauteur = profondeur plafonnée, normale = gradient ;
    plateau = ramp[2], pentes éclairées -> ramp[3..4], pentes à l'ombre -> ramp[0..1]."""
    S = set(S)
    if not S:
        return
    D = depth(S, cap)
    L = (light[0] * 0.6, light[1] * 0.6, 0.53)
    n = len(ramp)
    for (x, y), h in D.items():
        hx = D.get((x + 1, y), 0) - D.get((x - 1, y), 0)
        hy = D.get((x, y + 1), 0) - D.get((x, y - 1), 0)
        nx, ny, nz = -hx / 2.0, -hy / 2.0, 1.0
        k = math.sqrt(nx * nx + ny * ny + nz * nz)
        I = (nx * L[0] + ny * L[1] + nz * L[2]) / k
        if n == 5:
            i = 4 if I > th[3] else 3 if I > th[2] else 2 if I > th[1] else 1 if I > th[0] else 0
        else:
            i = max(0, min(n - 1, int((I + 0.4) / 1.4 * n)))
        im.set(x, y, ramp[i])


def obj(im, S, ramp, ol=(0, 0, 0), light=(-1, -1), diag=False, edge=True, mode='bevel', cap=2):
    """Objet cerné + ombré (mode 'bevel' : relief ; 'ball' : dégradé sur l'axe de lumière)."""
    if ol is not None:
        outline(im, S, ol, diag)
    if mode == 'bevel':
        bevel(im, S, ramp, cap, light)
    else:
        shade(im, S, ramp, light, edge)


def glow(im, S, c, levels=((1, 150), (2, 80), (3, 34)), under=True):
    """Halo semi-transparent autour de S (distance euclidienne), posé sous l'existant si under."""
    S = set(S)
    if not S:
        return
    R = max(r for r, _ in levels)
    seen = {}
    for (x, y) in S:
        for dy in range(-R, R + 1):
            for dx in range(-R, R + 1):
                q = (x + dx, y + dy)
                if q in S:
                    continue
                d = math.hypot(dx, dy)
                if d <= seen.get(q, 99):
                    seen[q] = d
    for (qx, qy), d in seen.items():
        a = 0
        for r, al in levels:
            if d <= r + 0.01:
                a = al
                break
        if not a:
            continue
        if not (0 <= qx < im.w and 0 <= qy < im.h):
            continue
        if under:
            cur = im.get(qx, qy)
            if cur[3] >= 255:
                continue
            tmp = col(c)
            # mélange « sous » : l'existant reste devant
            base_a = a / 255.0
            ca = cur[3] / 255.0
            oa = ca + base_a * (1 - ca)
            if oa <= 0:
                continue
            rgb = tuple(int(round((cur[i] * ca + tmp[i] * base_a * (1 - ca)) / oa)) for i in range(3))
            im.px[qy][qx] = (*rgb, int(round(oa * 255)))
        else:
            im.blend(qx, qy, c, a)


def sparkle(im, x, y, c_core, c_ray, r=2):
    im.set(x, y, c_core)
    for k in range(1, r + 1):
        for dx, dy in ((k, 0), (-k, 0), (0, k), (0, -k)):
            if k < r:
                im.set(x + dx, y + dy, c_ray)
            else:
                im.blend(x + dx, y + dy, c_ray, 150)


# ====================================================================== bruit périodique

def tile_noise(w, h, cell, seed, octaves=3):
    """Bruit de valeur périodique (w, h multiples de cell * 2**k) dans [0, 1]."""
    rnd = random.Random(seed)
    out = [[0.0] * w for _ in range(h)]
    amp, tot = 1.0, 0.0
    c = cell
    for _ in range(octaves):
        gw, gh = max(1, w // c), max(1, h // c)
        g = [[rnd.random() for _ in range(gw)] for _ in range(gh)]
        for y in range(h):
            fy = y / c
            y0 = int(fy) % gh
            y1 = (y0 + 1) % gh
            ty = fy - int(fy)
            ty = ty * ty * (3 - 2 * ty)
            for x in range(w):
                fx = x / c
                x0 = int(fx) % gw
                x1 = (x0 + 1) % gw
                tx = fx - int(fx)
                tx = tx * tx * (3 - 2 * tx)
                a = g[y0][x0] + (g[y0][x1] - g[y0][x0]) * tx
                b = g[y1][x0] + (g[y1][x1] - g[y1][x0]) * tx
                out[y][x] += amp * (a + (b - a) * ty)
        tot += amp
        amp *= 0.5
        c = max(1, c // 2)
    return [[v / tot for v in row] for row in out]


def wrap_set(im, x, y, c, a=255):
    x %= im.w
    y %= im.h
    if a >= 255:
        im.set(x, y, c)
    else:
        im.blend(x, y, c, a)


def group(im, parts, ol=(0, 0, 0), diag=False, sep=True):
    """Plusieurs pièces sous un seul contour. parts = [(S, ramp[, cap])] dans l'ordre de dessin ;
    sep : la frontière d'une pièce posée sur une précédente est soulignée en ramp[0]."""
    U = set()
    for p in parts:
        U |= set(p[0])
    if ol is not None:
        outline(im, U, ol, diag)
    drawn = set()
    for p in parts:
        S, ramp = set(p[0]), p[1]
        cap = p[2] if len(p) > 2 else 2
        bevel(im, S, ramp, cap)
        if sep and drawn:
            for q in border_of(S) & drawn - S:
                im.set(q[0], q[1], ramp[0])
        drawn |= S
    return U



# ====================================================================== motifs

def rot(pts, cx, cy, a):
    ca, sa = math.cos(a), math.sin(a)
    return [(cx + (x - cx) * ca - (y - cy) * sa, cy + (x - cx) * sa + (y - cy) * ca) for (x, y) in pts]


def leaf(x0, y0, a, L, W):
    """Feuille pointue : base (x0, y0), direction a (radians), longueur L, demi-largeur W."""
    pts = []
    n = 12
    for i in range(n + 1):
        t = i / n
        pts.append((t * L, W * math.sin(math.pi * t) * (1.2 - 0.55 * t)))
    for i in range(n, -1, -1):
        t = i / n
        pts.append((t * L, -W * math.sin(math.pi * t) * (1.2 - 0.55 * t)))
    ca, sa = math.cos(a), math.sin(a)
    return poly([(x0 + x * ca - y * sa, y0 + x * sa + y * ca) for (x, y) in pts])


def leaf_vein(x0, y0, a, L):
    return line(x0, y0, x0 + math.cos(a) * L * 0.8, y0 + math.sin(a) * L * 0.8)


def crystal(cx, cy, a, L, W, back=0.35):
    """Cristal losange allongé (prisme) centré, axe a."""
    pts = [(L, 0), (L * (1 - back) * 0.5, W), (-L * back, W * 0.8), (-L, 0), (-L * back, -W * 0.8),
           (L * (1 - back) * 0.5, -W)]
    ca, sa = math.cos(a), math.sin(a)
    return poly([(cx + x * ca - y * sa, cy + x * sa + y * ca) for (x, y) in pts])


def shard(x0, y0, a, L, W):
    """Éclat (triangle effilé) partant de (x0, y0) vers a."""
    ca, sa = math.cos(a), math.sin(a)
    pts = [(0, -W), (L, 0), (0, W), (-W * 0.6, 0)]
    return poly([(x0 + x * ca - y * sa, y0 + x * sa + y * ca) for (x, y) in pts])


def flake(cx, cy, r, arms=6, a0=-math.pi / 2, br=(0.45, 0.72), brl=0.32):
    """Flocon : bras + branches latérales (points 1 px)."""
    out = set()
    for k in range(arms):
        a = a0 + k * 2 * math.pi / arms
        ex, ey = cx + r * math.cos(a), cy + r * math.sin(a)
        out |= set(line(cx, cy, ex, ey))
        for f in br:
            bx, by = cx + r * f * math.cos(a), cy + r * f * math.sin(a)
            for s in (-1, 1):
                b = a + s * math.pi / 3
                L = r * brl * (1.15 - f)
                out |= set(line(bx, by, bx + L * math.cos(b), by + L * math.sin(b)))
    return out


def blossom_pts(cx, cy, r=2.3, pr=1.45, a0=-math.pi / 2):
    pts = set()
    for k in range(5):
        a = a0 + k * 2 * math.pi / 5
        pts |= disc(cx + r * math.cos(a), cy + r * math.sin(a), pr)
    pts |= disc(cx, cy, 1.2)
    return pts


def skull_pts(cx, cy, s=1.0):
    """Crâne de face : cranium + mâchoire ; renvoie (forme, yeux, nez, dents)."""
    cran = ellipse(cx, cy - 1.0 * s, 4.6 * s, 4.2 * s)
    jaw = poly([(cx - 3.0 * s, cy + 1.5 * s), (cx + 3.0 * s, cy + 1.5 * s), (cx + 2.4 * s, cy + 5.2 * s),
                (cx - 2.4 * s, cy + 5.2 * s)])
    eyes = ellipse(cx - 1.9 * s, cy + 0.2 * s, 1.25 * s, 1.15 * s) | ellipse(cx + 1.9 * s, cy + 0.2 * s, 1.25 * s, 1.15 * s)
    nose = {(int(round(cx)), int(round(cy + 2.3 * s)))}
    teeth = {(int(round(cx + dx * s)), int(round(cy + 4.0 * s))) for dx in (-1.5, 0, 1.5)}
    return cran | jaw, eyes, nose, teeth


def orb(im, cx, cy, r, ramp, ol=(0, 0, 0)):
    """Petite sphère lisible (baie, perle, rivet) : base, croissant d'ombre, reflet."""
    S = disc(cx, cy, r)
    if ol is not None:
        outline(im, S, ol)
    for (x, y) in S:
        d = ((x - cx) + (y - cy)) / max(r, 0.5)
        im.set(x, y, ramp[1] if d > 0.55 else ramp[2])
    hx, hy = int(round(cx - r * 0.4)), int(round(cy - r * 0.4))
    if (hx, hy) in S:
        im.set(hx, hy, ramp[4] if r >= 1.2 else ramp[3])
        if r >= 2.2:
            for q in ((hx + 1, hy), (hx, hy + 1)):
                if q in S:
                    im.set(q[0], q[1], ramp[3])
    return S
