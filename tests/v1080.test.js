// v10.8 (docs/prompt-v10.8/PROMPT.md) : rythme, économie, raretés, Âges du Bastion, recherches, Renaissance, téléphone.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

globalThis.localStorage ??= { getItem: () => null, setItem: () => {}, removeItem: () => {} };
const { createNewState, sanitizeState } = await import('../src/core/state.js');
const { computeHeroStats } = await import('../src/core/stats.js');
const { BALANCE } = await import('../src/data/balance.js');
const { RARITIES } = await import('../src/data/items.js');
const C = await import('../src/core/combat.js');
const B = await import('../src/core/bastion.js');
const { AGES, KEYSTONES, RESEARCH, BUILDINGS } = await import('../src/data/bastion.js');
const { upgradeCost, PRICE_FLOOR, killGoldAt } = await import('../src/core/economy.js');
const { worldGate } = await import('../src/core/seals.js');
const R = await import('../src/core/rebirth.js');
const F = await import('../src/core/forge.js');
const { makeItem } = await import('../src/core/loot.js');
const { Rng } = await import('../src/core/rng.js');
const src = (p) => readFileSync(p, 'utf8');
const fixture = () => sanitizeState(JSON.parse(src('tests/fixtures/endgame.json')), BALANCE, Date.now());

test('10.8 (règle) : une partie existante garde exactement sa puissance (pas de rythme long, pas de bonus d\'âge)', () => {
  const s = fixture();
  assert.equal(s.pace, undefined, 'le rythme long ne vaut que pour les parties neuves');
  assert.equal(B.bastionMult(s, 'damage'), 1);
  assert.equal(B.bastionMult(s, 'hp'), 1);
  const again = sanitizeState(JSON.parse(JSON.stringify(s)), BALANCE, Date.now());
  assert.ok(Math.abs(computeHeroStats(again).combatPower / computeHeroStats(s).combatPower - 1) <= 0.01);
  assert.equal(createNewState(Date.now()).pace, 108);
});

test('10.8 (1) : PV ×1,1 par niveau après le monde 3 pour les parties neuves, gardés dans les Failles', () => {
  assert.equal(C.paceHp(59), 1);
  assert.ok(Math.abs(C.paceHp(70) - 1.1 ** 10) < 1e-9);
  assert.equal(C.paceHp(C.levelsPerCycle() + 50), C.paceHp(C.levelsPerCycle()));
});

test('10.8 (1) : Sceaux de monde — Renaissances ou Bastion, seulement pour les parties neuves', () => {
  const s = createNewState(Date.now());
  const w5 = 81; // première étape du monde 5
  assert.ok(worldGate(s, w5));
  s.records.rebirths = 1;
  assert.equal(worldGate(s, w5), null);
  const old = fixture();
  assert.equal(worldGate(old, w5), null);
});

test('10.8 (2) : prix plancher en ennemis de l\'étape, jamais dans les 3 premiers mondes', () => {
  const s = createNewState(Date.now());
  assert.equal(upgradeCost('regen', 0, BALANCE, s), upgradeCost('regen', 0));
  s.maxStage = 500; s.records.bestStage = 500;
  assert.equal(upgradeCost('regen', 0, BALANCE, s), Math.floor(PRICE_FLOOR * killGoldAt(500)));
  assert.match(src('src/ui/panels/upgrades.js'), /pct >= 1000 \? `×\$\{formatNumber/);
});

test('10.8 (3) : 7 raretés ; Mythique ×6,5, Astral ×10, Ascendant ×15 ; jamais tirées au butin courant ; fusion', () => {
  assert.deepEqual(RARITIES.map((r) => r.id), ['common', 'rare', 'epic', 'legendary', 'mythic', 'astral', 'ascendant']);
  assert.deepEqual(RARITIES.slice(4).map((r) => r.statMultiplier), [6.5, 10, 15]);
  assert.ok(RARITIES.slice(4).every((r) => r.weight === 0));
  assert.deepEqual(BALANCE.loot.dropRarityWeights, { common: 10, rare: 42, epic: 42, legendary: 6 });
  assert.equal(F.fusionSize('legendary'), 5);
  assert.deepEqual(F.fusionStakes('astral'), []);
  // Un Mythique remis au niveau bat un Épique du même niveau.
  const s = createNewState(Date.now());
  const rng = new Rng(3);
  const m = makeItem(s, 'short_sword', 'mythic', 100, BALANCE, rng), e = makeItem(s, 'short_sword', 'epic', 100, BALANCE, rng);
  assert.ok(m.stats.damage > e.stats.damage);
  assert.ok(BALANCE.forge.sharpenRarityFactor.mythic < BALANCE.forge.sharpenRarityFactor.legendary, 'remise au niveau moins chère');
  for (const f of ['frame_astral', 'frame_ascendant', 'tear_ascendrya']) assert.ok(existsSync(`assets/ui/art108/${f}.png`), f);
  assert.ok(existsSync('assets/ui/art106/frame_mythic.png'));
});

test('10.8 (4) : 5 Âges, niveaux jusqu\'à 50, 6 bâtiments avec leurs 3 dessins, cartes du village', () => {
  assert.deepEqual(AGES.map((a) => a.maxLevel), [10, 20, 30, 40, 50]);
  const ages = BUILDINGS.filter((b) => b.age);
  assert.deepEqual(ages.map((b) => b.id), ['enchant', 'menagerie', 'observatory', 'runes', 'ascension', 'wonder']);
  for (const b of ages) for (const lv of [1, 2, 3]) assert.ok(existsSync(`assets/ui/art108/bastion_${b.id}_lv${lv}.png`), `${b.id} ${lv}`);
  for (let i = 1; i <= 5; i++) assert.ok(existsSync(`assets/ui/art108/bastion_map_age${i}.png`));
  const s = createNewState(Date.now());
  s.maxStage = 120; s.records.bestStage = 120;
  B.bastionTick(s, Date.now());
  assert.equal(B.bastionAge(s), 2);
  assert.equal(B.maxBuildingLevel(s), 20);
  assert.ok(B.buildingAccess(s, 'enchant').available || /Construis/.test(B.buildingAccess(s, 'enchant').reason));
  assert.match(B.buildingAccess(s, 'observatory').reason, /Âge III/);
  s.bastion.buildings.forge.level = 15;
  assert.ok(Math.abs(B.bastionMult(s, 'damage') - 1.02 ** 5) < 1e-9, 'multiplicatif au-delà du niveau 10');
});

test('10.8 (5) : paliers II à V (6 nœuds par branche), 6 nœuds clés avec leurs médaillons, places de recherche', () => {
  for (const t of [2, 3, 4, 5]) for (const br of ['combat', 'team', 'economy']) assert.equal(RESEARCH.filter((r) => r.tier === t && r.branch === br && !r.keystone).length, 6, `${t} ${br}`);
  assert.equal(KEYSTONES.length, 6);
  for (const r of RESEARCH.filter((x) => x.tier)) assert.ok(existsSync(`assets/ui/art108/${r.art}.png`), r.id);
  const s = createNewState(Date.now());
  s.maxStage = 180; s.records.bestStage = 180;
  B.bastionTick(s, Date.now());
  s.bastion.buildings.library.level = 1;
  assert.equal(B.researchSlots(s), 3, '3e place à l\'âge III');
  assert.equal(B.researchStatus(s, 'fury4').unlocked, false);
  assert.match(B.canResearch(s, 'fury4').reason, /Âge IV/);
});

test('10.8 (6) : Renaissance rentable (×1,25 et blocage de 8 h), Larme d\'Ascendrya à la première de la saison', () => {
  const s = createNewState(Date.now());
  s.maxStage = 200; s.records.bestStage = 200; s.unlocks = { legacy: true };
  s.playSeconds = 20000; s.recordAt = 20000;
  assert.equal(R.rebirthWorth(s), false, 'pas de blocage');
  s.recordAt = 20000 - 8 * 3600;
  assert.equal(R.rebirthWorth(s), true);
  const tears = s.materials.tears ?? 0;
  assert.ok(R.performRebirth(s) > 0);
  assert.equal(s.materials.tears, tears + 1);
  s.maxStage = 200;
  R.performRebirth(s);
  assert.equal(s.materials.tears, tears + 1, 'une seule par saison');
});

test('10.8 (7) : téléphone vertical, bande du bas en grille, menus compacts, Arène allégée', () => {
  assert.match(src('android/app/src/main/java/com/erwannl/idlerpg/MainActivity.java'), /smallestScreenWidthDp < 600[\s\S]*SCREEN_ORIENTATION_USER_PORTRAIT/);
  assert.match(src('src/ui/ui.js'), /play\.classList\.add\('phone-band'\)/);
  const css = src('src/ui/bastion108.css');
  assert.match(css, /#panel > header \{ min-height: 40px !important; height: 40px;/);
  assert.match(css, /\.art-banner-wrap \{ position: relative; height: 60px !important;/);
  assert.match(css, /#app\[data-boss-focus\] #topbar \.chip[^{]*\{ opacity: \.9 !important; \}/);
  assert.match(src('tools/sim-rythme.mjs'), /--days/);
});
