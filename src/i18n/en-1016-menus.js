// v10.16 (partie B « Menus et ergonomie ») : anglais des nouveaux textes — onglet « Plus », écran Objectifs, format des
// grands nombres, raison des boutons grisés, Classement et Guilde sans compte. Branché à la fin de ./en.js, sans écraser l'existant.
export const EXACT_1016_MENUS = {
  // B1, B2 : navigation et Objectifs
  'Plus': 'More',
  'Objectifs': 'Goals',
  'Maintenant': 'Now',
  "Aujourd'hui": 'Today',
  'Plus tard': 'Later',
  "Maintenant, aujourd'hui, plus tard : tout ce qui t'attend, au même endroit.": 'Now, today, later: everything waiting for you, in one place.',
  'Avance sur la Carte : bats le prochain boss.': 'Move on along the Map: beat the next boss.',
  'Voir': 'View',
  'Cosmétiques : aucun bonus de puissance, achetés une fois pour toutes, équipables et retirables dans Plus › Apparences et Paramètres › Thème.':
    'Cosmetics: no power bonus, bought once and for all, equip or remove them in More › Looks and Settings › Theme.',
  // B4 : grands nombres
  'Grands nombres': 'Big numbers',
  'Lettres puis ×10ⁿ': 'Letters then ×10ⁿ',
  'Tout en lettres': 'All letters',
  'Tout en ×10ⁿ': 'All ×10ⁿ',
  '1,2 Qi, puis 5,4×10⁸⁹ au-delà de 10³³': '1.2 Qi, then 5.4×10⁸⁹ beyond 10³³',
  '1,2 Qi, puis aa, ab… après Dc (10³³)': '1.2 Qi, then aa, ab… after Dc (10³³)',
  '1,2×10¹⁸, 5,4×10⁸⁹': '1.2×10¹⁸, 5.4×10⁸⁹',
  // B5 : boutons grisés
  'Où en trouver ›': 'Where to get more ›',
  "Sac plein : recycle d'abord": 'Bag full: recycle first',
  'Rien à recycler': 'Nothing to recycle',
  'Rien à recycler : tes objets sont protégés ou utiles': 'Nothing to recycle: your items are protected or useful',
  // B6 : Classement et Guilde sans compte
  'Le classement des joueurs': 'The player ranking',
  'Compare ton record à celui de tous les joueurs.': 'Compare your record with every player.',
  'Vois ton rang, monde par monde.': 'See your rank, world by world.',
  'Ajoute des amis et suis leurs progrès.': 'Add friends and follow their progress.',
  'Rejoins une guilde': 'Join a guild',
  'Des bonus pour toute la guilde.': 'Bonuses for the whole guild.',
  'Un boss commun à battre ensemble.': 'A shared boss to beat together.',
  'Une bannière et une salle commune.': 'A banner and a common hall.',
  'Impossible de charger.': "Couldn't load.",
  'Réessayer': 'Retry',
};
const UNIT = { tickets: 'tickets', ticket: 'ticket', gemmes: 'gems', gemme: 'gem', 'éclats': 'shards', 'éclat': 'shard', "pièces d'or": 'gold coins', "pièce d'or": 'gold coin' };
const d = (s) => String(s).replace(/(\d),(\d)/g, '$1.$2'); // virgule décimale → point
export const patterns1016Menus = () => [
  [/^Il te manque (\S+(?: \S+)?) (tickets?|gemmes?|éclats?|pièces? d'or)( pour ×(\d+))?$/, (m) => `You need ${d(m[1])} more ${UNIT[m[2]]}${m[3] ? ` for ×${m[4]}` : ''}`],
  [/^Tout récupérer \((\d+)\)$/, (m) => `Claim all (${m[1]})`],
  [/^Tu joues en invité \((.*)\)\.$/, (m) => `You're playing as a guest (${m[1]}).`],
];
