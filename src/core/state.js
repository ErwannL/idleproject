// État persistant de la partie (tout ce qui est sauvegardé) et validation au chargement.
import { BALANCE } from '../data/balance.js';
import { AFFIXES, SLOTS, STARTER_WEAPON, STAT_LABELS } from '../data/items.js';
import { BOSSES } from '../data/enemies.js';
import { COMPANIONS } from '../data/companions.js';
import { CONTRACT_TYPES } from '../data/contracts.js';
import { DUNGEON_PATHS, DUNGEONS, STARTING_KEYS } from '../data/dungeons.js';
import { HEROES, STARTER_HERO } from '../data/heroes.js';
import { BOSS_POWERS, POWER_RULES } from '../data/powers.js';
import { TALENTS } from '../data/rebirth.js';
import { legacyTalentRefund } from './rebirth.js';
import { SKILLS } from '../data/skills.js';
import { ensureContracts } from './contracts.js';
import { emptyMissions, sanitizeMissions } from './missions.js';
import { itemBase, makeItem, rarityById, refreshItemStats } from './loot.js';
import { bossDungeon, bossFirstStage, powerSlots, rollPower } from './powers.js';
import { Rng } from './rng.js';
import { clampTeam } from './companions.js';
import { sanitizePrestige } from './prestige.js';
import { PRESTIGE } from '../data/prestige.js';
import { sanitizeRushes } from './rushes.js';
import { sanitizeCheats, unlockedSpeeds } from './cheats.js';
import { sanitizeTower } from './tower.js';
import { sanitizeAchievements } from './achievements.js';
import { emptyLoadouts, sanitizeLoadouts } from './loadouts.js';
import { sanitizeCodex } from './codex.js';
import { emptyExpeditions, sanitizeExpeditions } from './expeditions.js';
import { setById } from './sets.js';
import { STASH_SIZE, emptyMannequins, mannequinItems } from './stash.js';
import { museumItems } from './museum.js';
import { sanitizeBounty } from './bounty.js';
import { emptyTranscend, sanitizeTranscend } from './transcend.js';
import { sanitizeChallenge } from './challenge.js';

// v1 : prototype · v2 (format identique) · v3 : pouvoirs, Renaissance, verrou
// v4 : niveau, compétences, héros, compagnons, invocation, contrats, événements, matériaux, donjons.
export const SAVE_VERSION = 7; // v8.4 : nouvel équilibrage (remboursement des améliorations) · v8.5 : arbre de 500 talents (fragments remboursés)
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
    equipment: Object.fromEntries(Object.keys(SLOTS).map((slot) => [slot, null])),
    inventory: [],
    nextItemId: 1,
    rngSeed: seed >>> 0,
    records: {
      goldEarned: 0, kills: 0, bossesDefeated: 0, itemsFound: 0, rebirths: 0, contractsDone: 0, summons: 0,
    },
    ui: { slotFilter: 'all', sortBy: 'rarity', autoRecycle: 'off', notify: { loot: true, boss: true, events: true }, focus: false },
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
    gems: 0,
    tickets: BALANCE.summon.startingTickets,
    keys: STARTING_KEYS,
    materials: { shards: 0, essence: 0 },
    summon: { total: 0, sinceEpic: 0, sinceLegendary: 0 },
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
    codex: { kills: {}, items: {}, claimed: {} },
    playSeconds: 0, // temps de jeu cumulé (boost des premières heures)
    expeditions: emptyExpeditions(), // v8.5 : compagnons en mission
    challenge: null, // v8.5 : défi de la semaine en cours { wave, kills, startPlay }
    challengeWeek: null, // { week, best, tries, extra }
    challengeBest: 0,
    challengeHistory: [], // meilleures vagues des semaines passées
    talentRespecs: 0,
    transcend: emptyTranscend(), // v8.8 : Transcendance (Étoiles, bonus stellaires)
    stash: [], // v8.9 : coffre (300 places, jamais recyclé)
    mannequins: emptyMannequins(), // v8.9 : un mannequin par ensemble { setId: { slot: objet } }
    museum: {}, // v9.0 : Musée des objets ancestraux { baseId: objet }
    bounty: null, // v8.9 : prime du jour
  };
  state.equipment.weapon = makeItem(state, STARTER_WEAPON, 'common', 1);
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
  };
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
        charges: Math.min(POWER_RULES.maxCharges, int(entry.charges, beforeV4 ? 1 : 0)),
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

function cleanCollections(state, raw) {
  const heroes = obj(raw.heroes);
  for (const hero of HEROES) {
    const stars = int(obj(heroes.owned)[hero.id]?.stars, 0, 1);
    if (stars) state.heroes.owned[hero.id] = { stars: Math.min(stars, BALANCE.summon.maxStars) };
  }
  if (state.heroes.owned[heroes.active]) state.heroes.active = heroes.active;

  const companions = obj(raw.companions);
  for (const c of COMPANIONS) {
    const owned = obj(companions.owned)[c.id];
    if (!owned) continue;
    state.companions.owned[c.id] = {
      stars: Math.min(int(owned.stars, 1, 1), BALANCE.summon.maxStars),
      level: Math.min(int(owned.level, 1, 1), 20),
    };
  }
  const equipped = Array.isArray(companions.equipped) ? companions.equipped : [];
  state.companions.equipped = clampTeam([...new Set(equipped)].filter((id) => state.companions.owned[id]));

  const summon = obj(raw.summon);
  state.summon = { total: int(summon.total, 0), sinceEpic: int(summon.sinceEpic, 0), sinceLegendary: int(summon.sinceLegendary, 0) };
  if (Array.isArray(summon.history)) {
    state.summon.history = summon.history.filter((h) => h && typeof h.id === 'string' && typeof h.rarity === 'string')
      .slice(0, 60).map((h) => ({ id: h.id, rarity: h.rarity, at: int(h.at, 0) }));
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

  state.missions = sanitizeMissions(raw.missions);
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
  state.bossRetry = br && Number.isInteger(br.stage) && br.stage > 0 && Number.isFinite(br.power) && br.power > 0 ? { stage: br.stage, power: br.power } : null;
  if (state.tower && raw.dungeon) state.tower = null; // jamais les deux à la fois
  state.loadouts = sanitizeLoadouts(raw.loadouts);
  state.expeditions = sanitizeExpeditions(raw.expeditions, state);
  // Jamais à la fois dans l'équipe et en expédition.
  state.companions.equipped = state.companions.equipped.filter((id) => !state.expeditions.slots.some((s) => s?.companionId === id));
  sanitizeChallenge(state, raw);
  state.transcend = sanitizeTranscend(raw.transcend);
  state.bounty = sanitizeBounty(raw.bounty);
  state.codex = sanitizeCodex(raw.codex);
  state.playSeconds = Math.max(0, Number(raw.playSeconds) || 0);

  state.nextEventId = int(raw.nextEventId, 0);
  if (Array.isArray(raw.inbox)) {
    state.inbox = raw.inbox
      .filter((e) => e && Number.isInteger(e.id) && ['chest', 'merchant', 'gems', 'portal', 'wanderer'].includes(e.type))
      .filter((e) => !e.item || isValidItem(e.item))
      .slice(0, BALANCE.events.inboxSize)
      .map((e) => ({ ...e, item: e.item ? cleanItem(e.item) : undefined, reward: obj(e.reward), price: num(e.price, 0), seen: e.seen === true }));
  }

  const run = raw.dungeon;
  if (run && DUNGEONS.some((d) => d.id === run.id) && run.path in DUNGEON_PATHS) {
    state.dungeon = {
      id: run.id, room: int(run.room, 1, 1), kills: int(run.kills, 0), slot: run.slot in SLOTS ? run.slot : 'any',
      path: run.path, level: int(run.level, 1, 1), earned: { ...obj(run.earned) },
      difficulty: ['easy', 'normal', 'hard'].includes(run.difficulty) ? run.difficulty : 'easy',
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

// Accepte n'importe quelle donnée lue sur disque et renvoie un état valide.
// Les champs absents ou corrompus reprennent leur valeur par défaut.
export function sanitizeState(input, balance = BALANCE, now = Date.now()) {
  let raw = input;
  const state = createNewState(now);
  if (!raw || typeof raw !== 'object') return state;
  if (int(raw.version, 1) < 5) raw = migrateTo20Stages(raw);

  state.createdAt = num(raw.createdAt, now);
  state.lastSaved = num(raw.lastSaved, now);
  state.gold = Math.floor(num(raw.gold, 0));
  for (const key of Object.keys(state.upgrades)) {
    state.upgrades[key] = Math.min(int(raw.upgrades?.[key], 0), balance.upgrades[key].maxLevel ?? Infinity);
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
    for (const slot of Object.keys(SLOTS)) {
      const item = raw.equipment[slot];
      state.equipment[slot] = isValidItem(item) && item.slot === slot ? cleanItem(item) : null;
    }
  }
  const items = Array.isArray(raw.inventory) ? raw.inventory.filter(isValidItem) : [];
  state.inventory = items.slice(0, balance.loot.inventorySize).map(cleanItem);
  state.stash = (Array.isArray(raw.stash) ? raw.stash.filter(isValidItem) : []).slice(0, STASH_SIZE).map(cleanItem);
  const mann = raw.mannequins && typeof raw.mannequins === 'object' ? raw.mannequins : {};
  for (const setId of Object.keys(state.mannequins)) {
    for (const [slot, item] of Object.entries(obj(mann[setId]))) {
      if (slot in SLOTS && isValidItem(item) && item.slot === slot && item.set === setId) state.mannequins[setId][slot] = cleanItem(item);
    }
  }
  // v9.0 : Musée (un objet ancestral par vitrine).
  for (const [baseId, item] of Object.entries(obj(raw.museum))) {
    if (isValidItem(item) && item.baseId === baseId && itemBase(baseId)?.signature) state.museum[baseId] = cleanItem(item);
  }

  for (const key of Object.keys(state.records)) state.records[key] = int(raw.records?.[key], 0);
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
  for (const key of ['gems', 'tickets', 'keys']) state[key] = int(raw[key], state[key]);
  const materials = obj(raw.materials);
  state.materials = { shards: int(materials.shards, 0), essence: int(materials.essence, 0) };

  // v8.4 : statistiques des objets recalculées (croissance exponentielle avec le niveau).
  if (int(raw.version, 1) < 6) {
    for (const item of [...state.inventory, ...Object.values(state.equipment)]) if (item) refreshItemStats(item, balance);
  }
  cleanPowers(state, raw);
  cleanCollections(state, raw);
  cleanActivities(state, raw);

  // Identifiants uniques : nextItemId dépasse tous les identifiants existants (sac, équipement, boîte).
  const used = [...state.inventory, ...Object.values(state.equipment), ...state.inbox.map((e) => e.item), ...state.stash, ...mannequinItems(state), ...museumItems(state)]
    .filter(Boolean)
    .map((i) => Number.parseInt(i.id.slice(2), 10));
  state.nextItemId = Math.max(int(raw.nextItemId, 1, 1), ...used.map((n) => n + 1), 1);

  if (raw.ui && typeof raw.ui === 'object') {
    if (raw.ui.slotFilter === 'all' || raw.ui.slotFilter === 'accessory' || raw.ui.slotFilter in SLOTS) state.ui.slotFilter = raw.ui.slotFilter;
    if (['off', 'common', 'rare'].includes(raw.ui.autoRecycle)) state.ui.autoRecycle = raw.ui.autoRecycle;
    const rec = raw.ui.recycle;
    if (rec && typeof rec === 'object' && ['off', 'pickup', 'full'].includes(rec.mode)) {
      state.ui.recycle = {
        mode: rec.mode,
        rarities: Array.isArray(rec.rarities) ? rec.rarities.filter((r) => ['common', 'rare', 'epic', 'legendary'].includes(r)) : ['common'],
        slots: Array.isArray(rec.slots) ? rec.slots.filter((s) => s in SLOTS) : Object.keys(SLOTS),
      };
    }
    const af = raw.ui.autoFuse;
    if (af && typeof af === 'object') {
      state.ui.autoFuse = { on: af.on === true, rarities: Array.isArray(af.rarities) ? af.rarities.filter((r) => ['common', 'rare', 'epic'].includes(r)) : ['common'] };
    }
    if (typeof raw.ui.notify === 'object' && raw.ui.notify) state.ui.notify = { ...state.ui.notify, ...raw.ui.notify };
    state.ui.focus = raw.ui.focus === true;
    if (raw.ui.cinematics === false) state.ui.cinematics = false;
    if (typeof raw.ui.theme === 'string' && /^[a-z]{1,16}$/.test(raw.ui.theme)) state.ui.theme = raw.ui.theme;
    // v8.4 : seules les vitesses débloquées par code sont gardées (sinon ×1).
    if (unlockedSpeeds(state).includes(raw.ui.speed)) state.ui.speed = raw.ui.speed;
    if (SORT_OPTIONS.includes(raw.ui.sortBy)) state.ui.sortBy = raw.ui.sortBy;
    if (raw.ui.keepSets === false) state.ui.keepSets = false;
    if (raw.ui.autoMannequin === false) state.ui.autoMannequin = false;
    if (raw.ui.autoMuseum === false) state.ui.autoMuseum = false;
    if (raw.ui.themeFx === false) state.ui.themeFx = false;
  }
  if (state.challenge && (state.tower || state.dungeon)) state.challenge = null; // un seul mode à la fois
  return state;
}
