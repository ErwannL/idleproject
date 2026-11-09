// v9.3.4 (f) : équipement unique — 3 places, pièces réunies, migration des sauvegardes 11 → 12 sans perte.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewState, sanitizeState, SAVE_VERSION } from '../src/core/state.js';
import { makeItem } from '../src/core/loot.js';
import { sumEquipmentStats } from '../src/core/stats.js';
import { collectBonuses } from '../src/core/bonuses.js';
import { canEquip as heroCanEquip, heroGearClass } from '../src/core/classes.js';
import { canEquip, equipGear, gearStats, unitGear } from '../src/core/companion-gear.js';
import { equipBest, equipItem } from '../src/core/inventory.js';
import { GEAR_BASES, GEAR_RARITY, GEAR_UP_PCT, gearClassOf } from '../src/data/companion-gear.js';
import { COMPANIONS } from '../src/data/companions.js';
import { EQUIP_SLOTS } from '../src/data/items.js';
import { BALANCE } from '../src/data/balance.js';

const NOW = Date.UTC(2026, 10, 9);
const load = (raw) => sanitizeState(JSON.parse(JSON.stringify(raw)), BALANCE, NOW);
// Objet « d'avant 9.3.4 » : sans pièces réunies ni classe.
const oldItem = (s, baseId, rarity, level) => { const it = makeItem(s, baseId, rarity, level); delete it.parts; delete it.cls; return it; };
const sumNums = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round(v * 1e6) / 1e6]));
const allIds = (s) => [...s.inventory, ...s.stash, ...Object.values(s.equipment).filter(Boolean),
  ...Object.values(s.companionGear?.equipped ?? {}).flatMap((x) => Object.values(x))].filter(Boolean).map((i) => i.id);

function v11Save() {
  const s = createNewState(NOW);
  const raw = JSON.parse(JSON.stringify(s));
  raw.version = 11;
  raw.equipment = {
    weapon: oldItem(s, 'short_sword', 'epic', 20),
    helmet: oldItem(s, 'iron_helm', 'rare', 12),
    armor: oldItem(s, 'chainmail', 'legendary', 30),
    amulet: oldItem(s, 'necklace_ruby', 'common', 5),
    earring: oldItem(s, 'drop_earrings_ruby', 'epic', 25),
    ring: oldItem(s, 'band_ring_ruby', 'rare', 8),
    bracelet: oldItem(s, 'thorn_bracelet_ruby', 'legendary', 40),
  };
  raw.nextItemId = s.nextItemId;
  delete raw.companionGear;
  return raw;
}

test('v9.3.4 : SAVE_VERSION 12 et 3 places', () => {
  assert.equal(SAVE_VERSION, 12);
  assert.deepEqual(Object.keys(EQUIP_SLOTS), ['weapon', 'armor', 'accessory']);
});

test('v9.3.4 : sauvegarde v11 (casque + armure + 4 bijoux) → 3 places, aucune perte de puissance', () => {
  const raw = v11Save();
  const old = raw.equipment;
  // Totaux « avant » : chaque ancien objet compté seul (comme 7 places).
  const before = { damage: 0, maxHp: 0, armor: 0, attackSpeed: 0 };
  for (const it of Object.values(old)) for (const [k, v] of Object.entries(it.stats)) before[k] = (before[k] ?? 0) + v;
  const ref = createNewState(NOW);
  let bonusBefore = null;
  for (const it of Object.values(old)) {
    const b = collectBonuses(ref, { weapon: it, armor: null, accessory: null });
    bonusBefore = bonusBefore ? Object.fromEntries(Object.entries(b).map(([k, v]) => [k, v + bonusBefore[k]])) : b;
  }
  const empty = collectBonuses(ref, { weapon: null, armor: null, accessory: null });
  bonusBefore = Object.fromEntries(Object.entries(bonusBefore).map(([k, v]) => [k, v - empty[k] * 6])); // base comptée une seule fois

  const s = load(raw);
  assert.deepEqual(Object.keys(s.equipment).sort(), ['accessory', 'armor', 'weapon']);
  assert.equal(s.equipment.weapon.id, old.weapon.id);
  assert.equal(s.equipment.armor.id, old.armor.id);
  assert.deepEqual(s.equipment.armor.parts.map((p) => [p.baseId, p.rarity, p.level]), [['iron_helm', 'rare', 12]]);
  assert.equal(s.equipment.accessory.parts.length, 3);
  const jewels = [old.amulet, old.earring, old.ring, old.bracelet];
  const worn = [s.equipment.accessory, ...s.equipment.accessory.parts];
  for (const j of jewels) assert.ok(worn.some((p) => p.baseId === j.baseId && p.rarity === j.rarity && p.level === j.level), `${j.baseId} gardé (rareté, niveau)`);
  assert.deepEqual(sumNums(sumEquipmentStats(s.equipment)), sumNums(before));
  assert.deepEqual(sumNums(collectBonuses(s)), sumNums(bonusBefore));
  // Rien de dupliqué : identifiants uniques.
  const ids = allIds(s);
  assert.equal(new Set(ids).size, ids.length);
});

test('v9.3.4 : ancien sac des compagnons (9.3.3) converti — porté reste porté, mêmes bonus, rien de perdu', () => {
  const raw = v11Save();
  const atkUnit = COMPANIONS.find((c) => gearClassOf(c) === 'attacker');
  raw.companions.owned[atkUnit.id] = { stars: 1, level: 1 };
  raw.companions.equipped = [atkUnit.id];
  const worn = { id: 1, baseId: 'warbow', rarity: 'epic', up: 3 };
  const loose = [{ id: 2, baseId: 'plate', rarity: 'rare', up: 0 }, { id: 3, baseId: 'talisman', rarity: 'legendary', up: 7 }];
  raw.companionGear = { bag: [worn, ...loose], nextId: 4, equipped: { [atkUnit.id]: { offense: 1 } } };
  const invBefore = raw.inventory.length;
  const s = load(raw);
  const oldStats = (p) => {
    const b = GEAR_BASES.find((x) => x.id === p.baseId);
    const k = GEAR_RARITY[p.rarity].mult * (1 + GEAR_UP_PCT / 100 * p.up);
    return Object.fromEntries(Object.entries(b.stats).map(([st, v]) => [st, Math.round(v * k * 10) / 10]));
  };
  const w = unitGear(s, atkUnit.id).weapon;
  assert.ok(w, 'pièce portée restée portée');
  assert.equal(w.cg, 'warbow');
  assert.equal(w.cls, 'attacker');
  assert.equal(w.upgrades, 3);
  assert.deepEqual(gearStats(w, s), oldStats(worn));
  for (const p of loose) {
    const it = [...s.inventory, ...s.stash].find((i) => i.cg === p.baseId);
    assert.ok(it, `${p.baseId} rangé`);
    assert.equal(it.rarity, p.rarity);
    assert.deepEqual(gearStats(it, s), oldStats(p));
  }
  assert.equal(s.inventory.length, invBefore + 2);
  assert.equal(s.companionGear.bag, undefined);
  const ids = allIds(s);
  assert.equal(new Set(ids).size, ids.length, 'identifiants uniques (pas de collision avec les objets existants)');
});

test('v9.3.4 : aller-retour de sauvegarde — pièces réunies, classe, profil et objets des compagnons', () => {
  const raw = v11Save();
  const atkUnit = COMPANIONS.find((c) => gearClassOf(c) === 'attacker');
  raw.companions.owned[atkUnit.id] = { stars: 1, level: 1 };
  raw.companionGear = { bag: [{ id: 1, baseId: 'ring', rarity: 'rare', up: 2 }], equipped: { [atkUnit.id]: { trinket: 1 } } };
  const s = load(raw);
  const bow = makeItem(s, 'short_sword', 'rare', 10); bow.cls = 'attacker';
  s.inventory.push(bow);
  assert.ok(equipGear(s, atkUnit.id, bow.id));
  const back = load(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(back.equipment, s.equipment);
  assert.deepEqual(back.companionGear, s.companionGear);
  assert.equal(back.companionGear.equipped[atkUnit.id].accessory.cg, 'ring');
  assert.equal(back.companionGear.equipped[atkUnit.id].weapon.cls, 'attacker');
  assert.ok(back.equipment.armor.parts.length && back.equipment.accessory.parts.length);
  assert.equal(back.nextItemId, s.nextItemId);
});

test('v9.3.4 : objet d\'une autre classe — refusé au héros, porté par un compagnon de cette classe ; « Équiper le meilleur » équipe les deux', () => {
  const s = createNewState(NOW);
  const hero = heroGearClass(s);
  const other = hero === 'defender' ? 'attacker' : 'defender';
  const unit = COMPANIONS.find((c) => gearClassOf(c) === other);
  s.companions.owned[unit.id] = { stars: 1, level: 1 };
  s.companions.equipped = [unit.id];
  s.equipment.armor = null;
  const foreign = makeItem(s, 'chainmail', 'legendary', 20); foreign.cls = other;
  const mine = makeItem(s, 'iron_helm', 'rare', 5); mine.cls = hero;
  s.inventory.push(foreign, mine);
  assert.equal(heroCanEquip(s, foreign), false);
  assert.equal(heroCanEquip(s, mine), true);
  assert.equal(canEquip(s, unit.id, foreign).ok, true);
  assert.equal(canEquip(s, unit.id, mine).ok, false);
  const n = equipBest(s);
  assert.ok(n >= 2, String(n));
  assert.equal(s.equipment.armor.id, mine.id, 'le héros prend l\'objet de sa classe');
  assert.equal(unitGear(s, unit.id).armor?.id, foreign.id, 'le compagnon prend celui de la sienne');
  assert.ok(!s.inventory.includes(foreign) && !s.inventory.includes(mine));
  // equipItem ne place jamais l'objet d'une autre classe sur le héros.
  const again = makeItem(s, 'chainmail', 'legendary', 30); again.cls = other;
  s.inventory.push(again);
  equipItem(s, again.id);
  assert.equal(s.equipment.armor.id, mine.id);
});
