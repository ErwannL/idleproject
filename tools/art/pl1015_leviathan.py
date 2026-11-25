"""v10.15.0 : animations PixelLab du Léviathan des Abysses (à partir de sa pose de repos validée, pixellab1015/leviathan/rest.png).
Fichier à part pour ne pas entrer en conflit avec pl1015_giants.py (mêmes consignes : docs/prompt-v10.15/PROMPT.md).

  python3 -I tools/art/pl1015_leviathan.py rage [graine]            forme de colère (phase 3) par /edit-image → rest3_<graine>.png
  python3 -I tools/art/pl1015_leviathan.py pick3 <graine>           retient la forme de colère → rest3.png
  python3 -I tools/art/pl1015_leviathan.py anim <anim> [graine…]    essai d'animation (/animate-pixminimax) → <anim>_s<graine>/f0..fN.png
  python3 -I tools/art/pl1015_leviathan.py use <anim> <graine>      retient un essai → <anim>/f0..fN.png
  python3 -I tools/art/pl1015_leviathan.py install                  planches → assets/world-boss/leviathan/leviathan_<anim>.png

L'API ne fait que des multiples de 4 images : on demande le multiple de 4 supérieur et on retient n images réparties
régulièrement (montage seul). Pas de dessin Pillow. Clé : PIXELLAB_API_KEY, jamais affichée.
"""
import os
import shutil
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
ROOT = os.path.dirname(os.path.dirname(HERE))
RAW = os.path.join(HERE, 'pixellab1015', 'leviathan')
DST = os.path.join(ROOT, 'assets', 'world-boss', 'leviathan')
FRAME = 160

SUBJECT = 'a giant dark blue sea serpent with a dragon head, pale belly and fin crest, rising from the water'
NOPROJ = ' Only the serpent and its water base appear: no flame, no fire, no jet, no ball, no beam, no light rays, no text.'
# nom: (images, planche de départ, description du mouvement)
ANIMS = {
    'idle': (8, 'rest', 'the sea serpent sways its long curved neck slowly from side to side and rises and falls as if breathing, the jaws open and close a little, '
                         'the fin crest ripples, the tail tip curls, waves and foam ripple around its base.' + NOPROJ),
    'attack': (9, 'rest', 'the sea serpent rears its head back and up first, then lunges violently forward to the left with a fast biting strike, jaws snapping wide, '
                          'the whole neck stretching out far to the left, then slowly pulls back to its position, water splashing.' + NOPROJ),
    'hurt': (6, 'rest', 'the sea serpent flinches in pain: its head rears back and up, the whole body shifts back to the right and shudders, eyes squeezed shut, the head stays fully visible, then it returns.' + NOPROJ),
    'throw': (13, 'rest', 'the sea serpent coils back and lowers, rears its head far back with its jaws gaping, holds a tense pause, then thrusts its head forward to the left '
                          'spitting out something heavy from its mouth, neck stretched far forward, then pulls back to rest.' + NOPROJ),
    'beam': (13, 'rest', 'the sea serpent lifts its head high and opens its jaws very wide, the whole body trembling while it charges, then it roars and sweeps its head '
                         'down and forward to the left holding its jaws wide open and roaring loudly, trembling, then lifts back up and returns to rest.' + NOPROJ),
    'death': (13, None, 'the sea serpent screams, convulses, then its neck and body collapse heavily down into the water, the head slams down with a huge splash, '
                        'bounces once, then sinks and lies limp and still half under the water, waves rippling.' + NOPROJ),
    'quake': (9, 'rest', 'the sea serpent rears up high, then slams its whole body and head down hard onto the water, a huge splash and shock ripple, then settles.' + NOPROJ),
    'embers': (9, 'rest', 'the sea serpent raises its head straight up toward the sky, neck stretched tall, jaws wide open roaring at the sky, holds the pose, then lowers.' + NOPROJ),
    'transform': (13, 'rest', 'the sea serpent roars and thrashes violently, shaking, its whole body swelling and rising higher out of the water, fins flaring wide, '
                              'the scales and eyes and water turn glowing red with rage.' + NOPROJ),
    'idle3': (8, 'rest3', 'the furious sea serpent sways its neck sharply and restlessly, rising and falling fast like heavy breathing, jaws snarling open and shut, '
                          'fins flaring, tail whipping, waves churning around its base.' + NOPROJ),
    'attack3': (9, 'rest3', 'the furious sea serpent rears its head far back, then lunges savagely forward to the left in a very fast biting strike, jaws wide, '
                            'neck fully stretched out, then pulls back, water exploding.' + NOPROJ),
    'hurt3': (6, 'rest3', 'the furious sea serpent flinches in pain: its head rears back, the whole body shifts back to the right and shudders, the head stays fully visible, then it snarls and returns.' + NOPROJ),
    'throw3': (13, 'rest3', 'the furious sea serpent coils back, rears its head far back with its jaws gaping, holds a tense pause, then thrusts its head forward to the left '
                            'spitting out something heavy, neck stretched far forward, then pulls back.' + NOPROJ),
    'beam3': (13, 'rest3', 'the furious sea serpent lifts its head high and opens its jaws very wide, the whole body trembling, then roars and sweeps its head down and forward '
                           'to the left holding its jaws wide open and roaring loudly, trembling, then lifts back up.' + NOPROJ),
}
RAGE_EDIT = ('same sea serpent in a furious rage: glowing crimson red eyes, red glowing veins and cracks on the dark scales, fin crest tinted blood red and orange, '
             'darker scales, angrier snarl, red tinted water around it')


def _post(path, body):
    """POST + attente ; 429 (trop de tâches en même temps, la clé est partagée) : on patiente et on recommence."""
    import time
    import urllib.error
    from pl939_api import call, wait
    for essai in range(40):
        try:
            return wait(call('POST', path, body))
        except urllib.error.HTTPError as e:
            if e.code != 429:
                raise
            time.sleep(10 + 5 * min(essai, 6))
    raise RuntimeError('429 persistant')


def _sample(imgs, n, loop):
    """n images réparties régulièrement parmi celles renvoyées (boucle : la dernière, trop proche de la première, est écartée)."""
    m = len(imgs)
    if loop:
        idx = [int(i * m / n) for i in range(n)]
    else:
        idx = [round(i * (m - 1) / (n - 1)) for i in range(n)]
    return [imgs[i] for i in idx]


def _view(name):
    if name is None:
        return Image.open(os.path.join(RAW, 'rest.png')).convert('RGBA')
    return Image.open(os.path.join(RAW, name + '.png')).convert('RGBA')


def rage(seed=7):
    from pl939_api import b64, call, to_img, wait
    view = _view('rest')
    job = call('POST', '/edit-image', {'image': b64(view), 'image_size': {'width': FRAME, 'height': FRAME}, 'width': FRAME, 'height': FRAME,
                                      'description': RAGE_EDIT, 'seed': seed, 'no_background': True, 'text_guidance_scale': 8})
    r = wait(job)
    ims = r.get('images') or [r['image']]
    to_img(ims[0]).save(os.path.join(RAW, f'rest3_{seed}.png'))
    print('rest3', seed)


def anim(name, seed=3):
    from pl939_api import b64, call, to_img, wait
    n, start, desc = ANIMS[name]
    view = _view('rest3' if start == 'rest3' else 'rest')
    req = int(-(-n // 4) * 4) if n > 8 else 8
    if n >= 12:
        req = 16
    body = {'first_frame': b64(view), 'frame_count': req, 'seed': seed, 'no_background': True, 'description': desc,
            'direction': 'west', 'view': 'side', 'subject_description': SUBJECT}
    if name == 'transform':  # de la forme de repos à la forme de colère
        body['last_frame'] = b64(_view('rest3'))
    elif start is not None and name != 'death':
        body['last_frame'] = b64(view)
    imgs = _post('/animate-pixminimax', body)['images']
    ims = [to_img(i) for i in imgs]
    out = os.path.join(RAW, f'{name}_s{seed}')
    shutil.rmtree(out, ignore_errors=True)
    os.makedirs(out)
    os.makedirs(os.path.join(out, 'raw'))
    for i, im in enumerate(ims):  # toutes les images reçues, pour `use … i,j,k` (choix des images)
        im.resize((FRAME, FRAME), Image.NEAREST).save(os.path.join(out, 'raw', f'r{i}.png')) if im.size != (FRAME, FRAME) else im.save(os.path.join(out, 'raw', f'r{i}.png'))
    for i, im in enumerate(_sample(ims, n, name.startswith('idle'))):
        if im.size != (FRAME, FRAME):
            im = im.resize((FRAME, FRAME), Image.NEAREST)
        im.save(os.path.join(out, f'f{i}.png'))
    return f'{name} s{seed} : {len(ims)} images reçues, {n} retenues'


def use(name, seed, idx=None):
    """Retient un essai ; `idx` (ex. 0,2,3,4,6,7,9,11,12) = quelles images reçues garder (n au total), sinon la répartition régulière."""
    out = os.path.join(RAW, name)
    src = os.path.join(RAW, f'{name}_s{seed}')
    shutil.rmtree(out, ignore_errors=True)
    os.makedirs(out)
    n = ANIMS[name][0]
    if idx:
        assert len(idx) == n, f'{n} indices attendus'
        for i, j in enumerate(idx):
            shutil.copy(os.path.join(src, 'raw', f'r{j}.png'), os.path.join(out, f'f{i}.png'))
    else:
        for i in range(n):
            shutil.copy(os.path.join(src, f'f{i}.png'), os.path.join(out, f'f{i}.png'))
    print(name, 'retenu', seed, idx or '')


def install():
    os.makedirs(DST, exist_ok=True)
    for name, (n, _, _) in ANIMS.items():
        d = os.path.join(RAW, name)
        if not os.path.isdir(d):
            continue
        frames, bottoms = [], []
        for i in range(n):
            f = Image.open(os.path.join(d, f'f{i}.png')).convert('RGBA')
            bb = f.getchannel('A').point(lambda a: 255 if a >= 128 else 0).getbbox()
            frames.append(f)
            bottoms.append(bb[3] if bb else FRAME - 6)
        # un seul décalage vertical par planche (médiane) : le mouvement relatif des images est conservé, la ligne d'eau sur frame-6
        dy = sorted(bottoms)[len(bottoms) // 2] - (FRAME - 6)
        sheet = Image.new('RGBA', (FRAME * n, FRAME))
        for i, f in enumerate(frames):
            if dy:
                f = f.transform(f.size, Image.AFFINE, (1, 0, 0, 0, 1, dy), Image.NEAREST)
            sheet.paste(f, (i * FRAME, 0))
        sheet.save(os.path.join(DST, f'leviathan_{name}.png'), optimize=True)
        print(name, n, 'dy', dy)


if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'rage':
        rage(int(sys.argv[2]) if len(sys.argv) > 2 else 7)
    elif cmd == 'pick3':
        shutil.copy(os.path.join(RAW, f'rest3_{sys.argv[2]}.png'), os.path.join(RAW, 'rest3.png'))
    elif cmd == 'anim':
        from concurrent.futures import ThreadPoolExecutor
        seeds = [int(s) for s in sys.argv[3:]] or [3]
        with ThreadPoolExecutor(2) as ex:
            for m in ex.map(lambda s: anim(sys.argv[2], s), seeds):
                print(m, flush=True)
    elif cmd == 'use':
        use(sys.argv[2], int(sys.argv[3]), [int(i) for i in sys.argv[4].split(',')] if len(sys.argv) > 4 else None)
    elif cmd == 'install':
        install()
