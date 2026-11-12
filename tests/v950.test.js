// v9.5.0 : composition — niveau d'équipe partagé, équipe conseillée (vrai combat), rôles lisibles.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewState, sanitizeState } from '../src/core/state.js';
import { companionMultiplier, unitLevel, upgradeCompanion } from '../src/core/companions.js';
import { bestTeam, teamScore } from '../src/core/team-advisor.js';
import { ROLES } from '../src/data/synergies.js';

const NOW = Date.UTC(2026, 10, 12, 12);
const withTeam = () => {
  const s = createNewState(NOW, 5);
  s.maxStage = s.stage = 40; s.level = 30; s.upgrades.damage = 40; s.upgrades.vitality = 40;
  s.companions.owned = { lancer: { stars: 1, level: 9 }, elf_archer: { stars: 1, level: 4 }, witch: { stars: 2, level: 1 }, ninja: { stars: 1, level: 1 }, cat: { stars: 1, level: 3 } };
  s.companions.equipped = ['lancer', 'elf_archer', 'cat'];
  return s;
};

test('v9.5.0 : niveau d\'équipe — migration au plus haut niveau atteint, un remplaçant prend le même niveau', () => {
  const s = sanitizeState(JSON.parse(JSON.stringify(withTeam())), undefined, NOW);
  assert.deepEqual(s.companions.teamLevel, { ally: 9, pet: 3 });
  assert.equal(unitLevel(s, 'witch'), 9, 'banc : même niveau que l\'équipe');
  assert.equal(unitLevel(s, 'lancer'), 9);
  const before = companionMultiplier(s, 'witch');
  s.gold = 1e15;
  assert.ok(upgradeCompanion(s, 'lancer'));
  assert.equal(unitLevel(s, 'ninja'), 10, 'monter un compagnon monte toute l\'équipe');
  assert.ok(companionMultiplier(s, 'witch') > before);
});

test('v9.5.0 : équipe conseillée — essayée en vrai combat, jamais pire que l\'équipe en place', () => {
  const s = sanitizeState(JSON.parse(JSON.stringify(withTeam())), undefined, NOW);
  const r = bestTeam(s);
  assert.ok(r && r.team.length === 3);
  assert.ok(r.score >= r.current * 0.999, `${r.score} < ${r.current}`);
  assert.ok(teamScore(s, r.team) > 0);
});

test('v9.5.0 : chaque rôle dit ce qu\'il fait et contre quoi il est bon', () => {
  for (const r of Object.values(ROLES)) assert.ok(r.does && r.good && r.icon, r.label);
});
