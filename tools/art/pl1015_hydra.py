"""v10.15.0 : animations PixelLab de l'Hydre des Marais (api /animate-pixminimax, pose de repos validée par le joueur).
Même méthode que pl939_anims.py. Clé PIXELLAB_API_KEY jamais affichée. Pas de dessin Pillow : seulement choix d'images,
recadrage, assemblage et redimensionnement au plus proche voisin.

  python3 -I tools/art/pl1015_hydra.py rest3 [graine…]        pose de repos de colère (phase 3) par /edit-image-pixen
  python3 -I tools/art/pl1015_hydra.py gen <anim> [graine…]   essais d'une animation → pixellab1015/hydra/<anim>_s<graine>/g0..gK.png
  python3 -I tools/art/pl1015_hydra.py sheet <anim>_s<graine> planche de contrôle (images numérotées, agrandies)
  python3 -I tools/art/pl1015_hydra.py build <anim> <anim>_s<graine> i0,i1,…   retient n images → pixellab1015/hydra/<anim>/f0..fn.png
  python3 -I tools/art/pl1015_hydra.py install                planches → assets/world-boss/hydra/hydra_<anim>.png
"""
import os
import shutil
import sys
import time
import urllib.error
from concurrent.futures import ThreadPoolExecutor

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
ROOT = os.path.dirname(os.path.dirname(HERE))
RAW = os.path.join(HERE, 'pixellab1015', 'hydra')
DST = os.path.join(ROOT, 'assets', 'world-boss', 'hydra')
FRAME = 160
FOOT = FRAME - 6

SUBJECT = 'a huge crocodile-bodied swamp hydra with five serpent heads on long necks'
ANGRY = ('enraged: the same hydra but fiercer, glowing orange-yellow eyes on every head, burning orange cracks and veins glowing on the '
         'scales, hotter darker red-green colours, spikes sharper, mouths dripping glowing acid, aggressive hunched pose')

# nom: (images du fichier, images générées (multiple de 4), retour au repos (last_frame), repos utilisé, description du mouvement)
ANIMS = {
    'idle': (8, 8, True, 'rest', 'idle loop: the five serpent heads sway slowly and independently, each at a different rhythm, necks '
             'curving and uncurving, the crocodile body breathes in and out, slime drips from the jaw'),
    'attack': (9, 12, True, 'rest', 'heavy attack: the whole body crouches and coils back (anticipation), then the big crocodile head '
               'lunges far forward to the left in one very fast bite, jaws snapping shut, brief hold, then pulls back; the other heads '
               'thrash in sympathy'),
    'hurt': (6, 8, True, 'rest', 'violently hit by a huge blow from the left: the whole body is knocked backwards to the right and '
              'leans far back, the big head snaps up and back screaming with the mouth wide open, all other heads flail and whip '
              'backwards, then the body slowly rights itself'),
    'throw': (13, 16, True, 'rest', 'spitting acid: all heads rear back and the body crouches (wind up), the middle head arches '
               'back far, then thrusts forward and spits a glob of acid to the left in one fast motion, then recovers to standing'),
    'beam': (13, 16, True, 'rest', 'putrid breath attack: the middle serpent head rears straight up and back and opens its jaws very wide, '
              'the whole body inflates and the throat swells with sickly green gas while charging, then the big head snaps forward '
              'and stays frozen with its mouth stretched wide open, shaking and sweeping slowly downward while exhaling, then '
              'returns up; no breath, no beam, no light ray, no effect is drawn outside the animal, only the animal moves'),
    'death': (13, 16, False, 'rest', 'collapsing: the heads go limp and fall one by one, the legs buckle, the heavy body slams down '
               'onto the ground, bounces once, mud splashes, then lies still with the heads sprawled'),
    'quake': (9, 12, True, 'rest', 'ground slam: rears up on the back legs, then crashes the front claws and body down to the ground '
               'to the left, shockwave, all heads whip forward, then settles'),
    'embers': (9, 12, True, 'rest', 'the five heads all lift up and roar towards the sky, necks stretched straight up, body '
                'arching back, then lowering'),
    'idle3': (8, 8, True, 'rest3', 'angry idle loop: heads weave fast and aggressively and snap at the air, body heaving, '
              'orange eyes and cracks pulse, slime drips'),
    'attack3': (9, 12, True, 'rest3', 'furious attack: coils back then the big crocodile head lunges far forward to the left '
                'in a very fast savage bite, all other heads strike forward too, glowing, then pulls back'),
    'throw3': (13, 16, True, 'rest3', 'spitting: the body crouches and all heads rear back and coil (wind up), the big front head arches '
                'back far with its mouth open, then thrusts forward in one fast motion spitting to the left, then recovers to standing; '
                'only the animal moves, nothing is drawn leaving the mouth'),
    'beam3': (13, 16, True, 'rest3', 'furious breath attack: the middle burning head rears straight up and back and opens its jaws very wide, '
               'the whole body inflates and the throat swells with glowing gas while charging, then the head snaps forward and '
               'holds its mouth wide open exhaling to the left, sweeping slowly downward and shaking, then returns up; '
               'no energy beam is drawn, only the animal moves'),
    'transform': (13, 16, 'rest3', 'rest', 'becoming enraged: crouches and trembles, shakes all five heads, throws them back and '
                   'roars, glowing orange cracks spread over the whole body and flames ignite on the heads, then rises up, bigger '
                   'and more aggressive'),
}


def view(name):
    return Image.open(os.path.join(RAW, 'rest3.png' if name == 'rest3' else 'rest.png')).convert('RGBA')


def retry(f):
    for essai in range(8):
        try:
            return f()
        except urllib.error.HTTPError as e:
            if e.code != 429 or essai == 7:
                raise RuntimeError(f'HTTP {e.code} {e.read()[:200]!r}')
            time.sleep(15 * (essai + 1))


def gen(job):
    from pl939_api import b64, call, to_img, wait
    name, seed = job
    n, k, loop, rest, desc = ANIMS[name]
    v = view(rest)
    body = {'first_frame': b64(v), 'frame_count': k, 'seed': seed, 'no_background': True, 'description': desc,
            'direction': 'west', 'view': 'side', 'subject_description': SUBJECT}
    if loop:  # True : retour à la même pose ; 'rest3' : fin sur la pose de colère
        body['last_frame'] = b64(view(loop) if isinstance(loop, str) else v)
    try:
        r = retry(lambda: wait(call('POST', '/animate-pixminimax', body)))
    except Exception as e:  # noqa: BLE001
        return f'{name}@{seed} ERREUR {str(e)[:200]}'
    out = os.path.join(RAW, f'{name}_s{seed}')
    shutil.rmtree(out, ignore_errors=True)
    os.makedirs(out)
    for i, im in enumerate(r['images']):
        to_img(im).resize(v.size, Image.NEAREST).save(os.path.join(out, f'g{i}.png'))
    return f'{name}@{seed} {len(r["images"])} images'


def rest3(seeds):
    from pl939_api import b64, call, to_img, wait
    for s in seeds:
        r = retry(lambda: wait(call('POST', '/edit-image-pixen', {'image': b64(view('rest')), 'description': ANGRY, 'seed': s, 'no_background': True})))
        im = to_img(r['image']) if 'image' in r and r['image'] else to_img(r['images'][0])
        im = im.resize((FRAME, FRAME), Image.NEAREST)
        im.save(os.path.join(RAW, f'rest3_{s}.png'))
        print('rest3', s, im.size, flush=True)


def sheet(tag, cols=4, k=2):
    d = os.path.join(RAW, tag)
    files = sorted((f for f in os.listdir(d) if f[0] in 'gf' and f.endswith('.png')), key=lambda f: int(f[1:-4]))
    ims = [Image.open(os.path.join(d, f)).convert('RGBA') for f in files]
    rows = (len(ims) + cols - 1) // cols
    cw = ims[0].width * k
    sh = Image.new('RGBA', (cols * cw, rows * cw), (70, 80, 100, 255))
    dr = ImageDraw.Draw(sh)
    for n, im in enumerate(ims):
        x, y = (n % cols) * cw, (n // cols) * cw
        im = im.resize((cw, cw), Image.NEAREST)
        sh.paste(im, (x, y), im)
        dr.rectangle((x, y, x + cw - 1, y + cw - 1), outline=(120, 130, 150, 255))
        dr.text((x + 4, y + 2), str(n), fill=(255, 255, 0, 255))
        # ligne des pieds
        dr.line((x, y + FOOT * k, x + cw, y + FOOT * k), fill=(255, 0, 255, 120))
    p = os.path.join(os.environ.get('SHEETS', RAW), f'sheet_{tag}.png')
    sh.save(p)
    print(p, len(ims))


def build(name, tag, idx):
    src = os.path.join(RAW, tag)
    out = os.path.join(RAW, name)
    shutil.rmtree(out, ignore_errors=True)
    os.makedirs(out)
    n = ANIMS[name][0]
    assert len(idx) == n, f'{name}: {n} images attendues, {len(idx)} données'
    for i, j in enumerate(idx):
        shutil.copy(os.path.join(src, f'g{j}.png'), os.path.join(out, f'f{i}.png'))
    print(name, 'construit', idx)


def install():
    os.makedirs(DST, exist_ok=True)
    for name, (n, *_rest) in ANIMS.items():
        d = os.path.join(RAW, name)
        if not os.path.isdir(d):
            continue
        # pieds sur la ligne FOOT, même décalage pour toutes les images de la planche (la bête ne « saute » pas d'une image à l'autre)
        fr = [Image.open(os.path.join(d, f'f{i}.png')).convert('RGBA') for i in range(n)]
        sheet_ = Image.new('RGBA', (FRAME * n, FRAME))
        for i, f in enumerate(fr):
            if f.size != (FRAME, FRAME):
                f = f.resize((FRAME, FRAME), Image.NEAREST)
            sheet_.paste(f, (i * FRAME, 0))
        sheet_.save(os.path.join(DST, f'hydra_{name}.png'), optimize=True)
        print('installé', name, n)


if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'rest3':
        rest3([int(s) for s in sys.argv[2:]] or [1, 2, 3])
    elif cmd == 'gen':
        name = sys.argv[2]
        seeds = [int(s) for s in sys.argv[3:]] or [3]
        with ThreadPoolExecutor(4) as ex:
            for m in ex.map(gen, [(name, s) for s in seeds]):
                print(m, flush=True)
    elif cmd == 'genmany':  # genmany anim:seed anim:seed …
        jobs = [(a.split(':')[0], int(a.split(':')[1])) for a in sys.argv[2:]]
        with ThreadPoolExecutor(4) as ex:
            for m in ex.map(gen, jobs):
                print(m, flush=True)
    elif cmd == 'sheet':
        sheet(sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 4)
    elif cmd == 'build':
        build(sys.argv[2], sys.argv[3], [int(x) for x in sys.argv[4].split(',')])
    elif cmd == 'install':
        install()
