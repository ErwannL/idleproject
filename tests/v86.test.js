import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewState, sanitizeState } from '../src/core/state.js';
import { applyCheat, simSpeed, SKIP_SPEED } from '../src/core/cheats.js';
import { RUSHES } from '../src/data/rushes.js';
import { SKILLS } from '../src/data/skills.js';
import { ART } from '../src/render/art.js';

test('v8.6 : code SKIPBATTLE (combats passés) — bascule, vitesse maximale, sauvegardé', () => {
  const s = createNewState(Date.now(), 1);
  assert.equal(simSpeed(s), 1);
  assert.ok(applyCheat(s, 'skipbattle'));
  assert.equal(s.cheats.skipBattle, true);
  assert.equal(simSpeed(s), SKIP_SPEED);
  assert.equal(sanitizeState(JSON.parse(JSON.stringify(s))).cheats.skipBattle, true);
  applyCheat(s, 'PASSECOMBAT');
  assert.equal(simSpeed(s), 1);
});

test('v8.6 : les boosts ont leurs propres icônes (plus de réemploi des compétences)', () => {
  const skillIcons = new Set(SKILLS.map((sk) => sk.icon));
  const boostIcons = RUSHES.map((r) => r.icon);
  assert.equal(new Set(boostIcons).size, RUSHES.length);
  for (const id of boostIcons) {
    assert.ok(!skillIcons.has(id), id);
    assert.match(id, /^boost_/);
  }
  for (const id of boostIcons) assert.ok(ART[id], `icône générée : ${id}`);
});

test('v8.7 : la Tour se durcit de plus en plus vite (une ascension finit toujours)', async () => {
  const { towerLevel } = await import('../src/core/tower.js');
  const s = createNewState(Date.now(), 2);
  s.maxStage = 400;
  const d1 = towerLevel(s, 101) - towerLevel(s, 100);
  const d2 = towerLevel(s, 401) - towerLevel(s, 400);
  assert.ok(d2 > d1 * 2.5, `${d1} → ${d2}`);
  assert.ok(towerLevel(s, 429) > 200 + 429 * 3 + 4000);
});
