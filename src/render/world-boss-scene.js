// v9.2.9 : scène du World Boss. Comme la vitrine (showcase-scene.js), rien n'est redessiné ici : un SceneRenderer
// (scene.js, le vrai rendu du combat) dessine le monde, le héros, l'équipe, le familier et tous les effets ; il reçoit
// les événements du VRAI moteur de combat (core/combat.js via core/world-boss.js).
// Le boss, lui, est DÉDIÉ : le Colosse des Anciens (PixelLab, assets/world-boss/colossus_*.png : repos, attaque,
// séisme, braises, coup reçu, transformation, fureur, forme de phase 3, chute). Il est dessiné ici, à la place du
// boss du moteur, dans le calque des ennemis (méthode drawEnemies du renderer enveloppée pour CETTE scène seulement) :
// héros, équipe et effets restent devant lui.
// « Réduire les animations » : renderer calme (pas de secousses, effets sobres) ; l'interface (ui/world-boss.js)
// joue alors la tentative d'un coup et ne montre qu'une image fixe.
import { SceneRenderer, WORLD_SCALE } from './scene.js';
import { BALANCE } from '../data/balance.js';
import { formatNumber } from '../core/format.js';
import { vfx, drawVfxFrame } from './vfx.js';
import { WORLD_BOSS } from '../core/world-boss.js';

// Décalage à l'écran du boss géant (unités du monde de la simulation).
const BOSS_OFFSET = 34;

// Animations du Colosse : bandes horizontales d'images 128×128 (première et dernière identiques pour les boucles).
const FRAME = 128;
const FOOT = 122; // ligne des pieds dans l'image source
export const COLOSSUS_ANIMS = {
  idle: { n: 8, fps: 7, loop: true }, idle3: { n: 8, fps: 9, loop: true },
  attack: { n: 9, fps: 16 }, attack3: { n: 9, fps: 18 }, hurt: { n: 9, fps: 18 },
  hurt3: { n: 9, fps: 18 }, // v9.3.0 : coup reçu de la forme de lave (phase 3)
 
  quake: { n: 9, fps: 11 }, embers: { n: 9, fps: 11 }, fury: { n: 9, fps: 12 },
  transform: { n: 13, fps: 12 }, death: { n: 13, fps: 10 }, rise: { n: 13, fps: 14, src: 'death', reverse: true },
  // v9.3.0 : jet de pierre (il arrache un rocher, le lève, le lance) et rayon des yeux (charge, faisceau, retour).
  // `durs` : durée de chaque image (s) ; `release` : image où le rocher quitte la main ; `charge` / `fire` : images
  // de la charge lumineuse et du faisceau.
  throw: { n: 13, durs: [0.07, 0.07, 0.08, 0.09, 0.12, 0.12, 0.1, 0.1, 0.24, 0.1, 0.1, 0.08, 0.08], release: 9 },
  throw3: { n: 13, durs: [0.07, 0.07, 0.08, 0.09, 0.12, 0.12, 0.1, 0.1, 0.24, 0.1, 0.1, 0.08, 0.08], release: 9 },
  beam: { n: 13, durs: [0.08, 0.08, 0.08, 0.22, 0.26, 0.1, 0.32, 0.32, 0.32, 0.1, 0.08, 0.08, 0.08], charge: [3, 4], fire: [5, 8] },
  beam3: { n: 13, durs: [0.08, 0.08, 0.08, 0.22, 0.26, 0.1, 0.32, 0.32, 0.32, 0.1, 0.08, 0.08, 0.08], charge: [3, 4], fire: [5, 8] },
};

// v9.3.0 : position des deux yeux (pixels de l'image source 128×128 : œil avant x, y, œil arrière x, y) sur CHAQUE
// image des animations du rayon, relevée image par image (gabarit du visage cherché dans chaque image générée, comme
// la gueule des dragons) : le faisceau part exactement des yeux, même quand la tête plonge.
export const COLOSSUS_EYES = {
  beam: [[34, 39, 44, 38], [34, 39, 44, 38], [33, 39, 43, 38], [32, 40, 42, 39], [31, 41, 41, 40], [31, 42, 41, 41], [31, 42, 41, 41], [31, 42, 41, 41], [31, 42, 41, 41], [32, 41, 42, 40], [33, 40, 43, 39], [34, 39, 44, 38], [34, 39, 44, 38]],
  beam3: [[33, 45, 42, 45], [33, 45, 42, 45], [33, 45, 42, 45], [30, 48, 39, 48], [28, 50, 37, 50], [27, 51, 36, 51], [27, 51, 36, 51], [27, 51, 36, 51], [27, 51, 36, 51], [29, 49, 38, 49], [31, 47, 40, 47], [33, 45, 42, 45], [33, 45, 42, 45]],
};
// Point où le rocher quitte la main (image `release` du jet de pierre), pixels de l'image source.
const THROW_HAND = { throw: [16, 34], throw3: [18, 44] };
// Couleurs du faisceau : halo, corps, cœur (phase 3 : la forme de lave a des yeux de braise).
const BEAM_COLORS = { beam: ['#2fd8ff', '#8ff8ff', '#ffffff'], beam3: ['#ff5a1f', '#ffb04a', '#fff3c8'] };

// Image d'une animation à l'instant t (s) : durées par image (`durs`) ou cadence fixe (`fps`). -1 : terminée.
export function animFrameAt(a, t) {
  if (!a.durs) { const k = Math.floor(t * a.fps); return k >= a.n ? -1 : k; }
  let acc = 0;
  for (let i = 0; i < a.n; i++) { acc += a.durs[i]; if (t < acc) return i; }
  return -1;
}
export const animLength = (a) => (a.durs ? a.durs.reduce((x, y) => x + y, 0) : a.n / a.fps);
const IMAGES = {};
function sheet(name) {
  if (typeof Image === 'undefined') return null;
  if (!IMAGES[name]) { const im = new Image(); im.src = `assets/world-boss/colossus_${name}.png`; IMAGES[name] = im; }
  const im = IMAGES[name];
  return im.complete && im.naturalWidth ? im : null;
}
export function preloadColossus() { for (const [k, a] of Object.entries(COLOSSUS_ANIMS)) sheet(a.src ?? k); }

// Couleurs de l'aura selon la phase (0 = avant la première phase).
export const PHASE_COLORS = ['#ffb347', '#ff8a3d', '#ff5a3d', '#ff2a4a'];

export class WorldBossScene {
  constructor(canvas, fight, { calm = false } = {}) {
    this.canvas = canvas;
    this.fight = fight;
    this.r = new SceneRenderer(canvas);
    this.r.calm = calm;
    this.seen = 0;
    this.auraAt = 0;
    this.flashEnd = 0;
    this.clock = 0;
    this.noFlashUntil = 0;
    this.anim = null; // animation ponctuelle en cours : { name, t, then }
    this.hurtAt = -9;
    this.appear = 0;
    preloadColossus();
    // Le boss du moteur n'est pas dessiné par le renderer : le Colosse prend sa place dans le même calque.
    const draw = this.r.drawEnemies.bind(this.r);
    this.r.drawEnemies = (ctx, world, dt) => {
      const boss = this.fight.boss;
      if (!boss) { draw(ctx, world, dt); return; }
      const all = world.enemies;
      world.enemies = all.filter((e) => e !== boss);
      draw(ctx, world, dt);
      world.enemies = all;
      this.drawColossus(ctx, boss, dt);
    };
    // v9.3.0 : rocher en vol et faisceau des yeux dessinés par-dessus les personnages, dans le calque des effets.
    this.attacks = []; // { kind: 'boulder' | 'beam', ... }
    const effects = this.r.drawEffects.bind(this.r);
    this.r.drawEffects = (ctx, dt) => { effects(ctx, dt); this.drawAttacks(ctx, dt); };
  }

  // Animation ponctuelle (attaque, phase…), puis retour au repos (ou à `then`).
  play(name, then = null) {
    if (this.r.focus) return; // « Réduire les animations » : poses fixes
    this.interrupt();
    this.anim = { name, t: 0, then };
  }

  // v9.3.0 : une attaque propre coupée avant son coup (chute du Colosse…) frappe quand même : dégâts affichés.
  interrupt() {
    const a = this.anim;
    if (a?.ev && !a.fired) { a.fired = true; this.heroHurt(a.ev, 0, 5); }
    this.attacks = this.attacks.filter((x) => x.kind !== 'beam');
  }

  get scale() { return 1.15 + 0.06 * this.fight.phase; }

  drawColossus(ctx, boss, dt) {
    const r = this.r;
    this.appear = Math.min(1, this.appear + dt * 1.5);
    const phase3 = this.fight.phase >= 3;
    let name = phase3 ? 'idle3' : 'idle';
    let i = 0;
    if (this.anim) {
      const a = COLOSSUS_ANIMS[this.anim.name];
      this.anim.t += dt;
      const k = animFrameAt(a, this.anim.t);
      if (k < 0) {
        const then = this.anim.then;
        this.interrupt();
        this.anim = then ? { name: then, t: 0, then: null } : null;
      } else { name = this.anim.name; i = a.reverse ? a.n - 1 - k : k; }
    }
    if (!this.anim || name === 'idle' || name === 'idle3') {
      const a = COLOSSUS_ANIMS[name];
      i = r.focus ? 0 : Math.floor(r.time * a.fps) % a.n;
    }
    const a = COLOSSUS_ANIMS[name];
    const im = sheet(a.src ?? name);
    const k = this.scale;
    const w = FRAME * k;
    const cx = r.wx(boss.x) + 14;
    const x = Math.round(cx - w / 2);
    const y = Math.round(r.groundY + 1 - FOOT * k);
    // Ombre au sol, puis le Colosse (pieds sur la ligne du sol).
    ctx.save();
    ctx.globalAlpha = 0.35 * this.appear;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(cx, r.groundY + 1, 44 * k, 6 * k, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = this.appear;
    if (im) ctx.drawImage(im, i * FRAME, 0, FRAME, FRAME, x, y, w, w);
    ctx.restore();
    // v9.3.0 : image dessinée (pour caler le rocher et le faisceau sur la main et les yeux), déclencheurs des attaques.
    this.drawn = { name, i, x, y, k };
    if (this.anim?.ev && this.anim.name === name) this.attackStep(name, i);
    // Repères pour les effets du renderer (coups, projectiles, chiffres) : la silhouette visible du Colosse.
    const fx = r.enemyFxFor(boss.id);
    Object.assign(fx, { sx: x + 8 * k, sy: y + 6 * k, sw: 112 * k, sh: 116 * k, seen: r.time, edge: x + 18 * k, landed: true, appear: 1, hit: 0 });
  }

  // v9.3.0 : pixel (px, py) de l'image source du Colosse → écran (d'après la dernière image dessinée).
  at(px, py) {
    const d = this.drawn;
    return d ? [d.x + px * d.k, d.y + py * d.k] : [0, 0];
  }

  // Yeux sur l'image dessinée (animations du rayon seulement).
  eyes() {
    const d = this.drawn;
    const e = d && COLOSSUS_EYES[d.name]?.[d.i];
    return e ? [this.at(e[0] + 0.5, e[1] + 0.5), this.at(e[2] + 0.5, e[3] + 0.5)] : null;
  }

  heroX() { return BALANCE.world.heroX * WORLD_SCALE; }

  // Dégâts d'une attaque reçus par le héros (chiffre, choc, secousse).
  heroHurt(ev, delay = 0, shake = 6) {
    const r = this.r;
    const heroX = this.heroX();
    r.later(delay, () => {
      r.hero.hurt = 0.3;
      vfx(r, 'hit_blunt', heroX + 8, r.groundY - 20, { size: 1.3, flip: true });
      r.addText(formatNumber(Math.round(ev.damage)), heroX - 4, r.groundY - 54, '#ff5a5a', '#ffd0d0', true);
      r.shake = Math.max(r.shake, shake);
    });
  }

  // Images clés des attaques propres : le rocher quitte la main, le faisceau s'allume.
  attackStep(name, i) {
    const a = COLOSSUS_ANIMS[name];
    const an = this.anim;
    if (a.release !== undefined && i >= a.release && !an.fired) {
      an.fired = true;
      const [hx, hy] = this.at(...THROW_HAND[name]);
      const tx = this.heroX() - 14;
      this.attacks.push({ kind: 'boulder', ev: an.ev, x0: hx, y0: hy, x1: tx, y1: this.r.groundY - 6, t: 0, dur: 0.62, arc: 70 + Math.max(0, hy - this.r.groundY + 90) * 0.2, fire: name === 'throw3' });
    }
    if (a.fire && i >= a.fire[0] && !an.fired) {
      an.fired = true;
      const end = a.durs.slice(0, a.fire[1] + 1).reduce((x, y) => x + y, 0);
      this.attacks.push({ kind: 'beam', ev: an.ev, name, t: 0, dur: end - an.t, hit: false, puff: 0, burn: 0 });
      this.r.shake = Math.max(this.r.shake, 3);
    }
  }

  drawAttacks(ctx, dt) {
    const r = this.r;
    const d = this.drawn;
    // Charge lumineuse dans les yeux (avant le faisceau) : lueur posée sur chaque œil, image par image.
    const ca = d && COLOSSUS_ANIMS[d.name]?.charge;
    if (ca && this.anim?.name === d.name && d.i >= ca[0] - 1 && d.i <= ca[1] + 1) {
      const e = this.eyes();
      const p = Math.min(1, Math.max(0.2, (this.anim.t - 0.2) / 0.5));
      const fi = Math.floor(r.time * 14) % 8;
      for (const [ex, ey] of e) drawVfxFrame(ctx, 'wb_eye_charge', fi, ex, ey, { size: 0.5 + p * 0.9, tint: d.name === 'beam3' ? '#ff8a2a' : null, alpha: 0.9 });
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const [ex, ey] of e) {
        const g = ctx.createRadialGradient(ex, ey, 0, ex, ey, 6 + p * 8);
        g.addColorStop(0, BEAM_COLORS[d.name][2]);
        g.addColorStop(0.4, BEAM_COLORS[d.name][0]);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.globalAlpha = 0.5 + 0.4 * p;
        ctx.fillRect(ex - 16, ey - 16, 32, 32);
      }
      ctx.restore();
    }
    for (const at of this.attacks) {
      at.t += dt;
      if (at.kind === 'boulder') this.drawBoulder(ctx, at);
      else this.drawBeam(ctx, at, dt);
    }
    this.attacks = this.attacks.filter((at) => at.t < at.dur);
  }

  // Rocher en arc : il tourne, son ombre grandit au sol ; à l'arrivée, impact, débris, poussière, secousse.
  drawBoulder(ctx, at) {
    const r = this.r;
    const u = Math.min(1, at.t / at.dur);
    const x = at.x0 + (at.x1 - at.x0) * u;
    const y = at.y0 + (at.y1 - at.y0) * u * u - at.arc * Math.sin(Math.PI * u) * (1 - 0.35 * u);
    ctx.save();
    ctx.globalAlpha = 0.15 + 0.35 * u;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(at.x1, r.groundY + 1, 6 + 12 * u, 2 + 2 * u, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    drawVfxFrame(ctx, 'wb_boulder', Math.floor(at.t * 16) % 6, x, y, { size: 2.6, tint: at.fire ? '#ff6a2a' : null, rot: at.t * -9 });
    if (at.fire && Math.random() < 0.6) r.burst(x, y, '#ff8a3d', 1, 12);
    if (u >= 1 && !at.landed) {
      at.landed = true;
      at.dur = at.t; // le rocher disparaît : il s'est brisé
      const G = r.groundY;
      vfx(r, 'wb_rock_impact', at.x1, G - 4, { size: 1.6 });
      vfx(r, 'wb_rock_dust', at.x1, G - 6, { size: 1.5, delay: 0.08 });
      vfx(r, 'mut_stomp', at.x1, G, { size: 1.5 });
      vfx(r, 'dust_land', at.x1 - 30, G, { size: 1.4, delay: 0.1 });
      vfx(r, 'dust_land', at.x1 + 30, G, { size: 1.4, delay: 0.1, flip: true });
      r.burst(at.x1, G - 8, '#7d7466', 22, 90);
      r.burst(at.x1, G - 8, '#4e5a4c', 14, 70);
      if (at.fire) r.burst(at.x1, G - 10, '#ff7a2a', 16, 80);
      r.effects.push({ kind: 'flash', life: 0.12, max: 0.12, color: '#ffffff' });
      r.hitstop = Math.max(r.hitstop ?? 0, 0.06);
      r.shake = Math.max(r.shake, 8);
      this.heroHurt(at.ev, 0.02, 8);
    }
  }

  // Faisceau des yeux : deux rayons partis des yeux (image dessinée) qui convergent au sol et balaient l'équipe,
  // d'au-devant du héros jusque derrière le dernier compagnon ; brûlure au sol, éclats, secousse continue.
  drawBeam(ctx, at, dt) {
    const r = this.r;
    const e = this.eyes();
    if (!e || this.anim?.name !== at.name) { at.dur = 0; return; }
    const u = Math.min(1, at.t / at.dur);
    const heroX = this.heroX();
    const from = heroX + 70;
    const to = heroX - 70;
    const tx = from + (to - from) * u;
    const ty = r.groundY - 2;
    const [c0, c1, c2] = BEAM_COLORS[at.name];
    const fade = Math.min(1, at.t * 10, (at.dur - at.t) * 8);
    const wob = 1 + 0.25 * Math.sin(r.time * 60);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (const [w, c, al] of [[11, c0, 0.28], [6, c1, 0.6], [2.2, c2, 1]]) {
      ctx.strokeStyle = c;
      ctx.globalAlpha = al * fade;
      ctx.lineWidth = w * wob;
      ctx.beginPath();
      for (const [ex, ey] of e) { ctx.moveTo(ex, ey); ctx.lineTo(tx, ty); }
      ctx.stroke();
    }
    // Éclat sur les yeux.
    for (const [ex, ey] of e) {
      const g = ctx.createRadialGradient(ex, ey, 0, ex, ey, 9);
      g.addColorStop(0, c2); g.addColorStop(0.5, c0); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.globalAlpha = fade; ctx.fillRect(ex - 10, ey - 10, 20, 20);
    }
    ctx.restore();
    at.puff -= dt;
    at.burn -= dt;
    if (at.puff <= 0) {
      at.puff = 0.1;
      vfx(r, 'wb_beam_flash', tx, ty - 4, { size: 1.1, tint: at.name === 'beam3' ? '#ff7a2a' : null });
      r.burst(tx, ty - 3, c1, 5, 55);
    }
    if (at.burn <= 0) {
      at.burn = 0.14;
      vfx(r, 'wb_beam_burn', tx, ty + 2, { size: 0.9, tint: at.name === 'beam3' ? '#ff6a1a' : null });
    }
    r.shake = Math.max(r.shake, 2.5);
    if (!at.hit && tx <= heroX + 6) {
      at.hit = true;
      this.heroHurt(at.ev, 0, 6);
      r.effects.push({ kind: 'flash', life: 0.1, max: 0.1, color: c1 });
    }
  }

  resize(w, h) { this.r.resize(w, h); }

  // Position à l'écran du boss (pixels logiques de la scène), d'après sa dernière image dessinée.
  bossBox() {
    const b = this.fight.boss;
    const fx = b && this.r.enemyFx.get(b.id);
    if (!fx?.sw) return null;
    return { x: fx.sx + fx.sw / 2, y: fx.sy + fx.sh * 0.45, top: fx.sy, w: fx.sw, h: fx.sh, foot: this.r.groundY };
  }

  // Un pas d'affichage : événements du moteur → renderer ; événements du World Boss → effets ; puis dessin.
  frame(dt) {
    const { fight, r } = this;
    const world = fight.world;
    const boss = fight.boss;
    this.clock += dt;
    // Le boss géant déborde vers la gauche de son point d'appui : à l'écran il se tient un peu plus loin (le moteur,
    // lui, garde sa vraie position ; les événements qui le visent sont décalés d'autant).
    const off = boss ? BOSS_OFFSET : 0;
    if (boss) { boss.x += off; boss.prevX = (boss.prevX ?? boss.x) + off; }
    for (const e of world.events) {
      if (off && e.enemyId === boss.id && e.x !== undefined) e.x += off;
      if (off && e.targets) for (const t of e.targets) if (t.id === boss.id) t.x += off;
      r.handleEvent(e, world);
      if (boss && !this.anim) {
        if (e.type === 'enemyWindup' && e.enemyId === boss.id) this.play(this.fight.phase >= 3 ? 'attack3' : 'attack');
        else if (e.type === 'heroAttack' && e.crit && e.enemyId === boss.id && this.clock - this.hurtAt > 2.5) { this.hurtAt = this.clock; this.play(this.fight.phase >= 3 ? 'hurt3' : 'hurt'); }
      }
    }
    world.events.length = 0;
    while (this.seen < fight.out.length) this.special(fight.out[this.seen++]);
    this.aura(dt);
    // Barre du boss dans la scène : PV virtuels de la barre en cours (le moteur, lui, le garde immortel).
    const keep = boss ? [boss.hp, boss.maxHp] : null;
    if (boss) { boss.maxHp = 1000; boss.hp = Math.max(1, 1000 * fight.progress().frac); }
    r.render(fight.state, world, dt);
    if (boss) { [boss.hp, boss.maxHp] = keep; boss.x -= off; boss.prevX -= off; }
  }

  // Quelques images sans combat (fin de tentative, image fixe) : les effets retombent, le boss respire.
  settle(n = 30) {
    for (let i = 0; i < n; i++) this.frame(1 / 60);
  }

  aura(dt) {
    const box = this.bossBox();
    const phase = this.fight.phase;
    if (!box || phase === 0) return;
    this.auraAt -= dt;
    if (this.auraAt > 0) return;
    this.auraAt = this.r.focus ? 2.5 : 1.1 - phase * 0.2;
    const color = PHASE_COLORS[phase];
    vfx(this.r, phase >= 3 ? 'boss_rage' : 'buff_aura', box.x, box.foot, { tint: color, size: 1.4 + phase * 0.35, alpha: 0.55 });
    if (phase >= 2) this.r.burst(box.x, box.top + box.h * 0.3, color, 4 + phase * 2, 40);
  }

  // Attaques spéciales des phases et Éveil.
  special(ev) {
    const r = this.r;
    const box = this.bossBox() ?? { x: r.width * 0.7, y: r.groundY - 50, top: r.groundY - 100, w: 80, h: 100, foot: r.groundY };
    const heroX = BALANCE.world.heroX * WORLD_SCALE;
    const hurt = (delay) => r.later(delay, () => {
      r.hero.hurt = 0.3;
      vfx(r, 'hit_blunt', heroX + 8, r.groundY - 20, { size: 1.3, flip: true });
      r.addText(formatNumber(Math.round(ev.damage)), heroX - 4, r.groundY - 54, '#ff5a5a', '#ffd0d0', true);
      r.shake = Math.max(r.shake, 5);
    });
    const color = PHASE_COLORS[ev.phase ?? 3];
    if (ev.type === 'ability') {
      // v9.3.0 : jet de pierre / rayon des yeux. Animations réduites : seulement le coup reçu.
      if (r.focus) { this.heroHurt(ev, 0.3, 0); return; }
      const p3 = this.fight.phase >= 3;
      this.play(ev.id === 'boulder' ? (p3 ? 'throw3' : 'throw') : (p3 ? 'beam3' : 'beam'));
      this.anim.ev = ev;
      if (ev.id === 'eyebeam') vfx(r, 'boss_rage', box.x, box.foot, { size: 1.6, tint: p3 ? '#ff7a2a' : '#5ff6ff', alpha: 0.6 });
      return;
    }
    if (ev.type === 'awaken') {
      this.play('death', 'rise'); // chute du Colosse, puis il se relève
      vfx(r, 'boss_explode', box.x, box.y, { size: 2.2 });
      r.later(0.5, () => vfx(r, 'boss_appear', box.x, box.foot + 2, { size: 2 }));
      r.effects.push({ kind: 'beam', x: Math.round(box.x), color: '#ffd23f', life: 1.2, max: 1.2, wide: true });
      r.burst(box.x, box.y, '#ffd23f', 30, 80);
      r.shake = Math.max(r.shake, 6);
      return;
    }
    vfx(r, 'boss_rage', box.x, box.foot, { size: 2.4, tint: color });
    r.burst(box.x, box.top + 10, color, 24, 70);
    if (ev.id === 'quake') {
      // Séisme : le Colosse frappe le sol des deux poings, l'onde court jusqu'au héros.
      this.play('quake');
      for (let i = 0; i < 5; i++) {
        const x = box.x - (box.x - heroX) * (i / 4);
        r.later(0.15 + i * 0.09, () => { vfx(r, 'mut_stomp', x, r.groundY, { size: 1.6 }); vfx(r, 'dust_land', x, r.groundY, { size: 1.5 }); });
      }
      hurt(0.6);
    } else if (ev.id === 'meteors') {
      // Pluie de braises : il lève les bras, les runes s'embrasent, les météores tombent sur toute l'équipe.
      this.play('embers');
      for (let i = 0; i < 6; i++) r.later(0.5 + i * 0.12, () => vfx(r, 'sk_meteor', heroX - 40 + i * 22, r.groundY, { size: 1.2, tint: color }));
      hurt(1.1);
    } else {
      // Fureur : le Colosse se fissure et s'embrase (transformation), rugit, puis colonne de feu sur le héros.
      this.play('transform', 'fury');
      r.later(1.3, () => r.effects.push({ kind: 'beam', x: heroX, color: '#ff2a4a', life: 1, max: 1, wide: true }));
      r.later(1.4, () => vfx(r, 'sk_hellfire', heroX + 6, r.groundY, { size: 1.6 }));
      hurt(1.5);
    }
  }
}

export const worldBossSeconds = () => WORLD_BOSS.seconds;
