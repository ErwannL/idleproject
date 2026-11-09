// v9.3.3 : équipement des héros (alliés) et des familiers. Données : data/companion-gear.js.
// state.companionGear = { bag: [pièces], nextId, equipped: { unitId: { offense, guard, trinket } (ids) } }.
// Effets RÉELS (aucun bonus caché ; les auras sont seulement visuelles) :
//   campagne et World Boss : atk → attaques et compétences offensives, heal → soins, boucliers et cris, cd → recharge ;
//   Arène des compagnons : atk, hp, def (combats sans le chevalier).
import { GEAR_BAG_SIZE, GEAR_BASES, GEAR_RARITY, GEAR_RECYCLE_SHARDS, GEAR_SLOTS, GEAR_UP_COST, GEAR_UP_PCT, SLOT_NAMES, STAT_NAMES, gearClassOf } from '../data/companion-gear.js';
import { COMPANIONS } from '../data/companions.js';

const unitById = (id) => COMPANIONS.find((c) => c.id === id);
export const CD_CAP = 30; // réduction de recharge maximale (%)

export function gearState(state) {
  state.companionGear ??= { bag: [], nextId: 1, equipped: {} };
  return state.companionGear;
}
export const gearBase = (item) => GEAR_BASES.find((b) => b.id === item?.baseId);

// Statistiques d'une pièce (rareté × amélioration).
export function gearStats(item) {
  const base = gearBase(item);
  if (!base) return {};
  const k = (GEAR_RARITY[item.rarity]?.mult ?? 1) * (1 + GEAR_UP_PCT / 100 * (item.up ?? 0));
  return Object.fromEntries(Object.entries(base.stats).map(([s, v]) => [s, Math.round(v * k * 10) / 10]));
}
export function unitGear(state, unitId) {
  const g = gearState(state);
  const slots = g.equipped[unitId] ?? {};
  return Object.fromEntries(GEAR_SLOTS.map((s) => [s, g.bag.find((i) => i.id === slots[s]) ?? null]));
}
// Total des statistiques portées par une unité (somme des pièces, réduction de recharge plafonnée).
export function unitGearStats(state, unitId) {
  const out = { atk: 0, hp: 0, def: 0, heal: 0, cd: 0 };
  if (!state.companionGear) return out;
  for (const item of Object.values(unitGear(state, unitId))) for (const [s, v] of Object.entries(gearStats(item))) out[s] += v;
  out.cd = Math.min(CD_CAP, out.cd);
  return out;
}

// Compatibilité : définie par la base (classes) ; raison lisible si refus.
export function canEquip(state, unitId, item) {
  const unit = unitById(unitId);
  const base = gearBase(item);
  if (!unit || !base) return { ok: false, reason: 'Pièce inconnue.' };
  if (!state.companions.owned[unitId]) return { ok: false, reason: `${unit.name} n'est pas encore obtenu.` };
  const cls = gearClassOf(unit);
  if (!base.classes.includes(cls)) {
    const names = { attacker: 'Attaquants', defender: 'Défenseurs', support: 'Soutiens', beast: 'Familiers' };
    return { ok: false, reason: `Réservé aux ${base.classes.map((c) => names[c]).join(', ')} (${unit.name} : ${names[cls].slice(0, -1).toLowerCase()}).` };
  }
  return { ok: true, reason: '' };
}
export function equipGear(state, unitId, itemId) {
  const g = gearState(state);
  const item = g.bag.find((i) => i.id === itemId);
  if (!item || !canEquip(state, unitId, item).ok) return false;
  const base = gearBase(item);
  // Une pièce ne se porte que par une unité : retirée de son ancien porteur.
  for (const slots of Object.values(g.equipped)) for (const s of GEAR_SLOTS) if (slots[s] === itemId) delete slots[s];
  (g.equipped[unitId] ??= {})[base.slot] = itemId;
  return true;
}
export function unequipGear(state, unitId, slot) {
  const slots = gearState(state).equipped[unitId];
  if (!slots?.[slot]) return false;
  delete slots[slot];
  return true;
}
export const isWorn = (state, itemId) => Object.values(gearState(state).equipped).some((s) => GEAR_SLOTS.some((k) => s[k] === itemId));
export function wearerOf(state, itemId) {
  return Object.entries(gearState(state).equipped).find(([, s]) => GEAR_SLOTS.some((k) => s[k] === itemId))?.[0] ?? null;
}

// Butin : pièce au hasard (rareté pondérée, `minRarity` facultatif), classe ciblée facultative.
export function rollGear(state, rng, { cls = null, minRarity = 'common' } = {}) {
  const g = gearState(state);
  if (g.bag.length >= GEAR_BAG_SIZE) return null;
  const order = Object.keys(GEAR_RARITY);
  const pool = Object.entries(GEAR_RARITY).filter(([r]) => order.indexOf(r) >= order.indexOf(minRarity));
  const total = pool.reduce((a, [, v]) => a + v.weight, 0);
  let x = rng.next() * total, rarity = pool[0][0];
  for (const [r, v] of pool) { x -= v.weight; if (x <= 0) { rarity = r; break; } }
  const bases = GEAR_BASES.filter((b) => !cls || b.classes.includes(cls));
  const base = bases[Math.floor(rng.next() * bases.length)];
  const item = { id: g.nextId++, baseId: base.id, rarity, up: 0 };
  g.bag.push(item);
  return item;
}

export function gearUpgradeCost(item, killGold) {
  const r = GEAR_RARITY[item.rarity];
  if (!r || (item.up ?? 0) >= r.maxUp) return null;
  const f = GEAR_UP_COST.rarity[item.rarity] ?? 1, n = item.up ?? 0;
  return { shards: Math.ceil(GEAR_UP_COST.shards * f * GEAR_UP_COST.shardsGrowth ** n), gold: Math.ceil(GEAR_UP_COST.kills * f * GEAR_UP_COST.killsGrowth ** n * killGold) };
}
export function upgradeGear(state, itemId, killGold) {
  const item = gearState(state).bag.find((i) => i.id === itemId);
  const cost = item && gearUpgradeCost(item, killGold);
  if (!cost || state.gold < cost.gold || state.materials.shards < cost.shards) return null;
  state.gold -= cost.gold;
  state.materials.shards -= cost.shards;
  item.up = (item.up ?? 0) + 1;
  return item.up;
}
export function recycleGear(state, itemId) {
  const g = gearState(state);
  const item = g.bag.find((i) => i.id === itemId);
  if (!item || isWorn(state, itemId) || item.locked) return 0;
  g.bag = g.bag.filter((i) => i !== item);
  const shards = GEAR_RECYCLE_SHARDS[item.rarity] ?? 1;
  state.materials.shards += shards;
  return shards;
}

export const slotName = (unit, slot) => SLOT_NAMES[gearClassOf(unit)][slot];
export function statText(stats) {
  return Object.entries(stats).filter(([, v]) => v).map(([k, v]) => `${k === 'cd' ? '−' : '+'}${v} % ${STAT_NAMES[k]}`).join(', ');
}

export function sanitizeCompanionGear(state, raw) {
  const g = raw?.companionGear;
  if (!g || typeof g !== 'object') { state.companionGear = null; return; }
  const int = (v, d = 0) => (Number.isInteger(v) && v >= 0 ? v : d);
  const bag = (Array.isArray(g.bag) ? g.bag : []).slice(0, GEAR_BAG_SIZE)
    .filter((i) => i && Number.isInteger(i.id) && GEAR_BASES.some((b) => b.id === i.baseId) && GEAR_RARITY[i.rarity])
    .map((i) => ({ id: i.id, baseId: i.baseId, rarity: i.rarity, up: Math.min(int(i.up), GEAR_RARITY[i.rarity].maxUp), ...(i.locked ? { locked: true } : {}) }));
  const ids = new Set(bag.map((i) => i.id));
  const equipped = {};
  for (const [unit, slots] of Object.entries(g.equipped && typeof g.equipped === 'object' ? g.equipped : {})) {
    if (!unitById(unit) || !slots || typeof slots !== 'object') continue;
    for (const s of GEAR_SLOTS) {
      const id = slots[s];
      const item = bag.find((i) => i.id === id);
      if (ids.has(id) && gearBase(item)?.slot === s && gearBase(item).classes.includes(gearClassOf(unitById(unit)))) (equipped[unit] ??= {})[s] = id;
    }
  }
  state.companionGear = { bag, nextId: Math.max(int(g.nextId, 1), ...bag.map((i) => i.id + 1), 1), equipped };
}
