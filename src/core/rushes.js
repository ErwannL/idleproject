// Boosts à durée limitée : déclenchement, durée, recharge, niveaux et effets.
import { BALANCE } from '../data/balance.js';
import { RUSH_RULES, RUSHES } from '../data/rushes.js';
import { referenceKillGold } from './combat.js';

export function rushById(id) {
  return RUSHES.find((r) => r.id === id);
}

export function rushLevel(state, id) {
  return state.rushes.levels[id] ?? 1;
}

export function rushUnlocked(state, rush) {
  return state.level >= rush.unlockLevel;
}

export function rushDuration(state, rush) {
  return rush.duration + RUSH_RULES.durationPerLevel * (rushLevel(state, rush.id) - 1);
}

// Effet du boost à son niveau actuel.
export function rushEffect(state, rush) {
  const lv = rushLevel(state, rush.id) - 1;
  const out = { ...rush.effect };
  for (const [k, v] of Object.entries(rush.perLevel)) out[k] = (out[k] ?? 0) + v * lv;
  return out;
}

export function phantomHitPct(state, rush) {
  return rush.hitPct + rush.hitPctPerLevel * (rushLevel(state, rush.id) - 1);
}

export function rushReady(state, id) {
  const rush = rushById(id);
  return Boolean(rush) && rushUnlocked(state, rush) && !(state.rushes.active[id] > 0) && !(state.rushes.cooldown[id] > 0);
}

export function activateRush(state, id) {
  if (!rushReady(state, id)) return false;
  const rush = rushById(id);
  state.rushes.active[id] = rushDuration(state, rush);
  state.rushes.cooldown[id] = rush.cooldown;
  return true;
}

// Avance les minuteries (temps de jeu). Avec le mode auto, relance chaque boost dès qu'il est prêt.
export function tickRushes(state, dt) {
  const r = state.rushes;
  const ended = [];
  for (const id of Object.keys(r.active)) {
    r.active[id] -= dt;
    if (r.active[id] <= 0) { delete r.active[id]; ended.push(id); }
  }
  for (const id of Object.keys(r.cooldown)) {
    r.cooldown[id] -= dt;
    if (r.cooldown[id] <= 0) delete r.cooldown[id];
  }
  const started = [];
  if (r.auto) for (const rush of RUSHES) if (activateRush(state, rush.id)) started.push(rush.id);
  return { ended, started };
}

// Effets cumulés des boosts actifs (source de bonus « Boosts »).
export function rushEffects(state) {
  const out = {};
  for (const id of Object.keys(state.rushes?.active ?? {})) {
    const rush = rushById(id);
    if (!rush) continue;
    for (const [k, v] of Object.entries(rushEffect(state, rush))) out[k] = (out[k] ?? 0) + v;
  }
  return out;
}

export function rushUpgradeCost(state, id, balance = BALANCE) {
  const lv = rushLevel(state, id);
  return Math.floor(RUSH_RULES.costKills * referenceKillGold(state.maxStage, balance) * RUSH_RULES.costGrowth ** (lv - 1));
}

export function upgradeRush(state, id, balance = BALANCE) {
  const rush = rushById(id);
  if (!rush || !rushUnlocked(state, rush) || rushLevel(state, id) >= RUSH_RULES.maxLevel) return false;
  const cost = rushUpgradeCost(state, id, balance);
  if (state.gold < cost) return false;
  state.gold -= cost;
  state.rushes.levels[id] = rushLevel(state, id) + 1;
  return true;
}

export function sanitizeRushes(raw) {
  const out = { levels: {}, active: {}, cooldown: {}, auto: false };
  if (!raw || typeof raw !== 'object') return out;
  out.auto = raw.auto === true;
  for (const rush of RUSHES) {
    const lv = Number(raw.levels?.[rush.id]);
    if (Number.isInteger(lv) && lv > 1) out.levels[rush.id] = Math.min(RUSH_RULES.maxLevel, lv);
    const a = Number(raw.active?.[rush.id]);
    if (a > 0) out.active[rush.id] = Math.min(a, rushDuration({ rushes: out }, rush));
    const c = Number(raw.cooldown?.[rush.id]);
    if (c > 0) out.cooldown[rush.id] = Math.min(c, rush.cooldown);
  }
  return out;
}
