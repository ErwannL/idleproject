// v10.3 (partie 10) : le Bastion — bâtiments, ouvriers, recherches et forgeron.
// Ce fichier porte le CONTRAT lu par la Forge et l'écran d'Équipement (réexporté de ./bastion-base.js : niveau de la
// Forge du forgeron et ce qu'il change), puis ce qui dépend du reste du jeu : coûts en or (or d'un ennemi de l'étape
// max), commandes forgées (vrai générateur d'objets) livrées dans le coffre de butin, et le pas du Bastion.
// Les règles sans dépendance (état, ouvriers, production, recherches, rappels, sauvegarde) sont dans ./bastion-base.js.
import { BALANCE } from '../data/balance.js';
import { BASTION_MAX_LEVEL, BASTION_UNLOCK_STAGE, BUILD_STEPS, LIBRARY, RESEARCH_STEPS, RESEARCH_UNLOCK_LEVEL } from '../data/bastion.js';
import { SLOTS } from '../data/items.js';
import {
  HOUR, MINUTE, advance, bastionOf, buildingAccess, buildingDef, buildingLevel, branchOf, ensureBastion, forgeLevel, forgePerks, orderLabel, orderSlots,
  orderTier, orderTierOpen, pushNews, reconcileWorkers, researchDef, researchLevel, researchSlots, researchStatus,
} from './bastion-base.js';
import { levelForStage, referenceKillGold } from './combat.js';
import { craftCost } from './forge.js';
import { LOOT_BAG_MAX, lootBagOn } from './inventory.js';
import { generateItem } from './loot.js';
import { Rng } from './rng.js';
import { rebirthMultiplier } from './stats.js';

export * from './bastion-base.js';

// Unité des coûts en or : l'or d'un ennemi de l'étape max (au moins l'étape 40) × le multiplicateur de Renaissance —
// le prix suit les revenus du joueur (après une Renaissance aussi : l'étape repart de 1, le multiplicateur monte).
export function goldUnit(state, balance = BALANCE) {
  return referenceKillGold(levelForStage(Math.max(BASTION_UNLOCK_STAGE, state.maxStage ?? 1), balance), balance) * rebirthMultiplier(state);
}
const goldRef = goldUnit;

// Chantier suivant d'un bâtiment : { level (visé), gold, shards, ms } ou null au niveau maximal.
export function buildCost(state, id, balance = BALANCE) {
  const def = buildingDef(id);
  const level = buildingLevel(state, id);
  if (!def || def.existing || level >= BASTION_MAX_LEVEL) return null;
  const step = BUILD_STEPS[Math.min(level, BUILD_STEPS.length - 1)];
  const kills = def.goldKills?.[level] ?? step.goldKills;
  return { level: level + 1, gold: Math.floor(kills * goldRef(state, balance)), shards: Math.round(step.shards * (def.shards ?? 1)), ms: step.minutes * MINUTE };
}

// Peut-on lancer le chantier ? { ok, reason } — reason : ce qui manque, en une ligne.
export function canBuild(state, id, balance = BALANCE) {
  const b = bastionOf(state);
  const cost = buildCost(state, id, balance);
  if (!b || !buildingAccess(state, id).available) return { ok: false, reason: buildingAccess(state, id).reason || 'Bâtiment verrouillé' };
  if (!cost) return { ok: false, reason: 'Niveau maximal atteint' };
  const slot = b.buildings[id];
  if (slot.build) return { ok: false, reason: 'Un chantier est déjà en cours' };
  if (!slot.worker) return { ok: false, reason: 'Aucun ouvrier : pose un compagnon d\'abord' };
  if ((state.gold ?? 0) < cost.gold) return { ok: false, reason: 'Pas assez d\'or' };
  if ((state.materials?.shards ?? 0) < cost.shards) return { ok: false, reason: 'Pas assez d\'éclats' };
  return { ok: true, reason: '' };
}

export function startBuild(state, id, now = Date.now(), balance = BALANCE) {
  settle(state, now);
  if (!canBuild(state, id, balance).ok) return false;
  const cost = buildCost(state, id, balance);
  state.gold -= cost.gold;
  state.materials.shards -= cost.shards;
  bastionOf(state).buildings[id].build = { left: cost.ms, total: cost.ms, level: cost.level };
  return true;
}


// Coût et durée du prochain niveau d'une recherche : { level, gold, shards, ms } ou null au maximum.
export function researchCost(state, id, balance = BALANCE) {
  const def = researchDef(id);
  if (!def) return null;
  const level = researchLevel(state, id);
  if (level >= def.max) return null;
  const n = level + 1;
  const pos = branchOf(def.branch).indexOf(def);
  const s = RESEARCH_STEPS;
  const tier = 1 + (s.tierCostPct / 100) * pos;
  const minutes = Math.min(s.maxMinutes, s.minutes[Math.min(n, s.minutes.length) - 1] * (1 + (s.tierTimePct / 100) * pos));
  const faster = 1 - Math.min(0.6, (LIBRARY.durationPctPerLevel / 100) * Math.max(0, buildingLevel(state, 'library') - 1));
  return { level: n, gold: Math.floor(s.goldKills * n ** 1.5 * tier * goldRef(state, balance)), shards: Math.round(s.shards * n ** 1.5 * tier), ms: Math.round(minutes * MINUTE * faster) };
}


export function canResearch(state, id, balance = BALANCE) {
  const b = bastionOf(state);
  const def = researchDef(id);
  if (!b || !def) return { ok: false, reason: 'Recherche inconnue' };
  if (researchSlots(state) < 1) return { ok: false, reason: 'Construis d\'abord la Bibliothèque' };
  const st = researchStatus(state, id);
  if (st.maxed) return { ok: false, reason: 'Niveau maximal atteint' };
  if (!st.unlocked) return { ok: false, reason: `Demande ${st.lockedBy.name} niveau ${Math.min(RESEARCH_UNLOCK_LEVEL, st.lockedBy.max)}` };
  if (st.active) return { ok: false, reason: 'Déjà en cours' };
  if (b.research.active.length >= researchSlots(state)) return { ok: false, reason: researchSlots(state) > 1 ? 'Deux recherches sont déjà en cours' : 'Une recherche est déjà en cours' };
  const cost = researchCost(state, id, balance);
  if ((state.gold ?? 0) < cost.gold) return { ok: false, reason: 'Pas assez d\'or' };
  if ((state.materials?.shards ?? 0) < cost.shards) return { ok: false, reason: 'Pas assez d\'éclats' };
  return { ok: true, reason: '' };
}

export function startResearch(state, id, now = Date.now(), balance = BALANCE) {
  settle(state, now);
  if (!canResearch(state, id, balance).ok) return false;
  const cost = researchCost(state, id, balance);
  state.gold -= cost.gold;
  state.materials.shards -= cost.shards;
  bastionOf(state).research.active.push({ id, left: cost.ms, total: cost.ms, level: cost.level });
  return true;
}

// Coût d'une commande : celui de « Fabriquer » (craftCost), réduit de 10 % par niveau de Forge. { gold, shards, ms }.
export function orderCost(state, tierId, balance = BALANCE) {
  const t = orderTier(tierId);
  if (!t) return null;
  const base = craftCost(state, balance, t.craft);
  const k = t.costFactor * (1 - forgePerks(state).orderCostPct / 100);
  return { gold: Math.floor(base.gold * k), shards: Math.max(1, Math.round(base.shards * k)), ms: t.hours * HOUR };
}

export function canOrder(state, slot, tierId, balance = BALANCE) {
  const b = bastionOf(state);
  if (!b || forgeLevel(state) < 1) return { ok: false, reason: 'La Forge du forgeron n\'est pas construite' };
  if (!SLOTS[slot]) return { ok: false, reason: 'Choisis une place' };
  if (!orderTierOpen(state, tierId)) return { ok: false, reason: `Forge du forgeron niveau ${orderTier(tierId)?.forgeLevel ?? 1} requise` };
  if (b.orders.length >= orderSlots(state)) return { ok: false, reason: orderSlots(state) > 1 ? 'Toutes les commandes sont prises' : 'Une commande est déjà en cours' };
  const cost = orderCost(state, tierId, balance);
  if ((state.gold ?? 0) < cost.gold) return { ok: false, reason: 'Pas assez d\'or' };
  if ((state.materials?.shards ?? 0) < cost.shards) return { ok: false, reason: 'Pas assez d\'éclats' };
  return { ok: true, reason: '' };
}

// Passe une commande : place (arme, casque…) et rareté minimale. Renvoie la commande ou null.
export function placeOrder(state, slot, tierId, now = Date.now(), balance = BALANCE) {
  settle(state, now);
  if (!canOrder(state, slot, tierId, balance).ok) return null;
  const b = bastionOf(state);
  const cost = orderCost(state, tierId, balance);
  state.gold -= cost.gold;
  state.materials.shards -= cost.shards;
  const order = { id: b.nextOrder, slot, tier: tierId, left: cost.ms, total: cost.ms, ready: false, item: null };
  b.nextOrder += 1;
  b.orders.push(order);
  return order;
}

// L'objet est forgé à la fin de la commande, au niveau de l'étape max du moment.
function forgeOrder(state, order, balance) {
  const t = orderTier(order.tier);
  const rng = new Rng(((state.rngSeed ?? 1) ^ Math.imul(order.id + (state.nextItemId ?? 0), 2654435761)) >>> 0);
  order.item = generateItem(state, rng, { level: levelForStage(Math.max(1, state.maxStage ?? 1), balance), minRarity: t?.minRarity ?? 'rare', slot: order.slot, weights: t?.weights ?? null }, balance);
  order.ready = true;
  order.left = 0;
}
// Livraison dans le coffre de butin (ou dans le sac si le coffre de butin est désactivé). Jamais perdue : sans place,
// la commande reste « prête » dans la file. Renvoie 'chest', 'bag' ou null.
function deliver(state, order, balance) {
  let where = null;
  if (lootBagOn(state)) {
    if (state.lootBag.length < LOOT_BAG_MAX) { state.lootBag.push(order.item); where = 'chest'; }
  } else if ((state.inventory?.length ?? 0) < balance.loot.inventorySize) { state.inventory.push(order.item); where = 'bag'; }
  if (!where) return null;
  const b = bastionOf(state);
  b.orders = b.orders.filter((o) => o !== order);
  if (state.records) state.records.itemsFound = (state.records.itemsFound ?? 0) + 1;
  return where;
}
// « Récupérer » une commande prête restée dans la file (coffre de butin plein). Renvoie { item, where } ou null.
export function collectOrder(state, orderId, now = Date.now(), balance = BALANCE) {
  const order = (bastionOf(state)?.orders ?? []).find((o) => o.id === orderId);
  if (!order) return null;
  settle(state, now, {}, balance); // forge la commande arrivée au bout, et livre celles qui ont de la place
  const delivered = order.ready && !bastionOf(state).orders.includes(order);
  return delivered ? { item: order.item, where: lootBagOn(state) ? 'chest' : 'bag' } : null;
}


// Avance tout le Bastion jusqu'à `now` (./bastion-base.js : advance), puis forge les commandes arrivées au bout et
// livre celles qui sont prêtes. Renvoie les événements : { type: 'build' | 'research' | 'order' | 'delivered', ref,
// text, away } — `away` : le joueur n'était pas là : l'événement est aussi gardé comme rappel (Carnet, Sceau).
export function settle(state, now = Date.now(), opts = {}, balance = BALANCE) {
  const b = bastionOf(state);
  if (!b) return [];
  const events = advance(state, now, opts);
  for (const order of b.orders) {
    if (order.ready || order.left > 0) continue;
    const wasAway = Boolean(order.away);
    delete order.away;
    forgeOrder(state, order, balance);
    events.push({ type: 'order', ref: order.id, text: orderLabel(order), away: wasAway });
    if (wasAway) pushNews(state, 'order', order.id, orderLabel(order), now);
  }
  // Livraison des commandes prêtes (celles qui attendaient une place dans le coffre de butin aussi).
  for (const order of [...b.orders]) {
    if (!order.ready) continue;
    const where = deliver(state, order, balance);
    if (where) events.push({ type: 'delivered', ref: order.id, text: orderLabel(order), item: order.item, where, away: false });
  }
  return events;
}

// Pas du Bastion (une fois par seconde en jeu, et au retour) : ouverture à l'étape 40, ouvriers remis d'aplomb, temps
// avancé, bâtiments qui arrivent. Renvoie les événements pour l'interface.
export function bastionTick(state, now = Date.now(), opts = {}, balance = BALANCE) {
  const opened = ensureBastion(state, now);
  const b = bastionOf(state);
  if (!b) return [];
  reconcileWorkers(state, now);
  const events = settle(state, now, opts, balance);
  if (opened) events.unshift({ type: 'opened', ref: 'forge', text: 'Le Bastion ouvre ses portes', away: false });
  return events;
}

