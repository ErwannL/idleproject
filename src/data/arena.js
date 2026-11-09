// v9.3.2 : réglages des modes compagnons (core/arena.js). Tout l'équilibrage est ici.
export const ARENA = {
  unlockStage: 25,           // ouvert avec la carte « Défis » (Aventure › Défis)
  levelWeight: 2,            // part du niveau du compagnon (×2 le bonus de niveau de la campagne : 8 % → 16 % par niveau)
  starPct: 12,               // +12 % par doublon
  critChance: 0.1,
  skillTimeScale: 0.5,       // les compétences reviennent deux fois plus vite qu'en campagne (combats courts)
  // Statistiques de base par rareté (niveau 1, aucun doublon). Familiers : PV ×0,8, attaque plus rapide.
  base: {
    common: { hp: 520, atk: 34, def: 10, interval: 1.0 },
    rare: { hp: 640, atk: 42, def: 14, interval: 0.95 },
    epic: { hp: 780, atk: 52, def: 18, interval: 0.9 },
    legendary: { hp: 940, atk: 64, def: 22, interval: 0.85 },
  },
  enemies: { hp: 130, hpGrowth: 1.17, atk: 16, atkGrowth: 1.13, def: 6, defGrowth: 1.08, interval: 1.3, bossHp: 4.5, bossAtk: 1.8 },
  survival: {
    waves: 30,
    triesPerDay: 3,
    modifiers: ['none', 'swift', 'armored', 'none', 'frenzy', 'regen'],
    milestones: [
      { wave: 5, reward: { gems: 15 } }, { wave: 10, reward: { gems: 30 } }, { wave: 15, reward: { gems: 45 } },
      { wave: 20, reward: { gems: 60 } }, { wave: 25, reward: { gems: 80 } }, { wave: 30, reward: { gems: 120 } },
    ],
  },
  floors: {
    teamSize: 3,
    scale: 1.25,             // un étage ≈ 0,85 vague de Survie en puissance (3 ennemis par étage)
    conditions: [            // tous les 5 étages : une contrainte (variété des compositions)
      { id: 'element', element: 'red', text: 'Ennemis de type Rouge' },
      { id: 'noheal', text: 'Soins réduits de moitié' },
      { id: 'element', element: 'dark', text: 'Ennemis de type Ténèbres' },
      { id: 'swift', text: 'Ennemis rapides' },
      { id: 'element', element: 'blue', text: 'Ennemis de type Bleu' },
      { id: 'element', element: 'light', text: 'Ennemis de type Lumière' },
      { id: 'element', element: 'green', text: 'Ennemis de type Vert' },
    ],
  },
};
