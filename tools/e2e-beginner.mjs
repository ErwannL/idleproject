// v9.8 (0) : partie neuve (mini-quêtes actives), le joueur suit le doigt du tutoriel. En moins de 3 minutes :
// le doigt est apparu et une amélioration est achetée ; la consigne de mini-quête est visible. Usage : node tools/e2e-beginner.mjs
import { createRequire } from 'node:module';
import { startServer } from './serve.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const server = await startServer(0);
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1116, height: 993 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(`http://localhost:${server.address().port}/?quests`);
await page.waitForFunction(() => window.__idle?.ui, null, { timeout: 30000 });
let finger = false, bought = false, questBar = false, t0 = Date.now();
while (Date.now() - t0 < 180000 && !(finger && bought)) {
  await page.waitForTimeout(1000);
  const r = await page.evaluate(() => {
    const layer = document.getElementById('tuto-layer');
    const f = layer?.querySelector('.tuto-finger:not([hidden])');
    const target = layer?.target;
    if (f && target) target.click();
    __idle.save?.();
    let s = null; try { s = JSON.parse(localStorage.getItem('idle-rpg.save')); } catch { /* rien */ }
    window.__steps = [...new Set([...(window.__steps ?? []), layer?.dataset.step].filter(Boolean))];
    return { steps: window.__steps, finger: Boolean(f), bought: Object.values(s?.upgrades ?? {}).some((n) => n > 0), bar: !document.getElementById('next-unlock')?.classList.contains('hidden') };
  });
  finger ||= r.finger; bought ||= r.bought; questBar ||= r.bar;
}
const steps = await page.evaluate(() => window.__steps);
const secs = Math.round((Date.now() - t0) / 1000);
console.log(`doigt : ${finger} · amélioration achetée : ${bought} · consigne visible : ${questBar} · ${secs} s · étapes ${steps}`);
if (errors.length) console.log('ERREURS :\n' + errors.join('\n'));
await browser.close(); server.close();
process.exit(finger && bought && questBar && !errors.length ? 0 : 1);
