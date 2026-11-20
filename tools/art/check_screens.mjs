// v10.1 (P2) : chaque écran doit être illustré — la part d'image dans le premier écran du panneau ≥ 15 % et au moins
// une grande image (≥ 120 px de large ou de haut). Usage : node tools/art/check_screens.mjs [onglets…] → code 1 si refus.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { startServer } from '../serve.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const TABS = process.argv.slice(2).length ? process.argv.slice(2) : ['upgrades', 'skills', 'inventory', 'forge', 'tree', 'companions', 'expeditions', 'summon', 'shop', 'campaign', 'dungeons', 'tower', 'event', 'daybook', 'contracts', 'encyclopedia', 'boss', 'ranking', 'guild', 'stats', 'looks', 'camp'];
const server = await startServer(0);
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1116, height: 993 } })).newPage();
const raw = await readFile('tests/fixtures/endgame.json', 'utf8');
await page.addInitScript((r) => { if (!sessionStorage.getItem('cap')) { localStorage.setItem('idle-rpg.save', r); sessionStorage.setItem('cap', '1'); } }, raw);
await page.goto(`http://localhost:${server.address().port}/`);
await page.waitForFunction(() => window.__idle?.ui, null, { timeout: 30000 });
await page.waitForTimeout(2500);
await page.evaluate(() => document.querySelectorAll('#modal:not(.hidden) [data-action="close-modal"], #modal:not(.hidden) [data-action="claim-offline"]').forEach((b) => b.click()));
await page.keyboard.press('Escape');
let bad = 0;
for (const t of TABS) {
  const r = await page.evaluate(async (tab) => {
    __idle.ui.openTab(tab); await new Promise((res) => setTimeout(res, 900));
    const body = document.getElementById('panel-body');
    if (!body) return null;
    const pb = body.getBoundingClientRect();
    const view = { top: pb.top, bottom: Math.min(innerHeight, pb.bottom), left: pb.left, right: pb.right };
    const area = Math.max(1, (view.bottom - view.top) * (view.right - view.left));
    // Grille de points : un point compte s'il tombe sur une image (img, canvas, fond illustré).
    let hit = 0, n = 0, big = 0;
    for (let y = view.top + 4; y < view.bottom; y += 8) for (let x = view.left + 4; x < view.right; x += 8) {
      n++;
      const el = document.elementFromPoint(x, y);
      const pic = el?.closest?.('img, canvas, .dg-card, .arena-tile, .art-banner-wrap, [style*="background-image"]');
      if (pic && body.contains(pic)) hit++;
    }
    for (const im of body.querySelectorAll('img, canvas, .dg-card, .arena-tile, [style*="background-image"]')) {
      const b = im.getBoundingClientRect();
      if (b.bottom > view.top && b.top < view.bottom && (b.width >= 120 || b.height >= 120)) big++;
    }
    return { share: hit / Math.max(1, n), big, area };
  }, t);
  if (!r) { console.log(`? ${t} : panneau absent`); continue; }
  // v10.2 (P3) : seuil relevé à 20 % là où le joueur passe le plus de temps.
  const min = ['upgrades', 'contracts', 'stats'].includes(t) ? 0.2 : 0.15;
  const ok = r.share >= min && r.big >= 1;
  bad += !ok;
  console.log(`${ok ? '✓' : '✗'} ${t.padEnd(13)} image ${(r.share * 100).toFixed(0)} % · grandes images ${r.big}`);
}
await browser.close(); server.close();
process.exit(bad ? 1 : 0);
