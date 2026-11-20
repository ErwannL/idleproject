// v10.3 (partie 10) : le Bastion — chantiers en temps réel, ouvriers exclusifs, Forge du forgeron, recherches plafonnées,
// commandes livrées dans le coffre de butin, rappels dits une seule fois, sauvegarde réparée, Renaissance, et la
// borne « au plus +25 % de puissance en 7 jours » (la simulation complète : tools/sim-bastion.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createNewState, sanitizeState } from '../src/core/state.js';
import {
  BUILDINGS, RESEARCH, RESEARCH_BRANCHES, ackBastionNews, assignWorker, bastionDaybookLine, bastionLevel, bastionOf, bastionSeal, bastionSealShown, bastionShortcuts,
  bastionTick, buildCost, buildRemaining, buildingAccess, canBuild, canResearch, collectOrder, collectStock, forgeLevel, forgePerks, goldUnit, orderCost, placeOrder,
  productionFactor, productionOf, researchBonuses, researchCaps, researchCost, researchEffects, researchSlots, startBuild, startResearch, takeNotices, tradeOf,
  workerBonus, workerNoticeText, workerSlots,
} from '../src/core/bastion.js';
import { BASTION_UNLOCK_STAGE, FORGE_PERKS, ORDER_TIERS, WORKER_RULES } from '../src/data/bastion.js';
import { BALANCE } from '../src/data/balance.js';
import { BONDS, bondBonus } from '../src/data/bonds.js';
import { COMPANIONS } from '../src/data/companions.js';
import { bonusSources } from '../src/core/bonuses.js';
import { replaceCompanion, toggleCompanion } from '../src/core/companions.js';
import { startExpedition } from '../src/core/expeditions.js';
import { craftCost, fusionChance, maxUpgrades, upgradeCost, upgradeItem } from '../src/core/forge.js';
import { nextAction } from '../src/core/guide.js';
import { LOOT_BAG_MAX } from '../src/core/inventory.js';
import { generateItem } from '../src/core/loot.js';
import { planNotifications } from '../src/core/notify-plan.js';
import { offlineCapHours } from '../src/core/offline.js';
import { performRebirth } from '../src/core/rebirth.js';
import { Rng } from '../src/core/rng.js';
import { computeHeroStats } from '../src/core/stats.js';

const T0 = Date.UTC(2026, 10, 21, 9);
const HOUR = 3_600_000;
const ALLIES = ['dwarf', 'priestess', 'ranger', 'squire', 'mercenary', 'witch'];
// Partie au Bastion ouvert : étape 60, six compagnons libres, de quoi payer.
function opened(stage = 60) {
  const s = createNewState(T0, 7);
  s.maxStage = stage; s.stage = stage; s.records.bestStage = stage;
  for (const id of ALLIES) s.companions.owned[id] = { stars: 1, level: 1 };
  bastionTick(s, T0);
  s.gold = 1e30; s.materials.shards = 1e6;
  return s;
}

test('ouverture : étape 40, Forge du forgeron offerte au niveau 1, les autres bâtiments un par un', () => {
  const young = createNewState(T0, 1);
  young.maxStage = BASTION_UNLOCK_STAGE - 1;
  assert.deepEqual(bastionTick(young, T0), []);
  assert.equal(bastionOf(young), null);
  assert.deepEqual(bastionShortcuts(young, T0), []);
  young.maxStage = BASTION_UNLOCK_STAGE;
  assert.equal(bastionTick(young, T0)[0].type, 'opened');
  assert.equal(forgeLevel(young), 1);
  assert.equal(buildingAccess(young, 'forge').available, true);
  assert.match(buildingAccess(young, 'library').reason, /étape 55/);
  // Tout débloqué par l'étape : toujours un seul bâtiment nouveau à la fois (le précédent doit être construit).
  const s = opened(200);
  assert.equal(buildingAccess(s, 'library').available, true);
  assert.match(buildingAccess(s, 'mine').reason, /Construis d'abord : Bibliothèque/);
  assert.match(buildingAccess(s, 'trade').reason, /Bastion niveau 5/);
  assert.equal(workerSlots(s), 2);
  assert.deepEqual(bastionShortcuts(s, T0).map((x) => [x.id, x.busy, x.total]), [['forge', 0, 1], ['research', 0, 0], ['workers', 0, 2]]);
});

test('chantier lancé, jeu fermé 3 h : fini au retour ; le Carnet et le Sceau le disent une seule fois', () => {
  const s = opened();
  assert.equal(canBuild(s, 'forge').ok, false, 'sans ouvrier, pas de chantier');
  assert.match(canBuild(s, 'forge').reason, /Aucun ouvrier/);
  assert.equal(assignWorker(s, 'forge', 'dwarf', T0), null);
  const cost = buildCost(s, 'forge');
  const gold = s.gold;
  assert.equal(startBuild(s, 'forge', T0), true);
  assert.equal(s.gold, gold - cost.gold);
  assert.equal(startBuild(s, 'forge', T0), false, 'un seul chantier par ouvrier');
  // Rien n'est dit tant que le chantier tourne.
  assert.equal(bastionDaybookLine(s), null);
  assert.equal(bastionSeal(s, T0), null);
  // Retour 3 h plus tard.
  const back = T0 + 3 * HOUR;
  const events = bastionTick(s, back);
  assert.deepEqual(events.map((e) => [e.type, e.ref, e.away]), [['build', 'forge', true]]);
  assert.equal(forgeLevel(s), 2);
  assert.equal(bastionDaybookLine(s), 'Le Bastion a fini 1 chantier');
  const said = nextAction(s, { claims: [], now: back });
  assert.equal(said.id, 'bastion');
  assert.equal(said.text, 'Chantier terminé : Forge du forgeron niveau 2');
  assert.equal(said.action, 'bastion-open');
  // Le Sceau l'a montré : il le garde le temps d'être lu, puis ne le redit plus.
  bastionSealShown(s, back);
  assert.equal(nextAction(s, { claims: [], now: back + 30_000 }).id, 'bastion');
  assert.notEqual(nextAction(s, { claims: [], now: back + 120_000 })?.id, 'bastion');
  // Le Carnet est lu : la ligne disparaît.
  ackBastionNews(s, 'book', back + 120_000);
  assert.equal(bastionDaybookLine(s), null);
  // Un autre retour sans rien de neuf : rien n'est redit.
  assert.deepEqual(bastionTick(s, back + 10 * HOUR), []);
  assert.equal(bastionDaybookLine(s), null);
  assert.notEqual(nextAction(s, { claims: [], now: back + 10 * HOUR })?.id, 'bastion');
  assert.equal(s.bastion.news.length, 0);
});

test('en jeu (pas d\'absence) : le chantier fini est un simple événement, pas un rappel', () => {
  const s = opened();
  assignWorker(s, 'forge', 'dwarf', T0);
  startBuild(s, 'forge', T0);
  let events = [];
  for (let t = T0; t <= T0 + 0.5 * HOUR && !events.length; t += 1000) events = bastionTick(s, t);
  assert.equal(events[0].type, 'build');
  assert.equal(events[0].away, false);
  assert.equal(bastionDaybookLine(s), null);
  // Fenêtre masquée : c'est une absence, même seconde par seconde.
  const h = opened();
  assignWorker(h, 'forge', 'dwarf', T0);
  startBuild(h, 'forge', T0);
  for (let t = T0; t <= T0 + 0.5 * HOUR && !h.bastion.news.length; t += 1000) bastionTick(h, t, { away: true });
  assert.equal(bastionDaybookLine(h), 'Le Bastion a fini 1 chantier');
});

test('ouvriers : métier +20 %, rareté +5 à +20 % ; sans ouvrier, production à 50 % et chantier en pause', () => {
  for (const c of COMPANIONS.filter((x) => x.kind === 'ally')) assert.ok(c.trade, `${c.id} a un métier`);
  const s = opened(200);
  assert.equal(tradeOf('dwarf'), 'smith');
  assert.deepEqual([workerBonus(s, 'dwarf', 'forge').totalPct, workerBonus(s, 'dwarf', 'library').totalPct], [WORKER_RULES.tradeBonusPct + 5, 5]);
  assert.equal(workerBonus(s, 'witch', 'library').totalPct, 30);
  assert.equal(productionFactor(s, 'forge'), 0.5);
  assignWorker(s, 'forge', 'dwarf', T0);
  assert.equal(productionFactor(s, 'forge'), 1.25);
  // Le chantier va plus vite avec le bon métier : 30 min de travail → 24 min.
  startBuild(s, 'forge', T0);
  assert.equal(Math.round(buildRemaining(s, 'forge') / 60000), 24);
  // Deux places seulement au départ.
  assert.equal(assignWorker(s, 'library', 'priestess', T0), null);
  startBuild(s, 'library', T0);
  bastionTick(s, T0 + HOUR);
  assert.match(assignWorker(s, 'mine', 'ranger', T0 + HOUR), /places d'ouvrier/);
  // Retirer l'ouvrier met le chantier en pause : rien n'avance, rien n'est perdu.
  startBuild(s, 'forge', T0 + HOUR);
  bastionTick(s, T0 + HOUR + 10 * 60_000);
  const left = s.bastion.buildings.forge.build.left;
  assert.equal(toggleCompanion(s, 'dwarf'), true);
  bastionTick(s, T0 + 9 * HOUR);
  assert.equal(s.bastion.buildings.forge.build.left, left);
  assert.equal(buildRemaining(s, 'forge'), Infinity);
});

test('un ouvrier ne peut pas être aussi dans l\'équipe ou en expédition ; le mettre dans l\'équipe le retire, avec un avertissement', () => {
  const s = opened();
  s.companions.equipped = ['squire'];
  assert.match(assignWorker(s, 'forge', 'squire', T0), /équipe/);
  assert.equal(assignWorker(s, 'forge', 'dwarf', T0), null);
  assert.equal(toggleCompanion(s, 'dwarf'), true);
  assert.equal(s.bastion.buildings.forge.worker, null);
  assert.ok(s.companions.equipped.includes('dwarf'));
  const notices = takeNotices(s);
  assert.equal(notices.length, 1);
  assert.equal(workerNoticeText(notices[0]), 'Nain guerrier rejoint l\'équipe et quitte la Forge du forgeron : production à 50 %');
  assert.deepEqual(takeNotices(s), [], 'l\'avertissement est dit une fois');
  // Remplacement dans l'équipe : même règle.
  assert.equal(assignWorker(s, 'forge', 'priestess', T0), null);
  assert.equal(replaceCompanion(s, 'priestess', 'squire'), true);
  assert.equal(s.bastion.buildings.forge.worker, null);
  // Expédition : l'ouvrier part, le bâtiment le perd ; un compagnon parti ne peut pas être posé.
  for (const id of ['golden_slime', 'cat', 'owl']) s.companions.owned[id] = { stars: 1, level: 1 };
  takeNotices(s);
  assert.equal(assignWorker(s, 'forge', 'ranger', T0), null);
  assert.equal(startExpedition(s, 0, 'ranger', 'patrol', T0), true);
  assert.equal(s.bastion.buildings.forge.worker, null);
  assert.match(workerNoticeText(takeNotices(s)[0]), /Rôdeur part en expédition et quitte la Forge du forgeron/);
  assert.match(assignWorker(s, 'forge', 'ranger', T0), /expédition/);
  // Équipe changée sans passer par les fonctions (Build, équipe conseillée) : le pas du Bastion remet d'aplomb.
  assert.equal(assignWorker(s, 'forge', 'mercenary', T0), null);
  s.companions.equipped = ['mercenary'];
  bastionTick(s, T0 + 1000);
  assert.equal(s.bastion.buildings.forge.worker, null);
});

test('la Forge du Bastion règle les chiffres de la Forge : chance de fusion, renforcement maximal, coûts, commandes', () => {
  const s = opened();
  const item = { rarity: 'epic', level: 60, upgrades: 0 };
  const at = (level) => { s.bastion.buildings.forge.level = level; return [fusionChance(s, 'weapon', 'epic', 3), fusionChance(s, 'weapon', 'epic', 4), fusionChance(s, 'weapon', 'epic', 5)]; };
  const base = BALANCE.forge.fusion.epic.stakes;
  assert.deepEqual(at(0), [base[3], base[4], 100]);
  assert.deepEqual(at(1), [base[3] + 5, base[4] + 5, 100]);
  assert.deepEqual(at(4), [base[3] + 20, base[4] + 20, 100]);
  assert.deepEqual(at(10), [base[3] + 50, FORGE_PERKS.fusionCap, 100], 'plafond 95 % sur les mises courtes');
  // Renforcement maximal : le plafond de base, puis + maxUpgradePerLevel par niveau ; sans `state` : la base.
  assert.equal(maxUpgrades(item, BALANCE, null), 10);
  s.bastion.buildings.forge.level = 3;
  assert.equal(maxUpgrades(item, BALANCE, s), 10 + 3 * FORGE_PERKS.maxUpgradePerLevel);
  assert.ok(upgradeCost(item, BALANCE, s).gold < upgradeCost(item, BALANCE, null).gold);
  // Commandes : 1 → 3 en même temps, coût de « Fabriquer » réduit de 10 % par niveau, Légendaire+ au niveau 6.
  assert.deepEqual([1, 4, 7].map((l) => forgePerks(s, l).orderSlots), [1, 2, 3]);
  s.bastion.buildings.forge.level = 2;
  assert.equal(orderCost(s, 'epic').shards, Math.round(craftCost(s, BALANCE, 'epic').shards * 0.8));
  assert.equal(forgePerks(s, 5).legendaryOrders, false);
  assert.equal(forgePerks(s, 6).legendaryOrders, true);
  assert.deepEqual(ORDER_TIERS.map((t) => t.hours), [1, 4, 8]);
});

test('recherches : 3 branches de 6, dans l\'ordre ; plafonds du total +60 % dégâts, +60 % vie, +50 % or', () => {
  assert.equal(RESEARCH_BRANCHES.length, 3);
  for (const br of RESEARCH_BRANCHES) assert.equal(RESEARCH.filter((r) => r.branch === br.id).length, 6, br.id);
  const caps = researchCaps();
  assert.ok(caps.damagePct <= 60 && caps.damagePct >= 40, `dégâts ${caps.damagePct}`);
  assert.ok(caps.maxHpPct <= 60 && caps.maxHpPct >= 40, `vie ${caps.maxHpPct}`);
  assert.equal(caps.goldPct, 50);
  // Même avec le meilleur lien renforcé par « Lien renforcé », le total reste sous le plafond.
  const bondDamage = Math.max(...BONDS.map((b) => b.bonus.damagePct ?? 0)) * (caps.bondPct / 100);
  const bondHp = Math.max(...BONDS.map((b) => b.bonus.maxHpPct ?? 0)) * (caps.bondPct / 100);
  assert.ok(caps.damagePct + bondDamage <= 60 && caps.maxHpPct + bondHp <= 60, `${caps.damagePct + bondDamage} / ${caps.maxHpPct + bondHp}`);
  // Tout au maximum : la source « Recherches » des statistiques donne exactement ces totaux (niveaux bornés).
  const s = opened(200);
  for (const r of RESEARCH) s.bastion.research.levels[r.id] = r.max + 50;
  assert.deepEqual(researchEffects(s), caps);
  const src = bonusSources(s).research;
  assert.deepEqual([src.damagePct, src.maxHpPct, src.goldPct], [caps.damagePct, caps.maxHpPct, caps.goldPct]);
  assert.deepEqual(researchBonuses(s), src);
  assert.equal(offlineCapHours(s), BALANCE.offline.capHours + caps.offlineHours);
  s.companions.equipped = ['squire', 'azure_paladin']; s.companions.owned.azure_paladin = { stars: 1, level: 1 };
  assert.equal(bondBonus(s, 'maxHpPct'), 8 * (1 + caps.bondPct / 100));
  // Dans l'ordre : la suivante s'ouvre quand la précédente atteint le niveau 3 ; une à la fois, deux au niveau 6.
  const p = opened(200);
  assert.match(canResearch(p, 'sharp').reason, /Bibliothèque/);
  p.bastion.buildings.library.level = 1;
  assert.equal(researchSlots(p), 1);
  assert.match(canResearch(p, 'steel').reason, /Lames aiguisées niveau 3/);
  assert.equal(startResearch(p, 'sharp', T0), true);
  assert.match(canResearch(p, 'purse').reason, /déjà en cours/);
  p.bastion.buildings.library.level = 6;
  assert.equal(researchSlots(p), 2);
  assert.equal(startResearch(p, 'purse', T0), true);
  // Durées : 10 min au premier niveau, jamais plus de 6 h ; −5 % par niveau de Bibliothèque.
  const q = opened(200); q.bastion.buildings.library.level = 1;
  assert.equal(researchCost(q, 'sharp').ms, 10 * 60_000);
  for (const r of RESEARCH) for (let lv = 0; lv < r.max; lv++) { q.bastion.research.levels[r.id] = lv; const ms = researchCost(q, r.id).ms; assert.ok(ms >= 10 * 60_000 && ms <= 6 * HOUR, `${r.id} ${lv}`); }
  q.bastion.research.levels = {}; q.bastion.buildings.library.level = 3;
  assert.equal(researchCost(q, 'sharp').ms, 10 * 60_000 * 0.9);
  // Sans ouvrier la recherche avance à 50 % ; avec un savant, +25 %.
  bastionTick(p, T0 + 15 * 60_000);
  assert.equal(p.bastion.research.levels.sharp ?? 0, 0, '10 min de travail à 50 % : pas encore fini après 15 min');
  bastionTick(p, T0 + 21 * 60_000);
  assert.equal(p.bastion.research.levels.sharp, 1);
});

test('aucune étape de l\'histoire ne demande un niveau de Bastion', () => {
  // Les données et règles de la campagne ne lisent jamais le Bastion.
  for (const file of ['data/zones.js', 'data/enemies.js', 'data/dungeons.js', 'data/arena-floors.js', 'data/missions.js', 'core/combat.js', 'core/seals.js',
    'core/unlocks.js', 'core/unlock-quests.js', 'core/dungeon.js', 'core/tower.js', 'core/challenge.js', 'core/arena-cards.js', 'core/rebirth.js']) {
    const src = readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(src, /bastion-base|bastion\.js|state\.bastion|buildingLevel|bastionLevel|forgeLevel|bastionOpen/, file);
  }
  // Et le Sceau ne propose jamais d'attendre le Bastion : sa seule consigne est le rappel du retour.
  const guide = readFileSync(new URL('../src/core/guide.js', import.meta.url), 'utf8');
  assert.doesNotMatch(guide, /buildingLevel|bastionLevel|forgeLevel|canBuild|canResearch|researchLevel/);
  assert.equal((guide.match(/bastionSeal\(/g) ?? []).length, 1);
});

test('commande du forgeron : livrée dans le coffre de butin, jamais perdue', () => {
  const s = opened();
  s.materials.shards = 1000; s.gold = 2 ** 52;
  assert.equal(placeOrder(s, 'weapon', 'legendary', T0), null, 'Légendaire+ : Forge niveau 6');
  const before = { gold: s.gold, shards: s.materials.shards };
  const cost = orderCost(s, 'epic');
  const order = placeOrder(s, 'helmet', 'epic', T0);
  assert.ok(order);
  assert.deepEqual([before.gold - s.gold, before.shards - s.materials.shards], [cost.gold, cost.shards]);
  assert.equal(placeOrder(s, 'ring', 'rare', T0), null, 'une commande à la fois au niveau 1');
  // Sans ouvrier : forgée à 50 % (4 h de travail → 8 h).
  assert.equal(bastionTick(s, T0 + 5 * HOUR).length, 0);
  const events = bastionTick(s, T0 + 8 * HOUR + 1000);
  assert.deepEqual(events.map((e) => e.type), ['order', 'delivered']);
  assert.equal(s.bastion.orders.length, 0);
  const item = s.lootBag.at(-1);
  assert.equal(item.slot, 'helmet');
  assert.ok(['epic', 'legendary'].includes(item.rarity));
  assert.equal(item.level, 60, 'au niveau de l\'étape max');
  assert.match(bastionSeal(s, T0 + 8 * HOUR + 1000).text, /^Commande prête : Casque (Épique|Légendaire)$/);
  // Coffre de butin plein : la commande attend « prête » dans la file, l'objet est gardé.
  s.lootBag = Array.from({ length: LOOT_BAG_MAX }, () => item);
  const second = placeOrder(s, 'ring', 'rare', T0 + 9 * HOUR);
  const waiting = bastionTick(s, T0 + 12 * HOUR);
  assert.deepEqual(waiting.map((e) => e.type), ['order']);
  assert.equal(s.bastion.orders[0].ready, true);
  assert.equal(s.bastion.orders[0].item.slot, 'ring');
  assert.equal(s.lootBag.length, LOOT_BAG_MAX);
  assert.equal(collectOrder(s, second.id, T0 + 12 * HOUR), null, 'toujours pas de place');
  assert.equal(bastionShortcuts(s, T0 + 12 * HOUR)[0].ready, 1);
  // Elle survit à une sauvegarde, puis part dès qu'une place se libère.
  const again = sanitizeState(JSON.parse(JSON.stringify(s)), BALANCE, T0 + 12 * HOUR);
  assert.equal(again.bastion.orders[0].ready, true);
  assert.equal(again.bastion.orders[0].item.slot, 'ring');
  again.lootBag.length = 10;
  assert.equal(collectOrder(again, second.id, T0 + 12 * HOUR).where, 'chest');
  assert.equal(again.lootBag.at(-1).slot, 'ring');
  assert.equal(again.bastion.orders.length, 0);
  // Coffre de butin désactivé : l'objet va dans le sac.
  const off = opened(); off.ui.lootBag = false; off.materials.shards = 1000;
  placeOrder(off, 'weapon', 'rare', T0);
  bastionTick(off, T0 + 3 * HOUR);
  assert.equal(off.inventory.at(-1).slot, 'weapon');
});

test('Mine de cristal et Camp d\'entraînement : le stock monte jeu fermé, jusqu\'au plafond', () => {
  const s = opened(200);
  s.bastion.buildings.library.level = 1; s.bastion.buildings.mine.level = 1;
  const prod = productionOf(s, 'mine');
  assert.ok(prod.perHour > 0 && Math.round(prod.capHours) === 6);
  assert.equal(productionOf(s, 'mine', 10).capHours, 12);
  bastionTick(s, T0 + 2 * HOUR);
  assert.equal(Math.floor(s.bastion.stock.mine), Math.floor(prod.perHour * 2 * 0.5), 'sans ouvrier : 50 %');
  bastionTick(s, T0 + 100 * HOUR);
  assert.equal(s.bastion.stock.mine, prod.cap);
  const shards = s.materials.shards;
  assert.deepEqual(collectStock(s, 'mine', T0 + 100 * HOUR), { resource: 'shards', amount: prod.cap });
  assert.equal(s.materials.shards, shards + prod.cap);
  assert.equal(collectStock(s, 'mine', T0 + 100 * HOUR), null);
});

test('sauvegarde : un Bastion abîmé est réparé, une ancienne partie le reçoit, une jeune partie ne l\'a pas', () => {
  // Ancienne sauvegarde sans Bastion (fin de jeu) : ouvert, Forge niveau 1, rien d'autre.
  const old = sanitizeState(JSON.parse(readFileSync('tests/fixtures/endgame.json', 'utf8')));
  assert.equal(old.bastion.buildings.forge.level, 1);
  assert.equal(bastionLevel(old), 1);
  assert.deepEqual(old.bastion.orders, []);
  // Partie neuve : pas de Bastion.
  assert.equal(sanitizeState(JSON.parse(JSON.stringify(createNewState(T0, 3)))).bastion, undefined);
  // Bastion abîmé.
  const s = opened(200);
  s.companions.equipped = ['squire'];
  const raw = JSON.parse(JSON.stringify(s));
  raw.bastion = {
    at: 'hier', buildings: { forge: { level: 99, worker: 'squire', build: { left: -5, total: NaN } }, library: { level: 2.7, worker: 'dwarf', build: { left: 5e12, total: 9e12 } }, mine: { level: -3, worker: 'dwarf' }, donjon: { level: 5 } },
    research: { levels: { sharp: 400, inconnue: 3, steel: 'x' }, active: [{ id: 'sharp', left: 10, total: 20 }, { id: 'nope', left: 1, total: 2 }, null, { id: 'purse', left: 1000, total: 2000 }, { id: 'purse', left: 1, total: 2 }] },
    orders: [{ slot: 'weapon', tier: 'rare', left: 60_000, total: 3_600_000 }, { slot: 'chaussure', tier: 'rare', left: 1, total: 2 }, { slot: 'ring', tier: 'mythique' }, { slot: 'ring', tier: 'epic', ready: true, item: { id: 'faux' } }, 7],
    stock: { mine: 1e9, training: -4 }, trade: { day: 12, used: 'x' }, news: [{ kind: 'build', text: 'Forge', seal: 'a' }, { kind: 'virus', text: 'x' }, null], cards: ['forge', 'donjon'],
  };
  const fixed = sanitizeState(raw, BALANCE, T0).bastion;
  assert.equal(fixed.buildings.forge.level, 10);
  assert.equal(fixed.buildings.forge.worker, null, 'un membre de l\'équipe n\'est pas ouvrier');
  assert.equal(fixed.buildings.forge.build, null);
  assert.equal(fixed.buildings.library.level, 2);
  assert.equal(fixed.buildings.library.worker, 'dwarf');
  assert.ok(fixed.buildings.library.build.total <= 8 * HOUR && fixed.buildings.library.build.left <= fixed.buildings.library.build.total);
  assert.equal(fixed.buildings.mine.level, 0);
  assert.equal(fixed.buildings.mine.worker, null, 'un compagnon ne travaille qu\'à un endroit');
  assert.equal(fixed.buildings.donjon, undefined);
  assert.deepEqual(fixed.research.levels, { sharp: 15 });
  assert.deepEqual(fixed.research.active.map((a) => a.id), ['purse'], 'recherche au maximum, inconnue ou en double : retirée');
  assert.deepEqual(fixed.orders.map((o) => [o.slot, o.tier, o.ready]), [['weapon', 'rare', false]]);
  assert.ok(fixed.stock.mine === 0 && fixed.stock.training === 0);
  assert.deepEqual(fixed.trade, { day: '', used: 0 });
  assert.deepEqual(fixed.news.map((n) => [n.kind, n.seal]), [['build', 0]]);
  assert.deepEqual(fixed.cards, ['forge']);
  assert.equal(fixed.at, T0);
});

test('sauvegarde : niveaux de recherche bornés, travaux valides gardés', () => {
  const s = opened(200);
  const raw = JSON.parse(JSON.stringify(s));
  raw.bastion.buildings.library = { level: 1, worker: null, build: null };
  raw.bastion.research = { levels: { sharp: 400, steel: 2, inconnue: 3 }, active: [{ id: 'steel', left: 600_000, total: 1_200_000 }, { id: 'nope', left: 1, total: 2 }, { id: 'purse', left: 1, total: 2 }] };
  raw.bastion.orders = [{ id: 4, slot: 'weapon', tier: 'rare', left: 60_000, total: 3_600_000 }, { slot: 'ring', tier: 'mythique' }];
  raw.bastion.stock = { mine: 1e9, training: -4 };
  raw.bastion.at = T0 + 50 * HOUR; // horloge en avance : ramenée à maintenant
  const fixed = sanitizeState(raw, BALANCE, T0).bastion;
  assert.deepEqual(fixed.research.levels, { sharp: 15, steel: 2 });
  assert.deepEqual(fixed.research.active.map((a) => a.id), ['steel'], 'une recherche à la fois au niveau 1');
  assert.deepEqual(fixed.orders.map((o) => [o.id, o.slot, o.tier, o.ready]), [[4, 'weapon', 'rare', false]]);
  assert.equal(fixed.nextOrder, 5);
  assert.deepEqual(fixed.stock, { mine: 0, training: 0 }, 'pas de Mine : pas de stock');
  assert.equal(fixed.at, T0);
  // Et le tout rejoue sans erreur.
  const live = sanitizeState(raw, BALANCE, T0);
  assert.doesNotThrow(() => bastionTick(live, T0 + 2 * HOUR));
  assert.equal(live.bastion.research.levels.steel, 3);
});

test('la Renaissance garde le Bastion et ses recherches', () => {
  const s = sanitizeState(JSON.parse(readFileSync('tests/fixtures/endgame.json', 'utf8')), BALANCE, T0);
  s.gold = 1e300; s.materials.shards = 1e6;
  assert.equal(assignWorker(s, 'forge', 'dwarf', T0), null);
  startBuild(s, 'forge', T0);
  bastionTick(s, T0 + HOUR);
  s.bastion.buildings.library.level = 2;
  s.bastion.research.levels = { sharp: 4, purse: 2 };
  const kept = JSON.stringify(s.bastion);
  const power = researchBonuses(s);
  assert.ok(performRebirth(s) > 0);
  assert.equal(s.maxStage, 1);
  assert.equal(JSON.stringify(s.bastion), kept);
  assert.equal(forgeLevel(s), 2);
  assert.deepEqual(researchBonuses(s), power);
  assert.deepEqual(bonusSources(s).research, { damagePct: 8, goldPct: 6 });
  // Le Bastion reste ouvert (étape record), et ses prix suivent le multiplicateur de Renaissance.
  assert.equal(bastionOf(s) !== null && buildingAccess(s, 'forge').available, true);
  assert.ok(goldUnit(s) > 0);
});

test('notification du téléphone : le Bastion annonce la fin de ses travaux (si les notifications sont activées)', () => {
  const s = opened();
  assert.equal(planNotifications(s, T0).some((n) => n.id === 4), false);
  placeOrder(s, 'weapon', 'rare', T0);
  const n = planNotifications(s, T0).find((x) => x.id === 4);
  assert.equal(n.title, 'Le Bastion a fini');
  assert.equal(n.body, 'Commande prête : Arme Rare+');
  assert.equal(n.at, T0 + 2 * HOUR, '1 h de travail à 50 % sans ouvrier');
  s.ui.notify = { ...s.ui.notify, phone: false };
  assert.deepEqual(planNotifications(s, T0), []);
});

// Borne « au plus +25 % de puissance en 7 jours, 2 connexions par jour ». Modèle prudent, sans combat : 14 connexions
// à 12 h d'écart ; à chacune le joueur reçoit 100 000 « ennemis » d'or (le haut de ce que mesure tools/sim-bastion.mjs :
// 25 000 à 100 000) qu'il GARDE d'une connexion à l'autre et donne en entier au Bastion ; éclats illimités ; il lance
// tout ce qu'il peut, puis renforce ses 6 objets Épiques jusqu'au plafond relevé. Trois ordres de dépense.
test('borne : en 7 jours, le Bastion apporte au plus +25 % de puissance (recherches et renforcements au-delà du plafond de base)', () => {
  const plan = (policy) => {
    const s = opened(60);
    const rng = new Rng(11);
    s.gold = 1e40; s.materials.shards = 1e9;
    for (const slot of Object.keys(s.equipment)) {
      const item = generateItem(s, rng, { level: 60, minRarity: 'epic', slot, weights: { epic: 1 } });
      s.equipment[slot] = item;
      s.bastion.buildings.forge.level = 0; // plafond de base pour la référence
      while (upgradeItem(s, item.id, rng));
      s.bastion.buildings.forge.level = 1;
    }
    const cap = () => Object.values(s.equipment).reduce((t, i) => t + i.upgrades, 0);
    assert.equal(cap(), 60);
    const bare = computeHeroStats(s).combatPower;
    assignWorker(s, 'forge', 'dwarf', T0);
    assignWorker(s, 'library', 'priestess', T0);
    s.gold = 0;
    for (let c = 0; c < 14; c++) {
      const now = T0 + c * 12 * HOUR;
      bastionTick(s, now);
      s.gold += 100_000 * goldUnit(s);
      const forge = () => startBuild(s, 'forge', now);
      const research = () => { const pick = ['sharp', 'steel'].sort((a, b) => (s.bastion.research.levels[a] ?? 0) - (s.bastion.research.levels[b] ?? 0)).find((id) => canResearch(s, id).ok); return pick ? startResearch(s, pick, now) : false; };
      startBuild(s, 'library', now);
      // « forge » : tout pour la Forge du forgeron (une recherche seulement quand un chantier vient de partir) ;
      // « research » : les recherches d'abord ; « mixed » : économise pour la Forge niveau 3, puis les recherches.
      if (policy === 'forge') { if (forge()) research(); }
      else if (policy === 'research') { research(); forge(); }
      else if (forgeLevel(s) + (s.bastion.buildings.forge.build ? 1 : 0) < 3) forge();
      else research();
    }
    bastionTick(s, T0 + 7 * 24 * HOUR);
    s.gold = 1e40;
    for (const item of Object.values(s.equipment)) while (upgradeItem(s, item.id, rng));
    return { own: computeHeroStats(s).combatPower / bare - 1, forge: forgeLevel(s), sharp: s.bastion.research.levels.sharp ?? 0, steel: s.bastion.research.levels.steel ?? 0, extra: cap() - 60 };
  };
  for (const policy of ['forge', 'research', 'mixed']) {
    const r = plan(policy);
    assert.ok(r.own > 0.02, `${policy} : le Bastion apporte quelque chose (${JSON.stringify(r)})`);
    assert.ok(r.own <= 0.25, `${policy} : +${(r.own * 100).toFixed(1)} % (${JSON.stringify(r)})`);
    assert.ok(r.forge <= 4, `${policy} : Forge ${r.forge}`);
    if (process.env.BASTION_LOG) console.log(policy, JSON.stringify(r));
  }
});

test('traductions : les textes du Bastion existent en anglais et en coréen', async () => {
  const { lookup: en } = await import('../src/i18n/en.js');
  const { lookup: ko } = await import('../src/i18n/ko.js');
  const { TRADES } = await import('../src/data/bastion.js');
  const s = opened(200);
  const texts = [
    ...BUILDINGS.flatMap((b) => [b.name, b.the, b.role]), ...RESEARCH.flatMap((r) => [r.name, r.text, `${r.text} par niveau`]), ...RESEARCH_BRANCHES.map((b) => b.name),
    ...Object.values(TRADES).map((t) => t.label), ...ORDER_TIERS.map((t) => `Commander (Arme ${t.label})`),
    ...BUILDINGS.map((b) => buildingAccess(s, b.id).reason).filter(Boolean), canBuild(s, 'forge').reason, canResearch(s, 'sharp').reason, canResearch(s, 'steel').reason,
    'Le Bastion a fini 2 chantiers', 'Le Bastion a fini 1 chantier et 3 commandes', 'Commande prête : Arme Épique', 'Chantier terminé : Forge du forgeron niveau 2',
    'Recherche terminée : Lames aiguisées niveau 3', 'Aucun ouvrier : à l\'arrêt', 'Améliorer : niv. 3 → 4', 'tu as 1,2 M', '⏳ Tout avance, même jeu fermé',
    workerNoticeText({ companionId: 'dwarf', building: 'forge', why: 'team', paused: true }), workerNoticeText({ companionId: 'ranger', building: 'mine', why: 'expedition', paused: false }),
    'Les Talents viennent des fragments des Renaissances et sont permanents. Les Recherches avancent avec le temps et ne se perdent pas aux Renaissances.',
  ];
  for (const t of texts) {
    for (const [code, look] of [['en', en], ['ko', ko]]) {
      const r = look(t);
      assert.ok(r && (r !== t || t === 'Combat'), `${code} : « ${t} » → ${r}`); // « Combat » s'écrit pareil en anglais
      assert.doesNotMatch(r, /[àâçéèêëîïôûùœ]/i, `${code} : « ${t} » → ${r}`);
    }
  }
  assert.equal(en('Commande prête : Arme Épique'), 'Order ready: Epic Weapon');
  assert.equal(en('Le Bastion a fini 2 chantiers'), 'The Bastion finished 2 jobs');
});
