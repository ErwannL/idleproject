"""v10.15.0 : les 8 Géants (PixelLab). Liste et consignes : docs/prompt-v10.15/PROMPT.md.

  python3 -I tools/art/pl1015_giants.py balance                 crédits restants
  python3 -I tools/art/pl1015_giants.py gen [id[@graine]…]      pose de repos (essais) → tools/art/pixellab1015/<id>/rest_<graine>.png
  python3 -I tools/art/pl1015_giants.py pick <id> <graine>      retient un essai → tools/art/pixellab1015/<id>/rest.png
  python3 -I tools/art/pl1015_giants.py preview                 les 8 poses de repos + le Colosse → tools/art/preview_giants.png
  python3 -I tools/art/pl1015_giants.py anim <id> <anim> [graine...]  (etape 2) /animate-pixminimax -> pixellab1015/<id>/_raw/<anim>_s<graine>/
  python3 -I tools/art/pl1015_giants.py take <id> <anim> <graine>   retient n images -> pixellab1015/<id>/<anim>/f0..fN.png
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


# --- Étape 2 (animations) : /animate-pixminimax depuis la pose de repos validée (rest.png) ou la pose de colère (rest3.png) ---
# L'API veut un nombre d'images multiple de 4 et rend n+1 images (la dernière = la première) : on demande `ask` images et on
# retient les `n` images voulues en les choisissant à intervalles réguliers (aucun dessin, que de la sélection).
ANIMS = {  # nom: (images de la planche, demandées à l'API, base 'rest'|'rest3', dernière image 'same'|'rest3'|'none')
    'idle': (8, 8, 'rest', 'same'), 'attack': (9, 12, 'rest', 'same'), 'hurt': (6, 8, 'rest', 'same'),
    'throw': (13, 16, 'rest', 'same'), 'beam': (13, 16, 'rest', 'same'), 'death': (13, 16, 'rest', 'none'),
    'idle3': (8, 8, 'rest3', 'same'), 'attack3': (9, 12, 'rest3', 'same'), 'throw3': (13, 16, 'rest3', 'same'),
    'beam3': (13, 16, 'rest3', 'same'), 'quake': (9, 12, 'rest', 'same'), 'embers': (9, 12, 'rest', 'same'),
    'transform': (13, 16, 'rest', 'rest3'),
}
# Descriptions propres à chaque géant (anglais, comme les autres scripts PixelLab).
DESC = {'dragon_mother': {
    'idle': 'giant red and gold dragoness breathing slowly, chest heaving, wings slowly flapping up and down, tail swaying, smoke from nostrils',
    'attack': 'dragoness rears her head and wings back, then lunges forward to the left with a violent biting and clawing strike, then settles back',
    'hurt': 'dragoness is hit, her head snaps back and her body recoils to the right, eyes shut roaring in pain, wings flinching, then recovers',
    'throw': 'dragoness rears back and holds a glowing fireball inside her open jaws, then snaps her head forward to the left with her mouth wide open, then recovers, no fireball outside the mouth',
    'beam': 'dragoness inhales deeply rearing her head up with jaws wide, her throat and eyes glowing bright orange, then holds her open mouth forward to the left sweeping her head downward with the throat glowing, no flames outside the mouth, then closes her mouth',
    'death': 'dragoness collapses heavily: her legs buckle, her body slams down onto the ground, head drops, wings fall limp, bounces once, dust cloud',
    'idle3': 'enraged dragoness breathing hard, flames licking from her jaws, glowing cracks pulsing, wings flapping aggressively, tail lashing',
    'attack3': 'enraged dragoness rears back then lunges forward to the left with a furious biting and clawing strike, flames bursting, then settles back',
    'throw3': 'enraged dragoness rears back and holds a huge blazing fireball inside her open jaws, then snaps her head forward to the left with her mouth wide open, then recovers, no fireball outside the mouth',
    'beam3': 'enraged dragoness inhales deeply rearing her head up with jaws wide, her throat and eyes glowing bright yellow and orange, then holds her open mouth forward to the left sweeping her head downward with the throat glowing, no flames outside the mouth, then closes her mouth',
    'quake': 'dragoness rears high up on her hind legs with her front claws raised high above and wings fully spread, then SLAMS both front claws down onto the ground with huge force, dust cloud and flying rocks, ground cracking, then settles',
    'embers': 'dragoness throws her head back high toward the sky and roars with jaws wide open, wings fully spread open, neck stretched up, glowing sparks and embers rising around her, then lowers her head',
    'transform': 'dragoness roars as she transforms in a burst of fire: body glowing, wings spreading wide, scales darkening with lava cracks, flames bursting',
}}


def _base(gid, which):
    return Image.open(os.path.join(RAW, gid, f'{which}.png')).convert('RGBA')


def anim(gid, name, seed=3):
    """Génère et garde TOUTES les images brutes dans <id>/_raw/<anim>_s<graine>/raw<i>.png"""
    from pl939_api import b64, call, to_img, wait
    n, ask, base, last = ANIMS[name]
    view = _base(gid, base)
    body = {'first_frame': b64(view), 'frame_count': ask, 'seed': seed, 'no_background': True, 'description': DESC[gid][name],
            'direction': 'east', 'view': 'side'}
    if last == 'same':
        body['last_frame'] = b64(view)
    elif last == 'rest3':
        body['last_frame'] = b64(_base(gid, 'rest3'))
    for essai in range(6):
        try:
            imgs = wait(call('POST', '/animate-pixminimax', body))['images']
            break
        except urllib.error.HTTPError as e:
            if e.code != 429 or essai == 5:
                raise
            time.sleep(15 * (essai + 1))
    out = os.path.join(RAW, gid, '_raw', f'{name}_s{seed}')
    shutil.rmtree(out, ignore_errors=True)
    os.makedirs(out)
    for i, im in enumerate(imgs):
        to_img(im).save(os.path.join(out, f'raw{i}.png'))
    return len(imgs)


def take(gid, name, seed, pick=''):
    """Retient n images parmi les brutes : à intervalles réguliers, ou la liste `pick` (ex. 0,2,3,3,4…) : sélection seule."""
    n = ANIMS[name][0]
    src = os.path.join(RAW, gid, '_raw', f'{name}_s{seed}')
    files = sorted((f for f in os.listdir(src) if f.startswith('raw')), key=lambda f: int(f[3:-4]))
    if pick:
        idx = [int(x) for x in pick.split(',')]
        assert len(idx) == n, f'{n} indices attendus'
        out = os.path.join(RAW, gid, name)
        shutil.rmtree(out, ignore_errors=True)
        os.makedirs(out)
        for i, k in enumerate(idx):
            shutil.copy(os.path.join(src, files[k]), os.path.join(out, f'f{i}.png'))
        print(gid, name, f'images {pick} (graine {seed})')
        return
    L = len(files)
    loop = ANIMS[name][3] == 'same' and name.startswith('idle')
    out = os.path.join(RAW, gid, name)
    shutil.rmtree(out, ignore_errors=True)
    os.makedirs(out)
    for i in range(n):
        k = round(i * L / n) if loop else round(i * (L - 1) / (n - 1))
        shutil.copy(os.path.join(src, files[min(k, L - 1)]), os.path.join(out, f'f{i}.png'))
    print(gid, name, f'{n} images retenues parmi {L} (graine {seed})')


# Taille de planche installée quand elle diffère de celle de génération (réduction au plus proche voisin, ratio simple).
# Mère des Dragons : générée en 192, installée en 144 (x 3/4). Une planche de 192 sortait du cadre de combat (ailes et queue
# coupées à droite, surtout en phase 3 à l'échelle 1,33) : à 144 elle a la hauteur du Colosse (116 px) et reste dans l'écran.
OUT_FRAME = {'dragon_mother': 144}


def install(ids):
    for gid in ids or ORDER:
        src = GIANTS[gid][0]
        frame = OUT_FRAME.get(gid, src)
        ratio = frame / src
        for name, (n, *_r) in ANIMS.items():
            d = os.path.join(RAW, gid, name)
            if not os.path.isdir(d):
                continue
            fr = [Image.open(os.path.join(d, f'f{i}.png')).convert('RGBA') for i in range(n)]
            fr = [f if f.size == (src, src) else f.resize((src, src), Image.NEAREST) for f in fr]
            # Pieds sur la ligne frame-6 : UN seul décalage vertical par planche (celui de la première image, la pose de
            # repos), pour garder les mouvements (cabré, chute) sur le même sol.
            bb = fr[0].getchannel('A').point(lambda a: 255 if a >= 128 else 0).getbbox()
            dy = bb[3] - round((frame - 6) / ratio) if bb else 0
            sheet = Image.new('RGBA', (frame * n, frame))
            for i, f in enumerate(fr):
                f = f.transform(f.size, Image.AFFINE, (1, 0, 0, 0, 1, dy), Image.NEAREST)
                if frame != src:
                    f = f.resize((frame, frame), Image.NEAREST)
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
    elif cmd == 'anim':  # anim <id> <anim> [graine…]  (plusieurs graines en parallèle)
        seeds = [int(x) for x in sys.argv[4:]] or [3]
        with ThreadPoolExecutor(4) as ex:
            for sd, r in zip(seeds, ex.map(lambda sd: anim(sys.argv[2], sys.argv[3], sd), seeds)):
                print(sys.argv[2], sys.argv[3], 'graine', sd, r, 'images', flush=True)
    elif cmd == 'take':  # take <id> <anim> <graine> [liste d'images brutes, ex. 0,2,3,…]
        take(sys.argv[2], sys.argv[3], int(sys.argv[4]), *sys.argv[5:6])
    elif cmd == 'install':
        install(sys.argv[2:])
