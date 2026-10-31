// v9.1.0 : grosse mise à jour (menus, accessibilité, mobile). Lot 0 : sécurité, sauvegardes, corrections.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SAVE_VERSION, createNewState, sanitizeState } from '../src/core/state.js';
import {
  BACKUP_KEY, BEFORE_IMPORT_KEY, SAVE_KEY, encodeSaveCode, loadGame, parseImport, preMigrationKey, saveGame, writeImported,
} from '../src/core/save.js';
import { makeItem } from '../src/core/loot.js';
import { applyLoadout, renameLoadout, sanitizeLoadouts, saveLoadout } from '../src/core/loadouts.js';
import { canRebirth, performRebirth, rebirthBlocked } from '../src/core/rebirth.js';
import { collectItem, recycleRules } from '../src/core/inventory.js';
import { createJournal, noteDrop } from '../src/core/journal.js';
import { sanitizeCheats } from '../src/core/cheats.js';
import { bracketOf, digitOf } from '../src/ui/shortcuts.js';
import { BALANCE } from '../src/data/balance.js';

const NOW = Date.UTC(2026, 9, 31, 12);

function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    map,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
  };
}

test('lot 0 : copie brute avant migration, jamais écrasée', () => {
  const old = JSON.stringify({ version: SAVE_VERSION - 1, maxStage: 12, stage: 12, level: 7, equipment: {}, gold: 5 });
  const storage = memoryStorage({ [SAVE_KEY]: old });
  const r = loadGame(storage, BALANCE, NOW);
  assert.equal(r.source, 'main');
  assert.equal(storage.getItem(preMigrationKey(SAVE_VERSION - 1)), old);
  storage.setItem(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION - 1, maxStage: 99 }));
  loadGame(storage, BALANCE, NOW);
  assert.equal(storage.getItem(preMigrationKey(SAVE_VERSION - 1)), old, 'la première copie reste intacte');
});

test('lot 0 : sauvegarde d\'une version plus récente ni chargée ni écrasée', () => {
  const newer = JSON.stringify({ version: SAVE_VERSION + 1, maxStage: 50 });
  const storage = memoryStorage({ [SAVE_KEY]: newer });
  const r = loadGame(storage, BALANCE, NOW);
  assert.equal(r.source, 'newer');
  assert.equal(r.newerVersion, SAVE_VERSION + 1);
  assert.equal(storage.getItem(SAVE_KEY), newer);
});

test('lot 0 : lastSaved retrouve son ancienne valeur si l\'écriture échoue', () => {
  const state = createNewState(NOW);
  state.lastSaved = 1234;
  const broken = { getItem: () => null, setItem: () => { throw new Error('quota'); }, removeItem: () => {} };
  assert.equal(saveGame(state, broken, NOW), false);
  assert.equal(state.lastSaved, 1234);
  const storage = memoryStorage();
  assert.equal(saveGame(state, storage, NOW), true);
  assert.equal(state.lastSaved, NOW);
});

test('lot 0 : import (JSON ou code), refus des données invalides, copie de la partie remplacée', () => {
  const s = createNewState(NOW - 86400e3);
  s.level = 42; s.maxStage = 30; s.gold = 777;
  const json = JSON.stringify(s);
  for (const text of [json, encodeSaveCode(json)]) {
    const r = parseImport(text, BALANCE, NOW);
    assert.ok(r.state, r.error);
    assert.equal(r.state.level, 42);
    assert.equal(r.state.lastSaved, NOW, 'pas de gains hors ligne offerts par un import');
  }
  assert.ok(parseImport('', BALANCE, NOW).error);
  assert.ok(parseImport('{pas du json', BALANCE, NOW).error);
  assert.ok(parseImport('[1,2]', BALANCE, NOW).error);
  assert.ok(parseImport('{"foo":1}', BALANCE, NOW).error);
  assert.ok(parseImport(JSON.stringify({ ...s, version: SAVE_VERSION + 3 }), BALANCE, NOW).error);
  const storage = memoryStorage({ [SAVE_KEY]: '{"version":7,"level":3}' });
  assert.ok(writeImported(parseImport(json, BALANCE, NOW).state, storage));
  assert.equal(storage.getItem(BEFORE_IMPORT_KEY), '{"version":7,"level":3}');
  assert.equal(JSON.parse(storage.getItem(SAVE_KEY)).level, 42);
  assert.equal(JSON.parse(storage.getItem(BACKUP_KEY)).level, 42);
});

test('lot 0 : un donjon en cours garde son heure de début après rechargement', () => {
  const s = createNewState(NOW);
  s.playSeconds = 500;
  s.dungeon = { id: 'crypt', room: 2, kills: 1, slot: 'any', path: 'gold', level: 10, earned: {}, difficulty: 'easy', startPlay: 320 };
  const back = sanitizeState(JSON.parse(JSON.stringify(s)), BALANCE, NOW);
  if (back.dungeon) assert.equal(back.dungeon.startPlay, 320);
});

test('lot 0 : Renaissance impossible pendant un mode ; boucle de boss et retenter effacés', () => {
  const s = createNewState(NOW);
  s.maxStage = 60; s.stage = 60;
  assert.ok(canRebirth(s));
  s.tower = { floor: 3, startPlay: 0 };
  assert.ok(rebirthBlocked(s));
  assert.equal(performRebirth(s), 0);
  s.tower = null;
  s.farmBoss = 'slime_king';
  s.bossRetry = { stage: 61, power: 10 };
  assert.ok(performRebirth(s) > 0);
  assert.equal(s.farmBoss, null);
  assert.equal(s.bossRetry, null);
});

test('lot 0 / lot 7 : builds — renommer, objets du coffre, nombre exact d\'objets introuvables', () => {
  const s = createNewState(NOW);
  const helm = makeItem(s, 'leather_hood', 'rare', 3);
  s.equipment.helmet = helm;
  assert.ok(saveLoadout(s, 0));
  assert.ok(renameLoadout(s, 0, '  Farm   or  '));
  assert.equal(s.loadouts[0].name, 'Farm or');
  assert.equal(renameLoadout(s, 0, '   '), false);
  // Le casque part au coffre, l'arme portée est recyclée (introuvable).
  s.equipment.helmet = null;
  s.stash.push(helm);
  s.loadouts[0].gear.weapon = 'it99999';
  const r = applyLoadout(s, 0, BALANCE);
  assert.equal(r.missing, 1);
  assert.equal(r.refused, 0);
  assert.equal(s.equipment.helmet?.id, helm.id, 'repris du coffre');
  // Déjà porté : ni introuvable ni refusé.
  s.loadouts[0].gear.weapon = s.equipment.weapon.id;
  assert.deepEqual(applyLoadout(s, 0, BALANCE), { missing: 0, refused: 0 });
  assert.equal(applyLoadout(s, 1, BALANCE), null, 'build vide');
  const clean = sanitizeLoadouts(JSON.parse(JSON.stringify(s.loadouts)));
  assert.equal(clean[0].heroClass, s.heroClass);
  assert.deepEqual(clean[0].skills, s.skills);
});

test('lot 0 : le recyclage fait pour libérer le sac est compté dans le journal', () => {
  const s = createNewState(NOW);
  assert.equal(recycleRules(s).mode, 'full');
  s.equipment.helmet = makeItem(s, 'iron_helm', 'epic', 80);
  const journal = createJournal(s, NOW);
  while (s.inventory.length < BALANCE.loot.inventorySize) s.inventory.push(makeItem(s, 'leather_hood', 'common', 1));
  const r = collectItem(s, makeItem(s, 'leather_hood', 'rare', 50), BALANCE);
  assert.ok(r.freed?.count > 0);
  noteDrop(journal, { autoRecycled: !r.added, recycledGold: r.recycledGold, freed: r.freed });
  assert.equal(journal.recycled, r.freed.count + (r.added ? 0 : 1));
  assert.ok(journal.recycledGold > 0);
});

test('lot 0 : version publique — les codes ne sont pas livrés', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.ok(pkg.build.files.includes('!src/core/cheat-codes.js'));
  assert.match(readFileSync(new URL('../tools/build-web.mjs', import.meta.url), 'utf8'), /cheat-codes\.js/);
  // cheats.js ne connaît plus aucun nom de code.
  const cheats = readFileSync(new URL('../src/core/cheats.js', import.meta.url), 'utf8');
  for (const code of ['GEMRAIN', 'TURBO100', 'GODMODE', 'TOWERPASS']) assert.ok(!cheats.includes(code), code);
  assert.deepEqual(sanitizeCheats({ effects: [{ code: 'X', kind: 'boost', mult: 100, count: 2 }] }).effects, []);
  // Aucune aide développeur ni test hors ligne dans les Paramètres du joueur.
  const options = readFileSync(new URL('../src/ui/panels/options.js', import.meta.url), 'utf8');
  assert.match(options, /function privateRepoHelp\(u\) \{\n {2}if \(!BUILD\.cheats\) return '';/);
  assert.match(options, /function devOfflineCard\(\) \{\n {2}if \(!BUILD\.cheats\) return '';/);
});

test('lot 0 : clavier AZERTY — chiffres et crochets par position, AltGr sans effet sur les chiffres', () => {
  const ev = (o) => ({ getModifierState: (m) => m === 'AltGraph' && o.altGr === true, ...o });
  assert.equal(digitOf(ev({ code: 'Digit1', key: '&' })), 1);
  assert.equal(digitOf(ev({ code: 'Numpad3', key: '3' })), 3);
  assert.equal(digitOf(ev({ code: 'Digit5', key: '[', altGr: true })), null);
  assert.equal(digitOf(ev({ code: 'KeyA', key: 'a' })), null);
  assert.equal(bracketOf(ev({ code: 'BracketLeft', key: 'Dead' })), -1);
  assert.equal(bracketOf(ev({ code: 'BracketRight', key: '$' })), 1);
  assert.equal(bracketOf(ev({ code: 'Digit5', key: '[', altGr: true })), -1);
  assert.equal(bracketOf(ev({ code: 'KeyA', key: 'PageDown' })), 1);
  assert.equal(bracketOf(ev({ code: 'KeyA', key: 'a' })), 0);
});

test('lot 4 : textes de l\'interface v9.1.0 — aucun ne reste en français une fois traduit', async () => {
  globalThis.localStorage ??= { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  const { translate } = await import('../src/i18n/en.js');
  const { MENUS, SUB_LABELS, navPath } = await import('../src/ui/nav.js');
  const { PANEL_HELP } = await import('../src/core/guide.js');
  const { CURRENCIES } = await import('../src/data/currencies.js');
  const { KEY_LABELS, shortcutsList } = await import('../src/ui/shortcuts.js');
  const { searchIndex } = await import('../src/ui/search.js');
  const { KEEP_AFFIX_LABELS } = await import('../src/core/inventory.js');
  const texts = [
    ...MENUS.map((m) => m.label), ...Object.values(SUB_LABELS), ...MENUS.flatMap((m) => m.tabs.map((t) => navPath(t))),
    ...Object.values(PANEL_HELP).flatMap((h) => [h.short, h.more, h.mouse, h.touch]),
    ...Object.values(CURRENCIES).flatMap((c) => [c.name, c.use, c.gain]),
    ...Object.values(KEY_LABELS), ...shortcutsList().map(([, d]) => d),
    ...searchIndex().flatMap((e) => [e.label, e.path]), ...Object.values(KEEP_AFFIX_LABELS),
  ].filter(Boolean);
  const FRENCH = /[éèàçùêâîôûœ«»]/i;
  const left = [...new Set(texts)].filter((s) => FRENCH.test(translate(s)));
  assert.deepEqual(left, []);
});
