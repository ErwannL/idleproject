// v9.3.2 : modes COMPAGNONS — aucun héros n'y combat.
//   Survie : un seul compagnon (ou familier) contre 30 vagues ; 3 essais par jour ; score = vague atteinte, puis temps.
//   Étages : une équipe de 3 compagnons/familiers, sans héros ; étages permanents (boss tous les 10) ; chaque étage
//            franchi pour la première fois rapporte sa récompense une seule fois.
// Un compagnon n'a pas de statistiques de combat dans la campagne (il lance sa compétence avec les dégâts du héros) :
// ce module lui donne un PROFIL DE COMBAT propre, calculé depuis sa rareté, son niveau (1-20) et ses étoiles (doublons),
// et réutilise sa vraie compétence (type, cadence, valeur) et son type (core/elements.js).
// Le combat est déterministe (graine) et se calcule d'un coup : l'écran le rejoue (événements horodatés).
import { COMPANIONS, COMPANION_RULES } from '../data/companions.js';
import { ARENA } from '../data/arena.js';
import { duplicates, ultimateUnlocked } from './companions.js';
import { elementMultiplier, unitElement } from './elements.js';
import { grantReward } from './rewards.js';
import { Rng } from './rng.js';

const DT = 1 / 20;
const byId = (id) => COMPANIONS.find((c) => c.id === id);
export const dayKey = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);

// ---- Profil de combat d'un compagnon ----
export function companionProfile(state, id) {
  const c = byId(id);
  const owned = state.companions.owned[id];
  if (!c || !owned) return null;
  const base = ARENA.base[c.rarity] ?? ARENA.base.common;
  const lvl = 1 + COMPANION_RULES.levelBonusPct * ((owned.level ?? 1) - 1) * ARENA.levelWeight;
  const star = 1 + ARENA.starPct / 100 * duplicates(owned);
  const pet = c.kind !== 'ally'; // familier : plus fragile, plus rapide
  const k = lvl * star;
  const skill = c.ultimate && ultimateUnlocked(owned) ? c.ultimate : c.skill;
  return {
    id, name: c.name, kind: c.kind, rarity: c.rarity, element: unitElement(id), sprite: c.sprite,
    maxHp: Math.round(base.hp * k * (pet ? 0.8 : 1)), atk: Math.round(base.atk * k), def: Math.round(base.def * k),
    interval: base.interval * (pet ? 0.85 : 1), skill: skill ? { type: skill.type, every: Math.max(4, (skill.every ?? 20) * ARENA.skillTimeScale), value: skill.value, name: skill.name } : null,
  };
}

// ---- Ennemis ----
function enemy(kind, n, el, boss, mods, rng) {
  const g = ARENA.enemies;
  const hp = g.hp * g.hpGrowth ** n * (boss ? g.bossHp : 1) * (mods.includes('armored') ? 1.4 : 1);
  const atk = g.atk * g.atkGrowth ** n * (boss ? g.bossAtk : 1) * (mods.includes('frenzy') ? 1.35 : 1);
  return { kind, boss, element: el, maxHp: Math.round(hp * (0.9 + rng() * 0.2)), hp: 0, atk: Math.round(atk), def: Math.round(g.def * g.defGrowth ** n * (mods.includes('armored') ? 2 : 1)),
    interval: g.interval * (mods.includes('swift') ? 0.7 : 1) * (boss ? 1.15 : 1), regen: mods.includes('regen') ? 0.02 : 0 };
}
const ELS = ['red', 'blue', 'green', 'light', 'dark'];
export function survivalWave(n, seed = 1) {
  const r = new Rng(seed * 7919 + n); const rng = () => r.next();
  const mods = [ARENA.survival.modifiers[n % ARENA.survival.modifiers.length]].filter((m) => m !== 'none');
  const el = ELS[(n * 3 + seed) % ELS.length];
  const boss = n % 10 === 0;
  const count = boss ? 1 : Math.min(4, 1 + Math.floor((n + 2) / 6));
  return { n, mods, element: el, boss, foes: Array.from({ length: count }, (_, i) => enemy(boss ? 'boss' : 'foe', n, i === 1 && !boss ? ELS[(n + 1) % 5] : el, boss, mods, rng)) };
}
export function floorSetup(f) {
  const r = new Rng(f * 104729); const rng = () => r.next();
  const cond = f % 5 === 0 ? ARENA.floors.conditions[(f / 5 - 1) % ARENA.floors.conditions.length] : null;
  const boss = f % 10 === 0;
  const el = cond?.element ?? ELS[f % ELS.length];
  const n = Math.round(f * ARENA.floors.scale);
  const count = boss ? 1 : 3;
  return { floor: f, boss, cond, element: el, foes: Array.from({ length: count }, (_, i) => enemy(boss ? 'boss' : 'foe', n, i === 2 ? ELS[(f + 2) % 5] : el, boss, cond?.id === 'swift' ? ['swift'] : [], rng)) };
}

// ---- Combat (déterministe) : allies[] contre une suite de groupes d'ennemis ----
// Événements : { t, kind: 'hit'|'skill'|'heal'|'shield'|'kill'|'fall'|'wave', ... } pour la relecture à l'écran.
export function fight(allies0, groups, { seed = 1, limit = 600, healMult = 1 } = {}) {
  const rng = new Rng(seed);
  const allies = allies0.map((a) => ({ ...a, hp: a.maxHp, cd: a.interval * (0.3 + rng.next() * 0.5), sk: a.skill ? a.skill.every * 0.5 : Infinity, shield: 0, shieldT: 0, rally: 0, rallyT: 0 }));
  const ev = [];
  let t = 0, gi = 0, kills = 0, cleared = 0, foes = [];
  const load = () => { foes = groups[gi].foes.map((f) => ({ ...f, hp: f.maxHp, cd: f.interval * (0.5 + rng.next() * 0.5) })); ev.push({ t, kind: 'wave', i: gi, n: groups[gi].n ?? groups[gi].floor, boss: groups[gi].boss, foes: foes.map((f) => ({ maxHp: f.maxHp, element: f.element, boss: f.boss })) }); };
  load();
  const alive = (l) => l.filter((x) => x.hp > 0);
  const dmg = (atk, att, def, defender) => Math.max(1, atk * elementMultiplier(att, defender.element) * 100 / (100 + def));
  while (t < limit) {
    t += DT;
    const team = alive(allies);
    if (!team.length) break;
    for (const a of team) {
      a.shieldT = Math.max(0, a.shieldT - DT); if (!a.shieldT) a.shield = 0;
      a.rallyT = Math.max(0, a.rallyT - DT); if (!a.rallyT) a.rally = 0;
      const boost = 1 + Math.max(0, ...team.map((x) => x.rally)) / 100;
      a.cd -= DT; a.sk -= DT;
      const target = alive(foes)[0];
      if (a.sk <= 0 && a.skill) {
        a.sk = a.skill.every;
        const s = a.skill;
        if (s.type === 'hit' && target) { const d = dmg(a.atk * Math.min(6, s.value) * boost, a.element, target.def, target); target.hp -= d; ev.push({ t, kind: 'skill', who: a.id, type: s.type, d, foe: foes.indexOf(target), elem: elementMultiplier(a.element, target.element) }); }
        else if (s.type === 'burst') for (const f of alive(foes)) { const d = dmg(a.atk * Math.min(4, s.value) * 0.8 * boost, a.element, f.def, f); f.hp -= d; ev.push({ t, kind: 'skill', who: a.id, type: s.type, d, foe: foes.indexOf(f), elem: elementMultiplier(a.element, f.element) }); }
        else if (s.type === 'heal') { for (const x of team) { const h = x.maxHp * Math.min(25, s.value) / 100 * healMult; x.hp = Math.min(x.maxHp, x.hp + h); } ev.push({ t, kind: 'heal', who: a.id }); }
        else if (s.type === 'shield') { for (const x of team) { x.shield = Math.min(70, s.value); x.shieldT = s.duration ?? 6; } ev.push({ t, kind: 'shield', who: a.id }); }
        else if (s.type === 'rally') { a.rally = Math.min(60, s.value); a.rallyT = s.duration ?? 6; ev.push({ t, kind: 'rally', who: a.id }); }
        else if (s.type === 'gold' && target) { const d = dmg(a.atk * 1.5 * boost, a.element, target.def, target); target.hp -= d; ev.push({ t, kind: 'skill', who: a.id, type: 'gold', d, foe: foes.indexOf(target), elem: elementMultiplier(a.element, target.element) }); }
      }
      if (a.cd <= 0 && target) {
        a.cd = a.interval;
        const crit = rng.next() < ARENA.critChance;
        const d = dmg(a.atk * boost * (crit ? 1.6 : 1), a.element, target.def, target);
        target.hp -= d;
        ev.push({ t, kind: 'hit', who: a.id, d, crit, foe: foes.indexOf(target), elem: elementMultiplier(a.element, target.element) });
      }
    }
    for (const f of foes) if (f.hp <= 0 && !f.dead) { f.dead = true; kills++; ev.push({ t, kind: 'kill', foe: foes.indexOf(f) }); }
    for (const f of alive(foes)) {
      f.hp = Math.min(f.maxHp, f.hp + f.maxHp * f.regen * DT);
      f.cd -= DT;
      if (f.cd > 0) continue;
      f.cd = f.interval;
      const victims = alive(allies);
      if (!victims.length) break;
      const v = victims[0]; // le premier encaisse (comme le héros dans la campagne) ; les suivants ensuite
      const d = dmg(f.atk, f.element, v.def, v) * (1 - v.shield / 100); // les ennemis frappent selon les affinités
      v.hp -= d;
      ev.push({ t, kind: 'hurt', who: v.id, d, elem: elementMultiplier(f.element, v.element) });
      if (v.hp <= 0) ev.push({ t, kind: 'fall', who: v.id });
    }
    if (!alive(foes).length) {
      cleared++; gi++;
      if (gi >= groups.length) break;
      load();
    }
  }
  return { cleared, kills, seconds: Math.round(t * 10) / 10, won: cleared >= groups.length, events: ev, end: allies.map((a) => ({ id: a.id, hp: Math.max(0, a.hp), maxHp: a.maxHp })) };
}

// ---- État sauvegardé ----
export function arenaState(state, now = Date.now()) {
  state.arena ??= { survival: null, floors: { best: 0, team: [], last: null } };
  const day = dayKey(now);
  if (!state.arena.survival || state.arena.survival.day !== day) {
    const prev = state.arena.survival;
    state.arena.survival = { day, tries: 0, best: prev?.best ?? null, claimed: prev?.claimed ?? [], last: prev?.last ?? null };
  }
  return state.arena;
}
export const arenaUnlocked = (state) => (state.maxStage ?? 1) >= ARENA.unlockStage && Object.keys(state.companions.owned).length > 0;
export const survivalTriesLeft = (state, now = Date.now()) => ARENA.survival.triesPerDay - arenaState(state, now).survival.tries;

export function runSurvival(state, id, now = Date.now()) {
  const a = arenaState(state, now);
  const p = companionProfile(state, id);
  if (!p || !arenaUnlocked(state) || survivalTriesLeft(state, now) <= 0) return null;
  const seed = Number(dayKey(now).replace(/-/g, '')) % 100000 + a.survival.tries;
  const waves = Array.from({ length: ARENA.survival.waves }, (_, i) => survivalWave(i + 1, seed));
  const r = fight([p], waves, { seed });
  a.survival.tries++;
  const result = { companion: id, wave: r.cleared, seconds: r.seconds, kills: r.kills, won: r.won, score: r.cleared * 10000 - Math.round(r.seconds) };
  const b = a.survival.best;
  if (!b || result.score > b.score) a.survival.best = result;
  a.survival.last = result;
  // Récompenses : chaque palier de vague (5, 10, … 30) une seule fois.
  const rewards = [];
  for (const m of ARENA.survival.milestones) if (r.cleared >= m.wave && !a.survival.claimed.includes(m.wave)) { a.survival.claimed.push(m.wave); rewards.push(m); grantReward(state, m.reward); }
  return { ...result, fight: r, waves, team: [p], rewards };
}

export function runFloor(state, team, now = Date.now()) {
  const a = arenaState(state, now);
  const ids = [...new Set(team)].slice(0, ARENA.floors.teamSize);
  const profiles = ids.map((id) => companionProfile(state, id)).filter(Boolean);
  if (!profiles.length || !arenaUnlocked(state)) return null;
  const f = a.floors.best + 1;
  const setup = floorSetup(f);
  const r = fight(profiles, [setup], { seed: f, healMult: setup.cond?.id === 'noheal' ? 0.5 : 1, limit: 120 });
  a.floors.team = ids;
  const result = { floor: f, won: r.won, seconds: r.seconds, at: now };
  a.floors.last = result;
  let reward = null;
  if (r.won) { a.floors.best = f; reward = floorReward(f); grantReward(state, reward); }
  return { ...result, fight: r, waves: [setup], team: profiles, reward };
}
export function floorReward(f) {
  return { gems: 4 + f + (f % 10 === 0 ? 40 : 0), gold: 0 };
}

export function sanitizeArena(state, raw) {
  const a = raw?.arena;
  const int = (v) => (Number.isInteger(v) && v >= 0 ? v : 0);
  if (!a || typeof a !== 'object') { state.arena = null; return; }
  const s = a.survival;
  const res = (x) => (x && typeof x === 'object' ? { companion: String(x.companion ?? ''), wave: int(x.wave), seconds: Number(x.seconds) || 0, kills: int(x.kills), won: Boolean(x.won), score: Number(x.score) || 0 } : null);
  state.arena = {
    survival: s && typeof s.day === 'string' ? { day: s.day.slice(0, 10), tries: Math.min(int(s.tries), ARENA.survival.triesPerDay), best: res(s.best), last: res(s.last),
      claimed: Array.isArray(s.claimed) ? s.claimed.filter(Number.isInteger).slice(0, 20) : [] } : null,
    floors: { best: int(a.floors?.best), team: Array.isArray(a.floors?.team) ? a.floors.team.filter((x) => typeof x === 'string').slice(0, ARENA.floors.teamSize) : [],
      last: a.floors?.last && typeof a.floors.last === 'object' ? { floor: int(a.floors.last.floor), won: Boolean(a.floors.last.won), seconds: Number(a.floors.last.seconds) || 0, at: Number(a.floors.last.at) || 0 } : null },
  };
}
