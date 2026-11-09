// v9.2.8 : configuration centralisée de l'économie (document du producteur « Économie, invocations, héros, familiers et
// cosmétiques », appelé DOC ci-dessous). Taux, courbes de pity, bannières, revenus mensuels, monnaies et tickets,
// boutique (prix, quantités, limites, bonus de première acquisition), cosmétiques et paliers de dépenses : tout est ici,
// rien n'est écrit en dur dans l'interface. Plan et décisions : PLAN-ECONOMIE.md (dossier du joueur).
//
// Correspondances retenues (voir le plan) :
// - « héros » du DOC = compagnons alliés du jeu (rareté rare = R, épique = SR, légendaire = SSR) ;
// - « familiers » du DOC = familiers du jeu (commun et rare = R, épique = SR, légendaire = SSR) ;
// - « cristaux » du DOC = gemmes du jeu. Une invocation coûte 100 gemmes (le DOC dit 300 cristaux) : toutes les quantités
//   de cristaux du DOC sont multipliées par CRYSTAL_SCALE (1/3), ce qui garde l'équivalence en invocations
//   (Mini 300 cristaux = 1 invocation = 100 gemmes). Les sources de gemmes existantes ne changent pas ;
// - « skins » du DOC = apparences du héros (Héros › Apparences) ; « thèmes » = thèmes d'interface (Paramètres).

export const DOC_CRYSTALS_PER_PULL = 300;
export const GEMS_PER_PULL = 100; // = BALANCE.summon.gemCost (vérifié par les tests)
export const CRYSTAL_SCALE = GEMS_PER_PULL / DOC_CRYSTALS_PER_PULL;
const gems = (docCrystals) => Math.round(docCrystals * CRYSTAL_SCALE);

// Raretés du DOC (R, SR, SSR) et raretés du jeu.
export const TIERS = ['R', 'SR', 'SSR'];
export const TIER_OF = {
  hero: { rare: 'R', epic: 'SR', legendary: 'SSR' },
  pet: { common: 'R', rare: 'R', epic: 'SR', legendary: 'SSR' },
};

// Courbe de soft pity (DOC 3, 4 et 9), identique pour les trois bannières, réglée par `softStart`, `hard` et `shape` :
//   n = numéro du tirage depuis le dernier SSR (1, 2, 3…)
//   p(n) = base                                                    si n < softStart
//   p(n) = base + (1 − base) × ((n − softStart + 1) / (hard − softStart + 1))^shape   si softStart ≤ n < hard
//   p(n) = 1                                                       si n ≥ hard (garantie)
// Avec shape = 1, la chance monte en ligne droite de `base` (avant softStart) jusqu'à 1 au tirage `hard` : la formule
// donne déjà 1 au tirage `hard`, et la garantie le force de toute façon (preuve : tests/v928-economy.test.js).
export const BANNERS = {
  limited: {
    id: 'limited', kind: 'hero', label: 'Bannière limitée', pity: 'limited',
    rates: { SSR: 0.02, SR: 0.21 }, // R = le reste (77 %)
    softStart: 80, hard: 100, shape: 1,
    srEvery: 10, // SR ou mieux au plus tard toutes les 10 invocations (règle existante, gardée)
    fiftyFifty: 0.5, // part de la vedette parmi les SSR quand la garantie n'est pas active
    pay: ['ticketLimited', 'gems'],
    rotationDays: 14, // DOC : deux SSR limités par mois (une vedette toutes les 2 semaines)
  },
  permanent: {
    id: 'permanent', kind: 'hero', label: 'Bannière permanente', pity: 'permanent',
    rates: { SSR: 0.015, SR: 0.21 },
    softStart: 80, hard: 100, shape: 1, srEvery: 10,
    wishlistSize: 5,
    // Règle de la wishlist (DOC 4) : chaque SSR inscrit reçoit `wishlistSlotShare` des SSR obtenus (20 % : 5 inscrits =
    // 100 %, le SSR obtenu est toujours de la wishlist). Wishlist incomplète (k < 5) : les k inscrits ont 20 % chacun,
    // les 1 − k × 20 % restants se répartissent à parts égales entre les SSR permanents non inscrits. Vide : tous les SSR
    // permanents à parts égales. Seuls des SSR permanents peuvent y être inscrits (jamais un limité).
    wishlistSlotShare: 0.2,
    pay: ['ticketPermanent', 'gems'],
  },
  pet: {
    id: 'pet', kind: 'pet', label: 'Invocation de familiers', pity: 'pet',
    rates: { SSR: 0.03, SR: 0.15 },
    softStart: 45, hard: 60, shape: 1, srEvery: 10,
    pay: ['ticketPet'], // DOC 10 : jamais de cristaux pour les familiers
  },
};

// Doublons (DOC 2 et 8) : 6 exemplaires. Paliers affichés ; l'effet chiffré reste celui du jeu (passif × étoiles,
// compétence ultime / spéciale au 4e exemplaire : SKILL_RULES.ultimateCopies).
export const COPIES = {
  max: 6,
  steps: ['Déblocage', 'Statistiques', 'Statistiques', 'Compétence ultime', 'Statistiques', 'Amélioration finale (max)'],
  petSteps: ['Déblocage', 'Statistiques', 'Statistiques', 'Compétence spéciale', 'Statistiques', 'Amélioration finale (max)'],
  // Conversion au-delà du 6e exemplaire (jamais perdu en silence) : héros → gemmes (cristaux) ; familiers → tickets
  // familiers ou éclats (jamais de cristaux : économies séparées).
  overflow: {
    hero: { R: { gems: 10 }, SR: { gems: 30 }, SSR: { gems: 100 } },
    pet: { R: { shards: 20 }, SR: { ticketPet: 1 }, SSR: { ticketPet: 5 } },
  },
};

// Fragments SSR universels (DOC 6) : un par grand événement ; ajoute un exemplaire à un SSR déjà possédé (limité ou
// permanent), sans dépasser 6 ; ne débloque jamais un héros ; jamais vendus en boutique.
export const SSR_FRAGMENT = { perGrandEvent: 1 };

// Revenus mensuels (DOC 5 et 10), mois de 30 jours, joueur F2P très actif. Chaque source a son plafond par mois
// civil : aucune action ne compte deux fois (le registre `state.economy.ledger` l'impose). Sommes vérifiées par test.
// v9.2.9 : revenus de tickets familiers revérifiés avec la nouvelle collection (5 SSR au lieu de 1 : dragonnet,
// tortue de jade, renard céleste, petit phénix, feu follet ; tools/sim-economy.mjs, 10 000 parties par profil, 6 mois).
// F2P très actif : ~560 invocations familiers, ~21 SSR, ~20 exemplaires SSR sur 30, ~1,3 SSR au maximum, collection SSR
// complète dans 0 % des parties (avant : le seul SSR était au maximum en 2 mois environ). Cible tenue sans toucher aux
// revenus : ticketPet reste à 90 par mois.
export const MONTHLY_TARGETS = {
  ticketLimited: 180, ticketPermanent: 120, ticketPet: 90,
  crystalPulls: 200, // 60 000 cristaux du DOC = 20 000 gemmes : sources de gemmes existantes, inchangées
};
export const INCOME = {
  // Récurrent (35 % des tickets héros) : chaque jour de connexion compté, puis paliers du mois.
  loginDaily: { group: 'login', each: { ticketLimited: 2, ticketPermanent: 1 }, cap: { ticketLimited: 60, ticketPermanent: 30 } },
  loginMilestones: { group: 'login', counter: 'login', steps: [
    { at: 5, give: { ticketPet: 3 } },
    { at: 10, give: { ticketLimited: 5, ticketPermanent: 3, ticketPet: 3 } },
    { at: 15, give: { ticketPet: 3 } },
    { at: 20, give: { ticketPet: 3 } },
    { at: 25, give: { ticketLimited: 5, ticketPermanent: 2, ticketPet: 3 } },
  ] },
  // Missions (25 %) : bonus des journalières (toutes faites), puis paliers du mois.
  missionsDaily: { group: 'missions', each: { ticketLimited: 1, ticketPermanent: 1 }, cap: { ticketLimited: 30, ticketPermanent: 30 } },
  missionsMilestones: { group: 'missions', counter: 'missions', steps: [
    { at: 10, give: { ticketPet: 10 } },
    { at: 20, give: { ticketLimited: 15, ticketPet: 10 } },
  ] },
  // Activités avancées (10 %) : premier boss vaincu du jour (un ticket, limité et permanent en alternance) ;
  // premier donjon terminé du jour pour les familiers.
  bossDaily: { group: 'advanced', alternate: ['ticketLimited', 'ticketPermanent'], cap: { ticketLimited: 15, ticketPermanent: 15 } },
  dungeonDaily: { group: 'advanced', each: { ticketPet: 1 }, cap: { ticketPet: 15 } },
  // « Autres » (familiers) : un ticket par palier de la piste du mois.
  trackTier: { group: 'other', each: { ticketPet: 1 }, cap: { ticketPet: 10 } },
};
// Événements (30 % des tickets héros) : comptés par événement (pas par mois), voir EVENTS.
export const EVENT_INCOME = {
  grand: { ticketLimited: 30, ticketPermanent: 25, ticketPet: 20, ssrFragment: 1 },
  small: { ticketLimited: 20, ticketPermanent: 15, ticketPet: 10 },
};

// Calendrier des événements (DOC 7) : cycle de 28 jours = grand événement (14 j) puis petit événement (14 j).
export const EVENTS = {
  anchor: '2026-11-02', // lundi, début du cycle n° 1 (heure locale) — à fixer par le développeur
  cycleDays: 28, grandDays: 14,
  grand: {
    id: 'ancients', name: 'Expédition des Anciens', currency: 'eventCoins',
    regions: [
      { id: 'r1', name: 'Plaines oubliées' }, { id: 'r2', name: 'Forêt des murmures' }, { id: 'r3', name: 'Ruines englouties' },
      { id: 'r4', name: 'Pics des titans' }, { id: 'r5', name: 'Sanctuaire des Anciens' },
    ],
    stagesPerRegion: 10,
    // Difficulté : une étape d'événement = une étape de campagne relative au record (records.bestStage).
    stageScale: { from: 0.5, per: 0.014 }, // étape n : record × (0,5 + 0,014 × n) → de 0,51 à 1,2 × le record
    fightSeconds: 30, // combat automatique : dégâts du héros pendant 30 s contre les PV du gardien de l'étape
    stageCoins: 20, regionCoins: 100,
    worldBoss: { unlockStage: 20, attemptsPerDay: 3, seconds: 60, coinsPerAttempt: 40 },
    fragmentStage: 30, // le fragment SSR universel : 30e étape terminée
    rifts: { fromDay: 8, ready: false }, // Failles dimensionnelles (2e semaine) : reportées (voir le plan)
    // Boutique d'événement : stocks dont la somme = EVENT_INCOME.grand (sans le fragment, donné à l'étape 30).
    shop: [
      { id: 'lim', give: { ticketLimited: 1 }, price: 40, stock: 30 },
      { id: 'perm', give: { ticketPermanent: 1 }, price: 40, stock: 25 },
      { id: 'pet', give: { ticketPet: 1 }, price: 30, stock: 20 },
      // v9.3.3 : ressources universelles de compétences (hors revenus en tickets).
      { id: 'grimoire', give: { grimoire: 10 }, price: 15, stock: 10 },
      { id: 'ascension', give: { ascension: 5 }, price: 20, stock: 6 },
      { id: 'mastery', give: { mastery: 2 }, price: 25, stock: 4 },
    ],
  },
  small: {
    id: 'lights', name: 'Marché des lueurs',
    // Objectifs comptés pendant le petit événement seulement ; récompenses = EVENT_INCOME.small (somme vérifiée).
    goals: [
      { id: 'kills', type: 'kills', target: 5000, label: 'Vaincre 5 000 monstres', give: { ticketLimited: 5, ticketPermanent: 5 } },
      { id: 'bosses', type: 'bosses', target: 30, label: 'Vaincre 30 boss', give: { ticketLimited: 5, ticketPermanent: 3, ticketPet: 3 } },
      { id: 'dungeons', type: 'dungeons', target: 5, label: 'Terminer 5 donjons', give: { ticketLimited: 5, ticketPermanent: 4, ticketPet: 4 } },
      { id: 'summons', type: 'summons', target: 20, label: 'Faire 20 invocations', give: { ticketLimited: 5, ticketPermanent: 3, ticketPet: 3 } },
    ],
  },
};

// Monnaies de l'économie (stockées dans state.economy.wallet). Icônes : assets/ui/shop/<icon>.png (grande) et
// <icon>_s.png (petite) ; `sprite` = icône pixel du jeu quand la planche n'en a pas. Les gemmes gardent leur place (state.gems).
export const WALLET = {
  ticketLimited: { name: 'Ticket héros limité', short: 'Tickets limités', icon: 'hero_ticket_limited', use: 'Bannière limitée seulement.' },
  ticketPermanent: { name: 'Ticket héros permanent', short: 'Tickets permanents', icon: 'hero_ticket_permanent', use: 'Bannière permanente seulement.' },
  ticketPet: { name: 'Ticket de familier', short: 'Tickets familiers', icon: 'pet_ticket', use: 'Invocation de familiers seulement.' },
  ssrFragment: { name: 'Fragment Légendaire universel', short: 'Fragments Légendaires', sprite: 'icon_crown', use: 'Une copie de plus pour un Légendaire déjà possédé.' },
  eventCoins: { name: 'Écus des Anciens', short: 'Écus', sprite: 'icon_trophy', use: "Boutique de l'Expédition des Anciens." },
};
export const WALLET_KEYS = Object.keys(WALLET);

// ---------------------------------------------------------------------------------------------------------------
// Boutique (DOC 11 à 17). Prix en centimes d'euro. AUCUN paiement réel : core/store.js refuse tout achat tant
// qu'aucun fournisseur n'est branché. `limit` = achats par mois civil (null = sans limite) ; `firstBonus` = bonus de
// première acquisition (part en plus, une seule fois par produit).
export const SHOP_CATEGORIES = [
  { id: 'crystals', name: 'Cristaux' },
  { id: 'heroTickets', name: 'Tickets héros' },
  { id: 'petTickets', name: 'Tickets familiers' },
  { id: 'subs', name: 'Abonnements' },
  { id: 'skins', name: 'Skins' },
  { id: 'themes', name: 'Thèmes' },
  { id: 'packs', name: 'Packs' },
];

const crystal = (id, name, price, docQty) => ({ id: `crystal_${id}`, cat: 'crystals', name, price, icon: `crystal_${id}`, give: { gems: gems(docQty) }, docQty, firstBonus: 1, limit: null });
// Tickets limités : le DOC donne 6 / 20 / 45 / 110 / 230 (2 à 2,3 invocations par euro, contre 1 à 1,4 pour les
// cristaux). Harmonisé : rendement des cristaux au même prix + 10 % (ticket ciblé, sans bonus de première acquisition),
// avec une limite par mois. Valeurs du DOC gardées dans `docQty`.
const heroTicket = (n, price, qty, docQty, limit) => ({ id: `hero_ticket_${n}`, cat: 'heroTickets', name: `Tickets limités ${n}`, price, icon: 'hero_ticket_limited', give: { ticketLimited: qty }, docQty, limit });
const petPack = (id, name, price, qty, limit = null) => ({ id: `pet_pack_${id}`, cat: 'petTickets', name, price, icon: `pet_pack_${id}`, give: { ticketPet: qty }, limit });

export const PRODUCTS = [
  crystal('mini', 'Cristaux Mini', 99, 300),
  crystal('discovery', 'Cristaux Découverte', 499, 1800),
  crystal('small', 'Cristaux Petit', 999, 3600),
  crystal('medium', 'Cristaux Moyen', 1999, 7500),
  crystal('large', 'Cristaux Grand', 4999, 20000),
  crystal('premium', 'Cristaux Premium', 9999, 42000),
  heroTicket('I', 299, 3, 6, 5),
  heroTicket('II', 999, 13, 20, 3),
  heroTicket('III', 1999, 28, 45, 2),
  heroTicket('IV', 4999, 73, 110, 1),
  heroTicket('V', 9999, 154, 230, 1),
  petPack('discovery', 'Familiers Découverte', 299, 10),
  petPack('small', 'Familiers Petit', 499, 20),
  petPack('medium', 'Familiers Moyen', 999, 45),
  petPack('large', 'Familiers Grand', 1999, 100),
  petPack('premium', 'Familiers Premium', 4999, 280, 2),
  // Abonnements (30 jours) : environ 4 invocations par euro chacun, sans recouvrement (cristaux / tickets / tickets +
  // cosmétique). Bénédiction : 3 000 cristaux tout de suite + 100 par jour (DOC) = 1 100 + 30 gemmes par jour ici.
  { id: 'sub_blessing', cat: 'subs', name: 'Bénédiction quotidienne', price: 499, icon: 'crystal_small', days: 30, give: { gems: 1100 }, daily: { gems: 30 }, limit: 1 },
  { id: 'sub_pass', cat: 'subs', name: 'Pass mensuel', price: 999, icon: 'hero_ticket_limited', days: 30, give: { ticketLimited: 15, ticketPermanent: 15, gems: gems(3000), shards: 500, keys: 5 }, limit: 1 },
  { id: 'sub_premium', cat: 'subs', name: 'Pass premium', price: 1999, icon: 'crystal_premium', days: 30, give: { ticketLimited: 30, ticketPermanent: 30, gems: gems(6000), shards: 1500, keys: 10, fragments: 200 }, limit: 1 },
];

// Skins : prix par catégorie (DOC 13). Les apparences recolorées (palette du chevalier) sont « Rares » ; les apparences
// dessinées gardent leur rareté (Épique, Légendaire) ; « Mythique » est prévu pour une transformation complète.
export const SKIN_TIERS = {
  rare: { name: 'Rare', price: 399, icon: 'skin_rare', text: 'Recoloration.' },
  epic: { name: 'Épique', price: 799, icon: 'skin_epic', text: 'Tenue retravaillée et effets.' },
  legendary: { name: 'Légendaire', price: 1499, icon: 'skin_legendary', text: 'Nouveau design, effets et animations.' },
  mythic: { name: 'Mythique', price: 1999, icon: 'skin_mythic', text: 'Transformation complète, effets et animations exclusifs.' },
};
export function skinTier(hero) {
  if (hero.mythic) return 'mythic';
  if (!hero.skin) return 'rare';
  return hero.rarity === 'legendary' ? 'legendary' : 'epic';
}

// Thèmes (DOC 14) : les 10 thèmes d'avant restent offerts à tous ; les thèmes de boutique sont dans ui/themes.js
// (champ `shop`). Prix par catégorie.
export const THEME_TIERS = {
  classic: { name: 'Classique', price: 299, icon: 'theme_classic' },
  premium: { name: 'Premium', price: 599, icon: 'theme_premium' },
  legendary: { name: 'Légendaire', price: 899, icon: 'theme_legendary' },
};

// Packs cosmétiques (DOC 15) : prix fixes, sans fausse réduction ni compte à rebours. Achetables seulement si aucun
// de leurs cosmétiques n'est déjà possédé (un cosmétique ne se rachète pas).
export const PACKS = [
  { id: 'pack_discovery', name: 'Pack Découverte', price: 599, icon: 'cosmetic_pack_discovery', skins: ['paladin'], themes: ['dawn'] },
  { id: 'pack_heroic', name: 'Pack Héroïque', price: 1199, icon: 'cosmetic_pack_heroic', skins: ['fairy'], themes: ['abyss'] },
  { id: 'pack_legendary', name: 'Pack Légendaire', price: 1999, icon: 'cosmetic_pack_legendary', skins: ['seraph'], themes: ['celestial'] },
  { id: 'pack_collection', name: 'Pack Collection', price: 2299, icon: 'cosmetic_pack_collection', skins: ['valkyrie', 'witch'], themes: ['abyss'] },
];

// Paliers de dépenses cumulées (DOC 17) : cosmétiques seulement, jamais de fragments SSR universels.
export const SPEND_TIERS = [
  { cents: 5000, reward: 'Cadre de profil' },
  { cents: 10000, reward: "Effet d'invocation" },
  { cents: 25000, reward: 'Skin exclusif' },
  { cents: 50000, reward: 'Animation de profil' },
  { cents: 100000, reward: 'Titre et décoration' },
];

// Offres exceptionnelles (DOC 17), hors des 500 invocations mensuelles : données prêtes, pas encore programmées.
export const SPECIAL_OFFERS = {
  launch: { pulls: [150, 200], ssrFragments: 2 },
  halfAnniversary: { pulls: [100, 150], ssrFragments: 2 },
  anniversary: { pulls: [200, 250], ssrFragments: 3 },
};

// v9.3.0 : offres activables par la config live (src/data/live-catalog.js LIVE_OFFER_IDS). Livrées dans le code,
// invisibles tant que l'admin ne les active pas (core/store.js allOffers). Contenu tiré de SPECIAL_OFFERS (pulls
// minimum en gemmes, 1 invocation = GEMS_PER_PULL) ; rangées avec les packs.
const liveOffer = (id, name, price, spec, icon) => ({ id, cat: 'packs', name, price, icon, live: true, limit: 1,
  give: { gems: spec.pulls[0] * GEMS_PER_PULL, ssrFragment: spec.ssrFragments } });
export const LIVE_OFFERS = [
  liveOffer('offer_launch', 'Offre de lancement', 1999, SPECIAL_OFFERS.launch, 'crystal_premium'),
  liveOffer('offer_half_anniversary', 'Offre des 6 mois', 1999, SPECIAL_OFFERS.halfAnniversary, 'crystal_premium'),
  liveOffer('offer_anniversary', "Offre d'anniversaire", 2999, SPECIAL_OFFERS.anniversary, 'crystal_premium'),
];
