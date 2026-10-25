// Collections du Codex (v7.7) : découvrir monstres, boss, équipements et compagnons donne des
// récompenses de confort (gemmes, tickets, éclats), jamais de puissance démesurée.

export const COLLECTIONS = [
  { id: 'monsters', label: 'Monstres', icon: 'icon_skull', milestones: [5, 10, 20, 30, 40], reward: { gems: 25, shards: 20 } },
  { id: 'bosses', label: 'Boss', icon: 'icon_boss', milestones: [3, 6, 12, 24, 40], reward: { gems: 40, tickets: 1 } },
  { id: 'items', label: 'Équipements', icon: 'icon_bag', milestones: [10, 25, 50, 75, 100], reward: { gems: 30, essence: 2 } },
  { id: 'companions', label: 'Compagnons et familiers', icon: 'icon_paw', milestones: [3, 6, 10, 15, 26], reward: { gems: 50, tickets: 1 } },
];
