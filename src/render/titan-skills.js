// v10.16 : compétences propres des 7 Titans du jour (data/grand-bosses.js, DAY_TITANS : 3 attaques et 2 phases chacun).
// Registre { id → (scene, ev, box) => void }, appelé par WorldBossScene.special() (render/world-boss-scene.js) AVANT le
// code du Colosse : un Titan ne réutilise ni le rocher, ni le rayon des yeux, ni le séisme, ni la pluie de braises.
// Chaque compétence :
//   1. annonce (0,5 à 0,8 s) : cercle ou fissure au sol, lueur sur le Titan, nom de l'attaque au-dessus de lui ;
//   2. geste du Titan pris dans ses planches (throw : lancer ; beam : souffle / rayon ; quake : frappe au sol ;
//      embers : bras levés ; transform / fury : transformation) — sans `ev` sur l'animation : le moteur du Colosse ne
//      lance donc ni rocher ni faisceau ;
//   3. effet propre : VFX existants (sk_*, hit_*, mut_stomp, boss_rage…) et formes dessinées ici en code ;
//   4. coup reçu : scene.heroHurt() (chiffre, choc, secousse) au bon instant, arrêt sur image.
// Les phases changent la scène jusqu'à la fin de la tentative (ambiance : soleil levant, nuit, cendres, eau, arbres,
// orage, fissures). « Réduire les animations » (renderer.focus) : seulement le coup reçu (world-boss-scene.js).
// Silhouette : un élément dessiné en code par-dessus la planche recolorée de chaque Titan (couronne, halo, cœur…).
// Interdit ici (v10.16, boss-feel.js) : arcs en croissant et effets fx_slash*. Les disques (lune, soleil noir) sont pleins.
import { vfx } from './vfx.js';
import { formatNumber } from '../core/format.js';
import { t as tr } from '../i18n/i18n.js';
import { BALANCE } from '../data/balance.js';
import { WORLD_SCALE } from './scene.js';

const TAU = Math.PI * 2;
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const ease = (u) => 1 - (1 - u) ** 3;

// ---------- état propre au Titan, posé sur la scène ----------
function st(scene) {
  return (scene.titanFx ??= { list: [], amb: {}, push: 0, pushTo: 0, spin: null, flick: 0, motes: [] });
}
const heroX = () => BALANCE.world.heroX * WORLD_SCALE;
// Abscisses de l'équipe (héros puis compagnons), d'après la disposition du renderer.
function teamXs(scene) {
  const xs = [heroX()];
  for (const [, s] of scene.r.layout?.slots ?? []) if (Number.isFinite(s.cx)) xs.push(s.cx);
  return xs;
}
const backX = (scene) => Math.min(...teamXs(scene)) - 16;
function boxOf(scene) {
  const r = scene.r;
  return scene.bossBox() ?? { x: r.width * 0.7, y: r.groundY - 50, top: r.groundY - 100, w: 80, h: 100, foot: r.groundY };
}
// Repères du corps sur la planche du Colosse (pixels de l'image, 128 px) → écran (suivent l'image affichée).
const HEAD = [39, 30];
const CHEST = [52, 62];
const HAND = [16, 34];
const pt = (scene, p) => (scene.drawn ? scene.at(p[0] * scene.art.frame / 128, p[1] * scene.art.frame / 128) : [boxOf(scene).x, boxOf(scene).y]);

// Effet dessiné en code : draw(ctx, u, f) chaque image (u : 0..1), calque 'back' (derrière le Titan, devant le
// décor) ou 'over' (devant tout le monde).
function add(scene, { delay = 0, dur, layer = 'over', draw, end }) {
  const f = { t: -delay, dur, layer, draw, end };
  st(scene).list.push(f);
  return f;
}
// Tout l'écran, sans le décalage horizontal du calque.
function screen(ctx, r, fn) {
  const m = ctx.getTransform();
  ctx.save();
  ctx.setTransform(m.a, 0, 0, m.d, 0, 0);
  fn(r.width, r.height);
  ctx.restore();
}

// ---------- briques communes ----------
// Nom de l'attaque au-dessus du Titan (comme « Jet de pierre ») et lueur sur son corps.
function announce(scene, ev, color, dur = 0.7) {
  const r = scene.r;
  add(scene, { dur: 1.6, draw: (ctx, u) => {
    const b = boxOf(scene);
    ctx.save();
    ctx.globalAlpha = Math.min(1, u * 8, (1 - u) * 5);
    ctx.font = '800 8px system-ui, "Noto Sans KR", "Malgun Gothic", sans-serif';
    ctx.textAlign = 'center';
    const y = Math.max(12, b.top - 6 - u * 4);
    ctx.lineWidth = 3; ctx.strokeStyle = '#120c1c'; ctx.strokeText(tr(ev.name), b.x, y);
    ctx.fillStyle = color; ctx.fillText(tr(ev.name), b.x, y);
    ctx.restore();
  } });
  add(scene, { dur, draw: (ctx, u) => {
    const b = boxOf(scene);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.w * 0.7);
    g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.45 * Math.sin(Math.PI * u) * (0.8 + 0.2 * Math.sin(r.time * 30));
    ctx.fillStyle = g;
    ctx.fillRect(b.x - b.w, b.y - b.h, b.w * 2, b.h * 2);
    ctx.restore();
  } });
}
// Cercle d'alerte au sol (pulse, se resserre) : là où le coup va tomber.
function ring(scene, x, color, { delay = 0, dur = 0.6, rad = 14 } = {}) {
  const G = scene.r.groundY;
  add(scene, { delay, dur, layer: 'back', draw: (ctx, u) => {
    ctx.save();
    ctx.globalAlpha = 0.35 + 0.5 * u;
    ctx.strokeStyle = color; ctx.lineWidth = 1.5;
    const k = 1.25 - 0.25 * u;
    ctx.beginPath(); ctx.ellipse(x, G + 1, rad * k, rad * 0.3 * k, 0, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 0.18 + 0.2 * u; ctx.fillStyle = color;
    ctx.beginPath(); ctx.ellipse(x, G + 1, rad * u, rad * 0.3 * u, 0, 0, TAU); ctx.fill();
    ctx.restore();
  } });
}
// Fissure au sol entre x0 et x1 (lueur de la couleur), qui s'ouvre puis reste un instant.
function crack(scene, x0, x1, color, { delay = 0, dur = 0.8, layer = 'back' } = {}) {
  const G = scene.r.groundY;
  const pts = [];
  for (let i = 0; i <= 8; i++) pts.push([x0 + (x1 - x0) * (i / 8), G + rnd(-1.5, 1.5)]);
  add(scene, { delay, dur, layer, draw: (ctx, u) => {
    const n = Math.max(1, Math.round(8 * Math.min(1, u * 2.5)));
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(1, (1 - u) * 4);
    for (const [w, c] of [[4, color], [1.5, '#fff4d0']]) {
      ctx.strokeStyle = c; ctx.lineWidth = w;
      ctx.beginPath(); ctx.moveTo(...pts[0]);
      for (let i = 1; i <= n; i++) ctx.lineTo(...pts[i]);
      ctx.stroke();
    }
    ctx.restore();
  } });
}
// Éclair en zigzag de (x0, y0) à (x1, y1), redessiné à chaque image.
function bolt(ctx, x0, y0, x1, y1, color, width = 2, jag = 6) {
  const n = Math.max(3, Math.round(Math.hypot(x1 - x0, y1 - y0) / 10));
  const nx = -(y1 - y0), ny = x1 - x0, l = Math.hypot(nx, ny) || 1;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineJoin = 'round';
  for (const [w, c, a] of [[width * 3, color, 0.35], [width, '#ffffff', 1]]) {
    ctx.strokeStyle = c; ctx.lineWidth = w; ctx.globalAlpha *= a;
    ctx.beginPath(); ctx.moveTo(x0, y0);
    for (let i = 1; i < n; i++) {
      const k = i / n, o = rnd(-jag, jag);
      ctx.lineTo(x0 + (x1 - x0) * k + (nx / l) * o, y0 + (y1 - y0) * k + (ny / l) * o);
    }
    ctx.lineTo(x1, y1); ctx.stroke();
    ctx.globalAlpha /= a;
  }
  ctx.restore();
}
// Coup reçu par le héros (chiffre, choc, secousse) et court arrêt sur image.
// v10.19 (5.1) : flash de coup de la couleur du Titan (jamais blanc), ≤ 35 % (scene.js, effet 'flash'), en 0,15 s.
export const TITAN_FLASH_TIME = 0.15;
export const TITAN_FLASH_ALPHA = 0.35;
function strike(scene, ev, delay, { shake = 7, stop = 0.06, flash = null, part = 1 } = {}) {
  const r = scene.r;
  scene.heroHurt(part === 1 ? ev : { ...ev, damage: ev.damage * part }, delay, shake);
  r.later(delay, () => {
    r.hitstop = Math.max(r.hitstop ?? 0, stop);
    if (flash) r.effects.push({ kind: 'flash', life: TITAN_FLASH_TIME, max: TITAN_FLASH_TIME, color: flash });
  });
}
// Flash de couleur sur un membre de l'équipe (taille d'un personnage) : teinte ≤ 35 %, 0,15 s, sans blanc plein.
function tintFlash(scene, x, color, delay = 0) {
  const G = scene.r.groundY;
  add(scene, { delay, dur: TITAN_FLASH_TIME, draw: (ctx, u) => {
    ctx.save(); ctx.globalAlpha = TITAN_FLASH_ALPHA * (1 - u); ctx.fillStyle = color;
    ctx.beginPath(); ctx.ellipse(x, G - 14, 9, 15, 0, 0, TAU); ctx.fill();
    ctx.restore();
  } });
}
// Geste du Titan (planche existante), sans déclencher les attaques du Colosse ni la charge de ses yeux.
function gesture(scene, name, then = null) {
  scene.play(name, then);
  if (scene.anim) scene.anim.quiet = true;
}
// Projectile dessiné en code, en arc, de (x0, y0) à (x1, y1) ; onLand à l'arrivée.
function lob(scene, { delay, dur, x0, y0, x1, y1, arc = 50, draw, onLand }) {
  add(scene, { delay, dur, draw: (ctx, u, f) => {
    const x = x0 + (x1 - x0) * u;
    const y = y0 + (y1 - y0) * u * u - arc * Math.sin(Math.PI * u);
    draw(ctx, x, y, u, f);
  }, end: onLand });
}
function puddle(scene, x, color, dur, w = 10) {
  const G = scene.r.groundY;
  add(scene, { dur, layer: 'back', draw: (ctx, u) => {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(1, (1 - u) * 3) * (0.7 + 0.2 * Math.sin(scene.r.time * 9 + x));
    const g = ctx.createRadialGradient(x, G, 0, x, G, w);
    g.addColorStop(0, '#fff0a0'); g.addColorStop(0.4, color); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(x, G + 1, w, w * 0.3, 0, 0, TAU); ctx.fill();
    ctx.restore();
  } });
}
function ambient(scene, id) { st(scene).amb[id] = scene.r.time; }
const since = (scene, id) => scene.r.time - (st(scene).amb[id] ?? scene.r.time);

// v10.19 (5.2) : Nuit sans fin. Assombrissement du sol (et du décor derrière l'équipe) : nuit ambiante puis voile de
// l'attaque ; l'équipe est dessinée par-dessus (calque 'back'). Luminosité du sol : (1 − ambiante) × (1 − voile) ≥ 45 %.
export const NIGHT_AMBIENT_DARK = 0.5;
export const NIGHT_GROUND_DARK = 0.1;
export const NIGHT_SKY_DARK = 0.8;
export const NIGHT_MIN_LIGHT = 0.45;
export const nightGroundLight = () => (1 - NIGHT_AMBIENT_DARK) * (1 - NIGHT_GROUND_DARK);
// v10.19 (5.3) : ciel de l'Orage gris-bleu foncé ; les éclairs de fond ne l'éclaircissent qu'un peu.
export const STORM_SKY = '#1c2638';
export const STORM_FLICK_MAX = 0.15;

// ---------- SOLEIL (dimanche) ----------
const GOLD = '#ffd23f';
function sunLance(scene, ev) {
  const r = scene.r, G = r.groundY, tx = heroX() + 18;
  announce(scene, ev, GOLD, 0.7);
  ring(scene, tx, GOLD, { dur: 0.7, rad: 12 });
  gesture(scene, 'throw');
  const [hx, hy] = pt(scene, HAND);
  add(scene, { delay: 0.72, dur: 0.16, draw: (ctx, u) => {
    const x = hx + (tx - hx) * u, y = hy + (G - 6 - hy) * u;
    const a = Math.atan2(G - 6 - hy, tx - hx);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    for (const [w, c, al] of [[6, GOLD, 0.35], [2, '#fffbe0', 1]]) {
      ctx.globalAlpha = al; ctx.strokeStyle = c; ctx.lineWidth = w;
      ctx.beginPath(); ctx.moveTo(x - Math.cos(a) * 26, y - Math.sin(a) * 26); ctx.lineTo(x, y); ctx.stroke();
    }
    ctx.restore();
  }, end: () => {
    // Le javelot se plante, puis éclate en croix dorée (deux barres, verticale et horizontale).
    add(scene, { dur: 0.55, draw: (ctx, u) => {
      const k = ease(u);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 1 - u;
      ctx.fillStyle = GOLD;
      ctx.fillRect(tx - 2 - k * 2, G - 8 - 40 * k, 4 + k * 4, 80 * k);
      ctx.fillRect(tx - 34 * k, G - 10 - 2 - k * 2, 68 * k, 4 + k * 4);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(tx - 1, G - 8 - 36 * k, 2, 72 * k);
      ctx.fillRect(tx - 30 * k, G - 11, 60 * k, 2);
      ctx.restore();
    } });
    vfx(r, 'hit_holy', tx, G - 10, { size: 1.6 });
    r.burst(tx, G - 10, GOLD, 18, 90);
  } });
  strike(scene, ev, 0.9, { flash: GOLD });
}
function sunCrown(scene, ev) {
  const r = scene.r, G = r.groundY;
  announce(scene, ev, GOLD, 0.6);
  gesture(scene, 'embers');
  const xs = [heroX() + 40, heroX() + 18, heroX(), backX(scene) + 30, backX(scene) + 6];
  xs.forEach((x, i) => {
    const t0 = 0.25 + i * 0.22;
    ring(scene, x, GOLD, { delay: t0, dur: 0.6, rad: 10 });
    // Colonne de lumière qui tombe du ciel sur le cercle.
    add(scene, { delay: t0 + 0.6, dur: 0.45, draw: (ctx, u) => {
      const top = -20, h = (G - top) * Math.min(1, u * 5);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createLinearGradient(x - 9, 0, x + 9, 0);
      g.addColorStop(0, 'rgba(255,210,63,0)'); g.addColorStop(0.5, '#fff6c0'); g.addColorStop(1, 'rgba(255,210,63,0)');
      ctx.globalAlpha = 1 - u * u; ctx.fillStyle = g;
      ctx.fillRect(x - 9, top, 18, h);
      ctx.restore();
    }, end: () => {} });
    r.later(t0 + 0.68, () => { vfx(r, 'hit_holy', x, G - 6, { size: 1.2 }); r.burst(x, G - 4, GOLD, 8, 60); r.shake = Math.max(r.shake, 3); });
  });
  strike(scene, ev, 0.25 + 2 * 0.22 + 0.68, { flash: GOLD });
}
function sunBlind(scene, ev) {
  const r = scene.r;
  announce(scene, ev, '#ffffff', 0.75);
  gesture(scene, 'beam');
  // Le soleil se concentre sur son torse…
  add(scene, { dur: 0.8, draw: (ctx, u) => {
    const [cx, cy] = pt(scene, CHEST);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const rad = 4 + 18 * u;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.4, GOLD); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
    ctx.restore();
  } });
  // … puis éclair doré (v10.19 : couleur du Titan, ≤ 35 %, 0,15 s ; plus de blanc plein écran) ; l'équipe se protège les yeux.
  r.later(0.75, () => { r.teamBrace = r.time + 1.3; });
  strike(scene, ev, 0.85, { stop: 0.1, flash: GOLD });
}
function sunRise(scene, ev) {
  const r = scene.r;
  announce(scene, ev, GOLD, 0.8);
  gesture(scene, 'embers');
  ambient(scene, 'sun');
  vfx(r, 'boss_rage', boxOf(scene).x, r.groundY, { size: 2.2, tint: GOLD });
  for (let i = 0; i < 6; i++) r.later(1 + i * 0.07, () => r.burst(heroX() + rnd(-20, 30), r.groundY - rnd(8, 30), GOLD, 4, 50));
  r.later(1.1, () => vfx(r, 'sk_divine_light', heroX(), r.groundY, { size: 1, tint: GOLD, alpha: 0.6 })); // v10.19 (5.1) : plus de colonne blanche
  strike(scene, ev, 1.2, { flash: GOLD, stop: 0.08 });
}
function sunNoon(scene, ev) {
  const r = scene.r, G = r.groundY;
  announce(scene, ev, '#ff9a2a', 0.7);
  gesture(scene, 'quake');
  ambient(scene, 'noon');
  const b = boxOf(scene);
  const x0 = b.x - b.w * 0.3, x1 = backX(scene) - 40;
  // Vague de chaleur : une bande d'air ondulant qui court du Titan vers l'équipe, et brûle le sol en traînées dorées.
  add(scene, { delay: 0.6, dur: 0.9, draw: (ctx, u) => {
    const x = x0 + (x1 - x0) * u;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 6; k++) {
      ctx.globalAlpha = 0.5 - k * 0.07; ctx.strokeStyle = k % 2 ? '#ffb04a' : '#fff0a0'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let y = G - 70; y <= G; y += 3) ctx.lineTo(x + k * 6 + Math.sin(y * 0.25 + r.time * 25 + k) * 3, y);
      ctx.stroke();
    }
    ctx.restore();
    if (Math.random() < 0.6) r.burst(x, G - 2, '#ffb04a', 2, 30);
  } });
  for (let i = 0; i < 6; i++) { const x = x0 + (x1 - x0) * (i / 5); r.later(0.6 + 0.9 * (i / 5), () => puddle(scene, x, '#ffb04a', 2.2, 14)); }
  strike(scene, ev, 0.6 + 0.9 * clamp01((x0 - heroX()) / (x0 - x1)), { flash: '#ffb04a' });
}

// ---------- LUNE (lundi) ----------
const SILVER = '#c9d8ff';
const MOON_FLASH = '#8fa8ff'; // v10.19 (5.1) : flash du Titan de la Lune (argent bleuté, pas blanc)
function moonDisc(scene, ev) {
  const r = scene.r, G = r.groundY;
  announce(scene, ev, SILVER, 0.65);
  ring(scene, heroX(), SILVER, { dur: 0.65 });
  gesture(scene, 'throw');
  const [hx, hy] = pt(scene, HAND);
  const far = backX(scene) - 10;
  // Disque plein (jamais un croissant), aller puis retour.
  add(scene, { delay: 0.7, dur: 1.1, draw: (ctx, u) => {
    const v = u < 0.5 ? u * 2 : 2 - u * 2;
    const x = hx + (far - hx) * ease(v);
    const y = hy + (G - 22 - hy) * Math.min(1, v * 1.6) - (u < 0.5 ? 0 : 10 * Math.sin(Math.PI * (u - 0.5) * 2));
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.translate(x, y);
    ctx.globalAlpha = 0.4; ctx.fillStyle = SILVER;
    ctx.beginPath(); ctx.ellipse(0, 0, 13, 5, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.95; ctx.fillStyle = '#f4f8ff';
    ctx.beginPath(); ctx.ellipse(0, 0, 8, 3 + Math.abs(Math.sin(r.time * 20)) * 1.5, 0, 0, TAU); ctx.fill();
    ctx.restore();
    if (Math.random() < 0.5) r.burst(x, y, SILVER, 1, 15);
  } });
  const tHit = 0.7 + 1.1 * 0.5 * ((hx - heroX()) / Math.max(1, hx - far));
  r.later(tHit, () => vfx(r, 'hit_ice', heroX() + 6, G - 22, { size: 1.1 }));
  r.later(1.8 - (tHit - 0.7), () => vfx(r, 'hit_ice', heroX() + 6, G - 22, { size: 1.1, flip: true }));
  strike(scene, ev, tHit, { part: 0.5, shake: 5 });
  strike(scene, ev, 1.8 - (tHit - 0.7), { part: 0.5, shake: 5 });
}
function moonGaze(scene, ev) {
  const r = scene.r, G = r.groundY;
  announce(scene, ev, SILVER, 0.7);
  gesture(scene, 'beam');
  const xs = teamXs(scene);
  // Rayon pâle : un large cône depuis le torse qui couvre toute l'équipe.
  add(scene, { delay: 0.7, dur: 0.7, draw: (ctx, u) => {
    const [cx, cy] = pt(scene, CHEST);
    const a = Math.min(1, u * 6, (1 - u) * 4);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(cx, 0, Math.min(...xs) - 20, 0);
    g.addColorStop(0, '#ffffff'); g.addColorStop(1, 'rgba(201,216,255,0.2)');
    ctx.globalAlpha = 0.55 * a; ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(cx, cy - 3); ctx.lineTo(Math.min(...xs) - 20, G - 50); ctx.lineTo(Math.min(...xs) - 20, G + 2); ctx.lineTo(cx, cy + 3); ctx.fill();
    ctx.restore();
  } });
  // Givre sur l'équipe : 0,5 s de glace pâle sur chacun.
  for (const x of xs) {
    r.later(0.9, () => vfx(r, 'hit_ice', x, G - 14, { size: 0.9, tint: MOON_FLASH, alpha: 0.7 }));
    // v10.19 (5.1) : flash bleuté ≤ 35 % en 0,15 s, puis seulement un contour de givre (plus de silhouette blanche).
    tintFlash(scene, x, MOON_FLASH, 0.9);
    add(scene, { delay: 0.9, dur: 0.6, draw: (ctx, u) => {
      ctx.save(); ctx.strokeStyle = SILVER; ctx.globalAlpha = 0.7 * (1 - u); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(x, G - 14, 9, 15, 0, 0, TAU); ctx.stroke();
      ctx.restore();
    } });
  }
  strike(scene, ev, 0.9, { flash: MOON_FLASH });
}
function moonMirror(scene, ev) {
  const r = scene.r;
  announce(scene, ev, SILVER, 0.6);
  // Deux doubles transparents surgissent de part et d'autre, frappent avec lui, puis se dissipent.
  for (const [dx, dy] of [[-46, 6], [-22, -10]]) {
    add(scene, { delay: 0.1, dur: 1.4, layer: 'back', draw: (ctx, u) => {
      const fr = scene.frameImage?.();
      if (!fr) return;
      const lunge = u > 0.45 && u < 0.75 ? Math.sin(((u - 0.45) / 0.3) * Math.PI) * -18 : 0;
      ctx.save();
      ctx.globalAlpha = 0.38 * Math.min(1, u * 5, (1 - u) * 4);
      ctx.filter = 'brightness(1.6) saturate(0.4)';
      ctx.drawImage(fr.im, fr.i * fr.frame, 0, fr.frame, fr.frame, fr.x + dx + lunge, fr.y + dy, fr.w, fr.w);
      ctx.restore();
    } });
  }
  gesture(scene, 'attack');
  r.later(0.75, () => { for (const x of teamXs(scene).slice(0, 3)) vfx(r, 'hit_blunt', x + 6, r.groundY - 18, { size: 1.2, tint: SILVER }); r.burst(heroX(), r.groundY - 20, SILVER, 14, 70); });
  strike(scene, ev, 0.75, { flash: MOON_FLASH });
}
function moonTide(scene, ev) {
  const r = scene.r, G = r.groundY;
  announce(scene, ev, SILVER, 0.8);
  gesture(scene, 'embers');
  ambient(scene, 'night');
  // Vague d'argent qui monte du sol et balaie l'équipe.
  add(scene, { delay: 0.6, dur: 1.2, draw: (ctx, u) => screen(ctx, r, (w) => {
    const h = 40 * Math.sin(Math.PI * u);
    const g = ctx.createLinearGradient(0, G - h, 0, G + 4);
    g.addColorStop(0, 'rgba(160,180,255,0.6)'); g.addColorStop(1, 'rgba(120,140,220,0.15)'); // v10.19 : plus de blanc
    ctx.fillStyle = g; ctx.globalAlpha = 0.7;
    ctx.beginPath(); ctx.moveTo(0, G + 4);
    for (let x = 0; x <= w; x += 6) ctx.lineTo(x, G - h + Math.sin(x * 0.08 + r.time * 6) * 3);
    ctx.lineTo(w, G + 4); ctx.fill();
  }) });
  strike(scene, ev, 1.1, { flash: MOON_FLASH, stop: 0.08 });
}
function moonNight(scene, ev) {
  const r = scene.r, G = r.groundY;
  announce(scene, ev, SILVER, 0.6);
  ambient(scene, 'night');
  ambient(scene, 'deep');
  gesture(scene, 'beam');
  // 2 s de nuit : ciel noir, ses yeux brillent ; v10.19 (5.2) : la nuit est posée DERRIÈRE l'équipe (calque 'back') et
  // s'éclaircit vers le sol : héros et sol gardent au moins 45 % de luminosité (NIGHT_MIN_LIGHT), contour de l'équipe net.
  add(scene, { delay: 0.3, dur: 2.2, layer: 'back', draw: (ctx, u) => {
    const a = Math.min(1, u * 6, (1 - u) * 8);
    screen(ctx, r, (w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, G);
      g.addColorStop(0, `rgba(4,4,12,${NIGHT_SKY_DARK})`); g.addColorStop(0.55, `rgba(4,4,12,${NIGHT_SKY_DARK * 0.7})`); g.addColorStop(1, `rgba(4,4,12,${NIGHT_GROUND_DARK})`);
      ctx.globalAlpha = a; ctx.fillStyle = g; ctx.fillRect(0, 0, w, G - 4);
      ctx.fillStyle = `rgba(4,4,12,${NIGHT_GROUND_DARK})`; ctx.fillRect(0, G - 4, w, h - G + 4);
    });
  } });
  add(scene, { delay: 0.3, dur: 2.2, draw: (ctx, u) => {
    const a = Math.min(1, u * 6, (1 - u) * 8);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.strokeStyle = '#9fb4ff'; ctx.lineWidth = 1.5;
    for (const x of teamXs(scene)) { ctx.beginPath(); ctx.ellipse(x, G - 14, 8, 15, 0, 0, TAU); ctx.stroke(); }
    ctx.globalCompositeOperation = 'lighter';
    const eye = scene.art.eyes?.beam?.[0] ?? [34, 39, 44, 38];
    for (const [ex, ey] of [[eye[0], eye[1]], [eye[2], eye[3]]]) {
      const [px, py] = scene.at(ex + 0.5, ey + 0.5);
      const g = ctx.createRadialGradient(px, py, 0, px, py, 7);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.4, SILVER); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(px - 8, py - 8, 16, 16);
    }
    ctx.restore();
  } });
  r.later(2.3, () => { vfx(r, 'hit_shadow', heroX() + 4, G - 18, { size: 1.6 }); gesture(scene, 'attack'); });
  strike(scene, ev, 2.35, { flash: MOON_FLASH, stop: 0.12, shake: 9 });
}

// ---------- BRAISES (mardi) ----------
const LAVA = '#ff5a1f';
function emberBomb(scene, ev) {
  const r = scene.r, G = r.groundY, tx = heroX() + 10;
  announce(scene, ev, '#ff8a3d', 0.7);
  ring(scene, tx, LAVA, { dur: 0.75 });
  gesture(scene, 'throw');
  const [hx, hy] = pt(scene, HAND);
  const molten = (ctx, x, y, s) => {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y, 0, x, y, s * 1.8);
    g.addColorStop(0, '#fff0a0'); g.addColorStop(0.4, LAVA); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(x - s * 2, y - s * 2, s * 4, s * 4);
    ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#5a1a0a';
    ctx.beginPath(); ctx.arc(x, y, s * 0.7, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ff8a3d'; ctx.fillRect(x - s * 0.4, y - s * 0.2, s * 0.5, 1.5);
    ctx.restore();
  };
  lob(scene, { delay: 0.75, dur: 0.6, x0: hx, y0: hy, x1: tx, y1: G - 30, arc: 60,
    draw: (ctx, x, y) => { molten(ctx, x, y, 8); if (Math.random() < 0.6) r.burst(x, y, '#ff8a3d', 1, 20); },
    onLand: () => {
      vfx(r, 'hit_fire', tx, G - 26, { size: 1.6 });
      r.burst(tx, G - 30, LAVA, 16, 80);
      // Trois gouttes qui retombent et laissent des flaques de lave (2 s).
      for (const dx of [-28, -4, 22]) {
        lob(scene, { dur: 0.4, x0: tx, y0: G - 30, x1: tx + dx, y1: G - 2, arc: 18, draw: (ctx, x, y) => molten(ctx, x, y, 3.5),
          onLand: () => { puddle(scene, tx + dx, LAVA, 2, 11); r.burst(tx + dx, G - 3, '#ffb04a', 5, 40); } });
      }
    } });
  strike(scene, ev, 1.37, { flash: LAVA });
}
function emberGeyser(scene, ev) {
  const r = scene.r, G = r.groundY;
  announce(scene, ev, LAVA, 0.7);
  gesture(scene, 'quake');
  const xs = [heroX() + 14, heroX() - 8, backX(scene) + 10];
  for (const x of xs) crack(scene, x - 12, x + 12, '#ff3a1a', { delay: 0.15, dur: 1.4 });
  xs.forEach((x, i) => {
    const t0 = 0.8 + i * 0.12;
    add(scene, { delay: t0, dur: 0.7, draw: (ctx, u) => {
      const h = 70 * Math.sin(Math.PI * Math.min(1, u * 1.3));
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createLinearGradient(0, G - h, 0, G);
      g.addColorStop(0, 'rgba(255,240,160,0.2)'); g.addColorStop(0.3, '#ffb04a'); g.addColorStop(1, LAVA);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(x - 7, G);
      ctx.quadraticCurveTo(x - 4 + Math.sin(r.time * 30) * 2, G - h * 0.6, x, G - h);
      ctx.quadraticCurveTo(x + 4 + Math.sin(r.time * 33) * 2, G - h * 0.6, x + 7, G);
      ctx.fill(); ctx.restore();
      if (Math.random() < 0.5) r.burst(x, G - h, '#ffb04a', 2, 50);
    } });
    r.later(t0, () => { vfx(r, 'hit_fire', x, G - 10, { size: 1.3 }); r.shake = Math.max(r.shake, 4); });
  });
  strike(scene, ev, 0.9, { flash: LAVA });
}
function emberAsh(scene, ev) {
  const r = scene.r, G = r.groundY;
  announce(scene, ev, '#c8a090', 0.65);
  gesture(scene, 'beam');
  const b = boxOf(scene);
  const x0 = b.x - b.w * 0.35, x1 = backX(scene) - 30;
  const puffs = Array.from({ length: 14 }, () => ({ dx: rnd(-14, 14), dy: rnd(-34, 0), s: rnd(7, 13), c: Math.random() < 0.5 ? '#7a6a62' : '#c8703a' }));
  // Nuage gris-orange qui roule vers l'équipe.
  add(scene, { delay: 0.65, dur: 1.2, draw: (ctx, u) => {
    const x = x0 + (x1 - x0) * u;
    ctx.save();
    for (const p of puffs) {
      ctx.globalAlpha = 0.55 * Math.min(1, u * 5, (1 - u) * 4);
      ctx.fillStyle = p.c;
      const rr = p.s * (0.8 + u * 0.6);
      ctx.beginPath(); ctx.arc(x + p.dx + Math.sin(r.time * 6 + p.dy) * 2, G - 10 + p.dy - u * 6, rr, 0, TAU); ctx.fill();
    }
    ctx.restore();
    if (Math.random() < 0.5) r.burst(x, G - 16, '#ff8a3d', 1, 30);
  } });
  strike(scene, ev, 0.65 + 1.2 * clamp01((x0 - heroX()) / (x0 - x1)), { shake: 5 });
}
function emberRain(scene, ev) {
  const r = scene.r;
  announce(scene, ev, '#ff8a3d', 0.8);
  gesture(scene, 'embers');
  ambient(scene, 'ash');
  for (let i = 0; i < 5; i++) r.later(0.8 + i * 0.1, () => vfx(r, 'hit_fire', heroX() - 30 + i * 18, r.groundY - 6, { size: 1 }));
  strike(scene, ev, 1.1, { flash: '#ff8a3d' });
}
function emberHeart(scene, ev) {
  const r = scene.r;
  announce(scene, ev, '#ff3a1a', 0.8);
  gesture(scene, 'transform', 'fury');
  ambient(scene, 'heart');
  // Le cœur grossit et pulse sur le torse, puis explose en onde de feu circulaire.
  add(scene, { dur: 1.2, draw: (ctx, u) => {
    const [cx, cy] = pt(scene, CHEST);
    const s = 4 + 10 * u * (1 + 0.2 * Math.sin(r.time * 20));
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, s * 2);
    g.addColorStop(0, '#fff0a0'); g.addColorStop(0.35, '#ff3a1a'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(cx - s * 2, cy - s * 2, s * 4, s * 4);
    ctx.restore();
  } });
  let c0 = null;
  r.later(1.2, () => { c0 = pt(scene, CHEST); vfx(r, 'boss_explode', c0[0], c0[1], { size: 1.4 }); r.shake = Math.max(r.shake, 9); });
  const reach = () => Math.hypot((c0?.[0] ?? 0) - heroX(), 1);
  add(scene, { delay: 1.2, dur: 0.8, draw: (ctx, u) => {
    if (!c0) return;
    const rad = 10 + u * Math.max(160, reach() + 60);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const [w, c, a] of [[10, LAVA, 0.4], [4, '#ffb04a', 0.8], [1.5, '#fff0a0', 1]]) {
      ctx.globalAlpha = a * (1 - u); ctx.strokeStyle = c; ctx.lineWidth = w;
      ctx.beginPath(); ctx.arc(c0[0], c0[1], rad, 0, TAU); ctx.stroke();
    }
    ctx.restore();
  } });
  strike(scene, ev, 1.55, { flash: LAVA, stop: 0.1, shake: 9 });
}

// ---------- MARÉES (mercredi) ----------
const WATER = '#2fd8ff';
function bubble(ctx, x, y, s, a = 1) {
  ctx.save();
  ctx.globalAlpha = 0.25 * a; ctx.fillStyle = '#8ff8ff';
  ctx.beginPath(); ctx.arc(x, y, s, 0, TAU); ctx.fill();
  ctx.globalAlpha = 0.9 * a; ctx.strokeStyle = '#d8fbff'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x - s * 0.5, y - s * 0.55, Math.max(1, s * 0.3), Math.max(1, s * 0.3));
  ctx.restore();
}
function splash(scene, x, y, n = 14) {
  const r = scene.r;
  r.burst(x, y, '#8ff8ff', n, 90);
  r.burst(x, y, '#ffffff', Math.round(n / 2), 60);
  for (let i = 0; i < 8; i++) {
    const b = { x: x + rnd(-14, 14), y: y + rnd(-6, 6), s: rnd(1.5, 3.5), v: rnd(15, 35) };
    add(scene, { dur: 1, draw: (ctx, u) => bubble(ctx, b.x + Math.sin(u * 9 + b.s) * 2, b.y - b.v * u, b.s, 1 - u) });
  }
}
function tideSphere(scene, ev) {
  const r = scene.r, G = r.groundY, tx = heroX() + 4;
  announce(scene, ev, WATER, 0.7);
  ring(scene, tx, WATER, { dur: 0.75 });
  gesture(scene, 'throw');
  const [hx, hy] = pt(scene, HAND);
  lob(scene, { delay: 0.75, dur: 0.7, x0: hx, y0: hy, x1: tx, y1: G - 20, arc: 50,
    draw: (ctx, x, y, u) => bubble(ctx, x, y, 12 + 2 * Math.sin(u * 20)),
    onLand: () => { splash(scene, tx, G - 20, 20); vfx(r, 'boss_tide', tx, G, { size: 1.2 }); } });
  strike(scene, ev, 1.45, { flash: '#8ff8ff' });
}
function tideSiphon(scene, ev) {
  const r = scene.r, G = r.groundY, x = heroX();
  announce(scene, ev, WATER, 0.6);
  ring(scene, x, WATER, { dur: 0.6, rad: 18 });
  gesture(scene, 'beam');
  // Tourbillon sous le héros (spirale d'ellipses qui tourne), le héros fait un tour sur lui-même.
  add(scene, { delay: 0.6, dur: 1.1, layer: 'back', draw: (ctx, u) => {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 4; k++) {
      ctx.globalAlpha = (0.7 - k * 0.12) * Math.min(1, (1 - u) * 4);
      ctx.strokeStyle = k % 2 ? WATER : '#d8fbff'; ctx.lineWidth = 1.5;
      const a0 = r.time * 9 + k * 1.6;
      ctx.beginPath(); ctx.ellipse(x, G - k * 5, 20 - k * 3, 5 - k, 0, a0, a0 + 4.2); ctx.stroke();
    }
    ctx.restore();
  } });
  r.later(0.6, () => { st(scene).spin = { t0: r.time, dur: 0.7 }; vfx(r, 'boss_tide', x, G, { size: 1.1 }); });
  strike(scene, ev, 1.1, { shake: 5 });
}
function tideJet(scene, ev) {
  const r = scene.r, G = r.groundY;
  announce(scene, ev, WATER, 0.65);
  gesture(scene, 'beam');
  const end = backX(scene) - 30;
  add(scene, { delay: 0.65, dur: 0.6, draw: (ctx, u) => {
    const [cx, cy] = pt(scene, CHEST);
    const y = G - 20;
    const head = cx + (end - cx) * Math.min(1, u * 3);
    const a = Math.min(1, (1 - u) * 5);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    for (const [w, c, al] of [[9, WATER, 0.35], [4, '#8ff8ff', 0.7], [1.5, '#ffffff', 1]]) {
      ctx.globalAlpha = al * a; ctx.strokeStyle = c; ctx.lineWidth = w + Math.sin(r.time * 50) * 0.8;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.quadraticCurveTo(cx - 20, y, head, y); ctx.stroke();
    }
    ctx.restore();
    if (Math.random() < 0.7) r.burst(head, y, '#d8fbff', 2, 50);
  } });
  // L'équipe est repoussée de 10 px, puis revient.
  r.later(0.75, () => { const s = st(scene); s.pushTo = -10; r.later(0.7, () => { s.pushTo = 0; }); splash(scene, heroX(), G - 20, 10); });
  strike(scene, ev, 0.75, { flash: '#8ff8ff' });
}
function tideWave(scene, ev) {
  const r = scene.r, G = r.groundY;
  announce(scene, ev, WATER, 0.8);
  gesture(scene, 'embers');
  ambient(scene, 'wet');
  // Vague géante qui traverse l'écran de droite à gauche.
  add(scene, { delay: 0.7, dur: 1.5, draw: (ctx, u) => screen(ctx, r, (w) => {
    const x = w + 60 - (w + 200) * u;
    const H = 95;
    ctx.globalAlpha = 0.8;
    const g = ctx.createLinearGradient(0, G - H, 0, G + 6);
    g.addColorStop(0, '#8ff8ff'); g.addColorStop(0.3, '#2fb0e0'); g.addColorStop(1, '#0a4a7a');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(x - 30, G + 6);
    ctx.quadraticCurveTo(x - 30, G - H, x + 10, G - H);
    ctx.quadraticCurveTo(x + 40, G - H + 10, x + 30, G - H + 24);
    ctx.lineTo(x + 140, G - 30); ctx.lineTo(x + 140, G + 6); ctx.fill();
    ctx.globalAlpha = 0.95; ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 9; i++) ctx.fillRect(x - 24 + i * 6 + Math.sin(r.time * 20 + i) * 2, G - H - 2 + Math.abs(i - 4) * 2, 4, 3);
  }) });
  r.later(1.4, () => splash(scene, heroX(), G - 24, 18));
  strike(scene, ev, 1.4, { flash: WATER, stop: 0.08 });
}
function tideAbyss(scene, ev) {
  const r = scene.r;
  announce(scene, ev, '#2fb0e0', 0.8);
  gesture(scene, 'transform', 'fury');
  ambient(scene, 'abyss');
  r.later(1.2, () => splash(scene, heroX(), r.groundY - 30, 16));
  strike(scene, ev, 1.2, { flash: '#2f8fd8', stop: 0.08 });
}

// ---------- RONCES (jeudi) ----------
const LEAF = '#4cd26a';
function bush(ctx, x, G, s, time) {
  ctx.save();
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI / 2 + (i - 4) * 0.33;
    const L = (16 + (i % 3) * 6) * s;
    ctx.strokeStyle = i % 2 ? '#2e7a3a' : '#5a3a1a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, G);
    const ex = x + Math.cos(a) * L + Math.sin(time * 3 + i) * 0.6, ey = G + Math.sin(a) * L;
    ctx.quadraticCurveTo(x + Math.cos(a) * L * 0.3, G + Math.sin(a) * L * 0.7, ex, ey); ctx.stroke();
    ctx.fillStyle = '#e8ffb0';
    for (let k = 1; k <= 2; k++) ctx.fillRect(x + (ex - x) * k / 2.5 - 1, G + (ey - G) * k / 2.5 - 1, 2, 2);
    ctx.fillStyle = LEAF; ctx.fillRect(ex - 1.5, ey - 1.5, 3, 3);
  }
  ctx.restore();
}
function thornSeed(scene, ev) {
  const r = scene.r, G = r.groundY, tx = heroX() + 24;
  announce(scene, ev, LEAF, 0.7);
  ring(scene, tx, LEAF, { dur: 0.75 });
  gesture(scene, 'throw');
  const [hx, hy] = pt(scene, HAND);
  lob(scene, { delay: 0.75, dur: 0.55, x0: hx, y0: hy, x1: tx, y1: G - 3, arc: 55,
    draw: (ctx, x, y, u) => { ctx.save(); ctx.translate(x, y); ctx.rotate(u * 9); ctx.fillStyle = '#6a4a22'; ctx.beginPath(); ctx.ellipse(0, 0, 4, 2.6, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#b8ff9a'; ctx.fillRect(-1, -1, 2, 2); ctx.restore(); },
    onLand: () => {
      r.burst(tx, G - 4, '#8a6a3a', 10, 50);
      vfx(r, 'sk_thorn_waltz', tx - 8, G, { size: 1.2 });
      add(scene, { dur: 2.6, draw: (ctx, u) => { ctx.globalAlpha = Math.min(1, (1 - u) * 5); bush(ctx, tx, G, Math.min(1, u * 8) * 1.3, r.time); ctx.globalAlpha = 1; } });
    } });
  strike(scene, ev, 1.4, { flash: LEAF });
}
function thornSpores(scene, ev) {
  const r = scene.r, G = r.groundY;
  announce(scene, ev, '#9aff5a', 0.65);
  gesture(scene, 'beam');
  const b = boxOf(scene), x0 = b.x - b.w * 0.3, x1 = backX(scene) - 10;
  const puffs = Array.from({ length: 16 }, () => ({ dx: rnd(-20, 20), dy: rnd(-40, -4), s: rnd(4, 9) }));
  add(scene, { delay: 0.65, dur: 1.4, draw: (ctx, u) => {
    const x = x0 + (x1 - x0) * Math.min(1, u * 1.3);
    ctx.save();
    for (const p of puffs) {
      ctx.globalAlpha = 0.4 * Math.min(1, u * 5, (1 - u) * 3);
      ctx.fillStyle = p.s > 6.5 ? '#6ad04a' : '#b8ff6a';
      ctx.beginPath(); ctx.arc(x + p.dx + Math.sin(r.time * 4 + p.s) * 3, G + p.dy, p.s * (0.7 + u * 0.6), 0, TAU); ctx.fill();
    }
    ctx.restore();
  } });
  // Poison : le coup, puis de petits chiffres verts.
  const hx = heroX();
  r.later(1.1, () => { r.hero.hurt = 0.3; r.teamHurt = r.time + 0.3; vfx(r, 'hit_poison', hx + 6, G - 20, { size: 1.3 }); r.hitstop = Math.max(r.hitstop ?? 0, 0.05); r.shake = Math.max(r.shake, 4); });
  for (let i = 0; i < 4; i++) r.later(1.1 + i * 0.3, () => r.addText(formatNumber(Math.max(1, Math.round(ev.damage / 4))), hx - 4 + (i % 2) * 8, G - 46 - i * 2, '#6aff4a', '#d8ffc0', false));
}
function thornGrasp(scene, ev) {
  const r = scene.r, G = r.groundY;
  announce(scene, ev, '#8a6a3a', 0.7);
  gesture(scene, 'quake');
  const xs = teamXs(scene);
  for (const x of xs) crack(scene, x - 10, x + 10, '#7bd04a', { delay: 0.1, dur: 0.8 });
  // Racines qui sortent du sol et enlacent héros et compagnons pendant 1 s.
  for (const x of xs) {
    add(scene, { delay: 0.7, dur: 1.2, draw: (ctx, u) => {
      const grow = Math.min(1, u * 4), a = Math.min(1, (1 - u) * 5);
      ctx.save(); ctx.globalAlpha = a; ctx.lineCap = 'round';
      for (const side of [-1, 1]) {
        ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(x + side * 10, G + 1);
        const n = 12;
        for (let i = 1; i <= Math.round(n * grow); i++) {
          const k = i / n;
          ctx.lineTo(x + side * Math.cos(k * Math.PI * 2.2) * 9, G - k * 28);
        }
        ctx.stroke();
        ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 1; ctx.stroke();
      }
      ctx.restore();
    } });
  }
  r.later(0.75, () => { r.teamBrace = r.time + 1; r.burst(heroX(), G - 4, '#6a4a22', 10, 40); });
  strike(scene, ev, 0.9, { shake: 5 });
}
function thornBramble(scene, ev) {
  const r = scene.r;
  announce(scene, ev, LEAF, 0.8);
  gesture(scene, 'transform', 'fury');
  ambient(scene, 'vines');
  r.later(0.6, () => { scene.titanGrowTo = 1.1; });
  r.later(1.1, () => { vfx(r, 'sk_thorn_waltz', heroX(), r.groundY, { size: 1.4 }); r.burst(heroX(), r.groundY - 16, LEAF, 14, 70); });
  strike(scene, ev, 1.15, { flash: LEAF });
}
function thornForest(scene, ev) {
  const r = scene.r, G = r.groundY;
  announce(scene, ev, LEAF, 0.8);
  gesture(scene, 'embers');
  ambient(scene, 'trees');
  // Haie de ronces qui traverse la scène de droite à gauche.
  add(scene, { delay: 0.9, dur: 1.4, draw: (ctx, u) => screen(ctx, r, (w) => {
    const x = w + 20 - (w + 120) * u;
    for (let i = 0; i < 7; i++) bush(ctx, x + i * 14, G, 1.2 + (i % 2) * 0.4, r.time);
  }) });
  r.later(1.4, () => vfx(r, 'sk_thorn_waltz', heroX(), G, { size: 1.3 }));
  strike(scene, ev, 1.4, { flash: LEAF, stop: 0.08 });
}

// ---------- ORAGE (vendredi) ----------
const VOLT = '#9fc3ff';
function stormJavelin(scene, ev) {
  const r = scene.r, G = r.groundY, tx = heroX() + 6;
  announce(scene, ev, VOLT, 0.65);
  ring(scene, tx, VOLT, { dur: 0.65 });
  gesture(scene, 'throw');
  const [hx, hy] = pt(scene, HAND);
  // Éclair lancé en ligne droite, très rapide (0,08 s), puis il reste une fraction de seconde.
  add(scene, { delay: 0.72, dur: 0.3, draw: (ctx, u) => {
    const k = Math.min(1, u * 4);
    ctx.globalAlpha = Math.min(1, (1 - u) * 3);
    bolt(ctx, hx, hy, hx + (tx - hx) * k, hy + (G - 14 - hy) * k, VOLT, 2, 4);
    ctx.globalAlpha = 1;
  } });
  r.later(0.8, () => {
    vfx(r, 'hit_thunder', tx, G - 14, { size: 1.5 });
    for (let i = 0; i < 4; i++) r.burst(tx + rnd(-12, 12), G - 1, '#ffffff', 3, 70);
  });
  strike(scene, ev, 0.8, { flash: VOLT });
}
function stormChain(scene, ev) {
  const r = scene.r, G = r.groundY;
  announce(scene, ev, VOLT, 0.7);
  gesture(scene, 'beam');
  const xs = teamXs(scene);
  // Du Titan au héros, puis du héros à chaque compagnon.
  const hops = xs.map((x, i) => [i === 0 ? null : xs[i - 1], x]);
  hops.forEach(([from, x], i) => {
    add(scene, { delay: 0.72 + i * 0.14, dur: 0.35, draw: (ctx, u) => {
      const [cx, cy] = from === null ? pt(scene, CHEST) : [from, G - 18];
      ctx.globalAlpha = Math.min(1, (1 - u) * 3);
      bolt(ctx, cx, cy, x, G - 18, VOLT, 1.6, 5);
      ctx.globalAlpha = 1;
    } });
    r.later(0.72 + i * 0.14, () => vfx(r, 'hit_thunder', x, G - 18, { size: 1.1 }));
  });
  strike(scene, ev, 0.72, { flash: VOLT });
}
function stormThunder(scene, ev) {
  const r = scene.r, G = r.groundY;
  announce(scene, ev, VOLT, 0.7);
  gesture(scene, 'embers');
  const xs = [heroX() + 26, heroX(), (heroX() + backX(scene)) / 2, backX(scene) + 4];
  xs.forEach((x, i) => {
    const t0 = 0.1 + i * 0.12;
    // Cercle électrique posé au sol 0,7 s avant l'éclair.
    add(scene, { delay: t0, dur: 0.7, layer: 'back', draw: (ctx, u) => {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.4 + 0.5 * u; ctx.strokeStyle = VOLT; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(x, G + 1, 12, 3.5, 0, 0, TAU); ctx.stroke();
      for (let k = 0; k < 3; k++) { const a = rnd(0, TAU); ctx.fillStyle = '#ffffff'; ctx.fillRect(x + Math.cos(a) * 12, G + 1 + Math.sin(a) * 3.5, 1.5, 1.5); }
      ctx.restore();
    } });
    add(scene, { delay: t0 + 0.7, dur: 0.25, draw: (ctx, u) => { ctx.globalAlpha = 1 - u; bolt(ctx, x + rnd(-6, 6), -10, x, G, VOLT, 2.2, 8); ctx.globalAlpha = 1; } });
    r.later(t0 + 0.7, () => { vfx(r, 'hit_thunder', x, G - 8, { size: 1.3 }); r.shake = Math.max(r.shake, 4); r.burst(x, G - 2, '#ffffff', 5, 60); });
  });
  strike(scene, ev, 0.1 + 0.12 + 0.7, { flash: VOLT });
}
function stormClouds(scene, ev) {
  const r = scene.r;
  announce(scene, ev, VOLT, 0.8);
  gesture(scene, 'embers');
  ambient(scene, 'storm');
  add(scene, { delay: 1, dur: 0.3, draw: (ctx, u) => { ctx.globalAlpha = 1 - u; bolt(ctx, heroX() + 4, -10, heroX(), r.groundY - 10, VOLT, 2.5, 9); ctx.globalAlpha = 1; } });
  r.later(1, () => vfx(r, 'hit_thunder', heroX(), r.groundY - 14, { size: 1.1, tint: VOLT, alpha: 0.75 })); // v10.19 (5.1)
  tintFlash(scene, heroX(), VOLT, 1);
  strike(scene, ev, 1, { flash: VOLT, stop: 0.08 });
}
function stormWrath(scene, ev) {
  const r = scene.r;
  announce(scene, ev, '#ffe24a', 0.8);
  gesture(scene, 'transform', 'fury');
  ambient(scene, 'arcs');
  ambient(scene, 'storm');
  r.later(1.2, () => { st(scene).flick = 0.35; });
  add(scene, { delay: 1.2, dur: 0.35, draw: (ctx, u) => {
    const [cx, cy] = pt(scene, CHEST);
    ctx.globalAlpha = 1 - u;
    bolt(ctx, cx, cy, heroX(), r.groundY - 18, '#ffe24a', 2.5, 7);
    ctx.globalAlpha = 1;
  } });
  r.later(1.2, () => vfx(r, 'hit_thunder', heroX(), r.groundY - 18, { size: 1.7 }));
  strike(scene, ev, 1.2, { flash: VOLT, stop: 0.1, shake: 9 });
}

// ---------- NÉANT (samedi) ----------
const VOID = '#b04dff';
function voidHole(ctx, x, y, s, time) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, s * 0.6, x, y, s * 2.2);
  g.addColorStop(0, '#e0a8ff'); g.addColorStop(0.3, VOID); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(x - s * 2.4, y - s * 2.4, s * 4.8, s * 4.8);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#050008';
  ctx.beginPath(); ctx.arc(x, y, s, 0, TAU); ctx.fill(); // disque plein
  ctx.strokeStyle = '#ffffff'; ctx.globalAlpha = 0.6 + 0.3 * Math.sin(time * 20); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(x, y, s + 0.5, 0, TAU); ctx.stroke();
  ctx.restore();
}
// Déchirure verticale (losange étiré, bords en zigzag) : jamais un arc.
function tear(ctx, x, yTop, yBot, wMax, open, time) {
  const n = 10;
  const side = (dir) => {
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      const w = Math.sin(Math.PI * k) * wMax * open + (i % 2 ? 1.5 : 0) * open;
      ctx.lineTo(x + dir * w + Math.sin(time * 15 + i) * 0.6, yTop + (yBot - yTop) * (dir > 0 ? k : 1 - k));
    }
  };
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = VOID; ctx.globalAlpha = 0.6;
  ctx.beginPath(); ctx.moveTo(x, yTop); side(1); side(-1); ctx.closePath(); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1; ctx.fillStyle = '#0a0014';
  ctx.beginPath(); ctx.moveTo(x, yTop); side(0.55); side(-0.55); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 0.5, yTop + (yBot - yTop) * 0.2, 1, (yBot - yTop) * 0.6 * open);
  ctx.restore();
}
function voidOrb(scene, ev) {
  const r = scene.r, G = r.groundY, tx = heroX() + 16;
  announce(scene, ev, VOID, 0.7);
  ring(scene, tx, VOID, { dur: 0.75 });
  gesture(scene, 'throw');
  const [hx, hy] = pt(scene, HAND);
  const y1 = G - 24;
  add(scene, { delay: 0.75, dur: 1.1, draw: (ctx, u) => {
    const fly = Math.min(1, u / 0.45);
    const x = hx + (tx - hx) * ease(fly), y = hy + (y1 - hy) * ease(fly);
    // Il avale la lumière : des traits convergent vers lui.
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = '#e0a8ff'; ctx.lineWidth = 1;
    for (let k = 0; k < 6; k++) {
      const a = k + r.time * 3, d = 26 - ((r.time * 60 + k * 7) % 22);
      ctx.globalAlpha = 0.6;
      ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * d, y + Math.sin(a) * d); ctx.lineTo(x + Math.cos(a) * (d - 5), y + Math.sin(a) * (d - 5)); ctx.stroke();
    }
    ctx.restore();
    const s = u < 0.8 ? 6 + 2 * Math.sin(r.time * 12) : 6 * (1 - (u - 0.8) / 0.2);
    voidHole(ctx, x, y, Math.max(0.5, s), r.time);
  }, end: () => {
    // Implosion : anneau qui se referme, puis éclat.
    add(scene, { dur: 0.35, draw: (ctx, u) => {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = '#e0a8ff'; ctx.lineWidth = 2; ctx.globalAlpha = 1 - u;
      ctx.beginPath(); ctx.arc(tx, y1, 30 * (1 - u), 0, TAU); ctx.stroke(); ctx.restore();
    } });
    vfx(r, 'hit_shadow', tx, y1, { size: 1.5 });
    r.burst(tx, y1, VOID, 16, 80);
  } });
  strike(scene, ev, 1.9, { flash: VOID, stop: 0.08 });
}
function voidStep(scene, ev) {
  const r = scene.r, G = r.groundY;
  announce(scene, ev, VOID, 0.55);
  const smoke = (x, y) => { for (let i = 0; i < 3; i++) r.burst(x + rnd(-14, 14), y + rnd(-30, 10), i ? '#6a3aa0' : '#e0a8ff', 10, 50); vfx(r, 'boss_appear', x, G, { size: 1.6, tint: VOID }); };
  // Il disparaît en fumée violette…
  r.later(0.4, () => { const b = boxOf(scene); smoke(b.x, b.y); scene.titanAlphaTo = 0; });
  // … réapparaît plus près et frappe aussitôt.
  r.later(0.75, () => { scene.titanDx = -42; scene.titanAlphaTo = 1; const b = boxOf(scene); smoke(b.x - 42, b.y); gesture(scene, 'attack'); });
  r.later(1.0, () => vfx(r, 'hit_shadow', heroX() + 6, G - 18, { size: 1.5 }));
  r.later(2.1, () => { scene.titanAlphaTo = 0; });
  r.later(2.35, () => { scene.titanDx = 0; scene.titanAlphaTo = 1; const b = boxOf(scene); smoke(b.x, b.y); });
  strike(scene, ev, 1.0, { flash: VOID, stop: 0.08 });
}
function voidRift(scene, ev) {
  const r = scene.r, G = r.groundY, x = backX(scene) - 6;
  announce(scene, ev, VOID, 0.7);
  gesture(scene, 'embers');
  crack(scene, x - 2, x + 2, VOID, { dur: 0.7 });
  // Déchirure verticale derrière l'équipe, qui aspire les particules ; le héros est tiré de 8 px.
  add(scene, { delay: 0.6, dur: 1.5, layer: 'back', draw: (ctx, u) => {
    const open = Math.min(1, u * 4, (1 - u) * 4);
    tear(ctx, x, G - 90, G, 10, open, r.time);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = '#e0a8ff';
    for (let k = 0; k < 10; k++) {
      const d = 60 - ((r.time * 90 + k * 13) % 60);
      ctx.globalAlpha = 0.8 * open;
      ctx.fillRect(x + d * (k % 2 ? 1 : 1.4), G - 10 - k * 8 + Math.sin(k) * 3, 2, 1);
    }
    ctx.restore();
  } });
  r.later(0.8, () => { const s = st(scene); s.pushTo = -8; r.later(0.9, () => { s.pushTo = 0; }); });
  strike(scene, ev, 0.9, { flash: VOID });
}
function voidCracks(scene, ev) {
  const r = scene.r;
  announce(scene, ev, VOID, 0.8);
  gesture(scene, 'quake');
  ambient(scene, 'cracks');
  r.later(0.9, () => { vfx(r, 'hit_shadow', heroX(), r.groundY - 16, { size: 1.1, tint: VOID, alpha: 0.75 }); tintFlash(scene, heroX(), VOID); crack(scene, heroX() - 30, heroX() + 30, VOID, { dur: 1.2 }); });
  strike(scene, ev, 0.9, { flash: VOID, stop: 0.08 });
}
function voidEclipse(scene, ev) {
  const r = scene.r, G = r.groundY;
  announce(scene, ev, VOID, 0.8);
  gesture(scene, 'transform', 'fury');
  ambient(scene, 'eclipse');
  // Déchirure verticale qui traverse la cible (pas d'arc).
  add(scene, { delay: 1.5, dur: 0.6, draw: (ctx, u) => tear(ctx, heroX() + 2, G - 70, G + 2, 8, Math.min(1, u * 6, (1 - u) * 3), r.time) });
  r.later(1.55, () => { vfx(r, 'hit_shadow', heroX(), G - 20, { size: 1.8 }); r.burst(heroX(), G - 30, '#e0a8ff', 20, 90); });
  strike(scene, ev, 1.55, { flash: '#000000', stop: 0.12, shake: 9 });
}

// Registre : id de compétence (data/grand-bosses.js) → rendu.
export const TITAN_SKILLS = {
  sun_lance: sunLance, sun_crown: sunCrown, sun_blind: sunBlind, sun_rise: sunRise, sun_noon: sunNoon,
  moon_disc: moonDisc, moon_gaze: moonGaze, moon_mirror: moonMirror, moon_tide: moonTide, moon_night: moonNight,
  ember_bomb: emberBomb, ember_geyser: emberGeyser, ember_ash: emberAsh, ember_rain: emberRain, ember_heart: emberHeart,
  tide_sphere: tideSphere, tide_siphon: tideSiphon, tide_jet: tideJet, tide_wave: tideWave, tide_abyss: tideAbyss,
  thorn_seed: thornSeed, thorn_spores: thornSpores, thorn_grasp: thornGrasp, thorn_bramble: thornBramble, thorn_forest: thornForest,
  storm_javelin: stormJavelin, storm_chain: stormChain, storm_thunder: stormThunder, storm_clouds: stormClouds, storm_wrath: stormWrath,
  void_orb: voidOrb, void_step: voidStep, void_rift: voidRift, void_cracks: voidCracks, void_eclipse: voidEclipse,
};

// ---------- dessin, appelé par WorldBossScene à chaque image ----------
// Calque arrière (après le décor, avant le Titan) : ambiance des phases et effets 'back'.
export function drawTitanBack(scene, ctx) {
  const s = scene.titanFx;
  const r = scene.r;
  const sil = SILHOUETTE[scene.fight.bossId];
  if (sil?.back) sil.back(scene, ctx);
  // v10.19 (5.3) : Titan de l'Orage : ciel gris-bleu foncé dès le début du combat (avant les nuages de l'attaque 4).
  if (scene.fight.bossId === 'titan_storm' && s?.amb.storm === undefined) {
    screen(ctx, r, (w) => { ctx.globalAlpha = 0.4; ctx.fillStyle = STORM_SKY; ctx.fillRect(0, 0, w, r.groundY - 10); });
  }
  if (!s) return;
  if (!r.focus) drawAmbientBack(scene, ctx, s);
  for (const f of s.list) if (f.layer === 'back' && f.t >= 0) f.draw(ctx, clamp01(f.t / f.dur), f);
}
// Juste après le Titan : silhouette (élément dessiné en code par-dessus la planche recolorée).
export function drawTitanFront(scene, ctx) {
  const sil = SILHOUETTE[scene.fight.bossId];
  if (sil?.front && scene.drawn) sil.front(scene, ctx);
}
// Calque des effets (devant tout le monde) : ambiance avant, effets 'over' ; avance le temps des effets.
export function drawTitanOver(scene, ctx, dt) {
  const s = scene.titanFx;
  if (!s) return;
  const r = scene.r;
  s.push += (s.pushTo - s.push) * Math.min(1, dt * 14);
  if (scene.titanAlphaTo !== undefined) scene.titanAlpha = (scene.titanAlpha ?? 1) + (scene.titanAlphaTo - (scene.titanAlpha ?? 1)) * Math.min(1, dt * 12);
  if (scene.titanGrowTo) scene.titanGrow = (scene.titanGrow ?? 1) + (scene.titanGrowTo - (scene.titanGrow ?? 1)) * Math.min(1, dt * 3);
  if (!r.focus) drawAmbientOver(scene, ctx, s, dt);
  const done = [];
  s.list = s.list.filter((f) => {
    f.t += dt;
    if (f.t >= f.dur) { if (f.end) done.push(f.end); return false; }
    if (f.layer === 'over' && f.t >= 0) f.draw(ctx, clamp01(f.t / f.dur), f);
    return true;
  });
  for (const fn of done) fn();
}
// Héros et compagnons : poussée (jet, faille) et tour sur lui-même (siphon), appliqués autour de leur dessin.
export function teamTransform(scene, ctx, isHero) {
  const s = scene.titanFx;
  if (!s || scene.r.focus) return false;
  const sp = s.spin && isHero ? s.spin : null;
  if (!s.push && !sp) return false;
  ctx.save();
  ctx.translate(Math.round(s.push), 0);
  if (sp) {
    const u = (scene.r.time - sp.t0) / sp.dur;
    if (u >= 1) s.spin = null;
    else {
      const hx = heroX();
      ctx.translate(hx, 0); ctx.scale(Math.cos(u * TAU) || 0.05, 1); ctx.translate(-hx, 0);
    }
  }
  return true;
}

function drawAmbientBack(scene, ctx, s) {
  const r = scene.r, A = s.amb, G = r.groundY, b = boxOf(scene);
  if (A.sun !== undefined) { // soleil qui se lève derrière lui, ciel d'or
    const u = clamp01(since(scene, 'sun') / 2.2);
    screen(ctx, r, (w, h) => { ctx.globalAlpha = 0.22 * u; ctx.fillStyle = '#ffb030'; ctx.fillRect(0, 0, w, h); });
    const sx = b.x + b.w * 0.15, sy = G - 30 - 110 * ease(u);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.translate(sx, sy); ctx.rotate(r.time * 0.3);
    ctx.globalAlpha = 0.35 * u; ctx.fillStyle = '#ffe070';
    for (let i = 0; i < 12; i++) { ctx.rotate(TAU / 12); ctx.fillRect(-2, 30, 4, 34); }
    ctx.restore();
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, 34);
    g.addColorStop(0, '#fffbe0'); g.addColorStop(0.55, '#ffd23f'); g.addColorStop(1, 'rgba(255,160,40,0)');
    ctx.globalAlpha = u; ctx.fillStyle = g; ctx.fillRect(sx - 36, sy - 36, 72, 72);
    ctx.restore();
  }
  if (A.night !== undefined) { // la nuit tombe, la lune (pleine) se lève
    const u = clamp01(since(scene, 'night') / 2);
    screen(ctx, r, (w, h) => { ctx.globalAlpha = NIGHT_AMBIENT_DARK * u; ctx.fillStyle = '#0a1030'; ctx.fillRect(0, 0, w, h); // v10.19 (5.2) : 0,5 même en nuit profonde
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 24; i++) { ctx.globalAlpha = u * (0.4 + 0.4 * Math.sin(r.time * 2 + i * 3)); ctx.fillRect((i * 97) % w, (i * 53) % Math.max(1, G - 60), 1, 1); } });
    const mx = b.x + b.w * 0.2, my = G - 40 - 100 * ease(u);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(mx, my, 0, mx, my, 40);
    g.addColorStop(0, 'rgba(230,240,255,0.5)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = u; ctx.fillStyle = g; ctx.fillRect(mx - 40, my - 40, 80, 80);
    ctx.restore();
    ctx.save(); ctx.globalAlpha = u; ctx.fillStyle = '#eef3ff';
    ctx.beginPath(); ctx.arc(mx, my, 16, 0, TAU); ctx.fill(); // disque plein : pas de croissant
    ctx.fillStyle = '#c9d4ee'; ctx.beginPath(); ctx.arc(mx - 5, my - 3, 3, 0, TAU); ctx.arc(mx + 4, my + 5, 2, 0, TAU); ctx.fill();
    ctx.restore();
  }
  if (A.ash !== undefined) screen(ctx, r, (w, h) => { ctx.globalAlpha = 0.16 * clamp01(since(scene, 'ash')); ctx.fillStyle = '#ff6a1a'; ctx.fillRect(0, 0, w, h); });
  if (A.heart !== undefined && A.ash === undefined) screen(ctx, r, (w, h) => { ctx.globalAlpha = 0.1; ctx.fillStyle = '#ff3a1a'; ctx.fillRect(0, 0, w, h); });
  if (A.wet !== undefined) screen(ctx, r, (w, h) => { ctx.globalAlpha = 0.12 * clamp01(since(scene, 'wet')); ctx.fillStyle = '#1a6aa0'; ctx.fillRect(0, 0, w, h); });
  if (A.trees !== undefined) { // arbres qui poussent dans le décor, derrière lui
    const u = ease(clamp01(since(scene, 'trees') / 2.5));
    const xs = [b.x - b.w * 0.6, b.x + b.w * 0.45, b.x - b.w * 0.05, b.x + b.w * 0.9, b.x - b.w * 1.1];
    xs.forEach((x, i) => {
      const h = (60 + (i % 3) * 22) * u;
      ctx.save();
      ctx.fillStyle = '#3a2a1a'; ctx.fillRect(x - 3, G - h, 6, h);
      ctx.fillStyle = i % 2 ? '#2e6a32' : '#3e8a3a';
      ctx.beginPath(); ctx.arc(x, G - h, 16 * u + 4, 0, TAU); ctx.arc(x - 10 * u, G - h + 8, 11 * u + 2, 0, TAU); ctx.arc(x + 11 * u, G - h + 6, 12 * u + 2, 0, TAU); ctx.fill();
      ctx.restore();
    });
    bush(ctx, b.x - b.w * 0.8, G, 1.1 * u, r.time);
  }
  if (A.storm !== undefined) { // nuages noirs sur le ciel
    const u = clamp01(since(scene, 'storm') / 1.5);
    screen(ctx, r, (w, h) => {
      // v10.19 (5.3) : ciel gris-bleu foncé (plus jamais presque blanc) : les éclairs blancs ressortent.
      ctx.globalAlpha = 0.5 * u; ctx.fillStyle = STORM_SKY; ctx.fillRect(0, 0, w, G - 10);
      ctx.globalAlpha = 0.25 * u; ctx.fillRect(0, G - 10, w, h);
      ctx.globalAlpha = 0.85 * u; ctx.fillStyle = '#252a36';
      for (let i = 0; i < 9; i++) { const x = ((i * 70 + r.time * 6) % (w + 80)) - 40; ctx.beginPath(); ctx.ellipse(x, 8 + (i % 3) * 8, 46, 18, 0, 0, TAU); ctx.fill(); }
      if (s.flick > 0) { ctx.globalAlpha = Math.min(STORM_FLICK_MAX, s.flick * 0.5); ctx.fillStyle = '#4a5a80'; ctx.fillRect(0, 0, w, G - 10); }
    });
  }
  if (A.arcs !== undefined) { // éclairs de fond qui illuminent la scène
    s.nextFlash = (s.nextFlash ?? 0) - (r.dt ?? 1 / 60);
    if (s.nextFlash <= 0) { s.nextFlash = rnd(1.2, 2.6); s.flick = 0.3; s.boltX = rnd(0.1, 0.9); }
    if (s.flick > 0.15) screen(ctx, r, (w) => { ctx.globalAlpha = s.flick * 2; bolt(ctx, w * s.boltX, -5, w * s.boltX + rnd(-30, 30), G - 70, VOLT, 1.5, 10); });
  }
  if (A.cracks !== undefined) { // fissures violettes qui restent ouvertes dans le décor
    const u = clamp01(since(scene, 'cracks') / 0.8);
    s.crackPts ??= [0.15, 0.4, 0.62, 0.85].map((fx, i) => ({ fx, y0: 20 + i * 12, len: 40 + (i % 2) * 25, seed: i * 1.7 }));
    screen(ctx, r, (w) => {
      for (const c of s.crackPts) {
        const x0 = w * c.fx;
        ctx.globalCompositeOperation = 'lighter';
        for (const [lw, col, al] of [[5, VOID, 0.35], [1.5, '#f0d0ff', 0.9]]) {
          ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.globalAlpha = al * u * (0.75 + 0.25 * Math.sin(r.time * 3 + c.seed));
          ctx.beginPath(); ctx.moveTo(x0, c.y0);
          for (let k = 1; k <= 6; k++) ctx.lineTo(x0 + Math.sin(k * 2.3 + c.seed) * 7, c.y0 + (c.len * u * k) / 6);
          ctx.stroke();
        }
      }
    });
  }
  if (A.eclipse !== undefined) { // soleil noir (disque plein, couronne violette)
    const u = ease(clamp01(since(scene, 'eclipse') / 1.5));
    screen(ctx, r, (w, h) => { ctx.globalAlpha = 0.45 * u; ctx.fillStyle = '#08000f'; ctx.fillRect(0, 0, w, h); });
    const ex = b.x - b.w * 0.1, ey = G - 30 - 110 * u;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(ex, ey, 14, ex, ey, 40);
    g.addColorStop(0, '#f0c0ff'); g.addColorStop(0.3, VOID); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = u; ctx.fillStyle = g; ctx.fillRect(ex - 42, ey - 42, 84, 84);
    ctx.restore();
    ctx.save(); ctx.globalAlpha = u; ctx.fillStyle = '#000000';
    ctx.beginPath(); ctx.arc(ex, ey, 15, 0, TAU); ctx.fill();
    ctx.restore();
  }
}

function drawAmbientOver(scene, ctx, s, dt) {
  const r = scene.r, A = s.amb, G = r.groundY;
  if (s.flick > 0) s.flick = Math.max(0, s.flick - dt * 1.5);
  if (A.noon !== undefined) { // air qui ondule au ras du sol, traînées dorées
    screen(ctx, r, (w) => {
      ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = '#ffd890'; ctx.lineWidth = 1;
      for (let k = 0; k < 4; k++) {
        ctx.globalAlpha = 0.12 + 0.05 * Math.sin(r.time * 3 + k);
        ctx.beginPath();
        for (let x = 0; x <= w; x += 4) ctx.lineTo(x, G - 6 - k * 9 + Math.sin(x * 0.07 + r.time * 5 + k) * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 0.45; ctx.fillStyle = '#ffb04a';
      for (let i = 0; i < 10; i++) ctx.fillRect(((i * 61 + r.time * 8) % w), G + 1 + (i % 3), 14, 1);
    });
  }
  if (A.ash !== undefined) { // cendres qui tombent jusqu'à la fin
    if (s.motes.length < 70) s.motes.push({ x: rnd(0, 1), y: -5, v: rnd(12, 26), s: Math.random() < 0.3 ? 2 : 1, c: Math.random() < 0.3 ? '#ff8a3d' : '#9a8a82' });
    screen(ctx, r, (w) => {
      for (const m of s.motes) {
        m.y += m.v * dt; if (m.y > G + 4) { m.y = -5; m.x = rnd(0, 1); }
        ctx.globalAlpha = 0.8; ctx.fillStyle = m.c;
        ctx.fillRect(m.x * w + Math.sin(m.y * 0.05) * 6, m.y, m.s, m.s);
      }
    });
  }
  if (A.storm !== undefined) { // pluie en diagonale
    screen(ctx, r, (w) => {
      ctx.strokeStyle = '#a8c0e8'; ctx.lineWidth = 1; ctx.globalAlpha = 0.45 * clamp01(since(scene, 'storm'));
      ctx.beginPath();
      for (let i = 0; i < 60; i++) {
        const x = ((i * 37 + r.time * 260) % (w + 60)) - 30, y = ((i * 71 + r.time * 420) % (G + 20)) - 10;
        ctx.moveTo(x, y); ctx.lineTo(x - 5, y + 10);
      }
      ctx.stroke();
    });
  }
  if (A.abyss !== undefined) { // l'eau monte à mi-écran 8 s (rendu sous-marin), puis reste aux chevilles
    const t = since(scene, 'abyss');
    const full = t < 1 ? ease(t) : t < 9 ? 1 : Math.max(0, 1 - (t - 9) / 1.5);
    screen(ctx, r, (w, h) => {
      const top = G - (G * 0.5) * full - 10 * (1 - full) + Math.sin(r.time * 2) * 1.5;
      const g = ctx.createLinearGradient(0, top, 0, h);
      g.addColorStop(0, 'rgba(60,180,230,0.4)'); g.addColorStop(1, 'rgba(10,50,110,0.5)');
      ctx.fillStyle = g; ctx.fillRect(0, top, w, h - top);
      ctx.globalAlpha = 0.7; ctx.fillStyle = '#bff4ff';
      for (let x = 0; x < w; x += 8) ctx.fillRect(x, top + Math.sin(x * 0.1 + r.time * 4) * 1.5, 5, 1);
      if (full > 0.5) { // bulles et rayons de lumière sous l'eau
        if (s.motes.length < 40) s.motes.push({ x: rnd(0, 1), y: G, v: rnd(10, 25), s: Math.random() < 0.3 ? 2.5 : 1.5, bubble: true });
        for (const m of s.motes) if (m.bubble) {
          m.y -= m.v * dt; if (m.y < top + 4) { m.y = G; m.x = rnd(0, 1); }
          bubble(ctx, m.x * w + Math.sin(m.y * 0.1) * 3, m.y, m.s, 0.8);
        }
        ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = '#8ff8ff';
        for (let i = 0; i < 4; i++) { ctx.globalAlpha = 0.06; ctx.beginPath(); const x = (i * 0.27 + 0.1) * w + Math.sin(r.time + i) * 10; ctx.moveTo(x, top); ctx.lineTo(x + 18, top); ctx.lineTo(x - 20, h); ctx.lineTo(x - 40, h); ctx.fill(); }
      }
    });
  }
}

// ---------- silhouette : un élément en code par-dessus la planche recolorée ----------
const SILHOUETTE = {
  titan_sun: { front: (scene, ctx) => { // couronne de rayons
    const [x, y] = pt(scene, HEAD), t = scene.r.focus ? 0 : scene.r.time;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(x, y - 4 * scene.drawn.k);
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI / 2 + (i - 3) * 0.32;
      const L = (9 + (i % 2) * 5 + Math.sin(t * 4 + i) * 1.5) * scene.drawn.k * 0.5;
      ctx.strokeStyle = i % 2 ? '#fff3a8' : GOLD; ctx.lineWidth = 2; ctx.globalAlpha = 0.85;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * 9, Math.sin(a) * 9); ctx.lineTo(Math.cos(a) * (9 + L), Math.sin(a) * (9 + L)); ctx.stroke();
    }
    ctx.restore();
  } },
  titan_moon: { back: (scene, ctx) => { // halo de lune derrière la tête
    if (!scene.drawn) return;
    const [x, y] = pt(scene, HEAD), k = scene.drawn.k;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y, 8 * k, x, y, 22 * k);
    g.addColorStop(0, 'rgba(220,230,255,0.5)'); g.addColorStop(0.6, 'rgba(160,180,255,0.18)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(x - 24 * k, y - 24 * k, 48 * k, 48 * k);
    ctx.strokeStyle = '#e8eeff'; ctx.globalAlpha = 0.5; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x, y, 17 * k, 0, TAU); ctx.stroke(); // anneau complet
    ctx.restore();
  } },
  titan_ember: { front: (scene, ctx) => { // cœur de lave
    const [x, y] = pt(scene, CHEST), k = scene.drawn.k;
    const big = scene.titanFx?.amb.heart !== undefined ? 1.8 : 1;
    const p = 0.75 + 0.25 * Math.sin((scene.r.focus ? 0 : scene.r.time) * 4);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y, 0, x, y, 7 * k * big);
    g.addColorStop(0, '#fff0a0'); g.addColorStop(0.35, '#ff5a1f'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = p; ctx.fillStyle = g; ctx.fillRect(x - 8 * k * big, y - 8 * k * big, 16 * k * big, 16 * k * big);
    ctx.restore();
  } },
  titan_tide: { front: (scene, ctx) => { // algues et coquillages
    const k = scene.drawn.k, t = scene.r.focus ? 0 : scene.r.time;
    ctx.save(); ctx.lineCap = 'round';
    for (const [px, py, len] of [[30, 46, 16], [64, 44, 14], [48, 80, 12]]) {
      const [x, y] = scene.at(px * scene.art.frame / 128, py * scene.art.frame / 128);
      ctx.strokeStyle = '#1f7a5a'; ctx.lineWidth = 1.5 * k / 1.2;
      ctx.beginPath(); ctx.moveTo(x, y);
      for (let i = 1; i <= 4; i++) ctx.lineTo(x + Math.sin(t * 2 + i + px) * 2 * k / 2, y + (len * k * i) / 8);
      ctx.stroke();
    }
    for (const [px, py] of [[36, 50], [60, 70]]) {
      const [x, y] = scene.at(px * scene.art.frame / 128, py * scene.art.frame / 128);
      ctx.fillStyle = '#ffe0d0'; ctx.beginPath(); ctx.arc(x, y, 2 * k / 1.2, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#d08a8a'; ctx.fillRect(x - 0.5, y - 2 * k / 1.2, 1, 2 * k / 1.2);
    }
    ctx.restore();
  } },
  titan_thorn: { front: (scene, ctx) => { // lianes (plus nombreuses après « Ronces »)
    const k = scene.drawn.k, more = scene.titanFx?.amb.vines !== undefined;
    const paths = more ? [[[30, 40], [50, 60], [40, 85], [58, 110]], [[70, 42], [56, 66], [72, 92]], [[20, 60], [36, 76], [28, 100]], [[44, 32], [62, 50]]] : [[[30, 40], [48, 62], [40, 84]]];
    ctx.save(); ctx.lineCap = 'round';
    for (const p of paths) {
      const pts = p.map(([px, py]) => scene.at(px * scene.art.frame / 128, py * scene.art.frame / 128));
      ctx.strokeStyle = '#2e6a2a'; ctx.lineWidth = 2 * k / 1.2;
      ctx.beginPath(); ctx.moveTo(...pts[0]); for (const q of pts.slice(1)) ctx.lineTo(...q); ctx.stroke();
      ctx.fillStyle = '#7be36a';
      for (const [x, y] of pts) { ctx.beginPath(); ctx.ellipse(x + 2, y, 2.2 * k / 1.2, 1.2 * k / 1.2, 0.6, 0, TAU); ctx.fill(); }
    }
    ctx.restore();
  } },
  titan_storm: { front: (scene, ctx) => { // nuage sur la tête (et arcs électriques après « Colère du ciel »)
    const [x, y] = pt(scene, HEAD), k = scene.drawn.k, t = scene.r.focus ? 0 : scene.r.time;
    ctx.save(); ctx.globalAlpha = 0.9; ctx.fillStyle = '#5a6478';
    const cy = y - 16 * k / 1.2;
    for (const [dx, rr] of [[-8, 6], [0, 8], [8, 6]]) { ctx.beginPath(); ctx.arc(x + dx * k / 1.2 + Math.sin(t) * 1, cy, rr * k / 1.2, 0, TAU); ctx.fill(); }
    ctx.restore();
    if (!scene.r.focus && Math.sin(t * 7) > 0.85) { ctx.globalAlpha = 0.9; bolt(ctx, x, cy + 6, x + 3, cy + 14, VOLT, 1, 2); ctx.globalAlpha = 1; }
    if (scene.titanFx?.amb.arcs !== undefined && !scene.r.focus) {
      const b = boxOf(scene);
      for (let i = 0; i < 2; i++) {
        const x0 = b.x + rnd(-b.w, b.w) * 0.35, y0 = b.top + rnd(0.15, 0.8) * b.h;
        ctx.globalAlpha = 0.85; bolt(ctx, x0, y0, x0 + rnd(-14, 14), y0 + rnd(-14, 14), '#ffe24a', 1, 3); ctx.globalAlpha = 1;
      }
    }
  } },
  titan_void: { front: (scene, ctx) => { // yeux multiples sur le corps
    const k = scene.drawn.k, t = scene.r.focus ? 0 : scene.r.time;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    [[46, 58], [58, 66], [40, 74], [54, 84], [64, 52]].forEach(([px, py], i) => {
      const [x, y] = scene.at(px * scene.art.frame / 128, py * scene.art.frame / 128);
      const open = Math.max(0.15, Math.min(1, Math.abs(Math.sin(t * 0.9 + i * 1.7)) * 1.6));
      ctx.fillStyle = '#e0a8ff'; ctx.globalAlpha = 0.9;
      ctx.beginPath(); ctx.ellipse(x, y, 2.2 * k / 1.2, 1.4 * k / 1.2 * open, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 0.5, y - 0.5, 1, 1);
    });
    ctx.restore();
  } },
};
export const TITAN_SILHOUETTES = Object.keys(SILHOUETTE);
