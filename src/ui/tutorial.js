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
export function pickStep(state, root, full, panelOpen = false) {
  for (const st of TUTO_STEPS) {
    if (has(state, st.id) || !st.when(state, full)) continue;
    for (const sel of st.targets) {
      if (panelOpen && sel.startsWith('#tabs')) continue;
      if (!panelOpen && sel.startsWith('[data-sub')) continue; // panneau ouvert : pas de détour par le menu
      const el = root.querySelector(sel);
      if (visible(el)) return { step: st, el };
    }
    if (st.finger) return null; // une étape guidée attend son tour : pas de bulle par-dessus
  }
  return null;
}

export function markDone(state, id) {
  if (!state.ui) return;
  if (!has(state, id)) state.ui.hints = [...(state.ui.hints ?? []), id].slice(-50);
}

// Dessine (ou retire) le doigt et la bulle. Appelé avec le rafraîchissement des pastilles (2 fois par seconde).
export function updateTutorial(state, root, full, panelOpen = false, translate = (x) => x) {
  if (typeof document === 'undefined') return;
  let layer = document.getElementById('tuto-layer');
  const pick = state.settings?.tutorial === false ? null : pickStep(state, root, full, panelOpen);
  if (!pick) { layer?.remove(); return; }
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'tuto-layer';
    layer.innerHTML = '<div class="tuto-finger" aria-hidden="true">👆</div><div class="tuto-bubble" role="status"><span class="tuto-text"></span> <button class="btn small tuto-ok">OK</button></div>';
    document.body.appendChild(layer);
    layer.querySelector('.tuto-ok').addEventListener('click', () => { markDone(state, layer.dataset.step); layer.remove(); });
  }
  const { step, el } = pick;
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
  finger.style.left = `${Math.round(r.left + r.width / 2 - 14)}px`;
  finger.style.top = `${Math.round(r.bottom - 6)}px`;
  const below = r.top < innerHeight / 2;
  const bw = Math.min(280, innerWidth - 32);
  bubble.style.width = `${bw}px`;
  bubble.style.left = `${Math.round(Math.max(16, Math.min(innerWidth - bw - 16, r.left + r.width / 2 - bw / 2)))}px`;
  bubble.style.top = below ? `${Math.round(r.bottom + (step.finger ? 40 : 8))}px` : '';
  bubble.style.bottom = below ? '' : `${Math.round(innerHeight - r.top + 8)}px`;
}
