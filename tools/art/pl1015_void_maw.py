"""v10.15.0 : animations du Dévoreur du Néant (PixelLab /animate-pixminimax) à partir de sa pose de repos validée.

  python3 -I tools/art/pl1015_void_maw.py gen <anim> [graine [first|nolast]]   essai brut → pixellab1015/void_maw/try/<anim>_<graine>/g*.png
  python3 -I tools/art/pl1015_void_maw.py sheet <anim> <graine> [indices,…]   choisit n images parmi les brutes → pixellab1015/void_maw/<anim>/f*.png
  python3 -I tools/art/pl1015_void_maw.py contact <anim>                       planche de contrôle agrandie → pixellab1015/void_maw/<anim>_contact.png
  python3 -I tools/art/pl1015_void_maw.py install                              planches finales → assets/world-boss/void_maw/void_maw_<anim>.png

L'API n'accepte que des nombres d'images multiples de 4 : on demande le multiple au-dessus et on retient n images
(sélection d'images, aucun dessin). Seulement montage / recadrage / plus proche voisin. Clé PIXELLAB_API_KEY jamais affichée.
"""
import os
import shutil
import sys
import time
import urllib.error

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
ROOT = os.path.dirname(os.path.dirname(HERE))
RAW = os.path.join(HERE, 'pixellab1015', 'void_maw')
DST = os.path.join(ROOT, 'assets', 'world-boss', 'void_maw')
FRAME = 160
N = {'idle': 8, 'idle3': 8, 'attack': 9, 'attack3': 9, 'hurt': 6, 'throw': 13, 'throw3': 13, 'beam': 13, 'beam3': 13,
     'death': 13, 'quake': 9, 'embers': 9, 'transform': 13}
BASE = 'dark floating cosmic horror boss with one huge toothed maw and many glowing purple eyes and long tentacles, facing left, '
D = {
    'idle': 'slow breathing, the body swelling and shrinking, tentacles undulating, purple eyes blinking one by one, small floating star specks',
    'idle3': 'angry breathing, body pulsing, tentacles thrashing, all eyes glowing bright magenta, restless',
    'attack': 'rears back then lunges forward to the left biting with its huge maw and lashing tentacles, then settles',
    'attack3': 'rears back then lunges violently forward to the left biting with glowing magenta maw and lashing tentacles, then settles',
    'hurt': 'flinches and recoils back to the right in pain, eyes squeezing shut, tentacles flailing, then returns',
    'throw': 'gathers dark energy in its maw, winds up and recoils, spits a dark orb to the left, then returns to rest',
    'throw3': 'gathers glowing magenta energy in its maw, winds up and recoils, spits an orb to the left, then returns to rest',
    'beam': 'opens its maw wide, all eyes charge and glow brighter, then all eyes flare in a sustained gaze attack aimed down to the left, then returns to rest',
    'beam3': 'opens its maw wide, all eyes charge and glow bright magenta, then all eyes flare in a sustained gaze attack aimed down to the left, then returns to rest',
    'death': 'collapses heavily to the ground, body sagging and sinking, tentacles going limp, eyes going dark one by one, bouncing once with dust',
    'quake': 'rises up high then slams its tentacles down onto the ground in front to the left, shaking, then recovers',
    'embers': 'tilts its maw up toward the sky and roars, eyes glowing, tentacles raised, then lowers',
    'transform': 'shudders and swells, body darkening, eyes igniting magenta one by one, tentacles growing and writhing, bursting with energy',
}


def req(n):
    return ((n + 3) // 4) * 4 if n > 4 else 4


def gen(name, seed=3, mode='both', ref='rest.png'):
    from pl939_api import b64, call, to_img, wait
    view = Image.open(os.path.join(RAW, ref)).convert('RGBA')
    n = N[name]
    body = {'first_frame': b64(view), 'frame_count': req(n) if n != 13 else 16, 'seed': seed, 'no_background': True,
            'description': BASE + D[name], 'direction': 'east', 'view': 'side'}
    if mode == 'both':
        body['last_frame'] = b64(view)
    for essai in range(6):
        try:
            imgs = wait(call('POST', '/animate-pixminimax', body))['images']
            break
        except urllib.error.HTTPError as e:
            msg = e.read()[:300]
            if e.code != 429 or essai == 5:
                raise SystemExit(f'HTTP {e.code} {msg!r}')
            time.sleep(15 * (essai + 1))
    out = os.path.join(RAW, 'try', f'{name}_{seed}{"" if mode == "both" else "_" + mode}{"_rage" if ref == "rage.png" else ""}')
    shutil.rmtree(out, ignore_errors=True)
    os.makedirs(out)
    for i, im in enumerate(imgs):
        to_img(im).resize(view.size, Image.NEAREST).save(os.path.join(out, f'g{i}.png'))
    print(name, seed, mode, len(imgs), 'images ->', out)


def pick(name, trydir, idx):
    src = os.path.join(RAW, 'try', trydir)
    n = N[name]
    ids = [int(x) for x in idx.split(',')] if idx else None
    avail = len([f for f in os.listdir(src) if f.startswith('g')])
    if not ids:
        ids = [round(i * (avail - 1) / (n - 1)) for i in range(n)]
    assert len(ids) == n, f'{name}: {n} indices attendus, {len(ids)} reçus'
    out = os.path.join(RAW, name)
    shutil.rmtree(out, ignore_errors=True)
    os.makedirs(out)
    for i, g in enumerate(ids):
        shutil.copy(os.path.join(src, f'g{g}.png'), os.path.join(out, f'f{i}.png'))
    print(name, 'indices', ids)


def contact(src_dir, out, k=2, cols=7, pre=None):
    fs = sorted([f for f in os.listdir(src_dir) if f.endswith('.png') and (pre is None or f.startswith(pre))],
                key=lambda s: int(''.join(c for c in s if c.isdigit())))
    ims = [Image.open(os.path.join(src_dir, f)).convert('RGBA') for f in fs]
    rows = (len(ims) + cols - 1) // cols
    cw = FRAME * k // 1
    sheet = Image.new('RGBA', (cols * cw, rows * cw), (60, 70, 90, 255))
    for n, im in enumerate(ims):
        im = im.resize((im.width * k, im.height * k), Image.NEAREST)
        sheet.paste(im, ((n % cols) * cw, (n // cols) * cw), im)
    sheet.save(out)
    print(out, len(ims))


def install():
    os.makedirs(DST, exist_ok=True)
    for name, n in N.items():
        d = os.path.join(RAW, name)
        if not os.path.isdir(d):
            continue
        frames = []
        for i in range(n):
            f = Image.open(os.path.join(d, f'f{i}.png')).convert('RGBA')
            if f.size != (FRAME, FRAME):
                f = f.resize((FRAME, FRAME), Image.NEAREST)
            frames.append(f)
        sheet = Image.new('RGBA', (FRAME * n, FRAME))
        # pieds : ligne FRAME-6. Même décalage pour toute la planche (celui de la pose de repos), sauf `death`
        # où le corps posé au sol est recalé image par image.
        rest = Image.open(os.path.join(RAW, 'rest.png')).convert('RGBA')
        dy = (FRAME - 6) - rest.getchannel('A').point(lambda a: 255 if a >= 128 else 0).getbbox()[3]
        for i, f in enumerate(frames):
            d = dy
            if name == 'death':
                bb = f.getchannel('A').point(lambda a: 255 if a >= 128 else 0).getbbox()
                d = (FRAME - 6) - bb[3] if i >= 4 else dy
            g = Image.new('RGBA', f.size)
            g.paste(f, (0, d))
            sheet.paste(g, (i * FRAME, 0))
        sheet.save(os.path.join(DST, f'void_maw_{name}.png'), optimize=True)
        print('void_maw', name, n)


if __name__ == '__main__':
    c = sys.argv[1]
    if c == 'gen':
        gen(sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 3, sys.argv[4] if len(sys.argv) > 4 else 'both', sys.argv[5] if len(sys.argv) > 5 else 'rest.png')
    elif c == 'sheet':
        pick(sys.argv[2], sys.argv[3], sys.argv[4] if len(sys.argv) > 4 else '')
    elif c == 'contact':
        a = sys.argv[2]
        src = os.path.join(RAW, 'try', a) if os.path.isdir(os.path.join(RAW, 'try', a)) else os.path.join(RAW, a)
        contact(src, os.path.join(RAW, 'try' if 'try' in src else '', a.replace('/', '_') + '_contact.png'), pre='g' if 'try' in src else 'f')
    elif c == 'install':
        install()
