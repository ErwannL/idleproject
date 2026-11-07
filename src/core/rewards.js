// Récompenses génériques (contrats, maîtrise, événements, donjons) : or, gemmes, clés, fragments et éclats.
// v9.1.3 (lot E) : plus de tickets ; une récompense « tickets » (ancienne donnée) est versée en gemmes au taux TICKET_GEMS.
import { addGold } from './economy.js';
import { ESSENCE_SHARDS, TICKET_GEMS } from '../data/balance.js';
import { WALLET_KEYS } from '../data/economy.js';
import { addWallet } from './wallet.js';

const LABELS = {
  gold: 'or', gems: 'gemmes', keys: 'clé(s)', fragments: 'fragments', shards: 'éclats',
  // v9.2.8 : monnaies de l'économie (tickets, fragments SSR universels, écus d'événement), dans state.economy.wallet.
  ticketLimited: 'ticket(s) limité(s)', ticketPermanent: 'ticket(s) permanent(s)', ticketPet: 'ticket(s) familier(s)',
  ssrFragment: 'fragment(s) SSR universel(s)', eventCoins: 'écus',
};

export function grantReward(state, reward) {
  const given = {};
  for (const [k0, raw0] of Object.entries(reward ?? {})) {
    // v9.1.3 : anciennes monnaies (donnée en cours au moment de la mise à jour) versées au taux de conversion.
    const key = k0 === 'tickets' ? 'gems' : k0 === 'essence' ? 'shards' : k0;
    const value = Math.floor(k0 === 'tickets' ? raw0 * TICKET_GEMS : k0 === 'essence' ? raw0 * ESSENCE_SHARDS : raw0);
    if (!(value > 0)) continue;
    if (key === 'gold') given.gold = addGold(state, value);
    else if (key === 'shards') state.materials.shards += value;
    else if (WALLET_KEYS.includes(key)) addWallet(state, key, value); // v9.2.8
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
