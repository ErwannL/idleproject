#!/usr/bin/env node
// v9.2.8 : audit de la survie du héros et simulation de progression avec le moteur réel (core/*.js) en Node, sur le
// modèle de tools/measure-v920.mjs (horloge fixe, hasard à graine fixe, « joueur automatique » qui n'existe pas dans
// le jeu).
//
// 1. Sauvegardes de milieu (30 min + 4 h) et de fin de partie (+ 10 h avec Renaissances, + 1 h) jouées par deux
//    joueurs : « combat » (n'achète que les lignes du filtre Combat, comme sur la capture du joueur) et « équilibré »
//    (30 % de l'or sur les autres lignes ouvertes, la moins chère d'abord ; le reste au meilleur gain de dégâts/s).
// 2. Coups encaissés à PV pleins (core/combat.js hitsToFall) contre un ennemi ordinaire de l'étape max et contre le
//    boss suivant, puis mesurés en vrai : coups du boss reçus avant la première mort, morts en 3 min sur l'étape max.
// 3. Temps pour finir chaque monde depuis une partie neuve (joueur équilibré, Renaissances permises).
//
// Usage : node tools/measure-defense-v928.mjs [--quick] [--json fichier]
const T0 = new Date(2026, 10, 7, 10).getTime();
let simMs = 0;
Date.now = () => T0 + simMs;
let seed = 0x9e3779b9;
Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };

const { writeFileSync } = await import('node:fs');
const { BALANCE } = await import('../src/data/balance.js');
const { createNewState } = await import('../src/core/state.js');
const { createCombat, step, isBossStage, hitsToFall } = await import('../src/core/combat.js');
const { upgradeCost } = await import('../src/core/economy.js');
const { equipBest, isUpgrade, sweepInventory, bulkRecycleCandidates } = await import('../src/core/inventory.js');
const { autoFuse } = await import('../src/core/forge.js');
const { distributeSkillPoints } = await import('../src/core/skills.js');
const { canRebirth, performRebirth, buyTalentsCheapest } = await import('../src/core/rebirth.js');
const { computeHeroStats } = await import('../src/core/stats.js');
const { openUpgrades } = await import('../src/core/unlocks.js');
const { Rng } = await import('../src/core/rng.js');

const QUICK = process.argv.includes('--quick');
const jsonAt = process.argv.indexOf('--json');
const WORLDS_ONLY = process.argv.includes('--worlds-only');
const hoursAt = process.argv.indexOf('--hours');
const DT = BALANCE.simulation.tickSeconds;
const clone = (s) => structuredClone(s);
const cat = (id) => BALANCE.upgradeCategories.find((c) => c.id === id)?.keys ?? [];
const DPS = ['damage', 'attackSpeed', 'crit', 'critDamage', 'doubleAttack'].filter((k) => BALANCE.upgrades[k]);

function buyDps(state, keys) {
  for (let n = 0; n < 4000; n++) {
    const base = computeHeroStats(state).dps;
    let best = null;
    for (const k of keys) {
      const up = BALANCE.upgrades[k];
      if (up.maxLevel !== undefined && state.upgrades[k] >= up.maxLevel) continue;
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
    const list = keys.filter((k) => BALANCE.upgrades[k].maxLevel === undefined || state.upgrades[k] < BALANCE.upgrades[k].maxLevel)
      .map((k) => ({ k, cost: upgradeCost(k, state.upgrades[k]) })).sort((a, b) => a.cost - b.cost);
    const c = list[0];
    if (!c || c.cost > state.gold || spent + c.cost > budget) break;
    state.gold -= c.cost; spent += c.cost; state.upgrades[c.k] += 1;
  }
}
const spend = (s, keys) => {
  buyOthers(s, keys.filter((k) => !DPS.includes(k)), s.gold * 0.3);
  buyDps(s, keys.filter((k) => DPS.includes(k)));
};
const PLAYERS = {
  combat: (s) => spend(s, openUpgrades(s, BALANCE).filter((k) => ['damage', 'attackSpeed', 'crit', 'critDamage', 'bossDamage', 'companionPower', 'doubleAttack'].includes(k))),
  equilibre: (s) => spend(s, openUpgrades(s, BALANCE)),
};

function play(state, seconds, { player = 'equilibre', rebirth = false, rngSeed = 1, onMinute = null } = {}) {
  const world = createCombat(state);
  const rng = new Rng(rngSeed);
  let lastBest = state.maxStage; let stall = 0;
  const steps = Math.round(seconds / DT);
  for (let i = 1; i <= steps; i++) {
    step(state, world, DT, rng);
    simMs += DT * 1000;
    world.events.length = 0;
    if (i % Math.round(5 / DT) === 0) {
      PLAYERS[player](state);
      equipBest(state); distributeSkillPoints(state); autoFuse(state, rng, isUpgrade); sweepInventory(state);
      if (state.inventory.length >= BALANCE.loot.inventorySize - 2) {
        const ids = new Set(bulkRecycleCandidates(state, 'epic').map((x) => x.id));
        state.inventory = state.inventory.filter((x) => !ids.has(x.id));
      }
    }
    if (i % Math.round(60 / DT) === 0) {
      onMinute?.(i * DT, state);
      if (state.maxStage > lastBest) { lastBest = state.maxStage; stall = 0; } else stall += 1;
      if (rebirth && stall >= 20 && canRebirth(state)) { performRebirth(state); buyTalentsCheapest(state); lastBest = state.maxStage; stall = 0; }
    }
  }
}

// Combat de boss réel (90 s au plus) : coups du boss reçus avant la première mort, issue.
function bossFight(s0, st) {
  const s = clone(s0); s.stage = st; s.autoAdvance = false;
  const world = createCombat(s); const rng = new Rng(9);
  let hits = 0;
  for (let t = 0; t < 90; t += DT) {
    step(s, world, DT, rng);
    for (const e of world.events) {
      if (e.type === 'heroHit' && e.boss) hits += 1;
      if (e.type === 'bossDefeated') return { win: true, t, hits };
      if (e.type === 'heroDeath') return { win: false, t, hits };
    }
    world.events.length = 0;
  }
  return { win: false, t: 90, hits };
}
// 3 min sur l'étape max : morts, coups reçus.
function farm(s0) {
  const s = clone(s0); s.stage = s.maxStage; s.autoAdvance = false;
  const world = createCombat(s); const rng = new Rng(10);
  let deaths = 0; let hits = 0;
  for (let t = 0; t < 180; t += DT) {
    step(s, world, DT, rng);
    for (const e of world.events) { if (e.type === 'heroHit' && !e.boss) hits += 1; if (e.type === 'heroDeath') deaths += 1; }
    world.events.length = 0;
  }
  return { deaths, hits };
}

const r1 = (x) => Math.round(x * 10) / 10;
const result = { saves: {}, worlds: {} };
for (const player of WORLDS_ONLY ? [] : ['combat', 'equilibre']) {
  simMs = 0; seed = 0x9e3779b9;
  const early = createNewState(T0, 0xC0FFEE);
  early.ui.recycle = { ...early.ui.recycle, mode: 'pickup' };
  play(early, 30 * 60, { player });
  const mid = clone(early); play(mid, (QUICK ? 2 : 4) * 3600, { player, rngSeed: 2 });
  const late = clone(mid); play(late, (QUICK ? 4 : 10) * 3600, { player, rebirth: true, rngSeed: 3 }); play(late, 3600, { player, rngSeed: 4 });
  for (const [name, s] of [['milieu', mid], ['fin', late]]) {
    const h = hitsToFall(s, s.maxStage);
    const st = computeHeroStats(s);
    const fight = bossFight(s, h.bossStage);
    const f = farm(s);
    result.saves[`${player}/${name}`] = {
      stage: s.maxStage, level: s.level, rebirths: s.records.rebirths ?? 0, maxHp: Math.round(st.maxHp), dps: Math.round(st.dps),
      armor: r1(st.armor), defense: r1(st.defenseReductionPct ?? 0), pc: st.combatPower ?? null,
      hitsNormal: r1(h.normal), hitsBoss: r1(h.boss), bossStage: h.bossStage,
      realBossHits: fight.hits, bossWin: fight.win, bossTime: r1(fight.t), farmDeaths: f.deaths,
      ups: { ...s.upgrades },
    };
  }
}
// Temps pour finir chaque monde (joueur équilibré, partie neuve, Renaissances permises).
{
  simMs = 0; seed = 0x9e3779b9;
  const s = createNewState(T0, 0xC0FFEE);
  s.ui.recycle = { ...s.ui.recycle, mode: 'pickup' };
  const per = BALANCE.stages.stagesPerZone;
  play(s, (hoursAt > 0 ? Number(process.argv[hoursAt + 1]) : QUICK ? 6 : 15) * 3600, {
    rebirth: true, rngSeed: 5,
    onMinute: (t, st) => {
      const done = Math.floor((st.maxStage - 1) / per);
      for (let w = 1; w <= done; w++) {
        if (result.worlds[w] !== undefined) continue;
        const h = hitsToFall(st, st.maxStage);
        result.worlds[w] = { min: Math.round(t / 60), normal: r1(h.normal), boss: r1(h.boss), level: st.level, rebirths: st.records.rebirths ?? 0 };
      }
    },
  });
}
const out = [];
const P = (x = '') => out.push(x);
P('| Joueur / sauvegarde | Étape | Niv. | Renais. | PV max | Dégâts/s | Armure | Défense | PC | Coups ordinaires | Coups boss (calcul) | Boss : coups reçus / issue | Morts 3 min |');
P('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const [k, v] of Object.entries(result.saves)) {
  P(`| ${k} | ${v.stage} | ${v.level} | ${v.rebirths} | ${v.maxHp.toLocaleString('fr-FR')} | ${v.dps.toLocaleString('fr-FR')} | ${v.armor} % | ${v.defense} % | ${v.pc ?? '—'} | ${v.hitsNormal} | ${v.hitsBoss} (étape ${v.bossStage}) | ${v.realBossHits} / ${v.bossWin ? `battu en ${v.bossTime} s` : `perdu à ${v.bossTime} s`} | ${v.farmDeaths} |`);
}
P();
P('| Monde terminé | Minutes depuis le début | Niveau | Renaissances | Coups ordinaires | Coups boss |');
P('|---|---|---|---|---|---|');
for (const [w, m] of Object.entries(result.worlds)) P(`| ${w} | ${m.min} | ${m.level} | ${m.rebirths} | ${m.normal} | ${m.boss} |`);
P();
for (const [k, v] of Object.entries(result.saves)) P(`${k} : ${JSON.stringify(v.ups)}`);
console.log(out.join('\n'));
if (jsonAt > 0) writeFileSync(process.argv[jsonAt + 1], JSON.stringify(result, null, 1));
