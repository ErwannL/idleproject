// Ennemis : statistiques de base à l'étape 1, multipliées ensuite par BALANCE.enemyScaling.
// `range` : distance à laquelle l'ennemi s'arrête devant le héros pour frapper.
// `flyHeight` : hauteur de vol en pixels logiques.

export const ENEMIES = {
  slime: { name: 'Gluant', sprite: 'slime', hp: 20, damage: 3, gold: 4, speed: 16, attackInterval: 1.4, range: 18 },
  goblin: { name: 'Gobelin', sprite: 'goblin', hp: 26, damage: 4, gold: 5, speed: 22, attackInterval: 1.2, range: 16 },
  wolf: { name: 'Loup', sprite: 'wolf', hp: 22, damage: 5, gold: 5, speed: 34, attackInterval: 1.0, range: 18 },
  mushroom: { name: 'Champignon', sprite: 'mushroom', hp: 34, damage: 3, gold: 6, speed: 12, attackInterval: 1.6, range: 16 },
  bat: {
    name: 'Chauve-souris', sprite: 'bat_up', frames: ['bat_up', 'bat_down'],
    hp: 18, damage: 4, gold: 5, speed: 30, attackInterval: 0.9, range: 16, flyHeight: 14,
  },
  skeleton: { name: 'Squelette', sprite: 'skeleton', hp: 30, damage: 5, gold: 6, speed: 18, attackInterval: 1.3, range: 16 },
  wraith: { name: 'Spectre', sprite: 'wraith', hp: 24, damage: 5, gold: 6, speed: 20, attackInterval: 1.1, range: 16, flyHeight: 6 },
  scorpion: { name: 'Scorpion', sprite: 'scorpion', hp: 28, damage: 5, gold: 6, speed: 24, attackInterval: 1.1, range: 18 },
  mummy: { name: 'Momie', sprite: 'mummy', hp: 36, damage: 4, gold: 7, speed: 12, attackInterval: 1.5, range: 16 },
  yeti: { name: 'Yéti', sprite: 'yeti', hp: 40, damage: 6, gold: 7, speed: 14, attackInterval: 1.6, range: 18 },
  ice_wolf: {
    name: 'Loup des glaces', sprite: 'wolf_ice', hp: 26, damage: 5, gold: 6, speed: 34, attackInterval: 1.0, range: 18,
  },
  imp: { name: 'Diablotin', sprite: 'imp', hp: 26, damage: 6, gold: 7, speed: 26, attackInterval: 1.0, range: 16 },
};

// Boss : statistiques d'un ennemi de base (`base`), sprite dédié (v5, dessiné à sa taille).
export const BOSSES = {
  slime_king: { name: 'Roi Gluant', base: 'slime', sprite: 'boss_slime_king' },
  alpha_wolf: { name: 'Loup Alpha', base: 'wolf', sprite: 'boss_alpha_wolf' },
  bone_lord: { name: 'Seigneur des Os', base: 'skeleton', sprite: 'boss_bone_lord' },
  // Boss du donjon « Crypte spectrale ».
  spectral_queen: { name: 'Reine spectrale', base: 'wraith', sprite: 'boss_spectral_queen' },
  ash_dragon: { name: 'Dragon des cendres', base: 'scorpion', sprite: 'boss_ash_dragon' },
  // Chevalier noir : dessiné avec le corps du héros, retourné et assombri.
  fallen_knight: {
    name: 'Chevalier déchu', base: 'yeti', heroLike: true,
    palette: { B: '#3a2f4a', P: '#211a2c', W: '#9a3445', K: '#9a3445', w: '#aab2c0', E: '#8a93a3', I: '#5d6878', J: '#353c48', X: '#1e222c' },
  },
  demon_king: { name: 'Roi démoniaque', base: 'imp', sprite: 'boss_demon_king' },
};
