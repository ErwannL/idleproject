"""v10.0 (9.2) : contrôle automatique des animations dessinées des compagnons et familiers.

Refuse une animation si :
  - attaque, sort ou ultime : moins de 15 % des pixels du personnage changent en moyenne d'une image à l'autre ;
  - repos : aucune image ne s'écarte d'au moins 6 % de la première ;
  - plus de la moitié des images d'une action sont identiques (à 2 % près) à l'image de repos ;
  - une image d'action perd plus de 30 % des pixels du repos (arme ou membre disparu).
Sort aussi une planche par personnage (toutes les images, une ligne par animation) à relire à l'œil.

Usage : python3 tools/art/check_anims.py [sortie] [--json frames.json]
  (frames.json : produit par node tools/art/dump_ally_frames.mjs ; fait automatiquement sinon)
"""
import json
import os
import subprocess
import sys

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
ACTIONS = ('attack', 'cast', 'ultimate')
MIN_ACTION, MIN_IDLE, SAME, LOSS = 0.15, 0.06, 0.02, 0.30
MIN_IDLE_STEP = 0.08  # un vrai souffle (ou une queue, des ailes) change au moins 8 % des pixels d'une image à l'autre


def hexrgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def frame_img(f):
    rows = f['rows']
    w, h = max(len(r) for r in rows), len(rows)
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    px = im.load()
    for y, r in enumerate(rows):
        for x, c in enumerate(r):
            if c != '.' and c in f['pal']:
                px[x, y] = hexrgb(f['pal'][c]) + (255,)
    return im


def placed(anim, im, W=200, H=200):
    """Image posée dans un cadre commun selon le décalage (ox, oy) de l'animation."""
    c = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    c.paste(im, (40 + anim.get('ox', 0), 40 + anim.get('oy', 0)))
    return c


def diff(a, b):
    """Part des pixels du personnage (opaques dans l'une ou l'autre) qui changent entre deux images."""
    pa, pb = a.get_flattened_data(), b.get_flattened_data()
    n = d = 0
    for x, y in zip(pa, pb):
        if x[3] or y[3]:
            n += 1
            if x != y:
                d += 1
    return d / n if n else 0


def count(im):
    return sum(1 for p in im.get_flattened_data() if p[3])


def check(data, out):
    os.makedirs(out, exist_ok=True)
    report, bad = {}, []
    for sprite, anims in sorted(data.items()):
        imgs = {k: [placed(a, frame_img(f)) for f in a['frames']] for k, a in anims.items()}
        idle0 = (imgs.get('idle') or imgs.get('walk') or [None])[0]
        rep = {}
        for k, fr in imgs.items():
            if len(fr) < 2:
                continue
            steps = [diff(fr[i], fr[i + 1]) for i in range(len(fr) - 1)]
            mean = sum(steps) / len(steps)
            spread = max(diff(fr[0], x) for x in fr[1:])
            # Images figées : identiques au repos, ou à la première image de l'action (pose de repos tenue).
            same_idle = max(sum(1 for x in fr if idle0 is not None and diff(x, idle0) < SAME), sum(1 for x in fr[1:] if diff(x, fr[0]) < SAME) + 1)
            base_n = count(idle0) if idle0 is not None else 0
            loss = max((1 - count(x) / base_n) for x in fr) if base_n else 0
            r = {'mean': round(mean, 3), 'spread': round(spread, 3), 'sameIdle': same_idle, 'n': len(fr), 'loss': round(loss, 3)}
            why = []
            if k in ACTIONS and mean < MIN_ACTION:
                why.append(f'figée ({mean:.3f} < {MIN_ACTION})')
            if k == 'idle' and (spread < MIN_IDLE or mean < MIN_IDLE_STEP):
                why.append(f'repos figé (variation {mean:.3f} par image)')
            if k in ACTIONS and same_idle > len(fr) / 2:
                why.append(f'{same_idle}/{len(fr)} images = repos')
            if k in ACTIONS and loss > LOSS:
                why.append(f'perd {loss:.0%} des pixels (arme ?)')
            if why:
                r['refus'] = why
                bad.append(f'{sprite}.{k} : ' + ', '.join(why))
            rep[k] = r
        report[sprite] = rep
        # Planche : une ligne par animation, toutes les images, recadrées sur l'ensemble.
        boxes = [x.getbbox() for fr in imgs.values() for x in fr if x.getbbox()]
        if not boxes:
            continue
        bx = (min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes))
        cw, ch = bx[2] - bx[0], bx[3] - bx[1]
        cols = max(len(fr) for fr in imgs.values())
        k2 = 2
        sheet = Image.new('RGBA', (110 + cols * (cw * k2 + 4), len(imgs) * (ch * k2 + 8)), (28, 30, 44, 255))
        dr = ImageDraw.Draw(sheet)
        for row, (k, fr) in enumerate(imgs.items()):
            y = row * (ch * k2 + 8)
            label = k + (' ✗' if rep.get(k, {}).get('refus') else '')
            dr.text((4, y + 4), f"{label}\n{rep.get(k, {}).get('mean', '')}", fill=(255, 120, 120) if '✗' in label else (230, 230, 230))
            for i, x in enumerate(fr):
                c = x.crop(bx).resize((cw * k2, ch * k2), Image.NEAREST)
                sheet.paste(c, (110 + i * (cw * k2 + 4), y + 4), c)
        sheet.save(os.path.join(out, f'{sprite}.png'))
    json.dump(report, open(os.path.join(out, 'rapport.json'), 'w'), ensure_ascii=False, indent=1)
    return report, bad


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    out = args[0] if args else os.path.join(ROOT, 'docs', 'animations')
    src = sys.argv[sys.argv.index('--json') + 1] if '--json' in sys.argv else os.path.join(out, 'frames.json')
    if '--json' not in sys.argv:
        os.makedirs(out, exist_ok=True)
        subprocess.run(['node', os.path.join(HERE, 'dump_ally_frames.mjs'), src], check=True, cwd=ROOT)
    _, bad = check(json.load(open(src)), out)
    print('\n'.join(bad) if bad else 'Toutes les animations passent.')
    print(f'{len(bad)} refus · planches : {out}')
    sys.exit(1 if bad else 0)
