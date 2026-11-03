"""v9.2.0 (nage) : génère seulement les sprites de nage (swim.py) et les fusionne dans src/render/art.js sans régénérer
les autres sprites. La génération complète (build.py) inclut aussi ce module.
Usage : python3 tools/art/swim_build.py
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)

from lib import to_grid  # noqa: E402
import swim  # noqa: E402

art = os.path.join(ROOT, 'src', 'render', 'art.js')
lines = open(art, encoding='utf-8').read().split('\n')
entries = {}
for key, (canvas, extra) in swim.build().items():
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
print(f'{len(entries)} sprites de nage -> src/render/art.js')

