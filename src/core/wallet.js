// v9.2.8 : portefeuille de l'économie (tickets héros limités et permanents, tickets familiers, fragments SSR universels,
// écus d'événement), séparé des gemmes. Chaque monnaie ne sert qu'à un usage (data/economy.js, WALLET).
import { WALLET_KEYS } from '../data/economy.js';

export function emptyEconomy() {
  return {
    wallet: Object.fromEntries(WALLET_KEYS.map((k) => [k, 0])),
    ledger: { month: '', counts: {}, got: {}, last: {} }, // revenus du mois (core/income.js)
    events: {}, // progression par événement (core/ancients.js)
    store: { purchases: {}, spentCents: 0, subs: {} }, // achats réels vérifiés seulement (core/store.js)
    legacyLook: null, // bonus de l'ancienne apparence, gardé comme bonus de compte (core/cosmetics.js)
  };
}

export function ensureEconomy(state) {
  state.economy ??= emptyEconomy();
  return state.economy;
}

export function walletAmount(state, key) {
  return state.economy?.wallet?.[key] ?? 0;
}

export function addWallet(state, key, amount) {
  const w = ensureEconomy(state).wallet;
  if (!WALLET_KEYS.includes(key)) return 0;
  w[key] = Math.max(0, (w[key] ?? 0) + Math.floor(amount));
  return amount;
}

// Nettoyage d'une sauvegarde.
export function sanitizeEconomy(raw) {
  const out = emptyEconomy();
  if (!raw || typeof raw !== 'object') return out;
  const int = (v, max = 1e9) => (Number.isFinite(v) ? Math.max(0, Math.min(max, Math.floor(v))) : 0);
  for (const k of WALLET_KEYS) out.wallet[k] = int(raw.wallet?.[k]);
  const l = raw.ledger;
  if (l && typeof l === 'object') {
    out.ledger.month = typeof l.month === 'string' ? l.month.slice(0, 7) : '';
    const map = (o, f) => Object.fromEntries(Object.entries(o && typeof o === 'object' ? o : {}).slice(0, 40).filter(([k]) => /^[A-Za-z0-9_]{1,32}$/.test(k)).map(([k, v]) => [k, f(v)]));
    out.ledger.counts = map(l.counts, (v) => int(v, 1000));
    out.ledger.last = map(l.last, (v) => (typeof v === 'string' ? v.slice(0, 10) : ''));
    out.ledger.got = map(l.got, (v) => map(v, (x) => int(x, 100000)));
  }
  if (raw.events && typeof raw.events === 'object') {
    for (const [id, e] of Object.entries(raw.events).slice(0, 40)) {
      if (!/^[a-z0-9_-]{1,40}$/.test(id) || !e || typeof e !== 'object') continue;
      out.events[id] = {
        cleared: int(e.cleared, 1000), coins: int(e.coins), bought: Object.fromEntries(Object.entries(e.bought ?? {}).slice(0, 20).map(([k, v]) => [String(k).slice(0, 20), int(v, 1000)])),
        goals: Object.fromEntries(Object.entries(e.goals ?? {}).slice(0, 20).map(([k, v]) => [String(k).slice(0, 20), int(v)])),
        claimed: Array.isArray(e.claimed) ? e.claimed.filter((x) => typeof x === 'string').slice(0, 40) : [],
        boss: { day: typeof e.boss?.day === 'string' ? e.boss.day.slice(0, 10) : '', used: int(e.boss?.used, 100), best: int(e.boss?.best, 1e300) },
        fragment: e.fragment === true,
      };
    }
  }
  const s = raw.store;
  if (s && typeof s === 'object') {
    out.store.spentCents = int(s.spentCents);
    for (const [id, p] of Object.entries(s.purchases ?? {}).slice(0, 200)) {
      if (!/^[a-z0-9_]{1,40}$/i.test(id) || !p || typeof p !== 'object') continue;
      out.store.purchases[id] = { count: int(p.count), month: typeof p.month === 'string' ? p.month.slice(0, 7) : '', monthCount: int(p.monthCount) };
    }
    for (const [id, until] of Object.entries(s.subs ?? {}).slice(0, 20)) {
      if (/^[a-z0-9_]{1,40}$/.test(id) && until && typeof until === 'object') out.store.subs[id] = { until: int(until.until, 1e15), lastDay: typeof until.lastDay === 'string' ? until.lastDay.slice(0, 10) : '' };
    }
  }
  const lb = raw.legacyLook;
  if (lb && typeof lb === 'object' && lb.bonus && typeof lb.bonus === 'object') {
    const bonus = {};
    for (const [k, v] of Object.entries(lb.bonus).slice(0, 12)) if (/^[A-Za-z]{2,24}$/.test(k) && Number.isFinite(v) && Math.abs(v) < 1000) bonus[k] = v;
    out.legacyLook = { from: typeof lb.from === 'string' ? lb.from.slice(0, 32) : '', bonus };
  }
  return out;
}
