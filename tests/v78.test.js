import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewState, sanitizeState } from '../src/core/state.js';
import { unlockedDifficulties } from '../src/core/dungeon.js';
import { DUNGEONS } from '../src/data/dungeons.js';
import { BALANCE } from '../src/data/balance.js';

test('anciennes victoires de donjon débloquent la difficulté Normal', () => {
  const raw = JSON.parse(JSON.stringify(createNewState(0, 1)));
  const id = DUNGEONS[0].id;
  raw.dungeonsCleared = { [id]: 3 };
  delete raw.dungeonBest;
  const s = sanitizeState(raw);
  assert.deepEqual(unlockedDifficulties(s, id), ['easy', 'normal']);
  assert.deepEqual(unlockedDifficulties(s, DUNGEONS[1].id), ['easy']);
});

test('vitesses de combat : ×1 par défaut, les autres débloquées par code (v8.4) et sauvegardées', () => {
  assert.deepEqual(BALANCE.simulation.speeds, [1, 2, 5, 10, 100]);
  const raw = JSON.parse(JSON.stringify(createNewState(0, 1)));
  raw.ui = { ...(raw.ui ?? {}), speed: 5 };
  assert.notEqual(sanitizeState(raw).ui.speed, 5); // pas débloquée
  raw.cheats = { ...raw.cheats, speeds: [5] };
  assert.equal(sanitizeState(raw).ui.speed, 5);
  raw.ui.speed = 7;
  assert.notEqual(sanitizeState(raw).ui.speed, 7);
});

test('version du jeu = package.json, comparaison et lecture de release', async () => {
  const { readFileSync } = await import('node:fs');
  const { GAME_VERSION } = await import('../src/version.js');
  const { compareVersions, parseRelease, updateStatus } = await import('../src/core/update.js');
  assert.equal(GAME_VERSION, JSON.parse(readFileSync(new URL('../package.json', import.meta.url))).version);
  assert.equal(compareVersions('v7.10.0', '7.9.2'), 1);
  assert.equal(compareVersions('7.8.0', 'v7.8'), 0);
  assert.equal(compareVersions('7.7.1', '7.8.0'), -1);
  const rel = parseRelease({ tag_name: 'v7.9.0', html_url: 'https://github.com/x', body: 'notes',
    assets: [{ name: 'latest.yml' }, { name: 'IdleRPG-7.9.0-setup.exe', browser_download_url: 'https://github.com/d.exe', size: 9 }] });
  assert.equal(rel.version, '7.9.0');
  assert.equal(rel.setup.name, 'IdleRPG-7.9.0-setup.exe');
  assert.equal(updateStatus('7.8.0', rel), 'available');
  assert.equal(updateStatus('7.9.0', rel), 'uptodate');
  assert.equal(parseRelease({}), null);
});

test('v8.0 : un objet un peu plus de PV mais bien moins d’armure n’est pas une amélioration ; le sac est trié', async () => {
  const { makeItem } = await import('../src/core/loot.js');
  const { addToInventory, equipItem, isUpgrade, sweepInventory } = await import('../src/core/inventory.js');
  const s = createNewState(0, 1);
  const helm = makeItem(s, 'iron_helm', 'epic', 1);
  helm.stats = { maxHp: 50, armor: 10 };
  addToInventory(s, helm);
  equipItem(s, helm.id);
  const tradeoff = makeItem(s, 'iron_helm', 'rare', 1);
  tradeoff.stats = { maxHp: 55, armor: 1 };
  const better = makeItem(s, 'iron_helm', 'rare', 1);
  better.stats = { maxHp: 60, armor: 11 };
  const locked = makeItem(s, 'iron_helm', 'common', 1);
  locked.stats = { maxHp: 1, armor: 0 };
  locked.locked = true;
  for (const it of [tradeoff, better, locked]) addToInventory(s, it);
  assert.equal(isUpgrade(s, tradeoff), false);
  assert.equal(isUpgrade(s, better), true);
  s.ui.recycle = { mode: 'off', rarities: ['common', 'rare'], slots: ['helmet'] };
  assert.equal(sweepInventory(s).count, 0);
  s.ui.recycle.mode = 'pickup';
  const swept = sweepInventory(s);
  assert.equal(swept.count, 1);
  const ids = s.inventory.map((i) => i.id);
  assert.ok(!ids.includes(tradeoff.id) && ids.includes(better.id) && ids.includes(locked.id));
});
