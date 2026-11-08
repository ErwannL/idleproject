"""v9.2.4 : contrôle automatique de l'orientation des animations PixelLab des ennemis (tous doivent regarder le héros,
vers la gauche, comme leur image de base).

Pour chaque image d'animation (après le miroir de MIRROR dans pixellab_anim.py), on compare sa silhouette et ses
couleurs, ramenées à une grille 24×24 dans leur boîte englobante, à l'image de base et à son miroir :
score = ressemblance(base) − ressemblance(base retournée). Un score nettement négatif (< SEUIL) signale une image
tournée vers la droite. Les images signalées mais vérifiées à l'œil (pose d'attaque très déformée, chute, corps
symétrique) sont listées dans VU_CORRECT. Sortie : liste des images douteuses ; code 1 s'il en reste une non vérifiée.

Usage : python3 tools/art/check_orientation.py [--all]
"""
import glob
import os
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from pixellab_anim import ANIMS, MIRROR, SRC, _base, _clean_alpha  # noqa: E402

N = 24
SEUIL = -0.06
# Images signalées par le score mais vérifiées : elles regardent bien le héros (ou n'ont pas de sens : chute, corps
# symétrique, élan de l'arme vers l'arrière).
VU_CORRECT = {
    ('bat', 'attack'), ('bog_zombie', 'attack'), ('boss_demon_king', 'attack'), ('boss_fallen_knight', 'attack'),
    ('boss_swamp_behemoth', 'attack'), ('boss_swamp_behemoth', 'walk'), ('goblin', 'attack'), ('goblin_shaman', 'attack'),
    ('hard_necromancer', 'attack'), ('hard_scarecrow', 'attack'), ('hard_void_knight', 'walk'), ('harpy', 'attack'),
    ('leech_fly', 'fly'), ('mid_crystal_bat', 'fly'), ('mid_kraken', 'attack'), ('mid_sand_worm', 'attack'),
    ('mid_sand_worm', 'hurt'), ('mini_crab_king', 'attack'), ('mini_goblin_warlord', 'hurt'), ('mini_pharaoh', 'attack'),
    ('mini_reaper', 'attack'), ('mini_reaper', 'hurt'), ('ogre', 'attack'), ('sea_eel', 'attack'), ('sea_octopus', 'attack'),
    ('sea_octopus', 'swim'), ('skeleton', 'attack'), ('skeleton_shield', 'attack'), ('slime_fire', 'attack'),
    ('mini_harpy_queen', 'hurt'), ('mummy', 'attack'), ('mummy', 'emerge'),
    ('mini_toad_king', 'hurt'), ('hard_void_knight', 'attack'), ('wraith', 'attack'),
}
SKIP = ('death', 'emerge', 'portal')  # chute, sortie du sol ou du portail : pas d'orientation à comparer


def _grid(img):
    img = img.crop(img.getbbox()).resize((N, N), Image.BILINEAR)
    return [p for p in (img.getdata() if not hasattr(img, 'get_flattened_data') else img.get_flattened_data())]


def _sim(a, b):
    tot = 0.0
    for p, q in zip(a, b):
        tot += abs(p[3] - q[3]) / 255 + sum(abs(p[i] * p[3] - q[i] * q[3]) for i in range(3)) / (3 * 255 * 255)
    return -tot / len(a)


def score(frame, base_grid, mirror_grid):
    g = _grid(frame)
    return _sim(g, base_grid) - _sim(g, mirror_grid)


def check(show_all=False):
    bad = []
    for key, anims in sorted(ANIMS.items()):
        _view, base, _o, _s = _base(key)
        base = base.convert('RGBA')
        bg, mg = _grid(base), _grid(base.transpose(Image.FLIP_LEFT_RIGHT))
        for anim in anims:
            if anim in SKIP:
                continue
            paths = sorted(glob.glob(os.path.join(SRC, 'anim', f'{key}_{anim}', 'f*.png')), key=lambda p: int(os.path.basename(p)[1:-4]))
            flip = MIRROR.get((key, anim), ())
            for i, p in enumerate(paths):
                f = _clean_alpha(Image.open(p))
                if i in flip:
                    f = f.transpose(Image.FLIP_LEFT_RIGHT)
                s = score(f, bg, mg)
                if s < SEUIL:
                    ok = (key, anim) in VU_CORRECT or i in flip  # image retournée : vérifiée à l'œil après miroir
                    if show_all or not ok:
                        print(f'{"vu    " if ok else "DOUTE "} {key} {anim} image {i} : score {s:+.3f}')
                    if not ok:
                        bad.append((key, anim, i))
    print(f'{len(bad)} image(s) douteuse(s) non vérifiée(s).')
    return bad


if __name__ == '__main__':
    sys.exit(1 if check('--all' in sys.argv) else 0)
