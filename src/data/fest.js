// v10.14 : FÊTES DU MOIS — le système d'événements (docs/evenements-v1014.md).
// Chaque mois civil porte deux événements, suivis chacun de 2 jours d'échange (boutique seule) :
//   - la GRANDE FÊTE (jours 1 à 14) : le héros du mois à invoquer (bannière vedette), la Carte du héros (30 étapes),
//     le World Boss du thème, les jalons d'invocation, des missions du jour et de la fête, une boutique de fête ;
//   - la PETITE FÊTE (du 17 à l'avant-dernier jour − 2) : plus légère, un héros ET un familier gratuits à farmer sur
//     un sentier (monnaie gagnée en jouant), des missions et une boutique.
// Fichier sans import : il est lu par le jeu (core/fest.js), par le serveur (server/live.mjs : calendrier programmé
// d'un coup) et par les tests. Les 6 premiers mois sont écrits à la main (FEST_MONTHS) ; au-delà, la rotation
// automatique (festMonth) prend le relais à partir des listes FEST_POOLS.

const DAY = 86400000;

export const FEST_RULES = {
  firstMonth: '2027-02', // premier mois géré par les Fêtes (le calendrier 9.2.9 tourne jusque-là)
  grandDays: 14, // jours de jeu de la grande fête (du 1er au 14)
  pauseDays: 2, // jours d'échange après chaque fête : boutique et récompenses déjà gagnées seulement
  monthsAhead: 24, // feuilles connues du catalogue live (2 ans) ; au-delà : nouvelle mise à jour
  // Carte du héros (grande fête) : 3 régions × 10 étapes, combat automatique résolu d'un coup (comme l'Expédition).
  map: {
    regions: 3, stagesPerRegion: 10, fightSeconds: 30,
    stageScale: { from: 0.55, per: 0.022 }, // étape n : record × (0,55 + 0,022 n) → de 0,57 à 1,21 × le record
    stageCoins: 14, regionCoins: 60, fragmentStage: 30, bossUnlockStage: 10,
    featuredBonus: 0.25, // +25 % de monnaie aux étapes quand le héros du mois est dans l'équipe
  },
  boss: { attemptsPerDay: 3, coinsBase: 6, coinsPerTier: 3 }, // World Boss : 6 + 3 par palier atteint
  // Jalons d'invocation (grande fête) : invocations sur la bannière limitée pendant la fête.
  summonSteps: [
    { at: 10, give: { gems: 300 } },
    { at: 30, give: { ticketLimited: 3 } },
    { at: 50, give: { ssrFragment: 1 } },
    { at: 80, give: { ticketLimited: 5 } },
    { at: 120, give: { ssrFragment: 1, gems: 500 } },
  ],
  // Petite fête : un peu de monnaie en jouant (1 par 150 monstres, 1 par boss), 25 au plus par jour.
  trickle: { kills: 150, bosses: 1, dailyCap: 25 },
  leftoverShards: 10, // monnaie restante à la fin de l'échange : convertie en éclats (10 par pièce), jamais perdue
  // Missions du jour : 3 tirées chaque jour dans la liste de la fête (même tirage pour tous les joueurs).
  dailyCount: 3,
};

// Missions possibles (types comptés par core/missions.js → trackMissions). `tab` : bouton « Y aller ».
export const FEST_MISSION_TYPES = {
  login: { label: 'Se connecter', tab: null },
  kills: { label: 'Vaincre {n} monstres', tab: null },
  bosses: { label: 'Vaincre {n} boss', tab: 'boss' },
  dungeons: { label: 'Terminer {n} donjons', tab: 'dungeons' },
  summons: { label: 'Faire {n} invocations', tab: 'summon' },
  upgrades: { label: 'Faire {n} améliorations', tab: 'forge' },
};
// Missions du jour : { type, n, coins }.
const DAILY_GRAND = [
  { type: 'login', n: 1, coins: 10 }, { type: 'kills', n: 600, coins: 15 }, { type: 'bosses', n: 5, coins: 15 },
  { type: 'dungeons', n: 2, coins: 15 }, { type: 'summons', n: 10, coins: 15 }, { type: 'upgrades', n: 5, coins: 10 },
];
const DAILY_LIGHT = [
  { type: 'login', n: 1, coins: 10 }, { type: 'kills', n: 500, coins: 15 }, { type: 'bosses', n: 4, coins: 15 },
  { type: 'dungeons', n: 2, coins: 15 }, { type: 'upgrades', n: 5, coins: 10 },
];
// Missions de la fête (toute sa durée) : { id, type, n, coins, give }.
const EVENT_GRAND = [
  { id: 'g_kills', type: 'kills', n: 6000, coins: 40, give: { ticketPermanent: 3 } },
  { id: 'g_bosses', type: 'bosses', n: 40, coins: 40, give: { ticketPet: 3 } },
  { id: 'g_dungeons', type: 'dungeons', n: 12, coins: 40, give: { keys: 3 } },
  { id: 'g_summons', type: 'summons', n: 40, coins: 40, give: { ticketLimited: 2 } },
  { id: 'g_upgrades', type: 'upgrades', n: 40, coins: 30, give: { shards: 400 } },
  { id: 'g_login', type: 'login', n: 10, coins: 50, give: { gems: 300 } },
];
const EVENT_LIGHT = [
  { id: 'l_kills', type: 'kills', n: 4000, coins: 25, give: { ticketPermanent: 2 } },
  { id: 'l_bosses', type: 'bosses', n: 25, coins: 25, give: { ticketPet: 2 } },
  { id: 'l_dungeons', type: 'dungeons', n: 8, coins: 25, give: { keys: 2 } },
  { id: 'l_upgrades', type: 'upgrades', n: 25, coins: 20, give: { shards: 300 } },
  { id: 'l_login', type: 'login', n: 7, coins: 30, give: { gems: 200 } },
];
export const FEST_MISSIONS = { grand: { daily: DAILY_GRAND, event: EVENT_GRAND }, light: { daily: DAILY_LIGHT, event: EVENT_LIGHT } };

// Sentier de la petite fête : on avance au total de monnaie GAGNÉE (dépenser ne fait pas reculer).
// `hero` / `pet` : un exemplaire du héros / familier gratuit de la fête (déjà au maximum : sa conversion habituelle).
export const LIGHT_PATH = [
  { at: 20, give: { gems: 100 } },
  { at: 45, give: { shards: 300 } },
  { at: 75, hero: true },
  { at: 110, give: { ticketPermanent: 2 } },
  { at: 150, pet: true },
  { at: 195, give: { keys: 3 } },
  { at: 245, give: { ticketPet: 3 } },
  { at: 300, hero: true },
  { at: 360, give: { gems: 300 } },
  { at: 425, pet: true },
  { at: 495, give: { ticketLimited: 3 } },
  { at: 570, hero: true, pet: true },
];

// Boutiques. `copy: 'hero' | 'pet' | 'featured'` : un exemplaire de l'unité de la fête. Prix en monnaie de la fête.
export const FEST_SHOPS = {
  grand: [
    { id: 'lim', give: { ticketLimited: 1 }, price: 40, stock: 15 },
    { id: 'frag', give: { ssrFragment: 1 }, price: 180, stock: 1 },
    { id: 'perm', give: { ticketPermanent: 1 }, price: 30, stock: 10 },
    { id: 'pet', give: { ticketPet: 1 }, price: 25, stock: 8 },
    { id: 'grimoire', give: { grimoire: 10 }, price: 15, stock: 6 },
    { id: 'ascension', give: { ascension: 5 }, price: 20, stock: 4 },
    { id: 'keys', give: { keys: 2 }, price: 15, stock: 5 },
    { id: 'shards', give: { shards: 300 }, price: 10, stock: 10 },
  ],
  light: [
    { id: 'hero', copy: 'hero', price: 120, stock: 2 },
    { id: 'pet', copy: 'pet', price: 100, stock: 2 },
    { id: 'lim', give: { ticketLimited: 1 }, price: 40, stock: 5 },
    { id: 'perm', give: { ticketPermanent: 1 }, price: 30, stock: 5 },
    { id: 'pett', give: { ticketPet: 1 }, price: 25, stock: 5 },
    { id: 'keys', give: { keys: 2 }, price: 15, stock: 4 },
    { id: 'shards', give: { shards: 300 }, price: 10, stock: 8 },
  ],
};

// ROTATIONS. Chaque liste tourne d'un cran par mois ; sa longueur fixe le délai minimal avant un retour
// (5 héros vedettes → pas de retour avant 5 mois). Ajouter une unité dessinée = l'ajouter à sa liste.
export const FEST_POOLS = {
  featured: ['demon_queen', 'sylvan_guardian', 'archangel', 'shadow_lord', 'ice_empress'], // SSR (bannière limitée)
  boss: ['titan_ember', 'titan_thorn', 'titan_sun', 'titan_void', 'titan_tide', 'colossus', 'titan_storm', 'titan_moon'], // data/grand-bosses.js
  freeHero: ['rose_blade', 'elf_archer', 'high_priest', 'ninja', 'witch', 'barbarian'], // SR alliés
  freePet: ['crystal_hedgehog', 'fairy', 'golem', 'owl'], // familiers rares et épiques
  zone: [5, 0, 7, 9, 4, 8, 2, 1], // décor de la Carte du héros (index de data/zones.js), aligné sur le boss
};

// Les 6 premiers mois, écrits à la main (thèmes, noms, monnaies). Les unités suivent la rotation ci-dessus.
export const FEST_MONTHS = [
  {
    month: '2027-02',
    grand: { title: 'Fête des Cœurs ardents', tagline: 'La Reine démone ouvre son bal de braises.', currency: 'Cœurs de braise', regions: ['Jardins rougeoyants', 'Salle du bal', 'Trône des braises'] },
    light: { title: 'Bal des Lames roses', tagline: 'Danse avec la Lame rose, adopte un Hérisson de cristal.', currency: 'Pétales' },
  },
  {
    month: '2027-03',
    grand: { title: 'Éveil du Printemps', tagline: 'La Gardienne sylvestre réveille la forêt.', currency: 'Bourgeons', regions: ['Clairière', 'Bois ancien', 'Cœur de la forêt'] },
    light: { title: 'Concours des Archers', tagline: 'L\'Archère elfe et la Fée des bois t\'attendent.', currency: 'Flèches d\'or' },
  },
  {
    month: '2027-04',
    grand: { title: 'Aube dorée', tagline: 'L\'Archange descend des Îles célestes.', currency: 'Plumes d\'aube', regions: ['Escalier des nuages', 'Temple du ciel', 'Porte du soleil'] },
    light: { title: 'Pèlerinage de Lumière', tagline: 'Le Grand prêtre et le Mini-golem font route avec toi.', currency: 'Cierges' },
  },
  {
    month: '2027-05',
    grand: { title: 'Nuit des Éclipses', tagline: 'Le Seigneur de l\'ombre déchire le ciel.', currency: 'Éclats d\'éclipse', regions: ['Faille', 'Citadelle d\'ombre', 'Trône du Néant'] },
    light: { title: 'Nuit des Shinobis', tagline: 'Le Ninja et le Hibou érudit veillent dans l\'ombre.', currency: 'Shuriken' },
  },
  {
    month: '2027-06',
    grand: { title: 'Solstice de Givre', tagline: 'L\'Impératrice des glaces fige les marées.', currency: 'Flocons', regions: ['Côte gelée', 'Palais de glace', 'Trône de givre'] },
    light: { title: 'Sabbat de la Saint-Jean', tagline: 'La Sorcière allume les feux, le Hérisson de cristal revient.', currency: 'Braises de lune' },
  },
  {
    month: '2027-07',
    grand: { title: 'Festival des Titans', tagline: 'La Reine démone revient affronter le Colosse.', currency: 'Médailles', regions: ['Arène d\'été', 'Volcan', 'Sommet des Titans'] },
    light: { title: 'Jeux des Champions', tagline: 'Le Barbare et la Fée des bois relèvent le défi.', currency: 'Lauriers' },
  },
];

// Noms des unités (affichage, admin) : vérifiés contre data/companions.js et data/grand-bosses.js par les tests.
export const FEST_NAMES = {
  demon_queen: 'Reine démone', sylvan_guardian: 'Gardienne sylvestre', archangel: 'Archange', shadow_lord: 'Seigneur de l\'ombre', ice_empress: 'Impératrice des glaces',
  rose_blade: 'Lame rose', elf_archer: 'Archère elfe', high_priest: 'Grand prêtre', ninja: 'Ninja', witch: 'Sorcière', barbarian: 'Barbare',
  crystal_hedgehog: 'Hérisson de cristal', fairy: 'Fée des bois', golem: 'Mini-golem', owl: 'Hibou érudit',
};

// ---- Calendrier ----------------------------------------------------------------------------------------------------
const pad = (n) => String(n).padStart(2, '0');
const monthKey = (y, m) => `${y}-${pad(m)}`; // m : 1..12
function monthIndexOf(key) {
  const [y, m] = key.split('-').map(Number);
  const [y0, m0] = FEST_RULES.firstMonth.split('-').map(Number);
  return (y - y0) * 12 + (m - m0);
}
function monthAt(index) {
  const [y0, m0] = FEST_RULES.firstMonth.split('-').map(Number);
  const t = m0 - 1 + index;
  const y = y0 + Math.floor(t / 12);
  const m = (((t % 12) + 12) % 12) + 1;
  return { y, m, key: monthKey(y, m) };
}
const localMs = (y, m, d) => new Date(y, m - 1, d).getTime(); // minuit, heure locale (comme EVENTS.anchor)
const pick = (list, i) => list[((i % list.length) + list.length) % list.length];

// Mois n (0 = premier mois des Fêtes) : ses deux fêtes, dates comprises.
export function festMonth(index) {
  const { y, m, key } = monthAt(index);
  const hand = FEST_MONTHS.find((x) => x.month === key);
  const days = new Date(y, m, 0).getDate();
  const P = FEST_RULES.pauseDays;
  const boss = pick(FEST_POOLS.boss, index);
  const featured = pick(FEST_POOLS.featured, index);
  const hero = pick(FEST_POOLS.freeHero, index);
  const pet = pick(FEST_POOLS.freePet, index);
  const gStart = localMs(y, m, 1);
  const gPlay = localMs(y, m, 1 + FEST_RULES.grandDays);
  const lStart = localMs(y, m, 1 + FEST_RULES.grandDays + P);
  const lPlay = localMs(y, m, days + 1 - P);
  const next = localMs(y, m + 1, 1);
  const auto = { grand: { title: `Fête du héros : ${FEST_NAMES[featured] ?? featured}`, tagline: 'Le héros du mois t\'attend.', currency: 'Insignes', regions: ['Avant-poste', 'Terres du héros', 'Sanctuaire'] },
    light: { title: `Foire : ${FEST_NAMES[hero] ?? hero}`, tagline: 'Un héros et un familier gratuits à gagner.', currency: 'Jetons' } };
  const g = { ...auto.grand, ...(hand?.grand ?? {}) };
  const l = { ...auto.light, ...(hand?.light ?? {}) };
  return {
    index, month: key, handWritten: Boolean(hand),
    grand: { id: `fest-${key}-g`, sheet: `${key}-g`, kind: 'grand', index, ...g, featured, boss, zone: pick(FEST_POOLS.zone, index), start: gStart, playEnd: gPlay, end: lStart },
    light: { id: `fest-${key}-l`, sheet: `${key}-l`, kind: 'light', index, ...l, hero, pet, start: lStart, playEnd: lPlay, end: next },
  };
}

// Feuille par identifiant (« 2027-02-g », « 2027-02-l ») ou null.
export function festSheet(sheet) {
  const m = /^(\d{4}-\d{2})-([gl])$/.exec(String(sheet ?? ''));
  if (!m) return null;
  const i = monthIndexOf(m[1]);
  if (i < 0 || i >= FEST_RULES.monthsAhead) return null;
  const mo = festMonth(i);
  return m[2] === 'g' ? mo.grand : mo.light;
}

// Identifiants connus (paramètre `sheet` du type live « fest »).
export const FEST_SHEET_IDS = Array.from({ length: FEST_RULES.monthsAhead }, (_, i) => [festMonth(i).grand.sheet, festMonth(i).light.sheet]).flat();

// Fête du calendrier à l'instant t (sans serveur), ou null.
export function festAt(t) {
  const d = new Date(t);
  const i = monthIndexOf(monthKey(d.getFullYear(), d.getMonth() + 1));
  if (i < 0 || i >= FEST_RULES.monthsAhead) return null;
  const mo = festMonth(i);
  for (const f of [mo.grand, mo.light]) if (f.start <= t && t < f.end) return f;
  return null;
}
export const festStartMs = () => festMonth(0).grand.start;

// Éléments à programmer côté serveur pour `months` mois à partir de l'instant t : une fête par élément (échange
// compris dans ses dates) et une vedette par mois (héros du mois, du 1er au dernier jour).
export function festLiveItems(t, months = 6) {
  const first = Math.max(0, monthIndexOf(`${new Date(t).getFullYear()}-${pad(new Date(t).getMonth() + 1)}`));
  const events = [];
  const banners = [];
  for (let i = first; i < Math.min(first + months, FEST_RULES.monthsAhead); i += 1) {
    const mo = festMonth(i);
    for (const f of [mo.grand, mo.light]) if (f.end > t) events.push({ ref: 'fest', sheet: f.sheet, title: f.title, start: f.start, end: f.end });
    if (mo.light.end > t) banners.push({ ref: mo.grand.featured, start: mo.grand.start, end: mo.light.end });
  }
  return { events, banners };
}
export { DAY as FEST_DAY };

// Nettoyage d'une sauvegarde (core/wallet.js sanitizeEconomy) : champ `fest` d'un enregistrement d'événement.
export function sanitizeFestRecord(raw) {
  if (!raw || typeof raw !== 'object') return undefined;
  const int = (v, max = 1e9) => (Number.isFinite(v) ? Math.max(0, Math.min(max, Math.floor(v))) : 0);
  const map = (o) => Object.fromEntries(Object.entries(o && typeof o === 'object' ? o : {}).slice(0, 12).filter(([k]) => /^[a-z]{1,12}$/.test(k)).map(([k, v]) => [k, int(v)]));
  const strs = (a, n) => (Array.isArray(a) ? a.filter((x) => typeof x === 'string' && x.length <= 16).slice(0, n) : []);
  const d = raw.daily ?? {};
  const t = raw.trickle ?? {};
  return {
    earned: int(raw.earned), steps: strs(raw.steps, 40), summons: int(raw.summons, 1e6),
    daily: { day: typeof d.day === 'string' ? d.day.slice(0, 10) : '', p: map(d.p), done: strs(d.done, 12) },
    trickle: { day: typeof t.day === 'string' ? t.day.slice(0, 10) : '', got: int(t.got, 1000), kills: int(t.kills, 1e6) },
    until: int(raw.until, 1e15), settled: raw.settled === true,
  };
}

