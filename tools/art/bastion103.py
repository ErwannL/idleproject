"""v10.3 (partie 10) : illustrations du Bastion, dessinées au pixel (Pillow, sans lissage).

Une illustration par bâtiment (96 x 64, fond transparent, posée sur le décor de la carte du Bastion) :
Forge du forgeron, Bibliothèque, Mine de cristal, Camp d'entraînement, Expéditions, Comptoir ;
et l'outil de chaque métier (16 x 16) que l'ouvrier agite devant son bâtiment.
Style du jeu : 16 bits, contour sombre d'un pixel, lumière d'en haut à gauche, jamais lissé.

Usage : python3 tools/art/bastion103.py   ->  assets/ui/art103/*.png (+ planche de contrôle tools/art/preview_bastion103.png, x4)
"""
import os
import random

from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'assets', 'ui', 'art103')
W, H = 96, 64
INK = (26, 20, 32, 255)


def rgb(h):
    h = h.lstrip('#')
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 255)


def shade(c, k):
    """k > 0 : vers le clair (un peu jaune) ; k < 0 : vers le sombre (un peu bleu)."""
    r, g, b, a = c
    if k >= 0:
        return (min(255, int(r + (255 - r) * k)), min(255, int(g + (250 - g) * k)), min(255, int(b + (215 - b) * k * 0.8)), a)
    k = -k
    return (int(r * (1 - k) + 20 * k), int(g * (1 - k) + 16 * k), int(b * (1 - k) + 46 * k), a)


class Pic:
    def __init__(self, w=W, h=H):
        self.im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        self.d = ImageDraw.Draw(self.im)
        self.w, self.h = w, h

    def rect(self, x0, y0, x1, y1, c):
        self.d.rectangle([x0, y0, x1, y1], fill=c)

    def poly(self, pts, c):
        self.d.polygon(pts, fill=c)

    def ell(self, x0, y0, x1, y1, c):
        self.d.ellipse([x0, y0, x1, y1], fill=c)

    def px(self, x, y, c):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.im.putpixel((x, y), c)

    def line(self, x0, y0, x1, y1, c):
        self.d.line([x0, y0, x1, y1], fill=c, width=1)

    def block(self, x0, y0, x1, y1, c, light=0.22, dark=0.28):
        """Volume simple : face pleine, arête claire en haut et à gauche, arête sombre en bas et à droite."""
        self.rect(x0, y0, x1, y1, c)
        self.line(x0, y0, x1, y0, shade(c, light))
        self.line(x0, y0, x0, y1, shade(c, light * 0.7))
        self.line(x0, y1, x1, y1, shade(c, -dark))
        self.line(x1, y0, x1, y1, shade(c, -dark * 0.8))

    def bricks(self, x0, y0, x1, y1, c, seed=1, bw=6, bh=3):
        """Mur de pierres : joints sombres, quelques pierres plus claires (lumière d'en haut à gauche)."""
        rnd = random.Random(seed)
        self.rect(x0, y0, x1, y1, c)
        for j, y in enumerate(range(y0, y1 + 1, bh)):
            self.line(x0, y, x1, y, shade(c, -0.22))
            off = (bw // 2) if j % 2 else 0
            for x in range(x0 - off, x1 + 1, bw):
                if x0 <= x <= x1:
                    self.line(x, y, x, min(y1, y + bh - 1), shade(c, -0.22))
                if rnd.random() < 0.3:
                    for yy in range(y + 1, min(y1, y + bh - 1) + 1):
                        for xx in range(max(x0, x + 1), min(x1, x + bw - 1) + 1):
                            self.px(xx, yy, shade(c, 0.14))
        # ombre portée à droite, lumière à gauche
        for y in range(y0, y1 + 1):
            self.px(x0, y, shade(self.im.getpixel((x0, y)), 0.18))
            self.px(x1, y, shade(self.im.getpixel((x1, y)), -0.25))

    def planks(self, x0, y0, x1, y1, c, step=4, vertical=True):
        self.rect(x0, y0, x1, y1, c)
        if vertical:
            for x in range(x0, x1 + 1, step):
                self.line(x, y0, x, y1, shade(c, -0.25))
                if x + 1 <= x1:
                    self.line(x + 1, y0, x + 1, y1, shade(c, 0.12))
        else:
            for y in range(y0, y1 + 1, step):
                self.line(x0, y, x1, y, shade(c, -0.25))
                if y + 1 <= y1:
                    self.line(x0, y + 1, x1, y + 1, shade(c, 0.12))

    def roof(self, x0, x1, ytop, ybase, c, peak=None, rows=3):
        """Toit à deux pans vu de face : pan gauche éclairé, pan droit dans l'ombre, rangs de tuiles."""
        peak = (x0 + x1) // 2 if peak is None else peak
        self.poly([(x0, ybase), (peak, ytop), (x1, ybase)], c)
        self.poly([(peak, ytop), (x1, ybase), (peak, ybase)], shade(c, -0.22))
        for y in range(ytop + rows, ybase, rows):
            t = (y - ytop) / max(1, ybase - ytop)
            xa = int(peak - (peak - x0) * t)
            xb = int(peak + (x1 - peak) * t)
            self.line(xa, y, peak, y, shade(c, -0.18))
            self.line(peak, y, xb, y, shade(c, -0.38))
        self.line(x0, ybase, peak, ytop, shade(c, 0.3))
        self.line(x0, ybase, x1, ybase, shade(c, -0.45))

    def ground(self, c=rgb('#4f7a3a'), y=56, x0=6, x1=89, dirt=None):
        """Butte d'herbe sous le bâtiment, avec quelques touffes et cailloux."""
        self.ell(x0, y - 5, x1, y + 7, c)
        self.ell(x0 + 4, y - 5, x1 - 10, y + 1, shade(c, 0.14))
        self.ell(x0 + 8, y + 2, x1 - 2, y + 7, shade(c, -0.18))
        if dirt:
            self.ell(x0 + 22, y - 2, x1 - 22, y + 5, dirt)
            self.ell(x0 + 26, y - 2, x1 - 30, y + 2, shade(dirt, 0.14))
        rnd = random.Random(x0 * 7 + x1)
        for _ in range(9):
            gx = rnd.randint(x0 + 6, x1 - 6)
            gy = rnd.randint(y - 2, y + 4)
            if self.im.getpixel((gx, gy))[3]:
                self.px(gx, gy, shade(c, 0.32))
                self.px(gx, gy - 1, shade(c, 0.2))

    def outline(self, ink=INK):
        """Contour sombre d'un pixel autour de tout ce qui est dessiné (4 voisins)."""
        src = self.im.copy()
        a = src.load()
        out = self.im.load()
        for y in range(self.h):
            for x in range(self.w):
                if a[x, y][3]:
                    continue
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < self.w and 0 <= ny < self.h and a[nx, ny][3]:
                        out[x, y] = ink
                        break

    def save(self, name):
        self.outline()
        os.makedirs(OUT, exist_ok=True)
        self.im.save(os.path.join(OUT, name + '.png'))
        return self.im


STONE = rgb('#8a8794')
STONE_D = rgb('#6c6a78')
WOOD = rgb('#8a5a34')
WOOD_D = rgb('#62401f')
GOLD = rgb('#f2c14e')
FIRE = rgb('#ff8a2a')
FIRE_L = rgb('#ffd75a')
GLASS = rgb('#ffe9a0')


def smoke(p, x, y, n=3):
    for i in range(n):
        c = (206 - i * 22, 206 - i * 20, 216 - i * 14, 255)
        p.ell(x + i * 3 - 3, y - i * 6 - 4, x + i * 3 + 3 + (i % 2), y - i * 6 + 1, c)
        p.px(x + i * 3 - 2, y - i * 6 - 3, (236, 236, 242, 255))


def window(p, x, y, w=5, h=7, lit=GLASS):
    p.rect(x, y, x + w, y + h, INK)
    p.rect(x + 1, y + 1, x + w - 1, y + h - 1, lit)
    p.rect(x + 1, y + 1, x + 2, y + 2, shade(lit, 0.5))
    p.line(x + w // 2, y + 1, x + w // 2, y + h - 1, shade(lit, -0.45))
    p.line(x + 1, y + h // 2, x + w - 1, y + h // 2, shade(lit, -0.45))


def forge():
    p = Pic()
    p.ground(dirt=rgb('#7a6248'))
    # cheminée
    p.bricks(60, 8, 70, 30, STONE_D, seed=3, bw=5)
    p.block(58, 6, 72, 9, shade(STONE_D, 0.12))
    smoke(p, 64, 5)
    # corps de la forge
    p.bricks(22, 28, 74, 55, STONE, seed=7)
    # toit
    p.roof(17, 79, 12, 29, rgb('#a8483a'), peak=44)
    p.block(17, 28, 79, 30, rgb('#6e2f28'))
    # foyer en arc, braises
    p.rect(40, 37, 58, 55, INK)
    p.ell(40, 32, 58, 44, INK)
    p.rect(42, 40, 56, 55, rgb('#5a1d12'))
    p.ell(42, 35, 56, 45, rgb('#5a1d12'))
    p.ell(44, 42, 54, 55, FIRE)
    p.ell(46, 45, 52, 55, FIRE_L)
    p.px(48, 40, FIRE_L)
    p.px(51, 38, FIRE)
    p.px(45, 37, FIRE)
    p.rect(42, 54, 56, 55, rgb('#3a2a2a'))
    # fenêtre et enseigne (marteau)
    window(p, 27, 36, 6, 8, rgb('#ffb45a'))
    p.block(64, 34, 72, 42, WOOD)
    p.rect(66, 36, 70, 37, STONE)
    p.line(68, 37, 68, 40, shade(WOOD, 0.3))
    # enclume devant, sur son billot
    p.block(13, 50, 21, 57, WOOD_D)
    p.rect(9, 44, 25, 46, rgb('#555a6a'))
    p.rect(12, 46, 22, 49, rgb('#3f4352'))
    p.line(9, 44, 25, 44, rgb('#aab0c2'))
    p.px(8, 45, rgb('#555a6a'))
    p.px(26, 45, rgb('#3f4352'))
    # tonneau d'eau
    p.block(78, 46, 85, 56, WOOD)
    p.line(78, 49, 85, 49, rgb('#3f4352'))
    p.line(78, 54, 85, 54, rgb('#3f4352'))
    p.rect(79, 46, 84, 46, rgb('#5aa8ff'))
    return p.save('b_forge')


def library():
    p = Pic()
    p.ground(c=rgb('#4c7440'))
    blue = rgb('#3f5fb0')
    # tour à gauche
    p.bricks(16, 22, 32, 55, rgb('#b4a98f'), seed=5, bw=5)
    p.roof(13, 35, 4, 23, blue, peak=24)
    p.px(24, 2, GOLD)
    p.px(24, 3, GOLD)
    window(p, 21, 28, 5, 8)
    window(p, 21, 42, 5, 8)
    # corps
    p.bricks(32, 30, 80, 55, rgb('#c2b79c'), seed=9)
    p.roof(29, 83, 14, 31, blue, peak=56)
    p.block(29, 30, 83, 32, shade(blue, -0.3))
    # fronton : livre ouvert
    p.rect(51, 21, 61, 27, INK)
    p.rect(52, 22, 55, 26, rgb('#f4ecd4'))
    p.rect(57, 22, 60, 26, rgb('#e2d6b4'))
    p.line(53, 23, 54, 23, rgb('#8a7a5a'))
    p.line(58, 24, 59, 24, rgb('#8a7a5a'))
    # colonnes et porte
    for x in (36, 46, 64, 74):
        p.block(x, 34, x + 3, 55, rgb('#e6dfcc'), 0.3, 0.3)
        p.rect(x - 1, 33, x + 4, 34, rgb('#f4eedd'))
        p.rect(x - 1, 54, x + 4, 55, rgb('#a89c80'))
    p.rect(52, 40, 60, 55, INK)
    p.ell(52, 36, 60, 44, INK)
    p.planks(53, 42, 59, 55, WOOD, step=3)
    p.ell(53, 37, 59, 44, WOOD)
    p.px(58, 49, GOLD)
    window(p, 40, 38, 4, 8)
    window(p, 68, 38, 4, 8)
    # marches
    p.block(48, 55, 64, 57, rgb('#d4cbb4'))
    p.block(46, 57, 66, 59, rgb('#bdb39a'))
    # pile de livres
    p.block(83, 52, 89, 54, rgb('#a8483a'))
    p.block(84, 49, 90, 51, rgb('#3f8a5a'))
    p.block(83, 46, 88, 48, blue)
    return p.save('b_library')


def mine():
    p = Pic()
    p.ground(c=rgb('#5a6e48'), dirt=rgb('#6a5a4a'))
    rock = rgb('#7a7486')
    # massif rocheux
    p.poly([(10, 56), (16, 30), (30, 14), (46, 8), (62, 12), (76, 26), (86, 56)], rock)
    p.poly([(16, 30), (30, 14), (46, 8), (40, 22), (26, 34)], shade(rock, 0.22))
    p.poly([(62, 12), (76, 26), (86, 56), (70, 56), (66, 30)], shade(rock, -0.24))
    p.poly([(30, 30), (40, 22), (48, 30), (40, 38)], shade(rock, 0.1))
    for (x, y) in ((22, 44), (70, 40), (58, 20), (34, 20), (76, 50), (18, 52)):
        p.line(x, y, x + 4, y + 1, shade(rock, -0.3))
        p.px(x + 1, y - 1, shade(rock, 0.25))
    # entrée étayée
    p.rect(34, 34, 60, 56, INK)
    p.rect(37, 38, 57, 56, rgb('#1c1626'))
    p.rect(40, 44, 54, 56, rgb('#120e1a'))
    p.block(34, 34, 37, 56, WOOD)
    p.block(57, 34, 60, 56, WOOD_D)
    p.block(32, 31, 62, 35, WOOD)
    p.px(35, 33, shade(WOOD, 0.4))
    p.px(59, 33, shade(WOOD, 0.4))
    # lanterne
    p.rect(46, 36, 48, 39, GOLD)
    p.px(47, 37, rgb('#fff6c0'))
    p.px(47, 35, INK)

    def crystal(x, y, h, c):
        p.poly([(x, y), (x + 2, y - h), (x + 5, y - h + 2), (x + 6, y)], c)
        p.poly([(x + 2, y - h), (x + 3, y), (x, y)], shade(c, 0.45))
        p.poly([(x + 5, y - h + 2), (x + 6, y), (x + 4, y)], shade(c, -0.3))
        p.px(x + 2, y - h + 1, (255, 255, 255, 255))

    cyan = rgb('#58d6e8')
    crystal(18, 30, 10, cyan)
    crystal(23, 32, 7, rgb('#7ae8f0'))
    crystal(66, 24, 9, rgb('#a58cf2'))
    crystal(71, 28, 6, cyan)
    crystal(48, 12, 6, rgb('#7ae8f0'))
    # rails et wagonnet chargé de cristaux
    p.line(44, 58, 90, 60, rgb('#4a4654'))
    p.line(44, 60, 90, 62, rgb('#4a4654'))
    for x in range(48, 90, 6):
        p.line(x, 58, x + 1, 62, WOOD_D)
    p.block(68, 48, 82, 56, rgb('#6a5244'))
    p.line(68, 48, 82, 48, rgb('#9a8270'))
    p.rect(70, 57, 72, 59, INK)
    p.rect(78, 57, 80, 59, INK)
    crystal(69, 48, 6, cyan)
    crystal(74, 48, 8, rgb('#7ae8f0'))
    crystal(78, 48, 5, rgb('#a58cf2'))
    return p.save('b_mine')


def training():
    p = Pic()
    p.ground(c=rgb('#5c7a3c'), dirt=rgb('#b09a6a'))
    red = rgb('#c2483c')
    cream = rgb('#efe6cc')
    # tente rayée
    p.poly([(30, 54), (50, 16), (72, 54)], cream)
    for i, x in enumerate(range(30, 72, 6)):
        if i % 2 == 0:
            p.poly([(x, 54), (50, 16), (x + 6, 54)], red)
    p.poly([(50, 16), (72, 54), (62, 54)], shade(red, -0.3))
    p.poly([(44, 54), (50, 30), (56, 54)], rgb('#2a1e2a'))
    p.poly([(44, 54), (50, 30), (47, 54)], shade(cream, -0.25))
    p.line(30, 54, 50, 16, shade(cream, 0.4))
    # mât et fanion
    p.line(50, 6, 50, 16, WOOD_D)
    p.poly([(51, 6), (60, 9), (51, 12)], GOLD)
    p.px(52, 8, shade(GOLD, 0.5))
    # mannequin d'entraînement
    p.block(16, 30, 18, 56, WOOD)
    p.block(10, 34, 24, 36, WOOD)
    p.ell(12, 22, 22, 32, rgb('#d8c088'))
    p.ell(13, 23, 18, 28, shade(rgb('#d8c088'), 0.3))
    p.rect(12, 36, 22, 46, rgb('#c9a868'))
    p.line(12, 39, 22, 39, WOOD_D)
    p.line(12, 43, 22, 43, WOOD_D)
    p.ell(15, 38, 19, 42, red)
    p.px(17, 40, cream)
    # râtelier d'armes
    p.block(76, 36, 78, 56, WOOD_D)
    p.block(88, 36, 90, 56, WOOD_D)
    p.block(75, 40, 91, 42, WOOD)
    p.line(80, 28, 80, 54, rgb('#c8ccd8'))
    p.line(81, 28, 81, 40, rgb('#8e93a4'))
    p.rect(79, 42, 82, 43, GOLD)
    p.line(85, 26, 85, 54, WOOD)
    p.poly([(83, 30), (85, 22), (87, 30)], rgb('#c8ccd8'))
    # bouclier posé
    p.ell(64, 44, 76, 57, rgb('#3f5fb0'))
    p.ell(66, 46, 72, 52, rgb('#5a7fd0'))
    p.rect(69, 45, 70, 56, GOLD)
    p.rect(65, 50, 75, 51, GOLD)
    return p.save('b_training')


def expeditions():
    p = Pic()
    p.ground(c=rgb('#587a40'), dirt=rgb('#a08a5c'))
    canvas = rgb('#d9c79a')
    # chariot bâché
    p.ell(26, 20, 70, 52, canvas)
    p.rect(26, 36, 70, 46, canvas)
    p.ell(30, 22, 52, 40, shade(canvas, 0.25))
    for x in (36, 48, 60):
        p.line(x, 22, x, 46, shade(canvas, -0.25))
    p.poly([(60, 24), (70, 34), (70, 46), (60, 46)], shade(canvas, -0.22))
    p.ell(27, 26, 37, 46, rgb('#2a1e2a'))
    p.ell(29, 28, 36, 44, rgb('#4a3a34'))
    p.planks(24, 44, 72, 51, WOOD, step=5, vertical=False)
    p.line(24, 44, 72, 44, shade(WOOD, 0.35))
    for cx in (34, 62):
        p.ell(cx - 7, 46, cx + 7, 60, INK)
        p.ell(cx - 6, 47, cx + 6, 59, WOOD_D)
        p.ell(cx - 4, 49, cx + 4, 57, rgb('#3a2a22'))
        p.line(cx - 5, 53, cx + 5, 53, WOOD)
        p.line(cx, 48, cx, 58, WOOD)
        p.px(cx, 53, GOLD)
    p.line(72, 48, 84, 52, WOOD_D)
    # poteau indicateur
    p.block(84, 26, 86, 57, WOOD_D)
    p.poly([(78, 28), (90, 28), (93, 31), (90, 34), (78, 34)], WOOD)
    p.line(79, 29, 89, 29, shade(WOOD, 0.35))
    p.poly([(92, 38), (80, 38), (77, 41), (80, 44), (92, 44)], shade(WOOD, -0.12))
    p.line(81, 31, 87, 31, rgb('#f4ecd4'))
    p.line(82, 41, 88, 41, rgb('#f4ecd4'))
    # fanion du chariot
    p.line(48, 10, 48, 21, WOOD_D)
    p.poly([(49, 10), (58, 13), (49, 16)], rgb('#3f8a5a'))
    # sac à dos, carte roulée, feu de bivouac
    p.block(10, 44, 18, 56, rgb('#7a5a3a'))
    p.block(11, 41, 17, 44, rgb('#9a7448'))
    p.rect(12, 48, 16, 51, rgb('#5a4028'))
    p.px(14, 49, GOLD)
    p.rect(19, 52, 24, 54, rgb('#f4ecd4'))
    p.px(19, 53, rgb('#c2483c'))
    return p.save('b_expeditions')


def trade():
    p = Pic()
    p.ground(c=rgb('#57783e'), dirt=rgb('#9a8660'))
    purple = rgb('#7a4fb0')
    # arrière-boutique
    p.planks(22, 26, 74, 54, rgb('#9a6a3e'), step=5)
    p.block(22, 24, 74, 27, WOOD_D)
    # étagères et marchandises
    p.rect(26, 30, 70, 31, WOOD_D)
    for i, c in enumerate((rgb('#58d6e8'), rgb('#c2483c'), GOLD, rgb('#3f8a5a'), rgb('#a58cf2'), rgb('#f4ecd4'))):
        x = 28 + i * 7
        p.rect(x, 32, x + 3, 36, c)
        p.px(x, 32, shade(c, 0.5))
        p.rect(x + 1, 31, x + 2, 31, INK)
    # auvent rayé
    p.poly([(16, 26), (22, 14), (74, 14), (80, 26)], GOLD)
    for i, x in enumerate(range(22, 74, 8)):
        if i % 2 == 0:
            xa = 16 + (x - 22) * 64 // 52
            p.poly([(x, 14), (x + 8, 14), (xa + 10, 26), (xa, 26)], purple)
    p.line(22, 14, 74, 14, shade(GOLD, 0.5))
    for x in range(16, 80, 8):
        p.poly([(x, 26), (x + 8, 26), (x + 4, 30)], GOLD if (x // 8) % 2 else purple)
    p.block(18, 26, 20, 56, WOOD_D)
    p.block(76, 26, 78, 56, WOOD_D)
    # comptoir
    p.planks(20, 44, 76, 56, WOOD, step=6)
    p.block(18, 41, 78, 44, shade(WOOD, 0.2))
    # balance
    p.line(48, 30, 48, 40, rgb('#c8ccd8'))
    p.line(41, 33, 55, 33, GOLD)
    p.line(41, 33, 41, 37, rgb('#c8ccd8'))
    p.line(55, 33, 55, 37, rgb('#c8ccd8'))
    p.rect(38, 37, 44, 38, GOLD)
    p.rect(52, 37, 58, 38, GOLD)
    p.rect(46, 40, 50, 41, GOLD)
    p.px(40, 36, rgb('#58d6e8'))
    p.px(54, 36, rgb('#f4ecd4'))
    # pièces et cristal sur le comptoir
    p.ell(26, 38, 31, 41, GOLD)
    p.ell(28, 36, 33, 39, shade(GOLD, 0.25))
    p.poly([(66, 41), (68, 35), (71, 37), (72, 41)], rgb('#58d6e8'))
    p.px(68, 37, (255, 255, 255, 255))
    # caisses et tonneau
    p.block(80, 46, 90, 56, rgb('#8a6a40'))
    p.line(80, 46, 90, 56, WOOD_D)
    p.line(90, 46, 80, 56, WOOD_D)
    p.block(6, 44, 14, 56, WOOD)
    p.line(6, 47, 14, 47, rgb('#3f4352'))
    p.line(6, 53, 14, 53, rgb('#3f4352'))
    return p.save('b_trade')


def tools():
    """Outil de chaque métier, 16 x 16 (agité devant le bâtiment par l'ouvrier)."""
    out = {}
    steel = rgb('#c8ccd8')

    t = Pic(16, 16)  # marteau
    t.line(4, 12, 10, 6, WOOD)
    t.line(5, 12, 11, 6, WOOD_D)
    t.poly([(7, 3), (12, 2), (14, 6), (10, 8)], steel)
    t.poly([(12, 2), (14, 6), (12, 7)], rgb('#8e93a4'))
    t.px(8, 4, (255, 255, 255, 255))
    out['tool_hammer'] = t.save('tool_hammer')

    t = Pic(16, 16)  # livre
    t.rect(2, 4, 13, 12, rgb('#3f5fb0'))
    t.rect(3, 5, 7, 11, rgb('#f4ecd4'))
    t.rect(8, 5, 12, 11, rgb('#e2d6b4'))
    t.line(4, 7, 6, 7, rgb('#8a7a5a'))
    t.line(4, 9, 6, 9, rgb('#8a7a5a'))
    t.line(9, 7, 11, 7, rgb('#8a7a5a'))
    t.line(9, 9, 11, 9, rgb('#8a7a5a'))
    out['tool_book'] = t.save('tool_book')

    t = Pic(16, 16)  # pioche
    t.line(4, 13, 10, 5, WOOD)
    t.line(5, 13, 11, 5, WOOD_D)
    t.poly([(4, 4), (9, 2), (14, 5), (13, 6), (9, 4), (5, 6)], steel)
    t.px(8, 3, (255, 255, 255, 255))
    t.px(13, 6, rgb('#8e93a4'))
    out['tool_pick'] = t.save('tool_pick')

    t = Pic(16, 16)  # épée d'entraînement
    t.line(4, 12, 11, 3, steel)
    t.line(5, 12, 12, 3, rgb('#8e93a4'))
    t.px(12, 2, steel)
    t.line(3, 9, 7, 13, GOLD)
    t.line(2, 13, 3, 14, WOOD_D)
    out['tool_sword'] = t.save('tool_sword')

    t = Pic(16, 16)  # pièce
    t.ell(3, 3, 12, 12, GOLD)
    t.ell(5, 5, 10, 10, shade(GOLD, -0.2))
    t.ell(4, 4, 8, 8, shade(GOLD, 0.45))
    t.rect(7, 6, 8, 9, shade(GOLD, 0.6))
    out['tool_coin'] = t.save('tool_coin')
    return out


if __name__ == '__main__':
    pics = [forge(), library(), mine(), training(), expeditions(), trade()]
    extra = tools()
    # Planche de contrôle (x4, fond du décor) : pour vérifier le dessin d'un coup d'œil.
    sheet = Image.new('RGBA', (W * 3 * 4, (H * 2 + 20) * 4), (58, 84, 64, 255))
    for i, im in enumerate(pics):
        big = im.resize((W * 4, H * 4), Image.NEAREST)
        sheet.alpha_composite(big, ((i % 3) * W * 4, (i // 3) * H * 4))
    for i, im in enumerate(extra.values()):
        sheet.alpha_composite(im.resize((64, 64), Image.NEAREST), (16 + i * 80, H * 2 * 4 + 8))
    sheet.save(os.path.join(os.path.dirname(__file__), 'preview_bastion103.png'))
    print('assets/ui/art103 :', ', '.join(sorted(f for f in os.listdir(OUT) if f.endswith('.png'))))
