// v9.2.5 : anglais de la vitrine d'invocation et de « Tout récupérer » qui dit où (sections, pastilles).
// Branché à la fin de ./en.js comme ./en-923.js.
export const EXACT_925 = {
  "Missions › Aujourd'hui › Connexion": 'Missions › Today › Login',
  "Missions › Aujourd'hui › Journalières": 'Missions › Today › Daily',
  "Missions › Aujourd'hui › Contrats": 'Missions › Today › Contracts',
  "Missions › Aujourd'hui › Prime du jour": 'Missions › Today › Daily bounty',
  "Missions › Aujourd'hui › Trouvailles": 'Missions › Today › Finds',
  'Missions › Piste du mois': 'Missions › Monthly track',
  'Missions › Hauts faits': 'Missions › Achievements',
  'Sera récupéré :': 'Will be claimed:',
  'Voir ce qui sera récupéré': 'See what will be claimed',
  'Trouvailles': 'Finds',
  '+ un objet': '+ an item',
  '✦ En vedette · taux augmenté ✦': '✦ Featured · rate up ✦',
  'obtenu': 'owned',
};
export const patterns925 = () => [
  [/^Sera récupéré \((\d+)\)$/, (m) => `Will be claimed (${m[1]})`],
  [/^(\d+) à récupérer$/, (m) => `${m[1]} to claim`],
  [/^Récupérer \+(\d+)$/, (m) => `Claim +${m[1]}`],
  [/^Légendaire garanti dans (\d+)$/, (m) => `Legendary guaranteed in ${m[1]}`],
  [/^Épique dans (\d+)$/, (m) => `Epic in ${m[1]}`],
  [/^par tirage \(×([\d.,]+)\) · (\d+) % des Légendaires$/, (m) => `per pull (×${m[1]}) · ${m[2]}% of Legendaries`],
];
