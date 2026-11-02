import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewState, sanitizeState } from '../src/core/state.js';
import { noteRebirth, noteTranscend, sanitizeTimes, tickTimes, zoneTime } from '../src/core/times.js';

test('temps : par monde et cycle, par activité, premier passage, renaissances', () => {
  const s = createNewState(Date.now(), 1);
  s.playSeconds = 100;
  tickTimes(s, 10);
  assert.equal(s.times.where['0:1'], 10);
  assert.equal(s.times.firstZone[0], 100);
  s.stage = 22; // monde 2
  tickTimes(s, 5);
  assert.equal(zoneTime(s.times, 1), 5);
  s.dungeon = { id: 'x' };
  tickTimes(s, 7);
  assert.equal(s.times.modes.dungeon, 7);
  assert.equal(zoneTime(s.times, 1), 5); // le donjon ne compte pas pour le monde
  s.dungeon = null;
  assert.equal(s.times.run, 22);
  noteRebirth(s);
  assert.deepEqual(s.times.rebirthRuns, [22]);
  assert.equal(s.times.bestRebirth, 22);
  assert.equal(s.times.run, 0);
  tickTimes(s, 3);
  noteRebirth(s);
  assert.equal(s.times.bestRebirth, 3);
  noteTranscend(s);
  assert.equal(s.times.bestTranscend, 25);
  // Sauvegarde : relue à l'identique (sauf la séance en cours) ; valeurs invalides ignorées.
  const back = sanitizeTimes(JSON.parse(JSON.stringify(s.times)));
  assert.deepEqual(back.where, s.times.where);
  assert.equal(sanitizeTimes({ where: { 'x:1': 5, '0:1': -3 }, modes: { campaign: 'a' } }).modes.campaign, 0);
});

test('temps : une partie d\'avant la 9.1.7 a ses mondes atteints à une date inconnue', () => {
  const raw = JSON.parse(JSON.stringify(createNewState(Date.now(), 1)));
  delete raw.times;
  raw.maxStage = 45; // monde 3
  raw.playSeconds = 5000;
  const s = sanitizeState(raw);
  assert.deepEqual(s.times.firstZone, { 0: -1, 1: -1, 2: -1 });
});
