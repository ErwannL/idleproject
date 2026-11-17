"""v9.7.1 (lot C) : animations PixelLab (animate-pixminimax) des ennemis et des boss, à partir de leur vue actuelle
(f0 d'une animation existante, sinon la direction 7 de tools/art/pixellab/<sprite>.png) : même palette, même cadre.
  skill      compétence (invocation, rage, charge) — boss et mini-boss
  telegraph  annonce d'un coup lourd (préparation) — boss et mini-boss, branchée sur bossHeavy
  attack2    seconde attaque — 20 monstres les plus fréquents
  hurt, death, walk/float, attack — boss qui n'en avaient pas
Écrit tools/art/pixellab/anim/<sprite>_<anim>/fN.png et une planche de contrôle pixellab971/sheet_<lot>.png ;
intégration : python3 tools/art/pixellab_anim.py
Usage : python3 tools/art/pl971_enemies.py <lot>   (lots : bosses6, knight, bosses, monsters)"""
import os, shutil, sys
from concurrent.futures import ThreadPoolExecutor
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pl939_api import b64, call, to_img, wait
import pl971_anims as A

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'pixellab')
ANIM = os.path.join(SRC, 'anim')
FRAMES = {'walk': 8, 'float': 8, 'attack': 8, 'hurt': 4, 'death': 8, 'skill': 12, 'telegraph': 4, 'attack2': 8}
DESC = {
  'walk': 'walking forward slowly and menacingly', 'float': 'floating in place, hovering menacingly',
  'attack': 'attacking forward with a heavy strike', 'hurt': 'getting hit, recoiling backward then recovering',
  'death': 'collapsing and dying, falling down and fading', 'telegraph': 'winding up a heavy attack, crouching and gathering power, glowing',
  'skill': 'roaring and unleashing a special power, magical energy bursting around',
  'attack2': 'a different attack: lunging forward with a quick bite or second strike',
}
SKILL = {  # compétence propre au boss quand on la connaît
  'boss_slime_king': 'splitting and spawning small slimes around', 'boss_alpha_wolf': 'howling to summon the pack',
  'boss_bone_lord': 'raising skeleton minions from the ground', 'boss_ash_dragon': 'breathing a wide cone of fire',
  'boss_leviathan': 'rising out of the sea and summoning a huge tidal wave', 'boss_demon_king': 'enraged, flames erupting around',
  'boss_sky_titan': 'calling down lightning bolts', 'boss_void_emperor': 'opening a void portal',
  'boss_phoenix': 'spreading flaming wings and diving', 'boss_swamp_behemoth': 'slamming the ground causing a mud quake',
  'boss_fallen_knight': 'raising the dark sword and charging forward', 'mid_kraken': 'tentacles slamming down from all sides',
  'hard_megalodon': 'charging forward with jaws wide open', 'mid_hydra': 'all heads roaring and spitting',
}
BOSSES6 = ['boss_spectral_queen', 'boss_rotting_dryad', 'boss_magma_colossus', 'boss_frost_wyrm', 'boss_obsidian_tyrant', 'boss_crypt_archlich']
FLOATERS = {'boss_spectral_queen', 'boss_crypt_archlich', 'boss_frost_wyrm'}
MONSTERS = ['slime', 'goblin', 'boar', 'mushroom', 'wolf', 'bat', 'skeleton', 'goblin_shaman', 'slime_blue', 'mandrake',
            'skeleton_archer', 'scorpion', 'mummy', 'wraith', 'yeti', 'imp', 'harpy', 'lizardman', 'ogre', 'toad']


def view_of(key):
    for a in ('walk', 'float', 'fly', 'swim', 'attack'):
        p = os.path.join(ANIM, f'{key}_{a}', 'f0.png')
        if os.path.exists(p): return Image.open(p).convert('RGBA')
    ref = os.path.join(ANIM, '_ref', f'{key}.png')
    if os.path.exists(ref): return Image.open(ref).convert('RGBA')  # sprite fait main : vue de référence
    sheet = Image.open(os.path.join(SRC, f'{key}.png')).convert('RGBA')
    return sheet.crop((7 * 64, 0, 8 * 64, 64))


def gen(key, name, seed=5):
    view = view_of(key)
    out = os.path.join(ANIM, f'{key}_{name}')
    d = SKILL.get(key, DESC['skill']) if name == 'skill' else DESC[name]
    body = {'first_frame': b64(view), 'last_frame': b64(view), 'frame_count': FRAMES[name], 'seed': seed,
            'no_background': True, 'description': d, 'direction': 'east' if key.startswith('ally') else 'west', 'view': 'side'}
    if name == 'death': body.pop('last_frame')
    imgs = wait(call('POST', '/animate-pixminimax', body))['images']
    shutil.rmtree(out, ignore_errors=True); os.makedirs(out)
    for i, im in enumerate(imgs):
        to_img(im).resize(view.size, Image.NEAREST).save(os.path.join(out, f'f{i}.png'))
    return len(imgs)


def jobs(lot):
    if lot == 'bosses6':
        return [(k, a) for k in BOSSES6 for a in ('float' if k in FLOATERS else 'walk', 'attack', 'hurt', 'death', 'skill', 'telegraph')]
    if lot == 'lich':
        return [('boss_crypt_archlich', a) for a in ('float', 'attack', 'hurt', 'death', 'skill', 'telegraph')]
    if lot == 'knight':
        return [('boss_fallen_knight', a) for a in ('hurt', 'death')]
    if lot == 'bosses':
        keys = sorted({n.rpartition('_')[0] for n in os.listdir(ANIM) if n.split('_')[0] in ('boss', 'mid', 'hard', 'mini')})
        return [(k, a) for k in keys for a in ('skill', 'telegraph')]
    if lot == 'monsters':
        return [(k, a) for k in MONSTERS for a in ('hurt', 'attack2') if not os.path.isdir(os.path.join(ANIM, f'{k}_{a}'))]
    raise SystemExit(f'lot inconnu : {lot}')


def run(job):
    k, a = job
    try: return f'{k} {a} {gen(k, a)}'
    except Exception as e: return f'{k} {a} ERREUR {str(e)[:120]}'  # noqa: BLE001


if __name__ == '__main__':
    lot = sys.argv[1]
    js = jobs(lot)
    with ThreadPoolExecutor(4) as ex:
        for msg in ex.map(run, js): print(msg, flush=True)
