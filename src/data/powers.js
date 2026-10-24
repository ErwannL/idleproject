// Pouvoirs ancestraux des boss : chaque boss a sa propre liste de passifs thématiques.
// La première victoire en débloque un au hasard ; l'or permet ensuite d'en proposer un autre.
// Toutes les probabilités, coûts et effets se règlent ici.
//
// Effets possibles (additionnés entre pouvoirs et talents) :
//   damagePct, attackSpeedPct, maxHpPct (%), regenPct (% des PV max par seconde),
//   armor (points d'armure en %), goldPct (% d'or), dropChance (points de % de butin),
//   damageVsNormalPct, damageVsBossPct (%), lowHpArmor (armure en plus sous 30 % de PV).

export const POWER_RULES = {
  // Tirage : on choisit d'abord une rareté (poids ci-dessous), puis un pouvoir de cette rareté.
  rarityWeights: { common: 55, rare: 30, epic: 12, legendary: 3 },
  baseSlots: 2, // pouvoirs actifs en même temps (le talent Héritage en ajoute)
  rerollCostBossGold: 3, // coût de relance = 3 × l'or donné par le boss à sa première étape
  rerollCostGrowth: 1, // 1 = coût fixe ; >1 = coût qui augmente à chaque relance
  pity: { after: 6, minRarity: 'epic' }, // après 6 relances sans Épique+, la suivante en garantit un
  lowHpThreshold: 0.3,
  // Relancer exige d'avoir réaffronté le boss : chaque nouvelle victoire donne une charge.
  chargesPerVictory: 1,
  maxCharges: 3,
  // Synergie : deux pouvoirs actifs de la même famille renforcent leurs effets.
  synergy: { minSameFamily: 2, bonusPct: 25 },
};

export const POWER_FAMILIES = {
  survival: { label: 'Survie', color: '#63d98a' },
  combat: { label: 'Combat', color: '#ff7a6b' },
  fortune: { label: 'Fortune', color: '#f2d083' },
};

export const BOSS_POWERS = {
  slime_king: [
    { id: 'gel_heart', name: 'Cœur gélatineux', rarity: 'common', family: 'survival', effects: { maxHpPct: 10 } },
    { id: 'ooze_regen', name: 'Suintement régénérant', rarity: 'rare', family: 'survival', effects: { regenPct: 1.5 } },
    { id: 'elastic_wall', name: 'Membrane élastique', rarity: 'rare', family: 'survival', effects: { armor: 6 } },
    { id: 'royal_jelly', name: 'Gelée royale', rarity: 'epic', family: 'survival', effects: { maxHpPct: 20, regenPct: 1 } },
    { id: 'king_hoard', name: 'Trésor du Roi', rarity: 'legendary', family: 'fortune', effects: { goldPct: 25, maxHpPct: 10 } },
  ],
  alpha_wolf: [
    { id: 'predator_instinct', name: 'Instinct du prédateur', rarity: 'common', family: 'combat', effects: { damageVsNormalPct: 12 } },
    { id: 'pack_fury', name: 'Furie de la meute', rarity: 'rare', family: 'combat', effects: { attackSpeedPct: 8 } },
    { id: 'bloodlust', name: 'Soif de sang', rarity: 'rare', family: 'combat', effects: { damagePct: 10 } },
    { id: 'alpha_fang', name: "Croc de l'Alpha", rarity: 'epic', family: 'combat', effects: { damageVsNormalPct: 25, attackSpeedPct: 5 } },
    { id: 'moon_hunter', name: 'Chasseur lunaire', rarity: 'legendary', family: 'combat', effects: { damagePct: 20, attackSpeedPct: 10 } },
  ],
  bone_lord: [
    { id: 'beyond_touch', name: 'Murmure des tombes', rarity: 'common', family: 'fortune', effects: { dropChance: 2 } },
    { id: 'bone_crusher', name: "Briseur d'os", rarity: 'rare', family: 'combat', effects: { damageVsBossPct: 15 } },
    { id: 'last_bastion', name: 'Dernier rempart', rarity: 'rare', family: 'survival', effects: { lowHpArmor: 20 } },
    { id: 'soul_harvest', name: "Moisson d'âmes", rarity: 'epic', family: 'fortune', effects: { goldPct: 15, dropChance: 2 } },
    { id: 'lich_crown', name: 'Couronne de la liche', rarity: 'legendary', family: 'combat', effects: { damageVsBossPct: 30, dropChance: 3 } },
  ],
  spectral_queen: [
    { id: 'ghost_touch', name: "Toucher de l'au-delà", rarity: 'common', family: 'fortune', effects: { dropChance: 2 } },
    { id: 'wailing', name: 'Lamentation', rarity: 'rare', family: 'combat', effects: { critChance: 5 } },
    { id: 'ethereal', name: 'Forme éthérée', rarity: 'rare', family: 'survival', effects: { armor: 8 } },
    { id: 'phantom_tithe', name: 'Dîme fantôme', rarity: 'epic', family: 'fortune', effects: { goldPct: 20, dropChance: 2 } },
    { id: 'queen_grace', name: 'Grâce de la Reine', rarity: 'legendary', family: 'fortune', effects: { dropChance: 5, goldPct: 15 } },
  ],
  ash_dragon: [
    { id: 'ember_blood', name: 'Sang de braise', rarity: 'common', family: 'combat', effects: { damagePct: 8 } },
    { id: 'dragon_blood', name: 'Sang draconique', rarity: 'rare', family: 'combat', effects: { damageVsBossPct: 20 } },
    { id: 'scale_skin', name: "Peau d'écailles", rarity: 'rare', family: 'survival', effects: { armor: 10 } },
    { id: 'hoard_heat', name: 'Chaleur du trésor', rarity: 'epic', family: 'fortune', effects: { goldPct: 25 } },
    { id: 'ash_wings', name: 'Ailes de cendre', rarity: 'legendary', family: 'combat', effects: { damageVsBossPct: 35, critChance: 5 } },
  ],
  fallen_knight: [
    { id: 'last_stand', name: 'Ultime résistance', rarity: 'common', family: 'survival', effects: { lowHpArmor: 15 } },
    { id: 'oath_broken', name: 'Serment brisé', rarity: 'rare', family: 'combat', effects: { critChance: 6 } },
    { id: 'dark_plate', name: 'Plates sombres', rarity: 'rare', family: 'survival', effects: { maxHpPct: 15 } },
    { id: 'black_vow', name: 'Vœu noir', rarity: 'epic', family: 'combat', effects: { damagePct: 15, lifesteal: 2 } },
    { id: 'fallen_glory', name: 'Gloire déchue', rarity: 'legendary', family: 'survival', effects: { maxHpPct: 25, lowHpArmor: 25 } },
  ],
  demon_king: [
    { id: 'infernal_coin', name: 'Pièce infernale', rarity: 'common', family: 'fortune', effects: { goldPct: 12 } },
    { id: 'hellfire', name: 'Feu infernal', rarity: 'rare', family: 'combat', effects: { damagePct: 12 } },
    { id: 'demon_hide', name: 'Peau démoniaque', rarity: 'rare', family: 'survival', effects: { thorns: 20 } },
    { id: 'pact', name: 'Pacte', rarity: 'epic', family: 'combat', effects: { damagePct: 15, goldPct: 10 } },
    { id: 'domination', name: 'Domination', rarity: 'legendary', family: 'fortune', effects: { goldPct: 30, damagePct: 15 } },
  ],
};

// Libellés des effets (affichage).
export const EFFECT_LABELS = {
  damagePct: (v) => `+${v} % dégâts`,
  attackSpeedPct: (v) => `+${v} % vitesse d'attaque`,
  maxHpPct: (v) => `+${v} % PV max`,
  regenPct: (v) => `+${String(v).replace('.', ',')} % PV/s`,
  armor: (v) => `+${v} % armure`,
  goldPct: (v) => `+${v} % or`,
  dropChance: (v) => `+${v} pts de chance de butin`,
  damageVsNormalPct: (v) => `+${v} % dégâts contre les ennemis ordinaires`,
  damageVsBossPct: (v) => `+${v} % dégâts contre les boss`,
  lowHpArmor: (v) => `+${v} % armure sous 30 % de PV`,
  critChance: (v) => `+${v} % de coup critique`,
  lifesteal: (v) => `vol de vie ${v} %`,
  thorns: (v) => `épines ${v} %`,
  xpPct: (v) => `+${v} % XP`,
  companionPct: (v) => `+${v} % effets des compagnons`,
  skillCooldownPct: (v) => `-${v} % recharge des compétences`,
  powerSlots: (v) => `+${v} emplacement${v > 1 ? 's' : ''} de pouvoir`,
  rerollDiscountPct: (v) => `-${v} % coût de relance`,
};
