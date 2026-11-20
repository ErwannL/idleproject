// v10.3 (partie 10) : le Bastion — bâtiments, ouvriers, recherches et forgeron. Tout l'équilibrage du Bastion est ici
// (core/bastion.js lit ces tables). Pas de nouvelle monnaie : or, éclats et temps.
export const BASTION_UNLOCK_STAGE = 40;

// Forge du forgeron : ce que chaque niveau change dans la Forge (core/forge.js lit `forgePerks`).
export const FORGE_PERKS = {
  fusionPointsPerLevel: 5, // chance de fusion à 3 ou 4 objets : +5 points par niveau
  fusionCap: 95, // plafond des mises courtes (la mise de 5 reste à 100 %)
  // Renforcement maximal : +1 par niveau (10 → 11 → 12…). Le cahier des charges proposait +2 (« indicatif ») : la
  // simulation (tools/sim-bastion.mjs) mesure qu'un niveau à +2 vaut à lui seul jusqu'à +11 % de puissance — la Forge
  // offerte et un seul chantier dépassaient déjà la borne de +25 % en 7 jours. À +1, un niveau vaut +2 à +5 %.
  maxUpgradePerLevel: 1,
  upgradeCostPctPerLevel: 2, // coût des renforcements : −2 % par niveau
  upgradeCostPctCap: 30,
  orderSlotsAt: [1, 4, 7], // niveaux où s'ouvre la 1re, 2e et 3e commande simultanée
  orderCostPctPerLevel: 10, // commande : −10 % du coût de « Fabriquer » par niveau
  orderCostPctCap: 50,
  legendaryOrderLevel: 6, // commande Légendaire+ à partir de ce niveau
};

export const BASTION_MAX_LEVEL = 10;

// Métiers des ouvriers (data/companions.js : champ `trade`) : +20 % de vitesse dans le bâtiment du métier.
export const TRADES = {
  smith: { label: 'Forgeron', building: 'forge' },
  scholar: { label: 'Savant', building: 'library' },
  miner: { label: 'Mineur', building: 'mine' },
  trainer: { label: 'Entraîneur', building: 'training' },
  merchant: { label: 'Marchand', building: 'trade' },
};
export const WORKER_RULES = {
  tradeBonusPct: 20, // le bon métier au bon bâtiment
  rarityBonusPct: { common: 5, rare: 5, epic: 10, legendary: 20 },
  idlePct: 50, // sans ouvrier : production à 50 %, aucun chantier
  slotsAt: [0, 0, 4, 8], // niveau du Bastion (somme des niveaux) qui ouvre la 1re, 2e, 3e et 4e place d'ouvrier
};

// Bâtiments, dans l'ordre d'arrivée (un seul à l'ouverture, puis un par un). `stage` : étape record demandée ;
// `bastionLevel` : niveau du Bastion demandé ; `existing` : écran déjà dans le jeu (pas de niveau, pas d'ouvrier).
// `goldKills` : coût en or propre au bâtiment (sinon celui de BUILD_STEPS), indice = niveau actuel.
// La Forge du forgeron est de loin la plus chère : chaque niveau relève le renforcement maximal de tous les objets
// (+2 à +5 % de puissance par niveau, mesuré par tools/sim-bastion.mjs). Un joueur gagne 25 000 à 100 000 « ennemis »
// d'or entre deux connexions : le niveau 2 se paie en une connexion, le niveau 3 demande d'économiser. C'est ce prix
// qui tient la borne « au plus +25 % de puissance en 7 jours ».
export const BUILDINGS = [
  { id: 'forge', name: 'Forge du forgeron', stage: 40, trade: 'smith', startLevel: 1, art: 'forge', tool: 'hammer', shards: 1.5,
    goldKills: [0, 40_000, 250_000, 500_000, 800_000, 1_200_000, 1_700_000, 2_300_000, 3_000_000, 3_800_000],
    role: 'Améliore les chiffres de la Forge et forge des objets sur commande.' },
  { id: 'library', name: 'Bibliothèque', stage: 55, trade: 'scholar', art: 'library', tool: 'book', shards: 1,
    role: 'Mène les recherches : des bonus gardés après une Renaissance.' },
  { id: 'mine', name: 'Mine de cristal', stage: 70, trade: 'miner', art: 'mine', tool: 'pick', shards: 0.8,
    role: 'Produit des éclats au fil du temps, même jeu fermé.' },
  { id: 'training', name: 'Camp d\'entraînement', stage: 85, trade: 'trainer', art: 'training', tool: 'sword', shards: 0.8,
    role: 'Les remplaçants s\'entraînent : des grimoires au fil du temps.' },
  { id: 'expeditions', name: 'Expéditions', existing: true, art: 'expeditions',
    role: 'Les compagnons libres partent chercher des ressources.' },
  { id: 'trade', name: 'Comptoir', bastionLevel: 5, trade: 'merchant', art: 'trade', tool: 'coin', shards: 1,
    role: 'Échange tes matériaux : éclats, grimoires, pierres et essences.' },
];

// Chantier du niveau L vers L + 1 (indice = niveau actuel) : 15 min au niveau 1, puis jusqu'à 8 h.
// Coût en or = goldKills × l'or d'un ennemi de l'étape max (au moins l'étape 40) × le multiplicateur de Renaissance :
// le prix suit les revenus du joueur, débutant comme vétéran. Éclats × le facteur `shards` du bâtiment.
export const BUILD_STEPS = [
  { minutes: 15, goldKills: 300, shards: 40 },
  { minutes: 30, goldKills: 1_000, shards: 150 },
  { minutes: 60, goldKills: 3_000, shards: 300 },
  { minutes: 120, goldKills: 6_000, shards: 500 },
  { minutes: 180, goldKills: 12_000, shards: 800 },
  { minutes: 240, goldKills: 25_000, shards: 1200 },
  { minutes: 300, goldKills: 45_000, shards: 1700 },
  { minutes: 360, goldKills: 70_000, shards: 2300 },
  { minutes: 420, goldKills: 100_000, shards: 3000 },
  { minutes: 480, goldKills: 140_000, shards: 4000 },
];

// Mine de cristal : éclats par heure (calé sur le recyclage : un Rare = 3 éclats) et stock de 6 à 12 h.
export const MINE = { basePerHour: 5, perLevel: 5, capHours: [6, 12] };
// Camp d'entraînement : grimoires par heure (les missions du jour en donnent 6), stock de 6 à 12 h.
export const TRAINING = { basePerHour: 0.15, perLevel: 0.05, capHours: [6, 12] };
// Bibliothèque : une recherche à la fois (deux au niveau 6), durée −5 % par niveau au-delà du premier.
export const LIBRARY = { durationPctPerLevel: 5, secondSlotLevel: 6 };

// Comptoir : échanges de matériaux. Le taux s'améliore de 4 % par niveau au-delà du premier ; nombre d'échanges par jour.
export const TRADE_POST = {
  ratePctPerLevel: 4,
  perDay: { base: 6, perLevel: 2 },
  offers: [
    { id: 'buy-grimoire', give: 'shards', get: 'grimoire', price: 40 },
    { id: 'buy-ascension', give: 'shards', get: 'ascension', price: 80 },
    { id: 'buy-mastery', give: 'shards', get: 'mastery', price: 200 },
    { id: 'sell-grimoire', give: 'grimoire', get: 'shards', price: 10, sell: true },
    { id: 'sell-ascension', give: 'ascension', get: 'shards', price: 20, sell: true },
    { id: 'sell-mastery', give: 'mastery', get: 'shards', price: 50, sell: true },
  ],
};

// Commandes du forgeron : rareté minimale, durée (1 h à 8 h) et coût de « Fabriquer » (craftCost) réduit par la Forge.
// `weights` : chances de rareté du résultat (la commande peut donner mieux que « Fabriquer »).
export const ORDER_TIERS = [
  { id: 'rare', label: 'Rare+', minRarity: 'rare', hours: 1, craft: 'rare', costFactor: 1, weights: { rare: 60, epic: 34, legendary: 6 } },
  { id: 'epic', label: 'Épique+', minRarity: 'epic', hours: 4, craft: 'epic', costFactor: 1, weights: { epic: 75, legendary: 25 } },
  { id: 'legendary', label: 'Légendaire+', minRarity: 'legendary', hours: 8, craft: 'epic', costFactor: 8, weights: { legendary: 100 }, forgeLevel: FORGE_PERKS.legendaryOrderLevel },
];

// Recherches : 3 branches de 6, débloquées dans l'ordre (la suivante s'ouvre quand la précédente atteint le niveau 3).
// `effect` : valeur par niveau. Plafonds du total (testés) : +60 % de dégâts, +60 % de vie, +50 % d'or.
export const RESEARCH_UNLOCK_LEVEL = 3;
export const RESEARCH_BRANCHES = [
  { id: 'combat', name: 'Combat', icon: 'icon_damage' },
  { id: 'team', name: 'Compagnons', icon: 'tab_companions' },
  { id: 'economy', name: 'Économie', icon: 'coin' },
];
export const RESEARCH = [
  { id: 'sharp', branch: 'combat', name: 'Lames aiguisées', max: 15, effect: { damagePct: 2 }, text: '+2 % de dégâts' },
  { id: 'steel', branch: 'combat', name: 'Peau d\'acier', max: 15, effect: { maxHpPct: 2 }, text: '+2 % de vie' },
  { id: 'fatal', branch: 'combat', name: 'Coup fatal', max: 5, effect: { critChance: 1 }, text: '+1 % de chance de critique' },
  { id: 'guard', branch: 'combat', name: 'Garde haute', max: 5, effect: { armor: 1 }, text: '+1 % d\'armure' },
  { id: 'breath', branch: 'combat', name: 'Second souffle', max: 5, effect: { regenPct: 0.1 }, text: '+0,1 % de vie rendue par seconde' },
  { id: 'war', branch: 'combat', name: 'Art de la guerre', max: 12, effect: { damagePct: 2, maxHpPct: 2 }, text: '+2 % de dégâts et de vie' },
  { id: 'spirit', branch: 'team', name: 'Esprit d\'équipe', max: 10, effect: { companionPowerPct: 2 }, text: '+2 % de puissance des compagnons' },
  { id: 'recall', branch: 'team', name: 'Rappel rapide', max: 10, effect: { companionCdPct: 1 }, text: '−1 % de recharge des sorts des compagnons' },
  { id: 'bond', branch: 'team', name: 'Lien renforcé', max: 5, effect: { bondPct: 10 }, text: '+10 % aux bonus des liens' },
  { id: 'drill', branch: 'team', name: 'Entraînement commun', max: 10, effect: { companionCostPct: 2 }, text: '−2 % sur le coût des niveaux de compagnon' },
  { id: 'scouts', branch: 'team', name: 'Éclaireurs', max: 10, effect: { expeditionPct: 3 }, text: '+3 % de butin d\'expédition' },
  { id: 'crew', branch: 'team', name: 'Ouvriers appliqués', max: 10, effect: { workerPct: 2 }, text: '+2 % de vitesse des ouvriers' },
  { id: 'purse', branch: 'economy', name: 'Bourse pleine', max: 10, effect: { goldPct: 3 }, text: '+3 % d\'or' },
  { id: 'vigil', branch: 'economy', name: 'Longue veille', max: 6, effect: { offlineHours: 1 }, text: '+1 h de gains hors ligne' },
  { id: 'hunter', branch: 'economy', name: 'Œil du chasseur', max: 5, effect: { rareLootPct: 2 }, text: '+2 % de butin Épique et Légendaire' },
  { id: 'roads', branch: 'economy', name: 'Routes marchandes', max: 10, effect: { goldPct: 2 }, text: '+2 % d\'or' },
  { id: 'vein', branch: 'economy', name: 'Filon riche', max: 6, effect: { minePct: 5 }, text: '+5 % de production de la Mine' },
  { id: 'lessons', branch: 'economy', name: 'Leçons du passé', max: 10, effect: { xpPct: 3 }, text: '+3 % d\'expérience' },
];
// Durée du niveau n (1, 2, 3…) en minutes : 10 min → 6 h ; chaque rang de la branche allonge de 30 % (plafond 6 h).
// Coût du niveau n : or = goldKills × n^1,5 × rang (même unité que les chantiers), éclats = shards × n^1,5 × rang
// (rang = 1 + 0,5 × position dans la branche). Les premiers niveaux se paient en une connexion ; à partir du niveau 5
// (112 000 « ennemis » d'or pour « Lames aiguisées »), il faut économiser.
export const RESEARCH_STEPS = {
  minutes: [10, 30, 60, 120, 180, 240, 300, 360],
  maxMinutes: 360,
  tierTimePct: 30,
  goldKills: 10_000,
  shards: 30,
  tierCostPct: 50,
};
