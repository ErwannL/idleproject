// v9.2.9 : anglais des nouveautés de la 9.2.9. Branché à la fin de ./en.js.
// Boutique dans la barre du haut ; World Boss en vrai combat animé (phases, barre, bilan).
export const EXACT_929 = {
  'Dégâts infligés': 'Damage dealt',
  'PV du boss': 'Boss HP',
  'Phase': 'Phase',
  'Meilleur score': 'Best score',
  'Dégâts du jour': 'Damage today',
  'Tentative terminée': 'Attempt over',
  'Dégâts de la tentative': 'Attempt damage',
  'Paliers de récompense': 'Reward tiers',
  "Plus de tentative aujourd'hui.": 'No attempts left today.',
  'Le boss se relève !': 'The boss rises again!',
  'Roi démoniaque ancestral': 'Ancestral Demon King',
  'Séisme infernal': 'Infernal Quake',
  'Pluie de braises': 'Ember Rain',
  'Fureur ancestrale': 'Ancestral Fury',
  'World Boss coopératif (dégâts de tous les joueurs, classement) : prochainement.': 'Co-op World Boss (damage from all players, leaderboard): coming soon.',
};
  // v9.2.9 : nouveaux familiers (noms, compétences, bannière des familiers).
  'Hérisson de cristal': 'Crystal Hedgehog',
  'Piquants de cristal': 'Crystal Quills',
  'Dragonnet de braise': 'Ember Dragonling',
  'Souffle de braise': 'Ember Breath',
  'Tortue de jade': 'Jade Turtle',
  'Carapace de jade': 'Jade Shell',
  'Renard céleste': 'Celestial Fox',
  'Feux de renard': 'Foxfire',
  'Petit phénix': 'Phoenix Chick',
  'Plume ardente': 'Blazing Feather',
  'Brasier draconique': 'Draconic Blaze',
  'Sanctuaire de jade': 'Jade Sanctuary',
  'Neuf queues': 'Nine Tails',
  'familiers SSR dans le bassin': 'SSR pets in the pool',
export const patterns929 = () => [
  [/^Combat de (\d+) s avec toute l'équipe\. Phases à 75, 50 et 25 % des PV\.$/, (m) => `${m[1]} s fight with the whole team. Phases at 75, 50 and 25% HP.`],
  [/^World Boss : (.+) dégâts$/, (m) => `World Boss: ${m[1].replace(',', '.')} damage`],
];
  // v9.2.9 : textes chiffrés des nouveaux familiers.
  [/^Projette ses piquants sur tous les ennemis \((\d+) % des dégâts\)$/, (m) => `Fires its quills at all enemies (${m[1]}% of damage)`],
  [/^Crache une flamme à (\d+) % des dégâts du héros$/, (m) => `Spits a flame for ${m[1]}% of the hero's damage`],
  [/^Lance des feux de renard sur tous les ennemis \((\d+) % des dégâts\)$/, (m) => `Hurls foxfire at all enemies (${m[1]}% of damage)`],
