// v9.2.8 : coréen des nouveautés de la 9.2.8. Branché à la fin de ./ko.js.
// Défense et fiche de stats : Défense, Double attaque, Puissance de combat (PC), coups encaissés, onglets des catégories.
export const EXACT_928 = {
  'Défense': '방어',
  '+10 points de Défense par niveau : réduit les dégâts subis (rendement décroissant, 60 % au plus)': '레벨당 방어 +10: 받는 피해 감소 (수확 체감, 최대 60%)',
  'Double attaque': '연속 공격',
  '+0,4 % de chance de frapper deux fois par niveau (20 % au niveau 50)': '레벨당 두 번 공격할 확률 +0.4% (50레벨에서 20%)',
  'Toutes': '전체',
  'Trier': '정렬',
  'Encaisse': '버티는 타격',
  'coups · boss': '회 · 보스',
  'PC': '전투력',
  'Puissance de combat : moyenne des dégâts/s et des PV effectifs': '전투력: 초당 피해와 유효 HP의 평균',
  'Attaque': '공격',
  'Vitesse': '속도',
  'Chance de critique': '치명타 확률',
  'Santé': '체력',
  'Coups encaissés (ennemi · boss)': '버티는 타격 (적 · 보스)',
  'Or bonus': '추가 골드',
};
export const patterns928 = (lookup) => [
  [/^\+([\d\s,.]+) % PV effectifs$/, (m) => `유효 HP +${m[1].replace(',', '.')}%`],
  [/^PV ([^·]+) · coup ordinaire ([^·]+) · coup du boss (.+)$/, (m) => `HP ${m[1].replace(',', '.')} · 일반 타격 ${m[2].replace(',', '.')} · 보스 타격 ${m[3].replace(',', '.')}`],
  [/^([\d\s,.]+) att\.\/s$/, (m) => `초당 ${m[1].replace(',', '.')}회`],
];
