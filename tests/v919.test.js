// v9.1.9 : apparences (révélation, écran, Fiche), alerte d'arrivée de boss, butin moins fréquent.
import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.localStorage ??= { getItem: () => null, setItem: () => {}, removeItem: () => {} };
const ctx2d = new Proxy({}, {
  get: (t, k) => (k === 'getImageData' || k === 'createImageData'
    ? (x, y, w = 1, h = 1) => ({ data: new Uint8ClampedArray(Math.max(1, (w | 0) * (h | 0)) * 4), width: w, height: h })
    : k === 'measureText' ? () => ({ width: 1 }) : k in t ? t[k] : () => {}),
  set: (t, k, v) => { t[k] = v; return true; },
});
globalThis.document ??= { createElement: () => ({ width: 1, height: 1, getContext: () => ctx2d, toDataURL: () => 'data:' }) };

const { createNewState } = await import('../src/core/state.js');
const { summon } = await import('../src/core/gacha.js');
const { activeHero, heroById, setActiveHero } = await import('../src/core/heroes.js');
const { Rng } = await import('../src/core/rng.js');
const { BALANCE } = await import('../src/data/balance.js');
const { RARITIES } = await import('../src/data/items.js');
const { rollRarity, generateItem } = await import('../src/core/loot.js');
const { computeOfflineRewards } = await import('../src/core/offline.js');
const { newSkins, skinRevealHtml } = await import('../src/ui/skin-reveal.js');
const { bossWarningPlan, LOOP_WINDOW_MS, WARNING_MS } = await import('../src/ui/boss-warning.js');
const hero = (await import('../src/ui/panels/hero.js')).default;
const summonPanel = (await import('../src/ui/panels/summon.js')).default;
const en = await import('../src/i18n/en.js');
const ko = await import('../src/i18n/ko.js');

const NOW = Date.UTC(2026, 10, 2, 12);
const uiWith = (view = {}) => ({ view: { open: new Set(), closed: new Set(), ...view }, tabVisible: {} });

test('apparences : une invocation ×10 signale chaque apparence neuve une seule fois', () => {
  const s = createNewState(NOW);
  s.gems = 1e6;
  const res = summon(s, new Rng(11), 10, 'gems', undefined, 'hero');
  const ids = newSkins(res);
  assert.deepEqual(ids, [...new Set(res.filter((r) => r.isNew).map((r) => r.id))]);
  assert.ok(ids.length > 0);
  // Les doublons et les compagnons ne déclenchent rien.
  assert.deepEqual(newSkins([{ kind: 'hero', id: 'fairy', isNew: false }, { kind: 'companion', id: 'fairy', isNew: true }]), []);
  const html = skinRevealHtml(heroById(ids[0]));
  assert.match(html, /Nouvelle apparence débloquée/);
  assert.match(html, /Porter maintenant/);
  assert.match(html, new RegExp(`r-${heroById(ids[0]).rarity}`));
  assert.match(html, /data-anim="hero:/);
  assert.match(skinRevealHtml(heroById(ids[0]), { worn: true }), /Portée ✓/);
});

test('apparences : porter change la palette du sprite de la scène (activeHero) et seulement si possédée', () => {
  const s = createNewState(NOW);
  assert.equal(setActiveHero(s, 'grombar'), false);
  s.heroes.owned.grombar = { stars: 2 };
  assert.equal(setActiveHero(s, 'grombar'), true);
  assert.equal(activeHero(s).palette.skin, 'grombar'); // render/scene.js dessine heroComposite(…, activeHero(state).palette)
});

test('écran Apparences : aperçu porté, cartes encadrées, Porter en un appui, verrouillées « Obtenu par invocation »', () => {
  const s = createNewState(NOW);
  s.heroes.owned.fairy = { stars: 3 };
  const html = hero.render(uiWith({ heroTab: 'look' }), s);
  assert.match(html, /Apparence équipée/); // v9.2.2 : « Équiper » au lieu de « Porter »
  assert.match(html, /Équipée ✓/);
  assert.match(html, /data-action="set-hero" data-value="fairy"/);
  assert.match(html, /2 doublons/);
  assert.match(html, /Obtenu par invocation/);
  assert.match(html, /look-card r-legendary[^"]* locked/);
  // Fiche : apparence portée nommée, avec un lien vers l'écran.
  const sheet = hero.render(uiWith({ heroTab: 'hero' }), s);
  assert.match(sheet, /Apparence : <b[^>]*>Chevalier/);
  assert.match(sheet, /data-action="open-looks"/); // v9.2.2 : vers Héros › Apparences
  // Invocation › Apparences : lien vers l'écran.
  assert.match(summonPanel.render(uiWith(), s), /data-action="open-looks"/);
});

test('alerte de boss : une par arrivée, courte en boucle, sobre si animations réduites, rien à ×100', () => {
  const mem = {};
  const base = { tier: 'mid', kind: 'orc_boss', name: 'Orc', mode: 'stage', calm: false, fast: false };
  const a = bossWarningPlan(mem, { ...base, enemyId: 1, now: 0 });
  assert.equal(a.head, '⚠ BOSS');
  assert.equal(a.short, false);
  assert.ok(a.ms >= 1500 && a.ms <= 2000);
  assert.equal(bossWarningPlan(mem, { ...base, enemyId: 1, now: 10 }), null); // même arrivée
  const loop = bossWarningPlan(mem, { ...base, enemyId: 2, now: 30000 });
  assert.equal(loop.short, true);
  assert.equal(loop.ms, WARNING_MS.short);
  assert.equal(bossWarningPlan(mem, { ...base, enemyId: 3, now: 30000 + LOOP_WINDOW_MS + 1 }).short, false);
  const mega = bossWarningPlan({}, { ...base, tier: 'mega', enemyId: 4, now: 0, calm: true });
  assert.equal(mega.head, '⚠ DANGER');
  assert.equal(mega.calm, true);
  assert.equal(mega.vibrate, false);
  assert.equal(bossWarningPlan({}, { ...base, mode: 'dungeon', enemyId: 5, now: 0 }).sub, 'Boss du donjon');
  assert.equal(bossWarningPlan({}, { ...base, mode: 'tower', enemyId: 6, now: 0 }).sub, 'Boss de la Tour');
  assert.equal(bossWarningPlan({}, { ...base, enemyId: 7, now: 0, fast: true }), null);
});

test('butin : moins d\'objets, autant d\'Épiques et de Légendaires par monstre (en espérance)', () => {
  const L = BALANCE.loot;
  const w = L.dropRarityWeights;
  const tot = Object.values(w).reduce((a, b) => a + b, 0);
  const old = Object.fromEntries(RARITIES.map((r) => [r.id, r.weight]));
  const oldTot = Object.values(old).reduce((a, b) => a + b, 0);
  const per = (scale, ww, t, id) => L.dropChance * scale * (ww[id] / t);
  for (const id of ['epic', 'legendary']) {
    const ratio = per(L.dropScale, w, tot, id) / per(1, old, oldTot, id);
    assert.ok(Math.abs(ratio - 1) <= 0.1, `${id} ${ratio}`);
  }
  assert.ok(per(L.dropScale, w, tot, 'common') < per(1, old, oldTot, 'common') / 4);
  assert.ok(L.dropScale < 0.5);
  // Le tirage pondéré respecte les poids et le minimum de rareté.
  const rng = new Rng(5);
  const n = { common: 0, rare: 0, epic: 0, legendary: 0 };
  for (let i = 0; i < 20000; i++) n[rollRarity(rng, 'common', w)] += 1;
  assert.ok(Math.abs(n.epic / 20000 - w.epic / tot) < 0.015);
  for (let i = 0; i < 200; i++) assert.notEqual(rollRarity(rng, 'rare', w), 'common');
  // Sans poids : RARITIES (boss, coffres, donjons inchangés).
  const item = generateItem(createNewState(NOW), new Rng(1), { level: 5, minRarity: 'rare' });
  assert.notEqual(item.rarity, 'common');
});

test('butin hors ligne : 3 objets au plus, or du surplus inchangé', () => {
  const s = createNewState(NOW);
  s.stage = s.maxStage = 20;
  const r = computeOfflineRewards(s, NOW - 8 * 3600e3, NOW, new Rng(2));
  assert.ok(r.items.length <= BALANCE.offline.maxItems);
  assert.equal(BALANCE.offline.maxItems, Math.round(10 * BALANCE.loot.dropScale));
});

test('i18n : textes v9.1.9 traduits en anglais et en coréen', () => {
  const texts = ['⚠ DANGER', 'Boss du donjon', 'Boss de la Tour', 'Nouvelle apparence débloquée !', '✦ Nouvelle apparence débloquée ! ✦', 'Porter maintenant',
    'Apparence portée', 'Porté ✓', 'Obtenu par invocation', 'aucun doublon', '3/14 obtenues', 'Mes apparences (3) ›', 'Changer ›', 'Plus tard'];
  const FR = /[éèàçùêâîôûœ]|Porter|obtenues|apparences|Plus tard/;
  for (const t of texts.slice(0, 1).concat(texts.slice(4))) {
    assert.ok(!FR.test(en.translate(t)), `en : ${t} → ${en.translate(t)}`);
    assert.ok(!FR.test(ko.translate(t)), `ko : ${t} → ${ko.translate(t)}`);
  }
});
