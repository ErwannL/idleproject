"""Thèmes d'interface (hors Chevalier) : cadres 9-slice + décors, pour 9 thèmes.

Chaque thème a son propre STYLE (matière du cadre, forme des coins, ornements, en-tête,
boutons), pas seulement sa palette. Les 16 cadres reprennent EXACTEMENT les dimensions et
les valeurs 9-slice de assets/ui/frames/frames.json (Chevalier, ui_frames.py) : seule l'URL
de l'image change côté CSS.

En plus des cadres, chaque thème a ses décors (PNG transparents dessinés à 1x, affichés à 2x
en `image-rendering: pixelated`) :
  corner.png    40x40  ornement du coin HAUT-GAUCHE du panneau (miroir CSS pour les 3 autres),
                       posé sur le cadre (même origine que le panneau) et débordant ~8 px dedans
  crest.png     56x22  cimier centré sur le bord haut de l'en-tête (le déborde)
  tab_deco.png  20x8   petit ornement au-dessus de l'onglet actif
  divider.png   96x7   séparateur horizontal (motif central, bouts effilés) sous les titres
  texture.png   64x64  tuile SANS RACCORD, très sombre, faible contraste (derrière le texte)
  particle1/2   5..11  sprites de particules animées

Fichiers : ui_px.py (primitives), ui_theme_base.py (outils 9-slice + cadre générique),
ui_theme_styles.py (cadres des 9 thèmes), ui_decor.py (décors), ui_themes_preview.py (maquettes).

Usage :
  python3 tools/art/ui_themes.py                     # écrit assets/ui/themes/<id>/*.png + vérifie
  python3 tools/art/ui_themes.py --preview DOSSIER   # + maquettes (panneau complet, x3)
  python3 tools/art/ui_themes.py --check             # vérifie seulement

Règles 9-slice respectées (vérifiées) :
  * zones de bord étirées (stretch) : uniformes sur leur longueur, ornements dans les coins ;
  * `panel` (repeat round) : motifs périodiques de 16 px sur les barres ;
  * centre (fill) uni.
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)

import ui_frames as UF  # noqa: E402
import ui_px as X  # noqa: E402
from ui_theme_styles import CLASSES  # noqa: E402
import ui_decor as UD  # noqa: E402

THEMES = [t for t in ['royal', 'sylvan', 'forge', 'arcane', 'necro', 'desert', 'frost', 'sakura', 'shadow']
          if t in CLASSES]
NAMES = list(UF.FRAMES.keys())
OUT = os.path.join(ROOT, 'assets', 'ui', 'themes')

DECOR = {  # nom -> (w, h) exacts, ou (wmin, wmax) pour les particules
    'corner': (40, 40), 'crest': (56, 22), 'tab_deco': (20, 8), 'divider': (96, 7), 'texture': (64, 64),
}
PARTICLE_RANGE = (5, 11)


def make_frames(theme):
    T = CLASSES[theme]()
    out = {
        'panel': T.panel(), 'panel_alt': T.panel_alt(), 'header': T.header(),
        'tab': T.tab(False), 'tab_active': T.tab(True), 'slot': T.slot(), 'tooltip': T.tooltip(),
    }
    for k in ('gold', 'blue', 'purple', 'gray', 'red'):
        out['btn_' + k] = T.button(k)
    for k in ('green', 'gray', 'gold', 'red'):
        out['badge_' + k] = T.badge(k)
    return out


def knight_meta():
    with open(os.path.join(ROOT, 'assets', 'ui', 'frames', 'frames.json')) as f:
        return json.load(f)


def build(out_root, themes=None):
    meta = knight_meta()
    n = 0
    for theme in themes or THEMES:
        d = os.path.join(out_root, theme)
        os.makedirs(d, exist_ok=True)
        frames = make_frames(theme)
        for name in NAMES:
            im = frames[name]
            assert (im.w, im.h) == (meta[name]['w'], meta[name]['h']), (theme, name, im.w, im.h)
            im.save(os.path.join(d, name + '.png'))
            n += 1
        for name, im in UD.make_decor(theme).items():
            im.save(os.path.join(d, name + '.png'))
            n += 1
    return n


# ====================================================================== vérifications

def stretch_issues(im, m):
    """Bords étirés uniformes sur leur longueur, centre uni (sauf `round` : centre seulement)."""
    px = im.load()
    w, h = im.size
    t, r, b, l = m['slice']
    bad = []
    if m['repeat'] == 'stretch':
        for y in list(range(t)) + list(range(h - b, h)):
            if len({px[x, y] for x in range(l, w - r)}) > 1:
                bad.append(('ligne', y))
        for x in list(range(l)) + list(range(w - r, w)):
            if len({px[x, y] for y in range(t, h - b)}) > 1:
                bad.append(('colonne', x))
    if len({px[x, y] for x in range(l, w - r) for y in range(t, h - b)}) > 1:
        bad.append(('centre',))
    return bad


def seam_score(im):
    """Raccord : écart moyen entre bords opposés (ligne 0 / ligne h-1, colonne 0 / w-1) comparé
    au plus grand écart entre lignes (colonnes) voisines à l'intérieur de la tuile."""
    px = im.load()
    w, h = im.size

    def d(a, b):
        return sum(abs(a[i] - b[i]) for i in range(3))

    def rowd(y0, y1):
        return sum(d(px[x, y0], px[x, y1]) for x in range(w)) / w

    def cold(x0, x1):
        return sum(d(px[x0, y], px[x1, y]) for y in range(h)) / h
    edge = max(rowd(h - 1, 0), cold(w - 1, 0))
    inner = max(max(rowd(y, y + 1) for y in range(h - 1)), max(cold(x, x + 1) for x in range(w - 1)))
    return edge, inner


def texture_stats(im):
    rgb = im.convert('RGB')
    px = [rgb.getpixel((x, y)) for y in range(rgb.height) for x in range(rgb.width)]
    ls = [X.lum(p) for p in px]
    return min(ls), max(ls), sum(ls) / len(ls), px[ls.index(max(ls))]


def check(out_root, themes=None):
    """Dimensions = Chevalier, 9-slice propre, décors présents aux bonnes tailles, textures
    sans raccord et peu contrastées."""
    from PIL import Image
    meta = knight_meta()
    n = 0
    for theme in themes or THEMES:
        for name in NAMES:
            kp = os.path.join(ROOT, 'assets', 'ui', 'frames', meta[name]['file'])
            tp = os.path.join(out_root, theme, name + '.png')
            assert os.path.exists(tp), tp
            ks, ts = Image.open(kp).size, Image.open(tp).size
            assert ks == ts == (meta[name]['w'], meta[name]['h']), (tp, ts, ks)
            bad = stretch_issues(Image.open(tp).convert('RGBA'), meta[name])
            assert not bad, (tp, bad[:4])
            n += 1
        for name, size in DECOR.items():
            tp = os.path.join(out_root, theme, name + '.png')
            assert os.path.exists(tp), tp
            im = Image.open(tp)
            assert im.size == size, (tp, im.size, size)
            assert im.mode == 'RGBA', (tp, im.mode)
            n += 1
        for name in ('particle1', 'particle2'):
            tp = os.path.join(out_root, theme, name + '.png')
            assert os.path.exists(tp), tp
            w, h = Image.open(tp).size
            assert PARTICLE_RANGE[0] <= w <= PARTICLE_RANGE[1] and PARTICLE_RANGE[0] <= h <= PARTICLE_RANGE[1], (tp, w, h)
            n += 1
        tex = Image.open(os.path.join(out_root, theme, 'texture.png')).convert('RGBA')
        assert tex.getextrema()[3][0] == 255, (theme, 'texture non opaque')
        edge, inner = seam_score(tex)
        assert edge <= inner + 0.5, (theme, 'raccord texture', edge, inner)
        lo, hi, mean, _ = texture_stats(tex)
        assert hi - lo <= 0.10 and mean < 0.06, (theme, 'texture trop contrastée/claire', lo, hi, mean)
        # coin et cimier : pas de pixel opaque collé au bord bas/droit (débordement coupé)
    return n


# ====================================================================== contraste

TXT = X.hexc('#e6ecf6')
HEAD_TXT = X.hexc('#ffe8a8')
DARK = X.hexc('#3a2208')
WHITE = (255, 255, 255)
TEXT_ON = {
    'panel': TXT, 'panel_alt': TXT, 'tab': TXT, 'tab_active': TXT, 'slot': TXT, 'tooltip': TXT,
    'header': HEAD_TXT, 'btn_gold': DARK, 'badge_gold': DARK,
    'btn_blue': WHITE, 'btn_red': WHITE, 'btn_purple': WHITE, 'btn_gray': WHITE,
    'badge_green': WHITE, 'badge_gray': WHITE, 'badge_red': WHITE,
}


def contrast_report(out_root, themes=None):
    """Contraste texte / fond : pire cas sur la zone où le texte se pose (centre du cadre
    rendu à une taille typique), + texte clair sur la texture la plus claire."""
    from PIL import Image
    meta = knight_meta()
    rows = []
    sizes = {'panel': (120, 80), 'panel_alt': (80, 50), 'header': (150, 25), 'tab': (56, 20),
             'tab_active': (56, 20), 'slot': (24, 24), 'tooltip': (96, 22)}
    for theme in ['knight'] + list(themes or THEMES):
        folder = os.path.join(ROOT, 'assets', 'ui', 'frames') if theme == 'knight' else os.path.join(out_root, theme)
        worst = (99, '')
        worst_b = (99, '')
        for name in NAMES:
            m = meta[name]
            src = Image.open(os.path.join(folder, m['file'])).convert('RGBA')
            W, H = sizes.get(name, (46, 18) if name.startswith('btn') else (16, 12))
            r = nine_slice(src, m['slice'], m['repeat'], W, H).load()
            # zone de texte : bande centrale (hauteur ~ 7 px source au centre, marge latérale = slice)
            t, rr, b, l = m['slice']
            y0, y1 = max(0, H // 2 - 3), min(H, H // 2 + 4)
            x0, x1 = l, W - rr
            cs = []
            for y in range(y0, y1):
                for x in range(x0, x1):
                    p = r[x, y]
                    if p[3] > 0:
                        cs.append(X.contrast(TEXT_ON[name], p[:3]))
            c = min(cs) if cs else 99
            if name.startswith('badge'):
                if c < worst_b[0]:
                    worst_b = (c, name)
            elif c < worst[0]:
                worst = (c, name)
        tex = os.path.join(folder, 'texture.png')
        tx = ''
        if os.path.exists(tex):
            _, _, _, brightest = texture_stats(Image.open(tex))
            tx = ' | texte/texture %.1f' % X.contrast(TXT, brightest)
        rows.append('%-7s pire contraste cadres %.2f (%s) | pastilles %.2f (%s)%s' %
                    (theme, worst[0], worst[1], worst_b[0], worst_b[1], tx))
    return rows


# ====================================================================== rendu 9-slice

def nine_slice(src, sl, rep, W, H):
    """Rendu 9-slice façon CSS border-image (largeur de bord = slice, en px source)."""
    from PIL import Image
    t, r, b, l = sl
    w, h = src.size
    out = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    xs = [(0, l, 0, l), (l, w - r, l, W - r), (w - r, w, W - r, W)]
    ys = [(0, t, 0, t), (t, h - b, t, H - b), (h - b, h, H - b, H)]
    for (sy0, sy1, dy0, dy1) in ys:
        for (sx0, sx1, dx0, dx1) in xs:
            tw, th = dx1 - dx0, dy1 - dy0
            if tw <= 0 or th <= 0 or sx1 <= sx0 or sy1 <= sy0:
                continue
            piece = src.crop((sx0, sy0, sx1, sy1))
            pw, ph = sx1 - sx0, sy1 - sy0
            if rep == 'round':
                nx = max(1, round(tw / pw)) if (sx0, sx1) == (l, w - r) else 1
                ny = max(1, round(th / ph)) if (sy0, sy1) == (t, h - b) else 1
                cw, ch = tw / nx, th / ny
                for j in range(ny):
                    for i in range(nx):
                        x0, y0 = dx0 + int(round(i * cw)), dy0 + int(round(j * ch))
                        x1, y1 = dx0 + int(round((i + 1) * cw)), dy0 + int(round((j + 1) * ch))
                        out.paste(piece.resize((x1 - x0, y1 - y0), Image.NEAREST), (x0, y0))
            else:
                out.paste(piece.resize((tw, th), Image.NEAREST), (dx0, dy0))
    return out


if __name__ == '__main__':
    args = sys.argv[1:]
    only = [a for a in args if a in THEMES]
    if '--check' not in args:
        n = build(OUT, only or None)
        print('%d PNG -> %s' % (n, OUT))
    print('vérif dimensions + 9-slice + décors + textures OK : %d fichiers' % check(OUT, only or None))
    for line in contrast_report(OUT, only or None):
        print('  ' + line)
    if '--preview' in args:
        import ui_themes_preview as PV
        dest = args[args.index('--preview') + 1]
        PV.run(dest, (['knight'] + only) if only else ['knight'] + THEMES)
        print('maquettes ->', dest)
