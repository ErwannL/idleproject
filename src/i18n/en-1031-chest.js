// v10.3.1 (plan 10.2, partie 7) : anglais des textes du coffre de butin dessiné dans la scène (libellé accessible de la
// zone de toucher). Branché à la fin de ./en.js.
// (« Butin ! », « Butin ! Touche le coffre pour trier » et « Coffre plein : trie-le », dessinés dans la scène : ./en-971.js.)
export const EXACT_1031_CHEST = {};
export const patterns1031Chest = () => [
  [/^Coffre de butin : (\d+) objets?( \(amélioration\))?$/, (m) => `Loot chest: ${m[1]} item${m[1] === '1' ? '' : 's'}${m[2] ? ' (upgrade)' : ''}`],
];
