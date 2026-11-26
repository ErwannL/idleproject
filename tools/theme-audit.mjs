// v10.17 (D) : contrôle des thèmes : avec Sakura (et Givre, Forge naine), plus aucune couleur de la palette « Chevalier »
// (bleu nuit, acier bleuté, bleu vif, dorures) dans les fenêtres. Pour chaque thème et chaque onglet, relève les couleurs
// calculées (fond, dégradés, bordures, texte) des éléments visibles du panneau et compte celles de la palette Chevalier (couleurs
// des feuilles de style rangées dans une famille par src/ui/themes.js) que le thème aurait dû changer mais qui sont restées. Hors raretés (éléments
// marqués d'une rareté), images, et couleurs neutres (gris, blanc, noir).
//   node tools/theme-audit.mjs [--themes sakura,frost,forge] [--tabs inventory,skills,camp,shop,arena,options] [--sizes 1366x768,412x915]
//                              [--out docs/screenshots/v10.17/ui/themes] [--no-shots]
// Une capture JPEG par thème et onglet. Code de sortie 1 au moindre défaut.
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { makeOpt, parseSizes, parseList, startApp, openGame, openTab } from './lib-1013.mjs';

const argv = process.argv.slice(2);
const opt = makeOpt(argv);
const themes = parseList(opt('themes', 'sakura,frost,forge'));
const tabs = parseList(opt('tabs', 'inventory,skills,camp,shop,arena,options'));
const sizes = parseSizes(opt('sizes', '1366x768,412x915'));
const out = opt('out', 'docs/screenshots/v10.17/ui/themes');
const shots = !argv.includes('--no-shots');
if (shots) await mkdir(out, { recursive: true });

// Dans la page, AVANT le changement de thème : la palette Chevalier = toutes les couleurs des feuilles de style que
// src/ui/themes.js range dans une famille (bleu nuit, acier, dorures, bleu vif).
async function knightPalette() {
  const m = await import('/src/ui/themes.js');
  const RX = /#([0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3})\b|rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/gi;
  const pal = new Set();
  const walk = (rules) => { for (const r of rules) { if (r.cssRules) walk(r.cssRules); if (!r.style) continue; for (let i = 0; i < r.style.length; i++) {
    const v = r.style.getPropertyValue(r.style[i]);
    for (const x of v.matchAll(RX)) {
      let rgb; if (x[1]) { const f = x[1].length === 3 ? x[1].split('').map((c) => c + c).join('') : x[1]; rgb = [0, 2, 4].map((k) => parseInt(f.slice(k, k + 2), 16)); } else rgb = [+x[2], +x[3], +x[4]];
      if (m.colorFamily(...rgb)) pal.add(rgb.join(','));
    } } } };
  for (const sh of document.styleSheets) { try { walk(sh.cssRules); } catch { /* rien */ } }
  window.__knightPal = [...pal];
  return pal.size;
}

// Dans la page : les couleurs « Chevalier » restantes (une couleur de la palette Chevalier que le thème aurait dû changer).
// Renvoie { n, samples }.
async function knightColors(themeId) {
  const tm = await import('/src/ui/themes.js');
  const theme = tm.themeById(themeId);
  const pal = new Set(window.__knightPal ?? []);
  const RAR = /(^|[\s-])(r-|rar|common|uncommon|rare|epic|legend|mythic|astral|ascend|sfx-)/i;
  const knight = (r, g, b) => {
    if (!pal.has(`${r},${g},${b}`)) return false;
    const t = tm.transformRgb(theme, r, g, b); // ce que le thème en fait : s'il la laisse presque pareille, elle n'est pas « Chevalier » pour ce thème
    return Boolean(t) && Math.abs(t[0] - r) + Math.abs(t[1] - g) + Math.abs(t[2] - b) > 30;
  };
  const RX = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/g;
  const roots = [document.querySelector('#panel'), document.querySelector('#modal:not(.hidden)')].filter(Boolean);
  const samples = {}; let n = 0;
  for (const root of roots) {
    for (const el of root.querySelectorAll('*')) {
      if (['IMG', 'CANVAS', 'SVG', 'PATH', 'SCRIPT', 'STYLE'].includes(el.tagName.toUpperCase())) continue;
      const r = el.getBoundingClientRect(); if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.top > innerHeight) continue;
      let rare = false; for (let p = el; p && p !== root; p = p.parentElement) if (RAR.test(typeof p.className === 'string' ? p.className : '') || p.dataset?.rarity || p.style?.getPropertyValue('--rc')) { rare = true; break; }
      if (rare) continue;
      const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) continue;
      const hasText = [...el.childNodes].some((x) => x.nodeType === 3 && x.textContent.trim());
      const props = [['fond', cs.backgroundColor], ['dégradé', cs.backgroundImage.includes('url(') ? '' : cs.backgroundImage], ['bord', cs.borderTopStyle !== 'none' && parseFloat(cs.borderTopWidth) > 0 ? cs.borderTopColor : ''], ...(hasText ? [['texte', cs.color]] : [])];
      for (const [k, v] of props) {
        if (!v) continue;
        for (const m of v.matchAll(RX)) {
          if (m[4] !== undefined && Number(m[4]) < 0.15) continue;
          if (!knight(+m[1], +m[2], +m[3])) continue;
          n++;
          const key = `${k} rgb(${m[1]}, ${m[2]}, ${m[3]})`;
          samples[key] ??= `${el.tagName.toLowerCase()}.${String(el.className).trim().split(/\s+/).slice(0, 2).join('.')}`;
        }
      }
    }
  }
  return { n, samples };
}

const app = await startApp();
let total = 0;
const rows = [];
for (const [w, h] of sizes) {
  for (const theme of themes) {
    const g = await openGame(app, 'endgame', w, h);
    await g.page.evaluate(knightPalette);
    await g.page.evaluate(async (id) => { const m = await import('/src/ui/themes.js'); try { __idle.state.ui.theme = id; } catch { /* rien */ } await m.applyTheme(id); }, theme);
    for (const tab of tabs) {
      if (!await openTab(g.page, tab)) continue;
      await g.page.waitForTimeout(400);
      const res = await g.page.evaluate(knightColors, theme);
      total += res.n;
      rows.push({ size: `${w}x${h}`, theme, tab, ...res });
      if (shots) await g.page.screenshot({ path: join(out, `${w}x${h}-${theme}-${tab}.jpg`), type: 'jpeg', quality: 80 });
      console.log(`${w}x${h} ${theme.padEnd(7)} ${tab.padEnd(12)} : ${res.n} couleur(s) Chevalier`);
      if (res.n && !argv.includes('--quiet')) for (const [k, v] of Object.entries(res.samples).slice(0, 6)) console.log(`    ${k}  (${v})`);
    }
    await g.ctx.close();
  }
}
await app.close();
console.log(`\n=== Couleurs Chevalier restantes : ${total} ===`);
process.exit(total ? 1 : 0);
