// v10.19 (parties 2, 3 et 7) : coréen des nouveaux textes — Équipement sur téléphone (« Équiper le meilleur (N) »,
// « N objets meilleurs ▲ », ligne du personnage). Branché à la fin de ./ko.js, sans écraser l'existant.
export const EXACT_1019_UI = {
  'Le meilleur est porté ✓': '최고 장비 착용 중 ✓',
  'Puissance': '전투력',
};

export const patterns1019Ui = (lookup) => [
  [/^⬆ Équiper le meilleur \((\d+)\)$/, (m) => `⬆ 최고 장비 착용 (${m[1]})`],
  [/^(\d+) objets? meilleurs? ▲$/, (m) => `더 좋은 장비 ${m[1]}개 ▲`],
  [/^(\d+) objets? meilleurs?$/, (m) => `더 좋은 장비 ${m[1]}개`],
  [/^(.+) · Niv\. (\d+)$/, (m) => `${lookup(m[1]) ?? m[1]} · Lv.${m[2]}`],
];
