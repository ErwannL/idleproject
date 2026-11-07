# v9.2.8 : images PixelLab (64x64, personnage sans arme du joueur) -> cadre du héros (96x72, pieds y=71) + prise de
# l'arme par image, à partir du squelette estimé (/estimate-skeleton : coude et poignet du bras avant).
# Sortie : work/prep/<anim>.json {frames:[{rows,pal}], w:[[x,y,deg,back]...], hit, ox, oy} (repère du sprite de jeu).
# Usage : python3 -I prep.py <anim> [...]
import json, math, os, sys
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from pixellab_allies import drop_fx  # noqa: E402  (effets détachés : traînées, étincelles)
from pixellab_anim import _drop_specks  # noqa: E402
W = os.environ.get('PL_WORK', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'work'))  # hors dépôt de préférence
LOOPS = ('walk', 'swim')
CX, FEET = 28, 71       # centre du corps et ligne des pieds de la vue de repos du chevalier actuel (cadre 96x72)
VIEW_O = (0, 6)         # coin du sprite de jeu dans la vue (comme _ref/hero_knight.json)


def clean(im):
    im = im.convert('RGBA'); px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            p = px[x, y]; px[x, y] = (p[0], p[1], p[2], 255) if p[3] >= 128 else (0, 0, 0, 0)
    return im


def alien(img, ref, tol=70):
    """Traînées collées au corps (arcs de frappe) : pixels dont la couleur est loin de toutes celles du repos."""
    pal = {p[:3] for p in ref.get_flattened_data() if p[3]}
    px = img.load(); memo = {}
    for y in range(img.height):
        for x in range(img.width):
            p = px[x, y]
            if not p[3]: continue
            c = p[:3]
            if c not in memo: memo[c] = min(sum(abs(c[i] - q[i]) for i in range(3)) for q in pal) > tol
            if memo[c]: px[x, y] = (0, 0, 0, 0)
    return img


def kp(path, label):
    k = json.load(open(path[:-4] + '.skel.json'))
    sw, sh = Image.open(path).size  # images d'animation rendues avec une marge (64x84, 88x88…) : fractions de CETTE taille
    for p in k:
        if p['label'] == label: return p['x'] * sw, p['y'] * sh
    return None


def ang(v):  # degrés horaires depuis « vers le haut »
    return math.degrees(math.atan2(v[0], -v[1])) % 360


def clamp(a, lo, hi): return max(lo, min(hi, a))


def weapon_deg(cls, fa):
    """Angle de l'arme selon l'avant-bras (fa : angle coude -> poignet)."""
    if cls in ('archer', 'crossbowman'): return 0
    if cls in ('pyromancer', 'stormcaller'): return 0 if fa > 135 else clamp(fa - 20, 0, 80)
    if cls == 'lancer': return 0 if fa > 140 else clamp(fa, 0, 100)
    # armes de taille : lame perpendiculaire à l'avant-bras, côté pouce (vers le haut quand le bras est tendu)
    return (fa - 90) % 360


def build(anim):
    d = f'{W}/raw/{anim}'
    paths = sorted([p for p in os.listdir(d) if p.endswith('.png')], key=lambda p: int(p[1:-4]))
    kind = anim.rsplit('_', 1)[-1]
    cls = anim.split('_')[1] if anim.endswith('_attack') else None
    if kind == 'swim': paths = paths[1:]          # f0 = vue debout (première image imposée)
    if kind == 'walk': paths = paths[:-1]
    rest = clean(Image.open(f'{d}/f0.png'))
    frames = [alien(drop_fx(_drop_specks(clean(Image.open(f'{d}/{p}'))), rest), rest) for p in paths]
    b = rest.getbbox(); dx = round(CX - (b[0] + b[2]) / 2); feet = b[3]
    out, w = [], []
    prev = None
    for p, f in zip(paths, frames):
        fb = f.getbbox(); dy = (FEET - fb[3]) if kind != 'swim' else (FEET - 10 - feet)
        if kind != 'swim' and fb[3] < feet - 1: dy = FEET - feet  # saut : garde le décalage du repos
        v = Image.new('RGBA', (96, 72)); v.paste(f, (dx, dy)); out.append(v)
        if os.environ.get('DBG'): print(p, fb, dx, dy)
        sk = f'{d}/{p}'
        if os.path.exists(sk[:-4] + '.skel.json'):
            # main avant : au repos, le poignet le plus en avant ; ensuite celui le plus proche de la main
            # précédente (le squelette échange parfois gauche et droite quand le buste tourne)
            # bras avant : celui dont l'épaule est la plus en avant (le squelette échange gauche et droite quand
            # le buste tourne : on suit l'épaule, pas l'étiquette)
            sides = [(kp(sk, f'{s_} SHOULDER'), kp(sk, f'{s_} ARM'), kp(sk, f'{s_} ELBOW')) for s_ in ('LEFT', 'RIGHT')]
            _, wr, el = max(sides, key=lambda a: a[0][0])
            prev = wr
            fa = ang((wr[0] - el[0], wr[1] - el[1]))
            u = ((wr[0] - el[0]), (wr[1] - el[1])); n = math.hypot(*u) or 1
            gx, gy = wr[0] + 1.5 * u[0] / n, wr[1] + 1.5 * u[1] / n   # centre du poing, un peu après le poignet
            w.append([gx + dx, gy + dy, weapon_deg(cls, fa) if cls else 0, fa])
        else: w.append(None)
    if all(x is None for x in w): w = None
    else:
        # lissage [1,2,1] des positions et angles (circulaire), repos (première/dernière) : arme droite (0)
        n = len(w); s = []
        for i in range(n):
            a, b_, c = w[max(0, i - 1)], w[i], w[min(n - 1, i + 1)]
            x, y = b_[0], b_[1]
            def cd(q): return ((q - b_[2] + 180) % 360) - 180
            dg = (b_[2] + (cd(a[2]) + cd(c[2])) / 4) % 360
            s.append([round(x), round(y), round(dg / 5) * 5 % 360, 0])
        if cls and kind == 'attack': s[0][2] = s[-1][2] = 0
        w = s
    # prise ramenée sur le corps (pixel opaque le plus proche, 6 px au plus)
    if w:
        for i, f in enumerate(out):
            x, y = w[i][0], w[i][1]; px = f.load()
            if 0 <= x < 96 and 0 <= y < 72 and px[x, y][3]: continue
            best = None
            for yy in range(y - 6, y + 7):
                for xx in range(x - 6, x + 7):
                    if 0 <= xx < 96 and 0 <= yy < 72 and px[xx, yy][3]:
                        dd = math.hypot(xx - x, yy - y)
                        if best is None or dd < best[0]: best = (dd, xx, yy)
            if best: w[i][0], w[i][1] = best[1], best[2]
    hit = None
    if kind == 'attack' and w: hit = max(range(len(w)), key=lambda i: (w[i][0], -i))
    os.makedirs(f'{W}/prep/{anim}', exist_ok=True)
    pal, fr = {}, []
    chars = [chr(c) for c in range(33, 127) if chr(c) not in '."\\\'`']
    for i, f in enumerate(out):
        f.save(f'{W}/prep/{anim}/f{i}.png')
        px = f.load(); rows = []
        for y in range(72):
            r = ''
            for x in range(96):
                p = px[x, y]
                if not p[3]: r += '.'; continue
                h = '#%02x%02x%02x' % p[:3]
                if h not in pal: pal[h] = chars[len(pal)] if len(pal) < len(chars) else None
                if pal[h] is None:  # palette pleine : couleur la plus proche
                    h = min((k for k in pal if pal[k]), key=lambda k: sum((int(k[j:j + 2], 16) - p[(j - 1) // 2]) ** 2 for j in (1, 3, 5)))
                r += pal[h]
            rows.append(r)
        fr.append(rows)
    res = {'frames': fr, 'pal': {v: k for k, v in pal.items() if v}, 'ox': -VIEW_O[0], 'oy': -VIEW_O[1],
           'w': [[p[0] - VIEW_O[0], p[1] - VIEW_O[1], p[2], p[3]] for p in w] if w else None, 'hit': hit, 'kind': kind}
    json.dump(res, open(f'{W}/prep/{anim}.json', 'w'))
    return anim, len(fr), len(pal)


if __name__ == '__main__':
    for a in sys.argv[1:]: print(*build(a))
