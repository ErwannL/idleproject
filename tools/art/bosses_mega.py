"""Méga boss de fin de monde (étape 10) : dragon des cendres, chevalier déchu, roi démoniaque.

Chibi 16 bits, lumière en haut à gauche, regard vers la GAUCHE, pieds sur la dernière ligne.
Pour chaque boss : <nom> (repos), <nom>_b (respiration / battement d'ailes), <nom>_atk (attaque).
Les trois images d'un boss partagent exactement le même canvas.
Ce module remplace les anciens sprites (build.py le charge après enemies.py).
"""
import math

from lib import Canvas
from knight import spine_fill

OUT = '#1a1226'
WHITE = '#ffffff'
LIGHT = (-0.6, -0.8)
PAD = 40

GOLD = ['#6a3414', '#b0661a', '#e0a630', '#ffd86a', '#fff6c8']


# ---------------------------------------------------------------- outils de dessin

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


def mask_of(draw, w=200, h=200):
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
    shade(c, mask_of(lambda m: m.poly(pts, '#000')), R, **kw)


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
    """Masque d'un ruban d'épaisseur variable le long d'une épine."""
    return mask_of(lambda m: spine_fill(m, spine, widths, lambda t, s, x, y: '#000'))


def tube(c, spine, widths, R, **kw):
    m = tube_mask(spine, widths)
    shade(c, m, R, **kw)
    return m


def horn(c, spine, widths, R, ring=None, ring_at=None):
    """Corne : ruban effilé, arête claire côté haut, pointe très claire."""
    def f(t, s, x, y):
        if s < -0.45:
            return R[3] if t < 0.8 else R[4]
        if s > 0.5:
            return R[0]
        return R[2] if t < 0.65 else R[3]
    spine_fill(c, spine, widths, f)
    if ring:
        for rt in ring_at or ():
            i = rt * (len(spine) - 1)
            j = min(len(spine) - 2, int(i))
            u = i - j
            px = spine[j][0] + (spine[j + 1][0] - spine[j][0]) * u
            py = spine[j][1] + (spine[j + 1][1] - spine[j][1]) * u
            dx, dy = spine[j + 1][0] - spine[j][0], spine[j + 1][1] - spine[j][1]
            n = math.hypot(dx, dy) or 1
            nx, ny = -dy / n, dx / n
            wv = widths[min(len(widths) - 1, int(rt * (len(widths) - 1)))] + 0.6
            for k in range(-6, 7):
                q = k / 6 * wv
                col = ring[3] if k < -2 else ring[2] if k < 3 else ring[1]
                c.setf(px + nx * q, py + ny * q, col)
                c.setf(px + nx * q + dx / n * 0.8, py + ny * q + dy / n * 0.8, col)


def flame_tongue(c, bx, base, wd, hgt, bend, phase, F):
    """Langue de flamme (F : sombre -> blanc), pointe vers le haut."""
    for y in range(int(base - hgt), int(base) + 1):
        u = min(1.0, max(0.0, (base - y) / hgt))
        cx = bx + bend * u * u + math.sin(u * 6 + phase) * 1.0
        half = wd * (1 - u) ** 1.15 * min(1.0, 0.55 + u * 3)
        for x in range(int(cx - half - 1), int(cx + half + 2)):
            d = abs(x + 0.5 - cx) / max(half, 0.01)
            if d > 1:
                continue
            k = 4 - int(d * 2.2 + u * 2.4)
            c.set(x, y, F[max(0, min(4, k))])


def shifted(c, dx, dy=0):
    """Décale tout le calque (recentrage dans le cadre)."""
    n = Layer(c.lw, c.lh)
    for y in range(c.h):
        for x in range(c.w):
            if c.px[y][x] is not None and 0 <= x + dx < c.w and 0 <= y + dy < c.h:
                n.px[y + dy][x + dx] = c.px[y][x]
    return n


def finalize(c, w, h):
    """Recadre la zone logique w×h dans un Canvas simple."""
    out = Canvas(w, h)
    for y in range(h):
        for x in range(w):
            out.px[y][x] = c.px[y + PAD][x + PAD]
    return out


def clipped(c, w, h):
    """Nombre de pixels dessinés hors cadre (contrôle)."""
    n = 0
    for y in range(c.h):
        for x in range(c.w):
            if c.px[y][x] is not None and not (PAD <= x < PAD + w and PAD <= y < PAD + h):
                n += 1
    return n


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


# ================================================================ DRAGON DES CENDRES (monde 4)

DW, DH = 76, 68
SC = ['#120b16', '#22161f', '#3a2730', '#583b42', '#805a56']          # écailles de cendre
SCF = ['#0c0810', '#170f18', '#271b24', '#3a2932', '#523c40']         # plan arrière
EMB = ['#6a160c', '#c03a10', '#f0761c', '#ffbc3c', '#fff1a6']         # braise / ventre
MEMB = ['#2a0812', '#4e1020', '#80202a', '#b63c2c', '#ec7438']        # membrane
MEMBF = ['#1e0610', '#380c1a', '#5a1622', '#862a28', '#b04a30']
HORN = ['#2a1c22', '#5a4644', '#968068', '#d4c29e', '#fff4d4']
EYE = ['#ff6a1a', '#ffc23a', '#fff3a0']
MOUTH = '#3a0610'


def scale_tex(L, R, x0=-40, y0=-40, x1=200, y1=200):
    """Écailles : petits arcs plus sombres en quinconce sur les zones moyennes/claires."""
    down = {R[4]: R[3], R[3]: R[2], R[2]: R[1]}
    for y in range(y0, y1):
        for x in range(x0, x1):
            col = L.get(x, y)
            if col not in down:
                continue
            k = (x + (y // 3) * 2) % 5
            if (y % 3 == 0 and k in (0, 2)) or (y % 3 == 1 and k == 1):
                L.set(x, y, down[col])


def _wing(L, shoulder, elbow, wrist, tips, attach, R, bone, vein, scallop=0.3):
    """Aile membraneuse : bras osseux, doigts, membrane festonnée et nervures lumineuses."""
    pts = [shoulder, elbow, wrist]
    for i, t in enumerate(tips):
        pts.append(t)
        nxt = tips[i + 1] if i + 1 < len(tips) else attach
        mx, my = (t[0] + nxt[0]) / 2, (t[1] + nxt[1]) / 2
        pts.append((mx + (wrist[0] - mx) * scallop, my + (wrist[1] - my) * scallop))
    pts.append(attach)
    m = mask_of(lambda t: t.poly(pts, '#000'))
    shade(L, m, R, contrast=0.3, bias=0.05)
    # lumière transmise près des bords festonnés
    for (x, y) in m:
        if any((x + dx, y + dy) not in m for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
            L.set(x, y, R[3])
    for t in tips:
        L.line(wrist[0], wrist[1], t[0], t[1], vein)
    for t in tips:
        # doigt : os sombre du poignet jusqu'aux 2/3
        mx, my = wrist[0] + (t[0] - wrist[0]) * 0.75, wrist[1] + (t[1] - wrist[1]) * 0.75
        L.line(wrist[0], wrist[1], mx, my, bone[1])
        L.set(t[0], t[1], bone[2])
    L.line(shoulder[0], shoulder[1], elbow[0], elbow[1], bone[1], width=2.4)
    L.line(elbow[0], elbow[1], wrist[0], wrist[1], bone[1], width=2)
    L.line(elbow[0] - 0.6, elbow[1] - 0.6, wrist[0] - 0.6, wrist[1] - 0.6, bone[2])
    # griffe du pouce
    L.set(wrist[0] - 1, wrist[1] - 1, HORN[3])
    L.set(wrist[0] - 2, wrist[1] - 2, HORN[4])


def _claws(L, xs, y, R=HORN):
    for x in xs:
        L.set(x, y, R[3])
        L.set(x - 1, y, R[2])
        L.set(x, y - 1, R[2])


def _spike(L, base, tip, w, R):
    """Pique dorsale incandescente."""
    bx, by = base
    tx, ty = tip
    dx, dy = tx - bx, ty - by
    n = math.hypot(dx, dy) or 1
    nx, ny = -dy / n * w / 2, dx / n * w / 2
    spoly(L, [(bx - nx, by - ny), (tx, ty), (bx + nx, by + ny)], R, contrast=0.5)
    L.set(tx, ty, R[-1])


def breath(L, x0, y0, x1, y1, r0, r1, F, phase):
    """Souffle conique de x0,y0 vers x1,y1 : bords ondulés, cœur blanc près de la gueule, bouffées au bout."""
    ax, ay = x1 - x0, y1 - y0
    ln = math.hypot(ax, ay)
    ux, uy = ax / ln, ay / ln
    for y in range(int(min(y0, y1) - r1 - 3), int(max(y0, y1) + r1 + 4)):
        for x in range(int(min(x0, x1) - r1 - 3), int(max(x0, x1) + r1 + 4)):
            px, py = x + 0.5 - x0, y + 0.5 - y0
            along_ = px * ux + py * uy
            perp_ = px * -uy + py * ux
            u = along_ / ln
            if u < -0.05:
                continue
            side = 1 if perp_ > 0 else 0
            uu = max(0.0, min(u, 1.0))
            r = r0 + (r1 - r0) * uu ** 0.8
            r *= 1 + 0.16 * math.sin(uu * 15 + side * 2.2 + phase) + 0.08 * math.sin(uu * 31 + phase)
            if u > 0.9:
                # bout festonné : trois langues de feu
                lim = ln * 0.9 + r * (0.35 + 0.45 * (0.5 + 0.5 * math.cos(perp_ / r * 3 * math.pi)))
                if along_ > lim:
                    continue
            k = abs(perp_) / r
            if k > 1:
                continue
            heat = (1 - k) * 0.8 + (1 - uu) * 0.55 - 0.1
            idx = 1 + int(heat * 3.2)
            if k > 0.86:
                idx = 1
            L.set(x, y, F[max(1, min(4, idx))])


def _dragon_head(c, new, ox, oy, atk):
    # corne lointaine (part vers l'arrière, plus basse)
    t = new()
    horn(t, [(ox + 8, oy - 3), (ox + 14, oy - 8), (ox + 20, oy - 10), (ox + 25, oy - 8)], [2.4, 2.0, 1.3, 0.5],
         [HORN[0], HORN[0], HORN[1], HORN[2], HORN[3]])
    stamp(c, t)
    t = new()
    # crâne
    ball(t, ox + 4, oy, 10, 8.5, SC)
    # museau massif (mâchoire supérieure) avec corne nasale
    spoly(t, [(ox - 14, oy + 1), (ox - 12, oy - 3), (ox - 4, oy - 5), (ox + 5, oy - 2), (ox + 6, oy + 6),
              (ox - 14, oy + 6)], SC, contrast=0.4)
    # épines de joue / collerette
    for (bx_, b_), (tx, ty) in (((ox + 10, oy + 4), (ox + 18, oy + 3)), ((ox + 9, oy + 7), (ox + 16, oy + 10)),
                                ((ox + 12, oy), (ox + 18, oy - 3))):
        _spike(t, (bx_, b_), (tx, ty), 3.4, [SC[0], SC[2], SC[3], HORN[2], HORN[3]])
    stamp(c, t)
    # corne nasale
    t = new()
    horn(t, [(ox - 10, oy - 3), (ox - 11, oy - 6), (ox - 10, oy - 9)], [1.7, 1.1, 0.4], HORN)
    stamp(c, t)

    # mâchoire inférieure (grande ouverte en attaque)
    t = new()
    if atk:
        jaw = [(ox - 11, oy + 15), (ox - 3, oy + 10), (ox + 6, oy + 6), (ox + 7, oy + 9), (ox - 1, oy + 15),
               (ox - 10, oy + 18)]
    else:
        jaw = [(ox - 13, oy + 7), (ox + 6, oy + 6), (ox + 7, oy + 9), (ox - 2, oy + 11), (ox - 11, oy + 10)]
    spoly(t, jaw, SC, contrast=0.35, bias=-0.08)
    stamp(c, t)
    if atk:
        # crocs du bas
        for k in range(4):
            x = ox - 10 + k * 3
            y = oy + 14 - k * 1.3
            c.set(x, y, WHITE); c.set(x, y - 1, WHITE)
        # crocs du haut
        for x in (ox - 13, ox - 9, ox - 5):
            c.set(x, oy + 6, WHITE); c.set(x, oy + 7, WHITE)
    else:
        c.line(ox - 13, oy + 6.5, ox + 5, oy + 6.5, MOUTH)
        for x in (ox - 12, ox - 8, ox - 4):
            c.set(x, oy + 7, WHITE)
        c.set(ox - 12, oy + 8, WHITE)
        c.set(ox - 6, oy + 6, WHITE)
        # lueur entre les crocs
        c.set(ox - 1, oy + 6.5, EMB[3]); c.set(ox, oy + 6.5, EMB[2]); c.set(ox + 1, oy + 6.5, EMB[1])
    # naseau
    c.set(ox - 12, oy - 1, OUT); c.set(ox - 11, oy - 1, OUT)
    c.set(ox - 11, oy, EMB[1])
    # reflets du museau et du crâne
    c.line(ox - 9, oy - 4, ox - 4, oy - 5, SC[4])
    c.line(ox - 1, oy - 7, ox + 5, oy - 8, SC[4])
    # arcade sourcilière lourde + œil furieux
    ex, ey = int(ox - 4), int(oy - 2)
    spoly(c, [(ex - 3, ey - 3), (ex + 6, ey - 2), (ex + 9, ey - 5), (ex + 7, ey), (ex - 2, ey - 1)],
          [SC[0], SC[2], SC[3], SC[4], SC[4]])
    c.rect(ex, ey, 6, 3, EYE[1])
    c.rect(ex, ey, 6, 1, EYE[2])
    c.set(ex + 5, ey + 2, EYE[0]); c.set(ex + 4, ey + 2, EYE[0])
    c.rect(ex + 2, ey, 1, 3, OUT)           # pupille fendue
    c.set(ex, ey, WHITE); c.set(ex, ey + 1, EYE[2])
    c.line(ex - 2, ey - 1, ex + 6, ey - 1, OUT)
    c.line(ex - 2, ey - 2, ex + 2, ey - 1, OUT)
    # corne proche, anneau d'or
    t = new()
    horn(t, [(ox + 3, oy - 5), (ox + 7, oy - 13), (ox + 13, oy - 16), (ox + 19, oy - 17)], [3.4, 2.7, 1.6, 0.5],
         HORN, ring=GOLD, ring_at=(0.3,))
    stamp(c, t)
    # lueur de l'œil
    c.set(ex + 7, ey + 1, EYE[0]) if c.get(ex + 7, ey + 1) is None else None


def dragon(f):
    W, H = DW, DH
    new = lambda: Layer(W, H)
    c = new()
    by = 1 if f == 1 else 0           # respiration
    atk = f == 2

    # ---- aile lointaine (derrière tout)
    w = new()
    if f == 1:
        _wing(w, (39, 37 + by), (36, 24), (34, 14), [(42, 7), (50, 10), (55, 19)], (46, 37 + by),
              MEMBF, [SCF[0], SCF[2], SCF[4]], MEMBF[3])
    elif atk:
        _wing(w, (39, 37), (33, 22), (30, 7), [(38, -0.5), (47, 2), (53, 12)], (46, 37),
              MEMBF, [SCF[0], SCF[2], SCF[4]], MEMBF[3])
    else:
        _wing(w, (39, 37), (35, 21), (33, 5), [(41, 0), (50, 3), (55, 13)], (46, 37),
              MEMBF, [SCF[0], SCF[2], SCF[4]], MEMBF[3])
    stamp(c, w)

    # ---- queue (s'enroule à droite, pointe en fer de lance)
    t = new()
    tail = [(56, 54 + by), (63, 59), (67, 59), (69, 54), (68, 49)]
    tube(t, tail, [6, 5, 4, 3, 2], SC, contrast=0.4)
    for (bx_, by_), (tx, ty) in (((61, 56), (62, 51)), ((66, 58), (67, 53)), ((69, 55), (71, 52))):
        _spike(t, (bx_, by_ + 0.5), (tx, ty), 3, EMB)
    spoly(t, [(66, 49), (69, 41), (71, 49), (69, 51)], EMB, contrast=0.5)
    t.set(69, 42, EMB[4])
    stamp(c, t)

    # ---- pattes lointaines (plus sombres)
    t = new()
    tube(t, [(58, 54 + by), (61, 60), (60, 62)], [4, 3.5, 3], SCF)
    spoly(t, [(55, 64), (63, 64), (64, 66), (54, 66)], SCF)
    _claws(t, (55, 58), 66, [SCF[2], SCF[3], SCF[4], SCF[4]])
    tube(t, [(36, 54 + by), (36, 60), (37, 62)], [4, 3.5, 3], SCF)
    spoly(t, [(32, 64), (40, 64), (40, 66), (31, 66)], SCF)
    _claws(t, (32, 35), 66, [SCF[2], SCF[3], SCF[4], SCF[4]])
    stamp(c, t)

    # ---- piques dorsales (derrière le corps)
    t = new()
    for (bx_, b_), (tx, ty), wd in (((41, 39), (43, 31), 5), ((47, 40), (50, 32), 5), ((53, 43), (57, 36), 5),
                                    ((58, 47), (63, 42), 4)):
        _spike(t, (bx_, b_ + by), (tx, ty + by), wd, EMB)
    stamp(c, t)

    # ---- corps massif
    t = new()
    ball(t, 46, 49 + by, 14, 10.5, SC)
    # ventre incandescent (plaques)
    bm = mask_of(lambda m: m.ellipse(42, 56 + by, 12, 5, '#000'))
    for (x, y) in bm:
        if t.get(x, y) is None:
            continue
        rowk = (y - by) % 3
        if rowk == 0:
            t.set(x, y, EMB[1])
        else:
            t.set(x, y, EMB[3] if (x < 42 and rowk == 1) else EMB[2])
    scale_tex(t, SC)
    # plastron ventral incandescent le long du poitrail
    pm = [(x, y) for y in range(40 + by, 60 + by) for x in range(20, 60) if t.get(x, y) is not None]
    for (x, y) in pm:
        row = [xx for (xx, yy) in pm if yy == y]
        if x - min(row) < 4 and y > 41 + by:
            k = (y - by) % 3
            t.set(x, y, EMB[1] if k == 0 else (EMB[3] if x - min(row) < 2 else EMB[2]))
    # fissures de magma (runes de feu) sur le flanc
    for (x0, y0, x1, y1) in ((44, 44, 48, 47), (48, 47, 47, 51), (52, 44, 55, 46), (40, 47, 42, 49)):
        t.line(x0, y0 + by, x1, y1 + by, EMB[2])
    t.set(48, 47 + by, EMB[4]); t.set(55, 46 + by, EMB[3])
    stamp(c, t)

    # ---- patte arrière proche
    t = new()
    ball(t, 55, 53 + by, 7.5, 8, SC)
    scale_tex(t, SC)
    tube(t, [(57, 58 + by), (59, 61), (58, 62)], [4, 3.5, 3.2], SC)
    spoly(t, [(50, 63), (61, 63), (62, 66), (49, 66)], SC)
    for (x0, y0, x1, y1) in ((53, 50, 56, 53),):
        t.line(x0, y0 + by, x1, y1 + by, EMB[2])
    _claws(t, (50, 54, 58), 66)
    stamp(c, t)

    # ---- cou épais + gorge incandescente
    hx, hy = (0, 0) if not atk else (5, -1)
    if f == 1:
        hx, hy = 0, 1
    neck = [(38, 47 + by), (33, 38 + by), (29 + hx, 30 + hy)]
    t = new()
    nm = tube(t, neck, [9, 8, 7], SC, contrast=0.4)
    scale_tex(t, SC)
    for (x, y) in nm:
        # plaques de gorge côté avant-bas (gauche)
        lx = min(xx for (xx, yy) in nm if yy == y)
        if x - lx < 4 and y > 31 + hy:
            k = (y - x) % 3
            t.set(x, y, EMB[1] if k == 0 else (EMB[3] if x - lx < 2 else EMB[2]))
    stamp(c, t)

    # ---- souffle de feu (derrière la tête : il sort d'entre les mâchoires)
    ox, oy = 20 + hx, 20 + hy
    if atk:
        fx = new()
        breath(fx, ox - 8, oy + 9, 1, oy + 22, 2.2, 10, EMB, 0.0)
        stamp(c, fx, EMB[0])

    # ---- tête (grosse, chibi)
    _dragon_head(c, new, ox, oy, atk)

    # ---- patte avant proche
    t = new()
    ball(t, 34, 52 + by, 6.5, 6.5, SC)
    tube(t, [(32, 56 + by), (30, 60), (29, 62)], [4, 3.5, 3.2], SC)
    spoly(t, [(23, 63), (33, 63), (34, 66), (22, 66)], SC)
    _claws(t, (23, 27, 31), 66)
    t.line(33, 50 + by, 36, 53 + by, EMB[2])
    stamp(c, t)

    # ---- aile proche (devant le corps)
    t = new()
    if f == 1:
        _wing(t, (47, 40), (55, 30), (62, 22), [(67, 18), (71, 28), (70, 37), (64, 42)], (54, 46),
              MEMB, [SC[0], SC[2], SC[4]], MEMB[3])
    elif atk:
        _wing(t, (47, 39), (53, 24), (57, 7), [(63, 2), (70, 9), (71, 22), (66, 32)], (54, 45),
              MEMB, [SC[0], SC[2], SC[4]], MEMB[3])
    else:
        _wing(t, (47, 39), (54, 25), (59, 9), [(65, 4), (70, 12), (71, 25), (66, 34)], (54, 45),
              MEMB, [SC[0], SC[2], SC[4]], MEMB[3])
    stamp(c, t)

    if atk:
        for x, y, k in ((12, 46, 3), (8, 54, 2), (14, 38, 4), (3, 56, 3), (-2, 30, 4), (5, 30, 3)):
            if c.get(x, y) is None:
                c.set(x, y, EMB[k])
    else:
        # braises et fumée qui s'élèvent
        pts = ((4, 14, 3), (8, 8, 2), (2, 22, 1)) if f == 0 else ((5, 12, 2), (9, 5, 3), (3, 19, 3))
        for x, y, k in pts:
            if c.get(x, y) is None:
                c.set(x, y, EMB[k])
        if f == 0:
            c.set(ox - 13, oy - 3, '#6a5a6a'); c.set(ox - 14, oy - 5, '#4a3e4e')
        else:
            c.set(ox - 14, oy - 3, '#6a5a6a'); c.set(ox - 15, oy - 6, '#4a3e4e')
    glow_ring(c, '#5a1c14')
    sparks = ((70, 44), (62, 1), (28, 3), (44, 26)) if f != 1 else ((71, 42), (64, 4), (27, 6), (45, 22))
    for x, y in sparks:
        if c.get(x, y) is None:
            c.set(x, y, EMB[3])
    return shifted(c, 3), (W, H)



# ================================================================ CHEVALIER DÉCHU (monde 5)

KW, KH = 64, 64
KG = 62                                                               # sol (contour sur la dernière ligne)
AR = ['#0e0e1a', '#1e2032', '#33384f', '#525d7c', '#8494b8']          # acier noir
ARF = ['#08080f', '#121320', '#1e2132', '#30374c', '#4a566e']         # plan arrière
FROST = ['#4a78b8', '#9ccaf0', '#e4f8ff']
PLUME = ['#3a0612', '#6e0e1e', '#a81c26', '#e0443a', '#ff8a6a']
CAPE = ['#0a0710', '#150f1c', '#21182a', '#30233a', '#45324e']
CAPE_IN = ['#2a0610', '#4a0c18', '#6e1420']
RUNE = ['#1e4aa8', '#46b4ff', '#c8f4ff']
REYE = ['#8a0a14', '#ff2a2a', '#ffc0a8']
TGOLD = ['#4a2a18', '#8a5a20', '#c08a30', '#e8c060', '#fff0b0']       # or terni
TRAIL = ['#161a44', '#2e4aa0', '#6ab0f0', '#d8f6ff']


def frost(L, R, amount=2, skip=()):
    """Givre : bords supérieurs des pièces blanchis, quelques cristaux sur la deuxième rangée."""
    src = [row[:] for row in L.px]
    for y in range(1, L.h - 1):
        for x in range(1, L.w - 1):
            c = src[y][x]
            if c is None or c in skip or c == OUT:
                continue
            if src[y - 1][x] != OUT or src[y - 2][x] is not None:
                continue
            # dessus extérieur de la silhouette : neige / givre
            L.px[y][x] = FROST[2] if (x + y) % 3 else FROST[1]
            if amount > 1 and src[y + 1][x] not in (None, OUT) and (x * 5 + y) % 3 == 0:
                L.px[y + 1][x] = FROST[1]


def icicles(L, pts):
    for x, y, n in pts:
        for k in range(n):
            L.set(x, y + k, FROST[1] if k < n - 1 else FROST[2])


def snow(L, pts):
    for x, y, big in pts:
        if L.get(x, y) is not None:
            continue
        L.set(x, y, FROST[2])
        if big:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                if L.get(x + dx, y + dy) is None:
                    L.set(x + dx, y + dy, FROST[0])


def greatsword(L, hand, ang, blade=27, R=AR):
    """Grande épée runique : lame large, gouttière à runes, garde à pointes, pommeau à gemme rouge."""
    a = math.radians(ang)
    dx, dy = math.cos(a), math.sin(a)
    nx, ny = -dy, dx
    gx, gy = hand[0] + dx * 3, hand[1] + dy * 3                     # base de la lame (garde)
    tip = (gx + dx * blade, gy + dy * blade)
    w0, w1 = 3.4, 2.9
    pts = [(gx + nx * w0, gy + ny * w0), (tip[0] - dx * 4 + nx * w1, tip[1] - dy * 4 + ny * w1), tip,
           (tip[0] - dx * 4 - nx * w1, tip[1] - dy * 4 - ny * w1), (gx - nx * w0, gy - ny * w0)]
    m = mask_of(lambda t: t.poly(pts, '#000'))
    shade(L, m, ['#1a1e30', '#30384e', '#56627e', '#8a9ab8', '#d0dcf0'], contrast=0.3)
    # tranchant clair d'un côté, gouttière sombre au centre avec runes
    side = 1 if (nx * LIGHT[0] + ny * LIGHT[1]) > 0 else -1
    for i in range(int(blade * 2)):
        u = i / 2
        px, py = gx + dx * u, gy + dy * u
        L.setf(px + nx * side * 2.2, py + ny * side * 2.2, '#d0dcf0')
        L.setf(px, py, '#141826')
    for k, u in enumerate(range(3, int(blade) - 5, 4)):
        px, py = gx + dx * u, gy + dy * u
        L.set(px, py, RUNE[2] if k % 2 == 0 else RUNE[1])
        L.set(px + dx, py + dy, RUNE[1])
        L.set(px + nx, py + ny, RUNE[0]) if k % 2 else L.set(px - nx, py - ny, RUNE[0])
    # garde à pointes
    for sgn in (-1, 1):
        ex, ey = gx + nx * sgn * 6 + dx * 1.5, gy + ny * sgn * 6 + dy * 1.5
        L.line(gx - dx * 0.5, gy - dy * 0.5, ex, ey, TGOLD[2], width=2.2)
        L.line(gx - dx * 1.2 + nx * sgn, gy - dy * 1.2 + ny * sgn, ex - dx * 0.7, ey - dy * 0.7, TGOLD[3])
        L.set(ex + dx, ey + dy, TGOLD[4])
    ball(L, gx, gy, 1.6, 1.6, [REYE[0], REYE[0], REYE[1], REYE[1], REYE[2]])
    # poignée + pommeau
    L.line(hand[0] + dx * 2, hand[1] + dy * 2, hand[0] - dx * 3.5, hand[1] - dy * 3.5, '#4a2a2a', width=2)
    ball(L, hand[0] - dx * 4.5, hand[1] - dy * 4.5, 1.8, 1.8, TGOLD)
    return tip


def gauntlet(L, x, y, R):
    ball(L, x, y, 3.2, 2.8, R)
    L.set(x - 2, y - 1, R[4])


def fallen_knight(f):
    W, H = KW, KH
    new = lambda: Layer(W, H)
    c = new()
    atk = f == 2
    by = 1 if f == 1 else 0           # respiration
    ln = -2 if atk else 0             # buste penché vers l'avant à l'attaque
    G = KG
    GB = G + 1                        # bas des solerets (le contour tombe sur la dernière ligne)

    # ---- cape en lambeaux (derrière)
    t = new()
    sway = (0, 2, -1)[f]
    hem = []
    for i, x in enumerate(range(31, 59, 3)):
        hem.append((x + sway * (i / 9), G - 3 + (3 if i % 2 else -2) - i * 0.9 + (f == 1) * (i % 3 == 1) * 2))
    cape_pts = [(28 + ln, 23 + by), (44 + ln, 22 + by), (51 + sway, 33), (57 + sway, 45)] + hem[::-1] + [(27, 50)]
    m = mask_of(lambda q: q.poly(cape_pts, '#000'))
    shade(t, m, CAPE, contrast=0.4)
    for x0 in (39, 45, 51):
        t.line(x0 + ln, 28 + by, x0 + sway + 2, G - 9, CAPE[1])
    for (x, y) in m:
        if (x + 1, y) not in m and y > 30:
            t.set(x, y, CAPE_IN[1])
    for x, y in hem[1::2]:
        t.set(x, y - 1, CAPE_IN[2])
    stamp(c, t)

    # ---- bras arrière : pend le long du flanc droit, poing fermé
    t = new()
    tube(t, [(43 + ln, 28 + by), (46 + ln, 33 + by), (46 + ln, 38 + by)], [3.4, 3.2, 3.0], ARF)
    stamp(c, t)
    t = new()
    gauntlet(t, 46 + ln, 40 + by, ARF)
    stamp(c, t)

    # ---- jambe arrière
    t = new()
    tube(t, [(38 + ln / 2, 42 + by), (40, 51), (41, G - 4)], [3.8, 3.6, 3.4], ARF)
    ball(t, 40, 50, 3.6, 3.2, ARF)
    spoly(t, [(36, G - 4), (45, G - 4), (46, GB), (34, GB)], ARF)
    stamp(c, t)

    # ---- traînée de l'attaque (derrière l'épée)
    sh = (21 + ln, 30 + by)          # épaule avant
    if atk:
        t = new()
        cx_, cy_ = sh[0] + 2, sh[1] + 2
        Rr = 22
        for y in range(-10, H + 4):
            for x in range(-10, W):
                ddx, ddy = x + 0.5 - cx_, y + 0.5 - cy_
                r = math.hypot(ddx, ddy)
                aa = math.degrees(math.atan2(ddy, ddx)) % 360
                if not 128 <= aa <= 268:
                    continue
                u = (268 - aa) / 140
                th = 1 + 8 * u ** 1.3
                if Rr - th <= r <= Rr + 0.5:
                    k = (Rr + 0.5 - r) / (th + 0.5)
                    if u < 0.3 and (x + y) % 2:
                        continue
                    t.set(x, y, TRAIL[3] if k < 0.3 else TRAIL[2] if k < 0.62 else TRAIL[1])
        stamp(c, t, TRAIL[0])

    # ---- épée + bras avant
    if atk:
        hands = (13, 41)
        ang = 132
    else:
        hands = (11, 41 + by)
        ang = -94
    # ---- jambe avant
    t = new()
    tube(t, [(27 + ln / 2, 42 + by), (25, 51), (24, G - 4)], [4.2, 4.0, 3.6], AR)
    ball(t, 25, 50, 4, 3.6, AR)
    _spike(t, (23, 50), (19, 48), 3, AR)
    spoly(t, [(18, G - 4), (28, G - 4), (29, GB), (16, GB)], AR)
    t.line(19, G - 4, 27, G - 4, AR[3])
    stamp(c, t)

    # ---- tassettes
    t = new()
    spoly(t, [(23 + ln, 37 + by), (43 + ln, 37 + by), (46 + ln, 46 + by), (38 + ln, 44 + by),
              (33 + ln, 47 + by), (28 + ln, 44 + by), (21 + ln, 46 + by)], AR)
    for x in range(23, 44):
        t.setf(x + ln, 38 + by, TGOLD[3] if x < 33 else TGOLD[1])
    t.line(33 + ln, 39 + by, 33 + ln, 46 + by, AR[0])
    stamp(c, t)
    # tabard rouge en lambeaux
    t = new()
    sw2 = (0, 1, -1)[f]
    tab = [(29 + ln, 39 + by), (37 + ln, 39 + by), (37 + ln + sw2, 50 + by), (35 + ln + sw2, 48 + by),
           (34 + ln + sw2, 53 + by), (32 + ln + sw2, 49 + by), (30 + ln + sw2, 51 + by)]
    spoly(t, tab, [CAPE_IN[0], CAPE_IN[0], CAPE_IN[1], CAPE_IN[2], PLUME[2]], contrast=0.4)
    t.line(30 + ln, 40 + by, 36 + ln, 40 + by, TGOLD[2])
    for (x, y) in ((33, 43), (33, 44), (32, 44), (34, 44), (33, 45)):
        t.set(x + ln, y + by, TGOLD[2])
    stamp(c, t)

    # ---- cuirasse bombée + rune de glace
    t = new()
    ox = ln
    spoly(t, [(23 + ox, 23 + by), (43 + ox, 23 + by), (42 + ox, 32 + by), (39 + ox, 39 + by), (27 + ox, 39 + by),
              (24 + ox, 32 + by)], AR, contrast=0.42)
    ball(t, 31 + ox, 29 + by, 7, 6.5, AR, only_inside=True)
    for y in range(29, 39):
        t.setf(33 + ox, y + by, AR[1])
    rx_, ry_ = 33 + ox, 30 + by
    for ddx, ddy, k in ((0, -3, 1), (0, -2, 2), (0, -1, 2), (0, 0, 2), (0, 1, 1), (-1, -1, 1), (1, -1, 1),
                        (-2, 0, 0), (2, 0, 0), (-1, 2, 0), (1, 2, 0)):
        t.set(rx_ + ddx, ry_ + ddy, RUNE[k])
    stamp(c, t)

    # ---- épaulière arrière
    t = new()
    ball(t, 42 + ln, 26 + by, 6, 5, ARF)
    _spike(t, (44 + ln, 22 + by), (49 + ln, 16 + by), 3.4, ARF)
    stamp(c, t)

    # ---- heaume
    hx, hy = (ln - 1, 2) if atk else (0, by)
    t = new()
    sw = (0, 2, 3)[f]
    plume_spine = [(35 + hx, 6 + hy), (41 + hx, 4 + hy), (48 + hx, 6 + hy + sw / 2), (52 + hx + sw / 2, 12 + hy + sw),
                   (54 + hx + sw, 19 + hy + sw)]

    def plume_shade(tt, ss, x, y):
        if ss < -0.5:
            return PLUME[4] if tt < 0.5 else PLUME[3]
        if ss > 0.45:
            return PLUME[0] if tt > 0.5 else PLUME[1]
        if abs(ss + 0.1 - 0.25 * math.sin(tt * 10)) < 0.18:
            return PLUME[3]
        return PLUME[2]
    spine_fill(t, plume_spine, [2.5, 4.0, 4.4, 3.4, 1.2], plume_shade)
    stamp(c, t)
    t = new()
    ball(t, 31 + hx, 13 + hy, 10, 9.5, AR)
    # visière avant (plaque en saillie, mentonnière en pointe)
    spoly(t, [(20 + hx, 9 + hy), (28 + hx, 8 + hy), (30 + hx, 21 + hy), (25 + hx, 24 + hy), (20 + hx, 20 + hy)], AR,
          contrast=0.3, bias=0.08)
    # crête dorée
    for k in range(9):
        a = math.radians(-150 + k * 15)
        t.setf(31 + hx + math.cos(a) * 9.5, 13 + hy + math.sin(a) * 9.1, TGOLD[3] if k < 4 else TGOLD[2])
    stamp(c, t)
    t = new()
    horn(t, [(26 + hx, 6 + hy), (23 + hx, 3 + hy), (22 + hx, 1 + hy)], [2.0, 1.4, 0.4], AR)
    stamp(c, t)
    # fente de la visière + yeux rouges brûlants
    vy = 13 + hy
    c.rect(20 + hx, vy, 11, 2, OUT)                 # fente en T
    c.rect(24 + hx, vy + 2, 2, 5, OUT)
    for ex in (21, 27):
        c.set(ex + hx, vy, REYE[2]); c.set(ex + 1 + hx, vy, REYE[1])
        c.set(ex + hx, vy + 1, REYE[1]); c.set(ex + 1 + hx, vy + 1, REYE[0])
    c.line(21 + hx, vy - 2, 28 + hx, vy - 2, AR[4])
    c.line(21 + hx, vy - 1, 29 + hx, vy - 1, AR[1])
    for k in range(2):
        c.set(22 + hx, vy + 4 + k * 2, OUT)
        c.set(27 + hx, vy + 4 + k * 2, OUT)
    # lueur des yeux qui fuit vers l'arrière
    for (x, y, col) in ((19 + hx, vy, REYE[1]), (18 + hx, vy - 1 + by, REYE[0])):
        if c.get(x, y) is None:
            c.set(x, y, col)

    # ---- bras avant (épaule -> poignée)
    t = new()
    el = (hands[0] + 4, (sh[1] + hands[1]) / 2 + 1) if not atk else (hands[0] + 5, hands[1] - 6)
    tube(t, [sh, el, (hands[0] + 1, hands[1])], [3.6, 3.3, 3.1], AR)
    stamp(c, t)
    # ---- épaulière avant (énorme, à pointes, bord doré)
    t = new()
    ball(t, 21 + ln, 27 + by, 7.5, 5.6, AR)
    t.line(14 + ln, 30 + by, 28 + ln, 31 + by, TGOLD[2])
    t.line(14 + ln, 31 + by, 28 + ln, 32 + by, AR[1])
    _spike(t, (17 + ln, 22 + by), (11 + ln, 17 + by), 3.6, AR)
    _spike(t, (21 + ln, 21 + by), (18 + ln, 15 + by), 3.2, AR)
    stamp(c, t)

    t = new()
    tip = greatsword(t, hands, ang, blade=(23 if atk else 27))
    stamp(c, t)
    # éclats runiques autour de la lame
    a_ = math.radians(ang)
    for k, u in enumerate((9, 16, 23)):
        px = hands[0] + math.cos(a_) * u + (4 if k % 2 else -4) * -math.sin(a_)
        py = hands[1] + math.sin(a_) * u + (4 if k % 2 else -4) * math.cos(a_) + (f == 1) * -1
        if c.get(px, py) is None:
            c.set(px, py, RUNE[2] if (k + f) % 2 else RUNE[1])

    t = new()
    gauntlet(t, hands[0], hands[1], AR)
    stamp(c, t)

    # ---- givre sur le dessus de la silhouette + glaçons
    frost(c, AR, skip=set(PLUME) | set(RUNE) | set(TRAIL) | set(REYE) | set(TGOLD) | set(CAPE) | set(CAPE_IN))
    icicles(c, ((16 + ln, 33 + by, 2), (19 + ln, 34 + by, 3), (24 + ln, 34 + by, 2), (42 + ln, 32 + by, 2)))
    glow_ring(c, '#22406e')
    pts = [((8, 12, True), (54, 30, False), (4, 30, False), (58, 22, True), (8, 52, False), (58, 56, True)),
           ((9, 9, False), (55, 27, True), (4, 33, True), (59, 19, False), (7, 48, True), (59, 52, False)),
           ((50, 40, False), (58, 24, True), (44, 3, True), (60, 48, False), (36, 56, True), (4, 4, False))][f]
    snow(c, pts)
    return c, (W, H)



# ================================================================ ROI DÉMONIAQUE (monde 6)

XW, XH = 72, 72
XG = 69
DSKIN = ['#14081a', '#2c0e34', '#4c1a54', '#7a2e78', '#ac5aa2']        # peau pourpre / noire
DARM = ['#0c0810', '#1c1324', '#30223a', '#4a3856', '#72587e']        # armure noire
DCAPE = ['#1a040c', '#3a0818', '#5e1024', '#8a1c30', '#b83444']
DHORN = ['#1a1418', '#3e3038', '#6e5c62', '#ac9a94', '#ece0d4']
HELL = ['#3a0a6a', '#7a1ad0', '#b45aff', '#e4b0ff', '#fff0ff']       # flammes infernales violettes
DEYE = ['#c02aff', '#ff9aff', '#ffffff']
BONE = ['#4c4258', '#8e8478', '#c4b99e', '#e6dfc6', '#fcf9ec']
SCY = ['#140c1c', '#2e2440', '#5a4c74', '#9a8cba', '#e6e0ff']        # lame de la faux


def hellfire(L, pts, phase):
    for k, (x, base, wd, hh) in enumerate(pts):
        flame_tongue(L, x, base, wd, hh, 0.8 if k % 2 else -0.8, phase + k * 1.9, HELL)


def scythe(L, hand, ang, shaft_up=34, below=12, Lb=17):
    """Faux : manche (ang = direction vers le haut du manche), lame en croissant qui retombe du côté gauche."""
    a = math.radians(ang)
    dx, dy = math.cos(a), math.sin(a)
    nx, ny = dy, -dx                                   # côté de la lame
    top = (hand[0] + dx * shaft_up, hand[1] + dy * shaft_up)
    bot = (hand[0] - dx * below, hand[1] - dy * below)
    L.line(bot[0], bot[1], top[0], top[1], DARM[2], width=2.4)
    L.line(bot[0] + nx * 0.6, bot[1] + ny * 0.6, top[0] + nx * 0.6, top[1] + ny * 0.6, DARM[4])
    for u in (0.25, 0.6):
        px, py = bot[0] + (top[0] - bot[0]) * u, bot[1] + (top[1] - bot[1]) * u
        L.ellipse(px, py, 1.5, 1.5, GOLD[2]); L.set(px - 0.5, py - 0.5, GOLD[4])
    ball(L, bot[0], bot[1], 1.8, 1.8, GOLD)
    # lame : bord extérieur en arc, tranchant intérieur, pointe vers le bas
    outer, inner = [], []
    for i in range(15):
        u = i / 14
        along_ = 3 + 4 * u - 17 * u * u
        side = Lb * u
        ox_, oy_ = top[0] + nx * side + dx * along_, top[1] + ny * side + dy * along_
        th = 7.0 * (1 - u) ** 0.85 + 0.4
        outer.append((ox_, oy_))
        inner.append((ox_ - dx * th + nx * th * 0.15 * u, oy_ - dy * th + ny * th * 0.15 * u))
    pts = outer + inner[::-1]
    m = mask_of(lambda t: t.poly(pts, '#000'))
    shade(L, m, SCY, contrast=0.3)
    for (x0, y0), (x1, y1) in zip(outer, outer[1:]):
        L.line(x0, y0, x1, y1, SCY[4])
    for (x0, y0), (x1, y1) in zip(inner[1:], inner[2:]):
        L.line(x0, y0, x1, y1, HELL[3])
    for i in (3, 7):
        mx, my = (outer[i][0] + inner[i][0]) / 2, (outer[i][1] + inner[i][1]) / 2
        L.set(mx, my, HELL[2]); L.set(mx + nx, my + ny, HELL[1])
    # douille dorée + pointe arrière
    spoly(L, [(top[0] - nx * 1.5, top[1] - ny * 1.5), (top[0] - nx * 6 - dx * 2, top[1] - ny * 6 - dy * 2),
              (top[0] - nx * 1 + dx * 2, top[1] - ny * 1 + dy * 2)], SCY, contrast=0.5)
    ball(L, top[0], top[1], 2.4, 2.4, GOLD)
    L.set(top[0], top[1], HELL[2])
    return outer, inner, top


def flame_cluster(L, cx, base, wd, hgt, phase, F):
    """Foyer de flammes : une langue centrale et deux latérales plus courtes."""
    flame_tongue(L, cx - wd * 0.7, base, wd * 0.7, hgt * 0.6, -1.5, phase + 1.1, F)
    flame_tongue(L, cx + wd * 0.7, base, wd * 0.7, hgt * 0.7, 1.5, phase + 2.3, F)
    flame_tongue(L, cx, base, wd, hgt, math.sin(phase) * 1.5, phase, F)




def demon_king(f):
    W, H = XW, XH
    new = lambda: Layer(W, H)
    c = new()
    atk = f == 2
    by = 1 if f == 1 else 0
    G, GB = XG, XG + 1
    ln = -2 if atk else 0


    # ---- cape déchirée
    t = new()
    sway = (0, 2, -1)[f]
    hem = []
    for i, x in enumerate(range(30, 67, 3)):
        hem.append((x + sway * i / 12, G - 1 + (2 if i % 2 else -3) - max(0, i - 8) * 2.2 + (f == 1) * (i % 3 == 0) * 2))
    cape_pts = [(31 + ln, 30 + by), (50 + ln, 29 + by), (58 + sway, 40), (66 + sway, 52)] + hem[::-1] + [(28, 54)]
    m = mask_of(lambda q: q.poly(cape_pts, '#000'))
    shade(t, m, DCAPE, contrast=0.42)
    for x0 in (42, 49, 56):
        t.line(x0 + ln, 34 + by, x0 + sway + 3, G - 8, DCAPE[1])
    stamp(c, t)

    # ---- bras arrière : main griffue, flamme infernale dans la paume
    t = new()
    tube(t, [(51 + ln, 35 + by), (56 + ln, 41 + by), (58 + ln, 46 + by)], [3.8, 3.4, 3.0], dk_(DSKIN))
    ball(t, 58 + ln, 47 + by, 3.4, 3, dk_(DSKIN))
    for k in range(3):
        t.set(56 + ln + k * 2, 44 + by, DHORN[3])
    stamp(c, t)
    t = new()
    flame_cluster(t, 58 + ln, 44 + by, 3.4, 12 + (f == 1) * 2, f * 2.0 + 0.7, HELL)
    stamp(c, t, HELL[0])

    # ---- jambes
    t = new()
    tube(t, [(44 + ln / 2, 51 + by), (46, 58), (47, G - 4)], [4.2, 3.8, 3.4], DARM[:4])
    ball(t, 46, 57, 3.8, 3.4, DARM[:4])
    spoly(t, [(42, G - 4), (51, G - 4), (52, GB), (40, GB)], DARM[:4])
    stamp(c, t)
    t = new()
    tube(t, [(32 + ln / 2, 51 + by), (30, 58), (29, G - 4)], [4.6, 4.2, 3.8], DARM)
    ball(t, 30, 57, 4.2, 3.8, DARM)
    _spike(t, (28, 56), (23, 54), 3.4, DHORN)
    spoly(t, [(23, G - 4), (34, G - 4), (35, GB), (21, GB)], DARM)
    t.line(23, G - 4, 33, G - 4, GOLD[2])
    for x in (22, 25, 28):
        t.set(x, G + 1, DHORN[3]); t.set(x - 1, G + 1, DHORN[2])
    stamp(c, t)

    # ---- tassettes + ceinture à crâne
    t = new()
    spoly(t, [(27 + ln, 48 + by), (51 + ln, 48 + by), (54 + ln, 57 + by), (46 + ln, 55 + by), (39 + ln, 59 + by),
              (32 + ln, 55 + by), (25 + ln, 57 + by)], DARM)
    for x in range(26, 53):
        t.setf(x + ln, 48 + by, GOLD[3] if x < 38 else GOLD[2])
        t.setf(x + ln, 49 + by, GOLD[1])
    t.line(39 + ln, 51 + by, 39 + ln, 58 + by, DARM[0])
    stamp(c, t)
    t = new()
    ball(t, 39 + ln, 50 + by, 3.2, 2.8, BONE)
    t.set(38 + ln, 50 + by, HELL[2]); t.set(40 + ln, 50 + by, HELL[2])
    t.line(38 + ln, 52 + by, 40 + ln, 52 + by, BONE[0])
    stamp(c, t)

    # ---- torse : cuirasse noire bordée d'or, gemme infernale
    t = new()
    ox = ln
    spoly(t, [(28 + ox, 31 + by), (51 + ox, 31 + by), (50 + ox, 41 + by), (46 + ox, 48 + by), (32 + ox, 48 + by),
              (29 + ox, 41 + by)], DARM, contrast=0.42)
    ball(t, 37 + ox, 38 + by, 8, 7, DARM, only_inside=True)
    for k in range(2):
        t.line(31 + ox, 38 + by + k * 4, 39 + ox, 42 + by + k * 4, GOLD[2] if k == 0 else DARM[1])
        t.line(39 + ox, 42 + by + k * 4, 48 + ox, 38 + by + k * 4, GOLD[1] if k == 0 else DARM[1])
    ball(t, 39 + ox, 38 + by, 2.6, 2.6, HELL)
    t.set(38 + ox, 37 + by, HELL[4])
    stamp(c, t)

    # ---- épaulière arrière
    t = new()
    ball(t, 51 + ln, 33 + by, 7, 5.5, dk_(DARM))
    _spike(t, (52 + ln, 29 + by), (57 + ln, 21 + by), 3.6, dk_(DHORN))
    stamp(c, t)

    # ---- tête (grosse, chibi)
    hx, hy = (ln - 1, 2) if atk else (0, by)
    hcx, hcy = 38 + hx, 20 + hy
    t = new()
    horn(t, [(hcx + 5, hcy - 6), (hcx + 11, hcy - 9), (hcx + 15, hcy - 14), (hcx + 15, hcy - 19)],
         [3.0, 2.6, 1.8, 0.5], dk_(DHORN, -0.08))
    stamp(c, t)
    t = new()
    # cou
    spoly(t, [(33 + hx, hcy + 6), (44 + hx, hcy + 6), (43 + hx, 33 + by), (34 + hx, 33 + by)], dk_(DSKIN))
    stamp(c, t)
    t = new()
    ball(t, hcx, hcy, 11, 10, DSKIN)
    # mâchoire en pointe + barbiche noire
    spoly(t, [(hcx - 10, hcy + 2), (hcx + 6, hcy + 4), (hcx + 2, hcy + 10), (hcx - 4, hcy + 12), (hcx - 9, hcy + 8)],
          DSKIN, contrast=0.3)
    spoly(t, [(hcx - 7, hcy + 10), (hcx - 1, hcy + 11), (hcx - 6, hcy + 16)], DARM, contrast=0.4)
    stamp(c, t)
    # oreille pointue
    t = new()
    spoly(t, [(hcx + 6, hcy), (hcx + 15, hcy - 1), (hcx + 8, hcy + 5)], DSKIN, contrast=0.45)
    stamp(c, t)
    # visage
    ey = hcy - 1
    for ex in (hcx - 9, hcx - 2):
        c.rect(ex, ey, 5, 3, DEYE[1])
        c.rect(ex + 1, ey, 3, 1, DEYE[2])
        c.set(ex + 1, ey + 1, DEYE[2])
        c.set(ex + 4, ey + 2, DEYE[0]); c.set(ex + 3, ey + 2, DEYE[0])
    # sourcils en V, lourds
    c.line(hcx - 10, ey - 3, hcx - 4, ey - 1, OUT)
    c.line(hcx - 10, ey - 2, hcx - 5, ey, OUT)
    c.line(hcx - 3, ey - 1, hcx + 3, ey - 3, OUT)
    c.line(hcx - 3, ey, hcx + 3, ey - 2, OUT)
    c.set(hcx - 10, ey - 1, OUT); c.set(hcx - 10, ey, OUT)
    c.line(hcx - 4, ey, hcx - 4, ey + 3, DSKIN[1])
    for (x, y) in ((hcx - 11, ey + 1), (hcx - 12, ey), (hcx - 13, ey - 1)):
        if c.get(x, y) is None:
            c.set(x, y, DEYE[0])
    # bouche : rictus à crocs
    my = hcy + 6
    if atk:
        c.rect(hcx - 8, my - 1, 9, 4, OUT)
        c.line(hcx - 7, my + 1, hcx - 1, my + 1, HELL[2])
        c.line(hcx - 6, my + 2, hcx - 2, my + 2, HELL[1])
        for x in (hcx - 7, hcx - 1):
            c.set(x, my - 1, WHITE); c.set(x, my, WHITE)
        c.set(hcx - 4, my + 2, WHITE)
    else:
        c.line(hcx - 8, my, hcx, my + 1, OUT)
        c.line(hcx - 8, my - 1, hcx - 8, my, OUT)
        for x in (hcx - 7, hcx - 2):
            c.set(x, my + 1, WHITE); c.set(x, my + 2, WHITE)
    # couronne d'or à pointes (gemmes violettes)
    t = new()
    cx0, cy0 = hcx - 8, hcy - 14
    spoly(t, [(cx0, cy0 + 5), (cx0 + 15, cy0 + 4), (cx0 + 15, cy0 + 8), (cx0 + 1, cy0 + 8.5)], GOLD, contrast=0.4)
    for k, (px, hh) in enumerate(((cx0 + 1, 4), (cx0 + 5, 6), (cx0 + 9.5, 7), (cx0 + 14, 5))):
        spoly(t, [(px - 1.6, cy0 + 5), (px + 0.2, cy0 + 5 - hh), (px + 1.8, cy0 + 5)], GOLD, contrast=0.6)
        t.set(px + 0.2, cy0 + 5 - hh + 0.5, GOLD[4])
    for gx in (cx0 + 3, cx0 + 8, cx0 + 12):
        t.set(gx, cy0 + 6, HELL[2]); t.set(gx, cy0 + 7, HELL[1])
    t.set(cx0 + 8, cy0 + 6, HELL[3])
    stamp(c, t)
    # corne proche : énorme, part en avant puis se redresse
    t = new()
    horn(t, [(hcx - 5, hcy - 7), (hcx - 11, hcy - 9), (hcx - 16, hcy - 12), (hcx - 18, hcy - 17), (hcx - 16, hcy - 20)],
         [3.6, 3.2, 2.5, 1.4, 0.4], DHORN, ring=GOLD, ring_at=(0.2,))
    stamp(c, t)

    # ---- traînée violette de l'attaque
    sh = (29 + ln, 36 + by)
    if atk:
        t = new()
        cx_, cy_ = 26, 38
        Rr = 26
        for y in range(-10, H + 4):
            for x in range(-10, W):
                ddx, ddy = x + 0.5 - cx_, y + 0.5 - cy_
                r = math.hypot(ddx, ddy)
                aa = math.degrees(math.atan2(ddy, ddx)) % 360
                if not 118 <= aa <= 262:
                    continue
                u = (262 - aa) / 144
                th = 1 + 9 * u ** 1.3
                if Rr - th <= r <= Rr + 0.5:
                    k = (Rr + 0.5 - r) / (th + 0.5)
                    if u < 0.3 and (x + y) % 2:
                        continue
                    t.set(x, y, HELL[4] if k < 0.25 else HELL[3] if k < 0.55 else HELL[2])
        stamp(c, t, HELL[0])

    # ---- faux + bras avant
    if atk:
        hand = (18, 42)
        ang = 196                      # manche couché vers l'avant : la lame plonge vers le sol
    else:
        hand = (18, 46 + by)
        ang = -94
    t = new()
    if atk:
        outer, inner, top = scythe(t, hand, ang, shaft_up=20, below=10, Lb=16)
    else:
        outer, inner, top = scythe(t, hand, ang, shaft_up=33, below=16, Lb=18)
    stamp(c, t)
    # flammes violettes léchant la lame
    t = new()
    for i, k in (((5, 0),) if not atk else ((3, 0), (7, 1), (11, 2))):
        x, y = outer[i]
        flame_tongue(t, x, y + 1, 1.5, 4 + (k + f) % 3, 0.8, f * 1.3 + k, HELL)
    stamp(c, t, HELL[0])
    t = new()
    el = ((sh[0] + hand[0]) / 2 - 1, (sh[1] + hand[1]) / 2 + 2) if not atk else (24, 44)
    tube(t, [sh, el, (hand[0] + 1, hand[1])], [3.8, 3.4, 3.2], DSKIN)
    bx_, by_ = hand[0] + (el[0] - hand[0]) * 0.45, hand[1] + (el[1] - hand[1]) * 0.45
    t.ellipse(bx_, by_, 2.6, 2.6, GOLD[2], only_inside=True)
    t.ellipse(bx_ - 0.6, by_ - 0.6, 1.4, 1.4, GOLD[3], only_inside=True)
    stamp(c, t)
    t = new()
    ball(t, hand[0], hand[1], 3.4, 3, DSKIN)
    t.set(hand[0] - 2, hand[1] - 1, DSKIN[4])
    t.set(hand[0] - 3, hand[1] + 1, DHORN[3])
    stamp(c, t)

    # ---- épaulière avant (énorme, trois pointes)
    t = new()
    ball(t, 29 + ln, 33 + by, 8.5, 6.2, DARM)
    t.line(21 + ln, 36 + by, 37 + ln, 37 + by, GOLD[2])
    t.line(21 + ln, 37 + by, 37 + ln, 38 + by, DARM[1])
    for (bx_, b_), (tx, ty) in (((23, 31), (16, 27)), ((27, 29), (23, 21)), ((32, 29), (33, 22))):
        _spike(t, (bx_ + ln, b_ + by), (tx + ln, ty + by), 3.8, DHORN)
    ball(t, 26 + ln, 33 + by, 1.6, 1.6, HELL)
    stamp(c, t)

    # ---- flammes infernales au sol (devant)
    t = new()
    for k, x in enumerate((16, 38, 56)):
        flame_cluster(t, x, G + 1, 2.6, 7 + ((k + f) % 3) * 2, f * 1.7 + k * 2.4, HELL)
    stamp(c, t, HELL[0])
    glow_ring(c, '#3e1660')
    pts = [((8, 30), (64, 20), (68, 36), (4, 52), (60, 8)), ((9, 27), (65, 17), (69, 33), (5, 49), (58, 5)),
           ((62, 14), (67, 30), (46, 2), (8, 6), (69, 44))][f]
    for x, y in pts:
        if c.get(x, y) is None:
            c.set(x, y, HELL[3])
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                if c.get(x + dx, y + dy) is None and (x + y) % 2:
                    c.set(x + dx, y + dy, HELL[1])
    return shifted(c, 2), (W, H)


def dk_(R, d=None):
    """Version plan arrière d'une rampe : décale d'un cran vers le sombre (aucune couleur nouvelle)."""
    return [R[0]] + list(R[:-1])


# ================================================================ export

def _check_and_crop(res):
    c, (w, h) = res
    return finalize(c, w, h), clipped(c, w, h)


def frames(fn):
    return [_check_and_crop(fn(f)) for f in (0, 1, 2)]


BOSSES = {
    'boss_ash_dragon': dragon,
    'boss_fallen_knight': fallen_knight,
    'boss_demon_king': demon_king,
}


def build():
    out = {}
    for name, fn in BOSSES.items():
        a, b, k = [cv for cv, _ in frames(fn)]
        out[name] = (a, {})
        out[name + '_b'] = (b, {})
        out[name + '_atk'] = (k, {})
    return out
