// v10.9.1 : vidéos de la Forge et du Bastion (carte par âge, zoom, livre des recherches). node tools/video-1091.mjs <sortie>
import { createRequire } from 'node:module';
import { mkdir, readFile, readdir, rename, rm } from 'node:fs/promises';
import { startServer } from './serve.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const out = process.argv[2] ?? 'dist/media-10.9.1/videos';
await mkdir(out, { recursive: true });
const server = await startServer(0);
const url = `http://localhost:${server.address().port}/`;
const browser = await chromium.launch();
const fx = JSON.parse(await readFile('tests/fixtures/endgame.json', 'utf8'));
fx.maxStage = 200; fx.gold = 1e60; fx.materials.shards = 60000; fx.playSeconds = 1e5; fx.records = { ...fx.records, bestStage: 200 };
const wait = (p, ms) => p.waitForTimeout(ms);
async function rec(name, size, script) {
  const dir = `${out}/tmp-${name}`;
  const ctx = await browser.newContext({ viewport: size, recordVideo: { dir, size } });
  const page = await ctx.newPage();
  await page.addInitScript((r) => { if (!sessionStorage.getItem('m')) { localStorage.setItem('idle-rpg.save', r); sessionStorage.setItem('m', '1'); } }, JSON.stringify(fx));
  await page.goto(url);
  await page.waitForFunction(() => window.__idle?.ui, null, { timeout: 30000 });
  await wait(page, 6000);
  await page.evaluate(() => { document.querySelectorAll('#modal:not(.hidden) [data-action="close-modal"], #modal:not(.hidden) [data-action="offline-claim"]').forEach((b) => b.click()); __idle.ui.closeModal(); });
  await script(page);
  await ctx.close();
  const f = (await readdir(dir)).find((x) => x.endsWith('.webm'));
  await rename(`${dir}/${f}`, `${out}/${name}.webm`);
  await rm(dir, { recursive: true, force: true });
  console.log('vidéo', name);
}
const forge = async (p) => {
  await p.evaluate(() => __idle.ui.openTab('forge')); await wait(p, 2500);
  for (const s of ['recycle', 'upgrade', 'fusion', 'craft', 'recycle']) { await p.click(`.fg-step[data-value="${s}"]`).catch(() => {}); await wait(p, 2200); }
  await p.click('.fg-step[data-value="upgrade"] .fg-btn').catch(() => {}); await wait(p, 2500);
};
const openResearch = (p) => p.evaluate(() => document.querySelectorAll('button').forEach((b) => { if (b.textContent.trim() === 'Recherches') b.click(); }));
const bastion = async (p) => {
  for (let a = 1; a <= 5; a++) {
    await p.evaluate(async (age) => {
      const s = __idle.state; const st = [40, 120, 180, 240, 300][age - 1]; s.maxStage = st; s.records.bestStage = st; s.bastion.age = age;
      for (const b of Object.values(s.bastion.buildings)) b.level = Math.max(1, b.level);
      const { openBastion } = await import('./src/ui/panels/camp.js'); openBastion(__idle.ui);
    }, a);
    await wait(p, 900);
    await p.evaluate(() => document.querySelectorAll('.bs-kick button').forEach((b) => b.click()));
    await wait(p, 2200);
  }
  await p.click('.bs-zoom [data-zoom="in"]').catch(() => {}); await wait(p, 900);
  await p.click('.bs-zoom [data-zoom="in"]').catch(() => {}); await wait(p, 1500);
  const v = await p.$('.bs-village'); const b = await v?.boundingBox();
  if (b) { await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await p.mouse.down(); await p.mouse.move(b.x + b.width / 2 - 150, b.y + b.height / 2 - 60, { steps: 25 }); await p.mouse.up(); await wait(p, 1500); }
  await p.click('.bs-zoom [data-zoom="out"]').catch(() => {}); await p.click('.bs-zoom [data-zoom="out"]').catch(() => {}); await wait(p, 1500);
  for (const id of ['forge', 'library', 'mine']) { await p.click(`.bs-plot[data-value="${id}"]`).catch(() => {}); await wait(p, 2000); }
  await openResearch(p); await wait(p, 2000);
  for (const br of await p.$$('[data-action="bastion-branch"]')) { await br.click().catch(() => {}); await wait(p, 2000); }
  for (const pg of (await p.$$('[data-action="bastion-page"]')).slice(1, 4)) { await pg.click().catch(() => {}); await wait(p, 1800); }
};
const phone = async (p) => {
  await forge(p);
  await p.evaluate(async () => { const { openBastion } = await import('./src/ui/panels/camp.js'); openBastion(__idle.ui); }); await wait(p, 2500);
  await openResearch(p); await wait(p, 1500);
  await p.evaluate(() => document.querySelector('.bs-btabs')?.scrollIntoView()); await wait(p, 1500);
  for (let i = 0; i < 2; i++) { await p.click('.bs-turn.next').catch(() => {}); await wait(p, 1800); await p.click('.bs-turn.prev').catch(() => {}); await wait(p, 1500); }
  for (const br of await p.$$('[data-action="bastion-branch"]')) { await br.click().catch(() => {}); await wait(p, 1800); }
};
await rec('05-forge-fenetre-large', { width: 2536, height: 1011 }, forge);
await rec('06-forge-pc', { width: 1116, height: 993 }, forge);
await rec('07-bastion-ages-zoom-recherches', { width: 1116, height: 993 }, bastion);
await rec('08-forge-et-bastion-telephone', { width: 390, height: 844 }, phone);
await browser.close(); server.close();
