// v10.13 : briques communes aux outils capture-1013.mjs, desk-audit.mjs et compare-1013.mjs (démarrage d'une partie, onglets, modes).
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { startServer } from './serve.mjs';
import { audit1016Init } from './audit-1016.mjs'; // v10.16 (B9)
import { audit1017Init } from './audit-1017.mjs'; // v10.17 (D) : styles de bouton
import { audit1018Init } from './audit-1018.mjs'; // v10.18 (2.6, 3.5)
export const { chromium } = createRequire(import.meta.url)('playwright');

export const ALL_TABS = ['inventory', 'upgrades', 'skills', 'tree', 'forge', 'companions', 'camp', 'expeditions', 'campaign', 'dungeons', 'arena', 'tower', 'event', 'summon', 'shop', 'daybook', 'contracts', 'encyclopedia', 'looks', 'boss', 'ranking', 'guild', 'stats', 'options'];
export const PC_SIZES = '1116x993,1366x768,1878x1245,1920x1080';
export const ALL_SIZES = `${PC_SIZES},412x915,390x844`;

export const makeOpt = (argv) => (name, def) => { const i = argv.indexOf(`--${name}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : def; };
export const parseSizes = (s) => s.split(',').map((x) => x.trim()).filter(Boolean).map((x) => x.split('x').map(Number));
export const parseList = (s) => s.split(',').map((x) => x.trim()).filter(Boolean);
export const isPhoneSize = (w) => w <= 600;

export async function startApp() {
  const server = await startServer(0);
  const url = `http://localhost:${server.address().port}/`;
  const browser = await chromium.launch();
  const fixture = JSON.parse(await readFile('tests/fixtures/endgame.json', 'utf8'));
  return { server, url, browser, fixture, close: async () => { await browser.close(); server.close(); } };
}

// Ouvre une page prête (partie de fin `endgame` ou neuve `fresh`).
export async function openGame(app, game, width, height) {
  const phone = isPhoneSize(width);
  const ctx = await app.browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, ...(phone ? { isMobile: true, hasTouch: true } : {}) });
  const page = await ctx.newPage();
  await page.addInitScript(audit1016Init); // v10.16 (B9) : contrôles des libellés et des boutons grisés
  await page.addInitScript(audit1017Init); // v10.17 (D) : styles de bouton
  await page.addInitScript(audit1018Init); // v10.18 (2.6, 3.5) : boutons recouverts, texte générique, sous-onglets sous ✕
  const jsErrors = [];
  page.on('pageerror', (e) => jsErrors.push(e.message));
  if (game === 'endgame') {
    await page.addInitScript((save) => { if (!sessionStorage.getItem('audit')) { localStorage.setItem('idle-rpg.save', save); sessionStorage.setItem('audit', '1'); } }, JSON.stringify(app.fixture));
  } else {
    await page.addInitScript(() => { if (!sessionStorage.getItem('audit')) { localStorage.removeItem('idle-rpg.save'); sessionStorage.setItem('audit', '1'); } });
  }
  await page.goto(app.url);
  await page.waitForFunction(() => window.__idle?.ui, null, { timeout: 30000 });
  await page.waitForTimeout(game === 'endgame' ? 6000 : 3000);
  await page.addStyleTag({ content: '[class*="tuto"], .tour { display: none !important; }' }); // bulles du tutoriel de la partie neuve
  const api = { page, ctx, jsErrors, phone };
  await closeAll(page);
  return api;
}

export const closeAll = (page) => page.evaluate(() => {
  document.querySelectorAll('#modal:not(.hidden) [data-action="close-modal"], #modal:not(.hidden) [data-action="offline-claim"]').forEach((b) => b.click());
  try { __idle.ui.closeModal(); } catch { /* rien */ }
  document.querySelectorAll('.tour button, .howto-card button, .learn-card button').forEach((b) => b.click());
  document.querySelectorAll('.prologue2, #boot, .tour').forEach((e) => e.remove());
});

// Ouvre un onglet ; renvoie true s'il est bien ouvert (sinon : pas encore débloqué).
export async function openTab(page, tab) {
  await page.evaluate((t) => { try { __idle.ui.openTab(t); } catch { /* onglet inconnu */ } }, tab);
  await page.waitForTimeout(1300);
  await closeAll(page);
  return page.evaluate((t) => __idle.ui.tab === t && !document.querySelector('#panel')?.classList.contains('hidden'), tab);
}

// Les modes (sous-vues) d'un onglet ouvert : boutons de bascule du corps du panneau, ou .m-mode du kit. [{ action, value, label }]
export function listModes(page) {
  return page.evaluate(() => {
    const re = /(-tab|-view|-mode|-seg|^shop-cat)$/;
    const seen = new Set(); const out = [];
    for (const b of document.querySelectorAll('#panel-body [data-action], #panel-body .m-modes .m-mode')) {
      const action = b.dataset.action; if (!action || !re.test(action) || action === 'open-tab' || action === 'm-help') continue;
      if (b.closest('#panel-subtabs') || b.getBoundingClientRect().width < 1) continue;
      const value = b.dataset.value ?? b.dataset.id ?? b.dataset.m ?? '';
      const k = `${action}|${value}`; if (seen.has(k)) continue; seen.add(k);
      out.push({ action, value, label: (b.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 20) });
    }
    return out.slice(0, 8);
  });
}

export async function clickMode(page, m) {
  const ok = await page.evaluate((m) => {
    const sel = m.value !== '' ? `#panel-body [data-action="${m.action}"]` : `#panel-body [data-action="${m.action}"]`;
    const el = [...document.querySelectorAll(sel)].find((b) => (b.dataset.value ?? b.dataset.id ?? b.dataset.m ?? '') === m.value && b.getBoundingClientRect().width > 0);
    if (!el) return false; el.click(); return true;
  }, m);
  await page.waitForTimeout(700);
  await closeAll(page);
  return ok;
}

export const slug = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'x';
