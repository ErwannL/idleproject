// Définitions d'objets : les objets sont générés à partir de ces bases,
// jamais codés un par un.

export const SLOTS = {
  weapon: 'Arme',
  helmet: 'Casque',
  armor: 'Armure',
};

export const RARITIES = [
  { id: 'common', label: 'Commun', color: '#c9c9c9', weight: 70, statMultiplier: 1, recycleGold: 5 },
  { id: 'rare', label: 'Rare', color: '#4fa3ff', weight: 22, statMultiplier: 1.6, recycleGold: 20 },
  { id: 'epic', label: 'Épique', color: '#c06bff', weight: 7, statMultiplier: 2.6, recycleGold: 80 },
  { id: 'legendary', label: 'Légendaire', color: '#ffa630', weight: 1, statMultiplier: 4.2, recycleGold: 300 },
];

export const STAT_LABELS = {
  damage: 'Dégâts',
  maxHp: 'PV max',
  armor: 'Armure',
  attackSpeed: "Vitesse d'attaque",
};

// Statistiques en pourcentage : affichées avec « % », non multipliées par le niveau d'objet.
export const PERCENT_STATS = new Set(['armor', 'attackSpeed']);

// `sprite` renvoie aux grilles de src/render/sprites.js ; `colors` teinte le sprite sur le héros.
export const ITEM_BASES = [
  {
    id: 'short_sword', name: 'Épée courte', slot: 'weapon', sprite: 'sword',
    colors: { main: '#d6dde6', shade: '#8a94a3' }, stats: { damage: 5 },
  },
  {
    id: 'battle_axe', name: 'Hache de guerre', slot: 'weapon', sprite: 'axe',
    colors: { main: '#b9c2cc', shade: '#6d7783' }, stats: { damage: 8, attackSpeed: -8 },
  },
  {
    id: 'dagger', name: 'Dague', slot: 'weapon', sprite: 'dagger',
    colors: { main: '#e6ecf2', shade: '#9aa3ad' }, stats: { damage: 3, attackSpeed: 12 },
  },
  {
    id: 'leather_hood', name: 'Capuche en cuir', slot: 'helmet', sprite: 'hood',
    colors: { main: '#8a5a3b', shade: '#5e3b25' }, stats: { maxHp: 15 },
  },
  {
    id: 'iron_helm', name: 'Casque de fer', slot: 'helmet', sprite: 'helm',
    colors: { main: '#a9b3bf', shade: '#6c7684' }, stats: { maxHp: 20, armor: 2 },
  },
  {
    id: 'cloth_tunic', name: 'Tunique matelassée', slot: 'armor', sprite: 'tunic',
    colors: { main: '#3f7fbf', shade: '#2b5a8a' }, stats: { maxHp: 30 },
  },
  {
    id: 'chainmail', name: 'Cotte de mailles', slot: 'armor', sprite: 'mail',
    colors: { main: '#a3adb9', shade: '#68727e' }, stats: { maxHp: 25, armor: 4 },
  },
];

export const STARTER_WEAPON = 'short_sword';
