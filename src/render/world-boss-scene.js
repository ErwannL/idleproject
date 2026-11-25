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
import { GRAND_BOSSES, grandBoss } from '../data/grand-bosses.js';
import { COMPANIONS } from '../data/companions.js'; // v9.7.1 (lot 7)

// Décalage à l'écran du boss géant (unités du monde de la simulation).
const BOSS_OFFSET = 34;

// v9.7.1 (lot 7) : planches, ancrages (yeux, main) et couleurs du rayon lus dans la fiche du grand boss
// (data/grand-bosses.js) : un nouveau Titan ne demande aucune modification de cette scène.
export const COLOSSUS_ANIMS = GRAND_BOSSES.colossus.art.anims;
export const COLOSSUS_EYES = GRAND_BOSSES.colossus.art.eyes;

// Image d'une animation à l'instant t (s) : durées par image (`durs`) ou cadence fixe (`fps`). -1 : terminée.
export function animFrameAt(a, t) {
  if (!a.durs) { const k = Math.floor(t * a.fps); return k >= a.n ? -1 : k; }
  let acc = 0;
  for (let i = 0; i < a.n; i++) { acc += a.durs[i]; if (t < acc) return i; }
  return -1;
}
export const animLength = (a) => (a.durs ? a.durs.reduce((x, y) => x + y, 0) : a.n / a.fps);

// v10.15 : un grand boss d'une autre forme (Léviathan, Hydre…) n'a pas forcément toutes les planches du Colosse.
// Une animation absente prend la suivante de cette chaîne (ex. `beam3` → `beam` → `attack`) ; `idle` et `attack`
// suffisent pour qu'un boss joue tout le combat.
export const ANIM_FALLBACK = {
  idle3: 'idle', attack3: 'attack', hurt3: 'hurt', hurt: 'idle',
  throw3: 'throw', throw: 'attack', beam3: 'beam', beam: 'attack',
  quake: 'attack', embers: 'attack', fury: 'idle3', transform: 'hurt', death: 'hurt', rise: 'idle',
};
export function resolveAnim(art, name) {
  let n = name;
  for (let i = 0; i < 8 && n && !art.anims[n]; i++) n = ANIM_FALLBACK[n];
  return n && art.anims[n] ? n : 'idle';
}
// v10.15 : repères d'une planche (pixels de l'image source). Par défaut ceux du Colosse (images de 128 px).
export function artLook(art) {
  const s = art.frame / 128;
  return {
    box: art.box ?? [8 * s, 6 * s, 112 * s, 116 * s], // silhouette visible : x, y, largeur, hauteur
    shadow: art.shadow ?? 44 * s, // demi-largeur de l'ombre au sol
    debris: art.debris === undefined ? '#6e665a' : art.debris, // cailloux qui tombent au repos (null : aucun)
    debrisAt: art.debrisAt ?? [[30 * s, 40 * s], [92 * s, 40 * s]],
    projectile: { vfx: 'wb_boulder', tint: null, tint3: '#ff6a2a', size: 2.6, spin: 9, dust: ['#7d7466', '#4e5a4c'], ...art.projectile },
  };
}
const IMAGES = {};
function sheet(art, name) {
  if (typeof Image === 'undefined') return null;
  const url = `${art.dir}/${art.prefix}${name}.png`;
  if (!IMAGES[url]) { const im = new Image(); im.src = url; IMAGES[url] = im; }
  const im = IMAGES[url];
  return im.complete && im.naturalWidth ? im : null;
}
export function preloadColossus(art = GRAND_BOSSES.colossus.art) { for (const [k, a] of Object.entries(art.anims)) sheet(art, a.src ?? k); }

// Couleurs de l'aura selon la phase (0 = avant la première phase).
export const PHASE_COLORS = ['#ffb347', '#ff8a3d', '#ff5a3d', '#ff2a4a'];

export class WorldBossScene {
  constructor(canvas, fight, { calm = false } = {}) {
    this.canvas = canvas;
    this.fight = fight;
    this.r = new SceneRenderer(canvas);
    this.r.calm = calm;
    this.r.bigBoss = true;
    this.r.groundLift = 0.8; // v9.11 (2) : boss et équipe plus bas, l'écran est rempli // v9.11 (2) : effets limités (render/vfx.js)
    this.allyBeat = 0.6;
    this.pebbleAt = 1;
    this.seen = 0;
    this.auraAt = 0;
    this.flashEnd = 0;
    this.clock = 0;
    this.noFlashUntil = 0;
    this.anim = null; // animation ponctuelle en cours : { name, t, then }
    this.hurtAt = -9;
    this.appear = 0;
    this.art = grandBoss(fight.bossId).art; // v9.7.1 (lot 7) : fiche du grand boss
    this.look = artLook(this.art); // v10.15 : repères propres à la planche (silhouette, ombre, projectile)
    preloadColossus(this.art);
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
    this.anim = { name: resolveAnim(this.art, name), t: 0, then }; // v10.15 : planche absente → la plus proche
  }

  // v9.3.0 : une attaque propre coupée avant son coup (chute du Colosse…) frappe quand même : dégâts affichés.
  interrupt() {
    const a = this.anim;
    if (a?.ev && !a.fired) { a.fired = true; this.heroHurt(a.ev, 0, 5); }
    this.attacks = this.attacks.filter((x) => x.kind !== 'beam');
  }

  get scale() { return (1.15 + 0.06 * this.fight.phase) * (this.art.scaleMul ?? 1); } // v10.15 : scaleMul = grandes planches (192 px) réduites pour tenir dans le cadre en phase 3

  drawColossus(ctx, boss, dt) {
    const r = this.r;
    this.appear = Math.min(1, this.appear + dt * 1.5);
    const phase3 = this.fight.phase >= 3;
    let name = resolveAnim(this.art, phase3 ? 'idle3' : 'idle');
    let i = 0;
    if (this.anim) {
      const a = this.art.anims[this.anim.name];
      this.anim.t += dt;
      const k = animFrameAt(a, this.anim.t);
      if (k < 0) {
        const then = this.anim.then;
        this.interrupt();
        this.anim = then ? { name: resolveAnim(this.art, then), t: 0, then: null } : null;
      } else { name = this.anim.name; i = a.reverse ? a.n - 1 - k : k; }
    }
    let breathe = 0;
    if (!this.anim || name === 'idle' || name === 'idle3') { // repos
      const a = this.art.anims[name];
      // v9.11 (2) : repos à 11 images/s au moins, avec une respiration (le corps monte et descend doucement).
      i = r.focus ? 0 : Math.floor(r.time * Math.max(11, a.fps)) % a.n;
      breathe = r.focus ? 0 : Math.sin(r.time * 2.2) * 1.6;
    }
    const a = this.art.anims[name];
    const im = sheet(this.art, a.src ?? name);
    const k = this.scale;
    const w = this.art.frame * k;
    const cx = r.wx(boss.x) + 14;
    const x = Math.round(cx - w / 2);
    const y = Math.round(r.groundY + 1 - this.art.foot * k + breathe);
    // Ombre au sol, puis le Colosse (pieds sur la ligne du sol).
    ctx.save();
    ctx.globalAlpha = 0.35 * this.appear;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(cx, r.groundY + 1, this.look.shadow * k, 6 * k, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = this.appear;
    if (this.art.filter) ctx.filter = this.art.filter; // teinte d'une fiche (boss d'essai)
    if (im) ctx.drawImage(im, i * this.art.frame, 0, this.art.frame, this.art.frame, x, y, w, w);
    ctx.filter = 'none';
    ctx.restore();
    // v9.3.0 : image dessinée (pour caler le rocher et le faisceau sur la main et les yeux), déclencheurs des attaques.
    this.drawn = { name, i, x, y, k };
    // v9.11 (2) : au repos, les yeux luisent et des cailloux tombent des épaules.
    if (!r.focus && (name === 'idle' || name === 'idle3')) {
      const eye = this.art.eyes?.beam?.[0];
      if (eye) {
        const glow = 0.35 + 0.25 * Math.sin(r.time * 3.1);
        const col = this.art.beamColors.beam[0];
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (const [ex, ey] of [[eye[0], eye[1]], [eye[2], eye[3]]]) {
          const px = x + (ex + 0.5) * k, py = y + (ey + 0.5) * k;
          const g = ctx.createRadialGradient(px, py, 0, px, py, 5 * k);
          g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.globalAlpha = glow; ctx.fillStyle = g; ctx.fillRect(px - 6 * k, py - 6 * k, 12 * k, 12 * k);
        }
        ctx.restore();
      }
      this.pebbleAt -= dt;
      if (this.pebbleAt <= 0 && this.look.debris) { // v10.15 : couleur et points de chute propres au boss
        this.pebbleAt = 0.7 + Math.random() * 0.9;
        const [sx, sy] = this.look.debrisAt[Math.floor(Math.random() * this.look.debrisAt.length)];
        r.effects.push({ kind: 'particle', x: x + sx * k, y: y + sy * k, vx: (Math.random() - 0.5) * 8, vy: 4, life: 0.9, max: 0.9, color: this.look.debris, size: 2, gravity: 160 });
      }
    }
    if (this.anim?.ev && this.anim.name === name) this.attackStep(name, i);
    // Repères pour les effets du renderer (coups, projectiles, chiffres) : la silhouette visible du Colosse.
    const fx = r.enemyFxFor(boss.id);
    const [bx, by, bw, bh] = this.look.box;
    Object.assign(fx, { sx: x + bx * k, sy: y + by * k, sw: bw * k, sh: bh * k, seen: r.time, edge: x + (bx + 10) * k, landed: true, appear: 1, hit: 0 });
  }

  // v9.3.0 : pixel (px, py) de l'image source du Colosse → écran (d'après la dernière image dessinée).
  at(px, py) {
    const d = this.drawn;
    return d ? [d.x + px * d.k, d.y + py * d.k] : [0, 0];
  }

  // Yeux sur l'image dessinée (animations du rayon seulement).
  eyes() {
    const d = this.drawn;
    const e = d && this.art.eyes?.[d.name]?.[d.i];
    return e ? [this.at(e[0] + 0.5, e[1] + 0.5), this.at(e[2] + 0.5, e[3] + 0.5)] : null;
  }

  heroX() { return BALANCE.world.heroX * WORLD_SCALE; }

  // Dégâts d'une attaque reçus par le héros (chiffre, choc, secousse).
  heroHurt(ev, delay = 0, shake = 6) {
    const r = this.r;
    const heroX = this.heroX();
    r.later(delay, () => {
      r.hero.hurt = 0.3;
      r.teamHurt = r.time + 0.3; // v9.11 (2) : l'équipe tremble
      vfx(r, 'hit_blunt', heroX + 8, r.groundY - 20, { size: 1.3, flip: true });
      r.addText(formatNumber(Math.round(ev.damage)), heroX - 4, r.groundY - 54, '#ff5a5a', '#ffd0d0', true);
      r.shake = Math.max(r.shake, shake);
    });
  }

  // Images clés des attaques propres : le rocher quitte la main, le faisceau s'allume.
  attackStep(name, i) {
    const a = this.art.anims[name];
    const an = this.anim;
    if (a.release !== undefined && i >= a.release && !an.fired) {
      an.fired = true;
      const [hx, hy] = this.at(...(this.art.hands?.[name] ?? this.art.hands?.throw ?? [16, 34]));
      const tx = this.heroX() - 14;
      this.r.teamBrace = this.r.time + 0.9; // v9.11 (2) : l'équipe se protège du rocher
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
    const ca = d && this.art.anims[d.name]?.charge;
    if (ca && this.anim?.name === d.name && d.i >= ca[0] - 1 && d.i <= ca[1] + 1) {
      const e = this.eyes();
      const p = Math.min(1, Math.max(0.2, (this.anim.t - 0.2) / 0.5));
      const fi = Math.floor(r.time * 14) % 8;
      for (const [ex, ey] of e) drawVfxFrame(ctx, 'wb_eye_charge', fi, ex, ey, { size: 0.5 + p * 0.9, tint: d.name === 'beam3' ? '#ff8a2a' : null, alpha: 0.9 });
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const [ex, ey] of e) {
        const g = ctx.createRadialGradient(ex, ey, 0, ex, ey, 6 + p * 8);
        const bc = this.art.beamColors[d.name] ?? this.art.beamColors.beam;
        g.addColorStop(0, bc[2]);
        g.addColorStop(0.4, bc[0]);
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
    const pj = this.look.projectile; // v10.15 : projectile propre au boss (rocher, bulle d'acide, glaçon…)
    drawVfxFrame(ctx, pj.vfx, Math.floor(at.t * 16) % 6, x, y, { size: pj.size, tint: at.fire ? pj.tint3 : pj.tint, rot: at.t * -pj.spin });
    if (at.fire && Math.random() < 0.6) r.burst(x, y, pj.tint3 ?? '#ff8a3d', 1, 12);
    if (u >= 1 && !at.landed) {
      at.landed = true;
      at.dur = at.t; // le rocher disparaît : il s'est brisé
      const G = r.groundY;
      vfx(r, 'wb_rock_impact', at.x1, G - 4, { size: 1.6 });
      vfx(r, 'wb_rock_dust', at.x1, G - 6, { size: 1.5, delay: 0.08 });
      vfx(r, 'mut_stomp', at.x1, G, { size: 1.5 });
      vfx(r, 'dust_land', at.x1 - 30, G, { size: 1.4, delay: 0.1 });
      vfx(r, 'dust_land', at.x1 + 30, G, { size: 1.4, delay: 0.1, flip: true });
      r.burst(at.x1, G - 8, pj.dust[0], 22, 90);
      r.burst(at.x1, G - 8, pj.dust[1], 14, 70);
      if (at.fire) r.burst(at.x1, G - 10, '#ff7a2a', 16, 80);
      r.effects.push({ kind: 'flash', life: 0.12, max: 0.12, color: '#ffffff' });
      r.hitstop = Math.max(r.hitstop ?? 0, 0.06);
      r.shake = Math.max(r.shake, 8);
      this.heroHurt(at.ev, 0.02, 8);
    }
  }

  // Faisceau des yeux : un seul rayon parti du milieu des yeux (v9.7.1), qui touche le sol et balaient l'équipe,
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
    const [c0, c1, c2] = this.art.beamColors[at.name] ?? this.art.beamColors.beam;
    const fade = Math.min(1, at.t * 10, (at.dur - at.t) * 8);
    const wob = 1 + 0.25 * Math.sin(r.time * 60);
    const mx = (e[0][0] + e[1][0]) / 2, my = (e[0][1] + e[1][1]) / 2;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (const [w, c, al] of [[11, c0, 0.28], [6, c1, 0.6], [2.2, c2, 1]]) {
      ctx.strokeStyle = c;
      ctx.globalAlpha = al * fade;
      ctx.lineWidth = w * wob;
      ctx.beginPath();
      // v9.7.1 (lot D) : un seul faisceau, parti du milieu des deux yeux (avant : un trait par œil, deux rayons visibles).
      ctx.moveTo(mx, my); ctx.lineTo(tx, ty);
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
    // v10.15 : un géant très large (planches de 192 px) se tient plus à gauche : art.dx (PC) / art.dxPhone (portrait), en px de l'écran.
    const shift = this.art.dx === undefined ? 0 : (r.width < 340 ? (this.art.dxPhone ?? this.art.dx) : this.art.dx) / WORLD_SCALE;
    const off = boss ? BOSS_OFFSET - shift : 0;
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
    // v9.11 (2) : l'équipe frappe à tour de rôle (un pas en avant, coup, retour) au lieu de rester figée.
    this.allyBeat -= dt;
    if (boss && this.allyBeat <= 0 && !r.focus) {
      const team = (fight.state.companions?.equipped ?? []).map((id) => COMPANIONS.find((c) => c.id === id)).filter((c) => c?.kind === 'ally');
      if (team.length) {
        const c = team[(this.allyTurn = ((this.allyTurn ?? -1) + 1) % team.length)];
        if (!r.allyAnims?.get(c.id)) r.allyGesture(c, world, BALANCE.world.heroX * WORLD_SCALE);
      }
      this.allyBeat = 0.55 + Math.random() * 0.3;
    }
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
      if (ev.id === 'eyebeam') vfx(r, 'boss_rage', box.x, box.foot, { size: 1.6, tint: p3 ? '#ff7a2a' : (this.art.beamColors?.beam?.[0] ?? '#5ff6ff'), alpha: 0.6 });
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
