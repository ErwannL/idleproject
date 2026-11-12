"""v9.4.0 : remplace ou ajoute des entrées de src/render/art.js à partir de PNG (sans regénérer tout le fichier, qui a
été retouché à la main au fil des versions). Usage : import_pngs({clé: (image PIL, extra)}) ; remove(clés)."""
import json, os, re
from lib import to_grid
from pixellab import _canvas

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ART = os.path.join(ROOT, 'src', 'render', 'art.js')


def _clean(img, crop=True):
    """Alpha franc (pixel art) : < 128 transparent, sinon opaque."""
    img = img.convert('RGBA')
    px = img.load()
    for y in range(img.height):
        for x in range(img.width):
            r, g, b, a = px[x, y]
            px[x, y] = (r, g, b, 255 if a >= 128 else 0)
    box = img.getbbox()
    return img.crop(box) if box and crop else img


def entries(items, crop=True):
    out = {}
    for key, (img, extra) in items.items():
        rows, pal = to_grid(_canvas(_clean(img, crop)))
        e = {'rows': rows}
        if pal:
            e['pal'] = pal
        e.update(extra or {})
        out[key] = e
    return out


def patch(new, remove=()):
    src = open(ART, encoding='utf-8').read()
    lines = src.split('\n')
    keyed = {}
    for i, l in enumerate(lines):
        m = re.match(r'  "([^"]+)": ', l)
        if m:
            keyed[m.group(1)] = i
    for k in remove:
        if k in keyed:
            lines[keyed[k]] = None
    for k, e in new.items():
        line = f'  {json.dumps(k)}: {json.dumps(e, ensure_ascii=False, separators=(",", ":"))},'
        if k in keyed:
            lines[keyed[k]] = line
        else:
            end = max(i for i, l in enumerate(lines) if l is not None and l.startswith('  "'))
            lines.insert(end + 1, line)
    open(ART, 'w', encoding='utf-8').write('\n'.join(l for l in lines if l is not None))
