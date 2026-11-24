// Clic maintenu (v8.1) : en gardant le bouton de la souris enfoncé sur un bouton, un anneau se remplit
// autour du curseur ; une fois plein, le bouton est cliqué en continu jusqu'à ce qu'on relâche ou bouge la souris.
// v8.2 : Entrée maintenue sur un bouton sélectionné au clavier fait la même chose (anneau sur le bouton).
const DELAY_MS = 250; // avant d'afficher l'anneau
const FILL_MS = 650; // remplissage de l'anneau
const REPEAT_MS = 90; // cadence des clics automatiques (au début)
// v9.1.3 : accélération — chaque clic raccourcit l'attente (×0,92) jusqu'à 30 ms.
const REPEAT_MIN_MS = 30;
const REPEAT_FACTOR = 0.92;
export function repeatDelay(n) { return Math.max(REPEAT_MIN_MS, Math.round(REPEAT_MS * REPEAT_FACTOR ** Math.max(0, n))); }
const MOVE_TOLERANCE = 6; // px
// Seulement les actions qu'on veut répéter (achats, améliorations, invocations, réclamations, zoom…) :
// jamais une confirmation (Renaissance, recyclage groupé, réinitialisation…).
// v9.1.3 (doc3 lot 2) : « fuse » retiré (une tentative de fusion ne se répète jamais au maintien).
export const REPEATABLE = new Set(['buy', 'upgrade-item', 'reforge', 'craft', 'learn-skill', 'upgrade-companion',
  'summon', 'cheat', 'buy-talent', 'buy-perk', 'upgrade-rush', 'reroll', 'claim-contract', 'claim-mission', 'claim-event',
  'buy-merchant', 'map-zoom', 'tree-zoom', 'claim-collection']);
// v9.1.3 : au doigt, liste courte (jamais summon ni buy-merchant : un maintien ne doit pas dépenser des gemmes en rafale).
export const TOUCH_REPEATABLE = new Set(['buy', 'upgrade-companion', 'upgrade-item', 'learn-skill', 'buy-talent']);
export function canHold(btn, pointerType) {
  if (!btn || btn.disabled || !btn.dataset?.action) return false;
  return (pointerType === 'touch' ? TOUCH_REPEATABLE : REPEATABLE).has(btn.dataset.action);
}
// v9.1.3 : dernier maintien qui a cliqué (le balayage d'onglets l'ignore juste après).
let lastFiredAt = 0;
export function holdFiredRecently(now = performance.now()) { return now - lastFiredAt < 500; }

// Sélecteur qui retrouve « le même » bouton après un redessin du panneau.
export function selectorFor(el) {
  const parts = Object.entries(el.dataset)
    .filter(([k]) => !k.startsWith('cost') && k !== 'currency' && k !== 'needsCharge' && k !== 'locked')
    .map(([k, v]) => `[data-${k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}="${CSS.escape(v)}"]`);
  return parts.length ? `${el.tagName.toLowerCase()}${parts.join('')}` : null;
}

let api = null;

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
    clearTimeout(hold.repeat);
    cancelAnimationFrame(hold.raf);
    ring.classList.add('hidden');
    document.body.classList.remove('hold-repeating');
    if (hold.fired && (hold.source === 'pointer' || hold.source === 'touch')) {
      // Le clic natif du relâchement ne doit pas compter en plus. v9.1.3 : au doigt, le clic arrive plus tard
      // (après touchend) : fenêtre plus longue.
      lastFiredAt = performance.now();
      const swallow = (e) => { e.stopImmediatePropagation(); e.preventDefault(); };
      window.addEventListener('click', swallow, { capture: true, once: true });
      setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), hold.source === 'touch' ? 400 : 50);
    }
    hold = null;
  };

  const start = (selector, x, y, source) => {
    stop();
    hold = { x, y, selector, source, fired: false };
    ring.style.left = `${x}px`;
    ring.style.top = `${y}px`;
    hold.timer = setTimeout(() => {
      if (!hold) return;
      ring.classList.remove('hidden', 'full');
      const t0 = performance.now();
      const tick = (now) => {
        if (!hold) return;
        const p = Math.min(1, (now - t0) / FILL_MS);
        fg.style.strokeDashoffset = `${LEN * (1 - p)}`;
        if (p < 1) { hold.raf = requestAnimationFrame(tick); return; }
        ring.classList.add('full');
        document.body.classList.add('hold-repeating'); // le panneau peut se redessiner pendant la répétition
        let n = 0;
        const fire = () => {
          if (!hold) return;
          const target = root.querySelector(hold.selector ?? '');
          if (target && !target.disabled) {
            hold.fired = true;
            target.click();
            if (hold.source === 'key' && document.activeElement !== target) target.focus({ preventScroll: true });
          }
          if (hold) hold.repeat = setTimeout(fire, repeatDelay(n++));
        };
        hold.repeat = setTimeout(fire, repeatDelay(n++));
      };
      hold.raf = requestAnimationFrame(tick);
    }, DELAY_MS);
  };

  root.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const btn = e.target.closest('button[data-action]');
    if (!canHold(btn, e.pointerType)) return;
    const selector = selectorFor(btn);
    if (selector) start(selector, e.clientX, e.clientY, e.pointerType === 'touch' ? 'touch' : 'pointer');
  });
  // v9.1.3 : un doigt qui glisse (défilement de la liste, balayage d'onglets) annule le maintien ; le navigateur
  // envoie aussi pointercancel quand il prend la main pour défiler.
  window.addEventListener('pointermove', (e) => {
    if ((hold?.source === 'pointer' || hold?.source === 'touch') && Math.hypot(e.clientX - hold.x, e.clientY - hold.y) > MOVE_TOLERANCE) stop();
  });
  window.addEventListener('pointerup', () => { if (hold?.source === 'pointer' || hold?.source === 'touch') stop(); });
  // v9.1.3 : pas de menu contextuel d'appui long (Android) sur un bouton qu'on peut maintenir.
  root.addEventListener('contextmenu', (e) => {
    const btn = e.target.closest?.('button[data-action]');
    if (hold?.source === 'touch' || (btn && TOUCH_REPEATABLE.has(btn.dataset.action))) e.preventDefault();
  });
  window.addEventListener('pointercancel', stop);
  window.addEventListener('blur', stop);

  api = {
    // Entrée enfoncée sur un bouton : un clic tout de suite, puis l'anneau et la répétition.
    keyDown(btn) {
      if (hold?.source === 'key') return true;
      if (!btn || btn.disabled || !REPEATABLE.has(btn.dataset.action)) return false;
      const selector = selectorFor(btn);
      if (!selector) return false;
      btn.click();
      const r = btn.getBoundingClientRect();
      start(selector, r.left + r.width / 2, r.top + r.height / 2, 'key');
      return true;
    },
    keyUp() { if (hold?.source === 'key') stop(); },
  };
}

export const holdKeys = {
  keyDown: (btn) => api?.keyDown(btn) ?? false,
  keyUp: () => api?.keyUp(),
};
