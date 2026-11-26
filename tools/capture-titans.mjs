// v10.16 : vidéo de contrôle des compétences des 7 Titans du jour (render/titan-skills.js).
// Pour chaque Titan et chaque taille : 60 s de combat (Fête lancée sur le Titan, comme tools/capture-cadrage.mjs) ; ses 5
// compétences sont déclenchées à 4, 14, 24, 34 et 44 s (en plus de celles du combat), une image JPEG est prise au moment
// fort de chacune, puis une planche de 5 images par Titan et par taille (ffmpeg). Vidéos .webm pour 2 Titans (PC).
//   node tools/capture-titans.mjs [--out docs/screenshots/v10.16/titans] [--sizes 1366x768,412x915] [--titans titan_sun,…]
//     [--video titan_sun,titan_void] [--seconds 60]
import { mkdir, rename, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { DAY_TITANS } from '../src/data/grand-bosses.js';
import { makeOpt, parseSizes, parseList, startApp, closeAll, isPhoneSize } from './lib-1013.mjs';
import { audit1016Init } from './audit-1016.mjs';

const opt = makeOpt(process.argv.slice(2));
const out = opt('out', 'docs/screenshots/v10.16/titans');
const sizes = parseSizes(opt('sizes', '1366x768,412x915'));
const ids = parseList(opt('titans', DAY_TITANS.map((t) => t.id).join(',')));
const videoIds = parseList(opt('video', 'titan_sun,titan_void'));
const seconds = Number(opt('seconds', '60'));
// Moment fort de chaque compétence (s après son déclenchement) : impact ou ambiance installée.
const PEAK = {
  sun_lance: 0.98, sun_crown: 1.0, sun_blind: 0.86, sun_rise: 1.9, sun_noon: 1.0,
  moon_disc: 1.05, moon_gaze: 0.95, moon_mirror: 0.75, moon_tide: 1.6, moon_night: 1.4,
  ember_bomb: 1.45, ember_geyser: 1.05, ember_ash: 1.25, ember_rain: 2.2, ember_heart: 1.45,
  tide_sphere: 1.47, tide_siphon: 0.95, tide_jet: 0.82, tide_wave: 1.35, tide_abyss: 2.5,
  thorn_seed: 1.6, thorn_spores: 1.2, thorn_grasp: 1.0, thorn_bramble: 1.6, thorn_forest: 1.5,
  storm_javelin: 0.8, storm_chain: 1.0, storm_thunder: 0.95, storm_clouds: 1.6, storm_wrath: 1.3,
  void_orb: 1.6, void_step: 0.95, void_rift: 1.2, void_cracks: 1.6, void_eclipse: 1.6,
};
const AT = [4, 14, 24, 34, 44];

await mkdir(out, { recursive: true });
const app = await startApp();

async function open(width, height, video) {
  const phone = isPhoneSize(width);
  const ctx = await app.browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, ...(phone ? { isMobile: true, hasTouch: true } : {}),
    ...(video ? { recordVideo: { dir: join(out, 'tmp-video'), size: { width, height } } } : {}) });
  const page = await ctx.newPage();
  await page.addInitScript(audit1016Init);
  const jsErrors = [];
  page.on('pageerror', (e) => jsErrors.push(e.message));
  await page.addInitScript((save) => { if (!sessionStorage.getItem('audit')) { localStorage.setItem('idle-rpg.save', save); sessionStorage.setItem('audit', '1'); } }, JSON.stringify(app.fixture));
  await page.goto(app.url);
  await page.waitForFunction(() => window.__idle?.ui, null, { timeout: 30000 });
  await page.waitForTimeout(6000);
  await closeAll(page);
  return { page, ctx, jsErrors };
}

async function fight(g, t, tag) {
  const { page } = g;
  await page.evaluate(([bid]) => {
    const a = __idle.actions;
    a.festBossStart = () => ({ event: 'titans', day: 'x', attempt: 1, seed: 21, maxHp: 1e200, bossId: bid });
    a.festBossFinish = () => null; a.festBossLeft = () => 3;
    window.__wbScene = null;
    const b = document.createElement('button'); b.dataset.action = 'fest-boss'; (__idle.ui.root ?? document.getElementById('panel-body') ?? document.body).appendChild(b); b.click(); b.remove();
  }, [t.id]);
  await page.waitForFunction(() => window.__wbScene, null, { timeout: 8000 });
  const kit = [...t.fight.abilities, ...t.fight.phases];
  const start = Date.now();
  const shots = [];
  for (let i = 0; i < kit.length; i++) {
    const s = kit[i];
    const wait = AT[i] * 1000 - (Date.now() - start);
    if (wait > 0) await page.waitForTimeout(wait);
    await page.evaluate((ev) => { const f = __wbScene.fight; f.out.push({ ...ev, damage: Math.round(f.world.heroStats.maxHp * ev.hit), time: f.time }); },
      { type: i < 3 ? 'ability' : 'phase', id: s.id, name: s.name, hit: s.hit, phase: i < 3 ? Math.max(1, i) : i - 2 });
    await page.waitForTimeout(Math.round((PEAK[s.id] ?? 1) * 1000));
    const file = join(out, `${t.id}-${tag}-${i + 1}-${s.id}.jpg`);
    await page.screenshot({ path: file, type: 'jpeg', quality: 80 });
    shots.push(file);
  }
  const rest = seconds * 1000 - (Date.now() - start);
  if (rest > 0) await page.waitForTimeout(rest);
  await page.evaluate(() => { document.querySelector('.wb-quit')?.click(); });
  await page.waitForTimeout(800);
  await closeAll(page);
  // Planche : les 5 images côte à côte (réduites), JPEG qualité ≈ 80.
  const sheet = join(out, `${t.id}-${tag}-planche.jpg`);
  const scale = isPhoneSize(Number(tag.split('x')[0])) ? 'scale=iw*0.6:-2' : 'scale=iw*0.4:-2';
  const inputs = shots.flatMap((f) => ['-i', f]);
  const chain = shots.map((_, i) => `[${i}:v]${scale}[v${i}]`).join(';') + `;${shots.map((_, i) => `[v${i}]`).join('')}hstack=inputs=${shots.length}`;
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', chain, '-q:v', '5', sheet]);
  for (const f of shots) await rm(f);
  return sheet;
}

for (const [w, h] of sizes) {
  const tag = `${w}x${h}`;
  const g = await open(w, h, false);
  for (const id of ids) {
    const t = DAY_TITANS.find((x) => x.id === id);
    console.log(tag, id, await fight(g, t, tag));
  }
  if (g.jsErrors.length) console.log('erreurs JS', [...new Set(g.jsErrors)].slice(0, 5));
  await g.ctx.close();
}
// Vidéos (PC, première taille) : un contexte par Titan, la vidéo couvre son combat.
const [vw, vh] = sizes[0];
for (const id of videoIds.filter((x) => ids.includes(x))) {
  const g = await open(vw, vh, true);
  const t = DAY_TITANS.find((x) => x.id === id);
  await rm(await fight(g, t, `video-${vw}x${vh}`)); // la planche de ce passage double celle déjà faite
  const path = await g.page.video().path();
  await g.ctx.close();
  await rename(path, join(out, `${id}-${vw}x${vh}.webm`));
  if (g.jsErrors.length) console.log('erreurs JS', [...new Set(g.jsErrors)].slice(0, 5));
}
await rm(join(out, 'tmp-video'), { recursive: true, force: true });
await app.close();
