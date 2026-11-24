// v10.13 (lot 5) : anglais de Héros › Talents (PC) et Renaissance (PC). Branché à la fin de ./en.js, sans écraser l'existant.
let LK = () => null;
const t = (s) => LK(s) ?? s;
export const EXACT_1013_TALENTS = {
  'Prochain talent': 'Next talent',
  'Gros palier': 'Big milestone',
  'Ce que tes talents te donnent déjà': 'What your talents already give you',
  'Ce que tu gagnes': 'What you gain',
  'Ce qui se passe': 'What happens',
  'Puissance avant': 'Power before',
  'Après': 'After',
  'Rentable maintenant': 'Worth it now',
  'tu bloques depuis 8 h et le gain dépasse ×1,25': 'you have been stuck for 8 h and the gain is above ×1.25',
  '· tu bloques depuis 8 h et le gain dépasse ×1,25': '· you have been stuck for 8 h and the gain is above ×1.25',
  'Rentable quand elle donne au moins ×1,25 et que tu bloques depuis 8 h de jeu': 'Worth it when it gives at least ×1.25 and you have been stuck for 8 h of play',
  'Arbre complet · après 3 Renaissances': 'Full tree · after 3 Rebirths',
  'pouvoir gardé': 'power kept',
  'expérience': 'experience',
  'Actuel': 'Current',
  'Niveau maximum ✓': 'Max level ✓',
  'Max': 'Max',
  'Fragments :': 'Fragments:',
  'Autres branches': 'Other branches',
};
export const patterns1013Talents = (lookup = () => null) => { LK = lookup; return [
  [/^Apprendre le meilleur \(([\d\s.,  ]+) fragments?\)$/, (m) => `Learn the best (${m[1]} fragment${m[1].trim() === '1' ? '' : 's'})`],
  [/^Voir l'arbre complet \((\d+) autres branches\) ›$/, (m) => `See the full tree (${m[1]} other branches) ›`],
  [/^\+10 étapes : \+(.+)$/, (m) => `+10 stages: +${m[1]}`],
  [/^(.+) fragments? à dépenser$/, (m) => `${m[1]} fragments to spend`],
  [/^(.+) points? · (\d+)\/(\d+) appris$/, (m) => `${m[1]} point${m[1] === '1' ? '' : 's'} · ${m[2]}/${m[3]} learned`],
  [/^Conseillé : (.+)$/, (m) => `Suggested: ${t(m[1])}`],
  [/^↺ Retour à l'étape 1(?: · (\d+) % des améliorations gardés)?$/, (m) => `↺ Back to stage 1${m[1] ? ` · ${m[1]}% of upgrades kept` : ''}`],
  [/^⏱ Retour à (.+) en ≈ (.+)$/, (m) => `⏱ Back to ${m[1]} in ≈ ${m[2]}`],
  [/^Région (.+)$/, (m) => `Region ${t(m[1])}`],
]; };
