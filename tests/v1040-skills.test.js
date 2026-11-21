// v10.4 (partie 3) : chaque compétence a SA vignette animée, son effet et son icône.
//  - morphNode met à jour les attributs d'un canvas (bug : la vignette gardait l'effet de la première compétence) ;
//  - data-vfx de la vignette = effet calculé (data/skill-vfx.js) = effet joué au combat, et il existe au catalogue ;
//  - deux compétences d'une même classe n'ont jamais le même effet ; les Boosts ont les leurs ;
//  - chaque icône existe sur le disque et deux icônes d'une même classe diffèrent nettement, même en niveaux de gris.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

globalThis.localStorage ??= { getItem: () => null, setItem: () => {}, removeItem: () => {} };
const ctx2d = new Proxy({}, {
  get: (t, k) => (k === 'getImageData' || k === 'createImageData'
    ? (x, y, w = 1, h = 1) => ({ data: new Uint8ClampedArray(Math.max(1, (w | 0) * (h | 0)) * 4), width: w, height: h })
    : k === 'measureText' ? () => ({ width: 1 }) : k in t ? t[k] : () => {}),
  set: (t, k, v) => { t[k] = v; return true; },
});
globalThis.document ??= { createElement: () => ({ width: 1, height: 1, getContext: () => ctx2d, toDataURL: () => 'data:' }) };

const { morphNode } = await import('../src/ui/morph.js');
const { createNewState } = await import('../src/core/state.js');
const { SKILLS, applyClassSkillNames } = await import('../src/data/skills.js');
const { RUSHES } = await import('../src/data/rushes.js');
const { RUSH_FX, SKILL_FX_TABLE, heroSkillFx, vignetteFx } = await import('../src/data/skill-vfx.js');
const { VFX } = await import('../src/render/vfx.js');
const { FX_NAMES, HERO_SKILL_MOTIFS } = await import('../src/render/skill-fx.js');
const skillsPanel = (await import('../src/ui/panels/skills.js')).default;
const { skillGridCells, skillFxName, skillVignetteHtml } = await import('../src/ui/panels/skills.js');
const { vignetteHtml } = await import('../src/ui/vignettes.js');

const CLASSES = Object.keys(SKILL_FX_TABLE);
const stateOf = (cls) => { const s = createNewState(); s.level = 80; s.heroClass = cls; applyClassSkillNames(cls); return s; };

// --- morphNode : faux nœuds, sans DOM ------------------------------------------------------------------------------
function node(tag, attrs = {}, kids = []) {
  const n = {
    nodeType: 1, tagName: tag, id: attrs.id ?? '', childNodes: kids, attrs: { ...attrs }, removed: 0,
    get attributes() { return Object.entries(this.attrs).map(([name, value]) => ({ name, value })); },
    getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
    hasAttribute(k) { return k in this.attrs; },
    setAttribute(k, v) { this.attrs[k] = String(v); if (k === 'width' || k === 'height') this.cleared = true; },
    removeAttribute(k) { delete this.attrs[k]; },
    get firstChild() { return this.childNodes[0] ?? null; },
  };
  return n;
}

test('morphNode : un canvas dont data-vfx change reçoit le nouvel attribut (la vignette change d\'effet)', () => {
  const from = node('CANVAS', { class: 'px sk-vignette', width: '160', height: '160', 'data-vfx': 'sk_heavy_cut' });
  const to = node('CANVAS', { class: 'px sk-vignette', width: '160', height: '160', 'data-vfx': 'sk_whirlwind' });
  morphNode(from, to);
  assert.equal(from.getAttribute('data-vfx'), 'sk_whirlwind');
  assert.equal(from.cleared, undefined, 'width/height identiques : le dessin du canvas n\'est pas effacé');
});

test('morphNode : un canvas identique reste intact ; une taille qui change est suivie ; un attribut retiré disparaît', () => {
  const from = node('CANVAS', { class: 'px anim', 'data-anim': 'hero', 'data-scale': '2', width: '64', height: '64' });
  morphNode(from, node('CANVAS', { class: 'px anim', 'data-anim': 'hero', 'data-scale': '2', width: '64', height: '64' }));
  assert.deepEqual(from.attrs, { class: 'px anim', 'data-anim': 'hero', 'data-scale': '2', width: '64', height: '64' });
  assert.equal(from.cleared, undefined);
  morphNode(from, node('CANVAS', { class: 'px anim', 'data-anim': 'pet:fox', width: '96', height: '96' }));
  assert.equal(from.getAttribute('data-anim'), 'pet:fox');
  assert.equal(from.getAttribute('width'), '96');
  assert.equal(from.hasAttribute('data-scale'), false);
});

test('morphNode : les autres éléments se synchronisent toujours (attributs et texte)', () => {
  const from = node('DIV', { class: 'a' }, [{ nodeType: 3, nodeValue: 'x' }]);
  const to = node('DIV', { class: 'b' }, [{ nodeType: 3, nodeValue: 'y' }]);
  morphNode(from, to);
  assert.equal(from.getAttribute('class'), 'b');
  assert.equal(from.childNodes[0].nodeValue, 'y');
});

// --- effets ------------------------------------------------------------------------------------------------------
test('chaque compétence de chaque classe : data-vfx de la fiche = effet calculé = effet du combat, présent au catalogue', () => {
  for (const cls of CLASSES) {
    const st = stateOf(cls);
    const cells = skillGridCells(st).filter((c) => c.kind === 's');
    assert.equal(cells.length, 6, `${cls} : 6 compétences`);
    for (const c of cells) {
      const html = skillsPanel.render({ view: { skillSel: `s:${c.id}` } }, st);
      const sheet = html.slice(html.indexOf('sk2-sheet'));
      const shown = sheet.match(/class="px sk-vignette"[^>]*data-vfx="([^"]+)"/)?.[1];
      const fx = heroSkillFx(c.id, cls);
      assert.ok(fx, `${cls}/${c.id} : effet défini`);
      assert.equal(shown, `sk_${fx}`, `${cls}/${c.id} : vignette`);
      assert.equal(skillFxName(st, c), `sk_${fx}`);
      assert.ok(VFX[`sk_${fx}`], `${cls}/${c.id} : sk_${fx} absent du catalogue`);
      assert.ok(FX_NAMES.includes(fx), `${cls}/${c.id} : ${fx} absent des sorts de combat`);
      assert.match(sheet, /width="160" height="160"/, 'vignette de 160 px');
      assert.match(html, new RegExp(`<canvas class="px sk-vignette sk-mini" width="48" height="48" data-vfx="sk_${fx}"`), 'petite vignette de 48 px sur la case');
    }
  }
});

test('l\'effet de combat des compétences de classe est celui de la table (jamais celui du type)', () => {
  for (const s of SKILLS.filter((x) => x.cls)) assert.equal(HERO_SKILL_MOTIFS[s.id][1], heroSkillFx(s.id, s.cls), s.id);
  // les 4 communes : même identifiant dans toutes les classes, effet par classe (lu par castHeroSkill via scene.skillClass)
  for (const cls of CLASSES) for (const id of ['quick', 'whirl', 'cry', 'holy']) assert.ok(FX_NAMES.includes(heroSkillFx(id, cls)), `${cls}/${id}`);
});

test('deux compétences d\'une même classe n\'ont jamais le même effet, Boosts compris (11 effets différents)', () => {
  const boosts = RUSHES.map((r) => r.id);
  assert.equal(boosts.length, 5);
  for (const cls of CLASSES) {
    const st = stateOf(cls);
    const all = skillGridCells(st).map((c) => skillFxName(st, c));
    assert.equal(all.length, 11, `${cls} : 11 cases`);
    assert.equal(new Set(all).size, 11, `${cls} : effets en double : ${all.join(' ')}`);
    assert.ok(all.every((n) => n !== 'combo_burst' && VFX[n]), `${cls} : aucun repli sur combo_burst`);
  }
  for (const id of boosts) assert.ok(RUSH_FX[id] && VFX[`sk_${RUSH_FX[id]}`], `Boost ${id}`);
  assert.equal(vignetteFx('s', 'inconnue'), 'combo_burst', 'repli seulement pour une compétence inconnue');
});

test('les deux compétences propres à chaque classe ont un effet à elles, différent de celles des autres classes', () => {
  const seen = new Map();
  for (const cls of CLASSES) for (const n of ['1', '2']) {
    const fx = heroSkillFx(`${cls}_${n}`, cls);
    assert.ok(!seen.has(fx), `${cls}_${n} partage ${fx} avec ${seen.get(fx)}`);
    seen.set(fx, `${cls}_${n}`);
  }
  assert.equal(seen.size, 20);
});

test('vignetteHtml : taille, effet nettoyé, petite taille marquée', () => {
  assert.match(vignetteHtml('sk_x"><b>', 160), /data-vfx="sk_xb" /);
  assert.match(vignetteHtml('sk_fury', 48), /sk-mini/);
  const st = stateOf('assassin');
  assert.match(skillVignetteHtml(st, skillGridCells(st)[0]), /width="160"/);
});

test('les vignettes se rangent dans le CSS : 160 px, 48 px au survol, rien en « Réduire les animations »', () => {
  const css = readFileSync('src/ui/skills1040.css', 'utf8');
  assert.match(css, /width: 160px/);
  assert.match(css, /\.sk2-cell:hover \.sk2-ic \.sk-mini/);
  assert.match(css, /\.sk2-cell:active \.sk2-ic \.sk-mini/);
  assert.match(css, /\.reduce-motion \.sk2-ic \.sk-mini \{ display: none !important/);
  assert.match(readFileSync('index.html', 'utf8'), /skills1040\.css/);
});

// --- icônes ------------------------------------------------------------------------------------------------------
function decodePng(path) {
  const buf = readFileSync(path);
  let p = 8, w = 0, h = 0, type = 0; const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), name = buf.toString('latin1', p + 4, p + 8), data = buf.subarray(p + 8, p + 8 + len);
    if (name === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); type = data[9]; assert.equal(data[8], 8); assert.equal(data[12], 0, 'non entrelacé'); }
    if (name === 'IDAT') idat.push(data);
    p += 12 + len;
  }
  const bpp = { 2: 3, 6: 4, 0: 1, 4: 2 }[type]; assert.ok(bpp, `type PNG ${type}`);
  const raw = inflateSync(Buffer.concat(idat)), stride = w * bpp, out = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const v = raw[y * (stride + 1) + 1 + x];
      const a = x >= bpp ? out[y * stride + x - bpp] : 0, b = y ? out[(y - 1) * stride + x] : 0, c = x >= bpp && y ? out[(y - 1) * stride + x - bpp] : 0;
      const pr = f === 0 ? 0 : f === 1 ? a : f === 2 ? b : f === 3 ? (a + b) >> 1 : (() => { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; })();
      out[y * stride + x] = (v + pr) & 255;
    }
  }
  const gray = new Float64Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = out[i * bpp], g = bpp >= 3 ? out[i * bpp + 1] : r, b = bpp >= 3 ? out[i * bpp + 2] : r;
    gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }
  return { w, h, gray };
}

test('chaque icône de compétence référencée existe sur le disque (art104, 40 px) ; les anciennes restent au dépôt', () => {
  for (const cls of CLASSES) {
    applyClassSkillNames(cls);
    for (const s of SKILLS.filter((x) => (x.cls ? x.cls === cls : true))) {
      const path = String(s.icon).replace(/^file:/, '');
      assert.match(path, /^assets\/ui\/art104\/skill_[a-z]+_(quick|whirl|cry|holy|1|2)\.png$/, `${cls}/${s.id}`);
      assert.ok(existsSync(path), `${path} manquant`);
      const { w, h } = decodePng(path);
      assert.deepEqual([w, h], [40, 40], path);
      assert.ok(existsSync(`assets/ui/skills98/${cls}_${s.cls ? s.id.slice(cls.length + 1) : s.id}.png`), `ancienne icône de ${cls}/${s.id} conservée`);
    }
  }
});

test('deux icônes d\'une même classe diffèrent nettement, même en niveaux de gris', () => {
  // Mesure : écart moyen de gris (sur 255) et part des pixels dont le gris change de plus de 40. Les anciennes icônes
  // (assets/ui/skills98/) d'une même classe étaient presque jumelles : même teinte, même forme ; les nouvelles ont un
  // niveau de gris de fond par type d'effet et des silhouettes différentes.
  const MIN_MEAN = 9, MIN_SHARE = 0.08;
  let worst = Infinity, worstShare = Infinity;
  for (const cls of CLASSES) {
    const imgs = ['quick', 'whirl', 'cry', 'holy', '1', '2'].map((id) => ({ id, ...decodePng(`assets/ui/art104/skill_${cls}_${id}.png`) }));
    for (let i = 0; i < imgs.length; i++) for (let j = i + 1; j < imgs.length; j++) {
      let sum = 0, over = 0;
      for (let k = 0; k < imgs[i].gray.length; k++) { const d = Math.abs(imgs[i].gray[k] - imgs[j].gray[k]); sum += d; if (d > 40) over++; }
      const mean = sum / imgs[i].gray.length, share = over / imgs[i].gray.length;
      worst = Math.min(worst, mean); worstShare = Math.min(worstShare, share);
      assert.ok(mean >= MIN_MEAN && share >= MIN_SHARE, `${cls} : ${imgs[i].id} / ${imgs[j].id} trop proches en gris (moyenne ${mean.toFixed(1)}, ${(share * 100).toFixed(0)} % de pixels)`);
    }
  }
  console.log(`icônes d'une classe, le plus proche : écart moyen ${worst.toFixed(1)}, ${(worstShare * 100).toFixed(0)} % de pixels`);
});

test('les 4 types d\'effet ont un fond de niveau de gris différent (coin du fond de l\'icône)', () => {
  const cornerGray = (cls, id) => { const { w, gray } = decodePng(`assets/ui/art104/skill_${cls}_${id}.png`); return gray[6 * w + 6]; };
  // knight : quick = coup unique, whirl = zone, cry = soutien, holy = soin
  const g = ['quick', 'whirl', 'cry', 'holy'].map((id) => cornerGray('knight', id));
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) assert.ok(Math.abs(g[i] - g[j]) >= 15, `types ${i}/${j} : ${g[i].toFixed(0)} / ${g[j].toFixed(0)}`);
});
