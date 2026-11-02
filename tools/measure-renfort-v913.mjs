#!/usr/bin/env node
// v9.1.3 (doc3 lot 3, « renforcement ciblé, à valider par un test d'abord ») : outil seulement.
// Pour Dague, Massue, Cuirasse de plates et Collier (Légendaires, au niveau de l'étape max), compare toutes les
// répartitions de 10 renforcements sur les lignes de l'objet (hors `dropChance`), avec le score d'isUpgrade
// (core/inventory.js : log dégâts/s + log robustesse), sur le héros d'une sauvegarde réelle. Deux règles :
// sans plafond, et avec le plafond du doc (1 ligne = 10, 2 lignes = 7, 3 ou plus = 5 par ligne).
// Question : la même répartition gagne-t-elle partout (alors ce serait un bonus, pas une décision) ?
//
// Usage : node tools/measure-renfort-v913.mjs --saves <saves.json>
import { readFileSync } from 'node:fs';

const { BALANCE } = await import('../src/data/balance.js');
const { sanitizeState } = await import('../src/core/state.js');
const { computeHeroStats } = await import('../src/core/stats.js');
const { makeItem, refreshItemStats } = await import('../src/core/loot.js');
const { upgradableStats } = await import('../src/core/forge.js');
const { Rng } = await import('../src/core/rng.js');
const { KEEP_AFFIX_LABELS } = await import('../src/core/inventory.js');

const args = process.argv.slice(2);
const RAW = JSON.parse(readFileSync(args[args.indexOf('--saves') + 1], 'utf8'));
const BASES = [['dagger', 'Dague'], ['mace', 'Massue'], ['plate_armor', 'Cuirasse'], ['necklace_ruby', 'Collier']];
const TOTAL = 10;
const LABEL = { damage: 'dégâts', attackSpeed: 'vitesse', maxHp: 'PV', armor: 'armure', main: 'effet principal' };
const ehp = (s) => s.maxHp / Math.max(0.05, 1 - s.armor / 100);

// Compositions de `n` en `k` parts (chaque part ≤ cap).
function* parts(n, k, cap) {
  if (k === 1) { if (n <= cap) yield [n]; return; }
  for (let i = Math.min(n, cap); i >= 0; i--) for (const rest of parts(n - i, k - 1, cap)) yield [i, ...rest];
}
const capFor = (lines) => (lines <= 1 ? 10 : lines === 2 ? 7 : 5);

const P = (...x) => console.log(...x);
P('| Sauvegarde | Objet (effets) | Lignes | Meilleure sans plafond | Meilleure avec plafond | 2e avec plafond (écart) | Au hasard (moy.) |');
P('|---|---|---|---|---|---|---|');
for (const key of ['milieu', 'fin']) {
  const state = sanitizeState(RAW[key]);
  for (const [baseId, name] of BASES) {
    for (const seed of [1, 2, 3]) {
      const item = makeItem(state, baseId, 'legendary', state.maxStage, BALANCE, new Rng(seed * 7919));
      const lines = upgradableStats(item).filter((l) => !(l.startsWith('affix:') && item.affixes[Number(l.slice(6))].type === 'dropChance'));
      const name_ = (l) => (l.startsWith('affix:') ? KEEP_AFFIX_LABELS[item.affixes[Number(l.slice(6))].type].toLowerCase() : LABEL[l]);
      const score = (dist) => {
        const it = structuredClone(item);
        it.boosts = Object.fromEntries(lines.map((l, i) => [l, dist[i]]));
        refreshItemStats(it, BALANCE);
        const s = computeHeroStats(state, BALANCE, { ...state.equipment, [it.slot]: it });
        return Math.log(s.dps) + Math.log(ehp(s));
      };
      const zero = score(lines.map(() => 0));
      const rank = (cap) => [...parts(TOTAL, lines.length, cap)].map((d) => ({ d, v: score(d) - zero })).sort((a, b) => b.v - a.v);
      const free = rank(TOTAL);
      const capped = rank(capFor(lines.length));
      // « Au hasard » : chaque palier sur une ligne au hasard (moyenne exacte par tirages fixes).
      const rng = new Rng(42);
      let rand = 0;
      for (let t = 0; t < 400; t++) {
        const d = lines.map(() => 0);
        const cap = capFor(lines.length);
        for (let n = 0; n < TOTAL; n++) { const open = d.map((x, i) => i).filter((i) => d[i] < cap); d[open[Math.floor(rng.next() * open.length)]] += 1; }
        rand += score(d) - zero;
      }
      rand /= 400;
      const txt = (r) => (r.v < 1e-6 ? 'aucune ligne ne compte' : r.d.map((x, i) => (x ? `${x} ${name_(lines[i])}` : '')).filter(Boolean).join(' + '));
      const pct = (v) => `${((Math.exp(v) - 1) * 100).toFixed(1).replace('.', ',')} %`;
      const fx = item.affixes.map((a) => KEEP_AFFIX_LABELS[a.type]?.toLowerCase() ?? a.type).join(', ');
      P(`| ${key} | ${name} (${fx}) | ${lines.length} | ${txt(free[0])} (${pct(free[0].v)}) | ${txt(capped[0])} (${pct(capped[0].v)}) | ${txt(capped[1])} (−${pct(capped[0].v - capped[1].v)}) | ${pct(rand)} |`);
    }
  }
}
