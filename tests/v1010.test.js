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
