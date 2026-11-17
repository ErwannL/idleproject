// Renaissance (prestige) et talents permanents.
// v8.5 : arbre de ~500 nœuds ; un nœud s'apprend dès qu'un de ses voisins est appris (le Cœur est libre),
// les clés de voûte demandent en plus des points dépensés dans leur région.
import { isUnlocked } from './unlock-quests.js'; // v9.7.1 (lot 3)
import { LEGACY_TALENTS, REBIRTH, TALENT_RESPEC, TALENTS } from '../data/rebirth.js';
import { PRESTIGE } from '../data/prestige.js';
import { fragmentBonus, memoryShare } from './transcend.js';
import { noteRebirth } from './times.js';
import { levelForStage } from './combat.js'; // v9.2.0 (monde marin) : niveau de puissance des étapes

const BY_ID = new Map(TALENTS.map((t) => [t.id, t]));

export function talentById(id) {
  return BY_ID.get(id);
}

export function talentCost(talent, level) {
  return talent.costBase + talent.costStep * level;
}

// Fragments dépensés pour amener un talent au niveau `level`.
export function talentSpent(talent, level) {
  let sum = 0;
  for (let i = 0; i < level; i++) sum += talentCost(talent, i);
  return sum;
}

// Effets cumulés d'un talent à un niveau donné.
export function talentLevelEffects(talent, level) {
  const out = {};
  for (let i = 0; i < level; i++) {
    const step = talent.levels ? talent.levels[i] : talent.perLevel;
    for (const [k, v] of Object.entries(step ?? {})) out[k] = (out[k] ?? 0) + v;
  }
  return out;
}

// Effets de tout l'arbre. Calculés une fois par version de `state.talents` (l'objet est remplacé à
// chaque achat) : les statistiques du héros sont recalculées à chaque pas de combat.
const effectsCache = new WeakMap();
export function talentEffects(state) {
  const talents = state.talents ?? {};
  let out = effectsCache.get(talents);
  if (out) return out;
  out = {};
  for (const [id, level] of Object.entries(talents)) {
    const talent = BY_ID.get(id);
    if (!talent || !level) continue;
    for (const [k, v] of Object.entries(talentLevelEffects(talent, level))) out[k] = (out[k] ?? 0) + v;
  }
  effectsCache.set(talents, out);
  return out;
}

// Points dépensés (niveaux) dans une région.
export function regionPoints(state, region) {
  let n = 0;
  for (const [id, level] of Object.entries(state.talents ?? {})) if (BY_ID.get(id)?.region === region) n += level;
  return n;
}

export function talentsOwned(state) {
  return Object.values(state.talents ?? {}).filter((v) => v > 0).length;
}

export function fragmentsSpent(state) {
  return Object.entries(state.talents ?? {}).reduce((sum, [id, level]) => sum + (BY_ID.has(id) ? talentSpent(BY_ID.get(id), level) : 0), 0);
}

// Relié à un talent appris (le Cœur est toujours accessible).
export function talentConnected(state, talent) {
  return talent.id === 'core' || talent.links.some((id) => (state.talents[id] ?? 0) > 0);
}

export function talentUnlocked(state, talent) {
  return talentConnected(state, talent) && (!talent.gate || regionPoints(state, talent.region) >= talent.gate);
}

export function buyTalent(state, id) {
  const talent = talentById(id);
  if (!talent) return false;
  const level = state.talents[id] ?? 0;
  if (level >= talent.max || !talentUnlocked(state, talent)) return false;
  const cost = talentCost(talent, level);
  if (state.fragments < cost) return false;
  state.fragments -= cost;
  state.talents = { ...state.talents, [id]: level + 1 };
  return true;
}

// Tous les niveaux abordables d'un talent ; renvoie le nombre de niveaux achetés.
export function buyTalentMax(state, id) {
  let n = 0;
  while (buyTalent(state, id)) n += 1;
  return n;
}

// v8.8 : achat en masse — apprend en boucle le niveau le moins cher disponible (dans une région, ou partout)
// tant que les fragments suffisent. Renvoie le nombre de niveaux appris.
// v9.3.5 : talent conseillé (le moins cher apprenable avec les fragments en poche), ou null.
export function suggestedTalent(state) {
  let best = null;
  for (const t of TALENTS) {
    const level = state.talents[t.id] ?? 0;
    if (level >= t.max || !talentUnlocked(state, t)) continue;
    const cost = talentCost(t, level);
    if (cost <= state.fragments && (!best || cost < best.cost)) best = { talent: t, cost };
  }
  return best;
}

export function buyTalentsCheapest(state, region = null, limit = 5000) {
  let n = 0;
  while (n < limit) {
    let best = null;
    let bestCost = Infinity;
    for (const t of TALENTS) {
      if (region && t.region !== region && t.id !== 'core') continue;
      const level = state.talents[t.id] ?? 0;
      if (level >= t.max) continue;
      const cost = talentCost(t, level);
      if (cost < bestCost && cost <= state.fragments && talentUnlocked(state, t)) { best = t; bestCost = cost; }
    }
    if (!best || !buyTalent(state, best.id)) break;
    n += 1;
  }
  return n;
}

// Chemin le moins cher (premier niveau de chaque nœud) depuis l'arbre appris jusqu'à `targetId`
// (Dijkstra sur ~500 nœuds). Renvoie les identifiants à apprendre, dans l'ordre, cible comprise.
export function talentPath(state, targetId) {
  const target = BY_ID.get(targetId);
  if (!target) return null;
  if ((state.talents[targetId] ?? 0) > 0) return [];
  const owned = (id) => (state.talents[id] ?? 0) > 0;
  const dist = new Map();
  const prev = new Map();
  const open = [];
  // Points de départ : le Cœur s'il n'est pas appris, sinon tous les nœuds reliés à l'arbre appris.
  const starts = owned('core') ? TALENTS.filter((t) => !owned(t.id) && talentConnected(state, t)) : [BY_ID.get('core')];
  for (const t of starts) { dist.set(t.id, talentCost(t, 0)); open.push(t.id); }
  const done = new Set();
  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (dist.get(open[i]) < dist.get(open[bi])) bi = i;
    const id = open.splice(bi, 1)[0];
    if (done.has(id)) continue;
    done.add(id);
    if (id === targetId) break;
    for (const nid of BY_ID.get(id).links) {
      if (owned(nid) || done.has(nid)) continue;
      const d = dist.get(id) + talentCost(BY_ID.get(nid), 0);
      if (!dist.has(nid) || d < dist.get(nid)) { dist.set(nid, d); prev.set(nid, id); open.push(nid); }
    }
  }
  if (!done.has(targetId)) return null;
  const path = [targetId];
  while (prev.has(path[0])) path.unshift(prev.get(path[0]));
  return path;
}

export function pathCost(path) {
  return (path ?? []).reduce((sum, id) => sum + talentCost(BY_ID.get(id), 0), 0);
}

// Apprend le chemin (un niveau par nœud) tant que les fragments suffisent ; renvoie le nombre de nœuds appris.
export function buyTalentPath(state, targetId) {
  const path = talentPath(state, targetId);
  let n = 0;
  for (const id of path ?? []) {
    if (!buyTalent(state, id)) break;
    n += 1;
  }
  return n;
}

// Réinitialisation : tous les fragments dépensés sont rendus (gratuite la première fois, puis en gemmes).
export function respecCost(state) {
  return (state.talentRespecs ?? 0) > 0 ? TALENT_RESPEC.gems : 0;
}

export function respecTalents(state) {
  const spent = fragmentsSpent(state);
  if (spent <= 0) return 0;
  const cost = respecCost(state);
  if (state.gems < cost) return 0;
  state.gems -= cost;
  state.fragments += spent;
  state.talents = {};
  state.talentRespecs = (state.talentRespecs ?? 0) + 1;
  return spent;
}

// v8.5 : fragments dépensés dans l'ancien arbre (25 talents), remboursés à la migration.
export function legacyTalentRefund(rawTalents) {
  let sum = 0;
  for (const t of LEGACY_TALENTS) {
    const level = Math.min(t.max, Math.max(0, Math.floor(Number(rawTalents?.[t.id]) || 0)));
    for (let i = 0; i < level; i++) sum += t.costBase + t.costStep * i;
  }
  return sum;
}

// v9.0.6 : « poids » des Renaissances — une Renaissance vaut min(1, étape max / 200) ; les anciennes sauvegardes
// gardent une Renaissance entière par Renaissance déjà faite.
export function rebirthPower(state) {
  return Number.isFinite(state.rebirthPower) ? state.rebirthPower : state.records?.rebirths ?? 0;
}
export function rebirthGain(state) {
  return Math.min(1, Math.max(0, (levelForStage(state.maxStage) - 1) / REBIRTH.fullPowerStage));
}

export function canRebirth(state) {
  return state.maxStage >= REBIRTH.minStage && isUnlocked(state, 'rebirth'); // v9.7.1 (lot 3) : grand moment, fin du monde 3
}

// v9.1.0 : pas de Renaissance (ni de Transcendance) pendant un donjon, la Tour ou le défi : renvoie le motif.
export function rebirthBlocked(state) {
  if (state.dungeon) return 'Terminez ou abandonnez d\'abord le donjon en cours.';
  if (state.tower) return 'Quittez d\'abord la Tour de l\'Éternité.';
  if (state.challenge) return 'Terminez d\'abord le défi de la semaine.';
  return null;
}

export function rebirthReward(state, stage = state.maxStage) {
  if (stage < REBIRTH.minStage) return 0;
  const prestigeBonus = 1 + (PRESTIGE.fragmentBonusPct * (state.prestige?.count ?? 0)) / 100;
  return Math.floor(((levelForStage(stage) - 1) / REBIRTH.divisor) ** REBIRTH.exponent * prestigeBonus * fragmentBonus(state));
}
// v9.6.2 (7.8) : la Renaissance vaut la peine dès que son gain dépasse un seuil (au moins 30 fragments, et au moins la
// moitié des fragments déjà possédés ou dépensés) — proposée tôt, pas seulement quand un boss bloque.
export function rebirthWorth(state) {
  const r = rebirthReward(state);
  return r > 0 && r >= Math.max(30, 0.5 * ((state.fragments ?? 0) + fragmentsSpent(state)));
}

// Réinitialise la campagne, l'or et les améliorations ; conserve tout le reste.
// Renvoie le nombre de fragments gagnés (0 si la Renaissance n'est pas possible).
export function performRebirth(state, keepPower = state.equippedPowers?.[0]) {
  const reward = rebirthReward(state);
  if (reward <= 0 || rebirthBlocked(state)) return 0;
  state.rebirthPower = rebirthPower(state) + rebirthGain(state);
  // Un seul pouvoir ancestral conservé (celui choisi, sinon le premier actif).
  const kept = state.powers?.[keepPower] ? keepPower : Object.keys(state.powers ?? {})[0];
  state.powers = kept ? { [kept]: state.powers[kept] } : {};
  state.equippedPowers = kept ? [kept] : [];
  // Niveau du héros, compétences et niveau de l'équipe repartent de zéro.
  state.level = 1;
  state.xp = 0;
  state.skills = { quick: 1 };
  for (const c of Object.values(state.companions?.owned ?? {})) c.level = 1;
  state.fragments += reward;
  state.records.rebirths += 1;
  noteRebirth(state);
  state.gold = 0;
  // v8.8 : « Mémoire du guerrier » (Transcendance) conserve une partie des niveaux d'amélioration.
  const keep = memoryShare(state);
  for (const key of Object.keys(state.upgrades)) state.upgrades[key] = Math.floor(state.upgrades[key] * keep);
  state.stage = 1;
  state.maxStage = 1;
  state.kills = 0;
  state.autoAdvance = true;
  state.farmBoss = null; // v9.1.0 : plus de boss en boucle ni de « retenter » sur une étape qui n'existe plus
  state.bossRetry = null;
  return reward;
}
