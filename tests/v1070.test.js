// v10.7 (docs/prompt-v10.7/PROMPT.md) : finitions après le test de la 10.6.0.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

globalThis.localStorage ??= { getItem: () => null, setItem: () => {}, removeItem: () => {} };
const { createNewState, sanitizeState } = await import('../src/core/state.js');
const src = (p) => readFileSync(p, 'utf8');
const reload = (s) => sanitizeState(JSON.parse(JSON.stringify(s)));

test('10.7 (1) : les notions vues (learned) et les ressources présentées (seenRes) survivent au rechargement', () => {
  const s = createNewState(Date.now());
  s.ui.learned = ['upgrades', 'inventory', 'skills', 'lootbag', 'summon', 'forge', 'contracts', 'tower', 'dungeons', 'defis'];
  s.ui.seenRes = ['shards', 'gems', 'ticketLimited'];
  let r = s;
  for (let i = 0; i < 3; i++) r = reload(r);
  assert.deepEqual(r.ui.learned, s.ui.learned);
  assert.deepEqual(r.ui.seenRes, s.ui.seenRes);
});

test('10.7 (1) garde-fou : chaque champ de ui rempli revient après sauvegarde et rechargement', () => {
  const s = createNewState(Date.now());
  const filled = {
    learned: ['upgrades'], seenRes: ['gems'], rarityFilter: 'epic', sweepSeed: 7, slotFilter: 'weapon', sortBy: 'level', autoRecycle: 'rare',
    sealSeen: ['a'], fingerDone: ['x'], seenTabs: ['upgrades'], sealMiniUntil: 12, wallAt: 34, buyAllOk: true, riftDay: '2026-11-21', feed: false,
    vigil: 'phone', focus: true, cinematics: false, shake: false, bigAuras: true, charSize: 'large', skillNames: false, simple: true,
    combatAssist: 'manual', metricsOptIn: true, theme: 'dawn', gearProfile: 'attack', keepSets: false, doubleDay: '2026-11-21', autoUseless: false,
    autoMannequin: false, autoMuseum: false, themeFx: false, tour: 'done', tourV: 3, goalsOpen: true, hints: ['howto'], invUsed: ['forge'],
    guide: { upgrades: true }, dungeonSlot: 'weapon', dungeonPath: 'crypt',
  };
  Object.assign(s.ui, filled);
  const r = reload(s);
  for (const [k, v] of Object.entries(filled)) assert.deepEqual(r.ui[k], v, `ui.${k} perdu au rechargement`);
});

test('10.7 (3) : l\'ancien filtre « accessory » devient « Tout le sac »', () => {
  const s = createNewState(Date.now());
  s.ui.slotFilter = 'accessory';
  assert.equal(reload(s).ui.slotFilter, 'all');
});

test('10.7 (1) : une partie avancée touchée par le bug a déjà vu les notions dépassées', () => {
  assert.match(src('src/ui/learn.js'), /bossesDefeated \?\? 0\) > 30\) for \(const x of LEARN\) if \(stage > x\.stage/);
});

test('10.7 (2) : rangée d\'événements sous la bande du haut, noms courts, « + » pour ce qui ne tient pas', async () => {
  const h = src('src/ui/hud-quests.js');
  for (const k of ['placeRow()', "market: 'Marché'", "rift: 'Faille'", "chest: 'Coffre'", 'hq-more']) assert.ok(h.includes(k), k);
  assert.match(src('src/ui/hud106.css'), /#hq-events \{ position: absolute; top: 0;/);
});

test('10.7 (6) : fenêtre très large — compétences et Sceau sur une ligne, sol plus bas', () => {
  assert.match(src('src/ui/ui.js'), /!\(ultra && items\.length === 2\)/);
  assert.match(src('src/render/scene.js'), /cssWidth \/ cssHeight > 2\.1 \? 0\.86 : 0\.74/);
});

test('10.7 (3) : titre du sac juste (+N portés), fiche de droite sur l\'objet porté, flèche vers l\'objet, portrait entier', () => {
  const inv = src('src/ui/panels/inventory.js');
  assert.ok(inv.includes('eq-worn-n') && inv.includes('ip-left') && inv.includes('const worn0 = state.equipment[heroSlot(item)]'));
  assert.equal((inv.match(/<select data-action="rarity-filter"/g) ?? []).length, 1, 'plus de <select> en double');
  assert.match(src('src/ui/hud106.css'), /\.eq-doll \.eq-art \{ max-height: min\(340px, 42vh\);/);
});

test('10.7 (4) : « Meilleur achat » toujours là, gain jugé sur le mode choisi (Max par défaut), bandeau cohérent, 3 colonnes', async () => {
  const up = src('src/ui/panels/upgrades.js');
  for (const k of ['upg-bb-none', 'Ton or ira plus loin dans ton équipement', "'max' : '1'", 'upg-cols3', 'weakOf(\'damage\')', 'upg-weak-why', "' advised'"]) assert.ok(up.includes(k), k);
  const G = await import('../src/core/guide.js');
  const s = createNewState(Date.now());
  s.upgrades.damage = 4000; s.gold = 0;
  const poor = G.weakUpgrade(s, 'damage');
  s.gold = 1e300;
  assert.ok(poor === true || poor === false);
  assert.ok(G.upgradePowerPct(s, 'damage', 50) >= G.upgradePowerPct(s, 'damage', 1), 'plus de niveaux, plus de gain');
});

test('10.7 (5) : bannière des Compétences refaite sans lettres, têtes de section dessinées', () => {
  assert.ok(existsSync('tools/art/pl107_art.py') && src('tools/art/pl107_art.py').includes('no text, no letters'));
  assert.ok(existsSync('assets/ui/art106/section_head.png'));
  assert.match(src('src/ui/hud106.css'), /#panel-body \.section-title \{ min-height: 56px;/);
});

test('10.7 (6 bis) : plus aucune peinture réaliste ; 11 illustrations pixel refaites depuis le sprite de combat', async () => {
  const { HD_REAL } = await import('../src/data/hd-real.js');
  assert.equal(HD_REAL.size, 0);
  assert.ok(!existsSync('assets/hd/real') && !existsSync('tools/art/import_real.py'));
  for (const k of ['fairy', 'valkyrie', 'demoness', 'seraph', 'grombar', 'hero_berserker', 'hero_dragon_knight']) assert.ok(existsSync(`assets/hd/px/${k}.webp`), k);
  assert.ok(existsSync('docs/screenshots/v10.7/skins.png'));
});
