// v10.1 (P5) : audit des textes dessinés sur la scène — jamais un mot de moins de 3 lettres, jamais un texte coupé
// par le bord du canevas. Intercepte fillText pendant N secondes de jeu (fin de partie + partie neuve).
// Usage : node tools/text-audit.mjs [secondes=40] → code 1 si un texte fautif est vu.
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { startServer } from './serve.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const secs = Number(process.argv[2] ?? 40);
const server = await startServer(0);
const browser = await chromium.launch();
const bad = new Map();
for (const [save, vw, vh] of [['fixture', 1116, 993], ['new', 1116, 993], ['fixture', 640, 480], ['fixture', 390, 844]]) {
  const page = await (await browser.newContext({ viewport: { width: vw, height: vh } })).newPage();
  if (save === 'fixture') {
    const raw = await readFile('tests/fixtures/endgame.json', 'utf8');
    await page.addInitScript((r) => { if (!sessionStorage.getItem('cap')) { localStorage.setItem('idle-rpg.save', r); sessionStorage.setItem('cap', '1'); } }, raw);
  }
  await page.addInitScript(() => {
    window.__texts = [];
    const orig = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (t, x, y, ...rest) {
      try {
        const s = String(t);
        const onScene = this.canvas.id === 'scene';
        {
          const m = this.getTransform(); const w = this.measureText(s).width;
          const al = this.textAlign; const x0 = al === 'center' ? x - w / 2 : al === 'right' || al === 'end' ? x - w : x;
          const px0 = m.a * x0 + m.e, px1 = m.a * (x0 + w) + m.e;
          const letters = s.replace(/[^A-Za-zÀ-ÿ]/g, '');
          const short = letters.length > 0 && letters.length < 3 && !/^\d/.test(s) && !/[KMBTQ]/.test(s) && !/^[+\-×x]/.test(s) && !/s$/.test(s);
          const cut = onScene && (px0 < -1 || px1 > this.canvas.width + 1);
          if ((short || (cut && letters.length >= 2)) && window.__texts.length < 200) window.__texts.push({ s, short, cut, px0: Math.round(px0), px1: Math.round(px1), W: this.canvas.width, stack: new Error().stack.split('\n').slice(2, 4).join(' | ') });
        }
      } catch { /* */ }
      return orig.call(this, t, x, y, ...rest);
    };
  });
  await page.goto(`http://localhost:${server.address().port}/`);
  await page.waitForFunction(() => window.__idle?.ui, null, { timeout: 30000 });
  await page.evaluate(() => document.querySelectorAll('#modal:not(.hidden) [data-action="close-modal"], #modal:not(.hidden) [data-action="claim-offline"]').forEach((b) => b.click()));
  await page.waitForTimeout(secs * 1000);
  // Textes HTML posés sur la scène : ni mot de moins de 3 lettres, ni texte rogné (débordement caché).
  for (let k = 0; k < Math.max(1, Math.floor(secs / 5)); k++) {
    const dom = await page.evaluate(() => {
      const out = [];
      const area = document.getElementById('stage-area');
      for (const el of area?.querySelectorAll('*') ?? []) {
        if (!el.childNodes.length || [...el.childNodes].every((n) => n.nodeType !== 3)) continue;
        const txt = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
        if (!txt || el.closest('.rush-key, kbd, .sk-key')) continue;
        const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
        if (cs.display === 'none' || cs.visibility === 'hidden' || !r.width || +cs.opacity === 0) continue;
        const letters = txt.replace(/[^A-Za-zÀ-ÿ]/g, '');
        const short = letters.length > 0 && letters.length < 3 && /^[A-Za-zÀ-ÿ]+$/.test(txt);
        const cut = (cs.overflow === 'hidden' || cs.textOverflow === 'ellipsis') && el.scrollWidth > el.clientWidth + 2 && cs.textOverflow !== 'ellipsis';
        if (short || cut) out.push({ s: txt.slice(0, 40), short, cut, px0: Math.round(r.left), px1: Math.round(r.right), W: innerWidth, stack: `${el.tagName}.${el.className}` });
      }
      return out;
    });
    for (const t of dom) bad.set(`${t.s}|dom`, t);
    await page.waitForTimeout(100);
  }
  for (const t of await page.evaluate(() => window.__texts)) bad.set(`${t.s}|${t.short ? 'court' : 'coupé'}`, t);
  await page.close();
}
for (const [k, t] of bad) console.log(`✗ « ${t.s} » ${t.short ? 'trop court' : `coupé (${t.px0}…${t.px1} / ${t.W})`} — ${t.stack}`);
console.log(bad.size ? `${bad.size} texte(s) fautif(s)` : 'Aucun texte court ni coupé.');
await browser.close(); server.close();
process.exit(bad.size ? 1 : 0);
