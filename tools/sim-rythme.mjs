// v10.8 (parties 1, 3, 4, 5, 6) : rythme sur la durée — vrai moteur, vraies actions, vrais gains hors ligne.
// Trois profils jouent N jours depuis l'ouverture du Bastion (étape 40) : occasionnel (1 connexion de 20 min par jour),
// régulier (2), très actif (4). Chacun suit le Sceau, gère le Bastion (30 % de son or), renaît quand la Renaissance est
// rentable. Relevé par jour : étape et monde, puissance, meilleure rareté possédée, âge et niveau du Bastion, niveaux
// de recherche, Renaissances. Écrit le tableau dans docs/rythme-v10.8.md et vérifie les fenêtres visées.
// Usage : node tools/sim-rythme.mjs [--days 90] [--profiles regulier,occasionnel,actif] [--seed 1] [--out docs/rythme-v10.8.md]
import { writeFileSync } from 'node:fs';
import { createNewState } from '../src/core/state.js';
import { createCombat, cycleForStage, zoneIndexForStage } from '../src/core/combat.js';
import { computeHeroStats } from '../src/core/stats.js';
import { Rng } from '../src/core/rng.js';
import { RESEARCH } from '../src/data/bastion.js';
import { bastionAge, bastionLevel, bastionMult, bastionOf, researchLevel } from '../src/core/bastion.js';
import { canRebirth, performRebirth, rebirthBlocked, rebirthWorth } from '../src/core/rebirth.js';
import { RARITIES } from '../src/data/items.js';
import { HOUR, T0, connection, play } from './sim-lib.mjs';
import { BALANCE } from '../src/data/balance.js';
// Réglage : PACE_RATE=1.1 node tools/sim-rythme.mjs … essaie un autre taux sans toucher balance.js.
if (process.env.PACE_RATE) BALANCE.enemyScaling.pace = { ...BALANCE.enemyScaling.pace, rate: Number(process.env.PACE_RATE) };
if (process.env.PACE_FROM) BALANCE.enemyScaling.pace = { ...BALANCE.enemyScaling.pace, from: Number(process.env.PACE_FROM) };

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const DAYS = Number(opt('--days', 90));
const SEED = Number(opt('--seed', 1));
const OUT = opt('--out', 'docs/rythme-v10.8.md');
const PROFILES = { occasionnel: 1, regulier: 2, actif: 4 };
const which = opt('--profiles', 'regulier,occasionnel,actif').split(',');

const base = { state: createNewState(T0, SEED), rng: new Rng(SEED * 97), log: [] };
base.world = createCombat(base.state);
base.stop = (s) => Math.max(s.maxStage, s.records.bestStage ?? 1) >= 40;
const warm = play(base, 40 * 3600, T0);
const start = T0 + Math.ceil(warm) * 1000;

// Monde atteint : 1 à 12 dans la campagne, 13 et plus dans les Failles (cycles suivants).
const world = (stage) => cycleForStage(Math.max(1, stage)) * 12 + zoneIndexForStage(stage) + 1;
const RANK = RARITIES.map((r) => r.id);
function bestRarity(s) {
  let best = 0;
  for (const i of [...s.inventory, ...(s.stash ?? []), ...Object.values(s.equipment ?? {})]) if (i) best = Math.max(best, RANK.indexOf(i.rarity));
  return best;
}

function runProfile(name) {
  const per = PROFILES[name];
  const sim = { state: structuredClone(base.state), rng: new Rng(SEED * 97 + per), withBastion: true, share: 0.3, prefer: 'équilibre', purse: 0, log: [], last: 0, day: 0, reserve: 0,
    spent: { builds: 0, orders: 0, upgrades: 0, research: 0 }, gained: {}, extra: {}, goldKills: [] };
  sim.world = createCombat(sim.state);
  const rows = [], firsts = {};
  let rebirths = 0;
  const hours = per === 1 ? [0] : per === 2 ? [0, 12] : [0, 6, 12, 18];
  for (let d = 0; d < DAYS; d++) {
    sim.day = d + 1;
    for (const h of hours) {
      connection(sim, start + (d * 24 + h) * HOUR, 20);
      const s = sim.state;
      if (canRebirth(s) && !rebirthBlocked(s) && rebirthWorth(s) && performRebirth(s) > 0) { rebirths += 1; sim.world = createCombat(s); }
    }
    const s = sim.state;
    const best = Math.max(s.maxStage, s.records.bestStage ?? 1);
    const r = bestRarity(s);
    for (let k = 4; k <= r; k++) firsts[RANK[k]] ??= d + 1;
    const research = RESEARCH.map((x) => researchLevel(s, x.id)).reduce((a, b) => a + b, 0);
    rows.push({ day: d + 1, best, world: world(best), power: computeHeroStats(s).combatPower, rarity: RANK[r], bastion: bastionOf(s) ? bastionLevel(s) : 0, age: bastionAge(s), bmult: bastionMult(s, 'damage') * bastionMult(s, 'hp'), research, rebirths });
    if (process.env.SIM_DEBUG) console.log('  debug', JSON.stringify({ done: s.unlocks?.done, can: canRebirth(s), worth: rebirthWorth(s), frag: s.fragments }));
    if ((d + 1) % 10 === 0 || d === 0) console.log(`${name.padEnd(12)} J${String(d + 1).padStart(3)} : étape ${best} (monde ${world(best)}) · rareté ${RANK[r]} · Bastion ${rows.at(-1).bastion} (âge ${rows.at(-1).age}) · recherches ${research} · Renaissances ${rebirths}`);
  }
  const dayOfWorld = (w) => rows.find((x) => x.world >= w)?.day ?? null;
  return { name, rows, firsts, rebirths, dayOfWorld };
}

const results = which.map(runProfile);
const reg = results.find((r) => r.name === 'regulier');
const checks = [];
if (reg) {
  const w7 = reg.dayOfWorld(7), w12 = reg.dayOfWorld(12);
  checks.push([`monde 7 entre les jours 25 et 40 (régulier)`, w7 != null && w7 >= 25 && w7 <= 40, `jour ${w7 ?? '—'}`]);
  checks.push([`monde 12 entre les jours 90 et 120 (régulier)`, DAYS < 90 ? null : w12 == null || (w12 >= 90 && w12 <= 120), `jour ${w12 ?? `> ${DAYS}`}`]);
  const firstReb = reg.rows.find((x) => x.rebirths > 0)?.day ?? null;
  checks.push([`1re Renaissance entre les jours 15 et 30 (régulier)`, firstReb != null && firstReb >= 15 && firstReb <= 30, `jour ${firstReb ?? '—'}`]);
  checks.push([`1er Mythique vers la semaine 3 (jours 14 à 28)`, reg.firsts.mythic != null && reg.firsts.mythic >= 14 && reg.firsts.mythic <= 28, `jour ${reg.firsts.mythic ?? '—'}`]);
}
const md = [`# Rythme v10.8 (simulation, ${DAYS} jours, graine ${SEED})`, '',
  'Produit par `node tools/sim-rythme.mjs`. Vrai moteur, 20 min par connexion, gains hors ligne entre les connexions, Bastion géré avec 30 % de l\'or, Renaissance dès qu\'elle est rentable.', '',
  '## Fenêtres visées', '', '| Contrôle | Résultat | |', '|---|---|---|',
  ...checks.map(([n, ok, v]) => `| ${n} | ${v} | ${ok == null ? '—' : ok ? '✔' : '✘'} |`), '',
  ...results.flatMap((r) => [`## Profil ${r.name} (${PROFILES[r.name]} connexion${PROFILES[r.name] > 1 ? 's' : ''} par jour)`, '',
    `Premières raretés : ${Object.entries(r.firsts).map(([k, v]) => `${k} jour ${v}`).join(' · ') || 'aucune au-delà de Légendaire'} · Renaissances : ${r.rebirths}`, '',
    '| Jour | Étape | Monde | Puissance | Meilleure rareté | Bastion (niv. / âge) | ×Bastion | Recherches | Renaissances |', '|---|---|---|---|---|---|---|---|---|',
    ...r.rows.filter((x) => x.day <= 7 || x.day % 5 === 0).map((x) => `| ${x.day} | ${x.best} | ${x.world} | ${x.power.toExponential(2)} | ${x.rarity} | ${x.bastion} / ${x.age} | ×${x.bmult.toFixed(2)} | ${x.research} | ${x.rebirths} |`), '']),
].join('\n');
writeFileSync(OUT, md);
for (const [n, ok, v] of checks) console.log(`${ok == null ? '–' : ok ? '✔' : '✘'} ${n} : ${v}`);
console.log(`Tableau écrit dans ${OUT}`);
