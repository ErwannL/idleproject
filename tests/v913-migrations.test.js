// v9.1.3 (chantier 5) : migrations des refontes, testées séparément, sur une vieille sauvegarde v7 et une partie de fin.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SAVE_VERSION, sanitizeState } from '../src/core/state.js';
import { migrateCodex, migrateEssence, migrateMannequins, migrateMissionTrack, migrateTickets } from '../src/core/migrations-v913.js';
import { MISSION_TRACK } from '../src/data/missions.js';
import { claimTrackTier, emptyMissions, periodKey, trackNext, trackPct } from '../src/core/missions.js';
import { ENCYCLOPEDIA_SECTIONS, claimSection, sectionStatus } from '../src/core/encyclopedia.js';
import { BALANCE, ESSENCE_SHARDS, TICKET_GEMS } from '../src/data/balance.js';
import { allItems, endSave, oldSave, NOW } from './helpers/v913-saves.js';

const load = (raw) => sanitizeState(JSON.parse(JSON.stringify(raw)), undefined, NOW);

test('v9.1.3 : une seule montée de SAVE_VERSION (7 → 8)', () => {
  assert.equal(SAVE_VERSION, 12); // v9.3.4 : 11 → 12 (équipement unique) // v9.3.3 : 10 → 11 (niveaux de compétence) // v9.2.0 (monde marin) : 8 → 9 (Royaume englouti, étapes converties) · v9.2.8 : 9 → 10 (économie)
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
  // + 1 000 gemmes : missions de la semaine remplies mais pas récupérées (300 + 100) et leur coffre (600), versés à la
  // conversion des missions (test plus bas).
  assert.equal(e.gems, end.gems + end.tickets * 100 + 1000);
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

test('lot F : essences → éclats (1 essence = 10 éclats), coût des recettes inchangé', () => {
  assert.equal(ESSENCE_SHARDS, 10);
  const state = { materials: { shards: 5, essence: 0 } };
  assert.equal(migrateEssence(state, { shards: 5, essence: 7 }), 7);
  assert.deepEqual(state.materials, { shards: 75 });
  assert.equal(migrateEssence(state, { essence: 'x' }), 0);
  const end = endSave();
  const e = load(end);
  assert.equal(e.materials.shards, end.materials.shards + end.materials.essence * 10 + 110); // + mission « 30 Rares »
  assert.equal('essence' in e.materials, false);
  assert.equal(load(e).materials.shards, e.materials.shards, 'rejouée : rien de plus');
  // Recettes : ancien coût total (éclats + essences × 10) = nouveau coût.
  assert.equal(BALANCE.forge.epicCraft.shards, 60 + 6 * 10);
  assert.equal(BALANCE.forge.reforgeShards, 10 + 1 * 10);
  assert.deepEqual(BALANCE.materials.shards, { common: 1, rare: 3, epic: 8 + 10, legendary: 20 + 30 });
});

test('lot F : missions — hebdomadaires et mensuelles converties en piste du mois, sans perte ni double récompense', () => {
  const month = periodKey('monthly', NOW);
  // Seule : une mission hebdo remplie non récupérée est versée ; les compteurs du mois passent sur la piste.
  const state = { missions: emptyMissions() };
  const paid = [];
  const raw = {
    weekly: { key: 'x', progress: { kills: 3000, rareLoot: 12 }, claimed: [], bonus: false },
    monthly: { key: month, progress: { logins: 15, kills: 15000, bosses: 87, dungeons: 17, summons: 50 }, claimed: ['logins'], bonus: false },
  };
  const given = migrateMissionTrack(state, raw, month, MISSION_TRACK, (r) => { paid.push(r); return r; });
  assert.equal(given.gems, 150 + 400 + 600 + 300 + 500 + 2000, 'remplies et pas récupérées : versées, coffre du mois compris');
  assert.equal(given.keys, 5);
  assert.equal(state.missions.track.progress.kills, 15000);
  assert.equal(state.missions.track.progress.rareLoot, 12, 'semaine en cours pour les objectifs seulement hebdomadaires');
  const pct = (5 + 12 / 130) / 7 * 100;
  assert.equal(state.missions.track.claimed, MISSION_TRACK.tiers.filter((t) => pct >= t.pct).length, 'paliers déjà payés marqués');
  assert.equal(migrateMissionTrack(state, { daily: {} }, month, MISSION_TRACK, () => ({})), null, 'format 8 : rien');
  // Migration complète sur les deux sauvegardes de référence.
  const s = load(oldSave());
  assert.equal(s.missions.weekly, undefined);
  assert.equal(s.missions.track.key, month);
  assert.equal(s.missions.track.progress.kills, 9000);
  const e = load(endSave());
  assert.ok(trackPct(e) > 0);
  const before = e.gems;
  const next = trackNext(e);
  if (next?.ready) assert.fail('aucun palier déjà payé ne doit être prêt');
  e.missions.track.progress = Object.fromEntries(MISSION_TRACK.goals.map((g) => [g.id, g.target]));
  let n = 0;
  while (claimTrackTier(e)) n += 1;
  assert.equal(n, MISSION_TRACK.tiers.length - load(endSave()).missions.track.claimed);
  assert.equal(e.gems - before, MISSION_TRACK.tiers.slice(-n).reduce((a, t) => a + t.reward.gems, 0));
});

test('lot F : piste du mois — totaux par mois proches des anciennes hebdomadaires × 4,33 + mensuelles', () => {
  const sum = (k) => MISSION_TRACK.tiers.reduce((a, t) => a + (t.reward[k] ?? 0), 0);
  assert.equal(sum('gems'), 10000); // 1 270 × 52/12 + 4 500 = 10 003
  assert.equal(sum('keys'), 18); // 3 × 52/12 + 5 = 18
  assert.equal(sum('shards'), 500); // 110 × 52/12 = 477
});

test('lot F : mannequins fondus dans le coffre — dépassement géré, builds retrouvés, garde testée dans v89', async () => {
  const { STASH_SIZE, STASH_OVERFLOW } = await import('../src/core/stash.js');
  const { applyLoadout } = await import('../src/core/loadouts.js');
  // Seule.
  const st = { stash: [], inventory: [] };
  const piece = (id, set = 'plains') => ({ id, set, slot: 'helmet' });
  assert.equal(migrateMannequins(st, { plains: { helmet: piece('a') }, junk: { armor: { id: 'z' } } },
    { stashSize: 1, bagSize: 1, isValid: (x) => Boolean(x?.id), clean: (x) => x }), 1);
  assert.deepEqual(st.stash.map((x) => x.id), ['a']);
  const st2 = { stash: [{ id: 's' }], inventory: [{ id: 'b' }] };
  migrateMannequins(st2, { plains: { helmet: piece('c') } }, { stashSize: 1, bagSize: 1, isValid: (x) => Boolean(x?.id), clean: (x) => x });
  assert.deepEqual(st2.stash.map((x) => x.id), ['s', 'c'], 'sac et coffre pleins : le coffre déborde, rien n\'est perdu');
  // Partie de fin, coffre presque plein et sac plein : tout est gardé, au-delà de 300 si besoin.
  const raw = endSave();
  const extra = createFiller(raw, 295 - raw.stash.length);
  raw.stash.push(...extra);
  const mannequinIds = Object.values(raw.mannequins).flatMap((m) => Object.values(m)).map((x) => x.id);
  // Un build enregistré qui porte une pièce d'un mannequin.
  raw.loadouts[0].team = [];
  raw.loadouts[0].gear = { armor: mannequinIds[1] }; // v9.3.4 : la sauvegarde de test a déjà les 3 places (le casque va en « armure »)
  const e = load(raw);
  assert.ok(e.stash.length > STASH_SIZE && e.stash.length <= STASH_SIZE + STASH_OVERFLOW, `coffre ${e.stash.length}`);
  for (const id of mannequinIds) assert.ok(e.stash.some((x) => x.id === id) || e.inventory.some((x) => x.id === id), id);
  assert.equal(e.mannequins, undefined);
  const again = load(JSON.parse(JSON.stringify(e)));
  assert.equal(again.stash.length, e.stash.length, 'rechargée : rien n\'est coupé');
  e.inventory.length = 50; // de la place pour sortir l'objet du coffre
  const r = applyLoadout(e, 0);
  assert.equal(r.missing, 0, 'le build retrouve la pièce de l\'ancien mannequin au coffre');
  assert.equal(e.equipment.armor.id, mannequinIds[1]);
});

function createFiller(raw, n) {
  const base = raw.stash[0];
  return Array.from({ length: Math.max(0, n) }, (_, i) => ({ ...base, id: `it${90000 + i}`, locked: false, set: undefined }));
}
