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
  'Équipement porté et sac',
  'Pouvoirs ancestraux, Codex et offres de relance',
  'Talents et fragments anciens',
  'Statistiques et exploits',
];

// Coût du niveau n (en partant de 0) = costBase + costStep × n.
// `perLevel` s'applique à chaque niveau ; `levels` décrit des paliers distincts.
export const TALENTS = [
  { id: 'power', name: 'Puissance', icon: 'weapon_sword', max: 10, costBase: 1, costStep: 1, perLevel: { damagePct: 10 } },
  { id: 'endurance', name: 'Endurance', icon: 'icon_heart', max: 10, costBase: 1, costStep: 1, perLevel: { maxHpPct: 10 } },
  { id: 'fortune', name: 'Fortune', icon: 'coin', max: 10, costBase: 1, costStep: 1, perLevel: { goldPct: 10 } },
  { id: 'hunt', name: 'Chasse', icon: 'icon_bag', max: 5, costBase: 2, costStep: 1, perLevel: { dropChance: 1 } },
  {
    id: 'legacy', name: 'Héritage', icon: 'icon_book', max: 3, costBase: 3, costStep: 2,
    levels: [{ powerSlots: 1 }, { rerollDiscountPct: 25 }, { powerSlots: 1 }],
  },
];
