"""Carte du monde peinte (assets/ui/worldmap.png), 240×130 : 12 régions reliées par un chemin.

Centres des régions, positions relatives (x, y entre 0 et 1), dans l'ordre des mondes
(à reprendre dans MAP_NODES de src/ui/panels/campaign.js ; copie dans tools/art/worldmap_nodes.json) :
   1 plaines              (0.09, 0.80)
   2 forêt sombre         (0.18, 0.56)
   3 grottes de cristal   (0.29, 0.82)
   4 désert               (0.41, 0.60)
   5 montagnes gelées     (0.53, 0.84)
   6 terres maudites      (0.65, 0.62)
   7 marais putride       (0.78, 0.84)
   8 îles célestes        (0.91, 0.58)
   9 cœur du volcan       (0.81, 0.30)
  10 royaume du néant     (0.61, 0.28)
  11 royaume englouti     (0.50, 0.13)  (v9.2.0, monde marin)
  12 trône de l'abysse    (0.38, 0.30)  <- point final
"""
import math
from lib import Canvas, ramp, shift, mix, rng
import scenery as sc
import scenery2 as sc2

W, H = 240, 130
NODES = [(0.09, 0.80), (0.18, 0.56), (0.29, 0.82), (0.41, 0.60), (0.53, 0.84), (0.65, 0.62),
         (0.78, 0.84), (0.91, 0.58), (0.81, 0.30), (0.61, 0.28), (0.50, 0.13), (0.38, 0.30)]
REGION = [
    ramp('#5aae4a', 4, 0.18),  # plaines
    ramp('#2f7a44', 4, 0.18),  # forêt
    ramp('#7a7090', 4, 0.18),  # grottes
    ramp('#e0b46a', 4, 0.16),  # désert
    ramp('#c8d8ee', 4, 0.14),  # montagnes
    ramp('#5a3a6a', 4, 0.16),  # terres maudites
    ramp('#4e6a3a', 4, 0.16),  # marais
    ramp('#5c9ce4', 4, 0.14),  # îles célestes (ciel et nuages)
    ramp('#4a2c28', 4, 0.16),  # volcan
    ramp('#2c1c58', 4, 0.16),  # néant
    ramp('#1a6a8a', 4, 0.16),  # royaume englouti (v9.2.0)
    ramp('#2a0e12', 4, 0.14),  # trône de l'abysse
]
SPECKS = {6: ('#2a4a34', 0.06), 7: ('#e8f4ff', 0.07), 8: ('#ff7a20', 0.025), 9: ('#e8dcff', 0.05), 10: ('#8af0ff', 0.06), 11: ('#ff4a14', 0.04)}


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
            land = d < 34 + n and 6 < x < W - 6 and 5 < y < H - 5
            if not land:
                wave = (x + int(sc.noise1(y, 40, 3, 2) * 4)) % 11 == 0 and y % 5 == 0
                c.set(x, y, sea[3] if wave else sea[2] if (x * 7 + y * 3) % 23 else sea[1])
                continue
            # région de la zone la plus proche (frontière bruitée)
            k = min(range(len(pts)), key=lambda i: math.hypot(x - pts[i][0] + n * 0.8, y - pts[i][1] - n * 0.5))
            col = REGION[k]
            shade_ = 1 if r.random() < 0.12 else 2
            if d > 29 + n:
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
    # textures propres aux nouvelles régions (eaux du marais, nuages, braises, étoiles, failles)
    for y in range(H):
        for x in range(W):
            v = c.px[y][x]
            for k, (col, p) in SPECKS.items():
                if v in REGION[k][1:] and r.random() < p:
                    c.set(x, y, col)
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
    # 7 marais : arbres morts, mare et champignons luisants
    x, y = px[6]
    for dx, h, seed in ((-11, 18, 1), (12, 14, 2)):
        sc.place(c, x + dx, y + 5, 26, h + 6, sc2.twisted_tree, h, ramp('#6a5640', 4, 0.3), ramp('#9aac62', 4, 0.3), seed, moss_p=1.0)
    c.ellipse(x + 1, y + 8, 10, 2.5, '#1e3a26'); c.ellipse(x, y + 7.5, 8, 1.5, '#3a6a3a')
    sc.lily(c, x + 4, y + 8, ramp('#5aa040', 4, 0.3), '#f080b0')
    sc.lily(c, x - 4, y + 8, ramp('#5aa040', 4, 0.3))
    for dx in (-7, 16):
        c.set(x + dx, y + 6, '#5af0c0'); c.set(x + dx, y + 7, '#c8d8c0')
    # 8 îles célestes : îles flottantes, temple, cascade
    x, y = px[7]
    sc.cloud(c, x - 8, y + 8, 22, ['#b8d0ea', '#dceaf8', '#f4f8ff', '#ffffff'], 5)
    sc2.sky_island(c, x - 2, y - 2, 24, 10, ramp('#5cbc44', 5, 0.3), ramp('#8a84a8', 5, 0.26), 3)
    sc2.temple(c, x - 2, y - 3, 0.3, ramp('#d8d4e8', 5, 0.2), ramp('#e0aa34', 5, 0.3), ncol=3)
    sc2.sky_island(c, x - 17, y - 14, 10, 6, ramp('#5cbc44', 5, 0.3), ramp('#8a84a8', 5, 0.26), 4)
    for k in range(9):
        c.set(x + 6, y - 1 + k, '#c4e4fa' if k % 3 else '#ffffff')
    # 9 volcan : cône, coulées, panache
    x, y = px[8]
    sc2.volcano_cone(c, x, y + 8, 40, 22, ramp('#4a2a26', 5, 0.2), ['#c8300c', '#ff7a18', '#ffc040', '#fff0a0'], 9)
    for i, (dx, dy, rr) in enumerate(((1, -16, 3), (3, -20, 4), (6, -25, 5))):
        c.shaded_ellipse(x + dx, y + dy, rr, rr * 0.7, ['#2a1c1c', '#3e2a26', '#5a4236', '#6e5242'] if i else ['#7a2c14', '#b0461a', '#e0782a', '#ffa040'])
    # 10 néant : plateforme flottante, monolithe runique, éclat de réalité
    x, y = px[9]
    sc2.void_platform(c, x, y + 2, 26, 9, ramp('#5a4e90', 5, 0.24), 10, ramp('#5af0ff', 4, 0.3))
    sc2.obelisk(c, x - 5, y + 1, 16, 5, ramp('#5a4e90', 5, 0.24), ramp('#5af0ff', 4, 0.3), 2, gap=2)
    sc2.reality_shard(c, x + 10, y - 8, 4, 7, 'meadow')
    # 11 royaume englouti (v9.2.0, monde marin) : arches d'une cité engloutie, coraux, bulles
    x, y = px[10][0], px[10][1] + 9
    ruin = ramp('#8ab0b8', 4, 0.2)
    for dx, h in ((-12, 12), (-2, 16), (8, 12)):
        c.rect(x + dx, y + 8 - h, 3, h, ruin[2]); c.rect(x + dx, y + 8 - h, 1, h, ruin[3])
    c.rect(x - 13, y - 9, 25, 2, ruin[1]); c.rect(x - 13, y - 9, 25, 1, ruin[3])
    for dx, col in ((-18, '#ff6a8a'), (14, '#ffb04a'), (-7, '#e05ab0')):
        for k in range(5):
            c.set(x + dx + (k % 2), y + 8 - k, col)
        c.set(x + dx - 1, y + 5, col); c.set(x + dx + 2, y + 6, col)
    for k, (dx, dy) in enumerate(((4, -14), (6, -18), (3, -22), (-9, -15))):
        c.set(x + dx, y + dy, '#e8f8ff'); c.set(x + dx + 1, y + dy - 1, '#8ad8f0')
    # 12 trône de l'abysse (point final) : tête de démon, braseros, lave
    x, y = px[11]
    c.ellipse(x, y + 8, 16, 3, '#ff6a1a'); c.ellipse(x, y + 8, 13, 2, '#ffc040')
    sc.place(c, x, y + 8, 34, 32, sc.demon_head, 0.5, ramp('#2a1e22', 5, 0.16), ['#ff4a1a', '#ffc030', '#fff4b0'])
    for dx in (-15, 15):
        c.rect(x + dx - 1, y, 3, 8, '#2a1e22')
        sc.flame(c, x + dx, y, 5, ['#c8200c', '#ff6a14', '#ffc030', '#fff4b0'])
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
