// v9.2.8 : boutique (document du producteur, sections 11 à 17). Catalogue lu dans data/economy.js.
// AUCUN PAIEMENT RÉEL : tant qu'aucun fournisseur n'est branché (setPaymentProvider), purchase() refuse tout achat et
// l'interface affiche « Bientôt disponible ». Rien n'est jamais donné sans un reçu vérifié par le fournisseur.
// Reste à connecter : un fournisseur (Steam, Google Play Billing, Stripe…) qui implémente
//   buy(offer) → Promise<reçu { productId, transactionId }> et verify(reçu) → Promise<boolean> (vérification serveur),
// puis la sauvegarde des achats côté serveur (le compte), le remboursement et la restauration des achats.
import { PACKS, PRODUCTS, SKIN_TIERS, SPEND_TIERS, THEME_TIERS, skinTier } from '../data/economy.js';
import { HEROES, STARTER_HERO } from '../data/heroes.js';
import { THEMES } from '../ui/themes.js';
import { grantReward } from './rewards.js';
import { ensureEconomy } from './wallet.js';
import { dayKey, monthKey } from './income.js';
import { ownsSkin, ownsTheme } from './cosmetics.js';

const DAY = 86400000;

// Offres de cosmétiques construites depuis les apparences et les thèmes (prix par catégorie).
export function skinOffers() {
  return HEROES.filter((h) => h.id !== STARTER_HERO).map((h) => {
    const tier = skinTier(h);
    return { id: `skin_${h.id}`, cat: 'skins', name: h.name, price: SKIN_TIERS[tier].price, icon: SKIN_TIERS[tier].icon, tier, skins: [h.id], themes: [] };
  });
}
export function themeOffers() {
  return THEMES.filter((t) => t.shop).map((t) => ({ id: `theme_${t.id}`, cat: 'themes', name: t.name, price: THEME_TIERS[t.shop].price, icon: THEME_TIERS[t.shop].icon, tier: t.shop, skins: [], themes: [t.id] }));
}
export function packOffers() {
  return PACKS.map((p) => ({ ...p, cat: 'packs' }));
}
export function allOffers() {
  return [...PRODUCTS, ...skinOffers(), ...themeOffers(), ...packOffers()];
}
export const offerById = (id) => allOffers().find((o) => o.id === id) ?? null;

// État d'une offre pour ce joueur : achetable ou non, et pourquoi.
export function offerState(state, offer, now = Date.now()) {
  const p = state.economy?.store?.purchases?.[offer.id];
  const month = monthKey(now);
  const monthCount = p?.month === month ? p.monthCount : 0;
  const first = !(p?.count > 0) && offer.firstBonus > 0;
  const ownedSkins = (offer.skins ?? []).filter((id) => ownsSkin(state, id));
  const ownedThemes = (offer.themes ?? []).filter((id) => ownsTheme(state, id));
  const cosmetic = (offer.skins?.length ?? 0) + (offer.themes?.length ?? 0) > 0;
  const owned = cosmetic && ownedSkins.length + ownedThemes.length > 0;
  const sub = offer.days ? state.economy?.store?.subs?.[offer.id] : null;
  const active = Boolean(sub && sub.until > now);
  let reason = null;
  if (owned) reason = 'owned';
  else if (offer.limit != null && monthCount >= offer.limit) reason = 'limit';
  else if (active) reason = 'active';
  return { first, monthCount, limitLeft: offer.limit != null ? Math.max(0, offer.limit - monthCount) : null, owned, ownedSkins, ownedThemes, active, until: sub?.until ?? 0, reason, canBuy: !reason };
}

// Contenu réellement donné (bonus de première acquisition compris) : affiché avant toute confirmation.
export function offerContent(state, offer) {
  const give = { ...(offer.give ?? {}) };
  if (offerState(state, offer).first) for (const k of Object.keys(give)) give[k] = Math.floor(give[k] * (1 + offer.firstBonus));
  return give;
}

// --- Couche d'achat (à brancher) ---------------------------------------------------------------------------------
let provider = null;
export function setPaymentProvider(p) { provider = p && typeof p.buy === 'function' && typeof p.verify === 'function' ? p : null; }
export const paymentReady = () => provider !== null;

export async function purchase(state, offerId, now = Date.now()) {
  const offer = offerById(offerId);
  if (!offer) return { ok: false, reason: 'unknown' };
  if (!provider) return { ok: false, reason: 'unavailable' };
  const st = offerState(state, offer, now);
  if (!st.canBuy) return { ok: false, reason: st.reason };
  const receipt = await provider.buy(offer);
  if (!receipt || receipt.productId !== offer.id || !(await provider.verify(receipt))) return { ok: false, reason: 'unverified' };
  return deliver(state, offer.id, { ...receipt, verified: true }, now);
}

// Livraison d'un achat VÉRIFIÉ (appelée seulement par purchase() après verify, ou par la restauration des achats).
export function deliver(state, offerId, receipt, now = Date.now()) {
  const offer = offerById(offerId);
  if (!offer || receipt?.verified !== true || receipt.productId !== offerId) return { ok: false, reason: 'unverified' };
  const st = offerState(state, offer, now);
  if (!st.canBuy) return { ok: false, reason: st.reason };
  const eco = ensureEconomy(state);
  const give = offerContent(state, offer);
  const given = grantReward(state, give);
  for (const id of offer.skins ?? []) state.heroes.owned[id] ??= { stars: 1 };
  for (const id of offer.themes ?? []) { state.cosmetics ??= { themes: {} }; state.cosmetics.themes[id] = true; }
  if (offer.days) eco.store.subs[offer.id] = { until: now + offer.days * DAY, lastDay: dayKey(now) };
  const month = monthKey(now);
  const p = (eco.store.purchases[offer.id] ??= { count: 0, month, monthCount: 0 });
  if (p.month !== month) { p.month = month; p.monthCount = 0; }
  p.count += 1;
  p.monthCount += 1;
  eco.store.spentCents += offer.price;
  return { ok: true, given };
}

// Abonnement « Bénédiction quotidienne » : la part du jour, une fois par jour tant qu'il est actif.
export function tickSubscriptions(state, now = Date.now()) {
  const subs = state.economy?.store?.subs ?? {};
  const out = {};
  for (const [id, sub] of Object.entries(subs)) {
    const offer = offerById(id);
    if (!offer?.daily || sub.until <= now || sub.lastDay === dayKey(now)) continue;
    sub.lastDay = dayKey(now);
    for (const [k, v] of Object.entries(grantReward(state, offer.daily))) out[k] = (out[k] ?? 0) + v;
  }
  return out;
}

// v9.2.9 : pastille du bouton Boutique de la barre du haut : une offre gratuite encore disponible (prix 0, achetable)
// ou la part du jour d'un abonnement actif pas encore reçue.
export function shopFreeAvailable(state, now = Date.now()) {
  if (allOffers().some((o) => (o.price === 0 || o.free) && offerState(state, o, now).canBuy)) return true;
  const subs = state.economy?.store?.subs ?? {};
  return Object.entries(subs).some(([id, sub]) => offerById(id)?.daily && sub.until > now && sub.lastDay !== dayKey(now));
}

// Paliers de dépenses cumulées (cosmétiques seulement).
export function spendTiers(state) {
  const spent = state.economy?.store?.spentCents ?? 0;
  return SPEND_TIERS.map((t) => ({ ...t, reached: spent >= t.cents }));
}

// Rendement d'une offre en invocations par euro (simulation et écran d'aide) : gemmes / 100 + tickets héros.
export function pullsOf(give, gemsPerPull = 100) {
  return (give.gems ?? 0) / gemsPerPull + (give.ticketLimited ?? 0) + (give.ticketPermanent ?? 0);
}
