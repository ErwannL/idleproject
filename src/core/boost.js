// Bonus temporaires automatiques :
// - démarrage rapide : pendant les 5 premières heures de jeu actif, tout va beaucoup plus vite
//   (or, XP, butin, événements, tickets d'invocation), puis le bonus décroît jusqu'à 1 ;
// - week-end : ×2 du samedi 0 h au lundi 0 h (heure locale), cumulable avec le démarrage rapide.
import { BALANCE } from '../data/balance.js';

// Part du bonus de démarrage restante : 1 au tout début, 0 après la durée prévue.
export function boostRemaining(state, balance = BALANCE) {
  const total = balance.earlyBoost.hours * 3600;
  return Math.max(0, 1 - (state.playSeconds ?? 0) / total);
}

export function isWeekend(now = Date.now()) {
  const day = new Date(now).getDay();
  return day === 0 || day === 6;
}

// Secondes avant la fin du week-end (lundi 0 h), 0 en semaine.
export function weekendSecondsLeft(now = Date.now()) {
  if (!isWeekend(now)) return 0;
  const d = new Date(now);
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + (d.getDay() === 6 ? 2 : 1));
  return Math.max(0, (monday.getTime() - now) / 1000);
}

export function earlyBoost(state, balance = BALANCE, now = Date.now()) {
  const r = boostRemaining(state, balance);
  const b = balance.earlyBoost;
  const weekend = isWeekend(now);
  const cheatLeft = Math.max(0, ((state.cheats?.boostUntil ?? 0) - now) / 1000);
  const cheat = cheatLeft > 0 ? state.cheats.boostMultiplier : 1;
  const w = (weekend ? balance.weekendBoost.multiplier : 1) * cheat;
  return {
    remaining: r,
    secondsLeft: Math.max(0, b.hours * 3600 - (state.playSeconds ?? 0)),
    weekend,
    weekendSecondsLeft: weekendSecondsLeft(now),
    cheat,
    cheatSecondsLeft: cheatLeft,
    gold: (1 + (b.goldMultiplier - 1) * r) * w,
    xp: (1 + (b.xpMultiplier - 1) * r) * w,
    // Ajouté à la chance de butin (0..1) ; le week-end double la chance de base.
    dropChance: b.extraDropChance * r + (weekend ? balance.loot.dropChance : 0) + (cheat > 1 ? 0.5 : 0),
    events: (1 + (b.eventMultiplier - 1) * r) * w,
    bossTickets: r > 0 ? b.bossTickets : 0,
  };
}
