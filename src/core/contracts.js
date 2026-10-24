// Contrats d'aventure : 3 objectifs actifs qui progressent automatiquement.
import { CONTRACT_COUNT, CONTRACT_TYPES } from '../data/contracts.js';
import { BALANCE } from '../data/balance.js';
import { referenceKillGold } from './combat.js';
import { grantReward } from './rewards.js';

export function newContract(state, rng, balance = BALANCE) {
  const active = new Set(state.contracts.map((c) => c.type));
  const types = Object.keys(CONTRACT_TYPES).filter((t) => !active.has(t));
  const type = types[Math.floor(rng.next() * types.length)] ?? 'kills';
  const def = CONTRACT_TYPES[type];
  const target = Math.max(1, Math.round(def.amount(state, { killGold: referenceKillGold(state.maxStage, balance) })));
  state.nextContractId += 1;
  return { id: state.nextContractId, type, target, progress: 0, reward: { ...def.reward } };
}

export function ensureContracts(state, rng, balance = BALANCE) {
  while (state.contracts.length < CONTRACT_COUNT) state.contracts.push(newContract(state, rng, balance));
}

export function trackContracts(state, type, amount = 1) {
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

export function contractLabel(contract) {
  return CONTRACT_TYPES[contract.type].label(contract.target);
}
