// Invocation de héros et de compagnons (gemmes ou tickets gagnés en jouant).
// Probabilités affichées et garanties : Épique ou mieux toutes les 10 invocations au plus,
// Légendaire toutes les 60 au plus. Doublon = +1 étoile (max 5), puis remboursement en gemmes.
import { BALANCE } from '../data/balance.js';
import { COMPANIONS } from '../data/companions.js';
import { HEROES } from '../data/heroes.js';
import { RARITIES } from '../data/items.js';
import { rarityIndex } from './loot.js';

export function summonPool() {
  return [
    ...HEROES.map((h) => ({ kind: 'hero', id: h.id, name: h.name, rarity: h.rarity })),
    ...COMPANIONS.map((c) => ({ kind: 'companion', id: c.id, name: c.name, rarity: c.rarity })),
  ];
}

// Probabilité de chaque rareté et de chaque unité (hors garantie).
export function summonOdds(balance = BALANCE) {
  const weights = balance.summon.rarityWeights;
  const total = Object.values(weights).reduce((s, w) => s + w, 0);
  const pool = summonPool();
  return RARITIES.map((r) => {
    const units = pool.filter((u) => u.rarity === r.id);
    const chance = (weights[r.id] ?? 0) / total;
    return { rarity: r.id, chance, units: units.map((u) => ({ ...u, chance: units.length ? chance / units.length : 0 })) };
  });
}

function rollRarity(rng, minRarity, balance) {
  const weights = balance.summon.rarityWeights;
  const pool = Object.keys(weights).filter((r) => rarityIndex(r) >= rarityIndex(minRarity));
  const total = pool.reduce((s, r) => s + weights[r], 0);
  let roll = rng.next() * total;
  for (const r of pool) {
    roll -= weights[r];
    if (roll < 0) return r;
  }
  return pool[pool.length - 1];
}

export function summonCost(count, currency, balance = BALANCE) {
  if (currency === 'tickets') return count;
  return count >= 10 ? balance.summon.tenPullGemCost : balance.summon.gemCost * count;
}

// count = 1 ou 10 ; currency = 'gems' | 'tickets'. Renvoie la liste des résultats, ou null.
export function summon(state, rng, count = 1, currency = 'gems', balance = BALANCE) {
  const cost = summonCost(count, currency, balance);
  if (state[currency] < cost) return null;
  state[currency] -= cost;
  const { pity, maxStars, duplicateRefundGems } = balance.summon;
  const results = [];
  for (let i = 0; i < count; i++) {
    const p = state.summon;
    let min = 'common';
    if (p.sinceLegendary + 1 >= pity.legendaryAfter) min = 'legendary';
    else if (p.sinceEpic + 1 >= pity.epicAfter) min = 'epic';
    const rarity = rollRarity(rng, min, balance);
    const units = summonPool().filter((u) => u.rarity === rarity);
    const unit = units[Math.floor(rng.next() * units.length)];
    p.total += 1;
    p.sinceLegendary = rarity === 'legendary' ? 0 : p.sinceLegendary + 1;
    p.sinceEpic = rarityIndex(rarity) >= rarityIndex('epic') ? 0 : p.sinceEpic + 1;

    const store = unit.kind === 'hero' ? state.heroes.owned : state.companions.owned;
    const owned = store[unit.id];
    const result = { ...unit, guaranteed: min !== 'common', isNew: !owned, refund: 0 };
    if (!owned) {
      store[unit.id] = unit.kind === 'hero' ? { stars: 1 } : { stars: 1, level: 1 };
    } else if (owned.stars < maxStars) {
      owned.stars += 1;
    } else {
      result.refund = duplicateRefundGems;
      state.gems += duplicateRefundGems;
    }
    result.stars = store[unit.id].stars;
    results.push(result);
  }
  return results;
}
