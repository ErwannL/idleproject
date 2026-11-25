"""v10.14.1 : décors et icônes des Fêtes du mois (PixelLab). Liste : docs/prompt-v10.14.1/PROMPT.md § 3.

  python3 -I tools/art/pl1014_art.py balance            générations restantes
  python3 -I tools/art/pl1014_art.py gen [nom[@graine]…] génère les images manquantes (ou celles nommées) → tools/art/pixellab1014/<nom>.png
  python3 -I tools/art/pl1014_art.py install            réduit les teintes, redimensionne au plus proche voisin → assets/ui/art1014/<nom>.png
  python3 -I tools/art/pl1014_art.py preview            planche de contrôle (une ligne par fête) → tools/art/preview_art1014.png

Chaque entrée : taille générée (w, h) par /create-image-pixflux, puis taille finale (plus proche voisin, pixel art).
Clé : PIXELLAB_API_KEY, jamais affichée ni écrite.
"""
import os
import sys
import time
import urllib.error
from concurrent.futures import ThreadPoolExecutor

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
RAW = os.path.join(HERE, 'pixellab1014')
DST = os.path.join(ROOT, 'assets', 'ui', 'art1014')
STYLE = ('16-bit fantasy pixel art, cozy and colorful, rich parallax depth, clean 1px dark outline, soft light from top-left, '
         'readable at small size, no text, no characters unless asked')

# nom: dict(prompt, gen=(w, h), out=(W, H), transparent, seed, colors)
SPECS = {}
ORDER = []  # (ligne de la planche, nom)


def add(name, prompt, gen, out=None, transparent=False, seed=1014, colors=64, row=None):
    SPECS[name] = dict(prompt=prompt, gen=gen, out=out or gen, transparent=transparent, seed=seed, colors=colors)
    ORDER.append((row, name))


KEY_NOTE = ', full frame edge to edge, no black bars, wide panorama, the scene fills the left two thirds, the whole right third is only empty soft sky and plain ground without any tree, building or object to leave room for a character, no text'
REGION_NOTE = ', full frame edge to edge, no black bars, wide side-view landscape strip, sky and details in the upper part, the bottom third is a flat walkable ground, no text, no characters'
ARENA_NOTE = ', no signature, no watermark, no creature, boss battle arena seen from the side, ground in the foreground, a large empty open space in the center left for a giant boss, atmospheric, no text, no characters'
FULL = ", full frame, edge to edge, no black bars, no border, no signature"
ICON_NOTE = ', single object centered, transparent background, game icon'

# (mois, thème clé, [r1, r2, r3], arène, pièce, graine)
GRAND = [
    ('2027-02', 'a fiery red and crimson valentine ball of embers, glowing ember hearts floating, black stone and red ribbons',
     ['glowing ember rose garden with red lanterns at dusk, red and orange', 'grand ballroom hall with crystal chandeliers and red ribbons, warm red light',
      'a black stone throne on a lava platform, glowing red lava rivers, dark crimson sky'],
     'a volcanic ember crater with lava pools and falling sparks, red and orange sky', 'a glowing heart shaped ember coin, red and orange', 2027),
    ('2027-03', 'a spring awakening: a blooming magical forest with huge flowers and fireflies, soft green and pink',
     ['a flowery sunny clearing with wildflowers and butterflies, fresh green',
      'an ancient forest with giant trees and fireflies, deep green and gold light',
      'the heart of a forest with a giant glowing mother tree, green and gold magical light'],
     'a forest of giant thorny bramble vines and thick roots, green and dark', 'a small green flower bud coin, pink petals', 2028),
    ('2027-04', 'a golden dawn above the clouds: a heavenly gate, sunrise, white marble and gold, soft pink and yellow sky',
     ['a white marble staircase climbing through the clouds, pale blue and pink sky',
      'a sky temple with tall golden columns above the clouds, golden light',
      'a huge golden sun gate at the top of the sky, radiant sunrise, gold and white'],
     'a celestial summit at sunrise with floating marble ruins and golden clouds', 'a golden dawn feather coin, glowing white and gold', 2029),
    ('2027-05', 'a solar eclipse night: a black sun with a glowing purple ring over a violet plain, dark purple and magenta',
     ['a violet rift cracking the ground, glowing purple fissure, dark night sky with stars',
      'a dark shadow citadel with spires and purple torches, dark indigo',
      'a void throne under a giant black eclipse with a bright purple ring, purple and black'],
     'a dark violet plain with jagged rock spires and cracked ground, a huge black eclipse sun with a bright ring in the sky, floating dark shards', 'a purple crystal shard with an eclipse ring emblem coin', 2030),
    ('2027-06', 'a frozen winter solstice: a frozen coast and ice palace under an aurora, ice blue and teal',
     ['a frozen coast with icebergs and snow, pale blue dawn',
      'an ice palace with crystal towers and frozen arches, glittering blue',
      'a frost throne on an ice cliff under a green and violet aurora borealis, deep blue night'],
     'a frozen sea under a thunderstorm, cracked ice, lightning in dark storm clouds, blue and white', 'a sparkling blue snowflake coin', 2031),
    ('2027-07', 'a summer festival of titans: a colossal arena with flags and a crowd, giant statues, bright sun, orange and gold',
     ['a summer arena with colorful flags and a cheering crowd of silhouettes, sunny orange sky',
      'a volcano with lava flows and rock bridges, orange and red',
      'the summit of the titans with giant stone statues and golden light, orange sunset'],
     'ancient ruins of a colossus with broken giant stone columns and a huge fallen statue, sunset orange', 'a golden champion medal coin with a ribbon', 2032),
]
for mo, key, regs, arena, coin, seed in GRAND:
    s = f'fest_{mo}-g'
    add(f'{s}_key', key + KEY_NOTE, (368, 88), (1100, 260), seed=seed, row=mo + '-g')
    for i, r in enumerate(regs, 1):
        add(f'{s}_r{i}', r + REGION_NOTE, (384, 80), (960, 200), seed=seed, row=mo + '-g')
    add(f'{s}_arena', arena + ARENA_NOTE, (384, 216), (1100, 620), seed=seed, row=mo + '-g')
    add(f'{s}_coin', coin + ICON_NOTE, (64, 64), transparent=True, seed=seed, row=mo + '-g')

# (mois, affiche, sentier, étape éteinte, étape allumée, pièce, graine)
LIGHT = [
    ('2027-02', 'a pink and purple masquerade ball with masks, pink ribbons, ballroom with candles and rose petals falling',
     'a winding path of pink rose petals through a masquerade ball garden, pink and purple, seen from above',
     'an unlit dark rose bud, closed, dull', 'a glowing pink rose in full bloom', 'a single pink rose petal coin, glowing', 3027),
    ('2027-03', 'an archery contest on a green meadow with targets and colorful pennant flags, sunny spring day',
     'a winding dirt path through a green meadow with archery targets and bunting, seen from above',
     'a plain wooden arrow lying flat, dull grey', 'a glowing golden arrow, shining', 'a golden arrow coin, shining', 3028),
    ('2027-04', 'a pilgrimage path of lit candles leading to a glowing white temple on a hill at dusk, warm yellow light',
     'a winding stone path lined with candles leading up to a temple, golden light, seen from above',
     'an unlit white candle, dull', 'a lit white candle with a bright golden flame', 'a small lit candle coin, golden glow', 3029),
    ('2027-05', 'a Japanese village at night with paper lanterns, pagoda roofs and a big moon, dark blue and indigo',
     'a winding wooden walkway between pagoda roofs and lanterns at night, indigo, seen from above',
     'a dull dark grey shuriken, throwing star, no glow', 'a bright steel shuriken throwing star with a blue glow', 'a steel shuriken coin with blue glow', 3030),
    ('2027-06', 'a forest clearing with great bonfires and a huge full moon, sparks flying, dusk orange and blue',
     'a winding trail through a clearing lit by many small bonfires, night, seen from above',
     'a cold dark pile of unlit logs', 'a bright burning bonfire with orange flames', 'a small flame ember with a crescent moon coin, orange glow', 3031),
    ('2027-07', 'an ancient Greek stadium in bright full sun, white marble columns and banners, blue sky, no crowd',
     'a winding running track of sand through an ancient stadium with columns and banners, sunny, seen from above',
     'a dull grey laurel wreath, faded', 'a glowing golden laurel wreath, shining', 'a round bronze coin with an embossed laurel wreath and a gold rim, shining', 3032),
]
for mo, key, path, off, on, coin, seed in LIGHT:
    s = f'fest_{mo}-l'
    add(f'{s}_key', key + KEY_NOTE, (368, 88), (1100, 260), seed=seed, row=mo + '-l')
    add(f'{s}_path', path + ', wide panorama, no text, no characters', (368, 88), (1100, 260), seed=seed, row=mo + '-l')
    add(f'{s}_node', off + ICON_NOTE, (64, 64), transparent=True, seed=seed, row=mo + '-l')
    add(f'{s}_node_done', on + ICON_NOTE, (64, 64), transparent=True, seed=seed, row=mo + '-l')
    add(f'{s}_coin', coin + ICON_NOTE, (64, 64), transparent=True, seed=seed, row=mo + '-l')

# § 3.3 : une seule fois
for n, p in {'adventure': 'an unfolded parchment treasure map with a red dotted path and an X', 'boss': 'a horned giant titan skull with glowing eyes',
             'rift': 'a glowing violet rift crack in the air with light', 'missions': 'a parchment scroll with green check marks',
             'shop': 'a festive decorated treasure chest with ribbons, open with gold', 'path': 'a lit hanging red paper lantern with a golden tassel'}.items():
    add(f'fest_tab_{n}', p + ICON_NOTE, (96, 96), transparent=True, seed=1033, row='divers')
add('fest_rift_bg', 'inside a rift: a violet void with a glowing crack of light, many floating stone islands with depth, purple and magenta, stars, no text, no characters',
    (384, 216), (1100, 620), seed=1034, row='divers')
for n, p in {'strength': 'a blessed glowing sword', 'fury': 'a red flame', 'time': 'a golden hourglass', 'loot': 'a leather coin pouch with gold coins',
             'heart': 'a red heart with white angel wings', 'focus': 'a single open golden eye with a round iris and eyelashes, ornate'}.items():
    add(f'rift_bless_{n}', p + ICON_NOTE, (96, 96), transparent=True, seed=1035, row='divers')
for n, p in {'boss': 'a boss skull with a crown and red glow', 'chest': 'a closed treasure chest with gold lock and a gem, region end reward',
             'crown': 'a glowing crystal fragment shard, legendary orange, floating'}.items():
    add(f'fest_node_{n}', p + ICON_NOTE, (64, 64), transparent=True, seed=1036, row='divers')
add('hud_event_fest', 'a festival banner flag with a gold star on a pole with streamers and confetti, round icon composition' + ICON_NOTE, (96, 96),
    transparent=True, seed=1037, row='divers')


def parse(arg):
    name, _, seed = arg.partition('@')
    return name, int(seed) if seed else None


def gen_one(arg):
    from pl939_api import call, images_of, wait
    name, seed = parse(arg)
    sp = SPECS[name]
    w, h = sp['gen']
    body = {'description': sp['prompt'] + ', ' + STYLE, 'image_size': {'width': w, 'height': h}, 'no_background': sp['transparent'],
            'seed': seed if seed is not None else sp['seed'], 'outline': 'single color black outline', 'shading': 'medium shading', 'detail': 'highly detailed'}
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


def trim(im, bottom=0):
    # retire les bandes noires que le modèle laisse parfois en haut / en bas (et une signature éventuelle), avant le redimensionnement
    px = im.convert('RGB').load()
    dark = lambda y: all(sum(px[x, y]) < 40 for x in range(0, im.width, 4))
    top, bot = 0, im.height - bottom
    while top < bot - 8 and dark(top):
        top += 1
    while bot > top + 8 and dark(bot - 1):
        bot -= 1
    return im.crop((0, top, im.width, bot)) if (top or bot < im.height) else im


def install():
    os.makedirs(DST, exist_ok=True)
    n = 0
    for name, sp in SPECS.items():
        src = os.path.join(RAW, f'{name}.png')
        if not os.path.exists(src):
            continue
        im = Image.open(src).convert('RGBA')
        if not sp['transparent']:
            im = trim(im, 8 if name.endswith('05-g_arena') else 0)
        q = im.convert('RGB').quantize(colors=sp['colors'], method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGBA')
        q.putalpha(im.getchannel('A'))
        if q.size != tuple(sp['out']):
            q = q.resize(tuple(sp['out']), Image.NEAREST)
        q.save(os.path.join(DST, f'{name}.png'), optimize=True)
        n += 1
    print(f'{n} images → assets/ui/art1014')


def preview():
    rows = {}
    for r, n in ORDER:
        if os.path.exists(os.path.join(DST, f'{n}.png')):
            rows.setdefault(r, []).append(n)
    height_row = 150
    sheet_w = 1800
    sheet = Image.new('RGBA', (sheet_w, height_row * len(rows)), (30, 24, 40, 255))
    for ri, (r, names) in enumerate(rows.items()):
        x = 4
        for n in names:
            im = Image.open(os.path.join(DST, f'{n}.png')).convert('RGBA')
            w = {'key': 440, 'path': 440, 'arena': 250, 'bg': 250}.get(n.rsplit('_', 1)[-1], 0)
            if n.endswith(('_r1', '_r2', '_r3')):
                w = 280
            h = int(im.height * (w / im.width)) if w else height_row - 24
            if not w:
                w = int(im.width * (h / im.height))
            im = im.resize((max(1, w), max(1, h)), Image.NEAREST)
            if x + w > sheet_w:
                break
            sheet.paste(im, (x, ri * height_row + 4), im)
            x += w + 6
    sheet.save(os.path.join(HERE, 'preview_art1014.png'))
    print(f'{len(rows)} lignes sur la planche')


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'install'
    if cmd == 'balance':
        from pl939_api import call
        print(call('GET', '/balance'))
    elif cmd == 'gen':
        names = sys.argv[2:] or [n for n in SPECS if not os.path.exists(os.path.join(DST, f'{n}.png'))]
        with ThreadPoolExecutor(4) as ex:
            for m in ex.map(gen_one, names):
                print(m, flush=True)
    elif cmd == 'install':
        install()
    elif cmd == 'preview':
        preview()
