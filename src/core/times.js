// Statistiques de temps (v9.1.7). Tout en secondes de jeu actif (le pas de combat), sauf `offline` (temps hors jeu
// crédité au retour). Indépendant de playSeconds, qui sert au boost et à l'anti-triche du serveur.
//   where : { 'monde:cycle': s } — temps passé sur la campagne par monde (index 0..10) et par cycle (1 = normal, 2 = ×2…)
//   modes : { campaign, dungeon, tower, challenge } — temps par activité
//   run / transcendRun : depuis la dernière Renaissance / Transcendance
//   rebirthRuns / transcendRuns : durées des dernières (au plus RUNS_KEPT), best* : la plus rapide
//   firstZone : { monde: playSeconds } — premier passage dans chaque monde (temps total de jeu à ce moment)
//   sessions / longestSession : lancements du jeu et plus longue séance ; session : séance en cours (non sauvegardée)
import { BALANCE } from '../data/balance.js';
import { ZONES } from '../data/zones.js';
import { cycleForStage, locateStage } from './combat.js';

export const RUNS_KEPT = 50;
export const TIME_MODES = ['campaign', 'dungeon', 'tower', 'challenge'];

export function emptyTimes() {
  return {
    where: {}, modes: { campaign: 0, dungeon: 0, tower: 0, challenge: 0 }, run: 0, transcendRun: 0,
    rebirthRuns: [], bestRebirth: 0, transcendRuns: [], bestTranscend: 0, firstZone: {}, offline: 0, sessions: 0, longestSession: 0, session: 0,
  };
}

const num = (v) => (Number.isFinite(v) && v >= 0 ? v : 0);

export function sanitizeTimes(raw) {
  const t = emptyTimes();
  if (!raw || typeof raw !== 'object') return t;
  for (const [k, v] of Object.entries(raw.where ?? {})) if (/^\d{1,2}:\d{1,4}$/.test(k) && num(v)) t.where[k] = v;
  for (const m of TIME_MODES) t.modes[m] = num(raw.modes?.[m]);
  for (const k of ['run', 'transcendRun', 'bestRebirth', 'bestTranscend', 'offline', 'longestSession']) t[k] = num(raw[k]);
  t.sessions = Number.isInteger(raw.sessions) && raw.sessions > 0 ? raw.sessions : 0;
  t.rebirthRuns = (Array.isArray(raw.rebirthRuns) ? raw.rebirthRuns : []).filter((v) => num(v) > 0).slice(-RUNS_KEPT);
  t.transcendRuns = (Array.isArray(raw.transcendRuns) ? raw.transcendRuns : []).filter((v) => num(v) > 0).slice(-RUNS_KEPT);
  for (const [k, v] of Object.entries(raw.firstZone ?? {})) if (/^\d{1,2}$/.test(k) && Number(k) < ZONES.length && Number.isFinite(v) && v >= -1) t.firstZone[k] = v;
  return t;
}

export function timeMode(state) {
  return state.dungeon ? 'dungeon' : state.tower ? 'tower' : state.challenge ? 'challenge' : 'campaign';
}

// Appelé à chaque pas de combat.
export function tickTimes(state, dt, balance = BALANCE) {
  const t = state.times ?? (state.times = emptyTimes());
  const mode = timeMode(state);
  t.modes[mode] += dt;
  t.run += dt;
  t.transcendRun += dt;
  t.session += dt;
  if (t.session > t.longestSession) t.longestSession = t.session;
  if (mode !== 'campaign') return;
  const zone = locateStage(state.stage, balance).zone;
  const key = `${zone}:${cycleForStage(state.stage, balance) + 1}`;
  t.where[key] = (t.where[key] ?? 0) + dt;
  if (!(zone in t.firstZone)) t.firstZone[zone] = state.playSeconds ?? 0;
}

function closeRun(runs, seconds) {
  if (seconds > 0) runs.push(seconds);
  if (runs.length > RUNS_KEPT) runs.splice(0, runs.length - RUNS_KEPT);
}

export function noteRebirth(state) {
  const t = state.times ?? (state.times = emptyTimes());
  closeRun(t.rebirthRuns, t.run);
  if (t.run > 0 && (!t.bestRebirth || t.run < t.bestRebirth)) t.bestRebirth = t.run;
  t.run = 0;
}

export function noteTranscend(state) {
  const t = state.times ?? (state.times = emptyTimes());
  closeRun(t.transcendRuns, t.transcendRun);
  if (t.transcendRun > 0 && (!t.bestTranscend || t.transcendRun < t.bestTranscend)) t.bestTranscend = t.transcendRun;
  t.transcendRun = 0;
}

// Lancement du jeu : nouvelle séance.
export function startSession(state) {
  const t = state.times ?? (state.times = emptyTimes());
  t.sessions += 1;
  t.session = 0;
}

// Temps par monde (index), tous cycles confondus, ou pour un cycle donné ; et cycles présents.
export function zoneTime(times, zone, cycle = null) {
  return Object.entries(times.where).reduce((s, [k, v]) => {
    const [z, c] = k.split(':').map(Number);
    return z === zone && (cycle === null || c === cycle) ? s + v : s;
  }, 0);
}

export function cyclesPlayed(times, zone = null) {
  const set = new Set();
  for (const k of Object.keys(times.where)) {
    const [z, c] = k.split(':').map(Number);
    if (zone === null || z === zone) set.add(c);
  }
  return [...set].sort((a, b) => a - b);
}

export function average(runs) {
  return runs.length ? runs.reduce((a, b) => a + b, 0) / runs.length : 0;
}

// Résumé envoyé au serveur pour les classements de temps (petit, sans le détail).
export function timesSummary(times) {
  return { bestRebirth: times.bestRebirth, bestTranscend: times.bestTranscend, firstZone: times.firstZone };
}
