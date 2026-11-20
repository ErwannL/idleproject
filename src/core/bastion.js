// v10.3 (partie 10) : le Bastion. Ce fichier porte d'abord le CONTRAT lu par la Forge et l'écran d'Équipement :
// niveau de la Forge du forgeron et ce qu'il change (chance de fusion, renforcement maximal, coûts, commandes).
// L'état vit dans `state.bastion` : { buildings: { forge: { level }, … }, … } ; absent ou vide = Bastion pas encore ouvert.
import { BASTION_UNLOCK_STAGE, FORGE_PERKS } from '../data/bastion.js';

// Le Bastion s'ouvre à l'étape record 40 (jamais avant : un nouveau joueur a déjà assez à apprendre).
export function bastionOpen(state) {
  return Math.max(state?.maxStage ?? 1, state?.records?.bestStage ?? 1) >= BASTION_UNLOCK_STAGE;
}

export function buildingLevel(state, id) {
  return Math.max(0, Math.floor(state?.bastion?.buildings?.[id]?.level ?? 0));
}

// Niveau de la Forge du forgeron (0 = pas encore construite : la Forge garde ses chiffres de base).
export const forgeLevel = (state) => buildingLevel(state, 'forge');

// Ce que la Forge du forgeron apporte à un niveau donné.
export function forgePerks(state, level = forgeLevel(state)) {
  const p = FORGE_PERKS;
  const L = Math.max(0, level);
  return {
    level: L,
    fusionPoints: L * p.fusionPointsPerLevel,
    fusionCap: p.fusionCap,
    maxUpgradeBonus: L * p.maxUpgradePerLevel,
    upgradeCostPct: Math.min(p.upgradeCostPctCap, L * p.upgradeCostPctPerLevel),
    orderSlots: p.orderSlotsAt.filter((at) => L >= at).length,
    orderCostPct: Math.min(p.orderCostPctCap, L * p.orderCostPctPerLevel),
    legendaryOrders: L >= p.legendaryOrderLevel,
  };
}
