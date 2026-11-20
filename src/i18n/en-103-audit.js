// v10.3 (audit des parties 0 à 7 du plan 10.2) : anglais des textes ajoutés ou renommés par l'audit
// (« coffre » de rangement → « Réserve », onglet Arène, dos de carte doré). Branché à la fin de ./en.js.
let LK = () => null;
const tr = (s) => LK(s) ?? s;
const GUIDE_BAG_FR = 'Les objets grandissent avec leur niveau : Réaffûter remonte un objet au niveau de ton étape max. La Forge s\'ouvre à l\'étape 10 et la Réserve à l\'étape 20 : elle garde des objets jamais recyclés et les meilleures pièces d\'ensemble (filtre Ensemble, « Porter ») ; les Builds enregistrent équipe, équipement, classe, pouvoirs et compétences. Recyclage et fusion automatiques : Réglages du sac.';
const GUIDE_FINDS_FR = 'Les trouvailles (coffres, gemmes, portails) arrivent pendant le combat. Sac plein : les objets vont à la Réserve ; sac et Réserve pleins : les récompenses avec un objet attendent ici. Les marchands sont dans Missions › Aujourd\'hui.';
export const EXACT_103A = {
  'Arène : un étage à franchir (gemmes et étoiles)': 'Arena: a floor to clear (gems and stars)',
  'Tes compagnons deviennent des cartes : place-les et affronte les étages.': 'Your companions become cards: place them and take on the floors.',
  'Des gemmes, des éclats et des grimoires à chaque étage franchi.': 'Gems, shards and grimoires for every floor cleared.',
  'Le Défi de la semaine, puis la Tour : des combats à règles spéciales.': 'The Weekly Challenge, then the Tower: fights with special rules.',
  'Des récompenses à chaque palier franchi.': 'Rewards at every milestone.',
  'Défis du jour et de la semaine : la Tour et le Défi.': 'Daily and weekly challenges: the Tower and the Challenge.',
  'Dos de carte doré gagné !': 'Golden card back earned!',
  'Dos de carte doré': 'Golden card back',
  'Ta formation le porte dès le prochain combat.': 'Your formation wears it from the next fight.',
  'Gagné en battant le gardien de l\'étage 25': 'Earned by beating the floor 25 guardian',
  '✔ Gardien vaincu : ta formation porte le': '✔ Guardian beaten: your formation wears the',
  'Frénésie': 'Frenzy',
  'Rangé dans la Réserve': 'Stored in Storage',
  'Réserve, Renaissance, Hauts faits…': 'Storage, Rebirth, Achievements…',
  'Sac et Réserve pleins': 'Bag and Storage full',
  'Sac et Réserve pleins.': 'Bag and Storage full.',
  'Sac et Réserve pleins : recycle un objet pour acheter.': 'Bag and Storage full: recycle an item to buy.',
  'Sac et Réserve pleins : les récompenses avec un objet attendent ici. Recycle des objets.': 'Bag and Storage full: rewards with an item wait here. Recycle some items.',
  'Sac et Réserve pleins : libère de la place pour récupérer les objets.': 'Bag and Storage full: free up space to collect the items.',
  'Objet en attente (sac et Réserve pleins)': 'Item on hold (bag and Storage full)',
  'Impossible : pas un objet ancestral, ou sac et Réserve pleins.': 'Impossible: not an ancestral item, or bag and Storage full.',
  [GUIDE_BAG_FR]: 'Items grow with their level: Resharpen brings an item up to your max stage level. The Forge opens at stage 10 and Storage at stage 20: it keeps items that are never recycled and the best set pieces (Set filter, “Wear”); Builds save team, gear, class, powers and skills. Automatic recycling and fusion: Bag settings.',
  [GUIDE_FINDS_FR]: 'Finds (chests, gems, portals) arrive during combat. Bag full: items go to Storage; bag and Storage full: rewards with an item wait here. Merchants are in Missions › Today.',
};
// Placés AVANT les autres motifs (voir ./en.js) : « Tri : … » et « … en attente … » existent déjà avec l'ancien mot.
export const patterns103a = (lookup = () => null) => { LK = lookup; return [
  [/^Tri : (.+)$/, (m) => `Sorted: ${m[1].replace(/ au sac/g, ' to bag').replace(/ en Réserve/g, ' to Storage').replace(/ au coffre/g, ' to Storage').replace(/ en attente/g, ' pending').replace(/ recyclés? \(\+(.+) or\)/g, ' recycled (+$1 gold)')}`],
  [/^(\d+) en Réserve$/, (m) => `${m[1]} to Storage`],
  [/^(\d+) en attente : sac et Réserve pleins$/, (m) => `${m[1]} on hold: bag and Storage full`],
  [/^(.+) \((\d+) en attente : sac et Réserve pleins\)$/, (m) => `${tr(m[1])} (${m[2]} on hold: bag and Storage full)`],
  [/^(.+) rangé dans la Réserve \(ensemble « (.+) »\)$/, (m) => `${m[1]} stored in Storage (set “${tr(m[2])}”)`],
  [/^(\d+) récompenses? avec un objet en attente \(sac et Réserve pleins\) : Objectifs › À récupérer\.$/, (m) => `${m[1]} reward${m[1] === '1' ? '' : 's'} with an item on hold (bag and Storage full): Goals › Claims.`],
  [/^S'ouvre à l'étape (.+), avec un compagnon$/, (m) => `Opens at stage ${m[1]}, with one companion`],
]; };
