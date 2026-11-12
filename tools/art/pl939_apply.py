"""v9.4.0 : installe les personnages choisis (pixellab939/picks.json : clé → n° de variante).
Compagnons : la variante 64×64 devient la vue « trois-quarts droite » de tools/art/pixellab/<clé>.png (l'ancienne planche
est gardée dans pixellab939/old/), puis pixellab.py refait le sprite et ses pas (_w1, _w2, ailes) → art.js.
Les anciennes images faites main (_b, _atk, _wind) sont retirées : le jeu prend alors les animations PixelLab.
Familiers : la variante (32×32) remplace assets/sprites/pet_<id>.png et l'entrée d'art.js."""
import json, os, shutil, sys
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pixellab as pl
from pl939_import import entries, patch

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
CH = os.path.join(HERE, 'pixellab939', 'chars')
# Même hauteur que les Légendaires (Archange 54) ; le nain reste plus petit.
HEIGHT = {'ally_dwarf': 44}
GLIDE = {'ally_priestess', 'ally_high_priest', 'ally_pyromancer', 'ally_witch'}


def apply(picks):
    new, remove = {}, []
    for key, n in picks.items():
        src = Image.open(os.path.join(CH, key, f'sprite_v{n}.png')).convert('RGBA')
        if key.startswith('pet_'):
            box = src.getbbox(); img = src.crop(box)
            img.save(os.path.join(ROOT, 'assets', 'sprites', f'{key}.png'))
            new.update(entries({key: (img, {})}))
            continue
        sheet_path = os.path.join(HERE, 'pixellab', f'{key}.png')
        os.makedirs(os.path.join(HERE, 'pixellab939', 'old'), exist_ok=True)
        old = os.path.join(HERE, 'pixellab939', 'old', f'{key}.png')
        if os.path.exists(sheet_path) and not os.path.exists(old):
            shutil.copy(sheet_path, old)
        sheet = Image.open(sheet_path).convert('RGBA') if os.path.exists(sheet_path) else Image.new('RGBA', (512, 64))
        sheet.paste(Image.new('RGBA', (64, 64)), (64, 0))
        sheet.paste(src, (64, 0))
        sheet.save(sheet_path)
        pl.TARGET[key] = HEIGHT.get(key, 54)
        if key in GLIDE: pl.GAIT[key] = 'glide'
        pl.STEPPING.discard(key)
        if pl.GAIT.get(key, 'walk') in ('walk', 'quad'): pl.STEPPING.add(key)
        base = pl._frame(key)
        extra = {'scale': round(pl.TARGET[key] / base.height, 4), 'gait': pl.GAIT.get(key, 'walk')}
        out = {key: (pl._shear(base, 0), dict(extra))}
        if key in pl.STEPPING:
            out[key + '_w1'] = (pl._step(base, True, 1), dict(extra))
            out[key + '_w2'] = (pl._step(base, False, 1), dict(extra))
        else:
            remove += [key + '_w1', key + '_w2']
        remove += [key + s for s in ('_b', '_atk', '_wind', '_f1', '_f2')]
        new.update(entries(out, crop=False))
    patch(new, remove)
    return list(new)


if __name__ == '__main__':
    picks = json.load(open(os.path.join(HERE, 'pixellab939', 'picks.json')))
    only = sys.argv[1:]
    print(apply({k: v for k, v in picks.items() if not only or k in only}))
