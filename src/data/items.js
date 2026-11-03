// Définitions d'objets : les objets sont générés à partir de ces bases,
// jamais codés un par un.

export const SLOTS = {
  weapon: 'Arme',
  helmet: 'Casque',
  armor: 'Armure',
  amulet: 'Collier',
  earring: "Boucles d'oreilles",
  ring: 'Anneau',
  bracelet: 'Bracelet',
};

// Équipement porté visible sur le chevalier ; les accessoires améliorent seulement ses statistiques
// secondaires (critique, vol de vie, or, butin…).
export const GEAR_SLOTS = ['weapon', 'helmet', 'armor'];
export const ACCESSORY_SLOTS = ['amulet', 'earring', 'ring', 'bracelet'];

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

// Accessoires : pas de statistique principale, un effet principal (`mainAffix`, qui grandit avec le
// niveau de l'objet) et des effets tirés au hasard comme les autres objets. Chaque modèle existe
// en plusieurs couleurs de pierre (rubis, saphir, émeraude, améthyste) ; la rareté se lit au cadre.
const GOLD = { main: '#ffd23f', shade: '#c8961e' };
const SILVER = { main: '#d6dde6', shade: '#7a8494' };
const BRONZE = { main: '#c8844a', shade: '#7a4a28' };
export const ACCESSORY_GEMS = [
  { id: 'ruby', label: 'de rubis', color: '#e8384f' },
  { id: 'sapphire', label: 'de saphir', color: '#3f8cff' },
  { id: 'emerald', label: "d'émeraude", color: '#36c46a' },
  { id: 'amethyst', label: "d'améthyste", color: '#b05cff' },
];
const ACCESSORY_DESIGNS = [
  { id: 'necklace', name: 'Collier', slot: 'amulet', sprite: 'ruby', metal: GOLD, mainAffix: { type: 'critChance', base: 2 } },
  { id: 'pendant', name: 'Pendentif', slot: 'amulet', sprite: 'pendant', metal: SILVER, mainAffix: { type: 'regenPct', base: 0.5 } },
  { id: 'drop_earrings', name: 'Pendants', slot: 'earring', sprite: 'drop', metal: GOLD, mainAffix: { type: 'dropChance', base: 1 } },
  { id: 'hoop_earrings', name: 'Créoles', slot: 'earring', sprite: 'hoop', metal: SILVER, mainAffix: { type: 'lifesteal', base: 1 } },
  { id: 'band_ring', name: 'Anneau', slot: 'ring', sprite: 'band', metal: GOLD, mainAffix: { type: 'goldPct', base: 5 } },
  { id: 'signet_ring', name: 'Chevalière', slot: 'ring', sprite: 'signet', metal: SILVER, mainAffix: { type: 'damageVsBossPct', base: 5 } },
  { id: 'thorn_bracelet', name: 'Bracelet épineux', slot: 'bracelet', sprite: 'thorn', metal: BRONZE, mainAffix: { type: 'thorns', base: 6 } },
  { id: 'hunter_bracelet', name: 'Bracelet du chasseur', slot: 'bracelet', sprite: 'cuff', metal: SILVER, mainAffix: { type: 'damageVsNormalPct', base: 5 } },
];
function accessoryBases() {
  return ACCESSORY_DESIGNS.flatMap((d) => ACCESSORY_GEMS.map((g) => ({
    id: `${d.id}_${g.id}`, name: `${d.name} ${g.label}`, slot: d.slot, sprite: d.sprite,
    colors: { ...d.metal, gem: g.color }, stats: {}, mainAffix: d.mainAffix,
  })));
}

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
  // v8.9 : plus de variété (chaque base a son sprite et son style de jeu).
  {
    id: 'mace', name: 'Massue', slot: 'weapon', sprite: 'mace',
    colors: { main: '#9a6b43', shade: '#5e3f24' }, stats: { damage: 7, maxHp: 10, attackSpeed: -4 },
  },
  {
    id: 'war_hammer', name: 'Marteau de guerre', slot: 'weapon', sprite: 'hammer',
    colors: { main: '#b0b8c2', shade: '#626b77' }, stats: { damage: 11, attackSpeed: -14 },
  },
  {
    id: 'spear', name: 'Lance', slot: 'weapon', sprite: 'spear',
    colors: { main: '#d2d9e2', shade: '#7f8996' }, stats: { damage: 6, attackSpeed: 5 },
  },
  {
    id: 'mage_staff', name: 'Bâton de mage', slot: 'weapon', sprite: 'staff',
    colors: { main: '#7fd3ff', shade: '#3b7fb5' }, stats: { damage: 5, maxHp: 15 },
  },
  {
    id: 'whip', name: 'Fouet', slot: 'weapon', sprite: 'whip',
    colors: { main: '#8a5a3b', shade: '#4e321f' }, stats: { damage: 3, attackSpeed: 18 },
  },
  {
    id: 'greatsword', name: 'Espadon', slot: 'weapon', sprite: 'greatsword',
    colors: { main: '#e2e8ef', shade: '#8d97a5' }, stats: { damage: 10, attackSpeed: -10 },
  },
  // v9.0.6 : armes des nouvelles classes (Archer, Arbalétrier, Mages, Lancier, Assassin, Nécromancien).
  {
    id: 'halberd', name: 'Hallebarde', slot: 'weapon', sprite: 'halberd',
    colors: { main: '#c9d1db', shade: '#6d7783' }, stats: { damage: 9, attackSpeed: -6 },
  },
  {
    id: 'katar', name: 'Katar', slot: 'weapon', sprite: 'katar',
    colors: { main: '#dfe6ee', shade: '#7f8996' }, stats: { damage: 4, attackSpeed: 15 },
  },
  {
    id: 'short_bow', name: 'Arc court', slot: 'weapon', sprite: 'bow',
    colors: { main: '#a0703f', shade: '#5e3f24' }, stats: { damage: 5, attackSpeed: 8 },
  },
  {
    id: 'long_bow', name: 'Arc long elfique', slot: 'weapon', sprite: 'longbow',
    colors: { main: '#d8c48a', shade: '#8a7440' }, stats: { damage: 8 },
  },
  {
    id: 'crossbow', name: 'Arbalète', slot: 'weapon', sprite: 'crossbow',
    colors: { main: '#8a5a3b', shade: '#4e321f' }, stats: { damage: 9, attackSpeed: -10 },
  },
  {
    id: 'heavy_crossbow', name: 'Arbalète lourde', slot: 'weapon', sprite: 'crossbow',
    colors: { main: '#5d6878', shade: '#2e3440' }, stats: { damage: 12, attackSpeed: -18 },
  },
  {
    id: 'fire_staff', name: 'Bâton des flammes', slot: 'weapon', sprite: 'staff',
    colors: { main: '#ff7a3a', shade: '#a8361a' }, stats: { damage: 7, attackSpeed: -4 },
  },
  {
    id: 'storm_wand', name: 'Baguette de foudre', slot: 'weapon', sprite: 'wand',
    colors: { main: '#c9b8ff', shade: '#6a58b0' }, stats: { damage: 4, attackSpeed: 10 },
  },
  {
    id: 'storm_scepter', name: 'Sceptre des tempêtes', slot: 'weapon', sprite: 'scepter',
    colors: { main: '#ffd23f', shade: '#c8961e' }, stats: { damage: 8, maxHp: 10 },
  },
  {
    id: 'scythe', name: 'Faux', slot: 'weapon', sprite: 'scythe',
    colors: { main: '#b9c2cc', shade: '#5c6570' }, stats: { damage: 8, attackSpeed: -4 },
  },
  {
    id: 'soul_reaper', name: "Faucheuse d'âmes", slot: 'weapon', sprite: 'scythe',
    colors: { main: '#5fe0a0', shade: '#2a6a50' }, stats: { damage: 10, attackSpeed: -8, maxHp: 10 },
  },
  {
    id: 'horned_helm', name: 'Casque à cornes', slot: 'helmet', sprite: 'horned',
    colors: { main: '#9aa4b0', shade: '#5c6570' }, stats: { maxHp: 12, armor: 3 },
  },
  {
    id: 'circlet', name: 'Diadème', slot: 'helmet', sprite: 'circlet',
    colors: { main: '#ffd23f', shade: '#c8961e' }, stats: { maxHp: 10, damage: 2 },
  },
  {
    id: 'plate_armor', name: 'Cuirasse de plates', slot: 'armor', sprite: 'plate',
    colors: { main: '#b6c0cc', shade: '#6a7482' }, stats: { maxHp: 20, armor: 6, attackSpeed: -4 },
  },
  {
    id: 'mage_robe', name: 'Robe de mage', slot: 'armor', sprite: 'robe',
    colors: { main: '#6a4fbf', shade: '#3f2c80' }, stats: { maxHp: 28, damage: 2 },
  },
  ...accessoryBases(),
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
  // v7.7 : objets ancestraux des méga boss des mondes 7 à 10.
  {
    id: 'behemoth_heart', name: 'Cœur du Béhémoth', slot: 'amulet', sprite: 'pendant', signature: 'boss_swamp_behemoth',
    colors: { main: '#7a6a3a', shade: '#4a3f22', light: '#b8a86a', dark: '#2a2414', gem: '#7adf5a' }, stats: { maxHp: 60 }, affixes: [{ type: 'regenPct', value: 3 }, { type: 'thorns', value: 30 }],
  },
  {
    id: 'titan_halo', name: 'Auréole du Titan', slot: 'helmet', sprite: 'helm', signature: 'boss_sky_titan',
    colors: { main: '#ffe08a', shade: '#c9a040' }, stats: { maxHp: 45, armor: 5 }, affixes: [{ type: 'goldPct', value: 30 }],
  },
  {
    id: 'phoenix_blade', name: 'Lame du Phénix', slot: 'weapon', sprite: 'sword', signature: 'boss_phoenix',
    colors: { main: '#ff8a3a', shade: '#c0401a' }, stats: { damage: 16 }, affixes: [{ type: 'lifesteal', value: 6 }],
  },
  {
    id: 'void_signet', name: 'Sceau du Néant', slot: 'ring', sprite: 'signet', signature: 'boss_void_emperor',
    colors: { main: '#3a2a6a', shade: '#1e1440', light: '#7a5ac9', dark: '#120a26', gem: '#c9a6ff' }, stats: {}, affixes: [{ type: 'critChance', value: 12 }, { type: 'damageVsBossPct', value: 20 }],
  },
  // v9.2.0 (monde marin) : objet ancestral du Léviathan (Musée).
  {
    id: 'leviathan_pearl', name: 'Perle du Léviathan', slot: 'amulet', sprite: 'pendant', signature: 'boss_leviathan',
    colors: { main: '#1a6a8a', shade: '#0e3a52', light: '#5ad0e8', dark: '#06202e', gem: '#e8f8ff' }, stats: { maxHp: 70 }, affixes: [{ type: 'critChance', value: 8 }, { type: 'regenPct', value: 3 }],
  },
  // Étape 4 : une arme ancestrale pour chaque classe (avant, 6 sur 7 allaient au Chevalier, à l'Assassin ou au Berserker).
  {
    id: 'scarecrow_bow', name: "Arc de l'Épouvantail", slot: 'weapon', sprite: 'bow', signature: 'hard_scarecrow',
    colors: { main: '#c9a050', shade: '#6a4a22' }, stats: { damage: 4, attackSpeed: 8 }, affixes: [{ type: 'critChance', value: 6 }],
  },
  {
    id: 'treant_staff', name: 'Bâton du Tréant', slot: 'weapon', sprite: 'staff', signature: 'mini_treant',
    colors: { main: '#7a9a4a', shade: '#3e5222' }, stats: { damage: 5, maxHp: 10 }, affixes: [{ type: 'regenPct', value: 1.5 }],
  },
  {
    id: 'werewolf_spear', name: 'Lance du Loup-garou', slot: 'weapon', sprite: 'spear', signature: 'hard_werewolf',
    colors: { main: '#a8a0b8', shade: '#5a5068' }, stats: { damage: 6 }, affixes: [{ type: 'lifesteal', value: 3 }],
  },
  {
    id: 'pharaoh_mace', name: 'Masse solaire du Pharaon', slot: 'weapon', sprite: 'mace', signature: 'mini_pharaoh',
    colors: { main: '#ffd060', shade: '#a07020' }, stats: { damage: 7, armor: 3 }, affixes: [{ type: 'thorns', value: 20 }],
  },
  {
    id: 'jackal_crossbow', name: 'Arbalète du Chacal', slot: 'weapon', sprite: 'crossbow', signature: 'hard_anubis',
    colors: { main: '#3a3a4a', shade: '#1a1a26' }, stats: { damage: 9 }, affixes: [{ type: 'damageVsBossPct', value: 15 }],
  },
  {
    id: 'frost_witch_wand', name: 'Baguette de la Sorcière des glaces', slot: 'weapon', sprite: 'wand', signature: 'mini_frost_witch',
    colors: { main: '#9fe6ff', shade: '#4f8fc9' }, stats: { damage: 9, attackSpeed: 5 }, affixes: [{ type: 'critChance', value: 8 }],
  },
  {
    id: 'reaper_scythe', name: 'Faux de la Faucheuse', slot: 'weapon', sprite: 'scythe', signature: 'mini_reaper',
    colors: { main: '#5a5a6a', shade: '#22222e' }, stats: { damage: 10 }, affixes: [{ type: 'lifesteal', value: 5 }],
  },
];

// Effets spéciaux (« affixes ») tirés pour les objets Rares et mieux.
// Valeur = base × multiplicateur de rareté, arrondie.
export const AFFIXES = {
  critChance: { label: (v) => `+${v} % de coup critique`, base: 2, slots: ['weapon', 'helmet', ...ACCESSORY_SLOTS] },
  lifesteal: { label: (v) => `Vol de vie : ${v} % des dégâts`, base: 1, slots: ['weapon', ...ACCESSORY_SLOTS] },
  thorns: { label: (v) => `Épines : renvoie ${v} % des dégâts subis`, base: 8, slots: ['armor', 'helmet', ...ACCESSORY_SLOTS] },
  goldPct: { label: (v) => `+${v} % or`, base: 5, slots: ['weapon', 'helmet', 'armor', ...ACCESSORY_SLOTS] },
  damageVsBossPct: { label: (v) => `+${v} % dégâts contre les boss`, base: 6, slots: ['weapon', ...ACCESSORY_SLOTS] },
  damageVsNormalPct: { label: (v) => `+${v} % dégâts contre les ennemis ordinaires`, base: 6, slots: ['weapon', 'armor', ...ACCESSORY_SLOTS] },
  regenPct: { label: (v) => `+${String(v).replace('.', ',')} % PV/s`, base: 0.5, slots: ['helmet', 'armor', ...ACCESSORY_SLOTS] },
  dropChance: { label: (v) => `+${v} pts de chance de butin`, base: 1, slots: ['helmet', 'armor', ...ACCESSORY_SLOTS] },
};

export const STARTER_WEAPON = 'short_sword';
