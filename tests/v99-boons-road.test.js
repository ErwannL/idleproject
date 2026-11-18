// v9.9 (K7, K8) : bénédictions de donjon et rencontres de route.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewState } from '../src/core/state.js';
import { Rng } from '../src/core/rng.js';
import { offerBoons, pickBoon, boonEffects } from '../src/core/boons.js';
import { collectBonuses } from '../src/core/bonuses.js';
import { roadDue, rollEncounter, resolveEncounter, ROAD } from '../src/core/road.js';

test('bénédiction : 3 cartes, choix auto = la plus rare, effet dans les bonus', () => {
  const s = createNewState(1);
  s.dungeon = { id: 'crypt', room: 2, kills: 0 };
  const offer = offerBoons(s, new Rng(5));
  assert.equal(offer.length, 3);
  assert.equal(new Set(offer.map((o) => o.id)).size, 3);
  const b = pickBoon(s, null);
  assert.ok(b && s.dungeon.boons.length === 1 && !s.dungeon.offer);
  const eff = boonEffects(s);
  const k = Object.keys(b.eff)[0];
  assert.ok(eff[k] > 0 && collectBonuses(s)[k] >= eff[k] - 1e-9);
  s.dungeon = null;
  assert.deepEqual(boonEffects(s), {}, 'fin du donjon : plus de bénédiction');
});

test('rencontre : due après 3 à 5 min, option sans coût par défaut', () => {
  const s = createNewState(1);
  s.playSeconds = 10;
  assert.equal(roadDue(s), false);
  s.playSeconds = 10 + ROAD.every[0] + 1;
  assert.ok(roadDue(s));
  const r = new Rng(2);
  const e = rollEncounter(s, r);
  assert.equal(e.options.length, 2);
  const gems = s.gems;
  assert.ok(resolveEncounter(s, null, r));
  assert.equal(s.gems >= gems, true, 'l\'option sans coût ne coûte rien');
  assert.ok(!s.road.open && s.road.next > s.playSeconds);
});
