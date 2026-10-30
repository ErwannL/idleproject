"""Nouveaux personnages (chara design PixelLab, v9.0.7) : 19 compagnons, 5 ennemis et 3 boss.

Sources : tools/art/pixellab/<sprite>.png, planches 512×64 = 8 directions de 64×64
(0 face, 1 trois-quarts droite, 2 profil droit, 3 dos-droite, 4 dos, 5 dos-gauche, 6 profil gauche, 7 trois-quarts gauche).
Les compagnons regardent vers la droite (direction 1), les ennemis vers la gauche (direction 7).

Les sprites gardent leur pleine définition (personnage d'environ 60 px) : l'entrée porte un facteur `scale`
qui les ramène à la taille du jeu à l'affichage (la scène est rendue à 2–3 pixels d'écran par pixel de jeu,
le détail est donc conservé). Images dérivées du dessin d'origine, sans retouche du chara design :
  _b     respiration (haut du corps 1 px plus bas)
  _w1/_w2  marche (jambes décalées d'un pixel vers l'avant / l'arrière)
  _wind  préparation d'attaque (buste incliné vers l'arrière)
  _atk   coup porté (buste incliné vers l'avant)
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
MARGIN = 4  # place pour l'inclinaison des images d'attaque
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


def _canvas(img):
    c = Canvas(img.width, img.height)
    px = img.load()
    for y in range(img.height):
        for x in range(img.width):
            p = px[x, y]
            if p[3]:
                c.px[y][x] = rgb2hex(p[:3])
    return c


def build():
    out = {}
    for key, target in TARGET.items():
        base = _frame(key)
        extra = {'scale': round(target / base.height, 4)}
        fwd = 1 if key.startswith('ally_') else -1  # sens « vers l'ennemi »
        frames = {
            '': _shear(base, 0),
            '_b': _shear(base, 0, split=0.55, dy_top=1),
            '_wind': _shear(base, -2 * fwd),
            '_atk': _shear(base, 3 * fwd),
        }
        if key.startswith('ally_'):
            frames['_w1'] = _legs(base, fwd)
            frames['_w2'] = _legs(base, -fwd)
        for suffix, img in frames.items():
            out[key + suffix] = (_canvas(img), dict(extra))
    return out
