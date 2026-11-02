// v9.1.3 (doc4 partie B) : personnages de bannière (un nouveau SSR toutes les 2 semaines), Archives, mode monde.
// Drapeau `BANNER_RULES.enabled` : désactivé par défaut. Tant qu'il l'est, aucun perso `bannerOnly` n'existe pour le
// jeu (UNITS = les 26 unités permanentes), aucune bannière, aucun budget (B = 100 partout) : rien ne change pour les
// joueurs. Le développeur l'active (et règle `start`) quand il lance les sorties ; la version dev peut l'activer pour
// essayer (`?banniere=demo`, main.js).
//
// Liste à suivre pour chaque nouveau SSR (les oublis sont silencieux ; tests/v913-banner.test.js en vérifie une partie) :
// rôle dans data/synergies.js (COMPANION_ROLES : Archer, Assassin, Mage ou Berserker seulement), AURA_COLORS
// (data/auras.js), ALLY_STYLE (render/scene.js, corps à corps par défaut), sprites `ally_<id>` et variantes
// (render/art.js ; ici on peut réutiliser le sprite d'un allié existant), nom et textes en deux langues (i18n).
import { COMPANIONS, HIT_30, signature } from './companions.js';

export const BANNER_RULES = {
  enabled: false,
  start: '2026-11-16', // J1 de la sortie n° 1 (minuit, heure locale) — à fixer par le développeur
  periodDays: 14, // une bannière = 14 jours ; J15 = Archives et bannière suivante
  netPulls: 50, // filet : la vedette au plus tard au 50e tirage sans elle (1re copie seulement)
  previewDays: 7, // J-7 : aperçu du perso suivant
  tiersFrom: [4, 4, 4, 8, 8], // jour d'ouverture des paliers 1 à 5 (J4 et J8)
  worldLevels: 10, // niveaux du monde ; le dernier ouvre à J10
  lastLevelDay: 10,
  levelKills: 12, // ennemis par niveau du monde avant son boss
  tierTargets: [0.6, 0.8, 1.0, 1.3, 1.0], // PV du boss du palier / boss de l'étape record (records.bestStage)
  tierSeconds: 120, // temps d'un essai de palier ou de niveau
  scoreSeconds: 60, // score : dégâts infligés au boss du monde en 60 s (à caler)
  scoreSeed: 0x5c0e5c0e, // hasard fixe du score : même entrée → même score
  releaseGems: 3000, // « 30 tickets d'événement par sortie » : tickets fondus dans les gemmes, 1 ticket = 100 gemmes
  // Coût moyen en tirages sur la bannière (simulation du vrai tirage, tests/v913-banner.test.js) : vedette obtenue, 3★.
  cost: { first: 32.7, third: 154 },
};

// Personnages de bannière. `release` = numéro de la sortie (k_unité). `world.zone` = index de ZONES (décor, ennemis et
// boss du monde, sans nouveau boss : la liste de la Tour reste la même). `tier4Alt` = les 2 anciens qui, à 5★ dans
// l'équipe, ouvrent aussi le palier 4. `title` = Titre du palier 5.
// Perso de démonstration : sert aux tests et à la version dev. Sprite d'un allié existant (Seigneur de l'ombre).
export const BANNER_UNITS = [
  {
    id: 'demo_ssr', name: 'Lame du crépuscule', rarity: 'legendary', sprite: 'ally_shadow_lord', kind: 'ally', fx: '#d07bff',
    bannerOnly: true, release: 1, demo: true,
    passive: { damagePct: 14, critChance: 3 },
    skill: { name: 'Taille du soir', type: 'hit', every: 5, value: 1.6, text: 'Frappe à 160 % des dégâts du héros' },
    ultimate: signature('Rideau de nuit', HIT_30, { type: 'heal', value: 8 }),
    world: { zone: 2 }, tier4Alt: ['shadow_lord', 'ninja'], title: 'Ombre du crépuscule',
  },
];

// Unités connues du jeu : les 26 permanentes, plus les persos de bannière quand le drapeau est actif.
// COMPANIONS reste le bassin permanent gelé (8 R, 7 SR, 5 SSR + familiers) : encyclopédie, hauts faits, invocation.
export const UNITS = [...COMPANIONS];

// Version dev (main.js, `?banniere=demo&jour=N`) : bannière de démonstration active, au jour N (J1 par défaut).
export function startDemoBanner(now = Date.now(), day = 1) {
  const d = new Date(now);
  const j = Math.max(1 - BANNER_RULES.previewDays, Math.min(BANNER_RULES.periodDays + 1, Math.floor(day) || 1)); // J-7 à J15
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - (j - 1));
  BANNER_RULES.start = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
  setBannersEnabled(true);
}

export function setBannersEnabled(on) {
  BANNER_RULES.enabled = Boolean(on);
  UNITS.length = 0;
  UNITS.push(...COMPANIONS, ...(BANNER_RULES.enabled ? BANNER_UNITS : []));
}
