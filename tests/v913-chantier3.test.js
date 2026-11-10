// v9.1.3 (chantier 3) : appui maintenu au doigt, part des dégâts directs, Améliorations, Compétences en grille,
// Talents (outils repliés, vue Région), Renaissance en 3 cartes et prestige regroupé.
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
const { REPEATABLE, TOUCH_REPEATABLE, canHold, repeatDelay } = await import('../src/ui/hold.js');
const { damageShare, measureFarmRate } = await import('../src/core/offline.js');
const { rebirthMultiplier } = await import('../src/core/stats.js');
const { BALANCE } = await import('../src/data/balance.js');
const tree = await import('../src/ui/panels/tree.js');
const skills = await import('../src/ui/panels/skills.js');
const upgrades = (await import('../src/ui/panels/upgrades.js')).default;
const hero = (await import('../src/ui/panels/hero.js')).default;

const uiWith = (view = {}, open = []) => ({ view: { open: new Set(open), closed: new Set(), ...view }, tabVisible: {}, invalidate: () => {} });
const btn = (action) => ({ disabled: false, dataset: { action } });

test('appui maintenu : au doigt, seulement 5 actions (jamais invocation ni marchand) ; accélération de 90 ms à 30 ms', () => {
  assert.deepEqual([...TOUCH_REPEATABLE].sort(), ['buy', 'buy-talent', 'learn-skill', 'upgrade-companion', 'upgrade-item']);
  for (const a of TOUCH_REPEATABLE) assert.ok(REPEATABLE.has(a));
  assert.equal(canHold(btn('summon'), 'touch'), false);
  assert.equal(canHold(btn('buy-merchant'), 'touch'), false);
  assert.equal(canHold(btn('summon'), 'mouse'), true, 'à la souris, inchangé');
  assert.equal(canHold(btn('buy'), 'touch'), true);
  assert.equal(canHold({ disabled: true, dataset: { action: 'buy' } }, 'touch'), false);
  assert.equal(canHold(null, 'touch'), false);
  assert.equal(repeatDelay(0), 90);
  for (let n = 1; n < 40; n++) assert.ok(repeatDelay(n) <= repeatDelay(n - 1));
  assert.equal(repeatDelay(100), 30);
  // Environ 50 achats en 3 s une fois l'anneau plein (contre 33 à 90 ms fixes).
  let t = 0; let n = 0; while (t < 3000) t += repeatDelay(n++);
  assert.ok(n >= 45 && n <= 90, `${n} achats en 3 s`);
});

test('S3 : part des dégâts directs par unité, mesurée dans le combat simulé (compagnon identifié)', () => {
  assert.deepEqual(damageShare({}), []);
  const parts = damageShare({ hero: 30, cat: 10 });
  assert.deepEqual(parts.map((x) => x.id), ['hero', 'cat']);
  assert.equal(parts[0].share, 0.75);
  const s = createNewState(NOW);
  s.maxStage = 20; s.stage = 12; s.level = 40;
  for (const k of Object.keys(s.upgrades)) s.upgrades[k] = 30;
  const solo = measureFarmRate(s, BALANCE, 30);
  assert.deepEqual(solo.damageShare.map((x) => x.id), ['hero']);
  for (const id of ['cat', 'owl']) s.companions.owned[id] = { level: 1, stars: 1 };
  s.companions.equipped = ['cat', 'owl'];
  const rate = measureFarmRate(s, BALANCE, 60);
  const ids = rate.damageShare.map((x) => x.id);
  assert.ok(ids.includes('hero') && ids.includes('cat'), `unités : ${ids}`);
  const sum = rate.damageShare.reduce((a, x) => a + x.share, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9);
  // Affichage : seulement dans Records › Mesurer, libellé « dégâts directs », sans bouton d'achat à côté.
  const html = hero.render(uiWith({ heroTab: 'records', farmRate: rate }), s);
  assert.match(html, /Dégâts directs/);
  const card = html.slice(0, html.indexOf('Records</div>'));
  assert.ok(!/data-action="(buy|upgrade-companion)"/.test(card));
});

test('Classe : armes en icônes (plus de liste de noms), en-tête en une phrase', () => {
  const html = hero.render(uiWith({ heroTab: 'class' }), createNewState(NOW));
  assert.ok(!html.includes('muted class-weapons'), 'plus de liste « Armes : … » écrite');
  assert.match(html, /class="px class-weapon"/);
  assert.ok(!html.includes('sa portée, sa façon de frapper'));
});

test('Améliorations : ligne en 2 lignes, gain neutre, quantité en un bouton (essai)', () => {
  const s = createNewState(NOW);
  s.records.bossesDefeated = 3; s.gold = 1e9;
  const html = upgrades.render(uiWith({ buyAmount: '10' }), s);
  assert.ok(!/rentable/.test(html.replace('Tri : rentabilité', '')));
  assert.match(html, /class="upg-main"/);
  assert.match(html, /Puissance \+/, 'v9.3.8 : un seul gain comparable par ligne');
  assert.equal((html.match(/class="upg-best"/g) ?? []).length, 1, 'une flèche verte : la meilleure affaire');
  assert.equal((html.match(/data-action="buy-amount"/g) ?? []).length, 4, 'rangée ×1 ×10 ×100 Max par défaut');
});

test('v9.3.4 : compétences du héros en deux sections (Attaques en points, Boosts en or), nom et Nv, bulle au toucher', () => {
  const s = createNewState(NOW);
  s.level = 30;
  const cells = skills.skillGridCells(s);
  assert.equal(cells.length, 9);
  assert.equal(cells.filter((c) => c.kind === 's').length, 4);
  const html = skills.default.render(uiWith({ skillSel: 's:quick' }), s);
  assert.ok(html.includes('>Attaques<') && html.includes('>Boosts<'));
  assert.equal((html.match(/class="sk2-cell/g) ?? []).length, 9);
  assert.ok(html.includes('class="sk2-name">Frappe rapide') && /Nv \d/.test(html));
  assert.match(html, /class="sk2-bubble">.*Frappe rapide/s);
  assert.equal((html.match(/btn btn-gold sk2-up/g) ?? []).length, 1, 'un seul gros bouton');
});

test('Talents : outils repliés, plus de « ● » de région ; vue Région en lecture seule', () => {
  const s = createNewState(NOW);
  s.talents.core = 1;
  for (const id of ['combat_1_0', 'combat_2_0', 'combat_2_1']) s.talents[id] = 1;
  const html = tree.default.render(uiWith(), s);
  assert.ok(!html.includes('id="tree-search"'), 'recherche repliée');
  assert.ok(!html.includes('data-action="tree-zoom"'), 'zoom replié');
  assert.ok(!html.includes('● '));
  assert.match(html, /data-value="tree-tools"/);
  const open = tree.default.render(uiWith({}, ['tree-tools']), s);
  assert.ok(open.includes('id="tree-search"') && open.includes('Tout apprendre'));
  const rows = tree.regionRows(s);
  assert.equal(rows.length, 6);
  assert.ok(rows.every((r) => r.keys.length === 2));
  const region = tree.default.render(uiWith({ treeSeg: 'region' }), s);
  assert.match(region, /data-action="region-key"/);
  assert.ok(!/data-action="buy-talent/.test(region), 'aucun achat dans la vue Région');
});

test('Renaissance : 3 cartes, prestige en une ligne (produit des 3 multiplicateurs), gardé/perdu hors du segment', () => {
  const s = createNewState(NOW);
  s.maxStage = 160; s.records.bestStage = 160; s.records.rebirths = 6; s.transcend.count = 1; s.transcend.stars = 40;
  const f = tree.prestigeFactors(s);
  assert.ok(Math.abs(f.rebirth * f.transcend * f.stellar - rebirthMultiplier(s)) / rebirthMultiplier(s) < 1e-9);
  const html = tree.default.render(uiWith({ treeSeg: 'rebirth' }), s);
  assert.equal((html.match(/class="rb-tile"/g) ?? []).length, 3);
  assert.ok(!html.includes('Conservé') && !html.includes('Réinitialisé'), 'listes gardé/perdu seulement dans la confirmation');
  assert.match(html, /Prestige actuel/);
  assert.ok(!html.includes('data-action="buy-perk"'), 'bonus repliés');
  const buttons = (html.match(/<button/g) ?? []).length;
  assert.ok(buttons <= 6, `${buttons} boutons à l'ouverture`);
  const bonus = tree.default.render(uiWith({ treeSeg: 'rebirth' }, ['rebirth-bonus']), s);
  assert.match(bonus, /data-action="buy-perk"/);
  assert.match(bonus, /data-action="buy-tperk"/, 'bonus stellaires dans la même liste');
  assert.match(tree.transcendKeepResetLists(), /Conservé/);
});

test('chantier 3 : nouveaux textes traduits en anglais', async () => {
  const { translate } = await import('../src/i18n/en.js');
  const FRENCH = /[éèàçùêâîôûœ«»]/i;
  const texts = ['Outils', 'Région', 'Dégâts directs', '(part de chacun, soutiens non comptés)', 'Touchez une case pour lire son effet.', 'Utiliser',
    "Touchez une clé de voûte pour la voir dans l'arbre.", 'Bonus éternels et stellaires', 'Prestige actuel', 'dégâts, PV et or', 'pour toujours',
    'pouvoir conservé', "Retour à l'étape 1 ; le détail est dans la confirmation.", "Atteignez l'étape 4-10 pour renaître (max 2-5).",
    'Renaissance ×9,5 × Transcendance ×2,00 × Puissance stellaire ×1,00 =', 'Compétences en grille', 'Quantité en un bouton', 'Actif 12 s',
    "Changement gratuit : l'arme portée devient la meilleure de la classe, ou est reforgée sans perte.", ', toutes les 6 s.', 'filtre actif'];
  assert.deepEqual(texts.filter((t) => FRENCH.test(translate(t))), []);
});
