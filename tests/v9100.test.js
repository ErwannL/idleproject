// v9.10 : Veillée (jamais par défaut sur PC fenêtré, jamais la 1re heure), Survie à 3, équipement des compagnons
// (sac et coffre, objets protégés compris), sauvegarde des nouveaux réglages.
import test from 'node:test';
import assert from 'node:assert/strict';
import { vigilAllowed } from '../src/core/vigil.js';
import { createNewState, sanitizeState } from '../src/core/state.js';
import { Rng } from '../src/core/rng.js';
import { runSurvival } from '../src/core/arena.js';
import { COMPANIONS } from '../src/data/companions.js';
import { bestGearFor, equipBestAllGear, gearWaiting, rollGear, unitGear } from '../src/core/companion-gear.js';
import { gearClassOf } from '../src/data/companion-gear.js';

test('Veillée : PC fenêtré jamais par défaut ; téléphone ou plein écran après 1 h ; réglage Jamais/Toujours', () => {
  const s = { ui: {}, playSeconds: 7200 };
  assert.equal(vigilAllowed(s, {}), false);
  assert.equal(vigilAllowed(s, { phone: true }), true);
  assert.equal(vigilAllowed(s, { fullscreen: true }), true);
  assert.equal(vigilAllowed({ ui: {}, playSeconds: 1200 }, { phone: true }), false); // première heure
  assert.equal(vigilAllowed({ ui: { vigil: 'always' }, playSeconds: 7200 }, {}), true);
  assert.equal(vigilAllowed({ ui: { vigil: 'never' }, playSeconds: 7200 }, { phone: true }), false);
});

test('sauvegarde : mode de Veillée et compteurs du Sceau relus ; ancien « false » = Jamais', () => {
  const s = createNewState();
  s.ui.vigil = 'always'; s.ui.sealCount = { claim: 4 }; s.ui.sealMiniUntil = 99;
  const back = sanitizeState(JSON.parse(JSON.stringify(s)));
  assert.equal(back.ui.vigil, 'always');
  assert.deepEqual(back.ui.sealCount, { claim: 4 });
  assert.equal(back.ui.sealMiniUntil, 99);
  const old = createNewState(); old.ui.vigil = false;
  assert.equal(sanitizeState(JSON.parse(JSON.stringify(old))).ui.vigil, 'never');
});

test('Survie : équipe de 1 à 3, ennemis plus forts avec l\'équipe', () => {
  const s = createNewState();
  s.maxStage = 999;
  const ids = COMPANIONS.filter((c) => c.kind === 'ally').slice(0, 3).map((c) => c.id);
  for (const id of ids) s.companions.owned[id] = { stars: 1, level: 10 };
  const r = runSurvival(s, ids, Date.UTC(2026, 10, 18));
  assert.ok(r);
  assert.equal(r.team.length, 3);
  assert.equal(r.waves[0].foes[0].maxHp > 0, true);
  const one = runSurvival(s, ids[0], Date.UTC(2026, 10, 18));
  assert.equal(one.team.length, 1);
  assert.ok(r.waves[0].foes[0].maxHp > one.waves[0].foes[0].maxHp);
});

test('compagnons : « Équiper le meilleur » prend aussi le coffre et les objets protégés ; pastille quand un objet attend', () => {
  const s = createNewState();
  const c = COMPANIONS.find((x) => x.kind === 'ally');
  s.companions.owned[c.id] = { stars: 1, level: 5 };
  s.companions.equipped = [c.id];
  assert.equal(gearWaiting(s, c.id), false);
  // Un objet de sa classe, protégé, rangé au coffre : il est proposé puis équipé (sorti du coffre).
  const item = rollGear(s, new Rng(3), { cls: gearClassOf(c) });
  item.locked = true;
  s.stash.push(item);
  assert.equal(gearWaiting(s, c.id), true);
  assert.equal(equipBestAllGear(s), 1);
  assert.ok(Object.values(unitGear(s, c.id)).some((i) => i?.id === item.id));
  assert.ok(!s.stash.includes(item));
});
