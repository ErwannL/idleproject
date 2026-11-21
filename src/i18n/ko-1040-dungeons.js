// v10.4 (partie 4) : coréen de la liste en bannières et de la page du donjon. Branché à la fin de ./ko.js.
let LK = () => null;
const tr = (s) => LK(s) ?? s;
export const EXACT_1040_DUNGEONS = {
  'Tu gagnes': '획득 보상',
  'Ton équipe': '내 팀',
  'Les salles': '방',
  'Équipe : actuelle': '팀: 현재',
  'Équipes enregistrées': '저장된 팀',
  'Balayer': '소탕',
  '1 clé': '열쇠 1개',
  'Après Facile': '쉬움 이후',
  'Après Normal': '보통 이후',
  'Quitte la Tour d\'abord.': '먼저 탑에서 나가세요.',
  'Termine le Défi d\'abord.': '먼저 도전을 끝내세요.',
  'Aucune clé.': '열쇠가 없어요.',
  'Aide du donjon': '던전 도움말',
  'Gros coffre du premier passage': '첫 클리어 대형 상자',
  'Gros coffre du premier passage : déjà reçu': '첫 클리어 대형 상자: 이미 받음',
  'Combat franc : aucune mécanique spéciale': '정면 승부: 특별한 기믹 없음',
  'Invocatrice : 2 serviteurs toutes les 12 s · ton arme : dégâts de zone': '소환사: 12초마다 하수인 2명 · 내 무기: 범위 피해',
  'Carapace : −60 % de dégâts reçus · ton arme : vitesse d\'attaque': '껍질: 받는 피해 −60% · 내 무기: 공격 속도',
  'Fournaise : dégâts +6 % toutes les 3 s · ton atout : PV et vol de vie': '용광로: 3초마다 피해 +6% · 내 강점: HP와 생명력 흡수',
  'Désespoir : enragé sous 50 % de PV · ton atout : armure': '절망: HP 50% 미만에서 격노 · 내 강점: 방어구',
  'Un chemin par défaut « Normal » est choisi pour toi. Une porte s\'ouvre entre deux salles : combat, élite, trésor, autel ou repos.': '기본 경로 "보통"이 선택돼요. 방 사이에 문이 열려요: 전투, 정예, 보물, 제단, 휴식.',
};
export const patterns1040Dungeons = (lookup = () => null) => { LK = lookup; return [
  [/^Entrer · (Facile|Normal|Difficile)$/, (m) => `입장 · ${tr(m[1])}`],
  [/^×(\d+) (.+) ici$/, (m) => `×${m[1]} ${tr(m[2])} 여기서`],
  [/^Équipe : (.+)$/, (m) => `팀: ${tr(m[1])}`],
  [/^Balayer ×(\d+)$/, (m) => `소탕 ×${m[1]}`],
  [/^Balayer tout \((\d+)\)$/, (m) => `전체 소탕 (${m[1]})`],
  [/^Équipement Épique ou mieux(?: — ensemble (.+))?$/, (m) => `에픽 이상 장비${m[1] ? ` — ${tr(m[1])} 세트` : ''}`],
  [/^Danger ×(\d+)$/, (m) => `위험 ×${m[1]}`],
  [/^Équipe conseillée : (.+)$/, (m) => `추천 팀: ${m[1].split(', ').map(tr).join(', ')}`],
]; };
