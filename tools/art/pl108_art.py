"""v10.8 : illustrations PixelLab — raretés (cadres Astral et Ascendant, Larme d'Ascendrya), Âges du Bastion (6 bâtiments
sur 3 niveaux, carte du village par âge), recherches des paliers II à V (18 médaillons) et 6 nœuds clés. Même style
qu'art104 (tools/art/pl104_bastion.py).

  python3 -I tools/art/pl108_art.py gen [nom…]   → tools/art/pixellab108/<nom>.png
  python3 -I tools/art/pl108_art.py install       → assets/ui/art108/<nom>.png (64 teintes, agrandi au pixel près)
Clé : PIXELLAB_API_KEY (jamais affichée ni écrite).
"""
import os
import sys
import time
import urllib.error
from concurrent.futures import ThreadPoolExecutor

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
RAW = os.path.join(HERE, 'pixellab108')
DST = os.path.join(ROOT, 'assets', 'ui', 'art108')
STYLE = ', 16-bit fantasy RPG pixel art, one pixel dark outline, light from the top left, rich warm colors, crisp pixels, no text'
VIEW = 'single building seen from a high three-quarter top-down view, standing on a small square patch of grass and cobblestones, '
SPECS = {}


def add(name, prompt, size, scale=1, transparent=True, seed=108):
    SPECS[name] = (prompt, size, scale, transparent, seed)


# Raretés
add('frame_astral', 'an ornate square item frame for a fantasy game inventory, cyan crystal and silver corners with tiny stars and a soft cyan inner glow, empty center', (96, 96))
add('frame_ascendant', 'an ornate square item frame for a fantasy game inventory, rainbow prismatic gold corners with radiant light rays, empty center', (96, 96))
add('tear_ascendrya', 'a single glowing teardrop shaped gem, prismatic rainbow light inside, tiny sparkles, icon', (48, 48))
# Âges du Bastion : bâtiments (niveau 1, 2, 3 = début, milieu, fin de l'âge)
BUILD = {
    'enchant': ('a small arcane enchanting workshop with a glowing purple rune circle on the floor, crystal lamps and a stone altar',
                'a larger enchanting tower with floating purple runes and crystals around a big altar',
                'a grand arcane enchanting sanctum with a dome of violet glass, floating runic rings and huge crystals'),
    'menagerie': ('a small wooden animal menagerie with a fenced pen, a little barn and a feeding trough, a tiny fox and a bird',
                  'a larger menagerie with stables, a pond, cages with small magical creatures',
                  'a grand magical menagerie with a glass greenhouse, a pond with a turtle, a phoenix perch and many creatures'),
    'observatory': ('a small stone observatory tower with a brass telescope on top',
                    'a taller observatory with a domed roof opening to the sky and a big brass telescope',
                    'a grand celestial observatory with a golden dome, star charts and floating glowing orbs'),
    'runes': ('a small stone shrine with a few glowing blue runestones in a circle',
              'a larger rune sanctuary with tall standing stones carved with glowing runes',
              'a grand rune temple with a ring of huge glowing monoliths and a floating rune above'),
    'ascension': ('a small white marble workshop with a golden anvil glowing with prismatic light',
                  'a larger ascension forge of white marble and gold with prismatic flames',
                  'a grand radiant ascension cathedral forge of white marble and gold with a rainbow beam of light rising from it'),
    'wonder': ('a magical festival lighthouse covered with floating paper lanterns, glowing warmly, base level',
               'a taller lantern lighthouse wonder with many floating pink and orange lanterns',
               'a giant glowing lantern lighthouse wonder at night with hundreds of floating lanterns and a fairy light on top'),
}
for b, levels in BUILD.items():
    for i, d in enumerate(levels, 1):
        add(f'bastion_{b}_lv{i}', VIEW + d, (128, 128), 1, True, 200 + i + len(b))
# Carte du village : une par âge (la cour grandit, remparts, couleur)
MAPS = [
    'a small fortified village courtyard inside wooden palisades, green grass, dirt paths, six empty building plots, morning light',
    'a fortified citadel courtyard inside stone ramparts with towers, cobblestone paths, eight empty building plots, banners',
    'a high walled city plateau with white stone ramparts, gardens, bridges, ten empty building plots, sunset light',
    'a royal crowned city courtyard with golden ramparts, a palace in the background, twelve empty plots, festive banners',
    'a wondrous magical city at night with floating lanterns above golden ramparts, a big central plaza for a wonder',
]
for i, d in enumerate(MAPS, 1):
    add(f'bastion_map_age{i}', 'detailed high three-quarter top-down view of ' + d, (384, 216), 1, False, 300 + i)
# Recherches des paliers II à V : un médaillon par type de nœud (partagé entre les paliers)
NODES = {
    'fury': 'a flaming sword surrounded by a red aura, fury', 'bulwark': 'a heavy steel tower shield with a glowing heart',
    'riftbane': 'a sword cutting through a purple void rift', 'mythforge': 'a red mythic gem on a small anvil with sparks',
    'critedge': 'a jagged critical slash mark in bright red light', 'living': 'a small fortress with a beating golden heart',
    'pack': 'three companion silhouettes under a blue banner with a star', 'essence': 'a glowing green essence flask with leaves',
    'runecraft': 'a glowing blue runestone in a hand', 'swift': 'a winged boot with a blue lightning trail',
    'mentor': 'an old mentor with a staff teaching a young hero', 'workers': 'golden hammer and pickaxe crossed over a gear',
    'treasury': 'a royal treasury chest overflowing with gold and gems', 'alchemy': 'a bubbling alchemy cauldron turning items into gold',
    'dreams': 'a sleeping moon with stars and a small hourglass', 'caravan': 'a merchant caravan with camels on a desert road',
    'scholar': 'an open glowing tome with orbiting runes', 'fortune': 'a golden four leaf clover with a coin',
}
for n, d in NODES.items():
    add(f'rs_{n}', f'a round carved medallion icon: {d}, ornate golden rim', (64, 64))
KEYS = {
    'key_hand': 'a radiant golden hand of light casting three magic orbs, legendary keystone',
    'key_caravan': 'a golden caravan wagon full of treasure and weapons, legendary keystone',
    'key_vigil': 'an eternal blue flame candle with a moon halo, legendary keystone',
    'key_fate': 'a mystic eye of destiny inside a golden triangle, legendary keystone',
    'key_menagerie': 'a golden heart with a small dragon and a fox curled around it, legendary keystone',
    'key_market': 'a hooded black market merchant holding a glowing red gem, legendary keystone',
}
for n, d in KEYS.items():
    add(n, f'a round ornate golden medallion icon: {d}, bright gold glow', (64, 64))


def gen_one(name):
    from pl939_api import call, images_of, wait
    prompt, (w, h), _, transparent, seed = SPECS[name]
    body = {'description': prompt + STYLE + (', transparent background, centered' if transparent else ''), 'image_size': {'width': w, 'height': h},
            'no_background': transparent, 'seed': seed, 'outline': 'single color black outline', 'shading': 'medium shading', 'detail': 'highly detailed'}
    for essai in range(8):
        try:
            im = images_of(wait(call('POST', '/create-image-pixflux', body)))[0]
            os.makedirs(RAW, exist_ok=True)
            im.save(os.path.join(RAW, f'{name}.png'))
            return f'{name} ok'
        except urllib.error.HTTPError as e:
            if e.code != 429 or essai == 7:
                return f'{name} ERREUR HTTP {e.code} {e.read()[:200]!r}'
            time.sleep(15 * (essai + 1))
        except Exception as e:  # noqa: BLE001
            return f'{name} ERREUR {str(e)[:200]}'


def install():
    os.makedirs(DST, exist_ok=True)
    n = 0
    for name, (_, _, scale, _, _) in SPECS.items():
        src = os.path.join(RAW, f'{name}.png')
        if not os.path.exists(src):
            continue
        im = Image.open(src).convert('RGBA')
        q = im.convert('RGB').quantize(colors=64, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGBA')
        q.putalpha(im.getchannel('A'))
        if scale > 1:
            q = q.resize((q.width * scale, q.height * scale), Image.NEAREST)
        q.save(os.path.join(DST, f'{name}.png'), optimize=True)
        n += 1
    print(f'{n} images → assets/ui/art108')


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'install'
    if cmd == 'gen':
        names = sys.argv[2:] or [n for n in SPECS if not os.path.exists(os.path.join(RAW, f'{n}.png'))]
        with ThreadPoolExecutor(3) as ex:
            for m in ex.map(gen_one, names):
                print(m, flush=True)
    else:
        install()
