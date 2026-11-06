// v9.2.7 : anglais de l'arbre de talents refait (états, barre de sélection, légende, aide, zoom).
// Branché à la fin de ./en.js comme ./en-926.js.
export const EXACT_927 = {
  'Achetable': 'Available',
  'Appris': 'Learned',
  'Maximum': 'Maxed',
  'Fragments insuffisants': 'Not enough fragments',
  'Donne :': 'Gives:',
  'Débloque ensuite :': 'Unlocks next:',
  "Apprenez d'abord un talent relié.": 'Learn a linked talent first.',
  'Zoomer': 'Zoom in',
  'Dézoomer': 'Zoom out',
  'Recentrer sur le talent choisi': 'Center on the selected talent',
  "Touchez un talent pour voir ce qu'il donne, puis « Apprendre » juste sous l'arbre.": 'Tap a talent to see what it gives, then “Learn” just below the tree.',
  "Un talent s'achète dès qu'un talent relié est appris ; les nœuds en pointillés sont ceux qu'il débloque ensuite.": 'A talent can be bought as soon as a linked talent is learned; dotted nodes are the ones it unlocks next.',
  'Chaque couleur est une région ; les clés de voûte (hexagones) demandent des points dans leur région.': 'Each color is a region; keystones (hexagons) need points spent in their region.',
  'Glissez pour vous déplacer, molette ou pincement pour zoomer, ◎ pour recentrer.': 'Drag to move, wheel or pinch to zoom, ◎ to recenter.',
};
export const patterns927 = (lookup) => [
  [/^Il faut (\d+) points dans (.+) \(actuellement (\d+)\)\.$/, (m) => `Needs ${m[1]} points in ${lookup(m[2]) ?? m[2]} (currently ${m[3]}).`],
];
