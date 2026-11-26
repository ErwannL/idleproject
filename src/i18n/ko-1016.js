// v10.16 : coréen du combat de boss (« Garde brisée », compteur de combo). Branché à la fin de ./ko.js.
export const EXACT_1016 = {
  'Garde brisée !': '가드 브레이크!',
};
export const patterns1016 = () => [
  [/^Combo ×(\d+)$/, (m) => `콤보 ×${m[1]}`],
];
