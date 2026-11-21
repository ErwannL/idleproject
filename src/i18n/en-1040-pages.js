// v10.4 (parties 1 et 2) : anglais des pages plein écran (Personnage, Forge) et du « gain réel » des renforts.
// Branché à la fin de ./en.js, sans écraser l'existant.
let LK = () => null;
const t = (s) => LK(s) ?? s;
const d = (s) => String(s).replace(/(\d),(\d)/g, '$1.$2'); // virgule décimale → point
export const EXACT_1040_PAGES = {
  'Retour au combat': 'Back to the fight',
  'Or : améliorer': 'Gold: upgrades',
  'Éclats : renforcer': 'Shards: reinforcing',
  'Grimoires : pour les compagnons': 'Grimoires: for companions',
  'Pierres d\'éveil : pour les compagnons': 'Awakening stones: for companions',
  '✓ Le meilleur est porté': '✓ Best gear equipped',
  'Presque sans effet': 'Almost no effect',
  'sur ta puissance : un autre objet ira mieux ici.': 'on your power: another item will do better here.',
  'Presque rien dans ta puissance totale': 'Almost nothing of your total power',
  'presque pareille': 'almost the same',
  'presque sans effet': 'almost no effect',
  'Fabriquer un meilleur objet ›': 'Craft a better item ›',
  'Plus : changer l\'effet, remettre au niveau': 'More: change the effect, bring up to level',
  'Ancestral': 'Ancestral',
  'Remplies avec tes moins bons objets. Jamais pris : objet porté, protégé (cadenas), ancestral.':
    'Filled with your weakest items. Never taken: equipped, protected (padlock) or ancestral items.',
  'Celui du meilleur objet fusionné': 'That of the best fused item',
  'Face à ton objet porté': 'Against your equipped item',
  'Rien d\'utile à renforcer : fusionne ou fabrique mieux.': 'Nothing worth reinforcing: fuse or craft something better.',
};
export const patterns1040Pages = (lookup = () => null) => { LK = lookup; return [
  [/^: cet objet est d'un niveau trop bas \((\d+) → (\d+)\)\.$/, (m) => `: this item's level is too low (${m[1]} → ${m[2]}).`],
  [/^Remettre au niveau : (.+) niv\. (\d+) → (\d+)$/, (m) => `Bring up to level: ${t(m[1])} lv. ${m[2]} → ${m[3]}`],
  [/^Les (\d+) cases$/, (m) => `The ${m[1]} slots`],
  [/^×(\d+)$/, (m) => `×${m[1]}`],
  [/^(.+) : (.+) · (Commun|Rare|Épique|Légendaire|Mythique)$/, (m) => `${t(m[1])}: ${t(m[2])} · ${t(m[3])}`],
  [/^(.+) · (\d+) dans le sac$/, (m) => `${t(m[1])} · ${m[2]} in the bag`],
  [/^\+([\d,]+) % de puissance$/, (m) => `+${d(m[1])}% power`],
]; };
