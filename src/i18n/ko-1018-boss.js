// v10.18 (partie 4, boss) : coréen des nouveaux textes — 2e ligne de la barre du boss sur téléphone
// (« 2,4×10¹⁰³ PV · Rage dans 12 s »). Branché à la fin de ./ko.js, sans écraser l'existant.
export const EXACT_1018_BOSS = {};
export const patterns1018Boss = () => [
  [/^(\S+) PV · Rage dans (\d+) s$/, (m) => `HP ${m[1]} · ${m[2]}초 후 분노`],
  [/^(\S+) PV · EN RAGE$/, (m) => `HP ${m[1]} · 분노`],
  [/^(\S+) PV$/, (m) => `HP ${m[1]}`],
];
