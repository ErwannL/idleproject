// Bonus éternels (v7.7 : le Prestige est fusionné dans la Renaissance).
// Chaque Renaissance donne un bonus permanent (perPrestige × nombre de Renaissances) ; les bonus
// éternels s'achètent avec les fragments anciens, comme les talents.

export const PRESTIGE = {
  minStage: 121, // avoir terminé le monde 6 (méga boss de l'étape 120)
  starsBase: 1,
  starsPerStages: 60, // +1 étoile par tranche de 60 étapes au-delà
  perPrestige: { damagePct: 10, goldPct: 10 }, // bonus permanent par Renaissance effectuée
  perkCostFragments: 10, // coût du niveau n = 10 × (n + 1) fragments
  legacyStarFragments: 10, // anciennes étoiles de prestige converties en fragments
  fragmentBonusPct: 25, // fragments de Renaissance +25 % par Prestige
};

export const PRESTIGE_RESETS = ['Tout ce que réinitialise la Renaissance (niveaux, pouvoirs sauf un…)', 'Fragments anciens', 'Talents'];
export const PRESTIGE_KEEPS = ['Équipement, sac et matériaux', 'Compagnons et familiers (étoiles)', 'Un pouvoir ancestral au choix', 'Gemmes, tickets et clés'];

// Bonus éternels achetés avec les fragments anciens.
export const PRESTIGE_PERKS = [
  { id: 'power', name: 'Puissance éternelle', icon: 'weapon_sword', max: 20, effect: { damagePct: 30 } },
  { id: 'fortune', name: 'Fortune éternelle', icon: 'coin', max: 20, effect: { goldPct: 30 } },
  { id: 'vitality', name: 'Vitalité éternelle', icon: 'icon_heart', max: 20, effect: { maxHpPct: 30 } },
  { id: 'wisdom', name: 'Sagesse éternelle', icon: 'icon_star', max: 20, effect: { xpPct: 25 } },
  { id: 'luck', name: 'Chance éternelle', icon: 'icon_chest', max: 10, effect: { dropChance: 2 } },
  { id: 'haste', name: 'Célérité éternelle', icon: 'icon_bolt', max: 10, effect: { attackSpeedPct: 5 } },
];
