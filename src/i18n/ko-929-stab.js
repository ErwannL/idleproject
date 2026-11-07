// v9.2.9 : coréen des textes relevés par la passe de stabilité (tools/e2e-stabilite.mjs, audit-overflow).
// Branché à la fin de ./ko.js, sans écraser l'existant.
const CUR = { gemme: '보석', gemmes: '보석', 'ticket limité': '한정 티켓', 'tickets limités': '한정 티켓',
  'ticket permanent': '상시 티켓', 'tickets permanents': '상시 티켓', 'ticket familier': '펫 티켓', 'tickets familiers': '펫 티켓' };
const WORD = { fragment: '파편', fragments: '파편', gemme: '보석', gemmes: '보석', 'éclat': '조각', 'éclats': '조각', or: '골드', 'Étoile': '별', 'Étoiles': '별' };
export const EXACT_929_STAB = {
  fragment: '파편',
  rien: '없음',
  "Si vous l'équipez (emplacement vide)": '장착 시 (빈 슬롯)',
};
const ENV_NAMES = 'Pénombre|Éclats de cristal|Soif|Froid mordant|Malédiction|Boue|Rafales|Lave|Distorsion|Pression|Corruption';
const kept = (lookup, x) => (lookup(`Conservé : ${x}`) ?? x).replace(/^유지: /, '');
export const patterns929Stab = (lookup) => [
  [/^×(\d+) : ([\d\s.,]+[KMBT]?) (gemmes?|tickets? (?:limités?|permanents?|familiers?))$/, (m) => `×${m[1]}: ${CUR[m[3]] ?? m[3]} ${m[2]}`],
  // Singulier (« 1 fragment ») : les motifs existants ne prenaient que le pluriel.
  [/^Il manque 1 (fragment|gemme|éclat|Étoile)$/, (m) => `${WORD[m[1]]} 1 부족`],
  [/^Coût : 1 (fragment|gemme|éclat|Étoile)$/, (m) => `비용: ${WORD[m[1]]} 1`],
  [/^Apprendre : 1 (fragment|gemme|éclat|Étoile)$/, (m) => `배우기: ${WORD[m[1]]} 1`],
  [new RegExp(`^(${ENV_NAMES}) : ([\\d,]+) % de ratés$`), (m) => { const w = lookup(m[1]); return w === null ? null : `${w}: 빗나감 ${m[2].replace(',', '.')}%`; }],
  // Défaite face au boss final d'un donjon : aucune traduction coréenne.
  [/^Défaite face au boss final \(encore ([\d,]+) % de PV\)\. Conservé : (.+) — détails dans l'onglet Donjons\.$/, (m) => `최종 보스에게 패배 (HP ${m[1].replace(',', '.')}% 남음). 획득 유지: ${kept(lookup, m[2])} — 자세한 내용은 던전 탭에서.`],
];
