"""Accessoires (v7.5) : icônes 16×16 teintées par l'objet (métal) et sa rareté (pierre)."""
from lib import Canvas, tag

OUT = '#1a1226'
METAL = [tag('item_dark'), tag('item_shade'), tag('item'), tag('item_light')]
GEM = [tag('rarity_dark'), tag('rarity'), tag('rarity_light')]


def gem(c, cx, cy, r):
    c.ellipse(cx, cy, r, r, GEM[1])
    c.ellipse(cx + 0.4, cy + 0.6, r * 0.6, r * 0.6, GEM[0])
    c.ellipse(cx, cy, r * 0.55, r * 0.55, GEM[1])
    c.set(cx - r * 0.4, cy - r * 0.4, GEM[2])
    c.set(cx - r * 0.4 + 1, cy - r * 0.4, GEM[2])


def ring_shape(c, cx, cy, rx, ry, thick):
    for y in range(c.h):
        for x in range(c.w):
            dx, dy = (x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry
            d = (dx * dx + dy * dy) ** 0.5
            inner = 1 - thick / rx
            if inner <= d <= 1:
                t = (dx * -0.7 + dy * -0.7)
                c.set(x, y, METAL[3] if t > 0.45 else METAL[2] if t > -0.2 else METAL[1] if t > -0.6 else METAL[0])


def amulet_ruby():
    c = Canvas(16, 16)
    for i in range(7):
        c.set(2 + i, 1 + i, METAL[2]); c.set(13 - i, 1 + i, METAL[1])
    c.poly([(5, 8), (11, 8), (8, 15)], METAL[2])
    c.poly([(5, 8), (8, 8), (8, 15)], METAL[3])
    gem(c, 8, 10.5, 2.4)
    c.outline(OUT)
    return c


def amulet_pendant():
    c = Canvas(16, 16)
    for i in range(6):
        c.set(3 + i, 1 + i, METAL[2]); c.set(12 - i, 1 + i, METAL[1])
    ring_shape(c, 8, 11, 4.5, 4.5, 1.6)
    gem(c, 8, 11, 2)
    c.outline(OUT)
    return c


def earring_drop():
    c = Canvas(16, 16)
    for ox in (4, 11):
        ring_shape(c, ox, 3.5, 2, 2, 1)
        c.poly([(ox - 2.4, 9), (ox + 2.4, 9), (ox, 15)], GEM[1])
        c.ellipse(ox, 8.5, 2.5, 2.5, GEM[1])
        c.set(ox - 1, 8, GEM[2]); c.set(ox + 1, 11, GEM[0])
        c.set(ox, 6, METAL[2])
    c.outline(OUT)
    return c


def earring_hoop():
    c = Canvas(16, 16)
    for ox in (4.5, 11.5):
        ring_shape(c, ox, 8.5, 3.6, 5.5, 1.4)
        gem(c, ox, 13.2, 1.4)
    c.outline(OUT)
    return c


def ring_band():
    c = Canvas(16, 16)
    ring_shape(c, 8, 9.5, 6, 5, 2)
    gem(c, 8, 4.5, 2.6)
    c.outline(OUT)
    return c


def ring_signet():
    c = Canvas(16, 16)
    ring_shape(c, 8, 10, 6, 5, 1.8)
    c.rect(4, 2, 8, 5, METAL[2])
    c.rect(4, 2, 8, 1, METAL[3]); c.rect(4, 6, 8, 1, METAL[0])
    c.rect(6, 3, 4, 3, GEM[1]); c.set(6, 3, GEM[2]); c.set(9, 5, GEM[0])
    c.outline(OUT)
    return c


def bracelet_thorn():
    c = Canvas(16, 16)
    ring_shape(c, 8, 8, 6.5, 5, 2)
    for x, y in [(2, 4), (14, 4), (8, 1), (3, 12), (13, 12), (8, 14)]:
        c.set(x, y, GEM[1])
    gem(c, 8, 13, 1.4)
    c.outline(OUT)
    return c


def bracelet_cuff():
    c = Canvas(16, 16)
    ring_shape(c, 8, 8, 6.5, 5.5, 3)
    gem(c, 8, 3.5, 1.6)
    gem(c, 3, 8, 1.2)
    gem(c, 13, 8, 1.2)
    c.outline(OUT)
    return c


def build():
    return {
        'amulet_ruby': (amulet_ruby(), {}),
        'amulet_pendant': (amulet_pendant(), {}),
        'earring_drop': (earring_drop(), {}),
        'earring_hoop': (earring_hoop(), {}),
        'ring_band': (ring_band(), {}),
        'ring_signet': (ring_signet(), {}),
        'bracelet_thorn': (bracelet_thorn(), {}),
        'bracelet_cuff': (bracelet_cuff(), {}),
    }
