// v10.16 (partie B « Menus et ergonomie ») : ce qui se vérifie sans navigateur — format unique des nombres, pastille « 9+ »,
// navigation (6e onglet « Plus », chaque écran rattaché à un onglet du bas), libellés sans point d'abréviation, migration du
// Panthéon, une seule carte d'objectif, Classement/Guilde sans compte, raison des boutons grisés, bulle du bonus, traductions.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { formatNumber, formatMult, setNumberFormat, getNumberFormat, NUMBER_FORMATS } from '../src/core/format.js';
import { TRANSCEND_PERKS } from '../src/data/transcend.js';
import { MENUS, SUB_LABELS, SUB_SHORT, badgeText, hostMenu, navPath } from '../src/ui/nav.js';
import { sanitizeState, migratePantheon } from '../src/core/state.js';
import { bossesInOrder } from '../src/core/powers.js';
import { oneObjective } from '../src/ui/hud-quests.js';
import { GATE, accountGate, isMember, loadState, LOAD_TIMEOUT_MS } from '../src/ui/account-gate.js';
import { lackText, whyOff } from '../src/ui/common.js';
import { TUTO_STEPS, TIP_AUTO_CLOSE_MS } from '../src/ui/tutorial.js';
import { translate as en } from '../src/i18n/en.js';
import { translate as ko } from '../src/i18n/ko.js';
import { EXACT_1016_MENUS as EN } from '../src/i18n/en-1016-menus.js';
import { EXACT_1016_MENUS as KO } from '../src/i18n/ko-1016-menus.js';

// Les icônes (img) dessinent sur un canevas : un faux document suffit ici (comme tests/v1031-arena.test.js).
const ctx2d = new Proxy({}, { get: (t, k) => (k === 'getImageData' || k === 'createImageData' ? (x, y, w = 1, h = 1) => ({ data: new Uint8ClampedArray(Math.max(1, (w | 0) * (h | 0)) * 4), width: w, height: h }) : k === 'measureText' ? () => ({ width: 1 }) : () => {}) });
globalThis.document ??= { createElement: () => ({ width: 1, height: 1, style: {}, getContext: () => ctx2d, toDataURL: () => 'data:' }) };

const fixture = () => JSON.parse(readFileSync(new URL('./fixtures/endgame.json', import.meta.url), 'utf8'));
// « Amélio. », « Compét. », « Équip. » : un mot (2 lettres au moins) suivi d'un point, en fin de libellé court.
const ABBR = /\p{L}{2,}\.$/u;

test('B4 : un seul format de nombre — lettres jusqu\'à 10³³, puis ×10ⁿ (défaut) ; « tout en lettres » et « tout en ×10ⁿ »', () => {
  assert.equal(getNumberFormat(), 'auto');
  assert.deepEqual(NUMBER_FORMATS, ['auto', 'letters', 'sci']);
  assert.equal(formatNumber(999), '999');
  assert.equal(formatNumber(1234), '1,2 K');
  assert.equal(formatNumber(3.237e20), '323,7 Qi');
  assert.equal(formatNumber(1e33), '1 Dc');
  assert.equal(formatNumber(5.4e89), '5,4×10⁸⁹');
  // Tout en lettres : aa, ab… après Dc.
  assert.equal(formatNumber(1e36, 'letters'), '1 aa');
  assert.equal(formatNumber(2e39, 'letters'), '2 ab');
  assert.equal(formatNumber(3.237e20, 'letters'), '323,7 Qi');
  // Tout en ×10ⁿ : dès 1 000.
  assert.equal(formatNumber(1234, 'sci'), '1,2×10³');
  assert.equal(formatNumber(3.237e20, 'sci'), '3,2×10²⁰');
  assert.equal(formatNumber(999, 'sci'), '999');
  // Réglage global (Paramètres › Interface) : s'applique partout, puis retour au défaut.
  setNumberFormat('sci');
  assert.equal(formatNumber(5e6), '5×10⁶');
  setNumberFormat('nimporte');
  assert.equal(getNumberFormat(), 'auto');
  assert.equal(formatNumber(5e6), '5 M');
});

test('B4 : plus de notation « 1,2e8 » à part (Transcendance, multiplicateurs)', () => {
  assert.equal(formatMult(1.5), '1,5');
  assert.equal(formatMult(2.25), '2,25');
  assert.equal(formatMult(1e40), '1×10⁴⁰');
  assert.equal(formatMult(2500), '2,5 K');
  const stellar = TRANSCEND_PERKS.find((p) => p.id === 'stellar');
  const txt = stellar.text(100); // 1,5^100 ≈ 4×10¹⁷
  assert.doesNotMatch(txt, /\de\d/);
  assert.match(txt, /×\d/);
  for (const file of ['src/data/transcend.js', 'src/ui/ui.js', 'src/core/cheat-codes.js']) {
    assert.doesNotMatch(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'), /toExponential/, file);
  }
});

test('B2 : pastille à chiffre — rien sous 1, « 9+ » au-delà de 9', () => {
  assert.equal(badgeText(0), '');
  assert.equal(badgeText(-3), '');
  assert.equal(badgeText(1), '1');
  assert.equal(badgeText(9), '9');
  assert.equal(badgeText(10), '9+');
  assert.equal(badgeText(29), '9+');
});

test('B2 : 6 onglets du bas, chaque écran rattaché à l\'un d\'eux ; Classement, Guilde, Statistiques, Apparences dans « Plus »', () => {
  assert.equal(MENUS.length, 6);
  assert.ok(MENUS.every((m) => !m.top), 'plus aucun menu seulement dans le tiroir');
  const more = MENUS.find((m) => m.id === 'goals');
  assert.equal(more.label, 'Plus');
  for (const t of ['ranking', 'guild', 'stats', 'looks', 'boss', 'encyclopedia', 'daybook']) assert.ok(more.tabs.includes(t), t);
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const m of MENUS) assert.match(html, new RegExp(`<button data-menu="${m.id}"`), `bouton du bas ${m.id}`);
  assert.match(html, /id="badge-drawer"/);
  // Tous les écrans (sous-onglets, fiche du héros, Paramètres, Missions, Monde) ont un onglet du bas.
  for (const tab of [...Object.keys(SUB_LABELS), 'contracts']) assert.ok(hostMenu(tab), `${tab} sans onglet du bas`);
  assert.equal(hostMenu('hero').id, 'hero');
  assert.equal(hostMenu('options').id, 'goals');
  assert.equal(navPath('contracts'), 'Plus › Objectifs');
  assert.equal(navPath('ranking'), 'Plus › Classement');
});

test('B3 : libellés complets — jamais de point d\'abréviation (Améliorations, Compétences, Équipement)', () => {
  assert.equal(SUB_LABELS.upgrades, 'Améliorations');
  assert.equal(SUB_LABELS.skills, 'Compétences');
  assert.equal(SUB_LABELS.inventory, 'Équipement');
  for (const t of ['upgrades', 'skills', 'inventory', 'companions', 'expeditions', 'encyclopedia', 'summon']) assert.equal(SUB_SHORT[t], undefined, `${t} : forme courte abrégée`);
  const labels = [...MENUS.map((m) => m.label), ...Object.values(SUB_LABELS), ...Object.values(SUB_SHORT)];
  for (const l of labels) assert.doesNotMatch(l, ABBR, l);
  const camp = readFileSync(new URL('../src/ui/panels/camp.js', import.meta.url), 'utf8');
  const short = camp.match(/const SHORT_NAME = \{([\s\S]*?)\};/)[1];
  for (const [, name] of short.matchAll(/'([^']+)'/g)) assert.doesNotMatch(name, ABBR, name);
});

test('B7 : Panthéon — les boss vaincus avant le Panthéon sont comptés (migration depuis records)', () => {
  const raw = fixture();
  assert.equal(raw.records.bossesDefeated, 400);
  assert.deepEqual(raw.powers, {});
  const s = sanitizeState(structuredClone(raw));
  const order = bossesInOrder();
  const known = order.filter((id) => s.powers[id]);
  // Les 11 boss de campagne (étape 480 dépassée) ; le boss de donjon n'est compté que si son donjon a été fini.
  assert.equal(known.length, 11);
  assert.ok(known.every((id) => s.powers[id].victories === 1 && s.powers[id].charges === 0));
  assert.equal(s.gems, sanitizeState(structuredClone({ ...raw, records: { ...raw.records, bossesDefeated: 0 } })).gems, 'aucune gemme donnée');
  // Sauvegarde sans boss vaincu : rien n'est ajouté.
  const fresh = sanitizeState(structuredClone({ ...raw, records: { ...raw.records, bossesDefeated: 0 } }));
  assert.equal(order.filter((id) => fresh.powers[id]).length, 0);
  // Donjon fini : son boss compte aussi. Et la migration ne touche jamais un boss déjà connu.
  const withDg = sanitizeState(structuredClone({ ...raw, dungeonsCleared: { crypt: 2 } }));
  assert.ok(order.filter((id) => withDg.powers[id]).length >= 11);
  const again = structuredClone(s);
  const before = JSON.stringify(again.powers);
  assert.equal(migratePantheon(again, raw), 0);
  assert.equal(JSON.stringify(again.powers), before);
});

test('B1 : une seule carte d\'objectif à la fois sur la scène', () => {
  assert.equal(oneObjective({ bounty: true, path: true, carnet: true }), 'bounty');
  assert.equal(oneObjective({ path: true, carnet: true }), 'path');
  assert.equal(oneObjective({ carnet: true }), 'carnet');
  assert.equal(oneObjective({}), null);
  // L'écran Objectifs : Maintenant, Aujourd'hui, Plus tard, dans cet ordre.
  const src = readFileSync(new URL('../src/ui/panels/daybook.js', import.meta.url), 'utf8');
  const i = ['data-obj="now"', 'data-obj="today"', 'data-obj="later"'].map((k) => src.indexOf(k));
  assert.ok(i.every((x) => x > 0) && i[0] < i[1] && i[1] < i[2]);
});

test('B6 : Classement et Guilde sans compte — explication en 3 lignes, puis « Créer mon compte » ; 5 s au plus de chargement', () => {
  for (const kind of ['ranking', 'guild']) {
    assert.equal(GATE[kind].lines.length, 3);
    const html = accountGate(kind, { loggedIn: true, guest: true, pseudo: 'Invité 12' });
    assert.equal((html.match(/<li>/g) ?? []).length, 3);
    assert.match(html, /data-action="open-account"/);
    assert.match(html, /Créer mon compte/);
    assert.doesNotMatch(html, /se charge/);
  }
  assert.equal(isMember({ loggedIn: true, guest: false }), true);
  assert.equal(isMember({ loggedIn: true, guest: true }), false);
  assert.equal(isMember(undefined), false);
  assert.equal(LOAD_TIMEOUT_MS, 5000);
  assert.equal(loadState({ since: 1000, now: 3000 }), 'loading');
  assert.equal(loadState({ since: 1000, now: 6000 }), 'failed');
  assert.equal(loadState({ since: 1000, now: 9000, hasData: true }), 'ok');
  assert.equal(loadState({ since: 1000, now: 2000, error: 'x' }), 'error');
});

test('B5 : un bouton grisé dit pourquoi, et où en trouver', () => {
  assert.equal(lackText(9, 'ticket', 'tickets'), 'Il te manque 9 tickets');
  assert.equal(lackText(1, 'éclat', 'éclats'), 'Il te manque 1 éclat');
  assert.equal(lackText(23.2, 'éclat', 'éclats'), 'Il te manque 24 éclats');
  const w = whyOff('Il te manque 9 tickets', { tab: 'shop' });
  assert.match(w, /class="why-off"/);
  assert.match(w, /data-action="open-tab" data-value="shop">Où en trouver ›/);
  assert.doesNotMatch(whyOff('Rien à recycler'), /Où en trouver/);
  for (const f of ['summon.js', 'forge.js']) assert.match(readFileSync(new URL(`../src/ui/panels/${f}`, import.meta.url), 'utf8'), /whyOff\(/, f);
});

test('B8 : « Bonus du moment » devient une pastille ; une bulle d\'information se ferme seule après 6 s', () => {
  const tip = TUTO_STEPS.find((s) => s.id === 'tip-boost');
  assert.equal(tip.dot, true);
  assert.equal(TIP_AUTO_CLOSE_MS, 6000);
});

test('Traductions v10.16 : anglais et coréen pour chaque nouveau texte', () => {
  assert.deepEqual(Object.keys(KO).sort(), Object.keys(EN).sort());
  for (const k of Object.keys(EN)) { assert.notEqual(en(k), k, `en : ${k}`); assert.notEqual(ko(k), k, `ko : ${k}`); }
  assert.equal(en('Il te manque 9 tickets pour ×10'), 'You need 9 more tickets for ×10');
  assert.match(ko('Il te manque 23 éclats'), /파편 23/);
  assert.equal(en('Tout récupérer (22)'), 'Claim all (22)');
});

test('B5 : filet commun — raison déduite pour un bouton grisé oublié', async () => {
  const { disabledReason } = await import('../src/ui/why-off.js');
  assert.equal(disabledReason({ why: 'Il te manque 3 clés' }), 'Il te manque 3 clés');
  assert.equal(disabledReason({ title: 'Bientôt' }), 'Bientôt');
  assert.equal(disabledReason({ text: '4,99 €' }), 'Achats pas encore ouverts');
  assert.equal(disabledReason({ text: '8,5×10²²³', cls: 'm-buy ko' }), "Pas assez pour l'acheter");
  assert.equal(disabledReason({ text: 'Tout récupérer' }), "Rien à récupérer pour l'instant");
  assert.equal(disabledReason({ text: 'Repartir' }), "Pas disponible pour l'instant");
});
