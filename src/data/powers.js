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
};

export const BOSS_POWERS = {
  slime_king: [
    { id: 'gel_heart', name: 'Cœur gélatineux', rarity: 'common', effects: { maxHpPct: 10 } },
    { id: 'ooze_regen', name: 'Suintement régénérant', rarity: 'rare', effects: { regenPct: 1.5 } },
    { id: 'elastic_wall', name: 'Membrane élastique', rarity: 'rare', effects: { armor: 6 } },
    { id: 'royal_jelly', name: 'Gelée royale', rarity: 'epic', effects: { maxHpPct: 20, regenPct: 1 } },
    { id: 'king_hoard', name: 'Trésor du Roi', rarity: 'legendary', effects: { goldPct: 25, maxHpPct: 10 } },
  ],
  alpha_wolf: [
    { id: 'predator_instinct', name: 'Instinct du prédateur', rarity: 'common', effects: { damageVsNormalPct: 12 } },
    { id: 'pack_fury', name: 'Furie de la meute', rarity: 'rare', effects: { attackSpeedPct: 8 } },
    { id: 'bloodlust', name: 'Soif de sang', rarity: 'rare', effects: { damagePct: 10 } },
    { id: 'alpha_fang', name: "Croc de l'Alpha", rarity: 'epic', effects: { damageVsNormalPct: 25, attackSpeedPct: 5 } },
    { id: 'moon_hunter', name: 'Chasseur lunaire', rarity: 'legendary', effects: { damagePct: 20, attackSpeedPct: 10 } },
  ],
  bone_lord: [
    { id: 'beyond_touch', name: "Toucher de l'au-delà", rarity: 'common', effects: { dropChance: 2 } },
    { id: 'bone_crusher', name: "Briseur d'os", rarity: 'rare', effects: { damageVsBossPct: 15 } },
    { id: 'last_bastion', name: 'Dernier rempart', rarity: 'rare', effects: { lowHpArmor: 20 } },
    { id: 'soul_harvest', name: "Moisson d'âmes", rarity: 'epic', effects: { goldPct: 15, dropChance: 2 } },
    { id: 'lich_crown', name: 'Couronne de la liche', rarity: 'legendary', effects: { damageVsBossPct: 30, dropChance: 3 } },
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
  powerSlots: (v) => `+${v} emplacement${v > 1 ? 's' : ''} de pouvoir`,
  rerollDiscountPct: (v) => `-${v} % coût de relance`,
};
