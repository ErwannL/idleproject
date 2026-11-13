// v9.2.8 : économie du document du producteur — tests de la section 20.
import test from 'node:test';
import assert from 'node:assert/strict';
import { BALANCE } from '../src/data/balance.js';
import { BANNERS, COPIES, EVENT_INCOME, EVENTS, GEMS_PER_PULL, INCOME, MONTHLY_TARGETS, PACKS, PRODUCTS } from '../src/data/economy.js';
import { createNewState, sanitizeState, SAVE_VERSION } from '../src/core/state.js';
import { Rng } from '../src/core/rng.js';
import { addCopy, emptyPity, rollOne, ssrChance, ssrDistribution, wishlistShares } from '../src/core/invocation.js';
import { canPay, featuredUnit, permanentSsr, poolContext, summon, summonOdds, toggleWishlist, useSsrFragment } from '../src/core/gacha.js';
import { incomeBoss, incomeDungeon, incomeLogin, incomeMissions, incomeTrack, monthlyCaps } from '../src/core/income.js';
import { deliver, offerById, offerState, purchase, setPaymentProvider, skinOffers, themeOffers } from '../src/core/store.js';
import { equipSkin, ownsTheme, unequipSkin, wornTheme } from '../src/core/cosmetics.js';
import { heroEffects } from '../src/core/heroes.js';
import { computeHeroStats } from '../src/core/stats.js';
import { THEMES, themeSwatches } from '../src/ui/themes.js';
import { buyEventItem, currentEvent, fightStage, totalStages } from '../src/core/ancients.js';
import { migratePity } from '../src/core/migrations-v928.js';

const NOW = new Date('2026-11-07T12:00:00').getTime();
const DAY = 86400000;
const fresh = () => { const s = createNewState(NOW, 1); s.gems = 0; return s; };
// Hasard « toujours raté » : 0,999999 n'est jamais sous une chance < 1 (pire cas pour la garantie).
const unlucky = { next: () => 0.999999 };

test('taux et courbes = configuration ; prix d\'une invocation', () => {
  assert.equal(GEMS_PER_PULL, BALANCE.summon.gemCost);
  for (const [id, b] of Object.entries(BANNERS)) {
    for (let n = 1; n < b.softStart; n++) assert.equal(ssrChance(b, n), b.rates.SSR, `${id} n=${n}`);
    for (let n = b.softStart; n < b.hard; n++) assert.ok(ssrChance(b, n) > ssrChance(b, n - 1), `${id} croissante en ${n}`);
    assert.equal(ssrChance(b, b.hard), 1);
    const odds = summonOdds(id, BALANCE, NOW);
    assert.equal(odds.find((r) => r.tier === 'SSR').chance, b.rates.SSR);
    assert.ok(Math.abs(odds.reduce((a, r) => a + r.chance, 0) - 1) < 1e-12);
    for (const r of odds) assert.ok(Math.abs(r.units.reduce((a, u) => a + u.chance, 0) - r.chance) < 1e-12, `${id} ${r.tier}`);
    const d = ssrDistribution(b);
    assert.ok(d.rest < 1e-12, 'loi complète au tirage hard');
  }
  assert.equal(BANNERS.limited.rates.SSR, 0.02);
  assert.equal(BANNERS.permanent.rates.SSR, 0.015);
  assert.equal(BANNERS.pet.rates.SSR, 0.03);
  assert.deepEqual([BANNERS.limited.softStart, BANNERS.limited.hard, BANNERS.pet.softStart, BANNERS.pet.hard], [80, 100, 45, 60]);
});

test('garanties : SSR au plus tard au 100 (héros) et au 60 (familiers), même avec le pire hasard', () => {
  for (const [id, hard] of [['limited', 100], ['permanent', 100], ['pet', 60]]) {
    const s = fresh();
    const key = id === 'pet' ? 'ticketPet' : id === 'limited' ? 'ticketLimited' : 'ticketPermanent';
    s.economy.wallet[key] = 1000;
    let n = 0;
    let got = null;
    while (!got) { n += 1; got = summon(s, unlucky, 1, key, BALANCE, id, NOW).find((r) => r.tier === 'SSR'); }
    assert.equal(n, hard, id);
    assert.equal(got.guaranteed, true);
  }
  // Et sur 200 000 tirages au hasard réel, jamais plus de `hard` tirages sans SSR.
  for (const b of Object.values(BANNERS)) {
    const pity = emptyPity()[b.pity];
    const ctx = { R: [{ id: 'r' }], SR: [{ id: 's' }], SSR: [{ id: 'x' }, { id: 'y' }], featured: { id: 'x' }, wishlist: [] };
    const rng = new Rng(42);
    let since = 0; let max = 0;
    for (let i = 0; i < 200000; i++) { const r = rollOne(b, pity, ctx, rng); since = r.tier === 'SSR' ? 0 : since + 1; max = Math.max(max, since); }
    assert.ok(max < b.hard, `${b.id} : ${max}`);
  }
});

test('50/50 seulement sur la limitée ; perte → vedette garantie ; garantie et pity conservées entre bannières', () => {
  const b = BANNERS.limited;
  const f = { id: 'star' };
  const ctx = { R: [{ id: 'r' }], SR: [{ id: 's' }], SSR: [f, { id: 'o1' }, { id: 'o2' }], featured: f, wishlist: [] };
  const pity = emptyPity().limited;
  const rng = new Rng(7);
  let ssr = 0; let feat = 0; let afterLoss = 0; let losses = 0;
  for (let i = 0; i < 300000; i++) {
    const wasGuaranteed = pity.guaranteed;
    const r = rollOne(b, pity, ctx, rng);
    if (r.tier !== 'SSR') continue;
    ssr += 1;
    if (r.featured) feat += 1;
    if (wasGuaranteed) { afterLoss += 1; assert.equal(r.unit.id, 'star'); assert.equal(pity.guaranteed, false); }
    if (r.lost) { losses += 1; assert.equal(pity.guaranteed, true); }
  }
  assert.ok(afterLoss === losses || afterLoss === losses - 1);
  const firstShare = (feat - afterLoss) / (ssr - afterLoss);
  assert.ok(Math.abs(firstShare - 0.5) < 0.03, `50/50 : ${firstShare}`);
  // Permanente et familiers : jamais de perte, jamais de garantie.
  for (const id of ['permanent', 'pet']) {
    const p = emptyPity()[BANNERS[id].pity];
    for (let i = 0; i < 20000; i++) assert.equal(rollOne(BANNERS[id], p, ctx, rng).lost, false);
    assert.equal(p.guaranteed, undefined);
  }
  // Pity et garantie gardées d'une vedette à la suivante (rotation de 14 jours) : compteurs par groupe, pas par vedette.
  const s = fresh();
  s.summon.pity.limited = { ssr: 57, sr: 3, guaranteed: true };
  const a = featuredUnit('limited', NOW);
  const later = NOW + 14 * DAY;
  assert.notEqual(featuredUnit('limited', later).id, a.id);
  const back = sanitizeState(JSON.parse(JSON.stringify(s)), BALANCE, later);
  assert.deepEqual(back.summon.pity.limited, { ssr: 57, sr: 3, guaranteed: true });
  back.economy.wallet.ticketLimited = 1;
  back.summon.pity.limited.ssr = 99;
  const r = summon(back, new Rng(1), 1, 'ticketLimited', BALANCE, 'limited', later)[0];
  assert.equal(r.id, featuredUnit('limited', later).id, 'garantie appliquée à la nouvelle vedette');
});

test('wishlist : règle exacte (20 % par SSR inscrit, reste aux autres), limités refusés, respectée au tirage', () => {
  const b = BANNERS.permanent;
  const units = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({ id }));
  const sh = wishlistShares(units, ['a', 'b'], b);
  assert.ok(Math.abs(sh.a - 0.2) < 1e-12 && Math.abs(sh.c - 0.15) < 1e-12);
  const full = wishlistShares(units, ['a', 'b', 'c', 'd', 'e'], b);
  assert.equal(full.f, 0);
  const none = wishlistShares(units, [], b);
  assert.ok(Math.abs(none.a - 1 / 6) < 1e-12);
  // Dans le jeu (5 SSR permanents) : une wishlist complète couvre tout ; incomplète, la règle s'applique au tirage.
  const s = fresh();
  const ssr = permanentSsr();
  assert.equal(toggleWishlist(s, ssr[0].id), true);
  assert.equal(toggleWishlist(s, 'demo_ssr'), false, 'un limité ne s\'inscrit pas');
  const pity = emptyPity().permanent;
  const ctx = poolContext('permanent', s, NOW);
  const rng = new Rng(3);
  const count = {};
  let total = 0;
  for (let i = 0; i < 400000; i++) { const r = rollOne(b, pity, ctx, rng); if (r.tier === 'SSR') { total += 1; count[r.unit.id] = (count[r.unit.id] ?? 0) + 1; } }
  assert.ok(Math.abs(count[ssr[0].id] / total - 0.2) < 0.02, `inscrit : ${count[ssr[0].id] / total}`);
  for (const u of ssr.slice(1)) assert.ok(Math.abs(count[u.id] / total - 0.2) < 0.02);
});

test('tickets héros et familiers non interchangeables ; cristaux jamais consommés par les familiers', () => {
  const s = fresh();
  s.gems = 100000;
  s.economy.wallet = { ...s.economy.wallet, ticketLimited: 10, ticketPermanent: 10, ticketPet: 10 };
  assert.equal(summon(s, new Rng(1), 1, 'gems', BALANCE, 'pet', NOW), null);
  assert.equal(summon(s, new Rng(1), 1, 'ticketLimited', BALANCE, 'pet', NOW), null);
  assert.equal(summon(s, new Rng(1), 1, 'ticketPet', BALANCE, 'limited', NOW), null);
  assert.equal(summon(s, new Rng(1), 1, 'ticketPermanent', BALANCE, 'limited', NOW), null);
  assert.equal(summon(s, new Rng(1), 1, 'ticketLimited', BALANCE, 'permanent', NOW), null);
  assert.equal(s.gems, 100000);
  const pets = summon(s, new Rng(1), 10, 'ticketPet', BALANCE, 'pet', NOW);
  assert.ok(pets.every((r) => !r.ally));
  assert.equal(s.gems, 100000, 'gemmes intactes');
  assert.equal(s.economy.wallet.ticketPet, 0);
  assert.equal(s.economy.wallet.ticketLimited, 10);
  assert.ok(canPay(s, 'limited', 10, 'ticketLimited'));
  assert.ok(!canPay(s, 'pet', 1, 'ticketPet'));
});

test('6 exemplaires : paliers, ultime au 4e, jamais plus de 6, conversion au-delà ; fragment SSR universel', () => {
  const owned = {};
  const u = { id: 'x' };
  const steps = [];
  for (let i = 0; i < 8; i++) steps.push(addCopy(owned, u, 'hero', 'SSR', () => ({ stars: 1, level: 1 })));
  assert.deepEqual(steps.map((x) => x.step), [1, 2, 3, 4, 5, 6, null, null]);
  assert.equal(owned.x.stars, COPIES.max);
  assert.deepEqual(steps[6].overflow, COPIES.overflow.hero.SSR);
  assert.deepEqual(addCopy({ y: { stars: 6 } }, { id: 'y' }, 'pet', 'SSR').overflow, { ticketPet: 5 });
  // Dans le jeu : le 4e exemplaire signale l'ultime.
  const s = fresh();
  const ssr = permanentSsr()[0].id;
  s.companions.owned[ssr] = { stars: 3, level: 1 };
  s.economy.wallet.ssrFragment = 4;
  assert.equal(useSsrFragment(s, 'archer') ?? null, null, 'pas un SSR (ou non possédé)');
  assert.equal(useSsrFragment(s, permanentSsr()[1].id), null, 'SSR non possédé : ne débloque pas');
  const r = useSsrFragment(s, ssr);
  assert.equal(r.stars, 4);
  assert.equal(r.ultimateUnlocked, true);
  useSsrFragment(s, ssr); useSsrFragment(s, ssr);
  assert.equal(s.companions.owned[ssr].stars, 6);
  assert.equal(useSsrFragment(s, ssr), null, 'jamais au-delà de 6');
  assert.equal(s.economy.wallet.ssrFragment, 1);
  assert.ok(!PRODUCTS.some((p) => p.give?.ssrFragment), 'jamais vendu');
});

test('revenus : pas de double comptage, sommes mensuelles = cibles', () => {
  const caps = monthlyCaps();
  const ev = (k) => EVENT_INCOME.grand[k] + EVENT_INCOME.small[k];
  assert.equal(caps.ticketLimited + ev('ticketLimited'), MONTHLY_TARGETS.ticketLimited);
  assert.equal(caps.ticketPermanent + ev('ticketPermanent'), MONTHLY_TARGETS.ticketPermanent);
  assert.equal(caps.ticketPet + ev('ticketPet'), MONTHLY_TARGETS.ticketPet);
  // Événements : la boutique d'événement et les objectifs donnent exactement EVENT_INCOME.
  const shop = {};
  const TICKETS = ['ticketLimited', 'ticketPermanent', 'ticketPet', 'ssrFragment']; // v9.3.3 : ressources de compétences hors revenus en tickets
  for (const i of EVENTS.grand.shop) for (const [k, v] of Object.entries(i.give)) if (TICKETS.includes(k)) shop[k] = (shop[k] ?? 0) + v * i.stock;
  assert.deepEqual(shop, { ticketLimited: 30, ticketPermanent: 25, ticketPet: 20 });
  const small = {};
  for (const g of EVENTS.small.goals) for (const [k, v] of Object.entries(g.give)) small[k] = (small[k] ?? 0) + v;
  assert.deepEqual(small, EVENT_INCOME.small);
  // Un mois de 30 jours au maximum, chaque action répétée 3 fois par jour : jamais plus que les plafonds.
  const s = fresh();
  const start = new Date('2026-12-01T10:00:00').getTime();
  for (let d = 0; d < 31; d++) {
    const t = start + d * DAY;
    for (let k = 0; k < 3; k++) { incomeLogin(s, t); incomeMissions(s, t); incomeBoss(s, t); incomeDungeon(s, t); }
  }
  for (let i = 0; i < 12; i++) incomeTrack(s, start);
  assert.equal(s.economy.wallet.ticketLimited, caps.ticketLimited);
  assert.equal(s.economy.wallet.ticketPermanent, caps.ticketPermanent);
  assert.equal(s.economy.wallet.ticketPet, caps.ticketPet);
  assert.ok(INCOME.loginDaily.cap.ticketLimited === 60);
});

test('boutique : aucun paiement sans fournisseur, rien donné ; cosmétiques non rachetables ; limites ; bonus de 1re acquisition', async () => {
  const s = fresh();
  setPaymentProvider(null);
  const before = JSON.stringify(s);
  assert.deepEqual(await purchase(s, 'crystal_mini'), { ok: false, reason: 'unavailable' });
  assert.equal(JSON.stringify(s), before, 'aucune fausse transaction');
  assert.equal(deliver(s, 'crystal_mini', { productId: 'crystal_mini' }).ok, false, 'reçu non vérifié refusé');
  // Avec un fournisseur de test qui vérifie : bonus de première acquisition une seule fois, limites, rachat refusé.
  setPaymentProvider({ buy: async (o) => ({ productId: o.id, transactionId: 't' }), verify: async () => true });
  try {
    const g0 = s.gems;
    assert.equal((await purchase(s, 'crystal_mini', NOW)).ok, true);
    assert.equal(s.gems - g0, 300, '150 + 100 % (v9.6.5) la première fois');
    await purchase(s, 'crystal_mini', NOW);
    assert.equal(s.gems - g0, 450);
    for (let i = 0; i < 5; i++) await purchase(s, 'hero_ticket_I', NOW);
    assert.equal((await purchase(s, 'hero_ticket_I', NOW)).reason, 'limit');
    const skin = skinOffers().find((o) => o.skins[0] === 'fairy');
    assert.equal((await purchase(s, skin.id, NOW)).ok, true);
    assert.equal((await purchase(s, skin.id, NOW)).reason, 'owned');
    assert.equal(offerState(s, offerById('pack_heroic')).reason, 'owned', 'pack contenant un cosmétique possédé');
    const th = themeOffers()[0];
    assert.equal(ownsTheme(s, th.themes[0]), false);
    await purchase(s, th.id, NOW);
    assert.equal(ownsTheme(s, th.themes[0]), true);
    assert.equal((await purchase(s, th.id, NOW)).reason, 'owned');
    assert.equal(s.economy.store.spentCents, 99 * 2 + 299 * 5 + skin.price + th.price);
    const back = sanitizeState(JSON.parse(JSON.stringify(s)), BALANCE, NOW);
    assert.equal(ownsTheme(back, th.themes[0]), true);
    assert.ok(back.heroes.owned.fairy);
  } finally { setPaymentProvider(null); }
  for (const p of PACKS) assert.ok(p.skins.length + p.themes.length >= 2);
});

test('cosmétiques : équiper / retirer librement, sans effet sur les statistiques ; thèmes de boutique verrouillés ; thèmes recolorent', () => {
  const s = fresh();
  for (const id of ['fairy', 'grombar', 'berserker']) s.heroes.owned[id] = { stars: 1 };
  const base = JSON.stringify(computeHeroStats(s));
  const eff = JSON.stringify(heroEffects(s));
  for (const id of ['fairy', 'grombar', 'berserker']) {
    assert.ok(equipSkin(s, id));
    assert.equal(JSON.stringify(computeHeroStats(s)), base, `${id} : statistiques identiques`);
    assert.equal(JSON.stringify(heroEffects(s)), eff);
  }
  assert.ok(unequipSkin(s));
  assert.equal(s.heroes.active, 'knight');
  assert.equal(equipSkin(s, 'seraph'), false, 'non possédée');
  s.ui.theme = 'celestial';
  assert.equal(wornTheme(s), 'knight', 'thème de boutique non possédé : Chevalier');
  s.cosmetics.themes.celestial = true;
  assert.equal(wornTheme(s), 'celestial');
  assert.ok(ownsTheme(s, 'sakura'), 'thèmes d\'avant offerts');
  for (const t of THEMES.filter((x) => x.shop)) assert.notDeepEqual(themeSwatches(t.id), themeSwatches('knight'), `${t.id} change l'interface`);
});

test('sauvegarde : migration 9 → 10 généreuse (pity, garantie, apparences en héritage, tickets) et aller-retour', () => {
  assert.equal(SAVE_VERSION, 13); // v9.3.8 : 12 → 13 (6 places, pièces séparées) // v9.3.4 : 11 → 12 (équipement unique) // v9.3.3 : 10 → 11 (niveaux de compétence)
  const raw = JSON.parse(JSON.stringify(createNewState(NOW, 2)));
  raw.version = 9;
  raw.summon = { total: 80, sinceEpic: 4, sinceLegendary: 45, net: 3, lostLegend: true };
  raw.heroes = { active: 'berserker', owned: { knight: { stars: 1 }, berserker: { stars: 3 }, fairy: { stars: 4 } } };
  delete raw.economy;
  const s = sanitizeState(raw, BALANCE, NOW);
  assert.deepEqual(s.summon.pity.limited, { ssr: 75, sr: 4, guaranteed: true });
  assert.equal(s.summon.pity.pet.ssr, 45);
  assert.deepEqual(migratePity({ sinceLegendary: 59 }).limited.ssr, 98);
  // Berserker à 3★ : +20 % dégâts × 1,4 = 28 % gardé en bonus de compte, quel que soit le cosmétique porté.
  assert.ok(Math.abs(heroEffects(s).damagePct - 28) < 1e-9);
  equipSkin(s, 'fairy');
  assert.ok(Math.abs(heroEffects(s).damagePct - 28) < 1e-9);
  assert.deepEqual(s.migration928, { lookTickets: 5, petTickets: 20 }, '2 doublons de Berserker et 3 de Fée remboursés, 20 tickets familiers');
  const login = s.economy.ledger.got.loginDaily?.ticketLimited ?? 0; // jour de connexion compté au chargement
  assert.equal(s.economy.wallet.ticketLimited, 5 + login);
  // Aller-retour : rien ne bouge, pas de deuxième migration.
  const again = sanitizeState(JSON.parse(JSON.stringify(s)), BALANCE, NOW);
  assert.deepEqual(again.economy, s.economy);
  assert.deepEqual(again.summon.pity, s.summon.pity);
});

test('événement : calendrier, carte de 50 étapes, fragment à l\'étape 30, boutique d\'écus bornée', () => {
  const ev = currentEvent(NOW);
  assert.equal(ev.kind, 'grand');
  assert.equal(currentEvent(NOW + 14 * DAY).kind, 'small');
  assert.equal(totalStages(), 50);
  const s = fresh();
  const power = { dps: 1e300, hpOf: () => 1 };
  assert.equal(fightStage(s, 2, power, NOW).error, 'locked');
  for (let n = 1; n <= 30; n++) assert.equal(fightStage(s, n, power, NOW).won, true);
  assert.equal(s.economy.wallet.ssrFragment, 1);
  const rec = s.economy.events[ev.id];
  rec.coins = 1e6;
  let lim = 0;
  while (buyEventItem(s, 'lim', NOW)) lim += 1;
  assert.equal(lim, 30);
  assert.equal(fightStage(fresh(), 1, { dps: 0, hpOf: () => 1 }, NOW).won, false);
});
