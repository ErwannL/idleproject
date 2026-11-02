// Hauts faits (v8.3) : défis permanents mesurés sur toute la partie (jamais réinitialisés).
// Chacun se réclame une fois contre des gemmes, et chaque haut fait obtenu donne un petit bonus
// permanent : +1 % de dégâts et +1 % d'or (source « Hauts faits » dans la fiche du héros).
import { COMPANIONS } from '../data/companions.js';

const totalCleared = (s) => Object.values(s.dungeonsCleared ?? {}).reduce((a, b) => a + b, 0);
// v9.1.3 : seuls les compagnons et familiers qui existent comptent (COMPANIONS contient les deux).
const owned = (s) => COMPANIONS.filter((c) => s.companions?.owned?.[c.id]).length;

const METRICS = {
  kills: { label: 'Ennemis vaincus', value: (s) => s.records.kills },
  bosses: { label: 'Boss vaincus', value: (s) => s.records.bossesDefeated },
  // v9.1.3 : records qui ne retombent pas après une Renaissance (S1b).
  stage: { label: 'Étape maximale', value: (s) => Math.max(s.records.bestStage ?? 0, s.maxStage) },
  level: { label: 'Niveau du héros', value: (s) => Math.max(s.records.bestLevel ?? 0, s.level) },
  items: { label: 'Objets trouvés', value: (s) => s.records.itemsFound },
  summons: { label: 'Invocations', value: (s) => s.records.summons },
  rebirths: { label: 'Renaissances', value: (s) => s.records.rebirths },
  tower: { label: 'Record de la Tour', value: (s) => s.towerBest ?? 0 },
  team: { label: 'Compagnons et familiers obtenus', value: owned },
  dungeons: { label: 'Donjons terminés', value: totalCleared },
  contracts: { label: 'Contrats remplis', value: (s) => s.records.contractsDone },
  gold: { label: 'Or gagné au total', value: (s) => s.records.goldEarned },
};

// [id, nom, métrique, objectif, gemmes]
const LIST = [
  ['kills1', 'Premier sang', 'kills', 100, 20], ['kills2', 'Faucheur', 'kills', 10000, 60],
  ['kills3', 'Fléau des monstres', 'kills', 250000, 150], ['kills4', 'Apocalypse', 'kills', 5000000, 400],
  ['boss1', 'Tueur de boss', 'bosses', 10, 30], ['boss2', 'Chasseur de légendes', 'bosses', 150, 90],
  ['boss3', 'Terreur des trônes', 'bosses', 1500, 250],
  ['stage1', 'Hors des plaines', 'stage', 21, 30], ['stage2', 'Au cœur des ténèbres', 'stage', 101, 80],
  ['stage3', 'Les mondes célestes', 'stage', 141, 150], ['stage4', "Maître de l'Abysse", 'stage', 211, 300],
  ['stage5', 'Au-delà de tout', 'stage', 421, 600],
  ['lvl1', 'Aguerri', 'level', 25, 25], ['lvl2', 'Vétéran', 'level', 100, 80], ['lvl3', 'Légende vivante', 'level', 300, 250],
  ['item1', 'Ramasseur', 'items', 100, 20], ['item2', 'Collectionneur', 'items', 2000, 80], ['item3', 'Dragon du trésor', 'items', 25000, 250],
  ['sum1', 'Premier appel', 'summons', 10, 20], ['sum2', 'Invocateur', 'summons', 200, 100], ['sum3', 'Maître des portails', 'summons', 1000, 300],
  ['reb1', 'Renaissance', 'rebirths', 1, 50], ['reb2', 'Phénix', 'rebirths', 10, 200], ['reb3', 'Éternel retour', 'rebirths', 50, 500],
  ['tow1', 'Grimpeur', 'tower', 10, 60], ['tow2', 'Cime des nuages', 'tower', 30, 200], ['tow3', 'Gardien de l\'Éternité', 'tower', 75, 500],
  ['team1', 'Compagnie', 'team', 5, 30], ['team2', 'Légion', 'team', 15, 120], ['team3', 'Ménagerie complète', 'team', COMPANIONS.length, 350],
  ['dun1', 'Explorateur', 'dungeons', 1, 30], ['dun2', 'Pilleur de cryptes', 'dungeons', 25, 120], ['dun3', 'Seigneur des profondeurs', 'dungeons', 150, 350],
  ['con1', 'Mercenaire', 'contracts', 10, 30], ['con2', 'Homme de parole', 'contracts', 150, 150],
  ['gold1', 'Bourse pleine', 'gold', 1e6, 20], ['gold2', 'Trésorier', 'gold', 1e12, 100], ['gold3', 'Roi Midas', 'gold', 1e24, 400],
];

export const ACHIEVEMENTS = LIST.map(([id, name, metric, target, gems]) => ({ id, name, metric, target, gems, label: METRICS[metric].label }));
export const ACHIEVEMENT_BONUS = { damagePct: 1, goldPct: 1 }; // par haut fait obtenu

export function achievementProgress(state, a) {
  const value = METRICS[a.metric].value(state) ?? 0;
  return { value, ratio: Math.min(1, value / a.target), done: value >= a.target, claimed: Boolean(state.achievements?.claimed?.[a.id]) };
}

export function claimableAchievements(state) {
  return ACHIEVEMENTS.filter((a) => { const p = achievementProgress(state, a); return p.done && !p.claimed; });
}

export function claimAchievement(state, id) {
  const a = ACHIEVEMENTS.find((x) => x.id === id);
  if (!a) return null;
  const p = achievementProgress(state, a);
  if (!p.done || p.claimed) return null;
  state.achievements.claimed[id] = true;
  state.gems += a.gems;
  return a;
}

export function achievementCount(state) {
  return Object.keys(state.achievements?.claimed ?? {}).filter((id) => ACHIEVEMENTS.some((a) => a.id === id)).length;
}

export function achievementEffects(state) {
  const n = achievementCount(state);
  return n ? Object.fromEntries(Object.entries(ACHIEVEMENT_BONUS).map(([k, v]) => [k, v * n])) : {};
}

export function sanitizeAchievements(raw) {
  const claimed = {};
  for (const [id, v] of Object.entries(raw?.claimed ?? {})) if (v === true && ACHIEVEMENTS.some((a) => a.id === id)) claimed[id] = true;
  return { claimed };
}

// v9.1.3 (A8) : hauts faits regroupés par métrique (une ligne par métrique). `claimed` reste par id ;
// le palier affiché est le plus bas prêt à récupérer, sinon le prochain à atteindre, sinon le dernier.
export function achievementGroups(state) {
  const groups = [];
  for (const metric of Object.keys(METRICS)) {
    const tiers = ACHIEVEMENTS.filter((a) => a.metric === metric);
    if (!tiers.length) continue;
    const progress = tiers.map((a) => achievementProgress(state, a));
    let idx = progress.findIndex((p) => p.done && !p.claimed);
    const ready = idx >= 0;
    if (!ready) idx = progress.findIndex((p) => !p.claimed);
    const allDone = idx < 0;
    if (allDone) idx = tiers.length - 1;
    groups.push({ metric, label: METRICS[metric].label, tiers, tier: tiers[idx], index: idx, progress: progress[idx], ready,
      allDone, claimedCount: progress.filter((p) => p.claimed).length, readyCount: progress.filter((p) => p.done && !p.claimed).length });
  }
  return groups;
}
