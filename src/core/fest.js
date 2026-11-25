// v10.14 : moteur des FÊTES DU MOIS (data/fest.js, docs/evenements-v1014.md).
// Une fête = une feuille (grande ou petite) active entre `start` et `end` ; ses `pauseDays` derniers jours sont l'ÉCHANGE :
// on n'y gagne plus rien (combats, boss, missions fermés), mais la boutique et les récompenses déjà gagnées restent
// ouvertes. À la fin de l'échange, la monnaie restante est convertie en éclats (settleFests), jamais perdue.
// Source de la fête en cours :
//   - config live connue (core/live.js) : un élément d'événement de type « fest » et sa feuille (params.sheet) ;
//   - serveur jamais joint : le calendrier de data/fest.js (festAt), à l'heure locale.
// Progression : state.economy.events[<id de la fête>] (même enregistrement que les autres événements) + son champ `fest`.
import { FEST_DAY, FEST_MISSIONS, FEST_MISSION_TYPES, FEST_RULES, FEST_SHOPS, LIGHT_PATH, festAt, festSheet } from '../data/fest.js';
import { COMPANIONS } from '../data/companions.js';
import { TIER_OF } from '../data/economy.js';
import { eventParams } from '../data/live-catalog.js';
import { grantReward } from './rewards.js';
import { ensureEconomy } from './wallet.js';
import { dayKey } from './income.js';
import { addCopy } from './invocation.js';
import { liveEvent, liveKnown, liveNow } from './live.js';

const DAY = FEST_DAY;
const R = FEST_RULES;

// Fête en cours : feuille + { start, end, playEnd, phase: 'play' | 'pause', day, days, params, live } ou null.
export function currentFest(now = liveNow()) {
  let sheet = null;
  let start = 0;
  let end = 0;
  let params = eventParams('fest', {});
  let live = false;
  if (liveKnown()) {
    const e = liveEvent(now);
    if (!e || e.type !== 'fest') return null;
    params = eventParams('fest', e.params);
    sheet = festSheet(params.sheet);
    if (!sheet) return null;
    start = e.start;
    end = e.end ?? sheet.end;
    live = true;
  } else {
    sheet = festAt(now);
    if (!sheet) return null;
    ({ start, end } = sheet);
  }
  const playEnd = Math.max(start + DAY, end - R.pauseDays * DAY);
  return { ...sheet, start, end, playEnd, live, params, phase: now < playEnd ? 'play' : 'pause',
    day: Math.floor((now - start) / DAY) + 1, days: Math.max(1, Math.round((playEnd - start) / DAY)) };
}
const playing = (f) => f && f.phase === 'play';

function ensure(state, f) {
  const eco = ensureEconomy(state);
  eco.events[f.id] ??= { cleared: 0, coins: 0, bought: {}, goals: {}, claimed: [], boss: { day: '', used: 0, best: 0 }, fragment: false };
  const r = eco.events[f.id];
  r.fest ??= { earned: 0, steps: [], summons: 0, daily: { day: '', p: {}, done: [] }, trickle: { day: '', got: 0, kills: 0 }, until: f.end, settled: false };
  return r;
}
export function festRecord(state, now = liveNow()) {
  const f = currentFest(now);
  return f ? ensure(state, f) : null;
}

const mult = (f, k) => f.params?.[k] ?? 1;
function earn(rec, coins) {
  const c = Math.max(0, Math.round(coins));
  rec.coins += c;
  rec.fest.earned += c;
  return c;
}

// ---- Missions ----------------------------------------------------------------------------------------------------
const missionLabel = (m) => FEST_MISSION_TYPES[m.type].label.replace('{n}', m.n.toLocaleString('fr-FR'));
// Missions du jour : même tirage pour tous (graine = jour + fête), `count` différentes.
export function dailyMissions(f, now = liveNow()) {
  const pool = FEST_MISSIONS[f.kind].daily;
  let h = 2166136261;
  for (const ch of `${f.id}#${dayKey(now)}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const idx = pool.map((_, i) => i);
  const out = [];
  for (let k = 0; k < Math.min(R.dailyCount, pool.length); k += 1) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
    out.push(pool[idx.splice(h % idx.length, 1)[0]]);
  }
  // « Se connecter » d'abord quand il est tiré : un geste immédiat.
  return out.sort((a, b) => (a.type === 'login' ? -1 : 0) - (b.type === 'login' ? -1 : 0)).map((m) => ({ ...m, id: `d_${m.type}`, label: missionLabel(m) }));
}
function daily(rec, now) {
  const d = dayKey(now);
  if (rec.fest.daily.day !== d) rec.fest.daily = { day: d, p: {}, done: [] };
  return rec.fest.daily;
}

export function festMissions(state, now = liveNow()) {
  const f = currentFest(now);
  if (!f) return null;
  const rec = ensure(state, f);
  const dd = daily(rec, now);
  const open = playing(f);
  const day = dailyMissions(f, now).map((m) => {
    const p = Math.min(m.n, m.type === 'login' && open ? m.n : dd.p[m.type] ?? 0);
    const done = dd.done.includes(m.id);
    return { ...m, p, done, ready: open && !done && p >= m.n, tab: FEST_MISSION_TYPES[m.type].tab };
  });
  const ev = FEST_MISSIONS[f.kind].event.map((m) => {
    const p = Math.min(m.n, rec.goals[m.id] ?? 0);
    const done = rec.claimed.includes(m.id);
    return { ...m, label: missionLabel(m), p, done, ready: !done && p >= m.n, tab: FEST_MISSION_TYPES[m.type].tab };
  });
  return { daily: day, event: ev };
}

// Appelé par trackMissions (core/missions.js) : missions du jour, de la fête, et monnaie au fil du jeu (petite fête).
export function festTrack(state, type, amount = 1, now = liveNow()) {
  if (!state.economy) return;
  const f = currentFest(now);
  if (!playing(f)) return;
  const rec = ensure(state, f);
  const dd = daily(rec, now);
  dd.p[type] = (dd.p[type] ?? 0) + amount;
  for (const m of FEST_MISSIONS[f.kind].event) if (m.type === type) rec.goals[m.id] = Math.min(m.n, (rec.goals[m.id] ?? 0) + amount);
  if (f.kind === 'light' && (type === 'kills' || type === 'bosses')) {
    const t = rec.fest.trickle;
    if (t.day !== dd.day) Object.assign(t, { day: dd.day, got: 0, kills: 0 });
    let gain = 0;
    if (type === 'kills') { t.kills += amount; gain = Math.floor(t.kills / R.trickle.kills); t.kills %= R.trickle.kills; }
    else gain = amount * R.trickle.bosses;
    gain = Math.min(gain, R.trickle.dailyCap - t.got);
    if (gain > 0) { t.got += gain; earn(rec, gain); }
  }
}
// Invocations sur la bannière limitée pendant la grande fête (core/gacha.js) : jalons d'invocation.
export function festSummons(state, pool, count, now = liveNow()) {
  const f = currentFest(now);
  if (!playing(f) || f.kind !== 'grand' || pool !== 'limited') return;
  ensure(state, f).fest.summons += count;
}

export function claimFestMission(state, id, now = liveNow()) {
  const f = currentFest(now);
  const list = festMissions(state, now);
  if (!list) return null;
  const rec = ensure(state, f);
  const d = list.daily.find((m) => m.id === id);
  if (d) {
    if (!d.ready) return null;
    daily(rec, now).done.push(id);
    return { coins: earn(rec, d.coins * mult(f, 'coinMult')), given: {} };
  }
  const m = list.event.find((x) => x.id === id);
  if (!m?.ready) return null;
  rec.claimed.push(id);
  return { coins: earn(rec, m.coins * mult(f, 'coinMult')), given: grantReward(state, m.give) };
}
export function claimFestAll(state, now = liveNow()) {
  const list = festMissions(state, now);
  if (!list) return null;
  let coins = 0;
  const given = {};
  for (const m of [...list.daily, ...list.event].filter((x) => x.ready)) {
    const r = claimFestMission(state, m.id, now);
    if (!r) continue;
    coins += r.coins;
    for (const [k, v] of Object.entries(r.given)) given[k] = (given[k] ?? 0) + v;
  }
  return coins || Object.keys(given).length ? { coins, given } : null;
}

// ---- Grande fête : Carte du héros ----------------------------------------------------------------------------------
export const festTotalStages = () => R.map.regions * R.map.stagesPerRegion;
export function festStageLevel(state, n) {
  const best = Math.max(1, state.records?.bestStage ?? 1, state.maxStage ?? 1);
  return Math.max(1, Math.round(best * (R.map.stageScale.from + R.map.stageScale.per * n)));
}
export const featuredInTeam = (state, f) => Boolean(f?.featured && state.companions?.equipped?.includes(f.featured));

// `power` = { dps, hpOf(stage) } (main.js : stats réelles du héros, PV réels du gardien).
export function festFight(state, n, power, now = liveNow()) {
  const f = currentFest(now);
  if (!f || f.kind !== 'grand') return { error: 'closed' };
  if (!playing(f)) return { error: 'pause' };
  const rec = ensure(state, f);
  if (n !== rec.cleared + 1 || n > festTotalStages()) return { error: 'locked' };
  const hp = power.hpOf(festStageLevel(state, n));
  const dealt = power.dps * R.map.fightSeconds;
  if (dealt < hp) return { won: false, dealt, hp };
  rec.cleared = n;
  let coins = R.map.stageCoins + (n % R.map.stagesPerRegion === 0 ? R.map.regionCoins : 0);
  coins *= mult(f, 'coinMult') * (featuredInTeam(state, f) ? 1 + R.map.featuredBonus : 1);
  const reward = { coins: earn(rec, coins) };
  if (n === R.map.fragmentStage && !rec.fragment) {
    rec.fragment = true;
    reward.given = grantReward(state, { ssrFragment: 1 });
  }
  return { won: true, dealt, hp, reward };
}

// Jalons d'invocation : atteint, récupéré.
export function festSummonSteps(state, now = liveNow()) {
  const f = currentFest(now);
  if (!f || f.kind !== 'grand') return [];
  const rec = ensure(state, f);
  return R.summonSteps.map((s, i) => ({ ...s, index: i, reached: rec.fest.summons >= s.at, claimed: rec.fest.steps.includes(`s${i}`) }));
}

// ---- Grande fête : World Boss -------------------------------------------------------------------------------------
export function festBossStatus(state, now = liveNow()) {
  const f = currentFest(now);
  if (!f || f.kind !== 'grand' || f.params.worldBoss === false) return null;
  const rec = ensure(state, f);
  const per = f.params.attemptsPerDay ?? R.boss.attemptsPerDay;
  const today = dayKey(now);
  const used = rec.boss.day === today ? rec.boss.used : 0;
  return { open: playing(f) && rec.cleared >= R.map.bossUnlockStage, pause: !playing(f), unlockStage: R.map.bossUnlockStage,
    left: playing(f) ? Math.max(0, per - used) : 0, perDay: per, best: rec.boss.best ?? 0, boss: f.boss,
    today: rec.boss.day === today ? rec.boss.today ?? 0 : 0, tiers: rec.boss.day === today ? rec.boss.tiers ?? 0 : 0 };
}
export function startFestBoss(state, hpOf, now = liveNow()) {
  const st = festBossStatus(state, now);
  if (!st?.open || st.left <= 0) return null;
  const f = currentFest(now);
  const rec = ensure(state, f);
  const today = dayKey(now);
  if (rec.boss.day !== today) rec.boss = { day: today, used: 0, best: rec.boss.best ?? 0, today: 0, todayBest: 0, hp: 0, tiers: 0 };
  if (!(rec.boss.hp > 0)) rec.boss.hp = Math.max(1, Math.round(hpOf() * mult(f, 'bossHpMult')));
  rec.boss.used += 1;
  return { event: f.id, day: today, attempt: rec.boss.used, seed: seedOf(`${f.id}#${today}#${rec.boss.used}`), maxHp: rec.boss.hp, bossId: f.boss };
}
export function finishFestBoss(state, setup, result, now = liveNow()) {
  const f = currentFest(now);
  if (!f || !setup || setup.event !== f.id) return null;
  const rec = ensure(state, f);
  if (rec.boss.day !== setup.day) return null;
  const damage = Math.max(0, Math.floor(result.damage));
  const record = damage > (rec.boss.best ?? 0);
  rec.boss.best = Math.max(rec.boss.best ?? 0, damage);
  rec.boss.today = (rec.boss.today ?? 0) + damage;
  rec.boss.tiers = Math.max(rec.boss.tiers ?? 0, result.tiers ?? 0);
  const coins = earn(rec, (R.boss.coinsBase + R.boss.coinsPerTier * (result.tiers ?? 0)) * mult(f, 'coinMult'));
  return { damage, coins, record, best: rec.boss.best, tiers: result.tiers ?? 0 };
}

function seedOf(text) {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

// ---- Petite fête : sentier (héros et familier gratuits) ----------------------------------------------------------
export function festPath(state, now = liveNow()) {
  const f = currentFest(now);
  if (!f || f.kind !== 'light') return [];
  const rec = ensure(state, f);
  return LIGHT_PATH.map((s, i) => ({ ...s, index: i, reached: rec.fest.earned >= s.at, claimed: rec.fest.steps.includes(`p${i}`) }));
}

const unitOf = (id) => COMPANIONS.find((c) => c.id === id);
// Un exemplaire d'un compagnon (héros allié ou familier) : nouveau, une étoile de plus, ou sa conversion au maximum.
export function giveCopy(state, id) {
  const c = unitOf(id);
  if (!c || !state.companions?.owned) return null;
  const kind = c.kind === 'ally' ? 'hero' : 'pet';
  const owned = state.companions.owned;
  if (owned[id]?.trial) delete owned[id];
  const got = addCopy(owned, c, kind, TIER_OF[kind][c.rarity], () => ({ stars: 1, level: 1 }));
  const given = got.overflow ? grantReward(state, got.overflow) : {};
  return { id, name: c.name, isNew: got.isNew, stars: got.stars, given };
}

// Récupère une récompense atteinte : 's<i>' (jalon d'invocation) ou 'p<i>' (étape du sentier).
export function claimFestStep(state, key, now = liveNow()) {
  const f = currentFest(now);
  if (!f) return null;
  const rec = ensure(state, f);
  const i = Number(String(key).slice(1));
  const list = key[0] === 's' ? festSummonSteps(state, now) : key[0] === 'p' ? festPath(state, now) : [];
  const s = list[i];
  if (!s || !s.reached || s.claimed) return null;
  rec.fest.steps.push(`${key[0]}${i}`);
  const out = { given: s.give ? grantReward(state, s.give) : {}, units: [] };
  if (s.hero) out.units.push(giveCopy(state, f.hero));
  if (s.pet) out.units.push(giveCopy(state, f.pet));
  out.units = out.units.filter(Boolean);
  for (const u of out.units) for (const [k, v] of Object.entries(u.given)) out.given[k] = (out.given[k] ?? 0) + v;
  return out;
}
export function festReady(state, now = liveNow()) {
  const f = currentFest(now);
  if (!f) return 0;
  const steps = [...festSummonSteps(state, now), ...festPath(state, now)].filter((s) => s.reached && !s.claimed).length;
  const m = festMissions(state, now);
  return steps + [...m.daily, ...m.event].filter((x) => x.ready).length;
}
export function claimFestSteps(state, now = liveNow()) {
  const keys = [...festSummonSteps(state, now).map((s) => ({ s, k: `s${s.index}` })), ...festPath(state, now).map((s) => ({ s, k: `p${s.index}` }))]
    .filter(({ s }) => s.reached && !s.claimed).map(({ k }) => k);
  const out = { given: {}, units: [] };
  for (const k of keys) {
    const r = claimFestStep(state, k, now);
    if (!r) continue;
    for (const [a, v] of Object.entries(r.given)) out.given[a] = (out.given[a] ?? 0) + v;
    out.units.push(...r.units);
  }
  return keys.length ? out : null;
}

// ---- Boutique -----------------------------------------------------------------------------------------------------
export function festShop(state, now = liveNow()) {
  const f = currentFest(now);
  if (!f) return [];
  const rec = ensure(state, f);
  const m = mult(f, 'shopStockMult');
  return FEST_SHOPS[f.kind].map((i) => {
    const stock = Math.floor(i.stock * m);
    const bought = rec.bought[i.id] ?? 0;
    const unit = i.copy === 'hero' ? f.hero : i.copy === 'pet' ? f.pet : null;
    return { ...i, unit, stock, bought, left: Math.max(0, stock - bought), can: rec.coins >= i.price && bought < stock };
  });
}
export function buyFest(state, id, now = liveNow()) {
  const f = currentFest(now);
  const item = festShop(state, now).find((i) => i.id === id);
  if (!f || !item?.can) return null;
  const rec = ensure(state, f);
  rec.coins -= item.price;
  rec.bought[id] = (rec.bought[id] ?? 0) + 1;
  if (item.unit) { const u = giveCopy(state, item.unit); return { given: u?.given ?? {}, units: u ? [u] : [] }; }
  return { given: grantReward(state, item.give), units: [] };
}

// ---- Fin de l'échange : monnaie restante → éclats -----------------------------------------------------------------
// Appelée au chargement et au rafraîchissement : toute fête terminée (date de fin passée) est soldée une fois.
export function settleFests(state, now = liveNow()) {
  const events = state.economy?.events ?? {};
  let shards = 0;
  for (const rec of Object.values(events)) {
    const fr = rec?.fest;
    if (!fr || fr.settled || !(fr.until > 0) || now < fr.until) continue;
    fr.settled = true;
    if (rec.coins > 0) { shards += rec.coins * R.leftoverShards; rec.coins = 0; }
  }
  if (shards > 0) grantReward(state, { shards });
  return shards;
}
