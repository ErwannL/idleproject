// v9.1.9 : animations des personnages dessinés d'un seul tenant (PixelLab : ennemis, compagnons).
//
// Méthode « bras par segment » (pixel-perfect, sans flou) :
//   1. on mesure la silhouette opaque du sprite (boîte englobante) ;
//   2. l'épaule avant est placée à 30 % de la hauteur, à 12 % de la largeur devant l'axe du corps ;
//   3. le « bras/arme » = pixels opaques devant cette épaule, entre 18 % et 78 % de la hauteur
//      (côté gauche pour un ennemi qui regarde le héros, côté droit pour un compagnon) ;
//   4. ce segment est tourné autour de l'épaule par correspondance inverse au plus proche voisin
//      (chaque pixel de destination prend exactement un pixel source : aucune couleur inventée) ;
//   5. le corps est redessiné sans le segment, puis le segment tourné par-dessus ; les pixels du corps
//      laissés à nu derrière le bras sont rebouchés avec le pixel opaque voisin côté dos.
// Les images obtenues (préparation −angle, coup +angle) sont mises en cache : aucun calcul par image.
// Dissolution à la mort : seuils de Bayer 4×4 (tramage ordonné), 5 étapes précalculées.

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const armCache = new WeakMap();
const dissolveCache = new WeakMap();

function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined' && typeof document === 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// Géométrie du bras (fonction pure, testée) : boîte opaque → épaule et zone découpée.
export function armGeometry(alpha, w, h, facing = -1) {
  let top = h, bottom = -1, left = w, right = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (alpha[y * w + x] > 0) {
        if (y < top) top = y;
        if (y > bottom) bottom = y;
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
  }
  if (bottom < 0) return null;
  const H = bottom - top + 1;
  const W = right - left + 1;
  const cx = Math.round((left + right) / 2);
  const sx = cx + facing * Math.round(W * 0.12);
  return { top, bottom, left, right, sx, sy: top + Math.round(H * 0.3), y0: top + Math.round(H * 0.18), y1: top + Math.round(H * 0.78), facing };
}

// Point source (au pixel) d'un point de destination pour une rotation `a` (radians) autour de l'épaule.
export function rotateSource(x, y, g, a) {
  const c = Math.cos(-a), s = Math.sin(-a);
  const dx = x - g.sx, dy = y - g.sy;
  return [Math.round(g.sx + dx * c - dy * s), Math.round(g.sy + dx * s + dy * c)];
}

const inArm = (g, x, y) => y >= g.y0 && y <= g.y1 && (g.facing < 0 ? x < g.sx : x > g.sx);

// Sprite avec le bras avant tourné de `deg` degrés (positif = vers le bas/l'avant). Même taille + marge `pad`.
export function armSwing(img, deg, facing = -1) {
  let byImg = armCache.get(img);
  if (!byImg) armCache.set(img, (byImg = new Map()));
  const key = `${deg}|${facing}`;
  if (byImg.has(key)) return byImg.get(key);
  let out = null;
  try {
    const w = img.width, h = img.height;
    const src = img.getContext('2d').getImageData(0, 0, w, h).data;
    const alpha = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) alpha[i] = src[i * 4 + 3];
    const g = armGeometry(alpha, w, h, facing);
    if (g) {
      const pad = Math.ceil(Math.max(w, h) * 0.25);
      const W = w + pad * 2, H = h + pad * 2;
      const canvas = makeCanvas(W, H);
      const cctx = canvas.getContext('2d');
      const dst = cctx.createImageData(W, H);
      const d = dst.data;
      const put = (x, y, o) => { const p = ((y + pad) * W + x + pad) * 4; d[p] = src[o]; d[p + 1] = src[o + 1]; d[p + 2] = src[o + 2]; d[p + 3] = src[o + 3]; };
      // Corps sans le bras ; trou rebouché par le pixel opaque côté dos (au plus 3 px).
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const o = (y * w + x) * 4;
          if (!src[o + 3]) continue;
          if (!inArm(g, x, y)) { put(x, y, o); continue; }
          if (Math.abs(x - g.sx) <= 3) {
            const bx = g.sx - facing; // colonne juste derrière l'épaule
            const bo = (y * w + bx) * 4;
            if (src[bo + 3]) put(x, y, bo);
          }
        }
      }
      const a = ((deg * Math.PI) / 180) * facing;
      for (let y = -pad; y < h + pad; y++) {
        for (let x = -pad; x < w + pad; x++) {
          const [px, py] = rotateSource(x, y, g, a);
          if (px < 0 || py < 0 || px >= w || py >= h || !inArm(g, px, py)) continue;
          const o = (py * w + px) * 4;
          if (src[o + 3]) put(x, y, o);
        }
      }
      cctx.putImageData(dst, 0, 0);
      out = { canvas, pad };
    }
  } catch { out = null; }
  byImg.set(key, out);
  return out;
}

// Seuil de Bayer (0..15) d'un pixel : il disparaît quand l'étape de dissolution le dépasse.
export const bayer = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];

// Étapes de dissolution (0 = intact … n-1 = presque disparu), bord haut qui part en premier.
export function dissolveFrames(img, n = 5) {
  if (dissolveCache.has(img)) return dissolveCache.get(img);
  let frames = [img];
  try {
    const w = img.width, h = img.height;
    const src = img.getContext('2d').getImageData(0, 0, w, h);
    frames = [];
    for (let k = 0; k < n; k++) {
      const c = makeCanvas(w, h);
      const cctx = c.getContext('2d');
      const im = cctx.createImageData(w, h);
      const level = (k / n) * 20; // 0..16 + avance du haut vers le bas
      for (let y = 0; y < h; y++) {
        const bias = (1 - y / h) * 4;
        for (let x = 0; x < w; x++) {
          const o = (y * w + x) * 4;
          if (bayer(x, y) + 1 > level + bias - 4) for (let j = 0; j < 4; j++) im.data[o + j] = src.data[o + j];
        }
      }
      cctx.putImageData(im, 0, 0);
      frames.push(c);
    }
  } catch { frames = [img]; }
  dissolveCache.set(img, frames);
  return frames;
}

// Courbe d'attaque en trois temps (p = 0 → 1) : préparation (recul, bras levé), coup (élan), retour.
export function attackCurve(p) {
  if (p < 0.3) return { phase: 'wind', dx: -Math.round(2 * (p / 0.3)), arm: -25 };
  if (p < 0.55) return { phase: 'strike', dx: Math.round(-2 + 9 * ((p - 0.3) / 0.25)), arm: 40 };
  return { phase: 'recover', dx: Math.round(7 * (1 - (p - 0.55) / 0.45)), arm: p < 0.75 ? 20 : 0 };
}

// v9.2.3 : animation dessinée image par image (src/render/art-anim.js) quand le sprite en a une, sinon null
// (repli sur les déformations procédurales). Priorité : sortie du sol ou du portail, attaque (atkP : avancement 0–1),
// nage (sous l'eau, en continu), vol (battements d'ailes `fly` ou flottement `float`), marche.
// v9.2.3 : attaques PixelLab qui dessinent déjà leur traînée de coup (arc) : pas de seconde traînée procédurale.
export const DRAWN_TRAIL = new Set(['boss_bone_lord', 'mini_crab_king', 'mid_giant_spider']);

export function pickAnimFrame(set, { emerge = null, portal = null, atkP = null, flying = false, swimming = false, moving = false, time = 0, phase = 0 } = {}) {
  if (!set) return null;
  const at = (anim, k) => ({ anim, key: anim.frames[Math.max(0, Math.min(anim.frames.length - 1, Math.floor(k * anim.frames.length)))] });
  if (set.emerge && emerge !== null) return at(set.emerge, emerge);
  if (set.portal && portal !== null) return at(set.portal, portal);
  if (set.attack && atkP !== null) return at(set.attack, atkP);
  const loop = (anim) => ({ anim, key: anim.frames[Math.floor(time * anim.fps + phase) % anim.frames.length] });
  if (set.swim && swimming) return loop(set.swim);
  if (flying && (set.fly || set.float)) return loop(set.fly ?? set.float);
  if (set.walk && moving) return loop(set.walk);
  return null;
}
