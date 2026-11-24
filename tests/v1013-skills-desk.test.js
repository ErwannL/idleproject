// v10.13 (lot 4, § 4) : Compétences sur PC — barre de combat à places ordonnées, cartes 3 x 2, détail, un seul bouton doré.
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
const { createNewState } = await import('../src/core/state.js');
const { activeSkills, setLoadoutSlot, toggleLoadout } = await import('../src/core/skills.js');
const skills = (await import('../src/ui/panels/skills.js')).default;

const NOW = 1_700_000_000_000;
const uiWith = (view = {}, phone = false) => ({ view: { open: new Set(), closed: new Set(), ...view }, tabVisible: {}, invalidate: () => {}, root: phone ? { classList: { contains: (c) => c === 'm-phone' } } : null });
const learned = () => { const s = createNewState(NOW); s.level = 60; s.skills = { quick: 2, whirl: 2, cry: 1, holy: 1 }; return s; };
const ids = (s) => activeSkills(s).map((x) => x.id);

test('setLoadoutSlot : place précise, échange, remplacement, ordre = touches 1 2 3', () => {
  const s = learned();
  s.skillLoadout = ['quick', 'whirl'];
  assert.deepEqual(ids(s), ['quick', 'whirl']);
  assert.ok(setLoadoutSlot(s, 'cry', 2)); // place vide : à la suite
  assert.deepEqual(ids(s), ['quick', 'whirl', 'cry']);
  assert.ok(setLoadoutSlot(s, 'cry', 0)); // déjà dans la barre : les deux places s'échangent
  assert.deepEqual(ids(s), ['cry', 'whirl', 'quick']);
  assert.ok(setLoadoutSlot(s, 'holy', 1)); // barre pleine : remplace la place
  assert.deepEqual(ids(s), ['cry', 'holy', 'quick']);
  assert.equal(setLoadoutSlot(s, 'inconnue', 0), false);
  const n = createNewState(NOW); n.skills = {};
  assert.equal(setLoadoutSlot(n, 'quick', 0), false, 'une compétence non apprise ne se place pas');
  assert.ok(toggleLoadout(s, 'holy'));
  assert.deepEqual(ids(s), ['cry', 'quick']);
});

test('Compétences PC : places rondes, cartes, détail, un seul bouton doré, touches Q W E R T', () => {
  const s = learned();
  s.skillLoadout = ['quick', 'whirl'];
  const html = skills.render(uiWith({ skillSel: 's:whirl' }), s);
  assert.match(html, /class="m-frame m-hero m-dsk"/);
  assert.match(html, /class="d-cols3b"/);
  assert.equal((html.match(/class="dsk-slot[ "]/g) ?? []).length, 3, '3 places');
  assert.equal((html.match(/data-slot-drop="/g) ?? []).length, 3);
  assert.match(html, /dsk-slot empty/, 'la 3e place est vide (pointillés)');
  assert.match(html, /2 attaques actives sur 3/);
  assert.equal((html.match(/class="dsk-card /g) ?? []).length, 6);
  assert.match(html, /Active 2/, 'étiquette « Active N » sur la carte posée dans la barre');
  for (const k of ['Q', 'W', 'E', 'R', 'T']) assert.match(html, new RegExp(`${k} · \\d+ s`));
  assert.match(html, /Retirer de la barre \(place 2\)/);
  assert.equal((html.match(/class="m-btn-gold/g) ?? []).length, 1);
  assert.match(html, /Nv \d+<\/span><i>»<\/i><span class="good">Nv \d+/);
  const arm = skills.render(uiWith({ skillSel: 's:cry', skillSlot: 2 }), s);
  assert.match(arm, /Choisis une compétence pour la place 3/);
  assert.match(arm, /data-action="skill-slot-set" data-value="cry\|2"/, 'Mettre dans la barre vise la place armée');
  const boosts = skills.render(uiWith({ mDSkMode: 'r' }), s);
  assert.match(boosts, /Utiliser \(touche Q\)/);
});

test('Compétences : le téléphone garde sa vue (kit 10.12), le PC a sa feuille de style sous #app:not(.m-phone)', () => {
  const s = learned();
  const phone = skills.render(uiWith({}, true), s);
  assert.match(phone, /m-frame m-hero m-sk/);
  assert.ok(!phone.includes('dsk-card'));
  const css = readFileSync('src/ui/desk-skills.css', 'utf8');
  const rules = css.replace(/\/\*[\s\S]*?\*\//g, '').split('{').map((x) => x.split('}').pop().trim()).filter((x) => x.startsWith('#') || x.startsWith('.'));
  assert.ok(rules.length > 20);
  for (const r of rules) for (const sel of r.split(',')) assert.ok(sel.trim().startsWith('#app:not(.m-phone)'), `règle hors #app:not(.m-phone) : ${sel.trim().slice(0, 60)}`);
  assert.match(readFileSync('index.html', 'utf8'), /desk-skills\.css/);
});
