"""v10.9 (partie 2) : cartes du Bastion refaites avec PixelLab — une cour par âge, remparts seulement sur les bords,
12 parcelles vides (dalles) en grille 4 × 3, rien de haut au milieu. Un gabarit dessiné ici (init_image) fixe la place des
parcelles : les emplacements de src/ui/panels/camp.js (PLOTS_BY_AGE) suivent la même grille.

  python3 -I tools/art/pl109_maps.py guide            → tools/art/pixellab109/guide_ageN.png
  python3 -I tools/art/pl109_maps.py gen [N…] [seed]  → tools/art/pixellab109/bastion_map_ageN_sSEED.png
  python3 -I tools/art/pl109_maps.py install N=SEED…  → assets/ui/art109/bastion_map_ageN.png
Clé : PIXELLAB_API_KEY (jamais affichée ni écrite).
"""
import os
import sys
import time
import urllib.error

from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
RAW = os.path.join(HERE, 'pixellab109')
DST = os.path.join(ROOT, 'assets', 'ui', 'art109')
W, H = 384, 216
# Grille des parcelles (centres en px) : 4 colonnes, 3 rangées — mêmes valeurs que GRID109 dans camp.js.
COLS = [0.19, 0.395, 0.605, 0.81]
ROWS = [0.36, 0.61, 0.86]  # centre vertical de chaque dalle
PW, PH = 0.15, 0.13        # taille d'une dalle (en part de la carte)
AGES = {
    1: ('wooden palisade walls of sharpened logs on all four edges, green grass courtyard, dirt paths between the plots, morning light',
        (92, 64, 36), (96, 150, 62), (176, 150, 104)),
    2: ('grey stone ramparts with small corner towers on all four edges, cobblestone courtyard, banners on the back wall',
        (88, 84, 96), (120, 112, 104), (170, 160, 140)),
    3: ('white stone ramparts on all four edges, a garden courtyard with grass and white paths, sunset light',
        (210, 205, 190), (110, 150, 80), (220, 210, 180)),
    4: ('golden royal ramparts with red banners on all four edges, a festive paved royal courtyard, warm light',
        (190, 140, 60), (200, 170, 120), (236, 210, 160)),
    5: ('magical golden ramparts on all four edges at night, floating lanterns in the sky above the back wall, a glowing paved plaza',
        (120, 90, 150), (70, 60, 100), (150, 130, 170)),
}
STYLE = ', 16-bit fantasy RPG pixel art, flat top-down view of a castle courtyard seen from above, twelve empty square stone foundation slabs arranged in a neat grid of four columns and three rows, no buildings, no people, no trees in the middle, nothing tall in the courtyard, crisp pixels, no text'


def guide(age):
    _, wall, ground, slab = AGES[age]
    im = Image.new('RGB', (W, H), ground)
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, W, 30], fill=wall); d.rectangle([0, H - 14, W, H], fill=wall)
    d.rectangle([0, 0, 16, H], fill=wall); d.rectangle([W - 17, 0, W, H], fill=wall)
    for cx in COLS:
        for cy in ROWS:
            x0, y0 = (cx - PW / 2) * W, (cy - PH / 2) * H
            d.rectangle([x0, y0, x0 + PW * W, y0 + PH * H], fill=slab, outline=tuple(max(0, c - 60) for c in slab), width=2)
    return im


def gen(age, seed):
    from pl939_api import b64, call, images_of, wait
    g = guide(age)
    body = {'description': AGES[age][0] + STYLE, 'image_size': {'width': W, 'height': H}, 'no_background': False, 'seed': seed,
            'outline': 'single color black outline', 'shading': 'medium shading', 'detail': 'highly detailed',
            'init_image': b64(g), 'init_image_strength': int(os.environ.get('PL_STRENGTH', 150))}
    for essai in range(8):
        try:
            im = images_of(wait(call('POST', '/create-image-pixflux', body)))[0]
            os.makedirs(RAW, exist_ok=True)
            im.save(os.path.join(RAW, f'bastion_map_age{age}_s{seed}.png'))
            return f'âge {age} graine {seed} ok'
        except urllib.error.HTTPError as e:
            if e.code != 429 or essai == 7:
                return f'âge {age} ERREUR HTTP {e.code} {e.read()[:200]!r}'
            time.sleep(15 * (essai + 1))
        except Exception as e:  # noqa: BLE001
            return f'âge {age} ERREUR {str(e)[:200]}'


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'guide'
    os.makedirs(RAW, exist_ok=True)
    if cmd == 'guide':
        for a in AGES:
            guide(a).save(os.path.join(RAW, f'guide_age{a}.png'))
    elif cmd == 'gen':
        args = sys.argv[2:]
        seed = int(args[-1]) if args and len(args[-1]) > 2 else 109
        ages = [int(a) for a in args if len(a) <= 2] or list(AGES)
        from concurrent.futures import ThreadPoolExecutor
        with ThreadPoolExecutor(3) as ex:
            for m in ex.map(lambda a: gen(a, seed), ages):
                print(m, flush=True)
    elif cmd == 'install':
        os.makedirs(DST, exist_ok=True)
        for pair in sys.argv[2:]:
            a, s = pair.split('=')
            im = Image.open(os.path.join(RAW, f'bastion_map_age{a}_s{s}.png')).convert('RGB')
            im.quantize(colors=64, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB').save(os.path.join(DST, f'bastion_map_age{a}.png'), optimize=True)
            print(f'âge {a} → assets/ui/art109/bastion_map_age{a}.png')
