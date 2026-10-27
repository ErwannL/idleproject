// Renaissance (prestige) et talents permanents achetés avec les fragments anciens.
import { TALENT_REGIONS, buildTree } from './talent-tree.js';

export const REBIRTH = {
  minStage: 30, // étape maximale à atteindre pour pouvoir renaître (monde 2-10)
  // Fragments gagnés = floor(((étape max - 1) / divisor) ^ exponent)
  divisor: 10, // v7.6 : 20 étapes par monde
  exponent: 1.3,
};

// Ce que la Renaissance réinitialise et conserve (affiché avant confirmation).
// v7.7 : la Renaissance remet aussi à zéro le niveau du héros (et ses compétences), le niveau des
// compagnons et familiers, et ne garde qu'UN pouvoir ancestral (au choix). En échange, les boss
// s'adaptent : plus durs, mais leurs récompenses augmentent à chaque Renaissance.
export const REBIRTH_RESETS = [
  'Étapes et progression de campagne', 'Or courant', 'Améliorations (Dégâts, Vitesse, Vitalité)',
  'Niveau du héros et compétences', 'Niveau des compagnons et familiers (retour au niveau 1)',
  'Pouvoirs ancestraux : un seul est conservé',
];
export const REBIRTH_KEEPS = [
  'Équipement porté, sac et matériaux',
  'Compagnons et familiers (étoiles conservées), gemmes et tickets',
  'Le pouvoir ancestral choisi, Codex',
  'Talents et fragments anciens',
  'Statistiques et exploits',
];

// Arbre de talents permanents (fragments anciens). v8.5 : arbre « mastodonte » d'environ 500 nœuds,
// généré par src/data/talent-tree.js (Cœur au centre, 6 régions, anneaux, ponts entre régions).
export const TALENT_BRANCHES = [...TALENT_REGIONS, { id: 'bridge', label: 'Ponts', color: '#e8e2d0' }];

// Nœud central de l'arbre : il ouvre les 6 régions.
export const CORE_TALENT_ID = 'core';

export const TALENTS = buildTree();

// Réinitialisation de l'arbre (fragments rendus) : la première est gratuite, puis en gemmes.
export const TALENT_RESPEC = { gems: 300 };

// Ancien arbre (≤ v8.4, 25 talents) : gardé seulement pour rembourser les fragments dépensés (v8.5).
export const LEGACY_TALENTS = [
  { id: 'core', name: 'Cœur du chevalier', branch: 'core', row: -1, col: 1, x: 0, y: 0, icon: 'icon_hero', max: 5, costBase: 1, costStep: 1, perLevel: { damagePct: 3, maxHpPct: 3 } },
  // Combat
  { id: 'power', name: 'Puissance', branch: 'combat', row: 0, col: 1, x: -1, y: 0, icon: 'skill_mastery', max: 10, costBase: 1, costStep: 1, perLevel: { damagePct: 10 }, requires: { id: 'core', level: 1 } },
  { id: 'crit_master', name: "Maître d'armes", branch: 'combat', row: 1, col: 0, x: -2, y: 0, icon: 'skill_quick', max: 5, costBase: 2, costStep: 1, perLevel: { critChance: 2 }, requires: { id: 'power', level: 3 } },
  { id: 'giant_slayer', name: 'Tueur de géants', branch: 'combat', row: 1, col: 2, x: -2, y: -1, icon: 'icon_boss', max: 5, costBase: 2, costStep: 1, perLevel: { damageVsBossPct: 6 }, requires: { id: 'power', level: 3 } },
  { id: 'skill_mastery', name: 'Technique', branch: 'combat', row: 2, col: 0, x: -3, y: 0, icon: 'skill_whirl', max: 4, costBase: 3, costStep: 2, perLevel: { skillCooldownPct: 5 }, requires: { id: 'crit_master', level: 2 } },
  { id: 'swiftness', name: 'Célérité', branch: 'combat', row: 2, col: 2, x: -3, y: -1, icon: 'icon_bolt', max: 5, costBase: 3, costStep: 2, perLevel: { attackSpeedPct: 4 }, requires: { id: 'giant_slayer', level: 2 } },
  // Survie
  { id: 'endurance', name: 'Endurance', branch: 'survival', row: 0, col: 1, x: 0, y: 1, icon: 'icon_heart', max: 10, costBase: 1, costStep: 1, perLevel: { maxHpPct: 10 }, requires: { id: 'core', level: 1 } },
  { id: 'bulwark', name: 'Rempart', branch: 'survival', row: 1, col: 0, x: 0, y: 2, icon: 'icon_shield', max: 5, costBase: 2, costStep: 1, perLevel: { armor: 2 }, requires: { id: 'endurance', level: 3 } },
  { id: 'second_wind', name: 'Second souffle', branch: 'survival', row: 1, col: 2, x: 1, y: 2, icon: 'pet_fairy', max: 4, costBase: 3, costStep: 2, perLevel: { regenPct: 0.5 }, requires: { id: 'endurance', level: 3 } },
  { id: 'spikes', name: 'Hérisson', branch: 'survival', row: 2, col: 0, x: 0, y: 3, icon: 'skill_cry', max: 5, costBase: 3, costStep: 2, perLevel: { thorns: 6 }, requires: { id: 'bulwark', level: 2 } },
  { id: 'vampirism', name: 'Soif de vie', branch: 'survival', row: 2, col: 2, x: 1, y: 3, icon: 'icon_essence', max: 5, costBase: 3, costStep: 2, perLevel: { lifesteal: 1 }, requires: { id: 'second_wind', level: 2 } },
  // Ressources
  { id: 'fortune', name: 'Fortune', branch: 'resources', row: 0, col: 1, x: 1, y: 0, icon: 'coin', max: 10, costBase: 1, costStep: 1, perLevel: { goldPct: 10 }, requires: { id: 'core', level: 1 } },
  { id: 'hunt', name: 'Chasse', branch: 'resources', row: 1, col: 0, x: 2, y: 0, icon: 'icon_bag', max: 5, costBase: 2, costStep: 1, perLevel: { dropChance: 1 }, requires: { id: 'fortune', level: 2 } },
  { id: 'scholar', name: 'Érudition', branch: 'resources', row: 1, col: 2, x: 2, y: -1, icon: 'pet_owl', max: 5, costBase: 2, costStep: 1, perLevel: { xpPct: 10 }, requires: { id: 'fortune', level: 2 } },
  { id: 'treasure_sense', name: 'Flair du trésor', branch: 'resources', row: 2, col: 0, x: 3, y: 0, icon: 'icon_chest', max: 5, costBase: 3, costStep: 2, perLevel: { goldPct: 8, dropChance: 0.5 }, requires: { id: 'hunt', level: 2 } },
  { id: 'wisdom', name: 'Sagesse', branch: 'resources', row: 2, col: 2, x: 3, y: -1, icon: 'icon_book', max: 5, costBase: 3, costStep: 2, perLevel: { xpPct: 12 }, requires: { id: 'scholar', level: 2 } },
  // Spécial
  {
    id: 'legacy', name: 'Héritage', branch: 'special', row: 0, col: 1, x: 0, y: -1, icon: 'icon_fragment', max: 3, costBase: 3, costStep: 2,
    levels: [{ powerSlots: 1 }, { rerollDiscountPct: 25 }, { powerSlots: 1 }], requires: { id: 'core', level: 1 },
  },
  { id: 'beast_bond', name: 'Lien animal', branch: 'special', row: 1, col: 0, x: 0, y: -2, icon: 'pet_cat', max: 5, costBase: 2, costStep: 2, perLevel: { companionPct: 10 }, requires: { id: 'legacy', level: 1 } },
  { id: 'ancestral_echo', name: 'Écho ancestral', branch: 'special', row: 1, col: 2, x: -1, y: -2, icon: 'icon_rebirth', max: 4, costBase: 3, costStep: 2, perLevel: { damagePct: 5, maxHpPct: 5 }, requires: { id: 'legacy', level: 1 } },
  { id: 'pack_leader', name: 'Chef de meute', branch: 'special', row: 2, col: 0, x: 0, y: -3, icon: 'icon_paw', max: 5, costBase: 3, costStep: 2, perLevel: { companionPct: 12 }, requires: { id: 'beast_bond', level: 2 } },
];
