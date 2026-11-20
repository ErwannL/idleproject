// v9.3.4 (f) : équipement unique. Les compagnons (héros alliés et familiers) portent les MÊMES objets que le
// chevalier : ceux du sac (state.inventory), selon leur classe (Attaquant, Défenseur, Soutien, Familier).
// state.companionGear = { equipped: { unitId: { weapon, armor, accessory } } } : objets portés (sortis du sac, comme
// l'équipement du chevalier). Un objet porté par un compagnon lui donne les bonus de son profil de classe (data/
// companion-gear.js, en %) × la rareté × (1 + 8 % par amélioration). Effets RÉELS :
//   campagne et World Boss : atk → attaques et compétences offensives, heal → soins, boucliers et cris, cd → recharge ;
//   Arène des compagnons : atk, hp, def (combats sans le chevalier).
import { GEAR_CLASSES, GEAR_BASES, GEAR_RARITY, GEAR_SLOTS, GEAR_UP_COST, GEAR_UP_PCT, SLOT_NAMES, STAT_NAMES, gearClassOf } from '../data/companion-gear.js';
import { COMPANIONS } from '../data/companions.js';
import { EQUIP_SLOTS, eqSlot } from '../data/items.js';
import { BALANCE } from '../data/balance.js';
import { itemClass } from './classes.js';
import { formatDecimal } from './format.js'; // v10.3 (8) : virgule décimale (« +55,2 % Attaque »)

const unitById = (id) => COMPANIONS.find((c) => c.id === id);
export const CD_CAP = 30; // réduction de recharge maximale (%)
// Place commune → ancien emplacement des compagnons (profils de data/companion-gear.js).
export const TO_GEAR_SLOT = { weapon: 'offense', armor: 'guard', accessory: 'trinket' };
export const FROM_GEAR_SLOT = { offense: 'weapon', guard: 'armor', trinket: 'accessory' };
// Profil par défaut d'une classe pour chaque place (les pièces converties de 9.3.3 gardent le leur : `cg`).
const PROFILE = {
  attacker: { offense: 'runeblade', guard: 'leather', trinket: 'ring' },
  defender: { offense: 'runeblade', guard: 'plate', trinket: 'emblem' },
  support: { offense: 'focus', guard: 'robe', trinket: 'talisman' },
  beast: { offense: 'fangs', guard: 'collar', trinket: 'rune' },
};

export function gearState(state) {
  state.companionGear ??= { equipped: {} };
  state.companionGear.equipped ??= {};
  return state.companionGear;
}
// Profil de bonus d'un objet porté par un compagnon (classe de l'objet, place).
export function gearBase(item, state = null) {
  if (!item) return null;
  if (item.cg) return GEAR_BASES.find((b) => b.id === item.cg) ?? null;
  const cls = state ? itemClass(state, item) : (item.cls ?? 'attacker');
  return GEAR_BASES.find((b) => b.id === PROFILE[cls]?.[TO_GEAR_SLOT[eqSlot(item)]]) ?? null;
}
const ups = (item) => item?.upgrades ?? item?.up ?? 0;

// Statistiques d'une pièce pour un compagnon (rareté × amélioration).
export function gearStats(item, state = null) {
  const base = gearBase(item, state);
  if (!base) return {};
  const k = (GEAR_RARITY[item.rarity]?.mult ?? 1) * (1 + GEAR_UP_PCT / 100 * ups(item));
  return Object.fromEntries(Object.entries(base.stats).map(([s, v]) => [s, Math.round(v * k * 10) / 10]));
}
// Objets portés par un compagnon, par place commune (weapon, armor, accessory).
export function unitGear(state, unitId) {
  const slots = state.companionGear?.equipped?.[unitId] ?? {};
  return Object.fromEntries(Object.keys(EQUIP_SLOTS).map((s) => [s, slots[s] ?? null]));
}
// Total des statistiques portées par une unité (somme des pièces, réduction de recharge plafonnée).
export function unitGearStats(state, unitId) {
  const out = { atk: 0, hp: 0, def: 0, heal: 0, cd: 0 };
  if (!state.companionGear) return out;
  for (const item of Object.values(unitGear(state, unitId))) for (const [s, v] of Object.entries(gearStats(item, state))) out[s] += v;
  out.cd = Math.min(CD_CAP, out.cd);
  return out;
}

const CLASS_NAMES = { attacker: 'Attaquant', defender: 'Défenseur', support: 'Soutien', beast: 'Familier' };
export const classLabel = (cls) => CLASS_NAMES[cls] ?? '';
// Compatibilité : la classe de l'objet doit être celle de l'unité ; raison lisible si refus.
export function canEquip(state, unitId, item) {
  const unit = unitById(unitId);
  if (!unit || !item) return { ok: false, reason: 'Objet inconnu.' };
  if (!state.companions.owned[unitId]) return { ok: false, reason: `${unit.name} n'est pas encore obtenu.` };
  const cls = gearClassOf(unit);
  if (GEAR_CLASSES[cls]?.noGear) return { ok: false, reason: 'Les familiers ne portent pas d\'équipement.' }; // v9.3.8
  const ic = itemClass(state, item);
  if (ic !== cls) return { ok: false, reason: `Pour : ${CLASS_NAMES[ic]}` };
  return { ok: true, reason: '' };
}
// Équipe un objet du sac ; l'ancien retourne au sac.
export function equipGear(state, unitId, itemId) {
  const item = state.inventory.find((i) => i.id === itemId);
  if (!item || !canEquip(state, unitId, item).ok) return false;
  const slot = eqSlot(item);
  const g = gearState(state);
  const slots = (g.equipped[unitId] ??= {});
  state.inventory = state.inventory.filter((i) => i !== item);
  if (slots[slot]) state.inventory.push(slots[slot]);
  slots[slot] = item;
  return true;
}
// v9.8 (I6) : « Équiper le meilleur » pour un compagnon — par place, l'objet du sac compatible le plus fort (somme des
// statistiques pondérées) s'il dépasse la pièce portée. Renvoie le nombre de pièces changées.
export const gearScore = (state, item) => { const st = gearStats(item, state); return (st.atk ?? 0) + (st.hp ?? 0) * 0.5 + (st.def ?? 0) * 0.5 + (st.heal ?? 0) + (st.cd ?? 0) * 2; };
export function bestGearFor(state, unitId) {
  const worn = unitGear(state, unitId);
  const out = [];
  for (const slot of Object.keys(EQUIP_SLOTS)) {
    // v9.10 (5) : sac et coffre ; un objet protégé (« Protéger ») reste équipable.
    const cands = [...state.inventory, ...(state.stash ?? [])].filter((i) => eqSlot(i) === slot && !wearerOf(state, i.id) && canEquip(state, unitId, i).ok);
    const best = cands.sort((a, b) => gearScore(state, b) - gearScore(state, a))[0];
    if (best && gearScore(state, best) > (worn[slot] ? gearScore(state, worn[slot]) : 0)) out.push(best.id);
  }
  return out;
}
export function equipBestGear(state, unitId) {
  let n = 0;
  for (const id of bestGearFor(state, unitId)) {
    const si = (state.stash ?? []).findIndex((i) => i.id === id);
    if (si >= 0) state.inventory.push(state.stash.splice(si, 1)[0]); // sorti du coffre (l'ancien retourne au sac)
    if (equipGear(state, unitId, id)) n += 1;
  }
  return n;
}
// v9.10 (5) : « Équiper toute l'équipe » — chaque compagnon de l'équipe prend ses meilleures pièces.
export function equipBestAllGear(state) {
  let n = 0;
  for (const id of state.companions?.equipped ?? []) n += equipBestGear(state, id);
  return n;
}
export const gearWaiting = (state, unitId) => Boolean(state.companions?.owned?.[unitId]) && bestGearFor(state, unitId).length > 0;
// Retire un objet (place commune ou ancien nom d'emplacement) : retour au sac, même plein (jamais perdu).
export function unequipGear(state, unitId, slot) {
  const s = FROM_GEAR_SLOT[slot] ?? slot;
  const slots = gearState(state).equipped[unitId];
  const item = slots?.[s];
  if (!item) return false;
  delete slots[s];
  state.inventory.push(item);
  return true;
}
export const isWorn = (state, itemId) => Boolean(wearerOf(state, itemId));
export function wearerOf(state, itemId) {
  for (const [unit, slots] of Object.entries(state.companionGear?.equipped ?? {})) if (Object.values(slots).some((i) => i?.id === itemId)) return unit;
  return null;
}
// Tous les objets portés par les compagnons (identifiants, sauvegarde).
export const wornItems = (state) => Object.values(state.companionGear?.equipped ?? {}).flatMap((s) => Object.values(s)).filter(Boolean);

// Butin : un objet commun (même génération que celui des monstres), d'une classe de l'équipe sauf `cls` imposée.
// Générateur branché par core/inventory.js (évite un cycle loot → classes → companion-gear).
let gen = null;
export function setGearGenerator(fn) { gen = fn; }
export function rollGear(state, rng, { cls = null, minRarity = 'common' } = {}) {
  if (!gen) return null;
  const item = gen(state, rng, { minRarity });
  if (!item) return null;
  if (cls) item.cls = cls;
  return item;
}

export function gearUpgradeCost(item, killGold) {
  const r = GEAR_RARITY[item.rarity];
  if (!r || ups(item) >= r.maxUp) return null;
  const f = GEAR_UP_COST.rarity[item.rarity] ?? 1, n = ups(item);
  return { shards: Math.ceil(GEAR_UP_COST.shards * f * GEAR_UP_COST.shardsGrowth ** n), gold: Math.ceil(GEAR_UP_COST.kills * f * GEAR_UP_COST.killsGrowth ** n * killGold) };
}
const findAny = (state, itemId) => state.inventory.find((i) => i.id === itemId) ?? wornItems(state).find((i) => i.id === itemId);
export function upgradeGear(state, itemId, killGold) {
  const item = findAny(state, itemId);
  const cost = item && gearUpgradeCost(item, killGold);
  if (!cost || state.gold < cost.gold || state.materials.shards < cost.shards) return null;
  state.gold -= cost.gold;
  state.materials.shards -= cost.shards;
  item.upgrades = ups(item) + 1;
  return item.upgrades;
}
// Recyclage depuis la fiche d'un compagnon : objet du sac seulement (jamais un objet porté ou verrouillé).
export function recycleGear(state, itemId) {
  const item = state.inventory.find((i) => i.id === itemId);
  if (!item || item.locked) return 0;
  state.inventory = state.inventory.filter((i) => i !== item);
  const shards = BALANCE.materials.shards[item.rarity] ?? 1;
  state.materials.shards += shards;
  return shards;
}

export const slotName = (unit, slot) => SLOT_NAMES[gearClassOf(unit)][TO_GEAR_SLOT[slot] ?? slot];
export function statText(stats) {
  return Object.entries(stats).filter(([, v]) => v).map(([k, v]) => `${k === 'cd' ? '−' : '+'}${formatDecimal(v)} % ${STAT_NAMES[k]}`).join(', ');
}
// v10.3 (8) : aperçu du renforcement d'une pièce pour un compagnon (leur règle : +8 % des bonus par niveau).
// { level, max, atMax, cost, canPay, lack: { gold, shards }, rows: [{ key, before, after }] } — mêmes champs que
// l'aperçu du héros (core/forge.js upgradePreview), pour une seule section « Renforcer » à l'écran.
export function gearUpgradePreview(state, item, killGold) {
  const level = ups(item);
  const max = GEAR_RARITY[item?.rarity]?.maxUp ?? 0;
  const cost = item ? gearUpgradeCost(item, killGold) : null;
  if (!cost) return { level, max, atMax: true, cost: null, canPay: false, lack: null, rows: [] };
  const before = gearStats(item, state);
  const after = gearStats({ ...item, upgrades: level + 1 }, state);
  const lack = { gold: Math.max(0, Math.ceil(cost.gold - state.gold)), shards: Math.max(0, cost.shards - state.materials.shards) };
  return { level, max, atMax: false, cost, canPay: !lack.gold && !lack.shards, lack, rows: Object.keys(before).map((k) => ({ key: k, before: before[k], after: after[k] })) };
}
// Total des bonus d'un compagnon si les objets `ids` (sac ou Réserve) remplaçaient ses pièces (Équipement rapide).
export function gearStatsWith(state, unitId, ids) {
  const worn = { ...unitGear(state, unitId) };
  for (const id of ids) { const it = [...state.inventory, ...(state.stash ?? [])].find((i) => i.id === id); if (it) worn[eqSlot(it)] = it; }
  const out = { atk: 0, hp: 0, def: 0, heal: 0, cd: 0 };
  for (const item of Object.values(worn)) for (const [s, v] of Object.entries(gearStats(item, state))) out[s] += v;
  out.cd = Math.min(CD_CAP, out.cd);
  return out;
}
export { GEAR_SLOTS };

// Relecture : nouveau format { equipped: { unit: { weapon, armor, accessory } } } (objets complets, nettoyés par
// `clean`) ; l'ancien format 9.3.3 ({ bag, equipped: ids }) est converti par migrateCompanionGear (state.js).
export function sanitizeCompanionGear(state, raw, { isValid = () => false, clean = (x) => x } = {}) {
  const g = raw?.companionGear;
  state.companionGear = { equipped: {} };
  if (!g || typeof g !== 'object' || Array.isArray(g.bag)) return;
  for (const [unit, slots] of Object.entries(g.equipped && typeof g.equipped === 'object' ? g.equipped : {})) {
    const u = unitById(unit);
    if (!u || !slots || typeof slots !== 'object') continue;
    for (const s of Object.keys(EQUIP_SLOTS)) {
      const it = slots[s];
      if (!isValid(it) || eqSlot(it) !== s) continue;
      const item = clean(it);
      if (u.kind === 'ally' && itemClass(state, item) === gearClassOf(u)) (state.companionGear.equipped[unit] ??= {})[s] = item;
      else state.inventory.push(item); // classe devenue incompatible : rendu au sac
    }
  }
}
