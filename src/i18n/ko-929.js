// v9.2.9 : coréen des nouveautés de la 9.2.9. Branché à la fin de ./ko.js.
// Boutique dans la barre du haut ; World Boss en vrai combat animé (phases, barre, bilan).
export const EXACT_929 = {
  'Dégâts infligés': '입힌 피해',
  'PV du boss': '보스 HP',
  'Phase': '페이즈',
  'Éveil': '각성',
  'Passer ⏭': '건너뛰기 ⏭',
  'Nouveau record !': '신기록!',
  'Meilleur score': '최고 점수',
  'Dégâts du jour': '오늘의 피해',
  'Tentative terminée': '도전 종료',
  'Dégâts de la tentative': '이번 도전 피해',
  'Paliers de récompense': '보상 단계',
  "Plus de tentative aujourd'hui.": '오늘은 남은 도전이 없습니다.',
  'Le boss se relève !': '보스가 다시 일어납니다!',
  'Roi démoniaque ancestral': '태고의 마왕',
  'Séisme infernal': '지옥의 지진',
  'Pluie de braises': '불씨의 비',
  'Fureur ancestrale': '태고의 분노',
  'World Boss coopératif (dégâts de tous les joueurs, classement) : prochainement.': '협동 월드 보스 (모든 플레이어의 피해, 순위): 곧 공개.',
};
export const patterns929 = () => [
  [/^Combat de (\d+) s avec toute l'équipe\. Phases à 75, 50 et 25 % des PV\.$/, (m) => `팀 전체와 함께하는 ${m[1]}초 전투. HP 75, 50, 25%에서 페이즈 전환.`],
  [/^World Boss : (.+) dégâts$/, (m) => `월드 보스: 피해 ${m[1].replace(',', '.')}`],
];
