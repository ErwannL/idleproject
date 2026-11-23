// Site de préinscription (paliers proches, parrainage) : photos et vidéos. node tools/media-site108.mjs <sortie>
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { mkdir, readdir, rename, rm } from 'node:fs/promises';
const { chromium } = createRequire(import.meta.url)('playwright');
const { createApp } = await import('../server/app.mjs');
const { openDatabase } = await import('../server/db.mjs');
const out = process.argv[2] ?? 'dist/media-site';
await mkdir(`${out}/photos`, { recursive: true }); await mkdir(`${out}/videos`, { recursive: true });
const db = openDatabase(':memory:');
const app = createApp({ db, siteDir: new URL('../site', import.meta.url).pathname, webDir: '', trustProxy: true });
for (let i = 0; i < 4; i++) db.prepare("INSERT INTO preregistrations (email, consent_version, consent_at) VALUES (?, 'x', 1)").run(`p${i}@exemple.fr`);
const srv = createServer(app).listen(0, '127.0.0.1'); await once(srv, 'listening');
const base = `http://127.0.0.1:${srv.address().port}/`;
const browser = await chromium.launch();
const SIZES = { pc: { width: 1280, height: 800 }, tel: { width: 390, height: 844 } };
let ip = 10;
async function shoot(name, size, lang, video = false) {
  const dir = `${out}/videos/tmp-${name}`;
  const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: video ? 1 : 2, extraHTTPHeaders: { 'X-Forwarded-For': `10.0.0.${ip++}` }, ...(video ? { recordVideo: { dir, size } } : {}) });
  const p = await ctx.newPage();
  await p.goto(`${base}?lang=${lang}&ref=ABCDE`); await p.waitForTimeout(1500);
  const goal = p.locator('#rewards');
  await goal.scrollIntoViewIfNeeded(); await p.waitForTimeout(video ? 2500 : 400);
  if (!video) await p.evaluate(() => document.querySelectorAll('body *').forEach((e) => { const ps = getComputedStyle(e).position; if (ps === 'fixed' || ps === 'sticky') e.style.visibility = 'hidden'; }));
  if (!video) await goal.screenshot({ path: `${out}/photos/site-${name}-paliers.png` });
  if (video) { await p.mouse.wheel(0, 500); await p.waitForTimeout(2000); }
  await p.locator('#join').scrollIntoViewIfNeeded(); await p.waitForTimeout(video ? 1200 : 200);
  await p.fill('#email', `demo-${name}@exemple.fr`); await p.waitForTimeout(video ? 600 : 0);
  await p.check('#consent'); await p.click('#prereg button[type=submit]');
  await p.waitForSelector('#thanks:not([hidden])'); await p.waitForTimeout(video ? 1500 : 500);
  await p.locator('#thanks').scrollIntoViewIfNeeded(); await p.waitForTimeout(video ? 3500 : 300);
  if (!video) await p.locator('#join').screenshot({ path: `${out}/photos/site-${name}-merci.png` });
  if (video) { await p.click('#ref-copy').catch(() => {}); await p.waitForTimeout(2000); }
  await ctx.close();
  if (video) { const f = (await readdir(dir)).find((x) => x.endsWith('.webm')); await rename(`${dir}/${f}`, `${out}/videos/${name}.webm`); await rm(dir, { recursive: true, force: true }); }
  console.log(video ? 'vidéo' : 'photos', name);
}
for (const [k, size] of Object.entries(SIZES)) for (const lang of ['fr', 'en']) await shoot(`${k}-${lang}`, size, lang);
await shoot('site-preinscription-pc-fr', SIZES.pc, 'fr', true);
await shoot('site-preinscription-telephone-fr', SIZES.tel, 'fr', true);
await shoot('site-preinscription-pc-en', SIZES.pc, 'en', true);
await browser.close(); srv.close();
