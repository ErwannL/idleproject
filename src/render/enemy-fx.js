// v9.2.9 : toiles de travail relues par getImageData : mémoire côté processeur (avertissement Chrome « willReadFrequently »).
const RF = { willReadFrequently: true };
// v9.2.3 : pouvoirs des ennemis à l'attaque : souffle (dragon, chiens de l'enfer, salamandres…) et incantation
// (magiciennes, nécromanciens, liches, chamans…), synchronisés sur l'animation d'attaque.
//   - souffle : part de la gueule (point le plus en avant du haut de la silhouette de l'image affichée) et va jusqu'au
//     héros ; sa longueur est la distance gueule → cible, son ouverture grandit avec elle (grand cône de loin, court de près) ;
//   - incantation : l'orbe du bâton (point le plus haut du devant de la silhouette) brille pendant la préparation,
//     le sort part de là au moment du coup et touche le héros avec le coup.

// Type → pouvoir et couleurs (cœur, flamme, bord).
export const ENEMY_POWERS = {
  // Souffles
  ash_dragon: { kind: 'breath', colors: ['#fff4c0', '#ffb040', '#e2481e'] },
  mid_hellhound: { kind: 'breath', colors: ['#fff0b0', '#ff9a30', '#d63a1a'] },
  salamander: { kind: 'breath', colors: ['#fff0b0', '#ffa040', '#e05020'] },
  // v9.2.5 : phénix et chef salamandre retirés : leur attaque PixelLab dessine déjà la flamme (croissant de feu,
  // torche balancée) ; un souffle procédural par-dessus faisait deux flammes.
  mid_hydra: { kind: 'breath', colors: ['#e8ffb0', '#9ad040', '#4e8a20'], heads: 3 }, // v9.2.5 : une bouche sur trois, à tour de rôle
  toad: { kind: 'breath', colors: ['#e8ffb0', '#9ad040', '#4e8a20'], short: true },
  mid_star_devourer: { kind: 'breath', colors: ['#ffffff', '#c890ff', '#6a30c0'] },
  frost_wyrm: { kind: 'breath', colors: ['#ffffff', '#a8e4ff', '#4a90d0'] },
  // Incantations
  goblin_shaman: { kind: 'cast', orb: 'nature', colors: ['#e8ffc0', '#8ce060'] },
  hard_necromancer: { kind: 'cast', orb: 'arcane', colors: ['#f0d0ff', '#a050e0'] },
  lich: { kind: 'cast', orb: 'arcane', colors: ['#d0fff0', '#40d0a0'] },
  mini_frost_witch: { kind: 'cast', orb: 'frost', colors: ['#ffffff', '#80d0ff'] },
  hard_plague_doctor: { kind: 'cast', orb: 'nature', colors: ['#e8ffb0', '#90c040'] },
  hard_flame_djinn: { kind: 'cast', orb: 'fire', colors: ['#fff0b0', '#ff8030'] },
  boss_void_emperor: { kind: 'cast', orb: 'arcane', colors: ['#ffffff', '#b070ff'] },
  mini_pharaoh: { kind: 'cast', orb: 'holy', colors: ['#fff8c0', '#f0c040'] },
  spectral_queen: { kind: 'cast', orb: 'frost', colors: ['#ffffff', '#a0c8ff'] },
  crypt_archlich: { kind: 'cast', orb: 'arcane', colors: ['#d0fff0', '#40d0a0'] },
};

export const powerOf = (type) => ENEMY_POWERS[type] ?? null;

// Moments de l'attaque (avancement 0–1 de l'animation, voir attackCurve) : le coup part à 0.3.
export const CAST_RELEASE = 0.34;
export const BREATH_START = 0.3;

const pointCache = new WeakMap();

// Points remarquables d'une image (en pixels de l'image) : gueule et bout du bâton, pour un sprite tourné vers la gauche.
// Fonction pure sur un masque alpha (testée).
export function powerPoints(alpha, w, h) {
  let top = h, bottom = -1, left = w, right = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (alpha[y * w + x]) { top = Math.min(top, y); bottom = Math.max(bottom, y); left = Math.min(left, x); right = Math.max(right, x); }
  if (bottom < 0) return null;
  const H = bottom - top + 1;
  const cx = (left + right) / 2;
  // Gueule : pixel le plus à gauche entre 10 % et 55 % de la hauteur (la tête d'une bête qui regarde le héros).
  let mouth = null;
  for (let y = top + Math.round(H * 0.1); y <= top + Math.round(H * 0.55); y++) {
    for (let x = left; x < w; x++) if (alpha[y * w + x]) { if (!mouth || x < mouth[0]) mouth = [x, y]; break; }
  }
  // Bâton : pixel le plus haut de la moitié avant (gauche) de la silhouette.
  let tip = null;
  for (let y = top; y <= bottom && !tip; y++) for (let x = left; x <= cx; x++) if (alpha[y * w + x]) { tip = [x, y]; break; }
  return { mouth: mouth ?? [left, top + Math.round(H * 0.3)], tip: tip ?? [left, top] };
}

// v9.2.5 : bouches des trois têtes de l'hydre, image par image de son attaque PixelLab (pixels de l'image, de gauche à
// droite ; sur les images 4 à 6 la troisième tête est cachée derrière la deuxième). Relevées à la main sur la planche
// agrandie : un repérage automatique confondait les têtes qui se chevauchent.
export const HEAD_MOUTHS = {
  mid_hydra: [
    [[2, 22], [21, 19], [37, 25]], [[7, 20], [22, 13], [40, 19]], [[10, 16], [26, 11], [43, 20]], [[7, 19], [19, 14], [35, 18]],
    [[3, 18], [22, 21], [22, 21]], [[3, 17], [20, 22], [20, 22]], [[5, 22], [25, 25], [25, 25]], [[5, 21], [15, 21], [32, 23]],
  ],
};

// v9.2.5 : gueule relevée à la main, image par image, sur les planches agrandies (pixels de l'image), pour tous les
// ennemis à souffle : le repérage automatique (pixel le plus en avant du haut de la silhouette) prenait l'aile ou le
// cou du dragon (retour joueur « flamme pas gueule dragon »). `base` : sprite de base (corps au repos entre deux
// attaques) ; les autres : animation PixelLab (indices d'origine des images).
export const MOUTHS = {
  boss_ash_dragon: { base: [8, 40], attack: [[9, 32], [11, 11], [10, 11], [10, 11], [9, 12], [1, 33], [3, 34], [6, 36]] },
  mid_hellhound: { base: [6, 28], attack: [[11, 30], [13, 28], [17, 26], [16, 27], [9, 34], [6, 33], [8, 34], [11, 33]] },
  salamander: { base: [8, 45], attack: [[4, 41], [4, 41], [4, 38], [7, 33], [3, 37], [4, 36], [5, 35], [5, 41]] },
  toad: { base: [10, 19], attack: [[10, 31], [14, 32], [16, 34], [10, 27], [4, 19], [5, 22], [14, 36], [11, 33]] },
  mid_star_devourer: { base: [5, 41], attack: [[10, 45], [9, 45], [8, 47], [11, 44], [10, 42], [10, 43], [11, 45], [9, 44]] },
  boss_frost_wyrm: { base: [8, 22] },
};

// Bouche de la tête `head` (hydre) ou gueule relevée (MOUTHS) sur l'image `key` (« <sprite>__<anim><n> » ou nom du
// sprite de base), ou null si l'image n'est pas annotée.
export function headMouth(key, head) {
  const m = /^(.+)__attack(\d+)$/.exec(key ?? '');
  const table = m && HEAD_MOUTHS[m[1]];
  const row = table?.[Number(m[2])];
  if (row) return row[(head ?? 0) % row.length];
  return mouthAt(key);
}

export function mouthAt(key) {
  if (!key) return null;
  if (MOUTHS[key]?.base) return MOUTHS[key].base;
  const m = /^(.+)__([a-z]+)(\d+)$/.exec(key);
  return (m && MOUTHS[m[1]]?.[m[2]]?.[Number(m[3])]) ?? null;
}

// v9.2.5 : images d'attaque PixelLab qui dessinaient déjà une flamme (chien de l'enfer : flamme dans la gueule) :
// remplacées par les images sans flamme de la même animation, pour une seule flamme, celle du souffle qui part de la
// gueule. Indices des images à jouer à la place des 8 images d'origine. (Dragon : flamme dessinée près des pattes
// retirée des images sources elles-mêmes, sprite de base compris : tools/art/pixellab/.)
export const BREATH_FRAME_MAP = {
  mid_hellhound: [0, 1, 2, 3, 3, 3, 7, 7],
  // v9.2.5 : dragon : il se cabre (tête en haut) puis baisse la tête ; le souffle (à 30 %) part tête baissée, gueule en avant.
  boss_ash_dragon: [1, 3, 5, 5, 6, 6, 7, 7],
};
const safeCache = new Map();
export function breathSafeAnims(base, anims) {
  const map = BREATH_FRAME_MAP[base];
  if (!anims || !map || !anims.attack) return anims;
  if (!safeCache.has(base)) safeCache.set(base, { ...anims, attack: { ...anims.attack, frames: map.map((i) => anims.attack.frames[i]) } });
  return safeCache.get(base);
}

export function powerPointsOf(img) {
  if (!img) return null;
  if (pointCache.has(img)) return pointCache.get(img);
  let p = null;
  try {
    const d = img.getContext('2d', RF).getImageData(0, 0, img.width, img.height).data;
    const a = new Uint8Array(img.width * img.height);
    for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3];
    p = powerPoints(a, img.width, img.height);
  } catch { p = null; }
  pointCache.set(img, p);
  return p;
}

// Géométrie du souffle (fonction pure, testée) : longueur = distance gueule → cible, demi-ouverture au bout.
export function breathShape(x0, y0, x1, y1, short = false) {
  const len = Math.max(4, Math.hypot(x1 - x0, y1 - y0) * (short ? 0.6 : 1));
  return { len, spread: Math.max(3, Math.min(18, len * 0.22)), angle: Math.atan2(y1 - y0, x1 - x0) };
}

// Souffle : cône de pixels qui sort de la gueule, s'allonge jusqu'au héros, puis s'éteint (t : vie restante 1 → 0).
export function drawBreath(ctx, fx, t, time) {
  const { len, spread, angle } = breathShape(fx.x0, fx.y0, fx.x1, fx.y1, fx.short);
  const grow = Math.min(1, (1 - t) / 0.35); // le jet atteint la cible en un tiers de sa vie
  const reach = len * grow;
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const [core, mid, edge] = fx.colors;
  ctx.globalAlpha = Math.min(1, t * 3);
  for (let d = 0; d < reach; d += 2) {
    const k = d / len;
    const half = 1 + spread * k;
    const flick = Math.sin(time * 40 + d * 0.7) * half * 0.3;
    for (let s = -half; s <= half; s += 2) {
      const r = Math.abs(s + flick) / half;
      const n = (Math.sin(d * 12.9898 + s * 78.233 + Math.floor(time * 30)) * 43758.5453) % 1;
      if (r > 0.8 && Math.abs(n) > 0.6) continue; // bord déchiqueté
      ctx.fillStyle = r < 0.35 && k < 0.85 ? core : r < 0.7 ? mid : edge;
      ctx.fillRect(Math.round(fx.x0 + d * cos - s * sin), Math.round(fx.y0 + d * sin + s * cos), 2, 2);
    }
  }
  ctx.globalAlpha = 1;
}

// Lueur de l'orbe pendant la préparation (k : 0 → 1).
export function drawOrbGlow(ctx, x, y, colors, k, time) {
  const r = 1 + Math.round(k * 3 + Math.sin(time * 30) * 0.6);
  ctx.globalAlpha = 0.35 + 0.45 * k;
  ctx.fillStyle = colors[1];
  ctx.fillRect(Math.round(x - r - 1), Math.round(y - r - 1), r * 2 + 2, r * 2 + 2);
  ctx.globalAlpha = 0.6 + 0.4 * k;
  ctx.fillStyle = colors[0];
  ctx.fillRect(Math.round(x - r + 1), Math.round(y - r + 1), Math.max(1, r * 2 - 2), Math.max(1, r * 2 - 2));
  ctx.globalAlpha = 1;
}
