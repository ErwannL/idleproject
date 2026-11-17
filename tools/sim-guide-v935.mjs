// v9.3.5 : partie simulée d'un débutant qui ne suit QUE la barre jaune « Prochaine action » (core/guide.js).
// Vrai moteur (createCombat / step), vraies actions du jeu. Rien d'autre n'est acheté ni réglé.
// Usage : node tools/sim-guide-v935.mjs [minutes de jeu = 120] [seed = 1]
import { createNewState } from '../src/core/state.js';
import { changeStage, createCombat, step, stageLabel } from '../src/core/combat.js';
import { guideDay, nextAction, companionToPlace } from '../src/core/guide.js';
import { claimables } from '../src/core/claimables.js';
import { claimAchievement } from '../src/core/achievements.js';
import { claimLogin, claimMission, claimMissionBonus, claimTrackTier, refreshMissions } from '../src/core/missions.js';
import { buyUpgradeBulk } from '../src/core/economy.js';
import { summon } from '../src/core/gacha.js';
import { equipBest, recycleUseless, sweepInventory, sortLootBag, lootBagKeepBestChoices } from '../src/core/inventory.js';
import { upgradeCompanion, toggleCompanion } from '../src/core/companions.js';
import { distributeSkillPoints } from '../src/core/skills.js';
import { performRebirth } from '../src/core/rebirth.js';
import { Rng } from '../src/core/rng.js';
import { BALANCE } from '../src/data/balance.js';

const MINUTES = Number(process.argv[2]) || 120;
const seed = Number(process.argv[3]) || 1;
const T0 = Date.UTC(2026, 10, 9, 12);
const state = createNewState(T0, seed);
if (!process.env.LEGACY) state.unlocks = { done: [], base: { ...state.records } }; // v9.7.1 : mini-quêtes de déblocage
const { advanceUnlocks, isUnlocked } = await import('../src/core/unlock-quests.js');
const rng = new Rng(seed * 97);
let world = createCombat(state);
const dt = BALANCE.simulation.tickSeconds;
const log = [];
const counts = {};
const CLAIM = {
  login: () => claimLogin(state), mission: (c) => claimMission(state, c.period, c.id), missionBonus: (c) => claimMissionBonus(state, c.period),
  track: () => claimTrackTier(state), achievement: (c) => claimAchievement(state, c.id),
};
let lastWorld = 0;
let fightTicks = 0, ticks = 0, w3Companions = null;
for (let t = 0; t < MINUTES * 60; t += dt) {
  const now = T0 + t * 1000;
  step(state, world, dt, rng);
  world.events.length = 0;
  ticks++; if (!world.hero.walking && world.enemies.length) fightTicks++;
  if (Math.round(t / dt) % Math.round(5 / dt) !== 0) continue; // le joueur regarde la barre toutes les 5 s
  refreshMissions(state, now);
  const done = advanceUnlocks(state); if (done) log.push(`${(t / 60).toFixed(1)} min : déblocage ${done.label}`);
  sweepInventory(state);
  const claims = claimables(state, now).filter((c) => CLAIM[c.kind]);
  const q = (id) => isUnlocked(state, id);
  const visible = { upgrades: q('upgrades'), skills: q('skills'), summon: q('summon'), forge: q('forge'), dungeons: q('dungeons'), tree: q('talents'), tower: q('challenges') };
  const a = nextAction(state, { claims, visible });
  counts[a.id] = (counts[a.id] ?? 0) + 1;
  if (a.content) { guideDay(state).done.push(a.id); counts.content = (counts.content ?? 0) + 1; } // v9.6.2 : contenu proposé (suivi, sans jouer le mode)
  switch (a.id) {
    case 'claim': for (const c of claims) CLAIM[c.kind](c); break;
    case 'equip': equipBest(state); break;
    case 'lootbag': sortLootBag(state, lootBagKeepBestChoices(state)); equipBest(state); break; // v9.7.1
    case 'place': toggleCompanion(state, a.value); break;
    case 'skills': distributeSkillPoints(state); break;
    case 'summon': { const n = state.gems >= BALANCE.summon.tenPullGemCost ? 10 : 1; summon(state, rng, n, 'gems', BALANCE, 'ally'); for (let i = 0; i < 3; i++) { const c = companionToPlace(state); if (!c) break; toggleCompanion(state, c.id); } break; }
    case 'upgrade': buyUpgradeBulk(state, a.value, '1'); break;
    case 'level': upgradeCompanion(state, a.value); break;
    case 'recycle': recycleUseless(state); break;
    case 'rebirth': performRebirth(state); world = createCombat(state); log.push(`${(t / 60).toFixed(1)} min : Renaissance`); break;
    case 'retry': if (state.bossRetry) { const r = state.bossRetry; state.bossRetry = null; changeStage(state, world, r.stage); } break;
    case 'advance': state.autoAdvance = true; break;
    default: break;
  }
  const w = Math.floor((state.maxStage - 1) / 20) + 1;
  if (w >= 3 && w3Companions === null) w3Companions = state.companions.equipped.length;
  if (w > lastWorld) { lastWorld = w; log.push(`${(t / 60).toFixed(1)} min : monde ${w} (${stageLabel(state.maxStage)}), compagnons ${state.companions.equipped.length}, gemmes ${state.gems}`); }
}
console.log(log.join('\n'));
console.log(`Fin : étape max ${state.maxStage} (${stageLabel(state.maxStage)}), niveau ${state.level}, équipe ${state.companions.equipped.join(', ') || 'aucune'}, Renaissances ${state.records.rebirths}`);
console.log('Conseils suivis :', JSON.stringify(counts));
console.log(`Combat : ${Math.round(fightTicks / ticks * 100)} % du temps · compagnons placés en arrivant au monde 3 : ${w3Companions}`);
