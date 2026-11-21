// v10.3.1 (plan 10.2, partie 7) : coréen des textes du coffre de butin dessiné dans la scène (libellé accessible de la
// zone de toucher). Branché à la fin de ./ko.js.
// (« Butin ! », « Butin ! Touche le coffre pour trier » et « Coffre plein : trie-le », dessinés dans la scène : ./ko-971.js.)
export const EXACT_1031_CHEST = {};
export const patterns1031Chest = () => [
  [/^Coffre de butin : (\d+) objets?( \(amélioration\))?$/, (m) => `전리품 상자: 아이템 ${m[1]}개${m[2] ? ' (강화 가능)' : ''}`],
];
