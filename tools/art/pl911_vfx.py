"""v9.11 (1) : nouvelles animations de compétences, dessinées image par image par PixelLab (même point d'accès et même
construction que tools/art/pixellab_vfx.py), plus grandes (2 à 3 fois le lanceur), en 3 temps : préparation,
impact, retombée. Atlas séparé (sa propre palette) : src/render/art-vfx2.js, lu par src/render/vfx.js.

Usage :
  PIXELLAB_API_KEY=… python3 tools/art/pl911_vfx.py gen [noms…]
  python3 tools/art/pl911_vfx.py build
"""
import os
import re
import sys

import pixellab_vfx as P

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
P.SRC = os.path.join(HERE, 'pixellab911', 'vfx')
P.OUT = os.path.join(ROOT, 'src', 'render', 'art-vfx2.js')
THREE = ' The animation has three beats: a short build-up glow with particles converging, a big bright impact flash, then falling sparks, smoke and embers that fade out.'
P.VFX = {
    # Cri de guerre : onde dorée qui part du héros et traverse l'équipe ; petite flamme dorée de buff aux pieds.
    'v_war_wave': [96, 'a war cry shockwave: a large golden glowing crescent wave of energy, as tall as two people, sweeping horizontally with layered ripples, motion streaks and golden sparks, 12 frames'], #
    'v_buff_flame': [18, 'a small golden flame aura burning at the feet of a character, gentle flickering golden fire with tiny rising sparks, looping 8 frames'],
    # Coup critique : arc en dégradé (blanc au bord, doré au centre, transparent au bout) avec traînée, étincelle.
    'v_crit_arc': [34, 'a sword slash arc for a critical hit: a crescent with a white hot outer edge, golden center, fading to transparent at its tail, with a 3 frame motion trail, 9 frames, fast'],
    'v_crit_spark': [16, 'a small sharp white and gold star spark at an impact point, 6 frames, very fast'],
    # Météore : grosse pierre en feu qui tombe, cratère, débris.
    'v_meteor_rock': [44, 'a huge flaming meteor boulder falling diagonally from the top left, cracked glowing lava rock with a long fire and smoke trail, looping 6 frames'],
    'v_meteor_crater': [110, 'a meteor impact on the ground: a huge orange and white explosion dome, a dark smoking crater, rocks and debris flying out, then burning embers and smoke.' + THREE + ' 14 frames'],
    # Préparation et retombée communes (teintées selon l'élément par le jeu).
    'v_charge': [40, 'a magic charge-up: bright white motes and thin light streaks converging into a glowing orb in the center, growing brighter, 10 frames'],
    'v_embers': [60, 'aftermath of a magic attack: drifting embers, small sparks and grey smoke puffs rising and fading, 10 frames'],
    # Sorts du héros
    'v_fireball_blast': [72, 'a fire explosion with volume: billowing orange and yellow flame clouds bursting outward in irregular puffy shapes, licking flame tongues, dark smoke edges and flying embers, NOT a flat disc, NOT a ring, 12 frames'], #
    'v_flame_wall': [80, 'a tall wall of roaring fire rising from the ground across the whole width: five tall flickering flame columns twice as high as a person, orange and yellow with red tips, swaying, then sinking into embers, 14 frames'], #
    'v_whirlwind': [72, 'a spinning steel whirlwind: a tornado of sword slashes and blue wind streaks spinning around a center, with flying leaves, 12 frames'],
    'v_flash_strike': [96, 'a lightning fast dash strike: a long horizontal streak of white and cyan light crossing the screen with afterimages and a bright flash at the end, 9 frames'],
    'v_holy_smite': [96, 'a holy smite: a pillar of golden light falling from the sky onto the ground with a cross shaped flash and a ring of light on the ground.' + THREE + ' 12 frames'],
    'v_blessing': [84, 'a blessing spell: a golden runic circle expanding on the ground with rising rays of light and floating golden motes, 12 frames'],
    'v_taunt': [64, 'a taunt roar: a red shockwave ring bursting outward with an angry red sigil and sound waves, 10 frames'],
    'v_rampart': [72, 'a magic rampart: a tall glowing golden energy shield in the shape of a large kite shield made of light appears in front of the hero, with shimmering hexagon pattern and sparkles, 12 frames'], #
    'v_execution': [84, 'an execution strike: a giant dark crimson blade falling from above and slamming down, a red slash flash and dark smoke, 11 frames'],
    # Danse des lames : une par assassin
    'v_dance_shadow': [76, 'a shadow blade dance: several dark purple shadow clones slashing in a flurry, violet slash arcs crisscrossing, smoke wisps, 12 frames'],
    'v_dance_rose': [76, 'a rose blade dance: a whirl of pink rose petals and thin pink blade slashes spiraling around, sparkles, 12 frames'],
    'v_dance_ninja': [76, 'a ninja shuriken storm: many spinning steel shuriken and quick white slash lines crossing, small smoke puffs, 12 frames'],
    'v_dance_void': [76, 'a void blade dance: black and deep violet void blades and tendrils lashing out from a dark rift, star specks, 12 frames'],
    # Prière : une par soigneur
    'v_prayer_dawn': [70, 'a dawn prayer: soft warm pink and gold light rays descending from above with a gentle sunrise glow on the ground, 10 frames'],
    'v_prayer_sun': [70, 'a sacred sun prayer: a bright white sun disk above with straight golden rays shining down and a halo ring, 10 frames'],
    'v_prayer_feathers': [70, 'an angelic prayer: white feathers slowly falling with a soft halo of light and small glowing motes, 10 frames'],
    'v_prayer_leaves': [70, 'a forest healing prayer: green leaves and glowing green spores swirling upward from the ground with soft green light, 10 frames'],
    # Variantes : Écuyer / Paladin d'azur (Provocation), Mercenaire / Barbare (Tourbillon sanglant)
    'v_taunt_azure': [64, 'an azure taunt: a turquoise water shockwave ring bursting outward with a glowing shield sigil and droplets, 10 frames'],
    'v_whirl_blood': [72, 'a blood whirlwind: a spinning crimson sword tornado with red slash arcs and dark red droplets, 12 frames'],
    'v_whirl_axe': [72, 'a fiery axe whirlwind: two spinning axes trailing orange fire in a circular tornado with embers, 12 frames'],
}

if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'build'
    if cmd == 'gen':
        P.gen(sys.argv[2:])
    elif cmd == 'build':
        P.build()
        s = open(P.OUT).read()
        s = s.replace('export const VFX_ATLAS', 'export const VFX2_ATLAS').replace('export const VFX =', 'export const VFX2 =')
        s = re.sub(r'// v9\.2\.6 : effets.*?\n// .*?\n', '// v9.11 (1) : animations de compétences (3 temps : préparation, impact, retombée). Atlas séparé.\n', s, flags=re.S)
        open(P.OUT, 'w').write(s)
