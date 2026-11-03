// Transcendance (v8.8) : voir src/data/transcend.js.
import { BALANCE } from '../data/balance.js';
import { noteTranscend } from './times.js';
import { levelForStage } from './combat.js'; // v9.2.0 (monde marin) : niveau de puissance des étapes
import { TRANSCEND, TRANSCEND_PERKS } from '../data/transcend.js';

export function emptyTranscend() {
  return { count: 0, stars: 0, keptRebirths: 0, perks: {} };
}

export function transcendPerk(id) {
  return TRANSCEND_PERKS.find((p) => p.id === id);
}

export function perkLevel(state, id) {
  return state.transcend?.perks?.[id] ?? 0;
}

export function transcendPerkCost(perk, level) {
  return Math.ceil(perk.base + perk.step * level);
}

export function canTranscend(state) {
  return state.maxStage >= TRANSCEND.minStage;
}

export function transcendReward(state) {
  if (!canTranscend(state)) return 0;
  return Math.floor(TRANSCEND.starsScale * (levelForStage(state.maxStage) / TRANSCEND.starsDivisor) ** TRANSCEND.starsExponent);
}

// Part des Renaissances conservée à la Transcendance (0..1).
export function keptRebirthShare(state) {
  return Math.min(0.9, (TRANSCEND.keepRebirthsPct + 5 * perkLevel(state, 'heritage')) / 100);
}

// Multiplicateur d'une Renaissance (1,5 de base, +0,05 par niveau de « Renaissance sublimée »).
export function rebirthBase(state, base) {
  return base + 0.05 * perkLevel(state, 'rebirth');
}

// Multiplicateur permanent de la Transcendance : ×2 par Transcendance et ×1,5 par niveau de Puissance stellaire.
export function stellarMultiplier(state) {
  const t = state.transcend;
  if (!t) return 1;
  return Math.min(1e100, TRANSCEND.powerPerTranscend ** t.count * 1.5 ** perkLevel(state, 'stellar'));
}

// « Entropie » : les PV et dégâts des ennemis grandissent moins vite avec le niveau (×croissance^(-n × réduction)).
export function enemyScaleFactor(state, level, balance = BALANCE) {
  const red = 0.02 * perkLevel(state, 'scaling');
  if (!red) return { hp: 1, damage: 1 };
  const n = Math.max(0, level - 1);
  const g = balance.enemyScaling;
  return { hp: g.hpGrowth ** (-n * red), damage: g.damageGrowth ** (-n * red) };
}

export function fragmentBonus(state) {
  return 1 + 0.5 * perkLevel(state, 'fragments');
}

export function memoryShare(state) {
  return 0.05 * perkLevel(state, 'memory');
}

export function buyTranscendPerk(state, id) {
  const perk = transcendPerk(id);
  if (!perk) return false;
  const level = perkLevel(state, id);
  const cost = transcendPerkCost(perk, level);
  if (level >= perk.max || state.transcend.stars < cost) return false;
  state.transcend.stars -= cost;
  state.transcend.perks = { ...state.transcend.perks, [id]: level + 1 };
  return true;
}

// Tous les niveaux abordables d'un bonus stellaire.
export function buyTranscendPerkMax(state, id) {
  let n = 0;
  while (buyTranscendPerk(state, id)) n += 1;
  return n;
}

// Transcendance : `rebirth` = performRebirth (passé par l'appelant pour éviter une dépendance circulaire).
// Renvoie le nombre d'Étoiles gagnées (0 si impossible).
export function performTranscend(state, rebirth, keepPower = undefined) {
  const stars = transcendReward(state);
  if (stars <= 0) return 0;
  if (state.dungeon || state.tower || state.challenge) return 0; // v9.1.0 : jamais en plein mode

  state.tower = null;
  state.dungeon = null;
  state.challenge = null;
  rebirth(state, keepPower);
  noteTranscend(state);
  const t = state.transcend;
  // v9.0.6 : Renaissances comptées au prorata de leur profondeur (state.rebirthPower).
  const power = Number.isFinite(state.rebirthPower) ? state.rebirthPower : state.records.rebirths ?? 0;
  const total = power + (state.prestige?.count ?? 0);
  t.keptRebirths += Math.floor(total * keptRebirthShare(state));
  state.records.rebirths = 0;
  state.rebirthPower = 0;
  if (state.prestige) state.prestige.count = 0;
  state.talents = {};
  state.fragments = 0;
  t.count += 1;
  t.stars += stars;
  return stars;
}

export function sanitizeTranscend(raw) {
  const out = emptyTranscend();
  if (!raw || typeof raw !== 'object') return out;
  const int = (v) => (Number.isInteger(v) && v > 0 ? v : 0);
  out.count = int(raw.count);
  out.stars = int(raw.stars);
  out.keptRebirths = int(raw.keptRebirths);
  for (const perk of TRANSCEND_PERKS) {
    const lv = Math.min(perk.max, int(raw.perks?.[perk.id]));
    if (lv) out.perks[perk.id] = lv;
  }
  return out;
}
