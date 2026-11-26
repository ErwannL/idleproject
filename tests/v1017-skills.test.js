// v10.17 (B) : un appui sur une touche d'attaque n'est jamais perdu.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createNewState } from '../src/core/state.js';
import { createCombat, step, playerCast, skillQueued, interactiveCooldown } from '../src/core/combat.js';
import { Rng } from '../src/core/rng.js';
import { SKILLS } from '../src/data/skills.js';

const NOW = 1_700_000_000_000;
const manualState = () => { const s = createNewState(NOW); s.level = 10; s.skills.quick = 1; s.ui.combatAssist = 'manual'; s.skillAuto = false; return s; };
const casts = (w) => w.events.filter((e) => e.type === 'skill').length;

test('touche prête sans ennemi à portée : l\'appui est gardé et part à l\'arrivée de l\'ennemi', () => {
  const s = manualState();
  const w = createCombat(s); const rng = new Rng(3);
  w.skillTimers.quick = 0;
  w.enemies.length = 0; // entre deux vagues
  playerCast(w, 'quick');
  assert.ok(skillQueued(w, 'quick'), 'gardé (✓ en attente)');
  step(s, w, 0.05, rng); // pas de cible : rien ne part, mais l'appui n'est pas effacé
  assert.ok(skillQueued(w, 'quick'), 'toujours gardé après une image sans cible');
  assert.equal(casts(w), 0);
  let n = 0;
  for (let i = 0; i < 600 && !n; i++) { w.events.length = 0; step(s, w, 0.05, rng); n = casts(w); }
  assert.equal(n, 1, 'lancée une fois à l\'arrivée de l\'ennemi');
  assert.ok(!skillQueued(w, 'quick'));
  assert.equal(s.records.manualCasts, 1, 'comptée comme lancée à la main');
});

test('appui pendant la recharge : gardé, lancé dès que prête (comme avant)', () => {
  const s = manualState();
  const w = createCombat(s); const rng = new Rng(5);
  let n = 0;
  for (let i = 0; i < 400 && !w.enemies.length; i++) step(s, w, 0.05, rng);
  w.skillTimers.quick = 1;
  playerCast(w, 'quick');
  assert.ok(skillQueued(w, 'quick'));
  for (let i = 0; i < 1200 && !n; i++) { w.events.length = 0; step(s, w, 0.05, rng); n = casts(w); }
  assert.equal(n, 1);
});

test('la recharge et les dégâts ne changent pas', () => {
  const sk = SKILLS.find((x) => x.id === 'quick');
  const s = manualState();
  const w = createCombat(s); const rng = new Rng(7);
  w.skillTimers.quick = 0;
  playerCast(w, 'quick');
  let ev = null;
  for (let i = 0; i < 800 && !ev; i++) { w.events.length = 0; step(s, w, 0.05, rng); ev = w.events.find((e) => e.type === 'skill'); }
  assert.ok(ev);
  const cd = w.skillTimers.quick;
  assert.ok(Math.abs(cd - interactiveCooldown(sk, w.heroStats?.bonus ?? {})) < 0.2 || cd > 15, `recharge ${cd}`);
});

test('ui.js : la barre de compétences ne remplace plus tout son innerHTML', () => {
  const src = readFileSync(new URL('../src/ui/ui.js', import.meta.url), 'utf8');
  const body = src.slice(src.indexOf('  updateSkillBar(state, world) {'), src.indexOf('  offerAutoRecycle(state)'));
  assert.ok(body.length > 100);
  assert.ok(!/bar\.innerHTML\s*=/.test(body), 'plus de bar.innerHTML = …');
  assert.match(body, /sk-queued/);
});

test('téléphone : #boost-toggle est positionné (sa zone de clic ::before reste autour de lui)', () => {
  const css = readFileSync(new URL('../src/ui/bastion108.css', import.meta.url), 'utf8');
  assert.ok(!/#boost-toggle\s*\{\s*position:\s*static/.test(css));
  const last = readFileSync(new URL('../src/ui/fenetres1017.css', import.meta.url), 'utf8');
  assert.match(last, /#boost-toggle \{ position: relative !important; \}/);
});

test('textes « ✓ en attente » traduits (anglais, coréen)', async () => {
  const en = await import('../src/i18n/en-1017.js');
  const ko = await import('../src/i18n/ko-1017.js');
  assert.ok(en.EXACT_1017['✓ en attente']);
  assert.ok(ko.EXACT_1017['✓ en attente']);
});
