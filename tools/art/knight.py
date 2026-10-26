"""Chevalier v6 (chibi) : corps 48×48, face à droite, pieds sur y=47, corps centré vers x=20.

Contrat (build) :
  hero_<pose>   : corps seul (jambes, buste, bras), extra {'hand', 'rot', 'head', 'torso'}
  helmet_*      : calques de tête (alignés sur hero_idle, décalés par 'head')
  armor_*, cape_* : calques de buste (alignés sur hero_idle, décalés par 'torso')
  shield        : écu (petit canvas), extra {'x','y'} = coin haut-gauche dans le repère idle
  weapon_*      : armes verticales lame en haut, extra {'grip'}
  fx_*          : effets (couleurs fixes bleu / cyan / blanc)
"""
import math

from lib import Canvas, tag, ramp, rng

W, H = 48, 48
GROUND = 47
OUT = '#1a1226'

# Rampes (sombre -> clair)
STEEL = [tag('steel_dark'), tag('steel_shade'), tag('steel'), tag('steel_light'), tag('steel_hi')]
HERO = [tag('hero_dark'), tag('hero_shade'), tag('hero'), tag('hero_light')]
TRIM = [tag('trim_dark'), tag('trim'), tag('trim_light')]
PLUME_D, PLUME, PLUME_L = tag('plume_dark'), tag('plume'), tag('hero_light')
ITEM = [tag('item_dark'), tag('item_shade'), tag('item'), tag('item_light')]
RAR = [tag('rarity_dark'), tag('rarity'), tag('rarity_light')]
UNDER = '#2b2748'
LEATHER = ramp('#7a4a2a', 4, 0.22)
SKIN = ['#a8604e', '#e39a78', '#ffcfa6', '#ffe6cc']
BLUSH = '#f28a8a'
HAIR = '#5a3424'
EYE = '#1a1226'
FACE_SHADOW = '#3a2440'

# Effets (énergie bleue)
FX_DEEP = '#10227a'
FX_DARK = '#1c46c8'
FX_BLUE = '#2f7cf6'
FX_MID = '#4fb0ff'
FX_CYAN = '#8fe0ff'
FX_PALE = '#d4f6ff'
FX_WHITE = '#ffffff'
# Rampes d'acier biaisées vers le sombre (l'ombrage par normale éclaire beaucoup)
DOME = [STEEL[0], STEEL[1], STEEL[1], STEEL[2], STEEL[2], STEEL[3], STEEL[3], STEEL[4]]
CHEST = [STEEL[1], STEEL[2], STEEL[2], STEEL[3], STEEL[4]]
FX_RAMP = [FX_DEEP, FX_DARK, FX_BLUE, FX_MID, FX_CYAN, FX_PALE, FX_WHITE]


# ---------------------------------------------------------------- outils

def layer():
    return Canvas(W, H)


def stamp(dst, src, outline=OUT):
    """Contourne `src` puis le pose sur `dst` (contour par pièce = séparations internes lisibles)."""
    if outline:
        src.outline(outline)
    dst.paste(src, 0, 0)
    return dst


def limb(c, pts, width, ramp_, light_side=(-0.7, -0.7)):
    """Membre épais le long d'une polyligne, ombré : liseré clair côté lumière, sombre à l'opposé."""
    lo, mid, hi = ramp_
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        c.line(x0, y0, x1, y1, mid, width=width)
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        dx, dy = x1 - x0, y1 - y0
        n = math.hypot(dx, dy) or 1
        nx, ny = -dy / n, dx / n
        if nx * light_side[0] + ny * light_side[1] < 0:
            nx, ny = -nx, -ny
        o = width / 2 - 0.8
        c.line(x0 - nx * o, y0 - ny * o, x1 - nx * o, y1 - ny * o, lo)
        c.line(x0 + nx * o, y0 + ny * o, x1 + nx * o, y1 + ny * o, hi)


def ball(c, cx, cy, rx, ry, ramp5, light=(-0.55, -0.65, 0.52), cuts=(-0.05, 0.33, 0.68, 0.93), only_inside=False):
    """Volume ombré à bandes nettes (5 tons) : bord sombre bas-droite, reflet haut-gauche."""
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
            (c.setf if only_inside else c.set)(x, y, ramp5[idx])


def rounded_rect(c, x0, y0, x1, y1, col, only_inside=False):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            corner = (x in (x0, x1)) and (y in (y0, y1))
            if not corner:
                (c.setf if only_inside else c.set)(x, y, col)


# ---------------------------------------------------------------- corps

POSES = {
    #          torse    tête     pied arrière (dx, levée)  pied avant   main      rot  bras arrière
    'idle':    ((0, 0), (0, 0), (0, 0), (0, 0), (32, 35), 0, 'low'),
    'idle2':   ((0, 1), (0, 1), (0, 0), (0, 0), (32, 36), 0, 'low'),
    'walk1':   ((0, 1), (0, 1), (-4, 0), (4, 0), (31, 36), 0, 'low'),
    'walk2':   ((0, 0), (0, -1), (0, 3), (0, 0), (32, 35), 0, 'low'),
    'walk3':   ((0, 1), (0, 1), (4, 0), (-4, 0), (33, 35), 0, 'low'),
    'walk4':   ((0, 0), (0, -1), (0, 0), (0, 3), (32, 35), 0, 'low'),
    'attack1': ((-1, 0), (-3, 0), (-3, 0), (3, 0), (34, 24), 0, 'back'),
    'attack2': ((1, 1), (2, 1), (-4, 0), (5, 0), (35, 30), 90, 'back'),
    'attack3': ((2, 2), (3, 3), (-4, 0), (5, 0), (34, 37), 90, 'back'),
    'cast':    ((0, 0), (-1, 0), (-3, 0), (3, 0), (34, 27), 0, 'forward'),
    'hurt':    ((-2, 1), (-4, 2), (-2, 0), (2, 1), (29, 34), 0, 'flail'),
    'victory': ((0, -1), (-1, -1), (-1, 0), (1, 0), (35, 21), 0, 'hip'),
}

HIP_Y = 38
BACK_LEG_X, FRONT_LEG_X = 17, 23  # centre des jambes


def leg(c, hip_x, hip_y, foot_x, lift, far):
    """Jambière + soleret. Couleurs plus sombres pour la jambe éloignée."""
    k = 1 if far else 0
    foot_y = GROUND - lift
    top_boot = foot_y - 3
    part = layer()
    for y in range(hip_y, top_boot + 1):
        t = (y - hip_y) / max(1, top_boot - hip_y)
        cx = hip_x + (foot_x - hip_x) * t
        x0 = int(round(cx - 2))
        for i, x in enumerate(range(x0, x0 + 4)):
            idx = [3, 2, 1, 1][i] - k
            part.set(x, y, STEEL[max(0, idx)])
    knee_y = hip_y + (top_boot - hip_y) // 2
    kx = int(round((hip_x + foot_x) / 2)) - 1
    part.set(kx, knee_y, STEEL[4 - k]); part.set(kx + 1, knee_y, STEEL[3 - k])
    part.set(kx, knee_y + 1, STEEL[2 - k]); part.set(kx + 1, knee_y + 1, STEEL[1])
    # soleret arrondi vers l'avant
    fx = int(round(foot_x))
    for y in range(top_boot, foot_y + 1):
        r = y - top_boot
        xa, xb = fx - 2, fx + 1 + min(r, 2)
        for x in range(xa, xb + 1):
            t = (x - xa) / max(1, xb - xa)
            idx = 2 if t < 0.3 else 1 if t < 0.75 else 0
            if r == 0:
                idx += 1
            part.set(x, y, STEEL[max(0, min(4, idx - k))])
    for x in range(fx - 2, fx + 4):
        part.setf(x, foot_y, STEEL[0])
    part.setf(fx - 1, top_boot, TRIM[1 - k])
    part.setf(fx, top_boot, TRIM[2 - k])
    stamp(c, part)


def torso(c, ox, oy):
    """Buste : jupe (tabard du héros), ceinture, cuirasse, épaulière arrière."""
    part = layer()
    # jupe / faltes
    part.poly([(14 + ox, 33 + oy), (27 + ox, 33 + oy), (29 + ox, 38.5 + oy), (12 + ox, 38.5 + oy)], STEEL[1])
    for x in range(12 + ox, 30 + ox):
        part.setf(x, 34 + oy, STEEL[2] if x < 22 + ox else STEEL[1])
    for x in range(12 + ox, 30 + ox):
        part.setf(x, 36 + oy, STEEL[1])
        part.setf(x, 37 + oy, STEEL[0])
    # pan de tabard central (couleur du héros, liseré doré)
    part.poly([(18 + ox, 33 + oy), (24 + ox, 33 + oy), (24 + ox, 40 + oy), (21 + ox, 41 + oy), (18 + ox, 40 + oy)], HERO[2])
    for y in range(34 + oy, 41 + oy):
        part.setf(18 + ox, y, TRIM[1]); part.setf(24 + ox, y, TRIM[0])
        part.setf(19 + ox, y, HERO[3]); part.setf(23 + ox, y, HERO[1])
    part.setf(21 + ox, 41 + oy, TRIM[1]); part.setf(20 + ox, 40 + oy, TRIM[1]); part.setf(22 + ox, 40 + oy, TRIM[0])
    # cuirasse bombée
    ball(part, 20.5 + ox, 28.5 + oy, 7, 6.2, STEEL)
    for x in range(14 + ox, 28 + ox):
        part.setf(x, 33 + oy, STEEL[0])
    # arête centrale + reflet
    for y in range(24 + oy, 32 + oy):
        part.setf(22 + ox, y, STEEL[2])
    part.setf(17 + ox, 26 + oy, STEEL[4]); part.setf(17 + ox, 27 + oy, STEEL[4]); part.setf(18 + ox, 26 + oy, STEEL[4])
    # ceinture de cuir, boucle dorée
    for x in range(13 + ox, 29 + ox):
        part.setf(x, 32 + oy, LEATHER[1]); part.setf(x, 33 + oy, LEATHER[0])
    for x in range(20 + ox, 23 + ox):
        part.set(x, 32 + oy, TRIM[2] if x == 20 + ox else TRIM[1]); part.set(x, 33 + oy, TRIM[0])
    # épaulière arrière (éloignée)
    ball(part, 14.5 + ox, 26.5 + oy, 3.6, 3.2, [STEEL[0], STEEL[0], STEEL[1], STEEL[2], STEEL[3]])
    for x in range(11 + ox, 19 + ox):
        part.setf(x, 28 + oy, TRIM[0])
    stamp(c, part)


def pauldron_front(c, ox, oy, colors=STEEL, trim=TRIM):
    part = layer()
    ball(part, 27 + ox, 26.5 + oy, 4.6, 3.9, colors)
    for x in range(22 + ox, 32 + ox):
        part.setf(x, 29 + oy, trim[1])
        part.setf(x, 30 + oy, trim[0])
    part.setf(23 + ox, 29 + oy, trim[2]); part.setf(24 + ox, 29 + oy, trim[2])
    part.setf(25 + ox, 24 + oy, colors[4]); part.setf(26 + ox, 24 + oy, colors[4]); part.setf(25 + ox, 25 + oy, colors[4])
    part.setf(28 + ox, 27 + oy, trim[1])  # rivet
    stamp(c, part)


def gauntlet(c, x, y, far=False):
    k = 1 if far else 0
    c.shaded_ellipse(x + 0.5, y + 0.5, 2.2, 2.0, LEATHER[0:3] if far else LEATHER)
    c.set(x - 1, y - 1, TRIM[2 - k])


def arm(c, shoulder, elbow, hand, far=False):
    part = layer()
    rp = [STEEL[0], STEEL[1], STEEL[2]] if far else [STEEL[1], STEEL[2], STEEL[3]]
    limb(part, [shoulder, elbow, hand], 3.4, rp)
    part.set(elbow[0], elbow[1], STEEL[3 if far else 4])
    # manchette dorée juste avant la main
    mx = hand[0] + (elbow[0] - hand[0]) * 0.45
    my = hand[1] + (elbow[1] - hand[1]) * 0.45
    part.ellipse(mx, my, 1.6, 1.6, TRIM[0] if far else TRIM[1])
    gauntlet(part, hand[0], hand[1], far)
    stamp(c, part)


def body(pose):
    (tx, ty), (hx, hy), (bdx, blift), (fdx, flift), hand, rot, back = POSES[pose]
    c = layer()
    # gorgerin sous le casque (caché le plus souvent)
    c.rect(17 + hx, 22 + hy, 9, 3, STEEL[1])
    # bras arrière (derrière le buste)
    sh = (15 + tx, 27 + ty)
    if back == 'low':
        arm(c, sh, (13 + tx, 31 + ty), (13 + tx, 34 + ty), far=True)
    elif back == 'back':
        arm(c, sh, (11 + tx, 30 + ty), (9 + tx, 32 + ty), far=True)
    elif back == 'flail':
        arm(c, sh, (11 + tx, 25 + ty), (9 + tx, 22 + ty), far=True)
    elif back == 'hip':
        arm(c, sh, (11 + tx, 30 + ty), (14 + tx, 33 + ty), far=True)
    # sous-vêtement sombre entre les jambes
    c.rect(15 + tx, 36 + ty, 11, 4, UNDER)
    # jambes
    leg(c, BACK_LEG_X + tx * 0.5, HIP_Y, BACK_LEG_X + bdx, blift, far=True)
    leg(c, FRONT_LEG_X + tx * 0.5, HIP_Y, FRONT_LEG_X + fdx, flift, far=False)
    torso(c, tx, ty)
    if back == 'forward':  # bras arrière tendu vers l'avant, sous le bras d'arme
        arm(c, (19 + tx, 28 + ty), (25 + tx, 31 + ty), (30 + tx, 31 + ty), far=True)
    # bras d'arme
    s = (27 + tx, 28 + ty)
    hxp, hyp = hand
    ex = (s[0] + hxp) / 2 + (1.5 if hyp > s[1] else 1)
    ey = (s[1] + hyp) / 2 + (1.5 if hyp < s[1] else 1)
    if hyp >= s[1] + 4:  # bras le long du corps, avant-bras vers l'avant
        ex, ey = s[0] + 0.5, hyp - 1
    arm(c, s, (round(ex), round(ey)), hand)
    pauldron_front(c, tx, ty)
    return c, {'hand': {'x': hand[0], 'y': hand[1]}, 'rot': rot,
               'head': {'x': hx, 'y': hy}, 'torso': {'x': tx, 'y': ty}}


# ---------------------------------------------------------------- tête

HEAD_C = (21, 15.5)
HEAD_R = (9.6, 8.8)


def spine_fill(c, spine, widths, shade, only_inside=False):
    """Remplit un ruban le long d'une épine ; shade(t, s) -> couleur (s : -1 côté haut .. +1 côté bas)."""
    samples = []
    for i in range(len(spine) - 1):
        (x0, y0), (x1, y1) = spine[i], spine[i + 1]
        n = max(2, int(math.hypot(x1 - x0, y1 - y0) * 3))
        for k in range(n):
            u = k / n
            samples.append((x0 + (x1 - x0) * u, y0 + (y1 - y0) * u))
    samples.append(spine[-1])
    total = len(samples) - 1
    xs = [p[0] for p in samples]
    ys = [p[1] for p in samples]
    wmax = max(widths)
    for y in range(int(min(ys) - wmax - 1), int(max(ys) + wmax + 2)):
        for x in range(int(min(xs) - wmax - 1), int(max(xs) + wmax + 2)):
            px, py = x + 0.5, y + 0.5
            best, bi = 1e9, 0
            for i, (sx, sy) in enumerate(samples):
                d = (px - sx) ** 2 + (py - sy) ** 2
                if d < best:
                    best, bi = d, i
            t = bi / total
            # largeur interpolée
            f = t * (len(widths) - 1)
            j = min(len(widths) - 2, int(f))
            wv = widths[j] + (widths[j + 1] - widths[j]) * (f - j)
            d = math.sqrt(best)
            if d > wv:
                continue
            a = samples[max(0, bi - 1)]
            b = samples[min(total, bi + 1)]
            tx_, ty_ = b[0] - a[0], b[1] - a[1]
            cross = tx_ * (py - samples[bi][1]) - ty_ * (px - samples[bi][0])
            side = 1 if cross > 0 else -1
            col = shade(t, side * d / max(wv, 0.01), x, y)
            if col:
                (c.setf if only_inside else c.set)(x, y, col)


# Épine du panache : part du cimier, monte, puis retombe en arrière en s'enroulant.
# queue du panache décalée de 1 à 2 px vers la droite : elle ne touche plus le bord gauche du calque (48 px imposés)
PLUME_SPINE = [(20.5, 9), (21.5, 4), (18, 1.4), (12, 2.0), (7.6, 4.6), (4.8, 8.6), (3.6, 13.5), (3.4, 17.5)]
PLUME_W = [2.4, 3.8, 4.6, 5.0, 4.8, 4.0, 2.8, 0.9]
LOCK_SPINE = [(12, 9), (7.5, 11), (5, 15), (5, 20), (7, 23)]
LOCK_W = [2.6, 3.2, 3.0, 2.0, 0.7]


def plume_shade(t, s, x, y):
    """s < 0 : côté extérieur (haut/gauche, éclairé), s > 0 : intérieur ombré ; un brin clair ondulé."""
    if s < -0.55:
        return PLUME_L
    if s > 0.42:
        return PLUME_D
    if abs(s + 0.05 - 0.18 * math.sin(t * 14)) < 0.14 and 0.12 < t < 0.85:
        return PLUME_L if (x + y) % 3 else PLUME
    if abs(s - 0.25 + 0.15 * math.sin(t * 11 + 1)) < 0.1 and t > 0.2:
        return PLUME_D
    return PLUME


def lock_shade(t, s, x, y):
    if s < -0.5:
        return PLUME
    if s > 0.3 or (abs(s) < 0.12 and t > 0.3):
        return tag('hero_dark') if s > 0.6 else PLUME_D
    return PLUME_D if t > 0.75 else PLUME


def plume(c, shade=plume_shade, spine=PLUME_SPINE, widths=PLUME_W):
    part = layer()
    if spine is PLUME_SPINE:
        spine_fill(part, LOCK_SPINE, LOCK_W, lock_shade)
        stamp(c, part)
        part = layer()
    spine_fill(part, spine, widths, shade)
    stamp(c, part)


def dome(c, colors):
    ball(c, HEAD_C[0], HEAD_C[1], HEAD_R[0], HEAD_R[1], colors)


def helmet_default():
    c = layer()
    plume(c)
    part = layer()
    dome(part, STEEL)
    # bourrelet inférieur / gorgerin évasé
    part.poly([(13, 21), (29, 21), (30, 25), (12, 25)], STEEL[1])
    for x in range(12, 31):
        part.setf(x, 24, STEEL[0])
        part.setf(x, 21, STEEL[2] if x < 22 else STEEL[1])
    for y in range(21, 24):
        part.setf(12, y, STEEL[2]); part.setf(13, y, STEEL[2])
    for x in range(14, 29, 3):
        part.setf(x, 22, TRIM[1] if x < 24 else TRIM[0])
    # ouverture du visage (côté droit)
    fx0, fx1, fy0, fy1 = 22, 29, 15, 21
    rounded_rect(part, fx0 - 1, fy0 - 1, fx1 + 1, fy1 + 1, STEEL[0], only_inside=True)
    rounded_rect(part, fx0, fy0, fx1, fy1, SKIN[2], only_inside=True)
    for x in range(fx0, fx1 + 1):
        part.setf(x, fy0, SKIN[1])  # ombre de la visière
    for y in range(fy0, fy1 + 1):
        part.setf(fx0, y, SKIN[1])
    part.setf(fx0, fy0, FACE_SHADOW); part.setf(fx0 + 1, fy0, FACE_SHADOW)
    # yeux (2 px de haut) + reflet, joues
    for ex in (24, 27):
        part.setf(ex, 17, EYE); part.setf(ex, 18, EYE)
    part.setf(23, 19, BLUSH); part.setf(28, 19, BLUSH)
    part.setf(25, 20, SKIN[1]); part.setf(26, 20, SKIN[1])
    # visière relevée à grille (bandeau au-dessus du visage)
    for x in range(20, 31):
        for y in (12, 13, 14):
            part.setf(x, y, STEEL[3] if y == 12 else STEEL[2] if y == 13 else STEEL[1])
    for x in range(22, 31, 2):
        part.setf(x, 13, OUT); part.setf(x, 14, STEEL[0])
    part.setf(20, 12, STEEL[4]); part.setf(21, 12, STEEL[4])
    # charnière dorée de la visière
    part.ellipse(17, 17, 1.6, 1.6, STEEL[1], only_inside=True)
    part.setf(16, 16, TRIM[2]); part.setf(17, 16, TRIM[1]); part.setf(16, 17, TRIM[1]); part.setf(17, 17, TRIM[0])
    # cimier doré (base du panache) suivant la calotte
    # reflets spéculaires
    for x, y in ((14, 11), (15, 10), (14, 12), (16, 9), (17, 9)):
        part.setf(x, y, STEEL[4])
    stamp(c, part)
    # douille du panache
    c.set(20, 7, TRIM[2]); c.set(21, 7, TRIM[1]); c.set(19, 7, TRIM[1]); c.set(20, 6, TRIM[1])
    return c


def helmet_helm():
    """Heaume fermé (objet) : couleurs de l'objet, crête de rareté."""
    c = layer()

    def crest_shade(t, s, x, y):
        if s < -0.4:
            return RAR[2]
        if s > 0.5:
            return RAR[0]
        return RAR[1]
    spine = [(21, 8), (20, 4.8), (16, 3.9), (11, 4.5), (7.5, 7.4), (6.5, 11)]  # crête abaissée d'1 px : contour non coupé
    plume(c, crest_shade, spine, [1.8, 2.8, 3.0, 2.6, 2.0, 0.8])
    part = layer()
    dome(part, [ITEM[0], ITEM[1], ITEM[2], ITEM[3], ITEM[3]])
    part.poly([(12, 20), (30, 20), (30, 25), (12, 25)], ITEM[1])
    for x in range(12, 31):
        part.setf(x, 20, ITEM[2]); part.setf(x, 24, ITEM[0])
    # bec du heaume : avant aplati
    for y in range(11, 24):
        for x in range(26, 31):
            part.setf(x, y, ITEM[1] if x < 29 else ITEM[0])
    # fente de vision + trous de respiration
    for x in range(19, 31):
        part.setf(x, 14, OUT); part.setf(x, 15, ITEM[0])
    for x in range(20, 31):
        part.setf(x, 13, ITEM[3])
    for x in (24, 26, 28):
        part.setf(x, 18, OUT); part.setf(x, 20, OUT)
    # renfort central en couleur de rareté
    for y in range(7, 25):
        part.setf(18, y, RAR[2] if y < 12 else RAR[1]); part.setf(19, y, RAR[0])
    for x in range(12, 31):
        part.setf(x, 23, RAR[1] if x < 24 else RAR[0])
    part.ellipse(15.5, 17.5, 1.6, 1.6, RAR[1], only_inside=True)
    part.setf(15, 17, RAR[2])
    for x, y in ((14, 11), (15, 10), (14, 12), (16, 9)):
        part.setf(x, y, tag('item_light'))
    stamp(c, part)
    return c


def helmet_hood():
    """Capuche d'étoffe (objet), visage chibi visible."""
    c = layer()
    part = layer()
    # pointe retombant dans le dos
    part.poly([(13, 10), (9, 14), (5, 22), (8, 23), (12, 21), (15, 17)], ITEM[1])
    for p in ((6, 21), (7, 20), (8, 18), (9, 17), (10, 15)):
        part.setf(*p, ITEM[0])
    ball(part, 20.5, 16, 10, 9.2, [ITEM[0], ITEM[1], ITEM[2], ITEM[2], ITEM[3]])
    # drapé sur les épaules
    part.poly([(11, 20), (31, 20), (32, 26), (10, 26)], ITEM[1])
    for x in range(10, 33):
        part.setf(x, 25, ITEM[0]); part.setf(x, 20, ITEM[2])
    for x in range(10, 20):
        part.setf(x, 21, ITEM[3])
    for p in ((15, 22), (15, 23), (19, 22), (19, 23), (25, 23), (25, 24)):
        part.setf(*p, ITEM[0])
    # ouverture du visage : liseré de rareté, frange, visage chibi
    part.ellipse(25.4, 16.8, 5.4, 5.8, RAR[1], only_inside=True)
    part.ellipse(25.7, 17.2, 4.4, 4.8, SKIN[2], only_inside=True)
    face = {(x, y) for y in range(H) for x in range(W) if part.get(x, y) == SKIN[2]}
    for x, y in face:
        if (x, y - 1) not in face:
            part.set(x, y, HAIR)
            if (x + 1, y - 1) not in face and x % 2:
                part.set(x, y + 1, HAIR)
        elif (x - 1, y) not in face:
            part.set(x, y, SKIN[1])
    for ex in (25, 28):
        part.setf(ex, 17, EYE); part.setf(ex, 18, EYE)
    part.setf(24, 19, BLUSH); part.setf(29, 19, BLUSH)
    part.setf(26, 20, SKIN[1])
    for p in ((22, 12), (22, 13), (21, 14)):
        part.setf(*p, RAR[2])
    for x, y in ((15, 10), (16, 9), (14, 11), (17, 8)):
        part.setf(x, y, ITEM[3])
    stamp(c, part)
    return c


# ---------------------------------------------------------------- armures (calques de buste)

def armor_mail():
    """Cuirasse et épaulières d'objet portées par-dessus le corps."""
    c = layer()
    part = layer()
    ball(part, 20.5, 28.5, 7.3, 6.4, [ITEM[0], ITEM[1], ITEM[2], ITEM[3], ITEM[3]])
    for x in range(13, 29):
        part.setf(x, 32, ITEM[0])
        part.setf(x, 31, RAR[1] if 15 <= x <= 26 else ITEM[0])
    for y in range(24, 31):
        part.setf(22, y, ITEM[1])
    part.ellipse(20.5, 27.5, 1.9, 1.7, RAR[1], only_inside=True)
    part.setf(20, 27, RAR[2]); part.setf(21, 28, RAR[0])
    part.setf(17, 26, ITEM[3]); part.setf(17, 27, ITEM[3]); part.setf(18, 26, ITEM[3])
    # épaulière arrière
    ball(part, 14.5, 26.5, 3.9, 3.4, [ITEM[0], ITEM[0], ITEM[1], ITEM[2], ITEM[3]])
    for x in range(10, 19):
        part.setf(x, 28, RAR[0])
    stamp(c, part)
    # épaulière avant, plus grosse
    pauldron_front(c, 0, 0, colors=[ITEM[0], ITEM[1], ITEM[2], ITEM[3], ITEM[3]], trim=RAR)
    return c


def armor_tunic():
    """Surcot d'étoffe (objet), liseré de rareté, ceinture conservée."""
    c = layer()
    part = layer()
    part.poly([(15, 23), (26, 23), (27, 32), (28, 40), (21, 41.5), (13, 40), (14, 32)], ITEM[2])
    for y in range(23, 41):
        part.setf(15, y, ITEM[3]); part.setf(16, y, ITEM[3] if y < 30 else ITEM[2])
        part.setf(25, y, ITEM[1]); part.setf(26, y, ITEM[1]); part.setf(27, y, ITEM[0])
    for x in range(12, 29):
        part.setf(x, 40, RAR[1]); part.setf(x, 41, RAR[0])
    # pli central
    for y in range(34, 40):
        part.setf(21, y, ITEM[1])
    # écusson de rareté
    part.poly([(18, 25), (23, 25), (23, 28), (20.5, 30.5), (18, 28)], RAR[1])
    part.setf(19, 26, RAR[2]); part.setf(20, 26, RAR[2]); part.setf(22, 28, RAR[0])
    # ceinture
    for x in range(13, 29):
        part.setf(x, 32, LEATHER[1]); part.setf(x, 33, LEATHER[0])
    part.setf(20, 32, TRIM[2]); part.setf(21, 32, TRIM[1]); part.setf(21, 33, TRIM[0])
    stamp(c, part)
    return c


# ---------------------------------------------------------------- cape

def cape(frame):
    """Grande cape derrière le chevalier, 3 images d'ondulation (a, b, c en boucle)."""
    c = layer()
    k = {'a': 0, 'b': 1, 'c': 2}[frame]
    ph = k * 2.1
    left = []
    for y in range(24, 43):
        u = (y - 24) / 18
        x = 10 - 8.2 * math.sin(u * math.pi / 2) ** 0.8 + 1.1 * math.sin(y * 0.55 + ph) * u  # bord gauche dans le calque
        left.append((x, y))
    hem = []
    x0 = left[-1][0]
    for i in range(0, 24):
        x = x0 + i
        if x > 23:
            break
        hem.append((x, 43.5 + 1.3 * math.sin(x * 0.7 - ph) * (1 - i / 30)))
    pts = [(13, 23), (25, 23), (25, 32), (23.5, 40)] + hem[::-1] + left[::-1]
    part = layer()
    part.poly(pts, HERO[2])
    # bord gauche éclairé
    for y in range(22, 48):
        for x in range(0, 26):
            if part.get(x, y) is not None and (part.get(x - 1, y) is None or part.get(x, y - 1) is None):
                part.set(x, y, HERO[3])
    # plis en éventail depuis l'épaule : creux sombre + arête claire
    for i, fx in enumerate((2.5, 7.5, 12.5, 17.5)):
        tx = fx + 1.2 * math.sin(fx * 0.7 - ph)
        y1 = 43.5 + 1.3 * math.sin(fx * 0.7 - ph) - 1
        x_start = 11 + i * 1.5
        part.line(x_start, 26, tx, y1, HERO[1])
        part.line(x_start + 1, 27, tx + 1, y1, HERO[0] if i % 2 else HERO[1])
        part.line(x_start - 1, 28, tx - 1, y1 - 1, HERO[3])
    # doublure visible sous les creux de l'ourlet
    for x in range(0, 24):
        for y in range(47, 30, -1):
            if part.get(x, y) is not None:
                part.set(x, y, HERO[0])
                if math.sin(x * 0.7 - ph) > 0.2:
                    part.set(x, y - 1, HERO[0])
                break
    # fermoir doré à l'épaule
    part.set(14, 24, TRIM[2]); part.set(15, 24, TRIM[1]); part.set(14, 25, TRIM[1]); part.set(15, 25, TRIM[0])
    stamp(c, part)
    return c


# ---------------------------------------------------------------- écu

SHIELD_POS = (5, 29)


def shield():
    """Écu en pointe (bras arrière) : 13×16, couleurs du héros, bordure dorée."""
    c = Canvas(13, 16)
    c.poly([(1, 1), (12, 1), (12, 8), (6.5, 15), (1, 8)], TRIM[1])
    c.poly([(2, 2), (11, 2), (11, 8), (6.5, 13.6), (2, 8)], HERO[2])
    for y in range(2, 14):
        for x in range(2, 11):
            if c.get(x, y) != HERO[2]:
                continue
            if x < 5:
                c.set(x, y, HERO[3] if y < 7 else HERO[2])
            elif x > 8:
                c.set(x, y, HERO[1])
    for y in range(3, 12):
        c.setf(6, y, TRIM[2]); c.setf(7, y, TRIM[1])
    for x in range(3, 11):
        c.setf(x, 6, TRIM[2] if x < 7 else TRIM[1])
    c.set(6, 6, TRIM[2])
    for x in range(1, 13):
        if c.get(x, 1) is not None:
            c.set(x, 1, TRIM[2] if x < 7 else TRIM[1])
    for y in range(2, 9):
        c.setf(12, y, TRIM[0])
    c.set(2, 2, tag('hero_light'))
    c.outline(OUT)
    return c


# ---------------------------------------------------------------- armes

def weapon_sword():
    c = Canvas(10, 28)
    # lame
    for y in range(3, 20):
        c.set(3, y, ITEM[3]); c.set(4, y, ITEM[3]); c.set(5, y, ITEM[2]); c.set(6, y, ITEM[1])
    c.set(4, 2, ITEM[3]); c.set(5, 2, ITEM[2]); c.set(4, 1, ITEM[3]); c.set(5, 1, ITEM[1])
    for y in range(5, 18):
        c.set(5, y, ITEM[1] if y % 5 else ITEM[2])  # gouttière
    c.set(4, 4, '#ffffff'); c.set(3, 6, '#ffffff')
    # garde courbée
    for x in range(0, 10):
        c.set(x, 20, RAR[1]); c.set(x, 21, RAR[0])
    c.set(0, 19, RAR[1]); c.set(9, 19, RAR[0]); c.set(1, 20, RAR[2]); c.set(2, 20, RAR[2])
    c.set(4, 20, RAR[2]); c.set(5, 20, RAR[1]); c.set(4, 21, RAR[1])
    # poignée
    for y in range(22, 25):
        c.set(4, y, LEATHER[2] if y % 2 else LEATHER[1]); c.set(5, y, LEATHER[0])
    # pommeau
    c.shaded_ellipse(5, 26, 1.7, 1.5, RAR)
    c.outline(OUT)
    return c, (4, 23)


def weapon_axe():
    c = Canvas(14, 27)
    for y in range(3, 25):
        c.set(6, y, LEATHER[2] if y % 3 else LEATHER[1]); c.set(7, y, LEATHER[0])
    c.shaded_ellipse(7, 25.5, 1.6, 1.3, RAR)
    # fer en croissant
    c.poly([(8, 3), (11, 1), (13.5, 3), (13.5, 11), (11, 13), (8, 10)], ITEM[2])
    for y in range(1, 13):
        c.setf(13, y, ITEM[3]); c.setf(12, y, ITEM[3] if 3 < y < 11 else ITEM[2])
    for y in range(4, 10):
        c.setf(9, y, ITEM[1])
    c.poly([(6, 4), (3, 2.5), (1, 4), (1.5, 8), (6, 8)], ITEM[1])
    for y in range(3, 8):
        c.setf(1, y, ITEM[2]); c.setf(2, y, ITEM[2])
    c.rect(5, 3, 4, 2, RAR[1]); c.set(5, 3, RAR[2]); c.rect(5, 8, 4, 2, RAR[0]); c.set(5, 8, RAR[1])
    c.set(6, 1, ITEM[3]); c.set(6, 2, ITEM[2]); c.set(7, 2, ITEM[1])
    c.outline(OUT)
    return c, (6, 20)


def weapon_dagger():
    c = Canvas(8, 17)
    for y in range(2, 10):
        c.set(3, y, ITEM[3]); c.set(4, y, ITEM[2]); c.set(5, y, ITEM[1] if y > 2 else ITEM[2])
    c.set(3, 1, ITEM[3]); c.set(4, 1, ITEM[2]); c.set(3, 3, '#ffffff')
    for x in range(0, 8):
        c.set(x, 10, RAR[1] if 0 < x < 7 else RAR[0])
    c.set(1, 10, RAR[2])
    for y in range(11, 14):
        c.set(3, y, LEATHER[2] if y % 2 else LEATHER[1]); c.set(4, y, LEATHER[0])
    c.shaded_ellipse(4, 15, 1.4, 1.2, RAR)
    c.outline(OUT)
    return c, (3, 12)


# ---------------------------------------------------------------- effets

def fx_color(s, bright=0):
    """s : 0 bord d'attaque (blanc) .. 1 fond (bleu profond)."""
    idx = len(FX_RAMP) - 1 - int(s * len(FX_RAMP)) + bright
    return FX_RAMP[max(0, min(len(FX_RAMP) - 1, idx))]


def crescent(c, cx, cy, R, sy, a0, a1, thick, fade=0.0, bright=0, gap=None, power=0.75, lead=0.6):
    """Croissant (arc) d'épaisseur variable, du bord blanc vers le bleu ; la traînée (début) s'effiloche."""
    for y in range(c.h):
        for x in range(c.w):
            dx = x + 0.5 - cx
            dy = (y + 0.5 - cy) / sy
            r = math.hypot(dx, dy)
            a = math.degrees(math.atan2(dy, dx))
            t = (a - a0) / (a1 - a0)
            if not 0 <= t <= 1:
                continue
            # profil : traînée fine, tête épaisse vers `lead`, puis pointe
            prof = (t / lead) ** power if t < lead else math.cos((t - lead) / (1 - lead) * math.pi / 2) ** 0.6
            wt = thick * prof
            if wt < 0.6 or not (R - wt <= r <= R):
                continue
            s = (R - r) / wt
            if fade and t < fade:
                # traînée : pointillés et couleurs éteintes
                if (x + y) % 2 and t < fade * 0.6:
                    continue
                s = min(1, s + (fade - t) / fade * 0.5)
            if gap and gap(x, y, t, s):
                continue
            c.set(x, y, fx_color(s, bright))


def fx_slash(frame):
    c = Canvas(40, 44)
    if frame == 1:
        crescent(c, 4, 23, 34, 0.62, -88, -8, 10, fade=0.45, lead=0.85)
        crescent(c, 4, 23, 26, 0.62, -80, -20, 3, fade=0.5, bright=-1, lead=0.8)
    elif frame == 2:
        crescent(c, 4, 22, 35, 0.62, -86, 74, 12, fade=0.3, lead=0.62)
        crescent(c, 4, 22, 25, 0.62, -60, 55, 3.5, fade=0.4, bright=-1, lead=0.6)
    else:
        def broken(x, y, t, s):
            return (x * 3 + y * 5) % 7 == 0 or (t < 0.5 and (x + y) % 2 == 0)
        crescent(c, 4, 22, 35, 0.62, -10, 82, 9, fade=0.7, bright=-1, gap=broken, lead=0.8)
        for x, y in ((30, 12), (34, 20), (27, 7), (36, 28)):
            c.set(x, y, FX_CYAN)
    return c


def fx_slash_crit():
    c = Canvas(48, 48)
    crescent(c, 3, 24, 43, 0.56, -84, 78, 15, fade=0.25, bright=1, lead=0.58)
    crescent(c, 3, 24, 32, 0.56, -70, 60, 4, fade=0.3, lead=0.6)
    for x, y in ((40, 6), (44, 14), (30, 3), (45, 34), (38, 42)):
        spark(c, x, y, small=True)
    return c


def spark(c, x, y, small=False, gold=False):
    core, mid, tip = ('#ffffff', '#ffe27a', '#f0a030') if gold else (FX_WHITE, FX_CYAN, FX_MID)
    c.set(x, y, core)
    n = 1 if small else 3
    for d in range(1, n + 1):
        col = mid if d < n or small else tip
        for dx, dy in ((d, 0), (-d, 0), (0, d), (0, -d)):
            c.set(x + dx, y + dy, col)
    if not small:
        for dx, dy in ((1, 1), (-1, -1), (1, -1), (-1, 1)):
            c.set(x + dx, y + dy, mid)


def fx_wave():
    c = Canvas(36, 16)
    # traînées horizontales (s'effilochent vers l'arrière)
    streaks = [(8, 2, 20), (4, 4, 23), (0, 6, 25), (2, 7, 25), (0, 9, 25), (3, 11, 23), (8, 13, 20), (12, 1, 18), (11, 14, 17)]
    for x0, y, x1 in streaks:
        for x in range(x0, x1):
            t = (x - x0) / max(1, x1 - x0)
            if t < 0.4 and (x + y) % 2:
                continue
            c.set(x, y, FX_RAMP[min(5, 1 + int(t * 5))])
    # tête en croissant, coeur blanc
    crescent(c, 14, 8, 21, 0.38, -86, 86, 11, bright=1, lead=0.5, power=0.5)
    crescent(c, 12, 8, 16, 0.38, -75, 75, 4, lead=0.5)
    for y in range(6, 10):
        for x in range(27, 34):
            if c.get(x, y) is not None:
                c.set(x, y, FX_WHITE)
    return c


def fx_whirl(frame):
    c = Canvas(56, 24)
    cx, cy, rx, ry = 28, 12, 26.5, 10.5
    phase = 0 if frame == 1 else 90
    for y in range(c.h):
        for x in range(c.w):
            dx = (x + 0.5 - cx) / rx
            dy = (y + 0.5 - cy) / ry
            r = math.hypot(dx, dy)
            a = (math.degrees(math.atan2(dy, dx)) - phase) % 360
            for r_out, th, bias in ((1.0, 0.24, 0), (0.7, 0.16, -1)):
                if r_out - th <= r <= r_out:
                    # deux traînées qui tournent : tête brillante, queue qui s'éteint
                    u = (a % 180) / 180
                    if bias:
                        u = ((a + 70) % 180) / 180
                    if u < 0.25:
                        break
                    s = (r_out - r) / th
                    b = (u - 0.25) / 0.75
                    if b < 0.3 and (x * 2 + y) % 3 == 0:
                        break
                    col = fx_color(min(1, s * 0.6 + (1 - b) * 0.7), bias)
                    c.set(x, y, col)
                    break
    # reflet avant plus clair (bas de l'anneau)
    for x in range(14, 42):
        if c.get(x, 22) is not None:
            c.set(x, 22, FX_PALE)
    return c


def fx_burst():
    c = Canvas(36, 32)
    gy = 31
    # éclaboussure au sol
    for y in range(26, 32):
        for x in range(36):
            d = ((x + 0.5 - 18) / 17.5) ** 2 + ((y + 0.5 - 31) / 4.2) ** 2
            if d <= 1:
                c.set(x, y, FX_CYAN if d < 0.35 else FX_MID if d < 0.7 else FX_BLUE)
    spikes = [(6, 2.2, 11, -3), (30, 2.2, 12, 3), (11, 3, 19, -3), (25, 3, 21, 3), (14.5, 2, 13, -1),
              (22, 2, 15, 1), (18, 4, 30, 0)]
    for bx, hw, hgt, lean in spikes:
        part = Canvas(36, 32)
        for y in range(gy - hgt, gy + 1):
            u = (gy - y) / hgt  # 0 base .. 1 pointe
            cxs = bx + lean * u * u
            half = hw * (1 - u) ** 0.9
            for x in range(int(cxs - half - 1), int(cxs + half + 2)):
                px = x + 0.5
                if abs(px - cxs) > half + 0.2:
                    continue
                left = px < cxs
                if u > 0.7:
                    col = FX_WHITE
                elif left:
                    col = FX_PALE if abs(px - cxs) < half * 0.6 else FX_CYAN
                else:
                    col = FX_MID if abs(px - cxs) < half * 0.5 else FX_BLUE
                part.set(x, y, col)
        part.outline(FX_DARK)
        c.paste(part, 0, 0)
    r = rng(7)
    for _ in range(9):
        x, y = r.randint(2, 33), r.randint(2, 22)
        if c.get(x, y) is None:
            c.set(x, y, r.choice([FX_CYAN, FX_PALE, FX_WHITE]))
    for x in range(36):
        if c.get(x, gy) is not None:
            c.set(x, gy, FX_MID)
    return c


def flame(c, bx, base, wd, hgt, bend, frame):
    """Langue de flamme : bord bleu profond, coeur cyan, base presque blanche."""
    for y in range(int(base - hgt), base + 1):
        u = (base - y) / hgt
        cxs = bx + bend * u * u + math.sin(u * 7 + frame * 2.1) * 0.7
        half = wd * (1 - u) ** 0.75 * (0.75 + 0.25 * min(1, u * 5))
        for x in range(int(cxs - half - 1), int(cxs + half + 2)):
            d = abs(x + 0.5 - cxs) / max(half, 0.01)
            if d > 1:
                continue
            if d > 0.72:
                col = FX_DARK
            elif d > 0.38:
                col = FX_BLUE if u > 0.5 else FX_MID
            else:
                col = FX_CYAN if u > 0.3 else FX_PALE
            if u > 0.8:
                col = FX_MID if d < 0.5 else FX_DARK
            old = c.get(x, y)
            if old in (FX_PALE, FX_CYAN, FX_WHITE) and col in (FX_DARK, FX_BLUE):
                continue
            c.set(x, y, col)


def fx_aura(frame):
    """Aura de flammes bleues (creuse au centre), 56×48 : à poser en (-4, 0) dans le repère du corps."""
    c = Canvas(56, 48)
    sw = 1 if frame == 1 else -1
    # (base x, demi-largeur, hauteur, courbure) : grandes flammes sur les flancs, petites devant
    tongues = [(4, 3.2, 38, 1.5 * sw), (8.5, 3.0, 26, -1.5 * sw), (1.8, 2.0, 18, 1),
               (46, 3.2, 40, -1.5 * sw), (41.5, 3.2, 28, 1.5 * sw), (52, 2.2, 18, -1),
               (14, 2.2, 13, sw), (36, 2.4, 15, -sw), (25, 2.0, 8, 0)]
    if frame == 2:
        tongues = [(bx, w, h + (4 if i % 2 else -4), b) for i, (bx, w, h, b) in enumerate(tongues)]
    for bx, wd, hgt, bend in tongues:
        flame(c, bx, 46, wd, hgt, bend, frame)
    # anneau au sol
    for y in range(40, 48):
        for x in range(56):
            d = ((x + 0.5 - 25.5) / 25) ** 2 + ((y + 0.5 - 44.8) / 3.0) ** 2
            if 0.6 <= d <= 1:
                col = FX_WHITE if d < 0.7 else FX_CYAN if d < 0.82 else FX_BLUE
                if y < 44 and (x + y + frame) % 2:
                    continue
                c.set(x, y, col)
    # étincelles montantes
    pts = [(9, 4), (47, 3), (14, 20), (39, 12), (2, 28), (53, 24), (30, 4)] if frame == 1 else \
          [(10, 9), (45, 8), (15, 13), (37, 19), (3, 20), (54, 31), (21, 3)]
    for x, y in pts:
        c.set(x, y, FX_PALE); c.set(x, y + 1, FX_MID)
    return c


def fx_spark():
    c = Canvas(7, 7)
    spark(c, 3, 3, gold=True)
    return c


def fx_hit():
    c = Canvas(16, 16)
    cx, cy = 7.5, 7.5
    rays = [(0, 7.5), (45, 5), (90, 7.5), (135, 5), (180, 7.5), (225, 5), (270, 7.5), (315, 5),
            (22, 3.5), (112, 3.5), (202, 3.5), (292, 3.5)]
    for ang, ln in rays:
        a = math.radians(ang)
        for i in range(int(ln * 3)):
            d = i / 3
            w = 1.6 * (1 - d / ln)
            x, y = cx + math.cos(a) * d, cy + math.sin(a) * d
            col = FX_WHITE if d < ln * 0.4 else FX_CYAN if d < ln * 0.75 else FX_MID
            c.ellipse(x, y, max(0.5, w), max(0.5, w), col)
    c.ellipse(cx, cy, 2.6, 2.6, FX_WHITE)
    c.outline(FX_DARK)
    return c


# ---------------------------------------------------------------- assemblage

def _tall(fn):
    """Dessine fn() sur des calques à marge puis recadre : largeur W, agrandi vers le haut si besoin."""
    global layer
    from lib import PadCanvas
    old = layer
    layer = lambda: PadCanvas(W, H, 16)  # noqa: E731
    try:
        c = fn()
    finally:
        layer = old
    top = max(0, 16 - c.bounds()[1])
    return c.crop_box((0, -top, W - 1, H - 1))


def build():
    """Renvoie {nom: (canvas, extra)}."""
    out = {}
    for pose in POSES:
        cv, extra = body(pose)
        out[f'hero_{pose}'] = (cv, extra)
    # casque par défaut : le panache dépasse au-dessus du calque -> calque plus haut, remonté par oy (< 0)
    tall = _tall(helmet_default)
    out['helmet_default'] = (tall, {'oy': H - tall.h})
    out['helmet_helm'] = (helmet_helm(), {'oy': 0})
    out['helmet_hood'] = (helmet_hood(), {'oy': 0})
    out['armor_mail'] = (armor_mail(), {'oy': 0})
    out['armor_tunic'] = (armor_tunic(), {'oy': 0})
    for f in 'abc':
        out[f'cape_{f}'] = (cape(f), {'oy': 0})
    out['shield'] = (shield(), {'x': SHIELD_POS[0], 'y': SHIELD_POS[1]})
    for name, fn in (('weapon_sword', weapon_sword), ('weapon_axe', weapon_axe), ('weapon_dagger', weapon_dagger)):
        cv, grip = fn()
        out[name] = (cv, {'grip': {'x': grip[0], 'y': grip[1]}})
    out['fx_slash1'] = (fx_slash(1), {})
    out['fx_slash2'] = (fx_slash(2), {})
    out['fx_slash3'] = (fx_slash(3), {})
    out['fx_slash_crit'] = (fx_slash_crit(), {})
    out['fx_wave'] = (fx_wave(), {})
    out['fx_whirl1'] = (fx_whirl(1), {})
    out['fx_whirl2'] = (fx_whirl(2), {})
    out['fx_burst'] = (fx_burst(), {})
    out['fx_aura1'] = (fx_aura(1), {})
    out['fx_aura2'] = (fx_aura(2), {})
    out['fx_spark'] = (fx_spark(), {})
    out['fx_hit'] = (fx_hit(), {})
    return out
