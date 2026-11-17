"""v9.7.1 (lot B) : nouvelles animations PixelLab (animate-pixminimax) des alliés, à partir de la vue de référence
actuelle (pixellab/anim_allies/_ref/<clé>.png : même palette, même gabarit, mêmes pieds) :
  idle     respiration, cape, arme tenue (boucle)
  cast     compétence de soutien ou de zone, geste distinct de l'attaque
  ultimate geste ample propre au personnage
  hurt     coup reçu (court)
  victory  pose de victoire (boucle)
Écrit pixellab/anim_allies/<clé>_<anim>/fN.png, puis une planche de contrôle (toutes les images côte à côte, pieds,
palette comparée au sprite) dans pixellab971/sheet_<lot>.png. Intégration ensuite : python3 tools/art/pixellab_allies.py
Usage : python3 tools/art/pl971_anims.py <clé> [clé ...]   (ex. ally_squire ally_ranger)"""
import json, os, shutil, sys
from concurrent.futures import ThreadPoolExecutor
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pl939_api import b64, call, to_img, wait

HERE = os.path.dirname(os.path.abspath(__file__))
AA = os.path.join(HERE, 'pixellab', 'anim_allies')
OUT = os.path.join(HERE, 'pixellab971')
FRAMES = {'idle': 8, 'cast': 12, 'ultimate': 12, 'hurt': 4, 'victory': 8}  # PixelLab n'accepte que 4, 8 ou 12 images
GENERIC = {
  'idle': 'standing idle in place, calm breathing, cape and hair moving slightly, weapon held, feet planted',
  'hurt': 'getting hit, flinching backward briefly then recovering, feet planted',
  'victory': 'victory pose, raising the weapon in triumph, feet planted',
}
# Compétence (soutien, zone) : geste distinct de l'attaque. Ultime : geste ample propre au personnage.
CAST = {
  'ally_squire': 'planting the shield in the ground and bracing, rallying cry',
  'ally_mercenary': 'raising the broadsword high with both hands and slamming it into the ground, shockwave',
  'ally_ranger': 'aiming the longbow high into the sky and releasing a volley of arrows upward',
  'ally_pyromancer': 'raising both hands above her head, gathering a big swirling fireball',
  'ally_priestess': 'lifting the holy staff high above her head, healing light radiating',
}
ULT = {
  'ally_squire': 'leaping high and bringing the sword down in a heroic overhead strike, cape flowing',
  'ally_mercenary': 'spinning around twice with the broadsword in a wide whirlwind slash',
  'ally_ranger': 'kneeling, drawing the bow fully and releasing a powerful charged arrow, recoil',
  'ally_pyromancer': 'floating slightly, arms spread wide, summoning a meteor from the sky, robes billowing',
  'ally_priestess': 'kneeling in prayer then rising with the staff raised, wings of light opening behind her',
}


# Lot 2+ : descriptions par défaut selon le type (familier, héros, compagnon). Seconde passe (REDO) : variantes plus amples.
PET_CAST = 'glowing brightly and releasing a burst of magic energy around itself'
PET_ULT = 'growing larger, glowing intensely and unleashing a powerful magical blast forward'
REDO = {
  ('ally_squire', 'ultimate'): 'jumping high into the air and slamming the sword down with a big heroic strike, shield raised, cape flowing',
  ('ally_mercenary', 'victory'): 'lifting the broadsword high above his head with one arm and shouting in triumph',
  ('ally_ranger', 'victory'): 'raising the bow high above her head in triumph and smiling',
}


def desc(key, name):
    if (key, name) in REDO: return REDO[(key, name)]
    pet = key.startswith('pet_')
    if name == 'cast': return CAST.get(key, PET_CAST if pet else 'raising the weapon high, glowing aura, casting a powerful spell')
    if name == 'ultimate': return ULT.get(key, PET_ULT if pet else 'performing a big dramatic special attack with a wide sweeping motion, cape and hair flowing')
    if pet and name == 'victory': return 'jumping happily in place, joyful'
    if pet and name == 'idle': return 'idle in place, gentle breathing, small movements'
    return GENERIC[name]


def anim(key, view, name, seed=None):
    seed = seed if seed is not None else (11 if (key, name) in REDO else 7)
    out = os.path.join(AA, f'{key}_{name}')
    body = {'first_frame': b64(view), 'last_frame': b64(view), 'frame_count': FRAMES[name], 'seed': seed,
            'no_background': True, 'description': desc(key, name), 'direction': 'east', 'view': 'side'}
    imgs = wait(call('POST', '/animate-pixminimax', body))['images']
    shutil.rmtree(out, ignore_errors=True); os.makedirs(out)
    for i, im in enumerate(imgs):
        to_img(im).resize(view.size, Image.NEAREST).save(os.path.join(out, f'f{i}.png'))
    return len(imgs)


def palette_gap(view, frames):
    """Part des pixels opaques des images dont la couleur n'existe pas dans la vue (avant remappage)."""
    ref = {p[:3] for p in view.get_flattened_data() if p[3] >= 128}
    tot = bad = 0
    for f in frames:
        for p in f.get_flattened_data():
            if p[3] < 128: continue
            tot += 1
            if p[:3] not in ref: bad += 1
    return bad / max(1, tot)


def sheet(keys, tag):
    rows = []
    for key in keys:
        view = Image.open(os.path.join(AA, '_ref', f'{key}.png')).convert('RGBA')
        for name in FRAMES:
            d = os.path.join(AA, f'{key}_{name}')
            if not os.path.isdir(d): continue
            fr = [Image.open(os.path.join(d, f)).convert('RGBA') for f in sorted(os.listdir(d), key=lambda s: int(s[1:-4]))]
            rows.append((key, name, view, fr, palette_gap(view, fr)))
    if not rows: return None
    W, H = rows[0][2].size
    k = 2
    cols = max(len(r[3]) for r in rows) + 1
    img = Image.new('RGBA', (cols * W * k + 220, len(rows) * (H * k + 6)), (34, 36, 52, 255))
    dr = ImageDraw.Draw(img)
    for j, (key, name, view, fr, gap) in enumerate(rows):
        y = j * (H * k + 6)
        dr.text((4, y + 4), f'{key[5:]} {name}', fill=(255, 255, 255))
        dr.text((4, y + 18), f'{len(fr)} img · hors palette {gap:.0%}', fill=(255, 200, 120))
        for i, f in enumerate([view] + fr):
            x = 220 + i * W * k
            img.alpha_composite(f.resize((W * k, H * k), Image.NEAREST), (x, y))
            foot = max((yy for yy in range(H) for xx in range(W) if f.getpixel((xx, yy))[3] >= 128), default=0)
            dr.line((x, y + (foot + 1) * k, x + W * k - 2, y + (foot + 1) * k), fill=(90, 220, 120) if i == 0 else (255, 80, 80))
    os.makedirs(OUT, exist_ok=True)
    p = os.path.join(OUT, f'sheet_{tag}.png'); img.save(p)
    return p


def run(key):
    view = Image.open(os.path.join(AA, '_ref', f'{key}.png')).convert('RGBA')
    done = []
    only = os.environ.get('ANIMS', '').split(',') if os.environ.get('ANIMS') else FRAMES
    for name in only:
        try: done.append(f'{name} {anim(key, view, name)}')
        except Exception as e: done.append(f'{name} ERREUR {str(e)[:120]}')  # noqa: BLE001
    return key, ', '.join(done)


if __name__ == '__main__':
    keys = sys.argv[1:]
    if keys and keys[0] == '--sheet':
        print(sheet(keys[2:], keys[1])); sys.exit(0)
    with ThreadPoolExecutor(5) as ex:
        for k, msg in ex.map(run, keys): print(k, msg, flush=True)
    print(sheet(keys, 'lot1'))
