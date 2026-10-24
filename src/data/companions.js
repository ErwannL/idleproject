// Compagnons : bonus passif + compétence automatique simple.
// Les effets passifs sont multipliés par (1 + levelBonusPct × (niveau - 1)) × (1 + starBonusPct × (étoiles - 1)).

export const COMPANION_RULES = {
  maxLevel: 20,
  levelBonusPct: 0.08,
  starBonusPct: 0.2,
  upgradeCostKills: 15, // coût du niveau n = 15 × or d'un ennemi de l'étape max × 1,25^(n-1)
  upgradeCostGrowth: 1.25,
};

// skill.type : 'gold' (or = x ennemis), 'hit' (coup = x × dégâts), 'heal' (% PV),
//              'shield' (réduction des dégâts), 'burst' (frappe tous les ennemis).
export const COMPANIONS = [
  {
    id: 'golden_slime', name: 'Slime doré', rarity: 'common', sprite: 'pet_slime',
    passive: { goldPct: 10 }, skill: { name: "Pluie d'or", type: 'gold', every: 20, value: 5, text: "Fait tomber l'or de 5 ennemis" },
  },
  {
    id: 'cat', name: 'Chat du château', rarity: 'common', sprite: 'pet_cat',
    passive: { attackSpeedPct: 5 }, skill: { name: 'Griffure', type: 'hit', every: 8, value: 0.6, text: 'Frappe à 60 % des dégâts du héros' },
  },
  {
    id: 'owl', name: 'Hibou érudit', rarity: 'rare', sprite: 'pet_owl',
    passive: { xpPct: 15, dropChance: 1 }, skill: null,
  },
  {
    id: 'fairy', name: 'Fée des bois', rarity: 'rare', sprite: 'pet_fairy',
    passive: { regenPct: 0.8 }, skill: { name: 'Soin', type: 'heal', every: 15, value: 15, text: 'Soigne 15 % des PV' },
  },
  {
    id: 'golem', name: 'Mini-golem', rarity: 'epic', sprite: 'pet_golem',
    passive: { armor: 6 }, skill: { name: 'Rempart', type: 'shield', every: 20, value: 50, duration: 4, text: 'Réduit les dégâts de 50 % pendant 4 s' },
  },
  {
    id: 'wisp', name: 'Feu follet', rarity: 'legendary', sprite: 'pet_wisp',
    passive: { damagePct: 15 }, skill: { name: 'Flamme', type: 'burst', every: 6, value: 0.8, text: 'Brûle tous les ennemis (80 % des dégâts)' },
  },
];
