// Couverture des traductions : liste les chaînes françaises trouvées dans src/ (littéraux et textes des
// gabarits HTML) et indique la part traduite dans chaque langue (en, ko).
// Usage : node tools/i18n-coverage.mjs [--missing en|ko] [--file motif] [--json]
//   --missing en : affiche les chaînes encore sans traduction anglaise (fichier:ligne « texte »).
// Mesure approchée : les valeurs `${…}` des gabarits sont remplacées par « 12 » (ou retirées si collées
// à un mot : accords) ; un texte découpé en
// plusieurs nœuds peut être compté plusieurs fois ; quelques chaînes techniques peuvent passer le filtre.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { lookup as en } from '../src/i18n/en.js';
import { lookup as ko } from '../src/i18n/ko.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const LANGS = { en, ko };
const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const missingLang = opt('--missing');
const fileFilter = opt('--file');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) return d.name === 'i18n' ? [] : walk(p);
    return d.name.endsWith('.js') ? [p] : [];
  });
}

// Littéraux de chaîne d'un fichier JS : [{ text, line, template }]. Analyse simple (commentaires et
// expressions régulières sautés au mieux).
function literals(code) {
  const out = [];
  let line = 1;
  for (let i = 0; i < code.length; i++) {
    const c = code[i];
    if (c === '\n') { line++; continue; }
    if (c === '/' && code[i + 1] === '/') { while (i < code.length && code[i] !== '\n') i++; line++; continue; }
    // v9.2.9 : « /* » sans « */ » (dessins en caractères de render/art*.js) : indexOf valait -1, i repartait à 0 et
    // l'outil tournait sans fin. On s'arrête à la fin du fichier.
    if (c === '/' && code[i + 1] === '*') { const e = code.indexOf('*/', i + 2); if (e < 0) break; line += (code.slice(i, e).match(/\n/g) ?? []).length; i = e + 1; continue; }
    if (c === "'" || c === '"' || c === '`') {
      const start = line;
      let j = i + 1;
      let s = '';
      let depth = 0;
      for (; j < code.length; j++) {
        const d = code[j];
        if (d === '\n') line++;
        if (d === '\\') { s += code[j + 1] === 'n' ? ' ' : code[j + 1]; j++; continue; }
        if (c === '`' && d === '$' && code[j + 1] === '{') {
          // expression : on la remplace par une valeur type et on récupère ses propres littéraux
          let k = j + 2; depth = 1;
          while (k < code.length && depth) { if (code[k] === '{') depth++; else if (code[k] === '}') depth--; if (code[k] === '\n') line++; k++; }
          const inner = code.slice(j + 2, k - 1);
          for (const x of literals(inner)) out.push({ ...x, line: start + x.line - 1 });
          s += '\u0001';
          j = k - 1;
          continue;
        }
        if (d === c) break;
        if (d === '\n' && c !== '`') break;
        s += d;
      }
      // valeur collée à un mot (« objet${s} ») : accord, on l'enlève ; sinon un nombre type
      s = s.replace(/(\p{L})\u0001/gu, '$1').replaceAll('\u0001', '12');
      out.push({ text: s, line: start, template: c === '`' });
      i = j;
    }
  }
  return out;
}

const FR_WORD = /[éèêàâçùûôîœ]|\b(?:le|la|les|des|du|de|un|une|et|à|au|aux|pour|par|sur|avec|dans|vos|votre|est|sont|pas|plus)\b/i;
// Une chaîne « française » : du texte lisible, pas un identifiant, une classe CSS, un chemin ou du code.
function isFrench(s) {
  const t = s.replace(/\s+/g, ' ').trim();
  if (t.length < 2 || !/\p{L}{2}/u.test(t)) return false;
  if (/^[\w$.\-/:#@?=&%*,]+$/.test(t) && !/[éèêàâçùûôîœ]/i.test(t) && !/^[A-ZÉÈÀ][a-zéèêàâçùûôîœ]+$/.test(t)) return false;
  // v9.2.9 : écrit sans quantificateurs imbriqués — « (?:[a-z-]+\s*)+$ » revenait en arrière de façon exponentielle
  // sur les lignes des dessins en caractères (art-anim-allies.js) : l'outil ne finissait plus.
  if (/^[a-z-]+(?: +[a-z-]+)* ?$/.test(t) && !FR_WORD.test(t)) return false; // classes CSS « btn small active »
  if (/[{};=]|=>|\(\)|^\.|^#|^\[|https?:|\.(?:png|js|json|css|mp3|ogg)\b/.test(t)) return false;
  if (/^(?:rgba?|hsla?|var|translate|scale|rotate|linear-gradient|calc|url)\(/.test(t)) return false;
  // v9.3.3 : valeurs CSS et classes générées (animations de l'interface) : jamais affichées comme texte.
  if (/^(?:cubic-bezier|steps|circle|inset|translate[XY]?)\(|^:scope\b|^uvfx\b|^uvfx-loop\b|^tnode k-/.test(t)) return false;
  // v9.1.9 : code qui passait le filtre — dessins en caractères (render/art.js), clés de cache « hero|12|12 »,
  // sélecteurs CSS (« button, summary », « canvas[data-anim] »), requêtes média, classes avec valeurs, polices.
  if (!/\s/.test(t) && /[<>~^|@*&#!]/.test(t)) return false;
  if (/^[\w-]+(?:\|\w+)+$/.test(t) || /^\(?[a-z-]+(?:\[[^\]]*\])?(?:, ?[a-z-]+(?:\[[^\]]*\])?)*\)?$/.test(t) && !FR_WORD.test(t)) return false;
  if (/^\((?:prefers|pointer|max|min)[-:]/.test(t) || /^(?:[a-z-]+ )*[a-z-]+-12\d*$/.test(t) || /serif$|^"?Trebuchet|^Georgia/.test(t)) return false;
  if (/^(?:Bearer|on v-)\b/.test(t) || /^[a-z]+_[a-z_…]+$/.test(t)) return false;
  return /[a-zà-ÿ]/i.test(t);
}

// Textes visibles d'un gabarit : on retire les balises et on garde les attributs traduits.
function templateTexts(s) {
  const texts = [];
  for (const m of s.matchAll(/\b(?:title|placeholder|aria-label|alt)="([^"]*)"/g)) texts.push(m[1]);
  for (const part of s.replace(/<[^>]*>/g, '\u0000').split('\u0000')) texts.push(part);
  return texts;
}


const entries = new Map(); // texte → [fichier:ligne]
for (const file of walk(SRC)) {
  const rel = path.relative(ROOT, file);
  if (fileFilter && !rel.includes(fileFilter)) continue;
  const code = fs.readFileSync(file, 'utf8');
  // v9.2.9 : dessins générés (render/art*.js, « FICHIER GÉNÉRÉ ») : des lignes de pixels, aucun texte d'interface.
  if (/^\/\/ FICHIER GÉNÉRÉ/.test(code) || /[\\/]render[\\/]art(?:-[\w-]+)?\.js$/.test(file)) continue;
  for (const lit of literals(code)) {
    // v9.2.9 : dessins en caractères (render/art-anim-*.js, plusieurs Mo) : pas des textes d'interface, et certains
    // filtres d'isFrench mettaient des minutes à les rejeter (retour arrière exponentiel).
    if (lit.text.length > 2000) continue;
    const pieces = lit.template || /<\w/.test(lit.text) ? templateTexts(lit.text) : [lit.text];
    for (const p of pieces) {
      const t = p.replace(/\s+/g, ' ').trim();
      if (!isFrench(t)) continue;
      if (!entries.has(t)) entries.set(t, []);
      entries.get(t).push(`${rel}:${lit.line}`);
    }
  }
}

// v9.1.9 : textes de la page (index.html) : nœuds texte et attributs traduits.
{
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/g, '');
  for (const p of templateTexts(html)) {
    const t = p.replace(/\s+/g, ' ').trim();
    if (!isFrench(t) || (fileFilter && !'index.html'.includes(fileFilter))) continue;
    if (!entries.has(t)) entries.set(t, []);
    entries.get(t).push('index.html');
  }
}

const total = entries.size;
const stats = {};
for (const [code, fn] of Object.entries(LANGS)) {
  // v9.1.9 : « 12 » collé au bord vient souvent d'une icône (« ${img(…)} Titre ») ou d'un élément à part
  // (« texte.${span} ») : on accepte aussi la traduction du texte sans lui.
  const ok = (t) => fn(t) !== null || [t.replace(/^12 ?(?=[^\d\s])/, ''), t.replace(/(?<=[^\d\s])\s?12$/, ''), t.replace(/^12 ?/, '').replace(/ ?12$/, '')].some((u) => u !== t && u.trim() && fn(u.trim()) !== null);
  const missing = [...entries.keys()].filter((t) => !ok(t));
  stats[code] = { done: total - missing.length, missing };
}

if (args.includes('--json')) {
  console.log(JSON.stringify({ total, ...Object.fromEntries(Object.entries(stats).map(([k, v]) => [k, { done: v.done, pct: +(100 * v.done / total).toFixed(1) }])) }));
} else {
  console.log(`Chaînes françaises trouvées dans src/ : ${total}`);
  for (const [code, v] of Object.entries(stats)) console.log(`  ${code} : ${v.done}/${total} traduites (${(100 * v.done / total).toFixed(1)} %)`);
}
if (missingLang && stats[missingLang]) {
  for (const t of stats[missingLang].missing) console.log(`${entries.get(t)[0]}\t« ${t} »`);
}
