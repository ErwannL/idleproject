// Bonus de démarrage : pendant les 5 premières heures de jeu actif, tout va
// beaucoup plus vite (or, XP, butin, événements, tickets d'invocation), puis le bonus décroît jusqu'à 1.
import { BALANCE } from '../data/balance.js';

// Part du bonus restante : 1 au tout début, 0 après la durée prévue.
export function boostRemaining(state, balance = BALANCE) {
  const total = balance.earlyBoost.hours * 3600;
  return Math.max(0, 1 - (state.playSeconds ?? 0) / total);
}

export function earlyBoost(state, balance = BALANCE) {
  const r = boostRemaining(state, balance);
  const b = balance.earlyBoost;
  return {
    remaining: r,
    secondsLeft: Math.max(0, b.hours * 3600 - (state.playSeconds ?? 0)),
    gold: 1 + (b.goldMultiplier - 1) * r,
    xp: 1 + (b.xpMultiplier - 1) * r,
    dropChance: b.extraDropChance * r, // ajouté à la chance de butin (0..1)
    events: 1 + (b.eventMultiplier - 1) * r,
    bossTickets: r > 0 ? b.bossTickets : 0,
  };
}
