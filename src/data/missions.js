// Missions journalières, piste du mois + calendrier de connexion.
// v9.1.3 (doc1 lot F) : hebdomadaires et mensuelles sont fondues dans une seule piste (MISSION_TRACK).
// Les journalières se réinitialisent à minuit (heure locale), la piste le 1er du mois ; elles rapportent
// surtout des gemmes (cristaux) : de bonnes raisons de revenir chaque jour.

export const MISSION_PERIODS = [
  {
    id: 'daily',
    label: 'Journalières',
    reset: 'Réinitialisation à minuit',
    missions: [
      { id: 'login', type: 'login', target: 1, label: 'Se connecter', reward: { gems: 20 } },
      { id: 'kills', type: 'kills', target: 300, label: 'Vaincre 300 monstres', reward: { gems: 30, shards: 15 } },
      { id: 'bosses', type: 'bosses', target: 3, label: 'Vaincre 3 boss', reward: { gems: 30, keys: 1 } },
      { id: 'recycle', type: 'recycle', target: 15, label: 'Recycler 15 objets', reward: { gems: 20, shards: 20 } },
      { id: 'summons', type: 'summons', target: 3, label: 'Faire 3 invocations', reward: { gems: 40 } },
    ],
    bonus: { gems: 160 },
  },
];

// v9.1.3 : piste du mois. Chaque objectif reprend le plus exigeant des anciens objectifs du mois (mensuel, ou
// 4,33 × hebdomadaire, 52 semaines / 12 mois : une même victoire comptait pour les deux) ; la piste avance de la moyenne des objectifs (chacun plafonné à 100 %), et chaque dixième
// donne un palier. Récompenses totales = anciennes hebdomadaires × 4,33 + mensuelles, tickets comptés à 100 gemmes :
// 1 270 × 4,33 + 4 500 ≈ 10 000 gemmes, 3 × 4,33 + 5 ≈ 18 clés, 110 × 4,33 ≈ 480 éclats (500 ici).
// Paliers croissants (300 → 2 100 gemmes) : la fin de piste vaut le rendez-vous complet ; un joueur qui ne vient que
// quelques jours n'y gagne pas autant qu'un joueur quotidien. Simulation par profil : tools/sim-missions-v913.mjs ; critère d'abandon : docs/refontes-v913.md.
export const MISSION_TRACK = {
  id: 'track',
  label: 'Piste du mois',
  reset: 'Réinitialisation le 1er du mois',
  goals: [
    { id: 'logins', type: 'login', target: 15, label: 'Jours de connexion' },
    { id: 'kills', type: 'kills', target: 15000, label: 'Monstres vaincus' },
    { id: 'bosses', type: 'bosses', target: 87, label: 'Boss vaincus' },
    { id: 'dungeons', type: 'dungeons', target: 17, label: 'Donjons terminés' },
    { id: 'summons', type: 'summons', target: 50, label: 'Invocations' },
    { id: 'rareLoot', type: 'rareLoot', target: 130, label: 'Objets Rares ou mieux' },
    { id: 'upgrades', type: 'upgrades', target: 43, label: 'Améliorations ou fusions' },
  ],
  tiers: [
    { pct: 10, reward: { gems: 300, shards: 50 } },
    { pct: 20, reward: { gems: 400, shards: 50, keys: 3 } },
    { pct: 30, reward: { gems: 500, shards: 50 } },
    { pct: 40, reward: { gems: 600, shards: 50, keys: 3 } },
    { pct: 50, reward: { gems: 800, shards: 50 } },
    { pct: 60, reward: { gems: 1000, shards: 50, keys: 4 } },
    { pct: 70, reward: { gems: 1200, shards: 50 } },
    { pct: 80, reward: { gems: 1400, shards: 50, keys: 4 } },
    { pct: 90, reward: { gems: 1700, shards: 50 } },
    { pct: 100, reward: { gems: 2100, shards: 50, keys: 4 } },
  ],
};

// Calendrier de connexion : une récompense par jour de connexion, puis le cycle recommence.
// v9.1.3 : un jour manqué ne remet plus le calendrier à zéro (les jours comptent, pas la série).
export const LOGIN_CALENDAR = [
  { gems: 30 },
  { gems: 100 },
  { gems: 50 },
  { keys: 1, shards: 30 },
  { gems: 80 },
  { gems: 200 },
  { gems: 450 },
];
