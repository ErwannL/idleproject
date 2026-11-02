#!/usr/bin/env node
// v9.1.3 (doc4 lot 1, « à vérifier après ce lot ») : outil seulement. Moteur réel (core/*.js) en Node, graine fixe.
// Gain des comptes bas (peu d'exemplaires) avec la nouvelle courbe des étoiles, en campagne et en donjon.
// Sauvegardes : tools/measure-v913.mjs --dump-saves (début, milieu, fin), auxquelles on ajoute une équipe
// (2 compagnons niv. 20 + Feu follet niv. 20) à n exemplaires. Comparaison : --root <copie du dépôt d'avant le lot 1>.
//   - campagne : 15 min d'avance automatique depuis la sauvegarde (sans aucun achat) → étape max atteinte, et dégâts
//     réellement infligés par les compagnons (sans dégâts perdus sur un ennemi déjà mort) ;
//   - donjon : donjon de chaque SSR de l'équipe (il y est chez lui), Facile, Normal et Difficile, 300 s au plus →
//     réussite et temps.
// (Le dégât brut des événements compte les dégâts perdus sur un ennemi déjà mort : trompeur, non utilisé.)
// Usage : node tools/measure-heros-v913.mjs --saves <saves.json> [--root <dépôt>] [--json]
import { readFileSync } from 'node:fs';
import path from 'node:path';

const T0 = new Date(2026, 9, 21, 10).getTime();
let simMs = 0;
Date.now = () => T0 + simMs;
let seed = 0x2545f491;
Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };

const args = process.argv.slice(2);
const arg = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const ROOT = path.resolve(arg('--root', path.join(path.dirname(new URL(import.meta.url).pathname), '..')));
const imp = (p) => import(path.join(ROOT, 'src', p));
const { BALANCE } = await imp('data/balance.js');
const { sanitizeState } = await imp('core/state.js');
const { createCombat, step } = await imp('core/combat.js');
const { startDungeon } = await imp('core/dungeon.js');
const { DUNGEONS } = await imp('data/dungeons.js');
const { Rng } = await imp('core/rng.js');
const RAW = JSON.parse(readFileSync(arg('--saves'), 'utf8'));
const DT = BALANCE.simulation.tickSeconds;

export const TEAMS = { ssr: ['shadow_lord', 'demon_queen'], sr: ['barbarian', 'rose_blade'], r: ['ranger', 'pyromancer'] };

function withTeam(raw, ids, copies) {
  const s = sanitizeState(JSON.parse(JSON.stringify(raw)), BALANCE, T0);
  s.companions.owned = {};
  for (const id of [...ids, 'wisp']) s.companions.owned[id] = { stars: copies, level: 20 };
  s.companions.equipped = [...ids, 'wisp'];
  s.version = 8; // déjà au format courant (pas de migration 5 → 6 pendant la mesure)
  return s;
}

function run(state, seconds, stopOnEnd = false) {
  simMs = 0;
  seed = 0x2545f491;
  state.autoAdvance = !stopOnEnd;
  state.ui.autoRecycle = 'all';
  const world = createCombat(state);
  const rng = new Rng(7);
  let dmg = 0;
  let kills = 0;
  let end = null;
  let t = 0;
  for (; t < seconds && !end; t += DT) {
    step(state, world, DT, rng);
    simMs += DT * 1000;
    for (const e of world.events) {
      if (e.type === 'enemyHit') dmg += e.damage;
      else if (e.type === 'kill') kills += 1;
      else if (stopOnEnd && (e.type === 'dungeonComplete' || e.type === 'dungeonFailed')) end = e.type;
      else if (stopOnEnd === 'boss' && e.type === 'bossDefeated' && !e.summoned) end = 'boss';
    }
    world.events.length = 0;
    state.inventory.length = 0;
  }
  const real = Object.values(world.counters?.damage ?? {}).reduce((a, v) => a + v, 0);
  return { dps: dmg / t, real: real / t, kps: kills / t, t, end, room: state.dungeon?.room, maxStage: state.maxStage };
}

const out = [];
for (const [save, raw] of Object.entries(RAW)) {
  for (const [team, ids] of Object.entries(TEAMS)) {
    for (const copies of [1, 2, 3, 4, 5, 6]) {
      const s = withTeam(raw, ids, copies);
      if (s.companions.owned[ids[0]].stars !== copies) continue; // ancien moteur : 6 exemplaires impossible
      const camp = run(s, 900);
      const row = { save, team, copies, start: raw.maxStage, maxStage: camp.maxStage, compDps: camp.real };
      if (team === 'ssr') {
        for (const id of ids) {
          const d = DUNGEONS.find((x) => x.ally === id);
          for (const diff of ['easy', 'normal', 'hard']) {
            const sd = withTeam(raw, ids, copies);
            sd.keys = 5;
            sd.dungeonBest = { ...(sd.dungeonBest ?? {}), [d.id]: 2 };
            sd.records.bestStage = Math.max(sd.records.bestStage ?? 0, sd.maxStage);
            if (!startDungeon(sd, d.id, 'any', 'gold', diff)) { row[`dj_${id}_${diff}`] = null; continue; }
            const r = run(sd, 300, true);
            row[`dj_${id}_${diff}`] = { end: r.end === 'dungeonComplete' ? 'ok' : r.end ? 'échec' : 'temps', t: Math.round(r.t), room: r.room };
          }
        }
      }
      out.push(row);
    }
  }
}
if (args.includes('--json')) console.log(JSON.stringify(out));
else for (const r of out) console.log(JSON.stringify(r));
