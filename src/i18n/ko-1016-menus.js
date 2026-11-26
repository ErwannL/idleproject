// v10.16 (partie B « Menus et ergonomie ») : coréen des nouveaux textes — onglet « Plus », écran Objectifs, format des grands
// nombres, raison des boutons grisés, Classement et Guilde sans compte. Branché à la fin de ./ko.js, sans écraser l'existant.
export const EXACT_1016_MENUS = {
  // B1, B2 : navigation et Objectifs
  'Plus': '더보기',
  'Objectifs': '목표',
  'Maintenant': '지금',
  "Aujourd'hui": '오늘',
  'Plus tard': '나중에',
  "Maintenant, aujourd'hui, plus tard : tout ce qui t'attend, au même endroit.": '지금, 오늘, 나중에: 기다리는 모든 것을 한곳에서.',
  'Avance sur la Carte : bats le prochain boss.': '지도에서 전진하세요: 다음 보스를 쓰러뜨리세요.',
  'Voir': '보기',
  'Cosmétiques : aucun bonus de puissance, achetés une fois pour toutes, équipables et retirables dans Plus › Apparences et Paramètres › Thème.':
    '외형: 전투력 보너스 없음, 한 번 구매로 영구 소장, 더보기 › 외형 및 설정 › 테마에서 장착·해제할 수 있습니다.',
  // B4 : grands nombres
  'Grands nombres': '큰 숫자',
  'Lettres puis ×10ⁿ': '문자 후 ×10ⁿ',
  'Tout en lettres': '모두 문자',
  'Tout en ×10ⁿ': '모두 ×10ⁿ',
  '1,2 Qi, puis 5,4×10⁸⁹ au-delà de 10³³': '1.2 Qi, 10³³ 이후는 5.4×10⁸⁹',
  '1,2 Qi, puis aa, ab… après Dc (10³³)': '1.2 Qi, Dc(10³³) 이후는 aa, ab…',
  '1,2×10¹⁸, 5,4×10⁸⁹': '1.2×10¹⁸, 5.4×10⁸⁹',
  // B5 : boutons grisés
  'Où en trouver ›': '얻는 곳 ›',
  "Sac plein : recycle d'abord": '가방이 가득 참: 먼저 분해하세요',
  'Rien à recycler': '분해할 것이 없습니다',
  'Rien à recycler : tes objets sont protégés ou utiles': '분해할 것이 없습니다: 아이템이 보호되었거나 유용합니다',
  // B6 : Classement et Guilde sans compte
  'Le classement des joueurs': '플레이어 순위',
  'Compare ton record à celui de tous les joueurs.': '모든 플레이어와 기록을 비교하세요.',
  'Vois ton rang, monde par monde.': '월드별 순위를 확인하세요.',
  'Ajoute des amis et suis leurs progrès.': '친구를 추가하고 진행 상황을 확인하세요.',
  'Rejoins une guilde': '길드에 가입하세요',
  'Des bonus pour toute la guilde.': '길드 전체를 위한 보너스.',
  'Un boss commun à battre ensemble.': '함께 쓰러뜨릴 공동 보스.',
  'Une bannière et une salle commune.': '깃발과 공동 홀.',
  'Impossible de charger.': '불러올 수 없습니다.',
  'Réessayer': '다시 시도',
  'Achats pas encore ouverts': '아직 구매할 수 없습니다',
  "Pas assez pour l'acheter": '구매하기에 부족합니다',
  "Rien à récupérer pour l'instant": '아직 받을 것이 없습니다',
  "Pas assez de points pour l'instant": '아직 포인트가 부족합니다',
  "Pas disponible pour l'instant": '아직 사용할 수 없습니다',
};
const UNIT = { tickets: '티켓', ticket: '티켓', gemmes: '보석', gemme: '보석', 'éclats': '파편', 'éclat': '파편', "pièces d'or": '골드', "pièce d'or": '골드' };
const d = (s) => String(s).replace(/(\d),(\d)/g, '$1.$2');
export const patterns1016Menus = () => [
  [/^Il te manque (\S+(?: \S+)?) (tickets?|gemmes?|éclats?|pièces? d'or)( pour ×(\d+))?$/, (m) => `${m[3] ? `×${m[4]}에 ` : ''}${UNIT[m[2]]} ${d(m[1])}개가 부족합니다`],
  [/^Tout récupérer \((\d+)\)$/, (m) => `모두 받기 (${m[1]})`],
  [/^Coffre du jour : encore (\d+) tâches?$/, (m) => `오늘의 상자: 할 일 ${m[1]}개 남음`],
  [/^Chemin du héros · Ch\. (\d+)$/, (m) => `영웅의 길 · ${m[1]}장`],
  [/^Tu joues en invité \((.*)\)\.$/, (m) => `게스트로 플레이 중입니다 (${m[1]}).`],
];
