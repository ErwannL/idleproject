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
import { ZONES } from '../data/zones.js';
import { BOSSES, ENEMIES } from '../data/enemies.js';
import { ZONE_ELEMENT } from './elements.js';
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
// v10.2 (1.2) : chaque carte ennemie EST un monstre de la campagne (monde de son élément) : son nom est celui du
// monstre dessiné ; le rôle (Lancier, Mage…) passe en sous-titre. Boss d'étage : le boss du monde ; gardiens : leur nom
// et leur propre illustration (assets/ui/art102/guardian_*.png).
const ROLE_SUB = ['Gladiateur', 'Lancier', 'Arbalétrier', 'Mage noir', 'Brute', 'Assassin'];
function zoneOf(el, f) {
  const zs = ZONE_ELEMENT.map((e, i) => [e, i]).filter(([e]) => e === el).map(([, i]) => i);
  return ZONES[zs.length ? zs[f % zs.length] : 0] ?? ZONES[0];
}
export function monsterOf(el, f, slot) {
  const z = zoneOf(el, f);
  const id = z.enemies[(slot + f) % z.enemies.length];
  return { id, name: ENEMIES[id]?.name ?? id, sprite: ENEMIES[id]?.sprite ?? 'icon_skull' };
}
export function bossOf(el, f) {
  const z = zoneOf(el, f);
  const id = z.bosses?.[0];
  const b = BOSSES[id];
  return { id, name: b?.name ?? 'Champion', sprite: b?.sprite ?? ENEMIES[b?.base]?.sprite ?? 'icon_boss' };
}
// cal : calibrage de l'Arène sur l'équipe du joueur au premier passage ({ hp, atk }, voir calibrateArena).
export function floorCards(f, cal = { hp: 1, atk: 1 }) {
  const r = new Rng(f * 7919 + 13); const rng = () => r.next();
  const rule = floorRule(f);
  const n = f * A.scale;
  const el = ELS[f % ELS.length];
  const cards = [];
  const base = { hp: cal.hp, atk: cal.atk, def: 1 };
  const m = (o) => ({ ...o, hp: o.hp * cal.hp, atk: o.atk * cal.atk });
  const mob = (elc, slot, pos) => { const mo = monsterOf(elc, f, slot); return { ...foe(n, elc, base, rng, mo.name, rule), pos, enemyId: mo.id, sprite: mo.sprite, sub: ROLE_SUB[(f + slot) % ROLE_SUB.length] }; };
  if (isGuardianFloor(f)) {
    const gi = Math.min(A.guardians.length - 1, Math.floor(f / 25) - 1);
    cards.push({ ...foe(n, el, m({ hp: A.guardianHp, atk: A.guardianAtk, def: A.guardianDef, slow: 1.2 }), rng, A.guardians[gi], rule), pos: 1, guardian: true, boss: true, sprite: `file:assets/ui/art102/guardian_${gi}.png`, sub: 'Gardien' });
    cards.push(mob(ELS[(f + 1) % 5], 3, 3), mob(ELS[(f + 2) % 5], 5, 5));
  } else if (isBossFloor(f)) {
    const b = bossOf(el, f);
    cards.push({ ...foe(n, el, m({ hp: A.bossHp, atk: A.bossAtk, def: 1.3, slow: 1.15 }), rng, b.name, rule), pos: 1, boss: true, enemyId: b.id, sprite: b.sprite, sub: 'Boss' });
    cards.push(mob(ELS[(f + 2) % 5], 4, 4));
  } else {
    const count = Math.min(5, 3 + Math.floor(f / 40));
    for (let i = 0; i < count; i++) cards.push(mob(i === 2 ? ELS[(f + 2) % 5] : el, i, [1, 0, 2, 4, 3, 5][i]));
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
  const stars = !won ? 0 : fallen === 0 && t <= A.star3 ? 3 : fallen <= 1 ? 2 : 1;
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
// v10.2 (1.3) : placement auto par rôle. Devant : gardiens, berserkers, puis les plus robustes (jamais l'assassin) ;
// derrière : mages, archers, soutiens et l'assassin (il saute sur l'arrière ennemi). L'avant est toujours plein
// avant d'occuper l'arrière (5 cartes : 3 devant, 2 derrière).
const FRONT_ROLES = ['guardian', 'berserker'];
export function autoFormation(state) {
  const c = cardArena(state);
  const owned = Object.keys(state.companions.owned).map((id) => cardOf(state, id)).filter(Boolean)
    .sort((a, b) => (b.atk * b.maxHp) - (a.atk * a.maxHp));
  // Les meilleurs de rôle « avant » viennent de toute la collection (pas seulement des 5 plus forts).
  const nFront = Math.min(3, owned.length);
  const front = owned.filter((x) => FRONT_ROLES.includes(x.role)).slice(0, nFront);
  const all = [...front, ...owned.filter((x) => !front.includes(x))].slice(0, A.teamMax);
  const sturdy = all.filter((x) => !front.includes(x) && x.role !== 'assassin').sort((a, b) => b.maxHp - a.maxHp);
  while (front.length < nFront && sturdy.length) front.push(sturdy.shift());
  const rest0 = all.filter((x) => !front.includes(x));
  while (front.length < nFront && rest0.length) front.push(rest0.shift()); // que des assassins : il faut bien tenir l'avant
  const back = all.filter((x) => !front.includes(x));
  const f = [null, null, null, null, null, null];
  front.sort((a, b) => b.maxHp - a.maxHp).forEach((x, i) => { f[[1, 0, 2][i]] = x.id; });
  back.forEach((x, i) => { f[[4, 3, 5][i]] = x.id; });
  c.formation = f;
  return f;
}
export const floorOpen = (state, f) => f >= 1 && f <= cardArena(state).best + 1;

export function playFloor(state, f, now = Date.now()) {
  const c = cardArena(state, now);
  if (!floorOpen(state, f)) return null;
  const cal = arenaCal(state); // v10.2 (2.2) : formation placée et calibrage faits à la première ouverture
  const team = formationCards(state);
  if (!team.length) return null;
  const setup = floorCards(f, cal);
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
    cal: c.cal && Number.isFinite(c.cal.hp) && Number.isFinite(c.cal.atk) && c.cal.hp > 0 && c.cal.atk > 0 ? { hp: c.cal.hp, atk: c.cal.atk } : null,
    sweeps: { day: typeof c.sweeps?.day === 'string' ? c.sweeps.day : '', used: int(c.sweeps?.used, A.sweepsPerDay) },
    formation: Array.from({ length: A.formation }, (_, i) => (typeof c.formation?.[i] === 'string' ? c.formation[i] : null)),
    season: { id: Number.isInteger(c.season?.id) ? c.season.id : 0, best: int(c.season?.best, 10000), claimed: Array.isArray(c.season?.claimed) ? c.season.claimed.filter(Number.isInteger) : [] },
  };
}

// ---- v10.2 (1.4) : calibrage sur l'équipe du joueur au premier passage ----
// Les étages ne sont plus une échelle fixe (une équipe de 11 h passait 40 étages à 3 ★ en 2 s chacun) : à la première
// ouverture, on mesure l'équipe placée et on fixe deux facteurs gardés dans la sauvegarde :
//   hp  : l'étage 9 dure ~28 s (2 ★ possibles dès les étages 8-10, un combat de l'étage 10 dure plus de 12 s) ;
//   atk : l'équipe du moment franchit ~20 étages et bute vers l'étage 30.
// Ensuite les étages sont figés : en progressant (niveaux, étoiles, équipement), le joueur monte plus haut.
export function lastWon(team, cal, max = 60) {
  let last = 0;
  for (let f = 1; f <= max; f++) { const x = floorCards(f, cal); if (fightBoard(team, x.cards, { seed: f, rule: x.rule }).won) last = f; else break; } // les étages se montent dans l'ordre : la première défaite arrête
  return last;
}
export function calibrateArena(team) {
  if (!team.length) return { hp: 1, atk: 1 };
  // 1. PV : durée de l'étage de référence (ennemis presque inoffensifs pendant la mesure).
  let lo = 1e-4, hi = 1e6;
  for (let k = 0; k < 40; k++) {
    const mid = Math.sqrt(lo * hi);
    const x = floorCards(A.calSlowFloor, { hp: mid, atk: 1e-6 });
    const r = fightBoard(team, x.cards, { seed: A.calSlowFloor, rule: null });
    if (!r.won || r.seconds > 28) hi = mid; else lo = mid;
  }
  const hp = Math.sqrt(lo * hi);
  // 2. Attaque : l'étage où l'équipe bute.
  lo = 1e-4; hi = 1e6;
  for (let k = 0; k < 30; k++) {
    const mid = Math.sqrt(lo * hi);
    if (lastWon(team, { hp, atk: mid }, A.calTarget + 6) >= A.calTarget) lo = mid; else hi = mid;
  }
  return { hp: Math.round(hp * 1e4) / 1e4, atk: Math.round(Math.sqrt(lo * hi) * 1e4) / 1e4 };
}
export function arenaCal(state) {
  const c = cardArena(state);
  if (!c.cal) {
    if (!c.formation.some(Boolean)) autoFormation(state);
    c.cal = calibrateArena(formationCards(state));
  }
  return c.cal;
}
