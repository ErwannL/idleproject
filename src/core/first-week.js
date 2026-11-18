// v9.8 (H5) : Carnet des 7 premiers jours — 3 petites quêtes par jour (un jour s'ouvre par jour réel depuis la création
// de la partie), le gros lot annoncé dès le 1er jour : un compagnon Épique au choix. Les quêtes ne demandent que des
// systèmes déjà ouverts ce jour-là (pas plus d'un nouveau système par jour).
import { grantReward } from './rewards.js';

const DAY = 86_400_000;
const sum = (o) => Object.values(o ?? {}).reduce((a, n) => a + (n || 0), 0);
const best = (s) => Math.max(s.maxStage ?? 1, s.records?.bestStage ?? 1);
export const FIRST_WEEK_PRIZE = ['rose_blade', 'witch', 'elf_archer', 'high_priest', 'ninja', 'barbarian'];
export const FIRST_WEEK = [
  { day: 1, reward: { gems: 50 }, quests: [['Bats 50 monstres', (s) => (s.records?.kills ?? 0) >= 50], ['Achète 5 améliorations', (s) => sum(s.upgrades) >= 5], ['Équipe un objet', (s) => (s.records?.equips ?? 0) >= 1]] },
  { day: 2, reward: { gems: 60 }, quests: [['Atteins l\'étape 1-10', (s) => best(s) >= 10], ['Atteins le niveau 8', (s) => (s.level ?? 1) >= 8], ['Bats 2 boss', (s) => (s.records?.bossesDefeated ?? 0) >= 2]] },
  { day: 3, reward: { gems: 70, keys: 1 }, quests: [['Termine le monde 1', (s) => best(s) >= 21], ['Achète 30 améliorations', (s) => sum(s.upgrades) >= 30], ['Bats 500 monstres', (s) => (s.records?.kills ?? 0) >= 500]] },
  { day: 4, reward: { gems: 80 }, quests: [['Fais 3 invocations', (s) => (s.records?.summons ?? 0) >= 3], ['Atteins le niveau 20', (s) => (s.level ?? 1) >= 20], ['Recycle 10 objets', (s) => (s.records?.recycled ?? 0) >= 10]] },
  { day: 5, reward: { gems: 90, shards: 50 }, quests: [['Atteins l\'étape 2-10', (s) => best(s) >= 30], ['Bats 10 boss', (s) => (s.records?.bossesDefeated ?? 0) >= 10], ['Achète 80 améliorations', (s) => sum(s.upgrades) >= 80]] },
  { day: 6, reward: { gems: 100, keys: 2 }, quests: [['Termine le monde 2', (s) => best(s) >= 41], ['Atteins le niveau 35', (s) => (s.level ?? 1) >= 35], ['Bats 3 000 monstres', (s) => (s.records?.kills ?? 0) >= 3000]] },
  { day: 7, reward: { gems: 150 }, quests: [['Atteins l\'étape 3-5', (s) => best(s) >= 45], ['Bats 20 boss', (s) => (s.records?.bossesDefeated ?? 0) >= 20], ['Atteins le niveau 45', (s) => (s.level ?? 1) >= 45]] },
];

function rec(state) { state.firstWeek ??= { claimed: [], prize: null }; return state.firstWeek; }
// Jours ouverts (1 à 7) : un par jour réel depuis la création ; une ancienne partie n'a pas de carnet.
export function firstWeekDaysOpen(state, now = Date.now()) {
  if (!state.unlocks || state.unlocks.legacy || !(state.createdAt > 1e12)) return 0;
  return Math.max(1, Math.min(7, Math.floor((now - state.createdAt) / DAY) + 1));
}
export function firstWeekActive(state, now = Date.now()) {
  return firstWeekDaysOpen(state, now) > 0 && !rec(state).prize;
}
export function firstWeekDay(state, d) {
  const day = FIRST_WEEK[d - 1];
  return { ...day, steps: day.quests.map(([text, test]) => ({ text, done: Boolean(test(state)) })), claimed: rec(state).claimed.includes(d) };
}
export function claimFirstWeekDay(state, d, now = Date.now()) {
  if (d > firstWeekDaysOpen(state, now)) return null;
  const day = firstWeekDay(state, d);
  if (day.claimed || !day.steps.every((x) => x.done)) return null;
  rec(state).claimed.push(d);
  return grantReward(state, day.reward);
}
export function prizeReady(state) { return rec(state).claimed.length >= 7 && !rec(state).prize; }
export function claimPrize(state, companionId) {
  if (!prizeReady(state) || !FIRST_WEEK_PRIZE.includes(companionId)) return false;
  rec(state).prize = companionId;
  const o = state.companions.owned[companionId];
  if (o) o.stars = Math.min(5, (o.stars ?? 1) + 1); else state.companions.owned[companionId] = { stars: 1, level: 1 };
  return true;
}

// v9.9 (K9) : piste de paliers (une mission faite = 1 point) avec récompenses visibles ; « Tout récupérer ».
export const FIRST_WEEK_MILES = [{ at: 5, reward: { gems: 50 } }, { at: 10, reward: { keys: 1, shards: 30 } }, { at: 15, reward: { gems: 100 } }, { at: 21, reward: { gems: 150, keys: 2 } }];
export function firstWeekPoints(state, now = Date.now()) {
  const open = firstWeekDaysOpen(state, now);
  let n = 0;
  for (let d = 1; d <= open; d++) n += firstWeekDay(state, d).steps.filter((x) => x.done).length;
  return n;
}
export function claimFirstWeekAll(state, now = Date.now()) {
  const got = {};
  const add = (r) => { for (const [k, v] of Object.entries(r ?? {})) got[k] = (got[k] ?? 0) + v; };
  for (let d = 1; d <= firstWeekDaysOpen(state, now); d++) add(claimFirstWeekDay(state, d, now));
  const pts = firstWeekPoints(state, now);
  const r = rec(state);
  r.miles ??= [];
  for (const m of FIRST_WEEK_MILES) if (pts >= m.at && !r.miles.includes(m.at)) { r.miles.push(m.at); add(grantReward(state, m.reward)); }
  return Object.keys(got).length ? got : null;
}
export function firstWeekDaysLeft(state, now = Date.now()) {
  return Math.max(0, Math.ceil(((state.createdAt ?? now) + 7 * DAY - now) / DAY));
}
