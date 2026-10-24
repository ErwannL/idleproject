// Niveau et expérience du héros.
import { BALANCE } from '../data/balance.js';

export function xpForLevel(level, balance = BALANCE) {
  return Math.floor(balance.level.xpBase * balance.level.xpGrowth ** (level - 1));
}

export function killXp(stage, boss, balance = BALANCE) {
  const l = balance.level;
  return l.killXp * l.killXpGrowth ** (stage - 1) * (boss ? l.bossXpMultiplier : 1);
}

// Ajoute de l'XP et renvoie le nombre de niveaux gagnés.
export function addXp(state, amount, balance = BALANCE) {
  if (!(amount > 0)) return 0;
  state.xp += amount;
  let gained = 0;
  while (state.level < balance.level.maxLevel && state.xp >= xpForLevel(state.level, balance)) {
    state.xp -= xpForLevel(state.level, balance);
    state.level += 1;
    gained += 1;
  }
  if (state.level >= balance.level.maxLevel) state.xp = 0;
  return gained;
}
