"""v9.8 (J3, I5, 0.6) : illustrations fantasy pixel art (style des Légendaires) chargées à la demande.
Sorties : assets/ui/art98/<nom>.png. Usage : python3 tools/art/pl98_art.py [nom…]"""
import os, sys
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pl939_api import call, wait, images_of

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'assets', 'ui', 'art98')
STYLE = 'crisp pixel art, vibrant saturated fantasy colors, rim lighting, soft magical glow, anime-inspired fantasy game art'
HERO = 'young knight hero with blue plume helmet, silver armor with blue cape'
ART = {
  # Prologue : l'entité qui offre la seconde vie (remplace la forme lumineuse).
  'entity': ('ethereal goddess of rebirth floating, long flowing white and gold robes, glowing halo, phoenix feather wings of light, serene face, full body, transparent background', 128, 160),
  # Classes du héros : en pied, avec l'arme et un effet de l'élément.
  'class_knight': (f'{HERO}, sword and round shield, holy light sparks, full body heroic pose, transparent background', 112, 112),
  'class_archer': ('young elven archer hero, green hooded cloak, drawing a glowing bow, wind leaves, full body, transparent background', 112, 112),
  'class_pyromancer': ('young fire mage hero, red and gold robes, staff with burning orb, flames swirling, full body, transparent background', 112, 112),
  'class_berserker': ('young berserker hero with white hair, fur shoulders, huge two-handed axe, red rage aura, full body, transparent background', 112, 112),
  'class_lancer': ('young lancer hero, blue and silver armor, long spear, water splashes, full body, transparent background', 112, 112),
  'class_paladin': ('young paladin hero, white and gold plate armor, warhammer, radiant golden light, full body, transparent background', 112, 112),
  'class_assassin': ('young assassin hero, dark purple hood and scarf, twin daggers, violet smoke, full body, transparent background', 112, 112),
  'class_crossbowman': ('young hunter hero holding a heavy mechanical crossbow aimed forward with both hands (no bow), brown leather and teal coat, glowing bolt loaded, full body, transparent background', 112, 112),
  'class_stormcaller': ('young storm mage hero, blue and white robes, scepter crackling with lightning, full body, transparent background', 112, 112),
  'class_necromancer': ('young necromancer hero, black and violet robes, bone staff, green ghost wisps, full body, transparent background', 112, 112),
  # Portes des donjons.
  'door_crypt': ('ancient stone crypt door with skulls and green ghost light, fantasy dungeon entrance, transparent background', 112, 112),
  'door_sanctuary': ('overgrown forest sanctuary gate with glowing vines and flowers, fantasy dungeon entrance, transparent background', 112, 112),
  'door_furnace': ('volcanic furnace gate with molten lava and iron bars, fantasy dungeon entrance, transparent background', 112, 112),
  'door_glacier': ('frozen glacier cave gate with blue ice crystals, fantasy dungeon entrance, transparent background', 112, 112),
  'door_citadel': ('dark citadel gate with purple runes and spikes, fantasy dungeon entrance, transparent background', 112, 112),
  # Lieux et écrans.
  'forge_hall': ('dwarf blacksmith workshop, glowing red anvil, dwarf smith hammering, sparks flying, warm light, wide scene', 192, 96),
  'talent_tree': ('glowing runic tree of power with luminous branches lighting up, magical blue and gold runes, wide scene', 192, 96),
  'tower': ('tall fantasy tower of eternity seen from below, one floor glowing, starry night, wide scene', 192, 96),
  'arena': ('fantasy arena with stands, colorful banners and two facing gates, sunny day, wide scene', 192, 96),
  'guild_hall': ('fantasy guild hall with banners and a round wooden table, warm torchlight, wide scene', 192, 96),
  'expedition_map': ('treasure map with a dotted path, tiny adventurers walking, mountains and forest, parchment, wide scene', 192, 96),
  'summon_circle': ('magic summoning circle with floating crystals and a glowing card rising, purple and gold light, wide scene', 192, 96),
  'event_market': ('night market of glowing lanterns, festive stalls with colorful awnings, warm lights, wide scene', 192, 96),
  'camp_night': (f'{HERO} sleeping by a campfire under a starry sky, cozy, wide scene', 192, 96),
  'empty_chest': ('small open empty wooden chest with a fly buzzing, cute, transparent background', 80, 64),
  'phoenix_rebirth': ('majestic phoenix rising from golden flames, rebirth portal glow, transparent background', 128, 128),
}

def gen(name):
    desc, w, h = ART[name]
    try:
        body = {'description': f'{desc}, {STYLE}', 'image_size': {'width': w, 'height': h}, 'no_background': 'transparent' in desc, 'seed': 11,
                'outline': 'single color outline', 'shading': 'detailed shading', 'detail': 'highly detailed'}
        im = images_of(wait(call('POST', '/create-image-pixflux', body)))[0]
        im.save(os.path.join(OUT, f'{name}.png')); return f'{name} ok'
    except Exception as e: return f'{name} ERREUR {str(e)[:160]}'  # noqa: BLE001

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    names = sys.argv[1:] or list(ART)
    with ThreadPoolExecutor(6) as ex:
        for m in ex.map(gen, names): print(m, flush=True)
