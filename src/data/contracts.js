// Contrats d'aventure : 3 objectifs actifs qui progressent tout seuls, sans compte à rebours.
// `amount(state)` fixe l'objectif selon la progression ; `reward` est remis à la validation.

export const CONTRACT_COUNT = 3;

export const CONTRACT_TYPES = {
  kills: {
    label: (n) => `Vaincre ${n} monstres`,
    amount: (s) => 60 + 20 * Math.floor(s.maxStage / 5),
    reward: { gems: 20, shards: 10 },
  },
  gold: {
    label: (n) => `Gagner ${n} or`,
    amount: (s, ctx) => Math.max(200, Math.round(ctx.killGold * 150)),
    reward: { gems: 20, tickets: 0, keys: 0 },
  },
  rareLoot: {
    label: (n) => `Trouver ${n} objets Rares ou mieux`,
    amount: () => 3,
    reward: { gems: 25, essence: 1 },
  },
  bosses: {
    label: (n) => `Vaincre ${n} boss`,
    amount: () => 2,
    reward: { gems: 30, keys: 1 },
  },
  recycle: {
    label: (n) => `Recycler ${n} objets`,
    amount: () => 10,
    reward: { gems: 15, tickets: 1 },
  },
};
