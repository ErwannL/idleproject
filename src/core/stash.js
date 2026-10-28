// Coffre et mannequins (v8.9).
// - Coffre : 300 places en plus du sac ; ce qui y est rangé n'est jamais recyclé ni fusionné automatiquement.
// - Mannequins : un par ensemble d'équipement ; chacun garde la meilleure pièce de chaque emplacement de son
//   ensemble. « Porter » échange tout l'ensemble avec l'équipement actuel en un clic. Option : les pièces
//   d'ensemble ramassées vont d'elles-mêmes sur leur mannequin si elles sont meilleures.
import { BALANCE } from '../data/balance.js';
import { ITEM_SETS } from '../data/sets.js';
import { SLOTS } from '../data/items.js';
import { itemPower } from './loot.js';

export const STASH_SIZE = 300;

export function emptyMannequins() {
  return Object.fromEntries(ITEM_SETS.map((s) => [s.id, {}]));
}

export function mannequinItems(state) {
  return Object.values(state.mannequins ?? {}).flatMap((m) => Object.values(m)).filter(Boolean);
}

export function mannequinCount(state, setId) {
  return Object.values(state.mannequins?.[setId] ?? {}).filter(Boolean).length;
}

function takeFrom(list, id) {
  const i = list.findIndex((x) => x.id === id);
  return i < 0 ? null : list.splice(i, 1)[0];
}

// Range un objet dans le sac, sinon au coffre ; false si tout est plein.
function store(state, item, balance) {
  if (state.inventory.length < balance.loot.inventorySize) { state.inventory.push(item); return true; }
  if (state.stash.length < STASH_SIZE) { state.stash.push(item); return true; }
  return false;
}

export function moveToStash(state, id) {
  if (state.stash.length >= STASH_SIZE) return false;
  const item = takeFrom(state.inventory, id);
  if (!item) return false;
  state.stash.push(item);
  return true;
}

export function takeFromStash(state, id, balance = BALANCE) {
  if (state.inventory.length >= balance.loot.inventorySize) return false;
  const item = takeFrom(state.stash, id);
  if (!item) return false;
  state.inventory.push(item);
  return true;
}

// Pose une pièce d'ensemble (du sac ou du coffre) sur son mannequin ; la pièce remplacée retourne au sac.
export function putOnMannequin(state, id, balance = BALANCE) {
  const from = state.inventory.some((x) => x.id === id) ? state.inventory : state.stash;
  const item = from.find((x) => x.id === id);
  if (!item?.set || !state.mannequins[item.set]) return false;
  const m = state.mannequins[item.set];
  const old = m[item.slot];
  takeFrom(from, id);
  m[item.slot] = item;
  if (old && !store(state, old, balance)) { m[item.slot] = old; from.push(item); return false; }
  return true;
}

export function takeFromMannequin(state, setId, slot, balance = BALANCE) {
  const m = state.mannequins[setId];
  const item = m?.[slot];
  if (!item || !store(state, item, balance)) return false;
  delete m[slot];
  return true;
}

// « Porter » : chaque pièce du mannequin remplace l'objet porté ; l'objet retiré va sur son propre mannequin
// (pièce d'ensemble, si la place est libre ou moins bonne), sinon au sac, sinon au coffre.
export function wearMannequin(state, setId, balance = BALANCE) {
  const m = state.mannequins[setId];
  if (!m) return 0;
  let n = 0;
  for (const slot of Object.keys(SLOTS)) {
    const piece = m[slot];
    if (!piece) continue;
    const worn = state.equipment[slot];
    delete m[slot];
    state.equipment[slot] = piece;
    n += 1;
    if (!worn) continue;
    const home = worn.set && state.mannequins[worn.set];
    if (home && (!home[slot] || itemPower(home[slot]) < itemPower(worn))) {
      const displaced = home[slot];
      home[slot] = worn;
      if (displaced && !store(state, displaced, balance)) home[slot] = displaced;
    } else if (!store(state, worn, balance)) {
      // Plus aucune place : on annule pour cet emplacement (rien n'est perdu).
      state.equipment[slot] = worn;
      m[slot] = piece;
      n -= 1;
    }
  }
  return n;
}

// Ramassage : une pièce d'ensemble meilleure que celle du mannequin y va directement.
// Renvoie la pièce remplacée (à recycler par l'appelant), ou false si l'objet n'a pas été pris.
export function autoMannequin(state, item) {
  if (!item.set || state.ui?.autoMannequin === false) return false;
  const m = state.mannequins?.[item.set];
  if (!m) return false;
  const old = m[item.slot];
  if (old && itemPower(old) >= itemPower(item)) return false;
  m[item.slot] = item;
  return old ?? null;
}
