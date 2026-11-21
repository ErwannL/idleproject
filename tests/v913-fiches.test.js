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
const forgePanel = (await import('../src/ui/panels/forge.js')).default;
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

// v10.3 (8) : la fiche d'objet n'est plus une fenêtre par-dessus : elle est toujours là, à côté du personnage.
test('v10.3 : fiche d\'objet toujours visible — part de puissance, « Ce qu\'elle donne », Renforcer, Équiper / Recycler, sans fenêtre', () => {
  const s = midState();
  const item = s.inventory[0];
  const html = inventory.render(uiWith({ selectedItemId: item.id, sheetOpen: 'item' }), s);
  assert.ok(html.includes('class="eq-sheet') && !html.includes('unit-pop'), 'fiche dans la page, pas de fenêtre');
  assert.match(html, /Ce qu'(elle|il) donne/);
  assert.match(html, /Niveau d'objet<\/span><b class="num">\d+<\/b>/, 'le niveau de l\'objet est dans la fiche');
  assert.match(html, /data-action="equip"|data-action="gear-equip"|Pour : /);
  assert.ok(html.includes('data-action="recycle"'));
  assert.ok(html.includes('data-action="upgrade-item"') && !html.includes('Effets visuels en combat'), 'Renforcer visible sans clic de plus');
  assert.ok(html.includes('data-action="lock"') && html.includes('data-action="to-stash"'), 'Protéger et Ranger visibles');
  // Objet porté : Renforcer tout de suite, « Retirer », « Changer », sa part de la puissance, aucun bouton « Équipé » grisé.
  const worn = s.inventory.find((i) => i.slot === 'helmet') ?? s.inventory[1];
  s.inventory.splice(s.inventory.indexOf(worn), 1);
  s.equipment[worn.slot === 'earring' ? 'amulet' : worn.slot] = worn;
  const wornHtml = inventory.render(uiWith({ selectedItemId: worn.id, sheetOpen: 'item' }), s);
  assert.ok(wornHtml.includes('data-action="upgrade-item"'), 'objet porté : Renforcer visible tout de suite');
  assert.ok(wornHtml.includes('data-action="eq-unequip"') && wornHtml.includes('data-action="eq-change"'));
  assert.match(wornHtml, /de ta puissance totale/);
  assert.ok(!/<button class="btn" disabled>Équipé<\/button>/.test(wornHtml));
  // Rien de touché : la fiche montre quand même le premier objet porté (jamais d'écran sans fiche).
  const idle = inventory.render(uiWith(), s);
  assert.ok(idle.includes('class="eq-sheet'), 'fiche présente sans toucher');
});

test('Équipement : 6 places autour du héros, bandeau des ressources, filtres rangés, Équipement rapide seulement s\'il sert', () => {
  const s = createNewState(NOW);
  let html = inventory.render(uiWith(), s);
  assert.equal((html.match(/class="eq-slot[ "]/g) ?? []).length, 6, '6 places pour le héros');
  assert.ok(html.includes('Tes ressources') && html.includes('data-gloss="shards"') && html.includes('pour les compagnons'));
  assert.ok(!html.includes('<div class="section-title">Sac</div>'));
  // v10.6 (partie 4) : 7 puces illustrées toujours visibles (Tout et une par place) ; le reste reste derrière « Filtres ».
  assert.equal((html.match(/data-action="filter" data-value=/g) ?? []).length, 7);
  assert.ok(!html.includes('data-action="eq-quick"'), 'sac vide : rien à équiper');
  s.inventory.push(generateItem(s, new Rng(1), { level: 5, slot: 'ring' }));
  html = inventory.render(uiWith(), s);
  assert.match(html, /data-action="eq-quick" data-value="hero">Équipement rapide \(1 ▲\)/, 'emplacement vide : utile');
  // La confirmation montre l'avant → après avant d'équiper.
  const confirm = inventory.render(uiWith({ eqQuick: 'hero' }), s);
  assert.ok(confirm.includes('data-action="eq-quick-ok"') && confirm.includes('Avant → après'));
});

test('réglages du sac : une phrase et 3 replis ; rangement des mannequins plus répété ; fusion par groupe repliée', () => {
  const s = midState();
  const html = inventory.render(uiWith({ bagMenu: true }, ['bag-settings']), s); // v9.3.4 : derrière ⚙
  const body = html.slice(html.indexOf('Réglages du sac'));
  for (const id of ['bag-lot', 'bag-rule', 'bag-advanced']) assert.ok(body.includes(`data-value="${id}"`), id);
  assert.ok(!body.includes('data-action="auto-mannequin"'));
  assert.ok(!body.includes('data-action="recycle-mode"'), 'le mode est en réglage avancé');
  const adv = inventory.render(uiWith({ bagMenu: true }, ['bag-settings', 'bag-advanced']), s);
  assert.ok(adv.includes('data-action="recycle-mode"'));
  // v10.3 (9) : la fusion est dans l'onglet Forge (atelier 3) ; une mise par bouton, avec sa mise et sa chance.
  const forge = forgePanel.render(uiWith({ forgeSeg: 'fuse' }), s);
  for (const m of forge.matchAll(/data-action="fuse" data-value="[^"]+" data-stake="(\d)">([^<]+)</g)) assert.match(m[2], new RegExp(`${m[1]} (objets )?· \\d+ %`));
});

test('builds en cartes : résumé et Équiper sur la carte', () => {
  const s = midState();
  s.loadouts[1] = { ...s.loadouts[1], team: [], gear: { weapon: 'x', helmet: null }, powers: ['a'] };
  const html = inventory.render(uiWith({ bagMenu: true }, ['inv-builds']), s); // v9.3.4 : derrière ⚙
  assert.equal((html.match(/class="card build-card/g) ?? []).length, s.loadouts.length);
  assert.ok(html.includes('data-action="apply-build" data-value="1"'));
  assert.ok(!html.includes('data-action="apply-build" data-value="0"'), 'build vide : pas d\'Équiper');
  assert.ok(html.includes('1/7 objets') && html.includes('1 pouvoir'));
});

test('v9.3.4 : popup du compagnon — 3 compétences en icônes, bulle au toucher, Copies, onglets, 2 boutons ; grille en onglets', () => {
  const s = createNewState(NOW);
  const c = COMPANIONS.find((x) => COMPANION_ROLES[x.id] && x.skill);
  s.companions.owned[c.id] = { level: 3, stars: 2 };
  const html = companions.render(uiWith({ companionSel: c.id, sheetOpen: 'companion' }), s);
  assert.ok(html.includes('class="unit-pop') && html.includes('data-action="skill-pop"'));
  assert.equal((html.match(/class="up-skill /g) ?? []).length, 3, 'Passif, Actif, Ultime');
  assert.ok(html.includes('Copies') && !html.includes('Doublons'), 'Copies, plus de Doublons');
  assert.ok(html.includes('data-value="skills"') && html.includes('data-value="gear"') && html.includes('data-value="story"'));
  const bubble = companions.render(uiWith({ companionSel: c.id, sheetOpen: 'companion', skillPop: 'active' }), s);
  assert.ok(bubble.includes('class="up-bubble"') && bubble.includes('data-action="skill-up"'));
  const grid = companions.render(uiWith({}), s);
  assert.ok(!grid.includes('class="unit-pop'), 'pas de fiche sans toucher');
  assert.ok(grid.includes('data-action="comp-tab"') && grid.includes('class="unit-card'));
  assert.ok(!/niv\. \d+ · \d★/.test(grid), 'plus de « niv. 10 · 2★ » sur les cartes');
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
