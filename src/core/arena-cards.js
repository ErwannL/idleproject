// v10.1 (P4) : Arène à cartes. Chaque compagnon devient une carte (recto : portrait, PV, attaque, rôle, élément ;
// verso : ses sorts, tirés de companionSkillList). On place jusqu'à 5 cartes sur une formation 2×3 (devant / derrière)
// et on affronte les cartes de l'étage. Combat déterministe (graine = étage), calculé d'un coup puis rejoué à l'écran.
//  - Ciblage par rôle : l'assassin vise l'arrière, l'archer le plus blessé, le mage touche toute une rangée, le
//    gardien attire les coups ; les autres frappent la première carte devant eux.
//  - Jauge d'ultime : se remplit en frappant et en encaissant ; pleine, l'ultime part (×3, soin ou bouclier de groupe).
//  - Étages 1 à 100 puis le Sommet ; règle tous les 5, boss tous les 10, gardien tous les 25 ; 3 étoiles par étage ;
//    un coffre tous les 15 ★ ; essais illimités ; 5 balayages par jour (étages à 3 ★) ; saison de 28 jours.
import { CARD_ARENA as A } from '../data/arena-floors.js';
import { COMPANIONS } from '../data/companions.js';
import { COMPANION_ROLES } from '../data/synergies.js';
import { companionSkillList } from '../data/companion-skills.js';
import { companionProfile, dayKey } from './arena.js';
import { elementMultiplier } from './elements.js';
import { grantReward } from './rewards.js';
import { Rng } from './rng.js';
import { heraldTrack } from './chronicles.js';
import { daybookTrack } from './daybook.js';

const DT = 1 / 20;
const ELS = ['red', 'blue', 'green', 'light', 'dark'];
const byId = (id) => COMPANIONS.find((c) => c.id === id);

// ---- Cartes ----
export function cardOf(state, id) {
  const p = companionProfile(state, id);
  const c = byId(id);
  if (!p || !c) return null;
  const role = COMPANION_ROLES[id] ?? (c.kind === 'ally' ? 'berserker' : 'pet');
  return { ...p, role, skills: companionSkillList(c, role).filter((s) => c.kind === 'ally' || !s.ultimate).map((s) => ({ name: s.name, text: s.text, ultimate: Boolean(s.ultimate) })) };
}
export const rowOf = (pos) => (pos < 3 ? 'front' : 'back');

// ---- Étages ----
export const floorRule = (f) => (f % 5 === 0 ? A.rules[(f / 5 - 1) % A.rules.length] : null);
export const isBossFloor = (f) => f % 10 === 0;
export const isGuardianFloor = (f) => f % 25 === 0;
export const floorName = (f) => (f > A.floors ? `Sommet ${f - A.floors}` : `Étage ${f}`);
function foe(n, el, mult, rng, name, rule) {
  const g = A.enemy;
  const v = 0.92 + rng() * 0.16;
  return {
    name, element: el, maxHp: Math.round(g.hp * g.hpGrowth ** n * mult.hp * v), atk: Math.round(g.atk * g.atkGrowth ** n * mult.atk * (rule?.id === 'frenzy' ? 1.35 : 1)),
    def: Math.round(g.def * g.defGrowth ** n * mult.def * (rule?.id === 'armored' ? 2 : 1)), interval: g.interval * (rule?.id === 'swift' ? 0.7 : 1) * (mult.slow ?? 1),
  };
}
export function floorCards(f) {
  const r = new Rng(f * 7919 + 13); const rng = () => r.next();
  const rule = floorRule(f);
  const n = f * A.scale;
  const el = ELS[f % ELS.length];
  const cards = [];
  const base = { hp: 1, atk: 1, def: 1 };
  if (isGuardianFloor(f)) {
    cards.push({ ...foe(n, el, { hp: A.guardianHp, atk: A.guardianAtk, def: A.guardianDef, slow: 1.2 }, rng, A.guardians[Math.min(A.guardians.length - 1, Math.floor(f / 25) - 1)], rule), pos: 1, guardian: true, boss: true });
    cards.push({ ...foe(n, ELS[(f + 1) % 5], base, rng, 'Écuyer', rule), pos: 3 }, { ...foe(n, ELS[(f + 2) % 5], base, rng, 'Écuyer', rule), pos: 5 });
  } else if (isBossFloor(f)) {
    cards.push({ ...foe(n, el, { hp: A.bossHp, atk: A.bossAtk, def: 1.3, slow: 1.15 }, rng, 'Champion', rule), pos: 1, boss: true });
    cards.push({ ...foe(n, ELS[(f + 2) % 5], base, rng, 'Disciple', rule), pos: 4 });
  } else {
    const count = Math.min(5, 3 + Math.floor(f / 40));
    const names = ['Gladiateur', 'Lancier', 'Arbalétrier', 'Mage noir', 'Brute', 'Assassin'];
    for (let i = 0; i < count; i++) cards.push({ ...foe(n, i === 2 ? ELS[(f + 2) % 5] : el, base, rng, names[(f + i) % names.length], rule), pos: [1, 0, 2, 4, 3, 5][i] });
  }
  return { floor: f, rule, boss: isBossFloor(f), guardian: isGuardianFloor(f), cards };
}

// ---- Combat sur plateau ----
// allies : [{ ...carte, pos }] ; foes : idem. Événements horodatés pour la relecture.
export function fightBoard(allies0, foes0, { seed = 1, rule = null, limit = A.limit } = {}) {
  const rng = new Rng(seed);
  const mk = (x, side) => ({ ...x, side, hp: x.maxHp, cd: rule?.id === 'first' && side === 'foe' ? 0 : x.interval * (0.3 + rng.next() * 0.5), sk: x.skill ? x.skill.every * 0.6 : Infinity, gauge: 0, shield: 0, shieldT: 0 });
  const allies = allies0.map((x) => mk(x, 'ally'));
  const foes = foes0.map((x) => mk(x, 'foe'));
  const ev = [];
  const alive = (l) => l.filter((x) => x.hp > 0);
  const healMult = rule?.id === 'noheal' ? 0.5 : 1;
  const dmg = (atk, a, d) => Math.max(1, atk * elementMultiplier(a.element, d.element) * 100 / (100 + d.def));
  const front = (l) => { const al = alive(l); const fr = al.filter((x) => x.pos < 3); return (fr.length ? fr : al).sort((a, b) => Math.abs((a.pos % 3) - 1) - Math.abs((b.pos % 3) - 1)); };
  const pick = (who, list) => {
    const al = alive(list);
    if (!al.length) return null;
    if (who.side === 'foe') {
      if (rule?.id === 'backline') { const bk = al.filter((x) => x.pos >= 3); if (bk.length) return bk[0]; }
      const tank = al.find((x) => x.role === 'guardian' && x.pos < 3);
      return tank ?? front(list)[0];
    }
    if (who.role === 'assassin') { const bk = al.filter((x) => x.pos >= 3).sort((a, b) => a.hp - b.hp); return bk[0] ?? front(list)[0]; }
    if (who.role === 'archer') return [...al].sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
    return front(list)[0];
  };
  const hit = (a, target, mult, kind, extra = {}) => {
    const d = dmg(a.atk * mult, a, target) * (1 - (target.shield ?? 0) / 100);
    target.hp -= d;
    a.gauge = Math.min(A.ultGauge, a.gauge + A.ultHit);
    target.gauge = Math.min(A.ultGauge, target.gauge + A.ultHurt);
    ev.push({ t: Math.round(t * 100) / 100, kind, side: a.side, from: a.pos, to: target.pos, d: Math.round(d), elem: elementMultiplier(a.element, target.element), ...extra });
    if (target.hp <= 0 && !target.dead) { target.dead = true; ev.push({ t: Math.round(t * 100) / 100, kind: 'fall', side: target.side, pos: target.pos }); }
  };
  let t = 0;
  const act = (a, mine, theirs) => {
    a.cd -= DT; a.sk -= DT;
    a.shieldT = Math.max(0, a.shieldT - DT); if (!a.shieldT) a.shield = 0;
    if (a.gauge >= A.ultGauge && a.side === 'ally') {
      a.gauge = 0;
      if (a.role === 'healer') { for (const x of alive(mine)) x.hp = Math.min(x.maxHp, x.hp + x.maxHp * 0.35 * healMult); ev.push({ t, kind: 'ult', side: a.side, from: a.pos, type: 'heal' }); }
      else if (a.role === 'guardian') { for (const x of alive(mine)) { x.shield = 50; x.shieldT = 5; } ev.push({ t, kind: 'ult', side: a.side, from: a.pos, type: 'shield' }); }
      else if (a.role === 'mage') { ev.push({ t, kind: 'ult', side: a.side, from: a.pos, type: 'burst' }); for (const x of alive(theirs)) hit(a, x, 2.2, 'ulthit'); }
      else { const tg = pick(a, theirs); ev.push({ t, kind: 'ult', side: a.side, from: a.pos, type: 'strike' }); if (tg) hit(a, tg, 3, 'ulthit'); }
      return;
    }
    if (a.sk <= 0 && a.skill) {
      a.sk = a.skill.every;
      const s = a.skill;
      if (s.type === 'heal') { const low = [...alive(mine)].sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp)[0]; if (low) { low.hp = Math.min(low.maxHp, low.hp + low.maxHp * Math.min(30, s.value) / 100 * healMult); ev.push({ t, kind: 'heal', side: a.side, from: a.pos, to: low.pos }); } }
      else if (s.type === 'shield') { for (const x of alive(mine)) { x.shield = Math.min(60, s.value); x.shieldT = s.duration ?? 5; } ev.push({ t, kind: 'shield', side: a.side, from: a.pos }); }
      else { const tg = pick(a, theirs); if (tg) hit(a, tg, Math.min(5, Math.max(1.5, s.value ?? 2)), 'skill', { name: s.name }); }
      return;
    }
    if (a.cd <= 0) {
      a.cd = a.interval;
      const tg = pick(a, theirs);
      if (!tg) return;
      const crit = rng.next() < 0.1;
      hit(a, tg, crit ? 1.6 : 1, 'hit', { crit });
      if (a.role === 'mage') for (const x of alive(theirs)) if (x !== tg && rowOf(x.pos) === rowOf(tg.pos)) hit(a, x, 0.5, 'splash'); // le mage touche la rangée
    }
  };
  while (t < limit) {
    t += DT;
    if (!alive(allies).length || !alive(foes).length) break;
    for (const a of alive(allies)) act(a, allies, foes);
    for (const f of alive(foes)) act(f, foes, allies);
  }
  const won = !alive(foes).length && alive(allies).length > 0;
  const fallen = allies.filter((x) => x.hp <= 0).length;
  const stars = !won ? 0 : fallen === 0 && t <= limit / 2 ? 3 : fallen <= 1 ? 2 : 1;
  return { won, stars, seconds: Math.round(t * 10) / 10, fallen, events: ev, end: { allies: allies.map((x) => ({ pos: x.pos, hp: Math.max(0, x.hp), maxHp: x.maxHp })), foes: foes.map((x) => ({ pos: x.pos, hp: Math.max(0, x.hp), maxHp: x.maxHp })) } };
}

// ---- État ----
export const seasonOf = (now = Date.now()) => Math.floor(now / 86400000 / A.seasonDays);
export function cardArena(state, now = Date.now()) {
  state.arena ??= { survival: null, floors: { best: 0, team: [], last: null } };
  const a = state.arena;
  if (!a.cards) {
    // Migration : l'ancien meilleur étage devient des étages gagnés à 1 ★.
    const old = Math.max(0, Math.min(A.floors, a.floors?.best ?? 0));
    a.cards = { best: old, stars: Object.fromEntries(Array.from({ length: old }, (_, i) => [i + 1, 1])), chests: 0, sweeps: { day: '', used: 0 }, formation: [null, null, null, null, null, null], season: { id: seasonOf(now), best: 0, claimed: [] }, last: null };
    const team = (a.floors?.team ?? []).slice(0, 3);
    team.forEach((id, i) => { a.cards.formation[[1, 0, 2][i]] = id; });
  }
  const c = a.cards;
  const day = dayKey(now);
  if (c.sweeps.day !== day) c.sweeps = { day, used: 0 };
  const sid = seasonOf(now);
  if (c.season.id !== sid) c.season = { id: sid, best: 0, claimed: [] };
  return c;
}
export const totalStars = (state) => Object.values(cardArena(state).stars).reduce((s, v) => s + v, 0);
export const chestsReady = (state) => Math.floor(totalStars(state) / A.chestEvery) - cardArena(state).chests;
export const sweepsLeft = (state, now = Date.now()) => A.sweepsPerDay - cardArena(state, now).sweeps.used;
export function formationCards(state) {
  const c = cardArena(state);
  return c.formation.map((id, pos) => (id ? { ...cardOf(state, id), pos } : null)).filter((x) => x && x.id);
}
export function setFormation(state, pos, id) {
  const c = cardArena(state);
  if (!(pos >= 0 && pos < A.formation)) return false;
  if (id && !state.companions.owned[id]) return false;
  const i = c.formation.indexOf(id);
  if (id && i >= 0) c.formation[i] = c.formation[pos]; // échange
  else if (id && c.formation.filter(Boolean).length >= A.teamMax && !c.formation[pos]) return false;
  c.formation[pos] = id || null;
  return true;
}
// Remplit la formation : gardiens et berserkers devant, les autres derrière (les plus forts d'abord).
export function autoFormation(state) {
  const c = cardArena(state);
  const owned = Object.keys(state.companions.owned).map((id) => cardOf(state, id)).filter(Boolean).sort((a, b) => (b.atk * b.maxHp) - (a.atk * a.maxHp)).slice(0, A.teamMax);
  const f = [null, null, null, null, null, null];
  const frontRoles = ['guardian', 'berserker', 'pet'];
  const fr = owned.filter((x) => frontRoles.includes(x.role)), bk = owned.filter((x) => !frontRoles.includes(x.role));
  const put = (list, slots) => { for (const s of slots) if (list.length && !f[s]) f[s] = list.shift().id; };
  put(fr, [1, 0, 2]); put(bk, [4, 3, 5]); put(fr, [4, 3, 5]); put(bk, [1, 0, 2]);
  c.formation = f;
  return f;
}
export const floorOpen = (state, f) => f >= 1 && f <= cardArena(state).best + 1;

export function playFloor(state, f, now = Date.now()) {
  const c = cardArena(state, now);
  if (!floorOpen(state, f)) return null;
  const team = formationCards(state);
  if (!team.length) return null;
  const setup = floorCards(f);
  const r = fightBoard(team, setup.cards, { seed: f, rule: setup.rule });
  c.last = { floor: f, won: r.won, stars: r.stars, at: now };
  let reward = null;
  if (r.won) {
    const prev = c.stars[f] ?? 0;
    if (r.stars > prev) c.stars[f] = r.stars;
    if (f > c.best) { c.best = f; reward = grantReward(state, A.firstReward(f)); }
    if (f > c.season.best) c.season.best = f;
    state.arena.floors.best = Math.max(state.arena.floors.best ?? 0, Math.min(f, A.floors)); // compatibilité (Chroniques)
    heraldTrack(state, 'arena', 1);
    daybookTrack(state, 'arena', 1, now);
  }
  return { ...r, floor: f, setup, team, reward, newStars: r.won ? Math.max(0, r.stars - 0) : 0 };
}
export function sweepFloor(state, f, now = Date.now()) {
  const c = cardArena(state, now);
  if ((c.stars[f] ?? 0) < 3 || sweepsLeft(state, now) <= 0) return null;
  c.sweeps.used += 1;
  daybookTrack(state, 'arena', 1, now);
  return grantReward(state, A.sweepReward(f));
}
export function claimStarChest(state) {
  if (chestsReady(state) <= 0) return null;
  const c = cardArena(state);
  c.chests += 1;
  return grantReward(state, A.chestReward(c.chests));
}
export function claimSeason(state, floor) {
  const c = cardArena(state);
  const m = A.seasonRewards.find((x) => x.floor === floor);
  if (!m || c.season.best < floor || c.season.claimed.includes(floor)) return null;
  c.season.claimed.push(floor);
  return grantReward(state, m.reward);
}
export function sanitizeCardArena(state, raw) {
  const c = raw?.arena?.cards;
  if (!c || typeof c !== 'object' || !state.arena) return;
  const int = (v, max = 1e6) => (Number.isInteger(v) && v > 0 ? Math.min(max, v) : 0);
  const stars = {};
  for (const [k, v] of Object.entries(c.stars ?? {})) { const f = Number(k); if (Number.isInteger(f) && f > 0 && f <= 10000 && [1, 2, 3].includes(v)) stars[f] = v; }
  state.arena.cards = {
    best: int(c.best, 10000), stars, chests: int(c.chests), last: null,
    sweeps: { day: typeof c.sweeps?.day === 'string' ? c.sweeps.day : '', used: int(c.sweeps?.used, A.sweepsPerDay) },
    formation: Array.from({ length: A.formation }, (_, i) => (typeof c.formation?.[i] === 'string' ? c.formation[i] : null)),
    season: { id: Number.isInteger(c.season?.id) ? c.season.id : 0, best: int(c.season?.best, 10000), claimed: Array.isArray(c.season?.claimed) ? c.season.claimed.filter(Number.isInteger) : [] },
  };
}
