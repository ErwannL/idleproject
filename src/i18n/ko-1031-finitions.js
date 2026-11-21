// v10.3.1 : coréen des finitions (lexique du Bastion, ligne « maintenant » de la Forge qui nomme la statistique gagnée).
// Branché à la fin de ./ko.js, sans écraser l'existant.
let LK = () => null;
const d = (s) => String(s).replace(/(\d),(\d)/g, '$1.$2'); // virgule décimale → point
const t = (s) => LK(s) ?? s;
export const EXACT_1031 = {
  'Mots du Bastion :': '요새 용어:',
  'Chantier': '공사',
  'Recherche': '연구',
  'Ton camp de base, qui s\'ouvre à l\'étape 40 : des bâtiments où tes compagnons libres travaillent, même jeu fermé. Il t\'aide à avancer, il ne bloque jamais l\'histoire.':
    '40단계에 열리는 기지입니다. 팀에 없는 동료들이 게임을 꺼도 건물에서 일합니다. 진행을 돕기만 할 뿐 이야기를 막지는 않습니다.',
  'Un compagnon qui n\'est ni dans l\'équipe, ni en expédition. Pose-le sur un bâtiment : sans ouvrier, le bâtiment produit à 50 % et ne lance aucun chantier. Son métier lui donne +20 % dans le bon bâtiment.':
    '팀에도 원정에도 없는 동료입니다. 건물에 배치하세요. 일꾼이 없으면 건물은 50%만 생산하고 공사를 시작하지 못합니다. 직업에 맞는 건물에서는 +20%를 얻습니다.',
  'Les travaux qui font gagner un niveau à un bâtiment : de l\'or, des éclats et du temps (de 15 min à 8 h). Le chantier avance même jeu fermé.':
    '건물의 레벨을 올리는 공사입니다. 골드, 조각, 시간(15분~8시간)이 듭니다. 게임을 꺼도 공사는 계속됩니다.',
  'Une étude de la Bibliothèque : un petit bonus (dégâts, vie, or…) gagné avec le temps. Contrairement aux Talents, une recherche ne se perd pas à la Renaissance.':
    '도서관의 연구입니다. 시간이 지나면 작은 보너스(공격력, 체력, 골드 등)를 얻습니다. 재능과 달리 연구는 환생해도 사라지지 않습니다.',
};
const VAL = '(\\+?\\d[\\d,]*(?: [A-Za-z]{1,2})?(?: %| pts| % PV\\/s)?)';
export const patterns1031 = (lookup = () => null) => { LK = lookup; return [
  [new RegExp(`^(.+) \\+(\\d+) → \\+(\\d+) : (\\D+?) ${VAL} → ${VAL}$`), (m) => `${t(m[1])} +${m[2]} → +${m[3]}: ${t(m[4])} ${d(m[5])} → ${d(m[6])}`],
  [new RegExp(`^(\\D+?) ${VAL} → ${VAL}$`), (m) => (LK(m[1]) ? `${t(m[1])} ${d(m[2])} → ${d(m[3])}` : null)],
]; };
