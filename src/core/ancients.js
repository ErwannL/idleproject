// v9.2.8 : événements (document du producteur, section 7). Cycle de 28 jours : grand événement « Expédition des
// Anciens » (14 j) puis petit événement « Marché des lueurs » (14 j). Configuration : data/economy.js (EVENTS).
// Première version jouable du grand événement : carte de 5 régions × 10 étapes en combat automatique résolu d'un coup
// (dégâts du héros pendant 30 s contre les PV du gardien de l'étape), World Boss dès l'étape 20 (3 tentatives par
// jour), écus d'événement et boutique d'événement, fragment SSR universel à l'étape 30.
// v9.2.9 : le World Boss n'est plus résolu d'un coup : vrai combat animé de 60 s (core/world-boss.js, ui/world-boss.js).
// Reportés (voir le plan) : reliques d'événement améliorables, Failles dimensionnelles de la 2e semaine.
import { EVENTS } from '../data/economy.js';
import { grantReward } from './rewards.js';
import { ensureEconomy } from './wallet.js';
import { dayKey } from './income.js';
import { attemptCoins, attemptSeed } from './world-boss.js'; // v9.2.9
import { liveEvent, liveFlag, liveKnown, liveNow } from './live.js'; // v9.3.0 : live-ops
import { eventParams } from '../data/live-catalog.js';

const DAY = 86400000;
const anchorMs = () => new Date(`${EVENTS.anchor}T00:00:00`).getTime();

// Événement en cours : { kind: 'grand' | 'small', id (unique par cycle), cycle, day (1..days), days, start, end,
// params } ou null.
// v9.3.0 : piloté par la config live (core/live.js) : l'événement n'existe que si le serveur l'active, à l'heure du
// serveur. Le cycle de 28 jours ci-dessous ne sert QUE si le serveur n'a jamais répondu (docs/live-ops.md).
export function currentEvent(now = liveNow()) {
  if (liveKnown()) {
    const e = liveEvent(now);
    if (!e) return null;
    const kind = e.kind;
    const end = e.end ?? e.start + 14 * DAY;
    // e.cycle : élément repris du calendrier 9.2.9 → même identifiant que la 9.2.9 (progression conservée).
    const base = kind === 'grand' ? EVENTS.grand.id : EVENTS.small.id;
    return { kind, id: e.cycle ? `${base}-${e.cycle}` : `${base}-live${e.id}`, cycle: e.cycle ?? e.id, live: true, title: e.title,
      day: Math.floor((now - e.start) / DAY) + 1, days: Math.max(1, Math.ceil((end - e.start) / DAY)), start: e.start, end,
      params: eventParams(e.type, e.params) };
  }
  return calendarEvent(now);
}

// Calendrier codé en dur d'avant la 9.3.0 (repli « serveur jamais joint »).
export function calendarEvent(now) {
  const t = now - anchorMs();
  if (t < 0) return null;
  const cycle = Math.floor(t / (EVENTS.cycleDays * DAY));
  const inCycle = t - cycle * EVENTS.cycleDays * DAY;
  const grand = inCycle < EVENTS.grandDays * DAY;
  const start = anchorMs() + cycle * EVENTS.cycleDays * DAY + (grand ? 0 : EVENTS.grandDays * DAY);
  const len = (grand ? EVENTS.grandDays : EVENTS.cycleDays - EVENTS.grandDays) * DAY;
  const kind = grand ? 'grand' : 'small';
  return { kind, id: `${kind === 'grand' ? EVENTS.grand.id : EVENTS.small.id}-${cycle + 1}`, cycle: cycle + 1, day: Math.floor((now - start) / DAY) + 1,
    days: len / DAY, start, end: start + len, params: eventParams(kind === 'grand' ? 'ancients' : 'lights') };
}

// v9.3.0 : réglages live appliqués au contenu livré par le code.
const P = (ev) => ev?.params ?? {};
export function eventShop(ev) {
  const m = P(ev).shopStockMult ?? 1;
  return EVENTS.grand.shop.map((i) => ({ ...i, stock: Math.floor(i.stock * m) }));
}
export function eventGoals(ev) {
  const m = P(ev).goalMult ?? 1;
  return EVENTS.small.goals.map((g) => ({ ...g, target: Math.max(1, Math.ceil(g.target * m)) }));
}
export const attemptsPerDay = (ev) => P(ev).attemptsPerDay ?? EVENTS.grand.worldBoss.attemptsPerDay;
const coinMult = (ev) => P(ev).coinMult ?? 1;

function record(state, id) {
  const eco = ensureEconomy(state);
  eco.events[id] ??= { cleared: 0, coins: 0, bought: {}, goals: {}, claimed: [], boss: { day: '', used: 0, best: 0 }, fragment: false };
  return eco.events[id];
}

export function eventRecord(state, now = liveNow()) {
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
export function fightStage(state, n, power, now = liveNow()) {
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
  coins = Math.round(coins * coinMult(ev)); // v9.3.0
  rec.coins += coins;
  const reward = { eventCoins: coins };
  if (n === G().fragmentStage && !rec.fragment) {
    rec.fragment = true;
    grantReward(state, { ssrFragment: 1 });
    reward.ssrFragment = 1;
  }
  return { won: true, dealt, hp, reward };
}

export function worldBossStatus(state, now = liveNow()) {
  const ev = currentEvent(now);
  if (!ev || ev.kind !== 'grand') return null;
  if (P(ev).worldBoss === false || !liveFlag('worldBoss')) return null; // v9.3.0 : World Boss coupé par la config live
  const rec = record(state, ev.id);
  const wb = G().worldBoss;
  const today = dayKey(now);
  const used = rec.boss.day === today ? rec.boss.used : 0;
  return { open: rec.cleared >= wb.unlockStage, left: Math.max(0, attemptsPerDay(ev) - used), best: rec.boss.best, perDay: attemptsPerDay(ev), boss: P(ev).boss ?? 'colossus' };
}

// v9.2.9 : World Boss en vrai combat animé (core/world-boss.js). Une tentative = startWorldBoss (consomme la tentative
// tout de suite : quitter en cours de route ne la rend pas) puis finishWorldBoss (dégâts, record, paliers, écus).
// Le jour garde : tentatives utilisées, dégâts du jour, meilleur score du jour, PV du boss du jour (mesurés une fois).
function bossDay(rec, today) {
  if (rec.boss.day !== today) rec.boss = { day: today, used: 0, best: rec.boss.best ?? 0, today: 0, todayBest: 0, hp: 0, tiers: 0 };
  rec.boss.today ??= 0;
  rec.boss.todayBest ??= 0;
  rec.boss.hp ??= 0;
  rec.boss.tiers ??= 0;
  return rec.boss;
}

export function worldBossDay(state, now = liveNow()) {
  const rec = eventRecord(state, now);
  if (!rec) return null;
  const today = dayKey(now);
  const b = rec.boss.day === today ? rec.boss : { today: 0, todayBest: 0, hp: 0, tiers: 0 };
  return { today: b.today ?? 0, todayBest: b.todayBest ?? 0, hp: b.hp ?? 0, tiers: b.tiers ?? 0, best: rec.boss.best ?? 0 };
}

// `hpOf()` : PV du boss du jour (appelé seulement à la première tentative du jour). Renvoie le réglage du combat.
export function startWorldBoss(state, hpOf, now = liveNow()) {
  const st = worldBossStatus(state, now);
  if (!st?.open || st.left <= 0) return null;
  const ev = currentEvent(now);
  const rec = record(state, ev.id);
  const today = dayKey(now);
  const b = bossDay(rec, today);
  if (!(b.hp > 0)) b.hp = Math.max(1, Math.round(hpOf() * (P(ev).bossHpMult ?? 1))); // v9.3.0 : PV réglés par la config live
  b.used += 1;
  return { event: ev.id, day: today, attempt: b.used, seed: attemptSeed(today, b.used), maxHp: b.hp };
}

// Fin d'une tentative : result = { damage, tiers } (WorldBossFight.result()). Écus selon les paliers atteints.
export function finishWorldBoss(state, setup, result, now = liveNow()) {
  const rec = eventRecord(state, now);
  if (!rec || !setup || rec.boss.day !== setup.day) return null;
  const damage = Math.max(0, Math.floor(result.damage));
  const b = rec.boss;
  const record = damage > (b.best ?? 0);
  b.best = Math.max(b.best ?? 0, damage);
  b.today = (b.today ?? 0) + damage;
  b.todayBest = Math.max(b.todayBest ?? 0, damage);
  b.tiers = Math.max(b.tiers ?? 0, result.tiers);
  const coins = Math.round(attemptCoins(result.tiers) * coinMult(currentEvent(now))); // v9.3.0
  rec.coins += coins;
  return { damage, coins, record, today: b.today, best: b.best, tiers: result.tiers };
}

// Boutique d'événement (écus → tickets), stocks par événement.
export function buyEventItem(state, itemId, now = liveNow()) {
  const ev = currentEvent(now);
  if (!ev || ev.kind !== 'grand') return null;
  const rec = record(state, ev.id);
  const item = eventShop(ev).find((i) => i.id === itemId);
  if (!item || rec.coins < item.price || (rec.bought[itemId] ?? 0) >= item.stock) return null;
  rec.coins -= item.price;
  rec.bought[itemId] = (rec.bought[itemId] ?? 0) + 1;
  return grantReward(state, item.give);
}

// Petit événement : objectifs comptés seulement pendant sa fenêtre (missions.js → trackMissions).
export function trackEventGoal(state, type, amount = 1, now = liveNow()) {
  const ev = currentEvent(now);
  if (!ev || ev.kind !== 'small' || !state.economy) return;
  const rec = record(state, ev.id);
  for (const g of eventGoals(ev)) if (g.type === type) rec.goals[g.id] = Math.min(g.target, (rec.goals[g.id] ?? 0) + amount);
}

export function claimEventGoal(state, goalId, now = liveNow()) {
  const ev = currentEvent(now);
  if (!ev || ev.kind !== 'small') return null;
  const rec = record(state, ev.id);
  const g = eventGoals(ev).find((x) => x.id === goalId);
  if (!g || rec.claimed.includes(g.id) || (rec.goals[g.id] ?? 0) < g.target) return null;
  rec.claimed.push(g.id);
  return grantReward(state, g.give);
}
