import test from 'node:test';
import assert from 'node:assert/strict';
import { SAVE_VERSION, createNewState } from '../src/core/state.js';
import { BACKUP_KEY, SAVE_KEY, loadGame, preMigrationKey, saveGame } from '../src/core/save.js';

const PRE_MIGRATION_PREFIX = preMigrationKey('');

function memory() {
  const map = new Map();
  return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, v), removeItem: (k) => map.delete(k), map };
}

// Le blocage des écritures qui suit (saveBlocked) est dans src/main.js.
test("une sauvegarde d'une version plus récente est signalée sans être chargée ni modifiée", () => {
  const store = memory();
  const future = JSON.stringify({ version: SAVE_VERSION + 5, gold: 999 });
  store.setItem(SAVE_KEY, future);
  const { source, newerVersion } = loadGame(store, undefined, Date.now());
  assert.equal(source, 'newer');
  assert.equal(newerVersion, SAVE_VERSION + 5);
  assert.equal(store.getItem(SAVE_KEY), future);
});

test('avant migration : copie pre-vN créée une fois, jamais réécrite', () => {
  const store = memory();
  const old = JSON.stringify({ ...createNewState(1000), version: 3, gold: 77 });
  store.setItem(SAVE_KEY, old);
  loadGame(store, undefined, 2000);
  const key = `${PRE_MIGRATION_PREFIX}3`;
  assert.equal(store.getItem(key), old);
  store.setItem(SAVE_KEY, JSON.stringify({ ...createNewState(1000), version: 3, gold: 1 }));
  loadGame(store, undefined, 2000);
  assert.equal(store.getItem(key), old, 'la copie d\'origine reste intacte');
});

test('une sauvegarde à la bonne version ne crée aucune copie', () => {
  const store = memory();
  store.setItem(SAVE_KEY, JSON.stringify(createNewState(1000)));
  loadGame(store, undefined, 2000);
  assert.deepEqual([...store.map.keys()].filter((k) => k.startsWith(PRE_MIGRATION_PREFIX)), []);
});

test('sauvegarde normale : écriture avec copie de secours', () => {
  const store = memory();
  const s1 = createNewState(1000);
  assert.equal(saveGame(s1, store, 1000), true);
  const s2 = createNewState(1000);
  assert.equal(saveGame(s2, store, 2000), true);
  assert.ok(store.getItem(BACKUP_KEY));
});
