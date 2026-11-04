// v9.2.2 : coréen du sous-onglet Héros › Apparences (panels/looks.js, hero.js lookView). Branché à la fin de ./ko.js.
export const EXACT_922 = {
  Apparences: '외형', 'Apparence équipée': '장착한 외형', 'Équipée': '장착 중', 'Équipée ✓': '장착 중 ✓',
  'Possédée': '보유', 'Verrouillée': '잠김', 'Équiper': '장착',
};
export const patterns922 = (lookup) => [
  [/^Touchez une apparence possédée pour l'équiper\. Bonus \+(\d+) % par étoile\.$/, (m) => `보유한 외형을 눌러 장착하세요. 별마다 보너스 +${m[1]}%.`],
  [/^Équiper (.+)$/, (m) => { const w = lookup(m[1]); return w === null ? null : `${w} 장착`; }],
];
