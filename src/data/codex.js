// Collections du Codex (v7.7) : découvrir monstres, boss, équipements et compagnons donne des
// récompenses de confort (gemmes, tickets, éclats), jamais de puissance démesurée.

export const COLLECTIONS = [
// v9.0 : `text` explique ce qu'il faut faire ; un palier ne dépasse jamais le nombre réel d'éléments
// (Équipements visait 75 puis 100 alors qu'il n'existe que 60 modèles).
  { id: 'monsters', label: 'Monstres', icon: 'icon_skull', milestones: [5, 10, 20, 30, 41], reward: { gems: 25, shards: 20 },
    text: 'Vaincre au moins une fois chaque sorte de monstre, dans tous les mondes.' },
  { id: 'bosses', label: 'Boss', icon: 'icon_boss', milestones: [3, 6, 12, 24, 41], reward: { gems: 40, tickets: 1 },
    text: 'Vaincre au moins une fois chaque boss : mini-boss, boss et méga boss des 11 mondes.' },
  { id: 'items', label: 'Équipements', icon: 'icon_bag', milestones: [10, 25, 40, 60, 78], reward: { gems: 30, essence: 2 },
    text: 'Ramasser au moins une fois chaque modèle d\'équipement : armes, casques, armures, chaque accessoire dans chaque pierre, et les objets ancestraux des boss. La rareté ne compte pas.' },
  { id: 'companions', label: 'Compagnons et familiers', icon: 'icon_paw', milestones: [3, 6, 10, 15, 26], reward: { gems: 50, tickets: 1 },
    text: 'Obtenir chaque compagnon et chaque familier (onglet Invocation).' },
];
