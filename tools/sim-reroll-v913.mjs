#!/usr/bin/env node
// v9.1.3 (doc1 lot F, « Relance de pouvoir : une seule barrière ») : simulation avant de retirer une barrière.
// Aujourd'hui une relance demande DEUX choses : une charge (1 par victoire sur le boss réaffronté, 3 au plus) et de l'or
// (3 × l'or du boss à sa première étape). Moteur réel (core/*.js), joueur automatique repris de measure-v913.mjs, horloge
// et hasard fixes. Pour chaque boss déjà battu, on réaffronte le boss en boucle 10 min et on compte :
//   - victoires (charges gagnées) par heure ;
//   - or gagné par heure pendant la boucle, et donc relances par heure que l'or seul permettrait ;
//   - minutes de boucle nécessaires pour payer UNE relance (or) et pour gagner UNE charge.
// La barrière qui ne limite jamais (l'autre arrive toujours avant) est celle qu'on peut retirer sans changer le rythme.
// Usage : node tools/sim-reroll-v913.mjs [--quick]
const T0 = new Date(2026, 9, 21, 10).getTime();
let simMs = 0;
Date.now = () => T0 + simMs;
let seed = 0x9e3779b9;
Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };

const { BALANCE } = await import('../src/data/balance.js');
const { BOSSES } = await import('../src/data/enemies.js');
const { createNewState } = await import('../src/core/state.js');
const { createCombat, step, changeStage } = await import('../src/core/combat.js');
const { buyMostProfitable } = await import('../src/core/profit.js');
const { equipBest, isUpgrade, sweepInventory, bulkRecycleCandidates } = await import('../src/core/inventory.js');
const { autoFuse } = await import('../src/core/forge.js');
const { distributeSkillPoints } = await import('../src/core/skills.js');
const { canRebirth, performRebirth, buyTalentsCheapest } = await import('../src/core/rebirth.js');
const { bossFirstStage } = await import('../src/core/powers.js');
const { enemyStats } = await import('../src/core/combat.js');
// Ancien coût (avant v9.1.3) : 3 × l'or donné par le boss à sa première étape, sans talent de remise.
const rerollCost = (state, bossId) => Math.max(1, Math.floor(enemyStats(bossFirstStage(bossId), bossId, true).gold * 3));
const { Rng } = await import('../src/core/rng.js');

const QUICK = process.argv.includes('--quick');
const DT = BALANCE.simulation.tickSeconds;

function play(state, seconds, { rebirth = false, rngSeed = 1, buy = true } = {}) {
  const world = createCombat(state);
  const rng = new Rng(rngSeed);
  let lastBest = state.maxStage;
  let stall = 0;
  const steps = Math.round(seconds / DT);
  for (let i = 1; i <= steps; i++) {
    step(state, world, DT, rng);
    simMs += DT * 1000;
    world.events.length = 0;
    if (buy && i % Math.round(5 / DT) === 0) {
      buyMostProfitable(state);
      equipBest(state);
      distributeSkillPoints(state);
      autoFuse(state, rng, isUpgrade);
      sweepInventory(state);
      if (state.inventory.length >= BALANCE.loot.inventorySize - 2) {
        const ids = new Set(bulkRecycleCandidates(state, 'epic').map((x) => x.id));
        state.inventory = state.inventory.filter((x) => !ids.has(x.id));
      }
    }
    if (rebirth && i % Math.round(60 / DT) === 0) {
      if (state.maxStage > lastBest) { lastBest = state.maxStage; stall = 0; } else stall += 1;
      if (stall >= 20 && canRebirth(state)) { performRebirth(state); buyTalentsCheapest(state); lastBest = state.maxStage; stall = 0; }
    }
  }
  return world;
}

// Boucle sur un boss : 10 minutes, sans achat (l'or gagné reste visible).
function farm(state, bossId, minutes = 10) {
  const s = structuredClone(state);
  s.autoAdvance = false;
  s.farmBoss = bossId;
  const world = createCombat(s);
  changeStage(s, world, bossFirstStage(bossId));
  const rng = new Rng(7);
  const v0 = s.powers[bossId]?.victories ?? 0;
  const g0 = s.gold;
  for (let i = 0; i < Math.round((minutes * 60) / DT); i++) { step(s, world, DT, rng); simMs += DT * 1000; world.events.length = 0; }
  const h = minutes / 60;
  return { wins: ((s.powers[bossId]?.victories ?? 0) - v0) / h, gold: (s.gold - g0) / h, cost: rerollCost(state, bossId) };
}

const fmt = (n) => (n >= 1e6 ? n.toExponential(2).replace('e+', 'e') : Math.round(n).toLocaleString('fr-FR'));
const min = (perHour) => (perHour > 0 ? `${(Math.round((60 / perHour) * 10) / 10).toLocaleString('fr-FR')} min` : 'jamais');

const s = createNewState(T0, 0xC0FFEE);
s.ui.recycle = { ...s.ui.recycle, mode: 'pickup' };
play(s, 30 * 60);
const saves = { debut: structuredClone(s) };
play(s, (QUICK ? 3 : 6) * 3600, { rngSeed: 2 });
saves.milieu = structuredClone(s);
play(s, (QUICK ? 6 : 24) * 3600, { rebirth: true, rngSeed: 3 });
play(s, 2 * 3600, { rngSeed: 4 });
saves.fin = structuredClone(s);

const lines = ['| Sauvegarde | Boss | Victoires / h (charges) | Coût d\'une relance | Or / h en boucle | Relances / h (or seul) | 1 charge | 1 relance payée |', '|---|---|---|---|---|---|---|---|'];
const summary = [];
for (const [name, st] of Object.entries(saves)) {
  const bosses = Object.keys(st.powers).filter((id) => bossFirstStage(id) !== null && bossFirstStage(id) <= st.maxStage);
  let goldFirst = 0;
  for (const id of bosses) {
    const r = farm(st, id);
    const byGold = r.gold / r.cost;
    if (byGold >= r.wins) goldFirst += 1;
    lines.push(`| ${name} | ${BOSSES[id].name} | ${fmt(r.wins)} | ${fmt(r.cost)} | ${fmt(r.gold)} | ${fmt(byGold)} | ${min(r.wins)} | ${min(byGold)} |`);
  }
  summary.push(`${name} : ${goldFirst}/${bosses.length} boss où l'or de la boucle paie une relance avant qu'une charge n'arrive`);
}
console.log(lines.join('\n'));
console.log('\n' + summary.join('\n'));
