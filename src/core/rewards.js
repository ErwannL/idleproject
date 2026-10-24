// Récompenses génériques (contrats, maîtrise, événements, donjons) : or, gemmes, tickets,
// clés, fragments et matériaux.
import { addGold } from './economy.js';

const LABELS = {
  gold: 'or', gems: 'gemmes', tickets: 'ticket(s)', keys: 'clé(s)', fragments: 'fragments', shards: 'éclats', essence: 'essence(s)',
};

export function grantReward(state, reward) {
  const given = {};
  for (const [key, raw] of Object.entries(reward ?? {})) {
    const value = Math.floor(raw);
    if (!(value > 0)) continue;
    if (key === 'gold') given.gold = addGold(state, value);
    else if (key === 'shards' || key === 'essence') state.materials[key] += value;
    else if (key in LABELS) state[key] += value;
    else continue;
    given[key] ??= value;
  }
  return given;
}

export function rewardText(reward, format = (n) => String(n)) {
  return Object.entries(reward ?? {})
    .filter(([k, v]) => v > 0 && k in LABELS)
    .map(([k, v]) => `+${format(Math.floor(v))} ${LABELS[k]}`)
    .join(' · ');
}
