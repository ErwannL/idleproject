// v9.3.4 (h) : premières minutes. Un doigt animé montre le geste utile (Dégâts, premier objet, recyclage au premier
// sac plein, premier compagnon) et des bulles courtes expliquent le bonus « ×1,5 » et « Tout récupérer ».
// Une étape à la fois ; toucher la cible (ou « OK ») la termine pour de bon (state.ui.hints, déjà sauvegardé).
const has = (state, id) => (state.ui?.hints ?? []).includes(id);

// v9.3.5 : actions guidées dans l'ordre des premières minutes — équiper le premier objet, acheter Dégâts, apprendre
// Frappe rapide ; après le premier mini-boss : première invocation, puis placer le compagnon.
const MENU = (m) => `#tabs button[data-menu="${m}"]`;
export const TUTO_STEPS = [
  { id: 'tuto-item', finger: true, text: 'Nouvel objet : touche « Équiper »',
    when: (s) => (s.inventory?.length ?? 0) > 0 && (s.records?.bossesDefeated ?? 0) < 3,
    targets: ['.item-pop [data-action="equip"]', '[data-action="select-item"]', '[data-sub="inventory"]', MENU('hero')] },
  { id: 'tuto-damage', finger: true, text: 'Touche ici : plus de Dégâts',
    when: (s) => (s.upgrades?.damage ?? 0) < 1,
    targets: ['button[data-action="buy"][data-key="damage"]', '[data-sub="upgrades"]', MENU('hero')] },
  { id: 'tuto-skill', finger: true, text: 'Apprends Frappe rapide',
    when: (s) => (s.skills?.quick ?? 0) < 1 && (s.level ?? 1) >= 1,
    targets: ['button[data-action="learn-skill"][data-key="quick"]', '[data-action="skill-sel"][data-value="s:quick"]', '[data-sub="skills"]', MENU('hero')] },
  { id: 'tuto-summon', finger: true, text: 'Invoque ton premier compagnon',
    when: (s) => (s.records?.bossesDefeated ?? 0) >= 1 && !Object.keys(s.companions?.owned ?? {}).length && (s.gems ?? 0) >= 100,
    targets: ['[data-action="summon"]:not([disabled])', '[data-sub="summon"]', MENU('team')] },
  { id: 'tuto-companion', finger: true, text: 'Place ton compagnon dans l\'équipe',
    when: (s) => Object.keys(s.companions?.owned ?? {}).length > 0 && !(s.companions?.equipped ?? []).length,
    targets: ['[data-action="toggle-companion"]', '[data-action="companion-sel"]', '[data-sub="companions"]', MENU('team')] },
  { id: 'tuto-recycle', finger: true, text: 'Sac plein : recycle en éclats',
    when: (s, full) => full,
    targets: ['[data-action="recycle-useless"]:not([disabled])', '[data-sub="forge"]', MENU('hero')] },
  { id: 'tip-boost', finger: false, text: 'Bonus du moment : plus d\'or et d\'expérience. Touche pour le détail.',
    when: () => true, targets: ['#boost-chip'] },
  { id: 'tip-claim', finger: false, text: 'Récupère d\'un coup toutes les récompenses prêtes.',
    when: () => true, targets: ['[data-action="claim-everything"]'] },
];

function visible(el) {
  if (!el || !el.isConnected) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && getComputedStyle(el).visibility !== 'hidden';
}

// Étape à montrer maintenant, ou null. `full` : sac plein (calculé par l'appelant).
// v9.7.1 : jamais sur une barre d'onglets ni sur la navigation (menus, sous-onglets, barre du bas du téléphone).
const NAV = '#tabs, #panel-subtabs, .seg, nav, [role="tablist"], #topbar';
const isNav = (sel) => sel.startsWith('#tabs') || sel.startsWith('[data-sub');
// v9.7.1 : une bulle par écran ouvert au plus (par session) : écran → étape déjà montrée.
const shownOn = new Map();
export function pickStep(state, root, full, panelOpen = false, screen = panelOpen ? 'panel' : 'scene') {
  // Rien pendant le prologue, le tutoriel, une fenêtre ou une animation (fenêtres en file, une seule à la fois).
  if (typeof document !== 'undefined' && document.querySelector('#prologue, .tour, .cinematic, .summon-fx, #modal:not(.hidden), #loot-sheet:not(.hidden), .howto-card, .learn-card')) return null;
  const already = shownOn.get(screen);
  for (const st of TUTO_STEPS) {
    if (has(state, st.id) || !st.when(state, full)) continue;
    if (!st.finger && panelOpen) continue; // v9.8 : les bulles d'info ne se montrent que sur la scène (plus sur chaque écran)
    if (already && already !== st.id) return null;
    // v9.8 (0.1) : cible directe d'abord ; sinon le menu ou l'onglet qui y mène (seul chemin vers la cible).
    for (const sel of st.targets) {
      if (isNav(sel)) continue;
      const el = root.querySelector(sel);
      if (visible(el) && !el.closest(NAV)) { shownOn.set(screen, st.id); return { step: st, el }; }
    }
    if (st.finger) {
      for (const sel of st.targets) {
        if (!isNav(sel)) continue;
        const el = root.querySelector(sel);
        if (visible(el)) { shownOn.set(screen, st.id); return { step: st, el }; }
      }
    }
    if (st.finger) return null; // une étape guidée attend son tour : pas de bulle par-dessus
  }
  return null;
}

export function markDone(state, id) {
  if (!state.ui) return;
  if (!has(state, id)) state.ui.hints = [...(state.ui.hints ?? []), id].slice(-150);
}

// Dessine (ou retire) le doigt et la bulle. Appelé avec le rafraîchissement des pastilles (2 fois par seconde).
let latest = null;
export function updateTutorial(state, root, full, panelOpen = false, translate = (x) => x) {
  latest = state;
  if (typeof document === 'undefined') return;
  let layer = document.getElementById('tuto-layer');
  const screen = panelOpen ? `panel:${root.querySelector('#panel h2')?.textContent ?? ''}` : 'scene';
  const pick = state.settings?.tutorial === false ? null : pickStep(state, root, full, panelOpen, screen);
  if (!pick) { layer?.remove(); return; }
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'tuto-layer';
    layer.innerHTML = '<div class="tuto-finger" aria-hidden="true">👆</div><div class="tuto-bubble" role="status"><span class="tuto-text"></span> <button class="btn small tuto-ok">OK</button></div>';
    document.body.appendChild(layer);
    // v9.3.8 (3b) : « OK » ferme pour de bon, même si la partie a été rechargée entre-temps (état le plus récent).
    layer.querySelector('.tuto-ok').addEventListener('click', (e) => { e.stopPropagation(); markDone(latest, layer.dataset.step); layer.remove(); });
  }
  const { step, el } = pick;
  layer.target = el; // cible actuelle (tests de bout en bout)
  if (layer.dataset.step !== step.id) {
    layer.dataset.step = step.id;
    layer.querySelector('.tuto-text').textContent = translate(step.text);
    layer.querySelector('.tuto-ok').textContent = translate('OK');
  }
  // La cible termine l'étape quand on la touche (une seule écoute par élément).
  if (el.dataset.tuto !== step.id) {
    el.dataset.tuto = step.id;
    el.addEventListener('click', () => {
      // Les onglets du menu ne sont qu'un détour : l'étape continue sur le vrai bouton.
      if (!el.matches('#tabs button, [data-sub], [data-action="select-item"], [data-action="skill-sel"], [data-action="companion-sel"]')) markDone(state, step.id); // détours
      document.getElementById('tuto-layer')?.remove();
    }, { once: true });
  }
  const r = el.getBoundingClientRect();
  const finger = layer.querySelector('.tuto-finger');
  const bubble = layer.querySelector('.tuto-bubble');
  finger.hidden = !step.finger;
  // v9.8 (0.1) : cible dans la barre de gauche : le doigt pointe depuis la droite, la bulle suit à droite du doigt.
  const side = Boolean(el.closest('#tabs'));
  finger.classList.toggle('side', side);
  finger.style.left = `${Math.round(side ? r.right + 2 : r.left + r.width / 2 - 14)}px`;
  finger.style.top = `${Math.round(side ? r.top + r.height / 2 - 16 : r.bottom - 6)}px`;
  // v9.3.8 (3b) : la bulle se met À CÔTÉ de sa cible (à droite, sinon à gauche, sinon au-dessus / dessous) pour ne jamais
  // cacher le bouton suivant ; plus étroite.
  const bw = Math.min(220, innerWidth - 32);
  bubble.style.width = `${bw}px`;
  const h = bubble.offsetHeight || 60;
  const midY = Math.round(Math.max(8, Math.min(innerHeight - h - 8, r.top + r.height / 2 - h / 2)));
  const gap = side && step.finger ? 48 : 12;
  if (r.right + gap + bw <= innerWidth - 8) { bubble.style.left = `${Math.round(r.right + gap)}px`; bubble.style.top = `${midY}px`; bubble.style.bottom = ''; }
  else if (r.left - 12 - bw >= 8) { bubble.style.left = `${Math.round(r.left - 12 - bw)}px`; bubble.style.top = `${midY}px`; bubble.style.bottom = ''; }
  else {
    const below = r.top < innerHeight / 2;
    bubble.style.left = `${Math.round(Math.max(16, Math.min(innerWidth - bw - 16, r.left + r.width / 2 - bw / 2)))}px`;
    bubble.style.top = below ? `${Math.round(r.bottom + (step.finger ? 40 : 8))}px` : '';
    bubble.style.bottom = below ? '' : `${Math.round(innerHeight - r.top + 8)}px`;
  }
}
