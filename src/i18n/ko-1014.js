// v10.14.1 (lot 4) : 한국어 — 월간 축제: FEST_MONTHS의 제목·문구·재화·지역, 자동 제목, 축제 미션, 틈새의 축복, 축제 화면
// (fest-hub.js, fest-tabs.js), 이벤트 탭, main.js 메시지, 「?」 안내, 알림, 소환의 「이정표」 줄. ./ko.js 끝에 연결(기존 번역은 덮어쓰지 않음).
let LK = () => null;
const t = (s) => LK(s) ?? s;
const grp = (s) => String(s).replace(/ /g, ','); // 「6 000」 → 「6,000」
const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const d = (s) => String(s).replace(/(\d),(\d)/g, '$1.$2'); // 소수점 쉼표 → 점
// 축제 재화(data/fest.js): 문장은 재화 이름을 그대로 인용하므로 이 이름들만 번역한다.
export const FEST_CURRENCIES_KO = {
  'Cœurs de braise': '불씨 하트', 'Bourgeons': '새싹', "Plumes d'aube": '새벽 깃털', "Éclats d'éclipse": '월식 조각',
  'Flocons': '눈송이', 'Médailles': '메달', 'Pétales': '꽃잎', "Flèches d'or": '황금 화살', 'Cierges': '양초',
  'Shuriken': '수리검', 'Braises de lune': '달빛 불씨', 'Lauriers': '월계관', 'Insignes': '휘장', 'Jetons': '토큰',
};
const CUR = `(${[...Object.keys(FEST_CURRENCIES_KO), 'pièces'].map(esc).join('|')})`;
const N = '([+\\-−~]?\\d+(?:[,.]\\d+)?(?: (?:K|M|B|T|Qa|Qi))?)';
const G = '(\\d+(?: \\d{3})*)';
const cur = (s) => FEST_CURRENCIES_KO[s] ?? (s === 'pièces' ? '코인' : s);

export const EXACT_1014 = {
  // ---- 어휘
  ...FEST_CURRENCIES_KO,
  'Grande fête': '대축제', 'Petite fête': '소축제', 'Fête': '축제',
  'Brèche': '틈새', 'Sentier': '오솔길', 'Échange': '교환', 'échange': '교환',
  'Palier': '단계',
  // ---- FEST_MONTHS: 제목, 문구, 지역
  'Fête des Cœurs ardents': '타오르는 하트 축제',
  'La Reine démone ouvre son bal de braises.': '마녀 여왕이 불씨의 무도회를 열어요.',
  'Jardins rougeoyants': '붉게 빛나는 정원', 'Salle du bal': '무도회장', 'Trône des braises': '불씨의 왕좌',
  'Bal des Lames roses': '장미검 무도회',
  'Danse avec la Lame rose, adopte un Hérisson de cristal.': '장미검과 춤추고 수정 고슴도치를 입양하세요.',
  'Éveil du Printemps': '봄의 각성',
  'La Gardienne sylvestre réveille la forêt.': '숲의 수호자가 숲을 깨워요.',
  'Clairière': '숲속 빈터', 'Bois ancien': '고대의 숲', 'Cœur de la forêt': '숲의 심장',
  'Concours des Archers': '궁수 대회',
  "L'Archère elfe et la Fée des bois t'attendent.": '엘프 궁수와 숲의 요정이 기다려요.',
  'Aube dorée': '황금빛 새벽',
  "L'Archange descend des Îles célestes.": '대천사가 천공의 섬에서 내려와요.',
  'Escalier des nuages': '구름 계단', 'Temple du ciel': '하늘 신전', 'Porte du soleil': '태양의 문',
  'Pèlerinage de Lumière': '빛의 순례',
  'Le Grand prêtre et le Mini-golem font route avec toi.': '대사제와 미니 골렘이 함께 길을 떠나요.',
  'Nuit des Éclipses': '월식의 밤',
  "Le Seigneur de l'ombre déchire le ciel.": '그림자 군주가 하늘을 찢어요.',
  'Faille': '균열', "Citadelle d'ombre": '그림자 성채', 'Trône du Néant': '공허의 왕좌',
  'Nuit des Shinobis': '시노비의 밤',
  "Le Ninja et le Hibou érudit veillent dans l'ombre.": '닌자와 박식한 부엉이가 어둠 속에서 지켜봐요.',
  'Solstice de Givre': '서리 솔스티스',
  "L'Impératrice des glaces fige les marées.": '얼음 여제가 조류를 얼려요.',
  'Côte gelée': '얼어붙은 해안', 'Palais de glace': '얼음 궁전', 'Trône de givre': '서리 왕좌',
  'Sabbat de la Saint-Jean': '한여름 사바트',
  'La Sorcière allume les feux, le Hérisson de cristal revient.': '마녀가 모닥불을 지피고 수정 고슴도치가 돌아와요.',
  'Festival des Titans': '타이탄 축제',
  'La Reine démone revient affronter le Colosse.': '마녀 여왕이 거신과 맞서러 돌아와요.',
  "Arène d'été": '여름 투기장', 'Volcan': '화산', 'Sommet des Titans': '타이탄 정상',
  'Jeux des Champions': '챔피언 대회',
  'Le Barbare et la Fée des bois relèvent le défi.': '바바리안과 숲의 요정이 도전에 나서요.',
  // 자동 제목(2027년 7월 이후 순환)
  "Le héros du mois t'attend.": '이달의 영웅이 기다려요.',
  'Un héros et un familier gratuits à gagner.': '무료 영웅과 펫을 얻을 수 있어요.',
  'Avant-poste': '전초기지', 'Terres du héros': '영웅의 땅', 'Sanctuaire': '성소',
  'viens voir les nouveautés !': '새로운 소식을 보러 오세요!',
  // ---- 틈새의 축복
  '+35 % de dégâts, −5 s de combat': '피해 +35%, 전투 시간 −5초',
  'Sablier': '모래시계', '+6 s de combat': '전투 시간 +6초',
  'Bourse pleine': '두둑한 주머니', '+30 % de monnaie': '재화 +30%',
  'Second souffle': '재기의 숨결', '+1 cœur': '하트 +1',
  'Concentration': '집중', '+10 % de dégâts, +3 s': '피해 +10%, +3초',
  // ---- 축제 화면: 머리말, 탭, 「?」 안내
  'Comment ça marche ?': '어떻게 작동하나요?',
  'Rythme': '진행', 'Monnaie': '재화',
  'Combats fermés, boutique ouverte. Le reste devient des éclats.': '전투는 닫혔고 상점은 열려 있어요. 남은 재화는 파편으로 바뀌어요.',
  'Dernière chance': '마지막 기회',
  // ---- 모험
  'Carte terminée : bravo !': '지도 완료: 축하해요!',
  'Héros du mois': '이달의 영웅',
  "Mettre dans l'équipe ›": '팀에 넣기 ›',
  "avec le héros dans l'équipe": '영웅이 팀에 있을 때',
  '✓ Région libérée': '✓ 지역 해방',
  "Jalons d'invocation": '소환 이정표',
  'Jalons :': '이정표:',
  // ---- 월드 보스
  'World Boss de la fête': '축제 월드 보스',
  'Le World Boss est fermé pour cette fête.': '이번 축제의 월드 보스는 닫혀 있어요.',
  'Tentatives': '도전 횟수',
  'Bilan de la tentative': '도전 결과', 'Nouveau record': '신기록', 'Palier atteint': '도달한 층',
  'Titan verrouillé': '타이탄 잠김',
  "Fermé pendant l'échange.": '교환 기간에는 닫혀요.',
  'Gagné': '획득',
  // ---- 틈새
  'Brèche de la fête': '축제 틈새', 'Brèche terminée': '틈새 종료',
  'Prêt à entrer ?': '들어갈 준비됐나요?', "Plus d'entrée aujourd'hui": '오늘 입장권이 없어요',
  'Entrer (1 entrée)': '입장 (입장권 1개)', 'Encore une fois (1 entrée)': '한 번 더 (입장권 1개)',
  "Fermée pendant l'échange.": '교환 기간에는 닫혀요.',
  'Bénédictions prises': '받은 축복',
  'Première fois': '최초 클리어',
  'Victoire :': '승리:', 'gagné dans cette course': '이번 도전 획득', 'gagnés pendant la course': '도전 중 획득',
  'Quitter la Brèche ?': '틈새에서 나갈까요?',
  'Quitter​': '나가기', // 틈새 버튼: 「Quitter」만 쓰면 길드 탈퇴가 되어 버린다
  // ---- 미션
  "Les missions sont fermées pendant l'échange.": '교환 기간에는 미션이 닫혀요.',
  'elles changent à minuit': '자정에 바뀌어요',
  'Missions de la fête': '축제 미션',
  'Faite': '완료',
  // ---- 상점
  'Épuisé': '품절',
  'Ticket permanent': '상시 티켓', 'Fragment Légendaire': '전설 파편', "Pierres d'ascension": '승급석',
  "Universel : n'importe quel héros Légendaire": '범용: 모든 전설 영웅',
  'Familier gratuit de la fête': '축제 무료 펫', 'Héros gratuit de la fête': '축제 무료 영웅',
  'Limitée': '한정', 'Permanente': '상시',
  // ---- 오솔길
  'Héros gratuit': '무료 영웅', 'Familier gratuit': '무료 펫', 'Sentier ·': '오솔길 ·',
  // ---- 이벤트 탭
  'Entrer dans la fête': '축제 입장', 'Mode de la fête': '축제 모드', 'Du jour et de la fête': '일일 및 축제',
  'Héros et familier gratuits': '무료 영웅과 펫', 'Échange de fin de fête': '축제 종료 교환',
  // ---- main.js 메시지와 인터페이스
  'Gardien trop solide : renforce le héros': '수호자가 너무 강해요: 영웅을 강화하세요',
  'Brèche ouverte : palier 1': '틈새 열림: 1층',
  'Échange en cours : les combats sont fermés.': '교환 기간이에요: 전투는 닫혔어요.',
  'Récompense de la fête': '축제 보상', 'Récompenses de la fête': '축제 보상', 'Boutique de la fête': '축제 상점',
  'Classement de la fête': '축제 순위', 'Top 30 %': '상위 30%', 'Top 60 %': '상위 60%', 'Participant': '참가자',
  'La fête commence': '축제가 시작돼요', 'Entrées de Brèche pleines': '틈새 입장권이 가득 찼어요', 'Dernier jour': '마지막 날',
  "6/6 : entre dans la Brèche avant d'en perdre.": '6/6: 놓치기 전에 틈새에 들어가세요.',
  'demain, plus de combats. Récupère tes récompenses !': '내일부터 전투가 닫혀요. 보상을 받으세요!',
  'Légendaire garanti dans 100 invocations': '100회 소환 안에 전설 확정',
};

export const patterns1014 = (lookup = () => null) => { LK = lookup; return [
  // ---- 시간
  [/^(\d+) j (\d+) h$/, (m) => `${m[1]}일 ${m[2]}시간`],
  [/^(\d+) h (\d{2})$/, (m) => `${m[1]}시간 ${m[2]}분`],
  [/^encore (.+)$/, (m) => { const x = LK(m[1]); return x === null ? null : `${x} 남음`; }],
  [/^puis (\d+) jours d'échange$/, (m) => `이후 교환 ${m[1]}일`],
  [/^(Grande|Petite) fête · jour (\d+)\/(\d+)$/, (m) => `${m[1] === 'Grande' ? '대축제' : '소축제'} · ${m[2]}/${m[3]}일째`],
  [new RegExp(`^Dépense tes ${CUR} : encore (.+)$`), (m) => { const x = LK(m[2]); return x === null ? null : `${cur(m[1])} 사용하기: ${x} 남음`; }],
  [new RegExp(`^Dépense tes ${CUR} à la boutique : le reste deviendra des éclats\\.$`), (m) => `상점에서 ${cur(m[1])} 사용하기: 남은 재화는 파편으로 바뀌어요.`],
  [/^Missions du jour : elles changent à minuit$/, () => '일일 미션: 자정에 바뀌어요'],
  // ---- 자동 제목
  [/^Fête du héros : (.+)$/, (m) => { const x = LK(m[1]); return x === null ? null : `영웅 축제: ${x}`; }],
  [/^Foire : (.+)$/, (m) => { const x = LK(m[1]); return x === null ? null : `장터: ${x}`; }],
  [/^((?:Fête du héros|Foire) : .+?) : (.+)$/, (m) => { const a = LK(m[1]); const b = LK(m[2]); return a === null || b === null ? null : `${a}: ${b}`; }],
  [/^(.+?) : (demain, plus de combats\. Récupère tes récompenses !)$/, (m) => { const a = LK(m[1]); const b = LK(m[2]); return a === null || b === null ? null : `${a}: ${b}`; }],
  // ---- 축제 미션
  [new RegExp(`^Vaincre ${G} monstres$`), (m) => `몬스터 ${grp(m[1])}마리 처치`],
  [new RegExp(`^Vaincre ${G} boss$`), (m) => `보스 ${grp(m[1])}마리 처치`],
  [new RegExp(`^Terminer ${G} donjons$`), (m) => `던전 ${grp(m[1])}회 완료`],
  [new RegExp(`^Faire ${G} invocations$`), (m) => `소환 ${grp(m[1])}회`],
  [new RegExp(`^Faire ${G} améliorations$`), (m) => `강화 ${grp(m[1])}회`],
  [/^(\d+) faites? (▸|▾)$/, (m) => `${m[1]}개 완료 ${m[2]}`],
  // ---- 모험
  [/^Carte de (.+) · (\d+)\/(\d+)$/, (m) => { const x = LK(m[1]); return x === null ? null : `${x}의 지도 · ${m[2]}/${m[3]}`; }],
  [/^Étape (\d+)$/, (m) => `스테이지 ${m[1]}`],
  [new RegExp(`^Étape (\\d+) : \\+(\\d+) ${CUR}$`), (m) => `스테이지 ${m[1]}: ${cur(m[3])} +${m[2]}`],
  [new RegExp(`^Étape (\\d+) : débloque le World Boss · \\+(\\d+) ${CUR}$`), (m) => `스테이지 ${m[1]}: 월드 보스 해금 · ${cur(m[3])} +${m[2]}`],
  [new RegExp(`^Étape (\\d+) : coffre de région · \\+(\\d+) ${CUR}$`), (m) => `스테이지 ${m[1]}: 지역 상자 · ${cur(m[3])} +${m[2]}`],
  [/^Étape (\d+) : fragment Légendaire universel$/, (m) => `스테이지 ${m[1]}: 범용 전설 파편`],
  [/^Étape (\d+) : World Boss · étape (\d+) : fragment Légendaire universel$/, (m) => `스테이지 ${m[1]}: 월드 보스 · 스테이지 ${m[2]}: 범용 전설 파편`],
  [/^Gardien niv\. (\d+-\d+(?: ×\d+)?)$/, (m) => `수호자 Lv.${m[1]}`],
  [/^combat de (\d+) s$/, (m) => `${m[1]}초 전투`],
  [new RegExp(`^\\+(\\d+) % de ${CUR}$`), (m) => `${cur(m[2])} +${m[1]}%`],
  // ---- 월드 보스
  [new RegExp(`^Combat de (\\d+) s · \\+(\\d+) ${CUR} par tentative, \\+(\\d+) par palier\\.$`), (m) => `${m[1]}초 전투 · 도전마다 ${cur(m[3])} +${m[2]}, 단계마다 +${m[4]}.`],
  [/^Libère l'étape (\d+) ›$/, (m) => `스테이지 ${m[1]} 클리어하기 ›`],
  [/^(\d+) sur (\d+)$/, (m) => `${m[2]} 중 ${m[1]}`],
  // ---- 틈새
  [/^(\d+) paliers · 1 bénédiction par victoire$/, (m) => `${m[1]}층 · 승리마다 축복 1개`],
  [/^Les (\d+) paliers$/, (m) => `${m[1]}개 층`],
  [/^(\d+) par jour · record (\d+)\/(\d+)$/, (m) => `하루 ${m[1]}회 · 기록 ${m[2]}/${m[3]}`],
  [/^(\d+) entrées? sur (\d+)$/, (m) => `입장권 ${m[2]}개 중 ${m[1]}개`],
  [/^(\d+) cœurs?$/, (m) => `하트 ${m[1]}개`],
  [/^Palier (\d+)\/(\d+)$/, (m) => `${m[1]}/${m[2]}층`],
  [/^Gardien du palier (\d+) : niv\. (\d+-\d+(?: ×\d+)?)$/, (m) => `${m[1]}층 수호자: Lv.${m[2]}`],
  [/^Palier (\d+) franchi : choisis une bénédiction$/, (m) => `${m[1]}층 돌파: 축복을 고르세요`],
  [new RegExp(`^Tu gardes les ${N} ${CUR} gagnés\\.$`), (m) => `획득한 ${cur(m[2])} ${d(m[1])}개는 그대로 가져가요.`],
  [/^Première fois au palier (\d+)$/, (m) => `${m[1]}층 최초 클리어`],
  [/^Palier (\d+) franchi : \+(.+)$/, (m) => `${m[1]}층 돌파: +${d(m[2])}`],
  [/^Brèche refermée au palier (\d+)$/, (m) => `${m[1]}층에서 틈새가 닫혔어요`],
  [/^Palier (\d+) : gardien trop solide \((\d+) cœurs?\)$/, (m) => `${m[1]}층: 수호자가 너무 강해요 (하트 ${m[2]}개)`],
  [/^Brèche quittée : (\d+) paliers?, \+(.+)$/, (m) => `틈새에서 나왔어요: ${m[1]}개 층, +${d(m[2])}`],
  // ---- 상점
  [/^Reste (\d+)\/(\d+)$/, (m) => `남음 ${m[1]}/${m[2]}`],
  [new RegExp(`^Acheter pour ${N} ${CUR}$`), (m) => `구매: ${cur(m[2])} ${d(m[1])}`],
  [new RegExp(`^Boutique · ${CUR}$`), (m) => `상점 · ${cur(m[1])}`],
  [/^Copie : (.+)$/, (m) => { const x = LK(m[1]); return x === null ? null : `복제본: ${x}`; }],
  [/^(.+) rejoint l'équipe !$/, (m) => { const x = LK(m[1]); return x === null ? null : `${x} 팀 합류!`; }],
  [/^Ce qui reste à la fin de l'échange devient des éclats \((\d+) par (.+)\)\.$/, (m) => `교환 기간이 끝나면 남은 재화는 파편으로 바뀌어요 (코인당 ${m[1]}개).`],
  [/^· ce qui reste à la fin devient des éclats \((\d+) par (.+)\)\.$/, (m) => `· 마지막에 남은 재화는 파편으로 바뀌어요 (코인당 ${m[1]}개).`],
  [/^Combats, boss et missions sont fermés\. Dépense ta monnaie : ce qui reste à la fin sera converti en éclats \((\d+) par pièce\)\.$/, (m) => `전투, 보스, 미션이 닫혔어요. 재화를 쓰세요: 마지막에 남은 재화는 파편으로 바뀌어요 (코인당 ${m[1]}개).`],
  [/^Échange effectué$/, () => '교환 완료'],
  // ---- 오솔길
  [/^(\d+) \/ (\d+) obtenus$/, (m) => `${m[1]} / ${m[2]} 획득`],
  [new RegExp(`^${N} ${CUR} gagnés$`), (m) => `${cur(m[2])} ${d(m[1])} 획득`],
  [new RegExp(`^${N} ${CUR}$`), (m) => `${cur(m[2])} ${d(m[1])}`],
  [/^La monnaie tombe en jouant \(monstres et boss, (\d+) par jour au plus\) et avec les missions\. Dépenser ne fait pas reculer sur le sentier\.$/, (m) => `플레이하면 재화가 떨어지고(몬스터와 보스, 하루 최대 ${m[1]}개) 미션으로도 얻어요. 써도 오솔길 진행은 줄지 않아요.`],
  // ---- 「?」 안내
  [/^la grande fête dure (\d+) jours, puis (\d+) jours d'échange, puis la petite fête du mois\.$/, (m) => `대축제는 ${m[1]}일간 이어지고, 이어서 ${m[2]}일의 교환 기간, 그다음 이달의 소축제가 열려요.`],
  [new RegExp(`^tes ${CUR} se gagnent sur la Carte, au World Boss, dans la Brèche et avec les missions\\.$`), (m) => `${cur(m[1])}: 지도, 월드 보스, 틈새, 미션에서 얻어요.`],
  [/^les (\d+) derniers jours, les combats sont fermés et la boutique reste ouverte\.$/, (m) => `마지막 ${m[1]}일 동안은 전투가 닫히고 상점만 열려 있어요.`],
  [/^ce qui reste à la fin devient des éclats \((\d+) par pièce\)\. Tu ne perds rien\.$/, (m) => `마지막에 남은 재화는 파편으로 바뀌어요(코인당 ${m[1]}개). 잃는 것은 없어요.`],
  [/^la petite fête dure jusqu'à l'échange des (\d+) derniers jours du mois\.$/, (m) => `소축제는 이달 마지막 ${m[1]}일의 교환 기간 전까지 이어져요.`],
  [new RegExp(`^tes ${CUR} tombent en jouant \\(monstres, boss\\) et avec les missions : elles font avancer le sentier\\.$`), (m) => `${cur(m[1])}: 플레이(몬스터, 보스)와 미션으로 얻고, 오솔길을 나아가게 해요.`],
  [/^les (\d+) derniers jours, il ne reste que la boutique\.$/, (m) => `마지막 ${m[1]}일 동안은 상점만 남아요.`],
  // ---- 이벤트 탭, 소환, HUD
  [/^(\d+)\/(\d+) étapes$/, (m) => `${m[1]}/${m[2]} 스테이지`],
  [/^(\d+) à récupérer$/, (m) => `받을 것 ${m[1]}개`],
  [/^(\d+) à faire$/, (m) => `할 일 ${m[1]}개`],
  [/^Héros du mois · (.+)$/, (m) => { const x = LK(m[1]); return x === null ? null : `이달의 영웅 · ${x}`; }],
  [/^Gratuits · (.+) et (.+)$/, (m) => { const a = LK(m[1]); const b = LK(m[2]); return a === null || b === null ? null : `무료 · ${a}, ${b}`; }],
  [/^(\d+) invocations$/, (m) => `소환 ${m[1]}회`],
  [/^Jalons de la fête : (\d+) sur (\d+)\. Ouvrir l'Aventure de la fête$/, (m) => `축제 이정표: ${m[2]} 중 ${m[1]}. 축제 모험 열기`],
  // ---- main.js 메시지
  [/^Étape (\d+) réussie : \+(.+)$/, (m) => `스테이지 ${m[1]} 클리어: +${d(m[2])}`],
  [/^Étape (\d+) : gardien trop solide$/, (m) => `스테이지 ${m[1]}: 수호자가 너무 강해요`],
  [/^(\d+) étapes? gagnées? : \+(.+)$/, (m) => `스테이지 ${m[1]}개 클리어: +${d(m[2])}`],
  [/^World Boss : (.+) dégâts · \+(\d+)( · record !)?$/, (m) => `월드 보스: 피해 ${d(m[1])} · +${m[2]}${m[3] ? ' · 기록 경신!' : ''}`],
  [/^Classement de la fête : (.+)$/, (m) => `축제 순위: ${t(m[1])}`],
  [/^Mission réussie : \+(\d+)$/, (m) => `미션 완료: +${m[1]}`],
  [/^Missions : \+(\d+)$/, (m) => `미션: +${m[1]}`],
  [/^×(\d+) : (\d+) tickets? de compagnon$/, (m) => `×${m[1]}: 동료 티켓 ${m[2]}장`],
  [/^Fin de la fête : monnaie restante convertie en (.+) éclats$/, (m) => `축제 종료: 남은 재화가 파편 ${d(m[1])}개로 바뀌었어요`],
]; };
