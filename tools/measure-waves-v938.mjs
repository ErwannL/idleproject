// v9.3.8 : mesure du rythme du combat (or/min, XP/min, part du temps où le héros combat) sur une partie fixe :
// équipe et améliorations figées, étapes rejouées en boucle (avance automatique coupée), même graine.
// Usage : node tools/measure-waves-v938.mjs [étape = 130] [secondes = 300]
import { createNewState } from '../src/core/state.js';
import { createCombat, step } from '../src/core/combat.js';
import { Rng } from '../src/core/rng.js';
import { BALANCE } from '../src/data/balance.js';
const STAGE = Number(process.argv[2]) || 130, SECONDS = Number(process.argv[3]) || 300;
const s = createNewState(Date.UTC(2026, 10, 10), 3);
s.maxStage = STAGE; s.stage = STAGE - (STAGE % 5 === 0 ? 1 : 0); s.records.bestStage = STAGE; s.level = 140;
for (const k of Object.keys(s.upgrades)) s.upgrades[k] = Number(process.argv[5]) || 10;
s.upgrades.damage = Number(process.argv[4]) || 260; s.upgrades.vitality = 260;
for (const id of ['pyromancer', 'priestess', 'owl']) s.companions.owned[id] = { level: 30, stars: 3 };
s.companions.equipped = ['pyromancer', 'priestess', 'owl'];
s.skills = { quick: 20, whirl: 20, cry: 10 }; s.skillAuto = true;
s.autoAdvance = false;
const w = createCombat(s); const rng = new Rng(7); const dt = BALANCE.simulation.tickSeconds;
const g0 = s.gold, x0 = s.records?.xpTotal ?? 0, l0 = s.level;
let fight = 0, kills = 0, alive = 0, n = 0, killDist = 0;
for (let t = 0; t < SECONDS; t += dt) {
  step(s, w, dt, rng);
  if (!w.hero.walking) fight++;
  alive += w.enemies.length; n++;
  for (const e of w.events) if (e.type === 'enemyKilled' || e.type === 'kill') { kills++; killDist += (e.x ?? 0) - BALANCE.world.heroX; }
  w.events.length = 0;
}
console.log(JSON.stringify({ stage: STAGE, goldPerMin: Math.round((s.gold - g0) / (SECONDS / 60)), killsPerMin: +(kills / (SECONDS / 60)).toFixed(1),
  fightPct: Math.round(fight / n * 100), avgAlive: +(alive / n).toFixed(2), avgKillDist: kills ? Math.round(killDist / kills) : null, xp: s.xp }));
