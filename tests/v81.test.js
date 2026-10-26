import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewState, sanitizeState } from '../src/core/state.js';
import { applyCheat, cheatLoot, cheatMultiplier } from '../src/core/cheats.js';
import { earlyBoost } from '../src/core/boost.js';
import { computeHeroStats } from '../src/core/stats.js';
import { BALANCE } from '../src/data/balance.js';

const NOW = Date.now();

test('codes de triche cumulables : ×100 puis ×100 = ×10 000, chacun avec sa minuterie', () => {
  const s = createNewState(NOW, 3);
  assert.ok(applyCheat(s, 'turbo100', NOW));
  assert.ok(applyCheat(s, 'TURBO100', NOW + 1000));
  assert.equal(cheatMultiplier(s, 'boost', NOW + 2000), 10000);
  assert.equal(earlyBoost(s, BALANCE, NOW + 2000).cheat, 10000);
  assert.equal(cheatMultiplier(s, 'boost', NOW + 3600 * 1000 + 500), 100); // le 1er a expiré
  assert.equal(cheatMultiplier(s, 'boost', NOW + 3 * 3600 * 1000), 1);
});

test('codes : dégâts, PV, butin et dons', () => {
  const s = createNewState(NOW, 3);
  const before = computeHeroStats(s);
  applyCheat(s, 'BERSERK');
  applyCheat(s, 'GODMODE');
  const after = computeHeroStats(s);
  assert.ok(Math.abs(after.damage / before.damage - 1000) < 1e-6);
  assert.ok(Math.abs(after.maxHp / before.maxHp - 100) < 1e-6);
  applyCheat(s, 'LOOTSTORM');
  applyCheat(s, 'JACKPOT');
  assert.deepEqual(cheatLoot(s), { drop: 1, minRarity: 'legendary' });
  const gems = s.gems;
  applyCheat(s, 'GEMRAIN');
  assert.equal(s.gems, gems + 1000);
  const back = sanitizeState(JSON.parse(JSON.stringify(s)));
  assert.equal(cheatMultiplier(back, 'damage'), 1000);
  applyCheat(back, 'RESETCODES');
  assert.equal(cheatMultiplier(back, 'damage'), 1);
});

test('ancien format de code (v8.0) conservé', () => {
  const raw = JSON.parse(JSON.stringify(createNewState(NOW, 3)));
  raw.cheats = { boostUntil: NOW + 60000, boostMultiplier: 100, reveal: true };
  const s = sanitizeState(raw);
  assert.equal(cheatMultiplier(s, 'boost', NOW), 100);
  assert.ok(s.cheats.reveal);
});

test('donjon : rapport de défaite (salle, PV du boss) et meilleure tentative', async () => {
  const { startDungeon, failDungeon, dungeonRunInfo } = await import('../src/core/dungeon.js');
  const { DUNGEONS } = await import('../src/data/dungeons.js');
  const s = createNewState(NOW, 3);
  s.maxStage = 999; s.keys = 5;
  const id = DUNGEONS[0].id;
  startDungeon(s, id, 'any', 'gold', 'easy');
  s.dungeon.room = 3;
  failDungeon(s);
  startDungeon(s, id, 'any', 'gold', 'easy');
  s.dungeon.room = DUNGEONS[0].rooms;
  failDungeon(s, { bossHpPct: 34.5 });
  startDungeon(s, id, 'any', 'gold', 'easy');
  s.dungeon.room = 2;
  failDungeon(s);
  const info = dungeonRunInfo(s, id, 'easy');
  assert.equal(info.tries, 3);
  assert.equal(info.last.room, 2);
  assert.equal(info.best.bossHpPct, 34.5);
  assert.ok(info.best.gear.length >= 1);
  const back = sanitizeState(JSON.parse(JSON.stringify(s)));
  assert.equal(dungeonRunInfo(back, id, 'easy').best.bossHpPct, 34.5);
});

test('mise à jour : source de secours (liste des tags jsDelivr)', async () => {
  const { parseTagList } = await import('../src/core/update.js');
  const r = parseTagList({ versions: [{ version: '7.9.0' }, { version: '8.0.0' }, { version: '7.10.0' }, { version: 'latest' }] });
  assert.equal(r.version, '8.0.0');
  assert.equal(r.setup.url, 'https://github.com/ErwannL/idleproject/releases/download/v8.0.0/IdleRPG-8.0.0-setup.exe');
  assert.equal(parseTagList({ versions: [] }), null);
});

test('fusion automatique : 5 objets identiques → rareté supérieure, verrouillés et améliorations protégés', async () => {
  const { makeItem } = await import('../src/core/loot.js');
  const { addToInventory, isUpgrade } = await import('../src/core/inventory.js');
  const { autoFuse } = await import('../src/core/forge.js');
  const { Rng } = await import('../src/core/rng.js');
  const s = createNewState(NOW, 3);
  const strong = makeItem(s, 'iron_helm', 'legendary', 50);
  s.equipment.helmet = strong;
  for (let i = 0; i < 6; i++) addToInventory(s, makeItem(s, 'leather_hood', 'common', 1));
  s.inventory[0].locked = true;
  assert.equal(autoFuse(s, new Rng(1), isUpgrade).length, 0); // désactivée
  s.ui.autoFuse = { on: true, rarities: ['common'] };
  const made = autoFuse(s, new Rng(1), isUpgrade);
  assert.equal(made.length, 1);
  assert.equal(made[0].rarity, 'rare');
  assert.ok(s.inventory.some((i) => i.locked)); // le verrouillé reste
  assert.equal(s.inventory.filter((i) => i.rarity === 'common').length, 1);
});
