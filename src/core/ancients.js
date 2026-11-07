// v9.2.8 : événements (document du producteur, section 7). Cycle de 28 jours : grand événement « Expédition des
// Anciens » (14 j) puis petit événement « Marché des lueurs » (14 j). Configuration : data/economy.js (EVENTS).
// Première version jouable du grand événement : carte de 5 régions × 10 étapes en combat automatique résolu d'un coup
// (dégâts du héros pendant 30 s contre les PV du gardien de l'étape), World Boss dès l'étape 20 (3 tentatives par
// jour), écus d'événement et boutique d'événement, fragment SSR universel à l'étape 30.
// Reportés (voir le plan) : reliques d'événement améliorables, Failles dimensionnelles de la 2e semaine.
import { EVENTS } from '../data/economy.js';
import { grantReward } from './rewards.js';
import { ensureEconomy } from './wallet.js';
import { dayKey } from './income.js';

const DAY = 86400000;
const anchorMs = () => new Date(`${EVENTS.anchor}T00:00:00`).getTime();

// Événement en cours : { kind: 'grand' | 'small', id (unique par cycle), cycle, day (1..14), start, end } ou null.
export function currentEvent(now = Date.now()) {
  const t = now - anchorMs();
  if (t < 0) return null;
  const cycle = Math.floor(t / (EVENTS.cycleDays * DAY));
  const inCycle = t - cycle * EVENTS.cycleDays * DAY;
  const grand = inCycle < EVENTS.grandDays * DAY;
  const start = anchorMs() + cycle * EVENTS.cycleDays * DAY + (grand ? 0 : EVENTS.grandDays * DAY);
  const len = (grand ? EVENTS.grandDays : EVENTS.cycleDays - EVENTS.grandDays) * DAY;
  const kind = grand ? 'grand' : 'small';
  return { kind, id: `${kind === 'grand' ? EVENTS.grand.id : EVENTS.small.id}-${cycle + 1}`, cycle: cycle + 1, day: Math.floor((now - start) / DAY) + 1, start, end: start + len };
}

function record(state, id) {
  const eco = ensureEconomy(state);
  eco.events[id] ??= { cleared: 0, coins: 0, bought: {}, goals: {}, claimed: [], boss: { day: '', used: 0, best: 0 }, fragment: false };
  return eco.events[id];
}

export function eventRecord(state, now = Date.now()) {
  const ev = currentEvent(now);
  return ev ? record(state, ev.id) : null;
}

const G = () => EVENTS.grand;
export const totalStages = () => G().regions.length * G().stagesPerRegion;

// Étape de campagne équivalente à l'étape n de l'événement (relative au record du joueur).
export function eventStageLevel(state, n) {
  const best = Math.max(1, state.records?.bestStage ?? 1, state.maxStage ?? 1);
  return Math.max(1, Math.round(best * (G().stageScale.from + G().stageScale.per * n)));
}

// Combat automatique d'une étape. `power` = { dps, hpOf(stage) } fourni par l'appelant (main.js : stats réelles du
// héros et PV réels du gardien) pour garder ce module sans dépendance au combat.
export function fightStage(state, n, power, now = Date.now()) {
  const ev = currentEvent(now);
  if (!ev || ev.kind !== 'grand') return { error: 'closed' };
  const rec = record(state, ev.id);
  if (n !== rec.cleared + 1 || n > totalStages()) return { error: 'locked' };
  const hp = power.hpOf(eventStageLevel(state, n));
  const dealt = power.dps * G().fightSeconds;
  if (dealt < hp) return { won: false, dealt, hp };
  rec.cleared = n;
  let coins = G().stageCoins;
  if (n % G().stagesPerRegion === 0) coins += G().regionCoins;
  rec.coins += coins;
  const reward = { eventCoins: coins };
  if (n === G().fragmentStage && !rec.fragment) {
    rec.fragment = true;
    grantReward(state, { ssrFragment: 1 });
    reward.ssrFragment = 1;
  }
  return { won: true, dealt, hp, reward };
}

export function worldBossStatus(state, now = Date.now()) {
  const ev = currentEvent(now);
  if (!ev || ev.kind !== 'grand') return null;
  const rec = record(state, ev.id);
  const wb = G().worldBoss;
  const today = dayKey(now);
  const used = rec.boss.day === today ? rec.boss.used : 0;
  return { open: rec.cleared >= wb.unlockStage, left: Math.max(0, wb.attemptsPerDay - used), best: rec.boss.best };
}

// Tentative contre le World Boss : dégâts du héros pendant 60 s ; écus fixes par tentative ; record gardé.
export function fightWorldBoss(state, dps, now = Date.now()) {
  const st = worldBossStatus(state, now);
  if (!st?.open || st.left <= 0) return null;
  const rec = eventRecord(state, now);
  const today = dayKey(now);
  if (rec.boss.day !== today) rec.boss = { day: today, used: 0, best: rec.boss.best };
  rec.boss.used += 1;
  const damage = Math.floor(dps * G().worldBoss.seconds);
  rec.boss.best = Math.max(rec.boss.best, damage);
  rec.coins += G().worldBoss.coinsPerAttempt;
  return { damage, coins: G().worldBoss.coinsPerAttempt };
}

// Boutique d'événement (écus → tickets), stocks par événement.
export function buyEventItem(state, itemId, now = Date.now()) {
  const ev = currentEvent(now);
  if (!ev || ev.kind !== 'grand') return null;
  const rec = record(state, ev.id);
  const item = G().shop.find((i) => i.id === itemId);
  if (!item || rec.coins < item.price || (rec.bought[itemId] ?? 0) >= item.stock) return null;
  rec.coins -= item.price;
  rec.bought[itemId] = (rec.bought[itemId] ?? 0) + 1;
  return grantReward(state, item.give);
}

// Petit événement : objectifs comptés seulement pendant sa fenêtre (missions.js → trackMissions).
export function trackEventGoal(state, type, amount = 1, now = Date.now()) {
  const ev = currentEvent(now);
  if (!ev || ev.kind !== 'small' || !state.economy) return;
  const rec = record(state, ev.id);
  for (const g of EVENTS.small.goals) if (g.type === type) rec.goals[g.id] = Math.min(g.target, (rec.goals[g.id] ?? 0) + amount);
}

export function claimEventGoal(state, goalId, now = Date.now()) {
  const ev = currentEvent(now);
  if (!ev || ev.kind !== 'small') return null;
  const rec = record(state, ev.id);
  const g = EVENTS.small.goals.find((x) => x.id === goalId);
  if (!g || rec.claimed.includes(g.id) || (rec.goals[g.id] ?? 0) < g.target) return null;
  rec.claimed.push(g.id);
  return grantReward(state, g.give);
}
