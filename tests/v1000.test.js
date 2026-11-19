// v10.0 : animations des compagnons vivantes, missions figées par période, Héraut à l'échelle, compagnons ×3 contre
// les grands boss, file de gestes.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as base from '../src/render/art-anim-allies.js';
import * as extra from '../src/render/art-anim-allies-extra.js';
import { expandRow } from '../src/render/sprites.js';
import { FROZEN_ATTACK } from '../src/data/ally-style.js';
import { createNewState, sanitizeState } from '../src/core/state.js';
import { scaledMission, refreshMissions, trackMissions, missionStatus, claimMission } from '../src/core/missions.js';
import { MISSION_PERIODS } from '../src/data/missions.js';
import { HERALD_TASKS, heraldTask } from '../src/core/chronicles.js';
import { GRAND_BOSS_TEAM_MULT } from '../src/core/combat.js';

// Changement moyen par image : part des pixels du personnage (opaques dans l'une ou l'autre image) qui changent.
function frames(m, a) {
  let prev = null;
  return a.frames.map((f) => {
    const art = m.ALLY_ANIM_ART[f];
    const rows = art.rows.map((r, y) => (r === '' && prev ? prev[y] : expandRow(r)));
    prev = rows;
    const pal = m.ALLY_ANIM_PALS[art.pr];
    return rows.map((r) => [...(Array.isArray(r) ? r.join('') : r)].map((c) => (c === '.' ? null : pal[c])));
  });
}
function meanChange(fr) {
  let tot = 0;
  for (let i = 0; i + 1 < fr.length; i++) {
    const a = fr[i], b = fr[i + 1];
    let n = 0, d = 0;
    for (let y = 0; y < Math.max(a.length, b.length); y++) for (let x = 0; x < Math.max(a[y]?.length ?? 0, b[y]?.length ?? 0); x++) {
      const p = a[y]?.[x] ?? null, q = b[y]?.[x] ?? null;
      if (p || q) { n++; if (p !== q) d++; }
    }
    tot += n ? d / n : 0;
  }
  return tot / Math.max(1, fr.length - 1);
}

test('v10.0 (9.2) : chaque animation d\'action jouée change plus de 15 % des pixels par image', () => {
  const low = [];
  for (const m of [base, extra]) for (const [sprite, anims] of Object.entries(m.ALLY_ANIMS)) {
    if (!sprite.startsWith('ally_') && !sprite.startsWith('pet_')) continue;
    for (const k of ['attack', 'cast', 'ultimate']) {
      const a = anims[k];
      if (!a || a.frames.length < 2) continue;
      if (k === 'attack' && FROZEN_ATTACK.has(sprite)) continue; // remplacée en jeu par l'animation de sort
      const v = meanChange(frames(m, a));
      if (v < 0.15) low.push(`${sprite}.${k} ${v.toFixed(3)}`);
    }
  }
  assert.deepEqual(low, []);
});

test('v10.0 (6) : palier des missions figé pour la journée ; une mission faite reste faite', () => {
  const s = createNewState();
  s.records.bestStage = 30; s.maxStage = 30;
  refreshMissions(s);
  const kills = MISSION_PERIODS[0].missions.find((m) => m.id === 'kills');
  assert.equal(scaledMission(s, kills, 'daily').target, 300);
  trackMissions(s, 'kills', 300);
  assert.ok(claimMission(s, 'daily', 'kills'));
  s.records.bestStage = 521; s.maxStage = 521; // l'étape monte dans la journée
  assert.equal(scaledMission(s, kills, 'daily').target, 300, 'le palier suivant attend le lendemain');
  assert.ok(missionStatus(s, 'daily', kills).done);
  const back = sanitizeState(JSON.parse(JSON.stringify(s)));
  assert.equal(back.missions.daily.tier, 0);
});

test('v10.0 (6) : Tâches du Héraut — récompenses à l\'échelle de l\'étape, avec des éclats', () => {
  const s = createNewState();
  const t = HERALD_TASKS.find((x) => x.id === 'tower');
  const low = heraldTask(s, t).reward;
  s.records.bestStage = 521;
  const high = heraldTask(s, t).reward;
  assert.ok(high.shards > 0 && high.gems >= low.gems * 10);
});

test('v10.0 (4) : compagnons ×3 contre les grands boss', () => {
  assert.equal(GRAND_BOSS_TEAM_MULT, 3);
});
