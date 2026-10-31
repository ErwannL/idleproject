// Tutoriel (v9.1.0) : 3 messages courts, puis le joueur apprend en faisant — le bouton « Prochaine action » le guide
// (équiper un objet, acheter une amélioration, apprendre une compétence, battre le premier mini-boss, puis invoquer).
// Les anciens joueurs voient une seule carte « où est passé quoi ». Rejouable depuis Paramètres › Général.
// state.ui.tour : 'done' (vu ou passé) ; state.ui.tourV : version du tutoriel vue (2 = menus de la v9.1.0).
import { BALANCE } from '../data/balance.js';
import { MENUS } from './nav.js';

export const TOUR_VERSION = 2;

// target : zone à éclairer (sélecteur CSS) ; open : onglet ouvert pendant l'étape (null = panneau fermé).
const STEPS = [
  { target: '#stage-area', open: null, title: 'Votre héros combat tout seul',
    text: `Le combat est automatique. Même jeu fermé, il gagne encore (${Math.round(BALANCE.offline.farmMultiplier * 100)} % du rythme, ${BALANCE.offline.capHours} h au plus) : un résumé vous attend au retour.` },
  { target: '#next-action', open: null, title: 'Que faire ? Suivez ce bouton',
    text: 'Il propose toujours une seule chose utile : équiper un objet, acheter une amélioration, récupérer une récompense… Un appui y mène.' },
  { target: '#tabs', open: null, title: 'Les menus s\'ouvrent avec la progression',
    text: 'Héros et Aventure pour commencer ; Équipe et Objectifs arrivent ensuite. Une pastille rouge = une récompense à récupérer ; un point or = ce qui est conseillé.' },
];

let current = null;

export function tourActive() {
  return Boolean(current);
}

function place(root, el, step, index, total) {
  const rects = [...root.querySelectorAll(step.target)].map((t) => t.getBoundingClientRect()).filter((b) => b.width > 0);
  const r = rects.length ? rects.reduce((a, b) => {
    const left = Math.min(a.left, b.left), top = Math.min(a.top, b.top);
    const right = Math.max(a.right, b.right), bottom = Math.max(a.bottom, b.bottom);
    return { left, top, right, bottom, width: right - left, height: bottom - top };
  }) : null;
  const hole = el.querySelector('.tour-hole');
  const bubble = el.querySelector('.tour-bubble');
  if (r && r.width > 0) {
    const pad = 4;
    Object.assign(hole.style, { left: `${r.left - pad}px`, top: `${r.top - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px`, display: 'block' });
  } else hole.style.display = 'none';
  bubble.innerHTML = `<div class="tour-step">${index + 1} / ${total}</div><div class="tour-title" id="tour-title">${step.title}</div><p>${step.text}</p>
    <div class="tour-actions"><button class="btn small" data-tour="skip">Passer</button>
      <button class="btn btn-primary" data-tour="next">${index + 1 === total ? 'C\'est parti !' : 'Suivant ▶'}</button></div>`;
  const bw = Math.min(340, window.innerWidth - 24);
  bubble.style.width = `${bw}px`;
  const bh = bubble.offsetHeight || 160;
  let top = r ? r.bottom + 12 : (window.innerHeight - bh) / 2;
  if (r && top + bh > window.innerHeight - 8) top = r.top - bh - 12;
  if (top < 8) top = Math.max(8, (window.innerHeight - bh) / 2);
  let left = r ? r.left + r.width / 2 - bw / 2 : (window.innerWidth - bw) / 2;
  left = Math.max(12, Math.min(window.innerWidth - bw - 12, left));
  Object.assign(bubble.style, { top: `${Math.round(top)}px`, left: `${Math.round(left)}px` });
  // Clavier : le focus va sur « Suivant » (Entrée avance, Échap passe — shortcuts.js).
  bubble.querySelector('[data-tour="next"]')?.focus({ preventScroll: true });
}

export function startTour(ui, state) {
  if (current) return;
  const steps = STEPS;
  const el = document.createElement('div');
  el.className = 'tour';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-labelledby', 'tour-title');
  el.innerHTML = '<div class="tour-hole"></div><div class="tour-bubble"></div>';
  document.body.appendChild(el);
  let index = 0;
  const show = () => {
    const step = steps[index];
    if (step.open) ui.openTab(step.open); else ui.closePanel();
    setTimeout(() => place(ui.root, el, step, index, steps.length), 260);
  };
  const finish = () => {
    el.remove();
    current = null;
    window.removeEventListener('resize', onResize);
    state.ui.tour = 'done';
    state.ui.tourV = TOUR_VERSION;
    ui.closePanel();
    ui.actions.skipTour?.();
  };
  const onResize = () => place(ui.root, el, steps[index], index, steps.length);
  window.addEventListener('resize', onResize);
  el.addEventListener('click', (e) => {
    const action = e.target.closest('[data-tour]')?.dataset.tour;
    if (action === 'skip') finish();
    else if (action === 'next') {
      index += 1;
      if (index >= steps.length) finish(); else show();
    }
  });
  current = el;
  show();
}

// Sortie des menus de la v9.1.0 (31/10/2026) : les parties créées avant ont connu les anciens menus.
const MENUS_910_AT = Date.UTC(2026, 9, 31, 17, 0);

// Carte unique pour les anciens joueurs : où est passé quoi (menus de la v9.1.0).
export function showWhatMoved(ui, state) {
  const menus = MENUS.map((m, i) => `<li><b>${i + 1}. ${m.label}</b></li>`).join('');
  ui.openModal(`<h2 id="modal-title">Nouveaux menus</h2>
    <p>Les menus sont rangés autrement : <b>4 menus</b> au lieu de 5, et les touches 1 à 4 ont changé (Héros = 1).</p>
    <ul class="moved-list">${menus}</ul>
    <ul class="moved-list muted">
      <li>Équipement, Améliorations, Compétences, Talents (et la Renaissance) : <b>Héros</b>.</li>
      <li>Carte, Donjons (et le Défi), Tour, Boss : <b>Aventure</b>.</li>
      <li>Compagnons (Composition), Invocation, Expéditions : <b>Équipe</b>.</li>
      <li>À récupérer (ancienne boîte de récompenses), Missions, Collections (et le Musée) : <b>Objectifs</b>.</li>
      <li>Votre fiche, la classe, l'apparence et les records : <b>le portrait en haut à gauche</b>.</li>
      <li>Les Configurations s'appellent <b>Builds</b> (Héros › Équipement).</li>
    </ul>
    <p class="muted">Perdu ? Touche <b>F</b> pour chercher un écran, et le bouton sous le combat propose toujours la prochaine chose utile.</p>
    <div class="detail-actions"><button class="btn btn-primary" data-action="tour-later">Compris</button></div>`);
  void state;
}

// Au démarrage : première partie → tutoriel ; partie existante d'avant la v9.1.0 → carte « où est passé quoi ».
export function maybeStartTour(ui, state) {
  if (document.querySelector('.summon-fx')) return;
  if (state.ui.tour === 'done') {
    if ((state.ui.tourV ?? 1) < TOUR_VERSION) showWhatMoved(ui, state);
    return;
  }
  // « Où est passé quoi » : seulement pour une partie commencée avant la v9.1.0 (anciens menus). Une partie récente qui
  // a dépassé l'étape 10 sans finir le tutoriel ne l'a jamais connue : elle n'a plus rien de neuf à apprendre.
  const veteran = (state.createdAt ?? 0) < MENUS_910_AT && ((state.records?.kills ?? 0) > 200 || (state.maxStage ?? 1) > 10);
  if (!veteran && ((state.records?.kills ?? 0) > 200 || (state.maxStage ?? 1) > 10)) { state.ui.tour = 'done'; state.ui.tourV = TOUR_VERSION; return; }
  if (veteran) showWhatMoved(ui, state); else startTour(ui, state);
}
