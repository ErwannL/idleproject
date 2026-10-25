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
  // Chevalier noir : dessiné avec le corps du héros, retourné et assombri.
  fallen_knight: {
    name: 'Chevalier déchu', base: 'yeti', heroLike: true,
    palette: { B: '#3a2f4a', P: '#211a2c', W: '#9a3445', K: '#9a3445', w: '#aab2c0', E: '#8a93a3', I: '#5d6878', J: '#353c48', X: '#1e222c' },
  },
  demon_king: { name: 'Roi démoniaque', base: 'imp', sprite: 'boss_demon_king' },
};
