// v9.2.9 : passe de stabilité de bout en bout (Playwright, version web construite).
// Parcours : nouvelle partie jusqu'au monde 3 (vitesse accélérée), sauvegardes de milieu et de fin de partie,
// visite de chaque menu / sous-onglet / fiche / onglet des Réglages, actions principales (acheter, invoquer sur les
// 3 bannières, équiper, fusionner, Renaissance, Transcendance, classe, thème, langue), hors ligne puis retour,
// migrations depuis des sauvegardes v6, v8 et v9, export puis import, 3 tailles × 3 langues, temps d'image sur
// téléphone simulé (processeur ÷4) et, avec --long, mémoire sur 10 minutes.
// Relevé : erreurs JS et console, promesses rejetées, réponses 404, NaN / undefined / Infinity affichés.
// Les débordements et les textes non traduits ont leurs outils : tools/audit-overflow.cjs et tools/i18n-coverage.mjs.
// Prérequis : `npm run build:web` (dist/web). Usage : node tools/e2e-stabilite.mjs [--long] [--quick] [--only=mot] [dossier]
// Nuage : CLOUD_BASE=http://localhost:8799/play/ (serveur du jeu en local, jamais le vrai serveur).
// Code de sortie 1 si un problème est relevé (sauf ceux de la liste ACCEPTED, connus et transmis).
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { createNewState } from '../src/core/state.js';
import { makeItem } from '../src/core/loot.js';
import { addToInventory } from '../src/core/inventory.js';
import { SAVE_KEY } from '../src/core/save.js';

const require = createRequire(import.meta.url);
let chromium;
for (const p of ['playwright', '/opt/node22/lib/node_modules/playwright']) {
  try { ({ chromium } = require(p)); break; } catch { /* suivant */ }
}
if (!chromium) { console.error('Playwright introuvable : npm i -D playwright && npx playwright install chromium'); process.exit(2); }

const args = process.argv.slice(2);
const LONG = args.includes('--long');
const QUICK = args.includes('--quick');
const ONLY = args.find((a) => a.startsWith('--only='))?.slice(7); // --only=nuage : parcours dont le nom contient ce mot
const outDir = resolve(args.find((a) => !a.startsWith('--')) ?? 'dist/e2e-stabilite');
await mkdir(outDir, { recursive: true });
if (!existsSync(resolve('dist/web/index.html'))) { console.error('dist/web absent : npm run build:web'); process.exit(2); }

// Copie figée de dist/web : un autre `npm run build:web` pendant le parcours ne fait plus échouer les images (404).
const WEB = join(outDir, 'web');
await rm(WEB, { recursive: true, force: true });
await cp(resolve('dist/web'), WEB, { recursive: true });
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2' };
const server = createServer(async (req, res) => {
  let path = normalize(join(WEB, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  if (!path.startsWith(WEB + sep) && path !== WEB) { res.writeHead(403).end(); return; }
  if (path.endsWith(sep) || path === WEB) path = join(path, 'index.html');
  try { const body = await readFile(path); res.writeHead(200, { 'Content-Type': TYPES[extname(path)] ?? 'application/octet-stream' }).end(body); } catch { res.writeHead(404).end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = `http://localhost:${server.address().port}/`;
const browser = await chromium.launch();
const problems = [];
const report = (where, msg) => { const line = `[${where}] ${msg}`; if (!problems.includes(line)) problems.push(line); console.log('  ✘', line); };

// ---------- Sauvegardes de référence (construites avec le code du jeu) ----------
const NOW = Date.now();
function midState() {
  const s = createNewState(NOW - 2 * 86400e3, 7);
  s.maxStage = 75; s.stage = 74; s.records.bestStage = 75; s.records.bossesDefeated = 14; s.level = 120; s.gold = 5e7;
  s.gems = 30000; s.tickets = 40; s.keys = 6; s.ui.tour = 'done'; s.ui.tourV = 2;
  for (const k of Object.keys(s.upgrades)) s.upgrades[k] = 40;
  for (let i = 0; i < 30; i++) addToInventory(s, makeItem(s, 'iron_helm', ['common', 'rare', 'epic'][i % 3], 50 + i));
  for (let i = 0; i < 5; i++) addToInventory(s, makeItem(s, 'iron_helm', 'rare', 60));
  s.companions.owned.cat = { level: 10, stars: 2 }; s.companions.owned.owl = { level: 5, stars: 1 };
  s.fragments = 5000;
  return s;
}
function endState() {
  const s = midState();
  s.maxStage = 420; s.stage = 420; s.records.bestStage = 420; s.records.rebirths = 14; s.level = 300; s.records.bestLevel = 300;
  s.gold = 1e60; s.gems = 1e6; s.fragments = 1e6; s.keys = 50;
  for (const k of Object.keys(s.upgrades)) s.upgrades[k] = 900;
  return s;
}
const asStore = (state) => ({ [SAVE_KEY]: JSON.stringify({ ...state, lastSaved: NOW }), 'idle-rpg.welcome': '1' });
// Anciens formats : champs retirés (structures apparues après) et numéro de format.
function oldFormat(version) {
  const raw = JSON.parse(JSON.stringify(midState()));
  raw.version = version;
  if (version <= 9) { delete raw.economy; delete raw.summon; }
  if (version <= 8) { delete raw.missions; delete raw.contracts; delete raw.codex; delete raw.museum; delete raw.stash; }
  if (version <= 6) { delete raw.heroes; delete raw.companions; delete raw.talents; delete raw.powers; delete raw.records.bestLevel; delete raw.ui; }
  return { [SAVE_KEY]: JSON.stringify(raw) };
}

// ---------- Outils de page ----------
async function newPage(name, { store = null, lang = 'fr', w = 1280, h = 720 } = {}) {
  const mob = w < 600;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: mob, isMobile: mob });
  await ctx.addInitScript(([sv, lg]) => {
    if (sessionStorage.getItem('e2e-seeded')) return;
    sessionStorage.setItem('e2e-seeded', '1');
    if (sv) for (const [k, v] of Object.entries(sv)) localStorage.setItem(k, v);
    localStorage.setItem('idle-rpg.lang', lg);
  }, [store, lang]);
  // Pas de cloud ni de réseau extérieur pendant les parcours.
  await ctx.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
  const page = await ctx.newPage();
  page.on('pageerror', (e) => report(name, `erreur JS : ${e.message}`));
  page.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error' && !/net::ERR_FAILED|ERR_INTERNET_DISCONNECTED|Failed to fetch/.test(t)) report(name, `console : ${t.slice(0, 200)}`);
  });
  page.on('response', (r) => { if (r.status() === 404) report(name, `404 : ${r.url().replace(BASE, '')}`); });
  await page.addInitScript(() => {
    window.addEventListener('unhandledrejection', (e) => console.error('promesse rejetée : ' + (e.reason?.message ?? e.reason)));
  });
  await page.goto(BASE);
  await page.waitForFunction(() => window.__idle?.state, null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  await closeModals(page);
  return { ctx, page };
}
async function closeModals(page) {
  for (let i = 0; i < 6; i++) {
    const c = await page.$('#modal:not(.hidden) [data-action="close-modal"], #modal:not(.hidden) .btn-primary');
    if (!c) break;
    await c.evaluate((n) => n.click()); await page.waitForTimeout(250);
  }
}
// Valeurs cassées affichées (texte visible et attributs lus par l'utilisateur).
async function scanBroken(page, where) {
  const bad = await page.evaluate(() => {
    const out = [];
    const re = /\b(?:NaN|undefined|Infinity|null)\b|\[object Object\]/;
    const w = document.createTreeWalker(document.body, 4);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const el = n.parentElement;
      if (!el || el.closest('script,style,.hidden,[hidden]')) continue;
      if (re.test(n.data)) out.push(`${el.id || el.className || el.tagName} « ${n.data.trim().slice(0, 80)} »`);
    }
    for (const el of document.querySelectorAll('[title],[aria-label],img[alt]')) {
      for (const a of ['title', 'aria-label', 'alt']) { const v = el.getAttribute(a); if (v && re.test(v)) out.push(`@${a} « ${v.slice(0, 80)} »`); }
    }
    if (!window.__e2eNoImg) for (const img of document.querySelectorAll('img')) if (img.complete && img.naturalWidth === 0 && img.src && !img.closest('.hidden')) out.push(`image vide ${img.src.split('/').slice(-2).join('/')}`);
    return out;
  });
  for (const b of bad.slice(0, 8)) report(where, `valeur cassée : ${b}`);
}
const ev = (page, fn, arg) => page.evaluate(fn, arg);
async function shot(page, name) { await page.screenshot({ path: `${outDir}/${name}.png` }).catch(() => {}); }

// Visite de tous les menus, sous-onglets, vues internes (boutons d'onglet du panneau) et fiches.
const VIEW_ACTIONS = ['shop-cat', 'summon-pool', 'item-tab', 'inv-tab', 'enc-sec', 'mission-tab', 'upgrade-cat', 'tree-seg', 'hero-tab', 'rank-sort', 'rank-scope', 'stats-tab', 'event-tab'];
const SHEET_ACTIONS = ['item-sheet', 'show-item', 'companion-sheet', 'show-companion', 'boss-sheet', 'dungeon-sheet', 'skill-sheet', 'talent-sheet', 'open-sheet'];
async function visitAll(page, where, { sheets = true } = {}) {
  const menus = await ev(page, () => [...document.querySelectorAll('#tabs [data-menu]')].map((n) => n.dataset.menu));
  for (const m of menus) {
    await page.$eval(`#tabs [data-menu="${m}"]`, (n) => n.click()).catch(() => {});
    await page.waitForTimeout(300);
    const subs = await ev(page, () => [...document.querySelectorAll('[data-sub]')].filter((n) => n.offsetParent).map((n) => n.dataset.sub));
    for (const s of subs) {
      await ev(page, (t) => __idle.ui.openTab(t), s);
      await page.waitForTimeout(350);
      await scanBroken(page, `${where} ${m}›${s}`);
      for (const act of VIEW_ACTIONS) {
        const vals = await ev(page, (a) => [...document.querySelectorAll(`#panel-body [data-action="${a}"]`)].map((n) => n.dataset.value), act);
        for (const v of [...new Set(vals)].slice(0, 8)) {
          await page.$eval(`#panel-body [data-action="${act}"][data-value="${v}"]`, (n) => n.click()).catch(() => {});
          await page.waitForTimeout(200);
          await scanBroken(page, `${where} ${s}:${act}=${v}`);
        }
      }
      if (!sheets) continue;
      for (const act of SHEET_ACTIONS) {
        const n = await ev(page, (a) => document.querySelectorAll(`#panel-body [data-action="${a}"]`).length, act);
        for (let i = 0; i < Math.min(n, 2); i++) {
          await ev(page, ([a, k]) => document.querySelectorAll(`#panel-body [data-action="${a}"]`)[k]?.click(), [act, i]);
          await page.waitForTimeout(250);
          await scanBroken(page, `${where} ${s}:fiche ${act}`);
          await ev(page, () => document.querySelector('[data-action="close-sheet"]')?.click());
          await closeModals(page);
        }
      }
    }
  }
  // Réglages : tous les onglets.
  await ev(page, () => __idle.ui.openTab('options'));
  await page.waitForTimeout(300);
  for (const t of ['general', 'interface', 'sound', 'window']) {
    await page.$eval(`[data-action="opt-tab"][data-value="${t}"]`, (n) => n.click()).catch(() => {});
    await page.waitForTimeout(250);
    await scanBroken(page, `${where} réglages:${t}`);
  }
  await ev(page, () => { if (__idle.ui.tab) __idle.ui.openTab(__idle.ui.tab); });
}

// Boutons sans effet : clic sur chaque bouton visible d'un écran (hors actions destructrices) ; ni l'état, ni le
// DOM, ni l'écran ne changent → signalé.
const SKIP = /reset|delete|cloud|import|export|rebirth|transcend|respec|close|github|release|window-size|quit|lang|summon|buy|recycle|fuse|sell/;
// Signature sans les nombres (qui bougent à chaque image) : structure du panneau, fenêtre, vue, onglet, réglages.
async function deadButtons(page, where, tab) {
  await ev(page, () => { window.__e2eSig = () => [document.querySelector('#panel-body')?.innerHTML.replace(/[\d.,\s]+/g, ''), document.querySelector('#modal')?.className, document.querySelector('#modal-card')?.innerHTML.length, __idle.ui.tab, JSON.stringify(__idle.ui.view ?? {}), JSON.stringify(__idle.state.ui), document.documentElement.className].join('|'); });
  await ev(page, (t) => __idle.ui.openTab(t), tab);
  await page.waitForTimeout(300);
  const n = await ev(page, () => document.querySelectorAll('#panel-body button[data-action]').length);
  for (let i = 0; i < Math.min(n, 25); i++) {
    const r = await ev(page, ([k, skip]) => {
      const b = document.querySelectorAll('#panel-body button[data-action]')[k];
      if (!b || b.disabled || !b.offsetParent || new RegExp(skip).test(b.dataset.action)) return null;
      const sig = () => window.__e2eSig();
      const before = sig(); b.click();
      return { a: b.dataset.action, v: b.dataset.value ?? '', before, sig };
    }, [i, SKIP.source]);
    if (!r) continue;
    await page.waitForTimeout(250);
    const after = await ev(page, () => window.__e2eSig());
    // Deuxième regard avant de signaler : un clic de script ne compte pas comme geste du joueur, le panneau se
    // redessine alors au plus 1 s après (RENDER_THROTTLE_MS, ui.js).
    if (after === r.before) { await page.waitForTimeout(1300); if ((await ev(page, () => window.__e2eSig())) === r.before) report(where, `bouton sans effet : ${tab} [${r.a}=${r.v}]`); }
    await closeModals(page);
    await ev(page, (t) => { if (__idle.ui.tab !== t) __idle.ui.openTab(t); }, tab);
  }
}

// ---------- Parcours ----------
async function run(name, fn) {
  if (ONLY && !name.includes(ONLY)) return;
  console.log(`▶ ${name}`);
  const before = problems.length;
  try { await fn(); } catch (e) { report(name, `parcours interrompu : ${e.message.split('\n')[0]}`); }
  console.log(problems.length === before ? '  ✔ aucun problème' : `  ${problems.length - before} problème(s)`);
}

await run('nouvelle partie → monde 3', async () => {
  const { ctx, page } = await newPage('nouvelle');
  await closeModals(page);
  const t0 = Date.now();
  const limit = QUICK ? 60e3 : 240e3;
  // Vitesse ×100 et or régulier (achats d'améliorations par le jeu lui-même) : la boucle reste celle du joueur.
  while (Date.now() - t0 < limit) {
    const st = await ev(page, () => {
      const s = __idle.state; s.ui.speed = 100; s.ui.tour = 'done';
      s.gold += 1e3 * 2 ** Math.min(200, s.maxStage / 3);
      for (const k of Object.keys(s.upgrades)) __idle.actions.buy(k, 'max');
      return { stage: s.maxStage, gold: s.gold };
    });
    if (!Number.isFinite(st.gold)) report('nouvelle', `or non fini : ${st.gold}`);
    if (st.stage >= 41) break;
    await closeModals(page);
    await page.waitForTimeout(1000);
  }
  const stage = await ev(page, () => __idle.state.maxStage);
  if (stage < 41 && !QUICK) report('nouvelle', `monde 3 non atteint (étape ${stage})`);
  console.log(`  étape ${stage} en ${Math.round((Date.now() - t0) / 1000)} s`);
  await scanBroken(page, 'nouvelle');
  await shot(page, 'nouvelle-monde3');
  await ctx.close();
});

for (const [label, state] of [['milieu', midState()], ['fin', endState()]]) {
  await run(`sauvegarde de ${label} : visite complète et actions`, async () => {
    const { ctx, page } = await newPage(label, { store: asStore(state) });
    await visitAll(page, label);
    for (const tab of ['upgrades', 'skills', 'tree', 'companions', 'contracts', 'dungeons', 'tower', 'boss', 'expeditions', 'options']) await deadButtons(page, label, tab);
    // Actions principales.
    const r = await ev(page, async () => {
      const a = __idle.actions; const s = __idle.state; const out = {};
      const lv = JSON.stringify(s.upgrades); for (const k of Object.keys(s.upgrades)) a.buy(k, '1'); out.buy = JSON.stringify(s.upgrades) !== lv;
      const it = s.inventory.find((x) => x.slot); if (it) { a.equip(it.id); out.equip = Object.values(s.equipment).some((e) => e?.id === it.id); }
      const len = s.inventory.length; a.fuseAll(); a.fuseAll(); out.fuse = s.inventory.length <= len;
      for (const c of ['warrior', 'mage', 'archer', 'rogue']) a.setHeroClass(c);
      a.setTheme('celestial'); a.setTheme('');
      return out;
    });
    // Invocation sur les 3 bannières, par l'interface (monnaie acceptée par chaque bannière).
    await ev(page, () => __idle.ui.openTab('summon'));
    for (const pool of await ev(page, () => [...new Set([...document.querySelectorAll('#panel-body [data-action="summon-pool"]')].map((n) => n.dataset.value))])) {
      await page.$eval(`#panel-body [data-action="summon-pool"][data-value="${pool}"]`, (n) => n.click());
      await page.waitForTimeout(250);
      const n0 = await ev(page, () => __idle.state.summon.total);
      const clicked = await ev(page, () => { const b = [...document.querySelectorAll('#panel-body [data-action="summon"]')].find((x) => !x.disabled); b?.click(); return !!b; });
      await page.waitForTimeout(1200);
      for (let i = 0; i < 8; i++) { await page.mouse.click(10, 10); await page.waitForTimeout(150); }
      await page.keyboard.press('Escape'); await closeModals(page);
      r[`invocation ${pool}`] = !clicked ? 'aucun bouton actif' : (await ev(page, () => __idle.state.summon.total)) > n0;
      await scanBroken(page, `${label} invocation ${pool}`);
    }
    for (const [k, v] of Object.entries(r)) if (v !== true) report(label, `action ${k} : ${v}`);
    await page.waitForTimeout(800);
    await closeModals(page);
    await scanBroken(page, `${label} après actions`);
    // Renaissance puis Transcendance par l'interface (fenêtres de confirmation).
    for (const [act, conf] of [['rebirth', 'confirm-rebirth'], ['transcend', 'confirm-transcend']]) {
      await ev(page, () => __idle.ui.openTab('tree'));
      await page.waitForTimeout(300);
      const shown = await ev(page, ([x, c]) => { const ui = __idle.ui; if (x === 'rebirth') ui.showRebirthConfirm(ui.state); else ui.showTranscendConfirm(ui.state); return !!document.querySelector(`#modal:not(.hidden) [data-action="${c}"]`); }, [act, conf]);
      await scanBroken(page, `${label} fenêtre ${act}`);
      if (shown) {
        await page.$eval(`#modal [data-action="${conf}"]`, (n) => n.click()).catch(() => {});
        await page.waitForTimeout(800); await closeModals(page);
        await scanBroken(page, `${label} après ${act}`);
      }
    }
    // Langues : changement en cours de partie.
    for (const lg of ['en', 'ko', 'fr']) {
      await ev(page, (l) => __idle.actions.setLanguage?.(l), lg);
      await page.waitForTimeout(1500);
      await page.waitForFunction(() => window.__idle?.state, null, { timeout: 20000 }).catch(() => {});
      await closeModals(page);
      await scanBroken(page, `${label} langue ${lg}`);
    }
    await shot(page, `${label}-fin`);
    await ctx.close();
  });
}

await run('hors ligne puis retour', async () => {
  const s = midState(); s.lastSaved = NOW - 6 * 3600e3;
  const store = { [SAVE_KEY]: JSON.stringify(s) };
  const mob = false;
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, hasTouch: mob });
  await ctx.addInitScript((sv) => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', '1'); for (const [k, v] of Object.entries(sv)) localStorage.setItem(k, v); } }, store);
  await ctx.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
  const page = await ctx.newPage();
  page.on('pageerror', (e) => report('hors ligne', `erreur JS : ${e.message}`));
  await page.goto(BASE);
  await page.waitForFunction(() => window.__idle?.state, null, { timeout: 30000 });
  await page.waitForTimeout(2000);
  const modal = await ev(page, () => !document.querySelector('#modal')?.classList.contains('hidden'));
  if (!modal) report('hors ligne', 'pas de fenêtre de retour après 6 h d\'absence');
  await scanBroken(page, 'hors ligne fenêtre');
  await shot(page, 'hors-ligne-retour');
  // Réseau coupé en cours de partie, puis rétabli.
  await ctx.setOffline(true);
  await ev(page, () => { window.__e2eNoImg = true; });
  await visitAll(page, 'réseau coupé', { sheets: false });
  await ev(page, () => { window.__e2eNoImg = false; });
  await ctx.setOffline(false);
  await page.reload(); await page.waitForTimeout(2000); await closeModals(page);
  await scanBroken(page, 'réseau rétabli');
  await ctx.close();
});

await run('migrations v6 / v8 / v9, export et import', async () => {
  for (const v of [6, 8, 9]) {
    const { ctx, page } = await newPage(`migration v${v}`, { store: oldFormat(v) });
    const st = await ev(page, () => ({ v: __idle.state.version, src: __idle.loadSource, stage: __idle.state.maxStage, gold: __idle.state.gold }));
    if (st.stage !== 75 || !Number.isFinite(st.gold)) report(`migration v${v}`, `partie mal reprise : ${JSON.stringify(st)}`);
    await visitAll(page, `migration v${v}`, { sheets: false });
    await ctx.close();
  }
  const { ctx, page } = await newPage('export', { store: asStore(midState()) });
  const res = await ev(page, async () => {
    const before = JSON.stringify({ g: __idle.state.gold, s: __idle.state.maxStage });
    const json = JSON.stringify(__idle.state);
    const code = btoa(unescape(encodeURIComponent(json)));
    __idle.state.gold = 1;
    await __idle.actions.importSave(code);
    return { before, after: JSON.stringify({ g: __idle.state.gold, s: __idle.state.maxStage }) };
  });
  await page.waitForTimeout(2500);
  const after = await ev(page, () => JSON.stringify({ g: window.__idle?.state?.gold, s: window.__idle?.state?.maxStage })).catch(() => res.after);
  if (JSON.parse(after).s !== JSON.parse(res.before).s) report('import', `étape perdue : ${res.before} → ${after}`);
  await ctx.close();
});

// Nuage en local : seulement avec CLOUD_BASE (serveur du jeu lancé sur cette machine, ex.
// PORT=8799 GAME_WEB=1 DB_FILE=/tmp/x.sqlite node server/index.mjs → CLOUD_BASE=http://localhost:8799/play/).
const CLOUD_BASE = process.env.CLOUD_BASE;
if (CLOUD_BASE && /^http:\/\/(localhost|127\.0\.0\.1)[:/]/.test(CLOUD_BASE)) {
  await run('nuage en local : compte, envoi, reprise sur un autre appareil', async () => {
    const pseudo = `e2e${Date.now().toString(36)}`; const pass = 'motdepasse-e2e-1';
    const open = async (store) => {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
      if (store) await ctx.addInitScript((sv) => { if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x', '1'); for (const [k, v] of Object.entries(sv)) localStorage.setItem(k, v); } }, store);
      const page = await ctx.newPage();
      page.on('pageerror', (e) => report('nuage', `erreur JS : ${e.message}`));
      await page.goto(CLOUD_BASE); await page.waitForFunction(() => window.__idle?.state, null, { timeout: 30000 }); await page.waitForTimeout(1500);
      await closeModals(page);
      return { ctx, page };
    };
    const a = await open(asStore(midState()));
    await ev(a.page, ([u, pw]) => __idle.actions.cloudRegister(u, pw), [pseudo, pass]);
    await a.page.waitForTimeout(3000);
    await ev(a.page, () => { __idle.state.maxStage = 77; __idle.state.stage = 77; __idle.actions.cloudSync(); });
    await a.page.waitForTimeout(3000);
    await scanBroken(a.page, 'nuage envoi');
    await a.ctx.close();
    const b = await open(null);
    await ev(b.page, ([u, pw]) => __idle.actions.cloudLogin(u, pw), [pseudo, pass]);
    await b.page.waitForTimeout(4000);
    await closeModals(b.page);
    const got = await ev(b.page, () => window.__idle?.state?.maxStage);
    if (got !== 77) report('nuage', `partie reprise à l'étape ${got} au lieu de 77`);
    await b.ctx.close();
  });
}

if (!QUICK) {
  for (const [w, h] of [[375, 812], [1280, 720], [1920, 1080]]) {
    for (const lang of ['fr', 'en', 'ko']) {
      await run(`${w}×${h} ${lang}`, async () => {
        const { ctx, page } = await newPage(`${w} ${lang}`, { store: asStore(midState()), lang, w, h });
        await visitAll(page, `${w} ${lang}`, { sheets: lang === 'fr' });
        await shot(page, `taille-${w}-${lang}`);
        await ctx.close();
      });
    }
  }
}

await run('temps d\'image : téléphone simulé, processeur ÷4', async () => {
  const { ctx, page } = await newPage('perf', { store: asStore(midState()), w: 375, h: 812 });
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const stats = await ev(page, () => new Promise((done) => {
    const t = []; let last = performance.now(); const end = last + 8000;
    const f = (ts) => { t.push(ts - last); last = ts; if (ts < end) requestAnimationFrame(f); else done(t); };
    requestAnimationFrame(f);
  }));
  stats.sort((a, b) => a - b);
  const p50 = stats[Math.floor(stats.length / 2)]; const p95 = stats[Math.floor(stats.length * 0.95)];
  console.log(`  images ${stats.length} · médiane ${p50.toFixed(1)} ms · 95e centile ${p95.toFixed(1)} ms · pire ${stats.at(-1).toFixed(0)} ms`);
  await writeFile(`${outDir}/perf.json`, JSON.stringify({ p50, p95, worst: stats.at(-1), n: stats.length }));
  if (p95 > 100) report('perf', `95e centile du temps d'image ${p95.toFixed(0)} ms (> 100 ms)`);
  await ctx.close();
});

await run(`mémoire sur ${LONG ? 10 : 1} minute(s)`, async () => {
  const { ctx, page } = await newPage('mémoire', { store: asStore(midState()) });
  const cdp = await ctx.newCDPSession(page);
  const heap = async () => { await cdp.send('HeapProfiler.collectGarbage'); return (await cdp.send('Runtime.getHeapUsage')).usedSize / 1e6; };
  const tabs = ['inventory', 'upgrades', 'summon', 'shop', 'campaign', 'stats'];
  const samples = [await heap()];
  const minutes = LONG ? 10 : 1;
  for (let m = 0; m < minutes; m++) {
    for (let i = 0; i < 12; i++) { await ev(page, (t) => __idle.ui.openTab(t), tabs[i % tabs.length]); await page.waitForTimeout(5000); }
    samples.push(await heap());
  }
  console.log(`  tas (Mo) : ${samples.map((x) => x.toFixed(1)).join(' → ')}`);
  await writeFile(`${outDir}/memoire.json`, JSON.stringify(samples));
  const growth = samples.at(-1) - samples[1 <= samples.length - 1 ? 1 : 0];
  if (LONG && growth > 20) report('mémoire', `+${growth.toFixed(1)} Mo de tas en ${minutes} min`);
  await ctx.close();
});

await browser.close();
server.close();
await writeFile(`${outDir}/problemes.txt`, problems.join('\n') + '\n');
console.log(`\n${problems.length} problème(s) — détail : ${outDir}/problemes.txt`);
process.exit(problems.length ? 1 : 0);
