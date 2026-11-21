// v10.7 (docs/prompt-v10.7/PROMPT.md) : finitions après le test de la 10.6.0.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

globalThis.localStorage ??= { getItem: () => null, setItem: () => {}, removeItem: () => {} };
const { createNewState, sanitizeState } = await import('../src/core/state.js');
const src = (p) => readFileSync(p, 'utf8');
const reload = (s) => sanitizeState(JSON.parse(JSON.stringify(s)));

test('10.7 (1) : les notions vues (learned) et les ressources présentées (seenRes) survivent au rechargement', () => {
  const s = createNewState(Date.now());
  s.ui.learned = ['upgrades', 'inventory', 'skills', 'lootbag', 'summon', 'forge', 'contracts', 'tower', 'dungeons', 'defis'];
  s.ui.seenRes = ['shards', 'gems', 'ticketLimited'];
  let r = s;
  for (let i = 0; i < 3; i++) r = reload(r);
  assert.deepEqual(r.ui.learned, s.ui.learned);
  assert.deepEqual(r.ui.seenRes, s.ui.seenRes);
});

test('10.7 (1) garde-fou : chaque champ de ui rempli revient après sauvegarde et rechargement', () => {
  const s = createNewState(Date.now());
  const filled = {
    learned: ['upgrades'], seenRes: ['gems'], rarityFilter: 'epic', sweepSeed: 7, slotFilter: 'weapon', sortBy: 'level', autoRecycle: 'rare',
    sealSeen: ['a'], fingerDone: ['x'], seenTabs: ['upgrades'], sealMiniUntil: 12, wallAt: 34, buyAllOk: true, riftDay: '2026-11-21', feed: false,
    vigil: 'phone', focus: true, cinematics: false, shake: false, bigAuras: true, charSize: 'large', skillNames: false, simple: true,
    combatAssist: 'manual', metricsOptIn: true, theme: 'dawn', gearProfile: 'attack', keepSets: false, doubleDay: '2026-11-21', autoUseless: false,
    autoMannequin: false, autoMuseum: false, themeFx: false, tour: 'done', tourV: 3, goalsOpen: true, hints: ['howto'], invUsed: ['forge'],
    guide: { upgrades: true }, dungeonSlot: 'weapon', dungeonPath: 'crypt',
  };
  Object.assign(s.ui, filled);
  const r = reload(s);
  for (const [k, v] of Object.entries(filled)) assert.deepEqual(r.ui[k], v, `ui.${k} perdu au rechargement`);
});

test('10.7 (3) : l\'ancien filtre « accessory » devient « Tout le sac »', () => {
  const s = createNewState(Date.now());
  s.ui.slotFilter = 'accessory';
  assert.equal(reload(s).ui.slotFilter, 'all');
});

test('10.7 (1) : une partie avancée touchée par le bug a déjà vu les notions dépassées', () => {
  assert.match(src('src/ui/learn.js'), /bossesDefeated \?\? 0\) > 30\) for \(const x of LEARN\) if \(stage > x\.stage/);
});
