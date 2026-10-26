// Clavier (v8.1, v8.2) : raccourcis + navigation complète.
// - Flèches : déplacent la sélection d'un bouton / champ à l'autre (au plus proche dans la direction) ;
// - Entrée ou Espace : active l'élément sélectionné ; Entrée MAINTENUE = clic maintenu (anneau puis répétition) ;
// - raccourcis directs (onglets, vitesse, boosts…). Ignorés quand on tape dans un champ.
import { RUSHES } from '../data/rushes.js';
import { holdKeys } from './hold.js';

export const SHORTCUTS = [
  ['← ↑ → ↓', 'Se déplacer entre les boutons (la sélection est encadrée en or)'],
  ['Entrée ou Espace', 'Activer le bouton sélectionné'],
  ['Entrée maintenue', 'Comme le clic maintenu : achète / améliore en continu'],
  ['1 … 0', 'Ouvrir / fermer les onglets (dans l\'ordre de la barre)'],
  ['[ ] ou Page préc. / suiv.', 'Onglet précédent / suivant'],
  ['Tab', 'Élément suivant (Maj + Tab : précédent)'],
  ['Échap', 'Fermer le panneau ou la fenêtre'],
  ['A (ou Espace sans sélection)', 'Avance automatique / mode farm'],
  ['V', 'Vitesse des combats (×1, ×2, ×5, ×10)'],
  ['Q W E R T', 'Lancer les boosts (Rage, Frénésie, Midas, Œil, Lame)'],
  ['G', 'Tout récupérer (missions et récompenses)'],
  ['M · N · P', 'Missions · Récompenses · Paramètres'],
  ['K ou ?', 'Afficher cette aide'],
];

const BOOST_KEYS = ['q', 'w', 'e', 'r', 't'];
const FOCUSABLE = 'button:not([disabled]), select:not([disabled]), input:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';
const ARROWS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

const visible = (el) => {
  if (!el.isConnected || el.closest('.hidden')) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight;
};

// Zone de navigation : la fenêtre modale si elle est ouverte, sinon toute l'interface.
function scope(ui) {
  const modal = ui.root.querySelector('#modal:not(.hidden) #modal-card');
  return modal ?? ui.root;
}

export function focusables(ui) {
  return [...scope(ui).querySelectorAll(FOCUSABLE)].filter(visible);
}

// Navigation spatiale : le candidat le plus proche dans la direction voulue (l'écart latéral compte double).
function moveFocus(ui, dx, dy) {
  const list = focusables(ui);
  if (!list.length) return;
  const cur = document.activeElement;
  if (!cur || !list.includes(cur)) {
    const first = ui.root.querySelector('#panel-body') && list.find((el) => el.closest('#panel-body'));
    (first ?? list[0]).focus();
    return;
  }
  const a = cur.getBoundingClientRect();
  const ax = a.left + a.width / 2;
  const ay = a.top + a.height / 2;
  let best = null;
  let bestScore = Infinity;
  for (const el of list) {
    if (el === cur) continue;
    const b = el.getBoundingClientRect();
    const bx = b.left + b.width / 2;
    const by = b.top + b.height / 2;
    const along = (bx - ax) * dx + (by - ay) * dy;
    if (along <= 2) continue;
    const across = Math.abs((bx - ax) * dy) + Math.abs((by - ay) * dx);
    const score = along + across * 2;
    if (score < bestScore) { bestScore = score; best = el; }
  }
  if (best) {
    best.focus();
    best.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
}

function focusPanelStart(ui) {
  setTimeout(() => {
    const el = focusables(ui).find((e) => e.closest('#panel-body'));
    el?.focus({ preventScroll: true });
  }, 60);
}

export function installShortcuts(ui) {
  window.addEventListener('keyup', (e) => { if (e.key === 'Enter' || e.key === ' ') holdKeys.keyUp(); });
  window.addEventListener('keydown', (e) => {
    ui.userAt = performance.now(); // action du joueur : le panneau se redessine tout de suite
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    const t = e.target;
    const typing = t && (t.tagName === 'INPUT' && t.type !== 'checkbox' && t.type !== 'range' || t.tagName === 'TEXTAREA' || t.isContentEditable);
    if (typing) {
      if (e.key === 'Escape') t.blur();
      return;
    }
    // Animation d'invocation ouverte : Entrée / Espace / Échap la font avancer.
    const fx = document.querySelector('.summon-fx');
    if (fx && (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape')) {
      e.preventDefault();
      if (!e.repeat) fx.click();
      return;
    }
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const focused = document.activeElement;
    const onButton = focused && focused !== document.body && ui.root.contains(focused) && focused.matches('button, summary');
    const onControl = focused && focused !== document.body && ui.root.contains(focused) && focused.matches('select, input');

    if (ARROWS[key]) {
      if (onControl && focused.tagName === 'SELECT' && (key === 'ArrowUp' || key === 'ArrowDown')) return; // choix de la liste
      if (onControl && focused.type === 'range' && (key === 'ArrowLeft' || key === 'ArrowRight')) return; // curseur de volume
      e.preventDefault();
      moveFocus(ui, ...ARROWS[key]);
      return;
    }
    if (key === 'Enter' && onButton) {
      // Entrée maintenue = clic maintenu ; sinon un seul clic (pas de répétition clavier sur les autres boutons).
      if (holdKeys.keyDown(focused) || e.repeat) e.preventDefault();
      return;
    }
    if (key === ' ' && (onButton || onControl)) return; // Espace active l'élément sélectionné
    if (e.repeat) return;

    const tabs = [...ui.root.querySelectorAll('#tabs button:not(.hidden)')];
    const click = (sel) => ui.root.querySelector(sel)?.click();
    let handled = true;
    if (/^[0-9]$/.test(key)) {
      const btn = tabs[key === '0' ? 9 : Number(key) - 1];
      if (btn) { btn.click(); if (ui.tab) focusPanelStart(ui); } else handled = false;
    } else if (key === ' ' || key === 'a') click('#auto-toggle');
    else if (key === 'v') click('#speed-toggle');
    else if (BOOST_KEYS.includes(key)) {
      const rush = RUSHES[BOOST_KEYS.indexOf(key)];
      const btn = rush && ui.root.querySelector(`#rush-bar [data-value="${rush.id}"]`);
      if (btn) btn.click(); else handled = false;
    } else if (key === 'g') {
      ui.actions.claimAll?.();
      ui.actions.claimAllEvents?.();
    } else if (key === 'm') { ui.toggleTab('contracts'); if (ui.tab) focusPanelStart(ui); }
    else if (key === 'n') { ui.toggleTab('inbox'); if (ui.tab) focusPanelStart(ui); }
    else if (key === 'p') { ui.toggleTab('options'); if (ui.tab) focusPanelStart(ui); }
    else if (key === ']' || key === '[' || key === 'PageDown' || key === 'PageUp') {
      if (!tabs.length) return;
      const i = tabs.findIndex((b) => b.dataset.tab === ui.tab);
      const fwd = key === ']' || key === 'PageDown';
      const next = tabs[(i + (fwd ? 1 : -1) + tabs.length) % tabs.length];
      if (next.dataset.tab !== ui.tab) next.click();
      focusPanelStart(ui);
    } else if (key === 'k' || key === '?') ui.showShortcuts();
    else handled = false;
    if (handled) e.preventDefault();
  });
}

export function shortcutsHtml() {
  return `<table class="shortcuts">${SHORTCUTS.map(([k, d]) => `<tr><td><kbd>${k}</kbd></td><td>${d}</td></tr>`).join('')}</table>`;
}
