"""v10.15.0 : animations PixelLab de l'Arbre-Monde (elder_treant), à partir de sa pose de repos validée.

  python3 -I tools/art/pl1015_treant.py gen <anim>[@graine] …    essais → pixellab1015/elder_treant/<anim>_s<graine>/f0..fN.png
  python3 -I tools/art/pl1015_treant.py sheet <anim>_s<graine>    planche de contrôle agrandie → scratch (chemin imprimé)
  python3 -I tools/art/pl1015_treant.py pick <anim> <graine>      retient un essai → pixellab1015/elder_treant/<anim>/f0..fN.png
  python3 -I tools/art/pl1015_treant.py install                   planches retenues → assets/world-boss/elder_treant/elder_treant_<anim>.png

Seulement du montage et du recadrage/redimensionnement au plus proche voisin (aucun dessin Pillow).
Clé PIXELLAB_API_KEY : jamais affichée.
"""
import os
import shutil
import sys
import time
import urllib.error
from concurrent.futures import ThreadPoolExecutor

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
ROOT = os.path.dirname(os.path.dirname(HERE))
GID = 'elder_treant'
RAW = os.path.join(HERE, 'pixellab1015', GID)
DST = os.path.join(ROOT, 'assets', 'world-boss', GID)
FRAME = 192
N = {'idle': 8, 'idle3': 8, 'attack': 9, 'attack3': 9, 'hurt': 6, 'throw': 13, 'throw3': 13, 'beam': 13, 'beam3': 13,
     'death': 13, 'quake': 9, 'embers': 9, 'transform': 13}
BASE = 'giant living oak tree monster walking, gnarled wooden trunk body with a carved wooden face, long branch arms, root legs, dense leafy canopy on top'
D = {
    'idle': f'{BASE}, slow heavy breathing, trunk chest rising and falling, canopy swaying and rustling, leaves drifting down, arms swinging slightly',
    'idle3': f'{BASE}, enraged, breathing hard, shoulders heaving, glowing orange eyes, canopy trembling, leaves falling',
    'attack': f'{BASE}, rears back raising a huge wooden arm high, then slams it down forward to the left with a crushing blow, body leaning far forward, then slowly recovers',
    'attack3': f'{BASE}, enraged, rears back with both arms raised, then smashes both fists down forward to the left with a violent blow, then recovers',
    'hurt': f'{BASE}, flinches and recoils backwards when hit, leaning back with the face grimacing, leaves bursting off the canopy, then regains balance',
    'throw': f'{BASE}, bends down and tears a huge stump from the ground, lifts it over its head in both hands, winds up leaning far back, then hurls it forward to the left, empty hands, then recovers',
    'throw3': f'{BASE}, enraged, bends down tearing a huge stump from the ground, raises it over its head, then hurls it forward to the left, empty hands, then recovers',
    'beam': f'{BASE}, leans back, head tilting up, wooden face opening, eyes glowing bright green charging energy, then leans forward and glares sweeping the head down to the left, then recovers',
    'beam3': f'{BASE}, enraged, leans back, eyes blazing with energy, then leans forward glaring sweeping the head down to the left, then recovers',
    'death': f'{BASE}, staggers, knees buckle, the whole tree topples forward and crashes heavily to the ground, bounces once, leaves scatter, lying still',
    'quake': f'{BASE}, lifts both arms high above its head then slams both fists into the ground in front, body crouching low, then rises',
    'embers': f'{BASE}, throws its head and arms back to the sky, roaring upward, canopy spreading wide, then lowers',
    'transform': f'{BASE}, crouches and roars as it swells with angry power, branches spreading, eyes igniting, rises taller and fiercer',
}


def adir(name, seed=None):
    return os.path.join(RAW, f'{name}_s{seed}' if seed is not None else name)


def gen_one(arg):
    from pl939_api import b64, call, to_img, wait
    name, _, s = arg.partition('@')
    seed = int(s) if s else 3
    desc = os.environ.get('DESC') or D[name]
    # phase 3 : à partir de la forme de colère (rest3.png, PixelLab) ; transform : du repos vers la colère
    view = Image.open(os.path.join(RAW, 'rest3.png' if name.endswith('3') else 'rest.png')).convert('RGBA')
    last = Image.open(os.path.join(RAW, 'rest3.png')).convert('RGBA') if name == 'transform' else view
    n = N[name]
    body = {'first_frame': b64(view), 'last_frame': b64(last), 'frame_count': int(os.environ.get('FC') or max(4, (n + 2) // 4 * 4)), 'seed': seed, 'no_background': True,
            'description': desc, 'direction': 'east', 'view': 'side'}
    if name in ('death',):
        body.pop('last_frame')
    for essai in range(8):
        try:
            imgs = wait(call('POST', '/animate-pixminimax', body))['images']
            out = adir(name, seed)
            shutil.rmtree(out, ignore_errors=True)
            os.makedirs(out)
            if len(imgs) != n and not os.environ.get('FC'):  # l'API rend 4k+1 images : idle = les n premières (boucle), sinon n images régulièrement choisies
                imgs = imgs[:n] if name.startswith('idle') else [imgs[round(i * (len(imgs) - 1) / (n - 1))] for i in range(n)]
            for i, im in enumerate(imgs):
                to_img(im).resize((FRAME, FRAME), Image.NEAREST).save(os.path.join(out, f'f{i}.png'))
            return f'{arg} ok ({len(imgs)} images)'
        except urllib.error.HTTPError as e:
            if e.code != 429 or essai == 7:
                return f'{arg} ERREUR HTTP {e.code} {e.read()[:200]!r}'
            time.sleep(15 * (essai + 1))
        except Exception as e:  # noqa: BLE001
            return f'{arg} ERREUR {str(e)[:200]}'


def frames(d):
    fs = sorted([f for f in os.listdir(d) if f.startswith('f') and f.endswith('.png')], key=lambda f: int(f[1:-4]))
    return [Image.open(os.path.join(d, f)).convert('RGBA') for f in fs]


def sheet(tag, k=2, per=7):
    fs = frames(os.path.join(RAW, tag))
    rows = (len(fs) + per - 1) // per
    cw, ch = FRAME * k, FRAME * k
    out = Image.new('RGBA', (per * cw, rows * ch), (60, 70, 90, 255))
    for i, f in enumerate(fs):
        out.paste(f.resize((cw, ch), Image.NEAREST), ((i % per) * cw, (i // per) * ch), f.resize((cw, ch), Image.NEAREST))
    p = os.environ.get('SCRATCH', '/tmp') + f'/{tag}.png'
    out.save(p)
    print(p, len(fs))


def pick(name, seed, idx=None):
    """idx : liste d'images brutes à garder (ex. 0,2,4,5,6 ; une image peut se répéter) pour caler l'anticipation, le coup et la retombée."""
    src, dst = adir(name, int(seed)), adir(name)
    shutil.rmtree(dst, ignore_errors=True)
    if idx is None:
        shutil.copytree(src, dst)
    else:
        os.makedirs(dst)
        for k, i in enumerate(int(x) for x in idx.split(',')):
            shutil.copy(os.path.join(src, f'f{i}.png'), os.path.join(dst, f'f{k}.png'))
    print(name, 'retenu', seed)


def install():
    os.makedirs(DST, exist_ok=True)
    for name, n in N.items():
        d = adir(name)
        if not os.path.isdir(d):
            continue
        fs = frames(d)[:n]
        assert len(fs) == n, (name, len(fs))
        sheet_im = Image.new('RGBA', (FRAME * n, FRAME))
        # pieds sur la ligne FRAME-6 : même décalage pour toutes les images (celui de la première, debout), pour que
        # ni un effet (traînée, poussière) ni une posture accroupie ne fassent sauter le géant d'une image à l'autre
        bb0 = fs[0].getchannel('A').point(lambda a: 255 if a >= 128 else 0).getbbox()
        dy = bb0[3] - (FRAME - 6)
        for i, f in enumerate(fs):
            f = f.transform(f.size, Image.AFFINE, (1, 0, 0, 0, 1, dy), Image.NEAREST)
            sheet_im.paste(f, (i * FRAME, 0))
        sheet_im.save(os.path.join(DST, f'{GID}_{name}.png'), optimize=True)
        print(name, n)


if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'gen':
        with ThreadPoolExecutor(4) as ex:
            for m in ex.map(gen_one, sys.argv[2:]):
                print(m, flush=True)
    elif cmd == 'sheet':
        sheet(sys.argv[2])
    elif cmd == 'pick':
        pick(sys.argv[2], sys.argv[3], sys.argv[4] if len(sys.argv) > 4 else None)
    elif cmd == 'install':
        install()
