// v10.4 (partie 7, « Petits défauts relevés » du plan docs/plan-v1040.md) : libellés du Sceau en mots du joueur,
// bulles de ressource gardées jusqu'à l'écran où elles servent, noms de cartes jamais coupés, illustrations.
// (Aucun test ne coupe un fichier source par lignes : la CI Windows lit des fins de ligne CRLF.)
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

globalThis.localStorage ??= { getItem: () => null, setItem: () => {}, removeItem: () => {} };
const ctx2d = new Proxy({}, {
  get: (t, k) => (k === 'getImageData' || k === 'createImageData'
    ? (x, y, w = 1, h = 1) => ({ data: new Uint8ClampedArray(Math.max(1, (w | 0) * (h | 0)) * 4), width: w, height: h })
    : k === 'measureText' ? () => ({ width: 1 }) : k in t ? t[k] : () => {}),
  set: (t, k, v) => { t[k] = v; return true; },
});
globalThis.document ??= { createElement: () => ({ width: 1, height: 1, getContext: () => ctx2d, toDataURL: () => 'data:' }) };

const { sanitizeState } = await import('../src/core/state.js');
const { claimables } = await import('../src/core/claimables.js');
const { RESOURCE_SYSTEM, resourceScreenOpen, firstResourceBubble } = await import('../src/ui/learn.js');
const { RESOURCES } = await import('../src/data/glossary.js');
const { UNLOCK_IDS } = await import('../src/core/unlock-quests.js');
const en = await import('../src/i18n/en.js');
const ko = await import('../src/i18n/ko.js');

const fin = () => sanitizeState(JSON.parse(readFileSync('tests/fixtures/endgame.json', 'utf8')));
const text = (p) => readFileSync(p, 'utf8');
const JARGON = /Exploit|Haut fait|Trouvaille|Contrat|Chronique|Palier|palier|Collections :|Mutation|Résonance|Synergie|Ascension/;

test('3 — Sceau : aucun libellé « À récupérer » ne garde de jargon (Exploit, Collections, palier)', () => {
  const s = fin();
  s.codex ??= { claimed: {}, encClaimed: 0 };
  s.codex.claimed = {}; s.codex.encClaimed = 0;
  const labels = claimables(s).map((c) => c.label);
  assert.ok(labels.some((l) => /^\d+ [^ ].* découverts$/.test(l)), `une récompense de collection attendue : ${labels.join(' | ')}`);
  for (const l of labels) assert.ok(!JARGON.test(l), `jargon dans « ${l} »`);
  const src = text('src/core/claimables.js');
  for (const bad of ['Exploit réussi', 'Collections : palier', 'Collections : ${', 'Piste du mois : palier']) assert.ok(!src.includes(bad), bad);
});

test('3 — Sceau : un succès prêt s\'appelle « Succès débloqué : … » et une récompense de collection « N équipements découverts »', () => {
  const src = text('src/core/claimables.js');
  assert.ok(src.includes('Succès débloqué : ${a.name}'));
  assert.ok(src.includes('Collection remplie à'));
  assert.ok(src.includes("${st.next} ${c.label.toLowerCase()} découverts"));
  assert.ok(/ENCYCLOPEDIA_SECTIONS/.test(text('src/core/encyclopedia.js')));
});

test('3 — Sceau : traduit en anglais et en coréen', () => {
  assert.match(en.translate('Succès débloqué : Premier sang'), /^Achievement unlocked: /);
  assert.equal(en.translate('10 équipements découverts'), '10 items discovered');
  assert.equal(en.translate('Collection remplie à 25 %'), 'Collection 25 % complete');
  assert.match(ko.translate('Succès débloqué : Premier sang'), /^업적 달성: /);
  assert.equal(ko.translate('10 équipements découverts'), '장비 10개 발견');
  assert.equal(ko.translate('Collection remplie à 25 %'), '컬렉션 25% 달성');
});

test('4 — chaque bulle de ressource nomme un système réel et attend son ouverture', () => {
  for (const [k, id] of Object.entries(RESOURCE_SYSTEM)) { assert.ok(RESOURCES[k], k); assert.ok(UNLOCK_IDS.includes(id), `${k} → ${id}`); }
  for (const k of Object.keys(RESOURCES)) if (k !== 'gold') assert.ok(RESOURCE_SYSTEM[k], `ressource sans écran : ${k}`);
  const young = (done) => { const s = sanitizeState({}); s.unlocks = { done, base: {} }; return s; };
  // Donjons : fermés (la quête « Invocation » est en cours) → pas de bulle des clés ; la quête des donjons en cours les ouvre.
  assert.equal(resourceScreenOpen(young(['equipment', 'upgrades', 'skills', 'companion', 'forge']), 'keys'), false);
  assert.equal(resourceScreenOpen(young(['equipment', 'upgrades', 'skills', 'companion', 'forge', 'summon']), 'keys'), true);
  assert.equal(resourceScreenOpen(young([]), 'shards'), false);
  assert.equal(resourceScreenOpen(young(['equipment', 'upgrades', 'skills', 'companion']), 'shards'), true); // la Forge est la quête en cours
  assert.equal(resourceScreenOpen(young(['equipment', 'upgrades', 'skills', 'companion', 'forge']), 'gems'), true); // Invocation en cours
  const old = sanitizeState({}); old.unlocks = { legacy: true, done: [], base: {} };
  for (const k of Object.keys(RESOURCES)) assert.equal(resourceScreenOpen(old, k), true);
});

test('4 — « Nouveau : Clés de donjon » reste en attente jusqu\'à l\'ouverture des donjons, puis arrive une seule fois', () => {
  const made = [];
  const saved = globalThis.document;
  globalThis.document = {
    querySelector: () => null,
    createElement: () => { const e = { className: '', dataset: {}, innerHTML: '', addEventListener() {}, remove() {} }; made.push(e); return e; },
    body: { appendChild() {} },
  };
  try {
    const ui = { $: () => ({ appendChild() {} }), glossCard() {} };
    const s = sanitizeState({});
    s.unlocks = { done: ['equipment', 'upgrades', 'skills', 'companion', 'forge'], base: {} };
    s.keys = 3;
    firstResourceBubble(ui, s);
    assert.ok(!made.some((e) => /Clés de donjon/.test(e.innerHTML)), 'pas de bulle avant les donjons');
    assert.ok(!(s.ui.seenRes ?? []).includes('keys'), 'la bulle n\'est pas consommée : elle attend');
    s.unlocks.done.push('summon'); // la quête des donjons devient la quête en cours : l'écran s'ouvre
    firstResourceBubble(ui, s);
    assert.ok(made.some((e) => /Nouveau : Clés de donjon/.test(e.innerHTML)), 'bulle après l\'ouverture');
    const n = made.length;
    firstResourceBubble(ui, s);
    assert.equal(made.length, n, 'une seule fois');
  } finally { globalThis.document = saved; }
});

test('1 — noms de cartes : deux lignes au lieu d\'une coupure (Paladin d\'azur)', () => {
  const css = text('src/ui/defauts1040.css');
  assert.match(css, /\.pcard \.pc-top b/);
  assert.match(css, /-webkit-line-clamp:\s*2/);
  assert.ok(text('index.html').includes('defauts1040.css'));
});

test('2 — illustrations PixelLab de la partie 7 : fichiers présents, script et prompts rangés', () => {
  assert.ok(existsSync('tools/art/pl104_screens.py'));
  assert.ok(existsSync('tools/art/pixellab104/screens/prompts.json'));
  // Le dossier art104 est partagé (compétences, coffre, donjons, Bastion…) : on ne contrôle ici que les images de la partie 7.
  const files = readdirSync('assets/ui/art104').filter((f) => /^(upgrades|missions|shop|summon|stats)_.*\.png$/.test(f));
  assert.ok(files.length >= 5, `${files.length} images`);
  for (const f of files) assert.match(f, /^[A-Za-z0-9_]+\.png$/, f);
  const prompts = JSON.parse(text('tools/art/pixellab104/screens/prompts.json'));
  assert.ok(Object.keys(prompts).length <= 60, 'budget de 60 générations');
  const src = text('src/ui/ui.js') + text('src/ui/panels/upgrades.js') + text('src/ui/panels/shop.js') + text('src/ui/panels/summon.js') + text('src/ui/panels/contracts.js') + text('src/ui/panels/stats.js') + text('src/ui/defauts1040.css');
  // Les noms sont composés dans le code (« shop_cat_${catégorie} ») : on cherche le nom entier, ou son préfixe.
  for (const f of files) assert.ok(src.includes(f) || src.includes(f.replace(/[^_]+\.png$/, '')), `${f} n'est utilisée nulle part`);
  const art = text('src/ui/panels/upgrades.js');
  assert.ok(art.includes('art104/upgrades_hero_tier'));
});

test('2 — seuil de check_screens relevé à 20 % pour les 5 onglets', () => {
  const t = text('tools/art/check_screens.mjs');
  // v10.4 : d'autres onglets peuvent s'ajouter à la liste (la Forge en page) ; les 5 restent dedans.
  assert.match(t, /\['upgrades', 'contracts', 'stats', 'shop', 'summon'(, '[a-z]+')*\]\.includes\(t\) \? 0\.2/);
});
