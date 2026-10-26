"""Méga boss — animations refaites (v3) : chevalier déchu (monde 5), roi démoniaque (monde 6),
béhémoth des marais (monde 7).

Mêmes identités que bosses_mega.py / bosses_w78.py, mais :
  <nom>_b   : vrai pas de marche (pied avant qui avance, pied arrière qui se lève), buste qui descend
              de 2 px, cape / flammes / racines / boue qui ondulent, arme qui se balance ;
  <nom>_atk : pose d'attaque spectaculaire (coup d'épée givré + pics de glace, faux en arc + braises
              infernales, coup de poing de boue qui écrase + éclaboussures).
Les trois images d'un boss partagent le même canvas (frames_boxed : agrandi symétriquement en largeur
et vers le haut, pieds sur la dernière ligne). Tournés vers la GAUCHE, contour '#1a1226', sans aléa.
build.py charge ce module après fixes2 (juste avant fixes) : il remplace les anciens sprites.
"""
import math

from bosses_mega import (Layer, stamp, mask_of, shade, spoly, ball, tube, horn, flame_tongue, shifted,
                         glow_ring, frost, icicles, snow, greatsword, gauntlet, _spike, scythe, flame_cluster,
                         dk_, OUT, WHITE, GOLD,
                         KW, KH, KG, AR, ARF, PLUME, CAPE, CAPE_IN, RUNE, REYE, TGOLD, TRAIL,
                         XW, XH, XG, DSKIN, DARM, DCAPE, DHORN, HELL, DEYE, BONE)
from knight import spine_fill
from bosses_hard import arc_fx, sparkle, dots, ice_shard, frames_boxed, ICE
from bosses_w78 import (branch, drip, put_behind, mushroom, FUME, TOXIC, MUD, MUDF, BMOSS, ROOT, CAPR, CAPV, BEYE, FANG,
                        SWAMP, BHW, BHH)


# ================================================================ CHEVALIER DÉCHU (monde 5)

# poses : by buste, lean, pied avant (dx), pied arrière (dx, levée), cape, épée
KPOSE = (
    dict(by=0, ln=0, ff=0, bf=0, blift=0, sway=0, wave=0, hand=(11, 41), ang=-94),
    dict(by=2, ln=-1, ff=-4, bf=3, blift=3, sway=4, wave=1, hand=(9, 42), ang=-82),
    dict(by=2, ln=-5, ff=-7, bf=5, blift=0, sway=-3, wave=0, hand=(12, 45), ang=150),
)


def fallen_knight(f):
    W, H = KW, KH
    new = lambda: Layer(W, H)
    c = new()
    P = KPOSE[f]
    atk = f == 2
    by, ln = P['by'], P['ln']
    G = KG
    GB = G + 1

    # ---- pics de glace qui jaillissent du sol (attaque, derrière l'épée)
    if atk:
        for (bx, h_, lean, w_) in ((-8, 13, -3, 5.0), (-2, 17, -1, 5.6), (4, 11, 1, 4.6), (-13, 7, -3, 4.0),
                                   (9, 6, 2, 3.6)):
            ice_shard(c, (bx, G + 1), (bx + lean, G + 1 - h_), w_)

    # ---- cape en lambeaux (derrière) : ondule fortement
    t = new()
    sway = P['sway']
    hem = []
    for i, x in enumerate(range(31, 59, 3)):
        up = (i % 2) ^ P['wave']
        hem.append((x + sway * (i / 9), G - 3 + (3 if up else -2) - i * 0.9))
    cape_pts = [(28 + ln, 23 + by), (44 + ln, 22 + by), (51 + sway, 33 + by // 2), (57 + sway, 45)] + hem[::-1] + [(27, 50)]
    m = mask_of(lambda q: q.poly(cape_pts, '#000'))
    shade(t, m, CAPE, contrast=0.4)
    for k, x0 in enumerate((39, 45, 51)):
        t.line(x0 + ln, 28 + by, x0 + sway + 2 + (k - 1) * P['wave'], G - 9, CAPE[1])
    for (x, y) in m:
        if (x + 1, y) not in m and y > 30:
            t.set(x, y, CAPE_IN[1])
    for x, y in hem[1::2]:
        t.set(x, y - 1, CAPE_IN[2])
    stamp(c, t)

    # ---- bras arrière : se balance en marche (opposé à la jambe avant)
    t = new()
    swing = (0, 3, 2)[f]
    tube(t, [(43 + ln, 28 + by), (46 + ln + swing / 2, 33 + by), (46 + ln + swing, 38 + by - swing / 3)],
         [3.4, 3.2, 3.0], ARF)
    stamp(c, t)
    t = new()
    gauntlet(t, 46 + ln + swing, 40 + by - swing / 3, ARF)
    stamp(c, t)

    # ---- jambe arrière (se lève au pas)
    t = new()
    bf, bl = P['bf'], P['blift']
    tube(t, [(38 + ln / 2, 42 + by), (40 + bf / 2, 51 - bl / 2), (41 + bf, G - 4 - bl)], [3.8, 3.6, 3.4], ARF)
    ball(t, 40 + bf / 2, 50 - bl / 2, 3.6, 3.2, ARF)
    if bl:
        # talon levé : soleret incliné, pointe au sol
        spoly(t, [(36 + bf, G - 4 - bl), (45 + bf, G - 5 - bl), (46 + bf, GB - bl - 1), (36 + bf, GB)], ARF)
    else:
        spoly(t, [(36 + bf, G - 4), (45 + bf, G - 4), (46 + bf, GB), (34 + bf, GB)], ARF)
    stamp(c, t)

    # ---- traînée de l'attaque (grand arc givré du dessus de la tête jusqu'au sol devant)
    sh = (21 + ln, 30 + by)
    if atk:
        t = new()
        cx_, cy_ = sh[0] + 3, sh[1] + 1
        Rr = 30
        for y in range(-30, H + 4):
            for x in range(-30, W):
                ddx, ddy = x + 0.5 - cx_, y + 0.5 - cy_
                r = math.hypot(ddx, ddy)
                aa = math.degrees(math.atan2(ddy, ddx)) % 360
                if not 150 <= aa <= 300:
                    continue
                u = (300 - aa) / 150
                th = 1 + 11 * u ** 1.2
                if Rr - th <= r <= Rr + 0.5:
                    k = (Rr + 0.5 - r) / (th + 0.5)
                    if u < 0.35 and (x + y) % 2:
                        continue
                    t.set(x, y, TRAIL[3] if k < 0.28 else TRAIL[2] if k < 0.6 else TRAIL[1])
        stamp(c, t, TRAIL[0])

    hands, ang = P['hand'], P['ang']
    hands = (hands[0] + (ln if not atk else 0), hands[1] + (by if not atk else 0))

    # ---- jambe avant (pas en avant)
    t = new()
    ff = P['ff']
    tube(t, [(27 + ln / 2, 42 + by), (25 + ff * 0.6, 50 + by / 2), (24 + ff, G - 4)], [4.2, 4.0, 3.6], AR)
    ball(t, 25 + ff * 0.6, 49 + by / 2, 4, 3.6, AR)
    _spike(t, (23 + ff * 0.6, 49 + by / 2), (19 + ff * 0.6, 47 + by / 2), 3, AR)
    spoly(t, [(18 + ff, G - 4), (28 + ff, G - 4), (29 + ff, GB), (16 + ff, GB)], AR)
    t.line(19 + ff, G - 4, 27 + ff, G - 4, AR[3])
    stamp(c, t)

    # ---- tassettes
    t = new()
    spoly(t, [(23 + ln, 37 + by), (43 + ln, 37 + by), (46 + ln, 46 + by), (38 + ln, 44 + by),
              (33 + ln, 47 + by), (28 + ln, 44 + by), (21 + ln, 46 + by)], AR)
    for x in range(23, 44):
        t.setf(x + ln, 38 + by, TGOLD[3] if x < 33 else TGOLD[1])
    t.line(33 + ln, 39 + by, 33 + ln, 46 + by, AR[0])
    stamp(c, t)
    # tabard rouge en lambeaux (flotte vers l'arrière en marche)
    t = new()
    sw2 = (0, 2, 3)[f]
    tab = [(29 + ln, 39 + by), (37 + ln, 39 + by), (37 + ln + sw2, 50 + by), (35 + ln + sw2, 48 + by),
           (34 + ln + sw2, 53 + by - sw2 // 2), (32 + ln + sw2, 49 + by), (30 + ln + sw2, 51 + by)]
    spoly(t, tab, [CAPE_IN[0], CAPE_IN[0], CAPE_IN[1], CAPE_IN[2], PLUME[2]], contrast=0.4)
    t.line(30 + ln, 40 + by, 36 + ln, 40 + by, TGOLD[2])
    for (x, y) in ((33, 43), (33, 44), (32, 44), (34, 44), (33, 45)):
        t.set(x + ln, y + by, TGOLD[2])
    stamp(c, t)

    # ---- cuirasse + rune de glace (brille plus fort à l'attaque)
    t = new()
    ox = ln
    spoly(t, [(23 + ox, 23 + by), (43 + ox, 23 + by), (42 + ox, 32 + by), (39 + ox, 39 + by), (27 + ox, 39 + by),
              (24 + ox, 32 + by)], AR, contrast=0.42)
    ball(t, 31 + ox, 29 + by, 7, 6.5, AR, only_inside=True)
    for y in range(29, 39):
        t.setf(33 + ox, y + by, AR[1])
    rx_, ry_ = 33 + ox, 30 + by
    boost = 1 if f else 0
    for ddx, ddy, k in ((0, -3, 1), (0, -2, 2), (0, -1, 2), (0, 0, 2), (0, 1, 1), (-1, -1, 1), (1, -1, 1),
                        (-2, 0, 0), (2, 0, 0), (-1, 2, 0), (1, 2, 0)):
        t.set(rx_ + ddx, ry_ + ddy, RUNE[min(2, k + boost)])
    stamp(c, t)

    # ---- épaulière arrière
    t = new()
    ball(t, 42 + ln, 26 + by, 6, 5, ARF)
    _spike(t, (44 + ln, 22 + by), (49 + ln, 16 + by), 3.4, ARF)
    stamp(c, t)

    # ---- heaume (suit le buste, plonge à l'attaque) ; plumet qui fouette
    hx, hy = (ln - 1, by + 1) if atk else (ln, by)
    t = new()
    sw = (0, 4, 5)[f]
    plume_spine = [(35 + hx, 6 + hy), (41 + hx, 4 + hy - sw / 3), (48 + hx + sw / 3, 6 + hy - sw / 3),
                   (52 + hx + sw, 11 + hy), (55 + hx + sw * 1.4, 17 + hy - sw / 2)]

    def plume_shade(tt, ss, x, y):
        if ss < -0.5:
            return PLUME[4] if tt < 0.5 else PLUME[3]
        if ss > 0.45:
            return PLUME[0] if tt > 0.5 else PLUME[1]
        if abs(ss + 0.1 - 0.25 * math.sin(tt * 10 + f * 2)) < 0.18:
            return PLUME[3]
        return PLUME[2]
    spine_fill(t, plume_spine, [2.5, 4.0, 4.4, 3.4, 1.2], plume_shade)
    stamp(c, t)
    t = new()
    ball(t, 31 + hx, 13 + hy, 10, 9.5, AR)
    spoly(t, [(20 + hx, 9 + hy), (28 + hx, 8 + hy), (30 + hx, 21 + hy), (25 + hx, 24 + hy), (20 + hx, 20 + hy)], AR,
          contrast=0.3, bias=0.08)
    for k in range(9):
        a = math.radians(-150 + k * 15)
        t.setf(31 + hx + math.cos(a) * 9.5, 13 + hy + math.sin(a) * 9.1, TGOLD[3] if k < 4 else TGOLD[2])
    stamp(c, t)
    t = new()
    horn(t, [(26 + hx, 6 + hy), (23 + hx, 3 + hy), (22 + hx, 1 + hy)], [2.0, 1.4, 0.4], AR)
    stamp(c, t)
    vy = 13 + hy
    c.rect(20 + hx, vy, 11, 2, OUT)
    c.rect(24 + hx, vy + 2, 2, 5, OUT)
    for ex in (21, 27):
        c.set(ex + hx, vy, REYE[2]); c.set(ex + 1 + hx, vy, REYE[1])
        c.set(ex + hx, vy + 1, REYE[1]); c.set(ex + 1 + hx, vy + 1, REYE[0])
    if atk:                                           # regard furieux : yeux élargis
        for ex in (21, 27):
            c.set(ex + 2 + hx, vy, REYE[1]); c.set(ex + hx - 1, vy + 1, REYE[0])
    c.line(21 + hx, vy - 2, 28 + hx, vy - 2, AR[4])
    c.line(21 + hx, vy - 1, 29 + hx, vy - 1, AR[1])
    for k in range(2):
        c.set(22 + hx, vy + 4 + k * 2, OUT)
        c.set(27 + hx, vy + 4 + k * 2, OUT)
    trail = ((19 + hx, vy, REYE[1]), (18 + hx, vy - 1, REYE[0]))
    if f:
        trail += ((17 + hx, vy - 1 - f % 2, REYE[0]),)
    for (x, y, col) in trail:
        if c.get(x, y) is None:
            c.set(x, y, col)

    # ---- bras avant
    t = new()
    if atk:
        el = (sh[0] - 3, sh[1] + 9)
    else:
        el = (hands[0] + 4, (sh[1] + hands[1]) / 2 + 1)
    tube(t, [sh, el, (hands[0] + 1, hands[1])], [3.6, 3.3, 3.1], AR)
    stamp(c, t)
    # ---- épaulière avant
    t = new()
    ball(t, 21 + ln, 27 + by, 7.5, 5.6, AR)
    t.line(14 + ln, 30 + by, 28 + ln, 31 + by, TGOLD[2])
    t.line(14 + ln, 31 + by, 28 + ln, 32 + by, AR[1])
    _spike(t, (17 + ln, 22 + by), (11 + ln, 17 + by), 3.6, AR)
    _spike(t, (21 + ln, 21 + by), (18 + ln, 15 + by), 3.2, AR)
    stamp(c, t)

    t = new()
    tip = greatsword(t, hands, ang, blade=(24 if atk else 27))
    stamp(c, t)
    a_ = math.radians(ang)
    if not atk:
        # éclats runiques qui flottent autour de la lame (se déplacent d'une image à l'autre)
        for k, u in enumerate((9, 16, 23)):
            sgn = 1 if (k + f) % 2 else -1
            px = hands[0] + math.cos(a_) * (u + f * 2) + 4 * sgn * -math.sin(a_)
            py = hands[1] + math.sin(a_) * (u + f * 2) + 4 * sgn * math.cos(a_)
            if c.get(px, py) is None:
                c.set(px, py, RUNE[2] if (k + f) % 2 else RUNE[1])
    t = new()
    gauntlet(t, hands[0], hands[1], AR)
    stamp(c, t)

    # ---- givre + glaçons
    frost(c, AR, skip=set(PLUME) | set(RUNE) | set(TRAIL) | set(REYE) | set(TGOLD) | set(CAPE) | set(CAPE_IN)
          | set(ICE))
    icicles(c, ((16 + ln, 33 + by, 2), (19 + ln, 34 + by, 3 - (f == 1)), (24 + ln, 34 + by, 2 + (f == 1)),
                (42 + ln, 32 + by, 2)))

    if atk:
        # éclats de glace projetés depuis la pointe + étincelles
        tx, ty = tip
        for (dx, dy, ln_) in ((-5, -10, 6), (-7, -3, 6), (1, -13, 5), (6, -9, 4)):
            ice_shard(c, (tx + dx * 0.3, ty + dy * 0.3), (tx + dx, ty + dy), 2.6 if ln_ > 4 else 2.2)
        for (x, y) in ((tx - 5, ty - 18), (tx + 9, ty - 16), (tx - 6, ty - 26)):
            sparkle(c, x, y, ICE[2])
    glow_ring(c, '#22406e')
    pts = [((8, 12, True), (54, 30, False), (4, 30, False), (58, 22, True), (8, 52, False), (58, 56, True)),
           ((10, 15, False), (56, 26, True), (2, 34, True), (60, 18, False), (6, 47, True), (60, 51, False)),
           ((50, 40, False), (60, 24, True), (44, 1, True), (62, 48, False), (36, 56, True), (-4, 8, False))][f]
    snow(c, pts)
    return c, (W, H)


# ================================================================ ROI DÉMONIAQUE (monde 6)

XPOSE = (
    dict(by=0, ln=0, ff=0, bf=0, blift=0, sway=0, wave=0, hand=(18, 46), ang=-94),
    dict(by=2, ln=-1, ff=-4, bf=3, blift=3, sway=5, wave=1, hand=(16, 47), ang=-104),
    dict(by=2, ln=-4, ff=-6, bf=5, blift=0, sway=-3, wave=0, hand=(16, 44), ang=212),
)


def demon_king(f):
    W, H = XW, XH
    new = lambda: Layer(W, H)
    c = new()
    P = XPOSE[f]
    atk = f == 2
    by, ln = P['by'], P['ln']
    G, GB = XG, XG + 1

    # ---- cape déchirée (ondule)
    t = new()
    sway = P['sway']
    hem = []
    for i, x in enumerate(range(30, 67, 3)):
        up = (i % 2) ^ P['wave']
        hem.append((x + sway * i / 12, G - 1 + (2 if up else -3) - max(0, i - 8) * 2.2))
    cape_pts = [(31 + ln, 30 + by), (50 + ln, 29 + by), (58 + sway, 40 + by // 2), (66 + sway, 52)] + hem[::-1] + [(28, 54)]
    m = mask_of(lambda q: q.poly(cape_pts, '#000'))
    shade(t, m, DCAPE, contrast=0.42)
    for k, x0 in enumerate((42, 49, 56)):
        t.line(x0 + ln, 34 + by, x0 + sway + 3 + (k - 1) * P['wave'], G - 8, DCAPE[1])
    stamp(c, t)

    # ---- bras arrière : flamme infernale dans la paume (monte et grossit)
    t = new()
    swing = (0, 2, -1)[f]
    hand2 = (58 + ln + swing, 47 + by - abs(swing))
    tube(t, [(51 + ln, 35 + by), (56 + ln + swing / 2, 41 + by), (hand2[0], hand2[1] - 1)], [3.8, 3.4, 3.0], dk_(DSKIN))
    ball(t, hand2[0], hand2[1], 3.4, 3, dk_(DSKIN))
    for k in range(3):
        t.set(hand2[0] - 2 + k * 2, hand2[1] - 3, DHORN[3])
    stamp(c, t)
    t = new()
    flame_cluster(t, hand2[0], hand2[1] - 3, 3.4 + (f == 1) * 0.6, (11, 16, 14)[f], f * 2.3 + 0.7, HELL)
    stamp(c, t, HELL[0])

    # ---- jambes (pas de marche)
    bf, bl, ff = P['bf'], P['blift'], P['ff']
    t = new()
    tube(t, [(44 + ln / 2, 51 + by), (46 + bf / 2, 58 - bl / 2), (47 + bf, G - 4 - bl)], [4.2, 3.8, 3.4], DARM[:4])
    ball(t, 46 + bf / 2, 57 - bl / 2, 3.8, 3.4, DARM[:4])
    if bl:
        spoly(t, [(42 + bf, G - 4 - bl), (51 + bf, G - 5 - bl), (52 + bf, GB - bl - 1), (42 + bf, GB)], DARM[:4])
    else:
        spoly(t, [(42 + bf, G - 4), (51 + bf, G - 4), (52 + bf, GB), (40 + bf, GB)], DARM[:4])
    stamp(c, t)
    t = new()
    tube(t, [(32 + ln / 2, 51 + by), (30 + ff * 0.6, 58 + by / 2), (29 + ff, G - 4)], [4.6, 4.2, 3.8], DARM)
    ball(t, 30 + ff * 0.6, 57 + by / 2, 4.2, 3.8, DARM)
    _spike(t, (28 + ff * 0.6, 56 + by / 2), (23 + ff * 0.6, 54 + by / 2), 3.4, DHORN)
    spoly(t, [(23 + ff, G - 4), (34 + ff, G - 4), (35 + ff, GB), (21 + ff, GB)], DARM)
    t.line(23 + ff, G - 4, 33 + ff, G - 4, GOLD[2])
    for x in (22, 25, 28):
        t.set(x + ff, G + 1, DHORN[3]); t.set(x - 1 + ff, G + 1, DHORN[2])
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

    # ---- torse
    t = new()
    ox = ln
    spoly(t, [(28 + ox, 31 + by), (51 + ox, 31 + by), (50 + ox, 41 + by), (46 + ox, 48 + by), (32 + ox, 48 + by),
              (29 + ox, 41 + by)], DARM, contrast=0.42)
    ball(t, 37 + ox, 38 + by, 8, 7, DARM, only_inside=True)
    for k in range(2):
        t.line(31 + ox, 38 + by + k * 4, 39 + ox, 42 + by + k * 4, GOLD[2] if k == 0 else DARM[1])
        t.line(39 + ox, 42 + by + k * 4, 48 + ox, 38 + by + k * 4, GOLD[1] if k == 0 else DARM[1])
    ball(t, 39 + ox, 38 + by, 2.6 + (f == 1) * 0.5, 2.6 + (f == 1) * 0.5, HELL)
    t.set(38 + ox, 37 + by, HELL[4])
    stamp(c, t)

    # ---- épaulière arrière
    t = new()
    ball(t, 51 + ln, 33 + by, 7, 5.5, dk_(DARM))
    _spike(t, (52 + ln, 29 + by), (57 + ln, 21 + by), 3.6, dk_(DHORN))
    stamp(c, t)

    # ---- tête
    hx, hy = (ln - 1, by + 1) if atk else (ln, by)
    hcx, hcy = 38 + hx, 20 + hy
    t = new()
    horn(t, [(hcx + 5, hcy - 6), (hcx + 11, hcy - 9), (hcx + 15, hcy - 14), (hcx + 15, hcy - 19)],
         [3.0, 2.6, 1.8, 0.5], dk_(DHORN))
    stamp(c, t)
    t = new()
    spoly(t, [(33 + hx, hcy + 6), (44 + hx, hcy + 6), (43 + hx, 33 + by), (34 + hx, 33 + by)], dk_(DSKIN))
    stamp(c, t)
    t = new()
    ball(t, hcx, hcy, 11, 10, DSKIN)
    spoly(t, [(hcx - 10, hcy + 2), (hcx + 6, hcy + 4), (hcx + 2, hcy + 10), (hcx - 4, hcy + 12), (hcx - 9, hcy + 8)],
          DSKIN, contrast=0.3)
    spoly(t, [(hcx - 7, hcy + 10), (hcx - 1, hcy + 11), (hcx - 6 + (f == 1), hcy + 16)], DARM, contrast=0.4)
    stamp(c, t)
    t = new()
    spoly(t, [(hcx + 6, hcy), (hcx + 15, hcy - 1 - (f == 1)), (hcx + 8, hcy + 5)], DSKIN, contrast=0.45)
    stamp(c, t)
    ey = hcy - 1
    for ex in (hcx - 9, hcx - 2):
        c.rect(ex, ey, 5, 3, DEYE[1])
        c.rect(ex + 1, ey, 3, 1, DEYE[2])
        c.set(ex + 1, ey + 1, DEYE[2])
        c.set(ex + 4, ey + 2, DEYE[0]); c.set(ex + 3, ey + 2, DEYE[0])
    c.line(hcx - 10, ey - 3, hcx - 4, ey - 1, OUT)
    c.line(hcx - 10, ey - 2, hcx - 5, ey, OUT)
    c.line(hcx - 3, ey - 1, hcx + 3, ey - 3, OUT)
    c.line(hcx - 3, ey, hcx + 3, ey - 2, OUT)
    c.set(hcx - 10, ey - 1, OUT); c.set(hcx - 10, ey, OUT)
    c.line(hcx - 4, ey, hcx - 4, ey + 3, DSKIN[1])
    trail = [(hcx - 11, ey + 1), (hcx - 12, ey), (hcx - 13, ey - 1)]
    if f:
        trail += [(hcx - 14, ey - 1 - f % 2), (hcx - 15, ey - 2)]
    for (x, y) in trail:
        if c.get(x, y) is None:
            c.set(x, y, DEYE[0])
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
    t = new()
    horn(t, [(hcx - 5, hcy - 7), (hcx - 11, hcy - 9), (hcx - 16, hcy - 12), (hcx - 18, hcy - 17), (hcx - 16, hcy - 20)],
         [3.6, 3.2, 2.5, 1.4, 0.4], DHORN, ring=GOLD, ring_at=(0.2,))
    stamp(c, t)

    # ---- attaque : grand croissant violet + rémanences de la faux
    sh = (29 + ln, 36 + by)
    hand, ang = P['hand'], P['ang']
    if not atk:
        hand = (hand[0] + ln, hand[1] + by)
    if atk:
        t = new()
        cx_, cy_ = 24, 40
        Rr = 33
        for y in range(-30, H + 4):
            for x in range(-30, W):
                ddx, ddy = x + 0.5 - cx_, y + 0.5 - cy_
                r = math.hypot(ddx, ddy)
                aa = math.degrees(math.atan2(ddy, ddx)) % 360
                if not 145 <= aa <= 292:
                    continue
                u = (292 - aa) / 147
                th = 1 + 12 * u ** 1.2
                if Rr - th <= r <= Rr + 0.5:
                    k = (Rr + 0.5 - r) / (th + 0.5)
                    if u < 0.3 and (x + y) % 2:
                        continue
                    t.set(x, y, HELL[4] if k < 0.14 else HELL[2] if k < 0.42 else HELL[1])
        t.outline(HELL[0])
        arc_layer = t
    t = new()
    if atk:
        outer, inner, top = scythe(t, hand, ang, shaft_up=24, below=10, Lb=24)
    else:
        outer, inner, top = scythe(t, hand, ang, shaft_up=33, below=16, Lb=18)
    stamp(c, t)
    t = new()
    for i, k in (((5, 0), (10, 1)) if not atk else ((4, 0),)):
        x, y = outer[i]
        flame_tongue(t, x, y + 1, 1.5, 4 + (k + f) % 3 + (f == 1) * 2, 0.8 - f * 0.6, f * 1.3 + k, HELL)
    stamp(c, t, HELL[0])
    t = new()
    el = ((sh[0] + hand[0]) / 2 - 1, (sh[1] + hand[1]) / 2 + 2) if not atk else (sh[0] - 4, sh[1] + 8)
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

    # ---- épaulière avant
    t = new()
    ball(t, 29 + ln, 33 + by, 8.5, 6.2, DARM)
    t.line(21 + ln, 36 + by, 37 + ln, 37 + by, GOLD[2])
    t.line(21 + ln, 37 + by, 37 + ln, 38 + by, DARM[1])
    for (bx_, b_), (tx, ty) in (((23, 31), (16, 27)), ((27, 29), (23, 21)), ((32, 29), (33, 22))):
        _spike(t, (bx_ + ln, b_ + by), (tx + ln, ty + by), 3.8, DHORN)
    ball(t, 26 + ln, 33 + by, 1.6, 1.6, HELL)
    stamp(c, t)

    # ---- flammes infernales au sol (hauteurs qui alternent) + gerbe d'impact à l'attaque
    t = new()
    for k, x in enumerate((16, 38, 56)):
        hh = (7, 11, 8)[(k + f) % 3] if f != 1 else (11, 7, 12)[k]
        flame_cluster(t, x, G + 1, 2.6, hh, f * 1.7 + k * 2.4, HELL)
    if atk:
        tx, ty = outer[-1]
        for k, (dx, hh) in enumerate(((-6, 12), (0, 18), (6, 13), (11, 8))):
            flame_cluster(t, tx + dx, G + 1, 2.8, hh, k * 1.9 + 0.4, HELL)
    stamp(c, t, HELL[0])
    if atk:
        put_behind(c, arc_layer)
    glow_ring(c, '#3e1660')
    pts = [((8, 30), (64, 20), (68, 36), (4, 52), (60, 8)), ((7, 25), (66, 14), (70, 31), (3, 46), (57, 3)),
           ((62, 14), (67, 30), (46, 2), (-6, 6), (69, 44), (-10, 30), (2, 22))][f]
    for x, y in pts:
        if c.get(x, y) is None:
            c.set(x, y, HELL[3])
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                if c.get(x + dx, y + dy) is None and (x + y) % 2:
                    c.set(x + dx, y + dy, HELL[1])
    return shifted(c, 2), (W, H)


# ================================================================ BÉHÉMOTH DES MARAIS (monde 7)

def splash(c, x, y, r, R, tail=0):
    """Goutte de boue (boule + petite traînée vers le bas)."""
    t = Layer(c.lw, c.lh)
    ball(t, x, y, r, r * 0.9, R)
    for k in range(tail):
        t.set(x + 0.3, y + r + k, R[1])
    stamp(c, t)


def behemoth(f):
    W, H = BHW, BHH
    G = H - 2
    new = lambda: Layer(W, H)
    c = new()
    atk = f == 2
    by = (0, 2, 3)[f]                  # buste : respiration lourde / écrasement
    ln = (0, -1, -4)[f]                # avancée du torse
    X = 4

    # ---- flaque de marais (s'étale à l'impact)
    t = new()
    t.ellipse(X + 36 - (4 if atk else 0), G - 0.5, 32 + (6 if atk else f), 2.6, SWAMP[1])
    t.ellipse(X + 34 - (4 if atk else 0), G - 1, 26 + (4 if atk else f), 1.6, SWAMP[2])
    t.line(X + 16 + f, G - 1, X + 26 + f, G - 1, SWAMP[3])
    stamp(c, t, None)

    # ---- miasme derrière
    t = new()
    for k, (x, hgt) in enumerate(((X + 30, 16), (X + 46, 22), (X + 60, 14))):
        flame_tongue(t, x, G - 2, 4, hgt + (5 if (k + f) % 2 else 0), 3 - f * 2, f * 1.9 + k,
                     [FUME[0], FUME[0], FUME[1], FUME[1], FUME[2]])
    stamp(c, t, None)

    # ---- branches mortes (se balancent avec retard)
    sw = (0, 2, -2)[f]
    bb = by + ln // 2
    branch(c, [(X + 44 + ln, 18 + by), (X + 48 + ln + sw / 2, 8 + bb), (X + 47 + ln + sw, 1 + bb)], [3.0, 2.0, 0.8])
    branch(c, [(X + 48 + ln + sw / 2, 9 + bb), (X + 53 + ln + sw, 5 + bb), (X + 56 + ln + sw * 1.3, 6 + bb + sw / 2)],
           [1.4, 1.0, 0.5])
    branch(c, [(X + 54 + ln, 22 + by), (X + 61 + ln + sw / 2, 13 + bb), (X + 66 + ln + sw, 11 + bb + abs(sw) / 2)],
           [2.6, 1.8, 0.6])
    branch(c, [(X + 34 + ln, 14 + by), (X + 33 + ln + sw / 2, 6 + bb), (X + 29 + ln + sw, 2 + bb)], [2.4, 1.6, 0.6])

    # ---- bras lointain (appui derrière ; se lève à l'attaque)
    t = new()
    if atk:
        arm = [(X + 52 + ln, 28 + by), (X + 60, 40 + by), (X + 61, 53)]
        fist2 = (X + 61, 56)
    elif f == 1:
        arm = [(X + 54 + ln, 28 + by), (X + 63, 40 + by), (X + 66, 52)]
        fist2 = (X + 66, 55)
    else:
        arm = [(X + 54, 28), (X + 61, 40), (X + 62, 54)]
        fist2 = (X + 62, 57)
    tube(t, arm, [7, 6, 5.4], MUDF, bias=-0.1)
    ball(t, fist2[0], fist2[1], 5.5, 5, MUDF)
    stamp(c, t)

    # ---- jambes trapues : un pied se lève au pas
    if f == 0:
        legs = ((X + 50, 0), (X + 34, 0))
    elif f == 1:
        legs = ((X + 53, 4), (X + 30, 0))
    else:
        legs = ((X + 54, 0), (X + 28, 0))
    for i, (lx, lift) in enumerate(legs):
        t = new()
        R = MUDF if i == 0 else MUD
        tube(t, [(lx + 2 - (lx - X - 42) * 0.3, 46 + by), (lx, G - 4 - lift)], [7, 6.4], R)
        spoly(t, [(lx - 8, G - 5 - lift), (lx + 6, G - 6 - lift), (lx + 8, G - lift), (lx - 9, G - lift)], R,
              contrast=0.45)
        stamp(c, t)
        for k in range(3):
            c.set(lx - 8 + k * 4, G - lift, FANG[2]); c.set(lx - 8 + k * 4, G - 1 - lift, FANG[1])
        if lift:
            for k in range(3):
                drip(c, lx - 6 + k * 5, G + 1 - lift, 1 + k % 2, MUD)

    # ---- torse colossal voûté
    t = new()
    tx0 = X + ln
    tm = mask_of(lambda m: (m.ellipse(tx0 + 42, 32 + by, 22, 17, '#000'), m.ellipse(tx0 + 38, 44 + by, 15, 9, '#000')))
    shade(t, tm, MUD, contrast=0.45)
    for (x, y) in tm:
        if ((x - ln) * 7 + (y - by) * 13) % 23 == 0:
            t.set(x, y, MUD[1]); t.setf(x + 1, y, MUD[3])
    for (x0, y0, x1, y1) in ((36, 36, 41, 42), (50, 30, 54, 38), (28, 44, 32, 48)):
        t.line(tx0 + x0, y0 + by, tx0 + x1, y1 + by, MUD[1])
    pr = (3.6, 4.4, 4.6)[f]                           # cœur toxique qui pulse
    t.ellipse(tx0 + 34, 40 + by, pr, pr * 0.9, BEYE[0], only_inside=True)
    t.ellipse(tx0 + 34, 40 + by, pr - 1.4, pr * 0.9 - 1.2, BEYE[1], only_inside=True)
    t.set(tx0 + 33, 39 + by, BEYE[2])
    if f:
        t.set(tx0 + 34, 40 + by, BEYE[2])
    for (dx, dy) in ((-4, -3), (3, -4), (5, 2), (-3, 4)):
        k = 1.6 + f * 0.3
        t.line(tx0 + 34, 40 + by, tx0 + 34 + dx * k, 40 + by + dy * k * 0.9, BEYE[0])
    stamp(c, t)

    # ---- manteau de mousse, coulures qui s'allongent
    t = new()
    o = ln
    mm = mask_of(lambda m: m.poly([(X + o + 24, 22 + by), (X + o + 30, 15 + by), (X + o + 42, 13 + by), (X + o + 56, 16 + by),
                                   (X + o + 64, 26 + by), (X + o + 64, 34 + by), (X + o + 61, 31 + by), (X + o + 59, 37 + by),
                                   (X + o + 56, 30 + by), (X + o + 52, 35 + by), (X + o + 49, 28 + by), (X + o + 45, 33 + by),
                                   (X + o + 42, 27 + by), (X + o + 38, 31 + by), (X + o + 34, 25 + by), (X + o + 30, 29 + by),
                                   (X + o + 27, 25 + by)], '#000'))
    shade(t, mm, BMOSS, contrast=0.5, bias=0.05)
    for (x, y) in mm:
        xx, yy = x - o, y - by
        if (xx * 5 + yy * 3) % 7 == 0 and (x, y - 1) in mm:
            t.set(x, y, BMOSS[1])
        elif (xx * 3 + yy * 11) % 13 == 0:
            t.set(x, y, BMOSS[4])
    stamp(c, t)
    for k, (x, y, n) in enumerate(((61, 34, 4), (52, 35, 3), (45, 33, 5), (38, 31, 3))):
        drip(c, X + o + x, y + by + 1, n + ((2 if k % 2 else -1) if f == 1 else 0) + (2 if atk else 0), BMOSS)

    # ---- champignons (rebondissent)
    mb = (0, 1, -1)[f]
    mushroom(c, X + o + 37, 15 + by + mb, 3, CAPV)
    mushroom(c, X + o + 52, 15 + by, 4, CAPR, lean=0.5 + mb)
    mushroom(c, X + o + 58, 20 + by + mb, 2, CAPV)
    mushroom(c, X + o + 44, 13 + by, 2, CAPR, lean=-mb)

    def draw_head():
        # ---- tête enfoncée entre les épaules
        hx, hy = X + 15 + ln, 25 + by + (1 if atk else 0)
        t = new()
        ball(t, hx + 1, hy, 11, 9.5, MUD)
        jaw_open = 6 if atk else (1 if f == 1 else 0)
        spoly(t, [(hx - 11, hy + 2 + jaw_open), (hx + 6, hy + 2), (hx + 8, hy + 8 + jaw_open * 0.6),
                  (hx - 1, hy + 11 + jaw_open), (hx - 10, hy + 9 + jaw_open)], MUD, contrast=0.4, bias=-0.06)
        stamp(c, t)
        if atk:
            c.poly([(hx - 10, hy + 2), (hx + 4, hy + 2.5), (hx - 9, hy + 8)], '#2a0a14')
            c.line(hx - 9, hy + 5, hx, hy + 4, '#6a1a2a')
        elif f == 1:
            c.rect(hx - 10, hy + 3, 14, 1, OUT)
            c.line(hx - 9, hy + 4, hx - 1, hy + 4, '#2a0a14')
        else:
            c.line(hx - 10, hy + 3, hx + 4, hy + 3, OUT)
        for (x, h_) in ((hx - 9, 4), (hx - 4, 3), (hx + 1, 2)):
            base = hy + 3 + jaw_open
            for k in range(h_):
                c.set(x, base - k, FANG[3] if k == h_ - 1 else FANG[2])
                c.set(x + 1, base - k + 1, FANG[1])
        for x in (hx - 7, hx - 2):
            c.set(x, hy + 3, FANG[3]); c.set(x, hy + 4, FANG[2])
        t = new()
        spoly(t, [(hx - 11, hy - 2), (hx - 6, hy - 7), (hx + 4, hy - 9), (hx + 8, hy - 4), (hx - 2, hy - 3)], BMOSS,
              contrast=0.5, bias=0.1)
        stamp(c, t)
        ex, ey = hx - 8, hy - 2
        for ox_ in (0, 7):
            c.rect(ex + ox_ - 1, ey - 1, 6, 4, OUT)
            c.rect(ex + ox_, ey, 4, 2, BEYE[1])
            c.set(ex + ox_, ey, BEYE[2]); c.set(ex + ox_ + 1, ey, BEYE[2])
            c.set(ex + ox_ + 3, ey + 1, BEYE[0])
            if c.get(ex + ox_ - 2, ey) is None:
                c.set(ex + ox_ - 2, ey, BEYE[0])
        c.line(ex - 2, ey - 2, ex + 12, ey - 2, OUT)
        if atk:                                            # sourcils froncés
            c.line(ex - 2, ey - 1, ex + 3, ey, OUT)
            c.line(ex + 6, ey, ex + 11, ey - 1, OUT)
        c.line(ex - 1, ey - 3, ex + 4, ey - 2, BMOSS[1])
        # racines du menton : se balancent
        for (x, n) in ((hx - 6, 5), (hx - 1, 7), (hx + 4, 4)):
            base = hy + 10 + jaw_open
            dx = (0, 2, -3)[f] * (1 if x % 2 else 0.5)
            c.line(x, base, x - 1 + dx, base + n, ROOT[2])
            c.set(x - 1 + dx, base + n, ROOT[3])

    def draw_arm():
        # ---- bras proche : traîne au sol / écrase à l'attaque
        t = new()
        if atk:
            arm = [(X + 27 + ln, 34 + by), (X + 12 + ln, 45 + by), (X + 1, G - 11)]
            fist = (X - 3, G - 8)
        elif f == 1:
            arm = [(X + 30 + ln, 30 + by), (X + 19 + ln, 42 + by), (X + 9, 52 + by)]
            fist = (X + 7, G - 6)
        else:
            arm = [(X + 30, 30), (X + 21, 42), (X + 13, 52)]
            fist = (X + 11, G - 6)
        tube(t, arm, [7.4, 6.2, 5.4], MUD)
        stamp(c, t)
        t = new()
        fr = 9 if atk else 7
        ball(t, fist[0], fist[1], fr, fr - 1, MUD)
        stamp(c, t)
        for k in range(3):
            c.line(fist[0] - 4 + k * 3, fist[1] + 1, fist[0] - 4 + k * 3, fist[1] + 5, MUD[1])
        for (x, y) in ((fist[0] - 6, fist[1] + 5), (fist[0] - 3, fist[1] + 6), (fist[0], fist[1] + 6)):
            c.set(x, y, FANG[3]); c.set(x - 1, y, FANG[2])
        for k in range(3):
            u = 0.25 + k * 0.25
            x = arm[0][0] + (arm[2][0] - arm[0][0]) * u
            y = arm[0][1] + (arm[2][1] - arm[0][1]) * u
            for q in range(-5, 6):
                yy = y + q * 0.4 + math.sin(q * 0.9 + k + f) * 0.8
                c.setf(x + q, yy, ROOT[1])
                if q % 3 == 0:
                    c.setf(x + q, yy - 1, ROOT[3])
        t = new()
        sm = mask_of(lambda m: m.poly([(X + o + 20, 25 + by), (X + o + 26, 18 + by), (X + o + 35, 19 + by), (X + o + 37, 26 + by),
                                       (X + o + 33, 30 + by), (X + o + 30, 27 + by), (X + o + 26, 31 + by), (X + o + 23, 27 + by)],
                                      '#000'))
        shade(t, sm, BMOSS, contrast=0.5, bias=0.08)
        stamp(c, t)
        mushroom(c, X + o + 27, 19 + by + mb, 3, CAPR, lean=-0.4 - mb)
        mushroom(c, X + o + 31, 20 + by, 2, CAPV)
        drip(c, X + o + 24, 28 + by, 3 + (2 if f == 1 else 0), BMOSS)
        drip(c, X + o + 30, 28 + by, 2 + (1 if f else 0), BMOSS)
        if not atk:
            for x in (arm[1][0] - 2, arm[1][0] + 3):
                drip(c, x, arm[1][1] + 5, 2 + (2 if f == 1 and x % 2 else 0), MUD)
        return arm, fist

    hx, hy = X + 15 + ln, 25 + by + (1 if atk else 0)
    jaw_open = 6 if atk else (1 if f == 1 else 0)
    if atk:
        arm, fist = draw_arm()
        draw_head()
    else:
        draw_head()
        arm, fist = draw_arm()

    # ---- effets
    if atk:
        # éclaboussures de boue en couronne autour du poing + onde de choc + lignes d'impact
        fx, fy = fist[0], G
        WM = ['#2a1c14', '#5a4028', '#8c6c42', '#b8945c', '#e0c890']          # boue mouillée (reflets)
        t = new()
        # couronne d'éclaboussure : nappe de vase verte bordée de boue, crête en pointes vers l'extérieur
        SL = [BMOSS[1], BMOSS[2], BMOSS[3], TOXIC[2], TOXIC[3]]           # vase verte
        crown = {}
        ccx = fx + 2
        for x in range(int(ccx - 23), int(ccx + 24)):
            u = (x - ccx) / 23.5                                           # -1 .. 1
            if abs(u) > 1:
                continue
            base_h = 25 * (1 - u * u) ** 0.6 * (0.45 + 0.55 * abs(u))       # creux au centre (le poing)
            spike = (5 if (x - int(fx)) % 5 == 0 else 2 if (x - int(fx)) % 5 in (1, 4) else 0) * (0.4 + abs(u))
            crown[x] = base_h + spike
        for x, hh in crown.items():
            top = G + 1 - hh
            for y in range(int(top), G + 1):
                v = (G + 1 - y) / max(hh, 1)
                R = WM if v < 0.3 else SL
                k = 4 if y - top < 1.2 else 3 if v > 0.75 else (1 if R is WM else 2 if (x + y) % 3 else 1)
                t.set(x, y, R[k])
        # gouttes détachées au-dessus des pointes
        for x, hh in crown.items():
            if (x - int(fx)) % 5 == 0 and hh > 8:
                d = 3 + (x % 3)
                sx = x + (1 if x > fx else -1) * 2
                t.set(sx, G - hh - d, TOXIC[4]); t.set(sx, G - hh - d + 1, TOXIC[2])
        t.outline(OUT)
        put_behind(c, t)
        # mottes projetées + gouttes de jus toxique
        for (dx, dy, r) in ((-10, -26, 2.6), (2, -29, 2.0), (13, -22, 2.2)):
            splash(c, fx + dx, fy + dy, r, WM, tail=1)
        for (dx, dy) in ((-15, -31), (9, -34)):
            sparkle(c, fx + dx, fy + dy, TOXIC[2], TOXIC[4])
        # éclair d'impact sous le poing
        cx_, cy_ = fist[0] - 8, G - 1
        for k in range(1, 6):
            for (ux, uy) in ((-1, 0), (0, -1), (-0.7, -0.7)):
                if c.get(cx_ + ux * k, cy_ + uy * k) is None:
                    c.set(cx_ + ux * k, cy_ + uy * k, TOXIC[4] if k < 3 else TOXIC[3])
        # onde de choc aplatie au sol (devant)
        t = new()
        arc_fx(t, fx, G, 17, 0.28, 180, 360, 2.6, [SWAMP[2], SWAMP[3], BMOSS[3], TOXIC[2], TOXIC[3]], lead=0.5, fade=0.0)
        put_behind(c, t)
    glow_ring(c, TOXIC[1], TOXIC[2], every=1)
    spores = ((X + 66, 8, 2), (X + 4, 12, 3), (X + 68, 40, 1), (X + 22, 4, 2), (X + 62, 50, 3), (X + 8, 34, 1))
    if f == 1:
        spores = tuple((x + 2, y - 3, k) for x, y, k in spores)
    dots(c, spores, lambda k: TOXIC[k + 1])
    return c, (W, H)


# ================================================================ export

BOSSES = {
    'boss_fallen_knight': fallen_knight,
    'boss_demon_king': demon_king,
    'boss_swamp_behemoth': behemoth,
}


def build():
    out = {}
    for name, fn in BOSSES.items():
        a, b, k = [cv for cv, _ in frames_boxed(fn)]
        out[name] = (a, {})
        out[name + '_b'] = (b, {})
        out[name + '_atk'] = (k, {})
    return out
