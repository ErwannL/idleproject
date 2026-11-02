// v9.1.3 (doc4 partie B) : calendrier des bannières (14 jours), budget B, Archives, mode monde (niveaux, paliers du
// boss, essai gratuit, Titre) et score (60 s, reproductible). Tout est inerte tant que BANNER_RULES.enabled est faux.
import { BANNER_RULES, BANNER_UNITS, UNITS } from '../data/banners.js';
import { COMPANIONS, COMPANION_RULES } from '../data/companions.js';
import { ZONES } from '../data/zones.js';
import { BALANCE } from '../data/balance.js';
import { grantReward } from './rewards.js';
import { Rng } from './rng.js';

const DAY = 86400000;
let startCache = null;
const startMs = () => {
  if (startCache?.key !== BANNER_RULES.start) startCache = { key: BANNER_RULES.start, ms: new Date(`${BANNER_RULES.start}T00:00:00`).getTime() };
  return startCache.ms;
};
const periodMs = () => BANNER_RULES.periodDays * DAY;

// k_jour : numéro de la sortie en cours (1re = 1) ; 0 avant la 1re sortie ou drapeau coupé.
export function releaseIndex(now = Date.now()) {
  if (!BANNER_RULES.enabled) return 0;
  const t = now - startMs();
  return t < 0 ? 0 : Math.floor(t / periodMs()) + 1;
}

// Début (ms) de la sortie k.
export function releaseStart(k) {
  return startMs() + (k - 1) * periodMs();
}

export function bannerUnits() {
  return BANNER_RULES.enabled ? BANNER_UNITS : [];
}

export function bannerUnit(id) {
  return bannerUnits().find((u) => u.id === id) ?? null;
}

// Bannière en cours : { unit, k, day (J1 à J14), start, end } ou null (aucun perso prévu pour cette sortie).
export function currentBanner(now = Date.now()) {
  const k = releaseIndex(now);
  const unit = k ? bannerUnits().find((u) => u.release === k) : null;
  if (!unit) return null;
  const start = releaseStart(k);
  return { unit, k, day: Math.floor((now - start) / DAY) + 1, start, end: start + periodMs() };
}

// Aperçu du suivant à J-7 : { unit, start } ou null.
export function nextBanner(now = Date.now()) {
  if (!BANNER_RULES.enabled) return null;
  const k = releaseIndex(now) + 1;
  const unit = bannerUnits().find((u) => u.release === k);
  if (!unit) return null;
  const start = releaseStart(k);
  return start - now <= BANNER_RULES.previewDays * DAY ? { unit, start } : null;
}

// Dernière bannière terminée (pour le message de fin) : { unit, end } ou null.
export function lastBanner(now = Date.now()) {
  const k = releaseIndex(now) - 1;
  const unit = k > 0 ? bannerUnits().find((u) => u.release === k) : null;
  return unit ? { unit, end: releaseStart(k + 1) } : null;
}

// Persos sortis (bannière en cours ou passée) : leur monde est ouvert.
export function releasedUnits(now = Date.now()) {
  const k = releaseIndex(now);
  return bannerUnits().filter((u) => u.release <= k);
}

// Cibles des Archives : les 5 SSR permanents et les persos dont la bannière est finie (J15).
export function archiveTargets(now = Date.now()) {
  const k = releaseIndex(now);
  return [...COMPANIONS.filter((c) => c.kind === 'ally' && c.rarity === 'legendary'), ...bannerUnits().filter((u) => u.release < k)];
}

// Budget B (en %) : passif et compétences × B/100, plafond soin et rally 3 × B/100.
// R, SR, familiers : 100 ; 5 SSR permanents : max(100, 87 + k_jour) ; nouveaux SSR : max(107 + k_unité, 87 + k_jour).
export function budget(unit, now = Date.now()) {
  if (!unit || !BANNER_RULES.enabled) return 100;
  const k = releaseIndex(now);
  if (unit.bannerOnly) return Math.max(107 + unit.release, 87 + k);
  if (unit.kind === 'ally' && unit.rarity === 'legendary') return Math.max(100, 87 + k);
  return 100;
}

// Cadeau de sortie (ancien « 30 tickets d'événement ») : une fois par sortie, au premier passage pendant la bannière.
export function claimReleaseGift(state, now = Date.now()) {
  const b = currentBanner(now);
  if (!b || (state.summon.gift ?? 0) >= b.k) return 0;
  state.summon.gift = b.k;
  state.gems += BANNER_RULES.releaseGems;
  return BANNER_RULES.releaseGems;
}

// ---------------------------------------------------------------------------------------------------------------
// Mode monde. Un mode à part (pas une zone de ZONES : la campagne ne se décale pas), avec sa branche dans
// currentEncounter. Calendrier (bannière en cours) : J1 monde, niveaux 1 à 9 et essai gratuit ; J4 paliers 1 à 3 ;
// J8 paliers 4 et 5 ; J10 dernier niveau. Après la bannière, tout reste ouvert (sans essai gratuit).

export function worldRecord(state, id) {
  return state.worlds?.[id] ?? { levels: 0, tiers: 0, decor: false, title: false, score: null };
}

function ensureRecord(state, id) {
  state.worlds ??= {};
  state.worlds[id] ??= { levels: 0, tiers: 0, decor: false, title: false, score: null };
  return state.worlds[id];
}

// État du monde d'un perso : ce qui est ouvert aujourd'hui.
export function worldStatus(state, id, now = Date.now()) {
  const unit = releasedUnits(now).find((u) => u.id === id);
  if (!unit) return null;
  const banner = currentBanner(now);
  const live = banner?.unit.id === id;
  const day = live ? banner.day : Infinity;
  const rec = worldRecord(state, id);
  const levelsOpen = day >= BANNER_RULES.lastLevelDay ? BANNER_RULES.worldLevels : BANNER_RULES.worldLevels - 1;
  const tiersOpen = BANNER_RULES.tiersFrom.filter((d) => day >= d).length;
  const owned = state.companions.owned[id];
  return {
    unit, live, day, rec, levelsOpen, tiersOpen,
    nextLevel: Math.min(rec.levels + 1, levelsOpen), nextTier: rec.tiers < tiersOpen ? rec.tiers + 1 : null,
    trial: live && !(owned && !owned.trial), owned: Boolean(owned && !owned.trial),
    zone: ZONES[unit.world.zone], boss: ZONES[unit.world.zone].bosses[0],
  };
}

const inTeam = (state, id) => state.companions.equipped.includes(id);
const fiveStar = (state, id) => (state.companions.owned[id]?.stars ?? 0) >= COMPANION_RULES.maxCopies;

// Condition d'un palier (équipe actuelle, essai compris pour le palier 4, pas pour le 5) : null si remplie, sinon texte.
export function tierCondition(state, unit, tier, { trial = false } = {}) {
  const owned = state.companions.owned[unit.id];
  const has = owned && !owned.trial;
  if (tier === 5) return has && inTeam(state, unit.id) ? null : `${unit.name} possédé, dans l'équipe (l'essai gratuit ne compte pas)`;
  if (tier === 4) {
    const alt = unit.tier4Alt ?? [];
    if ((has && inTeam(state, unit.id)) || trial) return null;
    if (alt.length === 2 && alt.every((a) => inTeam(state, a) && fiveStar(state, a))) return null;
    return `${unit.name} dans l'équipe, ou ${alt.map((a) => UNITS.find((u) => u.id === a)?.name ?? a).join(' et ')} à 5★`;
  }
  return null;
}

// Niveau des ennemis : calé sur la meilleure étape (records.bestStage), car leurs PV ne connaissent pas la puissance.
export function worldLevel(state, kind, n) {
  const best = Math.max(1, state.records?.bestStage ?? 1, state.maxStage ?? 1);
  return kind === 'level' ? Math.max(1, Math.round(best * (0.5 + 0.05 * n))) : best;
}

export function worldReward(kind, n) {
  if (kind === 'level') return { gems: 30 + 10 * n, shards: 20 * n };
  return [{ gems: 300, keys: 1, shards: 100 }, { gems: 400, keys: 1, shards: 150 }, { gems: 500, keys: 2, shards: 200, fragments: 20 }, {}, {}][n - 1] ?? {};
}

// Rencontre du mode monde (branche de currentEncounter).
export function worldEncounter(state) {
  const run = state.worldRun;
  const unit = UNITS.find((u) => u.id === run.unit);
  const zoneIndex = unit?.world.zone ?? 0;
  const zone = ZONES[zoneIndex];
  const boss = run.kind !== 'level' || run.kills >= BANNER_RULES.levelKills;
  return {
    level: worldLevel(state, run.kind, run.n), boss, enemies: zone.enemies, bosses: [zone.bosses[0]],
    killsNeeded: boss ? 1 : BANNER_RULES.levelKills, zoneIndex, dungeon: null, world: true,
    hpMult: run.kind === 'tier' ? BANNER_RULES.tierTargets[run.n - 1] : 1, score: run.kind === 'score',
  };
}

// Entrée dans le monde. kind : 'level' (n = 1..10), 'tier' (n = 1..5) ou 'score'. `trial` : essai gratuit du perso
// (0★, niveau 1, à la place du 2e compagnon). `world` (combat) : remis à zéro, minuteries et effets compris
// (resetWave ne touche ni companionTimers, ni skillTimers, ni buffs : sinon le score varie selon la phase).
export function startWorldRun(state, world, id, kind, n = 1, { trial = false } = {}, now = Date.now()) {
  if (state.worldRun || state.dungeon || state.tower || state.challenge) return { error: 'busy' };
  const st = worldStatus(state, id, now);
  if (!st) return { error: 'closed' };
  if (kind === 'level' && (n < 1 || n > st.levelsOpen || n > st.rec.levels + 1)) return { error: 'locked' };
  if (kind === 'tier' && (n < 1 || n > st.tiersOpen || n > st.rec.tiers + 1)) return { error: 'locked' };
  if (kind === 'score' && !(st.owned && inTeam(state, id))) return { error: 'score' };
  if (!['level', 'tier', 'score'].includes(kind)) return { error: 'kind' };
  const useTrial = trial && st.trial && kind !== 'score';
  const prevEquipped = [...state.companions.equipped];
  if (useTrial) {
    state.companions.owned[id] = { stars: 1, level: 1, trial: true };
    const allies = state.companions.equipped.filter((x) => UNITS.find((u) => u.id === x)?.kind === 'ally');
    const others = state.companions.equipped.filter((x) => !allies.includes(x));
    state.companions.equipped = [...allies.slice(0, BALANCE.teamSlots.ally - 1), id, ...others];
  }
  if (kind === 'tier') {
    const cond = tierCondition(state, st.unit, n, { trial: useTrial });
    if (cond) { endTrial(state, id, prevEquipped, useTrial); return { error: 'condition', text: cond }; }
  }
  const seconds = kind === 'score' ? BANNER_RULES.scoreSeconds : BANNER_RULES.tierSeconds;
  state.worldRun = { unit: id, kind, n, kills: 0, damage: 0, trial: useTrial, prevEquipped, startPlay: state.playSeconds ?? 0, deadline: (state.playSeconds ?? 0) + seconds };
  if (world) resetCombat(state, world, kind === 'score');
  return { ok: true };
}

// Remise à zéro complète du combat (entrée dans le monde) ; `seeded` : hasard fixe pour le score.
export function resetCombat(state, world, seeded) {
  world.enemies = [];
  world.spawnTimer = 0.8;
  world.bossDelay = BALANCE.stages.bossSpawnDelaySeconds;
  world.companionTimers = {};
  world.skillTimers = {};
  world.buffs = { cry: 0, cryPct: 0, shield: 0, shieldPct: 0 };
  world.attackCount = 0;
  world.phantomTimer = 0;
  world.pendingElite = false;
  world.goldWave = 0;
  world.hero.dead = false;
  world.hero.respawnTimer = 0;
  world.hero.attackTimer = 0.3;
  world.hero.walking = true;
  world.hero.hp = world.heroStats?.maxHp ?? world.hero.hp;
  world.scoreRng = seeded ? new Rng(BANNER_RULES.scoreSeed) : null;
}

function endTrial(state, id, prevEquipped, trial) {
  if (!trial) return;
  if (state.companions.owned[id]?.trial) delete state.companions.owned[id];
  state.companions.equipped = prevEquipped.filter((x) => state.companions.owned[x]);
}

export function worldTimeLeft(state) {
  return state.worldRun ? state.worldRun.deadline - (state.playSeconds ?? 0) : 0;
}

// Ennemi ordinaire vaincu dans un niveau.
export function worldKill(state) {
  if (state.worldRun?.kind === 'level') state.worldRun.kills += 1;
}

// Fin d'un essai : 'won' (boss vaincu), 'lost' (défaite ou temps écoulé), 'left' (sortie), 'time' (score terminé).
// Renvoie { unit, kind, n, won, reward, score, record }.
export function endWorldRun(state, outcome = 'left', now = Date.now()) {
  const run = state.worldRun;
  if (!run) return null;
  state.worldRun = null;
  endTrial(state, run.unit, run.prevEquipped, run.trial);
  const rec = ensureRecord(state, run.unit);
  const out = { unit: run.unit, kind: run.kind, n: run.n, won: outcome === 'won', reward: null, score: null, record: false };
  if (run.kind === 'score' && (outcome === 'time' || outcome === 'lost')) {
    const owned = state.companions.owned[run.unit];
    const entry = {
      damage: Math.floor(run.damage), stars: Math.max(0, (owned?.stars ?? 1) - 1), level: owned?.level ?? 1,
      team: [...state.companions.equipped], at: now,
    };
    out.score = entry;
    if (!rec.score || entry.damage > rec.score.damage) { rec.score = entry; out.record = true; }
  }
  if (outcome === 'won' && run.kind === 'level' && run.n > rec.levels) {
    rec.levels = run.n;
    out.reward = grantReward(state, worldReward('level', run.n));
  }
  if (outcome === 'won' && run.kind === 'tier' && run.n > rec.tiers) {
    rec.tiers = run.n;
    if (run.n <= 3) out.reward = grantReward(state, worldReward('tier', run.n));
    if (run.n === 4) rec.decor = true;
    if (run.n === 5) rec.title = true;
  }
  return out;
}

// Nettoyage d'une sauvegarde : records du monde (le perso peut être inconnu de ce client : gardés tels quels, bornés).
export function sanitizeWorlds(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  const int = (v, lo, hi) => (Number.isInteger(v) ? Math.max(lo, Math.min(hi, v)) : lo);
  for (const [id, r] of Object.entries(raw).slice(0, 200)) {
    if (!/^[a-z0-9_]{2,32}$/.test(id) || !r || typeof r !== 'object') continue;
    const s = r.score;
    out[id] = {
      levels: int(r.levels, 0, BANNER_RULES.worldLevels), tiers: int(r.tiers, 0, 5), decor: r.decor === true, title: r.title === true,
      score: s && typeof s === 'object' && Number.isFinite(s.damage) && s.damage > 0 ? {
        damage: Math.floor(s.damage), stars: int(s.stars, 0, COMPANION_RULES.maxCopies - 1), level: int(s.level, 1, COMPANION_RULES.maxLevel),
        team: Array.isArray(s.team) ? s.team.filter((t) => typeof t === 'string' && t.length <= 32).slice(0, 4) : [], at: Number.isFinite(s.at) ? s.at : 0,
      } : null,
    };
  }
  return out;
}
