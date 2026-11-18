"""v9.11 (8, 9) : Roue du jour en pixel art (disque runique cerclé d'or, flèche-lame dorée, autel du temple) et offres de
tickets de la Boutique (parchemins de compagnon scellés et œufs de familier, de plus en plus grands).
Sorties : tools/art/pixellab911/art/<nom>.png ; installation : --install (assets/ui/wheel/ et assets/ui/shop/).
Usage : PIXELLAB_API_KEY=… python3 tools/art/pl911_art.py [noms…] | --install"""
import os, sys
from concurrent.futures import ThreadPoolExecutor
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pl939_api import call, wait, images_of

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(HERE, 'pixellab911', 'art')
SOFT = ', fantasy game art, soft pixel art, thin dark outline (not pure black), warm light, slightly desaturated colors, subtle magic glow'
ART = {
    # Roue
    'wheel_disc': ((192, 192), 'top-down view of a round ancient runic stone wheel with a thick ornate gold rim, divided into 8 equal pie sections by 8 straight golden spokes from the center, each section a plain dark carved stone, a golden gem hub in the center, perfectly circular, flat front view' + SOFT + ', transparent background'),
    'wheel_pointer': ((48, 64), 'a golden ornate dagger blade pointing straight down, like a claw pointer for a prize wheel, small ruby in the guard' + SOFT + ', transparent background'),
    'wheel_altar': ((256, 160), 'interior of an ancient fantasy temple hall at night: a stone altar in the center under an arch, candles, blue banners, glowing runes on the walls, warm torchlight, empty space in the middle' + SOFT),
    # Tickets de compagnon : 1 parchemin, une liasse, un coffret, un coffre, un coffre doré
    'hero_ticket_I': ((96, 96), 'a single rolled summoning scroll sealed with a red wax seal, a faint glowing silhouette of a hero warrior behind it' + SOFT + ', transparent background'),
    'hero_ticket_II': ((96, 96), 'a bundle of five summoning scrolls tied with a ribbon and a red wax seal, faint glowing silhouette of a hero behind' + SOFT + ', transparent background'),
    'hero_ticket_III': ((96, 96), 'a small wooden case open with many sealed summoning scrolls inside, purple magic glow, silhouette of a hero above' + SOFT + ', transparent background'),
    'hero_ticket_IV': ((96, 96), 'a large wooden treasure chest overflowing with sealed summoning scrolls, purple and gold glow, silhouettes of heroes above' + SOFT + ', transparent background'),
    'hero_ticket_V': ((96, 96), 'a huge ornate golden treasure chest overflowing with glowing sealed summoning scrolls, radiant gold light, silhouettes of legendary heroes above' + SOFT + ', transparent background'),
    # Tickets de familier : un œuf, trois œufs, une cage, un nid-coffre, un coffre doré
    'pet_pack_discovery': ((96, 96), 'a single speckled creature egg cracked open with a tiny cute baby dragon peeking out' + SOFT + ', transparent background'),
    'pet_pack_small': ((96, 96), 'three colorful creature eggs in a straw nest, one cracked with a tiny fox cub peeking out' + SOFT + ', transparent background'),
    'pet_pack_medium': ((96, 96), 'an ornate brass pet cage with a cute small owl and a little slime inside, eggs beside it' + SOFT + ', transparent background'),
    'pet_pack_large': ((96, 96), 'a wooden chest full of glowing creature eggs with a baby phoenix and a kitten peeking out' + SOFT + ', transparent background'),
    'pet_pack_premium': ((96, 96), 'a huge golden treasure chest overflowing with glowing magical creature eggs, a baby dragon, a fox and a phoenix chick peeking out, radiant light' + SOFT + ', transparent background'),
}

def gen(name):
    size, desc = ART[name]
    try:
        body = {'description': desc, 'image_size': {'width': size[0], 'height': size[1]}, 'no_background': 'transparent background' in desc, 'seed': 11,
                'outline': 'single color outline', 'shading': 'medium shading', 'detail': 'highly detailed'}
        im = images_of(wait(call('POST', '/create-image-pixflux', body)))[0]
        im.save(os.path.join(OUT, f'{name}.png')); return f'{name} ok'
    except Exception as e: return f'{name} ERREUR {str(e)[:160]}'  # noqa: BLE001

def install():
    os.makedirs(os.path.join(ROOT, 'assets', 'ui', 'wheel'), exist_ok=True)
    shop = os.path.join(ROOT, 'assets', 'ui', 'shop')
    for name in ART:
        f = os.path.join(OUT, f'{name}.png')
        if not os.path.exists(f): continue
        im = Image.open(f).convert('RGBA')
        if name.startswith('wheel'):
            im.save(os.path.join(ROOT, 'assets', 'ui', 'wheel', f'{name}.png')); continue
        im = im.crop(im.getbbox())
        for suffix, sz in (('', (99, 103)), ('_s', (50, 52))):
            k = min(sz[0] / im.width, sz[1] / im.height); c = Image.new('RGBA', sz, (0, 0, 0, 0))
            r = im.resize((max(1, int(im.width * k)), max(1, int(im.height * k))), Image.NEAREST); c.alpha_composite(r, ((sz[0] - r.width) // 2, sz[1] - r.height))
            c.save(os.path.join(shop, f'{name}{suffix}.png'))
    print('installé')

if __name__ == '__main__':
    if '--install' in sys.argv: install(); sys.exit(0)
    os.makedirs(OUT, exist_ok=True)
    names = sys.argv[1:] or list(ART)
    with ThreadPoolExecutor(5) as ex:
        for m in ex.map(gen, names): print(m, flush=True)
