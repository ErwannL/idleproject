// v9.6.2 (7.6, validé par le créateur) : sceaux. À partir du monde 3, le méga boss de fin de monde (étape 20) demande
// un sceau, gagné au choix : un donjon terminé, 5 étages franchis dans une ascension de la Tour, ou une manche du Défi.
// Un sceau gagné va au premier monde qui en manque. Jamais bloquant : après 15 min de combat devant la porte, le sceau
// est accordé quand même (plus lentement qu'en jouant les contenus). Les sauvegardes déjà plus loin gardent tout ouvert.
import { BALANCE } from '../data/balance.js';
import { cycleForStage, stageInZone, zoneIndexForStage } from './combat.js';

export const SEALS = { fromZone: 2, waitSeconds: 15 * 60 };

export function needsSeal(state, stage, balance = BALANCE) {
  if (!Array.isArray(state.seals)) return false; // état construit à la main (tests, outils) : pas de porte
  if (cycleForStage(stage, balance) > 0) return false;
  if (stageInZone(stage, balance) !== balance.stages.stagesPerZone) return false;
  const z = zoneIndexForStage(stage, balance);
  return z >= SEALS.fromZone && !(state.seals ?? []).includes(z);
}

// Sceau gagné (contenu joué) : pour le premier monde qui en manque, jusqu'au monde atteint. Renvoie l'index ou null.
export function grantSeal(state, balance = BALANCE) {
  const reach = zoneIndexForStage(Math.max(1, state.maxStage), balance);
  for (let z = SEALS.fromZone; z <= reach; z++) {
    if ((state.seals ?? []).includes(z)) continue;
    state.seals = [...(state.seals ?? []), z].sort((a, b) => a - b);
    return z;
  }
  return null;
}

// Migration : les mondes déjà dépassés ont leur sceau.
export function sanitizeSeals(state, raw, balance = BALANCE) {
  const list = Array.isArray(raw) ? raw.filter((z) => Number.isInteger(z) && z >= 0 && z < 40) : [];
  const best = Math.max(state.maxStage ?? 1, state.records?.bestStage ?? 1);
  const passed = cycleForStage(best, balance) > 0 ? 99 : zoneIndexForStage(best, balance) - (stageInZone(best, balance) >= balance.stages.stagesPerZone ? 0 : 1);
  for (let z = SEALS.fromZone; z <= Math.min(passed, 30); z++) if (!list.includes(z)) list.push(z);
  if (state.records?.rebirths > 0 || (state.transcend?.count ?? 0) > 0) for (let z = SEALS.fromZone; z < 12; z++) if (!list.includes(z)) list.push(z); // déjà vu en entier
  state.seals = [...new Set(list)].sort((a, b) => a - b);
}
