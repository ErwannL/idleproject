// v10.12 (lot « profil ») : petits outils communs aux écrans téléphone de Carnet, Missions, Encyclopédie, Apparences, Boss,
// Classement, Guilde, Statistiques et Paramètres. Rien ici ne change le PC : chaque panneau ne les appelle que si `isMPhone(ui)`.
import { escapeHtml, fold } from '../common.js';
import { mBar, mChip, mTitle } from '../mobile-kit.js';

const e = (v) => escapeHtml(v ?? '');
export { e as esc };

// Téléphone = classe `m-phone` sur #app (posée par ui.js) ; repli sur la largeur si la classe n'est pas encore là.
export const isMPhone = (ui) => Boolean(ui?.root?.classList?.contains?.('m-phone')) || ((ui?.root?.clientWidth ?? 9999) <= 600 && Boolean(ui?.root));

// Cadre d'un écran : cartouche + contenu. La classe `mp-frame` sert aux règles du lot (en-tête du panneau, bannière).
// `sheetOpen` : pose un repère dans le cadre tant qu'une fiche est ouverte ; en le retirant à la fermeture, le corps change et ui.js
// (watchSheets) retire la fiche déjà déplacée dans #panel (sans cela, un redessin identique laissait la fiche affichée).
// v10.17 (D) : les écrans pauvres en image ont une bannière illustrée sous le cartouche, comme les autres onglets.
const MP_BANNER = { Objectifs: 'art101/banner_daybook', Missions: 'art101/banner_missions', Paramètres: 'art98/camp_night', Classement: 'art101/banner_ranking', Statistiques: 'art101/banner_stats' };
export const mpBanner = (label) => (MP_BANNER[label] ? `<div class="mp-banner"><img class="px" src="assets/ui/${MP_BANNER[label]}.png" alt="" aria-hidden="true"></div>` : '');
export const mpFrame = (icon, label, inner, help = true, sheetOpen = false) => `<div class="m-frame mp-frame">${mTitle(icon, label, help)}${mpBanner(label)}${inner}${sheetOpen ? '<i class="mp-sheet-mark" hidden aria-hidden="true"></i>' : ''}</div>`;

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

// ---------- Rattrapage v10.12 : Paramètres, fiches Encyclopédie et Boss reconstruits avec le kit ----------
// Interrupteur du kit (comme `.m-switch` des Compétences) : une carte de 56 px, libellé court, sous-ligne facultative. Même `data-action` que la case à cocher d'origine.
export const mpSwitch = (label, action, checked, { attrs = '', sub = '' } = {}) => `<label class="m-card mp-sw"><span class="mp-sw-t"><b>${label}</b>${sub ? `<small>${sub}</small>` : ''}</span>`
  + `<span class="m-switch"><input type="checkbox" data-action="${action}" ${attrs} ${checked ? 'checked' : ''}><span class="m-sw" aria-hidden="true"></span></span></label>`;
// Titre de section court.
export const mpSec = (label) => `<div class="mp-sub">${label}</div>`;
// Réglage à puces : titre de la carte, puis la rangée de puces (mpChips ou HTML équivalent).
export const mpField = (label, chips, sub = '') => `<div class="m-card mp-field"><div class="mp-field-h"><b>${label}</b>${sub ? `<small>${sub}</small>` : ''}</div>${chips}</div>`;
// Explication repliée (état dans ui.view.open, comme tous les replis) : jamais de mur de texte à l'écran.
export const mpFold = (ui, id, title, body, extra = '') => fold(ui, id, title, body, { cls: 'm-card mp-fold', extra });
// Rangée de boutons du kit (n colonnes).
export const mpBtns = (items) => `<div class="mp-btnrow n${items.length}">${items.join('')}</div>`;
// HTML d'origine (formulaires du compte, codes, mises à jour…) -> classes du kit, en gardant data-action, id et attributs.
export function kitify(html) {
  return html
    .replace(/<label class="toggle"><input type="checkbox" ([^>]*)>\s*([\s\S]*?)<\/label>/g, (m, a, t) => `<label class="m-card mp-sw"><span class="mp-sw-t"><b>${t}</b></span><span class="m-switch"><input type="checkbox" ${a}><span class="m-sw" aria-hidden="true"></span></span></label>`)
    .replace(/class="btn btn-danger small"|class="btn small btn-danger"|class="btn btn-danger"/g, 'class="m-btn mp-danger"')
    .replace(/class="btn small btn-primary"|class="btn btn-primary"|class="btn btn-gold small"|class="btn small btn-gold"|class="btn btn-gold"/g, 'class="m-btn ready"')
    .replace(/class="btn small( [^"]*)?"|class="btn( [^"]*)?"/g, 'class="m-btn"')
    .replace(/<div class="row"( [^>]*)?>/g, '<div class="mp-form">').replace(/<div class="options-row">/g, '<div class="mp-btnrow">')
    .replace(/<div class="row-between">/g, '<div class="mp-between">')
    .replace(/<details class="update-notes"/g, '<details class="m-card mp-det"')
    .replace(/<div class="section-title">/g, '<div class="mp-sub">')
    .replace(/<div class="card( danger-zone)?">/g, (m, d) => `<div class="m-card${d ? ' mp-dz' : ''}">`);
}

// « Cet appareil » (Paramètres › Interface) : mêmes réglages et mêmes actions (device-pref via mp-pick) que sur PC, en puces et interrupteurs.
export function interfaceExtraPhone(pref) {
  const chips = (name, label, items) => mpField(label, `<div class="m-chips mp-chips${items.length > 3 ? ' mp-scroll' : ''}" role="group" aria-label="${escapeHtml(label)}">${items.map(([v, l]) => mChip(l, { action: 'mp-pick', value: v, on: String(pref(name)) === String(v), attrs: `data-for="device-pref" data-key="${name}"` })).join('')}</div>`);
  const sw = (name, label, sub) => mpSwitch(label, 'device-pref', pref(name) === true, { attrs: `data-key="${name}"`, sub });
  return `${mpSec('Cet appareil')}
    ${chips('combat', 'Combat', [['simple', 'Simple'], ['full', 'Complet']])}
    ${chips('motion', 'Animations', [['auto', 'Auto'], ['reduce', 'Réduites'], ['full', 'Complètes']])}
    ${chips('uiScale', 'Taille de l\'interface', [['auto', 'Auto'], [100, '100 %'], [125, '125 %'], [150, '150 %'], [200, '200 %']])}
    ${sw('compact', 'Mode compact', 'Listes serrées')}${sw('qtyMenu', 'Quantité en un bouton', 'Essai · Améliorations')}${sw('skillGrid', 'Compétences en grille', 'Essai')}
    ${sw('bossFocus', 'Mode boss réduit', 'Essai · boutons estompés')}${sw('panelFold', 'Panneau à deux hauteurs', 'Essai · ▼ rétracte')}
    ${sw('colorAid', 'Aide aux couleurs', 'Lettre de rareté')}${sw('contrast', 'Contraste élevé', 'Sans décor animé')}`;
}
