"""Carte du monde peinte (assets/ui/worldmap.png), 240×130.
Les positions des zones correspondent à MAP_NODES (src/ui/panels/campaign.js)."""
import math
from lib import Canvas, ramp, shift, mix, rng
import scenery as sc

W, H = 240, 130
NODES = [(0.13, 0.72), (0.3, 0.38), (0.47, 0.74), (0.62, 0.38), (0.78, 0.7), (0.9, 0.32)]
REGION = [
    ramp('#5aae4a', 4, 0.18),  # plaines
    ramp('#2f7a44', 4, 0.18),  # forêt
    ramp('#7a7090', 4, 0.18),  # grottes
    ramp('#e0b46a', 4, 0.16),  # désert
    ramp('#c8d8ee', 4, 0.14),  # montagnes
    ramp('#5a3a6a', 4, 0.16),  # terres maudites
]


def pyramid(c, x, base, h, colors):
    for i in range(h):
        y = base - h + i
        for xx in range(x - i, x + i + 1):
            c.set(xx, y, (colors[3] if xx < x else colors[1]) if i % 4 != 3 else (colors[2] if xx < x else colors[0]))


def build(path):
    c = Canvas(W, H)
    r = rng(77)
    pts = [(x * W, y * H) for x, y in NODES]
    sea = ramp('#2f6aa8', 4, 0.16)
    for y in range(H):
        for x in range(W):
            # terre : distance au chemin des zones + bruit
            d = min(math.hypot(x - px, (y - py) * 1.25) for px, py in pts)
            n = sc.noise1(x + y * 0.7, 120, 5, 3) * 7 + sc.noise1(y - x * 0.3, 90, 9, 2) * 5
            land = d < 46 + n and 6 < x < W - 6 and 5 < y < H - 5
            if not land:
                wave = (x + int(sc.noise1(y, 40, 3, 2) * 4)) % 11 == 0 and y % 5 == 0
                c.set(x, y, sea[3] if wave else sea[2] if (x * 7 + y * 3) % 23 else sea[1])
                continue
            # région de la zone la plus proche (frontière bruitée)
            k = min(range(6), key=lambda i: math.hypot(x - pts[i][0] + n * 0.8, y - pts[i][1] - n * 0.5))
            col = REGION[k]
            shade_ = 1 if r.random() < 0.12 else 2
            if d > 40 + n:
                col_ = '#e8d49a'  # plage
                c.set(x, y, col_)
            else:
                c.set(x, y, col[shade_] if r.random() > 0.08 else col[3])
    # frontières des régions, légèrement plus sombres
    src = c.copy()
    for y in range(H):
        for x in range(W):
            v = src.px[y][x]
            for reg in REGION:
                if v in reg[1:]:
                    n = src.get(x + 1, y)
                    m = src.get(x, y + 1)
                    if (n is not None and n not in reg and n not in sea and n != '#e8d49a') or (m is not None and m not in reg and m not in sea and m != '#e8d49a'):
                        c.set(x, y, reg[0])
                    break
    # écume le long des côtes
    src = c.copy()
    for y in range(H):
        for x in range(W):
            if src.px[y][x] in sea and any(src.get(x + dx, y + dy) == '#e8d49a' for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                c.set(x, y, '#d8f0ff')
    # chemin pointillé entre les zones
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        steps = int(math.hypot(x1 - x0, y1 - y0))
        for s in range(0, steps, 3):
            t = s / steps
            bend = math.sin(t * math.pi) * 6
            x = x0 + (x1 - x0) * t
            y = y0 + (y1 - y0) * t + bend
            c.rect(int(x), int(y), 2, 2, '#7a4a22')
            c.set(int(x), int(y), '#c8945a')
    # décor par région (au-dessus du point de la zone)
    px = [(int(x), int(y) - 8) for x, y in pts]
    leaf = ramp('#3f9a3a', 5, 0.28, 0.06); trunk = ramp('#6b4428', 4, 0.2)
    sc.castle(c, px[0][0] - 6, px[0][1] + 2, 0.45, ramp('#c8d0e0', 4, 0.2), ramp('#3a62c8', 4, 0.24), '#ffe9a0', '#d84a4a')
    sc.round_tree(c, px[0][0] + 14, px[0][1] + 4, 10, leaf, trunk, 1, roots=False)
    sc.round_tree(c, px[0][0] - 20, px[0][1] + 6, 9, leaf, trunk, 2, roots=False)
    for i, dx in enumerate((-12, -4, 4, 12, 0)):
        sc.pine(c, px[1][0] + dx, px[1][1] + 4 + (i % 2) * 3, 12 + (i % 3) * 2, ramp('#1f5a34', 4, 0.2), trunk)
    mx, my = px[2]
    c.poly([(mx - 16, my + 6), (mx - 4, my - 12), (mx + 4, my - 6), (mx + 10, my - 14), (mx + 20, my + 6)], '#6a6080')
    c.poly([(mx - 16, my + 6), (mx - 4, my - 12), (mx - 2, my + 6)], '#8a80a0')
    c.ellipse(mx + 2, my + 3, 4, 4, '#1a1226')
    sc.crystal(c, mx - 10, my + 7, 7, 2, 0, ramp('#c86ae8', 5, 0.28))
    sc.crystal(c, mx + 13, my + 7, 6, 2, 0, ramp('#4fc8e8', 5, 0.28))
    pyramid(c, px[3][0] - 4, px[3][1] + 6, 12, ramp('#d49a52', 4, 0.2))
    pyramid(c, px[3][0] + 10, px[3][1] + 6, 8, ramp('#d49a52', 4, 0.2))
    sc.cactus(c, px[3][0] - 18, px[3][1] + 6, 7, ramp('#4a9a4a', 5, 0.24))
    for dx, h in ((-10, 14), (2, 20), (14, 13)):
        x0, y0 = px[4][0] + dx, px[4][1] + 6
        c.poly([(x0 - h * 0.7, y0), (x0, y0 - h), (x0 + h * 0.7, y0)], '#7a8eb0')
        c.poly([(x0 - h * 0.7, y0), (x0, y0 - h), (x0, y0)], '#9aaed0')
        c.poly([(x0 - h * 0.25, y0 - h * 0.62), (x0, y0 - h), (x0 + h * 0.25, y0 - h * 0.62)], '#ffffff')
    sc.castle(c, px[5][0], px[5][1] + 4, 0.42, ramp('#3a2a40', 4, 0.12), ramp('#5a1d34', 4, 0.14), '#ff7a3a', '#9a1d2a')
    for i in range(8):
        c.set(px[5][0] - 14 + i * 4, px[5][1] + 8 + (i % 2), '#ff6a2a')
    # cadre de parchemin
    for x in range(W):
        for y in (0, H - 1):
            c.set(x, y, '#3a2410')
    for y in range(H):
        for x in (0, W - 1):
            c.set(x, y, '#3a2410')
    c.to_png(path)


if __name__ == '__main__':
    import sys
    build(sys.argv[1])
