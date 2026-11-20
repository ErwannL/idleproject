// v10.2 (P6) : l'Arène se joue sur une carte, comme l'histoire. Le combat est calculé par core/arena-cards.js
// (fightBoard : positions, ciblage par rôle, sorts, jauge d'ultime) ; ici, on le REJOUE avec le vrai moteur de rendu
// du combat (SceneRenderer, comme render/showcase-scene.js) : décor et parallaxe du monde de l'élément de l'étage,
// compagnons de la formation à gauche (l'avant au plus près des ennemis), vrais monstres du monde à droite, et pour
// chaque événement le geste et l'effet de la campagne (companionBasic, companionSkill, kill…). Rien n'est redessiné.
import { BALANCE } from '../data/balance.js';
import { ZONES } from '../data/zones.js';
import { ZONE_ELEMENT } from '../core/elements.js';
import { enemyStats, zoneStartStage } from '../core/combat.js';
import { SceneRenderer } from './scene.js';
import { vfx } from './vfx.js';

const W = BALANCE.world;
export const ARENA_STEP = 1 / 60;

function zoneIndexOf(el, f) {
  const zs = ZONE_ELEMENT.map((e, i) => [e, i]).filter(([e, i]) => e === el && ZONES[i] && !ZONES[i].gauntlet).map(([, i]) => i);
  return zs.length ? zs[f % zs.length] : 0;
}

export class ArenaScene {
  // run : résultat de playFloor (team = cartes alliées avec pos, setup.cards = cartes ennemies, events horodatés).
  constructor(canvas, run, real) {
    this.canvas = canvas;
    this.run = run;
    this.real = real;
    this.css = { w: 640, h: 360 };
    this.t = 0;
    this.fired = 0;
    this.zone = zoneIndexOf(run.setup.cards[0]?.element ?? 'green', run.floor ?? 1);
    // Ordre d'affichage : l'avant (cases 0-2) au plus près des ennemis, l'arrière derrière lui.
    const order = [...run.team].sort((a, b) => (a.pos < 3 ? 0 : 1) - (b.pos < 3 ? 0 : 1) || Math.abs((a.pos % 3) - 1) - Math.abs((b.pos % 3) - 1));
    this.allyAt = new Map(run.team.map((c) => [c.pos, c]));
    this.state = {
      ...real,
      ui: { ...(real.ui ?? {}), focus: false },
      stage: zoneStartStage(this.zone) + 1,
      dungeon: null, tower: null, challenge: null, worldRun: null,
      rushes: { ...(real.rushes ?? {}), active: {} },
      companions: { ...real.companions, equipped: order.map((c) => c.id) },
      equipment: { ...real.equipment },
    };
    this.r = new SceneRenderer(canvas);
    this.r.soloUnit = true; // pas de héros : l'équipe de cartes seule
    this.r.zoom = 1.6; // cadrage plus serré que la campagne : l'équipe et les monstres en grand
    this.r.resize(this.css.w, this.css.h);
    this.world = {
      time: 0, enemies: [], hero: { hp: 1, dead: false, walking: false, respawnTimer: 0 }, heroStats: {}, scroll: 0, prevScroll: 0, alpha: 1,
      buffs: { cry: 0, cryPct: 0, shield: 0, shieldPct: 0 }, events: [], attackCount: 0, counters: { damage: {} },
    };
    // Ennemis : avant puis arrière, chacun avec son vrai type de monstre (ou de boss).
    let id = 1;
    const foes = [...run.setup.cards].sort((a, b) => (a.pos < 3 ? 0 : 1) - (b.pos < 3 ? 0 : 1) || Math.abs((a.pos % 3) - 1) - Math.abs((b.pos % 3) - 1));
    this.foeAt = new Map();
    for (const c of foes) {
      const type = c.enemyId ?? ZONES[this.zone].enemies[0];
      const s = enemyStats(1, type, Boolean(c.boss));
      const e = { id: id++, type, boss: Boolean(c.boss), elite: false, x: W.spawnX + 10 + this.world.enemies.length * 16, hp: c.maxHp, maxHp: c.maxHp, damage: 1, gold: 0,
        speed: Math.max(30, s.speed * 1.6), range: s.range, engaged: false, age: 0, summons: [], arenaPos: c.pos };
      e.prevX = e.x;
      this.world.enemies.push(e);
      this.foeAt.set(c.pos, e);
    }
    this.hp = { ally: new Map(run.team.map((c) => [c.pos, c.maxHp])), foe: new Map(run.setup.cards.map((c) => [c.pos, c.maxHp])) };
    this.gauge = new Map(run.team.map((c) => [c.pos, 0]));
    this.down = new Set();
    this.lastAct = new Map();
  }

  resize(w, h) { this.css = { w, h }; this.r.zoom = 1.6; this.r.resize(w, h); }
  get done() { return this.fired >= this.run.events.length && this.t >= (this.run.seconds ?? 0); }
  nextEvent() { return this.run.events[this.fired] ?? null; }

  emit(type, data) { this.r.handleEvent({ type, time: this.world.time, ...data }, this.world); }

  // Un événement de fightBoard → geste et effet de la campagne.
  play(e) {
    const ally = e.side === 'ally';
    const card = ally ? this.allyAt.get(e.from) : null;
    const tgtFoe = ally ? this.foeAt.get(e.to) : null;
    const gain = (pos, v) => this.gauge.set(pos, Math.min(100, (this.gauge.get(pos) ?? 0) + v));
    if (['hit', 'skill', 'splash', 'ulthit'].includes(e.kind)) {
      if (ally) {
        if (e.kind === 'hit' && card) { this.emit('companionBasic', { companionId: card.id, kind: 'hit', enemyId: tgtFoe?.id }); gain(e.from, 12); this.lastAct.set(e.from, 'hit'); }
        if (e.kind === 'skill' && card) { const i = Math.max(0, (card.skills ?? []).findIndex((s) => !s.ultimate)); this.emit('companionSkill', { companionId: card.id, skill: i, skillType: card.skill?.type ?? 'hit', ultimate: false }); this.lastAct.set(e.from, 'skill'); }
        if (tgtFoe) {
          tgtFoe.hp = Math.max(0, tgtFoe.hp - e.d);
          this.hp.foe.set(e.to, tgtFoe.hp);
          this.emit('enemyHit', { enemyId: tgtFoe.id, damage: e.d, x: tgtFoe.x, boss: tgtFoe.boss, source: e.kind === 'hit' ? 'companion' : 'skill', crit: e.crit, elem: e.elem });
        }
      } else {
        // Un monstre frappe une carte : son élan, l'impact et le chiffre sur le compagnon touché.
        const foe = this.foeAt.get(e.from);
        const victim = this.allyAt.get(e.to);
        if (foe) { const fx = this.r.enemyFxFor(foe.id); fx.lunge = 0.22; }
        if (victim) {
          this.hp.ally.set(e.to, Math.max(0, (this.hp.ally.get(e.to) ?? 0) - e.d));
          gain(e.to, 8);
          const slot = this.r.layout?.slots.get(victim.id);
          const x = slot?.cx ?? 60;
          vfx(this.r, 'hit_blunt', x + 4, this.r.groundY - 18, { size: 0.7, flip: true });
          this.r.addText(String(Math.max(1, Math.round(e.d))), x, this.r.groundY - 44, '#ff6a6a', '#ffd0d0', false, null);
        }
      }
    } else if (e.kind === 'ult' && card) {
      const i = Math.max(0, (card.skills ?? []).findIndex((s) => s.ultimate));
      this.gauge.set(e.from, 0);
      this.emit('companionSkill', { companionId: card.id, skill: i, skillType: e.type === 'heal' ? 'heal' : e.type === 'shield' ? 'shield' : e.type === 'burst' ? 'burst' : 'hit', ultimate: true });
      this.ultAt = { pos: e.from, t: this.t };
    } else if ((e.kind === 'heal' || e.kind === 'shield') && card) {
      const i = Math.max(0, (card.skills ?? []).findIndex((s) => !s.ultimate));
      this.emit('companionSkill', { companionId: card.id, skill: i, skillType: e.kind, ultimate: false });
      if (e.kind === 'heal' && e.to != null) this.hp.ally.set(e.to, Math.min(this.allyAt.get(e.to)?.maxHp ?? 0, (this.hp.ally.get(e.to) ?? 0) + (this.allyAt.get(e.to)?.maxHp ?? 0) * 0.2));
    } else if (e.kind === 'fall') {
      if (e.side === 'foe') {
        const foe = this.foeAt.get(e.pos);
        if (foe && this.world.enemies.includes(foe)) {
          this.emit('kill', { enemyId: foe.id, kind: foe.type, boss: foe.boss, elite: false, gold: 0, x: foe.x });
          this.world.enemies = this.world.enemies.filter((x) => x !== foe);
        }
      } else {
        const c = this.allyAt.get(e.pos);
        if (c) {
          const slot = this.r.layout?.slots.get(c.id);
          vfx(this.r, 'death_soul', slot?.cx ?? 60, this.r.groundY - 10, { size: 0.9 });
          this.down.add(e.pos);
          this.state.companions = { ...this.state.companions, equipped: this.state.companions.equipped.filter((id) => id !== c.id) };
        }
      }
    }
  }

  // Avance d'un pas : les monstres s'avancent en file (même règle que la campagne), puis les événements du combat.
  step(dt, { hold = false } = {}) {
    const world = this.world;
    world.time += dt;
    world.prevScroll = world.scroll;
    world.enemies.forEach((e, i) => {
      e.prevX = e.x;
      const prev = world.enemies[i - 1];
      const gap = W.enemyGap * (e.boss || prev?.boss ? 2 : 1);
      const stopX = prev ? prev.x + gap : W.heroX + W.meleeOffset + e.range;
      e.x = Math.max(stopX, e.x - e.speed * dt);
      e.engaged = !prev && e.x <= stopX + 0.01;
      e.queued = Boolean(prev) && e.x <= stopX + 0.01;
      if (e.engaged) e.age += dt;
    });
    // Les monstres arrivent avant le premier coup (1 s), puis le combat se rejoue à son rythme.
    if (!hold) this.t += dt;
    const t = this.t - 1;
    while (!hold && this.fired < this.run.events.length && this.run.events[this.fired].t <= t) this.play(this.run.events[this.fired++]);
    this.r.render(this.state, world, dt);
  }
}
