// v9.2.1 : attaques sous l'eau aussi riches que sur terre. Chaque effet de combat existant (traînées d'armes, arcs
// de taille, projectiles, éléments, compétences, coups des ennemis et des boss) reçoit, dans le Royaume englouti, son
// accent aquatique : sillage de bulles derrière les projectiles, remous (tourbillon de pixels) aux impacts et aux
// arcs, colonne de bulles sous les rayons, vase soulevée au lieu de poussière, particules freinées par l'eau.
// Tout est au pixel entier ; « Réduire les animations » : seulement le freinage (pas de bulle ni de remous).
import { addBubble } from './ocean-fx.js';

const SILT = ['#5f8584', '#86aaa2', '#3f6266'];

function eddy(scene, x, y, color, r = 6, life = 0.45) {
  (scene.spawnSink ?? scene.effects).push({ kind: 'eddy', x: Math.round(x), y: Math.round(y), color, r, life, max: life, spin: Math.random() < 0.5 ? -1 : 1 });
}

function bubbleLine(scene, x0, x1, y, step = 7) {
  const [a, b] = x0 < x1 ? [x0, x1] : [x1, x0];
  for (let x = a; x <= b; x += step) addBubble(scene, x + Math.random() * 3, y + Math.random() * 4 - 2, { vx: -6, vy: -10 - Math.random() * 10, r: Math.random() < 0.3 ? 2 : 1, life: 0.6 + Math.random() * 0.5 });
}

// Appelé pour chaque effet vivant, à chaque image, quand la scène est sous l'eau. Renvoie true si l'effet a été
// dessiné ici (remous).
export function waterAccent(scene, ctx, fx, dt, t) {
  if (fx.kind === 'eddy') { drawEddy(ctx, fx, t); return true; }
  // L'eau freine tout ce qui vole : étincelles, éclats et particules d'éléments ralentissent et retombent moins.
  if (fx.kind === 'particle' || fx.kind === 'spark' || fx.kind === 'epx' || fx.kind === 'coin') {
    const k = Math.exp(-dt * 3.2);
    fx.vx *= k;
    if (fx.kind === 'particle' || fx.kind === 'coin') fx.vy -= 80 * dt; // poussée d'Archimède (gravité 120 → 40)
    else fx.vy *= k;
  }
  if (scene.focus) return false;
  if (fx.kind === 'proj' && fx.life <= fx.max && fx.cx !== undefined) {
    // Sillage de bulles derrière tout projectile (flèches, boules de feu → vapeur, âmes, carreaux, sorts des alliés).
    fx.wake = (fx.wake ?? 0) - dt;
    if (fx.wake <= 0) {
      fx.wake = 0.03;
      addBubble(scene, fx.cx - 2, fx.cy + Math.random() * 3 - 1, { vx: -14, vy: -8 - Math.random() * 8, r: Math.random() < 0.6 ? 2 : 1, life: 1 });
    }
  }
  if (fx.wet) return false;
  if (fx.kind === 'sprite' && fx.life > fx.max) return false; // effet différé : accent à son départ
  fx.wet = true;
  switch (fx.kind) {
    case 'sprite': {
      const name = fx.frames?.[0] ?? '';
      if (name.startsWith('fx_slash')) {
        // Arc de taille : le tranchant fend l'eau — croissant de bulles et remous à sa pointe.
        const crit = name === 'fx_slash_crit';
        for (let i = 0; i < (crit ? 16 : 11); i++) {
          const a = -1.2 + (i / 10) * 2.4;
          addBubble(scene, fx.x + Math.cos(a) * 10, fx.y - 12 + Math.sin(a) * 10, { vx: 20 + Math.cos(a) * 14, vy: -8 + Math.sin(a) * 10, r: i % 2 ? 1 : 2, life: 1.1 });
        }
        eddy(scene, fx.x + 8, fx.y - 12, fx.tint ?? '#bff4ff', crit ? 12 : 9, 0.6);
      } else if (name.startsWith('fx_whirl')) {
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * Math.PI * 2;
          addBubble(scene, fx.x + Math.cos(a) * 16, fx.y - 12 + Math.sin(a) * 8, { vx: -Math.sin(a) * 30, vy: Math.cos(a) * 14 - 10, r: i % 3 ? 1 : 2, life: 1 });
        }
        eddy(scene, fx.x, fx.y - 12, '#d8fbff', 16, 0.6);
      } else if (name.startsWith('fx_burst') || name === 'fx_meteor') {
        for (let i = 0; i < 10; i++) addBubble(scene, fx.x + Math.random() * 16 - 8, fx.y - 6 - Math.random() * 10, { vx: Math.random() * 30 - 15, vy: -20 - Math.random() * 25, r: i % 3 ? 1 : 2, life: 1 });
        eddy(scene, fx.x, fx.y - 10, fx.tint ?? '#ffffff', 10, 0.5);
      } else if (name === 'fx_wave') {
        eddy(scene, fx.x, fx.y - 10, '#bff4ff', 7);
        fx.trailing = true;
      } else if (name === 'fx_hit') {
        eddy(scene, fx.x - 2, fx.y - 6, fx.tint ?? '#d8fbff', 8, 0.5);
        for (let i = 0; i < 5; i++) addBubble(scene, fx.x + Math.random() * 6 - 3, fx.y - 8 + Math.random() * 6 - 3, { vx: 10 + Math.random() * 20, vy: -16 - Math.random() * 14, r: i % 2 ? 1 : 2, life: 1 });
      } else if (name === 'fx_spark' && Math.random() < 0.5) addBubble(scene, fx.x, fx.y - 4, { vy: -12, r: 1, life: 0.8 });
      break;
    }
    case 'streak': bubbleLine(scene, fx.x0, fx.x1, fx.y, 6); eddy(scene, fx.x1, fx.y, fx.color, 6); break;
    case 'beam':
      // Rayon : colonne de bulles qui monte dans la lumière.
      for (let i = 0; i < (fx.wide ? 12 : 7); i++) addBubble(scene, fx.x + Math.random() * 10 - 5, scene.groundY - Math.random() * 30, { vy: -30 - Math.random() * 30, r: i % 3 ? 1 : 2, life: 1.2 });
      eddy(scene, fx.x, scene.groundY - 8, fx.color, fx.wide ? 14 : 9, 0.6);
      break;
    case 'zap':
      // L'éclair court dans l'eau : chaque point touché bouillonne.
      for (const p of fx.pts) { eddy(scene, p.x, p.y, '#e8f8ff', 5, 0.3); addBubble(scene, p.x, p.y, { vy: -24, r: 2, life: 0.8 }); }
      break;
    // Éléments : le feu siffle en vapeur (bulles blanches), la glace cristallise des bulles, le poison bouillonne…
    case 'epx': if (Math.random() < 0.35) addBubble(scene, fx.x, fx.y, { vx: fx.vx * 0.3, vy: -18 - Math.random() * 14, r: Math.random() < 0.4 ? 2 : 1, life: 0.9 }); break;
    case 'eglow': eddy(scene, fx.x, fx.y, fx.color, (fx.r ?? 7) + 2, 0.4); break;
    case 'ring': eddy(scene, fx.x, fx.y, fx.color, Math.max(6, fx.r ?? 8), 0.45); break;
    case 'gust': eddy(scene, fx.x, fx.y - 4, '#d8fbff', 6, 0.35); break;
    case 'puff':
      // Poussière → vase soulevée du fond, lente, avec une bulle.
      fx.color = SILT[Math.floor(Math.random() * SILT.length)];
      fx.vx *= 0.5; fx.vy *= 0.5; fx.life *= 1.6; fx.max *= 1.6;
      if (Math.random() < 0.5) addBubble(scene, fx.x, fx.y - 2, { vy: -14, r: 1, life: 1 });
      break;
    default: break;
  }
  if (fx.trailing) fx.wet = false; // vague : sillage à chaque image
  if (fx.trailing && fx.life <= fx.max && Math.random() < 0.5) addBubble(scene, fx.x + (fx.vx ?? 0) * (fx.max - fx.life), fx.y - 10 + Math.random() * 6 - 3, { vx: -16, vy: -10, r: 1, life: 0.6 });
  return false;
}

// Remous : spirale de pixels qui tourne et s'élargit en s'effaçant (2 bras), sans dégradé.
export function drawEddy(ctx, fx, t) {
  const age = 1 - t;
  const r = fx.r * (0.5 + age * 0.7);
  ctx.globalAlpha = Math.min(1, t * 1.8) * 0.85;
  for (let arm = 0; arm < 2; arm++) {
    for (let k = 0; k < 9; k++) {
      const a = fx.spin * (age * 7 + k * 0.55) + arm * Math.PI;
      const rr = r * (0.25 + (k / 9) * 0.75);
      ctx.fillStyle = k > 5 ? '#ffffff' : fx.color;
      ctx.fillRect(Math.round(fx.x + Math.cos(a) * rr), Math.round(fx.y + Math.sin(a) * rr * 0.6), 1, 1);
    }
  }
  ctx.globalAlpha = 1;
}
