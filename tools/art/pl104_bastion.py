"""v10.4 (partie 6) : illustrations du Bastion, toutes faites avec PixelLab (pixel art 16 bits, contour sombre d'un pixel,
lumière en haut à gauche, même palette que assets/ui/art101 à art103).

  python3 tools/art/pl104_bastion.py gen [nom…]   génère les images manquantes (ou celles nommées) ;
                                                 sources brutes : tools/art/pixellab104/bastion/raw/<nom>.png,
                                                 effets animés : tools/art/pixellab104/bastion/vfx/<nom>.png/.json,
                                                 prompts et graines : tools/art/pixellab104/bastion/prompts.json
  python3 tools/art/pl104_bastion.py build        nettoie, agrandit (facteur entier, jamais lissé), fabrique les
                                                 silhouettes des bâtiments verrouillés et les planches animées, puis
                                                 écrit assets/ui/art104/<nom>.png (+ src/ui/bastion-art.js : planches)
  python3 tools/art/pl104_bastion.py balance      générations restantes (subscription.generations)

Clé : variable d'environnement PIXELLAB_API_KEY (jamais affichée ni écrite).
Niveaux des bâtiments : le niveau 1 est dessiné (pixflux), les niveaux 4 et 8 partent de lui (bitforge, image de
départ = niveau 1 : même angle, même palette), pour que le bâtiment grandisse sans changer de style.
"""
import base64, io, json, os, sys, time, urllib.error, urllib.request
from concurrent.futures import ThreadPoolExecutor
from PIL import Image, ImageEnhance

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
SRC = os.path.join(HERE, 'pixellab104', 'bastion')
RAW = os.path.join(SRC, 'raw')
VFX = os.path.join(SRC, 'vfx')
DST = os.path.join(ROOT, 'assets', 'ui', 'art104')
JS = os.path.join(ROOT, 'src', 'ui', 'bastion-art.js')
API = 'https://api.pixellab.ai/v2'

STYLE = ', 16-bit fantasy RPG pixel art, one pixel dark outline, light from the top left, rich warm colors, crisp pixels'
T = STYLE + ', transparent background, centered, no text'
BUILDING_VIEW = 'single building seen from a high three-quarter top-down view, standing on a small square patch of grass and cobblestones, '

# nom → (taille, description, fond transparent ?, graine)
ART = {
    # Carte du village (fond) : la cour du Bastion, places libres pour poser les bâtiments.
    'bastion_map': ((384, 216), 'detailed high three-quarter top-down view of a large fortified village courtyard inside stone ramparts, green grass, winding dirt paths connecting six empty flat cobblestone building plots, a small pond, a well in the center, trees and bushes along the walls, banners on the rampart towers, sunny day, wide scene, no buildings on the plots', False, 7),
    # Bâtiments : niveau 1 (les niveaux 4 et 8 : LEVELS, plus bas).
    'bastion_forge_lv1': ((128, 128), BUILDING_VIEW + 'a small blacksmith forge: stone walls, red tiled roof, open front with glowing orange furnace, an anvil outside, a stone chimney', True, 21),
    'bastion_library_lv1': ((128, 128), BUILDING_VIEW + 'a small stone library tower with a blue slate roof, arched windows with warm light, a wooden door, books on a little stand', True, 22),
    'bastion_mine_lv1': ((128, 128), BUILDING_VIEW + 'a small mine entrance dug into a rocky hill with wooden support beams, a mine cart on rails, glowing cyan crystals around the entrance', True, 23),
    'bastion_training_lv1': ((128, 128), BUILDING_VIEW + 'a small training yard: wooden fence, two straw training dummies, a weapon rack with swords and spears, a little tent', True, 24),
    'bastion_trade_lv1': ((128, 128), BUILDING_VIEW + 'a small merchant trading post: wooden stall with a striped red and white awning, crates, barrels and sacks, hanging scales', True, 25),
    'bastion_expeditions': ((128, 128), BUILDING_VIEW + 'an expedition camp gate: a wooden watchtower with a flag, a signpost, travel bags and a small tent next to a map table', True, 26),
    'bastion_site': ((128, 128), BUILDING_VIEW + 'an empty construction site: wooden scaffolding, a pile of stones and planks, a wheelbarrow, rope and a small crane', True, 27),
    # Tour de la scène (bouton) et écran « Pendant ton absence ».
    'scene_tower': ((64, 64), 'a small fantasy stone watchtower with a red pointed roof and a golden banner, wooden door, icon', True, 31),
    'bastion_away': ((320, 128), 'a cozy fortified village at sunrise seen from above, a blacksmith forge with smoke, a stone library tower, a crystal mine, villagers working, warm golden morning light, wide banner illustration', False, 32),
    # Icônes de métiers (outils).
    'trade_smith': ((64, 64), 'a blacksmith hammer striking over a small anvil with sparks, icon', True, 41),
    'trade_scholar': ((64, 64), 'an open old spell book with a feather quill, icon', True, 42),
    'trade_miner': ((64, 64), 'a miner pickaxe with a glowing cyan crystal, icon', True, 43),
    'trade_trainer': ((64, 64), 'a wooden training sword and a round wooden shield, icon', True, 44),
    'trade_merchant': ((64, 64), 'a small pile of gold coins with a merchant scale, icon', True, 45),
    # Branches des recherches.
    'research_branch_combat': ((64, 64), 'two crossed steel swords over a red round shield, icon', True, 51),
    'research_branch_team': ((64, 64), 'three small heroes standing together under a blue banner, icon', True, 52),
    'research_branch_economy': ((64, 64), 'a stack of gold coins next to a small leather purse, icon', True, 53),
    # Nœuds des recherches (un par recherche, data/bastion.js : RESEARCH).
    'research_node_sword': ((64, 64), 'a sharp glowing steel sword with a whetstone and sparks, icon', True, 61),
    'research_node_steelheart': ((64, 64), 'a red heart covered with riveted steel armor plates, icon', True, 62),
    'research_node_skull': ((64, 64), 'a cracked skull pierced by a red critical strike slash mark, icon', True, 63),
    'research_node_shield': ((64, 64), 'a raised heavy kite shield with a golden rim, icon', True, 64),
    'research_node_breath': ((64, 64), 'a green glowing heart with a swirling breath of wind, healing, icon', True, 65),
    'research_node_banner': ((64, 64), 'a red war banner with a sword and a heart emblem on a pole, icon', True, 66),
    'research_node_hands': ((64, 64), 'three hands stacked together in a circle of golden light, teamwork, icon', True, 67),
    'research_node_hourglass': ((64, 64), 'a blue hourglass with a lightning bolt, fast cooldown, icon', True, 68),
    'research_node_rings': ((64, 64), 'two linked golden rings glowing with pink light, bond, icon', True, 69),
    'research_node_dummy': ((64, 64), 'a round straw training dummy on a wooden post with a red target painted on its chest, icon', True, 79),
    'research_node_spyglass': ((64, 64), 'a brass spyglass on a rolled treasure map, scouting, icon', True, 71),
    'research_node_gear': ((64, 64), 'a hammer and a wrench crossed over a bronze gear, workers, icon', True, 72),
    'research_node_purse': ((64, 64), 'a full leather purse overflowing with gold coins, icon', True, 73),
    'research_node_moon': ((64, 64), 'a crescent moon over a lit candle and a small hourglass, night watch, icon', True, 74),
    'research_node_eye': ((64, 64), 'a hunter eye with a green iris and a crossed arrow, icon', True, 75),
    'research_node_cart': ((64, 64), 'a small merchant cart full of goods on a road, icon', True, 76),
    'research_node_crystal': ((64, 64), 'a rich vein of glowing cyan crystals in dark rock, icon', True, 77),
    'research_node_book': ((64, 64), 'an old open book with a glowing golden star above the pages, icon', True, 78),
}
# Niveaux 4 et 8 : depuis le niveau 1 (bitforge, image de départ), le même bâtiment agrandi.
LEVELS = {
    'forge': ('a medium blacksmith forge with an orange tiled roof, a stone chimney with smoke, a glowing orange furnace in the open front, two anvils and a weapon rack', 'a large blacksmith forge hall with red tiled roofs, two big stone chimneys with fire, a huge glowing orange furnace in the open front, golden trims, an anvil and a weapon rack outside'),
    'library': ('a taller stone library with two towers, more arched windows, a balcony', 'a grand wizard library with three towers, golden domes, stained glass windows, floating glowing books'),
    'mine': ('a larger mine with a wooden lift tower, two carts and more glowing crystals', 'a huge crystal mine with a big wooden headframe tower, rails, many large glowing cyan and purple crystals'),
    'training': ('a bigger training yard with a stone wall, more dummies, archery targets and a banner', 'a grand training arena with stone walls, banners, an archery range, dummies and a small barracks building'),
    'trade': ('a larger merchant post: a wooden shop building with a sign, an awning, many crates and a cart', 'a big two story merchant market hall of wood and stone with red and white striped awnings, a golden coin sign, many crates, barrels and sacks, a cart in front'),
}
# Force de l'image de départ (bitforge) : trop haute, le bâtiment ne change pas (Forge, 1er essai à 380/260).
STRENGTH = {'forge': (0, 0), 'trade': (380, 0)}  # 0 : dessiné à neuf (pixflux), palette du niveau 1
for b, (l4, l8) in LEVELS.items():
    s4, s8 = STRENGTH.get(b, (380, 260))
    ART[f'bastion_{b}_lv4'] = ((128, 128), BUILDING_VIEW + l4, True, 80 + len(b), f'bastion_{b}_lv1', s4)
    ART[f'bastion_{b}_lv8'] = ((128, 128), BUILDING_VIEW + l8, True, 90 + len(b), f'bastion_{b}_lv1', s8)

# Petites animations des bâtiments (point d'accès /vfx, artiste « lite ») : nom → (description, boucle, côté max).
EFFECTS = {
    'fx_forge_smoke': ('A thin column of grey chimney smoke puffs rising slowly and fading, small, looping.', True, 48),
    'fx_forge_sparks': ('Small bright orange and yellow sparks jumping up from a blacksmith anvil strike, short bursts, looping.', True, 48),
    'fx_library_pages': ('An open magic book floating with its pages turning one after another, soft golden glow, looping.', True, 48),
    'fx_mine_crystals': ('A small cluster of cyan crystals pulsing with light, bright glints twinkling on the facets, looping.', True, 48),
}
VFX_STYLE = ' Retro 16-bit pixel art, crisp pixels, one pixel dark outline, transparent background, no text, centered.'


def _req(method, path, body=None, auth=True, timeout=300):
    headers = {'Content-Type': 'application/json'}
    if auth:
        headers['Authorization'] = 'Bearer ' + os.environ['PIXELLAB_API_KEY']
    url = path if path.startswith('http') else API + path
    r = urllib.request.Request(url, method=method, data=json.dumps(body).encode() if body else None, headers=headers)
    for attempt in range(30):
        try:
            with urllib.request.urlopen(r, timeout=timeout) as f:
                data = f.read()
                return data if not auth else json.loads(data)
        except urllib.error.HTTPError as e:
            if e.code in (429, 503) and attempt < 29:
                time.sleep(15); continue
            raise RuntimeError(f'{e.code} {e.read().decode()[:200]}')


def b64(img):
    buf = io.BytesIO(); img.save(buf, 'PNG')
    return {'type': 'base64', 'base64': base64.b64encode(buf.getvalue()).decode()}


def to_img(x):
    data = x['base64'] if isinstance(x, dict) else x
    return Image.open(io.BytesIO(base64.b64decode(data))).convert('RGBA')


def wait(job):
    jid = job.get('background_job_id') or job.get('job_id')
    if not jid:
        return job
    for _ in range(150):
        time.sleep(4)
        r = _req('GET', f'/background-jobs/{jid}')
        if r.get('status') == 'completed':
            return r.get('last_response') or r
        if r.get('status') == 'failed':
            raise RuntimeError(str(r)[:300])
    raise TimeoutError(jid)


def first_image(resp):
    if resp.get('image'):
        return to_img(resp['image'])
    return to_img(resp['images'][0])


def count_call(name):
    """Journal des générations lancées par ce script (pixellab104/bastion/calls.log) : le solde du compte est partagé."""
    os.makedirs(SRC, exist_ok=True)
    with open(os.path.join(SRC, 'calls.log'), 'a') as f:
        f.write(f'{time.strftime("%Y-%m-%d %H:%M:%S")} {name}\n')


def log_prompt(name, body):
    path = os.path.join(SRC, 'prompts.json')
    data = json.load(open(path)) if os.path.exists(path) else {}
    data[name] = {k: v for k, v in body.items() if k not in ('init_image', 'color_image')}
    if 'init_image' in body:
        data[name]['init_image'] = ART[name][4] if len(ART[name]) > 4 else 'image'
    json.dump(data, open(path, 'w'), indent=1, ensure_ascii=False)


def gen_image(name, seed=None):
    spec = ART[name]
    size, desc, transp, seed0 = spec[:4]
    body = {'description': desc + (T if transp else STYLE), 'image_size': {'width': size[0], 'height': size[1]}, 'no_background': transp,
            'seed': seed if seed is not None else seed0, 'outline': 'single color black outline', 'shading': 'medium shading', 'detail': 'highly detailed'}
    if len(spec) > 4 and spec[5] == 0:  # dessiné à neuf, mais avec la palette du niveau 1
        base = Image.open(os.path.join(RAW, spec[4] + '.png')).convert('RGBA')
        body['color_image'] = b64(base)
        im = first_image(wait(_req('POST', '/create-image-pixflux', body)))
    elif len(spec) > 4:  # niveau 4 ou 8 : part du niveau 1 (même angle, même palette)
        base = Image.open(os.path.join(RAW, spec[4] + '.png')).convert('RGBA')
        body.update({'init_image': b64(base), 'init_image_strength': spec[5], 'color_image': b64(base)})
        im = first_image(wait(_req('POST', '/create-image-bitforge', body)))
    else:
        im = first_image(wait(_req('POST', '/create-image-pixflux', body)))
    os.makedirs(RAW, exist_ok=True)
    im.save(os.path.join(RAW, name + '.png'))
    log_prompt(name, body)
    return f'{name} ok'


def gen_vfx(name):
    desc, loop, _ = EFFECTS[name]
    body = {'description': desc + (' Seamless loop.' if loop else ' Plays once.') + VFX_STYLE, 'artist': 'lite', 'name': 'ascendrya_bastion_' + name}
    j = _req('POST', '/vfx', body)
    s = {}
    jid = j['background_job_id']
    for _ in range(120):
        time.sleep(8)
        s = _req('GET', f'/background-jobs/{jid}')
        if s.get('status') in ('completed', 'failed'):
            break
    if s.get('status') != 'completed':
        return f'{name} échec {str(s)[:200]}'
    files = s['last_response'].get('files') or {}
    items = files.items() if isinstance(files, dict) else [(f.get('name', ''), f.get('url')) for f in files]
    got = {}
    for fname, url in items:
        url = url.get('url') if isinstance(url, dict) else url
        for ext in ('.png', '.json'):
            if fname.endswith(ext) and not fname.endswith('-normals.png') and url:
                got[ext] = _req('GET', url, auth=False)
    if '.png' not in got or '.json' not in got:
        return f'{name} fichiers manquants'
    os.makedirs(VFX, exist_ok=True)
    open(os.path.join(VFX, name + '.png'), 'wb').write(got['.png'])
    open(os.path.join(VFX, name + '.json'), 'wb').write(got['.json'])
    log_prompt(name, body)
    return f'{name} ok'


def gen(name):
    count_call(name)
    try:
        seed = None
        if '@' in name:
            name, seed = name.split('@'); seed = int(seed)
        return gen_vfx(name) if name in EFFECTS else gen_image(name, seed)
    except Exception as e:  # noqa: BLE001
        return f'{name} ERREUR {str(e)[:200]}'


# ---------------------------------------------------------------- build

def clean(im):
    """Poussières presque transparentes retirées, recadré sur le contenu."""
    a = im.getchannel('A').point(lambda v: 0 if v < 40 else 255)
    im.putalpha(a)
    box = im.getbbox()
    return im.crop(box) if box else im


def silhouette(im):
    """Bâtiment verrouillé : ombre bleu nuit pleine, contour gardé."""
    dark = ImageEnhance.Brightness(ImageEnhance.Color(im).enhance(0.1)).enhance(0.28)
    tint = Image.new('RGBA', im.size, (30, 36, 64, 0))
    tint.putalpha(im.getchannel('A'))
    return Image.blend(dark, tint, 0.35)


def frames_of(name):
    sheet = Image.open(os.path.join(VFX, name + '.png')).convert('RGBA')
    meta = json.load(open(os.path.join(VFX, name + '.json')))
    fr = meta.get('frames')
    if isinstance(fr, dict):
        fr = list(fr.values())
    out, durs = [], []
    for f in fr:
        r = f.get('frame', f)
        out.append(sheet.crop((r['x'], r['y'], r['x'] + r['w'], r['y'] + r['h'])))
        durs.append(f.get('duration', 100))
    return out, durs


def build_vfx(name):
    _, loop, side = EFFECTS[name]
    frames, durs = frames_of(name)
    for f in frames:
        f.putalpha(f.getchannel('A').point(lambda v: 0 if v < 24 else v))
    box = None
    for f in frames:
        b = f.getbbox()
        if b:
            box = b if box is None else (min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3]))
    if box is None:
        return None
    frames = [f.crop(box) for f in frames]
    w = max(frames[0].width, frames[0].height)
    if w > side:
        k = -(-w // side)
        frames = [f.resize((max(1, f.width // k), max(1, f.height // k)), Image.NEAREST) for f in frames]
    w, h = frames[0].size
    strip = Image.new('RGBA', (w * len(frames), h))
    for i, f in enumerate(frames):
        strip.paste(f, (i * w, 0))
    strip.save(os.path.join(DST, name + '.png'))
    ms = sum(durs) / max(1, len(durs))
    return {'w': w, 'h': h, 'n': len(frames), 'fps': max(4, min(16, round(1000 / ms))), 'loop': loop}


def build():
    os.makedirs(DST, exist_ok=True)
    for f in sorted(os.listdir(RAW)):
        if not f.endswith('.png'):
            continue
        name = f[:-4]
        im = Image.open(os.path.join(RAW, f)).convert('RGBA')
        transp = ART.get(name, (None, None, True))[2]
        if transp:
            im = clean(im)
        if name == 'bastion_map' or name == 'bastion_away':
            k = 2
        elif name.startswith('bastion_'):
            k = 1  # bâtiments : 128 px, agrandis à l'affichage (CSS, rendu « pixelated »)
        else:
            k = 1
        if k > 1:
            im = im.resize((im.width * k, im.height * k), Image.NEAREST)
        im.save(os.path.join(DST, f))
        if name.startswith('bastion_') and (name.endswith('_lv1') or name == 'bastion_expeditions'):
            silhouette(im).save(os.path.join(DST, name.replace('_lv1', '') + '_locked.png'))
    sheets = {}
    for name in EFFECTS:
        if os.path.exists(os.path.join(VFX, name + '.png')):
            m = build_vfx(name)
            if m:
                sheets[name] = m
    with open(JS, 'w') as f:
        f.write('// v10.4 (partie 6) : généré par tools/art/pl104_bastion.py build (ne pas modifier à la main).\n')
        f.write('// Planches animées des bâtiments : assets/ui/art104/<nom>.png, n images de w×h côte à côte.\n')
        f.write('export const BASTION_FX = ' + json.dumps(sheets, separators=(',', ':')) + ';\n')
    print('installé :', len(os.listdir(DST)), 'fichiers ;', len(sheets), 'planches')


def balance():
    r = _req('GET', '/balance')
    print('générations :', round(r['subscription']['generations'], 2))


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'build'
    if cmd == 'gen':
        names = sys.argv[2:] or [n for n in [*ART, *EFFECTS] if not os.path.exists(os.path.join(RAW if n in ART else VFX, n + '.png'))]
        # Les niveaux 4 et 8 partent du niveau 1 : on dessine d'abord ce dont ils dépendent.
        first = [n for n in names if len(ART.get(n.split('@')[0], ())) <= 4]
        then = [n for n in names if n not in first]
        with ThreadPoolExecutor(6) as ex:
            for m in ex.map(gen, first):
                print(m, flush=True)
            for m in ex.map(gen, then):
                print(m, flush=True)
    elif cmd == 'balance':
        balance()
    else:
        build()
