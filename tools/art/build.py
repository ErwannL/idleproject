"""Génère tout l'art v5 :
  src/render/art.js  (grilles des sprites : chevalier, ennemis, boss, compagnons, icônes)
  assets/bg/*.png    (calques de décor par zone)
Usage : python3 tools/art/build.py
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)

from lib import to_grid  # noqa: E402
import knight  # noqa: E402
import scenery  # noqa: E402
import worldmap  # noqa: E402

modules = [knight]
for name in ('enemies', 'icons', 'accessories', 'allies_r', 'allies_sr', 'allies_ssr',
             'bosses_mega', 'bosses_classic', 'brutes', 'minibosses', 'bosses_mid', 'bosses_hard',
             'enemies2', 'bosses_w78', 'bosses_w910', 'fixes'):  # les derniers remplacent les anciens sprites
    try:
        modules.append(__import__(name))
    except ImportError:
        print(f'(module {name} absent : ignoré)')

sprites = {}
for mod in modules:
    for key, (canvas, extra) in mod.build().items():
        rows, pal = to_grid(canvas)
        entry = {'rows': rows}
        if pal:
            entry['pal'] = pal
        entry.update(extra)
        sprites[key] = entry

lines = [
    '// FICHIER GÉNÉRÉ par tools/art/build.py — ne pas modifier à la main.',
    '// Sprites v5 (grilles + palettes locales). Caractères réservés : voir tools/art/lib.py (TINT).',
    'export const ART = {',
]
for key in sorted(sprites):
    lines.append(f'  {json.dumps(key)}: {json.dumps(sprites[key], ensure_ascii=False, separators=(",", ":"))},')
lines.append('};')
lines.append('')
out = os.path.join(ROOT, 'src', 'render', 'art.js')
with open(out, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))
print(f'{len(sprites)} sprites -> {os.path.relpath(out, ROOT)} ({os.path.getsize(out) // 1024} Ko)')

bg_dir = os.path.join(ROOT, 'assets', 'bg')
for old in os.listdir(bg_dir) if os.path.isdir(bg_dir) else []:
    if old.endswith('.png'):
        os.remove(os.path.join(bg_dir, old))
manifest = scenery.build(bg_dir)
with open(os.path.join(ROOT, 'src', 'render', 'bg.js'), 'w', encoding='utf-8') as f:
    f.write('// FICHIER GÉNÉRÉ par tools/art/build.py — ne pas modifier à la main.\n')
    f.write('// Décor de chaque zone : dégradé du ciel, couleur du sol et calques (assets/bg), du fond vers l\'avant.\n')
    f.write('// anchor "ground" : y relatif à la ligne du sol ; "top" : y depuis le haut ; factor : parallaxe.\n')
    f.write('export const BG = ' + json.dumps(manifest, ensure_ascii=False, indent=2) + ';\n')
print(f'{sum(len(z["layers"]) for z in manifest.values())} calques de décor -> assets/bg/ + src/render/bg.js')
os.makedirs(os.path.join(ROOT, 'assets', 'ui'), exist_ok=True)
worldmap.build(os.path.join(ROOT, 'assets', 'ui', 'worldmap.png'))
print('carte du monde -> assets/ui/worldmap.png')
