// Missions journalières, hebdomadaires et mensuelles + calendrier de connexion.
// Elles se réinitialisent à minuit (heure locale), le lundi et le 1er du mois, et rapportent
// surtout des gemmes (cristaux) et des tickets : de bonnes raisons de revenir chaque jour.

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
    bonus: { gems: 60, tickets: 1 },
  },
  {
    id: 'weekly',
    label: 'Hebdomadaires',
    reset: 'Réinitialisation le lundi',
    missions: [
      { id: 'kills', type: 'kills', target: 3000, label: 'Vaincre 3 000 monstres', reward: { gems: 150 } },
      { id: 'bosses', type: 'bosses', target: 20, label: 'Vaincre 20 boss', reward: { gems: 120, keys: 3 } },
      { id: 'dungeons', type: 'dungeons', target: 4, label: 'Terminer 4 donjons', reward: { gems: 100, tickets: 2 } },
      { id: 'rareLoot', type: 'rareLoot', target: 30, label: 'Trouver 30 objets Rares ou mieux', reward: { essence: 5, shards: 60 } },
      { id: 'upgrades', type: 'upgrades', target: 10, label: 'Améliorer ou fusionner 10 fois', reward: { gems: 100 } },
    ],
    bonus: { gems: 300, tickets: 3 },
  },
  {
    id: 'monthly',
    label: 'Mensuelles',
    reset: 'Réinitialisation le 1er du mois',
    missions: [
      { id: 'logins', type: 'login', target: 15, label: 'Se connecter 15 jours', reward: { gems: 400, tickets: 3 } },
      { id: 'kills', type: 'kills', target: 15000, label: 'Vaincre 15 000 monstres', reward: { gems: 400 } },
      { id: 'bosses', type: 'bosses', target: 80, label: 'Vaincre 80 boss', reward: { gems: 300, tickets: 3 } },
      { id: 'dungeons', type: 'dungeons', target: 15, label: 'Terminer 15 donjons', reward: { gems: 300, keys: 5 } },
      { id: 'summons', type: 'summons', target: 50, label: 'Faire 50 invocations', reward: { gems: 500 } },
    ],
    bonus: { gems: 1000, tickets: 10 },
  },
];

// Calendrier de connexion : une récompense par jour de connexion, puis le cycle recommence.
// v9.1.3 : un jour manqué ne remet plus le calendrier à zéro (les jours comptent, pas la série).
export const LOGIN_CALENDAR = [
  { gems: 30 },
  { tickets: 1 },
  { gems: 50 },
  { keys: 1, shards: 30 },
  { gems: 80 },
  { tickets: 2 },
  { gems: 150, tickets: 3 },
];
