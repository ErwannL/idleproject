"""Décors des mondes 7 à 11 : marais, îles célestes, volcan, néant, trône de l'abysse.

Même format que scenery.py (calques `Wrap` raccordables, mêmes clefs de manifeste, mêmes
hauteurs de sol / bande de premier plan) et mêmes helpers ; `scenery.build()` fusionne
`ZONES` et `NEAR_VEIL` de ce module avec les siens.
"""
import math
from lib import mix, rng, shift
from scenery import (Local, Wrap, L, R, block_ground, bush, chain, cloud, clouds_layer, crag, crystal,
                     crystal_cluster, flame, foliage, front_strip, glow, hanging_chain, haze, horn, lantern,
                     lantern_post, lily, mushroom, noise1, peaks, pillar_brazier, place, ribcage, ridge, rock,
                     round_tree, stalactite, stalagmite, streak_cloud, sun, vines, water, waterfall, banner)

# ====================================================================== utilitaires


def A(col, a):
    """Couleur semi-transparente (#rrggbbaa)."""
    return col[:7] + '%02x' % max(0, min(255, int(round(255 * a))))


def blend(c, x, y, col, k):
    """Mélange `col` à hauteur k : alpha sur le vide, mélange sur l'opaque."""
    if k <= 0.02:
        return
    cur = c.get(x, y)
    if cur is None:
        if isinstance(c, Wrap) or c.inside(x, y):
            c.set(x, y, A(col, k))
    elif len(cur) == 9:
        a0 = int(cur[7:9], 16) / 255
        na = 1 - (1 - a0) * (1 - k)
        c.set(x, y, mix(cur[:7], col, k / na) + '%02x' % int(255 * na))
    else:
        c.set(x, y, mix(cur, col, k))


def fog_band(c, y0, y1, col, a, seed, steps=4):
    """Bande de brume semi-transparente à paliers, épaisseur et hauteur ondulantes (raccordable)."""
    mid, half = (y0 + y1) / 2, (y1 - y0) / 2
    for x in range(c.w):
        n = noise1(x, c.w, seed, 3)
        n2 = noise1(x, c.w / 2, seed + 1, 2)
        th = half * (0.5 + 0.5 * (n + 1) / 2 * 1.2)
        cy = mid + n2 * half * 0.45
        for y in range(int(cy - th) - 1, int(cy + th) + 2):
            d = abs(y + 0.5 - cy) / max(0.5, th)
            if d < 1:
                blend(c, x, y, col, math.ceil((1 - d) * steps) / steps * a)


def stars(c, n, seed, cols=('#ffffff', '#cfd8ff', '#ffe8c8', '#a8b8ff'), y1=None, big=0.05):
    r = rng(seed)
    y1 = y1 or c.h
    for _ in range(n):
        x, y = r.randint(0, c.w - 1), r.randint(0, y1 - 1)
        col = r.choice(cols)
        if r.random() < big:
            c.set(x, y, '#ffffff')
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                c.set(x + dx, y + dy, A(col, 0.7))
            for dx, dy in ((2, 0), (-2, 0), (0, 2), (0, -2)):
                c.set(x + dx, y + dy, A(col, 0.3))
        else:
            c.set(x, y, A(col, r.choice((0.35, 0.55, 0.8, 1.0))))


# ====================================================================== marais


def twisted_tree(c, x, base, h, bark, moss, seed, lean=0.0, spread=1.0, moss_p=0.35, knot=False, fungus=None):
    """Arbre mort tordu : tronc noueux, branches griffues, mousse pendante (lumière haut-gauche).
    Renvoie les points lumineux (yeux du nœud, champignons)."""
    r = rng(seed)
    segs = []

    def grow(px, py, ang, length, rad, depth):
        n = max(3, int(length))
        a = ang
        curl = r.uniform(-0.06, 0.06)
        pts = []
        for i in range(n):
            t = i / n
            if depth == 0:
                a += curl * 0.5 + r.uniform(-0.06, 0.06) + (-math.pi / 2 + lean - a) * 0.06
            else:
                a += curl + r.uniform(-0.12, 0.12)
            a = max(-math.pi + 0.25, min(-0.25, a))
            px += math.cos(a)
            py += math.sin(a)
            rr = rad * (1 - 0.6 * t)
            segs.append((px, py, rr, depth, a))
            pts.append((px, py, rr, a))
        if depth >= 3 or rad < 0.9:
            return
        sides = [-1, 1]
        r.shuffle(sides)
        for j in range(2 if depth == 0 else r.randint(1, 2)):
            na = a + sides[j] * r.uniform(0.45, 1.0) * spread
            grow(px, py, na, length * r.uniform(0.55, 0.78), rad * 0.42 + 0.35, depth + 1)
        if depth <= 1:
            mp = pts[int(n * r.uniform(0.35, 0.7))]
            side = r.choice((-1, 1))
            grow(mp[0], mp[1], mp[3] + side * r.uniform(0.9, 1.35), length * 0.55, mp[2] * 0.55 + 0.3, depth + 1)

    trunk_r = max(2.2, h * 0.075)
    grow(x, base, -math.pi / 2 + lean, h * 0.5, trunk_r, 0)
    # racines
    for side in (-1, 1):
        for j in range(2):
            ex = x + side * (trunk_r * (2.2 + j * 1.6))
            for t in range(16):
                k = t / 15
                px = x + side * trunk_r * 0.5 + (ex - x - side * trunk_r * 0.5) * k
                py = base - trunk_r * (1.6 - j * 0.5) * (1 - k) ** 1.5
                segs.append((px, py, (trunk_r * 0.8 - j * 0.3) * (1 - k * 0.7), 0, -1.0))
    for px, py, rr, depth, a in segs:
        for yy in range(int(py - rr) - 1, int(py + rr) + 2):
            for xx in range(int(px - rr) - 1, int(px + rr) + 2):
                dx, dy = (xx + 0.5 - px) / max(rr, 0.5), (yy + 0.5 - py) / max(rr, 0.5)
                if dx * dx + dy * dy > 1:
                    continue
                s = dx * 0.8 + dy * 0.6
                c.set(xx, yy, bark[3] if s < -0.45 else bark[2] if s < 0.3 else bark[1])
    # sillons d'écorce sur le tronc
    for i, (px, py, rr, depth, a) in enumerate(segs):
        if depth == 0 and rr > 2:
            for o in (-0.15, 0.45):
                if (i // 5 + int(o * 10)) % 3:
                    c.setf(px + o * rr, py, bark[0])
    lights = []
    if knot:
        kp = segs[int(h * 0.22)]
        c.ellipse(kp[0] + 0.5, kp[1], kp[2] * 0.6, kp[2] * 0.75, '#0a0806')
        c.set(kp[0] - 0.5, kp[1] - 0.5, '#f8e040'); c.set(kp[0] + 1.5, kp[1] - 0.5, '#f8e040')
        lights.append((kp[0] + 0.5, kp[1] - 0.5, 4))
    if fungus:
        for j in range(3):
            kp = segs[int(h * (0.12 + j * 0.09))]
            side = -1 if j % 2 else 1
            fx, fy = kp[0] + side * kp[2] * 0.9, kp[1]
            c.ellipse(fx, fy, 2.6, 1.2, fungus[1])
            c.set(fx - 1, fy - 1, fungus[3]); c.set(fx, fy - 1, fungus[2]); c.set(fx + 1, fy - 1, fungus[2])
            lights.append((fx, fy, 5))
    # mousse : liseré sur le dessus des branches et rideaux pendants
    for px, py, rr, depth, a in segs:
        if depth >= 1 and abs(math.cos(a)) > 0.45:
            if r.random() < 0.5:
                c.setf(px, py - rr + 0.5, moss[3])
            if r.random() < moss_p * 0.09:
                moss_curtain(c, px, py + rr * 0.5, r.randint(7, 24), moss, r, n=r.randint(1, 3))
    return lights


def moss_curtain(c, x, y, L, moss, r, n=None):
    """Rideau de mousse pendante : brins de longueurs inégales, bout plus sombre."""
    n = n or r.randint(2, 4)
    for j in range(n):
        sx = x + j - n // 2
        Lj = max(2, int(L * r.uniform(0.45, 1.0)))
        for k in range(Lj):
            wx = sx + round(math.sin(k * 0.35 + j * 1.7) * 0.6)
            col = moss[3] if k < 2 else moss[2] if k < Lj * 0.6 else moss[1]
            if k == Lj - 1:
                col = moss[0]
            c.set(wx, y + k, col)
            if k % 4 == 2 and r.random() < 0.5:
                c.set(wx + r.choice((-1, 1)), y + k, moss[1])


def shroom_cluster(c, x, base, s, cap, stem, seed):
    """Touffe de champignons phosphorescents ; renvoie les points de halo."""
    r = rng(seed)
    out = []
    for dx, k in ((-s * 1.1, 0.55), (s * 1.0, 0.7), (s * 0.3, 0.4), (0, 1.0)):
        ss = max(2, int(round(s * k)))
        mx = x + dx + r.uniform(-0.5, 0.5)
        mushroom(c, mx, base, ss, cap, stem, dots=cap[-1])
        out.append((mx, base - ss, ss * 2.6))
    return out


def reeds(c, x, base, h, stem, head, seed, n=6):
    """Roseaux et massettes."""
    r = rng(seed)
    for j in range(n):
        bx = x + r.randint(-5, 5)
        hh = int(h * r.uniform(0.5, 1.0))
        lean = r.uniform(-0.18, 0.18)
        if r.random() < 0.55:
            for k in range(hh):
                c.set(bx + lean * k, base - k, stem[2] if k > hh * 0.4 else stem[1])
            tx = bx + lean * hh
            c.rect(tx - 0.5, base - hh - 4, 2, 5, head[1])
            c.set(tx - 0.5, base - hh - 4, head[2]); c.set(tx - 0.5, base - hh - 3, head[2])
            c.set(tx, base - hh - 5, stem[2]); c.set(tx, base - hh - 6, stem[2])
        else:
            side = r.choice((-1, 1))
            for k in range(hh):
                t = k / hh
                c.set(bx + lean * k + side * t * t * 4, base - k, stem[3] if t > 0.5 else stem[2])


def stilt_hut(c, x, base, wood, roof, window, metal, light):
    """Cabane sur pilotis : pieux, plancher, planches, toit de chaume, fenêtre et lanterne."""
    w = 36
    x0 = x - w // 2
    deck = base - 16
    wt = deck - 19
    for px in (x0 + 1, x0 + 12, x0 + 22, x0 + w - 3):
        for y in range(deck, base + 4):
            c.set(px, y, wood[2]); c.set(px + 1, y, wood[1])
        for y in range(base - 3, base + 1):
            c.set(px, y, '#3e6a2c'); c.set(px + 1, y, '#2a4a20')
    c.line(x0 + 3, deck + 2, x0 + 12, base - 3, wood[1])
    c.line(x0 + 23, base - 3, x0 + w - 3, deck + 2, wood[0])
    for xx in range(x0, x0 + w):
        col = wood[2] if (xx - x0) % 4 else wood[1]
        if xx == x0:
            col = wood[3]
        for y in range(wt, deck):
            c.set(xx, y, col)
        if (xx - x0) % 4 == 2:
            c.set(xx, wt + 3 + (xx * 7) % 9, wood[0])
    c.rect(x0 + w - 4, wt + 9, 3, 6, wood[0])  # planche manquante
    c.rect(x0 + 4, deck - 13, 8, 13, wood[0])
    c.rect(x0 + 5, deck - 12, 6, 12, '#1a120c')
    c.set(x0 + 10, deck - 6, '#c8a040')
    wx, wy = x0 + w - 15, wt + 4
    c.rect(wx, wy, 8, 7, window[1])
    c.rect(wx + 1, wy + 1, 3, 2, window[2])
    c.rect(wx, wy, 8, 1, wood[0]); c.rect(wx + 3, wy, 1, 7, wood[0]); c.rect(wx, wy + 3, 8, 1, wood[0])
    c.rect(wx - 1, wy + 7, 10, 1, wood[3])
    c.rect(wx + 8, wy, 2, 8, wood[1])  # volet
    c.rect(x0 - 5, deck, w + 10, 3, wood[2]); c.rect(x0 - 5, deck, w + 10, 1, wood[3])
    c.rect(x0 - 5, deck + 2, w + 10, 1, wood[0])
    for xx in range(x0 - 5, x0 + w + 5, 4):
        c.set(xx, deck + 1, wood[1])
    rh = 16
    c.poly([(x0 - 7, wt + 3), (x - 3, wt - rh), (x + 3, wt - rh + 1), (x0 + w + 7, wt + 3)], roof[2])
    c.poly([(x + 1, wt - rh), (x0 + w + 7, wt + 3), (x + 1, wt + 3)], roof[1])
    for i in range(-6, w // 2 + 6, 2):
        c.line(x - 1, wt - rh + 1, x - (w // 2 + 6) + i * 2, wt + 2, roof[3] if i < w // 4 else roof[2])
    for xx in range(x0 - 7, x0 + w + 8):
        d = (xx * 13) % 4
        for k in range(d):
            c.set(xx, wt + 3 + k, roof[1] if k < d - 1 else roof[0])
    for mx, my in ((x - 8, wt - 6), (x + 9, wt - 3), (x - 15, wt)):
        c.ellipse(mx, my, 3, 1.4, '#4a7a34'); c.set(mx - 1, my - 1, '#7aa848')
    c.rect(x + 7, wt - rh - 2, 3, 9, metal[1]); c.rect(x + 6, wt - rh - 3, 5, 1, metal[2])
    for y in range(deck - 8, deck):
        c.set(x0 + w + 4, y, wood[2])
    c.rect(x0 + w - 1, deck - 8, 6, 1, wood[3])
    lt = lantern(c, x0 - 4, wt + 9, metal, light)
    c.set(x0 - 4, wt + 3, metal[0]); c.set(x0 - 4, wt + 4, metal[0])
    for y in range(deck + 3, base + 2):
        if (y - deck) % 3 == 0:
            c.rect(x0 - 3, y, 4, 1, wood[3])
        c.set(x0 - 3, y, wood[2]); c.set(x0 + 1, y, wood[1])
    return [(wx + 4, wy + 3, 10)] + [(p[0], p[1], 9) for p in lt]


def stump(c, x, base, w, h, bark, moss, seed):
    r = rng(seed)
    for y in range(base - h, base + 1):
        k = (y - (base - h)) / max(1, h)
        hw = w / 2 + max(0, k - 0.6) * w * 0.7
        for dx in range(-int(hw), int(hw) + 1):
            s = dx / max(1, hw)
            c.set(x + dx, y, bark[3] if s < -0.45 else bark[2] if s < 0.35 else bark[1])
    for dx in range(-int(w / 2), int(w / 2) + 1):
        c.set(x + dx, base - h - 1 - (r.random() < 0.4) * r.randint(1, 3), bark[2])
        c.set(x + dx, base - h, '#c8a878' if abs(dx) < w / 2 - 1 else bark[3])
    for dx in range(-int(w / 2) - 1, int(w / 2) + 2):
        if r.random() < 0.6:
            c.set(x + dx, base - h + 1 + r.randint(0, 3), moss[3])


def bubbles(c, x0, x1, y0, y1, cols, seed, n=12):
    r = rng(seed)
    for _ in range(n):
        x, y = r.randint(x0, x1), r.randint(y0, y1)
        s = r.choice((1, 1, 2))
        if s == 1:
            c.setf(x, y, cols[-1])
        else:
            for dx, dy in ((0, -1), (1, 0), (0, 1), (-1, 0)):
                c.setf(x + dx, y + dy, cols[-1])
            c.setf(x - 1, y - 1, '#ffffff')


def scum(c, x0, x1, y0, cols, seed):
    """Plaques d'algues sur une eau stagnante."""
    r = rng(seed)
    x = x0
    while x < x1:
        w = r.randint(4, 14)
        for k in range(w):
            c.setf(x + k, y0, cols[1])
            if 1 < k < w - 2:
                c.setf(x + k, y0 + 1, cols[0])
            if r.random() < 0.3:
                c.setf(x + k, y0 - 0 + 0, cols[2])
        x += w + r.randint(6, 30)


def swamp_water(c, x0, x1, y0, y1, seed):
    cols = ['#16301e', '#24472a', '#3c6634', '#7aa45a']
    water(c, x0, x1, y0, y1, cols, seed)
    scum(c, x0, x1, y0 + 1, ['#3a5a24', '#5a8a30', '#8ab848'], seed + 1)
    bubbles(c, x0, x1 - 1, y0 + 2, y1 - 2, ['#5a8a3a', '#9ad06a'], seed + 2, n=(x1 - x0) // 12)


# ====================================================================== îles célestes


def sky_island(c, cx, top, w, depth, grass, rockc, seed, roots=None):
    """Île flottante : dessus herbeux, dessous rocheux en cône à strates, racines pendantes.
    Renvoie la liste (x, y du dessus)."""
    r = rng(seed)
    hw = w / 2
    tops = []
    for i in range(int(w)):
        x = int(cx - hw + i)
        t = (i + 0.5) / w * 2 - 1
        ty = top + int(max(0, abs(t) - 0.82) * 14) + (1 if noise1(i, 64, seed, 2) > 0.6 else 0)
        bot = top + 3 + depth * (1 - abs(t) ** 1.5) ** 1.1 * (0.72 + 0.28 * noise1(i * 2.0, 128, seed + 1, 3))
        tops.append((x, ty))
        for y in range(ty, int(bot)):
            d = (y - ty) / max(1, bot - ty)
            band = (y - top + int(2 * noise1(x, 64, seed + 2, 2))) // 4
            if t < -0.45:
                col = rockc[3] if band % 2 else rockc[4] if d < 0.3 else rockc[2]
            elif t > 0.4:
                col = rockc[1] if band % 2 else rockc[0]
            else:
                col = rockc[2] if band % 2 else rockc[3] if d < 0.5 else rockc[1]
            if d > 0.75:
                col = rockc[max(0, rockc.index(col) - 1)]
            c.set(x, y, col)
        if bot - ty > 2:
            c.set(x, int(bot) - 1, rockc[0])
    for x, ty in tops:
        c.set(x, ty - 1, grass[4]); c.set(x, ty, grass[3]); c.set(x, ty + 1, grass[3]); c.set(x, ty + 2, grass[2])
        d = r.randint(0, 2) + (r.random() < 0.12) * r.randint(2, 5)
        for k in range(d):
            c.set(x, ty + 3 + k, grass[2] if k < d - 1 else grass[1])
        if r.random() < 0.35:
            c.set(x, ty - 2, grass[4])
    if roots:
        for _ in range(int(w / 8)):
            rx = cx + r.uniform(-hw * 0.6, hw * 0.6)
            t = (rx - cx) / hw
            ry = top + 3 + depth * (1 - abs(t) ** 1.5) ** 1.1 * 0.7
            L_ = r.randint(4, 14)
            for k in range(L_):
                c.set(rx + math.sin(k * 0.4 + rx) * 0.8, ry + k, roots[1] if k % 4 else roots[2])
    return tops


def temple(c, x, base, s, marble, gold, dome=False, ncol=5):
    """Temple blanc et or : emmarchement, colonnes cannelées, entablement, fronton ou dôme doré."""
    W = int(46 * s)
    x0 = x - W // 2
    for i in range(3):
        y = base - i * 2
        c.rect(x0 - 6 + 2 * i, y - 1, W + 12 - 4 * i, 2, marble[2])
        c.rect(x0 - 6 + 2 * i, y - 1, W + 12 - 4 * i, 1, marble[4])
        c.set(x0 + W + 5 - 2 * i, y, marble[1])
    floor = base - 5
    ch = int(26 * s)
    c.rect(x0 + 2, floor - ch, W - 4, ch, marble[0])  # pénombre de la cella
    c.rect(x0 + W // 2 - 4, floor - ch + 8, 8, ch - 8, '#3a3048')
    c.set(x0 + W // 2 - 1, floor - ch + 12, gold[3]); c.set(x0 + W // 2, floor - ch + 12, gold[3])
    step = (W - 6) / (ncol - 1)
    for i in range(ncol):
        cx = int(x0 + 3 + i * step)
        for y in range(floor - ch + 3, floor):
            c.set(cx - 2, y, marble[4]); c.set(cx - 1, y, marble[3]); c.set(cx, y, marble[3] if y % 3 else marble[2])
            c.set(cx + 1, y, marble[2]); c.set(cx + 2, y, marble[1])
        c.rect(cx - 3, floor - 2, 7, 2, marble[3]); c.rect(cx - 3, floor - 1, 7, 1, marble[2])
        c.rect(cx - 3, floor - ch + 1, 7, 2, gold[2]); c.set(cx - 3, floor - ch + 1, gold[3])
    et = floor - ch - 4
    c.rect(x0 - 2, et, W + 4, 5, marble[3])
    c.rect(x0 - 2, et, W + 4, 1, marble[4])
    c.rect(x0 - 2, et + 3, W + 4, 1, gold[2])
    c.rect(x0 - 2, et + 4, W + 4, 1, marble[1])
    for xx in range(x0, x0 + W, 4):
        c.set(xx, et + 1, marble[1]); c.set(xx, et + 2, marble[1])
    if dome:
        rr = W * 0.32
        c.rect(int(x - rr - 2), et - 4, int(rr * 2 + 5), 4, marble[3])
        c.rect(int(x - rr - 2), et - 4, int(rr * 2 + 5), 1, marble[4])
        c.shaded_ellipse(x, et - 4, rr, rr * 0.95, gold, light=(-0.6, -0.8))
        c.rect(int(x - rr - 1), et - 4, int(rr * 2 + 3), 4, marble[3])
        c.rect(int(x - rr - 2), et - 4, int(rr * 2 + 5), 1, marble[4])
        for k in range(-2, 3):
            c.line(x + k * rr * 0.38, et - 5, x + k * rr * 0.15, et - 4 - rr * 0.92, gold[1] if k > 0 else gold[2])
        c.rect(x - 1, int(et - 4 - rr - 5), 2, 5, gold[3])
        c.ellipse(x, et - 4 - rr - 6, 1.6, 1.6, gold[4])
        return [(x, et - 4 - rr - 6, 8)]
    ph = int(W * 0.2)
    c.poly([(x0 - 4, et), (x, et - ph), (x0 + W + 3, et)], marble[3])
    c.poly([(x, et - ph), (x0 + W + 3, et), (x, et)], marble[2])
    c.poly([(x0 + 4, et - 1), (x, et - ph + 4), (x0 + W - 5, et - 1)], marble[1])
    c.line(x0 - 4, et, x, et - ph, gold[3]); c.line(x, et - ph, x0 + W + 3, et, gold[2])
    c.ellipse(x, et - ph * 0.45, 2.2, 2, gold[3]); c.set(x - 1, et - ph * 0.45 - 1, gold[4])
    for px, py in ((x0 - 4, et - 1), (x, et - ph - 1), (x0 + W + 3, et - 1)):
        c.rect(px - 1, py - 3, 3, 3, gold[2]); c.set(px - 1, py - 3, gold[4])
    return [(x, et - ph - 3, 7)]


def void_fall(c, x, y0, L, w, cols, seed):
    """Cascade qui tombe dans le vide : stries puis évanouissement en embruns."""
    r = rng(seed)
    for i in range(w):
        off = r.randint(0, 30)
        Ls = r.randint(5, 11)
        Li = int(L * r.uniform(0.8, 1.0))
        for k in range(Li):
            t = k / Li
            col = cols[3] if (k + off) % Ls == 0 else cols[1] if i in (0, w - 1) else cols[2]
            a = 1.0 if t < 0.45 else math.ceil((1 - t) / 0.55 * 4) / 4
            c.set(x + i + (t > 0.6) * r.choice((0, 0, 1, -1)), y0 + k, A(col, a) if a < 1 else col)
    for i in range(-1, w + 1):
        c.set(x + i, y0, cols[3])
    for _ in range(w * 4):
        k = r.uniform(0.5, 1.1) * L
        c.set(x + w / 2 + r.uniform(-w, w), y0 + k, A(cols[3], r.choice((0.25, 0.4, 0.55))))


def hang_bridge(c, x0, y0, x1, y1, sag, wood, rope):
    """Pont de corde entre deux points (planches, mains courantes, suspentes)."""
    n = int(abs(x1 - x0))
    for i in range(n + 1):
        t = i / n
        x = x0 + (x1 - x0) * t
        y = y0 + (y1 - y0) * t + sag * math.sin(math.pi * t)
        c.set(x, y, wood[3] if i % 3 else wood[0]); c.set(x, y + 1, wood[1] if i % 3 else wood[0])
        ry = y - 6 + sag * 0.15 * math.sin(math.pi * t)
        c.set(x, ry, rope[1])
        if i % 5 == 0:
            for k in range(int(ry) + 1, int(y)):
                c.set(x, k, rope[0])
    for px, py in ((x0, y0), (x1, y1)):
        c.rect(px - 1, py - 8, 2, 9, wood[2]); c.set(px - 1, py - 8, wood[3])


def cloud_sea(c, y, seed, cols, step=18, rmin=10, rmax=20):
    """Mer de nuages raccordable : rangée de boules ombrées puis remplissage dessous."""
    r = rng(seed)
    for x in range(0, c.w, step):
        rx = r.uniform(rmin, rmax)
        cx = x + r.randint(0, step // 2)
        cy = y + r.uniform(-3, 4)
        c.shaded_ellipse(cx, cy, rx, rx * 0.62, cols, light=(-0.3, -0.95))
    for x in range(c.w):
        for yy in range(y + 4, c.h):
            if c.get(x, yy) is None:
                c.set(x, yy, cols[1])


def sun_rays(c, x, y, col, n, seed, length=200, a=0.1):
    """Rayons de lumière en éventail sous le soleil (paliers d'alpha)."""
    r = rng(seed)
    rays = [(math.pi * 0.12 + i * (math.pi * 0.76 / max(1, n - 1)) + r.uniform(-0.06, 0.06), r.uniform(0.025, 0.055))
            for i in range(n)]
    for yy in range(int(y), min(c.h, int(y + length))):
        for xx in range(int(x - length), int(x + length)):
            d = math.hypot(xx + 0.5 - x, yy + 0.5 - y)
            if d < 14 or d > length:
                continue
            ang = math.atan2(yy + 0.5 - y, xx + 0.5 - x)
            for ra, hw in rays:
                if abs(ang - ra) < hw:
                    k = (1 - d / length) * (1 - abs(ang - ra) / hw * 0.5)
                    blend(c, xx, yy, col, math.ceil(k * 3) / 3 * a)
                    break


def marble_column(c, x, base, h, marble, gold, broken=False, seed=0):
    r = rng(seed)
    top = base - h
    tops = [top + (r.randint(0, 6) if broken else 0) for _ in range(7)]
    for i, dx in enumerate(range(-3, 4)):
        col = [marble[4], marble[3], marble[3], marble[2], marble[2], marble[1], marble[1]][i]
        for y in range(tops[i] if broken else top + 3, base - 2):
            c.set(x + dx, y, col if (dx not in (-1, 2) or y % 4) else marble[1 if dx < 0 else 0])
    c.rect(x - 5, base - 2, 11, 3, marble[3]); c.rect(x - 5, base - 2, 11, 1, marble[4]); c.rect(x - 5, base, 11, 1, marble[1])
    if not broken:
        c.rect(x - 5, top, 11, 3, gold[2]); c.rect(x - 5, top, 11, 1, gold[3]); c.set(x + 5, top + 2, gold[0])
        c.set(x - 5, top + 3, gold[1]); c.set(x + 5, top + 3, gold[1])
    else:
        for i, dx in enumerate(range(-3, 4)):
            c.set(x + dx, tops[i], marble[4])


def urn(c, x, base, gold):
    c.rect(x - 3, base - 1, 7, 2, gold[1])
    c.shaded_ellipse(x, base - 6, 4, 4.5, gold)
    c.rect(x - 2, base - 12, 5, 2, gold[2]); c.rect(x - 3, base - 13, 7, 1, gold[3])
    c.set(x - 5, base - 8, gold[2]); c.set(x - 5, base - 7, gold[1]); c.set(x + 5, base - 8, gold[1]); c.set(x + 5, base - 7, gold[0])


def gold_brazier(c, x, base, h, marble, gold, fire):
    for y in range(base - h, base + 1):
        c.set(x - 1, y, gold[3]); c.set(x, y, gold[2]); c.set(x + 1, y, gold[1])
    c.rect(x - 4, base - 1, 9, 2, gold[2]); c.rect(x - 4, base - 1, 9, 1, gold[3])
    by = base - h
    c.poly([(x - 6, by - 4), (x + 6, by - 4), (x + 3, by), (x - 3, by)], gold[1])
    c.rect(x - 6, by - 5, 13, 1, gold[3])
    flame(c, x, by - 5, 11, fire)
    return [(x, by - 9, 12)]


# ====================================================================== volcan


def volcano_cone(c, cx, base, w, h, rockc, lava, seed):
    """Volcan : cône à ravines (flanc gauche éclairé), cratère rougeoyant, coulées de lave."""
    r = rng(seed)
    hw = w / 2
    cw = 0.1
    hs = {}
    for xi in range(int(cx - hw), int(cx + hw)):
        t = (xi + 0.5 - cx) / hw
        a = abs(t)
        if a < cw:
            y = base - h + 3 - (1 - a / cw) * 1.5
        else:
            prof = ((1 - a) / (1 - cw)) ** 1.5
            y = base - h * prof + 3 * noise1(xi, 256, seed, 3) + 5 * max(0, noise1(xi, 128, seed + 4, 2)) * (1 - a) * a * 4
        hs[xi] = y
    for xi, y in hs.items():
        t = (xi + 0.5 - cx) / hw
        gully = noise1(xi * 3.0, 512, seed + 1, 3)
        for yy in range(int(y), base + 1):
            d = (yy - y) / max(1, base - y)
            if t < -cw:
                col = rockc[3] if gully > 0.1 else rockc[2]
            elif t > cw:
                col = rockc[1] if gully > -0.2 else rockc[0]
            else:
                col = rockc[2]
            if d > 0.55:
                col = rockc[max(0, rockc.index(col) - 1)]
            if (yy + int(3 * noise1(xi, 128, seed + 3, 2))) % 11 == 0 and t < 0.6:
                col = rockc[min(4, rockc.index(col) + 1)]
            if yy == int(y):
                col = rockc[4] if t < 0 else rockc[2]
            c.set(xi, yy, col)
    # cratère
    c.ellipse(cx, base - h + 3, hw * cw + 1, 2, lava[1])
    c.ellipse(cx, base - h + 3, hw * cw - 1, 1.2, lava[3])
    lights = [(cx, base - h + 2, hw * 0.5)]
    for i in range(5):
        x = cx + r.uniform(-hw * cw, hw * cw)
        y = base - h + 4
        drift = r.uniform(-0.5, 0.5) + (x - cx) * 0.03
        wdt = 1
        while y < base - 2:
            c.set(x, y, lava[2])
            c.set(x + 1, y, lava[1])
            if wdt > 1:
                c.set(x - 1, y, lava[1])
            if r.random() < 0.2:
                lights.append((x, y, 6))
            y += 1
            drift += r.uniform(-0.15, 0.15)
            drift = max(-1.2, min(1.2, drift + (0.03 if x > cx else -0.03)))
            x += drift * 0.6
            if y > base - h * 0.4:
                wdt = 2
    return lights


def obsidian(c, x, base, w, h, cols, seed, veins=None):
    """Rocher d'obsidienne : crag + reflets vitreux en biais (et veines de magma)."""
    crag(c, x, base, w, h, cols, seed)
    r = rng(seed + 5)
    x0 = int(x - w / 2)
    for _ in range(int(w / 3)):
        px, py = x0 + r.randint(1, int(w) - 2), base - r.randint(2, int(h * 0.9))
        if c.get(px, py) not in (cols[3], cols[2]):
            continue
        for k in range(r.randint(2, 6)):
            c.setf(px + k, py + k, cols[4] if k < 2 else cols[3])
    if veins:
        for _ in range(int(w / 10)):
            px, py = x0 + r.randint(2, int(w) - 3), base - r.randint(2, int(h * 0.6))
            for _ in range(r.randint(3, 8)):
                c.setf(px, py, veins[1]); c.setf(px + 1, py, veins[0])
                py += 1
                px += r.choice((-1, 0, 1))


def obsidian_spires(c, x, base, w, h, cols, seed, veins=None):
    """Amas d'aiguilles d'obsidienne vitreuses sur un socle rocheux."""
    r = rng(seed)
    obsidian(c, x, base, w, h * 0.38, cols, seed, veins)
    n = max(3, int(w / 9))
    sp = sorted(((r.uniform(-0.4, 0.4) * w, r.uniform(0.45, 1.0) * h) for _ in range(n)), key=lambda p: -p[1])
    for i, (dx, hh) in enumerate(sp):
        crystal(c, x + dx, base - h * 0.15, hh, max(2, hh * 0.13), dx * 0.12 + r.uniform(-2, 2), cols)
    return []


def lava_flow(c, x0, x1, y0, y1, seed):
    """Rivière de lave avec plaques de croûte refroidie."""
    lv = ['#a02008', '#e04a10', '#ff8a20', '#ffd060']
    water(c, x0, x1, y0, y1, lv, seed)
    r = rng(seed + 1)
    for _ in range((x1 - x0) // 16):
        cx, cy = r.randint(x0, x1), r.randint(y0 + 2, y1 - 1)
        w = r.uniform(3, 8)
        c.ellipse(cx, cy, w, 1.2, '#3a1610')
        c.set(cx - w * 0.5, cy - 1, '#5a2818'); c.set(cx, cy - 1, '#5a2818')
        c.set(cx + 1, cy, '#ff6a14')


def anvil(c, x, base, metal):
    c.rect(x - 5, base - 3, 11, 4, metal[1]); c.rect(x - 5, base - 3, 11, 1, metal[2])
    c.rect(x - 2, base - 7, 6, 4, metal[1]); c.rect(x - 2, base - 7, 2, 4, metal[2])
    c.rect(x - 6, base - 11, 14, 4, metal[2]); c.rect(x - 6, base - 11, 14, 1, metal[3])
    c.rect(x + 5, base - 9, 3, 2, metal[1])
    c.poly([(x - 6, base - 11), (x - 13, base - 10), (x - 6, base - 8)], metal[2])
    c.set(x - 11, base - 10, metal[3])


def gear(c, x, y, rr, metal, broken=True):
    for i in range(12):
        a = i * math.pi / 6
        if broken and i in (2, 3):
            continue
        c.ellipse(x + math.cos(a) * rr, y + math.sin(a) * rr, 1.6, 1.6, metal[1] if math.cos(a) > 0 else metal[2])
    for yy in range(int(y - rr), int(y + rr) + 1):
        for xx in range(int(x - rr), int(x + rr) + 1):
            d = math.hypot(xx + 0.5 - x, yy + 0.5 - y)
            a = math.atan2(yy + 0.5 - y, xx + 0.5 - x) % (2 * math.pi)
            if broken and 0.8 < a < 2.1:
                continue
            if rr * 0.55 < d <= rr:
                c.set(xx, yy, metal[2] if (xx - x) + (yy - y) < 0 else metal[1])
            elif d <= rr * 0.25:
                c.set(xx, yy, metal[3])


def dwarf_face(c, x, y, s, stone, gold):
    """Masque de nain sculpté : front, sourcils, nez, barbe à degrés, yeux d'or."""
    c.rect(x - 8 * s, y, 16 * s, 7 * s, stone[2])
    c.rect(x - 8 * s, y, 4 * s, 7 * s, stone[3])
    c.rect(x - 9 * s, y - 2 * s, 18 * s, 3 * s, stone[3])  # casque
    c.rect(x - 9 * s, y - 2 * s, 18 * s, 1, gold[3])
    c.rect(x - 6 * s, y + 2 * s, 5 * s, 1 * s, stone[0]); c.rect(x + 1 * s, y + 2 * s, 5 * s, 1 * s, stone[0])
    c.rect(x - 4 * s, y + 3 * s, 2 * s, 1 * s, gold[2]); c.rect(x + 2 * s, y + 3 * s, 2 * s, 1 * s, gold[2])
    c.rect(x - 1 * s, y + 3 * s, 2 * s, 4 * s, stone[3]); c.rect(x, y + 3 * s, 1 * s, 4 * s, stone[1])
    for i in range(5):
        bw = (14 - i * 2.4) * s
        c.rect(x - bw / 2, y + (7 + i * 2.2) * s, bw, 2.2 * s, stone[2] if i % 2 else stone[3])
        c.rect(x + bw / 2 - 2 * s, y + (7 + i * 2.2) * s, 2 * s, 2.2 * s, stone[1])
    c.rect(x - 3 * s, y + 7 * s, 6 * s, 1, stone[0])
    return [(x - 3 * s, y + 3 * s, 4), (x + 3 * s, y + 3 * s, 4)]


def forge_ruin(c, x, base, stone, gold, metal, fire):
    """Forge naine en ruine : tour brisée, cheminée, grande porte au foyer ardent, masque, éboulis."""
    r = rng(int(x))
    x0 = x - 52
    lights = []
    # cheminée (derrière)
    for y in range(base - 98, base - 60):
        for xx in range(x0 + 6, x0 + 18):
            i = xx - x0 - 6
            col = stone[3] if i < 3 else stone[2] if i < 9 else stone[1]
            if (y - base) % 6 == 0 or ((y - base) // 6 % 2 and i == 6):
                col = stone[0]
            c.set(xx, y, col)
    for xx in range(x0 + 5, x0 + 19):
        c.set(xx, base - 98 - (xx * 5) % 3, stone[3])
    c.rect(x0 + 4, base - 92, 16, 2, stone[3]); c.rect(x0 + 4, base - 91, 16, 1, gold[1])
    # tour gauche, sommet brisé
    tw = 26
    tops = [base - 74 + abs(int(5 * noise1(i, 26, 7, 2))) + (i > 18) * (i - 18) * 2 for i in range(tw)]
    for i in range(tw):
        for y in range(tops[i], base + 1):
            col = stone[3] if i < 4 else stone[2] if i < tw - 4 else stone[1]
            row = (y - base) // 7
            if (y - base) % 7 == 0 or (i + row * 6) % 13 == 0:
                col = stone[0]
            c.set(x0 + i, y, col)
        c.set(x0 + i, tops[i], stone[4])
    c.rect(x0, base - 52, tw, 3, gold[2]); c.rect(x0, base - 52, tw, 1, gold[3])
    for xx in range(x0 + 2, x0 + tw - 2, 5):
        c.set(xx, base - 51, stone[0]); c.set(xx + 2, base - 51, stone[0])
    c.rect(x0 + 9, base - 42, 7, 10, '#1a0c08')
    c.rect(x0 + 10, base - 41, 5, 8, fire[0]); c.rect(x0 + 11, base - 39, 3, 5, fire[1])
    lights.append((x0 + 12, base - 37, 8))
    # façade de la forge
    fx0, fx1 = x0 + tw, x0 + 86
    ftop = base - 58
    for xx in range(fx0, fx1):
        i = xx - fx0
        broken = ftop + (max(0, i - 44) ** 1.4) * 0.9 + (r.randint(0, 2) if i > 40 else 0)
        for y in range(int(broken), base + 1):
            row = (y - base) // 8
            col = stone[2] if i % 60 > 3 else stone[3]
            if i > 50:
                col = stone[1]
            if (y - base) % 8 == 0 or (i + row * 7) % 16 == 0:
                col = stone[0]
            c.set(xx, y, col)
        c.set(xx, int(broken), stone[4] if i < 50 else stone[2])
    # linteau à degrés et porte
    gx0, gx1 = x - 10, x + 20
    for k in range(4):
        c.rect(gx0 - 6 + k * 2, base - 44 + k * 3, gx1 - gx0 + 12 - k * 4, 3, stone[3] if k % 2 == 0 else stone[2])
        c.rect(gx0 - 6 + k * 2, base - 44 + k * 3, gx1 - gx0 + 12 - k * 4, 1, stone[4])
    c.rect(gx0 - 6, base - 45, gx1 - gx0 + 12, 1, gold[3])
    for xx in range(gx0 - 4, gx1 + 4, 4):
        c.set(xx, base - 43, gold[2]); c.set(xx + 1, base - 42, gold[1])
    c.rect(gx0, base - 32, gx1 - gx0, 33, '#160806')
    for y in range(base - 32, base + 1):
        k = (y - (base - 32)) / 32
        for xx in range(gx0, gx1):
            if k > 0.45:
                c.set(xx, y, mix('#160806', fire[0], (k - 0.45) * 1.3))
    for px in (gx0 - 4, gx1 + 1):
        c.rect(px, base - 32, 3, 33, stone[3] if px < x else stone[1])
        for y in range(base - 30, base, 6):
            c.set(px + 1, y, gold[2])
    flame(c, x + 5, base - 2, 14, fire)
    flame(c, x - 2, base - 2, 9, fire)
    flame(c, x + 12, base - 2, 8, fire)
    c.rect(gx0 + 2, base - 4, gx1 - gx0 - 4, 2, metal[1])
    lights.append((x + 5, base - 10, 22))
    lights += dwarf_face(c, x + 5, base - 66, 1, stone, gold)
    # poutres effondrées
    c.line(x + 24, base - 40, x + 44, base - 6, '#3a2418', 3)
    c.line(x + 24, base - 41, x + 44, base - 7, '#5a3a24', 1)
    c.line(x + 30, base - 24, x + 52, base - 30, '#2a1a12', 2)
    # éboulis
    for bx, bw, bh in ((x + 40, 12, 9), (x + 50, 10, 7), (x + 33, 8, 6), (x - 50, 8, 5)):
        c.ellipse(bx, base - bh / 2, bw / 2 + 0.8, bh / 2 + 0.8, stone[0])
        c.shaded_ellipse(bx, base - bh / 2, bw / 2, bh / 2, stone[1:])
    return lights


def giant_hammer(c, x, base, wood, metal, gold):
    c.line(x, base, x + 14, base - 40, wood[2], 3)
    c.line(x - 1, base, x + 13, base - 40, wood[3], 1)
    hx, hy = x + 15, base - 44
    c.poly([(hx - 11, hy - 3), (hx + 9, hy - 9), (hx + 12, hy - 1), (hx - 8, hy + 5)], metal[1])
    c.poly([(hx - 11, hy - 3), (hx + 9, hy - 9), (hx + 10, hy - 6), (hx - 10, hy)], metal[2])
    c.line(hx - 11, hy - 3, hx + 9, hy - 9, metal[3])
    c.line(hx - 3, hy - 6, hx, hy + 3, gold[2], 2)


def crucible(c, x, base, metal, lava):
    c.poly([(x - 7, base - 9), (x + 7, base - 9), (x + 5, base), (x - 5, base)], metal[1])
    c.poly([(x - 7, base - 9), (x - 1, base - 9), (x - 2, base), (x - 5, base)], metal[2])
    c.ellipse(x, base - 9, 7, 1.5, lava[2]); c.ellipse(x - 1, base - 9.5, 4, 0.8, lava[3])
    c.line(x - 8, base - 9, x - 10, base - 12, metal[2]); c.line(x + 8, base - 9, x + 10, base - 12, metal[1])
    return [(x, base - 10, 9)]


# ====================================================================== néant

GLYPHS = [
    '00100 01110 10101 00100 00100', '10001 01010 00100 01010 10001', '11111 10000 11110 00001 11111',
    '01010 11111 01010 11111 01010', '00100 01010 10001 01010 00100', '10101 01110 11011 01110 10101',
    '11100 10100 11111 00101 00111', '01110 10001 10101 10001 01110',
]


def rune(c, x, y, i, col, only_on=True):
    g = GLYPHS[i % len(GLYPHS)].split()
    for yy, row in enumerate(g):
        for xx, v in enumerate(row):
            if v == '1':
                (c.setf if only_on else c.set)(x + xx - 2, y + yy - 2, col)


def void_platform(c, cx, top, w, depth, stone, seed, glowc, tiles=True):
    """Plateforme de pierre flottante fissurée : dallage, dessous rocheux en pointe, failles lumineuses.
    Renvoie les points de halo."""
    r = rng(seed)
    hw = w / 2
    lights = []
    notch = r.choice((-1, 1)) * r.uniform(0.6, 0.85)
    for i in range(int(w)):
        x = int(cx - hw + i)
        t = (i + 0.5) / w * 2 - 1
        ty = top + (2 if (t - notch) * (1 if notch > 0 else -1) > 0 and abs(t) > abs(notch) else 0)
        ty += int(abs(t) > 0.94)
        bot = top + 5 + depth * (1 - abs(t) ** 1.3) * (0.6 + 0.4 * (noise1(i * 2.0, 128, seed, 3) + 1) / 2)
        for y in range(ty, int(bot)):
            d = y - ty
            if d == 0:
                col = stone[4]
            elif d < 4 and tiles:
                col = stone[3] if (x - int(cx) + 64) % 9 else stone[1]
                if d == 3:
                    col = stone[1]
            else:
                band = (y - top + int(2 * noise1(x, 64, seed + 2, 2))) // 5
                col = stone[2] if t < -0.3 else stone[1] if t < 0.4 else stone[0]
                if band % 2 and t < 0.4:
                    col = stone[max(0, stone.index(col) - 1)] if t > -0.3 else stone[3]
            c.set(x, y, col)
        if bot - ty > 3:
            c.set(x, int(bot) - 1, stone[0])
    # failles lumineuses
    for _ in range(max(1, int(w / 22))):
        px, py = cx + r.uniform(-hw * 0.6, hw * 0.6), top + 1
        for k in range(r.randint(int(depth * 0.4), int(depth * 0.9) + 1)):
            c.setf(px, py, glowc[1] if k % 3 else glowc[2])
            c.setf(px + 1, py, '#120a22')
            if k % 5 == 2:
                lights.append((px, py, 5))
            py += 1
            px += r.choice((-1, 0, 0, 1))
    # débris sous la plateforme
    for _ in range(int(w / 14)):
        dx = cx + r.uniform(-hw * 0.7, hw * 0.7)
        dy = top + depth + r.uniform(4, 16)
        s = r.uniform(1.5, 3.5)
        c.poly([(dx - s, dy), (dx, dy - s), (dx + s, dy - s * 0.3), (dx + s * 0.4, dy + s)], stone[1])
        c.set(dx - s * 0.4, dy - s * 0.4, stone[3])
    return lights


def obelisk(c, x, base, h, w, stone, glowc, seed, gap=4):
    """Monolithe runique fracturé : la partie haute flotte au-dessus de la cassure."""
    r = rng(seed)
    cut = base - int(h * r.uniform(0.45, 0.6))
    top = base - h
    lights = []
    for y in range(top, base + 1):
        k = (y - top) / h
        hw = w / 2 * (0.62 + 0.38 * k)
        yy = y - gap if y < cut else y
        if y < top + w * 0.6:
            hw = min(hw, (y - top) * 0.9 + 0.5)
        for dx in range(-int(hw), int(hw) + 1):
            s = dx / max(1, hw)
            col = stone[3] if s < -0.4 else stone[2] if s < 0.35 else stone[1]
            c.set(x + dx, yy, col)
        if y == cut:
            for dx in range(-int(hw), int(hw) + 1):
                c.set(x + dx, yy - 1 - (dx * 7 % 3 == 0), stone[0])
    for i, y in enumerate(range(top + int(w * 0.8), base - 3, 7)):
        yy = y - gap if y < cut else y
        if abs(y - cut) < 4:
            continue
        rune(c, x, yy, seed + i, glowc[2])
        lights.append((x, yy, 6))
    for dx in range(-2, 3):
        c.set(x + dx, cut - gap + 1, A(glowc[3], 0.8))
    lights.append((x, cut - gap / 2, w))
    return lights


def reality_shard(c, x, y, s, seed, kind='meadow'):
    """Fragment de réalité : éclat polygonal montrant un autre monde, liseré lumineux."""
    r = rng(seed)
    n = 5
    pts = []
    for i in range(n):
        a = i * 2 * math.pi / n + r.uniform(-0.3, 0.3) - math.pi / 2
        rr = s * r.uniform(0.6, 1.0)
        pts.append((x + math.cos(a) * rr * 0.8, y + math.sin(a) * rr))
    m = Local(int(s * 2 + 6), int(s * 2 + 6))
    ox, oy = x - s - 3, y - s - 3
    m.poly([(px - ox, py - oy) for px, py in pts], '#000000')
    scenes = {
        'meadow': (['#4a90e0', '#8ac4f4', '#cfe8fa'], ['#3f9a3a', '#5cb84a'], '#ffffff'),
        'desert': (['#e86a3a', '#f4a058', '#fad08a'], ['#d89a50', '#f0c070'], '#fff4c0'),
        'sea': (['#2a5aa8', '#4a8ad8', '#9accf4'], ['#2a6ac8', '#5aa8f0'], '#ffffff'),
        'snow': (['#5a8ad8', '#9ac0f0', '#d8ecfc'], ['#d8e6f6', '#ffffff'], '#ffffff'),
    }
    skyc, landc, cl = scenes[kind]
    for my in range(m.h):
        for mx in range(m.w):
            if m.px[my][mx] is None:
                continue
            gx, gy = mx + ox, my + oy
            k = (gy - (y - s)) / (2 * s)
            hill = y + s * 0.25 + math.sin(gx * 0.35 + seed) * s * 0.12
            if gy > hill:
                col = landc[1] if gy < hill + 1.5 else landc[0]
            else:
                col = skyc[min(2, int(k * 3.2))]
            c.set(gx, gy, col)
    c.set(x - s * 0.3, y - s * 0.4, cl); c.set(x - s * 0.3 + 1, y - s * 0.4, cl); c.set(x - s * 0.3 + 1, y - s * 0.4 - 1, cl)
    for my in range(m.h):
        for mx in range(m.w):
            if m.px[my][mx] is None:
                continue
            if any(m.get(mx + dx, my + dy) is None for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                c.set(mx + ox, my + oy, '#f4ecff' if mx + my < m.w else '#c8a8ff')
    return [(x, y, s * 2.2)]


def planet(c, x, y, rr, cols, ring, crack):
    """Planète brisée à anneau (moitié arrière de l'anneau, sphère, faille, moitié avant)."""
    def ring_half(front):
        for i in range(400):
            a = i / 400 * 2 * math.pi
            px, py = x + math.cos(a) * rr * 1.75, y + math.sin(a) * rr * 0.38
            if (math.sin(a) > 0) != front:
                continue
            for k in range(3):
                c.set(px, py + k - 1, ring[k] if front else ring[max(0, k - 1)])
    ring_half(False)
    for yy in range(int(y - rr) - 1, int(y + rr) + 2):
        for xx in range(int(x - rr) - 1, int(x + rr) + 2):
            dx, dy = (xx + 0.5 - x) / rr, (yy + 0.5 - y) / rr
            d = dx * dx + dy * dy
            if d > 1:
                continue
            nz = math.sqrt(1 - d)
            v = (-dx * 0.6 - dy * 0.7) * 0.7 + nz * 0.5
            band = int((dy + 0.12 * math.sin(dx * 5)) * 6) % 2
            idx = max(0, min(len(cols) - 1, int((v + 0.3) / 1.3 * len(cols)) - band))
            c.set(xx, yy, cols[idx])
    px, py = x - rr * 0.1, y - rr
    r = rng(int(x))
    while py < y + rr:
        c.setf(px, py, crack[0]); c.setf(px + 1, py, crack[1])
        py += 1
        px += r.choice((-1, 0, 1, 1))
    ring_half(True)
    return [(x, y, rr * 1.6)]


# ====================================================================== abysse


def black_column(c, x, top, base, w, stone, trim, ornament=True):
    """Colonne massive de pierre noire : chapiteau à cornes, fût cannelé, socle à degrés."""
    for y in range(top + 8, base - 6):
        for i in range(w):
            k = i / max(1, w - 1)
            col = stone[3] if k < 0.18 else stone[2] if k < 0.62 else stone[1]
            if i % 4 == 3 and 0.1 < k < 0.9:
                col = stone[max(0, stone.index(col) - 1)]
            c.set(x - w // 2 + i, y, col)
        if (y - top) % 24 == 0:
            c.rect(x - w // 2, y, w, 2, trim[1]); c.set(x - w // 2, y, trim[2])
    for k in range(3):
        ww = w + 6 - k * 2
        c.rect(x - ww // 2, base - 6 + k * 2, ww, 2, stone[2])
        c.rect(x - ww // 2, base - 6 + k * 2, ww, 1, stone[3])
    c.rect(x - w // 2 - 4, top, w + 8, 4, stone[2]); c.rect(x - w // 2 - 4, top, w + 8, 1, stone[3])
    c.rect(x - w // 2 - 2, top + 4, w + 4, 4, stone[1]); c.rect(x - w // 2 - 2, top + 6, w + 4, 1, trim[1])
    if ornament and w > 12:
        c.ellipse(x, top + 6, 3, 3, stone[3]); c.set(x - 1, top + 6, '#ff3a1a'); c.set(x + 1, top + 6, '#ff3a1a')
        c.rect(x - 1, top + 8, 3, 1, stone[0])
        return [(x, top + 6, 4)]
    return []


def hang_banner(c, x, y0, L, w, cloth, trim, emblem='horns'):
    """Longue bannière suspendue : tringle dorée, plis, galons, queue d'aronde, emblème."""
    c.rect(x - w // 2 - 3, y0, w + 6, 2, trim[1]); c.rect(x - w // 2 - 3, y0, w + 6, 1, trim[2])
    c.set(x - w // 2 - 4, y0, trim[2]); c.set(x + w // 2 + 3, y0, trim[0])
    for yy in range(L):
        for i in range(w):
            if yy > L - w * 0.6 and abs(i - (w - 1) / 2) < (yy - (L - w * 0.6)) * 0.9:
                continue
            f = math.sin(i / w * math.pi * 2.6 + 0.4)
            col = cloth[3] if f > 0.6 else cloth[2] if f > -0.3 else cloth[1]
            if i == 0 or i == w - 1:
                col = trim[1]
            if yy in (3, 4) or yy in (L - int(w * 0.6) - 3,):
                col = trim[2] if yy == 3 else trim[0]
            c.set(x - w // 2 + i, y0 + 2 + yy, col)
    ex, ey = x, y0 + 2 + int(L * 0.32)
    if emblem == 'horns':
        horn(c, (ex - 1, ey + 1), (ex - 5, ey), (ex - 4, ey - 5), 1.0, 0.4, trim)
        horn(c, (ex + 1, ey + 1), (ex + 5, ey), (ex + 4, ey - 5), 1.0, 0.4, trim)
        c.ellipse(ex, ey + 2, 2.5, 2.5, trim[2]); c.set(ex - 1, ey + 2, cloth[0]); c.set(ex + 1, ey + 2, cloth[0])
        c.set(ex, ey + 4, trim[1])
    else:  # oeil
        c.ellipse(ex, ey, 4, 2, trim[2]); c.ellipse(ex, ey, 1.6, 1.6, cloth[0]); c.set(ex, ey, '#ffd060')


def gothic_window(c, x, top, w, h, stone, glass):
    """Grande baie en ogive, verrière rougeoyante, remplage (meneau, rosace)."""
    spring = top + w * 0.85
    def inside(xx, yy, ww):
        dx = xx + 0.5 - x
        if yy + 0.5 >= spring:
            return abs(dx) <= ww / 2 and yy < top + h
        return (dx + ww / 2) ** 2 + (yy + 0.5 - spring) ** 2 <= ww ** 2 and (dx - ww / 2) ** 2 + (yy + 0.5 - spring) ** 2 <= ww ** 2
    for yy in range(top - 3, top + h + 2):
        for xx in range(int(x - w / 2) - 4, int(x + w / 2) + 5):
            if inside(xx, yy, w + 6) and not inside(xx, yy, w):
                c.set(xx, yy, stone[3] if xx < x else stone[1])
            elif inside(xx, yy, w):
                k = (yy - top) / h
                c.set(xx, yy, glass[min(len(glass) - 1, int(k * len(glass)))])
    for yy in range(int(spring - w * 0.2), top + h):
        c.set(x, yy, stone[2]); c.set(x - 1, yy, stone[3])
    for yy in range(int(spring + 6), top + h, 9):
        for xx in range(int(x - w / 2), int(x + w / 2) + 1):
            if inside(xx, yy, w):
                c.set(xx, yy, stone[2])
    rr = w * 0.22
    cy = spring - w * 0.35
    for i in range(36):
        a = i / 36 * 2 * math.pi
        c.set(x + math.cos(a) * rr, cy + math.sin(a) * rr, stone[2])
    for i in range(4):
        a = i * math.pi / 4
        c.line(x - math.cos(a) * rr, cy - math.sin(a) * rr, x + math.cos(a) * rr, cy + math.sin(a) * rr, stone[1])
    return [(x, top + h * 0.6, w * 1.3)]


def throne(c, x, base, stone, gold, cloth, eye):
    """Trône colossal : marches, dossier ogival hérissé, cornes, accoudoirs à crânes, gemme ardente."""
    for i in range(6):
        w = 120 - i * 14
        y = base - i * 5
        c.rect(x - w // 2, y - 5, w, 5, stone[2])
        c.rect(x - w // 2, y - 5, w, 1, stone[3])
        c.rect(x + w // 2 - 10, y - 4, 10, 4, stone[1])
        c.rect(x - w // 2, y - 1, w, 1, stone[0])
    for i in range(6):
        c.rect(x - 7, base - 5 - i * 5, 14, 4, cloth[2] if i % 2 else cloth[1])
        c.rect(x - 7, base - 5 - i * 5, 14, 1, cloth[3])
    seat = base - 30
    top = base - 150
    back = [(x - 22, seat), (x - 22, top + 40), (x - 14, top + 22), (x, top), (x + 14, top + 22), (x + 22, top + 40), (x + 22, seat)]
    for side in (-1, 1):
        horn(c, (x + side * 16, top + 44), (x + side * 46, top + 40), (x + side * 40, top + 2), 5.5, 1.0, stone)
    c.poly(back, stone[2])
    c.poly([(x - 22, seat), (x - 22, top + 40), (x - 14, top + 22), (x, top), (x - 12, seat)], stone[3])
    c.poly([(x + 14, seat), (x + 22, seat), (x + 22, top + 40), (x + 16, top + 26)], stone[1])
    for side in (-1, 1):
        for k in range(6):
            sy = top + 30 + k * 16
            c.poly([(x + side * 22, sy), (x + side * 31, sy - 6), (x + side * 22, sy + 5)], stone[3] if side < 0 else stone[1])
    inner = [(x - 13, seat - 4), (x - 13, top + 46), (x - 7, top + 34), (x, top + 24), (x + 7, top + 34), (x + 13, top + 46), (x + 13, seat - 4)]
    c.poly(inner, gold[1])
    c.poly([(px * 0.86 + x * 0.14, py + 3 if py < seat - 10 else py - 1) for px, py in inner], cloth[2])
    for yy in range(top + 40, seat - 6, 6):
        for xx in range(x - 9, x + 10, 6):
            c.setf(xx, yy, cloth[3]); c.setf(xx + 1, yy + 1, cloth[1])
    c.ellipse(x, top + 18, 5, 5, gold[2]); c.ellipse(x, top + 18, 3.2, 3.2, eye[0]); c.ellipse(x - 0.5, top + 17.5, 1.6, 1.6, eye[2])
    c.rect(x - 26, seat - 2, 52, 8, stone[2]); c.rect(x - 26, seat - 2, 52, 1, stone[3])
    c.rect(x - 14, seat - 4, 28, 3, cloth[2]); c.rect(x - 14, seat - 4, 28, 1, cloth[3])
    for side in (-1, 1):
        ax = x + side * 30
        c.rect(ax - 6, seat - 14, 12, 20, stone[2] if side < 0 else stone[1])
        c.rect(ax - 6, seat - 14, 12, 1, stone[3])
        c.shaded_ellipse(ax, seat - 18, 6, 5, ['#6a5a50', '#a89a88', '#d8ccb8', '#f0e8d8'])
        c.ellipse(ax - 2, seat - 18, 1.5, 1.5, '#1a0606'); c.ellipse(ax + 2, seat - 18, 1.5, 1.5, '#1a0606')
        c.set(ax - 2, seat - 18, eye[1]); c.set(ax + 2, seat - 18, eye[1])
        c.rect(ax - 3, seat - 14, 6, 2, '#a89a88')
    c.line(x - 22, top + 40, x, top, gold[3]); c.line(x, top, x + 22, top + 40, gold[1])
    return [(x, top + 18, 18), (x - 32, seat - 18, 6), (x + 28, seat - 18, 6)]


def hooded_statue(c, x, base, h, stone, eye, sword):
    """Statue de gardien encapuchonné, mains sur la garde d'une épée plantée."""
    c.rect(x - 14, base - 8, 28, 8, stone[2]); c.rect(x - 14, base - 8, 28, 1, stone[3]); c.rect(x + 6, base - 7, 8, 7, stone[1])
    b = base - 8
    c.poly([(x - 13, b), (x - 9, b - h * 0.7), (x, b - h * 0.78), (x + 9, b - h * 0.7), (x + 13, b)], stone[2])
    c.poly([(x - 13, b), (x - 9, b - h * 0.7), (x - 3, b - h * 0.75), (x - 5, b)], stone[3])
    c.poly([(x + 4, b), (x + 7, b - h * 0.68), (x + 13, b)], stone[1])
    for k in range(3):
        c.line(x - 6 + k * 5, b - h * 0.55, x - 7 + k * 6, b, stone[1])
    hy = b - h * 0.82
    c.shaded_ellipse(x, hy, 8, 9, stone)
    c.poly([(x - 8, hy + 2), (x, hy + 9), (x + 8, hy + 2), (x + 9, hy + 10), (x - 9, hy + 10)], stone[2])
    c.ellipse(x + 0.5, hy + 2, 4.5, 5, '#0a0406')
    c.set(x - 1, hy + 1, eye[2]); c.set(x + 2, hy + 1, eye[2])
    c.rect(x - 1, b - h * 0.5, 3, h * 0.5, sword[2]); c.rect(x, b - h * 0.5, 1, h * 0.5, sword[3])
    c.rect(x - 6, b - h * 0.5 - 2, 13, 2, sword[1])
    c.rect(x - 1, b - h * 0.62, 3, h * 0.12, '#3a2418')
    c.shaded_ellipse(x, b - h * 0.58, 5, 3, stone)
    return [(x - 1, hy + 1, 4), (x + 2, hy + 1, 4)]


def spike_rail(c, x0, length, base, h, metal, stone):
    """Balustrade de pierre noire et grille de fer hérissée."""
    for x in range(x0, x0 + length):
        c.set(x, base - h, metal[2]); c.set(x, base - h + 1, metal[0])
        c.set(x, base - 3, metal[1])
    for px in range(x0, x0 + length, 4):
        for y in range(base - h - 3, base):
            c.set(px, y, metal[2] if y < base - h else metal[1])
        c.set(px, base - h - 4, metal[3]); c.set(px - 1, base - h - 2, metal[1]); c.set(px + 1, base - h - 2, metal[1])
    for px in (x0, x0 + length - 1):
        c.rect(px - 3, base - h - 6, 7, h + 6, stone[2]); c.rect(px - 3, base - h - 6, 2, h + 6, stone[3])
        c.rect(px - 4, base - h - 8, 9, 2, stone[3])
        c.poly([(px - 3, base - h - 8), (px, base - h - 14), (px + 3, base - h - 8)], stone[1])
        c.set(px - 1, base - h - 10, stone[3])


def skull_pile(c, x, base, bone, n=5, seed=0):
    r = rng(seed)
    pos = [(0, 0), (-5, 0), (5, 0), (-2.5, -4), (2.5, -4), (0, -8)][:n]
    for dx, dy in pos:
        sx, sy = x + dx + r.uniform(-0.5, 0.5), base - 3 + dy
        c.shaded_ellipse(sx, sy, 3, 2.8, bone)
        c.set(sx - 1, sy, '#1a0a08'); c.set(sx + 1, sy, '#1a0a08'); c.set(sx, sy + 2, bone[0])


def ceiling_vault(c, bays, stone, rib, seed):
    """Voûte d'ogives : chaque travée descend en ogive sur ses retombées ; nervures claires."""
    r = rng(seed)
    w = c.w
    bw = w / bays
    depth = c.h - 16
    for x in range(w):
        b = (x % bw) / bw
        y_arch = 4 + depth * (1 - math.sqrt(max(0.0, 1 - (abs(b - 0.5) * 2) ** 2)) * 0.9)
        for y in range(int(y_arch) + 1):
            col = stone[1] if (y // 5 + (x // 9)) % 2 else stone[0]
            if y > y_arch - 4:
                col = rib[2] if y > y_arch - 2 else rib[3]
            c.set(x, y, col)
        if abs(b - 0.5) < 0.012:
            for y in range(0, int(y_arch)):
                c.set(x, y, rib[2])
    for i in range(bays):
        kx = int(i * bw + bw / 2)
        c.ellipse(kx, 8, 3.5, 3.5, rib[2]); c.set(kx - 1, 7, rib[3])
        hanging_chain(c, kx, 11, r.randint(12, 30), ['#2a2024', '#4a3c40', '#6a5a5c'])
        sx = int(i * bw)
        for k in range(8):
            c.set(sx, c.h - 16 + k, rib[1]); c.set(sx + 1, c.h - 16 + k, rib[1]); c.set(sx - 1, c.h - 16 + k, rib[2])


# ====================================================================== zones


def zone_swamp():
    sky = ['#121c1a', '#203628', '#3a5638', '#7a8e52']
    hz = '#5a7a4a'
    moss = R('#7a8a52', 5, 0.28, 0.06)
    shroom_a = R('#3ae8b8', 4, 0.32, 0.02)
    shroom_b = R('#b46af0', 4, 0.32, 0.02)
    stem = ['#8a9a88', '#c8d8c0', '#eef8e8']
    out = []
    mn = Wrap(512, 70)
    glow(mn, 360, 26, 30, '#c8e8a0', a=0.22)
    mn.shaded_ellipse(360, 26, 11, 11, ['#9ab47a', '#c0d49a', '#dce8b8', '#f0f6d8'], light=(-0.6, -0.8))
    mn.ellipse(357, 23, 2, 1.5, '#b0c88c'); mn.ellipse(363, 29, 2.5, 2, '#b0c88c'); mn.set(361, 21, '#b0c88c')
    out.append(L('moon', mn, 0.01, 0, 'top'))
    sk = Wrap(512, 90)
    r = rng(701)
    for i in range(9):
        streak_cloud(sk, i * 57 + r.randint(0, 30), r.randint(8, 70), r.randint(40, 90), ['#24382c', '#3a523a'], 700 + i)
    out.append(L('clouds', sk, 0.03, 0, 'top', drift=1))

    far = Wrap(512, 130); GB = 128
    ridge(far, GB - 30, 7, R('#24382a', 5, 0.12), 702)
    barkf = R('#2a3a2c', 4, 0.1)
    for x in range(10, 512, 34):
        h = r.randint(36, 70)
        twisted_tree(far, x + r.randint(0, 14), GB - 26, h, barkf, R('#3a4e36', 4, 0.12), 710 + x, moss_p=0.6)
    ridge(far, GB - 18, 4, R('#203426', 5, 0.1), 703)
    haze(far, '#4a6a48', 0.45, 0.6)
    fog_band(far, GB - 34, GB - 12, '#8aa878', 0.4, 704)
    out.append(L('far', far, 0.06, -GB))

    fm = Wrap(512, 124); GB = 122
    swamp_water(fm, 0, 512, GB - 20, GB, 705)
    bark = R('#4a4434', 5, 0.24, 0.04)
    mound = R('#3a5232', 5, 0.24)
    lights = []
    for x, w in [(60, 50), (190, 40), (440, 56)]:
        fm.ellipse(x, GB - 20, w / 2, 4, mound[1])
        fm.ellipse(x - 2, GB - 21, w / 2 - 3, 2.4, mound[2])
        for xx in range(int(x - w / 2 + 3), int(x + w / 2 - 3)):
            if (xx * 7) % 3:
                fm.set(xx, GB - 24, mound[3])
    for x, h in [(48, 74), (200, 60), (430, 84), (470, 50)]:
        lights += place(fm, x, GB - 21, 90, h + 20, twisted_tree, h, bark, moss, 720 + x, moss_p=0.9)
    lights += place(fm, 320, GB - 17, 60, 60, stilt_hut, R('#6a4a30', 4, 0.26), R('#8a7a48', 4, 0.26),
                    ['#c87a20', '#ffc050', '#fff0b0'], R('#3a3a40', 3, 0.2), ['#e8a030', '#ffd060', '#fff4c0'])
    for x in range(10, 512, 26):
        lily(fm, x + r.randint(0, 12), GB - 15 + r.randint(0, 9), R('#4a8a3a', 4, 0.3), '#e8a0c8' if r.random() < 0.25 else None)
    for x in (110, 150, 250, 380):
        reeds(fm, x, GB - 18, 16, R('#5a7a3a', 4, 0.26), R('#5a3a24', 3, 0.2), x, n=5)
    glows = []
    for x, cols in [(64, shroom_a), (186, shroom_b), (446, shroom_a)]:
        glows += [(a, b, rr, cols[2]) for a, b, rr in place(fm, x + 8, GB - 23, 24, 16, shroom_cluster, 3, cols, stem, x)]
    haze(fm, hz, 0.32, 0.18)
    for x, y, rr in lights:
        glow(fm, x, y, rr, '#ffc050', a=0.35)
    for x, y, rr, col in glows:
        glow(fm, x, y, rr, col, a=0.32)
    fog_band(fm, GB - 30, GB - 8, '#a8c890', 0.32, 706)
    out.append(L('marsh', fm, 0.18, -GB))

    mid = Wrap(512, 150); GB = 148
    swamp_water(mid, 0, 512, GB - 9, GB, 730)
    barkm = R('#54483a', 5, 0.3, 0.05)
    mossm = R('#86985a', 5, 0.3, 0.06)
    lights, glows = [], []
    for x, h, k in [(70, 132, True), (250, 112, False), (400, 138, False)]:
        lights += place(mid, x, GB - 7, 150, 150, twisted_tree, h, barkm, mossm, 731 + x, spread=1.15, moss_p=1.0, knot=k,
                        fungus=shroom_a)
    for x, h in [(170, 60), (330, 48), (490, 66)]:
        lights += place(mid, x, GB - 7, 80, h + 16, twisted_tree, h, barkm, mossm, 740 + x, moss_p=0.8)
    for x in range(0, 512, 15):
        lily(mid, x + r.randint(0, 6), GB - 4 + r.randint(0, 2), R('#56a040', 4, 0.3), '#f080b0' if r.random() < 0.25 else None)
    for x in (120, 210, 300, 460):
        place(mid, x, GB - 7, 24, 30, reeds, 22, R('#5e843c', 4, 0.28), R('#5a3a24', 3, 0.24), x, n=7)
    for x, cols in [(36, shroom_b), (106, shroom_a), (284, shroom_b), (436, shroom_a)]:
        glows += [(a, b, rr, cols[2]) for a, b, rr in place(mid, x, GB - 7, 26, 18, shroom_cluster, 4, cols, stem, x)]
    haze(mid, hz, 0.1, 0.16)
    for x, y, rr in lights:
        glow(mid, x, y, rr, '#9af0c8', a=0.32)
    for x, y, rr, col in glows:
        glow(mid, x, y, rr, col, a=0.32)
    for _ in range(12):
        x, y = r.randint(0, 511), r.randint(30, GB - 30)
        glow(mid, x, y, 3.5, '#a8f070', a=0.35, rings=2)
        mid.set(x, y, '#e8ffc0')
    out.append(L('trees', mid, 0.4, -GB))

    fg = Wrap(512, 40)
    fog_band(fg, 6, 34, '#9ac880', 0.28, 750)
    fog_band(fg, 18, 40, '#b8e098', 0.2, 751)
    out.append(L('fog', fg, 0.55, -36, drift=4))

    near = Wrap(384, 64); GB = 62
    wood = R('#6a4a30', 4, 0.3)
    metal = R('#3a3a40', 3, 0.2)
    light = ['#e8a030', '#ffd060', '#fff4c0']
    lights = place(near, 180, GB, 28, 44, lantern_post, 36, wood, metal, light)
    lights = [(x, y, 9) for x, y in lights]
    place(near, 60, GB, 30, 20, stump, 14, 11, R('#5a4a38', 4, 0.3), mossm, 760)
    place(near, 300, GB, 24, 16, stump, 10, 7, R('#5a4a38', 4, 0.3), mossm, 761)
    for x in (20, 120, 240, 350):
        place(near, x, GB, 26, 34, reeds, 24, R('#5a8a3a', 4, 0.3), R('#5a3a24', 3, 0.26), x, n=7)
    glows = []
    for x, cols in [(90, shroom_a), (210, shroom_b), (330, shroom_a)]:
        glows += [(a, b, rr, cols[2]) for a, b, rr in place(near, x, GB, 24, 16, shroom_cluster, 3, cols, stem, x + 3)]
    place(near, 268, GB, 40, 52, twisted_tree, 40, barkm, mossm, 762, moss_p=1.0)
    for x, y, rr in lights:
        glow(near, x, y, rr, '#ffd060', a=0.4)
    for x, y, rr, col in glows:
        glow(near, x, y, rr, col, a=0.34)
    out.append(L('near', near, 0.7, -GB))

    g = block_ground(256, 770, R('#5e8a3c', 5, 0.28, 0.06), R('#4a5240', 5, 0.24), '#0a100a', 'moss')
    out.append(L('ground', g, 1.0, -8))

    def reed(c, x, base, r):
        reeds(c, x + 4, base, r.randint(8, 13), R('#3e6a2c', 4, 0.26), R('#4a3020', 3, 0.2), r.randint(0, 999), n=3)
    out.append(L('front', front_strip(320, 771, 'moss', R('#2a4a24', 5, 0.28), extra=reed), 1.25, 7, front=True))
    return sky, '#0a100a', out


def zone_sky():
    sky = ['#2a66d8', '#5294f0', '#94c6f8', '#e2f2ff']
    hz = '#d8ecfc'
    cloudc = ['#a8c4e8', '#d0e2f6', '#eef6fe', '#ffffff']
    marble = R('#d8d4e8', 5, 0.2)
    gold = R('#e0aa34', 5, 0.3, 0.05)
    grass = R('#5cbc44', 5, 0.3, 0.07)
    rockc = R('#8a84a8', 5, 0.26)
    roots = R('#6a5a3a', 3, 0.2)
    wf = ['#5a9ad8', '#8cc4ee', '#c4e4fa', '#ffffff']
    out = []
    sn = Wrap(512, 140)
    sun_rays(sn, 120, 20, '#fff8d8', 6, 801, length=150, a=0.12)
    sun(sn, 120, 20, 12, ['#fff4c0', '#ffe8a0', '#fff6d0', '#ffffff'])
    out.append(L('sun', sn, 0.01, 0, 'top'))
    out.append(L('clouds', clouds_layer(512, 80, cloudc, 802, n=6, ymin=14, ymax=56), 0.03, 4, 'top', drift=3))

    far = Wrap(512, 160); GB = 158
    r = rng(803)
    rockf = R('#8a9ac8', 5, 0.2)
    grassf = R('#7ab8a0', 5, 0.2)
    for x, top, w, d in [(40, 70, 40, 30), (150, 50, 26, 22), (250, 84, 50, 34), (370, 46, 34, 26), (460, 78, 44, 30)]:
        tops = sky_island(far, x, top, w, d, grassf, rockf, 804 + x)
        if w > 38:
            place(far, x, top - 1, 50, 40, temple, 0.45, R('#c8d0ec', 5, 0.2), R('#d8b060', 5, 0.24), dome=w > 45, ncol=4)
        else:
            for k in range(2):
                place(far, x - 6 + k * 12, top - 1, 16, 16, round_tree, 7, R('#5aa070', 5, 0.2), R('#6a5a4a', 4, 0.2), x + k, roots=False, tk=0.35)
        void_fall(far, x + w * 0.28, top + 1, 34, 2, ['#8ab0d8', '#a8c8ec', '#d8ecfa', '#ffffff'], x)
    cloud_sea(far, GB - 30, 805, ['#a8c0e4', '#c8dcf2', '#e6f0fc', '#f8fcff'], step=22, rmin=12, rmax=22)
    haze(far, '#c8e0f8', 0.45, 0.25)
    out.append(L('far', far, 0.05, -GB))

    fm = Wrap(512, 150); GB = 148
    lights = []
    isl = [(70, 62, 70, 40), (230, 84, 56, 30), (360, 50, 90, 46), (480, 92, 40, 26)]
    for x, top, w, d in isl:
        sky_island(fm, x, top, w, d, grass, rockc, 810 + x, roots=roots)
    lights += place(fm, 360, 49, 70, 64, temple, 0.95, marble, gold)
    lights += place(fm, 70, 61, 60, 60, temple, 0.6, marble, gold, dome=True, ncol=4)
    for x, top, s in [(40, 62, 10), (100, 62, 9), (215, 84, 11), (248, 84, 9), (322, 50, 10), (402, 50, 11), (480, 92, 9)]:
        place(fm, x, top - 1, s * 2 + 8, s * 2 + 10, round_tree, s, R('#4aa84a', 5, 0.3, 0.06), R('#7a5432', 4, 0.24), x + 7, roots=False, tk=0.4)
    for x, top, w, k in [(70, 62, 70, 0.3), (230, 84, 56, -0.2), (360, 50, 90, 0.36), (360, 50, 90, -0.3)]:
        void_fall(fm, x + w * k, top + 1, 70, 4, wf, x + int(k * 100))
    hang_bridge(fm, 104, 62, 202, 83, 8, R('#8a6038', 4, 0.3), ['#8a7050', '#c8a878'])
    hang_bridge(fm, 258, 83, 316, 50, 6, R('#8a6038', 4, 0.3), ['#8a7050', '#c8a878'])
    for x, y in ((160, 110), (300, 30), (440, 120), (20, 28)):
        sky_island(fm, x, y, 14, 10, grass, rockc, 820 + x)
    cloud_sea(fm, GB - 16, 815, ['#b4cce8', '#d4e4f6', '#eef6fe', '#ffffff'], step=26, rmin=14, rmax=24)
    haze(fm, hz, 0.3, 0.1)
    for x, y, rr in lights:
        glow(fm, x, y, rr, '#fff0b0', a=0.35)
    out.append(L('islands', fm, 0.16, -GB))

    mid = Wrap(512, 150); GB = 148
    lights = []
    isl = [(130, 70, 150, 54), (400, 40, 110, 50)]
    for x, top, w, d in isl:
        sky_island(mid, x, top, w, d, grass, rockc, 830 + x, roots=roots)
    lights += place(mid, 150, 69, 100, 90, temple, 1.35, marble, gold, ncol=6)
    lights += place(mid, 400, 39, 70, 70, temple, 0.85, marble, gold, dome=True, ncol=4)
    for x, top in [(76, 70), (204, 70), (354, 40), (446, 40)]:
        place(mid, x, top - 1, 44, 46, round_tree, 18, R('#46a848', 5, 0.32, 0.07), R('#7a5432', 4, 0.26), x + 9, roots=False)
    for x, top in [(66, 70), (96, 70), (190, 70), (366, 40), (430, 40)]:
        bush(mid, x, top - 1, 14, 8, R('#3e9a40', 5, 0.3), x)
        foliage(mid, x + 6, top - 4, 3, 2, R('#f0a0c8', 4, 0.2), x, n=3)
    void_fall(mid, 196, 71, 72, 6, wf, 840)
    void_fall(mid, 62, 71, 76, 5, wf, 841)
    void_fall(mid, 430, 41, 96, 5, wf, 842)
    hang_bridge(mid, 210, 69, 350, 40, 10, R('#8a6038', 4, 0.3), ['#8a7050', '#c8a878'])
    for x, y, w in ((290, 110, 18), (500, 104, 20), (20, 120, 16)):
        sky_island(mid, x, y, w, 12, grass, rockc, 850 + x)
    for x in (270, 300, 330, 490, 10):
        cloud(mid, x, GB - 6, r.randint(40, 60), ['#c4d8f0', '#dceaf8', '#f2f8fe', '#ffffff'], 860 + x)
    haze(mid, hz, 0.12, 0.05)
    for x, y, rr in lights:
        glow(mid, x, y, rr, '#fff0b0', a=0.35)
    out.append(L('temples', mid, 0.4, -GB))

    near = Wrap(384, 64); GB = 62
    fire = ['#e8a020', '#ffd050', '#fff4b0', '#ffffff']
    lights = []
    for x, h, br in [(40, 46, False), (200, 30, True), (330, 50, False), (250, 18, True)]:
        place(near, x, GB, 16, h + 6, marble_column, h, marble, gold, broken=br, seed=x)
    for x in (130, 290):
        lights += place(near, x, GB, 20, 40, gold_brazier, 22, marble, gold, fire)
    for x in (90, 360):
        place(near, x, GB, 30, 48, banner, 40, R('#f0f0fa', 4, 0.18), gold[1:4], R('#8a6038', 4, 0.3), emblem='sun')
    place(near, 170, GB, 16, 18, urn, gold)
    place(near, 222, GB, 14, 10, rock, 9, 5, marble[1:])
    for x in (10, 70, 150, 270, 310):
        place(near, x, GB, 20, 14, bush, 15, 9, R('#44a844', 5, 0.3), x)
        foliage(near, x + 3, GB - 7, 2, 1.5, R('#f8b0d0', 4, 0.2), x, n=2)
    for x, y, rr in lights:
        glow(near, x, y, rr, '#fff0b0', a=0.38)
    out.append(L('near', near, 0.7, -GB))

    g = block_ground(256, 870, R('#5cc044', 5, 0.3, 0.07), R('#c4c0d8', 5, 0.24), '#2a2c4a', 'grass',
                     mortar='#8a86a8', flower_cols=['#ffffff', '#ffe066', '#f8a0d0'])
    out.append(L('ground', g, 1.0, -8))
    out.append(L('front', front_strip(320, 871, 'grass', R('#3a8a34', 5, 0.3)), 1.25, 7, front=True))
    return sky, '#2a2c4a', out


def zone_volcano():
    sky = ['#120808', '#30120c', '#62200e', '#b44c16']
    hz = '#8a2c12'
    lavac = ['#c8300c', '#ff7a18', '#ffc040', '#fff0a0']
    fire = ['#c8200c', '#ff6a14', '#ffc030', '#fff4b0']
    obs = ['#0a0810', '#131019', '#1c1826', '#2a2538', '#7a70a0']  # obsidienne : noir vitreux, arêtes claires
    magma = R('#ff5a1a', 5, 0.3, 0.02)
    stone = R('#5a4a48', 5, 0.24)
    gold = R('#d89a34', 5, 0.3)
    metal = R('#4a4450', 4, 0.26)
    out = []
    sm = Wrap(512, 110)
    r = rng(901)
    for i in range(6):
        cloud(sm, i * 86 + r.randint(0, 30), r.randint(20, 60), r.randint(56, 90), ['#1c1214', '#2c1c1c', '#3e2a26', '#5a3a2e'], 902 + i)
    for i in range(6):
        streak_cloud(sm, i * 86 + 40 + r.randint(0, 30), r.randint(70, 100), r.randint(50, 80), ['#4a1c12', '#6a2a16'], 910 + i)
    out.append(L('smoke', sm, 0.03, 0, 'top', drift=1.5))

    far = Wrap(512, 250); GB = 248
    peaks(far, GB - 40, 22, R('#3a1c1a', 5, 0.14), ['#4a2018', '#5a2818', '#6a3018'], 920, -999)
    lights = volcano_cone(far, 256, GB - 18, 320, 112, R('#3e2424', 5, 0.2), lavac, 921)
    cy0 = GB - 18 - 112
    puffs = []
    for i in range(18):
        t = i / 17
        puffs.append((256 + t * t * 70 + math.sin(i * 1.7) * (3 + t * 10), cy0 - 6 - t * 118, 8 + t * 24 + r.uniform(-2, 2), t))
    for px, py, rr, t in puffs[::-1]:
        cols = ['#1e1214', '#2e1e1e', '#42302a', '#5a4236'] if t > 0.16 else ['#4a1c12', '#7a2c14', '#b0461a', '#e0782a']
        far.shaded_ellipse(px, py, rr, rr * 0.7, cols, light=(-0.6, -0.8))
        if 0.3 < t < 0.6:
            for k in range(int(rr * 1.4)):
                far.setf(px - rr * 0.7 + k, py + rr * 0.55, '#7a2c14')
    ridge(far, GB - 18, 5, R('#2a1414', 5, 0.12), 922, sharp=True)
    haze(far, '#7a2a14', 0.36, 0.5)
    for x, y, rr in lights:
        glow(far, x, y, rr, '#ff7a20', a=0.3)
    for k in range(10):
        bx, by = 256 + r.uniform(-60, 60), GB - 140 - r.uniform(0, 50)
        far.set(bx, by, '#ffd060'); far.set(bx, by + 1, '#ff7a20'); far.set(bx - 1 if bx < 256 else bx + 1, by + 2, '#a03010')
    out.append(L('far', far, 0.05, -GB))

    ash = Wrap(512, 150)
    for _ in range(260):
        x, y = r.randint(0, 511), r.randint(0, 149)
        ash.set(x, y, A(r.choice(('#8a7a72', '#6a5a56', '#a89890')), r.choice((0.5, 0.75))))
    for _ in range(26):
        x, y = r.randint(0, 511), r.randint(0, 149)
        ash.set(x, y, '#ffb040'); ash.set(x + 1, y, A('#ff6a14', 0.6))
    out.append(L('ash', ash, 0.08, 0, 'top', drift=7))

    fm = Wrap(512, 134); GB = 132
    lava_flow(fm, 0, 512, GB - 18, GB, 930)
    glows = []
    for x, w, h in [(40, 56, 74), (150, 40, 50), (300, 70, 92), (440, 50, 64)]:
        place(fm, x, GB - 16, w + 16, h + 10, obsidian_spires, w, h, obs, x, veins=lavac)
    for x, y0 in [(44, 66), (306, 84)]:
        waterfall(fm, x, GB - y0, GB - 16, 6, lavac, x)
        glows.append((x + 3, GB - y0 // 2, 16))
    for x, y, h in [(176, GB - 16, 16), (400, GB - 16, 14), (220, GB - 18, 12), (500, GB - 18, 18)]:
        glows += place(fm, x, y, 30, 30, crystal_cluster, h, magma, x)
    for x in range(100, 512, 120):
        stalagmite(fm, x, GB - 16, r.randint(20, 40), obs, w=r.randint(3, 5))
    haze(fm, hz, 0.26, 0.1)
    for x, y, rr in glows:
        glow(fm, x, y, rr * 1.2, '#ff7a20', a=0.32)
    for x in range(0, 512, 18):
        glow(fm, x + r.randint(0, 9), GB - 14, 8, '#ff8a20', a=0.22)
    out.append(L('flows', fm, 0.17, -GB))

    mid = Wrap(512, 134); GB = 132
    ridge(mid, GB - 12, 4, R('#241a20', 5, 0.14), 940)
    lights = []
    lights += place(mid, 190, GB - 8, 130, 120, forge_ruin, stone, gold, metal, fire)
    place(mid, 290, GB - 8, 50, 60, giant_hammer, R('#5a3a24', 4, 0.26), metal, gold)
    lights += place(mid, 270, GB - 8, 30, 20, crucible, metal, lavac)
    for x, w, h in [(40, 40, 70), (390, 36, 84), (470, 30, 54)]:
        place(mid, x, GB - 6, w + 16, h + 10, obsidian_spires, w, h, obs, x + 3, veins=lavac)
    for x, h in [(80, 20), (360, 16), (440, 22), (20, 14)]:
        lights += place(mid, x, GB - 7, 36, 34, crystal_cluster, h, magma, x)
    for x in (330, 420):
        hanging_chain(mid, x, 0, r.randint(30, 50), metal)
    lava_flow(mid, 300, 380, GB - 6, GB, 941)
    haze(mid, hz, 0.1)
    for x, y, rr in lights:
        glow(mid, x, y, rr, '#ff8a20', a=0.34)
    for x in range(306, 380, 14):
        glow(mid, x, GB - 5, 7, '#ff8a20', a=0.25)
    out.append(L('forge', mid, 0.4, -GB))

    near = Wrap(384, 64); GB = 62
    lights = []
    place(near, 120, GB, 30, 16, anvil, metal)
    place(near, 230, GB, 26, 24, gear, 9, metal)
    lights += place(near, 300, GB, 26, 16, crucible, metal, lavac)
    for x, h in [(40, 14), (170, 10), (340, 12)]:
        lights += place(near, x, GB, 30, 22, crystal_cluster, h, magma, x)
    for x, w, h in [(80, 20, 16), (260, 24, 20), (370, 16, 12)]:
        place(near, x, GB, w + 6, h + 6, obsidian, w, h, obs, x)
    for x, y, rr in lights:
        glow(near, x, y, rr * 1.1, '#ff8a20', a=0.34)
    out.append(L('near', near, 0.7, -GB))

    g = block_ground(256, 950, R('#3c3448', 5, 0.24, 0.08), R('#2c2636', 5, 0.22, 0.08), '#08060a', 'lava', mortar='#d84a0c')
    out.append(L('ground', g, 1.0, -8))

    def shard(c, x, base, r):
        if r.random() < 0.5:
            crystal(c, x + 3, base, r.randint(4, 7), 1.5, r.uniform(-2, 2), magma)
        else:
            c.shaded_ellipse(x + 4, base - 3, 5, 3.5, obs[:4])
            c.set(x + 3, base - 4, '#ff8a20'); c.set(x + 4, base - 4, '#ffc040')
    out.append(L('front', front_strip(320, 951, 'lava', R('#201a28', 4, 0.2), extra=shard), 1.25, 7, front=True))
    return sky, '#08060a', out


def zone_void():
    sky = ['#04020c', '#0c0624', '#1c0e44', '#301660']
    stone = R('#4a4078', 5, 0.24, 0.06)
    glowc = R('#5af0ff', 4, 0.3, 0.02)
    glowm = R('#e060ff', 4, 0.3, 0.02)
    out = []
    st = Wrap(512, 190)
    stars(st, 420, 1001)
    out.append(L('stars', st, 0.01, 0, 'top'))
    nb = Wrap(512, 170)
    r = rng(1002)
    for i in range(10):
        x, y = r.randint(0, 511), r.randint(20, 150)
        col = r.choice(('#7a3ae0', '#3a5ae8', '#d84aa8', '#4ab0e8'))
        for k in range(5):
            glow(nb, x + r.uniform(-30, 30), y + r.uniform(-10, 10), r.uniform(14, 30), col, a=0.13, rings=4)
    stars(nb, 60, 1003, big=0.2)
    out.append(L('nebula', nb, 0.02, 0, 'top', drift=0.6))

    far = Wrap(512, 180); GB = 178
    glows = planet(far, 380, 60, 26, R('#6a4ab0', 6, 0.32, 0.08), ['#a890d8', '#d8c8f8', '#8a70c0'], ['#120822', glowm[2]])
    for i in range(6):
        far.poly([(410 + i * 6, 40 + i * 9), (416 + i * 6, 36 + i * 9), (419 + i * 6, 42 + i * 9)], '#5a40a0')
    stonef = R('#3a3068', 5, 0.18)
    for x, top, w, d in [(60, 110, 50, 30), (180, 80, 34, 24), (270, 120, 60, 34), (470, 100, 40, 26)]:
        glows += void_platform(far, x, top, w, d, stonef, 1010 + x, glowc)
    for x, y, s in [(120, 50, 6), (230, 30, 5), (330, 150, 7)]:
        glows += reality_shard(far, x, y, s, 1020 + x, ['meadow', 'desert', 'sea'][x % 3])
    haze(far, '#2a1458', 0.4)
    for x, y, rr in glows:
        glow(far, x, y, rr, '#b070ff', a=0.25)
    out.append(L('far', far, 0.05, -GB))

    fm = Wrap(512, 150); GB = 148
    glows = []
    for x, top, w, d in [(40, 96, 70, 36), (180, 60, 56, 30), (320, 104, 84, 40), (450, 54, 50, 28), (250, 20, 30, 16)]:
        glows += void_platform(fm, x, top, w, d, stone, 1030 + x, glowc if x % 2 else glowm)
    for x, top, h in [(30, 96, 40), (196, 60, 30), (340, 104, 46)]:
        glows += place(fm, x, top - 1, 20, h + 10, obelisk, h, 9, stone, glowc, x)
    for x, y, s, k in [(110, 50, 10, 'meadow'), (400, 30, 8, 'snow'), (260, 90, 9, 'desert'), (480, 120, 7, 'sea')]:
        glows += reality_shard(fm, x, y, s, 1040 + x, k)
    for x, top in [(60, 96), (330, 104), (450, 54)]:
        glows += place(fm, x, top - 1, 20, 20, crystal_cluster, 10, R('#5ae0ff', 5, 0.3), x)
    haze(fm, '#24104c', 0.3)
    for x, y, rr in glows:
        glow(fm, x, y, rr, '#a070ff', a=0.3)
    out.append(L('platforms', fm, 0.16, -GB))

    mid = Wrap(512, 150); GB = 148
    glows = []
    for x, top, w, d in [(110, 110, 120, 34), (380, 100, 140, 40)]:
        glows += void_platform(mid, x, top, w, d, stone, 1050 + x, glowc)
    for x, top, h in [(70, 110, 76), (150, 110, 56), (330, 100, 92), (430, 100, 64)]:
        glows += place(mid, x, top - 1, 26, h + 12, obelisk, h, 13, stone, glowc if x % 20 else glowm, x + 1, gap=6)
    # portail de runes
    px, py = 250, 70
    for i in range(80):
        a = i / 80 * 2 * math.pi
        for k, rr in enumerate((19, 20, 21)):
            mid.set(px + math.cos(a) * rr * 0.75, py + math.sin(a) * rr, [stone[2], stone[3], stone[1]][k])
    for i in range(8):
        a = i / 8 * 2 * math.pi
        rune(mid, px + math.cos(a) * 15 * 0.75, py + math.sin(a) * 15, i, glowm[2], only_on=False)
    for i in range(60):
        a = i * 0.45
        d = 2 + i * 0.22
        mid.set(px + math.cos(a) * d * 0.75, py + math.sin(a) * d, A(glowm[3], 0.7))
    glows.append((px, py, 30))
    for x, y, s, k in [(196, 28, 15, 'meadow'), (480, 40, 12, 'sea'), (20, 60, 10, 'snow')]:
        glows += reality_shard(mid, x, y, s, 1060 + x, k)
    for x, y in [(160, 30), (300, 50), (500, 80), (60, 40)]:
        crystal(mid, x, y, 9, 2, 0, R('#e070ff', 5, 0.3))
        crystal(mid, x + 3, y + 9, -5, 1.5, 0, R('#e070ff', 5, 0.3))
        glows.append((x, y - 3, 9))
    haze(mid, '#1c0c40', 0.08)
    for x, y, rr in glows:
        glow(mid, x, y, rr, '#a070ff', a=0.32)
    out.append(L('monoliths', mid, 0.4, -GB))

    near = Wrap(384, 64); GB = 62
    glows = []
    for x, h in [(50, 30), (230, 22)]:
        glows += place(near, x, GB, 20, h + 10, obelisk, h, 9, stone, glowc, x, gap=3)
    for x in (130, 330):
        glows += place(near, x, GB, 20, 18, crystal_cluster, 10, R('#5ae0ff', 5, 0.32), x)
    for x in (170, 290):
        glows += place(near, x, GB, 20, 18, crystal_cluster, 8, R('#e070ff', 5, 0.32), x)
    for x, y, s, k in [(100, 20, 6, 'meadow'), (270, 14, 5, 'desert')]:
        glows += reality_shard(near, x, y, s, 1070 + x, k)
    for x in (20, 200, 360):
        place(near, x, GB, 18, 14, rock, 12, 8, stone[:4])
    for x, y, rr in glows:
        glow(near, x, y, rr, '#a070ff', a=0.32)
    out.append(L('near', near, 0.7, -GB))

    g = block_ground(256, 1080, R('#6a5ab0', 5, 0.28, 0.06), R('#3a3070', 5, 0.24, 0.06), '#06040e', 'rock')
    rr_ = rng(1081)
    for i in range(10):
        x, y = rr_.randint(4, 251), rr_.randint(14, 28)
        rune(g, x, y, i, glowc[2])
        glow(g, x, y, 5, '#5af0ff', a=0.25)
    for x in range(256):
        if (x // 3) % 7 == 0:
            g.set(x, 8, glowc[3])
    out.append(L('ground', g, 1.0, -8))

    def shard(c, x, base, r):
        crystal(c, x + 3, base, r.randint(4, 7), 1.5, r.uniform(-2, 2), R('#5ae0ff' if r.random() < 0.5 else '#e070ff', 5, 0.3))
    out.append(L('front', front_strip(320, 1082, 'rock', R('#2a2050', 5, 0.22), extra=shard), 1.25, 7, front=True))
    return sky, '#06040e', out


def zone_abyss():
    sky = ['#070304', '#160608', '#2c0a0a', '#561a0e']
    stone = R('#2e262c', 5, 0.18, 0.04)
    stone2 = R('#3a2e34', 5, 0.22, 0.04)
    gold = R('#c88a2a', 5, 0.3)
    cloth = R('#9a1018', 4, 0.26)
    fire = ['#c8200c', '#ff6a14', '#ffc030', '#fff4b0']
    metal = R('#4a3c40', 4, 0.24)
    eye = ['#a01008', '#ff4a1a', '#ffd060']
    out = []
    vt = Wrap(512, 52)
    ceiling_vault(vt, 4, R('#1e1418', 5, 0.12), R('#4a3434', 5, 0.24), 1101)
    haze(vt, '#2a0a0a', 0.12)

    far = Wrap(512, 190); GB = 188
    wallc = R('#20181c', 5, 0.12)
    for y in range(0, GB):
        for x in range(512):
            far.set(x, y, wallc[1] if ((y // 7) + (x // 16 if (y // 7) % 2 else (x + 8) // 16)) % 2 else wallc[2])
            if y % 7 == 0 or ((x + (8 if (y // 7) % 2 else 0)) % 16 == 0):
                far.set(x, y, wallc[0])
    glows = []
    glass = ['#3a0808', '#6a1208', '#a02a0c', '#d8501a', '#ff8a30']
    for x in (64, 448):
        glows += gothic_window(far, x, 20, 34, 120, wallc, glass)
    for x in (150, 362):
        glows += gothic_window(far, x, 40, 24, 90, wallc, glass)
    for x in (110, 402):
        black_column(far, x, 10, GB - 10, 14, stone, gold)
    for x in (196, 316):
        place(far, x, GB - 18, 34, 110, hooded_statue, 90, stone2, eye, metal)
        glows.append((x, GB - 98, 6))
    glow(far, 256, GB - 90, 80, '#ff3a10', a=0.22, rings=6)
    glows += place(far, 256, GB - 10, 130, 190, throne, stone2, gold, cloth, eye)
    for x in (110, 402):
        hang_banner(far, x, 30, 80, 12, cloth, gold, emblem='eye')
    haze(far, '#3a0c0a', 0.35, 0.2)
    for x, y, rr in glows:
        glow(far, x, y, rr, '#ff5a1a', a=0.28)
    for y in range(GB - 30, GB):
        for x in range(512):
            blend(far, x, y, '#ff4a10', (y - (GB - 30)) / 30 * 0.25)
    out.append(L('far', far, 0.04, -GB))
    out.append(L('vault', vt, 0.08, 0, 'top'))

    hall = Wrap(512, 160); GB = 158
    lava_flow(hall, 0, 512, GB - 16, GB, 1110)
    glows = []
    cols_x = [30, 140, 236, 362, 452]
    for i, x in enumerate(cols_x):
        black_column(hall, x, 0, GB - 12, 18, stone, gold)
        for k in range(3):
            hall.rect(x - 12 + k * 2, GB - 12 - k * 4, 24 - k * 4, 4, stone[1])
        nx = cols_x[(i + 1) % len(cols_x)] + (512 if i == len(cols_x) - 1 else 0)
        chain(hall, x + 9, 34, nx - 9, 34, 14, metal)
        if i % 2 == 0:
            glows += pillar_brazier(hall, (x + nx) // 2, GB - 14, 34, stone2, metal, fire)
        else:
            hang_banner(hall, x + 22, 14, 70, 12, cloth, gold, emblem='horns')
    haze(hall, '#4a0c0a', 0.32, 0.12)
    for x, y, rr in glows:
        glow(hall, x, y, rr, '#ff8a20', a=0.32)
    for x in range(0, 512, 16):
        glow(hall, x + 8, GB - 14, 10, '#ff7a18', a=0.25)
    for y in range(GB - 50, GB - 16):
        for x in range(512):
            if hall.get(x, y) is not None:
                blend(hall, x, y, '#ff5a10', (y - (GB - 50)) / 34 * 0.3)
    out.append(L('hall', hall, 0.15, -GB))

    mid = Wrap(512, 160); GB = 158
    lava_flow(mid, 0, 512, GB - 8, GB, 1120)
    glows = []
    for x in (60, 316):
        black_column(mid, x, 0, GB - 6, 28, stone2, gold)
        hang_banner(mid, x + 34, 4, 104, 18, cloth, gold, emblem='horns' if x < 200 else 'eye')
    for x in (190, 440):
        glows += place(mid, x, GB - 6, 26, 90, pillar_brazier, 66, stone2, metal, fire)
    for x in (140, 250, 390, 500):
        hanging_chain(mid, x, 0, rng(x).randint(40, 80), metal)
    chain(mid, 74, 50, 182, 70, 18, metal)
    chain(mid, 330, 50, 432, 66, 16, metal)
    for x in range(0, 512, 9):
        mid.rect(x, GB - 10, 7, 4, stone[2] if (x // 9) % 2 else stone[1])
        mid.rect(x, GB - 10, 7, 1, stone[3])
    haze(mid, '#2a0808', 0.1)
    for x, y, rr in glows:
        glow(mid, x, y, rr * 1.2, '#ff8a20', a=0.36)
    for x in range(0, 512, 14):
        glow(mid, x + 7, GB - 5, 8, '#ff7a18', a=0.25)
    out.append(L('columns', mid, 0.4, -GB))

    near = Wrap(384, 64); GB = 62
    glows = []
    place(near, 120, GB, 112, 34, lambda t, lx, lb: spike_rail(t, 6, 100, lb, 16, metal, stone2))
    for x in (40, 290):
        glows += place(near, x, GB, 24, 60, pillar_brazier, 30, stone2, metal, fire)
    for x in (210, 350):
        place(near, x, GB, 20, 16, skull_pile, ['#5a4a40', '#8a7a68', '#c8b8a0', '#ece0cc'], 6, x)
    place(near, 250, GB, 40, 20, ribcage, 0.6, R('#c8b8a0', 5, 0.28), n=4)
    for x, y, rr in glows:
        glow(near, x, y, rr * 0.9, '#ff8a20', a=0.36)
    out.append(L('near', near, 0.7, -GB))

    g = block_ground(256, 1130, R('#3a2c32', 5, 0.2), R('#261e24', 5, 0.2), '#060304', 'lava', mortar='#6a120c')
    G = 8
    for x in range(256):
        g.set(x, G, gold[3]); g.set(x, G + 1, cloth[3]); g.set(x, G + 2, cloth[2]); g.set(x, G + 3, cloth[1])
        if x % 8 == 4:
            g.set(x, G + 2, gold[2])
        g.set(x, G + 4, gold[1]); g.set(x, G + 5, '#1a0606')
    out.append(L('ground', g, 1.0, -8))

    def bones(c, x, base, r):
        if r.random() < 0.5:
            c.shaded_ellipse(x + 3, base - 2, 3, 2.6, ['#5a4a40', '#8a7a68', '#c8b8a0', '#ece0cc'])
            c.set(x + 2, base - 2, '#1a0a08'); c.set(x + 4, base - 2, '#1a0a08')
        else:
            c.shaded_ellipse(x + 4, base - 3, 5, 3.5, R('#2a1c20', 4, 0.2))
            c.set(x + 3, base - 4, '#ff8a20'); c.set(x + 4, base - 4, '#ffc040')
    out.append(L('front', front_strip(320, 1131, 'lava', R('#24181c', 4, 0.2), extra=bones), 1.25, 7, front=True))
    return sky, '#060304', out


NEAR_VEIL = {'swamp': '#3a5a3a', 'sky': '#d8ecfc', 'volcano': '#4a1810', 'void': '#1c0e40', 'abyss': '#2a0808'}

ZONES = {
    'swamp': zone_swamp,
    'sky': zone_sky,
    'volcano': zone_volcano,
    'void': zone_void,
    'abyss': zone_abyss,
}
