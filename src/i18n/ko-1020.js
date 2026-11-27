// v10.20 (parties 1 à 3) : coréen des nouveaux textes PC — Équipement (rangée de boutons du personnage) et Améliorations
// (infobulle des lignes de 44 px, carte « Meilleur achat »). Branché à la fin de ./ko.js, sans écraser l'existant.
const num = (s) => String(s).replace(/(\d),(\d)/g, '$1.$2');

export const EXACT_1020 = {
  'Équipement rapide ✓': '빠른 장착 ✓',
  'Toute l\'équipe': '팀 전체',
  'Toute l\'équipe ✓': '팀 전체 ✓',
  'Équipement rapide · toute l\'équipe': '빠른 장착 · 팀 전체',
  'Aucun point à répartir': '분배할 포인트 없음',
  'Garde au moins une attaque sur la barre': '바에 공격을 하나 이상 남겨 두세요',
  'Peu utile : moins de 0,5 % de puissance, pas dans « Tout acheter »': '효과 적음: 전투력 0.5% 미만, « 모두 구매 »에서 제외',
};

export const patterns1020 = (lookup) => [
  [/^\+(\d+) niv\., (.+)$/, (m) => `+${m[1]}레벨, ${lookup(m[2]) ?? m[2]}`],
  [/^×(\S+) de puissance$/, (m) => `전투력 ×${num(m[1])}`],
  [/^\+(\S+) % DPS$/, (m) => `DPS +${num(m[1])}%`],
  [/^Palier atteint : ×(\S+)$/, (m) => `단계 달성: ×${num(m[1])}`],
  [/^Prochain palier : ×(\S+) au niveau (\d+)$/, (m) => `다음 단계: ${m[2]}레벨에 ×${num(m[1])}`],
  [/^Contre (.+)$/, (m) => `${lookup(m[1]) ?? m[1]} 대응`],
  [/^Il manque (.+?) or$/, (m) => `골드 ${num(m[1])} 부족`],
  [/^(.+) pour (.+?) or : le meilleur rapport$/, (m) => `${lookup(m[1]) ?? m[1]}, 골드 ${num(m[2])}: 최고의 효율`],
];
