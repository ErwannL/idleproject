// v10.8 (parties 3 à 5) : ce que font les bâtiments des Âges du Bastion.
//   Atelier d'enchantement : grave un effet de plus sur un objet Mythique ou au-delà (une fois par objet).
//   Ménagerie : les familiers possédés produisent des essences de maîtrise, même jeu fermé (stock de 12 h).
//   Atelier d'Ascension : 3 objets Astraux de même place + 1 Larme d'Ascendrya (+ de l'or) → 1 objet Ascendant.
//   Marché noir (nœud clé) : un objet Mythique par semaine au Comptoir, pour des éclats.
// La Larme d'Ascendrya (state.materials.tears) vient de la première Renaissance de chaque saison (core/rebirth.js).
import { BALANCE } from '../data/balance.js';
import { ASCENSION_RECIPE } from '../data/bastion.js';
import { ITEM_BASES, SLOTS } from '../data/items.js';
import { bastionOf, buildingLevel } from './bastion-base.js';
import { levelForStage } from './combat.js';
import { addToInventory } from './inventory.js';
import { makeItem, rarityIndex, refreshItemStats, rollAffixes } from './loot.js';
import { goldUnit } from './bastion.js';

const HOUR = 3_600_000;
const best = (s) => Math.max(s.maxStage ?? 1, s.records?.bestStage ?? 1);
const findItem = (state, id) => state.inventory.find((i) => i.id === id) ?? Object.values(state.equipment ?? {}).find((i) => i?.id === id) ?? null;

// ---- Atelier d'enchantement : gravure
export const ENGRAVE_SHARDS = 2000;
export function canEngrave(state, id) {
  const item = findItem(state, id);
  if (buildingLevel(state, 'enchant') < 1) return { ok: false, reason: 'Construis l\'Atelier d\'enchantement (Âge II)' };
  if (!item || rarityIndex(item.rarity) < rarityIndex('mythic')) return { ok: false, reason: 'Mythique, Astral ou Ascendant seulement' };
  if (item.engraved) return { ok: false, reason: 'Déjà gravé' };
  if ((state.materials?.shards ?? 0) < ENGRAVE_SHARDS) return { ok: false, reason: `Il faut ${ENGRAVE_SHARDS} éclats` };
  return { ok: true, reason: '' };
}
export function engraveItem(state, id, rng, balance = BALANCE) {
  if (!canEngrave(state, id).ok) return null;
  const item = findItem(state, id);
  const have = new Set((item.affixes ?? []).map((a) => a.type));
  const extra = rollAffixes(item.slot, 'mythic', rng, balance, [...have]).find((a) => !have.has(a.type));
  if (!extra) return null;
  state.materials.shards -= ENGRAVE_SHARDS;
  item.affixes = [...(item.affixes ?? []), extra];
  item.engraved = true;
  refreshItemStats(item, balance);
  return extra;
}

// ---- Ménagerie : essences de maîtrise au fil du temps
export const MENAGERIE = { perHourPerLevel: 0.08, capHours: 12 };
export function menagerieStock(state, now = Date.now()) {
  const b = bastionOf(state);
  const lv = buildingLevel(state, 'menagerie');
  if (!b || lv < 1) return 0;
  b.menagerieAt ??= now;
  const pets = Object.keys(state.companions?.owned ?? {}).filter((id) => id.startsWith('pet') || state.companions.owned[id]?.pet).length || 1;
  const essencePct = Object.entries(b.research?.levels ?? {}).filter(([k]) => k.startsWith('essence')).reduce((t, [, v]) => t + 10 * v, 0);
  const hours = Math.min(MENAGERIE.capHours, Math.max(0, now - b.menagerieAt) / HOUR);
  return Math.floor(hours * MENAGERIE.perHourPerLevel * lv * Math.min(5, pets) * (1 + essencePct / 100));
}
export function collectMenagerie(state, now = Date.now()) {
  const n = menagerieStock(state, now);
  if (n < 1) return 0;
  state.materials.mastery = (state.materials.mastery ?? 0) + n;
  bastionOf(state).menagerieAt = now;
  return n;
}

// ---- Atelier d'Ascension : 3 Astraux + 1 Larme → 1 Ascendant
export function ascensionPool(state, slot) {
  return state.inventory.filter((i) => i.slot === slot && i.rarity === 'astral' && !i.locked);
}
export function ascensionCost(state, balance = BALANCE) {
  return { gold: Math.floor(ASCENSION_RECIPE.gold * goldUnit(state, balance)), tears: ASCENSION_RECIPE.tears, astral: ASCENSION_RECIPE.astral };
}
export function canAscend(state, slot, balance = BALANCE) {
  if (buildingLevel(state, 'ascension') < 1) return { ok: false, reason: 'Construis l\'Atelier d\'Ascension (Âge IV)' };
  if (!SLOTS[slot]) return { ok: false, reason: 'Choisis une place' };
  const c = ascensionCost(state, balance);
  if (ascensionPool(state, slot).length < c.astral) return { ok: false, reason: `Il faut ${c.astral} objets Astraux de cette place` };
  if ((state.materials?.tears ?? 0) < c.tears) return { ok: false, reason: 'Il faut une Larme d\'Ascendrya' };
  if ((state.gold ?? 0) < c.gold) return { ok: false, reason: 'Pas assez d\'or' };
  return { ok: true, reason: '' };
}
export function ascendItems(state, slot, rng, balance = BALANCE) {
  if (!canAscend(state, slot, balance).ok) return null;
  const c = ascensionCost(state, balance);
  const used = ascensionPool(state, slot).sort((a, b) => b.level - a.level).slice(0, c.astral);
  const ids = new Set(used.map((i) => i.id));
  state.inventory = state.inventory.filter((i) => !ids.has(i.id));
  state.materials.tears -= c.tears;
  state.gold -= c.gold;
  const base = rng.pick(ITEM_BASES.filter((b) => b.slot === slot && !b.signature));
  const item = makeItem(state, base.id, 'ascendant', Math.max(...used.map((i) => i.level)), balance, rng);
  addToInventory(state, item, balance);
  return item;
}

// ---- Marché noir (nœud clé) : un objet Mythique par semaine
export const BLACK_MARKET_SHARDS = 15000;
const weekKey = (now) => Math.floor(now / (7 * 24 * HOUR));
export function blackMarketOpen(state, now = Date.now()) {
  return Boolean(state?.bastion?.research?.levels?.key_market) && bastionOf(state).blackMarketWeek !== weekKey(now);
}
export function buyBlackMarket(state, slot, rng, now = Date.now(), balance = BALANCE) {
  if (!blackMarketOpen(state, now) || !SLOTS[slot] || (state.materials?.shards ?? 0) < BLACK_MARKET_SHARDS) return null;
  state.materials.shards -= BLACK_MARKET_SHARDS;
  bastionOf(state).blackMarketWeek = weekKey(now);
  const base = rng.pick(ITEM_BASES.filter((b) => b.slot === slot && !b.signature));
  const item = makeItem(state, base.id, 'mythic', levelForStage(best(state)), balance, rng);
  addToInventory(state, item, balance);
  return item;
}
