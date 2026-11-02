#!/usr/bin/env node
// v9.1.3 (doc3 lot 5, « ensembles avec un rôle ») : outil seulement. Moteur réel (core/*.js) en Node, graine fixe.
// Pour quelques builds (sauvegardes de tools/measure-v913.mjs --dump-saves), chaque ensemble est porté à 6 pièces
// (mêmes objets, seul le champ `set` change ; 7e emplacement sans ensemble), puis :
//   - farm : 900 s de combat réel sur une étape déjà franchie (avance auto coupée) → or/s et victoires/s ;
//   - boss : dégâts/s × (1 + dégâts contre les boss) ; robustesse : PV / (1 − armure) ;
// en indice (100 = sans ensemble). Question : chaque ensemble a-t-il une activité où il est le meilleur, sans
// qu'aucun ne soit le meilleur partout ? Équilibre = dégâts/s × robustesse (le score d'isUpgrade).
//
// XP/s = victoires/s × (1 + bonus d'XP). Objets/s : bruité (±5 %), boss et élites lâchent toujours un objet.
// Usage : node tools/measure-sets-v913.mjs --saves <saves.json> [--seconds 900]
import { readFileSync } from 'node:fs';

const T0 = new Date(2026, 9, 21, 10).getTime();
let simMs = 0;
Date.now = () => T0 + simMs;
let seed = 0x2545f491;
Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };

const { BALANCE } = await import('../src/data/balance.js');
const { sanitizeState } = await import('../src/core/state.js');
const { createCombat, step } = await import('../src/core/combat.js');
const { computeHeroStats } = await import('../src/core/stats.js');
const { Rng } = await import('../src/core/rng.js');
const { ITEM_SETS } = await import('../src/data/sets.js');
const { CLASSES } = await import('../src/data/classes.js');
const { setHeroClass } = await import('../src/core/classes.js');

const args = process.argv.slice(2);
const arg = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const RAW = JSON.parse(readFileSync(arg('--saves'), 'utf8'));
const SECONDS = Number(arg('--seconds', 900));
const DT = BALANCE.simulation.tickSeconds;
const SLOTS6 = ['weapon', 'helmet', 'armor', 'amulet', 'earring', 'ring'];
const P = (...x) => console.log(...x);
const ehp = (s) => s.maxHp / Math.max(0.05, 1 - s.armor / 100);

function wear(state, setId) {
  for (const [slot, item] of Object.entries(state.equipment)) {
    if (!item) continue;
    if (setId && SLOTS6.includes(slot)) item.set = setId; else delete item.set;
  }
}

function farm(state, seconds) {
  simMs = 0; // même horloge et même hasard pour chaque ensemble
  seed = 0x2545f491;
  state.autoAdvance = false;
  state.ui.autoRecycle = 'all';
  const world = createCombat(state);
  const rng = new Rng(7);
  const g0 = state.records.goldEarned;
  const k0 = state.records.kills;
  let drops = 0;
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    step(state, world, DT, rng);
    simMs += DT * 1000;
    drops += world.events.filter((e) => e.type === 'drop').length;
    world.events.length = 0;
    state.inventory.length = 0; // le sac ne se remplit pas pendant la mesure
  }
  return { gold: (state.records.goldEarned - g0) / seconds, kills: (state.records.kills - k0) / seconds, drops: drops / seconds, stage: state.stage };
}

// Builds : sauvegarde telle quelle, et la sauvegarde de fin sous une autre classe (arme reforgée sans perte).
const builds = [];
for (const k of ['milieu', 'fin']) if (RAW[k]) builds.push([k, sanitizeState(RAW[k])]);
if (RAW.fin) {
  const s = sanitizeState(RAW.fin);
  const other = CLASSES.find((c) => c.id !== s.heroClass);
  if (other && setHeroClass(s, other.id)) builds.push([`fin, ${other.name}`, s]);
}

const fmt = (v) => Math.round(v).toString();
for (const [name, base] of builds) {
  // Étape de farm : la plus haute (pas de 5 sous l'étape max) que le héros sans ensemble tient 120 s sans reculer.
  let farmStage = base.maxStage - 5;
  for (; farmStage > 1; farmStage -= 5) {
    const t = structuredClone(base);
    wear(t, null);
    t.stage = farmStage;
    if (farm(t, 120).stage === farmStage) break;
  }
  const rows = [];
  for (const set of [null, ...ITEM_SETS]) {
    const s = structuredClone(base);
    wear(s, set?.id ?? null);
    s.stage = farmStage;
    const st = computeHeroStats(s);
    const f = farm(s, SECONDS);
    rows.push({ end: f.stage, name: set?.name ?? 'Sans ensemble', gold: f.gold, kills: f.kills, drops: f.drops, xp: f.kills * (1 + st.xpPct / 100), normal: st.dps * (1 + (st.bonus.damageVsNormalPct ?? 0) / 100), balance: st.dps * ehp(st), boss: st.dps * (1 + (st.bonus.damageVsBossPct ?? 0) / 100), tough: ehp(st) });
  }
  const ref = rows[0];
  const best = (k) => Math.max(...rows.slice(1).map((r) => r[k]));
  P(`### ${name} (étape max ${base.maxStage}, farm à l'étape ${farmStage})`);
  P();
  P('| Ensemble (6 pièces) | Or/s | XP/s | Victoires/s | Objets/s | Dégâts/s ordinaires | Boss (dégâts/s) | Robustesse | Équilibre | Meilleur en |');
  P('|---|---|---|---|---|---|---|---|---|---|');
  for (const r of rows) {
    const wins = ['gold', 'xp', 'kills', 'drops', 'normal', 'boss', 'tough', 'balance'].filter((k) => r !== ref && r[k] >= best(k) * 0.999 && r[k] > ref[k] * 1.005).map((k) => ({ gold: 'or', xp: 'XP', kills: 'victoires', drops: 'butin', normal: 'ordinaires', boss: 'boss', tough: 'robustesse', balance: 'équilibre' }[k]));
    P(`| ${r.name}${r.end !== farmStage ? ` (fini à ${r.end})` : ''} | ${fmt((r.gold / ref.gold) * 100)} | ${fmt((r.xp / ref.xp) * 100)} | ${fmt((r.kills / ref.kills) * 100)} | ${fmt((r.drops / ref.drops) * 100)} | ${fmt((r.normal / ref.normal) * 100)} | ${fmt((r.boss / ref.boss) * 100)} | ${fmt((r.tough / ref.tough) * 100)} | ${fmt((r.balance / ref.balance) * 100)} | ${wins.join(', ') || '—'} |`);
  }
  P();
}
