// v10.1 (P1) : Sceau avec « pourquoi », mise de côté, glossaire, avant → après distinct, coffres en 2 lignes, ressources dormantes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewState } from '../src/core/state.js';
import { nextAction } from '../src/core/guide.js';
import { RESOURCES, GLOSSARY } from '../src/data/glossary.js';
import { dormantResources, daybookTasks } from '../src/core/daybook.js';
import { LEARN, HOWTO } from '../src/ui/learn.js';

test('Sceau : chaque action proposée a un « pourquoi » non vide', () => {
  const s = createNewState();
  for (const gold of [0, 50, 5000, 1e6]) {
    s.gold = gold;
    const n = nextAction(s, {});
    if (n) assert.ok(n.why && n.why.length > 3, `pas de pourquoi pour ${n.id}`);
  }
});

test('Sceau : une action mise de côté n\'est plus proposée', () => {
  const s = createNewState(); s.gold = 1e6;
  const a = nextAction(s, {});
  assert.ok(a);
  const b = nextAction(s, { aside: new Set([a.id]) });
  assert.notEqual(b?.id, a.id);
});

test('glossaire : chaque ressource a nom, usage, source et écran ; mots clés présents', () => {
  for (const k of ['gold', 'gems', 'shards', 'keys', 'grimoire', 'ascension', 'fragments', 'mastery', 'tickets']) {
    const r = RESOURCES[k];
    assert.ok(r?.name && r.use && r.where && r.tab, k);
  }
  for (const w of ['Contrat', 'Haut fait', 'Collections', 'Familier', 'Éveil']) assert.ok(GLOSSARY[w], w);
});

test('ordre d\'apprentissage : étapes croissantes 1 → 30, 3 cartes « Comment jouer »', () => {
  assert.equal(HOWTO.length, 3);
  assert.deepEqual(LEARN.map((l) => l.stage), [1, 2, 4, 6, 8, 10, 15, 25, 30]);
});

test('ressources dormantes : clés > 5 et tickets signalés, ligne Arène au Carnet', () => {
  const s = createNewState(); s.keys = 8; s.wallet = { ...(s.wallet ?? {}), ticketLimited: 2 };
  const d = dormantResources(s).map((x) => x.id);
  assert.ok(d.includes('keys') && d.includes('tickets') && d.includes('arena'));
  s.keys = 3;
  assert.ok(!dormantResources(s).some((x) => x.id === 'keys'));
  assert.ok(daybookTasks(s).some((t) => t.id === 'arena'));
});

import { startDungeon, completeDungeon, sweepDungeonN, dungeonKill } from '../src/core/dungeon.js';
import { offerDoors, chooseDoor, dungeonStars, nightmareOpen, mainGain, DUNGEON_GAIN } from '../src/core/dungeon-plus.js';
import { DUNGEONS } from '../src/data/dungeons.js';
import { Rng } from '../src/core/rng.js';
const rng = (seed = 1) => new Rng(seed);

test('donjons : gain principal pour chacun, étoiles, gros coffre au premier passage, Cauchemar après 3 étoiles', () => {
  for (const d of DUNGEONS) assert.ok(DUNGEON_GAIN[d.id] && Object.keys(mainGain(d)).length === 1, d.id);
  const s = createNewState(); s.maxStage = 200; s.keys = 20;
  assert.ok(startDungeon(s, 'crypt', 'any', 'gold', 'easy'));
  const r = completeDungeon(s, rng());
  assert.ok(r.first && r.chest && r.chest.keys === 2);
  assert.equal(dungeonStars(s, 'crypt'), 1);
  assert.equal(nightmareOpen(s, 'crypt'), 0);
  s.dungeonBest.crypt = 2;
  assert.equal(nightmareOpen(s, 'crypt'), 1);
  assert.ok(startDungeon(s, 'crypt', 'any', 'gold', 'hard', 'normal', 1));
  assert.equal(s.dungeon.nightmare, 1);
  completeDungeon(s, rng());
  assert.equal(s.dungeonNightmare.crypt, 1);
});

test('donjons : portes (2 au choix, auto, Élite double, Trésor paie), Balayer ×N', () => {
  const s = createNewState(); s.maxStage = 200; s.keys = 10;
  startDungeon(s, 'crypt');
  const doors = offerDoors(s, rng(3));
  assert.equal(doors.length, 2);
  assert.notEqual(doors[0], doors[1]);
  const c = chooseDoor(s, null, 100);
  assert.ok(doors.includes(c.door));
  s.dungeon.doors = ['treasure', 'combat'];
  const t = chooseDoor(s, 'treasure', 100);
  assert.ok(t.given.gold > 0);
  for (let i = 0; i < 5; i++) dungeonKill(s); // salle courte (Trésor) : 3 victoires suffisent
  assert.ok(s.dungeon.room >= 2);
  s.dungeon = null; s.dungeonBest.crypt = 0; s.dungeonsCleared.crypt = 1; s.keys = 4;
  const r = sweepDungeonN(s, 'crypt', rng(), 3, { difficulty: 'easy' });
  assert.equal(r.count, 3); assert.equal(s.keys, 1);
});
