"""Méga boss « classiques » de fin de monde (étape 10), redessinés et animés.

  boss_slime_king      Roi Gluant (monde 1)          ≤ 60×58
  boss_alpha_wolf      Loup Alpha (monde 2)          ≤ 64×52
  boss_bone_lord       Seigneur des Os (monde 3)     ≤ 60×62
  boss_spectral_queen  Reine spectrale (Crypte)      ≤ 56×60 (volante)

Chaque boss : <nom> (repos), <nom>_b (marche / rebond / vol), <nom>_atk (attaque),
trois images recadrées sur la même boîte. Tournés vers la GAUCHE, pieds sur la dernière ligne
(sauf la reine, qui flotte). Lumière en haut à gauche, contour '#1a1226'.
"""
import math

from enemies import (group_box, Canvas, part, mask_of, shade_mask, spoly, sell, sline, slime_body, crop_to,
                     OUT, INK, WHITE, GOLD, RED_GEM, BLUE_GEM, BONE, DSTEEL, LEATHER, dk)

# ---------------------------------------------------------------- outils


def tube_mask(pts, widths):
    """Masque d'un ruban effilé le long d'une polyligne (widths : largeur à chaque point)."""
    def draw(m):
        for i in range(len(pts) - 1):
            (x0, y0), (x1, y1) = pts[i], pts[i + 1]
            w0, w1 = widths[i], widths[i + 1]
            n = max(2, int(math.hypot(x1 - x0, y1 - y0) * 2))
            for k in range(n + 1):
                u = k / n
                r = (w0 + (w1 - w0) * u) / 2
                m.ellipse(x0 + (x1 - x0) * u, y0 + (y1 - y0) * u, max(0.5, r), max(0.5, r), '#000')
    return mask_of(draw)


def tube(c, pts, widths, R, **kw):
    m = tube_mask(pts, widths)
    shade_mask(c, m, R, **kw)
    return m


def poly_mask(pts):
    return mask_of(lambda m: m.poly(pts, '#000'))


MAX_COLORS = 58


def triple(draw, fx=None, limit=None):
    """Trois images (repos, _b, _atk) contournées puis recadrées sur la même boîte."""
    frames = []
    for f in range(3):
        c = draw(f)
        c.outline(OUT)
        if fx:
            fx(c, f)
        frames.append(c)
    box = group_box(frames)
    out = [reduce_colors(crop_to(c, box)) for c in frames]
    if limit:
        w, h = out[0].w, out[0].h
        assert w <= limit[0] and h <= limit[1], (draw.__name__, w, h, limit)
    return out


def reduce_colors(c, limit=MAX_COLORS):
    """Fusionne les couleurs les plus rares dans leur plus proche voisine (déterministe)."""
    from lib import hex2rgb
    while True:
        count = {}
        for row in c.px:
            for p in row:
                if p is not None:
                    count[p] = count.get(p, 0) + 1
        if len(count) <= limit:
            return c
        rare = min(count, key=lambda k: (count[k], k))
        if rare == OUT:
            rare = min((k for k in count if k != OUT), key=lambda k: (count[k], k))
        r = hex2rgb(rare)
        near = min((k for k in count if k != rare), key=lambda k: (sum((a - b) ** 2 for a, b in zip(hex2rgb(k), r)), k))
        for row in c.px:
            for i, p in enumerate(row):
                if p == rare:
                    row[i] = near


def glint(c, x, y, core, arm):
    c.set(x, y, core)
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        c.set(x + dx, y + dy, arm)


def flame(c, x, base, h, w, F, lean=0.0):
    """Flamme en goutte (base ronde, pointe recourbée vers le haut), F : rampe sombre -> claire."""
    r = w / 2
    cy = base - r
    tip = (x + lean * h, base - h)
    mid = (x + lean * h * 0.45, cy - (h - r) * 0.5)
    pts = [(x - r, cy), (mid[0] - r * 0.7, mid[1]), tip, (mid[0] + r * 0.55, mid[1] + 0.5), (x + r, cy)]
    m = poly_mask(pts) | mask_of(lambda t: t.ellipse(x, cy, r, r, '#000'))
    shade_mask(c, m, F, contrast=0.25, bias=0.08)
    for (px, py) in mask_of(lambda t: t.ellipse(x - 0.2, cy + 0.3, r * 0.5, r * 0.62, '#000')):
        c.setf(px, py, F[-1])
    c.line(x, cy - r * 0.5, mid[0], mid[1], F[-2])


def tongue(c, x, base, h, F, phase=0.0, lean=0.0, w=2):
    """Langue de feu spectral pixel par pixel (ondule selon phase), F : rampe sombre -> claire."""
    for k in range(h):
        u = k / max(1, h - 1)
        xx = x + math.sin(k * 1.1 + phase) * 0.8 * u + lean * k
        ww = max(1, int(round(w * (1 - u) + 0.3)))
        col = F[-1] if u < 0.25 else (F[-2] if u < 0.6 else F[-3])
        if ww >= 3:
            c.set(xx - ww / 2 - 0.5, base - k, F[-3])
            c.set(xx + ww / 2 - 0.5, base - k, F[-3])
            ww -= 2
        for d in range(ww):
            c.set(xx + d - (ww - 1) / 2, base - k, col)


def wisp(c, x, y, F, phase=0.0, h=6):
    """Feu follet : boule lumineuse et traîne ondulante vers le haut."""
    c.ellipse(x, y, 2.8, 2.6, F[-4] if len(F) > 3 else F[0])
    c.ellipse(x - 0.3, y - 0.3, 2.0, 1.9, F[-3])
    tongue(c, x, y - 1.5, h, F, phase, w=4)
    c.ellipse(x - 0.4, y - 0.2, 1.1, 1.1, F[-1])


# ================================================================ ROI GLUANT

SK = ['#0d3a2e', '#166a3c', '#2e9e3c', '#62cc44', '#b0f07c']
SK_DEEP = '#0f4c34'
CAPE = ['#2e0a2a', '#5a1240', '#8a1e4a', '#c0344e', '#ec6a62']
ERMINE = ['#9a98b8', '#d8d8ea', '#f6f6ff']
GLOW_Y = ['#a04a0a', '#ffb02a', '#fff27a', '#ffffff']
ACID = ['#1a5a1a', '#3ab02a', '#8af04a', '#d8ff9a', '#ffffff']


def slime_king(f):
    c = Canvas(60, 58)
    G = 55
    if f == 0:
        cx, top, rx = 31, 18, 21.5
    elif f == 1:
        cx, top, rx = 31, 22, 23.0
    else:
        cx, top, rx = 32, 17, 20.5
    sq = top - 18  # décalage vertical du haut (rebond)
    body = slime_body(c, cx, top, G, rx, SK, flare=1.3)

    # trésors et victimes engloutis (silhouettes sombres dans la gelée)
    def inside(x, y, col):
        if (int(x), int(y)) in body:
            c.set(x, y, col)
    sx, sy = cx - 1, 47 + sq * 0.3
    for (x, y) in mask_of(lambda m: m.ellipse(sx, sy, 3.6, 3.2, '#000')):
        inside(x, y, SK_DEEP)
    for (x, y) in mask_of(lambda m: m.rect(int(sx) - 2, int(sy) + 2, 5, 3, '#000')):
        inside(x, y, SK_DEEP)
    inside(sx - 2, sy, SK[0]); inside(sx - 1, sy, SK[0]); inside(sx + 1, sy, SK[0]); inside(sx + 2, sy, SK[0])
    inside(sx - 1, sy + 3, SK[1]); inside(sx + 1, sy + 3, SK[1])
    c.line(cx - 15, 51, cx - 9, 43 + sq * 0.3, SK_DEEP)  # épée engloutie
    c.line(cx - 16, 48, cx - 12, 50, SK_DEEP)
    for (x, y, col) in ((cx + 14, 50, GOLD[3]), (cx + 15, 50, GOLD[2]), (cx + 2, 52, GOLD[2]), (cx + 3, 52, GOLD[1]),
                        (cx - 8, 51, BLUE_GEM[2]), (cx + 17, 46 + sq * 0.3, RED_GEM[2])):
        inside(x, y, col)
    for (x, y, r) in ((cx + 5, 36 + sq * 0.6, 1.6), (cx - 14, 46, 1.4), (cx + 18, 38 + sq * 0.5, 1.1)):
        c.ellipse(x, y, r, r, SK[3], only_inside=True)
        c.setf(x - 0.6, y - 0.6, SK[4])

    # cape royale drapée sur le dos (côté droit), bordure d'hermine
    def cape(t):
        right = cx + rx + 1.5
        pts = [(cx + 3, top + 4), (cx + 9, top + 1.5), (right - 5, top + 8), (right, G - 10), (right + 1.5, G + 0.5),
               (cx + 11, G + 0.5), (cx + 9, G - 8), (cx + 5, top + 16)]
        m = poly_mask(pts)
        shade_mask(t, m, CAPE, contrast=0.4)
        for i, k in enumerate((0.0, 0.33, 0.66)):
            x0 = cx + 10 + i * 4
            t.line(x0, top + 8 + i * 2, x0 + 2 + i, G - 1, CAPE[1])
            t.line(x0 - 1, top + 9 + i * 2, x0 + 1 + i, G - 2, CAPE[3])
        # hermine (bord avant)
        em = tube_mask([(cx + 5, top + 3), (cx + 6.5, top + 14), (cx + 9, G - 7), (cx + 10, G - 2)], [4, 4, 4, 4])
        em = {p for p in em if p in m or p[0] <= cx + 12}
        shade_mask(t, em, ERMINE, contrast=0.3)
        for i, y in enumerate(range(int(top) + 6, G - 1, 5)):
            xx = cx + 5.5 + (y - top) * 0.13
            t.set(xx + (i % 2), y, INK)
            t.set(xx + (i % 2), y + 1, INK)
    part(c, cape)

    # visage : yeux brûlants, sourcils féroces, sourire de crocs
    fx = cx - 9
    ey = top + 13 - (2 if f == 1 else 0) + (1 if f == 2 else 0)
    for i, ex in enumerate((fx - 8, fx + 2)):
        c.rect(ex, ey, 6, 5, INK)
        c.set(ex, ey + 4, SK[1]); c.set(ex + 5, ey + 4, SK[1])
        c.rect(ex + 1, ey + 1, 3, 3, GLOW_Y[1])
        c.set(ex + 1, ey + 1, GLOW_Y[2]); c.set(ex + 2, ey + 1, GLOW_Y[2]); c.set(ex + 1, ey + 2, GLOW_Y[2])
        c.set(ex + 1, ey + 1, WHITE)
        c.set(ex + 3, ey + 3, GLOW_Y[0])
        c.set(ex + (3 if i == 0 else 1), ey + 2, INK)  # pupille fendue
        c.set(ex + (3 if i == 0 else 1), ey + 3, INK)
    # sourcils en V
    c.line(fx - 10, ey - 4, fx - 2, ey - 1, INK); c.line(fx - 10, ey - 3, fx - 3, ey, INK)
    c.line(fx + 1, ey - 1, fx + 9, ey - 4, INK); c.line(fx + 2, ey, fx + 9, ey - 3, INK)
    my = ey + 8
    if f == 2:
        # gueule béante qui crache
        mm = mask_of(lambda m: m.ellipse(fx, my + 3, 6.5, 4.6, '#000'))
        for (x, y) in mm:
            c.set(x, y, INK)
        for (x, y) in mask_of(lambda m: m.ellipse(fx, my + 4, 4.6, 2.8, '#000')):
            c.set(x, y, '#6a1024')
        for (x, y) in mask_of(lambda m: m.ellipse(fx + 1, my + 5.5, 3, 1.4, '#000')):
            c.set(x, y, '#d0405a')
        for x in (fx - 5, fx - 2, fx + 2, fx + 5):
            c.set(x, my, WHITE); c.set(x, my + 1, WHITE)
        for x in (fx - 3, fx + 3):
            c.set(x, my + 6, WHITE)
    else:
        w = 15
        x0 = fx - 7
        for x in range(x0, x0 + w):
            dy = 0 if x in (x0, x0 + w - 1) else 1
            c.set(x, my + dy, INK)
        for x in range(x0 + 2, x0 + w - 2):
            c.set(x, my + 2, INK)
            c.set(x, my + 3, INK)
            c.set(x, my + 2, '#6a1024')
        for x in range(x0 + 4, x0 + w - 4):
            c.set(x, my + 4, INK)
        c.set(fx, my + 3, '#d0405a'); c.set(fx + 1, my + 3, '#d0405a')
        for x in (x0 + 2, x0 + 5, x0 + w - 6, x0 + w - 3):
            c.set(x, my + 1, WHITE); c.set(x, my + 2, WHITE)
        c.set(x0 + 2, my + 3, WHITE); c.set(x0 + w - 3, my + 3, WHITE)

    # bras gluant + sceptre
    def arm(t):
        if f == 2:
            pts = [(cx - rx + 4, top + 21), (cx - rx - 1, top + 14), (9, 17)]
            tube(t, pts, [7, 5, 4], SK, contrast=0.4)
        else:
            hy = 38 + (3 if f == 1 else 0)
            pts = [(cx - rx + 4, hy + 7), (cx - rx - 1, hy + 3), (7, hy)]
            tube(t, pts, [8, 5, 4.5], SK, contrast=0.4)
    part(c, arm)

    def scepter(t):
        if f == 2:
            base, tip = (13, 28), (6, 11)
        else:
            dy = 3 if f == 1 else 0
            base, tip = (8, 53), (6, 17 + dy)
        sline(t, base[0], base[1], tip[0], tip[1], GOLD, 2)
        # orbe de rubis serti
        ox, oy = tip[0] - (0.3 if f == 2 else 0), tip[1] - 2
        spoly(t, [(ox - 3.5, oy + 2), (ox + 3.5, oy + 2), (ox + 1.5, oy + 4.5), (ox - 1.5, oy + 4.5)], GOLD)
        sell(t, ox, oy - 0.5, 3.2, 3.2, ['#4a0a2a', '#a0183a', '#e8344a', '#ff8a8a', '#ffe0e0'])
        t.set(ox - 1, oy - 2, WHITE)
        t.set(ox, oy - 4.5, GOLD[3]); t.set(ox, oy - 5.5, GOLD[4])
        t.set(ox - 1, oy - 4.5, GOLD[2]); t.set(ox + 1, oy - 4.5, GOLD[1])
    part(c, scepter)
    if f != 2:
        # « main » gluante qui enserre le sceptre
        hy = 38 + (3 if f == 1 else 0)
        sell(c, 7.5, hy, 3, 2.6, SK)
        c.set(6, hy - 1, SK[4])

    # couronne massive (pointes, gemmes, velours)
    def cr(t):
        x0, y0, w = cx - 13, top - 12, 22
        spoly(t, [(x0 + 3, y0 + 5), (x0 + w - 3, y0 + 5), (x0 + w - 4, y0 + 11), (x0 + 4, y0 + 11)], CAPE)
        pts = [(x0, y0 + 14), (x0 - 1, y0 + 2), (x0 + 3, y0 + 7), (x0 + 6, y0 - 2), (x0 + 9, y0 + 6),
               (x0 + w / 2 + 0.5, y0 - 4), (x0 + w - 8, y0 + 6), (x0 + w - 5, y0 - 2), (x0 + w - 2, y0 + 7),
               (x0 + w + 1, y0 + 2), (x0 + w, y0 + 14)]
        shade_mask(t, poly_mask(pts), GOLD, contrast=0.45)
        # bandeau
        for x in range(int(x0), int(x0 + w + 1)):
            t.set(x, y0 + 10, GOLD[3])
            t.set(x, y0 + 13, GOLD[1])
        for (gx, col) in ((x0 + 3, BLUE_GEM), (x0 + w / 2, RED_GEM), (x0 + w - 3, BLUE_GEM)):
            t.set(gx, y0 + 11, col[2]); t.set(gx + 1, y0 + 11, col[1]); t.set(gx, y0 + 12, col[1]); t.set(gx + 1, y0 + 12, col[0])
            t.set(gx, y0 + 11, col[3])
        for (px, py) in ((x0 - 1, y0 + 2), (x0 + 6, y0 - 2), (x0 + w / 2 + 0.5, y0 - 4), (x0 + w - 5, y0 - 2), (x0 + w + 1, y0 + 2)):
            t.set(px, py - 1, GOLD[4])
        t.set(x0 + w / 2, y0 + 2, RED_GEM[2]); t.set(x0 + w / 2 + 1, y0 + 2, RED_GEM[1]); t.set(x0 + w / 2, y0 + 1, RED_GEM[3])
    part(c, cr)

    if f == 2:
        # crachat d'acide
        def spit(t):
            gy = my + 3
            tube(t, [(fx - 5, gy), (15, gy + 0.5), (10, gy + 0.5)], [6, 3, 3], ACID, contrast=0.3)
            sell(t, 7, gy + 0.5, 5.2, 4.6, ACID)
            sell(t, 6, gy, 2.6, 2, ACID[2:])
            t.set(4.5, gy - 1.5, WHITE); t.set(5.5, gy - 2, WHITE)
            for (x, y, r) in ((9, gy + 6, 1.2), (4, gy + 6, 1)):
                sell(t, x, y, r, r + 0.4, ACID)
        part(c, spit)
    # flaques au sol
    c.set(cx + rx + 3, G, SK[2]); c.set(cx + rx + 4, G, SK[1]); c.set(cx + rx + 3, G - 1, SK[3])
    return c


def slime_king_fx(c, f):
    top = (18, 22, 17)[f]
    # éclats d'aura dorée autour de la couronne
    for (x, y, big) in ((12 + f, top - 5, True), (47 - f, top - 4, True), (14, top - 11 + f, False), (44, top + 6, False)):
        if c.get(x, y) is None:
            (glint(c, x, y, GLOW_Y[3], GLOW_Y[2]) if big else c.set(x, y, GLOW_Y[2]))
    if f == 2:
        for (x, y) in ((2, 36), (1, 46), (13, 47), (12, 35), (4, 49)):
            if c.get(x, y) is None:
                c.set(x, y, ACID[3])
    else:
        for (x, y) in ((53, 28 + f * 3), (56, 40)):
            if c.get(x, y) is None:
                c.set(x, y, SK[3])


def boss_slime_king():
    return triple(slime_king, slime_king_fx, (60, 58))


# ================================================================ LOUP ALPHA

FUR = ['#100a1c', '#21182f', '#362a48', '#53466a', '#76698e']
HEADF = ['#1a1228', '#2e2442', '#463a5c', '#665a80', '#8e82a8']
MANE = ['#07040e', '#140c20', '#241632', '#382646', '#52385e']
BELLY = ['#2c2438', '#4c425a', '#6e6480', '#968ca6']
W_EYE = ['#7a0606', '#ff2a14', '#ff9a4a', '#ffffff']
SCAR = ['#9a3a4e', '#d8707e']
IRON = ['#14141e', '#2c2c40', '#4e5068', '#8088a4', '#c8d0e4']
GUM = ['#3a0610', '#7a1024', '#c02a40', '#ff6a7a']
CLAW = '#e8e4d8'


def wolf_leg(c, top, knee, paw, R, w=5.5):
    tube(c, [top, knee, paw], [w + 2.5, w, w - 1.2], R, contrast=0.4)
    px, py = paw
    sell(c, px - 0.5, py + 0.3, 3.4, 1.9, R)
    for k in range(3):
        c.set(px - 3.4 + k * 1.4, py + 1.3, CLAW)


def wolf_pose(f):
    ox = (0, 0, 0)[f]
    oy = (0, 1, 2)[f]
    hx, hy = 12 + ox, 19 + oy + (2 if f == 2 else 0)
    return ox, oy, hx, hy


def alpha_wolf(f):
    c = Canvas(64, 52)
    G = 49
    ox, oy, hx, hy = wolf_pose(f)
    far = dk(FUR, -0.05)

    # queue en panache
    def tail(t):
        if f == 1:
            pts = [(52, 22 + oy), (56, 19 + oy), (59, 17 + oy)]
        else:
            pts = [(51, 21 + oy), (55, 14 + oy), (58, 8 + oy)]
        tube(t, pts, [6, 6.5, 2.5], FUR, contrast=0.45)
        tx, ty = pts[2]
        t.line(pts[1][0], pts[1][1] - 1, tx - 0.5, ty, FUR[4])
    part(c, tail)

    # pattes arrière-plan
    if f == 0:
        fl, hl = ((24, 30), (23, 39), (21, G - 2)), ((50, 30), (55, 39), (51, G - 2))
    elif f == 1:
        fl, hl = ((24, 31), (28, 39), (30, G - 2)), ((49, 31), (48, 40), (41, G - 2))
    else:
        fl, hl = ((22, 31), (19, 39), (16, G - 2)), ((50, 31), (56, 39), (53, G - 2))
    part(c, lambda t: wolf_leg(t, fl[0], fl[1], fl[2], far))
    part(c, lambda t: wolf_leg(t, hl[0], hl[1], hl[2], far))

    # corps : arrière-train, torse, poitrail
    def body(t):
        sell(t, 46, 27 + oy, 9, 9, FUR)
        sell(t, 34 + ox * 0.6, 25 + oy, 15, 9, FUR)
        for (x, y) in mask_of(lambda m: m.ellipse(33 + ox * 0.6, 31 + oy, 11, 3, '#000')):
            t.setf(x, y, BELLY[1])
        sell(t, 21 + ox, 26 + oy, 9, 10, FUR)
        for (x, y) in mask_of(lambda m: m.ellipse(17 + ox, 30 + oy, 5, 6, '#000')):
            t.setf(x, y, BELLY[2])
        for i in range(4):
            t.setf(15 + ox + i, 33 + oy + (i % 2), BELLY[3])
        # cicatrices sur le flanc
        for i in range(3):
            t.line(39 + i * 3, 22 + oy, 42 + i * 3, 29 + oy, SCAR[0])
            t.line(39 + i * 3, 22 + oy, 40 + i * 3, 24 + oy, SCAR[1])
    part(c, body)

    # pattes avant-plan
    if f == 0:
        fn_, hn = ((19, 31), (17, 40), (14, G - 2)), ((45, 31), (50, 40), (45, G - 2))
    elif f == 1:
        fn_, hn = ((18, 31), (12, 38), (6, G - 3)), ((46, 31), (52, 37), (56, G - 4))
    else:
        fn_, hn = ((16, 32), (12, 40), (8, G - 2)), ((45, 31), (50, 40), (44, G - 2))
    part(c, lambda t: wolf_leg(t, fn_[0], fn_[1], fn_[2], FUR))
    part(c, lambda t: wolf_leg(t, hn[0], hn[1], hn[2], FUR))

    # crinière hérissée sur nuque et épaules
    def mane(t):
        b = 12 + oy
        pts = [(14 + ox, b + 10), (14 + ox, b + 2), (17 + ox, b - 1), (18 + ox, b - 7), (22 + ox, b - 2),
               (25 + ox, b - 9), (28 + ox, b - 2), (32 + ox, b - 7), (34 + ox, b - 1), (39, b - 5),
               (40, b + 1), (45, b - 1), (43, b + 5), (34, b + 9), (25 + ox, b + 16), (19 + ox, b + 20)]
        shade_mask(t, poly_mask(pts), MANE, contrast=0.5)
        for (x0, y0, x1, y1) in ((18, b - 6, 20, b + 3), (25, b - 8, 25, b + 4), (32, b - 6, 30, b + 5), (39, b - 4, 37, b + 4)):
            t.line(x0 + ox, y0 + 1, x1 + ox, y1, MANE[3])
    part(c, mane)

    # plaque d'épaule en fer, deux grosses pointes
    def pauldron(t):
        px, py = 31 + ox, 21 + oy
        for (sx, sy, ex, ey) in ((px - 2, py - 3, px - 2, py - 10), (px + 4, py - 3, px + 7, py - 9)):
            spoly(t, [(sx - 2.2, sy + 1), (ex, ey), (sx + 2.2, sy + 1)], IRON, contrast=0.5)
            t.set(ex, ey + 1, IRON[4])
        sell(t, px, py, 6.5, 4.2, dk(IRON, -0.06))
        t.line(px - 6, py + 2, px + 6, py + 2, IRON[1])
        for k in range(4):
            t.set(px - 4 + k * 3, py + 3, IRON[3])
    part(c, pauldron)

    # tête
    def head(t):
        R = HEADF
        # oreilles
        spoly(t, [(hx + 3, hy - 5), (hx + 8, hy - 15), (hx + 9, hy - 3)], dk(R, -0.06), contrast=0.5)
        spoly(t, [(hx - 1, hy - 5), (hx + 2, hy - 14), (hx + 5, hy - 4)], R, contrast=0.5)
        t.line(hx + 2, hy - 11, hx + 3, hy - 6, GUM[1])
        t.line(hx + 1, hy - 12, hx + 1, hy - 8, R[4])
        # crâne
        sell(t, hx + 2, hy, 7.5, 6.5, R)
        # touffes de joue
        spoly(t, [(hx + 5, hy + 2), (hx + 11, hy + 3), (hx + 8, hy + 6), (hx + 10, hy + 9), (hx + 3, hy + 7)], MANE)
        if f == 2:
            # gueule grande ouverte (mâchoire sup. relevée, inf. tombante)
            spoly(t, [(hx + 4, hy + 2), (hx - 12, hy - 1), (hx - 9, hy + 10), (hx + 4, hy + 6)], GUM, edge=False)
            spoly(t, [(hx - 13, hy - 4), (hx - 6, hy - 6), (hx + 2, hy - 4), (hx + 4, hy + 2), (hx - 4, hy + 1), (hx - 13, hy - 1)], R, contrast=0.45)
            t.line(hx - 11, hy - 5, hx - 3, hy - 5, R[4])
            spoly(t, [(hx - 10, hy + 9), (hx + 3, hy + 5), (hx + 5, hy + 8), (hx - 7, hy + 13)], R, contrast=0.4)
            for (x, y) in poly_mask([(hx - 9, hy + 11), (hx + 3, hy + 7), (hx + 4, hy + 9), (hx - 7, hy + 13)]):
                t.setf(x, y, BELLY[1])
            spoly(t, [(hx - 7, hy + 7), (hx + 1, hy + 4), (hx + 2, hy + 6), (hx - 6, hy + 9)], [GUM[2], GUM[3], '#ffa0a8'], edge=False)
            for (x, y, d) in ((hx - 12, hy - 1, 1), (hx - 7, hy, 1), (hx - 2, hy + 1, 1),
                              (hx - 8, hy + 8, -1), (hx - 4, hy + 7, -1), (hx, hy + 5, -1)):
                t.set(x, y, WHITE); t.set(x, y + d, WHITE)
                if x in (hx - 12, hx - 8):
                    t.set(x, y + 2 * d, WHITE)
            t.set(hx - 14, hy - 4, INK); t.set(hx - 13, hy - 4, INK); t.set(hx - 14, hy - 3, INK)
        else:
            # museau retroussé, babines qui grondent
            spoly(t, [(hx - 12, hy + 2), (hx - 6, hy - 2), (hx + 2, hy - 1), (hx + 4, hy + 5), (hx - 3, hy + 6), (hx - 11, hy + 5)], R, contrast=0.45)
            t.line(hx - 10, hy + 1, hx - 3, hy - 1, R[4])
            spoly(t, [(hx - 10, hy + 6), (hx + 3, hy + 5), (hx + 4, hy + 8), (hx - 7, hy + 9)], GUM, edge=False)
            spoly(t, [(hx - 8, hy + 8), (hx + 3, hy + 7), (hx + 4, hy + 10), (hx - 5, hy + 11)], R, contrast=0.4)
            for (x, y) in poly_mask([(hx - 7, hy + 9), (hx + 3, hy + 8), (hx + 3, hy + 10), (hx - 5, hy + 11)]):
                t.setf(x, y, BELLY[1])
            for (x, y, d) in ((hx - 9, hy + 5, 1), (hx - 5, hy + 5, 1), (hx - 1, hy + 5, 1), (hx - 7, hy + 8, -1), (hx - 3, hy + 7, -1)):
                t.set(x, y, WHITE); t.set(x, y + d, WHITE)
            t.set(hx - 9, hy + 7, WHITE)
            t.set(hx - 13, hy + 2, INK); t.set(hx - 12, hy + 2, INK); t.set(hx - 13, hy + 3, INK); t.set(hx - 12, hy + 1, '#5a5a7a')
            for k in range(3):
                t.set(hx - 8 + k * 2, hy + 2 + (k == 1), R[1])
        ey = hy - 3
        # œil rouge incandescent + sourcil
        ex = hx - 3
        t.rect(ex - 1, ey, 5, 3, INK)
        t.rect(ex, ey + 1, 3, 1, W_EYE[1])
        t.set(ex - 1, ey + 1, W_EYE[2]); t.set(ex, ey, W_EYE[2]); t.set(ex + 1, ey, W_EYE[1])
        t.set(ex, ey + 1, W_EYE[3])
        t.set(ex + 3, ey + 2, W_EYE[0])
        t.line(ex - 3, ey - 2, ex + 4, ey, INK); t.line(ex - 2, ey - 1, ex + 4, ey + 1, INK)
        # balafre à travers l'œil
        t.line(ex + 3, ey - 5, ex + 1, ey - 2, SCAR[1]); t.line(ex + 0, ey + 3, ex - 1, ey + 5, SCAR[1])
        t.set(ex + 4, ey - 5, SCAR[0]); t.set(ex - 2, ey + 6, SCAR[0])
    part(c, head)

    # collier de fer à pointes autour du cou
    def collar(t):
        band = tube(t, [(hx + 8, hy - 5), (hx + 7, hy + 4), (hx + 4, hy + 11)], [4, 4.5, 4], dk(IRON, -0.08), contrast=0.4)
        for (bx_, by_, ex, ey) in ((hx + 9, hy - 5, hx + 12, hy - 11), (hx + 9, hy + 1, hx + 14, hy - 2)):
            spoly(t, [(bx_ - 2.2, by_), (ex, ey), (bx_ + 2.2, by_ + 1.5)], IRON, contrast=0.5)
            t.set(ex, ey + 1, IRON[4])
        for y in (hy - 3, hy + 2, hy + 7):
            t.set(hx + 7 - (y > hy + 4), y, IRON[4])
        sell(t, hx + 3, hy + 12, 1.8, 1.8, GOLD)
        t.set(hx + 3, hy + 12, RED_GEM[2])
        return band
    part(c, collar)
    return c


def alpha_wolf_fx(c, f):
    ox, oy, hx, hy = wolf_pose(f)
    ey = hy - 3
    ex = hx - 3
    # traînée lumineuse de l'œil
    for k, col in enumerate((W_EYE[2], W_EYE[1], W_EYE[1], W_EYE[0])):
        x, y = ex + 5 + k * 2, ey + 1 - k * 0.3
        if c.get(x, y) is None:
            c.set(x, y, col)
    # braises qui s'élèvent du dos
    for (x, y, col) in ((33, 1 + f, '#ff4a2a'), (41, 4 - f, '#c0182a'), (21, 1, '#c0182a'), (47, 10 + f, '#ff4a2a'), (28, 0 + f, '#ff9a4a')):
        if c.get(x, y) is None:
            c.set(x, y, col)
    if f == 2:
        # traits de morsure
        for (x, y) in ((-1, 13), (-2, 25), (0, 30)):
            if c.get(x, y) is None:
                c.set(x, y, WHITE)


def boss_alpha_wolf():
    return triple(alpha_wolf, alpha_wolf_fx, (64, 52))


# ================================================================ SEIGNEUR DES OS

GFL = ['#0a3a2a', '#14904a', '#3ae070', '#aaffb4', '#f0fff4']
CAPE_B = ['#0c0a16', '#1c1428', '#2e1e3c', '#46305a', '#664a7c']
AXE = ['#1c1c2c', '#3a3c54', '#646a88', '#a0aac4', '#e8eef8']
WOOD_DARK = ['#1e1010', '#3a2018', '#5e3a22', '#86562e', '#b07a40']
CROWN_G = ['#2a1a10', '#5a3a14', '#a0681c', '#e0a838', '#fff0a0']


def bone_tube(c, a, b, w=3, R=BONE):
    tube(c, [a, b], [w, w], R[1:], contrast=0.45)


def lord_pose(f):
    oy = (4, 5, 6)[f]
    bx = (0, 0, -3)[f]
    hx, hy = 29 + bx, 12 + oy + (1 if f == 2 else 0)
    return oy, bx, hx, hy


def bone_lord(f):
    c = Canvas(60, 62)
    G = 60
    oy, bx, hx, hy = lord_pose(f)

    # cape en lambeaux
    def cape(t):
        sway = (0, 2, 4)[f]
        pts = [(24 + bx, 21 + oy), (42 + bx, 21 + oy), (47 + sway, 40), (51 + sway, 56), (48 + sway, 54), (46 + sway, 58),
               (42 + sway, 54), (39 + sway * 0.6, 58), (36 + sway * 0.5, 53), (33, 57), (31, 47)]
        shade_mask(t, poly_mask(pts), CAPE_B, contrast=0.45)
        for k in range(4):
            x0 = 30 + k * 4 + bx
            t.line(x0, 25 + oy, x0 + 3 + k * 2 + sway * 0.6, 53, CAPE_B[0])
            t.line(x0 + 1, 25 + oy, x0 + 4 + k * 2 + sway * 0.6, 51, CAPE_B[3])
    part(c, cape)

    # jambes
    if f == 0:
        legs = (((35, 41), (37, 52), (38, G - 2)), ((28, 41), (26, 52), (25, G - 2)))
    elif f == 1:
        legs = (((35, 41), (40, 51), (43, G - 2)), ((28, 41), (24, 51), (20, G - 2)))
    else:
        legs = (((34, 41), (40, 52), (44, G - 2)), ((27, 41), (21, 51), (16, G - 2)))
    for i, (hip, knee, foot) in enumerate(legs):
        R = dk(BONE, -0.1) if i == 0 else BONE

        def leg(t, hip=hip, knee=knee, foot=foot, R=R, i=i):
            hip = (hip[0] + bx, hip[1] + oy)
            bone_tube(t, hip, knee, 4, R)
            bone_tube(t, knee, (foot[0], foot[1] - 2), 3, R)
            D = dk(DSTEEL, -0.06) if i == 0 else DSTEEL
            kx, ky = knee
            spoly(t, [(kx - 3, ky + 1), (kx + 2.5, ky + 1), (foot[0] + 2, foot[1] - 3), (foot[0] - 2.5, foot[1] - 3)], D, contrast=0.5)
            sell(t, kx, ky, 3, 2.6, R)
            t.set(kx - 1, ky - 1, R[4])
            spoly(t, [(foot[0] - 5, foot[1] + 2), (foot[0] - 4, foot[1] - 2), (foot[0] + 3, foot[1] - 3), (foot[0] + 3, foot[1] + 2)], D, contrast=0.5)
            t.set(foot[0] - 5, foot[1] + 1, D[4])
        part(c, leg)

    # bassin + jupe d'armure
    def skirt(t):
        x0, y0 = 22 + bx, 35 + oy
        spoly(t, [(x0, y0), (x0 + 19, y0), (x0 + 21, y0 + 7), (x0 + 15, y0 + 9), (x0 + 10, y0 + 7), (x0 + 5, y0 + 9), (x0 - 2, y0 + 7)], DSTEEL, contrast=0.45)
        for x in range(x0, x0 + 20):
            t.set(x, y0, GOLD[2] if x < x0 + 10 else GOLD[1])
        for xx in (x0 + 5, x0 + 10, x0 + 15):
            t.line(xx, y0 + 2, xx, y0 + 7, DSTEEL[0])
        sell(t, x0 + 10, y0 + 1.5, 2.2, 2.2, BONE)
        t.set(x0 + 9, y0 + 1, INK); t.set(x0 + 11, y0 + 1, INK)
    part(c, skirt)

    hand_b = (18 + bx, 30 + oy) if f == 2 else (19 + bx, 31 + oy)

    def back_arm(t):
        sh = (39 + bx, 24 + oy)
        el = (40 + bx, 32 + oy) if f != 2 else (32 + bx, 30 + oy)
        bone_tube(t, sh, el, 3, dk(BONE, -0.1))
        bone_tube(t, el, hand_b, 3, dk(BONE, -0.1))
    part(c, back_arm)

    # cage thoracique + flamme d'âme
    def torso(t):
        x0, y0 = 23 + bx, 20 + oy
        spoly(t, [(x0, y0), (x0 + 17, y0), (x0 + 15, y0 + 16), (x0 + 2, y0 + 16)], BONE[1:], contrast=0.4)
        for (x, y) in poly_mask([(x0 + 3, y0 + 2), (x0 + 14, y0 + 2), (x0 + 12, y0 + 14), (x0 + 5, y0 + 14)]):
            t.setf(x, y, '#1c1226')
        for k, y in enumerate(range(y0 + 3, y0 + 15, 3)):
            t.line(x0 + 1 + k * 0.3, y, x0 + 7, y + 1, BONE[2])
            t.line(x0 + 1 + k * 0.3, y + 1, x0 + 7, y + 2, BONE[0])
            t.line(x0 + 10, y + 1, x0 + 16 - k * 0.4, y, BONE[1])
        flame(t, x0 + 8.5, y0 + 14, 9, 6, GFL)
        for y in range(y0 + 1, y0 + 16):
            t.set(x0 + 8, y, BONE[3] if y % 2 else BONE[2])
    part(c, torso)

    # crâne
    def head(t):
        sell(t, hx, hy, 8.5, 7.5, BONE)
        spoly(t, [(hx - 7, hy + 3), (hx + 4, hy + 3), (hx + 4, hy + 9), (hx - 5, hy + 9)], BONE[1:], bias=0.12)
        for ex in (hx - 4.5, hx + 2.2):
            t.ellipse(ex, hy + 1, 2.6, 2.7, INK)
        t.set(hx - 1, hy + 4, INK); t.set(hx - 1, hy + 5, INK); t.set(hx, hy + 5, INK)
        # arcade sourcilière froncée
        t.line(hx - 8, hy - 3, hx - 3, hy - 1, BONE[0]); t.line(hx + 5, hy - 3, hx + 1, hy - 1, BONE[0])
        ty = hy + 7 + (1 if f == 2 else 0)
        t.line(hx - 6, ty - 1, hx + 3, ty - 1, BONE[1])
        for x in range(int(hx - 6), int(hx + 4), 2):
            t.set(x, ty, INK)
            t.set(x + 1, ty, BONE[3])
        if f == 2:
            t.line(hx - 6, ty - 1, hx + 3, ty - 1, INK)
        t.line(hx + 3, hy - 6, hx + 5, hy - 2, BONE[0]); t.set(hx + 6, hy - 1, BONE[0])
        t.set(hx - 6, hy - 4, BONE[4]); t.set(hx - 5, hy - 5, BONE[4])
        # flammes vertes dans les orbites
        for ex in (hx - 4.5, hx + 2.2):
            ex = int(ex)
            t.set(ex - 1, hy, GFL[3]); t.set(ex, hy, GFL[4]); t.set(ex - 1, hy + 1, GFL[2]); t.set(ex, hy + 1, GFL[3])
            t.set(ex - 1, hy + 2, GFL[1]); t.set(ex + 1, hy + 1, GFL[1])
    part(c, head)

    # couronne aux pointes acérées
    def crown_(t):
        x0, b, w = hx - 9, hy - 5, 17
        pts = [(x0, b), (x0 - 1, b - 7), (x0 + 3, b - 4), (x0 + 5, b - 8), (x0 + 7, b - 4), (x0 + w / 2, b - 10),
               (x0 + w - 7, b - 4), (x0 + w - 5, b - 8), (x0 + w - 3, b - 4), (x0 + w + 1, b - 7), (x0 + w, b)]
        shade_mask(t, poly_mask(pts), CROWN_G, contrast=0.45)
        for x in range(int(x0), int(x0 + w + 1)):
            t.set(x, b - 1, CROWN_G[1])
            t.set(x, b - 3, CROWN_G[3])
        for gx in (x0 + 3, x0 + w / 2, x0 + w - 3):
            t.set(gx, b - 2, GFL[2]); t.set(gx + 1, b - 2, GFL[1])
        t.set(x0 + w / 2, b - 7, GFL[3]); t.set(x0 + w / 2, b - 6, GFL[2])
    part(c, crown_)

    # pauldrons d'os à pointes
    def pauldrons(t):
        sx, sy = 39 + bx, 21 + oy
        sell(t, sx, sy, 5, 4, dk(DSTEEL, -0.04))
        sx, sy = 22 + bx, 21 + oy
        for (ax, ay, tx, ty) in ((sx - 3, sy - 2, sx - 6, sy - 9), (sx + 1, sy - 3, sx + 1, sy - 10), (sx + 4, sy - 2, sx + 6, sy - 7)):
            spoly(t, [(ax - 1.8, ay + 1), (tx, ty), (ax + 1.8, ay + 1)], DSTEEL, contrast=0.5)
            t.set(tx, ty + 0.5, DSTEEL[4])
        sell(t, sx, sy, 6.5, 5, DSTEEL)
        sell(t, sx - 1, sy + 1, 2.6, 2.2, BONE)
        t.set(sx - 2, sy + 1, GFL[2]); t.set(sx, sy + 1, INK)
        t.set(sx - 1, sy + 3, BONE[1])
    part(c, pauldrons)

    # hache de guerre
    def axe(t):
        if f == 2:
            top, bot = (3, 45), (23 + bx, 24 + oy)
        else:
            top, bot = (12, 9), (15, 57)
        sline(t, top[0], top[1], bot[0], bot[1], WOOD_DARK, 3)
        dx, dy = bot[0] - top[0], bot[1] - top[1]
        L = math.hypot(dx, dy)
        ux, uy = dx / L, dy / L
        nx, ny = -uy, ux
        ax_, ay_ = top[0] + ux * 5, top[1] + uy * 5
        for s in (1, -1):
            p = lambda a, b: (ax_ + ux * a + nx * b * s, ay_ + uy * a + ny * b * s)
            pts = [p(-3, 1), p(-7, 6), p(-6, 9), p(0, 7.5), p(6, 9), p(7, 6), p(3, 1)]
            shade_mask(t, poly_mask(pts), AXE, contrast=0.5)
            for a in range(-5, 6):
                t.set(*p(a, 8 - abs(a) * 0.12), AXE[4])
        t.set(top[0] - ux * 2, top[1] - uy * 2, AXE[4])
        t.set(top[0] - ux, top[1] - uy, AXE[3])
        sell(t, ax_, ay_, 2.2, 2.2, GOLD)
        t.set(ax_, ay_, GFL[2])
        for a in (16, 20):
            t.set(top[0] + ux * a + nx, top[1] + uy * a + ny, LEATHER[3])
            t.set(top[0] + ux * a, top[1] + uy * a, LEATHER[2])
        sell(t, bot[0] + ux, bot[1] + uy, 1.8, 1.8, GOLD)
    part(c, axe)

    def front_arm(t):
        sh = (22 + bx, 23 + oy)
        if f == 2:
            el, hand = (17 + bx, 27 + oy), (13 + bx, 31 + oy)
        else:
            el, hand = (18 + bx, 29 + oy), (14, 35 + oy * 0.4)
        bone_tube(t, sh, el, 4)
        bone_tube(t, el, hand, 3)
        sell(t, hand[0], hand[1], 2.6, 2.4, BONE)
        t.set(hand[0] - 1, hand[1] - 1, BONE[4])
        sell(t, el[0] + 0.5, el[1] + 1.5, 2.6, 2.2, DSTEEL)
    part(c, front_arm)
    return c


def bone_lord_fx(c, f):
    oy, bx, hx, hy = lord_pose(f)
    if f == 2:
        # croissant spectral de la frappe (de haut en bas, devant le boss)
        cx, cy = 24 + bx, 26 + oy
        n = 60
        for i in range(n):
            th = math.radians(262 - i * 2)
            u = i / (n - 1)
            thick = 1 + int(3 * math.sin(u * math.pi * 0.85))
            for k in range(thick):
                r = 27 - k
                x = cx + math.cos(th) * r * 0.78
                y = cy + math.sin(th) * r
                if c.get(x, y) is None:
                    c.set(x, y, (GFL[4], GFL[3], GFL[2], GFL[1])[k])
        for (x, y) in ((2, 58), (6, 57), (10, 59), (0, 52)):
            if c.get(x, y) is None:
                c.set(x, y, GFL[3])
    else:
        for (x, y) in ((44, 6 + f), (47, 14 - f), (5, 30 + f), (37, 1)):
            if c.get(x, y) is None:
                c.set(x, y, GFL[3])


def boss_bone_lord():
    return triple(bone_lord, bone_lord_fx, (60, 62))


# ================================================================ REINE SPECTRALE

ROBE = ['#120a30', '#24185a', '#3a2c8a', '#5a54b8', '#8c90e0']
VEIL = ['#2a3a7a', '#4a72b8', '#7ab4e4', '#c0ecff', '#f4ffff']
SFL = ['#3a0a6a', '#7a2ad0', '#b46aff', '#e4b8ff', '#ffffff']
SKIN_G = ['#6a7ac0', '#b0c8f0', '#e0eeff', '#ffffff']
HAIR_G = ['#1c1a52', '#33438e', '#5e80c8', '#a8d4f6']
SILVER = ['#3a2a5a', '#7a6aa8', '#b8b4dc', '#ecebff', '#ffffff']
CYAN = ['#0a4a7a', '#1aa0d8', '#6ae8ff', '#d0fcff', '#ffffff']


def queen_pose(f):
    return (0, -1, 0)[f], (0.0, 1.8, 0.9)[f]


def spectral_queen(f):
    c = Canvas(56, 60)
    oy, ph = queen_pose(f)

    # grand voile spectral qui flotte derrière (vers la droite)
    def veil(t):
        w = math.sin(ph) * 2.0
        v = math.cos(ph) * 1.5
        pts = [(25, 3), (33, 3 + w * 0.3), (40, 6 - w), (46, 11 + w * 0.5), (51, 19 - w), (52, 27 + v),
               (48, 24 + w), (47, 31 - v), (43, 27), (41, 32 + w), (37, 25), (33, 20), (29, 15)]
        m = poly_mask([(x, y + oy) for x, y in pts])
        shade_mask(t, m, VEIL, contrast=0.4, bias=-0.08)
        for (x, y) in m:
            if x > 45 + w and (x + y) % 2 == 0:
                t.set(x, y, None)
            elif x > 43 and (x + y) % 2 == 0:
                t.set(x, y, VEIL[1])
        for k in range(3):
            t.line(30 + k * 3, 6 + k * 2 + oy, 44 + k * 2, 14 + k * 5 + oy - w, VEIL[1])
            t.line(30 + k * 3, 5 + k * 2 + oy, 43 + k * 2, 12 + k * 5 + oy - w, VEIL[3])
    part(c, veil)

    # robe fantomatique : traîne qui s'effiloche en volutes
    def robe(t):
        a = math.sin(ph)
        b = math.cos(ph)
        pts = [(20, 20), (32, 20), (36, 28), (40, 34), (45 + a * 2, 40), (50 + b * 2, 45 + a),
               (45 + a, 46), (47 + b * 2, 50), (40 + a, 46), (37 + b * 2, 50.5), (32 + a, 46),
               (28, 50.5 - a * 0.5), (24, 45), (18, 49 + b * 0.5), (16, 41), (15, 31)]
        m = poly_mask([(x, y + oy) for x, y in pts])
        shade_mask(t, m, ROBE, contrast=0.45)
        for (x, y) in m:
            if y > 44 + oy and (x + y) % 2 == 0:
                t.set(x, y, ROBE[1])
        for k in range(4):
            x0 = 20 + k * 4
            t.line(x0, 26 + oy, x0 + 2 + k * 3 + a * 2, 44 + oy, ROBE[0])
            t.line(x0 + 1, 26 + oy, x0 + 3 + k * 3 + a * 2, 42 + oy, ROBE[3])
        t.line(16, 40 + oy, 23, 45 + oy, VEIL[2])
        t.line(18, 31 + oy, 15, 40 + oy, ROBE[4])
    part(c, robe)

    # bustier + col de pointes d'argent
    def bodice(t):
        spoly(t, [(20, 18 + oy), (31, 18 + oy), (30, 29 + oy), (22, 29 + oy)], ROBE[1:], contrast=0.4)
        for (x, y) in poly_mask([(23, 22 + oy), (29, 22 + oy), (26, 29 + oy)]):
            t.setf(x, y, VEIL[2])
        sell(t, 26, 23 + oy, 2.2, 2.2, ['#3a0a6a', '#8a3ae0', '#d08aff', '#ffffff'])
        for (x, h_) in ((19, 6), (22, 8), (30, 8), (33, 6)):
            spoly(t, [(x - 1.5, 19 + oy), (x + (x - 26) * 0.2, 19 + oy - h_), (x + 1.5, 19 + oy)], SILVER, contrast=0.5)
    part(c, bodice)

    # bras : manches évasées, mains griffues
    def arms(t):
        if f == 2:
            for sh, hand, R in (((30, 21 + oy), (12, 21 + oy), dk(ROBE, -0.05)), ((22, 21 + oy), (9, 27 + oy), ROBE)):
                tube(t, [sh, ((sh[0] + hand[0]) / 2, (sh[1] + hand[1]) / 2 + 1), hand], [4, 5, 7], R, contrast=0.4)
                sell(t, hand[0] - 1, hand[1], 2, 1.8, SKIN_G)
                for k in range(3):
                    t.set(hand[0] - 3 - k % 2, hand[1] - 1 + k, SKIN_G[3])
        else:
            w = math.sin(ph) * 1.5
            sh = (21, 21 + oy)
            hand = (12, 31 + oy + w)
            tube(t, [sh, (16, 26 + oy), hand], [4, 6, 9], ROBE, contrast=0.4)
            sell(t, hand[0] - 1, hand[1] + 2, 2, 2, SKIN_G)
            for k in range(3):
                t.set(hand[0] - 2 + k, hand[1] + 4 + (k == 1), SKIN_G[3])
            sh = (31, 21 + oy)
            hand = (39, 28 + oy - w)
            tube(t, [sh, (36, 24 + oy), hand], [4, 6, 8], dk(ROBE, -0.06), contrast=0.4)
            sell(t, hand[0] + 1, hand[1] + 1, 1.8, 1.8, dk(SKIN_G, -0.06))
    part(c, arms)

    # visage spectral
    def face(t):
        hx, hy = 26, 12 + oy
        sell(t, hx, hy, 6.5, 6.8, SKIN_G)
        spoly(t, [(19, 10 + oy), (21, 5 + oy), (28, 3 + oy), (33, 7 + oy), (33, 15 + oy), (31, 9 + oy), (25, 8 + oy), (21, 12 + oy)], HAIR_G, contrast=0.4)
        spoly(t, [(19, 9 + oy), (21, 9 + oy), (20, 20 + oy), (18, 18 + oy)], HAIR_G, contrast=0.4)
        ey = hy - 1
        for i, ex in enumerate((20, 26)):
            t.rect(ex, ey, 4, 4, INK)
            for k in range(4):
                t.set(ex + k, ey + 1, CYAN[2])
                t.set(ex + k, ey + 2, CYAN[1] if k in (0, 3) else CYAN[2])
            t.set(ex + 1, ey + 1, CYAN[4]); t.set(ex + 2, ey + 1, CYAN[4]); t.set(ex + 1, ey + 2, CYAN[3])
            t.set(ex + (3 if i == 0 else 0), ey + 3, SKIN_G[0])
            t.set(ex + (0 if i == 0 else 3), ey, SKIN_G[1])
        t.line(19, ey - 2, 23, ey, INK); t.line(30, ey - 2, 26, ey, INK)
        t.set(21, ey + 4, SKIN_G[0]); t.set(28, ey + 4, SKIN_G[0])
        if f == 2:
            t.rect(23, hy + 4, 3, 2, INK); t.set(24, hy + 5, '#5a1a6a')
        else:
            t.line(22, hy + 4, 26, hy + 4, INK); t.set(21, hy + 3, INK); t.set(27, hy + 3, INK)
            t.set(23, hy + 5, WHITE); t.set(25, hy + 5, WHITE)
    part(c, face)

    # couronne d'argent aux flammes spectrales
    def crown_(t):
        x0, y0 = 19, 2 + oy
        pts = [(x0, y0 + 6), (x0 - 1, y0), (x0 + 2.5, y0 + 3), (x0 + 4, y0 - 3), (x0 + 6, y0 + 2),
               (x0 + 7.5, y0 - 5), (x0 + 9, y0 + 2), (x0 + 11, y0 - 3), (x0 + 12.5, y0 + 3), (x0 + 16, y0), (x0 + 15, y0 + 6)]
        shade_mask(t, poly_mask(pts), SILVER, contrast=0.45)
        for x in range(x0, x0 + 16):
            t.set(x, y0 + 5, SILVER[1])
        t.set(x0 + 7, y0 + 2, SFL[2]); t.set(x0 + 8, y0 + 2, SFL[1]); t.set(x0 + 7, y0 + 1, SFL[3])
        t.set(x0 + 3, y0 + 4, CYAN[2]); t.set(x0 + 12, y0 + 4, CYAN[2])
    part(c, crown_)

    if f == 2:
        def blast(t):
            sell(t, 5, 24 + oy, 5.5, 5.5, SFL)
            sell(t, 4.5, 23.5 + oy, 3.2, 3.2, SFL[2:])
            t.set(3, 22 + oy, WHITE); t.set(4, 22 + oy, WHITE)
        part(c, blast)
    return c


def spectral_queen_fx(c, f):
    oy, ph = queen_pose(f)
    # flammes spectrales (lumineuses, sans contour) : couronne et feux follets
    x0, y0 = 19, 2 + oy
    lean = (-0.25, 0.3, 0.4)[f]
    for i, (x, y, h_) in enumerate(((x0 + 4, y0 - 3, 4), (x0 + 7.5, y0 - 5, 5), (x0 + 11, y0 - 3, 4))):
        tongue(c, x, y - 1, h_, SFL[1:], ph * 2 + i, lean=lean * 0.3)
    for (x, y, h_) in ((7 + math.sin(ph) * 2, 44 + oy, 7), (48, 39 + oy + math.cos(ph) * 2, 6)):
        if f == 2 and x < 20:
            continue
        wisp(c, x, y, CYAN[1:], ph * 2 + x, h_)
    pts = ((14, 5), (40, 4), (51, 38), (9, 32), (36, 50), (44, 18))
    for i, (x, y) in enumerate(pts):
        y = y + oy + (f if i % 2 else -f)
        if c.get(x, y) is None:
            (glint(c, x, y, CYAN[4], CYAN[2]) if i < 2 else c.set(x, y, CYAN[3]))
    if f == 2:
        for (x, y, col) in ((-1, 24, SFL[3]), (0, 18, SFL[2]), (0, 30, SFL[2]), (2, 16, SFL[3]), (2, 32, SFL[3]),
                            (11, 17, SFL[2]), (12, 31, SFL[2])):
            if c.get(x, y + oy) is None:
                c.set(x, y + oy, col)


def boss_spectral_queen():
    return triple(spectral_queen, spectral_queen_fx, (56, 60))


# ---------------------------------------------------------------- export

BOSSES = ('boss_slime_king', 'boss_alpha_wolf', 'boss_bone_lord', 'boss_spectral_queen')


def build():
    g = globals()
    out = {}
    for name in BOSSES:
        a, b, k = g[name]()
        out[name] = (a, {})
        out[name + '_b'] = (b, {})
        out[name + '_atk'] = (k, {})
    return out
