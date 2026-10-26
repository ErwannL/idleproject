"""Animations enrichies des 20 compagnons : vrai cycle de marche + préparation d'attaque.

Pour chaque allié (même canvas et même placement que ally_<id> / _b / _atk, pieds sur la dernière ligne) :
  ally_<id>_w1    marche, contact 1 : jambe proche en avant, jambe lointaine en arrière (talon levé),
                  bras balancés à l'opposé, corps 1 px plus bas, cape / cheveux qui traînent
  ally_<id>_w2    marche, contact 2 : jambes et bras inversés
  ally_<id>_wind  préparation de l'attaque : arme ou bâton armé en arrière, corps qui recule
Le jeu joue repos -> w1 -> repos -> w2 pour la marche, wind -> atk pour l'attaque.

Les fonctions de personnage ci-dessous sont des copies paramétrées de celles d'allies_r, allies_sr et
allies_ssr (mêmes formes, mêmes couleurs). Elles s'exécutent avec les globales de leur module d'origine
(palettes, outils de dessin) complétées de quelques surcharges (poses, jambes, cape) grâce à _bind() :
les modules d'origine ne sont pas modifiés.
"""
import math
import types

from lib import group_crop
import allies_r
import allies_sr
import allies_ssr

FRAMES = ('w1', 'w2', 'wind')


def _bind(fn, mod, **over):
    """Ré-exécute `fn` avec les globales de `mod` (+ surcharges)."""
    g = dict(vars(mod))
    g.update(over)
    return types.FunctionType(fn.__code__, g, fn.__name__, fn.__defaults__, fn.__closure__)


# ================================================================ R (allies_r, 40×40)

# Poses : bf / ff = (x du pied, levée) arrière / avant ; fh / bh = main proche / lointaine.
R_POSE = {
    'w1': dict(tx=0, ty=1, hx=0, hy=1, bf=(11, 1), ff=(24, 0), fh=(23, 28), bh=(15, 27)),
    'w2': dict(tx=0, ty=1, hx=0, hy=1, bf=(20, 0), ff=(15, 1), fh=(27, 26), bh=(10, 26)),
    'wind': dict(tx=-1, ty=0, hx=-2, hy=0, bf=(12, 0), ff=(23, 0), fh=(18, 22), bh=(17, 25)),
}


def _r_pose(kind, **over):
    p = dict(R_POSE[kind])
    p['kind'] = kind
    p.update(over)
    return p


def _r_cape(c, p, R, top=19, length=34, back=8, wave=0):
    """Cape (copie d'allies_r.cape) : traîne derrière en marche, revient vers l'avant à l'armé."""
    ox, oy = p['tx'], p['ty']
    sw = {'w1': -1, 'w2': -2, 'wind': 1}[p['kind']] + wave
    pts = [(14 + ox, top + oy), (21 + ox, top + oy), (19 + ox, length - 2), (16 + ox, length), (12 + ox, length + 1),
           (back + sw, length - 1), (back + 1 + sw * 0.5, length - 6), (11 + ox, top + 3 + oy)]
    part = L()
    m = m_poly(pts)
    shade(part, m, R, contrast=0.5, bias=-0.08)
    for (x, y) in m:
        if (x - ox) in (11, 14) and y > top + 5 + oy:
            part.set(x, y, R[1])
    stamp(c, part)


def _r_sword(part, hand, d, ln, w, BL, guard, grip_c, pommel, edge_hi=None):
    """Épée tenue en `hand`, lame dans la direction d (vecteur unitaire)."""
    hx, hy = hand
    dx, dy = d
    blade(part, (hx + dx * 1.5, hy + dy * 1.5), (hx + dx * (ln + 1.5), hy + dy * (ln + 1.5)), w, BL, edge_hi=edge_hi)
    gx, gy = hx + dx * 0.8, hy + dy * 0.8
    part.line(gx + dy * 2.2, gy - dx * 2.2, gx - dy * 2.2, gy + dx * 2.2, guard[0])
    part.set(gx + dy * 2.2, gy - dx * 2.2, guard[1])
    part.set(hx - dx * 1.6, hy - dy * 1.6, grip_c)
    part.set(hx - dx * 2.6, hy - dy * 2.6, pommel)


def _unit(dx, dy):
    n = math.hypot(dx, dy) or 1
    return dx / n, dy / n


# ---------------------------------------------------------------- 1. écuyer

def r_squire(kind):
    p = pose(kind)
    c = L()
    ox, oy = p['tx'], p['ty']
    wind = kind == 'wind'
    cape(c, p, BLUE)
    arm(c, (14 + ox, 21 + oy), p['bh'], STEEL, HAND=LEATHER, far=True)
    legs(c, p, STEEL, STEEL)

    def det(t, ox, oy):
        for y in range(21 + oy, 30 + oy):  # tabard bleu
            for x in range(17 + ox, 21 + ox):
                t.setf(x, y, BLUE[3] if x == 17 + ox else BLUE[2] if x < 20 + ox else BLUE[1])
        for x in range(12 + ox, 26 + ox):
            t.setf(x, 27 + oy, LEATHER[1]); t.setf(x, 28 + oy, LEATHER[0])
        t.setf(18 + ox, 27 + oy, GOLD[3]); t.setf(19 + ox, 27 + oy, GOLD[2])
        t.setf(15 + ox, 21 + oy, STEEL[4]); t.setf(14 + ox, 22 + oy, STEEL[4])
    torso(c, p, STEEL, detail=det)
    head(c, p, EYE_BLUE, mood='atk' if wind else 'idle')
    hx, hy = p['hx'], p['hy']
    pw = {'w1': -1, 'w2': 0, 'wind': 1}[kind]  # le plumet traîne / revient
    part = L()
    pm = m_poly([(17 + hx, 3 + hy), (19 + hx, 0 + hy), (15 + hx, -0.5 + hy), (9 + hx + pw, 1 + hy), (5 + hx + pw, 5 + hy),
                 (4 + hx + pw * 2, 10 + hy + pw), (7 + hx + pw, 7 + hy), (11 + hx, 4.5 + hy)])
    shade(part, pm, BLUE, contrast=0.5)
    for x in range(8, 17):
        part.setf(x + hx, 2 + hy + (1 if x < 11 else 0), BLUE[4])
    stamp(c, part)
    part = L()
    m = m_ell(18.4 + hx, 9.4 + hy, 9.0, 7.9)
    m |= m_poly([(9.5 + hx, 10 + hy), (16 + hx, 10 + hy), (16 + hx, 17.5 + hy), (10.5 + hx, 16.5 + hy)])
    opening = {(x, y) for (x, y) in m_ell(22.6 + hx, 13.6 + hy, 6.0, 5.6) if y >= 9 + hy}
    m = {q for q in m if q not in opening}
    shade(part, m, STEEL, contrast=0.45)
    for x in range(10, 28):
        part.setf(x + hx, 8 + hy, GOLD[2] if x < 20 else GOLD[1])
    part.setf(13 + hx, 4 + hy, STEEL[4]); part.setf(14 + hx, 4 + hy, STEEL[4]); part.setf(12 + hx, 5 + hy, STEEL[4])
    for y in range(10, 16, 2):
        part.setf(13 + hx, y + hy, STEEL[1])
    stamp(c, part)
    for x in (19, 20, 22, 23, 25):
        c.set(x + hx, 9 + hy, BROWN_HAIR[2] if x < 22 else BROWN_HAIR[1])
    c.set(21 + hx, 9 + hy, BROWN_HAIR[3])
    face(c, hx, hy, EYE_BLUE, 'atk' if wind else 'idle', mouth=False, blush=False)
    part = L()
    hxp, hyp = p['fh']
    BL = [STEEL[1], '#6a9ae8', '#b8e0ff', '#ffffff']
    if wind:  # épée armée par-dessus l'épaule, pointe vers l'arrière
        d = _unit(-1, -0.8)
        _r_sword(part, (hxp, hyp), d, 13, 3.6, BL, (GOLD[2], GOLD[3]), LEATHER[1], GOLD[2], edge_hi='#ffffff')
        tip = (hxp + d[0] * 14.5, hyp + d[1] * 14.5)
    else:
        blade(part, (hxp + 1, hyp - 2), (hxp + 3, hyp - 16), 3.6, BL, edge_hi='#ffffff')
        part.line(hxp - 1, hyp - 1, hxp + 3, hyp - 2, GOLD[2])
        part.set(hxp - 1, hyp - 1, GOLD[3])
        part.set(hxp, hyp + 2, LEATHER[1]); part.set(hxp, hyp + 3, GOLD[2])
    stamp(c, part)
    arm(c, (22 + ox, 21 + oy), p['fh'], STEEL, HAND=LEATHER, cuff=GOLD)
    part = L()
    ball(part, 22 + ox, 20.5 + oy, 3.0, 2.4, STEEL)
    for x in range(19, 26):
        part.setf(x + ox, 22 + oy, BLUE[2])
    stamp(c, part)
    if wind:  # l'énergie bleue se concentre sur la lame
        sparkle(c, int(tip[0]) - 1, int(tip[1]) - 1, ('#ffffff', '#4fb0ff'))
        c.set(hxp - 6, hyp - 9, '#8fe0ff')
    else:
        tipx, tipy = p['fh'][0] + 3, p['fh'][1] - 16
        sparkle(c, tipx + 2, tipy - 1 + (1 if kind == 'w1' else 0), ('#ffffff', '#4fb0ff'))
    return c


# ---------------------------------------------------------------- 2. mercenaire

def r_mercenary(kind):
    p = pose(kind)
    c = L()
    ox, oy = p['tx'], p['ty']
    hx, hy = p['hx'], p['hy']
    wind = kind == 'wind'
    part = L()
    sw = {'w1': -1, 'w2': 1, 'wind': 2}[kind]
    m = m_poly([(15 + ox, 18 + oy), (10, 20 + sw), (5, 19 + sw), (7, 21.5 + sw), (3, 23 + sw * 2), (9, 23.5 + sw),
                (15 + ox, 21 + oy)])
    shade(part, m, RED, contrast=0.5)
    stamp(c, part)
    arm(c, (14 + ox, 21 + oy), p['bh'], LEATHER, far=True)
    legs(c, p, DLEATHER, LEATHER)

    def det(t, ox, oy):
        for x in range(12 + ox, 26 + ox):
            t.setf(x, 27 + oy, DLEATHER[1]); t.setf(x, 28 + oy, DLEATHER[0])
        t.setf(19 + ox, 27 + oy, GOLD[3]); t.setf(20 + ox, 27 + oy, GOLD[1])
        t.line(14 + ox, 21 + oy, 22 + ox, 27 + oy, DLEATHER[2])
        t.setf(16 + ox, 23 + oy, STEEL[3]); t.setf(21 + ox, 23 + oy, LEATHER[1])
    torso(c, p, LEATHER, detail=det)
    hxp, hyp = p['fh']
    BL = [STEEL[0], STEEL[2], STEEL[3], STEEL[4]]
    head(c, p, EYE_AMBER, mood='atk' if wind else 'idle')
    ear(c, p)
    hair(c, p, BROWN_HAIR, bang=6, bang_pat=(0, 2, 1, 2, 0, 1),
         spikes=[[(11, 4), (6, 1), (12, 1.5)], [(14, 2), (13, -2), (18, 1.5)], [(19, 2), (22, -1), (23, 3)],
                 [(9, 9), (3 + sw * 0.5, 8), (10, 13)], [(10, 13), (5 + sw * 0.5, 15), (11, 16)], [(23, 3), (28, 3), (26, 7)]])
    part = L()
    m = m_ell(19 + ox, 18.6 + oy, 5.6, 2.2)
    shade(part, m, RED, contrast=0.6)
    stamp(c, part)
    part = L()
    if wind:  # grande épée levée derrière la tête
        d = _unit(-0.6, -1)
        blade(part, (hxp + d[0] * 1.5, hyp + d[1] * 1.5), (hxp + d[0] * 17, hyp + d[1] * 17), 4.6, BL, edge_hi=WHITE)
        part.line(hxp - 3, hyp + 1, hxp + 2, hyp - 3, GOLD[2])
        part.set(hxp - 3, hyp + 1, GOLD[3])
        part.set(hxp + 1, hyp + 2, DLEATHER[2]); part.set(hxp + 2, hyp + 3, GOLD[2])
    else:
        blade(part, (hxp + 1, hyp - 2), (hxp + 7, hyp - 17), 4.6, BL, edge_hi=WHITE)
        part.line(hxp - 2, hyp - 3, hxp + 3, hyp - 1, GOLD[2])
        part.set(hxp - 2, hyp - 3, GOLD[3])
        part.set(hxp, hyp + 2, DLEATHER[2]); part.set(hxp, hyp + 3, GOLD[2])
    stamp(c, part)
    arm(c, (22 + ox, 21 + oy), p['fh'], LEATHER, cuff=DLEATHER)
    part = L()
    ball(part, 22 + ox, 20.8 + oy, 2.8, 2.2, LEATHER)
    stamp(c, part)
    if wind:
        c.set(hxp - 12, hyp - 15, '#ffd08a'); c.set(hxp - 13, hyp - 13, '#ffffff')
    return c


# ---------------------------------------------------------------- 3. rôdeuse

def r_ranger(kind):
    wind = kind == 'wind'
    over = dict(tx=0, hx=-1, fh=(28, 22), bh=(23, 22), bf=(12, 0), ff=(23, 0)) if wind else {}
    p = pose(kind, **over)
    c = L()
    ox, oy = p['tx'], p['ty']
    hx, hy = p['hx'], p['hy']
    part = L()
    bar(part, (11 + ox, 28 + oy), (14 + ox, 18 + oy), 3.2, (WOOD[1], WOOD[2], WOOD[3]))
    stamp(c, part)
    for i, (x, y) in enumerate(((13, 16), (14.5, 15.5), (12, 16.5))):
        c.set(x + ox, y + oy, GREEN[3]); c.set(x + ox, y - 1 + oy, GREEN[4] if i == 0 else GREEN[2])
    cape(c, p, GREEN, length=33, back=9)
    if not wind:
        arm(c, (14 + ox, 21 + oy), p['bh'], GREEN, HAND=LEATHER, far=True)
    legs(c, p, MOSS, LEATHER)

    def det(t, ox, oy):
        for x in range(12 + ox, 26 + ox):
            t.setf(x, 26 + oy, WOOD[1]); t.setf(x, 27 + oy, WOOD[0])
        t.setf(20 + ox, 26 + oy, GOLD[2])
        for y in range(19 + oy, 26 + oy):
            t.setf(21 + ox, y, LEATHER[1] if y % 2 else LEATHER[3])
    torso(c, p, LEATHER, detail=det)
    head(c, p, EYE_GREEN, mood='focus' if wind else 'idle')
    hair(c, p, BROWN_HAIR, bang=8, shine=False)
    pw = {'w1': -1, 'w2': 0, 'wind': 1}[kind]  # pointe de la capuche
    part = L()
    m = m_ell(18.2 + hx, 9.6 + hy, 9.4, 8.6)
    m |= m_poly([(12 + hx, 3 + hy), (2 + hx + pw, 8 + hy - pw), (4 + hx + pw, 10 + hy - pw), (11 + hx, 11 + hy)])
    m |= m_poly([(10 + hx, 12 + hy), (16 + hx, 15 + hy), (17 + hx, 19 + hy), (11 + hx, 19 + hy)])
    fo = m_ell(22.6 + hx, 13.6 + hy, 6.2, 6.4)
    m = {(x, y) for (x, y) in m if not ((x, y) in fo and y >= 7 + hy)}
    shade(part, m, GREEN, contrast=0.45)
    for (x, y) in m:
        if (x + 1, y) in fo or (x, y + 1) in fo:
            if y >= 7 + hy:
                part.set(x, y, GREEN[1])
    stamp(c, part)
    hxp, hyp = p['fh']
    part = L()
    if wind:
        # arc levé, flèche encochée, corde à demi tirée
        bx = hxp + 1
        top, bot = (bx - 2, hyp - 11), (bx - 2, hyp + 11)
        for t in range(0, 41):
            u = t / 40
            y = top[1] + (bot[1] - top[1]) * u
            x = bx - 2 + math.sin(u * math.pi) * 3.5
            part.set(x, y, WOOD[2] if u < 0.5 else WOOD[1])
            part.set(x - 1, y, WOOD[3] if u < 0.5 else WOOD[2])
        stamp(c, part)
        c.line(top[0] - 1, top[1], p['bh'][0], p['bh'][1], '#e8e0c8')
        c.line(bot[0] - 1, bot[1], p['bh'][0], p['bh'][1], '#e8e0c8')
        part = L()
        part.line(p['bh'][0] - 1, hyp, hxp + 5, hyp, WOOD[3])
        part.poly([(hxp + 5, hyp - 2), (hxp + 9, hyp + 0.5), (hxp + 5, hyp + 3)], GREEN[3])
        part.set(hxp + 6, hyp, GREEN[4])
        part.set(p['bh'][0] - 1, hyp - 1, GREEN[3]); part.set(p['bh'][0], hyp - 1, GREEN[3])
        stamp(c, part)
        arm(c, (15 + ox, 21 + oy), p['bh'], GREEN, HAND=LEATHER, far=True)
    else:
        bx = hxp + 1
        top, bot = (bx, hyp - 11), (bx, hyp + 10)
        for t in range(0, 41):
            u = t / 40
            y = top[1] + (bot[1] - top[1]) * u
            x = bx + math.sin(u * math.pi) * 3.5
            part.set(x, y, WOOD[2] if u < 0.5 else WOOD[1])
            part.set(x + 1, y, WOOD[1] if u < 0.5 else WOOD[0])
        part.set(bx, top[1], GREEN[3]); part.set(bx, bot[1], GREEN[2])
        stamp(c, part)
        c.line(bx - 1, top[1] + 1, bx - 1, bot[1] - 1, '#e8e0c8')
    arm(c, (22 + ox, 21 + oy), p['fh'], GREEN, HAND=LEATHER, cuff=LEATHER)
    return c


# ---------------------------------------------------------------- 4. pyromancienne

def r_pyromancer(kind):
    wind = kind == 'wind'
    p = pose(kind, **(dict(fh=(19, 23)) if wind else {}))
    c = L()
    ox, oy = p['tx'], p['ty']
    hx, hy = p['hx'], p['hy']
    hxp, hyp = p['fh']
    part = L()
    sw = {'w1': -1, 'w2': -2, 'wind': 1}[kind]
    m = m_poly([(10 + hx, 9 + hy), (17 + hx, 11 + hy), (17 + ox, 22 + oy), (13 + ox, 27 + oy), (8 + sw, 26),
                (6 + sw, 22), (8 + hx, 15 + hy)])
    shade(part, m, FIRE_HAIR, contrast=0.45)
    for y in range(14, 26):
        part.setf(11 + (y % 3 == 0) + ox, y + oy, FIRE_HAIR[1])
    stamp(c, part)
    arm(c, (14 + ox, 21 + oy), p['bh'], RED, far=True)
    legs(c, p, DLEATHER, DLEATHER, hip=32, boot_h=2)

    def det(t, ox, oy):
        for x in range(10 + ox, 28 + ox):
            t.setf(x, 25 + oy, GOLD[1]); t.setf(x, 24 + oy, DLEATHER[1])
        t.setf(18 + ox, 24 + oy, GOLD[3]); t.setf(19 + ox, 24 + oy, GOLD[2])
        for x in range(10 + ox, 28 + ox, 2):
            t.setf(x, 34 + oy, RED[0])
        for y in range(26 + oy, 34 + oy):
            t.setf(15 + ox, y, RED[1]); t.setf(21 + ox, y, RED[2])
    torso(c, p, RED, top=19, bot=35, wt=10, wb=17, detail=det, contrast=0.45)
    if wind:  # bâton basculé en arrière (devant le buste, derrière la tête)
        part = L()
        bar(part, (hxp + 4, hyp + 3), (hxp - 12, hyp - 10), 2.2, (WOOD[1], WOOD[2], WOOD[3]))
        stamp(c, part)
    head(c, p, EYE_RED, mood='atk' if wind else 'idle')
    hair(c, p, FIRE_HAIR, bang=8, bang_pat=(0, 1, 2, 1, 0), shine=False,
         back=[[(10, 12), (15, 12), (15, 18), (11, 18)]], face_c=(22.6, 13.8, 6.2, 6.4))
    part = L()
    m = m_poly([(26 + hx, 9 + hy), (28 + hx, 10 + hy), (27.5 + hx, 17 + hy), (26 + hx, 15 + hy)])
    shade(part, m, FIRE_HAIR)
    stamp(c, part)
    pw = {'w1': 1, 'w2': 0, 'wind': -1}[kind]  # pointe du chapeau
    part = L()
    cone = m_poly([(12 + hx, 6 + hy), (24 + hx, 6 + hy), (20 + hx, 1 + hy), (15 + hx, 0 + hy), (8 + hx, 0 + hy + pw),
                   (3 + hx, 2 + hy + pw), (9 + hx, 2 + hy + pw), (13 + hx, 2 + hy)])
    shade(part, cone, RED, contrast=0.5)
    brim = m_ell(18.5 + hx, 6.6 + hy, 12.5, 2.4)
    shade(part, brim, [RED[0], RED[1], RED[2], RED[3], RED[3]], contrast=0.5, bias=-0.1)
    for x in range(12, 25):
        part.setf(x + hx, 4 + hy, GOLD[2] if x < 19 else GOLD[1])
        part.setf(x + hx, 5 + hy, GOLD[1] if x < 19 else GOLD[0])
    part.setf(17 + hx, 4 + hy, '#ffffff'); part.setf(17 + hx, 5 + hy, '#ff9a2a')
    part.set(3 + hx, 3 + hy + pw, GOLD[3])
    stamp(c, part)
    part = L()
    if wind:  # l'orbe de feu se charge derrière elle
        flame_orb(c, hxp - 14, hyp - 11, 2.8, 1)
        sparkle(c, hxp - 17, hyp - 15, ('#fff6c8', '#ffd24a'))
        c.set(hxp - 10, hyp - 15, '#ff9a2a'); c.set(hxp - 18, hyp - 7, '#ffd24a')
    else:
        bar(part, (hxp + 1, hyp + 9 - p['ty']), (hxp + 1, hyp - 13), 2.2, (WOOD[1], WOOD[2], WOOD[3]))
        stamp(c, part)
        flame_orb(c, hxp + 1.5, hyp - 14, 2.4, 0 if kind == 'w2' else 1)
    arm(c, (22 + ox, 21 + oy), p['fh'], RED, cuff=GOLD)
    return c


# ---------------------------------------------------------------- 5. prêtresse

def r_priestess(kind):
    wind = kind == 'wind'
    p = pose(kind, **(dict(fh=(19, 23)) if wind else {}))
    c = L()
    ox, oy = p['tx'], p['ty']
    hx, hy = p['hx'], p['hy']
    hxp, hyp = p['fh']
    GST = (GOLD[1], GOLD[2], GOLD[3])
    part = L()
    sw = {'w1': -1, 'w2': -2, 'wind': 1}[kind]
    m = m_poly([(10 + hx, 8 + hy), (18 + hx, 8 + hy), (17 + ox, 22 + oy), (14 + ox, 28 + oy), (8 + sw, 28),
                (6 + sw, 22), (8 + hx, 14 + hy)])
    shade(part, m, NAVY, contrast=0.45)
    stamp(c, part)
    arm(c, (14 + ox, 21 + oy), p['bh'], CLOTH_W, far=True)
    legs(c, p, NAVY, BLUE, hip=32, boot_h=2)

    def det(t, ox, oy):
        for y in range(20 + oy, 36 + oy):
            for x in range(18 + ox, 22 + ox):
                t.setf(x, y, NAVY[3] if x == 18 + ox else NAVY[2])
            t.setf(17 + ox, y, GOLD[2]); t.setf(22 + ox, y, GOLD[1])
        t.setf(19 + ox, 23 + oy, GOLD[3]); t.setf(20 + ox, 23 + oy, GOLD[3]); t.setf(19 + ox, 22 + oy, GOLD[3])
        t.setf(19 + ox, 24 + oy, GOLD[2]); t.setf(18 + ox, 23 + oy, GOLD[3])
        for x in range(10 + ox, 29 + ox):
            t.setf(x, 34 + oy, NAVY[2] if x % 2 else NAVY[1])
    torso(c, p, CLOTH_W, top=19, bot=35, wt=10, wb=17, detail=det, contrast=0.4)
    if wind:  # bâton basculé en arrière (devant le buste, derrière la tête)
        part = L()
        bar(part, (hxp + 4, hyp + 3), (hxp - 13, hyp - 11), 2.2, GST)
        stamp(c, part, outline='#5a2a14')
    head(c, p, EYE_SKY, mood='atk' if wind else 'idle')
    hair(c, p, BLONDE, bang=8, bang_pat=(0, 1, 1, 2, 1, 1), shine=False)
    part = L()
    m = m_ell(18.3 + hx, 9.4 + hy, 9.2, 8.4)
    m |= m_poly([(10 + hx, 12 + hy), (16 + hx, 14 + hy), (16 + hx, 19 + hy), (10 + hx, 18 + hy)])
    fo = m_ell(22.6 + hx, 13.8 + hy, 6.4, 6.6)
    m = {(x, y) for (x, y) in m if not ((x, y) in fo and y >= 6 + hy)}
    shade(part, m, NAVY, contrast=0.45)
    ring = m_ell(22.6 + hx, 13.8 + hy, 8.2, 8.4)
    for (x, y) in m:
        if (x, y) in ring and y >= 5 + hy:
            part.set(x, y, CLOTH_W[3] if x < 21 + hx and y < 9 + hy else CLOTH_W[2])
    stamp(c, part)
    part = L()
    hb = 1 if kind == 'w1' else 0
    hm = m_ell(17 + hx, 1.5 + hb, 6.2, 1.7)
    for (x, y) in hm:
        if not all(q in hm for q in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1))):
            part.set(x, y, GOLD[4] if x < 15 + hx else GOLD[3] if y <= 1 + hb else GOLD[2])
    stamp(c, part, outline='#a8742a')
    if wind:  # la croix luit, levée derrière la tête
        part = L()
        tx_, ty_ = hxp - 14, hyp - 12
        part.rect(int(tx_) - 2, int(ty_) - 1, 5, 2, GOLD[2])
        part.rect(int(tx_) - 1, int(ty_) - 4, 2, 7, GOLD[2])
        part.set(tx_ - 2, ty_ - 1, GOLD[4]); part.set(tx_ - 1, ty_ - 4, GOLD[4]); part.set(tx_ - 1, ty_ - 1, GOLD[3])
        part.set(tx_ + 2, ty_, GOLD[1]); part.set(tx_, ty_ + 2, GOLD[1])
        part.set(tx_ - 1, ty_, '#7ad0ff'); part.set(tx_, ty_, '#3a8ef0')
        stamp(c, part, outline='#5a2a14')
        sparkle(c, tx_ - 3, ty_ - 4, ('#ffffff', '#ffe27a'))
        c.set(tx_ + 3, ty_ - 3, '#fff6c8'); c.set(tx_ - 4, ty_ + 2, '#fff3a8')
    else:
        part = L()
        top = (hxp + 1, hyp - 14)
        bar(part, (hxp + 1, hyp + 10 - p['ty']), top, 2.2, GST)
        tx_, ty_ = top
        part.rect(int(tx_) - 2, int(ty_) - 1, 5, 2, GOLD[2])
        part.rect(int(tx_) - 1, int(ty_) - 4, 2, 7, GOLD[2])
        part.set(tx_ - 2, ty_ - 1, GOLD[4]); part.set(tx_ - 1, ty_ - 4, GOLD[4]); part.set(tx_ - 1, ty_ - 1, GOLD[3])
        part.set(tx_ + 2, ty_, GOLD[1]); part.set(tx_, ty_ + 2, GOLD[1])
        part.set(tx_ - 1, ty_, '#7ad0ff'); part.set(tx_, ty_, '#3a8ef0')
        stamp(c, part, outline='#5a2a14')
        c.set(tx_ + 3, ty_ - 3 + (1 if kind == 'w1' else 0), '#fff6c8')
    arm(c, (22 + ox, 21 + oy), p['fh'], CLOTH_W, cuff=GOLD)
    return c


# ---------------------------------------------------------------- 6. lancier

def r_lancer(kind):
    wind = kind == 'wind'
    over = dict(tx=-1, hx=-2, fh=(20, 24), bh=(14, 25), bf=(11, 0), ff=(23, 0)) if wind else {}
    p = pose(kind, **over)
    c = L()
    ox, oy = p['tx'], p['ty']
    hx, hy = p['hx'], p['hy']
    cape(c, p, RED, length=35, back=7)
    if not wind:
        arm(c, (14 + ox, 21 + oy), p['bh'], DSTEEL, HAND=DLEATHER, far=True)
    legs(c, p, DSTEEL, DSTEEL)

    def det(t, ox, oy):
        for x in range(12 + ox, 26 + ox):
            t.setf(x, 27 + oy, RED[1]); t.setf(x, 28 + oy, RED[0])
        t.setf(19 + ox, 27 + oy, GOLD[2])
        for y in range(20 + oy, 26 + oy):
            t.setf(20 + ox, y, DSTEEL[1])
        t.setf(15 + ox, 21 + oy, DSTEEL[4]); t.setf(14 + ox, 22 + oy, DSTEEL[3])
    torso(c, p, DSTEEL, detail=det)
    pw = {'w1': -1, 'w2': 0, 'wind': 1}[kind]
    part = L()
    pm = m_poly([(17 + hx, 3 + hy), (20 + hx, -0.5 + hy), (14 + hx, -0.5 + hy), (7 + hx + pw, 0.5 + hy), (2 + hx + pw, 5 + hy),
                 (1 + hx + pw * 2, 13 + hy + pw), (5 + hx + pw, 8 + hy), (10 + hx, 5 + hy)])
    shade(part, pm, RED, contrast=0.5)
    for x in range(7, 16):
        part.setf(x + hx, 1 + hy + (1 if x < 10 else 0), RED[4])
    stamp(c, part)
    part = L()
    m = m_ell(18.5 + hx, 10.2 + hy, 8.6, 8.4)
    m |= m_poly([(12 + hx, 14 + hy), (27 + hx, 13 + hy), (26 + hx, 19 + hy), (13 + hx, 19 + hy)])
    shade(part, m, HELM, contrast=0.5)
    for x in range(17, 28):
        part.setf(x + hx, 10 + hy, INK); part.setf(x + hx, 11 + hy, INK)
        part.setf(x + hx, 9 + hy, DSTEEL[4] if x < 23 else DSTEEL[3])
        part.setf(x + hx, 12 + hy, DSTEEL[2])
    for ex in (19, 24):
        part.setf(ex + hx, 10 + hy, '#ffe8a0'); part.setf(ex + 1 + hx, 10 + hy, '#ff7a3a')
        part.setf(ex + hx, 11 + hy, '#ff7a3a')
    for y in range(13, 18):
        part.setf(24 + hx, y + hy, DSTEEL[1])
        for x in (21, 23, 26):
            if y % 2:
                part.setf(x + hx, y + hy, INK)
    for x in range(10, 28):
        part.setf(x + hx, 6 + hy, GOLD[2] if x < 20 else GOLD[1])
    part.setf(13 + hx, 4 + hy, DSTEEL[4]); part.setf(12 + hx, 5 + hy, DSTEEL[4])
    stamp(c, part)
    hxp, hyp = p['fh']
    part = L()
    if wind:  # lance ramenée en arrière, à l'horizontale, prête à jaillir
        x0, x1 = 0, hxp + 4
        stick(part, (x0, hyp), (x1, hyp), (WOOD[0], WOOD[1], WOOD[2], WOOD[3]), w=1)
        part.line(x0, hyp + 1, x1, hyp + 1, WOOD[1])
        blade(part, (x1, hyp + 0.5), (x1 + 7.5, hyp + 0.5), 3.4, [STEEL[1], STEEL[2], STEEL[3], STEEL[4]])
        part.set(x1, hyp - 1, RED[3]); part.set(x1, hyp + 2, RED[2]); part.set(x1 - 1, hyp + 2, RED[1])
    else:
        sx = hxp + 1
        part.line(sx, 38, sx, 8, WOOD[2]); part.line(sx + 1, 38, sx + 1, 8, WOOD[1])
        blade(part, (sx + 0.5, 8), (sx + 0.5, 0), 3.4, [STEEL[1], STEEL[2], STEEL[3], STEEL[4]])
        part.set(sx - 1, 8, RED[3]); part.set(sx + 2, 8, RED[2]); part.set(sx - 1, 9, RED[2])
    stamp(c, part)
    if wind:
        arm(c, (15 + ox, 22 + oy), p['bh'], DSTEEL, HAND=DLEATHER, far=True)
    arm(c, (22 + ox, 21 + oy), p['fh'], DSTEEL, HAND=DLEATHER, cuff=RED)
    part = L()
    ball(part, 22 + ox, 20.5 + oy, 3.0, 2.4, DSTEEL)
    part.setf(22 + ox, 20 + oy, RED[3])
    stamp(c, part)
    if wind:
        c.set(hxp + 12, hyp - 1, '#ffd0b0'); c.set(hxp + 13, hyp, '#ffffff')
    return c


# ---------------------------------------------------------------- 7. ombre (assassin)

def r_shadow(kind):
    wind = kind == 'wind'
    over = dict(tx=-1, ty=1, hx=-2, hy=1, fh=(18, 25), bh=(12, 25), bf=(11, 0), ff=(24, 0)) if wind else {}
    p = pose(kind, **over)
    c = L()
    ox, oy = p['tx'], p['ty']
    hx, hy = p['hx'], p['hy']
    DG = [PURPLE[1], '#b070ff', '#e0b8ff', '#ffffff']
    part = L()
    sw = {'w1': -1, 'w2': 1, 'wind': 2}[kind]
    m = m_poly([(15 + ox, 17 + oy), (9, 17 + sw), (2, 15 + sw), (5, 18 + sw), (1, 21 + sw), (8, 20.5 + sw),
                (15 + ox, 20 + oy)])
    shade(part, m, PURPLE, contrast=0.5)
    stamp(c, part)
    if wind:  # dague arrière tenue à revers, pointe vers l'arrière
        dagger(c, p['bh'], (-1, -0.35), DG, '#ffffff')
    else:
        dagger(c, p['bh'], (0.15, 1), DG, None)
    arm(c, (14 + ox, 21 + oy), p['bh'], SHADOW, HAND=SHADOW, far=True)
    legs(c, p, SHADOW, PURPLE)

    def det(t, ox, oy):
        for x in range(12 + ox, 26 + ox):
            t.setf(x, 26 + oy, PURPLE[2]); t.setf(x, 27 + oy, PURPLE[1])
        t.setf(20 + ox, 26 + oy, '#d8b0ff')
        t.line(14 + ox, 20 + oy, 21 + ox, 26 + oy, PURPLE[1])
        t.setf(17 + ox, 23 + oy, '#e0e0f0')
    torso(c, p, SHADOW, detail=det, contrast=0.45)
    head(c, p, EYE_VIOLET, mood='atk' if wind else 'idle', mouth=False, blush=False)
    ear(c, p)
    hair(c, p, SILVER_HAIR, bang=6, bang_pat=(0, 1, 0, 2, 0, 1),
         spikes=[[(12, 4), (5, 2), (11, 1)], [(10, 9), (1 + sw * 0.5, 10), (10, 13)], [(10, 13), (3 + sw * 0.5, 17), (11, 16)],
                 [(15, 2), (16, -1), (20, 2)], [(21, 2), (25, 0), (24, 4)]])
    part = L()
    m = {(x, y) for (x, y) in m_ell(21.5 + hx, 13.5 + hy, 6.2, 5.2) if y >= 13 + hy}
    m |= m_ell(19.5 + ox * 0.5 + hx * 0.5, 18.3 + oy, 5.2, 1.8)
    shade(part, m, PURPLE, contrast=0.45, bias=-0.05)
    for x in range(17, 27):
        part.setf(x + hx, 13 + hy, PURPLE[3] if x < 22 else PURPLE[2])
    stamp(c, part)
    hxp, hyp = p['fh']
    if wind:
        dagger(c, (hxp, hyp), (-1, 0.25), DG, '#ffffff')
        arm(c, (22 + ox, 21 + oy), p['fh'], SHADOW, HAND=SHADOW, cuff=PURPLE)
        c.set(hxp - 9, hyp + 1, '#c69cff'); c.set(p['bh'][0] - 8, p['bh'][1] - 4, '#f0d8ff')
    else:
        dagger(c, (hxp, hyp), (0.35, 1) if kind == 'w2' else (0.3, 1), DG, '#ffffff')
        arm(c, (22 + ox, 21 + oy), p['fh'], SHADOW, HAND=SHADOW, cuff=PURPLE)
    return c


# ---------------------------------------------------------------- 8. nain

def r_dwarf(kind):
    wind = kind == 'wind'
    if wind:
        over = dict(hy=3, fh=(19, 24), bh=(17, 26))
    else:
        over = dict(hy=4)
    p = pose(kind, **over)
    if not wind:
        p['fh'] = (p['fh'][0] + 1, p['fh'][1] + 1)
    c = L()
    ox, oy = p['tx'], p['ty']
    hx, hy = p['hx'], p['hy']
    hxp, hyp = p['fh']
    AX = [STEEL[0], STEEL[1], STEEL[2], STEEL[3], STEEL[4]]
    if wind:
        arm(c, (21 + ox, 23 + oy), p['bh'], BRONZE, HAND=SKIN, far=True, w=3.8)
    else:
        arm(c, (13 + ox, 23 + oy), (11 + ox + (p['bh'][0] - 12) // 2, 30 + oy), BRONZE, HAND=SKIN, far=True, w=3.8)
    legs(c, p, BROWN_HAIR, LEATHER, hip=32, hips=(15.5, 21), boot_h=3)

    def det(t, ox, oy):
        for x in range(10 + ox, 28 + ox):
            t.setf(x, 30 + oy, LEATHER[1]); t.setf(x, 31 + oy, LEATHER[0])
        t.rect(17 + ox, 30 + oy, 4, 2, GOLD[2])
        t.setf(17 + ox, 30 + oy, GOLD[4]); t.setf(20 + ox, 31 + oy, GOLD[0])
        for x in range(11 + ox, 27 + ox, 3):
            t.setf(x, 28 + oy, BRONZE[1])
    torso(c, p, BRONZE, top=20, bot=33, wt=15, wb=17, detail=det, contrast=0.45)
    head(c, p, EYE_BROWN, mouth=False, blush=False, eyes=False)
    face(c, hx, hy, EYE_BROWN, 'atk' if wind else 'idle', mouth=False, blush=False)
    c.set(16 + hx, 14 + hy, BLUSH); c.set(26 + hx, 14 + hy, BLUSH)
    part = L()
    sw = {'w1': -1, 'w2': 0, 'wind': 1}[kind]  # la barbe suit le mouvement
    m = m_poly([(14 + hx, 14 + hy), (17 + hx, 16 + hy), (21 + hx, 16 + hy), (25 + hx, 15 + hy), (28 + hx, 13 + hy),
                (28 + hx, 18 + hy), (26 + hx + sw, 23 + hy), (22 + hx + sw, 28 + hy), (18 + hx, 25 + hy),
                (15 + hx, 20 + hy)])
    for (x, y) in m:
        u = (x - 14 - hx) / 14
        v = 0.75 - u * 0.45 - (y - 14 - hy) * 0.025
        col = GINGER[min(4, max(0, int(v * 5)))]
        if (x * 2 + y) % 5 == 0 and y > 17 + hy:
            col = GINGER[1]
        if (x * 2 + y) % 5 == 2 and y > 16 + hy and u < 0.6:
            col = GINGER[3]
        part.set(x, y, col)
    for x in range(18, 28):
        part.set(x + hx, 15 + hy if 19 < x < 26 else 16 + hy, GINGER[4] if x < 22 else GINGER[3])
    part.set(22 + hx + sw, 26 + hy, GOLD[3]); part.set(22 + hx + sw, 27 + hy, GOLD[1])
    stamp(c, part)
    c.set(22 + hx, 14 + hy, SKIN[1]); c.set(23 + hx, 14 + hy, SKIN[1])
    c.set(22 + hx, 13 + hy, SKIN[3])
    part = L()
    m = {(x, y) for (x, y) in m_ell(18.5 + hx, 10.2 + hy, 8.9, 8.4) if y <= 8 + hy}
    m |= m_poly([(10 + hx, 8 + hy), (16 + hx, 8 + hy), (16 + hx, 14 + hy), (11 + hx, 13 + hy)])
    m |= {(21 + hx, 9 + hy), (21 + hx, 10 + hy), (21 + hx, 11 + hy)}
    shade(part, m, BRONZE, contrast=0.5)
    for x in range(9, 29):
        part.setf(x + hx, 8 + hy, BRONZE[3] if x < 18 else BRONZE[2])
        part.setf(x + hx, 7 + hy, BRONZE[1] if x % 3 else GOLD[3])
    part.setf(21 + hx, 9 + hy, BRONZE[3]); part.setf(21 + hx, 11 + hy, BRONZE[1])
    part.setf(14 + hx, 2 + hy, BRONZE[4]); part.setf(13 + hx, 3 + hy, BRONZE[4]); part.setf(15 + hx, 2 + hy, BRONZE[4])
    stamp(c, part)
    part = L()
    hm = m_poly([(11 + hx, 4 + hy), (7 + hx, 3 + hy), (4 + hx, -1 + hy), (5 + hx, 3 + hy), (9 + hx, 7 + hy)])
    shade(part, hm, ['#6a5a4a', '#a8988a', '#d8d0c0', '#f4f0e6', '#ffffff'])
    stamp(c, part)
    if wind:  # hache levée derrière la tête : manche en diagonale, fer vers l'arrière
        a0, a1 = (hxp + 3, hyp + 4), (hxp - 9, hyp - 13)
        part = L()
        bar(part, a0, a1, 2.4, (WOOD[1], WOOD[2], WOOD[3]))
        stamp(c, part)
        part = L()
        hm = m_poly([(a1[0] + 1, a1[1] + 1), (a1[0] - 2, a1[1] + 5), (a1[0] - 6, a1[1] + 6), (a1[0] - 9, a1[1] + 1),
                     (a1[0] - 8, a1[1] - 5), (a1[0] - 3, a1[1] - 3), (a1[0] - 1, a1[1] - 1)])
        hm |= m_poly([(a1[0] + 1, a1[1] - 1), (a1[0] + 3, a1[1] - 4), (a1[0] + 5, a1[1] - 1), (a1[0] + 2, a1[1] + 1)])
        shade(part, hm, AX, contrast=0.45)
        for (x, y) in hm:
            if (x - 1, y) not in hm and x < a1[0] - 4:
                part.set(x, y, '#ffffff')
        part.setf(a1[0], a1[1], GOLD[2]); part.setf(a1[0] - 1, a1[1] + 1, GOLD[1])
        stamp(c, part)
    else:
        part = L()
        sx = hxp + 1
        bar(part, (sx, 37), (sx, 10 + p['ty']), 2.4, (WOOD[1], WOOD[2], WOOD[3]))
        stamp(c, part)
        part = L()
        ty0 = 10 + p['ty']
        hm = m_poly([(sx, ty0 + 0), (sx + 4, ty0 - 3), (sx + 8, ty0 - 2), (sx + 8.5, ty0 + 5), (sx + 7, ty0 + 9),
                     (sx + 3.5, ty0 + 6), (sx, ty0 + 6)])
        hm |= m_poly([(sx, ty0 + 1), (sx - 3, ty0 - 1), (sx - 3, ty0 + 5), (sx, ty0 + 4)])
        shade(part, hm, AX, contrast=0.45)
        for (x, y) in hm:
            if (x + 1, y) not in hm and x > sx + 4:
                part.set(x, y, '#ffffff')
        part.setf(sx + 1, ty0 + 2, GOLD[2]); part.setf(sx + 1, ty0 + 3, GOLD[1])
        stamp(c, part)
    arm(c, (24 + ox, 23 + oy), p['fh'], BRONZE, HAND=SKIN, cuff=LEATHER, w=3.8)
    return c


R_ALLIES = [('squire', r_squire), ('mercenary', r_mercenary), ('ranger', r_ranger), ('pyromancer', r_pyromancer),
            ('priestess', r_priestess), ('lancer', r_lancer), ('shadow', r_shadow), ('dwarf', r_dwarf)]
R_ALLIES = [(aid, _bind(fn, allies_r, pose=_r_pose, cape=_bind(_r_cape, allies_r), _r_sword=_bind(_r_sword, allies_r),
                        _unit=_unit))
            for aid, fn in R_ALLIES]


# ================================================================ SR (allies_sr, 40×40)

# t / h : décalage buste / tête ; bf / ff : (dx, levée) des pieds arrière / avant ;
# nh / fa : décalage de la main proche / lointaine ; sw : traîne des cheveux et étoffes (<0 vers l'arrière).
SR_POSE = {
    'w1': dict(t=(0, 1), h=(0, 1), bf=(-4, 1), ff=(3, 0), mode='walk', fr=1, nh=(-2, 1), fa=(2, 0), sw=-1),
    'w2': dict(t=(0, 1), h=(0, 1), bf=(5, 0), ff=(-6, 1), mode='walk', fr=2, nh=(2, -1), fa=(-2, -1), sw=-2),
    'wind': dict(t=(-1, 0), h=(-2, 0), bf=(-3, 0), ff=(2, 0), mode='wind', fr=0, nh=(0, 0), fa=(1, -1), sw=1),
}


def _dir(deg, d):
    """Point à distance d dans la direction `deg` de place() (0 = haut, 90 = droite)."""
    a = math.radians(deg)
    return (math.sin(a) * d, -math.cos(a) * d)


def _gather(fx, cx, cy, R, r=5, n=6, k0=0):
    """Particules qui convergent vers (cx, cy) : la charge avant le coup."""
    for i in range(n):
        a = math.radians(i * 360 / n + 15 + k0)
        rr = r + (i % 2) * 1.5
        x, y = int(round(cx + math.cos(a) * rr)), int(round(cy + math.sin(a) * rr))
        fx[(x, y)] = R[-2] if i % 2 else R[-3]


# ---------------------------------------------------------------- 1. paladin d'azur

def sr_azure_paladin(P):
    sp = Sprite()
    tx, ty = P['t']
    hx, hy = P['h']
    wind = P['mode'] == 'wind'
    s = P['sw']
    nx_, ny_ = P['nh']
    fx_, fy_ = P['fa']
    cape = m_poly([(13 + tx, 19 + ty), (19 + tx, 19 + ty), (17 + tx, 31 + ty), (11 + tx + s, 33 + ty), (9 + tx + s, 31 + ty)])
    lay = shade(cape, dk(PAL_ARM))
    for y in range(29 + ty, 34 + ty):
        for x in range(6, 18):
            if (x, y) in cape and (x, y + 1) not in cape:
                lay[(x, y)] = GOLD[1]
    sp.put(lay)
    bh = (12 + tx + fx_, 27 + ty + fy_)
    arm(sp, [(15 + tx, 21 + ty), (13 + tx, 24 + ty), bh], PAL_ARM, STEEL, far=True)
    legs(sp, P, PAL_ARM, STEEL, cuff=GOLD)
    skirt = m_poly([(13.5 + tx, 27 + ty), (23.5 + tx, 27 + ty), (25 + tx, 32 + ty), (12 + tx, 32 + ty)])
    lay = shade(skirt, PAL_ARM)
    for x in range(11 + tx, 26 + tx):
        if (x, 31 + ty) in skirt:
            lay[(x, 31 + ty)] = GOLD[2] if x < 19 + tx else GOLD[1]
    for y in range(28 + ty, 32 + ty):
        lay[(18 + tx, y)] = PAL_ARM[0]
    sp.put(lay)
    lay = ball(18.5 + tx, 23.5 + ty, 5.6, 5.4, PAL_ARM)
    for x in range(13 + tx, 25 + tx):
        if (x, 27 + ty) in lay:
            lay[(x, 27 + ty)] = GOLD[2] if x < 20 + tx else GOLD[1]
    lay[(19 + tx, 27 + ty)] = GOLD[4]
    lay[(20 + tx, 22 + ty)] = GOLD[3]; lay[(20 + tx, 23 + ty)] = GOLD[2]; lay[(21 + tx, 23 + ty)] = GOLD[1]
    lay[(19 + tx, 23 + ty)] = GOLD[3]; lay[(20 + tx, 24 + ty)] = GOLD[1]
    sp.put(lay)
    bang = {15: 16, 16: 14, 17: 9, 18: 8, 19: 9, 20: 7, 21: 9, 22: 8, 23: 7, 24: 9, 25: 8, 26: 9, 27: 11}
    spikes = m_spikes(19, 10, 8, [(-160, 3, 12), (-130, 3, 12), (-100, 2.5, 12), (-70, 2, 12), (-40, 2, 12),
                                  (175, 2.5, 10), (150, 2, 10)])
    head(sp, P, SKIN, PAL_HAIR, PAL_EYE, bang=bang, girl=False, mouth='calm' if wind else 'smile', brow=PAL_HAIR[0],
         hair_mask_extra=spikes)
    lay = {}
    for x in range(16, 27):
        lay[(x + hx, 6 + hy)] = GOLD[3] if x < 21 else GOLD[2]
    lay[(21 + hx, 5 + hy)] = PAL_BLADE[3]; lay[(21 + hx, 6 + hy)] = PAL_BLADE[1]; lay[(22 + hx, 6 + hy)] = GOLD[1]
    sp.put(lay)
    lay = ball(22.5 + tx, 20 + ty, 3.6, 2.8, PAL_ARM)
    for x in range(19 + tx, 27 + tx):
        if (x, 22 + ty) in lay:
            lay[(x, 22 + ty)] = GOLD[2] if x < 23 + tx else GOLD[1]
    sp.put(lay)
    scx, scy = 10.5 + tx + fx_, 27 + ty + fy_
    lay = ball(scx, scy, 5.2, 5.6, GOLD)
    inner = ball(scx + 0.2, scy + 0.1, 4.0, 4.4, PAL_ARM)
    lay.update(inner)
    for d in (-2, -1, 0, 1, 2):
        lay[(int(scx) + d, int(scy))] = GOLD[2] if d < 1 else GOLD[1]
        lay[(int(scx), int(scy) + d)] = GOLD[3] if d < 0 else GOLD[1]
    lay[(int(scx), int(scy))] = GOLD[4]
    lay[(int(scx) - 2, int(scy) - 3)] = PAL_ARM[4]
    sp.put(lay)
    it, g = sword_item(12, PAL_BLADE, GOLD, LEATHER, pommel=PAL_BLADE)
    if wind:  # épée levée par-dessus l'épaule, pointe vers l'arrière
        hand, deg = (20 + tx, 20 + ty), -52
        sp.put(place(it, g, hand, deg))
        arm(sp, [(22 + tx, 21 + ty), (22 + tx, 22 + ty), hand], PAL_ARM, STEEL, cuff=GOLD)
    else:
        hand = (25 + tx + nx_, 27 + ty + ny_)
        arm(sp, [(22 + tx, 21 + ty), (24 + tx, 24 + ty), hand], PAL_ARM, STEEL, cuff=GOLD)
        sp.put(place(it, g, (hand[0] + 1, hand[1]), 22))
    c = sp.finish()
    fx = {}
    if wind:
        tdx, tdy = _dir(deg, 14)
        _gather(fx, hand[0] + tdx, hand[1] + tdy, PAL_FX, r=3)
    else:
        f = P['fr']
        for (x, y) in ((27, 8 - f), (29, 14 + f), (26, 4 + f)):
            fx[(x + tx, y + ty)] = PAL_FX[5 if (x + f) % 2 else 4]
        fx[(23 + tx, 6 + 2 * f)] = PAL_FX[3]
    sp.fx(fx)
    return c


# ---------------------------------------------------------------- 2. lame rose

def sr_rose_blade(P):
    sp = Sprite()
    tx, ty = P['t']
    hx, hy = P['h']
    wind = P['mode'] == 'wind'
    s = P['sw']
    nx_, ny_ = P['nh']
    fx_, fy_ = P['fa']
    t1 = [(14, 5), (9, 6), (5 + s * 0.5, 10), (3 + s, 16), (4 + s, 22), (6 + s * 1.5, 26)]
    t2 = [(15, 8), (11, 11), (9 + s * 0.5, 16), (9 + s, 22), (11 + s * 1.5, 27)]
    for pts, ws, R in ((t2, [3, 4, 4, 3, 1], dk(ROSE_HAIR)), (t1, [3, 4.5, 5, 4.5, 3, 1], ROSE_HAIR)):
        m = m_tube([(x + hx, y + hy) for x, y in pts], ws)
        lay = shade(m, R)
        for i, (x, y) in enumerate(pts[1:-1]):
            lay[(int(x + hx + 1), y + hy)] = R[3]
        sp.put(lay)
    arm(sp, [(15 + tx, 21 + ty), (13 + tx, 24 + ty), (12 + tx + fx_, 27 + ty + fy_)], ROSE_ARM, ROSE_ARM, far=True)
    legs(sp, P, ['#1a1428', '#2a2240', '#3a3058', '#4e4474', '#6a5e94'], ROSE_ARM, cuff=ROSE_PINK, boot_h=4)
    skirt = m_poly([(14 + tx, 26 + ty), (23 + tx, 26 + ty), (26 + tx, 32 + ty), (11 + tx, 32 + ty)])
    lay = shade(skirt, ROSE_ARM)
    for x in range(10 + tx, 27 + tx):
        if (x, 31 + ty) in skirt:
            lay[(x, 31 + ty)] = ROSE_PINK[2] if x < 20 + tx else ROSE_PINK[1]
    for x in (15, 18, 21, 24):
        for y in range(28, 31):
            if (x + tx, y + ty) in skirt:
                lay[(x + tx, y + ty)] = ROSE_ARM[0]
    sp.put(lay)
    body = m_poly([(14 + tx, 18 + ty), (23 + tx, 18 + ty), (23 + tx, 27 + ty), (14 + tx, 27 + ty)])
    lay = shade(body, ROSE_ARM)
    for y in range(20 + ty, 27 + ty):
        lay[(19 + tx, y)] = ROSE_PINK[2]
    lay[(18 + tx, 21 + ty)] = ROSE_PINK[3]; lay[(20 + tx, 21 + ty)] = ROSE_PINK[1]
    for x in range(14 + tx, 24 + tx):
        lay[(x, 26 + ty)] = ROSE_PINK[0] if x > 19 + tx else ROSE_PINK[1]
    lay[(19 + tx, 26 + ty)] = GOLD[3]
    sp.put(lay)
    bang = {15: 16, 16: 13, 17: 9, 18: 8, 19: 10, 20: 7, 21: 8, 22: 10, 23: 8, 24: 7, 25: 9, 26: 10, 27: 12}
    head(sp, P, SKIN, ROSE_HAIR, ROSE_EYE, bang=bang, girl=True, mouth='calm' if wind else 'smile', brow=wind)
    lay = {}
    for (x, y), col in (((13, 4), ROSE_BLADE[2]), ((14, 4), ROSE_BLADE[3]), ((12, 3), ROSE_BLADE[2]),
                        ((12, 5), ROSE_BLADE[1]), ((14, 6), ROSE_BLADE[1]), ((11, 3), ROSE_BLADE[1])):
        lay[(x + hx, y + hy)] = col
    sp.put(lay)
    lay = ball(22.5 + tx, 20 + ty, 3.4, 2.6, ROSE_ARM)
    lay[(20 + tx, 19 + ty)] = ROSE_PINK[3]; lay[(21 + tx, 18 + ty)] = ROSE_PINK[2]
    for x in range(19 + tx, 26 + tx):
        if (x, 22 + ty) in lay:
            lay[(x, 22 + ty)] = ROSE_PINK[1]
    sp.put(lay)
    it, g = sword_item(11, ROSE_BLADE, ROSE_PINK, ROSE_ARM, width=3, pommel=GOLD)
    if wind:  # lame ramenée en arrière, pointe vers le bas : prête à remonter en diagonale
        hand, deg = (17 + tx, 25 + ty), -118
        sp.put(place(it, g, hand, deg))
        arm(sp, [(22 + tx, 21 + ty), (20 + tx, 24 + ty), hand], ROSE_ARM, ROSE_ARM, cuff=ROSE_PINK)
    else:
        hand = (24 + tx + nx_, 27 + ty + ny_)
        arm(sp, [(22 + tx, 21 + ty), (24 + tx, 24 + ty), hand], ROSE_ARM, ROSE_ARM, cuff=ROSE_PINK)
        sp.put(place(it, g, (hand[0] + 1, hand[1]), 125))
    c = sp.finish()
    fx = {}
    if wind:
        tdx, tdy = _dir(deg, 13)
        _gather(fx, hand[0] + tdx, hand[1] + tdy, ROSE_FX, r=3)
        fx[(33, 12)] = ROSE_PINK[3]; fx[(34, 12)] = ROSE_PINK[2]
    else:
        f = P['fr']
        fx[(35, 35 - f)] = ROSE_PINK[3]; fx[(36, 35 - f)] = ROSE_PINK[2]
        fx[(31, 30 + f)] = ROSE_FX[5]
        fx[(5 + tx, 3 + f)] = ROSE_PINK[3]
    sp.fx(fx)
    return c


# ---------------------------------------------------------------- 3. sorcière

def sr_witch(P):
    sp = Sprite()
    tx, ty = P['t']
    hx, hy = P['h']
    wind = P['mode'] == 'wind'
    s = P['sw']
    nx_, ny_ = P['nh']
    fx_, fy_ = P['fa']
    hair_back = m_poly([(12 + hx, 8 + hy), (17 + hx, 10 + hy), (17 + tx, 31 + ty), (13 + tx + s, 32 + ty),
                        (9 + tx + s, 30 + ty), (8 + hx, 18 + hy)])
    lay = shade(hair_back, WIT_HAIR)
    for y in range(14, 31):
        for x in (12, 14):
            p = (x + tx + (y % 3 == 0), y + ty)
            if p in hair_back and (p[0] + 1, p[1]) in hair_back:
                lay[p] = WIT_HAIR[1]
    sp.put(lay)
    arm(sp, [(15 + tx, 21 + ty), (13 + tx, 25 + ty), (13 + tx + fx_, 28 + ty + fy_)], WIT_DRESS, SKIN, far=True, width=3.6)
    legs(sp, P, WIT_DRESS, ['#1a1028', '#2c1c40', '#46305e', '#644a84', '#8a70ac'], boot_h=3)
    dress = m_poly([(14 + tx, 18 + ty), (23 + tx, 18 + ty), (24 + tx, 25 + ty), (27 + tx, 36 + ty), (24 + tx, 37 + ty),
                    (18 + tx, 37.5 + ty), (12 + tx, 37 + ty), (9 + tx + s, 36 + ty), (13 + tx, 25 + ty)])
    lay = shade(dress, WIT_DRESS)
    for (x, y) in list(dress):
        if (x, y + 1) not in dress:
            lay[(x, y)] = GOLD[2] if x < 19 + tx else GOLD[1]
            if (x, y - 1) in dress:
                lay[(x, y - 1)] = WIT_DRESS[0]
    for y in range(29 + ty, 36 + ty):
        lay[(15 + tx - (y - 29 - ty) // 3, y)] = WIT_DRESS[1]
        lay[(21 + tx + (y - 29 - ty) // 3, y)] = WIT_DRESS[1]
    for x in range(13 + tx, 25 + tx):
        if (x, 25 + ty) in lay:
            lay[(x, 25 + ty)] = WIT_HAT[0]
    lay[(19 + tx, 25 + ty)] = GOLD[3]; lay[(20 + tx, 25 + ty)] = GOLD[2]
    for x in range(17 + tx, 23 + tx):
        lay[(x, 19 + ty)] = WIT_HAIR[3]
    sp.put(lay)
    bang = {15: 17, 16: 16, 17: 10, 18: 9, 19: 8, 20: 9, 21: 8, 22: 9, 23: 8, 24: 9, 25: 9, 26: 12, 27: 16}
    side = [(27, y) for y in range(10, 20)] + [(28, y) for y in range(12, 19)] + [(26, y) for y in range(17, 21)]
    head(sp, P, SKIN, WIT_HAIR, WIT_EYE, bang=bang, girl=True, mouth='calm' if wind else 'smile',
         hair_mask_extra=side)
    brim = m_ellipse(19.5 + hx, 6.5 + hy, 12, 2.4)
    cone = m_poly([(12 + hx, 6.5 + hy), (26 + hx, 6.5 + hy), (23 + hx, 2 + hy), (19 + hx, -0.5 + hy),
                   (13 + hx, -1 + hy), (8 + hx + s, 1 + hy + (1 if s > 0 else 0)), (14 + hx, 2 + hy)])
    cone = {p for p in cone if p[1] >= 0}
    lay = shade(brim, WIT_HAT)
    lay.update(shade(cone, WIT_HAT))
    for x in range(12 + hx, 27 + hx):
        if (x, 5 + hy) in cone:
            lay[(x, 5 + hy)] = GOLD[2] if x < 20 + hx else GOLD[1]
            lay[(x, 4 + hy)] = WIT_HAT[0] if (x, 4 + hy) in cone else lay.get((x, 4 + hy))
    for x in range(12 + hx, 27 + hx):
        if (x, 4 + hy) in lay and lay[(x, 4 + hy)] is None:
            del lay[(x, 4 + hy)]
    lay = {k: v for k, v in lay.items() if v is not None}
    lay[(18 + hx, 5 + hy)] = GOLD[4]; lay[(18 + hx, 4 + hy)] = GOLD[3]; lay[(19 + hx, 5 + hy)] = GOLD[3]
    lay[(17 + hx, 5 + hy)] = GOLD[3]; lay[(18 + hx, 6 + hy)] = GOLD[1]
    for x in range(8 + hx, 32 + hx):
        if (x, 8 + hy) in brim:
            lay[(x, 8 + hy)] = WIT_HAT[0]
    sp.put(lay)
    if wind:  # bâton basculé en arrière, l'orbe se charge derrière elle
        hand, deg = (21 + tx, 24 + ty), -58
        sp.put(place(staff_item(), (2, 14), hand, deg))
        arm(sp, [(22 + tx, 21 + ty), (23 + tx, 24 + ty), hand], WIT_DRESS, SKIN, width=3.6, cuff=GOLD)
        odx, ody = _dir(deg, 14)
        orb_c = (hand[0] + 0.5 + odx, hand[1] + 0.5 + ody)
    else:
        hand = (26 + tx + nx_, 27 + ty + ny_)
        st = place(staff_item(), (0, 14), hand, 0)
        sp.put(st)
        arm(sp, [(22 + tx, 21 + ty), (24 + tx, 25 + ty), hand], WIT_DRESS, SKIN, width=3.6, cuff=GOLD)
        orb_c = (hand[0] + 2.5, hand[1] - 14 + 0.5)
    c = sp.finish()
    fx = {}
    ox, oy = orb_c
    if wind:
        _gather(fx, ox, oy, WIT_FX, r=5, n=8)
        sparkle(fx, int(ox) - 1, int(oy) - 6, WIT_FX)
    else:
        f = P['fr'] % 2
        for x, y in ((int(ox) - 3, int(oy) - 2 + f), (int(ox) + 3, int(oy) + 1 - f), (int(ox) + 1, int(oy) - 4)):
            fx[(x, y)] = WIT_FX[5 if (x + f) % 2 else 4]
    sp.fx(fx)
    return c


# ---------------------------------------------------------------- 4. archère elfe

def sr_elf_archer(P):
    sp = Sprite()
    tx, ty = P['t']
    hx, hy = P['h']
    wind = P['mode'] == 'wind'
    s = P['sw']
    nx_, ny_ = P['nh']
    fx_, fy_ = P['fa']
    q = m_poly([(9 + tx, 15 + ty), (12 + tx, 13 + ty), (17 + tx, 27 + ty), (14 + tx, 29 + ty)])
    lay = shade(q, LEATHER)
    for p in ((10, 13), (9, 12), (11, 11), (10, 10), (12, 12), (12, 10)):
        lay[(p[0] + tx, p[1] + ty)] = ELF_GRN[3] if p[1] % 2 else ELF_GRN[2]
    lay[(10 + tx, 17 + ty)] = GOLD[2]; lay[(11 + tx, 16 + ty)] = GOLD[3]
    sp.put(lay)
    hb = m_tube([(14 + hx, 9 + hy), (12 + hx, 14 + hy), (12 + tx + s, 20 + ty), (13 + tx + s * 1.5, 25 + ty)],
                [6, 5.5, 3.5, 1.5])
    lay = shade(hb, ELF_HAIR)
    for y in range(15, 25, 2):
        p = (12 + tx + s, y + ty)
        if p in hb:
            lay[p] = ELF_HAIR[1]
    sp.put(lay)
    cape = m_poly([(13 + tx, 18 + ty), (18 + tx, 18 + ty), (15 + tx, 28 + ty), (10 + tx + s, 29 + ty)])
    sp.put(shade(cape, dk(ELF_GRN)))
    if wind:
        arm(sp, [(16 + tx, 21 + ty), (19 + tx, 22 + ty), (22 + tx, 21 + ty)], ELF_LEA, SKIN, far=True)
    else:
        arm(sp, [(15 + tx, 21 + ty), (13 + tx, 24 + ty), (13 + tx + fx_, 27 + ty + fy_)], ELF_LEA, SKIN, far=True)
    legs(sp, P, ['#3a2a20', '#5a4232', '#7a5c44', '#9a7a5a', '#c0a07a'], ELF_LEA, boot_h=5, cuff=ELF_GRN)
    tun = m_poly([(14 + tx, 18 + ty), (23 + tx, 18 + ty), (24 + tx, 31 + ty), (21 + tx, 32 + ty), (18 + tx, 31 + ty),
                  (15 + tx, 32 + ty), (13 + tx, 31 + ty)])
    lay = shade(tun, ELF_GRN)
    vest = m_poly([(14 + tx, 19 + ty), (23 + tx, 19 + ty), (23 + tx, 27 + ty), (14 + tx, 27 + ty)])
    lay.update(shade(vest, ELF_LEA))
    for y in range(19 + ty, 27 + ty):
        lay[(20 + tx, y)] = ELF_GRN[2] if y < 23 + ty else ELF_LEA[0]
    for x in range(14 + tx, 24 + tx):
        lay[(x, 26 + ty)] = LEATHER[0]
    lay[(18 + tx, 26 + ty)] = GOLD[3]; lay[(19 + tx, 26 + ty)] = GOLD[2]
    for i in range(7):
        lay[(16 + tx + i, 19 + ty + i)] = LEATHER[1]
    lay[(19 + tx, 22 + ty)] = GOLD[3]
    sp.put(lay)
    bang = {15: 16, 16: 15, 17: 9, 18: 8, 19: 7, 20: 8, 21: 9, 22: 7, 23: 8, 24: 9, 25: 9, 26: 10, 27: 13}
    face, hairm = head(sp, P, SKIN, ELF_HAIR, ELF_EYE, bang=bang, girl=True, mouth='calm' if wind else 'smile',
                       hair_mask_extra=[(26, 12), (27, 12), (27, 11), (26, 11)])
    ear = m_poly([(15 + hx, 11 + hy), (16.5 + hx, 13 + hy), (14.5 + hx, 14 + hy), (9 + hx, 8 + hy)])
    lay = shade(ear, SKIN)
    lay[(13 + hx, 11 + hy)] = SKIN[1]; lay[(14 + hx, 12 + hy)] = SKIN[1]
    sp.put(lay)
    lay = {}
    for (x, y), col in (((17, 3), ELF_GRN[3]), ((18, 3), ELF_GRN[2]), ((18, 2), ELF_GRN[4]), ((19, 2), ELF_GRN[3]),
                        ((16, 4), ELF_GRN[2]), ((17, 4), ELF_GRN[1]), ((20, 1), ELF_GRN[3]), ((15, 4), GOLD[3])):
        lay[(x + hx, y + hy)] = col
    sp.put(lay)
    if wind:  # arc levé, flèche encochée, corde à demi tirée
        hand = (27 + tx, 22 + ty)
        arm(sp, [(22 + tx, 21 + ty), (25 + tx, 22 + ty), hand], ELF_LEA, SKIN, cuff=ELF_GRN)
        sp.put(bow_layer(hand[0], hand[1], 12, 3, 3, string_x=23 + tx))
        sp.put(ball(23 + tx, 21 + ty, 1.6, 1.6, SKIN))
    else:
        hand = (25 + tx + nx_, 27 + ty + ny_)
        bow = bow_layer(hand[0] + 2, hand[1], 12, 3, 0)
        sp.put(bow)
        arm(sp, [(22 + tx, 21 + ty), (24 + tx, 25 + ty), hand], ELF_LEA, SKIN, cuff=ELF_GRN)
    c = sp.finish()
    fx = {}
    if wind:
        ay = hand[1] - 1
        for x in range(22 + tx, hand[0] + 6):
            fx[(x, ay)] = ELF_FX[4] if x > hand[0] else WOOD[3]
        fx[(hand[0] + 6, ay)] = ELF_FX[6]; fx[(hand[0] + 5, ay - 1)] = ELF_FX[4]; fx[(hand[0] + 5, ay + 1)] = ELF_FX[4]
        fx[(22 + tx, ay - 1)] = ELF_FX[3]; fx[(22 + tx, ay + 1)] = ELF_FX[3]
        sp.fx(fx, over=True)
        sp.fx({(hand[0] + 8, ay - 3): ELF_FX[5], (hand[0] + 6, ay + 4): ELF_FX[3]})
    else:
        fl = P['fr']
        fx[(5, 9 + fl)] = ELF_FX[5]; fx[(30 + tx, 20 - fl)] = ELF_FX[4]; fx[(31, 32 + fl)] = ELF_FX[3]
        sp.fx(fx)
    return c


# ---------------------------------------------------------------- 5. grand prêtre

def sr_high_priest(P):
    sp = Sprite()
    tx, ty = P['t']
    hx, hy = P['h']
    wind = P['mode'] == 'wind'
    s = P['sw']
    nx_, ny_ = P['nh']
    fx_, fy_ = P['fa']
    st = m_tube([(15 + tx, 20 + ty), (12 + tx + s * 0.5, 26 + ty), (10 + tx + s, 32 + ty)], [3, 3, 2.5])
    lay = shade(st, PRI_BLUE)
    lay[(10 + tx + s, 32 + ty)] = GOLD[2]; lay[(11 + tx + s, 32 + ty)] = GOLD[1]
    sp.put(lay)
    arm(sp, [(15 + tx, 21 + ty), (13 + tx, 25 + ty), (14 + tx + fx_, 28 + ty + fy_)], PRI_ROBE, SKIN, far=True, width=3.8)
    legs(sp, P, PRI_ROBE, ['#5a3a22', '#8a5a30', '#b88040', '#dca866', '#f4d090'], boot_h=2)
    robe = m_poly([(14 + tx, 18 + ty), (23 + tx, 18 + ty), (24 + tx, 27 + ty), (26 + tx, 37 + ty), (11 + tx + s, 37 + ty),
                   (13 + tx, 27 + ty)])
    lay = shade(robe, PRI_ROBE)
    for (x, y) in list(robe):
        if (x, y + 1) not in robe:
            lay[(x, y)] = GOLD[2] if x < 19 + tx else GOLD[1]
    for y in range(20 + ty, 37 + ty):
        lay[(20 + tx + (y - 20 - ty) // 8, y)] = GOLD[2]
        lay[(21 + tx + (y - 20 - ty) // 8, y)] = GOLD[1]
    for y in range(29 + ty, 36 + ty):
        lay[(16 + tx - (y - 29 - ty) // 3, y)] = PRI_ROBE[1]
    for x in range(13 + tx, 25 + tx):
        if (x, 26 + ty) in lay:
            lay[(x, 26 + ty)] = PRI_BLUE[2] if x < 20 + tx else PRI_BLUE[1]
    lay[(20 + tx, 26 + ty)] = GOLD[4]; lay[(21 + tx, 26 + ty)] = GOLD[2]
    sp.put(lay)
    cap = m_poly([(13 + tx, 18 + ty), (25 + tx, 18 + ty), (26 + tx, 22 + ty), (12 + tx, 22 + ty)])
    lay = shade(cap, PRI_ROBE)
    for x in range(12 + tx, 27 + tx):
        if (x, 22 + ty) in cap or (x, 21 + ty) in cap:
            lay[(x, 21 + ty)] = GOLD[3] if x < 19 + tx else GOLD[2]
    lay[(19 + tx, 21 + ty)] = PRI_BLUE[3]; lay[(20 + tx, 21 + ty)] = PRI_BLUE[2]
    sp.put(lay)
    bang = {15: 15, 16: 13, 17: 9, 18: 8, 19: 7, 20: 7, 21: 8, 22: 8, 23: 9, 24: 8, 25: 9, 26: 10, 27: 11}
    head(sp, P, SKIN, PRI_HAIR, PRI_EYE, bang=bang, girl=False, mouth='calm' if wind else 'smile', brow=PRI_HAIR[0])
    lay = {}
    for x in range(13, 18):
        lay[(x + hx, 6 + hy - (1 if x > 15 else 0))] = GOLD[3] if x % 2 else GOLD[2]
    lay[(12 + hx, 7 + hy)] = GOLD[1]; lay[(14 + hx, 5 + hy)] = GOLD[4]
    sp.put(lay)
    if wind:  # bâton solaire basculé en arrière, le soleil se charge
        hand, deg = (21 + tx, 24 + ty), -52
        sp.put(place(sun_staff(), (3, 20), hand, deg))
        arm(sp, [(22 + tx, 21 + ty), (23 + tx, 24 + ty), hand], PRI_ROBE, SKIN, width=3.8, cuff=GOLD)
        sdx, sdy = _dir(deg, 18.5)
        sun = (hand[0] + 0.5 + sdx, hand[1] + 0.5 + sdy)
    else:
        hand = (26 + tx + nx_, 26 + ty + ny_)
        sp.put(place(sun_staff(), (1, 20), hand, 0))
        arm(sp, [(22 + tx, 21 + ty), (24 + tx, 24 + ty), hand], PRI_ROBE, SKIN, width=3.8, cuff=GOLD)
        sun = (hand[0] + 2.5, hand[1] - 20 + 1.5)
    c = sp.finish()
    fx = {}
    sx, sy = int(sun[0]), int(sun[1])
    if wind:
        _gather(fx, sx, sy, PRI_FX, r=6, n=8, k0=8)
    else:
        f = P['fr'] % 2
        for x, y in ((sx - 5, sy + 2 - f), (sx + 5, sy - 1 + f), (sx + 1, sy - 6 + f)):
            fx[(x, y)] = PRI_FX[5 if (x + f) % 2 else 4]
    sp.fx(fx)
    return c


# ---------------------------------------------------------------- 6. ninja

def sr_ninja(P):
    sp = Sprite()
    tx, ty = P['t']
    hx, hy = P['h']
    wind = P['mode'] == 'wind'
    s = P['sw']
    nx_, ny_ = P['nh']
    fx_, fy_ = P['fa']
    pts = [(13, 5), (9, 6), (6 + s * 0.5, 10), (5 + s, 17), (6 + s * 1.5, 24), (8 + s * 2, 28)]
    m = m_tube([(x + hx, y + hy) for x, y in pts], [3.5, 4.5, 4.5, 4, 2.5, 1])
    lay = shade(m, NIN_HAIR)
    for x, y in pts[1:-1]:
        lay[(int(x + hx + 1), y + hy)] = NIN_HAIR[3]
    sp.put(lay)
    k = -s  # l'écharpe se soulève en marche, retombe à l'armé
    sc = [(15 + tx, 19 + ty), (11 + tx, 20 + ty + (1 if k < 0 else 0)), (7 + tx, 22 + ty - k + 1),
          (4 + tx - (k > 1), 21 + ty - k + (1 if k < 0 else 1))]
    sp.put(shade(m_tube(sc, [3, 3, 2.5, 1.5]), NIN_PUR))
    arm(sp, [(15 + tx, 21 + ty), (13 + tx, 24 + ty), (12 + tx + fx_, 27 + ty + fy_)], NIN_GI, NIN_GI, far=True)
    legs(sp, P, NIN_GI, ['#101018', '#20202e', '#363648', '#4e4e66', '#707090'], boot_h=3,
         cuff=['#3a3a52', '#56567a', '#8a8ab0', '#b8b8d8', '#e0e0f4'])
    body = m_poly([(14 + tx, 18 + ty), (23 + tx, 18 + ty), (23.5 + tx, 30 + ty), (13.5 + tx, 30 + ty)])
    lay = shade(body, NIN_GI)
    for i in range(5):
        lay[(17 + tx + i, 19 + ty + i)] = NIN_GI[4] if i < 3 else NIN_GI[3]
    for x in range(13 + tx, 25 + tx):
        for y in (26, 27):
            if (x, y + ty) in lay:
                lay[(x, y + ty)] = NIN_PUR[2] if y == 26 else NIN_PUR[1]
    lay[(14 + tx, 26 + ty)] = NIN_PUR[3]
    sp.put(lay)
    bang = {15: 16, 16: 14, 17: 9, 18: 7, 19: 9, 20: 8, 21: 7, 22: 9, 23: 8, 24: 8, 25: 10, 26: 9, 27: 11}
    head(sp, P, SKIN, NIN_HAIR, NIN_EYE, bang=bang, girl=True, eye_shape='fierce' if wind else 'normal',
         mask_face=['#0e0e1a', '#22223a', '#34345a', '#4a4a7a'])
    lay = {}
    for x in range(15, 28):
        lay[(x + hx, 7 + hy)] = NIN_PUR[2] if x < 22 else NIN_PUR[1]
    for x in range(21, 25):
        lay[(x + hx, 6 + hy)] = STEEL[3]; lay[(x + hx, 7 + hy)] = STEEL[2]
    lay[(21 + hx, 6 + hy)] = STEEL[4]
    sp.put(lay)
    it, g = sword_item(14, NIN_BLADE, ['#20202e', '#363648', GOLD[2], GOLD[3]], NIN_PUR, width=2, curve=1.2,
                       pommel=NIN_PUR)
    if wind:  # sabre ramené en arrière le long du corps, prêt à trancher
        hand, deg = (18 + tx, 24 + ty), -100
        sp.put(place(it, g, hand, deg))
        arm(sp, [(22 + tx, 21 + ty), (21 + tx, 24 + ty), hand], NIN_GI, NIN_GI,
            cuff=['#3a3a52', '#56567a', '#8a8ab0', '#b8b8d8'])
    else:
        hand = (24 + tx + nx_, 25 + ty + ny_)
        sp.put(place(it, g, (hand[0] + 1, hand[1]), 45))
        arm(sp, [(22 + tx, 21 + ty), (24 + tx, 23 + ty), hand], NIN_GI, NIN_GI,
            cuff=['#3a3a52', '#56567a', '#8a8ab0', '#b8b8d8'])
    c = sp.finish()
    fx = {}
    if wind:
        tdx, tdy = _dir(deg, 15)
        fx[(int(hand[0] + tdx) - 1, int(hand[1] + tdy) - 1)] = NIN_FX[5]
        fx[(int(hand[0] + tdx) - 2, int(hand[1] + tdy) + 2)] = NIN_FX[3]
    else:
        fl = P['fr']
        fx[(12 + tx, 37 - fl)] = NIN_FX[4]; fx[(33, 30 + fl)] = NIN_FX[5]; fx[(9 + tx, 33 + fl)] = NIN_FX[3]
    sp.fx(fx)
    return c


# ---------------------------------------------------------------- 7. barbare

def sr_barbarian(P):
    sp = Sprite()
    tx, ty = P['t']
    hx, hy = P['h']
    wind = P['mode'] == 'wind'
    nx_, ny_ = P['nh']
    fx_, fy_ = P['fa']
    axe = axe_item()
    if wind:  # hache brandie au-dessus de la tête, fer derrière
        hand = (21 + tx, 20 + ty)
        ax = place(axe, (5, 24), hand, -40)
    else:
        hand = (24 + tx + nx_, 26 + ty + ny_)
        ax = place(axe, (5, 30), hand, -55)
    arm(sp, [(14 + tx, 21 + ty), (12 + tx, 25 + ty), (12 + tx + fx_, 28 + ty + fy_)],
        TAN, TAN, far=True, width=3.6, cuff=LEATHER, fist=1.9)
    legs(sp, P, ['#3a2418', '#5a3a26', '#7a5636', '#9a744c', '#c09a6a'], BAR_FUR, boot_h=4, cuff=BAR_FUR, toe=1)
    kilt = m_poly([(13 + tx, 26 + ty), (24 + tx, 26 + ty), (26 + tx, 33 + ty), (11 + tx, 33 + ty)])
    lay = shade(kilt, BAR_KILT)
    for x in range(10 + tx, 27 + tx):
        if (x, 32 + ty) in kilt and x % 2:
            del lay[(x, 32 + ty)]
    for x in range(10 + tx, 27 + tx, 3):
        if (x, 30 + ty) in lay:
            for y in range(28 + ty, 32 + ty):
                if (x, y) in lay:
                    lay[(x, y)] = BAR_KILT[0]
    sp.put(lay)
    body = m_poly([(13 + tx, 18 + ty), (24 + tx, 18 + ty), (24.5 + tx, 24 + ty), (23 + tx, 27 + ty), (14 + tx, 27 + ty),
                   (12.5 + tx, 24 + ty)])
    lay = shade(body, TAN)
    lay[(19 + tx, 21 + ty)] = TAN[1]; lay[(20 + tx, 22 + ty)] = TAN[1]; lay[(18 + tx, 22 + ty)] = TAN[1]
    lay[(19 + tx, 24 + ty)] = TAN[1]; lay[(20 + tx, 24 + ty)] = TAN[1]
    lay[(16 + tx, 20 + ty)] = TAN[3]; lay[(17 + tx, 20 + ty)] = TAN[3]
    lay[(21 + tx, 20 + ty)] = BAR_PAINT; lay[(22 + tx, 21 + ty)] = BAR_PAINT; lay[(21 + tx, 22 + ty)] = BAR_PAINT
    for x in range(12 + tx, 26 + tx):
        for y in (26, 27):
            if (x, y + ty) in lay or (x, y + ty) in kilt:
                lay[(x, y + ty)] = LEATHER[2] if y == 26 else LEATHER[0]
    lay[(19 + tx, 26 + ty)] = STEEL[4]; lay[(20 + tx, 26 + ty)] = STEEL[3]
    lay[(19 + tx, 27 + ty)] = STEEL[2]; lay[(20 + tx, 27 + ty)] = STEEL[1]
    sp.put(lay)
    if not wind:
        sp.put(ax)
    spikes = m_spikes(18.5, 10.5, 8.5, [(-155, 4, 17), (-118, 4, 17), (-82, 3.5, 17), (-48, 3, 16),
                                        (-18, 1.5, 12), (178, 4, 16), (145, 3, 15)])
    bang = {15: 17, 16: 15, 17: 10, 18: 8, 19: 9, 20: 7, 21: 9, 22: 8, 23: 7, 24: 9, 25: 9, 26: 10, 27: 13}
    head(sp, P, TAN, BAR_HAIR, BAR_EYE, bang=bang, girl=False, mouth='grin', brow=True, eye_shape='fierce',
         hair_mask_extra=spikes, paint=[(23, 15), (23, 16), (25, 15), (25, 16), (19, 15), (19, 16), (21, 6), (21, 7)], blush=False)
    fur = m_ellipse(18 + tx, 19 + ty, 7, 2.2)
    lay = shade(fur, BAR_FUR)
    for x in range(10 + tx, 28 + tx):
        if (x, 21 + ty) in fur and x % 2 == 0:
            lay[(x, 22 + ty)] = BAR_FUR[1]
    for x in range(11 + tx, 27 + tx, 2):
        if (x, 18 + ty) in lay:
            lay[(x, 18 + ty)] = BAR_FUR[4]
    sp.put(lay)
    lay = ball(23.5 + tx, 20 + ty, 3.5, 2.8, BAR_FUR)
    lay[(23 + tx, 18 + ty)] = STEEL[4]; lay[(24 + tx, 18 + ty)] = STEEL[2]
    sp.put(lay)
    if wind:
        sp.put(ax)
    arm(sp, [(23 + tx, 21 + ty), (23 + tx, 22 + ty) if wind else (25 + tx, 23 + ty), hand], TAN, TAN,
        width=3.8, cuff=LEATHER, fist=1.9)
    c = sp.finish()
    fx = {}
    if wind:
        hdx, hdy = _dir(-40, 17)
        _gather(fx, hand[0] + hdx, hand[1] + hdy, BAR_FX, r=9, n=6, k0=20)
    else:
        fl = P['fr']
        for x, y in ((31, 2 + fl), (24, 6 - fl), (33, 10 + fl)):
            fx[(x + tx, y)] = BAR_FX[4 if (x + fl) % 2 else 3]
    sp.fx(fx)
    return c


SR_ALLIES = [('azure_paladin', sr_azure_paladin), ('rose_blade', sr_rose_blade), ('witch', sr_witch),
             ('elf_archer', sr_elf_archer), ('high_priest', sr_high_priest), ('ninja', sr_ninja),
             ('barbarian', sr_barbarian)]
SR_ALLIES = [(aid, _bind(fn, allies_sr, _dir=_dir, _gather=_gather)) for aid, fn in SR_ALLIES]


# ================================================================ SSR (allies_ssr, 48×48)

# ox / oy : buste ; hx / hy : tête ; f : variante des listes d'origine (1 = « b », 0 = repos) ;
# legs : (dx pied arrière, levée, dx pied avant, levée) ; hand / ha : décalage et inclinaison de la main
# proche (arme) ; far : décalage de la main lointaine ; sw : traîne des cheveux et étoffes (<0 vers l'arrière).
SSR_POSE = {
    'w1': dict(kind='w1', ox=0, oy=1, hx=0, hy=1, f=1, legs=(-5, 1, 4, 0), hand=(-2, 1), ha=6, far=(2, 0), sw=-1),
    'w2': dict(kind='w2', ox=0, oy=1, hx=0, hy=1, f=1, legs=(5, 0, -6, 1), hand=(2, -1), ha=-6, far=(-2, -1), sw=-2),
    'wind': dict(kind='wind', ox=-1, oy=0, hx=-2, hy=0, f=0, legs=(-3, 0, 2, 0), hand=(0, 0), ha=0, far=(1, -1), sw=1),
}


def _ssr_legs(c, Q, R3, BOOT, hip_y=36, far_dark=None):
    """Copie d'allies_ssr.legs : foulée (dx) et talon levé (levée) par jambe."""
    bdx, bl, fdx, fl = Q['legs']
    for hip_x, foot_x, lift, far in ((17.5, 17 + bdx, bl, True), (23.5, 23 + fdx, fl, False)):
        p = new()
        rr = (far_dark or [R3[0], R3[0], R3[1]]) if far else R3
        limb(p, [(hip_x, hip_y), (foot_x + 0.5, 43 - lift)], 3.6, rr)
        fx = foot_x
        bt = BOOT if not far else [BOOT[0], BOOT[0], BOOT[1], BOOT[1], BOOT[2]]
        ball(p, fx + 1.0, 44.6 - lift, 3.2, 2.6, bt)
        for x in range(fx - 2, fx + 5):
            for y in (46, 47):
                yy = y - lift
                if p.get(x, yy) is not None or (x <= fx + 3 and y == 47 and x >= fx - 1):
                    p.set(x, yy, bt[1] if y == 46 else bt[0])
        p.set(fx - 1, 43 - lift, bt[3]); p.set(fx, 43 - lift, bt[4] if not far else bt[3])
        stamp(c, p)


def _ssr_hand(Q, ox, oy, wind_hand, wind_a):
    """Main proche (arme) : balancée en marche, armée en arrière à la préparation."""
    if Q['kind'] == 'wind':
        return wind_hand, wind_a
    dx, dy = Q['hand']
    return (33 + ox + dx, 34 + oy + dy), Q['ha']


def _ssr_far(Q, ox, oy):
    dx, dy = Q['far']
    return (13 + ox + dx, 34 + oy + dy)


# ---------------------------------------------------------------- 1. archange

def ssr_archangel(Q):
    ox, oy, f, s = Q['ox'], Q['oy'], Q['f'], Q['sw']
    wind = Q['kind'] == 'wind'
    c = new()
    hx, hy = HX + Q['hx'], HY + Q['hy']
    aura(c, [[(3, 6, True), (44, 12, False), (2, 30, False), (40, 4, True)],
             [(4, 9, False), (43, 8, True), (1, 26, True), (38, 2, False)]][f], A_GLOW)
    fl = {'w1': 4, 'w2': 12, 'wind': 9}[Q['kind']]  # les ailes battent au rythme du pas
    feather_wing(c, 6 + ox, -2 + oy, fl * 0.7 + 8, far=True)
    feather_wing(c, ox, oy, fl)
    far_h = (17 + ox, 32 + oy) if wind else _ssr_far(Q, ox, oy)  # à l'armé, le bouclier passe devant
    arm(c, (16 + ox, 27 + oy), (13 + ox + (2 if wind else 0), 31 + oy), far_h, A_WING[1:4], SKIN, far=True)
    sh = new()
    sx, sy = far_h[0] - 3, far_h[1] - 3
    spoly(sh, [(sx - 4, sy - 5), (sx + 4, sy - 5), (sx + 4.5, sy + 1), (sx, sy + 7), (sx - 4.5, sy + 1)], GOLD)
    spoly(sh, [(sx - 2.5, sy - 3.5), (sx + 2.5, sy - 3.5), (sx + 3, sy + 1), (sx, sy + 5), (sx - 3, sy + 1)], BLUE, contrast=0.5)
    for k in range(-2, 4):
        sh.set(sx, sy + k, GOLD[3])
    for k in range(-2, 3):
        sh.set(sx + k, sy - 1, GOLD[3])
    sh.set(sx, sy - 1, WHITE)
    stamp(c, sh)
    legs(c, Q, BLUE[1:4], GOLD)
    t = new()
    spoly(t, [(14 + ox, 31 + oy), (28 + ox, 31 + oy), (31 + ox, 40), (11 + ox + s * 0.5, 40)], BLUE)
    for x in range(10, 33):
        t.setf(x + ox, 39, GOLD[2]); t.setf(x + ox, 40, GOLD[1])
    spoly(t, [(18 + ox, 32 + oy), (24 + ox, 32 + oy), (24.5 + ox, 39), (21 + ox, 41), (17.5 + ox, 39)], A_WING, only_inside=False, contrast=0.4)
    for y in range(33 + oy, 40):
        t.setf(18 + ox, y, GOLD[2]); t.setf(24 + ox, y, GOLD[1])
    t.setf(21 + ox, 36, GOLD[3]); t.setf(21 + ox, 35, GOLD[2]); t.setf(21 + ox, 37, GOLD[2])
    stamp(c, t)
    t = new()
    spoly(t, [(15 + ox, 24 + oy), (27 + ox, 24 + oy), (26.5 + ox, 29 + oy), (25 + ox, 33 + oy), (17 + ox, 33 + oy), (15.5 + ox, 29 + oy)],
          GOLD, contrast=0.5)
    for y in range(25, 32):
        t.setf(21 + ox, y + oy, GOLD[3]); t.setf(22 + ox, y + oy, GOLD[1])
    for x in range(14, 29):
        t.setf(x + ox, 32 + oy, BLUE[1]); t.setf(x + ox, 33 + oy, BLUE[0])
    t.set(21 + ox, 32 + oy, '#8fe0ff'); t.set(22 + ox, 32 + oy, '#2f7cf6')
    for (x, y) in ((19, 27), (20, 28), (21, 28), (22, 28), (23, 27), (18, 26), (24, 26)):
        t.setf(x + ox, y + oy, GOLD[4])
    t.setf(21 + ox, 29 + oy, BLUE[2])
    stamp(c, t)
    lock(c, [(hx - 7, hy - 2), (hx - 9, hy + 3), (hx - 8.5 + s, hy + 8)], [3.0, 2.6, 1.0], A_HAIR)
    head(c, hx, hy, A_HAIR, A_IRIS, mouth='small' if wind else 'smile', brows='angry' if wind else 'calm')
    halo = new()
    hcx, hcy = hx - 1.0, hy - 12.2 - (1 if Q['kind'] == 'w2' else 0)
    for y in range(int(hcy - 4), int(hcy + 4)):
        for x in range(int(hcx - 9), int(hcx + 9)):
            d = ((x + 0.5 - hcx) / 6.4) ** 2 + ((y + 0.5 - hcy) / 2.3) ** 2
            if 0.3 <= d <= 1.0:
                halo.set(x, y, A_HALO[0] if y + 0.5 < hcy - 0.5 else A_HALO[1] if x + 0.5 < hcx + 3 else GOLD[2])
    stamp(c, halo, GOLD[1])
    hand, a = _ssr_hand(Q, ox, oy, (24 + ox, 34), -170)
    if not wind:
        a += -84
    w = new()
    blen = 17
    blade(w, hand, a, blen, 3.2, '#d4f6ff', WHITE, '#4fb0ff', start=2.4)
    grip(w, hand, a, 2.5, 1.0, BLUE[1], guard=GOLD, glen=3.2, guard_at=1.6, pommel=GOLD[1:4])
    stamp(c, w)
    sh_ = (27 + ox, 28 + oy)
    arm(c, sh_, elbow_of(sh_, hand), hand, A_WING[1:4], SKIN, cuff=(GOLD[1], GOLD[2]))
    t = new()
    ball(t, 26.5 + ox, 26.5 + oy, 3.7, 3.2, GOLD)
    for x in range(23, 31):
        t.setf(x + ox, 29 + oy, BLUE[2]); t.setf(x + ox, 30 + oy, BLUE[1])
    t.setf(26 + ox, 24 + oy, GOLD[4]); t.setf(25 + ox, 25 + oy, GOLD[4])
    stamp(c, t)
    tipp = along(hand, a, blen + 2.4)
    if wind:  # la lame se charge de lumière
        sparkle(c, tipp[0] - 1, tipp[1] - 2, A_GLOW, True)
        sparkle(c, tipp[0] + 3, tipp[1] - 4, A_GLOW)
    else:
        sparkle(c, tipp[0] + (2 if Q['kind'] == 'w1' else -2), tipp[1] + 3, A_GLOW, Q['kind'] == 'w1')
    return c


# ---------------------------------------------------------------- 2. reine démone

def ssr_demon_queen(Q):
    ox, oy, f, s = Q['ox'], Q['oy'], Q['f'], Q['sw']
    wind = Q['kind'] == 'wind'
    c = new()
    hx, hy = HX + Q['hx'], HY + Q['hy']
    aura(c, [[(3, 34, False), (42, 6, True), (6, 4, False), (45, 30, False)],
             [(2, 31, True), (44, 4, False), (8, 2, True), (46, 26, False)]][f], D_GLOW)
    fl = {'w1': -2, 'w2': -4, 'wind': 3}[Q['kind']]
    bat_wing(c, (18 + ox, 25 + oy), (11 + ox, 9 + oy + fl), [(5, 6 + fl), (1, 14 + fl // 2), (3, 22)],
             (14 + ox, 30 + oy), D_WING, D_BONE, far=True)
    bat_wing(c, (16 + ox, 26 + oy), (6 + ox, 13 + oy + fl), [(0, 9 + fl), (-1, 19 + fl // 2), (2, 27), (8, 32)],
             (14 + ox, 32 + oy), D_WING, D_BONE)
    sway = s
    lock(c, [(hx - 5, hy - 4), (hx - 10, hy + 2), (hx - 11 + sway, hy + 10), (hx - 9 + sway, hy + 17), (hx - 11 + sway * 2, hy + 22)],
         [4.2, 4.6, 4.2, 3.2, 1.0], D_HAIR)
    arm(c, (16 + ox, 27 + oy), (13 + ox, 31 + oy), _ssr_far(Q, ox, oy), D_ARMOR[1:4], D_ARMOR[1:5], far=True)
    legs(c, Q, D_ARMOR[1:4], D_ARMOR)
    t = new()
    spoly(t, [(14 + ox, 31 + oy), (28 + ox, 31 + oy), (32 + ox, 41), (28 + ox, 39), (25 + ox, 42), (21 + ox, 39),
              (17 + ox, 42), (14 + ox, 39), (10 + ox + s, 41)], D_ARMOR, contrast=0.45)
    for x in range(12, 31):
        t.setf(x + ox, 33 + oy, GOLD[1])
    stamp(c, t)
    t = new()
    ball(t, 21 + ox, 28 + oy, 6.4, 5.4, D_ARMOR)
    for k in range(5):
        t.setf(17 + k + ox, 25 + k + oy, GOLD[2]); t.setf(25 - k + ox, 25 + k + oy, GOLD[1])
    t.setf(21 + ox, 29 + oy, FIRE[3]); t.setf(21 + ox, 30 + oy, FIRE[2]); t.setf(20 + ox, 29 + oy, FIRE[4])
    for x in range(14, 29):
        t.setf(x + ox, 32 + oy, D_ARMOR[0])
    stamp(c, t)
    horn(c, (hx - 2, hy - 6), [(hx - 3, hy - 10), (hx - 7, hy - 12.5), (hx - 9, hy - 16)], D_HORN, 2.0)
    head(c, hx, hy, D_HAIR, D_IRIS, mouth='smirk' if wind else 'fang', brows='angry',
         fringe=[8, 6, 2, 0, 2, 1, -1, 0, 1, -1, -2, -3])
    horn(c, (hx + 2, hy - 6), [(hx + 2, hy - 10), (hx - 1, hy - 13), (hx - 2, hy - 17)], D_HORN, 2.4)
    hand, a = _ssr_hand(Q, ox, oy, (26 + ox, 31), -150)
    if not wind:
        a += -88
    w = new()
    p0 = along(hand, a, -11)
    du = 0
    p1 = along(hand, a, 18 + du)
    w.line(p0[0], p0[1], p1[0], p1[1], '#3a1a2a', width=2)
    nx, ny = perp(a)
    for k in range(-10, 18, 4):
        q = along(hand, a, k)
        w.set(q[0] - nx * 0.5, q[1] - ny * 0.5, '#6a3a4a')
    hb = along(hand, a, 13)
    side = -1
    if nx * side < 0:
        side = 1
    if wind:  # arme renversée en arrière : le tranchant regarde vers le haut
        side = -side
    fwd = (nx * side, ny * side)
    ux, uy = math.cos(math.radians(a)), math.sin(math.radians(a))

    def P(u, v):
        return (hand[0] + ux * u + fwd[0] * v, hand[1] + uy * u + fwd[1] * v)
    AXE = ['#2a1a30', '#4a3a58', '#7a6a8e', '#b4a8c8', '#ece4f6']
    pts = [P(u + du, v) for (u, v) in ((10, 0.5), (8.5, 3.5), (6, 7), (8.5, 8.6), (12.5, 9.2), (16.5, 8.6), (19, 7), (16.5, 3.5), (15, 0.5))]
    m = mask_of(lambda t: t.poly(pts, '#000'))
    for (x, y) in m:
        v = (x + 0.5 - hand[0]) * fwd[0] + (y + 0.5 - hand[1]) * fwd[1]
        u = (x + 0.5 - hand[0]) * ux + (y + 0.5 - hand[1]) * uy - du
        if v > 7.4:
            col = FIRE[3] if u > 12.5 else FIRE[2]
        elif v > 6.4:
            col = AXE[4] if u > 12 else AXE[3]
        else:
            col = AXE[2] if u > 12.5 else AXE[1]
        w.set(x, y, col)
    for k in (11.5, 13.5):
        q = P(k + du, 3.5)
        w.set(q[0], q[1], AXE[0])
    q = P(12.5 + du, 3.5)
    w.set(q[0], q[1], FIRE[2])
    hb = P(12.5 + du, 0)
    tip = along(hand, a, 22 + du * 1.4)
    spoly(w, [(p1[0] - nx * 1.2, p1[1] - ny * 1.2), tip, (p1[0] + nx * 1.2, p1[1] + ny * 1.2)],
          ['#3a2a40', '#6a5a78', '#a49ab4', '#dcd4e8'])
    w.set(hb[0], hb[1], FIRE[3])
    stamp(c, w)
    fl_c = new()
    edge = (hb[0] + fwd[0] * 8.5, hb[1] + fwd[1] * 8.5)
    if wind:  # le fer s'embrase avant le coup
        for i, (dx, dy, wd, hg) in enumerate(((0, 0, 2.2, 7), (3, -1, 1.8, 5), (-3, 1, 1.8, 5))):
            flame(fl_c, edge[0] + dx, edge[1] + dy, wd, hg, (-1) ** i, i)
    else:
        g = {'w1': 1, 'w2': 0}[Q['kind']]
        for i, (dx, dy, wd, hg) in enumerate(((1, -2, 1.8, 6 + g), (2, 3, 1.6, 4), (-1, -5, 1.4, 4 - g))):
            flame(fl_c, edge[0] + dx, edge[1] + dy, wd, hg, (-1) ** (i + g), i + g)
    stamp(c, fl_c, FIRE[0])
    sh_ = (27 + ox, 28 + oy)
    arm(c, sh_, elbow_of(sh_, hand), hand, D_ARMOR[1:4], D_ARMOR[1:5], cuff=(GOLD[1], GOLD[2]))
    t = new()
    ball(t, 27 + ox, 26.5 + oy, 4.2, 3.6, D_ARMOR)
    spoly(t, [(27 + ox, 24 + oy), (32 + ox, 21 + oy), (30 + ox, 26 + oy)], D_HORN)
    for x in range(23, 32):
        t.setf(x + ox, 29 + oy, GOLD[1])
    stamp(c, t)
    for (x, y) in [((3, 40), (40, 20)), ((4, 37), (42, 17))][f]:
        c.set(x, y, FIRE[3]); c.set(x, y - 1, FIRE[2])
    return c


# ---------------------------------------------------------------- 3. impératrice des glaces

def ssr_ice_empress(Q):
    ox, oy, f, s = Q['ox'], Q['oy'], Q['f'], Q['sw']
    wind = Q['kind'] == 'wind'
    bdx, bl, fdx, fl = Q['legs']
    c = new()
    hx, hy = HX + Q['hx'], HY + Q['hy']
    for (x, y) in [((4, 10), (42, 4), (3, 40), (45, 38)), ((5, 7), (43, 7), (2, 37), (44, 41))][f]:
        snowflake(c, x, y)
    aura(c, [[(8, 22, False), (40, 26, True)], [(7, 25, True), (41, 23, False)]][f], I_GLOW)
    sway = s
    lock(c, [(hx - 4, hy - 5), (hx - 10, hy), (hx - 11 + sway, hy + 9), (hx - 10 + sway, hy + 17), (hx - 12 + sway * 2, hy + 24)],
         [4.6, 5.2, 5.0, 4.0, 1.2], I_HAIR)
    lock(c, [(hx - 7, hy - 2), (hx - 8, hy + 8), (hx - 6 + sway, hy + 16), (hx - 7 + sway, hy + 21)], [3.4, 3.4, 2.6, 0.8], I_HAIR)
    arm(c, (16 + ox, 27 + oy), (13 + ox, 31 + oy), _ssr_far(Q, ox, oy), GOWN_W[1:4], SKIN, far=True, cuff=(ICE[1], ICE[2]))
    t = new()
    skirt = [(16 + ox, 31 + oy), (26 + ox, 31 + oy), (30 + ox, 37), (34 + ox + max(0, fdx) // 2, 44), (33 + max(0, fdx) // 2, 46),
             (9 + s * 0.5, 46), (8 + ox + s, 44), (12 + ox, 37)]
    spoly(t, skirt, GOWN, contrast=0.42)
    spoly(t, [(19 + ox, 32 + oy), (24 + ox, 32 + oy), (28 + ox, 45), (15 + ox, 45)], GOWN_W, only_inside=True, contrast=0.4)
    for x in range(6, 36):
        t.setf(x, 45, ICE[3] if x % 3 else WHITE); t.setf(x, 46, ICE[1])
    for x in range(10 + ox, 33 + ox, 4):
        t.setf(x, 41, GOWN[0]); t.setf(x, 42, GOWN[0]); t.setf(x, 43, GOWN[1])
    for (x, y) in ((21, 36), (22, 39), (21, 42)):
        t.setf(x + ox, y, ICE[2])
    stamp(c, t)
    # pointes de souliers : elles avancent et reculent sous l'ourlet
    t = new()
    for fx, lift in ((16 + bdx, bl), (25 + fdx, fl)):
        t.set(fx, 47 - lift, SILVER[2]); t.set(fx + 1, 47 - lift, SILVER[3]); t.set(fx + 2, 47 - lift, SILVER[1])
    stamp(c, t)
    c.set(33, 47, None)
    t = new()
    ball(t, 21 + ox, 28 + oy, 5.8, 5.0, GOWN)
    spoly(t, [(18 + ox, 24 + oy), (24 + ox, 24 + oy), (21 + ox, 32 + oy)], GOWN_W, only_inside=True)
    t.setf(21 + ox, 27 + oy, '#3ac8ff'); t.setf(21 + ox, 28 + oy, ICE[0]); t.setf(20 + ox, 27 + oy, WHITE)
    for x in range(15, 28):
        t.setf(x + ox, 32 + oy, SILVER[2])
    stamp(c, t)
    t = new()
    for x, y in ((15, 25), (17, 23), (25, 23), (27, 25)):
        crystal(t, x + ox, y + 2 + oy, 4, 1.4)
    stamp(c, t)
    head(c, hx, hy, I_HAIR, I_IRIS, mouth='small', brows='angry' if wind else 'calm', blush='#f4a8c8')
    lock(c, [(hx - 2, hy + 1), (hx - 2.5, hy + 6), (hx - 1.5, hy + 10)], [1.6, 1.8, 0.7], I_HAIR)
    t = new()
    cy = hy - 6
    spoly(t, [(hx - 6, cy + 1), (hx + 5, cy - 1), (hx + 5, cy + 1), (hx - 6, cy + 3)], SILVER + [SILVER[3]])
    for (dx, h, w, lean) in ((-5, 4, 1.3, -0.5), (-2, 7, 1.6, -0.3), (1.5, 9, 1.8, 0.2), (4.5, 5, 1.3, 0.5)):
        crystal(t, hx + dx, cy + 1 - dx * 0.18, h, w, lean=lean)
    t.set(hx + 1, cy, '#3ac8ff')
    stamp(c, t)
    hand, a = _ssr_hand(Q, ox, oy, (28 + ox, 30), -150)
    if not wind:
        a += -88
    w = new()
    p0 = along(hand, a, -12)
    p1 = along(hand, a, 13)
    w.line(p0[0], p0[1], p1[0], p1[1], SILVER[1], width=2)
    nx, ny = perp(a)
    for k in range(-12, 13, 1):
        q = along(hand, a, k)
        w.set(q[0] + nx * 0.5, q[1] + ny * 0.5, SILVER[3] if k % 4 else SILVER[2])
    for k in (-6, 6):
        q = along(hand, a, k)
        w.set(q[0], q[1], ICE[2])
    top = along(hand, a, 13)
    for sgn in (-1, 1):
        q = along(top, a + sgn * 40, 4)
        w.line(top[0], top[1], q[0], q[1], SILVER[2])
    stamp(c, w)
    t = new()
    cc = along(hand, a, 18 if wind else {'w1': 20, 'w2': 19}[Q['kind']])
    r = math.radians(a)
    ux, uy = math.cos(r), math.sin(r)
    gem = [(cc[0] - ux * 5, cc[1] - uy * 5), (cc[0] + nx * 2.6, cc[1] + ny * 2.6), (cc[0] + ux * 6, cc[1] + uy * 6), (cc[0] - nx * 2.6, cc[1] - ny * 2.6)]
    spoly(t, gem, ICE, contrast=0.6)
    t.set(cc[0] - 0.5, cc[1] - 0.5, WHITE)
    stamp(c, t, ICE[0])
    if wind:  # le givre se condense autour du cristal
        for k in range(6):
            q = along(cc, k * 60 + 30, 7)
            snowflake(c, q[0], q[1]) if k % 2 else c.set(q[0], q[1], ICE[3])
    else:
        sparkle(c, cc[0] + 4, cc[1] - 3 + (2 if Q['kind'] == 'w1' else 0), I_GLOW, True)
    sh_ = (27 + ox, 28 + oy)
    arm(c, sh_, elbow_of(sh_, hand), hand, GOWN_W[1:4], SKIN, cuff=(ICE[1], ICE[2]))
    t = new()
    ball(t, 26.5 + ox, 26.5 + oy, 3.4, 3.0, GOWN_W)
    for x in range(23, 30):
        t.setf(x + ox, 28 + oy, ICE[2])
    stamp(c, t)
    return c


# ---------------------------------------------------------------- 4. seigneur des ombres

def ssr_shadow_lord(Q):
    ox, oy, f, s = Q['ox'], Q['oy'], Q['f'], Q['sw']
    wind = Q['kind'] == 'wind'
    c = new()
    hx, hy = HX + Q['hx'], HY + Q['hy']
    aura(c, [[(4, 14, True), (44, 36, False), (2, 40, False), (11, 3, False)],
             [(5, 11, False), (45, 33, True), (3, 37, True), (13, 2, False)]][f], S_GLOW)
    for (x, y) in [((8, 45), (33, 44), (6, 41)), ((9, 44), (34, 45), (5, 42))][f]:
        c.set(x, y, VIO[2]); c.set(x, y - 1, VIO[1])
    sw = {'w1': -2, 'w2': -3, 'wind': 1}[Q['kind']]  # la cape traîne en marche
    t = new()
    cape = [(18 + ox, 23 + oy), (13 + ox, 25 + oy), (8 + ox + sw, 34), (5 + sw, 42), (7 + sw, 40), (8 + sw, 45),
            (11 + sw, 41), (13, 46), (15, 42), (17, 45), (19, 40), (21 + ox, 30 + oy)]
    spoly(t, cape, S_CAPE, contrast=0.45)
    for (x0, y0, x1, y1) in ((12, 28, 9 + sw, 40), (15, 29, 14, 42)):
        t.line(x0 + ox, y0 + oy, x1, y1, S_CAPE[0])
    t.line(13 + ox, 26 + oy, 7 + sw, 39, S_CAPE[3])
    stamp(c, t)
    for (x, y) in ((5 + sw, 42), (8 + sw, 45), (13, 46), (17, 45)):
        c.set(x, y - 1, VIO[1])
    arm(c, (16 + ox, 27 + oy), (13 + ox, 31 + oy), _ssr_far(Q, ox, oy), S_ARM[1:4], S_ARM[1:5], far=True)
    legs(c, Q, S_ARM[1:4], S_ARM)
    t = new()
    spoly(t, [(14 + ox, 31 + oy), (28 + ox, 31 + oy), (31 + ox, 40), (11 + ox, 40)], S_ARM, contrast=0.4)
    for x in range(11, 32):
        t.setf(x + ox, 36, S_ARM[0]); t.setf(x + ox, 39, VIO[1])
    stamp(c, t)
    t = new()
    ball(t, 21 + ox, 28 + oy, 6.8, 5.8, S_ARM)
    for (x, y) in ((21, 26), (21, 27), (20, 28), (22, 28), (21, 29), (21, 30)):
        t.setf(x + ox, y + oy, VIO[2])
    t.setf(21 + ox, 28 + oy, VIO[4])
    for x in range(14, 29):
        t.setf(x + ox, 32 + oy, S_ARM[0]); t.setf(x + ox, 33 + oy, S_ARM[1])
    t.setf(21 + ox, 33 + oy, VIO[3])
    stamp(c, t)
    pw = s

    def psh(t, sd, x, y):
        if sd < -0.5:
            return VIO[1] if t < 0.75 else S_CAPE[3]
        if sd > 0.45:
            return S_CAPE[0]
        if abs(sd - 0.2 * math.sin(t * 12)) < 0.16:
            return S_CAPE[3]
        return S_CAPE[2] if t < 0.6 else S_CAPE[1]
    p = new()
    spine_fill(p, [(hx - 1, hy - 7), (hx - 4, hy - 11.5), (hx - 10, hy - 12), (hx - 14, hy - 8 + pw),
                   (hx - 16 + pw, hy - 2 + pw), (hx - 15 + pw * 2, hy + 4)], [2.0, 3.0, 3.6, 3.4, 2.6, 0.8], psh)
    for k in range(4):
        p.set(hx - 18 + pw + k % 2, hy - 4 + k * 3 + pw, None)
    stamp(c, p)
    t = new()
    spoly(t, [(hx - 6, hy + 6), (hx + 6, hy + 6), (hx + 7, hy + 9), (hx - 6, hy + 9)], S_ARM)
    for x in range(int(hx - 6), int(hx + 8)):
        t.setf(x, hy + 8, VIO[1])
    stamp(c, t)
    HORN_S = [S_ARM[0], S_ARM[1], S_ARM[2], S_ARM[3], VIO[3]]
    horn(c, (hx - 3, hy - 5), [(hx - 6, hy - 10), (hx - 6, hy - 14), (hx - 3, hy - 17)], HORN_S, 2.2)
    t = new()
    ball(t, hx, hy, 8.4, 7.8, S_ARM)
    for y in range(int(hy - 8), int(hy + 2)):
        t.setf(hx - 1, y, S_ARM[3]); t.setf(hx, y, S_ARM[1])
    stamp(c, t)
    t = new()
    spoly(t, [(hx + 1, hy - 4), (hx + 7, hy - 4), (hx + 9.5, hy + 1), (hx + 8.5, hy + 6), (hx + 5, hy + 8.5), (hx + 1, hy + 7)],
          [S_ARM[1], S_ARM[2], S_ARM[3], S_ARM[3], S_ARM[4]], contrast=0.45)
    stamp(c, t)
    vy = int(hy)
    for x in range(int(hx + 2), int(hx + 10)):
        c.set(x, vy, OUT)
    for y in range(vy + 1, vy + 5):
        c.set(int(hx + 6), y, OUT)
    glow = VIO[4] if Q['kind'] != 'w1' else VIO[3]
    c.set(hx + 3, vy, glow); c.set(hx + 4, vy, VIO[3]); c.set(hx + 8, vy, glow); c.set(hx + 7, vy, VIO[2])
    c.set(hx + 6, vy + 2, VIO[1])
    for (x, y) in ((hx + 3, vy + 3), (hx + 3, vy + 5), (hx + 8, vy + 3)):
        c.set(x, y, S_ARM[0])
    for (x, y) in ((hx - 5, hy - 5), (hx - 4, hy - 6), (hx - 6, hy - 4), (hx - 3, hy - 7)):
        c.setf(x, y, S_ARM[4])
    horn(c, (hx + 3, hy - 5), [(hx + 5, hy - 10), (hx + 4, hy - 14), (hx + 1, hy - 17)], HORN_S, 2.6)
    hand, a = _ssr_hand(Q, ox, oy, (26 + ox, 33), -164)
    if not wind:
        a += -76
    blen = 22
    w = new()
    blade(w, hand, a, blen, 5.0, '#c8c4ec', S_ARM[3], S_ARM[1], start=2.6, tip_len=5)
    for k in range(5, blen - 2):
        q = along(hand, a, k)
        w.set(q[0], q[1], VIO[2] if k % 3 else VIO[3])
    grip(w, hand, a, 3.5, 1.0, S_CAPE[2], guard=[S_ARM[1], S_ARM[3], VIO[3]], glen=4.5, guard_at=2.0,
         pommel=[VIO[0], VIO[1], VIO[2]])
    stamp(c, w)
    gl = new()
    nx, ny = perp(a)
    ph = {'w1': 1, 'w2': 0, 'wind': 2}[Q['kind']]
    for k in range(6, blen, 3 if not wind else 2):
        q = along(hand, a, k + ph)
        side = 3.4 if (k // 3) % 2 else -3.4
        gl.set(q[0] + nx * side, q[1] + ny * side, VIO[2] if k % 2 else VIO[3])
    for y in range(-PADX, H + PADX):
        for x in range(-PADX, W + PADX):
            if gl.get(x, y) and c.get(x, y) is None:
                c.set(x, y, gl.get(x, y))
    sh_ = (27 + ox, 28 + oy)
    arm(c, sh_, elbow_of(sh_, hand), hand, S_ARM[1:4], S_ARM[1:5], cuff=(VIO[1], VIO[2]))
    t = new()
    ball(t, 27 + ox, 26.5 + oy, 4.8, 4.0, S_ARM)
    spoly(t, [(27 + ox, 24 + oy), (33 + ox, 21 + oy), (31 + ox, 26 + oy)], S_ARM)
    spoly(t, [(29 + ox, 27 + oy), (34 + ox, 26 + oy), (31 + ox, 29 + oy)], S_ARM)
    for x in range(23, 33):
        t.setf(x + ox, 29 + oy, VIO[1])
    t.setf(26 + ox, 25 + oy, S_ARM[4])
    stamp(c, t)
    return c


# ---------------------------------------------------------------- 5. gardienne sylvestre

def ssr_sylvan_guardian(Q):
    ox, oy, f, s = Q['ox'], Q['oy'], Q['f'], Q['sw']
    wind = Q['kind'] == 'wind'
    bdx, bl, fdx, fl_ = Q['legs']
    c = new()
    hx, hy = HX + Q['hx'], HY + Q['hy']
    aura(c, [[(5, 8, True), (42, 6, False), (3, 32, False), (45, 30, True)],
             [(6, 5, False), (43, 9, True), (2, 29, True), (44, 33, False)]][f], G_GLOW)
    fl = new()
    for (x, y, a) in [((8, 16, 200), (40, 40, 30), (2, 22, 120)), ((7, 18, 220), (41, 38, 10), (3, 19, 140))][f]:
        leaf(fl, x, y, a, 3)
    stamp(c, fl)
    sway = s
    lock(c, [(hx - 4, hy - 5), (hx - 10, hy + 1), (hx - 10 + sway, hy + 9), (hx - 8 + sway, hy + 15), (hx - 10 + sway * 2, hy + 21)],
         [4.4, 4.8, 4.4, 3.2, 1.0], G_HAIR)
    t = new()
    for (x, y, a) in ((hx - 11 + sway, hy + 9, 200), (hx - 9 + sway, hy + 16, 160)):
        leaf(t, x, y, a, 3)
    stamp(c, t)
    arm(c, (16 + ox, 27 + oy), (13 + ox, 31 + oy), _ssr_far(Q, ox, oy), [SKIN[0], SKIN[1], SKIN[2]], SKIN, far=True,
        cuff=(LEAF[1], LEAF[2]))
    legs(c, Q, [SKIN[1], SKIN[2], SKIN[3]], WOOD, far_dark=[SKIN[0], SKIN[1], SKIN[1]])
    # lianes des sandales (suivent les pieds)
    for hip_x, fx, lift in ((17.5, 17 + bdx, bl), (23.5, 23 + fdx, fl_)):
        for y in (39, 41):
            xa = hip_x + (fx + 0.5 - hip_x) * (y - 36) / (7 - lift) - 0.5
            c.setf(xa + (y - 39) // 2, y, LEAF[1])
            c.setf(xa + 1 + (y - 39) // 2, y, LEAF[2])
    t = new()
    spoly(t, [(15 + ox, 30 + oy), (27 + ox, 30 + oy), (29 + ox, 36 + oy), (13 + ox, 36 + oy)], LEAF)
    stamp(c, t)
    t = new()
    for i, x in enumerate(range(12, 31, 3)):
        leaf(t, x + ox, 34 + oy, 90 + (x - 21) * 3 - s * 4, 6 + (i % 2), LEAF)
    stamp(c, t)
    t = new()
    for i, x in enumerate(range(14, 30, 3)):
        leaf(t, x + ox + 1, 31 + oy, 90 + (x - 21) * 3 - s * 3, 5, [LEAF[1], LEAF[2], LEAF[3], LEAF[4], LEAF[4]])
    stamp(c, t)
    t = new()
    ball(t, 21 + ox, 27.5 + oy, 5.6, 4.8, LEAF)
    for k in range(-4, 5):
        t.setf(21 + k + ox, 26 + abs(k) // 2 + oy, LEAF[1])
    for x in range(15, 28):
        t.setf(x + ox, 31 + oy, WOOD[2] if x % 2 else WOOD[1])
    t.setf(24 + ox, 31 + oy, FLOWER[0]); t.setf(25 + ox, 30 + oy, FLOWER[0]); t.setf(25 + ox, 31 + oy, FLOWER[2])
    stamp(c, t)
    t = new()
    b0 = (hx - 4, hy - 6)
    t.line(b0[0], b0[1], b0[0] - 3, b0[1] - 5, ANTLER[1], width=2)
    t.line(b0[0] - 2, b0[1] - 3, b0[0], b0[1] - 7, ANTLER[1])
    t.line(b0[0] - 3, b0[1] - 5, b0[0] - 6, b0[1] - 7, ANTLER[1])
    stamp(c, t)
    head(c, hx, hy, G_HAIR, G_IRIS, mouth='small' if wind else 'smile', brows='angry' if wind else 'calm',
         fringe=[8, 7, 2, 0, 1, 3, 0, -1, 1, 0, -2, -3])
    t = new()
    b1 = (hx + 1, hy - 6)
    t.line(b1[0], b1[1], b1[0] - 1, b1[1] - 6, ANTLER[2], width=2)
    t.line(b1[0] - 1, b1[1] - 3, b1[0] + 2, b1[1] - 6, ANTLER[2])
    t.line(b1[0] - 1, b1[1] - 6, b1[0] - 4, b1[1] - 8, ANTLER[2])
    t.set(b1[0] - 1, b1[1] - 6, ANTLER[3]); t.set(b1[0] + 2, b1[1] - 6, ANTLER[3]); t.set(b1[0] - 4, b1[1] - 8, ANTLER[3])
    stamp(c, t)
    t = new()
    for (x, y, a) in ((hx - 6, hy - 5, 200), (hx - 3, hy - 7, 240), (hx + 4, hy - 6, 310)):
        leaf(t, x, y, a, 4)
    stamp(c, t)
    c.set(hx - 7, hy - 2, FLOWER[0]); c.set(hx - 6, hy - 2, FLOWER[1]); c.set(hx - 7, hy - 1, FLOWER[0]); c.set(hx - 8, hy - 2, FLOWER[0])
    c.set(hx - 7, hy - 3, FLOWER[0]); c.set(hx - 7, hy - 2, FLOWER[2])
    hand, a = _ssr_hand(Q, ox, oy, (28 + ox, 30), -152)
    if not wind:
        a += -86
    w = new()
    p0 = along(hand, a, -12)
    p1 = along(hand, a, 12)
    nx, ny = perp(a)
    pts = [p0]
    for k in range(-8, 13, 5):
        q = along(hand, a, k)
        pts.append((q[0] + nx * (0.6 if (k // 5) % 2 else -0.6), q[1] + ny * (0.6 if (k // 5) % 2 else -0.6)))
    pts.append(p1)
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        w.line(x0, y0, x1, y1, WOOD[2], width=2.2)
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        w.line(x0 - nx, y0 - ny, x1 - nx, y1 - ny, WOOD[1])
    top = along(hand, a, 16)
    for sgn in (-1, 1):
        q = along(p1, a + sgn * 50, 4)
        q2 = along(q, a - sgn * 30, 4)
        w.line(p1[0], p1[1], q[0], q[1], WOOD[2], width=1.6)
        w.line(q[0], q[1], q2[0], q2[1], WOOD[3])
    q = along(p1, a + 70, 3)
    leaf(w, q[0], q[1], a + 60, 4)
    stamp(c, w)
    o = new()
    rr = 3.0 + (0.4 if wind else 0)
    o.shaded_ellipse(top[0] + 0.5, top[1] + 0.5, rr, rr, ORB[:4])
    o.set(top[0] - 1, top[1] - 1, WHITE)
    stamp(c, o, ORB[0])
    ph = {'w1': 1, 'w2': 0, 'wind': 2}[Q['kind']]
    for k in range(8):
        ang = k * 45 + ph * 20
        q = along((top[0] + 0.5, top[1] + 0.5), ang, rr + 2.2 + (k % 2))
        if c.get(int(q[0]), int(q[1])) is None and (wind or (k + ph) % 2 == 0):
            c.set(q[0], q[1], ORB[3] if k % 4 else ORB[2])
    sh_ = (27 + ox, 28 + oy)
    arm(c, sh_, elbow_of(sh_, hand), hand, [SKIN[1], SKIN[2], SKIN[3]], SKIN, cuff=(LEAF[1], LEAF[3]))
    t = new()
    leaf(t, 25 + ox, 25 + oy, 10, 5)
    leaf(t, 26 + ox, 26 + oy, 60, 4)
    stamp(c, t)
    return c


SSR_ALLIES = [('archangel', ssr_archangel), ('demon_queen', ssr_demon_queen), ('ice_empress', ssr_ice_empress),
              ('shadow_lord', ssr_shadow_lord), ('sylvan_guardian', ssr_sylvan_guardian)]
SSR_ALLIES = [(aid, _bind(fn, allies_ssr, legs=_bind(_ssr_legs, allies_ssr), _ssr_hand=_ssr_hand, _ssr_far=_ssr_far))
              for aid, fn in SSR_ALLIES]


# ================================================================ export

def _groups():
    out = [(aid, fn, lambda k: k) for aid, fn in R_ALLIES]
    out += [(aid, fn, lambda k: SR_POSE[k]) for aid, fn in SR_ALLIES]
    out += [(aid, fn, lambda k: SSR_POSE[k]) for aid, fn in SSR_ALLIES]
    return out


def _originals():
    """Images d'origine (repos, _b, _atk) de chaque allié, sur calques à marge (non recadrées)."""
    out = {}
    for aid, fn in allies_r.ALLIES:
        out[aid] = (lambda fn=fn: [fn('idle'), fn('b'), fn('atk')])
    for aid, fn in allies_sr.ALLIES:
        out[aid] = (lambda fn=fn: [fn(allies_sr.POSES[k]) for k in ('idle', 'b', 'atk')])
    for aid in allies_ssr.ALLIES:
        out[aid] = (lambda fn=allies_ssr.DRAW[aid]: [fn(0), fn(1), fn(2)])
    return out


def build():
    """Renvoie {nom: (canvas, extra)} : ally_<id>_w1, ally_<id>_w2, ally_<id>_wind pour les 20 alliés,
    et ally_<id>, _b, _atk recadrés avec elles : les 6 images partagent un canvas agrandi juste assez pour
    que rien ne soit coupé (halo, ailes, cornes, armes), symétriquement en largeur et vers le haut
    (ancrage bas-centre inchangé, pieds sur la dernière ligne)."""
    out = {}
    orig = _originals()
    for aid, fn, arg in _groups():
        frames = orig[aid]() + [fn(arg(k)) for k in FRAMES]
        names = [f'ally_{aid}', f'ally_{aid}_b', f'ally_{aid}_atk'] + [f'ally_{aid}_{k}' for k in FRAMES]
        for name, cv in zip(names, group_crop(frames)):
            out[name] = (cv, {})
    return out
