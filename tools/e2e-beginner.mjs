// v9.8 (0) / v9.10 (4) : partie neuve (mini-quêtes actives), le joueur ne touche que ce que montrent le doigt du tutoriel et le Sceau.
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
const traceLog = [];
let finger = false, bought = false, questBar = false, equipAt = 0, t0 = Date.now();
while (Date.now() - t0 < 180000 && !(finger && bought && equipAt)) {
  await page.waitForTimeout(1000);
  const r = await page.evaluate(() => {
    const layer = document.getElementById('tuto-layer');
    const f = layer?.querySelector('.tuto-finger:not([hidden])');
    const target = layer?.target;
    if (f && target) target.click();
    // Le Sceau avec son doigt visible (et la bulle du premier objet) : on les touche aussi.
    const seal = document.querySelector('#next-action:not(.hidden)');
    if (seal && !seal.querySelector('.na-finger')?.classList.contains('hidden')) seal.click();
    document.querySelector('.best-card.first-item button')?.click();
    __idle.save?.();
    let s = null; try { s = JSON.parse(localStorage.getItem('idle-rpg.save')); } catch { /* rien */ }
    window.__steps = [...new Set([...(window.__steps ?? []), layer?.dataset.step].filter(Boolean))];
    // v10.3.1 : trace de diagnostic (affichée si la mini-quête n'est pas finie) : où en est la partie, qu'est-ce qui est à l'écran.
    const shown = (sel) => [...document.querySelectorAll(sel)].filter((e) => e.offsetParent !== null).map((e) => e.className.split(' ')[0]);
    const q = window.__idle.ui.state && window.__idle.ui.sealWhy;
    const trace = { kills: s?.records?.kills ?? 0, found: s?.records?.itemsFound ?? 0, equips: s?.records?.equips ?? 0, worn: Object.values(s?.equipment ?? {}).filter(Boolean).length,
      bag: s?.inventory?.length ?? 0, lootBag: s?.lootBag?.length ?? 0, done: (s?.unlocks?.done ?? []).join(), tab: window.__idle.ui.tab, step: layer?.dataset.step ?? '', finger: Boolean(f), fingerTarget: target?.id || target?.className?.toString().slice(0, 30) || '',
      seal: seal && !seal.classList.contains('hidden') ? `${seal.dataset.kind}:${document.getElementById('next-action-text')?.textContent}` : (q ? `caché(${q.n}${q.busy ? ',occupé' : ''})` : '—'), cards: shown('.howto-card, .learn-card, .best-card, .res-bubble, #prologue, .tour'), modal: !document.getElementById('modal')?.classList.contains('hidden'), sealFinger: Boolean(seal && !seal.querySelector('.na-finger')?.classList.contains('hidden')) };
    return { trace, steps: window.__steps, finger: Boolean(f), bought: Object.values(s?.upgrades ?? {}).some((n) => n > 0), bar: !document.getElementById('next-unlock')?.classList.contains('hidden'), equip: (s?.unlocks?.done ?? []).includes('equipment') };
  });
  if (Math.round((Date.now() - t0) / 1000) % 10 === 0 || r.equip) traceLog.push(`${Math.round((Date.now() - t0) / 1000)} s ${JSON.stringify(r.trace)}`);
  if (r.equip && !equipAt) equipAt = Math.round((Date.now() - t0) / 1000);
  finger ||= r.finger; bought ||= r.bought; questBar ||= r.bar;
}
const steps = await page.evaluate(() => window.__steps);
const secs = Math.round((Date.now() - t0) / 1000);
console.log(`doigt : ${finger} · amélioration achetée : ${bought} · consigne visible : ${questBar} · mini-quête Équipement finie à ${equipAt} s · ${secs} s · étapes ${steps}`);
if (!equipAt || process.argv.includes('--trace')) console.log('TRACE (toutes les ~10 s) :\n' + traceLog.join('\n'));
if (errors.length) console.log('ERREURS :\n' + errors.join('\n'));
await browser.close(); server.close();
// v10.1 (P1) : la consigne de mini-quête attend l'étape 3 (un seul appel à l'action au début) : plus exigée ici.
process.exit(finger && bought && equipAt > 0 && equipAt <= 120 && !errors.length ? 0 : 1);
