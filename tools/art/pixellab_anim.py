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
ANIMS = {
    'bat': {'fly': 14},
    'harpy': {'fly': 12},
    'skeleton': {'walk': 12, 'attack': 25, 'emerge': 12},
}
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


def build():
    """Entrées de sprites (une par image) et index des animations."""
    sprites, index = {}, {}
    for key, anims in ANIMS.items():
        sheet = Image.open(os.path.join(SRC, f'{key}.png')).convert('RGBA')
        view = sheet.crop((7 * 64, 0, 8 * 64, 64))
        bx0, by0 = view.getbbox()[:2]
        base = _frame(key)
        scale = round(TARGET[key] / base.height, 4)
        base_pal = _palette(base)
        for anim, fps in anims.items():
            paths = sorted(glob.glob(os.path.join(SRC, 'anim', f'{key}_{anim}', 'f*.png')), key=lambda p: int(os.path.basename(p)[1:-4]))
            frames = [_drop_specks(_clean_alpha(Image.open(p))) for p in paths]
            frames = _remap(frames, base_pal)
            boxes = [f.getbbox() for f in frames if f.getbbox()]
            ux0, uy0 = min(b[0] for b in boxes), min(b[1] for b in boxes)
            ux1, uy1 = max(b[2] for b in boxes), max(b[3] for b in boxes)
            names = []
            for i, f in enumerate(frames):
                name = f'{key}__{anim}{i}'
                sprites[name] = (_canvas(f.crop((ux0, uy0, ux1, uy1))), {'scale': scale, 'gait': GAIT.get(key, 'walk')})
                names.append(name)
                if os.environ.get('PREVIEW_DIR'):  # images nettoyées, pour les planches de contrôle
                    d = os.path.join(os.environ['PREVIEW_DIR'], f'{key}_{anim}')
                    os.makedirs(d, exist_ok=True)
                    f.crop((ux0, uy0, ux1, uy1)).save(os.path.join(d, f'f{i}.png'))
            # Décalage par rapport à l'image de base (cadre : boîte de la vue, plus MARGIN à gauche).
            index.setdefault(key, {})[anim] = {'frames': names, 'ox': ux0 - (bx0 - MARGIN), 'oy': uy0 - by0, 'fps': fps}
    return sprites, index


if __name__ == '__main__':
    sprites, index = build()
    lines = [
        '// FICHIER GÉNÉRÉ par tools/art/pixellab_anim.py — ne pas modifier à la main.',
        '// v9.2.3 : animations dessinées image par image (PixelLab) : bat, harpy, skeleton.',
        'export const ANIM_ART = {',
    ]
    for name in sorted(sprites):
        rows, pal = to_grid(sprites[name][0])
        entry = {'rows': rows}
        if pal:
            entry['pal'] = pal
        entry.update(sprites[name][1])
        lines.append(f'  {json.dumps(name)}: {json.dumps(entry, ensure_ascii=False, separators=(",", ":"))},')
    lines.append('};')
    lines.append('// Animations par sprite : images, décalage (ox, oy) par rapport au sprite de base, images par seconde.')
    lines.append('export const ENEMY_ANIMS = ' + json.dumps(index, ensure_ascii=False, separators=(',', ':')) + ';')
    lines.append('')
    out = os.path.join(ROOT, 'src', 'render', 'art-anim.js')
    with open(out, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))
    print(f'{len(sprites)} images -> {os.path.relpath(out, ROOT)} ({os.path.getsize(out) // 1024} Ko)')
