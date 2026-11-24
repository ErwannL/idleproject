// v10.13 (§ 11) : contrôle automatique « vrai jeu sur PC » : ouvre chaque onglet, chaque mode, une fiche d'objet, une fiche de compagnon
// et l'écran de combat, en 1116x993, 1366x768, 1878x1245 et 1920x1080, partie de fin et partie neuve, et vérifie 9 choses.
//   node tools/desk-audit.mjs [--sizes 1116x993,1366x768,1878x1245,1920x1080] [--tabs inventory,skills,…] [--games endgame,fresh]
//                             [--out docs/screenshots/v10.13/apres] [--no-shots] [--quiet]
// Contrôles :
//   1 pas de défilement horizontal, et le contenu est centré dans le cadre (marge gauche et droite à 24 px près)
//   2 aucun chevauchement de plus de 2 px entre deux éléments visibles (boutons, cartes, #zone-card, rangée d'événements, console du bas)
//   3 chaque image d'événement est entièrement dans son cadre (rangée #hq-events)
//   4 chaque onglet a un cartouche de titre (.m-title) et au plus un bouton doré visible
//   5 chaque objet, compétence, branche de talent, compagnon et recherche affichés a une image chargée (naturalWidth > 0)
//   6 aucun texte « Remettre au niveau » ni action `sharpen` dans le DOM
//   7 aucun bouton « Équiper toute l'équipe » dans Compagnons
//   8 aucun <select> visible
//   9 aucun texte sous 12 px
// Il est NORMAL qu'il trouve des défauts tant que les écrans n'ont pas été refaits : il rapporte le nombre par contrôle et par onglet.
// Code de sortie 1 au moindre défaut. Captures JPEG : <taille>-<partie>-<vue>.jpg (partie neuve : « neuve »), dans le dossier --out.
import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ALL_TABS, PC_SIZES, makeOpt, parseSizes, parseList, startApp, openGame, openTab, listModes, clickMode, closeAll, slug } from './lib-1013.mjs';

export const CHECKS = {
  1: 'défilement horizontal / contenu décentré', 2: 'chevauchement', 3: 'image d\'événement hors de son cadre', 4: 'cartouche / bouton doré',
  5: 'image manquante', 6: '« Remettre au niveau » / sharpen', 7: '« Équiper toute l\'équipe » dans Compagnons', 8: '<select> visible', 9: 'texte sous 12 px',
};

// --- Contrôles exécutés dans la page ------------------------------------------------------------------------------------
// kind : 'tab' (panneau ouvert) ou 'combat' (écran de jeu, panneau fermé).
function inPage(kind) {
  const issues = [];
  const add = (check, msg) => issues.push({ check, msg });
  const vw = window.innerWidth;
  const panel = document.querySelector('#panel');
  const body = document.querySelector('#panel-body');
  const modal = document.querySelector('#modal:not(.hidden)');
  const tabName = window.__idle?.ui?.tab;
  const name = (el) => `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}` : ''} « ${(el.textContent || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 24)} »`;
  const clip = kind === 'tab' && body ? body.getBoundingClientRect() : { left: 0, top: 0, right: vw, bottom: window.innerHeight };
  const shown = (el) => { // affiché : taille non nulle, ni masqué ni transparent (sans test de recouvrement), dans la zone visible
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
    }
    return r.bottom > clip.top && r.top < clip.bottom && r.right > clip.left && r.left < clip.right;
  };
  const root = kind === 'tab' ? (modal ?? panel) : document.querySelector('#play') ?? document.body;
  const inRoot = (sel) => [...(root ? root.querySelectorAll(sel) : [])].filter(shown);

  // 1. défilement horizontal, centrage
  if (kind === 'tab') {
    if (body && body.scrollWidth > body.clientWidth + 1) add(1, `#panel-body scrollWidth ${body.scrollWidth} > clientWidth ${body.clientWidth}`);
    for (const el of panel ? panel.querySelectorAll('*') : []) {
      if (el === body || !(el.scrollWidth > el.clientWidth + 1)) continue;
      const cs = getComputedStyle(el);
      if ((cs.overflowX === 'auto' || cs.overflowX === 'scroll') && el.clientWidth > 40 && shown(el) && !/(scrollbar-width:\s*none)/.test(el.getAttribute('style') ?? '') && cs.scrollbarWidth !== 'none') add(1, `${name(el)} défile en largeur (${el.scrollWidth} > ${el.clientWidth})`);
    }
  }
  if (document.documentElement.scrollWidth > vw + 1) add(1, `la page déborde : ${document.documentElement.scrollWidth} > ${vw}`);
  if (kind === 'tab') {
    const frame = body?.querySelector(':scope > .m-frame') ?? body?.querySelector('.m-frame');
    const host = frame ?? body;
    if (host) {
      const hr = host.getBoundingClientRect();
      const kids = [...host.querySelectorAll('*')].filter((el) => !el.closest('.m-title') && el !== host && shown(el) && getComputedStyle(el).position !== 'absolute' && getComputedStyle(el).position !== 'fixed');
      const rects = kids.map((el) => el.getBoundingClientRect()).filter((r) => r.width > 8 && r.height > 8 && r.right <= hr.right + 400);
      if (rects.length) {
        const left = Math.min(...rects.map((r) => r.left)) - hr.left, right = hr.right - Math.max(...rects.map((r) => r.right));
        if (Math.abs(left - right) > 24) add(1, `contenu décentré dans ${frame ? 'le cadre' : '#panel-body'} : marge gauche ${Math.round(left)} px, droite ${Math.round(right)} px`);
      }
    }
  }

  // 2. chevauchements
  const BTN = 'button, [role="button"], [data-action], a.btn, .btn';
  let boxes = [];
  if (kind === 'tab') {
    const btns = inRoot(BTN).filter((el) => !(el.parentElement?.closest(BTN) && root.contains(el.parentElement.closest(BTN))) && !el.closest('#panel-subtabs'));
    boxes = [...btns, ...inRoot('.m-card, .pg-card')];
  } else {
    boxes = [...document.querySelectorAll('#zone-card, #hq-events .hq-ev, #hq-left > *, #skill-bar, #hud, #loot-bag, #next-action, #boost-group, #hq-bounty, #goals-pill')].filter(shown);
  }
  boxes = [...new Set(boxes)];
  const seen = new Set();
  for (let i = 0; i < boxes.length; i++) {
    const a = boxes[i].getBoundingClientRect();
    for (let j = i + 1; j < boxes.length; j++) {
      if (boxes[i].contains(boxes[j]) || boxes[j].contains(boxes[i])) continue;
      const b = boxes[j].getBoundingClientRect();
      const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left), oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (ox > 2 && oy > 2) { const m = `${name(boxes[i])} et ${name(boxes[j])} (${Math.round(ox)}x${Math.round(oy)} px)`; if (!seen.has(m)) { seen.add(m); add(2, m); } }
    }
  }

  // 3. images d'événement dans leur cadre
  for (const ev of document.querySelectorAll('#hq-events .hq-ev')) {
    if (!shown(ev)) continue;
    const art = ev.querySelector('.hq-ev-art'), img = art?.querySelector('img');
    if (!art || !img) continue;
    const a = art.getBoundingClientRect(), r = img.getBoundingClientRect();
    if (r.left < a.left - 1 || r.right > a.right + 1 || r.top < a.top - 1 || r.bottom > a.bottom + 1) add(3, `${name(ev)} : image ${Math.round(r.width)}x${Math.round(r.height)} hors du cadre ${Math.round(a.width)}x${Math.round(a.height)}`);
  }

  // 4. cartouche + un seul bouton doré
  const titles = inRoot('.m-title');
  if (kind === 'tab' && !titles.length) add(4, `aucun .m-title visible (onglet ${tabName}, modale ${modal ? 'ouverte' : 'non'}, défilement ${Math.round(body?.scrollTop ?? -1)}, titres dans le DOM ${document.querySelectorAll('#panel .m-title').length}, cadre ${JSON.stringify(document.querySelector('#panel-body .m-frame')?.getBoundingClientRect().toJSON?.() ?? null)})`);
  const GOLD = '.m-btn-gold, .btn-gold, .btn.gold, .gold-btn, button.primary-gold';
  const golds = [...(kind === 'tab' ? (root ? root.querySelectorAll(GOLD) : []) : document.querySelectorAll(`#play ${GOLD.split(',').join(', #play ')}`))].filter(shown);
  if (golds.length > 1) add(4, `${golds.length} boutons dorés visibles : ${golds.slice(0, 4).map(name).join(' | ')}`);

  // 5. images : chargées ; chaque objet / compétence / branche / compagnon / recherche en a une
  if (root) {
    for (const im of root.querySelectorAll('img')) {
      if (!shown(im) || im.getAttribute('data-fallback') === 'remove' && !im.complete) continue;
      if (!im.complete || im.naturalWidth === 0) add(5, `image non chargée : ${(im.getAttribute('src') ?? '').slice(-48)}`);
    }
    const ENT = '[data-action="select-item"], [data-action="eq-slot"], [data-action="skill-sel"], [data-action="talent-branch"], [data-action="companion-sel"], [data-action="bastion-leaf"], [data-action="bastion-branch"], [data-action="bastion-res"], .m-tile:not(.empty), [data-research], [data-node]';
    for (const el of inRoot(ENT)) {
      if (el.classList.contains('empty') || el.matches('.eq-slot.empty, .locked')) continue;
      if (el.getAttribute('data-action') === 'bastion-res' && !el.querySelector('img')) continue; // simple ressource en haut du Bastion
      const hasImg = el.querySelector('img, canvas, svg') || (getComputedStyle(el).backgroundImage ?? 'none') !== 'none' || el.querySelector('[style*="background-image"]');
      if (!hasImg) add(5, `${name(el)} sans image`);
    }
  }

  // 6. « Remettre au niveau » / sharpen
  const scope = kind === 'tab' ? [panel, modal].filter(Boolean) : [document.body];
  for (const s of scope) {
    if (s.querySelector('[data-action="sharpen"], [data-sharpen]')) add(6, 'une action sharpen est dans le DOM');
    if (/remettre au niveau/i.test(s.textContent ?? '')) add(6, 'le texte « Remettre au niveau » est dans le DOM');
  }
  // 7. « Équiper toute l'équipe » dans Compagnons
  if (kind === 'tab' && tabName === 'companions' && panel) {
    if (/[ée]quiper toute l.[ée]quipe/i.test(panel.textContent ?? '') || panel.querySelector('[data-action="gear-team"]')) add(7, '« Équiper toute l\'équipe » est dans Compagnons');
  }
  // 8. <select>
  for (const el of document.querySelectorAll('#panel select, #modal select')) if (shown(el)) add(8, `${name(el)} visible`);
  // 9. texte sous 12 px
  const dup = new Set();
  const leaves = (kind === 'tab' ? [panel, modal].filter(Boolean) : [document.querySelector('#play') ?? document.body]).flatMap((r) => [...r.querySelectorAll('*')]);
  for (const el of leaves) {
    if ([...el.childNodes].every((n) => n.nodeType !== 3 || !n.textContent.trim())) continue;
    if (['SCRIPT', 'STYLE', 'OPTION'].includes(el.tagName) || !shown(el)) continue;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs < 11.95) { const m = `${name(el)} : ${fs} px`; if (!dup.has(m)) { dup.add(m); add(9, m); } }
  }
  return issues;
}

// --- Vues d'un onglet ---------------------------------------------------------------------------------------------------
async function openItemSheet(page) {
  return page.evaluate(() => {
    const t = document.querySelector('#panel-body [data-action="select-item"], #panel-body [data-action="eq-slot"][data-id]');
    if (!t) return false; t.click(); return true;
  });
}
async function openCompanionSheet(page) {
  return page.evaluate(() => {
    const t = [...document.querySelectorAll('#panel-body [data-action="companion-sel"]')].find((b) => !b.classList.contains('locked')) ?? document.querySelector('#panel-body [data-action="companion-sel"]');
    if (!t) return false; t.click(); return true;
  });
}

// Bastion › Recherches (PC) : le livre avec la Bibliothèque construite (une recherche en cours), sans Bibliothèque (bandeau « Construire › »),
// un nœud fermé, une autre branche et un autre palier. Sans effet si le Bastion n'est pas encore ouvert (partie neuve).
async function researchViews(g, rec) {
  const go = async (js, arg) => { const ok = await g.page.evaluate(js, arg); await g.page.waitForTimeout(500); await closeAll(g.page); return ok; };
  const view = () => go(() => { document.querySelectorAll('[data-action="bastion-kick-ok"], [data-action="bastion-age-ok"]').forEach((b) => b.click()); const u = window.__idle.ui; if (!window.__idle.state.bastion) return false; u.view.bastionView = 'research'; u.view.bastionRes = null; u.invalidate(); return true; });
  const setLib = (level) => go((lv) => { const b = window.__idle.state.bastion; if (!b) return false; const l = b.buildings.library; l.level = lv; l.build = null; b.research.active.length = 0; if (lv) { b.research.levels.sharp = Math.max(b.research.levels.sharp ?? 0, 4); b.research.active.push({ id: 'steel', left: 300000, total: 480000, level: 1 }); } window.__idle.ui.invalidate(); return true; }, level);
  if (!await view()) return;
  if (!await setLib(3)) return;
  await view();
  await rec('camp/recherches-avec-bibliotheque', 'camp--recherches-avec-bibliotheque');
  if (await go(() => { const n = [...document.querySelectorAll('#panel-body [data-action="bastion-res"].locked')].pop(); if (!n) return false; n.click(); return true; })) await rec('camp/recherche-fermee', 'camp--recherche-fermee');
  if (await go(() => { const n = document.querySelector('#panel-body [data-action="bastion-branch"][data-value="team"]'); if (!n) return false; n.click(); return true; })) await rec('camp/recherches-branche', 'camp--recherches-branche');
  if (await go(() => { const n = document.querySelector('#panel-body [data-action="bastion-page"][data-value="2"]'); if (!n) return false; n.click(); return true; })) await rec('camp/recherches-palier-2', 'camp--recherches-palier-2');
  await go(() => { const v = window.__idle.ui.view; v.resBranch = 'combat'; v.resPage = 1; v.bastionRes = null; window.__idle.ui.invalidate(); return true; });
  await setLib(0);
  await view();
  await rec('camp/recherches-sans-bibliotheque', 'camp--recherches-sans-bibliotheque');
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
export async function runAudit(argv) {
  const opt = makeOpt(argv);
  const sizes = parseSizes(opt('sizes', PC_SIZES));
  const tabs = parseList(opt('tabs', ALL_TABS.join(',')));
  const games = parseList(opt('games', 'endgame,fresh'));
  const out = opt('out', 'docs/screenshots/v10.13/apres');
  const shots = !argv.includes('--no-shots');
  const quiet = argv.includes('--quiet');
  if (shots) await mkdir(out, { recursive: true });
  const app = await startApp();
  const report = []; // { game, size, view, tab, issues[], skipped }
  const record = async (g, game, w, h, tab, view, kind, shotName) => {
<<<<<<< HEAD
    if (kind === 'tab') await g.page.waitForFunction(() => { const f = document.querySelector('#panel-body .m-frame'); return !f || Number(getComputedStyle(f).opacity) > 0.99; }, null, { timeout: 4000 }).catch(() => { /* fondu du panneau trop long : le contrôle le dira */ });
    await g.page.waitForFunction(() => [...document.images].every((i) => i.complete || i.loading === 'lazy' || !i.getClientRects().length), null, { timeout: 4000 }).catch(() => { /* image vraiment manquante : le contrôle 5 la signalera */ });
=======
    // Une fenêtre (récompense du jour, retour hors ligne…) peut s'ouvrir après le dernier closeAll : elle devient la « racine » du contrôle
    // et le cartouche du panneau semble absent. On la referme juste avant de mesurer.
    if (kind === 'tab') await closeAll(g.page);
>>>>>>> worktree-agent-af683add7a504b07f
    const rec = { game, size: `${w}x${h}`, tab, view, issues: await g.page.evaluate(inPage, kind), skipped: null };
    report.push(rec);
    if (shots) await g.page.screenshot({ path: join(out, `${w}x${h}-${game === 'fresh' ? 'neuve-' : ''}${shotName}.jpg`), type: 'jpeg', quality: 70 });
  };
  for (const game of games) {
    for (const [w, h] of sizes) {
      const g = await openGame(app, game, w, h);
      for (const tab of tabs) {
        if (!await openTab(g.page, tab)) { report.push({ game, size: `${w}x${h}`, tab, view: tab, issues: [], skipped: 'onglet fermé (pas débloqué)' }); continue; }
        await record(g, game, w, h, tab, tab, 'tab', tab);
        for (const m of await listModes(g.page)) {
          if (!await clickMode(g.page, m)) continue;
          await record(g, game, w, h, tab, `${tab}/${m.value || m.label}`, 'tab', `${tab}--${slug(m.value || m.label)}`);
        }
        if (tab === 'camp') await researchViews(g, (view, name) => record(g, game, w, h, tab, view, 'tab', name)); // v10.13 (§ 7) : Bastion › Recherches
        if (tab === 'inventory') {
          await openTab(g.page, tab);
          if (await openItemSheet(g.page)) { await g.page.waitForTimeout(600); await record(g, game, w, h, tab, 'fiche-objet', 'tab', 'fiche-objet'); }
        }
        if (tab === 'companions') {
          await openTab(g.page, tab);
          if (await openCompanionSheet(g.page)) { await g.page.waitForTimeout(600); await closeAll(g.page); await record(g, game, w, h, tab, 'fiche-compagnon', 'tab', 'fiche-compagnon'); }
        }
      }
      // écran de combat : panneau fermé
      await g.page.evaluate(() => { try { __idle.ui.closePanel(); } catch { /* rien */ } });
      await g.page.waitForTimeout(1500); await closeAll(g.page);
      await record(g, game, w, h, 'combat', 'combat', 'combat', 'combat');
      if (g.jsErrors.length) report.push({ game, size: `${w}x${h}`, tab: '(page)', view: '(page)', issues: [...new Set(g.jsErrors)].map((m) => ({ check: 0, msg: `erreur JS : ${m}` })), skipped: null });
      await g.ctx.close();
      if (!quiet) console.log(`${game} ${w}x${h} : fait`);
    }
  }
  await app.close();
  return { report, out, shots };
}

export function summarize(report, { quiet = false } = {}) {
  const perCheck = Object.fromEntries(Object.keys(CHECKS).map((k) => [k, 0]));
  const perTab = {}; // tab -> { n, checks: {k: n} }
  let defects = 0, skipped = 0, screens = 0;
  for (const r of report) {
    if (r.skipped) { skipped++; continue; }
    screens++;
    if (!r.issues.length) continue;
    if (!quiet) {
      console.log(`✘ ${r.game} ${r.size} ${r.view} : ${r.issues.length} défaut(s)`);
      const seen = new Set();
      for (const i of r.issues) { const line = `    [${i.check}] ${i.msg}`; if (!seen.has(line) && seen.size < 4) { seen.add(line); console.log(line); } }
    }
    const t = (perTab[r.tab] ??= { n: 0, checks: {} });
    for (const i of r.issues) { perCheck[i.check] = (perCheck[i.check] ?? 0) + 1; defects++; t.n++; t.checks[i.check] = (t.checks[i.check] ?? 0) + 1; }
  }
  return { perCheck, perTab, defects, skipped, screens };
}

if (isMain) {
  const argv = process.argv.slice(2);
  const { report, out, shots } = await runAudit(argv);
  const { perCheck, perTab, defects, skipped, screens } = summarize(report, { quiet: argv.includes('--quiet') });
  console.log('\n=== Résumé du contrôle PC ===');
  console.log(`${screens} écrans contrôlés, ${skipped} ignorés, ${defects} défaut(s)`);
  for (const [k, label] of Object.entries(CHECKS)) console.log(`  contrôle ${k} (${label}) : ${perCheck[k] ?? 0}`);
  if (perCheck[0]) console.log(`  erreurs JS : ${perCheck[0]}`);
  console.log('  par onglet :');
  for (const [tab, t] of Object.entries(perTab).sort((a, b) => b[1].n - a[1].n)) console.log(`    ${tab.padEnd(13)} ${String(t.n).padStart(4)}  (${Object.entries(t.checks).map(([k, n]) => `c${k}:${n}`).join(' ')})`);
  if (shots) console.log(`Captures : ${out}`);
  process.exit(defects ? 1 : 0);
}
