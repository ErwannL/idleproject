// v10.18 (partie 4) : boss — flash blanc ≤ 15 % (4.1), DANGER sous les cartes du haut sur téléphone (4.3), barre du
// boss sur 2 lignes (4.4), un seul « Moment fort » des mondes terminés (4.5), traînée courbe hors boss espacée (4.6).
// Le cadrage des grands boss (4.2) est testé dans tests/v1015-giants.test.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { markHit, tintAlpha, BOSS_FLASH_GAP, BOSS_FLASH_TIME, TINT_ALPHA, CRIT_TRAIL_GAP, critTrailAllowed } from '../src/render/boss-feel.js';
import { bossWarningPlan, topCardsBottom, PHONE_WARNING_MS } from '../src/ui/boss-warning.js';
import { worldMoments } from '../src/ui/announce-queue.js';

const src = (p) => readFileSync(p, 'utf8');

test('4.1 : un critique ne flashe que si le dernier flash a plus de 0,35 s', () => {
  assert.equal(BOSS_FLASH_GAP, 0.35);
  const fx = {};
  assert.equal(markHit(fx, 1, { boss: true, crit: true }), 'flash');
  assert.equal(markHit(fx, 1.34, { boss: true, crit: true }), 'tint');
  assert.equal(markHit(fx, 1.35, { boss: true, crit: true }), 'flash');
});

test('4.1 : critiques à chaque image pendant 8 s → boss blanc ≤ 15 % des images (flash en temps réel, même en arrêt sur image)', () => {
  for (const fps of [30, 60, 120]) {
    const fx = { hit: 0 };
    let white = 0, frames = 0;
    const dt = 1 / fps;
    for (let t = 0; t < 8; t += dt) {
      markHit(fx, t, { boss: true, crit: true });
      fx.hit = Math.max(0, fx.hit - dt); // scene.js : le flash d'un boss s'efface au temps réel (realDt)
      fx.tint = Math.max(0, (fx.tint ?? 0) - dt);
      frames++; if (fx.hit > 0) white++;
    }
    assert.ok(white / frames <= 0.15, `${fps} i/s : ${((white / frames) * 100).toFixed(1)} %`);
  }
  assert.ok(BOSS_FLASH_TIME / BOSS_FLASH_GAP <= 0.15);
  const s = src('src/render/scene.js');
  assert.match(s, /this\.realDt = dt;[^\n]*\n\s*if \(this\.hitstop > 0\)/, 'temps réel mémorisé avant le ralenti');
  assert.match(s, /fx\.hit = Math\.max\(0, fx\.hit - \(enemy\.boss \? Math\.max\(dt, this\.realDt \?\? dt\) : dt\)\)/);
});

test('4.1 : la teinte légère (≤ 35 %) ne compte pas comme du blanc', () => {
  const fx = { hit: 0 };
  assert.equal(markHit(fx, 5, { boss: true, color: '#ffffff' }), 'tint');
  assert.equal(fx.hit, 0, 'pas de flash');
  assert.notEqual(fx.tintColor.toLowerCase(), '#ffffff');
  assert.ok(TINT_ALPHA <= 0.35 && tintAlpha(fx) <= 0.35);
  const s = src('src/render/scene.js');
  assert.match(s, /if \(fx\.hit > 0\) st\.white\+\+/, 'seul fx.hit (le flash) compte comme blanc');
});

test('4.1 : capture-boss-feel échoue (code de sortie ≠ 0) au-delà de 15 % de boss blanc', () => {
  const s = src('tools/capture-boss-feel.mjs');
  assert.match(s, /const WHITE_MAX = 15;/);
  assert.match(s, /process\.exitCode = 1/);
  assert.match(s, /whitePct \?\? 0\) > WHITE_MAX/);
});

test('4.3 : DANGER sur téléphone : 2 s, posé sous les cartes du haut de la scène', () => {
  const plan = bossWarningPlan({}, { tier: 'mega', kind: 'ash_dragon', name: 'Dragon des cendres', now: 0, enemyId: 1, phone: true });
  assert.equal(plan.ms, PHONE_WARNING_MS);
  assert.equal(PHONE_WARNING_MS, 2000);
  assert.equal(plan.phone, true);
  const pc = bossWarningPlan({}, { tier: 'mega', kind: 'ash_dragon', name: 'x', now: 0, enemyId: 1 });
  assert.notEqual(pc.phone, true);
  const host = { top: 100, left: 0, right: 400, height: 500 };
  const r = (top, h, left = 10, w = 200) => ({ top, bottom: top + h, left, right: left + w, width: w, height: h });
  // carte de zone + icônes d'événements (haut), carte d'objectif dessous ; un chiffre plus bas ne compte pas
  assert.equal(topCardsBottom(host, [r(104, 60), r(104, 30, 250, 140), r(168, 40), r(420, 30)]), 108);
  assert.equal(topCardsBottom(host, []), 0);
  assert.match(src('src/ui/ui.js'), /phone: typeof document !== 'undefined' && Boolean\(document\.getElementById\('app'\)\?\.classList\.contains\('m-phone'\)\)/);
});

test('4.4 : barre du boss sur téléphone : nom sur la 1re ligne, PV courts et « Rage dans 12 s » sur la 2e', async () => {
  const s = src('src/ui/ui.js');
  assert.match(s, /export function bossPhoneLine\(hpShort, rageLeft\)/);
  assert.match(s, /setBossLines\(\{ name, line \}\)/);
  const css = src('src/ui/boss1018.css');
  assert.match(css, /#progress\.boss2 #progress-text \{ display: flex; flex-direction: column;/);
  assert.match(src('index.html'), /src\/ui\/boss1018\.css/);
  const en = await import('../src/i18n/en.js');
  const ko = await import('../src/i18n/ko.js');
  assert.equal(en.translate('2,4×10¹⁰³ PV · Rage dans 12 s'), '2,4×10¹⁰³ HP · Rage in 12 s');
  assert.equal(ko.translate('2,4×10¹⁰³ PV · Rage dans 12 s'), 'HP 2,4×10¹⁰³ · 12초 후 분노');
  assert.equal(en.translate('2,4×10¹⁰³ PV · EN RAGE'), '2,4×10¹⁰³ HP · ENRAGED');
});

test('4.5 : mondes terminés d\'un coup : seul le dernier est fêté, les autres marqués vus', () => {
  assert.deepEqual(worldMoments([0, 1, 2, 3, 4, 5, 6, 7]), { show: 7, quiet: [0, 1, 2, 3, 4, 5, 6] });
  assert.deepEqual(worldMoments([2]), { show: 2, quiet: [] });
  assert.deepEqual(worldMoments([]), { show: null, quiet: [] });
  const m = src('src/main.js');
  assert.match(m, /const wm = worldMoments\(updateStars\(state\)\);/);
  assert.match(m, /if \(quiet\) return; \/\/ v10\.18 \(4\.5\)/);
});

test('4.6 : traînée courbe (critTrail) : jamais en combat de boss, ailleurs au plus une toutes les 2 s', () => {
  assert.equal(CRIT_TRAIL_GAP, 2);
  assert.equal(critTrailAllowed(10, -99), true);
  assert.equal(critTrailAllowed(10, 8.5), false);
  assert.equal(critTrailAllowed(10, 8), true);
  assert.equal(critTrailAllowed(10, -99, { boss: true }), false);
  assert.equal(critTrailAllowed(10, -99, { focus: true }), false);
  // 20 s de critiques toutes les 0,3 s : au plus 10 traînées (16 avant, en v10.17)
  let last, n = 0;
  for (let t = 0; t < 20; t += 0.3) if (critTrailAllowed(t, last)) { last = t; n++; }
  assert.ok(n <= 10, `${n} traînées`);
  assert.match(src('src/render/scene.js'), /critTrailAllowed\(this\.time, this\.trailAt, \{ focus: this\.focus, boss: this\.bigBoss \|\| this\.bossFight \}\)/);
});
