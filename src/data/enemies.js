// Ennemis : statistiques de base à l'étape 1, multipliées ensuite par BALANCE.enemyScaling.
// `range` : distance à laquelle l'ennemi s'arrête devant le héros pour frapper.
// `flyHeight` : hauteur de vol en pixels logiques.

export const ENEMIES = {
  // Plaines
  slime: { name: 'Gluant', sprite: 'slime', hp: 20, damage: 3, gold: 4, speed: 16, attackInterval: 1.4, range: 18 },
  goblin: { name: 'Gobelin', sprite: 'goblin', hp: 26, damage: 4, gold: 5, speed: 22, attackInterval: 1.2, range: 16 },
  boar: { name: 'Sanglier', sprite: 'boar', hp: 28, damage: 4, gold: 5, speed: 28, attackInterval: 1.3, range: 18 },
  mandrake: { name: 'Mandragore', sprite: 'mandrake', hp: 16, damage: 3, gold: 4, speed: 18, attackInterval: 1.1, range: 14 },
  // Forêt
  wolf: { name: 'Loup', sprite: 'wolf', hp: 22, damage: 5, gold: 5, speed: 34, attackInterval: 1.0, range: 18 },
  mushroom: { name: 'Champignon', sprite: 'mushroom', hp: 34, damage: 3, gold: 6, speed: 12, attackInterval: 1.6, range: 16 },
  mushroom_green: { name: 'Champignon des marais', sprite: 'mushroom_green', hp: 30, damage: 4, gold: 6, speed: 13, attackInterval: 1.5, range: 16 },
  goblin_shaman: { name: 'Chaman gobelin', sprite: 'goblin_shaman', hp: 22, damage: 6, gold: 6, speed: 18, attackInterval: 1.4, range: 24 },
  slime_blue: { name: 'Gluant bleu', sprite: 'slime_blue', hp: 24, damage: 4, gold: 5, speed: 16, attackInterval: 1.3, range: 18 },
  // Grottes
  bat: { name: 'Œil volant', sprite: 'bat', hp: 18, damage: 4, gold: 5, speed: 30, attackInterval: 0.9, range: 16, flyHeight: 14 },
  skeleton: { name: 'Squelette', sprite: 'skeleton', hp: 30, damage: 5, gold: 6, speed: 18, attackInterval: 1.3, range: 16 },
  skeleton_shield: { name: 'Squelette au bouclier', sprite: 'skeleton_shield', hp: 38, damage: 4, gold: 6, speed: 15, attackInterval: 1.4, range: 16 },
  golem: { name: 'Golem de pierre', sprite: 'golem', hp: 46, damage: 6, gold: 8, speed: 10, attackInterval: 1.8, range: 20 },
  // Désert
  scorpion: { name: 'Scorpion', sprite: 'scorpion', hp: 28, damage: 5, gold: 6, speed: 24, attackInterval: 1.1, range: 18 },
  mummy: { name: 'Momie', sprite: 'mummy', hp: 36, damage: 4, gold: 7, speed: 12, attackInterval: 1.5, range: 16 },
  skeleton_archer: { name: 'Squelette archer', sprite: 'skeleton_archer', hp: 22, damage: 6, gold: 6, speed: 18, attackInterval: 1.3, range: 30 },
  goblin_armored: { name: 'Gobelin cuirassé', sprite: 'goblin_armored', hp: 38, damage: 5, gold: 7, speed: 16, attackInterval: 1.4, range: 16 },
  // Montagnes
  yeti: { name: 'Yéti', sprite: 'yeti', hp: 40, damage: 6, gold: 7, speed: 14, attackInterval: 1.6, range: 18 },
  ice_wolf: { name: 'Loup des glaces', sprite: 'wolf_ice', hp: 26, damage: 5, gold: 6, speed: 34, attackInterval: 1.0, range: 18 },
  slime_ice: { name: 'Gluant de glace', sprite: 'slime_ice', hp: 30, damage: 5, gold: 6, speed: 14, attackInterval: 1.4, range: 18 },
  ogre: { name: 'Ogre', sprite: 'ogre', hp: 48, damage: 7, gold: 8, speed: 12, attackInterval: 1.7, range: 22 },
  // Terres maudites
  imp: { name: 'Diablotin', sprite: 'imp', hp: 26, damage: 6, gold: 7, speed: 26, attackInterval: 1.0, range: 16 },
  wraith: { name: 'Spectre', sprite: 'wraith', hp: 24, damage: 5, gold: 6, speed: 20, attackInterval: 1.1, range: 16, flyHeight: 6 },
  lich: { name: 'Liche', sprite: 'lich', hp: 30, damage: 7, gold: 8, speed: 14, attackInterval: 1.5, range: 26 },
  slime_fire: { name: 'Gluant de feu', sprite: 'slime_fire', hp: 28, damage: 7, gold: 7, speed: 18, attackInterval: 1.2, range: 18 },
  // v7.7 — Monde 7 : Marais putride
  toad: { name: 'Crapaud venimeux', sprite: 'toad', hp: 30, damage: 7, gold: 7, speed: 20, attackInterval: 1.3, range: 18 },
  bog_zombie: { name: 'Zombie des marais', sprite: 'bog_zombie', hp: 42, damage: 6, gold: 8, speed: 11, attackInterval: 1.6, range: 16 },
  leech_fly: { name: 'Moustique géant', sprite: 'leech_fly', hp: 22, damage: 7, gold: 7, speed: 30, attackInterval: 0.9, range: 16, flyHeight: 12 },
  lizardman: { name: 'Homme-lézard', sprite: 'lizardman', hp: 36, damage: 8, gold: 8, speed: 20, attackInterval: 1.2, range: 22 },
  // Monde 8 : Îles célestes
  harpy: { name: 'Harpie', sprite: 'harpy', hp: 28, damage: 8, gold: 8, speed: 30, attackInterval: 1.0, range: 18, flyHeight: 14 },
  cloud_spirit: { name: 'Esprit des nuées', sprite: 'cloud_spirit', hp: 34, damage: 8, gold: 8, speed: 16, attackInterval: 1.3, range: 24, flyHeight: 6 },
  griffin_cub: { name: 'Jeune griffon', sprite: 'griffin_cub', hp: 38, damage: 8, gold: 8, speed: 28, attackInterval: 1.1, range: 18 },
  sky_automaton: { name: 'Automate céleste', sprite: 'sky_automaton', hp: 48, damage: 7, gold: 9, speed: 12, attackInterval: 1.6, range: 18 },
  // Monde 9 : Cœur du volcan
  magma_slime: { name: 'Gluant de magma', sprite: 'magma_slime', hp: 34, damage: 9, gold: 8, speed: 16, attackInterval: 1.3, range: 18 },
  salamander: { name: 'Salamandre', sprite: 'salamander', hp: 32, damage: 9, gold: 8, speed: 26, attackInterval: 1.1, range: 18 },
  ash_wraith: { name: 'Spectre de cendre', sprite: 'ash_wraith', hp: 26, damage: 10, gold: 8, speed: 22, attackInterval: 1.0, range: 18, flyHeight: 8 },
  obsidian_beetle: { name: "Scarabée d'obsidienne", sprite: 'obsidian_beetle', hp: 52, damage: 8, gold: 9, speed: 12, attackInterval: 1.6, range: 18 },
  // Monde 10 : Royaume du Néant
  void_eye: { name: 'Œil du néant', sprite: 'void_eye', hp: 28, damage: 10, gold: 9, speed: 20, attackInterval: 1.1, range: 26, flyHeight: 14 },
  star_stalker: { name: 'Rôdeur stellaire', sprite: 'star_stalker', hp: 34, damage: 10, gold: 9, speed: 32, attackInterval: 0.9, range: 18 },
  shadow_knight: { name: "Chevalier d'ombre", sprite: 'shadow_knight', hp: 50, damage: 9, gold: 10, speed: 14, attackInterval: 1.4, range: 20 },
  voidling: { name: 'Rejeton du néant', sprite: 'voidling', hp: 26, damage: 9, gold: 8, speed: 26, attackInterval: 1.0, range: 16 },
};

// Deux images de marche (ou de vol) par ennemi : `sprite` et `sprite_b`.
for (const enemy of Object.values(ENEMIES)) enemy.frames ??= [enemy.sprite, `${enemy.sprite}_b`];

// Boss : statistiques d'un ennemi de base (`base`), sprite dédié (v5, dessiné à sa taille).
export const BOSSES = {
  slime_king: { name: 'Roi Gluant', base: 'slime', sprite: 'boss_slime_king' },
  alpha_wolf: { name: 'Loup Alpha', base: 'wolf', sprite: 'boss_alpha_wolf' },
  bone_lord: { name: 'Seigneur des Os', base: 'skeleton', sprite: 'boss_bone_lord' },
  // Boss du donjon « Crypte spectrale ».
  spectral_queen: { name: 'Reine spectrale', base: 'wraith', sprite: 'boss_spectral_queen' },
  ash_dragon: { name: 'Dragon des cendres', base: 'scorpion', sprite: 'boss_ash_dragon' },
  fallen_knight: { name: 'Chevalier déchu', base: 'yeti', sprite: 'boss_fallen_knight' },
  demon_king: { name: 'Roi démoniaque', base: 'imp', sprite: 'boss_demon_king' },
  // v7.6 : chaque monde a 4 boss : mini (étape 5), moyen (10), dur (15) ; les boss ci-dessus sont
  // les méga boss (étape 20). `tier` absent = méga boss.
  mini_goblin_warlord: { name: 'Chef de guerre gobelin', base: 'goblin', sprite: 'mini_goblin_warlord', tier: 'mini' },
  mini_treant: { name: 'Tréant corrompu', base: 'mushroom', sprite: 'mini_treant', tier: 'mini' },
  mini_crystal_golem: { name: 'Golem de cristal', base: 'golem', sprite: 'mini_crystal_golem', tier: 'mini' },
  mini_pharaoh: { name: 'Pharaon maudit', base: 'mummy', sprite: 'mini_pharaoh', tier: 'mini' },
  mini_frost_witch: { name: 'Sorcière des glaces', base: 'slime_ice', sprite: 'mini_frost_witch', tier: 'mini' },
  mini_reaper: { name: 'Faucheuse', base: 'wraith', sprite: 'mini_reaper', tier: 'mini' },
  mid_boar_titan: { name: 'Sanglier titan', base: 'boar', sprite: 'mid_boar_titan', tier: 'mid' },
  mid_giant_spider: { name: 'Araignée géante', base: 'wolf', sprite: 'mid_giant_spider', tier: 'mid' },
  mid_crystal_bat: { name: 'Chauve-souris de cristal', base: 'bat', sprite: 'mid_crystal_bat', tier: 'mid' },
  mid_sand_worm: { name: 'Ver des sables', base: 'scorpion', sprite: 'mid_sand_worm', tier: 'mid' },
  mid_mammoth: { name: 'Mammouth de givre', base: 'yeti', sprite: 'mid_mammoth', tier: 'mid' },
  mid_hellhound: { name: "Chien de l'enfer", base: 'imp', sprite: 'mid_hellhound', tier: 'mid' },
  hard_scarecrow: { name: 'Épouvantail maudit', base: 'goblin', sprite: 'hard_scarecrow', tier: 'hard' },
  hard_werewolf: { name: 'Loup-garou', base: 'wolf', sprite: 'hard_werewolf', tier: 'hard' },
  hard_necromancer: { name: 'Nécromancien', base: 'skeleton', sprite: 'hard_necromancer', tier: 'hard' },
  hard_anubis: { name: 'Gardien chacal', base: 'mummy', sprite: 'hard_anubis', tier: 'hard' },
  hard_frost_giant: { name: 'Géant du givre', base: 'ogre', sprite: 'hard_frost_giant', tier: 'hard' },
  hard_demon_general: { name: 'Général démon', base: 'imp', sprite: 'hard_demon_general', tier: 'hard' },
  // v7.7 — mondes 7 à 10 (mini, moyen, dur, méga).
  mini_toad_king: { name: 'Roi crapaud', base: 'toad', sprite: 'mini_toad_king', tier: 'mini' },
  mid_hydra: { name: 'Hydre des marais', base: 'lizardman', sprite: 'mid_hydra', tier: 'mid' },
  hard_plague_doctor: { name: 'Médecin de la peste', base: 'bog_zombie', sprite: 'hard_plague_doctor', tier: 'hard' },
  boss_swamp_behemoth: { name: 'Béhémoth des marais', base: 'bog_zombie', sprite: 'boss_swamp_behemoth' },
  mini_harpy_queen: { name: 'Reine harpie', base: 'harpy', sprite: 'mini_harpy_queen', tier: 'mini' },
  mid_thunder_griffin: { name: 'Griffon du tonnerre', base: 'griffin_cub', sprite: 'mid_thunder_griffin', tier: 'mid' },
  hard_storm_valkyrie: { name: 'Valkyrie de la tempête', base: 'sky_automaton', sprite: 'hard_storm_valkyrie', tier: 'hard' },
  boss_sky_titan: { name: 'Titan céleste', base: 'sky_automaton', sprite: 'boss_sky_titan' },
  mini_salamander_chief: { name: 'Chef salamandre', base: 'salamander', sprite: 'mini_salamander_chief', tier: 'mini' },
  mid_lava_golem: { name: 'Golem de lave', base: 'obsidian_beetle', sprite: 'mid_lava_golem', tier: 'mid' },
  hard_flame_djinn: { name: 'Djinn des flammes', base: 'ash_wraith', sprite: 'hard_flame_djinn', tier: 'hard' },
  boss_phoenix: { name: 'Phénix ancestral', base: 'salamander', sprite: 'boss_phoenix' },
  mini_void_watcher: { name: 'Guetteur du néant', base: 'void_eye', sprite: 'mini_void_watcher', tier: 'mini' },
  mid_star_devourer: { name: "Dévoreur d'étoiles", base: 'star_stalker', sprite: 'mid_star_devourer', tier: 'mid' },
  hard_void_knight: { name: 'Chevalier du néant', base: 'shadow_knight', sprite: 'hard_void_knight', tier: 'hard' },
  boss_void_emperor: { name: 'Empereur du Néant', base: 'shadow_knight', sprite: 'boss_void_emperor' },
};
