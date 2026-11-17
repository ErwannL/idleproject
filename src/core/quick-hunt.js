// v9.8 (H3) : Chasse rapide — une fois par jour, gratuite, 2 h de gains hors ligne tout de suite (sans pub).
import { BALANCE } from '../data/balance.js';
import { computeOfflineRewards, applyOfflineRewards } from './offline.js';
import { dayKey } from './tower.js';

export const QUICK_HUNT = { hours: 2, perDay: 1 };

export function quickHuntReady(state, now = Date.now()) {
  return (state.quickHunt?.day !== dayKey(now) ? 0 : state.quickHunt.used ?? 0) < QUICK_HUNT.perDay;
}

// Renvoie le résumé (comme un retour hors ligne, sans le temps passé), ou null si déjà faite aujourd'hui.
export function quickHunt(state, rng, now = Date.now(), balance = BALANCE) {
  if (!quickHuntReady(state, now)) return null;
  const day = dayKey(now);
  const rewards = computeOfflineRewards(state, now - QUICK_HUNT.hours * 3600 * 1000, now, rng, balance);
  rewards.elapsedSeconds = 0; // ce n'est pas du temps d'absence (statistiques)
  const summary = applyOfflineRewards(state, rewards, balance);
  state.quickHunt = { day, used: (state.quickHunt?.day === day ? state.quickHunt.used ?? 0 : 0) + 1 };
  return { ...summary, hours: QUICK_HUNT.hours };
}
