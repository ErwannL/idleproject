// v9.7.1 (lot 4) : trois étoiles par monde — le finir, le finir sans mourir, le finir avec l'élément conseillé (héros
// ou au moins un compagnon de l'équipe de l'élément qui bat celui du monde). Relevées quand le monde est terminé
// pour la première fois ; les étoiles restent acquises (rien ne devient inutile avec un nouveau monde).
import { strongAgainst, unitElement, zoneElement } from './elements.js';
import { heroElement } from './companions.js';

const PER_WORLD = 20;
export const STAR_LABELS = ['Terminé', 'Sans mourir', 'Élément conseillé'];

export function worldStars(state, w) { return state.stars?.[w] ?? [false, false, false]; }
export function totalStars(state) { return Object.values(state.stars ?? {}).reduce((a, s) => a + s.filter(Boolean).length, 0); }

// Mort du héros en campagne : comptée pour le monde en cours (étoile « sans mourir »).
export function noteDeath(state, zoneIndex) {
  state.worldDeaths = { ...(state.worldDeaths ?? {}), [zoneIndex]: (state.worldDeaths?.[zoneIndex] ?? 0) + 1 };
}

// À appeler régulièrement : enregistre les étoiles des mondes terminés depuis le dernier passage. Renvoie les mondes.
export function updateStars(state) {
  const best = Math.max(state.maxStage ?? 1, state.records?.bestStage ?? 1);
  const out = [];
  for (let w = 0; w < 12; w++) {
    if (best <= (w + 1) * PER_WORLD || state.stars?.[w]) continue;
    const el = zoneElement(w);
    const good = el ? strongAgainst(el) : [];
    const team = [heroElement(state), ...(state.companions?.equipped ?? []).map(unitElement)];
    state.stars = { ...(state.stars ?? {}), [w]: [true, !(state.worldDeaths?.[w] > 0), team.some((x) => good.includes(x))] };
    out.push(w);
  }
  return out;
}
