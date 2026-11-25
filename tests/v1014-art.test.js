import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { FEST_MONTHS, festMonth } from '../src/data/fest.js';

const exists = (p) => existsSync(new URL(`../${p}`, import.meta.url));

test('v10.14.1 : chaque image de FEST_MONTHS existe dans assets/', () => {
  let n = 0;
  for (const mo of FEST_MONTHS) {
    for (const kind of ['grand', 'light']) {
      const art = mo[kind].art;
      assert.ok(art, `${mo.month} ${kind} : art manquant`);
      const need = kind === 'grand' ? ['key', 'arena', 'currency'] : ['key', 'path', 'node', 'nodeDone', 'currency'];
      for (const k of need) assert.ok(art[k], `${mo.month} ${kind}.${k}`);
      if (kind === 'grand') assert.equal(art.regions.length, 3);
      for (const p of [...need.map((k) => art[k]), ...(art.regions ?? [])]) {
        assert.ok(p.startsWith('assets/ui/art1014/'), p);
        assert.ok(exists(p), `fichier absent : ${p}`);
        n++;
      }
    }
  }
  assert.equal(n, 6 * 6 + 6 * 5);
});

test('v10.14.1 : icônes fixes de l\'écran de la fête présentes', () => {
  const src = readFileSync(new URL('../src/ui/fest-hub.js', import.meta.url), 'utf8');
  const files = new Set([...src.matchAll(/\$\{A1014\}([\w.-]+\.png)/g)].map((m) => m[1]));
  assert.ok(files.size >= 6);
  for (const f of files) assert.ok(exists(`assets/ui/art1014/${f}`), f);
  assert.ok(exists('assets/ui/art1014/hud_event_fest.png'));
  for (const id of ['strength', 'fury', 'time', 'loot', 'heart', 'focus']) assert.ok(exists(`assets/ui/art1014/rift_bless_${id}.png`), id);
  for (const id of ['boss', 'chest', 'crown']) assert.ok(exists(`assets/ui/art1014/fest_node_${id}.png`), id);
});

test('v10.14.1 : les mois de la rotation automatique gardent le repli (pas d\'art)', () => {
  const auto = festMonth(6);
  assert.equal(auto.handWritten, false);
  assert.equal(auto.grand.art, undefined);
  assert.equal(auto.light.art, undefined);
  assert.ok(festMonth(0).grand.art.key.endsWith('2027-02-g_key.png'));
});
