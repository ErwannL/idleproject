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
    id: 'leather_hood', name: 'Bassinet', slot: 'helmet', sprite: 'hood',
    colors: { main: '#8a5a3b', shade: '#5e3b25' }, stats: { maxHp: 15 },
  },
  {
    id: 'iron_helm', name: 'Heaume de chevalier', slot: 'helmet', sprite: 'helm',
    colors: { main: '#a9b3bf', shade: '#6c7684' }, stats: { maxHp: 20, armor: 2 },
  },
  {
    id: 'cloth_tunic', name: 'Tabard de croisé', slot: 'armor', sprite: 'tunic',
    colors: { main: '#3f7fbf', shade: '#2b5a8a' }, stats: { maxHp: 30 },
  },
  {
    id: 'chainmail', name: 'Harnois', slot: 'armor', sprite: 'mail',
    colors: { main: '#a3adb9', shade: '#68727e' }, stats: { maxHp: 25, armor: 4 },
  },
];

// Objets signature : lâchés uniquement par leur boss (butin ciblé), toujours Épiques ou Légendaires,
// avec un effet spécial propre. Absents du butin aléatoire.
export const SIGNATURE_ITEMS = [
  {
    id: 'slime_crown', name: 'Couronne gélatineuse', slot: 'helmet', sprite: 'helm', signature: 'slime_king',
    colors: { main: '#7fe07a', shade: '#3a9a46' }, stats: { maxHp: 30, armor: 2 }, affixes: [{ type: 'regenPct', value: 1.5 }],
  },
  {
    id: 'alpha_fang_blade', name: "Croc de l'Alpha", slot: 'weapon', sprite: 'dagger', signature: 'alpha_wolf',
    colors: { main: '#f2ead8', shade: '#b7ab8f' }, stats: { damage: 5, attackSpeed: 15 }, affixes: [{ type: 'damageVsNormalPct', value: 20 }],
  },
  {
    id: 'lich_blade', name: 'Lame de la liche', slot: 'weapon', sprite: 'sword', signature: 'bone_lord',
    colors: { main: '#c9b8ff', shade: '#7b63c9' }, stats: { damage: 8 }, affixes: [{ type: 'lifesteal', value: 4 }],
  },
  {
    id: 'queen_veil', name: 'Voile de la Reine', slot: 'armor', sprite: 'tunic', signature: 'spectral_queen',
    colors: { main: '#9fe6ff', shade: '#4f9fc9' }, stats: { maxHp: 35 }, affixes: [{ type: 'dropChance', value: 3 }],
  },
  {
    id: 'dragon_scale', name: 'Écailles de dragon', slot: 'armor', sprite: 'mail', signature: 'ash_dragon',
    colors: { main: '#e0603a', shade: '#8a2f1d' }, stats: { maxHp: 30, armor: 5 }, affixes: [{ type: 'thorns', value: 30 }],
  },
  {
    id: 'fallen_blade', name: 'Lame du déchu', slot: 'weapon', sprite: 'sword', signature: 'fallen_knight',
    colors: { main: '#5d6878', shade: '#2e3440' }, stats: { damage: 9 }, affixes: [{ type: 'critChance', value: 10 }],
  },
  {
    id: 'demon_axe', name: 'Hache démoniaque', slot: 'weapon', sprite: 'axe', signature: 'demon_king',
    colors: { main: '#ff5a4a', shade: '#8a1d2a' }, stats: { damage: 12, attackSpeed: -8 }, affixes: [{ type: 'damageVsBossPct', value: 25 }],
  },
];

// Effets spéciaux (« affixes ») tirés pour les objets Rares et mieux.
// Valeur = base × multiplicateur de rareté, arrondie.
export const AFFIXES = {
  critChance: { label: (v) => `+${v} % de coup critique`, base: 2, slots: ['weapon', 'helmet'] },
  lifesteal: { label: (v) => `Vol de vie : ${v} % des dégâts`, base: 1, slots: ['weapon'] },
  thorns: { label: (v) => `Épines : renvoie ${v} % des dégâts subis`, base: 8, slots: ['armor', 'helmet'] },
  goldPct: { label: (v) => `+${v} % or`, base: 5, slots: ['weapon', 'helmet', 'armor'] },
  damageVsBossPct: { label: (v) => `+${v} % dégâts contre les boss`, base: 6, slots: ['weapon'] },
  damageVsNormalPct: { label: (v) => `+${v} % dégâts contre les ennemis ordinaires`, base: 6, slots: ['weapon', 'armor'] },
  regenPct: { label: (v) => `+${String(v).replace('.', ',')} % PV/s`, base: 0.5, slots: ['helmet', 'armor'] },
  dropChance: { label: (v) => `+${v} pts de chance de butin`, base: 1, slots: ['helmet', 'armor'] },
};

export const STARTER_WEAPON = 'short_sword';
