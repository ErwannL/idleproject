"""v9.4.0 : animations PixelLab (animate-pixminimax) des compagnons refaits : marche et attaque, à partir de la nouvelle
vue (pixellab939/picks.json). Écrit pixellab/anim_allies/_ref/<clé>.png/.json et <clé>_<anim>/f0..f8.png ; l'ancienne
nage (dessinée sur l'ancien personnage) est mise de côté dans pixellab939/old/. Ensuite : python3 tools/art/pixellab_allies.py
Usage : python3 tools/art/pl939_anims.py [clé ...]"""
import json, os, shutil, sys
from concurrent.futures import ThreadPoolExecutor
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pixellab as pl
from pl939_api import b64, call, to_img, wait
from pl939_apply import DEFAULT_H, HEIGHT

HERE = os.path.dirname(os.path.abspath(__file__))
AA = os.path.join(HERE, 'pixellab', 'anim_allies')
CH = os.path.join(HERE, 'pixellab939', 'chars')
ATTACK = {
  'ally_squire': 'quick sword slash forward', 'ally_mercenary': 'heavy two-handed broadsword overhead strike',
  'ally_ranger': 'drawing the longbow and shooting an arrow forward', 'ally_pyromancer': 'casting a fireball forward from her hand',
  'ally_priestess': 'raising the holy staff and casting a light spell', 'ally_lancer': 'thrusting the long spear forward',
  'ally_shadow': 'fast double dagger slash forward', 'ally_dwarf': 'swinging the double-headed axe forward',
  'ally_azure_paladin': 'holy sword slash forward', 'ally_rose_blade': 'elegant rapier lunge forward',
  'ally_witch': 'pointing the staff and casting a void orb forward', 'ally_elf_archer': 'drawing the elven bow and shooting an arrow forward',
  'ally_high_priest': 'raising the sun staff and casting a holy light spell', 'ally_ninja': 'swift katana slash forward',
  'ally_barbarian': 'heavy two-handed axe overhead strike',
  'pet_cat': 'pouncing forward with a paw swipe', 'pet_owl': 'flapping wings and swooping forward with talons',
  'pet_slime': 'squashing then bouncing forward to bump', 'pet_wisp': 'flaring its flame and shooting a small fireball forward',
  'pet_golem': 'punching forward with a stone fist', 'pet_fairy': 'waving the glowing flower and casting sparkles forward',
}
WALK = 'walking forward, natural walk cycle'
MOVE = {'pet_owl': 'flying forward, flapping wings', 'pet_fairy': 'flying forward, fluttering butterfly wings',
        'pet_wisp': 'floating forward, flickering flame', 'pet_slime': 'hopping forward, squash and stretch'}


def ref(key, n):
    view = Image.open(os.path.join(CH, key, f'sprite_v{n}.png')).convert('RGBA')
    box = view.getchannel('A').point(lambda a: 255 if a >= 128 else 0).getbbox()
    if key.startswith('pet_'):
        meta = {'ox': box[0], 'oy': box[1]}  # familier : sprite du jeu = la vue rognée, sans échelle
    else:
        q = pl._frame(key)  # même découpe que le sprite du jeu
        meta = {'ox': box[0] - pl.MARGIN, 'oy': box[1], 'scale': round(HEIGHT.get(key, DEFAULT_H) / q.height, 4)}
    os.makedirs(os.path.join(AA, '_ref'), exist_ok=True)
    view.save(os.path.join(AA, '_ref', f'{key}.png'))
    json.dump(meta, open(os.path.join(AA, '_ref', f'{key}.json'), 'w'))
    return view


def anim(key, view, name, desc, seed=3):
    out = os.path.join(AA, f'{key}_{name}')
    job = call('POST', '/animate-pixminimax', {'first_frame': b64(view), 'last_frame': b64(view), 'frame_count': 8, 'seed': seed,
                                              'no_background': True, 'description': desc, 'direction': 'east', 'view': 'side'})
    r = wait(job)
    imgs = r['images']
    shutil.rmtree(out, ignore_errors=True); os.makedirs(out)
    for i, im in enumerate(imgs[:9]):
        to_img(im).resize(view.size, Image.NEAREST).save(os.path.join(out, f'f{i}.png'))
    return len(imgs)


def run(item):
    key, n = item
    try:
        view = ref(key, n)
        for old in (f'{key}_swim', f'{key}_hover'):
            p = os.path.join(AA, old)
            if os.path.isdir(p):
                dst = os.path.join(HERE, 'pixellab939', 'old', old); shutil.rmtree(dst, ignore_errors=True); shutil.move(p, dst)
        for f in (f'{key}_swim.png', f'{key}_swim.json'):
            p = os.path.join(AA, '_ref', f)
            if os.path.exists(p): shutil.move(p, os.path.join(HERE, 'pixellab939', 'old', f))
        a = anim(key, view, 'walk', MOVE.get(key, WALK))
        b = anim(key, view, 'attack', ATTACK[key])
        return key, f'marche {a}, attaque {b}'
    except Exception as e:  # noqa: BLE001
        return key, f'ERREUR {str(e)[:200]}'


if __name__ == '__main__':
    picks = json.load(open(os.path.join(HERE, 'pixellab939', 'picks.json')))
    keys = list(sys.argv[1:] or picks)
    with ThreadPoolExecutor(4) as ex:
        for key, st in ex.map(run, [(k, picks[k]) for k in keys]):
            print(key, st, flush=True)
