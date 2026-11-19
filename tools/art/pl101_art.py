"""v10.1 : illustrations des écrans (pixel art du jeu, PixelLab pixflux) :
  - 3 cartes « Comment jouer » (howto_*) ;
  - une bannière par onglet qui n'en avait pas (banner_*) ;
  - une carte par donjon, décor et boss en ombre (dungeon_*) ;
  - icônes dessinées des missions et tâches (mis_*), 4 tuiles des statistiques (stat_*) ;
  - Arène : dos de cartes (card_back_*) et tuile d'accès.
Sorties : tools/art/pixellab101/<nom>.png ; installation : --install → assets/ui/art101/<nom>.png
Usage : PIXELLAB_API_KEY=… python3 tools/art/pl101_art.py [noms…] | --install"""
import os, shutil, sys
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pl939_api import call, images_of, wait  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(HERE, 'pixellab101'); DST = os.path.join(ROOT, 'assets', 'ui', 'art101')
SOFT = ', fantasy RPG pixel art, crisp pixels, warm light, rich but soft colors, dark outline accents'
TRANSP = SOFT + ', transparent background'
BAN = (320, 128)
ART = {
    # Comment jouer
    'howto_fight': ((256, 144), 'side view of a small armored knight hero slashing a green slime monster on a grassy road, a gold coin and the number popping up above'),
    'howto_gold': ((256, 144), 'a glowing anvil with a sword being upgraded, golden sparks and an upward green arrow, a pile of gold coins next to it'),
    'howto_advance': ((256, 144), 'a winding road of stage flags across hills leading to a big dark boss silhouette at a castle gate, a small knight at the start'),
    # Bannières d'onglets
    'banner_upgrades': (BAN, 'interior of a hero forge, big anvil with flying sparks, glowing hammer, weapons on the wall'),
    'banner_skills': (BAN, 'an open ancient spellbook on a lectern with glowing runes floating above it, candles'),
    'banner_companions': (BAN, 'a campfire at night with a group of adventurers sitting around it, tents and trees'),
    'banner_dungeons': (BAN, 'the entrance of a dark crypt in a cliff, stone stairs going down, torches, mist'),
    'banner_missions': (BAN, 'a wooden notice board of the town herald with many parchment quests nailed on it, banners'),
    'banner_daybook': (BAN, "an apprentice's notebook open on a wooden table with a quill, a candle and a small map"),
    'banner_boss': (BAN, 'a trophy gallery hall with mounted monster heads and boss silhouettes in shadow on the walls'),
    'banner_ranking': (BAN, 'a podium in an arena with three golden, silver and bronze hero statues, crowd banners'),
    'banner_stats': (BAN, 'an archive library room with tall shelves, scrolls and a large hourglass on a desk'),
    'banner_shop': (BAN, 'a fantasy merchant stall with potions, scrolls, gems and a striped awning'),
    'banner_looks': (BAN, 'a hero wardrobe room with armor stands, capes and helmets on display, a tall mirror'),
    'banner_forge': (BAN, 'a dwarven forge with a glowing furnace, blue crystal shards on an anvil, sparks'),
    'banner_collections': (BAN, 'a museum hall of glass cases with monster trophies, weapons and companion portraits'),
    'banner_guild': (BAN, 'a guild hall with long tables, banners with emblems and adventurers raising mugs'),
    # Donjons : décor et boss en ombre
    'dungeon_crypt': ((320, 160), 'a spectral crypt with green ghost lights and tombs, the dark silhouette of a ghost queen boss in the back'),
    'dungeon_sanctuary': ((320, 160), 'an overgrown forest sanctuary with ancient roots and glowing moss, the dark silhouette of a rotting tree dryad boss'),
    'dungeon_furnace': ((320, 160), 'a desert furnace temple with rivers of lava and sand, the dark silhouette of a huge magma colossus boss'),
    'dungeon_glacier': ((320, 160), 'an eternal glacier cave with blue ice crystals, the dark silhouette of a frost wyrm dragon boss'),
    'dungeon_citadel': ((320, 160), 'a shadow citadel with obsidian towers and purple light, the dark silhouette of an obsidian tyrant boss on a throne'),
    # Icônes des missions et tâches (64 px)
    'mis_kills': ((64, 64), 'a crossed sword and a small slime monster icon'),
    'mis_bosses': ((64, 64), 'a horned boss skull with a crown icon'),
    'mis_recycle': ((64, 64), 'an anvil turning items into blue crystal shards icon'),
    'mis_summons': ((64, 64), 'a glowing summoning circle with a scroll icon'),
    'mis_dungeons': ((64, 64), 'a dungeon door with a key icon'),
    'mis_rareLoot': ((64, 64), 'a treasure bag with a blue rare gem icon'),
    'mis_upgrades': ((64, 64), 'a hammer striking a glowing sword icon'),
    'mis_login': ((64, 64), 'a calendar page with a golden star icon'),
    'mis_gold': ((64, 64), 'a stack of gold coins icon'),
    'mis_stages': ((64, 64), 'a road with a flag icon'),
    'mis_items': ((64, 64), 'an open treasure chest with an item icon'),
    'mis_skills': ((64, 64), 'a spellbook with a glowing rune icon'),
    'mis_tower': ((64, 64), 'a tall stone tower icon'),
    'mis_arena': ((64, 64), 'two crossed cards with a sword icon, arena'),
    'mis_expeditions': ((64, 64), 'a backpack and a map icon'),
    # Statistiques
    'stat_kills': ((64, 64), 'a pile of defeated monster skulls icon'),
    'stat_bosses': ((64, 64), 'a boss crown trophy icon'),
    'stat_time': ((64, 64), 'a golden hourglass icon'),
    'stat_stage': ((64, 64), 'a victory flag on a hill icon'),
    # Arène à cartes
    'card_back_basic': ((120, 180), 'the back of a fantasy trading card, blue and silver ornate pattern with a shield emblem in the center, full card'),
    'card_back_gold': ((120, 180), 'the back of a legendary fantasy trading card, gold and crimson ornate pattern with a dragon emblem in the center, full card'),
    'arena_tile': ((320, 160), 'a grand colosseum arena with a tall tower of floors behind it, fantasy cards floating in the air'),
}


def gen(name):
    size, desc = ART[name]
    transparent = name.startswith(('mis_', 'stat_', 'card_back_'))
    try:
        body = {'description': desc + (TRANSP if transparent else SOFT), 'image_size': {'width': size[0], 'height': size[1]},
                'no_background': transparent, 'seed': 7, 'outline': 'single color outline', 'shading': 'medium shading', 'detail': 'highly detailed'}
        im = images_of(wait(call('POST', '/create-image-pixflux', body)))[0]
        os.makedirs(OUT, exist_ok=True); im.save(os.path.join(OUT, f'{name}.png')); return f'{name} ok'
    except Exception as e:  # noqa: BLE001
        return f'{name} ERREUR {str(e)[:160]}'


if __name__ == '__main__':
    if '--install' in sys.argv:
        os.makedirs(DST, exist_ok=True)
        for f in os.listdir(OUT):
            if f.endswith('.png'): shutil.copy(os.path.join(OUT, f), os.path.join(DST, f))
        print('installé'); sys.exit(0)
    names = sys.argv[1:] or [n for n in ART if not os.path.exists(os.path.join(OUT, f'{n}.png'))]
    with ThreadPoolExecutor(6) as ex:
        for m in ex.map(gen, names): print(m, flush=True)
