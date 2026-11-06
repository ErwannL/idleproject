// v9.2.7 : coréen de l'arbre de talents refait (états, barre de sélection, légende, aide, zoom).
// Branché à la fin de ./ko.js comme ./ko-926.js.
export const EXACT_927 = {
  'Achetable': '구매 가능',
  'Appris': '습득',
  'Maximum': '최대',
  'Fragments insuffisants': '파편 부족',
  'Donne :': '효과:',
  'Débloque ensuite :': '다음 해금:',
  "Apprenez d'abord un talent relié.": '먼저 연결된 특성을 배우세요.',
  'Zoomer': '확대',
  'Dézoomer': '축소',
  'Recentrer sur le talent choisi': '선택한 특성으로 이동',
  "Touchez un talent pour voir ce qu'il donne, puis « Apprendre » juste sous l'arbre.": '특성을 눌러 효과를 확인하고, 트리 바로 아래의 「배우기」를 누르세요.',
  "Un talent s'achète dès qu'un talent relié est appris ; les nœuds en pointillés sont ceux qu'il débloque ensuite.": '연결된 특성을 배우면 구매할 수 있습니다. 점선 노드는 다음에 해금되는 특성입니다.',
  'Chaque couleur est une région ; les clés de voûte (hexagones) demandent des points dans leur région.': '색마다 하나의 지역입니다. 쐐기돌(육각형)은 해당 지역에 포인트가 필요합니다.',
  'Glissez pour vous déplacer, molette ou pincement pour zoomer, ◎ pour recentrer.': '드래그로 이동, 휠이나 핀치로 확대, ◎로 중앙 정렬.',
};
export const patterns927 = (lookup) => [
  [/^Il faut (\d+) points dans (.+) \(actuellement (\d+)\)\.$/, (m) => `${lookup(m[2]) ?? m[2]}에 ${m[1]}포인트 필요 (현재 ${m[3]}).`],
];
