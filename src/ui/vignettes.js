// v10.1 (P2) : vignettes animées — tout <canvas data-vfx="nom"> visible joue l'effet nommé en boucle (atlas des effets).
// Un effet inconnu tombe sur un éclat générique. Une seule boucle pour toute la page, arrêtée quand rien n'est visible.
import { VFX } from '../render/art-vfx.js';
import { drawVfxFrame } from '../render/vfx.js';

let running = false;
function tick(now) {
  const list = document.querySelectorAll('canvas[data-vfx]');
  if (!list.length) { running = false; return; }
  for (const c of list) {
    if (!c.isConnected || c.offsetParent === null) continue;
    let name = c.dataset.vfx;
    if (!VFX[name]) name = 'combo_burst';
    const e = VFX[name];
    if (!e) continue;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, c.width, c.height);
    const per = (e.ms?.[0] || 90);
    const i = Math.floor(now / per) % Math.max(1, e.n);
    const k0 = e.scale || 1;
    const size = Math.min(c.width / (e.w * k0), c.height / (e.h * k0)) * 0.85;
    const k = k0 * size;
    // Ancrage de l'effet placé pour centrer l'image entière dans la vignette.
    drawVfxFrame(ctx, name, i, (c.width - e.w * k) / 2 + e.ax * k, (c.height - e.h * k) / 2 + e.ay * k, { size });
    ctx.globalAlpha = 1;
  }
  requestAnimationFrame(tick);
}
export function startVignettes() {
  if (running || typeof document === 'undefined') return;
  running = true;
  requestAnimationFrame(tick);
}
