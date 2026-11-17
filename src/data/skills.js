// Compétences actives du héros : lancées automatiquement dès qu'elles sont prêtes
// (le jeu reste idle). Un point de compétence par niveau de héros.

export const SKILLS = [
  {
    id: 'quick', name: 'Frappe rapide', icon: 'skill_quick', unlockLevel: 1, maxLevel: 50, cooldown: 6,
    type: 'hit', base: 1.2, perLevel: 0.2,
    text: (v) => `Dégâts ×${v}`,
  },
  {
    id: 'whirl', name: 'Tourbillon', icon: 'skill_whirl', unlockLevel: 5, maxLevel: 50, cooldown: 12,
    type: 'aoe', base: 2.5, perLevel: 0.3,
    text: (v) => `Dégâts ×${v} à tous les ennemis`,
  },
  {
    id: 'cry', name: 'Cri de guerre', icon: 'skill_cry', unlockLevel: 12, maxLevel: 50, cooldown: 20, duration: 10,
    type: 'buff', base: 20, perLevel: 5,
    text: (v) => `+${v} % dégâts pendant 10 s`,
  },
  {
    id: 'holy', name: 'Frappe sacrée', icon: 'skill_holy', unlockLevel: 30, maxLevel: 50, cooldown: 30,
    type: 'holy', base: 5, perLevel: 1, heal: 20,
    text: (v) => `Dégâts ×${v} et soigne 20 % des PV`,
  },
];

// v9.7.1 (lot 6) : compétences du héros à choisir — 6 par classe (les 4 communes + 2 propres à la classe), 3 actives
// (state.skillLoadout, choisies dans Compétences). Les compétences de classe reprennent les effets connus du moteur
// (coup, zone, cri, frappe sacrée) avec leurs propres chiffres.
const T = {
  hit: (v) => `Dégâts ×${v}`, aoe: (v) => `Dégâts ×${v} à tous les ennemis`,
  buff: (v) => `+${v} % dégâts pendant 10 s`, holy: (v) => `Dégâts ×${v} et soigne 15 % des PV`,
};
const CLASS_SKILL_DEFS = {
  knight: [['Charge du chevalier', 'hit', 'skill_quick', 2.2], ['Rempart', 'holy', 'skill_holy', 3]],
  archer: [['Tir perçant', 'hit', 'skill_quick', 2.4], ['Pluie de flèches', 'aoe', 'skill_whirl', 2.8]],
  pyromancer: [['Boule de feu', 'hit', 'skill_quick', 2.6], ['Météore', 'aoe', 'skill_whirl', 3.2]],
  berserker: [['Frénésie', 'buff', 'skill_cry', 30], ['Massacre', 'aoe', 'skill_whirl', 3]],
  lancer: [['Percée', 'hit', 'skill_quick', 2.5], ['Balayage', 'aoe', 'skill_whirl', 2.6]],
  paladin: [['Lumière divine', 'holy', 'skill_holy', 3.5], ['Bénédiction', 'buff', 'skill_cry', 25]],
  assassin: [['Lame cachée', 'hit', 'skill_quick', 3], ['Danse des lames', 'aoe', 'skill_whirl', 2.4]],
  crossbowman: [['Carreau lourd', 'hit', 'skill_quick', 2.8], ['Salve', 'aoe', 'skill_whirl', 2.5]],
  stormcaller: [['Éclair', 'hit', 'skill_quick', 2.5], ['Tempête', 'aoe', 'skill_whirl', 3.4]],
  necromancer: [['Drain de vie', 'holy', 'skill_holy', 3], ['Nuée d\'os', 'aoe', 'skill_whirl', 2.9]],
};
for (const [cls, list] of Object.entries(CLASS_SKILL_DEFS)) {
  list.forEach(([name, type, icon, base], i) => SKILLS.push({
    id: `${cls}_${i + 1}`, cls, name, icon, unlockLevel: i ? 25 : 15, maxLevel: 50, cooldown: type === 'aoe' ? 14 : type === 'holy' ? 24 : type === 'buff' ? 20 : 8,
    type, base, perLevel: type === 'buff' ? 5 : 0.25, heal: 15, duration: 10, text: T[type],
  }));
}
export const LOADOUT_SIZE = 3;
