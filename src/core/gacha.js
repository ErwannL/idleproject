// Invocation de héros (compagnons alliés) et de familiers.
// v9.2.8 : refonte selon le document du producteur (économie). Trois bannières séparées, chacune avec ses taux, sa
// courbe de soft pity et sa garantie (data/economy.js, moteur pur dans core/invocation.js) :
// - limitée (héros) : SSR 2 %, 50/50 sur la vedette, vedette garantie après une perte, soft pity dès 80, SSR au 100 ;
//   payée en tickets limités ou en gemmes (= cristaux) ;
// - permanente (héros) : SSR 1,5 %, wishlist de 5, soft pity dès 80, SSR au 100 ; tickets permanents ou gemmes ;
// - familiers : SSR 3 %, soft pity dès 45, SSR au 60, pas de 50/50 ; tickets familiers seulement (jamais de gemmes).
// Les apparences (skins) ne s'invoquent plus : ce sont des cosmétiques sans bonus (core/cosmetics.js, boutique).
// Doublons : 6 exemplaires, puis conversion (COPIES.overflow), jamais perdus en silence.
import { BALANCE } from '../data/balance.js';
import { COMPANIONS } from '../data/companions.js';
import { SKILL_RULES } from '../data/companion-skills.js';
import { BANNERS, COPIES, EVENTS, TIER_OF } from '../data/economy.js';
import { BANNER_RULES, UNITS } from '../data/banners.js';
import { trackMissions } from './missions.js';
import { currentBanner } from './banner.js';
import { addCopy, emptyPity, rollOne, ssrDistribution, wishlistShares } from './invocation.js';
import { addWallet, ensureEconomy, walletAmount } from './wallet.js';
import { grantReward } from './rewards.js';
import { liveFeatured, liveFlag, liveKnown, liveNow } from './live.js'; // v9.3.0 : live-ops
import { festAt, festMonth } from '../data/fest.js'; // v10.14 : héros du mois
import { festSummons } from './fest.js';

export const FEATURED_SHARE = BANNERS.limited.fiftyFifty;
export const SUMMON_POOLS = ['limited', 'permanent', 'pet'];
// Anciens noms de bassins (sauvegardes, liens de recherche) : Compagnons et bannière → limitée, Archives → permanente.
const LEGACY_POOLS = { ally: 'limited', banner: 'limited', archive: 'permanent', hero: 'limited' };
export function normalizePool(pool) {
  if (SUMMON_POOLS.includes(pool)) return pool;
  return LEGACY_POOLS[pool] ?? 'limited';
}

const asUnit = (c) => (c ? { kind: 'companion', id: c.id, name: c.name, rarity: c.rarity, ally: c.kind === 'ally', ...(c.bannerOnly ? { bannerOnly: true } : {}) } : null);
const DAY = 86400000;

// SSR permanents (héros) : jamais un perso `bannerOnly` (limité), qui ne devient pas permanent tout seul.
export function permanentSsr() {
  return COMPANIONS.filter((c) => c.kind === 'ally' && c.rarity === 'legendary').map(asUnit);
}

// Vedette de la bannière limitée : le perso de la sortie en cours (BANNER_RULES actif) ; sinon, tant qu'aucun SSR
// limité n'est publié, un SSR permanent par période de 14 jours (rotation).
// v9.3.0 : la vedette vient de la config live (heure du serveur) ; aucune bannière active = aucune vedette. La rotation
// de 14 jours ne sert que si le serveur n'a jamais répondu (docs/live-ops.md).
export function featuredUnit(pool = 'limited', now = liveNow()) {
  if (normalizePool(pool) !== 'limited') return null;
  if (liveKnown()) {
    const lb = liveFlag('featuredBanner') ? liveFeatured(now) : null;
    return lb ? asUnit(COMPANIONS.find((c) => c.id === lb.unit)) : null;
  }
  const b = BANNER_RULES.enabled ? currentBanner(now) : null;
  if (b) return asUnit(b.unit);
  const fm = festCalendarFeatured(now); // v10.14 : héros du mois (calendrier des Fêtes, serveur jamais joint)
  if (fm) return asUnit(COMPANIONS.find((c) => c.id === fm.unit));
  const list = permanentSsr();
  const start = new Date(`${EVENTS.anchor}T00:00:00`).getTime();
  const k = Math.floor((now - start) / (BANNERS.limited.rotationDays * DAY));
  return list[((k % list.length) + list.length) % list.length];
}

// Fin de la période de la vedette (ms).
export function featuredEnds(now = liveNow()) {
  if (liveKnown()) return liveFeatured(now)?.end ?? 0; // v9.3.0
  const b = BANNER_RULES.enabled ? currentBanner(now) : null;
  if (b) return b.end;
  const fm = festCalendarFeatured(now);
  if (fm) return fm.end;
  const start = new Date(`${EVENTS.anchor}T00:00:00`).getTime();
  const period = BANNERS.limited.rotationDays * DAY;
  return start + (Math.floor((now - start) / period) + 1) * period;
}

// v10.14 : héros du mois du calendrier des Fêtes (1er au dernier jour du mois) : { unit, end } ou null.
function festCalendarFeatured(now) {
  const f = festAt(now);
  if (!f) return null;
  const mo = festMonth(f.index);
  return { unit: mo.grand.featured, end: mo.light.end };
}

// Unités d'un bassin, rangées par rareté du document (R, SR, SSR) : { featured, R, SR, SSR, wishlist }.
export function poolContext(pool, state = null, now = Date.now()) {
  const p = normalizePool(pool);
  const kind = p === 'pet' ? 'pet' : 'hero';
  const units = COMPANIONS.filter((c) => (c.kind === 'ally') === (kind === 'hero')).map(asUnit);
  const by = (t) => units.filter((u) => TIER_OF[kind][u.rarity] === t);
  const ctx = { kind, R: by('R'), SR: by('SR'), SSR: by('SSR'), featured: null, wishlist: [] };
  if (p === 'limited') {
    ctx.featured = featuredUnit('limited', now);
    if (ctx.featured && !ctx.SSR.some((u) => u.id === ctx.featured.id)) ctx.SSR = [...ctx.SSR, ctx.featured];
  }
  if (p === 'permanent') ctx.wishlist = cleanWishlist(state?.summon?.wishlist);
  return ctx;
}

export function summonPool(pool = 'limited', now = Date.now(), state = null) {
  const ctx = poolContext(pool, state, now);
  return [...ctx.R, ...ctx.SR, ...ctx.SSR];
}

export function cleanWishlist(list) {
  const ids = new Set(permanentSsr().map((u) => u.id));
  return [...new Set(Array.isArray(list) ? list : [])].filter((id) => ids.has(id)).slice(0, BANNERS.permanent.wishlistSize);
}

export function toggleWishlist(state, id) {
  const list = cleanWishlist(state.summon.wishlist);
  const i = list.indexOf(id);
  if (i >= 0) list.splice(i, 1);
  else if (list.length < BANNERS.permanent.wishlistSize && permanentSsr().some((u) => u.id === id)) list.push(id);
  else return false;
  state.summon.wishlist = list;
  return true;
}

// Probabilités affichées : par rareté du document (taux de base, hors pity) et par unité ; `consolidated` = taux moyen
// de SSR pity comprise (1 / espérance du nombre de tirages par SSR).
export function summonOdds(pool = 'limited', balance = BALANCE, now = Date.now(), state = null) {
  const p = normalizePool(pool);
  const banner = BANNERS[p];
  const ctx = poolContext(p, state, now);
  const rates = { SSR: banner.rates.SSR, SR: banner.rates.SR, R: 1 - banner.rates.SSR - banner.rates.SR };
  const shares = p === 'permanent' ? wishlistShares(ctx.SSR, ctx.wishlist, banner) : null;
  return ['SSR', 'SR', 'R'].map((tier) => {
    const list = ctx[tier];
    const chance = rates[tier];
    const unitChance = (u) => {
      if (tier !== 'SSR') return chance / list.length;
      if (shares) return chance * shares[u.id];
      if (ctx.featured && list.length > 1) return u.id === ctx.featured.id ? chance * banner.fiftyFifty : (chance * (1 - banner.fiftyFifty)) / (list.length - 1);
      return chance / list.length;
    };
    return { tier, rarity: tier === 'SSR' ? 'legendary' : tier === 'SR' ? 'epic' : 'rare', chance,
      units: list.map((u) => ({ ...u, chance: unitChance(u), featured: u.id === ctx.featured?.id, wished: ctx.wishlist.includes(u.id) })) };
  });
}

export function bannerStats(pool) {
  return ssrDistribution(BANNERS[normalizePool(pool)]);
}

export function summonCost(count, currency, balance = BALANCE) {
  if (currency !== 'gems') return count;
  return count >= 10 ? balance.summon.tenPullGemCost : balance.summon.gemCost * count;
}

// Peut-on payer `count` invocations sur ce bassin avec cette monnaie ?
export function canPay(state, pool, count, currency, balance = BALANCE) {
  const banner = BANNERS[normalizePool(pool)];
  if (!banner.pay.includes(currency)) return false;
  const have = currency === 'gems' ? state.gems : walletAmount(state, currency);
  return have >= summonCost(count, currency, balance);
}

// count = 1 ou 10 ; currency = 'gems' ou un ticket ('ticketLimited', 'ticketPermanent', 'ticketPet').
// Renvoie la liste des résultats, ou null (paiement refusé : mauvaise monnaie pour ce bassin, ou pas assez).
export function summon(state, rng, count = 1, currency = 'gems', balance = BALANCE, pool = 'limited', now = Date.now()) {
  const p = normalizePool(pool);
  const banner = BANNERS[p];
  ensureEconomy(state);
  if (!canPay(state, p, count, currency, balance)) return null;
  const ctx = poolContext(p, state, now);
  if (!ctx.SSR.length) return null;
  const cost = summonCost(count, currency, balance);
  if (currency === 'gems') state.gems -= cost;
  else addWallet(state, currency, -cost);
  trackMissions(state, 'summons', count);
  festSummons(state, p, count); // v10.14 : jalons d'invocation de la grande fête
  state.summon.pity ??= emptyPity();
  const pity = state.summon.pity[banner.pity];
  const results = [];
  for (let i = 0; i < count; i++) {
    const roll = rollOne(banner, pity, ctx, rng);
    const unit = roll.unit;
    const store = state.companions.owned;
    if (store[unit.id]?.trial) delete store[unit.id]; // v9.1.3 (lot 6) : l'essai gratuit n'est pas un exemplaire
    const got = addCopy(store, unit, ctx.kind, roll.tier, () => ({ stars: 1, level: 1 }));
    const refund = got.overflow ? grantReward(state, got.overflow) : null;
    state.summon.total += 1;
    results.push({
      ...unit, tier: roll.tier, rarity: unit.rarity, isNew: got.isNew, stars: got.stars, refund: refund?.gems ?? 0, overflow: refund,
      featured: roll.featured, lost: roll.lost, viaGuarantee: roll.viaGuarantee, guaranteed: roll.hard, pool: p,
      // Le 4e exemplaire débloque l'ultime (héros) ou la compétence spéciale (familiers).
      ultimateUnlocked: !got.isNew && !got.overflow && got.stars === SKILL_RULES.ultimateCopies,
    });
    state.summon.history = [{ id: unit.id, kind: unit.kind, rarity: unit.rarity, pool: p, at: now }, ...(state.summon.history ?? [])].slice(0, 60);
  }
  return results;
}

// Fragment SSR universel (DOC 6) : +1 exemplaire à un SSR héros déjà possédé (limité ou permanent), sans dépasser 6.
export function canUseSsrFragment(state, id) {
  const unit = UNITS.find((u) => u.id === id); // permanents et limités (persos de bannière)
  const owned = state.companions.owned[id];
  return Boolean(unit && unit.kind === 'ally' && unit.rarity === 'legendary' && owned && !owned.trial && owned.stars < COPIES.max && walletAmount(state, 'ssrFragment') >= 1);
}

export function useSsrFragment(state, id) {
  if (!canUseSsrFragment(state, id)) return null;
  addWallet(state, 'ssrFragment', -1);
  const owned = state.companions.owned[id];
  owned.stars += 1;
  return { id, stars: owned.stars, ultimateUnlocked: owned.stars === SKILL_RULES.ultimateCopies };
}
