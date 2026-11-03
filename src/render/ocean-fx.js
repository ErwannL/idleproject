// v9.2.0 (monde marin) : effets du Royaume englouti (monde 11, zone `underwater`).
//   - décor animé : rayons de lumière qui oscillent, caustiques au sol et sur la scène, kelp qui ondule,
//     poissons de fond qui passent, bulles qui montent, teinte bleue ;
//   - nage : swimDraw() dessine un personnage par bandes de 2 px décalées (ondulation qui part des pieds/de la tête,
//     cheveux et cape qui flottent), avec un flottement vertical lent ; aucun pixel n'est étiré (pixel-perfect) ;
//   - bulles : à la bouche des nageurs, en remous aux attaques, en traînée derrière les projectiles.
// « Réduire les animations » (scene.focus) : ni ondulation, ni rayons mobiles, ni poissons, ni caustiques ; bulles
// rares. Coût mesuré : quelques dizaines de fillRect/drawImage par image (voir tools/ocean-perf.mjs).

const MAX_BUBBLES = 60;

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
export function swimDraw(ctx, img, x, y, w, h, { time = 0, phase = 0, amp = 1.5, mode = 'body', focus = false } = {}) {
  const iw = img.width, ih = img.height;
  if (focus || amp <= 0 || mode === 'crawl') { ctx.drawImage(img, x, y, w, h); return; }
  const sx = w / iw, sy = h / ih;
  if (mode === 'fish' || mode === 'eel') {
    // Par colonnes de 2 px : l'onde fait monter/descendre chaque tranche (queue pour un poisson, tout le corps
    // pour une anguille). Les ennemis regardent à gauche : la queue est à droite.
    for (let cx = 0; cx < iw; cx += 2) {
      const t = cx / iw;
      const k = mode === 'eel' ? 0.35 + t : Math.max(0, (t - 0.55) / 0.45);
      const dy = Math.round(Math.sin(time * (mode === 'eel' ? 5 : 7) + phase - cx * (mode === 'eel' ? 0.22 : 0.12)) * amp * k);
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
  if (scene.focus) n = Math.min(n, 2);
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
