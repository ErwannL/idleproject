// Infobulle unique (v9.1.0) : le texte d'un attribut title (ou data-tip) affiché dans une bulle, au toucher par un
// appui long (450 ms, sans déclencher le clic au relâchement) et au clavier quand l'élément reçoit le focus.
// La bulle est hors de #panel-body (redessiné en innerHTML) : elle n'est jamais effacée par un redessin.
import { canHold } from './hold.js';

const LONG_PRESS_MS = 450;

export function installTips(root) {
  const bubble = document.createElement('div');
  bubble.className = 'tip-bubble hidden';
  bubble.setAttribute('role', 'tooltip');
  document.body.appendChild(bubble);
  let timer = null;
  let shownFor = null;
  let swallowClick = false;
  const textOf = (el) => el?.dataset?.tip || el?.getAttribute?.('title') || el?.getAttribute?.('aria-description') || '';
  const show = (el) => {
    const text = textOf(el);
    if (!text) return;
    shownFor = el;
    bubble.textContent = text;
    bubble.classList.remove('hidden');
    const r = el.getBoundingClientRect();
    const w = Math.min(280, window.innerWidth - 16);
    bubble.style.maxWidth = `${w}px`;
    const bh = bubble.offsetHeight;
    const top = r.top - bh - 8 >= 4 ? r.top - bh - 8 : Math.min(window.innerHeight - bh - 4, r.bottom + 8);
    const left = Math.max(8, Math.min(window.innerWidth - bubble.offsetWidth - 8, r.left + r.width / 2 - bubble.offsetWidth / 2));
    Object.assign(bubble.style, { top: `${Math.round(top)}px`, left: `${Math.round(left)}px` });
  };
  const hide = () => { shownFor = null; bubble.classList.add('hidden'); };
  root.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') return;
    const el = e.target.closest('[title], [data-tip]');
    clearTimeout(timer);
    if (!el) { hide(); return; }
    // v9.1.3 : un bouton qu'on peut maintenir au doigt garde l'appui long pour la répétition, pas pour l'infobulle.
    if (canHold(e.target.closest('button[data-action]'), 'touch')) return;
    timer = setTimeout(() => { show(el); swallowClick = true; }, LONG_PRESS_MS);
  }, { capture: true });
  const cancel = () => clearTimeout(timer);
  root.addEventListener('pointerup', cancel, { capture: true });
  root.addEventListener('pointercancel', cancel, { capture: true });
  root.addEventListener('pointermove', (e) => { if (e.pointerType === 'touch' && Math.abs(e.movementX) + Math.abs(e.movementY) > 6) cancel(); }, { capture: true });
  // Le clic qui suit un appui long n'agit pas : on lisait l'aide.
  root.addEventListener('click', (e) => {
    if (!swallowClick) return;
    swallowClick = false;
    e.preventDefault();
    e.stopImmediatePropagation();
  }, { capture: true });
  root.addEventListener('focusin', (e) => {
    if (e.target.matches?.(':focus-visible') && textOf(e.target)) show(e.target); else if (shownFor) hide();
  });
  root.addEventListener('focusout', () => hide());
  window.addEventListener('scroll', hide, { capture: true, passive: true });
  document.addEventListener('pointerdown', (e) => { if (shownFor && !e.target.closest('[title], [data-tip]')) hide(); }, { capture: true });
}
