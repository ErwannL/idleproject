// Zones (mondes) de la campagne : BALANCE.stages.stagesPerZone étapes chacune.
// Chaque monde : 20 étapes, boss aux étapes 5 (mini), 10 (moyen), 15 (dur) et 20 (méga).
// Après le dernier monde, on recommence au monde 1 avec une difficulté ×2, puis ×3, etc.
// Le décor de chaque zone (ciel, calques peints) est généré par tools/art/scenery.py :
// assets/bg/<id>_*.png et le manifeste src/render/bg.js.

export const ZONES = [
  {
    id: 'plains',
    element: 'green', // v9.6.5 (10.2) : fiche monde
    name: 'Plaines verdoyantes',
    enemies: ['slime', 'goblin', 'boar', 'mandrake'],
    bosses: ['slime_king'], // méga boss (étape 20)
    tierBosses: { mini: 'mini_goblin_warlord', mid: 'mid_boar_titan', hard: 'hard_scarecrow' }, // étapes 5, 10, 15
  },
  {
    id: 'forest',
    element: 'green', // v9.6.5 (10.2) : fiche monde
    name: 'Forêt sombre',
    enemies: ['wolf', 'mushroom', 'mushroom_green', 'goblin_shaman', 'slime_blue'],
    bosses: ['alpha_wolf'], // méga boss (étape 20)
    tierBosses: { mini: 'mini_treant', mid: 'mid_giant_spider', hard: 'hard_werewolf' }, // étapes 5, 10, 15
  },
  {
    id: 'caves',
    element: 'blue', // v9.6.5 (10.2) : fiche monde
    name: 'Grottes de cristal',
    enemies: ['bat', 'skeleton', 'skeleton_shield', 'golem'],
    bosses: ['bone_lord'], // méga boss (étape 20)
    tierBosses: { mini: 'mini_crystal_golem', mid: 'mid_crystal_bat', hard: 'hard_necromancer' }, // étapes 5, 10, 15
  },
  {
    id: 'desert',
    element: 'red', // v9.6.5 (10.2) : fiche monde
    name: 'Désert brûlant',
    enemies: ['scorpion', 'mummy', 'skeleton_archer', 'goblin_armored'],
    bosses: ['ash_dragon'], // méga boss (étape 20)
    tierBosses: { mini: 'mini_pharaoh', mid: 'mid_sand_worm', hard: 'hard_anubis' }, // étapes 5, 10, 15
  },
  {
    id: 'mountains',
    element: 'blue', // v9.6.5 (10.2) : fiche monde
    name: 'Montagnes gelées',
    enemies: ['yeti', 'ice_wolf', 'slime_ice', 'ogre'],
    bosses: ['fallen_knight'], // méga boss (étape 20)
    tierBosses: { mini: 'mini_frost_witch', mid: 'mid_mammoth', hard: 'hard_frost_giant' }, // étapes 5, 10, 15
  },
  {
    id: 'cursed',
    element: 'dark', // v9.6.5 (10.2) : fiche monde
    name: 'Terres maudites',
    enemies: ['imp', 'wraith', 'lich', 'slime_fire'],
    bosses: ['demon_king'], // méga boss (étape 20)
    tierBosses: { mini: 'mini_reaper', mid: 'mid_hellhound', hard: 'hard_demon_general' }, // étapes 5, 10, 15
  },
  // v7.7 : mondes 7 à 10.
  {
    id: 'swamp',
    element: 'green', // v9.6.5 (10.2) : fiche monde
    name: 'Marais putride',
    enemies: ['toad', 'bog_zombie', 'leech_fly', 'lizardman'],
    bosses: ['boss_swamp_behemoth'],
    tierBosses: { mini: 'mini_toad_king', mid: 'mid_hydra', hard: 'hard_plague_doctor' },
  },
  {
    id: 'sky',
    element: 'light', // v9.6.5 (10.2) : fiche monde
    name: 'Îles célestes',
    enemies: ['harpy', 'cloud_spirit', 'griffin_cub', 'sky_automaton'],
    bosses: ['boss_sky_titan'],
    tierBosses: { mini: 'mini_harpy_queen', mid: 'mid_thunder_griffin', hard: 'hard_storm_valkyrie' },
  },
  {
    id: 'volcano',
    element: 'red', // v9.6.5 (10.2) : fiche monde
    name: 'Cœur du volcan',
    enemies: ['magma_slime', 'salamander', 'ash_wraith', 'obsidian_beetle'],
    bosses: ['boss_phoenix'],
    tierBosses: { mini: 'mini_salamander_chief', mid: 'mid_lava_golem', hard: 'hard_flame_djinn' },
  },
  {
    id: 'void',
    element: 'dark', // v9.6.5 (10.2) : fiche monde
    name: 'Royaume du Néant',
    enemies: ['void_eye', 'star_stalker', 'shadow_knight', 'voidling'],
    bosses: ['boss_void_emperor'],
    tierBosses: { mini: 'mini_void_watcher', mid: 'mid_star_devourer', hard: 'hard_void_knight' },
  },
  // v9.2.0 (monde marin) : monde 11, le Royaume englouti — on y nage (src/render/ocean-fx.js). 20 étapes qui couvrent
  // les niveaux de puissance 201 à 210 (`levels`) sans faire avancer le compteur (`advance: 0`) : le Trône de l'Abysse
  // garde ses niveaux d'avant la 9.2.0 (voir levelForStage, core/combat.js). Sauvegardes : core/migrations-v920.js.
  {
    id: 'ocean',
    element: 'blue', // v9.6.5 (10.2) : fiche monde
    name: 'Royaume englouti',
    underwater: true,
    levels: 10,
    advance: 0,
    enemies: ['sea_bladefish', 'sea_jelly', 'sea_crab', 'sea_eel', 'sea_puffer', 'sea_octopus', 'sea_shark', 'sea_merfolk'],
    bosses: ['boss_leviathan'],
    tierBosses: { mini: 'mini_crab_king', mid: 'mid_kraken', hard: 'hard_megalodon' },
  },
  // Monde 12 (monde 11 avant la 9.2.0) : Trône de l'Abysse — 10 étapes, chacune contre le méga boss d'un monde en mode berserk,
  // qui invoque ses boss des étapes 5, 10 et 15 (berserk eux aussi) quand ses PV baissent.
  {
    id: 'abyss',
    element: 'dark', // v9.6.5 (10.2) : fiche monde
    name: "Trône de l'Abysse",
    stages: 10,
    gauntlet: true,
    enemies: ['shadow_knight', 'voidling', 'imp'],
    bosses: ['demon_king'],
  },
];
