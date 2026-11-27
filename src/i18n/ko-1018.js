// v10.18 (parties 2 et 3) : coréen des nouveaux textes — touche d'attaque « en attente » (aria-label), gros lot du Carnet
// de l'Apprenti. Branché à la fin de ./ko.js, sans écraser l'existant.
export const EXACT_1018 = {
  'Gros lot du jour 7 : un compagnon Épique au choix': '7일차 대상: 원하는 에픽 동료 1명',
  'Garde au moins une compétence active': '활성 스킬을 최소 1개는 유지하세요',
};

export const patterns1018 = (lookup) => [
  // aria-label d'une touche d'attaque gardée : « Frappe rapide : en attente »
  [/^(.+) : en attente$/, (m) => `${lookup(m[1]) ?? m[1]}: 대기 중`],
];
