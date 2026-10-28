// Animation d'invocation (v8.1), façon jeux gacha : portail qui tourne, faisceau de la couleur de la
// meilleure rareté, puis cartes retournées une à une (éclat doré pour un SSR / Légendaire).
// Un clic révèle tout d'un coup, un second clic ferme. Pas d'animation pendant un clic maintenu.
import { companionById } from '../core/companions.js';
import { ALLY_GRADE } from '../data/companions.js';
import { animCanvas } from './animator.js';
import { escapeHtml, rarityLabel } from './common.js';

const ORDER = ['common', 'rare', 'epic', 'legendary'];

function portrait(r) {
  if (r.kind === 'hero') return animCanvas(`hero:${r.id}`, 48, 52, 2);
  const c = companionById(r.id);
  return c.kind === 'ally' ? animCanvas(`foe:${c.sprite}`, 64, 56, 2) : animCanvas(`pet:${c.sprite}`, 24, 24, 4);
}

function grade(r) {
  const c = r.kind === 'hero' ? null : companionById(r.id);
  return c?.kind === 'ally' ? ALLY_GRADE[r.rarity] : rarityLabel(r.rarity);
}

export function playSummonReveal(results) {
  // v8.9 : animation à chaque invocation (un clic la passe) — sauf pendant un clic maintenu (invocations en continu).
  if (!results?.length || document.body.classList.contains('hold-repeating')) return;
  document.querySelector('.summon-fx')?.remove();
  const best = ORDER.filter((r) => results.some((u) => u.rarity === r)).at(-1) ?? 'common';
  const el = document.createElement('div');
  el.className = `summon-fx best-${best}`;
  el.innerHTML = `<div class="sfx-portal"><i></i><i></i><i></i></div><div class="sfx-beam"></div><div class="sfx-flash"></div>
    <div class="sfx-cards count-${Math.min(results.length, 10)}">${results.map((r, i) => `
      <div class="sfx-card r-${r.rarity}" style="--i:${i}">
        <div class="sfx-back"><span>?</span></div>
        <div class="sfx-face">${portrait(r)}<b>${escapeHtml(r.name)}</b><span class="sfx-grade">${grade(r)}</span>
          ${r.isNew ? '<em>Nouveau !</em>' : r.refund ? `<small>+${r.refund} gemmes</small>` : '<small>+1 ★</small>'}</div>
      </div>`).join('')}</div>
    <div class="sfx-hint">Cliquez pour tout révéler</div>`;
  document.body.appendChild(el);
  const cards = [...el.querySelectorAll('.sfx-card')];
  const timers = [];
  const finish = () => { el.classList.add('done'); el.querySelector('.sfx-hint').textContent = 'Cliquez pour fermer'; };
  const flipAll = () => { timers.forEach(clearTimeout); cards.forEach((c) => c.classList.add('flipped')); finish(); };
  // Portail (0,9 s), faisceau, puis une carte toutes les 0,22 s (pause plus longue avant un SSR).
  let at = 1100;
  cards.forEach((card, i) => {
    const rarity = results[i].rarity;
    if (rarity === 'legendary') at += 450;
    timers.push(setTimeout(() => {
      card.classList.add('flipped');
      if (rarity === 'legendary' || rarity === 'epic') {
        el.classList.remove('burst-epic', 'burst-legendary');
        void el.offsetWidth;
        el.classList.add(`burst-${rarity}`);
      }
    }, at));
    at += 220;
  });
  timers.push(setTimeout(finish, at));
  el.addEventListener('click', () => {
    if (!el.classList.contains('done')) flipAll();
    else el.remove();
  });
  setTimeout(() => el.classList.add('open'), 20);
}
