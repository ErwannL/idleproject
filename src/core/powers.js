// Pouvoirs ancestraux : déblocage à la première victoire, relance contre de l'or,
// choix explicite entre l'ancien et le nouveau, emplacements actifs limités.
// Le pouvoir actuel n'est jamais remplacé sans l'accord du joueur.
import { BALANCE } from '../data/balance.js';
import { BOSSES } from '../data/enemies.js';
import { RARITIES } from '../data/items.js';
import { DUNGEONS } from '../data/dungeons.js';
import { BOSS_POWERS, POWER_RULES } from '../data/powers.js';
import { ZONES } from '../data/zones.js';
import { enemyStats, zoneStartStage } from './combat.js';
import { rarityIndex } from './loot.js';
import { talentEffects } from './rebirth.js';
import { grantReward } from './rewards.js';

export function powerById(id) {
  for (const [bossId, list] of Object.entries(BOSS_POWERS)) {
    const power = list.find((p) => p.id === id);
    if (power) return { ...power, bossId };
  }
  return null;
}

// Première étape où le boss apparaît (coût de relance, Codex). Boss de donjon : étape d'accès au donjon.
export function bossFirstStage(bossId, balance = BALANCE) {
  const zone = ZONES.findIndex((z) => !z.gauntlet && z.bosses.includes(bossId));
  if (zone >= 0) return zoneStartStage(zone, balance) - 1 + balance.stages.tiers.mega.stage;
  const tierZone = ZONES.findIndex((z) => Object.values(z.tierBosses ?? {}).includes(bossId));
  if (tierZone >= 0) return zoneStartStage(tierZone, balance) - 1 + balance.stages.tiers[BOSSES[bossId].tier].stage;
  const dungeon = DUNGEONS.find((d) => d.boss === bossId);
  return dungeon ? dungeon.unlockStage : null;
}

// Donjon propre au boss (null pour un boss de campagne, même réutilisé dans un donjon).
export function bossDungeon(bossId) {
  if (ZONES.some((z) => !z.gauntlet && z.bosses.includes(bossId))) return null;
  return DUNGEONS.find((d) => d.boss === bossId) ?? null;
}

// Boss à pouvoir ancestral (méga boss et boss de donjon), dans l'ordre de la campagne.
export function bossesInOrder(balance = BALANCE) {
  return Object.keys(BOSSES).filter((id) => !BOSSES[id].tier).sort((a, b) => bossFirstStage(a, balance) - bossFirstStage(b, balance));
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

// Familles qui profitent de la synergie (au moins 2 pouvoirs actifs de la même famille).
export function synergyFamilies(state) {
  const counts = {};
  for (const p of activePowers(state)) counts[p.family] = (counts[p.family] ?? 0) + 1;
  return Object.keys(counts).filter((f) => counts[f] >= POWER_RULES.synergy.minSameFamily);
}

// Effets des pouvoirs actifs, synergies comprises.
export function powerEffects(state) {
  const boosted = new Set(synergyFamilies(state));
  const out = {};
  for (const p of activePowers(state)) {
    const factor = boosted.has(p.family) ? 1 + POWER_RULES.synergy.bonusPct / 100 : 1;
    for (const [k, v] of Object.entries(p.effects)) out[k] = (out[k] ?? 0) + v * factor;
  }
  return out;
}

// Appelé à chaque victoire contre un boss. Première victoire : pouvoir + gemmes.
// Victoires suivantes : une charge de relance (il faut réaffronter le boss pour relancer).
export function recordBossVictory(state, bossId, rng, balance = BALANCE) {
  let entry = state.powers[bossId];
  if (entry) {
    entry.victories += 1;
    entry.charges = Math.min(POWER_RULES.maxCharges, entry.charges + POWER_RULES.chargesPerVictory);
    return null;
  }
  entry = { current: rollPower(bossId, rng), pending: null, victories: 1, rerolls: 0, sinceHigh: 0, charges: 0, masteryClaimed: 0 };
  state.powers[bossId] = entry;
  if (state.equippedPowers.length < powerSlots(state)) state.equippedPowers.push(bossId);
  state.gems += balance.summon.firstBossGems;
  return powerById(entry.current);
}

// Maîtrise : paliers de victoires avec récompenses à récupérer.
export function nextMasteryTier(state, bossId, balance = BALANCE) {
  const entry = state.powers[bossId];
  if (!entry) return null;
  return balance.mastery[entry.masteryClaimed] ?? null;
}

export function claimMastery(state, bossId, balance = BALANCE) {
  const entry = state.powers[bossId];
  const tier = nextMasteryTier(state, bossId, balance);
  if (!tier || entry.victories < tier.victories) return null;
  entry.masteryClaimed += 1;
  const { victories, ...reward } = tier;
  return grantReward(state, reward);
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
  if (!entry || entry.pending || entry.charges < 1) return null;
  const cost = rerollCost(state, bossId, balance);
  if (state.gold < cost) return null;
  state.gold -= cost;
  entry.charges -= 1;
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
