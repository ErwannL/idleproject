// Zones (mondes) de la campagne : BALANCE.stages.stagesPerZone étapes chacune.
// Chaque monde : 20 étapes, boss aux étapes 5 (mini), 10 (moyen), 15 (dur) et 20 (méga).
// Après le dernier monde, on recommence au monde 1 avec une difficulté ×2, puis ×3, etc.
// Le décor de chaque zone (ciel, calques peints) est généré par tools/art/scenery.py :
// assets/bg/<id>_*.png et le manifeste src/render/bg.js.

export const ZONES = [
  {
    id: 'plains',
    name: 'Plaines verdoyantes',
    enemies: ['slime', 'goblin', 'boar', 'mandrake'],
    bosses: ['slime_king'], // méga boss (étape 20)
    tierBosses: { mini: 'mini_goblin_warlord', mid: 'mid_boar_titan', hard: 'hard_scarecrow' }, // étapes 5, 10, 15
  },
  {
    id: 'forest',
    name: 'Forêt sombre',
    enemies: ['wolf', 'mushroom', 'mushroom_green', 'goblin_shaman', 'slime_blue'],
    bosses: ['alpha_wolf'], // méga boss (étape 20)
    tierBosses: { mini: 'mini_treant', mid: 'mid_giant_spider', hard: 'hard_werewolf' }, // étapes 5, 10, 15
  },
  {
    id: 'caves',
    name: 'Grottes de cristal',
    enemies: ['bat', 'skeleton', 'skeleton_shield', 'golem'],
    bosses: ['bone_lord'], // méga boss (étape 20)
    tierBosses: { mini: 'mini_crystal_golem', mid: 'mid_crystal_bat', hard: 'hard_necromancer' }, // étapes 5, 10, 15
  },
  {
    id: 'desert',
    name: 'Désert brûlant',
    enemies: ['scorpion', 'mummy', 'skeleton_archer', 'goblin_armored'],
    bosses: ['ash_dragon'], // méga boss (étape 20)
    tierBosses: { mini: 'mini_pharaoh', mid: 'mid_sand_worm', hard: 'hard_anubis' }, // étapes 5, 10, 15
  },
  {
    id: 'mountains',
    name: 'Montagnes gelées',
    enemies: ['yeti', 'ice_wolf', 'slime_ice', 'ogre'],
    bosses: ['fallen_knight'], // méga boss (étape 20)
    tierBosses: { mini: 'mini_frost_witch', mid: 'mid_mammoth', hard: 'hard_frost_giant' }, // étapes 5, 10, 15
  },
  {
    id: 'cursed',
    name: 'Terres maudites',
    enemies: ['imp', 'wraith', 'lich', 'slime_fire'],
    bosses: ['demon_king'], // méga boss (étape 20)
    tierBosses: { mini: 'mini_reaper', mid: 'mid_hellhound', hard: 'hard_demon_general' }, // étapes 5, 10, 15
  },
];
