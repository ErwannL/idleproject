// v9.1.3 (doc1 lot F, « Coffre, Mannequins, Forge masqués jusqu'à un seuil ») : ces trois portes du sac n'avaient
// aucune condition. Elles s'ouvrent à une étape record (records.bestStage, jamais perdue à la Renaissance) et restent
// toujours visibles dès qu'elles ont servi : coffre non vide, pièce sur un mannequin, objet renforcé, ou vue déjà ouverte
// (state.ui.invUsed). Seuils choisis d'après le bilan (docs/mesures-v913.md) : l'étape 54 est atteinte en 30 min, donc
// ces seuils retirent 3 portes pendant les 5 à 20 premières minutes, quand le sac n'est pas encore plein.
// Critère d'abandon : docs/refontes-v913.md.
import { mannequinItems } from './stash.js';

export const INV_UNLOCKS = [
  { id: 'forge', label: 'Forge', stage: 10 }, // premiers éclats du recyclage : de quoi renforcer un objet
  { id: 'stash', label: 'Coffre', stage: 20 },
  { id: 'mannequins', label: 'Mannequins', stage: 30 }, // les pièces d'ensemble deviennent courantes
];

function used(state, id) {
  if (state.ui?.invUsed?.includes(id)) return true;
  switch (id) {
    case 'stash': return (state.stash?.length ?? 0) > 0;
    case 'mannequins': return mannequinItems(state).length > 0;
    case 'forge': return [...state.inventory, ...(state.stash ?? []), ...Object.values(state.equipment ?? {})].some((x) => (x?.upgrades ?? 0) > 0);
    default: return false;
  }
}

export function invFeatureOpen(state, id) {
  const u = INV_UNLOCKS.find((x) => x.id === id);
  if (!u) return true;
  const best = Math.max(state.maxStage ?? 1, state.records?.bestStage ?? 1);
  return best >= u.stage || used(state, id);
}

// Prochaine porte fermée (texte neutre « Prochain : X à l'étape N »), ou null.
export function nextInvUnlock(state) {
  return INV_UNLOCKS.find((u) => !invFeatureOpen(state, u.id)) ?? null;
}

export function markInvUsed(state, id) {
  if (!INV_UNLOCKS.some((u) => u.id === id)) return;
  state.ui.invUsed = [...new Set([...(state.ui.invUsed ?? []), id])];
}
