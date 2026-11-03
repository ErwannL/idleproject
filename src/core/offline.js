// Gains hors ligne.
// Le rythme de farm est mesuré en faisant tourner la vraie simulation de combat
// (sans rendu) sur une copie de la partie : les gains hors ligne suivent donc
// exactement les mêmes règles que le farm actif, sans simuler des heures d'animation.
import { BALANCE } from '../data/balance.js';
import { createCombat, isBossStage, step, zoneIndexForStage } from './combat.js';
import { addGold } from './economy.js';
import { trackContracts } from './contracts.js';
import { collectItem } from './inventory.js';
import { addXp } from './level.js';
import { generateItem, recycleValue } from './loot.js';
import { Rng } from './rng.js';
import { endWorldRun } from './banner.js';

function measureAt(state, stage, balance, seconds) {
  const clone = structuredClone(state);
  clone.autoAdvance = false; // hors ligne : on farme l'étape, sans progresser
  clone.dungeon = null; // donjon ou tour en cours : mis en pause, on mesure le farm de campagne
  clone.tower = null;
  clone.challenge = null;
  endWorldRun(clone, 'left'); // v9.1.3 (doc4 lot 6) : mode monde neutralisé (équipe d'avant l'essai, sans essai gratuit)
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
    damageShare: damageShare(world.counters.damage),
  };
}

// v9.1.3 (S3) : part des dégâts directs par unité (héros, compagnons), triée, en fractions de 0 à 1. Un soutien
// (soin, bouclier, or) n'y figure pas : il ne frappe pas directement.
export function damageShare(damage = {}) {
  const total = Object.values(damage).reduce((a, b) => a + b, 0);
  if (!(total > 0)) return [];
  return Object.entries(damage).map(([id, v]) => ({ id, share: v / total })).sort((a, b) => b.share - a.share);
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
    gems: 0,
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
  // v9.1.3 (doc3, décision) : le butin hors ligne donne aussi des pièces d'ensemble du monde farmé, comme le combat.
  const setZone = zoneIndexForStage(rate.stage);
  for (let i = 0; i < itemCount; i++) items.push(generateItem(state, rng, { level: rate.stage, setZone, weights: balance.loot.dropRarityWeights }, balance));
  const excessDrops = dropCount - itemCount;
  // v9.1.9 : surplus compté comme avant la baisse du butin (÷ dropScale) : l'or hors ligne ne baisse pas.
  const excessGold = (excessDrops / (balance.loot.dropScale ?? 1)) * recycleValue({ rarity: 'common', level: rate.stage }, balance);

  return {
    ...result,
    elapsedSeconds: elapsed,
    countedSeconds: counted,
    capped: elapsed > cap,
    gold: Math.floor(rate.goldPerSecond * factor),
    kills: Math.floor(rate.killsPerSecond * factor),
    // Étape 4 : une part des gemmes de kill aussi hors ligne (avant : aucune).
    gems: Math.floor(rate.killsPerSecond * factor * balance.gems.killChance
      * ((balance.gems.killAmount[0] + balance.gems.killAmount[1]) / 2) * (balance.offline.gemShare ?? 0)),
    xp: Math.floor(rate.xpPerSecond * factor),
    items,
    excessDrops,
    excessGold,
    stage: rate.stage,
    paused: rate.paused,
  };
}

export function applyOfflineRewards(state, rewards, balance = BALANCE) {
  const before = { shards: state.materials.shards };
  const gold = addGold(state, rewards.gold + rewards.excessGold);
  state.records.kills += rewards.kills;
  if (state.times) state.times.offline += Math.max(0, rewards.elapsedSeconds ?? 0);
  state.gems += rewards.gems ?? 0;
  const levelsGained = addXp(state, rewards.xp);
  trackContracts(state, 'kills', rewards.kills);
  trackContracts(state, 'gold', gold);
  let autoRecycledGold = 0;
  let autoRecycledCount = 0;
  for (const item of rewards.items) {
    const result = collectItem(state, item, balance);
    if (result.recycled) { // v9.1.3 : un objet rangé au coffre ou au Musée n'est pas « recyclé »
      autoRecycledGold += result.recycledGold;
      autoRecycledCount += 1;
    }
  }
  state.records.itemsFound += rewards.excessDrops;
  const materials = { shards: state.materials.shards - before.shards };
  return { ...rewards, totalGold: gold + autoRecycledGold, autoRecycledGold, autoRecycledCount, levelsGained, materials };
}
