// v10.19 (partie 4) : « plus de mort en un éclair » — partie neuve qui suit le Sceau (comme tools/sim-lib.mjs),
// vrai moteur. Relevé : morts par étape (13 à 21) et temps de jeu pour passer l'étape 15 (boss « mur » du monde 1).
// Usage : node tools/sim-1019-survie.mjs [--seeds 5] [--hours 3] [--look 5] [--json]
// --look : le joueur regarde la barre toutes les N s (5 : attentif ; 120 : distrait, qui achète peu).
// Avant/après : SURVIVAL_OFF=1 node tools/sim-1019-survie.mjs (désactive la section `survival` de balance.js).
import { createNewState } from '../src/core/state.js';
import { createCombat, step } from '../src/core/combat.js';
import { Rng } from '../src/core/rng.js';
import { BALANCE } from '../src/data/balance.js';
import { T0 } from './sim-lib.mjs';
import { advanceUnlocks, isUnlocked } from '../src/core/unlock-quests.js';
import { changeStage } from '../src/core/combat.js';
import { guideDay, nextAction, companionToPlace } from '../src/core/guide.js';
import { claimables } from '../src/core/claimables.js';
import { claimAchievement } from '../src/core/achievements.js';
import { claimLogin, claimMission, claimMissionBonus, claimTrackTier, refreshMissions } from '../src/core/missions.js';
import { buyUpgradeBulk } from '../src/core/economy.js';
import { summon } from '../src/core/gacha.js';
import { equipBest, recycleUseless, sweepInventory, sortLootBag, lootBagKeepBestChoices } from '../src/core/inventory.js';
import { upgradeCompanion, toggleCompanion } from '../src/core/companions.js';
import { distributeSkillPoints } from '../src/core/skills.js';

// Le débutant ne suit que la barre « Prochaine action », menus débloqués seulement, un achat à la fois
// (comme tools/sim-guide-v935.mjs) : c'est ce joueur-là qui bute sur l'étape 15.
function follow(sim, now) {
  const { state, rng } = sim;
  refreshMissions(state, now);
  advanceUnlocks(state);
  sweepInventory(state);
  const CLAIM = {
    login: () => claimLogin(state), mission: (c) => claimMission(state, c.period, c.id), missionBonus: (c) => claimMissionBonus(state, c.period),
    track: () => claimTrackTier(state), achievement: (c) => claimAchievement(state, c.id),
  };
  const claims = claimables(state, now).filter((c) => CLAIM[c.kind]);
  const q = (id) => isUnlocked(state, id);
  const visible = { upgrades: q('upgrades'), skills: q('skills'), summon: q('summon'), forge: q('forge'), dungeons: q('dungeons'), tree: q('talents'), tower: q('challenges') };
  const a = nextAction(state, { claims, visible });
  if (!a) return;
  if (a.content) guideDay(state).done.push(a.id);
  switch (a.id) {
    case 'claim': for (const c of claims) CLAIM[c.kind](c); break;
    case 'equip': equipBest(state); break;
    case 'lootbag': sortLootBag(state, lootBagKeepBestChoices(state)); equipBest(state); break;
    case 'place': toggleCompanion(state, a.value); break;
    case 'skills': distributeSkillPoints(state); break;
    case 'summon': { const n = state.gems >= BALANCE.summon.tenPullGemCost ? 10 : 1; summon(state, rng, n, 'gems', BALANCE, 'ally'); for (let i = 0; i < 3; i++) { const c = companionToPlace(state); if (!c) break; toggleCompanion(state, c.id); } break; }
    case 'upgrade': buyUpgradeBulk(state, a.value, '1'); break;
    case 'level': upgradeCompanion(state, a.value); break;
    case 'recycle': recycleUseless(state); break;
    case 'retry': if (state.bossRetry) { const r = state.bossRetry; state.bossRetry = null; changeStage(state, sim.world, r.stage); } break;
    case 'advance': state.autoAdvance = true; break;
    default: break;
  }
}

export function runSurvival(seed, { hours = 3, until = 21, look = 5 } = {}) {
  const dt = BALANCE.simulation.tickSeconds;
  const sim = { state: createNewState(T0, seed), rng: new Rng(seed * 97), log: [] };
  sim.state.unlocks = { done: [], base: { ...sim.state.records } }; // partie neuve du jeu (main.js) : mini-quêtes, courbe de campagne
  sim.world = createCombat(sim.state);
  const deaths = {}, every = Math.round(look / dt);
  let pass15 = null, reach15 = null, winds = 0, t = 0;
  for (let i = 0, n = Math.round((hours * 3600) / dt); i < n; i++) {
    step(sim.state, sim.world, dt, sim.rng);
    t = (i + 1) * dt;
    for (const ev of sim.world.events) {
      if (ev.type === 'heroDeath' && ev.from) deaths[ev.from] = (deaths[ev.from] ?? 0) + 1;
      if (process.env.TRACE === 'hits' && ev.type === 'heroHit') console.error((t).toFixed(1), 'hit', Math.round(100 * ev.damage / sim.world.heroStats.maxHp) + ' %', 'reste', Math.round(100 * sim.world.hero.hp / sim.world.heroStats.maxHp) + ' %', ev.boss ? 'boss' : '', 'étape', sim.state.stage);
      if (process.env.TRACE && (ev.type === 'heroDeath' || ev.type === 'stage' || ev.type === 'heroSecondWind')) console.error((t / 60).toFixed(1), ev.type, JSON.stringify(ev), 'max', sim.state.maxStage, 'lvl', sim.state.level);
      if (ev.type === 'heroSecondWind') winds += 1;
    }
    sim.world.events.length = 0;
    if (i % every === 0) follow(sim, T0 + t * 1000);
    if (reach15 === null && sim.state.maxStage >= 15) reach15 = t;
    if (pass15 === null && sim.state.maxStage > 15) pass15 = t;
    if (sim.state.maxStage > until) break;
  }
  return { seed, deaths, pass15, reach15, winds, seconds: t, maxStage: sim.state.maxStage };
}

export function summarize(runs) {
  const per = {};
  for (let s = 13; s <= 21; s++) per[s] = runs.reduce((a, r) => a + (r.deaths[s] ?? 0), 0) / runs.length;
  const total = Object.values(per).reduce((a, b) => a + b, 0);
  const times = runs.map((r) => r.pass15 ?? Infinity).sort((a, b) => a - b);
  const median = times[Math.floor((times.length - 1) / 2)];
  const fights = runs.map((r) => (r.pass15 ?? Infinity) - (r.reach15 ?? 0)).sort((a, b) => a - b);
  return { per, total, median15: median, medianFight15: fights[Math.floor((fights.length - 1) / 2)], winds: runs.reduce((a, r) => a + r.winds, 0) / runs.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
  const seeds = Number(opt('--seeds', 5)), hours = Number(opt('--hours', 3)), look = Number(opt('--look', 5));
  if (process.env.SURVIVAL_OFF && BALANCE.survival) BALANCE.survival = { ...BALANCE.survival, enabled: false };
  const runs = [];
  for (let s = 1; s <= seeds; s++) {
    const r = runSurvival(s, { hours, look });
    runs.push(r);
    console.error(`graine ${s} : étape max ${r.maxStage}, étape 15 passée à ${r.pass15 ? (r.pass15 / 60).toFixed(1) + ' min' : '—'}, morts ${JSON.stringify(r.deaths)}`);
  }
  const sum = summarize(runs);
  if (args.includes('--json')) console.log(JSON.stringify(sum));
  else {
    console.log('| Étape | Morts (moyenne par partie) |\n|---|---|');
    for (const [k, v] of Object.entries(sum.per)) console.log(`| ${k} | ${v.toFixed(1)} |`);
    console.log(`| 13-21 | ${sum.total.toFixed(1)} |`);
    console.log(`Temps médian pour passer l'étape 15 : ${(sum.median15 / 60).toFixed(1)} min de jeu (dont ${(sum.medianFight15 / 60).toFixed(1)} min à l'étape 15) ; Second souffle : ${sum.winds.toFixed(1)} par partie`);
  }
}
