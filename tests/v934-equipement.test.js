// v9.3.8 (2.5) : le héros revient à 6 places (Arme, Casque, Armure, Collier, Anneau, Bracelet) ; plus de pièces
// réunies. Sauvegardes v11 (7 emplacements) et v12 (3 places, pièces réunies) relues sans perte, format 13.
// Les compagnons gardent leurs 3 places (v9.3.4 f) : ancien sac 9.3.3 converti, règles de classe.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewState, sanitizeState, SAVE_VERSION } from '../src/core/state.js';
import { makeItem, refreshItemStats } from '../src/core/loot.js';
import { sumEquipmentStats } from '../src/core/stats.js';
import { collectBonuses } from '../src/core/bonuses.js';
import { canEquip as heroCanEquip, heroGearClass } from '../src/core/classes.js';
import { canEquip, gearStats, unitGear } from '../src/core/companion-gear.js';
import { equipBest, equipItem } from '../src/core/inventory.js';
import { GEAR_BASES, GEAR_RARITY, GEAR_UP_PCT, gearClassOf } from '../src/data/companion-gear.js';
import { COMPANIONS } from '../src/data/companions.js';
import { HERO_SLOTS, heroSlot } from '../src/data/items.js';
import { BALANCE } from '../src/data/balance.js';

const NOW = Date.UTC(2026, 10, 9);
const load = (raw) => sanitizeState(JSON.parse(JSON.stringify(raw)), BALANCE, NOW);
// Objet « d'avant 9.3.4 » : sans pièces réunies ni classe.
const oldItem = (s, baseId, rarity, level) => { const it = makeItem(s, baseId, rarity, level); delete it.parts; delete it.cls; return it; };
const round = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v).map(([k, v]) => [k, Math.round(v * 1e6) / 1e6]));
const addStats = (acc, it) => { for (const [k, v] of Object.entries(it.stats ?? {})) acc[k] = (acc[k] ?? 0) + v; return acc; };
const allItems = (s) => [...s.inventory, ...s.stash, ...Object.values(s.equipment).filter(Boolean),
  ...Object.values(s.companionGear?.equipped ?? {}).flatMap((x) => Object.values(x))].filter(Boolean);
const allIds = (s) => allItems(s).map((i) => i.id);
// Bonus de plusieurs objets portés chacun seul (base de l'état comptée une seule fois).
function bonusOf(ref, items) {
  const empty = collectBonuses(ref, {});
  const out = { ...empty };
  for (const it of items) {
    const b = collectBonuses(ref, { [heroSlot(it)]: it });
    for (const [k, v] of Object.entries(b)) out[k] += v - empty[k];
  }
  return out;
}
const asPart = (it) => ({ baseId: it.baseId, stats: { ...it.stats }, affixes: it.affixes.map((a) => ({ ...a })), rarity: it.rarity, level: it.level, boosts: { ...it.boosts } });

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

test('v9.3.8 : SAVE_VERSION 13 et 6 places pour le héros', () => {
  assert.equal(SAVE_VERSION, 13);
  assert.deepEqual(Object.keys(HERO_SLOTS), ['weapon', 'helmet', 'armor', 'amulet', 'ring', 'bracelet']);
  assert.deepEqual(Object.keys(createNewState(NOW).equipment), Object.keys(HERO_SLOTS));
});

test('v9.3.8 : sauvegarde v11 (7 emplacements, boucles comprises) → 6 places, aucune perte de puissance', () => {
  const raw = v11Save();
  const old = Object.values(raw.equipment);
  const ref = createNewState(NOW);
  const before = old.reduce(addStats, {});
  const bonusBefore = bonusOf(ref, old);

  const s = load(raw);
  assert.deepEqual(Object.keys(s.equipment), Object.keys(HERO_SLOTS));
  assert.equal(s.equipment.weapon.id, raw.equipment.weapon.id);
  for (const slot of Object.keys(HERO_SLOTS)) {
    const it = s.equipment[slot];
    assert.ok(it, `${slot} porté`);
    assert.equal(heroSlot(it), slot);
    assert.equal(it.parts, undefined, 'plus de pièces réunies');
  }
  // La place du collier est prise : le bijou en trop est rangé (sac ou coffre), jamais perdu.
  const worn = Object.values(s.equipment);
  const extra = [...s.inventory, ...s.stash].filter((it) => old.some((o) => o.baseId === it.baseId) && !worn.includes(it));
  assert.equal(worn.length + extra.length, old.length, 'les 7 anciens objets sont tous là');
  for (const o of old) {
    assert.ok([...worn, ...extra].some((p) => p.baseId === o.baseId && p.rarity === o.rarity && p.level === o.level), `${o.baseId} gardé (rareté, niveau)`);
  }
  const after = extra.reduce(addStats, { ...sumEquipmentStats(s.equipment) });
  assert.deepEqual(round(after), round(before));
  assert.deepEqual(round(bonusOf(ref, [...worn, ...extra])), round(bonusBefore));
  const ids = allIds(s);
  assert.equal(new Set(ids).size, ids.length, 'identifiants uniques');
});

test('v9.3.8 : sauvegarde v12 (3 places, pièces réunies) → casque, armure et bijoux séparés, mêmes statistiques', () => {
  const s0 = createNewState(NOW);
  const helm = makeItem(s0, 'iron_helm', 'rare', 12);
  const armor = makeItem(s0, 'chainmail', 'legendary', 30);
  const ring = makeItem(s0, 'band_ring_ruby', 'epic', 40);
  const jewels = [makeItem(s0, 'necklace_ruby', 'rare', 25), makeItem(s0, 'drop_earrings_ruby', 'epic', 20), makeItem(s0, 'thorn_bracelet_ruby', 'legendary', 10)];
  jewels[2].boosts = { damage: 2 }; jewels[2].upgrades = 2; refreshItemStats(jewels[2], BALANCE); // pièce améliorée
  const pieces = [helm, ...jewels];
  const before = [armor, ring, ...pieces].reduce(addStats, {});
  armor.parts = [asPart(helm)];
  ring.parts = jewels.map(asPart);
  const raw = JSON.parse(JSON.stringify(s0));
  raw.version = 12;
  raw.equipment = { weapon: raw.equipment.weapon, armor, accessory: ring };
  const s = load(raw);
  assert.deepEqual(Object.keys(s.equipment), Object.keys(HERO_SLOTS));
  assert.equal(s.equipment.armor.id, armor.id);
  assert.equal(s.equipment.armor.baseId, 'chainmail');
  assert.equal(s.equipment.helmet.baseId, 'iron_helm');
  assert.equal(s.equipment.ring.id, ring.id);
  assert.equal(s.equipment.amulet.baseId, 'necklace_ruby');
  assert.equal(s.equipment.bracelet.baseId, 'thorn_bracelet_ruby');
  assert.equal(s.equipment.bracelet.upgrades, 2, 'les améliorations de la pièce sont gardées');
  const earring = [...s.inventory, ...s.stash].find((i) => i.baseId === 'drop_earrings_ruby');
  assert.ok(earring, 'boucles rangées (la place du collier est prise)');
  for (const it of allItems(s)) assert.equal(it.parts, undefined);
  for (const p of pieces) {
    const it = [...Object.values(s.equipment), earring].find((x) => x.baseId === p.baseId);
    assert.equal(it.rarity, p.rarity);
    assert.equal(it.level, p.level);
  }
  const after = addStats({ ...sumEquipmentStats({ ...s.equipment, weapon: null }) }, earring); // arme hors comparaison
  assert.deepEqual(round(after), round(before));
  const ids = allIds(s);
  assert.equal(new Set(ids).size, ids.length, 'identifiants uniques');
  // Aller-retour : rien ne bouge.
  const back = load(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(back.equipment, s.equipment);
  assert.equal(back.nextItemId, s.nextItemId);
});

test('v9.3.4 : ancien sac des compagnons (9.3.3) converti — porté reste porté, mêmes bonus, rien de perdu', () => {
  const raw = v11Save();
  const atkUnit = COMPANIONS.find((c) => gearClassOf(c) === 'attacker');
  raw.companions.owned[atkUnit.id] = { stars: 1, level: 1 };
  raw.companions.equipped = [atkUnit.id];
  const worn = { id: 1, baseId: 'warbow', rarity: 'epic', up: 3 };
  const loose = [{ id: 2, baseId: 'plate', rarity: 'rare', up: 0 }, { id: 3, baseId: 'talisman', rarity: 'legendary', up: 7 }];
  raw.companionGear = { bag: [worn, ...loose], nextId: 4, equipped: { [atkUnit.id]: { offense: 1 } } };
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
  assert.equal([...s.inventory, ...s.stash].filter((i) => i.cg).length, 2, 'les 2 pièces libres rangées');
  assert.equal(s.companionGear.bag, undefined);
  const ids = allIds(s);
  assert.equal(new Set(ids).size, ids.length, 'identifiants uniques (pas de collision avec les objets existants)');
});

test('v9.3.4 : objet d\'une autre classe — refusé au héros, porté par un compagnon de cette classe ; « Équiper le meilleur » équipe les deux', () => {
  const s = createNewState(NOW);
  const hero = heroGearClass(s);
  const other = hero === 'defender' ? 'attacker' : 'defender';
  const unit = COMPANIONS.find((c) => gearClassOf(c) === other);
  s.companions.owned[unit.id] = { stars: 1, level: 1 };
  s.companions.equipped = [unit.id];
  s.equipment.armor = null;
  s.equipment.helmet = null;
  const foreign = makeItem(s, 'chainmail', 'legendary', 20); foreign.cls = other;
  const mine = makeItem(s, 'iron_helm', 'rare', 5); mine.cls = hero;
  s.inventory.push(foreign, mine);
  assert.equal(heroCanEquip(s, foreign), false);
  assert.equal(heroCanEquip(s, mine), true);
  assert.equal(canEquip(s, unit.id, foreign).ok, true);
  assert.equal(canEquip(s, unit.id, mine).ok, false);
  const n = equipBest(s);
  assert.ok(n >= 2, String(n));
  assert.equal(s.equipment.helmet.id, mine.id, 'le héros prend l\'objet de sa classe');
  assert.equal(s.equipment.armor, null);
  assert.equal(unitGear(s, unit.id).armor?.id, foreign.id, 'le compagnon prend celui de la sienne');
  assert.ok(!s.inventory.includes(foreign) && !s.inventory.includes(mine));
  // equipItem ne place jamais l'objet d'une autre classe sur le héros.
  const again = makeItem(s, 'chainmail', 'legendary', 30); again.cls = other;
  s.inventory.push(again);
  assert.equal(equipItem(s, again.id), false);
  assert.equal(s.equipment.armor, null);
});
