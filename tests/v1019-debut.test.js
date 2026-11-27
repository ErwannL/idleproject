// v10.19 (partie 6) : début de partie — bouton doré « Équiper » dans la fiche d'un objet meilleur, conseil « compagnon de Feu »
// seulement si l'on peut invoquer (une fois / 10 min, 2 fois sans effet au plus), menus du bas ouverts un par un avec leur bulle,
// « Nouveau : Gemmes » et « Tout récupérer » après la 1re vague, « Objet dépassé » à 3 étapes de retard et jamais avant 10 min,
// aucune bulle plus de 30 s. Le parcours complet (×10 pendant 10 min) : tools/e2e-1019-debut.mjs.
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
const { createNewState, sanitizeState } = await import('../src/core/state.js');
const { makeItem } = await import('../src/core/loot.js');
const { Rng } = await import('../src/core/rng.js');
const { levelForStage } = await import('../src/core/combat.js');
const G = await import('../src/core/menu-gates.js');
const M = await import('../src/core/mentor.js');
const forge = await import('../src/core/forge.js');
const inv = await import('../src/core/inventory.js');
const tuto = await import('../src/ui/tutorial.js');
const inventoryPanel = (await import('../src/ui/panels/inventory.js')).default;

const fresh = (stage = 1) => {
  const s = createNewState(Date.UTC(2026, 10, 27, 12));
  s.unlocks = { done: [], base: { ...s.records } };
  s.ui.menusOpen = []; // ce que pose main.js pour une partie neuve
  s.maxStage = stage; s.records.bestStage = stage;
  return s;
};

test('6.3 — partie neuve : les 6 menus du bas s\'ouvrent un par un (Héros 3, Objectifs 5, Invocation 7, Aventure 10, Boutique 12, Équipe au 1er compagnon)', () => {
  const s = fresh(1);
  const open = () => ['hero', 'goals', 'summon', 'adventure', 'team', 'shop'].filter((m) => G.menuOpen(s, m));
  assert.deepEqual(open(), [], 'rien au début');
  const seen = [];
  for (let st = 1; st <= 12; st++) {
    s.maxStage = st; s.records.bestStage = st;
    const fresh1 = G.syncMenus(s);
    assert.ok(fresh1.length <= 1, `jamais deux menus d'un coup (étape ${st} : ${fresh1})`);
    seen.push(...fresh1.map((m) => `${m}@${st}`));
  }
  assert.deepEqual(seen, ['hero@3', 'goals@5', 'summon@7', 'adventure@10', 'shop@12']);
  assert.ok(!G.menuOpen(s, 'team'), 'Équipe attend le premier compagnon');
  s.records.summons = 1;
  assert.deepEqual(G.syncMenus(s), ['team']);
  assert.deepEqual(s.ui.menusNew, ['hero', 'goals', 'summon', 'adventure', 'shop', 'team'], 'une bulle « Nouveau » par menu, dans l\'ordre');
  // un menu ouvert le reste (Renaissance : étape remise à 1, record gardé ; même sans record, la liste le garde)
  s.maxStage = 1; s.records.bestStage = 1;
  assert.equal(open().length, 6);
});

test('6.3 — une sauvegarde existante (sans la liste) garde tous ses menus ; la liste d\'une partie neuve survit au chargement', () => {
  const old = sanitizeState(JSON.parse(JSON.stringify({ ...createNewState(Date.UTC(2026, 10, 1)), maxStage: 4, unlocks: { done: ['equipment'], base: {} } })));
  assert.equal(old.ui.menusOpen, undefined);
  for (const m of ['hero', 'goals', 'summon', 'adventure', 'team', 'shop']) assert.ok(G.menuOpen(old, m), `${m} ouvert`);
  assert.deepEqual(G.syncMenus(old), [], 'aucune bulle « Nouveau » pour une ancienne partie');
  const s = fresh(6); G.syncMenus(s);
  const back = sanitizeState(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(back.ui.menusOpen, ['hero', 'goals']);
  assert.ok(!G.menuOpen(back, 'summon'));
  assert.match(readFileSync('src/main.js', 'utf8'), /state\.ui\.menusOpen = \[\]; \}/, 'posée seulement pour une partie neuve (avec les mini-quêtes)');
});

test('6.3 — bulle « Nouveau : <menu> » : le doigt sur le bouton du menu, un menu à la fois, terminée par l\'appui', () => {
  const s = fresh(3); G.syncMenus(s);
  const step = tuto.TUTO_STEPS.find((x) => x.when(s, false));
  assert.equal(step.id, 'menu-hero');
  assert.equal(step.text, 'Nouveau : Héros');
  assert.deepEqual(step.targets, ['#tabs button[data-menu="hero"]']);
  tuto.markDone(s, 'menu-hero');
  assert.deepEqual(s.ui.menusNew, []);
  assert.ok(!tuto.TUTO_STEPS.find((x) => x.menu && x.when(s, false)));
  for (const [k, lang] of [['en', 'New: Hero'], ['ko', '새 메뉴: 영웅']]) assert.ok(readFileSync(`src/i18n/${k}-1019-debut.js`, 'utf8').includes(lang));
});

test('6.1 — fiche d\'un objet du Sac meilleur : bouton doré « Équiper » (même en mode Améliorer), visé par le doigt ; la bulle part une fois équipé', () => {
  const s = createNewState(Date.UTC(2026, 10, 27, 12));
  s.maxStage = 20; s.records.bestStage = 20;
  const better = makeItem(s, 'short_sword', 'legendary', levelForStage(20) + 20, BALANCE, new Rng(3));
  s.inventory.push(better);
  assert.ok(inv.isUpgrade(s, better));
  const phone = (view) => ({ view: { open: new Set(), closed: new Set(), ...view }, tabVisible: {}, root: { classList: { contains: () => true }, clientWidth: 412 } });
  for (const itemTab of ['up', 'reforge', 'equip']) {
    const html = inventoryPanel.render(phone({ selectedItemId: better.id, sheetOpen: 'item', itemTab }), s);
    assert.match(html, /class="m-btn-gold em-better-equip"[^>]*data-action="equip"/, `mode ${itemTab} : bouton doré « Équiper »`);
    assert.equal((html.match(/em-better-equip/g) ?? []).length, 1, `mode ${itemTab} : un seul`);
  }
  const step = tuto.TUTO_STEPS.find((x) => x.id === 'tuto-item');
  assert.equal(step.targets[0], '.em-better-equip', 'le doigt vise d\'abord le bouton doré de la fiche');
  assert.ok(step.when(s, false));
  inv.equipItem(s, better.id);
  s.inventory.push(makeItem(s, 'short_sword', 'legendary', levelForStage(20) + 40, BALANCE, new Rng(4)));
  assert.ok(!step.when(s, false), 'un objet équipé : la bulle « Nouvel objet » ne revient plus');
  const ui = readFileSync('src/ui/ui.js', 'utf8');
  assert.match(ui, /itemPop: best\.item\.id, itemTab: 'equip' \}/, 'le Sceau ouvre la fiche sur « Équiper »');
});

test('6.2 — « Un compagnon de Feu ferait +50 % » seulement si l\'on peut invoquer ; au plus une fois / 10 min ; abandon après 2 affichages', () => {
  const s = fresh(7); s.gems = 0;
  const elem = () => M.mentorTips(s, { element: 'green', wall: true }).find((t) => t.id === 'element');
  assert.equal(G.canSummonNow(s), false);
  assert.equal(elem(), undefined, 'pas de quoi invoquer : pas de conseil');
  s.gems = 10000;
  assert.equal(G.canSummonNow(s), true);
  s.maxStage = 6; s.records.bestStage = 6;
  assert.equal(G.canSummonNow(s), false, 'menu Invocation pas encore ouvert');
  s.maxStage = 7; s.records.bestStage = 7;
  const tip = elem();
  assert.match(tip.text, /ferait \+50 %/);
  const memo = {};
  let t = 0;
  assert.ok(M.mentorTipAllowed(s, tip, memo, t), '1er affichage');
  assert.ok(M.mentorTipAllowed(s, tip, memo, t + 10000), 'toujours le même affichage');
  assert.ok(!M.mentorTipAllowed(s, tip, memo, t + M.SUMMON_TIP_SHOW_MS + 1), 'fini : attend 10 min');
  assert.ok(!M.mentorTipAllowed(s, tip, memo, t + 9 * 60000));
  t += M.SUMMON_TIP_EVERY_MS;
  assert.ok(M.mentorTipAllowed(s, tip, memo, t), '2e affichage 10 min plus tard');
  t += M.SUMMON_TIP_EVERY_MS;
  assert.ok(!M.mentorTipAllowed(s, tip, memo, t), '2 affichages sans effet : abandon');
  assert.ok(!M.mentorTipAllowed(s, tip, memo, t + 3 * M.SUMMON_TIP_EVERY_MS));
  // le Sceau passe au conseil suivant
  const next = M.sealMentorTip(s, memo, t);
  assert.ok(!next || next.id !== 'element' || next.tab !== 'summon');
  // un nouveau compagnon : le conseil a eu son effet, il peut revenir
  s.companions.owned.priestess = { stars: 1, level: 1 };
  assert.ok(M.mentorTipAllowed(s, tip, memo, t + 1));
});

test('6.4 — « Tout récupérer » et « Nouveau : Gemmes » attendent la fin de la 1re vague', () => {
  const s = fresh(1);
  assert.equal(G.firstWaveDone(s), false);
  const claim = tuto.TUTO_STEPS.find((x) => x.id === 'tip-claim');
  assert.equal(claim.when(s, false), false);
  s.maxStage = 2;
  assert.equal(G.firstWaveDone(s), true);
  assert.equal(claim.when(s, false), true);
  assert.match(readFileSync('src/ui/ui.js', 'utf8'), /claims: firstWaveDone\(state\) \? this\.claims : \[\]/, 'le Sceau ne propose aucune récompense avant');
  assert.match(readFileSync('src/ui/learn.js', 'utf8'), /if \(!firstWaveDone\(st\)\) return;/);
});

test('6.5 — un objet tout neuf n\'est jamais « Objet dépassé » : 3 étapes de retard au moins, jamais avant 10 min de jeu', () => {
  const s = createNewState(Date.UTC(2026, 10, 27, 12));
  s.maxStage = 30;
  const at = (stage) => ({ level: levelForStage(stage) });
  s.playSeconds = 3600;
  assert.equal(forge.outdatedLevel(s, at(30)), 0);
  assert.equal(forge.outdatedLevel(s, at(28)), 0, '2 étapes de retard : pas encore');
  assert.equal(forge.outdatedLevel(s, { level: levelForStage(27) }) > 0, levelForStage(27) < levelForStage(28), '3 étapes : dépassé (si le niveau a bougé)');
  assert.ok(forge.outdatedLevel(s, at(10)) > 0);
  s.playSeconds = 599;
  assert.equal(forge.outdatedLevel(s, at(10)), 0, 'jamais pendant les 10 premières minutes');
  assert.match(forge.weakLabel(s, at(10)), /Presque sans effet/);
});

test('6.6 — aucune bulle plus de 30 s : au bout de 25 s d\'affichage (cumulé), l\'étape est terminée', () => {
  assert.ok(tuto.BUBBLE_MAX_MS <= 30000);
  assert.equal(tuto.bubbleExpired('x-test', 0, true), false);
  assert.equal(tuto.bubbleExpired('x-test', 20000, true), false);
  assert.equal(tuto.bubbleExpired('x-test', 21000, false), false, 'cachée : le temps s\'arrête');
  assert.equal(tuto.bubbleExpired('x-test', 60000, true), false);
  assert.equal(tuto.bubbleExpired('x-test', 64000, true), true, '20 + 4 s… puis 25 s atteintes');
  assert.ok(readFileSync('tools/e2e-1019-debut.mjs', 'utf8').includes('MAX_SAME = 20, MAX_BUBBLE_S = 30'));
});
