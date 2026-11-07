// v9.2.8 : simulation statistique de l'économie sur 6 mois (document du producteur, section 18).
// Utilise les VRAIES fonctions du jeu : tirage (core/invocation.js : rollOne, addCopy, courbes de data/economy.js),
// revenus mensuels plafonnés (core/income.js), calendrier des événements (core/ancients.js), catalogue et bonus de
// première acquisition (data/economy.js, core/store.js : pullsOf).
// Usage : node tools/sim-economy.mjs [simulations par profil = 10000] [--json fichier]
import { writeFileSync } from 'node:fs';
import { BANNERS, COPIES, EVENT_INCOME, EVENTS, PRODUCTS, MONTHLY_TARGETS } from '../src/data/economy.js';
import { addCopy, emptyPity, rollOne, ssrDistribution } from '../src/core/invocation.js';
import { incomeBoss, incomeDungeon, incomeLogin, incomeMissions, incomeTrack } from '../src/core/income.js';
import { currentEvent } from '../src/core/ancients.js';
import { emptyEconomy } from '../src/core/wallet.js';
import { pullsOf } from '../src/core/store.js';
import { Rng } from '../src/core/rng.js';
import { BALANCE } from '../src/data/balance.js';
import { COMPANIONS } from '../src/data/companions.js';

const N = Number(process.argv[2]) || 10000;
const jsonOut = process.argv.includes('--json') ? process.argv[process.argv.indexOf('--json') + 1] : null;
const DAY = 86400000;
const START = new Date('2026-12-01T12:00:00').getTime();
const DAYS = 182; // 6 mois
const MONTHS = 6;

// Contenu : SSR permanents du jeu (5), R/SR du jeu ; un SSR limité toutes les 2 semaines (13 périodes en 182 jours) ;
// familiers du jeu (R : 4, SR : 1, SSR : 1).
const allies = COMPANIONS.filter((c) => c.kind === 'ally');
const pets = COMPANIONS.filter((c) => c.kind !== 'ally');
const heroPool = {
  R: allies.filter((c) => c.rarity === 'rare').map((c) => ({ id: c.id })),
  SR: allies.filter((c) => c.rarity === 'epic').map((c) => ({ id: c.id })),
  SSR: allies.filter((c) => c.rarity === 'legendary').map((c) => ({ id: c.id })),
};
const petPool = {
  R: pets.filter((c) => ['common', 'rare'].includes(c.rarity)).map((c) => ({ id: c.id })),
  SR: pets.filter((c) => c.rarity === 'epic').map((c) => ({ id: c.id })),
  SSR: pets.filter((c) => c.rarity === 'legendary').map((c) => ({ id: c.id })),
};
const LIMITED = Array.from({ length: 13 }, (_, i) => ({ id: `limited_${i + 1}` }));

// Profils : activité (probabilités par jour), gemmes par mois (sources existantes du jeu : estimation, voir SIMULATION.md),
// panier d'achats par mois (identifiants du catalogue, limites respectées).
const ACT = {
  occasional: { login: 0.6, missions: 0.35, boss: 0.6, dungeon: 0.35, track: 5, grand: 0.5, small: 0.4, gems: 8000 },
  regular: { login: 0.9, missions: 0.75, boss: 0.9, dungeon: 0.7, track: 8, grand: 0.85, small: 0.75, gems: 14000 },
  active: { login: 1, missions: 1, boss: 1, dungeon: 1, track: 10, grand: 1, small: 1, gems: 20000 },
};
const PROFILES = [
  { id: 'f2p_occasional', name: 'F2P occasionnel', act: ACT.occasional, basket: [] },
  { id: 'f2p_regular', name: 'F2P régulier', act: ACT.regular, basket: [] },
  { id: 'f2p_active', name: 'F2P très actif', act: ACT.active, basket: [] },
  { id: 'small', name: 'Petit acheteur (15 €/mois)', act: ACT.regular, basket: ['sub_pass', 'sub_blessing'] },
  { id: 'regular_buyer', name: 'Acheteur régulier (50 €/mois)', act: ACT.regular, basket: ['sub_premium', 'sub_pass', 'pet_pack_medium', 'crystal_small'] },
  { id: 'big', name: 'Gros acheteur (200 €/mois)', act: ACT.active, basket: ['sub_premium', 'sub_pass', 'sub_blessing', 'crystal_premium', 'hero_ticket_IV', 'crystal_small', 'pet_pack_small'] },
  { id: 'whale', name: 'Whale (750 €/mois)', act: ACT.active, basket: ['sub_premium', 'sub_pass', 'sub_blessing', 'crystal_premium', 'crystal_premium', 'crystal_premium', 'crystal_premium', 'hero_ticket_V', 'hero_ticket_IV', 'hero_ticket_III', 'hero_ticket_II', 'hero_ticket_II', 'pet_pack_premium', 'pet_pack_premium', 'pet_pack_large'] },
];
const product = (id) => PRODUCTS.find((p) => p.id === id);

// Contrôle des paniers : limites mensuelles du catalogue.
for (const pr of PROFILES) {
  const count = {};
  for (const id of pr.basket) count[id] = (count[id] ?? 0) + 1;
  for (const [id, n] of Object.entries(count)) if (product(id).limit != null && n > product(id).limit) throw new Error(`${pr.id} : ${id} au-delà de la limite`);
  pr.euros = pr.basket.reduce((s, id) => s + product(id).price, 0) / 100;
}

function simulate(profile, seed) {
  const rng = new Rng(seed);
  const s = { gems: 0, materials: { shards: 0 }, keys: 0, fragments: 0, economy: emptyEconomy() };
  const w = s.economy.wallet;
  const pity = emptyPity();
  const heroes = {}; const petsOwned = {};
  const st = { pullsL: 0, pullsP: 0, pullsPet: 0, ssrL: 0, ssrP: 0, ssrPet: 0, featured: 0, lost: 0, won: 0, viaGuarantee: 0, petHard: 0, heroHard: 0, ticketsUsed: 0, gemPulls: 0, fragments: 0, ticketIncome: { L: 0, P: 0, pet: 0 }, gemsIncome: 0, boughtFirst: new Set() };
  const a = profile.act;
  const seenEvents = new Set();
  const pull = (bannerId, ctx, n) => {
    const b = BANNERS[bannerId];
    const kind = bannerId === 'pet' ? 'pet' : 'hero';
    const owned = kind === 'pet' ? petsOwned : heroes;
    for (let i = 0; i < n; i++) {
      const before = pity[b.pity].ssr;
      const r = rollOne(b, pity[b.pity], ctx, rng);
      addCopy(owned, r.unit, kind, r.tier);
      if (r.tier !== 'SSR') continue;
      if (bannerId === 'limited') { st.ssrL += 1; if (r.featured) st.featured += 1; if (r.lost) st.lost += 1; if (r.viaGuarantee) st.viaGuarantee += 1; else if (r.featured) st.won += 1; }
      else if (bannerId === 'permanent') st.ssrP += 1;
      else st.ssrPet += 1;
      if (before + 1 >= b.hard) { if (kind === 'pet') st.petHard += 1; else st.heroHard += 1; }
    }
  };
  for (let d = 0; d < DAYS; d++) {
    const now = START + d * DAY;
    const date = new Date(now);
    // Revenus quotidiens (vraies fonctions, plafonds du mois).
    if (rng.next() < a.login) incomeLogin(s, now);
    if (rng.next() < a.missions) incomeMissions(s, now);
    if (rng.next() < a.boss) incomeBoss(s, now);
    if (rng.next() < a.dungeon) incomeDungeon(s, now);
    // Début de mois : gemmes du mois (sources existantes), paliers de la piste, panier d'achats.
    if (date.getDate() === 1) {
      const g = Math.round(a.gems * (0.9 + 0.2 * rng.next()));
      s.gems += g; st.gemsIncome += g;
      for (let t = 0; t < a.track; t++) incomeTrack(s, now);
      for (const id of profile.basket) {
        const p = product(id);
        const first = p.firstBonus && !st.boughtFirst.has(id);
        st.boughtFirst.add(id);
        const mult = first ? 1 + p.firstBonus : 1;
        for (const [k, v] of Object.entries(p.give)) {
          const q = Math.floor(v * mult);
          if (k === 'gems') s.gems += q; else if (k in w) w[k] += q;
        }
        if (p.daily) s.gems += p.daily.gems * 30;
      }
    }
    // Événements (calendrier réel) : récompenses à la fin de chaque événement, selon la part accomplie.
    const ev = currentEvent(now);
    const evEnd = currentEvent(now + DAY);
    if (ev && (!evEnd || evEnd.id !== ev.id) && !seenEvents.has(ev.id)) {
      seenEvents.add(ev.id);
      const frac = ev.kind === 'grand' ? a.grand : a.small;
      const done = frac >= 1 ? 1 : Math.max(0, Math.min(1, frac + (rng.next() - 0.5) * 0.3));
      for (const [k, v] of Object.entries(EVENT_INCOME[ev.kind])) {
        if (k === 'ssrFragment') { if (done >= EVENTS.grand.fragmentStage / 50) { w.ssrFragment += v; st.fragments += v; } continue; }
        w[k] += Math.floor(v * done);
      }
    }
    // Invocations : en fin de période de la vedette (14 jours) pour les héros, en fin de mois pour les familiers.
    const period = Math.floor(d / 14);
    if ((d + 1) % 14 === 0 || d === DAYS - 1) {
      const ctxL = { ...heroPool, featured: LIMITED[period], SSR: [...heroPool.SSR, LIMITED[period]] };
      const ctxP = { ...heroPool, wishlist: heroPool.SSR.map((u) => u.id) };
      // Tickets limités → limitée ; tickets permanents → permanente ; gemmes 50/50 (×10 à 900 puis ×1 à 100).
      const nL = w.ticketLimited; w.ticketLimited = 0; pull('limited', ctxL, nL); st.pullsL += nL; st.ticketsUsed += nL;
      const nP = w.ticketPermanent; w.ticketPermanent = 0; pull('permanent', ctxP, nP); st.pullsP += nP; st.ticketsUsed += nP;
      const gemPulls = (gems) => Math.floor(gems / BALANCE.summon.tenPullGemCost) * 10 + Math.floor((gems % BALANCE.summon.tenPullGemCost) / BALANCE.summon.gemCost);
      const half = Math.floor(s.gems / 2);
      const gl = gemPulls(half); const gp = gemPulls(s.gems - half);
      const cost = (n) => Math.floor(n / 10) * BALANCE.summon.tenPullGemCost + (n % 10) * BALANCE.summon.gemCost;
      s.gems -= cost(gl) + cost(gp);
      pull('limited', ctxL, gl); pull('permanent', ctxP, gp);
      st.pullsL += gl; st.pullsP += gp; st.gemPulls += gl + gp;
    }
    if (date.getDate() === 28 || d === DAYS - 1) {
      const n = w.ticketPet; w.ticketPet = 0; pull('pet', { ...petPool }, n); st.pullsPet += n;
    }
  }
  // Fragments SSR : sur la vedette limitée la plus avancée (jamais au-delà de 6).
  let frags = w.ssrFragment;
  for (const u of Object.keys(heroes).filter((id) => id.startsWith('limited_')).sort((x, y) => heroes[y].stars - heroes[x].stars)) {
    while (frags > 0 && heroes[u].stars < COPIES.max) { heroes[u].stars += 1; frags -= 1; }
  }
  const limitedOwned = Object.keys(heroes).filter((id) => id.startsWith('limited_'));
  const ssrIds = new Set(heroPool.SSR.map((u) => u.id));
  return {
    pulls: st.pullsL + st.pullsP, pullsL: st.pullsL, pullsP: st.pullsP, gemPulls: st.gemPulls, ticketPulls: st.ticketsUsed,
    ssr: st.ssrL + st.ssrP, ssrL: st.ssrL, ssrP: st.ssrP, featured: st.featured, lost: st.lost, won: st.won, viaGuarantee: st.viaGuarantee, heroHard: st.heroHard,
    limitedDistinct: limitedOwned.length, limitedMaxed: limitedOwned.filter((id) => heroes[id].stars >= COPIES.max).length,
    permDistinct: Object.keys(heroes).filter((id) => ssrIds.has(id)).length,
    heroesMaxed: Object.values(heroes).filter((h) => h.stars >= COPIES.max).length,
    ssrMaxed: Object.entries(heroes).filter(([id, h]) => (id.startsWith('limited_') || ssrIds.has(id)) && h.stars >= COPIES.max).length,
    gemsLeft: s.gems, ticketsLeft: w.ticketLimited + w.ticketPermanent, petTicketsLeft: w.ticketPet,
    petPulls: st.pullsPet, petSsr: st.ssrPet, petHard: st.petHard, petDistinctSsr: Object.keys(petsOwned).filter((id) => petPool.SSR.some((u) => u.id === id)).length,
    petMaxed: Object.values(petsOwned).filter((p) => p.stars >= COPIES.max).length, petSsrCopies: petPool.SSR.reduce((a2, u) => a2 + (petsOwned[u.id]?.stars ?? 0), 0),
    fragments: st.fragments,
  };
}

const stat = (arr) => {
  const v = [...arr].sort((x, y) => x - y);
  const mean = v.reduce((s, x) => s + x, 0) / v.length;
  return { mean, p10: v[Math.floor(v.length * 0.1)], p50: v[Math.floor(v.length * 0.5)], p90: v[Math.floor(v.length * 0.9)] };
};

const t0 = Date.now();
const results = {};
for (const pr of PROFILES) {
  const runs = [];
  for (let i = 0; i < N; i++) runs.push(simulate(pr, 1 + i * 7919 + pr.id.length * 104729));
  const keys = Object.keys(runs[0]);
  results[pr.id] = { name: pr.name, euros: pr.euros, n: N, ...Object.fromEntries(keys.map((k) => [k, stat(runs.map((r) => r[k]))])) };
  console.error(`${pr.name} : ${N} simulations (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}

// Rendement de chaque offre (invocations héros par euro, bonus de première acquisition à part).
const offers = PRODUCTS.map((p) => ({ id: p.id, name: p.name, euros: p.price / 100, pulls: pullsOf(p.give) + (p.daily ? pullsOf(p.daily) * 30 : 0), petTickets: p.give.ticketPet ?? 0, first: p.firstBonus ? pullsOf(p.give) * (1 + p.firstBonus) : null }))
  .map((o) => ({ ...o, perEuro: o.pulls / o.euros, petPerEuro: o.petTickets / o.euros, firstPerEuro: o.first ? o.first / o.euros : null }));
const curves = Object.fromEntries(Object.entries(BANNERS).map(([id, b]) => [id, ssrDistribution(b)]));

const out = { n: N, days: DAYS, months: MONTHS, targets: MONTHLY_TARGETS, profiles: results, offers, curves: Object.fromEntries(Object.entries(curves).map(([k, c]) => [k, { mean: c.mean, consolidated: c.consolidated, p80: c.probs.slice(0, 79).reduce((s, x) => s + x, 0) }])), seconds: (Date.now() - t0) / 1000 };
if (jsonOut) writeFileSync(jsonOut, JSON.stringify(out, null, 1));
const f = (x, d = 1) => x.toFixed(d);
for (const [id, r] of Object.entries(results)) {
  console.log(`\n## ${r.name} — ${f(r.euros, 2)} €/mois`);
  console.log(`Invocations héros : ${f(r.pulls.mean, 0)} (limitée ${f(r.pullsL.mean, 0)}, permanente ${f(r.pullsP.mean, 0)}) · SSR ${f(r.ssr.mean)} [p10 ${r.ssr.p10} – p90 ${r.ssr.p90}] · vedettes ${f(r.featured.mean)} · 50/50 perdus ${f(r.lost.mean)} · garanties ${f(r.viaGuarantee.mean)}`);
  console.log(`Limités distincts ${f(r.limitedDistinct.mean)}/13 · limités max ${f(r.limitedMaxed.mean, 2)} · SSR max ${f(r.ssrMaxed.mean, 2)} · héros max ${f(r.heroesMaxed.mean)} · restes : ${f(r.gemsLeft.mean, 0)} gemmes, ${f(r.ticketsLeft.mean)} tickets`);
  console.log(`Familiers : ${f(r.petPulls.mean, 0)} invocations · SSR ${f(r.petSsr.mean)} · pity 60 atteinte ${f(r.petHard.mean, 2)} fois · max ${f(r.petMaxed.mean, 2)}`);
}
console.error(`Total : ${out.seconds.toFixed(0)} s`);
