"""v9.2.0 (monde marin) : génère seulement l'art du Royaume englouti et le fusionne dans src/render/art.js et
src/render/bg.js (sans régénérer les autres sprites). La génération complète (build.py) inclut aussi ces modules.
Usage : python3 tools/art/ocean_build.py
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)

from lib import to_grid  # noqa: E402
import ocean  # noqa: E402
import ocean_scenery  # noqa: E402
from scenery import haze, save_png  # noqa: E402

art = os.path.join(ROOT, 'src', 'render', 'art.js')
lines = open(art, encoding='utf-8').read().split('\n')
entries = {}
for key, (canvas, extra) in ocean.build().items():
    rows, pal = to_grid(canvas)
    e = {'rows': rows}
    if pal:
        e['pal'] = pal
    e.update(extra)
    entries[key] = f'  {json.dumps(key)}: {json.dumps(e, ensure_ascii=False, separators=(",", ":"))},'
body = [l for l in lines if not any(l.startswith(f'  {json.dumps(k)}:') for k in entries)]
start = body.index('export const ART = {') + 1
end = body.index('};', start)
items = body[start:end] + list(entries.values())
items.sort(key=lambda l: json.loads(l.split(': ', 1)[0].strip()))
out = body[:start] + items + body[end:]
open(art, 'w', encoding='utf-8').write('\n'.join(out))
print(f'{len(entries)} sprites du monde marin -> src/render/art.js')

bgjs = os.path.join(ROOT, 'src', 'render', 'bg.js')
src = open(bgjs, encoding='utf-8').read()
i = src.index('export const BG = ') + len('export const BG = ')
manifest = json.loads(src[i:src.rindex(';')])
sky, ground, layers = ocean_scenery.zone_ocean()
entries = []
for lay in layers:
    if lay['name'] == 'near':
        haze(lay['canvas'], ocean_scenery.NEAR_VEIL['ocean'], 0.1)
    fname = f"ocean_{lay['name']}.png"
    save_png(lay['canvas'], os.path.join(ROOT, 'assets', 'bg', fname))
    e = {'file': fname, 'factor': lay['factor'], 'anchor': lay['anchor'], 'y': lay['y'], 'front': lay['front']}
    if lay['drift']:
        e['drift'] = lay['drift']
    entries.append(e)
manifest['ocean'] = {'sky': sky, 'ground': ground, 'layers': entries}
open(bgjs, 'w', encoding='utf-8').write(src[:i] + json.dumps(manifest, ensure_ascii=False, indent=2) + ';\n')
print(f'{len(entries)} calques -> assets/bg/ocean_*.png + src/render/bg.js')
