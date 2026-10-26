"""Animations retravaillées des ennemis communs des mondes 1 à 6 (chargé juste avant fixes dans build.py).

Ces ennemis n'avaient que deux images (repos / marche) et une 2e image parfois presque identique au repos.
Chaque personnage ci-dessous est une copie paramétrée de sa fonction d'enemies.py (mêmes formes, mêmes
couleurs) : l'image 0 (repos) est inchangée, l'image 1 (marche) est renforcée quand elle bougeait trop peu,
et une image d'attaque `_atk` lisible est ajoutée (le jeu l'affiche pendant les coups).

  slime, slime_blue, slime_ice   _atk : bond vers l'avant (corps penché, visage furieux, traînée)
  slime_fire                     _atk : flammes rabattues vers l'avant, crachat de feu
  goblin                         _atk : coup de gourdin abattu devant lui, fente avant
  mandrake                       _b : vrai petit bond, feuilles qui battent ; _atk : cri strident
  mushroom, mushroom_green       _b : bond (chapeau qui rebondit, pieds décollés) ; _atk : coup de tête + spores
  skeleton                       _atk : estoc, fente avant
  golem                          _b : pas lourd (épaules qui roulent) ; _atk : poing abattu au sol
  scorpion                       _b : queue et pinces qui bougent ; _atk : dard projeté par-dessus la tête
  lich                           _b : robe et bâton qui ondulent ; _atk : orbe brandi, éclair violet
  wraith                         _atk : plongeon griffes en avant
  imp                            _atk : coup de fourche horizontal
  mummy                          _atk : bandelette fouettée vers l'avant

Ennemis tournés vers la GAUCHE, pieds sur la dernière ligne, contour #1a1226, 3 images de même canvas.
Le canvas commun s'agrandit au besoin symétriquement autour de l'ancien (ancrage bas-centre du jeu).
"""
import math

from lib import mix, shift
from enemies import (Canvas, M, OUT, INK, WHITE, part, crop_to, mask_of, shade_mask, spoly, sell, sline,
                     dome_mask, slime_body, slime_face, ice_crystal, flame_shade, eye, brow, smile, open_mouth,
                     blush, dk, membrane_wing, mossify, skull, bone_line,
                     G_SLIME, B_SLIME, I_SLIME, F_SLIME, ICE, G_SKIN, LEATHER, WOOD, STEEL, RUST, BONE, GOLD,
                     PURPLE_GLOW, LEAF, GREEN_GEM, ROOT, ROBE, GHOST, STONE, SCORP, MUMMY, IMP, IMP_WING,
                     GOB_TUNIC, GOB_PANTS, goblin_legs, goblin_head, goblin_torso, skeleton_base)

DUST = ['#5a4a46', '#8a7a6a', '#c0b29a', '#ece2cc']


# ================================================================ outils

def trio(fn, fx=None, fly=False):
    """Images fn(0..2) contournées, recadrées sur une boîte commune : l'ancienne boîte (repos + marche)
    agrandie symétriquement en largeur pour contenir l'attaque (ancrage bas-centre inchangé)."""
    fr = []
    for f in range(3):
        c = fn(f)
        c.outline(OUT)
        if fx:
            fx(c, f)
        fr.append(c)
    bs = [c.bounds() for c in fr]
    ob = (min(b[0] for b in bs[:2]), min(b[1] for b in bs[:2]), max(b[2] for b in bs[:2]), max(b[3] for b in bs[:2]))
    nb = (min(b[0] for b in bs), min(b[1] for b in bs), max(b[2] for b in bs), max(b[3] for b in bs))
    e = max(ob[0] - nb[0], nb[2] - ob[2])
    box = (ob[0] - e, nb[1], ob[2] + e, nb[3] if fly else ob[3])  # pieds sur la dernière ligne (sauf volants)
    return [crop_to(c, box) for c in fr]


def shear(c, k, base):
    """Penche le dessin : x décalé de -k * (base - y) (k > 0 : le haut part vers la gauche, vers le héros)."""
    n = Canvas(c.lw, c.lh)
    for y in range(c.h):
        dx = -int(round(k * (base - (y - M))))
        for x in range(c.w):
            p = c.px[y][x]
            if p is not None and 0 <= x + dx < c.w:
                n.px[y][x + dx] = p
    return n


def blit(dst, src, dx=0, dy=0):
    """Copie les pixels opaques de src sur dst, décalés de (dx, dy)."""
    for y in range(src.h):
        for x in range(src.w):
            p = src.px[y][x]
            if p is not None and 0 <= x + dx < dst.w and 0 <= y + dy < dst.h:
                dst.px[y + dy][x + dx] = p


def empty_set(c, x, y, col):
    if c.get(x, y) is None:
        c.set(x, y, col)


def speed_lines(c, pts, col, col2=None):
    """Traits de vitesse horizontaux (sur le vide uniquement) : [(x, y, longueur)]."""
    for x, y, ln in pts:
        for i in range(ln):
            empty_set(c, x + i, y, col if (col2 is None or i < ln - 1) else col2)


def swoosh(c, cx, cy, r, a0, a1, cols, th=2.0, ry=1.0):
    """Arc de mouvement (traînée de coup) sur le vide : cols = (bord, cœur)."""
    for y in range(int(cy - r * ry - 2), int(cy + r * ry + 3)):
        for x in range(int(cx - r - 2), int(cx + r + 3)):
            dx, dy = x + 0.5 - cx, (y + 0.5 - cy) / ry
            d = math.hypot(dx, dy)
            a = math.degrees(math.atan2(dy, dx))
            if a0 <= a <= a1 and r - th <= d <= r:
                u = (a - a0) / max(1, a1 - a0)
                if u < 0.25 and (x + y) % 2:
                    continue
                empty_set(c, x, y, cols[1] if d > r - th * 0.5 and u > 0.35 else cols[0])


def star(c, x, y, r, cols):
    """Petite étoile d'impact (4 branches + diagonales courtes)."""
    c.set(x, y, cols[0])
    for k in range(1, r + 1):
        col = cols[0] if k < r else cols[1]
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            empty_set(c, x + dx * k, y + dy * k, col)
    for dx, dy in ((1, 1), (-1, -1), (1, -1), (-1, 1)):
        empty_set(c, x + dx, y + dy, cols[1])


# ================================================================ GLUANTS

def slime_fn(R, mood, extra=None):
    def fn(f):
        c = Canvas(30, 26)
        if f < 2:  # copie exacte de enemies.slime_draw
            top, rx = (2, 9.5) if f == 0 else (4, 10.5)
            bottom = 17
            slime_body(c, 11, top, bottom, rx, R)
            slime_face(c, 9 - f * 0.4, top + 5 + (f == 0), mood, R)
            if extra:
                extra(c, f, top)
            return c
        # bond : corps étiré vers l'avant et penché, visage furieux
        top, rx, bottom = 5, 12, 17
        slime_body(c, 12, top, bottom, rx, R, flare=1.2)
        if extra:
            extra(c, 1, top)
        c = shear(c, 0.5, bottom)
        slime_face(c, 6, top + 4, 'angry', R)
        return c

    def fx(c, f):
        if f == 2:  # traînée et gouttelettes derrière
            speed_lines(c, [(24, 6, 4), (25, 10, 3), (24, 14, 4)], R[3], R[2])
            for x, y in ((26, 3), (27, 16), (23, 1)):
                empty_set(c, x, y, R[2])
    return trio(fn, fx)


def slime():
    return slime_fn(G_SLIME, 'happy')


def slime_blue():
    return slime_fn(B_SLIME, 'sad')


def slime_ice():
    def extra(c, f, top):
        ice_crystal(c, 11, top + 2, 7 + (f == 0), 4)
        ice_crystal(c, 7, top + 3, 5, 3)
        ice_crystal(c, 15, top + 3, 4 + (f == 0), 3)
        c.set(4, top + 3, ICE[4]); c.set(19, top + 1 - f, ICE[3])
    return slime_fn(I_SLIME, 'calm', extra)


def slime_fire():
    def fn(f):
        c = Canvas(30, 30)
        cx, bottom = 11, 21
        atk = f == 2
        g = 1 if f else 0
        body, _, _ = dome_mask(cx, 9 + g, bottom, 10 + g * 0.6)
        s = 1 if f else -1
        lean = -4 if atk else 0  # flammes rabattues vers l'avant
        tongues = [
            [(1, 16), (0 + lean, 6 + g), (5, 11)],
            [(3, 13), (5 + s + lean, 2 + g), (9, 9)],
            [(7, 10), (11 - s + lean, -1 + g * 2), (15, 9)],
            [(13, 11), (17 + s + lean, 3 + g), (19, 12)],
            [(18, 14), (22 + lean, 8 + g), (21, 17)],
        ]
        mask = set(body)
        for t in tongues:
            mask |= mask_of(lambda m: m.poly(t, '#000'))
        flame_shade(c, mask, F_SLIME, cx - 1, bottom - 5, 12, 12)
        c.line(5 + s + lean, 5 + g, 6, 10, F_SLIME[3]); c.line(11 - s + lean, 2 + g * 2, 11, 7, F_SLIME[3])
        if atk:
            ey = 13
            eye(c, 5, ey, 2, 3); eye(c, 10, ey, 2, 3)
            brow(c, 4, ey - 2, 6, ey - 1, INK); brow(c, 10, ey - 1, 12, ey - 2, INK)
            open_mouth(c, 6, ey + 4, 4, 3)
            # boule de feu crachée
            fb = mask_of(lambda m: m.ellipse(-5, 15, 3.4, 3, '#000'))
            fb |= mask_of(lambda m: m.poly([(-4, 12.5), (2, 14), (-4, 17.5)], '#000'))
            flame_shade(c, fb, F_SLIME, -6, 15, 5, 4)
            c.set(-6, 14, F_SLIME[4]); c.set(-7, 15, F_SLIME[4])
        else:
            from enemies import slime_face as _sf
            _sf(c, 9, 12 + f, 'angry', F_SLIME, mouth_col=INK)
            c.set(16, 0 + f, F_SLIME[3]); c.set(2 + f, 2, F_SLIME[2])
        return c

    def fx(c, f):
        if f == 2:
            for x, y in ((4, -1), (-1, 9), (9, -2), (-9, 11), (-10, 18)):
                empty_set(c, x, y, F_SLIME[3])
    return trio(fn, fx)


# ================================================================ GOBELIN

def goblin():
    def fn(f):
        c = Canvas(30, 32)
        if f < 2:
            oy = -f
            goblin_legs(c, f, oy, GOB_PANTS, LEATHER)
            goblin_torso(c, oy, GOB_TUNIC, G_SKIN)
            goblin_head(c, oy, G_SKIN)

            def club(t):
                sline(t, 2, 20 + oy, -2, 9 + oy, WOOD, 2)
                sell(t, -2.5, 7.5 + oy, 2.4, 3.6, WOOD)
                t.set(-4, 6 + oy, STEEL[4]); t.set(-1, 5 + oy, STEEL[4]); t.set(-1, 9 + oy, STEEL[3])
            part(c, club)
            sell(c, 2.5, 18.5 + oy, 2, 1.8, G_SKIN)
            return c
        # attaque : fente avant, buste penché, gourdin abattu devant
        oy = 1
        # jambes écartées (arrière tendue, avant fléchie)
        spoly(c, [(12, 20), (15, 20), (17, 24), (14, 24)], dk(GOB_PANTS, -0.1))
        sell(c, 16, 24.6, 2.4, 1.3, dk(LEATHER, -0.1))
        spoly(c, [(4, 20), (7, 20), (6, 24), (3, 24)], GOB_PANTS)
        sell(c, 3.6, 24.6, 2.5, 1.3, LEATHER)
        up = Canvas(30, 32)
        goblin_torso(up, oy, GOB_TUNIC, G_SKIN)
        goblin_head(up, oy, G_SKIN)
        # bouche grande ouverte (cri de guerre)
        for x in range(4, 9):
            up.set(x, 15 + oy, '#7a1a2a')
        up.set(4, 14 + oy, WHITE); up.set(8, 14 + oy, WHITE)
        for x in range(3, 10):
            up.set(x, 16 + oy, INK)
        blit(c, up, -2, 0)

        def club(t):
            sline(t, 1, 17, -6, 19, WOOD, 2)
            sell(t, -8, 19.5, 3.6, 2.6, WOOD)
            t.set(-10, 18, STEEL[4]); t.set(-7, 17, STEEL[4]); t.set(-9, 21, STEEL[3])
        part(c, club)
        sell(c, 0.5, 17.5, 2, 1.8, G_SKIN)
        return c

    def fx(c, f):
        if f == 2:
            swoosh(c, 1, 18, 10, -178, -112, ('#c8b48a', '#fff4d0'), th=2.2)
            star(c, -11, 23, 2, (WHITE, '#ffe27a'))
            for x, y in ((-6, 24), (-13, 22), (-4, 23)):
                empty_set(c, x, y, DUST[2])
    return trio(fn, fx)


# ================================================================ MANDRAGORE

def mandrake():
    def fn(f):
        c = Canvas(20, 24)
        atk = f == 2
        oy = (0, -2, 0)[f]
        lift = (0, 2, 3)[f]

        def leaves(t):
            t.line(8, 9 + oy, 8, 5 + oy, LEAF[2])
            spoly(t, [(8, 7 + oy), (5, 6.5 + oy - lift), (1, 3 + oy - lift), (3, 1 + oy - lift), (7, 3 + oy)], LEAF, contrast=0.45)
            spoly(t, [(8.5, 7 + oy), (10, 3 + oy), (13.5, 0 + oy + (lift if f == 1 else -lift)),
                      (16, 2.5 + oy + (lift if f == 1 else -lift)), (12, 6.5 + oy)], dk(LEAF, -0.04), contrast=0.45)
            t.line(7, 5 + oy, 3, 2 + oy - lift, LEAF[1])
            t.line(9.5, 5.5 + oy, 14, 1.5 + oy + (lift if f == 1 else -lift), LEAF[1])
            t.set(3, 2 + oy - lift, LEAF[4]); t.set(4, 2 + oy - lift, LEAF[4])
        leaves(c)
        # pieds racines : au repos posés ; en bond, repliés sous le corps et décollés
        if f == 0:
            la, lb, fy = 5, 10, 18.6
        elif f == 1:
            la, lb, fy = 7, 10.5, 17.2
        else:
            la, lb, fy = 4, 11, 18.6
        sell(c, lb, fy, 1.6, 1.4, dk(ROOT, -0.1))
        sell(c, 13.5, 13.5 + oy, 1.5, 1.5, dk(ROOT, -0.1))
        sell(c, 8.5, 13.5 + oy * 0.5 if f == 0 else 13.5 + oy, 5.6, 5.2 if f != 1 else 5.6, ROOT)
        spoly(c, [(7, 8.6 + oy), (10, 8.6 + oy), (9, 10 + oy)], ROOT)
        sell(c, la, fy, 1.6, 1.4, ROOT)
        c.setf(12, 12 + oy, ROOT[1]); c.setf(12, 15 + oy, ROOT[1]); c.setf(11, 17 + oy, ROOT[1])
        ey = 12 + oy
        if atk:
            # cri : yeux plissés, bouche grande ouverte
            c.line(3, ey + 1, 5, ey + 2, INK); c.line(8, ey + 2, 10, ey + 1, INK)
            c.line(3, ey, 5, ey + 1, INK)
            open_mouth(c, 4, ey + 3, 4, 3)
            sell(c, 1.5, 12.5 + oy, 1.5, 1.5, ROOT)  # bras levé
        else:
            eye(c, 4, ey, 2, 3); eye(c, 8, ey, 2, 3)
            if f:
                smile(c, 5, ey + 3, 3)
            else:
                c.set(6, ey + 4, INK); c.set(5, ey + 4, INK)
            blush(c, 2, ey + 3); blush(c, 10, ey + 3)
            sell(c, 2.5, 14.5 + oy - (f == 1), 1.5, 1.5, ROOT)
        return c

    def fx(c, f):
        if f == 2:  # ondes sonores
            for r, col in ((5, '#fff4b0'), (8, '#e8d27a')):
                for a in range(140, 222, 9):
                    t = math.radians(a)
                    empty_set(c, 4 + math.cos(t) * r, 15 + math.sin(t) * r * 1.2, col)

    return trio(fn, fx)


# ================================================================ CHAMPIGNONS

def mushroom_fn(CAP, SPOTC, mood, skin=None):
    STEM = skin or ['#7a5a4a', '#c0987a', '#ecd2ae', '#fff2da']

    def fn(f):
        c = Canvas(26, 28)
        atk = f == 2
        b = (0, -3, 1)[f]        # décalage vertical du corps (bond : -3)
        sq = (0, -1, 1)[f]       # chapeau écrasé (> 0) ou étiré (< 0)
        hx = -2 if atk else 0    # coup de tête : chapeau projeté vers l'avant
        if f == 0:
            fa, fb, fy = 5, 12, 21
        elif f == 1:
            fa, fb, fy = 7, 10, 19
        else:
            fa, fb, fy = 3, 12, 21
        sell(c, fb + 0.5, fy, 2.2, 1.4, dk(STEM, -0.12))
        sell(c, 14.5, 16 + b, 1.6, 1.8, dk(STEM, -0.1))
        sell(c, 9.5 + hx * 0.5, 15.5 + b * 0.5 if f == 0 else 15.5 + b, 5.4, 5.2, STEM)
        sell(c, fa + 0.5, fy, 2.2, 1.4, STEM)
        cy = 9.5 + b + sq
        mask = mask_of(lambda m: m.ellipse(10 + hx, cy, 10 + (atk and 1), 8.5 - sq, '#000'))
        mask = {(x, y) for (x, y) in mask if y <= 10 + b + sq}

        def capf(t):
            shade_mask(t, mask, CAP, contrast=0.42)
            for (x, y) in mask:
                if y == 10 + b + sq:
                    t.set(x, y, CAP[1] if x < 10 + hx else CAP[0])
            for (x, y, r) in ((5, 5, 1.9), (11, 3, 1.5), (15.5, 6.5, 1.8), (9.5, 7.5, 1.1), (2, 9, 0.9), (18, 9.5, 0.8)):
                yy = y + b + sq * (1 if y < 8 else 0)
                t.ellipse(x + hx, yy, r, r * 0.9, SPOTC[1], only_inside=True)
                t.setf(x - 0.5 + hx, yy - 0.5, SPOTC[2])
                t.setf(x + 0.6 + hx, yy + 0.7, SPOTC[0])
            t.set(4 + hx, 3 + b + sq, CAP[4]); t.set(3 + hx, 4 + b + sq, CAP[4])
        part(c, capf)
        for x in range(5 + hx, 15 + hx):
            c.setf(x, 11 + b + sq, STEM[0] if x % 2 else STEM[1])
        ey = 13 + b + sq
        ex = hx // 2
        if atk:
            eye(c, 5 + ex, ey, 2, 2); eye(c, 10 + ex, ey, 2, 2)
            brow(c, 4 + ex, ey - 1, 7 + ex, ey, INK); brow(c, 10 + ex, ey, 13 + ex, ey - 1, INK)
            open_mouth(c, 7 + ex, ey + 3, 3, 2)
        elif mood == 'angry':
            eye(c, 5, ey, 2, 3); eye(c, 10, ey, 2, 3)
            brow(c, 4, ey - 1, 6, ey, INK); brow(c, 10, ey, 12, ey - 1, INK)
            c.set(5, ey, STEM[2]); c.set(11, ey, STEM[2])
            open_mouth(c, 7, ey + 4, 3, 2)
        else:
            eye(c, 5, ey, 2, 3); eye(c, 10, ey, 2, 3)
            brow(c, 4, ey - 1, 6, ey - 1, STEM[0]); brow(c, 10, ey - 1, 12, ey - 2, STEM[0])
            from enemies import frown
            frown(c, 7, ey + 4, 3)
        blush(c, 3 + ex, ey + 3); blush(c, 12 + ex, ey + 3)
        # bras avant : balancé en l'air pendant le bond, tendu pendant le coup
        if f == 1:
            sell(c, 3, 14 + b, 1.6, 1.8, STEM)
        elif atk:
            sell(c, 2, 18, 1.8, 1.6, STEM)
        else:
            sell(c, 4, 17 + b, 1.6, 1.8, STEM)
        return c

    def fx(c, f):
        if f == 2:  # nuage de spores devant
            pale = mix(SPOTC[1], CAP[3], 0.35)
            for x, y, r in ((-4, 9, 2.2), (-6, 14, 2.6), (-3, 18, 2.0), (-8, 10, 1.4)):
                for yy in range(int(y - r), int(y + r) + 1):
                    for xx in range(int(x - r), int(x + r) + 1):
                        if (xx - x) ** 2 + (yy - y) ** 2 <= r * r and (xx + yy) % 2 == 0:
                            empty_set(c, xx, yy, pale if (xx + 2 * yy) % 3 else SPOTC[2])
            star(c, -1, 6, 1, (WHITE, SPOTC[1]))
        if f == 1:
            for x in range(5, 14):
                empty_set(c, x, 21, mix(STEM[0], '#2e3a4e', 0.5)) if x % 2 else None
    return trio(fn, fx)


def mushroom():
    return mushroom_fn(['#5a0e26', '#a41c30', '#e23a36', '#ff7a5a', '#ffb88e'],
                       ['#c8b4b0', '#fbf2ea', '#ffffff'], 'angry')


def mushroom_green():
    return mushroom_fn(['#163a1a', '#2a6a26', '#4c9a32', '#80c84a', '#c0ec84'],
                       ['#a8b07a', '#eef0b0', '#fffff0'], 'grumpy')


# ================================================================ SQUELETTE

def skeleton():
    def fn(f):
        c = Canvas(26, 32)
        if f < 2:
            oy = -f
            skeleton_base(c, f, oy)
            skull(c, 8, 6.5 + oy)

            def sword(t):
                sline(t, 1, 15 + oy, 0, 3 + oy, STEEL, 2)
                t.line(-0.4, 4 + oy, -0.4, 14 + oy, STEEL[4])
                t.set(0, 2 + oy, STEEL[4])
                for x, y in ((1, 7), (0, 10), (1, 12)):
                    t.set(x, y + oy, RUST[2])
                t.rect(-2, 15 + oy, 6, 1, GOLD[1]); t.set(-2, 15 + oy, GOLD[3])
                t.rect(0, 16 + oy, 2, 2, LEATHER[2])
            part(c, sword)
            bone_line(c, 6, 13 + oy, 2, 16 + oy)
            sell(c, 1.5, 16.5 + oy, 1.5, 1.4, BONE)
            return c
        # estoc : fente avant, buste penché, épée tendue à l'horizontale
        oy = 1
        bone_line(c, 10, 19 + oy, 14, 26)          # jambe arrière tendue
        sell(c, 14, 26.5, 2.2, 1.1, dk(BONE, -0.08))
        bone_line(c, 7, 19 + oy, 3, 23)            # jambe avant fléchie
        bone_line(c, 3, 23, 2, 26)
        sell(c, 1.5, 26.5, 2.2, 1.1, BONE)
        sell(c, 8.5, 19 + oy, 3.6, 1.6, BONE)
        bone_line(c, 11, 13 + oy, 14, 17 + oy)
        up = Canvas(26, 32)
        sell(up, 8.5, 14.5 + oy, 3.8, 3, BONE)
        for y in (14, 16):
            up.line(5.6, y + oy, 11, y + oy, BONE[0])
        for y in range(12, 19):
            up.set(9, y + oy, BONE[3] if y % 2 else BONE[2])
        skull(up, 7, 6.5 + oy)
        blit(c, up, -2, 0)

        def sword(t):
            sline(t, 0, 15, -12, 15, STEEL, 2)
            t.line(-11, 14.6, -1, 14.6, STEEL[4])
            t.set(-13, 15, STEEL[4])
            for x in (-4, -7, -9):
                t.set(x, 15, RUST[2])
            t.rect(0, 13, 1, 5, GOLD[1]); t.set(0, 13, GOLD[3])
            t.rect(1, 14, 2, 2, LEATHER[2])
        part(c, sword)
        bone_line(c, 4, 13 + oy, 2, 15)
        sell(c, 2, 15.5, 1.5, 1.4, BONE)
        return c

    def fx(c, f):
        if f == 2:
            speed_lines(c, [(-10, 12, 6), (-8, 18, 5), (4, 11, 3)], '#c4d0e0', '#eef2f8')
            star(c, -16, 15, 2, (WHITE, '#b4c0d4'))
    return trio(fn, fx)


# ================================================================ GOLEM

def golem():
    def fn(f):
        c = Canvas(42, 44)
        atk = f == 2
        oy = (0, -1, 1)[f]
        if f == 0:
            lx, rx_ = 11, 22
        elif f == 1:
            lx, rx_ = 14, 19
        else:
            lx, rx_ = 9, 23
        Sd = dk(STONE, -0.08)
        sh = (0, 1, -2)[f]      # épaules qui roulent (x) : le torse pivote
        # bras arrière
        sell(c, 31 + sh, 19 + oy, 5, 5.6, Sd)
        sell(c, 33 + sh, 27 + oy, 4.4, 5, Sd)
        sell(c, 33.5 + sh, 32.5 + oy, 4.4, 3.4, Sd)
        # jambes trapues (en marche : la jambe arrière se lève d'un pixel)
        lift_b = 1 if f == 1 else 0
        spoly(c, [(rx_, 30), (rx_ + 6, 30), (rx_ + 7, 38 - lift_b), (rx_ - 1, 38 - lift_b)], Sd)
        spoly(c, [(lx, 30), (lx + 6, 30), (lx + 7, 38), (lx - 1, 38)], STONE)
        tm = mask_of(lambda m: m.ellipse(21 + sh * 0.5, 22 + oy, 12, 9.5, '#000'))
        shade_mask(c, tm, STONE, contrast=0.42)
        mossify(c, tm, 1)
        ox = int(sh * 0.5)
        c.line(22 + ox, 16 + oy, 25 + ox, 20 + oy, STONE[1]); c.line(25 + ox, 20 + oy, 24 + ox, 24 + oy, STONE[1])
        c.line(16 + ox, 26 + oy, 20 + ox, 29 + oy, STONE[1]); c.line(28 + ox, 25 + oy, 30 + ox, 28 + oy, STONE[1])
        gx = 26 + ox
        c.set(gx, 24 + oy, GREEN_GEM[3]); c.set(gx + 1, 24 + oy, GREEN_GEM[2]); c.set(gx, 25 + oy, GREEN_GEM[2]); c.set(gx + 1, 25 + oy, GREEN_GEM[1])
        HEAD = ['#34323f', '#5a5a70', '#828296', '#aeaebc', '#d6d6de']
        hdx = -2 if atk else 0
        hm = mask_of(lambda m: m.ellipse(14 + hdx, 10 + oy, 7.2, 6.2, '#000'))

        def head(t):
            shade_mask(t, hm, HEAD, contrast=0.4)
            mossify(t, hm, 3)
            ey = round(10 + oy)
            t.ellipse(12.5 + hdx, ey + 1.2, 5.2, 2.2, HEAD[1], only_inside=True)
            for ex in (8 + hdx, 14 + hdx):
                t.rect(ex, ey, 3, 2, '#ffd84a')
                t.set(ex, ey, '#fff6c0'); t.set(ex + 2, ey + 1, '#e08a1a')
            t.line(7 + hdx, ey - 2, 11 + hdx, ey - 1, HEAD[0]); t.line(13 + hdx, ey - 1, 18 + hdx, ey - 3, HEAD[0])
            t.line(7 + hdx, ey - 3, 11 + hdx, ey - 2, HEAD[4])
            if atk:  # mâchoire ouverte (rugissement)
                t.rect(9 + hdx, ey + 3, 7, 2, '#1a1622')
                t.line(9 + hdx, ey + 3, 15 + hdx, ey + 3, INK)
                t.set(10 + hdx, ey + 4, '#ffd84a'); t.set(13 + hdx, ey + 4, '#e08a1a')
            else:
                t.line(9, ey + 4, 15, ey + 4, INK)
                t.set(9, ey + 3, INK); t.set(15, ey + 3, INK)
            t.line(19 + hdx, 8 + oy, 20 + hdx, 11 + oy, HEAD[1])
        part(c, head)
        if atk:
            # bras avant abattu : épaule, avant-bras tendu vers l'avant, poing au sol
            am = mask_of(lambda m: m.ellipse(8, 21 + oy, 5.6, 6, '#000'))

            def arm(t):
                shade_mask(t, am, STONE, contrast=0.42)
                mossify(t, am, 5)
                sell(t, 2, 28, 4.8, 4.6, STONE)
                sell(t, -3.5, 34, 5.4, 4.0, STONE)
                t.line(-7, 33, -5, 35, STONE[1]); t.line(-3, 32, -2, 36, STONE[1])
                t.line(3, 24, 6, 26, STONE[1])
            part(c, arm)
        else:
            am = mask_of(lambda m: m.ellipse(8 + sh * 0.3, 21 + oy, 5.6, 6, '#000'))
            fdx = (0, -1, 0)[f]

            def arm(t):
                shade_mask(t, am, STONE, contrast=0.42)
                mossify(t, am, 5)
                sell(t, 6 + fdx, 29 + oy, 4.8, 4.6, STONE)
                sell(t, 5.5 + fdx, 34.5 + oy, 5, 3.6, STONE)
                t.line(2 + fdx, 34 + oy, 4 + fdx, 35 + oy, STONE[1]); t.line(6 + fdx, 33 + oy, 7 + fdx, 36 + oy, STONE[1])
                t.line(4, 24 + oy, 7, 26 + oy, STONE[1])
            part(c, arm)
        return c

    def fx(c, f):
        if f == 2:  # impact : éclats de roche et poussière
            for x, y, col in ((-10, 37, DUST[2]), (-11, 34, DUST[1]), (2, 37, DUST[2]), (3, 35, DUST[3]),
                              (-8, 31, STONE[3]), (0, 31, STONE[3]), (-12, 30, STONE[2]), (4, 30, STONE[2]),
                              (-13, 37, DUST[1]), (5, 37, DUST[1])):
                empty_set(c, x, y, col)
            star(c, -4, 39, 2, (WHITE, DUST[3]))
    return trio(fn, fx)


# ================================================================ SCORPION

def scorpion_draw(f, s=1.0, R=SCORP):
    """Copie de enemies.scorpion_draw ; f = 1 : marche marquée (queue, pinces) ; f = 2 : coup de dard."""
    def P(pts):
        return [(x * s, y * s) for x, y in pts]
    c = Canvas(int(38 * s) + 4, int(28 * s) + 4)
    Rd = dk(R, -0.12)
    lw = max(1, int(s))
    atk = f == 2
    by = 0.5 if f == 1 else 0
    for i, x in enumerate((12, 15, 18, 21)):
        k = (1 if (i + min(f, 1)) % 2 else -1) * (1.6 if f == 1 else 1)
        c.line(x * s, 15 * s, (x - 2 + k * 0.7) * s, 17 * s, Rd[1], lw + 1)
        c.line((x - 2 + k * 0.7) * s, 17 * s, (x - 3 + k) * s, 20 * s, Rd[1], lw)
        c.set((x - 3 + k) * s, 20 * s, Rd[3])
    if atk:
        # queue lancée par-dessus la tête, dard vers l'avant-bas
        seg = [(24, 11.5, 3.8, 3.4), (25.5, 6.5, 3.4, 3.2), (22.5, 2.5, 3, 3), (17.5, 0.5, 2.8, 2.6), (12.5, 1, 2.6, 2.2)]
        for x, y, rx, ry in seg:
            sell(c, x * s, y * s, rx * s, ry * s, R)
            c.set((x - rx * 0.4) * s, (y - ry * 0.5) * s, R[4])
        spoly(c, P([(10.5, -0.5), (5, 4.5), (11, 3.5)]), ['#3a1a2a', '#8a3a5a', '#e06a8a', '#ffc0d0'])
        c.set(5.5 * s, 4 * s, '#ffe0e8')
    else:
        sw = (0, 1.4)[f]
        seg = [(24, 12.5, 3.8, 3.4), (27.5 - sw * 0.3, 9, 3.4, 3.2), (29 - sw * 0.6, 5 + sw * 0.2, 3, 3),
               (27.6 - sw, 1.6 + sw * 0.5, 2.8, 2.6), (24 - sw, 0 + sw, 2.6, 2.2)]
        if f == 0:
            seg = [(24, 12.5, 3.8, 3.4), (27.5, 9, 3.4, 3.2), (29, 5, 3, 3), (27.6, 1.6, 2.8, 2.6), (24, 0, 2.6, 2.2)]
        for x, y, rx, ry in seg:
            sell(c, x * s, y * s, rx * s, ry * s, R)
            c.set((x - rx * 0.4) * s, (y - ry * 0.5) * s, R[4])
        tx, ty = seg[-1][0] - 2, seg[-1][1]
        spoly(c, P([(tx, ty - 0.6), (tx - 5, ty + 2.4), (tx, ty + 2.4)]), ['#3a1a2a', '#8a3a5a', '#e06a8a', '#ffc0d0'])
        c.set((tx - 5) * s, (ty + 2) * s, '#ffe0e8')
    sell(c, 17, 13.5 + by, 8.4, 4.4, R)
    for x in (14, 18, 22):
        c.line(x * s, (9.6 + by) * s, (x + 0.6) * s, 17 * s, R[1])
    fo = 1 if f else 0
    sline(c, 9 * s, 14 * s, 6 * s, 17 * s, Rd, 2 + lw)
    sell(c, 4 * s, 17.4 * s, 3.4 * s, 2.6 * s, Rd)
    spoly(c, P([(2, 15.4), (-2.4, 15 + fo), (-2, 16.6 + fo), (1.6, 17)]), Rd)
    spoly(c, P([(1.6, 18.4), (-1.4, 19.4), (1.4, 20), (4, 19.8)]), Rd)
    sell(c, 9 * s, (13 + by) * s, 4.8 * s, 4 * s, R)
    if atk:
        # pince avant projetée vers l'avant, grande ouverte
        sline(c, 8 * s, 12 * s, 2 * s, 11 * s, R, 2 + lw)
        sell(c, -0.5 * s, 10.5 * s, 4.2 * s, 3.2 * s, R)
        spoly(c, P([(-2.5, 8.5), (-8, 5.5), (-7.5, 7.5), (-3.5, 10)]), R)
        spoly(c, P([(-2.5, 12), (-7.5, 14.5), (-4, 14.5), (0, 13.5)]), R)
        c.set(-2 * s, 9 * s, R[4]); c.set(-1 * s, 9 * s, R[4])
    else:
        cl = (0, -1.2)[f]  # pince levée plus haut à la 2e image (claquement)
        sline(c, 9 * s, 11 * s, 6 * s, (7.4 + cl) * s, R, 2 + lw)
        sell(c, 3.6 * s, (6.4 + cl) * s, 4.4 * s, 3.4 * s, R)
        spoly(c, P([(1.6, 3.6 + cl), (-3.4, 2.6 - fo + cl), (-3, 4.6 - fo + cl), (0.6, 5.4 + cl)]), R)
        spoly(c, P([(1, 7.6 + cl), (-2.6, 8.4 + cl + fo), (0.4, 9.6 + cl), (4, 9.2 + cl)]), R)
        c.set(2 * s, (4.6 + cl) * s, R[4]); c.set(3 * s, (4.6 + cl) * s, R[4]); c.set(1 * s, (5 + cl) * s, R[4])
    ex, ey = round(6 * s), round((11 + by) * s)
    for dx in (0, 4):
        c.rect(ex + dx, ey, 2, 2, '#ffe24a'); c.set(ex + dx, ey + 1, INK); c.set(ex + dx + 1, ey + 1, INK)
    c.line(ex - 1, ey - 2, ex + 1, ey - 1, INK); c.line(ex + 4, ey - 1, ex + 6, ey - 2, INK)
    if atk:
        c.rect(ex, ey + 3, 6, 2, '#7a1a2a'); c.line(ex, ey + 3, ex + 5, ey + 3, INK)
        c.set(ex + 1, ey + 4, WHITE); c.set(ex + 4, ey + 4, WHITE)
    else:
        c.line(ex, ey + 3, ex + 5, ey + 3, INK); c.set(ex + 1, ey + 4, WHITE); c.set(ex + 4, ey + 4, WHITE)
    return c


def scorpion():
    def fx(c, f):
        if f == 2:
            swoosh(c, 15, 9, 12, -175, -95, ('#e06a8a', '#ffc0d0'), th=1.6)
            star(c, 3, 6, 1, (WHITE, '#ffc0d0'))
            speed_lines(c, [(-12, 7, 3), (-11, 13, 3)], SCORP[3])
    return trio(lambda f: scorpion_draw(f), fx)


# ================================================================ LICHE

def lich():
    def fn(f):
        c = Canvas(28, 38)
        atk = f == 2
        oy = (0, -2, -1)[f]
        s = (-1, 1.6, 1)[f]
        spoly(c, [(15, 13 + oy), (19, 14 + oy), (20 + (f == 1), 21 + oy), (17, 21 + oy)], dk(ROBE, -0.08))
        hem = [(21, 31), (19 + s * 0.5, 33), (16, 31.5), (13 - s * 0.5, 33), (10, 31.5), (7 + s * 0.5, 33), (4, 31.5), (2, 33)]
        if f == 1:  # la robe flotte : l'ourlet remonte et traîne vers l'arrière
            hem = [(22, 30), (20.5, 32.5), (17, 31), (14.5, 33), (11, 31), (8.5, 33), (5, 31), (3.5, 32.5)]
        robe = [(7, 12 + oy), (16, 12 + oy), (22 + (f == 1), 30)] + hem + [(1 + (f == 1), 31)]
        spoly(c, robe, ROBE, contrast=0.4)
        for x in (8, 12, 16):
            c.line(x + 1, 16 + oy, x + (x - 11) * 0.5 + (f == 1), 30, ROBE[1])
        c.line(6, 16 + oy, 3 + (f == 1), 30, ROBE[4])
        for x in range(5, 19):
            c.setf(x, 20 + oy, GOLD[2] if x < 12 else GOLD[1])
        c.setf(10, 21 + oy, PURPLE_GLOW[3]); c.setf(10, 22 + oy, PURPLE_GLOW[2])
        spoly(c, [(13, 4 + oy), (21 + (f == 1), 9 + oy + (f == 1)), (17, 12 + oy)], ROBE)
        sell(c, 11, 9 + oy, 7, 7, ROBE)
        c.ellipse(9, 10.6 + oy, 4.6, 4.6, '#12061e')
        sell(c, 8.5, 10.5 + oy, 3.8, 3.6, BONE[1:])
        c.rect(5, 9 + oy, 3, 3, INK); c.rect(9, 9 + oy, 3, 3, INK)
        glow = PURPLE_GLOW[4] if not atk else WHITE
        c.set(6, 10 + oy, glow); c.set(7, 10 + oy, PURPLE_GLOW[3]); c.set(6, 11 + oy, PURPLE_GLOW[2])
        c.set(10, 10 + oy, glow); c.set(11, 10 + oy, PURPLE_GLOW[2])
        if atk:
            c.rect(6, 13 + oy, 5, 1, INK); c.set(7, 14 + oy, INK); c.set(9, 14 + oy, INK)
        else:
            for x in (6, 8, 10):
                c.set(x, 13 + oy, INK)
        c.set(8, 12 + oy, BONE[0])
        c.line(4, 8 + oy, 7, 5 + oy, ROBE[4])
        if atk:
            # bâton brandi vers l'avant, orbe flamboyant
            def staff(t):
                sline(t, -3, 2 + oy, 6, 27, ['#1a1020', '#3a2430', '#5a3a40', '#7a5a52'], 2)
                sell(t, -4.5, -1.5 + oy, 4.2, 4.2, PURPLE_GLOW)
                t.set(-6, -3 + oy, WHITE); t.set(-5, -4 + oy, WHITE); t.set(-6, -2 + oy, PURPLE_GLOW[4])
                for (x0, y0, x1, y1) in ((-8, 1.5, -9.5, -3), (-1, 1.5, 0, -4)):
                    t.line(x0, y0 + oy, x1, y1 + oy, '#4a3446')
            part(c, staff)
            # main libre tendue, paume ouverte vers le héros
            spoly(c, [(7, 13 + oy), (10, 14 + oy), (2, 15 + oy), (1, 13 + oy)], ROBE)
            c.set(0, 13 + oy, BONE[3]); c.set(-1, 13 + oy, BONE[2]); c.set(0, 14 + oy, BONE[2]); c.set(-1, 12 + oy, BONE[3])
        else:
            tilt = 1 if f == 1 else 0

            def staff(t):
                sline(t, 1 + tilt, 8 + oy, 2.6, 33, ['#1a1020', '#3a2430', '#5a3a40', '#7a5a52'], 2)
                sell(t, 0.5 + tilt, 4 + oy, 3.2, 3.2, PURPLE_GLOW)
                t.set(-0.5 + tilt, 3 + oy, WHITE); t.set(0 + tilt, 2 + oy, PURPLE_GLOW[4])
                for (x0, y0, x1, y1) in ((-2.5, 6.5, -3.5, 2), (3.5, 6.5, 4, 1.5)):
                    t.line(x0 + tilt, y0 + oy, x1 + tilt, y1 + oy, '#4a3446')
                ff = min(f, 1)
                for x, y in ((-5, 3 + ff * 2), (6, 4 - ff), (-5, 8 + ff), (5, 9 - ff)):
                    t.set(x + tilt, y + oy, PURPLE_GLOW[3])
            part(c, staff)
            spoly(c, [(7, 13 + oy), (10, 14 + oy), (5, 19 + oy), (2, 18 + oy)], ROBE)
            c.set(2, 17 + oy, BONE[3]); c.set(1, 18 + oy, BONE[2]); c.set(3, 18 + oy, BONE[2])
        return c

    def fx(c, f):
        if f == 2:
            # éclair violet lancé vers l'avant depuis l'orbe
            pts = [(-9, -1), (-12, 3), (-10, 5), (-14, 10), (-12, 12), (-16, 18)]
            for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
                n = int(max(abs(x1 - x0), abs(y1 - y0))) * 2 + 1
                for i in range(n + 1):
                    t = i / n
                    x, y = round(x0 + (x1 - x0) * t), round(y0 + (y1 - y0) * t - 1)
                    empty_set(c, x, y, PURPLE_GLOW[3])
                    empty_set(c, x - 1, y, PURPLE_GLOW[1])
            for x, y in ((-7, -6), (-2, -5), (-11, -3), (-1, 0)):
                empty_set(c, x, y, PURPLE_GLOW[4])
            star(c, -16, 18, 2, (WHITE, PURPLE_GLOW[3]))
    return trio(fn, fx)


# ================================================================ SPECTRE

def wraith():
    def fn(f):
        c = Canvas(26, 26)
        if f < 2:
            oy = f
            s = 1 if f else -1
        else:
            oy, s = 2, 2
        body = mask_of(lambda m: m.ellipse(10, 9 + oy, 8, 8, '#000'))
        tail = [(2, 9 + oy), (18, 9 + oy), (19, 15 + oy), (22 + s, 20 + oy), (17, 18 + oy), (15 + s * 0.5, 20.5 + oy),
                (12, 18 + oy), (9 - s * 0.5, 20.5 + oy), (6, 18 + oy), (3, 20 + oy), (2, 15 + oy)]
        if f == 2:  # traîne étirée vers l'arrière
            tail = [(2, 9 + oy), (18, 9 + oy), (22, 13 + oy), (28, 15 + oy), (21, 17 + oy), (24, 20 + oy),
                    (16, 18.5 + oy), (12, 20 + oy), (8, 18 + oy), (4, 19 + oy), (2, 15 + oy)]
        body |= mask_of(lambda m: m.poly(tail, '#000'))
        shade_mask(c, body, GHOST, contrast=0.38, bias=0.06)
        if f < 2:
            sell(c, 1.5, 11.5 + oy - f, 2.4, 1.6, GHOST)
            sell(c, 19, 11 + oy + f, 2, 1.5, dk(GHOST, -0.05))
            ey = 6 + oy
            eye(c, 5, ey, 2, 4); eye(c, 10, ey, 2, 4)
            c.ellipse(8, 13.2 + oy, 1.7, 2.3, '#2a1838')
            c.set(8, 14 + oy, '#c84a6a'); c.set(7, 14 + oy, '#a83a5a')
            blush(c, 3, ey + 4, '#ffa0c0'); blush(c, 12, ey + 4, '#ffa0c0')
            c.set(4, 3 + oy, WHITE); c.set(5, 2 + oy, WHITE)
            return c
        # plongeon : bras tendus en avant, griffes, regard mauvais, bouche hurlante
        sline(c, 4, 12 + oy, -3, 10 + oy, GHOST, 3)
        sline(c, 5, 15 + oy, -2, 16 + oy, dk(GHOST, -0.05), 3)
        for x, y in ((-5, 8), (-6, 10), (-5, 12), (-4, 14), (-5, 16), (-4, 18)):
            c.set(x, y + oy, '#5a4a8e')
        ey = 6 + oy
        eye(c, 5, ey + 1, 2, 3); eye(c, 10, ey + 1, 2, 3)
        brow(c, 4, ey - 1, 7, ey + 1, '#2a1838'); brow(c, 10, ey + 1, 13, ey - 1, '#2a1838')
        c.ellipse(8, 13.2 + oy, 2.6, 2.6, '#2a1838')
        c.set(8, 14 + oy, '#c84a6a'); c.set(7, 14 + oy, '#a83a5a'); c.set(9, 14 + oy, '#a83a5a')
        c.set(4, 3 + oy, WHITE); c.set(5, 2 + oy, WHITE)
        return c

    def fx(c, f):
        if f == 2:
            speed_lines(c, [(21, 4, 4), (25, 10, 3), (27, 19, 3)], GHOST[2], GHOST[1])
            swoosh(c, -1, 12, 8, 120, 220, (GHOST[1], WHITE), th=1.6)
    return trio(fn, fx, fly=True)


# ================================================================ DIABLOTIN

def imp():
    def fn(f):
        c = Canvas(28, 30)
        R = IMP
        atk = f == 2
        oy = -min(f, 1) if not atk else 0
        if f == 0:
            membrane_wing(c, (13, 12 + oy), (17, 4 + oy), [(22, 1 + oy), (24, 6 + oy), (21, 11 + oy)], (14, 15 + oy), IMP_WING, [IMP_WING[0], R[1], R[3]])
        elif f == 1:
            membrane_wing(c, (13, 12 + oy), (19, 8 + oy), [(24, 7 + oy), (24, 12 + oy), (20, 15 + oy)], (14, 15 + oy), IMP_WING, [IMP_WING[0], R[1], R[3]])
        else:  # ailes déployées vers le haut-arrière (élan)
            membrane_wing(c, (14, 12), (20, 2), [(26, -2), (28, 4), (24, 10)], (15, 15), IMP_WING, [IMP_WING[0], R[1], R[3]])
        tq = 2 if atk else 0
        c.line(13, 20 + oy, 17 + tq, 21 + oy, R[1]); c.line(17 + tq, 21 + oy, 19 + tq, 18 + oy - tq * 0.5, R[1])
        spoly(c, [(18 + tq, 17 + oy - tq * 0.5), (21 + tq, 15.5 + oy - tq * 0.5), (20.5 + tq, 19 + oy - tq * 0.5)], R)
        if atk:
            fx_, bx = 3, 12
        else:
            fx_, bx = (5, 10) if f == 0 else (7, 8)
        spoly(c, [(bx, 19 + oy), (bx + 3, 19 + oy), (bx + 3, 24), (bx + 1, 24)], dk(R[:4], -0.1))
        spoly(c, [(fx_, 19 + oy), (fx_ + 3, 19 + oy), (fx_ + 2, 24), (fx_, 24)], R[:4])
        c.rect(bx, 24, 4, 1, R[0]); c.rect(fx_ - 1, 24, 4, 1, R[0])
        hx = -1 if atk else 0
        sell(c, 9 + hx, 16.5 + oy, 4.6, 4.2, R)
        for (x, y) in mask_of(lambda m: m.ellipse(8.4 + hx, 17.4 + oy, 2.6, 2.4, '#000')):
            c.setf(x, y, R[3])
        hx = -2 if atk else 0
        sell(c, 9 + hx, 8.5 + oy, 6.4, 5.8, R)
        spoly(c, [(4 + hx, 5 + oy), (1 + hx, 0 + oy), (6 + hx, 3 + oy)], ['#5a4a3a', '#a89a7a', '#f0e6c8'])
        spoly(c, [(11 + hx, 3 + oy), (14 + hx, -1.5 + oy), (14.5 + hx, 4 + oy)], ['#4a3a2a', '#8a7a5a', '#d0c4a0'])
        ey = round(7 + oy)
        for ex in (4 + hx, 9 + hx):
            c.rect(ex, ey, 3, 3, '#ffe24a')
            c.set(ex, ey + 1, INK); c.set(ex, ey + 2, INK); c.set(ex + 1, ey + 2, INK)
            c.set(ex + 2, ey + 2, '#e0901a')
        brow(c, 3 + hx, ey - 1, 6 + hx, ey + (1 if atk else 0), R[0]); brow(c, 9 + hx, ey + (1 if atk else 0), 12 + hx, ey - 1, R[0])
        if atk:  # rictus grand ouvert
            for x in range(4 + hx, 11 + hx):
                c.set(x, ey + 4, INK)
            for x in range(5 + hx, 10 + hx):
                c.set(x, ey + 5, '#7a1a2a'); c.set(x, ey + 6, INK)
            c.set(5 + hx, ey + 5, WHITE); c.set(9 + hx, ey + 5, WHITE)
        else:
            for x in range(4, 11):
                c.set(x, ey + 5 if 4 < x < 10 else ey + 4, INK)
            c.set(5, ey + 6, INK); c.set(9, ey + 6, INK)
            for x in range(6, 9):
                c.set(x, ey + 6, '#7a1a2a')
            c.set(5, ey + 5, WHITE); c.set(9, ey + 5, WHITE)
        if atk:
            # fourche pointée à l'horizontale vers le héros
            def fork(t):
                t.line(12, 16, -4, 16, WOOD[1], 1)
                t.line(12, 15, -4, 15, WOOD[3], 1)
                spoly(t, [(-4, 13), (-6, 13), (-6, 18), (-4, 18)], STEEL)
                for y in (13, 15.5, 18):
                    t.set(-9, y, STEEL[4]); t.set(-8, y, STEEL[3]); t.set(-7, y, STEEL[2])
            part(c, fork)
            sell(c, 3, 15.5, 1.6, 1.5, R)
            sline(c, 7, 15, 4, 15.5, R, 2)
        else:
            def fork(t):
                t.line(1, 6 + oy, 2, 24, WOOD[1], 1)
                t.line(0, 7 + oy, 1, 24, WOOD[3], 1)
                spoly(t, [(-2, 5 + oy), (4, 5 + oy), (3, 7 + oy), (-1, 7 + oy)], STEEL)
                for x in (-2, 1, 4):
                    t.set(x, 2 + oy, STEEL[4]); t.set(x, 3 + oy, STEEL[3]); t.set(x, 4 + oy, STEEL[2])
            part(c, fork)
            sell(c, 2, 16 + oy, 1.6, 1.5, R)
            sline(c, 7, 15 + oy, 3, 16 + oy, R, 2)
        return c

    def fx(c, f):
        if f == 2:
            speed_lines(c, [(-6, 11, 5), (-5, 20, 5), (14, 13, 3)], '#ffb08a', '#ff6a4a')
            star(c, -12, 15, 2, (WHITE, '#ffb08a'))
    return trio(fn, fx)


# ================================================================ MOMIE

def mummy():
    def fn(f):
        c = Canvas(28, 32)
        atk = f == 2
        oy = -min(f, 1) if not atk else 0
        B = MUMMY
        if atk:
            fx_, bx = 3, 12
        else:
            fx_, bx = (5, 11) if f == 0 else (7, 9)
        spoly(c, [(bx, 19 + oy), (bx + 3, 19 + oy), (bx + 3 + atk, 25), (bx + atk, 25)], dk(B, -0.1))
        spoly(c, [(fx_, 19 + oy), (fx_ + 3, 19 + oy), (fx_ + 3, 25), (fx_, 25)], B)
        sell(c, bx + 1 + atk, 25.5, 2.4, 1.1, dk(B, -0.12)); sell(c, fx_ + 1, 25.5, 2.4, 1.1, B)
        if atk:
            spoly(c, [(12, 14), (15, 15), (6, 15), (5, 13)], dk(B, -0.1))
        else:
            spoly(c, [(12, 14 + oy), (15, 15 + oy), (8, 17 + oy), (6, 16 + oy)], dk(B, -0.1))
        spoly(c, [(6, 13 + oy), (14, 13 + oy), (15, 20 + oy), (5, 20 + oy)], B)
        hx = -1 if atk else 0
        sell(c, 9.5 + hx, 7.5 + oy, 6.6, 6.2, B)
        for (x, y) in mask_of(lambda m: m.rect(-4, 0, 34, 32, '#000')):
            p = c.get(x, y)
            if p is None or p not in B:
                continue
            k = (y - x // 3) % 4
            if k == 0:
                c.set(x, y, shift(p, dl=-0.1))
            elif k == 1 and p == B[2]:
                c.set(x, y, B[3])
        ey = round(7 + oy)
        c.rect(3 + hx, ey, 9, 3, '#2a1a14')
        c.rect(4 + hx, ey, 3, 3, '#0e0a08')
        c.set(4 + hx, ey + 1, '#b4ff6a'); c.set(5 + hx, ey + 1, '#5ae03a'); c.set(4 + hx, ey, '#eaffc0')
        c.set(9 + hx, ey + 1, '#3a8a2a'); c.set(10 + hx, ey + 1, '#2a5a1a')
        c.line(2 + hx, ey - 1, 12 + hx, ey - 1 + 1, B[3])
        c.line(6 + hx, ey + 3, 13 + hx, ey + 2, B[1])
        if atk:
            c.rect(5 + hx, ey + 5, 4, 2, '#2a1a14'); c.line(5 + hx, ey + 5, 8 + hx, ey + 5, INK)
        else:
            c.set(6, ey + 5, INK); c.set(7, ey + 5, INK); c.set(8, ey + 5, INK)
        if atk:
            # bras avant tendu bas, bandelette fouettée vers l'avant (onde)
            spoly(c, [(7, 13), (10, 15), (1, 16), (0, 13)], B)
            c.setf(2, 14, B[1]); c.setf(5, 14, B[1])
            pts = [(0, 14.5)]
            for i in range(1, 15):
                pts.append((-i * 1.0, 14.5 + math.sin(i * 0.75) * 2.2))
            for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
                c.line(x0, y0, x1, y1, B[3])
                c.line(x0, y0 + 1, x1, y1 + 1, B[1])
            bw = 2
            c.line(15, 9, 21, 9 + bw, B[3]); c.line(21, 9 + bw, 24, 8, B[2])
            c.line(16, 10, 22, 10 + bw, B[1])
        else:
            spoly(c, [(7, 13 + oy), (10, 15 + oy), (2, 17 + oy), (1, 14 + oy)], B)
            c.setf(3, 15 + oy, B[1]); c.setf(5, 14 + oy, B[1])
            bw = f
            c.line(15, 9 + oy, 19, 11 + oy + bw, B[3]); c.line(19, 11 + oy + bw, 21, 14 + oy, B[2])
            c.line(16, 10 + oy, 20, 12 + oy + bw, B[1])
        return c

    def fx(c, f):
        if f == 2:
            for x, y in ((-16, 12), (-17, 16), (-15, 18), (-18, 14)):
                empty_set(c, x, y, '#b4ff6a' if (x + y) % 2 else '#5ae03a')
            speed_lines(c, [(-9, 9, 4), (-10, 20, 4)], MUMMY[3], MUMMY[2])
    return trio(fn, fx)


# ================================================================ export

ENEMIES = {
    'slime': slime, 'slime_blue': slime_blue, 'slime_ice': slime_ice, 'slime_fire': slime_fire,
    'goblin': goblin, 'mandrake': mandrake, 'mushroom': mushroom, 'mushroom_green': mushroom_green,
    'skeleton': skeleton, 'golem': golem, 'scorpion': scorpion, 'lich': lich, 'wraith': wraith,
    'imp': imp, 'mummy': mummy,
}


def build():
    out = {}
    for name, fn in ENEMIES.items():
        a, b, k = fn()
        out[name] = (a, {})
        out[name + '_b'] = (b, {})
        out[name + '_atk'] = (k, {})
    return out
