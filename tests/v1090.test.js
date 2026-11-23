// v10.9 (docs/prompt-v10.9/PROMPT.md) : tout bien placé et propre — roue, Bastion, livre, écran de jeu, Carnet,
// Améliorations, contrôle du cadrage (tools/audit-109.mjs), tickets d'origine, équipement à la main.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

globalThis.localStorage ??= { getItem: () => null, setItem: () => {}, removeItem: () => {} };
const src = (p) => readFileSync(p, 'utf8');
const { sanitizeState } = await import('../src/core/state.js');
const { BALANCE } = await import('../src/data/balance.js');
const I = await import('../src/core/inventory.js');
const { makeItem } = await import('../src/core/loot.js');
const { Rng } = await import('../src/core/rng.js');
const fixture = () => sanitizeState(JSON.parse(src('tests/fixtures/endgame.json')), BALANCE, Date.now());

test('10.9 (1) : roue — pointe vers le bas sans rotation, icônes contre-tournées pendant le tour', () => {
  const css = src('src/ui/style.css');
  assert.match(css, /\.wh-pointer-img \{[^}]*transform: translateX\(-50%\); z-index: 3;/);
  assert.doesNotMatch(css, /rotate\(168deg\)/);
  assert.match(src('src/ui/ui.js'), /rotate\(calc\(-1 \* var\(--a\) - \$\{target\}deg\)\)/);
});

test('10.9 (2) : une carte par âge, emplacements propres à chacune, 12 dalles, rien hors du cadre', async () => {
  const { PLOTS_BY_AGE } = await import('../src/ui/panels/camp.js');
  for (let a = 1; a <= 5; a++) {
    assert.ok(existsSync(`assets/ui/art109/bastion_map_age${a}.png`));
    const plots = Object.values(PLOTS_BY_AGE[a]);
    assert.equal(plots.length, 12);
    for (const p of plots) assert.ok(p.x - p.w / 2 >= 2 && p.x + p.w / 2 <= 98 && p.y <= 96, JSON.stringify(p));
    const keys = new Set(plots.map((p) => `${p.x}|${p.y}`));
    assert.equal(keys.size, 12, 'une dalle par bâtiment');
  }
  assert.match(src('src/ui/layout109.css'), /\.bs-plot \.bs-tag \{ max-width: var\(--tagw/);
});

test('10.9 (3) : livre — une branche à la fois, 3 médaillons par page, noms courts', async () => {
  const { shortResearchName } = await import('../src/ui/panels/camp.js');
  assert.equal(shortResearchName('Œil du chasseur'), 'Œil');
  assert.equal(shortResearchName('Bourse pleine'), 'Bourse pleine');
  const camp = src('src/ui/panels/camp.js');
  assert.match(camp, /list\.slice\(0, 3\)[\s\S]*list\.slice\(3, 6\)/);
  assert.match(camp, /bastion-branch/);
});

test('10.9 (4) : écran de jeu — une place fixe, coffre toujours visible, Carnet fini en une ligne', () => {
  const ui = src('src/ui/ui.js');
  assert.match(ui, /play\.classList\.add\('band109'\)/);
  assert.match(src('src/ui/loot-bag.js'), /const shown = Boolean\(state && state\.ui\?\.lootBag !== false/);
  const hq = src('src/ui/hud-quests.js');
  assert.match(hq, /id="hq-left"/);
  assert.match(hq, /hq-carnet-done/);
  assert.match(src('index.html'), /layout109\.css/);
});

test('10.9 (5, 6) : Carnet en grille 56 px, Améliorations en 2 colonnes, « Presque sans effet » une seule fois', () => {
  const css = src('src/ui/layout109.css');
  assert.match(css, /\.db-card \{[^}]*grid-template-columns: 56px/);
  assert.match(css, /@media \(max-width: 1399px\)[\s\S]*repeat\(2, minmax\(0, 1fr\)\)/);
  const up = src('src/ui/panels/upgrades.js');
  assert.doesNotMatch(up, /upg-weak-why/);
  assert.match(up, /peu utile/);
});

test('10.9 (7) : contrôle automatique du cadrage', () => {
  const a = src('tools/audit-109.mjs');
  for (const k of ['image-dépasse', 'texte-couvert', 'texte-coupé', 'étiquettes-chevauchées', 'coffre-absent', 'docs/screenshots/v10.9']) assert.ok(a.includes(k), k);
});

test('10.9 (7 bis) : tickets de compagnon et lots de familiers d\'origine (commit 9d4eb7b4)', () => {
  const want = { 'hero_ticket_limited': 'fa0d67ea4ce0d944', 'hero_ticket_limited_s': '35fac770196311cc', 'hero_ticket_permanent': 'c8e5cbae88b856f0', 'hero_ticket_permanent_s': '1025a813b2694626', 'pet_pack_discovery': 'c0c6917c9939d0a3', 'pet_pack_discovery_s': '2c2595da875652a9', 'pet_pack_small': 'ffae8f69db617035', 'pet_pack_small_s': '466062a4e399e4ad', 'pet_pack_medium': '6c8b8dff2bb2ac33', 'pet_pack_medium_s': '35fca7f4b1aa77fb', 'pet_pack_large': 'a9bb183c3f15baf7', 'pet_pack_large_s': 'cb88c6ffc28aa842', 'pet_pack_premium': 'cd71799cf413ff6c', 'pet_pack_premium_s': '55079f8472e79161',  };
  for (const [f, h] of Object.entries(want)) assert.equal(createHash('sha256').update(readFileSync(`assets/ui/shop/${f}.png`)).digest('hex').slice(0, 16), h, f);
});

test('10.9 (7 ter) : rien n\'est équipé sans un appui du joueur', () => {
  const s = fixture();
  const lvl = Math.max(...Object.values(s.equipment).filter(Boolean).map((i) => i.level)) + 50;
  s.inventory.push(makeItem(s, 'short_sword', 'legendary', lvl, BALANCE, new Rng(5)));
  assert.ok(I.betterItems(s).length >= 1, 'un objet meilleur attend');
  const main = src('src/main.js');
  assert.match(main, /const equipped = state\.ui\.autoEquip === true \? equipBest\(state\) : 0;/);
  const ui = src('src/ui/ui.js');
  assert.match(ui, /n\.action === 'equip-best'\) \{ this\.userAt = performance\.now\(\); this\.openBetterItem\(\); return; \}/);
  assert.doesNotMatch(ui, /else if \(n\.action === 'equip-best'\) this\.actions\.equipBest\(\);/);
  assert.match(src('index.html'), /id="better-hero"/);
  assert.match(src('src/ui/panels/options.js'), /data-action="auto-equip"/);
  assert.equal(s.ui.autoEquip, undefined, 'désactivé par défaut');
  assert.match(src('src/core/inventory.js'), /choices\[item\.id\] = s === 'bag'/, 'le tri du coffre range, il n\'équipe pas');
});
