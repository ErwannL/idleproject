// v10.4 (partie 1) : « pages » plein écran. MODE D'EMPLOI (10 lignes) :
// 1. Un panneau en page : ajouter son id à PAGE_TABS (`PAGE_TABS.add('camp')`), ou une condition dans PAGE_WHEN
//    (`PAGE_WHEN.dungeons = (ui) => Boolean(ui.view.dungeonSheet)`) ; ui.js appelle syncPage() tout seul.
// 2. Page active → `#app.page-ui` : #panel couvre la fenêtre (le menu du bas reste), pas de bannière d'onglet,
//    la scène joue derrière sous un voile, `#page-mini` (≈ 280 × 158) la recopie en haut à gauche. Échap et ✕ ferment.
// 3. Gabarit (page.css) : `<div class="pg">` > `.pg-top` (bandeau des ressources, laisse la place à la mini-fenêtre),
//    `.pg-main` (contenu en grand), `.pg-side` (fiche à droite, 420 px au moins). Rien d'autre à écrire.
// 4. Option : `.pg.pg-wide` (fiche plus large, 40 %), `.pg-card` (carte sombre), `.pg-hint` (aide repliée « ? »).
// 5. Téléphone (≤ 600 px) : une colonne ; `.pg-side` devient une feuille du bas (`.pg-side.is-open` pour la montrer,
//    `.pg-side-close` pour la fermer ; `.pg-side.pg-inline` la laisse dans la page) ; pas de mini-fenêtre.
// 6. Tester `pageActive(ui)` dans un panneau pour adapter son rendu (ex. icônes ×3). Petite fenêtre (mini, barre) :
//    jamais de page, le panneau latéral habituel reste.
import { isPhone } from './prefs.js';

// Panneaux ouverts en page (les autres gardent le volet latéral : Améliorations, Missions, Carnet, Boutique…).
export const PAGE_TABS = new Set(['inventory', 'forge', 'camp', 'upgrades']); // v10.6 (5) : les Améliorations en page // v10.4 (6) : le Bastion
// Conditions par panneau : (ui) => booléen.
export const PAGE_WHEN = {};

// Le panneau courant est-il une page ? Seulement dans la disposition haute (PC et téléphone) ; dans la petite fenêtre
// bureau (« mini ») et le mode barre, le panneau habituel fait l'affaire.
export function pageActive(ui) {
  if (!ui?.tab || (ui.layout && ui.layout !== 'tall')) return false;
  // v10.11 (6) : téléphone — tous les onglets en plein écran (le contenu commence en haut, pas à mi-hauteur).
  if ((ui?.root?.clientWidth ?? 9999) <= 600) return true;
  return PAGE_TABS.has(ui.tab) || Boolean(PAGE_WHEN[ui.tab]?.(ui));
}

// Téléphone ou fenêtre étroite : la page en une colonne, sans mini-fenêtre.
export const pageNarrow = (ui) => (ui?.root?.clientWidth ?? 9999) <= 600 || isPhone();

// v10.11 (5) : même forme dans un menu — à partir de 1300 px, tous les onglets des menus Héros et Équipe en page.
const WIDE_PAGES = ['skills', 'tree', 'companions', 'expeditions'];
for (const id of WIDE_PAGES) PAGE_WHEN[id] = (ui) => (ui?.root?.clientWidth ?? 0) >= 1300 && !pageNarrow(ui);

// v10.4 (partie 4) : la page du donjon est une page plein écran sur PC ; sur téléphone, c'est la feuille du bas (calque #dg-host).
PAGE_WHEN.dungeons = (ui) => Boolean(ui.view?.dungeonSheet) && !pageNarrow(ui);

let raf = 0;
let mini = null;
let ctx2d = null;
let frames = 0;

// Recopie de la scène dans la mini-fenêtre, à chaque image, en « couvrant » (le centre de la scène, sans bandes).
function copyFrame() {
  raf = 0;
  if (!mini?.isConnected || !document.getElementById('app')?.classList.contains('page-ui')) return;
  const src = document.getElementById('scene');
  if (src?.width && src.height && mini.offsetParent !== null) {
    const w = mini.width, h = mini.height;
    // Gros plan sur le bas de la scène (le sol, le héros et les monstres), un peu à gauche du centre.
    const W = src.width, H = src.height;
    const sh = Math.min(H, H * 0.62), sw = Math.min(W, sh * (w / h));
    const sx = Math.max(0, Math.min(W - sw, W * 0.4 - sw / 2));
    const sy = Math.max(0, Math.min(H - sh, H * 0.96 - sh));
    ctx2d.drawImage(src, sx, sy, sw, sh, 0, 0, w, h);
    frames += 1;
    mini.dataset.frames = String(frames);
  }
  raf = requestAnimationFrame(copyFrame);
}

function ensureMini(root) {
  if (mini?.isConnected) return mini;
  const box = document.createElement('button');
  box.id = 'page-mini';
  box.type = 'button';
  box.title = 'Retour au combat';
  box.setAttribute('aria-label', 'Retour au combat');
  mini = document.createElement('canvas');
  mini.width = 280; mini.height = 158;
  box.appendChild(mini);
  root.appendChild(box);
  ctx2d = mini.getContext('2d', { alpha: false });
  ctx2d.imageSmoothingEnabled = true;
  ctx2d.imageSmoothingQuality = 'low';
  // Toucher la mini-fenêtre ferme la page (retour au combat).
  box.addEventListener('click', (e) => { e.stopPropagation(); root.__ui?.closePanel?.(); });
  return mini;
}

// Place la page entre le haut de la fenêtre et le menu (en bas, ou à gauche quand le menu est une colonne).
function placePage(root) {
  const tabs = document.getElementById('tabs');
  const r = tabs?.getBoundingClientRect();
  const rr = root.getBoundingClientRect();
  let bottom = 0, left = 0;
  if (r && r.width && r.height) {
    if (r.width >= rr.width * 0.6 || r.top > rr.top + rr.height * 0.6) bottom = Math.max(0, rr.bottom - r.top); // v10.11 (5) : menu du bas centré (grand écran) compris
    else if (r.height >= rr.height * 0.6 && r.left <= rr.left + 2) left = Math.max(0, r.right - rr.left);
  }
  // v10.11 (5) : le panneau peut être zoomé (CSS zoom, grand écran) : ses marges sont en px zoomés.
  const panel = document.getElementById('panel');
  const z = panel?.offsetHeight ? Math.max(1, panel.getBoundingClientRect().height / panel.offsetHeight) : 1;
  bottom /= z; left /= z;
  root.style.setProperty('--page-bottom', `${Math.round(bottom)}px`);
  root.style.setProperty('--page-left', `${Math.round(left)}px`);
}

// Appelée par ui.js à chaque ouverture, fermeture, changement de disposition et rendu de panneau.
export function syncPage(ui) {
  const root = ui?.root;
  if (!root || typeof document === 'undefined') return false;
  const on = pageActive(ui);
  root.classList.toggle('page-ui', on);
  root.classList.toggle('page-narrow', on && pageNarrow(ui));
  root.__ui = ui;
  if (on) {
    placePage(root);
    ensureMini(root);
    // Le bandeau du haut (.pg-top) descend jusqu'au bas de la mini-fenêtre : le contenu commence dessous.
    const body = document.getElementById('panel-body');
    const box = document.getElementById('page-mini');
    if (body && box && box.getClientRects().length) { // (position fixe : offsetParent vaut toujours null)
      const pad = parseFloat(getComputedStyle(body).paddingTop) || 0;
      const need = box.getBoundingClientRect().bottom + 6 - (body.getBoundingClientRect().top + pad);
      root.style.setProperty('--pg-top-h', `${Math.max(0, Math.round(need))}px`);
    }
    if (!raf) raf = requestAnimationFrame(copyFrame);
  } else if (raf) { cancelAnimationFrame(raf); raf = 0; }
  return on;
}
