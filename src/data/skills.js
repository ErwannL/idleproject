// Compétences actives du héros : lancées automatiquement dès qu'elles sont prêtes
// (le jeu reste idle). Un point de compétence par niveau de héros.

export const SKILLS = [
  {
    id: 'quick', name: 'Frappe rapide', icon: 'skill_quick', unlockLevel: 1, maxLevel: 10, cooldown: 6,
    type: 'hit', base: 1.2, perLevel: 0.2,
    text: (v) => `Dégâts ×${v}`,
  },
  {
    id: 'whirl', name: 'Tourbillon', icon: 'skill_whirl', unlockLevel: 5, maxLevel: 10, cooldown: 12,
    type: 'aoe', base: 2.5, perLevel: 0.3,
    text: (v) => `Dégâts ×${v} à tous les ennemis`,
  },
  {
    id: 'cry', name: 'Cri de guerre', icon: 'skill_cry', unlockLevel: 12, maxLevel: 10, cooldown: 20, duration: 10,
    type: 'buff', base: 20, perLevel: 5,
    text: (v) => `+${v} % dégâts pendant 10 s`,
  },
  {
    id: 'holy', name: 'Frappe sacrée', icon: 'skill_holy', unlockLevel: 30, maxLevel: 10, cooldown: 30,
    type: 'holy', base: 5, perLevel: 1, heal: 20,
    text: (v) => `Dégâts ×${v} et soigne 20 % des PV`,
  },
];
