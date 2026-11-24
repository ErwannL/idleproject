// v10.13 (9) : un objet meilleur seulement pour un compagnon : le conseil nomme le compagnon et peut vraiment l'équiper.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewState } from '../src/core/state.js';
import { adviceScreen, nextAction } from '../src/core/guide.js';
import { makeItem } from '../src/core/loot.js';
import { canEquip, heroGearClass } from '../src/core/classes.js';
import { canEquip as unitCanEquip, equipGear, unitGear } from '../src/core/companion-gear.js';
import { teamUpgradeFor } from '../src/core/inventory.js';
import { COMPANIONS } from '../src/data/companions.js';
import { GEAR_CLASSES, gearClassOf } from '../src/data/companion-gear.js';

const NOW = Date.UTC(2026, 10, 10, 12);
test('objet meilleur seulement pour un compagnon : « Équiper <compagnon> », écran Équipement, et l\'action l\'équipe vraiment', () => {
  const s = createNewState(NOW);
  const unit = COMPANIONS.find((c) => gearClassOf(c) !== heroGearClass(s) && !GEAR_CLASSES[gearClassOf(c)]?.noGear) ?? COMPANIONS[0];
  s.companions.owned[unit.id] = { level: 1 };
  s.companions.equipped = [unit.id];
  const cls = gearClassOf(unit);
  const item = makeItem(s, 'short_sword', 'rare', 1);
  item.cls = cls;
  assert.ok(!canEquip(s, item) && unitCanEquip(s, unit.id, item).ok, 'un objet que seul le compagnon peut porter (classe ' + cls + ')');
  s.inventory.push(item);
  const a = nextAction(s, { claims: [] });
  assert.equal(a.id, 'equip');
  assert.equal(a.action, 'equip-unit');
  assert.equal(a.value, unit.id);
  assert.match(a.text, new RegExp(unit.name));
  assert.equal(adviceScreen(a), 'inventory');
  assert.ok(equipGear(s, a.value, a.itemId), 'équipé');
  assert.ok(Object.values(unitGear(s, unit.id)).some((i) => i?.id === item.id));
});
