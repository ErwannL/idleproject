"""v9.8 (B5) : visuels de la Boutique refaits dans la DA du jeu (pixel art fantasy doux, comme assets/sprites/icon_*.png :
contour sombre fin, lumière chaude, couleurs un peu désaturées, léger halo magique). Même composition (petit lot → lot
premium). Sorties : tools/art/pixellab98/shop/<nom>.png, puis planche de contrôle ; installation : --install.
Usage : python3 tools/art/pl98_shop.py [--install]"""
import glob, os, sys
from concurrent.futures import ThreadPoolExecutor
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pl939_api import call, wait, images_of

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
SHOP = os.path.join(ROOT, 'assets', 'ui', 'shop'); OUT = os.path.join(HERE, 'pixellab98', 'shop')
STYLE = [Image.open(os.path.join(ROOT, 'assets', 'sprites', f'icon_{n}.png')).convert('RGBA') for n in ('chest', 'gem', 'coin', 'bag') if os.path.exists(os.path.join(ROOT, 'assets', 'sprites', f'icon_{n}.png'))]
SIZE = {'crystal': 'pile of blue cyan magic crystals', 'cosmetic_pack': 'gift box of cosmetic outfit pieces', 'hero_ticket': 'golden summon ticket card',
        'pet_pack': 'small chest of green pet eggs and charms'}
TIER = {'mini': 'tiny', 'small': 'small', 'discovery': 'small', 'medium': 'medium', 'large': 'large', 'premium': 'huge overflowing', 'collection': 'large', 'heroic': 'large ornate', 'legendary': 'huge legendary golden', 'limited': 'ornate purple', 'permanent': 'blue'}

def desc(name):
    base = next((v for k, v in SIZE.items() if name.startswith(k)), name.replace('_', ' '))
    tier = next((v for k, v in TIER.items() if name.endswith(k)), '')
    return f'{tier} {base}, fantasy game shop icon, soft pixel art, thin dark outline (not pure black), warm light, slightly desaturated colors, subtle magic glow, transparent background'

def gen(path):
    name = os.path.basename(path)[:-4]
    try:
        body = {'description': desc(name), 'image_size': {'width': 96, 'height': 96}, 'no_background': True, 'seed': 3,
                'outline': 'single color outline', 'shading': 'medium shading', 'detail': 'medium detail'}
        im = images_of(wait(call('POST', '/create-image-pixflux', body)))[0]
        im.save(os.path.join(OUT, f'{name}.png')); return f'{name} ok'
    except Exception as e: return f'{name} ERREUR {str(e)[:120]}'  # noqa: BLE001

def install():
    for f in glob.glob(os.path.join(OUT, '*.png')):
        name = os.path.basename(f)[:-4]
        orig = Image.open(os.path.join(SHOP, f'{name}.png'))
        im = Image.open(f).convert('RGBA'); im = im.crop(im.getbbox())
        def fit(sz):
            k = min(sz[0] / im.width, sz[1] / im.height); c = Image.new('RGBA', sz, (0, 0, 0, 0))
            r = im.resize((max(1, int(im.width * k)), max(1, int(im.height * k))), Image.NEAREST); c.alpha_composite(r, ((sz[0] - r.width) // 2, sz[1] - r.height)); return c
        fit(orig.size).save(os.path.join(SHOP, f'{name}.png'))
        fit(Image.open(os.path.join(SHOP, f'{name}_s.png')).size).save(os.path.join(SHOP, f'{name}_s.png'))
    print('installé')

if __name__ == '__main__':
    if '--install' in sys.argv: install(); sys.exit(0)
    os.makedirs(OUT, exist_ok=True)
    names = [f for f in sorted(glob.glob(os.path.join(SHOP, '*.png'))) if not f.endswith('_s.png')]
    with ThreadPoolExecutor(5) as ex:
        for m in ex.map(gen, names): print(m, flush=True)
