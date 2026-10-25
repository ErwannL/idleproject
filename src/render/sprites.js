import { ART } from './art.js';

// Assets pixel art, dessinés pour le projet (aucun asset externe).
//
// Chaque sprite est une grille de caractères ; chaque caractère renvoie à une couleur
// de BASE_PALETTE (ou de la palette locale `pal`). '.' = transparent.
// Les grilles sont générées par tools/art/*.py (python3 tools/art/build.py) dans art.js :
// formes ombrées, contours sélectifs, rampes de couleurs à décalage de teinte.
// Caractères réservés remplacés à l'exécution : objet équipé (a, A, 1, 2, r, 3, 9),
// couleurs du héros (B, P, 4, 5, W, 6, 7, K, 8), acier recolorable (w, E, I, J, X).
// Les décors de zone sont des PNG (assets/bg), générés par le même outil.

export const BASE_PALETTE = {
  // objet équipé : principale, ombre, clair, très sombre ; rareté, rareté claire, rareté sombre
  a: '#c9d1db', A: '#8a94a3', 1: '#eef2f7', 2: '#4f5866', r: '#7fb8ff', 3: '#c4e0ff', 9: '#3c64b0',
  // couleurs du héros : tabard (clair, base, ombre, très sombre), dorures, plumet
  4: '#5a8ae0', B: '#2f62b8', P: '#1d3b78', 5: '#122550', W: '#e8b64a', 6: '#ffe08a', 7: '#a8742a', K: '#3b7de0', 8: '#22489a',
  // acier : reflet, clair, moyen, sombre, très sombre
  w: '#ffffff', E: '#dfe6ee', I: '#a3b1c2', J: '#66748a', X: '#2c3444',
};

export const HERO_FRAME_SIZE = { w: 40, h: 44 };
export const SHIELD_OFFSET = { x: 4, y: 21 };

export const SPRITES = { ...ART };

export function normalizeRows(rows) {
  const width = Math.max(...rows.map((r) => r.length));
  return rows.map((r) => r.padEnd(width, '.'));
}

// Rotation de 90° dans le sens horaire (le haut de l'image passe à droite).
export function rotateRowsCW(rows) {
  const grid = normalizeRows(rows);
  const h = grid.length;
  const w = grid[0].length;
  const out = [];
  for (let y = 0; y < w; y++) {
    let line = '';
    for (let x = 0; x < h; x++) line += grid[h - 1 - x][y];
    out.push(line);
  }
  return out;
}

// Police pixel 5×7 (chiffres des dégâts, avec contour).
export const FONT_BIG = {
  0: ['01110', '11011', '11011', '11011', '11011', '11011', '01110'],
  1: ['00110', '01110', '11110', '00110', '00110', '00110', '11111'],
  2: ['01110', '11011', '00011', '00110', '01100', '11000', '11111'],
  3: ['11110', '00011', '00011', '01110', '00011', '00011', '11110'],
  4: ['00110', '01110', '11010', '11011', '11111', '00011', '00011'],
  5: ['11111', '11000', '11110', '00011', '00011', '11011', '01110'],
  6: ['01110', '11000', '11110', '11011', '11011', '11011', '01110'],
  7: ['11111', '00011', '00011', '00110', '01100', '01100', '01100'],
  8: ['01110', '11011', '11011', '01110', '11011', '11011', '01110'],
  9: ['01110', '11011', '11011', '01111', '00011', '00011', '01110'],
  ',': ['00', '00', '00', '00', '00', '11', '01'],
  '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'],
  '-': ['000', '000', '000', '111', '000', '000', '000'],
  K: ['11011', '11011', '11110', '11100', '11110', '11011', '11011'],
  M: ['10001', '11011', '11111', '11111', '11011', '11011', '11011'],
  B: ['11110', '11011', '11011', '11110', '11011', '11011', '11110'],
  T: ['11111', '01110', '01110', '01110', '01110', '01110', '01110'],
  Q: ['01110', '11011', '11011', '11011', '11011', '11110', '00011'],
  a: ['00000', '00000', '01110', '00011', '01111', '11011', '01111'],
  i: ['11', '00', '11', '11', '11', '11', '11'],
  ' ': ['000', '000', '000', '000', '000', '000', '000'],
};

// Petite police pixel 3×5 pour les nombres flottants.
export const FONT = {
  0: ['111', '101', '101', '101', '111'],
  1: ['010', '110', '010', '010', '111'],
  2: ['111', '001', '111', '100', '111'],
  3: ['111', '001', '111', '001', '111'],
  4: ['101', '101', '111', '001', '001'],
  5: ['111', '100', '111', '001', '111'],
  6: ['111', '100', '111', '101', '111'],
  7: ['111', '001', '010', '010', '010'],
  8: ['111', '101', '111', '101', '111'],
  9: ['111', '101', '111', '001', '111'],
  ',': ['0', '0', '0', '1', '1'],
  '+': ['000', '010', '111', '010', '000'],
  '-': ['000', '000', '111', '000', '000'],
  K: ['101', '101', '110', '101', '101'],
  M: ['101', '111', '111', '101', '101'],
  B: ['110', '101', '110', '101', '110'],
  T: ['111', '010', '010', '010', '010'],
  Q: ['111', '101', '101', '111', '001'],
  a: ['000', '011', '101', '101', '011'],
  i: ['1', '0', '1', '1', '1'],
  ' ': ['0', '0', '0', '0', '0'],
};
