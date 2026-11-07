// Rentabilité des améliorations (v9.1.0) : dégâts par seconde gagnés par pièce d'or, pour le prochain niveau.
// Seules les lignes qui changent les dégâts ont un score (PV, armure, régénération et or n'en ont pas : ni
// conseil ni achat automatique pour elles). Calcul à la demande, gardé en cache tant que rien ne change.
import { BALANCE } from '../data/balance.js';
import { computeHeroStats } from './stats.js';
import { upgradeCost } from './economy.js';

export const DPS_UPGRADES = ['damage', 'attackSpeed', 'crit', 'critDamage', 'doubleAttack']; // v9.2.0 : + Dégâts critiques · v9.2.8 : + Double attaque

let cache = { key: '', value: null };
const stateKey = (state) => `${JSON.stringify(state.upgrades)}|${Object.values(state.equipment).map((i) => i?.id).join()}|${state.level}|${state.heroClass}|${Object.keys(state.talents).length}|${state.companions.equipped.join()}|${state.equippedPowers.join()}|${state.rebirthPower ?? 0}`;

// { key: { gain, cost, score } } pour chaque amélioration de dégâts encore achetable.
export function upgradeProfits(state, balance = BALANCE) {
  const key = stateKey(state);
  if (cache.key === key && cache.balance === balance) return cache.value;
  const base = computeHeroStats(state, balance).dps;
  const out = {};
  for (const k of DPS_UPGRADES) {
    const up = balance.upgrades[k];
    const level = state.upgrades[k];
    if (up.maxLevel !== undefined && level >= up.maxLevel) continue;
    const cost = upgradeCost(k, level, balance);
    const next = computeHeroStats({ ...state, upgrades: { ...state.upgrades, [k]: level + 1 } }, balance).dps;
    const gain = Math.max(0, next - base);
    out[k] = { gain, cost, score: gain / Math.max(1, cost), pct: base > 0 ? (gain / base) * 100 : 0 };
  }
  cache = { key, balance, value: out };
  return out;
}

// La plus rentable (meilleur gain de dégâts/s par or), abordable ou non : { key, gain, cost, score } ou null.
export function bestUpgrade(state, balance = BALANCE) {
  let best = null;
  for (const [k, p] of Object.entries(upgradeProfits(state, balance))) {
    if (p.gain > 0 && (!best || p.score > best.score)) best = { key: k, ...p };
  }
  return best;
}

// « Acheter le plus rentable » : achète niveau par niveau la ligne la plus rentable tant que l'or suffit.
// `budget` limite l'or dépensé (Infinity = tout). Renvoie { bought: { key: niveaux }, spent, dpsBefore, dpsAfter }.
export function buyMostProfitable(state, balance = BALANCE, budget = Infinity, maxSteps = 4000) {
  const dpsBefore = computeHeroStats(state, balance).dps;
  const bought = {};
  let spent = 0;
  for (let i = 0; i < maxSteps; i++) {
    const best = bestUpgrade(state, balance);
    if (!best || best.cost > state.gold || spent + best.cost > budget) break;
    state.gold -= best.cost;
    spent += best.cost;
    state.upgrades[best.key] += 1;
    bought[best.key] = (bought[best.key] ?? 0) + 1;
  }
  return { bought, spent, dpsBefore, dpsAfter: computeHeroStats(state, balance).dps };
}
