// v10.16 (compléments) : taille des boss de campagne, de donjon et de la Tour ; Léviathan dans le Royaume englouti ;
// file d'annonces (portail, DANGER, Moment fort) ; plus de croissant ni d'assombrissement en combat de boss.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bossRank, bossHeightRatio, bossBoost, bossMinX, BOSS_HERO_GAP } from '../src/render/boss-feel.js';
import { AnnounceQueue } from '../src/ui/announce-queue.js';
import { GIANTS } from '../src/data/grand-bosses.js';
import { ZONES } from '../src/data/zones.js';
import { BOSSES } from '../src/data/enemies.js';

test('taille des boss : 1,3 / 1,5 / 1,6 fois le héros aux étapes 5, 10, 15 ; 1,8 au méga boss, en donjon et dans la Tour', () => {
  assert.equal(bossHeightRatio('mini'), 1.3);
  assert.equal(bossHeightRatio('mid'), 1.5);
  assert.equal(bossHeightRatio('hard'), 1.6);
  assert.equal(bossHeightRatio(undefined), 1.8); // méga boss (étape X-20) : pas de `tier`
  assert.equal(bossHeightRatio('dungeon'), 1.8);
  assert.equal(bossHeightRatio('mini', { dungeon: true }), 1.8);
  assert.equal(bossHeightRatio('mid', { tower: true }), 1.8);
  assert.equal(bossRank(BOSSES.ash_dragon.tier), 'mega');
  assert.equal(bossRank(BOSSES.mini_treant.tier), 'mini');
});

test('taille des boss : agrandi jusqu\'au minimum, jamais réduit', () => {
  assert.equal(bossBoost(50, 50, 1.8), 1.8);
  assert.equal(bossBoost(200, 50, 1.8), 1);
  assert.equal(bossBoost(0, 50, 1.8), 1);
  assert.ok(Math.abs(bossBoost(60, 40, 1.5) - 1) < 1e-9);
});

test('écart héros-boss : au moins 24 px d\'écran jusqu\'au bord de la silhouette', () => {
  assert.equal(BOSS_HERO_GAP, 24);
  // échelle 3 (1 px de jeu = 3 px d'écran) : 8 px de jeu ; bord de silhouette 5 px après le bord de l'image.
  const x = bossMinX(100, 5, 3);
  assert.equal(x + 5 - 100, 8);
  assert.ok((x + 5 - 100) * 3 >= 24);
});

test('Léviathan : décor et Carte de la fête du Royaume englouti (ocean)', () => {
  const lev = GIANTS.find((g) => g.id === 'leviathan');
  assert.equal(lev.zone, 'ocean');
  assert.equal(ZONES[lev.mapZone].id, 'ocean');
});

test('file d\'annonces : une seule à la fois, portail puis DANGER, puis le Moment fort', () => {
  const q = new AnnounceQueue();
  q.push({ kind: 'moment', ms: 4000, id: 'm' });
  q.push({ kind: 'danger', ms: 1800 });
  q.push({ kind: 'portal', ms: 1300 });
  const order = [];
  for (let t = 0; t < 10000; t += 100) {
    const { start } = q.tick(t);
    if (start) order.push([start.kind, t]);
  }
  assert.deepEqual(order.map((x) => x[0]), ['portal', 'danger', 'moment']);
  assert.ok(order[1][1] >= 1300 && order[2][1] >= 1300 + 1800, 'jamais deux en même temps');
});

test('file d\'annonces : une arrivée de boss interrompt un Moment fort en cours', () => {
  const q = new AnnounceQueue();
  q.push({ kind: 'moment', ms: 4000 });
  assert.equal(q.tick(0).start.kind, 'moment');
  q.push({ kind: 'portal', ms: 1300 });
  const r = q.tick(500);
  assert.equal(r.stop.kind, 'moment');
  assert.equal(r.start.kind, 'portal');
});

test('file d\'annonces : jamais de Moment fort par-dessus une fenêtre ouverte (il attend la fermeture)', () => {
  const q = new AnnounceQueue();
  q.push({ kind: 'moment', ms: 4000 });
  assert.equal(q.tick(0, { panelOpen: true }).start, null);
  assert.equal(q.tick(5000, { panelOpen: true }).start, null);
  q.push({ kind: 'danger', ms: 1000 });
  assert.equal(q.tick(5100, { panelOpen: true }).start.kind, 'danger'); // l'alerte de boss passe (sur la scène)
  assert.equal(q.tick(7000, { panelOpen: false }).start.kind, 'moment');
  // ouverture d'une fenêtre pendant le moment fort : il s'arrête
  assert.equal(q.tick(7500, { panelOpen: true }).stop.kind, 'moment');
});

test('sans noircir la scène : plus d\'ombre sous l\'alerte DANGER ni de voile rouge à l\'arrivée d\'un boss', () => {
  assert.ok(!readFileSync(new URL('../src/ui/boss-warning.js', import.meta.url), 'utf8').includes('<div class="bw-shade">'));
  assert.ok(!/flash\.classList\.add\('on'\)/.test(readFileSync(new URL('../src/ui/ui.js', import.meta.url), 'utf8')));
});

test('plus de croissant en combat de boss : ni traînée courbe, ni ruban d\'arme, ni arc de taille contre un grand boss', () => {
  const scene = readFileSync(new URL('../src/render/scene.js', import.meta.url), 'utf8');
  assert.match(scene, /boss: this\.bigBoss \|\| this\.bossFight \}\)\) return;/); // v10.18 (4.6) : critTrailAllowed (boss-feel.js)
  assert.match(scene, /ribbon && !this\.bigBoss && !this\.bossFight/);
  const vfx = readFileSync(new URL('../src/render/vfx.js', import.meta.url), 'utf8');
  assert.match(vfx, /if \(slash\) \{[^}]*return true; \}/);
});

test('1.6 bis : face à un grand boss, héros ×1,4 et nuage du souffle à 40 % au plus sur téléphone ; plus de ruban d\'arme', async () => {
  const { readFileSync } = await import('node:fs');
  const wb = readFileSync(new URL('../src/render/world-boss-scene.js', import.meta.url), 'utf8');
  const { HERO_SCALE_VS_GIANT } = await import('../src/render/world-boss-scene.js');
  assert.equal(HERO_SCALE_VS_GIANT, 1.4);
  assert.match(wb, /this\.r\.heroScale = HERO_SCALE_VS_GIANT/);
  assert.match(wb, /alpha: r\.tall \? 0\.4 : 1/);
  const sc = readFileSync(new URL('../src/render/scene.js', import.meta.url), 'utf8');
  assert.match(sc, /const ribbon = !\(this\.hero\.combo >= 0\) && !this\.bigBoss/);
  assert.match(sc, /heroLeft: HERO_X - HERO_ANCHOR\.x \+ hs\.l - grow/, 'l\'équipe recule d\'autant que le héros grandit');
});
