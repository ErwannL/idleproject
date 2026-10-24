// Test de bout en bout dans un vrai navigateur (Chromium via Playwright).
// Vérifie les critères d'acceptation du prototype et enregistre des captures.
// Prérequis : Playwright installé (`npm i -D playwright && npx playwright install chromium`).
// Usage : npm run smoke [-- dossier-captures]
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { startServer } from './serve.mjs';

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  console.error('Playwright introuvable : npm i -D playwright && npx playwright install chromium');
  process.exit(2);
}

const outDir = resolve(process.argv[2] ?? 'docs/screenshots');
await mkdir(outDir, { recursive: true });

const server = await startServer(0);
const url = `http://localhost:${server.address().port}/`;
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 400, height: 250 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console: ${m.text()}`);
});

const results = [];
async function check(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`  ✔ ${name}`);
  } catch (error) {
    results.push({ name, ok: false, error });
    console.log(`  ✘ ${name}\n      ${error.message}`);
  }
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
const game = (fn, arg) => page.evaluate(fn, arg);
const waitFor = (fn, timeout = 20000, arg) => page.waitForFunction(fn, arg, { timeout, polling: 100 });
function shiftSaveOnNextLoad(deltaMs, flag) {
  return page.addInitScript(([delta, name]) => {
    if (sessionStorage.getItem(name)) return;
    sessionStorage.setItem(name, '1');
    const raw = JSON.parse(localStorage.getItem('idle-rpg.save'));
    raw.lastSaved += delta;
    localStorage.setItem('idle-rpg.save', JSON.stringify(raw));
  }, [deltaMs, flag]);
}

console.log(`Test de fumée sur ${url}`);
await page.goto(url);

await check('le jeu démarre et affiche la scène de combat', async () => {
  await waitFor(() => window.__idle && document.querySelector('#scene').width > 0, 5000);
  const size = await game(() => [document.querySelector('#scene').width, document.querySelector('#scene').height]);
  assert(size[0] >= 120 && size[1] >= 96, `canvas ${size}`);
});

await check('le héros attaque automatiquement, les ennemis meurent et donnent de l’or', async () => {
  await waitFor(() => __idle.state.records.kills >= 2 && __idle.state.gold > 0);
  await page.screenshot({ path: `${outDir}/compact-combat.png` });
});

await check('acheter une amélioration avec l’or', async () => {
  await game(() => { __idle.state.gold += 500; });
  await page.click('#tabs button[data-tab="upgrades"]');
  const before = await game(() => __idle.state.upgrades.damage);
  await page.click('[data-action="buy"][data-key="damage"]');
  const after = await game(() => __idle.state.upgrades.damage);
  assert(after === before + 1, `niveau ${before} -> ${after}`);
  await page.screenshot({ path: `${outDir}/compact-upgrades.png` });
});

await check('ouvrir l’inventaire, équiper un objet et voir les stats changer', async () => {
  const item = await game(() => __idle.addRandomItem('epic'));
  await page.click('#tabs button[data-tab="inventory"]');
  await page.click(`.inv-grid [data-id="${item.id}"]`);
  await page.waitForSelector('.item-detail');
  const before = await game(() => JSON.stringify(__idle.state.equipment));
  await page.screenshot({ path: `${outDir}/compact-inventory.png` });
  await page.click(`.item-detail [data-action="equip"]`);
  const equipped = await game((id) => Object.values(__idle.state.equipment).some((i) => i && i.id === id), item.id);
  const after = await game(() => JSON.stringify(__idle.state.equipment));
  assert(equipped && before !== after, 'objet non équipé');
  await page.click(`.equipped-row [data-id="${item.id}"]`);
  await page.waitForSelector('.item-detail');
  const text = await page.textContent('.item-detail');
  assert(text.includes('équipé'), 'détail équipé absent');
});

await check('recycler un objet contre de l’or', async () => {
  const item = await game(() => __idle.addRandomItem('rare'));
  await page.click(`.inv-grid [data-id="${item.id}"]`);
  const gold = await game(() => __idle.state.gold);
  await page.click('.item-detail [data-action="recycle"]');
  const after = await game(() => __idle.state.gold);
  const still = await game((id) => __idle.state.inventory.some((i) => i.id === id), item.id);
  assert(after > gold && !still, `or ${gold} -> ${after}`);
});

await check('un boss apparaît au palier et donne une récompense', async () => {
  await game(() => {
    __idle.state.upgrades.damage = 60;
    __idle.state.maxStage = Math.max(__idle.state.maxStage, 5);
    __idle.state.autoAdvance = false;
  });
  await page.click('#tabs button[data-tab="campaign"]');
  await page.click('.stage-grid [data-stage="5"]');
  await waitFor(() => __idle.world.enemies.some((e) => e.boss), 10000);
  await page.click('#panel-close');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${outDir}/compact-boss.png` });
  const found = await game(() => __idle.state.records.itemsFound);
  await waitFor(() => __idle.state.records.bossesDefeated >= 1, 20000);
  const after = await game(() => __idle.state.records.itemsFound);
  assert(after > found, 'aucun objet garanti');
});

await check('la progression est sauvegardée et restaurée après relance', async () => {
  const before = await game(() => ({ gold: __idle.state.gold, damage: __idle.state.upgrades.damage, inv: __idle.state.inventory.length }));
  await page.reload();
  await waitFor(() => window.__idle, 5000);
  const after = await game(() => ({ gold: __idle.state.gold, damage: __idle.state.upgrades.damage, inv: __idle.state.inventory.length }));
  assert(after.damage === before.damage && after.inv >= before.inv && after.gold >= before.gold - 1, JSON.stringify({ before, after }));
});

await check('le calcul hors ligne affiche un résumé cohérent après une absence', async () => {
  // Absence simulée : avant le rechargement suivant (et après la sauvegarde de sortie),
  // on recule l'horodatage de la sauvegarde de 3 h.
  await shiftSaveOnNextLoad(-3 * 3600 * 1000, 'back');
  const gold = await game(() => __idle.state.gold);
  await page.reload();
  await page.waitForSelector('#modal:not(.hidden)', { timeout: 10000 });
  const text = await page.textContent('#modal-card');
  assert(text.includes('Bon retour') && text.includes('3 h'), text);
  const after = await game(() => __idle.state.gold);
  assert(after > gold, `or ${gold} -> ${after}`);
  await page.screenshot({ path: `${outDir}/compact-offline.png` });
  await page.click('[data-action="close-modal"]');
});

await check('horloge reculée : aucun gain', async () => {
  await shiftSaveOnNextLoad(24 * 3600 * 1000, 'forward');
  const gold = await game(() => __idle.state.gold);
  await page.reload();
  await page.waitForSelector('#modal:not(.hidden)', { timeout: 10000 });
  const text = await page.textContent('#modal-card');
  assert(text.includes('Horloge incohérente'), text);
  const after = await game(() => __idle.state.gold);
  assert(after <= gold + 50, `or ${gold} -> ${after}`);
  await page.click('[data-action="close-modal"]');
});

await check('l’interface s’adapte au redimensionnement', async () => {
  for (const [w, h] of [[320, 200], [400, 250], [900, 560]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(300);
    const overflow = await game(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    assert(!overflow, `débordement horizontal à ${w}×${h}`);
  }
  const wide = await game(() => document.querySelector('#app').classList.contains('layout-wide'));
  assert(wide, 'disposition large non activée');
  await page.click('#tabs button[data-tab="hero"]');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${outDir}/wide.png` });
});

await check('aucune erreur JavaScript', async () => {
  assert(errors.length === 0, errors.join('\n'));
});

await browser.close();
server.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} vérifications réussies. Captures : ${outDir}`);
process.exit(failed.length ? 1 : 0);
