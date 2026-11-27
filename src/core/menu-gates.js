// v10.19 (6.3) : les 6 menus du bas s'ouvrent un par un dans une partie neuve (plus « 6 menus d'un coup » à 1 min 53) :
// Héros à l'étape 3, Objectifs à l'étape 5, Invocation à l'étape 7, Aventure à l'étape 10, Équipe au premier compagnon
// (première invocation), Boutique à l'étape 12. Chaque menu ouvert le reste pour toujours (state.ui.menusOpen, sauvegardé).
// Seule une partie neuve pose state.ui.menusOpen = [] : une sauvegarde existante (ou un état de test) n'a pas cette liste
// et garde tous ses menus ouverts.
import { BALANCE } from '../data/balance.js';
import { canPay } from './gacha.js';
import { isUnlocked } from './unlock-quests.js';

const best = (s) => Math.max(s?.maxStage ?? 1, s?.records?.bestStage ?? 1);
const ownsCompanion = (s) => Object.keys(s?.companions?.owned ?? {}).length > 0 || (s?.records?.summons ?? 0) > 0;

export const MENU_GATES = [
  { id: 'hero', stage: 3, label: 'Héros' },
  { id: 'goals', stage: 5, label: 'Objectifs' },
  { id: 'summon', stage: 7, label: 'Invocation' },
  { id: 'adventure', stage: 10, label: 'Aventure' },
  { id: 'team', companion: true, label: 'Équipe' },
  { id: 'shop', stage: 12, label: 'Boutique' },
];

// Vrai si la partie suit l'ouverture menu par menu (partie neuve depuis la 10.19).
export const menusGated = (state) => Array.isArray(state?.ui?.menusOpen);

function gateMet(state, g) {
  return g.companion ? ownsCompanion(state) : best(state) >= g.stage;
}

// Le menu `id` est-il ouvert ? (un menu sans porte, ou une partie sans la liste : toujours.)
export function menuOpen(state, id) {
  if (!menusGated(state)) return true;
  if (state.ui.menusOpen.includes(id)) return true;
  const g = MENU_GATES.find((x) => x.id === id);
  return !g || gateMet(state, g);
}

// Note les menus qui viennent de s'ouvrir (une seule fois chacun). Renvoie leurs identifiants, dans l'ordre des portes.
export function syncMenus(state) {
  if (!menusGated(state)) return [];
  const fresh = MENU_GATES.filter((g) => !state.ui.menusOpen.includes(g.id) && gateMet(state, g)).map((g) => g.id);
  if (fresh.length) {
    state.ui.menusOpen = [...state.ui.menusOpen, ...fresh];
    state.ui.menusNew = [...new Set([...(state.ui.menusNew ?? []), ...fresh])]; // bulle « Nouveau : … » à montrer
  }
  return fresh;
}

// Le menu ouvert le plus ancien dont la bulle « Nouveau » n'a pas encore été vue, ou null.
export const nextNewMenu = (state) => (state?.ui?.menusNew ?? [])[0] ?? null;
export function menuSeen(state, id) {
  if (state?.ui?.menusNew) state.ui.menusNew = state.ui.menusNew.filter((x) => x !== id);
}

// Invocation possible maintenant : menu ouvert (ou mini-quête faite) et de quoi payer un tirage.
export function canSummonNow(state, balance = BALANCE) {
  if (!state) return false;
  const reachable = menusGated(state) ? menuOpen(state, 'summon') : isUnlocked(state, 'summon');
  if (!reachable) return false;
  const pays = [['limited', 'gems'], ['limited', 'ticketLimited'], ['permanent', 'gems'], ['permanent', 'ticketPermanent']];
  return pays.some(([pool, cur]) => { try { return canPay(state, pool, 1, cur, balance); } catch { return false; } });
}

// v10.19 (6.4) : la première vague (étape 1) est finie. Avant, ni bulle « Nouveau : Gemmes » ni « Tout récupérer » :
// au tout début, seul le combat parle.
export const firstWaveDone = (state) => best(state) >= 2 || (state?.unlocks?.legacy ?? false);
