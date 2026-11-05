"""v9.2.3 : animations dessinées image par image (PixelLab, animate-pixminimax) des alliés : héros (chevalier et
8 apparences, une attaque par classe avec l'arme de la classe), compagnons et familiers — marche, attaque, nage.

Sources : tools/art/pixellab/anim_allies/<clé>_<anim>/fN.png (f0 et la dernière image = vue de référence),
vues de référence dans anim_allies/_ref/<clé>.png + .json :
  ox, oy  coin du sprite de jeu dans la vue (héros : coin de heroComposite / heroSwim)
  scale   échelle du sprite de jeu (compagnons PixelLab), absente pour les dessins faits main
  roles   couleurs à garder sur un caractère fixe (palette des héros recolorés : B, P, W, K, 4 à 8)
Nettoyage (fonctions de pixellab_anim.py) : alpha franc, poussières, couleurs ramenées à la palette de la vue.
Stabilité : chaque image de marche/attaque est recalée pour que ses pieds (dernière ligne opaque) restent sur la
ligne des pieds de la vue ; la marche garde aussi l'axe des jambes ; la nage garde le centre du corps. Le cadre est
commun à toutes les images d'une animation (décalage ox, oy par rapport au sprite de jeu).

Écrit src/render/art-anim-allies.js. Usage : python3 tools/art/pixellab_allies.py
"""
import glob
import json
import os
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)

from lib import Canvas, FREE_CHARS, rgb2hex  # noqa: E402
from pixellab import MAX_COLORS  # noqa: E402
from pixellab_anim import _clean_alpha, _drop_specks, _palette, _remap, _rle  # noqa: E402

SRC = os.path.join(HERE, 'pixellab', 'anim_allies')
FPS = {'walk': 12, 'swim': 9, 'attack': 24}
LOOPS = ('walk', 'swim')  # la dernière image (= vue) est retirée : le cycle reboucle sur f0


def _shift(img, dx, dy):
    out = Image.new('RGBA', img.size)
    out.paste(img, (dx, dy))
    return out


def _feet(img):
    """Dernière ligne opaque et centre des jambes (quart bas de la silhouette)."""
    box = img.getbbox()
    if not box:
        return None, None
    y1 = box[3]
    leg = img.crop((0, max(box[1], y1 - max(3, (y1 - box[1]) // 4)), img.width, y1))
    lb = leg.getbbox()
    return y1, ((lb[0] + lb[2]) / 2 if lb else (box[0] + box[2]) / 2)


def _center(img):
    b = img.getbbox()
    return ((b[0] + b[2]) / 2, (b[1] + b[3]) / 2) if b else (0, 0)


def stabilize(frames, ref, anim):
    """Recale chaque image sur la vue de référence (sans dérive) ; renvoie les images recalées."""
    out = []
    if anim == 'swim':
        cx, cy = _center(ref)
        for f in frames:
            fx, fy = _center(f)
            out.append(_shift(f, round(cx - fx), round(cy - fy)))
        return out
    ry, rx = _feet(ref)
    for f in frames:
        fy, fx = _feet(f)
        if fy is None:
            out.append(f)
            continue
        dx = round(rx - fx) if anim == 'walk' else 0
        out.append(_shift(f, dx, ry - fy))
    return out


def drop_fx(img, ref, pad=6):
    """Effets détachés du corps (traînée, projectile, étincelles hors de la silhouette) : le jeu dessine les siens.
    Gardés : le plus grand amas (corps + arme tenue) et les amas proches de la boîte de la vue."""
    w, h = img.size
    px = img.load()
    rb = ref.getbbox()
    seen, blobs = set(), []
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
            blobs.append(blob)
    if not blobs:
        return img
    main = max(blobs, key=len)
    for b in blobs:
        if b is main:
            continue
        inside = all(rb[0] - pad <= x < rb[2] + pad and rb[1] - pad <= y < rb[3] + pad for x, y in b)
        if not inside:
            for p in b:
                px[p] = (0, 0, 0, 0)
    return img


def _limit(ref, keep=MAX_COLORS - 14):
    """Vue PixelLab en pleine couleur : palette ramenée à `keep` couleurs (place pour les couleurs nouvelles)."""
    if len(_palette(ref)) <= keep:
        return ref
    alpha = ref.getchannel('A')
    q = ref.convert('RGB').quantize(colors=keep, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGBA')
    q.putalpha(alpha)
    return q


def _grid(img):
    c = Canvas(img.width, img.height)
    px = img.load()
    for y in range(img.height):
        for x in range(img.width):
            if px[x, y][3]:
                c.px[y][x] = rgb2hex(px[x, y][:3])
    return c


def build():
    sprites, index = {}, {}
    for d in sorted(glob.glob(os.path.join(SRC, '*_*'))):
        name = os.path.basename(d)
        if name.startswith('_'):
            continue
        key, _, anim = name.rpartition('_')
        cls = None
        if anim == 'attack' and key.startswith('hero_') and key.count('_') == 2:
            key, _, cls = key.rpartition('_')  # hero_<apparence>_<classe>_attack
        ref_key = f'{key}_swim' if anim == 'swim' else key
        if anim == 'attack' and cls:
            ref_key = f'{key}_{cls}'
        meta = json.load(open(os.path.join(SRC, '_ref', f'{ref_key}.json')))
        ref = _clean_alpha(Image.open(os.path.join(SRC, '_ref', f'{ref_key}.png')))
        paths = sorted(glob.glob(os.path.join(d, 'f*.png')), key=lambda p: int(os.path.basename(p)[1:-4]))
        if anim in LOOPS:
            paths = paths[:-1]
        frames = [drop_fx(_drop_specks(_clean_alpha(Image.open(p))), ref) for p in paths]
        frames = _remap(frames, _palette(_limit(ref)))
        frames = stabilize(frames, ref, anim)
        boxes = [f.getbbox() for f in frames if f.getbbox()]
        ux0, uy0 = min(b[0] for b in boxes), min(b[1] for b in boxes)
        ux1, uy1 = max(b[2] for b in boxes), max(b[3] for b in boxes)
        group = f'{key}_{cls}_{anim}' if cls else f'{key}_{anim}'
        names = []
        for i, f in enumerate(frames):
            fname = f'{group}{i}'
            crop = f.crop((ux0, uy0, ux1, uy1))
            sprites[fname] = (_grid(crop), {'scale': meta['scale']} if meta.get('scale') else {}, meta.get('roles', {}))
            names.append(fname)
            if os.environ.get('PREVIEW_DIR'):
                p = os.path.join(os.environ['PREVIEW_DIR'], group)
                os.makedirs(p, exist_ok=True)
                crop.save(os.path.join(p, f'f{i}.png'))
        entry = {'frames': names, 'ox': ux0 - meta['ox'], 'oy': uy0 - meta['oy'], 'fps': FPS[anim]}
        if anim == 'attack':
            entry['hit'] = _hit_frame(frames, ref)
        if anim == 'swim':  # repère : centre du corps de la vue, par rapport au coin du sprite de jeu
            cx, cy = _center(ref)
            entry.update(cx=round(cx - meta['ox'], 1), cy=round(cy - meta['oy'], 1))
        index.setdefault(key, {})[f'attack_{cls}' if cls else anim] = entry
    return sprites, index


def _hit_frame(frames, ref):
    """Image du coup (arme la plus en avant : bord droit le plus loin), utilisée pour caler le geste sur l'impact."""
    rx = ref.getbbox()[2]
    reach = [(f.getbbox() or (0, 0, rx, 0))[2] - rx for f in frames]
    best = max(range(len(frames)), key=lambda i: (reach[i], -i))
    return best if reach[best] > 2 else len(frames) // 2


def write(sprites, index):
    lines = [
        '// FICHIER GÉNÉRÉ par tools/art/pixellab_allies.py — ne pas modifier à la main.',
        '// v9.2.3 : animations dessinées image par image (PixelLab) des alliés : héros, compagnons, familiers.',
        'export const ALLY_ANIM_ART = {',
    ]
    pals, last = {}, {}
    for name in sorted(sprites, key=lambda k: (k.rstrip('0123456789'), int(k[len(k.rstrip('0123456789')):]))):
        canvas, extra, roles = sprites[name]
        group = name.rstrip('0123456789')
        pal = pals.setdefault(group, dict(roles))
        free = [ch for ch in FREE_CHARS if ch not in roles.values()]
        rows = []
        for y in range(canvas.h):
            row = []
            for x in range(canvas.w):
                c = canvas.px[y][x]
                if c is None:
                    row.append('.')
                    continue
                if c not in pal:
                    used = set(pal.values())
                    left = [ch for ch in free if ch not in used]
                    pal[c] = left[0] if left else pal[min(pal, key=lambda k: sum((int(k[i:i + 2], 16) - int(c[i:i + 2], 16)) ** 2 for i in (1, 3, 5)))]
                row.append(pal[c])
            rows.append(''.join(row))
        # Poids : une ligne identique à la même ligne de l'image précédente s'écrit '' (ally-anim.js la recopie).
        prev = last.get(group)
        enc = ['' if prev and prev[y] == r else _rle(r) for y, r in enumerate(rows)]
        last[group] = rows
        entry = {'rows': enc, 'pr': group}
        entry.update(extra)
        lines.append(f'  {json.dumps(name)}: {json.dumps(entry, ensure_ascii=False, separators=(",", ":"))},')
    lines.append('};')
    lines.append('export const ALLY_ANIM_PALS = ' + json.dumps({g: {ch: c for c, ch in p.items()} for g, p in pals.items()}, separators=(',', ':')) + ';')
    lines.append('// Animations par personnage : images, décalage (ox, oy) par rapport au sprite de jeu, images par seconde,')
    lines.append('// image du coup (hit) des attaques, centre du corps (cx, cy) des nages.')
    lines.append('export const ALLY_ANIMS = ' + json.dumps(index, separators=(',', ':')) + ';')
    lines.append('')
    out = os.path.join(ROOT, 'src', 'render', 'art-anim-allies.js')
    with open(out, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))
    print(f'{len(sprites)} images -> {os.path.relpath(out, ROOT)} ({os.path.getsize(out) // 1024} Ko)')


if __name__ == '__main__':
    write(*build())
