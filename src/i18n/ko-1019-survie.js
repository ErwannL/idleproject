// v10.19 (partie 4) : coréen des nouveaux textes « plus de mort en un éclair » (Second souffle, prévision du boss).
// Branché à la fin de ./ko.js, sans écraser l'existant.
export const EXACT_1019_SURVIE = {
  'Second souffle !': '재기의 숨결!',
};
export const patterns1019Survie = () => [
  [/^⚔ Prochain boss à l'étape ([\d-]+(?: ×\d+)?)\.$/, (m) => `⚔ 다음 보스: 스테이지 ${m[1]}`],
];
