// v10.18 (partie 4, boss) : anglais des nouveaux textes — 2e ligne de la barre du boss sur téléphone
// (« 2,4×10¹⁰³ PV · Rage dans 12 s »). Branché à la fin de ./en.js, sans écraser l'existant.
export const EXACT_1018_BOSS = {};
export const patterns1018Boss = () => [
  [/^(\S+) PV · Rage dans (\d+) s$/, (m) => `${m[1]} HP · Rage in ${m[2]} s`],
  [/^(\S+) PV · EN RAGE$/, (m) => `${m[1]} HP · ENRAGED`],
  [/^(\S+) PV$/, (m) => `${m[1]} HP`],
];
