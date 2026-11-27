// v10.4 (parties 1 et 2) : pages plein écran (socle commun, Personnage, Forge) et gain réel des renforts.
// Le socle : contrat de src/ui/page.js et src/ui/page.css. Partie 2 : jamais un renfort à « +0 % » ni « +0,01 % »
// proposé comme action, l'avant → après ne liste que ce qui change, et un renfort presque sans effet le dit et propose mieux.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

globalThis.localStorage ??= { getItem: () => null, setItem: () => {}, removeItem: () => {} };
const ctx2d = new Proxy({}, {
  get: (t, k) => (k === 'getImageData' || k === 'createImageData'
    ? (x, y, w = 1, h = 1) => ({ data: new Uint8ClampedArray(Math.max(1, (w | 0) * (h | 0)) * 4), width: w, height: h })
    : k === 'measureText' ? () => ({ width: 1 }) : k in t ? t[k] : () => {}),
  set: (t, k, v) => { t[k] = v; return true; },
});
globalThis.document ??= { createElement: () => ({ width: 1, height: 1, getContext: () => ctx2d, toDataURL: () => 'data:' }) };

const { BALANCE } = await import('../src/data/balance.js');
const { createNewState } = await import('../src/core/state.js');
const { generateItem, makeItem } = await import('../src/core/loot.js');
const { Rng } = await import('../src/core/rng.js');
const { levelForStage } = await import('../src/core/combat.js');
const forge = await import('../src/core/forge.js');
const inv = await import('../src/core/inventory.js');
const page = await import('../src/ui/page.js');
const inventoryPanel = (await import('../src/ui/panels/inventory.js')).default;
const forgePanel = (await import('../src/ui/panels/forge.js')).default;
const { forgeNow } = await import('../src/ui/panels/forge.js');
const { reinforceSection } = await import('../src/ui/panels/equip-sheet.js');

const uiWith = (view = {}) => ({ view: { open: new Set(), closed: new Set(), ...view }, tabVisible: {} });
const textOf = (html) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
const lines = (file) => readFileSync(file, 'utf8').split(/\r?\n/);
function rich(stage = 139) {
  const s = createNewState(Date.UTC(2026, 10, 21, 12));
  s.maxStage = stage; s.records.bestStage = stage;
  s.gold = 1e30; s.materials.shards = 1e6;
  return s;
}
// Héros bien équipé au niveau de son étape, sauf une arme très en retard : la renforcer ne rapporte presque rien.
function lagging() {
  const s = rich(139);
  const lvl = levelForStage(s.maxStage);
  const rng = new Rng(5);
  for (let i = 0; i < 40; i++) s.inventory.push(generateItem(s, rng, { level: lvl - (i % 5) }));
  for (const it of [...s.inventory]) inv.equipItem(s, it.id);
  s.inventory = [];
  s.equipment.weapon = makeItem(s, 'dagger', 'common', 3, BALANCE, rng);
  s.playSeconds = 3600; // v10.19 (6.5) : « Objet dépassé » jamais pendant les 10 premières minutes : la partie de ce cas a 1 h de jeu
  return s;
}
// Les « +x % » qu'un écran présenterait comme action : jamais 0 ni 0,0x.
const ZERO = /\+0(?:,0\d?)? %/;

// ------------------------------------------------------------------------------------------- socle des pages
test('socle : PAGE_TABS, PAGE_WHEN et pageActive suivent le contrat', () => {
  assert.ok(page.PAGE_TABS instanceof Set && page.PAGE_TABS.has('inventory') && page.PAGE_TABS.has('forge'));
  assert.equal(typeof page.PAGE_WHEN, 'object');
  const ui = (tab, layout = 'tall', view = {}) => ({ tab, layout, view });
  // v10.17 (A) : sur PC, plus aucune page plein écran (colonne de combat à gauche, fenêtre à droite) ; sur téléphone,
  // tout est en page. Le contrat PAGE_TABS / PAGE_WHEN reste pour les fenêtres étroites.
  assert.equal(page.PC_SIDE_ONLY, true);
  for (const t of ['inventory', 'forge', 'upgrades', 'contracts']) assert.equal(page.pageActive(ui(t)), false, `PC : ${t} dans la fenêtre de droite`);
  const phone = (tab, layout = 'tall') => ({ tab, layout, view: {}, root: { clientWidth: 412 } });
  assert.equal(page.pageActive(phone('inventory')), true);
  assert.equal(page.pageActive(phone('inventory', 'mini')), false, 'petite fenêtre : pas de page');
  assert.equal(page.pageActive(ui('inventory', 'strip')), false);
  assert.equal(page.pageActive(ui(null)), false);
});

test('socle : mode d\'emploi en tête de page.js, feuille liée dans index.html, gabarit .pg complet', () => {
  const head = [];
  for (const l of lines('src/ui/page.js')) { if (!/^\s*\/\//.test(l)) break; head.push(l); }
  assert.ok(head.length >= 10, `mode d'emploi en ${head.length} lignes de commentaire`);
  assert.match(head.join('\n'), /PAGE_TABS/); assert.match(head.join('\n'), /PAGE_WHEN/); assert.match(head.join('\n'), /\.pg-side/);
  assert.match(readFileSync('index.html', 'utf8'), /<link rel="stylesheet" href="src\/ui\/page\.css">/);
  const css = readFileSync('src/ui/page.css', 'utf8');
  for (const sel of ['.pg-top', '.pg-main', '.pg-side', '#page-mini', 'page-narrow', '.pg-side.is-open', '#panel-body > .pg']) assert.ok(css.includes(sel), sel);
  assert.match(css, /--pg-side-w: max\(420px/, 'fiche d\'au moins 420 px sur PC');
  assert.match(css, /--pg-mini-w: 280px; --pg-mini-h: 158px/, 'mini-fenêtre ≈ 280 × 160');
  // Rien ne flotte sur la page : le Sceau, la barre de compétences, le coffre de butin.
  for (const id of ['#next-action', '#skill-bar', '#loot-bag', '#loot-sheet']) assert.ok(css.includes(`#app#app.page-ui ${id}`), id);
  // Le module ne casse pas les préférences de panneau : ui.js garde panelTallFor, side-ui, bottom-ui.
  const ui = readFileSync('src/ui/ui.js', 'utf8');
  assert.match(ui, /panelTallFor\(tab = this\.tab\)/); assert.match(ui, /toggle\('side-ui', side\)/); assert.match(ui, /toggle\('bottom-ui', layout === 'tall'\)/);
  assert.equal((ui.match(/syncPage\(this\)/g) ?? []).length, 4, 'ouverture, fermeture, disposition, rendu');
});

// ------------------------------------------------------------------------------------------- partie 2 : gain réel
test('partie 2 (10.13) : un renfort presque sans effet le dit (« Objet dépassé ») et propose « Trouver mieux », sans « +0,01 % » ni « Remettre au niveau »', () => {
  const s = lagging();
  const dagger = s.equipment.weapon;
  const p = forge.upgradePreview(s, dagger);
  assert.ok(!p.atMax && forge.weakUpgrade(p), `cas voulu : gain ${forge.upgradeGainPct(p)} %`);
  const html = reinforceSection(uiWith(), s, dagger);
  assert.ok(textOf(html).includes(`⚠ Objet dépassé · Niv. 3, ton étape : ${levelForStage(s.maxStage)}`), textOf(html));
  assert.ok(html.includes('data-action="find-better" data-value="weapon"'), 'propose « Trouver mieux » sur cette place');
  assert.match(textOf(html), /Trouver mieux ›/);
  assert.ok(!/sharpen|Remettre au niveau/i.test(html), 'plus de « Remettre au niveau »');
  assert.match(html, /class="btn btn-gold eq-do" data-action="upgrade-item"/, 'le bouton doré reste celui du renfort');
  assert.ok(!ZERO.test(textOf(html)), textOf(html).match(/.{20}\+0.{10}/)?.[0]);
  // Même texte dans la fiche de l'Équipement et dans l'atelier 2 ; aucune fiche PC ne parle de remettre au niveau.
  const pages = [inventoryPanel.render(uiWith({ selectedItemId: dagger.id }), s), forgePanel.render(uiWith({ forgeSeg: 'upgrade', forgeUpSel: dagger.id }), s)];
  for (const page of pages) assert.ok(!/sharpen|Remettre au niveau|remettre au niveau/.test(page));
  assert.ok(pages[1].includes(html), 'la Forge garde la section de renfort');
  // v10.13 : la fiche PC de l'Équipement (kit) dit le retard dans l'en-tête, avec « Trouver mieux », et garde Améliorer en doré.
  assert.ok(textOf(pages[0]).includes(`⚠ Objet dépassé · Niv. 3, ton étape : ${levelForStage(s.maxStage)}`), 'étiquette dans la fiche PC');
  assert.ok(pages[0].includes('data-action="find-better" data-value="weapon"'));
  assert.match(pages[0], /class="m-btn-gold"\s+data-action="upgrade-item"/, 'Améliorer est le bouton doré');
  // Sans retard de niveau : l'étiquette générale, et toujours « Trouver mieux ».
  const t = lagging(); t.equipment.weapon.level = levelForStage(t.maxStage);
  const q = forge.upgradePreview(t, t.equipment.weapon);
  if (forge.weakUpgrade(q)) {
    const h = reinforceSection(uiWith(), t, t.equipment.weapon);
    assert.match(textOf(h), /⚠ Presque sans effet sur ta puissance/);
    assert.match(textOf(h), /Trouver mieux ›/);
  }
});

test('10.13 (§ 2) : aucune fonction sharpen* exportée, aucune clé d\'équilibrage, une vieille sauvegarde se charge sans erreur', async () => {
  for (const mod of [forge, inv]) assert.deepEqual(Object.keys(mod).filter((k) => /sharpen/i.test(k)), []);
  assert.deepEqual(Object.keys(BALANCE.forge).filter((k) => /sharpen/i.test(k)), []);
  const { sanitizeState } = await import('../src/core/state.js');
  const old = JSON.parse(JSON.stringify(rich(139)));
  old.ui = { ...old.ui, sharpenFx: true, lastSharpen: 3 }; // champs liés d'une vieille sauvegarde
  old.sharpened = { x: 1 };
  old.inventory = old.inventory.slice(0, 3).map((i) => ({ ...i, sharpened: true }));
  const loaded = sanitizeState(old, BALANCE, Date.now());
  assert.ok(loaded && Array.isArray(loaded.inventory));
  assert.ok(forgePanel.render(uiWith({ forgeSeg: 'upgrade' }), loaded).length > 100);
});

test('10.13 (§ 2) : « Trouver mieux » ouvre le sac filtré sur la place, trié par gain — sinon la Forge › Fabriquer sur cette place', async () => {
  const { UI } = await import('../src/ui/ui.js');
  for (const withBetter of [true, false]) {
    const s = lagging();
    s.inventory = [];
    if (withBetter) {
      const good = makeItem(s, 'short_sword', 'legendary', levelForStage(s.maxStage), BALANCE, new Rng(9));
      s.inventory.push(good);
    }
    const calls = [];
    const view = { selectedItemId: 'x', sheetOpen: 'item' };
    const fake = { state: s, view, closeModal() {}, invalidate() {}, openTab: (t, v) => { calls.push(t); Object.assign(view, v ?? {}); } };
    UI.prototype.findBetter.call(fake, 'weapon');
    assert.equal(!!inv.betterForSlot(s, 'weapon'), withBetter);
    if (withBetter) {
      assert.deepEqual(calls, ['inventory']);
      assert.equal(s.ui.slotFilter, 'weapon');
      assert.equal(s.ui.sortBy, 'gain');
      assert.equal(view.sheetOpen, null, 'la fiche se ferme : on voit le sac');
    } else {
      assert.deepEqual(calls, ['forge']);
      assert.equal(view.forgeSeg, 'craft');
      assert.equal(view.craftSlot, 'weapon');
    }
  }
});

test('partie 2 : l\'atelier 2 ne propose jamais un renfort à +0 % — meilleur gain réel, sinon la statistique nommée', () => {
  const s = lagging();
  const now = forgeNow(s);
  const advice = forge.upgradeAdvice(s);
  assert.ok(!ZERO.test(now.upgrade.text), now.upgrade.text);
  assert.ok(['upgrade', 'stat', 'none'].includes(advice.kind), advice.kind);
  if (advice.kind === 'upgrade') {
    assert.ok(advice.row.gainPct >= forge.WEAK_GAIN_PCT);
    assert.notEqual(advice.row.item.id, s.equipment.weapon.id, 'la dague en retard n\'est pas proposée');
    assert.match(now.upgrade.text, /: \+\d+(,\d)? % de puissance$/);
  }
  // Seule la dague portée : tout est trop bas : jamais « Dague +0 → +1 : +0 % ».
  const solo = rich(139); solo.equipment.weapon = makeItem(solo, 'dagger', 'common', 3, BALANCE, new Rng(2));
  const ring = makeItem(solo, 'band_ring_ruby', 'legendary', levelForStage(139), BALANCE, new Rng(3)); solo.equipment.ring = ring;
  for (let i = 0; i < 3; i++) forge.upgradeItem(solo, ring.id, null);
  const a2 = forge.upgradeAdvice(solo);
  for (const r of a2.ranking) if (a2.kind === 'upgrade' && r.item.id === a2.row.item.id) assert.ok(r.gainPct >= forge.WEAK_GAIN_PCT);
  const line = forgeNow(solo).upgrade.text;
  assert.ok(!ZERO.test(line) && !/\+0 → \+1 : \+0/.test(line), line);
  // Liste de l'atelier : un renfort presque sans effet est écrit « presque sans effet », pas « +0 % de puissance ».
  const list = forgePanel.render(uiWith({ forgeSeg: 'upgrade' }), s);
  assert.ok(!/fg-up-gain[^>]*>\+0(,0\d?)? %/.test(list));
  assert.match(list, /fg-up-gain muted num">presque sans effet</);
  // v10.13 : un seul bouton doré par écran (celui du détail de l'atelier) : les 4 boutons des ateliers sont sombres (jamais bleus).
  assert.equal((list.match(/class="btn fg-btn"/g) ?? []).length, 4);
  assert.equal((list.match(/btn-gold/g) ?? []).length, 1, 'un seul bouton doré visible dans la Forge');
  assert.ok(!list.includes('btn btn-primary fg-btn'));
});

test('partie 2 : l\'avant → après ne liste que les statistiques qui changent (fiche, Forge, Équipement)', () => {
  const s = rich(139);
  const rng = new Rng(17);
  const lvl = levelForStage(139);
  const items = [];
  for (let i = 0; i < 60; i++) { const it = generateItem(s, rng, { level: lvl - (i % 9) }); items.push(it); s.inventory.push(it); }
  let rows = 0;
  for (const it of items) {
    const html = reinforceSection(uiWith(), s, it);
    for (const m of html.matchAll(/<div class="eq-row[^"]*"><span>(?:(?!<\/div>).)*?<\/span><span class="num muted">([^<]*)<\/span><i>→<\/i><(?:b|span) class="[^"]*">([^<]*)</g)) {
      rows += 1;
      assert.notEqual(m[1], m[2], `${it.name} : ligne identique « ${m[0].replace(/<[^>]*>/g, ' ')} »`);
    }
  }
  assert.ok(rows > 60, `${rows} lignes vérifiées`);
});

// ------------------------------------------------------------------------------------------- Personnage en page
test('Personnage : gabarit de page, icônes 48 px, noms d\'objets sur une ligne, moins de mots', () => {
  const s = rich(139);
  const rng = new Rng(9);
  for (let i = 0; i < 30; i++) s.inventory.push(generateItem(s, rng, { level: 100 + i }));
  for (const it of [...s.inventory]) inv.equipItem(s, it.id);
  const html = inventoryPanel.render(uiWith(), s);
  // v10.13 : PC en kit (equip-desk.js) : un cadre, trois colonnes (personnage · sac · détails), cases illustrées, aucune liste déroulante.
  for (const cls of ['class="m-frame de"', 'class="d-cols3a de-cols"', 'class="de-col de-who"', 'class="m-card de-col de-bag"', 'class="m-card de-col de-det"']) assert.ok(html.includes(cls), cls);
  assert.equal((html.match(/data-action="eq-slot"/g) ?? []).length, 6, '6 places');
  const places = html.slice(html.indexOf('de-slots'), html.indexOf('class="m-stats2"'));
  assert.equal((places.match(/<img class="px m-tile-img" src="assets\/ui\/art106\/item_/g) ?? []).length, Object.values(s.equipment).filter(Boolean).length, 'chaque objet porté a son image');
  for (const m of places.matchAll(/<small>([^<]*)<\/small>/g)) assert.ok(!/ /.test(m[1].trim()), `un seul mot sous la place : « ${m[1]} »`);
  assert.ok(!html.includes('<select') && html.includes('class="de-filters"'), 'filtres en boutons à icône');
  assert.ok(!html.includes('data-action="reforge"'), 'Reforger : les trois cartes sont dans le mode Reforger');
  // Le mode Reforger montre ses trois cartes illustrées toujours visibles (pas de pli « Plus »).
  const worn = Object.values(s.equipment).find((i) => i && forge.canReforge(i));
  if (worn) {
    const rf = inventoryPanel.render(uiWith({ selectedItemId: worn.id, itemTab: 'reforge' }), s);
    assert.equal((rf.match(/class="de-rcard[ "]/g) ?? []).length, 3, 'trois cartes');
    assert.ok(rf.includes('data-action="reforge"') && rf.includes('data-action="rf-pick"') && rf.includes('data-action="retype-item"'));
    assert.ok(!rf.includes('Plus : '), 'plus de pli « Plus… »');
  }
  // Améliorer est le bouton doré de la fiche (objet porté), avec « +N » +N+1 » et les coûts en cases.
  const sheet = html.slice(html.indexOf('class="m-card de-col de-det"'));
  assert.ok(sheet.includes('data-action="upgrade-item"') && sheet.includes('em-lvlup') && sheet.includes('m-cost'), 'Améliorer, +N » +N+1 et coûts dans la fiche');
});

test('10.13 (§ 2) : fiche téléphone — étiquette « Objet dépassé » + « Trouver mieux », Améliorer en doré, aucun « Remettre au niveau »', () => {
  const s = lagging();
  const dagger = s.equipment.weapon;
  const phone = (view) => ({ view: { open: new Set(), closed: new Set(), ...view }, tabVisible: {}, root: { classList: { contains: () => true }, clientWidth: 412 } });
  for (const itemTab of ['up', 'reforge', 'equip']) {
    const html = inventoryPanel.render(phone({ selectedItemId: dagger.id, sheetOpen: 'item', itemTab }), s);
    assert.ok(!/sharpen|Remettre/.test(html), `onglet ${itemTab} : plus de remise au niveau`);
    if (itemTab === 'up') {
      assert.ok(textOf(html).includes(`⚠ Objet dépassé · Niv. 3, ton étape : ${levelForStage(s.maxStage)}`), textOf(html).slice(0, 400));
      assert.ok(html.includes('data-action="find-better" data-value="weapon"'));
      assert.match(html, /m-btn-gold[^>]*data-action="upgrade-item"|data-action="upgrade-item"[^>]*m-btn-gold/, 'Améliorer est le bouton doré');
    }
  }
  // « Reforger » ne liste plus d'objet seulement parce qu'il est en retard de niveau.
  assert.ok(!/Remettre/.test(inventoryPanel.render(phone({ eqTab: 'reforge' }), s)));
});
