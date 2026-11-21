// v10.3.1 : fin de la partie 6 du plan docs/plan-v1030.md (« Arène : le combat se joue sur une carte ») — deux rangs en
// profondeur, compagnon vaincu couché, mécaniques des boss jouées, ultime (zoom et flash), fin de combat, seuil des 3 ★,
// Boss commun dans ArenaScene, ancien écran à portraits retiré.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

globalThis.localStorage ??= { getItem: () => null, setItem: () => {}, removeItem: () => {} };
const ctx2d = new Proxy({}, {
  get: (t, k) => (k === 'getImageData' || k === 'createImageData'
    ? (x, y, w = 1, h = 1) => ({ data: new Uint8ClampedArray(Math.max(1, (w | 0) * (h | 0)) * 4), width: w, height: h })
    : k === 'measureText' ? () => ({ width: 1 }) : k === 'getTransform' ? () => ({ a: 1, d: 1, e: 0, f: 0 }) : k in t ? t[k] : () => {}),
  set: (t, k, v) => { t[k] = v; return true; },
});
globalThis.document ??= { createElement: () => ({ width: 1, height: 1, style: {}, getContext: () => ctx2d, toDataURL: () => 'data:' }) };
globalThis.window ??= globalThis;
globalThis.Image ??= class { constructor() { this.complete = false; this.naturalWidth = 0; } addEventListener() {} };

const { sanitizeState } = await import('../src/core/state.js');
const A = await import('../src/core/arena-cards.js');
const S = await import('../src/render/arena-scene.js');
const { CARD_ARENA } = await import('../src/data/arena-floors.js');
const { BALANCE } = await import('../src/data/balance.js');
const TRAITS_MOD = await import('../src/core/boss-traits.js');

const fin = () => sanitizeState(JSON.parse(readFileSync('tests/fixtures/endgame.json', 'utf8')));
const src = (p) => readFileSync(p, 'utf8');
const W = BALANCE.world;
const fakeCanvas = () => ({ width: 1, height: 1, style: {}, parentElement: null, getContext: () => ctx2d });
const sceneOf = (f) => { const s = fin(); A.cardArena(s).best = f; const run = A.playFloor(s, f); return { run, scene: new S.ArenaScene(fakeCanvas(), run, s) }; };

test('6.2 — deux rangs côté monstres : l\'arrière derrière l\'avant ; sans avant vivant, l\'arrière avance', () => {
  const list = [{ pos: 1, boss: true, range: 20 }, { pos: 4, boss: false, range: 16 }, { pos: 3, boss: false, range: 16 }];
  const rows = S.foeRows(list);
  const front = rows.get(list[0]), b1 = rows.get(list[1]), b2 = rows.get(list[2]);
  assert.equal(front.back, false);
  assert.ok(b1.back && b2.back);
  assert.ok(b1.stop > front.stop && b2.stop > b1.stop, 'l\'arrière est plus loin des compagnons que l\'avant');
  const alone = S.foeRows([list[1], list[2]]);
  assert.ok(![...alone.values()].some((r) => r.back), 'sans avant, l\'arrière devient l\'avant');
  assert.equal(alone.get(list[1]).stop, W.heroX + W.meleeOffset + 16);
  assert.ok(S.isBackFoe(13) && !S.isBackFoe(12) && S.isBackAlly(3) && !S.isBackAlly(2));
});

test('6.2 — deux rangs côté compagnons : « Derrière » en retrait (plus loin des monstres), plus haut, ×0,9 ; dessiné avant « Devant »', () => {
  const { run, scene } = sceneOf(10);
  for (let i = 0; i < 90; i++) scene.moveFoes(1 / 30); // (le dessin, lui, est vérifié par tools/e2e-1031-arena.mjs)
  scene.r.layout = scene.r.teamLayout(scene.state);
  const marks = scene.allyMarks();
  const front = marks.filter((m) => !m.back), back = marks.filter((m) => m.back);
  assert.ok(front.length && back.length, JSON.stringify(run.team.map((c) => c.pos)));
  assert.ok(back.every((b) => b.foot < front[0].foot), 'l\'arrière a ses pieds plus haut');
  assert.ok(back.every((b) => b.k === S.BACK_SCALE) && S.BACK_SCALE === 0.9);
  assert.ok(Math.max(...back.map((b) => b.x)) < Math.max(...front.map((f) => f.x)), 'l\'arrière est en retrait');
  // Monstres : boss devant, l'autre carte derrière, plus haute.
  const foes = scene.world.enemies;
  assert.ok(foes.some((e) => e.depth > 0.9) && foes.some((e) => e.depth < 0.1));
  const code = src('src/render/arena-scene.js');
  assert.match(code, /for \(const back of \[true, false\]\)/, 'arrière dessiné avant l\'avant');
});

test('6.2 — compagnon vaincu : il reste dans l\'équipe dessinée, couché et grisé', () => {
  const { run, scene } = sceneOf(10);
  const fall = run.events.find((e) => e.kind === 'fall' && e.side === 'ally');
  assert.ok(fall, 'l\'étage 10 de la sauvegarde de fin fait tomber un compagnon');
  scene.quiet = true;
  while (scene.fired < run.events.length) scene.play(run.events[scene.fired++]);
  const id = run.team.find((c) => c.pos === fall.pos).id;
  assert.ok(scene.down.has(fall.pos) && scene.downIds.has(id));
  assert.ok(scene.state.companions.equipped.includes(id), 'il n\'est plus retiré de la scène');
  const code = src('src/render/arena-scene.js');
  assert.match(code, /drawFallen\(ctx, c, cx\) \{[\s\S]*?rotate\(\(-Math\.PI \/ 2\)[\s\S]*?grayscale\(1\)/, 'couché (rotation) et grisé');
});

test('6.2 — boss d\'étage et gardiens : leur mécanique est jouée (événements horodatés), sans changer le combat', () => {
  const { BOSS_TRAITS, TRAITS } = TRAITS_MOD;
  const s = fin(); const cal = A.arenaCal(s); const team = A.formationCards(s);
  for (const f of [10, 25, 50]) {
    const x = A.floorCards(f, cal);
    const before = A.fightBoard(team, x.cards, { seed: f, rule: x.rule });
    const boss = x.cards.find((c) => c.boss);
    const trait = S.arenaTraitOf(boss);
    assert.ok(trait && TRAITS[trait], `étage ${f} : ${boss.name} a une mécanique`);
    if (boss.guardian) assert.equal(trait, 'armored'); else assert.equal(trait, BOSS_TRAITS[boss.enemyId]);
    const run = { ...before, setup: x, team };
    const m = S.arenaMechanics(run);
    assert.ok(m.length >= 1 && m[0].action === 'intro' && m.every((e) => e.kind === 'mechanic' && e.t <= before.seconds), `étage ${f} : ${JSON.stringify(m)}`);
    assert.deepEqual(A.fightBoard(team, x.cards, { seed: f, rule: x.rule }), before, 'le combat est identique');
  }
  // Chaque mécanique a son geste : invocation, rage, Fournaise, Carapace brisée.
  const fake = (enemyId, guardian = false) => ({ seconds: 40, setup: { cards: [{ pos: 1, boss: true, guardian, enemyId, maxHp: 1000 }] },
    events: Array.from({ length: 60 }, (_, i) => ({ t: 0.5 + i * 0.5, kind: 'hit', side: 'ally', from: 0, to: 1, d: 15 })) });
  const acts = (id, g) => S.arenaMechanics(fake(id, g)).map((e) => e.action);
  assert.ok(acts('spectral_queen').includes('summon'));
  assert.ok(acts('demon_king').includes('enrage'));
  assert.ok(acts('ash_dragon').includes('escalate'));
  assert.ok(acts(null, true).includes('shellBreak'));
  assert.ok(acts('boss_leviathan').includes('pulse'));
  assert.deepEqual(acts('slime_king'), [], 'un boss sans mécanique (monde 1) n\'en joue pas');
});

test('6.2 — scène : la mécanique jouée (serviteurs qui surgissent et tombent, nom dans la barre du boss)', () => {
  const { run, scene } = sceneOf(10);
  scene.r.layout = scene.r.teamLayout(scene.state);
  const boss = scene.world.enemies.find((e) => e.boss);
  assert.equal(boss.trait, 'escalate', 'le moteur reçoit la mécanique (aura de rage de la campagne)');
  scene.summonMinions(boss, 'wraith', 2);
  assert.equal(scene.world.enemies.filter((e) => e.minion).length, 2);
  scene.t += 2;
  scene.play({ t: 1, kind: 'hit', side: 'ally', from: run.team[0].pos, to: boss.arenaPos, d: 1 });
  assert.equal(scene.minions.length, 1, 'un coup sur le boss fait tomber un serviteur');
  assert.match(src('src/ui/arena-map.js'), /am-mech/);
  assert.match(src('index.html'), /src\/ui\/arena1031\.css/);
});
