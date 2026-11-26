// v10.16 : chaque Titan du jour a ses propres compétences (data/grand-bosses.js, DAY_TITANS ; rendu :
// render/titan-skills.js). Les chiffres ne changent pas : mêmes dégâts reçus, même PV du boss du jour.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

globalThis.localStorage ??= { getItem: () => null, setItem: () => {}, removeItem: () => {} };
const grad = { addColorStop: () => {} };
const ctx2d = new Proxy({}, {
  get: (t, k) => (k === 'getImageData' || k === 'createImageData'
    ? (...a) => { const [w = 1, h = 1] = k === 'getImageData' ? a.slice(2) : a; return { data: new Uint8ClampedArray(Math.max(1, (w | 0) * (h | 0)) * 4), width: w, height: h }; }
    : k === 'measureText' ? () => ({ width: 1 }) : k === 'getTransform' ? () => ({ a: 1, d: 1, e: 0, f: 0 })
      : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => grad : k in t ? t[k] : () => {}),
  set: (t, k, v) => { t[k] = v; return true; },
});
globalThis.document ??= { createElement: () => ({ width: 1, height: 1, style: {}, getContext: () => ctx2d, toDataURL: () => 'data:' }) };
globalThis.window ??= globalThis;
globalThis.Image ??= class { constructor() { this.complete = false; this.naturalWidth = 0; } addEventListener() {} };

const { createNewState, sanitizeState } = await import('../src/core/state.js');
const { WorldBossFight, bossHpForDay, pickAbility, WORLD_BOSS } = await import('../src/core/world-boss.js');
const { DAY_TITANS, GRAND_BOSSES } = await import('../src/data/grand-bosses.js');
const { TITAN_SKILLS } = await import('../src/render/titan-skills.js');
const { WorldBossScene } = await import('../src/render/world-boss-scene.js');
const { EXACT_1016_TITANS: EN } = await import('../src/i18n/en-1016-titans.js');
const { EXACT_1016_TITANS: KO } = await import('../src/i18n/ko-1016-titans.js');

const COLOSSUS_IDS = ['boulder', 'eyebeam', 'quake', 'meteors', 'fury'];
const kit = (t) => [...t.fight.abilities, ...t.fight.phases];
const probeState = () => { const s = createNewState(); s.stage = 120; s.maxStage = 120; return s; };
// Fiche d'avant v10.16 : les attaques et phases du Colosse (mêmes chiffres).
const OLD = (t) => ({ ...t.fight,
  abilities: [{ id: 'boulder', name: 'Jet de pierre', hit: 0.11, from: 0 }, { id: 'eyebeam', name: 'Rayon des Anciens', hit: 0.15, from: 1 }],
  phases: t.fight.phases.map((p, i) => ({ ...p, id: i ? 'fury' : 'quake' })) });
function withFight(t, fight, fn) {
  const keep = t.fight;
  t.fight = fight;
  try { return fn(); } finally { t.fight = keep; }
}

test('les 7 Titans ont 3 attaques (from 0, 1, 2) et 2 phases (60 %, 30 %), id propres et uniques', () => {
  const seen = new Set();
  for (const t of DAY_TITANS) {
    const f = t.fight;
    assert.equal(f.abilities.length, 3, t.id);
    assert.deepEqual(f.abilities.map((a) => a.from), [0, 1, 2]);
    assert.deepEqual(f.abilities.map((a) => a.hit), [0.11, 0.15, 0.15]);
    assert.equal(f.phases.length, 2);
    assert.deepEqual(f.phases.map((p) => [p.at, p.hit, p.speed, p.power]), [[0.6, 0.16, 1.2, 1.2], [0.3, 0.26, 1.45, 1.45]]);
    assert.deepEqual(f.abilityEvery, WORLD_BOSS.abilityEvery);
    assert.equal(f.abilityGap, WORLD_BOSS.abilityGap);
    const prefix = t.id.replace('titan_', '');
    for (const a of kit(t)) {
      assert.ok(!COLOSSUS_IDS.includes(a.id), a.id);
      assert.ok(a.id.startsWith(`${prefix}_`), a.id);
      assert.ok(!seen.has(a.id), `id en double : ${a.id}`);
      seen.add(a.id);
      assert.ok(a.name && a.text, a.id);
      assert.equal(typeof TITAN_SKILLS[a.id], 'function', `rendu manquant : ${a.id}`);
      assert.ok(EN[a.name] && KO[a.name] && EN[a.text] && KO[a.text], `traduction manquante : ${a.id}`);
    }
  }
  assert.equal(seen.size, 35);
  // Colosse, Ombre et géants : inchangés.
  assert.deepEqual(GRAND_BOSSES.colossus.fight.abilities.map((a) => a.id), ['boulder', 'eyebeam']);
});

test('pickAbility : la 3e attaque partage le tour de la 2e (même cadence, mêmes parts de PV)', () => {
  for (const t of DAY_TITANS) {
    const cfg = t.fight, old = OLD(t);
    for (let ph = 0; ph <= 2; ph++) {
      for (let n = 0; n < 24; n++) assert.equal(pickAbility(ph, n, cfg).hit, pickAbility(ph, n, old).hit);
    }
    const p2 = Array.from({ length: 8 }, (_, n) => pickAbility(2, n, cfg).id);
    assert.deepEqual(new Set(p2), new Set(cfg.abilities.map((a) => a.id)));
  }
  // Colosse : alternance d'avant.
  assert.deepEqual([0, 1, 2, 3].map((n) => pickAbility(1, n).id), ['boulder', 'eyebeam', 'boulder', 'eyebeam']);
});

test('PV du boss du jour identiques (bossHpForDay et mesure de chaque Titan)', () => {
  const s = probeState();
  assert.equal(bossHpForDay(s), 964); // valeur mesurée avant v10.16 (partie neuve, étape 120)
  for (const t of DAY_TITANS) {
    const now = new WorldBossFight(s, { bossId: t.id, seed: 7, maxHp: 0 }).finish().damage;
    const before = withFight(t, OLD(t), () => new WorldBossFight(s, { bossId: t.id, seed: 7, maxHp: 0 }).finish().damage);
    assert.equal(now, before, t.id);
    assert.equal(now, 918, t.id);
  }
});

test('dégâts reçus par le héros identiques à avant (à 1 % près)', () => {
  const s = probeState();
  for (const t of DAY_TITANS) {
    const run = () => {
      const f = new WorldBossFight(s, { bossId: t.id, seed: 11, maxHp: 459 });
      f.finish();
      return { taken: f.out.reduce((a, e) => a + (e.damage ?? 0), 0), hp: f.world.hero.hp };
    };
    const now = run();
    const before = withFight(t, OLD(t), run);
    assert.ok(Math.abs(now.taken - before.taken) <= before.taken * 0.01, `${t.id} : ${now.taken} / ${before.taken}`);
    assert.ok(Math.abs(now.hp - before.hp) <= Math.max(1, before.hp * 0.01), t.id);
  }
});

test('60 s de chaque Titan (graine fixe, scène dessinée) : ses 5 compétences jouées sans erreur', () => {
  const st = sanitizeState(JSON.parse(readFileSync('tests/fixtures/endgame.json', 'utf8')));
  const probe = new WorldBossFight(st, { seed: 7, maxHp: 0 }).finish().damage;
  for (const t of DAY_TITANS) {
    const fight = new WorldBossFight(st, { bossId: t.id, seed: 21, maxHp: Math.max(1, probe * 0.3) });
    const scene = new WorldBossScene({ width: 1, height: 1, style: {}, parentElement: null, getContext: () => ctx2d }, fight);
    scene.r.resize?.(1366, 520);
    while (!fight.done) { fight.tick(); scene.frame(1 / 60); }
    scene.settle(600);
    const ids = new Set(fight.out.filter((e) => e.id).map((e) => e.id));
    for (const a of kit(t)) assert.ok(ids.has(a.id), `${t.id} : ${a.id} jamais déclenchée (${[...ids]})`);
    for (const id of ids) assert.ok(!COLOSSUS_IDS.includes(id), id);
    assert.ok(scene.titanFx, 'effets du Titan créés');
    assert.equal(scene.titanFx.list.length, 0, 'tous les effets se terminent');
  }
});

test('rendu : pas de croissant ni de fx_slash, branché dans special() avant le Colosse', () => {
  const src = readFileSync('src/render/titan-skills.js', 'utf8');
  assert.ok(!/crescent\s*\(/.test(src));
  assert.ok(!/['"]fx_slash/.test(src));
  assert.ok(!/['"]wb_(boulder|eye_charge|beam_flash|beam_burn)['"]/.test(src), 'pas de rocher ni de rayon du Colosse');
  assert.ok(!/['"]sk_meteor['"]/.test(src), 'pas de pluie de braises du Colosse');
  const wb = readFileSync('src/render/world-boss-scene.js', 'utf8');
  assert.ok(wb.indexOf('TITAN_SKILLS[ev.id]') < wb.indexOf("ev.id === 'quake'"));
});
