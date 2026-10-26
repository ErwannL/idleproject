// Effets visuels d'équipe (v8.1), dessinés en primitives pixel sur la scène :
// - boosts actifs (Rage, Frénésie, Midas, Œil du chasseur, Lame fantôme) : on VOIT qu'ils tournent ;
// - synergies actives : Bénédiction = halo de lumière au-dessus du chevalier, Pluie de feu = flèches
//   enflammées qui tombent sur les ennemis, Forteresse = dôme protecteur, etc.
import { SYNERGY_FX } from '../data/synergies.js';
import { activeSynergies } from '../core/companions.js';

const px = (ctx, x, y, w, h, color) => { ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
// Petit hachage déterministe pour des positions « aléatoires » stables.
const hash = (n) => { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); };

function frontEnemyX(scene, world) {
  let best = null;
  for (const e of world.enemies) if (!best || e.x < best.x) best = e;
  return best ? scene.wx(best.x) : null;
}

// --- Boosts ---------------------------------------------------------------
function rageFx(ctx, t, hx, g) {
  // Flammes rouges qui montent autour du chevalier.
  ctx.globalAlpha = 0.22 + 0.08 * Math.sin(t * 9);
  px(ctx, hx - 15, g - 40, 30, 40, '#ff3a2a');
  for (let i = 0; i < 18; i++) {
    const phase = (t * 1.4 + hash(i)) % 1;
    const x = hx - 16 + hash(i + 3) * 32 + Math.sin(t * 6 + i) * 2;
    const y = g - 2 - phase * 46;
    const c = phase < 0.35 ? '#fff0a0' : phase < 0.6 ? '#ffb02a' : phase < 0.85 ? '#ff5a2a' : '#c0283a';
    const size = phase < 0.5 ? 3 : 2;
    ctx.globalAlpha = Math.min(1, 1.3 - phase);
    px(ctx, x, y, size, size + 1, c);
  }
  ctx.globalAlpha = 1;
}

function frenzyFx(ctx, t, hx, g) {
  // Éclairs jaunes et traits de vitesse derrière le chevalier.
  for (let i = 0; i < 7; i++) {
    const phase = (t * 3 + i / 7) % 1;
    ctx.globalAlpha = 0.9 * (1 - phase);
    px(ctx, hx - 18 - phase * 26, g - 6 - i * 6, 12, 2, '#ffe680');
  }
  if (Math.floor(t * 8) % 3 === 0) {
    const x = hx - 12 + hash(Math.floor(t * 8)) * 24;
    ctx.globalAlpha = 1;
    for (let k = 0; k < 6; k++) px(ctx, x + (k % 2 ? 2 : -2), g - 50 + k * 5, 2, 6, k % 2 ? '#ffd23f' : '#fff6b0');
  }
  ctx.globalAlpha = 1;
}

function midasFx(ctx, t, hx, g) {
  // Pièces d'or qui tournent autour du chevalier et scintillent.
  for (let i = 0; i < 7; i++) {
    const a = t * 2.2 + (i * Math.PI * 2) / 7;
    const x = hx + Math.cos(a) * 22;
    const y = g - 22 + Math.sin(a) * 8;
    const front = Math.sin(a) > 0;
    ctx.globalAlpha = front ? 1 : 0.55;
    const w = Math.abs(Math.cos(t * 6 + i)) > 0.5 ? 5 : 2;
    px(ctx, x - w / 2, y - 2, w, 5, '#c98a1a');
    px(ctx, x - w / 2, y - 2, Math.max(1, w - 1), 4, '#f2b330');
    px(ctx, x - w / 2, y - 2, 1, 1, '#fff2a0');
  }
  if (Math.floor(t * 6) % 2) { ctx.globalAlpha = 1; px(ctx, hx - 20 + hash(Math.floor(t * 6)) * 40, g - 44 + hash(Math.floor(t * 6) + 1) * 30, 2, 2, '#fffbe0'); }
  ctx.globalAlpha = 1;
}

function hunterFx(ctx, t, ex, g) {
  if (ex === null) return;
  // Viseur bleu qui se resserre sur l'ennemi de tête.
  const r = 13 + Math.sin(t * 5) * 3;
  const y = g - 16;
  ctx.globalAlpha = 0.95;
  for (const [dx, dy, w, h] of [[-r, 0, 6, 2], [r - 5, 0, 6, 2], [0, -r, 2, 6], [0, r - 5, 2, 6]]) px(ctx, ex + dx, y + dy, w, h, '#6fd6ff');
  for (const [dx, dy] of [[-r, -r], [r - 3, -r], [-r, r - 1], [r - 3, r - 1]]) px(ctx, ex + dx, y + dy, 4, 2, '#3fa6e0');
  px(ctx, ex, y, 2, 2, '#ffffff');
  ctx.globalAlpha = 1;
}

function phantomFx(ctx, t, hx, g) {
  // Lames spectrales violettes en orbite.
  for (let i = 0; i < 3; i++) {
    const a = t * 4 + (i * Math.PI * 2) / 3;
    const x = hx + Math.cos(a) * 24;
    const y = g - 24 + Math.sin(a) * 12;
    ctx.globalAlpha = 0.85;
    px(ctx, x - 6, y, 13, 2, '#e8d4ff');
    px(ctx, x - 7, y - 1, 3, 4, '#b07bff');
    ctx.globalAlpha = 0.35;
    px(ctx, x - 6 - Math.cos(a) * 6, y - Math.sin(a) * 4, 10, 2, '#b07bff');
  }
  ctx.globalAlpha = 1;
}

const BOOST_FX = { rage: rageFx, frenzy: frenzyFx, midas: midasFx, phantom: phantomFx };

// --- Synergies --------------------------------------------------------------
function haloFx(ctx, t, hx, g) {
  // Halo doré au-dessus du chevalier + colonne de lumière douce.
  const y = g - 45 + Math.round(Math.sin(t * 2) * 1);
  ctx.globalAlpha = 0.18 + 0.06 * Math.sin(t * 3);
  px(ctx, hx - 7, y, 14, 48, '#fff2b0');
  ctx.globalAlpha = 1;
  px(ctx, hx - 7, y, 14, 2, '#ffe680');
  px(ctx, hx - 9, y + 1, 2, 2, '#ffe680');
  px(ctx, hx + 7, y + 1, 2, 2, '#ffe680');
  px(ctx, hx - 7, y + 3, 14, 1, '#d9a930');
  px(ctx, hx - 2 + Math.round(Math.sin(t * 4) * 5), y, 3, 1, '#ffffff');
  for (let i = 0; i < 4; i++) {
    const phase = (t * 0.7 + i / 4) % 1;
    ctx.globalAlpha = 1 - phase;
    px(ctx, hx - 10 + hash(i + 5) * 20, y + 8 + phase * 36, 1, 2, '#fff6c0');
  }
  ctx.globalAlpha = 1;
}

function domeFx(ctx, t, hx, g) {
  // Dôme protecteur bleu (pointillés qui tournent).
  ctx.globalAlpha = 0.55;
  for (let i = 0; i < 24; i++) {
    const a = Math.PI + (i / 23) * Math.PI;
    if ((i + Math.floor(t * 8)) % 3 === 0) continue;
    px(ctx, hx - 6 + Math.cos(a) * 34, g + Math.sin(a) * 30, 2, 2, '#7fb0ff');
  }
  ctx.globalAlpha = 1;
}

function fireRainFx(ctx, t, ex, g, arrows) {
  if (ex === null) return;
  // Flèches enflammées qui tombent en diagonale sur les ennemis.
  for (let i = 0; i < 5; i++) {
    const cycle = t * 1.3 + i * 0.37;
    const phase = cycle % 1;
    const seed = Math.floor(cycle) * 7 + i;
    const tx = ex - 6 + hash(seed) * 40;
    const x = tx - 30 * (1 - phase);
    const y = g - 70 + phase * 66;
    if (phase > 0.95) {
      px(ctx, tx - 2, g - 3, 5, 2, arrows ? '#d6f0ff' : '#ffd23f');
      continue;
    }
    for (let k = 0; k < 4; k++) px(ctx, x - k, y - k, 1, 1, k === 0 ? '#ffffff' : arrows ? '#a0c8e8' : (k < 2 ? '#ffd23f' : '#ff5a2a'));
    if (!arrows) { ctx.globalAlpha = 0.6; px(ctx, x - 5, y - 5, 2, 2, '#ff8a2a'); ctx.globalAlpha = 1; }
  }
}

function shadowStrikeFx(ctx, t, ex, g) {
  if (ex === null) return;
  // Toutes les ~2 s, une ombre traverse l'ennemi de tête (trait violet + éclat).
  const phase = (t % 2.2) / 0.35;
  if (phase > 1) return;
  ctx.globalAlpha = 1 - phase;
  px(ctx, ex - 14 + phase * 28, g - 18 + phase * 6, 10, 1, '#c8a0ff');
  px(ctx, ex - 1, g - 16, 3, 3, '#ffffff');
  ctx.globalAlpha = 1;
}

function markFx(ctx, t, ex, g) {
  if (ex === null) return;
  // Marque rouge qui flotte au-dessus de la cible.
  const y = g - 46 + Math.round(Math.sin(t * 4) * 2);
  px(ctx, ex - 2, y, 5, 1, '#ff4a4a');
  px(ctx, ex - 1, y + 1, 3, 1, '#ff4a4a');
  px(ctx, ex, y + 2, 1, 1, '#ff4a4a');
}

function runeCircleFx(ctx, t, hx, g) {
  // Cercle de runes violettes sous l'équipe.
  for (let i = 0; i < 16; i++) {
    const a = t * 0.8 + (i / 16) * Math.PI * 2;
    ctx.globalAlpha = 0.45 + 0.35 * Math.sin(t * 3 + i);
    px(ctx, hx - 14 + Math.cos(a) * 24, g + 1 + Math.sin(a) * 3, 2, 1, i % 4 ? '#c06bff' : '#f0d8ff');
  }
  ctx.globalAlpha = 1;
}

function bladesFx(ctx, t, ex, g) {
  if (ex === null) return;
  // Tourbillon de lames autour de l'ennemi de tête.
  for (let i = 0; i < 4; i++) {
    const a = t * 7 + (i * Math.PI) / 2;
    ctx.globalAlpha = 0.7;
    px(ctx, ex + Math.cos(a) * 12 - 2, g - 14 + Math.sin(a) * 8, 5, 1, '#e8eef8');
  }
  ctx.globalAlpha = 1;
}

function emberFx(ctx, t, hx, g) {
  // Braises rouges qui volent derrière l'équipe.
  for (let i = 0; i < 6; i++) {
    const phase = (t * 0.8 + hash(i + 11)) % 1;
    ctx.globalAlpha = 1 - phase;
    px(ctx, hx - 30 + hash(i) * 30 - phase * 10, g - 4 - phase * 28, 1, 1, i % 2 ? '#ff6a2a' : '#ffb03a');
  }
  ctx.globalAlpha = 1;
}

// Dessine tous les effets (appelé par SceneRenderer.render, après le héros).
export function drawTeamFx(scene, ctx, state, world, heroX) {
  if (world.hero.dead) return;
  const t = scene.time;
  const g = scene.groundY;
  const ex = frontEnemyX(scene, world);
  const lite = scene.focus; // mode concentration : effets réduits
  for (const id of Object.keys(state.rushes?.active ?? {})) {
    if (id === 'hunter') hunterFx(ctx, t, ex, g);
    else BOOST_FX[id]?.(ctx, t, heroX, g);
  }
  if (lite) return;
  const kinds = new Set(activeSynergies(state).map((s) => SYNERGY_FX[s.id]).filter(Boolean));
  for (const kind of kinds) {
    if (kind === 'halo') haloFx(ctx, t, heroX, g);
    else if (kind === 'dome') domeFx(ctx, t, heroX, g);
    else if (kind === 'fire_rain') fireRainFx(ctx, t, ex, g, false);
    else if (kind === 'arrow_rain') fireRainFx(ctx, t + 0.5, ex, g, true);
    else if (kind === 'shadow_strike') shadowStrikeFx(ctx, t, ex, g);
    else if (kind === 'mark') markFx(ctx, t, ex, g);
    else if (kind === 'rune_circle') runeCircleFx(ctx, t, heroX, g);
    else if (kind === 'blades') bladesFx(ctx, t, ex, g);
    else if (kind === 'ember') emberFx(ctx, t, heroX, g);
  }
}
