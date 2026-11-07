// v9.2.9 : anglais des textes relevés par la passe de stabilité (tools/e2e-stabilite.mjs, audit-overflow).
// Branché à la fin de ./en.js, sans écraser l'existant.
const CUR = { gemme: 'gem', gemmes: 'gems', 'ticket limité': 'limited ticket', 'tickets limités': 'limited tickets',
  'ticket permanent': 'permanent ticket', 'tickets permanents': 'permanent tickets', 'ticket familier': 'pet ticket', 'tickets familiers': 'pet tickets' };
export const EXACT_929_STAB = {};
const ENV_NAMES = 'Pénombre|Éclats de cristal|Soif|Froid mordant|Malédiction|Boue|Rafales|Lave|Distorsion|Pression|Corruption';
// Butin gardé d'une défaite en donjon : « 1,2 M or · 3 éclats » → « 1.2 M gold · 3 shards ».
const kept = (lookup, x) => (lookup(`Conservé : ${x}`) ?? `Kept: ${x}`).replace(/^Kept: /, '').replace(/(\d),(\d)/g, '$1.$2');
export const patterns929Stab = (lookup) => [
  // Nom accessible des boutons d'invocation (panneau Invocation) : « ×10 : 10 tickets limités ».
  [/^×(\d+) : ([\d\s.,]+[KMBT]?) (gemmes?|tickets? (?:limités?|permanents?|familiers?))$/, (m) => `×${m[1]}: ${m[2]} ${CUR[m[3]] ?? m[3]}`],
  // Pastille d'environnement sans signe (« Pénombre : 12 % de ratés ») : le motif v9.2.1 exigeait + ou −.
  [new RegExp(`^(${ENV_NAMES}) : ([\\d,]+) % de ratés$`), (m) => { const w = lookup(m[1]); return w === null ? null : `${w}: ${m[2].replace(',', '.')}% misses`; }],
  // Défaite en donjon : « or » restait en français dans le butin gardé.
  [/^Défaite en salle (\d+)\. Conservé : (.+) — détails dans l'onglet Donjons\.$/, (m) => `Defeated in room ${m[1]}. Kept: ${kept(lookup, m[2])} — details in the Dungeons tab.`],
  [/^Défaite face au boss final \(encore ([\d,]+) % de PV\)\. Conservé : (.+) — détails dans l'onglet Donjons\.$/, (m) => `Defeated by the final boss (${m[1].replace(',', '.')}% HP left). Kept: ${kept(lookup, m[2])} — details in the Dungeons tab.`],
];
