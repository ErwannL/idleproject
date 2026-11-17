// v9.2.1 : anglais des malus d'environnement (data/environment.js, core/environment.js) et de leurs mentions.
// Branché à la fin de ./en.js comme ./en-920-upg.js.
export const EXACT_921 = {
  'Voyage impossible pendant un donjon : termine-le ou quitte-le (bouton rouge sous la scène).': 'Travel unavailable during a dungeon: finish or leave it (red button under the scene).',
  "Voyage impossible pendant la Tour de l'Éternité : termine ou quitte la montée (bouton rouge sous la scène).": 'Travel unavailable during the Tower of Eternity: finish or leave the climb (red button under the scene).',
  'Voyage impossible pendant le défi de la semaine : termine-le ou quitte-le (bouton rouge sous la scène).': 'Travel unavailable during the weekly challenge: finish or leave it (red button under the scene).',
  Environnement: 'Environment',
  'réduit les dégâts reçus': 'reduces damage taken', 'invoque des serviteurs': 'summons minions', 'frappe de plus en plus fort': 'hits harder and harder',
  'enragé sous 50 % de PV': 'enraged below 50% HP', 'se régénère sans critiques': 'regenerates without crits',
  'Pénombre': 'Gloom', 'Éclats de cristal': 'Crystal shards', Soif: 'Thirst', 'Froid mordant': 'Biting cold',
  'Malédiction': 'Curse', Boue: 'Mud', Rafales: 'Gusts', Lave: 'Lava', Distorsion: 'Distortion', Pression: 'Pressure', Corruption: 'Corruption',
  'Environnements des mondes': 'World environments',
  'Environnement : aucun malus dans ce monde.': 'Environment: no penalty in this world.',
  "Le malus grandit de 25 % par cycle (×2 au plus) et baisse selon le niveau de l'amélioration qui le contre.":
    'The penalty grows by 25% per cycle (×2 at most) and shrinks with the level of the upgrade that counters it.',
  "Dans les mondes 2 à 12, l'environnement gêne le héros : la mention « contre … » marque l'amélioration qui réduit ce malus (annulé à son niveau complet).":
    'In worlds 2 to 12, the environment hinders the hero: the “counters …” tag marks the upgrade that reduces this penalty (cancelled at its full level).',
  "Dès le monde 2, chaque monde a un malus d'environnement (Pénombre, Lave…), un peu plus fort à chaque cycle. Une amélioration à l'or le réduit selon son niveau : la fiche du monde et la pastille en bas à gauche du combat disent laquelle et la part contrée.":
    'From world 2 on, each world has an environment penalty (Gloom, Lava…), a bit stronger each cycle. A gold upgrade reduces it with its level: the world sheet and the badge at the bottom left of the battle say which one and how much is countered.',
};
const N = (s) => s.replace(',', '.');
const EFFECTS = [
  [/^([\d,]+) % de tes coups manquent$/, (m) => `${N(m[1])}% of your attacks miss`],
  [/^\+([\d,]+) % de dégâts reçus$/, (m) => `+${N(m[1])}% damage taken`],
  [/^−([\d,]+) % de régénération$/, (m) => `−${N(m[1])}% regeneration`],
  [/^−([\d,]+) % de PV max$/, (m) => `−${N(m[1])}% max HP`],
  [/^−([\d,]+) % de dégâts$/, (m) => `−${N(m[1])}% damage`],
  [/^−([\d,]+) % de vitesse d'attaque$/, (m) => `−${N(m[1])}% attack speed`],
  [/^−([\d,]+) % de chance de critique$/, (m) => `−${N(m[1])}% critical chance`],
  [/^tu perds ([\d,]+) % de tes PV max par seconde$/, (m) => `you lose ${N(m[1])}% of your max HP per second`],
  [/^−([\d,]+) % de dégâts contre les boss$/, (m) => `−${N(m[1])}% damage against bosses`],
  [/^−([\d,]+) % d'armure$/, (m) => `−${N(m[1])}% armor`],
  [/^−([\d,]+) % de puissance des compagnons$/, (m) => `−${N(m[1])}% companion power`],
];
export const patterns921 = (lookup) => [
  ...EFFECTS,
  [/^contré par (.+) \((\d+) %\)$/, (m) => { const w = lookup(m[1]); return w === null ? null : `countered by ${w} (${m[2]}%)`; }],
  [/^contré par (.+) \(complet au niveau (\d+)\)$/, (m) => { const w = lookup(m[1]); return w === null ? null : `countered by ${w} (full at level ${m[2]})`; }],
  [/^(Pénombre|Éclats de cristal|Soif|Froid mordant|Malédiction|Boue|Rafales|Lave|Distorsion|Pression|Corruption) : annulé$/, (m) => { const w = lookup(m[1]); return w === null ? null : `${w}: cancelled`; }],
  [/^(Pénombre|Éclats de cristal|Soif|Froid mordant|Malédiction|Boue|Rafales|Lave|Distorsion|Pression|Corruption) : (\+|−)([\d,]+) % (de ratés|dégâts reçus|régénération|PV max|dégâts|vitesse|critique|PV\/s|contre boss|armure|compagnons)$/, (m) => { const w = lookup(m[1]); const u = { 'de ratés': 'misses', 'dégâts reçus': 'damage taken', 'régénération': 'regen', 'PV max': 'max HP', 'dégâts': 'damage', vitesse: 'speed', critique: 'crit', 'PV/s': 'HP/s', 'contre boss': 'vs bosses', armure: 'armor', compagnons: 'companions' }[m[4]]; return w === null ? null : `${w}: ${m[2] === '+' ? '+' : m[4] === 'de ratés' ? '' : '−'}${m[3].replace(',', '.')}% ${u}`; }],
  [/^contré (\d+) %$/, (m) => `countered ${m[1]}%`],
  [/^contre (.+)$/, (m) => { const w = lookup(m[1]); return w === null ? null : `counters ${w}`; }],
  [/^Contré : (\d+) % \(complet au niveau (\d+)\)$/, (m) => `Countered: ${m[1]}% (full at level ${m[2]})`],
];
