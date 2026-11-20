// v10.2 : textes en mots lisibles (plus de « ia »), Arène (noms = images, placement par rôle, courbe calibrée),
// « Balayer tout » réparti avec un total exact.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bigCovers, drawBigText } from '../src/render/pixel.js';
import { createNewState, sanitizeState } from '../src/core/state.js';
import { ENEMIES, BOSSES } from '../src/data/enemies.js';
import { autoFormation, formationCards, floorCards, fightBoard, calibrateArena, lastWon, cardArena } from '../src/core/arena-cards.js';
import { sweepAllPlan } from '../src/core/dungeon-plus.js';
import { sweepAll } from '../src/core/dungeon.js';
import { Rng } from '../src/core/rng.js';

test('textes flottants en mots : tous les caractères affichés (police vectorielle), nombres en police pixel', () => {
  for (const t of ['Efficace !', 'Résiste', 'Attaque lourde !', 'Affaibli !']) {
    assert.equal(bigCovers(t), false, t);
    const drawn = [];
    const ctx = { save() {}, restore() {}, strokeText() {}, fillText: (s) => drawn.push(s), fillRect() {}, set font(v) {}, set fillStyle(v) {} };
    drawBigText(ctx, t, 0, 0, '#fff');
    assert.deepEqual(drawn, [t], `${t} doit être écrit en entier`);
  }
  for (const n of ['1,2K', '+35', '987', '4,5M']) assert.ok(bigCovers(n), n);
  // Chaque texte littéral passé à addText dans la scène : soit nombre (police pixel), soit mots (police vectorielle).
  const src = readFileSync('src/render/scene.js', 'utf8');
  for (const m of src.matchAll(/addText\('([^']+)'/g)) assert.ok(bigCovers(m[1]) || /[A-Za-zÀ-ÿ]/.test(m[1]), m[1]);
});

const mk = (list) => { const s = createNewState(); s.maxStage = 140; for (const [id, lv, st] of list) s.companions.owned[id] = { stars: st, level: lv }; return s; };
const SAVES = {
  debutant: () => mk([['priestess', 3, 1], ['squire', 2, 1]]),
  onzeH: () => mk([['shadow_lord', 30, 3], ['barbarian', 30, 3], ['archangel', 30, 3], ['elf_archer', 28, 2], ['demon_queen', 28, 2], ['squire', 25, 3], ['priestess', 25, 3], ['ranger', 22, 2], ['dwarf', 25, 2]]),
  fin: () => sanitizeState(JSON.parse(readFileSync('tests/fixtures/endgame.json', 'utf8'))),
};

test('Arène : le nom de chaque carte ennemie est celui de son monstre (étages 1 à 100)', () => {
  for (let f = 1; f <= 100; f++) for (const c of floorCards(f).cards) {
    if (c.guardian) { assert.match(c.sprite, /guardian_/); continue; }
    const real = ENEMIES[c.enemyId] ?? BOSSES[c.enemyId];
    assert.ok(real, `étage ${f} : ${c.name}`);
    assert.equal(c.name, real.name, `étage ${f}`);
  }
});

test('Arène : placement auto — avant occupé (≥ 2), assassin derrière, jamais d\'avant vide avec un arrière occupé', () => {
  for (const [n, make] of Object.entries(SAVES)) {
    const s = make(); const f = autoFormation(s);
    const front = [0, 1, 2].filter((i) => f[i]).length, back = [3, 4, 5].filter((i) => f[i]).length;
    assert.ok(front >= Math.min(2, f.filter(Boolean).length), `${n} : ${front} devant`);
    if (back) assert.equal(front, 3, `${n} : avant plein avant l'arrière`);
    for (const c of formationCards(s)) if (c.role === 'assassin' && f.filter(Boolean).length > 3) assert.ok(c.pos >= 3, `${n} : assassin devant`);
  }
});

test('Arène : courbe calibrée — l\'équipe passe 20 étages, bute entre 25 et 35 ; l\'étage 10 dure ≥ 12 s', () => {
  for (const [n, make] of Object.entries(SAVES)) {
    const s = make(); autoFormation(s); const t = formationCards(s); const cal = calibrateArena(t);
    const last = lastWon(t, cal, 60);
    assert.ok(last >= 20 && last >= 25 && last <= 35, `${n} : bute à ${last}`);
    const x = floorCards(10, cal);
    assert.ok(fightBoard(t, x.cards, { seed: 10, rule: x.rule }).seconds >= 12, `${n} : étage 10 trop court`);
    // Gardien jamais plus dur que l'étage +10 : si l'étage 35 tombe, le gardien 25 aussi.
    const w = (f) => { const y = floorCards(f, cal); return fightBoard(t, y.cards, { seed: f, rule: y.rule }).won; };
    if (w(35)) assert.ok(w(25), `${n} : gardien 25 plus dur que l'étage 35`);
  }
});

test('Donjons : « Balayer tout » répartit les clés et donne exactement le total annoncé', () => {
  const s = createNewState(); s.maxStage = 200; s.keys = 10;
  s.dungeonBest = { crypt: 1, sanctuary: 0 }; s.dungeonsCleared = { crypt: 3, sanctuary: 2 };
  const plan = sweepAllPlan(s);
  assert.deepEqual(plan.map((p) => [p.id, p.difficulty, p.n]), [['crypt', 'normal', 5], ['sanctuary', 'easy', 5]]);
  const preview = sweepAll(structuredClone(s), plan, () => new Rng(7));
  const real = sweepAll(s, plan, () => new Rng(7));
  assert.equal(real.count, 10); assert.equal(s.keys, 0);
  assert.deepEqual(real.earned, preview.earned);
});
