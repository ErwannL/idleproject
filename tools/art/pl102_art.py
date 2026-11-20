"""v10.2 : illustrations (pixel art 16 bits, contour sombre d'un pixel, lumière en haut à gauche).
  - gardiens de l'Arène (guardian_0..3), images des règles d'étage (rule_*), fond de l'arène (arena_bg, 640×360) ;
  - portes de salles 96×128 (door_*), une illustration par bénédiction (boon_*) ;
  - portraits de boss de donjon 256×256 (boss_*) depuis le sprite de combat (image de départ, palette verrouillée) ;
  - carte de la mission de la semaine, coffre de palier, coffre de butin de la scène.
Sorties : tools/art/pixellab102/<nom>.png ; --install → assets/ui/art102/<nom>.png
Usage : PIXELLAB_API_KEY=… python3 tools/art/pl102_art.py [noms…] | --install"""
import os, shutil, sys
from concurrent.futures import ThreadPoolExecutor
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pl939_api import b64, call, images_of, wait  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(HERE, 'pixellab102'); DST = os.path.join(ROOT, 'assets', 'ui', 'art102')
STYLE = ', 16-bit fantasy RPG pixel art, one pixel dark outline, light from the top left, rich warm colors'
T = STYLE + ', transparent background'
ART = {
    'guardian_0': ((128, 128), 'a huge bronze armored guardian knight with a tower shield and a halberd, full body, imposing', True),
    'guardian_1': ((128, 128), 'a tall silver armored guardian woman with wings on her helmet and a glowing silver spear, full body', True),
    'guardian_2': ((128, 128), 'a massive golden armored guardian golem knight with a giant golden hammer, full body', True),
    'guardian_3': ((128, 128), 'a cosmic guardian of the summit, dark armor with starry cape and a crown of light, full body', True),
    'rule_armored': ((64, 64), 'a heavy steel shield with rivets, icon', True),
    'rule_swift': ((64, 64), 'a winged boot with speed lines, icon', True),
    'rule_noheal': ((64, 64), 'a broken green healing potion bottle, icon', True),
    'rule_frenzy': ((64, 64), 'a red angry demon face with flames, icon', True),
    'rule_first': ((64, 64), 'a dagger striking from a dark bush, ambush, icon', True),
    'rule_backline': ((64, 64), 'arrows flying over a wall toward archers, icon', True),
    'arena_bg': ((320, 180), 'inside a grand colosseum arena, sand floor, stone tiers full of crowd banners, torches, wide view', False),
    'door_combat': ((48, 64), 'a heavy wooden dungeon door with crossed swords painted on it, stone frame', True),
    'door_elite': ((48, 64), 'a dark iron dungeon door with a red skull emblem and spikes, stone frame', True),
    'door_treasure': ((48, 64), 'a golden dungeon door with gems and a keyhole, glowing light under it, stone frame', True),
    'door_altar': ((48, 64), 'a white marble arch door with a glowing blue rune, holy light, stone frame', True),
    'door_rest': ((48, 64), 'a cozy green wooden door with a lantern and a small campfire symbol, stone frame', True),
    'boon_blade': ((64, 64), 'a glowing sharpened sword with sparks, blessing', True),
    'boon_stone': ((64, 64), 'a stone skin golem fist, protection blessing', True),
    'boon_element': ((64, 64), 'five elemental orbs fire water leaf light dark circling, blessing', True),
    'boon_healers': ((64, 64), 'a green healing heart with leaves and light, blessing', True),
    'boon_hunter': ((64, 64), 'a falcon eye with a crosshair, critical hit blessing', True),
    'boon_wind': ((64, 64), 'a swirl of wind with feathers, speed blessing', True),
    'boon_bane': ((64, 64), 'a horned boss skull pierced by a holy spear, blessing', True),
    'boon_guardians': ((64, 64), 'a radiant tower shield with wings, armor blessing', True),
    'boon_altar': ((64, 64), 'a glowing stone altar with a blue flame, blessing', True),
    'mission_week': ((160, 96), 'a large illustrated quest scroll with a red wax seal, a map and a sword, weekly mission', True),
    'tier_chest': ((64, 64), 'an ornate treasure chest with golden trim and a ribbon, reward', True),
    'loot_chest': ((64, 64), 'a sturdy fantasy wooden treasure chest with iron bands and gold corners, slightly open with gold glow inside, side view', True),
    'loot_chest_open': ((64, 64), 'a fantasy wooden treasure chest wide open overflowing with gold coins and gems, glowing, side view', True),
}
BOSS = {'boss_spectral_queen': 'Reine spectrale', 'boss_rotting_dryad': 'Dryade pourrissante', 'boss_magma_colossus': 'Colosse de magma',
        'boss_frost_wyrm': 'Wyrm de givre', 'boss_obsidian_tyrant': "Tyran d'obsidienne"}


def gen(name):
    try:
        if name in BOSS:
            src = Image.open(os.path.join(ROOT, 'assets', 'sprites', f'{name}.png')).convert('RGBA')
            src = src.crop(src.getbbox())
            k = max(1, min(128 // src.width, 128 // src.height))
            big = src.resize((src.width * k, src.height * k), Image.NEAREST)
            init = Image.new('RGBA', (128, 128), (0, 0, 0, 0)); init.alpha_composite(big, ((128 - big.width) // 2, 128 - big.height))
            body = {'description': f'the exact same monster boss as the reference, full body portrait, same colors, more detailed' + T, 'image_size': {'width': 128, 'height': 128},
                    'no_background': True, 'init_image': b64(init), 'init_image_strength': 600, 'color_image': b64(init), 'seed': 3,
                    'outline': 'single color black outline', 'shading': 'medium shading', 'detail': 'highly detailed'}
            im = images_of(wait(call('POST', '/create-image-bitforge', body)))[0]
        else:
            size, desc, transp = ART[name]
            body = {'description': desc + (T if transp else STYLE), 'image_size': {'width': size[0], 'height': size[1]}, 'no_background': transp, 'seed': 11,
                    'outline': 'single color black outline', 'shading': 'medium shading', 'detail': 'highly detailed'}
            im = images_of(wait(call('POST', '/create-image-pixflux', body)))[0]
        os.makedirs(OUT, exist_ok=True); im.save(os.path.join(OUT, f'{name}.png')); return f'{name} ok'
    except Exception as e:  # noqa: BLE001
        return f'{name} ERREUR {str(e)[:160]}'


def install():
    os.makedirs(DST, exist_ok=True)
    for f in os.listdir(OUT):
        if not f.endswith('.png'): continue
        im = Image.open(os.path.join(OUT, f)).convert('RGBA')
        name = f[:-4]
        # Agrandissement entier (jamais lissé) : ×2 (portraits de boss ×2 → 256 ; portes ×2 → 96×128 ; fond ×2 → 640×360).
        k = 2
        im.resize((im.width * k, im.height * k), Image.NEAREST).save(os.path.join(DST, f))
    print('installé')


if __name__ == '__main__':
    if '--install' in sys.argv: install(); sys.exit(0)
    names = sys.argv[1:] or [n for n in [*ART, *BOSS] if not os.path.exists(os.path.join(OUT, f'{n}.png'))]
    with ThreadPoolExecutor(6) as ex:
        for m in ex.map(gen, names): print(m, flush=True)
