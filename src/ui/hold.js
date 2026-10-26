// Clic maintenu (v8.1) : en gardant le bouton de la souris enfoncé sur un bouton, un anneau se remplit
// autour du curseur ; une fois plein, le bouton est cliqué en continu jusqu'à ce qu'on relâche ou bouge la souris.
const DELAY_MS = 250; // avant d'afficher l'anneau
const FILL_MS = 650; // remplissage de l'anneau
const REPEAT_MS = 90; // cadence des clics automatiques
const MOVE_TOLERANCE = 6; // px
// Seulement les actions qu'on veut répéter (achats, améliorations, invocations, réclamations, zoom…) :
// jamais une confirmation (Renaissance, recyclage groupé, réinitialisation…).
const REPEATABLE = new Set(['buy', 'upgrade-item', 'sharpen', 'reforge', 'craft', 'fuse', 'learn-skill', 'upgrade-companion',
  'summon', 'buy-talent', 'buy-perk', 'upgrade-rush', 'reroll', 'claim-contract', 'claim-mission', 'claim-event',
  'buy-merchant', 'map-zoom', 'tree-zoom', 'claim-collection']);

// Sélecteur qui retrouve « le même » bouton après un redessin du panneau.
function selectorFor(el) {
  const parts = Object.entries(el.dataset)
    .filter(([k]) => !k.startsWith('cost') && k !== 'currency' && k !== 'needsCharge' && k !== 'locked')
    .map(([k, v]) => `[data-${k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}="${CSS.escape(v)}"]`);
  return parts.length ? `button${parts.join('')}` : null;
}

export function installHoldToRepeat(root) {
  const ring = document.createElement('div');
  ring.className = 'hold-ring hidden';
  ring.innerHTML = '<svg viewBox="0 0 36 36"><circle class="bg" cx="18" cy="18" r="15"/><circle class="fg" cx="18" cy="18" r="15"/></svg>';
  document.body.appendChild(ring);
  const fg = ring.querySelector('.fg');
  const LEN = 2 * Math.PI * 15;
  fg.style.strokeDasharray = `${LEN}`;

  let hold = null;
  const stop = () => {
    if (!hold) return;
    clearTimeout(hold.timer);
    clearInterval(hold.repeat);
    cancelAnimationFrame(hold.raf);
    ring.classList.add('hidden');
    document.body.classList.remove('hold-repeating');
    if (hold.fired) {
      // Le clic natif du relâchement ne doit pas compter en plus.
      const swallow = (e) => { e.stopPropagation(); e.preventDefault(); };
      window.addEventListener('click', swallow, { capture: true, once: true });
      setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 50);
    }
    hold = null;
  };

  root.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.pointerType === 'touch') return;
    const btn = e.target.closest('button[data-action]');
    if (!btn || btn.disabled || !REPEATABLE.has(btn.dataset.action)) return;
    const selector = selectorFor(btn);
    if (!selector) return;
    stop();
    hold = { x: e.clientX, y: e.clientY, selector, fired: false };
    ring.style.left = `${e.clientX}px`;
    ring.style.top = `${e.clientY}px`;
    hold.timer = setTimeout(() => {
      if (!hold) return;
      ring.classList.remove('hidden');
      const start = performance.now();
      const tick = (now) => {
        if (!hold) return;
        const p = Math.min(1, (now - start) / FILL_MS);
        fg.style.strokeDashoffset = `${LEN * (1 - p)}`;
        if (p < 1) { hold.raf = requestAnimationFrame(tick); return; }
        ring.classList.add('full');
        document.body.classList.add('hold-repeating'); // le panneau peut se redessiner pendant la répétition
        hold.repeat = setInterval(() => {
          const target = root.querySelector(hold?.selector ?? '');
          if (!target || target.disabled) return;
          hold.fired = true;
          target.click();
        }, REPEAT_MS);
      };
      ring.classList.remove('full');
      hold.raf = requestAnimationFrame(tick);
    }, DELAY_MS);
  });
  window.addEventListener('pointermove', (e) => {
    if (hold && Math.hypot(e.clientX - hold.x, e.clientY - hold.y) > MOVE_TOLERANCE) stop();
  });
  window.addEventListener('pointerup', stop);
  window.addEventListener('pointercancel', stop);
  window.addEventListener('blur', stop);
}
