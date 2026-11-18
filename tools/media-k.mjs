// Photos et vidéos des nouveautés (9.9) : node tools/media-k.mjs <sortie>
import { createRequire } from 'node:module';
import { readFile, mkdir, rename, readdir } from 'node:fs/promises';
import { startServer } from './serve.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const out = process.argv[2] ?? 'docs/media-9.9';
await mkdir(`${out}/photos`, { recursive: true }); await mkdir(`${out}/videos`, { recursive: true });
const server = await startServer(0);
const url = `http://localhost:${server.address().port}/`;
const browser = await chromium.launch();
const raw = await readFile('tests/fixtures/endgame.json', 'utf8');
const S = { width: 1116, height: 993 };
async function session(name, { fixture = true, q = '', video = false, size = S } = {}) {
  const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: 1, ...(video ? { recordVideo: { dir: `${out}/videos/tmp-${name}`, size } } : {}) });
  const page = await ctx.newPage();
  if (fixture) await page.addInitScript((r) => { if (!sessionStorage.getItem('m')) { localStorage.setItem('idle-rpg.save', r); sessionStorage.setItem('m', '1'); } }, raw);
  await page.goto(url + q);
  await page.waitForFunction(() => window.__idle?.ui, null, { timeout: 30000 });
  await page.waitForTimeout(fixture ? 8500 : 2500);
  await page.evaluate(() => document.querySelectorAll('#modal:not(.hidden) [data-action="close-modal"], #modal:not(.hidden) [data-action="offline-claim"]').forEach((b) => b.click()));
  return { page, ctx };
}
const shot = (page, n) => page.screenshot({ path: `${out}/photos/${n}.png` });
const ev = (page, f, a) => page.evaluate(f, a);
const wait = (page, ms) => page.waitForTimeout(ms);
async function finish(ctx, page, name) {
  const v = page.video(); await ctx.close();
  if (v) { const p = await v.path(); await rename(p, `${out}/videos/${name}.webm`); }
}

// --- Photos -----------------------------------------------------------------------------------------------
{
  const { page, ctx } = await session('photos');
  await shot(page, '01-scene-sceau-d-action');
  await ev(page, () => __idle.ui.toggleMenu('hero')); await wait(page, 900); await shot(page, '02-panneau-du-bas-heros');
  await ev(page, () => { __idle.ui.togglePanelLow(); }); await wait(page, 900); await shot(page, '03-panneau-deplie');
  await ev(page, () => { __idle.ui.togglePanelLow(); __idle.ui.openTab('upgrades'); }); await wait(page, 900); await shot(page, '04-ameliorations-avant-apres');
  await ev(page, () => __idle.ui.openTab('tree')); await wait(page, 900); await shot(page, '05-talents-3-cartes');
  await ev(page, () => __idle.ui.openTab('skills')); await wait(page, 900); await shot(page, '06-competences-icones-et-silhouettes');
  await ev(page, () => __idle.ui.closePanel()); await wait(page, 400);
  await ev(page, () => __idle.ui.openDrawer()); await wait(page, 700); await shot(page, '07-tiroir');
  await ev(page, () => { __idle.ui.closeModal(); __idle.ui.mentorScreen('Défaite', 'Record : étape 1-1 ×3', { element: 'green' }); }); await wait(page, 800); await shot(page, '08-conseil-du-mentor');
  await ev(page, () => { __idle.ui.closeModal(); __idle.ui.showRift(false); }); await wait(page, 900); await shot(page, '09-faille-du-jour');
  await ev(page, () => { __idle.ui.closeModal(); __idle.ui.bestItemCard(__idle.state.inventory[0] ?? Object.values(__idle.state.equipment).find(Boolean)); }); await wait(page, 600); await shot(page, '10-carte-meilleur-objet');
  await ev(page, () => __idle.ui.showEncounter({ icon: 'icon_star', title: 'Sanctuaire de route', text: 'Un autel ancien brille au bord du chemin.', options: [{ label: 'Prier', gain: '+20 % dégâts · 10 min', safe: true }, { label: 'Offrir 40 gemmes', gain: '+60 % or · 15 min', cost: '−40 gemmes' }] })); await wait(page, 700); await shot(page, '11-rencontre-de-route');
  await ev(page, () => { document.querySelector('.road-bubble')?.remove(); __idle.ui.openTab('daybook'); }); await wait(page, 900); await shot(page, '12-carnet-du-jour');
  await ev(page, () => { __idle.ui.closePanel(); __idle.ui.openTab('companions'); }); await wait(page, 700);
  await page.click('[data-action="companion-sel"][data-value="azure_paladin"]').catch(() => {}); await wait(page, 900); await shot(page, '13-eveil-paladin-d-azur');
  await ev(page, () => __idle.ui.closePanel()); await page.click('[data-action="companion-sel"][data-value="squire"]').catch(() => {});
  await ev(page, () => { __idle.ui.view.sheetOpen = null; __idle.ui.openTab('hero'); }); await wait(page, 900); await shot(page, '14-rangs-du-heros');
  await ev(page, () => { __idle.ui.closePanel(); __idle.ui.showOffline({ elapsedSeconds: 3 * 3600 + 720, totalGold: 4.2e93, xp: 2.1e40, gems: 48, materials: { shards: 30 }, items: [], kills: 9200, stage: 25, autoRecycledCount: 0, excessDrops: 0, capped: false, levelsGained: 2 }); }); await wait(page, 1400); await shot(page, '15-recit-du-camp');
  await ev(page, () => { __idle.ui.closeModal(); __idle.ui.sleepMode(true); }); await wait(page, 1500); await shot(page, '16-veillee-au-camp');
  await ev(page, () => __idle.ui.sleepMode(false)); await wait(page, 600);
  await ev(page, () => { const s = __idle.state; s.keys = 3; s.dungeon = null; __idle.ui.actions.enterDungeon('crypt', 'any', 'gold', 'easy'); });
  await page.waitForFunction(() => document.querySelectorAll('.boon-card').length === 3, null, { timeout: 90000 }).catch(() => {});
  await wait(page, 500); await shot(page, '17-benedictions-de-donjon');
  await ctx.close();
}
{ // Partie neuve : carte « Prochaine étape », Sceau, Carnet de l'Apprenti, 5 onglets avec cadenas
  const { page, ctx } = await session('neuve', { fixture: false, q: '?quests' });
  await wait(page, 4000); await shot(page, '18-partie-neuve-premiere-minute');
  await ev(page, () => __idle.ui.openTab('daybook')); await wait(page, 900); await shot(page, '19-carnet-de-l-apprenti');
  await ctx.close();
}
{ // Téléphone
  const { page, ctx } = await session('tel', { size: { width: 400, height: 860 } });
  await shot(page, '20-telephone-scene');
  await ev(page, () => __idle.ui.toggleMenu('hero')); await wait(page, 900); await shot(page, '21-telephone-panneau-du-bas');
  await ctx.close();
}

// --- Vidéos -----------------------------------------------------------------------------------------------
{ // 1. Panneau du bas, 5 onglets, tiroir, Sceau
  const { page, ctx } = await session('v1', { video: true });
  for (const m of ['hero', 'team', 'adventure', 'summon', 'shop']) { await ev(page, (x) => __idle.ui.toggleMenu(x), m); await wait(page, 1800); }
  await ev(page, () => __idle.ui.togglePanelLow()); await wait(page, 1800); await ev(page, () => __idle.ui.togglePanelLow()); await wait(page, 1000);
  await page.keyboard.press('Escape'); await wait(page, 1200);
  await ev(page, () => __idle.ui.openDrawer()); await wait(page, 2200); await ev(page, () => __idle.ui.closeModal()); await wait(page, 1500);
  await finish(ctx, page, '01-panneau-du-bas-et-onglets');
}
{ // 2. Partie neuve : le doigt, la carte Prochaine étape, le Sceau, la carte Meilleur objet
  const { page, ctx } = await session('v2', { fixture: false, q: '?quests', video: true });
  for (let i = 0; i < 40; i++) {
    await wait(page, 1000);
    await ev(page, () => { const l = document.getElementById('tuto-layer'); if (l?.target) l.target.click(); const c = document.querySelector('.best-card button'); if (c) c.click();
      const n = document.querySelector('#next-action:not(.hidden)'); if (n && Math.random() < 0.3) n.click(); document.querySelectorAll('#modal:not(.hidden) [data-action="close-modal"]').forEach((b) => b.click()); });
  }
  await finish(ctx, page, '02-premieres-minutes-guidees');
}
{ // 3. Donjon et bénédictions
  const { page, ctx } = await session('v3', { video: true });
  await ev(page, () => { const s = __idle.state; s.keys = 3; s.dungeon = null; __idle.ui.actions.enterDungeon('crypt', 'any', 'gold', 'easy'); });
  await page.waitForFunction(() => document.querySelectorAll('.boon-card').length === 3, null, { timeout: 90000 }).catch(() => {});
  await wait(page, 2500); await page.click('.boon-card[data-value="1"]').catch(() => {}); await wait(page, 8000);
  await finish(ctx, page, '03-donjon-benedictions');
}
{ // 4. Faille du jour : carte puis combat
  const { page, ctx } = await session('v4', { video: true });
  await ev(page, () => __idle.ui.showRift(false)); await wait(page, 2500);
  await page.click('[data-action="titan-start-modal"]').catch(() => {}); await wait(page, 25000);
  await page.click('.wb-skip').catch(() => {}); await wait(page, 4000);
  await finish(ctx, page, '04-faille-du-jour');
}
{ // 5. Défaite et Conseil du mentor, rencontre de route, Veillée
  const { page, ctx } = await session('v5', { video: true });
  await ev(page, () => __idle.ui.mentorScreen('Défaite', 'Record : étape 1-1 ×3', { element: 'green' })); await wait(page, 2500);
  await page.click('.mentor-card[data-value="0"]').catch(() => {}); await wait(page, 3500);
  await ev(page, () => { __idle.ui.closePanel(); __idle.ui.showEncounter({ icon: 'icon_chest', title: 'Coffre piégé', text: 'Un coffre luit sous les ronces… un piège ?', options: [{ label: 'Laisser', gain: 'Rien', safe: true }, { label: 'Ouvrir', gain: '60 % : 40 gemmes', cost: '40 % : −15 % PV · 3 min' }] }); }); await wait(page, 3500);
  await ev(page, () => { document.querySelector('.road-bubble')?.remove(); __idle.ui.sleepMode(true); }); await wait(page, 4000); await ev(page, () => __idle.ui.sleepMode(false)); await wait(page, 2500);
  await finish(ctx, page, '05-mentor-rencontre-veillee');
}
await browser.close(); server.close();
for (const d of await readdir(`${out}/videos`)) if (d.startsWith('tmp-')) { /* dossiers vides */ }
console.log('fini');
