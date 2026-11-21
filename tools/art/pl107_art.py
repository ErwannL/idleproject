"""v10.7 (partie 5) : bannière des Compétences refaite sans lettres inventées (PixelLab, /create-image-pixflux).

  python3 -I tools/art/pl107_art.py gen [graine]   → tools/art/pixellab107/banner_skills_<graine>.png
  python3 -I tools/art/pl107_art.py install <graine> → assets/ui/art101/banner_skills.png (agrandie au pixel près)
Clé : PIXELLAB_API_KEY (jamais affichée ni écrite).
"""
import os
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
RAW = os.path.join(HERE, 'pixellab107')
PROMPT = ('an open spellbook on a wooden desk between two candles, glowing magic runes and floating sparkles of light above the pages, '
          'dark blue night background, no text, no letters, no writing, no symbols that look like letters, '
          '16-bit fantasy RPG pixel art, one pixel dark outline, light from the top left, rich warm colors, wide panorama')
SIZE = (320, 128)  # taille de l'ancienne bannière


def gen(seed):
    from pl939_api import call, images_of, wait
    body = {'description': PROMPT, 'negative_description': 'text, letters, words, writing, alphabet, numbers',
            'image_size': {'width': SIZE[0], 'height': SIZE[1]}, 'no_background': False, 'seed': seed,
            'outline': 'single color black outline', 'shading': 'medium shading', 'detail': 'highly detailed'}
    im = images_of(wait(call('POST', '/create-image-pixflux', body)))[0]
    os.makedirs(RAW, exist_ok=True)
    im.save(os.path.join(RAW, f'banner_skills_{seed}.png'))
    print('ok', seed)


def install(seed, size):
    im = Image.open(os.path.join(RAW, f'banner_skills_{seed}.png')).convert('RGB')
    q = im.quantize(colors=64, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    if size:
        q = q.resize(size, Image.NEAREST)
    q.save(os.path.join(ROOT, 'assets', 'ui', 'art101', 'banner_skills.png'), optimize=True)
    print('installé')


if __name__ == '__main__':
    if sys.argv[1] == 'gen':
        for sd in (sys.argv[2:] or ['107']):
            gen(int(sd))
    else:
        install(int(sys.argv[2]), None)
