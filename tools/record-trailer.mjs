// Bande-annonce du site : le VRAI jeu (build web) filmé dans Chromium (Playwright), à 60 i/s réels.
//   npm run build:web, serveur du jeu lancé (PORT=8799 GAME_WEB=1 node server/index.mjs), puis
//   node tools/record-trailer.mjs --save save.json [--url http://localhost:8799/play/] [--part all|main|wb|encode]
// save.json : { "clé localStorage": "valeur" } d'une partie de fin de jeu (étape max ≥ 230, niveau élevé).
// v9.2.4 : remplace l'ancienne mise en scène à part (tools/trailer.html, supprimée), qui dessinait le chevalier avec
// les anciens PNG v6 hero_walk*/hero_attack* : ceux-ci n'ont que le CORPS (tête et casque étaient posés à part par le
// jeu), d'où un héros sans tête dans la vidéo.
// Horloge virtuelle : performance.now, Date.now, requestAnimationFrame, setTimeout/setInterval et animations CSS
// avancent de 1/60 s exactement par image : aucune saccade, quelle que soit la vitesse de la machine.
// Chaque image : contrôle de la tête du héros (les images du héros sont copiées à part pendant renderer.drawHero) ;
// un héros sans tête arrête l'enregistrement.
// v9.3.0 : nouvelle bande-annonce, plus spectaculaire et à l'interface allégée :
//   - un plan par monde (les 12), en ordre, avec les boss des mondes, les compétences du héros (toutes apprises,
//     lancées en automatique), une invocation, la nage du Royaume englouti, puis le World Boss « Colosse des Anciens »
//     (écran du World Boss piloté image par image : window.__wbManual / __wbFrame, barre raccourcie) ;
//   - interface allégée : seule la scène est filmée (cadre = la toile du jeu, 1280×720), les pastilles posées sur la
//     scène (étape, boutons de compétence, badges) sont masquées ;
//   - fondu au noir de 0,25 s entre les plans ;
//   - sorties : site/assets/trailer.webm (VP9, 2 passes) et trailer.mp4 (H.264, repli Safari), ≤ 12 Mo chacune,
//     affiche trailer-poster.jpg + .webp, et une image par monde pour le site (site/assets/worlds/<monde>.webp).
//   - parties séparées : --part main filme les mondes, --part wb le World Boss, --part encode assemble les deux.
import { spawn } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const URL_ = arg('--url', 'http://localhost:8799/play/');
const PART = arg('--part', 'all');
const FRAMES = arg('--frames', `${tmpdir()}/trailer-frames`);
const FPS = 60, PREROLL = 2.5, FADE = 15; // fondu : 15 images (0,25 s) en entrée et en sortie de plan
const VIEW = { width: 1368, height: 825 }; // la toile du jeu fait alors 1280×720 (barre de navigation à gauche)
// Cadrage resserré : 960×540 (CSS) au bas de la scène, là où se battent les personnages (le ciel vide est coupé),
// filmé à 4/3 de densité de pixels : 1280×720 réels.
const DPR = 4 / 3, CROP = { dx: 0, dy: 172, width: 960, height: 540 };
const POSTER = { part: 'main', frame: 600 };   // affiche : désert, boss, équipe au complet
const WB_SECONDS = Number(process.env.WB_SECONDS || 7.5);

// Plans : étape (monde ; multiple de 20 = méga boss du monde), durée, héros (apparence, classe, arme, casque, armure),
// équipe, dégâts (niveau d'amélioration : le boss doit tenir tout le plan), invocation (instant en s).
const KNIGHT = { hero: 'knight', cls: 'knight', gear: ['greatsword', 'horned_helm', 'plate_armor'] };
const MOMENTS = [
  { stage: 3, sec: 2.8, ...KNIGHT, team: ['squire', 'elf_archer', 'golden_slime'], dmg: 30 },
  { stage: 40, sec: 3, ...KNIGHT, team: ['ranger', 'sylvan_guardian', 'fairy'], dmg: 40 },
  { stage: 47, sec: 2.6, hero: 'valkyrie', cls: 'lancer', gear: ['halberd'], team: ['lancer', 'priestess', 'crystal_hedgehog'], dmg: 90 },
  { stage: 80, sec: 3.2, ...KNIGHT, gear: ['war_hammer', 'iron_helm', 'chainmail'], cls: 'paladin', team: ['azure_paladin', 'dwarf', 'dragonling'], dmg: 60 },
  { stage: 93, sec: 2.6, hero: 'seraph', cls: 'knight', gear: ['greatsword'], team: ['ice_empress', 'high_priest', 'owl'], dmg: 140 },
  { stage: 107, sec: 2.6, hero: 'witch', cls: 'stormcaller', gear: ['storm_scepter'], team: ['witch', 'rose_blade', 'wisp'], dmg: 150 },
  { stage: 133, sec: 2.4, ...KNIGHT, team: ['ranger', 'barbarian', 'jade_turtle'], dmg: 160 },
  { stage: 153, sec: 2.6, hero: 'seraph', cls: 'knight', gear: ['greatsword'], team: ['archangel', 'high_priest', 'kitsune'], dmg: 200 },
  { stage: 180, sec: 3.2, ...KNIGHT, gear: ['battle_axe', 'horned_helm', 'plate_armor'], cls: 'berserker', team: ['pyromancer', 'barbarian', 'phoenix'], dmg: 160 },
  { stage: 187, sec: 2.6, hero: 'demoness', cls: 'necromancer', gear: ['soul_reaper'], team: ['shadow_lord', 'demon_queen', 'wisp'], dmg: 260 },
  { stage: 220, sec: 3.6, ...KNIGHT, team: ['ninja', 'elf_archer', 'jade_turtle'], dmg: 150, swim: true },
  { stage: 230, sec: 3, hero: 'grombar', cls: 'paladin', gear: ['war_hammer'], team: ['archangel', 'demon_queen', 'dragonling'], dmg: 260 },
];
const WORLD_IDS = ['plains', 'forest', 'caves', 'desert', 'mountains', 'cursed', 'swamp', 'sky', 'volcano', 'void', 'ocean', 'abyss'];

function ffmpeg(args) {
  return new Promise((ok, ko) => spawn(process.env.FFMPEG || 'ffmpeg', args, { stdio: 'inherit' }).on('close', (c) => (c ? ko(new Error(`ffmpeg ${c}`)) : ok())));
}
const pad = (n) => String(n).padStart(5, '0');

async function film(part) {
  const SAVE = JSON.parse(readFileSync(arg('--save', `${ROOT}tools/trailer-save.json`), 'utf8'));
  const dir = `${FRAMES}/${part}`;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const { chromium } = createRequire(import.meta.url)('playwright'); // require : suit NODE_PATH (Playwright global)
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: VIEW, deviceScaleFactor: DPR });
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
    // v9.3.0 : compétences du héros toutes apprises et lancées en automatique (plans plus spectaculaires).
    s.level = Math.max(s.level, 400); s.skillAuto = true;
    for (const id of ['quick', 'whirl', 'cry', 'holy']) s.skills[id] = Math.max(s.skills[id] ?? 0, 30);
    // v9.3.0 : interface allégée : tout ce qui est posé sur la scène (étape, boutons, badges, bulles) est masqué.
    const st = document.createElement('style');
    st.textContent = '.toast,#toasts,.tip-bubble,.hold-ring,.ui-vfx{display:none!important}';
    document.head.appendChild(st);
    window.__declutter = () => {
      const cv = document.getElementById('scene'); const r = cv.getBoundingClientRect();
      for (const el of document.querySelectorAll('#app *')) {
        if (el === cv || el.contains(cv) || el.closest('.wb-overlay')) continue;
        const b = el.getBoundingClientRect();
        if (!b.width || !b.height) continue;
        const inside = b.left >= r.left - 1 && b.right <= r.right + 1 && b.top >= r.top - 1 && b.bottom <= r.bottom + 1;
        if (inside && getComputedStyle(el).visibility !== 'hidden') el.style.visibility = 'hidden';
      }
    };
    // Contrôle de la tête : le corps du héros (sans arme ni effets) est copié sur un calque à part.
    const body = document.createElement('canvas'), bctx = body.getContext('2d', { willReadFrequently: true });
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
    // v9.3.0 : World Boss : l'écran du jeu (ui/world-boss.js) ouvert avec une tentative de démonstration, piloté image
    // par image (__wbManual), barre de PV raccourcie (__wbHpMul) pour voir les phases et les attaques du Colosse.
    window.__openWorldBoss = (hpMul) => {
      window.__wbManual = true; window.__wbHpMul = hpMul;
      const a = idle.ui.actions;
      a.eventBossStart = () => ({ event: 'trailer', day: 'trailer', attempt: 1, seed: 7, maxHp: 1e9 });
      a.eventBossFinish = () => null; a.eventBossLeft = () => 0;
      const b = document.createElement('button');
      b.dataset.action = 'event-boss';
      idle.ui.onClick({ target: b, preventDefault() {}, stopPropagation() {} });
      const st2 = document.createElement('style');
      st2.textContent = '.wb-actions,.wb-live{display:none!important}';
      document.head.appendChild(st2);
      return Boolean(document.querySelector('.wb-overlay'));
    };
    window.__virt();
  });

  const checks = [];
  let n = 0;
  const cv = await page.evaluate((C) => { const r = document.getElementById('scene').getBoundingClientRect(); return { x: Math.round(r.x) + C.dx, y: Math.round(r.y) + C.dy, width: C.width, height: C.height }; }, CROP);
  const shot = (path, clip = cv) => page.screenshot({ path, clip });
  if (part === 'main') {
    mkdirSync(`${dir}/worlds`, { recursive: true });
    for (const [mi, m] of MOMENTS.entries()) {
      await page.evaluate((m) => window.__moment(m), m);
      for (let f = 0; f < PREROLL * FPS; f++) await page.evaluate(() => { window.__keepAlive(); window.__step(1000 / 60); });
      await page.evaluate(() => window.__declutter());
      const len = Math.round(m.sec * FPS);
      for (let f = 0; f < len; f++) {
        if (m.summon && f === Math.round(m.summon * FPS)) await page.evaluate(() => window.__summon());
        if (f % 30 === 0) await page.evaluate(() => window.__declutter());
        const c = await page.evaluate(() => { window.__keepAlive(); window.__step(1000 / 60); return window.__heroCheck(); });
        checks.push({ f: n, moment: mi, ...c });
        await shot(`${dir}/f${pad(n++)}.png`);
        if (f === Math.round(len * 0.45) && !m.summon) await shot(`${dir}/worlds/${WORLD_IDS[mi]}.png`);
      }
      if (m.summon) { // image du monde sans l'écran d'invocation
        await page.evaluate(() => document.querySelector('.summon-fx')?.remove());
        await shot(`${dir}/worlds/${WORLD_IDS[mi]}.png`);
      }
      console.log(`plan ${mi + 1}/${MOMENTS.length} : ${n} images`);
    }
  } else {
    // Équipe de démonstration, puis l'écran du World Boss (plein écran : on filme la fenêtre, 960×540 CSS = 1280×720 réels).
    await page.evaluate((m) => window.__moment(m), { stage: 230, ...KNIGHT, team: ['archangel', 'demon_queen', 'dragonling'], dmg: 260 });
    for (let f = 0; f < 30; f++) await page.evaluate(() => window.__step(1000 / 60));
    await page.setViewportSize({ width: 960, height: 540 });
    const ok = await page.evaluate((mul) => window.__openWorldBoss(mul), Number(process.env.WB_HP || 0.035));
    if (!ok) throw new Error('écran du World Boss non ouvert');
    const len = Math.round(WB_SECONDS * FPS);
    for (let f = 0; f < len; f++) {
      const done = await page.evaluate(() => { window.__step(1000 / 60); return window.__wbFrame?.(); });
      await shot(`${dir}/f${pad(n++)}.png`, { x: 0, y: 0, width: 960, height: 540 });
      if (f === Math.round(len * 0.6)) await shot(`${dir}/colossus.png`, { x: 0, y: 0, width: 960, height: 540 });
      if (done) { console.log(`World Boss terminé à ${f} images`); break; }
    }
    console.log(`World Boss : ${n} images`);
  }
  await browser.close();
  writeFileSync(`${dir}/checks.json`, JSON.stringify(checks));
  if (part === 'main') {
    // Héros sans tête : silhouette du corps trop basse ou bande de la tête vide (minimum PixelLab : 37 px et 62 px
    // accroupi ; l'ancien PNG v6 sans tête : 25 px, bande vide). Image sans héros contrôlé (frame null) : refusée.
    // Nage (Royaume englouti) : le héros nage à l'horizontale, sa silhouette est basse et la bande de la tête est en
    // partie vide : seuil réduit (contrôlé à l'œil sur la planche contact).
    const swim = new Set(MOMENTS.map((m, i) => (m.swim ? i : -1)));
    const bad = checks.filter((c) => !c.frame || (swim.has(c.moment) ? c.height < 24 || c.head < 15 : c.height < 34 || c.head < 40));
    console.log(`contrôle : ${checks.length} images, non contrôlées ${checks.filter((c) => !c.frame).length}, poses composées ${checks.filter((c) => c.frame === 'pose').length}, héros sans tête ${bad.length}, erreurs ${JSON.stringify(errors)}`);
    if (bad.length || errors.length) { console.error(JSON.stringify(bad.slice(0, 20))); process.exit(1); }
  } else if (errors.length) { console.error(JSON.stringify(errors)); process.exit(1); }
}

async function encode() {
  const parts = ['main', 'wb'].filter((p) => existsSync(`${FRAMES}/${p}/f00000.png`));
  const counts = { main: MOMENTS.map((m) => Math.round(m.sec * FPS)) };
  const IN = parts.flatMap((p) => ['-framerate', String(FPS), '-i', `${FRAMES}/${p}/f%05d.png`]);
  // Fondus au noir entre les plans : chaque plan est découpé (trim), fondu en entrée et en sortie, puis tous les plans
  // sont mis bout à bout (un seul filtre fade par plan : un fondu de sortie laisse noir tout ce qui suit).
  const segs = [];
  parts.forEach((p, i) => {
    const lens = p === 'main' ? counts.main : [frameCount(`${FRAMES}/wb`)];
    let at = 0;
    segs.push(`[${i}:v]split=${lens.length}${lens.map((_, k) => `[s${i}_${k}]`).join('')}`);
    lens.forEach((l, k) => {
      const d = l / FPS;
      segs.push(`[s${i}_${k}]trim=start_frame=${at}:end_frame=${at + l},setpts=PTS-STARTPTS,fade=t=in:st=0:d=${FADE / FPS},fade=t=out:st=${(d - FADE / FPS).toFixed(3)}:d=${FADE / FPS},format=yuv420p[c${i}_${k}]`);
      at += l;
    });
  });
  const all = parts.flatMap((p, i) => (p === 'main' ? counts.main : [0]).map((_, k) => `[c${i}_${k}]`));
  const filter = `${segs.join(';')};${all.join('')}concat=n=${all.length}:v=1:a=0[out]`;
  const base = ['-y', '-loglevel', 'error', ...IN, '-filter_complex', filter, '-map', '[out]', '-an'];
  const poster = `${FRAMES}/${POSTER.part}/f${pad(POSTER.frame)}.png`;
  await ffmpeg(['-y', '-loglevel', 'error', '-i', poster, '-q:v', '4', `${FRAMES}/trailer-poster.jpg`]);
  await ffmpeg(['-y', '-loglevel', 'error', '-i', poster, '-vf', 'scale=960:-1:flags=neighbor', '-quality', '78', `${FRAMES}/trailer-poster.webp`]);
  const vp9 = (pass, out) => [...base, '-c:v', 'libvpx-vp9', '-b:v', process.env.BITRATE || '2000k', '-maxrate', '2600k', '-deadline', 'good', '-cpu-used', '2',
    '-row-mt', '1', '-g', '240', '-pass', String(pass), '-passlogfile', `${FRAMES}/vp9`, ...(pass === 1 ? ['-f', 'webm', '/dev/null'] : [out])];
  await ffmpeg(vp9(1));
  await ffmpeg(vp9(2, `${FRAMES}/trailer.webm`));
  await ffmpeg([...base, '-c:v', 'libx264', '-preset', 'slow', '-profile:v', 'high', '-crf', process.env.CRF || '30', '-maxrate', '2600k', '-bufsize', '5200k',
    '-movflags', '+faststart', '-g', '240', `${FRAMES}/trailer.mp4`]);
  for (const f of ['trailer.webm', 'trailer.mp4', 'trailer-poster.jpg', 'trailer-poster.webp']) {
    copyFileSync(`${FRAMES}/${f}`, `${ROOT}site/assets/${f}`);
    console.log(`site/assets/${f} : ${(statSync(`${FRAMES}/${f}`).size / 1048576).toFixed(2)} Mo`);
  }
  // Images des mondes et du Colosse pour le site (640×360, WebP).
  mkdirSync(`${ROOT}site/assets/worlds`, { recursive: true });
  const stills = WORLD_IDS.map((w) => [`${FRAMES}/main/worlds/${w}.png`, `${ROOT}site/assets/worlds/${w}.webp`]);
  if (parts.includes('wb')) stills.push([`${FRAMES}/wb/colossus.png`, `${ROOT}site/assets/worlds/colossus.webp`]);
  for (const [src, out] of stills) if (existsSync(src)) await ffmpeg(['-y', '-loglevel', 'error', '-i', src, '-vf', 'scale=640:360:flags=area', '-quality', '80', out]);
  console.log('images des mondes : site/assets/worlds/');
}

function frameCount(dir) {
  let n = 0; while (existsSync(`${dir}/f${pad(n)}.png`)) n++; return n;
}

if (PART === 'all' || PART === 'main') await film('main');
if (PART === 'all' || PART === 'wb') await film('wb');
if (PART === 'all' || PART === 'encode' || process.env.ENCODE) { if (!process.env.NOENC) await encode(); }
