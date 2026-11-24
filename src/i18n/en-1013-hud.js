// v10.13 (lot 8) : anglais de l'écran de combat (console du bas, carnet, chemin du héros, rangée d'événements).
// Branché à la fin de ./en.js, sans écraser l'existant (sauf « Coffre » : la rangée d'événements dit « Chest »).
export const EXACT_1013_HUD = {
  'Attaques et Ultime': 'Attacks and Ultimate',
  'Vague et héros': 'Wave and hero',
  'Butin': 'Loot',
  'Moins': 'Less',
  "Plus d'événements": 'More events',
  'Chemin du héros': 'Hero path',
  'Y aller': 'Go',
  'Récupérer': 'Claim',
  'Marché': 'Market',
  'Roue': 'Wheel',
  'Prime': 'Bounty',
  'gratuit': 'free',
  'prête': 'ready',
  'prêt': 'ready',
  'demain': 'tomorrow',
  'Avance auto': 'Auto advance',
};
export const OVERRIDE_1013_HUD = { 'Coffre': 'Chest' };
export const patterns1013Hud = () => [
  [/^Carnet du jour · (\d+) \/ (\d+) ›$/, (m) => `Daily log · ${m[1]} / ${m[2]} ›`],
  [/^Carnet (\d+)\/(\d+)$/, (m) => `Log ${m[1]}/${m[2]}`],
  [/^Chemin du héros · Ch\. (\d+)$/, (m) => `Hero path · Ch. ${m[1]}`],
  [/^(\d+) de plus$/, (m) => `${m[1]} more`],
  [/^(\d+) libres?$/, (m) => `${m[1]} free`],
  [/^étage (\d+)$/, (m) => `floor ${m[1]}`],
];
