// Compagnons : bonus passifs (selon niveau, étoiles et talents) et compétence automatique.
import { BALANCE } from '../data/balance.js';
import { COMPANION_RULES, COMPANIONS } from '../data/companions.js';
import { referenceKillGold } from './combat.js';
import { talentEffects } from './rebirth.js';
import { DUNGEONS } from '../data/dungeons.js';

export function companionById(id) {
  return COMPANIONS.find((c) => c.id === id);
}

export function companionMultiplier(state, id) {
  const owned = state.companions.owned[id];
  if (!owned) return 0;
  const bond = (talentEffects(state).companionPct ?? 0) / 100;
  return (1 + COMPANION_RULES.levelBonusPct * (owned.level - 1))
    * (1 + COMPANION_RULES.starBonusPct * (owned.stars - 1)) * (1 + bond);
}

export function equippedCompanions(state) {
  return state.companions.equipped.map(companionById).filter(Boolean);
}

// Héros adapté au donjon en cours (DUNGEONS[].ally) : il y écrase tout.
export function dungeonAffinity(state, id) {
  if (!state.dungeon) return false;
  return DUNGEONS.find((d) => d.id === state.dungeon.id)?.ally === id;
}

// Multiplicateur des dégâts subis : réduits quand le héros adapté au donjon fait partie de l'équipe.
export function dungeonDamageTaken(state, balance = BALANCE) {
  const ally = state.dungeon && DUNGEONS.find((d) => d.id === state.dungeon.id)?.ally;
  return ally && state.companions.equipped.includes(ally) ? 1 - balance.dungeonAffinity.damageTakenPct / 100 : 1;
}

export function companionEffects(state, balance = BALANCE) {
  const out = {};
  for (const c of equippedCompanions(state)) {
    const m = companionMultiplier(state, c.id) * (dungeonAffinity(state, c.id) ? balance.dungeonAffinity.passiveMultiplier : 1);
    for (const [k, v] of Object.entries(c.passive)) out[k] = (out[k] ?? 0) + v * m;
  }
  return out;
}

export function companionUpgradeCost(state, id, balance = BALANCE) {
  const owned = state.companions.owned[id];
  if (!owned) return Infinity;
  return Math.floor(COMPANION_RULES.upgradeCostKills * referenceKillGold(state.maxStage, balance)
    * COMPANION_RULES.upgradeCostGrowth ** (owned.level - 1));
}

export function upgradeCompanion(state, id, balance = BALANCE) {
  const owned = state.companions.owned[id];
  if (!owned || owned.level >= COMPANION_RULES.maxLevel) return false;
  const cost = companionUpgradeCost(state, id, balance);
  if (state.gold < cost) return false;
  state.gold -= cost;
  owned.level += 1;
  return true;
}

export function toggleCompanion(state, id, balance = BALANCE) {
  if (!state.companions.owned[id]) return false;
  const index = state.companions.equipped.indexOf(id);
  if (index >= 0) {
    state.companions.equipped.splice(index, 1);
    return true;
  }
  if (state.companions.equipped.length >= balance.companionSlots) return false;
  state.companions.equipped.push(id);
  return true;
}
