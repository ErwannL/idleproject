#!/usr/bin/env node
// v9.2.1 : mesure des malus d'environnement (data/environment.js) avec le moteur réel, sur le modèle de
// tools/measure-v920.mjs (horloge fixe, hasard à graine fixe, « joueur automatique » qui n'existe pas dans le jeu).
// Trois parties identiques depuis une partie neuve (Renaissance quand la progression cale 20 min) :
//   sans   — malus retirés (rythme v9.2.0)
//   avec   — malus actifs, même règle de dépense (le joueur n'investit pas exprès dans le contre)
//   contre — malus actifs, le joueur achète d'abord l'amélioration qui contre le malus du monde jusqu'à fullAt
// On note l'heure de première arrivée dans chaque monde, puis le temps passé par monde.
// Usage : node tools/measure-env-v921.mjs [heures=30]
const T0 = new Date(2026, 9, 21, 10).getTime();
let simMs = 0;
Date.now = () => T0 + simMs;
let seed = 0x9e3779b9;
Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };

const { BALANCE } = await import('../src/data/balance.js');
const { ENV_BY_ZONE, ENVIRONMENTS } = await import('../src/data/environment.js');
const { createNewState } = await import('../src/core/state.js');
const { createCombat, step, zoneIndexForStage, zoneStartStage, currentEnvironment } = await import('../src/core/combat.js');
const { upgradeCost } = await import('../src/core/economy.js');
const { equipBest, isUpgrade, sweepInventory, bulkRecycleCandidates } = await import('../src/core/inventory.js');
const { autoFuse } = await import('../src/core/forge.js');
const { distributeSkillPoints } = await import('../src/core/skills.js');
const { canRebirth, performRebirth, buyTalentsCheapest } = await import('../src/core/rebirth.js');
const { computeHeroStats } = await import('../src/core/stats.js');
const { openUpgrades } = await import('../src/core/unlocks.js');
const { Rng } = await import('../src/core/rng.js');

const HOURS = Number(process.argv[2] ?? 30);
const DT = BALANCE.simulation.tickSeconds;
const SAVED = { ...ENV_BY_ZONE };
const envOn = (on) => { for (const k of Object.keys(SAVED)) { if (on) ENV_BY_ZONE[k] = SAVED[k]; else delete ENV_BY_ZONE[k]; } };

const DPS = ['damage', 'attackSpeed', 'crit', 'critDamage'];
const canBuy = (s, k) => (BALANCE.upgrades[k].maxLevel ?? Infinity) > s.upgrades[k];
function buyDps(state, keys) {
  for (let n = 0; n < 4000; n++) {
    const base = computeHeroStats(state).dps;
    let best = null;
    for (const k of keys) {
      if (!canBuy(state, k)) continue;
      const cost = upgradeCost(k, state.upgrades[k]);
      const gain = computeHeroStats({ ...state, upgrades: { ...state.upgrades, [k]: state.upgrades[k] + 1 } }).dps - base;
      if (gain > 0 && (!best || gain / cost > best.score)) best = { k, cost, score: gain / cost };
    }
    if (!best || best.cost > state.gold) break;
    state.gold -= best.cost; state.upgrades[best.k] += 1;
  }
}
function buyOthers(state, keys, budget) {
  let spent = 0;
  for (let n = 0; n < 4000; n++) {
    const c = keys.filter((k) => canBuy(state, k)).map((k) => ({ k, cost: upgradeCost(k, state.upgrades[k]) })).sort((a, b) => a.cost - b.cost)[0];
    if (!c || c.cost > state.gold || spent + c.cost > budget) break;
    state.gold -= c.cost; spent += c.cost; state.upgrades[c.k] += 1;
  }
}
function player(s, mode) {
  const counter = mode === 'contre';
  if (counter) {
    const env = currentEnvironment(s);
    // Jusqu'à 30 % de l'or du moment dans le contre, tant qu'il n'est pas complet.
    if (env && env.countered < 100) {
      const budget = s.gold * 0.3; let spent = 0;
      while (env.counter && canBuy(s, env.counter) && s.upgrades[env.counter] < env.fullAt) {
        const c = upgradeCost(env.counter, s.upgrades[env.counter]);
        if (c > s.gold || spent + c > budget) break;
        s.gold -= c; spent += c; s.upgrades[env.counter] += 1;
      }
    }
  }
  // « avec » : le joueur n'achète jamais l'amélioration qui contre le malus du monde où il se trouve.
  const frozen = mode === 'avec' ? currentEnvironment(s)?.counter : null;
  const keys = openUpgrades(s, BALANCE).filter((k) => k !== frozen);
  buyOthers(s, keys.filter((k) => !DPS.includes(k)), s.gold * 0.3);
  buyDps(s, keys.filter((k) => DPS.includes(k)));
}

function run(mode) {
  envOn(mode !== 'sans');
  simMs = 0; seed = 0x9e3779b9;
  const s = createNewState(T0, 0xC0FFEE);
  s.ui.recycle = { ...s.ui.recycle, mode: 'pickup' };
  const world = createCombat(s);
  const rng = new Rng(1);
  const arrive = {}; const levels = {};
  let lastBest = s.maxStage; let stall = 0;
  const steps = Math.round((HOURS * 3600) / DT);
  for (let i = 1; i <= steps; i++) {
    step(s, world, DT, rng);
    simMs += DT * 1000;
    world.events.length = 0;
    if (i % Math.round(5 / DT) === 0) {
      player(s, mode);
      equipBest(s); distributeSkillPoints(s); autoFuse(s, rng, isUpgrade); sweepInventory(s);
      if (s.inventory.length >= BALANCE.loot.inventorySize - 2) {
        const ids = new Set(bulkRecycleCandidates(s, 'epic').map((x) => x.id));
        s.inventory = s.inventory.filter((x) => !ids.has(x.id));
      }
    }
    if (i % Math.round(5 / DT) === 0) {
      const z = zoneIndexForStage(s.maxStage);
      for (let k = 0; k <= z; k++) if (arrive[k] === undefined) { arrive[k] = i * DT; levels[k] = { ...s.upgrades }; }
    }
    if (i % Math.round(60 / DT) === 0) {
      const z0 = zoneIndexForStage(s.maxStage);
      if (s.maxStage > lastBest) { lastBest = s.maxStage; stall = 0; } else stall += 1;
      if (stall >= 20 && canRebirth(s)) { performRebirth(s); buyTalentsCheapest(s); lastBest = s.maxStage; stall = 0; }
      if (s.maxStage >= 240) break;
    }
  }
  envOn(true);
  return { arrive, levels, maxStage: s.maxStage };
}

const res = { sans: run('sans'), avec: run('avec'), contre: run('contre') };
const hms = (x) => (x === undefined ? '—' : `${Math.floor(x / 60)} min ${String(Math.round(x % 60)).padStart(2, '0')} s`);
const dur = (r, z) => (r.arrive[z + 1] !== undefined && r.arrive[z] !== undefined ? r.arrive[z + 1] - r.arrive[z] : undefined);
console.log(`| Monde | Malus | Contre | Niveau du contre à l'arrivée (sans) | Temps dans le monde sans | avec | écart | contre | écart |`);
console.log('|---|---|---|---|---|---|---|---|---|');
ENVIRONMENTS.forEach((e) => {
  const z = Object.keys(SAVED).indexOf(e.zone) + 1;
  const a = dur(res.sans, z); const b = dur(res.avec, z); const c = dur(res.contre, z);
  const pc = (x) => (x !== undefined && a ? `${x >= a ? '+' : ''}${Math.round(((x - a) / a) * 100)} %` : '—');
  console.log(`| ${z + 1} | ${e.name} | ${BALANCE.upgrades[e.counter].label} (complet niv. ${e.fullAt}) | ${res.sans.levels[z]?.[e.counter] ?? '—'} | ${hms(a)} | ${hms(b)} | ${pc(b)} | ${hms(c)} | ${pc(c)} |`);
});
console.log(`Étape max en fin de partie : sans ${res.sans.maxStage}, avec ${res.avec.maxStage}, contre ${res.contre.maxStage}. Arrivées (h) :`,
  JSON.stringify(Object.fromEntries(Object.entries(res).map(([k, r]) => [k, Object.values(r.arrive).map((x) => Math.round(x / 360) / 10)]))));
