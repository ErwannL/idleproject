// v10.14.1 (lot 5) : capture de l'Invocation pendant la grande fête (février 2027) : ligne « Jalons : n / m › » sous la vedette,
// clic → écran de la fête ouvert sur l'Aventure. Horloge fixée (Playwright clock) au 5 février 2027, 12 h.
//   node tools/shot-fest-summon.mjs [--sizes 1116x993,1920x1080,412x915,390x844] [--out <dossier>] [--summons 35]
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { ALL_SIZES, closeAll, makeOpt, parseSizes, startApp } from './lib-1013.mjs';

const opt = makeOpt(process.argv);
const sizes = parseSizes(opt('sizes', '1116x993,1920x1080,412x915,390x844'));
const out = opt('out', 'docs/screenshots/v10.14.1');
const summons = Number(opt('summons', '35'));
await mkdir(out, { recursive: true });
const app = await startApp();
let bad = 0;
for (const [w, h] of sizes) {
  const phone = w <= 600;
  const ctx = await app.browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, ...(phone ? { isMobile: true, hasTouch: true } : {}) });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.clock.install({ time: new Date(2027, 1, 5, 12, 0, 0) });
  await page.addInitScript((save) => { if (!sessionStorage.getItem('audit')) { localStorage.setItem('idle-rpg.save', save); sessionStorage.setItem('audit', '1'); } }, JSON.stringify(app.fixture));
  await page.goto(app.url);
  await page.waitForFunction(() => window.__idle?.ui, null, { timeout: 30000 });
  await page.clock.runFor(6000);
  await page.addStyleTag({ content: '[class*="tuto"], .tour { display: none !important; }' });
  await closeAll(page);
  await page.evaluate((n) => {
    const { state } = window.__idle;
    const f = Object.keys(state.economy?.events ?? {});
    window.__fixSummons = n; return f;
  }, summons);
  // Les jalons : on pose le compteur de la fête en cours via l'API du jeu.
  await page.evaluate(async (n) => {
    const m = await import('./src/core/fest.js');
    const rec = m.festRecord(window.__idle.state);
    rec.fest.summons = n;
    window.__idle.ui.invalidate();
  }, summons);
  await page.evaluate(() => window.__idle.ui.openTab('summon'));
  await page.clock.runFor(1500);
  await closeAll(page);
  await page.evaluate(() => window.__idle.ui.setView?.({ summonPool: 'limited' }));
  await page.clock.runFor(500);
  const info = await page.evaluate(() => {
    const el = document.querySelector('.sum-fest-line');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const panel = (el.closest('#panel-body') ?? document.body).getBoundingClientRect();
    return { text: el.textContent.replace(/\s+/g, ' ').trim(), w: Math.round(r.width), h: Math.round(r.height), inside: r.left >= panel.left - 1 && r.right <= panel.right + 1, font: getComputedStyle(el).fontSize,
      overflowX: document.documentElement.scrollWidth > window.innerWidth + 1 };
  });
  console.log(`${w}x${h}`, JSON.stringify(info), errors.length ? errors : '');
  if (!info || info.h < 44 || !info.inside || info.overflowX || parseFloat(info.font) < 12) bad += 1;
  await page.screenshot({ path: join(out, `invocation-jalons-${w}x${h}.jpg`), type: 'jpeg', quality: 60 });
  await page.click('.sum-fest-line');
  await page.clock.runFor(800);
  await page.waitForTimeout(700);
  const hub = await page.evaluate(() => ({ open: Boolean(document.querySelector('.fest-hub')), tab: document.querySelector('.fest-hub')?.className ?? '' }));
  console.log('  après clic :', JSON.stringify(hub));
  if (process.env.DBG) console.log(JSON.stringify(await page.evaluate(() => { const e = document.querySelector('.fest-hub'); const r = e.getBoundingClientRect(); const c = getComputedStyle(e); return { r: [r.left, r.top, r.width, r.height], disp: c.display, vis: c.visibility, op: c.opacity, z: c.zIndex, pos: c.position, parent: e.parentElement.id, top: document.elementFromPoint(200, 300)?.className }; })));
  if (!hub.open || !/fh-tab-adventure/.test(hub.tab)) bad += 1;
  await page.screenshot({ path: join(out, `invocation-jalons-hub-${w}x${h}.jpg`), type: 'jpeg', quality: 60 });
  await ctx.close();
}
await app.close();
process.exit(bad ? 1 : 0);
