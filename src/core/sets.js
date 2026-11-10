// Ensembles d'équipement (v8.5) : bonus des pièces portées, tirage au butin, pièces à garder.
import { BALANCE } from '../data/balance.js';
import { ITEM_SETS, SET_PIECES } from '../data/sets.js';
import { EQUIP_SLOTS, HERO_SLOTS, SLOTS, eqSlot, heroSlot } from '../data/items.js';

const BY_ID = new Map(ITEM_SETS.map((s) => [s.id, s]));

export function setById(id) {
  return BY_ID.get(id) ?? null;
}

// Ensemble du monde `zoneIndex` (aucun pour le monde 11 et la Tour).
export function setForZone(zoneIndex) {
  return ITEM_SETS.find((s) => s.zone === zoneIndex) ?? null;
}

// Un objet de cette rareté appartient-il à l'ensemble du monde ? (tirage fait par generateItem)
export function rollSet(zoneIndex, rarity, rng, balance = BALANCE) {
  const set = zoneIndex === null || zoneIndex === undefined ? null : setForZone(zoneIndex);
  return set && rng.next() < (balance.loot.setChance?.[rarity] ?? 0) ? set.id : null;
}

// Pièces portées par ensemble (une par emplacement).
export function setCounts(equipment) {
  const out = {};
  // v9.3.4 (f) : 3 places, chacune compte pour 2 pièces (2 places : paliers 2 et 4 ; 3 places : palier 6).
  for (const slot of Object.keys(HERO_SLOTS)) {
    const id = equipment[slot]?.set;
    if (id && BY_ID.has(id)) out[id] = (out[id] ?? 0) + 1; // v9.3.8 : 6 places, une pièce chacune (paliers 2, 4, 6)
  }
  return out;
}

// Bonus d'un ensemble pour n pièces (les paliers atteints s'additionnent).
export function setBonusFor(set, count) {
  const out = {};
  for (const n of SET_PIECES) {
    if (count < n) continue;
    for (const [k, v] of Object.entries(set.bonuses[n] ?? {})) out[k] = (out[k] ?? 0) + v;
  }
  return out;
}

export function setEffects(equipment) {
  const out = {};
  for (const [id, count] of Object.entries(setCounts(equipment))) {
    for (const [k, v] of Object.entries(setBonusFor(BY_ID.get(id), count))) out[k] = (out[k] ?? 0) + v;
  }
  return out;
}

// Ensembles actifs (au moins 2 pièces), pour l'affichage.
export function activeSets(equipment) {
  return Object.entries(setCounts(equipment)).filter(([, n]) => n >= SET_PIECES[0]).map(([id, n]) => ({ set: BY_ID.get(id), count: n }));
}

// Recyclage automatique (v8.5) : une pièce d'ensemble est gardée quand on commence à réunir cet ensemble
// (au moins 2 emplacements différents entre l'équipement porté et le sac), si c'est la meilleure pièce de
// son emplacement pour cet ensemble. Désactivable (Inventaire → règles).
export function usefulSetPiece(state, item, power = (i) => i.level) {
  if (!item.set || state.ui?.keepSets === false || !BY_ID.has(item.set)) return false;
  const worn = Object.values(state.equipment).filter(Boolean);
  // v9.1.3 : les pièces gardées au coffre comptent (elles remplacent les mannequins).
  const all = [...worn, ...state.inventory, ...(state.stash ?? [])].filter((i) => i.set === item.set);
  if (new Set(all.map((i) => i.slot)).size < 2) return false;
  return !all.some((i) => i !== item && i.slot === item.slot && power(i) > power(item));
}
