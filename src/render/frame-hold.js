// v10.17 (A) : ouvrir ou fermer une fenêtre ne bouge plus le combat.
// Le cadrage (zoom k, centerShift, ligne du sol) n'est recalculé que si la fenêtre du navigateur change de taille
// (ou la taille des personnages) ; quand seule la place de la scène change (onglet ouvert à droite, feuille du bas),
// on garde le cadrage : s'il manque de la place, on recadre (on voit moins de décor), on ne dézoome pas.
// Logique pure (testée par tests/v1017-resize.test.js), sans DOM.

// Clé de la fenêtre : la seule chose qui autorise un nouveau zoom.
export const windowKey = (w, h, dpr = 1, pref = 'auto') => `${Math.round(w)}x${Math.round(h)}@${dpr}:${pref}`;

// prev : { k, centerShift, groundY } du dernier cadrage complet ; place : { width, height } en pixels de jeu (au zoom
// gardé), heroX (position du héros sans décalage), room (pixels de jeu à garder devant le héros pour voir l'ennemi),
// minGround (sol le plus haut permis), depth (épaisseur du sol).
// Renvoie { centerShift, groundY } : identiques à prev tant qu'ils tiennent.
export function holdFrame(prev, { width, height, heroX, room = 90, minGround = 78, depth = 18 }) {
  const maxShift = Math.max(0, Math.floor(width - heroX - room));
  const centerShift = Math.max(0, Math.min(prev.centerShift ?? 0, maxShift));
  const top = height - depth; // (liftCap : la colonne du bas s'adapte ; le sol ne remonte que s'il ne tient plus)
  const groundY = Math.max(Math.min(minGround, top), Math.min(prev.groundY, top));
  return { centerShift, groundY };
}

// Décale les effets en cours (liste d'objets à coordonnées numériques) de (dx, dy) pixels de jeu.
export const FX_X_KEYS = ['x', 'x0', 'x1', 'tx', 'cx'];
export const FX_Y_KEYS = ['y', 'top', 'sy', 'y0', 'y1', 'ty'];
export function shiftEffects(list, dx, dy) {
  if (!list?.length || (!dx && !dy) || !Number.isFinite(dx) || !Number.isFinite(dy)) return;
  for (const fx of list) {
    if (dx) for (const k of FX_X_KEYS) if (typeof fx[k] === 'number') fx[k] += dx;
    if (dy) for (const k of FX_Y_KEYS) if (typeof fx[k] === 'number') fx[k] += dy;
  }
}
