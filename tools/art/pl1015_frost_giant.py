"""v10.15.0 : animations PixelLab du Jarl du Givre (frost_giant), à partir de sa pose de repos validée.
Même API que pl939_anims.py (/animate-pixminimax). Clé PIXELLAB_API_KEY, jamais affichée.

  python3 -I tools/art/pl1015_frost_giant.py gen <anim> [graine] [variante]   essai brut → pixellab1015/frost_giant/raw/<anim>_<graine>/f0..fK.png
  python3 -I tools/art/pl1015_frost_giant.py pick <anim> <graine> [i,j,k…]    retient un essai (indices facultatifs) → pixellab1015/frost_giant/<anim>/f0..fN-1.png
  python3 -I tools/art/pl1015_frost_giant.py install                          planches → assets/world-boss/frost_giant/frost_giant_<anim>.png
  python3 -I tools/art/pl1015_frost_giant.py sheet <anim> [dossier]           planche de contrôle ×3 (lecture image par image)

Pas de dessin Pillow : seulement choix d'images, montage et redimensionnement au plus proche voisin.
"""
import os
import shutil
import sys
import urllib.error
import time

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
ROOT = os.path.dirname(os.path.dirname(HERE))
GID = 'frost_giant'
FRAME = 160
RAW = os.path.join(HERE, 'pixellab1015', GID)
DST = os.path.join(ROOT, 'assets', 'world-boss', GID)

N = {'idle': 8, 'attack': 9, 'hurt': 6, 'throw': 13, 'beam': 13, 'death': 13, 'idle3': 8, 'attack3': 9, 'throw3': 13, 'beam3': 13,
     'quake': 9, 'embers': 9}
# Mouvement seulement (pas d'apparence) ; pas de projectile ni de souffle dessinés : le jeu les dessine.
D = {
    'idle': 'heavy slow breathing, chest and shoulders rising and falling, the club tip swaying, fur and beard stirring, a slight sway of the whole body',
    'attack': 'crouches and winds up leaning back with the huge ice club raised high behind his head, then smashes the club down hard to the left with his whole body, holds the impact, then slowly straightens',
    'hurt': 'flinches and is knocked back to the right, head thrown back and eyes shut, then straightens and regains his stance',
    'throw': 'leans far back winding up both arms behind him, heaves forward hurling something far to the left with a huge overhead two-handed throw, arms fully extended, then recovers his stance',
    'beam': 'throws his head back inhaling deeply with his chest swelling, then leans forward opening his mouth wide and bellowing out a long freezing breath to the left while his head sweeps downward, then closes his mouth and recovers',
    'death': 'staggers, drops the club, sinks to his knees, then topples forward and crashes heavily face down onto the ground, bounces slightly and lies still',
    'idle3': 'furious heavy breathing, shoulders heaving, snarling, shaking with rage, the club tip trembling',
    'attack3': 'roars and winds up leaning far back with the huge ice club raised high, then smashes it down viciously to the left with his whole body, holds the impact, then straightens',
    'throw3': 'leans far back winding up both arms behind him, heaves forward hurling something far to the left with a furious overhead two-handed throw, arms fully extended, then recovers',
    'beam3': 'throws his head back inhaling deeply, then leans forward roaring and blasting a long freezing breath to the left while his head sweeps downward, then closes his mouth and recovers',
    'quake': 'raises the huge ice club high above his head with both hands, then slams it straight down into the ground in front of him with enormous force, holds, then pulls it back up',
    'embers': 'raises his head and both arms to the sky, chest swelling, roaring upward, then slowly lowers them',
    'transform': 'crouches shaking, clenches his fists, then rises and roars to the sky with his arms thrown wide, swelling with fury',
}
REST = {a: 'rest.png' for a in N}
REST.update({a: 'rest_fury.png' for a in ('idle3', 'attack3', 'throw3', 'beam3', 'quake', 'embers')})
SKIN = {}  # anim -> (indices) choisis au pick


def gen(anim, seed=3, variant=None):
    from pl939_api import b64, call, to_img, wait
    view = Image.open(os.path.join(RAW, REST[anim])).convert('RGBA')
    n = N[anim]
    fc = 4 * ((n - 1 + 3) // 4)  # multiple de 4 ; on reçoit fc+1 images
    fc = max(fc, 8)
    desc = D[anim] if not variant else variant
    body = {'first_frame': b64(view), 'last_frame': b64(view), 'frame_count': fc, 'seed': seed, 'no_background': True,
            'description': desc, 'direction': 'west', 'view': 'side'}
    if anim in ('death',):
        body.pop('last_frame')
    for essai in range(6):
        try:
            imgs = wait(call('POST', '/animate-pixminimax', body))['images']
            break
        except urllib.error.HTTPError as e:
            if e.code != 429 or essai == 5:
                raise
            time.sleep(15 * (essai + 1))
    out = os.path.join(RAW, 'raw', f'{anim}_{seed}')
    shutil.rmtree(out, ignore_errors=True)
    os.makedirs(out)
    for i, im in enumerate(imgs):
        to_img(im).resize(view.size, Image.NEAREST).save(os.path.join(out, f'f{i}.png'))
    return len(imgs)


FURY = ('the same bearded ice giant now in a berserk rage, deep dark blue frozen skin cracked with glowing orange-red magma veins and runes, '
        'blazing white-orange glowing eyes, snarling with bared teeth, ice armor tinted with glowing embers, icy flames of frost smoke rising off his shoulders')


def fury(seed, desc=None):
    """Forme de colère (phase 3) : PixelLab /edit-image sur la pose de repos validée → rest_fury_<graine>.png"""
    from pl939_api import b64, call, images_of, wait
    view = Image.open(os.path.join(RAW, 'rest.png')).convert('RGBA')
    body = {'image': b64(view), 'image_size': {'width': FRAME, 'height': FRAME}, 'width': FRAME, 'height': FRAME,
            'description': desc or FURY, 'seed': seed, 'no_background': True, 'text_guidance_scale': 8.0}
    im = images_of(wait(call('POST', '/edit-image', body)))[0]
    im.save(os.path.join(RAW, f'rest_fury_{seed}.png'))
    return im.size


def pick(anim, seed, idx=None):
    src = os.path.join(RAW, 'raw', f'{anim}_{seed}')
    k = len([f for f in os.listdir(src) if f.endswith('.png')])
    n = N[anim]
    idx = idx or list(range(n))
    assert len(idx) == n, (len(idx), n)
    out = os.path.join(RAW, anim)
    shutil.rmtree(out, ignore_errors=True)
    os.makedirs(out)
    for j, i in enumerate(idx):
        shutil.copy(os.path.join(src, f'f{i}.png'), os.path.join(out, f'f{j}.png'))
    print(anim, 'retenu', seed, idx, 'sur', k)


def bbox(f):
    return f.getchannel('A').point(lambda a: 255 if a >= 128 else 0).getbbox()


def install():
    os.makedirs(DST, exist_ok=True)
    for anim, n in N.items():
        d = os.path.join(RAW, anim)
        if not os.path.isdir(d):
            continue
        sheet = Image.new('RGBA', (FRAME * n, FRAME))
        # pieds sur la ligne FRAME-6 : une seule translation verticale par planche (celle de l'image 0, pose de repos),
        # pour que les effets sous les pieds (éclats, poussière) ne soulèvent pas le géant
        f0 = Image.open(os.path.join(d, 'f0.png')).convert('RGBA')
        dy = bbox(f0)[3] - (FRAME - 6)
        for i in range(n):
            f = Image.open(os.path.join(d, f'f{i}.png')).convert('RGBA')
            f = f.transform(f.size, Image.AFFINE, (1, 0, 0, 0, 1, dy), Image.NEAREST)
            sheet.paste(f, (i * FRAME, 0))
        sheet.save(os.path.join(DST, f'{GID}_{anim}.png'), optimize=True)
        print(anim, n)


def contact(frames, out, k=3, cols=7, bg=(60, 70, 96, 255)):
    cw = FRAME * k
    rows = (len(frames) + cols - 1) // cols
    sh = Image.new('RGBA', (cols * cw, rows * cw), bg)
    for i, f in enumerate(frames):
        f = f.resize((cw, cw), Image.NEAREST)
        sh.paste(f, ((i % cols) * cw, (i // cols) * cw), f)
    sh.save(out)


if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'gen':
        print(gen(sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 3, sys.argv[4] if len(sys.argv) > 4 else None))
    elif cmd == 'fury':
        print(fury(int(sys.argv[2]), sys.argv[3] if len(sys.argv) > 3 else None))
    elif cmd == 'pick':
        pick(sys.argv[2], sys.argv[3], [int(x) for x in sys.argv[4].split(',')] if len(sys.argv) > 4 else None)
    elif cmd == 'install':
        install()
