"""v10.0 (9.2) : régénère les animations figées des compagnons et familiers (PixelLab animate-pixminimax, même
méthode que les sorts réussis de pl971_anims.py, vue de référence = image de repos du combat), avec une description
d'action par arme. Chaque nouvelle animation est contrôlée (même mesure que tools/art/check_anims.py) : refusée si
elle change moins de 15 % des pixels par image (action) ou 8 % (repos), ou perd plus de 30 % des pixels (arme
disparue) ; on retente alors avec une autre graine (jusqu'à 3 essais). L'ancienne animation est gardée dans
pixellab/anim_allies/_old10/ tant qu'aucune version n'est acceptée.

Usage : PIXELLAB_API_KEY=… python3 tools/art/pl10_anims.py [clé:anim …]   (sans argument : toute la liste TODO)
Intégration ensuite : python3 tools/art/pixellab_allies.py ; contrôle : python3 tools/art/check_anims.py
"""
import os
import shutil
import sys
from concurrent.futures import ThreadPoolExecutor

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pl939_api import b64, call, to_img, wait  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
AA = os.path.join(HERE, 'pixellab', 'anim_allies')
OLD = os.path.join(AA, '_old10')
FRAMES = {'attack': 8, 'idle': 8, 'ultimate': 12, 'cast': 12}
ATTACK = {
    'ally_mercenary': 'the two-handed greatsword leaves the shoulder, a big diagonal slash from top to bottom, then the sword returns to rest on the shoulder',
    'ally_barbarian': 'swinging the axe in a circle above the head, then a heavy vertical chop down to the ground, axe always in hand',
    'ally_lancer': 'a powerful forward thrust of the spear with the arm fully extended, then pulling back',
    'ally_azure_paladin': 'a wide horizontal sword slash in front of the body, shield held, then back to guard',
    'ally_rose_blade': 'a quick lunge forward with two fast rapier thrusts, then stepping back',
    'ally_pyromancer': 'raising one arm, a fireball grows bigger in the hand, then pushing the arm forward to throw it',
    'pet_fairy': 'spinning around in the air with the flower pointed forward, sparkles',
    'ally_ninja': 'drawing the katana and striking forward in a flash, then sheathing it',
}
IDLE = {
    'ally_mercenary': 'idle breathing, chest rising, the greatsword on the shoulder moving with the breath, scarf blowing',
    'ally_barbarian': 'idle heavy breathing, shoulders rising, axe moving slightly with the breath',
    'ally_azure_paladin': 'idle breathing, cape moving, sword and shield moving slightly with the breath',
    'ally_rose_blade': 'idle breathing, weight shifting, rapier tip bobbing, hair moving',
    'ally_squire': 'idle breathing, shield and sword moving slightly, cape moving',
    'ally_ice_empress': 'idle floating gently, robes and hair flowing, frost sparkles around the hands',
    'ally_sylvan_guardian': 'idle breathing, leaves of the dress moving, staff swaying slightly',
    'pet_cat': 'idle sitting, breathing, tail swishing left and right, ears twitching',
    'pet_owl': 'idle perched, breathing, wings opening and closing a little, head turning',
    'pet_golem': 'idle, the stone body floating up and down slightly, small rocks hovering, glowing core pulsing',
    'pet_phoenix': 'idle hovering, wings flapping, flame tail flickering',
    'pet_fairy': 'idle hovering, wings fluttering fast, body bobbing up and down',
    'pet_dragonling': 'idle breathing, small wings flexing, tail swaying',
    'pet_jade_turtle': 'idle, head moving in and out of the shell slowly, breathing',
    'pet_crystal_hedgehog': 'idle sniffing, nose twitching, crystal spikes glinting, breathing',
}
ULT = {
    'ally_shadow': 'a flurry of very fast dagger slashes forward, body leaning and twisting, daggers always visible in both hands, dark wisps',
    'ally_ninja': 'a lightning fast series of katana slashes, many quick strikes, body moving forward every frame',
    'ally_barbarian': 'leaping up and smashing the axe down with both hands, the axe stays in the hands on every frame',
    'ally_squire': 'leaping high and bringing the sword down in a heroic overhead strike, sword and shield always visible',
}
CAST = {
    'ally_witch': 'raising the staff, a swirling purple orb forming above, then thrusting the staff forward to release it',
}
TODO = [f'{k}:attack' for k in ATTACK] + [f'{k}:idle' for k in IDLE] + [f'{k}:ultimate' for k in ULT] + [f'{k}:cast' for k in CAST]


def desc(key, name):
    return {'attack': ATTACK, 'idle': IDLE, 'ultimate': ULT, 'cast': CAST}[name][key]


def score(view, frames, name):
    """Variation moyenne par image (part des pixels opaques qui changent) et perte de pixels par rapport au repos."""
    def d(a, b):
        n = c = 0
        for x, y in zip(a.get_flattened_data(), b.get_flattened_data()):
            if x[3] >= 128 or y[3] >= 128:
                n += 1
                c += (x[3] >= 128) != (y[3] >= 128) or (x[3] >= 128 and sum(abs(x[i] - y[i]) for i in range(3)) > 24)
        return c / max(1, n)
    steps = [d(frames[i], frames[i + 1]) for i in range(len(frames) - 1)]
    base = sum(1 for p in view.get_flattened_data() if p[3] >= 128)
    loss = max(1 - sum(1 for p in f.get_flattened_data() if p[3] >= 128) / max(1, base) for f in frames)
    return sum(steps) / max(1, len(steps)), loss


def gen(job):
    key, name = job.split(':')
    view = Image.open(os.path.join(AA, '_ref', f'{key}.png')).convert('RGBA')
    target = 0.08 if name == 'idle' else 0.15
    best = None
    for seed in (21, 33, 47):
        try:
            body = {'first_frame': b64(view), 'last_frame': b64(view), 'frame_count': FRAMES[name], 'seed': seed,
                    'no_background': True, 'description': desc(key, name), 'direction': 'east', 'view': 'side'}
            imgs = [to_img(im).resize(view.size, Image.NEAREST) for im in wait(call('POST', '/animate-pixminimax', body))['images']]
        except Exception as e:  # noqa: BLE001
            print(job, 'erreur', str(e)[:120], flush=True)
            continue
        mean, loss = score(view, imgs, name)
        if best is None or (mean - max(0, loss - 0.3)) > best[0]:
            best = (mean - max(0, loss - 0.3), imgs, mean, loss, seed)
        if mean >= target and loss <= 0.3:
            break
    if not best:
        return f'{job} ÉCHEC'
    _, imgs, mean, loss, seed = best
    out = os.path.join(AA, f'{key}_{name}')
    if os.path.isdir(out):
        os.makedirs(OLD, exist_ok=True)
        dst = os.path.join(OLD, f'{key}_{name}')
        if not os.path.exists(dst):
            shutil.copytree(out, dst)
        shutil.rmtree(out)
    os.makedirs(out)
    for i, im in enumerate(imgs):
        im.save(os.path.join(out, f'f{i}.png'))
    ok = mean >= target and loss <= 0.3
    return f'{job} {"ok" if ok else "FAIBLE"} variation {mean:.3f} perte {loss:.0%} graine {seed}'


if __name__ == '__main__':
    jobs = sys.argv[1:] or TODO
    with ThreadPoolExecutor(6) as ex:
        for msg in ex.map(gen, jobs):
            print(msg, flush=True)
