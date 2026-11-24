// v10.13 (§ 0.7, § 11) : planche avant / après en HTML, côte à côte, à partir des captures déjà faites.
//   node tools/compare-1013.mjs [--avant docs/screenshots/v10.13/avant] [--apres docs/screenshots/v10.13/apres]
//                               [--out docs/screenshots/v10.13/planche.html] [--sizes 1116x993,1366x768,…]
// Associe les fichiers de même nom (<taille>-[neuve-]<vue>.jpg) des deux dossiers ; une vue qui n'existe que d'un côté s'affiche
// avec « (absent) ». Les images sont référencées par chemin relatif : le fichier HTML se lit tel quel depuis le dépôt.
import { readdir, writeFile, mkdir } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { makeOpt, parseList } from './lib-1013.mjs';

const argv = process.argv.slice(2);
const opt = makeOpt(argv);
const avant = opt('avant', 'docs/screenshots/v10.13/avant');
const apres = opt('apres', 'docs/screenshots/v10.13/apres');
const out = opt('out', 'docs/screenshots/v10.13/planche.html');
const only = parseList(opt('sizes', ''));
const ls = async (d) => (await readdir(d).catch(() => [])).filter((f) => f.endsWith('.jpg'));
const A = new Set(await ls(avant)), B = new Set(await ls(apres));
const names = [...new Set([...A, ...B])].filter((f) => !only.length || only.some((s) => f.startsWith(`${s}-`))).sort();
const parse = (f) => { const m = f.match(/^(\d+x\d+)-(neuve-)?(.+)\.jpg$/); return m ? { size: m[1], game: m[2] ? 'neuve' : 'fin de jeu', view: m[3] } : { size: '?', game: '?', view: f }; };
const groups = {};
for (const f of names) { const p = parse(f); (groups[`${p.size} · ${p.game}`] ??= []).push({ f, ...p }); }
await mkdir(dirname(out), { recursive: true });
const rel = (dir, f) => relative(dirname(resolve(out)), resolve(dir, f)).split('\\').join('/');
const cell = (dir, has, f, label) => (has ? `<figure><figcaption>${label}</figcaption><a href="${rel(dir, f)}"><img src="${rel(dir, f)}" loading="lazy" alt="${label} ${f}"></a></figure>` : `<figure class="miss"><figcaption>${label} (absent)</figcaption></figure>`);
const body = Object.entries(groups).map(([g, items]) => `<h2 id="${g.replace(/\W+/g, '-')}">${g}</h2>${items.map((i) => `<h3>${i.view}</h3><div class="row">${cell(avant, A.has(i.f), i.f, 'avant')}${cell(apres, B.has(i.f), i.f, 'après')}</div>`).join('')}`).join('');
const toc = Object.keys(groups).map((g) => `<a href="#${g.replace(/\W+/g, '-')}">${g}</a>`).join(' · ');
await writeFile(out, `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Avant / après 10.13</title>
<style>body{background:#0e1220;color:#eef2ff;font:14px system-ui,sans-serif;margin:16px}a{color:#f3d27a}h1{font-size:20px}h2{margin:28px 0 4px;font-size:18px;color:#f3d27a;border-bottom:1px solid #2c3a66}h3{margin:14px 0 4px;font-size:14px;color:#9fb0d8}
.row{display:grid;grid-template-columns:1fr 1fr;gap:10px}figure{margin:0}figcaption{font-size:12px;color:#9fb0d8;margin:0 0 2px}img{width:100%;height:auto;border:1px solid #2c3a66;display:block}.miss{display:grid;place-items:center;min-height:80px;border:1px dashed #2c3a66}</style>
<h1>Ascendrya 10.13 : avant (gauche) et après (droite)</h1><p>${names.length} vues · ${toc}</p>${body}</html>`);
console.log(`${names.length} vues (${[...names].filter((f) => A.has(f) && B.has(f)).length} avec avant et après) → ${out}`);
