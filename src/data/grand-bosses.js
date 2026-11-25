// v9.7.1 (lot 7) : fiches des GRANDS BOSS (Titans, dieux…). Une fiche = un boss complet, sans toucher au moteur :
//   art    planches d'animation (dossier, préfixe, taille d'image, ligne des pieds, filtre de couleur facultatif),
//          animations (images, cadence, images clés), points d'ancrage (yeux par image, main du jet), couleurs du rayon
//   fight  stats du moteur (boss de référence), durée, phases (seuil de vie, attaque, accélération), attaques propres
//          (annonce et parade : voir `abilities`), paliers, Éveil
//   lore, rewards, modes (histoire : face-à-face de fin de monde ; solo répétable ; commun : barre partagée)
// Moteur commun : core/world-boss.js (WorldBossFight, setup.bossId) et render/world-boss-scene.js (WorldBossScene).
// Ajouter un grand boss : docs/ajouter-contenu.md.

const COLOSSUS_ANIMS = {
  idle: { n: 8, fps: 7, loop: true }, idle3: { n: 8, fps: 9, loop: true },
  attack: { n: 9, fps: 16 }, attack3: { n: 9, fps: 18 }, hurt: { n: 9, fps: 18 },
  hurt3: { n: 9, fps: 18 }, // v9.3.0 : coup reçu de la forme de lave (phase 3)
 
  quake: { n: 9, fps: 11 }, embers: { n: 9, fps: 11 }, fury: { n: 9, fps: 12 },
  transform: { n: 13, fps: 12 }, death: { n: 13, fps: 10 }, rise: { n: 13, fps: 14, src: 'death', reverse: true },
  // v9.3.0 : jet de pierre (il arrache un rocher, le lève, le lance) et rayon des yeux (charge, faisceau, retour).
  // `durs` : durée de chaque image (s) ; `release` : image où le rocher quitte la main ; `charge` / `fire` : images
  // de la charge lumineuse et du faisceau.
  throw: { n: 13, durs: [0.07, 0.07, 0.08, 0.09, 0.12, 0.12, 0.1, 0.1, 0.24, 0.1, 0.1, 0.08, 0.08], release: 9 },
  throw3: { n: 13, durs: [0.07, 0.07, 0.08, 0.09, 0.12, 0.12, 0.1, 0.1, 0.24, 0.1, 0.1, 0.08, 0.08], release: 9 },
  beam: { n: 13, durs: [0.08, 0.08, 0.08, 0.22, 0.26, 0.1, 0.32, 0.32, 0.32, 0.1, 0.08, 0.08, 0.08], charge: [3, 4], fire: [5, 8] },
  beam3: { n: 13, durs: [0.08, 0.08, 0.08, 0.22, 0.26, 0.1, 0.32, 0.32, 0.32, 0.1, 0.08, 0.08, 0.08], charge: [3, 4], fire: [5, 8] },
};


const COLOSSUS_EYES = {
  beam: [[34, 39, 44, 38], [34, 39, 44, 38], [33, 39, 43, 38], [32, 40, 42, 39], [31, 41, 41, 40], [31, 42, 41, 41], [31, 42, 41, 41], [31, 42, 41, 41], [31, 42, 41, 41], [32, 41, 42, 40], [33, 40, 43, 39], [34, 39, 44, 38], [34, 39, 44, 38]],
  beam3: [[33, 45, 42, 45], [33, 45, 42, 45], [33, 45, 42, 45], [30, 48, 39, 48], [28, 50, 37, 50], [27, 51, 36, 51], [27, 51, 36, 51], [27, 51, 36, 51], [27, 51, 36, 51], [29, 49, 38, 49], [31, 47, 40, 47], [33, 45, 42, 45], [33, 45, 42, 45]],
};

const COLOSSUS_FIGHT = {
  boss: 'demon_king',
  name: 'Colosse des Anciens', // boss dédié (PixelLab) : render/world-boss-scene.js ; le moteur garde les stats de `boss`
  seconds: 60,
  sizeMul: 2.3, // taille à l'écran (× la taille normale du boss) ; +0,15 par phase
  // Phases : seuil de PV restants, attaque spéciale (part des PV max du héros, jamais mortelle seule), accélération.
  phases: [
    { at: 0.75, id: 'quake', name: 'Séisme infernal', hit: 0.18, speed: 1.15, power: 1.15 },
    { at: 0.5, id: 'meteors', name: 'Pluie de braises', hit: 0.24, speed: 1.3, power: 1.3 },
    { at: 0.25, id: 'fury', name: 'Fureur ancestrale', hit: 0.3, speed: 1.5, power: 1.5 },
  ],
  tiers: [0.25, 0.5, 0.75, 1], // part de la barre vidée pendant la tentative
  hitPct: 0.07, // coup ordinaire du boss : part des PV max du héros (avant armure et Défense)
  attackInterval: 2.4,
  hpFactor: 1.05, // PV du boss du jour = dégâts mesurés en 60 s × hpFactor (une bonne tentative vide la barre : Éveil)
  awaken: 1.25, // force du boss à chaque Éveil (barre vidée)
  // v9.3.0 : attaques propres au Colosse, en boucle pendant toute la tentative (retour de l'équipe : « un jet de pierre
  // et un rayon lumineux qui sort des yeux »). Dégâts : part des PV max du héros (× Éveil, jamais mortels seuls).
  // `from` : première phase où l'attaque entre dans le cycle. Cadence : `every[phase]` secondes entre deux attaques
  // (le Colosse alterne jet de pierre et rayon dès que les deux sont permis), la première à `first` s.
  abilities: [
    { id: 'boulder', name: 'Jet de pierre', hit: 0.11, from: 0 },
    { id: 'eyebeam', name: 'Rayon des Anciens', hit: 0.15, from: 1 },
  ],
  abilityFirst: 5,
  abilityEvery: [11, 9.5, 8, 6.5],
  abilityGap: 2.5, // pas d'attaque propre dans les 2,5 s qui suivent une attaque de phase ou un Éveil
};


export const GRAND_BOSSES = {
  colossus: {
    id: 'colossus', name: 'Colosse des Anciens', title: 'Le premier des Titans',
    lore: 'Il a vaincu le héros dans les ruines d\'Ascendrya. Chaque monde te rapproche de la revanche.',
    art: { dir: 'assets/world-boss', prefix: 'colossus_', frame: 128, foot: 122, anims: COLOSSUS_ANIMS, eyes: COLOSSUS_EYES,
      hands: { throw: [16, 34], throw3: [18, 44] },
      beamColors: { beam: ['#2fd8ff', '#8ff8ff', '#ffffff'], beam3: ['#ff5a1f', '#ffb04a', '#fff3c8'] } },
    fight: COLOSSUS_FIGHT,
    rewards: { gems: 50, shards: 20 },
    modes: ['story', 'solo', 'shared'],
  },
  // Boss d'essai défini par sa seule fiche (aucun code) : il reprend les planches du Colosse, teintées d'ombre.
  shade: {
    id: 'shade', name: 'Ombre du Colosse', title: 'Reflet d\'essai', test: true,
    lore: 'Une ombre du Titan, née de tes défaites. Elle sert de banc d\'essai au moteur des grands boss.',
    art: { dir: 'assets/world-boss', prefix: 'colossus_', frame: 128, foot: 122, filter: 'grayscale(1) brightness(0.55) sepia(1) hue-rotate(220deg) saturate(3)',
      anims: COLOSSUS_ANIMS, eyes: COLOSSUS_EYES, hands: { throw: [16, 34], throw3: [18, 44] },
      beamColors: { beam: ['#b04dff', '#e0a8ff', '#ffffff'], beam3: ['#ff2a8a', '#ff8ad0', '#fff0fa'] } },
    fight: { ...COLOSSUS_FIGHT, name: 'Ombre du Colosse', seconds: 45,
      phases: [{ at: 0.6, id: 'quake', name: 'Ombre tremblante', hit: 0.15, speed: 1.2, power: 1.2 }, { at: 0.3, id: 'fury', name: 'Fureur d\'ombre', hit: 0.25, speed: 1.4, power: 1.4 }],
      abilities: [{ id: 'eyebeam', name: 'Regard d\'ombre', hit: 0.12, from: 0 }] },
    rewards: { gems: 10 },
    modes: ['solo'],
  },
};
// v9.8 (H7) : Titans du jour — un par jour de la semaine (0 = dimanche), même moteur et mêmes planches que le Colosse,
// une teinte, un nom et des phases propres (fiches seules, aucun code). Ils n'entrent pas au Panthéon (titan: true).
const TITAN_ZONE = { blue: 'ocean', red: 'volcano', green: 'forest', light: 'sky', dark: 'void' };
const titan = (id, element, name, title, filter, beam, phase) => ({
  id, element, name, title, titan: true, test: true, lore: `${title}. Chaque jour, un Titan différent se dresse contre Ascendrya.`,
  // v9.11 (2) : vraies planches teintées (tools/art/recolor_titans.py) au lieu d'un filtre ; décor du monde de son élément.
  zone: TITAN_ZONE[element], filterOld: filter,
  art: { dir: `assets/world-boss/${id}`, prefix: 'colossus_', frame: 128, foot: 122, anims: COLOSSUS_ANIMS, eyes: COLOSSUS_EYES,
    hands: { throw: [16, 34], throw3: [18, 44] }, beamColors: { beam: [...beam, '#ffffff'], beam3: [...beam, '#fff3c8'] } },
  fight: { ...COLOSSUS_FIGHT, name, seconds: 60, phases: [{ at: 0.6, id: 'quake', name: phase[0], hit: 0.16, speed: 1.2, power: 1.2 }, { at: 0.3, id: 'fury', name: phase[1], hit: 0.26, speed: 1.45, power: 1.45 }] },
  rewards: { gems: 30 }, modes: ['solo'],
});
export const DAY_TITANS = [
  titan('titan_sun', 'light', 'Titan du Soleil', 'Titan du dimanche', 'sepia(1) saturate(4) hue-rotate(5deg) brightness(1.05)', ['#ffd23f', '#fff3a8'], ['Éclat solaire', 'Midi ardent']),
  titan('titan_moon', 'dark', 'Titan de la Lune', 'Titan du lundi', 'grayscale(1) brightness(1.15) sepia(.3) hue-rotate(180deg)', ['#c9d8ff', '#ffffff'], ['Marée lunaire', 'Nuit sans fin']),
  titan('titan_ember', 'red', 'Titan des Braises', 'Titan du mardi', 'sepia(1) saturate(5) hue-rotate(-25deg)', ['#ff5a1f', '#ffb04a'], ['Pluie de cendres', 'Cœur de lave']),
  titan('titan_tide', 'blue', 'Titan des Marées', 'Titan du mercredi', 'sepia(1) saturate(4) hue-rotate(160deg)', ['#2fd8ff', '#8ff8ff'], ['Lame de fond', 'Abysse']),
  titan('titan_thorn', 'green', 'Titan des Ronces', 'Titan du jeudi', 'sepia(1) saturate(4) hue-rotate(60deg)', ['#4cd26a', '#b8ff9a'], ['Ronces', 'Forêt vivante']),
  titan('titan_storm', 'light', 'Titan de l\'Orage', 'Titan du vendredi', 'sepia(1) saturate(3) hue-rotate(200deg) brightness(1.1)', ['#9fc3ff', '#ffffff'], ['Tonnerre', 'Colère du ciel']),
  titan('titan_void', 'dark', 'Titan du Néant', 'Titan du samedi', 'grayscale(1) brightness(0.6) sepia(1) hue-rotate(230deg) saturate(3)', ['#b04dff', '#e0a8ff'], ['Faille', 'Éclipse']),
];
for (const t of DAY_TITANS) GRAND_BOSSES[t.id] = t;

export const grandBoss = (id) => GRAND_BOSSES[id] ?? GRAND_BOSSES.colossus;

// v10.15 : GÉANTS — de vrais nouveaux grands boss, chacun avec SA silhouette (plus des Colosses recolorés).
// Même moteur que le Colosse (core/world-boss.js, render/world-boss-scene.js) ; seules les planches changent.
//   Planches : assets/world-boss/<id>/<id>_<anim>.png, une rangée de `n` images de `frame` px (exactement `n`).
//   Minimum : idle, attack, hurt, throw (jet), beam (souffle / rayon), death. Les autres (idle3, attack3, hurt3,
//   throw3, beam3, quake, embers, transform, fury) sont facultatives : absentes, le moteur prend la plus proche
//   (render/world-boss-scene.js, ANIM_FALLBACK).
//   Attaques : `boulder` = un projectile lancé en arc (projectile propre : art.projectile), `eyebeam` = un souffle ou
//   un rayon qui part du point `eyes` (bouche, yeux, gueule) et balaie l'équipe. Phases : quake (frappe au sol),
//   meteors (pluie), fury (colère) avec les noms du géant.
//   `ready: false` tant que les planches ne sont pas dans assets/ : le géant reste hors du jeu (ni Panthéon, ni
//   rotations, ni admin). Planches posées et repères mesurés (eyes, hands) → `ready: true` ; le test
//   tests/v1015-giants.test.js vérifie alors chaque fichier.
const GIANT_ANIMS = (frame) => ({
  idle: { n: 8, fps: 8, loop: true }, idle3: { n: 8, fps: 10, loop: true },
  attack: { n: 9, fps: 16 }, attack3: { n: 9, fps: 18 }, hurt: { n: 6, fps: 16 },
  quake: { n: 9, fps: 11 }, embers: { n: 9, fps: 11 }, transform: { n: 13, fps: 12 },
  death: { n: 13, fps: 10 }, rise: { n: 13, fps: 14, src: 'death', reverse: true },
  throw: { n: 13, durs: [0.07, 0.07, 0.08, 0.09, 0.12, 0.12, 0.1, 0.1, 0.24, 0.1, 0.1, 0.08, 0.08], release: 9 },
  beam: { n: 13, durs: [0.08, 0.08, 0.08, 0.22, 0.26, 0.1, 0.32, 0.32, 0.32, 0.1, 0.08, 0.08, 0.08], charge: [3, 4], fire: [5, 8] },
  throw3: { n: 13, durs: [0.07, 0.07, 0.08, 0.09, 0.12, 0.12, 0.1, 0.1, 0.24, 0.1, 0.1, 0.08, 0.08], release: 9 },
  beam3: { n: 13, durs: [0.08, 0.08, 0.08, 0.22, 0.26, 0.1, 0.32, 0.32, 0.32, 0.1, 0.08, 0.08, 0.08], charge: [3, 4], fire: [5, 8] },
  _frame: frame,
});
// Les animations que les planches doivent fournir (les autres sont facultatives).
export const GIANT_REQUIRED_ANIMS = ['idle', 'attack', 'hurt', 'throw', 'beam', 'death'];
const giant = ({ id, name, title, lore, element, zone, mapZone, accent, frame = 160, beam, projectile, debris = null, phases, abilities, ready = false, extra = null, from = null, art: artX = {} }) => {
  const anims = GIANT_ANIMS(frame);
  delete anims._frame;
  // `extra` : planches facultatives réellement posées (les autres animations ne sont pas déclarées : le moteur prend la plus proche).
  if (extra) for (const k of Object.keys(anims)) if (k !== 'rise' && !GIANT_REQUIRED_ANIMS.includes(k) && !extra.includes(k)) delete anims[k];
  return {
    id, name, title, lore, element, zone, mapZone, accent, giant: true, ready, extra, from,
    art: { dir: `assets/world-boss/${id}`, prefix: `${id}_`, frame, foot: frame - 6, exactSheets: true, anims,
      // Repères à mesurer sur les planches finies (pixels de l'image) : `eyes.beam` = 13 × [x1, y1, x2, y2] (bouche :
      // deux fois le même point), `hands.throw` = point d'où part le projectile à l'image `release`.
      eyes: { beam: Array.from({ length: 13 }, () => [Math.round(frame * 0.22), Math.round(frame * 0.3), Math.round(frame * 0.22), Math.round(frame * 0.3)]) },
      hands: { throw: [Math.round(frame * 0.15), Math.round(frame * 0.3)] },
      beamColors: { beam: [...beam, '#ffffff'], beam3: [...beam, '#fff3c8'] },
      projectile, debris,
      box: [frame * 0.06, frame * 0.08, frame * 0.88, frame * 0.88], ...artX },
    fight: { ...COLOSSUS_FIGHT, name,
      phases: [
        { at: 0.75, id: 'quake', name: phases[0], hit: 0.18, speed: 1.15, power: 1.15 },
        { at: 0.5, id: 'meteors', name: phases[1], hit: 0.24, speed: 1.3, power: 1.3 },
        { at: 0.25, id: 'fury', name: phases[2], hit: 0.3, speed: 1.5, power: 1.5 },
      ],
      abilities: [{ id: 'boulder', name: abilities[0], hit: 0.11, from: 0 }, { id: 'eyebeam', name: abilities[1], hit: 0.15, from: 1 }] },
    rewards: { gems: 60, shards: 25 },
    modes: ['solo', 'shared'],
  };
};

// Arbre-Monde : points de départ du rayon (yeux gauche et droit) sur chaque image de `beam` et `beam3`, mesurés sur les planches.
const EYES_TREANT = [[83, 86, 93, 86], [85, 80, 96, 80], [88, 74, 98, 74], [86, 71, 99, 71], [86, 71, 99, 71], [86, 72, 99, 72], [86, 73, 99, 73], [86, 74, 99, 74], [86, 75, 99, 75], [88, 76, 98, 76], [86, 80, 96, 80], [84, 84, 94, 84], [83, 86, 93, 86]];
const EYES_TREANT3 = [[77, 93, 87, 93], [76, 92, 87, 92], [72, 86, 85, 86], [75, 87, 87, 87], [74, 88, 86, 88], [74, 88, 86, 88], [70, 90, 80, 90], [74, 88, 86, 88], [67, 91, 79, 91], [68, 93, 80, 93], [66, 94, 79, 94], [66, 96, 76, 96], [77, 93, 87, 93]];

export const GIANTS = [
  giant({ id: 'leviathan', name: 'Léviathan des Abysses', title: 'Le Titan des Abysses', element: 'blue', zone: 'abyss', mapZone: 11, accent: '#2fb8ff',
    lore: 'Un serpent de mer aussi long qu\'une côte. Quand il remonte, la mer recule.',
    beam: ['#2fd8ff', '#8ff8ff'], projectile: { vfx: 'wb_boulder', tint: '#3fa8ff', tint3: '#8ff8ff', size: 2.4, spin: 4, dust: ['#2f6f9a', '#9fe8ff'] },
    phases: ['Lame de fond', 'Tourbillon', 'Colère des profondeurs'], abilities: ['Bulle des abysses', 'Jet abyssal'] }),
  giant({ id: 'dragon_mother', name: 'Mère des Dragons', title: 'Reine des ailes de feu', element: 'red', zone: 'volcano', mapZone: 8, accent: '#ff4a2a', frame: 192,
    lore: 'Chaque dragon d\'Ascendrya est sorti d\'un de ses œufs. Elle vient reprendre ses enfants.',
    beam: ['#ff5a1f', '#ffb04a'], projectile: { vfx: 'wb_boulder', tint: '#ff6a2a', tint3: '#ffd23f', size: 2.2, spin: 6, dust: ['#5a2a1a', '#ff8a3d'] },
    phases: ['Battement d\'ailes', 'Pluie de feu', 'Brasier royal'], abilities: ['Boule de feu', 'Souffle ardent'] }),
  giant({ id: 'storm_god', name: 'Dieu de l\'Orage', title: 'Celui qui forge la foudre', element: 'light', zone: 'sky', mapZone: 7, accent: '#9fc3ff', frame: 160,
    lore: 'Un géant de nuages et de bronze. Son marteau fait tomber la pluie sur trois royaumes.',
    beam: ['#9fc3ff', '#ffffff'], projectile: { vfx: 'wb_boulder', tint: '#c9d8ff', tint3: '#ffe24a', size: 2.4, spin: 12, dust: ['#56607a', '#e0eaff'] },
    phases: ['Tonnerre', 'Pluie d\'éclairs', 'Colère du ciel'], abilities: ['Marteau-tonnerre', 'Foudre divine'] }),
  giant({ id: 'hydra', name: 'Hydre des Marais', title: 'Les cinq têtes du marais', element: 'green', zone: 'swamp', mapZone: 6, accent: '#7be36a',
    lore: 'Coupe une tête, deux repoussent. Le marais tout entier respire avec elle.',
    beam: ['#7be36a', '#d8ff9a'], projectile: { vfx: 'wb_boulder', tint: '#7be36a', tint3: '#d8ff4a', size: 2, spin: 3, dust: ['#3a5a2a', '#a8e05a'] }, debris: '#4a6a3a',
    phases: ['Morsures', 'Pluie d\'acide', 'Cinq têtes'], abilities: ['Crachat d\'acide', 'Souffle putride'] }),
  giant({ id: 'sand_wyrm', name: 'Ver des Sables colossal', title: 'Le dévoreur des dunes', element: 'red', zone: 'desert', mapZone: 3, accent: '#e0b15a',
    lore: 'Il nage sous les dunes. Une caravane entière a disparu dans sa gueule.',
    beam: ['#e0b15a', '#fff0b8'], projectile: { vfx: 'wb_boulder', tint: '#d8a85a', tint3: '#ff8a3d', size: 2.6, spin: 8, dust: ['#a07a3a', '#f0d08a'] }, debris: '#c8a060',
    phases: ['Dunes mouvantes', 'Tempête de sable', 'Gueule béante'], abilities: ['Rocher des dunes', 'Souffle de sable'] }),
  giant({ id: 'frost_giant', name: 'Jarl du Givre', title: 'Roi des géants des glaces', element: 'blue', zone: 'mountains', mapZone: 4, accent: '#8fe4ff', frame: 160,
    lore: 'Il dort sous le glacier depuis mille hivers. Son réveil gèle les rivières.',
    beam: ['#8fe4ff', '#ffffff'], projectile: { vfx: 'wb_boulder', tint: '#bfefff', tint3: '#ffffff', size: 2.6, spin: 7, dust: ['#6a8aa0', '#e8f8ff'] }, debris: '#d8f0ff',
    phases: ['Avalanche', 'Grêle', 'Hiver éternel'], abilities: ['Bloc de glace', 'Souffle glacial'] }),
  giant({ id: 'elder_treant', name: 'Arbre-Monde', title: 'Le plus vieux des sylvains', element: 'green', zone: 'forest', mapZone: 1, accent: '#63d98a', frame: 192,
    lore: 'Une forêt entière sur ses épaules. Il ne se lève que si les bois sont menacés.',
    beam: ['#b8ff6a', '#f0ffc8'], projectile: { vfx: 'wb_boulder', tint: '#8a6a3a', tint3: '#b8ff6a', size: 2.6, spin: 5, dust: ['#5a4a2a', '#7bc85a'] }, debris: '#5aa04a',
    phases: ['Racines', 'Pluie de feuilles', 'Colère de la forêt'], abilities: ['Souche lancée', 'Rayon de sève'],
    ready: true, from: '2028-08', extra: ['idle3', 'attack3', 'throw3', 'beam3', 'quake', 'embers', 'transform'],
    art: { hands: { throw: [12, 106], throw3: [18, 118] },
      eyes: { beam: EYES_TREANT, beam3: EYES_TREANT3 }, box: [10, 8, 172, 178], shadow: 62, scaleMul: 0.8, dx: 36, dxPhone: 120,
      beamColors: { beam: ['#b8ff6a', '#f0ffc8', '#ffffff'], beam3: ['#ff8a2a', '#ffd23f', '#fff3c8'] } } }),
  giant({ id: 'void_maw', name: 'Dévoreur du Néant', title: 'La gueule entre les étoiles', element: 'dark', zone: 'void', mapZone: 9, accent: '#b04dff',
    lore: 'Une bouche sans fond, des yeux par centaines. Il a déjà mangé un monde.',
    beam: ['#b04dff', '#e0a8ff'], projectile: { vfx: 'wb_boulder', tint: '#8a3dff', tint3: '#ff4ad8', size: 2.2, spin: 10, dust: ['#3a1a5a', '#c08aff'] }, debris: '#6a3aa0',
    phases: ['Faille', 'Pluie d\'étoiles', 'Éclipse totale'], abilities: ['Orbe du Néant', 'Regard des mille yeux'] }),
];
for (const g of GIANTS) if (g.ready) GRAND_BOSSES[g.id] = g;
// Géants prêts (planches posées), dans l'ordre de leur arrivée dans les Fêtes (data/fest.js, festBoss).
export const READY_GIANTS = GIANTS.filter((g) => g.ready).map((g) => g.id);
export const GIANT_ORDER = GIANTS.map((g) => g.id);
// Grands boss que l'admin peut programmer (catalogue live) : fiches complètes, Titans du jour et géants prêts.
export const GRAND_BOSS_IDS = Object.keys(GRAND_BOSSES);
