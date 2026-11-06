"""v9.2.6 : effets visuels de COMBAT dessinés image par image par PixelLab (point d'accès /v2/vfx, artiste « lite »).

Impacts par arme et par élément, critiques, projectiles, morts, butin, niveau, soins, auras, apparition des boss,
poussières. La table VFX (nom -> [taille cible en pixels de jeu, description]) est la source unique.

Sources : tools/art/pixellab/vfx/<nom>.png (planche horizontale renvoyée par PixelLab) + <nom>.json (images, durées).
Construction : chaque image est recadrée sur la boîte commune de l'effet, réduite à la taille cible (pixels nets),
alpha franc, couleurs ramenées à 48 teintes communes, puis tout est rangé dans un atlas PNG indexé, embarqué en
base64 dans src/render/art-vfx.js (lu par src/render/vfx.js).

Usage :
  PIXELLAB_API_KEY=… python3 tools/art/pixellab_vfx.py gen [noms…]   génère les effets manquants (ou ceux nommés)
  python3 tools/art/pixellab_vfx.py build                             écrit src/render/art-vfx.js
  python3 tools/art/pixellab_vfx.py bal                               crédits restants
La clé n'est jamais affichée ni écrite.
"""
import base64
import io
import json
import os
import sys
import time
import urllib.request

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
SRC = os.path.join(HERE, 'pixellab', 'vfx')
OUT = os.path.join(ROOT, 'src', 'render', 'art-vfx.js')
API = 'https://api.pixellab.ai/v2'

STYLE = ('Crisp retro 16-bit pixel art game effect, side view, bright saturated fantasy palette, '
         'dark outline accents, transparent background, no character, effect only, centered. ')
# nom -> [taille cible (plus grand côté, pixels de jeu), description]
VFX = {
    # Impacts par arme
    'hit_slash': [30, 'a white and pale blue crescent sword slash impact, a sharp diagonal arc that flashes and fades with a few sparks, 6 frames, fast'],
    'hit_pierce': [26, 'a quick piercing thrust impact: a narrow horizontal white spear streak that punches forward into a small star burst, 6 frames'],
    'hit_blunt': [30, 'a heavy blunt hammer impact: round yellow-white shockwave puff with small debris and stars radiating out, 6 frames'],
    'hit_arrow': [20, 'a small arrow impact: a tiny white and beige spark burst with splinters flying, 5 frames, very fast'],
    # Impacts par élément
    'hit_fire': [32, 'a fire impact explosion: orange and yellow flames burst outward then curl up into dark smoke and embers, 8 frames'],
    'hit_ice': [30, 'an ice impact: pale blue ice crystals and shards shatter outward from a frosty burst, white highlights, 8 frames'],
    'hit_thunder': [32, 'a lightning impact: bright white and cyan electric burst with zigzag sparks crackling outward, 7 frames'],
    'hit_poison': [28, 'a poison impact: toxic green splash with bubbling droplets and a small green gas puff, 8 frames'],
    'hit_shadow': [30, 'a shadow magic impact: dark purple and violet void burst with swirling wisps converging then dispersing, 8 frames'],
    'hit_holy': [32, 'a holy light impact: golden yellow and white radiant burst with a cross shaped glint and rising light motes, 8 frames'],
    # Critique
    'crit_flash': [40, 'a critical hit flash: a big golden star shaped burst with sharp white rays that pops very fast and fades, 6 frames'],
    'crit_wave': [48, 'a critical hit shockwave: an expanding golden and white ring wave seen slightly from the side, oval, growing and fading, 7 frames'],
    # Projectiles (boucles, vers la droite)
    'proj_arrow': [16, 'a flying wooden arrow pointing right with a soft white motion trail behind it, looping 4 frames, horizontal'],
    'proj_fireball': [20, 'a flying fireball moving to the right, bright yellow core, orange flames and a flickering flame trail on the left, looping 6 frames'],
    'proj_bolt': [24, 'a flying electric orb projectile moving to the right: round white hot core with cyan crackling sparks around it and a short jagged cyan lightning tail on the left, looping 6 frames'],
    'proj_soul': [18, 'a flying ghostly green soul wisp moving to the right with a wavy spectral trail, looping 6 frames'],
    'proj_ice': [18, 'a flying ice shard projectile moving to the right, pale blue crystal with frosty sparkle trail, looping 4 frames'],
    # Morts
    'death_smoke': [36, 'an enemy defeat poof: a round puff of grey and lavender smoke clouds bursting out then dissipating, 8 frames'],
    'death_soul': [30, 'a small ghostly white and pale cyan soul wisp rising upward and fading away, with a faint trail, 8 frames, vertical'],
    'boss_explode': [64, 'a big boss defeat explosion: large fiery orange and yellow blast with smoke ring and flying debris, then dark smoke, 10 frames'],
    # Butin
    'loot_coin': [12, 'a spinning gold coin, shiny yellow with white glint, looping 6 frames, small'],
    'loot_gem': [12, 'a sparkling cyan blue gem crystal rotating with a white twinkle, looping 6 frames, small'],
    'loot_shine': [24, 'a twinkling sparkle glint: a thin four pointed white star with a few tiny pixel sparkles around it, growing and shrinking, no ring, no circle, mostly empty, looping 6 frames'],
    'loot_burst': [32, 'a loot drop burst: upward fountain of golden sparkles and little stars bursting out, 7 frames'],
    # Héros
    'level_up': [56, 'a level up effect: golden rising pillar of light with spiraling sparkles and upward arrows of light, 10 frames, vertical'],
    'heal': [36, 'a healing effect: soft green and white plus signs and light motes rising upward with a gentle glow, 8 frames, vertical'],
    'buff_aura': [40, 'a subtle power up buff aura: thin golden ellipse on the ground with a few small golden light motes and short vertical light streaks rising from it, sparse and airy, looping 6 frames, empty center'],
    'debuff_aura': [40, 'a debuff curse aura at ground level: dark purple downward dripping wisps and skull-like smoke ring around a character spot, looping 6 frames, empty center'],
    'boss_appear': [72, 'a boss summoning portal: dark red and black magic circle on the ground erupting with crimson flames and lightning, 10 frames'],
    # Poussières
    'dust_step': [12, 'a tiny dust puff kicked up from a footstep on the ground, beige and grey, 5 frames, very small'],
    'dust_land': [28, 'a landing dust cloud: beige and grey dust puffs spreading left and right along the ground, 6 frames, wide and low'],
}


def _key():
    k = os.environ.get('PIXELLAB_API_KEY')
    if not k:
        sys.exit('PIXELLAB_API_KEY manquante')
    return k


def _req(method, url, body=None):
    r = urllib.request.Request(API + url, method=method, data=json.dumps(body).encode() if body else None,
                               headers={'Authorization': 'Bearer ' + _key(), 'Content-Type': 'application/json'})
    try:
        return json.load(urllib.request.urlopen(r, timeout=180))
    except urllib.error.HTTPError as e:
        return {'error': e.code, 'body': e.read().decode()[:400]}


def balance():
    return _req('GET', '/balance')['subscription']['generations']


def gen_one(name):
    size, desc = VFX[name]
    j = _req('POST', '/vfx', {'description': STYLE + desc, 'artist': 'lite', 'name': 'ascendrya_' + name})
    if 'error' in j:
        print(name, 'ERREUR', j, flush=True)
        return False
    jid = j.get('background_job_id') or j.get('id')
    s = {}
    for _ in range(60):
        time.sleep(8)
        s = _req('GET', f'/background-jobs/{jid}')
        if s.get('status') in ('completed', 'failed'):
            break
    if s.get('status') != 'completed':
        print(name, 'ÉCHEC', str(s)[:300], flush=True)
        return False
    lr = s['last_response']
    files = lr.get('files') or {}
    items = files.items() if isinstance(files, dict) else [(f.get('name', ''), f.get('url')) for f in files]
    got = {}
    for fname, url in items:
        url = url if isinstance(url, str) else (url or {}).get('url')
        if not url:
            continue
        for ext in ('.png', '.json'):
            if fname.endswith(ext) and '-normals' not in fname and not got.get(ext):
                got[ext] = urllib.request.urlopen(url, timeout=120).read()
    if '.png' not in got:
        print(name, 'pas de planche', json.dumps(lr)[:400], flush=True)
        return False
    open(os.path.join(SRC, name + '.png'), 'wb').write(got['.png'])
    meta = {k: lr.get(k) for k in ('canvas', 'frames', 'fps', 'loop', 'anchor', 'message', 'effect_id')}
    if '.json' in got:
        meta['sheet'] = json.loads(got['.json'])
    json.dump(meta, open(os.path.join(SRC, name + '.json'), 'w'), ensure_ascii=False, indent=1)
    print(name, 'ok', lr.get('canvas'), lr.get('frames'), flush=True)
    return True


def gen(names):
    os.makedirs(SRC, exist_ok=True)
    todo = names or [n for n in VFX if not os.path.exists(os.path.join(SRC, n + '.png'))]
    b0 = balance()
    from concurrent.futures import ThreadPoolExecutor
    with ThreadPoolExecutor(4) as ex:
        list(ex.map(gen_one, todo))
    b1 = balance()
    print('coût', b0 - b1, 'générations, reste', b1, flush=True)


def _frames(name):
    im = Image.open(os.path.join(SRC, name + '.png')).convert('RGBA')
    meta = json.load(open(os.path.join(SRC, name + '.json')))
    out = []
    for f in meta['sheet']['frames']:
        r = f['frame']
        fr = im.crop((r['x'], r['y'], r['x'] + r['w'], r['y'] + r['h']))
        # Alpha franc (pas de demi-transparence : le jeu dessine pixel net) et poussières isolées retirées.
        px = fr.load()
        for y in range(fr.height):
            for x in range(fr.width):
                c = px[x, y]
                px[x, y] = (c[0], c[1], c[2], 255) if c[3] >= 110 else (0, 0, 0, 0)
        out.append((fr, f.get('duration', 100)))
    # Images vides retirées (la fin d'un effet s'efface déjà par le lecteur).
    while out and out[-1][0].getbbox() is None:
        out.pop()
    while out and out[0][0].getbbox() is None:
        out.pop(0)
    anchor = meta.get('anchor') or {'x': out[0][0].width // 2, 'y': out[0][0].height // 2}
    return out, anchor, meta.get('loop', False)


def _pack(items, width=1024):
    """Rangement en étagères : items = [(clé, w, h)] -> {clé: (x, y)}, hauteur totale."""
    pos, x, y, row = {}, 0, 0, 0
    for k, w, h in sorted(items, key=lambda i: -i[2]):
        if x + w > width:
            x, y, row = 0, y + row + 1, 0
        pos[k] = (x, y)
        x += w + 1
        row = max(row, h)
    return pos, y + row


def build():
    effects, items, crops = {}, [], {}
    for name, (size, _desc) in VFX.items():
        if not os.path.exists(os.path.join(SRC, name + '.png')):
            print('manque', name)
            continue
        frames, anchor, loop = _frames(name)
        box = None
        for fr, _d in frames:
            b = fr.getbbox()
            if b:
                box = b if box is None else (min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3]))
        w, h = box[2] - box[0], box[3] - box[1]
        for i, (fr, _d) in enumerate(frames):
            crops[(name, i)] = fr.crop(box)
            items.append(((name, i), w, h))
        effects[name] = {'w': w, 'h': h, 'n': len(frames), 'ms': [d for _f, d in frames],
                         'ax': anchor['x'] - box[0], 'ay': anchor['y'] - box[1], 'loop': bool(loop),
                         'scale': round(size / max(w, h), 4)}
    pos, height = _pack(items)
    atlas = Image.new('RGBA', (1024, height + 1), (0, 0, 0, 0))
    for k, (x, y) in pos.items():
        atlas.paste(crops[k], (x, y))
    for name, e in effects.items():
        e['f'] = [list(pos[(name, i)]) for i in range(e['n'])]
    # Atlas indexé (palette commune de 255 teintes + transparent) : bien plus léger qu'en RGBA.
    rgb = atlas.convert('RGB')
    alpha = atlas.getchannel('A')
    q = rgb.quantize(colors=255, method=Image.MEDIANCUT, dither=Image.NONE)
    pal = q.getpalette()[:255 * 3]
    data = bytes(0 if a == 0 else v + 1 for v, a in zip(q.tobytes(), alpha.tobytes()))
    q2 = Image.frombytes('P', atlas.size, data)
    q2.putpalette([0, 0, 0] + pal)  # indice 0 : transparent
    buf = io.BytesIO()
    q2.save(buf, 'PNG', optimize=True, transparency=0)
    png = buf.getvalue()
    q2.save(os.path.join(SRC, '_atlas.png'), optimize=True, transparency=0)
    with open(OUT, 'w') as f:
        f.write('// FICHIER GÉNÉRÉ par tools/art/pixellab_vfx.py — ne pas modifier à la main.\n')
        f.write('// v9.2.6 : effets de combat dessinés image par image par PixelLab (impacts, critiques, projectiles, morts,\n')
        f.write('// butin, niveau, soins, auras, boss, poussières). Atlas PNG indexé ; `scale` ramène l\'effet à sa taille de jeu.\n')
        f.write('export const VFX_ATLAS = \'data:image/png;base64,' + base64.b64encode(png).decode() + '\';\n')
        f.write('export const VFX = ' + json.dumps(effects, separators=(',', ':')) + ';\n')
    print('atlas', atlas.size, len(png) // 1024, 'Kio,', len(effects), 'effets')


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'build'
    if cmd == 'bal':
        print(balance())
    elif cmd == 'gen':
        gen(sys.argv[2:])
    else:
        build()
