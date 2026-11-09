// Coffre (v8.9) : 300 places en plus du sac ; ce qui y est rangé n'est jamais recyclé ni fusionné automatiquement.
// v9.1.3 : les mannequins sont fondus dans le coffre (voir plus bas).
import { BALANCE } from '../data/balance.js';
import { ITEM_SETS } from '../data/sets.js';
import { EQUIP_SLOTS, SLOTS, eqSlot } from '../data/items.js';
import { itemPower } from './loot.js';
import { canEquip } from './classes.js';

// v9.1.3 (doc3 lot 1) : constante unique (BALANCE.loot.stashSize), aussi utilisée par le Musée.
export const STASH_SIZE = BALANCE.loot.stashSize;

// v9.1.3 (doc3 lot 1) : range un objet reçu — au sac s'il a de la place, sinon au coffre. Renvoie 'bag', 'stash'
// ou false (sac et coffre pleins). Partagée par le Musée (ancienne copie locale `store`, avec 300 en dur).
export function storeItem(state, item, balance = BALANCE) {
  if (state.inventory.length < balance.loot.inventorySize) { state.inventory.push(item); return 'bag'; }
  if (state.stash && state.stash.length < STASH_SIZE) { state.stash.push(item); return 'stash'; }
  return false;
}

// v9.1.3 (doc3 lot 1) : sac et coffre pleins — un objet payé ou verrouillé ne disparaît jamais : il attend dans
// « À récupérer » (comme un coffre d'événement), au-delà de la limite de la boîte, et ne peut pas être jeté.
export function holdItem(state, item) {
  state.nextEventId = (state.nextEventId ?? 0) + 1;
  state.inbox.push({ id: state.nextEventId, type: 'held', item, reward: {}, stage: state.stage });
  return 'held';
}

// Range ou met en attente : renvoie 'bag', 'stash' ou 'held' (jamais de perte).
export function placeItem(state, item, balance = BALANCE) {
  return storeItem(state, item, balance) || holdItem(state, item);
}

// v9.1.3 (doc3 lot 1) : une arme d'une autre classe ne compte pas pour la garde ni pour « Porter ».
const wearable = (state, x) => canEquip(state, x);

// v9.1.3 : dépassement géré — après la conversion des mannequins, le coffre peut garder jusqu'à 77 objets de plus
// (11 ensembles × 7 emplacements) ; rien n'y entre tant qu'il est au-dessus de 300, rien n'est perdu.
export const STASH_OVERFLOW = ITEM_SETS.length * 7;

// Anciennes données (format 7) : objets posés sur les mannequins.
export function mannequinItems(state) {
  return Object.values(state.mannequins ?? {}).flatMap((m) => Object.values(m ?? {})).filter(Boolean);
}

function takeFrom(list, id) {
  const i = list.findIndex((x) => x.id === id);
  return i < 0 ? null : list.splice(i, 1)[0];
}

export function moveToStash(state, id) {
  if (state.stash.length >= STASH_SIZE) return false; // (v9.1.3 : aussi quand le coffre déborde)
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

// v9.1.3 (doc1 lot F, « Mannequins fondus dans le coffre ») : plus de mannequins. Les pièces d'ensemble vivent au
// coffre ; le coffre se filtre par ensemble et « Porter » équipe la meilleure pièce de chaque emplacement de cet
// ensemble. La garde automatique de la meilleure pièce est reconstruite au coffre (autoStashSet). Critère d'abandon :
// docs/refontes-v913.md.

// Meilleure pièce du coffre pour un ensemble et un emplacement (ou null).
// v9.1.3 (doc3 lot 1) : seulement les pièces portables par la classe active.
export function bestSetPiece(state, setId, slot) {
  let best = null;
  for (const x of state.stash ?? []) if (x.set === setId && eqSlot(x) === slot && wearable(state, x) && (!best || itemPower(x) > itemPower(best))) best = x;
  return best;
}

// Ensembles présents au coffre : [{ setId, slots }] (nombre d'emplacements couverts).
export function stashSets(state) {
  const by = new Map();
  for (const x of state.stash ?? []) if (x.set) by.set(x.set, new Set([...(by.get(x.set) ?? []), eqSlot(x)]));
  return ITEM_SETS.filter((set) => by.has(set.id)).map((set) => ({ setId: set.id, slots: by.get(set.id).size }));
}

// « Porter » : pour chaque emplacement, la meilleure pièce de l'ensemble au coffre remplace l'objet porté, qui prend sa
// place au coffre (le coffre garde le même nombre d'objets : jamais de débordement). Renvoie le nombre de pièces portées.
export function wearSet(state, setId) {
  let n = 0;
  for (const slot of Object.keys(EQUIP_SLOTS)) {
    const piece = bestSetPiece(state, setId, slot);
    if (!piece) continue;
    const worn = state.equipment[slot];
    if (worn?.set === setId && itemPower(worn) >= itemPower(piece)) continue; // déjà mieux porté
    const i = state.stash.indexOf(piece);
    if (worn) state.stash[i] = worn; else state.stash.splice(i, 1);
    state.equipment[slot] = piece;
    n += 1;
  }
  return n;
}

// Ramassage : une pièce d'ensemble meilleure que la meilleure du coffre (même ensemble, même emplacement) y va
// directement ; l'ancienne meilleure est rendue pour être recyclée, sauf si elle est verrouillée (elle reste).
// Renvoie la pièce remplacée (à recycler), null s'il n'y en avait pas, false si l'objet n'a pas été pris
// (rangement auto désactivé, pièce moins bonne, coffre plein).
// v9.1.3 (doc3 lot 1) : une arme d'une autre classe n'est pas gardée (elle suit le chemin normal) ; l'ancienne
// meilleure reste au coffre si elle est verrouillée ou renforcée (payée), jamais recyclée.
export function autoStashSet(state, item) {
  if (!item.set || state.ui?.autoMannequin === false || !state.stash || !wearable(state, item)) return false;
  const old = bestSetPiece(state, item.set, item.slot);
  if (old && itemPower(old) >= itemPower(item)) return false;
  const replace = old && !old.locked && !((old.upgrades ?? 0) > 0);
  if (!replace && state.stash.length >= STASH_SIZE) return false;
  if (replace) state.stash[state.stash.indexOf(old)] = item;
  else state.stash.push(item);
  return replace ? old : null;
}
