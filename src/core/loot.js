// Génération d'objets à partir des définitions de src/data/items.js.
import { BALANCE } from '../data/balance.js';
import { ITEM_BASES, PERCENT_STATS, RARITIES } from '../data/items.js';

export function rarityById(id) {
  return RARITIES.find((r) => r.id === id);
}

export function rarityIndex(id) {
  return RARITIES.findIndex((r) => r.id === id);
}

export function itemBase(baseId) {
  return ITEM_BASES.find((b) => b.id === baseId);
}

export function rollRarity(rng, minRarity = 'common') {
  const pool = RARITIES.slice(Math.max(0, rarityIndex(minRarity)));
  const total = pool.reduce((sum, r) => sum + r.weight, 0);
  let roll = rng.next() * total;
  for (const rarity of pool) {
    roll -= rarity.weight;
    if (roll < 0) return rarity.id;
  }
  return pool[pool.length - 1].id;
}

export function itemStatValue(stat, baseValue, rarity, level, balance = BALANCE) {
  // Les bonus sont amplifiés par la rareté, les malus (ex. hache plus lente) non.
  let value = baseValue > 0 ? baseValue * rarity.statMultiplier : baseValue;
  if (PERCENT_STATS.has(stat)) return Math.round(value * 10) / 10;
  value *= 1 + balance.loot.stagePowerGrowth * (level - 1);
  return Math.round(value);
}

export function makeItem(state, baseId, rarityId, level, balance = BALANCE) {
  const base = itemBase(baseId);
  const rarity = rarityById(rarityId);
  const stats = {};
  for (const [stat, value] of Object.entries(base.stats)) {
    stats[stat] = itemStatValue(stat, value, rarity, level, balance);
  }
  const id = `it${state.nextItemId}`;
  state.nextItemId += 1;
  return { id, baseId, name: base.name, slot: base.slot, rarity: rarityId, level, stats, effect: null, locked: false };
}

export function generateItem(state, rng, { level, minRarity = 'common' }, balance = BALANCE) {
  const base = rng.pick(ITEM_BASES);
  return makeItem(state, base.id, rollRarity(rng, minRarity), Math.max(1, level), balance);
}

export function recycleValue(item, balance = BALANCE) {
  const rarity = rarityById(item.rarity);
  return Math.floor(rarity.recycleGold * (1 + balance.loot.recycleLevelGrowth * (item.level - 1)));
}

// Score simple pour trier par puissance.
export function itemPower(item) {
  const s = item.stats;
  return (s.damage ?? 0) * 3 + (s.maxHp ?? 0) * 0.5 + (s.armor ?? 0) * 4 + (s.attackSpeed ?? 0) * 1.5;
}
