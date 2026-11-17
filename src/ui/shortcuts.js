// Clavier (v8.1, v8.2) : raccourcis + navigation complète.
// - Flèches : déplacent la sélection d'un bouton / champ à l'autre (au plus proche dans la direction) ;
// - Entrée ou Espace : active l'élément sélectionné ; Entrée MAINTENUE = clic maintenu (anneau puis répétition) ;
// - raccourcis directs (onglets, vitesse, boosts…). Ignorés quand on tape dans un champ.
import { RUSHES } from '../data/rushes.js';
import { rushSlots } from '../core/rushes.js'; // v9.6.3
import { holdKeys } from './hold.js';

// v9.1.0 : raccourcis configurables (Paramètres › Interface). Touche = caractère produit (e.key, en minuscule),
// gardée dans les réglages de l'appareil. Les chiffres des menus, les flèches, Entrée, Espace, Tab et Échap ne
// se changent pas.
export const DEFAULT_KEYS = {
  auto: 'a', speed: 'v', claim: 'g', missions: 'm', inbox: 'n', options: 'p', journal: 'j', help: 'k',
  session: 's', next: 'c', search: 'f', lootBag: 'b', boost0: 'q', boost1: 'w', boost2: 'e', boost3: 'r', boost4: 't',
};
export const KEY_LABELS = {
  auto: 'Avance automatique', speed: 'Vitesse des combats', claim: 'Tout récupérer', missions: 'Missions', inbox: 'À récupérer',
  lootBag: 'Sac de butin', options: 'Paramètres', journal: 'Journal de la session', help: 'Aide des raccourcis', session: 'Retour de session',
  next: 'Prochaine action', search: 'Recherche rapide', boost0: 'Boost 1 (Rage)', boost1: 'Boost 2 (Frénésie)', boost2: 'Boost 3 (Midas)',
  boost3: 'Boost 4 (Œil)', boost4: 'Boost 5 (Lame)',
};
let customKeys = {};
export function setCustomKeys(keys) { customKeys = keys && typeof keys === 'object' ? keys : {}; }
export function keyFor(action) { return customKeys[action] ?? DEFAULT_KEYS[action]; }
export function keyLabel(action) {
  const k = keyFor(action);
  return k === ' ' ? 'Espace' : k.length === 1 ? k.toUpperCase() : k;
}
// Action liée à une touche (ou null).
function actionForKey(key) {
  for (const action of Object.keys(DEFAULT_KEYS)) if (keyFor(action) === key) return action;
  return null;
}
// Une touche est libre si aucune autre action ne l'utilise et qu'elle n'est pas réservée.
export const RESERVED_KEYS = ['enter', ' ', 'tab', 'escape', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', '[', ']', '?', 'f9', 'f11', 'pageup', 'pagedown'];
export function keyConflict(action, key) {
  if (/^[0-9]$/.test(key) || RESERVED_KEYS.includes(key.toLowerCase())) return 'Touche réservée';
  const other = actionForKey(key);
  return other && other !== action ? `Déjà utilisée : ${KEY_LABELS[other]}` : null;
}
export function boostKeys() {
  return [0, 1, 2, 3, 4].map((i) => keyLabel(`boost${i}`));
}

// v9.1.0 : nombre de menus fourni par l'interface (texte « 1 … 4 » toujours juste, chiffres fixes par menu).
let menuCount = 4;
export function setMenuCount(n) { menuCount = n; }

export function shortcutsList() {
  return [
    ['← ↑ → ↓', 'Se déplacer entre les boutons (la sélection est encadrée en or)'],
    ['Entrée ou Espace', 'Activer le bouton sélectionné'],
    ['Entrée maintenue', 'Comme le clic maintenu : achète / améliore en continu'],
    [`1 … ${menuCount}`, 'Ouvrir / fermer les menus (toujours le même chiffre pour le même menu)'],
    ['[ ] (^ $ en AZERTY) ou Page préc. / suiv.', 'Onglet précédent / suivant'],
    ['Tab', 'Élément suivant (Maj + Tab : précédent)'],
    ['Échap', 'Fermer la fenêtre, puis le panneau'],
    [`${keyLabel('auto')} (ou Espace sans sélection)`, 'Avance automatique / rester sur l\'étape'],
    [keyLabel('speed'), 'Vitesse des combats (si débloquée)'],
    [boostKeys().join(' '), 'Lancer les boosts (Rage, Frénésie, Midas, Œil, Lame)'],
    [keyLabel('claim'), 'Tout récupérer'],
    [keyLabel('next'), 'Prochaine action'],
    [keyLabel('session'), 'Retour de session (tout récupérer, équiper, améliorer, répartir)'],
    [keyLabel('search'), 'Recherche rapide d\'un écran'],
    [`${keyLabel('missions')} · ${keyLabel('inbox')} · ${keyLabel('options')}`, 'Missions · À récupérer · Paramètres'],
    [keyLabel('journal'), 'Journal de la session (ce qui s\'est passé depuis le lancement)'],
    [`${keyLabel('help')} ou ?`, 'Afficher cette aide'],
  ];
}

export function shortcutsSummary() {
  return `1…${menuCount} menus · Espace avance auto · ${boostKeys().join(' ')} boosts · ${keyLabel('claim')} tout récupérer…`;
}

// Chiffre tapé (AZERTY compris : la position de la touche compte, pas le caractère), sinon null.
// AltGr + 5 (« [ » en AZERTY) n'ouvre pas de menu.
export function digitOf(e) {
  if (e.getModifierState?.('AltGraph')) return null;
  const m = /^(?:Digit|Numpad)([0-9])$/.exec(e.code ?? '');
  if (m) return Number(m[1]);
  return /^[0-9]$/.test(e.key) ? Number(e.key) : null;
}

// [ ] : par position (touches ^ et $ en AZERTY, ^ étant une touche morte), ou par caractère (AltGr compris).
export function bracketOf(e) {
  if (e.code === 'BracketLeft' || e.key === '[') return -1;
  if (e.code === 'BracketRight' || e.key === ']') return 1;
  if (e.key === 'PageUp') return -1;
  if (e.key === 'PageDown') return 1;
  return 0;
}

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
    const altGr = e.getModifierState?.('AltGraph');
    if (e.metaKey || ((e.ctrlKey || e.altKey) && !altGr)) return;
    const t = e.target;
    const typing = t && (t.tagName === 'INPUT' && !['checkbox', 'range', 'radio', 'file'].includes(t.type) || t.tagName === 'TEXTAREA' || t.isContentEditable);
    // v9.1.0 : Échap dans cet ordre — animation d'invocation, champ de saisie, fenêtre, puis panneau (un seul à la fois).
    const fx = document.querySelector('.summon-fx');
    if (fx && (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape')) {
      e.preventDefault();
      if (!e.repeat) fx.click();
      return;
    }
    const tour = document.querySelector('.tour');
    if (tour) {
      // Tutoriel : seuls Entrée, Espace et Tab passent ; Échap le passe.
      if (e.key === 'Escape') { e.preventDefault(); tour.querySelector('[data-tour="skip"]')?.click(); return; }
      if (!['Enter', ' ', 'Tab'].includes(e.key)) e.preventDefault();
      return;
    }
    // Fenêtre ouverte : Tab boucle dans la fenêtre (le focus n'en sort pas).
    if (e.key === 'Tab' && !ui.$('modal').classList.contains('hidden')) {
      const list = focusables(ui);
      if (list.length) {
        const i = list.indexOf(document.activeElement);
        const next = e.shiftKey ? (i <= 0 ? list.length - 1 : i - 1) : (i < 0 || i >= list.length - 1 ? 0 : i + 1);
        e.preventDefault();
        list[next].focus();
      }
      return;
    }
    if (typing) {
      if (e.key === 'Escape') { e.preventDefault(); t.blur(); return; }
      // Codes secrets (version dev) : Entrée valide (et répète tant qu'elle est maintenue).
      if (e.key === 'Enter' && (t.id === 'cheat-code' || t.id === 'cheat-times')) {
        e.preventDefault();
        ui.root.querySelector('[data-action="cheat"]')?.click();
      }
      return;
    }
    const modalOpen = !ui.$('modal').classList.contains('hidden');
    if (e.key === 'Escape') {
      e.preventDefault();
      if (modalOpen) ui.closeModal();
      else if (ui.tab) ui.closePanel();
      return;
    }
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    // Témoin de performances (caché) : F9.
    if (key === 'F9') { e.preventDefault(); ui.togglePerf(); return; }
    const focused = document.activeElement;
    const onButton = focused && focused !== document.body && ui.root.contains(focused) && focused.matches('button, summary');
    const onControl = focused && focused !== document.body && ui.root.contains(focused) && focused.matches('select, input, textarea');

    if (ARROWS[key]) {
      if (onControl && focused.tagName === 'SELECT' && (key === 'ArrowUp' || key === 'ArrowDown')) return; // choix de la liste
      if (onControl && focused.type === 'range' && (key === 'ArrowLeft' || key === 'ArrowRight')) return; // curseur de volume
      // Carte et arbre : les flèches font défiler la zone quand rien n'y est sélectionné.
      const scroller = !onButton && !onControl && ui.root.querySelector('#panel-body .map-viewport, #panel-body .tree-viewport');
      if (scroller && !modalOpen) {
        e.preventDefault();
        const [dx, dy] = ARROWS[key];
        scroller.scrollBy({ left: dx * 60, top: dy * 60 });
        return;
      }
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
    // v9.1.0 : fenêtre ouverte → aucun raccourci n'agit derrière elle (seuls flèches, Entrée, Espace, Tab, Échap).
    if (modalOpen) return;

    const click = (sel) => ui.root.querySelector(sel)?.click();
    const open = (tab) => { ui.toggleTab(tab); if (ui.tab) focusPanelStart(ui); };
    let handled = true;
    const digit = digitOf(e);
    const bracket = bracketOf(e);
    if (digit !== null) {
      // Chiffre fixe par menu (data-menu) : un menu encore caché ne décale pas les suivants.
      const btn = ui.root.querySelector(`#tabs button[data-key="${digit}"]:not(.hidden)`);
      if (btn) { btn.click(); if (ui.tab) focusPanelStart(ui); } else handled = false;
    } else if (bracket) {
      cycleSub(ui, bracket);
      focusPanelStart(ui);
    } else if (altGr) handled = false;
    else if (key === ' ') click('#auto-toggle');
    else if (key === '?') ui.showShortcuts();
    else {
      // v9.1.0 : touches configurables.
      const action = key.length === 1 ? actionForKey(key) : null;
      if (!action) handled = false;
      else if (action === 'auto') click('#auto-toggle');
      else if (action === 'speed') click('#speed-toggle');
      else if (action.startsWith('boost')) {
        const id = rushSlots(ui.state)[Number(action.slice(5))]; // v9.6.3 : touches = emplacements 1, 2, 3
        const btn = id && ui.root.querySelector(`#rush-bar [data-value="${id}"]`);
        if (btn) btn.click(); else handled = false;
      } else if (action === 'claim') ui.claimEverything?.();
      else if (action === 'missions') open('contracts');
      else if (action === 'inbox') open('inbox');
      else if (action === 'options') open('options');
      else if (action === 'help') ui.showShortcuts();
      else if (action === 'journal') ui.showJournal(ui.sessionJournal?.() ?? {});
      else if (action === 'session') ui.actions.sessionReturn?.();
      else if (action === 'next') ui.runNextAction?.();
      else if (action === 'search') ui.openSearch?.();
      else if (action === 'lootBag' && ui.lootBag?.available()) ui.lootBag.toggle(); // v9.7.1
      else handled = false;
    }
    if (handled) e.preventDefault();
  });
}

// Onglet précédent / suivant du menu ouvert (sinon menu précédent / suivant). Partagé avec le balayage tactile.
export function cycleSub(ui, dir) {
  const subs = [...ui.root.querySelectorAll('#panel-subtabs [data-sub]')];
  if (ui.tab && subs.length > 1) {
    const i = subs.findIndex((b) => b.dataset.sub === ui.tab);
    subs[(i + dir + subs.length) % subs.length].click();
    return;
  }
  const tabs = [...ui.root.querySelectorAll('#tabs button:not(.hidden)')];
  if (!tabs.length) return;
  const i = tabs.findIndex((b) => b.classList.contains('active'));
  tabs[(i + dir + tabs.length) % tabs.length].click();
}

export function shortcutsHtml() {
  return `<table class="shortcuts">${shortcutsList().map(([k, d]) => `<tr><td><kbd>${k}</kbd></td><td>${d}</td></tr>`).join('')}</table>`;
}
