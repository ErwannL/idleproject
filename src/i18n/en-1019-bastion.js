// v10.19 (partie 1) : anglais des ouvriers du Bastion — niveaux, bonus en clair, départ signalé, remplacement
// automatique. Branché à la fin de ./en.js, sans écraser l'existant.
export const EXACT_1019_BASTION = {
  'Remplacer automatiquement si un ouvrier part': 'Replace automatically if a worker leaves',
  'Remplacement automatique activé': 'Automatic replacement on',
  'Remplacement automatique désactivé': 'Automatic replacement off',
  'Expérience d\'ouvrier': 'Worker experience',
  'en équipe': 'in team',
  'en expédition': 'on expedition',
  'Aucun compagnon libre.': 'No free companion.',
  'commandes et chantiers plus rapides': 'faster orders and building work',
  'recherches et chantiers plus rapides': 'faster research and building work',
  'plus d\'éclats, chantiers plus rapides': 'more shards, faster building work',
  'plus de grimoires, chantiers plus rapides': 'more grimoires, faster building work',
  'plus d\'essences, chantiers plus rapides': 'more essences, faster building work',
  'chantiers plus rapides': 'faster building work',
};

const PART = { 'Métier': 'Trade', 'Rareté': 'Rarity', 'Recherche': 'Research' };
const WHY = { 'part en expédition': 'leaves on expedition', 'rejoint l\'équipe': 'joins the team', 'n\'est plus disponible': 'is no longer available' };
const GONE = { 'est parti dans ton équipe': 'has left to join your team', 'est parti en expédition': 'has left on an expedition', 'n\'est plus disponible': 'is no longer available' };

export const patterns1019Bastion = (lookup) => {
  const L = (t) => lookup(t) ?? t;
  return [
    [/^\+(\d+) % vitesse de (.+)$/, (m) => `+${m[1]}% speed for ${L(m[2])}`],
    [/^\((commandes et chantiers plus rapides|recherches et chantiers plus rapides|plus d'éclats, chantiers plus rapides|plus de grimoires, chantiers plus rapides|plus d'essences, chantiers plus rapides|chantiers plus rapides)\)$/,
      (m) => `(${EXACT_1019_BASTION[m[1]]})`],
    [/^(Métier|Rareté|Recherche) \+(\d+) %$/, (m) => `${PART[m[1]]} +${m[2]}%`],
    [/^Niveau (\d+) \+(\d+) %$/, (m) => `Level ${m[1]} +${m[2]}%`],
    [/^(\d+) XP · niveau maximal$/, (m) => `${m[1]} XP · max level`],
    [/^(.+) · Niv\. (\d+)$/, (m) => (lookup(m[1]) ? `${lookup(m[1])} · Lv. ${m[2]}` : null)],
    [/^Remplacer \((.+)\)$/, (m) => `Replace (${L(m[1])})`],
    [/^(.+) (est parti dans ton équipe|est parti en expédition|n'est plus disponible)\.$/, (m) => `${m[1] === 'Ton ouvrier' ? 'Your worker' : L(m[1])} ${GONE[m[2]]}.`],
    [/^(.+) (part en expédition|rejoint l'équipe|n'est plus disponible) et quitte (.+) : (.+) le remplace$/,
      (m) => `${m[1] === 'Ton ouvrier' ? 'Your worker' : L(m[1])} ${WHY[m[2]]} and leaves ${L(m[3])}: ${m[4] === 'un autre ouvrier' ? 'another worker' : L(m[4])} takes over`],
    [/^(.+) · (.+) · Niv\. (\d+) · \+(\d+) % de vitesse(?: \((.+)\))?(?: · (en équipe|en expédition))?$/,
      (m) => `${L(m[1])} · ${L(m[2])} · Lv. ${m[3]} · +${m[4]}% speed${m[5] ? ` (${L(m[5])})` : ''}${m[6] ? ` · ${EXACT_1019_BASTION[m[6]]}` : ''}`],
  ];
};
