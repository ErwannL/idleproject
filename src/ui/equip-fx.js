// v10.6 (parties 4 et 6) : en équipant, l'objet vole de là où on l'a touché jusqu'à sa case, puis la Puissance défile
// jusqu'à sa nouvelle valeur (0,6 s). Coupé par « Réduire les animations » (l'appelant vérifie).
import { computeHeroStats } from '../core/stats.js';
import { formatNumber } from '../core/format.js';

export const EQUIP_FLY_MS = 600;

export function equipFly(root, src, from, id, before, state) {
  if (!src || typeof document === 'undefined') return;
  const slot = root.querySelector(`.eq-doll .eq-slot[data-id="${CSS.escape(id ?? '')}"] .eq-slot-box`) ?? root.querySelector('.eq-doll .eq-slot.on .eq-slot-box');
  const to = slot?.getBoundingClientRect();
  if (!to?.width) return;
  const im = document.createElement('img');
  im.src = src; im.className = 'px equip-fly'; im.alt = '';
  Object.assign(im.style, { left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px` });
  document.body.appendChild(im);
  im.animate([{ transform: 'none', opacity: 1 },
    { transform: `translate(${to.left + to.width / 2 - from.left - from.width / 2}px, ${to.top + to.height / 2 - from.top - from.height / 2}px) scale(${Math.max(0.3, to.width / from.width)})`, opacity: 0.9 }],
  { duration: EQUIP_FLY_MS, easing: 'cubic-bezier(.3,.1,.3,1)' }).onfinish = () => { im.remove(); slot.animate([{ transform: 'scale(1.15)' }, { transform: 'none' }], { duration: 250 }); };
  if (before == null || !state) return;
  const after = computeHeroStats(state).combatPower;
  const t0 = performance.now();
  const tick = (t) => {
    const b = root.querySelector('.eq-power b');
    if (!b) return;
    const p = Math.min(1, (t - t0) / EQUIP_FLY_MS);
    b.textContent = formatNumber(before + (after - before) * (1 - (1 - p) ** 3));
    b.classList.toggle('rolling', p < 1);
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
