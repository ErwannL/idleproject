// Héros jouables : tous des chevaliers, chacun avec un rôle distinct.
// Aucun n'est indispensable : le Chevalier de départ peut finir la campagne.
// `palette` recolore le sprite du chevalier (tabard/cape B-P, dorures W, plumet K).
// `bonus` s'applique à 1 étoile ; chaque étoile supplémentaire ajoute `perStarPct` % de ces valeurs.

export const HEROES = [
  {
    id: 'knight', name: 'Chevalier', rarity: 'common', role: 'Polyvalent',
    description: 'Équilibré entre attaque et défense.',
    palette: { B: '#2f62b8', P: '#1d3b78', W: '#e8b64a', K: '#3b7de0' },
    bonus: { damagePct: 5, maxHpPct: 5 },
  },
  {
    id: 'paladin', name: 'Paladin', rarity: 'rare', role: 'Soutien',
    description: 'Se soigne en continu et tient longtemps.',
    palette: { B: '#e8e2d0', P: '#a9a08a', W: '#e8b64a', K: '#f2d083' },
    bonus: { regenPct: 1, maxHpPct: 10 },
  },
  {
    id: 'guardian', name: 'Gardien', rarity: 'rare', role: 'Défense',
    description: 'Bouclier massif : encaisse les coups des boss.',
    palette: { B: '#3f7f4a', P: '#24502c', W: '#cfd6e0', K: '#63d98a' },
    bonus: { armor: 8, maxHpPct: 15 },
  },
  {
    id: 'fortune_knight', name: 'Chevalier de fortune', rarity: 'epic', role: 'Économie',
    description: "Ramène plus d'or et de butin de chaque combat.",
    palette: { B: '#c99a2e', P: '#8a6418', W: '#ffffff', K: '#ffffff' },
    bonus: { goldPct: 30, dropChance: 2 },
  },
  {
    id: 'berserker', name: 'Berserker', rarity: 'epic', role: 'Dégâts',
    description: 'Frappe fort et vite, au prix de sa santé.',
    palette: { B: '#b8322f', P: '#7a1d1d', W: '#e8b64a', K: '#ff5a4a' },
    bonus: { damagePct: 20, attackSpeedPct: 10, maxHpPct: -10 },
  },
  {
    id: 'dragon_knight', name: 'Chevalier dragon', rarity: 'legendary', role: 'Tueur de boss',
    description: 'Spécialiste des combats contre les boss.',
    palette: { B: '#2a1f3d', P: '#150f22', W: '#ff8a3d', K: '#ff8a3d' },
    bonus: { damageVsBossPct: 30, damagePct: 10, critChance: 5 },
  },
];

// v9.0.6 : skins de héros — personnages complets dessinés (le corps du chevalier est remplacé : seule
// l'arme portée reste visible). Invocables (onglet Invocation → Héros), avec une bannière en vedette.
// `skin` : préfixe des images (skin_<id>_<pose>) ; `title`, `quote`, `tags` : pour la bannière.
HEROES.push(
  {
    id: 'fairy', name: 'Fée Lumibelle', rarity: 'epic', role: 'Soutien', skin: 'fairy', summon: true,
    title: 'Gardienne des clairières', quote: 'Chaque fleur garde un secret.', tags: ['Soutien', 'Soin', 'Nature'],
    description: 'Ses ailes répandent une poussière qui soigne.', bonus: { regenPct: 1.5, maxHpPct: 10 },
  },
  {
    id: 'valkyrie', name: 'Valkyrie Sigrún', rarity: 'epic', role: 'Défense', skin: 'valkyrie', summon: true,
    title: 'Lame des cieux', quote: 'Je ne recule devant aucun orage.', tags: ['Tank', 'Ciel', 'Acier'],
    description: 'Une armure céleste qui encaisse les coups des boss.', bonus: { armor: 6, maxHpPct: 12 },
  },
  {
    id: 'witch', name: 'Sorcière Morgaline', rarity: 'epic', role: 'Magie', skin: 'witch', summon: true,
    title: 'Sorcière de la lune pâle', quote: 'Un chaudron, trois étoiles et beaucoup d\'audace.', tags: ['Magie', 'Savoir', 'Lune'],
    description: 'Apprend plus vite et frappe plus fort.', bonus: { damagePct: 12, xpPct: 15 },
  },
  {
    id: 'vampire', name: 'Comte Vladimir', rarity: 'epic', role: 'Vol de vie', skin: 'vampire', summon: true,
    title: 'Comte des nuits rouges', quote: 'Votre force sera la mienne.', tags: ['Vol de vie', 'Ombre', 'Nuit'],
    description: 'Chaque coup lui rend de la vie.', bonus: { lifesteal: 3, damagePct: 8 },
  },
  {
    id: 'ninja', name: 'Kage le Ninja', rarity: 'epic', role: 'Vitesse', skin: 'ninja', summon: true,
    title: 'Lame de l\'ombre', quote: 'On ne m\'entend qu\'après.', tags: ['Vitesse', 'Critique', 'Ombre'],
    description: 'Frappe vite et touche les points faibles.', bonus: { attackSpeedPct: 12, critChance: 5 },
  },
  {
    id: 'demoness', name: 'Lilith la Diablesse', rarity: 'legendary', role: 'Destruction', skin: 'demoness', summon: true,
    title: 'Reine des braises', quote: 'Brûle, et souviens-toi de mon nom.', tags: ['Dégâts', 'Feu', 'Enfer'],
    description: 'Une puissance de feu dévastatrice.', bonus: { damagePct: 25, critChance: 5 },
  },
  {
    id: 'seraph', name: 'Séraphin Auriel', rarity: 'legendary', role: 'Lumière', skin: 'seraph', summon: true,
    title: 'Héraut de l\'aube', quote: 'La lumière ne faiblit jamais.', tags: ['Soin', 'Lumière', 'Anti-boss'],
    description: 'Lumière qui protège et brûle les boss.', bonus: { maxHpPct: 20, regenPct: 2, damageVsBossPct: 15 },
  },
  {
    id: 'grombar', name: 'Roi Grombar', rarity: 'legendary', role: 'Tank', skin: 'grombar', summon: true,
    title: 'Maître de la Forge Éternelle', quote: 'La montagne ne tombe jamais.', tags: ['Tank', 'Zone', 'Terre'],
    description: 'Le roi nain : une forteresse vivante qui brise les boss.', bonus: { maxHpPct: 30, armor: 10, damageVsBossPct: 10 },
  },
);
// Les chevaliers aux couleurs d'antan (Paladin, Gardien…) restent invocables comme apparences.
for (const h of HEROES) if (h.id !== 'knight' && !h.skin) h.summon = true;
// Le skin voyage avec la « palette » du héros (src/render/pixel.js heroComposite).
for (const h of HEROES) if (h.skin) h.palette = { skin: h.skin };

export const HERO_STAR_BONUS_PCT = 20; // +20 % des bonus du héros par étoile au-delà de la première
export const STARTER_HERO = 'knight';
