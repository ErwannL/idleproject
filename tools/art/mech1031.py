"""v10.3.1 : une image par mécanique de boss de donjon (96 x 64), pour la feuille de donjon.

  mech_summoner  (Reine spectrale)     : la reine fait surgir des spectres devant elle
  mech_plain     (Dryade pourrissante) : pas de mécanique, un combat franc (deux épées croisées)
  mech_armored   (Colosse de magma)    : carapace qui s'use coup après coup
  mech_escalate  (Wyrm de givre)       : dégâts qui montent de palier en palier
  mech_desperate (Tyran d'obsidienne)  : enragé sous la moitié de ses PV
Style du jeu : 16 bits, contour sombre d'un pixel, lumière d'en haut à gauche, jamais lissé.

Usage : python3 tools/art/mech1031.py  ->  assets/ui/art103/mech_*.png (+ planche de contrôle tools/art/preview_mech1031.png, x4)
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image  # noqa: E402

from bastion103 import OUT, Pic, rgb, shade  # noqa: E402

W, H = 96, 64
WHITE = (255, 255, 255, 255)


def backdrop(p, top, bottom):
    """Fond dégradé par bandes de 3 px, coins arrondis d'un pixel."""
    n = (H + 2) // 3
    for i in range(n):
        t = i / max(1, n - 1)
        c = tuple(int(top[k] * (1 - t) + bottom[k] * t) for k in range(3)) + (255,)
        p.rect(0, i * 3, W - 1, min(H - 1, i * 3 + 2), c)
    for x, y in ((0, 0), (W - 1, 0), (0, H - 1), (W - 1, H - 1)):
        p.px(x, y, (0, 0, 0, 0))


def spark(p, x, y, c):
    p.px(x, y, c)
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        p.px(x + dx, y + dy, shade(c, -0.25))


def ghost(p, cx, top, w, h, body, crown=None, eye=rgb('#1a1424')):
    """Spectre : tête arrondie, bas en lambeaux, lumière à gauche."""
    p.ell(cx - w // 2, top, cx + w // 2, top + w, body)
    p.rect(cx - w // 2, top + w // 2, cx + w // 2, top + h - 3, body)
    for i, x in enumerate(range(cx - w // 2, cx + w // 2 + 1, 2)):
        p.rect(x, top + h - 3, x + 1, top + h - (1 if i % 2 else 3), body)
    p.line(cx - w // 2 + 1, top + 3, cx - w // 2 + 1, top + h - 4, shade(body, 0.3))
    p.line(cx + w // 2 - 1, top + 4, cx + w // 2 - 1, top + h - 3, shade(body, -0.22))
    ey = top + w // 2
    p.rect(cx - w // 4 - 1, ey, cx - w // 4, ey + 1, eye)
    p.rect(cx + w // 4, ey, cx + w // 4 + 1, ey + 1, eye)
    if crown:
        for k in range(-2, 3):
            p.rect(cx + k * 2, top - (3 if k % 2 == 0 else 1), cx + k * 2, top, crown)
        p.rect(cx - 4, top, cx + 4, top + 1, shade(crown, -0.2))
        p.px(cx - 4, top, shade(crown, 0.4))


def summoner():
    p = Pic(W, H)
    backdrop(p, rgb('#2a2250'), rgb('#161430'))
    for r, c in ((22, rgb('#4a7ac8')), (16, rgb('#7fd4ff'))):  # cercle magique au sol
        p.d.ellipse([52 - r, 52 - r // 3, 52 + r, 52 + r // 3 + 2], outline=c)
    ghost(p, 22, 12, 22, 40, rgb('#dff3ff'), crown=rgb('#f2c14e'))  # la Reine
    ghost(p, 58, 30, 12, 22, rgb('#9fe6ff'))  # ses deux spectres qui surgissent
    ghost(p, 78, 34, 12, 20, rgb('#8ad2f0'))
    for x in range(36, 72, 4):  # filets de magie
        p.px(x, 20 + ((x * 7) % 5), rgb('#7fd4ff'))
    for sx, sy in ((6, 10), (40, 8), (90, 22), (66, 14), (48, 38)):
        spark(p, sx, sy, rgb('#e8fbff'))
    return p.save('mech_summoner')


def swords(p, cx, cy, size, blade, grip):
    """Deux épées croisées, lumière à gauche."""
    for sgn in (1, -1):
        x0, y0 = cx - sgn * size, cy + size
        x1, y1 = cx + sgn * size, cy - size
        p.line(x0, y0, x1, y1, blade)
        p.line(x0 + 1, y0, x1 + 1, y1, shade(blade, -0.3))
        p.line(x0 - 1, y0, x1 - 1, y1, shade(blade, 0.35))
        gx, gy = cx - sgn * (size // 2 + 1), cy + size // 2 + 1
        p.line(gx - 3, gy - 3 * sgn, gx + 3, gy + 3 * sgn, rgb('#f2c14e'))
        p.line(x0, y0, x0 - sgn * 3, y0 + 3, grip)


def plain():
    p = Pic(W, H)
    backdrop(p, rgb('#2c4a2a'), rgb('#18281a'))
    for i, x in enumerate(range(4, 96, 11)):  # herbes sombres en bas
        p.poly([(x, 63), (x + 2, 52 - (i % 3) * 2), (x + 4, 63)], rgb('#2f5a2c'))
        p.line(x + 1, 62, x + 2, 54 - (i % 3) * 2, rgb('#4f8a3c'))
    swords(p, 48, 30, 17, rgb('#c8ccd8'), rgb('#62401f'))
    p.ell(44, 26, 52, 34, rgb('#f2c14e'))
    p.ell(46, 28, 50, 32, shade(rgb('#f2c14e'), 0.4))
    for sx, sy in ((12, 10), (82, 12), (20, 40), (78, 42)):
        spark(p, sx, sy, rgb('#d8f5b0'))
    return p.save('mech_plain')


def armored():
    p = Pic(W, H)
    backdrop(p, rgb('#4a2418'), rgb('#22100c'))
    for x in range(0, W, 2):  # lueur de magma en bas
        p.px(x, 61 + (x // 2) % 2, rgb('#ff8a2a'))
        p.px(x, 62, rgb('#ffd75a') if x % 6 == 0 else rgb('#e05a1a'))
    base = rgb('#8e7a70')  # grande carapace de roche, la dernière plaque est fissurée
    p.poly([(14, 8), (50, 8), (50, 52), (32, 58), (14, 52)], base)
    p.poly([(50, 8), (66, 14), (66, 48), (50, 52)], shade(base, -0.28))
    p.line(15, 9, 49, 9, shade(base, 0.35))
    p.line(15, 9, 15, 51, shade(base, 0.3))
    for y in (22, 36):
        p.line(15, y, 66, y - (3 if y == 22 else 0), shade(base, -0.4))
    for x, y in ((20, 14), (44, 14), (20, 44), (44, 46)):  # rivets
        p.ell(x, y, x + 3, y + 3, rgb('#c9b8a8'))
        p.px(x, y, WHITE)
    for pts in (((40, 24), (36, 30), (40, 34), (35, 42)), ((26, 9), (29, 15), (26, 21))):  # fissures
        for a, b in zip(pts, pts[1:]):
            p.line(a[0], a[1], b[0], b[1], rgb('#ff8a2a'))
    p.line(86, 6, 62, 30, rgb('#e8ecf6'))  # l'épée qui frappe
    p.line(87, 7, 63, 31, rgb('#8e93a4'))
    p.line(82, 6, 90, 14, rgb('#f2c14e'))
    p.line(88, 4, 92, 0, rgb('#62401f'))
    for sx, sy in ((60, 32), (56, 28), (64, 36), (58, 36)):
        spark(p, sx, sy, rgb('#ffd75a'))
    p.poly([(70, 44), (75, 46), (72, 51)], base)  # éclats qui tombent
    p.poly([(78, 38), (82, 40), (79, 44)], shade(base, -0.2))
    return p.save('mech_armored')


def flame(p, x, ybase, h, w):
    """Flamme en trois couches (rouge, orange, jaune)."""
    for k, c in enumerate((rgb('#e0301a'), rgb('#ff8a2a'), rgb('#ffd75a'))):
        ww = max(1, w - k * 2)
        hh = max(2, h - k * (h // 3))
        p.poly([(x - ww, ybase), (x, ybase - hh), (x + ww, ybase)], c)


def escalate():
    p = Pic(W, H)
    backdrop(p, rgb('#1c2c4a'), rgb('#0e1424'))
    # marches de plus en plus hautes (glace à gauche, feu à droite) : les dégâts montent de palier en palier
    cols = [rgb('#9fe6ff'), rgb('#7fc6e8'), rgb('#e8c8a0'), rgb('#ffb04a'), rgb('#ff7a3a'), rgb('#e0301a')]
    for i, c in enumerate(cols):
        x0 = 6 + i * 14
        h = 10 + i * 6
        p.block(x0, 58 - h, x0 + 11, 58, c)
        if i >= 2:
            flame(p, x0 + 6, 58 - h, 4 + i * 2, 3 + i // 2)
    ar = rgb('#f4ecd4')  # flèche montante
    p.line(10, 22, 46, 8, ar)
    p.line(46, 8, 40, 8, ar)
    p.line(46, 8, 45, 14, ar)
    for sx, sy in ((8, 8), (30, 4), (52, 20)):
        spark(p, sx, sy, rgb('#e8fbff'))
    return p.save('mech_escalate')


def desperate():
    p = Pic(W, H)
    backdrop(p, rgb('#2a1428'), rgb('#120a14'))
    obs = rgb('#4a3e5e')  # le Tyran : heaume d'obsidienne à cornes, yeux qui s'embrasent
    p.poly([(26, 8), (30, 20), (22, 22)], rgb('#6a5a82'))
    p.poly([(70, 8), (66, 20), (74, 22)], shade(obs, -0.3))
    p.block(28, 14, 68, 44, obs, light=0.3, dark=0.35)
    p.poly([(28, 44), (68, 44), (58, 52), (38, 52)], shade(obs, -0.2))
    p.rect(44, 14, 52, 40, shade(obs, -0.2))
    red = rgb('#ff3a4a')
    for x0 in (32, 56):
        p.poly([(x0, 26), (x0 + 12, 28), (x0 + 10, 32), (x0, 30)], red)
        p.px(x0 + 2, 28, rgb('#ffe9a0'))
        p.px(x0 + 3, 28, rgb('#ffe9a0'))
    for y in range(10, 50, 4):  # lueur de rage
        p.px(74 + (y % 3), y, rgb('#ff4a6a'))
        p.px(22 - (y % 3), y, rgb('#ff4a6a'))
    p.rect(8, 55, 87, 60, rgb('#1a1424'))  # barre de PV à moitié : la rage commence au repère de 50 %
    p.rect(9, 56, 47, 59, rgb('#58d66a'))
    p.rect(48, 56, 86, 59, rgb('#3a2030'))
    p.line(9, 56, 47, 56, shade(rgb('#58d66a'), 0.35))
    p.rect(47, 53, 48, 62, WHITE)
    for x in range(52, 86, 6):
        p.px(x, 57, rgb('#ff4a6a'))
    return p.save('mech_desperate')


if __name__ == '__main__':
    pics = [summoner(), plain(), armored(), escalate(), desperate()]
    sheet = Image.new('RGBA', (W * 3 * 4, H * 2 * 4), (20, 24, 40, 255))
    for i, im in enumerate(pics):
        sheet.alpha_composite(im.resize((W * 4, H * 4), Image.NEAREST), ((i % 3) * W * 4, (i // 3) * H * 4))
    sheet.save(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'preview_mech1031.png'))
    print('assets/ui/art103 :', ', '.join(sorted(f for f in os.listdir(OUT) if f.startswith('mech_'))))
