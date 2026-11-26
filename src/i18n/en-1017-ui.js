// v10.17 (parties C, D, E « tout le jeu propre et homogène ») : anglais des nouveaux textes — points de compétence à dépenser,
// « Où en trouver » des fragments, Boutique (achats bientôt disponibles), notification du Bastion. Branché à la fin de ./en.js,
// sans écraser l'existant.
export const EXACT_1017_UI = {
  // E : Compétences
  'points à dépenser': 'points to spend',
  'point à dépenser': 'point to spend',
  '(+1 par niveau du héros)': '(+1 per hero level)',
  'Points :': 'Points:',
  '0 point de compétence': '0 skill points',
  // D : Boutique
  '🔒 Achats bientôt disponibles': '🔒 Purchases coming soon',
  "Aucun paiement n'est encore possible : les prix sont affichés pour information. Tout le reste du jeu fonctionne.":
    'No payment is possible yet: prices are shown for information only. Everything else in the game works.',
  // E : Bastion
  'Ton Bastion se met au travail': 'Your Bastion gets to work',
  'Fermer': 'Close',
};

export const patterns1017Ui = () => [
  [/^(\d+) points? de compétence à dépenser$/, (m) => `${m[1]} skill point${m[1] === '1' ? '' : 's'} to spend`],
  [/^Il manque (\S+) fragments?$/, (m) => `${m[1]} more fragment${m[1] === '1' ? '' : 's'} needed`],
];
