// v10.20 (partie 6) : téléphone : pages qui tiennent, Objectifs repliables, grilles qui défilent dans leur cadre, « Nouvel âge » une fois.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(p, 'utf8');

test('10.20 (6) : telephone1020.css est chargé et toutes ses règles visent le téléphone (#app.m-phone)', () => {
  assert.match(read('index.html'), /src\/ui\/telephone1020\.css/);
  const css = read('src/ui/telephone1020.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const selectors = [...css.matchAll(/([^{}@]+)\{[^{}]*\}/g)].map((m) => m[1].trim()).filter((s) => s && !s.startsWith('@'));
  assert.ok(selectors.length > 10);
  const split = (s) => { const out = []; let d = 0, cur = ''; for (const ch of s) { if (ch === '(') d++; if (ch === ')') d--; if (ch === ',' && !d) { out.push(cur); cur = ''; } else cur += ch; } return [...out, cur]; };
  for (const sel of selectors) for (const one of split(sel)) assert.match(one.trim(), /^#app#app\.m-phone\b/, `règle hors téléphone : ${one.trim()}`);
});

test('10.20 (6.2) : Objectifs en six sections repliables avec pastille, seulement quand la page est étroite', () => {
  const src = read('src/ui/panels/daybook.js');
  assert.match(src, /if \(pageNarrow\(ui\)\) return objectivesFold/);
  for (const t of ['Maintenant', "Aujourd\\\\'hui", 'Carnet', 'Missions', 'Journalières', 'Ça dort']) assert.ok(src.includes(`'${t.replace(/\\\\/g, '\\')}'`), t);
  assert.match(src, /open: id === 'now'/);
  assert.match(src, /obj-pill/);
});

test('10.20 (6.3) : Compagnons et Événement : grille dans un conteneur qui défile, seulement sur téléphone', () => {
  assert.match(read('src/ui/panels/companions.js'), /narrow \? '<div class="mt-scroll">'/);
  assert.match(read('src/ui/panels/event.js'), /pageNarrow\(ui\) \? `\$\{html\.slice\(0, i\)\}<div class="ev-scroll">/);
});

test('10.20 (6.4) : Bastion : une partie sans âge vu retient l\'âge actuel sans fenêtre (téléphone)', () => {
  assert.match(read('src/ui/panels/camp.js'), /if \(PHONE && !Number\.isInteger\(state\.ui\.ageSeen\)\) state\.ui\.ageSeen = age;/);
});

test('10.20 (6.5) : mobile-audit : contrôle 27 (#panel-body ne défile pas de moins de 80 px)', () => {
  const src = read('tools/mobile-audit.mjs');
  assert.match(src, /27: '#panel-body qui défile de moins de 80 px'/);
  assert.match(src, /over > 1 && over < 80/);
});

test('10.20 (6) : textes anglais et coréens branchés', async () => {
  assert.match(read('src/i18n/en.js'), /en-1020-tel\.js/);
  assert.match(read('src/i18n/ko.js'), /ko-1020-tel\.js/);
  const en = await import('../src/i18n/en-1020-tel.js');
  const ko = await import('../src/i18n/ko-1020-tel.js');
  assert.deepEqual(Object.keys(en.EXACT_1020_TEL).sort(), Object.keys(ko.EXACT_1020_TEL).sort());
});
