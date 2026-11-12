"""v9.4.0 : icônes PixelLab (améliorations, ressources, menus, onglets) — liste de docs « pixellab-a-refaire-v2.3.7 ».
Usage : python3 tools/art/pl939_icons.py [nom ...]  → tools/art/pixellab939/icons/<nom>.png (déjà là = sauté)."""
import os, sys
from concurrent.futures import ThreadPoolExecutor
from pl939_api import pixflux

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'pixellab939', 'icons')
ICON = 'pixel art game UI icon, bold readable silhouette, 1px dark outline, soft light from top-left, transparent background, fantasy RPG style, '
MENU = 'pixel art game menu button icon, bold readable silhouette, 1px dark outline, soft light from top-left, transparent background, fantasy RPG style, '
JOBS = {
  # Lot 2 : améliorations et ressources (48×48)
  'icon_damage': (ICON, 'steel sword pointing up with a red glow on the blade', 48),
  'icon_bolt': (ICON, 'big bright yellow zigzag lightning bolt in front of a small silver sword, electric sparks', 48),
  'icon_crit': (ICON, 'red bullseye target hit by a small dagger with a star spark', 48),
  'icon_critdmg': (ICON, 'sword blade shattering a crystal with an orange explosion burst', 48),
  'icon_double': (ICON, 'two shiny steel swords slashing side by side, white motion arcs, colorful golden hilts', 48),
  'icon_boss': (ICON, 'horned demon skull crown pierced by a golden sword', 48),
  'icon_bond': (ICON, 'two crossed swords tied with a glowing blue ribbon', 48),
  'icon_heart': (ICON, 'big red heart with a shine highlight', 48),
  'icon_defense': (ICON, 'sturdy steel kite shield with a golden cross emblem', 48),
  'icon_regen': (ICON, 'green heart with a white plus sign and small rising sparkles', 48),
  'icon_lifesteal': (ICON, 'red blood drop flowing into a small heart', 48),
  'icon_dodge': (ICON, 'blue feather with wind swoosh lines', 48),
  'icon_gold': (ICON, 'small stack of shiny gold coins with one coin on top', 48),
  'icon_xp': (ICON, 'open glowing blue spellbook with sparkles', 48),
  'icon_grimoire': (ICON, 'red leather combat book with a crossed-swords emblem', 48),
  'icon_ascension': (ICON, 'violet crystal stone with an upward arrow glowing inside', 48),
  'icon_mastery': (ICON, 'small glass vial with swirling golden essence', 48),
  # Lot 3 : menus (64×64) et boutons du haut
  'menu_hero': (MENU, 'large steel knight helmet with a blue plume in front of a crossed sword, filling the whole icon', 64),
  'menu_team': (MENU, 'three colorful little heroes (knight, mage, archer) standing together under a red banner, bright colors', 64),
  'menu_adventure': (MENU, 'rolled treasure map with a red X and a small compass', 64),
  'menu_quests': (MENU, 'large parchment scroll with a big golden check mark and a red wax seal, filling the icon', 64),
  'top_profile': (MENU, 'hero portrait frame with a small crown', 48),
  'top_shop': (MENU, 'merchant chest overflowing with gems and coins', 48),
  'top_settings': (MENU, 'silver gear cog', 48),
  # Onglets (48×48)
  'tab_equipment': (MENU, 'leather backpack with a sword handle sticking out', 48),
  'tab_upgrades': (MENU, 'big glowing golden upward arrow above a small sword', 48),
  'tab_skills': (MENU, 'glowing spell rune circle with a blade in the center', 48),
  'tab_forge': (MENU, 'anvil with a hammer and orange sparks', 48),
  'tab_talents': (MENU, 'small glowing tree with star-shaped leaves', 48),
  'tab_companions': (MENU, 'two colorful hero portraits side by side, a blond archer and a red-haired swordswoman', 48),
  'tab_summon': (MENU, 'swirling purple summoning portal', 48),
  'tab_expeditions': (MENU, 'red flag planted on a small hill with footprints', 48),
  'tab_map': (MENU, 'unfolded parchment world map with green land, blue sea and tiny mountains', 48),
  'tab_dungeons': (MENU, 'stone dungeon gate with iron bars', 48),
  'tab_challenges': (MENU, 'tall stone tower with a flag on top', 48),
  'tab_boss': (MENU, 'horned red demon head', 48),
  'tab_event': (MENU, 'festive star with ribbons', 48),
  'tab_arena': (MENU, 'two crossed swords in front of a round arena shield', 48),
  'tab_missions': (MENU, 'checklist scroll with a quill', 48),
  'tab_collections': (MENU, 'open album book with small monster portraits', 48),
  'tab_looks': (MENU, 'hanger with a hero cape', 48),
  'tab_ranking': (MENU, 'podium with numbers 1 2 3', 48),
  'tab_guild': (MENU, 'tall purple hanging guild banner with a golden lion crest', 48),
  'tab_stats': (MENU, 'parchment with a colorful bar chart of three rising bars (green, yellow, red)', 48),
}


def run(name, seed=7):
    pre, desc, size = JOBS[name]
    path = os.path.join(OUT, f'{name}.png')
    if os.path.exists(path) and os.environ.get('FORCE') != '1':
        return name, 'déjà là'
    try:
        img = pixflux(pre + desc, size, seed=int(os.environ.get('SEED', seed)))[0]
        img.save(path)
        return name, 'ok'
    except Exception as e:  # noqa: BLE001
        return name, f'ERREUR {str(e)[:120]}'


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    names = sys.argv[1:] or list(JOBS)
    with ThreadPoolExecutor(6) as ex:
        for name, status in ex.map(run, names):
            print(name, status, flush=True)
