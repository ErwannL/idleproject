"""v9.7.1 (lot C) : planches de contrôle des animations ennemies générées (toutes les images côte à côte, vue de
référence en tête, ligne des pieds). Usage : python3 tools/art/pl971_sheets.py <nom> <clé_anim> [clé_anim ...]
(clé_anim : dossier de tools/art/pixellab/anim, ex. boss_leviathan_skill)."""
import os, sys
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__))
ANIM = os.path.join(HERE, 'pixellab', 'anim')
OUT = os.path.join(HERE, 'pixellab971')
rows = []
for d in sys.argv[2:]:
    p = os.path.join(ANIM, d)
    if not os.path.isdir(p): continue
    fr = [Image.open(os.path.join(p, f)).convert('RGBA') for f in sorted(os.listdir(p), key=lambda s: int(s[1:-4]) if s[1:-4].isdigit() else 0) if f.endswith('.png')]
    rows.append((d, fr))
W = max(f.width for _, fr in rows for f in fr); H = max(f.height for _, fr in rows for f in fr)
cols = max(len(fr) for _, fr in rows)
img = Image.new('RGBA', (180 + cols * W, len(rows) * (H + 4)), (34, 36, 52, 255))
dr = ImageDraw.Draw(img)
for j, (d, fr) in enumerate(rows):
    y = j * (H + 4); dr.text((4, y + 4), d, fill=(255, 255, 255))
    for i, f in enumerate(fr): img.alpha_composite(f, (180 + i * W, y + H - f.height))
os.makedirs(OUT, exist_ok=True)
img.save(os.path.join(OUT, f'sheet_{sys.argv[1]}.png')); print(os.path.join(OUT, f'sheet_{sys.argv[1]}.png'))
