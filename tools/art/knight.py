"""Chevalier v5 : calques 40×44, face à droite, pieds en (19, 43)."""
from lib import Canvas, tag, ramp, shift, mix

W, H = 40, 44
FOOT = (19, 43)

# Rampes fixes
STEEL = [tag('steel_dark'), tag('steel_shade'), tag('steel'), tag('steel_light'), tag('steel_hi')]
HERO = [tag('hero_dark'), tag('hero_shade'), tag('hero'), tag('hero_light')]
TRIM = [tag('trim_dark'), tag('trim'), tag('trim_light')]
PLUME = [tag('plume_dark'), tag('plume')]
ITEM = [tag('item_dark'), tag('item_shade'), tag('item'), tag('item_light')]
RAR = [tag('rarity_dark'), tag('rarity'), tag('rarity_light')]
LEATHER = ramp('#7a4a2a', 4, 0.22)
BOOT = ramp('#5a3a26', 4, 0.2)
OUT = '#1a1226'


def steel_box(c, x0, y0, x1, y1, light_left=True):
    """Bloc d'acier ombré en colonnes (clair à gauche/haut)."""
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            t = (x - x0) / max(1, x1 - x0)
            idx = 3 if t < 0.25 else 2 if t < 0.65 else 1
            if y == y0:
                idx = min(4, idx + 1)
            c.set(x, y, STEEL[idx])


def legs(c, pose):
    """Jambières et bottes. pose: idle / walk1 / walk2 / attack."""
    # positions (x des jambes arrière / avant) et levée
    if pose == 'idle':
        back, front, lift_b, lift_f = 15, 21, 0, 0
    elif pose == 'walk1':
        back, front, lift_b, lift_f = 13, 23, 0, 1
    elif pose == 'walk2':
        back, front, lift_b, lift_f = 16, 19, 1, 0
    else:  # attack : fente
        back, front, lift_b, lift_f = 12, 24, 0, 0
    for lx, lift, far in ((back, lift_b, True), (front, lift_f, False)):
        top, bottom = 32, 39 - lift
        for y in range(top, bottom + 1):
            for x in range(lx, lx + 4):
                t = (x - lx) / 3
                idx = 3 if t < 0.3 else 2 if t < 0.7 else 1
                if far:
                    idx = max(0, idx - 1)
                c.set(x, y, STEEL[idx])
        # genouillère
        c.set(lx + 1, 35 - lift, STEEL[4] if not far else STEEL[3])
        c.set(lx + 2, 35 - lift, STEEL[3] if not far else STEEL[2])
        c.set(lx, 36 - lift, STEEL[1]); c.set(lx + 3, 36 - lift, STEEL[0])
        # botte
        by = 40 - lift
        boot = BOOT if not far else [shift(b, dl=-0.06) for b in BOOT]
        for y in range(by, by + 3 + lift if lift else by + 3):
            for x in range(lx - 1, lx + 6):
                if y == by and x > lx + 3:
                    continue
                if y == by + 1 and x > lx + 4:
                    continue
                c.set(x, y, boot[2] if y == by else boot[1])
        c.rect(lx - 1, min(H - 1, by + 2 + (lift if lift else 0)), 7, 1, boot[0])
        c.set(lx, by, boot[3])


def torso(c, attack=False):
    # gambison/jupe (couleur héros) sous la ceinture
    c.poly([(13, 30), (26, 30), (27, 35), (12, 35)], HERO[1])
    for x in range(12, 28):
        c.setf(x, 34, HERO[0])
    c.set(19, 31, HERO[2]); c.set(19, 32, HERO[2]); c.set(19, 33, HERO[1])
    for y in range(31, 34):
        c.setf(14, y, HERO[2])
        c.setf(23, y, HERO[0])
    # buste : tabard
    c.poly([(13, 19), (26, 19), (26, 30), (13, 30)], HERO[2])
    for y in range(19, 30):
        c.set(13, y, HERO[3]); c.set(14, y, HERO[3] if y < 24 else HERO[2])
        c.set(25, y, HERO[1]); c.set(26, y, HERO[0])
    # croix dorée
    for y in range(21, 29):
        c.set(19, y, TRIM[1]); c.set(20, y, TRIM[0])
    for x in range(16, 24):
        c.set(x, 23, TRIM[2] if x < 19 else TRIM[1])
    c.set(19, 21, TRIM[2])
    # ceinture
    for x in range(12, 28):
        c.set(x, 30, LEATHER[1]); c.set(x, 31, LEATHER[0])
    c.rect(18, 30, 3, 2, TRIM[1]); c.set(18, 30, TRIM[2]); c.set(19, 31, LEATHER[0])
    # cotte de mailles visible au col
    for x in range(15, 25):
        c.set(x, 18, STEEL[2] if x % 2 else STEEL[1])
    # épaulières
    c.shaded_ellipse(13.5, 21, 4, 3.2, STEEL[1:])
    c.shaded_ellipse(25.5, 21, 4.2, 3.4, STEEL[1:])
    for x in range(10, 18):
        c.setf(x, 23, STEEL[0])
    for x in range(22, 30):
        c.setf(x, 23, STEEL[1])
    c.set(24, 19, STEEL[4]); c.set(12, 19, STEEL[4])
    c.set(25, 22, TRIM[1]); c.set(13, 22, TRIM[0])


def front_arm(c, attack=False):
    """Bras avant (acier) ; renvoie la position de la main."""
    if not attack:
        pts = [(25, 23), (28, 23), (29, 28), (26, 29)]
        c.poly(pts, STEEL[2])
        c.line(25, 23, 26, 28, STEEL[3])
        c.line(28, 23, 29, 27, STEEL[1])
        c.shaded_ellipse(28, 29, 2.2, 2, [LEATHER[0], LEATHER[1], LEATHER[2]])
        return (28, 29)
    pts = [(25, 21), (28, 20), (34, 22), (33, 25)]
    c.poly(pts, STEEL[2])
    c.line(26, 21, 33, 22, STEEL[3])
    c.line(27, 24, 33, 25, STEEL[1])
    c.shaded_ellipse(34.5, 23.5, 2.2, 2, [LEATHER[0], LEATHER[1], LEATHER[2]])
    return (34, 23)


def body(pose):
    c = Canvas(W, H)
    legs(c, pose)
    torso(c, pose == 'attack')
    hand = front_arm(c, pose == 'attack')
    # tête sous le casque (nuque / gorgerin)
    c.rect(16, 16, 8, 3, STEEL[1])
    c.outline(OUT)
    return c, hand


def plume(c, colors_main, colors_dark, light):
    """Panache recourbé vers l'arrière."""
    pts = [(18, 5), (16, 1.5), (12, 1.5), (8, 3.5), (4, 7), (2, 12), (5, 12.5), (7, 10), (10, 8.5), (13, 8), (17, 8)]
    c.poly(pts, colors_main)
    for x, y in [(3, 11), (4, 11), (4, 12), (5, 10), (6, 10), (6, 9), (7, 9), (8, 8), (9, 8), (10, 7), (11, 7), (12, 7), (13, 7), (14, 7), (8, 7), (5, 9)]:
        c.setf(x, y, colors_dark)
    for x, y in [(12, 2), (13, 2), (14, 2), (15, 2), (10, 3), (11, 3), (9, 4), (8, 5), (7, 5), (6, 6), (5, 7), (10, 5), (12, 4), (14, 4)]:
        c.setf(x, y, light)


def helmet_default():
    c = Canvas(W, H)
    plume(c, PLUME[1], PLUME[0], shift_tag_light())
    # calotte arrondie
    c.shaded_ellipse(19.5, 10.5, 6.6, 6.2, STEEL, light=(-0.7, -0.75))
    # mentonnière / garde-joues
    c.poly([(13.5, 10), (26.5, 10), (26, 16), (24, 18), (15, 18), (13.5, 16)], STEEL[2])
    for y in range(10, 18):
        c.setf(14, y, STEEL[3]); c.setf(15, y, STEEL[3])
        c.setf(25, y, STEEL[1]); c.setf(26, y, STEEL[0])
    # bandeau doré et crête
    for x in range(13, 27):
        c.setf(x, 9, TRIM[2] if x < 18 else TRIM[1] if x < 23 else TRIM[0])
    for y in range(4, 9):
        c.setf(18, y, TRIM[1]); c.setf(17, y, TRIM[2] if y < 7 else TRIM[1])
    # visière
    for x in range(19, 27):
        c.setf(x, 12, OUT); c.setf(x, 13, STEEL[0])
    for x in range(19, 26):
        c.setf(x, 11, STEEL[4] if x < 22 else STEEL[3])
    for x in (21, 23, 25):
        c.setf(x, 15, STEEL[0])
    c.setf(16, 6, STEEL[4]); c.setf(15, 7, STEEL[4]); c.setf(16, 7, STEEL[4])
    for x in range(15, 25):
        c.setf(x, 17, TRIM[1] if x < 21 else TRIM[0])
    c.outline(OUT)
    return c


def shift_tag_light():
    return tag('hero_light')  # reflet du panache (clair de la couleur du héros)


def helmet_helm():
    """Heaume fermé (objet) : couleur de l'objet, crête de rareté."""
    c = Canvas(W, H)
    # crête
    for y in range(1, 6):
        c.rect(17, y, 4, 1, RAR[1])
    c.set(17, 1, RAR[2]); c.set(18, 2, RAR[2]); c.set(20, 4, RAR[0]); c.set(20, 5, RAR[0])
    for x in range(12, 18):
        c.set(x, 3 + (17 - x) // 2, RAR[1])
        c.set(x, 4 + (17 - x) // 2, RAR[0])
    # cloche
    c.shaded_ellipse(19.5, 11, 7.2, 6.8, ITEM, light=(-0.7, -0.7))
    for y in range(11, 18):
        for x in range(12, 27):
            t = (x - 12) / 14
            c.set(x, y, ITEM[3] if t < 0.2 else ITEM[2] if t < 0.65 else ITEM[1])
    for x in range(18, 27):
        c.set(x, 12, ITEM[0]); c.set(x, 13, OUT)
    for x in range(19, 27, 2):
        c.set(x, 15, ITEM[0])
    for y in range(5, 18):
        c.setf(18, y, RAR[1] if y % 3 else RAR[2])
    for x in range(12, 27):
        c.set(x, 17, RAR[0] if x > 22 else RAR[1])
    c.set(15, 7, ITEM[3]); c.set(16, 6, ITEM[3])
    c.outline(OUT)
    return c


def helmet_hood():
    c = Canvas(W, H)
    c.shaded_ellipse(18.5, 11.5, 7.5, 7.5, ITEM, light=(-0.7, -0.6))
    c.poly([(11, 12), (14, 19), (9, 22), (8, 16)], ITEM[1])
    # ouverture du visage
    c.ellipse(22.5, 13, 4, 4.2, '#2a1d2e')
    c.ellipse(23.5, 13.5, 2.6, 3, '#1a1220')
    c.set(24, 12, '#e8384f'); c.set(26, 12, '#e8384f')
    for x in range(12, 25):
        c.setf(x, 18, RAR[1])
    c.set(16, 6, ITEM[3]); c.set(15, 7, ITEM[3])
    c.outline(OUT)
    return c


def armor_mail():
    """Plastron d'objet porté sur le tabard (cuirasse et épaulières teintées)."""
    c = Canvas(W, H)
    c.poly([(14, 19), (25, 19), (25, 29), (14, 29)], ITEM[2])
    for y in range(19, 30):
        c.set(14, y, ITEM[3]); c.set(15, y, ITEM[3] if y < 25 else ITEM[2])
        c.set(24, y, ITEM[1]); c.set(25, y, ITEM[0])
    for x in range(14, 26):
        c.set(x, 25, ITEM[1])
        c.set(x, 26, ITEM[3] if x < 18 else ITEM[2])
    # emblème de rareté
    c.ellipse(19.5, 22.5, 2.2, 2, RAR[1])
    c.set(19, 22, RAR[2]); c.set(20, 23, RAR[0])
    c.shaded_ellipse(13.5, 21, 4.4, 3.6, ITEM)
    c.shaded_ellipse(25.5, 21, 4.6, 3.8, ITEM)
    for x in range(9, 18):
        c.setf(x, 23, RAR[1])
    for x in range(21, 31):
        c.setf(x, 23, RAR[0])
    c.set(12, 19, ITEM[3]); c.set(24, 19, ITEM[3])
    c.outline(OUT)
    return c


def armor_tunic():
    """Surcot d'objet (tissu teinté, liseré de rareté)."""
    c = Canvas(W, H)
    c.poly([(14, 19), (25, 19), (26, 35), (13, 35)], ITEM[2])
    for y in range(19, 35):
        c.set(14, y, ITEM[3]); c.setf(25, y, ITEM[1])
    for x in range(13, 27):
        c.setf(x, 34, RAR[1])
    for y in range(20, 34):
        c.setf(19, y, RAR[1] if y != 30 else RAR[0])
    c.rect(13, 30, 14, 1, ITEM[0])
    c.set(19, 30, RAR[2])
    c.outline(OUT)
    return c


def cape(frame):
    """Cape derrière le chevalier, 3 images d'ondulation."""
    c = Canvas(W, H)
    sway = {'a': 0, 'b': 1.5, 'c': 3}[frame]
    pts = [(14, 18), (20, 18), (19, 26), (15, 34), (11 - sway * 0.3, 40), (6 - sway, 41 - sway * 0.4), (1 - sway * 0.6, 37 - sway),
           (3 - sway * 0.5, 31), (8, 23), (11, 19)]
    c.poly(pts, HERO[1])
    for i in range(3):
        x0, y0 = 12 - i * 2, 22 + i * 2
        c.line(x0, y0, x0 - 6 - sway * 0.8, y0 + 13 - sway * 0.6, HERO[0])
    c.line(13, 20, 6 - sway * 0.6, 33, HERO[2])
    c.line(14, 20, 9 - sway * 0.4, 30, HERO[3])
    c.line(15, 21, 11, 29, HERO[2])
    c.outline(OUT)
    return c


def shield():
    """Écu (bras arrière) : 12×15, couleurs du héros."""
    c = Canvas(12, 15)
    c.poly([(0, 0), (12, 0), (12, 8), (6, 15), (0, 8)], TRIM[1])
    c.poly([(1, 1), (11, 1), (11, 8), (6, 13.6), (1, 8)], HERO[2])
    for y in range(1, 13):
        for x in range(1, 11):
            if x < 4:
                c.setf(x, y, HERO[3] if y < 6 else HERO[2])
            elif x > 7:
                c.setf(x, y, HERO[1])
    for y in range(2, 12):
        c.setf(6, y, TRIM[2] if y < 7 else TRIM[1]); c.setf(5, y, TRIM[1])
    for x in range(2, 10):
        c.setf(x, 5, TRIM[2] if x < 6 else TRIM[1])
    c.set(0, 0, TRIM[2]); c.set(1, 0, TRIM[2]); c.set(11, 0, TRIM[0]); c.set(11, 1, TRIM[0])
    c.outline(OUT)
    return c


def weapon_sword():
    c = Canvas(9, 26)
    # lame
    for y in range(2, 18):
        c.set(3, y, ITEM[3]); c.set(4, y, ITEM[2]); c.set(5, y, ITEM[1])
    c.set(4, 1, ITEM[3]); c.set(4, 0, ITEM[3])
    c.set(3, 1, ITEM[3]); c.set(5, 1, ITEM[1])
    for y in range(4, 16, 4):
        c.set(4, y, ITEM[3])
    # garde
    for x in range(0, 9):
        c.set(x, 18, RAR[1] if 0 < x < 8 else RAR[0])
        c.set(x, 19, RAR[0])
    c.set(1, 18, RAR[2]); c.set(4, 18, RAR[2])
    # poignée et pommeau
    for y in range(20, 24):
        c.set(4, y, LEATHER[1] if y % 2 else LEATHER[2]); c.set(3, y, LEATHER[0]); c.set(5, y, LEATHER[0])
    c.shaded_ellipse(4.5, 24.5, 1.6, 1.4, RAR)
    c.outline(OUT)
    return c, (4, 21)


def weapon_axe():
    c = Canvas(13, 26)
    for y in range(2, 25):
        c.set(6, y, LEATHER[2] if y % 3 else LEATHER[1]); c.set(7, y, LEATHER[0])
    # fer
    c.poly([(7, 2), (12, 0), (13, 11), (7, 9)], ITEM[2])
    c.poly([(6, 3), (1, 1), (0, 8), (6, 7)], ITEM[1])
    for y in range(1, 11):
        c.setf(12, y, ITEM[3])
    for y in range(2, 8):
        c.setf(1, y, ITEM[2])
    c.rect(5, 3, 4, 2, RAR[1]); c.set(5, 3, RAR[2]); c.rect(5, 8, 4, 1, RAR[0])
    c.set(6, 0, ITEM[3]); c.set(6, 1, ITEM[2])
    c.outline(OUT)
    return c, (6, 20)


def weapon_dagger():
    c = Canvas(7, 16)
    for y in range(1, 9):
        c.set(2, y, ITEM[3]); c.set(3, y, ITEM[2]); c.set(4, y, ITEM[1])
    c.set(3, 0, ITEM[3])
    for x in range(0, 7):
        c.set(x, 9, RAR[1] if 0 < x < 6 else RAR[0])
    for y in range(10, 14):
        c.set(3, y, LEATHER[2] if y % 2 else LEATHER[1])
    c.shaded_ellipse(3.5, 14.5, 1.3, 1.2, RAR)
    c.outline(OUT)
    return c, (3, 11)


def build():
    """Renvoie {nom: (canvas, extra)}."""
    out = {}
    for pose in ('idle', 'walk1', 'walk2', 'attack'):
        cv, hand = body(pose)
        out[f'hero_{pose}'] = (cv, {'hand': {'x': hand[0], 'y': hand[1]}})
    out['helmet_default'] = (helmet_default(), {'oy': 0})
    out['helmet_helm'] = (helmet_helm(), {'oy': 0})
    out['helmet_hood'] = (helmet_hood(), {'oy': 0})
    out['armor_mail'] = (armor_mail(), {'oy': 0})
    out['armor_tunic'] = (armor_tunic(), {'oy': 0})
    for f in 'abc':
        out[f'cape_{f}'] = (cape(f), {'oy': 0})
    out['shield'] = (shield(), {})
    for name, fn in (('weapon_sword', weapon_sword), ('weapon_axe', weapon_axe), ('weapon_dagger', weapon_dagger)):
        cv, grip = fn()
        out[name] = (cv, {'grip': {'x': grip[0], 'y': grip[1]}})
    return out
