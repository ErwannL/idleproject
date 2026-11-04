// v9.2.2 : anglais du sous-onglet Héros › Apparences (panels/looks.js, hero.js lookView).
// Branché à la fin de ./en.js comme ./en-921.js.
export const EXACT_922 = {
  Apparences: 'Looks', 'Apparence équipée': 'Equipped look', 'Équipée': 'Equipped', 'Équipée ✓': 'Equipped ✓',
  'Possédée': 'Owned', 'Verrouillée': 'Locked', 'Équiper': 'Equip',
};
export const patterns922 = (lookup) => [
  [/^Touchez une apparence possédée pour l'équiper\. Bonus \+(\d+) % par étoile\.$/, (m) => `Tap an owned look to equip it. Bonus +${m[1]}% per star.`],
  [/^Équiper (.+)$/, (m) => { const w = lookup(m[1]); return w === null ? null : `Equip ${w}`; }],
];
