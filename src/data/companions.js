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
function ally(id, name, rarity, fx, passive, skill) {
  return { id, name, rarity, sprite: `ally_${id}`, kind: 'ally', fx, passive, skill };
}

// Étiquette de rareté des héros alliés (style gacha).
export const ALLY_GRADE = { rare: 'R', epic: 'SR', legendary: 'SSR' };

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
  // Héros alliés invocables (R = Rare, SR = Épique, SSR = Légendaire) : ils combattent aux côtés du
  // chevalier. `kind: 'ally'` : dessinés à taille humaine, avec une pose d'attaque ; `fx` : couleur de leur
  // effet de compétence. Sprites : ally_<id>, ally_<id>_b, ally_<id>_atk (tools/art/allies_*.py).
  // R
  ally('squire', 'Écuyer', 'rare', '#5aa8ff', { maxHpPct: 6 }, { name: 'Taille vaillante', type: 'hit', every: 7, value: 0.9, text: 'Frappe à 90 % des dégâts du héros' }),
  ally('mercenary', 'Mercenaire', 'rare', '#ff5a4a', { damagePct: 6 }, { name: 'Coup de taille', type: 'hit', every: 6, value: 0.8, text: 'Frappe à 80 % des dégâts du héros' }),
  ally('ranger', 'Rôdeur', 'rare', '#5ad46a', { critChance: 3 }, { name: 'Flèche perçante', type: 'hit', every: 5, value: 0.7, text: 'Tire à 70 % des dégâts du héros' }),
  ally('pyromancer', 'Pyromancienne', 'rare', '#ff8a3a', { damageVsNormalPct: 8 }, { name: 'Boule de feu', type: 'burst', every: 9, value: 0.6, text: 'Brûle tous les ennemis (60 % des dégâts)' }),
  ally('priestess', 'Prêtresse', 'rare', '#ffe680', { regenPct: 0.6 }, { name: 'Prière', type: 'heal', every: 14, value: 12, text: 'Soigne 12 % des PV' }),
  ally('lancer', 'Lancier', 'rare', '#e84a5f', { damageVsBossPct: 8 }, { name: 'Percée', type: 'hit', every: 7, value: 1, text: 'Frappe à 100 % des dégâts du héros' }),
  ally('shadow', 'Ombre', 'rare', '#b46bff', { critChance: 4 }, { name: 'Lames jumelles', type: 'hit', every: 4, value: 0.5, text: 'Frappe à 50 % des dégâts du héros' }),
  ally('dwarf', 'Nain guerrier', 'rare', '#ffa630', { armor: 4 }, { name: 'Hache tournoyante', type: 'burst', every: 10, value: 0.6, text: 'Frappe tous les ennemis (60 % des dégâts)' }),
  // SR
  ally('azure_paladin', "Paladin d'azur", 'epic', '#4fa3ff', { maxHpPct: 10, armor: 4 }, { name: 'Bouclier sacré', type: 'shield', every: 18, value: 40, duration: 4, text: 'Réduit les dégâts de 40 % pendant 4 s' }),
  ally('rose_blade', 'Lame rose', 'epic', '#ff6fa8', { damagePct: 10 }, { name: 'Danse des lames', type: 'hit', every: 5, value: 1.1, text: 'Frappe à 110 % des dégâts du héros' }),
  ally('witch', 'Sorcière', 'epic', '#b05cff', { damagePct: 6, skillCooldownPct: 5 }, { name: 'Orbe du néant', type: 'burst', every: 8, value: 0.9, text: 'Frappe tous les ennemis (90 % des dégâts)' }),
  ally('elf_archer', 'Archère elfe', 'epic', '#7fe07a', { critChance: 5, attackSpeedPct: 4 }, { name: 'Volée de flèches', type: 'burst', every: 7, value: 0.7, text: 'Tire sur tous les ennemis (70 % des dégâts)' }),
  ally('high_priest', 'Grand prêtre', 'epic', '#ffd23f', { regenPct: 1, maxHpPct: 6 }, { name: 'Lumière divine', type: 'heal', every: 12, value: 18, text: 'Soigne 18 % des PV' }),
  ally('ninja', 'Ninja', 'epic', '#9a5cff', { critChance: 6, lifesteal: 2 }, { name: 'Frappe éclair', type: 'hit', every: 4, value: 0.9, text: 'Frappe à 90 % des dégâts du héros' }),
  ally('barbarian', 'Barbare', 'epic', '#ff4a3a', { damagePct: 12 }, { name: 'Fureur', type: 'burst', every: 8, value: 1, text: 'Frappe tous les ennemis (100 % des dégâts)' }),
  // SSR
  ally('archangel', 'Archange', 'legendary', '#9fd8ff', { damagePct: 15, maxHpPct: 15 }, { name: 'Jugement céleste', type: 'burst', every: 7, value: 1.5, text: 'Frappe tous les ennemis (150 % des dégâts)' }),
  ally('demon_queen', 'Reine démone', 'legendary', '#ff5a2a', { damagePct: 20, damageVsBossPct: 10 }, { name: 'Brasier infernal', type: 'burst', every: 6, value: 1.3, text: 'Embrase tous les ennemis (130 % des dégâts)' }),
  ally('ice_empress', 'Impératrice des glaces', 'legendary', '#bfe9ff', { armor: 8, critChance: 6 }, { name: 'Tempête de givre', type: 'burst', every: 7, value: 1.2, text: 'Gèle tous les ennemis (120 % des dégâts)' }),
  ally('shadow_lord', "Seigneur de l'ombre", 'legendary', '#a855ff', { damagePct: 18, lifesteal: 3 }, { name: 'Lame du néant', type: 'hit', every: 5, value: 2.5, text: 'Frappe à 250 % des dégâts du héros' }),
  ally('sylvan_guardian', 'Gardienne sylvestre', 'legendary', '#63d98a', { regenPct: 1.5, goldPct: 20 }, { name: 'Sève de vie', type: 'heal', every: 10, value: 25, text: 'Soigne 25 % des PV' }),
];
