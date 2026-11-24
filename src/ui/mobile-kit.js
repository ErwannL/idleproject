// v10.12 : KIT MOBILE — petits helpers qui rendent du HTML (chaînes) pour le téléphone. Le style est dans mobile-kit.css
// (toutes ses règles sont sous `#app.m-phone` : rien ne change sur PC). Tout texte passé ici est échappé.
// Les clics restent ceux de l'interface : on passe un `data-action` (et `data-id` / `data-value`), ui.js les distribue.
//
// Recette pour un onglet (3 lignes) :
//   1. enveloppe l'écran : `<div class="m-frame">${mTitle('icon_gear', 'Forge', 'Aide…')}${mModes(modes, mode)} … </div>`
//   2. remplace tes propres cartes par `<div class="m-card">`, tes cases par mTile(), tes lignes par mStat(), tes coûts par mCost() ;
//   3. un seul mBtnGold() visible par écran (l'action principale) ; les autres boutons : mBtn().
//
// Helpers (signature : exemple)
//   mTitle(icon, label, help?, opts?)   Cartouche de titre ; `help` (texte) ajoute le « ? » (action m-help = bascule l'aide du panneau).
//                                       mTitle('icon_helm', 'Équipement', true)   opts : { back: 'action', close: 'action' }
//   mTabs(items, current)               Onglets d'un menu (icône + nom, 64 px). items : [{ id, label, icon, action, value, badge }].
//                                       mTabs([{ id: 'sets', label: 'Sets', icon: 'icon_book', action: 'inv-mode', value: 'sets' }], 'sets')
//   mModes(items, current, opts?)       Rangée de modes (72 px ; opts.size = 64 pour les fiches ; opts.arrow = flèche sous le choisi). Mêmes items.
//   mTile(item, opts)                   Case d'objet (item : { name, rarity, upgrades, slot, locked… }) ; opts : { size: 48|56|64|72|80|96|110 (72 et 110 : PC, voir desk-kit.css),
//                                       action, id, value, attrs, up (▲), badge ('+817 %'), bang (« ! »), empty (silhouette), slot, label, selected, plus, pips }.
//                                       mTile(item, { size: 80, action: 'select-item', up: true })
//   mPips(rarity)                       Pastilles de rareté (1 Commun … 7 Ascendant, ordre de RARITIES). mPips('epic') → 3 pastilles.
//   mStat(icon, label, value, big?)     Ligne de statistique (valeur à droite) ; `big` = statistique principale. mStat('icon_sword', 'Dégâts', '4 218', true)
//   mCost(icon, have, need)             Coût : case avec l'icône, « ce que tu as / ce qu'il faut » (vert si assez, rouge sinon).
//                                       have/need : nombres (comparés) ou textes déjà formatés (alors passe { ok: true|false } en 4e argument).
//   mSheet(title, body, opts?)          Fiche plein écran (role="dialog"), son propre cartouche avec ‹ retour et ✕ ; opts : { id, back: 'action', close: 'action', help }.
//                                       Par défaut ‹ et ✕ ferment la fiche (action m-sheet-close : retire le nœud).
//   mChip(label, opts?)                 Puce 32 px ; opts : { action, value, on, icon, attrs }.   mChip('Tout', { action: 'filter', value: 'all', on: true })
//   mEmpty(text, opts?)                 État vide ; opts : { icon, button: mBtnGold(...) }.        mEmpty('Rien ici', { icon: 'icon_chest' })
//   mBtnGold(label, opts?)              L'action principale (56 px, dorée) ; opts : { action, id, value, icon, disabled, attrs }.
//   mBtn(label, opts?)                  Action secondaire (44 px, sombre). Mêmes opts.
//   mBar(pct, kind?)                    Barre de 8 px ; kind 'hp' = verte.                          mBar(0.4)
//   mGrid(cells, cols?)                 Grille de cases (5 colonnes par défaut). cells : tableau de chaînes (mTile…).
import { RARITIES } from '../data/items.js';
import { escapeHtml, icon, img, itemPic } from './common.js';

const RANK = Object.fromEntries(RARITIES.map((r, i) => [r.id, i + 1]));
const e = (v) => escapeHtml(v ?? '');
const attr = (o = {}) => [
  o.action ? `data-action="${e(o.action)}"` : '',
  o.id !== undefined && o.id !== null ? `data-id="${e(o.id)}"` : '',
  o.value !== undefined && o.value !== null ? `data-value="${e(o.value)}"` : '',
  o.attrs ?? '', // déjà du HTML d'attributs écrit par l'appelant (ex. 'data-key="damage"') : ne pas y mettre de texte joueur
].filter(Boolean).join(' ');
const ico = (name) => (name ? img(name) : '');
const safePic = (it) => { try { return itemPic(it); } catch { return it?.slot ? `assets/ui/art106/slot_empty_${it.slot}.png` : ''; } }; // objet sans modèle connu : silhouette de la place

// Une pastille par rang de rareté (pas des étoiles : le jeu n'a pas d'étoiles d'objet).
export function mPips(rarity) {
  const n = RANK[rarity] ?? 1;
  return `<span class="m-pips r-${RANK[rarity] ? rarity : 'common'} p-${RANK[rarity] ? rarity : 'common'}" role="img" aria-label="Rareté ${n} sur ${RARITIES.length}">${'<i></i>'.repeat(n)}</span>`;
}

export function mTitle(icon, label, help, opts = {}) {
  const btn = (cls, action, text, aria) => `<button type="button" class="${cls}" data-action="${e(action)}" aria-label="${aria}">${text}</button>`;
  return `<header class="m-title">${opts.back ? btn('m-back', opts.back, '‹', 'Retour') : ''}<span class="m-title-in">${ico(icon)}<b>${e(label)}</b></span>`
    + `${help ? btn('m-help', 'm-help', '?', 'Aide') : ''}${opts.close ? btn('m-close', opts.close, '✕', 'Fermer') : ''}</header>`;
}

const tabButton = (cls) => (it, current) => {
  const sel = it.id === current;
  return `<button type="button" class="${cls}${sel ? ' active' : ''}" role="tab" aria-selected="${sel}" data-m="${e(it.id)}" ${attr({ action: it.action, value: it.value, attrs: it.attrs })}>${ico(it.icon)}<span>${e(it.label)}</span>${it.badge ? `<i class="m-dot" aria-label="${typeof it.badge === 'string' ? e(it.badge) : 'À voir'}"></i>` : ''}</button>`;
};
export const mTabs = (items = [], current) => `<div class="m-tabs" role="tablist">${items.map((it) => tabButton('m-tab')(it, current)).join('')}</div>`;
export const mModes = (items = [], current, opts = {}) => `<div class="m-modes${opts.size === 64 ? ' s64' : ''}${opts.arrow ? ' arrow' : ''}" role="tablist">${items.map((it) => tabButton('m-mode')(it, current)).join('')}</div>`;

export function mTile(item, opts = {}) {
  const it = item ?? {};
  const rarity = RANK[it.rarity] ? it.rarity : 'common';
  const size = [48, 56, 64, 72, 80, 96, 110].includes(opts.size) ? opts.size : 64;
  const empty = opts.empty || !item;
  const slot = opts.slot ?? it.slot;
  const pic = empty
    ? (slot ? `<img class="px m-tile-img" src="assets/ui/art106/slot_empty_${e(slot)}.png" alt="" data-fallback="remove">` : '')
    : `<img class="px m-tile-img" src="${e(opts.src ?? safePic(it))}" alt="${e(it.name)}">`;
  const plus = opts.plus ?? (it.upgrades ? `+${it.upgrades}` : '');
  const title = empty ? '' : ` title="${e(it.name)}"`;
  const cls = `m-tile s${size} r-${empty ? 'common' : rarity}${empty ? ' empty' : ''}${opts.selected ? ' selected' : ''}`;
  const inner = `${pic}${!empty && plus ? `<span class="m-plus">${e(plus)}</span>` : ''}${empty ? '<span class="m-add" aria-hidden="true">+</span>' : opts.pips === false ? '' : mPips(rarity)}`
    + `${opts.up ? '<i class="m-up" title="Meilleur dans le sac">▲</i>' : ''}${opts.bang ? '<i class="m-bang" aria-label="À faire">!</i>' : ''}`
    + `${opts.badge ? `<span class="m-gain${String(opts.badge).startsWith('−') || String(opts.badge).startsWith('-') ? ' neg' : ''}">${e(opts.badge)}</span>` : ''}`
    + `${!empty && it.locked ? `<img class="px m-lock" src="${icon('icon_lock', 1)}" alt="Verrouillé">` : ''}`;
  const aria = ` aria-label="${e(empty ? (opts.label ?? 'Place vide') : `${it.name}${it.upgrades ? ` +${it.upgrades}` : ''}`)}"`;
  const tile = opts.action || opts.id !== undefined || opts.attrs
    ? `<button type="button" class="${cls}"${title}${aria} ${attr(opts)}>${inner}</button>`
    : `<span class="${cls}"${title}${aria}>${inner}</span>`;
  return opts.label ? `<span class="m-tilewrap">${tile}<small>${e(opts.label)}</small></span>` : tile;
}

export const mStat = (icon, label, value, big = false) => `<div class="m-stat${big ? ' big' : ''}">${ico(icon)}<span class="m-k">${e(label)}</span><b class="m-v">${e(value)}</b></div>`;

// have/need : nombres (« ok » = have >= need) ou textes ; `fmt` formate les nombres (par défaut : tels quels).
export function mCost(icon, have, need, extra = {}) {
  const ok = extra.ok ?? (typeof have === 'number' && typeof need === 'number' ? have >= need : true);
  const f = extra.fmt ?? ((n) => String(n));
  const txt = (v) => (typeof v === 'number' ? f(v) : v);
  return `<span class="m-cost ${ok ? 'ok' : 'ko'}"><span class="m-cost-ico">${ico(icon)}</span><span class="m-cost-n">${e(txt(have))}/${e(txt(need))}</span></span>`;
}

export function mSheet(title, body, opts = {}) {
  const back = opts.back ?? 'm-sheet-close';
  const close = opts.close ?? 'm-sheet-close';
  return `<section class="m-sheet" role="dialog" aria-modal="true" aria-label="${e(title)}"${opts.id ? ` id="${e(opts.id)}"` : ''}>`
    + `${mTitle(opts.icon, title, opts.help, { back, close })}<div class="m-sheet-body">${body ?? ''}</div></section>`;
}

export const mChip = (label, opts = {}) => `<button type="button" class="m-chip${opts.on ? ' on' : ''}"${opts.on !== undefined ? ` aria-pressed="${!!opts.on}"` : ''} ${attr(opts)}>${ico(opts.icon)}${e(label)}</button>`;
export const mEmpty = (text, opts = {}) => `<div class="m-empty">${ico(opts.icon)}<p>${e(text)}</p>${opts.button ?? ''}</div>`;
const btn = (cls) => (label, opts = {}) => `<button type="button" class="${cls}${opts.cls ? ` ${e(opts.cls)}` : ''}" ${opts.disabled ? 'disabled' : ''} ${attr(opts)}>${ico(opts.icon)}<span>${e(label)}</span></button>`;
export const mBtnGold = btn('m-btn-gold');
export const mBtn = btn('m-btn');
export const mBar = (pct, kind = '') => `<div class="m-bar${kind ? ` ${e(kind)}` : ''}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(Math.max(0, Math.min(1, pct)) * 100)}"><i style="--pct:${Math.round(Math.max(0, Math.min(1, pct)) * 1000) / 10}%"></i></div>`;
export const mGrid = (cells = [], cols = 5) => `<div class="m-grid" style="--cols:${Math.max(1, cols | 0)}">${cells.join('')}</div>`;
