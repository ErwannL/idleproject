"""v10.15 : Ver des Sables colossal (sand_wyrm), animations PixelLab (/animate-pixminimax) à partir de pixellab1015/sand_wyrm/rest.png.
  python3 -I tools/art/pl1015_sand_wyrm.py anim <anim> [graine…]   essais → pixellab1015/sand_wyrm/<anim>_s<graine>/f0..fN.png
  python3 -I tools/art/pl1015_sand_wyrm.py keep <anim> <graine>    retient l'essai → pixellab1015/sand_wyrm/<anim>/
  python3 -I tools/art/pl1015_sand_wyrm.py sheet <anim> [graine]   contact sheet agrandie (dossier SW_OUT) pour relecture
Pas de dessin : montage, recadrage et redimensionnement au plus proche voisin seulement. Clé PIXELLAB_API_KEY jamais affichée."""
import os
import shutil
import sys
import time
from concurrent.futures import ThreadPoolExecutor

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
RAW = os.path.join(HERE, 'pixellab1015', 'sand_wyrm')
FRAME = 160
BASE = 'colossal ochre segmented sandworm rising upright from the sand, round toothed three-jawed maw, side view facing left'
N = {'idle': 8, 'attack': 9, 'hurt': 6, 'throw': 13, 'beam': 13, 'death': 13, 'idle3': 8, 'attack3': 9, 'throw3': 13, 'beam3': 13,
     'quake': 9, 'embers': 9, 'transform': 13, 'hurt3': 6}
DESC = {
    'idle': 'huge slow breathing, the whole upper body swaying widely left and right, head bobbing, jaws opening and closing, sand pouring off, tail curling',
    'attack': 'rears back far then lunges its open toothed maw forward to the left in a violent fast biting strike, then recoils to rest',
    'hurt': 'violently flinches and recoils backwards in pain with the head thrown back, shaking, then recovers',
    'throw': 'rears up and arches its head far back with mouth clenched winding up, holds, then snaps its head violently forward and down with a loud roar, jaws wide open, then settles back',
    'beam': 'rears its head high up and back with the jaws opening wider and wider, then roars with the maw wide open while the head slowly sweeps down and forward to the left, then rises back to rest',
    'death': 'collapses heavily falling to the ground, the head crashing down, bouncing once, dust cloud, then lying limp',
    'quake': 'rears up very high then slams its whole body and head down into the ground to the left, shaking the earth, dust and sand flying',
    'embers': 'raises its head high up to the sky with the maw wide open, roaring upward, body stretching tall',
    'transform': 'shaking and swelling with rage, the body flaring up and changing into a fiery enraged form, roaring',
}
for k in ('attack', 'throw', 'beam', 'hurt'):
    DESC[k + '3'] = DESC[k]  # la pose de colère (rest3) porte l'aspect ; décrire « enraged/burning » fait dériver le personnage
DESC['idle3'] = 'huge slow breathing, the upper body swaying widely left and right, head bobbing, jaws opening and closing, flames on its back flickering'
BASE3 = 'colossal charcoal and red segmented sandworm with a crest of flames on its back, round toothed maw, side view facing left'


def desc(anim):
    return f'{BASE3 if anim.endswith("3") else BASE}, {DESC[anim]}'


def run(args):
    from pl939_api import b64, call, to_img, wait
    anim, seed = args
    nolast = seed.endswith('n') or anim == 'transform'
    seed = int(seed.rstrip('n'))
    view = Image.open(os.path.join(RAW, 'rest3.png' if anim.endswith('3') else 'rest.png')).convert('RGBA')
    n = N[anim]
    req = -(-(n - 1) // 4) * 4  # l'API veut un multiple de 4 et rend req+1 images
    body = {'first_frame': b64(view), 'frame_count': req, 'seed': seed, 'no_background': True,
            'description': desc(anim), 'direction': 'east', 'view': 'side'}
    if anim == 'transform':
        body['last_frame'] = b64(Image.open(os.path.join(RAW, 'rest3.png')).convert('RGBA'))
    elif not nolast:
        body['last_frame'] = b64(view)
    imgs = None
    for essai in range(6):
        try:
            imgs = wait(call('POST', '/animate-pixminimax', body))['images']
            break
        except Exception as e:  # noqa: BLE001
            if essai == 5:
                return f'{anim}@{seed} ERREUR {str(e)[:200]}'
            time.sleep(10)
    out = os.path.join(RAW, f'{anim}_s{seed}{"n" if nolast and anim != "transform" else ""}')
    shutil.rmtree(out, ignore_errors=True)
    os.makedirs(out)
    pick = list(range(n)) if len(imgs) >= n and n in (8,) else [round(i * (len(imgs) - 1) / (n - 1)) for i in range(n)]
    for i, j in enumerate(pick):
        im = imgs[j]
        to_img(im).resize(view.size, Image.NEAREST).save(os.path.join(out, f'f{i}.png'))
    return f'{anim}@{seed} {len(imgs)} images'


def sheet(anim, seed=None, k=2, cols=7):
    d = os.path.join(RAW, anim if seed is None else f'{anim}_s{seed}')
    fs = sorted([f for f in os.listdir(d) if f.startswith('f')], key=lambda s: int(s[1:-4]))
    cols = min(cols, len(fs))
    rows = (len(fs) + cols - 1) // cols
    S = FRAME * k
    sh = Image.new('RGBA', (cols * S, rows * S), (60, 52, 78, 255))
    for i, f in enumerate(fs):
        im = Image.open(os.path.join(d, f)).convert('RGBA').resize((S, S), Image.NEAREST)
        sh.paste(im, ((i % cols) * S, (i // cols) * S), im)
    p = os.path.join(os.environ.get('SW_OUT', '/tmp'), f'{anim}{"" if seed is None else "_s" + str(seed)}.png')
    sh.save(p)
    return p


# Images fautives (projectile ou souffle dessinés par PixelLab, que le jeu dessine lui-même) remplacées par une autre
# image ENTIÈRE de la même planche : { anim: { image: image_source } }. Aucun pixel n'est retouché.
SUB = {'throw': {8: 9, 9: 10, 10: 11, 11: 12, 12: 0}, 'throw3': {9: 12, 10: 12, 11: 12, 12: 0}, 'quake': {8: 0}, 'embers': {8: 0}, 'transform': {10: 11, 11: 11}}
FOOT = FRAME - 6


def bottom(path):
    bb = Image.open(path).convert('RGBA').getchannel('A').point(lambda a: 255 if a >= 128 else 0).getbbox()
    return bb[3]


def install():
    dst = os.path.join(os.path.dirname(os.path.dirname(HERE)), 'assets', 'world-boss', 'sand_wyrm')
    os.makedirs(dst, exist_ok=True)
    b1, b3 = bottom(os.path.join(RAW, 'rest.png')), bottom(os.path.join(RAW, 'rest3.png'))
    for anim, n in N.items():
        d = os.path.join(RAW, anim)
        if not os.path.isdir(d):
            continue
        sh = Image.new('RGBA', (FRAME * n, FRAME))
        for i in range(n):
            f = Image.open(os.path.join(d, f'f{SUB.get(anim, {}).get(i, i)}.png')).convert('RGBA')
            if anim == 'transform':
                dy = FOOT - round(b1 + (b3 - b1) * i / (n - 1))
            else:
                dy = FOOT - (b3 if anim.endswith('3') else b1)
            f = f.transform(f.size, Image.AFFINE, (1, 0, 0, 0, 1, -dy), Image.NEAREST)
            sh.paste(f, (i * FRAME, 0))
        sh.save(os.path.join(dst, f'sand_wyrm_{anim}.png'), optimize=True)
        print('installé', anim, n)


def rest3(seed, strength):
    from pl939_api import b64, call, images_of, wait
    import pl1015_giants as g
    view = Image.open(os.path.join(RAW, 'rest.png')).convert('RGBA')
    d = (g.STYLE + ', colossal sandworm rising upright, enraged final form, scarlet red and charcoal segmented carapace with glowing '
         'molten orange cracks between the segments, burning red eyes, spiked ridges, round toothed three-jawed maw glowing hot inside, ember sparks')
    body = {'description': d, 'image_size': {'width': FRAME, 'height': FRAME}, 'no_background': True, 'seed': seed,
            'outline': 'single color black outline', 'shading': 'detailed shading', 'detail': 'highly detailed',
            'init_image': b64(view), 'init_image_strength': strength}
    im = images_of(wait(call('POST', '/create-image-pixflux', body)))[0]
    im.save(os.path.join(RAW, f'rest3_{seed}_{strength}.png'))
    return f'rest3_{seed}_{strength}'


if __name__ == '__main__':
    cmd, a = sys.argv[1], sys.argv[2:]
    if cmd == 'anim':
        seeds = a[1:] or ['3']
        with ThreadPoolExecutor(4) as ex:
            for m in ex.map(run, [(a[0], s) for s in seeds]):
                print(m, flush=True)
    elif cmd == 'rest3':
        with ThreadPoolExecutor(4) as ex:
            for m in ex.map(lambda sd: rest3(int(sd.split(':')[0]), int(sd.split(':')[1])), a):
                print(m, flush=True)
    elif cmd == 'install':
        install()
    elif cmd == 'keep':
        shutil.rmtree(os.path.join(RAW, a[0]), ignore_errors=True)
        shutil.copytree(os.path.join(RAW, f'{a[0]}_s{a[1]}'), os.path.join(RAW, a[0]))
    elif cmd == 'sheet':
        print(sheet(a[0], a[1] if len(a) > 1 else None))
