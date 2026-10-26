"""Corrections d'animation (chargé en DERNIER par build.py : remplace les sprites de même nom).

  boss_ash_dragon, _b      vraie marche lourde (pattes alternées, corps qui ondule, ailes repliées qui
                           bougent à peine, tête stable) au lieu d'un battement d'ailes sur place
  wolf, wolf_b             loup redessiné : course lisible (pattes articulées alternées, corps et tête fixes)
  wolf_ice, wolf_ice_b     idem, version glace (cristaux solidaires du corps)
  boss_alpha_wolf, _b      trot en ciseaux (paires diagonales), corps stable, queue qui ondule seulement
  mid_hellhound, _b        trot en ciseaux, corps stable
  hard_werewolf, _b        marche bipède : jambes et bras alternés, corps quasi fixe

Les images d'attaque d'origine sont conservées (non redéfinies) ; chaque sprite garde exactement le canvas,
les couleurs et le style de l'original (mêmes fonctions de dessin, poses paramétrées).
"""
import bosses_mega as BM
import bosses_classic as BC
import bosses_mid as BMID
import bosses_hard as BH
import enemies as EN
from enemies import (Canvas, part, mask_of, spoly, sell, shade_mask, dk, crop_to, OUT, INK, WHITE)


# ================================================================ outils

def _bounds_box(frames):
    bs = [c.bounds() for c in frames]
    return (min(b[0] for b in bs), min(b[1] for b in bs), max(b[2] for b in bs), max(b[3] for b in bs))


def _lerp(a, b, t):
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)


# ================================================================ DRAGON DES CENDRES

def dragon_walk(f):
    """Dragon des cendres en marche (f = 0 / 1) : copie de bosses_mega.dragon avec pattes paramétrées."""
    from bosses_mega import (Layer, stamp, mask_of as mmask, ball, tube, _wing, _claws, _spike, scale_tex,
                             _dragon_head, glow_ring, shifted, SC, SCF, EMB, MEMB, MEMBF, DW, DH)
    W, H = DW, DH
    new = lambda: Layer(W, H)
    c = new()
    by = f                                    # le corps s'affaisse d'un pixel sur la 2e foulée
    # foulée en ciseaux : (décalage du pied, levée) ; avant proche + arrière lointaine ensemble
    if f == 0:
        NF, FF, NH, FH = (-5, 0), (4, 1), (4, 0), (-4, 0)
    else:
        NF, FF, NH, FH = (3, 2), (-5, 0), (-5, 0), (4, 2)

    # ---- aile lointaine : repliée, elle suit le corps et s'abaisse à peine
    w = new()
    d = 1 + f
    _wing(w, (39, 37 + by), (35, 21 + d), (33, 5 + d * 2), [(41, 0 + d * 2), (50, 3 + d * 2), (55, 13 + d)],
          (46, 37 + by), MEMBF, [SCF[0], SCF[2], SCF[4]], MEMBF[3])
    stamp(c, w)

    # ---- queue : base solidaire du corps, pointe qui ondule
    t = new()
    sx, sy = (0, 0) if f == 0 else (1, 2)
    tail = [(56, 54 + by), (63, 59), (67, 59), (69 + sx * 0.5, 54 + sy * 0.5), (68 + sx, 49 + sy)]
    BM.tube(t, tail, [6, 5, 4, 3, 2], SC, contrast=0.4)
    for (bx_, by_), (tx, ty), k in (((61, 56), (62, 51), 0), ((66, 58), (67, 53), 0.4), ((69, 55), (71, 52), 0.7)):
        _spike(t, (bx_ + sx * k, by_ + 0.5 + sy * k), (tx + sx * k, ty + sy * k), 3, EMB)
    BM.spoly(t, [(66 + sx, 49 + sy), (69 + sx, 41 + sy), (71 + sx, 49 + sy), (69 + sx, 51 + sy)], EMB, contrast=0.5)
    t.set(69 + sx, 42 + sy, EMB[4])
    stamp(c, t)

    def foot(t, cx, half, lift, R, claws, cl_R, hgt=3):
        """Pied griffu centré sur cx (largeur 2*half), soulevé de lift px."""
        g = 66 - lift
        BM.spoly(t, [(cx - half, g - hgt), (cx + half, g - hgt), (cx + half + 1, g), (cx - half - 1, g)], R)
        _claws(t, [cx + k for k in claws], g, cl_R)

    # ---- pattes lointaines (plus sombres)
    t = new()
    dx, lf = FH
    tube(t, [(58, 54 + by), (61 + dx * 0.5, 60 - lf), (60 + dx, 62 - lf)], [4, 3.5, 3], SCF)
    foot(t, 59 + dx, 4, lf, SCF, (-4, -1), [SCF[2], SCF[3], SCF[4], SCF[4]], 2)
    dx, lf = FF
    tube(t, [(36, 54 + by), (36 + dx * 0.5, 60 - lf), (37 + dx, 62 - lf)], [4, 3.5, 3], SCF)
    foot(t, 36 + dx, 4, lf, SCF, (-4, -1), [SCF[2], SCF[3], SCF[4], SCF[4]], 2)
    stamp(c, t)

    # ---- piques dorsales (derrière le corps)
    t = new()
    for (bx_, b_), (tx, ty), wd in (((41, 39), (43, 31), 5), ((47, 40), (50, 32), 5), ((53, 43), (57, 36), 5),
                                    ((58, 47), (63, 42), 4)):
        _spike(t, (bx_, b_ + by), (tx, ty + by), wd, EMB)
    stamp(c, t)

    # ---- corps massif (identique à l'original, décalé de by)
    t = new()
    ball(t, 46, 49 + by, 14, 10.5, SC)
    bm = mmask(lambda m: m.ellipse(42, 56 + by, 12, 5, '#000'))
    for (x, y) in bm:
        if t.get(x, y) is None:
            continue
        rowk = (y - by) % 3
        if rowk == 0:
            t.set(x, y, EMB[1])
        else:
            t.set(x, y, EMB[3] if (x < 42 and rowk == 1) else EMB[2])
    scale_tex(t, SC)
    pm = [(x, y) for y in range(40 + by, 60 + by) for x in range(20, 60) if t.get(x, y) is not None]
    for (x, y) in pm:
        row = [xx for (xx, yy) in pm if yy == y]
        if x - min(row) < 4 and y > 41 + by:
            k = (y - by) % 3
            t.set(x, y, EMB[1] if k == 0 else (EMB[3] if x - min(row) < 2 else EMB[2]))
    for (x0, y0, x1, y1) in ((44, 44, 48, 47), (48, 47, 47, 51), (52, 44, 55, 46), (40, 47, 42, 49)):
        t.line(x0, y0 + by, x1, y1 + by, EMB[2])
    t.set(48, 47 + by, EMB[4]); t.set(55, 46 + by, EMB[3])
    stamp(c, t)

    # ---- patte arrière proche
    t = new()
    dx, lf = NH
    ball(t, 55 + dx * 0.25, 53 + by, 7.5, 8, SC)
    scale_tex(t, SC)
    tube(t, [(57 + dx * 0.3, 58 + by), (59 + dx * 0.6, 61 - lf), (58 + dx, 62 - lf)], [4, 3.5, 3.2], SC)
    foot(t, 56 + dx, 5.5, lf, SC, (-6, -2, 2), BM.HORN)
    t.line(53 + dx * 0.25, 50 + by, 56 + dx * 0.25, 53 + by, EMB[2])
    stamp(c, t)

    # ---- cou épais + gorge incandescente (la base suit le corps, la tête reste fixe)
    neck = [(38, 47 + by), (33, 38 + by * 0.5), (29, 30)]
    t = new()
    nm = tube(t, neck, [9, 8, 7], SC, contrast=0.4)
    scale_tex(t, SC)
    for (x, y) in nm:
        lx = min(xx for (xx, yy) in nm if yy == y)
        if x - lx < 4 and y > 31:
            k = (y - x) % 3
            t.set(x, y, EMB[1] if k == 0 else (EMB[3] if x - lx < 2 else EMB[2]))
    stamp(c, t)

    ox, oy = 20, 20
    _dragon_head(c, new, ox, oy, False)

    # ---- patte avant proche
    t = new()
    dx, lf = NF
    ball(t, 34 + dx * 0.25, 52 + by, 6.5, 6.5, SC)
    tube(t, [(32 + dx * 0.3, 56 + by), (30 + dx * 0.6, 60 - lf), (29 + dx, 62 - lf)], [4, 3.5, 3.2], SC)
    foot(t, 28 + dx, 5, lf, SC, (-5, -1, 3), BM.HORN)
    t.line(33 + dx * 0.25, 50 + by, 36 + dx * 0.25, 53 + by, EMB[2])
    stamp(c, t)

    # ---- aile proche : repliée sur le dos, suit le corps, la pointe oscille de 1-2 px
    t = new()
    d = f
    _wing(t, (47, 39 + by), (54, 25 + by + d), (59, 9 + by + d * 2),
          [(65, 4 + d * 2), (70, 12 + d * 2), (71, 25 + d), (66, 34 + d)], (54, 45 + by),
          MEMB, [SC[0], SC[2], SC[4]], MEMB[3])
    stamp(c, t)

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
    sparks = ((70, 44), (62, 1), (28, 3), (44, 26)) if f == 0 else ((71, 42), (64, 4), (27, 6), (45, 22))
    for x, y in sparks:
        if c.get(x, y) is None:
            c.set(x, y, EMB[3])
    return shifted(c, 3), (W, H)


def boss_ash_dragon():
    """Repos + marche + attaque d'origine, recadrés sur une même boîte qui ne coupe rien (souffle compris)."""
    res = [dragon_walk(0), dragon_walk(1), BM.dragon(2)]
    w, h = res[0][1]
    box = BH.group_box([c for c, _ in res], w, h)
    return [BH.finalize_box(c, box) for c, _ in res]


# ================================================================ LOUPS (ennemis normaux, 34×24)

def fit(frames, w, h):
    """Contour puis recadrage de toutes les images sur une même boîte w×h (pieds en bas, centrée en x)."""
    for c in frames:
        c.outline(OUT)
    x0, y0, x1, y1 = _bounds_box(frames)
    assert x1 - x0 + 1 <= w and y1 - y0 + 1 <= h, (x1 - x0 + 1, y1 - y0 + 1, w, h)
    bx = x0 - (w - (x1 - x0 + 1)) // 2
    return [crop_to(c, (bx, y1 - h + 1, bx + w - 1, y1)) for c in frames]


def run_wolf(f, FUR, BELLY, eye_col, mane=None, ice=False):
    """Loup qui court vers la gauche : corps et tête fixes, trot en ciseaux (paires diagonales)."""
    c = Canvas(34, 24)
    G = 21                       # bas des pattes (le contour tombe sur la dernière ligne)
    far = dk(FUR, -0.1)
    mane = mane or dk(FUR, -0.08)
    # pieds : (x patte, levée) -- avant proche + arrière lointaine ensemble
    if f == 0:
        NF, FH, FF, NH = (5.5, 0), (21.5, 1), (12.5, 1), (29, 0)
    else:
        NF, FH, FF, NH = (12, 1), (28, 0), (6, 0), (22.5, 1)

    def fleg(t, hip, foot, R):
        px, lift = foot
        y = G - lift
        kx = (hip[0] + px) / 2 + (0.6 if px < hip[0] else -0.2)
        sline(t, hip[0], hip[1], kx, 16.5, R, 3)
        sline(t, kx, 16.5, px + 0.5, y - 0.5, R, 2)
        sell(t, px, y, 1.9, 1.1, R)

    def hleg(t, hip, foot, R):
        px, lift = foot
        y = G - lift
        hock = (px + 2.2, y - 3.5)
        sline(t, hip[0], hip[1], (hip[0] + hock[0]) / 2 + 1.6, 15, R, 3.4)
        sline(t, (hip[0] + hock[0]) / 2 + 1.6, 15, hock[0], hock[1], R, 2)
        sline(t, hock[0], hock[1], px + 0.5, y - 0.5, R, 2)
        sell(t, px, y, 1.9, 1.1, R)

    from bosses_classic import tube as ctube
    # queue en panache (ondule d'un pixel)
    ty = 0 if f == 0 else 1
    part(c, lambda t: (ctube(t, [(26, 8), (29, 5 + ty), (31, 3 + ty * 1.5)], [3, 3.6, 1.4], FUR, contrast=0.45),
                       t.line(28.6, 5 + ty, 30.6, 3.5 + ty, BELLY[-1])))
    # pattes lointaines
    part(c, lambda t: fleg(t, (12.5, 12), FF, far))
    part(c, lambda t: hleg(t, (24.5, 11.5), FH, far))

    # corps (fixe)
    def body(t):
        sell(t, 18.5, 9.5, 8.5, 4.6, FUR)
        sell(t, 24.5, 10.2, 4, 4.2, FUR)
        for (x, y) in mask_of(lambda m: m.ellipse(18, 12.6, 6.5, 1.8, '#000')):
            t.setf(x, y, BELLY[1])
        sell(t, 11.5, 9.5, 4.6, 4.6, FUR)
        for (x, y) in mask_of(lambda m: m.ellipse(10.2, 11.8, 2.6, 2.8, '#000')):
            t.setf(x, y, BELLY[2])
        t.setf(10, 10, BELLY[3]); t.setf(9, 11, BELLY[3])
    part(c, body)
    # pattes proches
    part(c, lambda t: hleg(t, (25, 12), NH, FUR))
    part(c, lambda t: fleg(t, (11.5, 12.5), NF, FUR))
    # crinière hérissée
    part(c, lambda t: spoly(t, [(9, 4), (12, 1.6), (13.2, 4), (15.6, 2.2), (16.8, 5), (20, 4), (19, 7), (11, 8)], mane))

    part(c, lambda t: spoly(t, [(5.4, 4.6), (6.6, 0.6), (8.8, 4)], dk(FUR, -0.03)))   # oreille lointaine

    def head(t):
        sell(t, 7.5, 7, 4.4, 3.8, FUR)
        spoly(t, [(8.5, 4), (10.6, -0.6), (12.4, 4.8)], FUR)            # oreille proche
        t.line(10.4, 1.6, 10.6, 3.6, BELLY[0])
        spoly(t, [(0, 7), (5, 5), (7.4, 7.4), (6.4, 9.4), (0.4, 9.2)], FUR)   # museau retroussé
        spoly(t, [(0.6, 9.2), (6.6, 9), (6.4, 11.6), (2.4, 12)], ['#3a0a14', '#7a1428', '#b0283a'], edge=False)
        spoly(t, [(2, 12), (6.8, 11), (7.4, 13), (3, 13.4)], FUR)       # mâchoire inférieure
        for (x, y) in mask_of(lambda m: m.poly([(2.6, 12.4), (7, 12), (7.2, 13.2), (3, 13.4)], '#000')):
            t.setf(x, y, BELLY[1])
        t.set(1, 9, WHITE); t.set(4, 9, WHITE); t.set(3, 11, WHITE); t.set(5, 11, WHITE)   # crocs
        t.set(0, 7, INK); t.set(1, 7, INK)                                                  # truffe
        t.line(3, 6.6, 4.6, 6, FUR[1])                                                      # rides
        # œil furieux (3×2) + sourcil
        ex, ey = 6, 5
        t.rect(ex - 1, ey, 3, 2, eye_col[2])
        t.set(ex - 1, ey, eye_col[3]); t.set(ex, ey + 1, INK); t.set(ex + 1, ey + 1, INK); t.set(ex + 1, ey, eye_col[1])
        t.line(ex - 1, ey - 1, ex + 2, ey - 1, INK)
    part(c, head)
    if ice:
        for x, y in ((12, 1), (15, 2), (18, 3)):
            c.set(x, y, '#e8fcff'); c.set(x, y + 1, '#6ad0ff'); c.set(x + 1, y + 1, '#3a8ae0')
    return c


def sline(c, x0, y0, x1, y1, R, width=2, **kw):
    EN.sline(c, x0, y0, x1, y1, R, width, **kw)


def wolf():
    eye_c = ['#7a2a10', '#e8a020', '#ffe070', '#fff8d0']
    return [BC.reduce_colors(c, 40) for c in fit([run_wolf(f, EN.WOLF_FUR, EN.WOLF_BELLY, eye_c) for f in (0, 1)], 34, 24)]


def wolf_ice():
    FUR = ['#3c5a94', '#6a94c8', '#a6cbea', '#dceefa', '#ffffff']
    BELLY = ['#7aa4d4', '#d4ecfa', '#eef8ff', '#ffffff']
    eye_c = ['#1a3aa0', '#3ab8ff', '#a8f0ff', '#ffffff']
    mane = ['#3c5a94', '#5a86c4', '#8ab8e8', '#c4e4fa', '#f0faff']
    return [BC.reduce_colors(c, 40) for c in fit([run_wolf(f, FUR, BELLY, eye_c, mane, ice=True) for f in (0, 1)], 34, 24)]


# ================================================================ LOUP ALPHA (64×50)

def alpha_walk(f):
    """Loup Alpha au trot (f = 0 / 1) : copie de bosses_classic.alpha_wolf, corps et tête fixes,
    pattes en ciseaux (avant proche + arrière lointaine ensemble), queue qui ondule."""
    from bosses_classic import (FUR, HEADF, MANE, BELLY, W_EYE, SCAR, IRON, GUM, GOLD, RED_GEM,
                                wolf_leg, tube, poly_mask)
    c = Canvas(64, 52)
    G = 49
    ox, oy, hx, hy = 0, 0, 12, 19
    far = dk(FUR, -0.05)

    # queue en panache : la pointe ondule
    def tail(t):
        pts = [(51, 21), (55, 14), (58, 8)] if f == 0 else [(51, 21), (55, 15), (57.6, 9.6)]
        tube(t, pts, [6, 6.5, 2.5], FUR, contrast=0.45)
        tx, ty = pts[2]
        t.line(pts[1][0], pts[1][1] - 1, tx - 0.5, ty, FUR[4])
    part(c, tail)

    def front(top, paw, lift=0):
        py = G - 2 - lift
        knee = ((top[0] + paw) / 2 + (1.5 if paw < top[0] else -0.5), 40 - lift * 0.5)
        return top, knee, (paw, py)

    def hind(top, paw, lift=0):
        py = G - 2 - lift
        return top, (paw + 4, 39.5 - lift * 0.5), (paw, py)

    if f == 0:
        NF, FH, FF, NH = 9, 43, 25, 51
    else:
        NF, FH, FF, NH = 20, 51, 13, 41
    fl, hl = front((24, 30), FF, 1 if f == 0 else 0), hind((50, 30), FH, 1 if f == 1 else 0)
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
    fn_, hn = front((19, 31), NF), hind((45, 31), NH)
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



def alpha_walk_fx(c, f):
    from bosses_classic import W_EYE
    hx, hy = 12, 19
    ey, ex = hy - 3, hx - 3
    for k, col in enumerate((W_EYE[2], W_EYE[1], W_EYE[1], W_EYE[0])):
        x, y = ex + 5 + k * 2, ey + 1 - k * 0.3
        if c.get(x, y) is None:
            c.set(x, y, col)
    for (x, y, col) in ((33, 1 + f, '#ff4a2a'), (41, 4 - f, '#c0182a'), (21, 1, '#c0182a'), (47, 10 + f, '#ff4a2a'), (28, 0 + f, '#ff9a4a')):
        if c.get(x, y) is None:
            c.set(x, y, col)


def same_box(orig_frames_fn, new_frames, reduce):
    """Recadre les nouvelles images sur la boîte exacte de l'original (même canvas, même placement)."""
    olds = orig_frames_fn()
    box = _bounds_box(olds)
    out = []
    for c in new_frames:
        x0, y0, x1, y1 = c.bounds()
        assert x0 >= box[0] and y0 >= box[1] and x1 <= box[2] and y1 <= box[3], ('hors cadre', c.bounds(), box)
        out.append(reduce(crop_to(c, box)))
    return out


def _alpha_orig():
    frames = []
    for f in range(3):
        c = BC.alpha_wolf(f)
        c.outline(OUT)
        BC.alpha_wolf_fx(c, f)
        frames.append(c)
    return frames


def boss_alpha_wolf():
    frames = []
    for f in (0, 1):
        c = alpha_walk(f)
        c.outline(OUT)
        alpha_walk_fx(c, f)
        frames.append(c)
    return same_box(_alpha_orig, frames, BC.reduce_colors)



# ================================================================ CHIEN DE L'ENFER (78×56)

def hh_walk(f):
    """Chien de l'enfer au trot (f = 0 / 1) : copie de bosses_mid.hh_draw, corps fixe,
    pattes en ciseaux (avant proche + arrière lointaine ensemble)."""
    from bosses_mid import (tube, flame, flame_mask_shade, specks, hh_head, hh_mane, mix_r,
                            HH_FUR, HH_FIRE, HH_EMBER, STEEL, BONE)
    c = Canvas(72, 52)
    G = 50
    atk = f == 2
    oy = 0                          # corps fixe
    lo = 0
    # pattes : dx du pied (ff avant proche, fb avant lointaine, hf arrière proche, hb arrière lointaine)
    if f == 0:
        ff, fb, hf, hb = -4, 3, 4, -3
    else:
        ff, fb, hf, hb = 3, -4, -4, 4

    def fleg(t, x, dx, R):
        sline(t, x, 30 + oy + lo, x + dx * 0.5 - 0.5, 40 + oy, R, 5)
        sline(t, x + dx * 0.5 - 0.5, 40 + oy, x + dx, G - 2, R, 4)
        spoly(t, [(x + dx - 3.5, G - 3), (x + dx + 2, G - 3), (x + dx + 2, G - 1), (x + dx - 4, G - 1)], R)
        t.set(x + dx - 4, G - 1, BONE[3]); t.set(x + dx - 2, G - 1, BONE[3])

    def hleg(t, x, dx, R):
        sline(t, x, 28 + oy, x + 4, 38 + oy, R, 7)
        sline(t, x + 4, 38 + oy, x + 1 + dx, 44, R, 4)
        sline(t, x + 1 + dx, 44, x + dx, G - 2, R, 3)
        spoly(t, [(x + dx - 3.5, G - 3), (x + dx + 2, G - 3), (x + dx + 2, G - 1), (x + dx - 4, G - 1)], R)
        t.set(x + dx - 4, G - 1, BONE[3])
    FAR = dk(HH_FUR, -0.04)
    fleg(c, 27, fb, FAR)
    hleg(c, 53, hb, FAR)
    # queue enflammée
    flame(c, 63, 26 + oy, 12 + (f % 2) * 2, 5, HH_FIRE, lean=4)
    tube(c, [(58, 25 + oy), (62, 22 + oy), (64, 18 + oy)], 1.6, 1.2, HH_FUR)
    # corps
    def body(t):
        m = mask_of(lambda m: m.ellipse(27, 27 + oy + lo, 11, 9.5, '#000'))
        m |= mask_of(lambda m: m.ellipse(52, 26 + oy, 9, 7.5, '#000'))
        m |= mask_of(lambda m: m.poly([(30, 19 + oy + lo), (50, 19 + oy), (52, 30 + oy), (32, 34 + oy + lo)], '#000'))
        shade_mask(t, m, HH_FUR, contrast=0.45)
        # côtes et fissures de braise
        for k in range(3):
            t.line(33 + k * 3, 24 + oy, 34 + k * 3, 30 + oy, HH_FUR[1])
        for (x0, y0, x1, y1) in ((22, 30, 27, 33), (44, 22, 47, 26), (55, 25, 57, 28)):
            t.line(x0, y0 + oy + lo, x1, y1 + oy + lo, HH_EMBER[2])
            t.set(x0, y0 + oy + lo, HH_EMBER[3])
        # collier clouté
        t.line(17, 22 + oy + lo, 22, 31 + oy + lo, '#3a2a30', 2)
        for y in (24, 27, 30):
            t.set(18 + (y - 22) * 0.55, y + oy + lo, STEEL[3])
    part(c, body)
    # pattes proches
    part(c, lambda t: hleg(t, 49, hf, HH_FUR))
    part(c, lambda t: fleg(t, 22, ff, HH_FUR))
    # têtes : la lointaine (plus haute) puis la proche
    bite = 3 if atk else 0
    if atk:
        far_h, near_h = (21, 7), (10, 21)
    else:
        far_h, near_h = (25, 6 + oy), (13, 18 + oy)
    # cou lointain + crinière
    sline(c, 28, 20 + oy, far_h[0] + 4, far_h[1] + 3, dk(HH_FUR, -0.04), 8)
    hh_mane(c, [(far_h[0] + 8, far_h[1] - 1), (far_h[0] + 12, far_h[1] + 3), (far_h[0] + 15, far_h[1] + 7)], f, 0.9)
    # cou proche + crinière
    part(c, lambda t: sline(t, 26, 24 + oy + lo, near_h[0] + 4, near_h[1] + 3, HH_FUR, 9))
    hh_mane(c, [(near_h[0] + 8, near_h[1] - 1), (near_h[0] + 13, near_h[1] + 2), (near_h[0] + 18, near_h[1] + 4),
                (36, 21 + oy + lo)], f + 1, 0.8)
    hh_head(c, far_h[0], far_h[1], mix_r(HH_FUR, '#3a1418', 0.25), bite, far=True)
    hh_head(c, near_h[0], near_h[1], HH_FUR, bite)
    if atk:
        # morsure enflammée : gerbe de feu devant les gueules
        for (x, y, r) in ((near_h[0] - 12, near_h[1] + 6, 3.4), (near_h[0] - 16, near_h[1] + 4, 2.4),
                          (far_h[0] - 12, far_h[1] + 6, 2.6), (far_h[0] - 16, far_h[1] + 3, 1.6)):
            m = mask_of(lambda m: m.ellipse(x, y, r, r * 0.85, '#000'))
            flame_mask_shade(c, m, HH_FIRE[::-1][:1] + HH_FIRE[1:], y + r, y - r)
            c.set(x - 0.5, y, HH_FIRE[4])
        for (x, y) in ((near_h[0] - 19, near_h[1]), (near_h[0] - 14, near_h[1] + 11), (far_h[0] - 19, far_h[1] - 2)):
            c.set(x, y, HH_FIRE[3]); c.set(x + 1, y, HH_FIRE[2])
    else:
        specks(c, [(38 + f * 2, 9 + f), (45, 13 - f), (66, 11 + f * 2)], [HH_FIRE[3], HH_FIRE[2]])
    return c


def boss_mid_hellhound():
    def orig():
        frames = [BMID.hh_draw(f) for f in range(3)]
        for c in frames:
            c.outline(OUT)
        return frames
    frames = [hh_walk(f) for f in (0, 1)]
    for c in frames:
        c.outline(OUT)
    return same_box(orig, frames, lambda c: BMID.reduce_colors(c, BMID.MAX_COLORS))


# ================================================================ LOUP-GAROU (60×60)

def werewolf_walk(f):
    """Loup-garou en marche (f = 0 / 1) : copie de bosses_hard.werewolf, torse fixe,
    jambes en ciseaux et bras qui balancent à l'opposé des jambes."""
    from bosses_hard import (Layer, stamp, mask_of, shade, spoly, ball, tube, tube_mask, jag_mask, fur_strokes,
                             claws, glow_ring, dots, lens, WWW, WWH, FUR, FURL, WEYE, MAW, CLAW, MOON, MIST, SLASH)
    W, H = WWW, WWH
    G = H - 2
    new = lambda: Layer(W, H)
    c = new()
    atk = f == 2
    by = 0                                    # torse fixe
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
        arm = [(40, 27), (42, 35), (38, 42)] if f == 0 else [(40, 27), (47, 34), (49, 40)]
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
        lg = [((40, 42), (38, 48), (33, 54), (32, G)), ((32, 43), (33, 49), (37, 54), (38, G))]
    elif atk:
        lg = [((40, 42), (47, 47), (48, 53), (51, G)), ((31, 43), (25, 48), (20, 54), (18, G))]
    else:
        lg = [((40, 42), (47, 48), (49, 54), (50, G)), ((32, 43), (27, 49), (24, 54), (23, G))]
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
        arm = [(31, 27), (30, 37), (24, 43)] if f == 0 else [(31, 27), (26, 36), (17, 40)]
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


def hard_werewolf():
    res = [werewolf_walk(0), werewolf_walk(1), BH.werewolf(2)]
    w, h = res[0][1]
    box = BH.group_box([c for c, _ in res], w, h)
    return [BH.finalize_box(c, box) for c, _ in res]


# ================================================================ export

FIXES = {
    'boss_ash_dragon': boss_ash_dragon,
    'wolf': wolf,
    'wolf_ice': wolf_ice,
    'boss_alpha_wolf': boss_alpha_wolf,
    'mid_hellhound': boss_mid_hellhound,
    'hard_werewolf': hard_werewolf,
}


def build():
    """Repos + 2e image de marche corrigés ; les images _atk d'origine restent celles des autres modules."""
    out = {}
    for name, fn in FIXES.items():
        frames = fn()
        out[name] = (frames[0], {})
        out[name + '_b'] = (frames[1], {})
        if len(frames) > 2:  # attaque d'origine recadrée sur la nouvelle boîte commune
            out[name + '_atk'] = (frames[2], {})
    return out
