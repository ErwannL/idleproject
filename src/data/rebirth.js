// Renaissance (prestige) et talents permanents achetés avec les fragments anciens.

export const REBIRTH = {
  minStage: 15, // étape maximale à atteindre pour pouvoir renaître
  // Fragments gagnés = floor(((étape max - 1) / divisor) ^ exponent)
  divisor: 5,
  exponent: 1.3,
};

// Ce que la Renaissance réinitialise et conserve (affiché avant confirmation).
export const REBIRTH_RESETS = ['Étapes et progression de campagne', 'Or courant', 'Améliorations (Dégâts, Vitesse, Vitalité)'];
export const REBIRTH_KEEPS = [
  'Niveau du héros et compétences',
  'Équipement porté, sac et matériaux',
  'Héros, compagnons, gemmes et tickets',
  'Pouvoirs ancestraux, Codex et offres de relance',
  'Talents et fragments anciens',
  'Statistiques et exploits',
];

// Arbre de talents permanents (fragments anciens) : un seul arbre qui part du « Cœur du chevalier »,
// au centre, vers 4 branches (une par direction) ; chaque branche se divise en deux.
// Chaque nœud est débloqué par son parent (`requires`).
// Coût du niveau n (en partant de 0) = costBase + costStep × n.
// `perLevel` s'applique à chaque niveau ; `levels` décrit des paliers distincts.
// `row` : profondeur dans la branche ; `col` : position dans la branche (0 d'un côté, 1 au milieu, 2 de l'autre).
export const TALENT_BRANCHES = [
  { id: 'combat', label: 'Combat', color: '#ff7a6b' },
  { id: 'survival', label: 'Survie', color: '#63d98a' },
  { id: 'resources', label: 'Ressources', color: '#f2d083' },
  { id: 'special', label: 'Spécial', color: '#c9a6ff' },
];

// Nœud central de l'arbre : il ouvre les 4 branches.
export const CORE_TALENT_ID = 'core';

export const TALENTS = [
  { id: 'core', name: 'Cœur du chevalier', branch: 'core', row: -1, col: 1, icon: 'icon_hero', max: 5, costBase: 1, costStep: 1, perLevel: { damagePct: 3, maxHpPct: 3 } },
  // Combat
  { id: 'power', name: 'Puissance', branch: 'combat', row: 0, col: 1, icon: 'skill_mastery', max: 10, costBase: 1, costStep: 1, perLevel: { damagePct: 10 }, requires: { id: 'core', level: 1 } },
  { id: 'crit_master', name: "Maître d'armes", branch: 'combat', row: 1, col: 0, icon: 'skill_quick', max: 5, costBase: 2, costStep: 1, perLevel: { critChance: 2 }, requires: { id: 'power', level: 3 } },
  { id: 'giant_slayer', name: 'Tueur de géants', branch: 'combat', row: 1, col: 2, icon: 'icon_boss', max: 5, costBase: 2, costStep: 1, perLevel: { damageVsBossPct: 6 }, requires: { id: 'power', level: 3 } },
  { id: 'skill_mastery', name: 'Technique', branch: 'combat', row: 2, col: 0, icon: 'skill_whirl', max: 4, costBase: 3, costStep: 2, perLevel: { skillCooldownPct: 5 }, requires: { id: 'crit_master', level: 2 } },
  { id: 'swiftness', name: 'Célérité', branch: 'combat', row: 2, col: 2, icon: 'icon_bolt', max: 5, costBase: 3, costStep: 2, perLevel: { attackSpeedPct: 4 }, requires: { id: 'giant_slayer', level: 2 } },
  // Survie
  { id: 'endurance', name: 'Endurance', branch: 'survival', row: 0, col: 1, icon: 'icon_heart', max: 10, costBase: 1, costStep: 1, perLevel: { maxHpPct: 10 }, requires: { id: 'core', level: 1 } },
  { id: 'bulwark', name: 'Rempart', branch: 'survival', row: 1, col: 0, icon: 'icon_shield', max: 5, costBase: 2, costStep: 1, perLevel: { armor: 2 }, requires: { id: 'endurance', level: 3 } },
  { id: 'second_wind', name: 'Second souffle', branch: 'survival', row: 1, col: 2, icon: 'pet_fairy', max: 4, costBase: 3, costStep: 2, perLevel: { regenPct: 0.5 }, requires: { id: 'endurance', level: 3 } },
  { id: 'spikes', name: 'Hérisson', branch: 'survival', row: 2, col: 0, icon: 'skill_cry', max: 5, costBase: 3, costStep: 2, perLevel: { thorns: 6 }, requires: { id: 'bulwark', level: 2 } },
  { id: 'vampirism', name: 'Soif de vie', branch: 'survival', row: 2, col: 2, icon: 'icon_essence', max: 5, costBase: 3, costStep: 2, perLevel: { lifesteal: 1 }, requires: { id: 'second_wind', level: 2 } },
  // Ressources
  { id: 'fortune', name: 'Fortune', branch: 'resources', row: 0, col: 1, icon: 'coin', max: 10, costBase: 1, costStep: 1, perLevel: { goldPct: 10 }, requires: { id: 'core', level: 1 } },
  { id: 'hunt', name: 'Chasse', branch: 'resources', row: 1, col: 0, icon: 'icon_bag', max: 5, costBase: 2, costStep: 1, perLevel: { dropChance: 1 }, requires: { id: 'fortune', level: 2 } },
  { id: 'scholar', name: 'Érudition', branch: 'resources', row: 1, col: 2, icon: 'pet_owl', max: 5, costBase: 2, costStep: 1, perLevel: { xpPct: 10 }, requires: { id: 'fortune', level: 2 } },
  { id: 'treasure_sense', name: 'Flair du trésor', branch: 'resources', row: 2, col: 0, icon: 'icon_chest', max: 5, costBase: 3, costStep: 2, perLevel: { goldPct: 8, dropChance: 0.5 }, requires: { id: 'hunt', level: 2 } },
  { id: 'wisdom', name: 'Sagesse', branch: 'resources', row: 2, col: 2, icon: 'icon_book', max: 5, costBase: 3, costStep: 2, perLevel: { xpPct: 12 }, requires: { id: 'scholar', level: 2 } },
  // Spécial
  {
    id: 'legacy', name: 'Héritage', branch: 'special', row: 0, col: 1, icon: 'icon_fragment', max: 3, costBase: 3, costStep: 2,
    levels: [{ powerSlots: 1 }, { rerollDiscountPct: 25 }, { powerSlots: 1 }], requires: { id: 'core', level: 1 },
  },
  { id: 'beast_bond', name: 'Lien animal', branch: 'special', row: 1, col: 0, icon: 'pet_cat', max: 5, costBase: 2, costStep: 2, perLevel: { companionPct: 10 }, requires: { id: 'legacy', level: 1 } },
  { id: 'ancestral_echo', name: 'Écho ancestral', branch: 'special', row: 1, col: 2, icon: 'icon_rebirth', max: 4, costBase: 3, costStep: 2, perLevel: { damagePct: 5, maxHpPct: 5 }, requires: { id: 'legacy', level: 1 } },
  { id: 'pack_leader', name: 'Chef de meute', branch: 'special', row: 2, col: 0, icon: 'icon_paw', max: 5, costBase: 3, costStep: 2, perLevel: { companionPct: 12 }, requires: { id: 'beast_bond', level: 2 } },
];
