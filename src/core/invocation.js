// v9.2.8 : moteur des invocations (document du producteur, sections 3, 4, 8 et 9). Fonctions pures, sans donnée du jeu :
// le jeu (core/gacha.js) et la simulation (tools/sim-economy.mjs) appellent exactement les mêmes fonctions.
// Configuration : data/economy.js (BANNERS, COPIES).
import { BANNERS, COPIES } from '../data/economy.js';

// Chance de SSR au n-ième tirage depuis le dernier SSR (n = 1, 2, 3…). Courbe documentée dans data/economy.js.
export function ssrChance(banner, n) {
  const base = banner.rates.SSR;
  if (n >= banner.hard) return 1;
  if (n < banner.softStart) return base;
  const x = (n - banner.softStart + 1) / (banner.hard - banner.softStart + 1);
  return Math.min(1, base + (1 - base) * x ** (banner.shape ?? 1));
}

// Loi exacte du nombre de tirages pour un SSR : P(N = n) et espérance (sert à l'écran des taux et aux tests).
export function ssrDistribution(banner) {
  const probs = [];
  let alive = 1;
  for (let n = 1; n <= banner.hard; n++) {
    const p = ssrChance(banner, n);
    probs.push(alive * p);
    alive *= 1 - p;
  }
  const mean = probs.reduce((s, p, i) => s + p * (i + 1), 0);
  return { probs, mean, rest: alive, consolidated: 1 / mean };
}

export function emptyPity() {
  return { limited: { ssr: 0, sr: 0, guaranteed: false }, permanent: { ssr: 0, sr: 0 }, pet: { ssr: 0, sr: 0 } };
}

// Choix d'un SSR de la bannière permanente selon la wishlist (règle écrite dans data/economy.js).
export function wishlistPick(ssrUnits, wishlist, banner, rng) {
  const ids = new Set(ssrUnits.map((u) => u.id));
  const wish = [...new Set(wishlist ?? [])].filter((id) => ids.has(id)).slice(0, banner.wishlistSize);
  const share = banner.wishlistSlotShare;
  if (!wish.length) return ssrUnits[Math.floor(rng.next() * ssrUnits.length)];
  const others = ssrUnits.filter((u) => !wish.includes(u.id));
  const wished = others.length ? Math.min(1, wish.length * share) : 1;
  const r = rng.next();
  if (r < wished) return ssrUnits.find((u) => u.id === wish[Math.min(wish.length - 1, Math.floor((r / wished) * wish.length))]);
  return others[Math.floor(rng.next() * others.length)];
}

// Probabilité d'un SSR précis parmi les SSR de la bannière permanente (affichage et tests).
export function wishlistShares(ssrUnits, wishlist, banner) {
  const ids = new Set(ssrUnits.map((u) => u.id));
  const wish = [...new Set(wishlist ?? [])].filter((id) => ids.has(id)).slice(0, banner.wishlistSize);
  const others = ssrUnits.filter((u) => !wish.includes(u.id));
  const wished = wish.length ? (others.length ? Math.min(1, wish.length * banner.wishlistSlotShare) : 1) : 0;
  return Object.fromEntries(ssrUnits.map((u) => [u.id, wish.includes(u.id) ? wished / wish.length : (1 - wished) / others.length]));
}

// Un tirage. `pity` = compteurs du groupe de la bannière (modifiés) ; `ctx` = { featured, SSR: [...], SR: [...], R: [...],
// wishlist } (unités { id, … }). Renvoie { tier, unit, featured, lost, viaGuarantee, hard, soft }.
export function rollOne(banner, pity, ctx, rng) {
  const n = pity.ssr + 1;
  const chance = ssrChance(banner, n);
  let tier;
  if (rng.next() < chance) tier = 'SSR';
  else {
    const srForced = pity.sr + 1 >= banner.srEvery;
    const srShare = banner.rates.SR / (1 - banner.rates.SSR);
    tier = srForced || rng.next() < srShare ? 'SR' : 'R';
  }
  const out = { tier, unit: null, featured: false, lost: false, viaGuarantee: false, hard: tier === 'SSR' && n >= banner.hard, soft: tier === 'SSR' && n >= banner.softStart && n < banner.hard };
  if (tier === 'SSR') {
    if (banner.fiftyFifty != null && ctx.featured) {
      // Bannière limitée : 50/50, puis vedette garantie après une perte (garantie conservée entre bannières limitées).
      const others = ctx.SSR.filter((u) => u.id !== ctx.featured.id);
      if (pity.guaranteed || !others.length || rng.next() < banner.fiftyFifty) {
        out.viaGuarantee = Boolean(pity.guaranteed);
        out.unit = ctx.featured;
        out.featured = true;
        pity.guaranteed = false;
      } else {
        out.unit = others[Math.floor(rng.next() * others.length)];
        out.lost = true;
        pity.guaranteed = true;
      }
    } else if (banner.wishlistSize) out.unit = wishlistPick(ctx.SSR, ctx.wishlist, banner, rng);
    else out.unit = ctx.SSR[Math.floor(rng.next() * ctx.SSR.length)];
    pity.ssr = 0;
    pity.sr = 0;
  } else {
    const list = ctx[tier].length ? ctx[tier] : ctx.R;
    out.unit = list[Math.floor(rng.next() * list.length)];
    pity.ssr += 1;
    pity.sr = tier === 'SR' ? 0 : pity.sr + 1;
  }
  return out;
}

// Ajoute un exemplaire (owned[id] = { stars: exemplaires 1..6, … }). Au-delà de 6 : conversion (COPIES.overflow).
// Renvoie { isNew, stars, overflow (récompense ou null), step (palier atteint : 1..6) }.
export function addCopy(owned, unit, kind, tier, fresh = () => ({ stars: 1 })) {
  const cur = owned[unit.id];
  if (!cur) {
    owned[unit.id] = fresh();
    return { isNew: true, stars: 1, overflow: null, step: 1 };
  }
  if (cur.stars < COPIES.max) {
    cur.stars += 1;
    return { isNew: false, stars: cur.stars, overflow: null, step: cur.stars };
  }
  return { isNew: false, stars: cur.stars, overflow: { ...COPIES.overflow[kind][tier] }, step: null };
}

export { BANNERS };
