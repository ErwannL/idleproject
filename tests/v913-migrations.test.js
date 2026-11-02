// v9.1.3 (chantier 5) : migrations des refontes, testées séparément, sur une vieille sauvegarde v7 et une partie de fin.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SAVE_VERSION, sanitizeState } from '../src/core/state.js';
import { migrateCodex, migrateTickets } from '../src/core/migrations-v913.js';
import { ENCYCLOPEDIA_SECTIONS, claimSection, sectionStatus } from '../src/core/encyclopedia.js';
import { TICKET_GEMS } from '../src/data/balance.js';
import { allItems, endSave, oldSave, NOW } from './helpers/v913-saves.js';

const load = (raw) => sanitizeState(JSON.parse(JSON.stringify(raw)), undefined, NOW);

test('v9.1.3 : une seule montée de SAVE_VERSION (7 → 8)', () => {
  assert.equal(SAVE_VERSION, 8);
});

test('v9.1.3 : aucun objet perdu (ni verrouillé, ni renforcé) en migrant une vieille sauvegarde et une partie de fin', () => {
  for (const raw of [oldSave(), endSave()]) {
    const before = allItems(raw);
    const after = allItems(load(raw));
    for (const [id, item] of before) {
      assert.ok(after.has(id), `objet ${id} perdu`);
      assert.equal(after.get(id).locked, item.locked, `verrou de ${id}`);
      assert.equal(after.get(id).upgrades ?? 0, item.upgrades ?? 0, `renforts de ${id}`);
    }
    const migrated = load(raw);
    assert.deepEqual(allItems(load(JSON.parse(JSON.stringify(migrated)))).size, allItems(migrated).size, 'idempotent');
  }
});

test('lot E : tickets → gemmes (1 ticket = 100 gemmes), seul et dans la migration complète', () => {
  assert.equal(TICKET_GEMS, 100);
  const state = { gems: 10 };
  assert.equal(migrateTickets(state, { tickets: 3 }), 3);
  assert.deepEqual(state, { gems: 310 });
  assert.equal(migrateTickets(state, { tickets: -2 }), 0, 'valeur aberrante ignorée');
  assert.equal(state.gems, 310);
  const old = oldSave();
  const s = load(old);
  assert.equal(s.gems, old.gems + old.tickets * 100);
  assert.equal('tickets' in s, false);
  const end = endSave();
  const e = load(end);
  assert.equal(e.gems, end.gems + end.tickets * 100);
  assert.equal(load(e).gems, e.gems, 'rejouée : rien de plus');
});

test('lot E : Codex fondu dans l\'encyclopédie — paliers réclamés gardés, aucune double récompense', () => {
  const codex = { codex: { claimed: { monsters: 9, bosses: 2, junk: 4 } } };
  migrateCodex(codex, ENCYCLOPEDIA_SECTIONS);
  assert.deepEqual(codex.codex.claimed, { monsters: 5, bosses: 2 });
  const s = load(oldSave());
  assert.deepEqual(s.codex.claimed, { monsters: 2, bosses: 3, items: 1, companions: 1 });
  // Monstres : 11 tués, palier 3 (20) pas encore atteint → rien à récupérer deux fois.
  assert.equal(sectionStatus(s, 'monsters').next, 20);
  assert.equal(claimSection(s, 'monsters'), null);
  const e = load(endSave());
  for (const id of ['monsters', 'bosses']) {
    assert.equal(sectionStatus(e, id).next, null, `${id} : tout est déjà pris`);
    assert.equal(claimSection(e, id), null);
  }
  // Paliers précoces gardés : seuils identiques à ceux du Codex.
  assert.deepEqual(ENCYCLOPEDIA_SECTIONS.find((x) => x.id === 'bosses').milestones, [3, 6, 12, 24, 41]);
});
