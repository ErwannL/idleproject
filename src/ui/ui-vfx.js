// v9.2.6 : effets visuels de l'interface (menus, récompenses, forge, invocation, carte du monde, chargement).
// Planches pixel art animées générées avec PixelLab (tools/art/pixellab_ui_vfx.py → assets/ui/vfx/<nom>.webp,
// catalogue ./ui-vfx-sheets.js) ; transitions en CSS (style.css, bloc « v9.2.6 : VFX »).
// Règles : rien ne capte un clic (calque pointer-events: none), menus ≤ 400 ms, un nombre d'effets borné,
// et rien du tout en « Réduire les animations » / prefers-reduced-motion (classe .reduce-motion posée par ui.js).
import { MAP_FX, SHEETS } from './ui-vfx-sheets.js';

const MAX_LIVE = 48; // effets simultanés au plus (une avalanche de clics ne ralentit pas l'interface)
let layer = null;
let live = 0;

export function calm() {
  if (typeof document === 'undefined') return true;
  return document.documentElement.classList.contains('reduce-motion')
    || document.body.classList.contains('hold-repeating');
}

function getLayer() {
  if (layer?.isConnected) return layer;
  layer = document.createElement('div');
  layer.id = 'ui-vfx';
  layer.setAttribute('aria-hidden', 'true');
  document.body.appendChild(layer);
  return layer;
}

export const sheetUrl = (name) => `assets/ui/vfx/${name}.webp`;

// Un sprite animé (planche horizontale) en position absolue. `size` = côté affiché en px CSS (multiple entier de
// la planche de préférence) ; `loops` = nombre de tours (Infinity pour une boucle, à retirer soi-même).
export function sprite(name, { size, loops = 1, speed = 1, tint = null, parent = null, cls = '' } = {}) {
  const s = SHEETS[name];
  if (!s) return null;
  const el = document.createElement('i');
  el.className = `uvfx ${cls}`;
  const k = size ? size / s.w : 2;
  el.style.width = `${Math.round(s.w * k)}px`;
  el.style.height = `${Math.round(s.h * k)}px`;
  el.style.backgroundImage = `url(${sheetUrl(name)})`;
  el.style.backgroundSize = `${s.n * 100}% 100%`;
  if (tint) el.style.setProperty('--tint', tint);
  (parent ?? getLayer()).appendChild(el);
  const dur = (s.n / s.fps) * 1000 / speed;
  const anim = el.animate([{ backgroundPositionX: '0%' }, { backgroundPositionX: '100%' }],
    { duration: dur, iterations: loops, easing: `steps(${Math.max(1, s.n - 1)}, jump-none)` });
  if (loops !== Infinity) setTimeout(() => el.remove(), dur * loops + 40);
  return el;
}

// Effet joué une fois, centré sur (x, y) en coordonnées de la fenêtre.
export function play(name, x, y, opts = {}) {
  if (calm() || live >= MAX_LIVE || !SHEETS[name]) return null;
  const el = sprite(name, opts);
  if (!el) return null;
  live += 1;
  const w = parseFloat(el.style.width);
  const h = parseFloat(el.style.height);
  el.style.left = `${Math.round(x - w / 2)}px`;
  el.style.top = `${Math.round(y - h / 2)}px`;
  const done = () => { live -= 1; el.remove(); };
  const s = SHEETS[name];
  setTimeout(done, ((s.n / s.fps) * 1000) / (opts.speed ?? 1) * (opts.loops ?? 1) + 60);
  return el;
}

const center = (el) => {
  const r = el.getBoundingClientRect();
  return [r.left + r.width / 2, r.top + r.height / 2, r];
};

export function playOn(name, el, opts = {}) {
  if (!el?.isConnected) return null;
  const [x, y] = center(el);
  return play(name, x, y, opts);
}

// Éclat bref sur un élément (classe CSS retirée après coup, relancée si déjà posée).
export function pulse(el, cls = 'vfx-bump', ms = 450) {
  if (!el || calm()) return;
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
  clearTimeout(el._vfxT);
  el._vfxT = setTimeout(() => el.classList.remove(cls), ms);
}

// Pièces ou gemmes qui volent d'un point vers le compteur du haut (courbe, en cascade), éclat à l'arrivée.
export function flyTo(kind, from, target, count = 6) {
  if (calm() || !target?.isConnected) return;
  const [tx, ty, tr] = center(target);
  if (!tr.width) return;
  const [fx, fy] = Array.isArray(from) ? from : center(from);
  const n = Math.max(1, Math.min(count, 10, MAX_LIVE - live));
  const icon = kind === 'gems' ? 'gem' : 'coin';
  for (let i = 0; i < n; i++) {
    const sz = coinSize();
    const el = sprite(icon, { size: sz, loops: Infinity, speed: 1.6 });
    if (!el) return;
    live += 1;
    const ox = fx + (Math.random() - 0.5) * 36;
    const oy = fy + (Math.random() - 0.5) * 20;
    el.style.left = `${ox - sz / 2}px`;
    el.style.top = `${oy - sz / 2}px`;
    const dx = tx - ox;
    const dy = ty - oy;
    const lift = -40 - Math.random() * 50;
    const a = el.animate([
      { transform: 'translate(0,0) scale(.4)', opacity: 0 },
      { transform: `translate(${(Math.random() - 0.5) * 50}px, ${lift * 0.6}px) scale(1.15)`, opacity: 1, offset: 0.22 },
      { transform: `translate(${dx * 0.55}px, ${dy * 0.55 + lift}px) scale(1)`, opacity: 1, offset: 0.6 },
      { transform: `translate(${dx}px, ${dy}px) scale(.7)`, opacity: 0.9 },
    ], { duration: 620 + i * 25, delay: i * 55, easing: 'cubic-bezier(.45,0,.7,1)', fill: 'both' });
    setTimeout(() => {
      el.remove();
      live -= 1;
      if (i === 0 || i === n - 1) { pulse(target.closest('.chip') ?? target); play('spark', tx, ty, { size: 48 }); play('gold_shine', tx, ty, { size: 48 }); }
    }, 640 + i * 80); // minuterie plutôt que onfinish : l'effet se retire toujours (onglet en arrière-plan…)
    void a;
  }
}

// Petit nombre « +N » qui monte (sans texte à traduire).
export function floatText(text, x, y, color = '#ffe28a') {
  if (calm()) return;
  const el = document.createElement('b');
  el.className = 'uvfx-num';
  el.textContent = text;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.style.color = color;
  getLayer().appendChild(el);
  el.animate([{ transform: 'translate(-50%,0) scale(.7)', opacity: 0 }, { transform: 'translate(-50%,-14px) scale(1.1)', opacity: 1, offset: 0.25 },
    { transform: 'translate(-50%,-34px) scale(1)', opacity: 0 }], { duration: 900, easing: 'ease-out' });
  setTimeout(() => el.remove(), 920);
}

// --- Clics : l'état avant / après une action dit ce qui s'est passé (récompense, fusion, renfort, équipement…) ---
function snap(state) {
  if (!state) return null;
  return {
    gold: state.gold, gems: state.gems, shards: state.materials?.shards ?? 0, inv: state.inventory?.length ?? 0,
    stash: state.stash?.length ?? 0, next: state.nextItemId ?? 0, lvl: state.level ?? 0,
    eq: Object.values(state.equipment ?? {}).map((i) => i?.id ?? '').join(),
    ach: Object.keys(state.achievements?.claimed ?? {}).length,
  };
}

const CLAIM_BIG = new Set(['claim-everything', 'claim-all', 'claim-all-expeditions', 'claim-all-events']);
const CHEST = new Set(['claim-event', 'claim-mission-bonus']);
const FORGE = new Set(['upgrade-item', 'sharpen', 'reforge', 'target-reroll', 'craft', 'upgrade-companion']);

export function clickFx(ui, event, run) {
  const el = event.target.closest?.('[data-action]');
  const action = el?.dataset.action;
  const before = action && !calm() ? snap(ui.state) : null;
  const tal = action?.startsWith('buy-talent') ? ui.state?.talents?.[el.dataset.key] ?? 0 : 0;
  const pt = [event.clientX, event.clientY];
  const [cx, cy] = el ? center(el) : pt;
  run();
  if (el && !el.disabled && !calm() && el.isConnected && !el.closest('.summon-fx')) pulse(el, 'vfx-press', 260);
  if (!before) return;
  // v9.2.6 (2e vague) : écrans clés.
  if (action === 'enter-dungeon' && (ui.state?.dungeon)) stageFx('dungeon_portal', 192);
  else if (action === 'start-expedition') play('depart', cx, cy, { size: 96 });
  else if ((action === 'buy-talent' || action === 'buy-talent-max') && (ui.state?.talents?.[el.dataset.key] ?? 0) > tal) {
    const node = document.querySelector(`#panel-body .rune-tree [data-action="talent-sel"][data-value="${CSS.escape(el.dataset.key)}"]`);
    talentFx(node ?? el);
  } else if (action === 'confirm-rebirth') bigFx('rebirth', '#ff8a3a');
  else if (action === 'confirm-transcend') bigFx('transcend', '#c9a6ff');
  else if (action === 'open-claims') setTimeout(() => playOn('mail_open', document.querySelector('#modal-card h2'), { size: 96 }), 30);
  const after = snap(ui.state);
  if (!after) return;
  const tint = el ? getComputedStyle(el).getPropertyValue('--rarity').trim() || null : null;
  const dg = after.gold - before.gold;
  const dm = after.gems - before.gems;
  const gold = document.querySelector('#topbar [data-currency="gold"] span') ?? document.getElementById('strip-gold');
  const gems = document.querySelector('#topbar [data-currency="gems"] span');
  if (action.startsWith('claim') || action === 'enc-claim' || CHEST.has(action)) {
    const big = CLAIM_BIG.has(action);
    const got = dg > 0 || dm > 0 || after.inv + after.stash > before.inv + before.stash || after.ach > before.ach || after.shards > before.shards;
    if (!got) return;
    if (el.closest('#modal')) play('mail_open', cx, cy - 20, { size: 80 });
    if (action.includes('expedition')) play('return', cx, cy, { size: 96 });
    if (after.ach > before.ach || action === 'claim-achievement') play('trophy', cx, cy, { size: 144 });
    else if (CHEST.has(action)) play('chest', cx, cy, { size: 128 });
    else play(big ? 'confetti' : 'burst', cx, cy, { size: big ? 224 : 128 });
    if (dg > 0) flyTo('gold', [cx, cy], gold, big ? 10 : 5);
    if (dm > 0) { flyTo('gems', [cx, cy], gems, big ? 8 : 4); floatText(`+${dm}`, cx, cy - 10, '#8fe6ff'); }
    if (big) pulse(document.getElementById('topbar'), 'vfx-glow', 700);
    return;
  }
  if (action === 'fuse' || action === 'fuse-all') {
    if (after.inv < before.inv) play('fusion', cx, cy, { size: 156, tint });
  } else if (FORGE.has(action)) {
    const ok = after.next > before.next || after.gold < before.gold || after.shards < before.shards || after.gems < before.gems;
    if (ok) play('forge', cx, cy, { size: 144 });
  } else if (action === 'equip' || action === 'equip-best' || action === 'apply-build' || action === 'apply-loadout') {
    if (after.eq !== before.eq) {
      play('equip', cx, cy, { size: 100, tint });
      // Éclat de rareté sur les vignettes équipées, une fois le panneau redessiné.
      requestAnimationFrame(() => requestAnimationFrame(() => {
        document.querySelectorAll('#panel-body .paperdoll .slot.filled, #panel-body .equip-slot.filled').forEach((s, i) => {
          if (i < 8) setTimeout(() => pulse(s, 'vfx-shine', 600), i * 40);
        });
      }));
    }
  } else if (action === 'recycle' || action === 'bulk-recycle') {
    if (after.inv + after.stash < before.inv + before.stash) {
      play('recycle', cx, cy, { size: 122 });
      if (dg > 0) flyTo('gold', [cx, cy], gold, 4);
    }
  }
}

// --- Événements du jeu ---
export function levelUpFx() {
  const el = document.getElementById('portrait') ?? document.getElementById('level-badge');
  const target = el?.getBoundingClientRect().width ? el : document.getElementById('level-badge');
  if (!target) return;
  const [x, y] = center(target);
  play('levelup', x, y + 10, { size: 186 });
  pulse(target, 'vfx-glow', 800);
}

export function unlockFx(button) {
  if (!button) return;
  playOn('unlock', button, { size: 104 });
  pulse(button, 'vfx-unlocked', 1200);
}

// Changement de monde : voile bref sur la scène (aucun blocage, ≤ 400 ms) et éclat sur la carte de zone.
export function worldTransitionFx() {
  if (calm()) return;
  const area = document.getElementById('stage-area');
  if (!area) return;
  const veil = document.createElement('div');
  veil.className = 'vfx-world-veil';
  area.appendChild(veil);
  veil.animate([{ clipPath: 'circle(0% at 50% 50%)', opacity: 0.9 }, { clipPath: 'circle(75% at 50% 50%)', opacity: 0 }],
    { duration: 400, easing: 'ease-out' });
  setTimeout(() => veil.remove(), 420);
  playOn('unlock', document.getElementById('zone-card'), { size: 96 });
  try { localStorage.setItem('vfx-world-flash', String(Date.now())); } catch { /* stockage indisponible */ }
}

// --- Menus : ouverture, fermeture, onglets ---
export function panelOpenFx(panel, fresh) {
  if (calm() || !panel) return;
  pulse(panel, fresh ? 'vfx-open' : 'vfx-tab', 320);
}

// Fermeture : une copie figée du panneau s'efface (le vrai panneau est déjà caché, les clics passent).
export function panelCloseFx(panel) {
  if (calm() || !panel || panel.classList.contains('hidden')) return;
  const r = panel.getBoundingClientRect();
  if (!r.width || r.width * r.height > 2.6e6) return;
  const ghost = panel.cloneNode(true);
  ghost.removeAttribute('id');
  ghost.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
  ghost.className = 'vfx-ghost';
  Object.assign(ghost.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
  getLayer().appendChild(ghost);
  ghost.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(10px) scale(.985)' }],
    { duration: 180, easing: 'ease-in', fill: 'forwards' });
  setTimeout(() => ghost.remove(), 200);
}

// Apparition en cascade des cartes et lignes d'un panneau (après un changement d'onglet seulement).
export function cascadeFx(body) {
  if (calm() || !body) return;
  const items = [...body.querySelectorAll(':scope > *, :scope > .card > .row, .list > *, .stage-grid > *, .grid > *')]
    .filter((n) => n.offsetParent !== null).slice(0, 18);
  items.forEach((n, i) => {
    n.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }],
      { duration: 220, delay: Math.min(i * 18, 180), easing: 'ease-out', fill: 'backwards' });
  });
}

// Écran de chargement (index.html #boot) : effacé dès que l'interface est prête.
export function bootDone() {
  const boot = document.getElementById('boot');
  if (!boot) return;
  boot.classList.add('boot-out');
  setTimeout(() => boot.remove(), calm() ? 0 : 420);
}

// Fil d'actualité (toasts) : une étincelle au début du message.
export function newsFx(el) {
  if (calm() || !el) return;
  const r = el.getBoundingClientRect();
  if (r.width) play('spark', r.left + 8, r.top + r.height / 2, { size: 24 });
}

// --- Carte du monde : calque animé (nuages, brume, eau, lave, étoiles, flammes, marqueur, chemin) ---
const FLAMES = [[195, 21, 'flame'], [76, 28, 'flame'], [110, 28, 'flame'], [197, 6, 'smoke']];
const K = 3; // le calque dessine la carte (240×130) à ×3 : les sprites gardent des pixels fins
const sheetImg = {};
function img(name) {
  if (!sheetImg[name]) { sheetImg[name] = new Image(); sheetImg[name].src = sheetUrl(name); }
  return sheetImg[name];
}

function drawSprite(ctx, name, x, y, t, size, alpha = 1) {
  const s = SHEETS[name];
  const im = img(name);
  if (!s || !im.complete || !im.naturalWidth) return;
  const f = Math.floor((t / 1000) * s.fps) % s.n;
  const k = size / s.w;
  ctx.globalAlpha = alpha;
  ctx.drawImage(im, f * s.w, 0, s.w, s.h, Math.round(x - (s.w * k) / 2), Math.round(y - (s.h * k) / 2), Math.round(s.w * k), Math.round(s.h * k));
  ctx.globalAlpha = 1;
}

let map = null; // { canvas, ctx, nodes, cur, next, sel, born, raf, unlocked }

function hash(x, y) {
  const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return h - Math.floor(h);
}

function drawMap(t) {
  const { ctx, nodes } = map;
  const W = MAP_FX.w * K;
  const H = MAP_FX.h * K;
  ctx.clearRect(0, 0, W, H);
  const s = t / 1000;
  // Lave : lueur qui pulse (vague lente de proche en proche).
  for (const [x, y] of MAP_FX.lava) {
    const a = 0.5 + 0.5 * Math.sin(s * 2.2 - x * 0.09 - y * 0.05);
    if (a < 0.35) continue;
    ctx.fillStyle = `rgba(255,${170 + Math.round(70 * a)},60,${(a - 0.35) * 0.75})`;
    ctx.fillRect(x * K, y * K, K, K);
  }
  // Eau : reflets qui scintillent.
  for (const [x, y] of MAP_FX.water) {
    const ph = hash(x, y) * 6.283;
    const a = Math.sin(s * 1.6 + ph);
    if (a < 0.82) continue;
    ctx.fillStyle = `rgba(225,248,255,${(a - 0.82) * 4})`;
    ctx.fillRect(x * K, y * K + 1, K * 2, 1);
    ctx.fillRect(x * K + 1, y * K, 1, K);
  }
  // Étoiles du Néant.
  for (const [x, y] of MAP_FX.stars) {
    const a = Math.sin(s * 2.8 + hash(y, x) * 6.283);
    if (a < 0.6) continue;
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.fillRect(x * K - 1, y * K + 1, K + 2, 1);
    ctx.fillRect(x * K + 1, y * K - 1, 1, K + 2);
  }
  drawSprite(ctx, 'star', 150 * K, 30 * K + Math.sin(s) * 2, t, 16, 0.9);
  drawSprite(ctx, 'star', 138 * K, 14 * K, t + 700, 12, 0.8);
  // Flammes et fumée du volcan et de l'Abysse.
  for (const [x, y, n] of FLAMES) drawSprite(ctx, n, x * K, y * K, t + x * 37, n === 'smoke' ? 36 : 22);
  // Chemin vers le monde suivant : pointillés qui se dessinent puis défilent.
  if (map.cur >= 0 && map.next !== null) {
    const a = nodes[map.cur];
    const b = nodes[map.next];
    const p = Math.min(1, (t - map.born) / 1100);
    const ax = a.x * W; const ay = a.y * H; const bx = b.x * W; const by = b.y * H;
    const mx = (ax + bx) / 2; const my = Math.min(ay, by) - 30;
    ctx.save();
    ctx.setLineDash([6, 6]);
    ctx.lineDashOffset = -s * 14;
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(40,24,6,.75)';
    ctx.beginPath();
    let lx = ax; let ly = ay;
    ctx.moveTo(ax, ay);
    const steps = 30;
    for (let i = 1; i <= steps * p; i++) {
      const u = i / steps;
      lx = (1 - u) * (1 - u) * ax + 2 * (1 - u) * u * mx + u * u * bx;
      ly = (1 - u) * (1 - u) * ay + 2 * (1 - u) * u * my + u * u * by;
      ctx.lineTo(lx, ly);
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,222,130,.95)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
    if (p < 1) drawSprite(ctx, 'spark', lx, ly, t, 18);
  }
  // Marqueur du monde actuel : anneau qui pulse et drapeau.
  if (map.cur >= 0) {
    const n = nodes[map.cur];
    drawSprite(ctx, 'ring', n.x * W, n.y * H, t, 64, 0.85);
    drawSprite(ctx, 'flag', n.x * W + 14, n.y * H - 30, t, 28);
  }
  // Monde débloqué : halo qui s'illumine quelques secondes.
  if (map.unlocked !== null) {
    const age = t - map.unlockAt;
    if (age < 4000) {
      const n = nodes[map.unlocked];
      const g = ctx.createRadialGradient(n.x * W, n.y * H, 0, n.x * W, n.y * H, 46);
      const a = 0.55 * (1 - age / 4000) * (0.7 + 0.3 * Math.sin(age / 120));
      g.addColorStop(0, `rgba(255,240,170,${a})`);
      g.addColorStop(1, 'rgba(255,240,170,0)');
      ctx.fillStyle = g;
      ctx.fillRect(n.x * W - 46, n.y * H - 46, 92, 92);
      if (age < 1200) drawSprite(ctx, 'unlock', n.x * W, n.y * H, age, 96);
    }
  }
  // v9.2.6 (2e vague) : bateau sur l'eau du bas, oiseaux et dragon qui traversent, éruption du volcan.
  drawSprite(ctx, 'boat', ((s * 7) % (W + 80)) - 40, H - 14 + Math.sin(s * 2) * 1.5, t, 30);
  for (let i = 0; i < 2; i++) {
    const bx = ((s * (22 + i * 6) + i * 300) % (W + 120)) - 60;
    drawSprite(ctx, 'bird', bx, 60 + i * 140 + Math.sin(s * 2 + i) * 8, t + i * 200, 18);
  }
  const dc = (s % 26) / 9; // un dragon toutes les 26 s, 9 s de traversée
  if (dc < 1) drawSprite(ctx, 'dragon', -40 + dc * (W + 80), H * 0.18 + Math.sin(dc * 9) * 14, t, 42);
  const ec = (t % 9000);
  if (ec < 1500) drawSprite(ctx, 'eruption', 195 * K, 16 * K, ec, 72);
  // Brume basse puis nuages qui dérivent (par-dessus tout).
  for (let i = 0; i < 3; i++) {
    const x = ((s * (6 + i * 3) + i * 260) % (W + 300)) - 150;
    const y = H * (0.35 + i * 0.22);
    const g = ctx.createRadialGradient(x, y, 4, x, y, 120);
    g.addColorStop(0, 'rgba(235,240,255,.16)');
    g.addColorStop(1, 'rgba(235,240,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 120, y - 60, 240, 120);
  }
  for (let i = 0; i < 4; i++) {
    const x = ((s * (9 + i * 4) + i * 190) % (W + 160)) - 80;
    drawSprite(ctx, 'cloud', x, 40 + ((i * 97) % (H - 80)), t + i * 400, 72 + (i % 2) * 24, 0.82);
  }
  // Transition au changement de monde choisi : anneau sur la pastille choisie.
  if (map.sel !== null && t - map.selAt < 500) drawSprite(ctx, 'ring', nodes[map.sel].x * W, nodes[map.sel].y * H, t - map.selAt, 72);
}

function loop(t) {
  if (!map?.canvas.isConnected || document.hidden) { map && (map.raf = 0); return; }
  map.aliveAt = performance.now();
  if (t - (map.last ?? 0) >= 33) { map.last = t; drawMap(t); }
  map.raf = requestAnimationFrame(loop);
}

// Appelé après chaque rendu du panneau Carte : `cur` = monde actuel (‑1 s'il n'est pas du cycle affiché),
// `last` = dernier monde ouvert, `sel` = monde choisi.
export function attachMap(host, nodes, { cur, last, sel }) {
  if (!host) return;
  if (!map) {
    const canvas = document.createElement('canvas');
    canvas.className = 'map-fx';
    canvas.width = MAP_FX.w * K;
    canvas.height = MAP_FX.h * K;
    canvas.setAttribute('aria-hidden', 'true');
    map = { canvas, ctx: canvas.getContext('2d'), nodes, raf: 0, born: performance.now(), sel: null, selAt: 0, cur: -1, next: null, unlocked: null };
  }
  map.nodes = nodes;
  if (map.sel !== null && map.sel !== sel) map.selAt = performance.now();
  if (map.canvas.parentElement !== host) {
    // Panneau redessiné (nouvel hôte) : le chemin ne se redessine qu'à une vraie réouverture de la carte.
    if (performance.now() - (map.aliveAt ?? 0) > 600) map.born = performance.now();
    host.querySelector('img')?.after(map.canvas);
  }
  map.sel = sel;
  map.cur = cur;
  map.next = cur >= 0 && cur + 1 < nodes.length ? cur + 1 : null;
  // Monde nouvellement ouvert depuis la dernière visite de la carte : il s'illumine.
  let seen = last;
  try { seen = Number(localStorage.getItem('vfx-map-seen') ?? last); localStorage.setItem('vfx-map-seen', String(last)); } catch { /* sans stockage */ }
  if (last > seen) { map.unlocked = last; map.unlockAt = performance.now(); }
  if (calm()) { cancelAnimationFrame(map.raf); map.raf = 0; drawMap(0); return; }
  if (!map.raf) map.raf = requestAnimationFrame(loop);
}

// ===== v9.2.6 (2e vague) =====
// Taille des pièces qui volent : plus grandes sur grand écran (lisibles en 1280×720 et plus).
export const coinSize = () => (globalThis.innerWidth >= 900 ? 28 : 18);

// Boucle calée sur l'horloge : un panneau redessiné ne fait pas repartir l'animation de zéro.
function syncLoop(el) {
  const a = el?.getAnimations?.()[0];
  if (a) a.currentTime = performance.now() % (a.effect.getTiming().duration || 1000);
}

// Sprite en boucle posé dans un conteneur (fiches, panneaux) : centré, derrière ou devant le contenu.
export function attachLoop(host, name, { size, cls = '', back = true, inset = null } = {}) {
  if (calm() || !host || host.querySelector(`:scope > .uvfx-loop.${name}`)) return null;
  const el = sprite(name, { size, loops: Infinity, parent: host, cls: `uvfx-loop ${name} ${back ? 'uvfx-back' : 'uvfx-front'} ${cls}` });
  if (!el) return null;
  if (inset !== null) { el.style.inset = inset; el.style.width = 'auto'; el.style.height = 'auto'; }
  syncLoop(el);
  return el;
}

// --- Icônes animées des menus et sous-onglets (PixelLab) : au survol, et en boucle sur l'onglet choisi ---
function iconLayer(img) {
  const name = img?.dataset.icon;
  if (!name || !SHEETS[`ic_${name}`]) return null;
  let el = img.previousElementSibling;
  if (!el?.classList.contains('ic-anim')) {
    el = sprite(`ic_${name}`, { size: img.offsetWidth || 16, loops: Infinity, parent: img.parentElement, cls: 'ic-anim' });
    if (!el) return null;
    img.before(el);
    el.getAnimations()[0]?.pause();
  }
  Object.assign(el.style, { left: `${img.offsetLeft}px`, top: `${img.offsetTop}px`, width: `${img.offsetWidth}px`, height: `${img.offsetHeight}px` });
  return el;
}

function setIcon(btn, on) {
  const img = btn?.querySelector('img[data-icon]');
  if (!img) return;
  if (calm()) { img.previousElementSibling?.classList.contains('ic-anim') && img.previousElementSibling.remove(); return; }
  const el = iconLayer(img);
  if (!el) return;
  const a = el.getAnimations()[0];
  el.classList.toggle('on', on);
  if (on) { syncLoop(el); a?.play(); } else a?.pause();
}

const iconHost = (t) => t?.closest?.('#tabs button, #panel-subtabs .subtab');
export function initIcons(root) {
  root.addEventListener('pointerover', (e) => { const b = iconHost(e.target); if (b) setIcon(b, true); });
  root.addEventListener('pointerout', (e) => {
    const b = iconHost(e.target);
    if (b && !b.contains(e.relatedTarget)) setIcon(b, b.classList.contains('active'));
  });
}

export function syncIcons(root) {
  root?.querySelectorAll('#tabs button, #panel-subtabs .subtab').forEach((b) => setIcon(b, b.classList.contains('active')));
}

// --- Ressources du haut : la gemme scintille de temps en temps, l'or brille quand il augmente ---
let lastGold = null;
let goldShineAt = 0;
export function resourcesFx(state) {
  if (!state) return;
  const now = performance.now();
  if (lastGold !== null && state.gold > lastGold && now - goldShineAt > 2600 && !calm() && !document.hidden) {
    goldShineAt = now;
    const ic = document.querySelector('#topbar [data-currency="gold"] img');
    if (ic?.offsetWidth) playOn('gold_shine', ic, { size: 40 });
  }
  lastGold = state.gold;
}
let twinkle = 0;
export function startAmbient() {
  if (twinkle) return;
  twinkle = setInterval(() => {
    if (calm() || document.hidden) return;
    const ic = document.querySelector('#topbar [data-currency="gems"] img');
    if (ic?.offsetWidth) {
      const r = ic.getBoundingClientRect();
      play('gem_twinkle', r.left + r.width * (0.3 + Math.random() * 0.4), r.top + r.height * (0.25 + Math.random() * 0.4), { size: 20 });
    }
  }, 3600);
}

// Bonus de vitesse : petite flamme accrochée au bouton de vitesse tant qu'il est actif.
export function speedFx(btn, on) {
  if (!btn) return;
  const cur = btn.querySelector(':scope > .boost_flame');
  if (!on || calm()) { cur?.remove(); return; }
  if (!cur) attachLoop(btn, 'boost_flame', { size: 30, back: false, cls: 'speed-flame' }); // flamme derrière l'éclair
}

// --- Fiches et écrans (après chaque rendu du panneau) ---
const AURA = { legendary: 'aura_legend', epic: 'aura_epic' };
const rarityOf = (el) => (el?.className.match(/\br-(common|rare|epic|legendary)\b/) ?? [])[1] ?? 'common';
export function decorate(body, tab) {
  if (calm() || !body) return;
  // Héros : aura de rareté autour du portrait choisi (Apparences) ; compagnon : aura, cadre, étoiles qui brillent.
  body.querySelectorAll('.look-card.active .look-pic').forEach((pic) => attachLoop(pic, AURA[rarityOf(pic.closest('.look-card'))] ?? 'aura_common', { size: 150 }));
  body.querySelectorAll('.pet-detail').forEach((card) => {
    const r = rarityOf(card);
    const box = card.querySelector('.pet-art-box, .pet-portrait');
    if (box) {
      attachLoop(box, AURA[r] ?? 'aura_common', { size: 160 });
      if (r === 'legendary' || r === 'epic') attachLoop(box, r === 'legendary' ? 'frame_legend' : 'frame_epic', { back: false, inset: '-6px' });
    }
    const st = card.querySelector('.stars');
    if (st && !st.querySelector('.star_shine')) { st.classList.add('uvfx-host'); attachLoop(st, 'star_shine', { size: 18, back: false, cls: 'star-glint' }); }
  });
  // Objet : cadre de rareté animé et reflet qui balaie l'objet légendaire.
  body.querySelectorAll('.item-detail .detail-head > .item-frame').forEach((fr) => {
    const r = rarityOf(fr);
    if (r === 'legendary' || r === 'epic') attachLoop(fr, r === 'legendary' ? 'frame_legend' : 'frame_epic', { back: false, inset: '-5px' });
    if (r === 'legendary') attachLoop(fr, 'sheen', { back: false, inset: '0', cls: 'sheen-slow' });
  });
  // Tour : fond de runes qui montent.
  if (tab === 'tower') { const c = [...body.querySelectorAll('.card')].find((x) => x.querySelector('[data-action="enter-tower"], [data-action="leave-tower"]')) ?? body.querySelector('.card:last-of-type'); if (c) { c.classList.add('uvfx-host'); attachLoop(c, 'tower_bg', { inset: '0', cls: 'tower-bg' }); } }
}

// Étage de la Tour franchi : flèche de lumière sur la scène.
export function stageFx(name, size = 160) {
  const area = document.getElementById('stage-area');
  if (!area?.offsetWidth) return;
  const r = area.getBoundingClientRect();
  play(name, r.left + r.width / 2, r.top + r.height * 0.45, { size });
}

// Grande animation dédiée (Renaissance, Transcendance) : plein écran, sans bloquer les clics.
export function bigFx(name, tint) {
  if (calm()) return;
  const s = Math.min(innerWidth, innerHeight) * 0.9;
  const veil = document.createElement('div');
  veil.className = 'vfx-big-veil';
  veil.style.setProperty('--tint', tint);
  getLayer().appendChild(veil);
  veil.animate([{ opacity: 0 }, { opacity: 0.85, offset: 0.2 }, { opacity: 0 }], { duration: 1600, easing: 'ease-out' });
  setTimeout(() => veil.remove(), 1650);
  play(name, innerWidth / 2, innerHeight / 2, { size: Math.round(s / 160) * 160 || 160 });
  play('burst', innerWidth / 2, innerHeight / 2, { size: 256 });
}

// Retour hors ligne : coffre qui s'ouvre dans la fenêtre, pièces qui pleuvent puis volent vers le compteur.
export function offlineFx(modal) {
  if (calm() || !modal) return;
  requestAnimationFrame(() => {
    const h = modal.querySelector('h2') ?? modal;
    const r = h.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.bottom + 30;
    play('chest', x, y, { size: 128 });
    setTimeout(() => play('coin_rain', x, y + 20, { size: 192 }), 500);
    const g = modal.querySelector('.offline-gains');
    setTimeout(() => flyTo('gold', g ?? [x, y], document.querySelector('#topbar [data-currency="gold"] span'), 10), 1100);
  });
}

// Talent appris : le nœud s'illumine et des éclats courent le long de ses liens.
export function talentFx(el) {
  if (calm() || !el) return;
  playOn('talent_node', el, { size: 96 });
  const svg = el.closest('.rune-tree')?.querySelector('svg');
  if (!svg) return;
  const [cx, cy] = center(el);
  const sr = svg.getBoundingClientRect();
  const vb = svg.viewBox.baseVal;
  const toPx = (x, y) => [sr.left + ((x - vb.x) / vb.width) * sr.width, sr.top + ((y - vb.y) / vb.height) * sr.height];
  let n = 0;
  for (const l of svg.querySelectorAll('line')) {
    const a = toPx(+l.getAttribute('x1'), +l.getAttribute('y1'));
    const b = toPx(+l.getAttribute('x2'), +l.getAttribute('y2'));
    const near = (p) => Math.hypot(p[0] - cx, p[1] - cy) < 18;
    const [from, to] = near(a) ? [a, b] : near(b) ? [b, a] : [null, null];
    if (!from || n++ >= 4) continue;
    const sp = sprite('talent_spark', { size: 16, loops: Infinity });
    if (!sp) return;
    sp.style.left = `${from[0] - 8}px`;
    sp.style.top = `${from[1] - 8}px`;
    sp.animate([{ transform: 'translate(0,0)', opacity: 1 }, { transform: `translate(${to[0] - from[0]}px, ${to[1] - from[1]}px)`, opacity: 0.2 }],
      { duration: 700, easing: 'ease-in', fill: 'forwards' });
    setTimeout(() => sp.remove(), 720);
  }
}
