// v10.20 (parties 1 à 3) : PC — grandes pages qui ne défilent pas. Contrôles sans navigateur (la mesure réelle de #panel-body
// est faite par tools/capture-1020-pc.mjs et tools/desk-audit.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('1 : les grandes pages PC reviennent, avec la même vignette pour tous les onglets de Héros et Équipe', async () => {
  const P = await import('../src/ui/page.js');
  assert.equal(P.PC_SIDE_ONLY, false);
  for (const w of [1116, 1280, 1920, 2560]) for (const t of ['inventory', 'upgrades', 'skills', 'tree', 'forge', 'companions']) {
    assert.equal(P.pageActive({ tab: t, layout: 'tall', root: { clientWidth: w }, view: {} }), true, `${t} ${w}`);
  }
});

test('1 : pages1020.css ne touche jamais le téléphone (chaque règle est sous #app…:not(.m-phone)) et est chargée', () => {
  const css = read('src/ui/pages1020.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const selectors = [...css.matchAll(/([^{}@;]+)\{/g)].map((m) => m[1].trim()).filter((s) => s && !/^(@|media|container|from|to|\d)/.test(s) && !s.startsWith('('));
  assert.ok(selectors.length > 50);
  const top = (s) => { const out = []; let d = 0, cur = ''; for (const c of s) { if (c === '(') d++; if (c === ')') d--; if (c === ',' && !d) { out.push(cur); cur = ''; } else cur += c; } return [...out, cur]; };
  for (const sel of selectors) for (const part of top(sel)) assert.match(part, /:not\(\.m-phone\)/, `règle PC seulement : ${part.trim().slice(0, 80)}`);
  assert.match(css, /scrollbar-color: color-mix\(in srgb, var\(--ui-gold, #f2c14e\) 40%, transparent\)/, 'barre des listes : --ui-gold à 40 %');
  assert.match(css, /::-webkit-scrollbar \{ width: 4px;/);
  assert.match(read('index.html'), /src\/ui\/pages1020\.css/);
});

test('2 : Équipement PC — modes sous le nom, tableau de comparaison court, boutons du personnage sur une ligne', () => {
  const js = read('src/ui/panels/equip-desk.js');
  assert.match(js, /<div class="de-modes-top">\$\{modes\}<\/div><div class="de-scroll">/);
  assert.match(js, /class="m-card de-cmp"/);
  assert.match(js, /<div class="de-pcrow">/);
});

test('3 : Améliorations PC — « Tout acheter » dans la carte du haut, infobulle des lignes, textes traduits', async () => {
  const js = read('src/ui/panels/upgrades.js');
  assert.match(js, /data-nodock data-gold-top>\$\{amounts\}\$\{buyAll\}/);
  assert.match(js, /title="\$\{escapeHtml\(tip\)\}"/);
  const [en, ko] = await Promise.all([import('../src/i18n/en.js'), import('../src/i18n/ko.js')]);
  for (const s of ['Équipement rapide ✓', 'Toute l\'équipe ✓', 'Prochain palier : ×1,35 au niveau 4210', 'Aucun point à répartir']) {
    assert.notEqual(en.translate(s), s, `en : ${s}`);
    assert.notEqual(ko.translate(s), s, `ko : ${s}`);
  }
});
