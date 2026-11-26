// v10.17 (C5) : contrôle « aucun texte coupé » : injecte les textes les plus longs de chaque liste (objectifs des Chroniques,
// tâches du Carnet, noms de zones, d'objets, de compagnons, de compétences, d'événements, âges du Bastion, fil d'infos), en
// français, anglais et coréen, dans chaque cadre qui les affiche, puis vérifie qu'aucun texte n'est coupé sans défiler
// (src/ui/marquee.js : classe .mq-on, ou .mq-wrap avec « Réduire les animations »).
//   node tools/text-fit-audit.mjs [--sizes 1116x993,1366x768,1920x1080,412x915,390x844] [--quiet]
// Exporte textFitAudit(app, page) pour tools/desk-audit.mjs et tools/mobile-audit.mjs. Code de sortie 1 au moindre défaut.
import { pathToFileURL } from 'node:url';
import { makeOpt, parseSizes, startApp, openGame, openTab, closeAll } from './lib-1013.mjs';

export const FIT_SIZES = '1116x993,1366x768,1920x1080,412x915,390x844';

// Familles : où injecter (sélecteurs) et quoi (liste calculée dans la page, en français, traduite en anglais et en coréen).
const FAMILIES = [
  { id: 'chroniques', sel: '#hq-path .hq-title', list: 'chronicles' },
  { id: 'carnet', sel: '#hq-carnet .hq-task span, .hq-carnet-done b', list: 'daybook' },
  { id: 'zone', sel: '#zone-name .zn-t, .world-name', list: 'zones' },
  { id: 'infos', sel: '#news-text', list: 'news' },
  { id: 'événements', sel: '#hq-events small', list: 'events' },
  { id: 'objets', sel: '.eq-sheet .eq-name, .enc-item-name, .eq-pick-id b, .fg-up-id, .eq-row > span:first-child', list: 'items' },
  { id: 'compagnons', sel: '.who-card b, .who-btn small, .pet-label b, .bc-txt small, .arena-stage .arena-ally b', list: 'companions' },
  { id: 'compétences', sel: '.sfx-face b, .ss-label', list: 'skills' },
  { id: 'âge', sel: '.bs-age span, .d-bs .bs-age', list: 'ages' },
  { id: 'titres', sel: '.m-title b', list: 'titles' },
];
const VIEWS = ['combat', 'inventory', 'companions', 'skills', 'camp', 'encyclopedia', 'daybook', 'event', 'contracts'];

// Dans la page : les listes de textes (fr, en, ko), le plus long de chaque langue.
export async function textFitLists(page) {
  return page.evaluate(async () => {
    const [chron, zones, comps, items, skills, en, ko, live] = await Promise.all([
      import('/src/core/chronicles.js'), import('/src/data/zones.js'), import('/src/data/companions.js'), import('/src/data/items.js'),
      import('/src/data/skills.js'), import('/src/i18n/en.js'), import('/src/i18n/ko.js'), import('/src/data/live-catalog.js'),
    ]);
    let tasks = [];
    try { tasks = (await import('/src/core/daybook.js')).daybookTasks(__idle.state).map((x) => `${x.title} · ${x.text}`); } catch { /* rien */ }
    const fr = {
      chronicles: chron.CHRONICLES.flatMap((c) => [c.need, c.title]),
      daybook: [...tasks, 'Gagne ou balaie 1 donjon · 12 clés en attente', 'Missions du jour · Récupère tes missions'],
      zones: zones.ZONES.map((z) => `${z.name} 20-20`),
      news: ['Coffre : +317,6 Qa or, +1 200 gemmes, +3 clés, +45 fragments', 'Le Colosse est vaincu : +2 tickets de compagnon et une apparence'],
      events: [...Object.values(live.LIVE_EVENT_TYPES ?? {}).map((v) => v?.name ?? v?.label ?? v?.title).filter((x) => typeof x === 'string'), ...Object.values(live.LIVE_BOSSES ?? {}), 'Marché des Lueurs', 'Faille du jour'],
      items: [...items.ITEM_BASES, ...items.SIGNATURE_ITEMS].map((i) => i.name).filter(Boolean),
      companions: comps.COMPANIONS.map((c) => c.name),
      skills: skills.SKILLS.map((s) => s.name).filter(Boolean),
      ages: ["niveaux jusqu'à 40 · ×1 dégâts et vie", "niveaux jusqu'à 120 · ×12,5 dégâts et vie"],
      titles: ['Chemin du héros', 'Encyclopédie', 'Statistiques', 'Expéditions'],
    };
    const longest = (arr) => arr.reduce((a, b) => (String(b).length > String(a).length ? b : a), '');
    const out = {};
    for (const [k, arr] of Object.entries(fr)) {
      out[k] = { fr: longest(arr), en: longest(arr.map((s) => en.translate(s) ?? s)), ko: longest(arr.map((s) => ko.translate(s) ?? s)) };
    }
    return out;
  });
}

// Dans la page : les textes coupés sans défiler, dans `roots` (et dans les cadres donnés).
export function fitIssues(sels) {
  const out = [];
  const name = (el) => `${el.tagName.toLowerCase()}${typeof el.className === 'string' && el.className.trim() ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}` : ''}${el.id ? `#${el.id}` : ''}`;
  const visible = (el) => {
    const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false;
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false; }
    return r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  };
  const check = (el) => {
    if (!visible(el) || el.closest('.mq-on, .mq-wrap, .sr-only, canvas, svg')) return;
    const cs = getComputedStyle(el);
    if (cs.display === 'inline' || el.clientWidth < 1) return;
    if (cs.overflowX === 'auto' || cs.overflowX === 'scroll') return;
    const hid = cs.overflowX !== 'visible' || cs.textOverflow === 'ellipsis';
    if (hid && el.scrollWidth > el.clientWidth + 1) out.push(`${name(el)} « ${el.textContent.trim().slice(0, 40)} » coupé (${el.scrollWidth} > ${el.clientWidth})`);
  };
  for (const el of document.querySelectorAll(sels)) check(el);
  for (const el of document.querySelectorAll('#app *')) {
    if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && !el.querySelector(':scope > .mq-in')) continue;
    check(el);
  }
  return [...new Set(out)];
}

// Injecte puis contrôle, pour la vue ouverte. Renvoie [{ view, family, lang, msg }].
export async function textFitAudit(page, view, L) {
  const issues = [];
  for (const lang of ['fr', 'en', 'ko']) {
    const used = await page.evaluate(({ fams, lang }) => {
      const shown = (el) => el.getClientRects().length > 0;
      const hit = [];
      for (const f of fams) {
        const els = [...document.querySelectorAll(f.sel)].filter(shown).slice(0, 8);
        for (const el of els) el.textContent = f.text[lang];
        if (els.length) hit.push(f.id);
      }
      return hit;
    }, { fams: FAMILIES.map((f) => ({ ...f, text: L[f.list] })), lang });
    await page.waitForTimeout(900); // une passe de src/ui/marquee.js
    const found = await page.evaluate(fitIssues, FAMILIES.map((f) => f.sel).join(','));
    for (const msg of found) issues.push({ view, lang, families: used.join(' '), msg });
  }
  return issues;
}

export async function textFitRun(sizes, { quiet = false } = {}) {
  const app = await startApp();
  const all = [];
  for (const [w, h] of sizes) {
    const g = await openGame(app, 'endgame', w, h);
    const L = await textFitLists(g.page);
    for (const view of VIEWS) {
      if (view === 'combat') { await g.page.evaluate(() => { try { __idle.ui.closePanel(); } catch { /* rien */ } }); await g.page.waitForTimeout(800); await closeAll(g.page); }
      else if (!await openTab(g.page, view)) continue;
      const found = await textFitAudit(g.page, view, L);
      for (const x of found) all.push({ size: `${w}x${h}`, ...x });
      if (!quiet) console.log(`${w}x${h} ${view} : ${found.length} texte(s) coupé(s)`);
    }
    await g.ctx.close();
  }
  await app.close();
  return all;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const argv = process.argv.slice(2);
  const opt = makeOpt(argv);
  const res = await textFitRun(parseSizes(opt('sizes', FIT_SIZES)), { quiet: argv.includes('--quiet') });
  const seen = new Set();
  for (const r of res) { const k = `${r.size} ${r.view} [${r.lang}] ${r.msg}`; if (!seen.has(k)) { seen.add(k); console.log(`✘ ${k}`); } }
  console.log(`\n=== Textes coupés sans défiler : ${res.length} ===`);
  process.exit(res.length ? 1 : 0);
}
