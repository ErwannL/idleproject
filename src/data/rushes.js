// Boosts à durée limitée (façon Tap Titans) : on les déclenche d'un clic (ou automatiquement),
// ils durent quelques dizaines de secondes puis se rechargent. Chaque niveau (acheté avec l'or)
// renforce l'effet et allonge la durée.

export const RUSHES = [
  {
    id: 'rage', name: 'Rage du berserker', icon: 'boost_rage', color: '#ff5a3a', unlockLevel: 3,
    duration: 30, cooldown: 300, effect: { damagePct: 100 }, perLevel: { damagePct: 15 },
    text: 'Dégâts augmentés',
  },
  {
    id: 'frenzy', name: 'Frénésie', icon: 'boost_frenzy', color: '#ffd23f', unlockLevel: 8,
    duration: 30, cooldown: 300, effect: { attackSpeedPct: 60 }, perLevel: { attackSpeedPct: 6 },
    text: "Vitesse d'attaque augmentée",
  },
  {
    id: 'midas', name: 'Main de Midas', icon: 'boost_midas', color: '#f2b330', unlockLevel: 12,
    duration: 30, cooldown: 480, effect: { goldPct: 200 }, perLevel: { goldPct: 25 },
    text: 'Or gagné augmenté',
  },
  {
    id: 'hunter', name: 'Œil du chasseur', icon: 'boost_hunter', color: '#6fd6ff', unlockLevel: 18,
    duration: 30, cooldown: 360, effect: { critChance: 40 }, perLevel: { critChance: 2 },
    text: 'Chance de coup critique augmentée',
  },
  {
    id: 'phantom', name: 'Lame fantôme', icon: 'boost_phantom', color: '#b07bff', unlockLevel: 25,
    duration: 20, cooldown: 600, effect: {}, perLevel: {}, hitsPerSecond: 4, hitPct: 40, hitPctPerLevel: 4,
    text: 'Un double spectral frappe 4 fois par seconde',
  },
];

export const RUSH_RULES = {
  maxLevel: 25,
  durationPerLevel: 1, // +1 s par niveau
  costKills: 120, // coût du niveau 1 en « or de 120 monstres » de l'étape max
  costGrowth: 1.35,
};
