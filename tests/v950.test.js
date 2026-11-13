// v9.5.0 : composition — niveau d'équipe partagé, équipe conseillée (vrai combat), rôles lisibles.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewState, sanitizeState } from '../src/core/state.js';
import { companionMultiplier, unitLevel, upgradeCompanion } from '../src/core/companions.js';
import { bestTeam, teamScore } from '../src/core/team-advisor.js';
import { ROLES } from '../src/data/synergies.js';

const NOW = Date.UTC(2026, 10, 12, 12);
const withTeam = () => {
  const s = createNewState(NOW, 5);
  s.maxStage = s.stage = 40; s.level = 30; s.upgrades.damage = 40; s.upgrades.vitality = 40;
  s.companions.owned = { lancer: { stars: 1, level: 9 }, elf_archer: { stars: 1, level: 4 }, witch: { stars: 2, level: 1 }, ninja: { stars: 1, level: 1 }, cat: { stars: 1, level: 3 } };
  s.companions.equipped = ['lancer', 'elf_archer', 'cat'];
  return s;
};

test('v9.5.0 : niveau d\'équipe — migration au plus haut niveau atteint, un remplaçant prend le même niveau', () => {
  const s = sanitizeState(JSON.parse(JSON.stringify(withTeam())), undefined, NOW);
  assert.deepEqual(s.companions.teamLevel, { ally: 9, pet: 3 });
  assert.equal(unitLevel(s, 'witch'), 9, 'banc : même niveau que l\'équipe');
  assert.equal(unitLevel(s, 'lancer'), 9);
  const before = companionMultiplier(s, 'witch');
  s.gold = 1e15;
  assert.ok(upgradeCompanion(s, 'lancer'));
  assert.equal(unitLevel(s, 'ninja'), 10, 'monter un compagnon monte toute l\'équipe');
  assert.ok(companionMultiplier(s, 'witch') > before);
});

test('v9.5.0 : équipe conseillée — essayée en vrai combat, jamais pire que l\'équipe en place', () => {
  const s = sanitizeState(JSON.parse(JSON.stringify(withTeam())), undefined, NOW);
  const r = bestTeam(s);
  assert.ok(r && r.team.length === 3);
  assert.ok(r.score >= r.current * 0.999, `${r.score} < ${r.current}`);
  assert.ok(teamScore(s, r.team) > 0);
});

test('v9.5.0 : chaque rôle dit ce qu\'il fait et contre quoi il est bon', () => {
  for (const r of Object.values(ROLES)) assert.ok(r.does && r.good && r.icon, r.label);
});

test('v9.6.0 : comportements — 2 par monde à partir du monde 2, chacun avec sa parade ; la parade annule le malus', async () => {
  const { BEHAVIORS, ENEMY_BEHAVIOR, zoneBehaviors } = await import('../src/data/behaviors.js');
  const { ZONES } = await import('../src/data/zones.js');
  const { countersFor, behaviorTakenMult, behaviorHitMult } = await import('../src/core/behaviors.js');
  assert.equal(zoneBehaviors(ZONES[0]).length, 0, 'monde 1 sans comportement');
  for (let i = 1; i <= 10; i++) assert.ok(zoneBehaviors(ZONES[i]).length >= 1, `monde ${i + 1}`);
  for (const b of Object.values(ENEMY_BEHAVIOR)) assert.ok(BEHAVIORS[b]?.counter, b);
  const none = countersFor(new Set(), { id: 'knight', style: 'melee' });
  const all = countersFor(new Set(['archer', 'mage', 'assassin', 'berserker', 'guardian']), { id: 'knight', style: 'melee' });
  for (const id of Object.keys(BEHAVIORS)) assert.ok(all[id] && !none[id], id);
  assert.equal(behaviorTakenMult({ behavior: 'shield' }, none, 'attack'), 0.5);
  assert.equal(behaviorTakenMult({ behavior: 'shield' }, all, 'attack'), 1);
  const charger = { behavior: 'charger' };
  assert.equal(behaviorHitMult(charger, none), 2.5);
  assert.equal(behaviorHitMult(charger, none), 1, 'seulement le premier coup');
  assert.ok(countersFor(new Set(), { id: 'archer', style: 'ranged' }).flyer, 'héros à distance : parade des volants');
});

test('v9.6.0 : chaque boss de campagne à partir du monde 2 a une mécanique', async () => {
  const { ZONES } = await import('../src/data/zones.js');
  const { BOSS_TRAITS } = await import('../src/core/boss-traits.js');
  const keyed = (id) => BOSS_TRAITS[id] ?? BOSS_TRAITS[id.replace(/^boss_/, '')] ?? BOSS_TRAITS[`boss_${id}`];
  for (const z of ZONES.slice(1, 11)) for (const id of [...(z.bosses ?? []), ...Object.values(z.tierBosses ?? {})]) assert.ok(keyed(id), `${z.id} : ${id}`);
});

test('v9.6.1 : résonance d\'élément (2 → +10 %, 3 → +25 %) et élément du héros donné par 2 pièces d\'un ensemble', async () => {
  const { elementResonance, heroElement, companionEffects } = await import('../src/core/companions.js');
  const s = createNewState(NOW, 9);
  s.companions.owned = { pyromancer: { stars: 1, level: 1 }, mercenary: { stars: 1, level: 1 }, cat: { stars: 1, level: 1 } };
  s.companions.equipped = ['pyromancer', 'mercenary'];
  assert.equal(elementResonance(s).pct, 10);
  const base = companionEffects(s).damageMultPct ?? 0;
  assert.equal(heroElement(s), null);
  s.equipment.helmet = { id: 9001, set: 'volcano', baseId: 'iron_helm', slot: 'helmet', rarity: 'rare', level: 1, stats: {} };
  s.equipment.armor = { id: 9002, set: 'volcano', baseId: 'chainmail', slot: 'armor', rarity: 'rare', level: 1, stats: {} };
  assert.equal(heroElement(s), 'red', 'ensemble du volcan : Feu');
  assert.equal(elementResonance(s).pct, 25, 'trio de Feu (héros compris)');
  assert.ok((companionEffects(s).damageMultPct ?? 0) > base);
});

test('v9.6.1 : Build attaché à un mode — gardé à la sauvegarde, retrouvé par son contexte', async () => {
  const { sanitizeLoadouts, bindContext, boundLoadout } = await import('../src/core/loadouts.js');
  const raw = [{ name: 'Boss', team: ['lancer'], gear: {}, bind: 'boss' }, { name: 'Feu', team: ['witch'], gear: {}, bind: 'zone:8' }, { name: 'X', team: [], bind: 'n\'importe quoi' }];
  const l = sanitizeLoadouts(raw);
  assert.equal(l[0].bind, 'boss'); assert.equal(l[1].bind, 'zone:8'); assert.equal(l[2].bind, undefined);
  const s = createNewState(NOW); s.loadouts = l;
  assert.equal(boundLoadout(s, bindContext(s, 3, true)), 0);
  assert.equal(boundLoadout(s, bindContext(s, 8, false)), 1);
  assert.equal(boundLoadout(s, bindContext(s, 2, false)), -1);
});

test('v9.6.1 : grands effets d\'objets — gardés à la sauvegarde, un seul actif (l\'arme d\'abord)', async () => {
  const { activeMajor } = await import('../src/core/inventory.js');
  const s = createNewState(NOW);
  s.equipment.ring = { id: 501, baseId: 'iron_ring', slot: 'ring', rarity: 'epic', level: 1, stats: {}, affixes: [], major: 'killHeal' };
  assert.equal(activeMajor(s).id, 'killHeal');
  s.equipment.weapon = { ...s.equipment.weapon, major: 'critSplash' };
  assert.equal(activeMajor(s).id, 'critSplash', 'l\'arme passe devant');
  const out = sanitizeState(JSON.parse(JSON.stringify(s)), undefined, NOW);
  assert.equal(out.equipment.weapon.major, 'critSplash');
});

test('v9.6.2 : itinéraire de donjon — salles, PV et butin selon le choix', async () => {
  const { startDungeon, dungeonRooms, dungeonById, routeHp } = await import('../src/core/dungeon.js');
  const s = createNewState(NOW); s.maxStage = 80; s.keys = 5;
  const d = dungeonById('crypt');
  assert.ok(startDungeon(s, 'crypt', 'any', 'gold', 'easy', 'short'));
  assert.equal(dungeonRooms(s, d), d.rooms - 2);
  assert.equal(routeHp(s), 1.6);
  s.dungeon = null;
  assert.ok(startDungeon(s, 'crypt', 'any', 'gold', 'easy', 'long'));
  assert.equal(dungeonRooms(s, d), d.rooms + 2);
});

test('v9.6.2 : sceaux — porte du boss de fin de monde à partir du monde 3, gagnés par les contenus, jamais bloquant', async () => {
  const { needsSeal, grantSeal, SEALS } = await import('../src/core/seals.js');
  const { createCombat, step, changeStage } = await import('../src/core/combat.js');
  const s = createNewState(NOW, 3);
  assert.equal(needsSeal(s, 20), false, 'monde 1 : pas de sceau');
  assert.equal(needsSeal(s, 60), true, 'monde 3 : sceau requis');
  s.maxStage = 60; const w = createCombat(s); changeStage(s, w, 60);
  assert.equal(s.stage, 59, 'porte scellée : étape d\'avant');
  assert.equal(grantSeal(s), 2);
  assert.equal(needsSeal(s, 60), false);
  const old = createNewState(NOW); old.maxStage = 150; old.records.bestStage = 150;
  const out = sanitizeState(JSON.parse(JSON.stringify(old)), undefined, NOW);
  for (let z = 2; z < 7; z++) assert.ok(out.seals.includes(z), `monde ${z + 1} déjà dépassé : ouvert`);
  assert.ok(SEALS.waitSeconds <= 15 * 60, 'jamais bloquant : sceau accordé après 15 min devant la porte');
});

test('v9.6.3 : compétences manuelles — 3 emplacements, 5 à 10 s, recharge 60 à 120 s, Auto à 60 % de l\'effet', async () => {
  const { RUSHES, RUSH_RULES } = await import('../src/data/rushes.js');
  const { activateRush, rushEffects, rushSlots, setRushSlot, tickRushes } = await import('../src/core/rushes.js');
  for (const r of RUSHES) { assert.ok(r.duration >= 5 && r.duration <= 10, r.id); assert.ok(r.cooldown >= 45 && r.cooldown <= 120, r.id); }
  const s = createNewState(NOW); s.level = 40;
  assert.equal(rushSlots(s).length, RUSH_RULES.slots);
  assert.ok(setRushSlot(s, 0, 'phantom'));
  assert.equal(rushSlots(s)[0], 'phantom');
  activateRush(s, 'rage');
  const manual = rushEffects(s).damagePct;
  tickRushes(s, 200);
  s.rushes.auto = true; s.rushes.slots = ['rage', 'frenzy', 'midas'];
  tickRushes(s, 0.05);
  assert.ok(Math.abs(rushEffects(s).damagePct - manual * 0.6) < 1e-9, 'Auto : 60 %');
});

test('v9.6.3 : boss en phases — attaque lourde annoncée toutes les 8 s, puis affaibli 3 s', async () => {
  const { createCombat, step, changeStage } = await import('../src/core/combat.js');
  const s = createNewState(NOW, 4); s.maxStage = 20; s.level = 60; s.upgrades.vitality = 200; s.upgrades.damage = 5;
  const w = createCombat(s); changeStage(s, w, 20);
  const rng = new (await import('../src/core/rng.js')).Rng(2);
  let heavy = 0, weak = 0;
  for (let i = 0; i < 600; i++) { step(s, w, 0.05, rng); heavy += w.events.filter((e) => e.type === 'bossHeavy').length; weak += w.events.filter((e) => e.type === 'bossWeak').length; w.events.length = 0; }
  assert.ok(heavy >= 2, `attaques lourdes : ${heavy}`);
  assert.ok(weak >= 1, `fenêtres d'affaiblissement : ${weak}`);
});

test('v9.6.3 : 3e place de compagnon au monde 5, rang avant (un Gardien n\'y pare Charge et Kamikaze qu\'au rang avant)', async () => {
  const { teamSlotsOf, clampTeam } = await import('../src/core/companions.js');
  const { teamCounters, frontCompanion } = await import('../src/core/behaviors.js');
  const s = createNewState(NOW);
  assert.equal(teamSlotsOf(s).ally, 2);
  s.maxStage = 81;
  assert.equal(teamSlotsOf(s).ally, 3);
  assert.equal(clampTeam(['lancer', 'witch', 'ninja', 'barbarian'], undefined, s).length, 3);
  s.companions.owned = { witch: { stars: 1, level: 1 }, lancer: { stars: 1, level: 1 } };
  s.companions.equipped = ['witch', 'lancer'];
  assert.equal(frontCompanion(s), 'witch');
  assert.equal(teamCounters(s).charger, false, 'Gardien à l\'arrière');
  s.companions.front = 'lancer';
  assert.equal(teamCounters(s).charger, true, 'Gardien à l\'avant');
});

test('v9.6.5 : objectifs de session, coffre unique, paliers de puissance', async () => {
  const G = await import('../src/core/session-goals.js');
  const { createNewState } = await import('../src/core/state.js');
  const s = createNewState(Date.now());
  s.sessionGoals = G.newSessionGoals(s);
  assert.equal(G.claimSessionChest(s), null);
  s.maxStage += 3; s.records.kills += 150; s.records.bossesDefeated += 2;
  const g0 = s.gems;
  assert.ok(G.claimSessionChest(s));
  assert.equal(s.gems - g0, G.SESSION_CHEST.gems);
  assert.equal(G.claimSessionChest(s), null, 'une seule fois');
  assert.equal(G.powerTier(29), 2);
  assert.ok(Math.abs(G.powerTierMult(30) - 1.09) < 1e-9);
});

test('v9.6.5 (10.2) : fiches monde valides, élément lu dans la fiche', async () => {
  const { validateWorlds } = await import('../tools/validate-worlds.mjs');
  const { zoneElement } = await import('../src/core/elements.js');
  const { ZONES } = await import('../src/data/zones.js');
  assert.deepEqual(validateWorlds(), []);
  ZONES.forEach((z, i) => assert.equal(zoneElement(i), z.element));
  assert.ok(validateWorlds([{ id: 'x', name: 'X', element: 'pink', enemies: ['nope'] }]).length >= 3);
});

test('v9.6.5 (10.3) : un monde programmé reste fermé jusqu\'à son ouverture', async () => {
  const { ZONES } = await import('../src/data/zones.js');
  const { worldClosed } = await import('../src/core/seals.js');
  const now = Date.parse('2026-11-13T00:00:00Z');
  assert.equal(worldClosed(21, now), false);
  ZONES[1].opensAt = '2026-12-01T00:00:00Z';
  try {
    assert.equal(worldClosed(21, now), true);
    assert.equal(worldClosed(22, now), false, 'seule l\'entrée est gardée');
    assert.equal(worldClosed(21, Date.parse('2026-12-02T00:00:00Z')), false);
  } finally { delete ZONES[1].opensAt; }
});

test('v9.6.5 (10.10) : bonus de rattrapage après 3 jours d\'absence', async () => {
  const B = await import('../src/core/boost.js');
  const { createNewState } = await import('../src/core/state.js');
  const now = Date.now();
  const s = createNewState(now);
  assert.equal(B.startCatchUp(s, now - 86400e3, now), false);
  assert.equal(B.catchUpMult(s), 1);
  assert.equal(B.startCatchUp(s, now - 4 * 86400e3, now), true);
  assert.equal(B.catchUpMult(s), 1.5);
  s.playSeconds += B.CATCH_UP.seconds + 1;
  assert.equal(B.catchUpMult(s), 1);
});

test('v9.6.5 (10.11) : mesures anonymes seulement sur accord, sans identifiant', async () => {
  const M = await import('../src/core/metrics.js');
  const { createNewState } = await import('../src/core/state.js');
  const s = createNewState(Date.now());
  const calls = [];
  const fetchFn = async (url, o) => { calls.push([url, JSON.parse(o.body)]); return {}; };
  assert.equal(await M.sendMetrics(s, { fetchFn }), false);
  s.ui.metricsOptIn = true;
  assert.equal(await M.sendMetrics(s, { fetchFn, now: 1e13 }), true);
  assert.deepEqual(Object.keys(calls[0][1]).sort(), ['level', 'minutes', 'version', 'world']);
  assert.equal(await M.sendMetrics(s, { fetchFn, now: 1e13 + 1000 }), false, 'une fois par heure');
});

test('v9.6.5 (10.4) : Failles après le dernier monde, échos d\'or', async () => {
  const C = await import('../src/core/combat.js');
  const { createNewState } = await import('../src/core/state.js');
  assert.equal(C.riftName(1), '');
  assert.equal(C.riftName(231), 'Faille 1');
  const s = createNewState(Date.now());
  assert.equal(C.riftEchoMult(s), 1);
  s.records.bestStage = 231 * 2;
  assert.ok(C.riftEchoMult(s) > 1.1);
});
