// v9.3.0 : catalogue LIVE-OPS — ce que le code du jeu sait afficher, livré à l'avance par les mises à jour.
// Le serveur (server/live.mjs) n'accepte dans sa configuration que des éléments de ce catalogue, et seulement avec une
// « version minimale du client » au moins égale à la version qui les a livrés (`since`). Le jeu (core/live.js)
// n'affiche un élément que si la config live l'active ET si sa propre version est au moins la version minimale.
// Fichier sans import : il est lu tel quel par le serveur et par le jeu.
// Ajouter un événement : 1) coder son contenu et ses assets, 2) l'ajouter ici avec `since` = version qui le livre,
// 3) publier la mise à jour, 4) le programmer puis l'activer depuis l'admin (docs/live-ops.md).

// Première version du jeu qui lit /api/live (les versions antérieures gardent leur calendrier codé en dur).
export const LIVE_MIN_CLIENT = '9.3.0';

// Paramètres : { type: 'number' | 'int' | 'bool' | 'enum', min, max, values, def, label }.
export const LIVE_EVENT_TYPES = {
  ancients: {
    since: '9.2.8', kind: 'grand', days: 14, label: 'Expédition des Anciens',
    detail: 'Carte de 50 étapes, World Boss dès l\'étape 20, écus et boutique d\'événement, fragment SSR à l\'étape 30.',
    params: {
      coinMult: { type: 'number', min: 0.5, max: 5, def: 1, label: 'Multiplicateur des écus' },
      worldBoss: { type: 'bool', def: true, label: 'World Boss ouvert' },
      boss: { type: 'enum', values: ['colossus'], def: 'colossus', label: 'World Boss choisi' },
      bossHpMult: { type: 'number', min: 0.1, max: 10, def: 1, label: 'PV du World Boss (×)' },
      attemptsPerDay: { type: 'int', min: 1, max: 10, def: 3, label: 'Tentatives du World Boss par jour' },
      shopStockMult: { type: 'number', min: 0, max: 5, def: 1, label: 'Stocks de la boutique d\'événement (×)' },
    },
  },
  lights: {
    since: '9.2.8', kind: 'small', days: 14, label: 'Marché des lueurs',
    detail: 'Objectifs (monstres, boss, donjons, invocations) et tickets en récompense.',
    params: {
      goalMult: { type: 'number', min: 0.1, max: 5, def: 1, label: 'Cibles des objectifs (×)' },
    },
  },
};

// Noms des World Boss connus du code (paramètre `boss`).
export const LIVE_BOSSES = { colossus: 'Colosse des Anciens' };

// Vedettes possibles de la bannière limitée : SSR (héros alliés légendaires) présents dans le code.
// Vérifié contre data/companions.js par tests/v930-live.test.js.
export const LIVE_FEATURED_UNITS = {
  archangel: { since: '9.2.8', label: 'Archange' },
  demon_queen: { since: '9.2.8', label: 'Reine démone' },
  ice_empress: { since: '9.2.8', label: 'Impératrice des glaces' },
  shadow_lord: { since: '9.2.8', label: 'Seigneur de l\'ombre' },
  sylvan_guardian: { since: '9.2.8', label: 'Gardienne sylvestre' },
};

// Offres de boutique activables (data/economy.js LIVE_OFFERS) : invisibles tant que la config ne les active pas.
export const LIVE_OFFER_IDS = {
  offer_launch: { since: '9.3.0', label: 'Offre de lancement' },
  offer_half_anniversary: { since: '9.3.0', label: 'Offre des 6 mois' },
  offer_anniversary: { since: '9.3.0', label: 'Offre d\'anniversaire' },
};

// Interrupteurs de fonctionnalités : valeur si la config ne dit rien.
export const LIVE_FLAGS = {
  events: { def: true, label: 'Événements (onglet Événement)' },
  worldBoss: { def: true, label: 'World Boss' },
  featuredBanner: { def: true, label: 'Vedette de la bannière limitée' },
  liveOffers: { def: true, label: 'Offres activables de la boutique' },
  announcements: { def: true, label: 'Annonces dans le jeu' },
};

// Compare deux versions « a.b.c » : < 0, 0 ou > 0. Une version illisible vaut 0.0.0.
export function compareVersions(a, b) {
  const parse = (v) => (/^\d{1,4}\.\d{1,4}\.\d{1,4}$/.test(String(v)) ? String(v).split('.').map(Number) : [0, 0, 0]);
  const x = parse(a);
  const y = parse(b);
  for (let i = 0; i < 3; i += 1) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
}
export const isVersion = (v) => /^\d{1,4}\.\d{1,4}\.\d{1,4}$/.test(String(v));

// Valeurs des paramètres d'un type : défauts complétés, valeurs hors catalogue ignorées.
export function eventParams(type, params = {}) {
  const def = LIVE_EVENT_TYPES[type]?.params ?? {};
  const out = {};
  for (const [k, p] of Object.entries(def)) out[k] = params?.[k] !== undefined ? params[k] : p.def;
  return out;
}
