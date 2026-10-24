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
};

// Boss : réutilisent un ennemi de base, agrandi, avec une couronne ou une palette différente.
export const BOSSES = {
  slime_king: { name: 'Roi Gluant', base: 'slime', crown: true },
  alpha_wolf: {
    name: 'Loup Alpha', base: 'wolf', crown: false,
    palette: { f: '#4b4e5c', F: '#2e3039', R: '#ffdd33' },
  },
  bone_lord: {
    name: 'Seigneur des Os', base: 'skeleton', crown: true,
    palette: { n: '#d9d0f0', N: '#9c8fc2' },
  },
};
