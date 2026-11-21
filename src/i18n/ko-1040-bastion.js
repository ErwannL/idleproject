// v10.4 (partie 6) : coréen des nouveaux textes du Bastion (page plein écran, démarrage, tour, « Pendant ton absence »).
// Branché à la fin de ./ko.js (noms d'import uniques : EXACT_1040_BASTION, patterns1040Bastion).
let LK = () => null;
const L = (s) => LK(s) ?? s;
const TRADE = { forgeron: '대장장이', forgeronne: '대장장이', savant: '학자', savante: '학자', mineur: '광부', mineuse: '광부', 'entraîneur': '교관', 'entraîneuse': '교관', marchand: '상인', marchande: '상인', ouvrier: '일꾼' };

const RES = { 'éclat': '파편', 'éclats': '파편', grimoire: '마법서', grimoires: '마법서', pierre: '돌', pierres: '돌', essence: '정수', essences: '정수' };

export const EXACT_1040_BASTION = {
  'Carte': '지도',
  'Commandes': '주문',
  'Commander': '주문하기',
  'Lancer': '시작',
  'Améliorer': '강화',
  'Construire': '건설',
  'Compris': '알겠어',
  'Prête': '준비 완료',
  'Dans le coffre de butin': '전리품 상자 안',
  'Livré dans le coffre de butin': '전리품 상자로 배달됨',
  'Pendant ton absence': '자리를 비운 동안',
  'Tout récupérer': '모두 받기',
  'Ton Bastion se met au travail': '요새가 일을 시작해',
  'Gardées après les Renaissances.': '환생 후에도 유지돼.',
  'Aucun ouvrier : à l\'arrêt': '일꾼 없음: 멈춤',
  'Aucun compagnon libre': '쉬는 동료 없음',
  'Construis la Bibliothèque': '도서관을 지어',
  'Ouvriers posés / places': '배치한 일꾼 / 자리',
  'Niveau du Bastion : somme des niveaux': '요새 레벨: 건물 레벨의 합',
  'Retour au combat': '전투로 돌아가기',
  'Le Bastion ouvre ses portes : Équipe › Bastion': '요새가 문을 엽니다: 팀 › 요새',
  'Tes compagnons libres construisent et cherchent pour toi, même jeu fermé.': '쉬는 동료들이 게임을 꺼도 대신 짓고 연구해.',
  '5 compagnons': '동료 5명',
};

export const patterns1040Bastion = (lookup = () => null) => { LK = lookup; return [
  [/^(\d+) compagnons? libres?$/, (m) => `쉬는 동료 ${m[1]}명`],
  [/^(\d+) (éclats?|grimoires?|pierres?|essences?) → (\d+) (éclats?|grimoires?|pierres?|essences?) \(tu as (.+)\)$/, (m) => `${RES[m[2]]} ${m[1]} → ${RES[m[4]]} ${m[3]} (보유: ${m[5]})`],
  [/^(.+), (forgeron(?:ne)?|savante?|mineur|mineuse|entraîneur|entraîneuse|marchande?|ouvrier) : \+(\d+) %$/, (m) => `${L(m[1])}, ${TRADE[m[2]]}: +${m[3]}%`],
  [/^Chantier offert : (.+), (.+)$/, (m) => `무료 공사: ${L(m[1])}, ${L(m[2])}`],
  [/^Après : (.+)$/, (m) => `${L(m[1])} 이후`],
  [/^Bastion niv\. (\d+)$/, (m) => `요새 Lv.${m[1]}`],
  [/^Chantier : niv\. (\d+) → (\d+)$/, (m) => `공사: Lv.${m[1]} → ${m[2]}`],
  [/^Niv\. (\d+) → (\d+)$/, (m) => `Lv.${m[1]} → ${m[2]}`],
  [/^Niv\. (\d+) ·$/, (m) => `Lv.${m[1]} ·`],
  [/^Places prises \((\d+)\)$/, (m) => `자리 꽉 참 (${m[1]})`],
  [/^Recherches (\d+)\/(\d+)$/, (m) => `연구 ${m[1]}/${m[2]}`],
  [/^Bastion : (\d+) à voir$/, (m) => `요새: 확인할 것 ${m[1]}개`],
  [/^(\d.*) · à l'arrêt$/, (m) => `${L(m[1])} · 멈춤`],
  [/^(\d.*) sans bonus$/, (m) => `보너스 없이 ${L(m[1])}`],
  [/^Métier conseillé : (.+) \(\+(\d+) %\)$/, (m) => `추천 직업: ${L(m[1])} (+${m[2]}%)`],
  [/^([\d,]+ (?:éclats|grimoires)) par heure$/, (m) => `시간당 ${L(m[1])}`],
  [/^([\d,]+ (?:éclats|grimoires)) par jour$/, (m) => `하루 ${L(m[1])}`],
  [/^([\d,]+) (éclats|grimoires)$/, (m) => `${m[2] === 'éclats' ? '파편' : '마법서'} ${m[1].replace(',', '.')}`],
  [/^(Forge du forgeron|Bibliothèque|Mine de cristal|Camp d'entraînement|Comptoir|Expéditions) : (.+)$/, (m) => `${L(m[1])}: ${L(m[2])}`],
]; };
