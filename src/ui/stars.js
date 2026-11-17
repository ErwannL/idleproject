// v9.7.1 (lot 4) : étoiles d'un monde (fiche du monde, carte).
import { STAR_LABELS, worldStars } from '../core/world-stars.js';
export function worldStarsHtml(state, w) {
  const s = worldStars(state, w);
  return s.map((on, i) => `<span class="star${on ? ' on' : ''}" title="${STAR_LABELS[i]}">${on ? '★' : '☆'} ${STAR_LABELS[i]}</span>`).join('');
}
