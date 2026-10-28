"""Aperçu « maquette » d'un thème : panneau 9-slice + coins + cimier + texture + séparateur
+ onglets + boutons + cases + particules. Sert à juger le rendu final (x3).

Usage : python3 tools/art/ui_themes_preview.py DOSSIER [theme ...]
"""
import os
import random
import sys

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)

import ui_themes as UT  # noqa: E402

FONT_B = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
FONT_R = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'

TXT = (230, 236, 246)
HEAD_TXT = (255, 232, 168)
DARK_TXT = (58, 34, 8)
WHITE = (255, 255, 255)


def load(folder, name):
    p = os.path.join(folder, name)
    return Image.open(p).convert('RGBA') if os.path.exists(p) else None


def mock(theme, scale=3):
    meta = UT.knight_meta()
    folder = os.path.join(ROOT, 'assets', 'ui', 'frames') if theme == 'knight' else \
        os.path.join(ROOT, 'assets', 'ui', 'themes', theme)

    def frame(name, W, H):
        m = meta[name]
        return UT.nine_slice(load(folder, m['file']), m['slice'], m['repeat'], W, H)

    W, H = 300, 200
    base = Image.new('RGBA', (W, H), (34, 38, 46, 255))
    # décor de fond (scène floue) pour juger la découpe
    d0 = ImageDraw.Draw(base)
    for i in range(0, W, 12):
        d0.rectangle((i, 0, i + 5, H), fill=(38, 43, 52, 255))
    texts = []  # (x, y, txt, color, size, bold, anchor)

    # ---- panneau
    px, py, pw, ph = 8, 16, 284, 178
    base.alpha_composite(frame('panel', pw, ph), (px, py))
    tex = load(folder, 'texture.png')
    if tex is not None:
        inset = 16
        for ty in range(py + inset, py + ph - inset, 64):
            for tx in range(px + inset, px + pw - inset, 64):
                cw = min(64, px + pw - inset - tx)
                ch = min(64, py + ph - inset - ty)
                base.alpha_composite(tex.crop((0, 0, cw, ch)), (tx, ty))
    corner = load(folder, 'corner.png')
    if corner is not None:
        cw, ch = corner.size
        base.alpha_composite(corner, (px, py))
        base.alpha_composite(corner.transpose(Image.FLIP_LEFT_RIGHT), (px + pw - cw, py))
        base.alpha_composite(corner.transpose(Image.FLIP_TOP_BOTTOM), (px, py + ph - ch))
        base.alpha_composite(corner.transpose(Image.ROTATE_180), (px + pw - cw, py + ph - ch))

    # ---- en-tête + cimier
    hw, hh = 150, 25
    hx, hy = px + (pw - hw) // 2, py + 12
    base.alpha_composite(frame('header', hw, hh), (hx, hy))
    crest = load(folder, 'crest.png')
    if crest is not None:
        base.alpha_composite(crest, (hx + (hw - crest.width) // 2, hy - crest.height + 9))
    texts.append((hx + hw / 2, hy + hh / 2 + 0.5, 'Équipement', HEAD_TXT, 11, True, 'mm'))

    # ---- titre de section + séparateur
    sx, sy = px + 22, py + 46
    texts.append((sx, sy, 'Inventaire du héros', TXT, 8, True, 'lt'))
    div = load(folder, 'divider.png')
    if div is not None:
        base.alpha_composite(div, (sx - 2, sy + 11))

    # ---- onglets
    tx0, ty0 = px + 22, py + 68
    tdeco = load(folder, 'tab_deco.png')
    for i, lab in enumerate(('Armes', 'Armures', 'Reliques')):
        act = i == 1
        x = tx0 + i * 60
        base.alpha_composite(frame('tab_active' if act else 'tab', 56, 20), (x, ty0))
        if act and tdeco is not None:
            base.alpha_composite(tdeco, (x + 28 - tdeco.width // 2, ty0 - tdeco.height + 2))
        texts.append((x + 28, ty0 + 10, lab, TXT, 7.5, act, 'mm'))

    # ---- boutons
    bx, by = px + 22, py + 96
    for i, (k, lab, c) in enumerate((('gold', 'Acheter', DARK_TXT), ('blue', 'Combat', WHITE),
                                     ('red', 'Fuir', WHITE), ('purple', 'Magie', WHITE),
                                     ('gray', 'Fermer', WHITE))):
        x = bx + i * 50
        base.alpha_composite(frame('btn_' + k, 46, 18), (x, by))
        texts.append((x + 23, by + 9, lab, c, 7, True, 'mm'))

    # ---- cases + pastilles
    for i in range(5):
        x = bx + i * 26
        base.alpha_composite(frame('slot', 24, 24), (x, by + 26))
    for i, k in enumerate(('green', 'gray', 'gold', 'red')):
        x = bx + 136 + i * 18
        base.alpha_composite(frame('badge_' + k, 16, 12), (x, by + 32))
        texts.append((x + 8, by + 38, str(i + 1), DARK_TXT if k == 'gold' else WHITE, 6.5, True, 'mm'))

    # ---- panneau secondaire + infobulle
    ax, ay = px + 196, py + 44
    base.alpha_composite(frame('panel_alt', 70, 50), (ax, ay))
    texts.append((ax + 35, ay + 20, 'Or : 1 250', TXT, 7, True, 'mm'))
    texts.append((ax + 35, ay + 31, 'Gemmes : 42', TXT, 7, False, 'mm'))
    base.alpha_composite(frame('tooltip', 96, 22), (bx + 136, by + 50))
    texts.append((bx + 184, by + 61, 'Épée runique +3', TXT, 7, False, 'mm'))

    # ---- particules
    p1, p2 = load(folder, 'particle1.png'), load(folder, 'particle2.png')
    if p1 is not None:
        rnd = random.Random(7)
        for i in range(16):
            sp = p1 if i % 2 == 0 else p2
            x, y = rnd.randrange(px + 10, px + pw - 20), rnd.randrange(py + 10, py + ph - 14)
            base.alpha_composite(sp, (x, y))

    big = base.resize((W * scale, H * scale), Image.NEAREST)
    d = ImageDraw.Draw(big)
    for (x, y, s, c, size, bold, anchor) in texts:
        f = ImageFont.truetype(FONT_B if bold else FONT_R, int(size * scale))
        d.text((x * scale + 2, y * scale + 2), s, font=f, fill=(0, 0, 0, 160), anchor=anchor)
        d.text((x * scale, y * scale), s, font=f, fill=c, anchor=anchor)
    d.text((6, 4), theme, font=ImageFont.truetype(FONT_B, 22), fill=(255, 255, 255))
    return big


def decor_sheet(theme, scale=4):
    folder = os.path.join(ROOT, 'assets', 'ui', 'themes', theme)
    names = ['corner.png', 'crest.png', 'tab_deco.png', 'divider.png', 'texture.png',
             'particle1.png', 'particle2.png']
    ims = [load(folder, n) for n in names]
    ims = [i for i in ims if i is not None]
    W = sum(i.width + 6 for i in ims) + 6
    H = max(i.height for i in ims) + 12
    c = Image.new('RGBA', (W, H), (40, 44, 52, 255))
    x = 6
    for i in ims:
        c.alpha_composite(i, (x, 6))
        x += i.width + 6
    return c.resize((W * scale, H * scale), Image.NEAREST)


def sources_sheet(themes, scale=3):
    """Toutes les sources brutes (16 cadres) côte à côte, une colonne par thème."""
    meta = UT.knight_meta()
    cols = []
    for theme in themes:
        folder = os.path.join(ROOT, 'assets', 'ui', 'frames') if theme == 'knight' else \
            os.path.join(ROOT, 'assets', 'ui', 'themes', theme)
        cols.append([load(folder, meta[n]['file']) for n in UT.NAMES])
    cw = 52
    H = sum(meta[n]['h'] + 4 for n in UT.NAMES)
    raw = Image.new('RGBA', (cw * len(cols), H), (40, 44, 52, 255))
    for i, col_ in enumerate(cols):
        y = 0
        for im in col_:
            raw.alpha_composite(im, (i * cw, y))
            y += im.height + 4
    return raw.resize((raw.width * scale, raw.height * scale), Image.NEAREST)


def run(dest, themes):
    sources_sheet(themes).save(os.path.join(dest, 'all_sources.png'))
    os.makedirs(dest, exist_ok=True)
    mocks = []
    for t in themes:
        m = mock(t)
        m.save(os.path.join(dest, t + '.png'))
        if t != 'knight':
            decor_sheet(t).save(os.path.join(dest, t + '_decor.png'))
        mocks.append(m.resize((m.width // 3 * 2, m.height // 3 * 2), Image.NEAREST))
    if len(mocks) > 1:
        cols = 2
        rows = (len(mocks) + cols - 1) // cols
        w, h = mocks[0].size
        ov = Image.new('RGBA', (w * cols, h * rows), (0, 0, 0, 255))
        for i, m in enumerate(mocks):
            ov.alpha_composite(m, ((i % cols) * w, (i // cols) * h))
        ov.save(os.path.join(dest, 'overview.png'))


if __name__ == '__main__':
    dest = sys.argv[1]
    themes = sys.argv[2:] or ['knight'] + UT.THEMES
    run(dest, themes)
    print('maquettes ->', dest)
