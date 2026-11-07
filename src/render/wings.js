// v9.2.9 : toiles de travail relues par getImageData : mémoire côté processeur (avertissement Chrome « willReadFrequently »).
const RF = { willReadFrequently: true };
// v9.2.2 : battements d'ailes et ondulation des volants (les sprites sont des images fixes).
//
// Ailes — « découpe et rotation » (pixel-perfect, même méthode que le bras de enemy-anim.js) :
//   1. chaque volant ailé a un gabarit (WING_RIGS) : pour chaque aile, un rectangle en pixels du sprite, le point
//      d'attache (épaule) et le côté ; des ellipses « corps » excluent les pixels du corps qui débordent du rectangle ;
//   2. l'aile = pixels opaques du rectangle hors corps ; elle est tournée autour de l'épaule par correspondance
//      inverse au plus proche voisin (aucune couleur inventée), le corps est redessiné par-dessus ;
//   3. 4 poses (haute, mi-haute, mi-basse, basse), calculées une fois par image et mises en cache.
// Cycle 0 1 2 3 2 1 à ~8 battements/s (WING_BEATS) ; « réduire les animations » : 2 poses voisines, 2,5 battements/s.
//
// Ondulation (fantômes, esprits, œil, wyrm) : floatDraw() dessine le sprite par bandes de 2 px décalées — le bas
// traîne derrière et ondule (traîne), le haut se balance doucement ; aucune mise à l'échelle (pixel-perfect).

export const WING_RANGE = [34, -32]; // degrés (pose haute, pose basse), positif = pointe de l'aile vers le haut
export const wingAngles = (rig) => { const [a, b] = rig?.range ?? WING_RANGE; return [0, 1, 2, 3].map((i) => Math.round(a + ((b - a) * i) / 3)); };
export const WING_BEATS = 8; // battements par seconde
const CYCLE = [0, 1, 2, 3, 2, 1];
const CYCLE_FOCUS = [1, 1, 2, 2];

// [x0, y0, x1, y1, épauleX, épauleY, côté (-1 gauche, 1 droite)] ; body : [cx, cy, rx, ry] exclus ;
// range : angles des poses haute et basse (ailes pendantes : de déployées à repliées au repos).
export const WING_RIGS = {
  bat: { wings: [[2, 0, 16, 20, 16, 14, -1], [34, 4, 51, 24, 34, 14, 1]], body: [[24, 22, 12, 13]] },
  leech_fly: { wings: [[5, 0, 20, 24, 18, 24, -1], [30, 14, 55, 31, 30, 26, 1]], body: [[34, 16, 6, 5], [24, 34, 9, 11]] },
  harpy: { wings: [[3, 19, 16, 50, 17, 23, -1], [34, 20, 52, 53, 33, 23, 1]], body: [[25, 36, 9, 16]], range: [52, -2] },
  griffin_cub: { wings: [[27, 16, 38, 31, 27, 29, 1]], body: [], range: [50, -25] },
  mid_crystal_bat: { wings: [[3, 6, 17, 34, 18, 22, -1], [33, 17, 53, 48, 34, 30, 1]], body: [[27, 32, 8, 10]] },
  mini_harpy_queen: { wings: [[6, 24, 20, 52, 21, 27, -1], [38, 26, 56, 58, 37, 28, 1]], body: [[29, 40, 9, 18]], range: [50, -2] },
  boss_ash_dragon: { wings: [[7, 0, 20, 20, 18, 18, -1], [30, 4, 50, 40, 31, 18, 1]], body: [[32, 42, 9, 10]] },
  mid_thunder_griffin: { wings: [[6, 5, 16, 30, 17, 14, -1], [36, 8, 56, 38, 35, 16, 1]], body: [[27, 30, 9, 18]] },
  hard_storm_valkyrie: { wings: [[39, 13, 53, 58, 38, 16, 1]], body: [[30, 36, 8, 22]], range: [45, -6] },
  boss_phoenix: { wings: [[5, 0, 18, 30, 19, 20, -1], [32, 4, 58, 38, 31, 24, 1]], body: [[25, 25, 7, 14]] },
};

// Gabarit d'un sprite (les images de pas _w1/_w2, d'attaque _atk ou de repos _b partagent celui du sprite).
export function wingRig(sprite) {
  return WING_RIGS[sprite] ?? WING_RIGS[String(sprite).replace(/_(w1|w2|atk|b)$/, '')] ?? null;
}

// Pose (indice dans wingAngles(rig)) à l'instant t.
export function wingPose(time, phase = 0, focus = false) {
  if (focus) return CYCLE_FOCUS[Math.floor(time * 2.5 * CYCLE_FOCUS.length + phase) % CYCLE_FOCUS.length];
  return CYCLE[Math.floor(time * WING_BEATS * CYCLE.length + phase) % CYCLE.length];
}

// Le corps est poussé vers le haut au coup d'aile vers le bas (en pixels de jeu).
export const WING_LIFT = [1, 0, -1, -1];

// Pixel (x, y) du sprite appartenant à l'aile i (fonction pure, testée).
export function wingOwner(rig, x, y) {
  for (const [cx, cy, rx, ry] of rig.body) if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1) return -1;
  for (let i = 0; i < rig.wings.length; i++) {
    const [x0, y0, x1, y1] = rig.wings[i];
    if (x >= x0 && x <= x1 && y >= y0 && y <= y1) return i;
  }
  return -1;
}

const cache = new WeakMap();

function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined' && typeof document === 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// Calque RGBA (Uint8ClampedArray w×h) de la pose `deg` : ailes tournées puis corps par-dessus. Fonction pure.
export function wingPixels(src, w, h, rig, deg, pad) {
  const W = w + pad * 2, H = h + pad * 2;
  const out = new Uint8ClampedArray(W * H * 4);
  const owner = new Int8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) owner[y * w + x] = src[(y * w + x) * 4 + 3] ? wingOwner(rig, x, y) : -2;
  const copy = (dx, dy, o) => { const p = ((dy + pad) * W + dx + pad) * 4; out[p] = src[o]; out[p + 1] = src[o + 1]; out[p + 2] = src[o + 2]; out[p + 3] = src[o + 3]; };
  rig.wings.forEach(([, , , , px, py, side], i) => {
    // Côté gauche : sens horaire = pointe vers le haut ; côté droit : l'inverse.
    const a = (-side * deg * Math.PI) / 180;
    const c = Math.cos(-a), s = Math.sin(-a);
    for (let y = -pad; y < h + pad; y++) {
      for (let x = -pad; x < w + pad; x++) {
        const dx = x - px, dy = y - py;
        const sx = Math.round(px + dx * c - dy * s), sy = Math.round(py + dx * s + dy * c);
        if (sx < 0 || sy < 0 || sx >= w || sy >= h || owner[sy * w + sx] !== i) continue;
        copy(x, y, (sy * w + sx) * 4);
      }
    }
  });
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (owner[y * w + x] === -1) copy(x, y, (y * w + x) * 4);
  return { data: out, W, H };
}

// Les 4 poses d'ailes d'une image (cache par image) : [{ canvas, pad }] ou null si impossible.
export function wingFrames(img, rig) {
  if (cache.has(img)) return cache.get(img);
  let frames = null;
  try {
    const w = img.width, h = img.height;
    const src = img.getContext('2d', RF).getImageData(0, 0, w, h).data;
    const pad = Math.ceil(Math.max(w, h) * 0.3);
    frames = wingAngles(rig).map((deg) => {
      const { data, W, H } = wingPixels(src, w, h, rig, deg, pad);
      const canvas = makeCanvas(W, H);
      const cctx = canvas.getContext('2d', RF);
      const im = cctx.createImageData(W, H);
      im.data.set(data);
      cctx.putImageData(im, 0, 0);
      return { canvas, pad };
    });
  } catch { frames = null; }
  cache.set(img, frames);
  return frames;
}

// Décalage horizontal (px du sprite) de la bande de rangées commençant à y (fonction pure, testée).
//   b = 0 en haut, 1 en bas ; amp : ondulation ; trail : traîne (le bas reste en arrière, vers la droite).
export function floatOffset(y, h, time, phase, amp, trail) {
  const b = y / Math.max(1, h);
  const wave = Math.sin(time * 4.2 + phase - y * 0.22) * amp * (0.25 + b * b);
  const sway = Math.sin(time * 1.9 + phase) * amp * 0.45 * (1 - b);
  return Math.round(wave + sway + trail * b * b);
}

// Dessine img à (x, y) en w×h, ondulé par bandes de 2 px (taille d'origine img.width×img.height).
export function floatDraw(ctx, img, x, y, w, h, { time = 0, phase = 0, amp = 2, trail = 0 } = {}) {
  const iw = img.width, ih = img.height;
  if (amp <= 0 && !trail) { ctx.drawImage(img, x, y, w, h); return; }
  const sx = w / iw, sy = h / ih;
  for (let ry = 0; ry < ih; ry += 2) {
    const rh = Math.min(2, ih - ry);
    const dx = floatOffset(ry, ih, time, phase, amp, trail);
    ctx.drawImage(img, 0, ry, iw, rh, x + dx * sx, y + ry * sy, w, rh * sy);
  }
}
