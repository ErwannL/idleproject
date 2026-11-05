// v9.2.3 : apparence propre à chaque mutation (retour joueur : « le Géant, bah il est de la même taille que les autres »).
// Traitement procédural des images du monstre (toutes ses images : repos, marche, attaque PixelLab) :
// - Géant : ×1,6 (taille, ombre, portée : voir MUTATION_SIZE et core/mutations.js), pas lourds ;
// - Cuirassé : acier bleuté, plaques (lignes de rivets), reflet qui balaie l'armure ;
// - Frénétique : teinte rouge, yeux brillants, mouvements accélérés (MUTATION_PACE) ;
// - Vampirique : pâle et violet, cape d'ombre derrière lui ;
// - Régénérant : verdi, lueur verte qui pulse (dessinée par mutation-fx.js) ;
// - Scissipare : plus petit, translucide et vert, membrane qui ondule (mutation-fx.js).
// Les images traitées sont mises en cache par image source (WeakMap) : aucun calcul par image de jeu.

// Facteur de taille à l'écran (multiplie l'échelle de la table src/data/enemy-sizes.js, alignement au sol conservé).
export const MUTATION_SIZE = { giant: 1.6, split: 0.8 };
export const SPLIT_CHILD_SIZE = 0.7; // les deux doubles nés de la division
// Vitesse des animations (marche, respiration) : frénétique plus rapide, géant plus lourd.
export const MUTATION_PACE = { frenzied: 1.9, giant: 0.65 };
// Nombre de positions du reflet métallique du cuirassé (images en cache).
export const SHEEN_STEPS = 8;

export function mutationSize(enemy) {
  if (enemy?.splitChild) return SPLIT_CHILD_SIZE;
  return MUTATION_SIZE[enemy?.mutation] ?? 1;
}

// Mélange une couleur [r, g, b] vers `to` de `k` (0..1).
function mix(c, to, k) {
  return [0, 1, 2].map((i) => Math.round(c[i] + (to[i] - c[i]) * k));
}
const lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;

// Recoloration d'un pixel selon la mutation (luminosité gardée pour que le dessin reste lisible).
export function recolor(id, r, g, b) {
  const l = lum(r, g, b);
  switch (id) {
    case 'armored': { // acier poli : désaturé, bleuté, très contrasté (reflets clairs, creux sombres)
      const s = l < 120 ? l * 0.55 : 255 - (255 - l) * 0.45;
      return mix([r, g, b], [s * 0.84, s * 0.92, Math.min(255, s * 1.08 + 18)], 0.8);
    }
    case 'frenzied': // rouge sang
      return mix([r, g, b], [Math.min(255, l * 1.25 + 60), l * 0.35, l * 0.3], 0.5);
    case 'vampire': // pâle et violet
      return mix([r, g, b], [Math.min(255, l * 0.9 + 70), Math.min(255, l * 0.72 + 40), Math.min(255, l * 1.0 + 90)], 0.55);
    case 'regen':
      return mix([r, g, b], [l * 0.55, Math.min(255, l * 1.1 + 50), l * 0.7 + 20], 0.32);
    case 'split':
      return mix([r, g, b], [l * 0.7, Math.min(255, l + 60), l * 0.6], 0.3);
    case 'giant': // un peu plus terreux et sombre (masse)
      return mix([r, g, b], [l * 0.95 + 10, l * 0.8, l * 0.55], 0.18);
    default:
      return [r, g, b];
  }
}

function canvasOf(w, h) {
  if (typeof OffscreenCanvas !== 'undefined' && typeof document === 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// Boîte des pixels opaques.
function bbox(data, w, h) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (data[(y * w + x) * 4 + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}

// Yeux du frénétique : les deux pixels les plus sombres de la tête, du côté où il regarde (la gauche, vers le héros).
export function eyePixels(data, w, h) {
  const b = bbox(data, w, h);
  if (!b) return [];
  const bw = b.x1 - b.x0 + 1, bh = b.y1 - b.y0 + 1;
  const yMax = b.y0 + Math.max(2, Math.round(bh * 0.42));
  const xMax = b.x0 + Math.max(2, Math.round(bw * 0.6));
  const cand = [];
  for (let y = b.y0 + 1; y <= yMax; y++) for (let x = b.x0 + 1; x <= xMax; x++) {
    const i = (y * w + x) * 4;
    if (data[i + 3] < 200) continue;
    // Entouré de pixels opaques (pas un bord du contour).
    const opaque = [[-1, 0], [1, 0], [0, -1], [0, 1]].every(([dx, dy]) => data[((y + dy) * w + x + dx) * 4 + 3] > 200);
    if (!opaque) continue;
    cand.push({ x, y, l: lum(data[i], data[i + 1], data[i + 2]) });
  }
  cand.sort((a, c) => a.l - c.l || a.x - c.x);
  const out = [];
  for (const c of cand) {
    if (out.length === 2) break;
    if (out.some((o) => Math.abs(o.x - c.x) < 2 && Math.abs(o.y - c.y) < 2)) continue;
    if (out.length === 1 && Math.abs(out[0].y - c.y) > 2) continue; // deux yeux à la même hauteur
    out.push(c);
  }
  if (out.length === 0 && cand.length) out.push(cand[0]);
  return out.map(({ x, y }) => [x, y]);
}

const cache = new WeakMap();

// Image traitée d'une image source pour une mutation (même taille ; `sheen` : position du reflet du cuirassé).
export function mutatedCanvas(src, id, sheen = 0) {
  if (!src || !id || !src.width) return src;
  let per = cache.get(src);
  if (!per) cache.set(src, (per = new Map()));
  const key = id === 'armored' ? `${id}:${sheen}` : id;
  let out = per.get(key);
  if (out) return out;
  const w = src.width, h = src.height;
  out = canvasOf(w, h);
  const ctx = out.getContext('2d');
  ctx.drawImage(src, 0, 0);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const eyes = id === 'frenzied' ? eyePixels(d, w, h) : [];
  const b = bbox(d, w, h);
  const k = Math.max(1, Math.round(h / 32)); // épaisseur des détails sur les grandes images PixelLab
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    if (d[i + 3] === 0) continue;
    let [r, g, bb] = recolor(id, d[i], d[i + 1], d[i + 2]);
    if (id === 'armored' && b) {
      const top = d[((y - k) * w + x) * 4 + 3] === 0 || y < k;
      const ry = y - b.y0;
      if (top) [r, g, bb] = mix([r, g, bb], [245, 250, 255], 0.75); // arête claire en haut des plaques
      else if (ry > 2 * k) {
        // Plaques : joint sombre puis arête claire (biseau), tous les P pixels de jeu ; rivets clairs sur le joint.
        const P = Math.max(4, Math.round((b.y1 - b.y0) / (5 * k)));
        const row = Math.floor(ry / k) % P;
        if (row === 0) [r, g, bb] = (Math.floor((x - b.x0) / k) % 4 === 1) ? [255, 246, 200] : mix([r, g, bb], [26, 32, 52], 0.75);
        else if (row === 1) [r, g, bb] = mix([r, g, bb], [235, 244, 255], 0.55);
      }
      // Reflet : bande diagonale qui balaie l'armure.
      const band = ((x - b.x0) + (y - b.y0) * 0.6) / Math.max(1, (b.x1 - b.x0) + (b.y1 - b.y0) * 0.6);
      const pos = sheen / SHEEN_STEPS * 1.6 - 0.3;
      if (Math.abs(band - pos) < 0.07) [r, g, bb] = mix([r, g, bb], [255, 255, 255], 0.6);
    }
    d[i] = r; d[i + 1] = g; d[i + 2] = bb;
    if (id === 'split') d[i + 3] = Math.round(d[i + 3] * 0.82); // corps translucide (membrane)
  }
  for (const [ex, ey] of eyes) {
    for (let yy = 0; yy < k; yy++) for (let xx = 0; xx < k; xx++) {
      const i = ((ey + yy) * w + ex + xx) * 4;
      d[i] = 255; d[i + 1] = 240; d[i + 2] = 90; d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  out.eyes = eyes;
  per.set(key, out);
  return out;
}

// Cape d'ombre du vampirique : silhouette élargie (épaules, dos) derrière le corps, sur une image agrandie de `pad`.
export function capeCanvas(src) {
  if (!src || !src.width) return null;
  let per = cache.get(src);
  if (!per) cache.set(src, (per = new Map()));
  let out = per.get('cape');
  if (out) return out;
  const w = src.width, h = src.height;
  const pad = Math.max(2, Math.round(h / 8));
  const s = src.getContext ? src : null;
  const tmp = canvasOf(w, h);
  const tctx = tmp.getContext('2d');
  tctx.drawImage(src, 0, 0);
  const d = (s ?? tmp).getContext('2d').getImageData(0, 0, w, h).data;
  const b = bbox(d, w, h);
  out = canvasOf(w + pad * 2, h + pad * 2);
  out.pad = pad;
  if (!b) { per.set('cape', out); return out; }
  const ctx = out.getContext('2d');
  // Cape : trapèze des épaules au bas du corps, plus large vers le bas, en arrière (à droite) ; bas dentelé.
  const bh = b.y1 - b.y0 + 1, bw = b.x1 - b.x0 + 1;
  const top = b.y0 + Math.round(bh * 0.2) + pad;
  const bottom = b.y1 + pad - Math.round(bh * 0.08);
  const left = b.x0 + Math.round(bw * 0.25) + pad;
  const right = b.x1 + pad + Math.round(pad * 0.9);
  ctx.fillStyle = '#2a0f3c';
  ctx.beginPath();
  ctx.moveTo(left, top);
  ctx.lineTo(b.x1 + pad - Math.round(bw * 0.1), top - Math.round(pad * 0.6)); // col dressé
  ctx.lineTo(right, top + Math.round(bh * 0.15));
  ctx.lineTo(right + Math.round(pad * 0.4), bottom);
  const teeth = 4;
  const x0 = left - Math.round(bw * 0.12);
  for (let i = teeth; i >= 0; i--) {
    const tx = x0 + ((right + Math.round(pad * 0.4)) - x0) * (i / teeth);
    ctx.lineTo(tx, bottom - (i % 2 ? Math.round(pad * 0.7) : 0));
  }
  ctx.closePath();
  ctx.fill();
  // Doublure rouge sombre sur le bord arrière.
  ctx.fillStyle = '#7a1030';
  ctx.fillRect(right - Math.max(1, Math.round(pad / 3)), top + Math.round(bh * 0.15), Math.max(1, Math.round(pad / 3)), Math.max(1, bottom - top - Math.round(bh * 0.2)));
  per.set('cape', out);
  return out;
}

// v9.2.3 : portrait de la fiche Collections › Mutations : le monstre tel qu'il apparaît en combat (taille au sol de la
// table d'échelle × taille de la mutation, couleurs, cape, yeux, contour), dans un cadre commun à toutes les mutations
// pour que le Géant y paraisse vraiment plus grand ; `ghost` : silhouette grise du monstre normal à côté (taille).
export const PORTRAIT_W = 84;
export const PORTRAIT_H = 80;
const urls = new Map();
export function mutantPortraitUrl({ spriteCanvas, sizeFactor, SPRITES }, type, sprite, m, { scale = 1, ghost = false } = {}) {
  const key = `${type}|${m.id}|${scale}|${ghost}`;
  if (urls.has(key)) return urls.get(key);
  const src = spriteCanvas(sprite);
  const natural = src.height * (SPRITES[sprite]?.scale ?? 1);
  const k0 = (SPRITES[sprite]?.scale ?? 1) * sizeFactor(type, false, null, natural); // pixels d'image → pixels de jeu
  const k = k0 * (MUTATION_SIZE[m.id] ?? 1);
  const two = ghost && m.id in MUTATION_SIZE;
  const FW = two ? Math.round(PORTRAIT_W * 1.5) : PORTRAIT_W; // monstre normal + muté côte à côte
  const out = canvasOf(FW * scale, PORTRAIT_H * scale);
  const ctx = out.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const G = PORTRAIT_H - 4; // sol
  const w = src.width * k, h = src.height * k;
  const gw0 = src.width * k0;
  const cx = two ? Math.min(FW - w / 2 - 2, gw0 + 6 + w / 2) : PORTRAIT_W / 2;
  const x = cx - w / 2, y = G - h;
  const S = (v) => Math.round(v * scale);
  const silhouette = (c, color) => {
    const t = canvasOf(c.width, c.height);
    const tc = t.getContext('2d');
    tc.drawImage(c, 0, 0);
    tc.globalCompositeOperation = 'source-atop';
    tc.fillStyle = color;
    tc.fillRect(0, 0, t.width, t.height);
    return t;
  };
  // Ombre au sol (plus large pour le Géant, comme en combat).
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.beginPath();
  ctx.ellipse(S(cx), S(G), S(w * 0.35), S(2), 0, 0, Math.PI * 2);
  ctx.fill();
  if (two) {
    // Monstre normal, à côté, en gris : la différence de taille se voit tout de suite.
    const gw = src.width * k0, gh = src.height * k0;
    ctx.globalAlpha = 0.45;
    ctx.drawImage(silhouette(src, '#8a93a8'), S(Math.max(2, cx - w / 2 - gw - 4)), S(G - gh), S(gw), S(gh));
    ctx.globalAlpha = 1;
  }
  if (m.id === 'vampire') {
    const cape = capeCanvas(src);
    ctx.drawImage(cape, S(x - cape.pad * k), S(y - cape.pad * k), S(cape.width * k), S(cape.height * k));
  }
  const glow = silhouette(src, m.color);
  const r = m.id === 'giant' ? 2 : 1.5;
  ctx.globalAlpha = m.id === 'regen' ? 0.45 : 0.3;
  if (m.id === 'regen' || m.id === 'split') for (const [dx, dy] of [[-3, 0], [3, 0], [0, -3], [-2, -2], [2, -2]]) ctx.drawImage(glow, S(x + dx), S(y + dy), S(w), S(h));
  ctx.globalAlpha = 1;
  for (const [dx, dy] of [[-r, 0], [r, 0], [0, -r], [0, r]]) ctx.drawImage(glow, S(x + dx), S(y + dy), S(w), S(h));
  const body = mutatedCanvas(src, m.id, Math.round(SHEEN_STEPS * 0.45));
  ctx.drawImage(body, S(x), S(y), S(w), S(h));
  if (m.id === 'frenzied') {
    ctx.fillStyle = '#ffe14a';
    for (const [ex, ey] of body.eyes ?? []) ctx.fillRect(S(x + ex * k - 1), S(y + ey * k - 0.5), Math.max(2, S(2.5)), Math.max(1, S(1.5)));
    ctx.fillStyle = 'rgba(232, 216, 216, 0.5)';
    for (const [dx, dy, rr] of [[0.35, -4, 1.5], [0.55, -9, 2], [0.45, -14, 2.5]]) ctx.fillRect(S(x + w * dx - rr), S(y + dy - rr), S(rr * 2), S(rr * 2));
  }
  if (m.id === 'regen') {
    for (const [dx, dy] of [[0.1, 0.2], [0.85, 0.35], [0.3, -0.08], [0.7, 0.05]]) {
      ctx.fillStyle = '#5fe07a'; ctx.fillRect(S(x + w * dx), S(y + h * dy), S(2), S(1));
      ctx.fillStyle = '#2f9a4a'; ctx.fillRect(S(x + w * dx + 1), S(y + h * dy + 1), S(1), S(1));
    }
  }
  if (m.id === 'split') {
    ctx.strokeStyle = '#a8ff9a';
    ctx.lineWidth = Math.max(1, scale * 0.6);
    for (const [dx, dy, rr] of [[0.1, 0.3, 1.5], [0.9, 0.5, 2], [0.6, -0.15, 1.2]]) { ctx.beginPath(); ctx.arc(S(x + w * dx), S(y + h * dy), S(rr), 0, Math.PI * 2); ctx.stroke(); }
  }
  const url = out.toDataURL ? out.toDataURL() : '';
  urls.set(key, url);
  return url;
}
