// Prestige (v7.6) : au-dessus de la Renaissance. Une fois le méga boss du dernier monde vaincu,
// le Prestige réinitialise aussi les fragments et les talents, contre des étoiles de prestige
// qui achètent des bonus éternels, et un bonus permanent qui grandit à chaque Prestige.

export const PRESTIGE = {
  minStage: 121, // avoir terminé le monde 6 (méga boss de l'étape 120)
  starsBase: 1,
  starsPerStages: 60, // +1 étoile par tranche de 60 étapes au-delà
  perPrestige: { damagePct: 50, goldPct: 50 }, // bonus permanent par Prestige effectué
  fragmentBonusPct: 25, // fragments de Renaissance +25 % par Prestige
};

export const PRESTIGE_RESETS = ['Tout ce que réinitialise la Renaissance', 'Fragments anciens', 'Talents'];
export const PRESTIGE_KEEPS = ['Équipement, sac et matériaux', 'Personnages et compagnons', 'Pouvoirs des boss', 'Gemmes, tickets et clés', 'Niveau du héros et compétences'];

// Bonus éternels achetés avec les étoiles : coût du niveau n = n + 1 étoiles.
export const PRESTIGE_PERKS = [
  { id: 'power', name: 'Puissance éternelle', icon: 'weapon_sword', max: 20, effect: { damagePct: 30 } },
  { id: 'fortune', name: 'Fortune éternelle', icon: 'coin', max: 20, effect: { goldPct: 30 } },
  { id: 'vitality', name: 'Vitalité éternelle', icon: 'icon_heart', max: 20, effect: { maxHpPct: 30 } },
  { id: 'wisdom', name: 'Sagesse éternelle', icon: 'icon_star', max: 20, effect: { xpPct: 25 } },
  { id: 'luck', name: 'Chance éternelle', icon: 'icon_chest', max: 10, effect: { dropChance: 2 } },
  { id: 'haste', name: 'Célérité éternelle', icon: 'icon_bolt', max: 10, effect: { attackSpeedPct: 5 } },
];
