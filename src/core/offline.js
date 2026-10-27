// Gains hors ligne.
// Le rythme de farm est mesuré en faisant tourner la vraie simulation de combat
// (sans rendu) sur une copie de la partie : les gains hors ligne suivent donc
// exactement les mêmes règles que le farm actif, sans simuler des heures d'animation.
import { BALANCE } from '../data/balance.js';
import { createCombat, isBossStage, step } from './combat.js';
import { addGold } from './economy.js';
import { trackContracts } from './contracts.js';
import { collectItem } from './inventory.js';
import { addXp } from './level.js';
import { generateItem, recycleValue } from './loot.js';
import { Rng } from './rng.js';

function measureAt(state, stage, balance, seconds) {
  const clone = structuredClone(state);
  clone.autoAdvance = false; // hors ligne : on farme l'étape, sans progresser
  clone.dungeon = null; // donjon ou tour en cours : mis en pause, on mesure le farm de campagne
  clone.tower = null;
  clone.challenge = null;
  clone.inventory = [];
  clone.stage = stage;
  if (isBossStage(stage, balance)) clone.stage = Math.max(1, stage - 1); // jamais de boss hors ligne
  const start = clone.stage;
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
    stage: start,
    died: clone.stage < start,
  };
}

// v8.4 : on farme la meilleure étape VRAIMENT farmable (avant : l'étape actuelle, même si le héros
// n'y tuait rien — par ex. après une ascension de la Tour → « +0 » partout).
export function measureFarmRate(state, balance = BALANCE, seconds = balance.offline.measureSeconds) {
  let stage = state.stage;
  let rate = measureAt(state, stage, balance, seconds);
  for (let tries = 0; tries < 8 && (rate.died || rate.killsPerSecond <= 0) && stage > 1; tries++) {
    stage = Math.max(1, Math.min(rate.stage - 1, stage - Math.max(1, Math.round(stage * 0.08 * (tries + 1)))));
    rate = measureAt(state, stage, balance, Math.min(seconds, 60)); // v8.5 : essais suivants plus courts (chargement plus rapide)
  }
  return { ...rate, paused: state.tower ? 'tower' : state.dungeon ? 'dungeon' : state.challenge ? 'challenge' : null };
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
    paused: rate.paused,
  };
}

export function applyOfflineRewards(state, rewards, balance = BALANCE) {
  const before = { shards: state.materials.shards, essence: state.materials.essence };
  const gold = addGold(state, rewards.gold + rewards.excessGold);
  state.records.kills += rewards.kills;
  const levelsGained = addXp(state, rewards.xp);
  trackContracts(state, 'kills', rewards.kills);
  trackContracts(state, 'gold', gold);
  let autoRecycledGold = 0;
  let autoRecycledCount = 0;
  for (const item of rewards.items) {
    const result = collectItem(state, item, balance);
    if (!result.added) {
      autoRecycledGold += result.recycledGold;
      autoRecycledCount += 1;
    }
  }
  state.records.itemsFound += rewards.excessDrops;
  const materials = { shards: state.materials.shards - before.shards, essence: state.materials.essence - before.essence };
  return { ...rewards, totalGold: gold + autoRecycledGold, autoRecycledGold, autoRecycledCount, levelsGained, materials };
}
