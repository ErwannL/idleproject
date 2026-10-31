import { BUILD } from '../src/core/build-info.js';
// Ces tests vérifient la logique des codes : ils tournent en version dev (les codes sont absents de la version publique).
BUILD.cheats = true;
import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewState, sanitizeState } from '../src/core/state.js';
import { cheatLoot, cheatMultiplier, cheatTimes } from '../src/core/cheats.js';
import { applyCheat, removeCheat } from '../src/core/cheat-codes.js';
import { earlyBoost } from '../src/core/boost.js';
import { computeHeroStats } from '../src/core/stats.js';
import { BALANCE } from '../src/data/balance.js';

const NOW = Date.now();

test('codes de triche cumulables : ×100 puis ×100 = ×10 000, sans durée, N fois d\'un coup, retrait', () => {
  const s = createNewState(NOW, 3);
  assert.ok(applyCheat(s, 'turbo100'));
  assert.ok(applyCheat(s, 'TURBO100'));
  assert.equal(cheatMultiplier(s, 'boost'), 10000);
  assert.equal(earlyBoost(s, BALANCE, NOW + 3 * 3600 * 1000).cheat, 10000, 'toujours actif des heures après');
  removeCheat(s, 'TURBO100', 1);
  assert.equal(cheatMultiplier(s, 'boost'), 100);
  // 100 millions de fois : plafonné, jamais Infinity.
  applyCheat(s, 'TURBO1000', '100 000 000');
  assert.equal(s.cheats.effects.find((e) => e.code === 'TURBO1000').count, 1e8);
  assert.equal(cheatMultiplier(s, 'boost'), 1e60);
  const gems = s.gems;
  applyCheat(s, 'DIAMONDS', 1e8);
  assert.equal(s.gems, gems + 1e12);
  removeCheat(s, 'TURBO1000');
  assert.equal(cheatMultiplier(s, 'boost'), 100);
  assert.equal(cheatTimes('abc'), 1);
  assert.equal(cheatTimes('5000000000'), 1e9);
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
  assert.equal(cheatMultiplier(s, 'boost'), 100);
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
