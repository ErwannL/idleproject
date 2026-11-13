// Boosts à durée limitée : déclenchement, durée, recharge, niveaux et effets.
import { BALANCE } from '../data/balance.js';
import { RUSH_RULES, RUSHES } from '../data/rushes.js';
import { levelForStage, referenceKillGold } from './combat.js'; // v9.2.0 (monde marin) : niveau des étapes

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
  const k = autoFactor(state, rush.id); // v9.6.3 : lancée par le mode Auto → 60 %
  if (k !== 1) for (const key of Object.keys(out)) out[key] *= k;
  return out;
}
const autoFactor = (state, id) => (state.rushes?.autoOn?.[id] ? RUSH_RULES.autoPct : 1);

export function phantomHitPct(state, rush) {
  return (rush.hitPct + rush.hitPctPerLevel * (rushLevel(state, rush.id) - 1)) * autoFactor(state, rush.id);
}

// v9.6.3 (5.2) : les 3 compétences manuelles choisies (emplacements), parmi celles débloquées.
export function rushSlots(state) {
  const chosen = (state.rushes?.slots ?? []).filter((id) => rushById(id) && rushUnlocked(state, rushById(id)));
  for (const r of RUSHES) if (chosen.length < RUSH_RULES.slots && rushUnlocked(state, r) && !chosen.includes(r.id)) chosen.push(r.id);
  return chosen.slice(0, RUSH_RULES.slots);
}
export function setRushSlot(state, index, id) {
  if (!rushById(id) || index < 0 || index >= RUSH_RULES.slots) return false;
  const cur = rushSlots(state);
  const j = cur.indexOf(id);
  if (j >= 0) cur[j] = cur[index];
  cur[index] = id;
  state.rushes.slots = cur;
  return true;
}

export function rushReady(state, id) {
  const rush = rushById(id);
  return Boolean(rush) && rushUnlocked(state, rush) && !(state.rushes.active[id] > 0) && !(state.rushes.cooldown[id] > 0);
}

export function activateRush(state, id, auto = false) {
  if (!rushReady(state, id)) return false;
  const rush = rushById(id);
  state.rushes.active[id] = rushDuration(state, rush);
  state.rushes.cooldown[id] = rush.cooldown;
  state.rushes.autoOn = { ...(state.rushes.autoOn ?? {}), [id]: auto }; // v9.6.3 : Auto = 60 %
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
  if (r.auto) for (const id of rushSlots(state)) if (activateRush(state, id, true)) started.push(id); // v9.6.3 : 3 emplacements
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
  return Math.floor(RUSH_RULES.costKills * referenceKillGold(levelForStage(state.maxStage, balance), balance) * RUSH_RULES.costGrowth ** (lv - 1));
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
  // v9.6.3 : emplacements choisis (les niveaux des Boosts sont gardés tels quels).
  if (Array.isArray(raw.slots)) out.slots = raw.slots.filter((id) => RUSHES.some((r) => r.id === id)).slice(0, RUSH_RULES.slots);
  return out;
}
