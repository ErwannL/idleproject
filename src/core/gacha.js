// Invocation de héros et de compagnons (gemmes gagnées en jouant).
// Probabilités affichées et garanties : Épique ou mieux toutes les 10 invocations au plus,
// Légendaire toutes les 60 au plus. Doublon = +1 étoile, puis remboursement en gemmes.
// v9.1.3 (doc4 lot 1) : compagnons et familiers jusqu'à 6 exemplaires (0★ à 5★ : 5 doublons) ; skins jusqu'à 5 (1★ à 5★).
import { BALANCE } from '../data/balance.js';
import { COMPANIONS, COMPANION_RULES } from '../data/companions.js';
import { SKILL_RULES } from '../data/companion-skills.js';
import { HEROES } from '../data/heroes.js';
import { RARITIES } from '../data/items.js';
import { rarityIndex } from './loot.js';
import { trackMissions } from './missions.js';
import { weekKey } from './tower.js';
import { BANNER_RULES } from '../data/banners.js';
import { archiveTargets, currentBanner } from './banner.js';

// v8.4 : bannière de la semaine — un personnage (ou familier) Légendaire mis en avant :
// quand une invocation tombe sur Légendaire, il a 50 % de chances d'être celui-là.
export const FEATURED_SHARE = 0.5;
// v9.0.6 : en vedette chez les héros, seulement les skins dessinés, en commençant par le Roi Grombar la
// semaine de leur arrivée (puis Diablesse, Séraphin… chaque lundi).
const HERO_FEATURED = ['grombar', 'demoness', 'seraph'];
const HERO_LAUNCH_WEEK = Math.round(new Date('2026-10-26T00:00:00').getTime() / (7 * 86400000));
export function featuredUnit(pool = 'ally', now = Date.now(), state = null) {
  // v9.1.3 (doc4 lot 4) : bannière = le perso de la sortie en cours ; Archives = la cible choisie.
  if (pool === 'banner') return asSummonUnit(currentBanner(now)?.unit);
  if (pool === 'archive') return asSummonUnit(archiveTargets(now).find((u) => u.id === state?.summon?.archiveTarget));
  if (pool === 'hero') {
    const n = Math.round(new Date(`${weekKey(now)}T00:00:00`).getTime() / (7 * 86400000)) - HERO_LAUNCH_WEEK;
    const id = HERO_FEATURED[((n % HERO_FEATURED.length) + HERO_FEATURED.length) % HERO_FEATURED.length];
    return summonPool('hero').find((u) => u.id === id) ?? null;
  }
  const legends = summonPool(pool).filter((u) => u.rarity === 'legendary');
  if (!legends.length) return null;
  const n = Math.floor(new Date(`${weekKey(now)}T00:00:00`).getTime() / (7 * 86400000));
  return legends[((n % legends.length) + legends.length) % legends.length];
}

// v9.1.3 : une seule normalisation du bassin d'invocation (main.js, ui.js, panneau Invocation). Tout bassin inconnu
// devient 'ally' ; 'hero' (Apparences) et 'pet' (Familiers) sont respectés.
// v9.1.3 (doc4 lot 4) : 'banner' (perso de la sortie) et 'archive' (cible au choix), déclarés dans BALANCE.summon.pools.
export const SUMMON_POOLS = ['hero', 'ally', 'pet', 'banner', 'archive'];
const asSummonUnit = (c) => (c ? { kind: 'companion', id: c.id, name: c.name, rarity: c.rarity, ally: c.kind === 'ally', ...(c.bannerOnly ? { bannerOnly: true } : {}) } : null);
const MEMORY_POOLS = new Set(['banner', 'archive']);
export function normalizePool(pool) {
  return SUMMON_POOLS.includes(pool) ? pool : 'ally';
}

// v7.6 : le chevalier est le seul héros (plus de variantes à invoquer) ; on invoque des personnages
// (héros alliés R/SR/SSR) et des compagnons (familiers).
// Bassins d'invocation : 'ally' (compagnons humains R/SR/SSR) ou 'pet' (familiers animaux).
// Bassin permanent gelé (COMPANIONS : 8 R, 7 SR, 5 SSR et les familiers) : un perso `bannerOnly` n'y entre jamais et
// ne décale ni le bassin ni la rotation de la vedette hebdomadaire. Bannière et Archives = ce bassin + leur vedette.
export function summonPool(pool = 'ally', now = Date.now(), state = null) {
  // v9.0.6 : invocation de héros (skins et chevaliers aux couleurs d'antan).
  if (pool === 'hero') return HEROES.filter((h) => h.summon).map((h) => ({ kind: 'hero', id: h.id, name: h.name, rarity: h.rarity, ally: true }));
  const base = COMPANIONS.filter((c) => (c.kind === 'ally') === (pool !== 'pet')).map(asSummonUnit);
  if (MEMORY_POOLS.has(pool)) {
    const f = featuredUnit(pool, now, state);
    if (f && !base.some((u) => u.id === f.id)) base.push(f);
  }
  return base;
}

function poolWeights(pool, balance) {
  return balance.summon.pools[pool]?.rarityWeights ?? balance.summon.rarityWeights;
}

// Probabilité de chaque rareté et de chaque unité (hors garantie).
// v9.1.3 (doc4 lot 4) : `now` et `state` pour la bannière (vedette du jour) et les Archives (cible choisie).
export function summonOdds(pool = 'ally', balance = BALANCE, now = Date.now(), state = null) {
  const weights = poolWeights(pool, balance);
  const total = Object.values(weights).reduce((s, w) => s + w, 0);
  const units = summonPool(pool, now, state);
  return RARITIES.filter((r) => weights[r.id]).map((r) => {
    const list = units.filter((u) => u.rarity === r.id);
    const chance = weights[r.id] / total;
    const featured = r.id === 'legendary' ? featuredUnit(pool, now, state) : null;
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
  return count >= 10 ? balance.summon.tenPullGemCost : balance.summon.gemCost * count;
}

// count = 1 ou 10 ; currency = 'gems' (v9.1.3 : tickets fondus dans les gemmes). Renvoie la liste des résultats, ou null.
// v9.1.3 (doc4 lot 4) : bannière et Archives. Légendaire perdu (un autre que la vedette) → le prochain Légendaire de
// la bannière ou des Archives est la vedette (mémoire commune, consommée une fois). Filet (bannière seulement, tant que
// la vedette n'a aucune copie) : elle arrive au plus tard au 50e tirage sans elle ; compteur conservé d'une bannière à
// l'autre, figé quand la vedette est possédée, remis à 0 à son obtention. Garantie à 60 toujours partagée.
export function summon(state, rng, count = 1, currency = 'gems', balance = BALANCE, pool = 'ally', now = Date.now()) {
  if (currency !== 'gems') return null; // v9.1.3 : plus de tickets
  if (MEMORY_POOLS.has(pool) && !featuredUnit(pool, now, state)) return null; // pas de bannière, ou cible d'Archives absente
  const cost = summonCost(count, currency, balance);
  if (state[currency] < cost) return null;
  state[currency] -= cost;
  trackMissions(state, 'summons', count);
  const { pity, maxStars, duplicateRefundGems } = balance.summon;
  const results = [];
  for (let i = 0; i < count; i++) {
    const p = state.summon;
    const vedette = featuredUnit(pool, now, state);
    const realOwned = (u) => u && state.companions.owned[u.id] && !state.companions.owned[u.id].trial;
    const net = pool === 'banner' && vedette && !realOwned(vedette);
    const netHit = net && (p.net ?? 0) + 1 >= BANNER_RULES.netPulls;
    let min = 'common';
    if (netHit || p.sinceLegendary + 1 >= pity.legendaryAfter) min = 'legendary';
    else if (p.sinceEpic + 1 >= pity.epicAfter) min = 'epic';
    const rarity = rollRarity(rng, min, poolWeights(pool, balance));
    const units = summonPool(pool, now, state).filter((u) => u.rarity === rarity);
    const featured = rarity === 'legendary' ? featuredUnit(pool, now, state) : null;
    let unit;
    if (featured && MEMORY_POOLS.has(pool) && (netHit || p.lostLegend)) {
      unit = featured;
    } else if (featured && units.length > 1) {
      const others = units.filter((u) => u.id !== featured.id);
      unit = rng.next() < FEATURED_SHARE ? featured : others[Math.floor(rng.next() * others.length)];
    } else unit = units[Math.floor(rng.next() * units.length)];
    if (featured && MEMORY_POOLS.has(pool)) p.lostLegend = unit.id !== featured.id;
    if (net) p.net = unit.id === vedette.id ? 0 : (p.net ?? 0) + 1;
    p.total += 1;
    p.sinceLegendary = rarity === 'legendary' ? 0 : p.sinceLegendary + 1;
    p.sinceEpic = rarityIndex(rarity) >= rarityIndex('epic') ? 0 : p.sinceEpic + 1;

    const store = unit.kind === 'hero' ? state.heroes.owned : state.companions.owned;
    if (store[unit.id]?.trial) delete store[unit.id]; // v9.1.3 (lot 6) : l'essai gratuit n'est pas un exemplaire
    const owned = store[unit.id];
    const result = { ...unit, guaranteed: min !== 'common', isNew: !owned, refund: 0 };
    if (!owned) {
      store[unit.id] = unit.kind === 'hero' ? { stars: 1 } : { stars: 1, level: 1 };
    } else if (owned.stars < (unit.kind === 'hero' ? maxStars : COMPANION_RULES.maxCopies)) {
      owned.stars += 1;
    } else {
      result.refund = duplicateRefundGems;
      state.gems += duplicateRefundGems;
    }
    result.stars = store[unit.id].stars;
    // v9.1.3 (doc4 lot 2) : ce doublon débloque l'ultime (3 doublons). Jamais pour un skin (ses étoiles sont autres).
    result.ultimateUnlocked = unit.kind !== 'hero' && !result.isNew && !result.refund && result.stars === SKILL_RULES.ultimateCopies;
    results.push(result);
    // Historique des 60 dernières invocations.
    // v9.1.3 : `kind` distingue un skin d'un compagnon de même identifiant (fairy, witch, ninja).
    p.history = [{ id: unit.id, kind: unit.kind, rarity, at: Date.now() }, ...(p.history ?? [])].slice(0, 60);
  }
  return results;
}
