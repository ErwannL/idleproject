// Forge : fabrication ciblée (choix de l'emplacement), relance des effets spéciaux,
// réaffûtage d'un objet au niveau de l'étape maximale, amélioration et fusion.
import { BALANCE } from '../data/balance.js';
import { ITEM_BASES, RARITIES } from '../data/items.js';
import { referenceKillGold } from './combat.js';
import { addToInventory } from './inventory.js';
import { generateItem, itemBase, itemPower, makeItem, rarityIndex, refreshItemStats, rerollAffixes } from './loot.js';
import { trackMissions } from './missions.js';

// tier 'rare' : Rare ou mieux (or + éclats) ; 'epic' : Épique ou mieux (or + éclats + essences des boss).
export function craftCost(state, balance = BALANCE, tier = 'rare') {
  const f = balance.forge;
  const kill = referenceKillGold(state.maxStage, balance);
  if (tier === 'epic') return { gold: Math.floor(f.epicCraft.goldKills * kill), shards: f.epicCraft.shards, essence: f.epicCraft.essence };
  return { gold: Math.floor(f.craftGoldKills * kill), shards: f.craftShards, essence: 0 };
}

export function craftItem(state, slot, rng, balance = BALANCE, tier = 'rare') {
  const cost = craftCost(state, balance, tier);
  if (state.gold < cost.gold || state.materials.shards < cost.shards || state.materials.essence < cost.essence) return null;
  if (state.inventory.length >= balance.loot.inventorySize) return null;
  state.gold -= cost.gold;
  state.materials.shards -= cost.shards;
  state.materials.essence -= cost.essence;
  const minRarity = tier === 'epic' ? 'epic' : balance.forge.craftMinRarity;
  const item = generateItem(state, rng, { level: state.maxStage, minRarity, slot }, balance);
  addToInventory(state, item, balance);
  trackMissions(state, 'upgrades', 1);
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

// --- Amélioration : chaque niveau augmente une statistique de l'objet au hasard (+12 %). ---
export function maxUpgrades(item, balance = BALANCE) {
  return balance.forge.maxUpgrades[item.rarity] ?? 0;
}

export function upgradeCost(item, balance = BALANCE) {
  const f = balance.forge;
  const n = (item.upgrades ?? 0) + 1;
  return { gold: Math.floor(f.upgradeGoldKills * n * referenceKillGold(item.level, balance)), shards: f.upgradeShards * n };
}

// Statistiques améliorables : les statistiques positives et l'effet principal d'un accessoire.
function upgradableStats(item) {
  const base = itemBase(item.baseId);
  const stats = Object.entries(base.stats).filter(([, v]) => v > 0).map(([k]) => k);
  if (base.mainAffix) stats.push('main');
  return stats;
}

// Renvoie le nom de la statistique améliorée, ou null.
export function upgradeItem(state, id, rng, balance = BALANCE) {
  const item = findItem(state, id);
  if (!item || (item.upgrades ?? 0) >= maxUpgrades(item, balance)) return null;
  const cost = upgradeCost(item, balance);
  if (state.gold < cost.gold || state.materials.shards < cost.shards) return null;
  const stats = upgradableStats(item);
  if (!stats.length) return null;
  state.gold -= cost.gold;
  state.materials.shards -= cost.shards;
  const stat = stats[Math.floor(rng.next() * stats.length)];
  item.boosts = { ...(item.boosts ?? {}), [stat]: (item.boosts?.[stat] ?? 0) + 1 };
  item.upgrades = (item.upgrades ?? 0) + 1;
  refreshItemStats(item, balance);
  trackMissions(state, 'upgrades', 1);
  return stat;
}

// --- Fusion : 5 objets d'un même emplacement et d'une même rareté → 1 objet de la rareté suivante. ---
const fusable = (item) => !item.locked && !itemBase(item.baseId).signature;

// Groupes disponibles dans le sac : [{ slot, rarity, count, next }] (seulement s'il y a assez d'objets).
export function fusionGroups(state, balance = BALANCE) {
  const groups = new Map();
  for (const item of state.inventory) {
    if (!fusable(item) || item.rarity === RARITIES[RARITIES.length - 1].id) continue;
    const key = `${item.slot}|${item.rarity}`;
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }
  return [...groups.entries()]
    .map(([key, count]) => {
      const [slot, rarity] = key.split('|');
      return { slot, rarity, count, next: RARITIES[rarityIndex(rarity) + 1].id };
    })
    .filter((g) => g.count >= balance.forge.fusionCount)
    .sort((a, b) => rarityIndex(a.rarity) - rarityIndex(b.rarity) || a.slot.localeCompare(b.slot));
}

// Fusionne les 5 objets les plus faibles du groupe ; le nouvel objet prend le niveau le plus haut.
export function fuseItems(state, slot, rarity, rng, balance = BALANCE) {
  const n = balance.forge.fusionCount;
  const pool = state.inventory.filter((i) => i.slot === slot && i.rarity === rarity && fusable(i))
    .sort((a, b) => itemPower(a) - itemPower(b));
  if (pool.length < n || rarityIndex(rarity) >= RARITIES.length - 1) return null;
  const used = pool.slice(0, n);
  const ids = new Set(used.map((i) => i.id));
  state.inventory = state.inventory.filter((i) => !ids.has(i.id));
  const level = Math.max(...used.map((i) => i.level));
  const bases = ITEM_BASES.filter((b) => b.slot === slot);
  const base = bases[Math.floor(rng.next() * bases.length)];
  const item = makeItem(state, base.id, RARITIES[rarityIndex(rarity) + 1].id, level, balance, rng);
  addToInventory(state, item, balance);
  return item;
}
