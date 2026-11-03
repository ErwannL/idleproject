#!/usr/bin/env node
// v9.1.9 : mesure du butin avec le moteur réel (core/*.js), graine fixe — avant (v9.1.8) / après (v9.1.9).
// Combat : 1 h de farm de l'étape actuelle (sac vidé au départ) ; hors ligne : 8 h. Par heure : objets par rareté,
// part recyclée au ramassage, éclats, or, pièces d'ensemble, ancestraux ; temps pour remplir le sac (100 places).
// Usage : node tools/measure-butin-v919.mjs --saves <saves.json> (sauvegardes de tools/measure-v913.mjs --dump-saves)
import { readFileSync } from 'node:fs';

const T0 = new Date(2026, 9, 21, 10).getTime(); // mardi : pas de bonus du week-end
let simMs = 0;
Date.now = () => T0 + simMs;
let seed = 0x2545f491;
Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };

const { BALANCE } = await import('../src/data/balance.js');
const { sanitizeState } = await import('../src/core/state.js');
const { createCombat, step } = await import('../src/core/combat.js');
const { Rng } = await import('../src/core/rng.js');
const { recycleMaterials } = await import('../src/core/loot.js');
const { computeOfflineRewards, applyOfflineRewards } = await import('../src/core/offline.js');
const { isAncestral } = await import('../src/core/museum.js');

const args = process.argv.slice(2);
const RAW = JSON.parse(readFileSync(args[args.indexOf('--saves') + 1], 'utf8'));
const HOURS = 3;

// Réglages d'avant (v9.1.8) : chance pleine, poids de RARITIES, 10 objets hors ligne.
const BEFORE = structuredClone(BALANCE);
BEFORE.loot.dropScale = 1;
BEFORE.loot.dropRarityWeights = null;
BEFORE.offline.maxItems = 10;
BEFORE.loot.killShardChance = 0;
BEFORE.loot.setChance = { ...BEFORE.loot.setChance, rare: 0.12 };
const VARIANTS = { avant: BEFORE, après: BALANCE };
const RAR = ['common', 'rare', 'epic', 'legendary'];

function prep(raw) {
  const s = sanitizeState(structuredClone(raw));
  s.inventory = [];
  s.autoAdvance = false;
  s.playSeconds = 999999; // boost de début fini (mesure à régime)
  return s;
}

function combat(raw, balance) {
  const s = prep(raw);
  const world = createCombat(s, balance);
  const rng = new Rng(1234);
  const dt = balance.simulation.tickSeconds;
  const out = { n: 0, r: { common: 0, rare: 0, epic: 0, legendary: 0 }, recycled: 0, sets: 0, anc: 0, full: null };
  const shards0 = s.materials.shards;
  const gold0 = s.gold;
  for (let t = 0; t < HOURS * 3600; t += dt) {
    world.events.length = 0;
    step(s, world, dt, rng, balance);
    for (const e of world.events) {
      if (e.type !== 'drop') continue;
      out.n += 1; out.r[e.item.rarity] += 1;
      if (e.autoRecycled) out.recycled += 1;
      if (e.item.set) out.sets += 1;
      if (isAncestral(e.item)) out.anc += 1;
    }
    if (out.full === null && s.inventory.length >= balance.loot.inventorySize) out.full = t;
  }
  // Éclats réalisés + éclats des objets restés dans le sac (s'ils étaient recyclés) : comparaison à valeur égale.
  out.shards = s.materials.shards - shards0 + s.inventory.reduce((a, i) => a + recycleMaterials(i, balance).shards, 0);
  out.gold = s.gold - gold0;
  out.stage = s.stage;
  return out;
}

function offline(raw, balance, i = 0) {
  const s = prep(raw);
  const r = computeOfflineRewards(s, T0 - 8 * 3600e3, T0, new Rng(99 + i * 7919), balance);
  const counts = Object.fromEntries(RAR.map((k) => [k, r.items.filter((i) => i.rarity === k).length]));
  const sets = r.items.filter((i) => i.set).length;
  const a = applyOfflineRewards(s, r, balance);
  return { n: r.items.length, r: counts, sets, recycled: a.autoRecycledCount, shards: a.materials.shards, gold: a.totalGold };
}

const fmt = (n) => (Math.abs(n) >= 1e5 ? n.toExponential(2) : Math.round(n * 10) / 10).toString().replace('.', ',');
const P = (...x) => console.log(...x);
P('## Combat (3 h de farm, ramenées à 1 h, sac vide au départ)');
P();
P('| Partie | Version | Objets/h | Communs | Rares | Épiques | Légendaires | Recyclés au ramassage | Pièces d\'ensemble | Ancestraux | Éclats/h (sac compris) | Or/h | Sac plein (100) |');
P('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const [k, raw] of Object.entries(RAW)) {
  for (const [v, b] of Object.entries(VARIANTS)) {
    seed = 0x2545f491; simMs = 0;
    const o = combat(raw, b);
    const h = (x) => fmt(x / HOURS);
    P(`| ${k} (étape ${o.stage}) | ${v} | ${h(o.n)} | ${h(o.r.common)} | ${h(o.r.rare)} | ${h(o.r.epic)} | ${h(o.r.legendary)} | ${Math.round((100 * o.recycled) / Math.max(1, o.n))} % | ${h(o.sets)} | ${h(o.anc)} | ${h(o.shards)} | ${h(o.gold)} | ${o.full === null ? '> 1 h' : `${Math.round(o.full / 60)} min`} |`);
  }
}
P();
P('## Hors ligne (8 h)');
P();
P('| Partie | Version | Objets | Communs | Rares | Épiques | Légendaires | Recyclés | Pièces d\'ensemble | Éclats | Or |');
P('|---|---|---|---|---|---|---|---|---|---|---|');
for (const [k, raw] of Object.entries(RAW)) {
  for (const [v, b] of Object.entries(VARIANTS)) {
    seed = 0x2545f491; simMs = 0;
    // Moyenne de 20 tirages (le hors ligne ne génère que quelques objets).
    const acc = { n: 0, r: { common: 0, rare: 0, epic: 0, legendary: 0 }, sets: 0, recycled: 0, shards: 0, gold: 0 };
    const N = 20;
    for (let i = 0; i < N; i++) {
      const o = offline(raw, b, i);
      acc.n += o.n; acc.sets += o.sets; acc.recycled += o.recycled; acc.shards += o.shards; acc.gold += o.gold;
      for (const r of RAR) acc.r[r] += o.r[r];
    }
    P(`| ${k} | ${v} | ${fmt(acc.n / N)} | ${fmt(acc.r.common / N)} | ${fmt(acc.r.rare / N)} | ${fmt(acc.r.epic / N)} | ${fmt(acc.r.legendary / N)} | ${fmt(acc.recycled / N)} | ${fmt(acc.sets / N)} | ${fmt(acc.shards / N)} | ${fmt(acc.gold / N)} |`);
  }
}
