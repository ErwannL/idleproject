// v10.12 (lot Invocation / Boutique) : version téléphone dans le kit, style limité à #app.m-phone.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('10.12 (boutique) : mobile-shop.css ne contient que des règles #app.m-phone, chargé après le kit', () => {
  const css = src('src/ui/mobile-shop.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const sels = [...css.matchAll(/(^|\})\s*([^{}]+)\{/g)].map((m) => m[2].trim());
  assert.ok(sels.length > 30);
  for (const s of sels) for (const one of s.split(',')) assert.match(one.trim(), /^#app\.m-phone\b/, one.trim());
  const html = src('index.html');
  assert.ok(html.indexOf('src/ui/mobile-shop.css') > html.indexOf('src/ui/mobile-kit.css'));
});

test('10.12 (invocation, boutique) : le rendu téléphone passe par le kit (cadre, cartouche, onglets) et garde les data-action', () => {
  const sum = src('src/ui/panels/summon.js');
  const shop = src('src/ui/panels/shop.js');
  for (const s of [sum, shop]) { assert.match(s, /m-phone/); assert.match(s, /mTitle\(/); assert.match(s, /m-frame/); }
  assert.match(sum, /mTabs\(/);
  for (const a of ['summon', 'summon-odds', 'wish-toggle', 'use-fragment']) assert.ok(sum.includes(`data-action="${a}"`), a);
  assert.ok(sum.includes("action: 'summon-pool'"));
  for (const a of ['shop-cat', 'buy-offer', 'theme-preview', 'look-preview']) assert.ok(shop.includes(`data-action="${a}"`), a);
  assert.match(shop, /class="m-tabs"/);
  assert.match(shop, /m-offers/);
});
