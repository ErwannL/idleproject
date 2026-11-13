import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewState, sanitizeState } from '../src/core/state.js';
import { SIGNATURE_ITEMS } from '../src/data/items.js';
import { makeItem } from '../src/core/loot.js';
import { upgradeItem } from '../src/core/forge.js';
import { addToInventory } from '../src/core/inventory.js';
import { Rng } from '../src/core/rng.js';

const NOW = Date.now();

test('v8.2 : « Améliorer » marche aussi sur un objet sans statistique de base (affixes améliorés)', () => {
  const s = createNewState(NOW, 5);
  const base = SIGNATURE_ITEMS.find((b) => b.id === 'void_signet');
  const item = makeItem(s, base.id, 'legendary', 50, undefined, new Rng(3));
  if (!item.affixes.length) item.affixes = [{ type: 'critChance', value: 12 }];
  s.inventory.push(item); // v9.1.3 : addToInventory l'exposerait au Musée
  s.gold = 1e15; s.materials.shards = 1e6;
  const before = item.affixes.map((a) => a.value);
  let ok = 0;
  for (let i = 0; i < 10; i++) if (upgradeItem(s, item.id, new Rng(i + 1))) ok += 1;
  assert.ok(ok >= 5, `améliorations réussies : ${ok}`);
  assert.equal(item.upgrades, ok);
  const after = item.affixes.map((a) => a.value);
  assert.ok(after.some((v, i) => v > before[i]), JSON.stringify({ before, after }));
  const back = sanitizeState(JSON.parse(JSON.stringify(s)));
  const again = back.inventory.find((i) => i.id === item.id);
  assert.deepEqual(again.affixes.map((a) => a.value), after);
});

test('Tour de l\'Éternité : un boss par étage, récompenses seulement aux nouveaux records, défaite = fin', async () => {
  const { startTower, clearTowerFloor, endTower, towerBoss, towerLevel } = await import('../src/core/tower.js');
  const { currentEncounter } = await import('../src/core/combat.js');
  const s = createNewState(NOW, 9);
  assert.equal(startTower(s), false); // verrouillée
  s.maxStage = 60;
  assert.equal(startTower(s), true);
  const enc = currentEncounter(s);
  assert.ok(enc.tower && enc.boss && enc.bosses[0] === towerBoss(1) && enc.level === towerLevel(s, 1));
  const g0 = s.gems;
  const r1 = clearTowerFloor(s);
  assert.ok(r1.record && s.gems > g0 && s.towerBest === 1 && s.tower.floor === 2);
  for (let i = 0; i < 9; i++) clearTowerFloor(s);
  assert.equal(s.towerBest, 10);
  assert.ok(towerBoss(10) && !/^(mini|mid|hard)_/.test(towerBoss(10))); // méga boss tous les 10 étages
  const last = endTower(s);
  assert.equal(last.floors, 10);
  assert.equal(s.tower, null);
  s.towerDay.climbs = 3; // v9.6.2 : ascensions du jour épuisées
  assert.equal(startTower(s), false);
  s.towerWeek.extra = 1; // code TOWERPASS
  assert.equal(startTower(s), true);
  const g1 = s.gems;
  const again = clearTowerFloor(s); // étage 1 déjà battu : pas de récompense
  assert.equal(again.record, false);
  assert.equal(s.gems, g1);
  const back = sanitizeState(JSON.parse(JSON.stringify(s)));
  assert.equal(back.towerBest, 10);
  assert.equal(back.tower.floor, 2);
});
