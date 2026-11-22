// v10.4 (plan 10.4, partie 5) : coffre de butin vivant en continu et vraie arrivée de l'objet (render/loot-chest.js).
// Flottaison ±4 px sur 1 s, lueur sur 1,5 s, étincelles, couvercle en 6 images PixelLab, bulle selon la rareté,
// Légendaire (flash, saut, cloche), « Réduire les animations », textes en anglais et en coréen.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

globalThis.localStorage ??= { getItem: () => null, setItem: () => {}, removeItem: () => {} };
const ctx2d = new Proxy({}, {
  get: (t, k) => (k === 'getImageData' || k === 'createImageData'
    ? (x, y, w = 1, h = 1) => ({ data: new Uint8ClampedArray(Math.max(1, (w | 0) * (h | 0)) * 4), width: w, height: h })
    : k === 'measureText' ? () => ({ width: 1 }) : k in t ? t[k] : () => {}),
  set: (t, k, v) => { t[k] = v; return true; },
});
globalThis.document ??= { createElement: () => ({ width: 1, height: 1, getContext: () => ctx2d, toDataURL: () => 'data:' }) };

const C = await import('../src/render/loot-chest.js');
const src = (p) => readFileSync(p, 'utf8');

test('1040 : au repos, flottaison de ±4 px sur 1 s, lueur sur 1,5 s, 3 à 5 étincelles', () => {
  assert.equal(C.FLOAT_AMP, 4);
  assert.equal(C.FLOAT_PERIOD, 1);
  assert.equal(C.GLOW_PERIOD, 1.5);
  const ys = [];
  for (let t = 0; t < 2; t += 0.01) ys.push(C.floatOffset(t, false));
  assert.equal(Math.max(...ys), 4);
  assert.equal(Math.min(...ys), -4);
  assert.ok(ys.every(Number.isInteger), 'pixels entiers');
  assert.equal(C.floatOffset(0.25, false), C.floatOffset(1.25, false), 'période de 1 s');
  assert.notEqual(C.floatOffset(0.25, false), C.floatOffset(0.75, false));
  assert.equal(C.glowPulse(0.1, false).toFixed(6), C.glowPulse(0.1 + 1.5, false).toFixed(6), 'période de 1,5 s');
  assert.notEqual(C.glowPulse(0, false), C.glowPulse(0.375, false));
  const chest = new C.LootChest();
  for (const [best, n] of [['common', 3], ['rare', 4], ['epic', 5], ['legendary', 5]]) {
    chest.set({ count: 2, best });
    assert.equal(chest.sparkCount, n, best);
    assert.ok(chest.sparkCount >= 3 && chest.sparkCount <= 5);
  }
});

test('1040 : « Réduire les animations » : plus de flottaison, lueur fixe', () => {
  for (let t = 0; t < 3; t += 0.07) {
    assert.equal(C.floatOffset(t, true), 0);
    assert.equal(C.glowPulse(t, true), 0.8);
  }
});

test('1040 : couvercle : 6 images PixelLab 64 × 64, fermé → grand ouvert → refermé en 0,8 s', () => {
  assert.equal(C.LID_FRAMES, 6);
  for (let i = 0; i < C.LID_FRAMES; i++) {
    const f = C.LID_SRC(i);
    assert.ok(existsSync(f), f);
    const b = readFileSync(f);
    assert.equal(b.readUInt32BE(16), 64, 'largeur');
    assert.equal(b.readUInt32BE(20), 64, 'hauteur');
  }
  assert.equal(C.OPEN_TIME, 0.8);
  assert.equal(C.lidFrame(-1), 0);
  assert.equal(C.lidFrame(0), 0);
  assert.equal(C.lidFrame(0.3), C.LID_FRAMES - 1, 'grand ouvert');
  assert.equal(C.lidFrame(0.5), C.LID_FRAMES - 1, 'tenu');
  assert.equal(C.lidFrame(0.8), 0, 'refermé');
  let prev = 0;
  for (let u = 0; u <= 0.22; u += 0.01) { const f = C.lidFrame(u); assert.ok(f >= prev, 'monte'); prev = f; }
});

test('1040 : bulle selon la rareté : Rare, Épique, Légendaire', () => {
  assert.equal(C.bubbleFor({ rarity: 'common' }, false), null);
  assert.equal(C.bubbleFor({ rarity: 'uncommon' }, false), null);
  assert.equal(C.bubbleFor({ rarity: 'rare' }, false), 'Butin rare !');
  assert.equal(C.bubbleFor({ rarity: 'epic' }, false), 'Butin épique !');
  assert.equal(C.bubbleFor({ rarity: 'legendary' }, false), 'Butin légendaire !');
  assert.equal(C.bubbleFor({ rarity: 'rare' }, true), 'Butin ! Touche le coffre pour trier');
});

test('1040 : l\'arrivée d\'un objet : couvercle, pièces, pastille qui grossit, bulle à l\'arrivée', () => {
  const chest = new C.LootChest();
  chest.set({ count: 2, best: 'rare' });
  chest.t = 10;
  const item = { id: 'r1', rarity: 'rare' };
  chest.catch(item, 100, 50);
  chest.bubbleOnArrival('r1', 'Butin rare !', 2000);
  assert.equal(chest.bubble, null, 'pas encore de bulle : l\'objet vole');
  chest.arrive(item);
  assert.equal(chest.openStart, 10);
  assert.equal(chest.coins.length, 5, 'des pièces jaillissent (5 dès un Rare)');
  assert.equal(chest.popStart, 10);
  assert.equal(chest.bubble.text, 'Butin rare !');
  assert.equal(chest.flashStart < 0, true, 'pas de flash hors Légendaire');
  chest.arrive({ id: 'c1', rarity: 'common' });
  assert.equal(chest.arrivals, 2);
  assert.equal(C.FLY_TIME, 0.8);
});

test('1040 : objet Légendaire : flash doré, grand saut, cloche (une fois)', () => {
  const chest = new C.LootChest();
  const rings = [];
  chest.onLegendary = (it) => rings.push(it.id);
  chest.set({ count: 1, best: 'legendary' });
  chest.t = 3;
  chest.arrive({ id: 'e1', rarity: 'epic' });
  assert.deepEqual(rings, [], 'pas de cloche pour un Épique');
  chest.arrive({ id: 'l1', rarity: 'legendary' });
  assert.deepEqual(rings, ['l1']);
  assert.equal(chest.flashStart, 3);
  assert.equal(chest.hopRise, 7);
  assert.ok(chest.hopUntil - chest.hopStart > 0.4);
  // Une cloche qui échoue ne casse pas l'arrivée.
  chest.onLegendary = () => { throw new Error('pas de son'); };
  assert.doesNotThrow(() => chest.arrive({ id: 'l2', rarity: 'mythic' }));
});

test('1040 : la scène dessine flash et rotation hors « Réduire les animations », mais garde l\'arrivée', () => {
  const code = src('src/render/loot-chest.js');
  assert.match(code, /fp >= 0 && fp < 1 && !calm/, 'flash coupé en mode réduit');
  assert.match(code, /f\.angle = calm \? 0 :/, 'rotation coupée en mode réduit');
  assert.match(code, /if \(!calm\) paintSparks/, 'étincelles coupées en mode réduit');
  assert.match(code, /floatOffset\(chest\.t, r\.focus\)/);
  assert.doesNotMatch(code, /r\.focus \? 1 : Math\.min\(1, f\.age/, 'le vol n\'est plus supprimé en mode réduit');
  assert.doesNotMatch(code, /c\.age > 0\.8 \|\| r\.focus/, 'les pièces restent en mode réduit');
});

test('1040 : cloche synthétisée, au volume et à la sourdine du jeu ; branchée sur le coffre', async () => {
  const { SFX_NAMES, createAudio } = await import('../src/audio/audio.js');
  assert.ok(SFX_NAMES.includes('chestBell'));
  const a = createAudio();
  assert.doesNotThrow(() => a.play('chestBell'));
  assert.match(src('src/audio/audio.js'), /chestBell\(t, o = \{\}\) \{/);
  const bag = src('src/ui/loot-bag.js');
  assert.match(bag, /onLegendary = \(item\) => this\.ui\.sound\?\.play\?\.\('chestBell', \{ rarity: item\?\.rarity \}\)/);
  assert.match(src('src/audio/game-audio.js'), /setMuted\(on\)/, 'sourdine et volume : audio.setMuted / setVolume du jeu');
});

test('1040 : bulles traduites (anglais, coréen) et branchées à la fin de en.js / ko.js', async () => {
  const i18n = await import('../src/i18n/i18n.js');
  const want = {
    en: ['Rare loot!', 'Epic loot!', 'Legendary loot!'],
    ko: ['희귀 전리품!', '영웅 전리품!', '전설 전리품!'],
  };
  try {
    for (const lang of ['en', 'ko']) {
      i18n.setLang(lang);
      assert.deepEqual(['Butin rare !', 'Butin épique !', 'Butin légendaire !'].map((s) => i18n.t(s)), want[lang]);
    }
  } finally { i18n.setLang('fr'); }
  for (const l of ['en', 'ko']) {
    assert.match(src(`src/i18n/${l}.js`), new RegExp(`import \\{ EXACT_1040_CHEST, patterns1040Chest \\} from './${l}-1040-chest\\.js'`));
  }
});

test('1040 : sources et prompts PixelLab conservés, script reproductible', () => {
  assert.ok(existsSync('tools/art/pl104_chest.py'));
  assert.ok(existsSync('tools/art/pixellab104/chest/lid_3/f0.png'));
  assert.ok(existsSync('tools/art/pixellab104/chest/prompt_3.json'));
  const py = src('tools/art/pl104_chest.py');
  assert.match(py, /PIXELLAB_API_KEY/);
  assert.doesNotMatch(py, /pxl_[0-9a-f]{8}/i, 'aucune clé écrite');
});
