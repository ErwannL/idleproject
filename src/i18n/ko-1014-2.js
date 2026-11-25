// v10.14.2 : 한국어 — 휴대폰 화면의 새 문구(일지 알약, 분해, 빈 상인, 길드, 소환 확률·천장, 강화, 고급 트리). ./ko.js 끝에 연결(기존 번역은 덮어쓰지 않음).
export const EXACT_1014_2 = {
  'Coffre à ouvrir': '열 상자 있음',
  'Ça dort': '잠자는 항목',
  'Rien à recycler : tes objets sont protégés ou utiles.': '분해할 것이 없어요: 아이템이 보호 중이거나 쓸모가 있어요.',
  'Filtrer par rareté': '등급으로 거르기',
  "Les objets cochés deviennent des éclats et de l'or.": '체크한 아이템은 조각과 골드로 바뀌어요.',
  'Aucun objet de cette rareté.': '이 등급의 아이템이 없어요.',
  'Ce que ça rapporte': '얻는 것',
  'Un boss, toute la guilde': '보스 하나, 길드 전체',
  "Plus de dégâts et d'or": '더 많은 피해와 골드',
  'Grimpe avec tes amis': '친구들과 함께 올라가요',
  "Connexion au serveur impossible pour le moment : voici ce qui t'attend.": '지금은 서버에 연결할 수 없어요. 앞으로 이런 것들이 기다려요.',
  'Aucun marchand de passage pour le moment': '지금은 지나가는 상인이 없어요',
  'Le chariot dort au loin': '수레가 멀리서 잠들어 있어요',
  'Les marchands passent au hasard pendant tes combats. Continue de vaincre des ennemis : le prochain arrive bientôt.': '상인은 전투 중에 무작위로 지나가요. 계속 적을 물리치세요. 다음 상인이 곧 와요.',
  'Taux': '확률',
  'Outils et réinitialisation': '도구 및 초기화',
  'Il manque': '부족:',
  'tirage': '회',
  'tirages': '회',
  'Commun': '일반',
  'Épique': '영웅',
};
const LOG_END = { 'coffre du jour ouvert ✓': '오늘의 상자 열었어요 ✓', 'ouvre le coffre du jour ›': '오늘의 상자 열기 ›' };
const RAR = { Tout: '전체', Commun: '일반', Rare: '희귀', 'Épique': '영웅' };
export const patterns1014_2 = () => [
  [/^Carnet (\d+)\/(\d+)( ✓)?$/, (m) => `일지 ${m[1]}/${m[2]}${m[3] ?? ''}`],
  [/^Carnet (\d+)\/(\d+) · (coffre du jour ouvert ✓|ouvre le coffre du jour ›)$/, (m) => `일지 ${m[1]}/${m[2]} · ${LOG_END[m[3]]}`],
  [/^(Tout|Commun|Rare|Épique) (\d+)$/, (m) => `${RAR[m[1]]} ${m[2]}`],
  [/^\+(\d+) autres?$/, (m) => `+${m[1]}개 더`],
  [/^Légendaire garanti dans (\d+) tirages?$/, (m) => `${m[1]}회 안에 전설 확정`],
];
