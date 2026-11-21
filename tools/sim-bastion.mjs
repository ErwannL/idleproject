// v10.3 (partie 10) : simulation du Bastion sur 7 jours, 2 connexions par jour.
// Vrai moteur (createCombat / step), vraies actions du jeu, vrais gains hors ligne entre deux connexions.
//  1. Une partie neuve suit le Sceau (core/guide.js) jusqu'à l'ouverture du Bastion (étape 40).
//  2. De là, des parties identiques jouent 7 jours (2 connexions par jour, gains hors ligne entre les deux) :
//     « campagne » n'ouvre jamais le Bastion ; les parties « bastion » posent leurs ouvriers, lancent chantiers,
//     recherches et commandes à chaque connexion et renforcent leurs objets jusqu'au plafond relevé par la Forge du
//     forgeron. Quatre profils : « équilibre » donne au Bastion 30 % de l'or qu'il a en se connectant (le reste va
//     aux améliorations du héros) ; les trois autres lui donnent 100 % de cet or (le pire cas pour la borne : leur
//     campagne avance bien moins) — sans économiser, en économisant pour la Forge du forgeron, ou les recherches d'abord.
//  3. Mesure (computeHeroStats(state).combatPower) :
//     - campagne : puissance de la partie « campagne » au jour 7 ÷ puissance à l'ouverture du Bastion ;
//     - Bastion : puissance d'une partie « bastion » au jour 7 ÷ la même partie sans ses recherches ni ses
//       renforcements au-delà du plafond de base (ce que le Bastion apporte par lui-même) ; la borne vaut pour les
//       deux profils ;
//     - pour information : l'étape atteinte par chaque partie (l'or donné au Bastion ne va pas aux améliorations).
// Objectif (docs/plan-v1030.md, 10.6) : Bastion ≤ +25 %, campagne ≥ +200 %.
// Usage : node tools/sim-bastion.mjs [seed = 1] [--days 7] [--session 20] [--json fichier] [--log] [--noise]
import { writeFileSync } from 'node:fs';
import { createNewState } from '../src/core/state.js';
import { changeStage, createCombat, levelForStage, referenceKillGold, step } from '../src/core/combat.js';
import { guideDay, nextAction, companionToPlace } from '../src/core/guide.js';
import { claimables } from '../src/core/claimables.js';
import { claimAchievement } from '../src/core/achievements.js';
import { claimLogin, claimMission, claimMissionBonus, claimTrackTier, refreshMissions } from '../src/core/missions.js';
import { buyUpgradeBulk } from '../src/core/economy.js';
import { summon } from '../src/core/gacha.js';
import { equipBest, recycleUseless, sortLootBag, sweepInventory } from '../src/core/inventory.js';
import { upgradeCompanion, toggleCompanion, companionById } from '../src/core/companions.js';
import { distributeSkillPoints } from '../src/core/skills.js';
import { claimExpedition, sendAllExpeditions } from '../src/core/expeditions.js';
import { grantReward } from '../src/core/rewards.js';
import { applyOfflineRewards, computeOfflineRewards } from '../src/core/offline.js';
import { maxUpgrades, upgradeCost, upgradeItem } from '../src/core/forge.js';
import { refreshItemStats } from '../src/core/loot.js';
import { computeHeroStats } from '../src/core/stats.js';
import { Rng } from '../src/core/rng.js';
import { BALANCE } from '../src/data/balance.js';
import { BUILDINGS, RESEARCH } from '../src/data/bastion.js';
import {
  ackBastionNews, assignWorker, availableWorkers, bastionLevel, bastionOf, bastionTick, buildCost, buildingAccess, buildingDef, canBuild, canOrder, canResearch,
  collectStock, forgeLevel, orderCost, placeOrder, researchCost, researchLevel, startBuild, startResearch, tradeOf, workerBonus, workerSlots,
} from '../src/core/bastion.js';
import { kickoffBastion } from '../src/core/bastion-start.js';

const HOUR = 3_600_000;
const T0 = Date.UTC(2026, 10, 9, 8);
const dt = BALANCE.simulation.tickSeconds;

const CLAIM = (state) => ({
  login: () => claimLogin(state), mission: (c) => claimMission(state, c.period, c.id), missionBonus: (c) => claimMissionBonus(state, c.period),
  track: () => claimTrackTier(state), achievement: (c) => claimAchievement(state, c.id),
});

// Le joueur regarde le Sceau toutes les 5 s et fait ce qu'il dit (comme tools/sim-guide-v935.mjs).
function follow(sim, now) {
  const { state, rng } = sim;
  refreshMissions(state, now);
  sweepInventory(state);
  const handlers = CLAIM(state);
  const claims = claimables(state, now).filter((c) => handlers[c.kind]);
  const a = nextAction(state, { claims, now });
  if (!a) return;
  if (a.content) guideDay(state).done.push(a.id);
  switch (a.id) {
    case 'claim': for (const c of claims) handlers[c.kind](c); break;
    case 'lootbag': sortLootBag(state); break;
    case 'equip': equipBest(state); break;
    case 'place': toggleCompanion(state, a.value); break;
    case 'skills': distributeSkillPoints(state); break;
    case 'summon': {
      const n = state.gems >= BALANCE.summon.tenPullGemCost ? 10 : 1;
      summon(state, rng, n, 'gems', BALANCE, 'ally');
      for (let i = 0; i < 3; i++) { const c = companionToPlace(state); if (!c) break; toggleCompanion(state, c.id); }
      break;
    }
    case 'upgrade': buyUpgradeBulk(state, a.value, a.amount ?? '1'); break;
    case 'level': upgradeCompanion(state, a.value); break;
    case 'recycle': recycleUseless(state); break;
    case 'retry': if (state.bossRetry) { const r = state.bossRetry; state.bossRetry = null; changeStage(state, sim.world, r.stage); } break;
    case 'advance': state.autoAdvance = true; break;
    case 'bastion': ackBastionNews(state, null, now); break; // le joueur a lu la nouvelle du Bastion
    default: break;
  }
}

function play(sim, seconds, from) {
  const { state, rng } = sim;
  const every = Math.round(5 / dt);
  for (let i = 0, n = Math.round(seconds / dt); i < n; i++) {
    step(state, sim.world, dt, rng);
    sim.world.events.length = 0;
    if (i % every === 0) follow(sim, from + i * dt * 1000);
    if (sim.stop?.(state)) return i * dt;
  }
  return seconds;
}

// Renforce les objets portés tant que l'or et les éclats suffisent (le moins cher d'abord), jusqu'au plafond.
// Les renforcements au-delà du plafond de base sont notés : ce sont ceux que la Forge du forgeron a permis.
function reinforce(sim) {
  const { state, rng } = sim;
  for (let guard = 0; guard < 400; guard++) {
    const todo = Object.values(state.equipment).filter((i) => i && (i.upgrades ?? 0) < maxUpgrades(i, BALANCE, state))
      .map((i) => ({ i, c: upgradeCost(i, BALANCE, state) })).filter((x) => x.c.gold <= state.gold && x.c.shards <= state.materials.shards - sim.reserve)
      .sort((a, b) => a.c.shards - b.c.shards)[0];
    if (!todo) break;
    const before = todo.i.upgrades ?? 0;
    const stat = upgradeItem(state, todo.i.id, rng);
    if (!stat) break;
    sim.spent.upgrades += todo.c.shards;
    if (before >= maxUpgrades(todo.i, BALANCE, null)) (sim.extra[todo.i.id] ??= []).push(stat);
  }
}

// Expéditions : on récupère, puis on renvoie les compagnons libres (ceux qui ne travaillent pas au Bastion).
function expeditions(sim, now) {
  const { state } = sim;
  state.expeditions.slots.forEach((run, slot) => { if (run && now >= run.end) claimExpedition(state, slot, now, grantReward); });
  if (Object.keys(state.companions.owned).length >= 5) {
    const workers = new Set(Object.values(bastionOf(state)?.buildings ?? {}).map((b) => b.worker).filter(Boolean));
    // Les ouvriers restent au Bastion : on ne les propose pas aux expéditions.
    const keep = [...workers];
    for (const id of keep) state.companions.owned[id].trial = true;
    sendAllExpeditions(state, 'journey', now);
    for (const id of keep) delete state.companions.owned[id].trial;
  }
}

// Politique du Bastion, la plus rentable en puissance : ouvriers au bon métier, Forge d'abord, recherches de dégâts
// et de vie d'abord, commande Épique+ pour la place la plus faible.
const RESEARCH_ORDER = ['sharp', 'steel', 'war', 'fatal', 'guard', 'breath', 'purse', 'spirit', 'vigil', 'recall', 'hunter', 'bond', 'roads', 'drill', 'vein', 'scouts', 'lessons', 'crew'];
function bastion(sim, now) {
  const { state } = sim;
  // L'or mis de côté pour le Bastion (sim.purse) est le seul qu'il dépense : le reste va aux améliorations du héros.
  const own = state.gold;
  state.gold = sim.purse;
  try { bastionPlan(sim, now); } finally { sim.purse = state.gold; state.gold = own; }
  // Seul le profil « forge » économise d'une connexion à l'autre ; les autres rendent l'or non dépensé au héros.
  if (sim.prefer !== 'forge') { state.gold += sim.purse; sim.purse = 0; }
}
function bastionPlan(sim, now) {
  const { state } = sim;
  for (const e of bastionTick(state, now)) if (e.type !== 'opened') sim.log.push(`  J${sim.day} ${e.type} : ${e.text}`);
  const b = bastionOf(state);
  if (!b) return;
  // v10.4 (6) : à la première ouverture, le jeu pose les meilleurs ouvriers et offre le premier chantier (15 min).
  const kick = kickoffBastion(state, now);
  if (kick?.build) sim.log.push(`  J${sim.day} chantier offert ${buildingDef(kick.build.building).name} → niv. ${kick.build.level}`);
  for (const id of ['mine', 'training']) { const got = collectStock(state, id, now); if (got) sim.gained[got.resource] = (sim.gained[got.resource] ?? 0) + got.amount; }
  // Ouvriers : chaque bâtiment ouvert reçoit le meilleur compagnon libre (bon métier d'abord, puis rareté).
  const order = ['forge', 'library', 'mine', 'training', 'trade'].filter((id) => buildingAccess(state, id).available);
  for (const id of order.slice(0, workerSlots(state))) {
    if (b.buildings[id].worker) continue;
    const taken = new Set(Object.values(b.buildings).map((x) => x.worker).filter(Boolean));
    const best = availableWorkers(state).filter((c) => !taken.has(c.id)).sort((x, y) => workerBonus(state, y.id, id).totalPct - workerBonus(state, x.id, id).totalPct)[0];
    if (best) assignWorker(state, id, best.id, now);
  }
  // L'or de la bourse : la Forge du forgeron d'abord (profil « forge » : rien d'autre ne touche à l'or qu'il lui faut),
  // ou les recherches d'abord (profil « recherche »). La Bibliothèque passe toujours (sans elle, pas de recherche).
  const forgeNeed = () => (sim.prefer === 'forge' && !b.buildings.forge.build ? buildCost(state, 'forge')?.gold ?? 0 : 0);
  const researchFirst = sim.prefer === 'recherche';
  const afford = (gold) => state.gold - gold >= forgeNeed();
  const build = (id) => {
    if (!canBuild(state, id).ok) return;
    const c = buildCost(state, id);
    if (id !== 'forge' && !(id === 'library' && c.level === 1) && !afford(c.gold)) return;
    if (startBuild(state, id, now)) { sim.spent.builds += c.shards; sim.log.push(`  J${sim.day} chantier ${buildingDef(id).name} → niv. ${c.level} (${c.shards} éclats)`); }
  };
  const research = () => {
    // Dégâts et vie d'abord (le niveau le plus bas des deux), puis l'ordre ci-dessus.
    for (let guard = 0; guard < 2; guard++) {
      const first = ['sharp', 'steel'].sort((x, y) => researchLevel(state, x) - researchLevel(state, y));
      const pick = [...first, ...RESEARCH_ORDER].find((id) => canResearch(state, id).ok && afford(researchCost(state, id).gold));
      if (!pick) break;
      startResearch(state, pick, now);
      sim.spent.research += 1;
    }
  };
  if (researchFirst) { build('library'); research(); build('forge'); } else { build('forge'); build('library'); research(); }
  for (const id of order) build(id);
  // Commande : Épique+ pour la place portée la plus faible (sinon Rare+), tant qu'il reste des éclats pour renforcer.
  const slots = Object.entries(state.equipment).sort((x, y) => (x[1]?.level ?? 0) * (x[1] ? 1 : 0) - (y[1]?.level ?? 0) * (y[1] ? 1 : 0));
  for (const tier of ['epic', 'rare']) {
    const slot = slots[0]?.[0];
    if (!slot || !canOrder(state, slot, tier).ok) continue;
    const c = orderCost(state, tier);
    if (c.shards > state.materials.shards - sim.reserve) continue;
    if (placeOrder(state, slot, tier, now)) sim.spent.orders += c.shards;
    break;
  }
}

function connection(sim, now, sessionMinutes) {
  const { state } = sim;
  if (sim.last) {
    const rewards = computeOfflineRewards(state, sim.last, now, sim.rng);
    applyOfflineRewards(state, rewards);
    sim.world = createCombat(state);
  }
  sortLootBag(state);
  equipBest(state);
  sim.goldKills.push(Math.round(state.gold / referenceKillGold(levelForStage(Math.max(40, state.maxStage)))));
  if (sim.withBastion) { const aside = Math.floor(state.gold * sim.share); state.gold -= aside; sim.purse += aside; bastion(sim, now); }
  expeditions(sim, now);
  reinforce(sim);
  play(sim, sessionMinutes * 60, now);
  const end = now + sessionMinutes * 60_000;
  sortLootBag(state);
  equipBest(state);
  if (sim.withBastion) { const aside = Math.floor(state.gold * sim.share); state.gold -= aside; sim.purse += aside; bastion(sim, end); }
  reinforce(sim);
  sim.last = end;
}

// Partie « bastion » sans ce que le Bastion apporte par lui-même : recherches à zéro, renforcements au-delà du plafond
// de base retirés (ceux notés par reinforce).
function withoutBastion(sim, { research = true, upgrades = true } = {}) {
  const s = structuredClone(sim.state);
  if (s.bastion && research) s.bastion.research.levels = {};
  for (const item of Object.values(s.equipment)) {
    const extra = sim.extra[item?.id];
    if (!item || !extra || !upgrades) continue;
    for (const stat of extra) { item.boosts[stat] -= 1; item.upgrades -= 1; }
    refreshItemStats(item, BALANCE);
  }
  return s;
}

const args = process.argv.slice(2);
const opt = (name, d) => { const i = args.indexOf(name); return i >= 0 ? Number(args[i + 1]) : d; };
const seed = Number(args.find((a) => /^\d+$/.test(a) && args[args.indexOf(a) - 1]?.startsWith('--') !== true)) || 1;
const DAYS = opt('--days', 7);
const SESSION = opt('--session', 20);
const jsonOut = args.includes('--json') ? args[args.indexOf('--json') + 1] : null;

// 1. Jusqu'à l'ouverture du Bastion.
const base = { state: createNewState(T0, seed), rng: new Rng(seed * 97), log: [] };
base.world = createCombat(base.state);
base.stop = (s) => Math.max(s.maxStage, s.records.bestStage ?? 1) >= 40;
const warm = play(base, 40 * 3600, T0);
const start = T0 + Math.ceil(warm) * 1000;
const P0 = computeHeroStats(base.state).combatPower;
console.log(`Ouverture du Bastion : étape ${base.state.maxStage} après ${(warm / 3600).toFixed(1)} h de jeu · puissance ${P0} · compagnons ${Object.keys(base.state.companions.owned).length} (alliés : ${Object.keys(base.state.companions.owned).filter((id) => companionById(id)?.kind === 'ally').length}) · éclats ${base.state.materials.shards}`);

// 2. Parties jumelles pendant 7 jours.
function run(withBastion, share = 0, prefer = 'forge', twist = 0) {
  const sim = {
    state: structuredClone(base.state), rng: new Rng(seed * 97 + 1 + twist), withBastion, share, prefer, purse: 0, log: [], last: 0, day: 0, reserve: 0,
    spent: { builds: 0, orders: 0, upgrades: 0, research: 0 }, gained: {}, extra: {}, goldKills: [],
  };
  sim.world = createCombat(sim.state);
  const name = withBastion ? `bastion ${Math.round(share * 100)} % ${prefer}` : 'campagne';
  for (let d = 0; d < DAYS; d++) {
    sim.day = d + 1;
    for (const h of [0, 12]) connection(sim, start + (d * 24 + h) * HOUR, SESSION);
    const st = sim.state;
    console.log(`${name.padEnd(24)} J${d + 1} : étape ${st.maxStage} · puissance ${computeHeroStats(st).combatPower.toExponential(2)} · éclats ${st.materials.shards}`
      + (withBastion && bastionOf(st) ? ` · Forge ${forgeLevel(st)} · Bastion ${bastionLevel(st)} · recherches ${RESEARCH.map((r) => researchLevel(st, r.id)).reduce((a, b) => a + b, 0)}` : ''));
  }
  return sim;
}
const pct = (x) => `${x >= 0 ? '+' : ''}${(x * 100).toFixed(1)} %`;
function report(B, PA) {
  const PB = computeHeroStats(B.state).combatPower;
  return {
    share: B.share, prefer: B.prefer, stage: B.state.maxStage, power: PB,
    own: PB / computeHeroStats(withoutBastion(B)).combatPower - 1,
    ownResearch: PB / computeHeroStats(withoutBastion(B, { upgrades: false })).combatPower - 1,
    ownUpgrades: PB / computeHeroStats(withoutBastion(B, { research: false })).combatPower - 1,
    versusCampaign: PB / PA - 1,
    forge: forgeLevel(B.state), level: bastionLevel(B.state),
    buildings: Object.fromEntries(BUILDINGS.filter((x) => !x.existing).map((x) => [x.id, B.state.bastion?.buildings?.[x.id]?.level ?? 0])),
    research: Object.fromEntries(RESEARCH.map((r) => [r.id, researchLevel(B.state, r.id)]).filter(([, v]) => v)),
    extraUpgrades: Object.values(B.state.equipment).reduce((t, i) => t + (B.extra[i?.id]?.length ?? 0), 0),
    shardsSpent: B.spent, mined: B.gained, goldKillsAtConnection: B.goldKills,
    workers: Object.fromEntries(Object.entries(B.state.bastion?.buildings ?? {}).filter(([, v]) => v.worker).map(([k, v]) => [k, `${v.worker} (${tradeOf(v.worker)})`])),
  };
}
const A = run(false);
const PA = computeHeroStats(A.state).combatPower;
// --noise : la même partie « campagne » avec d'autres tirages au sort, pour mesurer la part du hasard dans l'étape atteinte.
const twins = args.includes('--noise') ? [run(false, 0, 'forge', 1000), run(false, 0, 'forge', 2000)].map((t) => t.state.maxStage) : null;
const sims = [run(true, 0.3, 'équilibre'), run(true, 1, 'équilibre'), run(true, 1, 'forge'), run(true, 1, 'recherche')];
const profiles = sims.map((B) => report(B, PA));
const result = {
  seed, days: DAYS, sessionMinutes: SESSION,
  opening: { stage: base.state.maxStage, hours: warm / 3600, power: P0 },
  campaign: { stage: A.state.maxStage, power: PA, gain: PA / P0 - 1, goldKillsAtConnection: A.goldKills },
  bastion: profiles,
};
if (args.includes('--log')) for (const B of sims) console.log(`--- journal « bastion ${Math.round(B.share * 100)} % ${B.prefer} »\n${B.log.join('\n')}`);
console.log('\n=== Bilan sur', DAYS, 'jours, 2 connexions de', SESSION, 'min par jour (seed', seed, ') ===');
console.log(`Campagne seule : étape ${result.opening.stage} → ${result.campaign.stage}, puissance ${pct(result.campaign.gain)} (objectif : au moins +200 %)`);
console.log(`Or à chaque connexion, en ennemis de l'étape max : ${A.goldKills.join(', ')}`);
if (twins) console.log(`Part du hasard : la même partie « campagne », autres tirages → étapes ${twins.join(' et ')} (au lieu de ${result.campaign.stage})`);
for (const r of profiles) {
  console.log(`\nBastion, ${Math.round(r.share * 100)} % de l'or, profil « ${r.prefer} » : ${pct(r.own)} de puissance par lui-même (objectif : au plus +25 %)`);
  console.log(`  dont recherches ${pct(r.ownResearch)} · renforcements au-delà du plafond de base ${pct(r.ownUpgrades)} (${r.extraUpgrades} niveaux sur les objets portés)`);
  console.log(`  Forge niv. ${r.forge} · Bastion niv. ${r.level} ${JSON.stringify(r.buildings)} · recherches ${JSON.stringify(r.research)}`);
  console.log(`  éclats : chantiers ${r.shardsSpent.builds}, commandes ${r.shardsSpent.orders}, renforcements ${r.shardsSpent.upgrades} · produits : ${JSON.stringify(r.mined)} · ouvriers ${JSON.stringify(r.workers)}`);
  console.log(`  pour information : étape ${r.stage} atteinte (campagne seule : ${result.campaign.stage}${twins ? `, ou ${twins.join(' et ')} avec d'autres tirages` : ''} ; l'écart vient du hasard et de l'or donné au Bastion)`);
}
if (jsonOut) writeFileSync(jsonOut, JSON.stringify(result, null, 2));
const ok = profiles.every((r) => r.own <= 0.25) && result.campaign.gain >= 2;
console.log(ok ? '\n✔ bornes tenues' : '\n✘ bornes NON tenues');
process.exit(ok ? 0 : 1);
