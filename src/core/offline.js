// Gains hors ligne.
// Le rythme de farm est mesuré en faisant tourner la vraie simulation de combat
// (sans rendu) sur une copie de la partie : les gains hors ligne suivent donc
// exactement les mêmes règles que le farm actif, sans simuler des heures d'animation.
import { BALANCE } from '../data/balance.js';
import { createCombat, step } from './combat.js';
import { addGold } from './economy.js';
import { trackContracts } from './contracts.js';
import { addToInventory } from './inventory.js';
import { addXp } from './level.js';
import { generateItem, recycleValue } from './loot.js';
import { Rng } from './rng.js';

export function measureFarmRate(state, balance = BALANCE, seconds = balance.offline.measureSeconds) {
  const clone = structuredClone(state);
  clone.autoAdvance = false; // hors ligne : on farme l'étape atteinte, sans progresser
  clone.dungeon = null; // un donjon en cours est mis en pause : on mesure le farm de campagne
  clone.inventory = [];
  const world = createCombat(clone, balance);
  world.recordEvents = false;
  const rng = new Rng(state.rngSeed ^ 0x5bd1e995);
  const dt = balance.simulation.tickSeconds;
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i++) step(clone, world, dt, rng, balance);
  return {
    goldPerSecond: world.counters.gold / seconds,
    killsPerSecond: world.counters.kills / seconds,
    dropsPerSecond: world.counters.drops / seconds,
    xpPerSecond: world.counters.xp / seconds,
    stage: clone.stage,
  };
}

// fromMs / nowMs : horodatages en millisecondes (Date.now()).
export function computeOfflineRewards(state, fromMs, nowMs, rng, balance = BALANCE) {
  const elapsed = (nowMs - fromMs) / 1000;
  const result = {
    elapsedSeconds: 0,
    countedSeconds: 0,
    capped: false,
    clockSuspicious: false,
    gold: 0,
    kills: 0,
    items: [],
    excessDrops: 0,
    excessGold: 0,
    xp: 0,
    stage: state.stage,
  };
  if (!Number.isFinite(elapsed) || !(fromMs > 0)) return result;
  if (elapsed < 0) return { ...result, clockSuspicious: true };

  const cap = balance.offline.capHours * 3600;
  const counted = Math.min(elapsed, cap);
  const rate = measureFarmRate(state, balance);
  const factor = counted * balance.offline.farmMultiplier;

  const dropCount = Math.floor(rate.dropsPerSecond * factor);
  const itemCount = Math.min(dropCount, balance.offline.maxItems);
  const items = [];
  for (let i = 0; i < itemCount; i++) items.push(generateItem(state, rng, { level: rate.stage }, balance));
  const excessDrops = dropCount - itemCount;
  const excessGold = excessDrops * recycleValue({ rarity: 'common', level: rate.stage }, balance);

  return {
    ...result,
    elapsedSeconds: elapsed,
    countedSeconds: counted,
    capped: elapsed > cap,
    gold: Math.floor(rate.goldPerSecond * factor),
    kills: Math.floor(rate.killsPerSecond * factor),
    xp: Math.floor(rate.xpPerSecond * factor),
    items,
    excessDrops,
    excessGold,
    stage: rate.stage,
  };
}

export function applyOfflineRewards(state, rewards, balance = BALANCE) {
  const gold = addGold(state, rewards.gold + rewards.excessGold);
  state.records.kills += rewards.kills;
  const levelsGained = addXp(state, rewards.xp);
  trackContracts(state, 'kills', rewards.kills);
  trackContracts(state, 'gold', gold);
  let autoRecycledGold = 0;
  let autoRecycledCount = 0;
  for (const item of rewards.items) {
    const result = addToInventory(state, item, balance);
    if (!result.added) {
      autoRecycledGold += result.recycledGold;
      autoRecycledCount += 1;
    }
  }
  state.records.itemsFound += rewards.excessDrops;
  return { ...rewards, totalGold: gold + autoRecycledGold, autoRecycledGold, autoRecycledCount, levelsGained };
}
