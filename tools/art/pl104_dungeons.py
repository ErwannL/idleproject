"""v10.4 (partie 4) : illustrations des donjons avec PixelLab (pixel art 16 bits, contour sombre d'un pixel, lumière en haut à gauche).
  - gen   : génère les images brutes dans tools/art/pixellab104/dungeons/<nom>.png (et note le prompt dans prompts.json) ;
  - build : copie les images brutes dans assets/ui/art104/ (tailles entières, jamais lissées).
Clé : variable d'environnement PIXELLAB_API_KEY (jamais affichée). Budget : 60 générations au plus.
Usage : python3 tools/art/pl104_dungeons.py gen [noms… | --seed+N] | build | balance"""
import json, os, sys
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pl939_api import call, images_of, wait  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
RAW = os.path.join(HERE, 'pixellab104', 'dungeons'); DST = os.path.join(ROOT, 'assets', 'ui', 'art104')
STYLE = ', 16-bit fantasy RPG pixel art, one pixel dark outline, light from the top left, rich warm colors'
T = STYLE + ', transparent background'
# nom : (taille, description, fond transparent, graine)
ART = {
    'dungeon_mech_summoner': (64, 'a pale blue ghost queen raising her hands, two small ghost servants floating beside her, glowing summoning circle, icon', True, 5),
    'dungeon_mech_armored': (64, 'a heavy steel shell armor plate with rivets and a big crack, flying metal shards, icon', True, 5),
    'dungeon_mech_escalate': (64, 'a roaring furnace fire, three flames growing bigger from left to right, orange and yellow, icon', True, 5),
    'dungeon_mech_desperate': (64, 'an enraged glowing red angry eye above a cracked broken heart, red aura, icon', True, 5),
    'dungeon_mech_plain': (64, 'two crossed swords in front of a small round shield, duel icon', True, 5),
    'dungeon_diff_easy': (96, 'difficulty card art: one small white bone skull on a mossy stone slab, green glow, dark dungeon background', False, 7),
    'dungeon_diff_normal': (96, 'difficulty card art: a pile of exactly three white bone skulls (one big in front, two behind) on a small isometric blue ice stone slab, blue glow, black background', False, 10),
    'dungeon_diff_hard': (96, 'difficulty card art: five fierce horned skulls surrounded by red flames on black cracked stone, red glow, dark background', False, 7),
    'dungeon_diff_lock': (64, 'a golden padlock with iron chains, icon', True, 5),
    'dungeon_rw_firstclear': (64, 'a big ornate golden treasure chest overflowing with gems, a glowing gold star above, reward icon', True, 5),
    'dungeon_rw_set': (64, 'a glowing golden set armor chest plate with a gem emblem, rare equipment piece, icon', True, 5),
}


def gen(name, seed_add=0):
    size, desc, transp, seed = ART[name]
    try:
        body = {'description': desc + (T if transp else STYLE), 'image_size': {'width': size, 'height': size}, 'no_background': transp, 'seed': seed + seed_add,
                'outline': 'single color black outline', 'shading': 'medium shading', 'detail': 'highly detailed'}
        im = images_of(wait(call('POST', '/create-image-pixflux', body)))[0]
        os.makedirs(RAW, exist_ok=True); im.save(os.path.join(RAW, f'{name}.png'))
        p = os.path.join(RAW, 'prompts.json'); data = json.load(open(p)) if os.path.exists(p) else {}
        data[name] = {'description': desc, 'size': size, 'transparent': transp, 'seed': seed + seed_add}
        json.dump(data, open(p, 'w'), indent=1, ensure_ascii=False)
        return f'{name} ok'
    except Exception as e:  # noqa: BLE001
        return f'{name} ERREUR {str(e)[:160]}'


def build():
    from PIL import Image
    os.makedirs(DST, exist_ok=True)
    for f in sorted(os.listdir(RAW)):
        if f.endswith('.png'):
            Image.open(os.path.join(RAW, f)).convert('RGBA').save(os.path.join(DST, f))
    print('installé dans', DST)


def balance():
    print(call('GET', '/balance')['subscription']['generations'])


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'gen'
    if cmd == 'build': build(); sys.exit(0)
    if cmd == 'balance': balance(); sys.exit(0)
    args = [a for a in sys.argv[2:] if not a.startswith('--')]
    add = 0
    for a in sys.argv[2:]:
        if a.startswith('--seed+'): add = int(a[7:])
    names = args or [n for n in ART if not os.path.exists(os.path.join(RAW, f'{n}.png'))]
    with ThreadPoolExecutor(6) as ex:
        for m in ex.map(lambda n: gen(n, add), names): print(m, flush=True)
