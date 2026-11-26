// Transcendance (v8.8) : troisième couche de progression, au-dessus de la Renaissance.
// Elle remet à zéro les Renaissances (en en gardant une partie), l'arbre de talents et les fragments, et donne
// des Étoiles qui achètent des bonus qui changent les règles (ennemis qui grandissent moins vite, Renaissance
// plus forte…). Elle s'ouvre après le monde 11 en difficulté ×3.

import { formatMult } from '../core/format.js';

export const TRANSCEND = {
  minStage: 691, // étape 690 = dernier méga boss du Trône de l'Abysse en difficulté ×3 (v9.2.0, monde marin : 631 avant, cycle de 230 étapes)
  starsScale: 2, // Étoiles = floor(2 × (niveau de l'étape max / 210)^1,3) — v9.2.0 (monde marin) : 210 niveaux par cycle
  starsDivisor: 210,
  starsExponent: 1.3,
  keepRebirthsPct: 25, // part des Renaissances conservée (multiplicateur ×1,5 chacune), +5 % par niveau d'« Héritage stellaire »
  powerPerTranscend: 2, // dégâts, PV et or ×2 pour toujours par Transcendance
};

export const TRANSCEND_RESETS = [
  'Tout ce que réinitialise la Renaissance (étapes, or, améliorations, niveaux…)',
  'Renaissances (une partie est conservée)', 'Arbre de talents', 'Fragments anciens',
];
export const TRANSCEND_KEEPS = [
  'Équipement, sac, matériaux et ensembles', 'Compagnons, familiers et expéditions', 'Gemmes et clés',
  'Bonus éternels, hauts faits, records', 'Étoiles et bonus stellaires',
];

// Bonus stellaires (achetés avec les Étoiles). Coût du niveau n = base + step × n.
export const TRANSCEND_PERKS = [
  { id: 'stellar', name: 'Puissance stellaire', icon: 'icon_stars', max: 100, base: 1, step: 0.34, text: (lv) => `Dégâts, PV et or ×${fmt(1.5 ** lv)}` },
  { id: 'scaling', name: 'Entropie', icon: 'icon_skull', max: 10, base: 5, step: 3, text: (lv) => `Les ennemis grandissent ${lv * 2} % moins vite par étape` },
  { id: 'rebirth', name: 'Renaissance sublimée', icon: 'icon_rebirth', max: 10, base: 3, step: 2, text: (lv) => `Chaque Renaissance multiplie par ${fmt(1.5 + 0.05 * lv)} au lieu de 1,5` },
  { id: 'memory', name: 'Mémoire du guerrier', icon: 'icon_upgrade', max: 10, base: 2, step: 1, text: (lv) => `Après une Renaissance, ${lv * 5} % des niveaux d'amélioration sont conservés` },
  { id: 'fragments', name: 'Moisson ancienne', icon: 'icon_fragment', max: 10, base: 1, step: 1, text: (lv) => `+${lv * 50} % de fragments anciens` },
  { id: 'heritage', name: 'Héritage stellaire', icon: 'icon_trophy', max: 10, base: 4, step: 2, text: (lv) => `${TRANSCEND.keepRebirthsPct + lv * 5} % des Renaissances conservées à la Transcendance` },
];

// v10.16 (B4) : le format commun des nombres (plus de « 1,2e8 » à part).
const fmt = (n) => formatMult(n);
