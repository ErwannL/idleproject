// v9.2.8 : anglais des nouveautés de la 9.2.8. Branché à la fin de ./en.js.
// Défense et fiche de stats : Défense, Double attaque, Puissance de combat (PC), coups encaissés, onglets des catégories.
export const EXACT_928 = {
  'Défense': 'Defense',
  '+10 points de Défense par niveau : réduit les dégâts subis (rendement décroissant, 60 % au plus)': '+10 Defense points per level: reduces damage taken (diminishing returns, 60% max)',
  'Double attaque': 'Double attack',
  '+0,4 % de chance de frapper deux fois par niveau (20 % au niveau 50)': '+0.4% chance to strike twice per level (20% at level 50)',
  'Toutes': 'All',
  'Trier': 'Sort',
  'Encaisse': 'Withstands',
  'coups · boss': 'hits · boss',
  'PC': 'CP',
  'Puissance de combat : moyenne des dégâts/s et des PV effectifs': 'Combat power: average of damage/s and effective HP',
  'Attaque': 'Attack',
  'Vitesse': 'Speed',
  'Chance de critique': 'Critical chance',
  'Santé': 'Health',
  'Coups encaissés (ennemi · boss)': 'Hits withstood (enemy · boss)',
  'Or bonus': 'Bonus gold',
};
export const patterns928 = (lookup) => [
  [/^\+([\d\s,.]+) % PV effectifs$/, (m) => `+${m[1].replace(',', '.')}% effective HP`],
  [/^PV ([^·]+) · coup ordinaire ([^·]+) · coup du boss (.+)$/, (m) => `HP ${m[1].replace(',', '.')} · normal hit ${m[2].replace(',', '.')} · boss hit ${m[3].replace(',', '.')}`],
  [/^([\d\s,.]+) att\.\/s$/, (m) => `${m[1].replace(',', '.')} att./s`],
];
