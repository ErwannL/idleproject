// v9.2.7 : vitrine animée des fiches (compagnons, familiers, apparences du héros, monstres, boss, mutations).
// Une mini-scène qui rejoue en boucle des « séquences » (marche, attaque, compétences, arrivée, coup reçu, mort,
// mécanique de boss, mutation) avec le VRAI moteur de rendu du combat : un SceneRenderer (scene.js) dessine le fond du
// monde, le héros, l'équipe, les ennemis, les gestes et les VFX (skill-fx.js, vfx.js, vfx-world.js, mutation-fx.js).
// Rien n'est redessiné ici : ce module ne fait que tenir un petit monde factice (positions, PV) et envoyer au
// renderer les mêmes événements que la simulation (heroAttack, skill, companionSkill, heroHit, kill…).
// La cible des coups est un ennemi ordinaire du monde, qui ne meurt pas (mannequin) ; pour un monstre, c'est le héros.
import { BALANCE } from '../data/balance.js';
import { BOSSES, ENEMIES } from '../data/enemies.js';
import { ZONES } from '../data/zones.js';
import { CLASSES } from '../data/classes.js';
import { SKILLS } from '../data/skills.js';
import { arrivalFor } from '../data/arrivals.js';
import { COMPANION_ROLES } from '../data/synergies.js';
import { companionSkillList } from '../data/companion-skills.js';
import { BOSS_MINIONS, BOSS_TRAITS, TRAITS } from '../core/boss-traits.js';
import { MUTATIONS } from '../core/mutations.js';
import { classWeaponBases } from '../core/classes.js';
import { companionById } from '../core/companions.js';
import { enemyStats, zoneIndexForStage, zoneStartStage } from '../core/combat.js';
import { skillValue } from '../core/skills.js';
import { heroById } from '../core/heroes.js';
import { powerOf } from './enemy-fx.js';
import { SceneRenderer, WORLD_SCALE } from './scene.js';

const W = BALANCE.world;
const HERO_X = W.heroX * WORLD_SCALE; // même position que dans scene.js
export const STEP = 1 / 60;

// Monde de la fiche : celui où vit le monstre ou le boss ; pour une unité, le monde où le joueur se trouve.
export function zoneOfEnemy(id, boss) {
  const i = ZONES.findIndex((z) => !z.gauntlet && (boss ? z.bosses.includes(id) || Object.values(z.tierBosses ?? {}).includes(id) : z.enemies?.includes(id)));
  return i >= 0 ? i : 0;
}

const ARRIVAL_TEXT = { walk: 'Arrive à pied', wings: 'Arrive en volant', float: 'Arrive en flottant', swim: 'Arrive à la nage', burrow: 'Sort de terre', portal: 'Surgit d\'un portail' };
const ATTACK_TEXT = { breath: 'Souffle', cast: 'Sort', melee: 'Coup au contact' };
const MUTATION_ZONE = 1; // monde 2 : premier monde où les mutations apparaissent

// --- Séquences ------------------------------------------------------------------------------------------------
// Chaque séquence : { id, label, desc, icon, dur, setup(d), events: [[t, fn(d)]], still } ; `still` = instant de
// l'image fixe (« Réduire les animations »).
function walkClip() {
  return { id: 'walk', icon: '🚶', label: 'Marche', desc: 'Déplacement entre deux combats.', dur: 3, still: 1.2, setup: (d) => { d.walking = true; } };
}

function dummy(d) { d.target = d.spawn(d.dummyType, { landed: true, hp: 0.8, immortal: true }); }
const hitText = (t, source = 'skill') => [t, (d) => d.target && d.emit('enemyHit', { enemyId: d.target.id, damage: 120 + Math.round(Math.random() * 80), x: d.target.x, boss: d.target.boss, source })];

function unitClips(c) {
  const role = COMPANION_ROLES[c.id] ?? 'pet';
  const list = companionSkillList(c, role).filter((s) => c.kind === 'ally' || !s.ultimate); // v9.3.8 : familier sans ultime
  const clips = [walkClip(), {
    id: 'basic', icon: '⚔', label: 'Attaque de base', desc: c.kind === 'ally' ? 'Son geste d\'attaque en combat.' : 'Son geste en combat.', dur: 3, still: 0.55,
    setup: dummy, events: [[0.3, (d) => d.r.allyGesture(c, d.world, HERO_X)], [1.7, (d) => d.r.allyGesture(c, d.world, HERO_X)]],
  }];
  for (const sk of list) {
    const offensive = sk.type === 'hit' || sk.type === 'burst' || sk.type === 'aoe';
    clips.push({
      id: `sk${sk.index}`, icon: sk.ultimate ? '★' : '✦', label: sk.name, desc: sk.text, ult: Boolean(sk.ultimate), dur: sk.ultimate ? 3.6 : 3.2, still: 0.8,
      setup: dummy,
      events: [[0.3, (d) => d.emit('companionSkill', { companionId: c.id, skill: sk.index, skillType: sk.type, ultimate: Boolean(sk.ultimate) })],
        ...(offensive ? [hitText(0.9, 'companion')] : [])],
    });
  }
  return clips;
}

function heroClips() {
  const clips = [walkClip()];
  for (const cls of CLASSES) {
    const base = classWeaponBases(cls.id)[0];
    const a = cls.attack;
    // Troisième coup : pluie de flèches ou météore pour les classes qui en ont (comme en combat).
    const special = a.volleyEvery ? 'volley' : a.meteorEvery ? 'meteor' : null;
    const strike = (crit, sp = null) => (d) => d.target && d.emit('heroAttack', { enemyId: d.target.id, damage: crit ? 480 : 210, crit, x: d.target.x, boss: false, kind: a.kind, special: sp, targets: [] });
    clips.push({
      id: `cls-${cls.id}`, icon: '⚔', label: cls.name, desc: cls.text, dur: special ? 3.6 : 3, still: 0.5,
      setup: (d) => { d.setClass(cls.id, base); dummy(d); },
      events: [[0.4, strike(false)], [1.3, strike(true)], [2.2, strike(false, special)]],
    });
  }
  for (const sk of SKILLS) {
    clips.push({
      id: `hs-${sk.id}`, icon: '✦', label: sk.name, desc: sk.text(skillValue(sk, 1)), dur: 3, still: 0.7,
      setup: (d) => { d.setClass(d.realClass, null); dummy(d); },
      events: [[0.3, (d) => d.emit('skill', { skillId: sk.id, x: d.target?.x ?? W.heroX + 30 })], hitText(0.8)],
    });
  }
  return clips;
}

function foeClips(type, boss, mutation = null) {
  const def = boss ? BOSSES[type] : ENEMIES[type];
  const arrival = arrivalFor(type, boss, { underwater: Boolean(ZONES[boss ? zoneOfEnemy(type, true) : zoneOfEnemy(type, false)]?.underwater) });
  const arrKey = arrival.mode === 'fly' ? arrival.style ?? 'wings' : arrival.mode;
  const power = powerOf(type)?.kind ?? 'melee';
  const opts = { boss, mutation };
  const strike = (t) => [[t, (d) => d.foe && d.emit('enemyWindup', { enemyId: d.foe.id, boss })], [t + 0.25, (d) => d.foe && d.emit('heroHit', { enemyId: d.foe.id, damage: 35, boss })]];
  const heroStrike = (t, crit = false) => [t, (d) => d.foe && d.emit('heroAttack', { enemyId: d.foe.id, damage: crit ? 520 : 240, crit, x: d.foe.x, boss, kind: d.realKind, special: null, targets: [] })];
  const clips = [
    { id: 'arrive', icon: '⬇', label: 'Arrivée', desc: ARRIVAL_TEXT[arrKey] ?? ARRIVAL_TEXT.walk, dur: 3.6, still: 0.55,
      setup: (d) => { d.foe = d.spawn(type, { ...opts, x: d.edgeX(boss ? 6 : 2) }); },
      events: mutation ? [[0.05, (d) => d.emit('mutantSpawn', { enemyId: d.foe.id, kind: type, mutation })]] : [] },
    { id: 'walk', icon: '🚶', label: 'Marche', desc: 'Avance vers le héros.', dur: 3, still: 1,
      setup: (d) => { d.foe = d.spawn(type, { ...opts, x: d.edgeX(boss ? 34 : 14), landed: true, slow: 0.6 }); } },
    { id: 'attack', icon: '⚔', label: 'Attaque', desc: ATTACK_TEXT[power], dur: 3, still: 0.7,
      setup: (d) => { d.foe = d.spawn(type, { ...opts, landed: true }); }, events: [...strike(0.4), ...strike(1.8)] },
    { id: 'hurt', icon: '✸', label: 'Coup reçu', desc: 'Réaction quand le héros le touche.', dur: 2.6, still: 0.55,
      setup: (d) => { d.foe = d.spawn(type, { ...opts, landed: true, hp: 0.7 }); }, events: [heroStrike(0.4), heroStrike(1.5, true)] },
    { id: 'death', icon: '✝', label: 'Mort', desc: 'Il s\'effondre et disparaît.', dur: 2.8, still: 0.75,
      setup: (d) => { d.foe = d.spawn(type, { ...opts, landed: true, hp: 0.1 }); },
      events: [heroStrike(0.3, true), [0.42, (d) => d.killFoe()]] },
  ];
  const trait = boss ? BOSS_TRAITS[type] : null;
  if (trait && TRAITS[trait]) clips.push(traitClip(type, trait));
  if (mutation) clips.splice(1, 0, mutationClip(type, mutation));
  return clips.filter(Boolean).map((c) => ({ ...c, foeName: def?.name }));
}

function traitClip(type, trait) {
  const t = TRAITS[trait];
  const base = { id: 'trait', icon: '◆', label: t.name, desc: t.text, dur: 4, still: 1.1, trait: true };
  const hit = (at, crit = false) => [at, (d) => d.foe && d.emit('heroAttack', { enemyId: d.foe.id, damage: crit ? 520 : 200, crit, x: d.foe.x, boss: true, kind: d.realKind, special: null, targets: [] })];
  const chip = (at) => [at, (d) => d.foe && d.emit('enemyHit', { enemyId: d.foe.id, damage: 60, x: d.foe.x, boss: true, source: 'skill' })];
  const bite = (at) => [[at, (d) => d.foe && d.emit('enemyWindup', { enemyId: d.foe.id, boss: true })], [at + 0.25, (d) => d.foe && d.emit('heroHit', { enemyId: d.foe.id, damage: 40 + Math.round((d.foe.age ?? 0) * 3), boss: true })]];
  if (trait === 'armored') return { ...base, setup: (d) => { d.foe = d.spawn(type, { boss: true, landed: true }); }, events: [0.3, 0.6, 0.9, 1.2, 1.5, 1.8, 2.1, 2.4].flatMap((x, i) => [hit(x), chip(x + 0.12 + (i % 2) * 0.05)]) };
  if (trait === 'summoner') {
    return { ...base, setup: (d) => { d.foe = d.spawn(type, { boss: true, landed: true }); },
      events: [[0.5, (d) => d.summon(BOSS_MINIONS[type] ?? t.minion, 2)], hit(2.2), hit(3)] };
  }
  if (trait === 'escalate') return { ...base, setup: (d) => { d.foe = d.spawn(type, { boss: true, landed: true }); d.foe.age = 6; d.ageRate = 8; }, events: [...bite(0.4), ...bite(1.6), ...bite(2.8)] };
  if (trait === 'desperate') {
    return { ...base, setup: (d) => { d.foe = d.spawn(type, { boss: true, landed: true, hp: 0.62 }); },
      events: [hit(0.3, true), [0.5, (d) => { d.foe.hp = d.foe.maxHp * 0.4; d.emit('bossEnrage', { enemyId: d.foe.id, kind: type }); }], ...bite(1.2), ...bite(2), ...bite(2.8)] };
  }
  if (trait === 'tidal') {
    return { ...base, setup: (d) => { d.foe = d.spawn(type, { boss: true, landed: true, hp: 0.55 }); d.regen = 0.06; },
      events: [hit(2.3, true), [2.3, (d) => { d.foe.critAt = d.world.time; }]] };
  }
  // v9.6.5 : Miroir et Bouclier d'élément — une série de coups sur le boss.
  if (trait === 'mirror' || trait === 'elemShield' || trait === 'frost' || trait === 'swarm') {
    return { ...base, setup: (d) => { d.foe = d.spawn(type, { boss: true, landed: true }); }, events: [0.4, 0.9, 1.4, 1.9, 2.4].map((x) => hit(x)) };
  }
  return null;
}

function mutationClip(type, id) {
  const m = MUTATIONS.find((x) => x.id === id);
  const base = { id: 'mutation', icon: '✺', label: m.name, desc: m.text, dur: 3.6, still: 0.9, mutationClip: true };
  const opts = { mutation: id, landed: true };
  const heroStrike = (t, crit = false) => [t, (d) => d.foe && d.emit('heroAttack', { enemyId: d.foe.id, damage: crit ? 520 : 240, crit, x: d.foe.x, boss: false, kind: d.realKind, special: null, targets: [] })];
  const bite = (t) => [[t, (d) => d.foe && d.emit('enemyWindup', { enemyId: d.foe.id, boss: false })], [t + 0.25, (d) => d.foe && d.emit('heroHit', { enemyId: d.foe.id, damage: 30, boss: false })]];
  switch (id) {
    case 'split': return { ...base, setup: (d) => { d.foe = d.spawn(type, { ...opts, hp: 0.1 }); }, events: [heroStrike(0.3, true), [0.42, (d) => d.split()]] };
    case 'regen': return { ...base, setup: (d) => { d.foe = d.spawn(type, { ...opts, hp: 0.35 }); d.regen = 0.12; }, events: [heroStrike(0.4), heroStrike(2.2)] };
    case 'armored': return { ...base, setup: (d) => { d.foe = d.spawn(type, opts); }, events: [0.3, 0.9, 1.5, 2.1, 2.7].flatMap((t) => [heroStrike(t), [t + 0.1, (d) => d.foe && d.emit('enemyHit', { enemyId: d.foe.id, damage: 40, x: d.foe.x, boss: false, source: 'skill' })]]) };
    case 'frenzied': return { ...base, setup: (d) => { d.foe = d.spawn(type, opts); }, events: [0.3, 0.9, 1.5, 2.1, 2.7].flatMap(bite) };
    case 'vampire': return { ...base, setup: (d) => { d.foe = d.spawn(type, { ...opts, hp: 0.5 }); }, events: [...bite(0.4), ...bite(1.6), ...bite(2.8)] };
    case 'giant': return { ...base, dur: 4, setup: (d) => { d.foe = d.spawn(type, { mutation: id, landed: true, x: d.edgeX(22), slow: 0.7 }); }, events: [...bite(3.2)] };
    default: return base;
  }
}

// Séquences d'une fiche. spec = { kind: 'unit' | 'hero' | 'monster' | 'boss' | 'mutation', id }.
export function showcaseClips(spec) {
  switch (spec.kind) {
    case 'unit': { const c = companionById(spec.id); return c ? unitClips(c) : []; }
    case 'hero': return heroClips();
    case 'monster': return ENEMIES[spec.id] ? foeClips(spec.id, false) : [];
    case 'boss': return BOSSES[spec.id] ? foeClips(spec.id, true) : [];
    case 'mutation': {
      const type = ZONES[MUTATION_ZONE].enemies[0];
      return MUTATIONS.some((m) => m.id === spec.id) ? foeClips(type, false, spec.id).filter((c) => ['arrive', 'mutation', 'attack', 'death'].includes(c.id)) : [];
    }
    default: return [];
  }
}

// --- Mini-scène --------------------------------------------------------------------------------------------------
export class ShowcaseScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.clips = [];
    this.index = 0;
    this.css = { w: 320, h: 150 };
  }

  // Fiche à montrer. `real` = état du joueur (lu, jamais modifié : la scène travaille sur une copie de surface).
  configure(spec, real) {
    this.spec = spec;
    this.real = real;
    this.clips = showcaseClips(spec);
    let zone = zoneIndexForStage(real.stage ?? 1) % ZONES.length;
    if (!ZONES[zone] || ZONES[zone].gauntlet) zone = 0;
    if (spec.kind === 'monster') zone = zoneOfEnemy(spec.id, false);
    if (spec.kind === 'boss') zone = zoneOfEnemy(spec.id, true);
    if (spec.kind === 'mutation') zone = MUTATION_ZONE;
    this.zone = zone;
    this.dummyType = ZONES[zone].enemies[0];
    const unit = spec.kind === 'unit' ? companionById(spec.id) : null;
    this.state = {
      ...real,
      ui: { ...(real.ui ?? {}), focus: false },
      stage: zoneStartStage(zone) + 1,
      dungeon: null, tower: null, challenge: null, worldRun: null,
      rushes: { ...(real.rushes ?? {}), active: {} },
      companions: { ...real.companions, equipped: unit ? [unit.id] : [] },
      heroes: spec.kind === 'hero' && heroById(spec.id) ? { ...real.heroes, active: spec.id } : real.heroes,
      equipment: { ...real.equipment },
    };
    this.realClass = real.heroClass;
    const cls = CLASSES.find((c) => c.id === real.heroClass) ?? CLASSES[0];
    this.realKind = cls.attack.kind;
    this.start(0);
  }

  resize(w, h) {
    this.css = { w, h };
    if (this.r) this.r.zoom = 2.2;
    this.r?.resize(w, h);
  }

  setClass(id, base) {
    this.state.heroClass = id;
    this.state.equipment = { ...this.real.equipment };
    if (base) this.state.equipment.weapon = { id: 'showcase', baseId: base.id, slot: 'weapon', rarity: 'epic', level: 1, stats: {}, affixes: [] };
  }

  // Recommence une séquence avec un renderer neuf (aucun effet ne déborde d'une séquence à l'autre).
  start(index) {
    this.index = ((index % this.clips.length) + this.clips.length) % (this.clips.length || 1);
    this.clip = this.clips[this.index];
    this.t = 0;
    this.fired = 0;
    this.r = new SceneRenderer(this.canvas);
    this.r.zoom = 2.2; // v9.8 (I6) : cadrage serré sur le personnage et sa cible
    this.r.resize(this.css.w, this.css.h);
    this.r.calm = Boolean(this.calm);
    this.nextId = 1;
    this.world = {
      time: 0, enemies: [], hero: { hp: 1, dead: false, walking: false, respawnTimer: 0 }, heroStats: {}, scroll: 0, prevScroll: 0, alpha: 1,
      buffs: { cry: 0, cryPct: 0, shield: 0, shieldPct: 0 }, events: [], attackCount: 0, counters: { damage: {} },
    };
    this.walking = false;
    this.foe = null;
    this.target = null;
    this.regen = 0;
    this.ageRate = 0;
    this.setClass(this.realClass, null);
    this.clip?.setup?.(this);
    this.events = [...(this.clip?.events ?? [])].sort((a, b) => a[0] - b[0]);
  }

  spawn(type, { boss = false, x = null, landed = false, hp = 1, mutation = null, slow = 1, immortal = false } = {}) {
    const s = enemyStats(1, type, boss);
    let range = s.range;
    if (mutation === 'giant') range += 6;
    if (mutation === 'split') range = Math.max(4, range - 2);
    const stop = W.heroX + W.meleeOffset + range;
    const e = {
      id: this.nextId++, type, boss, elite: false, x: x ?? stop, hp: 1000 * hp, maxHp: 1000, damage: 1, gold: 1, speed: s.speed * slow,
      range, engaged: false, age: 0, trait: boss ? BOSS_TRAITS[type] ?? null : null, mutation, summons: [], immortal,
    };
    e.prevX = e.x;
    this.world.enemies.push(e);
    if (landed) Object.assign(this.r.enemyFxFor(e.id), { arriveAt: -99, landed: true, appear: 1 });
    return e;
  }

  // x de la simulation qui tombe à `margin` px du bord droit de la mini-scène (wx() étire l'approche selon la largeur).
  edgeX(margin) {
    let lo = W.heroX, hi = W.spawnX + 20;
    for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; if (this.r.wx(mid) < this.r.width - margin) lo = mid; else hi = mid; }
    return lo;
  }

  emit(type, data) {
    this.r.handleEvent({ type, time: this.world.time, ...data }, this.world);
    if (type === 'heroAttack') this.world.attackCount++;
  }

  killFoe() {
    const e = this.foe;
    if (!e) return;
    this.emit('kill', { enemyId: e.id, kind: e.type, boss: e.boss, elite: false, gold: 0, x: e.x });
    this.world.enemies = this.world.enemies.filter((x) => x !== e);
    this.foe = null;
  }

  split() {
    const e = this.foe;
    if (!e) return;
    const kids = [this.spawn(e.type, { x: e.x - 6, hp: 0.4, landed: true }), this.spawn(e.type, { x: e.x + 10, hp: 0.4, landed: true })];
    for (const k of kids) k.splitChild = true;
    this.emit('mutantSplit', { enemyId: e.id, kind: e.type, x: e.x, children: kids.map((k) => k.id) });
    this.killFoe();
    this.world.enemies = [...kids, ...this.world.enemies.filter((x) => !kids.includes(x))];
  }

  summon(minion, count) {
    const master = this.foe;
    if (!master) return;
    for (let i = 0; i < count; i++) {
      const m = this.spawn(minion, { boss: false, x: master.x - 6 - i * 4, landed: false });
      m.summoned = true;
      this.world.enemies = [m, ...this.world.enemies.filter((x) => x !== m)];
      this.emit('bossSummon', { enemyId: m.id, kind: minion, master: master.type, x: m.x });
    }
  }

  // Avance d'un pas : file d'ennemis (même règle que combat.js), défilement en marche, événements de la séquence.
  step(dt) {
    const clip = this.clip;
    if (!clip) return;
    const world = this.world;
    world.time += dt;
    this.t += dt;
    world.hero.walking = this.walking;
    world.prevScroll = world.scroll;
    if (this.walking) world.scroll += W.scrollSpeed * dt;
    world.enemies.forEach((e, i) => {
      e.prevX = e.x;
      const prev = world.enemies[i - 1];
      const gap = W.enemyGap * (e.boss || prev?.boss ? 2 : 1);
      const stopX = prev ? prev.x + gap : W.heroX + W.meleeOffset + e.range;
      e.x = Math.max(stopX, e.x - e.speed * dt);
      e.engaged = !prev && e.x <= stopX + 0.01;
      e.queued = Boolean(prev) && e.x <= stopX + 0.01;
      if (e.engaged) e.age += dt * (1 + this.ageRate);
      if (this.regen && e.hp < e.maxHp && !(e.critAt > world.time - 3)) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * this.regen * dt);
      if (e.immortal && e.hp < e.maxHp * 0.3) e.hp = e.maxHp * 0.8;
    });
    while (this.fired < this.events.length && this.events[this.fired][0] <= this.t) {
      const [, fn] = this.events[this.fired++];
      // Les dégâts du mannequin : la barre de vie bouge un peu à chaque coup (sans jamais tomber).
      if (this.target) this.target.hp = Math.max(this.target.maxHp * 0.35, this.target.hp - this.target.maxHp * 0.04);
      fn(this);
    }
    this.r.render(this.state, world, dt);
  }

  get done() { return Boolean(this.clip) && this.t >= this.clip.dur; }

  // Image fixe (« Réduire les animations ») : la séquence est jouée sans être montrée jusqu'à son instant clé.
  still(index) {
    this.start(index);
    const until = this.clip?.still ?? 0.5;
    while (this.t < until) this.step(STEP);
  }
}
