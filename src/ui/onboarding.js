// Découverte guidée (v9.0.6) : un pas-à-pas qui éclaire chaque zone de l'interface (le reste est assombri)
// avec une bulle d'explication — « Suivant », « Passer ». Lancé à la première partie ; proposé une fois aux
// joueurs existants pour la nouvelle interface ; rejouable depuis Paramètres.
// state.ui.tour : 'done' (vu ou passé) ; absent = jamais vu.

// target : sélecteur CSS de la zone à éclairer ; open : panneau ouvert avant l'étape (null = panneau fermé).
const STEPS = [
  { target: '#stage-area', open: null, title: 'Votre héros combat tout seul',
    text: 'Le combat est automatique, même fenêtre réduite : laissez tourner le jeu pendant que vous travaillez. Au retour, un résumé de ce que vous avez gagné vous attend.' },
  { target: '#topbar', open: null, title: 'L\'essentiel en haut',
    text: 'Niveau, étape, or, gemmes et tickets. À droite : missions, récompenses reçues et paramètres.' },
  { target: '#tabs', open: null, title: '5 catégories, c\'est tout',
    text: 'Aventure, Personnage, Invocation, Événements, Progression. Chaque catégorie a ses sous-onglets en haut du panneau. Une pastille rouge = une récompense à récupérer.' },
  { target: '#panel', open: 'campaign', title: 'Aventure : où j\'en suis',
    text: 'Votre monde, le prochain boss, la prévision du combat et les conseils du moment — un clic sur un conseil ouvre le bon écran.' },
  { target: '#panel', open: 'upgrades', title: 'Personnage : devenir plus fort',
    text: 'Dépensez l\'or en améliorations (le coût et le gain sont écrits sur le bouton). Équipement, compétences et compagnons sont dans les onglets voisins.' },
  { target: '#panel', open: 'hero', heroTab: 'class', title: 'Choisissez votre classe',
    text: 'Chevalier, Archer, Mage de feu… et 7 autres à débloquer. Chacune a ses armes, sa portée et sa façon de combattre. Changement gratuit, à tout moment.' },
  { target: '#skill-bar, #rush-bar', open: null, title: 'Compétences et boosts',
    text: 'À gauche, vos compétences se lancent toutes seules. À droite, les boosts se déclenchent d\'un clic (ou Q W E R T) quand ils brillent.' },
  { target: '#panel', open: 'summon', title: 'Invocation',
    text: 'Gemmes et tickets se gagnent en jouant. Probabilités et garanties sont toujours affichées ; le héros en vedette change chaque lundi.' },
  { target: '#tabs', open: null, title: 'Événements et Progression',
    text: 'Donjons, Tour et missions s\'ouvrent avec la progression. La Renaissance, les passifs des boss et les collections vous donnent de nouveaux objectifs. Bonne aventure !' },
];

// Joueurs existants : seulement la nouvelle interface.
const NEW_UI_STEPS = [2, 3, 5, 7, 8];

let current = null;

function place(root, el, step, index, total, steps) {
  // Plusieurs zones possibles (ex. compétences + boosts) : on éclaire le rectangle qui les englobe toutes.
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
  bubble.innerHTML = `<div class="tour-step">${index + 1} / ${total}</div><div class="tour-title">${step.title}</div><p>${step.text}</p>
    <div class="tour-actions"><button class="btn small" data-tour="skip">Passer</button>
      <button class="btn btn-primary" data-tour="next">${index + 1 === total ? 'Terminer' : 'Suivant ▶'}</button></div>`;
  // Bulle sous la zone si elle tient, sinon au-dessus, sinon au centre ; jamais hors de l'écran.
  const bw = Math.min(340, window.innerWidth - 24);
  bubble.style.width = `${bw}px`;
  const bh = bubble.offsetHeight || 160;
  let top = r ? r.bottom + 12 : (window.innerHeight - bh) / 2;
  if (r && top + bh > window.innerHeight - 8) top = r.top - bh - 12;
  if (top < 8) top = Math.max(8, (window.innerHeight - bh) / 2);
  let left = r ? r.left + r.width / 2 - bw / 2 : (window.innerWidth - bw) / 2;
  left = Math.max(12, Math.min(window.innerWidth - bw - 12, left));
  Object.assign(bubble.style, { top: `${Math.round(top)}px`, left: `${Math.round(left)}px` });
  void steps;
}

export function startTour(ui, state, { newUiOnly = false } = {}) {
  if (current) return;
  const steps = newUiOnly ? NEW_UI_STEPS.map((i) => STEPS[i]) : STEPS;
  const el = document.createElement('div');
  el.className = 'tour';
  el.innerHTML = '<div class="tour-hole"></div><div class="tour-bubble"></div>';
  document.body.appendChild(el);
  let index = 0;
  const show = () => {
    const step = steps[index];
    if (step.open) {
      ui.openTab(step.open);
      if (step.heroTab) { ui.view.heroTab = step.heroTab; ui.invalidate(); }
    } else ui.closePanel();
    // Laisse le panneau s'ouvrir (et la fenêtre s'agrandir) avant de mesurer la zone à éclairer.
    setTimeout(() => place(ui.root, el, step, index, steps.length, steps), 260);
  };
  const finish = () => {
    el.remove();
    current = null;
    window.removeEventListener('resize', onResize);
    state.ui.tour = 'done';
    ui.closePanel();
    ui.actions.skipTour?.();
  };
  const onResize = () => place(ui.root, el, steps[index], index, steps.length, steps);
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

// Au démarrage : première partie → visite complète ; partie existante → proposition de découvrir la nouvelle interface.
export function maybeStartTour(ui, state) {
  if (state.ui.tour === 'done' || document.querySelector('.summon-fx')) return;
  const veteran = (state.records?.kills ?? 0) > 200 || (state.maxStage ?? 1) > 10;
  if (!veteran) { startTour(ui, state); return; }
  ui.$('modal-card').innerHTML = `<h2>Nouvelle interface</h2>
    <p>Les menus sont regroupés en <b>5 catégories</b> (barre de gauche), votre héros a maintenant une <b>classe</b>
      et des <b>apparences</b> à collectionner. Une visite rapide (5 étapes) ?</p>
    <div class="detail-actions"><button class="btn" data-action="tour-later">Non merci</button>
      <button class="btn btn-primary" data-action="tour-new">Visiter</button></div>`;
  ui.$('modal').classList.remove('hidden');
}
