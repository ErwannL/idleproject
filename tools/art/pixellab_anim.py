"""v9.2.3 : animations dessinées image par image (PixelLab, animate-pixminimax) pour quelques ennemis.

Sources : tools/art/pixellab/anim/<sprite>_<anim>/fN.png, images 64×64 générées à partir de la vue de l'ennemi
(direction 7 de tools/art/pixellab/<sprite>.png), dans le même cadre que cette vue.
Nettoyage : alpha franc, poussières isolées retirées (petits amas détachés), couleurs ramenées à la palette du sprite
de base (les couleurs nouvelles, terre de la sortie du sol, sont quantifiées à part), cadre commun à toutes les images
d'une animation. Chaque animation garde l'échelle du sprite de base et son décalage (ox, oy, en pixels du sprite)
par rapport à l'image de base, pour que les pieds restent au même endroit.

Écrit src/render/art-anim.js. Usage : python3 tools/art/pixellab_anim.py
"""
import glob
import json
import os
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)

from lib import to_grid  # noqa: E402
from pixellab import GAIT, MARGIN, MAX_COLORS, SRC, TARGET, _canvas, _frame  # noqa: E402

# Images par seconde de chaque animation (le jeu peut aussi piloter l'image par la phase : attaque, sortie du sol).
# v9.2.3 : animations trouvées dans tools/art/pixellab/anim/<sprite>_<anim>/ (tous les ennemis et boss des mondes 1 à 12).
FPS = {'walk': 12, 'fly': 12, 'attack': 25, 'emerge': 12, 'portal': 12, 'swim': 10, 'float': 8, 'hurt': 20, 'death': 10,
       'skill': 14, 'telegraph': 10, 'attack2': 25, 'skill2': 16}  # v9.7.1 (lot C, pl971_enemies.py / pl971_seabeasts.py)  # v9.2.3 : coup reçu, mort
FPS_SPRITE = {('bat', 'fly'): 14}
ANIM_NAMES = tuple(FPS)


def _discover():
    out = {}
    for d in sorted(glob.glob(os.path.join(SRC, 'anim', '*_*'))):
        key, _, anim = os.path.basename(d).rpartition('_')
        if anim in ANIM_NAMES and glob.glob(os.path.join(d, 'f*.png')):
            out.setdefault(key, {})[anim] = FPS_SPRITE.get((key, anim), FPS[anim])
    return out


ANIMS = _discover()

# v9.2.4 : images générées tournées vers la droite (dos au héros) : PixelLab fait souvent pivoter le personnage pendant
# le coup reçu ou l'élan. Repérées par tools/art/check_orientation.py (silhouette et couleurs comparées à l'image de base
# et à son miroir) puis vérifiées à l'œil ; elles sont retournées horizontalement avant le recalage.
R14 = (1, 2, 3, 4)
MIRROR = {
    ('boss_ash_dragon', 'hurt'): R14, ('boss_bone_lord', 'hurt'): R14,  # v9.3.0 : coup reçu du demon_king régénéré (face au héros), plus de miroir
   
    ('boss_phoenix', 'hurt'): (1, 2, 3), ('boss_sky_titan', 'hurt'): R14, ('boss_swamp_behemoth', 'hurt'): (1, 2, 3),
    ('hard_anubis', 'hurt'): (1, 2, 3), ('hard_flame_djinn', 'hurt'): (1, 2, 3), ('hard_frost_giant', 'hurt'): R14,
    ('hard_necromancer', 'hurt'): (1, 2, 3),  # v9.3.0 : coup reçu de hard_scarecrow régénéré (images retournées : la faux changeait de côté)
    ('hard_werewolf', 'hurt'): R14,
    ('mid_boar_titan', 'hurt'): (1,), ('mid_hellhound', 'hurt'): (1, 2, 3), ('mid_hydra', 'hurt'): R14,
    ('mid_thunder_griffin', 'hurt'): R14, ('mini_frost_witch', 'hurt'): R14, ('mini_harpy_queen', 'hurt'): R14,
    ('mini_pharaoh', 'hurt'): R14,
    ('hard_void_knight', 'attack'): (2, 3, 4), ('wraith', 'attack'): (1, 2, 3, 4, 6),    ('mini_salamander_chief', 'attack'): (3, 4),
}
BG = os.path.join(ROOT, 'assets', 'bg')


def _ground_ramp(zone, n=4):
    """v9.2.3 : couleurs de la terre de la zone (sous la surface du sol), de la plus sombre à la plus claire."""
    g = Image.open(os.path.join(BG, f'{zone}_ground.png')).convert('RGB')
    g = g.crop((0, 8, g.width, g.height))
    q = g.quantize(colors=n, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    return sorted(set(_pixels(q)), key=lambda c: 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2])


def _recolor_earth(frames, base_pal, zone):
    """Les couleurs absentes du sprite (terre, mottes) prennent la couleur du sol de la zone, à luminosité égale."""
    ramp = _ground_ramp(zone)
    lum = lambda c: 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]
    extra = sorted({p[:3] for f in frames for p in _pixels(f) if p[3] and p[:3] not in base_pal}, key=lum)
    if not extra:
        return frames
    lo, hi = lum(extra[0]), lum(extra[-1])
    m = {c: ramp[min(len(ramp) - 1, int((lum(c) - lo) / max(1, hi - lo + 1) * len(ramp)))] for c in extra}
    for f in frames:
        px = f.load()
        for y in range(f.height):
            for x in range(f.width):
                p = px[x, y]
                if p[3] and p[:3] in m:
                    px[x, y] = m[p[:3]] + (255,)
    return frames


def _base(key):
    """Vue de référence (cadre de génération), sprite de jeu, coin du sprite dans la vue, échelle.
    Sprites PixelLab : direction 7 de la planche ; sprites faits main (monde marin…) : anim/_ref/<sprite>.png (+ .json)."""
    ref = os.path.join(SRC, 'anim', '_ref', f'{key}.json')
    if os.path.exists(ref):
        meta = json.load(open(ref))
        view = Image.open(ref[:-5] + '.png').convert('RGBA')
        return view, view.crop((meta['ox'], meta['oy'], meta['ox'] + meta['w'], meta['oy'] + meta['h'])), (meta['ox'], meta['oy']), None, meta.get('base', False)
    sheet = Image.open(os.path.join(SRC, f'{key}.png')).convert('RGBA')
    view = sheet.crop((7 * 64, 0, 8 * 64, 64))
    bx0, by0 = view.getbbox()[:2]
    base = _frame(key)
    return view, base, (bx0 - MARGIN, by0), round(TARGET[key] / base.height, 4), False
MIN_SPECK = 4  # amas détachés de moins de 4 pixels : poussières de génération


def _clean_alpha(img):
    img = img.convert('RGBA')
    px = img.load()
    for y in range(img.height):
        for x in range(img.width):
            p = px[x, y]
            px[x, y] = (p[0], p[1], p[2], 255) if p[3] >= 128 else (0, 0, 0, 0)
    return img


def _drop_specks(img):
    w, h = img.size
    px = img.load()
    seen = set()
    for y0 in range(h):
        for x0 in range(w):
            if (x0, y0) in seen or not px[x0, y0][3]:
                continue
            blob, todo = [], [(x0, y0)]
            seen.add((x0, y0))
            while todo:
                x, y = todo.pop()
                blob.append((x, y))
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        n = (x + dx, y + dy)
                        if 0 <= n[0] < w and 0 <= n[1] < h and n not in seen and px[n][3]:
                            seen.add(n)
                            todo.append(n)
            if len(blob) < MIN_SPECK:
                for p in blob:
                    px[p] = (0, 0, 0, 0)
    return img


def _pixels(img):
    return img.get_flattened_data() if hasattr(img, 'get_flattened_data') else img.getdata()


def _palette(img):
    return sorted({p[:3] for p in _pixels(img) if p[3]})


def _remap(frames, base_pal, extra=12, near=48 ** 2):
    """Chaque couleur proche d'une couleur du sprite de base la prend ; les autres sont quantifiées ensemble."""
    def d2(a, b):
        return sum((a[i] - b[i]) ** 2 for i in range(3))
    far = []
    for f in frames:
        far += [p[:3] for p in _pixels(f) if p[3] and min(d2(p, c) for c in base_pal) > near]
    extra_pal = []
    if far:
        strip = Image.new('RGB', (len(far), 1))
        strip.putdata(far)
        q = strip.quantize(colors=min(extra, MAX_COLORS - len(base_pal)), method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
        extra_pal = sorted(set(_pixels(q.convert('RGB'))))
    pal = base_pal + extra_pal
    cache = {}
    out = []
    for f in frames:
        g = f.copy()
        px = g.load()
        for y in range(g.height):
            for x in range(g.width):
                p = px[x, y]
                if p[3]:
                    c = p[:3]
                    if c not in cache:
                        best = min(base_pal, key=lambda k: d2(c, k))
                        cache[c] = best if d2(c, best) <= near or not extra_pal else min(pal, key=lambda k: d2(c, k))
                    px[x, y] = cache[c] + (255,)
        out.append(g)
    return out


def _rle(row):
    """v9.2.3 : poids du bundle : une suite d'au moins 5 pixels identiques s'écrit `cN` (c : caractère, N : nombre),
    le jeu la développe au chargement (expandRow de src/render/sprites.js). Le caractère ` n'est dans aucune palette."""
    out, i = [], 0
    while i < len(row):
        j = i
        while j < len(row) and row[j] == row[i]:
            j += 1
        out.append(f'`{row[i]}{j - i}`' if j - i >= 5 else row[i] * (j - i))
        i = j
    return ''.join(out)


def _plain(img):
    """Sprite fait main (sans échelle) : grille brute, sans la marge des sprites PixelLab."""
    from lib import Canvas, rgb2hex
    c = Canvas(img.width, img.height)
    px = img.load()
    for y in range(img.height):
        for x in range(img.width):
            if px[x, y][3]:
                c.px[y][x] = rgb2hex(px[x, y][:3])
    return c


AIR = ('fly', 'float', 'swim')
FREE = ('emerge', 'portal')  # v9.2.3 : sorties (du sol, du portail) : le déplacement est voulu, pas de recalage


def _metrics(img, band=0.25):
    """v9.2.3 : ligne de pied (dernière rangée opaque), centre horizontal de la bande des pieds (quart bas de la
    silhouette) et centre de masse (x, y) de toute la silhouette."""
    px = img.load()
    pts = [(x, y) for y in range(img.height) for x in range(img.width) if px[x, y][3]]
    if not pts:
        return None
    y0, y1 = min(p[1] for p in pts), max(p[1] for p in pts)
    lim = y1 - max(1, round((y1 - y0 + 1) * band))
    feet = [p[0] for p in pts if p[1] > lim]
    return {'foot': y1, 'fx': sum(feet) / len(feet), 'cx': sum(p[0] for p in pts) / len(pts), 'cy': sum(p[1] for p in pts) / len(pts)}


PAD = 32  # v9.2.3 : marge du recalage (une image décalée ne perd aucun pixel au bord du cadre de 64)


def _align(frames, view, air, hop=False):
    """v9.2.3 : recale chaque image sur la vue de base (même cadre de génération) : au sol, pieds sur la même ligne et
    bande des pieds centrée au même x ; en vol ou à la nage, centre de masse au même point. Plus de saut entre images."""
    ref = _metrics(_clean_alpha(view.copy()))
    out = []
    for f in frames:
        m = _metrics(f)
        g = Image.new('RGBA', (f.width + 2 * PAD, f.height + 2 * PAD), (0, 0, 0, 0))
        if not m or not ref:
            g.alpha_composite(f, (PAD, PAD))
            out.append(g)
            continue
        if air:
            dx, dy = round(ref['cx'] - m['cx']), round(ref['cy'] - m['cy'])
        else:
            dx, dy = round(ref['fx'] - m['fx']), ref['foot'] - m['foot']
            if hop and dy > 0:  # bond d'un sauteur (gluant, crapaud) : il peut quitter le sol, jamais s'y enfoncer
                dy = 0
        g.alpha_composite(f, (PAD + dx, PAD + dy))
        out.append(g)
    return out


BASES = {}  # v9.7.1 : sprite de base remplacé (clé → image)


def build():
    """Entrées de sprites (une par image) et index des animations."""
    sprites, index = {}, {}
    for key, anims in ANIMS.items():
        view, base, (bx, by), scale, new_base = _base(key)
        base_pal = _palette(base)
        if new_base:  # v9.7.1 (lot C.4) : nouveau modèle (monstres marins) — le sprite de base est remplacé au chargement
            sprites[f'{key}__base0'] = (_plain(_clean_alpha(base)), {})
            BASES[key] = f'{key}__base0'
        for anim, fps in anims.items():
            paths = sorted(glob.glob(os.path.join(SRC, 'anim', f'{key}_{anim}', 'f*.png')), key=lambda p: int(os.path.basename(p)[1:-4]))
            frames = [_drop_specks(_clean_alpha(Image.open(p))) for p in paths]
            flip = MIRROR.get((key, anim), ())
            frames = [f.transpose(Image.FLIP_LEFT_RIGHT) if i in flip else f for i, f in enumerate(frames)]  # v9.2.4
            frames = _remap(frames, base_pal)
            meta = os.path.join(SRC, 'anim', f'{key}_{anim}', 'meta.json')
            if os.path.exists(meta) and json.load(open(meta)).get('ground'):
                frames = _recolor_earth(frames, base_pal, json.load(open(meta))['ground'])
            if anim not in FREE:
                air = anim in AIR or bool(set(anims) & set(AIR)) or GAIT.get(key) == 'fly'
                frames = _align(frames, view, air, hop=GAIT.get(key) == 'hop')
                pad = PAD
            else:
                pad = 0
            boxes = [f.getbbox() for f in frames if f.getbbox()]
            ux0, uy0 = min(b[0] for b in boxes), min(b[1] for b in boxes)
            ux1, uy1 = max(b[2] for b in boxes), max(b[3] for b in boxes)
            names = []
            for i, f in enumerate(frames):
                name = f'{key}__{anim}{i}'
                crop = f.crop((ux0, uy0, ux1, uy1))
                sprites[name] = (_canvas(crop), {'scale': scale, 'gait': GAIT.get(key, 'walk')}) if scale else (_plain(crop), {})
                names.append(name)
                if os.environ.get('PREVIEW_DIR'):  # images nettoyées, pour les planches de contrôle
                    d = os.path.join(os.environ['PREVIEW_DIR'], f'{key}_{anim}')
                    os.makedirs(d, exist_ok=True)
                    f.crop((ux0, uy0, ux1, uy1)).save(os.path.join(d, f'f{i}.png'))
            # Décalage par rapport à l'image de base (cadre : boîte de la vue, plus MARGIN à gauche).
            index.setdefault(key, {})[anim] = {'frames': names, 'ox': ux0 - pad - bx, 'oy': uy0 - pad - by, 'fps': fps}
    return sprites, index


# v9.7.1 (lot C) : compétences, annonces et secondes attaques dans un fichier chargé à la demande (art-anim-extra.js).
EXTRA = ('skill', 'telegraph', 'attack2', 'skill2', 'hurt', 'death')  # chargés après le démarrage


def write(sprites, index, out, extra=False):
    lines = [
        '// FICHIER GÉNÉRÉ par tools/art/pixellab_anim.py — ne pas modifier à la main.',
        '// v9.2.3 : animations dessinées image par image (PixelLab) des ennemis et boss des mondes 1 à 12.',
        'export const ANIM_ART = {',
    ]
    # v9.2.3 : une palette par animation (partagée par ses images), écrite une fois dans ANIM_PALS.
    from lib import FREE_CHARS
    pals = {}
    for name in sorted(sprites):
        canvas = sprites[name][0]
        group = name.rstrip('0123456789')
        pal = pals.setdefault(group, {})
        rows = []
        for y in range(canvas.h):
            row = []
            for x in range(canvas.w):
                c = canvas.px[y][x]
                if c is None:
                    row.append('.')
                    continue
                if c not in pal:
                    pal[c] = FREE_CHARS[len(pal)] if len(pal) < len(FREE_CHARS) else pal[min(pal, key=lambda k: sum((int(k[i:i + 2], 16) - int(c[i:i + 2], 16)) ** 2 for i in (1, 3, 5)))]
                row.append(pal[c])
            rows.append(''.join(row))
        entry = {'rows': [_rle(r) for r in rows], 'pr': group}
        entry.update(sprites[name][1])
        lines.append(f'  {json.dumps(name)}: {json.dumps(entry, ensure_ascii=False, separators=(",", ":"))},')
    lines.append('};')
    lines.append('// Palettes des animations (caractère → couleur), partagées par toutes les images d\'une animation.')
    lines.append('export const ANIM_PALS = ' + json.dumps({g: {ch: c for c, ch in p.items()} for g, p in pals.items()}, ensure_ascii=False, separators=(',', ':')) + ';')
    lines.append('// Animations par sprite : images, décalage (ox, oy) par rapport au sprite de base, images par seconde.')
    lines.append('export const ENEMY_ANIMS = ' + json.dumps(index, ensure_ascii=False, separators=(',', ':')) + ';')
    if not extra:
        lines.append('// v9.7.1 : nouveaux modèles (monstres marins) : sprite de base remplacé par cette image.')
        lines.append('export const ENEMY_BASES = ' + json.dumps(BASES, separators=(',', ':')) + ';')
    lines.append('')
    with open(out, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))
    print(f'{len(sprites)} images -> {os.path.relpath(out, ROOT)} ({os.path.getsize(out) // 1024} Ko)')


if __name__ == '__main__':
    sprites, index = build()
    parts = []
    for extra in (False, True):
        idx = {k: {a: e for a, e in v.items() if (a in EXTRA) == extra} for k, v in index.items()}
        idx = {k: v for k, v in idx.items() if v}
        names = {f for v in idx.values() for e in v.values() for f in e['frames']} | (set() if extra else set(BASES.values()))
        write({n: sprites[n] for n in sprites if n in names}, idx,
              os.path.join(ROOT, 'src', 'render', 'art-anim-extra.js' if extra else 'art-anim.js'), extra)
