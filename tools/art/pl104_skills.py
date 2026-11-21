"""v10.4 (3) : icônes de compétences redessinées avec PixelLab — une couleur dominante par TYPE d'effet, la classe en cadre.
  - 60 symboles 32 px (fond transparent) : tools/art/pixellab104/skills/sym_<classe>_<id>.png  (id : quick, whirl, cry, holy, 1, 2)
  - 10 cadres 40 px, un par classe (centre vide) :  tools/art/pixellab104/skills/frame_<classe>.png
  - prompts : tools/art/pixellab104/skills/prompts.json (écrit à chaque `gen`)
  - `build` assemble cadre + fond teinté du type + symbole → assets/ui/art104/skill_<classe>_<id>.png (40 px)
Types : coup unique (hit) rouge, zone (aoe) orange, soutien (buff) or, soin (holy) bleu clair. Il n'y a aucun déplacement dans
le jeu : le bleu sert à la frappe qui soigne.
Usage : PIXELLAB_API_KEY=… python3 tools/art/pl104_skills.py gen [frames] [sym] [noms…]   (ne refait pas ce qui existe, sauf --force)
        python3 tools/art/pl104_skills.py build"""
import json, os, subprocess, sys
from concurrent.futures import ThreadPoolExecutor
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
RAW = os.path.join(HERE, 'pixellab104', 'skills'); DST = os.path.join(ROOT, 'assets', 'ui', 'art104')
STYLE = ', 16-bit fantasy RPG pixel art, one pixel dark outline, light from the top left, transparent background'
TYPE_COLOR = {'hit': 'bright light red with white highlights', 'aoe': 'orange', 'buff': 'gold yellow', 'holy': 'light cyan blue and white'}
# Fond du type : sa teinte, et surtout un NIVEAU DE GRIS différent par type (≈ 33, 57, 89, 135) pour que les types se distinguent en noir et blanc.
TYPE_BG = {'hit': (80, 12, 16), 'aoe': (150, 72, 12), 'buff': (172, 138, 20), 'holy': (22, 66, 100)}
FRAME_COLOR = {'knight': 'steel blue and silver', 'archer': 'forest green', 'pyromancer': 'orange fire and copper', 'berserker': 'crimson red and iron',
               'lancer': 'teal cyan', 'paladin': 'gold and white', 'assassin': 'violet purple', 'crossbowman': 'bronze brown and teal',
               'stormcaller': 'electric blue and white', 'necromancer': 'sickly green and dark purple'}
IDS = ['quick', 'whirl', 'cry', 'holy', '1', '2']
COMMON_TYPE = {'quick': 'hit', 'whirl': 'aoe', 'cry': 'buff', 'holy': 'holy'}
CLASS_TYPES = {'knight': ('hit', 'holy'), 'archer': ('hit', 'aoe'), 'pyromancer': ('hit', 'aoe'), 'berserker': ('buff', 'aoe'), 'lancer': ('hit', 'aoe'),
               'paladin': ('holy', 'buff'), 'assassin': ('hit', 'aoe'), 'crossbowman': ('hit', 'aoe'), 'stormcaller': ('hit', 'aoe'), 'necromancer': ('holy', 'aoe')}
# Un motif par compétence : deux compétences d'une classe ne se ressemblent jamais.
MOTIF = {
    'knight': ['a big broad sword held upright, vertical, point up, bright red steel blade and golden crossguard', 'a spinning sword slash forming a full circle', 'a war banner flag with a roaring helmet',
               'a sword with holy light pouring down on it', 'a heavy lance tip charging forward with speed lines', 'a kite shield with a glowing cross'],
    'archer': ['a single arrow flying to the right', 'a fan of five arrows spreading out from one point', 'a sharp eagle eye with a feather',
               'an arrow made of light with a halo ring', 'an arrow piercing through the center of a round target', 'five long arrows falling straight down from the top, pointing down, like a rain of arrows'],
    'pyromancer': ['a bright star-shaped spark of fire with a short tail', 'a wide wave of flames rolling sideways', 'a clenched fist wrapped in blazing embers',
                   'a pure white and blue flame inside a ring', 'one big round fireball with a flame tail', 'two meteors falling with fire trails'],
    'berserker': ['a single axe chop striking down', 'a spinning double axe whirlwind', 'a roaring screaming beast face with open mouth',
                  'a drop of blood with a sharp fang', 'a clenched fist with glowing rage veins', 'two crossed bloody axes with splatter'],
    'lancer': ['a spear thrust with a long shaft', 'a spear sweeping a wide circle', 'a spear raised with a pennant flag',
               'a glowing spear with a halo of light', 'a spear tip striking a shield with sparks', 'a curved reaping arc cutting golden wheat'],
    'paladin': ['a big warhammer head raised high', 'a ring of holy runes on the ground', 'two praying hands with light above',
                'a sword falling from heaven in a column of light', 'a straight ray of light breaking through clouds', 'a winged halo blessing with feathers'],
    'assassin': ['a large wide dagger drawn diagonally from corner to corner with a bright blade and a golden hilt', 'a fan of thrown daggers', 'a hooded face in shadow with glowing eyes',
                 'a dagger with a holy glow', 'a dagger hidden in a cloak sleeve', 'two spinning twin daggers in a whirlwind'],
    'crossbowman': ['a single crossbow bolt with a metal tip flying to the right', 'a wide barrage of many bolts', 'a crosshair scope with a bolt',
                    'a glowing blessed bolt with a halo', 'a thick heavy iron bolt', 'a volley of three bolts side by side'],
    'stormcaller': ['a small round ball of electricity with tiny arcs around it', 'lightning chain jumping between three points', 'a crackling charged orb of static',
                    'a pure white lightning bolt from above with a ring', 'one huge jagged lightning bolt striking down from top to bottom', 'a storm cloud with lightning and rain'],
    'necromancer': ['a ghostly spectral hand reaching out', 'a wave of dark shadow rolling', 'a dark pact scroll with a skull seal',
                    'a stolen soul wisp pulled into a vial', 'a heart drained by a spiral beam', 'a swarm of flying bones and a skull'],
}


def skills():
    out = []
    for cls in MOTIF:
        for i, sid in enumerate(IDS):
            typ = COMMON_TYPE[sid] if sid in COMMON_TYPE else CLASS_TYPES[cls][int(sid) - 1]
            out.append({'cls': cls, 'id': sid, 'type': typ, 'motif': MOTIF[cls][i], 'name': f'{cls}_{sid}'})
    return out


def sym_prompt(s):
    return f"{s['motif']}, {TYPE_COLOR[s['type']]} dominant color, one very large bold symbol filling the whole canvas, thick dark outline, bright saturated colors, readable at small size, centered, no frame" + STYLE


def frame_prompt(cls):
    return (f'an empty square game icon frame, ornate metal border in {FRAME_COLOR[cls]} colors with small corner studs, completely plain flat dark navy center, '
            'front view, no symbol inside' + STYLE)


def gen_sym(s, seed=21):
    from pl939_api import call, images_of, wait
    body = {'description': sym_prompt(s), 'image_size': {'width': 32, 'height': 32}, 'no_background': True, 'seed': seed,
            'outline': 'single color black outline', 'shading': 'medium shading', 'detail': 'medium detail'}
    return images_of(wait(call('POST', '/create-image-pixflux', body)))[0]


def gen_frame(cls, seed=7):
    from pl939_api import call, images_of, wait
    body = {'description': frame_prompt(cls), 'image_size': {'width': 40, 'height': 40}, 'no_background': True, 'seed': seed,
            'outline': 'single color black outline', 'shading': 'medium shading', 'detail': 'medium detail'}
    return images_of(wait(call('POST', '/create-image-pixflux', body)))[0]


def cmd_gen(args):
    force = '--force' in args
    seed = next((int(a[7:]) for a in args if a.startswith('--seed=')), None)
    names = [a for a in args if not a.startswith('--') and a not in ('frames', 'sym')]
    if force and not names:
        print('--force exige une liste explicite de noms (ex. knight_quick assassin_2) : jamais tout refaire.'); sys.exit(2)
    os.makedirs(RAW, exist_ok=True)
    jobs = []
    everything = not names and 'frames' not in args and 'sym' not in args
    for s in skills():
        if everything or ('sym' in args and not names) or s['name'] in names: jobs.append(('sym', s))
    for cls in MOTIF:
        if everything or ('frames' in args and not names) or f'frame_{cls}' in names: jobs.append(('frame', cls))
    json.dump({'sym': {s['name']: sym_prompt(s) for s in skills()}, 'frame': {c: frame_prompt(c) for c in MOTIF}, 'style': STYLE},
              open(os.path.join(RAW, 'prompts.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)

    def run(j):
        kind, x = j
        name = f"sym_{x['name']}" if kind == 'sym' else f'frame_{x}'
        path = os.path.join(RAW, name + '.png')
        if os.path.exists(path) and not force: return f'{name} déjà là'
        try:
            kw = {} if seed is None else {'seed': seed}
            im = gen_sym(x, **kw) if kind == 'sym' else gen_frame(x, **kw)
            im.save(path); return f'{name} ok'
        except Exception as e:  # noqa: BLE001
            return f'{name} ERREUR {str(e)[:120]}'
    with ThreadPoolExecutor(6) as ex:
        for m in ex.map(run, jobs): print(m, flush=True)


def interior(frame):
    """Masque du centre vide : zone contiguë depuis le milieu, de la couleur du centre (± tolérance)."""
    w, h = frame.size; px = frame.load()
    c = px[w // 2, h // 2]
    m = 4  # bordure de 4 px : le centre fait 32 × 32 (la taille des symboles) ; les clous des coins restent au cadre
    return {(x, y) for y in range(m, h - m) for x in range(m, w - m) if px[x, y][3] > 0 and sum(abs(px[x, y][i] - c[i]) for i in range(3)) < 90}


# Cadre commun : un seul gabarit PixelLab (frame_berserker, le plus net), recoloré par classe (teinte, saturation, luminosité).
FRAME_BASE = 'berserker'
FRAME_TINT = {'knight': (218, 0.28, 1.35), 'archer': (132, 1.0, 1.05), 'pyromancer': (24, 1.25, 1.35), 'berserker': (None, 1, 1), 'lancer': (184, 1.0, 1.25),
              'paladin': (46, 0.95, 1.55), 'assassin': (276, 0.9, 1.15), 'crossbowman': (30, 0.45, 1.0), 'stormcaller': (208, 1.4, 1.7), 'necromancer': (84, 0.65, 0.95)}


def tint_frame(frame, cls, mask):
    import colorsys
    hue, sat, val = FRAME_TINT[cls]
    out = frame.copy(); px = out.load()
    if hue is None: return out
    for y in range(frame.height):
        for x in range(frame.width):
            if (x, y) in mask: continue
            r, g, b, a = px[x, y]
            if a == 0: continue
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if s < 0.12 and v < 0.25: continue  # le contour sombre reste noir
            r2, g2, b2 = colorsys.hsv_to_rgb(hue / 360, min(1, s * sat), min(1, v * val))
            px[x, y] = (int(r2 * 255), int(g2 * 255), int(b2 * 255), a)
    return out


def auto_levels(sym, target=215, max_gain=2.4):
    """Éclaircit un symbole trop sombre (les 85 % de ses pixels clairs montent vers `target`) pour qu'il se détache du fond, même en gris."""
    px = sym.load(); lums = sorted(0.299 * r + 0.587 * g + 0.114 * b for r, g, b, a in sym.getdata() if a > 128 and 0.299 * r + 0.587 * g + 0.114 * b > 45)
    if not lums: return sym
    ref = lums[int(len(lums) * 0.85)]
    gain = max(1.0, min(max_gain, target / max(ref, 1)))
    if gain <= 1.02: return sym
    out = sym.copy(); op = out.load()
    for y in range(sym.height):
        for x in range(sym.width):
            r, g, b, a = px[x, y]
            if a: op[x, y] = (min(255, int(r * gain)), min(255, int(g * gain)), min(255, int(b * gain)), a)
    return out


OLD = os.path.join(ROOT, 'assets', 'ui', 'skills98')
RING = 6  # les anciennes icônes : 2 px de blanc, puis un cadre métallique de 4 px ; le centre mesure 28 × 28


def old_frame(cls):
    """Cadre biseauté d'une ancienne icône de la classe (assets/ui/skills98) : on ne garde que l'anneau ; le liseré blanc devient transparent."""
    im = Image.open(os.path.join(OLD, f'{cls}_quick.png')).convert('RGBA'); px = im.load(); n = im.width
    for y in range(n):
        for x in range(n):
            d = min(x, y, n - 1 - x, n - 1 - y)
            if d < 2 or d >= RING: px[x, y] = (0, 0, 0, 0)
    return im


def fit_symbol(sym, box=26):
    """Rogne le symbole, le met à l'échelle (×2 si minuscule, réduit s'il dépasse) et le centre dans le centre du cadre."""
    bb = sym.getchannel('A').point(lambda a: 255 if a > 128 else 0).getbbox()
    if not bb: return sym
    c = sym.crop(bb); m = max(c.size)
    if m <= box // 2: c = c.resize((c.width * 2, c.height * 2), Image.NEAREST)
    elif m > box: k = box / m; c = c.resize((max(1, round(c.width * k)), max(1, round(c.height * k))), Image.NEAREST)
    return c


def cmd_build(args):
    os.makedirs(DST, exist_ok=True)
    n = 40; inner = n - 2 * RING
    for s in skills():
        sp = os.path.join(RAW, f"sym_{s['name']}.png")
        if not os.path.exists(sp): print(f"{s['name']} : source manquante"); continue
        sym = fit_symbol(auto_levels(Image.open(sp).convert('RGBA')))
        out = Image.new('RGBA', (n, n), (0, 0, 0, 0)); px = out.load()
        r, g, b = TYPE_BG[s['type']]
        for y in range(RING, n - RING):
            for x in range(RING, n - RING):
                # fond du type : plus clair au centre et en haut à gauche, sombre vers les bords (vignette)
                dx, dy = (x - (n - 1) / 2) / (inner / 2), (y - (n - 1) / 2) / (inner / 2)
                v = 1.25 - 0.55 * min(1.0, (dx * dx + dy * dy) / 1.6) - 0.10 * ((x + y) / (2 * n))
                px[x, y] = (min(255, int(r * v)), min(255, int(g * v)), min(255, int(b * v)), 255)
        out.alpha_composite(sym, ((n - sym.width) // 2, (n - sym.height) // 2))
        out.alpha_composite(old_frame(s['cls']))
        out.save(os.path.join(DST, f"skill_{s['name']}.png"))
    print('build ok →', DST)


if __name__ == '__main__':
    a = sys.argv[1:]
    if not a or a[0] not in ('gen', 'build'): print(__doc__); sys.exit(1)
    (cmd_gen if a[0] == 'gen' else cmd_build)(a[1:])
