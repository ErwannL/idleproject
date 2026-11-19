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

import { cardArena, cardOf, floorCards, fightBoard, autoFormation, formationCards, playFloor, sweepFloor, claimStarChest, totalStars, sanitizeCardArena } from '../src/core/arena-cards.js';
import { CARD_ARENA } from '../src/data/arena-floors.js';
const midTeam = () => {
  const s = createNewState(); s.maxStage = 100;
  for (const [id, lv] of [['squire', 10], ['ranger', 10], ['pyromancer', 8], ['priestess', 8], ['mercenary', 8]]) s.companions.owned[id] = { stars: 2, level: lv };
  autoFormation(s); return s;
};

test('Arène à cartes : combat déterministe (même graine → même résultat)', () => {
  const s = midTeam();
  const t = formationCards(s), f = floorCards(17);
  const a = fightBoard(t, f.cards, { seed: 17, rule: f.rule }), b = fightBoard(t, f.cards, { seed: 17, rule: f.rule });
  assert.deepEqual(a, b);
});

test('Arène à cartes : une équipe de milieu de partie bute entre les étages 20 et 35', () => {
  const s = midTeam(); const team = formationCards(s);
  let last = 0;
  for (let f = 1; f <= 60; f++) { const x = floorCards(f); if (fightBoard(team, x.cards, { seed: f, rule: x.rule }).won) last = f; else if (f > last + 3) break; }
  assert.ok(last >= 20 && last <= 35, `dernier étage ${last}`);
});

test('Arène à cartes : règles /5, boss /10, gardien /25 ; cartes avec sorts au verso', () => {
  assert.ok(floorCards(5).rule && !floorCards(6).rule);
  assert.ok(floorCards(10).cards.some((c) => c.boss));
  assert.ok(floorCards(25).cards.some((c) => c.guardian));
  const s = midTeam();
  assert.ok(cardOf(s, 'squire').skills.length >= 2);
});

test('Arène à cartes : étoiles, coffre tous les 15 ★, 5 balayages, migration de l\'ancien record', () => {
  const s = midTeam();
  for (let f = 1; f <= 6; f++) playFloor(s, f);
  assert.ok(totalStars(s) >= 6);
  cardArena(s).stars = Object.fromEntries(Array.from({ length: 6 }, (_, i) => [i + 1, 3])); cardArena(s).best = 6;
  assert.ok(claimStarChest(s));
  let n = 0; while (sweepFloor(s, 3)) n++;
  assert.equal(n, CARD_ARENA.sweepsPerDay);
  const old = createNewState(); old.arena = { survival: null, floors: { best: 12, team: ['squire'], last: null } };
  assert.equal(cardArena(old).best, 12);
  assert.equal(totalStars(old), 12);
  const r = createNewState(); r.arena = { survival: null, floors: { best: 0, team: [], last: null } };
  sanitizeCardArena(r, { arena: { cards: { best: 3, stars: { 1: 3, 2: 9 }, formation: ['squire'] } } });
  assert.deepEqual(r.arena.cards.stars, { 1: 3 });
});
