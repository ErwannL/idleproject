"""Petite bibliothèque de dessin pixel art (v5).

Tout l'art du jeu est généré par ces scripts : formes simples (ellipses, polygones, lignes),
ombrage par normale, rampes de couleurs à décalage de teinte, contour sélectif et tramage.
Sorties : grilles de caractères (src/render/art.js) ou PNG (décors).
"""
import colorsys
import math
import random

# ---------------------------------------------------------------- couleurs

def hex2rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def rgb2hex(c):
    return '#%02x%02x%02x' % tuple(max(0, min(255, int(round(v)))) for v in c[:3])


def mix(a, b, t):
    a, b = hex2rgb(a), hex2rgb(b)
    return rgb2hex(tuple(a[i] + (b[i] - a[i]) * t for i in range(3)))


def shift(color, dl=0.0, ds=0.0, dh=0.0):
    """Décale luminosité / saturation / teinte (en fractions)."""
    r, g, b = (v / 255 for v in hex2rgb(color))
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    h = (h + dh) % 1.0
    l = max(0.0, min(1.0, l + dl))
    s = max(0.0, min(1.0, s + ds))
    return rgb2hex(tuple(v * 255 for v in colorsys.hls_to_rgb(h, l, s)))


def ramp(base, n=5, spread=0.36, hue=0.04):
    """Rampe du plus sombre au plus clair, avec décalage de teinte :
    ombres vers le bleu/violet, lumières vers le jaune (style pixel art classique)."""
    r, g, b = (v / 255 for v in hex2rgb(base))
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    out = []
    for i in range(n):
        t = (i / (n - 1)) * 2 - 1  # -1 sombre .. +1 clair
        # vers 0.66 (bleu) dans l'ombre, vers 0.14 (jaune) dans la lumière
        target = 0.66 if t < 0 else 0.14
        dh = ((target - h + 0.5) % 1.0 - 0.5) * hue * abs(t) * 2.2
        nl = max(0.03, min(0.97, l + t * spread * (0.9 if t > 0 else 1.0)))
        ns = max(0.0, min(1.0, s * (1 + 0.15 * (-t if t < 0 else -0.4 * t))))
        out.append(rgb2hex(tuple(v * 255 for v in colorsys.hls_to_rgb((h + dh) % 1.0, nl, ns))))
    return out


def outline_of(color):
    """Couleur de contour sélectif : très sombre, teintée par la couleur voisine."""
    return shift(mix(color, '#120a1c', 0.72), ds=0.05)


# ---------------------------------------------------------------- canvas

class Canvas:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.px = [[None] * w for _ in range(h)]
        self.tags = {}  # couleur -> caractère réservé (calques teintables)

    # accès
    def inside(self, x, y):
        return 0 <= x < self.w and 0 <= y < self.h

    def get(self, x, y):
        return self.px[y][x] if self.inside(x, y) else None

    def set(self, x, y, c):
        x, y = int(round(x)), int(round(y))
        if self.inside(x, y):
            self.px[y][x] = c

    def setf(self, x, y, c):
        """Pose seulement si le pixel est déjà opaque (détails à l'intérieur d'une forme)."""
        x, y = int(round(x)), int(round(y))
        if self.inside(x, y) and self.px[y][x] is not None:
            self.px[y][x] = c

    def copy(self):
        c = Canvas(self.w, self.h)
        c.px = [row[:] for row in self.px]
        return c

    # formes
    def rect(self, x, y, w, h, c):
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                self.set(xx, yy, c)

    def ellipse(self, cx, cy, rx, ry, c, only_inside=False):
        for y in range(int(cy - ry - 1), int(cy + ry + 2)):
            for x in range(int(cx - rx - 1), int(cx + rx + 2)):
                if ((x + 0.5 - cx) / max(rx, 0.01)) ** 2 + ((y + 0.5 - cy) / max(ry, 0.01)) ** 2 <= 1:
                    (self.setf if only_inside else self.set)(x, y, c)

    def shaded_ellipse(self, cx, cy, rx, ry, colors, light=(-0.6, -0.8), spec=None, rim=None):
        """Ellipse ombrée par sa normale (colors : rampe sombre -> clair)."""
        lx, ly = light
        n = len(colors)
        for y in range(int(cy - ry - 1), int(cy + ry + 2)):
            for x in range(int(cx - rx - 1), int(cx + rx + 2)):
                dx = (x + 0.5 - cx) / max(rx, 0.01)
                dy = (y + 0.5 - cy) / max(ry, 0.01)
                d = dx * dx + dy * dy
                if d > 1:
                    continue
                nz = math.sqrt(max(0.0, 1 - d))
                dot = (dx * lx + dy * ly) * 0.75 + nz * 0.55  # light : direction vers la source (haut-gauche = (-0.6, -0.8))
                v = max(0.0, min(0.999, (dot + 0.35) / 1.25))
                self.set(x, y, colors[int(v * n)])
        if spec:
            self.set(cx + lx * rx * 0.5, cy + ly * ry * 0.5, spec)

    def poly(self, pts, c, only_inside=False):
        ys = [p[1] for p in pts]
        for y in range(int(min(ys)), int(max(ys)) + 1):
            yc = y + 0.5
            xs = []
            for i in range(len(pts)):
                (x0, y0), (x1, y1) = pts[i], pts[(i + 1) % len(pts)]
                if (y0 <= yc < y1) or (y1 <= yc < y0):
                    xs.append(x0 + (yc - y0) * (x1 - x0) / (y1 - y0))
            xs.sort()
            for i in range(0, len(xs) - 1, 2):
                for x in range(int(math.ceil(xs[i] - 0.5)), int(math.floor(xs[i + 1] - 0.5)) + 1):
                    (self.setf if only_inside else self.set)(x, y, c)

    def line(self, x0, y0, x1, y1, c, width=1):
        steps = int(max(abs(x1 - x0), abs(y1 - y0)) * 2) + 1
        for i in range(steps + 1):
            t = i / steps
            x = x0 + (x1 - x0) * t
            y = y0 + (y1 - y0) * t
            if width == 1:
                self.set(x, y, c)
            else:
                self.ellipse(x, y, width / 2, width / 2, c)

    def paste(self, other, ox, oy, flip=False):
        for y in range(other.h):
            for x in range(other.w):
                c = other.px[y][other.w - 1 - x if flip else x]
                if c is not None:
                    self.set(ox + x, oy + y, c)

    def flipped(self):
        c = Canvas(self.w, self.h)
        c.paste(self, 0, 0, flip=True)
        return c

    def recolor(self, mapping):
        for y in range(self.h):
            for x in range(self.w):
                c = self.px[y][x]
                if c in mapping:
                    self.px[y][x] = mapping[c]

    # finitions
    def outline(self, color=None, diagonal=False, skip=()):
        """Contour extérieur d'un pixel. Sans couleur : contour sélectif (sombre, teinté)."""
        src = self.copy()
        for y in range(self.h):
            for x in range(self.w):
                if src.px[y][x] is not None:
                    continue
                nbs = [(1, 0), (-1, 0), (0, 1), (0, -1)]
                if diagonal:
                    nbs += [(1, 1), (-1, -1), (1, -1), (-1, 1)]
                for dx, dy in nbs:
                    n = src.get(x + dx, y + dy)
                    if n is not None and n not in skip:
                        self.px[y][x] = color or outline_of(n)
                        break
        return self

    def inner_light(self, light_color=None, shadow_color=None, amount=0.25):
        """Liseré de lumière en haut-gauche et d'ombre en bas-droite à l'intérieur des formes."""
        src = self.copy()
        for y in range(self.h):
            for x in range(self.w):
                c = src.px[y][x]
                if c is None:
                    continue
                if src.get(x, y - 1) is None or src.get(x - 1, y) is None:
                    self.px[y][x] = light_color or shift(c, dl=amount * 0.5)
                elif src.get(x, y + 1) is None or src.get(x + 1, y) is None:
                    self.px[y][x] = shadow_color or shift(c, dl=-amount * 0.6)
        return self

    def bounds(self):
        xs = [x for y in range(self.h) for x in range(self.w) if self.px[y][x] is not None]
        ys = [y for y in range(self.h) for x in range(self.w) if self.px[y][x] is not None]
        return (min(xs), min(ys), max(xs), max(ys)) if xs else (0, 0, 0, 0)

    # sorties
    def to_png(self, path, scale=1, bg=None):
        from PIL import Image
        img = Image.new('RGBA', (self.w * scale, self.h * scale), (0, 0, 0, 0) if bg is None else hex2rgb(bg) + (255,))
        for y in range(self.h):
            for x in range(self.w):
                c = self.px[y][x]
                if c is None:
                    continue
                rgba = hex2rgb(c) + (255,)
                for yy in range(scale):
                    for xx in range(scale):
                        img.putpixel((x * scale + xx, y * scale + yy), rgba)
        img.save(path)


class PadCanvas(Canvas):
    """Canvas à marge invisible `pad` : on dessine en coordonnées logiques (0..w-1), même hors cadre,
    sans rien perdre ; crop_logical() / group_crop() recadrent ensuite. px, w, h, bounds() sont bruts."""

    def __init__(self, w, h, pad=16):
        super().__init__(w + 2 * pad, h + 2 * pad)
        self.lw, self.lh, self.pad = w, h, pad

    def set(self, x, y, c):
        x, y = int(round(x)) + self.pad, int(round(y)) + self.pad
        if 0 <= x < self.w and 0 <= y < self.h:
            self.px[y][x] = c

    def setf(self, x, y, c):
        x, y = int(round(x)) + self.pad, int(round(y)) + self.pad
        if 0 <= x < self.w and 0 <= y < self.h and self.px[y][x] is not None:
            self.px[y][x] = c

    def get(self, x, y):
        x, y = int(round(x)) + self.pad, int(round(y)) + self.pad
        return self.px[y][x] if 0 <= x < self.w and 0 <= y < self.h else None

    def copy(self):
        c = PadCanvas(self.lw, self.lh, self.pad)
        c.px = [row[:] for row in self.px]
        return c

    def _raw(self):
        r = Canvas(self.w, self.h)
        r.px = self.px  # même tableau : les finitions de Canvas travaillent en coordonnées brutes
        return r

    def outline(self, color=None, diagonal=False, skip=()):
        self._raw().outline(color, diagonal, skip)
        return self

    def inner_light(self, light_color=None, shadow_color=None, amount=0.25):
        self._raw().inner_light(light_color, shadow_color, amount)
        return self

    def paste(self, other, ox, oy, flip=False):
        if isinstance(other, PadCanvas) and not flip:
            d = other.pad - self.pad
            for y in range(other.h):
                for x in range(other.w):
                    c = other.px[y][x]
                    if c is not None:
                        Canvas.set(self, ox + x - d, oy + y - d, c)
            return
        super().paste(other, ox, oy, flip)

    def crop_box(self, box):
        """Recadre la zone logique box = (x0, y0, x1, y1) dans un Canvas simple."""
        x0, y0, x1, y1 = box
        out = Canvas(x1 - x0 + 1, y1 - y0 + 1)
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                out.px[y - y0][x - x0] = self.get(x, y)
        return out

    def crop_logical(self):
        return self.crop_box((0, 0, self.lw - 1, self.lh - 1))


def group_crop(frames, bottom=False):
    """Recadre des PadCanvas de même cadre logique sur une boîte commune qui ne coupe rien :
    le cadre d'origine agrandi symétriquement en largeur (ancrage bas-centre inchangé) et vers le haut
    (et vers le bas seulement si bottom, pour les volants)."""
    w, h, p = frames[0].lw, frames[0].lh, frames[0].pad
    e = t = b = 0
    for c in frames:
        x0, y0, x1, y1 = c.bounds()
        if x1 < x0:
            continue
        e = max(e, p - x0, x1 - (p + w - 1))
        t = max(t, p - y0)
        b = max(b, y1 - (p + h - 1))
    box = (-e, -t, w - 1 + e, h - 1 + (b if bottom else 0))
    return [c.crop_box(box) for c in frames]


# Caractères réservés : remplacés à l'exécution (objets équipés, couleurs du héros, acier recolorable).
TINT = {
    # objets : a principal, A ombre, 1 clair, 2 très sombre, r rareté, 3 rareté claire, 9 rareté sombre
    'item_light': '1', 'item': 'a', 'item_shade': 'A', 'item_dark': '2',
    'rarity': 'r', 'rarity_light': '3', 'rarity_dark': '9',
    # héros : 4 tabard clair, B tabard, P tabard sombre, 5 très sombre, W dorure, 6 dorure claire, 7 dorure sombre, K plumet, 8 plumet sombre
    'hero_light': '4', 'hero': 'B', 'hero_shade': 'P', 'hero_dark': '5',
    'trim': 'W', 'trim_light': '6', 'trim_dark': '7', 'plume': 'K', 'plume_dark': '8',
    # acier recolorable (chevalier déchu) : w reflet, E clair, I moyen, J sombre, X très sombre
    'steel_hi': 'w', 'steel_light': 'E', 'steel': 'I', 'steel_shade': 'J', 'steel_dark': 'X',
}
RESERVED = set(TINT.values()) | {'.'}
FREE_CHARS = [ch for ch in 'bcdefghijklmnopqstuvxyzCDFGHLMNOQRSTUVYZ0#$%&*+=?@!<>^~:;/|()[]{}-_,' if ch not in RESERVED]


def tag(name):
    """Couleur symbolique d'un caractère réservé (ex. tag('item'))."""
    return '@' + TINT[name]


def to_grid(canvas):
    """Grille + palette locale. Les couleurs '@x' deviennent le caractère réservé x."""
    pal = {}
    rows = []
    for y in range(canvas.h):
        row = []
        for x in range(canvas.w):
            c = canvas.px[y][x]
            if c is None:
                row.append('.')
            elif c.startswith('@'):
                row.append(c[1])
            else:
                if c not in pal:
                    if len(pal) >= len(FREE_CHARS):
                        # trop de couleurs : on réutilise la plus proche
                        best = min(pal, key=lambda k: sum((a - b) ** 2 for a, b in zip(hex2rgb(k), hex2rgb(c))))
                        pal[c] = pal[best]
                    else:
                        pal[c] = FREE_CHARS[len(set(pal.values()))]
                row.append(pal[c])
        rows.append(''.join(row))
    return rows, {ch: c for c, ch in pal.items()}


# Couleurs d'aperçu des caractères réservés (pour les PNG de contrôle).
PREVIEW = {
    '1': '#eef2f7', 'a': '#c9d1db', 'A': '#8a94a3', '2': '#4f5866', 'r': '#7fb8ff', '3': '#c4e0ff', '9': '#3c64b0',
    '4': '#5a8ae0', 'B': '#2f62b8', 'P': '#1d3b78', '5': '#122550', 'W': '#e8b64a', '6': '#ffe08a', '7': '#a8742a',
    'K': '#3b7de0', '8': '#22489a', 'w': '#ffffff', 'E': '#dfe6ee', 'I': '#a3b1c2', 'J': '#66748a', 'X': '#2c3444',
}


def preview_color(c):
    if c and c.startswith('@'):
        return PREVIEW.get(c[1], '#ff00ff')
    return c


def preview(canvas, path, scale=4, bg='#3a4a5e'):
    p = canvas.copy()
    for y in range(p.h):
        for x in range(p.w):
            p.px[y][x] = preview_color(p.px[y][x])
    p.to_png(path, scale, bg)


def sheet(items, path, scale=3, bg='#3a4a5e', cols=6, pad=6):
    """Planche de contrôle : [(nom, canvas)]."""
    from PIL import Image
    cw = max(c.w for _, c in items) * scale + pad * 2
    ch = max(c.h for _, c in items) * scale + pad * 2
    rows = (len(items) + cols - 1) // cols
    img = Image.new('RGBA', (cw * cols, ch * rows), hex2rgb(bg) + (255,))
    for i, (_, c) in enumerate(items):
        p = c.copy()
        for y in range(p.h):
            for x in range(p.w):
                p.px[y][x] = preview_color(p.px[y][x])
        ox, oy = (i % cols) * cw + pad, (i // cols) * ch + pad + (ch - pad * 2 - c.h * scale)
        for y in range(p.h):
            for x in range(p.w):
                if p.px[y][x] is None:
                    continue
                for yy in range(scale):
                    for xx in range(scale):
                        img.putpixel((ox + x * scale + xx, oy + y * scale + yy), hex2rgb(p.px[y][x]) + (255,))
    img.save(path)


def rng(seed):
    return random.Random(seed)
