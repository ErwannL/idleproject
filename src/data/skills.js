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
  // v9.8 (F) : noms uniques dans tout le jeu (plus de Boule de feu, Météore, Frénésie… partagés avec d'autres).
  knight: [['Charge du chevalier', 'hit', 'skill_quick', 2.2], ['Garde sacrée', 'holy', 'skill_holy', 3]],
  archer: [['Tir perçant', 'hit', 'skill_quick', 2.4], ['Volée céleste', 'aoe', 'skill_whirl', 2.8]],
  pyromancer: [['Brasier', 'hit', 'skill_quick', 2.6], ['Pluie de météores', 'aoe', 'skill_whirl', 3.2]],
  berserker: [['Fureur sanglante', 'buff', 'skill_cry', 30], ['Massacre', 'aoe', 'skill_whirl', 3]],
  lancer: [['Coup de lance', 'hit', 'skill_quick', 2.5], ['Moisson', 'aoe', 'skill_whirl', 2.6]],
  paladin: [['Rayon divin', 'holy', 'skill_holy', 3.5], ['Bénédiction', 'buff', 'skill_cry', 25]],
  assassin: [['Lame cachée', 'hit', 'skill_quick', 3], ['Lames tourbillonnantes', 'aoe', 'skill_whirl', 2.4]],
  crossbowman: [['Carreau lourd', 'hit', 'skill_quick', 2.8], ['Salve', 'aoe', 'skill_whirl', 2.5]],
  stormcaller: [['Éclair', 'hit', 'skill_quick', 2.5], ['Tempête', 'aoe', 'skill_whirl', 3.4]],
  necromancer: [['Drain de vie', 'holy', 'skill_holy', 3], ['Nuée d\'os', 'aoe', 'skill_whirl', 2.9]],
};
for (const [cls, list] of Object.entries(CLASS_SKILL_DEFS)) {
  list.forEach(([name, type, icon, base], i) => SKILLS.push({
    id: `${cls}_${i + 1}`, cls, name, icon: `file:assets/ui/art104/skill_${cls}_${i + 1}.png`, /* v10.4 (3) : icônes PixelLab par type d'effet (anciennes : assets/ui/skills98/) */ unlockLevel: i ? 25 : 15, maxLevel: 50, cooldown: type === 'aoe' ? 14 : type === 'holy' ? 24 : type === 'buff' ? 20 : 8,
    type, base, perLevel: type === 'buff' ? 5 : 0.25, heal: 15, duration: 10, text: T[type],
  }));
}
export const LOADOUT_SIZE = 3;

// v9.8 (F) : les 4 compétences communes prennent le nom de la classe (le Mage de feu n'a plus Tourbillon ni Frappe
// sacrée). Mêmes identifiants (quick, whirl, cry, holy) : progression et effets inchangés, seul le nom suit la classe.
export const CLASS_COMMON_NAMES = {
  knight: ['Frappe rapide', 'Tourbillon', 'Cri de guerre', 'Frappe sacrée'],
  archer: ['Tir rapide', 'Tir en éventail', 'Œil d\'aigle', 'Flèche de lumière'],
  pyromancer: ['Étincelle', 'Vague de flammes', 'Embrasement', 'Flamme purificatrice'],
  berserker: ['Coup furieux', 'Moulinet', 'Rugissement', 'Coup du sang'],
  lancer: ['Estoc', 'Fauche circulaire', 'Cri du lancier', 'Lance sacrée'],
  paladin: ['Frappe juste', 'Cercle sacré', 'Prière de guerre', 'Châtiment'],
  assassin: ['Coup vif', 'Éventail de dagues', 'Ombre furtive', 'Lame bénie'],
  crossbowman: ['Carreau rapide', 'Tir de barrage', 'Visée', 'Carreau béni'],
  stormcaller: ['Étincelle d\'orage', 'Chaîne d\'éclairs', 'Charge statique', 'Foudre purificatrice'],
  necromancer: ['Toucher spectral', 'Vague d\'ombre', 'Pacte sombre', 'Âme volée'],
};
const COMMON_IDS = ['quick', 'whirl', 'cry', 'holy'];
export function applyClassSkillNames(cls) {
  const names = CLASS_COMMON_NAMES[cls] ?? CLASS_COMMON_NAMES.knight;
  const c = CLASS_COMMON_NAMES[cls] ? cls : 'knight';
  COMMON_IDS.forEach((id, i) => { const sk = SKILLS.find((x) => x.id === id); if (sk) { sk.name = names[i]; sk.icon = `file:assets/ui/art104/skill_${c}_${id}.png`; } });
}
