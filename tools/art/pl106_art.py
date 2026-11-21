"""v10.6 : illustrations PixelLab de l'écran de jeu (quêtes, événements, Prime du Héraut), de l'événement Marché des
Lueurs, de l'équipement (icônes d'objets 64 px) et des améliorations / tri du coffre. Liste : docs/prompt-v10.6/pixellab.

  python3 -I tools/art/pl106_art.py balance          générations restantes
  python3 -I tools/art/pl106_art.py gen [nom…]       génère les images manquantes (ou celles nommées) → tools/art/pixellab106/<nom>.png
  python3 -I tools/art/pl106_art.py install          réduit à 64 teintes, agrandit au pixel près → assets/ui/art106/<nom>.png
  python3 -I tools/art/pl106_art.py preview          planche de contrôle → tools/art/preview_art106.png

Chaque entrée : taille d'art (w, h) générée par /create-image-pixflux, puis facteur d'agrandissement entier à l'installation
(ex. l'affiche 1100 × 260 est générée en 367 × 87 puis agrandie ×3, pour garder de vrais pixels). Clé : PIXELLAB_API_KEY,
jamais affichée ni écrite.
"""
import json
import os
import sys
import time
import urllib.error
from concurrent.futures import ThreadPoolExecutor

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
RAW = os.path.join(HERE, 'pixellab106')
DST = os.path.join(ROOT, 'assets', 'ui', 'art106')
STYLE = ', 16-bit fantasy RPG pixel art, one pixel dark outline, light from the top left, rich warm colors'

# nom: (prompt, (w, h) générés, agrandissement, fond transparent)
SPECS = {}


def add(name, prompt, size, scale=1, transparent=True):
    SPECS[name] = (prompt, size, scale, transparent)


# --- P0 écran de jeu -----------------------------------------------------------------------------------------------
for n, p in {
    'hud_event_market': 'a glowing paper lantern market stall at night, festive, round icon composition',
    'hud_event_rift': 'a swirling purple void rift with a crack of light, round icon composition',
    'hud_event_wheel': 'a golden fortune wheel with colorful segments and a star pointer',
    'hud_event_arena': 'a small colosseum gate with crossed swords above it',
    'hud_event_daily_chest': 'a red and gold daily gift chest with a ribbon, sparkles',
    'hud_event_pass': 'a rolled royal scroll with a wax seal and a laurel',
    'hud_event_bastion': 'a small stone fortress tower with a red roof and a banner, round icon composition',
    'hud_event_bounty': 'a wanted poster pinned with a dagger, a skull drawn on it, round icon composition',
}.items():
    add(n, p, (96, 96))
WORLDS = ['green grassy plains with a small village', 'a dark misty forest with tall pines', 'a crystal cave with glowing blue crystals',
          'a burning desert with dunes and a ruined pillar', 'frozen snowy mountains', 'cursed wasteland with dead trees and a purple sky',
          'a putrid green swamp with twisted roots', 'floating sky islands above clouds', 'the heart of a volcano with lava rivers',
          'a void realm with dark purple stars', 'a sunken underwater kingdom with coral ruins', 'an abyssal dark throne room deep underwater']
for i, w in enumerate(WORLDS, 1):
    add(f'hud_quest_chapter_{i}', f'one small landscape vignette: {w}, round frame', (64, 64))
add('hud_bounty_frame', 'a wanted poster wooden board with nails, torn parchment, empty center, horizontal', (210, 56), 2)
add('hud_bounty_stamp', 'a red wax stamp with a skull', (64, 64))
add('fx_quest_done', 'golden burst with small stars, radial sparkle explosion', (64, 64))
add('fx_reward_fly', 'a small golden sparkle star', (32, 32))
add('fx_hot_glow', 'soft glowing golden ring, empty center', (96, 96))

# --- P0 événement Marché des Lueurs ---------------------------------------------------------------------------------
add('event_lights_key', 'a night festival market with hundreds of floating paper lanterns, a fairy hovering in the center, warm magical light, wide panorama',
    (368, 88), 3, False)
add('event_lights_currency', 'a small glowing pink lantern flame drop', (48, 48))
add('event_lights_node', 'an unlit paper lantern, dark, hanging', (64, 64))
add('event_lights_node_done', 'a lit paper lantern glowing warm orange, hanging', (64, 64))
add('event_lights_path', 'a winding stone path through a lantern-lit street at night, seen from above, wide panorama', (368, 64), 3, False)
add('event_lights_prize', 'the grand prize: a fairy companion bust with lantern light, ornate golden frame', (128, 128), 2)
for n, p in {'tickets': 'a bundle of red summon tickets', 'chest': 'an epic purple and gold treasure chest', 'essence': 'a pile of pink magic essence drops',
             'skin': 'a golden token with a fairy wing emblem', 'keys': 'a bundle of three golden keys on a ring', 'shards': 'a small leather bag of blue crystal shards'}.items():
    add(f'event_lights_shop_{n}', f'event shop item: {p}, with a small paper lantern accent', (64, 64))
for n, p in {'monsters': 'crossed swords over a slain monster skull', 'bosses': 'a horned boss skull with a crown', 'dungeon': 'a dungeon wooden door in a stone arch',
             'summons': 'a glowing golden summoning circle', 'tower': 'a tall stone tower reaching the clouds', 'arena': 'a golden arena trophy cup'}.items():
    add(f'event_lights_mission_{n}', f'mission picture: {p}, with a small paper lantern accent', (64, 64))

# --- P1 équipement --------------------------------------------------------------------------------------------------
ITEMS = {
    'weapon_sword': "a knight's straight longsword, steel blade, leather grip, gold crossguard, diagonal",
    'weapon_greatsword': 'a huge two-handed greatsword, wide heavy blade, diagonal',
    'weapon_dagger': 'a short curved dagger, dark leather handle, diagonal',
    'weapon_katar': 'a punch dagger katar with an H-shaped grip',
    'weapon_axe': 'a one-handed battle axe with a crescent blade',
    'weapon_whip': 'a coiled leather whip with a metal tip',
    'weapon_bow': 'a short wooden recurve bow with a string',
    'weapon_longbow': 'a tall elven longbow with leaf carvings',
    'weapon_crossbow': 'a wooden crossbow with a loaded bolt',
    'weapon_spear': 'a long spear with a leaf-shaped steel head, diagonal',
    'weapon_halberd': 'a halberd with an axe blade and a spike, diagonal',
    'weapon_mace': 'a flanged steel mace',
    'weapon_hammer': 'a heavy holy war hammer with gold trim',
    'weapon_staff': 'a wooden fire mage staff topped with a glowing orange crystal',
    'weapon_wand': 'a short lightning wand with a blue crystal tip and sparks',
    'weapon_scepter': 'a royal storm scepter with a gold orb',
    'weapon_scythe': 'a necromancer scythe with a dark curved blade and a purple glow',
    'helmet_helm': 'a closed knight helmet with a visor',
    'helmet_horned': 'a viking helmet with two horns',
    'helmet_hood': 'a dark cloth hood with a shadowed opening',
    'helmet_circlet': 'a thin gold circlet with a small gem',
    'helmet_default': 'a simple leather cap',
    'armor_plate': 'a steel plate chestpiece with shoulder guards',
    'armor_mail': 'a chainmail shirt',
    'armor_robe': 'a mage robe with embroidered runes',
    'armor_tunic': 'a crusader tabard over light armor',
    'amulet_pendant': 'a silver pendant necklace with a blue gem',
    'amulet_ruby': 'a gold necklace with a large ruby',
    'ring_band': 'a plain gold ring',
    'ring_signet': 'a signet ring with a purple amethyst',
    'bracelet_cuff': 'a wide engraved metal bracer',
    'bracelet_thorn': 'a bracelet made of thorny silver vines',
}
for n, p in ITEMS.items():
    add(f'item_{n}', p, (64, 64))
for n, c in {'common': 'grey', 'uncommon': 'green', 'rare': 'blue', 'epic': 'purple', 'legendary': 'gold', 'mythic': 'red'}.items():
    add(f'frame_{n}', f'an ornate square item frame for a fantasy game inventory, {c} metal corners and a soft inner glow, empty center', (96, 96))
for n, p in {'weapon': 'sword', 'helmet': 'helmet', 'armor': 'chestplate', 'amulet': 'necklace', 'ring': 'ring', 'bracelet': 'bracer'}.items():
    add(f'slot_empty_{n}', f'a faint engraved silhouette of a {p} on dark stone, ghostly, low contrast', (64, 64))
add('verdict_up', 'a bold green arrow pointing up with a sparkle', (32, 32))
add('verdict_down', 'a bold red arrow pointing down', (32, 32))

# --- P1 améliorations et tri du coffre ------------------------------------------------------------------------------
add('group_strike', 'wide header strip: crossed swords with a red slash effect, dark red gradient, room on the left for a title', (180, 32), 2, False)
add('group_endure', 'wide header strip: a glowing heart behind a shield, dark green gradient, room on the left for a title', (180, 32), 2, False)
add('group_earn', 'wide header strip: coins and an open treasure chest, dark gold gradient, room on the left for a title', (180, 32), 2, False)
add('badge_best_buy', 'a golden star medal with a ribbon, shining', (64, 64))
add('sort_keep', 'a hand placing an item into a backpack, green check', (48, 48))
add('sort_store', 'a wooden storage chest with a lock', (48, 48))
add('sort_recycle', 'an item breaking into blue crystal shards', (48, 48))
add('banner_loot', 'an open treasure chest spilling weapons, armor and coins, sparkles', (320, 60), 2, False)


def gen_one(name):
    from pl939_api import call, images_of, wait
    prompt, (w, h), _, transparent = SPECS[name]
    body = {'description': prompt + STYLE + (', transparent background' if transparent else ''),
            'image_size': {'width': w, 'height': h}, 'no_background': transparent, 'seed': 106,
            'outline': 'single color black outline', 'shading': 'medium shading', 'detail': 'highly detailed'}
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
    for name, (_, _, scale, _) in SPECS.items():
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
    print(f'{n} images → assets/ui/art106')


def preview():
    names = [n for n in SPECS if os.path.exists(os.path.join(RAW, f'{n}.png'))]
    cell, cols = 104, 12
    sheet = Image.new('RGBA', (cols * cell, ((len(names) + cols - 1) // cols) * cell), (40, 24, 40, 255))
    for i, n in enumerate(names):
        im = Image.open(os.path.join(RAW, f'{n}.png')).convert('RGBA')
        im.thumbnail((cell - 8, cell - 8), Image.NEAREST)
        sheet.paste(im, ((i % cols) * cell + 4, (i // cols) * cell + 4), im)
    sheet.save(os.path.join(HERE, 'preview_art106.png'))
    print(f'{len(names)} images sur la planche')


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'install'
    if cmd == 'balance':
        from pl939_api import call
        print(call('GET', '/balance'))
    elif cmd == 'gen':
        names = sys.argv[2:] or [n for n in SPECS if not os.path.exists(os.path.join(RAW, f'{n}.png'))]
        with ThreadPoolExecutor(3) as ex:
            for m in ex.map(gen_one, names):
                print(m, flush=True)
    elif cmd == 'install':
        install()
    elif cmd == 'preview':
        preview()
