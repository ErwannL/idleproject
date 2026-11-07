// Compagnons : bonus passif + compétence automatique simple.
// Les effets passifs sont multipliés par (1 + levelBonusPct × (niveau - 1)) × (passiveBase + passivePerDuplicate × D).
// v9.1.3 (doc4 lot 1) : D = doublons (0 à 5). ×1,5 dès l'obtention, ×1,8 à 4 doublons (= l'ancien maximum), ×1,875 à 5.

export const COMPANION_RULES = {
  maxLevel: 20,
  levelBonusPct: 0.08,
  passiveBase: 1.5,
  passivePerDuplicate: 0.075,
  maxCopies: 6, // v9.1.3 : 1 exemplaire + 5 doublons (les skins restent à 5 : BALANCE.summon.maxStars)
  upgradeCostKills: 15, // coût du niveau n = 15 × or d'un ennemi de l'étape max × 1,25^(n-1)
  upgradeCostGrowth: 1.25,
};

// skill.type : 'gold' (or = x ennemis), 'hit' (coup = x × dégâts), 'heal' (% PV),
//              'shield' (réduction des dégâts), 'burst' (frappe tous les ennemis).
function ally(id, name, rarity, fx, passive, skill, ultimate) {
  return { id, name, rarity, sprite: `ally_${id}`, kind: 'ally', fx, passive, skill, ...(ultimate ? { ultimate } : {}) };
}

// v9.1.3 (doc4 lot 3) : signature des SSR = ultime de leur rôle + un effet `also` (heal, shield ou gold seulement ;
// jamais rally, qui prolonge le Cri du héros sans borne). L'effet `also` ne prend pas les étoiles (valeur fixe, à caler
// en jeu). Noms provisoires : le développeur choisit (liste proposée dans docs/heros-v913.md).
const ALSO_TEXT = { heal: (a) => `soigne ${a.value} % des PV`, shield: (a) => `bouclier de ${a.value} % (${a.duration} s)`, gold: (a) => `fait tomber l'or de ${a.value} ennemis` };
export function signature(name, base, also) { // v9.1.3 (partie B) : exportée pour les persos de bannière (data/banners.js)
  return { ...base, name, also, alsoText: ALSO_TEXT[also.type](also) };
}
export const HIT_30 = { type: 'hit', every: 30, value: 3.5 }; // ultime Assassin
const BURST_30 = { type: 'burst', every: 30, value: 1.8375 }; // ultime Mage
const HEAL_25 = { type: 'heal', every: 25, value: 40 }; // ultime Soutien
// v9.2.9 : compétence spéciale des familiers SSR = ultime du rôle familier (Instinct sauvage) + effet `also` propre.
const PET_30 = { type: 'burst', every: 30, value: 35 / 24 };

// Étiquette de rareté des héros alliés (style gacha).

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
    // v9.1.3 (doc4 lot 3) : compétence propre (il n'en avait pas : 3 compétences au lieu de 4).
    passive: { xpPct: 15, dropChance: 1 }, skill: { name: 'Piqué nocturne', type: 'hit', every: 6, value: 0.6, text: 'Frappe à 60 % des dégâts du héros' },
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
  // v9.2.9 : nouveaux familiers (la collection n'avait qu'un seul SSR). Utiles et complémentaires, jamais
  // indispensables : chaque SSR couvre un rôle déjà tenu ailleurs (boss, survie, critique, soins), sans bonus d'or ni
  // d'expérience. Compétence spéciale (4e exemplaire) = signature (`ultimate`), comme les héros SSR.
  {
    id: 'crystal_hedgehog', name: 'Hérisson de cristal', rarity: 'epic', sprite: 'pet_crystal_hedgehog',
    passive: { armor: 3, critChance: 3 }, skill: { name: 'Piquants de cristal', type: 'burst', every: 9, value: 0.7, text: 'Projette ses piquants sur tous les ennemis (70 % des dégâts)' },
  },
  {
    id: 'dragonling', name: 'Dragonnet de braise', rarity: 'legendary', sprite: 'pet_dragonling',
    passive: { damageVsBossPct: 18, critChance: 2 }, skill: { name: 'Souffle de braise', type: 'hit', every: 6, value: 1.2, text: 'Crache une flamme à 120 % des dégâts du héros' },
    ultimate: signature('Brasier draconique', PET_30, { type: 'shield', value: 25, duration: 4 }),
  },
  {
    id: 'jade_turtle', name: 'Tortue de jade', rarity: 'legendary', sprite: 'pet_jade_turtle',
    passive: { armor: 8, maxHpPct: 8 }, skill: { name: 'Carapace de jade', type: 'shield', every: 18, value: 45, duration: 5, text: 'Réduit les dégâts de 45 % pendant 5 s' },
    ultimate: signature('Sanctuaire de jade', PET_30, { type: 'shield', value: 35, duration: 5 }),
  },
  {
    id: 'kitsune', name: 'Renard céleste', rarity: 'legendary', sprite: 'pet_kitsune',
    passive: { critChance: 5, attackSpeedPct: 6 }, skill: { name: 'Feux de renard', type: 'burst', every: 7, value: 0.9, text: 'Lance des feux de renard sur tous les ennemis (90 % des dégâts)' },
    ultimate: signature('Neuf queues', PET_30, { type: 'gold', value: 3 }),
  },
  {
    id: 'phoenix', name: 'Petit phénix', rarity: 'legendary', sprite: 'pet_phoenix',
    passive: { regenPct: 1, maxHpPct: 6, lifesteal: 1 }, skill: { name: 'Plume ardente', type: 'heal', every: 14, value: 16, text: 'Soigne 16 % des PV' },
    ultimate: signature('Renaissance', PET_30, { type: 'heal', value: 10 }),
  },
  // Héros alliés invocables (R = Rare, SR = Épique, SSR = Légendaire) : ils combattent aux côtés du
  // chevalier. `kind: 'ally'` : dessinés à taille humaine, avec une pose d'attaque ; `fx` : couleur de leur
  // effet de compétence. Sprites : ally_<id>, ally_<id>_b, ally_<id>_atk (tools/art/allies_*.py).
  // R
  ally('squire', 'Écuyer', 'rare', '#5aa8ff', { maxHpPct: 6 }, { name: 'Taille vaillante', type: 'hit', every: 7, value: 0.9, text: 'Frappe à 90 % des dégâts du héros' }),
  ally('mercenary', 'Mercenaire', 'rare', '#ff5a4a', { damagePct: 6 }, { name: 'Coup de taille', type: 'hit', every: 6, value: 0.8, text: 'Frappe à 80 % des dégâts du héros' }),
  ally('ranger', 'Rôdeur', 'rare', '#5ad46a', { critChance: 3 }, { name: 'Tir du rôdeur', type: 'hit', every: 5, value: 1, text: 'Tire à 100 % des dégâts du héros' }),
  ally('pyromancer', 'Pyromancienne', 'rare', '#ff8a3a', { damageVsNormalPct: 8 }, { name: 'Gerbe de flammes', type: 'burst', every: 9, value: 0.6, text: 'Brûle tous les ennemis (60 % des dégâts)' }),
  ally('priestess', 'Prêtresse', 'rare', '#ffe680', { regenPct: 0.6 }, { name: 'Prière de l\'aube', type: 'heal', every: 14, value: 12, text: 'Soigne 12 % des PV' }),
  ally('lancer', 'Lancier', 'rare', '#e84a5f', { damageVsBossPct: 8 }, { name: 'Percée', type: 'hit', every: 7, value: 1, text: 'Frappe à 100 % des dégâts du héros' }),
  ally('shadow', 'Ombre', 'rare', '#b46bff', { critChance: 4 }, { name: 'Lames jumelles', type: 'hit', every: 4, value: 0.8, text: 'Frappe à 80 % des dégâts du héros' }),
  ally('dwarf', 'Nain guerrier', 'rare', '#ffa630', { armor: 4 }, { name: 'Hache tournoyante', type: 'burst', every: 10, value: 0.6, text: 'Frappe tous les ennemis (60 % des dégâts)' }),
  // SR
  ally('azure_paladin', "Paladin d'azur", 'epic', '#4fa3ff', { maxHpPct: 10, armor: 4 }, { name: 'Bouclier sacré', type: 'shield', every: 18, value: 40, duration: 4, text: 'Réduit les dégâts de 40 % pendant 4 s' }),
  ally('rose_blade', 'Lame rose', 'epic', '#ff6fa8', { damagePct: 10 }, { name: 'Valse des épines', type: 'hit', every: 5, value: 1.1, text: 'Frappe à 110 % des dégâts du héros' }),
  ally('witch', 'Sorcière', 'epic', '#b05cff', { damagePct: 6, skillCooldownPct: 2 }, { name: 'Orbe du néant', type: 'burst', every: 8, value: 0.9, text: 'Frappe tous les ennemis (90 % des dégâts)' }),
  ally('elf_archer', 'Archère elfe', 'epic', '#7fe07a', { critChance: 5, attackSpeedPct: 4 }, { name: 'Volée de flèches', type: 'burst', every: 7, value: 0.7, text: 'Tire sur tous les ennemis (70 % des dégâts)' }),
  ally('high_priest', 'Grand prêtre', 'epic', '#ffd23f', { regenPct: 1, maxHpPct: 6 }, { name: 'Rayon sacré', type: 'heal', every: 12, value: 18, text: 'Soigne 18 % des PV' }),
  ally('ninja', 'Ninja', 'epic', '#9a5cff', { critChance: 6, lifesteal: 2 }, { name: 'Frappe éclair', type: 'hit', every: 4, value: 0.9, text: 'Frappe à 90 % des dégâts du héros' }),
  ally('barbarian', 'Barbare', 'epic', '#ff4a3a', { damagePct: 12 }, { name: 'Fureur', type: 'burst', every: 8, value: 1, text: 'Frappe tous les ennemis (100 % des dégâts)' }),
  // SSR
  ally('archangel', 'Archange', 'legendary', '#9fd8ff', { damagePct: 13, maxHpPct: 8 }, { name: 'Jugement céleste', type: 'burst', every: 7, value: 1.15, text: 'Frappe tous les ennemis (115 % des dégâts)' },
    signature('Aile protectrice', HEAL_25, { type: 'shield', value: 40, duration: 5 })),
  ally('demon_queen', 'Reine démone', 'legendary', '#ff5a2a', { damagePct: 14, damageVsBossPct: 6 }, { name: 'Brasier infernal', type: 'burst', every: 7, value: 1.1, text: 'Embrase tous les ennemis (110 % des dégâts)' },
    signature('Couronne de cendres', BURST_30, { type: 'heal', value: 8 })),
  ally('ice_empress', 'Impératrice des glaces', 'legendary', '#bfe9ff', { armor: 6, critChance: 6, damagePct: 10 }, { name: 'Tempête de givre', type: 'burst', every: 7, value: 1.05, text: 'Gèle tous les ennemis (105 % des dégâts)' },
    signature('Hiver éternel', BURST_30, { type: 'shield', value: 30, duration: 5 })),
  ally('shadow_lord', "Seigneur de l'ombre", 'legendary', '#a855ff', { damagePct: 13, lifesteal: 2 }, { name: 'Lame du néant', type: 'hit', every: 5, value: 1.6, text: 'Frappe à 160 % des dégâts du héros' },
    signature('Éclipse du néant', HIT_30, { type: 'heal', value: 8 })),
  ally('sylvan_guardian', 'Gardienne sylvestre', 'legendary', '#63d98a', { regenPct: 1.2, goldPct: 15 }, { name: 'Sève de vie', type: 'heal', every: 10, value: 22, text: 'Soigne 22 % des PV' },
    signature('Récolte sylvestre', HEAL_25, { type: 'gold', value: 3 })),
];
