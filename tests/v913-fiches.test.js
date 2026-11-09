// v9.1.3 (chantier 2) : fiches, équipement, compagnons, boss — rendu des panneaux en Node (canvas factice).
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

const NOW = Date.UTC(2026, 10, 2, 12);
const { createNewState } = await import('../src/core/state.js');
const { generateItem } = await import('../src/core/loot.js');
const { Rng } = await import('../src/core/rng.js');
const { recordBossVictory, bossesInOrder } = await import('../src/core/powers.js');
const { COMPANIONS } = await import('../src/data/companions.js');
const { COMPANION_ROLES } = await import('../src/data/synergies.js');
const inventory = (await import('../src/ui/panels/inventory.js')).default;
const companions = (await import('../src/ui/panels/companions.js')).default;
const boss = (await import('../src/ui/panels/boss.js')).default;
const dungeons = (await import('../src/ui/panels/dungeons.js')).default;

const uiWith = (view = {}, open = []) => ({ view: { open: new Set(open), closed: new Set(), ...view }, tabVisible: {} });
function midState() {
  const s = createNewState(NOW);
  s.maxStage = 60;
  const rng = new Rng(3);
  for (let i = 0; i < 30; i++) s.inventory.push(generateItem(s, rng, { level: 50 }));
  return s;
}

test('fiche d\'objet : onglets Comparer / Améliorer / Ranger, verrou en icône, Équiper toujours visible', () => {
  const s = midState();
  const item = s.inventory[0];
  for (const [tab, marker] of [['compare', 'stat-list'], ['upgrade', 'data-action="upgrade-item"'], ['store', 'data-action="to-stash"']]) {
    const html = inventory.render(uiWith({ selectedItemId: item.id, sheetOpen: 'item', itemTab: tab }), s);
    assert.match(html, /data-action="item-tab" data-value="compare"/);
    assert.ok(html.includes(marker), `onglet ${tab}`);
    assert.match(html, /class="btn icon-btn lock-btn/);
    assert.match(html, /data-action="equip"|Arme de/);
    assert.ok(!html.includes('Détails : renforcer'), 'plus de long repli Détails');
  }
});

test('sac : 7 cases portées en ligne, plus de titre SAC en double, filtre en icônes, Équiper le meilleur seulement s\'il sert', () => {
  const s = createNewState(NOW);
  let html = inventory.render(uiWith(), s);
  assert.equal((html.match(/class="inv-gear-row"/g) ?? []).length, 1);
  assert.ok(!html.includes('<div class="section-title">Sac</div>'));
  assert.equal((html.match(/data-action="filter" data-value=/g) ?? []).length, 5);
  assert.ok(!html.includes('data-action="equip-best"'), 'sac vide : rien à équiper');
  s.inventory.push(generateItem(s, new Rng(1), { level: 5, slot: 'ring' }));
  html = inventory.render(uiWith(), s);
  assert.ok(html.includes('data-action="equip-best"'), 'emplacement vide : utile');
});

test('réglages du sac : une phrase et 3 replis ; rangement des mannequins plus répété ; fusion par groupe repliée', () => {
  const s = midState();
  const html = inventory.render(uiWith({}, ['bag-settings']), s);
  const body = html.slice(html.indexOf('Réglages du sac'));
  for (const id of ['bag-lot', 'bag-rule', 'bag-advanced']) assert.ok(body.includes(`data-value="${id}"`), id);
  assert.ok(!body.includes('data-action="auto-mannequin"'));
  assert.ok(!body.includes('data-action="recycle-mode"'), 'le mode est en réglage avancé');
  const adv = inventory.render(uiWith({}, ['bag-settings', 'bag-advanced']), s);
  assert.ok(adv.includes('data-action="recycle-mode"'));
  const forge = inventory.render(uiWith({ invView: 'forge' }), s);
  if (forge.includes('data-action="fuse-all"')) assert.ok(!forge.includes('data-action="fuse" '), 'groupes repliés sous Fusionner tout');
});

test('builds en cartes : résumé et Équiper sur la carte', () => {
  const s = midState();
  s.loadouts[1] = { ...s.loadouts[1], team: [], gear: { weapon: 'x', helmet: null }, powers: ['a'] };
  const html = inventory.render(uiWith({}, ['inv-builds']), s);
  assert.equal((html.match(/class="card build-card/g) ?? []).length, s.loadouts.length);
  assert.ok(html.includes('data-action="apply-build" data-value="1"'));
  assert.ok(!html.includes('data-action="apply-build" data-value="0"'), 'build vide : pas d\'Équiper');
  assert.ok(html.includes('1/7 objets') && html.includes('1 pouvoir'));
});

test('fiche compagnon : plus de ligne Défense, formule derrière « ? », compétences de rôle et synergies du rôle repliées, avant ▶ après', () => {
  const s = createNewState(NOW);
  const c = COMPANIONS.find((x) => COMPANION_ROLES[x.id] && x.skill);
  s.companions.owned[c.id] = { level: 3, stars: 1 };
  const html = companions.render(uiWith({ companionSel: c.id, sheetOpen: 'companion' }), s);
  assert.ok(!html.includes('Défense <b>'));
  // v9.3.3 : trois compétences (passive, active, ultime) avec niveau et amélioration ; anciennes 2e/3e = évolutions de l'active.
  assert.ok(html.includes('skill3 passive') && html.includes('skill3 active') && html.includes('skill3 ultimate'));
  assert.ok(html.includes('data-action="skill-up"') && html.includes('Niv. 5 : ajoute') && html.includes('data-value="comp-role-syn"'));
  assert.match(html, /Niv\. 3 ▶ 4/);
  // Portraits : une seule unité animée (la sélectionnée), les autres en image fixe.
  for (const x of COMPANIONS.slice(0, 6)) s.companions.owned[x.id] ??= { level: 1, stars: 1 };
  const grid = companions.render(uiWith({ companionSel: c.id }), s);
  assert.ok((grid.match(/class="px still"/g) ?? []).length >= 5);
  const synAll = companions.render(uiWith({ companionSel: c.id }, ['synergies']), s);
  assert.ok(!synAll.includes('Le chevalier protège le mage fragile</span>'), 'plus de phrase d\'ambiance');
});

test('boss : fiche en feuille du bas, histoire, récompenses et familles repliées', () => {
  const s = createNewState(NOW);
  const id = bossesInOrder()[0];
  recordBossVictory(s, id, new Rng(2));
  const html = boss.render(uiWith({ bossSel: id, sheetOpen: 'boss' }), s);
  assert.match(html, /codex-detail sheet sheet-open/);
  assert.ok(html.includes('data-action="close-sheet"'));
  for (const f of ['boss-lore', 'boss-rewards', 'boss-families']) assert.ok(html.includes(`data-value="${f}"`), f);
  assert.ok(!html.includes('class="lore"'), 'histoire repliée');
});

test('donjons : plus de « Compagnons conseillés »', () => {
  const s = createNewState(NOW);
  s.maxStage = 200;
  const html = dungeons.render(uiWith({}, ['dungeon-more']), s);
  assert.ok(!/conseill/i.test(html));
});
