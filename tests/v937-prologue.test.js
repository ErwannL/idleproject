// v9.7.1 (lot 1) : prologue jouable — script pur (scènes, paliers de vie, renforts, rage, réincarnation).
import test from 'node:test';
import assert from 'node:assert/strict';
import { PROLOGUE_LINES, PROLOGUE_SCENES, PROLOGUE_SECONDS, REBIRTH_LINES, prologueState } from '../src/ui/prologue.js';
import { BLESSINGS, blessingMult, grantBlessing } from '../src/core/blessing.js';

test('prologue : 5 scènes dans l\'ordre, 90 à 120 s', () => {
  assert.ok(PROLOGUE_SECONDS >= 90 && PROLOGUE_SECONDS <= 120);
  assert.deepEqual(['march', 'colossus', 'allies', 'rage', 'rebirth'].map((s) => prologueState(PROLOGUE_SCENES[s] + 0.1).scene), ['march', 'colossus', 'allies', 'rage', 'rebirth']);
  assert.ok(prologueState(10).skillPrompt, 'scène 1 : la compétence brille');
  assert.equal(prologueState(10).heroHp, 100);
  assert.ok(prologueState(46).heroHp < 40, 'scène 2 : la vie chute par paliers');
  assert.ok(prologueState(49).bossHp > 95, 'dégâts dérisoires');
  assert.ok(prologueState(60).allyPrompt && prologueState(60).allies === 1);
  assert.ok(prologueState(74).bossHp <= 52, 'les renforts font descendre le Colosse à la moitié');
  assert.ok(prologueState(87).allyDown.every(Boolean) && prologueState(91).gearLeft === 0);
  assert.equal(prologueState(93).heroHp, 0);
  assert.ok(prologueState(96).white === 1 && prologueState(PROLOGUE_SECONDS).done);
  for (let i = 1; i < PROLOGUE_LINES.length; i++) assert.ok(PROLOGUE_LINES[i][0] > PROLOGUE_LINES[i - 1][0]);
  assert.equal(REBIRTH_LINES.length, 4);
});

test('bénédiction de départ : une heure de jeu, puis plus rien', () => {
  const s = { playSeconds: 0 };
  assert.ok(grantBlessing(s, 'gold'));
  assert.equal(blessingMult(s, 'gold'), BLESSINGS.gold.mult);
  assert.equal(blessingMult(s, 'damage'), 1);
  s.playSeconds = 3601;
  assert.equal(blessingMult(s, 'gold'), 1);
  assert.ok(!grantBlessing(s, 'nope'));
});
