// v9.1.3 (doc3, lot 1 « base propre ») : aucun objet payé ou verrouillé perdu, faille d'or, cohérence.
// Un test à graine fixe par source de butin : combat, hors ligne, donjon, Forge, fusion, événements, Prime, classe.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewState, sanitizeState } from '../src/core/state.js';
import { BALANCE } from '../src/data/balance.js';
import { generateItem, itemPower, makeItem, recycleLevelOf, recycleValue } from '../src/core/loot.js';
import { addToInventory, collectItem, recycleItem, sweepInventory, toggleLock } from '../src/core/inventory.js';
import { autoFuse, craftItem, fuseItems, fusionKeep, reforgeItem, upgradeItem } from '../src/core/forge.js';
import { autoStashSet, bestSetPiece, placeItem, STASH_SIZE, storeItem, wearSet } from '../src/core/stash.js';
import { heroSlot } from '../src/data/items.js';
import { autoMuseum, exposeAll, museumBetter } from '../src/core/museum.js';
import { buyFromMerchant, claimEvent, dismissEvent } from '../src/core/events.js';
import { claimBounty, dailyBounty } from '../src/core/bounty.js';
import { completeDungeon } from '../src/core/dungeon.js';
import { applyOfflineRewards } from '../src/core/offline.js';
import { setHeroClass } from '../src/core/classes.js';
import { performRebirth } from '../src/core/rebirth.js';
import { Rng } from '../src/core/rng.js';

const NOW = new Date(2026, 9, 21, 10).getTime();
const fill = (s, n, f) => { while (s.inventory.length < n) s.inventory.push(f()); };
const fullBag = (s) => fill(s, BALANCE.loot.inventorySize, () => makeItem(s, 'short_sword', 'epic', 1)); // hors règle de recyclage par défaut
const fullStash = (s) => { while (s.stash.length < STASH_SIZE) s.stash.push(makeItem(s, 'iron_helm', 'common', 1)); };
const opened = (seed) => { const s = createNewState(NOW, seed); s.records.bestStage = 60; s.maxStage = 60; return s; };
const everywhere = (s) => [...s.inventory, ...s.stash, ...Object.values(s.equipment), ...Object.values(s.museum), ...s.inbox.map((e) => e.item)].filter(Boolean);

test('doc3 lot 1 : constante du coffre unique (balance) et store partagée avec le Musée', () => {
  assert.equal(STASH_SIZE, BALANCE.loot.stashSize);
  const s = opened(1);
  fullBag(s);
  const it = makeItem(s, 'iron_helm', 'rare', 5);
  assert.equal(storeItem(s, it), 'stash');
  fullStash(s);
  assert.equal(storeItem(s, makeItem(s, 'iron_helm', 'rare', 5)), false);
  assert.equal(placeItem(s, makeItem(s, 'iron_helm', 'rare', 5)), 'held');
  assert.equal(s.inbox.at(-1).type, 'held');
  assert.equal(dismissEvent(s, s.inbox.at(-1).id), false, 'un objet en attente ne se jette pas');
});

test('source combat : sac plein → recyclage complet (or + éclats), ancestral et pièce utile au coffre', () => {
  const s = opened(2);
  s.ui.autoMuseum = false;
  fullBag(s);
  const shards = s.materials.shards;
  const common = generateItem(s, new Rng(1), { level: 20 });
  delete common.set;
  const r = collectItem(s, common);
  assert.equal(r.recycled, true);
  assert.ok(r.recycledGold > 0 && s.materials.shards > shards, 'or et éclats');
  const anc = makeItem(s, 'lich_blade', 'epic', 20);
  assert.equal(collectItem(s, anc).stored, true);
  assert.ok(s.stash.some((i) => i.id === anc.id));
  // Pièce utile : ensemble commencé (casque porté), arme de la classe meilleure que tout autre.
  s.ui.autoMannequin = false;
  s.equipment.helmet = makeItem(s, 'iron_helm', 'rare', 5, BALANCE, null, 'forest');
  s.stash.push(makeItem(s, 'chainmail', 'rare', 5, BALANCE, null, 'forest'));
  const piece = makeItem(s, 'short_sword', 'rare', 5, BALANCE, null, 'forest');
  assert.equal(collectItem(s, piece).stored, true);
});

test('source hors ligne : pièces d\'ensemble possibles, rien de perdu sac plein, rangés ≠ recyclés', () => {
  const s = opened(3);
  s.ui.autoMuseum = false;
  fullBag(s);
  const rng = new Rng(5);
  const items = Array.from({ length: 400 }, () => generateItem(s, rng, { level: 60, setZone: 2 }));
  assert.ok(items.some((i) => i.set), 'des pièces d\'ensemble');
  items.push(makeItem(s, 'lich_blade', 'legendary', 60));
  const before = everywhere(s).length;
  const out = applyOfflineRewards(s, { gold: 0, kills: 0, gems: 0, xp: 0, items, excessDrops: 0, excessGold: 0 });
  const kept = everywhere(s).length - before;
  assert.equal(kept + out.autoRecycledCount, items.length, 'chaque objet est rangé ou recyclé, une seule fois');
  assert.ok(everywhere(s).some((i) => i.baseId === 'lich_blade'), 'ancestral gardé');
});

test('source donjon : récompense reçue même sac et coffre pleins (en attente)', () => {
  const s = opened(4);
  fullBag(s);
  fullStash(s);
  s.dungeon = { id: 'crypt', room: 6, kills: 0, slot: 'helmet', path: 'gold', level: 40, earned: {}, difficulty: 'easy', startPlay: 0 };
  const r = completeDungeon(s, new Rng(9));
  assert.ok(everywhere(s).some((i) => i.id === r.item.id), 'la récompense n\'a pas disparu');
});

test('source Forge : fabrication refusée sac plein, la Forge voit le coffre, relance garde les renforcements', () => {
  const s = opened(5);
  s.gold = 1e12; s.materials.shards = 1e6;
  fullBag(s);
  assert.equal(craftItem(s, 'helmet', new Rng(1)), null, 'rien de payé sans place');
  const it = makeItem(s, 'necklace_ruby', 'epic', 30, BALANCE, new Rng(2));
  s.stash.push(it);
  assert.ok(upgradeItem(s, it.id, new Rng(3)), 'renforcer au coffre');
  assert.equal(toggleLock(s, it.id), true, 'verrouiller au coffre');
  // Relance : un renforcement d'effet reste appliqué aussitôt.
  const w = makeItem(s, 'short_sword', 'epic', 30, BALANCE, new Rng(4));
  w.boosts = { 'affix:0': 3 }; w.upgrades = 3;
  s.stash.push(w);
  assert.ok(reforgeItem(s, w.id, new Rng(5)));
  assert.ok(Number.isFinite(w.affixes[0].base), 'valeur d\'origine mémorisée');
  assert.ok(w.affixes[0].value > w.affixes[0].base, 'bonus de renforcement visible tout de suite');
});

test('source fusion : protège « garder si tel effet », renforcés ; l\'objet fusionné est reçu', () => {
  const s = opened(6);
  s.ui.recycle = { mode: 'pickup', rarities: ['common', 'rare'], slots: ['helmet'], keepAffixes: ['goldPct'] };
  s.ui.autoFuse = { on: true, rarities: ['rare'] };
  s.equipment.helmet = makeItem(s, 'iron_helm', 'legendary', 200); // v9.3.8 : de nouveau sa place
  const rng = new Rng(7);
  for (let i = 0; i < 5; i++) {
    const h = makeItem(s, 'iron_helm', 'rare', 1, BALANCE, rng);
    h.affixes = [{ type: 'goldPct', value: 5 }];
    s.inventory.push(h);
  }
  assert.ok(fusionKeep(s)(s.inventory[0]));
  assert.equal(autoFuse(s, rng).length, 0, 'fusion auto : effet gardé');
  assert.equal(sweepInventory(s).count, 0, 'balayage : effet gardé');
  for (const h of s.inventory) h.affixes = [{ type: 'thorns', value: 5 }];
  const made = fuseItems(s, 'helmet', 'rare', rng, BALANCE, fusionKeep(s));
  assert.ok(made?.ok && s.inventory.some((i) => i.id === made.item.id)); // v9.1.3 (doc3 lot 2) : { ok, item }
});

test('source événements : coffre et marchand passent au coffre quand le sac est plein, refus si tout est plein', () => {
  const s = opened(7);
  fullBag(s);
  const item = makeItem(s, 'iron_helm', 'epic', 10);
  s.inbox.push({ id: 1, type: 'chest', item, reward: { gold: 1 } }, { id: 2, type: 'merchant', item: makeItem(s, 'iron_helm', 'epic', 10), price: 10 });
  assert.ok(claimEvent(s, 1));
  assert.ok(s.stash.some((i) => i.id === item.id));
  fullStash(s);
  s.gold = 100;
  assert.equal(buyFromMerchant(s, 2), false, 'rien de payé sans place');
  assert.equal(s.gold, 100);
});

test('source Prime : la pièce gagnée n\'est jamais recyclée (sac plein → coffre)', () => {
  const s = opened(8);
  s.ui.recycle = { mode: 'pickup', rarities: ['common', 'rare', 'epic', 'legendary'], slots: ['weapon', 'helmet', 'armor', 'amulet', 'earring', 'ring', 'bracelet'] };
  s.ui.autoMannequin = false;
  fullBag(s);
  const b = dailyBounty(s, NOW);
  s.codex.kills[b.type] = b.start + b.target;
  const r = claimBounty(s, new Rng(3), NOW);
  assert.ok(everywhere(s).some((i) => i.id === r.item.id));
});

test('source classe : ancestral sans perte (sac et coffre pleins), arme reforgée avec effets et renforcements', () => {
  const s = opened(9);
  s.maxStage = 400; s.records.bestStage = 400;
  const anc = makeItem(s, 'lich_blade', 'legendary', 50);
  anc.upgrades = 2; anc.boosts = { damage: 2 };
  s.equipment.weapon = anc;
  fullBag(s); fullStash(s);
  const r = setHeroClass(s, 'archer', itemPower);
  assert.ok(r.reforged);
  assert.ok(s.inbox.some((e) => e.type === 'held' && e.item.id === anc.id), 'ancestral en attente');
  assert.equal(s.equipment.weapon.upgrades, 2);
  assert.deepEqual(s.equipment.weapon.affixes, anc.affixes);
  assert.notEqual(s.equipment.weapon.id, anc.id);
  // Sauvegarde : l'objet en attente survit au chargement, même au-delà de la limite de la boîte.
  for (let i = 0; i < 12; i++) s.inbox.unshift({ id: 1000 + i, type: 'gems', reward: { gems: 1 } });
  const back = sanitizeState(JSON.parse(JSON.stringify(s)));
  assert.ok(back.inbox.some((e) => e.type === 'held' && e.item.id === anc.id));
});

test('chargement : un sac au-delà de 100 objets n\'est plus rogné (surplus au coffre)', () => {
  const s = opened(10);
  fill(s, BALANCE.loot.inventorySize + 3, () => makeItem(s, 'short_sword', 'common', 1));
  const back = sanitizeState(JSON.parse(JSON.stringify(s)));
  assert.equal(back.inventory.length + back.stash.length, BALANCE.loot.inventorySize + 3);
});

test('itemPower normalisé par valeur de base : Collier et Pendentif comparables', () => {
  const s = opened(11);
  const neck = makeItem(s, 'necklace_ruby', 'epic', 10);
  const pend = makeItem(s, 'pendant_ruby', 'epic', 10);
  const ratio = itemPower(neck) / itemPower(pend);
  assert.ok(ratio > 0.8 && ratio < 1.25, `rapport ${ratio}`);
});

test('Musée : remplacement à la rareté puis à la puissance', () => {
  const s = opened(12);
  const leg = makeItem(s, 'lich_blade', 'legendary', 10);
  const epicHigh = makeItem(s, 'lich_blade', 'epic', 300);
  assert.ok(itemPower(epicHigh) > itemPower(leg));
  assert.equal(museumBetter(epicHigh, leg), false);
  assert.ok(autoMuseum(s, leg));
  assert.equal(autoMuseum(s, epicHigh), false, 'un Épique ne chasse pas un Légendaire');
  s.inventory.push(epicHigh);
  assert.equal(exposeAll(s), 0);
  assert.equal(s.museum.lich_blade.id, leg.id);
});

test('garde de la meilleure pièce : verrou, renforcement et classe respectés ; Porter vérifie la classe', () => {
  const s = opened(13);
  const old = makeItem(s, 'chainmail', 'rare', 5, BALANCE, null, 'forest');
  old.locked = true;
  s.stash.push(old);
  const better = makeItem(s, 'chainmail', 'epic', 20, BALANCE, null, 'forest');
  assert.equal(autoStashSet(s, better), null, 'ancienne verrouillée gardée');
  assert.ok(s.stash.includes(old) && s.stash.includes(better));
  better.upgrades = 1;
  const best = makeItem(s, 'chainmail', 'legendary', 30, BALANCE, null, 'forest');
  assert.equal(autoStashSet(s, best), null, 'ancienne renforcée gardée');
  const bow = makeItem(s, 'short_bow', 'legendary', 30, BALANCE, null, 'forest');
  assert.equal(autoStashSet(s, bow), false, 'arme d\'une autre classe');
  s.stash.push(bow);
  assert.equal(bestSetPiece(s, 'forest', 'weapon'), null);
  const sword = s.equipment.weapon;
  wearSet(s, 'forest');
  assert.equal(s.equipment.weapon.id, sword.id, 'l\'arc n\'est pas porté');
});

test('faille d\'or : recyclage plafonné à l\'étape max de la partie en cours', () => {
  const s = opened(14);
  s.maxStage = 200; s.records.bestStage = 200;
  const epic = makeItem(s, 'iron_helm', 'epic', 200);
  const full = recycleValue(epic);
  assert.equal(recycleValue(epic, BALANCE, recycleLevelOf(s)), full, 'recyclage normal intact');
  s.stage = 200;
  performRebirth(s);
  assert.ok(s.maxStage < 10);
  s.inventory.push(epic);
  const gold = recycleItem(s, epic.id);
  assert.ok(gold > 0 && gold < full / 1e3, `après Renaissance : ${gold} au lieu de ${full}`);
});

test('24 h simulées sac plein : aucun objet payé ou verrouillé perdu', () => {
  const s = opened(15);
  s.ui.recycle = { mode: 'pickup', rarities: ['common', 'rare'], slots: ['weapon', 'helmet', 'armor', 'amulet', 'earring', 'ring', 'bracelet'] };
  fullBag(s);
  for (const i of s.inventory.slice(0, 10)) i.locked = true;
  const locked = s.inventory.filter((i) => i.locked).map((i) => i.id);
  const rng = new Rng(24);
  const paid = [];
  // ~1 objet libre par 2 s et un objet payé toutes les 5 min, pendant 24 h (en accéléré).
  for (let t = 0; t < 24 * 3600; t += 2) {
    collectItem(s, generateItem(s, rng, { level: 60, setZone: 2 }));
    if (t % 300 === 0) {
      const it = generateItem(s, rng, { level: 60, minRarity: 'epic', setZone: 2 });
      paid.push(it);
      addToInventory(s, it);
    }
    if (t % 3600 === 0) { sweepInventory(s); autoFuse(s, rng); }
  }
  const ids = new Set(everywhere(s).map((i) => i.id));
  const lost = paid.filter((it) => !ids.has(it.id));
  // Seul recyclage permis d'un objet payé : la garde automatique de la meilleure pièce d'ensemble (réglage du coffre),
  // quand une pièce strictement meilleure du même ensemble et du même emplacement l'a remplacée.
  for (const it of lost) {
    const best = bestSetPiece(s, it.set, heroSlot(it)); // v9.3.8 : boucles et collier partagent une place
    assert.ok(it.set && best && itemPower(best) > itemPower(it), `objet payé perdu : ${it.name}`);
  }
  assert.ok(paid.length > 280);
  for (const id of locked) assert.ok(ids.has(id), 'objet verrouillé conservé');
});
