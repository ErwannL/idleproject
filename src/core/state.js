// État persistant de la partie (tout ce qui est sauvegardé) et validation au chargement.
import { levelForStage, locateStage, stagesPerCycle } from './combat.js';
import { ZONES } from '../data/zones.js';
import { migrateOceanWorld } from './migrations-v920.js';
import { migrateEconomy928 } from './migrations-v928.js'; // v9.2.8 : économie du document du producteur
import { emptyEconomy, sanitizeEconomy } from './wallet.js';
import { emptyPity } from './invocation.js';
import { cleanWishlist } from './gacha.js';
import { sanitizeCosmetics } from './cosmetics.js';
import { emptyTimes, sanitizeTimes } from './times.js';
import { BALANCE } from '../data/balance.js';
import { computeHeroStats } from './stats.js'; // v9.3.9 : fusion Peau de fer → Défense
import { AFFIXES, EQUIP_SLOTS, HERO_SLOTS, RARITIES, SLOTS, STARTER_WEAPON, STAT_LABELS, eqSlot, heroSlot } from '../data/items.js';
import { BOSSES } from '../data/enemies.js';
import { COMPANION_RULES } from '../data/companions.js';
import { BANNER_RULES, UNITS } from '../data/banners.js';
import { sanitizeWorlds } from './banner.js';
import { CONTRACT_TYPES } from '../data/contracts.js';
import { DUNGEON_PATHS, DUNGEONS, STARTING_KEYS } from '../data/dungeons.js';
import { HEROES, STARTER_HERO } from '../data/heroes.js';
import { BOSS_POWERS, POWER_RULES } from '../data/powers.js';
import { REBIRTH, TALENTS } from '../data/rebirth.js';

import { legacyTalentRefund } from './rebirth.js';
import { SKILLS } from '../data/skills.js';
import { ensureContracts } from './contracts.js';
import { emptyMissions, periodKey, sanitizeMissions } from './missions.js';
import { itemBase, makeItem, rarityById, refreshItemStats } from './loot.js';
import { bossDungeon, bossFirstStage, powerSlots, rollPower } from './powers.js';
import { Rng } from './rng.js';
import { clampTeam } from './companions.js';
import { sanitizePrestige } from './prestige.js';
import { PRESTIGE } from '../data/prestige.js';
import { sanitizeRushes } from './rushes.js';
import { sanitizeCheats, unlockedSpeeds } from './cheats.js';
import { TOWER, sanitizeTower } from './tower.js';
import { ACHIEVEMENTS, sanitizeAchievements } from './achievements.js';
import { emptyLoadouts, sanitizeLoadouts } from './loadouts.js';
import { emptyCodex, sanitizeCodex } from './codex.js';
import { sanitizeHeroClass } from './classes.js';
import { STARTER_CLASS } from '../data/classes.js';
import { seedEncyclopedia } from './encyclopedia.js';
import { emptyExpeditions, sanitizeExpeditions } from './expeditions.js';
import { setById } from './sets.js';
import { STASH_OVERFLOW, STASH_SIZE, placeItem } from './stash.js';
import { museumItems } from './museum.js';
import { sanitizeBounty } from './bounty.js';
import { emptyTranscend, sanitizeTranscend } from './transcend.js';
import { sanitizeChallenge } from './challenge.js';
import { sanitizeArena } from './arena.js'; // v9.3.2
import { migrateBagOverflow, migrateCodex, migrateCopies, migrateEssence, migrateMannequins, migrateMissionTrack, migrateTickets } from './migrations-v913.js';
import { MISSION_TRACK } from '../data/missions.js';
import { grantReward } from './rewards.js';
import { ENCYCLOPEDIA_SECTIONS } from './encyclopedia.js';
import { MIGRATED_SKILLS, cleanSkills } from './progression.js'; // v9.3.3
import { sanitizeCompanionGear, wornItems } from './companion-gear.js';
import { GEAR_BASES } from '../data/companion-gear.js';
import { migrateCompanionGear934, migrateEquipment934 } from './migrations-v934.js'; // v9.3.4 (f)
import { migrateEquipmentPlaces938, splitParts938 } from './migrations-v938.js'; // v9.3.8

// v1 : prototype · v2 (format identique) · v3 : pouvoirs, Renaissance, verrou
// v4 : niveau, compétences, héros, compagnons, invocation, contrats, événements, matériaux, donjons.
// v8 (v9.1.3) : refontes du lot E et F, conversions indépendantes dans core/migrations-v913.js.
// v9 (v9.2.0, monde marin) : Royaume englouti inséré en monde 11 (étapes > 200 converties, core/migrations-v920.js).
// v10 (v9.2.8) : économie du document du producteur (bannières, tickets, cosmétiques sans bonus ; migrations-v928.js).
export const SAVE_VERSION = 13; // v9.3.8 : héros à 6 places (pièces réunies rendues), familiers sans équipement
export const SAVE_VERSION_PREV = 10; // v8.4 : nouvel équilibrage (remboursement des améliorations) · v8.5 : arbre de 500 talents (fragments remboursés)
export const SORT_OPTIONS = ['rarity', 'level', 'power', 'recent'];

export function createNewState(now = Date.now(), seed = Math.floor(Math.random() * 2 ** 32)) {
  const state = {
    version: SAVE_VERSION,
    createdAt: now,
    lastSaved: now,
    gold: 0,
    upgrades: Object.fromEntries(Object.keys(BALANCE.upgrades).map((k) => [k, 0])),
    stage: 1,
    maxStage: 1,
    kills: 0,
    autoAdvance: true,
    farmBoss: null, // v9.0.4 : boss réaffronté en boucle depuis le Codex
    equipment: Object.fromEntries(Object.keys(HERO_SLOTS).map((slot) => [slot, null])),
    inventory: [],
    nextItemId: 1,
    rngSeed: seed >>> 0,
    records: {
      goldEarned: 0, kills: 0, bossesDefeated: 0, itemsFound: 0, rebirths: 0, contractsDone: 0, summons: 0,
      bestStage: 1, // v9.1.0 : meilleure étape jamais atteinte (la Renaissance ne la remet pas à zéro)
      bestLevel: 1, // v9.1.3 : meilleur niveau du héros jamais atteint (idem)
    },
    ui: { slotFilter: 'all', sortBy: 'rarity', autoRecycle: 'off',
      // Étape 3 (gains UX) : nouvelle partie → les Communs moins bons que l'équipé sont recyclés quand le sac est plein.
      recycle: { mode: 'full', rarities: ['common'], slots: Object.keys(SLOTS) }, notify: { loot: true, boss: true, events: true }, focus: false },
    // Progression permanente (conservée par la Renaissance).
    level: 1,
    xp: 0,
    skills: { quick: 1 }, // points dépensés par compétence
    skillAuto: true,
    powers: {}, // bossId -> { current, pending, victories, rerolls, sinceHigh, charges, masteryClaimed }
    equippedPowers: [],
    fragments: 0,
    talents: {},
    heroes: { active: STARTER_HERO, owned: { [STARTER_HERO]: { stars: 1 } } },
    companions: { owned: {}, equipped: [] },
    gems: BALANCE.summon.startingGems,
    keys: STARTING_KEYS,
    materials: { shards: 0, grimoire: 0, ascension: 0, mastery: 0 }, // v9.1.3 : essences fondues dans les éclats · v9.3.3 : ressources universelles
    // v9.2.8 : compteurs par bannière (limitée, permanente, familiers) et wishlist de la permanente.
    summon: { total: 0, pity: emptyPity(), wishlist: [] },
    economy: emptyEconomy(), // v9.2.8 : tickets, fragments SSR, écus, revenus du mois, achats, héritage des apparences
    cosmetics: { themes: {} }, // v9.2.8 : thèmes de boutique possédés (les apparences possédées : heroes.owned)
    contracts: [],
    nextContractId: 0,
    inbox: [],
    nextEventId: 0,
    dungeon: null,
    dungeonsCleared: {},
    dungeonBest: {}, // meilleure difficulté réussie par donjon (0 facile, 1 normal, 2 difficile)
    tower: null, // v8.2 : ascension en cours de la Tour de l'Éternité { floor, startPlay }
    towerBest: 0,
    bossRetry: null, // v8.4 : { stage, power } après une défaite contre un boss
    achievements: { claimed: {} }, // v8.3 : hauts faits réclamés
    towerLast: null,
    towerHistory: [], // v8.9 : dernières ascensions (écran Records)
    dungeonRuns: {}, // v8.1 : « donjon:difficulté » → { last, best, tries } (rapports d'expédition)
    missions: emptyMissions(),
    prestige: { count: 0, stars: 0, perks: {} },
    rushes: { levels: {}, active: {}, cooldown: {}, auto: false }, // boosts à durée limitée
    cheats: { effects: [], reveal: false, speeds: [] },
    loadouts: emptyLoadouts(),
    fusionPity: {}, // v9.1.3 (doc3 lot 2) : jauge de fusion « emplacement|rareté » → points (0 à 100), gardée à la Renaissance
    codex: emptyCodex(),
    playSeconds: 0, // temps de jeu cumulé (boost des premières heures)
    times: emptyTimes(), // v9.1.7 : statistiques de temps (core/times.js)
    expeditions: emptyExpeditions(), // v8.5 : compagnons en mission
    challenge: null, // v8.5 : défi de la semaine en cours { wave, kills, startPlay }
    challengeWeek: null, // { week, best, tries, extra }
    arena: null, // v9.3.2 : modes compagnons (core/arena.js)
    companionGear: null, // v9.3.3 : équipement des héros (alliés) et familiers
    challengeBest: 0,
    challengeHistory: [], // meilleures vagues des semaines passées
    talentRespecs: 0,
    transcend: emptyTranscend(), // v8.8 : Transcendance (Étoiles, bonus stellaires)
    stash: [], // v8.9 : coffre (300 places, jamais recyclé)
    museum: {}, // v9.0 : Musée des objets ancestraux { baseId: objet }
    bounty: null, // v8.9 : prime du jour
    heroClass: STARTER_CLASS, // v9.0.6 : classe du héros
    worlds: {}, // v9.1.3 (doc4 lot 6) : mode monde par perso { levels, tiers, decor, title, score }
    worldRun: null, // essai en cours dans un monde (jamais gardé au chargement)
  };
  state.equipment.weapon = makeItem(state, STARTER_WEAPON, 'common', 1);
  seedEncyclopedia(state);
  ensureContracts(state, new Rng(state.rngSeed ^ 0x51ed27));
  return state;
}

export function isValidItem(item) {
  if (!item || typeof item !== 'object') return false;
  if (typeof item.id !== 'string' || !/^it\d+$/.test(item.id)) return false;
  if (!(item.slot in SLOTS) || !rarityById(item.rarity)) return false;
  const base = itemBase(item.baseId);
  if (!base || base.slot !== item.slot) return false;
  if (!Number.isInteger(item.level) || item.level < 1) return false;
  if (!item.stats || typeof item.stats !== 'object') return false;
  return Object.entries(item.stats).every(([k, v]) => k in STAT_LABELS && Number.isFinite(v));
}

function cleanItem(item) {
  const base = itemBase(item.baseId);
  const affixes = Array.isArray(item.affixes)
    ? item.affixes.filter((a) => a && a.type in AFFIXES && Number.isFinite(a.value)).map((a) => (Number.isFinite(a.base) ? { type: a.type, value: a.value, base: a.base } : { type: a.type, value: a.value }))
    : [];
  const boosts = {};
  for (const [k, v] of Object.entries(obj(item.boosts))) if (Number.isInteger(v) && v > 0) boosts[k] = v;
  return {
    id: item.id, baseId: item.baseId, name: base.name, slot: item.slot,
    rarity: item.rarity, level: item.level, stats: { ...item.stats }, affixes, effect: null,
    locked: item.locked === true, upgrades: int(item.upgrades, 0), boosts,
    ...(setById(item.set) ? { set: item.set } : {}),
    ...(cleanParts(item.parts).length ? { parts: cleanParts(item.parts) } : {}),
    ...(GEAR_CLASS_IDS.includes(item.cls) ? { cls: item.cls } : {}),
    ...(GEAR_BASES.some((b) => b.id === item.cg) ? { cg: item.cg } : {}),
  };
}
// v9.3.4 (f) : pièces réunies dans une place (casque dans l'armure, bijoux dans l'accessoire).
// v9.3.8 (2.3) : la classe « Familier » n'existe plus — un ancien objet de familier devient un objet de la classe du héros
// (classe absente = celle du héros) ; porté par un familier, il revient au sac (companion-gear.js).
const GEAR_CLASS_IDS = ['attacker', 'defender', 'support'];
function cleanParts(parts) {
  if (!Array.isArray(parts)) return [];
  return parts.slice(0, 3).filter((p) => p && itemBase(p.baseId) && p.stats && typeof p.stats === 'object'
    && Object.entries(p.stats).every(([k, v]) => k in STAT_LABELS && Number.isFinite(v)))
    .map((p) => ({ baseId: p.baseId, stats: { ...p.stats },
      ...(rarityById(p.rarity) ? { rarity: p.rarity } : {}), ...(Number.isInteger(p.level) && p.level >= 1 ? { level: p.level } : {}),
      ...(p.boosts && typeof p.boosts === 'object' ? { boosts: Object.fromEntries(Object.entries(p.boosts).filter(([, v]) => Number.isInteger(v) && v > 0)) } : {}),
      affixes: (Array.isArray(p.affixes) ? p.affixes : []).filter((a) => a && a.type in AFFIXES && Number.isFinite(a.value)).map((a) => ({ type: a.type, value: a.value })) }));
}

const int = (v, fallback, min = 0) => (Number.isInteger(v) && v >= min ? v : fallback);
const num = (v, fallback, min = 0) => (Number.isFinite(v) && v >= min ? v : fallback);
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const powerIds = (bossId) => new Set(BOSS_POWERS[bossId].map((p) => p.id));

function cleanPowers(state, raw) {
  if (raw.powers && typeof raw.powers === 'object') {
    const beforeV4 = int(raw.version, 1) < 4;
    for (const bossId of Object.keys(BOSSES)) {
      const entry = raw.powers[bossId];
      if (!entry || !powerIds(bossId).has(entry.current)) continue;
      state.powers[bossId] = {
        current: entry.current,
        pending: powerIds(bossId).has(entry.pending) && entry.pending !== entry.current ? entry.pending : null,
        victories: int(entry.victories, 1, 1),
        rerolls: int(entry.rerolls, 0),
        sinceHigh: int(entry.sinceHigh, 0),
        // v3 → v4 : une charge offerte pour ne pas bloquer les relances déjà possibles.
        charges: Math.min(POWER_RULES.maxCharges + 1, int(entry.charges, beforeV4 ? 1 : 0)),
        masteryClaimed: int(entry.masteryClaimed, 0),
      };
    }
  } else {
    // Sauvegarde v1/v2 : les boss de campagne déjà battus (étape dépassée) donnent leur pouvoir.
    const rng = new Rng(state.rngSeed ^ 0x2545f491);
    for (const bossId of Object.keys(BOSSES)) {
      const stage = bossFirstStage(bossId);
      if (stage !== null && stage < state.maxStage && !bossDungeon(bossId) && !BOSSES[bossId].tier) {
        state.powers[bossId] = {
          current: rollPower(bossId, rng), pending: null, victories: 1, rerolls: 0, sinceHigh: 0, charges: 1, masteryClaimed: 0,
        };
      }
    }
  }
  const wanted = Array.isArray(raw.equippedPowers) ? raw.equippedPowers : Object.keys(state.powers);
  state.equippedPowers = [...new Set(wanted)].filter((id) => state.powers[id]).slice(0, powerSlots(state));
}

// v9.2.8 : compteurs des bannières, bornés (jamais au-delà de la garantie).
function cleanPity(raw) {
  const out = emptyPity();
  const src = obj(raw);
  const caps = { limited: 99, permanent: 99, pet: 59 };
  for (const k of Object.keys(out)) {
    const p = obj(src[k]);
    out[k].ssr = Math.min(int(p.ssr, 0), caps[k]);
    out[k].sr = Math.min(int(p.sr, 0), 9);
    if (k === 'limited') out[k].guaranteed = p.guaranteed === true;
  }
  return out;
}

function cleanCollections(state, raw) {
  const heroes = obj(raw.heroes);
  for (const hero of HEROES) {
    const stars = int(obj(heroes.owned)[hero.id]?.stars, 0, 1);
    if (stars) state.heroes.owned[hero.id] = { stars: Math.min(stars, BALANCE.summon.maxStars) };
  }
  if (state.heroes.owned[heroes.active]) state.heroes.active = heroes.active;

  const companions = obj(raw.companions);
  // v9.1.3 (doc4 partie B) : unités connues = permanentes + persos de bannière actifs. Un perso inconnu de ce client
  // (sortie plus récente, ou drapeau coupé) n'est plus effacé : il est gardé tel quel dans `companions.unknown`
  // (borné) et revient dès que le client le connaît. L'essai gratuit (`trial`) n'est jamais un exemplaire.
  const clean = (owned) => {
    const out = {
      stars: Math.min(int(owned.stars, 1, 1), COMPANION_RULES.maxCopies), // v9.1.3 : 6 exemplaires (skins : 5)
      level: Math.min(int(owned.level, 1, 1), 20),
    };
    // v9.3.3 : niveaux de compétence ; perso possédé avant la 9.3.3 : active au niveau 8 (rien de perdu).
    const skills = cleanSkills(owned.skills, out) ?? (int(raw.version, 1) < 11 ? { ...MIGRATED_SKILLS } : undefined);
    if (skills) out.skills = skills;
    return out;
  };
  const rawOwned = { ...obj(companions.unknown), ...obj(companions.owned) };
  for (const [id, owned] of Object.entries(rawOwned)) {
    if (!owned || typeof owned !== 'object' || owned.trial === true) continue;
    if (UNITS.some((c) => c.id === id)) state.companions.owned[id] = clean(owned);
    else if (/^[a-z0-9_]{2,32}$/.test(id) && Object.keys(state.companions.unknown ?? {}).length < 100) {
      state.companions.unknown ??= {};
      state.companions.unknown[id] = clean(owned);
    }
  }
  migrateCopies(state, int(raw.version, 1)); // v9.1.3 (doc4 lot 1) : 5 exemplaires → 6, une seule fois (v7 → v8)
  // v9.1.3 (doc4 lot 6) : un essai dans un monde n'est jamais repris au chargement ; l'équipe d'avant l'essai revient.
  const run = obj(raw.worldRun);
  const equipped = Array.isArray(run.prevEquipped) ? run.prevEquipped : Array.isArray(companions.equipped) ? companions.equipped : [];
  state.companions.equipped = clampTeam([...new Set(equipped)].filter((id) => state.companions.owned[id]));

  const summon = obj(raw.summon);
  // v9.2.8 : compteurs par bannière (data/economy.js) ; une sauvegarde d'avant est convertie (migrations-v928.js).
  state.summon = { total: int(summon.total, 0), pity: cleanPity(summon.pity), wishlist: cleanWishlist(summon.wishlist) };
  if (typeof summon.archiveTarget === 'string' && /^[a-z0-9_]{2,32}$/.test(summon.archiveTarget)) state.summon.archiveTarget = summon.archiveTarget;
  if (int(summon.gift, 0) > 0) state.summon.gift = int(summon.gift, 0);
  state.worlds = sanitizeWorlds(raw.worlds);
  if (Array.isArray(summon.history)) {
    state.summon.history = summon.history.filter((h) => h && typeof h.id === 'string' && typeof h.rarity === 'string')
      .slice(0, 60).map((h) => ({ id: h.id, ...(['hero', 'companion'].includes(h.kind) ? { kind: h.kind } : {}), rarity: h.rarity, at: int(h.at, 0) })); // v9.1.3 : kind
  }
}

function cleanActivities(state, raw) {
  if (Array.isArray(raw.contracts)) {
    state.contracts = raw.contracts
      .filter((c) => c && c.type in CONTRACT_TYPES && int(c.target, 0, 1) && Number.isInteger(c.id))
      .slice(0, 3)
      .map((c) => ({ id: c.id, type: c.type, target: c.target, progress: Math.min(int(c.progress, 0), c.target), reward: { ...obj(c.reward) }, rare: c.rare === true }));
  }
  state.nextContractId = Math.max(int(raw.nextContractId, 0), ...state.contracts.map((c) => c.id));
  ensureContracts(state, new Rng(state.rngSeed ^ state.nextContractId));

  // v9.3.8 : la Semaine (de nouveau une période) repart de zéro pour une sauvegarde d'avant le format 13 : ses anciennes
  // hebdomadaires ont été converties dans la Piste du mois (v9.1.3) et ne doivent pas compter deux fois.
  state.missions = sanitizeMissions(int(raw.version, 1) < 13 && raw.missions ? { ...raw.missions, weekly: undefined } : raw.missions);
  state.prestige = sanitizePrestige(raw.prestige);
  // v7.7 : anciennes étoiles de prestige → fragments anciens.
  if (state.prestige.stars > 0) {
    state.fragments += state.prestige.stars * PRESTIGE.legacyStarFragments;
    state.prestige.stars = 0;
  }
  state.rushes = sanitizeRushes(raw.rushes);
  state.cheats = sanitizeCheats(raw.cheats);
  sanitizeTower(state, raw);
  state.achievements = sanitizeAchievements(raw.achievements);
  const br = raw.bossRetry;
  state.bossRetry = br && Number.isInteger(br.stage) && br.stage > 0 && Number.isFinite(br.power) && br.power > 0 ? { stage: br.stage, power: br.power, ...(Number.isFinite(br.hpPct) && br.hpPct >= 0 && br.hpPct <= 100 ? { hpPct: Math.round(br.hpPct) } : {}) } : null;
  if (state.tower && raw.dungeon) state.tower = null; // jamais les deux à la fois
  state.loadouts = sanitizeLoadouts(raw.loadouts);
  state.fusionPity = sanitizeFusionPity(raw.fusionPity);
  state.expeditions = sanitizeExpeditions(raw.expeditions, state);
  // Jamais à la fois dans l'équipe et en expédition.
  state.companions.equipped = state.companions.equipped.filter((id) => !state.expeditions.slots.some((s) => s?.companionId === id));
  sanitizeChallenge(state, raw);
  sanitizeArena(state, raw);
  state.transcend = sanitizeTranscend(raw.transcend);
  state.bounty = sanitizeBounty(raw.bounty);
  state.codex = sanitizeCodex(raw.codex);
  migrateCodex(state, ENCYCLOPEDIA_SECTIONS); // v9.1.3 (lot E)
  state.heroClass = sanitizeHeroClass(raw.heroClass);
  if (Number.isFinite(raw.rebirthPower) && raw.rebirthPower >= 0) state.rebirthPower = raw.rebirthPower; // v9.0.6
  state.playSeconds = Math.max(0, Number(raw.playSeconds) || 0);
  if (Number.isFinite(raw.recordAt) && raw.recordAt >= 0) state.recordAt = Math.min(raw.recordAt, state.playSeconds); // v9.3.8
  state.times = sanitizeTimes(raw.times);
  // v9.1.7 : partie d'avant les statistiques de temps — les mondes déjà atteints le sont à une date inconnue (-1),
  // pour ne pas compter le temps total d'aujourd'hui comme temps pour les atteindre.
  if (!raw.times) {
    const best = state.records.bestStage;
    const reached = best > stagesPerCycle() ? ZONES.length - 1 : locateStage(best).zone;
    if (best > 1 || (state.playSeconds ?? 0) > 0) for (let z = 0; z <= reached; z++) state.times.firstZone[z] = -1;
  }

  state.nextEventId = int(raw.nextEventId, 0);
  if (Array.isArray(raw.inbox)) {
    // v9.1.3 (doc3 lot 1) : 'held' = objet reçu en attente (sac et coffre pleins), jamais rogné par la limite.
    const valid = raw.inbox
      .filter((e) => e && Number.isInteger(e.id) && ['chest', 'merchant', 'gems', 'portal', 'wanderer', 'held'].includes(e.type))
      .filter((e) => (e.type === 'held' ? isValidItem(e.item) : !e.item || isValidItem(e.item)));
    state.inbox = [...valid.filter((e) => e.type !== 'held').slice(0, BALANCE.events.inboxSize), ...valid.filter((e) => e.type === 'held')]
      .map((e) => ({ ...e, item: e.item ? cleanItem(e.item) : undefined, reward: obj(e.reward), price: num(e.price, 0), seen: e.seen === true }));
  }

  const run = raw.dungeon;
  if (run && DUNGEONS.some((d) => d.id === run.id) && run.path in DUNGEON_PATHS) {
    state.dungeon = {
      id: run.id, room: int(run.room, 1, 1), kills: int(run.kills, 0), slot: run.slot in SLOTS ? run.slot : 'any',
      path: run.path, level: int(run.level, 1, 1), earned: { ...obj(run.earned) },
      difficulty: ['easy', 'normal', 'hard'].includes(run.difficulty) ? run.difficulty : 'easy',
      // v9.1.0 : début de la tentative conservé (sinon sa durée valait 0 s après un rechargement).
      startPlay: Number.isFinite(run.startPlay) && run.startPlay >= 0 ? run.startPlay : (Number(raw.playSeconds) || 0),
    };
  }
  for (const d of DUNGEONS) {
    const n = int(obj(raw.dungeonsCleared)[d.id], 0);
    if (n) state.dungeonsCleared[d.id] = n;
    const best = Number(obj(raw.dungeonBest)[d.id]);
    if (Number.isInteger(best) && best >= 0 && best <= 2) state.dungeonBest[d.id] = best;
    // Victoires d'avant les difficultés (≤ v7.6) : elles comptent comme une réussite en Facile.
    else if (n) state.dungeonBest[d.id] = 0;
  }
  for (const [key, entry] of Object.entries(obj(raw.dungeonRuns))) {
    const [id, diff] = key.split(':');
    if (!DUNGEONS.some((d) => d.id === id) || !['easy', 'normal', 'hard'].includes(diff) || !entry || typeof entry !== 'object') continue;
    const clean = (r) => (r && typeof r === 'object' && Number.isFinite(r.progress) ? {
      won: r.won === true, room: int(r.room, 1, 1), rooms: int(r.rooms, 1, 1), progress: r.progress,
      bossHpPct: Number.isFinite(r.bossHpPct) ? r.bossHpPct : null, seconds: int(r.seconds, 0), level: int(r.level, 1, 1),
      heroLevel: int(r.heroLevel, 1, 1), at: int(r.at, 0),
      gear: Array.isArray(r.gear) ? r.gear.slice(0, 12).filter((g) => g && typeof g.baseId === 'string').map((g) => ({
        baseId: g.baseId, name: String(g.name ?? '').slice(0, 60), rarity: String(g.rarity ?? 'common'), level: int(g.level, 1, 1), upgrades: int(g.upgrades, 0) })) : [],
      team: Array.isArray(r.team) ? r.team.filter((t) => typeof t === 'string').slice(0, 6) : [],
    } : null);
    state.dungeonRuns[key] = { last: clean(entry.last), best: clean(entry.best), tries: int(entry.tries, 0) };
  }
}

// v7.6 : les mondes passent de 10 à 20 étapes (et la croissance par étape est divisée par 2 en log).
// Une ancienne étape s (monde z, étape k) devient z*20 + 2k-1 ; les niveaux d'objet doublent (2L-1).
export function oldStageToNew(s) {
  const n = Math.max(1, Math.floor(Number(s) || 1));
  const zone = Math.min(5, Math.floor((n - 1) / 10));
  return zone * 20 + 2 * (n - zone * 10) - 1;
}

function migrateTo20Stages(raw) {
  const out = { ...raw };
  const item = (it) => (it && typeof it === 'object' && Number.isFinite(it.level) ? { ...it, level: Math.max(1, 2 * it.level - 1) } : it);
  out.maxStage = oldStageToNew(raw.maxStage);
  out.stage = oldStageToNew(raw.stage);
  out.kills = 0;
  if (Array.isArray(raw.inventory)) out.inventory = raw.inventory.map(item);
  if (raw.equipment && typeof raw.equipment === 'object') {
    out.equipment = Object.fromEntries(Object.entries(raw.equipment).map(([k, v]) => [k, item(v)]));
  }
  if (Array.isArray(raw.inbox)) out.inbox = raw.inbox.map((e) => (e && typeof e === 'object' ? { ...e, item: item(e.item), stage: oldStageToNew(e.stage) } : e));
  if (raw.dungeon && typeof raw.dungeon === 'object') out.dungeon = { ...raw.dungeon, level: oldStageToNew(raw.dungeon.level) };
  return out;
}

// v9.1.3 (doc3 lot 2) : rareté fusionnable = présente dans BALANCE.forge.fusion et pas la dernière.
const fusionRarity = (r, balance) => Boolean(balance.forge.fusion?.[r]) && RARITIES.findIndex((x) => x.id === r) >= 0
  && RARITIES.findIndex((x) => x.id === r) < RARITIES.length - 1;

// v9.1.3 (doc3 lot 2) : jauge de fusion, clés « emplacement|rareté » valides, points entiers bornés de 0 à 100
// (sans montée de SAVE_VERSION : champ absent = jauges vides).
export function sanitizeFusionPity(raw, balance = BALANCE) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [key, value] of Object.entries(raw)) {
    const [slot, rarity, extra] = key.split('|');
    const v = Math.round(Number(value));
    if (extra !== undefined || !(slot in SLOTS) || !fusionRarity(rarity, balance) || !Number.isFinite(v) || v <= 0) continue;
    out[key] = Math.min(100, v);
  }
  return out;
}

// Accepte n'importe quelle donnée lue sur disque et renvoie un état valide.
// Les champs absents ou corrompus reprennent leur valeur par défaut.
export function sanitizeState(input, balance = BALANCE, now = Date.now()) {
  let raw = input;
  const state = createNewState(now);
  if (!raw || typeof raw !== 'object') return state;
  if (int(raw.version, 1) < 5) raw = migrateTo20Stages(raw);
  if (int(raw.version, 1) < 9) raw = migrateOceanWorld(raw); // v9.2.0 (monde marin)
  if (int(raw.version, 1) < 12) raw = migrateEquipment934(raw); // v9.3.4 (f) : 3 places
  raw = migrateEquipmentPlaces938(raw); // v9.3.8 : héros à 6 places (sans effet sur une sauvegarde déjà à 6 places)

  state.createdAt = num(raw.createdAt, now);
  state.lastSaved = num(raw.lastSaved, now);
  state.gold = Math.floor(num(raw.gold, 0));
  for (const key of Object.keys(state.upgrades)) {
    const raw0 = int(raw.upgrades?.[key], 0);
    const cap = balance.upgrades[key].maxLevel ?? Infinity;
    state.upgrades[key] = Math.min(raw0, cap);
    // v9.0.6 : niveaux au-delà d'un nouveau plafond (Butin d'or : 100) → l'or dépensé pour eux est rendu.
    if (raw0 > cap && int(raw.version, 1) >= 6) {
      const up = balance.upgrades[key];
      const refund = up.baseCost * (up.costGrowth ** raw0 - up.costGrowth ** cap) / (up.costGrowth - 1);
      if (Number.isFinite(refund) && refund > 0) state.gold += Math.floor(refund);
    }
  }
  // v8.4 : les coûts des améliorations changent → l'or dépensé avant est remboursé, à racheter au nouveau prix.
  if (int(raw.version, 1) < 6) {
    let refund = 0;
    for (const [key, up] of Object.entries(balance.upgrades)) {
      const L = state.upgrades[key];
      if (!up.oldCostGrowth || !L) continue;
      refund += up.baseCost * (up.oldCostGrowth ** L - 1) / (up.oldCostGrowth - 1);
      state.upgrades[key] = 0;
    }
    if (refund > 0 && Number.isFinite(refund)) {
      state.gold += Math.floor(refund);
      state.migrationRefund = Math.floor(refund);
    }
  }
  state.maxStage = int(raw.maxStage, 1, 1);
  state.stage = Math.min(int(raw.stage, 1, 1), state.maxStage);
  state.kills = Math.min(int(raw.kills, 0), balance.stages.killsPerStage);
  state.autoAdvance = typeof raw.autoAdvance === 'boolean' ? raw.autoAdvance : true;
  state.farmBoss = !state.autoAdvance && typeof raw.farmBoss === 'string' && BOSSES[raw.farmBoss] ? raw.farmBoss : null;
  state.rngSeed = int(raw.rngSeed, state.rngSeed);

  if (raw.equipment && typeof raw.equipment === 'object') {
    for (const slot of Object.keys(HERO_SLOTS)) {
      const item = raw.equipment[slot];
      state.equipment[slot] = isValidItem(item) && heroSlot(item) === slot ? cleanItem(item) : null;
    }
  }
  const items = Array.isArray(raw.inventory) ? raw.inventory.filter(isValidItem) : [];
  state.inventory = items.slice(0, balance.loot.inventorySize).map(cleanItem);
  // v9.1.3 : le coffre peut déborder (mannequins convertis), jusqu'à STASH_OVERFLOW objets de plus.
  state.stash = (Array.isArray(raw.stash) ? raw.stash.filter(isValidItem) : []).slice(0, STASH_SIZE + STASH_OVERFLOW).map(cleanItem);
  // v9.1.3 (doc3 lot 1, point 5) : un sac au-delà de sa taille (ancien changement de classe) n'est plus rogné :
  // le surplus passe au coffre (même dépassement géré).
  migrateBagOverflow(state, items.slice(balance.loot.inventorySize).map(cleanItem));
  // v9.1.3 (lot F) : mannequins fondus dans le coffre.
  migrateMannequins(state, raw.mannequins, { stashSize: STASH_SIZE, bagSize: balance.loot.inventorySize, isValid: isValidItem, clean: cleanItem });
  // v9.0 : Musée (un objet ancestral par vitrine).
  for (const [baseId, item] of Object.entries(obj(raw.museum))) {
    if (isValidItem(item) && item.baseId === baseId && itemBase(baseId)?.signature) state.museum[baseId] = cleanItem(item);
  }

  for (const key of Object.keys(state.records)) state.records[key] = int(raw.records?.[key], 0);
  // v9.1.0 : partie d'avant la meilleure étape — estimée (étape max, donjons réussis, Renaissances, Tour).
  if (!state.records.bestStage) {
    const cleared = DUNGEONS.filter((d) => int(obj(raw.dungeonsCleared)[d.id], 0) > 0).map((d) => d.unlockStage);
    const reborn = int(raw.records?.rebirths, 0) > 0 || Number(raw.rebirthPower) > 0 || int(raw.transcend?.count, 0) > 0;
    state.records.bestStage = Math.max(state.maxStage, ...cleared, reborn ? REBIRTH.minStage : 1, int(raw.towerBest, 0) > 0 ? TOWER.unlockStage : 1);
  }
  state.records.bestStage = Math.max(state.records.bestStage, state.maxStage);
  state.fragments = int(raw.fragments, 0);
  if (int(raw.version, 1) < 7) {
    // v8.5 : nouvel arbre (500 nœuds) → les fragments dépensés dans l'ancien sont rendus.
    const refund = legacyTalentRefund(raw.talents);
    if (refund > 0) {
      state.fragments += refund;
      state.migrationTalentRefund = refund;
    }
  } else {
    for (const talent of TALENTS) {
      const level = int(raw.talents?.[talent.id], 0);
      if (level > 0) state.talents[talent.id] = Math.min(level, talent.max);
    }
  }
  state.talentRespecs = int(raw.talentRespecs, 0);

  state.level = Math.min(int(raw.level, 1, 1), balance.level.maxLevel);
  // v9.1.3 : record de niveau et d'étape, au moins le niveau actuel et les paliers de hauts faits déjà réclamés.
  const rawClaimed = sanitizeAchievements(raw.achievements).claimed;
  const claimedTarget = (metric) => Math.max(1, ...ACHIEVEMENTS.filter((a) => a.metric === metric && rawClaimed[a.id]).map((a) => a.target));
  state.records.bestLevel = Math.min(balance.level.maxLevel, Math.max(state.records.bestLevel, state.level, claimedTarget('level')));
  state.records.bestStage = Math.max(state.records.bestStage, claimedTarget('stage'));
  state.xp = num(raw.xp, 0);
  if (raw.skills && typeof raw.skills === 'object') {
    state.skills = {};
    for (const skill of SKILLS) {
      const level = Math.min(int(raw.skills[skill.id], 0), skill.maxLevel);
      if (level > 0) state.skills[skill.id] = level;
    }
    // Plus de points dépensés que disponibles (sauvegarde modifiée) : on repart de zéro.
    if (Object.values(state.skills).reduce((s, v) => s + v, 0) > state.level) state.skills = { quick: 1 };
  }
  state.skillAuto = raw.skillAuto !== false;
  for (const key of ['gems', 'keys']) state[key] = int(raw[key], state[key]);
  migrateTickets(state, raw); // v9.1.3 (lot E)
  const materials = obj(raw.materials);
  state.materials = { shards: int(materials.shards, 0), grimoire: int(materials.grimoire, 0), ascension: int(materials.ascension, 0), mastery: int(materials.mastery, 0) };
  migrateEssence(state, materials); // v9.1.3 (lot F)

  // v8.4 : statistiques des objets recalculées (croissance exponentielle avec le niveau).
  if (int(raw.version, 1) < 6) {
    for (const item of [...state.inventory, ...Object.values(state.equipment)]) if (item) refreshItemStats(item, balance);
  }
  cleanPowers(state, raw);
  cleanCollections(state, raw);
  state.economy = sanitizeEconomy(raw.economy); // v9.2.8
  state.cosmetics = sanitizeCosmetics(raw.cosmetics);
  if (int(raw.version, 1) < 10) state.migration928 = migrateEconomy928(state, raw); // v9.2.8 : une seule fois
  cleanActivities(state, raw);
  // v9.1.3 (lot F) : hebdomadaires et mensuelles → piste du mois (après les missions, gemmes, clés et éclats : elle peut en verser).
  // v9.3.8 : la Semaine (format 13) n'est pas une ancienne hebdomadaire à convertir.
  migrateMissionTrack(state, int(raw.version, 1) >= 13 && raw.missions ? { ...raw.missions, weekly: undefined } : raw.missions, periodKey('monthly', now), MISSION_TRACK, (r) => grantReward(state, r));

  // Identifiants uniques : nextItemId dépasse tous les identifiants existants (sac, équipement, boîte).
  // v9.3.4 (f) : équipement des compagnons (objets communs) ; l'ancien sac 9.3.3 est converti une fois.
  sanitizeCompanionGear(state, raw, { isValid: isValidItem, clean: cleanItem });
  const nextId = () => Math.max(int(raw.nextItemId, 1, 1), ...[...state.inventory, ...wornItems(state), ...Object.values(state.equipment), ...state.inbox.map((e) => e.item), ...state.stash, ...museumItems(state)]
    .filter(Boolean)
    .map((i) => Number.parseInt(i.id.slice(2), 10) + 1), 1);
  if (int(raw.version, 1) < 12) {
    state.nextItemId = nextId(); // v9.3.4 (f) : les objets convertis ne doivent pas reprendre l'identifiant d'un objet existant
    migrateCompanionGear934(state, raw, { make: (b, r, l) => makeItem(state, b, r, l, balance), place: (it) => placeItem(state, it, balance),
      level: levelForStage(Math.max(1, state.maxStage), balance) });
  }
  state.nextItemId = Math.max(state.nextItemId, nextId());
  // v9.3.8 : pièces réunies (9.3.4) → objets à part entière (même rareté, niveau, améliorations).
  splitParts938(state, { place: (it) => placeItem(state, it, balance), make: (p, parent) => {
    const it = makeItem(state, p.baseId, p.rarity ?? parent.rarity, p.level ?? parent.level, balance);
    it.boosts = { ...(p.boosts ?? {}) };
    it.upgrades = Object.values(it.boosts).reduce((n, v) => n + v, 0); // une amélioration = +1 dans boosts : pièce payée gardée
    it.affixes = (p.affixes ?? []).map((a) => ({ ...a }));
    if (parent.cls) it.cls = parent.cls;
    refreshItemStats(it, balance);
    return it;
  } });
  seedEncyclopedia(state); // v9.0.5 : les objets possédés comptent comme découverts

  if (raw.ui && typeof raw.ui === 'object') {
    if (raw.ui.slotFilter === 'all' || raw.ui.slotFilter === 'accessory' || raw.ui.slotFilter in SLOTS) state.ui.slotFilter = raw.ui.slotFilter;
    if (['off', 'common', 'rare'].includes(raw.ui.autoRecycle)) state.ui.autoRecycle = raw.ui.autoRecycle;
    const rec = raw.ui.recycle;
    if (!rec) delete state.ui.recycle; // partie existante : ses réglages d'avant (ancienne règle) restent tels quels
    if (rec && typeof rec === 'object' && ['off', 'pickup', 'full'].includes(rec.mode)) {
      state.ui.recycle = {
        mode: rec.mode,
        rarities: Array.isArray(rec.rarities) ? rec.rarities.filter((r) => RARITIES.some((x) => x.id === r)) : ['common'],
        slots: Array.isArray(rec.slots) ? rec.slots.filter((s) => s in SLOTS) : Object.keys(SLOTS),
        keepAffixes: Array.isArray(rec.keepAffixes) ? rec.keepAffixes.filter((a) => a in AFFIXES) : [],
      };
    }
    const af = raw.ui.autoFuse;
    if (af && typeof af === 'object') {
      state.ui.autoFuse = { on: af.on === true, rarities: Array.isArray(af.rarities) ? af.rarities.filter((r) => fusionRarity(r, balance)) : ['common'] };
    }
    if (typeof raw.ui.notify === 'object' && raw.ui.notify) state.ui.notify = { ...state.ui.notify, ...raw.ui.notify };
    state.ui.focus = raw.ui.focus === true;
    if (raw.ui.cinematics === false) state.ui.cinematics = false;
    if (raw.ui.shake === false) state.ui.shake = false; // v9.3.9
    if (typeof raw.ui.theme === 'string' && /^[a-z]{1,16}$/.test(raw.ui.theme)) state.ui.theme = raw.ui.theme;
    // v8.4 : seules les vitesses débloquées par code sont gardées (sinon ×1).
    if (unlockedSpeeds(state).includes(raw.ui.speed)) state.ui.speed = raw.ui.speed;
    if (SORT_OPTIONS.includes(raw.ui.sortBy)) state.ui.sortBy = raw.ui.sortBy;
    if (raw.ui.keepSets === false) state.ui.keepSets = false;
    if (typeof raw.ui.doubleDay === 'string') state.ui.doubleDay = raw.ui.doubleDay.slice(0, 20); // v9.3.8 (4) : ×2 du jour pris
    if (raw.ui.autoUseless === false) state.ui.autoUseless = false; // v9.3.8 (3d)
    if (raw.ui.autoMannequin === false) state.ui.autoMannequin = false;
    if (raw.ui.autoMuseum === false) state.ui.autoMuseum = false;
    if (raw.ui.themeFx === false) state.ui.themeFx = false;
    if (raw.ui.tour === 'done') state.ui.tour = 'done'; // v9.0.6 : découverte guidée vue
    // v9.1.0 : champs ajoutés (sans eux, ils disparaîtraient au rechargement).
    if (Number.isInteger(raw.ui.tourV) && raw.ui.tourV > 0) state.ui.tourV = raw.ui.tourV;
    if (raw.ui.goalsOpen === true) state.ui.goalsOpen = true;
    // v9.3.4 : aides et étapes du tutoriel déjà vues.
    if (Array.isArray(raw.ui.hints)) state.ui.hints = raw.ui.hints.filter((h) => typeof h === 'string' && /^[a-z0-9-]{1,32}$/.test(h)).slice(-150); // v9.3.8 : grands moments fêtés compris
    // v9.1.3 : portes du sac déjà ouvertes (Coffre et Forge restent visibles).
    if (Array.isArray(raw.ui.invUsed)) state.ui.invUsed = raw.ui.invUsed.filter((t) => ['stash', 'forge'].includes(t));
    if (Array.isArray(raw.ui.seenTabs)) state.ui.seenTabs = raw.ui.seenTabs.filter((t) => typeof t === 'string' && /^[a-z]{2,16}$/.test(t)).slice(0, 32);
    if (raw.ui.guide && typeof raw.ui.guide === 'object') {
      state.ui.guide = Object.fromEntries(Object.entries(raw.ui.guide).filter(([k, v]) => /^[a-z]{2,16}$/.test(k) && v === true).slice(0, 32));
    }
    if (raw.ui.dungeonSlot && typeof raw.ui.dungeonSlot === 'string') state.ui.dungeonSlot = raw.ui.dungeonSlot.slice(0, 16);
    if (raw.ui.dungeonPath && typeof raw.ui.dungeonPath === 'string') state.ui.dungeonPath = raw.ui.dungeonPath.slice(0, 16);
  }
  if (state.challenge && (state.tower || state.dungeon)) state.challenge = null; // un seul mode à la fois
  // v9.1.0 : une partie existante a déjà ses Objectifs ouverts (le menu ne doit pas disparaître pour elle).
  if (int(raw.records?.kills, 0) > 0) state.ui.goalsOpen = true;
  mergeArmorIntoDefense(state, balance); // v9.3.9 (2.9) : « Peau de fer » fondue dans « Défense », sans perte de survie
  return state;
}

// v9.3.9 (2.9) : une seule amélioration de protection. Les niveaux de « Peau de fer » (ex-Armure, +1 % de réduction
// par niveau) deviennent des niveaux de Défense : on monte la Défense jusqu'à ce que les dégâts subis (équipement,
// talents et Défense d'avant compris, calcul réel de stats.js) ne soient jamais plus élevés qu'avant.
// Si la Défense seule ne peut pas y arriver (au-delà de son plafond), les niveaux de Peau de fer restent comptés.
export function mergeArmorIntoDefense(state, balance = BALANCE) {
  const a = state.upgrades?.armor ?? 0;
  if (!(a > 0) || !balance.upgrades.defense || !balance.upgrades.armor) return false;
  const taken = () => { const x = computeHeroStats(state, balance); return (1 - x.armor / 100) * (1 - x.defenseReductionPct / 100); };
  const before = taken();
  const d0 = state.upgrades.defense ?? 0;
  state.upgrades.armor = 0;
  let lo = d0, hi = d0 + 8;
  state.upgrades.defense = hi;
  while (taken() > before + 1e-12 && hi < d0 + 100000) { lo = hi; hi = hi * 2 + 8; state.upgrades.defense = hi; }
  if (taken() > before + 1e-12) { state.upgrades.defense = d0; state.upgrades.armor = a; return false; }
  while (hi - lo > 1) { const m = Math.floor((lo + hi) / 2); state.upgrades.defense = m; if (taken() <= before + 1e-12) hi = m; else lo = m; }
  state.upgrades.defense = hi;
  return true;
}
