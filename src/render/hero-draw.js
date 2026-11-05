// v9.2.5 : dessin d'une image d'animation PixelLab du héros avec son arme VRAIMENT tenue, partagé par le jeu
// (scene.js drawHero), la bande-annonce (tools/trailer.html) et les tests (tests/v925-heros.test.js).
// Ordre de dessin, comme une vraie prise :
//   1. arme derrière le corps si la main qui la tient est la main arrière (pose « back ») ;
//   2. corps (le chevalier porte son vrai casque et sa vraie armure : pixel.js knightGearCanvas) ;
//   3. arme devant ;
//   4. poing redessiné PAR-DESSUS la poignée : les pixels du corps autour de la prise (disque de HAND_R px) sont
//      reposés après l'arme, la poignée passe donc dans la main au lieu d'être collée sur elle.
import { heroAnimCanvas, heroHeldWeapon, knightGearCanvas } from './pixel.js';
import { ALLY_ANIMS, KNIGHT_NECK, KNIGHT_PIVOT, heroWearsGear } from './ally-anim.js';

export const HAND_R = 2.3;
const handCache = new Map();

function bodyOf(pick, equipment, palette) {
  if (heroWearsGear(palette, equipment) && pick.head) {
    const g = knightGearCanvas(pick.name, pick.anim, pick.head, KNIGHT_PIVOT, KNIGHT_NECK, equipment, palette);
    return { canvas: g.canvas, m: g.m, key: `g|${pick.name}|${equipment.helmet?.baseId}/${equipment.helmet?.rarity}|${equipment.armor?.baseId}/${equipment.armor?.rarity}|${JSON.stringify(palette)}|${pick.head}` };
  }
  return { canvas: heroAnimCanvas(pick.name, palette), m: 0, key: `p|${pick.name}|${JSON.stringify(palette)}` };
}

// Calque de la main d'avant : pixels opaques du corps à HAND_R px au plus de la prise (gx, gy, repère du calque).
export function handLayer(body, key, gx, gy) {
  const k = `${key}|${gx},${gy}`;
  let out = handCache.get(k);
  if (out !== undefined) return out;
  out = null;
  const r = Math.ceil(HAND_R), w = body.width, h = body.height;
  let data = null;
  try { data = body.getContext('2d').getImageData(0, 0, w, h).data; } catch { data = null; }
  if (data) {
    const c = document.createElement('canvas');
    c.width = 2 * r + 1; c.height = 2 * r + 1;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(c.width, c.height);
    let n = 0;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.hypot(dx, dy) > HAND_R) continue;
      const x = gx + dx, y = gy + dy;
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const o = (y * w + x) * 4;
      if (!data[o + 3]) continue;
      const p = ((dy + r) * c.width + dx + r) * 4;
      for (let j = 0; j < 4; j++) img.data[p + j] = data[o + j];
      n++;
    }
    if (n) { ctx.putImageData(img, 0, 0); out = { canvas: c, r }; }
  }
  if (handCache.size > 4000) handCache.clear();
  handCache.set(k, out);
  return out;
}

// v9.2.5 : prise ramenée dans la main : sans pixel du corps à 2 px de la prise (arc de la pose de repos tenu à
// côté du corps, image de marche interpolée), la prise glisse sur le pixel du corps le plus proche (8 px au plus).
const snapCache = new Map();
export function snapGrip(body, key, gx, gy) {
  const k = `${key}|${gx},${gy}`;
  let out = snapCache.get(k);
  if (out) return out;
  out = [gx, gy];
  let data = null;
  try { data = body.getContext('2d').getImageData(0, 0, body.width, body.height).data; } catch { data = null; }
  const op = (x, y) => x >= 0 && y >= 0 && x < body.width && y < body.height && data[(y * body.width + x) * 4 + 3] > 100;
  if (data) {
    let near = false;
    for (let dy = -2; dy <= 2 && !near; dy++) for (let dx = -2; dx <= 2; dx++) if (op(gx + dx, gy + dy)) { near = true; break; }
    if (!near) {
      let best = 1e9;
      for (let dy = -8; dy <= 8; dy++) for (let dx = -8; dx <= 8; dx++) {
        const d = Math.hypot(dx, dy);
        if (d < best && op(gx + dx, gy + dy)) { best = d; out = [gx + dx, gy + dy]; }
      }
    }
  }
  if (snapCache.size > 4000) snapCache.clear();
  snapCache.set(k, out);
  return out;
}

const WALKS = new Set(Object.values(ALLY_ANIMS).map((set) => set.walk).filter(Boolean));
const isWalk = (anim) => WALKS.has(anim);
const alphaOf = (c) => { try { return c.getContext('2d').getImageData(0, 0, c.width, c.height).data; } catch { return null; } };
// Visage : pixels du corps à plus de 30 px au-dessus des pieds (tête, cheveux, casque), repère du calque du corps.
const faceCache = new Map();
export function faceRows(body) {
  let out = faceCache.get(body);
  if (out) return out;
  const d = alphaOf(body), w = body.width, h = body.height;
  out = { d, w, h, top: -1 };
  if (d) {
    let feet = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 100) feet = y;
    out.top = feet - 30;
  }
  faceCache.set(body, out);
  return out;
}
// L'arme (posée en (ax, ay) dans le repère du corps) recouvre-t-elle au moins 3 pixels du visage ?
const coverCache = new Map();
function coversFace(body, held, ax, ay) {
  const k = `${body.key}|${held.canvas.width}x${held.canvas.height}|${ax},${ay}|${held.x}`;
  if (coverCache.has(k)) return coverCache.get(k);
  const f = faceRows(body.canvas), wd = alphaOf(held.canvas);
  let n = 0;
  if (f.d && wd) for (let y = 0; y < held.canvas.height; y++) for (let x = 0; x < held.canvas.width; x++) {
    if (wd[(y * held.canvas.width + x) * 4 + 3] < 100) continue;
    const bx = ax + x, by = ay + y;
    if (by < 0 || by >= f.top || bx < 0 || bx >= f.w) continue;
    if (f.d[(by * f.w + bx) * 4 + 3] > 100) n++;
  }
  if (coverCache.size > 4000) coverCache.clear();
  coverCache.set(k, n >= 3);
  return n >= 3;
}

// pick : résultat de ally-anim.js pickHeroAnim ({ name, anim, ox, oy, weapon, head }) ; (x, y) : coin du sprite de jeu.
// opts.weapon = false : corps seul (contrôles de tête).
export function drawHeroPick(ctx, pick, equipment, palette, x, y, opts = {}) {
  const wp = opts.weapon === false ? null : pick.weapon;
  const held = wp && heroHeldWeapon(equipment, wp.deg);
  const body = bodyOf(pick, equipment, palette);
  const ox = pick.anim.ox - body.m, oy = pick.anim.oy - body.m; // repère du calque du corps
  const bx = x + ox, by = y + oy;
  if (!held) { ctx.drawImage(body.canvas, bx, by); return null; }
  const [gx, gy] = snapGrip(body.canvas, body.key, wp.x - ox, wp.y - oy);
  const wx = bx + gx - held.x, wy = by + gy - held.y;
  // v9.2.5 : en marche et au repos (première et dernière image d'un geste), une arme qui recouvrirait le visage
  // (hache, marteau tenus droits) passe derrière la tête et le corps ; le poing reste par-dessus la poignée.
  const i = pick.anim.frames.indexOf(pick.name);
  const calm = pick.anim.frames.length && (i === 0 || i === pick.anim.frames.length - 1 || isWalk(pick.anim));
  const behind = wp.back || (calm && coversFace(body, held, gx - held.x, gy - held.y));
  if (behind) ctx.drawImage(held.canvas, wx, wy);
  ctx.drawImage(body.canvas, bx, by);
  if (behind && !wp.back) {
    const hand = handLayer(body.canvas, body.key, gx, gy);
    if (hand) ctx.drawImage(hand.canvas, bx + gx - hand.r, by + gy - hand.r);
  }
  if (!behind) {
    ctx.drawImage(held.canvas, wx, wy);
    const hand = handLayer(body.canvas, body.key, gx, gy);
    if (hand) ctx.drawImage(hand.canvas, bx + gx - hand.r, by + gy - hand.r);
  }
  return { ...held, gx: gx + ox, gy: gy + oy, behind };
}
