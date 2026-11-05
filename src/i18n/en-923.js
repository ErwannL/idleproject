// v9.2.3 : anglais des ennemis mutés lisibles (render/mutation-fx.js, fiche Collections › Mutations).
// Branché à la fin de ./en.js comme ./en-922.js.
export const EXACT_923 = {
  // v9.2.3 : apparence des mutations (taille, couleurs, cape…).
  'Plus petit, vert et translucide, sa membrane ondule. À sa mort, il se fend en deux petits doubles (40 % de ses PV chacun) et « Se divise ! » s\'affiche : ce n\'est pas un bug.': 'Smaller, green and translucent, its membrane ripples. When it dies, it splits into two small copies (40% of its HP each) and "Splits!" appears: this is not a bug.',
  'Une lueur verte pulse autour de lui et des feuilles tombent. Des chiffres verts montrent les PV qu\'il regagne.': 'A green glow pulses around it and leaves fall. Green numbers show the HP it regains.',
  'Couvert de plaques d\'acier qui brillent. « Bloqué » s\'affiche quand sa cuirasse absorbe un coup (tant qu\'il a plus de la moitié de ses PV).': 'Covered in shining steel plates. "Blocked" appears when its armour absorbs a hit (while it is above half HP).',
  'Teinté de rouge, les yeux brillants, il fume et bouge plus vite ; son aura pulse et des braises jaillissent de lui.': 'Tinted red with glowing eyes, it steams and moves faster; its aura pulses and embers burst from it.',
  'Pâle et violet, drapé d\'une cape d\'ombre. Un filet rouge relie le chevalier au monstre quand il vole de la vie.': 'Pale and violet, wrapped in a shadow cloak. A red stream links the knight to the monster when it steals life.',
  'Une fois et demie plus grand que ses semblables, contour doré ; le sol tremble à chacun de ses pas lourds.': 'One and a half times bigger than its kin, with a golden outline; the ground shakes with each heavy step.',
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
