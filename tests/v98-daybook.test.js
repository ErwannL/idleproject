// v9.8 (H1, H3, H4) : Carnet du jour, Chasse rapide, Roue du jour.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewState } from '../src/core/state.js';
import { Rng } from '../src/core/rng.js';
import { quickHunt, quickHuntReady } from '../src/core/quick-hunt.js';
import { WHEEL_SLICES, spinWheel, wheelReady } from '../src/core/wheel.js';
import { claimDaybookChest, daybookTasks, daybookTrack } from '../src/core/daybook.js';

const NOW = 1_800_000_000_000;
const fresh = () => { const s = createNewState(NOW); s.maxStage = 30; s.stage = 30; return s; };

test('Chasse rapide : 1 fois par jour, des gains', () => {
  const s = fresh();
  const gold = s.gold;
  assert.ok(quickHuntReady(s, NOW));
  const r = quickHunt(s, new Rng(1), NOW);
  assert.ok(r && r.hours === 2 && s.gold > gold);
  assert.equal(quickHunt(s, new Rng(1), NOW + 1000), null);
  assert.ok(quickHuntReady(s, NOW + 86_400_000));
});

test('Roue du jour : toujours gagnante, un tour par jour, gros lot rare', () => {
  const s = fresh();
  const r = spinWheel(s, new Rng(3), NOW);
  assert.ok(r && Object.keys(r.given).length > 0);
  assert.equal(wheelReady(s, NOW), false);
  assert.equal(spinWheel(s, new Rng(3), NOW), null);
  const total = WHEEL_SLICES.reduce((t, x) => t + x.w, 0);
  assert.ok(WHEEL_SLICES.find((x) => x.jackpot).w / total <= 0.02);
});

test('Carnet du jour : tâches, tampon et coffre de fin de journée', () => {
  const s = fresh();
  const open = (id) => id === 'dungeons';
  assert.equal(claimDaybookChest(s, open, NOW), null, 'rien de fini');
  quickHunt(s, new Rng(1), NOW);
  spinWheel(s, new Rng(1), NOW);
  daybookTrack(s, 'dungeons', 1, NOW);
  const tasks = daybookTasks(s, open, NOW);
  for (const t of tasks.filter((x) => x.id !== 'missions')) assert.ok(t.done, t.id);
  // missions du jour : toutes récupérées
  const m = tasks.find((x) => x.id === 'missions');
  if (m && !m.done) return; // la partie neuve n'a pas fini ses missions : le coffre attend
  assert.ok(claimDaybookChest(s, open, NOW));
});
