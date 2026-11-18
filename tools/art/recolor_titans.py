# v9.11 (2) : vraies planches teintées des Titans du jour (au lieu d'un filtre CSS) : chaque pixel du Colosse prend la
# teinte de l'élément du Titan, en gardant sa luminosité (contours sombres et reflets clairs intacts).
# Usage : python3 tools/art/recolor_titans.py
import colorsys, glob, os
from PIL import Image

TITANS = {  # id : (teinte 0-1, saturation mini, multiplicateur de luminosité)
    'titan_sun': (0.13, 0.55, 1.12), 'titan_moon': (0.62, 0.18, 1.18), 'titan_ember': (0.03, 0.7, 1.0),
    'titan_tide': (0.53, 0.6, 1.0), 'titan_thorn': (0.30, 0.55, 0.95), 'titan_storm': (0.60, 0.45, 1.1),
    'titan_void': (0.76, 0.55, 0.8),
}
SRC = 'assets/world-boss'
for tid, (hue, smin, vmul) in TITANS.items():
    out = f'{SRC}/{tid}'
    os.makedirs(out, exist_ok=True)
    for f in sorted(glob.glob(f'{SRC}/colossus_*.png')):
        im = Image.open(f).convert('RGBA')
        px = im.load()
        for y in range(im.height):
            for x in range(im.width):
                r, g, b, a = px[x, y]
                if a == 0:
                    continue
                h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
                hot = s > 0.45 and v > 0.6  # yeux, runes, lave : la lumière du Titan, plus claire
                s2 = min(1, max(s, smin) * (1.1 if hot else 0.9))
                v2 = min(1, v * vmul * (1.15 if hot else 1))
                nr, ng, nb = colorsys.hsv_to_rgb((hue + (0.04 if hot else 0)) % 1, s2, v2)
                px[x, y] = (round(nr * 255), round(ng * 255), round(nb * 255), a)
        im.save(f'{out}/{os.path.basename(f)}', optimize=True)
    print(tid)
