// v10.4 (parties 1 et 2) : coréen des pages plein écran (Personnage, Forge) et du « gain réel » des renforts.
// Branché à la fin de ./ko.js, sans écraser l'existant.
let LK = () => null;
const t = (s) => LK(s) ?? s;
const d = (s) => String(s).replace(/(\d),(\d)/g, '$1.$2'); // virgule décimale → point
export const EXACT_1040_PAGES = {
  'Retour au combat': '전투로 돌아가기',
  'Or : améliorer': '골드: 강화',
  'Éclats : renforcer': '조각: 단련',
  'Grimoires : pour les compagnons': '마도서: 동료용',
  'Pierres d\'éveil : pour les compagnons': '각성석: 동료용',
  '✓ Le meilleur est porté': '✓ 최고 장비 착용 중',
  'Presque sans effet': '거의 효과 없음',
  'sur ta puissance : un autre objet ira mieux ici.': '(전투력 기준): 이 자리에는 다른 장비가 더 낫습니다.',
  'Presque rien dans ta puissance totale': '전체 전투력에 거의 기여하지 않음',
  'presque pareille': '거의 같음',
  'presque sans effet': '거의 효과 없음',
  'Fabriquer un meilleur objet ›': '더 좋은 장비 제작 ›',
  'Plus : changer l\'effet': '더 보기: 효과 변경',
  'Ancestral': '고대',
  'Remplies avec tes moins bons objets. Jamais pris : objet porté, protégé (cadenas), ancestral.':
    '가장 약한 장비로 채웁니다. 착용 중, 보호(자물쇠), 고대 장비는 절대 쓰지 않습니다.',
  'Celui du meilleur objet fusionné': '합성한 장비 중 가장 높은 레벨',
  'Face à ton objet porté': '착용 장비와 비교',
  'Rien d\'utile à renforcer : fusionne ou fabrique mieux.': '단련할 만한 장비가 없습니다: 합성하거나 더 좋은 장비를 제작하세요.',
};
export const patterns1040Pages = (lookup = () => null) => { LK = lookup; return [
  [/^: cet objet est d'un niveau trop bas \((\d+) → (\d+)\)\.$/, (m) => `: 장비 레벨이 너무 낮습니다 (${m[1]} → ${m[2]}).`],
  [/^Les (\d+) cases$/, (m) => `${m[1]}칸`],
  [/^×(\d+)$/, (m) => `×${m[1]}`],
  [/^(.+) : (.+) · (Commun|Rare|Épique|Légendaire|Mythique)$/, (m) => `${t(m[1])}: ${t(m[2])} · ${t(m[3])}`],
  [/^(.+) · (\d+) dans le sac$/, (m) => `${t(m[1])} · 가방에 ${m[2]}개`],
  [/^\+([\d,]+) % de puissance$/, (m) => `전투력 +${d(m[1])}%`],
]; };
