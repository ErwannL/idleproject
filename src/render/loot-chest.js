// v10.3.1 (plan 10.2, partie 7) : le coffre de butin est un objet de la scène, dessiné dans le canvas du SceneRenderer.
// Posé sur le sol, juste derrière les ennemis du moment (il glisse avec le sol quand l'équipe avance), agrandi par un
// multiple entier (≈ 96 px de haut sur PC, ≈ 64 px sur téléphone). Lueur à la couleur de la meilleure rareté, rayon de
// lumière dès un Épique, pastille du nombre d'objets, flèche verte ▲ s'il y a une amélioration, bulle « Butin ! »,
// débordement quand il est plein (pièces au sol). Chaque objet ramassé vole du monstre vaincu jusqu'au coffre ; à
// l'arrivée, le couvercle s'entrouvre et 3 pièces sautent.
// v10.4 (plan 10.4, partie 5) : le coffre est vivant en continu (flottaison ±4 px sur 1 s, lueur qui pulse sur 1,5 s,
// étincelles, rayon dès l'Épique) ; chaque objet décrit un arc en tournant (0,8 s), le couvercle s'ouvre sur l'or
// (6 images PixelLab, assets/ui/art104/loot_chest_lid_N.png : tools/art/pl104_chest.py), des pièces jaillissent, la pastille
// grossit puis revient, une bulle selon la rareté monte et s'efface ; un Légendaire ajoute flash doré, saut et cloche.
// « Réduire les animations » (r.focus) : ni flottaison ni étincelles ni flash ; l'arrivée de l'objet reste.
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
export const LID_FRAMES = 6;
export const LID_SRC = (i) => `assets/ui/art104/loot_chest_lid_${i}.png`;
// Images du couvercle : 64 × 64 pixels d'art, pieds sur la dernière ligne ; le corps du coffre (56 × 55) y occupe
// x 4..59, y 8..63 : le décalage horizontal recentre ce corps sur la zone de layout.
export const LID_NATIVE = 64, LID_BODY_TOP = 8, LID_OFFSET_X = -4;
export const FLY_TIME = 0.8; // vol de l'objet jusqu'au coffre (s)
export const OPEN_TIME = 0.8; // couvercle ouvert puis refermé (s)
export const FLOAT_AMP = 4, FLOAT_PERIOD = 1; // flottaison : ±4 px sur 1 s
export const GLOW_PERIOD = 1.5; // pulsation de la lueur (s)
export const SPARKS = 4; // étincelles qui montent (3 à 5)
export const POP_TIME = 0.35; // pastille qui grossit puis revient (s)
export const FLASH_TIME = 0.6; // flash doré d'un Légendaire (s)
export const BUBBLE_TIME = 2; // bulle de rareté (s)
export const MIN_EDGE = 40; // px CSS : distance minimale à chaque bord de la scène
export const MIN_HIT = 44; // px CSS : zone de toucher minimale

// Multiple entier (pixels d'écran par pixel d'art) pour une hauteur visée en px CSS.
export function chestMultiple(targetCss, dpr = 1) {
  const x = (targetCss / CHEST_NATIVE.h) * dpr; // à égalité (téléphone ×3 : 55 ou 73 px pour 64), le plus grand
  return Math.max(1, x - Math.floor(x) >= 0.49 ? Math.ceil(x) : Math.floor(x));
}
// Hauteur visée : ≈ 96 px sur PC, ≈ 64 px sur téléphone (scène portrait) ou dans une scène basse.
// v10.6 (partie 1) : 110 à 124 px sur PC, ≈ 72 px sur téléphone.
export function chestTarget(tall, cssH = 600) {
  return tall || cssH < 260 ? 72 : 112;
}
// v10.6 : place fixe en bas à droite (px CSS) : bord droit à DOCK_RIGHT px, pieds à DOCK_BOTTOM px du bas de la scène.
export const DOCK_RIGHT = 24, DOCK_BOTTOM = 14;
export function dockX(cssW, chestW) {
  return Math.max(MIN_EDGE, cssW - DOCK_RIGHT - chestW);
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
// Bulle : la première fois, puis selon la rareté de l'objet (Rare, Épique, Légendaire et au-delà).
export function bubbleFor(item, first) {
  if (first) return 'Butin ! Touche le coffre pour trier';
  const r = RANK.indexOf(item?.rarity);
  if (r >= RANK.indexOf('legendary')) return 'Butin légendaire !';
  if (r >= RANK.indexOf('epic')) return 'Butin épique !';
  if (r >= RANK.indexOf('rare')) return 'Butin rare !';
  return null;
}
// Mouvement du couvercle : numéro d'image (0 = fermé, LID_FRAMES - 1 = grand ouvert) à u secondes de l'arrivée de l'objet.
export function lidFrame(u) {
  if (u < 0 || u >= OPEN_TIME) return 0;
  const p = u < 0.22 ? u / 0.22 : u < 0.58 ? 1 : 1 - (u - 0.58) / (OPEN_TIME - 0.58);
  return Math.max(0, Math.min(LID_FRAMES - 1, Math.round(p * (LID_FRAMES - 1))));
}
// Flottaison (px CSS, entière) : ±4 px sur 1 s ; nulle en « Réduire les animations ».
export function floatOffset(t, calm) {
  return calm ? 0 : Math.round(Math.sin((t * Math.PI * 2) / FLOAT_PERIOD) * FLOAT_AMP);
}
// Lueur : intensité 0,3 à 1 sur 1,5 s ; fixe en « Réduire les animations ».
export function glowPulse(t, calm) {
  return calm ? 0.8 : 0.65 + 0.35 * Math.sin((t * Math.PI * 2) / GLOW_PERIOD);
}
export const rankOf = (item) => RANK.indexOf(item?.rarity);
export const isLegendary = (item) => rankOf(item) >= RANK.indexOf('legendary');

let images = null;
function chestImages() {
  if (images || typeof Image === 'undefined') return images;
  images = { lid: Array.from({ length: LID_FRAMES }, (_, i) => { const im = new Image(); im.src = LID_SRC(i); return im; }) };
  return images;
}
const lidLoaded = (imgs) => Boolean(imgs?.lid.every((i) => i.complete && i.naturalWidth));
function canvasOf(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, w); c.height = Math.max(1, h);
  return c;
}
// Les 6 images du couvercle agrandies ×m avec un liseré d'un pixel d'art à la couleur de la lueur, et le halo flou
// (calculé une fois, depuis le coffre fermé) : tout est préparé d'un coup, par couleur et par multiple (cache).
const spriteCache = new Map();
function chestSet(imgs, color, m) {
  const key = `${color}|${m}`;
  let c = spriteCache.get(key);
  if (c) return c;
  const full = LID_NATIVE * m, pad = m;
  const frames = imgs.lid.map((img, i) => {
    const base = canvasOf(full, full);
    const bx = base.getContext('2d');
    bx.imageSmoothingEnabled = false;
    if (img.complete && img.naturalWidth) bx.drawImage(img, 0, 0, LID_NATIVE, LID_NATIVE, 0, 0, full, full);
    const sil = canvasOf(full, full);
    const sx = sil.getContext('2d');
    sx.drawImage(base, 0, 0);
    sx.globalCompositeOperation = 'source-in';
    sx.fillStyle = color;
    sx.fillRect(0, 0, full, full);
    const sprite = canvasOf(full + pad * 2, full + pad * 2);
    sprite.dataset.lootChest = i === 0 ? 'closed' : 'open'; // repère des tests (tools/e2e-1031-chest.mjs)
    const cx = sprite.getContext('2d');
    cx.imageSmoothingEnabled = false;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) cx.drawImage(sil, pad + dx * pad, pad + dy * pad);
    cx.drawImage(base, pad, pad);
    return { sprite, sil };
  });
  const blur = Math.max(6, 5 * m);
  const glow = canvasOf(full + blur * 4, full + blur * 4);
  const gx = glow.getContext('2d');
  gx.filter = `blur(${blur}px)`;
  gx.drawImage(frames[0].sil, blur * 2, blur * 2);
  gx.drawImage(frames[0].sil, blur * 2, blur * 2);
  c = { frames: frames.map((f) => f.sprite), glow, glowPad: blur * 2, pad, full };
  if (lidLoaded(imgs)) { // mis en cache seulement quand toutes les images sont chargées
    if (spriteCache.size > 12) spriteCache.clear();
    spriteCache.set(key, c);
  }
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
    this.openStart = -9; // arrivée du dernier objet : le couvercle s'ouvre (OPEN_TIME)
    this.openUntil = 0;
    this.hopStart = -9;
    this.hopUntil = 0;
    this.hopRise = 2; // hauteur du saut en pixels d'art
    this.popStart = -9; // pastille du nombre : grossit puis revient (POP_TIME)
    this.flashStart = -9; // flash doré d'un Légendaire (FLASH_TIME)
    this.floatY = 0; // flottaison en cours (px CSS, entière)
    this.pillScale = 1;
    this.arrivals = 0;
    this.waiting = new Map(); // bulles attendues à l'arrivée de l'objet (id → { text, ms })
    this.onLegendary = null; // l'interface y branche le son de cloche
    this.bubble = null; // { text, start, until }
    this.flies = []; // objets en vol
    this.coins = []; // pièces qui jaillissent
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
  get lidIndex() { return lidFrame(this.t - this.openStart); }
  get sparkCount() { return 3 + (RANK.indexOf(this.best) >= 2 ? 1 : 0) + (this.epic ? 1 : 0); }

  say(text, ms = BUBBLE_TIME * 1000) { this.bubble = text ? { text, start: this.t, until: this.t + ms / 1000 } : null; }

  // Le scène lance le vol depuis le monstre vaincu (coordonnées du monde dessiné, avant le décalage de la scène).
  // (Le premier objet arrive avant que l'interface n'affiche le coffre : le vol attend l'image suivante.)
  catch(item, x, y) {
    this.flies.push({ item, lx: x, ly: y, age: 0, id: item?.id, angle: 0 });
    if (this.flies.length > 8) this.flies.shift();
    return true;
  }
  bubbleOnArrival(id, text, ms) { this.waiting.set(id, { text, ms }); }
  // L'interface annonce l'objet : s'il ne vole pas déjà (scène en vitesse ×100, appel direct), il part de fromCss.
  bump(item = null, fromCss = null) {
    if (item?.id && this.flies.some((f) => f.id === item.id)) return;
    if (!item) { this.arrive(); return; }
    this.flies.push({ item, cx: fromCss, age: 0, id: item.id, angle: 0 });
    if (this.flies.length > 8) this.flies.shift();
  }
  // L'objet entre dans le coffre : le couvercle s'ouvre sur l'or, 3 pièces jaillissent (5 dès un Rare), la pastille
  // grossit ; un Légendaire fait aussi un flash doré, un grand saut et sonner la cloche.
  arrive(item = null) {
    const legend = isLegendary(item);
    this.openStart = this.t; this.openUntil = this.t + OPEN_TIME;
    this.hopStart = this.t; this.hopUntil = this.t + (legend ? 0.5 : 0.18); this.hopRise = legend ? 7 : 2;
    this.popStart = this.t;
    this.arrivals += 1;
    const w = item?.id != null && this.waiting.get(item.id);
    if (w) { this.waiting.delete(item.id); this.say(w.text, w.ms); }
    if (this.waiting.size > 16) this.waiting.clear();
    const n = rankOf(item) >= 2 ? 5 : 3;
    for (let i = 0; i < n; i++) this.coins.push({ i, age: -i * 0.06, vx: (i - (n - 1) / 2) * (n > 3 ? 38 : 55) + (Math.random() - 0.5) * 10, vy: -190 - (i % 3) * 15 });
    if (this.coins.length > 12) this.coins.splice(0, this.coins.length - 12);
    if (legend) {
      this.flashStart = this.t;
      try { this.onLegendary?.(item); } catch { /* son indisponible */ }
    }
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
    // v10.6 : pieds du coffre au bas de la scène (bande sous le combat), et haut de cette bande (le rayon s'y arrête).
    const band = Math.round((r.groundY + 1) * r.k) + m;
    return { dpr, cssW, cssH, m, w, h, shiftDev, band, feet: Math.round((cssH - DOCK_BOTTOM) * dpr) };
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
  if (!imgs || !lidLoaded(imgs)) return;
  const L = chest.layout(r, ctx);
  chest.L = L;
  const cssWc = L.w / L.dpr;
  // v10.6 (partie 1) : le coffre quitte le terrain. Il se pose en bas à droite, sur la bande sous le combat (à côté de
  // « Tout récupérer ») : même place à chaque vague et dans toutes les tailles, sans jamais recouvrir un monstre.
  chest.x = dockX(L.cssW, cssWc);
  chest.lastScroll = scroll;
  // Saut à l'arrivée d'un objet (parabole) et flottaison continue au repos.
  const hp = (chest.t - chest.hopStart) / Math.max(0.01, chest.hopUntil - chest.hopStart);
  const hop = hp >= 0 && hp < 1 ? Math.round(Math.sin(hp * Math.PI) * chest.hopRise * L.m) : 0;
  chest.floatY = floatOffset(chest.t, r.focus);
  const x = Math.round(chest.x * L.dpr);
  const top = L.feet - L.h - hop + Math.round(chest.floatY * L.dpr);
  chest.dev = { x, y: top, w: L.w, h: L.h };
  // Zone de toucher (≥ 44 px CSS) dans le canvas, en px CSS : posée sur le coffre au repos (elle ne flotte pas).
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
  chest.front = chest.front ? cover > 0.1 : cover > 0.25; // (v10.6 : le coffre est hors du terrain, ce cas ne se produit plus)
  if (!chest.front) paintChest(r, ctx, chest);
}

// Faisceau de lumière (trapèze à dégradé) dessiné une fois dans un canvas, puis simplement recopié à chaque image.
const beamCache = new Map();
function beamSprite(fill, rw, rh) {
  const key = `${fill}|${Math.round(rw)}|${Math.round(rh)}`;
  let c = beamCache.get(key);
  if (c) return c;
  c = canvasOf(Math.ceil(rw), Math.ceil(rh));
  const g2 = c.getContext('2d');
  const g = g2.createLinearGradient(0, rh, 0, 0);
  g.addColorStop(0, fill); g.addColorStop(0.55, fill); g.addColorStop(1, 'rgba(0,0,0,0)');
  g2.fillStyle = g;
  g2.beginPath();
  g2.moveTo(rw * 0.2, rh); g2.lineTo(rw * 0.8, rh); g2.lineTo(rw, 0); g2.lineTo(0, 0);
  g2.closePath(); g2.fill();
  if (beamCache.size > 16) beamCache.clear();
  beamCache.set(key, c);
  return c;
}
// Largeur du texte de la pastille (mesurée une fois par police et texte).
const widthCache = new Map();
function textWidth(ctx, text) {
  const key = `${ctx.font}|${text}`;
  let w = widthCache.get(key);
  if (w == null) { w = ctx.measureText(text).width; if (widthCache.size > 64) widthCache.clear(); widthCache.set(key, w); }
  return w;
}

// Étincelles : petites croix en pixels d'art qui montent du coffre et s'éteignent (positions calculées depuis le temps,
// sans état : coût négligeable).
function paintSparks(ctx, chest, L, x, top, color) {
  const n = chest.sparkCount, s = Math.max(1, L.m);
  for (let i = 0; i < n; i++) {
    const period = 1.5 + i * 0.17, ph = (chest.t / period + i * 0.37) % 1;
    const sx = x + L.w * (0.12 + 0.76 * ((i * 0.6180339) % 1)) + Math.sin(chest.t * 2.1 + i) * s;
    const sy = top + L.h * 0.5 - ph * L.h * 0.9;
    ctx.globalAlpha = Math.sin(ph * Math.PI) * 0.95;
    const cx = Math.round(sx), cy = Math.round(sy);
    ctx.fillStyle = color;
    ctx.fillRect(cx - s, cy, s * 3, s); ctx.fillRect(cx, cy - s, s, s * 3);
    ctx.fillStyle = '#fff';
    ctx.fillRect(cx, cy, s, s);
  }
  ctx.globalAlpha = 1;
}

// Corps du coffre : ombre, rayon (dès un Épique), lueur de la meilleure rareté, couvercle (image du moment), étincelles,
// débordement.
function paintChest(r, ctx, chest) {
  const L = chest.L, { x, y: top } = chest.dev, imgs = chestImages();
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  const color = chest.glowColor, calm = r.focus;
  const pulse = glowPulse(chest.t, calm);
  // Ombre au sol (ne flotte pas).
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.ellipse(x + L.w / 2, L.feet - L.m, L.w * 0.55, L.m * 3, 0, 0, Math.PI * 2); ctx.fill();
  // Rayon de lumière dès un Épique.
  if (chest.epic) {
    const rh = Math.round(Math.max(0, Math.min(L.h * 2.4, top + L.h * 0.4 - L.band))), cx = x + L.w / 2, y0 = top + L.h * 0.4;
    const beam = (rw, fill, alpha, mode) => {
      ctx.globalCompositeOperation = mode;
      ctx.globalAlpha = alpha;
      ctx.drawImage(beamSprite(fill, rw, rh), Math.round(cx - rw / 2), Math.round(y0 - rh));
    };
    beam(L.w * 0.75, color, calm ? 0.45 : 0.3 + 0.2 * pulse, 'source-over');
    beam(L.w * 0.3, '#ffffff', calm ? 0.35 : 0.2 + 0.2 * pulse, 'lighter');
    ctx.globalCompositeOperation = 'source-over';
  }
  const spr = chestSet(imgs, color, L.m);
  const fx = x + LID_OFFSET_X * L.m, fy = top - LID_BODY_TOP * L.m; // coin haut gauche de l'image de 64 × 64 pixels d'art
  // Lueur de la meilleure rareté (plus vive pendant que le couvercle est ouvert).
  const lid = chest.lidIndex;
  ctx.globalAlpha = Math.min(1, (chest.epic ? 0.9 : 0.6) * pulse * (1 + lid * 0.08));
  ctx.drawImage(spr.glow, fx - spr.glowPad, fy - spr.glowPad);
  ctx.globalAlpha = 1;
  ctx.drawImage(spr.frames[lid], fx - spr.pad, fy - spr.pad);
  if (!calm) paintSparks(ctx, chest, L, x, top, color);
  // Plein : des pièces débordent au sol.
  if (chest.full) {
    const p = Math.max(1, L.m);
    for (const [cx, cy] of [[-0.28, 0], [-0.12, 1.5], [1.04, 0.5], [1.18, 1.8], [0.9, 2.2], [-0.02, 2.4]]) drawCoin(ctx, x + L.w * cx, L.feet - p * 4 + cy * p, p);
  }
  ctx.restore();
}

// Par-dessus les ennemis et les effets : flash, objets en vol, pièces, pastille, flèche ▲ et bulle.
export function drawLootChestTop(r, ctx) {
  const chest = r.lootChest;
  if (!chest?.shown || !chest.dev || !chest.L) return;
  if (chest.front) paintChest(r, ctx, chest);
  const L = chest.L, D = chest.dev, dt = r.dt ?? 0, calm = r.focus;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  const shiftDev = L.shiftDev;
  const tx = D.x + D.w / 2, ty = D.y + D.h * 0.35;
  // Objet Légendaire arrivé : flash doré sur la scène (pas en « Réduire les animations »).
  const fp = (chest.t - chest.flashStart) / FLASH_TIME;
  if (fp >= 0 && fp < 1 && !calm) {
    const cw = ctx.canvas.width, ch = ctx.canvas.height, a = 1 - fp;
    ctx.fillStyle = `rgba(255, 214, 90, ${(0.22 * a).toFixed(3)})`;
    ctx.fillRect(0, 0, cw, ch);
    const g = ctx.createRadialGradient(tx, ty, 0, tx, ty, Math.max(cw, ch) * 0.55);
    g.addColorStop(0, `rgba(255, 244, 190, ${(0.7 * a).toFixed(3)})`); g.addColorStop(1, 'rgba(255, 190, 40, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cw, ch);
  }
  // Objets en vol : arc du monstre vaincu jusqu'au coffre, en tournant, entourés de leur rareté.
  for (let i = chest.flies.length - 1; i >= 0; i--) {
    const f = chest.flies[i];
    f.age += dt;
    const k = Math.min(1, f.age / FLY_TIME);
    if (k >= 1) { chest.flies.splice(i, 1); chest.arrive(f.item); continue; }
    const x0 = f.lx != null ? f.lx * r.k + shiftDev : (f.cx ?? (L.cssW * 0.45)) * L.dpr;
    const y0 = f.ly != null ? f.ly * r.k : D.y - 30 * L.dpr;
    const e = k * k * (3 - 2 * k);
    const x = x0 + (tx - x0) * e;
    const y = y0 + (ty - y0) * e - Math.sin(k * Math.PI) * Math.max(40 * L.dpr, Math.abs(tx - x0) * 0.25);
    f.angle = calm ? 0 : e * Math.PI * 3; // une tour et demi
    f.x = x; f.y = y;
    let img = null;
    try { img = itemDropCanvas(f.item); } catch { img = null; }
    const s = Math.max(1, Math.round(r.k * (1.4 - 0.6 * k)));
    const color = GLOW[f.item?.rarity] ?? GLOW.common;
    const iw = (img?.width ?? 8) * s, ih = (img?.height ?? 8) * s, rad = Math.max(iw, ih) * 0.75;
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.lineWidth = Math.max(2, Math.round(L.dpr * 2)); ctx.strokeStyle = color;
    ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.stroke();
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate(f.angle);
    if (img) ctx.drawImage(img, Math.round(-iw / 2), Math.round(-ih / 2), iw, ih);
    else { ctx.fillStyle = color; ctx.fillRect(Math.round(-iw / 2), Math.round(-ih / 2), iw, ih); }
    ctx.restore();
  }
  // Pièces qui jaillissent du couvercle.
  const p = Math.max(1, L.m);
  for (let i = chest.coins.length - 1; i >= 0; i--) {
    const c = chest.coins[i];
    c.age += dt;
    if (c.age < 0) continue;
    if (c.age > 0.8) { chest.coins.splice(i, 1); continue; }
    const s = L.dpr * Math.max(1, L.m / L.dpr);
    const x = tx + c.vx * c.age * s, y = D.y + D.h * 0.25 + (c.vy * c.age + 420 * c.age * c.age) * s;
    ctx.globalAlpha = Math.min(1, (0.8 - c.age) * 4);
    drawCoin(ctx, x - p * 2, y - p * 2, p);
  }
  ctx.globalAlpha = 1;
  const u = L.dpr; // 1 px CSS
  // Pastille du nombre d'objets (en haut à droite) : grossit à chaque arrivée, puis revient.
  const label = chest.count > 99 ? '99+' : String(chest.count);
  ctx.font = uiFont(12 * u);
  const bh = 22 * u, bw = Math.max(bh, textWidth(ctx, label) + 10 * u);
  const bx = Math.round(D.x + D.w - bw * 0.7), by = Math.round(D.y - bh * 0.25);
  const pp = (chest.t - chest.popStart) / POP_TIME;
  chest.pillScale = pp >= 0 && pp < 1 ? 1 + 0.5 * Math.sin(pp * Math.PI) : 1;
  ctx.save();
  ctx.translate(bx + bw / 2, by + bh / 2); ctx.scale(chest.pillScale, chest.pillScale); ctx.translate(-(bx + bw / 2), -(by + bh / 2));
  ctx.fillStyle = '#000'; roundRect(ctx, bx, by + u, bw, bh, bh / 2); ctx.fill();
  ctx.fillStyle = '#e0303a'; roundRect(ctx, bx, by, bw, bh, bh / 2); ctx.fill();
  ctx.lineWidth = 2 * u; ctx.strokeStyle = '#fff'; roundRect(ctx, bx, by, bw, bh, bh / 2); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, bx + bw / 2, by + bh / 2 + u);
  ctx.restore();
  // Flèche verte ▲ : au moins une amélioration (en haut à gauche, sur fond sombre, elle sautille).
  if (chest.upgrade) {
    const a = 8 * u, ax = Math.round(D.x + 2 * u), ay = Math.round(D.y + 6 * u - (calm ? 0 : Math.abs(Math.sin(chest.t * 4)) * 3 * u));
    ctx.fillStyle = 'rgba(8, 24, 12, .85)';
    ctx.beginPath(); ctx.arc(ax, ay, a * 1.35, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 2 * u; ctx.strokeStyle = '#5ad07a'; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ax, ay - a * 0.8); ctx.lineTo(ax + a * 0.8, ay + a * 0.5); ctx.lineTo(ax - a * 0.8, ay + a * 0.5); ctx.closePath();
    ctx.fillStyle = '#7dff9a'; ctx.fill();
  }
  // Bulle de rareté (« Butin rare ! », « Butin épique ! », « Butin légendaire ! »…) : monte en s'effaçant.
  if (chest.bubble && chest.t < chest.bubble.until) {
    const text = tr(chest.bubble.text);
    const dur = Math.max(0.2, chest.bubble.until - chest.bubble.start), age = Math.max(0, chest.t - chest.bubble.start);
    const rise = Math.min(1, age / dur) * 16 * u, fade = Math.min(1, (chest.bubble.until - chest.t) / 0.5, age / 0.12 + 0.01);
    ctx.globalAlpha = Math.max(0, fade);
    ctx.font = uiFont(12 * u);
    const pw = ctx.measureText(text).width + 16 * u, ph = 22 * u;
    const cw = L.cssW * L.dpr;
    const qx = Math.round(Math.max(8 * u, Math.min(cw - pw - 8 * u, D.x + D.w / 2 - pw / 2)));
    const qy = Math.round(Math.max(4 * u, D.y - ph - 12 * u - rise));
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
