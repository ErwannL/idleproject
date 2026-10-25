import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

// Garde-fou : chaque action appelée par l'interface existe bien dans main.js.
test('toutes les actions de l’interface sont définies', () => {
  const ui = readFileSync(new URL('../src/ui/ui.js', import.meta.url), 'utf8');
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const used = new Set([...ui.matchAll(/\ba\.(\w+)\(/g), ...ui.matchAll(/this\.actions\.(\w+)\(/g)].map((m) => m[1]));
  const block = main.slice(main.indexOf('const actions = {'));
  const defined = new Set([...block.matchAll(/^ {2}(?:async )?(\w+)\(/gm)].map((m) => m[1]));
  const missing = [...used].filter((name) => !defined.has(name));
  assert.deepEqual(missing, []);
});
