// v9.2.3 : anglais des ennemis mutés lisibles (render/mutation-fx.js, fiche Collections › Mutations).
// Branché à la fin de ./en.js comme ./en-922.js.
export const EXACT_923 = {
  'Se divise !': 'Splits!', 'Bloqué': 'Blocked', 'En combat :': 'In combat:',
  'étiquette de sa couleur au-dessus de sa barre de vie, contour de la même couleur.': 'a tag in its colour above its health bar, and an outline of the same colour.',
  'À sa mort, il se fend en deux petits doubles (40 % de ses PV chacun) et « Se divise ! » s\'affiche : ce n\'est pas un bug.': 'When it dies, it splits into two small copies (40% of its HP each) and "Splits!" appears: this is not a bug.',
  'Des chiffres verts montrent les PV qu\'il regagne.': 'Green numbers show the HP it regains.',
  '« Bloqué » s\'affiche quand sa cuirasse absorbe un coup (tant qu\'il a plus de la moitié de ses PV).': '"Blocked" appears when its armour absorbs a hit (while it is above half HP).',
  'Son aura rouge pulse vite et des braises jaillissent de lui.': 'Its red aura pulses fast and embers burst from it.',
  'Un trait rouge relie le chevalier au monstre quand il vole de la vie.': 'A red line links the knight to the monster when it steals life.',
  'Contour doré plus épais ; il avance lentement.': 'Thicker golden outline; it moves slowly.',
};
export const patterns923 = (lookup) => [
  [/^Mutation : (.+)$/, (m) => { const w = lookup(m[1]); return w === null ? null : `Mutation: ${w}`; }],
];
