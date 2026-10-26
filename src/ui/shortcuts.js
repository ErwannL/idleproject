// Raccourcis clavier (v8.1) : tout le jeu au clavier sur PC.
// Ignorés quand on tape dans un champ (code secret…) ou avec Ctrl/Alt/Méta.
import { RUSHES } from '../data/rushes.js';

export const SHORTCUTS = [
  ['1 … 0', 'Ouvrir / fermer les onglets (dans l\'ordre de la barre)'],
  ['Échap', 'Fermer le panneau ou la fenêtre'],
  ['Espace ou A', 'Avance automatique / mode farm'],
  ['V', 'Vitesse des combats (×1, ×2, ×5, ×10)'],
  ['Q W E R T', 'Lancer les boosts (Rage, Frénésie, Midas, Œil, Lame)'],
  ['G', 'Tout récupérer (missions et récompenses)'],
  ['M', 'Missions et contrats'],
  ['N', 'Boîte de récompenses'],
  ['P', 'Paramètres'],
  ['← →', 'Onglet précédent / suivant'],
  ['K ou ?', 'Afficher cette aide'],
];

const BOOST_KEYS = ['q', 'w', 'e', 'r', 't'];

export function installShortcuts(ui) {
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.altKey || e.metaKey || e.repeat) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const tabs = [...ui.root.querySelectorAll('#tabs button:not(.hidden)')];
    const click = (sel) => ui.root.querySelector(sel)?.click();
    let handled = true;
    if (/^[0-9]$/.test(key)) {
      const btn = tabs[key === '0' ? 9 : Number(key) - 1];
      if (btn) btn.click(); else handled = false;
    } else if (key === ' ' || key === 'a') click('#auto-toggle');
    else if (key === 'v') click('#speed-toggle');
    else if (BOOST_KEYS.includes(key)) {
      const rush = RUSHES[BOOST_KEYS.indexOf(key)];
      const btn = rush && ui.root.querySelector(`#rush-bar [data-value="${rush.id}"]`);
      if (btn) btn.click(); else handled = false;
    } else if (key === 'g') {
      ui.actions.claimAll?.();
      ui.actions.claimAllEvents?.();
    } else if (key === 'm') ui.toggleTab('contracts');
    else if (key === 'n') ui.toggleTab('inbox');
    else if (key === 'p') ui.toggleTab('options');
    else if (key === 'ArrowRight' || key === 'ArrowLeft') {
      if (!tabs.length) return;
      const i = tabs.findIndex((b) => b.dataset.tab === ui.tab);
      const next = tabs[(i + (key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
      if (next.dataset.tab !== ui.tab) next.click();
    } else if (key === 'k' || key === '?') ui.showShortcuts();
    else handled = false;
    if (handled) e.preventDefault();
  });
}

export function shortcutsHtml() {
  return `<table class="shortcuts">${SHORTCUTS.map(([k, d]) => `<tr><td><kbd>${k}</kbd></td><td>${d}</td></tr>`).join('')}</table>`;
}
