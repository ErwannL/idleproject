"""v10.0 (9.3) : illustrations des fiches fidèles au personnage du combat.
Référence = image de repos réellement dessinée en combat (<sprite>_idle0, art-anim-allies*.js) pour les compagnons, le
petit sprite (assets/sprites/<sprite>.png) pour les familiers. Génération image-vers-image (PixelLab bitforge : image
de départ = la référence, influence maximale, palette verrouillée sur celle du sprite), même pose, rien d'ajouté.
L'éveillée ajoute seulement une aura, des particules et un éclat de l'arme (jamais un vêtement ni un accessoire).
Sorties : tools/art/pixellab10/fiches/<id>[_awake].png ; installation : --install (assets/hd/px, thumb, awake).
Contrôle : python3 tools/art/check_fidelity.py
Usage : PIXELLAB_API_KEY=… python3 tools/art/pl10_fiches.py [id …] [--awake] | --install"""
import json, os, subprocess, sys
from concurrent.futures import ThreadPoolExecutor
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pl939_api import b64, call, images_of, wait  # noqa: E402
import check_anims as CA  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(HERE, 'pixellab10', 'fiches'); PX = os.path.join(ROOT, 'assets', 'hd', 'px')
FRAMES_JSON = os.path.join(OUT, 'frames.json')
AURA = {'red': 'blazing fire aura and floating embers around the body', 'blue': 'swirling glowing water aura and sparkles around the body', 'green': 'glowing leaves and soft green light around the body',
        'light': 'radiant golden holy light aura around the body', 'dark': 'swirling violet shadow aura around the body'}


def companions():
    out = subprocess.run(['node', '--input-type=module', '-e', "import {COMPANIONS} from './src/data/companions.js'; import {UNIT_ELEMENT} from './src/core/elements.js'; console.log(JSON.stringify(COMPANIONS.map(c=>({id:c.id,sprite:c.sprite,kind:c.kind ?? 'pet',name:c.name,el:UNIT_ELEMENT[c.id]}))))"],
                         cwd=ROOT, capture_output=True, text=True).stdout
    return {c['id']: c for c in json.loads(out)}


def reference(c):
    """Image de combat : repos dessiné (compagnon) ou petit sprite (familier), recadrée."""
    if c['kind'] == 'ally':
        if not os.path.exists(FRAMES_JSON):
            os.makedirs(OUT, exist_ok=True)
            subprocess.run(['node', os.path.join(HERE, 'dump_ally_frames.mjs'), FRAMES_JSON], check=True, cwd=ROOT)
        data = json.load(open(FRAMES_JSON))
        anims = data.get(c['sprite'], {})
        f = (anims.get('idle') or anims.get('walk') or anims.get('attack'))['frames'][0]
        im = CA.frame_img(f)
    else:
        im = Image.open(os.path.join(ROOT, 'assets', 'sprites', f"{c['sprite']}.png")).convert('RGBA')
    return im.crop(im.getbbox())


def fit(im, size):
    k = max(1, min(size[0] // im.width, size[1] // im.height))
    big = im.resize((im.width * k, im.height * k), Image.NEAREST)
    canvas = Image.new('RGBA', size, (0, 0, 0, 0)); canvas.alpha_composite(big, ((size[0] - big.width) // 2, size[1] - big.height))
    return canvas


def gen(args):
    cid, awake = args
    C = companions(); c = C[cid]
    path = os.path.join(OUT, f"{cid}{'_awake' if awake else ''}.png")
    ref = reference(c)
    size = (128, 128) if c['kind'] == 'ally' else (96, 96)
    init = fit(ref, size)
    who = 'fantasy pet creature' if c['kind'] != 'ally' else 'fantasy hero character'
    desc = (f"the exact same {who} as the reference, full body, same pose, same colors, same hair, same clothes, same weapon and accessories, "
            "nothing added, more detailed pixel art illustration, soft light, transparent background")
    if awake:
        desc += f", awakened: {AURA.get(c['el'], 'magic aura around the body')}, the weapon glows; no new clothing, no crown, no hood, no shield"
    body = {'description': desc, 'image_size': {'width': size[0], 'height': size[1]}, 'no_background': True, 'seed': 5,
            'init_image': b64(init), 'init_image_strength': int(os.environ.get('STRENGTH', 680)), 'color_image': b64(init if not awake else init),
            'outline': 'single color black outline', 'shading': 'medium shading', 'detail': 'highly detailed', 'view': 'side', 'direction': 'east'}
    try:
        im = images_of(wait(call('POST', '/create-image-bitforge', body)))[0]
        os.makedirs(OUT, exist_ok=True); im.save(path); return f'{cid}{" éveillé" if awake else ""} ok'
    except Exception as e:  # noqa: BLE001
        return f'{cid} ERREUR {str(e)[:200]}'


EL_RGB = {'red': (255, 110, 40), 'blue': (70, 180, 255), 'green': (110, 230, 110), 'light': (255, 226, 120), 'dark': (180, 100, 255)}


def awaken(im, el, seed=3):
    """Éveil : la même image, plus une aura de l'élément autour du corps, des particules et des éclats sur les pixels
    les plus clairs (l'arme) — en pixel art, à la petite taille, avant l'agrandissement. Rien d'autre ne change."""
    import random
    from PIL import ImageFilter
    rnd = random.Random(seed)
    col = EL_RGB.get(el, (200, 200, 255))
    pad = 10
    base = Image.new('RGBA', (im.width + pad * 2, im.height + pad * 2), (0, 0, 0, 0)); base.alpha_composite(im, (pad, pad))
    a = base.getchannel('A').point(lambda v: 255 if v >= 128 else 0)
    ring = a.filter(ImageFilter.MaxFilter(7))
    outer = ring.filter(ImageFilter.MaxFilter(5))
    aura = Image.new('RGBA', base.size, (0, 0, 0, 0))
    ap, rp, op = aura.load(), ring.load(), outer.load()
    for y in range(base.height):
        for x in range(base.width):
            if op[x, y] and not a.getpixel((x, y)):
                inner = rp[x, y] > 0
                # Aura en pixels francs, plus dense près du corps, qui ondule (motif en damier aléatoire au bord).
                if inner or rnd.random() < 0.35:
                    ap[x, y] = col + (200 if inner else 110,)
    out = Image.alpha_composite(aura, base)
    px = out.load()
    # Éclats sur les pixels les plus clairs du personnage (arme, reflets).
    lum = sorted(((sum(px[x, y][:3]), x, y) for y in range(out.height) for x in range(out.width) if px[x, y][3] and a.getpixel((x, y))), reverse=True)
    for _, x, y in lum[: max(4, len(lum) // 120)]:
        if rnd.random() < 0.5: px[x, y] = (255, 255, 255, 255)
    # Particules autour (petites croix de lumière).
    w, h = out.size
    for _ in range(18):
        x, y = rnd.randrange(2, w - 2), rnd.randrange(2, h - 2)
        if a.getpixel((x, y)): continue
        for dx, dy in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)):
            px[x + dx, y + dy] = (255, 255, 255, 255) if (dx, dy) == (0, 0) else col + (255,)
    return out


def install():
    C = companions()
    for cid, c in C.items():
        for awake in (False, True):
            src = os.path.join(OUT, f"{cid}{'_awake' if awake else ''}.png")
            if not os.path.exists(src): continue
            im = Image.open(src).convert('RGBA'); im = im.crop(im.getbbox())
            key = c['sprite'].replace('pet_slime', 'pet_golden_slime') if c['kind'] != 'ally' else c['sprite']
            if awake: continue  # l'éveillée est fabriquée depuis la fiche fidèle (ci-dessous)
            ref_main = Image.open(os.path.join(PX, f'{key}.webp')) if os.path.exists(os.path.join(PX, f'{key}.webp')) else None
            size = ref_main.size if ref_main else (988, 1218)
            fit(im, size).save(os.path.join(PX, f'{key}.webp'), 'WEBP', lossless=True)
            th = os.path.join(PX, 'thumb', f'{key}.webp')
            tsize = Image.open(th).size if os.path.exists(th) else (329, 406)
            fit(im, tsize).save(th, 'WEBP', lossless=True)
            if c['kind'] == 'ally':
                fit(awaken(im, c['el']), (600, 1218)).save(os.path.join(PX, 'awake', f'{key}.webp'), 'WEBP', lossless=True)
                awaken(im, c['el']).save(os.path.join(OUT, f'{cid}_awake.png'))
    print('installé')


if __name__ == '__main__':
    if '--install' in sys.argv: install(); sys.exit(0)
    awake = '--awake' in sys.argv
    ids = [a for a in sys.argv[1:] if not a.startswith('--')] or list(companions())
    if awake: ids = [i for i in ids if companions()[i]['kind'] == 'ally']
    with ThreadPoolExecutor(5) as ex:
        for m in ex.map(gen, [(i, awake) for i in ids]): print(m, flush=True)
