"""Nouveaux personnages (chara design PixelLab, v9.0.7) : 19 compagnons, 5 ennemis et 3 boss.

Sources : tools/art/pixellab/<sprite>.png, planches 512×64 = 8 directions de 64×64
(0 face, 1 trois-quarts droite, 2 profil droit, 3 dos-droite, 4 dos, 5 dos-gauche, 6 profil gauche, 7 trois-quarts gauche).
Les compagnons regardent vers la droite (direction 1), les ennemis vers la gauche (direction 7).

Les sprites gardent leur pleine définition (personnage d'environ 60 px) : l'entrée porte un facteur `scale`
qui les ramène à la taille du jeu à l'affichage (la scène est rendue à 2–3 pixels d'écran par pixel de jeu,
le détail est donc conservé). v9.0.8 : le dessin n'est jamais déformé. Chaque personnage a une démarche (`gait`) :
  walk   bipède : deux images de pas (_w1/_w2) — une jambe levée et avancée, l'autre au sol, corps 1 px plus haut
  quad   quadrupède : idem avec les pattes avant / arrière
  glide  robe longue : glisse en se balançant (pas d'images de pas)
  fly    ailé : vole juste au-dessus du sol
  hop    gluant, mandragore : avance par sauts
Le jeu (src/render/scene.js) enchaîne repos → pas 1 → repos → pas 2 au rythme de la marche du chevalier.
"""
import os

from PIL import Image

from lib import Canvas, FREE_CHARS, rgb2hex

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'pixellab')

# Hauteur à l'écran (pixels de jeu) : celle de l'ancien sprite, un peu plus grande (têtes « chibi »).
TARGET = {
    'ally_archangel': 54, 'ally_azure_paladin': 44, 'ally_barbarian': 44, 'ally_demon_queen': 54, 'ally_dwarf': 40,
    'ally_elf_archer': 44, 'ally_high_priest': 44, 'ally_ice_empress': 50, 'ally_mercenary': 44, 'ally_ninja': 43,
    'ally_priestess': 44, 'ally_pyromancer': 44, 'ally_ranger': 43, 'ally_rose_blade': 43, 'ally_shadow': 44,
    'ally_shadow_lord': 54, 'ally_squire': 44, 'ally_sylvan_guardian': 50, 'ally_witch': 44,
    'boar': 24, 'goblin': 30, 'goblin_armored': 34, 'mandrake': 26, 'slime': 20,
    'boss_slime_king': 62, 'hard_scarecrow': 66, 'mid_boar_titan': 54,
}
MARGIN = 4  # place pour le pas en avant
GAIT = {
    'ally_archangel': 'fly', 'ally_demon_queen': 'fly',
    'ally_ice_empress': 'glide', 'ally_priestess': 'glide', 'ally_high_priest': 'glide', 'ally_pyromancer': 'glide',
    'slime': 'hop', 'boss_slime_king': 'hop', 'mandrake': 'hop',
    'boar': 'quad', 'mid_boar_titan': 'quad',
}  # les autres : 'walk'
LEG_TOP = 0.8  # les jambes occupent environ le dernier cinquième du personnage
# Ailes (personnages qui volent) : zones (x0, y0, x1, y1) dans l'image recadrée, épaule (pivot) de chaque aile.
# Dans ces zones, les pixels « chauds et clairs » (cheveux blonds, or, peau, flammes) appartiennent au corps.
WINGS = {
    'ally_archangel': [((0, 4, 19, 44), (20, 26)), ((0, 45, 14, 56), (20, 26))],  # bas de l'aile, sans l'épée
    'ally_demon_queen': [((0, 10, 14, 48), (15, 24)), ((37, 13, 47, 40), (36, 22))],
}
WING_LIFT = 6  # déplacement vertical des pointes d'ailes (pixels) entre ailes hautes et ailes basses
MAX_COLORS = len(FREE_CHARS) - 2


def _frame(key):
    sheet = Image.open(os.path.join(SRC, f'{key}.png')).convert('RGBA')
    col = 1 if key.startswith('ally_') else 7
    f = sheet.crop((col * 64, 0, col * 64 + 64, 64))
    f = f.crop(f.getbbox())
    # Couleurs limitées à la palette locale (caractères libres) : quantification sur les pixels opaques.
    alpha = f.getchannel('A').point(lambda a: 255 if a >= 128 else 0)
    rgb = Image.new('RGB', f.size, (0, 0, 0))
    rgb.paste(f.convert('RGB'), mask=alpha)
    q = rgb.quantize(colors=MAX_COLORS, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    out = Image.new('RGBA', f.size, (0, 0, 0, 0))
    out.paste(q, mask=alpha)
    return out


def _shear(img, top, bottom=0, split=1.0, dy_top=0):
    """Décale chaque ligne horizontalement : `top` px en haut, `bottom` px en bas (interpolé), seulement au-dessus
    de `split` (fraction de hauteur) ; dy_top décale le haut du corps verticalement (respiration)."""
    w, h = img.size
    out = Image.new('RGBA', (w + 2 * MARGIN, h), (0, 0, 0, 0))
    src = img.load()
    dst = out.load()
    cut = int(h * split)
    for y in range(h):
        k = 1 - y / max(1, h - 1)
        dx = round(bottom + (top - bottom) * k)
        sy = y - dy_top if y < cut else y
        if sy < 0:
            continue
        for x in range(w):
            p = src[x, sy]
            if p[3]:
                dst[x + MARGIN + dx, y] = p
    return out


def _legs(img, dx):
    """Marche : le bas (jambes, ~30 %) avance ou recule d'un pixel."""
    w, h = img.size
    out = Image.new('RGBA', (w + 2 * MARGIN, h), (0, 0, 0, 0))
    leg = int(h * 0.7)
    out.paste(img.crop((0, 0, w, leg)), (MARGIN, 0), img.crop((0, 0, w, leg)))
    low = img.crop((0, leg, w, h))
    out.paste(low, (MARGIN + dx, leg), low)
    return out


def _leg_split(img):
    """Colonne qui sépare les deux jambes (ou pattes avant / arrière) : la moins remplie au milieu du bas du corps."""
    w, h = img.size
    top = int(h * LEG_TOP)
    a = img.getchannel('A').load()
    counts = [sum(1 for y in range(top, h) if a[x, y]) for x in range(w)]
    cols = [x for x in range(w) if counts[x]]
    x0, x1 = cols[0], cols[-1]
    lo, hi = x0 + (x1 - x0) * 3 // 10, x0 + (x1 - x0) * 7 // 10
    split = min(range(lo, hi + 1), key=lambda x: (counts[x], abs(x - (x0 + x1) / 2)))
    return top, split


def _step(img, lift_front, facing):
    """Pas de marche (position de passage) : le corps monte d'un pixel, une jambe se lève de 2 px et avance (ou recule),
    l'autre reste posée au sol et s'allonge d'un pixel pour rester attachée au corps."""
    w, h = img.size
    top, split = _leg_split(img)
    out = Image.new('RGBA', (w + 2 * MARGIN, h), (0, 0, 0, 0))
    body = img.crop((0, 0, w, top))
    out.paste(body, (MARGIN, -1), body)
    left = img.crop((0, top, split, h))
    right = img.crop((split, top, w, h))
    front, back = (right, left) if facing > 0 else (left, right)
    front_x, back_x = (split, 0) if facing > 0 else (0, split)
    lifted, planted = (front, back) if lift_front else (back, front)
    lifted_x, planted_x = (front_x, back_x) if lift_front else (back_x, front_x)
    # Jambe d'appui : au sol, sa première ligne recopiée au-dessus (le corps a monté d'un pixel).
    out.paste(planted.crop((0, 0, planted.width, 1)), (MARGIN + planted_x, top - 1), planted.crop((0, 0, planted.width, 1)))
    out.paste(planted, (MARGIN + planted_x, top), planted)
    # Jambe levée : 2 px plus haut, 1 px vers l'avant (jambe avant) ou l'arrière (jambe arrière).
    step = facing if lift_front else -facing
    out.paste(lifted, (MARGIN + lifted_x + step, top - 2), lifted)
    return out


def _is_body(p):
    r, g, b = p[:3]
    return (r > g > b and r - b > 70 and r > 150) or (r > 200 and g > 120 and b < g - 50)  # blond, or, peau, flammes (pas le blanc)


def _flap(img, key, lift):
    """Battement d'ailes : chaque pixel d'aile pivote autour de l'épaule — les pointes montent (lift > 0) ou
    descendent (lift < 0) proportionnellement à leur distance ; le corps est redessiné par-dessus, intact."""
    w, h = img.size
    src = img.load()
    wing = Image.new('RGBA', (w + 2 * MARGIN, h + 2 * MARGIN), (0, 0, 0, 0))
    body = Image.new('RGBA', (w + 2 * MARGIN, h + 2 * MARGIN), (0, 0, 0, 0))
    wp, bp = wing.load(), body.load()
    for y in range(h):
        for x in range(w):
            p = src[x, y]
            if not p[3]:
                continue
            for (x0, y0, x1, y1), (px, py) in WINGS[key]:
                if x0 <= x <= x1 and y0 <= y <= y1 and not _is_body(p):
                    span = max(abs(px - x0), abs(x1 - px), 1)
                    dy = -round(lift * abs(px - x) / span)
                    ny = y + dy + MARGIN
                    if 0 <= ny < h + 2 * MARGIN:
                        wp[x + MARGIN, ny] = p
                    break
            else:
                bp[x + MARGIN, y + MARGIN] = p
    wing.alpha_composite(body)
    return wing.crop((0, MARGIN, w + 2 * MARGIN, h + MARGIN))  # même cadre que l'image de base (pieds alignés)


def _canvas(img):
    c = Canvas(img.width, img.height)
    px = img.load()
    for y in range(img.height):
        for x in range(img.width):
            p = px[x, y]
            if p[3]:
                c.px[y][x] = rgb2hex(p[:3])
    return c


# Images d'animation de l'ancien design portant le même nom : supprimées (seules les images de pas sont refaites).
SUFFIXES = ('_b', '_atk', '_wind', '_w1', '_w2')
STEPPING = {k for k in TARGET if GAIT.get(k, 'walk') in ('walk', 'quad')}
REMOVE = [key + suffix for key in TARGET for suffix in SUFFIXES if not (key in STEPPING and suffix in ('_w1', '_w2'))]
# Images de battement d'ailes : _f1 ailes hautes, _f2 ailes basses.


def build():
    """Le dessin d'origine, intact, plus deux images de pas pour les bipèdes et quadrupèdes."""
    out = {}
    for key, target in TARGET.items():
        base = _frame(key)
        gait = GAIT.get(key, 'walk')
        extra = {'scale': round(target / base.height, 4), 'gait': gait}
        out[key] = (_canvas(_shear(base, 0)), dict(extra))
        if key in WINGS:
            out[key + '_f1'] = (_canvas(_flap(base, key, WING_LIFT)), dict(extra))
            out[key + '_f2'] = (_canvas(_flap(base, key, -WING_LIFT)), dict(extra))
        if key in STEPPING:
            facing = 1 if key.startswith('ally_') else -1
            out[key + '_w1'] = (_canvas(_step(base, True, facing)), dict(extra))
            out[key + '_w2'] = (_canvas(_step(base, False, facing)), dict(extra))
    return out
