// Héros collectionnés : un héros actif, bonus selon ses étoiles.
import { HERO_STAR_BONUS_PCT, HEROES } from '../data/heroes.js';

export function heroById(id) {
  return HEROES.find((h) => h.id === id);
}

export function activeHero(state) {
  return heroById(state.heroes.active) ?? HEROES[0];
}

export function heroEffects(state) {
  const hero = activeHero(state);
  const stars = state.heroes.owned[hero.id]?.stars ?? 1;
  const factor = 1 + (HERO_STAR_BONUS_PCT / 100) * (stars - 1);
  return Object.fromEntries(Object.entries(hero.bonus).map(([k, v]) => [k, v * factor]));
}

export function setActiveHero(state, id) {
  if (!state.heroes.owned[id]) return false;
  state.heroes.active = id;
  return true;
}
