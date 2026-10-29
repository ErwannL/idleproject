"""Armes de classe, poses de tir et projectiles (classes du héros).

Contrat (build) :
  weapon_*  : armes verticales, bout actif en haut, extra {'grip'} = pixel tenu en main
              (ITEM = matière principale, RAR = gemme / accent : recolorés à l'exécution)
  hero_aim, hero_shoot : poses de tir à l'arc, faites avec la machinerie de knight.body()
              (mains imposées : aim (33, 29), shoot (32, 29), rot 0 — contrat partagé, ne pas changer)
  fx_*      : projectiles à couleurs fixes, orientés vers la droite

Aperçu : python3 tools/art/classes_gear.py  ->  tools/art/preview_classes_gear.png
"""
import math

import knight
from knight import (ITEM, RAR, LEATHER, OUT, STEEL, TRIM, arm, framed, layer, leg, pauldron_front, torso,
                    UNDER, BACK_LEG_X, FRONT_LEG_X, HIP_Y)
from lib import Canvas

WHITE = '#ffffff'
STRING = ['#8c8270', '#e6dcc4']  # corde : ombre, clair


def grid(rows, legend):
    """Canvas depuis une grille de caractères ('.' = vide)."""
    c = Canvas(max(len(r) for r in rows), len(rows))
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch != '.':
                c.set(x, y, legend[ch])
    return c


# Légende commune des armes : L/M/S/D objet (clair -> très sombre), h/r/d rareté (clair -> sombre),
# k/l/m/n cuir (clair -> sombre), s/t corde (clair, ombre), w blanc, o contour.
LEG = {
    'L': ITEM[3], 'M': ITEM[2], 'S': ITEM[1], 'D': ITEM[0],
    'h': RAR[2], 'r': RAR[1], 'd': RAR[0],
    'k': LEATHER[3], 'l': LEATHER[2], 'm': LEATHER[1], 'n': LEATHER[0],
    's': STRING[1], 't': STRING[0], 'w': WHITE, 'o': OUT,
}


def weapon(rows, grip, legend=LEG):
    c = grid(rows, legend)
    c.outline(OUT, skip=(OUT,))
    return c, grip


# ---------------------------------------------------------------- armes

def weapon_bow():
    """Arc court recourbé : branches d'objet, poignée de cuir, embouts de rareté, corde à gauche."""
    return weapon([
        '....hr...',
        '...tLS...',
        '...sLM...',
        '...s.LS..',
        '...s.LMS.',
        '...s..LMS',
        '...s..LMS',
        '...s...LM',
        '...s...LM',
        '...s..hrd',
        '...s..lmn',
        '...s..kmn',
        '...s..lmn',
        '...s..hrd',
        '...s...LM',
        '...s...LM',
        '...s..LMS',
        '...s..LMS',
        '...s.LMS.',
        '...s.LS..',
        '...sLM...',
        '...tLS...',
        '....rd...',
    ], (6, 11))


def weapon_longbow():
    """Arc long elfique : branches fines et élancées, feuilles de rareté aux pointes, gemme à la poignée."""
    return weapon([
        '...hr....',
        '..hrLS...',
        '...tLM...',
        '...s.LS..',
        '...s.LS..',
        '...s..LS.',
        '...s..LS.',
        '...s..LMS',
        '...s...LS',
        '...s...LS',
        '...s...LS',
        '...s...LS',
        '...s..ddd',
        '...s..lmn',
        '...s..khd',
        '...s..lmn',
        '...s..ddd',
        '...s...LS',
        '...s...LS',
        '...s...LS',
        '...s...LS',
        '...s..LMS',
        '...s..LS.',
        '...s..LS.',
        '...s.LS..',
        '...s.LS..',
        '...tLM...',
        '..hrLS...',
        '...rd....',
    ], (6, 14))


def weapon_crossbow():
    """Arbalète (verticale : arc en travers en haut, carreau engagé vers le haut) ; tournée à 90° pour tirer."""
    return weapon([
        '.......w.......',
        '......LMS......',
        '......LMS......',
        '.......m.......',
        '.....SLmLS.....',
        '...LMMSmSMML...',
        '.LMSS..m...SSML',
        'LS.s..hmd...t.S',
        'L...s.dnd..t..S',
        '.....s.m..t....',
        '......skkt.....',
        '.......km......',
        '......hrd......',
        '.......km......',
        '.......lm......',
        '......dlm......',
        '.......km......',
        '.......lm......',
        '.......lmn.....',
        '.......kmn.....',
        '.......hrd.....',
    ], (7, 15))


def weapon_halberd():
    """Hallebarde : pique, fer de hache vers l'avant, croc arrière ; hampe longue, prise basse."""
    return weapon([
        '......L......',
        '......LS.....',
        '.....LMS.....',
        '.....LMS.....',
        '......M......',
        '.....hrd.LLMS',
        '..SD.LMS.LMMS',
        '...SDLMSLMMSD',
        '....SrhdLMMSD',
        '.....LMSLMMSD',
        '.....LMS.LMSD',
        '.....hrd..LSD',
        '......lm...SD',
        '......km.....',
        '......lm.....',
        '......lm.....',
        '......km.....',
        '......lm.....',
        '......lm.....',
        '......rd.....',
        '......lm.....',
        '......km.....',
        '......lm.....',
        '......lm.....',
        '......km.....',
        '......lm.....',
        '......lm.....',
        '......km.....',
        '......lm.....',
        '......rd.....',
        '......SD.....',
    ], (6, 24))


def weapon_katar():
    """Katar : large lame triangulaire à nervure, garde de rareté, cadre en H tenu par la barre."""
    return weapon([
        '....L....',
        '....LS...',
        '...LMS...',
        '...LwS...',
        '...LMS...',
        '...LMSD..',
        '..LLMSD..',
        '..LwMSD..',
        '..LLMSD..',
        '..LLMSDD.',
        '.hrrhrrd.',
        '.d.....d.',
        '.L.....S.',
        '.LkklmmS.',
        '.L.....S.',
        '.r.....d.',
    ], (4, 13))


def weapon_wand():
    """Baguette : cristal de rareté lumineux serti dans des griffes d'objet, tige spiralée."""
    c, grip = weapon([
        '...h...',
        '..hwh..',
        '..hhr..',
        '.Lhhrd.',
        '.LhrrS.',
        '..Mrd..',
        '..LMS..',
        '...M...',
        '...LS..',
        '...MS..',
        '...LS..',
        '...MS..',
        '...LS..',
        '...ln..',
        '...kn..',
        '...ln..',
        '...rd..',
    ], (3, 14))
    # étincelles autour du cristal (après contour : flottent librement)
    for x, y in ((0, 1), (6, 0)):
        if c.get(x, y) is None:
            c.set(x, y, RAR[2])
    return c, grip


def weapon_scepter():
    """Sceptre : orbe de rareté dans une couronne ailée d'objet, fût annelé, pommeau de rareté."""
    return weapon([
        '.....L.....',
        '....LhL....',
        '...hhrrd...',
        'L.hwhrrrd.S',
        'LLhhrrrrdSS',
        '.LMhrrrdMS.',
        '..LMrddMS..',
        '...LMMMS...',
        '....LMS....',
        '....hrd....',
        '.....MS....',
        '.....LS....',
        '.....MS....',
        '....LMSD...',
        '.....lm....',
        '.....km....',
        '.....lm....',
        '.....km....',
        '.....lm....',
        '....LMSD...',
        '.....hd....',
    ], (5, 16))


def weapon_scythe():
    """Faux : longue hampe, grande lame d'objet recourbée vers l'avant (droite) et vers le bas."""
    return weapon([
        '...LLLL..........',
        '..LMMMMLLLL......',
        '.hLMMMMMMMMLLL...',
        '.rdSSMMMMMMMMMLL.',
        '..lm..SSSSMMMMMML',
        '..km......SSSSMMS',
        '..lm..........SSS',
        '..rd...........SS',
        '..lm............S',
        '..lm.............',
        '..km.............',
        '..lm.............',
        '..lm.............',
        '..km.............',
        '..lm.............',
        '..rd.............',
        '..lm.............',
        '..lm.............',
        '..km.............',
        '..lm.............',
        '..lm.............',
        '..km.............',
        '..lm.............',
        '..lm.............',
        '..km.............',
        '..lm.............',
        '..rd.............',
        '..hd.............',
    ], (2, 22))


WEAPONS = (
    ('weapon_bow', weapon_bow), ('weapon_longbow', weapon_longbow), ('weapon_crossbow', weapon_crossbow),
    ('weapon_halberd', weapon_halberd), ('weapon_katar', weapon_katar), ('weapon_wand', weapon_wand),
    ('weapon_scepter', weapon_scepter), ('weapon_scythe', weapon_scythe),
)


# ---------------------------------------------------------------- poses de tir

RANGED = {
    #         torse     tête      pied arrière  pied avant  main      coude avant  bras arrière
    'aim':   ((0, 0), (-1, 0), (-4, 0), (4, 0), (33, 29), (30, 28), 'draw'),
    'shoot': ((-1, 0), (-2, 0), (-4, 0), (4, 0), (32, 29), (29, 28), 'release'),
}


def ranged_body(pose):
    """Comme knight.body(), avec un bras arrière qui bande / lâche la corde."""
    (tx, ty), (hx, hy), (bdx, blift), (fdx, flift), hand, elbow, back = RANGED[pose]
    c = layer()
    c.rect(17 + hx, 22 + hy, 9, 3, STEEL[1])
    sh = (15 + tx, 27 + ty)
    if back == 'release':  # bras arrière qui s'ouvre vers l'arrière après le lâcher
        arm(c, sh, (11 + tx, 27 + ty), (8 + tx, 25 + ty), far=True)
    c.rect(15 + tx, 36 + ty, 11, 4, UNDER)
    leg(c, BACK_LEG_X + tx * 0.5, HIP_Y, BACK_LEG_X + bdx, blift, far=True)
    leg(c, FRONT_LEG_X + tx * 0.5, HIP_Y, FRONT_LEG_X + fdx, flift, far=False)
    torso(c, tx, ty)
    if back == 'draw':  # coude arrière levé, main ramenée contre la poitrine (corde tirée)
        arm(c, (16 + tx, 27 + ty), (12 + tx, 25 + ty), (21 + tx, 29 + ty), far=True)
    arm(c, (27 + tx, 28 + ty), elbow, hand)
    pauldron_front(c, tx, ty)
    return c, {'hand': {'x': hand[0], 'y': hand[1]}, 'rot': 0,
               'head': {'x': hx, 'y': hy}, 'torso': {'x': tx, 'y': ty}}


# ---------------------------------------------------------------- projectiles

WOOD = ['#5a3418', '#8a5a2e', '#c08a4e', '#e2b77a']
IRON = ['#3a4458', '#7d8ba0', '#c3ceda', '#f4f8fc']
FEATH = ['#8e1e2e', '#d8394a', '#f4f0e8']
FIRE = ['#5a0e12', '#a8201a', '#e0461c', '#f78a1e', '#ffc23c', '#fff0a0', '#ffffff']


def fx_arrow():
    return grid([
        'ff......i..',
        'nwwwwwwIIIi',
        'gg......i..',
    ], {'f': FEATH[2], 'g': FEATH[1], 'n': WOOD[0], 'w': WOOD[2], 'I': IRON[2], 'i': IRON[1]})


def blob(c, cx, cy, rx, ry, col, wob=0.0, ph=0.0):
    """Ellipse à bord ondulé (flammes, volutes)."""
    for y in range(int(cy - ry - 2), int(cy + ry + 3)):
        for x in range(int(cx - rx - 2), int(cx + rx + 3)):
            dx, dy = x + 0.5 - cx, y + 0.5 - cy
            a = math.atan2(dy, dx)
            r = 1 + wob * math.sin(a * 3 + ph)
            if (dx / max(rx, 0.01)) ** 2 + (dy / max(ry, 0.01)) ** 2 <= r * r:
                c.set(x, y, col)


def trail(c, x0, x1, cy, h0, h1, colors, frame, amp=0.8, freq=0.9):
    """Traînée vers la gauche : demi-hauteur h0 (à x1, tête) -> h1 (à x0, queue), ondulée par image."""
    for x in range(x0, x1 + 1):
        u = (x1 - x) / max(1, x1 - x0)  # 0 tête .. 1 queue
        hh = h0 + (h1 - h0) * u
        yc = cy + amp * u * math.sin(x * freq + frame * 2.4)
        for y in range(int(yc - hh - 1), int(yc + hh + 2)):
            d = abs(y + 0.5 - yc) / max(hh, 0.01)
            if d > 1:
                continue
            k = d * 0.55 + u * 0.75
            idx = min(len(colors) - 1, int(k * len(colors)))
            c.set(x, y, colors[idx])


def fx_arrow_fire(frame):
    c = Canvas(15, 7)
    ph = frame * 2.7
    # flammes léchant la flèche, vers l'arrière
    fl = [FIRE[5], FIRE[4], FIRE[3], FIRE[2], FIRE[1]]
    for x in range(1, 13):
        u = (12 - x) / 11
        top = 3 - (1.2 + 1.6 * (1 - u)) * (0.6 + 0.4 * math.sin(x * 1.3 + ph)) - (0.4 if x > 9 else 0)
        bot = 3 + (0.8 + 1.4 * (1 - u)) * (0.6 + 0.4 * math.sin(x * 1.7 - ph))
        for y in range(int(math.floor(top)), int(math.ceil(bot)) + 1):
            d = abs(y - 3) / max(1, (bot - top) / 2)
            idx = min(len(fl) - 1, int(d * 1.6 + u * 2.6))
            c.set(x, y, fl[idx])
    # langues isolées
    for x, y in (((3, 0), (6, 1)) if frame == 1 else ((4, 1), (7, 0))):
        c.set(x, y, FIRE[3])
    for x, y in (((2, 6), (8, 6)) if frame == 1 else ((5, 6),)):
        c.set(x, y, FIRE[2])
    c.outline('#3a0a10')
    # flèche par-dessus : fût, pointe chauffée à blanc
    for x in range(0, 11):
        c.set(x, 3, WOOD[1] if x < 3 else '#3a2010' if x < 9 else WOOD[0])
    c.set(0, 2, FEATH[2]); c.set(1, 2, FEATH[2]); c.set(0, 4, FEATH[1]); c.set(1, 4, FEATH[1])
    c.set(11, 2, FIRE[5]); c.set(11, 3, WHITE); c.set(12, 3, FIRE[5]); c.set(13, 3, FIRE[4]); c.set(11, 4, FIRE[4])
    c.set(10, 3, FIRE[4])
    return c


def fx_bolt():
    return grid([
        'f.nnnnI..',
        'wwwwwwIIi',
        'g.nnnnI..',
    ], {'f': FEATH[2], 'g': FEATH[1], 'n': WOOD[0], 'w': WOOD[2], 'I': IRON[2], 'i': IRON[1]})


def fx_fireball(frame):
    c = Canvas(13, 11)
    ph = frame * 2.5
    tr = [FIRE[4], FIRE[3], FIRE[3], FIRE[2], FIRE[2], FIRE[1]]
    trail(c, 1, 8, 5.5, 3.2, 0.9, tr, frame, amp=0.9, freq=1.1)
    blob(c, 8.2, 5.5, 3.9, 3.7, FIRE[3], wob=0.12, ph=ph)
    blob(c, 8.6, 5.5, 2.9, 2.7, FIRE[4], wob=0.1, ph=-ph)
    c.ellipse(9.0, 5.2, 1.8, 1.7, FIRE[5])
    c.set(9, 4, WHITE); c.set(9, 5, WHITE); c.set(10, 5, WHITE)
    # étincelles détachées
    for x, y in (((1, 2), (3, 8)) if frame == 1 else ((2, 8), (0, 4))):
        c.set(x, y, FIRE[3])
    c.outline('#3a0a10')
    return c


GHOST = ['#0c3a3a', '#13695e', '#1fa58a', '#4fe0b0', '#a8ffd8', '#effff6']


def fx_soul(frame):
    c = Canvas(13, 10)
    tr = [GHOST[4], GHOST[3], GHOST[3], GHOST[2], GHOST[2], GHOST[1]]
    trail(c, 0, 7, 4.5, 2.6, 0.6, tr, frame, amp=1.3, freq=1.0)
    # crâne (de trois quarts, tourné vers la droite)
    sk = grid([
        '..WWh..',
        '.WWhhh.',
        'Whhhhhg',
        'Whoohoo',
        'hhoohoo',
        '.hhhmhg',
        '..hgh..',
    ], {'W': GHOST[5], 'h': GHOST[4], 'g': GHOST[3], 'o': GHOST[0], 'm': GHOST[1]})
    c.paste(sk, 5, 1)
    if frame == 2:
        c.set(1, 1, GHOST[3]); c.set(3, 8, GHOST[2])
    else:
        c.set(2, 8, GHOST[3]); c.set(0, 2, GHOST[2])
    c.outline('#06201f')
    return c


ICE = ['#1a2c6a', '#2e5cc0', '#5aa4f0', '#a8e4ff', '#e8fbff', '#ffffff']


def shard(c, cx, cy, ang, length, width, back=None):
    """Éclat de glace : losange allongé orienté (ang en degrés), facettes claires en haut-gauche."""
    back = length if back is None else back
    a = math.radians(ang)
    ux, uy = math.cos(a), math.sin(a)
    vx, vy = -uy, ux
    for y in range(int(cy - 6), int(cy + 7)):
        for x in range(int(cx - 6), int(cx + 7)):
            dx, dy = x + 0.5 - cx, y + 0.5 - cy
            u, v = dx * ux + dy * uy, dx * vx + dy * vy
            lim = length if u >= 0 else back
            if abs(u) / lim + abs(v) / width > 1:
                continue
            facet = (v * (-0.6 * vx - 0.8 * vy)) > 0
            col = ICE[4] if facet else ICE[2]
            if abs(v) < 0.6:
                col = ICE[3]
            if abs(u) > lim * 0.7:
                col = ICE[3] if facet else ICE[1]
            c.set(x, y, col)


def fx_frost(frame):
    c = Canvas(11, 11)
    cx, cy = 5.5, 5.5
    base = 0 if frame == 1 else 45
    shard(c, cx, cy, base + 90, 3.2, 1.4)
    shard(c, cx, cy, base, 5.2, 1.9, back=4.2)
    c.set(5, 5, ICE[5]); c.set(4, 5 if frame == 1 else 4, ICE[5])
    c.outline(ICE[0])
    return c


ROCK = ['#2a1a1a', '#4a302a', '#6e4a3a', '#94705a']


def fx_meteor():
    c = Canvas(17, 17)
    # traînée de flammes vers le haut-gauche (la chute va vers le bas-droite)
    fl = [FIRE[5], FIRE[4], FIRE[3], FIRE[3], FIRE[2], FIRE[2], FIRE[1]]
    rc = (10.5, 10.5)
    for i in range(60):
        t = i / 59
        x = rc[0] - t * 9.5
        y = rc[1] - t * 9.5
        r = 4.6 * (1 - t) ** 0.8 + 0.4
        wob = 0.8 * math.sin(t * 13) * t
        col = fl[min(len(fl) - 1, int(t * len(fl) * 1.15))]
        c.ellipse(x + wob, y - wob, r, r, col)
    # rocher
    rk = Canvas(17, 17)
    knight.ball(rk, rc[0] + 0.5, rc[1] + 0.5, 4.0, 3.8, [ROCK[0], ROCK[1], ROCK[2], ROCK[3], '#b89070'],
                light=(-0.6, -0.6, 0.5))
    for x, y in ((11, 9), (12, 10), (12, 11), (10, 12), (9, 12), (13, 12)):
        rk.setf(x, y, FIRE[3] if (x + y) % 2 else FIRE[4])  # fissures de lave
    rk.setf(13, 11, FIRE[2])
    c.paste(rk, 0, 0)
    # front incandescent (haut-gauche du rocher)
    for x, y in ((8, 8), (9, 7), (7, 9), (10, 7), (7, 10)):
        c.set(x, y, FIRE[5])
    c.outline('#2a0808')
    return c


# ---------------------------------------------------------------- assemblage

def build():
    out = {}
    for name, fn in WEAPONS:
        cv, grip = framed(*fn())
        out[name] = (cv, {'grip': {'x': grip[0], 'y': grip[1]}})
    for pose in RANGED:
        out[f'hero_{pose}'] = ranged_body(pose)
    out['fx_arrow'] = (fx_arrow(), {})
    out['fx_arrow_fire1'] = (fx_arrow_fire(1), {})
    out['fx_arrow_fire2'] = (fx_arrow_fire(2), {})
    out['fx_bolt'] = (fx_bolt(), {})
    out['fx_fireball1'] = (fx_fireball(1), {})
    out['fx_fireball2'] = (fx_fireball(2), {})
    out['fx_soul1'] = (fx_soul(1), {})
    out['fx_soul2'] = (fx_soul(2), {})
    out['fx_frost1'] = (fx_frost(1), {})
    out['fx_frost2'] = (fx_frost(2), {})
    out['fx_meteor'] = (fx_meteor(), {})
    return out


# ---------------------------------------------------------------- aperçu

SAMPLE = {  # couleurs d'objet (BASE_PALETTE de sprites.js) + rareté dorée
    'a': '#c9d1db', 'A': '#8a94a3', '1': '#eef2f7', '2': '#4f5866',
    'r': '#ffc23c', '3': '#fff0a0', '9': '#b0701a',
}


def _resolve(c):
    from lib import preview_color
    out = Canvas(c.w, c.h)
    for y in range(c.h):
        for x in range(c.w):
            p = c.px[y][x]
            if p is not None:
                out.px[y][x] = SAMPLE.get(p[1], preview_color(p)) if p.startswith('@') else p
    return out


def _rot_cw(c, turns):
    for _ in range(turns):
        r = Canvas(c.h, c.w)
        for y in range(r.h):
            for x in range(r.w):
                r.px[y][x] = c.px[c.h - 1 - x][y]
        c = r
    return c


def compose(body_name, weapon_name, sprites):
    """Reproduit heroComposite() : cape, écu, corps, casque par défaut, arme tournée sur la main."""
    BX, BY = 10, 16
    out = Canvas(64, 66)
    body, ex = sprites[body_name]
    tx, ty = ex['torso']['x'], ex['torso']['y']
    hx, hy = ex['head']['x'], ex['head']['y']
    kn = knight_sprites()
    cape, _ = kn['cape_a']
    out.paste(cape, BX + tx, BY + ty)
    sh, sx = kn['shield']
    out.paste(sh, BX + tx + sx['x'], BY + ty + sx['y'])
    out.paste(body, BX, BY)
    hel, hex_ = kn['helmet_default']
    out.paste(hel, BX + hx, BY + hy + hex_['oy'])
    if weapon_name:
        wc, wex = sprites[weapon_name]
        turns = round(ex['rot'] / 90) % 4
        gx, gy = wex['grip']['x'], wex['grip']['y']
        w, h = wc.w, wc.h
        for _ in range(turns):
            gx, gy = h - 1 - gy, gx
            w, h = h, w
        out.paste(_rot_cw(wc, turns), BX + ex['hand']['x'] - gx, BY + ex['hand']['y'] - gy)
    return out


_KN = None


def knight_sprites():
    global _KN
    if _KN is None:
        _KN = knight.build()
    return _KN


def preview(path):
    from PIL import Image, ImageDraw
    from lib import hex2rgb
    sp = build()
    sp.update({k: v for k, v in knight_sprites().items() if k.startswith('hero_')})
    S = 6
    rows = [
        [(n, sp[n][0]) for n, _ in WEAPONS],
        [(n, sp[n][0]) for n in ('fx_arrow', 'fx_arrow_fire1', 'fx_arrow_fire2', 'fx_bolt', 'fx_fireball1',
                                 'fx_fireball2', 'fx_soul1', 'fx_soul2', 'fx_frost1', 'fx_frost2', 'fx_meteor')],
        [('aim+bow', compose('hero_aim', 'weapon_bow', sp)), ('shoot+bow', compose('hero_shoot', 'weapon_bow', sp)),
         ('aim+longbow', compose('hero_aim', 'weapon_longbow', sp)),
         ('aim (nu)', compose('hero_aim', None, sp)), ('shoot (nu)', compose('hero_shoot', None, sp))],
        [('atk2+crossbow', compose('hero_attack2', 'weapon_crossbow', sp)),
         ('idle+halberd', compose('hero_idle', 'weapon_halberd', sp)),
         ('atk1+scythe', compose('hero_attack1', 'weapon_scythe', sp)),
         ('cast+wand', compose('hero_cast', 'weapon_wand', sp)),
         ('cast+scepter', compose('hero_cast', 'weapon_scepter', sp)),
         ('atk2+katar', compose('hero_attack2', 'weapon_katar', sp))],
    ]
    pad = 10
    row_scale = [S, S, 4, 4]
    widths = [sum(c.w * s + pad for _, c in r) + pad for r, s in zip(rows, row_scale)]
    heights = [max(c.h for _, c in r) * s + pad * 2 + 12 for r, s in zip(rows, row_scale)]
    # bande 1× en bas (lisibilité à taille réelle)
    strip_h = 150
    W = max(widths)
    img = Image.new('RGBA', (W, sum(heights) + strip_h), hex2rgb('#3a4a5e') + (255,))
    dr = ImageDraw.Draw(img)
    y0 = 0
    for r, s, hgt in zip(rows, row_scale, heights):
        x0 = pad
        for name, c in r:
            rc = _resolve(c)
            base = y0 + hgt - pad - rc.h * s
            for y in range(rc.h):
                for x in range(rc.w):
                    if rc.px[y][x]:
                        dr.rectangle([x0 + x * s, base + y * s, x0 + x * s + s - 1, base + y * s + s - 1],
                                     fill=hex2rgb(rc.px[y][x]) + (255,))
            dr.text((x0, y0 + 2), name, fill=(230, 230, 240, 255))
            x0 += rc.w * s + pad
        y0 += hgt
    # 1× : tout, sur fond clair et fond sombre
    x0 = pad
    for name, c in [x for r in rows for x in r]:
        rc = _resolve(c)
        for k, bg in enumerate(('#3a4a5e', '#8fb070')):
            oy = y0 + 4 + k * 72
            dr.rectangle([x0 - 1, oy, x0 + rc.w, oy + 68], fill=hex2rgb(bg) + (255,))
            for y in range(rc.h):
                for x in range(rc.w):
                    if rc.px[y][x]:
                        img.putpixel((x0 + x, oy + 68 - rc.h + y), hex2rgb(rc.px[y][x]) + (255,))
        x0 += rc.w + 4
    img.save(path)


if __name__ == '__main__':
    import os
    preview(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'preview_classes_gear.png'))
    for n, (c, e) in build().items():
        print(n, f'{c.w}x{c.h}', e)
