// v10.12 (§ 8) : contrôle automatique « vrai jeu mobile » : ouvre chaque onglet en téléphone et vérifie 7 choses.
//   node tools/mobile-audit.mjs [--sizes 390x844,412x915] [--tabs inventory,shop] [--out docs/screenshots/v10.12] [--games endgame,fresh]
// Contrôles : 1 pas de défilement horizontal · 2 pas de boutons qui se chevauchent · 3 boutons d'au moins 44 px de haut ·
// 4 un .m-title et au plus un .m-btn-gold visible · 5 aucun <select> visible · 6 stabilité (fiche ouverte/fermée : même scrollTop ;
// changer de mode : même haut de cadre) · 7 aucun mot coupé au milieu · 8 image d'événement entièrement dans son cadre ·
// 9 une image chargée pour chaque objet, compétence, branche de talent, compagnon et recherche affichés (et aucune <img> cassée) ·
// 10 aucun texte sous 11 px · 11 aucun texte tronqué (scrollWidth > clientWidth avec ellipsis / overflow caché) ·
// 12 un seul bouton VISUELLEMENT doré (fond or, pas seulement .m-btn-gold) · 13 aucun élément du HUD de combat (#hud106, #zone-card,
// #combat-console) visible par-dessus un panneau qui n'est pas une page (Arène) · 14 #panel-subtabs sans .m-many : aucun onglet dont le texte
// dépasse le bouton · 15 aucune zone verticale vide de plus de 120 px dans un .m-frame / .m-card. v10.17 : 18 au plus 4 styles de
// bouton sur l'ensemble des écrans (tools/audit-1017.mjs) · 19 textes les plus longs injectés : ils défilent s'ils ne tiennent pas
// (tools/text-fit-audit.mjs ; --no-fit pour sauter). v10.17.1 : 20 le bouton doré principal visible est dans le dernier quart du cadre, ou épinglé en bas (tools/audit-1017.mjs).
// v10.18 (2.6, 3.5 ; tools/audit-1018.mjs) : 21 aucun bouton recouvert par un autre au point de contact · 22 aucun texte « Pas disponible
// pour l'instant » · 23 aucun sous-onglet sous la croix ✕ · 24 écran de combat : aucun bloc de #stage-area / #combat-console n'en chevauche un autre.
// Tailles par défaut : 412x915, 405x896, 390x844, 360x800.
// Code de sortie 1 au moindre défaut.
// Une capture JPEG par onglet : <taille>-<onglet>.jpg (partie de fin de jeu) ou <taille>-neuve-<onglet>.jpg (partie neuve).
import { createRequire } from 'node:module';
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { startServer } from './serve.mjs';
import { audit1016Init } from './audit-1016.mjs'; // v10.16 (B9) : contrôles 16 et 17
import { audit1017Init, BTN_EXCLUDE, MAX_BTN_STYLES } from './audit-1017.mjs'; // v10.17 (D) : contrôle 18
import { audit1018Init } from './audit-1018.mjs'; // v10.18 (2.6, 3.5) : contrôles 21 à 24
import { textFitAudit, textFitLists } from './text-fit-audit.mjs'; // v10.17 (C5) : contrôle 19
const { chromium } = createRequire(import.meta.url)('playwright');

const ALL_TABS = ['combat', 'inventory', 'upgrades', 'skills', 'tree', 'forge', 'companions', 'camp', 'expeditions', 'campaign', 'dungeons', 'arena', 'tower', 'event', 'summon', 'shop', 'daybook', 'contracts', 'encyclopedia', 'looks', 'boss', 'ranking', 'guild', 'stats', 'options'];
const CHECKS = { 1: 'défilement horizontal', 2: 'boutons qui se chevauchent', 3: 'bouton trop bas (principal < 44 px, autre < 40 px)', 4: 'cartouche / bouton doré', 5: '<select> visible', 6: 'stabilité (fiche, modes)', 7: 'mot coupé', 8: "image d'événement hors de son cadre", 9: 'image manquante / non chargée', 10: 'texte sous 11 px', 11: 'texte tronqué', 12: 'plusieurs boutons visuellement dorés', 13: 'HUD de combat par-dessus un panneau', 14: 'onglet dont le texte dépasse le bouton', 15: 'zone vide de plus de 120 px dans un cadre', 16: 'libellé terminé par un point d\'abréviation', 17: 'bouton désactivé sans explication', 18: 'plus de 4 styles de bouton (tous écrans confondus)', 19: 'texte long coupé sans défiler (textes injectés)', 20: 'bouton doré principal pas en bas du cadre', 21: 'bouton recouvert au point de contact', 22: 'texte « Pas disponible pour l\'instant »', 23: 'sous-onglet sous la croix ✕', 24: 'blocs de l\'écran de combat qui se chevauchent' };

const argv = process.argv.slice(2);
const opt = (name, def) => { const i = argv.indexOf(`--${name}`); return i >= 0 && argv[i + 1] ? argv[i + 1] : def; };
const sizes = opt('sizes', '412x915,405x896,390x844,360x800').split(',').map((s) => s.trim().split('x').map(Number));
const tabs = opt('tabs', ALL_TABS.join(',')).split(',').map((s) => s.trim()).filter(Boolean);
const out = opt('out', 'docs/screenshots/v10.12');
const games = opt('games', 'endgame,fresh').split(',').map((s) => s.trim());

// --- Contrôles exécutés dans la page (1 à 5 et 7) -----------------------------------------------------------------------
function inPage(isCombat) {
  const issues = [];
  const add = (check, msg) => issues.push({ check, msg });
  const vw = window.innerWidth;
  const panel = document.querySelector('#panel');
  const tabsBar = document.querySelector('#tabs');
  const areaTop = panel && !panel.classList.contains('hidden') ? panel.getBoundingClientRect().top : 0;
  const areaBottom = tabsBar ? tabsBar.getBoundingClientRect().top : window.innerHeight;
  const name = (el) => `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}` : ''} « ${(el.textContent || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 24)} »`;
  // Visible = taille non nulle, pas masqué, et réellement au-dessus des autres au centre (pas caché derrière une fiche).
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) return false;
    const cx = Math.min(Math.max(r.left + r.width / 2, 0), vw - 1), cy = Math.min(Math.max(r.top + r.height / 2, areaTop), areaBottom - 1);
    if (r.bottom <= areaTop || r.top >= areaBottom || r.right <= 0 || r.left >= vw) return false;
    const top = document.elementFromPoint(cx, cy);
    return !!top && (el === top || el.contains(top) || top.contains(el));
  };
  const body = document.querySelector('#panel-body');
  // 1. défilement horizontal
  if (body && body.scrollWidth > body.clientWidth + 1) add(1, `#panel-body scrollWidth ${body.scrollWidth} > clientWidth ${body.clientWidth}`);
  if (document.documentElement.scrollWidth > vw + 1) add(1, `la page déborde : ${document.documentElement.scrollWidth} > ${vw}`);
  // boutons visibles les plus extérieurs (un bouton dans un bouton compte une fois)
  const sel = 'button, [role="button"], [data-action], a.btn, .btn';
  const root = document.querySelector('#modal:not(.hidden)') ?? panel;
  const all = [...(root ? root.querySelectorAll(sel) : [])].filter((el) => !el.disabled || true);
  const buttons = [];
  for (const el of all) {
    if (el.parentElement?.closest(sel) && root.contains(el.parentElement.closest(sel))) continue;
    if (el.closest('#panel-subtabs, header') && !el.classList.contains('subtab')) continue; // « ? » et ✕ du panneau : traités par le panneau
    if (!visible(el)) continue;
    buttons.push(el);
  }
  // les fiches plein écran sont dans #panel : on les prend aussi (déjà couvertes par root = #panel)
  // 2. chevauchements
  for (let i = 0; i < buttons.length; i++) {
    const a = buttons[i].getBoundingClientRect();
    for (let j = i + 1; j < buttons.length; j++) {
      const b = buttons[j].getBoundingClientRect();
      const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (Boolean(buttons[i].closest('.gold-dock')) !== Boolean(buttons[j].closest('.gold-dock'))) continue; // v10.17.1 (6) : pied doré épinglé par-dessus la liste qui défile
      if (ox > 2 && oy > 2) add(2, `${name(buttons[i])} et ${name(buttons[j])} (${Math.round(ox)}×${Math.round(oy)} px)`);
    }
  }
  // 3. hauteur minimale (les .m-chip ont une zone tactile de 44 px par ::after ; les cases .m-tile font 44 px au moins).
  //    v10.17.1 (8) : 44 px pour le bouton doré principal, 40 px au moins pour tout autre bouton (boutons secondaires de 40 px).
  for (const el of buttons) {
    if (el.classList.contains('m-chip') || el.tagName === 'INPUT') continue;
    const h = el.getBoundingClientRect().height;
    const main = el.matches('.m-btn-gold, .btn-gold');
    if (h < (main ? 43.5 : 39.5)) add(3, `${name(el)} : ${Math.round(h)} px (minimum ${main ? 44 : 40} px${main ? ', bouton principal' : ''})`);
  }
  // 4. cartouche + un seul bouton doré
  const titles = [...document.querySelectorAll('#panel .m-title, #modal:not(.hidden) .m-title')].filter(visible);
  if (!isCombat && !titles.length && !document.querySelector('#modal:not(.hidden)')) add(4, 'aucun .m-title visible');
  const golds = [...document.querySelectorAll('#panel .m-btn-gold, #modal .m-btn-gold')].filter(visible);
  if (golds.length > 1) add(4, `${golds.length} .m-btn-gold visibles : ${golds.map(name).join(' | ')}`);
  // 20. v10.17.1 (6) : le bouton doré principal est en bas du cadre (tools/audit-1017.mjs)
  if (!isCombat) for (const m of window.__goldLow?.(golds, { top: areaTop, bottom: areaBottom }) ?? []) add(20, m);
  // 5. <select>
  for (const el of document.querySelectorAll('#panel select, #modal select')) if (visible(el)) add(5, `${name(el)} visible`);
  // 7. mots coupés : un libellé court d'un seul mot qui passe sur 2 lignes, ou qui déborde de sa boîte
  const leaves = [...(root ?? document).querySelectorAll('b, span, small, label, h1, h2, h3, h4, strong, p, div, button')].filter((el) => {
    if (el.children.length && [...el.children].some((c) => c.textContent.trim())) return false;
    const t = el.textContent.trim();
    return t.length >= 3 && t.length <= 28 && visible(el);
  });
  for (const el of leaves) {
    const t = el.textContent.trim();
    const cs = getComputedStyle(el);
    if (cs.display === 'inline' && !el.closest('button')) continue;
    if (el.scrollWidth > el.clientWidth + 1 && cs.overflow !== 'visible' && cs.textOverflow === 'clip') add(7, `${name(el)} coupé (${el.scrollWidth} > ${el.clientWidth})`);
    if (!/\s/.test(t)) {
      const range = document.createRange(); range.selectNodeContents(el);
      const tops = new Set([...range.getClientRects()].filter((r) => r.width > 0).map((r) => Math.round(r.top / 4)));
      if (tops.size > 1) add(7, `mot coupé : « ${t} »`);
    }
  }
  // 8. image d'événement : (a) pastilles d'événements du HUD (.hq-ev-art) : l'image tient entièrement dans son carré, le carré dans l'écran ;
  //    (b) onglet Événement : affiche, carte d'image et bandeau défilant dans le cadre ; les images des cartes dans leur carte.
  for (const art of document.querySelectorAll('#hq-events .hq-ev-art')) {
    const ar = art.getBoundingClientRect();
    if (ar.width < 1 || getComputedStyle(art.closest('#hq-events')).visibility === 'hidden') continue;
    if (ar.left < -1 || ar.right > vw + 1) add(8, `${name(art)} sort de l'écran (${Math.round(ar.left)}..${Math.round(ar.right)})`);
    for (const im of art.querySelectorAll('img')) {
      const r = im.getBoundingClientRect();
      if (r.left < ar.left - 0.5 || r.right > ar.right + 0.5 || r.top < ar.top - 0.5 || r.bottom > ar.bottom + 0.5) add(8, `image d'événement ${Math.round(r.width)}×${Math.round(r.height)} sort de son carré ${Math.round(ar.width)}×${Math.round(ar.height)}`);
      if (!im.complete || im.naturalWidth < 1) add(8, `image d'événement non chargée : ${(im.getAttribute('src') ?? '').slice(-40)}`);
    }
  }
  if (document.querySelector('#panel .ev-grand, #panel .ev-small, #panel .ev-poster, #panel .ev-lanterns')) {
    const frame = document.querySelector('#panel .m-frame') ?? body;
    const fr = frame.getBoundingClientRect();
    for (const el of document.querySelectorAll('#panel .ev-grand, #panel .ev-small, #panel .ev-poster, #panel .ev-lanterns')) {
      const r = el.getBoundingClientRect();
      if (r.width < 1) continue;
      if (r.left < fr.left - 1 || r.right > fr.right + 1 || r.left < -1 || r.right > vw + 1) add(8, `${name(el)} dépasse de son cadre (${Math.round(r.left)}..${Math.round(r.right)} pour ${Math.round(fr.left)}..${Math.round(fr.right)})`);
      const cs = getComputedStyle(el);
      if (/url\(/.test(cs.backgroundImage) && !/cover|contain|%/.test(cs.backgroundSize)) add(8, `${name(el)} : fond d'affiche en taille « ${cs.backgroundSize} » (peut être rogné)`);
    }
    // les nœuds du bandeau défilant tiennent dans leur chemin (le chemin lui-même défile dans .ev-lanterns)
    for (const lanes of document.querySelectorAll('#panel .ev-lanes')) {
      const lr = lanes.getBoundingClientRect();
      for (const n of lanes.querySelectorAll('.lt-node')) { const r = n.getBoundingClientRect(); if (r.left < lr.left - 1 || r.right > lr.right + 1 || r.top < lr.top - 20 || r.bottom > lr.bottom + 1) add(8, `${name(n)} sort du chemin illustré`); }
    }
    for (const im of document.querySelectorAll('#panel .ev-poster img, #panel .ev-item img, #panel .ev-mission img, #panel .ev-give img')) {
      if (!visible(im)) continue;
      const r = im.getBoundingClientRect();
      const host = im.parentElement.closest('.m-card, .ev-poster, .ev-grand, .ev-small, button') ?? frame;
      const h = host.getBoundingClientRect();
      if (r.left < h.left - 1.5 || r.right > h.right + 1.5 || r.top < h.top - 1.5 || r.bottom > h.bottom + 1.5) add(8, `${name(im)} sort de ${name(host)} (${Math.round(r.width)}×${Math.round(r.height)})`);
    }
  }
  // 9. images : aucune <img> visible cassée ; chaque objet / compétence / branche / compagnon / recherche affiché porte une image chargée
  for (const im of document.querySelectorAll('#panel img, #modal:not(.hidden) img')) {
    if (!visible(im) || im.dataset.fallback === 'remove') continue;
    if (!im.complete || im.naturalWidth < 1) add(9, `<img> non chargée : ${(im.getAttribute('src') ?? '').slice(-40)}`);
  }
  const ENTITY = '.m-tile:not(.empty), .m-branch, .m-tnode, .mr-medal, .bs-node, .mt-ucard, .m-comp, .m-compcard, .m-unit, .m-sk-prev'; // objets, compétences, branches, talents, recherches, compagnons
  for (const el of document.querySelectorAll(ENTITY)) {
    if (!visible(el)) continue;
    const imgs = [...el.querySelectorAll('img')].filter((i) => i.naturalWidth > 0 && i.complete && i.getBoundingClientRect().width > 4);
    const bgs = [el, ...el.querySelectorAll('*')].some((n) => /url\(/.test(getComputedStyle(n).backgroundImage) || n.matches?.('canvas'));
    if (!imgs.length && !bgs) add(9, `${name(el)} sans image chargée`);
  }
  // 10. texte sous 11 px
  const seenSmall = new Set();
  for (const el of (root ?? document).querySelectorAll('*')) {
    if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length)) continue;
    if (el.closest('svg, script, style') || !visible(el)) continue;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs < 11 - 0.01) { const k = `${el.className}|${fs}`; if (!seenSmall.has(k)) { seenSmall.add(k); add(10, `${name(el)} : ${fs} px`); } }
  }
  // 11. texte tronqué : débordement caché ou ellipsis, horizontal ou en hauteur (line-clamp)
  for (const el of (root ?? document).querySelectorAll('*')) {
    if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length)) continue;
    if (!visible(el)) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'inline' || el.clientWidth < 1) continue;
    const hidX = cs.overflowX !== 'visible' && cs.overflowX !== 'auto' && cs.overflowX !== 'scroll', hidY = cs.overflowY === 'hidden' || cs.overflowY === 'clip';
    if ((hidX || cs.textOverflow === 'ellipsis') && el.scrollWidth > el.clientWidth + 1) add(11, `${name(el)} tronqué en largeur (${el.scrollWidth} > ${el.clientWidth})`);
    else if (hidY && el.scrollHeight > el.clientHeight + 2 && el.clientHeight > 0) add(11, `${name(el)} tronqué en hauteur (${el.scrollHeight} > ${el.clientHeight})`);
  }
  for (const el of (root ?? document).querySelectorAll('.mq-in')) { // v10.17 (C) : un texte enveloppé par src/ui/marquee.js qui dépasse doit défiler
    const box = el.parentElement; if (!box || !visible(box) || box.classList.contains('mq-on') || box.classList.contains('mq-wrap')) continue;
    if (box.scrollWidth > box.clientWidth + 1) add(11, `${name(box)} ne défile pas (${box.scrollWidth} > ${box.clientWidth})`);
  }
  // 12. un seul bouton d'action visuellement doré (fond or), qu'il porte .m-btn-gold ou non (puces, modes et cases sélectionnés = états, exclus)
  const goldish = (cs) => [...(cs.backgroundImage + ' ' + cs.backgroundColor).matchAll(/rgba?\((\d+), (\d+), (\d+)/g)].some((x) => +x[1] > 200 && +x[2] > 140 && +x[3] < 130);
  const vGold = [...document.querySelectorAll('#panel button, #panel [data-action], #modal:not(.hidden) button')].filter((b) => !b.disabled && !b.classList.contains('disabled') && !b.matches('.m-chip, .m-mode, .map-dot, .m-tile, .m-node, .m-tnode, .subtab') && !b.closest('#panel-subtabs') && visible(b) && goldish(getComputedStyle(b)));
  if (vGold.length > 1) add(12, `${vGold.length} boutons dorés : ${vGold.map(name).join(' | ')}`);
  // 13. HUD de combat : quand un panneau est ouvert sans être une page (téléphone), le HUD ne doit pas se montrer par-dessus la scène
  const appEl = document.querySelector('#app');
  if (!isCombat && appEl?.classList.contains('m-phone') && !appEl.classList.contains('page-ui') && panel && !panel.classList.contains('hidden')) {
    for (const el of document.querySelectorAll('#hud106, #zone-card, #combat-console')) {
      const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
      if (r.width > 1 && r.height > 1 && cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0) add(13, `${name(el)} visible par-dessus le panneau (${Math.round(r.width)}×${Math.round(r.height)})`);
    }
  }
  // 14. sous-onglets (sans .m-many) : le texte visible tient dans le bouton
  const subs = document.querySelector('#panel-subtabs');
  if (subs && !subs.classList.contains('m-many')) {
    for (const b of subs.querySelectorAll('.subtab')) {
      const br = b.getBoundingClientRect();
      if (br.width < 1) continue;
      const range = document.createRange(); range.selectNodeContents(b);
      const tr = range.getBoundingClientRect();
      if (b.scrollWidth > b.clientWidth + 1 || tr.right > br.right + 0.5 || tr.left < br.left - 0.5) add(14, `${name(b)} : texte ${Math.round(tr.left)}..${Math.round(tr.right)} hors du bouton ${Math.round(br.left)}..${Math.round(br.right)}`);
    }
  }
  // 15. zone vide : dans chaque .m-frame / .m-card visible (ni fond illustré, ni cadre qui défile), plus grand intervalle vertical sans contenu
  for (const box of document.querySelectorAll('#panel .m-frame, #panel .m-card, #modal:not(.hidden) .m-card')) {
    if (!visible(box)) continue;
    const bcs = getComputedStyle(box);
    if (/url\(/.test(bcs.backgroundImage) || box.matches('.m-empty, .m-sheet') || box.closest('.m-empty')) continue;
    const br = box.getBoundingClientRect();
    const lo = Math.max(br.top, areaTop), hi = Math.min(br.bottom, areaBottom);
    if (hi - lo < 130) continue;
    const spans = [];
    for (const el of box.querySelectorAll('*')) {
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) || el.matches('img, canvas, svg, button, input, progress, video') || /url\(/.test(cs.backgroundImage) || (cs.borderTopWidth !== '0px' && cs.borderTopStyle !== 'none') || el.matches('.m-bar, .m-bar *');
      if (!own) continue;
      if (r.bottom <= lo || r.top >= hi) continue;
      spans.push([Math.max(r.top, lo), Math.min(r.bottom, hi)]);
    }
    spans.sort((a, b) => a[0] - b[0]);
    // v10.17.1 (6) : la place laissée au-dessus du pied doré (.gold-dock, bouton principal posé en bas du cadre) est voulue
    const dockTop = box.querySelector(':scope > .gold-dock')?.getBoundingClientRect().top ?? -1e9;
    let cur = lo, best = 0, at = lo;
    for (const [a, b] of spans) { if (a - cur > best && Math.abs(a - dockTop) > 16) { best = a - cur; at = cur; } cur = Math.max(cur, b); }
    if (hi - cur > best) { best = hi - cur; at = cur; }
    if (best > 120) add(15, `${name(box)} : zone vide de ${Math.round(best)} px (à ${Math.round(at)} px du haut de l'écran)`);
  }
  // 16 et 17 (v10.16, B9) : libellés sans point d'abréviation ; chaque bouton désactivé a un texte d'explication (tools/audit-1016.mjs).
  const shownLoose = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || r.bottom <= areaTop || r.top >= window.innerHeight || r.right <= 0 || r.left >= vw) return false;
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false; }
    return true;
  };
  const panelOpen = panel && !panel.classList.contains('hidden');
  const roots = [isCombat || !panelOpen ? document.querySelector('#play') : panel, document.querySelector('#modal:not(.hidden)'), tabsBar].filter(Boolean);
  for (const x of window.__audit1016?.(roots, shownLoose) ?? []) add(x.check === 'abbr' ? 16 : 17, x.msg);
  // 21 à 24 (v10.18, parties 2.6 et 3.5 ; tools/audit-1018.mjs) : bouton recouvert au point de contact, texte générique
  // « Pas disponible pour l'instant », sous-onglet sous la croix ✕, blocs de l'écran de combat qui se chevauchent.
  const roots18 = (isCombat ? [document.querySelector('#stage-area'), document.querySelector('#combat-console'), tabsBar] : [panel, document.querySelector('#modal:not(.hidden)'), tabsBar]).filter(Boolean);
  for (const m of window.__touchCover?.(roots18) ?? []) add(21, m);
  for (const m of window.__genericWhy?.([document.body]) ?? []) add(22, m);
  if (!isCombat) for (const m of window.__subtabsUnderClose?.() ?? []) add(23, m);
  if (isCombat) for (const m of window.__hudOverlap?.() ?? []) add(24, m);
  return issues;
}

// --- Contrôle 6 : stabilité (modes, fiche) ------------------------------------------------------------------------------
async function stability(page) {
  const issues = [];
  const frameTop = () => page.evaluate(() => { const f = document.querySelector('#panel .m-frame, #panel-body > *'); return f ? Math.round(f.getBoundingClientRect().top) : null; });
  // modes : on touche chaque bouton de mode, le haut du cadre ne doit pas bouger
  const nModes = await page.evaluate(() => document.querySelectorAll('#panel-body .m-modes .m-mode[data-action]').length);
  if (nModes > 1) {
    const base = await frameTop();
    for (let i = 0; i < nModes; i++) {
      await page.evaluate((k) => document.querySelectorAll('#panel-body .m-modes .m-mode[data-action]')[k]?.click(), i);
      await page.waitForTimeout(350);
      const top = await frameTop();
      if (base !== null && top !== null && Math.abs(top - base) > 1) issues.push({ check: 6, msg: `mode ${i + 1}/${nModes} : le haut du cadre passe de ${base} à ${top} px` });
    }
  }
  // fiche : ouvrir une case puis fermer ne doit pas changer le défilement du corps
  const tile = await page.evaluate(() => { const t = document.querySelector('#panel-body .m-tile[data-action]'); return !!t; });
  if (tile) {
    await page.evaluate(() => { const b = document.querySelector('#panel-body'); b.scrollTop = Math.min(120, b.scrollHeight); });
    const before = await page.evaluate(() => document.querySelector('#panel-body').scrollTop);
    await page.evaluate(() => document.querySelector('#panel-body .m-tile[data-action]')?.click());
    await page.waitForTimeout(400);
    const opened = await page.evaluate(() => !!document.querySelector('#panel .m-sheet'));
    if (opened) {
      await page.evaluate(() => document.querySelector('#panel .m-sheet .m-close, #panel .m-sheet .m-back')?.click());
      await page.waitForTimeout(400);
      const after = await page.evaluate(() => document.querySelector('#panel-body').scrollTop);
      if (Math.abs(after - before) > 1) issues.push({ check: 6, msg: `fermer la fiche change le défilement : ${before} → ${after}` });
    }
  }
  return issues;
}

const server = await startServer(0);
const url = `http://localhost:${server.address().port}/`;
const browser = await chromium.launch();
const fixture = JSON.parse(await readFile('tests/fixtures/endgame.json', 'utf8'));
await mkdir(out, { recursive: true });

const report = []; // { game, size, tab, issues[], skipped }
const btnStyles = new Map(); // v10.17 (D) : style → premier exemple
for (const game of games) {
  for (const [width, height] of sizes) {
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.addInitScript(audit1016Init); // v10.16 (B9)
    await page.addInitScript(audit1017Init); // v10.17 (D)
    await page.addInitScript(audit1018Init); // v10.18 (2.6, 3.5)
    const jsErrors = [];
    page.on('pageerror', (e) => jsErrors.push(e.message));
    if (game === 'endgame') {
      await page.addInitScript((save) => { if (!sessionStorage.getItem('audit')) { localStorage.setItem('idle-rpg.save', save); sessionStorage.setItem('audit', '1'); } }, JSON.stringify(fixture));
    } else {
      await page.addInitScript(() => { if (!sessionStorage.getItem('audit')) { localStorage.removeItem('idle-rpg.save'); sessionStorage.setItem('audit', '1'); } });
    }
    await page.goto(url);
    await page.waitForFunction(() => window.__idle?.ui, null, { timeout: 30000 });
    await page.waitForTimeout(game === 'endgame' ? 6000 : 3000);
    const closeAll = () => page.evaluate(() => {
      document.querySelectorAll('#modal:not(.hidden) [data-action="close-modal"], #modal:not(.hidden) [data-action="offline-claim"]').forEach((b) => b.click());
      try { __idle.ui.closeModal(); } catch { /* rien */ }
      document.querySelectorAll('.tour button, .howto-card button, .learn-card button').forEach((b) => b.click()); // bulles du tutoriel (partie neuve)
      document.querySelectorAll('.prologue2, #boot, .tour').forEach((e) => e.remove());
    });
    await page.addStyleTag({ content: '[class*="tuto"], .tour { display: none !important; }' }); // bulles du tutoriel de la partie neuve : hors sujet ici
    await closeAll();
    for (const tab of tabs) {
      const rec = { game, size: `${width}x${height}`, tab, issues: [], skipped: null };
      if (tab === 'combat') { // écran de combat (panneau fermé) : pastilles d'événements du HUD
        await page.evaluate(() => { try { __idle.ui.closePanel(); } catch (e) { /* rien */ } });
        await page.waitForTimeout(1200);
        await closeAll();
        rec.issues.push(...await page.evaluate(inPage, true));
      } else {
      await page.evaluate((t) => { try { __idle.ui.openTab(t); } catch (e) { /* onglet inconnu */ } }, tab);
      await page.waitForTimeout(1500);
      await closeAll();
      const opened = await page.evaluate((t) => __idle.ui.tab === t && !document.querySelector('#panel')?.classList.contains('hidden'), tab);
      if (!opened) rec.skipped = 'onglet fermé (pas encore débloqué ?)';
      else {
        rec.issues.push(...await page.evaluate(inPage, false));
        rec.issues.push(...await stability(page));
        const st = await page.evaluate((ex) => window.__btnStyles?.([document.querySelector('#panel'), document.querySelector('#modal:not(.hidden)')].filter(Boolean), (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden', ex) ?? {}, BTN_EXCLUDE);
        for (const [k, v] of Object.entries(st)) if (!btnStyles.has(k)) btnStyles.set(k, `${rec.size} ${tab} : ${v}`);
      }
      }
      const file = join(out, `${width}x${height}-${game === 'fresh' ? 'neuve-' : ''}${tab}.jpg`);
      await page.screenshot({ path: file, type: 'jpeg', quality: 75 });
      report.push(rec);
      // on referme la fiche éventuellement laissée ouverte avant l'onglet suivant
      await page.evaluate(() => document.querySelectorAll('#panel .m-sheet .m-close').forEach((b) => b.click()));
    }
    if (game === 'endgame' && !process.argv.includes('--no-fit')) { // v10.17 (C5) : textes les plus longs injectés dans chaque cadre
      const L = await textFitLists(page);
      for (const v of ['combat', 'inventory', 'companions', 'skills', 'camp', 'encyclopedia', 'daybook', 'event']) {
        if (v === 'combat') { await page.evaluate(() => { try { __idle.ui.closePanel(); } catch { /* rien */ } }); await page.waitForTimeout(800); await closeAll(); } else {
          await page.evaluate((t) => { try { __idle.ui.openTab(t); } catch { /* rien */ } }, v); await page.waitForTimeout(1300); await closeAll();
          if (!await page.evaluate((t) => __idle.ui.tab === t, v)) continue;
        }
        const found = await textFitAudit(page, v, L);
        report.push({ game, size: `${width}x${height}`, tab: `${v} (textes longs)`, issues: found.map((x) => ({ check: 19, msg: `[${x.lang}] ${x.msg}` })), skipped: null });
      }
    }
    if (jsErrors.length) report.push({ game, size: `${width}x${height}`, tab: '(page)', issues: jsErrors.map((m) => ({ check: 0, msg: `erreur JS : ${m}` })) });
    await ctx.close();
  }
}
await browser.close();
server.close();
if (btnStyles.size > MAX_BTN_STYLES) report.push({ game: '*', size: '*', tab: '(boutons)', skipped: null, issues: [...btnStyles].map(([k, v]) => ({ check: 18, msg: `${k} — ${v}` })) });
console.log(`Styles de bouton : ${btnStyles.size} (au plus ${MAX_BTN_STYLES})`);

// --- Résumé ---------------------------------------------------------------------------------------------------------
const perCheck = Object.fromEntries(Object.keys(CHECKS).map((k) => [k, 0]));
let defects = 0, skipped = 0;
for (const r of report) {
  if (r.skipped) { skipped++; console.log(`  ${r.game} ${r.size} ${r.tab} : ignoré (${r.skipped})`); continue; }
  if (!r.issues.length) continue;
  console.log(`✘ ${r.game} ${r.size} ${r.tab} : ${r.issues.length} défaut(s)`);
  const seen = new Set();
  for (const i of r.issues) {
    perCheck[i.check] = (perCheck[i.check] ?? 0) + 1; defects++;
    const line = `    [${i.check}] ${i.msg}`;
    if (!seen.has(line) && seen.size < 6) { seen.add(line); console.log(line); }
  }
}
console.log('\n=== Résumé du contrôle mobile ===');
console.log(`${report.length - skipped} écrans contrôlés, ${skipped} ignorés, ${defects} défaut(s)`);
for (const [k, label] of Object.entries(CHECKS)) console.log(`  contrôle ${k} (${label}) : ${perCheck[k] ?? 0}`);
if (perCheck[0]) console.log(`  erreurs JS : ${perCheck[0]}`);
console.log(`Captures : ${out}`);
process.exit(defects ? 1 : 0);
