// Forge : fabrication ciblée (choix de l'emplacement), relance des effets spéciaux,
// réaffûtage d'un objet au niveau de l'étape maximale.
import { BALANCE } from '../data/balance.js';
import { referenceKillGold } from './combat.js';
import { addToInventory } from './inventory.js';
import { generateItem, itemBase, rarityIndex, refreshItemStats, rerollAffixes } from './loot.js';

export function craftCost(state, balance = BALANCE) {
  const f = balance.forge;
  return { gold: Math.floor(f.craftGoldKills * referenceKillGold(state.maxStage, balance)), shards: f.craftShards };
}

export function craftItem(state, slot, rng, balance = BALANCE) {
  const cost = craftCost(state, balance);
  if (state.gold < cost.gold || state.materials.shards < cost.shards) return null;
  if (state.inventory.length >= balance.loot.inventorySize) return null;
  state.gold -= cost.gold;
  state.materials.shards -= cost.shards;
  const item = generateItem(state, rng, { level: state.maxStage, minRarity: balance.forge.craftMinRarity, slot }, balance);
  addToInventory(state, item, balance);
  return item;
}

const findItem = (state, id) => [...state.inventory, ...Object.values(state.equipment)].find((i) => i?.id === id);

export function canReforge(item) {
  return Boolean(item) && rarityIndex(item.rarity) >= 1 && !itemBase(item.baseId).signature;
}

export function reforgeItem(state, id, rng, balance = BALANCE) {
  const item = findItem(state, id);
  const f = balance.forge;
  if (!canReforge(item) || state.materials.shards < f.reforgeShards || state.materials.essence < f.reforgeEssence) return false;
  state.materials.shards -= f.reforgeShards;
  state.materials.essence -= f.reforgeEssence;
  rerollAffixes(item, rng, balance);
  return true;
}

const RARITY_FACTOR = { common: 1, rare: 2, epic: 3, legendary: 5 };

export function sharpenCost(state, item, balance = BALANCE) {
  if (!item || item.level >= state.maxStage) return 0;
  return balance.forge.sharpenShardsPerLevel * (state.maxStage - item.level) * RARITY_FACTOR[item.rarity];
}

export function sharpenItem(state, id, balance = BALANCE) {
  const item = findItem(state, id);
  const cost = sharpenCost(state, item, balance);
  if (!cost || state.materials.shards < cost) return false;
  state.materials.shards -= cost;
  item.level = state.maxStage;
  refreshItemStats(item, balance);
  return true;
}
