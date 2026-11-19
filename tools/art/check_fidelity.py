"""v10.0 (9.3) : la fiche montre le même personnage que le combat.

Compare la palette dominante de l'image de combat (repos dessiné des compagnons, petit sprite des familiers) avec
celle de l'illustration de la fiche et de l'éveillée : les 4 couleurs principales (hors contours très sombres)
doivent avoir une teinte voisine (écart de moins de 15°). Produit une planche « combat | fiche | éveillée » par
personnage (et une planche d'ensemble) à relire à l'œil avant chaque livraison d'illustrations.

Usage : python3 tools/art/check_fidelity.py [sortie]
"""
import colorsys
import json
import os
import subprocess
import sys

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
import pl10_fiches as F  # noqa: E402

PX = os.path.join(ROOT, 'assets', 'hd', 'px')


def dominant(im, n=4):
    """Teintes des n couleurs principales (pixels assez saturés et lumineux), triées par fréquence."""
    small = im.copy(); small.thumbnail((96, 96), Image.NEAREST)
    buckets = {}
    for r, g, b, a in small.get_flattened_data():
        if a < 128: continue
        h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
        if v < 0.18 or s < 0.15: continue
        k = int(h * 24)
        buckets[k] = buckets.get(k, 0) + 1
    tops = sorted(buckets.items(), key=lambda kv: -kv[1])[:n]
    return [(k + 0.5) * 15 for k, _ in tops]


def hue_gap(a, b):
    if not a or not b: return 0
    gaps = [min(min(abs(x - y), 360 - abs(x - y)) for y in b) for x in a]
    return max(gaps)


def load(path):
    if not os.path.exists(path): return None
    im = Image.open(path).convert('RGBA')
    return im.crop(im.getbbox())


def main(out):
    os.makedirs(out, exist_ok=True)
    C = F.companions()
    rows, bad = [], []
    for cid, c in C.items():
        key = c['sprite'].replace('pet_slime', 'pet_golden_slime') if c['kind'] != 'ally' else c['sprite']
        ref = F.reference(c)
        fiche = load(os.path.join(PX, f'{key}.webp'))
        awake = load(os.path.join(PX, 'awake', f'{key}.webp')) if c['kind'] == 'ally' else None
        hr = dominant(ref)
        g1 = hue_gap(hr, dominant(fiche)) if fiche else 999
        g2 = hue_gap(hr, dominant(awake)) if awake else 0
        ok = g1 < 15 and g2 < 15
        if not ok: bad.append(f'{cid} : écart de teinte fiche {g1:.0f}°, éveillée {g2:.0f}°')
        rows.append((cid, c['name'], [ref, fiche, awake], g1, g2, ok))
        H = 240
        def f(im): k = H / im.height; return im.resize((max(1, int(im.width * k)), H), Image.NEAREST)
        ims = [f(x) for x in (ref, fiche, awake) if x is not None]
        sheet = Image.new('RGBA', (sum(i.width for i in ims) + 20 * len(ims) + 20, H + 40), (30, 30, 45, 255))
        d = ImageDraw.Draw(sheet); x = 10
        for lab, i in zip(('combat', 'fiche', 'éveillée'), ims):
            sheet.paste(i, (x, 30), i); d.text((x, 6), lab, fill=(230, 230, 230)); x += i.width + 20
        d.text((x - 200, 6), f"{c['name']} · {g1:.0f}° / {g2:.0f}°", fill=(120, 230, 120) if ok else (255, 120, 120))
        sheet.save(os.path.join(out, f'{cid}.png'))
    print('\n'.join(bad) if bad else 'Toutes les fiches sont fidèles (teintes).')
    print(f'{len(bad)} écarts · planches : {out}')
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'docs', 'fiches')))
