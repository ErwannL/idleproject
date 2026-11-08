#!/usr/bin/env python3
# v9.3.0 : images du site public (site/assets/) tirées des assets du jeu, optimisées en WebP.
#   python3 tools/site-assets.py
# - px/<id>.webp    : illustrations HD pixel (assets/hd/px/thumb, taille native, sans perte) : le site les agrandit
#                     au plus proche voisin (image-rendering: pixelated), d'où des fichiers de quelques Ko.
# - real/<id>.webp  : peintures réalistes (assets/hd/real), 480 px de large, qualité 82.
# - boss/<id>.webp  : sprites des boss (assets/sprites/boss_*.png), natifs, sans perte.
# - wb/<nom>.webp   : planches du Colosse des Anciens (assets/world-boss), sans perte.
# - shop/<nom>.webp : icônes de la boutique (assets/ui/shop), sans perte.
# - vfx/<nom>.webp  : quelques effets (assets/ui/vfx) pour le décor.
import os, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A = os.path.join(ROOT, 'assets')
OUT = os.path.join(ROOT, 'site', 'assets')

def save(im, rel, **kw):
    path = os.path.join(OUT, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path, 'WEBP', **kw)
    return os.path.getsize(path)

total = 0
for f in sorted(os.listdir(os.path.join(A, 'hd', 'px', 'thumb'))):
    if f.endswith('.webp'):
        total += save(Image.open(os.path.join(A, 'hd', 'px', 'thumb', f)).convert('RGBA'), f'px/{f}', lossless=True, method=6)
for f in sorted(os.listdir(os.path.join(A, 'hd', 'real'))):
    im = Image.open(os.path.join(A, 'hd', 'real', f)).convert('RGBA')
    w = 480
    im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    total += save(im, f'real/{os.path.splitext(f)[0]}.webp', quality=82, method=6)
BOSSES = ['slime_king', 'alpha_wolf', 'bone_lord', 'ash_dragon', 'fallen_knight', 'demon_king', 'swamp_behemoth',
          'sky_titan', 'phoenix', 'void_emperor', 'magma_colossus', 'obsidian_tyrant', 'frost_wyrm', 'spectral_queen',
          'crypt_archlich', 'rotting_dryad']
for b in BOSSES:
    p = os.path.join(A, 'sprites', f'boss_{b}.png')
    if os.path.exists(p):
        total += save(Image.open(p).convert('RGBA'), f'boss/{b}.webp', lossless=True, method=6)
for f in ['colossus_idle', 'colossus_attack', 'colossus_beam', 'colossus_throw', 'colossus_fury']:
    p = os.path.join(A, 'world-boss', f + '.png')
    if os.path.exists(p):
        total += save(Image.open(p).convert('RGBA'), f'wb/{f}.webp', lossless=True, method=6)
SHOP = ['crystal_premium', 'crystal_large', 'hero_ticket_limited', 'hero_ticket_permanent', 'pet_ticket', 'pet_pack_premium',
        'skin_legendary', 'skin_mythic', 'cosmetic_pack_legendary', 'theme_legendary', 'crystal_medium', 'pet_pack_large']
for s in SHOP:
    total += save(Image.open(os.path.join(A, 'ui', 'shop', s + '.png')).convert('RGBA'), f'shop/{s}.webp', lossless=True, method=6)
for v in ['aura_legend', 'aura_epic', 'beam_legend', 'beam_epic', 'beam_rare', 'rune', 'star_shine', 'spark', 'ring', 'transcend', 'trophy', 'unlock', 'talent_node']:
    p = os.path.join(A, 'ui', 'vfx', v + '.webp')
    if os.path.exists(p):
        total += save(Image.open(p).convert('RGBA'), f'vfx/{v}.webp', lossless=True, method=6)
print(f'site/assets : {total / 1024:.0f} Ko écrits')
