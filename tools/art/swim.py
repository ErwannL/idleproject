"""v9.2.0 (nage) : sprites de nage dessinés (Royaume englouti) — corps couché, tête à droite, de profil.

  hero_swim1..6     : chevalier en crawl (6 images) : bras avant qui s'étend puis tire sous le corps, bras arrière en
                      opposition, jambes qui battent en ciseaux, cape et plumet qui traînent derrière. Couleurs
                      réservées (tabard, dorures, plumet, acier) : recolorables comme le chevalier debout.
  skin_<id>_swim1..6 : même silhouette pour les 8 skins (leurs couleurs et leur élément clé : cheveux, capuche,
                      casque ailé…).
L'arme n'est pas dessinée : le jeu la pose le long du dos (tournée d'un quart de tour, au pixel entier).
v9.2.1 : dessin agrandi (×1,3, retracé à la nouvelle taille — formes recalculées, pas d'image agrandie) pour que le
nageur ait la carrure des compagnons ; le jeu le pose à l'échelle 1. Cadre 73×37, axe du corps sur y≈18.
"""
import math

from lib import Canvas, tag, ramp

S = 1.3  # v9.2.1 : facteur de tracé (les coordonnées ci-dessous restent celles du cadre 56×28 d'origine)
W, H = math.ceil(56 * S), math.ceil(28 * S)
OUT = '#1a1226'
SKIN = ['#a8604e', '#e39a78', '#ffcfa6']
EYE = '#1a1226'

KNIGHT = {
    'armor': [tag('steel_dark'), tag('steel_shade'), tag('steel'), tag('steel_light'), tag('steel_hi')],
    'cloth': [tag('hero_dark'), tag('hero_shade'), tag('hero'), tag('hero_light')],
    'trim': [tag('trim_dark'), tag('trim'), tag('trim_light')],
    'tail': [tag('plume_dark'), tag('plume'), tag('hero_light')],  # plumet
    'boots': ['#4a2a1a', '#7a4a2a', '#9a6a40'],
    'helm': True,
    'skin': SKIN,
}

# Main avant au fil du crawl (repère du cadre) : s'étend devant la tête, attrape, tire sous le corps, pousse vers
# l'arrière, sort de l'eau au-dessus du dos, revient vers l'avant.
HANDS = [(52, 10), (49, 17), (41, 21), (29, 19), (31, 5), (44, 4)]


def thick(c, pts, w, ramp3):
    lo, mid, hi = ramp3
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        c.line(x0, y0, x1, y1, mid, width=w)
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        c.line(x0, y0 - (w / 2 - 0.8), x1, y1 - (w / 2 - 0.8), hi)
        c.line(x0, y0 + (w / 2 - 0.8), x1, y1 + (w / 2 - 0.8), lo)


def arm(c, shoulder, hand, far, P):
    a = P['armor']
    r3 = [a[0], a[1], a[2]] if far else [a[1], a[2], a[3]]
    sx, sy = shoulder
    hx, hy = hand
    # coude : un peu en dehors de la ligne épaule-main (vers le haut quand le bras sort de l'eau)
    mx, my = (sx + hx) / 2, (sy + hy) / 2
    dx, dy = hx - sx, hy - sy
    n = math.hypot(dx, dy) or 1
    bend = 2.0 if hy < sy else -1.2
    ex, ey = mx - dy / n * bend, my + dx / n * bend
    thick(c, [(sx, sy), (ex, ey), (hx, hy)], 3.2, r3)
    g = P['trim'] if P['helm'] else P['skin']
    c.ellipse(hx, hy, 1.9, 1.7, g[0] if far else g[1])
    c.set(hx, hy - 1, g[2 if not far else 1])


def leg(c, hip, kick, far, P):
    a = P['armor']
    r3 = [a[0], a[1], a[2]] if far else [a[1], a[2], a[3]]
    hx, hy = hip
    knee = (hx - 8, hy + kick * 0.5)
    foot = (hx - 15, hy + kick)
    thick(c, [(hx, hy), knee, foot], 3.6, r3)
    b = P['boots']
    c.ellipse(foot[0] - 1.5, foot[1], 2.6, 1.8, b[0] if far else b[1])
    c.set(foot[0] - 2, foot[1] - 1, b[2])


def cape(c, f, P):
    cl = P['cloth']
    wave = [math.sin(f / 6 * 2 * math.pi + k * 0.7) for k in range(5)]
    top = [(36, 8), (28, 6.5 + wave[0]), (20, 7 + wave[1] * 1.2), (14, 8 + wave[2] * 1.5), (9, 9 + wave[3] * 2)]
    bot = [(9, 11 + wave[3] * 2), (14, 12 + wave[2] * 1.5), (20, 12 + wave[1]), (34, 12)]
    c.poly(top + bot, cl[1])
    for (x, y) in top[1:]:
        c.line(x, y, x + 6, y - 0.3, cl[2])
    c.line(top[-1][0], top[-1][1] + 1, top[-2][0], top[-2][1] + 1, cl[3])
    # plis
    for x in (16, 24):
        c.line(x, 9, x - 3, 11, cl[0])


def torso(c, P):
    a, t = P['armor'], P['trim']
    c.ellipse(28, 13.5, 9.5, 5.2, a[2])
    c.ellipse(28, 12, 8, 3, a[3], only_inside=True)
    c.ellipse(29, 11, 5, 1.4, a[4], only_inside=True)
    c.rect(19, 16, 18, 3, a[1]) if False else None
    for x in range(19, 38):
        c.setf(x, 17, a[1]); c.setf(x, 18, a[0])
    # tabard (côté ventre) et ceinture dorée
    cl = P['cloth']
    for x in range(22, 35):
        c.setf(x, 15, cl[2]); c.setf(x, 16, cl[1])
    for y in range(9, 19):
        c.setf(22, y, t[1]); c.setf(21, y, t[0])
    c.setf(30, 15, t[2]); c.setf(31, 15, t[1])


def head(c, f, P):
    a, t, s = P['armor'], P['trim'], P['skin']
    cx, cy = 42, 12
    if P['helm']:
        c.ellipse(cx, cy, 6.2, 5.6, a[2])
        c.ellipse(cx - 1, cy - 1.5, 4.6, 3.2, a[3], only_inside=True)
        c.ellipse(cx - 1.5, cy - 3, 2.2, 1.1, a[4], only_inside=True)
        # ouverture du visage, de profil (regarde vers l'avant)
        for y in range(cy - 1, cy + 4):
            for x in range(cx + 2, cx + 6):
                c.setf(x, y, s[1])
        c.setf(cx + 5, cy + 3, s[0]); c.setf(cx + 2, cy + 3, s[0])
        c.setf(cx + 4, cy, EYE)
        c.setf(cx + 3, cy - 1, s[2])
        c.setf(cx + 5, cy + 1, s[2])
        for y in range(cy - 2, cy + 5):
            c.setf(cx + 1, y, t[1])  # bord doré du heaume
        for x in range(cx + 1, cx + 6):
            c.setf(x, cy - 2, t[1])
    else:
        c.ellipse(cx, cy, 5.6, 5.2, s[1])
        c.ellipse(cx + 1, cy - 1, 3.4, 2.6, s[2], only_inside=True)
        c.setf(cx + 3, cy, EYE)
        c.setf(cx + 3, cy - 1, EYE)
        c.setf(cx + 4, cy + 3, s[0])
        h = P['tail']
        # cheveux : calotte sur l'arrière du crâne
        for y in range(cy - 6, cy + 4):
            for x in range(cx - 6, cx + 3):
                if ((x + 0.5 - cx) / 5.8) ** 2 + ((y + 0.5 - cy) / 5.4) ** 2 <= 1 and (x < cx - 1 or y < cy - 2):
                    c.set(x, y, h[1] if y > cy - 3 else h[2])
        if P.get('hood'):
            for x in range(cx - 6, cx + 5):
                c.setf(x, cy - 4, h[0])


def tail(c, f, P):
    """Plumet couché vers l'arrière (chevalier) ou chevelure qui traîne (skins), ondulant."""
    h = P['tail']
    ph = f / 6 * 2 * math.pi
    pts = []
    for k in range(12):
        x = 40 - k * 1.6
        y = 6 - (2.2 if P['helm'] else 0) * math.sin(min(1, k / 3) * math.pi / 2) + math.sin(ph + k * 0.6) * k * 0.12
        w = (3.2 - k * 0.22) if P['helm'] else (3.6 - k * 0.2)
        pts.append((x, y + (0 if P['helm'] else 3), max(0.7, w)))
    for x, y, w in pts:
        c.ellipse(x, y, 1.3, w / 2 + 0.3, h[1])
    for x, y, w in pts[1:-2]:
        c.set(x, y - w / 2 + 0.6, h[2])
        c.set(x + 0.5, y + w / 2 - 0.4, h[0])


class Scaled:
    """v9.2.1 : trace les formes du dessin d'origine à l'échelle S (ellipses, lignes, polygones recalculés au pixel
    près) ; les pixels de détail (set/setf) deviennent des blocs de 1 à 2 px sans trou."""

    def __init__(self, c):
        self.c = c

    def _block(self, x, y):
        x, y = int(round(x)), int(round(y))
        return range(math.floor(x * S), max(math.floor(x * S) + 1, math.floor((x + 1) * S))), \
            range(math.floor(y * S), max(math.floor(y * S) + 1, math.floor((y + 1) * S)))

    def set(self, x, y, col):
        xs, ys = self._block(x, y)
        for yy in ys:
            for xx in xs:
                self.c.set(xx, yy, col)

    def setf(self, x, y, col):
        xs, ys = self._block(x, y)
        for yy in ys:
            for xx in xs:
                self.c.setf(xx, yy, col)

    def ellipse(self, cx, cy, rx, ry, col, only_inside=False):
        self.c.ellipse(cx * S, cy * S, rx * S, ry * S, col, only_inside)

    def line(self, x0, y0, x1, y1, col, width=1):
        self.c.line(x0 * S, y0 * S, x1 * S, y1 * S, col, width=width * S if width > 1 else 1)

    def poly(self, pts, col, only_inside=False):
        self.c.poly([(x * S, y * S) for x, y in pts], col, only_inside)

    def rect(self, x, y, w, h, col):
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                self.set(xx, yy, col)


def swimmer(f, P):
    base = Canvas(W, H)
    c = Scaled(base)
    hand = HANDS[f % 6]
    far_hand = HANDS[(f + 3) % 6]
    kick = math.sin(f / 6 * 2 * math.pi * 2) * 3.5  # deux battements par brasse
    arm(c, (35, 11), (far_hand[0] - 2, far_hand[1] - 1), True, P)
    leg(c, (20, 12), -kick, True, P)
    leg(c, (20, 15), kick, False, P)
    if P.get('cape', True):
        cape(c, f, P)
    torso(c, P)
    tail(c, f, P)
    head(c, f, P)
    if P.get('wings'):
        w = P['wings']
        for k in range(3):
            c.line(38 - k, 7, 33 - k * 3, 2 + k, w)
    arm(c, (36, 13), hand, False, P)
    base.outline(OUT)
    return base


def skin_palette(outfit, accent, hair, skin=None, helm=False, **kw):
    o = ramp(outfit, 5, 0.3)
    p = {
        'armor': o, 'cloth': ramp(accent, 4, 0.3), 'trim': ramp(accent, 3, 0.3), 'tail': ramp(hair, 3, 0.3),
        'boots': ramp(outfit, 3, 0.5), 'helm': helm, 'skin': skin or SKIN,
    }
    p.update(kw)
    return p


SKINS = {
    'demoness': skin_palette('#4a2a62', '#a8323a', '#2c2238', skin=['#a86a7a', '#e8b0b8', '#ffd8dc']),
    'fairy': skin_palette('#c85a96', '#7a1a4e', '#4a3c96', wings='#e8f6ff'),
    'grombar': skin_palette('#e0501e', '#e8a830', '#ffd860', skin=['#7a8a3a', '#a8c060', '#d0e890']),
    'ninja': skin_palette('#232b58', '#c01e2c', '#151a3a', hood=True),
    'seraph': skin_palette('#dfe4f8', '#eab53a', '#ffe27a', wings='#ffffff'),
    'valkyrie': skin_palette('#a0b0d4', '#1a3080', '#f4f8ff', helm=True),
    'vampire': skin_palette('#3a3060', '#d82e3e', '#e6e0f0', skin=['#9a8aa8', '#e6e0f0', '#ffffff']),
    'witch': skin_palette('#7a3ac4', '#21a096', '#30105e'),
}


def build():
    out = {}
    for f in range(6):
        out[f'hero_swim{f + 1}'] = (swimmer(f, KNIGHT), {})
        for k, P in SKINS.items():
            out[f'skin_{k}_swim{f + 1}'] = (swimmer(f, P), {})
    return out


if __name__ == '__main__':
    import os
    from lib import sheet
    b = build()
    sheet([(k, v[0]) for k, v in b.items() if k.startswith('hero_') or k.endswith('swim1') or k.endswith('swim4')], os.environ.get('SWIM_SHEET', '/tmp/swim_sheet.png'), scale=5, cols=6)
