"""v9.2.9 : sprites de jeu des nouveaux familiers (PixelLab, generate-image-v2 32×32 : identité = illustration HD,
style = familiers du jeu). Sources : assets/sprites/pet_<id>.png (rognées). Vues d'animation : pixellab/anim_allies/_ref."""
import os

from PIL import Image

from lib import Canvas, rgb2hex

HERE = os.path.dirname(os.path.abspath(__file__))
SPRITES = os.path.join(os.path.dirname(os.path.dirname(HERE)), 'assets', 'sprites')
IDS = ('crystal_hedgehog', 'dragonling', 'jade_turtle', 'kitsune', 'phoenix')


def build():
    out = {}
    for pid in IDS:
        img = Image.open(os.path.join(SPRITES, f'pet_{pid}.png')).convert('RGBA')
        c = Canvas(img.width, img.height)
        px = img.load()
        for y in range(img.height):
            for x in range(img.width):
                if px[x, y][3] > 127:
                    c.px[y][x] = rgb2hex(px[x, y][:3])
        out[f'pet_{pid}'] = (c, {})
    return out
