import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewState, sanitizeState } from '../src/core/state.js';
import { BALANCE } from '../src/data/balance.js';
import { makeItem } from '../src/core/loot.js';
import { collectItem } from '../src/core/inventory.js';
import { companionSkills, allCompanionSkills, skillPower } from '../src/core/companions.js';
import { moveToStash, takeFromStash, putOnMannequin, wearMannequin, mannequinCount, STASH_SIZE } from '../src/core/stash.js';
import { dailyBounty, bountyProgress, claimBounty } from '../src/core/bounty.js';
import { startTower, endTower } from '../src/core/tower.js';
import { createCombat, step } from '../src/core/combat.js';
import { Rng } from '../src/core/rng.js';

const NOW = Date.now();

test('v8.9 : 4 compétences par compagnon, la 4e avec 3 doublons, +15 % par étoile', () => {
  const s = createNewState(NOW, 1);
  s.companions.owned = { archangel: { stars: 1, level: 1 }, cat: { stars: 5, level: 1 } };
  assert.equal(allCompanionSkills('archangel').length, 4);
  assert.equal(companionSkills(s, 'archangel').length, 3, 'ultime verrouillée');
  s.companions.owned.archangel.stars = 4;
  assert.equal(companionSkills(s, 'archangel').length, 4);
  assert.ok(companionSkills(s, 'archangel').at(-1).ultimate);
  assert.ok(Math.abs(skillPower(s, 'archangel') - 1.45) < 1e-9);
  // Les compagnons lancent bien plusieurs compétences en combat.
  s.companions.equipped = ['archangel', 'cat'];
  const w = createCombat(s);
  const rng = new Rng(2);
  const seen = new Set();
  for (let i = 0; i < 20 * 40; i++) {
    step(s, w, 0.05, rng);
    for (const e of w.events) if (e.type === 'companionSkill') seen.add(`${e.companionId}#${e.skill}`);
    w.events.length = 0;
  }
  assert.ok(seen.size >= 5, [...seen].join());
});

test('v8.9 : coffre et mannequins (un par ensemble, porter d\'un clic, rangement auto)', () => {
  const s = createNewState(NOW, 2);
  s.records.bestStage = 30; // v9.1.3 : mannequins ouverts (rangement auto seulement après le seuil)
  const a = makeItem(s, 'dagger', 'rare', 5, BALANCE, null, 'caves');
  const b = makeItem(s, 'iron_helm', 'rare', 5, BALANCE, null, 'caves');
  s.inventory.push(a, b);
  assert.ok(moveToStash(s, a.id));
  assert.equal(s.stash.length, 1);
  assert.ok(takeFromStash(s, a.id));
  assert.ok(putOnMannequin(s, a.id));
  assert.ok(putOnMannequin(s, b.id));
  assert.equal(mannequinCount(s, 'caves'), 2);
  const oldWeapon = s.equipment.weapon;
  assert.equal(wearMannequin(s, 'caves'), 2);
  assert.equal(s.equipment.weapon.id, a.id);
  assert.ok(s.inventory.some((i) => i.id === oldWeapon.id), 'l\'ancienne arme revient au sac');
  // Rangement auto : une meilleure pièce va sur le mannequin, une moins bonne non.
  const better = makeItem(s, 'chainmail', 'epic', 20, BALANCE, null, 'forest');
  assert.equal(collectItem(s, better).mannequin, true);
  assert.equal(s.mannequins.forest.armor.id, better.id);
  const worse = makeItem(s, 'chainmail', 'common', 1, BALANCE, null, 'forest');
  assert.notEqual(collectItem(s, worse).mannequin, true);
  // Sauvegarde.
  const back = sanitizeState(JSON.parse(JSON.stringify(s)));
  assert.equal(back.mannequins.forest.armor.id, better.id);
  assert.ok(back.nextItemId > Number(better.id.slice(2)));
  assert.equal(STASH_SIZE, 300);
});

test('v8.9 : prime du jour (monstre d\'un monde atteint, pièce d\'ensemble garantie)', () => {
  const s = createNewState(NOW, 3);
  s.maxStage = 50;
  const b = dailyBounty(s, NOW);
  assert.deepEqual(dailyBounty(s, NOW), b, 'stable dans la journée');
  assert.ok(b.zone <= 2);
  assert.equal(claimBounty(s, new Rng(1), NOW), null);
  s.codex.kills[b.type] = (s.codex.kills[b.type] ?? 0) + b.target;
  assert.equal(bountyProgress(s, NOW), b.target);
  const gems = s.gems;
  const r = claimBounty(s, new Rng(1), NOW);
  assert.ok(r.item.set);
  assert.ok(['epic', 'legendary'].includes(r.item.rarity));
  assert.equal(s.gems, gems + r.gems);
  assert.equal(claimBounty(s, new Rng(1), NOW), null, 'une seule fois');
});

test('v8.9 : historique des ascensions de la Tour (écran Records)', () => {
  const s = createNewState(NOW, 4);
  s.maxStage = 100;
  startTower(s);
  s.tower.floor = 7;
  endTower(s, { defeated: true });
  assert.equal(s.towerHistory[0].floors, 6);
  assert.equal(sanitizeState(JSON.parse(JSON.stringify(s))).towerHistory.length, 1);
});

test('v8.9 : chaque base d\'objet et chaque ensemble a son sprite', async () => {
  const { ITEM_BASES } = await import('../src/data/items.js');
  const { ITEM_SETS } = await import('../src/data/sets.js');
  const { SPRITES } = await import('../src/render/sprites.js');
  for (const b of ITEM_BASES.filter((x) => ['weapon', 'helmet', 'armor'].includes(x.slot))) assert.ok(SPRITES[`${b.slot}_${b.sprite}`], b.id);
  for (const s of ITEM_SETS) assert.ok(SPRITES[`set_${s.id}`], s.id);
});
