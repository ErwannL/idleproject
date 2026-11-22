// Or et améliorations achetables.
import { BALANCE } from '../data/balance.js';

// v10.8 (partie 2) : avec `state`, un niveau ne coûte jamais moins que PRICE_FLOOR ennemis de l'étape record (prix en
// « ennemis de l'étape », comme le Bastion) : en fin de jeu, plus d'amélioration à 40 d'or pour 6e14 d'or en réserve.
export const PRICE_FLOOR = 60; // ≈ 1 minute de combat (3 ennemis toutes les 1,4 s, une partie du temps en marche)
export function killGoldAt(stage, balance = BALANCE) {
  return Math.max(1, Math.round(4 * balance.enemyScaling.goldGrowth ** Math.max(0, stage - 1)));
}
export function upgradeCost(key, level, balance = BALANCE, state = null) {
  const upgrade = balance.upgrades[key];
  const raw = Math.floor(upgrade.baseCost * Math.pow(upgrade.costGrowth, level));
  if (!state || Math.max(state.maxStage ?? 1, state.records?.bestStage ?? 1) <= 60) return raw; // les 3 premiers mondes ne changent pas
  const best = Math.max(state.maxStage ?? 1, state.records?.bestStage ?? 1);
  return Math.max(raw, Math.floor(PRICE_FLOOR * killGoldAt(best, balance)));
}

export function buyUpgrade(state, key, balance = BALANCE) {
  if (!(key in balance.upgrades) || balance.upgrades[key].retired) return false; // v9.3.9 : Peau de fer n'est plus achetable
  const cap = balance.upgrades[key].maxLevel ?? Infinity;
  if (state.upgrades[key] >= cap) return false;
  const cost = upgradeCost(key, state.upgrades[key], balance, state);
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
    const next = upgradeCost(key, start + n, balance, state);
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
