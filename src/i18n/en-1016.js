// v10.16 : anglais du combat de boss (« Garde brisée », compteur de combo). Branché à la fin de ./en.js.
export const EXACT_1016 = {
  'Garde brisée !': 'Guard broken!',
};
export const patterns1016 = () => [
  [/^Combo ×(\d+)$/, (m) => `Combo ×${m[1]}`],
];
