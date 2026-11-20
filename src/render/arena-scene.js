// v10.2 (P6) : l'Arène se joue sur une carte, comme l'histoire. Le combat est calculé par core/arena-cards.js
// (fightBoard : positions, ciblage par rôle, sorts, jauge d'ultime) ; ici, on le REJOUE avec le vrai moteur de rendu
// du combat (SceneRenderer, comme render/showcase-scene.js) : décor et parallaxe du monde de l'élément de l'étage,
// compagnons de la formation à gauche (l'avant au plus près des ennemis), vrais monstres du monde à droite, et pour
// chaque événement le geste et l'effet de la campagne (companionBasic, companionSkill, kill…). Rien n'est redessiné.
import { BALANCE } from '../data/balance.js';
import { ZONES } from '../data/zones.js';
import { ZONE_ELEMENT } from '../core/elements.js';
import { BOSSES, ENEMIES } from '../data/enemies.js';
import { enemyStats, zoneStartStage } from '../core/combat.js';
import { SceneRenderer } from './scene.js';
import { vfx } from './vfx.js';

const W = BALANCE.world;
export const ARENA_STEP = 1 / 60;

// v10.3 (audit) : type que le moteur de rendu connaît pour une carte ennemie — son monstre, ou le boss du monde pour
// un boss d'étage et pour un gardien (qui n'est pas un monstre de la campagne). Toujours un type existant.
export function arenaEngineType(card, zoneIndex) {
  const zone = ZONES[zoneIndex] ?? ZONES[0];
  let type = card.enemyId ?? (card.boss ? zone.bosses?.[0] : zone.enemies[0]);
  let boss = Boolean(card.boss);
  if (boss && !BOSSES[type]) { boss = Boolean(BOSSES[zone.bosses?.[0]]); type = boss ? zone.bosses[0] : zone.enemies[0]; }
  if (!boss && !ENEMIES[type]) type = zone.enemies[0];
  return { type, boss };
}
export const arenaZoneOf = (run) => zoneIndexOf(run.setup.cards[0]?.element ?? 'green', run.floor ?? 1);

function zoneIndexOf(el, f) {
  const zs = ZONE_ELEMENT.map((e, i) => [e, i]).filter(([e, i]) => e === el && ZONES[i] && !ZONES[i].gauntlet).map(([, i]) => i);
  return zs.length ? zs[f % zs.length] : 0;
}
// v10.3 (audit) : illustration propre à une carte (« file:assets/… », les gardiens), dessinée par cette scène.
export const arenaArtOf = (card) => (String(card?.sprite ?? '').startsWith('file:') ? card.sprite.slice(5) : null);
const ART_HEIGHT = 100; // hauteur dans la scène (pixels du monde) : la taille d'un boss de fin de monde
const ART = new Map();
// Image réduite une fois (lissée : l'illustration fait 256 px), avec le cadre réel du personnage (pieds, tête, flancs).
function artCanvas(url) {
  if (!url || typeof Image === 'undefined' || typeof document === 'undefined') return null;
  let a = ART.get(url);
  if (!a) { a = { im: new Image(), pic: null }; a.im.src = url; ART.set(url, a); }
  if (a.pic || !a.im.complete || !a.im.naturalWidth) return a.pic;
  const k = ART_HEIGHT / a.im.naturalHeight;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(a.im.naturalWidth * k); canvas.height = ART_HEIGHT;
  const c = canvas.getContext('2d', { willReadFrequently: true });
  c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
  c.drawImage(a.im, 0, 0, canvas.width, canvas.height);
  let top = canvas.height, foot = 0, left = canvas.width, right = 0;
  try {
    const d = c.getImageData(0, 0, canvas.width, canvas.height).data;
    for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) if (d[(y * canvas.width + x) * 4 + 3] > 40) { top = Math.min(top, y); foot = Math.max(foot, y + 1); left = Math.min(left, x); right = Math.max(right, x + 1); }
  } catch { /* image hors origine : cadre entier */ }
  if (foot <= top) { top = 0; foot = canvas.height; left = 0; right = canvas.width; }
  a.pic = { canvas, top, foot, left, right };
  return a.pic;
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
    this.zone = arenaZoneOf(run);
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
    this.fit(); // cadrage : le plus grand zoom qui montre toute la mêlée (au plus ×1,6)
    this.world = {
      time: 0, enemies: [], hero: { hp: 1, dead: false, walking: false, respawnTimer: 0 }, heroStats: {}, scroll: 0, prevScroll: 0, alpha: 1,
      buffs: { cry: 0, cryPct: 0, shield: 0, shieldPct: 0 }, events: [], attackCount: 0, counters: { damage: {} },
    };
    this.nextId = 1;
    this.foeAt = new Map();
    // v10.3 (audit) : les cartes à illustration propre (gardiens) sont dessinées ici, dans le calque des ennemis,
    // à la place du boss du moteur (même principe que render/world-boss-scene.js) ; un gardien vaincu s'efface.
    this.fading = [];
    const draw = this.r.drawEnemies.bind(this.r);
    this.r.drawEnemies = (ctx, world, dt) => {
      this.viewT = ctx.getTransform?.() ?? null;
      const all = world.enemies;
      const own = all.filter((e) => e.arenaArt);
      if (own.length) { world.enemies = all.filter((e) => !e.arenaArt); draw(ctx, world, dt); world.enemies = all; } else draw(ctx, world, dt);
      for (const e of own) this.drawArt(ctx, e, dt);
      this.fading = this.fading.filter((g) => (g.life -= dt) > 0);
      for (const g of this.fading) this.drawArt(ctx, g.e, dt, g.life / g.max);
    };
    this.hp = { ally: new Map(run.team.map((c) => [c.pos, c.maxHp])), foe: new Map() };
    this.spawn(run.setup.cards);
    this.gauge = new Map(run.team.map((c) => [c.pos, 0]));
    this.down = new Set();
    this.lastAct = new Map();
  }

  // Ennemis : avant puis arrière, chacun avec son vrai type de monstre (ou de boss). Une nouvelle vague (Survie) remplace la précédente.
  // v10.3 (audit) : un gardien (étages 25, 50, 75, 100) n'est pas un monstre de la campagne : il n'a pas de type. Avant,
  // on lui donnait le premier monstre du monde EN BOSS, type que le moteur ne connaît pas → le combat plantait à
  // l'ouverture. Il prend ici, pour le moteur, la place du boss du monde, et son illustration est dessinée par cette scène.
  // Type que le moteur connaît pour une carte (monstre du monde, boss du monde pour un boss ou un gardien).
  resolve(c) {
    const { type, boss } = arenaEngineType(c, this.zone);
    const s = enemyStats(1, type, boss);
    return { type, boss, range: s.range, speed: Math.max(30, s.speed * 1.6) };
  }
  // File des ennemis d'une vague : avant puis arrière (le centre d'abord), et la place d'arrêt de chacun (règle de step).
  queue(cards) {
    const foes = [...cards].sort((a, b) => (a.pos % 10 < 3 ? 0 : 1) - (b.pos % 10 < 3 ? 0 : 1) || Math.abs((a.pos % 3) - 1) - Math.abs((b.pos % 3) - 1));
    let prev = null;
    return foes.map((c) => {
      const k = this.resolve(c);
      const stop = prev ? prev.stop + W.enemyGap * (k.boss || prev.boss ? 2 : 1) : W.heroX + W.meleeOffset + k.range;
      prev = { stop, boss: k.boss };
      return { c, ...k, stop };
    });
  }
  // Bord droit (pixels du monde) du dernier monstre d'une vague arrêtée.
  rightOf(cards) {
    const hx = this.r.wx(W.heroX);
    return this.queue(cards).reduce((m, q) => Math.max(m, Math.max(this.r.wx(q.stop), hx + (q.boss ? 60 : 26)) + (q.boss ? 48 : 20)), hx + 24);
  }
  spawn(cards) {
    for (const q of this.queue(cards)) {
      const c = q.c;
      // v10.3 (audit) : les monstres entrent par le bord droit et sont en place en moins d'une seconde (le premier coup
      // part à 1 s). Avant, ils partaient de très loin : le combat commençait contre un écran vide.
      const e = { id: this.nextId++, type: q.type, boss: q.boss, elite: false, x: q.stop + Math.min(q.speed * 0.8, 70), hp: c.maxHp, maxHp: c.maxHp, damage: 1, gold: 0,
        speed: q.speed, range: q.range, engaged: false, age: 0, summons: [], arenaPos: c.pos, arenaName: c.name, arenaArt: arenaArtOf(c), arenaBoss: Boolean(c.boss) };
      e.prevX = e.x;
      this.world.enemies.push(e);
      this.foeAt.set(c.pos, e);
      this.hp.foe.set(c.pos, c.maxHp);
    }
  }

  // v10.3 (audit) : cadrage. Avant, le zoom fixe (×1,6) et le recentrage « vitrine » poussaient les monstres hors de
  // l'écran : sur téléphone on ne voyait que trois compagnons, sur PC le dernier monstre était coupé. Le zoom est
  // maintenant le plus grand qui montre toute la mêlée (formation à gauche, file des monstres à droite), et la vue
  // est centrée dessus ; si l'écran est vraiment trop étroit, ce sont les monstres qui restent visibles.
  span() {
    let left = this.r.wx(W.heroX) - 40;
    try {
      const lay = this.r.teamLayout(this.state);
      left = lay.left;
      // Téléphone (portrait) : on cadre les monstres et la première ligne (3 cartes) ; l'arrière peut sortir à gauche,
      // comme en campagne, plutôt que de tout rapetisser.
      if (this.r.tall) {
        const xs = [...lay.slots.values()].map((s) => s.x).sort((a, b) => b - a).slice(0, 3);
        if (xs.length) left = Math.max(left, xs.at(-1) - 2);
      }
    } catch { /* avant la première image */ }
    this.leftMin = Math.min(this.leftMin ?? left, left);
    return { left: this.leftMin, right: this.rightMax };
  }
  frameShift() {
    const { left, right } = this.span();
    const total = right - left, m = 8, w = this.r.width;
    return w >= total + 2 * m ? (w - total) / 2 - left : w - m - right;
  }
  fit() {
    const waves = [this.run.setup.cards, ...this.run.events.filter((e) => e.kind === 'wave' && e.cards).map((e) => e.cards)];
    for (const z of [1.6, 1.4, 1.2, 1.05, 0.9, 0.78, 0.66]) {
      this.r.zoom = z;
      this.r.resize(this.css.w, this.css.h);
      this.rightMax = Math.max(...waves.map((cs) => this.rightOf(cs)));
      const { left, right } = this.span();
      if (this.r.width >= right - left + 16) break;
    }
    this.r.fixedShift = this.frameShift();
  }

  // Illustration d'un gardien : à la place du boss du moteur, pieds sur le sol, respiration, élan quand il frappe,
  // éclair quand il est touché ; la géométrie (fx.sx…) est tenue à jour pour que projectiles et impacts le visent.
  drawArt(ctx, e, dt, fade = 1) {
    const r = this.r;
    const pic = artCanvas(e.arenaArt);
    const fx = r.enemyFxFor(e.id);
    for (const k of ['hit', 'lunge']) fx[k] = Math.max(0, (fx[k] ?? 0) - dt);
    fx.knock = (fx.knock ?? 0) * Math.exp(-dt * 14);
    fx.appear = Math.min(1, (fx.appear ?? 0) + dt * 3);
    if (!pic) return;
    const alpha = Math.min(1, this.world.alpha ?? 1);
    const cx = r.wx((e.prevX ?? e.x) + (e.x - (e.prevX ?? e.x)) * alpha) + 10;
    const w = pic.canvas.width, h = pic.canvas.height;
    const breathe = r.focus ? 0 : Math.round(Math.sin(r.time * 2.2 + e.id) * 1);
    const x = Math.round(cx - w / 2 - (fx.lunge > 0 ? 6 * Math.sin((1 - fx.lunge / 0.22) * Math.PI) : 0) + (fx.knock > 0.5 ? fx.knock : 0));
    const y = Math.round(r.groundY + 1 - pic.foot + breathe + (1 - fade) * 10);
    ctx.save();
    ctx.globalAlpha = fx.appear * fade;
    r.drawShadow(ctx, cx, w * 0.5);
    if (fx.hit > 0 || fade < 1) ctx.filter = `brightness(${fade < 1 ? 1 + (1 - fade) * 2 : 1.9})`;
    ctx.drawImage(pic.canvas, x, y);
    ctx.restore();
    const box = { sx: x + pic.left, sy: y + pic.top, sw: pic.right - pic.left, sh: pic.foot - pic.top };
    Object.assign(fx, box, { seen: r.time, edge: box.sx + 4, landed: true, img: pic.canvas, vis: { key: null, img: pic.canvas, x, y, w, h } });
  }

  resize(w, h) { this.css = { w, h }; this.leftMin = undefined; this.fit(); }
  get done() { return this.fired >= this.run.events.length && this.t >= (this.run.seconds ?? 0); }
  nextEvent() { return this.run.events[this.fired] ?? null; }

  emit(type, data) { this.r.handleEvent({ type, time: this.world.time, ...data }, this.world); }

  // v10.3 (audit) : où sont les monstres à l'écran (pixels CSS de la scène) — l'interface y pose leur nom, et la barre
  // de vie du boss ou du gardien en haut. `x` : centre du monstre ; `foot` : ligne du sol.
  marks() {
    const r = this.r;
    // Repère réel du calque des ennemis (décalage de la vue, échelle du canevas), relevé pendant le dessin.
    const T = this.viewT ?? { a: 1, d: 1, e: 0, f: 0 };
    const kx = this.css.w / Math.max(1, this.canvas.width), ky = this.css.h / Math.max(1, this.canvas.height);
    return this.world.enemies.map((e) => {
      const fx = r.enemyFx.get(e.id);
      const seen = fx?.sx != null && fx.seen != null;
      const cx = seen ? fx.sx + fx.sw / 2 : r.wx(e.x);
      const x = (T.a * cx + T.e) * kx;
      return { pos: e.arenaPos, name: e.arenaName ?? '', boss: Boolean(e.arenaBoss), hp: Math.max(0, e.hp) / Math.max(1, e.maxHp), x, foot: (T.d * (r.groundY + 1) + T.f) * ky, seen: seen && x < this.css.w - 8 };
    });
  }

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
    } else if (e.kind === 'wave' && e.cards) {
      this.world.enemies = [];
      this.waveN = e.n;
      this.spawn(e.cards);
    } else if (e.kind === 'fall') {
      if (e.side === 'foe') {
        const foe = this.foeAt.get(e.pos);
        if (foe && this.world.enemies.includes(foe)) {
          if (foe.arenaArt) {
            // Gardien vaincu : son illustration s'efface dans un éclat (pas la chute dessinée du boss du monde).
            const fx = this.r.enemyFxFor(foe.id);
            this.fading.push({ e: foe, life: 0.9, max: 0.9 });
            vfx(this.r, 'death_soul', (fx.sx ?? this.r.wx(foe.x)) + (fx.sw ?? 0) / 2, this.r.groundY - 30, { size: 1.6 });
            if (!this.r.focus) this.r.shake = Math.max(this.r.shake ?? 0, 3);
          } else this.emit('kill', { enemyId: foe.id, kind: foe.type, boss: foe.boss, elite: false, gold: 0, x: foe.x });
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
    const want = this.frameShift();
    this.r.fixedShift += (want - this.r.fixedShift) * Math.min(1, dt * 4);
    this.r.render(this.state, world, dt);
  }
}
