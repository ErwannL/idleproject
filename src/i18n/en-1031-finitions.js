// v10.3.1 : anglais des finitions (lexique du Bastion, ligne « maintenant » de la Forge qui nomme la statistique gagnée).
// Branché à la fin de ./en.js, sans écraser l'existant.
let LK = () => null;
const d = (s) => String(s).replace(/(\d),(\d)/g, '$1.$2'); // virgule décimale → point
const t = (s) => LK(s) ?? s;
export const EXACT_1031 = {
  'Mots du Bastion :': 'Bastion words:',
  'Chantier': 'Build job',
  'Recherche': 'Research',
  'Ton camp de base, qui s\'ouvre à l\'étape 40 : des bâtiments où tes compagnons libres travaillent, même jeu fermé. Il t\'aide à avancer, il ne bloque jamais l\'histoire.':
    'Your home base, which opens at stage 40: buildings where your free companions work, even with the game closed. It helps you move forward and never blocks the story.',
  'Un compagnon qui n\'est ni dans l\'équipe, ni en expédition. Pose-le sur un bâtiment : sans ouvrier, le bâtiment produit à 50 % et ne lance aucun chantier. Son métier lui donne +20 % dans le bon bâtiment.':
    'A companion who is neither in the team nor on an expedition. Put them in a building: without a worker, the building produces at 50% and starts no build job. Their trade gives +20% in the right building.',
  'Les travaux qui font gagner un niveau à un bâtiment : de l\'or, des éclats et du temps (de 15 min à 8 h). Le chantier avance même jeu fermé.':
    'The work that levels a building up: gold, shards and time (15 min to 8 h). A build job keeps going even with the game closed.',
  'Une étude de la Bibliothèque : un petit bonus (dégâts, vie, or…) gagné avec le temps. Contrairement aux Talents, une recherche ne se perd pas à la Renaissance.':
    'A study at the Library: a small bonus (damage, health, gold…) earned over time. Unlike Talents, research is not lost on Rebirth.',
};
// Valeur écrite par l'écran : « 12,4 % », « 3 pts », « 1,2 % PV/s », « 340 », « 1,2 K ».
const VAL = '(\\+?\\d[\\d,]*(?: [A-Za-z]{1,2})?(?: %| pts| % PV\\/s)?)';
export const patterns1031 = (lookup = () => null) => { LK = lookup; return [
  // Ligne « maintenant » de la Forge : « Épée courte +7 → +8 : Coup critique 12,4 % → 13,6 % ».
  [new RegExp(`^(.+) \\+(\\d+) → \\+(\\d+) : (\\D+?) ${VAL} → ${VAL}$`), (m) => `${t(m[1])} +${m[2]} → +${m[3]}: ${t(m[4])} ${d(m[5])} → ${d(m[6])}`],
  // Même texte dans la liste de l'atelier : « Coup critique 12,4 % → 13,6 % ».
  [new RegExp(`^(\\D+?) ${VAL} → ${VAL}$`), (m) => (LK(m[1]) ? `${t(m[1])} ${d(m[2])} → ${d(m[3])}` : null)],
]; };
