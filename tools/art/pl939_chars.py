"""v9.4.0 : compagnons et familiers au style des Légendaires (PixelLab generate-with-style-v2, 16 variantes par appel).
Usage : python3 tools/art/pl939_chars.py [sprite|hd] [clé ...] → pixellab939/chars/<clé>/<mode>_vN.png"""
import os, sys
from concurrent.futures import ThreadPoolExecutor
from PIL import Image
from pl939_api import with_style

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(HERE, 'pixellab939', 'chars')
P = ('pixel art fantasy RPG character, full body, about 4 heads tall, detailed armor and clothing, 1px dark outline, soft light '
     'from top-left, three-quarter view facing right, transparent background, same style as reference, ')
PP = 'pixel art fantasy pet creature, cute but detailed, 1px dark outline, soft light from top-left, facing right, transparent background, same style as reference, '
CHARS = {
  'ally_squire': 'young squire knight, light steel armor with blue tabard, short sword and round shield, eager stance',
  'ally_mercenary': 'rugged mercenary swordsman, brown leather armor, red scarf, heavy broadsword resting on shoulder',
  'ally_ranger': 'forest ranger, green hooded cloak, leather bracers, longbow, quiver of arrows',
  'ally_pyromancer': 'young pyromancer woman, red wide-brim witch hat, crimson robe with gold trim, small flame floating above her hand',
  'ally_priestess': 'dawn priestess, white and blue hooded robe, golden halo, holy staff topped with a cross',
  'ally_lancer': 'lancer knight, steel armor with blue cloak, long spear with pennant, red plume on helmet, visible face',
  'ally_shadow': 'silver-haired rogue, dark purple face mask, black leather outfit, twin daggers',
  'ally_dwarf': 'dwarf warrior, short and stocky, horned iron helmet, braided orange beard, heavy armor, double-headed axe',
  'ally_azure_paladin': 'azure paladin, ornate blue and silver plate armor, flowing cape, holy sword and kite shield',
  'ally_rose_blade': 'elegant swordswoman with long pink ponytail, black and crimson outfit with rose motifs, thin rapier',
  'ally_witch': 'dark witch with silver hair, tall purple pointed hat, violet robe, staff with a glowing void orb',
  'ally_elf_archer': 'elf archer woman, long blond hair, pointed ears, green and brown leather armor, elegant elven bow',
  'ally_high_priest': 'high priest, long blond hair, white and gold ceremonial robes, sun-shaped golden staff',
  'ally_ninja': 'ninja, purple hood and mask, dark violet outfit, glowing katana held low',
  'ally_barbarian': 'barbarian warrior, white hair, bare muscular arms, fur and leather armor, red war paint, big two-handed axe',
  'pet_cat': 'orange tabby castle cat with a tiny red collar and bell',
  'pet_owl': 'wise brown owl wearing small round glasses, holding a tiny scroll',
  'pet_slime': 'shiny golden slime with sparkles and a coin stuck on top',
  'pet_wisp': "will-o'-the-wisp spirit, swirling blue and orange flame with two bright eyes",
  'pet_golem': 'small stone golem with moss and a glowing blue core in its chest',
  'pet_fairy': 'forest fairy with butterfly wings, green leaf dress, holding a glowing flower',
}
HD_PETS = {'pet_slime': 'golden_slime'}


def pad(img, size):
    out = Image.new('RGBA', (size, size)); out.paste(img, ((size - img.width) // 2, size - img.height)); return out


def refs(key, mode):
    if mode == 'hd':  # illustration de la fiche : assets/hd/px/thumb (taille native, ~360×406)
        names = ('pet_kitsune', 'pet_jade_turtle', 'pet_dragonling') if key.startswith('pet_') else ('ally_archangel', 'ally_demon_queen')
        return [Image.open(os.path.join(ROOT, 'assets/hd/px/thumb', f'{n}.webp')).convert('RGBA') for n in names]
    if key.startswith('pet_'):
        return [pad(Image.open(os.path.join(ROOT, 'assets/sprites', f'{n}.png')).convert('RGBA'), 32) for n in ('pet_kitsune', 'pet_jade_turtle', 'pet_dragonling')]
    return [Image.open(os.path.join(HERE, 'pixellab', f'{n}.png')).convert('RGBA').crop((64, 0, 128, 64)) for n in ('ally_archangel', 'ally_demon_queen')]


def run(args):
    mode, key = args
    d = os.path.join(OUT, key); os.makedirs(d, exist_ok=True)
    if os.path.exists(os.path.join(d, f'{mode}_v0.png')):
        return key, mode, 'déjà là'
    try:
        pre = PP if key.startswith('pet_') else P
        sd = 'cute detailed creature' if key.startswith('pet_') else 'slender proportions, about 4 heads tall, not chibi'
        ims = with_style(pre + CHARS[key], refs(key, mode), seed=11, style_description=sd)
        for n, im in enumerate(ims):
            im.save(os.path.join(d, f'{mode}_v{n}.png'))
        return key, mode, f'{len(ims)} variantes'
    except Exception as e:  # noqa: BLE001
        return key, mode, f'ERREUR {str(e)[:150]}'


if __name__ == '__main__':
    mode = sys.argv[1] if len(sys.argv) > 1 else 'sprite'
    keys = sys.argv[2:] or list(CHARS)
    with ThreadPoolExecutor(6) as ex:
        for key, m, st in ex.map(run, [(mode, k) for k in keys]):
            print(key, m, st, flush=True)
