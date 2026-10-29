// Bonus éternels (fusionnés dans la Renaissance) ; performPrestige reste pour les anciennes sauvegardes.
import { rebirthPower } from './rebirth.js';
import { PRESTIGE, PRESTIGE_PERKS } from '../data/prestige.js';
import { performRebirth } from './rebirth.js';

export function prestigePerk(id) {
  return PRESTIGE_PERKS.find((p) => p.id === id);
}

export function canPrestige(state) {
  return state.maxStage >= PRESTIGE.minStage;
}

export function prestigeReward(state) {
  if (!canPrestige(state)) return 0;
  return PRESTIGE.starsBase + Math.floor((state.maxStage - PRESTIGE.minStage) / PRESTIGE.starsPerStages);
}

// Effectue le Prestige : Renaissance (fragments compris) + remise à zéro des fragments et talents.
export function performPrestige(state) {
  const stars = prestigeReward(state);
  if (stars <= 0) return 0;
  performRebirth(state);
  state.fragments = 0;
  state.talents = {};
  state.prestige.count += 1;
  state.prestige.stars += stars;
  return stars;
}

export function perkCost(level) {
  return PRESTIGE.perkCostFragments * (level + 1);
}

export function buyPerk(state, id) {
  const perk = prestigePerk(id);
  if (!perk) return false;
  const level = state.prestige.perks[id] ?? 0;
  const cost = perkCost(level);
  if (level >= perk.max || state.fragments < cost) return false;
  state.fragments -= cost;
  state.prestige.perks[id] = level + 1;
  return true;
}

// Bonus éternels (Prestiges effectués + bonus achetés).
export function prestigeEffects(state) {
  const p = state.prestige;
  const out = {};
  if (!p) return out;
  // Un bonus permanent par Renaissance (et par ancien Prestige).
  const n = rebirthPower(state) + p.count; // v9.0.6 : Renaissances au prorata de leur profondeur
  for (const [k, v] of Object.entries(PRESTIGE.perPrestige)) out[k] = v * n;
  for (const perk of PRESTIGE_PERKS) {
    const level = p.perks[perk.id] ?? 0;
    for (const [k, v] of Object.entries(perk.effect)) out[k] = (out[k] ?? 0) + v * level;
  }
  return out;
}

export function sanitizePrestige(raw) {
  const out = { count: 0, stars: 0, perks: {} };
  if (!raw || typeof raw !== 'object') return out;
  const int = (v) => (Number.isInteger(v) && v > 0 ? v : 0);
  out.count = int(raw.count);
  out.stars = int(raw.stars);
  for (const perk of PRESTIGE_PERKS) {
    const lv = Math.min(perk.max, int(raw.perks?.[perk.id]));
    if (lv) out.perks[perk.id] = lv;
  }
  return out;
}
