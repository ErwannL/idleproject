// v10.20 (parties 1 à 3) : anglais des nouveaux textes PC — Équipement (rangée de boutons du personnage) et Améliorations
// (infobulle des lignes de 44 px, carte « Meilleur achat »). Branché à la fin de ./en.js, sans écraser l'existant.
const num = (s) => String(s).replace(/(\d),(\d)/g, '$1.$2');

export const EXACT_1020 = {
  'Équipement rapide ✓': 'Quick gear ✓',
  'Toute l\'équipe': 'Whole team',
  'Toute l\'équipe ✓': 'Whole team ✓',
  'Aucun point à répartir': 'No points to spend',
  'Garde au moins une attaque sur la barre': 'Keep at least one attack on the bar',
  'Peu utile : moins de 0,5 % de puissance, pas dans « Tout acheter »': 'Hardly useful: under 0.5% power, not in “Buy all”',
};

export const patterns1020 = (lookup) => [
  [/^\+(\d+) niv\., (.+)$/, (m) => `+${m[1]} lv., ${lookup(m[2]) ?? m[2]}`],
  [/^×(\S+) de puissance$/, (m) => `×${num(m[1])} power`],
  [/^\+(\S+) % DPS$/, (m) => `+${num(m[1])}% DPS`],
  [/^Palier atteint : ×(\S+)$/, (m) => `Milestone reached: ×${num(m[1])}`],
  [/^Prochain palier : ×(\S+) au niveau (\d+)$/, (m) => `Next milestone: ×${num(m[1])} at level ${m[2]}`],
  [/^Contre (.+)$/, (m) => `Counters ${lookup(m[1]) ?? m[1]}`],
  [/^Il manque (.+?) or$/, (m) => `${num(m[1])} gold missing`],
  [/^(.+) pour (.+?) or : le meilleur rapport$/, (m) => `${lookup(m[1]) ?? m[1]} for ${num(m[2])} gold: the best value`],
];
