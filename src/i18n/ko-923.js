// v9.2.3 : coréen des ennemis mutés lisibles (render/mutation-fx.js, fiche Collections › Mutations).
// Branché à la fin de ./ko.js comme ./ko-922.js.
export const EXACT_923 = {
  'Se divise !': '분열!', 'Bloqué': '막힘', 'En combat :': '전투 중:',
  'étiquette de sa couleur au-dessus de sa barre de vie, contour de la même couleur.': 'HP 바 위에 같은 색 표시가 뜨고, 같은 색 윤곽선이 둘러요.',
  'À sa mort, il se fend en deux petits doubles (40 % de ses PV chacun) et « Se divise ! » s\'affiche : ce n\'est pas un bug.': '죽으면 작은 분신 둘(각각 HP 40%)로 갈라지고 「분열!」이 표시돼요. 버그가 아니에요.',
  'Des chiffres verts montrent les PV qu\'il regagne.': '초록색 숫자로 회복한 HP가 표시돼요.',
  '« Bloqué » s\'affiche quand sa cuirasse absorbe un coup (tant qu\'il a plus de la moitié de ses PV).': '갑옷이 공격을 흡수하면 「막힘」이 표시돼요(HP가 절반 이상일 때).',
  'Son aura rouge pulse vite et des braises jaillissent de lui.': '붉은 오라가 빠르게 맥동하고 불씨가 튀어요.',
  'Un trait rouge relie le chevalier au monstre quand il vole de la vie.': '생명력을 훔칠 때 기사와 몬스터를 붉은 선이 이어요.',
  'Contour doré plus épais ; il avance lentement.': '더 두꺼운 금색 윤곽선, 느리게 다가와요.',
};
export const patterns923 = (lookup) => [
  [/^Mutation : (.+)$/, (m) => { const w = lookup(m[1]); return w === null ? null : `변이: ${w}`; }],
];
