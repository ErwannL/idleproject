// Contrats d'aventure : 3 objectifs actifs qui progressent tout seuls, sans compte à rebours.
// `amount(state)` fixe l'objectif selon la progression ; `reward` est remis à la validation.

export const CONTRACT_COUNT = 3;

// v7.7 : contrats thématiques (titre) ; un contrat sur 8 est « rare » (objectif ×2, récompense ×3).
export const RARE_CONTRACT = { chance: 0.125, targetMultiplier: 2, rewardMultiplier: 3, bonus: { gems: 100, shards: 20 } };

export const CONTRACT_TYPES = {
  kills: {
    title: 'Chasseur de monstres',
    label: (n) => `Vaincre ${n} monstres`,
    amount: (s) => 60 + 20 * Math.floor(s.maxStage / 5),
    reward: { gems: 20, shards: 10 },
  },
  gold: {
    title: 'Prospecteur',
    label: (n) => `Gagner ${n} or`,
    amount: (s, ctx) => Math.max(200, Math.round(ctx.killGold * 150)),
    reward: { gems: 20, keys: 0 },
  },
  rareLoot: {
    title: 'Collectionneur',
    label: (n) => `Trouver ${n} objets Rares ou mieux`,
    amount: () => 3,
    reward: { gems: 25, shards: 10 },
  },
  bosses: {
    title: 'Tueur de boss',
    label: (n) => `Vaincre ${n} boss`,
    amount: () => 2,
    reward: { gems: 30, keys: 1 },
  },
  recycle: {
    title: 'Recycleur',
    label: (n) => `Recycler ${n} objets`,
    amount: () => 10,
    reward: { gems: 115 },
  },
  stages: {
    title: 'Aventurier',
    label: (n) => `Franchir ${n} étapes`,
    amount: () => 10,
    reward: { gems: 25, shards: 15 },
  },
  items: {
    title: 'Pilleur',
    label: (n) => `Récupérer ${n} objets`,
    amount: () => 20,
    reward: { gems: 20, shards: 10 },
  },
};
