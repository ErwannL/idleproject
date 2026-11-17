// v9.2.1 : coréen des malus d'environnement et de leurs mentions. Branché à la fin de ./ko.js.
export const EXACT_921 = {
  'Voyage impossible pendant un donjon : termine-le ou quitte-le (bouton rouge sous la scène).': '던전 진행 중에는 이동할 수 없습니다: 끝내거나 나가세요 (장면 아래 빨간 버튼).',
  "Voyage impossible pendant la Tour de l'Éternité : termine ou quitte la montée (bouton rouge sous la scène).": '영원의 탑 진행 중에는 이동할 수 없습니다: 등반을 끝내거나 나가세요 (장면 아래 빨간 버튼).',
  'Voyage impossible pendant le défi de la semaine : termine-le ou quitte-le (bouton rouge sous la scène).': '주간 도전 중에는 이동할 수 없습니다: 끝내거나 나가세요 (장면 아래 빨간 버튼).',
  Environnement: '환경',
  'réduit les dégâts reçus': '받는 피해 감소', 'invoque des serviteurs': '하수인 소환', 'frappe de plus en plus fort': '점점 더 강하게 공격',
  'enragé sous 50 % de PV': 'HP 50% 미만에서 격노', 'se régénère sans critiques': '치명타가 없으면 재생',
  'Pénombre': '어스름', 'Éclats de cristal': '수정 파편', Soif: '갈증', 'Froid mordant': '살을 에는 추위',
  'Malédiction': '저주', Boue: '진흙', Rafales: '돌풍', Lave: '용암', Distorsion: '왜곡', Pression: '수압', Corruption: '타락',
  'Environnements des mondes': '월드 환경',
  'Environnement : aucun malus dans ce monde.': '환경: 이 월드에는 페널티가 없습니다.',
  "Le malus grandit de 25 % par cycle (×2 au plus) et baisse selon le niveau de l'amélioration qui le contre.":
    '페널티는 주기마다 25%씩 커지며(최대 ×2), 대응하는 강화의 레벨에 따라 줄어듭니다.',
  "Dans les mondes 2 à 12, l'environnement gêne le héros : la mention « contre … » marque l'amélioration qui réduit ce malus (annulé à son niveau complet).":
    '월드 2~12에서는 환경이 영웅을 방해합니다. « … 대응 » 표시는 이 페널티를 줄이는 강화입니다 (완성 레벨에서 무효).',
  "Dès le monde 2, chaque monde a un malus d'environnement (Pénombre, Lave…), un peu plus fort à chaque cycle. Une amélioration à l'or le réduit selon son niveau : la fiche du monde et la pastille en bas à gauche du combat disent laquelle et la part contrée.":
    '월드 2부터 각 월드에는 환경 페널티(어스름, 용암…)가 있으며 주기마다 조금씩 강해집니다. 골드 강화 하나가 레벨에 따라 이를 줄입니다. 월드 정보와 전투 화면 왼쪽 아래 배지에서 어떤 강화인지와 상쇄 비율을 볼 수 있습니다.',
};
const N = (s) => s.replace(',', '.');
const EFFECTS = [
  [/^([\d,]+) % de tes coups manquent$/, (m) => `공격의 ${N(m[1])}%가 빗나감`],
  [/^\+([\d,]+) % de dégâts reçus$/, (m) => `받는 피해 +${N(m[1])}%`],
  [/^−([\d,]+) % de régénération$/, (m) => `재생 −${N(m[1])}%`],
  [/^−([\d,]+) % de PV max$/, (m) => `최대 체력 −${N(m[1])}%`],
  [/^−([\d,]+) % de dégâts$/, (m) => `피해 −${N(m[1])}%`],
  [/^−([\d,]+) % de vitesse d'attaque$/, (m) => `공격 속도 −${N(m[1])}%`],
  [/^−([\d,]+) % de chance de critique$/, (m) => `치명타 확률 −${N(m[1])}%`],
  [/^tu perds ([\d,]+) % de tes PV max par seconde$/, (m) => `초당 최대 체력의 ${N(m[1])}% 손실`],
  [/^−([\d,]+) % de dégâts contre les boss$/, (m) => `보스 대상 피해 −${N(m[1])}%`],
  [/^−([\d,]+) % d'armure$/, (m) => `방어구 −${N(m[1])}%`],
  [/^−([\d,]+) % de puissance des compagnons$/, (m) => `동료 위력 −${N(m[1])}%`],
];
export const patterns921 = (lookup) => [
  ...EFFECTS,
  [/^contré par (.+) \((\d+) %\)$/, (m) => { const w = lookup(m[1]); return w === null ? null : `${w}(으)로 대응 (${m[2]}%)`; }],
  [/^contré par (.+) \(complet au niveau (\d+)\)$/, (m) => { const w = lookup(m[1]); return w === null ? null : `${w}(으)로 대응 (레벨 ${m[2]}에서 완성)`; }],
  [/^(Pénombre|Éclats de cristal|Soif|Froid mordant|Malédiction|Boue|Rafales|Lave|Distorsion|Pression|Corruption) : annulé$/, (m) => { const w = lookup(m[1]); return w === null ? null : `${w}: 무효`; }],
  [/^(Pénombre|Éclats de cristal|Soif|Froid mordant|Malédiction|Boue|Rafales|Lave|Distorsion|Pression|Corruption) : (\+|−)([\d,]+) % (de ratés|dégâts reçus|régénération|PV max|dégâts|vitesse|critique|PV\/s|contre boss|armure|compagnons)$/, (m) => { const w = lookup(m[1]); const u = { 'de ratés': '빗나감', 'dégâts reçus': '받는 피해', 'régénération': '재생', 'PV max': '최대 HP', 'dégâts': '피해', vitesse: '속도', critique: '치명타', 'PV/s': 'HP/초', 'contre boss': '보스 대상', armure: '방어구', compagnons: '동료' }[m[4]]; return w === null ? null : `${w}: ${u} ${m[2] === '+' ? '+' : m[4] === 'de ratés' ? '' : '−'}${m[3].replace(',', '.')}%`; }],
  [/^contré (\d+) %$/, (m) => `대응 ${m[1]}%`],
  [/^contre (.+)$/, (m) => { const w = lookup(m[1]); return w === null ? null : `${w} 대응`; }],
  [/^Contré : (\d+) % \(complet au niveau (\d+)\)$/, (m) => `대응: ${m[1]}% (레벨 ${m[2]}에서 완성)`],
];
