// Or et améliorations achetables.
import { BALANCE } from '../data/balance.js';

export function upgradeCost(key, level, balance = BALANCE) {
  const upgrade = balance.upgrades[key];
  return Math.floor(upgrade.baseCost * Math.pow(upgrade.costGrowth, level));
}

export function buyUpgrade(state, key, balance = BALANCE) {
  if (!(key in balance.upgrades) || balance.upgrades[key].retired) return false; // v9.3.9 : Peau de fer n'est plus achetable
  const cap = balance.upgrades[key].maxLevel ?? Infinity;
  if (state.upgrades[key] >= cap) return false;
  const cost = upgradeCost(key, state.upgrades[key], balance);
  if (state.gold < cost) return false;
  state.gold -= cost;
  state.upgrades[key] += 1;
  return true;
}

// Achat groupé : combien de niveaux acheter pour un choix ×1 / ×10 / ×100 / 'max', et leur coût total.
export function bulkPlan(state, key, amount, balance = BALANCE) {
  const up = balance.upgrades[key];
  const start = state.upgrades[key];
  const cap = up.maxLevel ?? Infinity;
  const limit = amount === 'max' ? Infinity : Number(amount) || 1;
  let n = 0;
  let cost = 0;
  while (n < limit && start + n < cap) {
    const next = upgradeCost(key, start + n, balance);
    if (amount === 'max' && cost + next > state.gold) break;
    cost += next;
    n += 1;
    if (n > 5000) break;
  }
  return { count: n, cost };
}

// Achète `amount` niveaux (ou le maximum abordable) ; tout ou rien pour ×10 / ×100.
export function buyUpgradeBulk(state, key, amount, balance = BALANCE) {
  if (!(key in balance.upgrades)) return 0;
  const { count, cost } = bulkPlan(state, key, amount, balance);
  if (count === 0 || state.gold < cost) return 0;
  state.gold -= cost;
  state.upgrades[key] += count;
  return count;
}

export function addGold(state, amount) {
  const gained = Math.max(0, Math.floor(amount));
  state.gold += gained;
  state.records.goldEarned += gained;
  return gained;
}

// v9.1.3 (A5) : paliers multiplicateurs (Dégâts, PV) — produit des paliers atteints en passant de `from` à `to`
// (cumul aux niveaux communs, ex. 50 : ×1,35 × ×1,75), et le prochain palier au-delà de `to`.
export function upgradeMilestones(key, from, to, balance = BALANCE) {
  const up = balance.upgrades[key];
  if (!up?.milestoneEvery) return null;
  const at = (lv) => (lv % up.milestoneEvery === 0 ? up.milestoneMultiplier : 1)
    * (up.bigMilestoneEvery && lv % up.bigMilestoneEvery === 0 ? up.bigMilestoneMultiplier : 1);
  let reached = 1;
  for (let lv = from + 1; lv <= to; lv++) reached *= at(lv);
  let nextLevel = to + 1;
  while (at(nextLevel) === 1) nextLevel += 1;
  return { reached, nextLevel, nextMult: at(nextLevel) };
}
