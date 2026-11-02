// Récompenses génériques (contrats, maîtrise, événements, donjons) : or, gemmes, clés, fragments et matériaux.
// v9.1.3 (lot E) : plus de tickets ; une récompense « tickets » (ancienne donnée) est versée en gemmes au taux TICKET_GEMS.
import { addGold } from './economy.js';
import { TICKET_GEMS } from '../data/balance.js';

const LABELS = {
  gold: 'or', gems: 'gemmes', keys: 'clé(s)', fragments: 'fragments', shards: 'éclats', essence: 'essence(s)',
};

export function grantReward(state, reward) {
  const given = {};
  for (const [k0, raw0] of Object.entries(reward ?? {})) {
    const key = k0 === 'tickets' ? 'gems' : k0;
    const value = Math.floor(k0 === 'tickets' ? raw0 * TICKET_GEMS : raw0);
    if (!(value > 0)) continue;
    if (key === 'gold') given.gold = addGold(state, value);
    else if (key === 'shards' || key === 'essence') state.materials[key] += value;
    else if (key in LABELS) state[key] += value;
    else continue;
    if (key !== 'gold') given[key] = (given[key] ?? 0) + value;
  }
  return given;
}

export function rewardText(reward, format = (n) => String(n)) {
  return Object.entries(reward ?? {})
    .filter(([k, v]) => v > 0 && k in LABELS)
    .map(([k, v]) => `+${format(Math.floor(v))} ${LABELS[k]}`)
    .join(' · ');
}
