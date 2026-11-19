// v10.1 (P1 §2.7) : densité de texte — mots visibles dans le premier écran de chaque onglet (fixture fin de partie).
// Usage : node tools/word-density.mjs [max=120] [onglets…]   → code 1 si un onglet dépasse.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { startServer } from './serve.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const [maxArg = '120', ...only] = process.argv.slice(2);
const MAX = Number(maxArg);
const TABS = only.length ? only : ['stats', 'skins', 'expeditions', 'shop', 'upgrades', 'collections', 'boss', 'dungeons', 'inventory', 'skills', 'companions', 'summon', 'forge', 'contracts', 'tower', 'arena', 'tree', 'daybook', 'ranking', 'guild'];
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
  const n = await page.evaluate(async ([tab, ALL]) => {
    __idle.ui.openTab(tab); await new Promise((r) => setTimeout(r, 600));
    const root = document.getElementById('panel');
    if (!root) return -1;
    const H = innerHeight; let words = 0; const process_all = ALL;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode; const el = node.parentElement;
      if (!el || !node.textContent.trim()) continue;
      const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const r = el.getBoundingClientRect(); if (!r.width || (!process_all && (r.top > H || r.bottom < 0))) continue;
      if (el.closest('details:not([open]) > :not(summary)')) continue;
      words += node.textContent.split(/\s+/).filter((w) => /[A-Za-zÀ-ÿ]{2,}/.test(w)).length;
    }
    return words;
  }, [t, !!process.env.ALL]);
  const over = n > MAX; bad += over;
  console.log(`${over ? '✗' : '✓'} ${t.padEnd(12)} ${n} mots`);
}
await browser.close(); server.close();
process.exit(bad ? 1 : 0);
