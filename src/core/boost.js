// Bonus temporaires automatiques :
// - démarrage rapide : pendant les 5 premières heures de jeu actif, tout va beaucoup plus vite
//   (or, XP, butin, événements, gemmes des boss), puis le bonus décroît jusqu'à 1 ;
// - week-end : ×2 du samedi 0 h au lundi 0 h (heure locale), cumulable avec le démarrage rapide.
import { blessingMult } from './blessing.js';
import { BALANCE } from '../data/balance.js';
import { cheatLoot, cheatMultiplier } from './cheats.js';

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

// v9.6.5 (10.10) : bonus de rattrapage. Après 3 jours ou plus d'absence, or/XP/événements ×1,5 pendant 2 h de jeu
// (ouverture suivante : startCatchUp, appelé au chargement avec la date de dernière sauvegarde).
export const CATCH_UP = { minDays: 3, mult: 1.5, seconds: 2 * 3600 };
export function startCatchUp(state, lastSaved, now = Date.now()) {
  if (!Number.isFinite(lastSaved) || now - lastSaved < CATCH_UP.minDays * 86400e3) return false;
  state.catchUpUntil = (state.playSeconds ?? 0) + CATCH_UP.seconds;
  return true;
}
export function catchUpMult(state) {
  return (state.catchUpUntil ?? 0) > (state.playSeconds ?? 0) ? CATCH_UP.mult : 1;
}

export function earlyBoost(state, balance = BALANCE, now = Date.now()) {
  const r = boostRemaining(state, balance);
  const b = balance.earlyBoost;
  const weekend = isWeekend(now);
  // Codes de triche : multiplicateurs cumulés (×100 puis ×100 = ×10 000).
  const cheat = cheatMultiplier(state, 'boost');
  const w = (weekend ? balance.weekendBoost.multiplier : 1) * cheat * catchUpMult(state, now);
  return {
    remaining: r,
    secondsLeft: Math.max(0, b.hours * 3600 - (state.playSeconds ?? 0)),
    weekend,
    weekendSecondsLeft: weekendSecondsLeft(now),
    cheat,
    gold: (1 + (b.goldMultiplier - 1) * r) * w * blessingMult(state, 'gold'), // v9.7.1 : bénédiction Fortune
    xp: (1 + (b.xpMultiplier - 1) * r) * w,
    // Ajouté à la chance de butin (0..1) ; le week-end double la chance de base.
    dropChance: b.extraDropChance * r + (weekend ? balance.loot.dropChance : 0) + (cheat > 1 ? 0.5 : 0) + cheatLoot(state).drop,
    events: (1 + (b.eventMultiplier - 1) * r) * w,
    bossGems: r > 0 ? b.bossGems : 0,
  };
}
