// v10.3.1 (plan 10.2, partie 7) : le coffre de butin est un objet du SceneRenderer (render/loot-chest.js), plus un bouton
// DOM visible. Taille en multiple entier, position sur le sol derrière les ennemis et à ≥ 40 px des bords, conditions
// d'affichage, bulle, vol de l'objet, couvercle et pièces ; bouton réel invisible pour le clavier et les lecteurs d'écran.
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
const { createNewState } = await import('../src/core/state.js');
const { LOOT_BAG_MAX, lootBagSummary } = await import('../src/core/inventory.js');
const src = (p) => readFileSync(p, 'utf8');

test('1031 → 10.6 : coffre agrandi par un multiple entier, ≈ 112 px sur PC et ≈ 72 px sur téléphone', () => {
  assert.ok(existsSync(C.CHEST_SRC) && existsSync(C.CHEST_OPEN_SRC));
  assert.deepEqual(C.CHEST_NATIVE, { w: 56, h: 55 });
  for (const dpr of [1, 1.25, 1.5, 2, 3]) {
    for (const [tall, want] of [[false, 112], [true, 72]]) {
      const m = C.chestMultiple(C.chestTarget(tall, 600), dpr);
      assert.ok(Number.isInteger(m) && m >= 1, `multiple entier (${m})`);
      const css = (C.CHEST_NATIVE.h * m) / dpr;
      // Le multiple entier le plus proche de la hauteur visée (à un pas près).
      assert.ok(Math.abs(css - want) <= (C.CHEST_NATIVE.h / dpr) / 2 + 1, `${tall ? 'téléphone' : 'PC'} ×${dpr} : ${css} px`);
      assert.ok(css >= C.MIN_HIT, 'assez grand pour un doigt');
    }
  }
  assert.equal(C.chestTarget(false, 900), 112);
  assert.equal(C.chestTarget(true, 900), 72);
});

test('10.6 (partie 1) : le coffre quitte le terrain — place fixe en bas à droite, la même à chaque vague et dans toutes les tailles', () => {
  for (const W of [390, 1116, 1280, 2536]) {
    const cw = W < 560 ? 56 : 112;
    const x = C.dockX(W, cw);
    assert.equal(W - (x + cw), C.DOCK_RIGHT, `${W} px : collé au bord droit`);
    assert.ok(x >= C.MIN_EDGE);
  }
  const code = src('src/render/loot-chest.js');
  assert.match(code, /cssH - DOCK_BOTTOM/, 'pieds au bas de la scène, sous le combat');
  assert.match(code, /chest\.x = dockX\(/, 'plus de place calculée d\'après les ennemis');
  assert.match(code, /- L\.band/, 'rayon arrêté à la bande de combat');
});

test('1031 : conditions d\'affichage du bouton 10.2 (en service et non vide) ; pas de coffre pendant l\'Arène ni la Veillée', () => {
  const s = createNewState(Date.now());
  assert.equal(C.chestShown(s), false, 'vide');
  s.lootBag.push({ id: 'x', rarity: 'rare' });
  assert.equal(C.chestShown(s), true);
  assert.equal(C.chestShown(s, { arenaOpen: true }), false, 'Arène (et Survie) : scène plein écran');
  assert.equal(C.chestShown(s, { sleeping: true }), false, 'Veillée : rendu coupé');
  s.ui.lootBag = false;
  assert.equal(C.chestShown(s), false, 'coffre désactivé');
  assert.equal(C.chestShown(null), false);
});

test('1031 : bulle « Butin ! » la première fois puis à chaque Épique ou mieux ; lueur de la meilleure rareté ; rayon dès l\'Épique', () => {
  assert.equal(C.bubbleFor({ rarity: 'common' }, true), 'Butin ! Touche le coffre pour trier');
  // v10.4 (plan 10.4, partie 5) : la bulle suit la rareté (Rare, Épique, Légendaire), plus seulement l'Épique.
  assert.equal(C.bubbleFor({ rarity: 'common' }, false), null);
  assert.equal(C.bubbleFor({ rarity: 'rare' }, false), 'Butin rare !');
  assert.equal(C.bubbleFor({ rarity: 'epic' }, false), 'Butin épique !');
  for (const r of ['legendary', 'mythic', 'ancestral']) assert.equal(C.bubbleFor({ rarity: r }, false), 'Butin légendaire !');
  const chest = new C.LootChest();
  chest.set({ count: 3, best: 'rare' });
  assert.equal(chest.shown, true);
  assert.equal(chest.epic, false);
  assert.equal(chest.glowColor, C.GLOW.rare);
  chest.set({ count: 4, best: 'epic', upgrade: true });
  assert.equal(chest.epic, true);
  assert.equal(chest.glowColor, C.GLOW.epic);
  chest.set({ count: 0 });
  assert.equal(chest.shown, false);
  chest.set({ count: 2, shown: false });
  assert.equal(chest.shown, false, 'masqué par les conditions d\'affichage');
  const s = createNewState(Date.now());
  s.lootBag = Array.from({ length: LOOT_BAG_MAX }, (_, i) => ({ id: `i${i}`, rarity: 'common', slot: 'weapon', baseId: 'sword', level: 1, affixes: [] }));
  assert.equal(lootBagSummary(s).count, LOOT_BAG_MAX, 'plein = LOOT_BAG_MAX objets');
});

test('1031 : l\'objet vole jusqu\'au coffre (une seule fois), puis le couvercle s\'entrouvre et 3 pièces sautent', () => {
  const chest = new C.LootChest();
  chest.set({ count: 1, best: 'epic' });
  const item = { id: 'e1', rarity: 'epic' };
  assert.equal(chest.catch(item, 120, 60), true, 'la scène lance le vol depuis le monstre');
  chest.bump(item, 50); // l'interface annonce le même objet : pas de second vol
  assert.equal(chest.flies.length, 1);
  chest.bump({ id: 'e2', rarity: 'rare' }, 50); // objet annoncé sans vol (vitesse ×100) : il part de la scène
  assert.equal(chest.flies.length, 2);
  chest.t = 5;
  chest.arrive();
  assert.ok(chest.openUntil > chest.t && chest.openUntil - chest.t <= C.OPEN_TIME + 1e-9);
  assert.equal(chest.coins.length, 3);
  chest.say('Butin !', 2000);
  assert.equal(chest.bubble.text, 'Butin !');
  assert.ok(Math.abs(chest.bubble.until - (chest.t + 2)) < 1e-9, '2 s');
  chest.rect = { x: 10, y: 20, w: 56, h: 55 };
  assert.equal(chest.hit(30, 40), true);
  assert.equal(chest.hit(5, 40), false);
});

test('1031 : SceneRenderer appelle le coffre en quelques lignes (sol, dessus, vol) ; seule la scène principale en a un', () => {
  const scene = src('src/render/scene.js');
  assert.match(scene, /import \{ drawLootChest, drawLootChestTop \} from '\.\/loot-chest\.js'/);
  assert.match(scene, /drawLootChest\(this, ctx, world\);[^\n]*\n\s*this\.drawEnemies\(ctx, world, dt\);/, 'avant les ennemis (ils passent devant)');
  assert.match(scene, /drawLootChestTop\(this, ctx\)/);
  assert.match(scene, /this\.lootChest\?\.catch\(event\.item, x0, at\.y\)/, 'vol depuis le monstre vaincu');
  assert.match(scene, /kind: 'loot', toBag: Boolean\(event\.bagged\)/, 'sans coffre dessiné (autres scènes) : butin habituel');
  const bag = src('src/ui/loot-bag.js');
  assert.match(bag, /r\.lootChest \?\?= new LootChest\(\)/, 'créé par l\'interface sur this.ui.renderer (scène principale)');
  assert.doesNotMatch(bag, /loot_chest\.png|flyIn|lb-coin/, 'plus d\'image ni d\'animation DOM du coffre');
  assert.doesNotMatch(bag.match(/this\.btn\.innerHTML = [^\n]*/)[0], /<img/, 'bouton invisible : pas d\'image (v10.6 : les icônes d\'objets sont dans le volet de tri)');
});

test('1031 : bouton réel invisible (clavier, lecteurs d\'écran, touche B), zone ≥ 44 px, curseur main', () => {
  const bag = src('src/ui/loot-bag.js');
  assert.match(bag, /this\.btn\.id = 'loot-bag'/);
  assert.match(bag, /aria-label', `Coffre de butin : /);
  assert.match(bag, /aria-expanded/);
  const css = src('src/ui/style.css');
  const rule = css.match(/#loot-bag \{[^}]*\}/)[0];
  assert.match(rule, /background: transparent/);
  assert.match(rule, /cursor: pointer/);
  assert.match(rule, /min-width: 44px; min-height: 44px/);
  assert.match(css, /#loot-bag:focus-visible \{ outline/);
  assert.doesNotMatch(css, /\.lb-chest|\.lb-ray|\.lb-spill|lb-fly/, 'anciens styles du coffre DOM retirés');
  assert.match(src('src/ui/shortcuts.js'), /lootBag: 'b'/);
});

test('1031 : libellé accessible du coffre et bulles traduits (anglais, coréen)', async () => {
  const i18n = await import('../src/i18n/i18n.js');
  const want = {
    en: ['Loot chest: 3 items (upgrade)', 'Loot chest: 1 item', 'Loot!', 'Chest full: sort it'],
    ko: ['전리품 상자: 아이템 3개 (강화 가능)', '전리품 상자: 아이템 1개', '전리품!', '상자가 가득 찼어요: 정리하세요'],
  };
  try {
    for (const lang of ['en', 'ko']) {
      i18n.setLang(lang);
      assert.deepEqual(['Coffre de butin : 3 objets (amélioration)', 'Coffre de butin : 1 objet', 'Butin !', 'Coffre plein : trie-le'].map((s) => i18n.t(s)), want[lang]);
    }
  } finally { i18n.setLang('fr'); }
});

test('1031 : plus d\'émoji 🎒 sur les libellés du coffre de butin', () => {
  const ui = src('src/ui/ui.js');
  assert.doesNotMatch(ui, /🎒/);
  assert.match(ui, /lootbag: 'Coffre'/);
  assert.match(ui, /tile\(img\('icon_chest'\), summary\.baggedCount, 'À trier'\)/);
});
