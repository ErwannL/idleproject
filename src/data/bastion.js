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
  { id: 'forge', name: 'Forge du forgeron', the: 'la Forge du forgeron', stage: 40, trade: 'smith', startLevel: 1, art: 'forge', tool: 'hammer', shards: 1.5,
    goldKills: [0, 40_000, 250_000, 500_000, 800_000, 1_200_000, 1_700_000, 2_300_000, 3_000_000, 3_800_000],
    role: 'Améliore les chiffres de la Forge et forge des objets sur commande.' },
  { id: 'library', name: 'Bibliothèque', the: 'la Bibliothèque', stage: 55, trade: 'scholar', art: 'library', tool: 'book', shards: 1,
    role: 'Mène les recherches : des bonus gardés après les Renaissances.' },
  { id: 'mine', name: 'Mine de cristal', the: 'la Mine de cristal', stage: 70, trade: 'miner', art: 'mine', tool: 'pick', shards: 0.8,
    role: 'Produit des éclats au fil du temps, même jeu fermé.' },
  { id: 'training', name: 'Camp d\'entraînement', the: 'le Camp d\'entraînement', stage: 85, trade: 'trainer', art: 'training', tool: 'sword', shards: 0.8,
    role: 'Les remplaçants s\'entraînent : des grimoires au fil du temps.' },
  { id: 'expeditions', name: 'Expéditions', the: 'les Expéditions', existing: true, art: 'expeditions',
    role: 'Les compagnons libres partent chercher des ressources.' },
  { id: 'trade', name: 'Comptoir', the: 'le Comptoir', bastionLevel: 5, trade: 'merchant', art: 'trade', tool: 'coin', shards: 1,
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

// Mine de cristal : éclats par heure et stock de 6 à 12 h. Calée sur le recyclage d'un objet de l'étape max
// (BALANCE.materials.shards : Épique 18, Légendaire 50) et sur les Expéditions (15 éclats/h × puissance du compagnon,
// soit 15 à 60/h par compagnon envoyé) : 25/h au niveau 1 (un objet Épique recyclé par heure), 115/h au niveau 10
// (de quoi payer un renfort par jour). Avant (10.3.0) : 5 + 5 par niveau, soit 10 à 55/h — moins qu'un seul compagnon
// en expédition. Le prix des chantiers (jusqu'à 4 000 éclats) et la borne « +25 % en 7 jours » ne bougent pas :
// la mine rend le Bastion moins gourmand, elle ne rend pas le joueur plus fort (voir tools/sim-bastion.mjs).
export const MINE = { basePerHour: 15, perLevel: 10, capHours: [6, 12] };
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

// ---------------------------------------------------------------- v10.8 (parties 4 et 5) : les Âges du Bastion
// Chaque âge relève le niveau maximal de 10, ajoute des bâtiments, une place d'ouvrier et un palier de recherches.
// `stage` : étape record qui l'ouvre (monde 6 = étape 101, monde 9 = 161, monde 12 = 211) ; l'Âge V (saison) demande
// aussi un Bastion de niveau `bastionLevel`. `minutes` : durée des chantiers du premier au dernier niveau de l'âge.
export const AGES = [
  { id: 1, roman: 'I', name: 'Le Fort', stage: 40, maxLevel: 10, minutes: [15, 480], color: '#7ee07e' },
  { id: 2, roman: 'II', name: 'La Citadelle', stage: 101, maxLevel: 20, minutes: [480, 960], color: '#ffd25e' },
  { id: 3, roman: 'III', name: 'La Cité haute', stage: 161, maxLevel: 30, minutes: [960, 1440], color: '#ff7ab0' },
  { id: 4, roman: 'IV', name: 'La Couronne', stage: 211, maxLevel: 40, minutes: [1440, 2160], color: '#6fd6ff' },
  { id: 5, roman: 'V', name: 'La Merveille', stage: 211, bastionLevel: 240, maxLevel: 50, minutes: [2160, 2880], color: '#c8a6ff', season: true },
];
// Au-delà du niveau 10 : coût ×1,35 en or et ×1,15 en éclats par niveau (le prix suit l'or du joueur, comme avant).
export const AGE_STEPS = { goldKills: 140_000, goldGrowth: 1.35, shards: 4000, shardsGrowth: 1.15 };
// Ce que chaque niveau au-delà du 10e apporte (multiplicatif) : ×1,02 dégâts et vie par niveau, tous bâtiments confondus.
export const AGE_POWER = { perLevelPct: 2 };
// Bâtiments des âges (ajoutés à BUILDINGS) : rôle, métier, et l'effet de chaque niveau.
export const AGE_BUILDINGS = [
  { id: 'enchant', name: 'Atelier d\'enchantement', the: 'l\'Atelier d\'enchantement', age: 2, trade: 'smith', art: 'enchant', tool: 'hammer', shards: 1.2,
    role: 'Relance un effet d\'objet moins cher et grave un effet de plus sur les objets Mythiques et au-delà.', effect: { rerollCostPct: 3 } },
  { id: 'menagerie', name: 'Ménagerie', the: 'la Ménagerie', age: 2, trade: 'trainer', art: 'menagerie', tool: 'sword', shards: 1,
    role: 'Tes familiers y travaillent : des essences de maîtrise au fil du temps.', effect: { essencePerHour: 0.08 } },
  { id: 'observatory', name: 'Observatoire', the: 'l\'Observatoire', age: 3, trade: 'scholar', art: 'observatory', tool: 'book', shards: 1,
    role: 'Une Prime du Héraut de plus par jour, et la prochaine Faille annoncée.', effect: { bountyPerDay: 1 } },
  { id: 'runes', name: 'Sanctuaire des runes', the: 'le Sanctuaire des runes', age: 3, trade: 'scholar', art: 'runes', tool: 'book', shards: 1.2,
    role: 'Grave des runes sur tes compagnons : +3 % de leur puissance par niveau.', effect: { companionPowerPct: 3 } },
  { id: 'ascension', name: 'Atelier d\'Ascension', the: 'l\'Atelier d\'Ascension', age: 4, trade: 'smith', art: 'ascension', tool: 'hammer', shards: 1.5,
    role: '3 objets Astraux de même place et une Larme d\'Ascendrya : un objet Ascendant.', effect: {} },
  { id: 'wonder', name: 'Merveille de saison', the: 'la Merveille de saison', age: 5, trade: 'merchant', art: 'wonder', tool: 'coin', shards: 2,
    role: 'Un bâtiment unique qui change à chaque saison : or et expérience.', effect: { goldPct: 5, xpPct: 5 } },
];
for (const b of AGE_BUILDINGS) BUILDINGS.push(b);
// Places d'ouvrier : une de plus par âge atteint.
export const AGE_WORKER_SLOTS = 1;
// Atelier d'Ascension : recette d'un objet Ascendant.
export const ASCENSION_RECIPE = { astral: 3, tears: 1, gold: 2_000_000 };

// Recherches des paliers II à V : 6 nœuds par branche et par palier, aux effets multiplicatifs (×(1 + x %) par niveau).
// Palier II : âge II ; III : âge III (+ 6 nœuds clés) ; IV : âge IV ; V : âge V. 3e place de recherche à l'âge III,
// 4e à l'âge IV. Durées : jusqu'à 12 h (palier II) et 24 h (palier V).
export const RESEARCH_TIER_NODES = {
  combat: [
    ['fury', 'Fureur', { damageMult: 2 }, '×1,02 dégâts par niveau'],
    ['bulwark', 'Rempart', { hpMult: 2 }, '×1,02 vie par niveau'],
    ['riftbane', 'Fléau des Failles', { riftBossPct: 5 }, '+5 % de dégâts aux boss des Failles'],
    ['mythforge', 'Forge mythique', { mythicChancePct: 10 }, '+10 % de chances de Mythique'],
    ['critedge', 'Tranchant', { critDamagePct: 5 }, '+5 % de dégâts critiques'],
    ['living', 'Bastion vivant', { damageMult: 1, hpMult: 1 }, '×1,01 dégâts et vie par niveau'],
  ],
  team: [
    ['pack', 'Meute', { companionMult: 2 }, '×1,02 puissance des compagnons'],
    ['essence', 'Essences', { essencePct: 10 }, '+10 % d\'essences de la Ménagerie'],
    ['runecraft', 'Runes gravées', { companionPowerPct: 3 }, '+3 % de puissance des compagnons'],
    ['swift', 'Pas rapides', { companionCdPct: 1 }, '−1 % de recharge des sorts des compagnons'],
    ['mentor', 'Mentors', { companionCostPct: 2 }, '−2 % sur le coût des niveaux de compagnon'],
    ['workers', 'Maîtres d\'œuvre', { workerPct: 3 }, '+3 % de vitesse des ouvriers'],
  ],
  economy: [
    ['treasury', 'Trésor', { goldMult: 2 }, '×1,02 or par niveau'],
    ['alchemy', 'Alchimie', { rerollCostPct: 3 }, '−3 % sur le coût des relances d\'effet'],
    ['dreams', 'Rêves', { offlineHours: 0.5 }, '+30 min de gains hors ligne'],
    ['caravan', 'Caravanes', { expeditionPct: 4 }, '+4 % de butin d\'expédition'],
    ['scholar', 'Érudition', { xpPct: 4 }, '+4 % d\'expérience'],
    ['fortune', 'Fortune', { rareLootPct: 2 }, '+2 % de butin Épique et Légendaire'],
  ],
};
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];
for (const tier of [2, 3, 4, 5]) {
  for (const [branch, nodes] of Object.entries(RESEARCH_TIER_NODES)) {
    for (const [key, name, effect, text] of nodes) {
      RESEARCH.push({ id: `${key}${tier}`, branch, tier, art: `rs_${key}`, name: `${name} ${ROMAN[tier]}`, max: 10, effect, text });
    }
  }
}
// Nœuds clés (palier III) : un niveau, un effet qui change la façon de jouer. Ils s'allument en or dans le livre.
export const KEYSTONES = [
  { id: 'key_hand', branch: 'combat', name: 'Main d\'Ascendrya', effect: { skillSlots: 1 }, text: 'Un sort actif de plus' },
  { id: 'key_vigil', branch: 'combat', name: 'Veille éternelle', effect: { offlineHours: 4 }, text: '+4 h de gains hors ligne' },
  { id: 'key_menagerie', branch: 'team', name: 'Cœur de la Ménagerie', effect: { petSlots: 1 }, text: 'Un familier de plus en combat' },
  { id: 'key_caravan', branch: 'team', name: 'Caravane', effect: { expeditionItem: 1 }, text: 'Les expéditions rapportent un objet' },
  { id: 'key_fate', branch: 'economy', name: 'Œil du destin', effect: { freeReroll: 1 }, text: '1 relance d\'effet gratuite par jour' },
  { id: 'key_market', branch: 'economy', name: 'Marché noir', effect: { blackMarket: 1 }, text: 'Le Comptoir vend un objet Mythique par semaine' },
];
for (const k of KEYSTONES) RESEARCH.push({ ...k, tier: 3, keystone: true, art: k.id, max: 1 });
// Durées et coûts des paliers : durée ×(1,5 par palier) jusqu'à 12 h (II) et 24 h (V) ; coût ×4 par palier.
export const RESEARCH_TIERS = { 2: { maxMinutes: 720, cost: 4 }, 3: { maxMinutes: 960, cost: 16 }, 4: { maxMinutes: 1200, cost: 64 }, 5: { maxMinutes: 1440, cost: 256 } };
export const RESEARCH_SLOTS_AT_AGE = { 3: 3, 4: 4 };
