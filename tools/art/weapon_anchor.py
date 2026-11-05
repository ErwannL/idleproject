"""v9.2.3 : arme séparée du corps dans les animations PixelLab du héros.

Les images d'attaque ont été générées à partir d'une vue « corps + arme de la classe (rareté Commun) ». Pour que le
jeu puisse poser l'arme VRAIMENT équipée (forme et couleurs de rareté) sur l'animation :
  find_weapon  cherche l'arme de génération dans une image (rotation libre au plus proche voisin autour de la prise,
               comme rotateFree de pixel.js) : position de la prise, angle (degrés horaires depuis « pointe en haut »)
               et devant/derrière le corps ;
  erase_weapon l'efface (et son contour), puis rebouche les trous laissés dans le corps ;
  track_hand   suit la main d'une image de marche (sans arme) à partir de la main de la vue de repos.
Les angles trouvés sont lissés dans le temps (smooth) ; une image sans arme visible reprend l'interpolation.
"""
import json
import math
import os

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
WEAPONS = os.path.join(HERE, 'pixellab', 'anim_allies', '_ref', 'weapons.json')
NEAR = 46  # distance RGB pour « même couleur que l'arme »
_rot_cache = {}


def weapons():
    return json.load(open(WEAPONS))


def _hex(c):
    return [int(c[i:i + 2], 16) for i in (1, 3, 5)]


def rotated(w, deg):
    """Pixels de l'arme tournée de deg autour de la prise : liste (dx, dy, rgb) relative à la prise."""
    key = (w['sprite'], deg)
    if key in _rot_cache:
        return _rot_cache[key]
    rows, g = w['rows'], w['grip']
    h, wd = len(rows), len(rows[0])
    r = math.ceil(math.hypot(wd, h)) + 1
    a = -deg * math.pi / 180
    c, s = math.cos(a), math.sin(a)
    out = []
    for y in range(2 * r):
        for x in range(2 * r):
            dx, dy = x - r, y - r
            sx = math.floor(g['x'] + dx * c - dy * s + 0.5)
            sy = math.floor(g['y'] + dx * s + dy * c + 0.5)
            if 0 <= sx < wd and 0 <= sy < h and rows[sy][sx]:
                out.append((dx, dy, _hex(rows[sy][sx])))
    _rot_cache[key] = out
    return out


def _arr(img):
    a = np.asarray(img.convert('RGBA')).astype(np.int32)
    return a[..., :3], a[..., 3] > 0


def find_weapon(img, w, near_hand=None, near_deg=None, radius=None):
    """Meilleure pose (score, x, y, deg) de l'arme w dans img. near_* : recherche restreinte autour d'une pose."""
    rgb, op = _arr(img)
    H, W = op.shape
    best = (-1e9, 0, 0, 0)
    degs = range(0, 360, 5) if near_deg is None else [(near_deg + d) % 360 for d in range(-40, 45, 5)]
    for deg in degs:
        pts = rotated(w, deg)
        n = len(pts)
        score = np.zeros((H, W))
        for dx, dy, col in pts:
            # score[y, x] : la prise posée en (x, y), le pixel (x+dx, y+dy) de l'image.
            m = np.zeros((H, W))
            ys0, ys1 = max(0, -dy), min(H, H - dy)
            xs0, xs1 = max(0, -dx), min(W, W - dx)
            if ys0 >= ys1 or xs0 >= xs1:
                score -= 1
                continue
            sub_rgb = rgb[ys0 + dy:ys1 + dy, xs0 + dx:xs1 + dx]
            sub_op = op[ys0 + dy:ys1 + dy, xs0 + dx:xs1 + dx]
            d = np.abs(sub_rgb - np.array(col)).sum(-1)
            m[:] = -1  # hors de l'image
            m[ys0:ys1, xs0:xs1] = np.where(sub_op, np.where(d < NEAR, 1.0, -0.15), -1.0)
            score += m
        score /= n
        if near_hand is not None:
            yy, xx = np.mgrid[0:H, 0:W]
            score[(np.abs(xx - near_hand[0]) > radius) | (np.abs(yy - near_hand[1]) > radius)] = -1e9
        i = int(np.argmax(score))
        y, x = divmod(i, W)
        if score[y, x] > best[0]:
            best = (float(score[y, x]), x, y, deg)
    return best


def weapon_mask(img, w, x, y, deg):
    """Pixels de l'image recouverts par l'arme posée (ceux de sa couleur) et pixels de l'empreinte cachés par le corps."""
    rgb, op = _arr(img)
    H, W = op.shape
    hit, hidden = set(), 0
    for dx, dy, col in rotated(w, deg):
        px, py = x + dx, y + dy
        if not (0 <= px < W and 0 <= py < H) or not op[py, px]:
            continue
        if np.abs(rgb[py, px] - np.array(col)).sum() < NEAR:
            hit.add((px, py))
        else:
            hidden += 1
    return hit, hidden


def erase_weapon(img, hit, body_pal, w, x, y, deg, grow=2):
    """Efface l'arme : pixels hit, puis autour de l'empreinte (grow px) les pixels de couleur étrangère au corps
    (body_pal : couleurs de la vue sans arme) ou de la couleur de l'arme, et le contour sombre qui ne borde qu'elle.
    Rebouche ensuite les trous du corps et retire les miettes isolées."""
    px = img.load()
    W, H = img.size
    wcols = {tuple(c) for _, _, c in rotated(w, deg)}
    foot = {(x + dx, y + dy) for dx, dy, _ in rotated(w, deg)}
    zone = set()
    for (fx, fy) in foot:
        for dx in range(-grow, grow + 1):
            for dy in range(-grow, grow + 1):
                zone.add((fx + dx, fy + dy))
    d = lambda a, b: sum(abs(a[i] - b[i]) for i in range(3))
    dark = lambda p: p[3] and sum(p[:3]) < 150
    gone = set(hit)
    for (zx, zy) in zone:
        if not (0 <= zx < W and 0 <= zy < H) or (zx, zy) in gone:
            continue
        p = px[zx, zy]
        if not p[3] or dark(p):
            continue
        alien = min(d(p, c) for c in body_pal) > 30
        weap = min(d(p, c) for c in wcols) < NEAR and (zx, zy) in foot
        if alien or weap:
            gone.add((zx, zy))
    ring = set()
    for (gx, gy) in gone:
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                n = (gx + dx, gy + dy)
                if n in gone or not (0 <= n[0] < W and 0 <= n[1] < H) or not dark(px[n]):
                    continue
                ring.add(n)
    # Contour : effacé s'il ne touche aucun pixel clair du corps (sinon c'est aussi le contour du corps).
    for (rx, ry) in ring:
        body = False
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                n = (rx + dx, ry + dy)
                if n in gone or n in ring or not (0 <= n[0] < W and 0 <= n[1] < H):
                    continue
                if px[n][3] and not dark(px[n]):
                    body = True
        if not body:
            gone.add((rx, ry))
    for p in gone:
        px[p] = (0, 0, 0, 0)
    # Trous dans le corps : un pixel effacé entouré de corps (3 voisins sur 4) reprend la couleur voisine la plus
    # fréquente ; quelques passes pour les traits de 2 à 3 px.
    for _ in range(4):
        fill = {}
        for (gx, gy) in gone:
            if px[gx, gy][3]:
                continue
            ns = [px[gx + dx, gy + dy] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)) if 0 <= gx + dx < W and 0 <= gy + dy < H]
            ns = [n for n in ns if n[3]]
            if len(ns) >= 3:
                fill[(gx, gy)] = max(ns, key=ns.count)
        if not fill:
            break
        for p, c in fill.items():
            px[p] = c
    # Miettes : pixels de la zone qui n'ont plus qu'un voisin opaque (8 voisins), deux passes.
    for _ in range(2):
        drop = []
        for (zx, zy) in zone:
            if not (0 <= zx < W and 0 <= zy < H) or not px[zx, zy][3]:
                continue
            k = sum(1 for dx in (-1, 0, 1) for dy in (-1, 0, 1) if (dx or dy) and 0 <= zx + dx < W and 0 <= zy + dy < H and px[zx + dx, zy + dy][3])
            if k <= 1:
                drop.append((zx, zy))
        for p in drop:
            px[p] = (0, 0, 0, 0)
    return img


def track_hand(ref, frame, hand, half=3, radius=7):
    """Position de la main dans une image de marche : bloc de la vue de repos autour de la main, cherché à ±radius."""
    rr, ro = _arr(ref)
    fr, fo = _arr(frame)
    H, W = ro.shape
    hx, hy = hand
    patch = rr[hy - half:hy + half + 1, hx - half:hx + half + 1]
    pop = ro[hy - half:hy + half + 1, hx - half:hx + half + 1]
    best, at = 1e18, hand
    for y in range(max(half, hy - radius), min(H - half, hy + radius + 1)):
        for x in range(max(half, hx - radius), min(W - half, hx + radius + 1)):
            q = fr[y - half:y + half + 1, x - half:x + half + 1]
            qo = fo[y - half:y + half + 1, x - half:x + half + 1]
            d = (np.abs(q - patch).sum(-1) * (pop & qo)).sum() + 200 * (pop ^ qo).sum() + 2 * ((x - hx) ** 2 + (y - hy) ** 2)
            if d < best:
                best, at = d, (x, y)
    return at
