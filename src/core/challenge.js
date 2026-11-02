// Défi de la semaine (v8.5) : des vagues d'ennemis de plus en plus fortes dans un monde tiré au sort,
// avec des règles (modificateurs) qui changent chaque lundi. Score = vagues franchies ; on se mesure à
// ses propres records (meilleur de la semaine, record absolu, semaines passées).
// Trois tentatives par semaine ; une défaite termine la tentative.
import { ZONES } from '../data/zones.js';
import { weekKey } from './tower.js';
import { grantReward } from './rewards.js';

// Étape 5 : calendrier de déblocages étalé (Donjons 25, Renaissance 30, Défi 45, Tour 60) — avant, tout arrivait entre 25 et 40.
export const CHALLENGE = { unlockStage: 45, triesPerWeek: 3, killsPerWave: 8, bossEvery: 5, levelPerWave: 2, history: 8, modifiers: 3, waveSeconds: 90 };

// Règles possibles. Chaque semaine en tire 3 (dont au moins une favorable quand c'est possible).
export const CHALLENGE_MODIFIERS = [
  { id: 'tough', name: 'Peau de pierre', text: 'PV des ennemis ×2', enemyHp: 2 },
  { id: 'fierce', name: 'Férocité', text: 'Dégâts des ennemis ×1,6', enemyDamage: 1.6 },
  { id: 'swift', name: 'Frénésie', text: 'Les ennemis attaquent 30 % plus vite', enemyAttackSpeed: 1.3 },
  { id: 'swarm', name: 'Nuée', text: 'Des ennemis deux fois plus nombreux', spawnRate: 2 },
  { id: 'noheal', name: 'Sans soin', text: 'Ni régénération ni vol de vie', noHeal: true },
  { id: 'glass', name: 'Canon de verre', text: 'PV du héros ×0,5, dégâts du héros ×1,5', heroHp: 0.5, heroDamage: 1.5 },
  { id: 'giants', name: 'Géants', text: 'Un boss toutes les 3 vagues', bossEvery: 3 },
  { id: 'enraged', name: 'Rage', text: 'Les boss enragent tout de suite', instantRage: true },
  { id: 'treasure', name: 'Pluie d\'or', text: 'Or ×3', gold: 3, good: true },
  { id: 'blessing', name: 'Bénédiction', text: 'Dégâts et PV du héros ×1,3', heroHp: 1.3, heroDamage: 1.3, good: true },
];

// Petit hachage déterministe d'une chaîne (même semaine = mêmes règles pour tout le monde).
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

// Règles et monde de la semaine.
export function weeklySetup(week = weekKey()) {
  let h = hash(`defi:${week}`);
  const next = (n) => { h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0; return h % n; };
  const hard = CHALLENGE_MODIFIERS.filter((m) => !m.good);
  const good = CHALLENGE_MODIFIERS.filter((m) => m.good);
  const mods = [good[next(good.length)].id];
  while (mods.length < CHALLENGE.modifiers) {
    const m = hard[next(hard.length)].id;
    if (!mods.includes(m)) mods.push(m);
  }
  const worlds = ZONES.filter((z) => !z.gauntlet).length;
  return { week, mods, zone: next(worlds) };
}

export function modifierById(id) {
  return CHALLENGE_MODIFIERS.find((m) => m.id === id);
}

// Valeur d'une règle du défi en cours (produit des modificateurs actifs ; `true` pour les règles oui/non).
export function challengeRule(state, key) {
  const run = state.challenge;
  if (!run) return null;
  let out = null;
  for (const id of run.mods) {
    const v = modifierById(id)?.[key];
    if (v === undefined) continue;
    out = typeof v === 'number' ? (out ?? 1) * v : v;
  }
  return out;
}

export function challengeUnlocked(state) {
  // Une partie qui a déjà joué le défi le garde.
  return state.maxStage >= CHALLENGE.unlockStage || (state.challengeBest ?? 0) > 0 || Boolean(state.challenge);
}

// Semaine en cours : remise à zéro le lundi ; la semaine terminée rejoint l'historique.
export function challengeWeek(state, now = Date.now()) {
  const key = weekKey(now);
  const w = state.challengeWeek;
  if (w?.week !== key) {
    if (w && w.best > 0) {
      state.challengeHistory = [{ week: w.week, best: w.best, mods: w.mods ?? [] }, ...(state.challengeHistory ?? [])].slice(0, CHALLENGE.history);
    }
    state.challengeWeek = { week: key, best: 0, tries: 0, extra: 0, mods: weeklySetup(key).mods };
  }
  return state.challengeWeek;
}

export function challengeTriesLeft(state, now = Date.now()) {
  const w = challengeWeek(state, now);
  return Math.max(0, CHALLENGE.triesPerWeek + (w.extra ?? 0) - w.tries);
}

export function challengeLevel(state, wave) {
  return Math.max(20, Math.round(state.maxStage * 0.7)) + wave * CHALLENGE.levelPerWave;
}

export function bossEvery(state) {
  return challengeRule(state, 'bossEvery') ?? CHALLENGE.bossEvery;
}

export function isBossWave(state, wave = state.challenge?.wave ?? 1) {
  return wave % bossEvery(state) === 0;
}

// Boss d'une vague : mini, moyen, dur… puis le méga boss du monde toutes les 4 vagues de boss.
export function challengeBosses(state) {
  const zone = ZONES[state.challenge.zone];
  const n = Math.floor(state.challenge.wave / bossEvery(state));
  if (n % 4 === 0) return zone.bosses;
  const tiers = Object.values(zone.tierBosses ?? {});
  return tiers.length ? [tiers[(n - 1) % tiers.length]] : zone.bosses;
}

export function startChallenge(state, now = Date.now()) {
  if (!challengeUnlocked(state) || state.dungeon || state.tower || state.challenge || challengeTriesLeft(state, now) <= 0) return false;
  const week = challengeWeek(state, now);
  const setup = weeklySetup(week.week);
  week.tries += 1;
  state.challenge = { wave: 1, kills: 0, time: 0, startPlay: state.playSeconds ?? 0, mods: setup.mods, zone: setup.zone, week: week.week };
  return true;
}

// Récompenses : à chaque nouveau meilleur score de la semaine, et (une fois) à chaque record absolu.
export function weeklyChallengeReward(wave) {
  return { gems: 4 + wave, fragments: wave % 5 === 0 ? Math.ceil(wave / 2) : 0, keys: wave % 10 === 0 ? 1 : 0 };
}
export function recordChallengeReward(wave) {
  return { gems: 10 + wave * 2 + (wave % 10 === 0 ? 100 : 0) }; // v9.1.3 : ancien ticket = 100 gemmes
}

// Chaque vague a 90 s : un boss impossible à tuer (mais qui ne tue pas le héros) termine la tentative.
export function challengeTimeUp(state, dt) {
  const run = state.challenge;
  run.time = (run.time ?? 0) + dt;
  return run.time > CHALLENGE.waveSeconds;
}

// Ennemi ordinaire vaincu : renvoie le résultat de la vague si elle est franchie.
export function challengeKill(state) {
  const run = state.challenge;
  run.kills += 1;
  return run.kills >= CHALLENGE.killsPerWave ? clearChallengeWave(state) : null;
}

export function clearChallengeWave(state) {
  const run = state.challenge;
  const wave = run.wave;
  const week = challengeWeek(state);
  const reward = {};
  const add = (r) => { for (const [k, v] of Object.entries(grantReward(state, r))) reward[k] = (reward[k] ?? 0) + v; };
  const weekly = wave > week.best;
  const record = wave > (state.challengeBest ?? 0);
  if (weekly) { add(weeklyChallengeReward(wave)); week.best = wave; }
  if (record) { add(recordChallengeReward(wave)); state.challengeBest = wave; }
  run.wave += 1;
  run.kills = 0;
  run.time = 0;
  return { wave, weekly, record, reward };
}

export function endChallenge(state) {
  const run = state.challenge;
  if (!run) return null;
  state.challengeLast = {
    waves: run.wave - 1, seconds: Math.max(0, Math.round((state.playSeconds ?? 0) - (run.startPlay ?? 0))), at: Date.now(),
  };
  state.challenge = null;
  return state.challengeLast;
}

export function sanitizeChallenge(state, raw) {
  const int = (v, min = 0) => (Number.isInteger(v) && v >= min ? v : null);
  const ids = (list) => (Array.isArray(list) ? list.filter((id) => modifierById(id)).slice(0, CHALLENGE.modifiers) : []);
  const run = raw.challenge;
  state.challenge = run && int(run.wave, 1) && ids(run.mods).length && int(run.zone) !== null && ZONES[run.zone]
    ? { wave: run.wave, kills: Math.min(int(run.kills) ?? 0, CHALLENGE.killsPerWave), time: Math.min(CHALLENGE.waveSeconds, Math.max(0, Number(run.time) || 0)), startPlay: Number(run.startPlay) || 0, mods: ids(run.mods), zone: run.zone, week: String(run.week ?? '') }
    : null;
  const w = raw.challengeWeek;
  state.challengeWeek = w && typeof w.week === 'string'
    ? { week: w.week.slice(0, 10), best: int(w.best) ?? 0, tries: int(w.tries) ?? 0, extra: int(w.extra) ?? 0, mods: ids(w.mods) }
    : null;
  state.challengeBest = int(raw.challengeBest) ?? 0;
  state.challengeHistory = Array.isArray(raw.challengeHistory)
    ? raw.challengeHistory.filter((h) => h && typeof h.week === 'string' && int(h.best, 1)).slice(0, CHALLENGE.history)
      .map((h) => ({ week: h.week.slice(0, 10), best: h.best, mods: ids(h.mods) }))
    : [];
  const last = raw.challengeLast;
  state.challengeLast = last && int(last.waves) !== null ? { waves: last.waves, seconds: int(last.seconds) ?? 0, at: int(last.at) ?? 0 } : null;
}
