// Captures de l'onglet « Site » de l'admin sur une base de démonstration (voir tools/seed-site-stats.mjs).
// Usage : NODE_PATH=<dossier des modules globaux> node tools/capture-site-stats.mjs <base.sqlite> <dossier-sortie> [chemin-chrome]
// Lance le serveur en local (mot de passe admin fictif, rien n'est envoyé nulle part), se connecte, ouvre l'onglet et
// capture la page entière en 1366x768 et en 390x844 (téléphone).
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { startServer } from '../server/index.mjs';
import { hashPassword } from '../server/app.mjs';

const { chromium } = createRequire(import.meta.url)('playwright');
const [dbFile, out = 'captures', chrome = process.env.CHROME_PATH] = process.argv.slice(2);
if (!dbFile) { console.error('Usage : node tools/capture-site-stats.mjs <base.sqlite> <dossier-sortie> [chemin-chrome]'); process.exit(1); }
mkdirSync(out, { recursive: true });
const server = startServer({ port: 0, dbFile: resolve(dbFile), adminPasswordHash: await hashPassword('demo-admin-pass'), uploadsDir: resolve(out, 'uploads') });
await new Promise((r) => (server.listening ? r() : server.once('listening', r)));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch(chrome ? { executablePath: chrome, args: ['--no-sandbox'] } : {});
const errors = [];
for (const [name, w, h] of [['desktop', 1366, 768], ['mobile', 390, 844]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, timezoneId: 'Europe/Paris', locale: 'fr-FR' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${name}: ${m.text()}`); });
  await page.goto(`${base}/admin/`);
  await page.fill('#username', 'erwann');
  await page.fill('#password', 'demo-admin-pass');
  await page.click('#login-btn');
  await page.waitForSelector('#view-app:not(.hidden)');
  await page.click('[data-tab="site"]');
  await page.waitForSelector('#ss-body .ss-kpis', { timeout: 20000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${out}/site-${name}-top.png` });
  await page.screenshot({ path: `${out}/site-${name}-full.png`, fullPage: true });
  if (name === 'desktop') {
    // Générateur de liens : un préréglage, un nom de campagne, une variante -> l'adresse complète à copier.
    await page.click('.ss-chip[data-p="youtube_shorts"]');
    await page.fill('#ss-gen input[aria-label="utm_campaign"]', 'Shorts Décembre');
    await page.fill('#ss-gen input[aria-label="utm_content"]', 'short-09');
    console.log('Lien généré :', await page.textContent('#ss-gen-url'));
    await page.locator('#ss-gen').screenshot({ path: `${out}/site-${name}-generateur.png` });
  }
  await ctx.close();
}
await browser.close();
server.close();
console.log(errors.length ? `Erreurs :\n${errors.join('\n')}` : 'Aucune erreur de console.');
process.exit(0);
