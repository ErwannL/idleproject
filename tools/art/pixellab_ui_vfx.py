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
    body = {'description': desc + (' Seamless loop.' if loop else ' Plays once.') + STYLE, 'artist': 'lite', 'name': 'ascendrya_ui_' + name}
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
    # Cadre carré centré sur le centre de l'effet (le jeu centre l'effet sur un point).
    cx, cy = (box[0] + box[2]) / 2, (box[1] + box[3]) / 2
    if name.startswith('beam'):  # rayon : centré sur sa colonne la plus dense (les étincelles débordent d'un côté)
        cols = [sum(i * v for i, v in enumerate(f.getchannel('A').crop((x, 0, x + 1, f.height)).histogram())) for f in frames[:1] for x in range(f.width)]
        cx = max(range(len(cols)), key=cols.__getitem__) + 0.5
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
