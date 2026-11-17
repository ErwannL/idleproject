// v9.8 (H7) : Titan du jour — un grand boss par jour de la semaine, 2 essais par jour, 60 s pour lui faire le plus de
// dégâts. Classement par tranches (10 %, 30 %, 60 %) : sans serveur, la tranche se lit à la part de la barre vidée
// (barre calée sur les dégâts attendus de la partie, comme le World Boss). Réutilise le moteur des grands boss.
import { DAY_TITANS } from '../data/grand-bosses.js';
import { bossHpForDay } from './world-boss.js';
import { dayKey } from './tower.js';
import { grantReward } from './rewards.js';

export const TITAN = { tries: 2, seconds: 60 };
export const TITAN_TIERS = [
  { id: 'top10', label: 'Top 10 %', min: 0.6, reward: { gems: 60, shards: 30, keys: 1 } },
  { id: 'top30', label: 'Top 30 %', min: 0.35, reward: { gems: 40, shards: 20 } },
  { id: 'top60', label: 'Top 60 %', min: 0, reward: { gems: 20, shards: 10 } },
];
export function titanToday(now = Date.now()) { return DAY_TITANS[new Date(now).getDay()]; }
function rec(state, now) {
  const day = dayKey(now);
  if (state.titan?.day !== day) state.titan = { day, tries: 0, best: 0, ratio: 0 };
  return state.titan;
}
export function titanTriesLeft(state, now = Date.now()) { return Math.max(0, TITAN.tries - rec(state, now).tries); }
export function titanTier(ratio) { return TITAN_TIERS.find((t) => ratio >= t.min) ?? TITAN_TIERS.at(-1); }

export function startTitan(state, now = Date.now()) {
  if (titanTriesLeft(state, now) <= 0) return null;
  const t = titanToday(now);
  const r = rec(state, now);
  r.tries += 1;
  return { bossId: t.id, seconds: TITAN.seconds, seed: 300 + new Date(now).getDay() * 10 + r.tries, maxHp: Math.max(1, bossHpForDay(state) * 1.6), event: 'titan', day: r.day, attempt: r.tries };
}
// Récompense seulement pour une meilleure tranche que celle déjà payée aujourd'hui.
export function finishTitan(state, setup, result, now = Date.now()) {
  const r = rec(state, now);
  const ratio = Math.min(1, (result?.damage ?? 0) / Math.max(1, setup.maxHp));
  const tier = titanTier(ratio);
  const paid = r.paid ? TITAN_TIERS.findIndex((x) => x.id === r.paid) : TITAN_TIERS.length;
  const idx = TITAN_TIERS.indexOf(tier);
  let given = null;
  if (idx < paid) { given = grantReward(state, tier.reward); r.paid = tier.id; }
  r.best = Math.max(r.best, result?.damage ?? 0);
  r.ratio = Math.max(r.ratio, ratio);
  return { titan: true, tier: tier.label, ratio, damage: result?.damage ?? 0, given, triesLeft: titanTriesLeft(state, now) };
}
