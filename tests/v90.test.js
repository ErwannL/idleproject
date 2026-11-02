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

test('v9.0 / v9.1.3 : paliers de section de l\'encyclopédie (ancien Codex) atteignables, ancestraux comptés', async () => {
  const { SECTIONS_WITH_MILESTONES, sectionProgress, sectionStatus } = await import('../src/core/encyclopedia.js');
  const s = createNewState(NOW, 4);
  for (const c of SECTIONS_WITH_MILESTONES) {
    const { total } = sectionProgress(s, c.id);
    assert.ok(c.milestones.every((m) => m <= total), `${c.id} : palier > ${total}`);
  }
  s.codex.items.slime_crown = 1;
  const back = sanitizeState(JSON.parse(JSON.stringify(s)));
  assert.equal(back.codex.items.slime_crown, 1);
  s.codex.claimed.items = 5;
  assert.equal(sectionStatus(s, 'items').next, null);
});

test('v9.0.3 : « Exposer tout » expose les objets ancestraux déjà dans le sac et le coffre', async () => {
  const { exposeAll } = await import('../src/core/museum.js');
  const s = createNewState(NOW, 5);
  const a = makeItem(s, 'phoenix_blade', 'epic', 10);
  const b = makeItem(s, 'phoenix_blade', 'legendary', 20);
  const c = makeItem(s, 'void_signet', 'epic', 10);
  c.locked = true;
  s.inventory.push(a, c);
  s.stash.push(b);
  assert.equal(exposeAll(s), 2);
  assert.equal(s.museum.phoenix_blade.id, b.id);
  assert.equal(s.museum.void_signet.id, c.id);
  assert.ok(s.inventory.some((i) => i.id === a.id));
  assert.equal(exposeAll(s), 0);
});

test('v9.0.4 : ennemis mutés — tirage, cuirasse, régénération, vampirisme, dédoublement', async () => {
  const M = await import('../src/core/mutations.js');
  const s = createNewState(NOW, 6);
  const enemy = () => ({ id: 1, hp: 100, maxHp: 100, gold: 10, speed: 20, attackInterval: 1, attackTimer: 0.6, x: 100 });
  const fixed = (...vals) => ({ next: () => vals.shift() ?? 0 });
  s.maxStage = 1;
  assert.equal(M.maybeMutate(s, enemy(), fixed(0, 0)), null, 'pas avant le monde 2');
  s.maxStage = 100;
  assert.equal(M.mutationChance(s), 0.01);
  s.transcend.count = 5;
  assert.ok(Math.abs(M.mutationChance(s) - 0.06) < 1e-9);
  s.transcend.count = 50;
  assert.equal(M.mutationChance(s), 0.15);
  const e = enemy();
  const m = M.maybeMutate(s, e, fixed(0, 0)); // 1er tirage < chance, 2e = première mutation
  assert.equal(m.id, 'split');
  assert.equal(e.maxHp, 160);
  assert.equal(e.gold, 30);
  const kids = M.splitChildren(e, 50);
  assert.equal(kids.length, 2);
  assert.ok(kids.every((k) => !k.mutation && k.splitChild && k.maxHp === 64));
  assert.equal(M.maybeMutate(s, kids[0], fixed(0, 0)), null, 'un double ne mute pas');
  assert.equal(M.maybeMutate(s, { ...enemy(), boss: true }, fixed(0, 0)), null);
  const a = { ...enemy(), mutation: 'armored' };
  assert.equal(M.mutationDamageTaken(a, 10), 5);
  a.hp = 40;
  assert.equal(M.mutationDamageTaken(a, 10), 10);
  const r = { ...enemy(), hp: 50, mutation: 'regen' };
  M.mutationTick(r, 1);
  assert.equal(r.hp, 54);
  const v = { ...enemy(), hp: 50, mutation: 'vampire' };
  M.mutationOnHit(v, 5);
  assert.equal(v.hp, 65);
});

test('v9.0.5 : Encyclopédie — variantes, rareté des objets, paliers, sauvegarde, auras', async () => {
  const E = await import('../src/core/encyclopedia.js');
  const { recordKill, recordItem } = await import('../src/core/codex.js');
  const { auraColors } = await import('../src/data/auras.js');
  const { COMPANIONS } = await import('../src/data/companions.js');
  const s = createNewState(NOW, 5);
  // L'épée de départ est découverte (Commune).
  assert.equal(s.codex.itemRar['short_sword:common'], 1);
  const p0 = E.encyclopediaProgress(s);
  assert.ok(p0.total > 300 && p0.found >= 1);
  recordKill(s, 'slime', { type: 'slime' });
  recordKill(s, 'slime', { type: 'slime', elite: true });
  recordKill(s, 'goblin', { type: 'goblin', mutation: 'regen' });
  assert.ok(E.variantFound(s, 'slime', 'normal') && E.variantFound(s, 'slime', 'elite') && !E.variantFound(s, 'slime', 'mutant'));
  assert.ok(E.variantFound(s, 'goblin', 'mutant'));
  assert.equal(E.sectionProgress(s, 'mutations').found, 1);
  recordItem(s, { baseId: 'slime_crown', rarity: 'legendary' });
  assert.equal(s.codex.itemRar['slime_crown:legendary'], 1);
  // Objets ancestraux : seulement Épique et Légendaire.
  assert.equal(E.itemEntries().filter((e) => e.base.id === 'slime_crown').length, 2);
  // Sauvegarde : tout est conservé, les clés inconnues sont écartées.
  s.codex.itemRar['nope:legendary'] = 1;
  const back = sanitizeState(JSON.parse(JSON.stringify(s)));
  assert.equal(back.codex.elite.slime, 1);
  assert.equal(back.codex.mutants.regen, 1);
  assert.equal(back.codex.mutantOf.goblin, 1);
  assert.equal(back.codex.itemRar['slime_crown:legendary'], 1);
  assert.equal(back.codex.itemRar['nope:legendary'], undefined);
  // Paliers : rien tant que 10 % ne sont pas atteints, puis un seul à la fois.
  assert.equal(E.claimEncyclopedia(s), null);
  for (const e of E.itemEntries()) s.codex.itemRar[`${e.base.id}:${e.rarity}`] = 1;
  const gems = s.gems;
  assert.ok(E.encyclopediaProgress(s).pct >= 50);
  assert.ok(E.claimEncyclopedia(s));
  assert.ok(s.gems > gems);
  assert.equal(s.codex.encClaimed, 1);
  // Auras : 3 couleurs pour un SSR, 2 pour un SR, 1 sinon ; chaque compagnon a les siennes.
  for (const c of COMPANIONS) {
    const n = auraColors(c).length;
    assert.equal(n, c.rarity === 'legendary' ? 3 : c.rarity === 'epic' ? 2 : 1, c.id);
  }
});
