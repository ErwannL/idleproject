// Pouvoirs ancestraux : déblocage à la première victoire, relance contre de l'or,
// choix explicite entre l'ancien et le nouveau, emplacements actifs limités.
// Le pouvoir actuel n'est jamais remplacé sans l'accord du joueur.
import { BALANCE } from '../data/balance.js';
import { BOSSES } from '../data/enemies.js';
import { RARITIES } from '../data/items.js';
import { BOSS_POWERS, POWER_RULES } from '../data/powers.js';
import { ZONES } from '../data/zones.js';
import { enemyStats } from './combat.js';
import { rarityIndex } from './loot.js';
import { talentEffects } from './rebirth.js';

export function powerById(id) {
  for (const [bossId, list] of Object.entries(BOSS_POWERS)) {
    const power = list.find((p) => p.id === id);
    if (power) return { ...power, bossId };
  }
  return null;
}

// Première étape où le boss apparaît (pour le coût de relance et le Codex).
export function bossFirstStage(bossId, balance = BALANCE) {
  const zone = ZONES.findIndex((z) => z.bosses.includes(bossId));
  return zone * balance.stages.stagesPerZone + balance.stages.bossEvery;
}

// Boss dans l'ordre de la campagne.
export function bossesInOrder(balance = BALANCE) {
  return Object.keys(BOSSES).sort((a, b) => bossFirstStage(a, balance) - bossFirstStage(b, balance));
}

// Probabilité de chaque pouvoir au prochain tirage :
// rareté tirée selon les poids (parmi celles disponibles), puis pouvoir uniforme dans la rareté.
export function powerProbabilities(bossId, { excludeId = null, minRarity = 'common' } = {}) {
  const min = rarityIndex(minRarity);
  const pool = BOSS_POWERS[bossId].filter((p) => p.id !== excludeId && rarityIndex(p.rarity) >= min);
  const byRarity = new Map();
  for (const p of pool) byRarity.set(p.rarity, [...(byRarity.get(p.rarity) ?? []), p]);
  const total = [...byRarity.keys()].reduce((s, r) => s + POWER_RULES.rarityWeights[r], 0);
  return pool.map((p) => ({
    power: p,
    chance: POWER_RULES.rarityWeights[p.rarity] / total / byRarity.get(p.rarity).length,
  }));
}

export function rollPower(bossId, rng, options = {}) {
  let roll = rng.next();
  const table = powerProbabilities(bossId, options);
  for (const { power, chance } of table) {
    roll -= chance;
    if (roll < 0) return power.id;
  }
  return table[table.length - 1].power.id;
}

export function powerSlots(state) {
  return POWER_RULES.baseSlots + (talentEffects(state).powerSlots ?? 0);
}

export function activePowers(state) {
  return state.equippedPowers.map((bossId) => state.powers[bossId]?.current).filter(Boolean).map(powerById);
}

// Appelé à chaque victoire contre un boss. Renvoie le pouvoir débloqué lors de la première.
export function recordBossVictory(state, bossId, rng) {
  let entry = state.powers[bossId];
  if (entry) {
    entry.victories += 1;
    return null;
  }
  entry = { current: rollPower(bossId, rng), pending: null, victories: 1, rerolls: 0, sinceHigh: 0 };
  state.powers[bossId] = entry;
  if (state.equippedPowers.length < powerSlots(state)) state.equippedPowers.push(bossId);
  return powerById(entry.current);
}

export function rerollCost(state, bossId, balance = BALANCE) {
  const entry = state.powers[bossId];
  const base = enemyStats(bossFirstStage(bossId, balance), bossId, true, balance).gold * POWER_RULES.rerollCostBossGold;
  const discount = (talentEffects(state).rerollDiscountPct ?? 0) / 100;
  return Math.max(1, Math.floor(base * POWER_RULES.rerollCostGrowth ** (entry?.rerolls ?? 0) * (1 - discount)));
}

// Relances restantes avant la garantie de rareté.
export function pityRemaining(state, bossId) {
  const entry = state.powers[bossId];
  return Math.max(0, POWER_RULES.pity.after - (entry?.sinceHigh ?? 0));
}

// Dépense l'or et crée une proposition. Le pouvoir actuel reste en place.
export function rerollPower(state, bossId, rng, balance = BALANCE) {
  const entry = state.powers[bossId];
  if (!entry || entry.pending) return null;
  const cost = rerollCost(state, bossId, balance);
  if (state.gold < cost) return null;
  state.gold -= cost;
  const guaranteed = pityRemaining(state, bossId) === 0;
  const minRarity = guaranteed ? POWER_RULES.pity.minRarity : 'common';
  entry.pending = rollPower(bossId, rng, { excludeId: entry.current, minRarity });
  entry.rerolls += 1;
  const high = rarityIndex(powerById(entry.pending).rarity) >= rarityIndex(POWER_RULES.pity.minRarity);
  entry.sinceHigh = high ? 0 : entry.sinceHigh + 1;
  return { pending: powerById(entry.pending), cost, guaranteed };
}

// accept = true : le nouveau remplace l'actuel ; false : on garde l'actuel.
export function resolveReroll(state, bossId, accept) {
  const entry = state.powers[bossId];
  if (!entry?.pending) return false;
  if (accept) entry.current = entry.pending;
  entry.pending = null;
  return true;
}

export function setPowerActive(state, bossId, active) {
  if (!state.powers[bossId]) return false;
  const index = state.equippedPowers.indexOf(bossId);
  if (!active) {
    if (index >= 0) state.equippedPowers.splice(index, 1);
    return true;
  }
  if (index >= 0) return true;
  if (state.equippedPowers.length >= powerSlots(state)) return false;
  state.equippedPowers.push(bossId);
  return true;
}

export function powerRarity(power) {
  return RARITIES.find((r) => r.id === power.rarity);
}
