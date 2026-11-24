// v10.12 (lot « profil ») : petits outils communs aux écrans téléphone de Carnet, Missions, Encyclopédie, Apparences, Boss,
// Classement, Guilde, Statistiques et Paramètres. Rien ici ne change le PC : chaque panneau ne les appelle que si `isMPhone(ui)`.
import { escapeHtml } from '../common.js';
import { mBar, mChip, mTitle } from '../mobile-kit.js';

const e = (v) => escapeHtml(v ?? '');
export { e as esc };

// Téléphone = classe `m-phone` sur #app (posée par ui.js) ; repli sur la largeur si la classe n'est pas encore là.
export const isMPhone = (ui) => Boolean(ui?.root?.classList?.contains?.('m-phone')) || ((ui?.root?.clientWidth ?? 9999) <= 600 && Boolean(ui?.root));

// Cadre d'un écran : cartouche + contenu. La classe `mp-frame` sert aux règles du lot (en-tête du panneau, bannière).
// `sheetOpen` : pose un repère dans le cadre tant qu'une fiche est ouverte ; en le retirant à la fermeture, le corps change et ui.js
// (watchSheets) retire la fiche déjà déplacée dans #panel (sans cela, un redessin identique laissait la fiche affichée).
export const mpFrame = (icon, label, inner, help = true, sheetOpen = false) => `<div class="m-frame mp-frame">${mTitle(icon, label, help)}${inner}${sheetOpen ? '<i class="mp-sheet-mark" hidden aria-hidden="true"></i>' : ''}</div>`;

// Rangée de puces qui remplace un <select> : un appui = le même effet que le `change` du <select> (action `mp-pick`, data-for = son action).
// items : [[valeur, libellé], …] ; `key` : data-key éventuel du <select>.
export function mpChips(forAction, items, current, key, scroll = false) {
  const attrs = `data-for="${e(forAction)}"${key ? ` data-key="${e(key)}"` : ''}`;
  return `<div class="m-chips mp-chips${scroll ? ' mp-scroll' : ''}" role="group">${items.map(([v, label]) => mChip(label, { action: 'mp-pick', value: v, on: String(v) === String(current), attrs })).join('')}</div>`;
}

// Ligne « icône · nom + barre · bouton » à 64 px au moins (Carnet, Missions…).
export function mpRow({ icon, title, sub = '', bar, n = '', right = '', cls = '', attrs = '' }) {
  return `<div class="m-card mp-row${cls ? ` ${cls}` : ''}" ${attrs}><span class="mp-ico">${icon ?? ''}</span>
    <div class="mp-main"><b class="mp-name">${title}</b>${sub}${bar === undefined ? '' : `<div class="mp-barline">${mBar(bar)}${n ? `<small class="mp-n">${n}</small>` : ''}</div>`}</div>${right}</div>`;
}
