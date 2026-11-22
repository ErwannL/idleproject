// v9.6.2 (7.6, validé par le créateur) : sceaux. À partir du monde 3, le méga boss de fin de monde (étape 20) demande
// un sceau, gagné au choix : un donjon terminé, 5 étages franchis dans une ascension de la Tour, ou une manche du Défi.
// Un sceau gagné va au premier monde qui en manque. Jamais bloquant : après 15 min de combat devant la porte, le sceau
// est accordé quand même (plus lentement qu'en jouant les contenus). Les sauvegardes déjà plus loin gardent tout ouvert.
import { BALANCE } from '../data/balance.js';
import { ZONES } from '../data/zones.js';
import { cycleForStage, stageInZone, zoneIndexForStage } from './combat.js';

export const SEALS = { fromZone: 2, waitSeconds: 15 * 60 };

// v9.6.5 (10.3) : ouverture programmée d'un monde. Une fiche (data/zones.js) peut porter `opensAt` (date ISO ou ms) :
// avant cette date, la première étape du monde reste fermée (on refarme la dernière) et le jeu affiche un compte à rebours.
export function worldOpensAt(zoneIndex) {
  const v = ZONES[zoneIndex]?.opensAt;
  if (v === undefined || v === null) return null;
  const t = typeof v === 'number' ? v : Date.parse(v);
  return Number.isFinite(t) ? t : null;
}
export function worldClosed(stage, now = Date.now(), balance = BALANCE) {
  if (cycleForStage(stage, balance) > 0 || stageInZone(stage, balance) !== 1) return false;
  const t = worldOpensAt(zoneIndexForStage(stage, balance));
  return t !== null && now < t;
}

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

// v10.8 (partie 1) : Sceaux de monde (parties commencées en 10.8). Pour entrer dans les mondes 5, 7, 9 et 11, il faut des
// Renaissances, ou un Bastion assez haut (somme des niveaux). La condition s'affiche à l'entrée du monde, avec un bouton
// vers ce qui fait avancer ; la première Renaissance est guidée au mur du monde 5.
export const WORLD_GATES = { 4: { rebirths: 1, bastion: 15 }, 6: { rebirths: 2, bastion: 40 }, 8: { rebirths: 4, bastion: 80 }, 10: { rebirths: 6, bastion: 140 } };
export function worldGate(state, stage, balance = BALANCE) {
  if (state?.pace !== 108 || cycleForStage(stage, balance) > 0 || stageInZone(stage, balance) !== 1) return null;
  const z = zoneIndexForStage(stage, balance);
  const g = WORLD_GATES[z];
  if (!g) return null;
  const reb = state.records?.rebirths ?? 0;
  const bastion = Object.values(state.bastion?.buildings ?? {}).reduce((t, b) => t + Math.max(0, Math.floor(b?.level ?? 0)), 0);
  if (reb >= g.rebirths || bastion >= g.bastion) return null;
  return { zone: z, rebirths: g.rebirths, bastion: g.bastion, text: `Monde ${z + 1} scellé : ${g.rebirths > 1 ? `${g.rebirths} Renaissances` : 'une Renaissance'} ou Bastion niveau ${g.bastion}` };
}
