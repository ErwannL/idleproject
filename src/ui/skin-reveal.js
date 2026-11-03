// v9.1.9 : révélation « Nouvelle apparence débloquée ! » — après l'animation d'invocation (×1 comme ×10), une carte
// par apparence neuve : cadre de rareté, héros animé avec ce skin, bonus, « Porter maintenant » (un appui) ou « Plus tard ».
// Les apparences arrivées pendant un clic maintenu attendent la fin des invocations en continu.
import { heroById } from '../core/heroes.js';
import { animCanvas } from './animator.js';
import { effectText, escapeHtml, hdArt, rarityLabel } from './common.js';

// Apparences neuves d'un tirage (sans doublon d'identifiant).
export function newSkins(results) {
  const seen = new Set();
  return (results ?? []).filter((r) => r.kind === 'hero' && r.isNew && !seen.has(r.id) && seen.add(r.id)).map((r) => r.id);
}

const queue = [];
let waiter = null;

export function skinRevealHtml(hero, { worn = false, left = 0 } = {}) {
  return `<div class="skin-reveal-card r-${hero.rarity}" role="dialog" aria-modal="true" aria-labelledby="skin-reveal-title">
      <div class="sr-ribbon" id="skin-reveal-title">✦ Nouvelle apparence débloquée ! ✦</div>
      <div class="sr-stage">${hdArt(hero, 'sr-hd')}${animCanvas(`hero:${hero.id}`, 64, 58, 3)}</div>
      <div class="sr-name">${escapeHtml(hero.name)}</div>
      <div class="sr-rarity rarity-text">${rarityLabel(hero.rarity)}</div>
      ${hero.title ? `<div class="muted sr-title">${escapeHtml(hero.title)}</div>` : ''}
      <div class="good sr-bonus">${effectText(hero.bonus)}</div>
      <div class="sr-buttons">${worn ? '<span class="class-on">Portée ✓</span>'
        : '<button class="btn btn-gold" data-sr="wear">Porter maintenant</button>'}
        <button class="btn" data-sr="close">${left ? 'Suivante ›' : 'Plus tard'}</button></div>
    </div>`;
}

function showNext(getState, onWear) {
  const id = queue.shift();
  const hero = id && heroById(id);
  if (!hero) return;
  const el = document.createElement('div');
  el.className = 'skin-reveal';
  const draw = () => { el.innerHTML = skinRevealHtml(hero, { worn: getState()?.heroes?.active === id, left: queue.length }); };
  draw();
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('open'), 20);
  const close = () => { el.remove(); document.removeEventListener('keydown', onKey); if (queue.length) showNext(getState, onWear); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-sr]');
    if (b?.dataset.sr === 'wear') { onWear(id); draw(); el.querySelector('[data-sr="close"]')?.focus(); return; }
    if (b?.dataset.sr === 'close' || e.target === el) close();
  });
  el.querySelector('[data-sr]')?.focus();
}

// Met en file les apparences neuves ; elles s'affichent quand l'animation d'invocation est fermée.
export function queueSkinReveals(results, getState, onWear) {
  const ids = newSkins(results);
  if (!ids.length || typeof document === 'undefined') return ids;
  queue.push(...ids.filter((id) => !queue.includes(id)));
  if (waiter || document.querySelector('.skin-reveal')) return ids;
  waiter = setInterval(() => {
    if (document.querySelector('.summon-fx') || document.body.classList.contains('hold-repeating')) return;
    clearInterval(waiter); waiter = null;
    showNext(getState, onWear);
  }, 150);
  return ids;
}
