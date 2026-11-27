// v10.19 (partie 4) : anglais des nouveaux textes « plus de mort en un éclair » (Second souffle, prévision du boss).
// Branché à la fin de ./en.js, sans écraser l'existant.
export const EXACT_1019_SURVIE = {
  'Second souffle !': 'Second wind!',
};
export const patterns1019Survie = () => [
  [/^⚔ Prochain boss à l'étape ([\d-]+(?: ×\d+)?)\.$/, (m) => `⚔ Next boss at stage ${m[1]}.`],
];
