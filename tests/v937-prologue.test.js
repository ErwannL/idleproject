// v9.3.7 : prologue « La chute du héros » — scène pure, ~70 s, une seule fois, rien n'est pris à la partie.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PROLOGUE_HINT, PROLOGUE_LINES, PROLOGUE_SECONDS, prologueState } from '../src/ui/prologue.js';
import { readFileSync } from 'node:fs';

test('déroulé : seul, renforts à mi-vie, rage, chute, perte de tout ; environ 70 s', () => {
  assert.equal(PROLOGUE_SECONDS, 70);
  const start = prologueState(1);
  assert.equal(start.allies, 0, 'seul au début');
  assert.equal(start.heroHp, 100);
  const half = prologueState(24.9);
  assert.ok(half.heroHp <= 52 && half.allies === 0, 'à la moitié de ses PV, avant les renforts');
  const help = prologueState(27);
  assert.ok(help.allies === 1 && !help.rage);
  assert.ok(prologueState(39).bossHp < prologueState(24).bossHp - 20, 'les compagnons font mal au Colosse');
  const rage = prologueState(41);
  assert.ok(rage.rage);
  const end = prologueState(53);
  assert.deepEqual(end.fallen, [true, true, true], 'toute l\'équipe tombe');
  assert.ok(prologueState(56).gearBreak && prologueState(60).alliesGone);
  assert.ok(prologueState(70).done);
  // Dialogues dans l'ordre, chacun atteignable par un clic.
  for (let i = 1; i < PROLOGUE_LINES.length; i++) assert.ok(PROLOGUE_LINES[i][0] > PROLOGUE_LINES[i - 1][0]);
  assert.equal(prologueState(PROLOGUE_LINES[3][0]).dialog, 3);
});

test('une seule fois, à la première connexion ; aucun « Revoir » ; la partie n\'est pas touchée', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /loaded\.source === 'new'[\s\S]*PROLOGUE_HINT/);
  assert.equal(PROLOGUE_HINT, 'prologue');
  const src = readFileSync(new URL('../src/ui/prologue.js', import.meta.url), 'utf8');
  assert.ok(!/state\./.test(src.replace(/\/\/.*$/gm, '')), 'le prologue ne lit ni ne modifie la partie');
  assert.ok(!/Revoir le prologue/.test(main));
});
