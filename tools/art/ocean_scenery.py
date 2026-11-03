"""v9.2.0 (monde marin) : décor peint du Royaume englouti (calques fixes en parallaxe).

Fond bleu profond, falaises sous-marines lointaines, cité engloutie (colonnes, arches, temple effondré), épave,
massifs de coraux, rochers proches, sol de sable, premier plan d'algues. Les éléments animés (rayons de lumière,
caustiques, kelp qui ondule, bulles, particules, poissons de fond) sont dessinés en jeu : src/render/ocean-fx.js.
"""
import math

from lib import rng
from scenery import Wrap, R, L, haze, glow, place, rock, block_ground, front_strip, noise1, ridge


SKY = ['#04121e', '#06243a', '#0a3a58', '#135a7a']


def column(c, x, base, h, w, stone, broken=False, seed=0):
    r = rng(seed)
    top = base - h
    for y in range(top, base):
        for xx in range(x, x + w):
            k = xx - x
            col = stone[3] if k == 1 else stone[1] if k == w - 1 else stone[2]
            if (y + k) % 7 == 0 and 0 < k < w - 1:
                col = stone[1]
            c.set(xx, y, col)
    c.rect(x - 1, base - 2, w + 2, 2, stone[1])
    if broken:
        for xx in range(x, x + w):
            for k in range(r.randint(0, 4)):
                c.set(xx, top - k, None if False else stone[2])
    else:
        c.rect(x - 2, top - 2, w + 4, 2, stone[3]); c.rect(x - 2, top, w + 4, 1, stone[1])
    # algues accrochées
    for k in range(r.randint(1, 3)):
        yy = top + r.randint(2, max(3, h - 4))
        for j in range(r.randint(2, 5)):
            c.set(x + (j % 2) - 1, yy + j, '#2a6a3a')


def arch(c, x, base, w, h, stone):
    for xx in range(x, x + w):
        t = (xx - x) / max(1, w - 1)
        top = base - h + int(math.sin(t * math.pi) * -6) + 6
        for yy in range(base - h, top + 3):
            c.set(xx, yy, stone[2] if yy > base - h + 1 else stone[3])
    column(c, x, base, h, 5, stone, seed=x)
    column(c, x + w - 5, base, h, 5, stone, seed=x + 1)


def coral(c, x, base, h, cols, seed):
    r = rng(seed)

    def branch(px, py, ang, L, d):
        if L < 2 or d > 4:
            return
        for k in range(int(L)):
            px += math.cos(ang); py += math.sin(ang)
            c.set(px, py, cols[1 + (k % 2)])
            c.set(px + 1, py, cols[1])
        c.set(px, py, cols[3])
        for s in (-1, 1):
            if r.random() < 0.8:
                branch(px, py, ang + s * r.uniform(0.3, 0.7), L * 0.65, d + 1)
    branch(x, base, -math.pi / 2, h * 0.45, 0)


def fan(c, x, base, h, cols, seed):
    r = rng(seed)
    for k in range(9):
        a = -math.pi / 2 + (k - 4) * 0.18
        for s in range(int(h * r.uniform(0.7, 1))):
            c.set(x + math.cos(a) * s, base + math.sin(a) * s, cols[1] if s % 3 else cols[2])


def wreck(c, x, base, wood):
    # coque d'un navire couché, mât brisé
    for xx in range(x, x + 70):
        t = (xx - x) / 70
        top = base - int(16 * math.sin(t * math.pi) ** 0.5) - 4
        for yy in range(top, base):
            plank = (yy - top) // 3
            c.set(xx, yy, wood[2] if plank % 2 else wood[1])
        c.set(xx, top, wood[3])
    for k in range(5):
        c.rect(x + 12 + k * 11, base - 14, 4, 4, '#04121e')  # trous
    for k in range(34):
        c.set(x + 40 + k * 0.6, base - 18 - k, wood[2]); c.set(x + 41 + k * 0.6, base - 18 - k, wood[1])
    c.line(x + 50, base - 34, x + 70, base - 30, '#4a6a6a')


def zone_ocean():
    sky = SKY
    stone = R('#4a7a8a', 5, 0.26, 0.04)
    out = []
    far = Wrap(512, 180); GB = 178
    ridge(far, 120, 30, R('#0c3048', 4, 0.12), 3001)
    ridge(far, 150, 22, R('#0e3a56', 4, 0.12), 3002)
    for x in (60, 230, 400):
        column(far, x, 150, 50, 7, R('#16485e', 5, 0.14), seed=x)
    haze(far, '#0a3a58', 0.45)
    out.append(L('far', far, 0.06, -GB))

    city = Wrap(512, 150); GB = 148
    arch(city, 40, 148, 46, 60, stone)
    for x, h, br in ((120, 72, False), (140, 50, True), (300, 66, False), (330, 40, True), (470, 58, True)):
        column(city, x, 148, h, 7, stone, broken=br, seed=x)
    # fronton de temple effondré
    city.poly([(296, 82), (322, 66), (348, 82)], stone[2]); city.poly([(300, 81), (322, 69), (344, 81)], stone[3])
    city.rect(296, 82, 52, 3, stone[1])
    wreck(city, 180, 148, R('#5a3a24', 4, 0.2))
    haze(city, '#0c4462', 0.35)
    out.append(L('city', city, 0.2, -GB))

    reef = Wrap(512, 110); GB = 108
    cols = [R('#e85a7a', 4, 0.3), R('#ffa04a', 4, 0.3), R('#c06ae0', 4, 0.3), R('#4ad0c0', 4, 0.3)]
    r = rng(3010)
    for i in range(16):
        x = 10 + i * 32 + r.randint(-6, 6)
        place(reef, x, GB, 30, 40, rock, r.randint(10, 22), r.randint(6, 12), stone[:4])
        if i % 2:
            coral(reef, x + r.randint(-4, 4), GB - 4, r.randint(24, 40), cols[i % 4], 3020 + i)
        else:
            fan(reef, x, GB - 3, r.randint(14, 24), cols[(i + 1) % 4], 3030 + i)
    haze(reef, '#0e5070', 0.18)
    out.append(L('reef', reef, 0.45, -GB))

    near = Wrap(384, 64); GB = 62
    for x in (20, 140, 260, 350):
        place(near, x, GB, 30, 22, rock, 18, 10, R('#2a5a6a', 5, 0.22)[:4])
    for i, x in enumerate((70, 200, 310)):
        coral(near, x, GB - 2, 30, cols[i], 3040 + i)
    out.append(L('near', near, 0.7, -GB))

    g = block_ground(256, 3050, R('#e0cc8a', 5, 0.22, 0.03), R('#7a8a7a', 5, 0.2, 0.04), '#04121e', 'sand')
    rr_ = rng(3051)
    for i in range(12):
        x, y = rr_.randint(2, 252), rr_.randint(5, 8)
        g.set(x, y, '#f4e8c8' if i % 2 else '#e87a8a')  # coquillages
    out.append(L('ground', g, 1.0, -8))

    def weed(c, x, base, r):
        for k in range(r.randint(5, 10)):
            c.set(x + (k // 2) % 2, base - k, '#2a8a4a' if k % 3 else '#4ab05a')
    out.append(L('front', front_strip(320, 3060, 'rock', R('#1a3a44', 5, 0.22), extra=weed), 1.25, 7, front=True))
    return sky, '#04121e', out


ZONES = {'ocean': zone_ocean}
NEAR_VEIL = {'ocean': '#0a4a6a'}
