// v10.17 (parties C, D, E « tout le jeu propre et homogène ») : coréen des nouveaux textes — points de compétence à dépenser,
// « Où en trouver » des fragments, Boutique (achats bientôt disponibles), notification du Bastion. Branché à la fin de ./ko.js,
// sans écraser l'existant.
export const EXACT_1017_UI = {
  // E : Compétences
  'points à dépenser': '포인트 사용 가능',
  'point à dépenser': '포인트 사용 가능',
  '(+1 par niveau du héros)': '(영웅 레벨당 +1)',
  'Points :': '포인트:',
  '0 point de compétence': '스킬 포인트 0',
  // D : Boutique
  '🔒 Achats bientôt disponibles': '🔒 구매 기능 준비 중',
  "Aucun paiement n'est encore possible : les prix sont affichés pour information. Tout le reste du jeu fonctionne.":
    '아직 결제할 수 없어요. 가격은 참고용으로 표시돼요. 게임의 나머지 기능은 모두 정상이에요.',
  // E : Bastion
  'Ton Bastion se met au travail': '요새가 일을 시작해',
  'Fermer': '닫기',
};

export const patterns1017Ui = () => [
  [/^(\d+) points? de compétence à dépenser$/, (m) => `사용할 스킬 포인트 ${m[1]}`],
  [/^Il manque (\S+) fragments?$/, (m) => `조각 ${m[1]}개 부족`],
];
