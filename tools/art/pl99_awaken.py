"""v9.9 (K17) : illustrations « éveillées » des compagnons (niveau 20) — même personnage, mêmes couleurs, costume plus
orné et aura de son élément ; référence de style = sa présentation actuelle. Sorties : assets/hd/px/awake/ally_<id>.webp
Usage : python3 tools/art/pl99_awaken.py [id…]"""
import os, sys, json, subprocess
from concurrent.futures import ThreadPoolExecutor
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pl939_api import with_style
from pl98_portraits import CHARS
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PX = os.path.join(ROOT, 'assets', 'hd', 'px'); OUT = os.path.join(PX, 'awake'); RAW = os.path.join(ROOT, 'tools', 'art', 'pixellab99', 'awake')
AURA = {'red': 'blazing fire aura and floating embers', 'blue': 'surrounded by a big swirling glowing blue water aura with sparkles', 'green': 'glowing leaves and vine aura', 'light': 'radiant golden holy light aura', 'dark': 'swirling violet shadow aura'}
LEG = {'archangel': 'radiant archangel woman with large white feathered wings, golden armor, holy sword', 'demon_queen': 'demon queen with dark horns, crimson and black regal armor, flame crown',
       'ice_empress': 'ice empress with long pale blue hair, crystal tiara, frost gown', 'shadow_lord': 'shadow lord in dark violet armor with hooded cape and void blade',
       'sylvan_guardian': 'sylvan guardian woman with green hair, leaf armor and living wooden staff'}
BASE = 'full body fantasy hero character, anime-inspired face, vibrant saturated colors, crisp pixel art, rim lighting, transparent background, same character and colors as reference'
def els():
    out = subprocess.run(['node', '-e', "import('./src/core/elements.js').then(m=>console.log(JSON.stringify(m.UNIT_ELEMENT)))"], cwd=ROOT, capture_output=True, text=True).stdout
    return json.loads(out)
EL = els()
def ref(cid):
    im = Image.open(os.path.join(PX, f'ally_{cid}.webp')).convert('RGBA'); im = im.crop(im.getbbox())
    k = max(1, im.height // 160); return im.resize((im.width // k, im.height // k), Image.NEAREST)
def gen(cid):
    path = os.path.join(RAW, f'{cid}.png')
    if os.path.exists(path): return f'{cid} déjà là'
    desc = CHARS[cid][1] if cid in CHARS else LEG[cid]
    try:
        im = with_style(f'{desc}, AWAKENED FORM: more ornate upgraded armor, {AURA.get(EL.get(cid), "magic aura")}, heroic stance. {BASE}', [ref(cid)], seed=int(os.environ.get('SEED', 9)))[0]
        os.makedirs(RAW, exist_ok=True); im.save(path); return f'{cid} ok'
    except Exception as e: return f'{cid} ERREUR {str(e)[:150]}'  # noqa: BLE001
def install(cid):
    src = Image.open(os.path.join(RAW, f'{cid}.png')).convert('RGBA'); src = src.crop(src.getbbox())
    H = 1218; k = max(1, (H - 20) // src.height); big = src.resize((src.width * k, src.height * k), Image.NEAREST)
    W = max(big.width + 20, 600); c = Image.new('RGBA', (W, H), (0, 0, 0, 0)); c.alpha_composite(big, ((W - big.width) // 2, H - big.height - 10))
    os.makedirs(OUT, exist_ok=True); c.save(os.path.join(OUT, f'ally_{cid}.webp'), 'WEBP', lossless=True)
if __name__ == '__main__':
    ids = sys.argv[1:] or [*CHARS, *LEG]
    with ThreadPoolExecutor(5) as ex:
        for m in ex.map(gen, ids): print(m, flush=True)
    for cid in ids:
        if os.path.exists(os.path.join(RAW, f'{cid}.png')): install(cid)
    print('installé')
