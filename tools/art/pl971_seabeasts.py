"""v9.7.1 (lot C.4) : nouveaux modèles des monstres marins — Léviathan (serpent de mer massif, tête à crête, anneaux
qui sortent de l'eau), Mégalodon et Kraken — puis leurs animations (nage, morsure, raz-de-marée, coup de queue,
coup reçu, mort). Vue de profil tournée vers la gauche (les ennemis avancent vers le héros).
Usage : python3 tools/art/pl971_seabeasts.py models | anims <clé> | pick <clé> <n>"""
import os, shutil, sys
from concurrent.futures import ThreadPoolExecutor
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pl939_api import b64, call, to_img, wait, pixflux

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'pixellab971', 'sea')
ANIM = os.path.join(HERE, 'pixellab', 'anim')
SIZE = {'boss_leviathan': 176, 'hard_megalodon': 144, 'mid_kraken': 128}
MODEL = {
  'boss_leviathan': 'massive sea serpent boss, huge armored head with a tall spiked crest and glowing eyes, thick body coils arching out of the water in rings, deep teal and dark blue scales, pale belly, fins, side view facing left, menacing, pixel art boss',
  'hard_megalodon': 'giant prehistoric megalodon shark boss, enormous jaws with rows of teeth, scarred grey-blue body, side view facing left, swimming, pixel art boss',
  'mid_kraken': 'giant kraken boss, huge purple-red octopus head with glowing eyes, many thick tentacles curling and raised, side view facing left, pixel art boss',
}
ANIMS = {
  'swim': (8, 'swimming in place, body coils undulating, menacing'),
  'attack': (8, 'lunging the head forward and biting, neck stretching forward'),
  'skill': (12, 'rising up high and summoning a huge tidal wave crashing forward'),
  'skill2': (8, 'whipping its tail around in a powerful tail strike'),
  'hurt': (4, 'recoiling from a hit, flinching'),
  'death': (8, 'collapsing and diving down beneath the water, disappearing'),
}


def models():
    os.makedirs(OUT, exist_ok=True)
    for key, d in MODEL.items():
        for seed in (1, 2, 3):
            for i, im in enumerate(pixflux(d, SIZE[key], seed=seed)):
                im.save(os.path.join(OUT, f'{key}_s{seed}.png'))
        print(key, 'ok', flush=True)


def pick(key, seed):
    im = Image.open(os.path.join(OUT, f'{key}_s{seed}.png')).convert('RGBA')
    im.save(os.path.join(OUT, f'{key}_view.png'))


def anim(job):
    key, name = job
    view = Image.open(os.path.join(OUT, f'{key}_view.png')).convert('RGBA')
    n, d = ANIMS[name]
    body = {'first_frame': b64(view), 'frame_count': n, 'seed': 4, 'no_background': True, 'description': d,
            'direction': 'west', 'view': 'side'}
    if name != 'death': body['last_frame'] = b64(view)
    try:
        imgs = wait(call('POST', '/animate-pixminimax', body))['images']
    except Exception as e:  # noqa: BLE001
        return f'{key} {name} ERREUR {str(e)[:150]}'
    out = os.path.join(ANIM, f'{key}_{name}')
    shutil.rmtree(out, ignore_errors=True); os.makedirs(out)
    for i, im in enumerate(imgs):
        to_img(im).resize(view.size, Image.NEAREST).save(os.path.join(out, f'f{i}.png'))
    return f'{key} {name} {len(imgs)}'


if __name__ == '__main__':
    if sys.argv[1] == 'models': models()
    elif sys.argv[1] == 'pick': pick(sys.argv[2], sys.argv[3])
    else:
        with ThreadPoolExecutor(3) as ex:
            for m in ex.map(anim, [(sys.argv[2], a) for a in ANIMS]): print(m, flush=True)
