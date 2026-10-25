"""Boss des mondes 7 (Marais putride) et 8 (Îles célestes).

  Monde 7
    mini_toad_king        Roi crapaud couronné (étape 5)
    mid_hydra             Hydre des marais à trois têtes (étape 10)
    hard_plague_doctor    Médecin de la peste (étape 15)
    boss_swamp_behemoth   Béhémoth des marais (étape 20, méga boss)
  Monde 8
    mini_harpy_queen      Reine harpie, volante (étape 5)
    mid_thunder_griffin   Griffon du tonnerre (étape 10)
    hard_storm_valkyrie   Valkyrie de la tempête (étape 15)
    boss_sky_titan        Titan céleste (étape 20, méga boss)

Chaque boss : <nom> (repos), <nom>_b (marche / respiration / battement d'ailes), <nom>_atk (attaque),
trois images sur exactement le même canvas. Tournés vers la GAUCHE, pieds sur la dernière ligne
(sauf volants). Chibi 16 bits, lumière en haut à gauche, contour '#1a1226'. Module autonome, sans aléa.
"""
import math

from bosses_hard import (Layer, stamp, mask_of, shade, spoly, ball, tube, horn, arc_fx, lens, glow_ring,
                         dots, sparkle, finalize, clipped, flame_tongue, OUT, WHITE)

GOLD = ['#6a3414', '#b0661a', '#e0a630', '#ffd86a', '#fff6c8']


def dkr(R):
    """Plan arrière : décale la rampe d'un cran vers le sombre (aucune couleur nouvelle)."""
    return [R[0]] + list(R[:-1])


def put_behind(c, t):
    """Colle t uniquement là où c est vide (effets derrière la silhouette)."""
    for y in range(t.h):
        for x in range(t.w):
            if t.px[y][x] is not None and c.px[y][x] is None:
                c.px[y][x] = t.px[y][x]


def bolt(c, pts, R, width=1):
    """Éclair en zigzag : cœur blanc, halo coloré (R : sombre -> clair, 4 tons)."""
    t = Layer(c.lw, c.lh)
    for i in range(len(pts) - 1):
        (x0, y0), (x1, y1) = pts[i], pts[i + 1]
        t.line(x0, y0, x1, y1, R[1], width=width + 2)
    for i in range(len(pts) - 1):
        (x0, y0), (x1, y1) = pts[i], pts[i + 1]
        t.line(x0, y0, x1, y1, R[2], width=width + 1 if width > 1 else 1)
        t.line(x0, y0, x1, y1, R[3])
    for y in range(t.h):
        for x in range(t.w):
            if t.px[y][x] is not None:
                c.px[y][x] = t.px[y][x]


def zig(x0, y0, x1, y1, n, amp, phase=0):
    """Points d'un zigzag de (x0,y0) à (x1,y1)."""
    dx, dy = x1 - x0, y1 - y0
    ln = math.hypot(dx, dy) or 1
    nx, ny = -dy / ln, dx / ln
    out = [(x0, y0)]
    for i in range(1, n):
        u = i / n
        s = amp * (1 if (i + phase) % 2 else -1) * (0.6 + 0.4 * math.sin(i * 2.3 + phase))
        out.append((x0 + dx * u + nx * s, y0 + dy * u + ny * s))
    out.append((x1, y1))
    return out


def mushroom(c, x, y, r, cap, stem='#e8dcc0', spots='#fff6e8', lean=0):
    """Petit champignon (pied puis chapeau), base en (x, y)."""
    t = Layer(c.lw, c.lh)
    t.rect(int(x), int(y - r), 2 if r > 2 else 1, int(r) + 1, stem)
    t.set(int(x) + (1 if r > 2 else 0), int(y), mix_col(stem))
    ball(t, x + 0.5 + lean, y - r - 0.5, r + 0.6, r * 0.62 + 0.4, cap)
    t.set(int(x + lean - r * 0.3), int(y - r - r * 0.35), spots)
    if r > 2:
        t.set(int(x + lean + r * 0.45), int(y - r - 0.6), spots)
    stamp(c, t)


def mix_col(col):
    from lib import mix
    return mix(col, '#1a1226', 0.35)


def drip(c, x, y0, n, R):
    """Coulure verticale qui s'affine, goutte au bout."""
    for k in range(n):
        c.set(x, y0 + k, R[1] if k < n - 1 else R[2])
    c.set(x, y0 + n, R[0])


# ======================================================================= MONDE 7 : MARAIS PUTRIDE

TOAD = ['#16301e', '#2a5426', '#46802e', '#72ac3c', '#a8d25a']
BELLY = ['#5e5a2c', '#9a924a', '#c8be74', '#ebe2a6', '#fffbd8']
WARTP = ['#3a1e4a', '#6a3a7a', '#9a62a8']
ROYAL = ['#1e0a2c', '#3a144e', '#5e2676', '#8640a0', '#b26ac6']
ERMINE = ['#8a8098', '#c8c0d0', '#f2eef6', '#ffffff']
TONGUE = ['#4a0e24', '#9a2446', '#e0587a', '#ff9cb4', '#ffe0ea']
TEYE = ['#8a3e0e', '#e8a42a', '#ffe486']
TOXIC = ['#1a4a18', '#3e8a24', '#7ed03a', '#c8f67a', '#f4ffd0']

TKW, TKH = 68, 48


def toad_eye(c, cx, cy, r, angry=True):
    """Gros œil doré à pupille horizontale, paupière lourde en biais (colère)."""
    for y in range(int(cy - r - 1), int(cy + r + 2)):
        for x in range(int(cx - r - 1), int(cx + r + 2)):
            d = math.hypot(x + 0.5 - cx, (y + 0.5 - cy) * 1.1)
            if d > r:
                continue
            up = (y + 0.5 - cy) < 0
            c.set(x, y, TEYE[0] if d > r - 0.9 else (TEYE[2] if up and x < cx else TEYE[1]))
    py = int(round(cy))
    c.rect(int(cx - r * 0.75), py - 1 + 1, int(r * 1.5) + 1, 2, OUT)
    c.set(int(cx - r * 0.75) - 0, py - 1, WHITE)
    c.set(int(cx - r * 0.75) + 1, py - 1, WHITE)
    if angry:
        # paupière : bord haut couvert, plus bas vers l'avant (gauche)
        for x in range(int(cx - r - 1), int(cx + r + 2)):
            u = (x - (cx - r)) / (2 * r)
            ylid = cy - r + 1.2 - u * 1.4
            for y in range(int(cy - r - 1), int(ylid) + 1):
                if c.get(x, y) in TEYE:
                    c.set(x, y, TOAD[2])
            if c.get(x, int(ylid) + 1) in TEYE:
                c.set(x, int(ylid) + 1, OUT)


def toad_king(f):
    W, H = TKW, TKH
    G = H - 2
    new = lambda: Layer(W, H)
    c = new()
    atk = f == 2
    by = 1 if f == 1 else 0           # écrasement / respiration
    X = 10

    # ---- cape royale (derrière)
    t = new()
    sw = 2 if f == 1 else 0
    cm = mask_of(lambda m: m.poly([(X + 32, 13 + by), (X + 46, 14 + by), (X + 54, 24), (X + 55 + sw, 37), (X + 54 + sw, G - 1),
                                   (X + 50, G - 3), (X + 47 + sw, G), (X + 42, G - 4), (X + 38, G - 6)], '#000'))
    shade(t, cm, ROYAL, contrast=0.45, bias=-0.05)
    # plis
    t.line(X + 47, 18 + by, X + 52 + sw, G - 4, ROYAL[1])
    t.line(X + 42, 18 + by, X + 46, G - 5, ROYAL[2])
    # bordure d'or
    for (x, y) in cm:
        if (x + 1, y) not in cm and y > 20:
            t.set(x, y, GOLD[2])
            t.set(x - 1, y, GOLD[1])
    stamp(c, t)

    # ---- patte arrière lointaine (cuisse repliée) + pied palmé
    t = new()
    ball(t, X + 46, 37 + by, 9, 8 - by * 0.5, dkr(TOAD))
    stamp(c, t)
    t = new()
    fx = X + 42 + (1 if f == 1 else 0)
    spoly(t, [(fx - 2, G - 3), (fx + 10, G - 4), (fx + 13, G), (fx - 4, G)], dkr(TOAD), contrast=0.3)
    for k in (0, 5, 10):
        t.set(fx - 3 + k, G, TOAD[0])
    stamp(c, t)

    # ---- bras lointain
    t = new()
    tube(t, [(X + 34, 31 + by), (X + 34, 38 + by), (X + 32, G - 1)], [3.4, 3.0, 2.6], dkr(TOAD), bias=-0.1)
    stamp(c, t)
    t = new()
    spoly(t, [(X + 28, G - 2), (X + 36, G - 2), (X + 37, G), (X + 27, G)], dkr(TOAD), contrast=0.3)
    stamp(c, t)

    # ---- corps énorme
    hy = 0 if not atk else -2
    t = new()
    bm = mask_of(lambda m: (m.ellipse(X + 34, 31 + by, 19 + by * 0.6, 14 - by * 0.6, '#000'),
                            m.ellipse(X + 22, 21 + by + hy, 15, 11, '#000')))
    shade(t, bm, TOAD, contrast=0.5)
    # ventre clair
    vm = mask_of(lambda m: m.ellipse(X + 24, 35 + by, 13, 9.5, '#000'))
    vm &= bm
    shade(t, vm, BELLY, contrast=0.45, bias=0.05, edge=False)
    for (x, y) in vm:
        if (x - 1, y) not in vm and (x - 1, y) in bm:
            t.set(x, y, BELLY[1])
    # plis de gorge
    for k in range(3):
        y = 32 + by + k * 3
        t.line(X + 14 + k, y, X + 22 + k, y + 1, BELLY[1])
    # pustules du dos (violettes) et verrues claires
    for (x, y, r) in ((X + 40, 22, 1.6), (X + 47, 27, 1.8), (X + 36, 18, 1.2), (X + 50, 34, 1.4), (X + 43, 32, 1.2),
                      (X + 31, 15, 1.0)):
        t.ellipse(x, y + by, r, r, WARTP[1], only_inside=True)
        t.setf(x - 0.6, y + by - 0.6, WARTP[2])
    for (x, y) in ((X + 33, 24), (X + 39, 27), (X + 45, 21), (X + 52, 29), (X + 28, 17)):
        t.setf(x, y + by, TOAD[4])
        t.setf(x + 1, y + by + 1, TOAD[1])
    stamp(c, t)

    # ---- bouche immense
    my = 26 + by + hy
    if atk:
        # gueule grande ouverte
        t = new()
        t.poly([(X + 7, my - 1), (X + 30, my + 1), (X + 26, my + 7), (X + 14, my + 9), (X + 8, my + 4)], '#3a0a1e')
        t.poly([(X + 10, my + 3), (X + 25, my + 3), (X + 22, my + 7), (X + 14, my + 8)], TONGUE[1])
        stamp(c, t)
        # langue qui fuse vers la gauche
        t = new()
        tube(t, [(X + 14, my + 4), (X + 6, my + 3), (X - 1, my), (X - 4, my - 3)], [3.0, 2.6, 2.2, 2.0], TONGUE, contrast=0.5)
        ball(t, X - 6, my - 3.5, 3.8, 3.4, TONGUE)
        stamp(c, t)
        c.set(X - 7, my - 5, TONGUE[4]); c.set(X - 8, my - 4, TONGUE[4])
        # mâchoire basse (lèvre)
        c.line(X + 8, my + 4, X + 14, my + 9, TOAD[1])
    else:
        c.line(X + 7, my - 1, X + 13, my + 1, OUT)
        c.line(X + 13, my + 1, X + 26, my + 1, OUT)
        c.line(X + 26, my + 1, X + 32, my - 1, OUT)
        c.line(X + 9, my, X + 25, my + 2, '#3a0a1e')
        c.line(X + 9, my - 1, X + 28, my - 1, TOAD[4])
        c.line(X + 7, my, X + 6, my + 2, OUT)            # coin tombant : air bougon
        c.line(X + 10, my + 3, X + 22, my + 3, BELLY[1])
    # narines
    c.set(X + 9, my - 6, OUT); c.set(X + 12, my - 7, OUT)

    # ---- sac vocal gonflé (respiration)
    if f == 1:
        t = new()
        ball(t, X + 17, my + 7, 7.5, 5.2, ['#8a6a4a', '#c8a07a', '#efcaa2', '#ffe6cc', '#fff8ee'])
        stamp(c, t)
        c.set(X + 13, my + 5, WHITE)

    # ---- yeux globuleux (paupière lourde) puis couronne
    for (ex, ey, r, far) in ((X + 26, 9 + by + hy, 5.2, True), (X + 14, 11 + by + hy, 6.3, False)):
        t = new()
        ball(t, ex, ey, r + 0.8, r, dkr(TOAD) if far else TOAD)
        stamp(c, t)
        toad_eye(c, ex - 0.9, ey + 0.5, r - 1.2, angry=not atk)
    # couronne (posée de travers entre les yeux)
    t = new()
    cx0, cy0 = X + 29, 5 + by + hy
    pts = [(cx0, cy0 + 6), (cx0 - 1, cy0 - 1), (cx0 + 3, cy0 + 3), (cx0 + 5, cy0 - 3), (cx0 + 8, cy0 + 2),
           (cx0 + 11, cy0 - 2), (cx0 + 12, cy0 + 5), (cx0 + 11, cy0 + 8), (cx0 + 1, cy0 + 9)]
    spoly(t, pts, GOLD, contrast=0.5, bias=0.08)
    t.line(cx0, cy0 + 6, cx0 + 12, cy0 + 5, GOLD[4])
    t.line(cx0 + 1, cy0 + 8, cx0 + 11, cy0 + 7, GOLD[1])
    t.set(cx0 + 6, cy0 + 6, '#c02848'); t.set(cx0 + 5, cy0 + 6, '#ff6a7a')
    t.set(cx0 + 2, cy0 + 7, '#2a8ad0'); t.set(cx0 + 10, cy0 + 6, '#3ab06a')
    for px_, py_ in ((cx0 - 1, cy0 - 1), (cx0 + 5, cy0 - 3), (cx0 + 11, cy0 - 2)):
        t.set(px_, py_ - 1, GOLD[4])
    stamp(c, t)

    # ---- bras proche + sceptre (quenouille dorée)
    t = new()
    sx = X + 1
    t.rect(sx, 16 + by, 2, G - 15 - by, GOLD[2])
    t.line(sx, 16 + by, sx, G, GOLD[3])
    t.line(sx + 1, 16 + by, sx + 1, G, GOLD[1])
    ball(t, sx + 1, 12 + by, 3.4, 3.6, ROYAL)
    t.set(sx, 11 + by, ROYAL[4]); t.set(sx - 1, 10 + by, WHITE)
    for k in range(-2, 3):
        t.set(sx + 1 + k, 16 + by, GOLD[3] if k < 1 else GOLD[1])
    stamp(c, t)
    t = new()
    tube(t, [(X + 24, 31 + by), (X + 14, 36 + by), (sx + 3, 33 + by)], [4.0, 3.4, 3.0], TOAD)
    ball(t, sx + 2.5, 33 + by, 3.0, 2.8, TOAD)
    stamp(c, t)
    t = new()
    tube(t, [(X + 22, 36 + by), (X + 20, 41), (X + 18, G - 1)], [3.6, 3.2, 2.8], TOAD)
    spoly(t, [(X + 12, G - 2), (X + 22, G - 2), (X + 23, G), (X + 11, G)], TOAD, contrast=0.3)
    stamp(c, t)
    for k in (0, 4, 8):
        c.set(X + 11 + k, G, TOAD[4]); c.set(X + 12 + k, G - 1, TOAD[3])
    # ---- effets
    if atk:
        for (x, y) in ((X - 4, 14), (X + 2, 30), (X - 6, 34)):
            sparkle(c, x, y + 2, TONGUE[2])
    dots(c, ((X + 56, 8 + by, 2), (X + 4, 4, 1), (X + 52, 4, 3)), lambda k: TOXIC[k])
    return c, (W, H)


# ---------------------------------------------------------------- hydre des marais

HYD = ['#0c2422', '#173f36', '#256446', '#3e8c4e', '#74b862']
HYDF = dkr(HYD)
HBEL = ['#4e4a24', '#8c8044', '#bcae66', '#e2d898', '#fbf6cc']
FRILL = ['#2a0c3c', '#53206c', '#8a3a9a', '#c070c8', '#ecb0ec']
HEYE = ['#c06a0a', '#ffd23a', '#fff6b0']
ACID = ['#1a5a10', '#48a01e', '#9ae034', '#e0ff8a', '#ffffff']

HYW, HYH = 74, 54


def hydra_head(c, new, hx, hy, R, open_=False, big=1.0, frill=FRILL):
    """Tête de serpent (museau à gauche) avec collerette violette."""
    s = big
    # collerette
    t = new()
    for k, (dx, dy) in enumerate(((7, -6), (10, -2), (9, 3))):
        spoly(t, [(hx + 2 * s, hy - 1), (hx + dx * s, hy + dy * s), (hx + 4 * s, hy + 2 + k)], frill, contrast=0.5)
    stamp(c, t)
    t = new()
    ball(t, hx + 1, hy - 0.5, 5 * s, 4.2 * s, R)
    if open_:
        spoly(t, [(hx - 10 * s, hy - 4 * s), (hx - 3, hy - 4.5 * s), (hx + 2, hy - 1), (hx - 9 * s, hy - 1.5)], R, contrast=0.4)
        spoly(t, [(hx - 9 * s, hy + 5 * s), (hx - 3, hy + 1), (hx + 2, hy + 2), (hx - 2, hy + 4.5 * s)], R, contrast=0.4, bias=-0.1)
    else:
        spoly(t, [(hx - 10 * s, hy - 2 * s), (hx - 4, hy - 4.5 * s), (hx + 3, hy - 2), (hx + 3, hy + 3 * s),
                  (hx - 9 * s, hy + 2 * s)], R, contrast=0.4)
    stamp(c, t)
    if open_:
        c.poly([(hx - 9 * s, hy - 1), (hx, hy + 0.5), (hx - 8 * s, hy + 4 * s)], '#3a0a1e')
        c.line(hx - 8 * s, hy + 1, hx - 1, hy + 1, '#a02848')
        c.set(hx - 8 * s, hy - 1, WHITE); c.set(hx - 5 * s, hy - 0.5, WHITE)
        c.set(hx - 7 * s, hy + 3 * s, WHITE)
    else:
        c.line(hx - 9 * s, hy + 0.5, hx + 1, hy + 0.5, OUT)
        c.set(hx - 7 * s, hy + 1.5, WHITE)
        c.set(hx - 9 * s, hy + 1.5, R[3])
    # narine + œil luisant sous une arcade
    c.set(hx - 9 * s, hy - 2 * s, OUT)
    ex, ey = int(hx - 2 * s), int(hy - 3 * s)
    c.rect(ex, ey, 3, 2, HEYE[1])
    c.set(ex, ey, HEYE[2]); c.set(ex + 2, ey + 1, HEYE[0])
    c.set(ex + 1, ey, OUT); c.set(ex + 1, ey + 1, OUT)
    c.line(ex - 1, ey - 1, ex + 3, ey - 1, OUT)
    c.set(ex + 4, ey - 2, OUT)
    c.line(hx - 6 * s, hy - 3.5 * s, hx - 3 * s, hy - 4.2 * s, R[4])


def hydra(f):
    W, H = HYW, HYH
    G = H - 2
    new = lambda: Layer(W, H)
    c = new()
    atk = f == 2
    by = 1 if f == 1 else 0
    X = 8

    # ---- queue (derrière, vers la droite)
    t = new()
    tw = 2 if f == 1 else 0
    tube(t, [(X + 50, 38 + by), (X + 58, 40), (X + 61, 36 - tw), (X + 62, 30 - tw)], [6, 4.5, 3, 1.2], HYDF)
    stamp(c, t)

    # ---- pattes lointaines
    lp = [(X + 50, 0), (X + 30, 1)] if f != 1 else [(X + 50, 1), (X + 30, 0)]
    for (lx, k) in lp:
        t = new()
        dx = 2 if k else -1
        tube(t, [(lx, 40 + by), (lx + dx, 47), (lx + dx - 1, G - 1)], [3.6, 3.0, 2.6], dkr(HYDF))
        spoly(t, [(lx + dx - 5, G - 2), (lx + dx + 2, G - 2), (lx + dx + 3, G), (lx + dx - 6, G)], dkr(HYDF))
        stamp(c, t)

    # ---- nuque lointaine (tête 3, haute, derrière)
    if atk:
        h3 = (X + 22, 8)
        n3 = [(X + 44, 30), (X + 42, 20), (X + 34, 11), (h3[0] + 3, h3[1])]
    else:
        h3 = (X + 30 + (2 if f == 1 else 0), 6 + by)
        n3 = [(X + 44, 30 + by), (X + 45, 20), (X + 40, 10 + by), (h3[0] + 3, h3[1])]
    t = new()
    tube(t, n3, [5, 4.2, 3.6, 3.4], HYDF, contrast=0.4)
    stamp(c, t)
    hydra_head(c, new, h3[0], h3[1], HYDF, open_=atk, big=0.9, frill=dkr(FRILL))

    # ---- corps massif
    t = new()
    bm = mask_of(lambda m: (m.ellipse(X + 40, 37 + by, 16, 10, '#000'), m.ellipse(X + 30, 39 + by, 10, 7, '#000')))
    shade(t, bm, HYD, contrast=0.45)
    vm = {(x, y) for (x, y) in bm if y > 40 + by and x < X + 50}
    shade(t, vm, HBEL, contrast=0.3, edge=False)
    for (x, y) in vm:
        if (y - by) % 2 == 0 and (x + y) % 4 == 0:
            t.set(x, y, HBEL[1])
    # écailles et épines dorsales
    for (x, y) in bm:
        if y < 38 + by and (x + (y // 2) * 2) % 5 == 0 and y % 2 == 0 and t.px[y + 40][x + 40] in (HYD[2], HYD[3]):
            t.set(x, y, HYD[1])
    for k, x in enumerate(range(X + 34, X + 56, 5)):
        yy = 28 + by + abs(x - (X + 42)) * 0.25
        spoly(t, [(x - 2, yy + 1), (x + 1, yy - 4), (x + 2, yy + 1)], FRILL, contrast=0.6)
    # mousse et lentilles d'eau sur le dos
    for x in range(X + 30, X + 52):
        yy = int(28 + by + ((x - X - 41) / 16) ** 2 * 9) + 1
        if (x * 7) % 5 < 3:
            t.setf(x, yy, TOXIC[2]); t.setf(x, yy + 1, TOXIC[1])
    stamp(c, t)

    # ---- nuque du milieu (tête 2)
    if atk:
        h2 = (X + 9, 24)
        n2 = [(X + 32, 34), (X + 24, 29), (X + 16, 26), (h2[0] + 3, h2[1])]
    else:
        h2 = (X + 14 - (1 if f == 1 else 0), 15 - by)
        n2 = [(X + 36, 33 + by), (X + 30, 24), (X + 22, 18 - by), (h2[0] + 3, h2[1])]
    t = new()
    tube(t, n2, [5.4, 4.6, 3.8, 3.4], HYD, contrast=0.4)
    nm2 = t
    stamp(c, t)
    hydra_head(c, new, h2[0], h2[1], HYD, open_=atk, big=1.05)

    # ---- pattes proches
    for (lx, k) in ([(X + 46, 1), (X + 26, 0)] if f != 1 else [(X + 46, 0), (X + 26, 1)]):
        t = new()
        dx = 2 if k else -2
        tube(t, [(lx, 41 + by), (lx + dx, 47), (lx + dx - 1, G - 1)], [4.2, 3.4, 3.0], HYD)
        spoly(t, [(lx + dx - 6, G - 2), (lx + dx + 2, G - 2), (lx + dx + 3, G), (lx + dx - 7, G)], HYD)
        stamp(c, t)
        for q in range(3):
            c.set(lx + dx - 7 + q * 3, G, HBEL[3])

    # ---- nuque basse (tête 1, la plus proche)
    if atk:
        h1 = (X + 6, 38)
        n1 = [(X + 30, 40), (X + 22, 42), (X + 14, 41), (h1[0] + 3, h1[1])]
    else:
        h1 = (X + 6, 27 + by * 2)
        n1 = [(X + 30, 38 + by), (X + 20, 37), (X + 12, 33 + by), (h1[0] + 3, h1[1])]
    t = new()
    tube(t, n1, [5.4, 4.6, 3.8, 3.4], HYD, contrast=0.4)
    # ventre annelé de la nuque
    stamp(c, t)
    hydra_head(c, new, h1[0], h1[1], HYD, open_=atk, big=1.0)

    # ---- effets
    if atk:
        # crachat d'acide de la tête du milieu
        t = new()
        for k in range(5):
            u = k / 4
            x = h2[0] - 11 - u * 5
            y = h2[1] + 2 + u * u * 6
            ball(t, x, y, 2.6 - u, 2.2 - u * 0.8, ACID[1:])
        stamp(c, t)
        for (x, y) in ((X - 5, 34), (X - 3, 19), (X - 7, 25)):
            sparkle(c, x, y, ACID[2], ACID[3])
    dots(c, ((X + 62, 18 + by, 2), (X + 56, 10, 1), (X + 2, 6, 2), (X + 64, 46, 1)), lambda k: TOXIC[k])
    return c, (W, H)


# ---------------------------------------------------------------- médecin de la peste

COATK = ['#0c0912', '#1a1522', '#2a2434', '#40384c', '#5c5268']
BMASK = ['#4a3e48', '#8a7c72', '#c2b498', '#e6dcc0', '#fcf8ea']
PLEATH = ['#2a1810', '#4a2c1c', '#74482c', '#a07044', '#c89c66']
GLASS = ['#0e3a1e', '#2a8a2e', '#6ee03a', '#c8ff7a', '#f4ffe0']
FUME = ['#2a4a20', '#3e6e2a', '#5e9a34', '#8ec84a']

PDW, PDH = 62, 60


def flask(c, x, y, glow=GLASS, tilt=0):
    """Fiole ronde au liquide toxique (centre de la panse en x, y)."""
    t = Layer(c.lw, c.lh)
    t.rect(int(x - 1 + tilt), int(y - 6), 3, 3, '#a8c8c0')
    t.set(int(x - 1 + tilt), int(y - 6), '#e8fff8')
    t.rect(int(x - 1 + tilt * 1.5), int(y - 8), 3, 2, PLEATH[3])        # bouchon
    t.set(int(x + 1 + tilt * 1.5), int(y - 7), PLEATH[1])
    ball(t, x, y, 4.2, 3.9, glow)
    # verre : haut vide, reflet
    for xx in range(int(x - 4), int(x + 5)):
        t.setf(xx, int(y - 3), '#9ac8b8')
    t.set(int(x - 2), int(y - 2), WHITE); t.set(int(x - 3), int(y - 1), glow[4])
    t.set(int(x + 1), int(y + 1), glow[4]); t.set(int(x - 1), int(y + 2), glow[3])
    stamp(c, t)


def puff(c, cx, cy, r, R, n=5, phase=0.0):
    """Nuage toxique : grappe de boules ombrées."""
    t = Layer(c.lw, c.lh)
    for k in range(n):
        a = k / n * math.tau + phase
        rr = r * (0.55 + 0.25 * ((k * 7) % 3) / 2)
        ball(t, cx + math.cos(a) * r * 0.75, cy + math.sin(a) * r * 0.45, rr, rr * 0.85, R)
    ball(t, cx, cy, r * 0.8, r * 0.7, R)
    stamp(c, t)


def plague_doctor(f):
    W, H = PDW, PDH
    G = H - 2
    new = lambda: Layer(W, H)
    c = new()
    atk = f == 2
    by = 1 if f == 1 else 0
    X = 6

    # ---- fumées vertes derrière (aura)
    t = new()
    for k, (x, hgt) in enumerate(((X + 16, 10), (X + 30, 14), (X + 44, 9))):
        flame_tongue(t, x, G, 3.2, hgt + (2 if (k + f) % 2 else 0), 2.0, f * 1.4 + k, [FUME[0], FUME[0], FUME[1], FUME[1], FUME[2]])
    stamp(c, t, None)

    # ---- canne (main lointaine), derrière la cape
    t = new()
    kx = X + 41 if not atk else X + 43
    t.rect(kx, 21 + by, 2, G - 20 - by, PLEATH[1])
    t.line(kx, 21 + by, kx, G, PLEATH[3])
    ball(t, kx + 1, 19 + by, 2.6, 2.4, GOLD)
    t.set(kx, 18 + by, GOLD[4])
    stamp(c, t)

    # ---- cape noire (flotte en arrière)
    t = new()
    sw = 3 if f == 1 else (2 if atk else 0)
    cm = mask_of(lambda m: m.poly([(X + 20, 20 + by), (X + 36, 20 + by), (X + 44 + sw, 32), (X + 50 + sw, 46),
                                   (X + 50 + sw, G - 3), (X + 46 + sw, G - 5), (X + 43, G), (X + 39, G - 4), (X + 35, G - 1),
                                   (X + 30, G - 6), (X + 16, G - 6)], '#000'))
    shade(t, cm, COATK, contrast=0.45, bias=-0.05)
    for k in range(3):
        t.line(X + 34 + k * 4, 26 + by, X + 38 + k * 4 + sw, G - 6, COATK[0] if k % 2 else COATK[3])
    stamp(c, t)

    # ---- bottes
    lp = ((X + 20, X + 30) if f != 1 else (X + 23, X + 27)) if not atk else (X + 17, X + 32)
    for i, bx in enumerate(lp):
        t = new()
        R = PLEATH if i == 0 else dkr(PLEATH)
        spoly(t, [(bx - 1, G - 7), (bx + 4, G - 7), (bx + 4, G), (bx - 4, G), (bx - 4, G - 2), (bx - 1, G - 3)], R, contrast=0.5)
        t.line(bx - 4, G, bx + 4, G, R[0])
        t.line(bx - 1, G - 6, bx + 4, G - 6, R[3])
        stamp(c, t)

    # ---- long manteau ciré
    t = new()
    hem = G - 6
    km = mask_of(lambda m: m.poly([(X + 22, 21 + by), (X + 35, 21 + by), (X + 38, 34 + by), (X + 40, hem - 1),
                                   (X + 36, hem + 1 - by), (X + 31, hem), (X + 26, hem + 1 - by), (X + 20, hem), (X + 15, hem - 1),
                                   (X + 18, 34 + by)], '#000'))
    shade(t, km, COATK, contrast=0.5, bias=0.06)
    # boutonnière
    for y in range(26 + by, hem - 2, 3):
        t.set(X + 21 + (y - 26) * 0.12, y, GOLD[2])
    t.line(X + 21, 25 + by, X + 18, hem - 1, COATK[4])
    # ceinture + fioles
    for x in range(X + 16, X + 40):
        t.setf(x, 35 + by, PLEATH[2]); t.setf(x, 36 + by, PLEATH[1])
    t.rect(X + 20, 34 + by, 3, 3, GOLD[2]); t.set(X + 20, 34 + by, GOLD[4])
    for (vx, col) in ((X + 27, GLASS[2]), (X + 31, '#b05ad8'), (X + 35, '#e0a020')):
        t.rect(vx, 37 + by, 2, 4, col)
        t.set(vx, 37 + by, WHITE)
        t.set(vx, 36 + by, PLEATH[3]); t.set(vx + 1, 36 + by, PLEATH[3])
    stamp(c, t)

    # ---- col / pèlerine
    t = new()
    pm = mask_of(lambda m: m.poly([(X + 18, 21 + by), (X + 38, 20 + by), (X + 41, 28 + by), (X + 37, 30 + by), (X + 33, 28 + by),
                                   (X + 28, 31 + by), (X + 23, 28 + by), (X + 17, 30 + by)], '#000'))
    shade(t, pm, COATK, contrast=0.4, bias=0.15)
    stamp(c, t)

    # ---- tête : capuche, masque à bec, chapeau
    hx, hy = X + 29, 15 + by
    if atk:
        hx -= 1
    t = new()
    ball(t, hx + 1, hy + 1, 7, 7, COATK)                         # capuche
    stamp(c, t)
    t = new()
    ball(t, hx - 2, hy + 2, 5.4, 5.2, BMASK)                     # masque
    # bec long et courbe vers le bas-gauche
    tip = (hx - 21, hy + 11) if not atk else (hx - 22, hy + 8)
    bm = mask_of(lambda m: m.poly([(hx - 5, hy - 1), (hx - 12, hy + 1), (hx - 17, hy + 4), tip,
                                   (hx - 16, hy + 8), (hx - 10, hy + 7), (hx - 4, hy + 6)], '#000'))
    shade(t, bm, BMASK, contrast=0.5, bias=0.05)
    stamp(c, t)
    # coutures + sangle de cuir du bec
    for k in range(4):
        x = hx - 8 - k * 3
        c.set(x, hy + 2 + k * 1.2, BMASK[1])
        c.set(x, hy + 3 + k * 1.2 + 0.6, BMASK[1])
    c.line(hx - 15, hy + 7, hx - 6, hy + 5.5, BMASK[1])
    c.line(hx - 7, hy - 1, hx - 7, hy + 6, PLEATH[2])
    c.line(hx - 6, hy - 1, hx - 6, hy + 6, PLEATH[1])
    # lunette ronde luisante
    ex, ey = hx - 3, hy + 1
    c.ellipse(ex, ey, 2.9, 2.9, GOLD[1])
    c.ellipse(ex, ey, 2.1, 2.1, GLASS[2])
    c.set(ex - 1, ey - 1, WHITE); c.set(ex, ey - 1, GLASS[4]); c.set(ex - 1, ey, GLASS[3])
    c.set(ex + 1, ey + 1, GLASS[1])
    # chapeau à large bord
    t = new()
    brim = mask_of(lambda m: m.ellipse(hx + 1, hy - 4, 13, 2.6, '#000'))
    shade(t, brim, COATK, contrast=0.5, bias=0.1)
    crm = mask_of(lambda m: m.poly([(hx - 6, hy - 4), (hx - 5, hy - 13), (hx + 7, hy - 14), (hx + 8, hy - 4)], '#000'))
    shade(t, crm, COATK, contrast=0.5, bias=0.1)
    for x in range(hx - 6, hx + 9):
        t.setf(x, hy - 6, ROYAL[2]); t.setf(x, hy - 7, ROYAL[3])
    t.rect(hx - 3, hy - 7, 2, 2, GOLD[3])
    t.line(hx - 4, hy - 13, hx + 6, hy - 14, COATK[4])
    stamp(c, t)

    # ---- bras proche (gant de cuir) + fiole
    t = new()
    if atk:
        arm = [(X + 24, 24), (X + 16, 21), (X + 9, 17)]
        hand = (X + 8, 16)
    else:
        arm = [(X + 24, 24 + by), (X + 19, 31 + by), (X + 13, 34 + by)]
        hand = (X + 12, 34 + by)
    tube(t, arm, [3.6, 3.2, 2.8], COATK, bias=0.08)
    stamp(c, t)
    t = new()
    ball(t, hand[0], hand[1], 2.6, 2.4, PLEATH)
    stamp(c, t)
    if atk:
        # fiole lancée + traînée + explosion toxique au sol
        flask(c, X + 1, 30, tilt=-1)
        for k in range(4):
            c.set(X + 4 - k * 0.3, 25 - k * 2, GLASS[2] if k % 2 else GLASS[3])
        puff(c, X + 4, G - 5, 7, FUME[:3] + [GLASS[2], GLASS[3]], n=6, phase=0.4)
        puff(c, X + 0, G - 2, 4.5, FUME[:3] + [GLASS[2], GLASS[3]], n=5, phase=1.1)
        for (x, y) in ((X - 4, G - 13), (X + 12, G - 15), (X - 2, G - 18), (X + 15, G - 6)):
            sparkle(c, x, y, GLASS[2], GLASS[3])
        # crâne de vapeur
        sx, sy = X + 4, G - 6
        c.set(sx - 2, sy, OUT); c.set(sx - 1, sy, OUT); c.set(sx + 1, sy, OUT); c.set(sx + 2, sy, OUT)
        c.set(sx, sy + 2, OUT)
        c.line(sx - 2, sy + 3, sx + 2, sy + 3, FUME[1])
    else:
        flask(c, hand[0] - 2, hand[1] + 4 + (1 if f == 1 else 0))
        # bulles qui s'échappent
        for k, (dx, dy) in enumerate(((0, -12), (-2, -16), (1, -20)) if f != 1 else ((-1, -13), (1, -17), (-1, -21))):
            x, y = hand[0] - 2 + dx, hand[1] + 4 + dy
            c.set(x, y, GLASS[3] if k % 2 else GLASS[2])
    glow_ring(c, GLASS[1], GLASS[2], every=2)
    dots(c, ((X + 48, 10 + by, 2), (X + 2, 8, 3), (X + 46, 30, 1), (X + 0, 44 - by, 2)), lambda k: GLASS[k])
    return c, (W, H)


# ---------------------------------------------------------------- béhémoth des marais (méga boss)

MUD = ['#170f0c', '#2a1c14', '#45301f', '#664a2e', '#8c6c42']
MUDF = dkr(MUD)
BMOSS = ['#0f2a14', '#1e4a1c', '#346e24', '#55962e', '#8ac446']
ROOT = ['#1c1418', '#36282a', '#56423a', '#7a6250', '#a08868']
CAPR = ['#3a0a2a', '#6e1a48', '#a8306a', '#e05a8c', '#ffb0cc']
CAPV = ['#24103e', '#45206c', '#6e3aa0', '#a068d0', '#d6aaf4']
BEYE = ['#4a8a10', '#c8f030', '#f8ffc0']
FANG = ['#6a5e4a', '#b4a684', '#e6dcbc', '#fffbea']
SWAMP = ['#0e1e18', '#183428', '#24503a', '#3a7048']

BHW, BHH = 76, 70


def branch(c, pts, w, R=ROOT):
    t = Layer(c.lw, c.lh)
    tube(t, pts, w, R, contrast=0.45)
    stamp(c, t)


def behemoth(f):
    W, H = BHW, BHH
    G = H - 2
    new = lambda: Layer(W, H)
    c = new()
    atk = f == 2
    by = 1 if f == 1 else 0
    X = 4

    # ---- flaque de marais sous les pieds
    t = new()
    t.ellipse(X + 36, G - 0.5, 32, 2.6, SWAMP[1])
    t.ellipse(X + 34, G - 1, 26, 1.6, SWAMP[2])
    t.line(X + 16, G - 1, X + 26, G - 1, SWAMP[3])
    stamp(c, t, None)

    # ---- spores / miasme derrière
    t = new()
    for k, (x, hgt) in enumerate(((X + 30, 16), (X + 46, 22), (X + 60, 14))):
        flame_tongue(t, x, G - 2, 4, hgt + (3 if (k + f) % 2 else 0), 3, f * 1.2 + k, [FUME[0], FUME[0], FUME[1], FUME[1], FUME[2]])
    stamp(c, t, None)

    # ---- branches mortes sur le dos (silhouette)
    branch(c, [(X + 44, 18 + by), (X + 48, 8 + by), (X + 47, 1 + by)], [3.0, 2.0, 0.8])
    branch(c, [(X + 48, 9 + by), (X + 53, 5 + by), (X + 56, 6 + by)], [1.4, 1.0, 0.5])
    branch(c, [(X + 54, 22 + by), (X + 61, 13 + by), (X + 66, 11 + by)], [2.6, 1.8, 0.6])
    branch(c, [(X + 34, 14 + by), (X + 33, 6 + by), (X + 29, 2 + by)], [2.4, 1.6, 0.6])

    # ---- bras lointain (appui derrière)
    t = new()
    if atk:
        arm = [(X + 54, 28), (X + 60, 40), (X + 62, 52)]
    else:
        arm = [(X + 54, 28 + by), (X + 61, 40 + by), (X + 62, 54)]
    tube(t, arm, [7, 6, 5.4], MUDF, bias=-0.1)
    ball(t, arm[-1][0], arm[-1][1] + 3, 5.5, 5, MUDF)
    stamp(c, t)

    # ---- jambes trapues
    lp = ((X + 34, X + 50) if f != 1 else (X + 32, X + 52))
    if atk:
        lp = (X + 30, X + 52)
    for i, lx in enumerate((lp[1], lp[0])):
        t = new()
        R = MUDF if i == 0 else MUD
        tube(t, [(lx + 2, 46 + by), (lx, G - 4)], [7, 6.4], R)
        spoly(t, [(lx - 8, G - 5), (lx + 6, G - 6), (lx + 8, G), (lx - 9, G)], R, contrast=0.45)
        stamp(c, t)
        for k in range(3):
            c.set(lx - 8 + k * 4, G, FANG[2]); c.set(lx - 8 + k * 4, G - 1, FANG[1])

    # ---- torse colossal voûté
    t = new()
    tm = mask_of(lambda m: (m.ellipse(X + 42, 32 + by, 22, 17, '#000'), m.ellipse(X + 38, 44 + by, 15, 9, '#000')))
    shade(t, tm, MUD, contrast=0.45)
    # texture de boue (craquelures + cailloux)
    for (x, y) in tm:
        if (x * 7 + y * 13) % 23 == 0:
            t.set(x, y, MUD[1]); t.setf(x + 1, y, MUD[3])
    for (x0, y0, x1, y1) in ((X + 36, 36, X + 41, 42), (X + 50, 30, X + 54, 38), (X + 28, 44, X + 32, 48)):
        t.line(x0, y0 + by, x1, y1 + by, MUD[1])
    # cœur toxique qui pulse dans la poitrine
    t.ellipse(X + 34, 40 + by, 3.6, 3.2, BEYE[0], only_inside=True)
    t.ellipse(X + 34, 40 + by, 2.2, 2.0, BEYE[1], only_inside=True)
    t.set(X + 33, 39 + by, BEYE[2])
    for (dx, dy) in ((-4, -3), (3, -4), (5, 2), (-3, 4)):
        t.line(X + 34, 40 + by, X + 34 + dx * 1.6, 40 + by + dy * 1.4, BEYE[0])
    stamp(c, t)

    # ---- manteau de mousse sur le dos, coulures
    t = new()
    mm = mask_of(lambda m: m.poly([(X + 24, 22 + by), (X + 30, 15 + by), (X + 42, 13 + by), (X + 56, 16 + by), (X + 64, 26 + by),
                                   (X + 64, 34 + by), (X + 61, 31 + by), (X + 59, 37 + by), (X + 56, 30 + by), (X + 52, 35 + by),
                                   (X + 49, 28 + by), (X + 45, 33 + by), (X + 42, 27 + by), (X + 38, 31 + by), (X + 34, 25 + by),
                                   (X + 30, 29 + by), (X + 27, 25 + by)], '#000'))
    shade(t, mm, BMOSS, contrast=0.5, bias=0.05)
    for (x, y) in mm:
        if (x * 5 + y * 3) % 7 == 0 and (x, y - 1) in mm:
            t.set(x, y, BMOSS[1])
        elif (x * 3 + y * 11) % 13 == 0:
            t.set(x, y, BMOSS[4])
    stamp(c, t)
    for (x, y, n) in ((X + 61, 34, 4), (X + 52, 35, 3), (X + 45, 33, 5), (X + 38, 31, 3)):
        drip(c, x, y + by + 1, n + (1 if f == 1 else 0), BMOSS)

    # ---- champignons sur le dos
    mushroom(c, X + 37, 15 + by, 3, CAPV)
    mushroom(c, X + 52, 15 + by, 4, CAPR, lean=0.5)
    mushroom(c, X + 58, 20 + by, 2, CAPV)
    mushroom(c, X + 44, 13 + by, 2, CAPR)

    # ---- tête enfoncée entre les épaules
    hx, hy = (X + 15, 25 + by) if not atk else (X + 15, 24)
    t = new()
    ball(t, hx + 1, hy, 11, 9.5, MUD)
    # mâchoire inférieure massive (prognathe)
    jaw_open = 5 if atk else 0
    spoly(t, [(hx - 11, hy + 2 + jaw_open), (hx + 6, hy + 2), (hx + 8, hy + 8 + jaw_open * 0.6),
              (hx - 1, hy + 11 + jaw_open), (hx - 10, hy + 9 + jaw_open)], MUD, contrast=0.4, bias=-0.06)
    stamp(c, t)
    if atk:
        c.poly([(hx - 10, hy + 2), (hx + 4, hy + 2.5), (hx - 9, hy + 7)], '#2a0a14')
        c.line(hx - 9, hy + 5, hx, hy + 4, '#6a1a2a')
    else:
        c.line(hx - 10, hy + 3, hx + 4, hy + 3, OUT)
    # crocs : défenses du bas qui montent, crocs du haut
    for (x, h_) in ((hx - 9, 4), (hx - 4, 3), (hx + 1, 2)):
        base = hy + 3 + jaw_open
        for k in range(h_):
            c.set(x, base - k, FANG[3] if k == h_ - 1 else FANG[2])
            c.set(x + 1, base - k + 1, FANG[1])
    for x in (hx - 7, hx - 2):
        c.set(x, hy + 3, FANG[3]); c.set(x, hy + 4, FANG[2])
    # front lourd + mousse sur le crâne
    t = new()
    spoly(t, [(hx - 11, hy - 2), (hx - 6, hy - 7), (hx + 4, hy - 9), (hx + 8, hy - 4), (hx - 2, hy - 3)], BMOSS, contrast=0.5, bias=0.1)
    stamp(c, t)
    # yeux luisants enfoncés
    ex, ey = hx - 8, hy - 2
    for ox_ in (0, 7):
        c.rect(ex + ox_ - 1, ey - 1, 6, 4, OUT)
        c.rect(ex + ox_, ey, 4, 2, BEYE[1])
        c.set(ex + ox_, ey, BEYE[2]); c.set(ex + ox_ + 1, ey, BEYE[2])
        c.set(ex + ox_ + 3, ey + 1, BEYE[0])
        if c.get(ex + ox_ - 2, ey) is None:
            c.set(ex + ox_ - 2, ey, BEYE[0])
    c.line(ex - 2, ey - 2, ex + 12, ey - 2, OUT)
    c.line(ex - 1, ey - 3, ex + 4, ey - 2, BMOSS[1])
    # racines qui pendent du menton
    for (x, n) in ((hx - 6, 5), (hx - 1, 7), (hx + 4, 4)):
        base = hy + 10 + jaw_open
        c.line(x, base, x - 1 + (by if x % 2 else 0), base + n, ROOT[2])
        c.set(x - 1 + (by if x % 2 else 0), base + n, ROOT[3])

    # ---- bras proche : énorme, couvert de racines
    t = new()
    if atk:
        arm = [(X + 28, 26), (X + 22, 16), (X + 14, 10)]
        fist = (X + 12, 9)
    else:
        arm = [(X + 30, 30 + by), (X + 21, 42 + by), (X + 13, 52 + by)]
        fist = (X + 11, G - 6)
    tube(t, arm, [7.4, 6.2, 5.4], MUD)
    stamp(c, t)
    t = new()
    ball(t, fist[0], fist[1], 7, 6, MUD)
    stamp(c, t)
    if atk:
        for k in range(3):
            c.line(fist[0] - 5 + k * 3, fist[1] - 3, fist[0] - 5 + k * 3, fist[1] + 2, MUD[1])
        for (x, y) in ((fist[0] - 6, fist[1] - 4), (fist[0] - 3, fist[1] - 5), (fist[0], fist[1] - 5)):
            c.set(x, y, ROOT[4]); c.set(x - 1, y + 1, ROOT[3])
    else:
        for k in range(3):
            c.line(fist[0] - 4 + k * 3, fist[1] + 1, fist[0] - 4 + k * 3, fist[1] + 5, MUD[1])
        for (x, y) in ((fist[0] - 6, fist[1] + 5), (fist[0] - 3, fist[1] + 6), (fist[0], fist[1] + 6)):
            c.set(x, y, FANG[3]); c.set(x - 1, y, FANG[2])
    # racines enroulées autour du bras + mousse d'épaule
    for k in range(3):
        u = 0.25 + k * 0.25
        x = arm[0][0] + (arm[2][0] - arm[0][0]) * u
        y = arm[0][1] + (arm[2][1] - arm[0][1]) * u
        for q in range(-5, 6):
            yy = y + q * 0.4 + math.sin(q * 0.9 + k) * 0.8
            c.setf(x + q, yy, ROOT[1])
            if q % 3 == 0:
                c.setf(x + q, yy - 1, ROOT[3])
    t = new()
    sm = mask_of(lambda m: m.poly([(X + 20, 25 + by), (X + 26, 18 + by), (X + 35, 19 + by), (X + 37, 26 + by), (X + 33, 30 + by),
                                   (X + 30, 27 + by), (X + 26, 31 + by), (X + 23, 27 + by)], '#000'))
    shade(t, sm, BMOSS, contrast=0.5, bias=0.08)
    stamp(c, t)
    mushroom(c, X + 27, 19 + by, 3, CAPR, lean=-0.4)
    mushroom(c, X + 31, 20 + by, 2, CAPV)
    drip(c, X + 24, 28 + by, 3 + by, BMOSS)
    drip(c, X + 30, 28 + by, 2, BMOSS)
    for x in (arm[2][0] - 3, arm[2][0] + 2):
        drip(c, x, arm[2][1] + (6 if not atk else -8) + by, 2, MUD)

    # ---- effets
    if atk:
        # rugissement : ondes + spores ; traînée du poing
        arc_fx(c, X + 18, 32, 20, 1.0, 255, 165, 4.5, [MUD[3], BMOSS[3], TOXIC[2], TOXIC[3], TOXIC[4]])
        for (x, y) in ((X + 2, 30), (X - 1, 40), (X + 4, 48), (X + 1, 22)):
            sparkle(c, x, y, TOXIC[2], TOXIC[4])
        for k in range(3):
            c.line(hx - 14 - k * 2, hy + 1 + k * 3, hx - 16 - k * 2, hy + 2 + k * 3, TOXIC[3])
    glow_ring(c, TOXIC[1], TOXIC[2], every=1)
    spores = ((X + 66, 8, 2), (X + 4, 12, 3), (X + 68, 40, 1), (X + 22, 4, 2), (X + 62, 50, 3), (X + 8, 34, 1))
    if f == 1:
        spores = tuple((x + 1, y - 2, k) for x, y, k in spores)
    dots(c, spores, lambda k: TOXIC[k + 1])
    return c, (W, H)



# ======================================================================= MONDE 8 : ÎLES CÉLESTES

FEATH = ['#45558a', '#7690c4', '#aec8ea', '#e0eeff', '#ffffff']
FEATHF = dkr(FEATH)
SKIN = ['#a06464', '#d89a86', '#f2c4a8', '#ffe2cc', '#fff6ee']
SKYH = ['#1c3468', '#2c5ea6', '#4892d6', '#84c6f2', '#d0f0ff']   # cheveux de la harpie
SKYB = ['#16244e', '#24428a', '#3a6ec4', '#68a2e6', '#b0d8ff']   # tissu bleu ciel
ELEC = ['#2a2a7a', '#5a9aff', '#c8ecff', '#ffffff']
ZAP = ['#7a4a10', '#ffbe2a', '#fff09a', '#ffffff']
CLOUD = ['#7080b0', '#a8b8dc', '#d8e4f6', '#f4f8ff', '#ffffff']
TALON = ['#3a2a1a', '#7a5a2a', '#c49a3a', '#f0d070', '#fff6c0']
SPARK = ['#5a8ad8', '#bfe4ff', '#ffffff']


def feather_wing(c, shoulder, wrist, prims, secs, R, tip_col=None, cover=None, cover_frac=0.36, elbow=None):
    """Aile à plumes : bord d'attaque épaule -> poignet, rémiges primaires (prims : de l'intérieur vers le bout),
    secondaires (secs : du poignet vers le corps) ; creux festonnés, séparations, couvertures claires."""
    edge = list(reversed(prims)) + list(secs)          # bord de fuite, du bout de l'aile vers le corps
    ne = len(edge)
    arm = lambda u: (shoulder[0] + (wrist[0] - shoulder[0]) * u, shoulder[1] + (wrist[1] - shoulder[1]) * u)
    us = [1.0 - 0.85 * i / max(1, ne - 1) for i in range(ne)]       # point d'attache de chaque plume
    pts = [shoulder] + ([elbow] if elbow else []) + [wrist]
    notches = []
    for i, tp in enumerate(edge):
        pts.append(tp)
        if i + 1 < ne:
            nx_, ny_ = edge[i + 1]
            mx, my = (tp[0] + nx_) / 2, (tp[1] + ny_) / 2
            ax, ay = arm((us[i] + us[i + 1]) / 2)
            depth = 0.3 if i < len(prims) else 0.16
            q = (mx + (ax - mx) * depth, my + (ay - my) * depth)
            pts.append(q)
            notches.append((q, (ax, ay), i < len(prims)))
    t = Layer(c.lw, c.lh)
    m = mask_of(lambda q: q.poly(pts, '#000'))
    shade(t, m, R, contrast=0.4, bias=0.02)
    # séparations des plumes : du creux vers le bras
    for (qx, qy), (ax, ay), is_p in notches:
        ln_ = 0.7 if is_p else 0.55
        for k in range(20):
            u = k / 19 * ln_
            t.setf(qx + (ax - qx) * u, qy + (ay - qy) * u, R[1])
    # reflet sur chaque plume (à gauche de la séparation)
    for i, tp in enumerate(edge):
        ax, ay = arm(us[i])
        for k in range(3, 9):
            u = k / 14
            x, y = tp[0] + (ax - tp[0]) * u - 1, tp[1] + (ay - tp[1]) * u
            if (int(round(x)), int(round(y))) in m and t.get(x, y) not in (R[1],):
                t.setf(x, y, R[3])
    if tip_col:
        for tp in prims:
            for (x, y) in m:
                d2 = (x - tp[0]) ** 2 + (y - tp[1]) ** 2
                if d2 <= 5:
                    t.set(x, y, tip_col[2] if d2 > 1.5 else tip_col[3])
    # couvertures : bande claire le long du bras, bord festonné
    cv = cover or R
    cov = [shoulder] + ([elbow] if elbow else []) + [wrist]
    for i, tp in enumerate(edge):
        ax, ay = arm(us[i])
        cov.append((ax + (tp[0] - ax) * cover_frac, ay + (tp[1] - ay) * cover_frac))
    cm = mask_of(lambda q: q.poly(cov, '#000')) & m
    shade(t, cm, cv, contrast=0.35, bias=0.18, edge=False)
    for (x, y) in cm:
        if any((x + dx, y + dy) not in cm and (x + dx, y + dy) in m for dx, dy in ((0, 1), (1, 0))):
            t.set(x, y, cv[1])
        elif (x + (y // 2) * 2) % 4 == 0 and y % 2 == 0:
            t.set(x, y, cv[2])
    lead = [shoulder] + ([elbow] if elbow else []) + [wrist]
    for i in range(len(lead) - 1):
        t.line(lead[i][0], lead[i][1], lead[i + 1][0], lead[i + 1][1], cv[4])
        t.line(lead[i][0], lead[i][1] + 1, lead[i + 1][0], lead[i + 1][1] + 1, cv[3])
    stamp(c, t)


def wing_at(c, sh, spec, R, tip_col=None, cover=None):
    """spec = (épaule, coude, poignet, prims, secs) en décalages relatifs à sh."""
    (s0, e0, w0, pr, se) = spec
    a = lambda p_: (sh[0] + p_[0], sh[1] + p_[1])
    feather_wing(c, a(s0), a(w0), [a(p_) for p_ in pr], [a(p_) for p_ in se], R, tip_col, cover, elbow=a(e0))


# ---------------------------------------------------------------- reine harpie (volante)

HQW, HQH = 62, 54


def harpy_queen(f):
    W, H = HQW, HQH
    new = lambda: Layer(W, H)
    c = new()
    atk = f == 2
    X = 4
    oy = {0: 4, 1: 2, 2: 4}[f]                       # flottement
    lean = -3 if atk else 0
    sh = (X + 27 + lean, 19 + oy)                     # épaule

    # ---- aile lointaine
    far = {0: ((3, 0), (9, -12), (18, -17), [(23, 4), (27, -3), (30, -11)], [(16, 8), (10, 8)]),
           1: ((3, 0), (9, 2), (16, 5), [(12, 22), (19, 20), (24, 14)], [(8, 16)]),
           2: ((3, 0), (10, -11), (19, -15), [(25, 4), (29, -3), (31, -11)], [(17, 7), (10, 7)])}[f]
    wing_at(c, sh, far, FEATHF, GOLD)

    # ---- longue traîne de plumes (queue)
    t = new()
    for k, (dx, dy) in enumerate(((20, 12), (17, 16), (12, 18))):
        bx, by_ = X + 31 + lean, 33 + oy
        tube(t, [(bx, by_), (bx + dx * 0.6, by_ + dy * 0.5 + (1 if f == 1 else 0)), (bx + dx, by_ + dy)], [2.6, 2.4, 0.8],
             FEATH if k != 1 else FEATHF, contrast=0.4)
        t.setf(bx + dx - 1, by_ + dy - 1, GOLD[3])
    stamp(c, t)

    # ---- pattes d'oiseau + serres
    if atk:
        legs = [((X + 26 + lean, 37 + oy), (X + 19, 43 + oy), (X + 11, 44 + oy)),
                ((X + 30 + lean, 37 + oy), (X + 24, 45 + oy), (X + 17, 47 + oy))]
    else:
        legs = [((X + 26, 37 + oy), (X + 24, 43 + oy), (X + 23, 47 + oy)),
                ((X + 30, 37 + oy), (X + 31, 43 + oy), (X + 29, 48 + oy))]
    for i, (hip, knee, foot) in enumerate(reversed(legs)):
        t = new()
        R = TALON if i == 1 else dkr(TALON)
        tube(t, [hip, knee, foot], [1.8, 1.4, 1.2], R)
        stamp(c, t)
        fx, fy = foot
        for (dx, dy) in ((-3, 1), (-2, 2), (1, 2)) if not atk else ((-3, -1), (-3, 1), (-1, 2)):
            c.line(fx, fy, fx + dx, fy + dy, R[2])
            c.set(fx + dx, fy + dy, WHITE if atk else R[4])

    # ---- corps : jupe de plumes, plastron d'or
    t = new()
    sk = mask_of(lambda m: m.poly([(X + 21 + lean, 28 + oy), (X + 33 + lean, 28 + oy), (X + 36 + lean, 37 + oy),
                                   (X + 32 + lean, 40 + oy), (X + 28 + lean, 38 + oy), (X + 24 + lean, 41 + oy),
                                   (X + 19 + lean, 38 + oy)], '#000'))
    shade(t, sk, FEATH, contrast=0.45, bias=0.05)
    for (x, y) in sk:
        if (x + (y // 2) * 2) % 4 == 0 and y % 2 == 1:
            t.set(x, y, FEATH[2])
    stamp(c, t)
    t = new()
    tm = mask_of(lambda m: m.poly([(X + 22 + lean, 19 + oy), (X + 32 + lean, 19 + oy), (X + 33 + lean, 29 + oy),
                                   (X + 21 + lean, 29 + oy)], '#000'))
    shade(t, tm, SKIN, contrast=0.4)
    stamp(c, t)
    t = new()
    bm = mask_of(lambda m: m.poly([(X + 21 + lean, 22 + oy), (X + 33 + lean, 22 + oy), (X + 33 + lean, 30 + oy),
                                   (X + 27 + lean, 32 + oy), (X + 21 + lean, 30 + oy)], '#000'))
    shade(t, bm, GOLD, contrast=0.5, bias=0.05)
    t.line(X + 27 + lean, 23 + oy, X + 27 + lean, 31 + oy, GOLD[1])
    t.set(X + 27 + lean, 25 + oy, '#3a8ae0'); t.set(X + 26 + lean, 25 + oy, '#9ad8ff')
    stamp(c, t)

    # ---- tête : chevelure, visage, diadème
    hx, hy = X + 24 + lean, 12 + oy
    if atk:
        hx -= 1
    t = new()
    hm = mask_of(lambda m: (m.ellipse(hx + 3, hy - 1, 7.5, 7, '#000'),
                            m.poly([(hx + 4, hy - 4), (hx + 14, hy + 2 + (1 if f == 1 else 0)), (hx + 17, hy + 12),
                                    (hx + 12, hy + 9), (hx + 11, hy + 16), (hx + 7, hy + 9), (hx + 4, hy + 8)], '#000')))
    shade(t, hm, SKYH, contrast=0.5, bias=0.05)
    for k in range(3):
        t.line(hx + 6 + k * 2, hy - 2 + k, hx + 10 + k * 2, hy + 10 + k, SKYH[1])
    stamp(c, t)
    t = new()
    ball(t, hx, hy + 1, 5.4, 5.6, SKIN)
    stamp(c, t)
    # frange
    t = new()
    spoly(t, [(hx - 6, hy - 2), (hx - 3, hy - 6), (hx + 4, hy - 7), (hx + 7, hy - 2), (hx + 3, hy - 3), (hx, hy - 1),
              (hx - 3, hy - 3)], SKYH, contrast=0.5, bias=0.12)
    stamp(c, t)
    # œil farouche (regard à gauche) + sourcil
    ex, ey = hx - 4, hy
    c.rect(ex, ey, 3, 3, '#1e2a5a')
    c.set(ex, ey + 2, '#5ab4ff'); c.set(ex + 1, ey + 2, '#3a7ad0')
    c.set(ex, ey, WHITE)
    c.line(ex - 1, ey - 1, ex + 3, ey - 2, OUT)
    c.set(ex + 3, ey + 1, SKIN[1])
    c.set(hx - 5, hy + 4, '#b03a5a') if not atk else c.rect(hx - 5, hy + 4, 2, 2, '#5a1a2a')
    c.set(hx - 2, hy + 3, SKIN[1])
    # diadème
    t = new()
    for k, (dx, h_) in enumerate(((-3, 3), (0, 5), (3, 3))):
        spoly(t, [(hx + dx - 1.5, hy - 5), (hx + dx, hy - 5 - h_), (hx + dx + 1.5, hy - 5)], GOLD, contrast=0.6, bias=0.1)
    t.line(hx - 5, hy - 5, hx + 5, hy - 5, GOLD[2])
    stamp(c, t)
    c.set(hx, hy - 7, '#3a8ae0'); c.set(hx, hy - 8, '#9ad8ff')

    # ---- aile proche
    near = {0: ((-1, 1), (4, -10), (13, -15), [(17, 10), (23, 3), (27, -6)], [(11, 13), (5, 12), (1, 9)]),
            1: ((-1, 1), (6, 4), (12, 8), [(6, 26), (13, 24), (19, 19)], [(3, 21), (0, 15)]),
            2: ((-1, 1), (5, -9), (15, -13), [(21, 8), (26, 1), (29, -8)], [(13, 11), (7, 11), (2, 8)])}[f]
    wing_at(c, sh, near, FEATH, GOLD)

    # ---- effets
    if atk:
        for (p0, p1) in (((X - 2, 30 + oy), (X + 8, 40 + oy)), ((X - 3, 37 + oy), (X + 6, 46 + oy)),
                         ((X + 1, 25 + oy), (X + 9, 32 + oy))):
            lens(c, p0, p1, 1.2, [SPARK[0], SPARK[0], SPARK[1], SPARK[2]])
    else:
        # plumes qui volent
        for (x, y) in ((X + 2, 40 + oy * (1 if f == 0 else -1)), (X + 48, 44)):
            c.line(x, y, x + 2, y - 1, FEATH[3]); c.set(x + 2, y - 1, FEATH[4])
    dots(c, ((X + 44, 6, 1), (X + 2, 14 - oy, 2), (X + 50, 30, 0)), lambda k: SPARK[k])
    return c, (W, H)


# ---------------------------------------------------------------- griffon du tonnerre

LION = ['#5a3412', '#965e22', '#c8903a', '#ecc068', '#fff0b4']
LIONF = dkr(LION)
GBEAK = ['#6a3a0a', '#c07a14', '#f0b42a', '#ffe070', '#fffad0']
STORMF = ['#24305e', '#3a5294', '#5a80c8', '#8ab4ea', '#cfe6ff']   # plumes d'orage
GEYE = ['#c06a0a', '#ffd23a', '#fff8c0']

GRW, GRH = 74, 56


def griffin(f):
    W, H = GRW, GRH
    G = H - 2
    new = lambda: Layer(W, H)
    c = new()
    atk = f == 2
    by = 1 if f == 1 else 0
    X = 4

    # ---- aile lointaine (relevée)
    gfar = {0: ((36, 22), (41, 6), (50, 1), [(57, 22), (62, 14), (65, 6)], [(51, 26)]),
            1: ((36, 23), (43, 9), (52, 5), [(60, 25), (65, 17), (68, 9)], [(53, 28)]),
            2: ((36, 22), (41, 6), (50, 1), [(57, 22), (62, 14), (65, 6)], [(51, 26)])}[f]
    wing_at(c, (X, 0), gfar, dkr(STORMF), ZAP)

    # ---- queue de lion à touffe électrique
    t = new()
    tw = 2 if f == 1 else 0
    tube(t, [(X + 56, 32 + by), (X + 63, 30), (X + 66, 22 + tw), (X + 64, 15 + tw)], [2.2, 1.8, 1.6, 1.4], LION)
    stamp(c, t)
    t = new()
    ball(t, X + 64, 13 + tw, 3.2, 3.6, STORMF)
    stamp(c, t)
    sparkle(c, X + 67, 10 + tw, ELEC[1], ELEC[3])

    # ---- pattes lointaines
    if f == 1:
        far = [((X + 52, 38), (X + 57, 46), (X + 56, G - 1)), ((X + 26, 36), (X + 22, 45), (X + 20, G - 1))]
    elif atk:
        far = [((X + 52, 38), (X + 58, 46), (X + 60, G - 1)), ((X + 26, 36), (X + 19, 40), (X + 13, 42))]
    else:
        far = [((X + 52, 38), (X + 53, 46), (X + 52, G - 1)), ((X + 26, 36), (X + 26, 45), (X + 25, G - 1))]
    for i, pts in enumerate(far):
        t = new()
        tube(t, pts, [3.6, 2.8, 2.4] if i == 0 else [3.2, 2.0, 1.8], LIONF if i == 0 else dkr(GBEAK))
        stamp(c, t)
        fx, fy = pts[-1]
        if i == 0:
            t = new(); ball(t, fx - 1, fy - 0.5, 3, 2, LIONF); stamp(c, t)
        else:
            for dx in (-3, -1, 1):
                c.line(fx, fy, fx + dx, fy + 1, GBEAK[1]); c.set(fx + dx, fy + 1, WHITE)

    # ---- corps de lion
    t = new()
    bm = mask_of(lambda m: (m.ellipse(X + 42, 33 + by, 17, 9, '#000'), m.ellipse(X + 53, 36 + by, 8, 8, '#000')))
    shade(t, bm, LION, contrast=0.5)
    for (x, y) in bm:
        if y > 38 + by and x < X + 52:
            if (x + y) % 3 == 0:
                t.set(x, y, LION[3])
    t.line(X + 46, 37 + by, X + 50, 41 + by, LION[1])
    stamp(c, t)

    # ---- pattes proches : arrière de lion, avant d'aigle
    if f == 1:
        near = [((X + 50, 38), (X + 47, 46), (X + 46, G - 1)), ((X + 30, 36), (X + 32, 45), (X + 31, G - 1))]
    elif atk:
        near = [((X + 50, 38), (X + 52, 46), (X + 51, G - 1)), ((X + 28, 34), (X + 20, 33), (X + 13, 35))]
    else:
        near = [((X + 50, 38), (X + 50, 46), (X + 49, G - 1)), ((X + 30, 36), (X + 30, 45), (X + 29, G - 1))]
    for i, pts in enumerate(near):
        t = new()
        if i == 0:
            tube(t, [(pts[0][0] + 3, pts[0][1] - 2)] + list(pts[1:]), [6, 3.4, 2.6], LION)
        else:
            tube(t, pts, [3.6, 2.2, 2.0], GBEAK)
        stamp(c, t)
        fx, fy = pts[-1]
        if i == 0:
            t = new(); ball(t, fx - 1, fy - 0.5, 3.4, 2.2, LION); stamp(c, t)
            c.set(fx - 4, fy, WHITE); c.set(fx - 2, fy + 1, WHITE)
        else:
            for dx, dy in ((-3, 1), (-3, -1), (-1, 2)) if atk else ((-3, 1), (-1, 1), (1, 1)):
                c.line(fx, fy, fx + dx, fy + dy, GBEAK[1]); c.set(fx + dx, fy + dy, WHITE)

    # ---- poitrail de plumes blanches + cou
    hx, hy = (X + 15, 15 + by) if not atk else (X + 12, 19)
    t = new()
    cm = mask_of(lambda m: (m.poly([(hx - 1, hy + 2), (hx + 8, hy - 1), (X + 34, 23 + by), (X + 37, 30 + by),
                                    (X + 35, 36 + by), (X + 32, 34 + by), (X + 30, 39 + by), (X + 27, 35 + by),
                                    (X + 24, 39 + by), (X + 22, 34 + by), (X + 19, 36 + by), (X + 19, 28 + by)], '#000')))
    shade(t, cm, FEATH, contrast=0.45, bias=0.05)
    for (x, y) in cm:
        if y > hy + 7 and (x + (y // 2) * 2) % 4 == 0 and y % 2 == 0:
            t.set(x, y, FEATH[2])
    stamp(c, t)

    # ---- tête d'aigle
    t = new()
    # plumes de crête rabattues vers l'arrière (orage)
    for k, (dx, dy) in enumerate(((14, -8), (15, -3), (12, 2))):
        spoly(t, [(hx + 2, hy - 4 + k * 2), (hx + dx, hy + dy + by), (hx + 3, hy + k * 2)], STORMF, contrast=0.6)
        t.set(hx + dx - 1, hy + dy + by, ZAP[2])
    stamp(c, t)
    t = new()
    spoly(t, [(hx - 5, hy - 3), (hx - 1, hy - 6), (hx + 4, hy - 6), (hx + 7, hy - 2), (hx + 7, hy + 4), (hx + 2, hy + 6),
              (hx - 3, hy + 5), (hx - 5, hy + 2)], FEATH, contrast=0.45, bias=0.08)
    t.line(hx - 1, hy - 5, hx + 4, hy - 5, FEATH[4])
    stamp(c, t)
    # bec crochu
    t = new()
    if atk:
        spoly(t, [(hx - 4, hy - 2), (hx - 11, hy - 1), (hx - 13, hy + 2), (hx - 10, hy + 1), (hx - 4, hy + 2)], GBEAK, contrast=0.5, bias=0.1)
        spoly(t, [(hx - 4, hy + 4), (hx - 9, hy + 6), (hx - 4, hy + 7)], GBEAK, contrast=0.5, bias=-0.1)
    else:
        spoly(t, [(hx - 4, hy - 2), (hx - 10, hy - 1), (hx - 12, hy + 3), (hx - 10, hy + 2), (hx - 6, hy + 4), (hx - 3, hy + 4)],
              GBEAK, contrast=0.5, bias=0.1)
    stamp(c, t)
    if atk:
        c.poly([(hx - 10, hy + 2), (hx - 4, hy + 2), (hx - 4, hy + 5), (hx - 8, hy + 5)], '#4a0a1a')
        c.line(hx - 8, hy + 4, hx - 5, hy + 4, '#c03a5a')
    else:
        c.line(hx - 9, hy + 2, hx - 4, hy + 3, GBEAK[0])
    c.set(hx - 8, hy - 1, GBEAK[4])
    c.set(hx - 6, hy, OUT)
    # œil perçant + sourcil
    ex, ey = hx - 3, hy - 2
    c.rect(ex, ey, 3, 2, GEYE[1])
    c.set(ex, ey, GEYE[2]); c.set(ex + 1, ey, OUT); c.set(ex + 1, ey + 1, OUT)
    c.line(ex - 1, ey - 1, ex + 3, ey - 2, OUT)
    c.line(ex - 1, ey - 2, ex + 3, ey - 3, STORMF[1])

    # ---- aile proche (relevée, éclairs)
    gnear = {0: ((32, 24), (36, 8), (45, 2), [(51, 28), (57, 20), (61, 11)], [(45, 31), (39, 31)]),
             1: ((32, 25), (38, 12), (47, 7), [(54, 31), (60, 23), (64, 15)], [(47, 34), (41, 33)]),
             2: ((32, 24), (35, 6), (43, 1), [(52, 26), (58, 17), (61, 8)], [(45, 30), (39, 30)])}[f]
    wing_at(c, (X, 0), gnear, STORMF, ZAP, cover=FEATH)

    # ---- effets électriques
    arcs = ((X + 40, 2, X + 48, 9), (X + 58, 18, X + 62, 26)) if f != 1 else ((X + 44, 4, X + 51, 12), (X + 60, 22, X + 64, 30))
    for (x0, y0, x1, y1) in arcs:
        bolt(c, zig(x0, y0, x1, y1, 3, 1.4, f), ELEC)
    if atk:
        bolt(c, zig(hx - 12, hy + 3, X - 2, G - 2, 5, 2.4, 1), ZAP, width=2)
        bolt(c, zig(hx - 12, hy + 3, X - 3, hy + 2, 3, 1.6, 0), ZAP)
        for (x, y) in ((X, G - 1), (X + 4, G - 4), (X - 2, G - 6)):
            sparkle(c, x, y, ZAP[1], ZAP[3])
    dots(c, ((X + 4, 4, 1), (X + 66, 44, 0), (X + 22, 2, 2)), lambda k: SPARK[k])
    return c, (W, H)


# ---------------------------------------------------------------- valkyrie de la tempête

HAIRG = ['#7a4a14', '#c0861e', '#ecbe3e', '#ffe48a', '#fffbd8']
VARM = GOLD
STEELB = ['#2a3050', '#56628a', '#94a4c8', '#d4e0f2', '#ffffff']

VKW, VKH = 68, 62


def valkyrie(f):
    W, H = VKW, VKH
    G = H - 2
    new = lambda: Layer(W, H)
    c = new()
    atk = f == 2
    by = 1 if f == 1 else 0
    X = 4

    # ---- aile lointaine
    vfar = {0: ((34, 21), (40, 6), (50, 1), [(56, 24), (60, 16), (63, 8)], [(50, 28), (44, 30)]),
            1: ((34, 22), (42, 16), (51, 14), [(52, 38), (58, 34), (62, 26)], [(46, 38)]),
            2: ((34, 21), (39, 5), (48, 1), [(56, 22), (61, 14), (63, 6)], [(50, 26), (44, 28)])}[f]
    wing_at(c, (X, 0), vfar, FEATHF, GOLD)

    # ---- cape bleue
    t = new()
    sw = 2 if f == 1 else (3 if atk else 0)
    cm = mask_of(lambda m: m.poly([(X + 24, 22 + by), (X + 36, 22 + by), (X + 41 + sw, 40), (X + 44 + sw, G - 4), (X + 40 + sw, G - 6),
                                   (X + 37, G - 2), (X + 33, G - 6), (X + 28, G - 8)], '#000'))
    shade(t, cm, SKYB, contrast=0.45, bias=-0.05)
    for (x, y) in cm:
        if (x + 1, y) not in cm:
            t.set(x, y, GOLD[2])
    stamp(c, t)

    # ---- jambes : jambières dorées
    if f == 1:
        lg = [((X + 31, 40), (X + 35, G - 1)), ((X + 26, 40), (X + 22, G - 1))]
    elif atk:
        lg = [((X + 31, 40), (X + 38, G - 1)), ((X + 25, 40), (X + 18, G - 1))]
    else:
        lg = [((X + 31, 40), (X + 33, G - 1)), ((X + 26, 40), (X + 25, G - 1))]
    for i, (hip, foot) in enumerate(lg):
        t = new()
        R = dkr(SKYB) if i == 0 else SKYB
        tube(t, [hip, ((hip[0] + foot[0]) / 2, (hip[1] + foot[1]) / 2)], [3.0, 2.6], R)
        stamp(c, t)
        t = new()
        A = dkr(VARM) if i == 0 else VARM
        mx, my = (hip[0] + foot[0]) / 2, (hip[1] + foot[1]) / 2
        tube(t, [(mx, my - 1), (foot[0], foot[1] - 2)], [3.0, 2.4], A)
        spoly(t, [(foot[0] - 4, G - 2), (foot[0] + 2, G - 3), (foot[0] + 3, G), (foot[0] - 5, G)], A, contrast=0.4)
        ball(t, mx, my - 1, 2.6, 2.2, A)
        stamp(c, t)

    # ---- jupe d'armure (lambrequins bleus bordés d'or)
    t = new()
    km = mask_of(lambda m: m.poly([(X + 21, 33 + by), (X + 35, 33 + by), (X + 38, 43 + by), (X + 34, 45 + by), (X + 31, 42 + by),
                                   (X + 28, 45 + by), (X + 25, 42 + by), (X + 21, 45 + by), (X + 18, 43 + by)], '#000'))
    shade(t, km, SKYB, contrast=0.45, bias=0.05)
    for (x, y) in km:
        if (x, y + 1) not in km:
            t.set(x, y, GOLD[3])
    for x in range(X + 20, X + 37):
        t.setf(x, 33 + by, GOLD[1]); t.setf(x, 34 + by, GOLD[3])
    stamp(c, t)

    # ---- cuirasse dorée
    t = new()
    tm = mask_of(lambda m: m.poly([(X + 21, 21 + by), (X + 35, 21 + by), (X + 36, 28 + by), (X + 33, 34 + by), (X + 22, 34 + by),
                                   (X + 20, 28 + by)], '#000'))
    shade(t, tm, VARM, contrast=0.5, bias=0.05)
    t.line(X + 23, 26 + by, X + 27, 28 + by, VARM[1])
    t.line(X + 23, 25 + by, X + 26, 26 + by, VARM[4])
    t.ellipse(X + 28, 29 + by, 1.6, 1.6, ELEC[1], only_inside=True)
    t.set(X + 27, 28 + by, WHITE)
    stamp(c, t)

    # ---- tresse dorée qui pend dans le dos
    t = new()
    tube(t, [(X + 32, 12 + by), (X + 37, 20 + by), (X + 38 + sw, 30)], [3.0, 2.4, 1.6], HAIRG)
    for k in range(4):
        t.setf(X + 34 + k * 1.2, 15 + by + k * 4, HAIRG[1])
    stamp(c, t)

    # ---- tête : casque ailé
    hx, hy = (X + 27, 13 + by) if not atk else (X + 25, 14)
    t = new()
    ball(t, hx, hy + 1, 6.5, 6.4, SKIN)
    stamp(c, t)
    # cheveux sur la nuque
    t = new()
    spoly(t, [(hx + 2, hy - 3), (hx + 8, hy), (hx + 7, hy + 7), (hx + 3, hy + 6)], HAIRG, contrast=0.5, bias=0.1)
    stamp(c, t)
    t = new()
    hm = mask_of(lambda m: m.poly([(hx - 7, hy), (hx - 6, hy - 5), (hx - 1, hy - 8), (hx + 5, hy - 7), (hx + 8, hy - 2),
                                   (hx + 7, hy + 2), (hx + 2, hy), (hx - 4, hy - 1)], '#000'))
    shade(t, hm, VARM, contrast=0.5, bias=0.1)
    t.line(hx - 6, hy - 1, hx + 6, hy + 1, VARM[1])
    t.rect(hx - 6, hy - 1, 2, 4, VARM[2])          # nasal
    stamp(c, t)
    # ailettes du casque
    t = new()
    for k, (dx, dy) in enumerate(((7, -10), (10, -7), (11, -3))):
        spoly(t, [(hx + 3, hy - 4 + k), (hx + dx + (1 if f == 1 else 0), hy + dy + (1 if f == 1 else 0)), (hx + 5, hy - 1 + k)],
              FEATH, contrast=0.5, bias=0.12)
    stamp(c, t)
    # œil + bouche
    ex, ey = hx - 4, hy + 1
    c.rect(ex, ey, 2, 3, '#1a2a5a')
    c.set(ex, ey + 2, '#5ab4ff'); c.set(ex, ey, WHITE)
    c.line(ex - 1, ey - 1, ex + 2, ey - 1, OUT)
    c.set(hx - 5, hy + 5, '#a03a4a') if not atk else c.rect(hx - 6, hy + 5, 2, 2, '#5a1a2a')

    # ---- bras proche + lance
    if atk:
        hand = (X + 18, 25)
        arm = [(X + 24, 23), (X + 21, 27), hand]
        sp0, sp1 = (X + 38, 24), (X - 2, 26)     # lance horizontale
    else:
        hand = (X + 14, 28 + by)
        arm = [(X + 23, 23 + by), (X + 18, 29 + by), hand]
        sp0, sp1 = (X + 15, G), (X + 12, 6)
    t = new()
    dx, dy = sp1[0] - sp0[0], sp1[1] - sp0[1]
    n = math.hypot(dx, dy)
    ux, uy = dx / n, dy / n
    nx, ny = -uy, ux
    tube(t, [sp0, (sp1[0] - ux * 7, sp1[1] - uy * 7)], [1.1, 1.1], ['#3a2414', '#6a4a2a', '#9a7040', '#c89a5a', '#e8c080'])
    stamp(c, t)
    t = new()
    hb = (sp1[0] - ux * 7, sp1[1] - uy * 7)
    spoly(t, [(hb[0] + nx * 2.6, hb[1] + ny * 2.6), (sp1[0], sp1[1]), (hb[0] - nx * 2.6, hb[1] - ny * 2.6),
              (hb[0] - ux * 1.5, hb[1] - uy * 1.5)], STEELB, contrast=0.6, bias=0.1)
    t.line(hb[0], hb[1], sp1[0] - ux, sp1[1] - uy, STEELB[4])
    # garde dorée
    t.line(hb[0] + nx * 3.5 - ux, hb[1] + ny * 3.5 - uy, hb[0] - nx * 3.5 - ux, hb[1] - ny * 3.5 - uy, GOLD[2], width=1)
    stamp(c, t)
    t = new()
    tube(t, arm, [2.8, 2.4, 2.2], SKIN)
    ball(t, arm[0][0], arm[0][1], 3.6, 3.2, VARM)           # épaulière
    ball(t, hand[0], hand[1], 2.2, 2.2, VARM)
    stamp(c, t)

    # ---- aile proche
    vnear = {0: ((31, 23), (36, 8), (46, 3), [(51, 31), (57, 23), (61, 14)], [(45, 36), (39, 38), (33, 35)]),
             1: ((31, 24), (40, 20), (48, 18), [(46, 44), (53, 40), (58, 32)], [(41, 44), (36, 40)]),
             2: ((31, 23), (35, 6), (44, 1), [(52, 28), (58, 20), (62, 10)], [(46, 33), (40, 35), (34, 33)])}[f]
    wing_at(c, (X, 0), vnear, FEATH, GOLD)

    # ---- effets
    tip = sp1
    if atk:
        bolt(c, zig(tip[0] + 1, tip[1], X - 6, tip[1] - 2, 3, 2.0, 0), ELEC, width=2)
        for (x, y) in ((X - 4, tip[1] - 6), (X - 3, tip[1] + 5), (X + 4, tip[1] + 8)):
            sparkle(c, x, y, ELEC[1], ELEC[3])
    else:
        bolt(c, zig(tip[0], tip[1] + 1, tip[0] - 3, tip[1] - 3 + by, 2, 1.0, f), ELEC)
        sparkle(c, tip[0] - 4, tip[1] + 5 - by, ELEC[1], ELEC[3])
    glow_ring(c, ELEC[1], ELEC[2], every=2)
    dots(c, ((X + 50, 4 + by, 1), (X + 2, 40, 0), (X + 52, 52, 2)), lambda k: SPARK[k])
    return c, (W, H)


# ---------------------------------------------------------------- titan céleste (méga boss)

MARB = ['#565474', '#8e8eac', '#c2c4da', '#e6e8f4', '#ffffff']
MARBF = dkr(MARB)
TGOLD = GOLD
TEYEC = ['#5ab4ff', '#c8f0ff', '#ffffff']

TTW, TTH = 72, 72


def cloud_bank(c, cx, base, w, phase, R=CLOUD):
    t = Layer(c.lw, c.lh)
    k = 0
    x = cx - w / 2
    while x <= cx + w / 2:
        r = 4.5 + 2.5 * (0.5 + 0.5 * math.sin(k * 1.7 + phase))
        ball(t, x, base - r * 0.6, r, r * 0.8, R)
        x += 5.5
        k += 1
    t.rect(int(cx - w / 2 - 2), int(base - 3), int(w) + 5, 4, R[2])
    for xx in range(int(cx - w / 2 - 2), int(cx + w / 2 + 3)):
        t.set(xx, base, R[1])
    stamp(c, t)


def sky_titan(f):
    W, H = TTW, TTH
    G = H - 2
    new = lambda: Layer(W, H)
    c = new()
    atk = f == 2
    by = 1 if f == 1 else 0
    X = 6

    # ---- auréole (derrière la tête)
    hx, hy = (X + 32, 19 + by) if not atk else (X + 30, 20)
    t = new()
    for a in range(0, 360, 3):
        r = math.radians(a)
        for rr, col in ((11.5, TGOLD[1]), (10.5, TGOLD[3]), (9.8, TGOLD[2])):
            t.set(hx + 3 + math.cos(r) * rr, hy - 3 + math.sin(r) * rr * 0.98, col)
    # rayons
    for k in range(12):
        r = math.radians(k * 30 + (15 if f == 1 else 0))
        t.line(hx + 3 + math.cos(r) * 12.5, hy - 3 + math.sin(r) * 12.5, hx + 3 + math.cos(r) * 15, hy - 3 + math.sin(r) * 15,
               TGOLD[3] if k % 2 else TGOLD[4])
    stamp(c, t, None)

    # ---- cape céleste
    t = new()
    sw = 2 if f == 1 else (3 if atk else 0)
    cm = mask_of(lambda m: m.poly([(X + 24, 26 + by), (X + 48, 26 + by), (X + 56 + sw, 44), (X + 60 + sw, G - 8), (X + 54 + sw, G - 10),
                                   (X + 50, G - 6), (X + 44, G - 10), (X + 36, G - 8)], '#000'))
    shade(t, cm, SKYB, contrast=0.45, bias=-0.05)
    for k in range(3):
        t.line(X + 44 + k * 4, 30 + by, X + 48 + k * 4 + sw, G - 10, SKYB[1] if k % 2 else SKYB[3])
    for (x, y) in cm:
        if (x + 1, y) not in cm or (x, y + 1) not in cm:
            t.set(x, y, TGOLD[2])
    stamp(c, t)

    # ---- bras lointain (main ouverte, éclairs)
    t = new()
    if atk:
        arm = [(X + 46, 30), (X + 54, 38), (X + 57, 46)]
    else:
        arm = [(X + 46, 30 + by), (X + 52, 40 + by), (X + 53, 48 + by)]
    tube(t, arm, [6.0, 5.2, 4.6], MARBF, bias=-0.05)
    ball(t, arm[-1][0], arm[-1][1] + 1, 3.8, 3.6, MARBF)
    for y in range(int(arm[1][1]) - 1, int(arm[1][1]) + 3):
        for x in range(int(arm[1][0]) - 5, int(arm[1][0]) + 5):
            t.setf(x, y, TGOLD[2] if y < arm[1][1] + 1 else TGOLD[1])
    stamp(c, t)

    # ---- jambes (dans les nuages)
    for i, lx in enumerate((X + 40, X + 28) if f != 1 else (X + 41, X + 27)):
        t = new()
        tube(t, [(lx, 50 + by), (lx - 1, G - 4)], [6, 5.4], MARBF if i == 0 else MARB)
        ball(t, lx - 0.5, 56 + by, 4.6, 3.6, dkr(TGOLD) if i == 0 else TGOLD)   # genouillère
        stamp(c, t)

    # ---- pagne / jupe dorée
    t = new()
    km = mask_of(lambda m: m.poly([(X + 22, 42 + by), (X + 46, 42 + by), (X + 49, 54 + by), (X + 44, 56 + by), (X + 40, 53 + by),
                                   (X + 35, 57 + by), (X + 30, 53 + by), (X + 25, 56 + by), (X + 20, 54 + by)], '#000'))
    shade(t, km, SKYB, contrast=0.4, bias=0.08)
    for (x, y) in km:
        if (x - X) % 5 == 0:
            t.set(x, y, SKYB[1])
        if (x, y + 1) not in km:
            t.set(x, y, TGOLD[2])
    stamp(c, t)

    # ---- torse : cuirasse d'or sculptée
    t = new()
    tm = mask_of(lambda m: m.poly([(X + 19, 24 + by), (X + 49, 24 + by), (X + 52, 31 + by), (X + 45, 46 + by), (X + 24, 46 + by),
                                   (X + 16, 31 + by)], '#000'))
    shade(t, tm, TGOLD, contrast=0.5, bias=-0.02)
    # pectoraux bombés + abdominaux
    ball(t, X + 27, 30 + by, 7, 4.6, TGOLD, only_inside=True)
    ball(t, X + 41, 30 + by, 7, 4.6, dkr(TGOLD), only_inside=True)
    for k, y in enumerate((37, 40, 43)):
        for (x0, x1) in ((X + 26, X + 33), (X + 35, X + 42)):
            for x in range(x0 + k, x1 - k + 1):
                t.setf(x, y + by, TGOLD[3] if x0 < X + 34 else TGOLD[2])
                t.setf(x, y + 1 + by, TGOLD[1] if x0 < X + 34 else TGOLD[0])
    t.line(X + 34, 25 + by, X + 34, 45 + by, TGOLD[0])
    # soleil d'orage au centre
    t.ellipse(X + 34, 33 + by, 2.6, 2.4, ELEC[1], only_inside=True)
    t.set(X + 33, 32 + by, WHITE); t.set(X + 35, 34 + by, ELEC[0])
    for (dx, dy) in ((0, -4), (4, 0), (-4, 0), (0, 4)):
        t.setf(X + 34 + dx, 33 + by + dy, TGOLD[4])
    # ceinture
    for x in range(X + 22, X + 47):
        t.setf(x, 44 + by, SKYB[3]); t.setf(x, 45 + by, SKYB[1])
    stamp(c, t)
    # épaulière lointaine
    t = new()
    ball(t, X + 49, 27 + by, 5.4, 4.6, dkr(TGOLD))
    stamp(c, t)

    # ---- bras proche + foudre
    if atk:
        arm = [(X + 21, 31), (X + 14, 31), (X + 8, 28)]
        hand = (X + 7, 28)
        jav = ((X + 18, 26), (X - 1, 30))
    else:
        arm = [(X + 21, 31 + by), (X + 13, 39 + by), (X + 10, 30 + by)]
        hand = (X + 10, 29 + by)
        jav = ((X + 11, 46 + by), (X + 8, 8 + by))
    # foudre tenue en main (javelot d'éclair)
    bolt(c, zig(jav[0][0], jav[0][1], jav[1][0], jav[1][1], 5, 1.6, f), ZAP, width=2)
    t = new()
    tube(t, arm, [6.2, 5.4, 4.6], MARB)
    ball(t, hand[0], hand[1], 4.2, 4.0, MARB)
    for k in range(3):
        t.setf(hand[0] - 3, hand[1] - 2 + k * 2, MARB[1])
    # brassard
    mx_, my_ = arm[1]
    for y in range(int(my_) - 2, int(my_) + 2):
        for x in range(int(mx_) - 5, int(mx_) + 6):
            t.setf(x, y, TGOLD[3] if y == int(my_) - 2 else TGOLD[2])
    stamp(c, t)
    # veines de marbre
    for (x0, y0, x1, y1) in ((X + 18, 33, X + 21, 36), (X + 47, 34, X + 50, 38), (hx + 3, hy - 3, hx + 6, hy + 1)):
        c.setf(x0, y0 + by, MARB[1]); c.setf((x0 + x1) / 2, (y0 + y1) / 2 + by, MARB[1]); c.setf(x1, y1 + by, MARB[1])

    # ---- barbe de nuage + tête de marbre
    t = new()
    ball(t, hx, hy, 8, 8, ['#8e8eac', '#b4b6d0', '#dcdeee', '#f4f4fa', '#ffffff'])
    stamp(c, t)
    t = new()
    bmask = mask_of(lambda m: m.poly([(hx - 9, hy + 1), (hx + 6, hy + 2), (hx + 8, hy + 7), (hx + 4, hy + 12 + by), (hx, hy + 10),
                                      (hx - 3, hy + 15 + by), (hx - 6, hy + 10), (hx - 10, hy + 12), (hx - 10, hy + 7)], '#000'))
    shade(t, bmask, CLOUD, contrast=0.45, bias=0.1)
    for (x, y) in bmask:
        if (x - hx) % 3 == 0 and (x, y + 1) in bmask and y > hy + 5:
            t.set(x, y, CLOUD[1])
    stamp(c, t)
    # moustache
    t = new()
    spoly(t, [(hx - 11, hy + 3), (hx - 6, hy + 1), (hx + 1, hy + 2), (hx - 5, hy + 4), (hx - 10, hy + 6)], CLOUD, contrast=0.5, bias=0.15)
    stamp(c, t)
    if atk:
        c.rect(hx - 7, hy + 5, 5, 3, '#2a3a6a')
        c.line(hx - 7, hy + 5, hx - 3, hy + 5, WHITE)
    # couronne de laurier d'or
    t = new()
    for k in range(6):
        x = hx - 6 + k * 2.6
        y = hy - 6 - math.sin(k / 5 * math.pi) * 1.4
        spoly(t, [(x - 1.6, y + 1), (x + 0.6, y - 2.6), (x + 1.6, y + 1)], TGOLD, contrast=0.6, bias=0.1)
    t.line(hx - 7, hy - 5, hx + 8, hy - 5, TGOLD[2])
    stamp(c, t)
    # yeux luisants sous un sourcil sévère
    ex, ey = hx - 7, hy - 2
    for ox_ in (0, 5):
        c.rect(ex + ox_, ey, 3, 2, TEYEC[1] if not atk else TEYEC[2])
        c.set(ex + ox_ + 2, ey + 1, TEYEC[0]); c.set(ex + ox_, ey, WHITE)
        c.set(ex + ox_ + 1, ey + 2, MARB[1])
    c.line(ex - 1, ey - 1, ex + 8, ey - 1, OUT)
    c.line(ex - 1, ey - 2, ex + 2, ey - 1, OUT)
    c.line(ex + 6, ey - 1, ex + 8, ey - 2, OUT)
    if atk:
        for k in range(3):
            c.set(ex - 1 - k, ey + (k % 2), TEYEC[1])
    # nez
    t = new()
    spoly(t, [(hx - 7, hy - 1), (hx - 10, hy + 2), (hx - 6, hy + 2)], MARB, contrast=0.5, bias=0.1)
    stamp(c, t)
    # épaulière d'or (devant la barbe)
    t = new()
    px_, py_ = arm[0][0] - 3, arm[0][1] - 1
    ball(t, px_, py_, 6.6, 5.4, TGOLD)
    for k in range(4):
        t.setf(px_ - 5 + k * 3, py_ + 3, TGOLD[1])
        t.setf(px_ - 5 + k * 3, py_ + 4, TGOLD[1])
    t.ellipse(px_ - 1, py_ - 1, 1.5, 1.4, ELEC[1], only_inside=True)
    t.set(px_ - 2, py_ - 2, WHITE)
    stamp(c, t)

    # ---- nuages au sol
    cloud_bank(c, X + 33, G, 44, f * 1.3)

    # ---- effets
    if atk:
        bolt(c, zig(X - 1, 30, X + 3, G - 3, 4, 2.2, 2), ZAP, width=2)
        bolt(c, zig(X - 1, 30, X - 2, 12, 3, 1.6, 1), ELEC)
        for (x, y) in ((X + 2, G - 8), (X - 4, 22), (X + 8, 16), (X - 3, 44)):
            sparkle(c, x, y, ZAP[1], ZAP[3])
    for (x0, y0, x1, y1) in (((X + 58, 46, X + 63, 54),) if f != 1 else ((X + 59, 44, X + 64, 52),)):
        bolt(c, zig(x0, y0, x1, y1, 2, 1.2, f), ELEC)
    glow_ring(c, TGOLD[2], TGOLD[3], every=1)
    sp = ((X + 60, 8, 2), (X + 2, 6, 1), (X + 62, 30, 2), (X - 2, 50, 1), (X + 50, 2, 0))
    for x, y, k in sp:
        if f == 1:
            y -= 2
        sparkle(c, x, y, SPARK[0] if k < 2 else TGOLD[3], WHITE)
    return c, (W, H)


# ======================================================================= export

def frames(fn):
    out = []
    for f in (0, 1, 2):
        c, (w, h) = fn(f)
        out.append((finalize(c, w, h), clipped(c, w, h)))
    return out


BOSSES = {
    'mini_toad_king': toad_king,
    'mid_hydra': hydra,
    'hard_plague_doctor': plague_doctor,
    'boss_swamp_behemoth': behemoth,
    'mini_harpy_queen': harpy_queen,
    'mid_thunder_griffin': griffin,
    'hard_storm_valkyrie': valkyrie,
    'boss_sky_titan': sky_titan,
}


def build():
    out = {}
    for name, fn in BOSSES.items():
        a, b, k = [cv for cv, _ in frames(fn)]
        out[name] = (a, {})
        out[name + '_b'] = (b, {})
        out[name + '_atk'] = (k, {})
    return out
