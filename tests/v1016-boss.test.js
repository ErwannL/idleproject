// v10.16 : « un vrai combat de boss » — boss reconnaissable (A1), plus aucun croissant (A2), combo du héros (A3),
// montée en tension (A4), chiffres en éventail (A5), équipe écartée du héros contre un grand boss (A6).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  BossFeel, markHit, tintAlpha, impactOf, fanOf, shouldGroup, comboPose,
  BOSS_FLASH_GAP, TINT_ALPHA, TENSION_AFTER, GUARD_EVERY, GUARD_TIME, COMBO_RESET,
} from '../src/render/boss-feel.js';

const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

// Combat mesuré dans le rapport de test : 10 s à 60 images/s, héros 4,6 coups/s (30 % de critiques), 3 compagnons,
// un familier et des compétences (≈ 3 coups/s de plus), chaque coup touchant le boss.
function simulate(boss) {
  const fx = { hit: 0 };
  const dt = 1 / 60;
  let white = 0, frames = 0, seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const hits = [];
  for (let t = 0; t < 10; t += 1 / 4.6) hits.push({ t, crit: rnd() < 0.3 });
  for (let k = 0; k < 4; k++) for (let t = 0.1 * k; t < 10; t += 1.25) hits.push({ t, crit: rnd() < 0.2, color: ['#5aa8ff', '#ff5a4a', '#5ad46a', '#ffe0c0'][k] });
  for (let t = 0.3; t < 10; t += 0.7) hits.push({ t, crit: false, color: '#ffd23f' });
  hits.sort((a, b) => a.t - b.t);
  let i = 0;
  for (let t = 0; t < 10; t += dt) {
    fx.hit = Math.max(0, fx.hit - dt); fx.tint = Math.max(0, (fx.tint ?? 0) - dt);
    while (i < hits.length && hits[i].t <= t) {
      if (boss) markHit(fx, t, { boss, crit: hits[i].crit, color: hits[i].color });
      else fx.hit = hits[i].crit ? 0.13 : 0.08; // ancienne règle (avant v10.16), reproduite ici
      i++;
    }
    frames++; if (fx.hit > 0) white++;
  }
  return white / frames;
}

test('A1 : contre un boss, le flash blanc complet est rare — boss reconnaissable au moins 85 % du temps', () => {
  const before = simulate(false); // ancienne règle (celle des ennemis ordinaires) : chaque coup remet le flash
  const after = simulate(true);
  assert.ok(before > 0.6, `ancienne règle : boss blanc ${Math.round(before * 100)} % du temps (rapport : 81 %)`);
  assert.ok(after <= 0.15, `boss blanc ${Math.round(after * 100)} % du temps (au plus 15 %)`);
});

test('A1 : flash seulement sur un critique, au plus toutes les 0,25 s ; sinon teinte légère (≤ 35 %) et tremblement', () => {
  const fx = { hit: 0 };
  assert.equal(markHit(fx, 1, { boss: true, crit: false, color: '#ff5a4a' }), 'tint');
  assert.equal(fx.hit, 0);
  assert.ok(fx.jit > 0, 'tremblement');
  assert.equal(fx.tintColor, '#ff5a4a');
  assert.ok(tintAlpha(fx) > 0 && tintAlpha(fx) <= 0.35 && TINT_ALPHA <= 0.35);
  assert.equal(markHit(fx, 1.1, { boss: true, crit: true }), 'flash');
  assert.equal(markHit(fx, 1.1 + BOSS_FLASH_GAP - 0.01, { boss: true, crit: true }), 'tint', 'deux flashs trop rapprochés');
  assert.equal(markHit(fx, 1.1 + BOSS_FLASH_GAP, { boss: true, crit: true }), 'flash');
  const f0 = { hit: 0 }; // v10.19 (7.4) : ennemi ordinaire : flash de couleur, jamais blanc plein
  assert.equal(markHit(f0, 0, { boss: false }), 'color'); assert.equal(f0.hit, 0);
  // Coup blanc (sans élément) : teinte chaude, pas une silhouette blanche.
  const f2 = { hit: 0 }; markHit(f2, 0, { boss: true, color: '#ffffff' });
  assert.notEqual(f2.tintColor, '#ffffff');
});

test('A1 : la scène passe par markHit (coups du héros, des compagnons, des compétences) et peint une teinte, pas un flash', () => {
  const s = src('src/render/scene.js');
  assert.match(s, /markHit\(fx, this\.time, \{ boss: boss \|\| fx\.boss/);
  assert.match(s, /markHit\(this\.enemyFxFor\(event\.enemyId\), this\.time/);
  assert.doesNotMatch(s, /fx\.hit = crit \? 0\.13 : 0\.08;/, 'plus de flash direct dans hitReact');
  assert.doesNotMatch(s, /enemyFxFor\(event\.enemyId\)\.hit = 0\.08/, 'plus de flash direct sur enemyHit');
  assert.match(s, /tintAlpha\(fx\)/);
});

test('A2 : plus aucun croissant — ni fx_slash* dans les effets de combat, ni crescent() dans skill-fx.js', () => {
  for (const f of ['src/render/scene.js', 'src/render/skill-fx.js', 'src/render/class-fx.js']) {
    const code = src(f).split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
    assert.doesNotMatch(code, /sprite\(\[['"]fx_slash/, `${f} : effet fx_slash*`);
    assert.doesNotMatch(code, /\bcrescent\(/, `${f} : crescent()`);
  }
  const fx = src('src/render/skill-fx.js');
  for (const name of ['heavy_cut', 'valiant_cut', 'void_blade', 'eclipse']) {
    const body = fx.slice(fx.indexOf(`  ${name}(s, c`), fx.indexOf('\n  },', fx.indexOf(`  ${name}(s, c`)));
    assert.match(body, /vslash|thrust|groundWave|heavy_cut/, `${name} : estoc, entaille ou onde au sol`);
  }
});

test('A2 : chaque compagnon a son impact (bouclier, coup lourd, flèche, morsure ou griffe), avec les VFX existants', () => {
  assert.equal(impactOf({ id: 'squire', kind: 'ally' }, 'melee').vfx, 'sk_shield_bash');
  assert.equal(impactOf({ id: 'squire', kind: 'ally' }, 'melee').shards, '#7fb0ff', 'éclats bleus');
  const merc = impactOf({ id: 'mercenary', kind: 'ally' }, 'melee');
  assert.equal(merc.vfx, 'hit_blunt'); assert.ok(merc.dust); assert.equal(merc.shards, '#ff5a4a');
  assert.equal(impactOf({ id: 'ranger', kind: 'ally' }, 'archer').vfx, 'hit_arrow');
  assert.deepEqual([impactOf({ id: 'cat', kind: 'pet' }, 'melee', true).vfx, impactOf({ id: 'cat', kind: 'pet' }, 'melee', false).vfx], ['sk_bite', 'sk_claw']);
  const art = src('src/render/art-vfx.js');
  for (const v of ['sk_shield_bash', 'hit_blunt', 'hit_arrow', 'sk_bite', 'sk_claw']) assert.match(art, new RegExp(`"${v}"`), `${v} dessiné`);
});

test('A3 : combo du héros contre un boss — cycle de 4 coups, coup final sauté, avance de 6 à 10 px', () => {
  const f = new BossFeel();
  f.update(0, { id: 1 });
  const steps = [0, 0.2, 0.4, 0.6, 0.8, 1.0].map((t) => f.strike(t));
  assert.deepEqual(steps, [0, 1, 2, 3, 0, 1]);
  f.strike(3); f.strike(3.2); f.strike(3.4); f.strike(3.6);
  const adv = f.advance(3.6);
  assert.ok(adv >= 6 && adv <= 10, `avance ${adv} px`);
  assert.equal(f.advance(4.5), 0, 'revient ensuite');
  assert.equal(f.strike(3.6 + COMBO_RESET + 0.1), 0, 'une pause relance le cycle');
  assert.ok(comboPose(3, 0.5).dy <= -10, 'coup final : saut');
  assert.ok(comboPose(2, 0.5).dx > 0, 'estoc : pas en avant');
  assert.ok(comboPose(1, 0.5).dy > 0, 'taille basse : accroupi');
  const s = src('src/render/scene.js');
  assert.match(s, /step === 3[\s\S]{0,400}hitstop = Math\.max\(this\.hitstop \?\? 0, 0\.1\); this\.shake = Math\.max\(this\.shake, 3\)/, 'arrêt sur image 0,1 s et secousse 3');
  const c = src('src/render/class-fx.js');
  assert.match(c, /event\.combo/, 'tireurs et mages : double flèche, flèche chargée, salve, gros sort');
});

test('A4 : montée en tension — « Garde brisée ! » toutes les 10 s après 8 s, dégâts de la seconde en un seul chiffre', () => {
  const f = new BossFeel();
  const boss = { id: 42 };
  const ev = [];
  for (let t = 0; t <= 40.5; t += 0.05) for (const e of f.update(t, boss)) ev.push({ ...e, t: Math.round(t * 100) / 100 });
  const guards = ev.filter((e) => e.type === 'guard').map((e) => e.t);
  assert.deepEqual(guards.map((t) => Math.round(t)), [10, 20, 30, 40]);
  assert.ok(guards[0] >= TENSION_AFTER, 'jamais avant 8 s');
  assert.equal(GUARD_EVERY, 10);
  const g = new BossFeel();
  g.update(0, boss);
  g.update(10, boss); // garde brisée
  assert.ok(g.guarding(10.5));
  assert.ok(g.absorb(10.2, 100, 300)); assert.ok(g.absorb(10.6, 50, 300));
  const end = g.update(10 + GUARD_TIME, boss).find((e) => e.type === 'guardEnd');
  assert.equal(end.sum, 150);
  assert.equal(g.absorb(11.5, 10, 300), false, 'hors de la garde brisée : chiffres normaux');
  const h = new BossFeel(); h.update(0, boss); h.update(5, { id: 43 });
  assert.equal(h.tension(12), false, 'nouveau boss : la tension repart de zéro');
  assert.equal(h.tension(13.1), true);
  const s = src('src/render/scene.js');
  assert.match(s, /'Garde brisée !'/); assert.match(s, /Combo ×\$\{feel\.combo\}/);
  assert.match(s, /this\.slowmo = KILL_SLOWMO/, 'coup fatal au ralenti');
  assert.match(src('src/audio/game-audio.js'), /setIntensity/, 'musique plus intense sous 20 %');
  for (const l of ['en', 'ko']) assert.match(src(`src/i18n/${l}-1016.js`), /'Garde brisée !'/);
});

test('A5 : chiffres en éventail (gauche/droite alternés, montée variable), regroupés au-delà de 6 par seconde', () => {
  const f = [1, 2, 3, 4].map(fanOf);
  assert.ok(f[0].dx > 0 && f[1].dx < 0 && f[2].dx > 0, 'côtés alternés');
  assert.notEqual(f[0].rise, f[1].rise, 'montée variable');
  assert.equal(shouldGroup([0.1, 0.2, 0.3, 0.4, 0.5], 0.6), false);
  assert.equal(shouldGroup([0.1, 0.2, 0.3, 0.4, 0.5, 0.55], 0.6), true);
  assert.match(src('src/render/vfx.js'), /fx\.rise/);
});

test('A6 : grand boss — compagnons à 18 px d\'écran au moins du héros, bandeau DANGER en haut de la scène', () => {
  const s = src('src/render/scene.js');
  const gap = Number(s.match(/const BIG_BOSS_GAP = (\d+)/)[1]);
  assert.ok(gap * 3 >= 18, `${gap} px de jeu × 3 ≥ 18 px d'écran`);
  assert.match(s, /pose\.dx = Math\.min\(pose\.dx, a\.room\)/);
  assert.match(src('src/ui/style.css'), /\.boss-warning \{[^}]*align-items: flex-start/);
  assert.match(src('src/ui/world-boss.js'), /h \* 0\.6 \* vw/, 'téléphone : scène du World Boss sur 60 % de la hauteur');
});
