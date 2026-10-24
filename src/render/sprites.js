// Assets pixel art du prototype, dessinés pour le projet (aucun asset externe).
//
// Chaque sprite est une grille de caractères ; chaque caractère renvoie à une couleur
// de BASE_PALETTE (ou de la palette locale `pal`). '.' = transparent.
// Les caractères 'a' (couleur principale), 'A' (ombre) et 'r' (rareté) sont remplacés
// à l'exécution par les couleurs de l'objet équipé.
//
// Ces grilles sont des placeholders remplaçables : modifier une grille ici met à jour le jeu
// et `npm run export-assets` régénère les PNG de assets/.

export const BASE_PALETTE = {
  k: '#1b1424', // contour
  w: '#ffffff',
  s: '#f2c39b', S: '#cf946a', // peau
  h: '#7a4426', // cheveux
  e: '#1b1424', // yeux
  t: '#6c5a8e', T: '#4b3d66', // vêtements de base
  l: '#4a2c1a', // ceinture
  p: '#3a3a5a', // pantalon
  b: '#5b3a22', // bottes
  g: '#62d05a', G: '#3a9a46', // gluant
  c: '#86b84a', C: '#5f8a33', // peau de gobelin
  o: '#8a5a33', O: '#6a4224', // tissu de gobelin
  f: '#8c8f9e', F: '#5e6170', // loup
  R: '#e8384f', // yeux rouges
  m: '#d8423a', M: '#a32b2b', // chapeau de champignon
  v: '#7a4fa8', V: '#55337a', // chauve-souris
  n: '#e8e2cf', N: '#b5ad95', // os
  y: '#ffd23f', Y: '#c8961e', // or
  j: '#4a9a3e', i: '#79c95c', L: '#2f6e30', // feuillage
  d: '#7a5230', D: '#553820', // tronc
  q: '#8b8f99', Q: '#62666f', // roche
  u: '#8fe8ff', U: '#3fa8d8', // cristal
  x: '#ef6aa6', z: '#ffe066', // fleurs
  H: '#6b4423', // manche d'arme
  a: '#cccccc', A: '#888888', r: '#ffffff', // remplacés par l'objet
};

// --- Héros (face à droite). Les 4 images partagent la tête et le buste. ---
const HERO_HEAD = [
  '................',
  '......kkkk......',
  '.....khhhhk.....',
  '....khhhhhhk....',
  '....khsssesk....',
  '....khssssSk....',
  '.....kssssk.....',
];
const HERO_TORSO = [
  '....kttttttk....',
  '...ktttttttsk...',
  '...kTttttttsk...',
  '...kkllllllkk...',
];
const HERO_TORSO_ATTACK = [
  '....kttttttk....',
  '...kttttttkssk..',
  '...kTtttttk.....',
  '...kkllllllkk...',
];
const LEGS_IDLE = [
  '....kppppppk....',
  '....kppkkppk....',
  '....kppkkppk....',
  '....kbbkkbbk....',
  '....kkkkkkkk....',
];
const LEGS_STRIDE = [
  '....kppppppk....',
  '...kppk..kppk...',
  '..kppk....kppk..',
  '..kbbk....kbbk..',
  '..kkkk....kkkk..',
];
const LEGS_PASS = [
  '....kppppppk....',
  '.....kppppk.....',
  '.....kppppk.....',
  '.....kbbbbk.....',
  '.....kkkkkk.....',
];

export const SPRITES = {
  hero_idle: { rows: [...HERO_HEAD, ...HERO_TORSO, ...LEGS_IDLE], hand: { x: 11, y: 9 } },
  hero_walk1: { rows: [...HERO_HEAD, ...HERO_TORSO, ...LEGS_STRIDE], hand: { x: 11, y: 9 } },
  hero_walk2: { rows: [...HERO_HEAD, ...HERO_TORSO, ...LEGS_PASS], hand: { x: 11, y: 9 } },
  hero_attack: { rows: [...HERO_HEAD, ...HERO_TORSO_ATTACK, ...LEGS_STRIDE], hand: { x: 13, y: 8 } },

  // --- Équipement superposé au héros (oy = ligne de départ sur le corps). ---
  helmet_hood: {
    oy: 1,
    rows: [
      '.....kkkkkk.....',
      '....kaaaaaak....',
      '...kaaaaaaaak...',
      '...kaA..........',
      '...kaA..........',
      '....kA..........',
    ],
  },
  helmet_helm: {
    oy: 1,
    rows: [
      '.....kkkkkk.....',
      '....kaaaaaak....',
      '...kaarraaaak...',
      '...kA.....Ak....',
    ],
  },
  armor_tunic: {
    oy: 7,
    rows: [
      '....kaaaaaak....',
      '...kaaaaaaa.....',
      '...kAaaaaaA.....',
      '...kkrrrrrrkk...',
      '....kAAAAAAk....',
    ],
  },
  armor_mail: {
    oy: 7,
    rows: [
      '....kaAaAaAk....',
      '...kAaAaAaA.....',
      '...kaAaAaAa.....',
      '...kkrrrrrrkk...',
      '....kaAaAaAk....',
    ],
  },
  // Armes verticales, lame vers le haut ; `grip` = pixel tenu dans la main.
  weapon_sword: {
    grip: { x: 2, y: 7 },
    rows: ['..k..', '.kwk.', '.kak.', '.kak.', '.kak.', '.kAk.', 'krArk', '.kHk.', '.kHk.', '..k..'],
  },
  weapon_axe: {
    grip: { x: 2, y: 7 },
    rows: ['..kkk.', '.kHaak', '.kHaAk', '.kHkk.', '.kHk..', '.kHk..', 'krHrk.', '.kHk..', '.kHk..', '..k...'],
  },
  weapon_dagger: {
    grip: { x: 2, y: 4 },
    rows: ['..k..', '.kwk.', '.kak.', 'krArk', '.kHk.', '..k..'],
  },

  // --- Ennemis (face à gauche, vers le héros), alignés par le bas. ---
  slime: {
    rows: [
      '......kkkk......',
      '....kkggggkk....',
      '...kgggwggggk...',
      '..kggwwgggggGk..',
      '..kgkgggkgggGk..',
      '..kgggggggggGk..',
      '..kGgggggggGGk..',
      '...kkkkkkkkkk...',
    ],
  },
  goblin: {
    rows: [
      '.....kkkk.......',
      '...kkccccck.....',
      '..kcckcccck.....',
      '..kccccCcck.....',
      '...kcwcwck......',
      '....kkkkk.......',
      '...koooook......',
      '..kcoooooock....',
      '..kcoOOOOock....',
      '...koooook......',
      '...kook.kok.....',
      '...kck..kck.....',
      '..kkck..kkck....',
    ],
  },
  wolf: {
    rows: [
      '.kk.............',
      '.kfk........kk..',
      'kfffk......kfk..',
      'kRfffkkkkkkfk...',
      'kfffffffffffk...',
      '.kkFfffffffFk...',
      '..kfk.kfk.kfk...',
      '..kfk.kfk.kfk...',
      '..kkk.kkk.kkk...',
    ],
  },
  mushroom: {
    rows: [
      '.....kkkkkk.....',
      '...kkmmwmmmkk...',
      '..kmmmmmmwmmmk..',
      '.kmwmmmmmmmmMMk.',
      '.kMMMMMMMMMMMMk.',
      '..kkkkkkkkkkkk..',
      '....ksksssk.....',
      '....ksssssk.....',
      '....ksSSSsk.....',
      '...kkssssskk....',
      '...kkkkkkkkk....',
    ],
  },
  bat_up: {
    rows: [
      '.k..........k...',
      '.vk...kk...kv...',
      '.vvk.kvvk.kvv...',
      '.vvvkvRvvkvvv...',
      '..vvkvvvvkvv....',
      '....kvwvwk......',
      '.....kkkk.......',
    ],
  },
  bat_down: {
    rows: [
      '................',
      '......kk........',
      '....kkvvkk......',
      '..kvvkRvvkvvk...',
      '.kvvvkvwvkvvvk..',
      '.kvv.kkkk..vvk..',
      '.k..........k...',
    ],
  },
  skeleton: {
    rows: [
      '.....kkkkk......',
      '....knnnnnk.....',
      '....kknnknk.....',
      '....knnnnnk.....',
      '.....knknk......',
      '......kkk.......',
      '....kknnnkk.....',
      '...knkNnNknk....',
      '...k.knnnk.k....',
      '....kkNnnNkk....',
      '.....knk.knk....',
      '.....knk.knk....',
      '.....knk.knk....',
      '....kkkk.kkkk...',
    ],
  },
  crown: {
    rows: ['y.y.y', 'yyyyy', 'yYyYy'],
  },

  // --- Décor modulaire, aligné par le bas sur le sol. ---
  tree: {
    rows: [
      '......kkkk......',
      '....kkjjjjkk....',
      '...kjjijjjjjk...',
      '..kjjiijjjjjLk..',
      '.kjjijjjjjjjLLk.',
      '.kjjjjjjjjjLLLk.',
      '.kLjjjjjjjLLLLk.',
      '..kLLjjjjjLLLk..',
      '...kkLLLLLLkk...',
      '.....kkddkk.....',
      '......kddk......',
      '......kdDk......',
      '......kdDk......',
      '.....kddDDk.....',
    ],
  },
  pine: {
    rows: [
      '.......kk.......',
      '......kjjk......',
      '.....kjijLk.....',
      '....kjjjjLLk....',
      '.....kjijLk.....',
      '....kjijjjLk....',
      '...kjjjjjjLLk...',
      '....kjjijjLk....',
      '...kjijjjjjLk...',
      '..kjjjjjjjjLLk..',
      '.kjjjjjjjjjjLLk.',
      '.kkkkkkddkkkkkk.',
      '......kddk......',
      '......kdDk......',
    ],
  },
  bush: {
    rows: [
      '...kkkk...',
      '.kkjjijkk.',
      'kjjijjjjLk',
      'kjjjjjjLLk',
      '.kkkkkkkk.',
    ],
  },
  rock: {
    rows: [
      '..kkkk..',
      '.kqqqQk.',
      'kqqqqQQk',
      'kkkkkkkk',
    ],
  },
  flowers: {
    rows: [
      '.x...z.',
      'xzx.zxz',
      '.x.j.z.',
      '.j.j.j.',
    ],
  },
  grass: {
    rows: ['.j.j.', 'jijji'],
  },
  mushroom_small: {
    rows: ['.kkk.', 'kmwmk', 'kkkkk', '.kSk.'],
  },
  crystal: {
    rows: [
      '..k...',
      '.kuk..',
      '.kuUk.',
      'kuuUk.',
      'kuuUUk',
      'kkkkkk',
    ],
  },
  stalagmite: {
    rows: [
      '..kk..',
      '..kqk.',
      '.kqQk.',
      '.kqqQk',
      'kqqqQk',
      'kkkkkk',
    ],
  },
  stalactite: {
    rows: [
      'kkkkkk',
      'kqqqQk',
      '.kqQk.',
      '.kqk..',
      '..k...',
    ],
  },
  cloud: {
    pal: { c: '#dceef6' },
    rows: [
      '....wwww......',
      '..wwwwwwww.ww.',
      '.wwwwwwwwwwwww',
      'wwwwwwwwwwwwww',
      '.cccccccccccc.',
    ],
  },
  coin: {
    rows: ['.kkk.', 'kyywk', 'kyyYk', 'kyYYk', '.kkk.'],
  },
};

// Remplit les lignes trop courtes avec du transparent.
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
