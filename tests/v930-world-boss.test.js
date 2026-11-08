// v9.3.0 : attaques propres du Colosse du World Boss (jet de pierre, rayon des yeux) : cycle, dégâts, traductions,
// et position des yeux relevée sur chaque image des animations du rayon.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createNewState } from '../src/core/state.js';
import { WORLD_BOSS, WorldBossFight, bossHpForDay, pickAbility } from '../src/core/world-boss.js';
import { COLOSSUS_ANIMS, COLOSSUS_EYES, animFrameAt, animLength } from '../src/render/world-boss-scene.js';
import { lookup as en } from '../src/i18n/en.js';
import { lookup as ko } from '../src/i18n/ko.js';

function player() {
  const s = createNewState(Date.now());
  Object.assign(s, { maxStage: 60, stage: 60, level: 80, skillAuto: true });
  s.records.bestStage = 60;
  for (const k of Object.keys(s.upgrades)) s.upgrades[k] = 25;
  for (const id of ['archangel', 'demon_queen', 'wisp']) s.companions.owned[id] = { level: 10, stars: 3 };
  s.companions.equipped = ['archangel', 'demon_queen', 'wisp'];
  return s;
}

test('Colosse : jet de pierre dès le début, rayon des yeux à partir de la phase 1, en alternance', () => {
  assert.equal(pickAbility(0, 0).id, 'boulder');
  assert.equal(pickAbility(0, 1).id, 'boulder');
  assert.equal(pickAbility(1, 1).id, 'eyebeam');
  assert.equal(pickAbility(2, 2).id, 'boulder');
  const s = player();
  const f = new WorldBossFight(s, { seed: 5, maxHp: bossHpForDay(s) });
  f.finish();
  const ab = f.out.filter((o) => o.type === 'ability');
  assert.ok(ab.length >= 4, `attaques propres pendant la tentative : ${ab.length}`);
  assert.equal(ab[0].id, 'boulder');
  assert.ok(Math.abs(ab[0].time - WORLD_BOSS.abilityFirst) < 0.05);
  assert.ok(ab.some((a) => a.id === 'eyebeam'), 'rayon des yeux lancé');
  for (const a of ab) assert.ok(a.damage > 0 && a.name);
  // Jamais collées à une attaque de phase ou un Éveil.
  const big = f.out.filter((o) => o.type !== 'ability');
  for (const a of ab) for (const b of big) assert.ok(a.time - b.time >= WORLD_BOSS.abilityGap - 1e-9 || a.time < b.time, `${a.id} à ${a.time} trop près de ${b.type} à ${b.time}`);
  assert.ok(f.world.hero.hp >= 1 || !f.world.hero.dead);
});

test('Colosse : la mesure des PV du jour ne lance aucune attaque propre (calibrage inchangé)', () => {
  const f = new WorldBossFight(player(), { seed: 7, maxHp: 0 });
  f.finish();
  assert.equal(f.out.length, 0);
});

test('Colosse : yeux relevés sur chaque image du rayon, animations à durées par image', () => {
  for (const name of ['beam', 'beam3']) {
    const a = COLOSSUS_ANIMS[name];
    assert.equal(COLOSSUS_EYES[name].length, a.n);
    for (const e of COLOSSUS_EYES[name]) { assert.equal(e.length, 4); assert.ok(e.every((v) => v > 0 && v < 128)); assert.ok(e[0] < e[2], 'œil avant à gauche'); }
    assert.equal(animFrameAt(a, 0), 0);
    assert.equal(animFrameAt(a, animLength(a) + 0.01), -1);
    assert.equal(animFrameAt(a, a.durs.slice(0, a.fire[0]).reduce((x, y) => x + y, 0) + 0.001), a.fire[0]);
  }
  assert.equal(animFrameAt(COLOSSUS_ANIMS.idle, 0.2), 1);
  assert.ok(COLOSSUS_ANIMS.throw.release > 0 && COLOSSUS_ANIMS.throw.release < 13);
});

test('Colosse : noms des attaques traduits en anglais et en coréen', () => {
  for (const fr of ['Jet de pierre', 'Rayon des Anciens', 'Attaque du Colosse']) {
    assert.notEqual(en(fr) ?? fr, fr, `en : ${fr}`);
    assert.notEqual(ko(fr) ?? fr, fr, `ko : ${fr}`);
  }
});
