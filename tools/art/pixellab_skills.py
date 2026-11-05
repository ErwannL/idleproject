"""v9.2.5 : gestes de compétence dessinés image par image (PixelLab, animate-pixminimax) — héros (chevalier et 8
apparences : 4 compétences actives et les 2 attaques spéciales de classe, météore et pluie de flèches), compagnons
(chacune de leurs 4 compétences, ultime compris) et familiers.

Chaque compétence a un GESTE (motif : lever les bras, joindre les mains, planter le bâton…) et un EFFET (src/render/skill-fx.js).
La table UNIT_SKILLS (nom de la compétence -> [motif, effet]) est la source unique : elle sert à générer les jobs PixelLab
et elle est écrite dans le fichier généré pour le jeu.

Sources : tools/art/pixellab/anim_skills/<clé>_<motif>/fN.png (f0 et la dernière image = vue de référence ; générées
avec la vue de anim_allies/_ref/<clé>.png en première et dernière image : le geste part du repos et y revient).
Héros : vue sans arme (l'arme reste rangée dans le dos pendant le geste), sauf météore (bâton du mage de feu) et pluie de
flèches (arc de l'archer), où l'arme tenue fait partie du geste.
Nettoyage repris de pixellab_allies.py : alpha franc, poussières, effets détachés, pieds recalés sur la vue, couleurs
ramenées à la palette de la vue (héros recolorés : mêmes rôles de couleur).

Écrit src/render/art-anim-skills.js. Usage : python3 tools/art/pixellab_skills.py
"""
import glob
import json
import os
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)

SRC = os.path.join(HERE, 'pixellab', 'anim_skills')
REF = os.path.join(HERE, 'pixellab', 'anim_allies', '_ref')
FPS = 12

# Héros : compétence -> [motif, effet, suffixe de la vue de référence].
HERO_SKILLS = {
    'quick': ['palm_push', 'ki_wave', ''],
    'whirl': ['sweep', 'whirlwind', ''],
    'cry': ['roar', 'war_cry', ''],
    'holy': ['smite', 'holy_smite', ''],
    'meteor': ['raise_staff', 'meteor', '_pyromancer'],
    # v9.2.5 : la pluie de flèches reprend le tir PixelLab de l'archer (attack_archer, arme déjà séparée : l'arc
    # vraiment équipé y est posé), arc incliné vers le ciel par le jeu ; les gestes « shoot_up » générés gardaient
    # leur propre arc (forme différente, mal repéré par weapon_anchor.py) et ne servent plus au héros.
    'volley': ['attack_archer', 'arrow_rain', '_archer'],
}
HERO_LOOKS = ('knight', 'demoness', 'fairy', 'grombar', 'ninja', 'seraph', 'valkyrie', 'vampire', 'witch')

# Compétences de rôle (src/data/companion-skills.js) : nom -> [motif, effet].
ROLE = {
    'guardian': {'Coup de bouclier': ['shield_bash', 'shield_bash'], 'Provocation': ['taunt', 'taunt'], 'Rempart absolu': ['brace', 'rampart']},
    'archer': {'Flèche perçante': ['aim_shot', 'pierce_arrow'], 'Pluie de flèches': ['shoot_up', 'arrow_rain'], 'Tir du faucon': ['full_draw', 'falcon']},
    'mage': {'Boule de feu': ['cast_forward', 'fireball'], 'Nova de givre': ['plant_staff', 'frost_nova'], 'Météore': ['raise_staff', 'meteor']},
    'assassin': {'Coup bas': ['low_stab', 'low_strike'], 'Danse des lames': ['blade_dance', 'blade_dance'], 'Exécution': ['leap_slash', 'execution']},
    'healer': {'Prière': ['pray', 'prayer'], 'Bénédiction guerrière': ['bless', 'blessing'], 'Lumière divine': ['open_hands', 'divine_light']},
    'berserker': {'Hurlement': ['roar', 'war_howl'], 'Tourbillon sanglant': ['blade_dance', 'blood_whirl'], 'Carnage': ['ground_smash', 'carnage']},
    'pet': {'Morsure': ['pounce', 'bite'], 'Frénésie sauvage': ['howl', 'frenzy'], 'Instinct sauvage': ['charge', 'instinct']},
}
# Compétence propre (et signature des SSR) de chaque compagnon : rôle, compétences propres, motifs remplacés.
UNITS = {
    'squire': ('guardian', {'Taille vaillante': ['slash', 'valiant_cut']}, {}),
    'mercenary': ('berserker', {'Coup de taille': ['slash', 'heavy_cut']}, {}),
    'ranger': ('archer', {'Tir du rôdeur': ['aim_shot', 'ranger_shot']}, {}),
    'pyromancer': ('mage', {'Gerbe de flammes': ['arms_forward', 'flame_spray']}, {'raise_staff': 'raise_arms', 'plant_staff': 'raise_arms'}),
    'priestess': ('healer', {"Prière de l'aube": ['pray', 'dawn_prayer']}, {}),
    'lancer': ('guardian', {'Percée': ['lance_thrust', 'pierce']}, {'shield_bash': 'lance_thrust'}),
    'shadow': ('assassin', {'Lames jumelles': ['twin_slash', 'twin_blades']}, {}),
    'dwarf': ('guardian', {'Hache tournoyante': ['axe_spin', 'axe_whirl']}, {}),
    'azure_paladin': ('guardian', {'Bouclier sacré': ['raise_shield', 'holy_shield']}, {}),
    'rose_blade': ('assassin', {'Valse des épines': ['blade_dance', 'thorn_waltz']}, {}),
    'witch': ('mage', {'Orbe du néant': ['orb_channel', 'void_orb']}, {}),
    'elf_archer': ('archer', {'Volée de flèches': ['shoot_up', 'arrow_rain']}, {}),
    'high_priest': ('healer', {'Rayon sacré': ['point_sky', 'sacred_ray']}, {}),
    'ninja': ('assassin', {'Frappe éclair': ['dash_slash', 'flash_strike']}, {}),
    'barbarian': ('berserker', {'Fureur': ['roar', 'fury']}, {}),
    'archangel': ('healer', {'Jugement céleste': ['point_sky', 'judgement'], 'Aile protectrice': ['spread_wings', 'guardian_wings']}, {'pray': 'pray_sheathe'}),
    'demon_queen': ('mage', {'Brasier infernal': ['raise_arms', 'hellfire'], 'Couronne de cendres': ['raise_arms', 'ash_crown']}, {'plant_staff': 'raise_arms'}),
    'ice_empress': ('mage', {'Tempête de givre': ['arms_forward', 'frost_storm'], 'Hiver éternel': ['plant_staff', 'eternal_winter']}, {}),
    'shadow_lord': ('assassin', {'Lame du néant': ['slash', 'void_blade'], 'Éclipse du néant': ['raise_fist', 'eclipse']}, {}),
    'sylvan_guardian': ('healer', {'Sève de vie': ['open_hands', 'sap_of_life'], 'Récolte sylvestre': ['kneel_ground', 'harvest']}, {}),
    'pet_slime': ('pet', {"Pluie d'or": ['howl', 'gold_rain']}, {}), 'pet_cat': ('pet', {'Griffure': ['pounce', 'claw']}, {}), 'pet_owl': ('pet', {'Piqué nocturne': ['charge', 'dive']}, {}),
    'pet_fairy': ('pet', {'Soin': ['howl', 'fairy_heal']}, {}), 'pet_golem': ('pet', {'Rempart': ['howl', 'rampart']}, {}), 'pet_wisp': ('pet', {'Flamme': ['pounce', 'fireball']}, {}),
}


def _unit_skills():
    out = {}
    for unit, (role, own, swap) in UNITS.items():
        table = {**ROLE[role], **own}
        out[unit] = {name: [swap.get(m, m), fx] for name, (m, fx) in table.items()}
    return out


UNIT_SKILLS = _unit_skills()


def _key(unit):
    return unit if unit.startswith('pet_') else f'ally_{unit}'


# Images écartées à l'œil (personnage retourné, arme parasite, tête coupée) : remplacées par la voisine gardée.
SKIP = {
    'ally_dwarf_axe_spin': (7, 8, 9), 'ally_rose_blade_leap_slash': (7, 8, 9, 10), 'ally_rose_blade_blade_dance': (8, 9),
    'ally_witch_raise_staff': (5, 6), 'hero_demoness_raise_staff': (4, 5), 'hero_demoness_palm_push': (4,), 'hero_demoness_sweep': (5, 6, 7),
    'hero_knight_raise_staff': (4, 5), 'hero_grombar_smite': (1,), 'hero_knight_sweep': (2, 3, 4, 5, 6), 'hero_ninja_sweep': (8,),
    'hero_seraph_sweep': (2, 3, 4, 5, 6, 7, 8, 9), 'hero_seraph_palm_push': (3,), 'hero_valkyrie_raise_staff': (6, 7),
    'hero_valkyrie_sweep': (3, 4, 5, 6), 'hero_vampire_raise_staff': (4, 5, 6), 'hero_vampire_sweep': (3, 4, 5, 6, 7, 8, 9, 10),
    'hero_witch_palm_push': (3, 9, 10), 'hero_witch_raise_staff': (4, 5), 'hero_witch_sweep': (3, 4, 5, 6, 7, 8, 9), 'hero_witch_roar': (7,),
    'pet_slime_howl': (3,), 'ally_shadow_twin_slash': (2, 3, 5), 'hero_grombar_palm_push': (4, 5, 6, 7, 8), 'ally_ice_empress_cast_forward': (6, 7, 8, 9, 10),
    # v9.2.5 : lame du mercenaire en travers du visage (contrôle « visage visible », tests/v925-skills.test.js).
    'ally_mercenary_slash': (4,), 'ally_mercenary_ground_smash': (1, 2),
}


def _off_palette(img, pal, near=60 ** 2):
    px = [p[:3] for p in img.get_flattened_data() if p[3]]
    if not px:
        return 1
    far = sum(1 for p in px if min(sum((p[i] - c[i]) ** 2 for i in range(3)) for c in pal) > near)
    return far / len(px)


def _keep_body(frames, ref, skip):
    """v9.2.5 : image dont le corps a changé de couleurs (halo, silhouette lumineuse) ou écartée à l'œil -> voisine."""
    from pixellab_anim import _palette
    pal = _palette(ref)
    bad = [i in skip or _off_palette(f, pal) > 0.25 for i, f in enumerate(frames)]
    out = []
    for i, f in enumerate(frames):
        if not bad[i]:
            out.append(f)
            continue
        j = next((j for d in range(1, len(frames)) for j in (i - d, i + d) if 0 <= j < len(frames) and not bad[j]), None)
        out.append(frames[j].copy() if j is not None else ref.copy())
    return out


# Gestes où le héros garde son arme en main (classe dont l'arme a servi à la génération) ; les autres : arme dans le dos.
HOLD = {'raise_staff': 'pyromancer'}


def _used():
    used = {f'hero_{look}': {v[0] for v in HERO_SKILLS.values()} - {'attack_archer'} for look in HERO_LOOKS}
    for u, t in UNIT_SKILLS.items():
        used[_key(u)] = {m for m, _ in t.values()}
    return used


def build():
    from multiprocessing import Pool
    import pixellab_allies as pa
    import weapon_anchor as wa
    from pixellab_allies import _grid, _limit, drop_fx, stabilize
    pool = Pool()
    from pixellab_anim import _clean_alpha, _drop_specks, _palette, _remap
    sprites, index = {}, {}
    for d in sorted(glob.glob(os.path.join(SRC, '*'))):
        name = os.path.basename(d)
        motif = next((m for m in MOTIFS if name.endswith('_' + m)), None)
        if not motif:
            continue
        key = name[: -len(motif) - 1]
        if motif not in USED.get(key, ()):  # geste généré mais pris par aucune compétence de ce personnage
            continue
        ref_key = key
        if key.startswith('hero_'):
            suffix = next((s for _, m, s in [(k, *v[::2]) for k, v in HERO_SKILLS.items()] if m == motif), '')
            ref_key = key + suffix
        meta = json.load(open(os.path.join(REF, f'{ref_key}.json')))
        ref = _clean_alpha(Image.open(os.path.join(REF, f'{ref_key}.png')))
        paths = sorted(glob.glob(os.path.join(d, 'f*.png')), key=lambda p: int(os.path.basename(p)[1:-4]))[:-1]
        frames = [drop_fx(_drop_specks(_clean_alpha(Image.open(p))), ref) for p in paths]
        frames = stabilize(frames, ref, 'attack')
        frames = _keep_body(frames, ref, SKIP.get(name, ()))
        # v9.2.5 : héros qui tient son arme pendant le geste (bâton levé du météore, arc de la pluie de flèches) :
        # l'arme dessinée par PixelLab est repérée et effacée de chaque image (weapon_anchor.py, comme les attaques) ;
        # le jeu pose à sa place l'arme vraiment équipée, sur la prise de chaque image (entrée w).
        weapon = None
        cls = HOLD.get(motif) if key.startswith('hero_') else None
        if cls:
            weapon = pa.separate_weapon(frames, key, cls, pool)
            fy0, _ = pa._feet(_clean_alpha(Image.open(os.path.join(REF, f'{key}.png'))))
            for i, f in enumerate(frames):
                fy, _ = pa._feet(f)
                if fy is not None and fy != fy0:
                    frames[i] = pa._shift(f, 0, fy0 - fy)
                    weapon[i][1] += fy0 - fy
        frames = _remap(frames, _palette(_limit(ref)))
        if weapon:
            rest = pa.hand_of(key)
            weapon = [wa.snap_grip(f, p, rest) for f, p in zip(frames, weapon)]
        boxes = [f.getbbox() for f in frames if f.getbbox()]
        ux0, uy0 = min(b[0] for b in boxes), min(b[1] for b in boxes)
        ux1, uy1 = max(b[2] for b in boxes), max(b[3] for b in boxes)
        names = []
        for i, f in enumerate(frames):
            fname = f'sk_{name}{i}'
            crop = f.crop((ux0, uy0, ux1, uy1))
            sprites[fname] = (_grid(crop), {'scale': meta['scale']} if meta.get('scale') else {}, meta.get('roles', {}))
            names.append(fname)
            if os.environ.get('PREVIEW_DIR'):
                p = os.path.join(os.environ['PREVIEW_DIR'], name)
                os.makedirs(p, exist_ok=True)
                crop.save(os.path.join(p, f'f{i}.png'))
        entry = {'frames': names, 'ox': ux0 - meta['ox'], 'oy': uy0 - meta['oy'], 'fps': FPS}
        if weapon:
            entry['w'] = [[p[0] - meta['ox'], p[1] - meta['oy'], *p[2:]] for p in weapon]
        index.setdefault(key, {})[motif] = entry
    return sprites, index


USED = _used()

# Motifs connus (suffixe des dossiers), du plus long au plus court pour que 'raise_arms' ne prenne pas 'arms'.
MOTIFS = sorted({m for t in UNIT_SKILLS.values() for m, _ in t.values()} | {v[0] for v in HERO_SKILLS.values()}, key=len, reverse=True)


def write(sprites, index):
    """Même encodage que src/render/art-anim-allies.js : palette par animation, suites RLE, ligne répétée vide."""
    from lib import FREE_CHARS
    from pixellab_anim import _rle
    lines = [
        '// FICHIER GÉNÉRÉ par tools/art/pixellab_skills.py — ne pas modifier à la main.',
        '// v9.2.5 : gestes de compétence dessinés image par image (PixelLab) : héros, compagnons, familiers.',
        'export const SKILL_ANIM_ART = {',
    ]
    pals, last = {}, {}
    order = lambda k: (k.rstrip('0123456789'), int(k[len(k.rstrip('0123456789')):]))
    for name in sorted(sprites, key=order):
        canvas, extra, roles = sprites[name]
        group = name.rstrip('0123456789')
        pal = pals.setdefault(group, dict(roles))
        free = [ch for ch in FREE_CHARS if ch not in roles.values()]
        rows = []
        for y in range(canvas.h):
            row = []
            for x in range(canvas.w):
                c = canvas.px[y][x]
                if c is None:
                    row.append('.')
                    continue
                if c not in pal:
                    left = [ch for ch in free if ch not in set(pal.values())]
                    pal[c] = left[0] if left else pal[min(pal, key=lambda k: sum((int(k[i:i + 2], 16) - int(c[i:i + 2], 16)) ** 2 for i in (1, 3, 5)))]
                row.append(pal[c])
            rows.append(''.join(row))
        prev = last.get(group)
        enc = ['' if prev and prev[y] == r else _rle(r) for y, r in enumerate(rows)]
        last[group] = rows
        lines.append(f'  {json.dumps(name)}: {json.dumps({"rows": enc, "pr": group, **extra}, ensure_ascii=False, separators=(",", ":"))},')
    lines.append('};')
    lines.append('export const SKILL_ANIM_PALS = ' + json.dumps({g: {ch: c for c, ch in p.items()} for g, p in pals.items()}, separators=(',', ':')) + ';')
    lines.append('// Gestes par personnage et par motif : images, décalage (ox, oy) par rapport au sprite de jeu, images par seconde.')
    lines.append('export const SKILL_ANIMS = ' + json.dumps(index, separators=(',', ':')) + ';')
    lines.append('// Compétences : héros (id -> [motif, effet, vue]) et compagnons (nom de la compétence -> [motif, effet]).')
    lines.append('export const HERO_SKILL_MOTIFS = ' + json.dumps(HERO_SKILLS, separators=(',', ':')) + ';')
    lines.append('export const UNIT_SKILL_MOTIFS = ' + json.dumps({_key(u): t for u, t in UNIT_SKILLS.items()}, ensure_ascii=False, separators=(',', ':')) + ';')
    lines.append('')
    out = os.path.join(ROOT, 'src', 'render', 'art-anim-skills.js')
    with open(out, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))
    print(f'{len(sprites)} images -> {os.path.relpath(out, ROOT)} ({os.path.getsize(out) // 1024} Ko)')


if __name__ == '__main__':
    write(*build())
