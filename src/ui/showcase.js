// v9.2.7 : vitrine animée des fiches (retour joueur : « montrer un exemple d'animation de chaque attaque, chaque
// compétence, chaque combat »). Les panneaux posent un emplacement (showcaseSlot) ; après chaque rendu du panneau,
// mountShowcase() y accroche LE bloc de vitrine (un seul pour tout le jeu : une seule mini-scène animée à la fois).
// Le bloc survit aux redessins du panneau (il est déplacé, pas recréé) et s'arrête dès qu'il n'est plus affiché
// (fiche fermée, autre onglet, fenêtre masquée). Rendu : src/render/showcase-scene.js (vrai moteur de la scène).
// « Réduire les animations » : image fixe de la séquence choisie, et un bouton « Lire » qui la joue une fois.
import { ShowcaseScene } from '../render/showcase-scene.js';
import { reduceMotion } from './prefs.js';
import { escapeHtml } from './common.js';

let block = null;
let scene = null;
let key = null;
let mode = 'all'; // 'all' : toutes les séquences à la suite ; sinon l'indice de la séquence choisie (en boucle)
let paused = false;
let playOnce = false; // animations réduites : lecture unique en cours
let raf = 0;
let last = 0;
let lastState = null;

// Emplacement de la vitrine dans une fiche. kind : unit | hero | monster | boss | mutation.
export function showcaseSlot(kind, id) {
  return `<div class="showcase-slot" data-showcase="${kind}:${escapeHtml(id)}"></div>`;
}

const visible = () => Boolean(block?.isConnected && block.offsetParent !== null && !document.hidden);

function build() {
  block = document.createElement('div');
  block.className = 'showcase';
  block.innerHTML = `<div class="sc-stage"><canvas class="px sc-canvas" aria-hidden="true"></canvas>
      <button class="btn small sc-play" type="button"><span class="sc-play-ico">⏸</span> <span class="sc-play-txt">Pause</span></button></div>
    <div class="sc-chips" role="tablist" aria-label="Animations"></div>
    <div class="sc-info" aria-live="polite"></div>`;
  scene = new ShowcaseScene(block.querySelector('canvas'));
  block.querySelector('.sc-play').addEventListener('click', () => {
    if (reduceMotion()) { playOnce = true; scene.start(scene.index); }
    else paused = !paused;
    paintButton();
    loop();
  });
  block.querySelector('.sc-chips').addEventListener('click', (ev) => {
    const chip = ev.target.closest('[data-sc]');
    if (!chip) return;
    ev.stopPropagation();
    mode = chip.dataset.sc === 'all' ? 'all' : Number(chip.dataset.sc);
    paused = false;
    playOnce = false;
    show(mode === 'all' ? 0 : mode);
  });
  new ResizeObserver(() => fit()).observe(block.querySelector('.sc-stage'));
}

// Taille du canvas : toute la largeur de la fiche, hauteur proportionnée (bornée), en pixels CSS.
function fit() {
  if (!block || !scene) return;
  const w = Math.round(block.querySelector('.sc-stage').clientWidth);
  if (!w) return;
  const h = Math.max(128, Math.min(210, Math.round(w * 0.46)));
  if (scene.css.w === w && scene.css.h === h) return;
  scene.resize(w, h);
  if (reduceMotion() && !playOnce && scene.state) scene.still(scene.index);
}

function paintChips() {
  const chips = [`<button type="button" class="sc-chip${mode === 'all' ? ' active' : ''}" data-sc="all" role="tab" aria-selected="${mode === 'all'}"><span>Tout</span></button>`]
    .concat(scene.clips.map((c, i) => `<button type="button" class="sc-chip${c.ult ? ' ult' : ''}${mode === i ? ' active' : ''}${scene.index === i ? ' now' : ''}" data-sc="${i}" role="tab"
      aria-selected="${mode === i}" title="${escapeHtml(c.label)}"><span class="sc-ico" aria-hidden="true">${c.icon}</span><span>${escapeHtml(c.label)}</span></button>`));
  block.querySelector('.sc-chips').innerHTML = chips.join('');
}

function paintInfo() {
  const c = scene.clip;
  block.querySelector('.sc-info').innerHTML = c ? `<b class="sc-name">${escapeHtml(c.label)}</b>${c.ult ? ' <span class="tag-ult">Ultime</span>' : ''}
    <span class="sc-desc muted">${escapeHtml(c.desc ?? '')}</span>` : '';
  block.querySelectorAll('.sc-chip').forEach((el) => el.classList.toggle('now', el.dataset.sc === String(scene.index)));
}

function paintButton() {
  const reduce = reduceMotion();
  const play = reduce ? !playOnce : paused;
  block.querySelector('.sc-play-ico').textContent = play ? '▶' : '⏸';
  block.querySelector('.sc-play-txt').textContent = play ? 'Lire' : 'Pause';
  block.classList.toggle('sc-reduced', reduce);
}

function show(index) {
  scene.calm = reduceMotion();
  if (scene.calm && !playOnce) scene.still(index);
  else scene.start(index);
  paintChips();
  paintInfo();
  paintButton();
  loop();
}

function tick(ms) {
  raf = 0;
  if (!visible()) return; // fiche fermée ou masquée : en pause (relancée au prochain affichage)
  const dt = Math.min(0.05, Math.max(0, (ms - (last || ms)) / 1000));
  last = ms;
  const reduce = reduceMotion();
  if (reduce && !playOnce) return; // image fixe : rien à animer
  if (!paused) {
    scene.step(dt);
    if (scene.done) {
      if (reduce) { playOnce = false; scene.still(scene.index); paintButton(); return; }
      scene.start(mode === 'all' ? scene.index + 1 : scene.index);
      paintInfo();
    }
  }
  raf = requestAnimationFrame(tick);
}

function loop() {
  if (raf || !visible()) return;
  last = 0;
  raf = requestAnimationFrame(tick);
}

// Après le rendu d'un panneau : accroche la vitrine à son emplacement (s'il y en a un), la configure si la fiche a
// changé, et relance l'animation si elle est affichée.
export function mountShowcase(root, state) {
  lastState = state;
  const slot = root?.querySelector('.showcase-slot');
  if (!slot) { if (block?.isConnected) block.remove(); return; }
  if (!block) build();
  const k = slot.dataset.showcase;
  slot.appendChild(block);
  if (k !== key) {
    key = k;
    const [kind, ...rest] = k.split(':');
    mode = 'all';
    paused = false;
    playOnce = false;
    fit();
    scene.configure({ kind, id: rest.join(':') }, lastState);
    if (!scene.clips.length) { block.remove(); return; }
    show(0);
    return;
  }
  fit();
  paintButton();
  loop();
}

// Tests et outils : état de la vitrine.
export const showcaseInfo = () => ({ css: scene?.css, key, mode, paused, running: Boolean(raf), clip: scene?.clip?.id ?? null, clips: scene?.clips.length ?? 0 });
if (typeof window !== 'undefined') window.__showcase = showcaseInfo; // captures et tests
