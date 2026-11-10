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
  s.equipment.armor = helm; // v9.3.4 : le casque occupe la place « armure »
  assert.ok(saveLoadout(s, 0));
  assert.ok(renameLoadout(s, 0, '  Farm   or  '));
  assert.equal(s.loadouts[0].name, 'Farm or');
  assert.equal(renameLoadout(s, 0, '   '), false);
  // Le casque part au coffre, l'arme portée est recyclée (introuvable).
  s.equipment.armor = null;
  s.stash.push(helm);
  s.loadouts[0].gear.weapon = 'it99999';
  const r = applyLoadout(s, 0, BALANCE);
  assert.equal(r.missing, 1);
  assert.equal(r.refused, 0);
  assert.equal(s.equipment.armor?.id, helm.id, 'repris du coffre');
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
  s.ui.autoUseless = false; // v9.3.8 : règles manuelles seules
  assert.equal(recycleRules(s).mode, 'full');
  s.equipment.armor = makeItem(s, 'iron_helm', 'epic', 80); // v9.3.4 : place « armure »
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
  const options = readFileSync(new URL('../src/ui/panels/options.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
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

import { claimables, claimablesByTab } from '../src/core/claimables.js';
import { betterItem, nextAction } from '../src/core/guide.js';
import { buyMostProfitable, upgradeProfits } from '../src/core/profit.js';
import { relaunchExpeditions, relaunchable, startExpedition } from '../src/core/expeditions.js';
import { distributeSkillPoints, skillPointsAvailable } from '../src/core/skills.js';
import { matchesRecycleRule } from '../src/core/inventory.js';

test('lot 1 : À récupérer — une seule liste, sac plein signalé, pastilles par onglet', () => {
  const s = createNewState(NOW);
  s.contracts[0].progress = s.contracts[0].target;
  s.inbox.push({ id: 900, type: 'gems', stage: 1, reward: { gems: 5 }, seen: false });
  s.inbox.push({ id: 901, type: 'merchant', stage: 1, reward: {}, price: 10, item: makeItem(s, 'leather_hood', 'rare', 1) });
  s.inbox.push({ id: 902, type: 'chest', stage: 1, reward: { gold: 3 }, item: makeItem(s, 'leather_hood', 'common', 1) });
  let list = claimables(s, NOW);
  assert.ok(list.some((c) => c.kind === 'contract'));
  assert.ok(list.some((c) => c.key === 'event:900'));
  assert.ok(!list.some((c) => c.key === 'event:901'), 'un marchand n\'est pas une récompense');
  assert.equal(list.find((c) => c.key === 'event:902').blocked, null);
  while (s.inventory.length < BALANCE.loot.inventorySize) s.inventory.push(makeItem(s, 'leather_hood', 'common', 1));
  list = claimables(s, NOW);
  assert.equal(list.find((c) => c.key === 'event:902').blocked, null, 'v9.1.3 (doc3) : sac plein → coffre');
  while (s.stash.length < BALANCE.loot.stashSize) s.stash.push(makeItem(s, 'leather_hood', 'common', 1));
  list = claimables(s, NOW);
  assert.equal(list.find((c) => c.key === 'event:902').blocked, 'Sac et coffre pleins');
  const byTab = claimablesByTab(list);
  assert.ok(byTab.contracts >= 2 && !byTab.inbox, JSON.stringify(byTab)); // v9.1.3 : trouvailles dans Missions (plus d'onglet À récupérer)
});

test('v9.3.5 : Prochaine action — guide de tout le jeu, un clic fait l\'action', () => {
  const s = createNewState(NOW);
  assert.equal(nextAction(s, { claims: [] }).id, 'goal');
  s.gold = 1e9;
  const up = nextAction(s, { claims: [] });
  assert.equal(up.id, 'upgrade', 'amélioration rentable abordable');
  assert.equal(up.action, 'buy');
  assert.equal(nextAction(s, { claims: [], visible: { upgrades: false } }).id, 'goal', 'jamais une fonction encore cachée');
  s.inventory.push(makeItem(s, 'band_ring_ruby', 'epic', 10));
  const eq = nextAction(s, { claims: [] });
  assert.equal(eq.id, 'equip');
  assert.equal(eq.action, 'equip-best', 'équipe tout d\'un coup');
  s.contracts[0].progress = s.contracts[0].target;
  assert.equal(nextAction(s).id, 'claim');
  assert.equal(nextAction(s).action, 'claim-everything');
  s.tower = { floor: 2, startPlay: 0 };
  assert.equal(nextAction(s).id, 'mode-tower');
  s.tower = null;
  s.contracts[0].progress = 0;
  s.inventory = [];
  s.companions.owned.squire = { level: 1, stars: 1 };
  const pl = nextAction(s, { claims: [] });
  assert.equal(pl.id, 'place');
  assert.equal(pl.value, 'squire');
});

test('lot 1 : rentabilité — seules les lignes de dégâts, achat du plus rentable sans dépasser l\'or', () => {
  const s = createNewState(NOW);
  const p = upgradeProfits(s);
  assert.deepEqual(Object.keys(p).sort(), ['attackSpeed', 'crit', 'critDamage', 'damage', 'doubleAttack']); // v9.2.8 : + Double attaque
  s.gold = 5000;
  const r = buyMostProfitable(s);
  assert.ok(r.spent > 0 && r.spent <= 5000 && s.gold >= 0);
  assert.ok(r.dpsAfter > r.dpsBefore);
  assert.equal(s.upgrades.vitality, 0, 'PV jamais achetés automatiquement');
  assert.equal(s.upgrades.goldFind, 0);
});

test('lot 5 : expéditions — Repartir refait la dernière expédition de chaque place', () => {
  const s = createNewState(NOW);
  s.companions.owned.cat = { level: 1, stars: 1 };
  s.companions.owned.owl = { level: 1, stars: 1 };
  assert.ok(startExpedition(s, 1, 'owl', 'patrol', NOW));
  s.expeditions.slots[1] = null; // terminée et récupérée
  assert.equal(relaunchable(s), 1);
  assert.equal(relaunchExpeditions(s, NOW + 1000), 1);
  assert.equal(s.expeditions.slots[1].companionId, 'owl', 'la place choisie est respectée');
  const back = sanitizeState(JSON.parse(JSON.stringify(s)), BALANCE, NOW);
  assert.equal(back.expeditions.last[1].companionId, 'owl');
});

test('lot 5 : « Répartir mes points » équilibre entre les compétences apprises', () => {
  const s = createNewState(NOW);
  s.level = 20;
  s.skills = { quick: 1 };
  const n = distributeSkillPoints(s);
  assert.ok(n > 0);
  assert.equal(skillPointsAvailable(s) < 2, true);
  const levels = Object.values(s.skills);
  assert.ok(Math.max(...levels) - Math.min(...levels) <= 1, JSON.stringify(s.skills));
});

test('lot 7 : filtre de recyclage « garder si… » protège les objets avec cet effet', () => {
  const s = createNewState(NOW);
  s.equipment.armor = makeItem(s, 'iron_helm', 'legendary', 99); // v9.3.4 : place « armure »
  const item = makeItem(s, 'leather_hood', 'common', 1);
  item.affixes = [{ type: 'lifesteal', value: 2 }];
  s.ui.recycle = { mode: 'full', rarities: ['common'], slots: ['helmet'], keepAffixes: [] };
  assert.equal(matchesRecycleRule(s, item), true);
  s.ui.recycle.keepAffixes = ['lifesteal'];
  assert.equal(matchesRecycleRule(s, item), false);
  const back = sanitizeState(JSON.parse(JSON.stringify(s)), BALANCE, NOW);
  assert.deepEqual(back.ui.recycle.keepAffixes, ['lifesteal']);
});

test('lot 3 : meilleure étape gardée après une Renaissance, estimée pour une ancienne partie', () => {
  const s = createNewState(NOW);
  s.maxStage = 80; s.stage = 80; s.records.bestStage = 80;
  performRebirth(s);
  assert.equal(s.maxStage, 1);
  assert.equal(s.records.bestStage, 80);
  const old = sanitizeState({ version: 7, maxStage: 3, stage: 3, level: 5, equipment: {}, records: { rebirths: 2, kills: 50 }, towerBest: 4 }, BALANCE, NOW);
  assert.ok(old.records.bestStage >= 30, `estimée : ${old.records.bestStage}`);
  assert.equal(old.ui.goalsOpen, true, 'partie existante : Objectifs ouverts');
});

test('sauvegarde : les nouveaux champs survivent à deux rechargements', () => {
  let s = createNewState(NOW);
  Object.assign(s.ui, { tourV: 2, goalsOpen: true, seenTabs: ['summon', 'tree'], dungeonSlot: 'helmet', dungeonPath: 'gold' });
  s.loadouts[0] = { name: 'Boss', team: [], gear: {}, heroClass: 'knight', powers: [], skills: { quick: 2 } };
  for (let i = 0; i < 2; i++) s = sanitizeState(JSON.parse(JSON.stringify(s)), BALANCE, NOW);
  assert.equal(s.ui.tourV, 2);
  assert.equal(s.ui.goalsOpen, true);
  assert.deepEqual(s.ui.seenTabs, ['summon', 'tree']);
  assert.equal(s.ui.dungeonSlot, 'helmet');
  assert.equal(s.loadouts[0].name, 'Boss');
  assert.deepEqual(s.loadouts[0].skills, { quick: 2 });
});

test('migration : une partie de chaque format (v1 à v7) se charge sans rien perdre d\'essentiel', () => {
  for (let version = 1; version <= SAVE_VERSION; version++) {
    const raw = { version, maxStage: 12, stage: 10, level: 9, gold: 1234, gems: 56, equipment: {}, inventory: [], records: { kills: 300 }, upgrades: { damage: 4 } };
    const storage = memoryStorage({ [SAVE_KEY]: JSON.stringify(raw) });
    const r = loadGame(storage, BALANCE, NOW);
    assert.equal(r.source, 'main', `v${version}`);
    assert.ok(r.state.level === 9 && r.state.gems === 56, `v${version}`);
    assert.ok(r.state.maxStage >= 12 || version < 5, `v${version} étape ${r.state.maxStage}`);
    if (version < SAVE_VERSION) assert.ok(storage.getItem(preMigrationKey(version)), `copie pre-v${version}`);
  }
  // Sauvegarde corrompue : la copie de secours prend le relais.
  const good = JSON.stringify({ version: SAVE_VERSION, maxStage: 4, level: 3, equipment: {} });
  const r = loadGame(memoryStorage({ [SAVE_KEY]: '{corrompu', [BACKUP_KEY]: good }), BALANCE, NOW);
  assert.equal(r.source, 'backup');
  assert.equal(r.state.level, 3);
});

test('v9.3.5 : boss bloquant — objet meilleur d\'abord, puis « Boss : N % de vie restante »', () => {
  const s = createNewState(NOW);
  s.records.bossesDefeated = 3;
  s.maxStage = 15; s.stage = 14;
  s.bossRetry = { stage: 15, power: 1e12, hpPct: 88 };
  s.inventory.push(makeItem(s, 'band_ring_ruby', 'epic', 10));
  assert.equal(nextAction(s, { claims: [], visible: { summon: false } }).id, 'equip');
  s.inventory = [];
  const n = nextAction(s, { claims: [], visible: { summon: false } });
  assert.equal(n.id, 'retry');
  assert.equal(n.text, 'Boss : 88 % de vie restante');
  assert.equal(n.action, 'retry-boss');
});
