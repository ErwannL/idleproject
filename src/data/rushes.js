// v9.6.3 (5.2) : compétences manuelles façon Tap Titans — 5 à 10 s, recharge 60 à 120 s, 3 emplacements ; le joueur
// présent choisit son moment (pleine puissance), le mode Auto les lance à 60 %.
// Boosts à durée limitée (façon Tap Titans) : on les déclenche d'un clic (ou automatiquement),
// ils durent quelques dizaines de secondes puis se rechargent. Chaque niveau (acheté avec l'or)
// renforce l'effet et allonge la durée.

export const RUSHES = [
  {
    id: 'rage', name: 'Rage du berserker', icon: 'boost_rage', color: '#ff5a3a', unlockLevel: 3,
    duration: 8, cooldown: 60, effect: { damagePct: 100 }, perLevel: { damagePct: 15 },
    text: 'Dégâts augmentés',
  },
  {
    id: 'frenzy', name: 'Frénésie', icon: 'boost_frenzy', color: '#ffd23f', unlockLevel: 8,
    duration: 8, cooldown: 60, effect: { attackSpeedPct: 60 }, perLevel: { attackSpeedPct: 6 },
    text: "Vitesse d'attaque augmentée",
  },
  {
    id: 'midas', name: 'Main de Midas', icon: 'boost_midas', color: '#f2b330', unlockLevel: 12,
    duration: 8, cooldown: 90, effect: { goldPct: 200 }, perLevel: { goldPct: 25 },
    text: 'Or gagné augmenté',
  },
  {
    id: 'hunter', name: 'Œil du chasseur', icon: 'boost_hunter', color: '#6fd6ff', unlockLevel: 18,
    duration: 8, cooldown: 75, effect: { critChance: 40 }, perLevel: { critChance: 2 },
    text: 'Chance de coup critique augmentée',
  },
  {
    id: 'phantom', name: 'Lame fantôme', icon: 'boost_phantom', color: '#b07bff', unlockLevel: 25,
    duration: 6, cooldown: 120, effect: {}, perLevel: {}, hitsPerSecond: 4, hitPct: 40, hitPctPerLevel: 4,
    text: 'Un double spectral frappe 4 fois par seconde',
  },
];

export const RUSH_RULES = {
  maxLevel: 25,
  durationPerLevel: 0.1, // v9.6.3 (5.2) : compétences manuelles courtes (5 à 10 s) : +0,1 s par niveau (avant +1 s)
  slots: 3, // 3 emplacements choisis par le joueur (touches 1, 2, 3)
  autoPct: 0.6, // mode Auto (idle, jeu fermé) : lancées dès qu'elles sont prêtes, à 60 % de leur effet
  costKills: 120, // coût du niveau 1 en « or de 120 monstres » de l'étape max
  costGrowth: 1.35,
};
