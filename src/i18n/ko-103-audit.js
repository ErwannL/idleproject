// v10.3 (audit des parties 0 à 7 du plan 10.2) : coréen des textes ajoutés ou renommés par l'audit
// (« coffre » de rangement → « Réserve », onglet Arène, dos de carte doré). Branché à la fin de ./ko.js.
let LK = () => null;
const tr = (s) => LK(s) ?? s;
const GUIDE_BAG_FR = 'Les objets grandissent avec leur niveau : « Trouver mieux » cherche un meilleur objet dans le sac, sinon à la Forge. La Forge s\'ouvre à l\'étape 10 et la Réserve à l\'étape 20 : elle garde des objets jamais recyclés et les meilleures pièces d\'ensemble (filtre Ensemble, « Porter ») ; les Builds enregistrent équipe, équipement, classe, pouvoirs et compétences. Recyclage et fusion automatiques : Réglages du sac.';
const GUIDE_FINDS_FR = 'Les trouvailles (coffres, gemmes, portails) arrivent pendant le combat. Sac plein : les objets vont à la Réserve ; sac et Réserve pleins : les récompenses avec un objet attendent ici. Les marchands sont dans Missions › Aujourd\'hui.';
export const EXACT_103A = {
  "Équipe la meilleure pièce de chaque emplacement ; l'objet porté prend sa place dans la Réserve": "각 부위의 가장 좋은 아이템을 장착해요. 착용 중이던 아이템은 보관함으로 가요",
  "Une pièce d'ensemble ramassée, meilleure que la meilleure de la Réserve pour son emplacement, y va (l'ancienne est recyclée, sauf verrouillée)": "주운 세트 아이템이 보관함의 같은 부위 최고 아이템보다 좋으면 보관함으로 가요 (이전 아이템은 잠금이 아니면 분해돼요)",
  "Expose les objets ancestraux du sac et de la Réserve (pas ceux que porte le héros)": "가방과 보관함의 유물 아이템을 전시해요 (착용 중인 것은 제외)",
  "Exposer tout (sac + Réserve)": "모두 전시 (가방 + 보관함)",
  'Arène : un étage à franchir (gemmes et étoiles)': '아레나: 층 하나 돌파하기 (보석과 별)',
  'Tes compagnons deviennent des cartes : place-les et affronte les étages.': '동료들이 카드가 돼요: 배치하고 층에 도전하세요.',
  'Des gemmes, des éclats et des grimoires à chaque étage franchi.': '층을 돌파할 때마다 보석, 파편, 마법서를 얻어요.',
  'Le Défi de la semaine, puis la Tour : des combats à règles spéciales.': '주간 도전, 그다음 탑: 특별한 규칙의 전투예요.',
  'Des récompenses à chaque palier franchi.': '단계를 넘을 때마다 보상을 받아요.',
  'Défis du jour et de la semaine : la Tour et le Défi.': '일일·주간 도전: 탑과 도전.',
  'Dos de carte doré gagné !': '황금 카드 뒷면 획득!',
  'Dos de carte doré': '황금 카드 뒷면',
  'Ta formation le porte dès le prochain combat.': '다음 전투부터 진형의 카드에 적용돼요.',
  'Gagné en battant le gardien de l\'étage 25': '25층 수호자를 쓰러뜨려 획득',
  '✔ Gardien vaincu : ta formation porte le': '✔ 수호자 격파: 진형의 카드에 적용됨 —',
  'Frénésie': '광란',
  'Rangé dans la Réserve': '보관함에 넣었어요',
  'Réserve, Renaissance, Hauts faits…': '보관함, 환생, 업적…',
  'Sac et Réserve pleins': '가방과 보관함이 가득 참',
  'Sac et Réserve pleins.': '가방과 보관함이 가득 찼어요.',
  'Sac et Réserve pleins : recycle un objet pour acheter.': '가방과 보관함이 가득 찼어요: 구매하려면 아이템을 분해하세요.',
  'Sac et Réserve pleins : les récompenses avec un objet attendent ici. Recycle des objets.': '가방과 보관함이 가득 찼어요: 아이템이 든 보상은 여기서 기다려요. 아이템을 분해하세요.',
  'Sac et Réserve pleins : libère de la place pour récupérer les objets.': '가방과 보관함이 가득 찼어요: 아이템을 받으려면 자리를 비우세요.',
  'Objet en attente (sac et Réserve pleins)': '대기 중인 아이템 (가방·보관함 가득)',
  'Impossible : pas un objet ancestral, ou sac et Réserve pleins.': '불가: 유물 아이템이 아니거나 가방과 보관함이 가득 찼어요.',
  [GUIDE_BAG_FR]: '아이템은 레벨과 함께 성장해요: «더 좋은 것 찾기»는 가방에서, 없으면 대장간에서 더 좋은 아이템을 찾아요. 대장간은 10스테이지, 보관함은 20스테이지에 열려요: 보관함은 절대 분해되지 않는 아이템과 가장 좋은 세트 부위를 보관해요(세트 필터, 「착용」). 빌드는 팀, 장비, 직업, 권능, 스킬을 저장해요. 자동 분해와 합성: 가방 설정.',
  [GUIDE_FINDS_FR]: '발견물(상자, 보석, 포털)은 전투 중에 나타나요. 가방이 가득 차면 아이템은 보관함으로 가요. 가방과 보관함이 모두 가득 차면 아이템이 든 보상은 여기서 기다려요. 상인은 임무 › 오늘에 있어요.',
};
// Placés AVANT les autres motifs (voir ./ko.js) : « Tri : … » et « … en attente … » existent déjà avec l'ancien mot.
export const patterns103a = (lookup = () => null) => { LK = lookup; return [
  [/^Tri : (.+)$/, (m) => `정리: ${m[1].replace(/(\d+) au sac/g, '가방 $1개').replace(/(\d+) en Réserve/g, '보관함 $1개').replace(/(\d+) au coffre/g, '보관함 $1개').replace(/(\d+) en attente/g, '대기 $1개').replace(/(\d+) recyclés? \(\+(.+) or\)/g, '분해 $1개 (골드 +$2)')}`],
  [/^(\d+) en Réserve$/, (m) => `보관함 ${m[1]}개`],
  [/^(\d+) en attente : sac et Réserve pleins$/, (m) => `${m[1]}개 대기 중: 가방과 보관함이 가득 참`],
  [/^(.+) \((\d+) en attente : sac et Réserve pleins\)$/, (m) => `${tr(m[1])} (${m[2]}개 대기: 가방·보관함 가득)`],
  [/^(.+) rangé dans la Réserve \(ensemble « (.+) »\)$/, (m) => `${m[1]} 보관함에 보관 (세트 「${tr(m[2])}」)`],
  [/^(\d+) récompenses? avec un objet en attente \(sac et Réserve pleins\) : Objectifs › À récupérer\.$/, (m) => `아이템이 대기 중인 보상 ${m[1]}개 (가방·보관함 가득): 목표 › 받을 보상.`],
  [/^S'ouvre à l'étape (.+), avec un compagnon$/, (m) => `${m[1]} 스테이지에 열려요 (동료 1명 필요)`],
]; };
