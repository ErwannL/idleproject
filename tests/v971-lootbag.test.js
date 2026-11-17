// v9.7.1 : sac de butin de la scène — ramassage, plein, sac et coffre pleins, verrouillés, règles retenues,
// hors ligne, anciennes sauvegardes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { BALANCE } from '../src/data/balance.js';
import { createNewState, sanitizeState } from '../src/core/state.js';
import { collectItem, LOOT_BAG_MAX, lootBagKeepBestChoices, recycleRules, sortLootBag } from '../src/core/inventory.js';
import { makeItem } from '../src/core/loot.js';

const NOW = 1_700_000_000_000;
const fresh = () => { const s = createNewState(NOW); s.ui.autoUseless = false; return s; };

test('ramassage : l\'objet attend dans le sac de butin', () => {
  const s = fresh();
  const it = makeItem(s, 'iron_helm', 'rare', 5);
  const r = collectItem(s, it);
  assert.ok(r.bagged);
  assert.deepEqual(s.lootBag, [it]);
  assert.ok(!s.inventory.includes(it));
});

test('sac de butin plein : comportement habituel (sac)', () => {
  const s = fresh();
  for (let i = 0; i < LOOT_BAG_MAX; i++) s.lootBag.push(makeItem(s, 'iron_helm', 'common', 1));
  const it = makeItem(s, 'iron_helm', 'rare', 5);
  const r = collectItem(s, it);
  assert.ok(!r.bagged);
  assert.ok(s.inventory.includes(it));
});

test('tri : sac, coffre, recyclage ; sac plein → coffre ; rien n\'est perdu', () => {
  const s = fresh();
  s.stash ??= [];
  const a = makeItem(s, 'iron_helm', 'rare', 5), b = makeItem(s, 'iron_helm', 'rare', 5), c = makeItem(s, 'iron_helm', 'common', 1);
  s.lootBag.push(a, b, c);
  const gold = s.gold;
  while (s.inventory.length < BALANCE.loot.inventorySize - 1) s.inventory.push(makeItem(s, 'iron_helm', 'common', 1));
  const r = sortLootBag(s, { [a.id]: 'bag', [b.id]: 'bag', [c.id]: 'recycle' });
  assert.equal(s.lootBag.length, 0);
  assert.equal(r.bag, 1);
  assert.equal(r.stash + r.held, 1);
  assert.equal(r.recycled, 1);
  assert.ok(s.gold > gold);
  const all = [...s.inventory, ...s.stash, ...(s.held ?? []), ...(s.heldItems ?? [])];
  assert.ok(all.includes(a) && (all.includes(b) || r.held === 1));
});

test('objet verrouillé : jamais recyclé par le tri', () => {
  const s = fresh();
  const it = makeItem(s, 'iron_helm', 'common', 1); it.locked = true;
  s.lootBag.push(it);
  const r = sortLootBag(s, { [it.id]: 'recycle' });
  assert.equal(r.recycled, 0);
  assert.equal(s.lootBag.length, 0);
});

test('« Retenir » : le choix devient la règle de recyclage au ramassage', () => {
  const s = fresh();
  const it = makeItem(s, 'iron_helm', 'common', 1);
  s.equipment.helmet = makeItem(s, 'iron_helm', 'legendary', 50);
  s.lootBag.push(it);
  sortLootBag(s, { [it.id]: 'recycle' }, { remember: true });
  const rules = recycleRules(s);
  assert.equal(rules.mode, 'pickup');
  assert.ok(rules.rarities.includes('common'));
});

test('« Tout recycler sauf les meilleurs » garde les améliorations', () => {
  const s = fresh();
  s.equipment.helmet = null;
  const up = makeItem(s, 'iron_helm', 'epic', 10);
  s.lootBag.push(up);
  assert.equal(lootBagKeepBestChoices(s)[up.id], 'bag');
});

test('sauvegarde : le sac de butin est relu ; anciennes sauvegardes : vide', () => {
  const s = fresh();
  s.lootBag.push(makeItem(s, 'iron_helm', 'rare', 5));
  const back = sanitizeState(JSON.parse(JSON.stringify(s)), BALANCE, NOW);
  assert.equal(back.lootBag.length, 1);
  const old = JSON.parse(JSON.stringify(s)); delete old.lootBag;
  assert.deepEqual(sanitizeState(old, BALANCE, NOW).lootBag, []);
});
