// v9.3.8 : points de compétence (la barre les dépense d'un clic) et recyclage automatique des objets inutiles.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewState, sanitizeState } from '../src/core/state.js';
import { nextAction } from '../src/core/guide.js';
import { makeItem } from '../src/core/loot.js';
import { collectItem } from '../src/core/inventory.js';

const NOW = Date.UTC(2026, 10, 10, 12);
test('points de compétence : un clic les dépense (jamais bloqué sur un Boost)', () => {
  const s = createNewState(NOW);
  s.level = 6;
  const a = nextAction(s, { claims: [] });
  assert.equal(a.id, 'skills');
  assert.equal(a.action, 'distribute-skills');
});
test('objet inutile (autre classe, Commun) recyclé à la récupération ; réglable ; jamais un Épique', () => {
  const s = createNewState(NOW);
  s.ui.lootBag = false; // v9.7.1 : ancien ramassage direct (sans sac de butin)
  const junk = makeItem(s, 'short_sword', 'common', 1); junk.cls = 'support';
  const r = collectItem(s, junk);
  assert.ok(r.recycled && !s.inventory.includes(junk));
  const epic = makeItem(s, 'short_sword', 'epic', 1); epic.cls = 'support';
  collectItem(s, epic);
  assert.ok(s.inventory.includes(epic), 'un Épique reste');
  s.ui.autoUseless = false;
  const kept = makeItem(s, 'short_sword', 'common', 1); kept.cls = 'support';
  collectItem(s, kept);
  assert.ok(s.inventory.includes(kept));
  assert.equal(sanitizeState(JSON.parse(JSON.stringify(s))).ui.autoUseless, false, 'réglage sauvegardé');
});
