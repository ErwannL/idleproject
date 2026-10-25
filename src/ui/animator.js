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
  const img = spriteCanvas(frames[Math.floor(t * 3 + phase) % frames.length]);
  const scale = Number(canvas.dataset.scale) || 2;
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
        drawHero(ctx, canvas, state, t, activeHero(state).palette, preview ?? state.equipment, phase);
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
