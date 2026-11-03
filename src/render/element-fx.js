// v9.1.9 : effets d'éléments (feu, glace, foudre, poison, sacré, ombre) en particules pixel.
// Chaque élément a son mouvement propre (braises qui montent, éclats qui tombent, arcs brefs, bulles lentes,
// étincelles verticales, volutes qui convergent), une lueur (anneau pixel) et une rémanence (pixels qui restent).
// « Réduire les animations » : 2 particules au plus, ni lueur ni rémanence.

export const ELEMENTS = {
  fire: { colors: ['#ffe27a', '#ff9a2a', '#ff4a1a', '#a8240e'], n: 9, vx: [-25, 25], vy: [-60, -25], g: -40, life: 0.6, glow: '#ff7a2a', linger: 'ember' },
  ice: { colors: ['#ffffff', '#cfefff', '#7fc8ff', '#3c7ad0'], n: 8, vx: [-45, 45], vy: [-50, -10], g: 160, life: 0.55, glow: '#9fe0ff', linger: 'frost' },
  thunder: { colors: ['#ffffff', '#e8f8ff', '#9fe0ff', '#ffe27a'], n: 7, vx: [-90, 90], vy: [-70, 30], g: 0, life: 0.18, glow: '#e8f8ff', linger: 'arc' },
  poison: { colors: ['#c8ff7a', '#7ae05a', '#3fa04a', '#245a2a'], n: 7, vx: [-10, 10], vy: [-24, -10], g: -8, life: 0.9, glow: '#7ae05a', linger: 'bubble' },
  holy: { colors: ['#ffffff', '#fff2a8', '#ffd23f', '#d89a2a'], n: 8, vx: [-6, 6], vy: [-70, -40], g: 0, life: 0.55, glow: '#ffe680', linger: 'cross' },
  shadow: { colors: ['#e0c8ff', '#b07bff', '#6a3ab0', '#2a1640'], n: 8, vx: [-30, 30], vy: [-30, 10], g: -20, life: 0.6, glow: '#b07bff', linger: 'swirl', inward: true },
};

// Élément suggéré par une couleur d'impact (compagnons, classes) : teinte HSL ; null si peu saturée.
export function elementOfColor(color) {
  const m = /^#?([0-9a-f]{6})$/i.exec(color ?? '');
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (d < 0.25) return null;
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  if (h < 40 || h >= 340) return 'fire';
  if (h < 70) return 'holy';
  if (h < 170) return 'poison';
  if (h < 225) return 'ice';
  if (h >= 250 && h < 320) return 'shadow';
  return null;
}

const rnd = (a, b) => a + Math.random() * (b - a);

export function installElementFx(proto) {
  proto.elementFx = function elementFx(x, y, element, big = false) {
    const e = ELEMENTS[element];
    if (!e) return;
    const n = this.focus ? 2 : Math.round(e.n * (big ? 1.6 : 1));
    for (let i = 0; i < n; i++) {
      const ox = e.inward ? rnd(-14, 14) : rnd(-3, 3), oy = e.inward ? rnd(-12, 8) : rnd(-4, 4);
      this.effects.push({
        kind: 'epx', x: x + ox, y: y + oy, vx: e.inward ? -ox * 3 : rnd(...e.vx), vy: e.inward ? -oy * 3 : rnd(...e.vy), g: e.g,
        colors: e.colors, life: e.life * rnd(0.7, 1.1), max: e.life, size: Math.random() < 0.3 ? 2 : 1, flicker: element === 'fire' || element === 'thunder',
      });
    }
    if (this.focus) return;
    this.effects.push({ kind: 'eglow', x: Math.round(x), y: Math.round(y), color: e.glow, life: 0.22, max: 0.22, r: big ? 10 : 7 });
    this.effects.push({ kind: 'elinger', x: Math.round(x), y: Math.round(y), shape: e.linger, colors: e.colors, life: 0.5, max: 0.5, seed: Math.floor(Math.random() * 1000) });
  };

  // Dessin des trois types d'effet (appelé par la boucle d'effets de scene.js ; renvoie false si inconnu).
  proto.drawElementEffect = function drawElementEffect(ctx, fx, t, dt) {
    if (fx.kind === 'epx') {
      fx.vy += fx.g * dt;
      fx.x += fx.vx * dt;
      fx.y = Math.min(this.groundY, fx.y + fx.vy * dt);
      // Couleur qui refroidit avec l'âge (du clair au sombre) ; scintillement des braises et étincelles.
      const c = fx.colors[Math.min(fx.colors.length - 1, Math.floor((1 - t) * fx.colors.length))];
      if (fx.flicker && Math.random() < 0.25) return true;
      ctx.globalAlpha = Math.min(1, t * 1.6);
      ctx.fillStyle = c;
      ctx.fillRect(Math.round(fx.x), Math.round(fx.y), fx.size, fx.size);
      return true;
    }
    if (fx.kind === 'eglow') {
      // Lueur : anneau pixel qui s'élargit (pas de dégradé flou).
      const r = Math.round(fx.r * (1 - t) + 2);
      ctx.globalAlpha = t * 0.8;
      ctx.fillStyle = fx.color;
      for (let a = 0; a < 16; a++) {
        const ang = (a / 16) * Math.PI * 2;
        ctx.fillRect(Math.round(fx.x + Math.cos(ang) * r), Math.round(fx.y + Math.sin(ang) * r * 0.7), 1, 1);
      }
      return true;
    }
    if (fx.kind === 'elinger') {
      // Rémanence : motif fixe propre à l'élément, qui s'éteint en clignotant sur la fin.
      if (t < 0.3 && Math.floor(t * 40) % 2) return true;
      ctx.globalAlpha = Math.min(1, t * 2);
      const [c0, c1] = fx.colors;
      const px = (dx, dy, c) => { ctx.fillStyle = c; ctx.fillRect(fx.x + dx, fx.y + dy, 1, 1); };
      const s = fx.seed;
      switch (fx.shape) {
        case 'frost': for (const [dx, dy] of [[0, -3], [0, 3], [-3, 0], [3, 0], [-2, -2], [2, 2], [2, -2], [-2, 2], [0, 0]]) px(dx, dy, dx || dy ? c1 : c0); break;
        case 'cross': for (let k = -4; k <= 4; k++) { px(0, k, c1); if (Math.abs(k) <= 2) px(k, -1, c1); } px(0, -1, c0); break;
        case 'bubble': for (let k = 0; k < 3; k++) { const bx = ((s >> k) % 9) - 4, by = -Math.round((1 - t) * 10) - k * 3; px(bx, by, c1); px(bx + 1, by, c0); } break;
        case 'arc': { let y = -6; let x = 0; for (let k = 0; k < 8; k++) { px(x, y, k % 2 ? c0 : c1); y += 1; x += ((s + k) % 3) - 1; } break; }
        case 'swirl': for (let k = 0; k < 8; k++) { const a = k * 0.8 + (1 - t) * 6, r = 6 - k * 0.6; px(Math.round(Math.cos(a) * r), Math.round(Math.sin(a) * r * 0.7), k < 3 ? c0 : c1); } break;
        default: for (let k = 0; k < 4; k++) px(((s >> k) % 7) - 3, -((s >> (k + 2)) % 6), k % 2 ? c0 : c1); // braises
      }
      return true;
    }
    return false;
  };
}
