// Héros collectionnés : un héros actif, bonus selon ses étoiles.
import { HEROES } from '../data/heroes.js';
import { accountLookBonus } from './cosmetics.js';

export function heroById(id) {
  return HEROES.find((h) => h.id === id);
}

export function activeHero(state) {
  return heroById(state.heroes.active) ?? HEROES[0];
}

// v9.2.8 : les apparences sont des cosmétiques sans bonus. Le bonus du héros est un bonus de compte (core/cosmetics.js) :
// bonus de départ du Chevalier, ou « Héritage des apparences » (ancien bonus de l'apparence portée, gardé à la mise à jour).
export function heroEffects(state) {
  return { ...accountLookBonus(state) };
}

export function setActiveHero(state, id) {
  if (!state.heroes.owned[id]) return false;
  state.heroes.active = id;
  return true;
}
