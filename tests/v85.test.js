import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewState, sanitizeState } from '../src/core/state.js';
import { BALANCE } from '../src/data/balance.js';
import { TALENTS } from '../src/data/rebirth.js';
import { ITEM_SETS } from '../src/data/sets.js';
import { createCombat, step } from '../src/core/combat.js';
import { Rng } from '../src/core/rng.js';
import { computeHeroStats } from '../src/core/stats.js';
import { createJournal, journalSummary, noteDrop, noteFused, noteRecycled } from '../src/core/journal.js';
import {
  buyTalent, buyTalentPath, fragmentsSpent, regionPoints, respecCost, respecTalents, talentEffects, talentPath, talentUnlocked,
} from '../src/core/rebirth.js';
import { claimExpedition, expeditionReward, readyExpeditions, startExpedition } from '../src/core/expeditions.js';
import { toggleCompanion } from '../src/core/companions.js';
import { grantReward } from '../src/core/rewards.js';
import { makeItem, generateItem } from '../src/core/loot.js';
import { setEffects, usefulSetPiece } from '../src/core/sets.js';
import { addToInventory, sweepInventory } from '../src/core/inventory.js';
import {
  CHALLENGE, challengeTriesLeft, challengeWeek, clearChallengeWave, endChallenge, startChallenge, weeklySetup, modifierById,
} from '../src/core/challenge.js';
import { startTower } from '../src/core/tower.js';
import { forecastBoss, forecastSteps } from '../src/core/guide.js';

const NOW = Date.now();
const HOUR = 3600 * 1000;

test('v8.5 : journal de session (objets ramassés, encore dans le sac, recyclés, fusionnés)', () => {
  const s = createNewState(NOW, 1);
  const j = createJournal(s, NOW);
  s.records.itemsFound += 5;
  s.records.bossesDefeated += 2;
  s.maxStage += 3;
  for (let i = 0; i < 2; i++) addToInventory(s, makeItem(s, 'dagger', 'common', 1));
  noteDrop(j, { autoRecycled: true, recycledGold: 7 });
  noteRecycled(j, 2, 10);
  noteFused(j, 1);
  const sum = journalSummary(j, s, NOW + 60000);
  assert.equal(sum.seconds, 60);
  assert.equal(sum.stages, 3);
  assert.equal(sum.bosses, 2);
  assert.equal(sum.items, 7, '5 + 2 (addToInventory compte aussi)');
  assert.equal(sum.inBag, 2);
  assert.equal(sum.recycled, 3);
  assert.equal(sum.recycledGold, 17);
  assert.equal(sum.fused, 1);
});

test('v8.5 : arbre — chemin le moins cher, clés de voûte verrouillées par région, réinitialisation', () => {
  const s = createNewState(NOW, 1);
  s.fragments = 1e6;
  const keystone = TALENTS.find((t) => t.kind === 'keystone' && t.region === 'combat' && t.ring === 7);
  const path = talentPath(s, keystone.id);
  assert.equal(path[0], 'core');
  assert.equal(path.at(-1), keystone.id);
  for (let i = 1; i < path.length; i++) assert.ok(TALENTS.find((t) => t.id === path[i]).links.includes(path[i - 1]), 'chemin continu');
  // Le chemin s'arrête devant la clé de voûte tant que la région n'a pas assez de points.
  const bought = buyTalentPath(s, keystone.id);
  assert.equal(bought, path.length - 1);
  assert.equal(talentUnlocked(s, keystone), false);
  assert.ok(regionPoints(s, 'combat') < keystone.gate);
  // On remplit la région, puis la clé de voûte s'achète et multiplie les dégâts.
  for (const t of TALENTS.filter((x) => x.region === 'combat' && x.kind === 'small' && x.ring <= 6)) {
    buyTalentPath(s, t.id);
    while (buyTalent(s, t.id));
  }
  assert.ok(regionPoints(s, 'combat') >= keystone.gate);
  const before = computeHeroStats(s);
  assert.ok(buyTalent(s, keystone.id));
  const after = computeHeroStats(s);
  assert.ok(after.damage > before.damage * 1.5, 'Berserker : dégâts ×1,6');
  assert.ok(after.maxHp < before.maxHp, 'Berserker : moins de PV');
  // Effets recalculés à chaque achat (cache par version de l'arbre).
  assert.equal(talentEffects(s).damageMultPct, 60);
  // Réinitialisation : tout est rendu, la première fois gratuitement, ensuite en gemmes.
  const spent = fragmentsSpent(s);
  const frags = s.fragments;
  assert.equal(respecCost(s), 0);
  assert.equal(respecTalents(s), spent);
  assert.equal(s.fragments, frags + spent);
  assert.deepEqual(s.talents, {});
  assert.ok(respecCost(s) > 0);
});

test('v8.5 : expéditions — compagnon hors équipe, récompense à la fin, rappel sans récompense', () => {
  const s = createNewState(NOW, 1);
  s.maxStage = 120;
  s.companions.owned = { cat: { stars: 2, level: 5 }, golden_slime: { stars: 1, level: 1 } };
  s.companions.equipped = ['golden_slime'];
  assert.equal(startExpedition(s, 0, 'golden_slime', 'patrol', NOW), false, 'équipé : refusé');
  const reward = expeditionReward(s, 'cat', 'journey');
  assert.ok(reward.gold > 0 && reward.fragments > 0 && reward.keys >= 1);
  assert.ok(startExpedition(s, 0, 'cat', 'journey', NOW));
  assert.equal(startExpedition(s, 1, 'cat', 'patrol', NOW), false, 'déjà parti');
  assert.equal(toggleCompanion(s, 'cat'), false, 'en expédition : pas dans l\'équipe');
  assert.equal(readyExpeditions(s, NOW + HOUR), 0);
  assert.equal(readyExpeditions(s, NOW + 12 * HOUR), 1);
  // Sauvegarde / chargement.
  const again = sanitizeState(JSON.parse(JSON.stringify(s)));
  assert.equal(again.expeditions.slots[0].companionId, 'cat');
  const frags = s.fragments;
  const given = claimExpedition(s, 0, NOW + 12 * HOUR, grantReward);
  assert.equal(given.fragments, reward.fragments);
  assert.equal(s.fragments, frags + reward.fragments);
  assert.equal(s.expeditions.done, 1);
  assert.ok(startExpedition(s, 0, 'cat', 'patrol', NOW));
  assert.deepEqual(claimExpedition(s, 0, NOW + 10, grantReward), {}, 'rappel anticipé : rien');
  assert.ok(toggleCompanion(s, 'cat'));
});

test('v8.5 : ensembles d\'équipement — butin, bonus 2/4/6, pièces gardées par le recyclage', () => {
  const s = createNewState(NOW, 1);
  // Butin : une partie des objets Rares+ d'un monde appartient à son ensemble.
  const rng = new Rng(5);
  const items = Array.from({ length: 400 }, () => generateItem(s, rng, { level: 10, minRarity: 'rare', setZone: 2 }));
  const inSet = items.filter((i) => i.set === 'caves').length;
  assert.ok(inSet > 30 && inSet < 200, String(inSet));
  assert.ok(items.every((i) => !i.set || i.set === 'caves'));
  assert.ok(Array.from({ length: 50 }, () => generateItem(s, rng, { level: 10, setZone: 11 })).every((i) => !i.set), 'monde 12 (Abysse, v9.2.0) : aucun ensemble');
  // Bonus.
  const set = ITEM_SETS.find((x) => x.id === 'caves');
  const eq = { ...s.equipment };
  // v9.3.8 : 6 places, chacune compte 1 pièce (paliers 2/4/6).
  const slots = ['weapon', 'helmet', 'armor', 'amulet', 'ring', 'bracelet'];
  const bases = { weapon: 'dagger', helmet: 'iron_helm', armor: 'chainmail', amulet: 'necklace_ruby', ring: 'band_ring_ruby', bracelet: 'thorn_bracelet_ruby' };
  eq.weapon = makeItem(s, bases.weapon, 'rare', 5, BALANCE, null, 'caves');
  eq.helmet = makeItem(s, bases.helmet, 'rare', 5, BALANCE, null, 'caves');
  assert.deepEqual(setEffects(eq), set.bonuses[2]);
  slots.forEach((slot, i) => { if (i < 4) eq[slot] = makeItem(s, bases[slot], 'rare', 5, BALANCE, null, 'caves'); });
  assert.deepEqual(setEffects(eq), { ...set.bonuses[2], ...set.bonuses[4] });
  slots.forEach((slot) => { eq[slot] = makeItem(s, bases[slot], 'rare', 5, BALANCE, null, 'caves'); });
  assert.equal(setEffects(eq).maxHpMultPct, set.bonuses[6].maxHpMultPct);
  s.equipment = eq;
  const hp = computeHeroStats(s).maxHp;
  s.equipment = { ...eq, ring: makeItem(s, bases.ring, 'rare', 5) }; // même pièce hors ensemble
  assert.ok(hp > computeHeroStats(s).maxHp * 1.3, 'le palier 6 pièces multiplie les PV');
  // Recyclage : une pièce d'ensemble utile est gardée, sauf si l'option est coupée.
  const t = createNewState(NOW, 2);
  t.equipment.helmet = makeItem(t, 'iron_helm', 'legendary', 50); // v9.3.8 : de nouveau sa place
  t.equipment.weapon = makeItem(t, 'short_sword', 'legendary', 50, BALANCE, null, 'forest');
  const piece = makeItem(t, 'leather_hood', 'rare', 1, BALANCE, null, 'forest');
  const junk = makeItem(t, 'leather_hood', 'rare', 1);
  addToInventory(t, piece);
  addToInventory(t, junk);
  t.ui.recycle = { mode: 'pickup', rarities: ['common', 'rare'], slots: ['helmet'] };
  assert.ok(usefulSetPiece(t, piece));
  sweepInventory(t);
  assert.deepEqual(t.inventory.map((i) => i.id), [piece.id]);
  t.ui.keepSets = false;
  sweepInventory(t);
  assert.equal(t.inventory.length, 0);
  // Sauvegarde.
  const saved = sanitizeState(JSON.parse(JSON.stringify(s)));
  assert.equal(saved.equipment.weapon.set, 'caves');
});

test('v8.5 : défi de la semaine — règles fixes par semaine, 3 tentatives, records et historique', () => {
  const a = weeklySetup('2026-10-26');
  assert.deepEqual(weeklySetup('2026-10-26'), a, 'déterministe');
  assert.equal(a.mods.length, CHALLENGE.modifiers);
  assert.ok(a.mods.some((id) => modifierById(id).good), 'au moins une règle favorable');
  assert.equal(new Set(a.mods).size, a.mods.length);

  const s = createNewState(NOW, 1);
  s.maxStage = CHALLENGE.unlockStage - 1;
  assert.equal(startChallenge(s, NOW), false, 'verrouillé');
  s.maxStage = 100;
  assert.ok(startChallenge(s, NOW));
  assert.equal(startTower(s), false, 'un seul mode à la fois');
  const gems = s.gems;
  const r1 = clearChallengeWave(s);
  assert.ok(r1.weekly && r1.record);
  assert.ok(s.gems > gems);
  const r2 = clearChallengeWave(s);
  assert.equal(r2.wave, 2);
  assert.equal(endChallenge(s).waves, 2);
  assert.equal(challengeTriesLeft(s, NOW), CHALLENGE.triesPerWeek - 1);
  // Deuxième tentative : pas de récompense en dessous du meilleur de la semaine.
  assert.ok(startChallenge(s, NOW));
  const again = clearChallengeWave(s);
  assert.ok(!again.weekly && !again.record);
  endChallenge(s);
  // Semaine suivante : les tentatives reviennent, la semaine passée rejoint l'historique.
  s.challengeWeek.week = '2000-01-03';
  challengeWeek(s, NOW);
  assert.equal(s.challengeHistory[0].best, 2);
  assert.equal(challengeTriesLeft(s, NOW), CHALLENGE.triesPerWeek);
  assert.equal(s.challengeBest, 2);
  const loaded = sanitizeState(JSON.parse(JSON.stringify(s)));
  assert.equal(loaded.challengeBest, 2);
  assert.equal(loaded.challengeHistory.length, 1);
});

test('v8.5 : défi joué par la simulation — vagues franchies puis défaite', () => {
  const s = createNewState(NOW, 3);
  s.maxStage = 60;
  s.upgrades.damage = 120;
  s.upgrades.vitality = 120;
  assert.ok(startChallenge(s, NOW));
  const w = createCombat(s);
  const rng = new Rng(4);
  let waves = 0;
  let failed = null;
  for (let i = 0; i < 20 * 60 * 20 && !failed; i++) {
    step(s, w, 0.05, rng);
    for (const e of w.events) {
      if (e.type === 'challengeWave') waves += 1;
      if (e.type === 'challengeFailed') failed = e;
    }
    w.events.length = 0;
  }
  assert.ok(waves >= 3, `vagues : ${waves}`);
  assert.ok(failed, 'la difficulté finit par l\'emporter');
  assert.equal(s.challenge, null);
  assert.equal(s.challengeWeek.best, failed.waves);
});

test('v8.5 : prévision du boss découpée en tranches (même résultat)', () => {
  const s = createNewState(NOW, 1);
  s.upgrades.damage = 30;
  const gen = forecastSteps(s, BALANCE, 50);
  let slices = 0;
  let r;
  while (!(r = gen.next()).done) slices += 1;
  assert.ok(slices >= 1);
  assert.deepEqual(r.value, forecastBoss(s));
});

test('v8.5 : ancienne sauvegarde → version 7, talents remboursés une seule fois', () => {
  const raw = JSON.parse(JSON.stringify(createNewState(NOW, 5)));
  raw.version = 6;
  raw.talents = { core: 5, power: 10, fortune: 4 };
  const s = sanitizeState(raw);
  const refund = (1 + 2 + 3 + 4 + 5) + (1 + 2 + 3 + 4 + 5 + 6 + 7 + 8 + 9 + 10) + (1 + 2 + 3 + 4);
  assert.equal(s.fragments, refund);
  delete s.migrationTalentRefund;
  const again = sanitizeState(JSON.parse(JSON.stringify({ ...s, version: 7 })));
  assert.equal(again.fragments, refund, 'pas de second remboursement');
  assert.equal(again.migrationTalentRefund, undefined);
});
