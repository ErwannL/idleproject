import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewState, sanitizeState } from '../src/core/state.js';
import { ACHIEVEMENTS, achievementCount, claimAchievement, claimableAchievements } from '../src/core/achievements.js';
import { computeHeroStats } from '../src/core/stats.js';
import { DUNGEON_DIFFICULTIES } from '../src/data/dungeons.js';

test('hauts faits : réclamés une fois, gemmes + bonus permanent, conservés', () => {
  const s = createNewState(Date.now(), 2);
  assert.equal(claimableAchievements(s).length, 0);
  s.records.kills = 150;
  s.maxStage = 25;
  const ready = claimableAchievements(s).map((a) => a.id);
  assert.ok(ready.includes('kills1') && ready.includes('stage1'));
  const before = computeHeroStats(s).damage;
  const gems = s.gems;
  assert.ok(claimAchievement(s, 'kills1'));
  assert.equal(claimAchievement(s, 'kills1'), null);
  assert.equal(s.gems, gems + ACHIEVEMENTS.find((a) => a.id === 'kills1').gems);
  assert.ok(computeHeroStats(s).damage > before);
  assert.equal(claimAchievement(s, 'boss3'), null); // pas encore fait
  const back = sanitizeState(JSON.parse(JSON.stringify(s)));
  assert.equal(achievementCount(back), 1);
});

test('donjons v8.3 : Facile n\'est plus plus dur que la campagne', () => {
  assert.ok(DUNGEON_DIFFICULTIES.easy.levelBonus < 0 && DUNGEON_DIFFICULTIES.easy.hp === 1 && DUNGEON_DIFFICULTIES.easy.damage === 1);
  assert.ok(DUNGEON_DIFFICULTIES.hard.hp > DUNGEON_DIFFICULTIES.normal.hp && DUNGEON_DIFFICULTIES.normal.hp > DUNGEON_DIFFICULTIES.easy.hp);
});
