// v10.14.2 : anglais des nouveaux textes téléphone (Carnet en pastille, Recycler, Marchands vides, Guilde, Invocation taux et pitié,
// Améliorations, Arbre avancé). Branché à la fin de ./en.js, sans écraser l'existant.
export const EXACT_1014_2 = {
  'Coffre à ouvrir': 'Chest to open',
  'Ça dort': 'Sleeping',
  'Rien à recycler : tes objets sont protégés ou utiles.': 'Nothing to recycle: your items are protected or useful.',
  'Filtrer par rareté': 'Filter by rarity',
  "Les objets cochés deviennent des éclats et de l'or.": 'Checked items become shards and gold.',
  'Aucun objet de cette rareté.': 'No item of this rarity.',
  'Ce que ça rapporte': 'What you get',
  'Un boss, toute la guilde': 'One boss, the whole guild',
  "Plus de dégâts et d'or": 'More damage and gold',
  'Grimpe avec tes amis': 'Climb with your friends',
  "Connexion au serveur impossible pour le moment : voici ce qui t'attend.": "Can't reach the server right now: here is what awaits you.",
  'Aucun marchand de passage pour le moment': 'No merchant passing by right now',
  'Le chariot dort au loin': 'The cart sleeps far away',
  'Les marchands passent au hasard pendant tes combats. Continue de vaincre des ennemis : le prochain arrive bientôt.': 'Merchants pass by at random during your fights. Keep defeating enemies: the next one is coming soon.',
  'Taux': 'Rates',
  'Outils et réinitialisation': 'Tools and reset',
  'Il manque': 'Missing',
  'Commun': 'Common',
  'Épique': 'Epic',
};
const LOG_END = { 'coffre du jour ouvert ✓': 'daily chest opened ✓', 'ouvre le coffre du jour ›': 'open the daily chest ›' };
const RAR = { Tout: 'All', Commun: 'Common', Rare: 'Rare', 'Épique': 'Epic' };
export const patterns1014_2 = () => [
  [/^Carnet (\d+)\/(\d+)( ✓)?$/, (m) => `Log ${m[1]}/${m[2]}${m[3] ?? ''}`],
  [/^Carnet (\d+)\/(\d+) · (coffre du jour ouvert ✓|ouvre le coffre du jour ›)$/, (m) => `Log ${m[1]}/${m[2]} · ${LOG_END[m[3]]}`],
  [/^(Tout|Commun|Rare|Épique) (\d+)$/, (m) => `${RAR[m[1]]} ${m[2]}`],
  [/^\+(\d+) autres?$/, (m) => `+${m[1]} more`],
  [/^Légendaire garanti dans (\d+) tirages?$/, (m) => `Legendary guaranteed in ${m[1]} pull${m[1] === '1' ? '' : 's'}`],
];
