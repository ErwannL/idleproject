"""v9.8 (D) : images de présentation des compagnons au style des 5 Légendaires (fantasy idéalisé, couleurs vives, costume
ouvragé, effet d'élément, pixel art net, lumière de bord), fidèles au sprite de combat (mêmes couleurs, cheveux, costume).
Référence de style : présentations des Légendaires ramenées à leur taille native (blocs de 6 / 3 pixels). Génération à
taille native, puis agrandissement ×6 au plus proche dans le même canevas que l'image d'origine (pieds en bas).
Usage : python3 tools/art/pl98_portraits.py gen [clé…] | sheet | install [clé…]"""
import os, sys
from concurrent.futures import ThreadPoolExecutor
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pl939_api import with_style

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
PX = os.path.join(ROOT, 'assets', 'hd', 'px'); OUT = os.path.join(HERE, 'pixellab98', 'portraits')
LEGENDS = ['archangel', 'demon_queen', 'ice_empress', 'shadow_lord', 'sylvan_guardian']
BLOCK = {'archangel': 6, 'demon_queen': 3, 'ice_empress': 6, 'shadow_lord': 6, 'sylvan_guardian': 6}
BASE = 'full body fantasy hero character, anime-inspired face, vibrant saturated colors, ornate costume with gold trim, heroic pose, crisp pixel art, rim lighting, transparent background, same style as reference'
CHARS = {  # fidèles au sprite de combat ; rareté = richesse du costume et de l'effet
  'squire': ('archangel', 'young squire knight, short golden blond hair, blue eyes, silver plate armor with a blue tabard, round wooden shield with steel rim, short sword, small blue sparkles (rare: simple costume, one ornament)'),
  'pyromancer': ('demon_queen', 'young female fire mage, long wavy orange-red hair, tall red witch hat with gold band, crimson robe with gold trim, small flame dancing in her raised hand, embers around her'),
  'priestess': ('archangel', 'young female priestess, pale blonde hair under a deep blue hood with a golden halo, white and blue robe with silver armor plates, golden cross staff, soft holy light, NO wings'),
  'azure_paladin': ('ice_empress', 'young male paladin, short silver-white hair, no headband, gleaming white and gold plate armor with azure blue accents, long silver sword with holy glow, short white cape, light aura (epic)'),
  'mercenary': ('demon_queen', 'young mercenary swordsman, messy brown hair, short beard, red scarf, brown leather and steel armor with brass rivets, huge broadsword on the shoulder, red ember sparks (rare, fantasy not realistic)'),
  'ranger': ('sylvan_guardian', 'young female ranger, brown hair with a green headband, green hooded cloak, brown leather armor with leaf ornaments, longbow, green leaves and nature sparkles'),
  'lancer': ('archangel', 'young female lancer knight, ponytail, silver armor with blue cloth, red plume on helmet, long spear with blue pennant, wind sparkles'),
  'shadow': ('shadow_lord', 'young rogue, spiky silver hair, black mask over the mouth, dark leather armor with purple trim, twin daggers, purple shadow smoke'),
  'dwarf': ('demon_queen', 'young dwarf warrior, big braided orange beard, horned steel helmet, heavy steel armor with gold rivets, double-headed axe, orange sparks'),
  'barbarian': ('demon_queen', 'young barbarian man with wild white spiky hair, tanned skin, fur pauldrons, leather straps, huge double axe, red war-paint, fiery aura (epic)'),
  'witch': ('shadow_lord', 'young female witch, long silver-lavender hair, tall purple witch hat, purple and black dress with silver trim, staff with glowing violet orb, arcane glow'),
  'elf_archer': ('sylvan_guardian', 'young female elf archer, long blond hair, pointed ears, green and gold leather armor, golden elven bow, glowing green arrows'),
  'high_priest': ('archangel', 'young high priestess, long blonde hair, white and gold robe, sun-shaped golden staff, radiant holy sun glow'),
  'rose_blade': ('demon_queen', 'young female duelist, long pink hair, crimson and black coat with gold buttons, elegant rapier, rose petals swirling'),
  'ninja': ('shadow_lord', 'young ninja, dark navy outfit with purple sash, hooded mask, katana with violet glowing edge, purple smoke wisps'),
}

# Familiers : repassés en pixel art net (même lumière que les compagnons), couleurs du sprite (Fée blonde, Feu follet bleu).
PETS = {
  'pet_golden_slime': 'cute golden slime blob with a tiny crown, shiny highlights, gold sparkles',
  'pet_cat': 'cute orange tabby cat with big eyes, playful pose, small magic sparkles, no wings, normal cat',
  'pet_owl': 'cute white and lilac owl with big round eyes, wings slightly open, soft moonlight sparkles',
  'pet_fairy': 'tiny fairy girl alone with short blonde hair, butterfly wings, mint green dress, holding a glowing flower, no other creature',
  'pet_golem': 'small stone golem pet with mossy shoulders, glowing cyan rune eyes',
  'pet_wisp': 'cute blue will-o-the-wisp spirit flame with a happy face, cyan and blue glow',
  'pet_crystal_hedgehog': 'cute hedgehog with violet crystal spikes, lilac sparkles',
  'pet_dragonling': 'cute baby red dragon with small wings, tiny flame from the mouth',
  'pet_jade_turtle': 'cute jade green turtle with golden rune shell, soft green glow',
  'pet_kitsune': 'cute white fox spirit with several fluffy tails tipped with blue foxfire',
  'pet_phoenix': 'small phoenix bird with golden and red fire feathers, embers',
}
PET_BASE = 'cute fantasy pet creature, full body, vibrant saturated colors, crisp pixel art with clean pixels, rim lighting, transparent background, same pixel style as reference'

def gen_pet(key):
    try:
        im = with_style(f'{PETS[key]}. {PET_BASE}', [native('archangel')], seed=int(os.environ.get('SEED', 5)))[0]
        os.makedirs(OUT, exist_ok=True); im.save(os.path.join(OUT, f'{key}.png')); return f'{key} ok {im.size}'
    except Exception as e: return f'{key} ERREUR {str(e)[:150]}'  # noqa: BLE001

def native(name):
    im = Image.open(os.path.join(PX, f'ally_{name}.webp')).convert('RGBA'); k = BLOCK[name]
    return im.resize((im.width // k, im.height // k), Image.NEAREST)

def gen(key):
    ref, d = CHARS[key]
    try:
        im = with_style(f'{d}. {BASE}', [native(ref)], seed=int(os.environ.get('SEED', 5)))[0]
        os.makedirs(OUT, exist_ok=True); im.save(os.path.join(OUT, f'{key}.png')); return f'{key} ok {im.size}'
    except Exception as e: return f'{key} ERREUR {str(e)[:150]}'  # noqa: BLE001

def place(key):
    """Image native agrandie au plus proche dans le canevas de l'image d'origine (largeur adaptée), pieds en bas."""
    src = Image.open(os.path.join(OUT, f'{key}.png')).convert('RGBA'); src = src.crop(src.getbbox())
    H = 1218; k = max(1, (H - 20) // src.height)
    big = src.resize((src.width * k, src.height * k), Image.NEAREST)
    W = max(big.width + 20, 600); c = Image.new('RGBA', (W, H), (0, 0, 0, 0)); c.alpha_composite(big, ((W - big.width) // 2, H - big.height - 10))
    return c

def sheet():
    tiles = [Image.open(os.path.join(PX, f'ally_{n}.webp')).convert('RGBA') for n in LEGENDS]
    news = [place(k) for k in [*CHARS, *PETS] if os.path.exists(os.path.join(OUT, f'{k}.png'))]
    th = lambda im: (lambda c: (c.thumbnail((180, 220)), c)[1])(im.copy())
    rows = [tiles] + [news[i:i + 8] for i in range(0, len(news), 8)]
    img = Image.new('RGBA', (8 * 190, len(rows) * 230), (40, 44, 64, 255))
    for r, row in enumerate(rows):
        for i, t in enumerate(row): t = th(t); img.alpha_composite(t, (i * 190 + (180 - t.width) // 2, r * 230 + 220 - t.height))
    os.makedirs(os.path.join(HERE, 'pixellab98'), exist_ok=True)
    p = os.path.join(HERE, 'pixellab98', 'sheet_portraits.png'); img.save(p); print(p)

def install(keys):
    for key in keys:
        name = key if key.startswith('pet_') else f'ally_{key}'
        c = place(key)
        if key.startswith('pet_'):  # familier : même taille de canevas que l'ancienne image
            o = Image.open(os.path.join(PX, f'{name}.webp')); s2 = Image.open(os.path.join(OUT, f'{key}.png')).convert('RGBA'); s2 = s2.crop(s2.getbbox())
            k = max(1, min((o.height - 10) // s2.height, (o.width - 10) // s2.width)); b = s2.resize((s2.width * k, s2.height * k), Image.NEAREST)
            c = Image.new('RGBA', o.size, (0, 0, 0, 0)); c.alpha_composite(b, ((o.width - b.width) // 2, o.height - b.height - 5))
        c.save(os.path.join(PX, f'{name}.webp'), 'WEBP', lossless=True)
        t = c.resize((c.width // 3, c.height // 3), Image.NEAREST); t.save(os.path.join(PX, 'thumb', f'{name}.webp'), 'WEBP', lossless=True)
    print('installé', len(keys))

if __name__ == '__main__':
    cmd, keys = sys.argv[1], sys.argv[2:] or list(CHARS)
    if cmd == 'pets':
        with ThreadPoolExecutor(5) as ex:
            for m in ex.map(gen_pet, sys.argv[2:] or list(PETS)): print(m, flush=True)
    elif cmd == 'gen':
        with ThreadPoolExecutor(5) as ex:
            for m in ex.map(gen, keys): print(m, flush=True)
    elif cmd == 'sheet': sheet()
    else: install(keys)
