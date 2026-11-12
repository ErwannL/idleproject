"""v9.4.0 : gestes de compétence (anim_skills) des personnages refaits, régénérés depuis la nouvelle vue (_ref).
Même nombre d'images qu'avant. Ensuite : python3 tools/art/pixellab_skills.py"""
import json, os, shutil, sys
from concurrent.futures import ThreadPoolExecutor
from PIL import Image
from pl939_api import b64, call, to_img, wait

HERE = os.path.dirname(os.path.abspath(__file__))
SK = os.path.join(HERE, 'pixellab', 'anim_skills')
REF = os.path.join(HERE, 'pixellab', 'anim_allies', '_ref')
TEXT = {
  'pounce': 'pouncing forward to attack', 'howl': 'rearing up and calling out with power', 'charge': 'charging forward quickly',
  'taunt': 'taunting the enemy, beating chest', 'dance': 'spinning blade dance', 'blade_dance': 'spinning blade dance',
  'brace': 'bracing behind the shield, guarding', 'shield_bash': 'bashing forward with the shield', 'low_stab': 'low quick stab forward',
  'leap_slash': 'leaping forward with a downward slash', 'slash': 'wide slash forward', 'shoot_up': 'shooting an arrow up into the sky',
  'roar': 'roaring with arms spread', 'pray': 'praying with joined hands', 'open_hands': 'opening hands to release light',
  'ground_smash': 'smashing the weapon into the ground', 'full_draw': 'fully drawing the bow and releasing', 'cast_forward': 'casting a spell forward',
  'bless': 'raising a hand to bless allies', 'aim_shot': 'aiming carefully and shooting', 'twin_slash': 'crossing twin blades slash',
  'raise_staff': 'raising the staff high to cast', 'raise_shield': 'raising the shield high', 'raise_arms': 'raising both arms to cast',
  'point_sky': 'pointing to the sky to call magic', 'plant_staff': 'planting the staff into the ground', 'orb_channel': 'channeling a magic orb between hands',
  'lance_thrust': 'powerful lance thrust forward', 'dash_slash': 'dashing forward with a slash', 'axe_spin': 'spinning with the axe',
  'arms_forward': 'thrusting both arms forward to cast',
}


def job(d):
    key, motif = d
    out = os.path.join(SK, f'{key}_{motif}')
    n = len([f for f in os.listdir(out) if f.endswith('.png')]) - 1
    view = Image.open(os.path.join(REF, f'{key}.png')).convert('RGBA')
    try:
        r = wait(call('POST', '/animate-pixminimax', {'first_frame': b64(view), 'last_frame': b64(view), 'frame_count': max(4, min(16, n)),
              'seed': 5, 'no_background': True, 'description': TEXT.get(motif, motif.replace('_', ' ')), 'direction': 'east', 'view': 'side'}))
        imgs = r['images']
        shutil.rmtree(out); os.makedirs(out)
        for i, im in enumerate(imgs[:n + 1]):
            to_img(im).resize(view.size, Image.NEAREST).save(os.path.join(out, f'f{i}.png'))
        return f'{key}_{motif} {len(imgs)}'
    except Exception as e:  # noqa: BLE001
        return f'{key}_{motif} ERREUR {str(e)[:150]}'


if __name__ == '__main__':
    picks = json.load(open(os.path.join(HERE, 'pixellab939', 'picks.json')))
    todo = []
    for name in sorted(os.listdir(SK)):
        for key in picks:
            if name.startswith(key + '_'):
                motif = name[len(key) + 1:]
                if key == 'ally_shadow' and motif.startswith('lord_'):
                    continue
                todo.append((key, motif))
    print(len(todo), 'gestes', flush=True)
    with ThreadPoolExecutor(6) as ex:
        for line in ex.map(job, todo):
            print(line, flush=True)
