// v9.9 (K16) : équipes enregistrées (compagnons + sorts + Boosts) en puces, à choisir d'un appui avant un donjon, un boss
// ou la Faille ; « Enregistrer » garde l'équipe actuelle dans la première place vide (ou la choisie).
import { escapeHtml } from './common.js';

export function teamChips(state, { save = true } = {}) {
  const ls = (state.loadouts ?? []).slice(0, 3);
  if (!ls.length) return '';
  return `<div class="team-chips"><span class="muted">Équipes :</span>${ls.map((l, i) => (l.team
    ? `<button class="btn chip-btn small" data-action="apply-build" data-value="${i}">${escapeHtml(l.name)}</button>`
    : save ? `<button class="btn chip-btn small" data-action="save-loadout" data-value="${i}">+ Enregistrer</button>` : '')).join('')}</div>`;
}
