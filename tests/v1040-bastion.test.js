// v10.4 (partie 6) : le Bastion — le trouver (sous Équipe), le lancer (meilleurs ouvriers posés, chantier offert, une
// seule fois, sauvegarde 10.3 au Bastion vide comprise), bulles par bâtiment, « Pendant ton absence » et
// « Tout récupérer », et chaque illustration référencée présente sur le disque.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createNewState, sanitizeState } from '../src/core/state.js';
import { bastionOf, bastionTick, buildingLevel, startBuild, workerBonus } from '../src/core/bastion.js';
import {
  GIFT_MINUTES, awayReport, bastionUnused, collectAway, kickoffBastion, markTip, needsKickoff, noteAway, placedLine, tipSeen, tradeWord,
} from '../src/core/bastion-start.js';
import { BUILDINGS, RESEARCH } from '../src/data/bastion.js';
import { MENUS, SUB_LABELS, navPath } from '../src/ui/nav.js';

const T0 = Date.UTC(2026, 10, 21, 9);
const HOUR = 3_600_000;
const MIN = 60_000;
// La partie du joueur : étape 186, 17 compagnons libres, Bastion jamais utilisé.
const MANY = ['dwarf', 'pyromancer', 'barbarian', 'demon_queen', 'priestess', 'witch', 'high_priest', 'ranger', 'shadow', 'ninja', 'squire', 'lancer', 'azure_paladin', 'mercenary', 'rose_blade', 'elf_archer', 'archangel', 'ice_empress', 'sylvan_guardian', 'shadow_lord'];
function player(stage = 186, allies = MANY) {
  const s = createNewState(T0, 3);
  s.maxStage = stage; s.stage = stage; s.records.bestStage = stage;
  for (const id of allies) s.companions.owned[id] = { stars: 1, level: 1 };
  s.companions.equipped = allies.slice(-3);
  bastionTick(s, T0);
  s.gold = 1e30; s.materials.shards = 1e6;
  return s;
}

test('navigation : le Bastion est sous Équipe (Compagnons · Bastion · Expéditions), plus dans Profil', () => {
  const team = MENUS.find((m) => m.id === 'team');
  assert.deepEqual(team.tabs, ['companions', 'camp', 'expeditions']);
  assert.equal(MENUS.find((m) => m.id === 'profile').tabs.includes('camp'), false);
  assert.equal(MENUS.filter((m) => m.tabs.includes('camp')).length, 1);
  assert.equal(SUB_LABELS.camp, 'Bastion');
  assert.equal(navPath('camp'), 'Équipe › Bastion');
  const ui = readFileSync(new URL('../src/ui/page.js', import.meta.url), 'utf8');
  assert.match(ui, /PAGE_TABS = new Set\(\[[^\]]*'camp'/, 'le Bastion s\'ouvre en page plein écran');
});

test('démarrage : les meilleurs ouvriers selon le métier et la rareté, puis le chantier offert (15 min)', () => {
  const s = player();
  assert.ok(needsKickoff(s));
  const gold = s.gold, shards = s.materials.shards;
  const k = kickoffBastion(s, T0 + 1000);
  assert.ok(k);
  // Étape 186, Bastion niveau 1 : 2 places ; la Forge (construite) et la Bibliothèque (à construire) sont ouvertes.
  assert.deepEqual(k.placed.map((p) => p.building), ['forge', 'library']);
  const forge = k.placed.find((p) => p.building === 'forge');
  assert.equal(forge.companionId, 'demon_queen', 'forgeronne légendaire : +40 %');
  assert.equal(forge.pct, 40);
  assert.equal(placedLine(forge), 'Reine démone, forgeronne : +40 %');
  assert.equal(k.placed.find((p) => p.building === 'library').companionId, 'archangel');
  // Aucun ouvrier possible ne ferait mieux que celui qui a été posé.
  for (const p of k.placed) {
    const best = MANY.filter((id) => !s.companions.equipped.includes(id)).map((id) => workerBonus(s, id, p.building).totalPct);
    assert.equal(p.pct, Math.max(...best));
  }
  const b = bastionOf(s);
  assert.equal(b.buildings.forge.worker, 'demon_queen');
  // Chantier offert : la Bibliothèque (premier chantier, 15 min), sans rien payer.
  assert.deepEqual({ building: k.build.building, level: k.build.level, ms: k.build.ms }, { building: 'library', level: 1, ms: GIFT_MINUTES * MIN });
  assert.equal(GIFT_MINUTES, 15);
  assert.ok(b.buildings.library.build);
  assert.equal(s.gold, gold); assert.equal(s.materials.shards, shards);
  // Une seule fois.
  assert.equal(needsKickoff(s), false);
  assert.equal(kickoffBastion(s, T0 + 2000), null);
  bastionTick(s, T0 + 1000 + 15 * MIN);
  assert.equal(buildingLevel(s, 'library'), 1);
  // Même vidé ensuite, le Bastion ne se relance pas tout seul.
  b.buildings.forge.worker = null; b.buildings.library.worker = null;
  assert.equal(kickoffBastion(s, T0 + 20 * MIN), null);
});

test('démarrage : nouveau joueur à l\'étape 40 (Forge seule) — un ouvrier, chantier de la Forge ramené à 15 min', () => {
  const s = player(40, ['dwarf', 'squire', 'priestess', 'ranger', 'mercenary']);
  const k = kickoffBastion(s, T0);
  assert.equal(k.placed.length, 1);
  assert.equal(k.placed[0].companionId, 'dwarf');
  assert.equal(placedLine(k.placed[0]), 'Nain guerrier, forgeron : +25 %');
  assert.equal(k.build.building, 'forge');
  assert.equal(k.build.ms, 15 * MIN);
});

test('démarrage : sans compagnon libre, rien n\'est marqué (on réessaiera à la prochaine ouverture)', () => {
  const s = player(60, ['dwarf', 'squire']);
  s.companions.equipped = ['dwarf', 'squire'];
  assert.equal(kickoffBastion(s, T0), null);
  assert.ok(needsKickoff(s));
  s.companions.equipped = ['squire'];
  assert.ok(kickoffBastion(s, T0 + 1000));
});

test('démarrage : une sauvegarde 10.3 au Bastion vide (ouvert, jamais utilisé) le reçoit aussi ; une partie déjà lancée non', () => {
  const s = player();
  const old = JSON.parse(JSON.stringify(s));
  delete old.bastion.kicked; delete old.bastion.tips; delete old.bastion.away; // champs 10.4 absents
  const loaded = sanitizeState(old, undefined, T0 + HOUR);
  assert.ok(bastionUnused(loaded));
  assert.ok(needsKickoff(loaded));
  assert.ok(kickoffBastion(loaded, T0 + HOUR));
  // Sauvegarde/chargement : le démarrage n'est pas refait.
  const again = sanitizeState(JSON.parse(JSON.stringify(loaded)), undefined, T0 + 2 * HOUR);
  assert.ok(bastionOf(again).kicked > 0);
  assert.equal(needsKickoff(again), false);
  // Une partie 10.3 qui s'est déjà servie du Bastion ne reçoit rien.
  const used = player();
  bastionOf(used).buildings.forge.worker = 'dwarf';
  startBuild(used, 'forge', T0);
  assert.equal(needsKickoff(used), false);
  assert.equal(kickoffBastion(used, T0), null);
});

test('bulles : une par bâtiment, une seule fois, gardée dans la sauvegarde', () => {
  const s = player();
  assert.equal(tipSeen(s, 'forge'), false);
  markTip(s, 'forge'); markTip(s, 'forge'); markTip(s, 'nope');
  assert.deepEqual(bastionOf(s).tips, ['forge']);
  const back = sanitizeState(JSON.parse(JSON.stringify(s)), undefined, T0 + HOUR);
  assert.ok(tipSeen(back, 'forge'));
  assert.equal(tipSeen(back, 'library'), false);
});

test('« Pendant ton absence » : chantiers finis illustrés, objets commandés livrés, recherches finies ; « Tout récupérer »', () => {
  const s = player();
  kickoffBastion(s, T0);
  bastionTick(s, T0 + 20 * MIN); // la Bibliothèque est construite pendant que le joueur regarde : pas de rapport
  assert.equal(awayReport(s), null);
  const b = bastionOf(s);
  // Recherche et commande lancées, puis le jeu est fermé 3 h.
  b.research.active.push({ id: 'sharp', left: 10 * MIN, total: 10 * MIN, level: 1 });
  b.orders.push({ id: 1, slot: 'armor', tier: 'rare', left: HOUR, total: HOUR, ready: false, item: null });
  b.nextOrder = 2;
  assert.ok(startBuild(s, 'forge', T0 + 20 * MIN));
  const events = bastionTick(s, T0 + 20 * MIN + 3 * HOUR, { away: true });
  assert.ok(noteAway(s, events, T0 + 3 * HOUR));
  const r = awayReport(s);
  assert.deepEqual(r.builds.map((x) => [x.ref, x.level]), [['forge', 2]]);
  assert.deepEqual(r.research.map((x) => [x.ref, x.level]), [['sharp', 1]]);
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].slot, 'armor');
  assert.ok(s.lootBag.some((i) => i.id === r.items[0].ref), 'l\'objet commandé est dans le coffre de butin');
  // Le rapport survit à une sauvegarde.
  const back = sanitizeState(JSON.parse(JSON.stringify(s)), undefined, T0 + 4 * HOUR);
  assert.equal(awayReport(back).builds.length, 1);
  // « Tout récupérer » : nouvelles lues, rapport vidé.
  assert.ok(b.news.length > 0);
  const got = collectAway(s, T0 + 3 * HOUR + 21 * MIN);
  assert.equal(awayReport(s), null);
  assert.equal(b.news.filter((n) => !n.book).length, 0);
  assert.ok(got && typeof got.resources === 'object');
});

test('« Tout récupérer » verse les stocks de la Mine et du Camp d\'entraînement', () => {
  const s = player();
  const b = bastionOf(s);
  b.buildings.library.level = 1; b.buildings.mine.level = 2; b.buildings.training.level = 2;
  b.stock.mine = 37.6; b.stock.training = 1.2;
  b.away = { at: T0, list: [{ kind: 'build', ref: 'mine', level: 2 }] };
  const r = awayReport(s);
  assert.deepEqual(r.stock.map((x) => [x.id, x.amount]), [['mine', 37], ['training', 1]]);
  const before = { shards: s.materials.shards, grimoire: s.materials.grimoire ?? 0 };
  const got = collectAway(s, T0);
  assert.equal(got.resources.shards, 37);
  assert.equal(s.materials.shards, before.shards + 37);
  assert.equal(s.materials.grimoire, before.grimoire + 1);
});

test('métiers accordés : forgeronne, savante, mineuse…', () => {
  assert.equal(tradeWord('demon_queen'), 'forgeronne');
  assert.equal(tradeWord('dwarf'), 'forgeron');
  assert.equal(tradeWord('priestess'), 'savante');
  assert.equal(tradeWord('ice_empress'), 'mineuse');
});

test('illustrations : chaque image référencée par le Bastion existe sur le disque (assets/ui/art104)', async () => {
  const root = new URL('..', import.meta.url);
  const has = (p) => existsSync(new URL(p, root));
  const { BASTION_FX } = await import('../src/ui/bastion-art.js');
  const files = ['bastion_map', 'research_tree_bg', 'bastion_site', 'bastion_away', 'scene_tower', 'bastion_expeditions', 'bastion_expeditions_locked',
    ...BUILDINGS.filter((d) => !d.existing).flatMap((d) => [1, 4, 8].map((lv) => `bastion_${d.id}_lv${lv}`).concat(`bastion_${d.id}_locked`)),
    ...['smith', 'scholar', 'miner', 'trainer', 'merchant'].map((t) => `trade_${t}`),
    ...['combat', 'team', 'economy'].map((b) => `research_branch_${b}`),
    ...Object.keys(BASTION_FX)];
  // Nœuds des recherches : un dessin par recherche, tous différents.
  const src = readFileSync(new URL('../src/ui/panels/camp.js', import.meta.url), 'utf8');
  const map = Object.fromEntries([...src.matchAll(/(\w+): '(\w+)'/g)].filter(([, k]) => RESEARCH.some((r) => r.id === k)).map(([, k, v]) => [k, v]));
  assert.equal(Object.keys(map).length, RESEARCH.length);
  assert.equal(new Set(Object.values(map)).size, RESEARCH.length);
  for (const v of Object.values(map)) files.push(`research_node_${v}`);
  const missing = files.filter((f) => !has(`assets/ui/art104/${f}.png`));
  assert.deepEqual(missing, []);
  // Toute image « assets/ui/art104/… » écrite dans le code du Bastion existe.
  for (const f of ['src/ui/panels/camp.js', 'src/ui/bastion-away.js', 'index.html', 'src/ui/bastion-cards.js']) {
    const text = readFileSync(new URL(f, root), 'utf8');
    for (const [m] of text.matchAll(/assets\/ui\/art104\/[\w-]+\.png/g)) assert.ok(has(m), m);
  }
  // Le Bastion n'utilise plus les dessins faits par script (art103/b_*, tool_*).
  assert.doesNotMatch(src, /art103/);
});
