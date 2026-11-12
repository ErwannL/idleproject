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
// v9.3.5 : 3 lignes au début (Dégâts, PV, Or), puis une de plus tous les deux boss vaincus (dans OPEN_SEQUENCE), toujours
// à partir de son étape d'ouverture ; Armure arrive tard (Défense d'abord : une seule ligne de protection au début).
export const BASE_UPGRADES = ['damage', 'vitality', 'goldFind'];
export const OPEN_SEQUENCE = ['attackSpeed', 'crit', 'defense', 'critDamage', 'regen', 'doubleAttack', 'bossDamage', 'companionPower',
  'lifesteal', 'xpGain', 'dodge']; // v9.3.9 : Peau de fer fondue dans Défense
const openCount = (state) => Math.ceil((state.records?.bossesDefeated ?? 0) / 2);
// v9.2.8 : + Double attaque (étape 25) et Défense (après le premier boss) : 15 lignes.
export const UPGRADE_ORDER = ['damage', 'attackSpeed', 'crit', 'critDamage', 'doubleAttack', 'bossDamage', 'companionPower',
  'vitality', 'defense', 'regen', 'lifesteal', 'dodge', 'goldFind', 'xpGain']; // v9.3.9 : sans Peau de fer (Défense)

export function upgradeOpen(state, key, balance) {
  const up = balance.upgrades[key];
  if (!up) return false;
  if (balance.upgrades[key].retired) return false; // v9.3.9
  if (BASE_UPGRADES.includes(key) || (state.upgrades?.[key] ?? 0) > 0) return true;
  if ((state.records?.bossesDefeated ?? 0) === 0) return false;
  const best = Math.max(state.maxStage ?? 1, state.records?.bestStage ?? 1);
  if (best < (up.unlockStage ?? 0)) return false;
  const i = OPEN_SEQUENCE.indexOf(key);
  return i < 0 || i < openCount(state) || best >= 200; // v9.3.5 : une ligne de plus tous les deux boss
}

export function openUpgrades(state, balance) {
  return UPGRADE_ORDER.filter((k) => k in balance.upgrades && upgradeOpen(state, k, balance));
}

// Prochaine amélioration fermée (texte neutre « Prochain : X à l'étape N »), ou null.
export function nextUpgradeUnlock(state, balance) {
  const k = OPEN_SEQUENCE.find((x) => x in balance.upgrades && !upgradeOpen(state, x, balance));
  if (!k) return null;
  const best = Math.max(state.maxStage ?? 1, state.records?.bestStage ?? 1);
  return { key: k, label: balance.upgrades[k].label, stage: Math.max(balance.upgrades[k].unlockStage ?? 0, best + 1) };
}

// v9.3.8 (4) : toujours un objectif proche à l'écran — le prochain déblocage par étape record, et la progression vers lui.
const MILESTONES = [
  { stage: 10, label: 'Forge' }, { stage: 10, label: 'Talents' }, { stage: 25, label: 'Donjons' }, { stage: 25, label: 'Arène' },
  { stage: 30, label: 'Renaissance' }, { stage: 41, label: 'Événement' }, { stage: 60, label: 'Tour de l\'Éternité' },
];
export function nextMilestone(state) {
  const best = Math.max(state.maxStage ?? 1, state.records?.bestStage ?? 1);
  const next = MILESTONES.find((m) => m.stage > best);
  if (!next) return null;
  const prev = [...MILESTONES].reverse().find((m) => m.stage <= best)?.stage ?? 1;
  return { label: next.label, stage: next.stage, ratio: Math.max(0, Math.min(1, (best - prev) / Math.max(1, next.stage - prev))) };
}
