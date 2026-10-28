"""Boss des donjons (un boss unique par donjon, en remplacement des méga boss de campagne réutilisés).

  boss_crypt_archlich    Archiliche de la crypte   (donjon « Crypte spectrale », flotte au-dessus d'un brasier spectral)
  boss_rotting_dryad     Dryade pourrissante       (donjon « Sanctuaire sylvestre »)
  boss_magma_colossus    Colosse de magma          (donjon « Fournaise des sables »)
  boss_frost_wyrm        Wyrm de givre             (donjon « Glacier éternel »)
  boss_obsidian_tyrant   Tyran d'obsidienne        (donjon « Citadelle des ombres »)

Chaque boss : <nom> (repos), <nom>_b (marche / flottement / respiration), <nom>_atk (attaque),
trois images sur exactement le même canvas (frames_boxed : agrandi symétriquement en largeur et vers le haut,
pieds / base sur la dernière ligne). Tournés vers la GAUCHE, lumière en haut à gauche, contour '#1a1226',
rampes de 5 tons, aucun aléa. Gabarit des méga boss (≈ 64-80 px de large, 66-74 px de haut).
"""
import math

from knight import spine_fill
from bosses_hard import (Layer, stamp, mask_of, shade, spoly, ball, tube, horn, flame_tongue, glow_ring, sparkle,
                         ice_shard, frames_boxed, ICE)
from bosses_mega import shifted, _spike, flame_cluster, breath
from bosses_w78 import put_behind, mushroom, drip
from minibosses import reduce_colors

OUT = '#1a1226'
WHITE = '#ffffff'
MAX_COLORS = 58


# ---------------------------------------------------------------- outils communs

def ring_arc(c, cx, cy, R, sy, a0, a1, th_max, F, dither=0.3, outline=None):
    """Croissant d'attaque : de a0 (traînée fine, pointillée) à a1 (tête épaisse), degrés, y vers le bas.
    F : 4 tons (contour, sombre, clair, blanc)."""
    t = Layer(c.lw, c.lh)
    span = a1 - a0
    sg = 1 if span > 0 else -1
    for y in range(int(cy - R * sy - 3), int(cy + R * sy + 4)):
        for x in range(int(cx - R - 3), int(cx + R + 4)):
            dx = x + 0.5 - cx
            dy = (y + 0.5 - cy) / sy
            r = math.hypot(dx, dy)
            a = math.degrees(math.atan2(dy, dx))
            u = ((a - a0) * sg) % 360 / abs(span)
            if not 0 <= u <= 1:
                continue
            th = 1 + th_max * u ** 1.3
            if not (R - th <= r <= R + 0.5):
                continue
            k = (R + 0.5 - r) / (th + 0.5)
            if u < dither and (x + y) % 2:
                continue
            t.set(x, y, F[3] if k < 0.18 else F[2] if k < 0.5 else F[1])
    t.outline(outline or F[0])
    return t


def specks(c, pts, R):
    """Particules en croix (n'écrasent pas la silhouette) : (x, y, gros?)."""
    for x, y, big in pts:
        if c.get(x, y) is None:
            c.set(x, y, R[-1] if big else R[-2])
            if big:
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    if c.get(x + dx, y + dy) is None:
                        c.set(x + dx, y + dy, R[-3])


def tongue(c, x0, y0, ang, length, wd, F, phase=0.0, wob=0.8):
    """Langue d'énergie (flamme, jet, souffle) partant de (x0, y0) dans la direction ang (degrés) :
    large à la base, effilée au bout, cœur clair -> bords sombres (F : 5 tons)."""
    a = math.radians(ang)
    ux, uy = math.cos(a), math.sin(a)
    for y in range(int(y0 - length - wd - 2), int(y0 + length + wd + 3)):
        for x in range(int(x0 - length - wd - 2), int(x0 + length + wd + 3)):
            px, py = x + 0.5 - x0, y + 0.5 - y0
            al = px * ux + py * uy
            if al < 0 or al > length:
                continue
            u = al / length
            pe = -px * uy + py * ux - math.sin(u * 6 + phase) * wob * u
            half = wd * (1 - u) ** 1.1 * min(1.0, 0.6 + u * 4)
            d = abs(pe) / max(half, 0.01)
            if d > 1:
                continue
            k = 4 - int(d * 2.2 + u * 2.4)
            c.set(x, y, F[max(0, min(4, k))])


def tatter_hem(x0, x1, y, n, depth, phase=0, slope=0.0):
    """Points d'un ourlet en lambeaux de x1 vers x0 (pour fermer un polygone de droite à gauche)."""
    pts = []
    for i in range(n + 1):
        u = i / n
        x = x1 + (x0 - x1) * u
        down = depth * (0.55 + 0.45 * math.sin(i * 2.1 + phase)) if i % 2 == 0 else 0
        pts.append((x, y + down + slope * (x - x0)))
    return pts


# ================================================================ 1. ARCHILICHE DE LA CRYPTE

LW, LH = 64, 70
LROBE = ['#0a0712', '#160f22', '#241834', '#36244c', '#4e3468']      # robe noire / violette
LTRIM = ['#2a0c44', '#4e1a7a', '#7a34b0', '#ae6ae0', '#dcb0ff']      # galons violets
LBONE = ['#3c3c4c', '#76787a', '#aeb2a2', '#d8dcc6', '#f6f8ea']      # os froid
SPEC = ['#08303e', '#0e6a7a', '#22b8c4', '#7af0e8', '#e4fffb']       # flammes spectrales cyan
LGOLD = ['#3a2410', '#6e4a1c', '#a87c34', '#dcb862', '#fff0b4']      # cage de la phylactère (or terni)

# by : flottement (négatif = monte), lean, staff : main + angle (degrés, vers le haut du bâton)
LPOSE = (
    dict(by=0, ln=0, wave=0, hand=(15, 41), ang=-92, phy=0),
    dict(by=-2, ln=0, wave=1, hand=(15, 40), ang=-95, phy=-2),
    dict(by=-1, ln=-2, wave=0, hand=(13, 23), ang=-124, phy=1),
)


def _lich_staff(t, hand, ang, up, down):
    """Bâton d'os vertébré, griffe au sommet. Renvoie le centre de la griffe."""
    a = math.radians(ang)
    dx, dy = math.cos(a), math.sin(a)
    top = (hand[0] + dx * up, hand[1] + dy * up)
    bot = (hand[0] - dx * down, hand[1] - dy * down)
    tube(t, [bot, top], [1.6, 1.6], LBONE[:4], contrast=0.5)
    n = int(up + down)
    for k in range(2, n - 1, 3):
        px, py = bot[0] + dx * k, bot[1] + dy * k
        t.setf(px, py, LBONE[0])
        t.setf(px - dy * 1.2, py + dx * 1.2, LBONE[1])
    # griffe : trois doigts d'os recourbés autour de l'orbe
    cx, cy = top[0] + dx * 4, top[1] + dy * 4
    nx, ny = -dy, dx
    for s in (-1, 1):
        horn(t, [(top[0] + nx * s * 1.2, top[1] + ny * s * 1.2), (cx + nx * s * 4.2 - dx, cy + ny * s * 4.2 - dy),
                 (cx + nx * s * 3.2 + dx * 3, cy + ny * s * 3.2 + dy * 3), (cx + nx * s * 0.8 + dx * 4.5,
                                                                         cy + ny * s * 0.8 + dy * 4.5)],
             [1.5, 1.3, 0.9, 0.3], LBONE)
    ball(t, top[0], top[1], 2.2, 2.0, LBONE)
    return (cx, cy), (dx, dy)


def crypt_archlich(f):
    W, H = LW, LH
    G = H - 2
    new = lambda: Layer(W, H)
    c = new()
    P = LPOSE[f]
    atk = f == 2
    by, ln = P['by'], P['ln']
    wv = P['wave']

    # ---- brasier spectral sous la robe (la liche flotte au-dessus)
    fire = new()
    t = new()
    for k, (x, hh) in enumerate(((17, 8), (27, 12), (38, 14), (49, 9))):
        h_ = hh + ((0, 3, -2)[(k + f) % 3])
        flame_cluster(t, x, G + 1, 2.4, h_, f * 1.9 + k * 2.2, SPEC)
    stamp(fire, t, SPEC[0])

    # ---- traîne arrière : large, évasée, en lambeaux
    t = new()
    hem = tatter_hem(9 + ln, 58 + wv, 58 + by, 12, 7, phase=wv * 1.7)
    pts = [(24 + ln, 25 + by), (46 + ln, 25 + by), (53 + wv, 40 + by), (58 + wv, 52 + by)] + hem + [(12 + ln, 50 + by)]
    m = mask_of(lambda q: q.poly(pts, '#000'))
    shade(t, m, [LROBE[0]] + LROBE[:4], contrast=0.42)
    for k, x0 in enumerate((14, 21, 47, 53)):
        t.line(x0 + ln + 1, 44 + by, x0 + ln - 1 + wv, 60 + by, LROBE[0])
    for (x, y) in m:
        if (x, y + 1) not in m:
            t.set(x, y, LTRIM[1] if (x + y) % 3 else LTRIM[2])
    stamp(c, t)

    # ---- bras arrière : manche + main squelettique ouverte sous la phylactère
    hand2 = (54 + ln, 36 + by)
    t = new()
    tube(t, [(44 + ln, 29 + by), (50 + ln, 35 + by), (52 + ln, 38 + by)], [3.4, 4.0, 4.6],
         [LROBE[0]] + LROBE[:4], contrast=0.4)
    stamp(c, t)
    t = new()
    for k, (fx, fy) in enumerate(((-3, -4), (-1, -6), (1, -6), (3, -4))):
        t.line(hand2[0], hand2[1], hand2[0] + fx, hand2[1] + fy, LBONE[2 if k < 2 else 1])
        t.set(hand2[0] + fx, hand2[1] + fy, LBONE[4 if k < 2 else 3])
    ball(t, hand2[0], hand2[1], 2.2, 1.7, LBONE)
    stamp(c, t)

    # ---- robe avant : buste ajusté, jupe évasée en lambeaux, ouverte sur la cage thoracique
    t = new()
    hem2 = tatter_hem(13 + ln, 51 + ln + wv, 58 + by, 9, 6, phase=1.3 + wv * 2.1)
    body = [(23 + ln, 25 + by), (45 + ln, 25 + by), (46 + ln, 36 + by), (44 + ln, 45 + by), (51 + ln + wv, 58 + by)] + \
        hem2[1:] + [(23 + ln, 45 + by), (21 + ln, 36 + by)]
    mb = mask_of(lambda q: q.poly(body, '#000'))
    shade(t, mb, LROBE, contrast=0.48)
    # plis de la jupe
    for k, (x0, x1) in enumerate(((27, 20), (31, 27), (38, 40), (42, 47))):
        t.line(x0 + ln, 47 + by, x1 + ln + wv * (k % 2), 58 + by, LROBE[1])
        if k < 2:
            t.line(x0 + ln + 1, 48 + by, x1 + ln + 1 + wv * (k % 2), 57 + by, LROBE[4])
    # ourlet violet
    for (x, y) in mb:
        if (x, y + 1) not in mb and y > 46 + by:
            t.set(x, y, LTRIM[3] if (x + y) % 4 else LTRIM[4])
            if (x, y - 1) in mb:
                t.set(x, y - 1, LTRIM[1])
    # ouverture en V : côtes dans l'ombre, cœur spectral
    vx = 34 + ln
    t.poly([(vx - 5, 25 + by), (vx + 5, 25 + by), (vx + 1.5, 43 + by), (vx - 1.5, 43 + by)], LROBE[0], only_inside=True)
    for k in range(4):
        yy = 28 + by + k * 3
        half = 4.0 - k * 0.7
        t.line(vx - half, yy + 1, vx - 0.5, yy, LBONE[3] if k < 2 else LBONE[2])
        t.line(vx + 0.5, yy, vx + half, yy + 1, LBONE[2] if k < 2 else LBONE[1])
    for y in range(27, 43):
        t.setf(vx, y + by, LBONE[1] if y % 2 else LBONE[2])
    t.set(vx - 2, 33 + by, SPEC[2]); t.set(vx + 2, 33 + by, SPEC[1]); t.set(vx - 1, 34 + by, SPEC[3])
    t.line(vx - 6, 25 + by, vx - 2, 44 + by, LTRIM[3])
    t.line(vx + 6, 25 + by, vx + 2, 44 + by, LTRIM[1])
    # ceinture fine + breloques d'os
    t.line(23 + ln, 44 + by, 44 + ln, 44 + by, LTRIM[2])
    t.line(23 + ln, 45 + by, 44 + ln, 45 + by, LTRIM[0])
    stamp(c, t)
    t = new()
    for k, (x, n) in enumerate(((28, 5), (34, 7), (40, 4))):
        for j in range(n):
            t.set(x + ln, 46 + by + j, LBONE[2] if j % 2 else LBONE[3])
        ball(t, x + ln, 46 + by + n + 1, 1.4, 1.4, LBONE if k != 1 else SPEC)
    stamp(c, t)

    # ---- haut col violet en pointes (derrière la tête)
    t = new()
    hx, hy = (ln - 1, by + 1) if atk else (ln, by)
    col = [(22 + hx, 28 + hy), (17 + hx, 13 + hy), (23 + hx, 18 + hy), (25 + hx, 7 + hy), (31 + hx, 14 + hy),
           (36 + hx, 4 + hy), (40 + hx, 13 + hy), (45 + hx, 5 + hy), (46 + hx, 16 + hy), (52 + hx, 12 + hy),
           (48 + hx, 28 + hy)]
    spoly(t, col, LTRIM, contrast=0.5, bias=-0.06)
    for k, (x0, y0) in enumerate(((25, 9), (36, 6), (45, 7))):
        t.line(x0 + hx, y0 + hy + 2, x0 + hx + 1 + k * 0.5, y0 + hy + 12, LTRIM[1])
    stamp(c, t)

    # ---- épaulière arrière (crâne d'os)
    t = new()
    ball(t, 45 + ln, 27 + by, 5.0, 4.0, [LROBE[0], LROBE[2], LTRIM[0], LTRIM[1], LTRIM[2]])
    _spike(t, (46 + ln, 24 + by), (51 + ln, 18 + by), 3.0, [LBONE[0]] + LBONE[:4])
    stamp(c, t)

    # ---- crâne (trois quarts gauche)
    sx, sy = 32 + hx, 16 + hy
    jaw = 2 if atk else 0
    t = new()
    ball(t, sx + 1, sy - 1, 7.6, 7.0, LBONE, cuts=(0.05, 0.42, 0.74, 0.95))
    spoly(t, [(sx - 8, sy + 1), (sx + 3, sy + 2), (sx + 2, sy + 6 + jaw), (sx - 1, sy + 9 + jaw), (sx - 6, sy + 9 + jaw),
              (sx - 8, sy + 5)], LBONE, contrast=0.42, bias=-0.1)
    stamp(c, t)
    # orbites profondes + lueur
    for ex in (sx - 7, sx - 1):
        c.line(ex, sy - 2, ex + 3, sy - 2, LBONE[1])
        c.rect(ex, sy - 1, 4, 4, OUT)
        c.set(ex + 3, sy + 2, LBONE[1])
        c.line(ex, sy + 3, ex + 3, sy + 3, LBONE[1])
    for ex in (sx - 6, sx):
        c.set(ex + 1, sy, SPEC[4] if atk else SPEC[3]); c.set(ex + 1, sy + 1, SPEC[2]); c.set(ex, sy + 1, SPEC[1])
    c.set(sx - 3, sy - 2, LBONE[1])                                   # arcade sourcilière (ombre centrale)
    c.set(sx - 3, sy + 3, OUT); c.set(sx - 4, sy + 4, OUT); c.set(sx - 3, sy + 4, OUT)   # nez
    c.line(sx + 1, sy + 3, sx + 3, sy + 3, LBONE[1])                  # pommette
    my = sy + 6
    c.line(sx - 7, my, sx + 1, my, OUT)
    for x in range(sx - 6, sx + 2, 2):
        c.set(x, my - 1, LBONE[4]); c.set(x, my + 1 + jaw, LBONE[3])
    if atk:
        c.rect(sx - 6, my + 1, 7, jaw, OUT)
        c.set(sx - 4, my + 2, SPEC[3]); c.set(sx - 2, my + 1, SPEC[2])
    c.line(sx + 5, sy - 6, sx + 3, sy - 2, LBONE[1])                  # fissure
    trail = [(sx - 8, sy), (sx - 9, sy - 1)]
    if f:
        trail += [(sx - 10, sy - 1 - f % 2), (sx - 11, sy - 2)]
    for (x, y) in trail:
        if c.get(x, y) is None:
            c.set(x, y, SPEC[2] if x > sx - 10 else SPEC[1])

    # ---- couronne d'os jaunie : bandeau + pointes irrégulières, gemmes spectrales
    CB = [LGOLD[1], LBONE[1], LBONE[2], LBONE[3], LBONE[4]]
    t = new()
    cy0 = sy - 8
    spoly(t, [(sx - 7, cy0 + 2), (sx + 8, cy0), (sx + 8, cy0 + 3), (sx - 7, cy0 + 5)], CB, contrast=0.5)
    for k, (px, hh, lean) in enumerate(((sx - 6, 5, -1.2), (sx - 2.5, 8, -0.6), (sx + 1, 6, 0.2), (sx + 4, 9, 0.8),
                                        (sx + 7, 5, 1.6))):
        horn(t, [(px, cy0 + 2), (px + lean * 0.5, cy0 + 1 - hh * 0.55), (px + lean, cy0 + 1 - hh)],
             [1.4, 1.0, 0.3], CB)
    stamp(c, t)
    for gx in (sx - 4, sx + 3):
        c.set(gx, cy0 + 2, SPEC[3]); c.set(gx, cy0 + 3, SPEC[1])
    c.set(sx - 0.5, cy0 + 2, SPEC[4]); c.set(sx - 0.5, cy0 + 3, SPEC[2])

    # ---- phylactère flottante (cage d'or terni, cristal cyan)
    px_, py_ = hand2[0] + 1, 24 + by + P['phy']
    t = new()
    crystal = [(px_, py_ - 6), (px_ + 3.5, py_), (px_, py_ + 6), (px_ - 3.5, py_)]
    shade(t, mask_of(lambda q: q.poly(crystal, '#000')), SPEC, contrast=0.5, bias=0.1)
    t.line(px_, py_ - 5, px_ - 2, py_, SPEC[4])
    t.set(px_ - 1, py_ - 2, WHITE)
    stamp(c, t)
    t = new()
    for s in (-1, 1):
        t.line(px_ + s * 3.5, py_ - 0.5, px_ + s * 1.2, py_ - 6.5, LGOLD[3 if s < 0 else 1])
        t.line(px_ + s * 3.5, py_ + 0.5, px_ + s * 1.2, py_ + 6.5, LGOLD[2 if s < 0 else 1])
    t.line(px_ - 4, py_, px_ + 4, py_, LGOLD[2])
    ball(t, px_, py_ - 7.5, 1.5, 1.3, LGOLD)
    ball(t, px_, py_ + 7.5, 1.2, 1.1, LGOLD)
    t.outline(OUT)
    for y in range(t.h):
        for x in range(t.w):
            if t.px[y][x] is not None and (c.px[y][x] is None or t.px[y][x] != OUT):
                c.px[y][x] = t.px[y][x]
    for k in range(3):
        a = math.radians(f * 40 + k * 120)
        ox_, oy_ = px_ + math.cos(a) * 7, py_ + math.sin(a) * 4
        if c.get(ox_, oy_) is None:
            c.set(ox_, oy_, SPEC[3] if k == 0 else SPEC[2])

    # ---- bras avant : bâton d'os + manche évasée
    hand, ang = P['hand'], P['ang']
    if not atk:
        hand = (hand[0] + ln, hand[1] + by)
    t = new()
    top, _ = _lich_staff(t, hand, ang, 22 if atk else 31, 16 if atk else 19)
    stamp(c, t)
    sh = (25 + ln, 29 + by)

    def sleeve_():
        t = new()
        if atk:
            sleeve = [sh, (sh[0] - 5, sh[1] + 1), (hand[0] + 3, hand[1] + 3)]
        else:
            sleeve = [sh, (sh[0] - 5, sh[1] + 6), (hand[0] + 2, hand[1] - 2)]
        tube(t, sleeve, [3.8, 4.2, 5.0], [LROBE[1], LROBE[2], LROBE[3], LROBE[4], LTRIM[2]], contrast=0.5, bias=0.04)
        ex_, ey_ = sleeve[-1]
        ex0, ey0 = sleeve[-2]
        d = math.hypot(ex_ - ex0, ey_ - ey0) or 1
        ux, uy = (ex_ - ex0) / d, (ey_ - ey0) / d
        for k in range(-5, 6):
            q = k * 0.9
            px, py = ex_ - uy * q, ey_ + ux * q
            t.setf(px, py, LTRIM[3] if k < 0 else LTRIM[2])
            t.setf(px - ux, py - uy, LTRIM[1])
        stamp(c, t)

    def pauldron():
        t = new()
        ball(t, 24 + ln, 27 + by, 6.2, 4.8, [LROBE[1], LTRIM[0], LTRIM[1], LTRIM[2], LTRIM[3]])
        _spike(t, (21 + ln, 24 + by), (15 + ln, 18 + by), 3.4, LBONE)
        _spike(t, (25 + ln, 23 + by), (24 + ln, 16 + by), 3.0, LBONE)
        for x in (20, 24, 28):
            t.setf(x + ln, 30 + by, LBONE[3]); t.setf(x + ln, 31 + by, LBONE[1])
        stamp(c, t)

    for part in ((pauldron, sleeve_) if atk else (sleeve_, pauldron)):
        part()
    t = new()
    ball(t, hand[0], hand[1], 2.8, 2.4, LBONE, cuts=(0.05, 0.42, 0.74, 0.95))
    for k in range(3):
        t.set(hand[0] - 2 + k * 1.6, hand[1] + 1.6, LBONE[0])
        t.set(hand[0] - 2 + k * 1.6, hand[1] + 0.6, LBONE[3])
    stamp(c, t)

    # ---- flamme spectrale au sommet du bâton (gerbe rayonnante à l'attaque)
    tx, ty = top
    t = new()
    if atk:
        for k, (a, ln_, wd) in enumerate(((180, 16, 3.6), (205, 14, 3.0), (155, 13, 3.0), (232, 11, 2.4),
                                         (128, 10, 2.4), (262, 9, 2.0), (95, 7, 1.8), (300, 7, 1.8))):
            tongue(t, tx, ty, a, ln_, wd, SPEC, phase=k * 1.3)
        ball(t, tx, ty, 4.6, 4.6, SPEC)
        t.set(tx - 1, ty - 1, WHITE); t.set(tx, ty - 1, WHITE); t.set(tx - 1, ty, WHITE)
        stamp(c, t, SPEC[0])
        for k, (bx, by2, r) in enumerate(((tx - 13, ty + 13, 2.6), (tx - 17, ty + 5, 2.0), (tx - 8, ty + 21, 1.8))):
            t = new()
            ball(t, bx, by2, r, r, SPEC)
            for j in range(1, 6):
                if j < 3 or (j + k) % 2 == 0:
                    t.set(bx + r + j * 0.9, by2 - j * 0.6, SPEC[2] if j < 3 else SPEC[1])
            stamp(c, t, SPEC[0])
    else:
        ball(t, tx, ty, 2.4, 2.4, SPEC)
        flame_tongue(t, tx, ty + 1, 2.4, (9, 12)[f], 0.8 - f * 1.4, f * 2.0, SPEC)
        stamp(c, t, SPEC[0])

    put_behind(c, fire)
    glow_ring(c, '#16323e')
    pts = [((6, 30, 1), (58, 10, 0), (61, 46, 1), (4, 52, 0), (40, 2, 0)),
           ((7, 26, 0), (60, 8, 1), (62, 42, 0), (3, 47, 1), (44, 1, 1)),
           ((60, 12, 1), (62, 44, 0), (50, 4, 0), (2, 52, 1), (26, 64, 0))][f]
    specks(c, pts, SPEC)
    return shifted(c, 1), (W, H)


# ================================================================ 2. DRYADE POURRISSANTE

DW_, DH_ = 62, 74
RWOOD = ['#141012', '#2a1f22', '#443436', '#624f48', '#86705c']     # bois pourri
RWOODF = ['#0e0b0d', '#1e1618', '#30252a', '#463a38', '#5e4e46']    # plan arrière
RFACE = ['#2c2420', '#54463c', '#7c6a56', '#a69278', '#cebc9c']     # masque de bois pâle
RMOSS = ['#121e0c', '#223416', '#38501e', '#567028', '#82963a']     # mousse olive
RVINE = ['#13200e', '#26381a', '#3e5a22', '#5e7c2c', '#8aa23e']     # lianes
RTOX = ['#1a4a18', '#3e8a24', '#7ed03a', '#c8f67a', '#f4ffd0']      # lueur toxique
RFUNG = ['#4a1e0c', '#8a4214', '#c8741e', '#eeac46', '#ffe08c']     # polypores ocre
THORN = ['#3e3428', '#7a6a50', '#b8a680', '#e6dabc']

# by : buste, sw : balancement (cheveux, bras), roots : ondulation des racines
DPOSE = (
    dict(by=0, ln=0, sw=0, rt=0),
    dict(by=1, ln=-1, sw=2, rt=1),
    dict(by=1, ln=-3, sw=-2, rt=0),
)


def smooth(pts, sub=4):
    """Catmull-Rom : épine adoucie passant par les points."""
    if len(pts) < 3:
        return list(pts)
    P = [pts[0]] + list(pts) + [pts[-1]]
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for k in range(sub):
            u = k / sub
            out.append(tuple(0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * u + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * u * u
                                    + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * u ** 3) for j in (0, 1)))
    out.append(pts[-1])
    return out


def vine(c, pts, w0, w1, R, thorns=3, T=THORN, phase=0, every=1):
    """Liane épineuse : ruban qui s'affine, épines claires alternées (une tous les `every` segments)."""
    t = Layer(c.lw, c.lh)
    n = len(pts)
    widths = [w0 + (w1 - w0) * i / (n - 1) for i in range(n)]
    tube(t, pts, widths, R, contrast=0.5)
    stamp(c, t)
    if not thorns:
        return
    t = Layer(c.lw, c.lh)
    k = 0
    for i in range(n - 1):
        (x0, y0), (x1, y1) = pts[i], pts[i + 1]
        dx, dy = x1 - x0, y1 - y0
        d = math.hypot(dx, dy) or 1
        nx, ny = -dy / d, dx / d
        if i % every:
            continue
        for j in range(thorns):
            u = (j + 0.5) / thorns
            side = 1 if (k + phase) % 2 else -1
            wv = widths[i] + (widths[i + 1] - widths[i]) * u
            bx, by_ = x0 + dx * u + nx * side * (wv - 0.3), y0 + dy * u + ny * side * (wv - 0.3)
            tx, ty = bx + nx * side * 1.9 + dx / d * 1.1, by_ + ny * side * 1.9 + dy / d * 1.1
            t.line(bx, by_, tx, ty, T[2] if side < 0 else T[1])
            t.set(tx, ty, T[3] if side < 0 else T[2])
            k += 1
    stamp(c, t)


def twig_hand(c, x, y, ang, R, spread=26, n=3, ln_=5):
    """Main en brindilles : doigts crochus partant de (x, y) autour de l'angle ang (degrés)."""
    t = Layer(c.lw, c.lh)
    for i in range(n):
        a = math.radians(ang + (i - (n - 1) / 2) * spread / max(1, n - 1))
        mx, my = x + math.cos(a) * ln_ * 0.6, y + math.sin(a) * ln_ * 0.6
        a2 = a + math.radians(24)
        ex, ey = mx + math.cos(a2) * ln_ * 0.5, my + math.sin(a2) * ln_ * 0.5
        horn(t, [(x, y), (mx, my), (ex, ey)], [1.3, 0.9, 0.3], R)
    ball(t, x, y, 2.0, 1.8, R)
    stamp(c, t)


def bracket(c, x, y, r, R):
    """Polypore (champignon en console) : demi-disque aplati, bord clair, lamelles sombres dessous."""
    t = Layer(c.lw, c.lh)
    ball(t, x, y + 0.5, r, r * 0.75, R)
    cut = Layer(c.lw, c.lh)
    for yy in range(int(y + 1.5), int(y + r + 2)):
        for xx in range(int(x - r - 2), int(x + r + 3)):
            cut.set(xx, yy, '#000')
    for yy in range(t.h):
        for xx in range(t.w):
            if cut.px[yy][xx] is not None:
                t.px[yy][xx] = None
    t.line(x - r + 1, y + 1, x + r - 1, y + 1, R[1])
    t.line(x - r + 1.5, y - r * 0.35, x + r * 0.2, y - r * 0.55, R[4])
    stamp(c, t)


def rotting_dryad(f):
    W, H = DW_, DH_
    G = H - 2
    new = lambda: Layer(W, H)
    c = new()
    P = DPOSE[f]
    atk = f == 2
    by, ln, sw, rt = P['by'], P['ln'], P['sw'], P['rt']

    haze = new()

    # ---- racines au sol (derrière le tronc)
    for pts, w0 in ((((46, G - 3), (53, G - 1 - rt), (60, G + 0.5)), 2.8), (((40, G - 4), (44, G - 6 + rt), (50, G - 3)), 1.8)):
        vine(c, list(pts), w0, 0.6, RWOODF, thorns=0)

    # ---- bras arrière : liane épineuse qui pend, main de brindilles
    sh2 = (40 + ln, 31 + by)
    if atk:
        el2, hd2 = (47 + ln, 38 + by), (51 + ln, 46 + by)
    else:
        el2, hd2 = (46 + ln + sw / 2, 41 + by), (49 + ln + sw, 51 + by)
    vine(c, [sh2, el2, hd2], 2.8, 2.0, RVINE[:1] + RVINE[:4], thorns=2, T=THORN[:1] + THORN[:3], phase=1)
    twig_hand(c, hd2[0], hd2[1] + 1, 95 - sw * 3, RWOODF, spread=40, ln_=6)
    # liane qui pend de l'avant-bras
    t = new()
    t.line(el2[0] + 1, el2[1] + 1, el2[0] + 2 + sw, el2[1] + 14, RVINE[2])
    t.line(el2[0] + 2, el2[1] + 1, el2[0] + 3 + sw, el2[1] + 9, RVINE[3])
    stamp(c, t)

    # ---- chevelure de mousse qui tombe dans le dos (derrière)
    hx, hy = (ln - 1, by + 1) if atk else (ln, by)
    t = new()
    hair = [(27 + hx, 10 + hy), (40 + hx, 8 + hy), (47 + hx, 14 + hy), (50 + hx + sw / 2, 26 + hy),
            (49 + hx + sw, 38 + hy), (46 + hx + sw, 34 + hy), (45 + hx + sw, 42 + hy), (42 + hx + sw / 2, 33 + hy),
            (40 + hx, 38 + hy), (37 + hx, 26 + hy)]
    mh = mask_of(lambda q: q.poly(hair, '#000'))
    shade(t, mh, RMOSS, contrast=0.4)
    for k, x0 in enumerate((40, 43, 46)):
        t.line(x0 + hx, 14 + hy, x0 + hx + sw / 2 + 1, 30 + hy + k * 3, RMOSS[1])
    for (x, y) in mh:
        if (x, y + 1) not in mh and (x + y) % 3 == 0:
            drip(t, x, y + 1, 2 + (x % 3), RMOSS[:3])
    stamp(c, t)

    # ---- tronc / jupe d'écorce qui se fend en racines
    t = new()
    sk = [(28 + ln, 45 + by), (40 + ln, 45 + by), (44 + ln, 54 + by), (48, 63), (53, G - 1), (56, G + 1), (46, G + 1),
          (42, G - 2 + rt), (38, G + 1), (31, G + 1), (27, G - 2 - rt), (22, G + 1), (14, G + 1), (19, G - 3),
          (24 + ln / 2, 60), (26 + ln, 52 + by)]
    msk = mask_of(lambda q: q.poly(sk, '#000'))
    shade(t, msk, RWOOD, contrast=0.45)
    # veinure de l'écorce
    for k, (x0, x1) in enumerate(((30, 24), (33, 31), (36, 39), (39, 47))):
        t.line(x0 + ln, 48 + by, (x0 + x1) / 2 + ln / 2 + (k % 2), 60, RWOOD[1])
        t.line((x0 + x1) / 2 + ln / 2 + (k % 2), 60, x1, G - 1, RWOOD[1])
    t.line(31 + ln, 49 + by, 27, 62, RWOOD[3])
    # creux sombre (tronc creux) où luit une lueur toxique
    t.ellipse(35 + ln / 2, 58, 2.6, 3.4, RWOOD[0], only_inside=True)
    t.set(35 + ln / 2, 58, RTOX[2]); t.set(34 + ln / 2, 59, RTOX[1])
    for vein in (((30 + ln, 50 + by), (28, 56), (29, 61), (26, 66)), ((40 + ln, 51 + by), (42, 57), (45, 63), (48, 67)),
                 ((35 + ln / 2, 62), (36, 67))):
        for (x0, y0), (x1, y1) in zip(vein, vein[1:]):
            t.line(x0, y0, x1, y1, RTOX[1])
        for (x, y) in vein[1:-1]:
            t.setf(x, y, RTOX[2])
    stamp(c, t)
    # racines avant
    vine(c, [(24, G - 3), (16, G - 1 + rt), (6, G + 0.5)], 3.0, 0.6, RWOOD, thorns=0)
    vine(c, [(30, G - 2), (26, G + 0.5)], 2.2, 1.0, RWOOD, thorns=0)
    # ceinture de mousse pendante
    t = new()
    belt = [(26 + ln, 44 + by), (42 + ln, 44 + by), (44 + ln, 50 + by), (41 + ln, 49 + by), (39 + ln, 53 + by),
            (36 + ln, 50 + by), (33 + ln, 54 + by), (30 + ln, 50 + by), (27 + ln, 52 + by), (25 + ln, 48 + by)]
    spoly(t, belt, RMOSS, contrast=0.45)
    stamp(c, t)
    # champignons au pied (toxiques, points luisants)
    mushroom(c, 18, G + 0.5, 3, RFUNG, stem='#c8bc98', spots=RTOX[3], lean=-0.5)
    mushroom(c, 22, G + 0.5, 2, RFUNG, stem='#c8bc98', spots=RTOX[3])
    mushroom(c, 50, G + 0.5, 2.6, RFUNG, stem='#c8bc98', spots=RTOX[3], lean=0.5)
    bracket(c, 45 + ln / 2, 58, 3.4, RFUNG)

    # ---- torse d'écorce, cœur toxique
    t = new()
    tor = [(26 + ln, 28 + by), (41 + ln, 27 + by), (42 + ln, 34 + by), (39 + ln, 41 + by), (40 + ln, 46 + by),
           (28 + ln, 46 + by), (29 + ln, 41 + by), (26 + ln, 35 + by)]
    spoly(t, tor, RWOOD, contrast=0.48)
    for x0, x1 in ((29, 30), (37, 36)):
        t.line(x0 + ln, 30 + by, x1 + ln, 44 + by, RWOOD[1])
    for k in range(3):                                     # côtes de bois
        yy = 32 + by + k * 3
        t.line(28 + ln, yy, 32 + ln, yy + 1, RWOOD[3])
        t.line(36 + ln, yy + 1, 40 + ln, yy, RWOOD[2])
    t.ellipse(34 + ln, 36 + by, 2.8, 3.6, RWOOD[0], only_inside=True)
    for vein in (((32 + ln, 39 + by), (30 + ln, 42 + by), (31 + ln, 45 + by)), ((36 + ln, 33 + by), (38 + ln, 30 + by))):
        for (x0, y0), (x1, y1) in zip(vein, vein[1:]):
            t.line(x0, y0, x1, y1, RTOX[1])
    stamp(c, t)
    ball(c, 34 + ln, 36 + by, 1.8, 2.6, RTOX)
    c.set(33 + ln, 35 + by, RTOX[4])
    # mousse sur les épaules + polypores
    t = new()
    ball(t, 38 + ln, 28 + by, 5, 3, RMOSS)
    ball(t, 28 + ln, 28 + by, 4, 2.6, RMOSS)
    stamp(c, t)
    bracket(c, 43 + ln, 32 + by, 3.6, RFUNG)

    # ---- tête : masque de bois allongé
    t = new()
    spoly(t, [(30 + hx, 22 + hy), (36 + hx, 23 + hy), (35 + hx, 29 + hy), (31 + hx, 29 + hy)], RWOOD)   # cou
    stamp(c, t)
    t = new()                                                           # mèche de mousse encadrant le visage
    tube(t, [(29 + hx, 10 + hy), (24 + hx, 15 + hy), (22 + hx + sw / 3, 25 + hy), (23 + hx + sw / 2, 33 + hy),
             (22 + hx + sw / 2, 38 + hy)], [2.6, 2.8, 2.4, 1.8, 0.8], RMOSS, contrast=0.5, bias=0.08)
    t.line(25 + hx, 13 + hy, 22 + hx + sw / 3, 26 + hy, RMOSS[4])
    stamp(c, t)
    t = new()
    ball(t, 31 + hx, 17 + hy, 6.6, 8.0, RFACE)
    spoly(t, [(24.5 + hx, 17 + hy), (33 + hx, 21 + hy), (29 + hx, 29 + hy), (26 + hx, 28 + hy), (24 + hx, 23 + hy)],
          RFACE, contrast=0.4, bias=0.14)
    t.line(35 + hx, 11 + hy, 33 + hx, 17 + hy, RFACE[1])                # fissures du masque
    t.line(33 + hx, 17 + hy, 35 + hx, 21 + hy, RFACE[1])
    t.line(26 + hx, 26 + hy, 28 + hx, 28 + hy, RFACE[1])
    stamp(c, t)
    # orbites (nœuds du bois) + lueur toxique
    ey = 16 + hy
    for ex in (25 + hx, 31 + hx):
        c.rect(ex, ey, 4, 3, OUT)
        c.set(ex, ey - 1, RFACE[1]); c.set(ex + 3, ey - 1, RFACE[1]) if ex > 26 + hx else None
    for ex in (26 + hx, 32 + hx):
        c.set(ex, ey + 1, RTOX[4] if atk else RTOX[3]); c.set(ex + 1, ey + 1, RTOX[2]); c.set(ex + 1, ey, RTOX[1])
    # bouche : fente en éclats
    my = 23 + hy
    if atk:
        c.rect(25 + hx, my - 1, 6, 4, OUT)
        c.set(26 + hx, my - 1, RFACE[3]); c.set(29 + hx, my - 1, RFACE[3]); c.set(28 + hx, my + 2, RFACE[2])
        c.set(27 + hx, my + 1, RTOX[2]); c.set(28 + hx, my, RTOX[1])
    else:
        c.line(26 + hx, my, 29 + hx, my + 1, OUT)
        c.set(27 + hx, my + 1, OUT)
    trail = [(24 + hx, ey + 1), (23 + hx, ey)]
    if f:
        trail += [(22 + hx, ey - f % 2), (21 + hx, ey - 1)]
    for (x, y) in trail:
        if c.get(x, y) is None:
            c.set(x, y, RTOX[2] if x > 22 + hx else RTOX[1])
    # couronne de branches mortes (bois)
    for spine, wd in (([(33, 11), (36, 5), (39, 0)], [2.0, 1.4, 0.3]),
                      ([(35, 12), (42, 8), (48, 7), (52, 2)], [2.4, 1.8, 1.0, 0.3]),
                      ([(37, 13), (44, 11), (49, 13), (54, 11)], [1.8, 1.3, 0.8, 0.3]),
                      ([(29, 10), (27, 5), (23, 1)], [1.9, 1.3, 0.3]),
                      ([(42, 8), (44, 2)], [1.0, 0.3]),
                      ([(48, 7), (53, 8)], [0.9, 0.3]),
                      ([(27, 6), (30, 2)], [0.9, 0.3])):
        t = new()
        horn(t, [(x + hx + (sw / 3 if x > 34 else 0), y + hy) for x, y in spine], wd, RWOOD)
        stamp(c, t)
    t = new()
    ball(t, 38 + hx, 11 + hy, 3.4, 2.2, RMOSS)                          # touffe de mousse sur la couronne
    stamp(c, t)
    mushroom(c, 40 + hx, 10 + hy, 2.2, RFUNG, stem='#c8bc98', spots=RTOX[3], lean=0.4)
    mushroom(c, 37 + hx, 10 + hy, 1.4, RFUNG, stem='#c8bc98', spots=RTOX[3])

    # ---- bras avant : liane épineuse, griffes de brindilles ; à l'attaque, deux fouets lancés vers l'avant
    sh = (27 + ln, 31 + by)
    if atk:
        el, hd = (19 + ln, 30 + by), (11 + ln, 33 + by)
        # traînée toxique des fouets
        ring = new()                                                # rémanences des fouets (pointillés)
        for k, pts in enumerate(([hd, (6, 22), (-1, 16), (-8, 17)], [hd, (6, 46), (0, 53), (-7, 54)])):
            sp = smooth(pts, 6)
            for i, (x, y) in enumerate(sp[2:], 2):
                if i % 2 == 0:
                    ring.set(x, y, RTOX[1] if i < len(sp) * 0.6 else RTOX[2])
        lashes = ([hd, (3, 29), (-4, 25), (-11, 29), (-17, 26)], [hd, (3, 38), (-4, 43), (-11, 39), (-17, 43)])
        for k, pts in enumerate(lashes):
            vine(c, smooth(pts, 4), 2.6 - k * 0.3, 0.9, RVINE, thorns=1, phase=k, every=3)
        for (x, y) in ((-17, 26), (-17, 43)):
            sparkle(c, x - 1, y, RTOX[2], RTOX[4])
        put_behind(c, ring)
    else:
        el, hd = (18 + ln - sw / 2, 39 + by), (12 + ln - sw, 47 + by)
    vine(c, [sh, el, hd], 3.0, 2.2, RVINE, thorns=2)
    t = new()                                                       # liane enroulée autour du bras
    for k in range(5):
        u = k / 4
        x = sh[0] + (el[0] - sh[0]) * u
        y = sh[1] + (el[1] - sh[1]) * u
        t.set(x - 1 + k % 2, y + 1, RMOSS[4])
    stamp(c, t, None)
    twig_hand(c, hd[0], hd[1], 180 if atk else 110 + sw * 3, RWOOD, spread=50, ln_=6)
    t = new()
    ball(t, 26 + ln, 31 + by, 3.4, 3.0, RWOOD)                          # épaule noueuse
    _spike(t, (24 + ln, 29 + by), (20 + ln, 26 + by), 2.2, THORN)
    stamp(c, t)

    put_behind(c, haze)
    glow_ring(c, '#22301a')
    pts = [((8, 24, 1), (56, 12, 0), (58, 48, 1), (4, 46, 0), (14, 8, 0)),
           ((9, 20, 0), (57, 9, 1), (59, 44, 0), (5, 41, 1), (16, 5, 1)),
           ((56, 14, 1), (58, 46, 0), (-10, 18, 0), (-16, 50, 1), (52, 2, 0))][f]
    specks(c, pts, RTOX)
    return shifted(c, 1), (W, H)


# ================================================================ 3. COLOSSE DE MAGMA

MW, MH = 76, 70
OBS = ['#09070d', '#16111e', '#251d31', '#382d48', '#544766']        # obsidienne
OBSF = ['#060509', '#0e0b14', '#181321', '#251d31', '#382d48']       # plan arrière
LAVA = ['#5a0e06', '#b42a08', '#f06414', '#ffb030', '#fff0a0']       # magma
CRUST = ['#1e0a0a', '#3c120c', '#6a1e0e', '#b42a08', '#f06414']      # croûte de lave qui refroidit
SMK = ['#2a2430', '#3e3646', '#564c5e', '#70667a']                   # fumée

# by : buste, ln : avancée, ff/bf : pieds avant/arrière, bl : levée, fists : poings (avant, arrière)
MPOSE = (
    dict(by=0, ln=0, ff=0, bf=0, bl=0, f1=(15, 53), f2=(63, 51)),
    dict(by=2, ln=-1, ff=-3, bf=2, bl=3, f1=(17, 52), f2=(61, 53)),
    dict(by=4, ln=-5, ff=-4, bf=3, bl=0, f1=(6, 60), f2=(17, 59)),
)


def lava_crack(t, pts, glow=True, R=LAVA):
    """Fissure de magma (dans la forme déjà peinte) : halo orange, cœur jaune, nœuds blancs."""
    if glow:
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            n = int(max(abs(x1 - x0), abs(y1 - y0)) * 2) + 1
            for i in range(n + 1):
                x, y = x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    if t.get(x + dx, y + dy) not in (None, R[2], R[3], R[4]):
                        t.setf(x + dx, y + dy, R[1])
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        n = int(max(abs(x1 - x0), abs(y1 - y0)) * 2) + 1
        for i in range(n + 1):
            x, y = x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n
            t.setf(x, y, R[3] if i % 4 else R[2])
    for x, y in pts[1:-1]:
        t.setf(x, y, R[4])


def boulder(c, cx, cy, rx, ry, R, cracks=(), facets=True):
    """Bloc de roche anguleux (octogone irrégulier ombré) + fissures de magma."""
    t = Layer(c.lw, c.lh)
    pts = []
    for k in range(9):
        a = math.radians(k * 40 + 12)
        j = 0.86 + 0.14 * ((k * 7) % 3) / 2
        pts.append((cx + math.cos(a) * rx * j, cy + math.sin(a) * ry * j))
    m = mask_of(lambda q: q.poly(pts, '#000'))
    shade(t, m, R, contrast=0.5)
    if facets:
        t.line(pts[5][0] + 1, pts[5][1] + 1, cx - rx * 0.1, cy - ry * 0.1, R[4])
        t.line(cx - rx * 0.1, cy - ry * 0.1, pts[7][0] - 1, pts[7][1] + 1, R[3])
    for cr in cracks:
        lava_crack(t, [(cx + x, cy + y) for x, y in cr])
    stamp(c, t)
    return t


def magma_colossus(f):
    W, H = MW, MH
    G = H - 2
    new = lambda: Layer(W, H)
    c = new()
    P = MPOSE[f]
    atk = f == 2
    by, ln = P['by'], P['ln']

    smoke = new()

    # ---- bras arrière (plan arrière) + poing ; à l'attaque il passe devant le torse (frappe à deux poings)
    f2 = P['f2']
    sh2 = (56 + ln, 26 + by)

    def back_arm():
        t = new()
        el2 = (33 + ln, 40 + by) if atk else (62 + ln / 2, 38 + by)
        tube(t, [sh2 if not atk else (48 + ln, 30 + by), el2, (f2[0] + 2, f2[1] - 4)], [6.5, 5.5, 5.0], OBSF,
             contrast=0.4)
        lava_crack(t, [(el2[0] + 4, el2[1] - 2), (el2[0] + 1, el2[1] - 1), (el2[0] - 1, el2[1] + 4)], R=CRUST)
        stamp(c, t)
        boulder(c, f2[0], f2[1], 6.5, 6.0, [CRUST[0], CRUST[1], CRUST[2], CRUST[3], LAVA[2]],
                cracks=([(-4, -2), (-1, 0), (2, -3)], [(-1, 0), (0, 4)]), facets=False)
    if not atk:
        back_arm()

    # ---- jambes : courtes, massives (pas lourd)
    ff, bf, bl = P['ff'], P['bf'], P['bl']
    t = new()
    tube(t, [(48 + ln / 2, 48 + by), (50 + bf / 2, 56 - bl / 2), (51 + bf, G - 4 - bl)], [6, 5.6, 5.4], OBSF)
    stamp(c, t)
    t = new()
    spoly(t, [(43 + bf, G - 6 - bl), (58 + bf, G - 6 - bl), (60 + bf, G + 1 - bl), (42 + bf, G + 1 - (0 if not bl else bl))],
          OBSF, contrast=0.5)
    lava_crack(t, [(46 + bf, G - 5 - bl), (50 + bf, G - 2 - bl), (55 + bf, G - 4 - bl)], R=CRUST)
    stamp(c, t)
    t = new()
    tube(t, [(32 + ln / 2, 48 + by), (30 + ff * 0.6, 56 + by / 2), (29 + ff, G - 4)], [6.6, 6.0, 5.8], OBS)
    lava_crack(t, [(33 + ln / 2, 49 + by), (31 + ff * 0.6, 54 + by / 2), (33 + ff * 0.6, 58 + by / 2)])
    stamp(c, t)
    t = new()
    spoly(t, [(20 + ff, G - 6), (37 + ff, G - 6), (39 + ff, G + 1), (18 + ff, G + 1)], OBS, contrast=0.5)
    for x in (21, 25, 29):
        t.set(x + ff, G, OBS[3])
    lava_crack(t, [(24 + ff, G - 5), (28 + ff, G - 2), (34 + ff, G - 4)])
    stamp(c, t)

    # ---- torse massif voûté (épaules énormes, taille plus étroite), cœur de magma
    t = new()
    tor = [(25 + ln, 26 + by), (34 + ln, 15 + by), (52 + ln, 12 + by), (63 + ln, 22 + by), (61 + ln, 36 + by),
           (53 + ln, 47 + by), (35 + ln, 49 + by), (27 + ln, 41 + by)]
    mt = mask_of(lambda q: q.poly(tor, '#000'))
    shade(t, mt, OBS, contrast=0.5)
    t.line(35 + ln, 17 + by, 46 + ln, 14 + by, OBS[4])                # facettes vitreuses
    t.line(29 + ln, 25 + by, 34 + ln, 18 + by, OBS[4])
    t.line(38 + ln, 31 + by, 47 + ln, 28 + by, OBS[1])
    t.line(47 + ln, 28 + by, 57 + ln, 31 + by, OBS[1])
    hr = 3.6 + (f == 1) * 0.6 + atk * 0.6
    t.ellipse(45 + ln, 38 + by, hr + 1.4, hr + 0.6, OBS[0], only_inside=True)
    for cr in ([(45, 34), (43, 29), (46, 24), (44, 19)], [(41, 39), (36, 37), (33, 32), (30, 31)],
               [(49, 37), (55, 38), (59, 33)], [(44, 42), (41, 47)], [(43, 24), (38, 22)]):
        lava_crack(t, [(x + ln, y + by) for x, y in cr])
    stamp(c, t)
    t = new()
    ball(t, 45 + ln, 38 + by, hr, hr - 0.4, LAVA)
    t.set(44 + ln, 37 + by, WHITE)
    stamp(c, t, LAVA[0])

    # ---- épaule arrière (rocher + cheminée volcanique)
    boulder(c, 57 + ln, 19 + by, 9, 7.5, OBS, cracks=([(1, -6), (2, -2), (0, 1), (3, 6)], [(2, -2), (6, 0)]))
    t = new()
    flame_cluster(t, 59 + ln, 13 + by, 2.2, (7, 10, 9)[f], f * 1.7 + 0.5, LAVA)
    stamp(c, t, LAVA[0])

    # ---- tête : bloc anguleux projeté vers l'avant, arcade lourde, éclats d'obsidienne en crête
    hx, hy = (ln - 4, by + 3) if atk else (ln - 2, by)
    t = new()
    t = new()
    head = [(15 + hx, 22 + hy), (18 + hx, 17 + hy), (23 + hx, 15 + hy), (26 + hx, 12 + hy), (30 + hx, 14 + hy),
            (34 + hx, 20 + hy), (32 + hx, 32 + hy), (21 + hx, 34 + hy), (15 + hx, 30 + hy)]
    spoly(t, head, OBS, contrast=0.55, bias=0.05)
    t.line(19 + hx, 18 + hy, 28 + hx, 17 + hy, OBS[4])
    t.line(17 + hx, 21 + hy, 19 + hx, 18 + hy, OBS[4])
    lava_crack(t, [(31 + hx, 18 + hy), (29 + hx, 21 + hy), (32 + hx, 26 + hy)])
    stamp(c, t)
    ey = 23 + hy
    c.line(15 + hx, ey - 1, 29 + hx, ey - 2, OUT)
    c.line(16 + hx, ey - 2, 28 + hx, ey - 3, OBS[4])
    for ex in (17 + hx, 24 + hx):
        c.rect(ex, ey, 5, 2, LAVA[3])
        c.line(ex, ey, ex + 2, ey, LAVA[4])
        c.set(ex + 4, ey + 1, LAVA[2])
        c.set(ex + 1, ey + 2, LAVA[1]); c.set(ex + 2, ey + 2, LAVA[1])
    my = 29 + hy
    if atk:
        c.rect(17 + hx, my - 1, 10, 4, OUT)
        c.line(18 + hx, my, 25 + hx, my, LAVA[3])
        c.line(18 + hx, my + 1, 25 + hx, my + 1, LAVA[2])
        c.set(21 + hx, my, LAVA[4])
        for x in (18, 22, 26):
            c.set(x + hx, my - 1, OBS[4])
    else:
        c.line(17 + hx, my, 26 + hx, my + 1, OUT)
        c.line(18 + hx, my + 1, 25 + hx, my + 2, LAVA[2])
        c.set(21 + hx, my + 1, LAVA[3])
    trail = [(15 + hx, ey), (14 + hx, ey - 1)]
    if f:
        trail += [(13 + hx, ey - 1 - f % 2), (12 + hx, ey - 2)]
    for (x, y) in trail:
        if c.get(x, y) is None:
            c.set(x, y, LAVA[3] if x > 13 + hx else LAVA[2])

    if atk:
        back_arm()

    # ---- bras avant + poing de magma
    f1 = P['f1']
    sh = (36 + ln, 27 + by)
    el = (25 + ln, 41 + by) if not atk else (21 + ln, 42 + by)
    t = new()
    tube(t, [sh, el, (f1[0] + 1, f1[1] - 5)], [7.4, 6.4, 6.0], OBS, contrast=0.45)
    lava_crack(t, [(sh[0] - 4, sh[1] + 5), (el[0] + 2, el[1] - 2), (el[0] - 1, el[1] + 4), (f1[0] + 3, f1[1] - 6)])
    stamp(c, t)
    boulder(c, sh[0], sh[1] - 4, 8.5, 7.0, OBS, cracks=([(2, -6), (0, -2), (2, 2), (0, 6)], [(0, -2), (-5, 0)]))
    t = new()
    ball(t, f1[0], f1[1], 7.6, 6.8, [CRUST[0], CRUST[1], CRUST[2], CRUST[3], LAVA[2]])
    stamp(c, t)
    t = Layer(W, H)
    t.px = c.px
    for cr in ([(-6, -3), (-2, -1), (1, -5), (5, -3)], [(-2, -1), (-1, 3), (3, 5)], [(-6, 2), (-1, 3)]):
        lava_crack(t, [(f1[0] + x, f1[1] + y) for x, y in cr], glow=True)
    for k in range(3):                                                 # jointures incandescentes
        c.set(f1[0] - 6, f1[1] - 2 + k * 2.4, LAVA[4])
        c.set(f1[0] - 7, f1[1] - 2 + k * 2.4, LAVA[3])
    if not atk:
        for k, (dx, n) in enumerate(((-3, 3 + f), (1, 2 + (f == 0)), (4, 2))):
            drip(c, f1[0] + dx, f1[1] + 7, n, LAVA[1:])

    # ---- attaque : impact au sol, gerbes de lave, éclats de roche
    if atk:
        t = new()
        for k, (x, hh, wd) in enumerate(((1, 26, 3.8), (13, 21, 3.2), (-6, 18, 3.0), (22, 11, 2.4))):
            flame_tongue(t, x, G + 1, wd, hh, (-3, 2.5, -4, 2.5)[k], k * 1.7, LAVA)
        t.outline(LAVA[0])
        put_behind(c, t)                                             # gerbes derrière les poings
        t = new()
        for k, (x, hh, wd) in enumerate(((-10, 12, 2.8), (-15, 7, 2.2), (-19, 4, 1.6))):
            flame_tongue(t, x, G + 1, wd, hh, (-3, -2.5, -2)[k], k * 1.3 + 0.5, LAVA)
        stamp(c, t, LAVA[0])
        t = new()
        t.ellipse(5, G + 0.5, 22, 1.8, LAVA[1])
        t.ellipse(3, G + 0.5, 15, 1.0, LAVA[3])
        stamp(c, t, None)
        for (x, y, r) in ((-10, 41, 1.8), (-4, 34, 2.2), (4, 30, 1.6), (-15, 50, 1.6), (26, 44, 1.4), (-17, 58, 1.2)):
            t = new()
            ball(t, x, y, r, r, LAVA)
            t.set(x + 0.5, y + r + 1, LAVA[2])
            stamp(c, t, LAVA[0])
        for (x, y, r) in ((-7, 46, 1.6), (18, 36, 1.4), (-12, 56, 1.8)):
            t = new()
            boulder(t, x, y, r + 0.8, r + 0.4, OBS, facets=False)
            stamp(c, t)

    put_behind(c, smoke)
    glow_ring(c, '#4a1a10', every=1)
    pts = [((6, 30, 1), (70, 10, 0), (72, 44, 1), (4, 50, 0), (46, 4, 1)),
           ((7, 26, 0), (71, 8, 1), (73, 40, 0), (3, 45, 1), (48, 2, 0)),
           ((70, 12, 1), (72, 44, 0), (48, 4, 0), (-17, 38, 1), (34, 18, 0))][f]
    specks(c, pts, LAVA)
    return shifted(c, 0), (W, H)


# ================================================================ 4. WYRM DE GIVRE

WW, WH = 78, 66
WSC = ['#18224c', '#2c4886', '#5482c0', '#90bfe8', '#dcf2ff']       # écailles
WSCF = ['#10183a', '#1c2e62', '#30528a', '#5482c0', '#90bfe8']      # plan arrière
WBEL = ['#46587c', '#8498bc', '#bccde4', '#e4eef9', '#ffffff']      # plaques ventrales
WEYE = ['#2a1a6a', '#8a6aff', '#f0e8ff']                            # yeux violets
MIST = ['#5a7ab0', '#9cc4ea', '#dcf4ff', '#ffffff']

WPOSE = (
    dict(rise=0, hx=0, hy=0, tail=0),
    dict(rise=2, hx=1, hy=-2, tail=1),
    dict(rise=1, hx=-3, hy=6, tail=0),
)


def arc_pts(cx, cy, rx, ry, a0, a1, n=14):
    return [(cx + math.cos(math.radians(a0 + (a1 - a0) * i / n)) * rx,
             cy + math.sin(math.radians(a0 + (a1 - a0) * i / n)) * ry) for i in range(n + 1)]


def serpent(c, spine, widths, R, B=None, belly=1):
    """Corps de serpent : écailles en quinconce, ombrées selon la normale (lumière en haut à gauche),
    plaques ventrales du côté `belly` (+1 / -1 : côté de l'épine) si B est donné."""
    t = Layer(c.lw, c.lh)
    seg = [math.hypot(spine[i + 1][0] - spine[i][0], spine[i + 1][1] - spine[i][1]) for i in range(len(spine) - 1)]
    L = sum(seg) or 1
    wm = max(widths)

    def tangent(tt):
        d = tt * L
        for i, sl in enumerate(seg):
            if d <= sl or i == len(seg) - 1:
                (x0, y0), (x1, y1) = spine[i], spine[i + 1]
                n = sl or 1
                return (x1 - x0) / n, (y1 - y0) / n
            d -= sl

    def sh(tt, ss, x, y):
        if B is not None and ss * belly > 0.4:
            a = tt * L / 2.2
            if a - math.floor(a) < 0.34:
                return B[1]
            return B[3] if ss * belly < 0.72 else B[2]
        tx, ty = tangent(tt)
        ox, oy = -ty * ss, tx * ss
        v = 0.52 + 0.46 * (ox * -0.6 + oy * -0.8)
        a = tt * L / 4.0
        b = (ss + 1) * wm / 3.2 + (math.floor(a) % 2) * 0.5
        fa, fb = a - math.floor(a), b - math.floor(b)
        if fb > 0.72 and 0.15 < fa < 0.85:
            v -= 0.2
        return R[max(0, min(4, int(v * 5)))]
    spine_fill(t, spine, widths, sh)
    stamp(c, t)


def frost_wyrm(f):
    W, H = WW, WH
    G = H - 2
    new = lambda: Layer(W, H)
    c = new()
    P = WPOSE[f]
    atk = f == 2
    ri = P['rise']
    tl = P['tail']

    # ---- corps enroulé en spirale : queue (avant droite, au sol) -> 1 tour 1/3 -> cou (avant gauche, en haut)
    cx, cy = 44, G - 13
    th0, th1 = 30 - tl * 10, 510

    def at(th):
        u = (th - th0) / (th1 - th0)
        r = 29 - 11 * u
        h = 13 * u + ri * u
        a = math.radians(th)
        return (cx + r * math.cos(a), cy - h + r * 0.27 * math.sin(a))

    def width(th):
        u = (th - th0) / (th1 - th0)
        return 1.2 + 6.2 * min(1.0, u / 0.16) ** 0.8 - 0.8 * u

    def run(a0, a1, step=10):
        n = max(2, int(abs(a1 - a0) / step))
        ths = [a0 + (a1 - a0) * i / n for i in range(n + 1)]
        return [at(th) for th in ths], [width(th) for th in ths]

    # plan arrière : dos de la boucle basse (180 -> 360)
    sp, wd = run(178, 362)
    serpent(c, sp, wd, WSCF, belly=1)
    # crêtes de glace sur le dos (derrière la boucle haute)
    for k, th in enumerate((215, 250, 285, 320)):
        x, y = at(th)
        w_ = width(th)
        ice_shard(c, (x, y - w_ + 2), (x + 2 + k * 0.6, y - w_ - 6 - (k % 2) * 2), 4.4)
    # face avant de la boucle basse (queue -> gauche)
    sp, wd = run(th0, 182)
    serpent(c, sp, wd, WSC, [WBEL[0], WBEL[0], WBEL[1], WBEL[2]], belly=-1)
    tipx, tipy = at(th0)
    ice_shard(c, (tipx - 1, tipy), (tipx + 6, tipy - 5 - tl), 3.2)
    ice_shard(c, (tipx, tipy + 1), (tipx + 7, tipy + 1), 2.4)
    # crêtes sur la boucle haute, puis sa face avant (droite -> gauche)
    for k, th in enumerate((380, 410, 440, 470)):
        x, y = at(th)
        w_ = width(th)
        ice_shard(c, (x, y - w_ + 2), (x + 2 + (k % 2), y - w_ - 7 - (k % 2) * 2), 4.6)
    sp, wd = run(358, th1)
    serpent(c, sp, wd, WSC, belly=-1)

    # ---- cou en S qui s'élève de la boucle haute (plaques ventrales côté gauche)
    hx, hy = P['hx'], P['hy']
    base = at(th1 - 6)
    if atk:
        neck = [base, (23, 34 - ri), (21, 26 + hy / 2), (17 + hx / 2, 20 + hy)]
    else:
        neck = [base, (23, 35 - ri), (28, 25 - ri / 2), (27 + hx / 2, 17 + hy), (23 + hx, 12 + hy)]
    for k, u in enumerate((0.3, 0.5, 0.7)):
        i = u * (len(neck) - 1)
        j = min(len(neck) - 2, int(i))
        px = neck[j][0] + (neck[j + 1][0] - neck[j][0]) * (i - j)
        py = neck[j][1] + (neck[j + 1][1] - neck[j][1]) * (i - j)
        ice_shard(c, (px + 4, py), (px + 11 - k, py - 4 - k), 4.0 - k * 0.3)
    serpent(c, neck, [6.6, 6.4, 6.0, 5.6, 5.4][:len(neck)], WSC, WBEL, belly=-1)

    # ---- tête de dragon tournée vers la gauche (≈ 26 px)
    ox, oy = 2 + hx, -1 + hy
    jaw = 7 if atk else 0
    t = new()
    horn(t, [(ox + 19, oy + 6), (ox + 27, oy + 2), (ox + 34, oy - 1), (ox + 38, oy - 7)], [3.0, 2.6, 1.6, 0.4], ICE)
    horn(t, [(ox + 21, oy + 11), (ox + 29, oy + 10), (ox + 36, oy + 7), (ox + 41, oy + 3)], [2.8, 2.3, 1.4, 0.4], ICE)
    stamp(c, t)
    t = new()
    for k, (a, l) in enumerate(((-25, 8), (8, 9), (40, 7))):
        r = math.radians(a)
        ice_shard(t, (ox + 22, oy + 14), (ox + 22 + math.cos(r) * l, oy + 14 + math.sin(r) * l), 4.4)
    for y in range(t.h):
        for x in range(t.w):
            if t.px[y][x] is not None:
                c.px[y][x] = t.px[y][x]
    # mâchoire inférieure (s'ouvre à l'attaque)
    t = new()
    jw = [(ox + 1, oy + 15 + jaw * 0.7), (ox + 14, oy + 15), (ox + 24, oy + 16), (ox + 20, oy + 21 + jaw * 0.2),
          (ox + 5, oy + 19 + jaw)]
    spoly(t, jw, WSC, contrast=0.4)
    t.line(ox + 3, oy + 17 + jaw * 0.85, ox + 18, oy + 18, WBEL[2])
    t.line(ox + 4, oy + 18 + jaw * 0.85, ox + 17, oy + 19, WBEL[1])
    stamp(c, t)
    if atk:
        t = new()
        t.poly([(ox + 1, oy + 14), (ox + 19, oy + 14), (ox + 19, oy + 16), (ox + 3, oy + 16 + jaw * 0.85)], '#3a1838')
        t.poly([(ox + 5, oy + 15), (ox + 17, oy + 15), (ox + 7, oy + 15 + jaw * 0.6)], '#7a3a6a')
        stamp(c, t)
        for k in range(5):
            c.set(ox + 3 + k * 3, oy + 14, WHITE)
            c.set(ox + 4 + k * 3, oy + 16 + jaw * 0.8 - k * 1.4, WHITE)
    t = new()
    skull = [(ox, oy + 11), (ox + 6, oy + 8), (ox + 15, oy + 4), (ox + 23, oy + 4), (ox + 27, oy + 10), (ox + 24, oy + 16),
             (ox + 12, oy + 15), (ox + 1, oy + 15)]
    spoly(t, skull, WSC, contrast=0.5, bias=0.06)
    t.line(ox + 3, oy + 9, ox + 14, oy + 5, WSC[4])
    t.line(ox + 2, oy + 15, ox + 14, oy + 15, WSC[1])
    for k in range(3):                                                  # écailles du museau
        t.set(ox + 7 + k * 4, oy + 11 - k, WSC[1]); t.set(ox + 8 + k * 4, oy + 11 - k, WSC[1])
    stamp(c, t)
    ex, ey = ox + 15, oy + 8
    c.line(ex - 3, ey - 1, ex + 5, ey - 2, OUT)
    c.rect(ex, ey, 4, 2, WEYE[1]); c.set(ex, ey, WEYE[2]); c.set(ex + 1, ey, WEYE[2]); c.set(ex + 3, ey + 1, WEYE[0])
    c.set(ox + 2, oy + 10, OUT); c.set(ox + 3, oy + 10, OUT)
    if not atk:
        for k in range(4):
            c.set(ox + 3 + k * 4, oy + 15, WHITE)
            c.set(ox + 3 + k * 4, oy + 16, WBEL[2])
    trail = [(ex - 1, ey + 1), (ex - 2, ey + 1), (ex - 3, ey + 2)]
    for (x, y) in trail[: 2 + (f > 0)]:
        if c.get(x, y) is None:
            c.set(x, y, WEYE[1])
    t = new()
    _spike(t, (ox + 15, oy + 5), (ox + 19, oy - 1), 3.0, ICE)
    _spike(t, (ox + 10, oy + 7), (ox + 11, oy + 2), 2.4, ICE)
    stamp(c, t)

    # ---- souffle : buée au repos, rafale d'éclats de glace à l'attaque
    mx, my = ox + 1, oy + 15 + jaw * 0.4
    if atk:
        t = new()
        breath(t, mx, my, mx - 20, my + 8, 2.4, 8.0, [MIST[0], MIST[0], MIST[1], MIST[2], MIST[3]], 0.7)
        stamp(c, t, '#2a3e70')
        a = math.atan2(8, -20)
        for k, (d, off, l) in enumerate(((7, -3, 4), (12, 4, 5), (16, -5, 5), (20, 3, 5), (14, 0, 4), (9, 3, 3),
                                         (22, -2, 3))):
            bx = mx + math.cos(a) * d - math.sin(a) * off
            by_ = my + math.sin(a) * d + math.cos(a) * off
            ice_shard(c, (bx + 2, by_ - 0.6), (bx - l, by_ + l * 0.33), 2.8)
    else:
        for k, (dx, dy) in enumerate(((-2, 0), (-4, -1), (-6, -3), (-5, 1), (-8, -2))):
            x, y = mx + dx - f, my + dy - (k > 2) * f
            if c.get(x, y) is None:
                c.set(x, y, MIST[2] if k < 2 else MIST[1])

    glow_ring(c, '#26406a')
    pts = [((6, 40, 1), (74, 12, 0), (76, 56, 1), (4, 56, 0), (46, 8, 1), (60, 16, 0)),
           ((7, 36, 0), (74, 9, 1), (76, 52, 0), (3, 52, 1), (48, 5, 0), (62, 12, 1)),
           ((74, 14, 1), (76, 54, 0), (46, 6, 0), (-18, 14, 1), (40, 2, 0), (-20, 46, 1))][f]
    specks(c, pts, ICE)
    return shifted(c, 0), (W, H)


# ================================================================ 5. TYRAN D'OBSIDIENNE

TW, TH = 72, 72
TOBS = ['#0a0812', '#1a1530', '#2e2650', '#4c4280', '#8274c0']       # plaques d'obsidienne
TOBSF = ['#060509', '#100d1e', '#1e1934', '#2e2650', '#4c4280']      # plan arrière
GLINT = '#d4ccff'                                                   # reflet vitreux
TRUNE = ['#4a0410', '#a00c1c', '#ff3030', '#ffb4a4']                # runes cramoisies
TSMK = ['#16121e', '#262030', '#383044', '#50465e', '#6c6280']       # cape de fumée
TBLADE = ['#08060e', '#171226', '#2a2240', '#443866', '#6e5e9a']
TARC = ['#3a020c', '#a00c1c', '#ff3a3a', '#ffe0d4']

# by : buste, ln : avancée, pas, mains (garde) et angle de la lame (degrés)
TPOSE = (
    dict(by=0, ln=0, ff=0, bf=0, bl=0, hand=(23, 40), ang=127, sway=0),
    dict(by=2, ln=-1, ff=-4, bf=3, bl=3, hand=(22, 41), ang=129, sway=3),
    dict(by=2, ln=-4, ff=-6, bf=5, bl=0, hand=(21, 43), ang=166, sway=-2),
)


def glossy(t, pts, R, glint=GLINT, contrast=0.5, bias=0.0):
    """Plaque d'obsidienne : ombrage net + reflet vitreux sur l'arête haute-gauche."""
    m = mask_of(lambda q: q.poly(pts, '#000'))
    shade(t, m, R, contrast=contrast, bias=bias)
    for (x, y) in m:
        if (x - 1, y) not in m and (x, y - 1) not in m and (x - 1, y - 1) not in m:
            t.set(x, y, glint)
    return m


def greatblade(t, guard, ang, length=40, width=7.0, hilt=9):
    """Espadon d'obsidienne : lame large effilée, tranchant cramoisi, garde anguleuse, poignée, pommeau.
    Renvoie (pointe, (dx, dy))."""
    a = math.radians(ang)
    dx, dy = math.cos(a), math.sin(a)
    nx, ny = -dy, dx
    gx, gy = guard
    tip = (gx + dx * length, gy + dy * length)
    w = width / 2
    blade = [(gx + nx * w, gy + ny * w), (gx + dx * length * 0.82 + nx * w * 0.9, gy + dy * length * 0.82 + ny * w * 0.9),
             tip, (gx + dx * length * 0.86 - nx * w * 0.8, gy + dy * length * 0.86 - ny * w * 0.8),
             (gx - nx * w, gy - ny * w)]
    m = mask_of(lambda q: q.poly(blade, '#000'))
    shade(t, m, TBLADE, contrast=0.35)
    # gouttière centrale + tranchant cramoisi (côté -n)
    t.line(gx + dx * 3, gy + dy * 3, gx + dx * length * 0.8, gy + dy * length * 0.8, TBLADE[0])
    t.line(gx + dx * 3 + nx, gy + dy * 3 + ny, gx + dx * length * 0.8 + nx, gy + dy * length * 0.8 + ny, TBLADE[4])
    for k in range(3, int(length) - 1):
        u = k / length
        ww = w * (0.8 if u < 0.84 else 0.8 * (1 - u) / 0.16) - 0.2
        ex, ey = gx + dx * k - nx * ww, gy + dy * k - ny * ww
        t.setf(ex, ey, TRUNE[2] if k % 6 else TRUNE[3])
        t.setf(ex + nx, ey + ny, TRUNE[1])
    # runes gravées
    for k in (8, 15, 22):
        px, py = gx + dx * k, gy + dy * k
        t.setf(px + nx * 1.5, py + ny * 1.5, TRUNE[2]); t.setf(px + nx * 1.5 + dx, py + ny * 1.5 + dy, TRUNE[1])
    # garde
    gp = [(gx + nx * (w + 4) - dx, gy + ny * (w + 4) - dy), (gx + nx * (w + 2) + dx * 2, gy + ny * (w + 2) + dy * 2),
          (gx - nx * (w + 2) + dx * 2, gy - ny * (w + 2) + dy * 2), (gx - nx * (w + 4) - dx, gy - ny * (w + 4) - dy),
          (gx - dx * 2.5, gy - dy * 2.5)]
    glossy(t, gp, TOBS)
    t.set(gx - dx * 0.5, gy - dy * 0.5, TRUNE[2])
    # poignée + pommeau
    hx, hy = gx - dx * hilt, gy - dy * hilt
    t.line(gx - dx * 2, gy - dy * 2, hx, hy, TOBS[2], width=2.2)
    for k in range(3, hilt, 2):
        t.set(gx - dx * k, gy - dy * k, TRUNE[0])
    ball(t, hx - dx, hy - dy, 2.0, 2.0, TOBS)
    t.set(hx - dx, hy - dy, TRUNE[2])
    return tip, (dx, dy)


def obsidian_tyrant(f):
    W, H = TW, TH
    G = H - 2
    new = lambda: Layer(W, H)
    c = new()
    P = TPOSE[f]
    atk = f == 2
    by, ln, sw = P['by'], P['ln'], P['sway']

    # ---- cape de fumée (derrière) : pan qui flotte, ourlet qui se dissipe en volutes et particules
    t = new()
    hem = []
    for i in range(9):
        x = 34 + i * 4
        hem.append((x + sw * i / 8, G - 6 - i * 2.2 + (3 if (i + f) % 2 else -1)))
    cape = [(36 + ln, 27 + by), (50 + ln, 26 + by), (58 + sw, 36 + by), (66 + sw, 48)] + hem[::-1]
    mc = mask_of(lambda q: q.poly(cape, '#000'))
    shade(t, mc, TSMK, contrast=0.45, bias=0.05)
    for k, x0 in enumerate((44, 51, 58)):
        t.line(x0 + ln, 32 + by, x0 + sw + 2 + k, G - 12 - k * 4, TSMK[1])
        t.line(x0 + ln + 1, 32 + by, x0 + sw + 3 + k, G - 14 - k * 4, TSMK[3])
    # bord inférieur qui se dissout : trame claire
    for (x, y) in mc:
        if (x, y + 2) not in mc and (x + y) % 2:
            t.set(x, y, TSMK[3])
    stamp(c, t, TSMK[0])
    wisps = new()
    for k, (x, y) in enumerate(hem[::2]):
        # volutes : petites boucles qui s'élèvent
        cx_, cy_ = x + 2 + sw * 0.3, y + 5 - f * 1.5 + (k % 2) * 2
        for j in range(10):
            a_ = j * 0.7 + k + f * 0.9
            r_ = 2.6 - j * 0.2
            px, py = cx_ + math.cos(a_) * r_ + j * 0.5, cy_ + math.sin(a_) * r_ * 0.7 - j * 0.3
            if j % 3 != 2:
                wisps.set(px, py, TSMK[3] if j < 4 else TSMK[2])
    for k, (x, y) in enumerate(((68, 30), (71, 42), (66, 22), (73, 54), (62, 64))):
        wisps.set(x + sw + f % 2, y - f, TSMK[4] if k % 2 else TSMK[3])

    # ---- espadon : planté devant lui au repos (mains sur le pommeau), balayé vers l'avant à l'attaque
    hand, ang = P['hand'], P['ang']
    if not atk:
        hand = (hand[0] + ln, hand[1] + by)

    # ---- jambe arrière
    bf, bl, ff = P['bf'], P['bl'], P['ff']
    t = new()
    tube(t, [(44 + ln / 2, 50 + by), (46 + bf / 2, 58 - bl / 2), (47 + bf, G - 4 - bl)], [4.4, 4.0, 3.6], TOBSF)
    if bl:
        spoly(t, [(42 + bf, G - 4 - bl), (52 + bf, G - 5 - bl), (53 + bf, G + 1 - bl - 1), (42 + bf, G + 1)], TOBSF)
    else:
        spoly(t, [(42 + bf, G - 4), (52 + bf, G - 4), (53 + bf, G + 1), (40 + bf, G + 1)], TOBSF)
    stamp(c, t)
    # ---- jambe avant
    t = new()
    tube(t, [(31 + ln / 2, 50 + by), (29 + ff * 0.6, 58 + by / 2), (28 + ff, G - 4)], [4.8, 4.4, 4.0], TOBS)
    ball(t, 29 + ff * 0.6, 57 + by / 2, 4.4, 4.0, TOBS)
    _spike(t, (27 + ff * 0.6, 56 + by / 2), (22 + ff * 0.6, 54 + by / 2), 3.4, TOBS)
    spoly(t, [(22 + ff, G - 4), (34 + ff, G - 4), (35 + ff, G + 1), (19 + ff, G + 1)], TOBS)
    t.line(23 + ff, G - 4, 33 + ff, G - 4, TOBS[4])
    t.set(29 + ff, G - 2, TRUNE[2]); t.set(30 + ff, G - 2, TRUNE[1])
    for y in range(59, G - 5):
        t.setf(30 + ff * 0.8, y + by / 2 * (1 - (y - 59) / 6), TRUNE[1] if y % 3 else TRUNE[2])
    stamp(c, t)

    # ---- tassettes (plaques en éventail) + ceinture runique
    t = new()
    ox = ln
    for k, (x0, x1, yb) in enumerate(((24, 31, 58), (30, 38, 59), (37, 45, 58), (44, 51, 56))):
        glossy(t, [(x0 + ox, 47 + by), (x1 + ox, 47 + by), (x1 + ox + 1, yb + by - 2), ((x0 + x1) / 2 + ox, yb + by),
                   (x0 + ox - 1, yb + by - 2)], TOBS if k < 3 else TOBSF, contrast=0.45)
    stamp(c, t)
    t = new()
    spoly(t, [(25 + ox, 45 + by), (51 + ox, 45 + by), (51 + ox, 49 + by), (25 + ox, 49 + by)], TOBS, contrast=0.3)
    for x in range(26, 51, 3):
        t.setf(x + ox, 47 + by, TRUNE[2] if x % 2 else TRUNE[1])
    stamp(c, t)
    t = new()
    ball(t, 37 + ox, 47 + by, 3.0, 2.6, TOBS)
    t.set(37 + ox, 47 + by, TRUNE[3]); t.set(36 + ox, 47 + by, TRUNE[2]); t.set(38 + ox, 47 + by, TRUNE[2])
    stamp(c, t)

    # ---- cuirasse : plastron à facettes, rune en V qui pulse
    t = new()
    glossy(t, [(26 + ox, 27 + by), (50 + ox, 27 + by), (49 + ox, 37 + by), (45 + ox, 45 + by), (30 + ox, 45 + by),
               (27 + ox, 37 + by)], TOBS, contrast=0.5)
    t.line(38 + ox, 28 + by, 38 + ox, 44 + by, TOBS[1])
    t.line(39 + ox, 28 + by, 39 + ox, 43 + by, TOBS[3])
    t.line(28 + ox, 36 + by, 37 + ox, 44 + by, TOBS[1])
    rk = TRUNE[3] if f else TRUNE[2]
    for k in range(6):
        t.set(31 + ox + k, 31 + by + k, TRUNE[2] if k % 2 else rk)
        t.set(46 + ox - k, 31 + by + k, TRUNE[1] if k % 2 else TRUNE[2])
    t.set(38 + ox, 37 + by, TRUNE[3]); t.set(38 + ox, 38 + by, TRUNE[2])
    stamp(c, t)

    # ---- épaulière arrière
    t = new()
    glossy(t, [(43 + ln, 25 + by), (52 + ln, 22 + by), (57 + ln, 28 + by), (55 + ln, 35 + by), (45 + ln, 34 + by)], TOBSF)
    _spike(t, (51 + ln, 23 + by), (55 + ln, 13 + by), 4.0, TOBSF)
    stamp(c, t)

    # ---- heaume : couronne d'éclats d'obsidienne, visière en T cramoisie
    hx, hy = (ln - 1, by - 2) if atk else (ln, by - 3)
    t = new()
    for k, (bx, hh, lean, w_) in enumerate(((32, 8, -4, 4.0), (37, 14, -0.5, 5.0), (43, 9, 3.5, 4.0))):
        _spike(t, (bx + hx, 12 + hy), (bx + hx + lean, 12 + hy - hh), w_, TOBS)
    stamp(c, t)
    for (x, y) in ((36.5, 1), (33, 6)):
        c.set(x + hx, y + hy, GLINT)
    t = new()
    glossy(t, [(31 + ln, 22 + by), (45 + ln, 22 + by), (46 + ln, 30 + by), (30 + ln, 30 + by)], TOBSF)   # gorgerin
    stamp(c, t)
    t = new()
    glossy(t, [(30 + hx, 12 + hy), (44 + hx, 11 + hy), (47 + hx, 18 + hy), (45 + hx, 27 + hy), (37 + hx, 30 + hy),
               (30 + hx, 28 + hy), (28 + hx, 19 + hy)], TOBS, contrast=0.55, bias=0.12)
    t.line(31 + hx, 13 + hy, 43 + hx, 12 + hy, TOBS[4])
    t.line(40 + hx, 13 + hy, 41 + hx, 27 + hy, TOBS[1])
    t.line(41 + hx, 14 + hy, 42 + hx, 26 + hy, TOBS[3])
    for y in (23, 25):
        t.set(29 + hx, y + hy, TOBS[1]); t.set(31 + hx, y + 1 + hy, TOBS[1])
    stamp(c, t)
    ey = 18 + hy
    c.rect(28 + hx, ey, 12, 2, OUT)
    c.rect(32 + hx, ey + 2, 2, 6, OUT)
    gl = TRUNE[3] if atk else TRUNE[2]
    c.line(28 + hx, ey, 31 + hx, ey, gl); c.line(34 + hx, ey, 38 + hx, ey, gl)
    c.line(28 + hx, ey + 1, 38 + hx, ey + 1, TRUNE[1])
    c.set(32 + hx, ey + 3, TRUNE[1]); c.set(33 + hx, ey + 4, TRUNE[1])
    trail = [(26 + hx, ey), (25 + hx, ey - 1)]
    if f:
        trail += [(24 + hx, ey - 1 - f % 2), (23 + hx, ey - 2)]
    for (x, y) in trail:
        if c.get(x, y) is None:
            c.set(x, y, TRUNE[2] if x > 24 + hx else TRUNE[1])

    # ---- attaque : grand croissant cramoisi derrière la lame
    if atk:
        arc = ring_arc(c, 24, 40, 30, 0.95, 300, 166, 9, TARC, dither=0.3)
        put_behind(c, arc)

    # ---- bras : les deux mains sur la poignée
    sh2 = (46 + ln, 31 + by)
    t = new()
    tube(t, [sh2, ((sh2[0] + hand[0]) / 2 + 3, (sh2[1] + hand[1]) / 2 + 5), (hand[0] + 3, hand[1] + 1)],
         [3.8, 3.4, 3.2], TOBSF)
    stamp(c, t)
    t = new()
    if atk:
        greatblade(t, (hand[0] - 3, hand[1] + 1), P['ang'], length=33, width=8.5)
    else:
        gd = (hand[0] - 3, hand[1] + 4)
        L_ = (G + 1 - gd[1]) / math.sin(math.radians(ang))
        greatblade(t, gd, ang, length=L_, width=8.5, hilt=7)
    stamp(c, t)
    sh = (27 + ln, 31 + by)
    t = new()
    el = ((sh[0] + hand[0]) / 2 - 2, (sh[1] + hand[1]) / 2 + 3) if not atk else (sh[0] - 4, sh[1] + 8)
    tube(t, [sh, el, (hand[0], hand[1])], [4.0, 3.6, 3.4], TOBS)
    stamp(c, t)
    for (gx, gy) in ((hand[0] + 3, hand[1] + 1), (hand[0], hand[1])):
        t = new()
        ball(t, gx, gy, 3.4, 3.0, TOBS)
        t.set(gx - 2, gy - 1, GLINT)
        t.set(gx - 1, gy + 1, TRUNE[2]); t.set(gx + 1, gy + 1, TRUNE[1])
        stamp(c, t)
    # ---- épaulière avant : plaques superposées + éclats
    t = new()
    glossy(t, [(19 + ln, 28 + by), (25 + ln, 23 + by), (33 + ln, 24 + by), (35 + ln, 31 + by), (31 + ln, 36 + by),
               (20 + ln, 35 + by)], TOBS, contrast=0.5)
    t.line(20 + ln, 31 + by, 33 + ln, 31 + by, TOBS[1])
    t.line(20 + ln, 32 + by, 33 + ln, 32 + by, TOBS[4])
    for x in (22, 27, 32):
        t.set(x + ln, 31 + by, TRUNE[2])
    stamp(c, t)
    t = new()
    glossy(t, [(17 + ln, 33 + by), (22 + ln, 31 + by), (33 + ln, 33 + by), (31 + ln, 39 + by), (19 + ln, 39 + by)],
           TOBS, contrast=0.5)                                       # lame inférieure de l'épaulière
    t.line(19 + ln, 38 + by, 30 + ln, 38 + by, TRUNE[1])
    stamp(c, t)

    put_behind(c, wisps)
    glow_ring(c, '#3a0a1c')
    pts = [((8, 30, 1), (66, 12, 0), (70, 24, 1), (4, 52, 0), (60, 4, 0)),
           ((7, 25, 0), (67, 9, 1), (71, 20, 0), (3, 46, 1), (58, 2, 1)),
           ((66, 12, 1), (70, 26, 0), (54, 2, 0), (-12, 22, 1), (-14, 64, 0))][f]
    specks(c, pts, TRUNE)
    return shifted(c, -1), (W, H)


# ================================================================ export

BOSSES = {
    'boss_crypt_archlich': crypt_archlich,
    'boss_rotting_dryad': rotting_dryad,
    'boss_magma_colossus': magma_colossus,
    'boss_frost_wyrm': frost_wyrm,
    'boss_obsidian_tyrant': obsidian_tyrant,
}


def frames(fn):
    return frames_boxed(fn, lambda c: reduce_colors(c, MAX_COLORS))


def build():
    out = {}
    for name, fn in BOSSES.items():
        a, b, k = [cv for cv, _ in frames(fn)]
        out[name] = (a, {})
        out[name + '_b'] = (b, {})
        out[name + '_atk'] = (k, {})
    return out
