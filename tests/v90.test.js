import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewState, sanitizeState } from '../src/core/state.js';
import { BALANCE } from '../src/data/balance.js';
import { makeItem } from '../src/core/loot.js';
import { collectItem } from '../src/core/inventory.js';
import { collectBonuses } from '../src/core/bonuses.js';
import { MUSEUM_PIECES, museumCount, museumEffects, putInMuseum, takeFromMuseum } from '../src/core/museum.js';
import { THEMES, colorFamily, transformRgb } from '../src/ui/themes.js';

const NOW = Date.UTC(2026, 9, 28, 12);

test('v9.0 : le Musée expose un objet ancestral par vitrine et donne un bonus permanent', () => {
  const s = createNewState(NOW, 3);
  const crown = makeItem(s, 'slime_crown', 'epic', 10);
  s.inventory.push(crown);
  assert.equal(putInMuseum(s, crown.id), true);
  assert.equal(museumCount(s), 1);
  assert.equal(s.inventory.length, 0);
  assert.deepEqual(museumEffects(s), { damageMultPct: 5, maxHpMultPct: 5, goldMultPct: 5 });
  assert.equal(collectBonuses(s).damageMultPct >= 5, true);
  // Un objet ordinaire ne va pas au Musée.
  const sword = makeItem(s, 'short_sword', 'epic', 10);
  s.inventory.push(sword);
  assert.equal(putInMuseum(s, sword.id), false);
  // Ramassage : un exemplaire Légendaire meilleur remplace l'Épique (qui retourne au sac), bonus doublé.
  const better = makeItem(s, 'slime_crown', 'legendary', 30);
  const r = collectItem(s, better);
  assert.equal(r.museum, true);
  assert.equal(s.museum.slime_crown.id, better.id);
  assert.ok(s.inventory.some((i) => i.id === crown.id));
  assert.equal(museumEffects(s).damageMultPct, 10);
  // Sauvegarde / chargement.
  const loaded = sanitizeState(JSON.parse(JSON.stringify(s)));
  assert.equal(loaded.museum.slime_crown.id, better.id);
  assert.equal(takeFromMuseum(loaded, 'slime_crown'), true);
  assert.equal(museumCount(loaded), 0);
  // Collection complète : bonus final.
  for (const id of MUSEUM_PIECES) s.museum[id] = makeItem(s, id, 'epic', 10);
  assert.equal(museumEffects(s).damageMultPct, 5 * MUSEUM_PIECES.length + 25);
  assert.ok(BALANCE);
});

test('v9.0 : 10 thèmes d\'interface ; « Chevalier » ne change rien, les autres recolorent', () => {
  assert.equal(THEMES.length, 10);
  assert.equal(new Set(THEMES.map((t) => t.id)).size, 10);
  assert.equal(THEMES[0].id, 'knight');
  assert.equal(colorFamily(0x12, 0x1d, 0x33), 'dark');
  assert.equal(colorFamily(0xe8, 0xb6, 0x4a), 'accent');
  assert.equal(colorFamily(0x80, 0x80, 0x80), null);
  assert.equal(transformRgb(THEMES[0], 0x12, 0x1d, 0x33), null);
  for (const t of THEMES.slice(1)) {
    const out = transformRgb(t, 0x12, 0x1d, 0x33);
    assert.ok(out && out.every((v) => Number.isInteger(v) && v >= 0 && v <= 255), t.id);
  }
});
