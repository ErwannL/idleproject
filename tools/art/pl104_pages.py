"""v10.4 (parties 1 et 2) : illustrations de la page Forge (une par atelier, et le bandeau), faites avec PixelLab
(point d accès /v2/create-image-pixflux), dans le style pixel art du jeu (art101 à art104).

  python3 tools/art/pl104_pages.py gen [nom…]    génère (ou régénère, si le nom est donné) les images :
                                                   source brute dans tools/art/pixellab104/pages/<nom>.png
                                                   (une génération par image ; les prompts sont dans prompts.json)
  python3 tools/art/pl104_pages.py build         réduit chaque image à 64 teintes (sans tramage, sans lissage) → assets/ui/art104/<nom>.png
Clé : variable d'environnement PIXELLAB_API_KEY (jamais affichée ni écrite). Budget : 20 générations au plus (5 utilisées).
"""
import json
import os
import sys
from concurrent.futures import ThreadPoolExecutor

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
SRC = os.path.join(HERE, 'pixellab104', 'pages')
DST = os.path.join(ROOT, 'assets', 'ui', 'art104')
PROMPTS = os.path.join(SRC, 'prompts.json')


def load():
    with open(PROMPTS, encoding='utf-8') as f:
        data = json.load(f)
    style = data.pop('_style')
    return style, data


def gen_one(args):
    from pl939_api import call, images_of, wait  # import tardif : la commande build n'a pas besoin de la clé
    import time
    import urllib.error
    name, spec, style = args
    try:
        body = {'description': spec['prompt'] + style, 'image_size': {'width': spec['size'][0], 'height': spec['size'][1]},
                'no_background': False, 'seed': spec.get('seed', 0), 'outline': 'single color black outline',
                'shading': 'medium shading', 'detail': 'highly detailed'}
        for essai in range(8):  # 429 : trop de demandes à la fois (le compte est partagé) → on patiente, puis on recommence
            try:
                im = images_of(wait(call('POST', '/create-image-pixflux', body)))[0]
                break
            except urllib.error.HTTPError as e:
                if e.code != 429 or essai == 7:
                    raise
                time.sleep(15 * (essai + 1))
        os.makedirs(SRC, exist_ok=True)
        im.save(os.path.join(SRC, f'{name}.png'))
        return f'{name} ok'
    except Exception as e:  # noqa: BLE001
        return f'{name} ERREUR {str(e)[:160]}'


def build():
    os.makedirs(DST, exist_ok=True)
    n = 0
    for f in sorted(os.listdir(SRC)):
        if not f.endswith('.png'):
            continue
        im = Image.open(os.path.join(SRC, f)).convert('RGBA')
        # 64 teintes au plus par image, sans tramage (le pixel art du jeu n'en compte guère plus), couleurs gardées vives.
        q = im.convert('RGB').quantize(colors=64, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGBA')
        q.putalpha(im.getchannel('A'))
        q.save(os.path.join(DST, f), optimize=True)
        n += 1
    print(f'{n} images → assets/ui/art104')


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'build'
    if cmd == 'gen':
        style, specs = load()
        names = sys.argv[2:] or [n for n in specs if not os.path.exists(os.path.join(SRC, f'{n}.png'))]
        with ThreadPoolExecutor(1) as ex:
            for m in ex.map(gen_one, [(n, specs[n], style) for n in names]):
                print(m, flush=True)
    elif cmd == 'build':
        build()
    else:
        sys.exit(__doc__)
