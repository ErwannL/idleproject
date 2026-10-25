"""Boss des mondes 9 (Cœur du volcan) et 10 (Royaume du Néant).

  mini_salamander_chief  Chef salamandre (étape 5, monde 9)
  mid_lava_golem         Golem de lave (étape 10, monde 9)
  hard_flame_djinn       Djinn des flammes (étape 15, monde 9, flotte)
  boss_phoenix           Phénix ancestral (étape 20, monde 9, vole)
  mini_void_watcher      Guetteur du néant (étape 5, monde 10, vole)
  mid_star_devourer      Dévoreur d'étoiles (étape 10, monde 10)
  hard_void_knight       Chevalier du néant (étape 15, monde 10)
  boss_void_emperor      Empereur du Néant (étape 20, monde 10)

Chaque boss : <nom> (repos), <nom>_b (marche / vol / respiration), <nom>_atk (attaque),
trois images sur exactement le même canvas. Tournés vers la GAUCHE, pieds sur la dernière ligne
(sauf volants). Chibi 16 bits, lumière en haut à gauche, contour '#1a1226'. Aucun aléa.
"""
import math

from knight import spine_fill
from bosses_hard import (Layer, stamp, mask_of, shade, spoly, ball, tube, horn, flame_tongue, arc_fx,
                         glow_ring, dots, sparkle, finalize, clipped)
from bosses_mega import breath, shifted
from minibosses import reduce_colors

OUT = '#1a1226'
WHITE = '#ffffff'
LIGHT = (-0.6, -0.8)
MAX_COLORS = 58

# ---------------------------------------------------------------- palettes communes

GOLD = ['#6a3414', '#b0661a', '#e0a630', '#ffd86a', '#fff6c8']
FIRE = ['#6a0c06', '#c8300a', '#ff7a14', '#ffd040', '#fff6c0']        # feu (sombre -> blanc)
EMBER = ['#3a0808', '#7a1408', '#c8300a', '#ff7a14', '#ffd040']       # feu plus sombre (plan arrière)
BASALT = ['#0c0a10', '#1a1620', '#2c2632', '#433a48', '#605462']      # roche volcanique
SMOKE = ['#2a2230', '#423848', '#5e5262']

VOID = ['#07061a', '#120f30', '#1f1a4c', '#30296e', '#4a429a']        # nuit cosmique
NEB = ['#2a0c4e', '#5a1a8e', '#9a3ad6', '#d47aff', '#f6d4ff']         # nébuleuse violette
CYAN = ['#0a3a62', '#1688c4', '#3ad8ff', '#a8f6ff', '#ffffff']        # lumière du néant
STAR = '#fff6d0'


# ---------------------------------------------------------------- outils

def shift_l(col, dl):
    from lib import shift
    return shift(col, dl=dl)


def h32(x, y, s=0):
    """Hachage entier déterministe (étoiles, texture)."""
    n = (x * 374761393 + y * 668265263 + s * 1442695041) & 0xffffffff
    n = ((n ^ (n >> 13)) * 1274126177) & 0xffffffff
    return (n ^ (n >> 16)) & 0xffff


def frond(c, spine, widths, F, lo=0, hi=None):
    """Plume / mèche de flamme le long d'une épine : base sombre -> pointe claire, arête haute claire."""
    hi = len(F) - 1 if hi is None else hi

    def f(t, s, x, y):
        k = lo + t * (hi - lo + 0.6)
        if s < -0.35:
            k += 0.8
        elif s > 0.5:
            k -= 0.8
        return F[max(0, min(len(F) - 1, int(k)))]
    spine_fill(c, spine, widths, f)


def heat(c, mask, F, cx, cy, rx, ry, bias=0.0):
    """Remplissage incandescent : cœur clair au centre (cx, cy), bords sombres."""
    n = len(F)
    for (x, y) in mask:
        d = math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry)
        v = 1.05 - d * 0.85 + bias
        if (x - 1, y) not in mask or (x, y - 1) not in mask:
            v += 0.06
        if (x + 1, y) not in mask or (x, y + 1) not in mask:
            v -= 0.14
        c.set(x, y, F[max(0, min(n - 1, int(v * n)))])


def cosmos(c, mask, R, neb=None, seed=0, density=19, contrast=0.3, bias=0.0, star=STAR, star2=None):
    """Matière cosmique : rampe nuit, volutes de nébuleuse, étoiles (pas sur les bords)."""
    shade(c, mask, R, contrast=contrast, bias=bias)
    for (x, y) in mask:
        inner = all((x + dx, y + dy) in mask for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
        if neb and inner:
            v = math.sin(x * 0.42 + y * 0.21 + seed) + math.sin(x * 0.13 - y * 0.37 + seed * 1.7)
            if v > 1.55:
                c.set(x, y, neb[2])
            elif v > 1.05:
                c.set(x, y, neb[1])
        if inner and h32(x, y, seed) % density == 0:
            c.set(x, y, star if h32(y, x, seed) % 3 else (star2 or neb[3] if neb else star))


def crack(c, pts, F, core=True):
    """Fissure incandescente (ligne brisée) : bord rouge, cœur jaune."""
    for i in range(len(pts) - 1):
        (x0, y0), (x1, y1) = pts[i], pts[i + 1]
        c.line(x0, y0, x1, y1, F[2])
    if core:
        for i in range(len(pts) - 1):
            (x0, y0), (x1, y1) = pts[i], pts[i + 1]
            c.set((x0 + x1) / 2, (y0 + y1) / 2, F[3])
        c.set(*pts[0], F[3])


def star4(c, x, y, R, size=2):
    """Étoile à quatre branches (R : [sombre, moyen, clair])."""
    for k in range(1, size + 1):
        col = R[2] if k == 1 else R[1] if k < size else R[0]
        for dx, dy in ((k, 0), (-k, 0), (0, k), (0, -k)):
            c.set(x + dx, y + dy, col)
    c.set(x, y, WHITE)


def clear_over(fx, c):
    """Efface d'un calque d'effet ce qui recouvre déjà la silhouette."""
    for y in range(fx.h):
        for x in range(fx.w):
            if c.px[y][x] is not None:
                fx.px[y][x] = None


def burst(c, x, y, r, F, spikes=7, phase=0.3):
    """Explosion de feu étoilée (cœur blanc)."""
    m = set()
    for yy in range(int(y - r - 2), int(y + r + 3)):
        for xx in range(int(x - r - 2), int(x + r + 3)):
            dx, dy = xx + 0.5 - x, yy + 0.5 - y
            a = math.atan2(dy, dx)
            rr = r * (0.62 + 0.38 * abs(math.cos(a * spikes / 2 + phase)))
            if math.hypot(dx, dy) <= rr:
                m.add((xx, yy))
    heat(c, m, F, x, y, r * 0.9, r * 0.9, bias=0.1)
    return m


def toes(c, pts, col):
    for x, y in pts:
        c.set(x, y, col)
        c.set(x - 1, y, col)


# ================================================================ 1. CHEF SALAMANDRE (monde 9, étape 5)

SAW, SAH = 54, 50
SK = ['#0a0812', '#171322', '#272036', '#3c3250', '#5a4c70']           # peau noire
BLOT = ['#8a1e08', '#e0501a', '#ff9a2a', '#ffd25a', '#fff2b0']         # taches de feu
BELLY = ['#5a1008', '#a42a10', '#e05a1e', '#ff9440', '#ffc480']
HIDE = ['#2a140e', '#4e2616', '#7a3e20', '#a65c30', '#d08a50']
OBS = ['#0a0a14', '#1c1a2c', '#36345a', '#6a6a9a', '#b0b4e0']         # obsidienne
SAEYE = ['#c86010', '#ffc030', '#fff4a0']
TOOTH = ['#8e8478', '#e6dfc6', '#fcf9ec']


def blots(c, pts, R=BLOT):
    for x, y, r in pts:
        m = mask_of(lambda q: q.ellipse(x, y, r, r * 0.8, '#000'))
        for (px, py) in m:
            if c.get(px, py) is not None:
                d = math.hypot(px + 0.5 - x + 0.3, py + 0.5 - y + 0.3) / max(r, 0.5)
                c.set(px, py, R[3] if d < 0.45 else R[2] if d < 0.85 else R[1])


def salamander(f):
    W, H = SAW, SAH
    G = H - 2
    new = lambda: Layer(W, H)
    c = new()
    atk = f == 2
    by = 1 if f == 1 else 0
    X = 8

    # ---- queue : s'enroule derrière, pointe en flamme
    t = new()
    sw = 1 if f == 1 else 0
    tail = [(X + 28, 36 + by), (X + 35, 41), (X + 40, 41 - sw), (X + 43, 36 - sw), (X + 42, 31 - sw)]
    tube(t, tail, [4.2, 3.6, 3.0, 2.2, 1.4], SK, contrast=0.4)
    blots(t, ((X + 35, 40, 1.4), (X + 41, 38, 1.1)))
    stamp(c, t)
    t = new()
    flame_tongue(t, X + 42, 31 - sw, 2.4, 8 + f, -1.5 if f == 1 else 1.5, f, FIRE)
    stamp(c, t, None)

    # ---- branchies de flamme arrière (côté lointain)
    hx, hy = (X + 15, 15 + by) if not atk else (X + 13, 16)
    t = new()
    for k, (dx, dy) in enumerate(((10, -9), (12, -4), (11, 1))):
        wob = (1 if (k + f) % 2 else -1) * 0.8
        frond(t, [(hx + 6, hy - 2 + k * 2), (hx + 6 + dx * 0.5, hy - 2 + k * 2 + dy * 0.5 + wob),
                  (hx + 6 + dx, hy - 2 + k * 2 + dy)], [1.6, 1.2, 0.5], FIRE, lo=0, hi=2)
    stamp(c, t)

    # ---- jambe lointaine
    if f == 1:
        far = [(X + 26, 38), (X + 29, 42), (X + 30, G - 2)]
        near = [(X + 20, 39), (X + 15, 42), (X + 15, G - 2)]
    elif atk:
        far = [(X + 26, 38), (X + 30, 42), (X + 32, G - 2)]
        near = [(X + 20, 39), (X + 15, 42), (X + 13, G - 2)]
    else:
        far = [(X + 26, 38), (X + 27, 43), (X + 26, G - 2)]
        near = [(X + 20, 39), (X + 18, 43), (X + 18, G - 2)]
    t = new()
    tube(t, far, [3.4, 2.8, 2.4], SK, bias=-0.18)
    fx_ = far[-1][0]
    spoly(t, [(fx_ - 5, G - 1), (fx_ - 3, G - 3), (fx_ + 2, G - 3), (fx_ + 2, G), (fx_ - 6, G)], SK, bias=-0.18)
    toes(t, ((fx_ - 5, G), (fx_ - 2, G)), TOOTH[1])
    stamp(c, t)

    # ---- bras lointain (poing sur la hanche)
    t = new()
    if atk:
        arm = [(X + 27, 26), (X + 26, 31), (X + 22, 30)]
    else:
        arm = [(X + 27, 26 + by), (X + 31, 31 + by), (X + 29, 35 + by)]
    tube(t, arm, [2.8, 2.4, 2.2], SK, bias=-0.15)
    ball(t, arm[-1][0], arm[-1][1], 2.2, 2.0, SK)
    stamp(c, t)

    # ---- torse
    t = new()
    tm = mask_of(lambda m: m.ellipse(X + 23, 31 + by, 7.5, 8.5, '#000'))
    shade(t, tm, SK, contrast=0.45)
    # ventre orangé à plaques
    bm = mask_of(lambda m: m.ellipse(X + 20.5, 33 + by, 4.6, 6.4, '#000'))
    shade(t, {p for p in bm if p in tm}, BELLY, contrast=0.4, only_inside=True)
    for y in range(28, 40, 2):
        for x in range(X + 16, X + 25):
            if (x, y + by) in bm and t.get(x, y + by) is not None:
                t.set(x, y + by, BELLY[1])
    blots(t, ((X + 27, 27 + by, 1.6), (X + 28, 33 + by, 1.3), (X + 25, 37 + by, 1.0)))
    stamp(c, t)

    # ---- pagne de cuir + ceinture d'or
    t = new()
    spoly(t, [(X + 15, 37 + by), (X + 30, 37 + by), (X + 29, 44 + by), (X + 25, 42 + by), (X + 22, 45 + by),
              (X + 19, 42 + by), (X + 16, 44 + by)], HIDE, contrast=0.45)
    for x in range(X + 15, X + 31):
        t.setf(x, 37 + by, GOLD[2] if x % 4 else GOLD[3])
        t.setf(x, 38 + by, GOLD[1])
    for x in (X + 18, X + 22, X + 26):
        t.setf(x, 41 + by, BLOT[2]); t.setf(x + 1, 41 + by, BLOT[1])
    stamp(c, t)

    # ---- jambe proche
    t = new()
    tube(t, near, [3.6, 3.0, 2.6], SK)
    nx_ = near[-1][0]
    spoly(t, [(nx_ - 5, G - 1), (nx_ - 3, G - 3), (nx_ + 2, G - 3), (nx_ + 2, G), (nx_ - 6, G)], SK)
    blots(t, ((near[0][0] - 1, near[0][1] + 1, 1.2),))
    toes(t, ((nx_ - 5, G), (nx_ - 2, G), (nx_ + 1, G)), TOOTH[1])
    stamp(c, t)

    # ---- collier de crocs
    for k in range(6):
        x = X + 17 + k * 2
        y = 25 + by + (1 if 0 < k < 5 else 0)
        c.set(x, y, TOOTH[2]); c.set(x, y + 1, TOOTH[1])
    c.set(X + 22, 27 + by, BLOT[3])

    # ---- tête : large, aplatie, gueule fendue
    t = new()
    ball(t, hx + 3, hy, 9, 7, SK)
    ball(t, hx - 3, hy + 2, 7.5, 5, SK)
    blots(t, ((hx + 7, hy - 3, 1.8), (hx + 9, hy + 2, 1.4), (hx + 3, hy - 5, 1.2), (hx - 6, hy + 4, 1.0)))
    stamp(c, t)
    # ---- branchies de flamme proches (signature)
    t = new()
    for k, (dx, dy) in enumerate(((9, -10), (12, -5), (12, 0))):
        wob = (-1 if (k + f) % 2 else 1) * 0.9
        frond(t, [(hx + 9, hy - 1 + k * 2), (hx + 9 + dx * 0.5, hy - 1 + k * 2 + dy * 0.5 + wob),
                  (hx + 9 + dx, hy - 1 + k * 2 + dy)], [2.2, 1.6, 0.5], FIRE)
    stamp(c, t)
    # couronne de chef : dents d'obsidienne sur bandeau d'or (arrière du crâne)
    t = new()
    for k, x in enumerate((hx + 1, hx + 4.5, hx + 8)):
        hh = 6 if k == 1 else 5
        spoly(t, [(x - 1.8, hy - 8 + k * 0.6), (x + 0.6, hy - 8 - hh + k * 0.6), (x + 1.8, hy - 8 + k * 0.6)], OBS,
              contrast=0.7, bias=0.1)
    stamp(c, t)
    t = new()
    t.line(hx - 1, hy - 8, hx + 10, hy - 6, GOLD[2], width=2.2)
    stamp(c, t)
    c.line(hx - 1, hy - 9, hx + 9, hy - 7, GOLD[3])
    c.set(hx + 4, hy - 7, BLOT[3]); c.set(hx + 5, hy - 7, BLOT[1])
    # yeux globuleux sur le dessus du crâne
    for ex, ey, r in ((hx + 3, hy - 4, 2.6), (hx - 4, hy - 3.5, 3.8)):
        t = new()
        ball(t, ex, ey, r, r, SK)
        stamp(c, t)
    for ex, ey, w_, h_ in ((hx + 2, hy - 6, 3, 3), (hx - 7, hy - 6, 5, 4)):
        c.rect(ex, ey, w_, h_, SAEYE[1])
        c.rect(ex, ey, w_, 1, SAEYE[2])
        c.set(ex + w_ - 1, ey + h_ - 1, SAEYE[0])
        c.set(ex + w_ - 2, ey + h_ - 1, SAEYE[0])
        c.rect(ex + 1, ey, 1 if w_ < 5 else 2, h_, OUT)
        c.set(ex, ey, WHITE)
        if w_ == 5:
            c.set(ex + 3, ey + 1, WHITE)
    # sourcils menaçants
    c.line(hx - 8, hy - 8, hx - 2, hy - 7, OUT)
    c.line(hx - 7, hy - 9, hx - 3, hy - 8, SK[4])
    c.line(hx + 2, hy - 7, hx + 5, hy - 8, OUT)
    # gueule
    my = hy + 3
    if atk:
        c.rect(hx - 10, my - 1, 12, 4, '#2a0610')
        c.line(hx - 9, my + 2, hx, my + 2, BLOT[1])
        c.line(hx - 7, my + 1, hx - 2, my + 1, BLOT[2])
        for x in (hx - 10, hx - 7, hx - 4, hx - 1):
            c.set(x, my - 1, WHITE)
        c.set(hx - 8, my + 2, WHITE); c.set(hx - 3, my + 2, WHITE)
    else:
        c.line(hx - 10, my, hx + 1, my + 1, OUT)
        c.line(hx + 1, my + 1, hx + 3, my - 1, OUT)
        c.line(hx - 6, my + 1, hx - 1, my + 2, BLOT[1])
        c.set(hx - 8, my + 1, WHITE); c.set(hx - 3, my + 2, WHITE); c.set(hx, my + 2, WHITE)
    c.set(hx - 10, hy - 1, OUT); c.set(hx - 9, hy - 1, OUT)             # narine

    # ---- lance de feu + bras proche
    if atk:
        hand = (X + 11, 30)
        p0, p1 = (X + 27, 26), (X + 3, 32)          # hampe (arrière -> pointe)
    else:
        hand = (X + 4, 30 + by)
        p0, p1 = (X + 4, G), (X + 2, 12 + by)
    dx, dy = p1[0] - p0[0], p1[1] - p0[1]
    n = math.hypot(dx, dy)
    ux, uy = dx / n, dy / n
    px, py = -uy, ux
    tip = (p1[0] + ux * 8, p1[1] + uy * 8)
    if atk:
        fx = new()
        burst(fx, tip[0] - 1, tip[1], 6.5, FIRE)
        stamp(c, fx, FIRE[0])
        t = new()
        for k in range(3):
            t.line(p0[0] + 4 - k * 6, p0[1] - 4 + k * 1.5 - k % 2, p0[0] - 2 - k * 6, p0[1] - 2.5 + k * 1.5 - k % 2, FIRE[2 + k % 2])
        stamp(c, t, None)
    else:
        t = new()
        flame_tongue(t, tip[0] + 0.5, p1[1] + 3, 4.6, 15 + f, 1.5 - f * 3, f * 2, FIRE)
        stamp(c, t, None)
    t = new()
    t.line(p0[0], p0[1], p1[0], p1[1], HIDE[2], width=2)
    t.line(p0[0] - 0.6, p0[1], p1[0] - 0.6, p1[1], HIDE[4])
    # lame d'obsidienne à tranchant de lave
    lm = mask_of(lambda m: m.poly([(p1[0] + px * 2.2, p1[1] + py * 2.2), (tip[0], tip[1]),
                                   (p1[0] - px * 2.2, p1[1] - py * 2.2), (p1[0] - ux * 1.5, p1[1] - uy * 1.5)], '#000'))
    shade(t, lm, OBS, contrast=0.5)
    for k in range(1, 8):
        t.set(p1[0] + ux * k, p1[1] + uy * k, BLOT[2] if k < 6 else BLOT[3])
    # ligature et rubans
    t.line(p1[0] - ux * 2 + px * 1.6, p1[1] - uy * 2 + py * 1.6, p1[0] - ux * 2 - px * 1.6, p1[1] - uy * 2 - py * 1.6,
           GOLD[2])
    stamp(c, t)
    if not atk:
        t = new()
        rb = p1[1] + 2
        t.line(p1[0] + 1, rb, p1[0] + 4 + f, rb + 5, BLOT[1], width=2)
        t.line(p1[0] + 1, rb, p1[0] + 2 - f, rb + 6, BLOT[2])
        stamp(c, t)
    t = new()
    sh = (X + 19, 26 + by) if not atk else (X + 18, 26)
    tube(t, [sh, ((sh[0] + hand[0]) / 2 + 1, (sh[1] + hand[1]) / 2 + 3), hand], [3.0, 2.6, 2.4], SK)
    ball(t, hand[0], hand[1], 2.6, 2.4, SK)
    # épaulière d'obsidienne
    ball(t, sh[0] + 1, sh[1] - 1, 3.6, 3.0, OBS)
    t.set(sh[0] - 1, sh[1] - 3, GOLD[3])
    stamp(c, t)
    blots(c, ((hand[0] + 3, hand[1] - 2, 0.9),))

    # ---- braises
    pts = ((X + 2, 3, 3), (X + 38, 22, 2), (X + 44, 14, 3), (X + 34, 5, 2)) if f != 1 else \
          ((X + 3, 1, 2), (X + 39, 19, 3), (X + 45, 11, 2), (X + 35, 3, 3))
    dots(c, pts, lambda k: FIRE[k])
    return c, (W, H)


# ================================================================ 2. GOLEM DE LAVE (monde 9, étape 10)

LGW, LGH = 60, 56
ROCK = ['#0a080c', '#191419', '#2a2228', '#3e3238', '#5a4a4e']
ROCKF = ['#060408', '#0f0b10', '#1c161c', '#2a2228', '#3e3238']
LAVA = ['#5a0a06', '#b4280a', '#ff6a12', '#ffc23a', '#fff4b0']


def rock_chunk(c, pts, R=ROCK, cracks=(), bias=0.0, contrast=0.5):
    m = spoly(c, pts, R, contrast=contrast, bias=bias)
    for cr in cracks:
        crack(c, cr, LAVA)
    return m


def boulder(new, c, cx, cy, rw, rh, R=ROCK, cracks=(), bias=0.0, pool=False):
    """Bloc de roche octogonal (stampé)."""
    t = new()
    pts = [(cx - rw, cy - rh * 0.3), (cx - rw * 0.55, cy - rh), (cx + rw * 0.45, cy - rh), (cx + rw, cy - rh * 0.4),
           (cx + rw * 0.9, cy + rh * 0.6), (cx + rw * 0.3, cy + rh), (cx - rw * 0.6, cy + rh * 0.9), (cx - rw * 1.02, cy + rh * 0.4)]
    rock_chunk(t, pts, R, cracks, bias)
    if pool:
        t.line(cx - rw * 0.4, cy - rh + 1, cx + rw * 0.35, cy - rh + 1, LAVA[2])
        t.line(cx - rw * 0.3, cy - rh + 1, cx + rw * 0.1, cy - rh + 1, LAVA[3])
        t.set(cx - rw * 0.3, cy - rh + 1, LAVA[4])
    stamp(c, t)


def lava_golem(f):
    W, H = LGW, LGH
    G = H - 4                                     # tout est décalé de 2 vers le bas à la fin
    new = lambda: Layer(W, H)
    c = new()
    atk = f == 2
    by = 1 if f == 1 else 0
    X = 6
    ox, oy = (-2, 2) if atk else (0, by)          # posture (penché en avant pour la frappe)

    # ---- bras lointain
    if atk:
        sh, el, fi = (X + 40 + ox, 17 + oy), (X + 46, 13), (X + 45, 7)
    elif f == 1:
        sh, el, fi = (X + 40, 17 + oy), (X + 47, 26 + oy), (X + 49, 36)
    else:
        sh, el, fi = (X + 40, 17), (X + 45, 27), (X + 45, 38)
    boulder(new, c, (sh[0] + el[0]) / 2 + 1, (sh[1] + el[1]) / 2, 4.5, 6, ROCKF)
    boulder(new, c, fi[0], fi[1], 6.5, 6, ROCKF, cracks=[[(fi[0] - 3, fi[1] - 2), (fi[0], fi[1] + 1), (fi[0] - 1, fi[1] + 4)]])

    # ---- jambes : piliers trapus
    if atk:
        legs = ((X + 35, X + 39), (X + 21, X + 16))
    elif f == 1:
        legs = ((X + 35, X + 39), (X + 21, X + 17))
    else:
        legs = ((X + 35, X + 36), (X + 21, X + 21))
    for i, (hipx, footx) in enumerate(legs):
        R = ROCKF if i == 0 else ROCK
        t = new()
        rock_chunk(t, [(hipx - 5, 38 + oy), (hipx + 5, 38 + oy), (footx + 5, G - 4), (footx - 5, G - 4)], R,
                   cracks=[[(hipx - 1, 41 + oy), (hipx + 1, 44 + oy), (footx, G - 6)]], bias=-0.05)
        stamp(c, t)
        t = new()
        rock_chunk(t, [(footx - 7, G - 5), (footx - 3, G - 7), (footx + 5, G - 6), (footx + 7, G), (footx - 8, G)], R,
                   bias=0.05)
        t.set(footx - 7, G, R[3]); t.set(footx - 4, G, R[3])
        stamp(c, t)

    # ---- bassin
    t = new()
    rock_chunk(t, [(X + 17 + ox, 33 + oy), (X + 40 + ox, 33 + oy), (X + 41 + ox, 40 + oy), (X + 34 + ox, 44 + oy),
                   (X + 22 + ox, 44 + oy), (X + 16 + ox, 40 + oy)], ROCK, bias=-0.08,
               cracks=[[(X + 27 + ox, 36 + oy), (X + 29 + ox, 39 + oy), (X + 27 + ox, 43 + oy)]])
    stamp(c, t)

    # ---- torse : bloc massif, cœur de lave
    t = new()
    tx, ty = X + ox, oy
    rock_chunk(t, [(tx + 13, 17 + ty), (tx + 21, 9 + ty), (tx + 38, 9 + ty), (tx + 46, 16 + ty), (tx + 44, 28 + ty),
                   (tx + 36, 36 + ty), (tx + 20, 36 + ty), (tx + 13, 28 + ty)], ROCK, contrast=0.45)
    cx_, cy_ = tx + 29, 24 + ty
    cm = mask_of(lambda m: m.poly([(cx_ - 5, cy_ - 1), (cx_ - 1, cy_ - 6), (cx_ + 5, cy_ - 3), (cx_ + 5, cy_ + 3),
                                   (cx_, cy_ + 6), (cx_ - 4, cy_ + 4)], '#000'))
    heat(t, cm, LAVA, cx_ - 0.5, cy_, 5, 5.5, bias=0.15 if atk else 0.0)
    for cr in ([(cx_ - 4, cy_ - 2), (cx_ - 8, cy_ - 5), (cx_ - 10, cy_ - 10)],
               [(cx_ + 5, cy_ - 2), (cx_ + 10, cy_ - 6), (cx_ + 14, cy_ - 5)],
               [(cx_ + 3, cy_ + 5), (cx_ + 6, cy_ + 8), (cx_ + 10, cy_ + 9)],
               [(cx_ - 3, cy_ + 5), (cx_ - 7, cy_ + 8), (cx_ - 12, cy_ + 7)]):
        crack(t, cr, LAVA)
    # arête claire (facette)
    t.line(tx + 22, 10 + ty, tx + 15, 18 + ty, ROCK[4])
    stamp(c, t)

    # ---- tête qui dépasse entre les épaules, cornes d'obsidienne
    hx, hy = tx + 27, 8 + ty + (2 if atk else 0)
    t = new()
    horn(t, [(hx + 3, hy - 4), (hx + 6, hy - 8), (hx + 7, hy - 11)], [2.2, 1.4, 0.4], OBS)
    horn(t, [(hx - 3, hy - 5), (hx - 5, hy - 9), (hx - 4, hy - 12)], [2.2, 1.4, 0.4], OBS)
    stamp(c, t)
    t = new()
    rock_chunk(t, [(hx - 8, hy - 2), (hx - 4, hy - 7), (hx + 4, hy - 7), (hx + 7, hy - 2), (hx + 6, hy + 5),
                   (hx - 7, hy + 5)], ROCK, bias=0.12)
    stamp(c, t)
    c.line(hx - 8, hy - 2, hx + 4, hy - 1, OUT)                  # arcade lourde
    c.line(hx - 7, hy - 3, hx + 3, hy - 2, ROCK[4])
    ey = hy
    for ex in (hx - 7, hx - 1):
        c.rect(ex, ey, 4, 2, LAVA[3]); c.set(ex, ey, LAVA[4]); c.set(ex + 1, ey, LAVA[4]); c.set(ex + 3, ey + 1, LAVA[2])
    if atk:
        c.rect(hx - 6, hy + 3, 8, 2, LAVA[2]); c.line(hx - 6, hy + 3, hx + 1, hy + 3, LAVA[4])
        c.set(hx - 6, hy + 4, LAVA[3])
    else:
        crack(c, [(hx - 6, hy + 3), (hx - 3, hy + 4), (hx, hy + 3), (hx + 2, hy + 4)], LAVA, core=False)

    # ---- épaules volcaniques (cratères de lave)
    boulder(new, c, tx + 42, 14 + ty, 6, 5.5, ROCK, pool=True,
            cracks=[[(tx + 42, 15 + ty), (tx + 40, 18 + ty)]])

    # ---- bras proche : énorme poing
    if atk:
        sh, el, fi = (tx + 15, 18 + ty), (tx + 12, 31), (X + 13, G - 6)
    elif f == 1:
        sh, el, fi = (tx + 15, 16 + ty), (tx + 12, 28 + ty), (X + 14, 42)
    else:
        sh, el, fi = (tx + 15, 16), (tx + 10, 27), (X + 10, 40)
    t = new()
    rock_chunk(t, [(sh[0] - 5, sh[1] - 1), (sh[0] + 4, sh[1] - 2), (el[0] + 5, el[1]), (el[0] - 4, el[1] + 1)], ROCK,
               cracks=[[(sh[0], sh[1] + 2), (el[0] + 1, el[1] - 2)]])
    stamp(c, t)
    boulder(new, c, sh[0] - 1, sh[1] - 2, 7, 6, ROCK, pool=True,
            cracks=[[(sh[0] - 4, sh[1] - 1), (sh[0] - 2, sh[1] + 2), (sh[0] - 4, sh[1] + 4)]])
    t = new()
    rock_chunk(t, [(el[0] - 5, el[1] - 3), (el[0] + 5, el[1] - 3), (fi[0] + 6, fi[1] - 3), (fi[0] - 6, fi[1] - 2)], ROCK,
               cracks=[[(el[0] - 1, el[1]), (el[0] - 2, el[1] + 4)]])
    stamp(c, t)
    t = new()
    rock_chunk(t, [(fi[0] - 8, fi[1] - 4), (fi[0] - 2, fi[1] - 7), (fi[0] + 6, fi[1] - 5), (fi[0] + 8, fi[1] + 1),
                   (fi[0] + 5, fi[1] + 6), (fi[0] - 3, fi[1] + 7), (fi[0] - 8, fi[1] + 3)], ROCK, bias=0.04,
               cracks=[[(fi[0] - 4, fi[1] - 3), (fi[0] - 1, fi[1]), (fi[0] - 2, fi[1] + 4)],
                       [(fi[0] + 3, fi[1] - 4), (fi[0] + 5, fi[1] + 1)]])
    for k in range(3):                                          # jointures
        t.setf(fi[0] - 7 + k * 2, fi[1] - 2 + k * 2, ROCK[4])
        t.setf(fi[0] - 6 + k * 2, fi[1] - 2 + k * 2, OUT)
    stamp(c, t)
    if not atk:
        c.line(fi[0] - 2, fi[1] + 8, fi[0] - 2, fi[1] + 9 + f, LAVA[2])    # lave qui goutte
        c.set(fi[0] - 2, fi[1] + 10 + f, LAVA[3])

    # ---- frappe au sol : éruption
    if atk:
        t = new()
        for k, (x, hgt) in enumerate(((X - 5, 12), (X - 1, 20), (X + 4, 25), (X + 9, 16), (X + 22, 11))):
            flame_tongue(t, x, G, 3.4, hgt, -2 + k * 0.5, k * 1.3, LAVA)
        clear_over(t, c)
        stamp(c, t, LAVA[0])
        t = new()
        for x, y in ((X - 3, G - 24), (X + 4, G - 28), (X + 15, G - 23), (X + 21, G - 16), (X - 4, G - 14)):
            rock_chunk(t, [(x - 1.5, y - 1), (x + 1, y - 2), (x + 2, y + 1), (x - 1, y + 2)], ROCK)
        stamp(c, t)
        for x in range(X - 6, X + 24):
            if c.get(x, G) is None and x % 3:
                c.set(x, G, LAVA[1 + (x % 2)])
    glow_ring(c, LAVA[0], LAVA[1], every=2)
    # fumée des cratères (sans contour)
    for k, (x, y) in enumerate(((tx + 42, 6 + ty), (X + 13 + ox, 6 + oy))):
        if atk and k == 1:
            continue
        for (dx, dy, r, col) in ((0, 0, 2.2, SMOKE[1]), (1 - f % 2 * 2, -3, 1.6, SMOKE[0]), (-1, -1, 1, SMOKE[2])):
            m = mask_of(lambda q: q.ellipse(x + dx, y + dy, r, r * 0.8, '#000'))
            for (px, py) in m:
                if c.get(px, py) is None:
                    c.set(px, py, col)
    dots(c, ((X + 2, 6, 3), (X + 51, 30, 2), (X + 52, 4, 3), (X - 2, 24, 2)) if f != 1 else
         ((X + 3, 4, 2), (X + 52, 27, 3), (X + 53, 1, 2), (X - 1, 21, 3)), lambda k: LAVA[k])
    return shifted(c, 0, 2), (W, H)


# ================================================================ 3. DJINN DES FLAMMES (monde 9, étape 15)

DJW, DJH = 58, 60
DJ = ['#3e0812', '#86161a', '#cc3418', '#ff7428', '#ffbc5a']          # peau de braise
DJF = ['#5a0a08', '#b42a0a', '#ff6a14', '#ffc23a', '#fff4b0']          # flammes du corps
DJEYE = ['#ffd040', '#fff6c0', '#ffffff']
RUBY = ['#5a0f2a', '#c0203a', '#ff5a6a', '#ffc0c0']


def fire_ribbon(c, spine, widths, F, phase=0.0):
    """Ruban de feu (queue de djinn) : cœur clair, bords sombres, fines vagues."""
    def f(t, s, x, y):
        k = 4.2 - abs(s) * 2.6 - t * 1.6 + 0.35 * math.sin(t * 14 + phase + y * 0.4)
        if s < -0.55:
            k += 0.6
        return F[max(0, min(len(F) - 1, int(k)))]
    spine_fill(c, spine, widths, f)


def bangle(c, p0, p1, w, R=GOLD):
    """Bracelet d'or perpendiculaire au membre (p0 -> p1 = axe du membre)."""
    dx, dy = p1[0] - p0[0], p1[1] - p0[1]
    n = math.hypot(dx, dy) or 1
    nx, ny = -dy / n, dx / n
    ux, uy = dx / n, dy / n
    for k in range(2):
        for j in range(-int(w * 2), int(w * 2) + 1):
            q = j / 2
            col = R[3] if q < -w * 0.3 else R[2] if q < w * 0.4 else R[1]
            c.set(p0[0] + ux * k + nx * q, p0[1] + uy * k + ny * q, col if k == 0 else R[1])


def djinn(f):
    W, H = DJW, DJH
    new = lambda: Layer(W, H)
    c = new()
    atk = f == 2
    fy = -2 if f == 1 else 0                          # lévitation
    X = 6

    # ---- grandes flammes dorsales (aura)
    t = new()
    for k, (x, y, hgt) in enumerate(((X + 30, 30, 17), (X + 35, 34, 14), (X + 25, 26, 11), (X + 40, 40, 11))):
        flame_tongue(t, x, y + fy, 3.6, hgt + (2 if (k + f) % 2 else 0), 3 + k, f * 1.7 + k, EMBER)
    stamp(c, t, None)

    # ---- queue de fumée de feu
    t = new()
    sw = [0, 2, -1][f]
    tail = [(X + 25, 36 + fy), (X + 26, 44 + fy), (X + 31, 51 + fy), (X + 38, 55 + fy + sw * 0.3), (X + 45, 53 + sw),
            (X + 48, 48 + sw)]
    fire_ribbon(t, tail, [8.5, 7.5, 5.5, 3.8, 2.2, 0.6], DJF, phase=f * 2)
    stamp(c, t)
    t = new()
    for k, (x, y) in enumerate(((X + 30, 47), (X + 37, 52), (X + 43, 50))):
        flame_tongue(t, x, y + fy, 2.2, 6 + (k + f) % 2 * 2, 2, k + f, DJF)
    stamp(c, t, None)

    # ---- bras lointain : levé, boule de feu dans la paume (repos) / poussé en avant (attaque)
    far = [(X + 32, 23 + fy), (X + 40, 19 + fy), (X + 42, 12 + fy)]
    t = new()
    tube(t, far, [3.4, 2.8, 2.6], [DJ[0], DJ[0], DJ[1], DJ[2], DJ[3]])
    ball(t, far[-1][0], far[-1][1], 2.6, 2.4, [DJ[0], DJ[1], DJ[2], DJ[3], DJ[3]])
    bangle(t, ((far[1][0] + far[2][0]) / 2, (far[1][1] + far[2][1]) / 2), far[2], 3.2)
    stamp(c, t)
    if True:
        t = new()
        burst(t, far[-1][0] - 0.5, far[-1][1] - 5, 3.6 + f * 0.6, DJF, spikes=6, phase=f)
        flame_tongue(t, far[-1][0], far[-1][1] - 6, 2.4, 7, 1, f, DJF)
        stamp(c, t, DJF[0])

    # ---- torse en V
    t = new()
    ty = fy
    tm = mask_of(lambda m: m.poly([(X + 13, 21 + ty), (X + 22, 18 + ty), (X + 33, 19 + ty), (X + 36, 24 + ty),
                                   (X + 31, 36 + ty), (X + 20, 37 + ty), (X + 16, 30 + ty)], '#000'))
    shade(t, tm, DJ, contrast=0.55, bias=0.0)
    # pectoraux / abdominaux
    t.line(X + 18, 27 + ty, X + 24, 28 + ty, DJ[1]); t.line(X + 25, 28 + ty, X + 30, 26 + ty, DJ[1])
    t.line(X + 24, 22 + ty, X + 24, 28 + ty, DJ[1])
    for y in (31, 34):
        t.line(X + 21, y + ty, X + 27, y + ty, DJ[1])
    t.line(X + 24, 29 + ty, X + 24, 36 + ty, DJ[1])
    t.line(X + 16, 22 + ty, X + 22, 20 + ty, DJ[4])
    # collier d'or
    for x in range(X + 17, X + 30):
        y = 21 + ty + (1 if X + 19 < x < X + 28 else 0)
        t.setf(x, y, GOLD[2] if x % 3 else GOLD[3])
    t.setf(X + 23, 22 + ty, RUBY[2]); t.setf(X + 24, 22 + ty, RUBY[1])
    stamp(c, t)
    # ceinture d'or + rubis
    t = new()
    SASH = ['#1e0414', '#3e0a24', '#6a1434', '#962440', '#c0404a']
    spoly(t, [(X + 18, 35 + ty), (X + 33, 35 + ty), (X + 32, 39 + ty), (X + 19, 39 + ty)], SASH, contrast=0.5)
    t.line(X + 18, 35 + ty, X + 33, 35 + ty, GOLD[3]); t.line(X + 19, 39 + ty, X + 32, 39 + ty, GOLD[1])
    t.line(X + 28, 39 + ty, X + 31, 44 + ty + f % 2, SASH[2], width=2)      # pan de ceinture
    ball(t, X + 24, 37 + ty, 2.2, 2.2, GOLD)
    t.set(X + 24, 37 + ty, RUBY[2])
    stamp(c, t)

    # ---- tête : crâne lisse, mèche de flamme, oreille pointue
    hx, hy = (X + 22, 12 + fy) if not atk else (X + 20, 13)
    t = new()
    flame_tongue(t, hx + 3, hy - 4, 3.8, 15 + f, 7 - f * 2, f * 1.5, DJF)                 # chignon de flamme
    stamp(c, t, None)
    t = new()
    ball(t, hx, hy, 7.5, 7, DJ)
    spoly(t, [(hx - 7, hy + 1), (hx + 3, hy + 3), (hx + 2, hy + 8), (hx - 3, hy + 8), (hx - 7, hy + 5)], DJ, contrast=0.3)
    # bandeau d'or à rubis
    t.line(hx - 7, hy - 4, hx + 7, hy - 5, GOLD[2]); t.line(hx - 6, hy - 5, hx + 6, hy - 6, GOLD[3])
    t.set(hx - 2, hy - 5, RUBY[2]); t.set(hx - 1, hy - 5, RUBY[1])
    stamp(c, t)
    t = new()
    spoly(t, [(hx + 4, hy - 1), (hx + 11, hy - 4), (hx + 6, hy + 3)], DJ, contrast=0.4)               # oreille
    stamp(c, t)
    c.set(hx + 6, hy + 3, GOLD[3]); c.set(hx + 6, hy + 4, GOLD[2]); c.set(hx + 7, hy + 5, GOLD[2])
    c.set(hx + 6, hy + 6, GOLD[1]); c.set(hx + 5, hy + 5, GOLD[2])
    # yeux blancs incandescents, sourcils noirs
    ey = hy - 1
    for ex, w_ in ((hx - 7, 4), (hx - 1, 3)):
        c.line(ex, ey + 2, ex + w_ - 1, ey + 2, DJ[0])
        c.rect(ex, ey, w_, 2, DJEYE[1]); c.set(ex, ey + 1, WHITE); c.set(ex + 1, ey + 1, WHITE)
        c.set(ex + w_ - 1, ey + 1, DJEYE[0])
    c.line(hx - 8, ey - 2, hx - 3, ey, OUT); c.line(hx - 8, ey - 1, hx - 4, ey, OUT)
    c.line(hx - 1, ey, hx + 2, ey - 2, OUT); c.line(hx, ey, hx + 2, ey - 1, OUT)
    c.set(hx - 4, ey + 4, DJ[0]); c.set(hx - 5, ey + 4, DJ[1])                          # nez
    # bouche
    my = hy + 6
    if atk:
        c.rect(hx - 6, my - 1, 5, 3, '#2a0610'); c.line(hx - 5, my + 1, hx - 2, my + 1, DJF[2])
        c.set(hx - 6, my - 1, WHITE); c.set(hx - 2, my - 1, WHITE)
    else:
        c.line(hx - 6, my, hx - 1, my, OUT); c.set(hx - 1, my - 1, OUT); c.set(hx - 6, my - 1, OUT)
        c.set(hx - 4, my, WHITE)
    # barbiche de feu
    t = new()
    frond(t, [(hx - 3, hy + 8), (hx - 5, hy + 11), (hx - 4, hy + 14 + f % 2)], [2.2, 1.5, 0.4], DJF, lo=1)
    stamp(c, t)

    # ---- bras proche : paume ouverte vers l'avant
    if atk:
        near = [(X + 16, 23), (X + 11, 25), (X + 6, 24)]
    else:
        near = [(X + 16, 23 + fy), (X + 11, 30 + fy), (X + 6, 30 + fy)]
    t = new()
    ball(t, near[0][0] + 1, near[0][1], 4.4, 3.8, DJ)
    tube(t, near, [3.6, 3.0, 2.8], DJ)
    ball(t, near[-1][0], near[-1][1], 2.8, 2.6, DJ)
    for x in range(-1, 2):
        t.set(near[-1][0] - 2, near[-1][1] + x, DJ[2])
    bangle(t, ((near[1][0] + near[2][0]) / 2 + 0.5, (near[1][1] + near[2][1]) / 2), near[2], 3.2)
    bangle(t, ((near[0][0] + near[1][0]) / 2, (near[0][1] + near[1][1]) / 2 - 0.5), near[1], 3.6)
    stamp(c, t)

    # ---- boule de feu
    if atk:
        t = new()
        burst(t, X + 1, 23, 7.5, DJF, spikes=9, phase=0.4)
        for k, dy in enumerate((-6, 6, -9, 9)):                 # langues de feu traînantes
            frond(t, [(X + 9 + k * 2, 23 + dy * 0.9), (X + 4, 23 + dy * 0.7), (X - 1, 23 + dy * 0.4)],
                  [0.4, 1.2, 2.0], DJF, lo=1)
        stamp(c, t, DJF[0])
    else:
        t = new()
        burst(t, near[-1][0] - 3, near[-1][1] - 5 - f, 3.8, DJF, spikes=6, phase=f)
        flame_tongue(t, near[-1][0] - 3, near[-1][1] - 6 - f, 2.6, 8, -1, f, DJF)
        stamp(c, t, DJF[0])
    glow_ring(c, DJF[0], DJF[1], every=2)
    dots(c, ((X + 4, 8, 3), (X + 46, 30, 2), (X + 48, 18, 3), (X + 12, 46, 2), (X + 2, 40, 3)) if f != 1 else
         ((X + 5, 5, 2), (X + 47, 27, 3), (X + 49, 15, 2), (X + 13, 43, 3), (X + 3, 37, 2)), lambda k: DJF[k])
    return shifted(c, 0, 3), (W, H)


# ================================================================ 4. PHÉNIX ANCESTRAL (monde 9, méga boss)

PXW, PXH = 76, 70
PF = ['#4a0818', '#9a140e', '#e03c0e', '#ff8418', '#ffcc40', '#fff6c8']        # plumes de feu
PFD = ['#24040e', '#4a0a14', '#7a120e', '#b02a0c', '#e0561a', '#ff8a2a']       # aile lointaine
PB = ['#2e0612', '#6a0e16', '#a8200e', '#d84a14', '#ff8a2a']                   # corps
PEYE = ['#ff9a1a', '#fff09a', '#ffffff']


def feather(c, base, ang, length, width, F, curl=0.0, lo=0, shaft=None):
    """Plume effilée : base sombre -> pointe claire, légèrement recourbée."""
    a = math.radians(ang)
    pts = []
    for k in range(5):
        u = k / 4
        aa = a + math.radians(curl) * u * u
        if not pts:
            pts.append(base)
        else:
            px, py = pts[-1]
            pts.append((px + math.cos(aa) * length / 4, py + math.sin(aa) * length / 4))
    frond(c, pts, [width * 0.8, width, width * 0.9, width * 0.55, 0.3], F, lo=lo)
    if shaft:
        for k in range(1, 3):
            c.line(pts[k - 1][0], pts[k - 1][1], pts[k][0], pts[k][1], shaft)
    return pts[-1]


def feather_wing(new, c, shoulder, wrist, prim, sec, F, cov, edge, flames=0):
    """Aile de plumes individuelles (chacune contournée) + couvertures.
    prim : [(angle, longueur)] du poignet vers l'intérieur ; sec : idem le long du bras."""
    ax, ay = wrist[0] - shoulder[0], wrist[1] - shoulder[1]
    tips = []
    for i, (ang, L) in enumerate(sec):
        u = 0.25 + 0.6 * i / max(1, len(sec) - 1)
        b = (shoulder[0] + ax * u, shoulder[1] + ay * u)
        t = new()
        feather(t, b, ang, L, 3.0, F, curl=10, lo=0, shaft=F[3])
        stamp(c, t)
    for i, (ang, L) in enumerate(prim[::-1]):
        k = len(prim) - 1 - i
        u = 1.0 - 0.09 * k
        b = (shoulder[0] + ax * u, shoulder[1] + ay * u)
        t = new()
        tips.append(feather(t, b, ang, L, 3.2, F, curl=-12, lo=0, shaft=F[3]))
        stamp(c, t)
    # couvertures
    t = new()
    nx, ny = -ay, ax
    n = math.hypot(nx, ny) or 1
    nx, ny = nx / n, ny / n
    mdx = sum(math.cos(math.radians(a)) for a, _ in list(sec) + list(prim))
    mdy = sum(math.sin(math.radians(a)) for a, _ in list(sec) + list(prim))
    side = 1 if mdx * nx + mdy * ny >= 0 else -1
    pts = [shoulder, wrist, (wrist[0] + nx * 4 * side + ax * 0.08, wrist[1] + ny * 4 * side + ay * 0.08)]
    for k in range(4, 0, -1):
        u = k / 5
        bump = 7.5 if k % 2 else 6
        pts.append((shoulder[0] + ax * u + nx * bump * side, shoulder[1] + ay * u + ny * bump * side))
    pts.append((shoulder[0] + nx * 5 * side, shoulder[1] + ny * 5 * side))
    m = mask_of(lambda q: q.poly(pts, '#000'))
    shade(t, m, cov, contrast=0.4)
    for (x, y) in m:                                     # écailles de plumes en quinconce
        if y % 3 == 0 and (x + (y // 3) * 2) % 4 == 0:
            t.set(x, y, cov[0])
        elif y % 3 == 1 and (x + (y // 3) * 2) % 4 == 0:
            t.set(x, y, cov[min(4, 3)])
    t.line(shoulder[0], shoulder[1], wrist[0], wrist[1], edge, width=2)
    t.line(shoulder[0], shoulder[1] - 1, wrist[0], wrist[1] - 1, GOLD[4])
    stamp(c, t)
    if flames:
        t = new()
        for i, tp in enumerate(tips[::2]):
            flame_tongue(t, tp[0], tp[1] + 1, 1.4, 4, 1, i, F[1:])
        clear_over(t, c)
        stamp(c, t, None)
    return tips


def phoenix(f):
    W, H = PXW, PXH
    new = lambda: Layer(W, H)
    c = new()
    atk = f == 2
    fy = -1 if f == 1 else 0                      # le battement soulève le corps
    hx, hy = (19, 25 + fy) if not atk else (19, 25)

    # ---- anneau de feu sacré derrière l'oiseau
    t = new()
    for k in range(0, 360, 3):
        a = math.radians(k + f * 6)
        r = 29 + (1.2 if (k // 3) % 4 == 0 else 0)
        col = EMBER[2] if (k // 3) % 5 else EMBER[3]
        t.set(44 + math.cos(a) * r, 33 + math.sin(a) * r * 0.95, col)
        t.set(44 + math.cos(a) * (r - 1), 33 + math.sin(a) * (r - 1) * 0.95, EMBER[1])
    stamp(c, t, None)
    # ---- halo de feu (aura)
    t = new()
    for k, (x, y, hgt) in enumerate(((44, 40, 20), (52, 44, 15), (36, 42, 13))):
        flame_tongue(t, x, y + fy, 4.5, hgt + (2 if (k + f) % 2 else 0), 3, f + k, EMBER)
    stamp(c, t, None)

    # ---- aile lointaine (V héraldique)
    COVF = [PFD[0], PFD[1], PFD[2], PFD[3], PFD[3]]
    if f == 1:
        feather_wing(new, c, (43, 38 + fy), (48, 51), [(115, 15), (100, 16), (85, 16), (70, 14)],
                     [(55, 9), (45, 9)], PFD, COVF, PFD[3])
    elif atk:
        feather_wing(new, c, (41, 34), (31, 19), [(-150, 16), (-138, 18), (-126, 17), (-114, 15)],
                     [(-100, 10), (-90, 9)], PFD, COVF, PFD[3])
    else:
        feather_wing(new, c, (42, 34), (41, 18), [(-122, 16), (-106, 17), (-90, 17), (-74, 16), (-58, 14)],
                     [(-45, 10), (-30, 9)], PFD, COVF, PFD[3])

    # ---- traîne : trois longues plumes de flamme à ocelles
    sw = [0, 3, -2][f]
    tails = ([(50, 45), (57, 50), (63, 54 + sw), (69, 55 + sw), (75, 51 + sw)],
             [(48, 47), (53, 54), (58, 60 + sw), (64, 64 + sw), (71, 66 + sw * 0.5)],
             [(46, 48), (47, 55), (49, 61), (53, 66 + sw * 0.4), (59, 69)])
    for sp in tails:
        sp = [(x, y + fy * (1 - k / 5)) for k, (x, y) in enumerate(sp)]
        t = new()
        frond(t, sp, [2.0, 2.4, 2.0, 2.8, 0.4], PF, lo=1)
        stamp(c, t)
        ex, ey = sp[3]
        c.ellipse(ex, ey, 1.8, 1.8, GOLD[3], only_inside=True)
        c.setf(ex, ey, PF[1]); c.setf(ex - 1, ey, GOLD[4])

    # ---- corps
    t = new()
    bm = mask_of(lambda m: m.ellipse(40, 40 + fy, 12, 9, '#000'))
    bm |= mask_of(lambda m: m.poly([(44, 34 + fy), (55, 43 + fy), (49, 48 + fy), (36, 47 + fy)], '#000'))
    shade(t, bm, PB, contrast=0.45)
    chest = mask_of(lambda m: m.ellipse(35, 42 + fy, 6.5, 6, '#000'))
    heat(t, {p for p in chest if p in bm}, PF, 33, 41 + fy, 7, 7)
    # écailles de plumes sur le flanc
    for (x, y) in sorted(bm):
        if (x, y) in chest:
            continue
        if (y - fy) % 3 == 0 and (x + (y // 3) * 2) % 4 == 0 and t.get(x, y) in (PB[2], PB[3]):
            t.set(x, y, PB[1])
    stamp(c, t)
    # serres repliées
    t = new()
    for k, x in enumerate((38, 43)):
        tube(t, [(x, 46 + fy), (x - 1, 50 + fy), (x - 3, 52 + fy)], [1.6, 1.3, 1.1], GOLD)
        t.set(x - 4, 53 + fy, GOLD[3]); t.set(x - 2, 53 + fy, GOLD[3]); t.set(x - 4, 52 + fy, GOLD[2])
    stamp(c, t)

    # ---- cou
    t = new()
    tube(t, [(38, 38 + fy), (29, 34 + fy), (hx + 4, hy + 3)], [5.5, 4.4, 4.0], PB, contrast=0.4)
    for k in range(4):
        t.setf(hx + 6 + k * 3, hy + 6 + k, PF[3])
    stamp(c, t)

    # ---- crête : longues mèches de flamme
    t = new()
    crest = ((hx + 2, hy - 4, -60, 15), (hx + 4, hy - 3, -35, 17), (hx + 5, hy - 1, -15, 15), (hx + 5, hy + 1, 5, 11))
    for k, (x, y, a, L) in enumerate(crest):
        feather(t, (x, y), a + (6 if (k + f) % 2 else -4), L, 2.4, PF, curl=-25 if k < 2 else 20, lo=1)
    stamp(c, t)

    # ---- tête
    t = new()
    ball(t, hx, hy, 6, 5.5, PB)
    heat(t, mask_of(lambda m: m.ellipse(hx - 2.5, hy + 2.5, 3, 2.4, '#000')), PF, hx - 3, hy + 2, 4, 3)
    stamp(c, t)
    # bec d'or crochu
    t = new()
    if atk:
        spoly(t, [(hx - 4, hy - 1), (hx - 12, hy), (hx - 13, hy + 2), (hx - 9, hy + 1), (hx - 4, hy + 2)], GOLD, contrast=0.6)
        spoly(t, [(hx - 4, hy + 4), (hx - 10, hy + 7), (hx - 4, hy + 6)], GOLD, contrast=0.5, bias=-0.1)
    else:
        spoly(t, [(hx - 4, hy - 1), (hx - 11, hy + 1), (hx - 12, hy + 4), (hx - 9, hy + 3), (hx - 4, hy + 4)], GOLD,
              contrast=0.6)
    stamp(c, t)
    if atk:
        c.set(hx - 6, hy + 3, PF[5]); c.set(hx - 7, hy + 4, PF[4]); c.set(hx - 5, hy + 4, PF[4])
    else:
        c.line(hx - 9, hy + 3, hx - 4, hy + 3, GOLD[1])
    # œil ardent
    ex, ey = hx - 3, hy - 2
    c.rect(ex - 1, ey - 1, 5, 4, OUT)
    c.rect(ex, ey, 3, 2, PEYE[1]); c.set(ex, ey, WHITE); c.set(ex + 2, ey + 1, PEYE[0])
    c.set(ex + 1, ey + 1, OUT)
    c.line(ex - 2, ey - 2, ex + 4, ey - 1, OUT)
    c.line(ex + 4, ey, ex + 6, ey + 1, PF[4])                        # trait de fard

    # ---- aile proche
    COV = [PB[1], PB[2], PB[3], PB[4], PB[4]]
    if f == 1:
        feather_wing(new, c, (44, 37 + fy), (35, 50), [(152, 17), (137, 19), (122, 20), (107, 19), (92, 17)],
                     [(80, 13), (68, 12), (56, 11)], PF, COV, GOLD[3], flames=1)
    elif atk:
        feather_wing(new, c, (45, 36), (44, 18), [(-108, 20), (-92, 22), (-76, 22), (-60, 21), (-45, 19)],
                     [(-30, 13), (-15, 13), (0, 12)], PF, COV, GOLD[3], flames=1)
    else:
        feather_wing(new, c, (45, 37), (55, 22), [(-76, 21), (-59, 24), (-42, 25), (-25, 24), (-9, 21)],
                     [(5, 15), (18, 14), (32, 12)], PF, COV, GOLD[3], flames=1)

    # ---- vague de feu : double croissant de flammes projeté vers la gauche
    if atk:
        fx = new()
        arc_fx(fx, 36, 40, 32, 1.05, 128, 236, 8, PF[1:], lead=0.55, fade=0.25)
        arc_fx(fx, 38, 40, 23, 1.0, 140, 222, 4, PF[1:], lead=0.55, fade=0.25)
        for k in range(7):                                    # langues sur le front de la vague
            a = math.radians(140 + k * 14)
            x, y = 36 + math.cos(a) * 31.5, 40 + math.sin(a) * 32 * 1.05
            flame_tongue(fx, x, y + 1, 1.8, 5 + k % 2 * 2, -2, k, PF[1:])
        breath(fx, hx - 10, hy + 3, 7, hy + 7, 1.4, 3.5, PF[1:], 0.4)
        clear_over(fx, c)
        stamp(c, fx, PF[0])
        dots(c, ((4, 18, 4), (2, 64, 3), (8, 10, 3), (6, 66, 4)), lambda k: PF[k])
    glow_ring(c, EMBER[1], EMBER[2], every=1)
    sparks = ((8, 8, 3), (70, 6, 4), (64, 30, 3), (30, 64, 2), (4, 44, 4), (74, 22, 3)) if f != 1 else \
             ((9, 5, 4), (71, 3, 3), (66, 26, 4), (31, 61, 3), (5, 40, 3), (75, 18, 2))
    dots(c, sparks, lambda k: PF[k])
    return shifted(c, -3, 0), (W, H)


# ================================================================ 5. GUETTEUR DU NÉANT (monde 10, étape 5)

VWW, VWH = 52, 50
FLESH = ['#120a26', '#24123e', '#3a1e5c', '#56307e', '#7a4aa4']
SCLERA = ['#4a3a7a', '#8a7ab8', '#c8bce8', '#eeeaff']
TENT = ['#1a0a30', '#36145a', '#582886', '#8048b8', '#3ad8ff', '#c8faff']


def void_watcher(f):
    W, H = VWW, VWH
    new = lambda: Layer(W, H)
    c = new()
    atk = f == 2
    fy = -1 if f == 1 else 0
    cx, cy = 31, 19 + fy

    # ---- tentacules (derrière le corps)
    for k in range(5):
        bx = cx - 9 + k * 4.5
        ph = k * 1.3 + f * 1.6
        L = 18 + (k % 2) * 4 - abs(k - 2)
        sp = []
        for j in range(6):
            u = j / 5
            spread = (k - 2) * (5 if atk else 2.5) * u
            sp.append((bx + spread + math.sin(ph + u * 4) * 2.2 * u, cy + 8 + u * L + (abs(k - 2) * -1 if atk else 0) * u))
        t = new()
        frond(t, sp, [3.0, 2.6, 2.0, 1.5, 1.0, 0.4], TENT if k % 2 == 0 else TENT, lo=0)
        stamp(c, t)
        for j in (1, 2, 3):                                     # ventouses
            x, y = sp[j]
            c.setf(x + 1, y, TENT[3])

    # ---- piquants dorsaux
    t = new()
    for k, (a, L) in enumerate(((-130, 8), (-105, 10), (-80, 10), (-55, 8), (-30, 6))):
        r = math.radians(a)
        bx_, by_ = cx + 2 + math.cos(r) * 11, cy + math.sin(r) * 11
        horn(t, [(bx_, by_), (bx_ + math.cos(r) * L * 0.6 + 1.5, by_ + math.sin(r) * L * 0.6),
                 (bx_ + math.cos(r) * L + 3, by_ + math.sin(r) * L - 0.5)], [2.4, 1.4, 0.3],
             [FLESH[0], FLESH[1], FLESH[3], CYAN[2], CYAN[3]])
    stamp(c, t)

    # ---- corps : globe de chair cosmique
    t = new()
    bm = mask_of(lambda q: q.ellipse(cx + 1, cy, 13.5, 12.5, '#000'))
    cosmos(t, bm, FLESH, NEB, seed=3, density=17, contrast=0.4)
    for k in range(3):                                          # plis
        a0 = 300 + k * 18
        for a in range(a0, a0 + 60, 4):
            r = math.radians(a)
            t.setf(cx + 1 + math.cos(r) * (10.5 - k * 0.3), cy + math.sin(r) * (10 - k * 0.3), FLESH[1])
    stamp(c, t)

    # ---- l'œil
    ex, ey = cx - 3, cy + 0.5
    t = new()
    em = mask_of(lambda q: q.ellipse(ex, ey, 10, 9 if atk else 8, '#000'))
    shade(t, em, SCLERA, contrast=0.35, bias=0.1)
    # veines
    for (x0, y0, x1, y1) in ((ex + 9, ey - 2, ex + 5, ey - 1), (ex + 8, ey + 4, ex + 4, ey + 3), (ex + 3, ey - 7, ex + 2, ey - 4)):
        t.line(x0, y0, x1, y1, NEB[2])
    # iris (regard à gauche)
    ix = ex - 3 + (1 if f == 1 else 0)
    iy = ey
    ir = 5.5 if not atk else 5
    im = mask_of(lambda q: q.ellipse(ix, iy, ir, ir, '#000'))
    for (x, y) in im:
        d = math.hypot(x + 0.5 - ix, y + 0.5 - iy) / ir
        t.set(x, y, CYAN[1] if d > 0.82 else CYAN[2] if d > 0.45 else CYAN[3])
    if atk:
        t.rect(int(ix) - 1, int(iy) - 1, 2, 2, OUT)
    else:
        t.rect(int(ix) - 1, int(iy) - 4, 2, 8, OUT)
        t.set(int(ix) - 1, int(iy) - 4, CYAN[1]); t.set(int(ix), int(iy) + 3, CYAN[1])
    stamp(c, t)
    gx, gy = int(ix) - 4, int(iy) - 3
    c.rect(gx, gy, 2, 2, WHITE); c.set(gx + 2, gy, WHITE)
    c.set(int(ix) + 2, int(iy) + 2, CYAN[4])
    # paupières (lourdes et menaçantes au repos, grandes ouvertes à l'attaque)
    t = new()
    if atk:
        lid = [(ex - 11, ey - 8), (ex - 4, ey - 11), (ex + 6, ey - 10), (ex + 11, ey - 6), (ex + 6, ey - 8), (ex - 3, ey - 9)]
    else:
        lid = [(ex - 11, ey - 2), (ex - 6, ey - 9), (ex + 4, ey - 10), (ex + 11, ey - 5), (ex + 6, ey - 5), (ex - 2, ey - 5)]
    spoly(t, lid, FLESH, contrast=0.4, bias=0.12)
    low = [(ex - 10, ey + 5), (ex - 2, ey + 6), (ex + 7, ey + 5), (ex + 10, ey + 3), (ex + 9, ey + 9), (ex - 4, ey + 10)]
    spoly(t, low, FLESH, contrast=0.4, bias=-0.05)
    stamp(c, t)
    if not atk:
        c.line(ex - 8, ey - 5, ex + 4, ey - 6, NEB[3])            # lueur de la paupière

    # ---- rayon du néant
    if atk:
        fx = new()
        y0 = iy
        for x in range(-2, int(ix) - 2):
            u = (int(ix) - 2 - x) / (ix + 2)
            hw = 2.2 + u * 1.6 + 0.6 * math.sin(x * 0.9)
            for yy in range(int(y0 - hw - 1), int(y0 + hw + 2)):
                d = abs(yy + 0.5 - y0) / hw
                if d <= 1:
                    fx.set(x, yy, CYAN[4] if d < 0.3 else CYAN[3] if d < 0.6 else CYAN[2] if d < 0.85 else CYAN[1])
        for k in range(0, 360, 30):                             # anneau d'impulsion
            r = math.radians(k)
            fx.set(ix - 7 + math.cos(r) * 2.5, y0 + math.sin(r) * 6, CYAN[3])
        clear_over(fx, c)
        stamp(c, fx, CYAN[0])
    glow_ring(c, NEB[0], NEB[1], every=2)
    pts = ((6, 6), (46, 4), (48, 30), (4, 38), (14, 46)) if f != 1 else ((7, 4), (45, 6), (49, 28), (5, 35), (15, 44))
    for k, (x, y) in enumerate(pts):
        if c.get(x, y) is None:
            if k % 2:
                c.set(x, y, STAR)
            else:
                sparkle(c, x, y, CYAN[2], STAR)
    return shifted(c, 0, 3), (W, H)


# ================================================================ 6. DÉVOREUR D'ÉTOILES (monde 10, étape 10)

SDW, SDH = 60, 52
HIDEV = ['#06051a', '#100d2e', '#1c1848', '#2c2668', '#443c92']        # peau-cosmos
HIDEF = ['#040312', '#0a0822', '#131036', '#1e1a4e', '#2c2668']
CRYS = ['#14306e', '#1e6ab8', '#3ab4f0', '#9ae8ff', '#ffffff']           # cristal du néant
MAWC = '#05030c'


def black_hole(c, x, y, r, phase=0):
    """Petit trou noir : disque noir, spirale d'accrétion cyan / violette."""
    for k in range(0, 720, 12):
        a = math.radians(k + phase * 40)
        rr = r * (0.45 + k / 720 * 0.75)
        col = CYAN[3] if k < 200 else CYAN[2] if k < 420 else NEB[3] if k < 600 else NEB[2]
        c.setf(x + math.cos(a) * rr, y + math.sin(a) * rr * 0.8, col)
    c.ellipse(x, y, r * 0.42, r * 0.38, MAWC, only_inside=True)
    c.setf(x, y, MAWC)


def star_devourer(f):
    W, H = SDW, SDH
    G = H - 2
    new = lambda: Layer(W, H)
    c = new()
    atk = f == 2
    by = (1 if f == 1 else 0) + 3                    # corps plus bas (pattes trapues)
    X = 3
    lo = 2 if atk else 0                              # tête basse à l'attaque

    # ---- queue-comète
    t = new()
    sw = [0, 2, -1][f]
    tail = [(X + 47, 29 + by), (X + 53, 27), (X + 55 + sw * 0.5, 19), (X + 53 + sw, 12)]
    tube(t, tail, [3.6, 2.8, 2.0, 1.2], HIDEV, contrast=0.4)
    stamp(c, t)
    t = new()
    tx_, ty_ = tail[-1]
    for k in range(3):
        flame_tongue(t, tx_ + k - 1, ty_ + 2, 2.4 - k * 0.5, 8 - k * 2, 2 + sw, f + k, NEB)
    stamp(c, t, NEB[0])
    star4(c, tx_, ty_ - 1, [CYAN[1], CYAN[2], CYAN[3]], 3)

    # ---- pattes lointaines
    if f == 1:
        legs_far = [((X + 23, 34), (X + 25, 42), (X + 25, G - 1)), ((X + 45, 34), (X + 44, 42), (X + 43, G - 1))]
        legs_near = [((X + 18, 34), (X + 14, 42), (X + 13, G - 1)), ((X + 41, 34), (X + 45, 42), (X + 47, G - 1))]
    elif atk:
        legs_far = [((X + 22, 35), (X + 19, 43), (X + 17, G - 1)), ((X + 45, 34), (X + 49, 42), (X + 51, G - 1))]
        legs_near = [((X + 17, 35), (X + 12, 42), (X + 9, G - 1)), ((X + 41, 34), (X + 44, 42), (X + 46, G - 1))]
    else:
        legs_far = [((X + 23, 34), (X + 21, 42), (X + 20, G - 1)), ((X + 45, 34), (X + 47, 42), (X + 48, G - 1))]
        legs_near = [((X + 18, 34), (X + 17, 42), (X + 16, G - 1)), ((X + 41, 34), (X + 42, 42), (X + 42, G - 1))]
    for (hip, knee, paw) in legs_far:
        t = new()
        tube(t, [(hip[0], hip[1] + by), knee, paw], [3.6, 2.8, 2.4], HIDEF)
        spoly(t, [(paw[0] - 4, G - 2), (paw[0] + 2, G - 2), (paw[0] + 2, G), (paw[0] - 5, G)], HIDEF)
        t.set(paw[0] - 5, G, CRYS[2]); t.set(paw[0] - 3, G, CRYS[2])
        stamp(c, t)

    # ---- crinière de nébuleuse (derrière le cou)
    t = new()
    for k, (x, y, hgt) in enumerate(((X + 22, 22, 12), (X + 27, 21, 14), (X + 32, 23, 12), (X + 37, 25, 9), (X + 41, 26, 7))):
        flame_tongue(t, x, y + by + lo * (k < 2), 3.2, hgt + (2 if (k + f) % 2 else 0), 5, f * 1.4 + k, NEB)
    stamp(c, t, NEB[0])

    # ---- corps
    t = new()
    bm = mask_of(lambda q: q.ellipse(X + 26, 29 + by + lo * 0.5, 11, 9.5, '#000'))
    bm |= mask_of(lambda q: q.ellipse(X + 41, 30 + by, 10, 8, '#000'))
    bm |= mask_of(lambda q: q.poly([(X + 26, 21 + by), (X + 42, 23 + by), (X + 42, 38 + by), (X + 26, 38 + by)], '#000'))
    cosmos(t, bm, HIDEV, NEB, seed=7, density=13, contrast=0.4)
    # ventre creusé (côtes)
    for k in range(3):
        x = X + 30 + k * 3
        t.line(x, 34 + by, x + 1, 37 + by, HIDEV[0])
    black_hole(t, X + 40, 29 + by, 4.6, f)
    stamp(c, t)

    # ---- pattes proches
    for (hip, knee, paw) in legs_near:
        t = new()
        ball(t, hip[0], hip[1] + by - 1, 4.2, 4.0, HIDEV)
        tube(t, [(hip[0], hip[1] + by), knee, paw], [3.8, 3.0, 2.6], HIDEV)
        spoly(t, [(paw[0] - 4, G - 2), (paw[0] + 2, G - 2), (paw[0] + 2, G), (paw[0] - 5, G)], HIDEV)
        for x in (paw[0] - 5, paw[0] - 3, paw[0] - 1):
            t.set(x, G, CRYS[3])
        t.set(knee[0] - 1, knee[1], CYAN[2])
        stamp(c, t)

    # ---- tête : crâne de loup cosmique, cornes de cristal
    hx, hy = (X + 13, 20 + by) if not atk else (X + 10, 23 + by)
    t = new()
    horn(t, [(hx + 5, hy - 6), (hx + 8, hy - 11), (hx + 13, hy - 14), (hx + 18, hy - 14)], [2.0, 1.6, 1.0, 0.3],
         [CRYS[0], CRYS[0], CRYS[1], CRYS[2], CRYS[3]])                                   # corne lointaine
    stamp(c, t)
    t = new()
    HV = HIDEV[1:] + [shift_l(HIDEV[4], 0.12)]
    ball(t, hx + 2, hy, 9.5, 8.5, HV)
    if atk:
        # mâchoire supérieure relevée, gueule béante
        spoly(t, [(hx - 12, hy - 3), (hx - 8, hy - 6), (hx + 2, hy - 6), (hx + 3, hy + 1), (hx - 12, hy)], HV, contrast=0.4)
    else:
        spoly(t, [(hx - 11, hy), (hx - 8, hy - 4), (hx + 2, hy - 5), (hx + 4, hy + 4), (hx - 11, hy + 3)], HV, contrast=0.4)
    stamp(c, t)
    # mâchoire inférieure
    t = new()
    if atk:
        jaw = [(hx - 10, hy + 9), (hx - 2, hy + 4), (hx + 5, hy + 3), (hx + 6, hy + 7), (hx - 2, hy + 10), (hx - 9, hy + 11)]
    else:
        jaw = [(hx - 10, hy + 4), (hx + 4, hy + 3), (hx + 5, hy + 6), (hx - 2, hy + 8), (hx - 8, hy + 7)]
    spoly(t, jaw, HV, contrast=0.35, bias=-0.1)
    stamp(c, t)
    if atk:
        # gueule-néant : champ d'étoiles aspiré
        mm = mask_of(lambda q: q.poly([(hx - 11, hy + 1), (hx + 2, hy + 1), (hx + 4, hy + 4), (hx - 1, hy + 4),
                                       (hx - 9, hy + 8)], '#000'))
        for (x, y) in mm:
            c.set(x, y, MAWC if (x + y) % 5 else HIDEV[2])
        c.set(hx - 3, hy + 3, STAR); c.set(hx - 6, hy + 4, CYAN[3]); c.set(hx, hy + 2, NEB[3])
        for x in (hx - 11, hx - 8, hx - 5, hx - 2):
            c.set(x, hy + 1, CRYS[4]); c.set(x, hy + 2, CRYS[3])
        for x in (hx - 9, hx - 6, hx - 3):
            c.set(x, hy + 8 - (x - hx + 9) * 0.3, CRYS[4])
    else:
        c.line(hx - 11, hy + 3, hx + 3, hy + 3, MAWC)
        for x in (hx - 10, hx - 6, hx - 2):
            c.set(x, hy + 4, CRYS[4]); c.set(x, hy + 5, CRYS[3])
        c.set(hx - 8, hy + 2, CRYS[4])
        c.set(hx - 1, hy + 3, CYAN[2]); c.set(hx + 1, hy + 3, NEB[3])
    c.set(hx - 11, hy - 1 - (3 if atk else 0), OUT)                                  # truffe
    c.set(hx - 10, hy - 1 - (3 if atk else 0), OUT)
    # yeux : deux fentes lumineuses + troisième œil frontal
    ey = hy - 4 - (1 if atk else 0)
    c.rect(hx - 6, ey - 1, 6, 4, MAWC)
    c.rect(hx - 5, ey, 4, 2, CYAN[3]); c.set(hx - 5, ey, WHITE); c.set(hx - 4, ey, WHITE); c.set(hx - 2, ey + 1, CYAN[2])
    c.line(hx - 7, ey - 2, hx - 1, ey - 1, OUT)
    c.rect(hx + 1, ey - 1, 4, 3, MAWC)
    c.rect(hx + 2, ey - 1 + 1, 2, 2, CYAN[3]); c.set(hx + 2, ey, WHITE)
    c.line(hx, ey - 1, hx + 4, ey - 2, OUT)
    c.set(hx - 1, ey - 5, NEB[3]); c.set(hx - 1, ey - 4, NEB[4]); c.set(hx, ey - 5, NEB[2]); c.set(hx - 2, ey - 5, NEB[2])
    # corne proche
    t = new()
    horn(t, [(hx + 2, hy - 7), (hx + 4, hy - 12), (hx + 9, hy - 16), (hx + 15, hy - 17)], [2.4, 1.9, 1.2, 0.3], CRYS)
    stamp(c, t)
    # oreille pointue
    t = new()
    spoly(t, [(hx + 6, hy - 4), (hx + 12, hy - 9), (hx + 11, hy - 1)], HV, contrast=0.5, bias=0.1)
    t.set(hx + 10, hy - 5, NEB[2]); t.set(hx + 9, hy - 4, NEB[1])
    stamp(c, t)

    # ---- attaque : étoiles aspirées vers la gueule
    if atk:
        fx = new()
        mx, my = hx - 11, hy + 4
        for k, (sx, sy) in enumerate(((X - 3, 14), (X - 2, 30), (X + 1, 40), (X - 3, 22), (X + 5, 9))):
            fx.line(sx, sy, mx - 1 - (mx - sx) * 0.25, my + (sy - my) * 0.25, CYAN[1] if k % 2 else NEB[2])
            fx.set(sx, sy, STAR)
            fx.set(sx + 1, sy, CYAN[3])
        clear_over(fx, c)
        stamp(c, fx, None)
    glow_ring(c, NEB[0], NEB[1], every=2)
    pts = ((X + 2, 4), (X + 34, 6), (X + 50, 40), (X + 30, 46)) if f != 1 else ((X + 3, 2), (X + 35, 4), (X + 51, 38), (X + 31, 44))
    for k, (x, y) in enumerate(pts):
        if c.get(x, y) is None:
            sparkle(c, x, y, NEB[2] if k % 2 else CYAN[2], STAR)
    return c, (W, H)


# ================================================================ 7. CHEVALIER DU NÉANT (monde 10, étape 15)

VKW, VKH = 58, 62
VARM = ['#08081a', '#141634', '#22264e', '#363c74', '#5660a4']          # armure étoilée
VARMF = ['#050512', '#0c0d24', '#161838', '#22264e', '#363c74']
SILV = ['#3a3a66', '#7a7ab0', '#c4c4ec', '#f0f0ff']


def star_specks(c, mask, seed, density=11):
    for (x, y) in mask:
        if h32(x, y, seed) % density == 0 and c.get(x, y) in (VARM[1], VARM[2], VARM[3]):
            c.set(x, y, STAR if h32(y, x, seed) % 3 else CYAN[3])


def void_knight(f):
    W, H = VKW, VKH
    G = H - 2
    new = lambda: Layer(W, H)
    c = new()
    atk = f == 2
    by = 1 if f == 1 else 0
    X = 3

    # ---- cape de galaxie
    t = new()
    sw = [0, 2, 3][f]
    cm = mask_of(lambda m: m.poly([(X + 22, 19 + by), (X + 39, 18 + by), (X + 46, 28), (X + 50 + sw * 0.5, 42),
                                   (X + 53 + sw, 56), (X + 49 + sw, 54), (X + 46 + sw, 59), (X + 42, 55), (X + 38, 59),
                                   (X + 34, 54), (X + 31, 50)], '#000'))
    cosmos(t, cm, VOID, NEB, seed=11, density=8, contrast=0.4)
    stamp(c, t)
    t = new()
    for (x, y) in cm:                                            # doublure cyan sur le bord
        if (x + 1, y) not in cm and y > 30:
            t.set(x, y, CYAN[1])
    stamp(c, t, None)

    # ---- bras lointain
    t = new()
    arm = [(X + 36, 25), (X + 41, 32), (X + 42, 38)] if atk else [(X + 36, 25 + by), (X + 40, 33 + by), (X + 38, 40 + by)]
    tube(t, arm, [3.8, 3.2, 3.0], VARMF)
    ball(t, arm[-1][0], arm[-1][1], 2.8, 2.6, VARMF)
    stamp(c, t)

    # ---- jambes
    if f == 1:
        lg = [((X + 32, 41), (X + 35, 49), (X + 36, G - 3)), ((X + 25, 41), (X + 21, 49), (X + 19, G - 3))]
    elif atk:
        lg = [((X + 32, 41), (X + 38, 48), (X + 41, G - 3)), ((X + 25, 41), (X + 19, 47), (X + 14, G - 3))]
    else:
        lg = [((X + 32, 41), (X + 33, 49), (X + 34, G - 3)), ((X + 25, 41), (X + 24, 49), (X + 23, G - 3))]
    for i, (hip, knee, ank) in enumerate(lg):
        R = VARMF if i == 0 else VARM
        t = new()
        m = tube(t, [hip, knee, ank], [4.0, 3.4, 3.0], R)
        star_specks(t, m, 20 + i)
        t.line(hip[0] - 1, hip[1] + 2, knee[0] - 1, knee[1] - 1, CYAN[1] if i == 0 else CYAN[2])
        stamp(c, t)
        t = new()
        ax_ = ank[0]
        spoly(t, [(ax_ - 6, G - 2), (ax_ - 2, G - 4), (ax_ + 3, G - 4), (ax_ + 3, G), (ax_ - 7, G)], R)
        t.line(ax_ - 6, G - 1, ax_ + 2, G - 1, SILV[1] if i else SILV[0])
        stamp(c, t)
        t = new()
        ball(t, knee[0] + 1, knee[1], 2.8, 2.6, R)
        t.set(knee[0], knee[1] - 1, CYAN[3] if i else CYAN[2])
        stamp(c, t)

    # ---- torse : plastron étoilé, cœur d'étoile
    t = new()
    tm = mask_of(lambda m: m.poly([(X + 17, 21 + by), (X + 38, 21 + by), (X + 36, 31 + by), (X + 33, 41 + by),
                                   (X + 22, 41 + by), (X + 19, 31 + by)], '#000'))
    shade(t, tm, VARM, contrast=0.5)
    star_specks(t, tm, 5)
    t.line(X + 20, 31 + by, X + 27, 35 + by, SILV[1]); t.line(X + 35, 31 + by, X + 28, 35 + by, SILV[0])
    for x in range(X + 21, X + 35):
        t.setf(x, 38 + by, SILV[0]); t.setf(x, 39 + by, VARM[3] if x % 3 else CYAN[2])
    t.poly([(X + 27, 26 + by), (X + 30, 29 + by), (X + 27, 33 + by), (X + 24, 29 + by)], CYAN[1])
    t.poly([(X + 27, 27 + by), (X + 29, 29 + by), (X + 27, 31 + by), (X + 25, 29 + by)], CYAN[3])
    t.set(X + 26, 28 + by, WHITE)
    stamp(c, t)
    t = new()                                                   # tassette
    for k, x in enumerate((X + 20, X + 25, X + 30)):
        spoly(t, [(x, 40 + by), (x + 6, 40 + by), (x + 5, 46 + by), (x + 3, 47 + by), (x + 1, 46 + by)], VARM,
              contrast=0.5, bias=0.05 - k * 0.04)
        t.line(x + 1, 45 + by, x + 3, 46 + by, CYAN[2])
    stamp(c, t)

    # ---- heaume : visière en T lumineuse, crête de cristaux
    hx, hy = (X + 23, 14 + by) if not atk else (X + 21, 15)
    t = new()
    for k, (dx, hgt, lean) in enumerate(((5, 9, 4), (1, 12, 2), (-3, 8, 0))):
        spoly(t, [(hx + dx - 2, hy - 6), (hx + dx + lean, hy - 6 - hgt), (hx + dx + 2.2, hy - 6)], CRYS, contrast=0.6,
              bias=0.05 * k)
    stamp(c, t)
    t = new()
    hm = mask_of(lambda m: m.poly([(hx - 7, hy - 4), (hx - 4, hy - 8), (hx + 4, hy - 8), (hx + 8, hy - 4), (hx + 8, hy + 6),
                                   (hx + 4, hy + 8), (hx - 6, hy + 8), (hx - 8, hy + 4)], '#000'))
    shade(t, hm, VARM, contrast=0.5, bias=0.12)
    star_specks(t, hm, 8, density=13)
    t.line(hx - 5, hy - 7, hx + 3, hy - 7, VARM[4])
    stamp(c, t)
    # visière
    vy = hy - 1
    glow = CYAN[3] if not atk else CYAN[4]
    c.rect(hx - 8, vy, 12, 2, MAWC)
    c.line(hx - 7, vy, hx + 2, vy, glow); c.line(hx - 6, vy + 1, hx + 1, vy + 1, CYAN[2])
    c.rect(hx - 3, vy + 2, 2, 4, MAWC); c.line(hx - 3, vy + 2, hx - 3, vy + 4, CYAN[1])
    c.set(hx - 7, vy, WHITE); c.set(hx - 6, vy, WHITE)
    for k in range(3):                                          # trous d'aération
        c.set(hx + 2 + k * 2, hy + 4, MAWC)

    # ---- épaulières à cristaux
    t = new()
    ball(t, X + 36, 21 + by, 5, 4.2, VARM)
    stamp(c, t)
    t = new()
    for k in range(3):
        spoly(t, [(X + 33 + k * 3, 20 + by), (X + 35 + k * 4, 13 + by - k), (X + 36 + k * 3, 20 + by)], CRYS, contrast=0.6)
    stamp(c, t)

    # ---- épée de cristal + bras proche
    if atk:
        arm = [(X + 20, 26), (X + 14, 30), (X + 9, 34)]
        blade = ((X + 9, 34), (X - 2, 53))
    else:
        arm = [(X + 20, 26 + by), (X + 15, 32 + by), (X + 12, 36 + by)]
        blade = ((X + 12, 36 + by), (X + 6, 3 + by))
    (h0x, h0y), (b1x, b1y) = blade
    dx, dy = b1x - h0x, b1y - h0y
    n = math.hypot(dx, dy)
    ux, uy = dx / n, dy / n
    nx, ny = -uy, ux
    p = lambda u, v: (h0x + ux * u + nx * v, h0y + uy * u + ny * v)
    t = new()
    bm = mask_of(lambda m: m.poly([p(3, -2.6), p(n - 7, -3.2), p(n, 0), p(n - 7, 3.2), p(3, 2.6)], '#000'))
    for (x, y) in bm:
        u = (x + 0.5 - h0x) * ux + (y + 0.5 - h0y) * uy
        v = (x + 0.5 - h0x) * nx + (y + 0.5 - h0y) * ny
        if v < -1.2:
            col = CRYS[3]
        elif v < 0.2:
            col = CRYS[2]
        elif v < 1.6:
            col = CRYS[1]
        else:
            col = CRYS[0]
        if abs(v) < 0.6 and u > 5 and int(u) % 6 == 0:
            col = CRYS[4]
        t.set(x, y, col)
    # garde en croissant + pommeau étoile
    t.line(*p(3, -6), *p(3, 6), SILV[1], width=2)
    t.set(*p(2, -7), CRYS[3]); t.set(*p(2, 7), CRYS[3])
    tube(t, [p(-4, 0), p(2, 0)], [1.2, 1.2], VARM)
    stamp(c, t)
    star4(c, *[round(v) for v in p(-5, 0)], [CYAN[1], CYAN[2], CYAN[3]], 2)
    t = new()
    tube(t, arm, [3.8, 3.2, 3.0], VARM)
    ball(t, arm[0][0] + 1, arm[0][1], 4.4, 3.6, VARM)
    ball(t, arm[-1][0], arm[-1][1], 2.6, 2.6, VARM)
    stamp(c, t)
    c.line(arm[1][0] - 2, arm[1][1], arm[1][0] + 1, arm[1][1] + 2, CYAN[2])

    # ---- effets
    if atk:
        fx = new()
        arc_fx(fx, X + 24, 30, 26, 1.0, 262, 125, 10, CYAN, lead=0.65)
        clear_over(fx, c)
        stamp(c, fx, None)
        for k, (x, y) in enumerate(((X + 2, 57), (X + 7, 58), (X - 1, 52))):
            t = new()
            spoly(t, [(x - 1.5, y + 1), (x + k * 0.5, y - 4 - k), (x + 1.5, y + 1)], CRYS, contrast=0.6)
            stamp(c, t)
    glow_ring(c, NEB[0], NEB[1], every=2)
    pts = ((X + 2, 8, 0), (X + 50, 12, 1), (X + 52, 34, 0), (X + 10, 1, 1), (X + 46, 2, 0)) if f != 1 else \
          ((X + 3, 6, 1), (X + 51, 9, 0), (X + 53, 31, 1), (X + 11, 3, 0), (X + 47, 4, 1))
    for x, y, k in pts:
        if c.get(x, y) is None:
            if k:
                c.set(x, y, STAR)
            else:
                sparkle(c, x, y, CYAN[2], STAR)
    return c, (W, H)


# ================================================================ 8. EMPEREUR DU NÉANT (monde 10, méga boss)

VEW, VEH = 72, 72
ROBE = ['#100820', '#1e1038', '#321c58', '#4a2e7e', '#6a48a6']
LINING = ['#3a0c5a', '#6a1e96', '#a03ad0', '#d07af4', '#f4ccff']
FACE = ['#020108', '#06041a', '#0e0a2c']


def galaxy_spiral(c, x, y, r, phase=0.0, only_inside=True):
    """Galaxie spirale : deux bras lumineux, bulbe blanc."""
    for arm in (0, 180):
        for k in range(0, 300, 6):
            a = math.radians(k + arm + phase)
            rr = r * k / 300
            col = WHITE if k < 30 else CYAN[3] if k < 110 else CYAN[2] if k < 200 else NEB[3]
            (c.setf if only_inside else c.set)(x + math.cos(a) * rr, y + math.sin(a) * rr * 0.7, col)
    (c.setf if only_inside else c.set)(x, y, WHITE)


def void_emperor(f):
    W, H = VEW, VEH
    G = H - 2
    new = lambda: Layer(W, H)
    c = new()
    atk = f == 2
    fy = -2 if f == 1 else 0                         # respiration : le buste se soulève
    cx = 36

    # ---- halo-orbite d'étoiles derrière la tête
    t = new()
    for k in range(0, 360, 4):
        a = math.radians(k)
        x, y = cx + 2 + math.cos(a) * 15, 18 + fy + math.sin(a) * 13
        t.set(x, y, NEB[1] if (k // 4) % 3 else NEB[2])
    stamp(c, t, None)
    for k in range(8):
        a = math.radians(k * 45 + f * 15)
        x, y = cx + 2 + math.cos(a) * 15, 18 + fy + math.sin(a) * 13
        sparkle(c, round(x), round(y), CYAN[2], STAR)

    # ---- grande cape de galaxie (évasée jusqu'au sol)
    t = new()
    sw = [0, 3, 4][f]
    cape = [(cx - 10, 22 + fy), (cx + 12, 22 + fy), (cx + 22, 36), (cx + 29 + sw, 52), (cx + 33 + sw, G),
            (cx + 26 + sw, G - 3), (cx + 20, G), (cx + 12, G - 2), (cx - 12, G - 2), (cx - 20, G), (cx - 26 - sw * 0.5, G - 3),
            (cx - 31 - sw * 0.5, G), (cx - 27 - sw * 0.5, 50), (cx - 20, 34)]
    cm = mask_of(lambda m: m.poly(cape, '#000'))
    cosmos(t, cm, VOID, NEB, seed=21, density=7, contrast=0.35)
    galaxy_spiral(t, cx + 20, 50, 7, phase=f * 25)
    # doublure violette sur les bords retournés
    for (x, y) in cm:
        if y > 40 and ((x - 1, y) not in cm or (x + 1, y) not in cm):
            t.set(x, y, LINING[2])
            if (x - 2, y) not in cm or (x + 2, y) not in cm:
                pass
            elif (x - 1, y) not in cm:
                t.set(x + 1, y, LINING[1])
    for (x, y) in cm:
        if (x, y + 1) not in cm:
            t.set(x, y, LINING[3] if x % 2 else LINING[2])
    stamp(c, t)

    # ---- bras lointain : galaxie flottant au-dessus de la paume
    if atk:
        far = [(cx + 9, 28), (cx + 15, 30), (cx + 18, 25)]
    else:
        far = [(cx + 9, 28 + fy), (cx + 16, 33 + fy), (cx + 20, 30 + fy)]
    t = new()
    tube(t, far, [3.6, 3.0, 2.8], [ROBE[0], ROBE[0], ROBE[1], ROBE[2], ROBE[3]])
    t.line(far[1][0] + 1, far[1][1] - 2, far[1][0] - 1, far[1][1] + 2, GOLD[2], width=2)
    ball(t, far[-1][0], far[-1][1], 2.4, 2.2, [FACE[1], FACE[2], ROBE[2], ROBE[3], ROBE[3]])
    stamp(c, t)
    gx, gy = far[-1][0] + 1, far[-1][1] - 7 - f
    t = new()
    t.ellipse(gx, gy, 5.5, 4.2, NEB[0])
    t.ellipse(gx, gy, 4.2, 3.0, NEB[1])
    galaxy_spiral(t, gx, gy, 5, phase=f * 40 + 20)
    stamp(c, t, None)

    # ---- robe
    t = new()
    rm = mask_of(lambda m: m.poly([(cx - 9, 26 + fy), (cx + 9, 26 + fy), (cx + 13, 46), (cx + 16, G), (cx - 16, G),
                                   (cx - 13, 46)], '#000'))
    shade(t, rm, ROBE, contrast=0.45)
    for (x, y) in rm:                                           # plis verticaux
        if y > 44 and (x - cx) % 6 == 3:
            t.set(x, y, ROBE[1])
        if y > 44 and (x - cx) % 6 == 2 and t.get(x, y) in (ROBE[2], ROBE[3]):
            t.set(x, y, ROBE[4] if x < cx else ROBE[3])
    # pan central brodé : nébuleuse bordée d'or, gemmes-étoiles
    for y in range(29 + fy, G + 1):
        hw = 1.6 + (y - 29) * 0.09
        x0, x1 = int(round(cx - 1 - hw)), int(round(cx - 1 + hw))
        for x in range(x0, x1 + 1):
            t.setf(x, y, LINING[1] if (x + y) % 4 else LINING[2])
        t.setf(x0 - 1, y, GOLD[3]); t.setf(x1 + 1, y, GOLD[1])
    for k, y in enumerate((35, 47, 57, 65)):
        yy = y + (fy if k == 0 else 0)
        t.setf(cx - 1, yy, CYAN[3]); t.setf(cx - 2, yy, CYAN[2]); t.setf(cx, yy, CYAN[2]); t.setf(cx - 1, yy - 1, WHITE)
        t.setf(cx - 1, yy + 1, CYAN[1])
    # bas de robe brodé
    for x in range(cx - 16, cx + 17):
        t.setf(x, G, GOLD[1]); t.setf(x, G - 1, GOLD[2] if x % 3 else GOLD[3])
    stamp(c, t)
    # ceinture
    t = new()
    spoly(t, [(cx - 11, 40 + fy), (cx + 11, 40 + fy), (cx + 11, 42 + fy), (cx - 11, 42 + fy)], ROBE, contrast=0.5, bias=-0.1)
    t.line(cx - 11, 40 + fy, cx + 11, 40 + fy, GOLD[2])
    stamp(c, t)
    star4(c, cx - 1, 41 + fy, [CYAN[1], CYAN[2], CYAN[3]], 1)

    # ---- haut col d'or et épaulières
    t = new()
    col_ = [(cx - 12, 25 + fy), (cx - 14, 15 + fy), (cx - 9, 19 + fy), (cx, 23 + fy), (cx + 9, 19 + fy), (cx + 14, 14 + fy),
            (cx + 13, 26 + fy)]
    spoly(t, col_, ROBE, contrast=0.45, bias=0.05)
    for i in range(len(col_) - 2):
        (x0, y0), (x1, y1) = col_[i], col_[i + 1]
        t.line(x0, y0, x1, y1, GOLD[3] if i < 3 else GOLD[2])
    stamp(c, t)
    for sx in (cx + 10, cx - 10):
        t = new()
        ball(t, sx, 27 + fy, 5, 3.6, ROBE)
        for a in range(200, 340, 8):
            r = math.radians(a)
            t.setf(sx + math.cos(r) * 4.4, 27 + fy + math.sin(r) * 3.0, GOLD[3] if a < 270 else GOLD[2])
        t.set(sx - 1, 26 + fy, CYAN[3]); t.set(sx, 26 + fy, CYAN[2])
        stamp(c, t)

    # ---- tête : visage de néant, yeux brillants
    hx, hy = (cx - 1, 18 + fy) if not atk else (cx - 3, 19)
    t = new()
    fm = mask_of(lambda m: m.ellipse(hx, hy, 6.5, 7.2, '#000'))
    for (x, y) in fm:
        d = math.hypot((x + 0.5 - hx + 2) / 6.5, (y + 0.5 - hy + 2) / 7.2)
        t.set(x, y, FACE[2] if d < 0.5 else FACE[1] if d < 0.95 else FACE[0])
        if h32(x, y, 31) % 9 == 0 and d < 0.9:
            t.set(x, y, NEB[2] if h32(x, y, 2) % 2 else CYAN[1])
    stamp(c, t)
    # yeux
    ey = hy
    eg = CYAN[4] if atk else CYAN[3]
    for ex in (hx - 5, hx + 0):
        c.rect(ex, ey, 4 if ex < hx else 3, 2, eg); c.set(ex, ey, WHITE); c.set(ex + 1, ey, WHITE)
        c.set(ex + (3 if ex < hx else 2), ey + 1, CYAN[2])
        c.set(ex + 1, ey + 2, CYAN[1])
    c.line(hx - 6, ey - 1, hx - 3, ey - 1 + 0, CYAN[1]); c.line(hx + 1, ey - 1, hx + 3, ey - 2, CYAN[1])
    if atk:                                                     # traînées lumineuses
        c.line(hx - 6, ey + 1, hx - 9, ey + 1, CYAN[2]); c.line(hx + 3, ey - 1, hx + 6, ey - 3, CYAN[2])
    # couronne d'étoiles
    t = new()
    t.line(hx - 6, hy - 6, hx + 6, hy - 7, GOLD[2], width=2.2)
    pts_ = ((hx - 5, hy - 10, 4), (hx, hy - 12, 7), (hx + 5, hy - 10, 4))
    for (x, y, hgt) in pts_:
        spoly(t, [(x - 1.2, hy - 6), (x, y), (x + 1.2, hy - 6)], GOLD, contrast=0.6)
    stamp(c, t)
    c.line(hx - 6, hy - 7, hx + 5, hy - 8, GOLD[4])
    c.set(hx - 1, hy - 6, CYAN[3]); c.set(hx, hy - 6, CYAN[2])
    for k, (x, y, hgt) in enumerate(pts_):
        if k == 1:
            star4(c, round(x), round(y) - 2, [CYAN[1], CYAN[2], CYAN[3]], 2)
        else:
            star4(c, round(x), round(y) - 2, [GOLD[2], GOLD[3], GOLD[4]], 1 if f != 1 else 2)

    # ---- sceptre + bras proche
    if atk:
        s0, s1 = (cx - 6, 38), (cx - 24, 25)              # pommeau -> tête
        hand = (s0[0] + (s1[0] - s0[0]) * 0.35, s0[1] + (s1[1] - s0[1]) * 0.35)
    else:
        hand = (cx - 18, 38 + fy)
        s0, s1 = (cx - 17, G - 1), (cx - 20, 14 + fy)
    dx, dy = s1[0] - s0[0], s1[1] - s0[1]
    n = math.hypot(dx, dy)
    ux, uy = dx / n, dy / n
    nx, ny = -uy, ux
    t = new()
    t.line(s0[0], s0[1], s1[0], s1[1], GOLD[1], width=2)
    t.line(s0[0] - 0.5, s0[1], s1[0] - 0.5, s1[1], GOLD[3])
    for k in (0.3, 0.6):                                       # bagues
        bx, by_ = s0[0] + dx * k, s0[1] + dy * k
        t.line(bx + nx * 1.6, by_ + ny * 1.6, bx - nx * 1.6, by_ - ny * 1.6, GOLD[4])
    # croissant de lune
    mxc, myc = s1[0] + ux * 3, s1[1] + uy * 3
    for a in range(0, 360, 5):
        r = math.radians(a)
        ox_, oy_ = math.cos(r), math.sin(r)
        if ox_ * ux + oy_ * uy > 0.15:
            continue
        for rr in (4.2, 5.0):
            t.set(mxc + ox_ * rr, myc + oy_ * rr, GOLD[2] if rr < 4.6 else GOLD[3])
    stamp(c, t)
    # orbe-étoile
    t = new()
    ox_, oy_ = s1[0] + ux * 4.5, s1[1] + uy * 4.5
    ball(t, ox_, oy_, 3.2, 3.2, [CYAN[0], CYAN[1], CYAN[2], CYAN[3], CYAN[4]])
    stamp(c, t)
    star4(c, round(ox_), round(oy_), [CYAN[1], CYAN[2], CYAN[3]], 4 if not atk else 2)
    t = new()
    sh = (cx - 9, 28 + fy) if not atk else (cx - 10, 27)
    tube(t, [sh, ((sh[0] + hand[0]) / 2, (sh[1] + hand[1]) / 2 + 3), hand], [3.8, 3.2, 3.0], ROBE)
    t.line((sh[0] + hand[0]) / 2 - 2, (sh[1] + hand[1]) / 2 + 1, (sh[0] + hand[0]) / 2 + 1, (sh[1] + hand[1]) / 2 + 5,
           GOLD[2], width=2)
    ball(t, hand[0], hand[1], 2.6, 2.4, [FACE[1], FACE[2], ROBE[2], ROBE[3], ROBE[3]])
    stamp(c, t)

    # ---- attaque : déferlante cosmique depuis l'orbe
    if atk:
        fx = new()
        for k in range(0, 360, 10):                             # onde de choc
            r = math.radians(k)
            fx.set(ox_ + math.cos(r) * 11, oy_ + math.sin(r) * 12, CYAN[2] if k % 20 else NEB[3])
        for k, (ex_, ey_) in enumerate(((0, 12), (0, 22), (0, 33), (1, 42), (4, 4))):
            fx.line(ox_, oy_, ex_, ey_, CYAN[2] if k % 2 else NEB[3], width=2)
            fx.line(ox_, oy_, ex_, ey_, CYAN[4] if k % 2 else NEB[4])
        burst(fx, ox_, oy_, 7, [CYAN[0], CYAN[1], CYAN[2], CYAN[3], CYAN[4]], spikes=8, phase=0.2)
        clear_over(fx, c)
        stamp(c, fx, CYAN[0])
        star4(c, round(ox_), round(oy_), [CYAN[2], CYAN[3], CYAN[4]], 3)
    glow_ring(c, NEB[0], NEB[1], every=1)
    pts = ((6, 40), (66, 10), (68, 30), (4, 60), (60, 2), (10, 4)) if f != 1 else ((7, 37), (65, 12), (69, 27), (5, 57), (61, 4), (12, 2))
    for k, (x, y) in enumerate(pts):
        if c.get(x, y) is None:
            if k % 2:
                c.set(x, y, STAR)
            else:
                sparkle(c, x, y, CYAN[2] if k % 4 else NEB[3], STAR)
    return c, (W, H)


# ================================================================ export

def frames(fn):
    out = []
    for f in (0, 1, 2):
        c, (w, h) = fn(f)
        out.append((reduce_colors(finalize(c, w, h), MAX_COLORS), clipped(c, w, h)))
    return out


BOSSES = {
    'mini_salamander_chief': salamander,
    'mid_lava_golem': lava_golem,
    'hard_flame_djinn': djinn,
    'boss_phoenix': phoenix,
    'mini_void_watcher': void_watcher,
    'mid_star_devourer': star_devourer,
    'hard_void_knight': void_knight,
    'boss_void_emperor': void_emperor,
}


def build():
    out = {}
    for name, fn in BOSSES.items():
        a, b, k = [cv for cv, _ in frames(fn)]
        out[name] = (a, {})
        out[name + '_b'] = (b, {})
        out[name + '_atk'] = (k, {})
    return out
