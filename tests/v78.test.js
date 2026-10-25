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

test('vitesses de combat ×1 ×2 ×5 ×10 sauvegardées', () => {
  assert.deepEqual(BALANCE.simulation.speeds, [1, 2, 5, 10]);
  const raw = JSON.parse(JSON.stringify(createNewState(0, 1)));
  raw.ui = { ...(raw.ui ?? {}), speed: 5 };
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
