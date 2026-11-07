// v9.1.3 (doc1 lot F, « Coffre, Mannequins, Forge masqués jusqu'à un seuil ») : ces portes du sac n'avaient
// aucune condition. Elles s'ouvrent à une étape record (records.bestStage, jamais perdue à la Renaissance) et restent
// toujours visibles dès qu'elles ont servi : coffre non vide, objet renforcé, ou vue déjà ouverte. Les mannequins sont
// fondus dans le coffre (même chantier) : il ne reste que Forge et Coffre.
// (state.ui.invUsed). Seuils choisis d'après le bilan (docs/mesures-v913.md) : l'étape 54 est atteinte en 30 min, donc
// ces seuils retirent 3 portes pendant les 5 à 20 premières minutes, quand le sac n'est pas encore plein.
// Critère d'abandon : docs/refontes-v913.md.

export const INV_UNLOCKS = [
  { id: 'forge', label: 'Forge', stage: 10 }, // premiers éclats du recyclage : de quoi renforcer un objet
  { id: 'stash', label: 'Coffre', stage: 20 },
];

function used(state, id) {
  if (state.ui?.invUsed?.includes(id)) return true;
  switch (id) {
    case 'stash': return (state.stash?.length ?? 0) > 0;
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

// v9.2.0 : déblocage progressif des améliorations. Débutant (aucun boss vaincu) : Dégâts, Vitesse, PV ; après le
// premier boss : Critique, Armure, Régénération, Or ; les nouvelles à leur étape record (`unlockStage`). Une ligne
// déjà achetée reste toujours visible.
export const BASE_UPGRADES = ['damage', 'attackSpeed', 'vitality'];
// v9.2.8 : + Double attaque (étape 25) et Défense (après le premier boss) : 15 lignes.
export const UPGRADE_ORDER = ['damage', 'attackSpeed', 'crit', 'critDamage', 'doubleAttack', 'bossDamage', 'companionPower',
  'vitality', 'defense', 'armor', 'regen', 'lifesteal', 'dodge', 'goldFind', 'xpGain'];

export function upgradeOpen(state, key, balance) {
  const up = balance.upgrades[key];
  if (!up) return false;
  if (BASE_UPGRADES.includes(key) || (state.upgrades?.[key] ?? 0) > 0) return true;
  if ((state.records?.bossesDefeated ?? 0) === 0) return false;
  const best = Math.max(state.maxStage ?? 1, state.records?.bestStage ?? 1);
  return best >= (up.unlockStage ?? 0);
}

export function openUpgrades(state, balance) {
  return UPGRADE_ORDER.filter((k) => k in balance.upgrades && upgradeOpen(state, k, balance));
}

// Prochaine amélioration fermée (texte neutre « Prochain : X à l'étape N »), ou null.
export function nextUpgradeUnlock(state, balance) {
  const closed = UPGRADE_ORDER.filter((k) => balance.upgrades[k]?.unlockStage && !upgradeOpen(state, k, balance));
  return closed.map((k) => ({ key: k, label: balance.upgrades[k].label, stage: balance.upgrades[k].unlockStage }))
    .sort((a, b) => a.stage - b.stage)[0] ?? null;
}
