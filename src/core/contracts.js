import { formatNumber } from './format.js';
// Contrats d'aventure : 3 objectifs actifs qui progressent automatiquement.
import { CONTRACT_COUNT, CONTRACT_TYPES, RARE_CONTRACT } from '../data/contracts.js';
import { BALANCE } from '../data/balance.js';
import { levelForStage, referenceKillGold } from './combat.js'; // v9.2.0 (monde marin) : niveau des étapes
import { trackMissions } from './missions.js';
import { grantReward } from './rewards.js';

export function newContract(state, rng, balance = BALANCE) {
  const active = new Set(state.contracts.map((c) => c.type));
  const types = Object.keys(CONTRACT_TYPES).filter((t) => !active.has(t));
  const type = types[Math.floor(rng.next() * types.length)] ?? 'kills';
  const def = CONTRACT_TYPES[type];
  const rare = rng.next() < RARE_CONTRACT.chance;
  const base = Math.max(1, Math.round(def.amount(state, { killGold: referenceKillGold(levelForStage(state.maxStage, balance), balance) })));
  const target = rare ? base * RARE_CONTRACT.targetMultiplier : base;
  const reward = Object.fromEntries(Object.entries(def.reward).map(([k, v]) => [k, rare ? v * RARE_CONTRACT.rewardMultiplier : v]));
  if (rare) for (const [k, v] of Object.entries(RARE_CONTRACT.bonus)) reward[k] = (reward[k] ?? 0) + v;
  state.nextContractId += 1;
  return { id: state.nextContractId, type, target, progress: 0, reward, rare };
}

export function ensureContracts(state, rng, balance = BALANCE) {
  while (state.contracts.length < CONTRACT_COUNT) state.contracts.push(newContract(state, rng, balance));
}

export function trackContracts(state, type, amount = 1) {
  trackMissions(state, type, amount);
  for (const c of state.contracts) {
    if (c.type === type && c.progress < c.target) c.progress = Math.min(c.target, c.progress + amount);
  }
}

export function claimContract(state, id, rng, balance = BALANCE) {
  const index = state.contracts.findIndex((c) => c.id === id);
  const contract = state.contracts[index];
  if (!contract || contract.progress < contract.target) return null;
  const given = grantReward(state, contract.reward);
  state.records.contractsDone += 1;
  state.contracts.splice(index, 1, newContract(state, rng, balance));
  return given;
}

export function contractTitle(contract) {
  return `${contract.rare ? 'Contrat rare · ' : ''}${CONTRACT_TYPES[contract.type].title}`;
}

export function contractLabel(contract) {
  return CONTRACT_TYPES[contract.type].label(formatNumber(contract.target)); // v9.11 (7) : jamais de nombre brut
}
