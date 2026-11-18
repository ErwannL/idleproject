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
