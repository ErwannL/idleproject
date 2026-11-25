// v10.15 : Géants (nouveaux grands boss à silhouette propre), moteur des planches facultatives, rotation des Fêtes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createNewState } from '../src/core/state.js';
import { WorldBossFight } from '../src/core/world-boss.js';
import { GIANTS, GIANT_ANIM_DEFS, GIANT_ORDER, GIANT_REQUIRED_ANIMS, GRAND_BOSSES, GRAND_BOSS_IDS, READY_GIANTS, bossSince } from '../src/data/grand-bosses.js';
import { validateItem } from '../server/live.mjs';
import { FEST_MONTHS, FEST_POOLS, festBoss, festMonth } from '../src/data/fest.js';
import { ZONES } from '../src/data/zones.js';
import { LIVE_EVENT_TYPES } from '../src/data/live-catalog.js';
import { ANIM_FALLBACK, artLook, resolveAnim } from '../src/render/world-boss-scene.js';

// Largeur d'un PNG (en-tête IHDR), sans dépendance.
function pngSize(path) {
  const b = readFileSync(path);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

test('8 géants, chacun complet et différent', () => {
  assert.equal(GIANTS.length, 8);
  assert.equal(new Set(GIANTS.map((g) => g.id)).size, 8);
  assert.equal(new Set(GIANTS.map((g) => g.name)).size, 8);
  for (const g of GIANTS) {
    assert.ok(!GRAND_BOSSES[g.id] || g.ready, `${g.id} : hors du jeu tant qu'il n'est pas prêt`);
    for (const a of GIANT_REQUIRED_ANIMS) assert.ok(g.art.anims[a], `${g.id} : animation ${a}`);
    assert.equal(g.art.eyes.beam.length, g.art.anims.beam.n, `${g.id} : un repère de souffle par image`);
    assert.ok(g.art.hands.throw, `${g.id} : point de départ du projectile`);
    for (const v of g.art.hands.throw) assert.ok(v >= 0 && v < g.art.frame, `${g.id} : main dans l'image`);
    // Seules les obligatoires et les planches posées (`extra`) sont déclarées : jamais d'animation sans fichier.
    for (const k of Object.keys(g.art.anims)) assert.ok(k === 'rise' || k in GIANT_ANIM_DEFS, `${g.id} : ${k}`);
    if (!g.ready) assert.deepEqual(Object.keys(g.art.anims).filter((k) => k !== 'rise').sort(), [...GIANT_REQUIRED_ANIMS].sort());
    assert.ok(g.ready ? /^\d{4}-\d{2}$/.test(g.from ?? '') : true, `${g.id} : mois « from » obligatoire une fois prêt`);
    assert.equal(g.fight.phases.length, 3);
    assert.deepEqual(g.fight.abilities.map((a) => a.id), ['boulder', 'eyebeam']);
    assert.ok(ZONES.some((z) => z.id === g.zone), `${g.id} : décor ${g.zone}`);
    assert.equal(ZONES[g.mapZone]?.id, g.zone, `${g.id} : la Carte de la fête prend le décor du géant`);
    assert.match(g.accent, /^#[0-9a-f]{6}$/);
  }
});

test('géant prêt : chaque planche existe, au bon format, et ses repères tombent dans l\'image', () => {
  for (const g of GIANTS.filter((x) => x.ready)) {
    const { frame } = g.art;
    for (const [name, a] of Object.entries(g.art.anims)) {
      if (a.src) continue;
      const file = `${g.art.dir}/${g.art.prefix}${name}.png`;
      assert.ok(existsSync(file), `${file} manquante`);
      const { w, h } = pngSize(file);
      assert.equal(h, frame, `${file} : hauteur ${frame}`);
      assert.equal(w, a.n * frame, `${file} : ${a.n} images de ${frame} px`);
    }
    for (const e of g.art.eyes.beam) for (const v of e) assert.ok(v >= 0 && v < frame);
    for (const v of g.art.hands.throw) assert.ok(v >= 0 && v < frame);
  }
});

test('planches facultatives : une animation absente prend la plus proche', () => {
  const art = { frame: 128, anims: { idle: { n: 8 }, attack: { n: 9 }, beam: { n: 13 } } };
  assert.equal(resolveAnim(art, 'beam3'), 'beam');
  assert.equal(resolveAnim(art, 'throw3'), 'attack');
  assert.equal(resolveAnim(art, 'quake'), 'attack');
  assert.equal(resolveAnim(art, 'fury'), 'idle');
  assert.equal(resolveAnim(art, 'rise'), 'idle');
  assert.equal(resolveAnim(art, 'inconnue'), 'idle');
  for (const k of Object.keys(ANIM_FALLBACK)) assert.ok(resolveAnim(art, k) in art.anims);
  // Le Colosse a toutes ses planches : rien ne change pour lui.
  for (const k of Object.keys(GRAND_BOSSES.colossus.art.anims)) assert.equal(resolveAnim(GRAND_BOSSES.colossus.art, k), k);
});

test('repères par défaut = ceux du Colosse ; un géant a les siens', () => {
  const c = artLook(GRAND_BOSSES.colossus.art);
  assert.deepEqual(c.box, [8, 6, 112, 116]);
  assert.equal(c.shadow, 44);
  assert.equal(c.projectile.vfx, 'wb_boulder');
  const lev = artLook(GIANTS.find((g) => g.id === 'leviathan').art);
  assert.equal(lev.projectile.tint, '#3fa8ff');
  assert.equal(lev.debris, null);
});

test('un géant prêt se combat avec le moteur commun', () => {
  const g = GIANTS[0];
  GRAND_BOSSES[g.id] = g; // comme si ses planches étaient posées
  try {
    const s = createNewState();
    s.stage = 120; s.maxStage = 120;
    const f = new WorldBossFight(s, { bossId: g.id, seed: 3, maxHp: 1e9 });
    assert.equal(f.bossId, g.id);
    const r = f.finish();
    assert.ok(r.damage > 0);
    assert.ok(f.out.some((e) => e.type === 'ability'), 'au moins une attaque propre');
  } finally { if (!g.ready) delete GRAND_BOSSES[g.id]; }
});

test('Fêtes : les 6 mois écrits gardent leur Titan, un mois sur deux ensuite accueille un géant prêt', () => {
  const before = ['titan_ember', 'titan_thorn', 'titan_sun', 'titan_void', 'titan_tide', 'colossus'];
  for (let i = 0; i < FEST_MONTHS.length; i++) assert.equal(festMonth(i).grand.boss, before[i]);
  // Aucun géant prêt : la rotation d'avant, inchangée.
  for (let i = 0; i < 24; i++) assert.equal(festBoss(i, []), FEST_POOLS.boss[i % FEST_POOLS.boss.length]);
  // Tous prêts : mois 7, 9, 11… = géants dans l'ordre ; mois 8, 10… = Titans.
  const all = GIANT_ORDER;
  for (let k = 0; k < 16; k++) {
    const b = festBoss(FEST_MONTHS.length + k, all);
    if (k % 2 === 0) assert.equal(b, all[(k / 2) % all.length]);
    else assert.ok(FEST_POOLS.boss.includes(b));
  }
  // Un seul prêt : seul son mois change.
  const one = [GIANT_ORDER[1]];
  assert.equal(festBoss(FEST_MONTHS.length + 2, one), GIANT_ORDER[1]);
  assert.equal(festBoss(FEST_MONTHS.length, one), FEST_POOLS.boss[FEST_MONTHS.length % FEST_POOLS.boss.length]);
  // Un géant prêt n'entre jamais avant son mois « from » (une fête commencée ne change pas de boss).
  const g = GIANTS[1];
  const keep = g.from;
  g.from = '2099-01';
  try { assert.notEqual(festBoss(FEST_MONTHS.length + 2, [g.id]), g.id); } finally { g.from = keep; }
  // Le boss de chaque mois existe toujours vraiment (jamais un géant sans planches).
  for (let i = 0; i < 24; i++) assert.ok(GRAND_BOSSES[festMonth(i).grand.boss], `mois ${i}`);
  assert.deepEqual(READY_GIANTS, GIANTS.filter((g) => g.ready).map((g) => g.id));
});

test('admin : tous les grands boss jouables se programment (Titans du jour compris), pas les géants en attente', () => {
  const values = LIVE_EVENT_TYPES.grandBoss.params.boss.values;
  assert.deepEqual(values, GRAND_BOSS_IDS);
  assert.ok(values.includes('titan_ember'));
  for (const g of GIANTS) assert.equal(values.includes(g.id), Boolean(g.ready));
});

test('un géant sans planches facultatives retombe sur les obligatoires (phase 3 comprise)', () => {
  const art = GIANTS[0].art;
  for (const k of ['idle3', 'attack3', 'hurt3', 'throw3', 'beam3', 'quake', 'embers', 'transform', 'fury', 'rise']) {
    const r = resolveAnim(art, k);
    assert.ok(GIANT_REQUIRED_ANIMS.includes(r) || (k === 'rise' && r === 'rise'), `${k} → ${r}`);
  }
});

test('admin : un événement qui choisit un boss récent relève la version minimale du client', () => {
  assert.equal(bossSince('colossus'), '9.3.0');
  assert.equal(bossSince('titan_ember'), '9.8.0');
  const v = validateItem({ kind: 'event', ref: 'grandBoss', data: { params: { boss: 'titan_ember' } } });
  assert.equal(v.minClient, '9.8.0');
  assert.throws(() => validateItem({ kind: 'event', ref: 'grandBoss', minClient: '9.7.1', data: { params: { boss: 'titan_ember' } } }), /9\.8\.0/);
  const c = validateItem({ kind: 'event', ref: 'grandBoss', data: { params: { boss: 'colossus' } } });
  assert.equal(c.minClient, '9.7.1'); // version du gabarit, inchangée
  for (const g of GIANTS) assert.equal(g.since, '10.15.0');
});
