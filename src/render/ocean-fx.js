// v9.2.0 (monde marin) : effets du Royaume englouti (monde 11, zone `underwater`).
//   - décor animé : rayons de lumière qui oscillent, caustiques au sol et sur la scène, kelp qui ondule,
//     poissons de fond qui passent, bulles qui montent, teinte bleue ;
//   - nage : swimDraw() dessine un personnage par bandes de 2 px décalées (ondulation qui part des pieds/de la tête,
//     cheveux et cape qui flottent), avec un flottement vertical lent ; aucun pixel n'est étiré (pixel-perfect) ;
//   - bulles : à la bouche des nageurs, en remous aux attaques, en traînée derrière les projectiles.
// « Réduire les animations » (scene.focus) : ni ondulation, ni rayons mobiles, ni poissons, ni caustiques ; bulles
// rares. Coût mesuré : quelques dizaines de fillRect/drawImage par image (voir tools/ocean-perf.mjs).

const MAX_BUBBLES = 120; // v9.2.1 : accents d'attaque plus fournis

// Phase de flottement d'un nageur (px, en pixels de jeu) : lent et doux, jamais sous le sol.
export function swimBob(time, seed = 0, focus = false) {
  if (focus) return 3;
  return 3 + Math.sin(time * 1.6 + seed) * 2;
}

// Décalage horizontal (px entiers) de la bande de rangées [y, y+2) pour un sprite haut de h :
//   'body' (héros, compagnons) : rien aux pieds, ondulation qui croît vers la tête (cheveux, cape qui flottent) ;
//   'fish' : la queue (à droite, x > 0.6 w) bat — traité par colonnes dans swimDraw ;
//   'eel'  : onde qui parcourt tout le corps.
export function stripOffset(mode, y, h, time, phase, amp) {
  const up = 1 - y / Math.max(1, h); // 0 aux pieds, 1 en haut
  if (mode === 'body') return Math.round(Math.sin(time * 2.2 + phase + y * 0.18) * amp * up * up);
  if (mode === 'jelly') return Math.round(Math.sin(time * 3 + phase + y * 0.35) * amp * (1 - up));
  return 0;
}

// Dessine img (taille d'origine iw×ih) à (x, y) en w×h, ondulé. mode : body | jelly | fish | eel | crawl.
// v9.2.2 : `body` (0 → 1) : l'onde parcourt aussi le corps d'un poisson (arrivée à la nage), pas seulement la queue.
export function swimDraw(ctx, img, x, y, w, h, { time = 0, phase = 0, amp = 1.5, mode = 'body', focus = false, body = 0 } = {}) {
  const iw = img.width, ih = img.height;
  if (focus || amp <= 0 || mode === 'crawl') { ctx.drawImage(img, x, y, w, h); return; }
  const sx = w / iw, sy = h / ih;
  if (mode === 'fish' || mode === 'eel' || mode === 'dolphin') {
    // Par colonnes de 2 px : l'onde fait monter/descendre chaque tranche (queue pour un poisson, tout le corps
    // pour une anguille). Les ennemis regardent à gauche : la queue est à droite.
    for (let cx = 0; cx < iw; cx += 2) {
      const t = cx / iw;
      // v9.2.0 (nage) : 'dolphin' = nageur couché tête à droite, l'onde part de la tête et grandit vers les pieds.
      const tail = mode === 'eel' ? 0.35 + t : mode === 'dolphin' ? Math.max(0, (0.6 - t) / 0.6) : Math.max(0, (t - 0.55) / 0.45);
      const k = mode === 'fish' ? Math.max(tail, body * (0.3 + t * 0.5)) : tail;
      const dy = Math.round(Math.sin(time * (mode === 'eel' ? 5 : 7) + phase + (mode === 'dolphin' ? cx * 0.2 : -cx * (mode === 'eel' ? 0.22 : 0.12))) * amp * k);
      const cw = Math.min(2, iw - cx);
      ctx.drawImage(img, cx, 0, cw, ih, x + cx * sx, y + dy * sy, cw * sx, h);
    }
    return;
  }
  for (let ry = 0; ry < ih; ry += 2) {
    const rh = Math.min(2, ih - ry);
    const dx = stripOffset(mode, ry, ih, time, phase, amp);
    ctx.drawImage(img, 0, ry, iw, rh, x + dx * sx, y + ry * sy, w, rh * sy);
  }
}

// Bulle (ou petite gerbe) ajoutée au système de la scène.
export function addBubble(scene, x, y, { vx = 0, vy = -14, r = 1, life = 1.6 } = {}) {
  const list = scene.bubbles ?? (scene.bubbles = []);
  if (list.length >= MAX_BUBBLES) list.shift();
  list.push({ x, y, vx, vy, r, life, max: life, seed: Math.random() * 6 });
}

// Remous à l'attaque : anneau de bulles qui s'écartent puis remontent.
export function swirl(scene, x, y, n = 6) {
  if (scene.focus) return; // v9.2.0 : « Réduire les animations » : pas de bulles
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    addBubble(scene, x + Math.cos(a) * 3, y + Math.sin(a) * 3, { vx: Math.cos(a) * 18, vy: Math.sin(a) * 10 - 10, r: i % 3 ? 1 : 2, life: 0.9 + Math.random() * 0.5 });
  }
}

export function updateDrawBubbles(scene, ctx, dt) {
  const list = scene.bubbles;
  if (!list?.length) return;
  const top = 4;
  let j = 0;
  for (const b of list) {
    b.life -= dt;
    if (b.life <= 0) continue;
    b.vx *= Math.exp(-dt * 3);
    b.x += (b.vx + Math.sin(scene.time * 4 + b.seed) * 4) * dt;
    b.y += b.vy * dt;
    if (b.y < top) continue;
    list[j++] = b;
    ctx.globalAlpha = Math.min(1, b.life / b.max * 2) * 0.9;
    const x = Math.round(b.x), y = Math.round(b.y);
    if (b.r <= 1) {
      ctx.fillStyle = '#c8f4ff';
      ctx.fillRect(x, y, 1, 1);
    } else {
      ctx.fillStyle = '#7fd8f0';
      ctx.fillRect(x - 1, y, 1, 1); ctx.fillRect(x + 1, y, 1, 1); ctx.fillRect(x, y - 1, 1, 1); ctx.fillRect(x, y + 1, 1, 1);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x - 1, y - 1, 1, 1);
    }
  }
  list.length = j;
  ctx.globalAlpha = 1;
}

// Calques animés derrière les personnages : rayons de lumière, poissons de fond, kelp.
export function drawOceanBack(scene, ctx, scroll) {
  const W = scene.width, G = scene.groundY, t = scene.time;
  // Rayons : bandes obliques pâles qui oscillent lentement.
  ctx.save();
  for (let i = 0; i < 5; i++) {
    const base = ((i * 137 - scroll * 0.03) % (W + 120) + W + 120) % (W + 120) - 60;
    const sway = scene.focus ? 0 : Math.sin(t * 0.5 + i * 1.7) * 10;
    ctx.globalAlpha = scene.focus ? 0.06 : 0.05 + 0.04 * (0.5 + 0.5 * Math.sin(t * 0.8 + i * 2.1));
    ctx.fillStyle = '#bff4ff';
    ctx.beginPath();
    ctx.moveTo(base + sway, 0);
    ctx.lineTo(base + sway + 14 + (i % 2) * 8, 0);
    ctx.lineTo(base + sway + 54 + (i % 3) * 10, G);
    ctx.lineTo(base + sway + 30, G);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
  if (!scene.focus) {
    // Bancs de poissons de fond (silhouettes) qui traversent, à deux profondeurs.
    for (let i = 0; i < 7; i++) {
      const depth = i % 2 ? 0.35 : 0.2;
      const speed = 8 + (i * 5) % 9;
      const x = W + 20 - (((t * speed + i * 211 + scroll * depth) % (W + 60)));
      const y = 18 + ((i * 47) % Math.max(20, G - 60)) + Math.sin(t * 1.3 + i) * 3;
      ctx.fillStyle = depth > 0.3 ? '#1c5a78' : '#164a66';
      for (let k = 0; k < 3; k++) {
        const fx = Math.round(x + k * 7 + (k % 2) * 2), fy = Math.round(y + (k % 2) * 4);
        ctx.fillRect(fx, fy, 4, 2); ctx.fillRect(fx + 1, fy - 1, 2, 1);
        ctx.fillRect(fx + 4, fy - 1 + (Math.floor(t * 6 + k) % 2), 1, 2 + 0); // queue qui bat
      }
    }
  }
  // Kelp : longues tiges qui ondulent (segments de 3 px décalés par une onde).
  for (let i = 0; i < 9; i++) {
    const x0 = ((i * 89 - scroll * 0.55) % (W + 40) + W + 40) % (W + 40) - 20;
    const h = 40 + (i * 23) % 36;
    for (let s = 0; s < h; s += 3) {
      const k = s / h;
      const dx = scene.focus ? Math.round(k * 3) : Math.round(Math.sin(t * 1.4 + i + s * 0.09) * 4 * k);
      ctx.fillStyle = s % 9 === 0 ? '#3a9a4a' : '#24703a';
      ctx.fillRect(Math.round(x0 + dx), G - s - 3, 2, 3);
      if (s % 9 === 6) { ctx.fillStyle = '#4ab05a'; ctx.fillRect(Math.round(x0 + dx + (i % 2 ? 2 : -2)), G - s - 2, 2, 1); }
    }
  }
}

// Au-dessus de tout : caustiques (taches claires qui dansent), bulles ambiantes, voile bleu.
export function drawOceanFront(scene, ctx, scroll, dt) {
  const W = scene.width, G = scene.groundY, t = scene.time;
  if (!scene.focus) {
    ctx.fillStyle = '#d8fbff';
    for (let i = 0; i < 26; i++) {
      const x = ((i * 53 + Math.sin(t * 0.9 + i) * 8 - scroll * 0.9) % (W + 10) + W + 10) % (W + 10) - 5;
      const y = G + 1 + (i % 4);
      ctx.globalAlpha = 0.18 + 0.18 * Math.sin(t * 2.3 + i * 1.9);
      ctx.fillRect(Math.round(x), y, 3 + (i % 3), 1);
    }
    ctx.globalAlpha = 1;
    // Bulles ambiantes qui montent du fond.
    scene.ambientBubble = (scene.ambientBubble ?? 0) - dt;
    if (scene.ambientBubble <= 0) {
      scene.ambientBubble = 0.25 + Math.random() * 0.4;
      addBubble(scene, Math.random() * W, G - 2, { vy: -12 - Math.random() * 10, r: Math.random() < 0.3 ? 2 : 1, life: 4 + Math.random() * 3 });
    }
  }
  updateDrawBubbles(scene, ctx, dt);
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = '#0a5a8a';
  ctx.fillRect(0, 0, W, scene.height);
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------------------------------------------------------
// v9.2.0 (nage) : vraie pose de nage, dérivée de n'importe quel sprite (héros avec son équipement, skins,
// compagnons, familiers) — battement des jambes en ciseaux puis inclinaison du corps, tout au pixel entier :
//   1. kickLegs() : le bas de la silhouette (jambes, ~30 %) est coupé en deux au milieu ; la moitié arrière et la
//      moitié avant montent/descendent en opposition (ciseaux), le vide laissé est comblé par la rangée voisine ;
//   2. rotatePixels() : rotation « RotSprite » simplifiée — agrandissement Scale2x (EPX, sans nouvelle couleur)
//      puis échantillonnage au plus proche voisin : les traits obliques restent nets, aucun flou, aucune couleur
//      inventée.
// Les fonctions de calcul travaillent sur des tableaux RGBA (testables sans navigateur).

// Boîte des pixels opaques d'un tableau RGBA.
export function opaqueBox(data, w, h) {
  let l = w, r = -1, t = h, b = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!data[(y * w + x) * 4 + 3]) continue;
      if (x < l) l = x; if (x > r) r = x; if (y < t) t = y; if (y > b) b = y;
    }
  }
  return r < 0 ? null : { l, r, t, b };
}

// Ciseaux : dans le sprite debout, la jambe arrière (moitié gauche du bas) glisse de `back` px horizontalement et
// la jambe avant de `front` px ; une fois le corps couché (rotation ~80°), ce glissement devient un battement
// haut/bas perpendiculaire au corps (crawl).
export function kickLegs(data, w, h, back, front, legFrac = 0.3) {
  const box = opaqueBox(data, w, h);
  if (!box || (!back && !front)) return data;
  const out = new Uint8ClampedArray(data);
  const top = box.b - Math.max(2, Math.round((box.b - box.t + 1) * legFrac)) + 1;
  let l = w, r = -1;
  for (let y = top; y <= box.b; y++) for (let x = 0; x < w; x++) if (data[(y * w + x) * 4 + 3]) { if (x < l) l = x; if (x > r) r = x; }
  const mid = Math.round((l + r + 1) / 2);
  out.fill(0, top * w * 4);
  // Jambe arrière d'abord, jambe avant par-dessus.
  for (const [x0, x1, dx] of [[0, mid, back], [mid, w, front]]) {
    for (let y = top; y < h; y++) {
      for (let x = x0; x < x1; x++) {
        const s = (y * w + x) * 4, tx = x + dx;
        if (!data[s + 3] || tx < 0 || tx >= w) continue;
        out.set(data.subarray(s, s + 4), (y * w + tx) * 4);
      }
    }
  }
  return out;
}

// Scale2x (EPX) : double l'image en arrondissant les diagonales, sans mélange de couleurs.
export function scale2x(data, w, h) {
  const W = w * 2, out = new Uint8ClampedArray(W * h * 2 * 4);
  const px = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? -1 : (y * w + x) * 4);
  const same = (a, b) => {
    if (a < 0 || b < 0) return a === b;
    if (!data[a + 3] && !data[b + 3]) return true;
    return data[a] === data[b] && data[a + 1] === data[b + 1] && data[a + 2] === data[b + 2] && data[a + 3] === data[b + 3];
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const P = px(x, y), A = px(x, y - 1), B = px(x + 1, y), C = px(x - 1, y), D = px(x, y + 1);
      const q = [P, P, P, P];
      if (same(C, A) && !same(C, D) && !same(A, B) && A >= 0) q[0] = A;
      if (same(A, B) && !same(A, C) && !same(B, D) && B >= 0) q[1] = B;
      if (same(D, C) && !same(D, B) && !same(C, A) && C >= 0) q[2] = C;
      if (same(B, D) && !same(B, A) && !same(D, C) && D >= 0) q[3] = D;
      for (let k = 0; k < 4; k++) {
        const o = ((y * 2 + (k >> 1)) * W + x * 2 + (k & 1)) * 4;
        out.set(data.subarray(q[k], q[k] + 4), o);
      }
    }
  }
  return out;
}

// Rotation de deg degrés (positif = sens horaire à l'écran : le haut du corps part vers l'avant/la droite) autour
// du centre. Renvoie { data, w, h } : image agrandie pour tout contenir, centrée sur le même point.
export function rotatePixels(data, w, h, deg) {
  if (!deg) return { data, w, h };
  const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  const W = Math.ceil(Math.abs(w * c) + Math.abs(h * s)) + 2, H = Math.ceil(Math.abs(w * s) + Math.abs(h * c)) + 2;
  // Même parité que la source : le centre tombe au même endroit (décalage entier).
  const Wp = W + ((W - w) & 1), Hp = H + ((H - h) & 1);
  const big = scale2x(data, w, h), bw = w * 2, bh = h * 2;
  const out = new Uint8ClampedArray(Wp * Hp * 4);
  for (let y = 0; y < Hp; y++) {
    for (let x = 0; x < Wp; x++) {
      const dx = x + 0.5 - Wp / 2, dy = y + 0.5 - Hp / 2;
      // Rotation inverse (vers la source), en coordonnées ×2.
      const sx = Math.floor((dx * c + dy * s + w / 2) * 2), sy = Math.floor((-dx * s + dy * c + h / 2) * 2);
      if (sx < 0 || sy < 0 || sx >= bw || sy >= bh) continue;
      const o = (sy * bw + sx) * 4;
      if (!big[o + 3]) continue;
      out.set(big.subarray(o, o + 4), (y * Wp + x) * 4);
    }
  }
  return { data: out, w: Wp, h: Hp };
}

// Calcul + mise en cache (par image source) d'une pose de nage : { canvas, ox, oy } à dessiner en (x - ox, y - oy).
const swimCache = new WeakMap();
export function swimPose(img, { tilt = 0, back = 0, front = 0, legFrac = 0.3 } = {}) {
  tilt = Math.round(tilt);
  const key = `${tilt}|${back}|${front}|${legFrac}`;
  let per = swimCache.get(img);
  if (!per) swimCache.set(img, (per = new Map()));
  let pose = per.get(key);
  if (pose) return pose;
  let data;
  try { data = img.getContext('2d').getImageData(0, 0, img.width, img.height).data; } catch { return { canvas: img, ox: 0, oy: 0 }; }
  const kicked = kickLegs(data, img.width, img.height, back, front, legFrac);
  const rot = rotatePixels(kicked, img.width, img.height, tilt);
  const canvas = document.createElement('canvas');
  canvas.width = rot.w; canvas.height = rot.h;
  const ctx = canvas.getContext('2d');
  const id = ctx.createImageData(rot.w, rot.h);
  id.data.set(rot.data);
  ctx.putImageData(id, 0, 0);
  pose = { canvas, ox: (rot.w - img.width) / 2, oy: (rot.h - img.height) / 2 };
  if (per.size > 96) per.clear();
  per.set(key, pose);
  return pose;
}

// Battement de jambes en ciseaux, 4 images : [arrière, avant] en px (glissement dans le sprite debout).
export const KICK = [[0, 0], [2, -2], [0, 0], [-2, 2]];
export function kickFrame(time, speed = 6, phase = 0, focus = false, amp = 1) {
  if (focus) return KICK[0];
  const [b, f] = KICK[((Math.floor(time * speed + phase) % 4) + 4) % 4];
  return [Math.round(b * amp), Math.round(f * amp)];
}

// Brasse de crawl en 6 temps : image de bras (images de pas du personnage : le bras libre tire l'eau vers l'arrière
// puis revient) et élan vers l'avant (px) donné à chaque traction.
export const STROKE = [['walk1', 0], ['walk2', 1], ['walk2', 2], ['walk3', 1], ['walk4', 0], ['walk4', 0]];
export function strokeStep(time, speed = 6, phase = 0, focus = false) {
  return focus ? 0 : ((Math.floor(time * speed + phase) % 6) + 6) % 6;
}

// Profondeur de nage (px au-dessus de la position debout) : chacun la sienne, décalées pour que les corps couchés
// ne se recouvrent pas. Balancement d'1 px au plus (on nage, on ne flotte pas).
export const SWIM_DEPTH = { hero: 4, pet: 14, ally0: 22, ally1: -6 };
export const SWIM_TILT = 80; // corps couché, tête devant
export function swimFloat(base, time, seed = 0, focus = false) {
  if (focus) return base;
  return base + (Math.sin(time * 1.3 + seed) > 0.3 ? 1 : 0);
}
