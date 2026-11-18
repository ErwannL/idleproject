"""v9.8.1 (D) : Paladin d'azur — couleur dominante changée (armure bleu roi → turquoise profond), pour qu'il ne rappelle
plus un héros célèbre de RPG tactique (cheveux et cape bleus). Décale la teinte des bleus de toutes ses images
(sprite, animations, gestes de compétence). Usage : python3 tools/art/recolor_azure.py"""
import colorsys, json, re
FILES = ['src/render/art.js', 'src/render/art-anim-allies.js', 'src/render/art-anim-allies-extra.js', 'src/render/art-anim-skills.js']
def shift(hexc):
    r, g, b = (int(hexc[i:i + 2], 16) / 255 for i in (1, 3, 5))
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    if not (0.55 <= h <= 0.70 and s > 0.25): return hexc  # bleus seulement
    h = 0.47  # turquoise
    s = min(1, s * 0.95)
    r, g, b = colorsys.hls_to_rgb(h, l, s)
    return '#%02x%02x%02x' % (round(r * 255), round(g * 255), round(b * 255))
n = 0
for f in FILES:
    src = open(f).read()
    # Palettes : objets « "nom": {"x":"#rrggbb", …} » (palette partagée) ou clé "pal" d'un sprite.
    def recolor(m):
        global n
        n += 1
        return re.sub(r'#[0-9a-fA-F]{6}', lambda c: shift(c.group(0)), m.group(0))
    src = re.sub(r'"(?:sk_)?ally_azure_paladin[a-z0-9_]*":\s*\{"[^"]{1,2}":"#[0-9a-fA-F]{6}"[^{}]*\}', recolor, src)
    src = re.sub(r'("(?:sk_)?ally_azure_paladin[a-z0-9_]*":\s*\{"rows":\[[^\]]*\],"pal":)(\{[^{}]*\})', lambda m: m.group(1) + recolor(type('M', (), {'group': lambda self, i=0: m.group(2)})()), src)
    open(f, 'w').write(src)
print('images recolorées :', n)
