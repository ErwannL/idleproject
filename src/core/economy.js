// Or et améliorations achetables.
import { BALANCE } from '../data/balance.js';

export function upgradeCost(key, level, balance = BALANCE) {
  const upgrade = balance.upgrades[key];
  return Math.floor(upgrade.baseCost * Math.pow(upgrade.costGrowth, level));
}

export function buyUpgrade(state, key, balance = BALANCE) {
  if (!(key in balance.upgrades)) return false;
  const cost = upgradeCost(key, state.upgrades[key], balance);
  if (state.gold < cost) return false;
  state.gold -= cost;
  state.upgrades[key] += 1;
  return true;
}

export function addGold(state, amount) {
  const gained = Math.max(0, Math.floor(amount));
  state.gold += gained;
  state.records.goldEarned += gained;
  return gained;
}
