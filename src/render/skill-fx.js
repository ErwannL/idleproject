// v9.2.5 : animations de compétence — un GESTE propre au lanceur (images PixelLab, src/render/art-anim-skills.js généré
// par tools/art/pixellab_skills.py) et un EFFET propre à la compétence, synchronisé avec le geste : la météorite apparaît
// en haut quand les bras se lèvent, tombe en diagonale avec sa traînée, s'écrase (cratère, secousse, débris) ; la prière
// fait descendre un rayon de lumière et des plumes, puis une aura sur l'équipe ; etc.
// « Réduire les animations » (scene.focus) : le geste reste, l'effet devient sobre (un halo et un éclat à sa couleur).
// Tout est dessiné en pixels de jeu (fillRect sur des coordonnées entières) pour rester dans le style du jeu.
import { SKILLS } from '../data/skills.js'; // v9.7.1 (lot 6)
import { COMPANIONS } from '../data/companions.js';
import { COMPANION_ROLES } from '../data/synergies.js';
import { SKILL_TEMPLATES, themedTemplate } from '../data/companion-skills.js';
import { HERO_SKILL_MOTIFS, SKILL_ANIM_ART, SKILL_ANIM_PALS, SKILL_ANIMS, UNIT_SKILL_MOTIFS } from './art-anim-skills.js';
import { SPRITES, expandRow } from './sprites.js';
import { vfx, vfx2Ready, VFX as VFX_ALL } from './vfx.js'; // v9.2.6
import { skillVfx } from './vfx-world.js'; // v9.2.6 : effet dessiné propre à chaque compétence
import { ALLY_ANIMS, knightHead, weaponPose } from './ally-anim.js';
import { KNIGHT_HEAD } from './knight-gear.js';

// Images ajoutées aux SPRITES au chargement (même encodage que les animations des alliés : une ligne vide reprend la
// même ligne de l'image précédente).
for (const anims of Object.values(SKILL_ANIMS)) {
  for (const a of Object.values(anims)) {
    let prev = null;
    for (const f of a.frames) {
      const rows = SKILL_ANIM_ART[f].rows.map((r, y) => (r === '' && prev ? prev[y] : expandRow(r)));
      if (!SPRITES[f]) SPRITES[f] = { ...SKILL_ANIM_ART[f], rows, pal: SKILL_ANIM_PALS[SKILL_ANIM_ART[f].pr] };
      prev = rows;
    }
  }
}

// v9.7.1 (lot 6) : compétences de classe — geste et effet repris par type (et sorts dédiés : météore, volée).
for (const sk of SKILLS) {
  if (!sk.cls || HERO_SKILL_MOTIFS[sk.id]) continue;
  const own = sk.cls === 'pyromancer' && sk.type === 'aoe' ? 'meteor' : sk.cls === 'archer' && sk.type === 'aoe' ? 'volley' : null;
  HERO_SKILL_MOTIFS[sk.id] = HERO_SKILL_MOTIFS[own ?? { hit: 'quick', aoe: 'whirl', buff: 'cry', holy: 'holy' }[sk.type]];
}
export { HERO_SKILL_MOTIFS, SKILL_ANIMS, UNIT_SKILL_MOTIFS };


// Instant du geste où l'effet part (fraction de sa durée) : bras levés, mains jointes, bâton planté…
export const RELEASE_K = 0.4;
const DEFAULT_TIME = 0.95;

// Repli quand une compétence n'est pas dans la table (perso de bannière…) : motif et effet selon le type.
const BY_TYPE = { hit: ['slash', 'heavy_cut'], burst: ['raise_arms', 'hellfire'], heal: ['open_hands', 'divine_light'],
  shield: ['raise_shield', 'holy_shield'], rally: ['roar', 'war_howl'], gold: ['open_hands', 'harvest'] };

export const gestureTime = (anim) => (anim ? anim.frames.length / anim.fps : DEFAULT_TIME);

// Image du geste en cours (ou null) : { name, ox, oy }.
export function gestureFrame(g, time) {
  if (!g?.anim) return null;
  const k = (time - g.start) / g.dur;
  if (k < 0 || k >= 1) return null;
  const a = g.anim;
  const i = Math.min(a.frames.length - 1, Math.floor(k * a.frames.length));
  return { name: a.frames[i], ox: a.ox, oy: a.oy, i, k };
}

// v9.2.5 : gestes où l'arme équipée reste en main (prise suivie image par image) ; les autres la rangent dans le dos.
export const HELD_MOTIFS = new Set(['raise_staff', 'attack_archer']);
// Arc de la pluie de flèches incliné vers le ciel (degrés, sens horaire négatif = vers le haut).
const AIM_UP = { attack_archer: -50 };
// Tourbillon : le corps se retourne en miroir plusieurs fois au milieu du geste (rotation sur place) ; vues de dos
// écartées à la génération (tools/art/pixellab_skills.py SKIP), la rotation est rendue par ce miroir alterné.
export function spinFlip(g, k) {
  return g?.motif === 'sweep' && k > 0.2 && k < 0.7 && Math.floor((k - 0.2) / 0.0625) % 2 === 1;
}

// Image du geste du héros au format de ally-anim.js pickHeroAnim ({ name, anim, ox, oy, weapon, head }), pour
// hero-draw.js drawHeroPick : le chevalier y porte son vrai casque et sa vraie armure (tête suivie : knight-gear.js,
// clés skill_<motif>), l'arme vraiment équipée est posée sur la prise (gestes tenus) ; null hors geste.
export function heroGesturePick(scene) {
  const g = scene.heroSkill;
  const f = heroGesture(scene);
  if (!f) return null;
  const a = g.anim;
  const own = g.key === 'hero_knight' && !Object.values(ALLY_ANIMS.hero_knight ?? {}).includes(a);
  const head = own ? KNIGHT_HEAD.heads[`skill_${g.motif}`]?.[f.i] ?? null : knightHead(a, f.i);
  let weapon = HELD_MOTIFS.has(g.motif) ? weaponPose(a, f.i) : null;
  if (weapon && AIM_UP[g.motif]) weapon = { ...weapon, deg: (weapon.deg + AIM_UP[g.motif] * Math.sin(Math.min(1, f.k * 2.5) * Math.PI * 0.5) + 360) % 360 };
  return { name: f.name, anim: a, ox: a.ox, oy: a.oy, weapon, head, held: HELD_MOTIFS.has(g.motif), flip: spinFlip(g, f.k) };
}

// --- Lancement ---------------------------------------------------------------------------------------------------

// Héros : compétence active (quick, whirl, cry, holy) ou attaque spéciale de classe (meteor, volley).
// `key` : clé des animations du héros (hero_<apparence>). Renvoie true si l'effet est pris en charge.
export function castHeroSkill(scene, key, skill, ctxInfo) {
  const entry = HERO_SKILL_MOTIFS[skill];
  if (!entry || scene.underwater) return false;
  const [motif, fx] = entry;
  // v9.2.5 : un geste peut reprendre une animation PixelLab des alliés (attack_archer pour la pluie de flèches).
  const anim = SKILL_ANIMS[key]?.[motif] ?? ALLY_ANIMS[key]?.[motif] ?? null;
  const dur = gestureTime(anim);
  scene.heroSkill = { anim, motif, key, start: scene.time, dur };
  run(scene, fx, { ...ctxInfo, release: dur * RELEASE_K, dur });
  return true;
}

// v9.2.5 : gestes PixelLab dont l'arme change de forme (le barbare y tient une épée au lieu de sa hache ; relevé sur
// planches agrandies de tous les gestes) : le compagnon rejoue son attaque, même arme qu'en marche.
export const WEAPON_SHAPE_SWAP = { ally_barbarian: ['blade_dance', 'ground_smash'] };
export function unitSkillAnim(sprite, motif) {
  if (WEAPON_SHAPE_SWAP[sprite]?.includes(motif) && ALLY_ANIMS[sprite]?.attack) return ALLY_ANIMS[sprite].attack;
  return SKILL_ANIMS[sprite]?.[motif] ?? null;
}

// Compagnon (héros allié ou familier) : `name` = nom de la compétence lancée, `type` = son type.
export function castUnitSkill(scene, companion, name, type, ctxInfo) {
  const entry = UNIT_SKILL_MOTIFS[companion.sprite]?.[name] ?? BY_TYPE[type] ?? BY_TYPE.hit;
  const [motif, fx] = entry;
  const anim = scene.underwater ? null : unitSkillAnim(companion.sprite, motif);
  const dur = gestureTime(anim);
  (scene.unitSkills ??= new Map()).set(companion.id, { anim, start: scene.time, dur });
  run(scene, fx, { ...ctxInfo, release: dur * RELEASE_K, dur, sprite: companion.sprite });
  return true;
}

export function unitGesture(scene, id) {
  const g = scene.unitSkills?.get(id);
  const f = gestureFrame(g, scene.time);
  if (!f && g) scene.unitSkills.delete(id);
  return f;
}

export function heroGesture(scene) {
  const f = gestureFrame(scene.heroSkill, scene.time);
  if (!f) scene.heroSkill = null;
  return f;
}

// --- Moteur d'effets ---------------------------------------------------------------------------------------------
// Une pièce d'effet : { at (début, temps de scène), dur, draw(ctx, k, age, p) } ; k = avancement 0..1.

function add(scene, delay, dur, draw, p = {}) {
  (scene.skillFx ??= []).push({ at: scene.time + delay, dur, draw, p, src: add.cur }); // src : effet en cours (diagnostic)
}

function later(scene, delay, fn) {
  add(scene, delay, 0, null, { fn });
}

export function drawSkillFx(scene, ctx) {
  const list = scene.skillFx;
  if (!list?.length) return;
  const now = scene.time;
  scene.skillFx = list.filter((e) => now < e.at + e.dur || (e.p.fn && !e.p.done));
  for (const e of list) {
    if (now < e.at) continue;
    if (e.p.fn) {
      if (!e.p.done) { e.p.done = true; e.p.fn(); }
      continue;
    }
    const age = now - e.at;
    if (age > e.dur) continue;
    e.draw(ctx, Math.min(1, age / e.dur), age, e.p);
  }
  ctx.globalAlpha = 1;
}

const R = Math.round;
const rnd = (a, b) => a + Math.random() * (b - a);

function dot(ctx, x, y, color, s = 1) {
  ctx.fillStyle = color;
  ctx.fillRect(R(x), R(y), s, s);
}

// Disque plein (pixels).
function disc(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  const rr = Math.max(0.5, r);
  for (let dy = -Math.ceil(rr); dy <= Math.ceil(rr); dy++) {
    const w = Math.floor(Math.sqrt(Math.max(0, rr * rr - dy * dy)));
    if (w || Math.abs(dy) <= rr) ctx.fillRect(R(x) - w, R(y) + dy, w * 2 + 1, 1);
  }
}

// Ellipse (contour) aplatie : onde au sol, anneau.
function ring(ctx, x, y, rx, ry, color, step = 1) {
  ctx.fillStyle = color;
  const n = Math.max(12, R(rx * 2.2));
  for (let i = 0; i < n; i += step) {
    const a = (i / n) * Math.PI * 2;
    ctx.fillRect(R(x + Math.cos(a) * rx), R(y + Math.sin(a) * ry), 1, 1);
  }
}

// Arc tranchant (croissant) : centre, rayon, angle de départ et d'arrivée, épaisseur.
function crescent(ctx, x, y, r, a0, a1, thick, color, core = '#ffffff') {
  const n = Math.max(10, R(r * Math.abs(a1 - a0)));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = a0 + (a1 - a0) * t;
    const th = Math.max(1, R(thick * Math.sin(t * Math.PI)));
    for (let j = 0; j < th; j++) dot(ctx, x + Math.cos(a) * (r - j), y + Math.sin(a) * (r - j), j === 0 ? core : color);
  }
}

// Colonne de lumière du ciel au sol, qui s'estompe vers le haut.
function column(ctx, x, top, bottom, w, color, alpha) {
  ctx.fillStyle = color;
  for (let y = top; y < bottom; y += 2) {
    ctx.globalAlpha = alpha * (0.25 + 0.75 * ((y - top) / Math.max(1, bottom - top)));
    ctx.fillRect(R(x - w / 2), y, R(w), 2);
  }
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(R(x - Math.max(1, w / 6)), top, Math.max(1, R(w / 3)), bottom - top);
  ctx.globalAlpha = 1;
}

// Éclair en zigzag (du point a au point b).
function zigzag(ctx, x0, y0, x1, y1, color, seed) {
  let px = x0, py = y0;
  const n = 7;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const nx = x0 + (x1 - x0) * t + (i < n ? Math.sin(seed * 13 + i * 7.3) * 4 : 0);
    const ny = y0 + (y1 - y0) * t;
    const steps = Math.max(Math.abs(nx - px), Math.abs(ny - py));
    for (let s = 0; s <= steps; s++) {
      const u = steps ? s / steps : 0;
      dot(ctx, px + (nx - px) * u, py + (ny - py) * u, '#ffffff');
      dot(ctx, px + (nx - px) * u + 1, py + (ny - py) * u, color);
    }
    px = nx; py = ny;
  }
}

// Particules (débris, plumes, pétales, étincelles) gérées par la pièce elle-même.
function particles(scene, delay, dur, list, { gravity = 60, sway = 0, size = 1 } = {}) {
  add(scene, delay, dur, (ctx, k, age, p) => {
    for (const q of p.list) {
      const t = Math.max(0, age - (q.d ?? 0));
      if (t <= 0) continue;
      const x = q.x + q.vx * t + (sway ? Math.sin(t * 5 + q.ph) * sway : 0);
      const y = q.y + q.vy * t + 0.5 * gravity * t * t;
      ctx.globalAlpha = Math.max(0, 1 - t / (dur - (q.d ?? 0)));
      dot(ctx, x, y, q.c, q.s ?? size);
    }
  }, { list });
}

const spray = (n, x, y, colors, sp = 40, up = 30) => Array.from({ length: n }, (_, i) => {
  const a = Math.random() * Math.PI * 2;
  const v = sp * (0.3 + Math.random() * 0.7);
  return { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6 - up, c: colors[i % colors.length], ph: Math.random() * 6 };
});

// Aura au sol et étincelles qui montent sur chaque membre de l'équipe.
function teamAura(scene, delay, c, color, dur = 0.9) {
  const G = scene.groundY;
  add(scene, delay, dur, (ctx, k) => {
    for (const x of c.team) {
      ctx.globalAlpha = 0.7 * Math.sin(k * Math.PI);
      ring(ctx, x, G - 1, 9 + k * 3, 2.5, color);
      for (let i = 0; i < 4; i++) {
        const yy = G - 4 - ((k * 30 + i * 8) % 28);
        dot(ctx, x - 6 + ((i * 5) % 12), yy, i % 2 ? '#ffffff' : color);
      }
    }
  });
}

// Coups sur les ennemis (réaction, chiffres déjà affichés par l'événement) ; `all` : tous les ennemis.
function strike(scene, c, color, all = true) {
  for (const f of all ? c.foes : c.foes.slice(0, 1)) scene.hitReact(f.id, f.x, { color });
}

// v9.8 (B1) : les compétences du héros ne secouent plus l'écran (on voyait mal le combat).
function shake() {}

// Projectile en ligne droite de (x0, y0) à (x1, y1), dessiné par `draw(ctx, x, y, k)` avec une traînée.
function fly(scene, delay, dur, x0, y0, x1, y1, draw, trail, onHit) {
  add(scene, delay, dur, (ctx, k) => {
    for (let i = 6; i >= 1; i--) {
      const kk = Math.max(0, k - i * 0.035);
      ctx.globalAlpha = 0.6 * (1 - i / 7);
      dot(ctx, x0 + (x1 - x0) * kk, y0 + (y1 - y0) * kk, trail[i % trail.length], 2);
    }
    ctx.globalAlpha = 1;
    draw(ctx, x0 + (x1 - x0) * k, y0 + (y1 - y0) * k, k);
  });
  if (onHit) later(scene, delay + dur, onHit);
}

const arrowAt = (ctx, x, y, dx, dy, color = '#e8e0c8', len = 6) => {
  const l = Math.hypot(dx, dy) || 1;
  for (let i = 0; i < len; i++) dot(ctx, x - (dx / l) * i, y - (dy / l) * i, i === 0 ? '#ffffff' : i > len - 3 ? '#c84a3a' : color);
};

// --- Effets -----------------------------------------------------------------------------------------------------

const FX = {
  // Météore : la pierre en feu apparaît en haut quand les bras se lèvent, tombe en diagonale avec sa traînée de feu
  // et de fumée, s'écrase au milieu des ennemis : éclair, onde, cratère fumant, secousse, débris.
  meteor(s, c, { color = '#ff6a1a', big = 1 } = {}) {
    const G = s.groundY;
    const mx = c.mid, x0 = mx - 90, y0 = -20, fall = 0.5, t0 = c.release;
    add(s, t0 - 0.25, 0.25, (ctx, k) => { ctx.globalAlpha = k * 0.8; disc(ctx, x0 + 4, 4, 3 + k * 3, '#ffb43a'); });
    add(s, t0, fall, (ctx, k, age, p) => {
      const x = x0 + (mx - x0) * k, y = y0 + (G - 6 - y0) * k * k;
      p.tr ??= [];
      p.tr.push([x, y]);
      p.tr.forEach(([tx, ty], i) => {
        const a = i / p.tr.length;
        ctx.globalAlpha = a * 0.8;
        disc(ctx, tx + rnd(-1, 1), ty - 1, (2 + a * 4) * big, a > 0.7 ? '#ffb43a' : a > 0.4 ? color : '#5a3a2a');
      });
      ctx.globalAlpha = 1;
      disc(ctx, x, y, 6 * big, '#5a2a1a');
      disc(ctx, x + 1, y - 1, 4.5 * big, '#a84a1a');
      disc(ctx, x + 2, y - 2, 2.5 * big, '#ffd27a');
    });
    later(s, t0 + fall, () => {
      shake(s, 5 * big);
      strike(s, c, color);
      s.burst?.(mx, G - 8, color, 18, 80);
      s.dust?.(mx, 8);
    });
    add(s, t0 + fall, 0.25, (ctx, k) => { ctx.globalAlpha = 1 - k; disc(ctx, mx, G - 6, 8 + k * 22 * big, k < 0.4 ? '#ffffff' : '#ffb43a'); });
    add(s, t0 + fall, 0.5, (ctx, k) => { ctx.globalAlpha = 1 - k; ring(ctx, mx, G - 1, 10 + k * 50 * big, 3 + k * 5, '#ffd27a'); });
    add(s, t0 + fall, 2, (ctx, k) => {
      ctx.globalAlpha = Math.min(1, (1 - k) * 2);
      ctx.fillStyle = '#2a1a14';
      ctx.fillRect(R(mx - 16 * big), G - 1, R(32 * big), 3);
      ctx.fillStyle = '#ff6a1a';
      ctx.globalAlpha *= 0.5 + 0.5 * Math.sin(k * 30);
      ctx.fillRect(R(mx - 10 * big), G, R(20 * big), 1);
      ctx.globalAlpha = 0.5 * (1 - k);
      for (let i = 0; i < 5; i++) dot(ctx, mx - 10 + i * 5, G - 4 - ((k * 40 + i * 9) % 22), '#6a5a5a', 2);
    });
    particles(s, t0 + fall, 1, spray(22, mx, G - 4, ['#5a3a2a', '#8a5a3a', '#ff8a3a', '#3a2a24'], 90, 50), { gravity: 160, size: 2 });
  },

  // Pluie de flèches : une gerbe part vers le ciel, puis les flèches retombent sur chaque ennemi.
  arrow_rain(s, c, { color = '#e8e0c8' } = {}) {
    const G = s.groundY;
    for (let i = 0; i < 5; i++) fly(s, c.release + i * 0.03, 0.22, c.src.x + 6, c.src.y - 6, c.src.x + 20 + i * 5, -10, (ctx, x, y) => arrowAt(ctx, x, y, 0.3, -1, color), [color]);
    const spots = c.foes.length ? c.foes : [{ x: c.front }];
    spots.forEach((f, i) => {
      for (let j = 0; j < 4; j++) {
        const x = f.x - 9 + j * 6, d = c.release + 0.32 + i * 0.06 + j * 0.05;
        fly(s, d, 0.24, x - 14, -12, x, G - 3, (ctx, xx, yy) => arrowAt(ctx, xx, yy, 0.5, 1, color), [color], () => {
          s.dust?.(x, 1);
          if (j === 1 && f.id !== undefined) s.hitReact(f.id, f.x, { color });
        });
        add(s, d + 0.24, 0.6, (ctx, k) => { ctx.globalAlpha = 1 - k; arrowAt(ctx, x, G - 1, 0.5, 1, color, 5); });
      }
    });
  },

  // Prière : rayon de lumière qui descend sur l'équipe, plumes qui tombent en se balançant, aura au sol.
  prayer(s, c, { color = '#ffe680', feathers = true } = {}) {
    const G = s.groundY, t0 = c.release;
    add(s, t0, 1.1, (ctx, k) => {
      const w = 18 * Math.sin(Math.min(1, k * 1.4) * Math.PI * 0.5) * (1 - Math.max(0, k - 0.7) / 0.3);
      for (const x of [c.src.x, c.hero]) column(ctx, x, 0, R(Math.min(1, k * 3) * G), Math.max(2, w), color, 0.55);
    });
    if (feathers) {
      const list = Array.from({ length: 14 }, () => ({ x: rnd(c.hero - 30, c.src.x + 20), y: rnd(-20, 10), vx: rnd(-4, 4), vy: rnd(14, 24), c: Math.random() < 0.7 ? '#ffffff' : color, ph: rnd(0, 6), d: rnd(0, 0.5), s: 2 }));
      particles(s, t0 + 0.1, 2.2, list, { gravity: 0, sway: 5 });
    }
    teamAura(s, t0 + 0.4, c, color, 1.2);
  },

  dawn_prayer(s, c) {
    FX.prayer(s, c, { color: '#ffc28a' });
    add(s, c.release, 1.2, (ctx, k) => { ctx.globalAlpha = 0.25 * Math.sin(k * Math.PI); ctx.fillStyle = '#ffb47a'; ctx.fillRect(0, 0, 900, s.groundY); });
  },

  // Bénédiction guerrière : runes dorées qui tournent puis se posent sur chacun, épées de lumière au-dessus.
  blessing(s, c, { color = '#ffd23f' } = {}) {
    const G = s.groundY;
    add(s, c.release, 1.1, (ctx, k) => {
      for (const x of c.team) {
        for (let i = 0; i < 3; i++) {
          const a = k * 6 + i * 2.1;
          ctx.globalAlpha = Math.sin(k * Math.PI);
          dot(ctx, x + Math.cos(a) * 9, G - 18 + Math.sin(a) * 3 - k * 6, color, 2);
        }
        const y = G - 40 + k * 8;
        ctx.globalAlpha = Math.sin(k * Math.PI);
        ctx.fillStyle = '#fff4c0';
        ctx.fillRect(R(x), R(y), 1, 7);
        ctx.fillRect(R(x - 2), R(y + 5), 5, 1);
      }
    });
    teamAura(s, c.release + 0.3, c, color);
  },

  // Lumière divine : vague de lumière qui part des mains ouvertes et baigne toute l'équipe, croix de lumière.
  divine_light(s, c, { color = '#fff2a8' } = {}) {
    const G = s.groundY;
    add(s, c.release, 0.9, (ctx, k) => {
      ctx.globalAlpha = 0.8 * (1 - k);
      ring(ctx, c.src.x, G - 16, 6 + k * 70, 4 + k * 26, color);
      ring(ctx, c.src.x, G - 16, 3 + k * 60, 2 + k * 22, '#ffffff', 2);
    });
    add(s, c.release + 0.2, 1, (ctx, k) => {
      for (const x of c.team) {
        ctx.globalAlpha = Math.sin(k * Math.PI);
        ctx.fillStyle = color;
        ctx.fillRect(R(x), G - 36, 1, 9);
        ctx.fillRect(R(x - 3), G - 33, 7, 1);
      }
    });
    teamAura(s, c.release + 0.25, c, color, 1.1);
  },

  // Rayon sacré : le doigt pointe le ciel, un rayon étroit tombe sur le chevalier.
  sacred_ray(s, c) {
    add(s, c.release, 0.9, (ctx, k) => column(ctx, c.hero, 0, s.groundY, 6 + 4 * Math.sin(k * Math.PI), '#ffd23f', Math.sin(k * Math.PI)));
    teamAura(s, c.release + 0.3, { team: [c.hero] }, '#ffd23f');
  },

  // Jugement céleste : lances de lumière qui tombent du ciel sur chaque ennemi.
  judgement(s, c) {
    const G = s.groundY;
    c.foes.forEach((f, i) => {
      const d = c.release + i * 0.08;
      add(s, d, 0.18, (ctx, k) => { const y = -10 + k * (G + 6); ctx.fillStyle = '#ffffff'; ctx.fillRect(R(f.x), R(y - 14), 1, 14); ctx.fillStyle = '#9fd8ff'; ctx.fillRect(R(f.x) - 1, R(y - 10), 3, 8); });
      later(s, d + 0.18, () => { s.hitReact(f.id, f.x, { color: '#9fd8ff' }); shake(s, 1.5); });
      add(s, d + 0.18, 0.45, (ctx, k) => column(ctx, f.x, 0, G, 8 * (1 - k), '#9fd8ff', 1 - k));
    });
  },

  // Aile protectrice : deux grandes ailes de lumière se déploient au-dessus de l'équipe, plumes, bouclier.
  guardian_wings(s, c) {
    const G = s.groundY, cx = (c.team[0] + c.team[c.team.length - 1]) / 2;
    add(s, c.release, 1.6, (ctx, k) => {
      const open = Math.min(1, k * 2.5), fade = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
      for (const side of [-1, 1]) {
        for (let i = 0; i < 9; i++) {
          const a = (-Math.PI / 2) + side * (0.25 + i * 0.16) * open;
          const len = 26 + i * 3 - (i > 6 ? (i - 6) * 6 : 0);
          for (let r = 4; r < len; r += 1) {
            ctx.globalAlpha = 0.55 * fade * (1 - r / len / 1.5);
            dot(ctx, cx + Math.cos(a) * r * 1.4, G - 34 + Math.sin(a) * r * 0.7, r > len - 3 ? '#ffffff' : '#bfe8ff');
          }
        }
      }
      ctx.globalAlpha = 0.35 * fade;
      ring(ctx, cx, G - 14, 48 * open, 20 * open, '#9fd8ff');
    });
    particles(s, c.release + 0.3, 2, Array.from({ length: 16 }, () => ({ x: rnd(cx - 50, cx + 50), y: rnd(G - 60, G - 40), vx: rnd(-3, 3), vy: rnd(10, 18), c: '#ffffff', ph: rnd(0, 6), s: 2 })), { gravity: 0, sway: 5 });
    teamAura(s, c.release + 0.5, c, '#9fd8ff', 1.2);
  },

  // Nova de givre : le bâton planté, un cercle de glace court au sol et des pics jaillissent sous les ennemis.
  frost_nova(s, c, { color = '#bfe9ff', big = 1 } = {}) {
    const G = s.groundY, x0 = c.src.x + 6;
    add(s, c.release, 0.6, (ctx, k) => { ctx.globalAlpha = 1 - k; ring(ctx, x0, G - 1, 6 + k * 140 * big, 2 + k * 6, color); ring(ctx, x0, G - 1, 4 + k * 120 * big, 1 + k * 5, '#ffffff', 2); });
    c.foes.forEach((f) => {
      const d = c.release + Math.max(0, (f.x - x0) / (240 * big));
      later(s, d, () => s.hitReact(f.id, f.x, { color }));
      add(s, d, 0.9, (ctx, k) => {
        const h = (k < 0.2 ? k / 0.2 : 1) * (k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1);
        for (const [dx, hh] of [[-6, 8], [-2, 14], [3, 11], [7, 6]]) {
          const top = G - R(hh * h * big);
          ctx.fillStyle = '#7fc8ff'; ctx.fillRect(R(f.x + dx) - 1, top, 3, G - top);
          ctx.fillStyle = '#ffffff'; ctx.fillRect(R(f.x + dx), top, 1, G - top);
        }
      });
    });
    particles(s, c.release, 0.8, spray(12, x0, G - 4, ['#ffffff', color], 70, 30), { gravity: 40 });
  },

  // Hiver éternel : nova géante, flocons qui tombent sur tout l'écran, ciel bleui, bouclier de givre sur l'équipe.
  eternal_winter(s, c) {
    FX.frost_nova(s, c, { big: 1.4 });
    add(s, c.release, 2, (ctx, k) => { ctx.globalAlpha = 0.22 * Math.sin(k * Math.PI); ctx.fillStyle = '#bfe9ff'; ctx.fillRect(-20, 0, 900, s.groundY + 40); });
    particles(s, c.release, 2.2, Array.from({ length: 40 }, () => ({ x: rnd(c.hero - 40, c.hero + 260), y: rnd(-30, 0), vx: rnd(-8, -2), vy: rnd(20, 40), c: '#ffffff', ph: rnd(0, 6), d: rnd(0, 0.8) })), { gravity: 0, sway: 3 });
    teamAura(s, c.release + 0.4, c, '#bfe9ff', 1.4);
  },

  // Tempête de givre : rafale d'éclats de glace poussée par les mains tendues.
  frost_storm(s, c) {
    const G = s.groundY;
    for (let i = 0; i < 14; i++) {
      const y = G - 30 + rnd(0, 24), d = c.release + i * 0.04;
      fly(s, d, 0.35, c.src.x + 8, c.src.y - 2, c.far + 10, y, (ctx, x, yy) => { dot(ctx, x, yy, '#ffffff', 2); dot(ctx, x - 2, yy, '#9fd8ff', 2); }, ['#bfe9ff']);
    }
    later(s, c.release + 0.3, () => { strike(s, c, '#bfe9ff'); });
  },

  // Boule de feu lancée : globe de feu tournoyant, explosion.
  fireball(s, c, { color = '#ff8a3a' } = {}) {
    const G = s.groundY;
    fly(s, c.release, 0.35, c.src.x + 8, c.src.y - 4, c.front, G - 12, (ctx, x, y) => { disc(ctx, x, y, 4, color); disc(ctx, x + 1, y - 1, 2, '#ffe08a'); }, ['#ffb43a', '#ff3a1a', '#5a3a2a'], () => {
      strike(s, c, color, false);
      s.burst?.(c.front, G - 12, color, 12, 55);
      shake(s, 1.5);
    });
    add(s, c.release + 0.35, 0.3, (ctx, k) => { ctx.globalAlpha = 1 - k; disc(ctx, c.front, G - 12, 4 + k * 12, k < 0.3 ? '#ffffff' : color); });
  },

  // Gerbe de flammes : jets de feu en cône devant les mains tendues.
  flame_spray(s, c) {
    const G = s.groundY;
    add(s, c.release, 0.8, (ctx, k) => {
      for (let i = 0; i < 26; i++) {
        const t = ((i * 0.37 + k * 3) % 1);
        const x = c.src.x + 10 + t * (c.far - c.src.x + 10);
        const y = c.src.y - 2 + Math.sin(i * 2.3) * t * 14 + t * 8;
        ctx.globalAlpha = (1 - t) * Math.sin(k * Math.PI);
        disc(ctx, x, Math.min(G - 2, y), 1 + t * 3, t < 0.3 ? '#ffe08a' : t < 0.6 ? '#ff8a3a' : '#c83a1a');
      }
    });
    later(s, c.release + 0.3, () => strike(s, c, '#ff8a3a'));
  },

  // Brasier infernal : colonnes de feu qui jaillissent sous chaque ennemi.
  hellfire(s, c, { color = '#ff5a2a' } = {}) {
    const G = s.groundY;
    c.foes.forEach((f, i) => {
      const d = c.release + i * 0.07;
      add(s, d, 0.2, (ctx, k) => { ctx.globalAlpha = k; ctx.fillStyle = '#ff3a1a'; ctx.fillRect(R(f.x - 8), G - 1, 16, 2); });
      later(s, d + 0.2, () => { s.hitReact(f.id, f.x, { color }); shake(s, 1.5); });
      add(s, d + 0.2, 0.7, (ctx, k) => {
        const h = 44 * Math.sin(Math.min(1, k * 2) * Math.PI * 0.5) * (1 - Math.max(0, k - 0.6) / 0.4);
        for (let y = 0; y < h; y += 2) {
          const w = 8 - (y / h) * 5 + Math.sin(y * 0.7 + k * 20) * 1.5;
          ctx.fillStyle = y < h * 0.3 ? '#ffe08a' : y < h * 0.7 ? '#ff8a3a' : color;
          ctx.fillRect(R(f.x - w / 2), G - y - 2, R(w), 2);
        }
      });
    });
  },

  // Couronne de cendres : une couronne de feu se forme au-dessus de la reine, puis une pluie de braises et de cendres.
  ash_crown(s, c) {
    add(s, c.release - 0.2, 0.9, (ctx, k) => {
      for (let i = 0; i < 7; i++) {
        const a = k * 3 + (i / 7) * Math.PI * 2;
        ctx.globalAlpha = Math.sin(k * Math.PI);
        dot(ctx, c.src.x + Math.cos(a) * 9, c.src.y - 26 + Math.sin(a) * 2, '#ffb43a', 2);
        dot(ctx, c.src.x + Math.cos(a) * 9, c.src.y - 29 + Math.sin(a) * 2, '#ff5a2a');
      }
    });
    FX.hellfire(s, { ...c, release: c.release + 0.3 }, { color: '#ff3a1a' });
    particles(s, c.release + 0.2, 1.8, Array.from({ length: 30 }, () => ({ x: rnd(c.front - 30, c.far + 30), y: rnd(-20, 0), vx: rnd(-10, 0), vy: rnd(30, 50), c: Math.random() < 0.5 ? '#ff8a3a' : '#6a5a5a', ph: 0, d: rnd(0, 0.6) })), { gravity: 0 });
    teamAura(s, c.release + 0.8, c, '#ff8a3a');
  },

  // Orbe du néant : une sphère violette grossit au-dessus des mains, file vers les ennemis et implose.
  void_orb(s, c, { color = '#b05cff' } = {}) {
    const G = s.groundY, y0 = c.src.y - 22;
    add(s, c.release - 0.25, 0.3, (ctx, k) => { disc(ctx, c.src.x, y0, 1 + k * 5, '#3a1a5a'); ring(ctx, c.src.x, y0, 3 + k * 5, 3 + k * 5, color); });
    fly(s, c.release + 0.05, 0.4, c.src.x, y0, c.mid, G - 16, (ctx, x, y) => { disc(ctx, x, y, 6, '#2a0a4a'); ring(ctx, x, y, 6, 6, color); dot(ctx, x - 2, y - 2, '#e8c8ff', 2); }, [color, '#5a2a8a'], () => { strike(s, c, color); shake(s, 2); });
    add(s, c.release + 0.45, 0.5, (ctx, k) => { ctx.globalAlpha = 1 - k; ring(ctx, c.mid, G - 16, 30 * (1 - k) + 2, 18 * (1 - k) + 2, color); disc(ctx, c.mid, G - 16, 8 * k, '#1a0a2a'); });
  },

  // Éclipse du néant : un soleil noir cerclé de violet se lève au-dessus des ennemis, l'écran s'assombrit, puis
  // une entaille du néant traverse la cible.
  eclipse(s, c) {
    const G = s.groundY, ex = c.front, ey = G - 70;
    add(s, c.release, 1.4, (ctx, k) => {
      const a = Math.sin(Math.min(1, k * 1.5) * Math.PI * 0.5) * (k > 0.8 ? (1 - k) / 0.2 : 1);
      ctx.globalAlpha = 0.45 * a; ctx.fillStyle = '#0a0414'; ctx.fillRect(-20, 0, 900, G + 40);
      ctx.globalAlpha = a; disc(ctx, ex, ey, 14, '#a855ff'); disc(ctx, ex, ey, 12, '#08040e');
      for (let i = 0; i < 12; i++) { const an = i / 12 * Math.PI * 2 + k; dot(ctx, ex + Math.cos(an) * 17, ey + Math.sin(an) * 17, '#d8b8ff'); }
    });
    add(s, c.release + 0.8, 0.3, (ctx, k) => crescent(ctx, ex - 6, G - 18, 18, -2.4, 0.6 + k * 0.3, 4, '#a855ff', '#ffffff'));
    later(s, c.release + 0.85, () => { strike(s, c, '#a855ff', false); shake(s, 3); });
    teamAura(s, c.release + 1, c, '#a855ff');
  },

  // Lame du néant / tailles : croissant tranchant sur la cible.
  heavy_cut(s, c, { color = '#ff5a4a', size = 14 } = {}) {
    const G = s.groundY;
    add(s, c.release, 0.22, (ctx, k) => { ctx.globalAlpha = 1 - k * 0.6; crescent(ctx, c.front - 8, G - 14, size, -2.2, -2.2 + k * 2.8, 4, color); });
    later(s, c.release + 0.08, () => { strike(s, c, color, false); shake(s, 1); });
  },
  valiant_cut(s, c) {
    // Onde tranchante bleue qui file du compagnon à la cible.
    const G = s.groundY;
    fly(s, c.release, 0.22, c.src.x + 8, G - 16, c.front - 6, G - 16, (ctx, x, y) => crescent(ctx, x - 6, y, 8, -1.2, 1.2, 3, '#5aa8ff'), ['#5aa8ff'], () => strike(s, c, '#5aa8ff', false));
  },
  void_blade(s, c) {
    FX.heavy_cut(s, c, { color: '#a855ff', size: 18 });
    add(s, c.release + 0.1, 0.35, (ctx, k) => { ctx.globalAlpha = 1 - k; ctx.fillStyle = '#2a0a4a'; ctx.fillRect(R(c.front - 14), s.groundY - 14, R(28 * (1 - k)), 2); });
  },

  // Coup de bouclier : onde de choc frontale en demi-lune et éclats.
  shield_bash(s, c) {
    const G = s.groundY;
    fly(s, c.release, 0.2, c.src.x + 10, G - 14, c.front - 4, G - 14, (ctx, x, y) => { ctx.fillStyle = '#cfe6ff'; ctx.fillRect(R(x), R(y - 8), 2, 16); ctx.fillStyle = '#ffffff'; ctx.fillRect(R(x) + 2, R(y - 5), 1, 10); }, ['#7fb0ff'], () => {
      strike(s, c, '#7fb0ff', false); shake(s, 1.5);
    });
    particles(s, c.release + 0.2, 0.5, spray(8, c.front, G - 14, ['#ffffff', '#7fb0ff'], 50, 20), { gravity: 80 });
  },

  // Provocation : marques rouges « ! » au-dessus des ennemis, anneau rouge autour du gardien.
  taunt(s, c) {
    const G = s.groundY;
    add(s, c.release, 1, (ctx, k) => {
      ctx.globalAlpha = Math.sin(k * Math.PI);
      ring(ctx, c.src.x, G - 1, 10 + k * 6, 3, '#ff4a3a');
      for (const f of c.foes) {
        const y = G - 44 - Math.sin(k * 8) * 2;
        ctx.fillStyle = '#ff4a3a'; ctx.fillRect(R(f.x) - 1, R(y), 3, 6); ctx.fillRect(R(f.x) - 1, R(y) + 8, 3, 2);
      }
    });
    teamAura(s, c.release + 0.3, { team: [c.src.x] }, '#7fb0ff');
  },

  // Rempart absolu : l'arme plantée, un dôme doré se referme au-dessus de toute l'équipe, hexagones qui scintillent.
  rampart(s, c, { color = '#ffd23f' } = {}) {
    const G = s.groundY, x0 = c.team[c.team.length - 1] - 16, x1 = c.team[0] + 16, cx = (x0 + x1) / 2, rx = Math.max(32, (x1 - x0) / 2);
    shake(s, 1);
    add(s, c.release, 1.6, (ctx, k) => {
      const up = Math.min(1, k * 3), fade = k > 0.8 ? (1 - k) / 0.2 : 1;
      ctx.globalAlpha = 0.85 * fade;
      for (let i = 0; i <= 40; i++) {
        const a = Math.PI + (i / 40) * Math.PI;
        const y = G - 1 + Math.sin(a) * 38 * up;
        dot(ctx, cx + Math.cos(a) * rx, y, i % 4 ? color : '#ffffff', 2);
      }
      ctx.globalAlpha = 0.12 * fade; // v9.8.1 (I8) : dôme léger (il cachait les pieds de l'équipe)
      ctx.fillStyle = color;
      for (let y = 6; y < 38 * up; y += 2) { const w = rx * Math.sqrt(1 - (y / 38) ** 2); ctx.fillRect(R(cx - w), G - 1 - y, R(w * 2), 1); }
      ctx.globalAlpha = 0.7 * fade * Math.abs(Math.sin(k * 20));
      for (let i = 0; i < 6; i++) dot(ctx, cx - rx * 0.7 + i * rx * 0.28, G - 10 - ((i * 13) % 26) * up, '#ffffff', 2);
    });
    s.dust?.(c.src.x + 6, 4);
  },

  // Bouclier sacré : bouclier hexagonal bleu devant le chevalier.
  holy_shield(s, c) {
    const G = s.groundY, x = c.hero + 14;
    add(s, c.release, 1.2, (ctx, k) => {
      const a = Math.sin(Math.min(1, k * 3) * Math.PI * 0.5) * (k > 0.8 ? (1 - k) / 0.2 : 1);
      ctx.globalAlpha = 0.8 * a;
      for (let y = -14; y <= 14; y++) { const w = R(5 - Math.abs(y) / 5); ctx.fillStyle = Math.abs(y) % 4 ? '#4fa3ff' : '#cfe6ff'; ctx.fillRect(R(x) - w, G - 16 + y, w * 2 + 1, 1); }
      ctx.globalAlpha = a; ctx.fillStyle = '#ffffff'; ctx.fillRect(R(x), G - 28, 1, 24);
    });
    teamAura(s, c.release, { team: [c.hero] }, '#4fa3ff');
  },

  // Flèche perçante / tir du rôdeur : flèche tendue et trait qui traverse la file.
  pierce_arrow(s, c, { color = '#e8e0c8', line = '#fff2d8' } = {}) {
    const G = s.groundY;
    fly(s, c.release, 0.18, c.src.x + 10, G - 18, c.front, G - 16, (ctx, x, y) => arrowAt(ctx, x, y, 1, 0.1, color, 7), [line], () => strike(s, c, color, false));
    add(s, c.release + 0.18, 0.25, (ctx, k) => { ctx.globalAlpha = 1 - k; ctx.fillStyle = line; ctx.fillRect(R(c.front), G - 16, R(c.far - c.front + 20), 1); });
  },
  ranger_shot(s, c) {
    FX.pierce_arrow(s, c, { color: '#5ad46a', line: '#bfffc0' });
    particles(s, c.release + 0.18, 0.6, spray(6, c.front, s.groundY - 16, ['#5ad46a', '#2a8a3a'], 40, 20), { gravity: 30, sway: 3 }); // feuilles
  },

  // Tir du faucon : arc bandé à fond, un faucon de lumière part en piqué et transperce la cible.
  falcon(s, c) {
    const G = s.groundY;
    add(s, c.release - 0.3, 0.3, (ctx, k) => { ctx.globalAlpha = k; ring(ctx, c.src.x + 10, G - 20, 6 - k * 4, 6 - k * 4, '#bfffc0'); });
    fly(s, c.release, 0.32, c.src.x + 10, G - 20, c.front, G - 18, (ctx, x, y, k) => {
      const flap = Math.sin(k * 30) * 3;
      for (let i = 0; i < 8; i++) { dot(ctx, x - i, y - (i * (4 + flap)) / 8, '#ffffff'); dot(ctx, x - i, y + (i * (4 - flap)) / 8, '#ffffff'); }
      disc(ctx, x + 1, y, 2, '#ffe680');
    }, ['#7fe07a', '#ffffff'], () => { strike(s, c, '#7fe07a', false); shake(s, 3); s.burst?.(c.front, G - 18, '#ffffff', 14, 60); });
    add(s, c.release + 0.32, 0.3, (ctx, k) => { ctx.globalAlpha = 1 - k; ctx.fillStyle = '#ffffff'; ctx.fillRect(R(c.front), G - 18, R(80 * k), 2); });
  },

  // Coup bas : estoc bas, éclat sombre au pied de la cible.
  low_strike(s, c, { color = '#b46bff' } = {}) {
    const G = s.groundY;
    add(s, c.release, 0.2, (ctx, k) => { ctx.globalAlpha = 1 - k; ctx.fillStyle = color; ctx.fillRect(R(c.front - 16 + k * 10), G - 7, 14, 1); ctx.fillStyle = '#ffffff'; ctx.fillRect(R(c.front - 4 + k * 10), G - 7, 4, 1); });
    later(s, c.release + 0.08, () => strike(s, c, color, false));
  },

  // Danse des lames : lames qui tournent en cercle autour de la cible, puis se dispersent.
  blade_dance(s, c, { color = '#d8b8ff', petals = null } = {}) {
    const G = s.groundY;
    add(s, c.release, 0.7, (ctx, k) => {
      for (const f of c.foes) for (let i = 0; i < 4; i++) {
        const a = k * 14 + (i / 4) * Math.PI * 2;
        ctx.globalAlpha = Math.sin(k * Math.PI);
        crescent(ctx, f.x, G - 14, 10, a, a + 0.9, 2, color);
      }
    });
    later(s, c.release + 0.25, () => strike(s, c, color));
    if (petals) particles(s, c.release, 1.4, c.foes.flatMap((f) => spray(8, f.x, G - 16, petals, 40, 10)), { gravity: 20, sway: 4, size: 2 });
  },
  thorn_waltz(s, c) { FX.blade_dance(s, c, { color: '#ff6fa8', petals: ['#ff6fa8', '#ffb0d0', '#5a1a3a'] }); },
  blood_whirl(s, c) { FX.blade_dance(s, c, { color: '#ff4a3a', petals: ['#8a1a1a', '#ff4a3a'] }); },

  // Exécution : saut, grande entaille en X rouge sur la cible, écran rougi un instant.
  execution(s, c, { color = '#ff3a3a' } = {}) {
    const G = s.groundY;
    add(s, c.release + 0.1, 0.4, (ctx, k) => {
      ctx.globalAlpha = 1 - k * 0.7;
      const n = R(28 * Math.min(1, k * 4));
      for (let i = 0; i < n; i++) { dot(ctx, c.front - 14 + i, G - 30 + i, i % 3 ? color : '#ffffff', 2); if (k > 0.25) dot(ctx, c.front + 14 - i, G - 30 + i, i % 3 ? color : '#ffffff', 2); }
    });
    add(s, c.release + 0.2, 0.25, (ctx, k) => { ctx.globalAlpha = 0.3 * (1 - k); ctx.fillStyle = '#ff0000'; ctx.fillRect(-20, 0, 900, G + 40); });
    later(s, c.release + 0.2, () => { strike(s, c, color, false); shake(s, 3); s.hitstop = Math.max(s.hitstop ?? 0, s.focus ? 0 : 0.08); });
  },
  twin_blades(s, c) {
    const G = s.groundY;
    for (const [d, a0] of [[0, -2.4], [0.1, 2.4]]) add(s, c.release + d, 0.18, (ctx, k) => { ctx.globalAlpha = 1 - k; crescent(ctx, c.front - 4, G - 14, 11, a0, a0 + (a0 < 0 ? 2.4 : -2.4) * k, 3, '#b46bff'); });
    later(s, c.release + 0.12, () => strike(s, c, '#b46bff', false));
  },
  flash_strike(s, c) {
    // Frappe éclair : trait violet et images d'éclair au passage.
    const G = s.groundY;
    add(s, c.release, 0.25, (ctx, k) => { ctx.globalAlpha = 1 - k; zigzag(ctx, c.src.x + 6, G - 16, c.front, G - 14, '#9a5cff', 3); });
    later(s, c.release + 0.05, () => strike(s, c, '#9a5cff', false));
  },

  // Percée : la lance file, un trait rouge traverse toute la file d'ennemis.
  pierce(s, c) {
    const G = s.groundY;
    add(s, c.release, 0.3, (ctx, k) => {
      ctx.globalAlpha = 1 - k;
      ctx.fillStyle = '#e84a5f'; ctx.fillRect(R(c.src.x + 14), G - 17, R((c.far + 20 - c.src.x) * Math.min(1, k * 3)), 3);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(R(c.src.x + 14), G - 16, R((c.far + 20 - c.src.x) * Math.min(1, k * 3)), 1);
    });
    later(s, c.release + 0.08, () => strike(s, c, '#e84a5f'));
  },

  // Hache tournoyante : la hache part en tournant au ras des ennemis et revient.
  axe_whirl(s, c) {
    const G = s.groundY;
    add(s, c.release, 0.9, (ctx, k) => {
      const t = k < 0.5 ? k * 2 : (1 - k) * 2;
      const x = c.src.x + 10 + (c.far + 10 - c.src.x) * t, y = G - 14, a = k * 30;
      for (let i = -5; i <= 5; i++) dot(ctx, x + Math.cos(a) * i, y + Math.sin(a) * i, '#8a5a2a');
      disc(ctx, x + Math.cos(a) * 5, y + Math.sin(a) * 5, 2, '#d8d8e0');
      ctx.globalAlpha = 0.5; ring(ctx, x, y, 7, 7, '#ffa630', 2);
    });
    later(s, c.release + 0.25, () => strike(s, c, '#ffa630'));
  },

  // Hurlement (berserker) : ondes rouges qui partent de la bouche, aura rouge sur l'équipe.
  war_howl(s, c, { color = '#ff5a3a' } = {}) {
    add(s, c.release, 0.8, (ctx, k) => {
      for (let i = 0; i < 3; i++) {
        const kk = (k * 1.5 - i * 0.25);
        if (kk <= 0 || kk >= 1) continue;
        ctx.globalAlpha = 1 - kk;
        crescent(ctx, c.src.x + 6, c.src.y - 6, 6 + kk * 30, -0.9, 0.9, 2, color, '#ffb0a0');
      }
    });
    shake(s, 1.5);
    teamAura(s, c.release + 0.2, c, color);
  },

  // Fureur : cri, puis onde de choc rouge au sol qui balaie tous les ennemis.
  fury(s, c) {
    FX.war_howl(s, c, { color: '#ff4a3a' });
    const G = s.groundY;
    add(s, c.release + 0.15, 0.5, (ctx, k) => { ctx.globalAlpha = 1 - k; ring(ctx, c.src.x, G - 1, 10 + k * 150, 3 + k * 4, '#ff4a3a'); });
    later(s, c.release + 0.35, () => { strike(s, c, '#ff4a3a'); shake(s, 2.5); });
  },

  // Carnage : arme abattue au sol, le sol se fend jusqu'aux ennemis, éclats rouges.
  carnage(s, c) {
    const G = s.groundY, x0 = c.src.x + 10;
    later(s, c.release, () => { shake(s, 4); s.dust?.(x0, 6); });
    add(s, c.release, 0.9, (ctx, k) => {
      const len = (c.far + 20 - x0) * Math.min(1, k * 3);
      ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
      for (let x = 0; x < len; x += 2) { const y = G + R(Math.sin(x * 0.6) * 1.5); ctx.fillStyle = '#1a0a0a'; ctx.fillRect(R(x0 + x), y - 1, 2, 2); ctx.fillStyle = '#ff3a1a'; ctx.fillRect(R(x0 + x), y - 2, 2, 1); }
    });
    c.foes.forEach((f) => {
      const d = c.release + Math.max(0, (f.x - x0) / 300);
      later(s, d, () => s.hitReact(f.id, f.x, { color: '#ff3a1a' }));
      particles(s, d, 0.8, spray(8, f.x, G - 2, ['#5a3a2a', '#ff3a1a', '#8a1a1a'], 60, 60), { gravity: 180, size: 2 });
    });
  },

  // Familiers : morsure (crocs qui se referment), frénésie (griffures et aura orange), instinct sauvage (esprit
  // bestial qui charge à travers les ennemis).
  bite(s, c) {
    const G = s.groundY, x = c.front - 4, y = G - 14;
    add(s, c.release, 0.25, (ctx, k) => {
      const o = 6 * (1 - Math.min(1, k * 2));
      ctx.globalAlpha = 1 - Math.max(0, k - 0.6) / 0.4;
      for (let i = -2; i <= 2; i++) { ctx.fillStyle = '#ffffff'; ctx.fillRect(R(x + i * 3), R(y - 3 - o), 2, 3); ctx.fillRect(R(x + i * 3), R(y + 1 + o), 2, 3); }
    });
    later(s, c.release + 0.12, () => strike(s, c, '#ffffff', false));
  },
  frenzy(s, c) {
    const G = s.groundY;
    add(s, c.release, 0.8, (ctx, k) => {
      ctx.globalAlpha = 1 - k;
      for (let j = 0; j < 3; j++) for (let i = 0; i < 10; i++) dot(ctx, c.src.x - 4 + j * 4 + i * 0.5, G - 30 + i * 2, '#ff8a3a');
    });
    teamAura(s, c.release, c, '#ff8a3a');
  },
  instinct(s, c, { color = '#ffd27a' } = {}) {
    const G = s.groundY;
    add(s, c.release, 0.5, (ctx, k) => {
      const x = c.src.x + (c.far + 30 - c.src.x) * k;
      ctx.globalAlpha = 0.8 * (1 - k * 0.5);
      for (let i = 0; i < 5; i++) disc(ctx, x - i * 6, G - 10 - Math.abs(Math.sin(k * 20)) * 4, 5 - i, i ? color : '#ffffff');
      dot(ctx, x + 4, G - 18, '#ffffff', 2); dot(ctx, x + 1, G - 20, '#ffffff', 2); // oreilles
    });
    c.foes.forEach((f) => later(s, c.release + 0.5 * Math.max(0, (f.x - c.src.x) / (c.far + 30 - c.src.x)), () => s.hitReact(f.id, f.x, { color })));
  },

  // Familiers (compétence propre) : pluie d'or, griffure, piqué du hibou, soin de la fée.
  gold_rain(s, c) {
    const G = s.groundY;
    particles(s, c.release, 1.4, c.foes.flatMap((f) => Array.from({ length: 6 }, (_, i) => ({ x: f.x - 8 + i * 3, y: G - 50 - i * 4, vx: 0, vy: 10, c: i % 2 ? '#ffd23f' : '#fff4a0', d: i * 0.06, s: 2, ph: 0 }))), { gravity: 120 });
    later(s, c.release + 0.4, () => strike(s, c, '#ffd23f'));
  },
  claw(s, c) {
    const G = s.groundY;
    add(s, c.release, 0.25, (ctx, k) => { ctx.globalAlpha = 1 - k; for (let j = 0; j < 3; j++) for (let i = 0; i < R(12 * Math.min(1, k * 4)); i++) dot(ctx, c.front - 8 + j * 4 + i * 0.6, G - 24 + i * 1.4, '#ffffff'); });
    later(s, c.release + 0.08, () => strike(s, c, '#ffffff', false));
  },
  dive(s, c) {
    const G = s.groundY;
    fly(s, c.release, 0.3, c.src.x, G - 60, c.front, G - 12, (ctx, x, y) => { dot(ctx, x - 3, y - 2, '#c8a070', 2); dot(ctx, x, y, '#ffffff', 2); dot(ctx, x + 3, y - 2, '#c8a070', 2); }, ['#6a5aa0', '#c8b8ff'], () => strike(s, c, '#c8b8ff', false));
  },
  fairy_heal(s, c) {
    for (const x of c.team) fly(s, c.release, 0.4, c.src.x, c.src.y - 10, x, s.groundY - 20, (ctx, xx, yy) => { dot(ctx, xx, yy, '#ffffff', 2); dot(ctx, xx - 1, yy + 2, '#bfffe0'); }, ['#7fe0c0', '#ffffff']);
    teamAura(s, c.release + 0.35, c, '#7fe0c0');
  },

  // Sève de vie : feuilles et lianes lumineuses qui volent vers chaque allié.
  sap_of_life(s, c) {
    for (const x of c.team) fly(s, c.release + Math.random() * 0.1, 0.45, c.src.x, c.src.y - 8, x, s.groundY - 18, (ctx, xx, yy) => { dot(ctx, xx, yy, '#63d98a', 2); dot(ctx, xx + 1, yy - 1, '#c8ffd0'); }, ['#2a8a4a', '#63d98a']);
    teamAura(s, c.release + 0.4, c, '#63d98a', 1.1);
  },

  // Récolte sylvestre : la main au sol, des fleurs éclosent sous toute l'équipe, pièces d'or qui jaillissent.
  harvest(s, c) {
    const G = s.groundY;
    add(s, c.release, 1.6, (ctx, k) => {
      const grow = Math.min(1, k * 2.5), fade = k > 0.8 ? (1 - k) / 0.2 : 1;
      ctx.globalAlpha = fade;
      for (let i = 0; i < 16; i++) {
        const x = c.team[c.team.length - 1] - 20 + i * ((c.far - c.team[c.team.length - 1] + 40) / 16);
        const h = R((3 + (i % 3) * 2) * grow);
        ctx.fillStyle = '#2a8a3a'; ctx.fillRect(R(x), G - h, 1, h);
        if (grow > 0.6) { ctx.fillStyle = ['#ff6fa8', '#ffe680', '#ffffff'][i % 3]; ctx.fillRect(R(x) - 1, G - h - 2, 3, 2); }
      }
    });
    particles(s, c.release + 0.4, 1.2, c.foes.flatMap((f) => spray(4, f.x, G - 10, ['#ffd23f', '#fff4a0'], 30, 60)), { gravity: 150, size: 2 });
    teamAura(s, c.release + 0.3, c, '#63d98a', 1.2);
  },

  // v9.2.9 : nouveaux familiers — effets propres (compétence propre et compétence spéciale du 4e exemplaire).
  // Hérisson de cristal : éclats violets projetés en éventail sur tous les ennemis.
  crystal_spikes(s, c) {
    const G = s.groundY;
    for (const f of c.foes) fly(s, c.release + Math.random() * 0.08, 0.3, c.src.x, G - 12, f.x, G - 12, (ctx, x, y) => { dot(ctx, x, y, '#e8d8ff', 2); dot(ctx, x - 2, y, '#b48aff'); }, ['#b48aff', '#e8d8ff'], () => s.hitReact(f.id, f.x, { color: '#c8a8ff' }));
    particles(s, c.release, 0.6, spray(10, c.src.x, G - 14, ['#e8d8ff', '#b48aff'], 50, 40), { gravity: 90, size: 1 });
  },
  // Dragonnet : jet de braises qui part de la gueule et embrase la cible.
  ember_breath(s, c) {
    const G = s.groundY, y = c.src.y ?? G - 20;
    add(s, c.release, 0.45, (ctx, k) => {
      const len = (c.front - c.src.x) * Math.min(1, k * 2.2);
      ctx.globalAlpha = 1 - Math.max(0, k - 0.6) / 0.4;
      for (let i = 0; i < 14; i++) { const t = i / 14; dot(ctx, c.src.x + 8 + len * t, y + Math.sin(k * 30 + i) * 2 + t * (G - 14 - y), ['#fff2a8', '#ffb03a', '#ff5a1a'][i % 3], 2); }
    });
    later(s, c.release + 0.2, () => strike(s, c, '#ff7a2a', false));
  },
  // Brasier draconique : le dragonnet charge, colonne de flammes sur chaque ennemi, écaille de braise sur l'équipe.
  dragon_blaze(s, c) {
    const G = s.groundY;
    c.foes.forEach((f, i) => add(s, c.release + i * 0.06, 0.7, (ctx, k) => column(ctx, f.x, G - 60, G, 10 * (1 - k * 0.5), i % 2 ? '#ff5a1a' : '#ffb03a', 1 - k)));
    later(s, c.release + 0.15, () => { strike(s, c, '#ff6a1a'); shake(s, 2); });
    teamAura(s, c.release + 0.3, c, '#ff8a3a');
  },
  // Tortue de jade : carapace hexagonale verte qui se referme sur l'équipe.
  jade_shell(s, c) { FX.rampart(s, c, { color: '#5fe0a0' }); },
  // Sanctuaire de jade : cercle de runes au sol sous toute l'équipe, lotus qui s'ouvrent, soin et bouclier.
  jade_sanctuary(s, c) {
    const G = s.groundY;
    add(s, c.release, 1.4, (ctx, k) => {
      ctx.globalAlpha = Math.min(1, k * 4) * (1 - Math.max(0, k - 0.75) / 0.25);
      for (const x of c.team) { ring(ctx, x, G - 1, 16, 3, '#5fe0a0'); for (let i = 0; i < 6; i++) dot(ctx, x + Math.cos(i + k * 3) * 14, G - 1 + Math.sin(i + k * 3) * 2.5, '#ffe680'); }
    });
    particles(s, c.release + 0.2, 1.1, c.team.flatMap((x) => spray(5, x, G - 4, ['#5fe0a0', '#ffffff', '#ffb0d0'], 15, 40)), { gravity: -10, size: 2 });
    teamAura(s, c.release + 0.3, c, '#5fe0a0', 1.2);
  },
  // Renard céleste : feux follets bleus qui tournoient puis filent vers chaque ennemi.
  foxfire(s, c) {
    const G = s.groundY;
    c.foes.forEach((f, i) => fly(s, c.release + i * 0.07, 0.4, c.src.x, G - 26, f.x, G - 12, (ctx, x, y) => { disc(ctx, x, y, 3, '#5ad8ff'); dot(ctx, x, y - 3, '#e8fbff', 2); }, ['#5ad8ff', '#e8fbff'], () => s.hitReact(f.id, f.x, { color: '#5ad8ff' })));
  },
  // Neuf queues : neuf flammes bleues en éventail derrière le renard, puis une vague bleue traverse la file ; or.
  nine_tails(s, c) {
    const G = s.groundY;
    add(s, c.release - 0.15, 0.5, (ctx, k) => { ctx.globalAlpha = 1 - k; for (let i = 0; i < 9; i++) { const a = Math.PI * (0.55 + i * 0.1); disc(ctx, c.src.x + Math.cos(a) * 16, G - 12 - Math.sin(a) * 16, 2.5, '#5ad8ff'); } });
    FX.instinct(s, c, { color: '#5ad8ff' });
    particles(s, c.release + 0.4, 1, c.foes.slice(0, 3).flatMap((f) => spray(4, f.x, G - 10, ['#ffd23f', '#fff4a0'], 30, 60)), { gravity: 150, size: 2 });
  },
  // Petit phénix : plumes de feu qui planent vers chaque allié et le soignent.
  phoenix_feather(s, c) {
    for (const x of c.team) fly(s, c.release + Math.random() * 0.1, 0.5, c.src.x, c.src.y - 6, x, s.groundY - 20, (ctx, xx, yy) => { dot(ctx, xx, yy, '#ffd23f', 2); dot(ctx, xx - 2, yy + 1, '#ff5a2a'); }, ['#ff8a3a', '#ffd23f']);
    teamAura(s, c.release + 0.4, c, '#ffb03a');
  },
  // Renaissance : ailes de flammes déployées, anneau de feu qui balaie la file, pluie d'étincelles qui soigne.
  rebirth(s, c) {
    const G = s.groundY;
    add(s, c.release - 0.1, 0.6, (ctx, k) => { ctx.globalAlpha = 1 - k; crescent(ctx, c.src.x, c.src.y ?? G - 24, 14 + k * 8, Math.PI, Math.PI * 2, 3, '#ffb03a', '#fff2a8'); });
    add(s, c.release + 0.1, 0.5, (ctx, k) => { ctx.globalAlpha = 1 - k; ring(ctx, c.src.x, G - 6, 20 + k * 140, 4 + k * 6, '#ff7a2a'); });
    later(s, c.release + 0.3, () => strike(s, c, '#ff7a2a'));
    particles(s, c.release + 0.2, 1.2, c.team.flatMap((x) => spray(5, x, G - 40, ['#ffd23f', '#ff8a3a'], 10, -10)), { gravity: 60, size: 2 });
    teamAura(s, c.release + 0.4, c, '#ffb03a', 1.2);
  },

  // --- Héros ---
  // Frappe rapide : paume poussée, onde d'énergie bleue qui file et éclate sur la cible.
  ki_wave(s, c) {
    const G = s.groundY;
    fly(s, c.release * 0.8, 0.22, c.src.x + 14, G - 18, c.front - 4, G - 16, (ctx, x, y) => { crescent(ctx, x - 8, y, 9, -1.1, 1.1, 3, '#7fd6ff'); }, ['#7fd6ff', '#ffffff'], () => {
      strike(s, c, '#7fd6ff', false); s.burst?.(c.front, G - 16, '#7fd6ff', 8, 40);
    });
  },
  // Tourbillon : bras qui balaient, tornade de vent qui enveloppe le héros puis frappe tous les ennemis.
  whirlwind(s, c) {
    const G = s.groundY;
    add(s, c.release * 0.6, 0.7, (ctx, k) => {
      for (let i = 0; i < 5; i++) {
        const y = G - 4 - i * 6, rx = 10 + i * 3 + k * 6;
        ctx.globalAlpha = Math.sin(k * Math.PI) * 0.9;
        crescent(ctx, c.src.x, y, rx, k * 20 + i, k * 20 + i + 2.2, 1, '#e8f4ff', '#ffffff');
      }
    });
    add(s, c.release + 0.2, 0.45, (ctx, k) => { ctx.globalAlpha = 1 - k; ring(ctx, c.src.x, G - 6, 20 + k * 120, 4 + k * 6, '#e8f4ff'); });
    later(s, c.release + 0.35, () => strike(s, c, '#e8f4ff'));
    s.dust?.(c.src.x, 4);
  },
  // Cri de guerre : poings serrés, ondes dorées qui partent du héros, l'équipe s'embrase d'une aura dorée.
  war_cry(s, c) {
    FX.war_howl(s, c, { color: '#ffc23a' });
    particles(s, c.release, 1, spray(16, c.src.x, c.src.y - 6, ['#ffd23f', '#ffffff'], 60, 30), { gravity: 30 });
  },
  // Frappe sacrée : la main levée appelle une colonne de lumière dorée sur la cible, croix au sol, soin du héros.
  holy_smite(s, c) {
    const G = s.groundY;
    add(s, c.release - 0.2, 0.25, (ctx, k) => { ctx.globalAlpha = k; disc(ctx, c.src.x + 4, c.src.y - 26, 2 + k * 2, '#fff2a8'); });
    add(s, c.release + 0.1, 0.7, (ctx, k) => column(ctx, c.front, 0, G, 14 * (1 - k * 0.6), '#ffe680', 1 - k * 0.8));
    add(s, c.release + 0.1, 0.8, (ctx, k) => { ctx.globalAlpha = 1 - k; ctx.fillStyle = '#ffe680'; ctx.fillRect(R(c.front - 12), G - 1, 25, 2); ctx.fillRect(R(c.front) - 1, G - 4, 3, 8); });
    later(s, c.release + 0.12, () => { strike(s, c, '#ffe680', false); shake(s, 2); });
    teamAura(s, c.release + 0.3, { team: [c.hero] }, '#ffe680');
  },
};

export const FX_NAMES = Object.keys(FX);

// Couleur dominante de chaque effet (version sobre de « Réduire les animations »).
const CALM_COLOR = { meteor: '#ff6a1a', arrow_rain: '#e8e0c8', prayer: '#ffe680', dawn_prayer: '#ffc28a', blessing: '#ffd23f', divine_light: '#fff2a8',
  sacred_ray: '#ffd23f', judgement: '#9fd8ff', guardian_wings: '#9fd8ff', frost_nova: '#bfe9ff', eternal_winter: '#bfe9ff', frost_storm: '#bfe9ff',
  fireball: '#ff8a3a', flame_spray: '#ff8a3a', hellfire: '#ff5a2a', ash_crown: '#ff8a3a', void_orb: '#b05cff', eclipse: '#a855ff', heavy_cut: '#ff5a4a',
  valiant_cut: '#5aa8ff', void_blade: '#a855ff', shield_bash: '#7fb0ff', taunt: '#ff4a3a', rampart: '#ffd23f', holy_shield: '#4fa3ff',
  pierce_arrow: '#e8e0c8', ranger_shot: '#5ad46a', falcon: '#7fe07a', low_strike: '#b46bff', blade_dance: '#d8b8ff', thorn_waltz: '#ff6fa8',
  blood_whirl: '#ff4a3a', execution: '#ff3a3a', twin_blades: '#b46bff', flash_strike: '#9a5cff', pierce: '#e84a5f', axe_whirl: '#ffa630',
  war_howl: '#ff5a3a', fury: '#ff4a3a', carnage: '#ff3a1a', bite: '#ffffff', frenzy: '#ff8a3a', instinct: '#ffd27a', sap_of_life: '#63d98a',
  harvest: '#63d98a', gold_rain: '#ffd23f', claw: '#ffffff', dive: '#c8b8ff', fairy_heal: '#7fe0c0', ki_wave: '#7fd6ff', whirlwind: '#e8f4ff', war_cry: '#ffc23a', holy_smite: '#ffe680',
  // v9.2.9 : nouveaux familiers
  crystal_spikes: '#c8a8ff', ember_breath: '#ff7a2a', dragon_blaze: '#ff6a1a', jade_shell: '#5fe0a0', jade_sanctuary: '#5fe0a0', foxfire: '#5ad8ff',
  nine_tails: '#5ad8ff', phoenix_feather: '#ffb03a', rebirth: '#ff7a2a' };
const SUPPORT_FX = new Set(['prayer', 'dawn_prayer', 'blessing', 'divine_light', 'sacred_ray', 'guardian_wings', 'taunt', 'rampart', 'holy_shield',
  'war_howl', 'frenzy', 'sap_of_life', 'war_cry', 'fairy_heal', 'jade_shell', 'jade_sanctuary', 'phoenix_feather']); // v9.2.9 : + familiers

// Effet sobre : un halo doux au lanceur et un éclat à la cible (ou sur l'équipe pour un soutien), sans secousse.
function calm(s, name, c) {
  const color = CALM_COLOR[name] ?? '#ffffff';
  const G = s.groundY;
  const support = SUPPORT_FX.has(name);
  add(s, c.release, 0.5, (ctx, k) => {
    ctx.globalAlpha = 0.6 * (1 - k);
    ring(ctx, c.src.x, G - 1, 8 + k * 6, 2.5, color);
    if (support) for (const x of c.team) ring(ctx, x, G - 1, 8 + k * 4, 2.5, color);
    else for (const f of c.foes) { ring(ctx, f.x, G - 12, 4 + k * 8, 4 + k * 8, color); }
  });
  if (!support) later(s, c.release + 0.1, () => strike(s, c, color));
}

export const isSupportFx = (name) => SUPPORT_FX.has(name);

// v9.2.6 : soins et bonus de l'équipe, malus des ennemis : aura dessinée (PixelLab, vfx.js) aux pieds des cibles.
const HEAL_FX = new Set(['prayer', 'dawn_prayer', 'divine_light', 'sap_of_life', 'fairy_heal', 'harvest', 'jade_sanctuary', 'phoenix_feather', 'rebirth']); // v9.2.9 : + familiers
const SHIELD_FX = new Set(['rampart', 'holy_shield', 'jade_shell', 'guardian_wings', 'taunt']); // v9.7.1
const DEBUFF_FX = new Set(['taunt', 'eclipse', 'frost_nova', 'eternal_winter', 'frost_storm']);
function auraFx(scene, name, c) {
  const G = scene.groundY;
  const at = (fn) => later(scene, c.release ?? 0, fn);
  // v9.7.1 (lot E) : soins, ralliements et protections dessinés en 12 images (sk_heal, sk_rally, sk_shield) ; un buff
  // durable ne laisse plus d'aura en boucle sur le personnage (au plus 0,8 s, petite taille) : il ne le cache jamais.
  const kind = HEAL_FX.has(name) ? 'sk_heal' : SHIELD_FX.has(name) ? 'sk_shield' : 'sk_rally';
  if (HEAL_FX.has(name) || SUPPORT_FX.has(name)) at(() => c.team.forEach((x, i) => vfx(scene, kind, x, G + 1, { delay: i * 0.06, size: kind === 'sk_shield' ? 0.28 : 0.35, alpha: 0.55, back: true }))); // v9.8.1 (I8) : sous les pieds, jamais par-dessus
  if (DEBUFF_FX.has(name)) at(() => c.foes.slice(0, 4).forEach((f) => vfx(scene, 'debuff_aura', f.x, G + 1, { life: 1.4, loop: true, follow: f.id, size: 0.9 })));
}

// v9.11 (1) : sorts redessinés (planches PixelLab de 9 à 14 images, 2 à 3 fois la taille du lanceur), joués en 3 temps
// — préparation (lueur qui converge sur le lanceur), impact, retombée (braises et fumée) — à la place des formes
// dessinées en code (anneaux, croissants, disques). Une variante par compagnon quand des sorts sont partagés.
const BIG = {
  fireball: { sheet: 'v_fireball_blast', at: 'foe', color: '#ff7a2a' },
  hellfire: { sheet: 'v_flame_wall', at: 'zone', color: '#ff6a1a' },
  whirlwind: { sheet: 'v_whirlwind', at: 'ahead', color: '#bfe6ff' },
  blood_whirl: { sheet: 'v_whirl_blood', at: 'ahead', color: '#ff4a4a' },
  flash_strike: { sheet: 'v_flash_strike', at: 'ahead', color: '#bff4ff' },
  holy_smite: { sheet: 'v_holy_smite', at: 'foe', color: '#ffe680' },
  blessing: { sheet: 'v_blessing', at: 'team', color: '#ffd36a' },
  prayer: { sheet: 'v_prayer_sun', at: 'team', color: '#fff2a8' },
  taunt: { sheet: 'v_taunt', at: 'hero', color: '#ff5a4a' },
  rampart: { sheet: 'v_rampart', at: 'hero', color: '#ffd36a' },
  execution: { sheet: 'v_execution', at: 'foe', color: '#ff3a4a' },
  blade_dance: { sheet: 'v_dance_shadow', at: 'foe', color: '#b46bff' },
  meteor: { sheet: 'v_meteor_crater', at: 'zone', color: '#ff6a1a', meteor: true },
  war_cry: { sheet: 'v_war_wave', at: 'hero', color: '#ffc23a', wave: true },
};
const UNIT_BIG = {
  ally_shadow: { blade_dance: 'v_dance_shadow' }, ally_rose_blade: { blade_dance: 'v_dance_rose' }, ally_ninja: { blade_dance: 'v_dance_ninja' },
  ally_shadow_lord: { blade_dance: 'v_dance_void' },
  ally_priestess: { prayer: 'v_prayer_dawn' }, ally_high_priest: { prayer: 'v_prayer_sun' }, ally_archangel: { prayer: 'v_prayer_feathers' },
  ally_sylvan_guardian: { prayer: 'v_prayer_leaves' },
  ally_azure_paladin: { taunt: 'v_taunt_azure' }, ally_barbarian: { blood_whirl: 'v_whirl_axe' },
};
export const bigSkillSheet = (name, sprite = null) => (BIG[name] ? UNIT_BIG[sprite]?.[name] ?? BIG[name].sheet : null);
function bigFx(scene, name, c) {
  const def = BIG[name];
  const sheet = bigSkillSheet(name, c.sprite);
  if (!def || !vfx2Ready(sheet)) return false;
  const G = scene.groundY;
  const team = c.team.length ? c.team.reduce((a, x) => a + x, 0) / c.team.length : c.hero;
  const x = { foe: c.foes[0]?.x ?? c.front, zone: c.mid, ahead: (c.src.x + c.front) / 2, team, hero: c.hero }[def.at] ?? c.mid;
  const e = VFX_ALL[sheet];
  const y = e && e.ay / e.h > 0.7 ? G + 1 : G - 22;
  const rel = c.release ?? 0;
  // 1. Préparation : lueur qui converge sur le lanceur.
  vfx(scene, 'v_charge', c.src.x, c.src.y ?? G - 22, { tint: def.color, delay: Math.max(0, rel - 0.3), size: 0.9 });
  if (def.meteor) {
    // Météore : la pierre tombe en diagonale (traînée de feu), son ombre grandit au sol, puis le cratère.
    later(scene, rel, () => {
      vfx(scene, 'v_meteor_rock', x - 90, G - 150, { vx: 150, vy: 250, life: 0.6, loop: true });
      add(scene, rel, 0.6, (ctx, k) => { ctx.globalAlpha = 0.25 + 0.4 * k; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(x, G + 1, 6 + 22 * k, 2 + 3 * k, 0, 0, Math.PI * 2); ctx.fill(); });
    });
    later(scene, rel + 0.6, () => { vfx(scene, sheet, x, y); scene.shake = Math.max(scene.shake ?? 0, 1.5); vfx(scene, 'v_embers', x, G - 10, { delay: 0.5, tint: def.color }); });
    return true;
  }
  if (def.wave) {
    // Cri de guerre : l'onde part du héros et traverse l'équipe (vers la gauche) ; l'aura dorée reste ensuite tant
    // que le bonus dure (render/vfx-world.js, flamme dorée aux pieds).
    later(scene, rel, () => vfx(scene, sheet, c.hero - 30, G - 20, { flip: true }));
    return true;
  }
  // 2. Impact, 3. retombée.
  later(scene, rel, () => vfx(scene, sheet, x, y));
  later(scene, rel + 0.45, () => vfx(scene, 'v_embers', x, G - 12, { tint: def.color, size: 0.8 }));
  return true;
}

function run(scene, name, c) {
  if (!FX[name]) return;
  add.cur = name;
  // v9.11 (1) : version dessinée quand elle existe (« Réduire les animations » : effet sobre inchangé).
  if (!scene.focus && bigFx(scene, name, c)) { auraFx(scene, name, c); return; }
  auraFx(scene, name, c);
  skillVfx(scene, name, c);
  if (scene.focus) calm(scene, name, c);
  else FX[name](scene, c);
}

// Contexte d'un effet : lanceur (src), équipe (x au sol), ennemis (id, x à l'écran), cible, milieu et fond de la file.
export function fxContext(scene, world, src, heroX) {
  const foes = (world.enemies ?? []).map((e) => ({ id: e.id, x: scene.wx(e.x) }));
  const team = [heroX, ...[...(scene.layout?.slots?.values() ?? [])].map((sl) => sl.cx)].sort((a, b) => b - a);
  const front = foes.length ? Math.min(...foes.map((f) => f.x)) : heroX + 60;
  const far = foes.length ? Math.max(...foes.map((f) => f.x)) : front;
  return { src, foes, team, hero: heroX, front, far, mid: (front + far) / 2 };
}

// v9.8 (F) : sorts renommés selon l'élément — même geste que le sort d'origine, effet de l'élément quand il existe.
const THEMED_FX = { 'Mur de flammes': 'hellfire', 'Éclat de glace': 'frost_nova', Blizzard: 'eternal_winter', 'Nova de givre': 'frost_storm',
  'Trait d\'ombre': 'void_orb', 'Malédiction': 'void_orb', 'Éclipse': 'eclipse', 'Charge': 'pierce' };
for (const c of COMPANIONS) {
  const map = UNIT_SKILL_MOTIFS[c.sprite];
  if (!map) continue;
  const role = COMPANION_ROLES[c.id] ?? 'pet';
  const raw = SKILL_TEMPLATES[role] ?? SKILL_TEMPLATES.pet;
  themedTemplate(c, role).forEach((sk, i) => {
    const old = map[raw[i].name];
    if (!old) return;
    const fx = THEMED_FX[sk.name];
    if (!map[sk.name] || sk.name !== raw[i].name) map[sk.name] = [old[0], fx && FX[fx] ? fx : old[1]];
  });
}
