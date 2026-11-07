// v9.2.8 : cosmétiques (document du producteur, sections 13 à 16) : apparences du héros (skins) et thèmes d'interface.
// Aucun bonus de puissance : l'apparence équipée ne change plus les statistiques. Possédés (state.heroes.owned,
// state.cosmetics.themes) et équipés (state.heroes.active, state.ui.theme) sont séparés ; équiper et retirer sont
// libres ; un cosmétique possédé ne se rachète pas (core/store.js).
//
// Conversion des anciennes apparences (qui donnaient « +6 % dégâts »…) : le bonus de l'apparence équipée au moment de
// la mise à jour (étoiles comprises) devient un bonus de compte permanent, « Héritage des apparences », qui ne dépend
// plus d'aucun cosmétique (state.economy.legacyLook). Un nouveau joueur a le bonus de départ du Chevalier (+5 % dégâts,
// +5 % PV), comme avant. Les doublons d'apparences sont remboursés en tickets limités (un par exemplaire invoqué).
import { HEROES, HERO_STAR_BONUS_PCT, STARTER_HERO } from '../data/heroes.js';
import { THEMES } from '../ui/themes.js';
import { ensureEconomy } from './wallet.js';

export const STARTER_BONUS = { ...HEROES.find((h) => h.id === STARTER_HERO).bonus };

// Ancienne formule (v9.0.6 à v9.2.7) : bonus de l'apparence × (1 + 20 % par étoile au-delà de la première).
export function oldLookBonus(state) {
  const hero = HEROES.find((h) => h.id === state.heroes?.active) ?? HEROES[0];
  const stars = state.heroes?.owned?.[hero.id]?.stars ?? 1;
  const factor = 1 + (HERO_STAR_BONUS_PCT / 100) * (stars - 1);
  return { from: hero.id, bonus: Object.fromEntries(Object.entries(hero.bonus).map(([k, v]) => [k, v * factor])) };
}

// Bonus de compte (jamais lié au cosmétique porté).
export function accountLookBonus(state) {
  return state.economy?.legacyLook?.bonus ?? STARTER_BONUS;
}

// Migration (une fois, sauvegarde d'avant la v9.2.8) : renvoie le nombre de tickets limités remboursés.
export function migrateLooks(state) {
  const eco = ensureEconomy(state);
  if (eco.legacyLook) return 0;
  eco.legacyLook = oldLookBonus(state);
  let tickets = 0;
  for (const h of HEROES) {
    const o = state.heroes.owned[h.id];
    if (o && h.summon) tickets += Math.max(0, (o.stars ?? 1) - 1); // doublons d'apparences invoquées
  }
  for (const o of Object.values(state.heroes.owned)) o.stars = 1; // plus d'étoiles sur un cosmétique
  return tickets;
}

export const ownsSkin = (state, id) => Boolean(state.heroes.owned[id]);
export function equipSkin(state, id) {
  if (!ownsSkin(state, id)) return false;
  state.heroes.active = id;
  return true;
}
export function unequipSkin(state) {
  state.heroes.active = STARTER_HERO;
  return true;
}

export const themeInfo = (id) => THEMES.find((t) => t.id === id) ?? null;
export function ownsTheme(state, id) {
  const t = themeInfo(id);
  if (!t) return false;
  return !t.shop || Boolean(state.cosmetics?.themes?.[id]);
}
// Thème réellement appliqué : un thème de boutique non possédé (sauvegarde modifiée, achat annulé) revient au Chevalier.
export const wornTheme = (state) => (ownsTheme(state, state.ui?.theme ?? 'knight') ? state.ui?.theme ?? 'knight' : 'knight');

export function sanitizeCosmetics(raw) {
  const out = { themes: {} };
  const t = raw?.themes;
  if (t && typeof t === 'object') for (const id of Object.keys(t)) if (themeInfo(id)?.shop && t[id] === true) out.themes[id] = true;
  return out;
}
