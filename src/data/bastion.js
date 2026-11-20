// v10.3 (partie 10) : le Bastion — bâtiments, ouvriers, recherches et forgeron. Tout l'équilibrage du Bastion est ici
// (core/bastion.js lit ces tables). Pas de nouvelle monnaie : or, éclats et temps.
export const BASTION_UNLOCK_STAGE = 40;

// Forge du forgeron : ce que chaque niveau change dans la Forge (core/forge.js lit `forgePerks`).
export const FORGE_PERKS = {
  fusionPointsPerLevel: 5, // chance de fusion à 3 ou 4 objets : +5 points par niveau
  fusionCap: 95, // plafond des mises courtes (la mise de 5 reste à 100 %)
  maxUpgradePerLevel: 2, // renforcement maximal : +2 par niveau (10 → 12 → 14…)
  upgradeCostPctPerLevel: 2, // coût des renforcements : −2 % par niveau
  upgradeCostPctCap: 30,
  orderSlotsAt: [1, 4, 7], // niveaux où s'ouvre la 1re, 2e et 3e commande simultanée
  orderCostPctPerLevel: 10, // commande : −10 % du coût de « Fabriquer » par niveau
  orderCostPctCap: 50,
  legendaryOrderLevel: 6, // commande Légendaire+ à partir de ce niveau
};
