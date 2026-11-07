// v9.2.9 : toiles de travail relues par getImageData : mémoire côté processeur (avertissement Chrome « willReadFrequently »).
const RF = { willReadFrequently: true };
// v9.2.5 : calage des images dessinées (PixelLab) des ennemis sur leur sprite de base.
// Retour joueur : « toujours des sprites pas correctement alignés » (loup frénétique qui flotte). Les animations
// générées gardent le cadre de PixelLab, qui dérive d'une image et d'une animation à l'autre : pieds au-dessus ou
// sous la ligne du sol, corps qui glisse de quelques pixels. On recale donc à l'exécution, sur la silhouette opaque :
//   - pieds : le bas opaque de l'image est posé sur le bas opaque du sprite de base (donc sur le sol) ;
//     image par image pour la marche, le coup reçu et le flottement (pas de saut voulu), et pour l'animation entière
//     (image la plus basse) pour l'attaque, la mort, la sortie du sol et du portail (le saut du crapaud reste un saut) ;
//   - centre horizontal : centre moyen de la silhouette de l'animation sur le centre du sprite de base (l'élan de
//     l'attaque reste, le corps ne glisse plus d'une animation à l'autre) ;
//   - tête : haut opaque du sprite de base (stable), pour l'étiquette et la barre de PV.
// Fonctions pures sur masques alpha (testées) + cache par image.

const boxCache = new WeakMap();

// Boîte opaque d'un masque alpha (seuil > 0), ou null.
export function opaqueBox(alpha, w, h) {
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
  return bottom < 0 ? null : { top, bottom, left, right, cx: (left + right + 1) / 2 };
}

export function boxOf(img) {
  if (!img) return null;
  if (boxCache.has(img)) return boxCache.get(img);
  let b = null;
  try {
    const d = img.getContext('2d', RF).getImageData(0, 0, img.width, img.height).data;
    const a = new Uint8Array(img.width * img.height);
    for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3];
    b = opaqueBox(a, img.width, img.height);
    // v9.2.5 : pieds = bas du corps sans les effets (flammes, étincelles, particules détachées) : voir solidMask.
    if (b) { const f = footRow(solidMask(d, img.width, img.height), img.width, img.height); b.foot = f < 0 ? b.bottom : f; }
  } catch { b = null; }
  boxCache.set(img, b);
  return b;
}

// Animations calées image par image sur les pieds (les autres : sur l'image la plus basse de l'animation).
export const PER_FRAME_FEET = new Set(['walk', 'hurt', 'swim']);

// Décalage (ox, oy, en pixels du sprite) de l'image `i` d'une animation, par rapport au cadre du sprite de base.
// base : boîte du sprite de base ; boxes : boîtes des images ; name : nom de l'animation ; feet : false = garder le
// décalage vertical d'origine (volants, nage) ; orig : {ox, oy} d'origine.
export function anchorOffset(base, boxes, i, name, orig = { ox: 0, oy: 0 }, feet = true) {
  const ok = boxes.filter(Boolean);
  if (!base || !ok.length || !boxes[i]) return { ox: orig.ox, oy: orig.oy };
  const meanCx = ok.reduce((s, b) => s + b.cx, 0) / ok.length;
  const ox = Math.round(base.cx - meanCx);
  if (!feet) return { ox, oy: orig.oy };
  // v9.2.5 : sur le bas du corps sans les effets (`foot`, flammes et particules ignorées), à défaut le bas opaque.
  const ft = (b) => b.foot ?? b.bottom;
  const bottom = PER_FRAME_FEET.has(name) ? ft(boxes[i]) : Math.max(...ok.map(ft));
  return { ox, oy: ft(base) - bottom };
}

// Haut de la tête et centre (en pixels du sprite de base) pour l'étiquette et la barre de PV.
export function headOf(base) {
  return base ? { top: base.top, cx: base.cx, bottom: base.bottom } : null;
}

// Boîtes des images d'une animation (cache par animation ; `toCanvas` : clé d'image → canvas).
const animCache = new WeakMap();
export function animBoxes(anim, toCanvas) {
  if (animCache.has(anim)) return animCache.get(anim);
  const boxes = anim.frames.map((k) => boxOf(toCanvas(k)));
  animCache.set(anim, boxes);
  return boxes;
}

// v9.2.5 : « pixel d'effet » : feu très saturé et lumineux (rouge-orangé à jaune), comme les flammes du chien de l'enfer.
export function isFirePixel(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  if (mx < 191 || mx === 0 || (mx - mn) / mx <= 0.55) return false;
  let h = 0;
  if (mx === r) h = ((g - b) / (mx - mn)) / 6; else if (mx === g) h = (2 + (b - r) / (mx - mn)) / 6; else h = (4 + (r - g) / (mx - mn)) / 6;
  if (h < 0) h += 1;
  return h < 0.17 || h > 0.95;
}

// Masque du corps (RGBA → 0/1) : pixels opaques, sans le feu ni les composantes détachées de moins de 6 pixels
// (étincelles, gouttes, particules). Fonction pure (testée).
export function solidMask(d, w, h) {
  const m = new Uint8Array(w * h), lab = new Int32Array(w * h), out = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) m[i] = d[i * 4 + 3] > 0 ? 1 : 0;
  let n = 0; const st = [];
  for (let i = 0; i < w * h; i++) {
    if (!m[i] || lab[i]) continue;
    n++; lab[i] = n; st.push(i); const comp = [];
    while (st.length) {
      const j = st.pop(); comp.push(j); const x = j % w, y = (j - x) / w;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const u = x + dx, v = y + dy;
        if (u < 0 || v < 0 || u >= w || v >= h) continue;
        const k = v * w + u;
        if (m[k] && !lab[k]) { lab[k] = n; st.push(k); }
      }
    }
    if (comp.length >= 6) for (const j of comp) if (!isFirePixel(d[j * 4], d[j * 4 + 1], d[j * 4 + 2])) out[j] = 1;
  }
  return out;
}

export function footRow(mask, w, h) {
  for (let y = h - 1; y >= 0; y--) for (let x = 0; x < w; x++) if (mask[y * w + x]) return y;
  return -1;
}

// v9.2.5 : quadrupèdes et bêtes basses (retour joueur « chien, plusieurs mobs à 4 pattes pas alignés avec le sol ») :
// les images PixelLab sont vues de trois quarts : les pattes du fond (souvent l'arrière-train à l'attaque) sont plus
// haut que celles de devant et semblent flotter une fois posées sur la ligne du sol d'un jeu vu de côté.
// Audit v9.2.5 (planches avant/après) : recalage gardé pour les bêtes dont les bords bas sont bien des pattes. Exclus
// après contrôle : mammouth (trompe), scorpion et crabes (pinces), araignée (pattes avant levées, pose voulue),
// rôdeur et dévoreur stellaires (queue), dragon et hydre (tête, cou), griffon du tonnerre (ailes) : leur patte la plus
// basse est déjà sur le sol (calage du bas du corps ci-dessus).
export const QUADRUPEDS = new Set(['wolf', 'wolf_ice', 'boss_alpha_wolf', 'boar', 'mid_boar_titan', 'mid_hellhound', 'salamander',
  'griffin_cub', 'obsidian_beetle', 'toad']);

// Plan de recalage des pattes (fonction pure, testée) : bas du corps (sans effets) des 25 % avant et des 25 % arrière
// de la silhouette (pattes extrêmes) ; chaque côté resté plus haut que le sol de l'image (`ground`, patte la plus basse)
// descend jusqu'à lui, moitié en inclinant le corps de ce côté, moitié en allongeant les pattes (au pixel, plus proche
// voisin), avec une rampe depuis le milieu pour ne pas casser la silhouette. null si tout touche déjà le sol (< 2 px).
export function legPlan(mask, w, h) {
  const bot = new Int32Array(w).fill(-1); let l = w, r = -1, top = h;
  for (let x = 0; x < w; x++) for (let y = h - 1; y >= 0; y--) if (mask[y * w + x]) { bot[x] = y; l = Math.min(l, x); r = Math.max(r, x); break; }
  for (let y = 0; y < h && top === h; y++) for (let x = 0; x < w; x++) if (mask[y * w + x]) { top = y; break; }
  if (r < 0) return null;
  const m = (l + r) / 2, W = r - l + 1, edge = Math.round(W * 0.25);
  let ground = -1; for (let x = l; x <= r; x++) ground = Math.max(ground, bot[x]);
  const side = (x0, x1) => { let v = -1; for (let x = x0; x <= x1; x++) v = Math.max(v, bot[x]); return v; };
  const mk = (dir, sideBot) => {
    const gap = ground - sideBot;
    if (gap < 2 || sideBot < 0 || gap > (ground - top) * 0.32) return null; // écart trop grand : queue, pince, saut
    return { dir, gap, sideBot, yb: sideBot - Math.max(3, Math.round((sideBot - top) * 0.3)), tilt: Math.floor(gap / 2) };
  };
  const sides = [mk(-1, side(l, l + edge - 1)), mk(1, side(r - edge + 1, r))].filter(Boolean);
  return sides.length ? { l, r, m, ground, sides } : null;
}

// Part de la correction (0 → 1) d'un côté pour la colonne x : nulle au milieu, entière sur les 60 % extérieurs.
export function legRamp(p, s, x) {
  const t = s.dir > 0 ? (x - p.m) / Math.max(1, p.r - p.m) : (p.m - x) / Math.max(1, p.m - p.l);
  return t <= 0 ? 0 : Math.min(1, t / 0.4);
}

// Ligne source du pixel de destination (x, yd) d'après le plan.
export function legSource(p, x, yd) {
  for (const s of p.sides) {
    const k = legRamp(p, s, x);
    if (k <= 0) continue;
    const S = Math.round(s.tilt * k), E = Math.round(s.gap * k) - S;
    const y = yd - S;
    if (y < s.yb) return y;
    const span = s.sideBot - s.yb + 1;
    if (y > s.sideBot + E) return y - E;
    return s.yb + Math.floor(((y - s.yb) * span) / (span + E));
  }
  return yd;
}

const legCache = new WeakMap();
function makeCanvas(w, h) {
  if (typeof document === 'undefined' && typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
}
// Image avec les pattes posées au sol (même taille), ou l'image elle-même si rien à corriger. `ref` : image dont on
// tire le plan (la même sans éclair blanc ni teinte, pour que l'éclair ou le halo suivent exactement le corps).
const planCache = new WeakMap();
function planOf(img) {
  if (planCache.has(img)) return planCache.get(img);
  const d = img.getContext('2d', RF).getImageData(0, 0, img.width, img.height).data;
  const p = legPlan(solidMask(d, img.width, img.height), img.width, img.height);
  planCache.set(img, p);
  return p;
}
export function groundLegs(img, ref = img) {
  if (!img) return img;
  if (legCache.has(img)) return legCache.get(img);
  let out = img;
  try {
    const w = img.width, h = img.height;
    const d = img.getContext('2d', RF).getImageData(0, 0, w, h).data;
    const p = ref && ref.width === w && ref.height === h ? planOf(ref) : planOf(img);
    if (p) {
      const c = makeCanvas(w, h); const cx = c.getContext('2d', RF); const im = cx.createImageData(w, h);
      for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) {
        const sy = legSource(p, x, y);
        if (sy < 0 || sy >= h) continue;
        const o = (sy * w + x) * 4, q = (y * w + x) * 4;
        for (let j = 0; j < 4; j++) im.data[q + j] = d[o + j];
      }
      cx.putImageData(im, 0, 0);
      out = c;
    }
  } catch { out = img; }
  legCache.set(img, out);
  return out;
}

// v9.2.5 : longueur du pas (retour joueur « squelette glisse dans le sol ») : pixels dont le pied d'appui recule d'une
// image de marche à la suivante (sprite tourné vers la gauche : le pied posé glisse vers la droite dans l'image).
// Pour chaque paire d'images : bande des 3 lignes du bas du corps (sans effets), décalage d (1 à 10 px) qui superpose
// le mieux la bande de l'image i décalée de d sur celle de l'image i+1 ; médiane des paires. Fonction pure (testée) sur
// des masques {mask, w, h} déjà recalés (dx : décalage horizontal de calage de chaque image).
export function strideOf(frames) {
  // Pieds posés : suites de colonnes occupées dans les 3 lignes du bas ; le pied d'appui d'une image se retrouve dans
  // la suivante, de même largeur (± 2 px), décalé vers l'arrière (droite) de 0 à 8 px ; le plus large l'emporte.
  const runs = (f) => {
    const occ = new Uint8Array(f.w);
    for (let y = Math.max(0, f.foot - 2); y <= f.foot; y++) for (let x = 0; x < f.w; x++) if (f.mask[y * f.w + x]) occ[x] = 1;
    const out = []; let x0 = -1;
    for (let x = 0; x <= f.w; x++) { if (x < f.w && occ[x]) { if (x0 < 0) x0 = x; } else if (x0 >= 0) { out.push([x0 + (f.dx ?? 0), x - 1 + (f.dx ?? 0)]); x0 = -1; } }
    return out;
  };
  const shifts = [];
  for (let i = 0; i < frames.length; i++) {
    const a = frames[i], b = frames[(i + 1) % frames.length];
    if (!a || !b || a.foot < 0 || b.foot < 0) continue;
    const rb = runs(b); let best = null;
    for (const [l0, r0] of runs(a)) {
      for (const [l1, r1] of rb) {
        const d = (l1 - l0 + r1 - r0) / 2;
        if (Math.abs(r1 - l1 - (r0 - l0)) > 2 || d < 0 || d > 8) continue;
        if (!best || r0 - l0 > best.w || (r0 - l0 === best.w && d < best.d)) best = { w: r0 - l0, d };
      }
    }
    if (best) shifts.push(best.d);
  }
  if (!shifts.length) return null;
  // Moyenne (pas fractionnaire) sans la paire extrême de chaque côté (pied qui se lève, image de transition).
  shifts.sort((p, q) => p - q);
  const core = shifts.length > 4 ? shifts.slice(1, -1) : shifts;
  return Math.max(1, Math.min(8, core.reduce((t, v) => t + v, 0) / core.length));
}

// Pas (pixels du sprite par image) d'une animation de marche, mesuré sur ses images (cache par animation).
const strideCache = new WeakMap();
export function animStride(anim, toCanvas) {
  if (strideCache.has(anim)) return strideCache.get(anim);
  let v = null;
  try {
    v = strideOf(anim.frames.map((k) => {
      const c = toCanvas(k); if (!c) return null;
      const d = c.getContext('2d', RF).getImageData(0, 0, c.width, c.height).data;
      const mask = solidMask(d, c.width, c.height);
      return { mask, w: c.width, h: c.height, foot: footRow(mask, c.width, c.height) };
    }));
  } catch { v = null; }
  strideCache.set(anim, v);
  return v;
}
