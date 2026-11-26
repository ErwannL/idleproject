// v9.2.6 : lecteur des effets de combat dessinés par PixelLab (atlas généré : src/render/art-vfx.js, outil
// tools/art/pixellab_vfx.py). Un effet est une suite d'images jouée une fois (impact, mort…) ou en boucle (projectile,
// aura), centrée sur son point d'ancrage, ramenée à sa taille de jeu par `scale`.
// « Réduire les animations » (scene.focus) : versions sobres — une image sur deux, plus petite et plus pâle, les
// boucles figées sur leur première image, et les effets purement décoratifs (onde de critique, poussière de pas,
// éclairs d'apparition) supprimés.
// Sans image chargée (tests sous Node, tout premier instant), vfxReady() est faux : la scène garde ses effets d'avant.
import { VFX, VFX_ATLAS } from './art-vfx.js';
import { VFX2, VFX2_ATLAS } from './art-vfx2.js'; // v9.11 (1) : animations de compétences (second atlas, sa palette)
import { FONT_BIG } from './sprites.js';
import { drawBigText, textWidth } from './pixel.js';

export { VFX };

for (const [k, e] of Object.entries(VFX2)) VFX[k] = { ...e, at: 2 };
let atlas = null;
let atlas2 = null;
let loaded = false;
let loaded2 = false;
function load() {
  if (atlas || typeof Image === 'undefined') return;
  atlas = new Image();
  atlas.onload = () => { loaded = true; };
  atlas.src = VFX_ATLAS;
  atlas2 = new Image();
  atlas2.onload = () => { loaded2 = true; };
  atlas2.src = VFX2_ATLAS;
}
const sheetOf = (e) => (e.at === 2 ? atlas2 : atlas);
export const vfx2Ready = (name) => Boolean(VFX[name]?.at === 2 && loaded2);
load();

export function vfxReady() {
  return loaded;
}

// Effets décoratifs retirés en mode sobre.
const DECOR = new Set(['crit_wave', 'dust_step', 'loot_shine', 'death_soul']);
// Remplacements sobres.
const SOBER = { boss_explode: 'death_smoke', boss_appear: 'debuff_aura', crit_flash: 'hit_blunt' };

// Image teintée (butin de rareté, impacts recolorés) : copie de l'image, couleur posée par-dessus ses pixels.
const tintCache = new Map();
function tinted(name, i, color) {
  const key = `${name}:${i}:${color}`;
  let c = tintCache.get(key);
  if (c) return c;
  const e = VFX[name];
  c = document.createElement('canvas');
  c.width = e.w;
  c.height = e.h;
  const g = c.getContext('2d');
  g.drawImage(sheetOf(e), e.f[i][0], e.f[i][1], e.w, e.h, 0, 0, e.w, e.h);
  g.globalCompositeOperation = 'source-atop';
  g.globalAlpha = 0.6;
  g.fillStyle = color;
  g.fillRect(0, 0, e.w, e.h);
  if (tintCache.size > 300) tintCache.clear();
  tintCache.set(key, c);
  return c;
}

// Durée naturelle d'un effet (s).
export function vfxDuration(name) {
  const e = VFX[name];
  return e ? e.ms.reduce((a, b) => a + b, 0) / 1000 : 0;
}

// Ajoute un effet à la scène. Options : size (multiplie la taille), life (durée, sinon la naturelle), delay, tint,
// flip (miroir), alpha, follow (id d'ennemi suivi), loop (boucle jusqu'à la fin de `life`), back (sous les personnages :
// réservé aux auras, dessinées par drawVfxNow). Renvoie false si l'atlas n'est pas prêt ou l'effet retiré (sobre).
export function vfx(scene, name, x, y, opts = {}) {
  if (!loaded) return false;
  const sober = Boolean(scene.focus);
  if (sober && DECOR.has(name)) return true; // sobre : l'effet décoratif est simplement omis
  const n = sober ? SOBER[name] ?? name : name;
  const e = VFX[n];
  if (!e) return false;
  let life = opts.life ?? vfxDuration(n) * (sober ? 0.8 : 1);
  const delay = opts.delay ?? 0;
  // v9.11 (2) : contre un grand boss (le héros frappe plusieurs fois par seconde), les effets ne s'empilent plus :
  // arc de taille au plus toutes les 0,4 s (plus petit, en alternance haut/bas) ; colonnes de lumière une à la fois,
  // 0,6 s au plus ; un même effet au plus toutes les 0,25 s.
  if (scene.bigBoss) {
    const now = scene.time ?? 0, last = (scene.vfxLast ??= {});
    const slash = n === 'hit_slash' || n === 'crit_flash' || n === 'crit_wave' || n === 'v_crit_arc';
    const column = e.h > e.w * 1.4 && e.h * e.scale > 50;
    const gap = slash ? 0.4 : 0.25;
    const key = slash ? 'slash' : n; // tous les arcs de taille partagent la même limite
    // v10.16 : plus aucun arc de taille (croissant blanc) près du héros contre un grand boss.
    if (slash) { if (scene.feelStats) scene.feelStats.arcSkipped = (scene.feelStats.arcSkipped ?? 0) + 1; return true; }
    if (now - (last[key] ?? -9) < gap) return true;
    last[key] = now;
    if (slash) { scene.slashFlip = !scene.slashFlip; opts = { ...opts, size: (opts.size ?? 1) * 0.8, flip: scene.slashFlip }; }
    if (column) { scene.effects = scene.effects.filter((f) => !(f.kind === 'vfx' && f.column)); life = Math.min(life, 0.6); }
    opts = { ...opts, column };
  }
  scene.effects.push({
    kind: 'vfx', name: n, x, y, life: life + delay, max: life, delay, size: (opts.size ?? 1) * (sober ? 0.8 : 1),
    tint: opts.tint ?? null, flip: Boolean(opts.flip), alpha: (opts.alpha ?? 1) * (sober ? 0.7 : 1), loop: opts.loop ?? e.loop,
    follow: opts.follow, column: Boolean(opts.column), oy: opts.oy ?? 0, top: Boolean(opts.top), vx: opts.vx ?? 0, vy: opts.vy ?? 0, sober, rot: opts.rot ?? 0,
  });
  return true;
}

// Image courante d'un effet (k : avancement 0..1, ou temps écoulé pour une boucle).
function frameIndex(e, fx, age) {
  if (fx.sober && fx.loop) return 0;
  if (fx.loop) return Math.floor((age * 1000) / (e.ms[0] || 100)) % e.n;
  const i = Math.min(e.n - 1, Math.floor((age / fx.max) * e.n));
  return fx.sober ? Math.min(e.n - 1, i - (i % 2) + 1) : i; // sobre : une image sur deux
}

// Dessine une image d'effet centrée sur son ancrage en (x, y).
export function drawVfxFrame(ctx, name, i, x, y, { size = 1, tint = null, flip = false, alpha = 1, rot = 0, tip = false } = {}) {
  const e = VFX[name];
  if (!e || !loaded || (e.at === 2 && !loaded2)) return;
  i = ((Math.floor(i) % e.n) + e.n) % e.n || 0; // v10.4 : image toujours dans la planche (temps négatif ou NaN : image 0)
  const k = e.scale * size;
  // Projectile : ancré par sa pointe (bord droit), au milieu de sa hauteur.
  const ax = tip ? e.w - 1 : e.ax;
  const ay = tip ? e.h / 2 : e.ay;
  const w = e.w * k;
  const h = e.h * k;
  ctx.globalAlpha = alpha;
  const src = tint ? tinted(name, i, tint) : null;
  if (flip || rot) {
    ctx.save();
    ctx.translate(x, y);
    if (rot) ctx.rotate(rot);
    if (flip) ctx.scale(-1, 1);
    if (src) ctx.drawImage(src, -ax * k, -ay * k, w, h);
    else ctx.drawImage(sheetOf(e), e.f[i][0], e.f[i][1], e.w, e.h, -ax * k, -ay * k, w, h);
    ctx.restore();
  } else {
    const dx = Math.round((x - ax * k) * 4) / 4;
    const dy = Math.round((y - ay * k) * 4) / 4;
    if (src) ctx.drawImage(src, dx, dy, w, h);
    else ctx.drawImage(sheetOf(e), e.f[i][0], e.f[i][1], e.w, e.h, dx, dy, w, h);
  }
  ctx.globalAlpha = 1;
}

// Dessin d'un effet de la liste de la scène (appelé par la boucle d'effets de scene.js).
export function drawVfx(scene, ctx, fx, dt) {
  if (fx.life > fx.max) return; // pas encore commencé
  const e = VFX[fx.name];
  if (!e) return;
  const age = fx.max - fx.life;
  if (fx.follow != null) {
    const t = scene.enemyFx.get(fx.follow);
    if (t?.seen > scene.time - 0.1) { fx.x = t.sx + t.sw / 2; fx.y = (fx.top ? t.sy : t.sy + t.sh) + fx.oy; }
  }
  fx.x += fx.vx * dt;
  fx.y += fx.vy * dt;
  const i = frameIndex(e, fx, age);
  // Boucles : apparition et disparition en fondu ; effets joués une fois : leur dernière image s'efface déjà.
  const fade = fx.loop ? Math.min(1, age * 6, fx.life * 4) : 1;
  // v9.7.1 (lot 3 bis) : lisibilité — au-delà de 0,3 s, un grand effet devient translucide (il ne cache jamais un personnage).
  const clear = !fx.loop && age > 0.3 && Math.max(e.w, e.h) * (e.scale ?? 1) * (fx.size ?? 1) > 40 ? 0.45 : 1;
  drawVfxFrame(ctx, fx.name, i, fx.x, fx.y, { size: fx.size, tint: fx.tint, flip: fx.flip, alpha: fx.alpha * fade * clear, rot: fx.rot });
}

// Image courante d'un projectile en boucle (suivant le temps de la scène).
export function projFrame(name, time) {
  const e = VFX[name];
  return e ? Math.floor((time * 1000) / (e.ms[0] || 100)) % e.n : 0;
}

// Chiffres de dégâts (v9.2.6) : police pixel du jeu rendue une fois dans un petit canevas (le dessin pixel par pixel
// avec contour coûtait ~10 passes à chaque image), avec rebond, couleur par type et gros critique.
const textCache = new Map();
export function textCanvas(text, color, light) {
  const key = `${text}|${color}|${light}`;
  let c = textCache.get(key);
  if (c) return c;
  if (typeof document === 'undefined') return null;
  c = document.createElement('canvas');
  c.width = textWidth(text, FONT_BIG) + 4;
  c.height = 12;
  drawBigText(c.getContext('2d'), text, 2, 2, color, light);
  if (textCache.size > 120) textCache.delete(textCache.keys().next().value);
  textCache.set(key, c);
  return c;
}

// Couleurs des chiffres par type de coup.
export const DAMAGE_COLORS = {
  hit: ['#ffffff', '#ffffff'],
  crit: ['#ffd23f', '#fff6c8'],
  skill: ['#ff9a3a', '#ffe6c0'], // v9.3.9 : compétences en orange (blanc = coup, jaune = critique)
  companion: ['#9cf08a', '#e4ffd8'],
  hurt: ['#ff5a5a', '#ffb0a8'],
  heal: ['#5aff8a', '#d8ffe0'],
  fire: ['#ff9a3a', '#ffe0b0'],
  ice: ['#9fe0ff', '#ffffff'],
  thunder: ['#fff27a', '#ffffff'],
  poison: ['#9cff5a', '#e8ffd0'],
  holy: ['#ffe680', '#ffffff'],
  shadow: ['#c8a0ff', '#f0e4ff'],
};

// Dessin d'un chiffre : bond vers le haut, petite retombée, puis montée lente ; critique : jaillit en ×2 puis ×1,5 (écran de téléphone : un chiffre plus gros masquait le combat).
export function drawDamageText(scene, ctx, fx) {
  const age = fx.max - fx.life;
  const c = textCanvas(fx.text, fx.color, fx.light);
  if (!c) return false;
  let s = 1;
  let dy;
  if (fx.pop) {
    s = age < 0.08 ? 2.4 : age < 0.18 ? 1.8 : 1.4; // v9.3.9 : chiffres plus gros
    dy = -Math.min(1, age / 0.12) * 10 - age * 10;
  } else {
    // Rebond : monte de 9 px en 0,12 s, retombe de 3 px, puis dérive vers le haut.
    dy = age < 0.12 ? -9 * Math.sin((age / 0.12) * Math.PI / 2) : age < 0.24 ? -9 + 3 * Math.sin(((age - 0.12) / 0.12) * Math.PI / 2) : -6 - (age - 0.24) * 14;
    s = age < 0.06 ? 1.7 : 1.2; // v9.3.9 : plus gros, petit saut
  }
  if (!scene.focus) dy *= fx.rise ?? 1; // v10.16 (A5) : montée variable (éventail)
  if (scene.focus) { s = 1; dy = -age * 14; }
  s *= fx.scale ?? 1; // v10.16 : coup final, garde brisée : chiffre plus gros
  s *= 0.6; // v9.8 (E1) : chiffres 40 % plus petits (police énorme, empilements illisibles)
  const t = fx.life / fx.max;
  ctx.globalAlpha = Math.min(1, t * 2.5);
  const w = c.width * s;
  const h = c.height * s;
  const cx = fx.cx + (scene.focus ? 0 : (fx.drift ?? 0) * age); // v10.16 (A5) : dérive latérale
  ctx.drawImage(c, Math.round((cx - w / 2) * 2) / 2, Math.round((fx.y0 + dy - h / 2) * 2) / 2, w, h);
  ctx.globalAlpha = 1;
  return true;
}
