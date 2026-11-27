// v10.18 (parties 2 et 3) : anglais des nouveaux textes — touche d'attaque « en attente » (aria-label), gros lot du Carnet
// de l'Apprenti. Branché à la fin de ./en.js, sans écraser l'existant.
export const EXACT_1018 = {
  'Gros lot du jour 7 : un compagnon Épique au choix': 'Day 7 grand prize: an Epic companion of your choice',
  'Garde au moins une compétence active': 'Keep at least one active skill',
};

export const patterns1018 = (lookup) => [
  // aria-label d'une touche d'attaque gardée : « Frappe rapide : en attente »
  [/^(.+) : en attente$/, (m) => `${lookup(m[1]) ?? m[1]}: queued`],
];
