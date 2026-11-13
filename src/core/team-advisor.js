// v9.5.0 (3.6) : « Meilleure équipe disponible ». Chaque équipe candidate est essayée avec le vrai moteur de combat,
// quelques secondes à l'étape en cours, contre des monstres rendus increvables (sinon une équipe forte attendrait la
// vague suivante et paraîtrait plus faible) : on mesure les dégâts infligés par seconde (héros + compagnons, éléments,
// synergies et passifs compris), divisés par deux si le héros tombe. Rien n'est modifié dans la partie.
import { BALANCE } from '../data/balance.js';
import { companionById, onExpedition, teamKind, teamSlotsOf } from './companions.js';
import { createCombat, step } from './combat.js';
import { Rng } from './rng.js';

const SECONDS = 12;
const MAX_ALLIES = 6; // candidats essayés (les plus forts sur le papier + l'équipe en place)

function clone(state) {
  return typeof structuredClone === 'function' ? structuredClone(state) : JSON.parse(JSON.stringify(state));
}

// Dégâts par seconde de l'équipe `team` (liste d'identifiants : compagnons et familier) à l'étape en cours.
export function teamScore(state, team, balance = BALANCE, seconds = SECONDS) {
  const s = clone(state);
  s.companions.equipped = [...team];
  s.dungeon = null; s.tower = null; s.challenge = null; s.worldRun = null;
  s.autoAdvance = false;
  const w = createCombat(s, balance);
  const rng = new Rng(4242);
  const dt = balance.simulation.tickSeconds;
  let dmg = 0, died = false;
  for (let t = 0; t < seconds; t += dt) {
    step(s, w, dt, rng, balance);
    for (const e of w.enemies) if (!e.tough) { e.tough = true; e.hp = e.maxHp = 1e300; e.boss = false; }
    for (const ev of w.events) {
      if (ev.type === 'enemyHit' || ev.type === 'heroAttack') dmg += Number.isFinite(ev.damage) ? ev.damage : 0;
      if (ev.type === 'heroDeath') died = true;
    }
    w.events.length = 0;
  }
  return (dmg / seconds) * (died ? 0.5 : 1);
}

function slots(balance, state) { return teamSlotsOf(state, balance); }

// Meilleure équipe parmi les compagnons possédés et libres. Renvoie { team, score, current, gain } ou null.
export function bestTeam(state, balance = BALANCE) {
  const it = bestTeamSteps(state, balance);
  let r = it.next();
  while (!r.done) r = it.next();
  return r.value;
}

// Même calcul, découpé : chaque next() fait un seul essai (~25 ms), pour ne jamais figer l'écran.
export function* bestTeamSteps(state, balance = BALANCE) {
  const owned = Object.keys(state.companions?.owned ?? {}).map(companionById).filter(Boolean)
    .filter((c) => !onExpedition(state, c.id) || state.companions.equipped.includes(c.id));
  const allies = owned.filter((c) => teamKind(c) === 'ally');
  const pets = owned.filter((c) => teamKind(c) === 'pet');
  const n = slots(balance, state);
  if (!allies.length && !pets.length) return null;
  const current = state.companions.equipped.filter((id) => owned.some((c) => c.id === id));
  const curAllies = current.filter((id) => teamKind(companionById(id)) === 'ally');
  const curPet = current.find((id) => teamKind(companionById(id)) === 'pet') ?? null;
  // Candidats compagnons : chacun seul avec le familier en place, puis les meilleurs combinés.
  const solo = [];
  for (const c of allies) { solo.push({ id: c.id, s: teamScore(state, [c.id, ...(curPet ? [curPet] : [])], balance, 6) }); yield; }
  solo.sort((a, b) => b.s - a.s);
  const pool = [...new Set([...solo.slice(0, MAX_ALLIES).map((x) => x.id), ...curAllies])];
  const combos = [];
  const k = Math.min(n.ally, pool.length);
  const pick = (start, acc) => {
    if (acc.length === k) { combos.push(acc); return; }
    for (let i = start; i < pool.length; i++) pick(i + 1, [...acc, pool[i]]);
  };
  pick(0, []);
  let best = null;
  for (const combo of combos) {
    const team = [...combo, ...(curPet ? [curPet] : [])];
    const s = teamScore(state, team, balance);
    if (!best || s > best.score) best = { team, score: s };
    yield;
  }
  // Familier : le meilleur avec l'équipe retenue.
  if (pets.length && n.pet > 0) {
    const allyPart = best ? best.team.filter((id) => teamKind(companionById(id)) === 'ally') : [];
    for (const p of pets) {
      const team = [...allyPart, p.id];
      const s = teamScore(state, team, balance);
      if (!best || s > best.score) best = { team, score: s };
      yield;
    }
  }
  if (!best) return null;
  const now = teamScore(state, current, balance);
  const same = best.team.length === current.length && best.team.every((id) => current.includes(id));
  return { team: best.team, score: best.score, current: now, gain: now > 0 ? best.score / now - 1 : 1, same };
}

// ---- Conseil en cache (barre jaune, écran Équipe) ----
let cache = { key: '', at: 0, value: null, job: null };
export function adviceKey(state) {
  const c = state.companions ?? {};
  return [state.stage, state.level, JSON.stringify(c.equipped), JSON.stringify(c.teamLevel),
    Object.entries(c.owned ?? {}).map(([id, o]) => `${id}:${o.stars}`).sort().join(','), Object.keys(state.expeditions?.slots ?? {}).length].join('|');
}
// Dernier conseil connu pour cet état (ou null si pas encore calculé / dépassé).
export function teamAdvice(state) {
  return cache.key === adviceKey(state) ? cache.value : null;
}
// À appeler régulièrement (chaque image) : avance le calcul d'un pas ; relance au plus toutes les `every` secondes.
export function tickTeamAdvice(state, now = Date.now(), every = 45, balance = BALANCE) {
  const key = adviceKey(state);
  if (!cache.job) {
    if (key === cache.key && now - cache.at < every * 1000) return;
    if (key === cache.key && cache.value) return;
    cache.job = { key, it: bestTeamSteps(clone(state), balance) };
  }
  const r = cache.job.it.next();
  if (r.done) { cache = { key: cache.job.key, at: now, value: r.value, job: null }; }
}
