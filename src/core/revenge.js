// v9.7.1 (lot 4) : la revanche — fil conducteur sur des heures. À la fin de chaque monde, un court face-à-face avec le
// Colosse des Anciens (moteur des grands boss, fiche « colossus ») : on tient 10 s au monde 1, 30 s au monde 3, on lui
// casse un bras au monde 6, on le bat au monde 12. Chaque rencontre réussie donne une récompense et fait monter la
// jauge « Revanche ». Rien n'est perdu à l'échec : on peut retenter.
import { bossHpForDay } from './world-boss.js';

const survive = (world, seconds) => ({ world, goal: 'survive', seconds, text: `Tiens ${seconds} secondes face au Colosse` });
const clear = (world, part, text) => ({ world, goal: 'clear', clear: part, seconds: 45 + world * 1.5, text });
export const REVENGE = [
  survive(1, 10), survive(2, 20), survive(3, 30), survive(4, 35), survive(5, 40),
  clear(6, 0.33, 'Casse-lui un bras (un tiers de sa vie)'), clear(7, 0.4, 'Fais-le reculer (40 % de sa vie)'),
  clear(8, 0.5, 'Fais-le plier (la moitié de sa vie)'), clear(9, 0.6, 'Brise sa garde (60 % de sa vie)'),
  clear(10, 0.75, 'Fais-le tomber à genoux (75 % de sa vie)'), clear(11, 0.9, 'Presque… (90 % de sa vie)'),
  { world: 12, goal: 'clear', clear: 1, seconds: 60, text: 'Bats le Colosse des Anciens' },
];
export const REVENGE_STEPS = REVENGE.length;
const STAGES_PER_WORLD = 20;

export function revengeDone(state) { return state.revenge?.done ?? []; }
export function revengeLevel(state) { return revengeDone(state).length; }
// Prochaine rencontre ouverte : le plus petit monde terminé dont le face-à-face n'est pas encore réussi.
export function revengePending(state) {
  const best = Math.max(state.maxStage ?? 1, state.records?.bestStage ?? 1);
  return REVENGE.find((r) => best > r.world * STAGES_PER_WORLD && !revengeDone(state).includes(r.world)) ?? null;
}
export function revengeReward(r) { return { gems: 20 + r.world * 15 }; }

export function startRevenge(state, r = revengePending(state)) {
  if (!r) return null;
  // Barre de vie : « tenir » = immense (on ne gagne pas, on survit) ; « vider X % » = dégâts mesurés ÷ X (avec marge).
  const maxHp = r.goal === 'survive' ? 1e15 : Math.max(1, (bossHpForDay(state) * (r.seconds / 60)) / Math.max(0.2, r.clear) * 1.1);
  return { bossId: 'colossus', story: true, world: r.world, seconds: r.seconds, seed: 100 + r.world, maxHp, event: 'revenge', day: `revenge-${r.world}`, attempt: 1 };
}

export function finishRevenge(state, setup, result) {
  const r = REVENGE.find((x) => x.world === setup.world);
  if (!r) return null;
  const success = r.goal === 'survive' ? true : (result?.cleared ?? 0) >= r.clear;
  const reward = revengeReward(r);
  if (success && !revengeDone(state).includes(r.world)) {
    state.revenge = { done: [...revengeDone(state), r.world].sort((a, b) => a - b) };
    state.gems = (state.gems ?? 0) + reward.gems;
  }
  return { story: true, success, text: r.text, world: r.world, gems: success ? reward.gems : 0, level: revengeLevel(state), steps: REVENGE_STEPS, damage: result?.damage ?? 0 };
}
