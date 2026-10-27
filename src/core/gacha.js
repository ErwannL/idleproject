// Invocation de héros et de compagnons (gemmes ou tickets gagnés en jouant).
// Probabilités affichées et garanties : Épique ou mieux toutes les 10 invocations au plus,
// Légendaire toutes les 60 au plus. Doublon = +1 étoile (max 5), puis remboursement en gemmes.
import { BALANCE } from '../data/balance.js';
import { COMPANIONS } from '../data/companions.js';
import { RARITIES } from '../data/items.js';
import { rarityIndex } from './loot.js';
import { trackMissions } from './missions.js';
import { weekKey } from './tower.js';

// v8.4 : bannière de la semaine — un personnage (ou familier) Légendaire mis en avant :
// quand une invocation tombe sur Légendaire, il a 50 % de chances d'être celui-là.
export const FEATURED_SHARE = 0.5;
export function featuredUnit(pool = 'ally', now = Date.now()) {
  const legends = summonPool(pool).filter((u) => u.rarity === 'legendary');
  if (!legends.length) return null;
  const n = Math.floor(new Date(`${weekKey(now)}T00:00:00`).getTime() / (7 * 86400000));
  return legends[((n % legends.length) + legends.length) % legends.length];
}

// v7.6 : le chevalier est le seul héros (plus de variantes à invoquer) ; on invoque des personnages
// (héros alliés R/SR/SSR) et des compagnons (familiers).
// Bassins d'invocation : 'ally' (compagnons humains R/SR/SSR) ou 'pet' (familiers animaux).
export function summonPool(pool = 'ally') {
  return COMPANIONS.filter((c) => (c.kind === 'ally') === (pool === 'ally'))
    .map((c) => ({ kind: 'companion', id: c.id, name: c.name, rarity: c.rarity, ally: c.kind === 'ally' }));
}

function poolWeights(pool, balance) {
  return balance.summon.pools[pool]?.rarityWeights ?? balance.summon.rarityWeights;
}

// Probabilité de chaque rareté et de chaque unité (hors garantie).
export function summonOdds(pool = 'ally', balance = BALANCE) {
  const weights = poolWeights(pool, balance);
  const total = Object.values(weights).reduce((s, w) => s + w, 0);
  const units = summonPool(pool);
  return RARITIES.filter((r) => weights[r.id]).map((r) => {
    const list = units.filter((u) => u.rarity === r.id);
    const chance = weights[r.id] / total;
    const featured = r.id === 'legendary' ? featuredUnit(pool) : null;
    const unitChance = (u) => {
      if (!featured || list.length < 2) return list.length ? chance / list.length : 0;
      return u.id === featured.id ? chance * FEATURED_SHARE : (chance * (1 - FEATURED_SHARE)) / (list.length - 1);
    };
    return { rarity: r.id, chance, units: list.map((u) => ({ ...u, chance: unitChance(u), featured: u.id === featured?.id })) };
  });
}

function rollRarity(rng, minRarity, weights) {
  const pool = Object.keys(weights).filter((r) => weights[r] > 0 && rarityIndex(r) >= rarityIndex(minRarity));
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
export function summon(state, rng, count = 1, currency = 'gems', balance = BALANCE, pool = 'ally') {
  const cost = summonCost(count, currency, balance);
  if (state[currency] < cost) return null;
  state[currency] -= cost;
  trackMissions(state, 'summons', count);
  const { pity, maxStars, duplicateRefundGems } = balance.summon;
  const results = [];
  for (let i = 0; i < count; i++) {
    const p = state.summon;
    let min = 'common';
    if (p.sinceLegendary + 1 >= pity.legendaryAfter) min = 'legendary';
    else if (p.sinceEpic + 1 >= pity.epicAfter) min = 'epic';
    const rarity = rollRarity(rng, min, poolWeights(pool, balance));
    const units = summonPool(pool).filter((u) => u.rarity === rarity);
    const featured = rarity === 'legendary' ? featuredUnit(pool) : null;
    let unit;
    if (featured && units.length > 1) {
      const others = units.filter((u) => u.id !== featured.id);
      unit = rng.next() < FEATURED_SHARE ? featured : others[Math.floor(rng.next() * others.length)];
    } else unit = units[Math.floor(rng.next() * units.length)];
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
    // Historique des 60 dernières invocations.
    p.history = [{ id: unit.id, rarity, at: Date.now() }, ...(p.history ?? [])].slice(0, 60);
  }
  return results;
}
