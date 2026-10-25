"""Cadres d'interface 9-slice (CSS `border-image`) : style pixel art fantasy sombre.

Panneaux bleu nuit / acier à coins dorés ornementés, bandeaux d'en-tête, onglets,
boutons, cases, pastilles de statut, infobulles.

Usage : python3 tools/art/ui_frames.py [dossier_sortie]
        (défaut : assets/ui/frames/ à la racine du dépôt)

Écrit un PNG par cadre + `frames.json` :
  {nom: {"file", "w", "h", "slice": [haut, droite, bas, gauche],
         "border": [idem, en px source], "repeat": "stretch"|"round", "fill": true}}

Côté CSS (échelle S = 2 ou 3, en px écran) :
  border-style: solid;
  border-width: calc(haut*S)px calc(droite*S)px ...;
  border-image: url(panel.png) <slice> fill / <border-width> <repeat>;
  image-rendering: pixelated;
"""
import json
import os
import sys

from PIL import Image

# ====================================================================== palette

C = {
    # contours / fonds
    'K': (6, 8, 16),          # contour quasi noir
    'n0': (10, 14, 28),       # nuit très sombre
    'n1': (17, 24, 46),       # fond panneau
    'n2': (24, 34, 62),       # fond panneau clair
    'n3': (31, 44, 78),
    # acier
    's0': (30, 40, 68),
    's1': (46, 62, 102),
    's2': (68, 90, 140),
    's3': (102, 128, 182),
    's4': (150, 176, 220),
    # or
    'g0': (58, 30, 8),
    'g1': (122, 70, 16),
    'g2': (190, 124, 28),
    'g3': (240, 184, 52),
    'g4': (255, 236, 150),
    # gemmes
    'r1': (120, 20, 40), 'r2': (214, 46, 70), 'r3': (255, 150, 160),
    'b1': (20, 60, 140), 'b2': (60, 150, 240), 'b3': (190, 236, 255),
}

# rampes de boutons : (contour, ombre, base, clair, reflet)
BTN = {
    'gold':   ((58, 30, 8), (150, 88, 18), (220, 156, 36), (248, 200, 70), (255, 240, 170)),
    'blue':   ((8, 18, 44), (28, 60, 130), (48, 102, 196), (88, 150, 232), (180, 220, 255)),
    'purple': ((26, 8, 44), (76, 30, 120), (120, 56, 182), (164, 100, 226), (220, 180, 255)),
    'gray':   ((14, 16, 22), (58, 64, 78), (92, 100, 118), (130, 140, 160), (196, 204, 220)),
    'red':    ((40, 6, 10), (120, 22, 30), (182, 40, 46), (226, 78, 76), (255, 170, 160)),
}

BADGE = {
    'green': ((6, 30, 12), (24, 100, 44), (46, 160, 70), (110, 218, 120)),
    'gray':  ((14, 16, 22), (54, 60, 74), (86, 94, 112), (140, 150, 170)),
    'gold':  ((58, 30, 8), (150, 92, 20), (214, 152, 36), (255, 222, 120)),
    'red':   ((40, 6, 10), (116, 22, 30), (176, 40, 46), (240, 110, 104)),
}


def col(c):
    if c is None:
        return (0, 0, 0, 0)
    if isinstance(c, str):
        c = C[c]
    return c if len(c) == 4 else (*c, 255)


class Img:
    def __init__(self, w, h, fill=None):
        self.w, self.h = w, h
        self.px = [[col(fill) for _ in range(w)] for _ in range(h)]

    def set(self, x, y, c):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.px[y][x] = col(c)

    def rect(self, x, y, w, h, c):
        for j in range(y, y + h):
            for i in range(x, x + w):
                self.set(i, j, c)

    def ring(self, i, c, tl=None, br=None):
        """Anneau à l'inset i ; tl/br : teintes haut-gauche / bas-droite (biseau)."""
        x0, y0, x1, y1 = i, i, self.w - 1 - i, self.h - 1 - i
        a, b = tl or c, br or c
        for x in range(x0, x1 + 1):
            self.set(x, y0, a)
            self.set(x, y1, b)
        for y in range(y0, y1 + 1):
            self.set(x0, y, a)
            self.set(x1, y, b)
        if tl and br:          # coins opposés en teinte neutre
            self.set(x1, y0, c)
            self.set(x0, y1, c)

    def stamp4(self, rows, pal):
        """Motif de coin haut-gauche, reproduit en miroir dans les 4 coins."""
        for y, row in enumerate(rows):
            for x, ch in enumerate(row):
                if ch in ' .':
                    continue
                c = pal[ch]
                for (px, py) in ((x, y), (self.w - 1 - x, y),
                                 (x, self.h - 1 - y), (self.w - 1 - x, self.h - 1 - y)):
                    self.set(px, py, c)

    def stamp(self, rows, pal, ox, oy, flipx=False):
        for y, row in enumerate(rows):
            for x, ch in enumerate(row):
                if ch in ' .':
                    continue
                xx = ox + (len(row) - 1 - x if flipx else x)
                self.set(xx, oy + y, pal[ch])

    def save(self, path):
        im = Image.new('RGBA', (self.w, self.h))
        im.putdata([p for row in self.px for p in row])
        im.save(path, optimize=True)


GOLD = {'o': 'g0', 'd': 'g1', 'g': 'g2', 'h': 'g3', 'w': 'g4', 'K': 'K',
        'r': 'r1', 'R': 'r2', 'x': 'r3', 'b': 'b1', 'B': 'b2', 'X': 'b3'}

# ====================================================================== panneaux


def steel_frame(im, inner_fill='n1'):
    """Double bordure acier : contour, biseau acier épais, gorge sombre, filet acier."""
    im.rect(0, 0, im.w, im.h, inner_fill)
    im.ring(0, 'K')
    im.ring(1, 's2', 's3', 's1')
    im.ring(2, 's1', 's2', 's0')
    im.ring(3, 's1', 's2', 's0')
    im.ring(4, 'K')
    im.ring(5, 'n0')
    im.ring(6, 'g1', 'g2', 'g0')   # filet doré intérieur
    im.ring(7, 'K')
    im.ring(8, 'n0')
    # ombre portée intérieure (haut/gauche plus sombre)
    for x in range(9, im.w - 9):
        im.set(x, 9, 'n0')
    for y in range(9, im.h - 9):
        im.set(9, y, 'n0')


GEM_SETTING = [
    "..KKKKKKK..",
    ".KwhhhhhgK.",
    "KwhgggggddK",
    "KhgKKKKKKdK",
    "KhgKxxRRKdK",
    "KhgKxRRRKdK",
    "KhgKRRRrKdK",
    "KhgKRRrrKdK",
    "KgdKKKKKKoK",
    ".KgddddooK.",
    "..KKKKKKK..",
]


def panel_corner():
    """Coin doré haut-gauche 16x16 : équerre biseautée + gemme rouge sertie en losange."""
    t = Img(16, 16)
    # équerre (bras haut et gauche, 3 px d'épaisseur + contour)
    t.rect(0, 0, 15, 5, 'K')
    t.rect(0, 0, 5, 15, 'K')
    for x in range(1, 14):
        t.set(x, 1, 'g4' if x < 4 else 'g3')
        t.set(x, 2, 'g2')
        t.set(x, 3, 'g1')
    for y in range(1, 14):
        t.set(1, y, 'g4' if y < 4 else 'g3')
        t.set(2, y, 'g2')
        t.set(3, y, 'g1')
    # bras terminés en pointe de lance
    for x in (13, 14, 15):
        for y in range(0, 5):
            t.set(x, y, None)
            t.set(y, x, None)
    tip = {(13, 0): 'K', (13, 1): 'g3', (13, 2): 'g2', (13, 3): 'g1', (13, 4): 'K',
           (14, 1): 'K', (14, 2): 'g2', (14, 3): 'K', (15, 2): 'K'}
    for (x, y), c in tip.items():
        t.set(x, y, c)
        t.set(y, x, {'g3': 'g3', 'g1': 'g1'}.get(c, c))
    return t


def stamp_img4(im, t):
    for y in range(t.h):
        for x in range(t.w):
            p = t.px[y][x]
            if p[3] == 0:
                continue
            for (px, py) in ((x, y), (im.w - 1 - x, y), (x, im.h - 1 - y), (im.w - 1 - x, im.h - 1 - y)):
                im.px[py][px] = p


def panel():
    im = Img(48, 48)
    steel_frame(im)
    stamp_img4(im, panel_corner())
    # rivets sur les barres d'acier (motif de 16 px : à répéter en `round`)
    for (x, y) in ((23, 1), (1, 23), (23, im.h - 4), (im.w - 4, 23)):
        im.rect(x, y, 2, 3, 'K') if y in (1, im.h - 4) else im.rect(x, y, 3, 2, 'K')
    for (x, y) in ((23, 2), (2, 23), (23, im.h - 3), (im.w - 3, 23)):
        horiz = y in (2, im.h - 3)
        im.set(x, y, 's4')
        im.set(x + 1 if horiz else x, y if horiz else y + 1, 's2')
    # gemmes serties posées sans miroir : lumière toujours venant du haut-gauche
    g = len(GEM_SETTING)
    for (x, y) in ((1, 1), (im.w - 1 - g, 1), (1, im.h - 1 - g), (im.w - 1 - g, im.h - 1 - g)):
        im.stamp(GEM_SETTING, GOLD, x, y)
    return im


PANEL_ALT_CORNER = [
    "KKKKKKK...",
    "KwhhhgoK..",
    "KhggddoK..",
    "KhgoooK...",
    "KhdoK.....",
    "KgoK......",
    "KoK.......",
    "KK........",
]


def panel_alt():
    im = Img(32, 32, 'n2')
    im.ring(0, 'K')
    im.ring(1, 's2', 's3', 's1')
    im.ring(2, 's1', 's1', 's0')
    im.ring(3, 'K')
    im.ring(4, 'n1')
    for x in range(5, im.w - 5):
        im.set(x, 5, 'n1')
    im.stamp4(PANEL_ALT_CORNER, GOLD)
    return im


# ====================================================================== en-tête

def header():
    """Bandeau 48x25 : pointes à gauche/droite, liseré doré. Ligne 12 = axe des pointes."""
    W, H = 48, 25
    im = Img(W, H)
    mid = 12
    P = 12  # largeur de la pointe
    for y in range(H):
        d = abs(y - mid)
        x0 = d  # bord gauche de la forme (diagonale 1:1)
        for x in range(x0, W - x0):
            im.set(x, y, 'K')
    # liseré or (1 px à l'intérieur du contour) puis bleu
    for y in range(1, H - 1):
        d = abs(y - mid)
        xl, xr = d + 1, W - 2 - d
        for x in range(xl, xr + 1):
            top = y <= mid
            im.set(x, y, 'g3' if top else 'g1')
        # bords diagonaux en or moyen
        im.set(xl, y, 'g2' if y <= mid else 'g1')
        im.set(xr, y, 'g2' if y <= mid else 'g1')
    for y in range(3, H - 3):
        d = abs(y - mid)
        xl, xr = d + 3, W - 4 - d
        for x in range(xl, xr + 1):
            im.set(x, y, 'K' if x in (xl, xr) or y in (3, H - 4) else 'b1')
    # dégradé bleu du bandeau
    shades = {4: (70, 120, 210), 5: (54, 100, 190), 6: (44, 86, 172), 7: (40, 78, 160),
              8: (36, 72, 150), 9: (34, 68, 142), 10: (32, 64, 136), 11: (30, 60, 128),
              12: (28, 56, 120), 13: (27, 53, 114), 14: (26, 50, 108), 15: (24, 47, 102),
              16: (23, 44, 96), 17: (22, 42, 90), 18: (20, 38, 82), 19: (18, 34, 74),
              20: (16, 30, 66)}
    for y in range(4, H - 4):
        d = abs(y - mid)
        xl, xr = d + 4, W - 5 - d
        for x in range(xl, xr + 1):
            im.set(x, y, shades[y])
    # gemme rouge sur chaque pointe
    gem = ["..K..", ".KxK.", "KRRrK", ".KrK.", "..K.."]
    gp = dict(GOLD)
    im.stamp(gem, gp, 5, mid - 2)
    im.stamp(gem, gp, W - 10, mid - 2)
    return im


# ====================================================================== onglets

TAB_CORNER = [
    "KKKKKK....",
    "KwhhgoK...",
    "KhggdoK...",
    "KhgoK.....",
    "KgoK......",
    "KoK.......",
]


def tab(active):
    im = Img(32, 32)
    if active:
        im.rect(0, 0, 32, 32, (30, 50, 98))
        im.ring(0, 'K')
        im.ring(1, 'g2', 'g3', 'g1')
        im.ring(2, 'K')
        im.ring(3, (110, 190, 255), (170, 226, 255), (60, 130, 220))
        im.ring(4, (40, 72, 140))
        # lueur intérieure (dégradé vers le bas depuis le haut)
        for y, c in ((5, (56, 98, 176)), (6, (46, 82, 156)), (7, (36, 62, 120))):
            for x in range(5, 27):
                im.set(x, y, c)
        im.stamp4(TAB_CORNER, GOLD)
    else:
        im.rect(0, 0, 32, 32, 'n2')
        im.ring(0, 'K')
        im.ring(1, 's2', 's3', 's0')
        im.ring(2, 's1', 's1', 's0')
        im.ring(3, 'K')
        im.ring(4, 'n1')
        dim = {'o': 'g0', 'd': 'g1', 'g': 'g1', 'h': 'g2', 'w': 'g3', 'K': 'K'}
        im.stamp4(TAB_CORNER, dim)
    return im


# ====================================================================== boutons

def button(name):
    o, sh, base, lt, hi = BTN[name]
    im = Img(16, 16, base)
    im.ring(0, o)
    # coins arrondis (pixel externe transparent)
    for x, y in ((0, 0), (15, 0), (0, 15), (15, 15)):
        im.set(x, y, None)
    im.set(1, 1, o); im.set(14, 1, o); im.set(1, 14, o); im.set(14, 14, o)
    # relief : biseau clair haut/gauche, ombre bas/droite épaisse
    for x in range(2, 14):
        im.set(x, 1, hi)
        im.set(x, 2, lt)
    for y in range(2, 13):
        im.set(1, y, lt)
    for x in range(2, 14):
        im.set(x, 14, sh)
        im.set(x, 13, sh)
    for y in range(2, 14):
        im.set(14, y, sh)
    im.set(1, 13, sh)
    im.set(14, 2, base)
    return im


# ====================================================================== case

def slot():
    im = Img(24, 24, (12, 17, 32))
    im.ring(0, 'K')
    im.ring(1, 's2', 's3', 's1')
    im.ring(2, 's1', 's2', 's0')
    im.ring(3, 'K')
    im.ring(4, (12, 17, 32), (8, 11, 22), (18, 26, 48))
    # rivets aux coins
    for x, y in ((1, 1), (22, 1), (1, 22), (22, 22)):
        im.set(x, y, 's4')
    return im


# ====================================================================== pastilles

def badge(name):
    o, sh, base, hi = BADGE[name]
    im = Img(12, 12, base)
    im.ring(0, o)
    for x, y in ((0, 0), (11, 0), (0, 11), (11, 11)):
        im.set(x, y, None)
    im.set(1, 1, o); im.set(10, 1, o); im.set(1, 10, o); im.set(10, 10, o)
    for x in range(2, 10):
        im.set(x, 1, hi)
        im.set(x, 10, sh)
    for y in range(2, 10):
        im.set(1, y, hi)
        im.set(10, y, sh)
    return im


# ====================================================================== infobulle

TIP_CORNER = [
    "KKKKK...",
    "KhhgoK..",
    "KhgoK...",
    "KgoK....",
    "KoK.....",
]


def tooltip():
    im = Img(24, 24, (10, 13, 26, 244))
    im.ring(0, 'K')
    im.ring(1, 's3', 's4', 's1')
    im.ring(2, 'K')
    im.ring(3, (14, 19, 36))
    im.stamp4(TIP_CORNER, GOLD)
    return im


# ====================================================================== build

# nom -> (fabrique, slice [h, d, b, g], repeat)
FRAMES = {
    'panel':       (panel, [16, 16, 16, 16], 'round'),
    'panel_alt':   (panel_alt, [10, 10, 10, 10], 'stretch'),
    'header':      (header, [12, 14, 12, 14], 'stretch'),
    'tab':         (lambda: tab(False), [8, 8, 8, 8], 'stretch'),
    'tab_active':  (lambda: tab(True), [8, 8, 8, 8], 'stretch'),
    'btn_gold':    (lambda: button('gold'), [5, 5, 5, 5], 'stretch'),
    'btn_blue':    (lambda: button('blue'), [5, 5, 5, 5], 'stretch'),
    'btn_purple':  (lambda: button('purple'), [5, 5, 5, 5], 'stretch'),
    'btn_gray':    (lambda: button('gray'), [5, 5, 5, 5], 'stretch'),
    'btn_red':     (lambda: button('red'), [5, 5, 5, 5], 'stretch'),
    'slot':        (slot, [6, 6, 6, 6], 'stretch'),
    'badge_green': (lambda: badge('green'), [4, 4, 4, 4], 'stretch'),
    'badge_gray':  (lambda: badge('gray'), [4, 4, 4, 4], 'stretch'),
    'badge_gold':  (lambda: badge('gold'), [4, 4, 4, 4], 'stretch'),
    'badge_red':   (lambda: badge('red'), [4, 4, 4, 4], 'stretch'),
    'tooltip':     (tooltip, [8, 8, 8, 8], 'stretch'),
}


NOTES = {
    'panel': "repeat round : rivets tous les 16 px sur les barres d'acier",
    'header': "hauteur conseillée = 25 px source (pointes centrées) ; contenu sur une ligne",
}


def build(out_dir):
    os.makedirs(out_dir, exist_ok=True)
    manifest = {}
    for name, (make, sl, rep) in FRAMES.items():
        im = make()
        im.save(os.path.join(out_dir, name + '.png'))
        manifest[name] = {'file': name + '.png', 'w': im.w, 'h': im.h,
                          'slice': sl, 'border': sl, 'repeat': rep, 'fill': True}
        if name in NOTES:
            manifest[name]['note'] = NOTES[name]
    with open(os.path.join(out_dir, 'frames.json'), 'w') as f:
        json.dump(manifest, f, indent=2)
        f.write('\n')
    return manifest


if __name__ == '__main__':
    root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(root, 'assets', 'ui', 'frames')
    m = build(out)
    print('%d cadres -> %s' % (len(m), out))
