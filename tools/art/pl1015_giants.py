"""v10.15.0 : les 8 Géants (PixelLab). Liste et consignes : docs/prompt-v10.15/PROMPT.md.

  python3 -I tools/art/pl1015_giants.py balance                 crédits restants
  python3 -I tools/art/pl1015_giants.py gen [id[@graine]…]      pose de repos (essais) → tools/art/pixellab1015/<id>/rest_<graine>.png
  python3 -I tools/art/pl1015_giants.py pick <id> <graine>      retient un essai → tools/art/pixellab1015/<id>/rest.png
  python3 -I tools/art/pl1015_giants.py preview                 les 8 poses de repos + le Colosse → tools/art/preview_giants.png
  python3 -I tools/art/pl1015_giants.py anim <id> <anim> [graine]   (étape 2) animation par /animate-pixminimax → pixellab1015/<id>/<anim>/f0..fN.png
  python3 -I tools/art/pl1015_giants.py install [id…]           (étape 2) planches → assets/world-boss/<id>/<id>_<anim>.png

Planche installée : UNE rangée de n images carrées de `frame` px, pieds sur la ligne frame-6, regard à gauche.
Pas de dessin Pillow : seulement du montage et du redimensionnement au plus proche voisin.
Clé : PIXELLAB_API_KEY, jamais affichée ni écrite.
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
RAW = os.path.join(HERE, 'pixellab1015')
DST = os.path.join(ROOT, 'assets', 'world-boss')

STYLE = ('16-bit fantasy pixel art boss, huge monster, side view facing LEFT, full body visible, feet (or base) on the bottom edge, '
         'transparent background, clean 1px dark outline, soft light from top-left, readable silhouette, no text')

# id: (taille du cadre, description)
GIANTS = {
    'leviathan': (160, 'giant sea serpent rising out of the water, sea dragon head with a toothed maw, fin crest along the neck, '
                       'midnight blue scales and a pale belly, coiled body, foam and waves at its base, menacing'),
    'dragon_mother': (192, 'immense red and gold dragoness in strict side profile, whole body and head turned to the LEFT, wings half open, a crown of curved horns, walking on four legs, long tail behind on the right, fire glowing in her open jaws, massive and regal'),
    'storm_god': (160, 'giant humanoid god in bronze armor in strict side profile walking to the LEFT, long beard of storm clouds, gripping a huge two-handed war hammer on his shoulder, lightning bolts crackling around his arms, towering and muscular'),
    'hydra': (160, 'massive crocodile-bodied swamp monster in side profile facing LEFT, five large serpent heads with open fanged mouths and glowing red eyes on five long thick curving necks rising and fanning out from its back, moss and mud on the scales, dripping slime, hydra'),
    'sand_wyrm': (160, 'colossal sandworm rising upright out of a sand dune, round mouth with three jaws and a circle of teeth, '
                       'segmented ochre carapace, sand pouring down'),
    'frost_giant': (160, 'bearded ice giant in side profile facing LEFT, pale blue skin, armor of ice and white fur, holding a huge jagged ice club in both hands, icicles hanging from his shoulders, frost giant jarl, hulking'),
    'elder_treant': (192, 'a giant living oak tree walking, the whole body is a huge gnarled wooden trunk covered in bark and moss, a stern wooden face carved in the trunk with glowing green eyes, two long branch arms with twig fingers, a dense leafy canopy and several small trees growing on top, thick root legs, not an ape, not humanoid muscles'),
    'void_maw': (160, 'floating dark shadow monster with no legs, a huge round body with one immense gaping toothed maw in the center, dozens of glowing purple eyes all over it, many long writhing tentacles hanging below, cosmic horror, facing LEFT'),
}
ORDER = list(GIANTS)
SEEDS = {k: 1015 + i * 7 for i, k in enumerate(ORDER)}


def parse(arg):
    name, _, seed = arg.partition('@')
    return name, int(seed) if seed else SEEDS[name]


def gen_one(arg):
    from pl939_api import call, images_of, wait
    gid, seed = parse(arg)
    frame, desc = GIANTS[gid]
    body = {'description': f'{STYLE}, {desc}', 'image_size': {'width': frame, 'height': frame}, 'no_background': True, 'seed': seed,
            'outline': 'single color black outline', 'shading': 'detailed shading', 'detail': 'highly detailed'}
    for essai in range(8):
        try:
            im = images_of(wait(call('POST', '/create-image-pixflux', body)))[0]
            os.makedirs(os.path.join(RAW, gid), exist_ok=True)
            im.save(os.path.join(RAW, gid, f'rest_{seed}.png'))
            return f'{gid}@{seed} ok'
        except urllib.error.HTTPError as e:
            if e.code != 429 or essai == 7:
                return f'{gid}@{seed} ERREUR HTTP {e.code} {e.read()[:200]!r}'
            time.sleep(15 * (essai + 1))
        except Exception as e:  # noqa: BLE001
            return f'{gid}@{seed} ERREUR {str(e)[:200]}'


def pick(gid, seed):
    shutil.copy(os.path.join(RAW, gid, f'rest_{seed}.png'), os.path.join(RAW, gid, 'rest.png'))
    print(gid, 'retenu', seed)


def preview():
    ims = [('colossus', Image.open(os.path.join(DST, 'colossus_idle.png')).convert('RGBA').crop((0, 0, 128, 128)))]
    for gid in ORDER:
        p = os.path.join(RAW, gid, 'rest.png')
        if os.path.exists(p):
            ims.append((gid, Image.open(p).convert('RGBA')))
    # même échelle (1 pixel de planche = 1 pixel), pieds alignés sur le bas du cadre ; ×2 pour la lisibilité
    k = 2
    cw = max(i.width for _, i in ims) * k + 8
    ch = max(i.height for _, i in ims) * k + 8
    cols = 3
    rows = (len(ims) + cols - 1) // cols
    sheet = Image.new('RGBA', (cols * cw, rows * ch), (44, 38, 58, 255))
    for n, (_, im) in enumerate(ims):
        im = im.resize((im.width * k, im.height * k), Image.NEAREST)
        x = (n % cols) * cw + (cw - im.width) // 2
        y = (n // cols) * ch + ch - im.height - 4
        sheet.paste(im, (x, y), im)
    sheet.save(os.path.join(HERE, 'preview_giants.png'))
    print(f'{len(ims)} images sur la planche')


# --- Étape 2 (animations) : même méthode que pl939_anims.py ; descriptions à écrire à l'étape 2 ---
ANIMS = {  # nom: (images, description générique)
    'idle': (8, 'slow breathing idle, subtle sway'), 'attack': (9, 'heavy attack strike forward to the left'),
    'hurt': (6, 'recoiling backwards when hit'), 'throw': (13, 'winding up, hurling a projectile to the left, then recovering'),
    'beam': (13, 'opening mouth wide and charging then sustained breath attack to the left, then recovering'),
    'death': (13, 'collapsing heavily to the ground, bouncing, dust'),
}


def anim(gid, name, seed=3):
    from pl939_api import b64, call, to_img, wait
    frame, desc = GIANTS[gid]
    n, d = ANIMS[name]
    view = Image.open(os.path.join(RAW, gid, 'rest.png')).convert('RGBA')
    job = call('POST', '/animate-pixminimax', {'first_frame': b64(view), 'last_frame': b64(view), 'frame_count': n, 'seed': seed,
                                              'no_background': True, 'description': f'{desc}, {d}', 'direction': 'east', 'view': 'side'})
    imgs = wait(job)['images']
    out = os.path.join(RAW, gid, name)
    shutil.rmtree(out, ignore_errors=True)
    os.makedirs(out)
    for i, im in enumerate(imgs[:n]):
        to_img(im).resize(view.size, Image.NEAREST).save(os.path.join(out, f'f{i}.png'))
    return len(imgs)


def install(ids):
    for gid in ids or ORDER:
        frame = GIANTS[gid][0]
        for name, (n, _) in ANIMS.items():
            d = os.path.join(RAW, gid, name)
            if not os.path.isdir(d):
                continue
            sheet = Image.new('RGBA', (frame * n, frame))
            for i in range(n):
                f = Image.open(os.path.join(d, f'f{i}.png')).convert('RGBA')
                if f.size != (frame, frame):
                    f = f.resize((frame, frame), Image.NEAREST)
                # pieds sur la ligne frame-6
                bb = f.getchannel('A').point(lambda a: 255 if a >= 128 else 0).getbbox()
                if bb:
                    f = f.transform(f.size, Image.AFFINE, (1, 0, 0, 0, 1, bb[3] - (frame - 6)), Image.NEAREST)
                sheet.paste(f, (i * frame, 0))
            out = os.path.join(DST, gid)
            os.makedirs(out, exist_ok=True)
            sheet.save(os.path.join(out, f'{gid}_{name}.png'), optimize=True)
            print(gid, name, n)


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'preview'
    if cmd == 'balance':
        from pl939_api import call
        print(call('GET', '/balance'))
    elif cmd == 'gen':
        names = sys.argv[2:] or ORDER
        with ThreadPoolExecutor(4) as ex:
            for m in ex.map(gen_one, names):
                print(m, flush=True)
    elif cmd == 'pick':
        pick(sys.argv[2], sys.argv[3])
    elif cmd == 'preview':
        preview()
    elif cmd == 'anim':
        print(anim(sys.argv[2], sys.argv[3], int(sys.argv[4]) if len(sys.argv) > 4 else 3))
    elif cmd == 'install':
        install(sys.argv[2:])
