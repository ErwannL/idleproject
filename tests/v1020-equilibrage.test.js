// v10.20 (partie 7) : combat, équilibrage, début de partie.
//   7.1 « Moment fort » : 3 s au plus, en file pendant un combat de boss, bandeau fin en haut de la scène ;
//   7.2 plafonds des coups de boss (45 → 30 %, lourd 60 → 40 %), Second souffle dès 30 % des PV ;
//   7.3 conseil « Renaître » seulement à l'étape 60 ou après 2 h de jeu ; 7.4 bulle « Nouveau : Gemmes » après le 1er boss ;
//   7.5 images des donjons (URL directement dans background-image).
// Mesure complète des morts par boss (30 graines, avant/après) : node tools/sim-1020-boss.mjs (trop longue pour ce test).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { BALANCE } from '../src/data/balance.js';
import { createNewState } from '../src/core/state.js';
import { createCombat, step, hitCapPct } from '../src/core/combat.js';
import { Rng } from '../src/core/rng.js';
import { AnnounceQueue, MOMENT_MAX_MS } from '../src/ui/announce-queue.js';
import { REBIRTH_ADVICE, rebirthAdviceOpen } from '../src/core/rebirth.js';
import { resourceBubbleReady } from '../src/ui/learn.js';
import { OLD_SURVIVAL, meanCi } from '../tools/sim-1020-boss.mjs';

const SV = BALANCE.survival;
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('7.1 : « Moment fort » limité à 3 s, en file pendant un combat de boss', () => {
  const q = new AnnounceQueue();
  q.push({ kind: 'moment', ms: 8000, cine: { title: 'Monde 12 terminé !' } });
  // Combat de boss : rien ne part.
  assert.equal(q.tick(0, { bossFight: true }).start, null);
  assert.equal(q.tick(5000, { bossFight: true }).start, null);
  assert.equal(q.size, 1);
  // Boss vaincu : le moment part, 3 s au plus.
  const { start } = q.tick(6000, { bossFight: false });
  assert.ok(start);
  assert.ok(start.ms <= MOMENT_MAX_MS && MOMENT_MAX_MS <= 3000, `durée ${start.ms}`);
  assert.equal(q.current.until, 6000 + start.ms);
  // Un boss arrive pendant le moment fort : il s'arrête.
  q.push({ kind: 'moment', cine: { title: 'Première Renaissance !' } });
  const r = q.tick(6500, { bossFight: true });
  assert.ok(r.stop);
  assert.equal(r.start, null);
  // Les annonces urgentes (portail, DANGER) passent toujours, même en combat de boss.
  q.push({ kind: 'danger', plan: {} });
  assert.equal(q.tick(6600, { bossFight: true }).start?.kind, 'danger');
});

test('7.1 : bandeau fin en haut de la scène (même feuille pour PC et téléphone)', () => {
  assert.match(src('src/ui/cinematic.js'), /banner \? ' banner' : ''/);
  assert.match(src('src/ui/ui.js'), /light: true, banner: true/);
  assert.match(src('src/ui/ui.js'), /bossFight: Boolean\(this\.bossFight\)/);
  const css = src('src/ui/combat1020.css');
  assert.match(css, /\.cinematic\.banner/);
  assert.doesNotMatch(css, /m-phone|max-width: 1\d{3}px|min-width/, 'aucune règle propre au PC ou au téléphone');
  assert.match(src('index.html'), /src\/ui\/combat1020\.css/);
});

test('7.2 : plafonds des coups de boss 30 % et 40 % (lourd), Second souffle dès 30 % des PV', () => {
  assert.deepEqual(SV.hitCapPct, { normal: 25, boss: 30, heavy: 40 });
  assert.equal(SV.secondWind.above, 0.3);
  assert.equal(hitCapPct({ boss: true }), 30);
  assert.equal(hitCapPct({ boss: true, heavy: true }), 40);
  assert.equal(hitCapPct({ boss: true, heavy: true, parried: true }), 30);
  assert.deepEqual(OLD_SURVIVAL.hitCapPct, { normal: 25, boss: 45, heavy: 60 }); // référence « avant » de l'outil
  // Un boss qui frappait 45 % → 45 % → 60 % (mort en 3 coups) ne tue plus en 3 coups (30 + 30 + 40 = 100 % au plus,
  // et le Second souffle laisse à 1 PV un héros au-dessus de 30 %).
  const state = createNewState(Date.UTC(2026, 10, 9, 8), 3);
  state.stage = 35; state.maxStage = 35;
  const world = createCombat(state);
  const rng = new Rng(5);
  step(state, world, 0.01, rng);
  const maxHp = world.heroStats.maxHp;
  world.hero.hp = maxHp; world.hero.regen = 0;
  const W = BALANCE.world;
  const e = { id: world.nextEnemyId++, type: 'slime', boss: true, elite: false, x: W.heroX + W.meleeOffset + 10, hp: 1e30, maxHp: 1e30,
    damage: 1e12, gold: 1, speed: 0, attackInterval: 1, attackTimer: 0.001, range: 10, engaged: true, arrived: true, age: 0, summons: [], behavior: null, trait: null, heavy: false, rush: false };
  world.enemies = [e];
  let hits = 0;
  for (const heavy of [false, false, true]) {
    for (let k = 0; k < 50; k++) { // esquives possibles : on relance jusqu'au coup
      e.heavy = heavy; e.attackTimer = 0.001; world.time += 2; world.events.length = 0;
      step(state, world, 0.01, rng);
      if (world.events.some((ev) => ev.type === 'heroHit' || ev.type === 'heroDeath')) break;
    }
    hits += 1;
  }
  assert.equal(hits, 3);
  assert.equal(world.hero.dead, false, 'vivant après 30 % + 30 % + 40 %');
});

test('7.2 : outil de mesure (intervalle de confiance)', () => {
  const r = meanCi([1, 2, 3, 4]);
  assert.equal(r.mean, 2.5);
  assert.ok(r.ci > 1.2 && r.ci < 1.3);
  assert.ok(existsSync(new URL('../tools/sim-1020-boss.mjs', import.meta.url)));
});

test('7.3 : conseil « Renaître » à partir de l\'étape 60 ou après 2 h de jeu', () => {
  const s = createNewState(0, 1);
  assert.deepEqual(REBIRTH_ADVICE, { minStage: 60, minPlaySeconds: 7200 });
  s.maxStage = 40; s.playSeconds = 8 * 60;
  assert.equal(rebirthAdviceOpen(s), false);
  s.playSeconds = 7199; assert.equal(rebirthAdviceOpen(s), false);
  s.playSeconds = 7200; assert.equal(rebirthAdviceOpen(s), true);
  s.playSeconds = 600; s.maxStage = 60; assert.equal(rebirthAdviceOpen(s), true);
  s.maxStage = 20; s.records.rebirths = 1; assert.equal(rebirthAdviceOpen(s), true); // déjà reparti : comme avant
  assert.match(src('src/core/mentor.js'), /rebirthAdviceOpen\(state\)/);
  assert.match(src('src/core/guide.js'), /rebirthAdviceOpen\(state\)/);
});

test('7.4 : « Nouveau : Gemmes » après le premier boss vaincu', () => {
  const s = createNewState(0, 1);
  s.records.bossesDefeated = 0;
  assert.equal(resourceBubbleReady(s, 'gems'), false);
  assert.equal(resourceBubbleReady(s, 'shards'), true);
  s.records.bossesDefeated = 1;
  assert.equal(resourceBubbleReady(s, 'gems'), true);
});

test('7.5 : images des donjons écrites directement dans background-image', () => {
  const css = src('src/ui/desk-activities.css');
  assert.doesNotMatch(css, /--dgm-img:/);
  for (const d of ['crypt', 'sanctuary', 'furnace', 'glacier', 'citadel']) {
    assert.match(css, new RegExp(`data-d="${d}"\\] \\{ background-image: [^}]*url\\(\\.\\./\\.\\./assets/ui/art101/dungeon_${d}\\.png\\)`));
    assert.ok(existsSync(new URL(`../assets/ui/art101/dungeon_${d}.png`, import.meta.url)));
  }
});
