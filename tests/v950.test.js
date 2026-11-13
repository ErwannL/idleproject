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
