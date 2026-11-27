// v10.19 (parties 2, 3 et 7) : anglais des nouveaux textes — Équipement sur téléphone (« Équiper le meilleur (N) »,
// « N objets meilleurs ▲ », ligne du personnage). Branché à la fin de ./en.js, sans écraser l'existant.
export const EXACT_1019_UI = {
  'Le meilleur est porté ✓': 'Best gear worn ✓',
  'Puissance': 'Power',
};

export const patterns1019Ui = (lookup) => [
  [/^⬆ Équiper le meilleur \((\d+)\)$/, (m) => `⬆ Equip the best (${m[1]})`],
  [/^(\d+) objets? meilleurs? ▲$/, (m) => `${m[1]} better item${m[1] === '1' ? '' : 's'} ▲`],
  [/^(\d+) objets? meilleurs?$/, (m) => `${m[1]} better item${m[1] === '1' ? '' : 's'}`],
  [/^(.+) · Niv\. (\d+)$/, (m) => `${lookup(m[1]) ?? m[1]} · Lv. ${m[2]}`],
];
