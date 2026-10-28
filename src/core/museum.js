// Musée (v9.0) : comme les mannequins, mais pour les objets ancestraux (butin des boss). Une vitrine par objet
// ancestral ; chacune expose le meilleur exemplaire. Chaque pièce exposée donne un bonus permanent (multiplicatif,
// comme les ensembles), doublé pour une pièce Légendaire, et la collection complète ajoute un bonus final.
// Une pièce exposée n'est plus portée : pour la porter, on la reprend dans le sac.
import { BALANCE } from '../data/balance.js';
import { SIGNATURE_ITEMS } from '../data/items.js';
import { itemBase, itemPower } from './loot.js';

export const MUSEUM = {
  perPiece: { damageMultPct: 5, maxHpMultPct: 5, goldMultPct: 5 }, // ×2 pour une pièce Légendaire
  complete: { damageMultPct: 25, maxHpMultPct: 25 },
};

export const MUSEUM_PIECES = SIGNATURE_ITEMS.map((b) => b.id);

export function museumItems(state) {
  return Object.values(state.museum ?? {}).filter(Boolean);
}

export function museumCount(state) {
  return museumItems(state).length;
}

export function isAncestral(item) {
  return Boolean(item && itemBase(item.baseId)?.signature);
}

// Bonus du Musée (source « Musée » des bonus permanents).
export function museumEffects(state) {
  const out = {};
  const pieces = museumItems(state);
  for (const item of pieces) {
    const k = item.rarity === 'legendary' ? 2 : 1;
    for (const [key, v] of Object.entries(MUSEUM.perPiece)) out[key] = (out[key] ?? 0) + v * k;
  }
  if (pieces.length >= MUSEUM_PIECES.length) {
    for (const [key, v] of Object.entries(MUSEUM.complete)) out[key] = (out[key] ?? 0) + v;
  }
  return out;
}

function takeFrom(list, id) {
  const i = list.findIndex((x) => x.id === id);
  return i < 0 ? null : list.splice(i, 1)[0];
}

function store(state, item, balance) {
  if (state.inventory.length < balance.loot.inventorySize) { state.inventory.push(item); return true; }
  if (state.stash && state.stash.length < 300) { state.stash.push(item); return true; }
  return false;
}

// Expose un objet ancestral (du sac ou du coffre) ; l'exemplaire déjà exposé retourne au sac.
export function putInMuseum(state, id, balance = BALANCE) {
  const from = state.inventory.some((x) => x.id === id) ? state.inventory : state.stash ?? [];
  const item = from.find((x) => x.id === id);
  if (!isAncestral(item)) return false;
  const old = state.museum[item.baseId];
  takeFrom(from, id);
  state.museum[item.baseId] = item;
  if (old && !store(state, old, balance)) { state.museum[item.baseId] = old; from.push(item); return false; }
  return true;
}

export function takeFromMuseum(state, baseId, balance = BALANCE) {
  const item = state.museum?.[baseId];
  if (!item || !store(state, item, balance)) return false;
  delete state.museum[baseId];
  return true;
}

// v9.0.3 : expose les objets ancestraux déjà dans le sac et le coffre (vitrine vide ou exemplaire meilleur ;
// l'ancien exemplaire retourne au sac). Avant, l'exposition auto ne valait que pour les objets ramassés ensuite.
// Les objets portés ne sont jamais pris (le verrou protège du recyclage, pas de l'exposition). Renvoie le nombre de pièces exposées.
export function exposeAll(state, balance = BALANCE) {
  if (!state.museum) return 0;
  let n = 0;
  const candidates = [...state.inventory, ...(state.stash ?? [])].filter((i) => isAncestral(i))
    .sort((a, b) => itemPower(b) - itemPower(a));
  for (const item of candidates) {
    const old = state.museum[item.baseId];
    if (old && itemPower(old) >= itemPower(item)) continue;
    if (putInMuseum(state, item.id, balance)) n += 1;
  }
  return n;
}

// Ramassage : un objet ancestral va dans sa vitrine si elle est vide ou s'il est meilleur ; l'ancien exemplaire
// retourne au sac (les objets ancestraux ne sont jamais recyclés). Renvoie true si l'objet a été exposé.
export function autoMuseum(state, item, balance = BALANCE) {
  if (!isAncestral(item) || !state.museum || state.ui?.autoMuseum === false) return false;
  const old = state.museum[item.baseId];
  if (old && itemPower(old) >= itemPower(item)) return false;
  if (old && !store(state, old, balance)) return false;
  state.museum[item.baseId] = item;
  return true;
}
