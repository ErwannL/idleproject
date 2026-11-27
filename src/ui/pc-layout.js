// v10.18 (partie 5.5) : PC — largeur de la colonne de combat (à gauche) et de la fenêtre (à droite). Sans DOM : testé par
// tests/v1018-pc.test.js. La fenêtre a au moins max(480 px, 30 % de l'écran) (même règle en CSS : src/ui/pc1018.css) ;
// la colonne de combat garde au moins 420 px et sa largeur v10.17 (moitié de l'écran, ou héros + premier ennemi).
export const SIDE_MIN_PX = 480;
export const SIDE_MIN_SHARE = 0.3;
export const SIDE_FREE_PX = 600; // v10.17 : place laissée à la fenêtre
export const COMBAT_MIN_PX = 420;

export const sideMin = (appW) => Math.max(SIDE_MIN_PX, Math.ceil(appW * SIDE_MIN_SHARE));

export function combatColumn(appW, meetPx = 0) {
  const cap = appW - Math.max(SIDE_FREE_PX, sideMin(appW));
  return Math.round(Math.max(COMBAT_MIN_PX, Math.min(cap, Math.max(meetPx + 24, appW * 0.5))));
}
