// v10.4 (partie 7, petits défauts) : coréen des libellés du Sceau remis en mots du joueur (Succès, Collection).
// Branché à la fin de ./ko.js, sans écraser l'existant.
let LK = () => null;
const t = (s) => LK(s) ?? s;
const KIND = { monstres: '몬스터', boss: '보스', 'équipements': '장비', 'compagnons et familiers': '동료와 펫' };
export const EXACT_1040_DEFAUTS = {};
export const patterns1040Defauts = (lookup = () => null) => { LK = lookup; return [
  [/^Succès débloqué : (.+)$/, (m) => `업적 달성: ${t(m[1])}`],
  [/^Collection remplie à (\d+) %$/, (m) => `컬렉션 ${m[1]}% 달성`],
  [/^(\d+) (monstres|boss|équipements|compagnons et familiers) découverts$/, (m) => `${KIND[m[2]]} ${m[1]}개 발견`],
  [/^Piste du mois : (\d+) %$/, (m) => `이달의 트랙: ${m[1]}%`],
]; };
