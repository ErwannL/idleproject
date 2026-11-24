// v10.12 (lot « équipement ») : Héros › Équipement et fiche « Détails de l'équipement » en kit mobile.
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
const { sanitizeState } = await import('../src/core/state.js');
const { generateItem } = await import('../src/core/loot.js');
const { Rng } = await import('../src/core/rng.js');
const { computeHeroStats } = await import('../src/core/stats.js');
const { levelForStage } = await import('../src/core/combat.js');
const { maxUpgrades } = await import('../src/core/forge.js');
const forge = await import('../src/core/forge.js');
const inv = await import('../src/core/inventory.js');
const gear = await import('../src/core/companion-gear.js');
const { skillKillGold } = await import('../src/core/companions.js');
const equipPhone = await import('../src/ui/panels/equip-phone.js');
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

function blocks(css) {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out = [];
  let depth = 0, start = 0, bodyStart = 0, prelude = '';
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') { if (depth === 0) { prelude = text.slice(start, i).trim(); bodyStart = i + 1; } depth++; }
    else if (text[i] === '}') { depth--; if (depth === 0) { out.push({ prelude, body: text.slice(bodyStart, i) }); start = i + 1; } }
  }
  return out;
}

test('10.12 (équipement) : mobile-equip.css est limité au téléphone et chargé après le kit', () => {
  const css = src('src/ui/mobile-equip.css');
  let n = 0;
  for (const { prelude } of blocks(css)) {
    if (/^@/.test(prelude)) continue;
    for (const sel of prelude.split(',')) { assert.match(sel.trim(), /^#app\.m-phone\b/, `règle hors téléphone : ${sel.trim()}`); n++; }
  }
  assert.ok(n > 80, `beaucoup de règles (${n})`);
  const html = src('index.html');
  assert.ok(html.indexOf('src/ui/mobile-equip.css') > html.indexOf('src/ui/mobile-kit.css') && html.includes('mobile-equip.css'), 'mobile-equip.css après mobile-kit.css');
});

test('10.12 (équipement) : le rendu téléphone est bâti avec le kit (cadre, cartouche, modes, fiche, un seul bouton doré)', () => {
  const js = src('src/ui/panels/equip-phone.js');
  assert.match(js, /class="m-frame em">\$\{mTitle\('icon_gear', 'Équipement', true\)\}/);
  assert.match(js, /mModes\(/);
  assert.match(js, /mSheet\(/);
  assert.match(js, /'Détails de l\\'équipement'/);
  for (const action of ['gear-who', 'eq-slot', 'eq-quick', 'select-item', 'eq-tab', 'item-tab', 'upgrade-item', 'gear-up', 'upgrade-all', 'reforge', 'target-reroll', 'sharpen', 'equip', 'gear-equip', 'lock', 'to-stash', 'to-museum', 'recycle', 'eq-unequip', 'gear-unequip', 'bag-menu', 'filter']) {
    assert.ok(js.includes(`'${action}'`) || js.includes(`"${action}"`), `action ${action} gardée`);
  }
  assert.ok(!/<select/.test(js), 'aucun <select> sur téléphone');
  const inv = src('src/ui/panels/inventory.js');
  assert.match(inv, /if \(phone\) return phoneView\(/);
  assert.match(inv, /isPhoneView\(ui\)\) \{ phoneAfter/);
});

test('10.12 (équipement) : « Tout améliorer » existe dans main.js (boucle plafonnée) et ui.js', () => {
  const main = src('src/main.js');
  assert.match(main, /upgradeAll\(who\)/);
  assert.match(main, /upgradeAllHero\(state, rng\)/);
  assert.match(main, /upgradeAllGear\(state, who/);
  assert.match(src('src/ui/ui.js'), /case 'upgrade-all': a\.upgradeAll\(value\)/);
});

test('Tout améliorer : le résultat reste affiché sous le bouton (le fil est caché sur téléphone)', () => {
  assert.match(src('src/main.js'), /ui\.view\.upAllMsg = \{ who:/);
  assert.match(src('src/ui/panels/equip-phone.js'), /em-note em-done/);
  assert.match(src('src/ui/mobile-equip.css'), /em-done/);
});

// ---------------------------------------------------------------------------------------------------------------------
// « Tout améliorer » : sauvegarde réaliste (sauvegarde de fin de jeu + objets du niveau du héros portés)
// ---------------------------------------------------------------------------------------------------------------------
function realistic({ shards = 400, gold = 1e22 } = {}) {
  const s = sanitizeState(JSON.parse(readFileSync('tests/fixtures/endgame.json', 'utf8')));
  s.maxStage = Math.max(s.maxStage, 139); s.gold = gold; s.materials.shards = shards;
  const rng = new Rng(11);
  const lvl = levelForStage(s.maxStage);
  for (let i = 0; i < 80; i++) s.inventory.push(generateItem(s, rng, { level: lvl - (i % 3), minRarity: 'rare' }));
  for (const it of [...s.inventory]) inv.equipItem(s, it.id);
  gear.equipBestAllGear(s);
  return s;
}
const upLevels = (s) => Object.fromEntries(Object.entries(s.equipment).filter(([, i]) => i).map(([k, i]) => [k, i.upgrades ?? 0]));
const power = (s) => computeHeroStats(s).combatPower;
const total = (o) => Object.values(o).reduce((a, b) => a + b, 0);

test('Tout améliorer (héros) : monte les niveaux, dépense, augmente la Puissance, jamais au-delà du maximum', () => {
  const s = realistic();
  assert.ok(Object.values(s.equipment).filter(Boolean).length >= 4, 'plusieurs objets portés');
  const lv0 = upLevels(s), p0 = power(s), g0 = s.gold, sh0 = s.materials.shards;
  const r = forge.upgradeAllHero(s, null);
  assert.ok(r.n >= 3, `plusieurs renforts (${r.n})`);
  assert.equal(total(upLevels(s)) - total(lv0), r.n, 'un niveau par renfort');
  assert.ok(s.materials.shards < sh0 && s.gold < g0, 'ressources dépensées');
  assert.equal(r.shards, sh0 - s.materials.shards); assert.equal(r.gold, g0 - s.gold);
  assert.ok(power(s) > p0, 'Puissance en hausse'); assert.equal(r.before, p0); assert.equal(r.after, power(s));
  for (const it of Object.values(s.equipment).filter(Boolean)) assert.ok((it.upgrades ?? 0) <= maxUpgrades(it, undefined, s), 'jamais au-delà du maximum');
  assert.ok(s.materials.shards >= 0 && s.gold >= 0);
});

test('Tout améliorer (héros) : s\'arrête quand on ne peut plus payer, jamais de renfort sans effet, jamais une baisse de Puissance', () => {
  const s = realistic({ shards: 9 });
  const r = forge.upgradeAllHero(s, null);
  assert.ok(r.n >= 1 && s.materials.shards >= 0, 'dépense sans passer sous zéro');
  // plus aucun renfort utile payable après coup
  assert.ok(!forge.upgradeRanking(s).some((x) => x.preview.canPay && !x.preview.atMax && forge.gainsPower(x)), 'plus de renfort utile payable');
  assert.match(forge.upgradeAllHeroWhy(s) ?? '', /Il manque \d+ éclats?|maximum|utile/);
  // pas à pas : chaque renfort pris fait monter (ou garde) la Puissance
  const t = realistic({ shards: 5000 });
  let prev = power(t);
  for (let i = 0; i < 40; i++) { const x = forge.upgradeAllHero(t, null, { max: 1 }); if (!x.n) break; const p = power(t); assert.ok(p >= prev, 'jamais pire que ne rien faire'); prev = p; }
  // sans or ni éclats : rien ne bouge et on sait pourquoi
  const z = realistic({ shards: 0, gold: 0 });
  const lv = JSON.stringify(upLevels(z));
  assert.equal(forge.upgradeAllHero(z, null).n, 0);
  assert.equal(JSON.stringify(upLevels(z)), lv);
  assert.match(forge.upgradeAllHeroWhy(z), /Il manque/);
});

test('Tout améliorer (héros) : tout au maximum, ou sans renfort utile → explication courte, jamais muet', () => {
  const s = realistic({ shards: 1e9 });
  for (let i = 0; i < 20 && forge.upgradeAllHero(s, null).n; i++);
  const why = forge.upgradeAllHeroWhy(s);
  assert.ok(why && why.length < 40, `explication (${why})`);
  assert.equal(forge.upgradeAllHero(s, null).n, 0);
  const none = realistic({ shards: 100 }); for (const k of Object.keys(none.equipment)) none.equipment[k] = null;
  assert.equal(forge.upgradeAllHeroWhy(none), 'Rien de porté');
});

test('Tout améliorer : l\'écran grise le bouton avec une ligne d\'explication, et le dégrise sinon', () => {
  const css = src('src/ui/mobile-equip.css');
  assert.match(css, /em-why/);
  const js = src('src/ui/panels/equip-phone.js');
  assert.match(js, /upgradeAllHeroWhy\(state\)/);
  assert.match(js, /upgradeAllGearWhy\(state, unit\.id, kg\)/);
  assert.match(js, /disabled: Boolean\(why\)/);
  assert.match(js, /em-note em-why/);
});

test('Tout améliorer (compagnon) : monte les pièces portées avec les mêmes coûts que « Améliorer », s\'arrête quand c\'est trop cher', () => {
  const s = realistic({ shards: 3000 });
  const kg = skillKillGold(s);
  const id = s.companions.equipped.find((u) => Object.values(gear.unitGear(s, u)).some(Boolean));
  assert.ok(id, 'un compagnon équipé');
  const worn = () => Object.values(gear.unitGear(s, id)).filter(Boolean);
  const lv0 = worn().map((i) => i.upgrades ?? 0), sum = (a) => a.reduce((x, y) => x + y, 0);
  const stats0 = gear.unitGearStats(s, id), sh0 = s.materials.shards, g0 = s.gold;
  const r = gear.upgradeAllGear(s, id, kg);
  assert.ok(r.n >= 1 && sum(worn().map((i) => i.upgrades ?? 0)) - sum(lv0) === r.n);
  assert.equal(r.shards, sh0 - s.materials.shards); assert.equal(r.gold, g0 - s.gold);
  assert.ok(r.shards > 0 || r.gold > 0);
  const st = gear.unitGearStats(s, id);
  assert.ok(Object.keys(st).some((k) => st[k] > stats0[k]), 'bonus du compagnon en hausse');
  for (const it of worn()) assert.ok(!gear.gearUpgradePreview(s, it, kg).atMax || (it.upgrades ?? 0) <= gear.gearUpgradePreview(s, it, kg).max);
  // limite : plus d'éclats → s'arrête, explication
  s.materials.shards = 0;
  assert.equal(gear.upgradeAllGear(s, id, kg).n, 0);
  assert.ok(/Il manque|maximum/.test(gear.upgradeAllGearWhy(s, id, kg) ?? ''));
  // au maximum
  s.materials.shards = 1e12; s.gold = 1e60;
  for (let i = 0; i < 40 && gear.upgradeAllGear(s, id, kg).n; i++);
  assert.equal(gear.upgradeAllGearWhy(s, id, kg), 'Tout est au maximum');
  assert.equal(gear.upgradeAllGear(s, id, kg).n, 0);
});
