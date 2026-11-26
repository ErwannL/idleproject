// v10.16 : vidéo et mesures de contrôle du « vrai combat de boss ».
//   node tools/capture-boss-feel.mjs [--out docs/screenshots/v10.16] [--sizes 1366x768,412x915] [--seconds 10] [--stage 520] [--giant frost_giant]
// Pour chaque taille : 10 s d'un boss de campagne résistant (PV montés pour ≈ 30 s de combat) et 10 s d'un géant.
// Enregistre une vidéo (.webm) et une planche de 16 images par combat, puis un rapport (rapport.md et rapport.json) :
// part du temps où le boss est blanc, nombre de croissants (effets fx_slash*), coups du héros par seconde.
// Les compteurs viennent de la scène (globalThis.__feelStats, voir src/render/scene.js).
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { makeOpt, parseSizes, startApp, closeAll } from './lib-1013.mjs';

const opt = makeOpt(process.argv.slice(2));
const out = opt('out', 'docs/screenshots/v10.16');
const sizes = parseSizes(opt('sizes', '1366x768,412x915'));
const SECONDS = Number(opt('seconds', '10'));
const STAGE = Number(opt('stage', '520'));
const GIANT = opt('giant', 'frost_giant'); // le Jarl du Givre
await mkdir(out, { recursive: true });
const app = await startApp();
const report = [];

async function open(w, h, videoDir) {
  const phone = w <= 600;
  const ctx = await app.browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, ...(phone ? { isMobile: true, hasTouch: true } : {}),
    recordVideo: { dir: videoDir, size: { width: w, height: h } } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript((save) => { if (!sessionStorage.getItem('audit')) { localStorage.setItem('idle-rpg.save', save); sessionStorage.setItem('audit', '1'); } }, JSON.stringify(app.fixture));
  await page.goto(app.url);
  await page.waitForFunction(() => window.__idle?.ui, null, { timeout: 30000 });
  await page.waitForTimeout(5000);
  await closeAll(page);
  return { ctx, page, errors };
}

// Mesure pendant `sec` secondes, avec 16 images pour la planche.
async function measure(page, name, sec) {
  await page.evaluate(() => { globalThis.__feelStats = { frames: 0, white: 0, slash: 0, strikes: 0 }; });
  const shots = [];
  for (let i = 0; i < 16; i++) {
    await page.waitForTimeout((sec * 1000) / 16);
    shots.push(await page.screenshot());
  }
  const st = (await page.evaluate(() => globalThis.__feelStats)) ?? {};
  await writeFile(join(out, `${name}-planche.json`), JSON.stringify({ n: shots.length }));
  for (let i = 0; i < shots.length; i++) await writeFile(join(out, 'frames', `${name}-${String(i).padStart(2, '0')}.png`), shots[i]);
  // Version sans compteurs (avant la v10.16) : mesures vides, seules les images et la vidéo comptent.
  return { name, seconds: sec, bossFrames: st.frames ?? null, whitePct: st.frames ? Math.round((st.white / st.frames) * 1000) / 10 : null,
    crescents: st.slash ?? null, strikesPerSec: st.strikes != null ? Math.round((st.strikes / sec) * 10) / 10 : null };
}

await mkdir(join(out, 'frames'), { recursive: true });
for (const [w, h] of sizes) {
  const tag = `${w}x${h}`;
  // 1. Boss de campagne résistant.
  {
    const vdir = join(out, 'video-tmp');
    const g = await open(w, h, vdir);
    // La partie de fin tue un boss de campagne en une image : ses PV sont montés dès son apparition (tableau des ennemis
    // surveillé), à ≈ 30 s de combat (dégâts par seconde du héros × 45, équipe comprise).
    await g.page.evaluate((stage) => {
      const s = __idle.state; s.maxStage = Math.max(s.maxStage, stage); s.autoAdvance = false;
      const patch = () => {
        const arr = __idle.world.enemies;
        if (!arr.__feel) {
          arr.__feel = true;
          arr.push = function (...xs) { for (const x of xs) if (x.boss) { x.maxHp = x.hp = (__idle.world.heroStats?.dps ?? 1) * 45; } return Array.prototype.push.apply(this, xs); };
        }
      };
      setInterval(patch, 5); patch();
      __idle.actions.goToStage(stage);
    }, STAGE);
    await g.page.waitForFunction(() => __idle.world.enemies.some((e) => e.boss), null, { timeout: 30000 });
    // Au-delà de 8 s sur le même boss : tension (combo, garde brisée) — on filme de 2 s à 12 s.
    await g.page.waitForTimeout(2000);
    const r = await measure(g.page, `boss-campagne-${tag}`, SECONDS);
    report.push({ size: tag, fight: 'boss de campagne', stage: STAGE, ...r, jsErrors: [...new Set(g.errors)].slice(0, 3) });
    const v = g.page.video();
    await g.ctx.close();
    if (v) await rename(await v.path(), join(out, `boss-campagne-${tag}.webm`));
  }
  // 2. Géant (World Boss, même moteur).
  {
    const vdir = join(out, 'video-tmp');
    const g = await open(w, h, vdir);
    await g.page.evaluate((bid) => {
      const a = __idle.actions;
      a.festBossStart = () => ({ event: 'boss-feel', day: 'x', attempt: 1, seed: 7, maxHp: 1e200, bossId: bid });
      a.festBossFinish = () => null; a.festBossLeft = () => 3;
      window.__wbScene = null;
      const b = document.createElement('button'); b.dataset.action = 'fest-boss'; (__idle.ui.root ?? document.getElementById('panel-body') ?? document.body).appendChild(b); b.click(); b.remove();
    }, GIANT);
    await g.page.waitForFunction(() => window.__wbScene, null, { timeout: 8000 });
    await g.page.waitForTimeout(1500);
    const r = await measure(g.page, `geant-${GIANT}-${tag}`, SECONDS);
    report.push({ size: tag, fight: `géant ${GIANT}`, ...r, jsErrors: [...new Set(g.errors)].slice(0, 3) });
    const v = g.page.video();
    await g.ctx.close();
    if (v) await rename(await v.path(), join(out, `geant-${GIANT}-${tag}.webm`));
  }
  console.log(tag, 'ok');
}
await app.close();

const md = ['# v10.16 — mesures du combat de boss', '', `${SECONDS} s filmées par combat (tools/capture-boss-feel.mjs).`, '',
  '| Taille | Combat | Boss blanc | Croissants | Coups du héros / s | Erreurs JS |', '|---|---|---|---|---|---|',
  ...report.map((r) => `| ${r.size} | ${r.fight} | ${r.whitePct ?? '—'} % | ${r.crescents} | ${r.strikesPerSec} | ${r.jsErrors.length} |`), ''];
await writeFile(join(out, 'rapport.md'), md.join('\n'));
await writeFile(join(out, 'rapport.json'), JSON.stringify(report, null, 2));
console.log(md.join('\n'));
