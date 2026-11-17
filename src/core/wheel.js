// v9.8 (H4) : Roue du jour — 1 tour gratuit par jour, sans pub, toujours gagnant, petite chance de gros lot.
// Elle remplace le calendrier de connexion (même place : fenêtre à l'ouverture, Carnet du jour).
import { grantReward } from './rewards.js';
import { dayKey } from './tower.js';
import { referenceKillGold, levelForStage } from './combat.js';

// poids, récompense (l'or est en « ennemis de l'étape max », comme les autres récompenses d'or).
export const WHEEL_SLICES = [
  { id: 'gold', w: 26, label: 'Or', reward: (s) => ({ gold: 400 * killGold(s) }) },
  { id: 'gems', w: 20, label: 'Gemmes', reward: () => ({ gems: 30 }) },
  { id: 'shards', w: 18, label: 'Éclats', reward: () => ({ shards: 25 }) },
  { id: 'keys', w: 12, label: 'Clé', reward: () => ({ keys: 1 }) },
  { id: 'grimoire', w: 10, label: 'Grimoires', reward: () => ({ grimoire: 3 }) },
  { id: 'gold2', w: 10, label: 'Gros sac d\'or', reward: (s) => ({ gold: 1200 * killGold(s) }) },
  { id: 'fragments', w: 3, label: 'Fragments', reward: () => ({ fragments: 15 }) },
  { id: 'jackpot', w: 1, label: 'Gros lot', reward: () => ({ gems: 300, keys: 3 }), jackpot: true },
];
function killGold(state) { return referenceKillGold(levelForStage(Math.max(state.maxStage ?? 1, 1))); }

export function wheelReady(state, now = Date.now()) { return state.wheel?.day !== dayKey(now); }

// Tire une part (rng.next() dans [0, 1)), donne la récompense, renvoie { index, slice, given }.
export function spinWheel(state, rng, now = Date.now()) {
  if (!wheelReady(state, now)) return null;
  const total = WHEEL_SLICES.reduce((t, s) => t + s.w, 0);
  let x = rng.next() * total;
  let index = WHEEL_SLICES.findIndex((s) => (x -= s.w) < 0);
  if (index < 0) index = 0;
  const slice = WHEEL_SLICES[index];
  const given = grantReward(state, slice.reward(state));
  state.wheel = { day: dayKey(now), last: slice.id, spins: (state.wheel?.spins ?? 0) + 1 };
  return { index, slice, given };
}
