// v10.3.1 (plan 10.2, partie 7) : le coffre de butin est un objet de la scène, dessiné dans le canvas du SceneRenderer.
// Posé sur le sol, juste derrière les ennemis du moment (il glisse avec le sol quand l'équipe avance), agrandi par un
// multiple entier (≈ 96 px de haut sur PC, ≈ 64 px sur téléphone). Lueur à la couleur de la meilleure rareté, rayon de
// lumière dès un Épique, pastille du nombre d'objets, flèche verte ▲ s'il y a une amélioration, bulle « Butin ! »,
// débordement quand il est plein (pièces au sol). Chaque objet ramassé vole du monstre vaincu jusqu'au coffre ; à
// l'arrivée, le couvercle s'entrouvre et 3 pièces sautent.
// Le bouton réel (#loot-bag, ui/loot-bag.js) reste dans le DOM, invisible, posé exactement sur le coffre dessiné :
// clic, appui, clavier et lecteurs d'écran passent par lui.
import { t as tr } from '../i18n/i18n.js';
import { itemDropCanvas } from './pixel.js';

// Coffre dessiné de la 10.2 (bois sombre ferré d'or, pièces visibles) : plus « fantasy » et plus lisible que
// sprites/icon_chest.png (20 px, coffre plat) et que l'animation ui/vfx/chest.webp (même coffre plat, pas le même style).
// Les images font 128 px mais sont dessinées en pixels doubles : 64 px de pixel art, rognés à 56 × 55 px utiles.
export const CHEST_SRC = 'assets/ui/art102/loot_chest.png';
export const CHEST_OPEN_SRC = 'assets/ui/art102/loot_chest_open.png';
const CROP = { x: 8, y: 10, w: 112, h: 110 }; // zone utile dans l'image 128 px (pixels doubles)
export const CHEST_NATIVE = { w: CROP.w / 2, h: CROP.h / 2 }; // 56 × 55 pixels d'art
export const GLOW = { common: '#e8e0c8', uncommon: '#5ad07a', rare: '#4a9dff', epic: '#b05aff', legendary: '#ffb020', mythic: '#ff4d6d', ancestral: '#ff4d6d' };
export const RANK = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'ancestral'];
export const FLY_TIME = 0.7; // vol de l'objet jusqu'au coffre (s)
export const OPEN_TIME = 0.6; // couvercle entrouvert (s)
export const MIN_EDGE = 40; // px CSS : distance minimale à chaque bord de la scène
export const MIN_HIT = 44; // px CSS : zone de toucher minimale

// Multiple entier (pixels d'écran par pixel d'art) pour une hauteur visée en px CSS.
export function chestMultiple(targetCss, dpr = 1) {
  const x = (targetCss / CHEST_NATIVE.h) * dpr; // à égalité (téléphone ×3 : 55 ou 73 px pour 64), le plus grand
  return Math.max(1, x - Math.floor(x) >= 0.49 ? Math.ceil(x) : Math.floor(x));
}
// Hauteur visée : ≈ 96 px sur PC, ≈ 64 px sur téléphone (scène portrait) ou dans une scène basse.
export function chestTarget(tall, cssH = 600) {
  return tall || cssH < 260 ? 64 : 96;
}
// Position (px CSS, bord gauche du coffre) : juste derrière l'ennemi le plus en arrière, bornée à la partie droite
// de la scène et à au moins 40 px du bord droit.
export function chestBounds(cssW, chestW) {
  const max = cssW - Math.max(MIN_EDGE, Math.round(cssW * 0.09)) - chestW;
  const min = Math.min(max, Math.max(MIN_EDGE, Math.round(cssW * 0.6), max - Math.round(cssW * 0.25)));
  return { min, max };
}
export function chestTargetX(cssW, chestW, rearCss) {
  const { min, max } = chestBounds(cssW, chestW);
  if (rearCss == null || !Number.isFinite(rearCss)) return max;
  return Math.max(min, Math.min(max, rearCss + 8));
}
// Conditions d'affichage (celles du bouton de la 10.2) : coffre en service et non vide. L'Arène et sa Survie ont leur
// propre scène plein écran (la scène de campagne n'est plus dessinée : pas de coffre) ; la Veillée coupe aussi le rendu.
export function chestShown(state, { arenaOpen = false, sleeping = false } = {}) {
  if (!state || arenaOpen || sleeping) return false;
  return state.ui?.lootBag !== false && Array.isArray(state.lootBag) && state.lootBag.length > 0;
}
// Bulle : la première fois, puis à chaque objet Épique ou mieux.
export function bubbleFor(item, first) {
  if (first) return 'Butin ! Touche le coffre pour trier';
  return RANK.indexOf(item?.rarity) >= RANK.indexOf('epic') ? 'Butin !' : null;
}

let images = null;
function chestImages() {
  if (images || typeof Image === 'undefined') return images;
  images = { closed: new Image(), open: new Image() };
  images.closed.src = CHEST_SRC;
  images.open.src = CHEST_OPEN_SRC;
  return images;
}
function canvasOf(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, w); c.height = Math.max(1, h);
  return c;
}
// Coffre agrandi ×m, liseré d'un pixel d'art à la couleur de la lueur (cache par image, couleur et multiple).
const spriteCache = new Map();
function chestSprite(img, open, color, m) {
  const key = `${open}|${color}|${m}`;
  let c = spriteCache.get(key);
  if (c) return c;
  const w = CHEST_NATIVE.w * m, h = CHEST_NATIVE.h * m, pad = m;
  const base = canvasOf(w, h);
  const bx = base.getContext('2d');
  bx.imageSmoothingEnabled = false;
  bx.drawImage(img, CROP.x, CROP.y, CROP.w, CROP.h, 0, 0, w, h);
  const sil = canvasOf(w, h);
  const sx = sil.getContext('2d');
  sx.drawImage(base, 0, 0);
  sx.globalCompositeOperation = 'source-in';
  sx.fillStyle = color;
  sx.fillRect(0, 0, w, h);
  c = { sprite: canvasOf(w + pad * 2, h + pad * 2), glow: null, pad };
  c.sprite.dataset.lootChest = open ? 'open' : 'closed'; // repère des tests (tools/e2e-1031-chest.mjs)
  const cx = c.sprite.getContext('2d');
  cx.imageSmoothingEnabled = false;
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) cx.drawImage(sil, pad + dx * pad, pad + dy * pad);
  cx.drawImage(base, pad, pad);
  // Halo flou (calculé une fois) : dessiné derrière le coffre avec une intensité qui pulse.
  const blur = Math.max(6, 5 * m);
  c.glow = canvasOf(w + blur * 4, h + blur * 4);
  const gx = c.glow.getContext('2d');
  gx.filter = `blur(${blur}px)`;
  gx.drawImage(sil, blur * 2, blur * 2);
  gx.drawImage(sil, blur * 2, blur * 2);
  c.glowPad = blur * 2;
  if (spriteCache.size > 24) spriteCache.clear();
  spriteCache.set(key, c);
  return c;
}

// Pièce en pixel art (4 × 4 pixels d'art), dessinée à p pixels d'écran par pixel.
function drawCoin(ctx, x, y, p) {
  x = Math.round(x); y = Math.round(y);
  ctx.fillStyle = '#7a4a00';
  ctx.fillRect(x + p, y, p * 2, p * 4); ctx.fillRect(x, y + p, p * 4, p * 2);
  ctx.fillStyle = '#ffc52a';
  ctx.fillRect(x + p, y + p, p * 2, p * 2);
  ctx.fillStyle = '#fff6b0';
  ctx.fillRect(x + p, y + p, p, p);
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
let fontFamily = null;
function uiFont(px, weight = 800) {
  if (!fontFamily && typeof document !== 'undefined' && document.body) fontFamily = getComputedStyle(document.body).fontFamily || 'sans-serif';
  return `${weight} ${Math.round(px)}px ${fontFamily ?? 'sans-serif'}`;
}

export class LootChest {
  constructor() {
    this.shown = false;
    this.count = 0;
    this.best = null;
    this.upgrade = false;
    this.full = false;
    this.t = 0;
    this.openUntil = 0;
    this.hopUntil = 0;
    this.bubble = null; // { text, until }
    this.flies = []; // objets en vol
    this.coins = []; // pièces qui sautent
    this.x = null; // bord gauche (px CSS, dans le canvas)
    this.rect = null; // zone de toucher (px CSS, dans le canvas)
    this.drawnAt = 0;
    this.lastScroll = null;
  }

  // Contenu du coffre (résumé du sac) et affichage.
  set({ count = 0, best = null, upgrade = false, full = false, shown = true } = {}) {
    this.count = count; this.best = best; this.upgrade = upgrade; this.full = full;
    const was = this.shown;
    this.shown = Boolean(shown && count > 0);
    if (!this.shown) { this.rect = null; this.coins.length = 0; if (was) this.flies.length = 0; }
  }
  get epic() { return RANK.indexOf(this.best) >= RANK.indexOf('epic'); }
  get glowColor() { return GLOW[this.best] ?? GLOW.common; }

  say(text, ms = 2000) { this.bubble = text ? { text, until: this.t + ms / 1000 } : null; }

  // Le scène lance le vol depuis le monstre vaincu (coordonnées du monde dessiné, avant le décalage de la scène).
  // (Le premier objet arrive avant que l'interface n'affiche le coffre : le vol attend l'image suivante.)
  catch(item, x, y) {
    this.flies.push({ item, lx: x, ly: y, age: 0, id: item?.id });
    if (this.flies.length > 8) this.flies.shift();
    return true;
  }
  // L'interface annonce l'objet : s'il ne vole pas déjà (scène en vitesse ×100, appel direct), il part de fromCss.
  bump(item = null, fromCss = null) {
    if (item?.id && this.flies.some((f) => f.id === item.id)) return;
    if (!item) { this.arrive(); return; }
    this.flies.push({ item, cx: fromCss, age: 0, id: item.id });
    if (this.flies.length > 8) this.flies.shift();
  }
  // L'objet entre dans le coffre : couvercle entrouvert, petit saut, 3 pièces.
  arrive() {
    this.openUntil = this.t + OPEN_TIME;
    this.hopUntil = this.t + 0.18;
    for (let i = 0; i < 3; i++) this.coins.push({ i, age: -i * 0.06, vx: (i - 1) * 55 + (Math.random() - 0.5) * 10, vy: -190 - i * 15 });
    if (this.coins.length > 12) this.coins.splice(0, this.coins.length - 12);
  }
  hit(cssX, cssY) {
    const r = this.rect;
    return Boolean(r && cssX >= r.x && cssX <= r.x + r.w && cssY >= r.y && cssY <= r.y + r.h);
  }

  // Géométrie de l'image en cours (px d'écran du canvas et px CSS).
  layout(r, ctx) {
    const dpr = r.k / (r.scale || r.k) || 1;
    const cssW = (r.width * r.k) / dpr, cssH = (r.height * r.k) / dpr;
    const m = chestMultiple(chestTarget(r.tall, cssH), dpr);
    const w = CHEST_NATIVE.w * m, h = CHEST_NATIVE.h * m; // px d'écran
    const shiftDev = ctx.getTransform().e;
    return { dpr, cssW, cssH, m, w, h, shiftDev, feet: Math.round((r.groundY + 1) * r.k) + m };
  }
}

// Le coffre posé au sol : appelé par SceneRenderer.render juste avant les ennemis (ils passent devant).
export function drawLootChest(r, ctx, world) {
  const chest = r.lootChest;
  if (!chest) return;
  const dt = r.dt ?? 0;
  chest.t += dt;
  if (!chest.shown) { chest.lastScroll = null; return; }
  const imgs = chestImages();
  if (!imgs?.closed.complete || !imgs.closed.naturalWidth) return;
  const L = chest.layout(r, ctx);
  chest.L = L;
  const cssWc = L.w / L.dpr;
  // Ennemi le plus en arrière (bord droit, px CSS) : le coffre se pose juste derrière.
  let rear = null;
  for (const e of world?.enemies ?? []) {
    if (e.dead || e.hp <= 0) continue;
    const fx = r.enemyFx?.get(e.id); // image affichée à l'image précédente (bord droit réel du monstre)
    const right = fx?.sw && r.time - (fx.seen ?? -9) < 0.5 ? fx.sx + fx.sw : r.wx(e.x) + 12;
    const ex = (right * r.k + L.shiftDev) / L.dpr;
    if (ex < L.cssW && (rear == null || ex > rear)) rear = ex;
  }
  const target = chestTargetX(L.cssW, cssWc, rear);
  const { min, max } = chestBounds(L.cssW, cssWc);
  const scroll = r.smoothScroll ? r.smoothScroll(world) : 0;
  if (chest.x == null) chest.x = target;
  else if (world?.hero?.walking && chest.lastScroll != null && scroll > chest.lastScroll) {
    chest.x = Math.max(min, chest.x - ((scroll - chest.lastScroll) * r.k) / L.dpr); // il suit le sol qui défile
  } else chest.x += (target - chest.x) * Math.min(1, dt * 3);
  chest.x = Math.max(min, Math.min(max, chest.x));
  chest.lastScroll = scroll;
  const x = Math.round(chest.x * L.dpr), hop = chest.t < chest.hopUntil ? L.m * 2 : 0;
  const top = L.feet - L.h - hop;
  chest.dev = { x, y: top, w: L.w, h: L.h };
  // Zone de toucher (≥ 44 px CSS) dans le canvas, en px CSS.
  const hw = Math.max(MIN_HIT, L.w / L.dpr), hh = Math.max(MIN_HIT, L.h / L.dpr);
  chest.rect = { x: Math.round(x / L.dpr + (L.w / L.dpr - hw) / 2), y: Math.round((L.feet - L.h) / L.dpr + (L.h / L.dpr - hh)), w: Math.round(hw), h: Math.round(hh) };
  chest.drawnAt = typeof performance !== 'undefined' ? performance.now() : 0;

  // Un monstre posé sur le coffre le cacherait (téléphone : la file d'ennemis touche le bord) : le coffre passe alors
  // devant lui (dessiné avec les effets) pour rester lisible. Hystérésis : pas de clignotement pendant les coups.
  let cover = 0;
  for (const e of world?.enemies ?? []) {
    const fx = r.enemyFx?.get(e.id);
    if (e.dead || !fx?.sw || r.time - (fx.seen ?? -9) > 0.5) continue;
    const ex0 = fx.sx * r.k + L.shiftDev, ex1 = (fx.sx + fx.sw) * r.k + L.shiftDev;
    cover = Math.max(cover, (Math.min(ex1, x + L.w) - Math.max(ex0, x)) / L.w);
  }
  chest.front = chest.front ? cover > 0.1 : cover > 0.25;
  if (!chest.front) paintChest(r, ctx, chest);
}

// Corps du coffre : ombre, rayon (dès un Épique), lueur de la meilleure rareté, image (ouverte ou fermée), débordement.
function paintChest(r, ctx, chest) {
  const L = chest.L, { x, y: top } = chest.dev, imgs = chestImages();
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  const color = chest.glowColor, calm = r.focus;
  const pulse = calm ? 0.8 : 0.65 + 0.35 * Math.sin(chest.t * 3.2);
  // Ombre au sol.
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.ellipse(x + L.w / 2, L.feet - L.m, L.w * 0.55, L.m * 3, 0, 0, Math.PI * 2); ctx.fill();
  // Rayon de lumière dès un Épique.
  if (chest.epic) {
    const rh = Math.min(L.h * 2.4, top + L.h * 0.4), cx = x + L.w / 2, y0 = top + L.h * 0.4;
    const beam = (rw, fill, alpha, mode) => {
      const g = ctx.createLinearGradient(0, y0, 0, y0 - rh);
      g.addColorStop(0, fill); g.addColorStop(0.55, fill); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalCompositeOperation = mode;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(cx - rw * 0.3, y0); ctx.lineTo(cx + rw * 0.3, y0);
      ctx.lineTo(cx + rw * 0.5, y0 - rh); ctx.lineTo(cx - rw * 0.5, y0 - rh);
      ctx.closePath(); ctx.fill();
    };
    beam(L.w * 0.75, color, calm ? 0.45 : 0.3 + 0.2 * pulse, 'source-over');
    beam(L.w * 0.3, '#ffffff', calm ? 0.35 : 0.2 + 0.2 * pulse, 'lighter');
    ctx.globalCompositeOperation = 'source-over';
  }
  const open = chest.t < chest.openUntil && imgs.open.complete && imgs.open.naturalWidth;
  const spr = chestSprite(open ? imgs.open : imgs.closed, Boolean(open), color, L.m);
  // Lueur de la meilleure rareté.
  ctx.globalAlpha = (chest.epic ? 0.9 : 0.6) * pulse;
  ctx.drawImage(spr.glow, x - spr.glowPad, top - spr.glowPad);
  ctx.globalAlpha = 1;
  ctx.drawImage(spr.sprite, x - spr.pad, top - spr.pad);
  // Plein : des pièces débordent au sol.
  if (chest.full) {
    const p = Math.max(1, L.m);
    for (const [fx, fy] of [[-0.28, 0], [-0.12, 1.5], [1.04, 0.5], [1.18, 1.8], [0.9, 2.2], [-0.02, 2.4]]) drawCoin(ctx, x + L.w * fx, L.feet - p * 4 + fy * p, p);
  }
  ctx.restore();
}

// Par-dessus les ennemis et les effets : objets en vol, pièces qui sautent, pastille, flèche ▲ et bulle.
export function drawLootChestTop(r, ctx) {
  const chest = r.lootChest;
  if (!chest?.shown || !chest.dev || !chest.L) return;
  if (chest.front) paintChest(r, ctx, chest);
  const L = chest.L, D = chest.dev, dt = r.dt ?? 0;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  const shiftDev = L.shiftDev;
  // Objets en vol : arc du monstre vaincu jusqu'au coffre.
  const tx = D.x + D.w / 2, ty = D.y + D.h * 0.35;
  for (let i = chest.flies.length - 1; i >= 0; i--) {
    const f = chest.flies[i];
    f.age += dt;
    const k = r.focus ? 1 : Math.min(1, f.age / FLY_TIME);
    if (k >= 1) { chest.flies.splice(i, 1); chest.arrive(); continue; }
    const x0 = f.lx != null ? f.lx * r.k + shiftDev : (f.cx ?? (L.cssW * 0.45)) * L.dpr;
    const y0 = f.ly != null ? f.ly * r.k : D.y - 30 * L.dpr;
    const e = k * k * (3 - 2 * k);
    const x = x0 + (tx - x0) * e;
    const y = y0 + (ty - y0) * e - Math.sin(k * Math.PI) * Math.max(40 * L.dpr, Math.abs(tx - x0) * 0.25);
    let img = null;
    try { img = itemDropCanvas(f.item); } catch { img = null; }
    const s = Math.max(1, Math.round(r.k * (1.4 - 0.6 * k)));
    const color = GLOW[f.item?.rarity] ?? GLOW.common;
    const iw = (img?.width ?? 8) * s, ih = (img?.height ?? 8) * s;
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y, Math.max(iw, ih) * 0.75, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    if (img) ctx.drawImage(img, Math.round(x - iw / 2), Math.round(y - ih / 2), iw, ih);
    else { ctx.fillStyle = color; ctx.fillRect(Math.round(x - iw / 2), Math.round(y - ih / 2), iw, ih); }
  }
  // 3 pièces qui sautent du couvercle.
  const p = Math.max(1, L.m);
  for (let i = chest.coins.length - 1; i >= 0; i--) {
    const c = chest.coins[i];
    c.age += dt;
    if (c.age < 0) continue;
    if (c.age > 0.8 || r.focus) { chest.coins.splice(i, 1); continue; }
    const s = L.dpr * Math.max(1, L.m / L.dpr);
    const x = tx + c.vx * c.age * s, y = D.y + D.h * 0.25 + (c.vy * c.age + 420 * c.age * c.age) * s;
    ctx.globalAlpha = Math.min(1, (0.8 - c.age) * 4);
    drawCoin(ctx, x - p * 2, y - p * 2, p);
  }
  ctx.globalAlpha = 1;
  const u = L.dpr; // 1 px CSS
  // Pastille du nombre d'objets (en haut à droite).
  const label = chest.count > 99 ? '99+' : String(chest.count);
  ctx.font = uiFont(12 * u);
  const bh = 22 * u, bw = Math.max(bh, ctx.measureText(label).width + 10 * u);
  const bx = Math.round(D.x + D.w - bw * 0.7), by = Math.round(D.y - bh * 0.25);
  ctx.fillStyle = '#000'; roundRect(ctx, bx, by + u, bw, bh, bh / 2); ctx.fill();
  ctx.fillStyle = '#e0303a'; roundRect(ctx, bx, by, bw, bh, bh / 2); ctx.fill();
  ctx.lineWidth = 2 * u; ctx.strokeStyle = '#fff'; roundRect(ctx, bx, by, bw, bh, bh / 2); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, bx + bw / 2, by + bh / 2 + u);
  // Flèche verte ▲ : au moins une amélioration (en haut à gauche, sur fond sombre, elle sautille).
  if (chest.upgrade) {
    const a = 8 * u, ax = Math.round(D.x + 2 * u), ay = Math.round(D.y + 6 * u - (r.focus ? 0 : Math.abs(Math.sin(chest.t * 4)) * 3 * u));
    ctx.fillStyle = 'rgba(8, 24, 12, .85)';
    ctx.beginPath(); ctx.arc(ax, ay, a * 1.35, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 2 * u; ctx.strokeStyle = '#5ad07a'; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ax, ay - a * 0.8); ctx.lineTo(ax + a * 0.8, ay + a * 0.5); ctx.lineTo(ax - a * 0.8, ay + a * 0.5); ctx.closePath();
    ctx.fillStyle = '#7dff9a'; ctx.fill();
  }
  // Bulle « Butin ! » / « Coffre plein : trie-le ».
  if (chest.bubble && chest.t < chest.bubble.until) {
    const text = tr(chest.bubble.text);
    ctx.font = uiFont(12 * u);
    const pw = ctx.measureText(text).width + 16 * u, ph = 22 * u;
    const cw = L.cssW * L.dpr;
    const qx = Math.round(Math.max(8 * u, Math.min(cw - pw - 8 * u, D.x + D.w / 2 - pw / 2)));
    const qy = Math.round(Math.max(4 * u, D.y - ph - 12 * u));
    ctx.fillStyle = 'rgba(0,0,0,.45)'; roundRect(ctx, qx, qy + 2 * u, pw, ph, 8 * u); ctx.fill();
    ctx.fillStyle = '#fff5d6'; roundRect(ctx, qx, qy, pw, ph, 8 * u); ctx.fill();
    ctx.lineWidth = 2 * u; ctx.strokeStyle = '#c08a2a'; roundRect(ctx, qx, qy, pw, ph, 8 * u); ctx.stroke();
    const tipX = Math.max(qx + 10 * u, Math.min(qx + pw - 10 * u, D.x + D.w / 2));
    ctx.beginPath(); ctx.moveTo(tipX - 5 * u, qy + ph - u); ctx.lineTo(tipX + 5 * u, qy + ph - u); ctx.lineTo(tipX, qy + ph + 6 * u); ctx.closePath();
    ctx.fillStyle = '#fff5d6'; ctx.fill();
    ctx.fillStyle = '#3a2508'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, qx + pw / 2, qy + ph / 2 + u);
  } else if (chest.bubble) chest.bubble = null;
  ctx.restore();
}
