// v9.2.6 : effets visuels de l'interface (menus, récompenses, forge, invocation, carte du monde, chargement).
// Planches pixel art animées générées avec PixelLab (tools/art/pixellab_ui_vfx.py → assets/ui/vfx/<nom>.webp,
// catalogue ./ui-vfx-sheets.js) ; transitions en CSS (style.css, bloc « v9.2.6 : VFX »).
// Règles : rien ne capte un clic (calque pointer-events: none), menus ≤ 400 ms, un nombre d'effets borné,
// et rien du tout en « Réduire les animations » / prefers-reduced-motion (classe .reduce-motion posée par ui.js).
import { MAP_FX, SHEETS } from './ui-vfx-sheets.js';
import { CURRENCIES, currencyAmount } from '../data/currencies.js';
import { formatNumber, icon as iconUrl } from './common.js';
import { talentById, talentUnlocked } from '../core/rebirth.js';

const MAX_LIVE = 48; // effets simultanés au plus (une avalanche de clics ne ralentit pas l'interface)
let layer = null;
let live = 0;

export function calm() {
  if (typeof document === 'undefined') return true;
  return document.documentElement.classList.contains('reduce-motion')
    || document.body.classList.contains('hold-repeating');
}

function getLayer() {
  // v9.2.7 : l'interface peut être agrandie (zoom CSS sur <html>, ex. 1920×1080) alors que les positions viennent de
  // getBoundingClientRect (pixels à l'écran) : le calque annule ce zoom, sinon les effets tombaient à côté.
  const z = parseFloat(document.documentElement.style.zoom) || 1;
  if (layer?.isConnected) { layer.style.zoom = z === 1 ? '' : String(1 / z); return layer; }
  layer = document.createElement('div');
  layer.id = 'ui-vfx';
  layer.setAttribute('aria-hidden', 'true');
  document.body.appendChild(layer);
  if (z !== 1) layer.style.zoom = String(1 / z);
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
    { duration: dur, iterations: loops, easing: `steps(${Math.max(2, s.n)}, jump-none)` }); // v9.2.7 : n paliers (avant n − 1 : images à cheval sur deux cases)
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
export function flyTo(kind, from, target, count = 6, label = null) {
  if (calm() || !target?.isConnected) return;
  const host = target.closest?.('.chip') ?? target;
  const [tx, ty, tr] = center(host.querySelector?.('img') ?? host);
  if (!tr.width) return;
  const [fx, fy] = Array.isArray(from) ? from : center(from);
  const n = Math.max(1, Math.min(count, 10, MAX_LIVE - live));
  const sheet = kind === 'gems' ? 'gem' : kind === 'gold' ? 'coin' : null;
  const sz = coinSize();
  let arrived = 0;
  for (let i = 0; i < n; i++) {
    let el;
    if (sheet) el = sprite(sheet, { size: sz, loops: Infinity, speed: 1.6 });
    else {
      el = document.createElement('img');
      el.className = 'uvfx uvfx-cur';
      el.src = iconUrl(CURRENCIES[kind]?.icon ?? 'coin');
      Object.assign(el.style, { width: `${sz}px`, height: `${sz}px` });
      getLayer().appendChild(el);
    }
    if (!el) return;
    live += 1;
    const ox = fx + (Math.random() - 0.5) * 30;
    const oy = fy + (Math.random() - 0.5) * 14;
    el.style.left = `${ox - sz / 2}px`;
    el.style.top = `${oy - sz / 2}px`;
    const dx = tx - ox;
    const dy = ty - oy;
    const bend = (Math.random() - 0.5) * 60;
    el.animate([
      { transform: 'translate(0,0) scale(.5)', opacity: 0 },
      { transform: `translate(${bend * 0.3}px, -18px) scale(1.1)`, opacity: 1, offset: 0.18 },
      { transform: `translate(${dx * 0.5 + bend}px, ${dy * 0.5 - 30}px) scale(1)`, opacity: 1, offset: 0.6 },
      { transform: `translate(${dx}px, ${dy}px) scale(.6)`, opacity: 0.85 },
    ], { duration: 640, delay: i * 50, easing: 'cubic-bezier(.4,0,.6,1)', fill: 'both' });
    setTimeout(() => {
      el.remove();
      live -= 1;
      arrived += 1;
      if (arrived === 1) {
        pulse(host, 'vfx-counter', 700);
        if (label) countText(label, host, kind);
      }
    }, 690 + i * 50); // minuterie plutôt que onfinish : l'effet se retire toujours (onglet en arrière-plan…)
  }
}

const CUR_COLOR = { gold: '#ffd45a', gems: '#8fe6ff', fragments: '#d6b8ff', shards: '#9fe0ff', keys: '#ffcf7a', stars: '#fff1a8' };
// « +N » sous le compteur (il reste lisible 1,2 s).
function countText(text, host, kind) {
  const r = host.getBoundingClientRect();
  const el = document.createElement('b');
  el.className = 'uvfx-num uvfx-count';
  el.textContent = text;
  el.style.left = `${r.left + r.width / 2}px`;
  el.style.top = `${r.bottom + 2}px`;
  el.style.color = CUR_COLOR[kind] ?? '#ffe28a';
  getLayer().appendChild(el);
  el.animate([{ transform: 'translate(-50%,-6px)', opacity: 0 }, { transform: 'translate(-50%,0)', opacity: 1, offset: 0.15 },
    { transform: 'translate(-50%,0)', opacity: 1, offset: 0.75 }, { transform: 'translate(-50%,4px)', opacity: 0 }], { duration: 1300, easing: 'ease-out' });
  setTimeout(() => el.remove(), 1320);
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
// v9.2.7 : exporté pour « Tout récupérer » de la barre du bas (sans data-action).
export function snap(state) {
  if (!state) return null;
  return {
    gold: state.gold, gems: state.gems, shards: state.materials?.shards ?? 0, inv: state.inventory?.length ?? 0,
    stash: state.stash?.length ?? 0, next: state.nextItemId ?? 0, lvl: state.level ?? 0,
    eq: Object.values(state.equipment ?? {}).map((i) => i?.id ?? '').join(),
    ach: Object.keys(state.achievements?.claimed ?? {}).length,
    cur: Object.fromEntries(Object.keys(CURRENCIES).map((k) => { const v = currencyAmount(state, k); return [k, typeof v === 'number' ? v : 0]; })),
  };
}

const CLAIM_BIG = new Set(['claim-everything', 'claim-all', 'claim-all-expeditions', 'claim-all-events']);
const CHEST = new Set(['claim-event', 'claim-mission-bonus']); // récupérations sans préfixe « claim »
const FORGE = new Set(['upgrade-item', 'reforge', 'target-reroll', 'craft', 'upgrade-companion']);

export function clickFx(ui, event, run) {
  const el = event.target.closest?.('[data-action]');
  const action = el?.dataset.action;
  const before = action && !calm() ? snap(ui.state) : null;
  const tal = action?.startsWith('buy-talent') ? ui.state?.talents?.[el.dataset.key] ?? 0 : 0;
  // v9.2.7 : voisins encore fermés avant l'achat (pour faire courir la lumière vers ceux qui s'ouvrent).
  const closed = tal >= 0 && action?.startsWith('buy-talent') ? (talentById(el.dataset.key)?.links ?? []).filter((id) => !talentUnlocked(ui.state, talentById(id))) : [];
  const pt = [event.clientX, event.clientY];
  const [cx, cy] = el ? center(el) : pt;
  run();
  if (el && !el.disabled && !calm() && el.isConnected && !el.closest('.summon-fx, #tabs, #panel-subtabs')) pulse(el, 'vfx-press', 260); // v9.2.7 : pas d'éclat sur les menus
  if (!before) return;
  // v9.2.6 (2e vague) : écrans clés.
  if (action === 'enter-dungeon' && (ui.state?.dungeon)) stageFx('dungeon_portal', 192);
  else if (action === 'start-expedition') play('depart', cx, cy, { size: 96 });
  else if ((action === 'buy-talent' || action === 'buy-talent-max') && (ui.state?.talents?.[el.dataset.key] ?? 0) > tal) {
    talentFx(el.dataset.key, closed.filter((id) => talentUnlocked(ui.state, talentById(id))));
  } else if (action === 'confirm-rebirth') bigFx('rebirth', '#ff8a3a');
  else if (action === 'confirm-transcend') bigFx('transcend', '#c9a6ff');
  const after = snap(ui.state);
  if (!after) return;
  const tint = el ? getComputedStyle(el).getPropertyValue('--rarity').trim() || null : null;
  const dg = after.gold - before.gold;
  const gold = document.querySelector('#topbar [data-currency="gold"] span') ?? document.getElementById('strip-gold');
  // v9.2.7 : récupération = seulement les monnaies qui volent vers LEUR compteur (plus de coffre, confettis ni trophée).
  if (action.startsWith('claim') || action === 'enc-claim' || CHEST.has(action)) {
    const row = el.closest('.row, li, .claim-row, .mission, .contract, .exp-card, tr');
    const src = row && row !== el && row.offsetHeight < 140 && !row.contains(document.getElementById('panel-body')) ? row : el;
    claimFly(before.cur, after.cur, src.isConnected ? src : [cx, cy], CLAIM_BIG.has(action));
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
      if (dg > 0) flyTo('gold', [cx, cy], gold, 4, `+${formatNumber(dg)}`);
    }
  } else gainFx(el, action, before, after, cx, cy);
}

// v9.3.9 (2.4) : tout autre bouton qui dépense ou gagne — éclat, « Niv. N ! » ou « +1 » qui monte, monnaies gagnées
// qui volent vers leur compteur. Le niveau est relu sur la ligne redessinée (même bouton, même clé).
const LEVEL_RE = /(?:Niv\.?|Nv\.?|Lv\.?|niveau)\s*(\d[\d\s ]*)/i;
function gainFx(el, action, before, after, cx, cy) {
  if (!el || !action) return;
  const spent = Object.keys(after.cur).some((k) => after.cur[k] < before.cur[k]) || after.gold < before.gold;
  const gained = Object.keys(after.cur).some((k) => after.cur[k] > before.cur[k]);
  if (gained) claimFly(before.cur, after.cur, el.isConnected ? el : [cx, cy]);
  if (!spent && after.lvl === before.lvl) return;
  dispatchEvent(new CustomEvent('idle-sfx', { detail: 'upgrade' }));
  const key = el.dataset.key ?? el.dataset.value ?? el.dataset.id ?? '';
  requestAnimationFrame(() => {
    const sel = `[data-action="${CSS.escape(action)}"]${key ? `[data-${el.dataset.key !== undefined ? 'key' : el.dataset.value !== undefined ? 'value' : 'id'}="${CSS.escape(key)}"]` : ''}`;
    const now = el.isConnected ? el : document.querySelector(sel);
    const row = now?.closest('.row, li, .upg-row, .skill-card, .card, .detail, .modal-card, tr');
    const m = row && row.textContent.match(LEVEL_RE);
    const [x, y] = now ? center(now) : [cx, cy];
    if (now) pulse(now, 'vfx-shine', 600);
    if (row && row !== now) pulse(row, 'vfx-row', 500);
    floatText(m ? `Niv. ${m[1].trim()} !` : '+1', x, y - 18, m ? '#9cff8a' : '#ffe28a');
  });
}

// v9.3.9 (2.4) : un bouton qui ne peut pas agir tremble et dit pourquoi (« Il manque 2 Grimoires »).
export function deniedFx(target) {
  const btn = target?.closest?.('button:disabled, .btn[aria-disabled="true"]');
  if (!btn || btn.closest('#tabs')) return;
  btn.classList.remove('vfx-deny'); void btn.offsetWidth; btn.classList.add('vfx-deny');
  dispatchEvent(new CustomEvent('idle-sfx', { detail: 'deny' }));
  setTimeout(() => btn.classList.remove('vfx-deny'), 420);
  const why = btn.dataset.why || btn.parentElement?.querySelector('.cost-missing')?.textContent?.trim() || btn.title || '';
  if (why && !calm()) { const [x, y] = center(btn); floatText(why, x, y - 16, '#ff9a8a'); }
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
  const isDeskFrame = Boolean(body.closest('#app:not(.m-phone)'));
  const items = [...body.querySelectorAll(':scope > *, :scope > .card > .row, .list > *, .stage-grid > *, .grid > *')]
    .filter((n) => n.offsetParent !== null && !(isDeskFrame && n.classList.contains('m-frame'))).slice(0, 18); // v10.13 : sur PC le cadre du kit apparaît d'un bloc (son cartouche ne clignote pas)
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

// v9.2.7 : plus de flamme sur le bonus de vitesse (retour du joueur) ; on retire seulement celle d'une ancienne vue.
export function speedFx(btn) {
  btn?.querySelector(':scope > .boost_flame, :scope > .speed-flame')?.remove();
}

// --- Fiches et écrans (après chaque rendu du panneau) ---
const rarityOf = (el) => (el?.className.match(/\br-(common|rare|epic|legendary)\b/) ?? [])[1] ?? 'common';
export function decorate(body, tab) {
  if (calm() || !body) return;
  // v9.2.7 : plus de sprites d'aura ni de cadre posés SUR l'illustration (ils la coupaient ou la faisaient déborder) :
  // un liseré lumineux de la rareté AUTOUR de la vignette (CSS .rfx), l'illustration reste contenue.
  const ring = (el, r) => { if (el && !el.classList.contains('rfx')) el.classList.add('rfx', `rfx-${r}`); };
  body.querySelectorAll('.look-card.active .look-pic').forEach((pic) => ring(pic, rarityOf(pic.closest('.look-card'))));
  body.querySelectorAll('.pet-detail').forEach((card) => {
    ring(card.querySelector('.pet-art-box, .pet-portrait'), rarityOf(card));
    const st = card.querySelector('.stars');
    if (st && !st.querySelector('.star_shine')) { st.classList.add('uvfx-host'); attachLoop(st, 'star_shine', { size: 18, back: false, cls: 'star-glint' }); }
  });
  body.querySelectorAll('.item-detail .detail-head > .item-frame').forEach((fr) => ring(fr, rarityOf(fr)));
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

// v9.2.7 : compteur d'une monnaie à l'écran (barre du haut, sinon icône visible dans l'en-tête du panneau).
function counterOf(kind) {
  const top = document.querySelector(`#topbar [data-currency="${kind}"]`);
  if (top?.offsetWidth) return top;
  const icon = CURRENCIES[kind]?.icon;
  const alt = icon && [...document.querySelectorAll(`#panel-head img[src*="${icon}."], #panel-title img[src*="${icon}."], #topbar img[src*="${icon}."]`)].find((n) => n.offsetWidth);
  return alt ? alt.parentElement : null;
}
// Monnaies gagnées : chacune vole de la source vers son compteur, qui s'illumine, avec un « +N » clair dessous.
export function claimFly(before, after, from, big = false) {
  if (calm() || !before || !after) return;
  let k = 0;
  for (const kind of Object.keys(CURRENCIES)) {
    const d = (after[kind] ?? 0) - (before[kind] ?? 0);
    if (!(d > 0)) continue;
    const target = counterOf(kind);
    if (!target) continue;
    const delay = k++ * 160;
    setTimeout(() => flyTo(kind, from, target, big ? 9 : 6, `+${formatNumber(d)}`), delay);
  }
}

// Retour hors ligne (v9.2.7) : seulement les pièces qui volent des gains vers le compteur d'or (plus de coffre).
export function offlineFx(modal, before = null, after = null) {
  if (calm() || !modal) return;
  requestAnimationFrame(() => {
    const g = modal.querySelector('.offline-gains') ?? modal.querySelector('h2') ?? modal;
    setTimeout(() => {
      if (before && after) claimFly(before, after, g, true);
      else flyTo('gold', g, counterOf('gold'), 9);
    }, 350);
  });
}

// v9.2.7 : talent appris — anneau doux EXACTEMENT sur le nœud acheté, puis une lumière court le long de chaque lien
// vers les talents qui s'ouvrent, qui s'éclairent à son arrivée. Dessiné sur un canvas posé sur la fenêtre de l'arbre
// et recalculé à chaque image depuis la position réelle des nœuds (zoom, défilement et rendu du panneau compris).
const nodeEl = (id) => document.querySelector(`#panel-body .rune-tree .tnode[data-value="${CSS.escape(id)}"]`);
export function talentFx(id, opened = []) {
  if (calm() || !id) return;
  const cv = document.createElement('canvas');
  cv.className = 'tfx-canvas';
  getLayer().appendChild(cv);
  const ctx = cv.getContext('2d');
  const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
  const T_RING = 520;
  const T_TRAVEL = 560;
  const END = T_RING * 0.5 + T_TRAVEL + 520;
  const t0 = performance.now();
  let scrolled = false;
  const frame = (now) => {
    const t = now - t0;
    const vp = document.querySelector('#panel-body .tree-viewport');
    const node = nodeEl(id);
    if (!vp || !node || t > END) { cv.remove(); return; }
    if (!node._b) { node._b = true; pulse(node, 'tfx-bought', 520); }
    const vr = vp.getBoundingClientRect();
    // Le nœud hors de la fenêtre (achat depuis la barre après un défilement) : on le ramène au centre d'abord.
    const nr = node.getBoundingClientRect();
    if (!scrolled && (nr.right < vr.left || nr.left > vr.right || nr.bottom < vr.top || nr.top > vr.bottom)) {
      scrolled = true;
      vp.scrollTo({ left: vp.scrollLeft + nr.left + nr.width / 2 - vr.left - vr.width / 2, top: vp.scrollTop + nr.top + nr.height / 2 - vr.top - vr.height / 2, behavior: 'smooth' });
    }
    if (cv.width !== Math.round(vr.width * dpr) || cv.height !== Math.round(vr.height * dpr)) { cv.width = Math.round(vr.width * dpr); cv.height = Math.round(vr.height * dpr); }
    Object.assign(cv.style, { left: `${vr.left}px`, top: `${vr.top}px`, width: `${vr.width}px`, height: `${vr.height}px` });
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, vr.width, vr.height);
    // Coupé à la partie visible de la fenêtre (le panneau peut en masquer le haut ou le bas).
    const pb = document.getElementById('panel-body')?.getBoundingClientRect() ?? vr;
    const cy0 = Math.max(0, pb.top - vr.top);
    const cy1 = Math.min(vr.height, pb.bottom - vr.top);
    cv.style.clipPath = `inset(${cy0}px 0 ${Math.max(0, vr.height - cy1)}px 0)`;
    const c = (el) => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2 - vr.left, r.top + r.height / 2 - vr.top, r.width / 2]; };
    const [x, y, rad] = c(node);
    const color = getComputedStyle(node).getPropertyValue('--branch').trim() || '#ffe08a';
    ctx.globalCompositeOperation = 'lighter';
    // 1. Anneau qui s'ouvre et halo sur le nœud.
    if (t < T_RING) {
      const k = t / T_RING;
      const e = 1 - (1 - k) ** 3;
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad * 2.6);
      g.addColorStop(0, `rgba(255,250,225,${0.55 * (1 - k)})`);
      g.addColorStop(1, 'rgba(255,250,225,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, rad * 2.6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = color; ctx.globalAlpha = 1 - k; ctx.lineWidth = 3 * (1 - k) + 1;
      ctx.beginPath(); ctx.arc(x, y, rad * (1 + 1.4 * e), 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#fff6d6'; ctx.globalAlpha = 0.7 * (1 - k); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x, y, rad * (1 + 0.8 * e), 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // 2. Lumière le long des liens vers les talents ouverts, 3. éclat d'arrivée.
    const ts = t - T_RING * 0.5;
    if (ts > 0) {
      for (const nid of opened.slice(0, 8)) {
        const n = nodeEl(nid);
        if (!n) continue;
        const [x2, y2, r2] = c(n);
        const k = Math.min(1, ts / T_TRAVEL);
        const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
        const px = x + (x2 - x) * e;
        const py = y + (y2 - y) * e;
        const fade = ts > T_TRAVEL ? Math.max(0, 1 - (ts - T_TRAVEL) / 520) : 1;
        const lg = ctx.createLinearGradient(x, y, px, py);
        lg.addColorStop(0, 'rgba(255,255,255,0)');
        lg.addColorStop(1, color);
        ctx.strokeStyle = lg; ctx.globalAlpha = 0.9 * fade; ctx.lineWidth = Math.max(2, rad * 0.22); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(px, py); ctx.stroke();
        if (k < 1) {
          const g = ctx.createRadialGradient(px, py, 0, px, py, rad * 0.9);
          g.addColorStop(0, 'rgba(255,255,240,1)'); g.addColorStop(0.35, color); g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, rad * 0.9, 0, Math.PI * 2); ctx.fill();
        } else {
          const a = (ts - T_TRAVEL) / 520;
          ctx.globalAlpha = Math.max(0, 1 - a); ctx.strokeStyle = color; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(x2, y2, r2 * (1 + 0.9 * a), 0, Math.PI * 2); ctx.stroke();
          if (!n._lit) { n._lit = true; pulse(n, 'tfx-awake', 600); }
        }
        ctx.globalAlpha = 1;
      }
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
