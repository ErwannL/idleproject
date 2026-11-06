"""v9.2.6 : effets animés de l'interface et de la carte (PixelLab, point d'accès /v2/vfx, artiste « lite »).

Deux étapes :
  python3 tools/art/pixellab_ui_vfx.py gen [nom…]   génère les effets manquants (ou ceux nommés) avec PixelLab ;
                                                   sources brutes dans tools/art/pixellab/ui_vfx/<nom>.png/.json
  python3 tools/art/pixellab_ui_vfx.py build        planches WebP dans assets/ui/vfx/<nom>.webp (images côte à côte,
                                                   cadre commun recadré) + catalogue src/ui/ui-vfx-sheets.js
                                                   + points animés de la carte (eau, lave, étoiles) tirés de
                                                   assets/ui/worldmap.png.
Clé : variable d'environnement PIXELLAB_API_KEY (jamais affichée ni écrite). Une génération par effet (lite).
"""
import base64
import io
import json
import os
import sys
import time
import urllib.error
import urllib.request

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
SRC = os.path.join(HERE, 'pixellab', 'ui_vfx')
OUT = os.path.join(ROOT, 'assets', 'ui', 'vfx')
JS = os.path.join(ROOT, 'src', 'ui', 'ui-vfx-sheets.js')
API = 'https://api.pixellab.ai/v2'

STYLE = ' Retro 16-bit pixel art, crisp pixels, transparent background, no text, no character, centered.'
# nom → (description, boucle ?, taille max du côté en pixels après recadrage)
EFFECTS = {
    'coin': ('A single shiny gold coin spinning in place on its vertical axis, full 360 degree turn, warm yellow and orange with a bright white glint, small, looping.', True, 32),
    'gem': ('A single faceted blue-cyan gemstone spinning in place, sparkling white glints on its facets, small, looping.', True, 32),
    'spark': ('A small four-pointed white-gold star sparkle that pops, grows and shrinks quickly, a short twinkle, small.', False, 32),
    'burst': ('A radial burst of golden light: bright gold rays and tiny star sparkles shoot outward from the center then fade, short celebratory reward pop.', False, 96),
    'confetti': ('Festive confetti and gold coins pop out from the center and fall with gravity, colourful (gold, red, cyan, green), short celebration.', False, 96),
    'levelup': ('Level up effect: a golden column of light rises from the bottom with sparkles and upward arrows of light, bright yellow and white, then fades.', False, 96),
    'unlock': ('Unlock effect: a cyan and white ring of magic light expands outward with sparkles, like a padlock opening, short.', False, 96),
    'trophy': ('Achievement shine: golden glowing laurel wreath ring with star sparkles spinning around it, bright gold, short celebratory effect.', False, 96),
    'chest': ('Clearly visible brown wooden treasure chest with gold metal bands, seen from the front, about half the canvas wide: its lid swings open, a bright golden glow and gold coins burst up out of it, then the glow fades while the open chest stays visible.', False, 96),
    'portal': ('A swirling magic summoning portal seen from the front: a rotating vortex ring of violet, magenta and blue energy with sparkles spiralling inward, looping.', True, 128),
    'beam_rare': ('A vertical pillar of blue light beam shining down from the top to the bottom, glowing white core, sparkles drifting upward, looping.', True, 128),
    'beam_epic': ('A vertical pillar of purple-violet light beam shining down from the top to the bottom, glowing white core, sparkles drifting upward, looping.', True, 128),
    'beam_legend': ('A vertical pillar of golden light beam shining down from the top to the bottom, glowing white core, gold sparkles drifting upward, looping.', True, 128),
    'legend_blast': ('Legendary reveal explosion: a huge golden starburst with white flash, radiating rays and star shaped sparkles flying outward, then fades.', False, 128),
    'aura': ('Looping magical golden aura: soft glowing particles and tiny stars rising slowly in a circle around an empty center, warm gold and white.', True, 96),
    'fusion': ('Fusion effect: two glowing orbs (one purple, one cyan) spiral toward each other, merge in the center with a bright white flash and a ring of sparkles.', False, 96),
    'forge': ('Blacksmith upgrade success: bright orange and yellow sparks fly upward from an anvil strike point, with a white flash, short.', False, 96),
    'equip': ('A quick shine: a white diagonal glint sweeps across and a small four-pointed star sparkle flashes at the corner, short.', False, 64),
    'recycle': ('Dissolve effect: something breaks into small green and teal pixel particles that swirl upward and vanish, short.', False, 96),
    'flame': ('A small burning torch flame, bright orange, yellow and red, flickering in place, looping.', True, 32),
    'flag': ('A small triangular red pennant flag with a gold trim and a dark outline, on a thin brown wooden pole, the cloth rippling and waving in the wind with visible folds and shading, looping.', True, 32),
    'ring': ('A golden ring wave pulse expanding outward from the center and fading, like a map location beacon, looping.', True, 64),
    'star': ('A tiny white and pale blue star twinkling, growing and shrinking, looping.', True, 16),
    'cloud': ('A small fluffy white pixel art cloud with soft light grey shading, gently morphing, looping.', True, 64),
    'smoke': ('A thin column of dark grey volcanic smoke puffs rising and fading, looping.', True, 48),
    'rune': ('A magic rune circle of golden glyphs rotating slowly, with soft glow, looping loading indicator.', True, 64),
}


# v9.2.6 (2e vague) : effets supplémentaires (ressources, fiches, écrans clés, carte, retour hors ligne).
EFFECTS.update({
    'gold_shine': ('Only light, no object: three small bright white and pale gold four-pointed star glints pop one after another around the center, with a soft warm golden glow pulse, short.', False, 48),
    'gem_twinkle': ('A tiny four-pointed cyan and white star twinkle that flashes on a gemstone facet, short.', False, 24),
    'speed_flame': ('A small blue and orange speed flame trail flickering fast to the right, looping.', True, 32),
    'aura_common': ('Looping soft aura: a thin ring of gentle pale blue light wisps and sparkles circling around a large empty center (the empty center is 60 percent of the canvas), calm.', True, 96),
    'aura_epic': ('Looping magical aura around an empty center: purple and magenta light flames rising in a ring with sparkles.', True, 96),
    'aura_legend': ('Looping powerful aura: a ring of small golden and orange light flames and bright white sparkles circling around a large empty center (the empty center is 60 percent of the canvas).', True, 96),
    'star_shine': ('A small yellow five-pointed star shines: a white glint flashes on it and tiny sparkles pop around, short.', False, 24),
    'frame_legend': ('Looping animated square picture frame border made of golden light: sparkles run around the edge of a square, empty center.', True, 96),
    'frame_epic': ('Looping animated square picture frame border made of violet light: small sparkles run around the edge of a square, empty center.', True, 96),
    'sheen': ('A diagonal white light sheen stripe sweeps from the left to the right across an empty square, short shine.', False, 64),
    'tower_bg': ('Looping mystical background ambience: violet and blue magic motes and small runes slowly floating upward, sparse, dark transparent space.', True, 128),
    'floor_up': ('Floor cleared effect: a violet and gold upward arrow of light with a ring burst and sparkles rising, short.', False, 96),
    'dungeon_portal': ('A dark stone dungeon doorway portal swirling with red and orange magical energy, looping.', True, 96),
    'depart': ('Departure effect: a puff of dust clouds and small footprints of light heading to the right, short.', False, 64),
    'return': ('Return home effect: a green and gold sparkle burst with a small bag icon of light popping up, short.', False, 64),
    'talent_node': ('Talent unlocked: a small green and gold rune circle lights up with a bright flash and a ring of sparkles, short.', False, 64),
    'talent_spark': ('A tiny bright golden energy spark orb with a short glowing tail, looping, small.', True, 16),
    'rebirth': ('Big phoenix rebirth effect: a fiery orange and gold phoenix of flames rises from the center with wings spreading wide, flames and embers burst outward, then fades.', False, 160),
    'transcend': ('Big transcendence effect: a pillar of white and violet celestial light with an expanding halo ring and constellation stars, ascending energy, then fades.', False, 160),
    'mail_open': ('A small cream paper envelope with a red wax seal opens its flap and a glowing letter slides up out of it with sparkles.', False, 64),
    'bird': ('A small white seagull bird flying, flapping its wings, side view, flying to the right, looping.', True, 16),
    'dragon': ('A tiny red dragon flying with flapping wings, side view facing right, looping.', True, 32),
    'boat': ('A tiny wooden sailing boat with a white sail, side view, gently rocking up and down; only the boat, no water, no waves, no background, looping.', True, 24),
    'eruption': ('Small volcano eruption: lava and orange fire bursts upward from a crater point with dark smoke and glowing rocks flying, then fades.', False, 48),
    'coin_rain': ('Gold coins rain down from the top and bounce, many small shiny coins falling with gravity, short.', False, 96),
})
ICONS = ['icon_hero', 'icon_map', 'icon_summon', 'icon_trophy', 'icon_upgrade', 'skill_quick', 'icon_tree', 'icon_bag', 'icon_paw',
         'icon_expedition', 'icon_dungeon', 'icon_tower', 'icon_boss', 'icon_book', 'icon_mail']
for _ic in ICONS:  # icône animée : l'icône du jeu, animée sur place (reflet, éclat), 1 génération chacune
    EFFECTS['ic_' + _ic] = ('Idle animation of this small game menu icon: keep the icon exactly the same shape, colors and position; a bright '
                            'white shine glint sweeps diagonally across it and a tiny star sparkle twinkles at its corner, then it rests. Looping.', True, 40)


def _sprite_b64(name):
    im = Image.open(os.path.join(ROOT, 'assets', 'sprites', name + '.png')).convert('RGBA')
    pad = Image.new('RGBA', (40, 40))
    pad.paste(im, ((40 - im.width) // 2, (40 - im.height) // 2))
    b = io.BytesIO()
    pad.save(b, 'PNG')
    return {'type': 'base64', 'base64': base64.b64encode(b.getvalue()).decode(), 'format': 'png'}


def _req(method, url, body=None, auth=True):
    headers = {'Content-Type': 'application/json'}
    if auth:
        headers['Authorization'] = 'Bearer ' + os.environ['PIXELLAB_API_KEY']
    r = urllib.request.Request(url if url.startswith('http') else API + url, method=method,
                               data=json.dumps(body).encode() if body else None, headers=headers)
    try:
        with urllib.request.urlopen(r, timeout=180) as f:
            data = f.read()
            return data if not auth else json.loads(data)
    except urllib.error.HTTPError as e:
        return {'error': e.code, 'body': e.read().decode()[:300]}


def generate(name):
    desc, loop, _ = EFFECTS[name]
    style = STYLE.replace(' no character,', '')
    body = {'description': desc + (' Seamless loop.' if loop else ' Plays once.') + style, 'artist': 'lite', 'name': 'ascendrya_ui_' + name}
    if name.startswith('ic_'):
        body['sprite'] = _sprite_b64(name[3:])
    for _ in range(40):
        j = _req('POST', '/vfx', body)
        if j.get('error') not in (429, 503):
            break
        time.sleep(15)
    if 'error' in j:
        print(name, 'erreur', j, flush=True)
        return False
    jid = j['background_job_id']
    for _ in range(120):
        time.sleep(8)
        s = _req('GET', f'/background-jobs/{jid}')
        if s.get('status') in ('completed', 'failed'):
            break
    if s.get('status') != 'completed':
        print(name, 'échec', str(s)[:200], flush=True)
        return False
    files = s['last_response'].get('files') or {}
    items = files.items() if isinstance(files, dict) else [(f.get('name', ''), f.get('url')) for f in files]
    got = {}
    for fname, url in items:
        url = url.get('url') if isinstance(url, dict) else url
        for ext in ('.png', '.json'):
            if fname.endswith(ext) and not fname.endswith('-normals.png') and url:
                got[ext] = _req('GET', url, auth=False)
    if '.png' not in got or '.json' not in got:
        print(name, 'fichiers manquants', list(dict(items)), flush=True)
        return False
    os.makedirs(SRC, exist_ok=True)
    open(os.path.join(SRC, name + '.png'), 'wb').write(got['.png'])
    open(os.path.join(SRC, name + '.json'), 'wb').write(got['.json'])
    print(name, 'ok', flush=True)
    return True


def _frames(name):
    sheet = Image.open(os.path.join(SRC, name + '.png')).convert('RGBA')
    meta = json.load(open(os.path.join(SRC, name + '.json')))
    fr = meta.get('frames')
    rects, durs = [], []
    if isinstance(fr, dict):
        fr = list(fr.values())
    for f in fr:
        r = f.get('frame', f)
        rects.append((r['x'], r['y'], r['x'] + r['w'], r['y'] + r['h']))
        durs.append(f.get('duration', 83))
    return [sheet.crop(r) for r in rects], durs


def build_sheet(name):
    _, loop, side = EFFECTS[name]
    frames, durs = _frames(name)
    # Poussières presque transparentes retirées, puis cadre commun à toutes les images.
    for f in frames:
        a = f.getchannel('A').point(lambda v: 0 if v < 24 else v)
        f.putalpha(a)
    box = None
    for f in frames:
        b = f.getbbox()
        if b:
            box = b if box is None else (min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3]))
    if box is None:
        return None
    if name.startswith('ic_'):
        # Icône animée : cadre = l'icône d'origine (même taille que assets/sprites/<icône>.png), retrouvée dans la
        # 1re image ; le reflet est ainsi masqué par le cadre et l'icône remplace l'image fixe sans décalage.
        src = Image.open(os.path.join(ROOT, 'assets', 'sprites', name[3:] + '.png'))
        f0 = frames[0]
        sa = src.convert('RGBA').getchannel('A')
        bb = f0.getchannel('A').point(lambda v: 255 if v else 0)
        scores = {}
        for y in range(0, f0.height - src.height + 1):
            for x in range(0, f0.width - src.width + 1):
                c = bb.crop((x, y, x + src.width, y + src.height))
                scores[(x, y)] = sum(1 for a, b2 in zip(c.tobytes(), sa.tobytes()) if (a > 0) == (b2 > 0))
        x, y = max(scores, key=scores.get)
        box = (x, y, x + src.width, y + src.height)
    # Cadre carré centré sur le centre de l'effet (le jeu centre l'effet sur un point).
    cx, cy = (box[0] + box[2]) / 2, (box[1] + box[3]) / 2
    if name.startswith('ic_'):
        cx, cy = None, None
    if name.startswith('beam'):  # rayon : centré sur sa colonne la plus dense (les étincelles débordent d'un côté)
        cols = [sum(i * v for i, v in enumerate(f.getchannel('A').crop((x, 0, x + 1, f.height)).histogram())) for f in frames[:1] for x in range(f.width)]
        cx = max(range(len(cols)), key=cols.__getitem__) + 0.5
    if cx is not None:
        half = max(box[2] - box[0], box[3] - box[1]) / 2
        box = (int(cx - half), int(cy - half), int(cx + half + 0.999), int(cy + half + 0.999))
    frames = [f.crop(box) for f in frames]
    w = frames[0].width
    if w > side:  # réduction au plus proche par un facteur entier (garde les pixels nets)
        k = -(-w // side)
        frames = [f.resize((max(1, f.width // k), max(1, f.height // k)), Image.NEAREST) for f in frames]
    w, h = frames[0].size
    strip = Image.new('RGBA', (w * len(frames), h))
    for i, f in enumerate(frames):
        strip.paste(f, (i * w, 0))
    os.makedirs(OUT, exist_ok=True)
    strip.save(os.path.join(OUT, name + '.webp'), 'WEBP', lossless=True, quality=100, method=6)
    ms = sum(durs) / max(1, len(durs))
    return {'w': w, 'h': h, 'n': len(frames), 'fps': max(6, min(30, round(1000 / ms))), 'loop': loop}


def map_points():
    """Pixels animés de la carte (240×130) : eau (scintille), lave (pulse), étoiles du Néant (clignotent)."""
    im = Image.open(os.path.join(ROOT, 'assets', 'ui', 'worldmap.png')).convert('RGB')
    W, H = im.size
    px = im.load()
    water, lava, stars = [], [], []
    for y in range(1, H - 1):
        for x in range(1, W - 1):
            r, g, b = px[x, y]
            if b > 140 and r < 90 and 80 < g < 160 and (x * 7 + y * 13) % 11 == 0:
                water.append((x, y))
            elif r > 200 and 80 < g < 190 and b < 80:
                lava.append((x, y))
            elif r > 200 and g > 200 and b > 200 and 125 < x < 170 and 5 < y < 60:
                stars.append((x, y))
    return {'w': W, 'h': H, 'water': water[::2], 'lava': lava, 'stars': stars}


def build():
    sheets = {}
    for name in EFFECTS:
        if os.path.exists(os.path.join(SRC, name + '.png')):
            m = build_sheet(name)
            if m:
                sheets[name] = m
    pts = map_points()
    with open(JS, 'w') as f:
        f.write('// v9.2.6 : généré par tools/art/pixellab_ui_vfx.py (ne pas modifier à la main).\n')
        f.write('// Planches assets/ui/vfx/<nom>.webp : n images de w×h côte à côte, fps, boucle.\n')
        f.write('export const SHEETS = ' + json.dumps(sheets, separators=(',', ':')) + ';\n')
        f.write('// Carte peinte (assets/ui/worldmap.png) : pixels d\'eau, de lave et d\'étoiles animés.\n')
        f.write('export const MAP_FX = ' + json.dumps(pts, separators=(',', ':')).replace('[', '[').replace('(', '[') + ';\n')
    print(len(sheets), 'planches ;', len(pts['water']), 'eau,', len(pts['lava']), 'lave,', len(pts['stars']), 'étoiles')


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'build'
    if cmd == 'gen':
        names = sys.argv[2:] or [n for n in EFFECTS if not os.path.exists(os.path.join(SRC, n + '.png'))]
        from concurrent.futures import ThreadPoolExecutor
        with ThreadPoolExecutor(4) as ex:
            list(ex.map(generate, names))
    else:
        build()
