// v9.8 (H8) : notifications du téléphone — 2 par jour au plus, désactivables.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewState } from '../src/core/state.js';
import { planNotifications } from '../src/core/notify-plan.js';

test('plan : 2 par jour au plus, rien si désactivé', () => {
  const s = createNewState(1);
  const now = 1_800_000_000_000;
  s.expeditions.slots[0] = { companionId: 'squire', type: 'short', start: now, end: now + 3_600_000, reward: {} };
  const list = planNotifications(s, now, { titanOpen: true });
  const perDay = {};
  for (const n of list) perDay[new Date(n.at).toDateString()] = (perDay[new Date(n.at).toDateString()] ?? 0) + 1;
  assert.ok(Object.values(perDay).every((k) => k <= 2));
  assert.ok(list.some((n) => n.id === 1));
  s.ui.notify = { phone: false };
  assert.deepEqual(planNotifications(s, now), []);
});
