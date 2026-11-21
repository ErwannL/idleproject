// v10.4 (partie 6) : anglais des nouveaux textes du Bastion (page plein écran, démarrage, tour, « Pendant ton absence »).
// Branché à la fin de ./en.js (noms d'import uniques : EXACT_1040_BASTION, patterns1040Bastion).
let LK = () => null;
const L = (s) => LK(s) ?? s;
const TRADE = { forgeron: 'smith', forgeronne: 'smith', savant: 'scholar', savante: 'scholar', mineur: 'miner', mineuse: 'miner', 'entraîneur': 'trainer', 'entraîneuse': 'trainer', marchand: 'merchant', marchande: 'merchant', ouvrier: 'worker' };

export const EXACT_1040_BASTION = {
  'Carte': 'Map',
  'Commandes': 'Orders',
  'Commander': 'Order',
  'Lancer': 'Start',
  'Améliorer': 'Upgrade',
  'Construire': 'Build',
  'Compris': 'Got it',
  'Prête': 'Ready',
  'Livré au coffre': 'In the loot chest',
  'Livré dans le coffre de butin': 'Delivered to the loot chest',
  'Pendant ton absence': 'While you were away',
  'Tout récupérer': 'Collect all',
  'Ton Bastion se met au travail': 'Your Bastion gets to work',
  'Gardées après les Renaissances.': 'Kept through Rebirths.',
  'Aucun ouvrier : à l\'arrêt': 'No worker: at a standstill',
  'Aucun compagnon libre': 'No free companion',
  'Construis la Bibliothèque': 'Build the Library',
  'Ouvriers posés / places': 'Workers placed / slots',
  'Niveau du Bastion : somme des niveaux': 'Bastion level: sum of the levels',
  'Retour au combat': 'Back to the fight',
  'Le Bastion ouvre ses portes : Équipe › Bastion': 'The Bastion opens its gates: Team › Bastion',
  'Tes compagnons libres construisent et cherchent pour toi, même jeu fermé.': 'Your free companions build and research for you, even with the game closed.',
  '5 compagnons': '5 companions',
};

export const patterns1040Bastion = (lookup = () => null) => { LK = lookup; return [
  // « Reine démone, forgeronne : +40 % »
  [/^(.+), (forgeronne?|savante?|mineur|mineuse|entraîneur|entraîneuse|marchande?|ouvrier) : \+(\d+) %$/, (m) => `${L(m[1])}, ${TRADE[m[2]]}: +${m[3]}%`],
  [/^Chantier offert : (.+), (.+)$/, (m) => `Free building work: ${L(m[1])}, ${L(m[2])}`],
  [/^Après : (.+)$/, (m) => `After: ${L(m[1])}`],
  [/^Bastion niv\. (\d+)$/, (m) => `Bastion lv. ${m[1]}`],
  [/^Chantier : niv\. (\d+) → (\d+)$/, (m) => `Building work: lv. ${m[1]} → ${m[2]}`],
  [/^Niv\. (\d+) → (\d+)$/, (m) => `Lv. ${m[1]} → ${m[2]}`],
  [/^Niv\. (\d+) ·$/, (m) => `Lv. ${m[1]} ·`],
  [/^Places prises \((\d+)\)$/, (m) => `Slots taken (${m[1]})`],
  [/^Recherches (\d+)\/(\d+)$/, (m) => `Research ${m[1]}/${m[2]}`],
  [/^Bastion : (\d+) à voir$/, (m) => `Bastion: ${m[1]} to see`],
  [/^(.+) · à l'arrêt$/, (m) => `${L(m[1])} · at a standstill`],
  [/^(.+) sans bonus$/, (m) => `${L(m[1])} without bonus`],
  [/^Métier conseillé : (.+) \(\+(\d+) %\)$/, (m) => `Best trade: ${L(m[1])} (+${m[2]}%)`],
  [/^(.+) par heure$/, (m) => `${L(m[1])} per hour`],
  [/^(.+) par jour$/, (m) => `${L(m[1])} per day`],
  [/^([\d,]+) (éclats|grimoires)$/, (m) => `${m[1].replace(',', '.')} ${m[2] === 'éclats' ? 'shards' : 'grimoires'}`],
  [/^(Forge du forgeron|Bibliothèque|Mine de cristal|Camp d'entraînement|Comptoir|Expéditions) : (.+)$/, (m) => `${L(m[1])}: ${L(m[2])}`],
]; };
