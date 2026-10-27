"""Icônes d'interface v5 : pixel art 16 bits, 20×20 (coin 14×14, star 12×12, lock 12×14).

Lumière en haut à gauche, rampes à décalage de teinte, contour sombre commun '#1a1226'.
build() -> {nom: (Canvas, {})}
"""
import math

from lib import Canvas

OUT = '#1a1226'

# ------------------------------------------------------------------ rampes (sombre -> clair)
GOLD = ['#6b3410', '#a65f14', '#e09a22', '#ffcf45', '#fff1a0']
GEM = ['#141f66', '#1f45b5', '#2f7ef0', '#6cc0ff', '#c9f0ff']
RED = ['#4a0e1e', '#8c1626', '#d42f2f', '#ff6a4a', '#ffb08a']
PURPLE = ['#2a1050', '#4f1d8c', '#8236d0', '#b874f5', '#e8c4ff']
ICE = ['#1b3f6e', '#2f78b8', '#4fb8e8', '#9ae8ff', '#e4fbff']
MAGENTA = ['#4a0a3e', '#8f1478', '#d62fb0', '#ff7ad8', '#ffc8f0']
STEEL = ['#2c3444', '#4f5d73', '#8494ab', '#c3cede', '#eef3f8']
DSTEEL = ['#1e2230', '#363c50', '#5a6278', '#8c96ac', '#c8d0de']
WOOD = ['#3a1e12', '#6a3a1e', '#9a5a2a', '#c98a4a', '#e8b878']
LEATHER = ['#3e2214', '#6e3e20', '#a0602e', '#cf8c4c', '#f0bc7c']
STONE = ['#2a2834', '#4a4656', '#726c7c', '#a09aa6', '#cfc8cc']
BONE = ['#5a4a3a', '#9a8670', '#d0c0a0', '#efe4c8', '#fffbf0']
GREEN = ['#123a22', '#1f6b2e', '#3aa43a', '#7fd85a', '#c8f59a']
ORANGE = ['#5a1a08', '#a8380e', '#e8701a', '#ffaa30', '#ffe080']
PARCH = ['#6a4a2a', '#a8804e', '#d8b47a', '#f0d8a4', '#fff2d0']
YELLOW = ['#7a3a08', '#c8740e', '#f5b81a', '#ffe74a', '#fffbc0']
BLUE = ['#10204a', '#1c3f8a', '#2e66c8', '#5a9cf0', '#a8d4ff']
PAW = ['#4a2412', '#8a4a1e', '#c8782e', '#f0a850', '#ffd890']
ENV = ['#6a5040', '#b09070', '#e0cca8', '#f6ead0', '#fffaf0']
BOOK = ['#3a0c18', '#6e1a26', '#a8283a', '#d84a50', '#f08070']
WHITE = '#ffffff'

LX, LY = -0.6, -0.8  # direction vers la lumière (haut-gauche)


# ------------------------------------------------------------------ outils
def cv(w=20, h=20):
    return Canvas(w, h)


def pts(m):
    return {(x, y) for y in range(m.h) for x in range(m.w) if m.px[y][x] is not None}


def shape(draw, w=20, h=20):
    """Masque : draw(canvas, couleur) -> ensemble de pixels."""
    m = cv(w, h)
    draw(m, 'x')
    return pts(m)


def clamp(v, a, b):
    return a if v < a else b if v > b else v


def fill(c, P, rmp, grad=1.0, bevel=True, bias=0.0, box=None):
    """Remplissage en dégradé diagonal (clair en haut à gauche) + biseau 1 px."""
    if not P:
        return
    xs = [p[0] for p in P]
    ys = [p[1] for p in P]
    x0, y0, x1, y1 = box or (min(xs), min(ys), max(xs), max(ys))
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    hw, hh = max(1, (x1 - x0) / 2), max(1, (y1 - y0) / 2)
    n = len(rmp)
    for (x, y) in P:
        u = ((x - cx) / hw * LX + (y - cy) / hh * LY)
        t = 0.5 + 0.38 * u * grad + bias
        i = int(t * n)
        if bevel:
            if (x - 1, y) not in P or (x, y - 1) not in P:
                i += 1
            elif (x + 1, y) not in P or (x, y + 1) not in P:
                i -= 1
        c.set(x, y, rmp[clamp(i, 0, n - 1)])


def sfill(c, P, rmp, cx, cy, rx, ry=None, bias=0.0):
    """Ombrage sphérique par normale (centre/rayons donnés)."""
    ry = ry or rx
    n = len(rmp)
    for (x, y) in P:
        dx = (x + 0.5 - cx) / rx
        dy = (y + 0.5 - cy) / ry
        d = min(1.0, dx * dx + dy * dy)
        nz = math.sqrt(1 - d)
        dot = (dx * LX + dy * LY) * 0.75 + nz * 0.55
        v = clamp((dot + 0.35) / 1.25 + bias, 0, 0.999)
        c.set(x, y, rmp[int(v * n)])


def edge_light(c, P, light, dark=None):
    """Liseré clair sur les bords haut/gauche (et sombre bas/droite si dark)."""
    for (x, y) in P:
        if (x - 1, y) not in P or (x, y - 1) not in P:
            if light:
                c.set(x, y, light)
        elif dark and ((x + 1, y) not in P or (x, y + 1) not in P):
            c.set(x, y, dark)


def rot(local, ang, cx, cy):
    a = math.radians(ang)
    ca, sa = math.cos(a), math.sin(a)
    return [(cx + x * ca - y * sa, cy + x * sa + y * ca) for x, y in local]


def to_local(x, y, ang, cx, cy):
    a = math.radians(-ang)
    ca, sa = math.cos(a), math.sin(a)
    dx, dy = x + 0.5 - cx, y + 0.5 - cy
    return dx * ca - dy * sa, dx * sa + dy * ca


def star_pts(cx, cy, ro, ri, n=5, a0=-90):
    out = []
    for i in range(n * 2):
        r = ro if i % 2 == 0 else ri
        a = math.radians(a0 + i * 180 / n)
        out.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return out


def bez(p0, p1, p2, t):
    u = 1 - t
    return (u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
            u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1])


def stroke(c, path, wfn, color, steps=60):
    """Trait épais le long d'un chemin path(t) de largeur wfn(t)."""
    for i in range(steps + 1):
        t = i / steps
        x, y = path(t)
        w = wfn(t)
        if w <= 0.05:
            continue
        if w < 1.0:
            c.set(x - 0.5, y - 0.5, color)
        else:
            c.ellipse(x, y, w / 2, w / 2, color)


def sparkle(c, x, y, big=False, col=WHITE, mid='#fff3b0'):
    c.set(x, y, col)
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        c.set(x + dx, y + dy, mid)
    if big:
        for dx, dy in ((2, 0), (-2, 0), (0, 2), (0, -2)):
            c.set(x + dx, y + dy, mid)


def done(c):
    return c.outline(OUT)


def layer(base, top):
    """Colle un calque déjà détouré par-dessus."""
    base.paste(top, 0, 0)
    return base


# ------------------------------------------------------------------ monnaies
def coin():
    c = cv(14, 14)
    P = shape(lambda m, k: m.ellipse(7, 7, 6, 6, k), 14, 14)
    sfill(c, P, GOLD, 6.6, 6.6, 7.2)
    face = shape(lambda m, k: m.ellipse(7, 7, 4.1, 4.1, k), 14, 14)
    fill(c, face, GOLD[1:5], grad=-0.9, bevel=False, bias=0.05)
    # bord gravé : sombre en haut-gauche, clair en bas-droite (creux)
    for (x, y) in face:
        if (x - 1, y) not in face or (x, y - 1) not in face:
            c.set(x, y, GOLD[1])
        elif (x + 1, y) not in face or (x, y + 1) not in face:
            c.set(x, y, GOLD[4])
    # emblème : losange en relief
    for (x, y, col) in ((6, 5, GOLD[4]), (5, 6, GOLD[4]), (6, 6, GOLD[3]), (7, 6, GOLD[3]),
                        (6, 7, GOLD[3]), (7, 7, GOLD[2]), (7, 5, GOLD[3]), (8, 6, GOLD[2]),
                        (5, 7, GOLD[3]), (6, 8, GOLD[2]), (7, 8, GOLD[1]), (8, 7, GOLD[1])):
        c.set(x, y, col)
    done(c)
    c.set(3, 3, WHITE)
    c.set(4, 2, GOLD[4])
    c.set(2, 4, GOLD[4])
    return c


def icon_gem():
    c = cv()
    crown = [(6, 2), (14, 2), (18.6, 7), (1.4, 7)]
    pav = [(1.4, 7), (18.6, 7), (10, 18.6)]
    P = shape(lambda m, k: (m.poly(crown, k), m.poly(pav, k)))
    for (x, y) in P:
        xc = x + 0.5
        if y < 7:
            if xc < 6.5 - (y - 2) * 0.2:
                col = GEM[3]
            elif xc > 13.5 + (y - 2) * 0.2:
                col = GEM[1]
            else:
                col = GEM[4] if y < 4 else GEM[3]
                if xc > 10.5:
                    col = GEM[3] if y < 4 else GEM[2]
        elif y == 7:
            col = GEM[4] if xc < 10 else GEM[3]
        else:
            # facettes du pavillon : lignes (6,7)->(10,18.6) et (14,7)->(10,18.6)
            t = (y + 0.5 - 7) / 11.6
            l, r = 6 + 4 * t, 14 - 4 * t
            if xc < l:
                col = GEM[3]
            elif xc > r:
                col = GEM[0]
            else:
                col = GEM[2] if xc < 10 else GEM[1]
        c.set(x, y, col)
    done(c)
    for p in ((4, 5), (5, 4), (8, 3), (4, 8)):
        c.set(*p, WHITE)
    c.set(5, 9, GEM[4])
    c.set(6, 10, GEM[4])
    return c


def icon_ticket():
    c = cv()
    ang, cx, cy = -16, 10, 10
    hw, hh = 8.6, 4.9
    P = shape(lambda m, k: m.poly(rot([(-hw, -hh), (hw, -hh), (hw, hh), (-hw, hh)], ang, cx, cy), k))
    for sx in (-1, 1):
        nx, ny = rot([(sx * hw, 0)], ang, cx, cy)[0]
        P -= shape(lambda m, k: m.ellipse(nx, ny, 1.9, 1.9, k))
    fill(c, P, RED[1:], grad=0.6, bias=-0.02)
    for (x, y) in P:
        lx, ly = to_local(x, y, ang, cx, cy)
        # perforation
        if abs(lx - 3.8) < 0.55 and abs(ly) < hh - 0.6:
            c.set(x, y, RED[0] if int(ly + 10) % 2 == 0 else RED[4])
    edge_light(c, P, RED[4], RED[1])
    # étoile dorée
    sp = star_pts(*rot([(-2.2, 0)], ang, cx, cy)[0], 3.1, 1.4)
    S = shape(lambda m, k: m.poly(sp, k))
    fill(c, S, GOLD[2:], grad=1.0)
    done(c)
    return c


def icon_fragment():
    c = cv()
    poly = [(9, 0.8), (15.5, 3.5), (18, 10.5), (13.5, 18.8), (5, 18), (1.6, 10), (4, 3.5)]
    P = shape(lambda m, k: m.poly(poly, k))
    for (x, y) in P:
        xc, yc = x + 0.5, y + 0.5
        # arête principale (9,0.8)->(10,10)->(13.5,18.8) ; arête transverse (1.6,10)->(10,10)->(18,10.5)
        ridge = 9 + (yc - 0.8) / 9.2 if yc < 10 else 10 + (yc - 10) / 8.8 * 3.5
        left = xc < ridge
        top = yc < 10 + (xc - 10) * 0.06
        col = PURPLE[4] if (left and top) else PURPLE[2] if top else PURPLE[2] if left else PURPLE[1]
        if left and top and (xc > ridge - 2.5):
            col = PURPLE[3]
        c.set(x, y, col)
    edge_light(c, P, None, PURPLE[0])
    # rune lumineuse (algiz)
    rune = [(10, y) for y in range(7, 15)] + [(9, 9), (8, 8), (8, 7), (11, 9), (12, 8), (12, 7)]
    for (x, y) in rune:
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            if (x + dx, y + dy) not in rune:
                c.setf(x + dx, y + dy, MAGENTA[2])
    for p in rune:
        c.set(*p, '#ffe6ff')
    done(c)
    c.set(5, 5, WHITE)
    return c


def crystal(c, cx, cy, ang, hw, hl, rmp):
    """Prisme hexagonal allongé (axe local vertical, pointe en haut)."""
    loc = [(-hw, hl * 0.45), (-hw, -hl * 0.45), (0, -hl), (hw, -hl * 0.45), (hw, hl * 0.45), (0, hl)]
    P = shape(lambda m, k: m.poly(rot(loc, ang, cx, cy), k))
    for (x, y) in P:
        lx, ly = to_local(x, y, ang, cx, cy)
        if lx < -hw * 0.35:
            i = 3
        elif lx < hw * 0.25:
            i = 2
        else:
            i = 1
        if ly < -hl * 0.45 + abs(lx) * 0.2:
            i += 1
        c.set(x, y, rmp[clamp(i, 0, 4)])
    for t in range(-int(hl * 0.4), int(hl * 0.35)):
        x, y = rot([(-hw * 0.35 - 0.3, t)], ang, cx, cy)[0]
        c.setf(x - 0.5, y - 0.5, rmp[4])
    return P


def icon_shard():
    side = cv()
    crystal(side, 5.5, 13, -32, 2.0, 5.2, ICE)
    crystal(side, 15, 13.5, 30, 1.9, 4.6, ICE)
    done(side)
    main = cv()
    crystal(main, 10, 9.6, 12, 3.0, 9.0, ICE)
    done(main)
    c = layer(side, main)
    c.set(8, 3, WHITE)
    c.set(15, 2, WHITE)
    c.set(16, 3, ICE[3])
    c.set(14, 3, ICE[3])
    c.set(15, 4, ICE[3])
    return c


def icon_essence():
    c = cv()
    P = shape(lambda m, k: (m.ellipse(10, 12.6, 5.9, 5.9, k), m.poly([(10, 0.6), (15.2, 9.6), (4.8, 9.6)], k)))
    sfill(c, P, MAGENTA, 9.0, 12.0, 7.5, 8.5)
    # coeur lumineux
    for (x, y) in shape(lambda m, k: m.ellipse(10.5, 13, 2.6, 2.6, k)):
        c.set(x, y, MAGENTA[3])
    c.set(10, 12, MAGENTA[4])
    c.set(11, 13, MAGENTA[4])
    c.set(10, 13, WHITE)
    done(c)
    for p in ((6, 9), (6, 10), (6, 11), (7, 8)):
        c.set(*p, WHITE)
    c.set(7, 13, MAGENTA[4])
    sparkle(c, 16, 4, col=WHITE, mid=MAGENTA[3])
    return c


def icon_key():
    c = cv()
    ang = 45
    shaft = rot([(-1.4, 0), (1.4, 0), (1.4, 12.4), (-1.4, 12.4)], -ang, 6.6, 6.6)
    t1 = rot([(-1.2, 7.4), (-4.4, 7.4), (-4.4, 9.4), (-1.2, 9.4)], -ang, 6.6, 6.6)
    t2 = rot([(-1.2, 10.6), (-3.6, 10.6), (-3.6, 12.4), (-1.2, 12.4)], -ang, 6.6, 6.6)
    P = shape(lambda m, k: (m.ellipse(6, 6, 4.7, 4.7, k), m.poly(shaft, k), m.poly(t1, k), m.poly(t2, k)))
    hole = shape(lambda m, k: m.ellipse(5.6, 5.6, 1.7, 1.7, k))
    P -= hole
    fill(c, P, GOLD, grad=1.1)
    for (x, y) in P:
        if (x - 1, y) in hole or (x, y - 1) in hole:
            c.set(x, y, GOLD[1])
    # anneau ciselé
    for p in ((3, 4), (4, 3), (2, 6), (6, 2)):
        c.setf(*p, GOLD[4])
    done(c)
    c.set(3, 3, WHITE)
    return c


# ------------------------------------------------------------------ interface
def icon_trophy():
    c = cv()
    bowl = [(4, 2), (16, 2), (16, 6), (13, 10.5), (7, 10.5), (4, 6)]
    P = shape(lambda m, k: (m.poly(bowl, k), m.rect(8, 10, 4, 3, k), m.rect(7, 12, 6, 2, k)))
    handles = shape(lambda m, k: (m.ellipse(3.2, 5.6, 2.6, 2.8, k), m.ellipse(16.8, 5.6, 2.6, 2.8, k)))
    handles -= shape(lambda m, k: (m.ellipse(3.2, 5.6, 1.2, 1.4, k), m.ellipse(16.8, 5.6, 1.2, 1.4, k)))
    handles -= P
    P2 = P | handles
    fill(c, P2, GOLD, grad=1.0, box=(2, 2, 17, 13))
    # lèvre
    for x in range(4, 16):
        c.set(x, 2, GOLD[4] if x < 12 else GOLD[3])
        c.set(x, 3, GOLD[1] if x > 5 else GOLD[2])
    # reflet vertical
    for y in range(4, 9):
        c.set(6, y, GOLD[4])
    c.set(7, 9, GOLD[3])
    # étoile
    for (x, y) in shape(lambda m, k: m.poly(star_pts(10.5, 6.6, 2.7, 1.2), k)):
        c.set(x, y, GOLD[4])
    c.set(10, 6, WHITE)
    # socle
    base = shape(lambda m, k: m.poly([(5, 14), (15, 14), (16, 18.5), (4, 18.5)], k))
    fill(c, base, WOOD, grad=1.0)
    for x in range(7, 13):
        c.set(x, 16, GOLD[3] if x < 10 else GOLD[2])
    done(c)
    c.set(5, 3, WHITE)
    return c


def icon_mail():
    c = cv()
    P = shape(lambda m, k: m.rect(1, 4, 18, 12, k))
    fill(c, P, ENV, grad=0.7, bias=0.08)
    # rabats inférieurs
    flap = shape(lambda m, k: m.poly([(1, 4), (19, 4), (10, 11.5)], k))
    for (x, y) in flap:
        c.set(x, y, ENV[3] if x < 12 else ENV[2])
    c.line(1, 15, 7.5, 9.5, ENV[1])
    c.line(18, 15, 12, 9.5, ENV[1])
    c.line(1, 4, 9.5, 11, ENV[1])
    c.line(18, 4, 10, 11, ENV[1])
    for x in range(1, 19):
        c.set(x, 4, ENV[4])
    # sceau de cire
    S = shape(lambda m, k: m.ellipse(10, 11, 2.6, 2.4, k))
    sfill(c, S, RED, 9.5, 10.5, 3.2)
    c.set(9, 10, RED[4])
    done(c)
    return c


def icon_gear():
    c = cv()
    teeth = []
    for k in range(8):
        teeth.append(rot([(-1.7, -9.3), (1.7, -9.3), (1.9, -5), (-1.9, -5)], k * 45 + 22.5, 10, 10))
    P = shape(lambda m, k: (m.ellipse(10, 10, 6.6, 6.6, k), [m.poly(t, k) for t in teeth]))
    hole = shape(lambda m, k: m.ellipse(10, 10, 2.3, 2.3, k))
    P -= hole
    sfill(c, P, STEEL, 8.5, 8.5, 10.5, bias=0.05)
    edge_light(c, P, None, STEEL[0])
    # gorge intérieure
    ring = shape(lambda m, k: m.ellipse(10, 10, 4.6, 4.6, k)) - shape(lambda m, k: m.ellipse(10, 10, 3.6, 3.6, k))
    for (x, y) in ring & P:
        c.set(x, y, STEEL[1] if x + y < 20 else STEEL[3])
    for (x, y) in P:
        if (x - 1, y) in hole or (x, y - 1) in hole:
            c.set(x, y, STEEL[4])
    done(c)
    return c


def icon_chest():
    c = cv()
    lid = shape(lambda m, k: m.poly([(1.5, 9), (1.5, 6), (4, 2.5), (16, 2.5), (18.5, 6), (18.5, 9)], k))
    body = shape(lambda m, k: m.rect(2, 9, 16, 9, k))
    fill(c, lid, WOOD, grad=0.9, bias=0.1)
    fill(c, body, WOOD, grad=0.9, bias=-0.05)
    for x in range(2, 18):
        c.set(x, 13, WOOD[1])
        c.set(x, 9, OUT)
    for x in range(3, 17):
        c.setf(x, 5, WOOD[2])
    # ferrures
    for bx in (3, 15):
        for y in range(3, 18):
            if y == 9:
                continue
            c.setf(bx, y, GOLD[3] if bx == 3 else GOLD[2])
            c.setf(bx + 1, y, GOLD[2] if bx == 3 else GOLD[1])
    for x in range(2, 18):
        c.setf(x, 8, GOLD[3] if x < 10 else GOLD[2])
        c.setf(x, 17, GOLD[2] if x < 10 else GOLD[1])
    # serrure
    lock = shape(lambda m, k: m.rect(8, 7, 4, 5, k))
    fill(c, lock, GOLD, grad=1.0)
    c.set(9, 9, OUT)
    c.set(10, 9, OUT)
    c.set(9, 10, OUT)
    c.set(10, 10, GOLD[1])
    done(c)
    c.set(5, 3, GOLD[4])
    return c


def icon_anvil():
    c = cv()
    P = shape(lambda m, k: (
        m.poly([(5, 7), (19, 7), (19, 11), (5, 11)], k),
        m.poly([(0.5, 7), (5, 7), (5, 11), (2.5, 9)], k),
        m.poly([(7, 11), (17, 11), (15, 14), (9, 14)], k),
        m.poly([(6, 14), (18, 14), (19, 18.5), (5, 18.5)], k)))
    P -= shape(lambda m, k: m.rect(10, 17, 4, 2, k))
    fill(c, P, DSTEEL, grad=0.8)
    for x in range(1, 19):
        c.setf(x, 7, DSTEEL[4])
        c.setf(x, 8, DSTEEL[3])
    for x in range(6, 19):
        c.setf(x, 14, DSTEEL[3] if x < 12 else DSTEEL[2])
    # lingot incandescent
    ing = shape(lambda m, k: m.poly([(8, 4), (15, 4), (16, 7), (7, 7)], k))
    fill(c, ing, ORANGE, grad=1.0, bias=0.15)
    for x in range(8, 13):
        c.set(x, 4, ORANGE[4])
    done(c)
    for p, col in (((6, 1), YELLOW[3]), ((11, 1), WHITE), ((17, 2), YELLOW[3]), ((4, 3), ORANGE[3]), ((14, 0), ORANGE[3])):
        c.set(*p, col)
    return c


# ------------------------------------------------------------------ onglets
def icon_upgrade():
    c = cv()
    arrow = [(10, 0.6), (18.6, 9.2), (13.5, 9.2), (13.5, 18.6), (6.5, 18.6), (6.5, 9.2), (1.4, 9.2)]
    P = shape(lambda m, k: m.poly(arrow, k))
    fill(c, P, GOLD, grad=1.2)
    # facette droite plus sombre
    for (x, y) in P:
        if x >= 10 and (x + 1, y) in P and (x, y + 1) in P and (x, y - 1) in P:
            c.set(x, y, GOLD[2] if y > 9 else c.get(x, y))
    for y in range(9, 18):
        c.set(8, y, GOLD[4])
    for x, y in ((9, 2), (8, 3), (7, 4), (6, 5), (5, 6)):
        c.set(x, y, GOLD[4])
    done(c)
    c.set(9, 2, WHITE)
    c.set(8, 10, WHITE)
    return c


def icon_bag():
    c = cv()
    body = shape(lambda m, k: m.ellipse(10, 12.8, 7.6, 6.1, k))
    neck = shape(lambda m, k: m.poly([(7, 5), (13, 5), (14.5, 8), (5.5, 8)], k))
    top = shape(lambda m, k: m.poly([(4.5, 1.5), (8, 3), (10, 1), (12, 3), (15.5, 1.5), (13.5, 5.5), (6.5, 5.5)], k))
    P = body | neck | top
    sfill(c, body | neck, LEATHER, 8.0, 10.5, 9.0, 8.0)
    fill(c, top, LEATHER, grad=1.0, bias=0.05)
    for x in range(6, 14):
        c.set(x, 5, LEATHER[0])
    # lien
    for x in range(6, 15):
        c.set(x, 6, GOLD[3] if x < 10 else GOLD[2])
        c.set(x, 7, GOLD[1])
    c.set(13, 8, GOLD[2])
    c.set(14, 9, GOLD[1])
    c.set(12, 8, GOLD[1])
    # couture
    for y in range(10, 18, 2):
        c.setf(13, y, LEATHER[1])
    done(c)
    c.set(5, 10, LEATHER[4])
    c.set(4, 11, LEATHER[4])
    return c


def icon_hero():
    plume = cv()
    path = lambda t: bez((9.0, 7.0), (8.6, -0.6), (18.4, 5.0), t)  # noqa: E731
    stroke(plume, path, lambda t: 5.0 - 3.0 * t, BLUE[2], 80)
    Pp = pts(plume)
    sfill(plume, Pp, BLUE, 10.0, 1.0, 7.5, 5.0, bias=0.06)
    # mèches
    stroke(plume, lambda t: bez((8.6, 4.6), (9.6, 1.6), (15.0, 2.6), t), lambda t: 0.8, BLUE[4], 40)
    stroke(plume, lambda t: bez((11.5, 4.6), (15, 2.6), (17.8, 5.2), t), lambda t: 0.8, BLUE[1], 40)
    done(plume)
    c = cv()
    dome = shape(lambda m, k: m.ellipse(10, 12.0, 6.6, 5.8, k))
    low = shape(lambda m, k: m.poly([(3.4, 11), (16.6, 11), (15.6, 18.6), (4.4, 18.6)], k))
    P = dome | low
    sfill(c, P, STEEL, 8.0, 9.0, 9.0, 9.5)
    edge_light(c, P, None, STEEL[1])
    # visière
    for x in range(5, 15):
        c.set(x, 10, STEEL[4] if x < 9 else STEEL[3])
        c.set(x, 11, OUT)
        c.set(x, 12, STEEL[1])
    # nasal / arête
    for y in range(7, 17):
        c.set(9, y, STEEL[4] if y != 11 else STEEL[3])
        c.set(10, y, STEEL[2])
    # trous d'aération
    for p in ((6, 14), (7, 15), (13, 14), (12, 15)):
        c.set(*p, STEEL[0])
    # bordure dorée
    for x in range(5, 16):
        c.setf(x, 18, GOLD[3] if x < 10 else GOLD[2])
    for x in range(4, 16):
        c.setf(x, 17, GOLD[2] if x < 10 else GOLD[1])
    c.set(5, 9, STEEL[4])
    c.set(6, 8, STEEL[4])
    done(c)
    return layer(plume, c)


def icon_paw():
    c = cv()
    pads = [(3.6, 9.4, 2.4, 2.9), (7.6, 4.9, 2.5, 3.1), (12.4, 4.9, 2.5, 3.1), (16.4, 9.4, 2.4, 2.9)]
    for (x, y, rx, ry) in pads:
        P = shape(lambda m, k: m.ellipse(x, y, rx, ry, k))
        sfill(c, P, PAW, x - 0.3, y - 0.3, rx + 0.8, ry + 0.8)
    main = shape(lambda m, k: (m.ellipse(10, 14.0, 5.6, 4.4, k), m.ellipse(7.2, 15.6, 3.2, 3.0, k),
                               m.ellipse(12.8, 15.6, 3.2, 3.0, k)))
    sfill(c, main, PAW, 8.6, 12.8, 7.2, 6.0)
    done(c)
    for p in ((3, 8), (7, 3), (12, 3), (16, 8), (7, 12), (8, 11)):
        c.set(*p, PAW[4])
    return c


def icon_tree():
    c = cv()
    trunk = shape(lambda m, k: m.poly([(8.2, 10), (11.8, 10), (12.2, 15.5), (15, 18.6), (5, 18.6), (7.8, 15.5)], k))
    fill(c, trunk, WOOD, grad=1.0, bias=0.05)
    c.set(9, 13, WOOD[3])
    c.set(9, 14, WOOD[3])
    c.set(11, 16, WOOD[1])
    canopy = shape(lambda m, k: (m.ellipse(10, 6.4, 6.4, 5.4, k), m.ellipse(5.2, 10.0, 4.4, 3.6, k),
                                 m.ellipse(14.8, 10.0, 4.4, 3.6, k)))
    sfill(c, canopy, GREEN, 8.0, 5.0, 10.0, 8.0)
    # touffes
    for p in ((7, 5), (8, 4), (12, 8), (13, 7), (4, 10), (15, 11), (16, 10), (9, 10), (10, 11)):
        c.setf(*p, GREEN[1])
    for p in ((6, 3), (7, 2), (3, 8), (11, 5)):
        c.setf(*p, GREEN[4])
    # fruits / noeuds de talent dorés
    for (x, y) in ((6, 9), (13, 4), (15, 9), (10, 7)):
        c.set(x, y, GOLD[4])
        c.set(x + 1, y, GOLD[2])
        c.set(x, y + 1, GOLD[2])
        c.set(x + 1, y + 1, GOLD[1])
    done(c)
    c.set(6, 9, WHITE)
    c.set(13, 4, WHITE)
    sparkle(c, 17, 2, mid=GOLD[3])
    return c


def icon_map():
    c = cv()
    panels = [
        ([(1, 4), (7, 2), (7, 16.6), (1, 18.6)], 0.12),
        ([(7, 2), (13, 4), (13, 18.6), (7, 16.6)], -0.12),
        ([(13, 4), (19, 2), (19, 16.6), (13, 18.6)], 0.08),
    ]
    allp = set()
    for poly, b in panels:
        P = shape(lambda m, k: m.poly(poly, k))
        fill(c, P, PARCH, grad=0.6, bevel=False, bias=b)
        allp |= P
    # terres / eau
    for p in ((2, 7), (3, 7), (4, 7), (2, 8), (3, 8), (4, 8), (5, 8), (3, 9), (4, 9), (14, 13), (15, 13),
              (16, 13), (15, 14), (16, 14), (17, 14), (16, 12), (9, 6), (10, 6), (10, 7)):
        c.setf(*p, GREEN[2])
    for p in ((2, 7), (3, 7), (14, 13), (16, 12), (9, 6)):
        c.setf(*p, GREEN[3])
    for p in ((7, 11), (8, 12), (9, 12), (10, 13), (11, 13), (12, 14), (13, 15), (14, 16), (6, 11), (5, 10)):
        c.setf(*p, '#3f8fe0')
    # chemin + croix
    for p in ((3, 14), (5, 13), (7, 14), (9, 15)):
        c.setf(*p, RED[1])
    for p in ((13, 9), (11, 10)):
        c.setf(*p, RED[1])
    for p in ((14, 5), (16, 7), (15, 6), (14, 7), (16, 5)):
        c.setf(*p, RED[2])
    c.setf(15, 6, RED[3])
    # plis
    for y in range(2, 19):
        c.setf(7, y, PARCH[1])
        c.setf(13, y, PARCH[4])
    done(c)
    return c


def icon_dungeon():
    c = cv()
    outer = shape(lambda m, k: (m.rect(1, 9, 18, 10, k), m.ellipse(10, 10, 9, 9, k)))
    inner = shape(lambda m, k: (m.rect(5, 10, 10, 9, k), m.ellipse(10, 10.4, 5, 5.4, k)))
    stone = outer - inner
    fill(c, stone, STONE, grad=0.8)
    # joints de pierre
    for (x, y) in stone:
        dx, dy = x + 0.5 - 10, y + 0.5 - 10
        if y >= 10:
            if y in (11, 14, 17) or (x in (2, 17) and y in (12, 13)) or (x in (3, 16) and y in (15, 16)):
                c.set(x, y, STONE[1])
        else:
            a = math.degrees(math.atan2(dy, dx))
            if round(a) % 30 in (0, 1, 29) and math.hypot(dx, dy) > 5.5:
                c.set(x, y, STONE[1])
    # clé de voûte
    for p in ((9, 1), (10, 1), (9, 2), (10, 2), (9, 3), (10, 3)):
        c.set(*p, STONE[4] if p[0] == 9 else STONE[3])
    # ouverture
    for (x, y) in inner:
        c.set(x, y, '#120b1c' if y > 7 else '#1d1430')
    for y in range(10, 18):
        c.set(10, y, '#2a1a3a')
    # herse
    for (x, y) in inner:
        if x in (6, 9, 12) or y in (8, 12, 16):
            c.set(x, y, DSTEEL[3] if (x in (6, 9, 12) and y not in (8, 12, 16)) else DSTEEL[2])
            if x in (6, 9, 12) and y in (8, 12, 16):
                c.set(x, y, DSTEEL[4])
    for x in (6, 9, 12):
        c.set(x, 18, DSTEEL[1])
    done(c)
    # yeux dans l'ombre
    c.set(13, 14, '#ff4a3a')
    c.set(14, 14, '#ff4a3a')
    return c


def icon_boss():
    horns = cv()
    for sx in (-1, 1):
        stroke(horns, lambda t, s=sx: bez((10 + s * 4.2, 7.5), (10 + s * 9.2, 6), (10 + s * 8.6, 1.6), t),
               lambda t: 3.4 * (1 - t) + 0.9, BONE[2])
    Ph = pts(horns)
    sfill(horns, Ph, BONE, 6, 2, 9, 7)
    done(horns)
    c = cv()
    P = shape(lambda m, k: (m.ellipse(10, 9.4, 6.3, 6.0, k),
                            m.poly([(5.2, 12), (14.8, 12), (13.8, 18.6), (6.2, 18.6)], k)))
    sfill(c, P, RED, 8.4, 7.4, 8.6, 9.0)
    edge_light(c, P, None, RED[0])
    # orbites
    for ex, s in ((7, 1), (12, -1)):
        for p in ((ex, 10), (ex + 1, 10), (ex, 11), (ex + 1, 11), (ex + (1 if s > 0 else 0), 9)):
            c.set(*p, OUT)
        c.set(ex + (0 if s > 0 else 1), 10, YELLOW[3])
        c.set(ex + (0 if s > 0 else 1), 11, ORANGE[3])
    # sourcils
    for p in ((6, 9), (13, 9), (6, 8), (13, 8)):
        c.set(*p, RED[1])
    # nez
    c.set(9, 13, OUT)
    c.set(10, 13, OUT)
    # gueule + crocs
    for x in range(6, 14):
        c.set(x, 15, OUT)
    for p in ((7, 15), (12, 15), (7, 14), (12, 14)):
        c.set(*p, BONE[4])
    for p in ((8, 16), (11, 16), (9, 15), (10, 15)):
        c.set(*p, BONE[2])
    c.set(6, 5, RED[4])
    c.set(7, 4, RED[4])
    done(c)
    return layer(horns, c)


# ------------------------------------------------------------------ compétences
def skill_quick():
    c = cv()

    def slash(p0, p1, p2, wmax):
        path = lambda t: bez(p0, p1, p2, t)  # noqa: E731
        stroke(c, path, lambda t: wmax * math.sin(math.pi * t) ** 0.8, BLUE[2])
        stroke(c, path, lambda t: wmax * 0.62 * math.sin(math.pi * t) ** 0.8, BLUE[4])
        stroke(c, path, lambda t: wmax * 0.28 * math.sin(math.pi * t), WHITE)

    slash((1.5, 18.5), (5.5, 6.5), (18.5, 1.5), 4.6)
    slash((8.5, 18.6), (12.5, 12.0), (18.6, 8.5), 2.6)
    slash((1.6, 11.0), (2.2, 4.0), (9.5, 1.6), 2.2)
    done(c)
    return c


def skill_whirl():
    c = cv()
    for ph in (0, 180):
        def path(t, ph=ph):
            a = math.radians(ph + t * 330)
            r = 1.2 + 7.6 * t
            return 10 + r * math.cos(a), 10 + r * math.sin(a)
        stroke(c, path, lambda t: 1.0 + 3.6 * math.sin(math.pi * min(1, t * 1.05)) ** 0.7, RED[1], 90)
        stroke(c, path, lambda t: 0.6 + 2.2 * math.sin(math.pi * min(1, t * 1.05)) ** 0.7, RED[2], 90)
        stroke(c, path, lambda t: 1.2 * math.sin(math.pi * min(1, t * 1.05)), ORANGE[3], 90)
    c.ellipse(10, 10, 1.6, 1.6, ORANGE[4])
    c.set(9, 9, WHITE)
    done(c)
    return c


def heater(cx, top, w, h):
    """Écu : sommet plat, pointe en bas."""
    x0, x1 = cx - w / 2, cx + w / 2
    return [(x0, top), (x1, top), (x1, top + h * 0.5), (cx + w * 0.28, top + h * 0.82), (cx, top + h),
            (cx - w * 0.28, top + h * 0.82), (x0, top + h * 0.5)]


def skill_cry():
    burst = cv()
    B = shape(lambda m, k: m.poly(star_pts(10, 10, 9.9, 5.0, n=8, a0=-90), k))
    sfill(burst, B, ORANGE, 10, 10, 9.5, bias=0.0)
    for (x, y) in B:
        d = math.hypot(x + 0.5 - 10, y + 0.5 - 10)
        burst.set(x, y, ORANGE[4] if d < 5 else ORANGE[3] if d < 7 else ORANGE[2] if d < 8.6 else ORANGE[1])
    done(burst)
    sh = cv()
    S = shape(lambda m, k: m.poly(heater(10, 4.5, 10, 12.5), k))
    fill(sh, S, STEEL, grad=1.0)
    F = shape(lambda m, k: m.poly(heater(10, 6, 7, 9.5), k))
    fill(sh, F, RED, grad=1.0, bevel=False, bias=0.05)
    # cri : « ! » doré
    for y in range(7, 12):
        sh.set(9, y, GOLD[4])
        sh.set(10, y, GOLD[3])
    sh.set(9, 13, GOLD[4])
    sh.set(10, 13, GOLD[2])
    done(sh)
    return layer(burst, sh)


def skill_holy():
    glow = cv()
    G = shape(lambda m, k: (m.poly(star_pts(10, 8.6, 9.0, 4.2, n=8, a0=-90 + 22.5), k), m.ellipse(10, 8.6, 5.2, 5.2, k)))
    for (x, y) in G:
        d = math.hypot(x + 0.5 - 10, y + 0.5 - 8.6)
        glow.set(x, y, '#fffbe0' if d < 3.5 else '#fff090' if d < 5.2 else '#ffc838' if d < 7.2 else '#f08a1a')
    done(glow)
    s = cv()
    blade = shape(lambda m, k: m.poly([(8, 7), (12, 7), (12, 15), (10, 19), (8, 15)], k))
    for (x, y) in blade:
        s.set(x, y, WHITE if x == 8 else '#fff4c0' if x == 9 else '#ffd860' if x == 10 else '#d89a30')
    guard = shape(lambda m, k: m.rect(4, 5, 12, 2, k))
    fill(s, guard, GOLD, grad=1.0)
    grip = shape(lambda m, k: m.rect(9, 3, 2, 2, k))
    for (x, y) in grip:
        s.set(x, y, LEATHER[3] if x == 9 else LEATHER[1])
    pom = shape(lambda m, k: m.ellipse(10, 2.2, 1.5, 1.2, k))
    for (x, y) in pom:
        s.set(x, y, GOLD[4] if x < 10 else GOLD[2])
    s.set(9, 5, ICE[3])
    s.set(10, 5, ICE[2])
    done(s)
    c = layer(glow, s)
    return c


def sword_layer(hx, hy, tx, ty):
    """Épée de la garde (hx,hy) vers la pointe (tx,ty)."""
    s = cv()
    dx, dy = tx - hx, ty - hy
    L = math.hypot(dx, dy)
    ux, uy = dx / L, dy / L
    px, py = -uy, ux
    stroke(s, lambda t: (hx + dx * t, hy + dy * t), lambda t: 2.2 if t < 0.88 else 1.0, STEEL[2])
    for i in range(1, 24):
        t = i / 24
        s.setf(hx + dx * t - px * 0.5 - 0.5, hy + dy * t - py * 0.5 - 0.5, STEEL[4])
    # garde
    stroke(s, lambda t: (hx + px * (t * 6 - 3), hy + py * (t * 6 - 3)), lambda t: 1.5, GOLD[3])
    # poignée + pommeau
    stroke(s, lambda t: (hx - ux * 2.2 * t, hy - uy * 2.2 * t), lambda t: 1.0, LEATHER[2])
    s.set(hx - ux * 3.0 - 0.5, hy - uy * 3.0 - 0.5, GOLD[3])
    return s


def skill_mastery():
    c = cv()
    for sw in (sword_layer(5.0, 15.0, 17.6, 2.4), sword_layer(15.0, 15.0, 2.4, 2.4)):
        done(sw)
        c.paste(sw, 0, 0)
    m = cv()
    D = shape(lambda mm, k: mm.ellipse(10, 13.4, 3.9, 3.9, k))
    sfill(m, D, GOLD, 9.0, 12.4, 5.0)
    I = shape(lambda mm, k: mm.ellipse(10, 13.4, 2.7, 2.7, k))
    for (x, y) in I:
        m.set(x, y, BLUE[2] if x + y < 23 else BLUE[1])
    S = shape(lambda mm, k: mm.poly(star_pts(10, 13.6, 2.4, 1.0), k))
    for (x, y) in S:
        m.set(x, y, GOLD[4] if x < 10 else GOLD[3])
    done(m)
    c.paste(m, 0, 0)
    return c


# ------------------------------------------------------------------ stats / divers
def icon_heart():
    c = cv()
    P = shape(lambda m, k: (m.ellipse(6.2, 7.4, 4.7, 4.7, k), m.ellipse(13.8, 7.4, 4.7, 4.7, k),
                            m.poly([(1.7, 8.8), (18.3, 8.8), (10, 18.4)], k)))
    sfill(c, P, RED, 8.2, 8.0, 10.5, 10.5, bias=0.05)
    edge_light(c, P, None, RED[1])
    for p in ((4, 5), (5, 4), (4, 6)):
        c.set(*p, WHITE)
    for p in ((6, 4), (3, 7), (5, 5)):
        c.set(*p, RED[4])
    done(c)
    return c


def icon_shield():
    c = cv()
    O = shape(lambda m, k: m.poly(heater(10, 1, 17, 18), k))
    fill(c, O, GOLD, grad=1.0)
    I = shape(lambda m, k: m.poly(heater(10, 3, 13, 14), k))
    for (x, y) in I:
        lit = x < 10
        u = (y - 3) / 14
        i = (3 if u < 0.3 else 2) if lit else (2 if u < 0.3 else 1)
        c.set(x, y, BLUE[i])
    for (x, y) in I:
        if (x - 1, y) not in I or (x, y - 1) not in I:
            c.set(x, y, BLUE[0])
    # bande centrale + bossette
    for y in range(4, 16):
        c.setf(9, y, GOLD[3])
        c.setf(10, y, GOLD[2])
    for x in range(4, 16):
        c.setf(x, 8, GOLD[3] if x < 10 else GOLD[2])
    c.set(9, 8, GOLD[4])
    c.set(5, 4, BLUE[4])
    c.set(5, 5, BLUE[4])
    c.set(6, 4, BLUE[4])
    done(c)
    c.set(2, 2, WHITE)
    return c


def icon_bolt():
    c = cv()
    P = shape(lambda m, k: m.poly([(12.5, 0.6), (2.8, 11.2), (8.8, 11.2), (6, 19.4), (17.2, 7.4),
                                   (11.2, 7.4), (15.6, 0.6)], k))
    fill(c, P, YELLOW, grad=1.0)
    edge_light(c, P, YELLOW[4], YELLOW[1])
    done(c)
    c.set(11, 3, WHITE)
    c.set(6, 9, WHITE)
    return c


def icon_skull():
    c = cv()
    P = shape(lambda m, k: (m.ellipse(10, 8.6, 7.4, 7.2, k),
                            m.poly([(5.2, 12), (14.8, 12), (13.8, 18.6), (6.2, 18.6)], k)))
    sfill(c, P, BONE, 8.0, 6.6, 9.5, 10.0)
    edge_light(c, P, None, BONE[1])
    for ex in (7, 13):
        E = shape(lambda m, k: m.ellipse(ex, 10.4, 2.2, 2.3, k))
        for (x, y) in E:
            c.set(x, y, '#2a1830')
    c.set(6, 10, '#4a3050')
    c.set(12, 10, '#4a3050')
    for p in ((9, 13), (10, 13), (9, 14)):
        c.set(*p, '#2a1830')
    # dents
    for x in range(6, 14):
        c.set(x, 16, BONE[1])
    for x in (7, 9, 11):
        c.set(x, 15, BONE[1])
        c.set(x, 17, BONE[1])
    done(c)
    c.set(5, 4, WHITE)
    return c


def icon_lock():
    c = cv(12, 14)
    sh = shape(lambda m, k: m.ellipse(6, 5.6, 4.0, 4.8, k), 12, 14) - \
        shape(lambda m, k: m.ellipse(6, 5.6, 2.0, 2.9, k), 12, 14)
    sh = {p for p in sh if p[1] < 7}
    fill(c, sh, STEEL, grad=1.0)
    body = shape(lambda m, k: m.rect(1, 6, 10, 7, k), 12, 14)
    fill(c, body, GOLD, grad=1.0)
    for x in range(1, 11):
        c.set(x, 6, GOLD[4] if x < 7 else GOLD[3])
    for p in ((5, 8), (6, 8), (5, 9), (6, 9), (5, 10)):
        c.set(*p, OUT)
    c.set(6, 10, GOLD[1])
    done(c)
    return c


def icon_star():
    c = cv(12, 12)
    P = shape(lambda m, k: m.poly(star_pts(6, 6.6, 5.4, 2.3), k), 12, 12)
    fill(c, P, GOLD, grad=1.0)
    c.set(5, 4, GOLD[4])
    c.set(5, 5, WHITE)
    done(c)
    return c


def icon_summon():
    c = cv()
    D = shape(lambda m, k: m.ellipse(10, 10, 8.8, 8.8, k))
    for (x, y) in D:
        d = math.hypot(x + 0.5 - 10, y + 0.5 - 10)
        a = math.atan2(y + 0.5 - 10, x + 0.5 - 10)
        # tourbillon : bras en spirale
        sw = math.sin(a * 3 + d * 0.9)
        if d > 7.2:
            col = GOLD[2] if (x + y) < 20 else GOLD[1]
        elif d < 2.5:
            col = MAGENTA[4]
        else:
            base = 3 if d < 4.3 else 2 if d < 6 else 1
            col = PURPLE[clamp(base + (1 if sw > 0.4 else 0), 0, 4)]
        c.set(x, y, col)
    for (x, y) in D:
        d = math.hypot(x + 0.5 - 10, y + 0.5 - 10)
        if 7.2 < d < 8.1 and x + y < 17:
            c.set(x, y, GOLD[4])
    for p in ((10, 1), (9, 1), (1, 9), (1, 10), (18, 9), (18, 10), (9, 18), (10, 18)):
        c.set(*p, ICE[3])
    done(c)
    # étoile centrale
    for p in ((9, 9), (10, 9), (9, 10), (10, 10)):
        c.set(*p, WHITE)
    for p in ((9, 6), (10, 6), (9, 7), (10, 7), (9, 12), (10, 12), (9, 13), (10, 13), (6, 9), (7, 9), (6, 10),
              (7, 10), (12, 9), (13, 9), (12, 10), (13, 10)):
        c.set(*p, '#fff3b0' if p[0] in (9, 10) and p[1] in (7, 12) or p[1] in (9, 10) and p[0] in (7, 12) else MAGENTA[4])
    for p in ((8, 8), (11, 8), (8, 11), (11, 11)):
        c.set(*p, MAGENTA[4])
    return c


def icon_rebirth():
    c = cv()
    P = set()
    cx, cy = 10, 10
    ring = shape(lambda m, k: m.ellipse(cx, cy, 8.2, 8.2, k)) - shape(lambda m, k: m.ellipse(cx, cy, 5.6, 5.6, k))
    for (x, y) in ring:
        a = math.degrees(math.atan2(y + 0.5 - cy, x + 0.5 - cx)) % 360
        if 200 <= a <= 312 or 20 <= a <= 132:
            P.add((x, y))
    for a_end in (312, 132):
        a = math.radians(a_end)
        b = math.radians(a_end + 44)
        tri = [(cx + 4.0 * math.cos(a), cy + 4.0 * math.sin(a)), (cx + 9.9 * math.cos(a), cy + 9.9 * math.sin(a)),
               (cx + 6.9 * math.cos(b), cy + 6.9 * math.sin(b))]
        P |= shape(lambda m, k: m.poly(tri, k))
    fill(c, P, ORANGE, grad=1.1, bias=0.05)
    # flamme centrale
    F = shape(lambda m, k: (m.ellipse(10, 11.4, 2.4, 2.3, k), m.poly([(10.4, 6.0), (12.4, 10.6), (7.6, 10.6)], k)))
    for (x, y) in F:
        d = math.hypot(x + 0.5 - 10, y + 0.5 - 11.8)
        c.set(x, y, RED[2] if d > 1.9 or y < 8 else YELLOW[3] if d > 0.9 else WHITE)
    done(c)
    return c


def icon_book():
    c = cv()
    pages = shape(lambda m, k: m.rect(5, 4, 13, 15, k))
    for (x, y) in pages:
        c.set(x, y, ENV[3] if (x + y) % 2 else ENV[2])
    for y in range(4, 19):
        c.set(17, y, ENV[1])
    for x in range(5, 18):
        c.set(x, 18, ENV[1])
    cover = shape(lambda m, k: m.rect(2, 2, 14, 15, k))
    fill(c, cover, BOOK, grad=0.9)
    for y in range(2, 17):
        c.set(2, y, BOOK[1])
        c.set(3, y, BOOK[3])
        c.set(4, y, BOOK[0])
    for y in (4, 14):
        for x in range(2, 5):
            c.set(x, y, GOLD[3] if x < 4 else GOLD[1])
    for (x, y) in ((14, 2), (15, 2), (15, 3), (14, 16), (15, 16), (15, 15)):
        c.set(x, y, GOLD[2])
    # emblème : gemme sertie
    E = shape(lambda m, k: m.poly([(10, 5), (14, 9.5), (10, 14), (6, 9.5)], k))
    fill(c, E, GOLD, grad=1.0)
    G = shape(lambda m, k: m.poly([(10, 7.4), (12, 9.5), (10, 11.6), (8, 9.5)], k))
    for (x, y) in G:
        c.set(x, y, GEM[3] if x < 10 and y < 10 else GEM[1])
    c.set(9, 8, WHITE)
    done(c)
    return c


# ------------------------------------------------------------------ boosts (v8.6 : icônes propres, plus de
# réemploi des icônes de compétences) : poing enflammé, double éclair, main dorée, œil-viseur, lame spectrale.
def boost_rage():
    fl = cv()
    F = shape(lambda m, k: (m.poly([(3, 19), (2, 10), (5, 13), (5, 5), (8, 10), (10, 1), (12, 9), (15, 4), (15, 12),
                                    (18, 9), (17, 19)], k)))
    for (x, y) in F:
        fl.set(x, y, RED[1] if y < 6 else RED[2] if y < 10 else ORANGE[2] if y < 14 else ORANGE[3])
    done(fl)
    f = cv()
    # poing fermé : 4 jointures arrondies, pouce replié devant, poignet.
    fist = shape(lambda m, k: (m.ellipse(6.2, 9.5, 2.1, 2.2, k), m.ellipse(9.4, 9.0, 2.1, 2.3, k), m.ellipse(12.6, 9.2, 2.1, 2.2, k),
                               m.ellipse(15.2, 10.2, 1.8, 2.0, k), m.rect(4, 10, 13, 5, k), m.rect(6, 15, 9, 4, k)))
    fill(f, fist, ['#5a2a14', '#9a5232', '#d4875a', '#f2b48a', '#ffd8bc'], grad=1.0)
    for x in (8, 11, 14):
        for y in range(9, 12):
            f.set(x, y, '#9a5232')
    thumb = shape(lambda m, k: m.poly([(4, 13), (11, 12), (12, 14), (5, 15)], k))
    for (x, y) in thumb:
        f.set(x, y, '#e8a074' if y < 14 else '#b86a42')
    for x in range(6, 15):
        f.set(x, 16, RED[2])
        f.set(x, 17, RED[1])
    done(f)
    c = layer(fl, f)
    c.set(9, 4, ORANGE[4])
    return c


def boost_frenzy():
    c = cv()
    for ox in (-3.5, 3.0):
        P = shape(lambda m, k, ox=ox: m.poly([(11 + ox, 1), (4 + ox, 10.5), (8.5 + ox, 10.5), (6.5 + ox, 19),
                                              (14.5 + ox, 8), (10 + ox, 8), (13.5 + ox, 1)], k))
        fill(c, P, YELLOW, grad=1.0)
        edge_light(c, P, YELLOW[4], YELLOW[1])
    for y in (5, 9, 13):
        for x in range(0, 3):
            c.set(x, y, ICE[3])
    done(c)
    c.set(8, 3, WHITE)
    c.set(14, 3, WHITE)
    return c


def boost_midas():
    c = cv()
    hand = shape(lambda m, k: (m.rect(4, 9, 10, 8, k), m.rect(4, 4, 2, 6, k), m.rect(7, 2, 2, 8, k),
                               m.rect(10, 3, 2, 7, k), m.rect(13, 5, 2, 6, k), m.poly([(14, 12), (18, 8), (19, 10), (15, 15)], k)))
    fill(c, hand, GOLD, grad=1.0)
    edge_light(c, hand, GOLD[4], GOLD[1])
    done(c)
    for (x, y) in ((2, 1), (17, 2), (1, 14)):
        sparkle(c, x, y)
    coin_ = shape(lambda m, k: m.ellipse(9, 14, 2.6, 2.6, k))
    for (x, y) in coin_:
        c.set(x, y, YELLOW[4] if x + y < 23 else YELLOW[2])
    return c


def boost_hunter():
    c = cv()
    eye = shape(lambda m, k: m.poly([(1, 10), (5, 5.5), (10, 4), (15, 5.5), (19, 10), (15, 14.5), (10, 16), (5, 14.5)], k))
    for (x, y) in eye:
        c.set(x, y, BONE[4] if y < 10 else BONE[3])
    iris = shape(lambda m, k: m.ellipse(10, 10, 4.2, 4.2, k))
    sfill(c, iris, ICE, 9, 9, 4.5)
    pupil = shape(lambda m, k: m.ellipse(10, 10, 1.8, 1.8, k))
    for (x, y) in pupil:
        c.set(x, y, '#101828')
    done(c)
    # viseur rouge
    for i in range(0, 4):
        for (x, y) in ((10, i), (10, 19 - i), (i, 10), (19 - i, 10)):
            c.set(x, y, RED[3])
    c.set(8, 8, WHITE)
    return c


def boost_phantom():
    ghost = cv()
    for off, col in ((3, PURPLE[1]), (1.5, PURPLE[2])):
        blade = shape(lambda m, k, off=off: m.poly([(3 + off, 17 - off), (15 + off, 3 - off * 0.2), (17 + off, 3 - off * 0.2),
                                                     (17 + off * 0.5, 5), (5 + off, 19 - off)], k))
        for (x, y) in blade:
            ghost.set(x, y, col)
    sw = sword_layer(5.0, 15.0, 17.6, 2.4)
    sw.recolor({STEEL[2]: PURPLE[3], STEEL[4]: PURPLE[4], GOLD[3]: MAGENTA[3], LEATHER[2]: PURPLE[1]})
    done(sw)
    c = layer(ghost, sw)
    sparkle(c, 4, 4, col=PURPLE[4], mid=PURPLE[3])
    return c


# ------------------------------------------------------------------ export
ICONS = [
    ('coin', coin), ('icon_gem', icon_gem), ('icon_ticket', icon_ticket), ('icon_fragment', icon_fragment),
    ('icon_shard', icon_shard), ('icon_essence', icon_essence), ('icon_key', icon_key),
    ('icon_trophy', icon_trophy), ('icon_mail', icon_mail), ('icon_gear', icon_gear), ('icon_chest', icon_chest),
    ('icon_anvil', icon_anvil),
    ('icon_upgrade', icon_upgrade), ('icon_bag', icon_bag), ('icon_hero', icon_hero), ('icon_paw', icon_paw),
    ('skill_quick', skill_quick), ('icon_tree', icon_tree), ('icon_map', icon_map), ('icon_dungeon', icon_dungeon),
    ('icon_boss', icon_boss),
    ('skill_whirl', skill_whirl), ('skill_cry', skill_cry), ('skill_holy', skill_holy),
    ('skill_mastery', skill_mastery),
    ('icon_heart', icon_heart), ('icon_shield', icon_shield), ('icon_bolt', icon_bolt), ('icon_skull', icon_skull),
    ('icon_lock', icon_lock), ('icon_star', icon_star), ('icon_summon', icon_summon), ('icon_rebirth', icon_rebirth),
    ('icon_book', icon_book),
    ('boost_rage', boost_rage), ('boost_frenzy', boost_frenzy), ('boost_midas', boost_midas),
    ('boost_hunter', boost_hunter), ('boost_phantom', boost_phantom),
]


def build():
    return {name: (fn(), {}) for name, fn in ICONS}
