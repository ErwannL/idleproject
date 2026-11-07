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
import { vfx } from './vfx.js';
import { WORLD_BOSS } from '../core/world-boss.js';

// Décalage à l'écran du boss géant (unités du monde de la simulation).
const BOSS_OFFSET = 34;

// Animations du Colosse : bandes horizontales d'images 128×128 (première et dernière identiques pour les boucles).
const FRAME = 128;
const FOOT = 122; // ligne des pieds dans l'image source
export const COLOSSUS_ANIMS = {
  idle: { n: 8, fps: 7, loop: true }, idle3: { n: 8, fps: 9, loop: true },
  attack: { n: 9, fps: 16 }, attack3: { n: 9, fps: 18 }, hurt: { n: 9, fps: 18 },
  quake: { n: 9, fps: 11 }, embers: { n: 9, fps: 11 }, fury: { n: 9, fps: 12 },
  transform: { n: 13, fps: 12 }, death: { n: 13, fps: 10 }, rise: { n: 13, fps: 14, src: 'death', reverse: true },
};
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
  }

  // Animation ponctuelle (attaque, phase…), puis retour au repos (ou à `then`).
  play(name, then = null) {
    if (this.r.focus) return; // « Réduire les animations » : poses fixes
    this.anim = { name, t: 0, then };
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
      const k = Math.floor(this.anim.t * a.fps);
      if (k >= a.n) {
        const then = this.anim.then;
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
    // Repères pour les effets du renderer (coups, projectiles, chiffres) : la silhouette visible du Colosse.
    const fx = r.enemyFxFor(boss.id);
    Object.assign(fx, { sx: x + 8 * k, sy: y + 6 * k, sw: 112 * k, sh: 116 * k, seen: r.time, edge: x + 18 * k, landed: true, appear: 1, hit: 0 });
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
        else if (e.type === 'heroAttack' && e.crit && e.enemyId === boss.id && this.clock - this.hurtAt > 2.5) { this.hurtAt = this.clock; this.play('hurt'); }
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
