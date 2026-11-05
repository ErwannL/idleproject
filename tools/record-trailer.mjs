// Bande-annonce du site : le VRAI jeu (build web) filmé dans Chromium (Playwright), à 60 i/s réels.
//   npm run build:web, serveur du jeu lancé (PORT=8799 GAME_WEB=1 node server/index.mjs), puis
//   node tools/record-trailer.mjs --save save.json [--url http://localhost:8799/play/]
// save.json : { "clé localStorage": "valeur" } d'une partie de milieu de jeu (comme tools/smoke.mjs).
// v9.2.4 : remplace l'ancienne mise en scène à part (tools/trailer.html, supprimée), qui dessinait le chevalier avec
// les anciens PNG v6 hero_walk*/hero_attack* : ceux-ci n'ont que le CORPS (tête et casque étaient posés à part par le
// jeu), d'où un héros sans tête dans la vidéo.
// Horloge virtuelle : performance.now, Date.now, requestAnimationFrame, setTimeout/setInterval et animations CSS
// avancent de 1/60 s exactement par image : aucune saccade, quelle que soit la vitesse de la machine.
// Chaque image : contrôle de la tête du héros (les images du héros sont copiées à part pendant renderer.drawHero) ;
// un héros sans tête arrête l'enregistrement. Sorties : site/assets/trailer.webm (VP9, 2 passes), trailer-poster.jpg.
import { spawn } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const URL_ = arg('--url', 'http://localhost:8799/play/');
const SAVE = JSON.parse(readFileSync(arg('--save', `${ROOT}tools/trailer-save.json`), 'utf8'));
const FRAMES = arg('--frames', `${tmpdir()}/trailer-frames`);
const FPS = 60, SEG = Number(process.env.SEG || 4.2), PREROLL = 3.5;          // 8 moments de 4,2 s = 33,6 s
const VIEW = { width: 1366, height: 768 };          // barre de navigation (86 px) et barre du bas hors cadre
const CLIP = { x: 86, y: 0, width: 1280, height: 720 };
const POSTER = 150;                                 // affiche : plaines, chevalier équipé, équipe, ennemi

// Moments de partie : étape (monde, boss), héros (apparence, classe, arme, casque, armure), équipe, invocation.
const KNIGHT = { hero: 'knight', cls: 'knight', gear: ['greatsword', 'horned_helm', 'plate_armor'] };
const MOMENTS = [
  { stage: 3, ...KNIGHT, team: ['squire', 'elf_archer', 'golden_slime'], dmg: 30 },
  { stage: 25, ...KNIGHT, team: ['ranger', 'sylvan_guardian', 'fairy'], dmg: 60 },
  { stage: 65, hero: 'valkyrie', cls: 'lancer', gear: ['halberd'], team: ['lancer', 'priestess', 'cat'], dmg: 90 },
  { stage: 85, ...KNIGHT, gear: ['war_hammer', 'iron_helm', 'chainmail'], cls: 'paladin', team: ['azure_paladin', 'dwarf', 'owl'], dmg: 120, summon: 1.2 },
  { stage: 125, hero: 'witch', cls: 'stormcaller', gear: ['storm_scepter'], team: ['witch', 'rose_blade', 'wisp'], dmg: 160 },
  { stage: 145, hero: 'seraph', cls: 'knight', gear: ['greatsword'], team: ['archangel', 'high_priest', 'fairy'], dmg: 200 },
  { stage: 165, ...KNIGHT, gear: ['battle_axe', 'horned_helm', 'plate_armor'], cls: 'berserker', team: ['pyromancer', 'barbarian', 'golem'], dmg: 240 },
  { stage: 185, hero: 'demoness', cls: 'necromancer', gear: ['soul_reaper'], team: ['shadow_lord', 'demon_queen', 'wisp'], dmg: 300 },
];

function ffmpeg(args) {
  return new Promise((ok, ko) => spawn(process.env.FFMPEG || 'ffmpeg', args, { stdio: 'inherit' }).on('close', (c) => (c ? ko(new Error(`ffmpeg ${c}`)) : ok())));
}

const { chromium } = createRequire(import.meta.url)('playwright'); // require : suit NODE_PATH (Playwright global)
rmSync(FRAMES, { recursive: true, force: true });
mkdirSync(FRAMES, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 1 });
await ctx.addInitScript((sv) => {
  if (!sessionStorage.getItem('seeded')) { for (const [k, v] of Object.entries(sv)) localStorage.setItem(k, v); sessionStorage.setItem('seeded', '1'); }
  // Horloge virtuelle (activée par __virt) : 1 pas = 1/60 s pour tout ce qui anime la page.
  const real = performance.now.bind(performance), realDate = Date.now, raf = requestAnimationFrame.bind(window);
  const rst = setTimeout.bind(window), rsi = setInterval.bind(window), rct = clearTimeout.bind(window);
  let virt = false, vt = 0, d0 = 0, seq = 0; const q = []; const timers = new Map(); const anims = new Map();
  performance.now = () => (virt ? vt : real());
  Date.now = () => (virt ? d0 + vt : realDate());
  window.requestAnimationFrame = (cb) => (virt ? (q.push(cb), q.length) : raf(cb));
  window.setTimeout = (fn, ms = 0, ...a) => { if (!virt) return rst(fn, ms, ...a); const id = 1e6 + ++seq; timers.set(id, { at: vt + Math.max(0, ms), fn, a }); return id; };
  window.setInterval = (fn, ms = 0, ...a) => { if (!virt) return rsi(fn, ms, ...a); const id = 1e6 + ++seq; timers.set(id, { at: vt + Math.max(1, ms), fn, a, every: Math.max(1, ms) }); return id; };
  window.clearTimeout = window.clearInterval = (id) => (timers.has(id) ? timers.delete(id) : rct(id));
  window.__virt = () => { vt = real(); d0 = realDate() - vt; virt = true; };
  window.__step = (ms) => {
    vt += ms;
    for (const [id, t] of [...timers].sort((x, y) => x[1].at - y[1].at)) {
      if (t.at > vt || !timers.has(id)) continue;
      if (t.every) t.at += t.every; else timers.delete(id);
      try { typeof t.fn === 'function' ? t.fn(...t.a) : null; } catch (e) { console.error(e); }
    }
    for (const a of document.getAnimations()) {
      if (!anims.has(a)) { a.pause(); anims.set(a, vt - (a.currentTime ?? 0)); }
      a.currentTime = vt - anims.get(a);
    }
    const c = q.splice(0); for (const f of c) f(vt);
  };
}, SAVE);

const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(URL_);
await page.waitForFunction(() => window.__idle?.renderer, null, { timeout: 60000 });
await page.waitForTimeout(3000);
for (let i = 0; i < 4; i++) {
  const c = await page.$('#modal:not(.hidden) [data-action="close-modal"], #modal:not(.hidden) .btn-primary');
  if (c) { await c.click().catch(() => {}); await page.waitForTimeout(300); }
}
await page.evaluate(() => {
  const idle = window.__idle, s = idle.state, R = idle.renderer;
  s.maxStage = Math.max(s.maxStage, 240); s.gems = 1e6; s.autoAdvance = false;
  // Contrôle de la tête : le corps du héros (sans arme ni effets) est copié sur un calque à part.
  const body = document.createElement('canvas'), bctx = body.getContext('2d');
  const drawHero = R.drawHero.bind(R);
  window.__chk = { frame: null, scale: 1 };
  R.drawHero = (c, ...a) => {
    body.width = c.canvas.width; body.height = c.canvas.height;
    window.__chk = { frame: null, scale: c.getTransform().a };
    // Toute image du héros (≥ 44 px de haut : image PixelLab 48 px, chevalier équipé, pose composée 92×66 de heroComposite ;
    // l'arme seule est plus petite) est aussi copiée sur le calque de contrôle.
    const di = c.drawImage;
    c.drawImage = function (img, ...r) {
      di.call(this, img, ...r);
      (window.__chk.sizes ??= []).push(`${img?.width}x${img?.height}`);
      if (img?.height >= 44) { bctx.setTransform(c.getTransform()); bctx.imageSmoothingEnabled = false; bctx.globalAlpha = 1; bctx.drawImage(img, ...r); window.__chk.frame ??= img.width === 92 && img.height === 66 ? 'pose' : 'anim'; }
    };
    try { return drawHero(c, ...a); } finally { delete c.drawImage; }
  };
  window.__heroCheck = () => {
    const k = window.__chk; if (!k.frame) return { frame: null, sizes: k.sizes };
    const { data, width, height } = bctx.getImageData(0, 0, body.width, body.height);
    let top = 1e9, bottom = -1, x0 = 1e9, x1 = -1;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (data[(y * width + x) * 4 + 3] > 127) { top = Math.min(top, y); bottom = Math.max(bottom, y); x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
    if (bottom < 0) return { frame: k.frame, height: 0, head: 0 };
    const sc = k.scale || 1; let head = 0;
    for (let y = Math.max(0, Math.round(bottom - 46 * sc)); y < bottom - 30 * sc; y++) for (let x = x0; x <= x1; x++) if (data[(y * width + x) * 4 + 3] > 127) head++;
    return { frame: k.frame, height: (bottom - top + 1) / sc, head: head / (sc * sc) };
  };
  window.__moment = (m) => {
    s.heroes.owned[m.hero] ??= { stars: 1 }; s.heroes.active = m.hero; s.heroClass = m.cls;
    for (const id of m.team) s.companions.owned[id] ??= { level: 30, stars: 3 };
    s.companions.equipped = [...m.team];
    const slots = ['weapon', 'helmet', 'armor'];
    slots.forEach((slot, i) => {
      if (!m.gear[i]) { if (slot !== 'weapon') s.equipment[slot] = null; return; }
      const it = idle.addItem(m.gear[i], 'legendary', m.stage); idle.actions.equip(it.id);
    });
    if (m.hero !== 'knight') { s.equipment.helmet = null; s.equipment.armor = null; }
    s.upgrades.damage = m.dmg;
    idle.actions.goToStage(m.stage);
    document.querySelector('.summon-fx')?.remove();
  };
  window.__summon = () => {
    const b = document.createElement('button');
    Object.assign(b.dataset, { action: 'summon', value: '10', currency: 'gems', pool: 'ally' });
    idle.ui.onClick({ target: b, preventDefault() {}, stopPropagation() {} });
  };
  window.__keepAlive = () => { const w = idle.world; if (w.hero && w.heroStats) { w.hero.hp = w.heroStats.maxHp; w.hero.dead = false; } };
  window.__virt();
});

const checks = [];
let n = 0;
for (const [mi, m] of MOMENTS.entries()) {
  await page.evaluate((m) => window.__moment(m), m);
  for (let f = 0; f < PREROLL * FPS; f++) await page.evaluate(() => { window.__keepAlive(); window.__step(1000 / 60); });
  for (let f = 0; f < SEG * FPS; f++) {
    if (m.summon && f === Math.round(m.summon * FPS)) await page.evaluate(() => window.__summon());
    const c = await page.evaluate(() => { window.__keepAlive(); window.__step(1000 / 60); return window.__heroCheck(); });
    checks.push({ f: n, moment: mi, ...c });
    await page.screenshot({ path: `${FRAMES}/f${String(n++).padStart(5, '0')}.png`, clip: CLIP });
  }
  console.log(`moment ${mi + 1}/${MOMENTS.length} : ${n} images`);
}
await browser.close();
writeFileSync(`${FRAMES}/checks.json`, JSON.stringify(checks));
// Héros sans tête : silhouette du corps trop basse ou bande de la tête vide (minimum PixelLab : 37 px et 62 px
// accroupi ; l'ancien PNG v6 sans tête : 25 px, bande vide). Image sans héros contrôlé (frame null) : refusée.
const bad = checks.filter((c) => !c.frame || c.height < 34 || c.head < 40);
console.log(`contrôle : ${checks.length} images, non contrôlées ${checks.filter((c) => !c.frame).length}, poses composées ${checks.filter((c) => c.frame === 'pose').length}, héros sans tête ${bad.length}, erreurs ${JSON.stringify(errors)}`);
if (bad.length || errors.length) { console.error(JSON.stringify(bad.slice(0, 20))); process.exit(1); }

if (process.env.NOENC) process.exit(0);
const IN = ['-framerate', String(FPS), '-i', `${FRAMES}/f%05d.png`];
await ffmpeg(['-y', '-loglevel', 'error', '-i', `${FRAMES}/f${String(POSTER).padStart(5, '0')}.png`, '-q:v', '3', `${FRAMES}/trailer-poster.jpg`]);
copyFileSync(`${FRAMES}/trailer-poster.jpg`, `${ROOT}site/assets/trailer-poster.jpg`);
const vp9 = (pass, out) => ['-y', '-loglevel', 'error', ...IN, '-c:v', 'libvpx-vp9', '-b:v', process.env.BITRATE || '2300k', '-deadline', 'good', '-cpu-used', '2',
  '-row-mt', '1', '-g', '240', '-pix_fmt', 'yuv420p', '-an', '-pass', String(pass), '-passlogfile', `${FRAMES}/vp9`, ...(pass === 1 ? ['-f', 'webm', '/dev/null'] : [out])];
await ffmpeg(vp9(1));
await ffmpeg(vp9(2, `${FRAMES}/trailer.webm`)); // encodé à part, copié à la fin
copyFileSync(`${FRAMES}/trailer.webm`, `${ROOT}site/assets/trailer.webm`);
console.log('écrit site/assets/trailer.webm et trailer-poster.jpg ; images dans', FRAMES);
