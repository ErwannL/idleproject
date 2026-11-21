// v10.4 (partie 7, petits défauts) : anglais des libellés du Sceau remis en mots du joueur (Succès, Collection).
// Branché à la fin de ./en.js, sans écraser l'existant.
let LK = () => null;
const t = (s) => LK(s) ?? s;
const KIND = { monstres: 'monsters', boss: 'bosses', 'équipements': 'items', 'compagnons et familiers': 'companions and pets' };
export const EXACT_1040_DEFAUTS = {};
export const patterns1040Defauts = (lookup = () => null) => { LK = lookup; return [
  [/^Succès débloqué : (.+)$/, (m) => `Achievement unlocked: ${t(m[1])}`],
  [/^Collection remplie à (\d+) %$/, 'Collection $1 % complete'],
  [/^(\d+) (monstres|boss|équipements|compagnons et familiers) découverts$/, (m) => `${m[1]} ${KIND[m[2]]} discovered`],
  [/^Piste du mois : (\d+) %$/, 'Monthly track: $1 %'],
]; };
