// v9.2.5 : 한국어 — 소환 쇼케이스와 「모두 받기」 출처 표시(섹션, 배지).
// Branché à la fin de ./ko.js comme ./ko-923.js.
export const EXACT_925 = {
  "Missions › Aujourd'hui › Connexion": '미션 › 오늘 › 출석',
  "Missions › Aujourd'hui › Journalières": '미션 › 오늘 › 일일',
  "Missions › Aujourd'hui › Contrats": '미션 › 오늘 › 계약',
  "Missions › Aujourd'hui › Prime du jour": '미션 › 오늘 › 오늘의 현상금',
  "Missions › Aujourd'hui › Trouvailles": '미션 › 오늘 › 발견물',
  'Missions › Piste du mois': '미션 › 이달의 트랙',
  'Missions › Hauts faits': '미션 › 업적',
  'Sera récupéré :': '받게 될 보상:',
  'Voir ce qui sera récupéré': '받게 될 보상 보기',
  'Trouvailles': '발견물',
  '+ un objet': '+ 아이템 1개',
  '✦ En vedette · taux augmenté ✦': '✦ 픽업 · 확률 업 ✦',
  'obtenu': '보유',
};
export const patterns925 = () => [
  [/^Sera récupéré \((\d+)\)$/, (m) => `받게 될 보상 (${m[1]})`],
  [/^(\d+) à récupérer$/, (m) => `받을 보상 ${m[1]}개`],
  [/^Récupérer \+(\d+)$/, (m) => `받기 +${m[1]}`],
  [/^Légendaire garanti dans (\d+)$/, (m) => `${m[1]}회 안에 전설 확정`],
  [/^Épique dans (\d+)$/, (m) => `${m[1]}회 안에 영웅`],
  [/^par tirage \(×([\d.,]+)\) · (\d+) % des Légendaires$/, (m) => `1회당 (×${m[1]}) · 전설의 ${m[2]}%`],
];
