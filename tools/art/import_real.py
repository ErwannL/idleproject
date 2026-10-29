#!/usr/bin/env python3
"""Illustrations réalistes (version « affiche ») : import dans le jeu.

Déposer les images en pleine résolution (PNG ou JPG, fond sombre uni, comme celles générées dans Canva)
dans assets/hd/real-src/<id>.<ext>, avec <id> = nom du fichier HD actuel sans extension
(grombar, demoness, ally_archangel, hero_knight, pet_cat…), puis lancer :

    python3 tools/art/import_real.py            # toutes les images du dossier
    python3 tools/art/import_real.py grombar    # seulement certaines

Pour chaque image : fond retiré par détourage IA (rembg, modèle isnet-general-use : `pip install "rembg[cpu]"`,
modèle téléchargé au premier lancement), ou à défaut par remplissage depuis les bords sur les couleurs du fond,
recadrage au personnage, hauteur ramenée à 1024 px au plus → assets/hd/real/<id>.png.
Écrit ensuite src/data/hd-real.js (liste des illustrations réalistes disponibles) : le jeu les préfère alors
à la version pixel HD (src/ui/common.js, hdArtUrl).
"""
import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'assets/hd/real-src'
OUT = ROOT / 'assets/hd/real'
MANIFEST = ROOT / 'src/data/hd-real.js'
MAX_H = 1024
TOL = 34.0     # distance de couleur (0–441) sous laquelle un pixel relié au bord est du fond
SOFT = 22.0    # zone de transition au-delà de TOL : alpha progressif (bord adouci)


def remove_background(im):
    try:
        from rembg import new_session, remove
    except ImportError:
        return remove_background_flat(im)
    global _SESSION
    if _SESSION is None:
        _SESSION = new_session('isnet-general-use')
    return remove(im.convert('RGB'), session=_SESSION)


_SESSION = None


def remove_background_flat(im):
    # Secours sans IA : fond uni sombre. Les zones sombres du personnage collées au fond peuvent être rongées.
    rgb = np.asarray(im.convert('RGB')).astype(np.float32)
    h, w, _ = rgb.shape
    border = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
    bg = np.median(border, axis=0)
    # Fond en dégradé possible : on compare aussi à la couleur de la ligne (moyenne des deux bords).
    row_bg = (rgb[:, :8].mean(axis=1) + rgb[:, -8:].mean(axis=1)) / 2
    dist = np.minimum(np.linalg.norm(rgb - bg, axis=2), np.linalg.norm(rgb - row_bg[:, None, :], axis=2))
    # Remplissage depuis les bords : seul le fond relié à l'extérieur est retiré (pas les ombres internes).
    reach = np.zeros((h, w), bool)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if dist[y, x] < TOL + SOFT and not reach[y, x]:
                reach[y, x] = True; q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if dist[y, x] < TOL + SOFT and not reach[y, x]:
                reach[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < h and 0 <= nx < w and not reach[ny, nx] and dist[ny, nx] < TOL + SOFT:
                reach[ny, nx] = True; q.append((ny, nx))
    alpha = np.ones((h, w), np.float32)
    ramp = np.clip((dist - TOL) / SOFT, 0, 1)
    alpha[reach] = ramp[reach]
    a = Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))
    out = im.convert('RGB').copy()
    out.putalpha(a)
    return out


def process(path):
    im = Image.open(path)
    cut = remove_background(im)
    bbox = cut.getchannel('A').point(lambda v: 255 if v > 16 else 0).getbbox()
    if bbox:
        pad = 8
        bbox = (max(0, bbox[0] - pad), max(0, bbox[1] - pad), min(cut.width, bbox[2] + pad), min(cut.height, bbox[3] + pad))
        cut = cut.crop(bbox)
    if cut.height > MAX_H:
        cut = cut.resize((round(cut.width * MAX_H / cut.height), MAX_H), Image.LANCZOS)
    OUT.mkdir(parents=True, exist_ok=True)
    dest = OUT / f'{path.stem}.png'
    cut.save(dest, optimize=True)
    return dest, cut.size


def write_manifest():
    ids = sorted(p.stem for p in OUT.glob('*.png')) if OUT.exists() else []
    MANIFEST.write_text(
        '// Généré par tools/art/import_real.py — illustrations réalistes disponibles (assets/hd/real/<id>.png).\n'
        '// Le jeu les préfère à la version pixel HD quand elles existent.\n'
        f'export const HD_REAL = new Set({ids!r});\n')
    return ids


def main():
    wanted = set(sys.argv[1:])
    files = sorted(p for p in SRC.glob('*') if p.suffix.lower() in ('.png', '.jpg', '.jpeg', '.webp')) if SRC.exists() else []
    for p in files:
        if wanted and p.stem not in wanted:
            continue
        dest, size = process(p)
        print(f'{p.name} → {dest.relative_to(ROOT)} {size[0]}×{size[1]}')
    ids = write_manifest()
    print(f'{len(ids)} illustration(s) réaliste(s) dans {MANIFEST.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
