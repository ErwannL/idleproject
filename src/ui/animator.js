// Portraits animés des menus (chevalier, compagnons, boss) : petites boucles de mouvement,
// comme dans un salon de jeu. Chaque <canvas data-anim> d'un panneau est redessiné ~15 fois/s.
//   data-anim="hero"            le chevalier du joueur (équipement et couleurs du héros actif)
//   data-anim="hero:<id>"       un chevalier de la collection (ses couleurs, l'épée du joueur)
//   data-anim="pet:<sprite>"    un compagnon (petits bonds)
//   data-anim="foe:<sprite>"    un ennemi ou un boss (pas de marche, si l'image _b existe)
// data-scale : agrandissement entier ; data-fallen="1" : chevalier déchu (boss).
import { BOSSES } from '../data/enemies.js';
import { activeHero, heroById } from '../core/heroes.js';
import { HERO_ANCHOR, HERO_SIZE, heroComposite, spriteCanvas } from '../render/pixel.js';
import { SPRITES } from '../render/sprites.js';
import { pickHeroAnim } from '../render/ally-anim.js';
import { drawHeroPick } from '../render/hero-draw.js';
import { activeClass } from '../core/classes.js';

// v9.3.8 (2.4) : héros de l'écran Équipement dessiné comme en combat (images PixelLab, casque et armure portés),
// en marche sur place ; repli sur l'ancien dessin si l'apparence n'a pas d'images PixelLab.
let heroOff = null;
// v9.8 (B3) : cadre FIXE par combinaison classe + couleurs + équipement — l'union des cadres de toutes les images du
// cycle (0 à 4 s par pas de 0,05 s), en cache. Avant : cadre serré recalculé à chaque image, donc l'échelle (×3 ↔ ×2)
// et la position changeaient quand l'épée ou la cape dépassait : le héros grossissait, rapetissait et glissait.
const frameCache = new Map();
const pickAt = (state, palette, equipment, t) => pickHeroAnim({ palette, equipment, classId: activeClass(state).id, walking: true, walkRate: 0.6, gait: 'walk', time: t, attack: 0, shoot: 0, aim: 0, cast: 0, hurt: 0, victory: 0 }, {});
function drawPickBox(o, pick, equipment, palette) {
  o.clearRect(0, 0, 160, 120);
  drawHeroPick(o, pick, equipment, palette, 48, 30);
  const data = o.getImageData(0, 0, 160, 120).data;
  let x0 = 160, y0 = 120, x1 = -1, y1 = -1;
  for (let y = 0; y < 120; y++) for (let x = 0; x < 160; x++) if (data[(y * 160 + x) * 4 + 3] > 0) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return x1 < x0 ? null : [x0, y0, x1, y1];
}
function stableBox(o, state, palette, equipment) {
  const key = `${activeClass(state).id}|${JSON.stringify(palette)}|${Object.values(equipment ?? {}).map((i) => i?.baseId ?? '').join(',')}`;
  if (frameCache.has(key)) return frameCache.get(key);
  let box = null;
  for (let t = 0; t <= 4; t += 0.05) {
    const pick = pickAt(state, palette, equipment, t);
    if (!pick) return null;
    const b = drawPickBox(o, pick, equipment, palette);
    if (!b) return null; // image pas encore chargée : pas de cache (le cadre serait trop petit)
    box = box ? [Math.min(box[0], b[0]), Math.min(box[1], b[1]), Math.max(box[2], b[2]), Math.max(box[3], b[3])] : b;
  }
  if (frameCache.size > 20) frameCache.clear();
  frameCache.set(key, box);
  return box;
}
function drawHeroLikeScene(ctx, canvas, state, t, palette, equipment) {
  const pick = pickAt(state, palette, equipment, t);
  if (!pick) return false;
  heroOff ??= typeof document !== 'undefined' ? document.createElement('canvas') : null;
  if (!heroOff) return false;
  if (heroOff.width !== 160) { heroOff.width = 160; heroOff.height = 120; }
  const o = heroOff.getContext('2d', { willReadFrequently: true });
  o.imageSmoothingEnabled = false;
  const box = stableBox(o, state, palette, equipment) ?? drawPickBox(o, pick, equipment, palette);
  if (!box) return false;
  o.clearRect(0, 0, 160, 120);
  drawHeroPick(o, pick, equipment, palette, 48, 30);
  const [x0, y0, x1, y1] = box;
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const k = Math.max(1, Math.floor(Math.min(canvas.width / w, (canvas.height - 4) / h)));
  // Pieds toujours au même endroit : le bas du cadre fixe posé en bas du canvas.
  ctx.drawImage(heroOff, x0, y0, w, h, Math.round((canvas.width - w * k) / 2), canvas.height - h * k - 2, w * k, h * k);
  return true;
}

const FPS = 15;
let last = 0;

// Image du chevalier à l'instant t : respiration, cape au vent, et toutes les 6 s un moulinet d'épée.
function heroFrame(t, phase) {
  const cycle = (t + phase) % 6;
  if (cycle > 5.4) return cycle < 5.55 ? 'attack1' : cycle < 5.7 ? 'attack2' : 'attack3';
  if (cycle > 5.0) return 'victory';
  return Math.floor(t * 2 + phase) % 2 ? 'idle2' : 'idle';
}

function drawHero(ctx, canvas, state, t, palette, equipment, phase) {
  const frame = heroFrame(t, phase);
  const cape = ['a', 'b', 'c'][Math.floor(t * 4 + phase) % 3];
  const img = heroComposite(frame, equipment, false, cape, palette);
  const scale = Number(canvas.dataset.scale) || 2;
  // Cadre fixe autour des pieds : le chevalier ne « saute » pas quand l'image change.
  const x = Math.round(canvas.width / 2 - HERO_ANCHOR.x * scale);
  const y = canvas.height - (HERO_ANCHOR.y + 2) * scale;
  ctx.drawImage(img, 0, 0, HERO_SIZE.w, HERO_SIZE.h, x, y, HERO_SIZE.w * scale, HERO_SIZE.h * scale);
}

function drawSprite(ctx, canvas, name, t, phase, hop) {
  const frames = SPRITES[`${name}_b`] ? [name, `${name}_b`] : [name];
  const frame = frames[Math.floor(t * 3 + phase) % frames.length];
  const img = spriteCanvas(frame);
  // v9.0.7 : sprite en pleine définition → facteur d'échelle propre (le canvas a plus de pixels, rien n'est perdu).
  let scale = (Number(canvas.dataset.scale) || 2) * (SPRITES[frame]?.scale ?? 1);
  // v9.1.3 : les grands boss redessinés (jusqu'à 96 px) sont réduits pour tenir dans le cadre (pas de tête coupée).
  const room = canvas.height - 3 * (Number(canvas.dataset.scale) || 2);
  if (img.height * scale > room) scale = room / img.height;
  if (img.width * scale > canvas.width) scale = canvas.width / img.width;
  const bob = hop ? Math.round(Math.abs(Math.sin(t * 3 + phase)) * 2) : Math.round((Math.sin(t * 2 + phase) + 1) * 0.5);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, Math.round((canvas.width - w) / 2), canvas.height - h - (bob + 1) * scale, w, h);
}

export function animateMenus(root, state, ms) {
  if (ms - last < 1000 / FPS) return;
  last = ms;
  const t = ms / 1000;
  root.querySelectorAll('canvas[data-anim]').forEach((canvas, i) => {
    if (!canvas.isConnected || canvas.offsetParent === null) return;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const [kind, id] = canvas.dataset.anim.split(':');
    const phase = i * 0.37;
    if (kind === 'hero') {
      if (canvas.dataset.fallen) {
        drawHero(ctx, canvas, state, t, BOSSES.fallen_knight.palette, { weapon: { baseId: 'fallen_blade', rarity: 'epic' } }, phase);
      } else if (id) {
        drawHero(ctx, canvas, state, t, heroById(id).palette, { weapon: state.equipment.weapon }, phase);
      } else {
        const preview = canvas.dataset.preview ? JSON.parse(canvas.dataset.preview) : null;
        if (!(canvas.dataset.big && drawHeroLikeScene(ctx, canvas, state, t, activeHero(state).palette, preview ?? state.equipment))) {
          drawHero(ctx, canvas, state, t, activeHero(state).palette, preview ?? state.equipment, phase);
        }
      }
    } else {
      drawSprite(ctx, canvas, id, t, phase, kind === 'pet');
    }
  });
}

// Balise d'un portrait animé (taille du canvas en pixels de jeu × scale).
export function animCanvas(anim, w, h, scale, extra = '') {
  return `<canvas class="px anim" data-anim="${anim}" data-scale="${scale}" width="${w * scale}" height="${h * scale}" ${extra}></canvas>`;
}
