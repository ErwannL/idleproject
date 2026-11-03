#!/usr/bin/env node
// v9.2.0 : mesure des treize améliorations à l'or avec le moteur réel (core/*.js) en Node, sur le modèle de
// tools/measure-v913.mjs (même horloge fixe, même hasard à graine fixe, même « joueur automatique » qui n'existe
// pas dans le jeu). Produit les tableaux de docs/ameliorations-v920.md.
//
// 1. Effet mesuré de chaque nouvelle amélioration aux niveaux 10 / 50 / 100 (borné au plafond) sur une sauvegarde
//    de milieu de partie : combat de boss (temps, victoire), survie (PV perdus, morts), XP gagnée.
// 2. Temps pour revenir à l'étape max après une Renaissance, et progression des 2 premières heures : joueur
//    « v9.1.9 » (7 lignes) contre joueur « v9.2.0 » (13 lignes), même règle de dépense.
//
// Usage : node tools/measure-v920.mjs [--quick]
const T0 = new Date(2026, 9, 21, 10).getTime();
let simMs = 0;
Date.now = () => T0 + simMs;
let seed = 0x9e3779b9;
Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };

const { BALANCE } = await import('../src/data/balance.js');
const { createNewState } = await import('../src/core/state.js');
const { createCombat, step, isBossStage } = await import('../src/core/combat.js');
const { upgradeCost } = await import('../src/core/economy.js');
const { equipBest, isUpgrade, sweepInventory, bulkRecycleCandidates } = await import('../src/core/inventory.js');
const { autoFuse } = await import('../src/core/forge.js');
const { distributeSkillPoints } = await import('../src/core/skills.js');
const { canRebirth, performRebirth, buyTalentsCheapest } = await import('../src/core/rebirth.js');
const { computeHeroStats } = await import('../src/core/stats.js');
const { openUpgrades } = await import('../src/core/unlocks.js');
const { Rng } = await import('../src/core/rng.js');

const QUICK = process.argv.includes('--quick');
const DT = BALANCE.simulation.tickSeconds;
const clone = (s) => structuredClone(s);
const NEW = ['critDamage', 'lifesteal', 'companionPower', 'dodge', 'bossDamage', 'xpGain'];

// --- Joueurs automatiques ----------------------------------------------------------------------------------
// Joueur qui répartit : 30 % de l'or sur les lignes hors dégâts/s ouvertes (la moins chère d'abord : survie, boss,
// compagnons, XP, or), le reste au meilleur gain de dégâts/s par or. « v9.1.9 » ne voit que les 7 anciennes lignes,
// « v9.2.0 » les 13 : seule la présence des nouvelles lignes change.
function buyDps(state, keys, budget) {
  let spent = 0;
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
    if (!best || best.cost > state.gold || spent + best.cost > budget) break;
    state.gold -= best.cost; spent += best.cost; state.upgrades[best.k] += 1;
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
const DPS = ['damage', 'attackSpeed', 'crit', 'critDamage'];
const OLD = ['damage', 'attackSpeed', 'crit', 'vitality', 'armor', 'regen', 'goldFind'];
const balanced = (s, keys) => {
  buyOthers(s, keys.filter((k) => !DPS.includes(k)), s.gold * 0.3);
  buyDps(s, keys.filter((k) => DPS.includes(k)), Infinity);
};
const PLAYERS = {
  // v9.1.9 : les 7 lignes ouvertes ; v9.2.0 : les 13 lignes ouvertes. Même règle de dépense.
  v919: (s) => balanced(s, openUpgrades(s, BALANCE).filter((k) => OLD.includes(k))),
  v920: (s) => balanced(s, openUpgrades(s, BALANCE)),
};

function play(state, seconds, { player = 'v919', rebirth = false, stopAt = null, rngSeed = 1 } = {}) {
  const world = createCombat(state);
  const rng = new Rng(rngSeed);
  let lastBest = state.maxStage;
  let stall = 0;
  const steps = Math.round(seconds / DT);
  let i = 1;
  for (; i <= steps; i++) {
    step(state, world, DT, rng);
    simMs += DT * 1000;
    world.events.length = 0;
    if (i % Math.round(5 / DT) === 0) {
      PLAYERS[player](state);
      equipBest(state);
      distributeSkillPoints(state);
      autoFuse(state, rng, isUpgrade);
      sweepInventory(state);
      if (state.inventory.length >= BALANCE.loot.inventorySize - 2) {
        const ids = new Set(bulkRecycleCandidates(state, 'epic').map((x) => x.id));
        state.inventory = state.inventory.filter((x) => !ids.has(x.id));
      }
    }
    if (i % Math.round(60 / DT) === 0) {
      if (state.maxStage > lastBest) { lastBest = state.maxStage; stall = 0; } else stall += 1;
      if (stopAt && state.maxStage >= stopAt) break;
      if (rebirth && stall >= 20 && canRebirth(state)) {
        performRebirth(state); buyTalentsCheapest(state); lastBest = state.maxStage; stall = 0;
      }
    }
  }
  return Math.min(i, steps) * DT;
}

// --- Sauvegardes ---------------------------------------------------------------------------------------------
const early = createNewState(T0, 0xC0FFEE);
early.ui.recycle = { ...early.ui.recycle, mode: 'pickup' };
play(early, 30 * 60);
const mid = clone(early);
play(mid, (QUICK ? 2 : 4) * 3600, { rngSeed: 2 });
const late = clone(mid);
play(late, (QUICK ? 4 : 10) * 3600, { rebirth: true, rngSeed: 3 });
play(late, 3600, { rngSeed: 4 });

// --- 1. Effet par niveau -------------------------------------------------------------------------------------
// Sauvegarde de milieu, avec deux compagnons équipés (Chat et Hibou, niveau 10) pour que « Lien des compagnons »
// ait de quoi agir. Boss : le plus haut boss que le héros bat sans l'amélioration (temps de victoire, 90 s au
// plus), et le boss suivant qui le bloque (PV du boss restants). Survie : 5 min sur l'étape max (dégâts reçus,
// PV soignés, morts). XP : 10 min sur l'étape max.
const ref = clone(mid);
ref.companions.owned.cat = { level: 10, stars: 1 }; ref.companions.owned.owl = { level: 10, stars: 1 };
ref.companions.equipped = ['cat', 'owl'];
function bossFight(s0, st) {
  const s = clone(s0);
  s.stage = st; s.autoAdvance = false;
  const world = createCombat(s);
  const rng = new Rng(9);
  let boss = null;
  for (let t = 0; t < 90; t += DT) {
    step(s, world, DT, rng);
    boss = world.enemies.find((e) => e.boss && !e.summoned) ?? boss;
    for (const e of world.events) {
      if (e.type === 'bossDefeated') return { win: true, t, left: 0 };
      if (e.type === 'heroDeath') return { win: false, t, left: boss ? Math.round((boss.hp / boss.maxHp) * 1000) / 10 : 100 };
    }
    world.events.length = 0;
  }
  return { win: false, t: 90, left: boss ? Math.round((boss.hp / boss.maxHp) * 1000) / 10 : 100 };
}
let beat = ref.maxStage; while (!isBossStage(beat)) beat -= 1;
while (beat > 5 && !bossFight(ref, beat).win) { beat -= 1; while (!isBossStage(beat)) beat -= 1; }
let wall = beat + 1; while (!isBossStage(wall)) wall += 1;
function survive(s0, seconds = 300) {
  const s = clone(s0);
  s.stage = s.maxStage; s.autoAdvance = false;
  const world = createCombat(s);
  const rng = new Rng(10);
  let taken = 0; let deaths = 0; let healed = 0; let prev = world.hero.hp;
  for (let t = 0; t < seconds; t += DT) {
    step(s, world, DT, rng);
    for (const e of world.events) { if (e.type === 'heroHit') taken += e.damage; if (e.type === 'heroDeath') deaths += 1; }
    if (world.hero.hp > prev) healed += world.hero.hp - prev;
    prev = world.hero.hp;
    world.events.length = 0;
  }
  return { taken, deaths, healed, xp: world.counters.xp };
}
const effects = {};
const lvls = [0, 10, 50, 100];
for (const k of NEW) {
  effects[k] = {};
  for (const L0 of lvls) {
    const L = Math.min(L0, BALANCE.upgrades[k].maxLevel);
    const s = clone(ref);
    s.upgrades[k] = L;
    const st = computeHeroStats(s);
    effects[k][L0] = { L, stats: st, beat: bossFight(s, beat), wall: bossFight(s, wall), surv: survive(s, k === 'xpGain' ? 600 : 300) };
  }
}

// --- 2. Retour à l'étape max après une Renaissance -----------------------------------------------------------
function returnTime(s0, player) {
  const c = clone(s0);
  const target = c.maxStage;
  if (!canRebirth(c)) return null;
  performRebirth(c);
  buyTalentsCheapest(c);
  const seconds = play(c, (QUICK ? 4 : 12) * 3600, { player, stopAt: target, rngSeed: 21 });
  return { target, seconds, reached: c.maxStage >= target, stage: c.maxStage };
}
const back = { 'v9.1.9 (7 lignes)': returnTime(late, 'v919'), 'v9.2.0 (13 lignes)': returnTime(late, 'v920') };

// Progression du début : 2 h depuis le début avec chaque joueur (étape max atteinte).
const start = {};
for (const p of ['v919', 'v920']) { const s = clone(early); play(s, 2 * 3600, { player: p, rngSeed: 31 }); start[p] = { stage: s.maxStage, ups: { ...s.upgrades } }; }

const r1 = (x) => Math.round(x * 10) / 10;
const hms = (s) => (s >= 3600 ? `${Math.floor(s / 3600)} h ${String(Math.round((s % 3600) / 60)).padStart(2, '0')}` : `${Math.round(s / 60)} min`);
const out = [];
const P = (s = '') => out.push(s);
P(`Sauvegarde de milieu : étape max ${mid.maxStage}, niveau ${mid.level}, dégâts/s ${Math.round(computeHeroStats(mid).dps)}. Fin : étape max ${late.maxStage}, ${late.records.rebirths} Renaissance(s).`);
P();
P(`Boss de référence : étape ${beat} (battu sans l'amélioration) et étape ${wall} (le boss qui bloque).`);
P();
P(`| Amélioration | Niveau | Valeur | Boss ${beat} | Boss ${wall} (PV restants) | Dégâts reçus 5 min | PV soignés | Morts | XP |`);
P('|---|---|---|---|---|---|---|---|---|');
const val = (k, st) => ({ critDamage: `×${r1(st.critMultiplier)} (dégâts/s ${Math.round(st.dps).toLocaleString('fr-FR')})`, lifesteal: `${r1(st.lifesteal)} % (dont base)`, companionPower: `+${st.companionPowerPct} %`,
  dodge: `${r1(st.dodgePct)} % (boss ${r1(st.dodgePct / 2)} %)`, bossDamage: `+${st.bossDamagePct} %`, xpGain: `+${st.xpPct} % (dont base)` })[k];
for (const k of NEW) {
  for (const L0 of lvls) {
    const e = effects[k][L0];
    if (L0 > 0 && effects[k][lvls[lvls.indexOf(L0) - 1]].L === e.L) continue;
    P(`| ${BALANCE.upgrades[k].label} | ${e.L}${e.L !== L0 ? ' (plafond)' : ''} | ${val(k, e.stats)} | ${e.beat.win ? `${r1(e.beat.t)} s` : `non (${e.beat.left} %)`} | ${e.wall.win ? `battu en ${r1(e.wall.t)} s` : `${e.wall.left} % (${r1(e.wall.t)} s)`} | ${Math.round(e.surv.taken).toLocaleString('fr-FR')} | ${Math.round(e.surv.healed).toLocaleString('fr-FR')} | ${e.surv.deaths} | ${Math.round(e.surv.xp).toLocaleString('fr-FR')} |`);
  }
}
P();
P('| Joueur | Étape cible | Temps de retour | Atteinte |');
P('|---|---|---|---|');
for (const [p, r] of Object.entries(back)) P(`| ${p} | ${r?.target ?? '—'} | ${r ? hms(r.seconds) : '—'} | ${r ? (r.reached ? 'oui' : `non (${r.stage})`) : '—'} |`);
P();
P(`Partie neuve, 2 h de jeu : v9.1.9 étape ${start.v919.stage}, v9.2.0 étape ${start.v920.stage}. Niveaux v9.2.0 : ${JSON.stringify(start.v920.ups)}`);
console.log(out.join('\n'));
