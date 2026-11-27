// v10.20 (partie 6) : captures téléphone avant / après : Équipement, Améliorations, Forge, Compagnons, Objectifs.
//   node tools/capture-1020-phone.mjs --tag avant|apres [--out docs/screenshots/v10.20/telephone] [--sizes 405x896,360x800]
// Pour « avant », lancer ce fichier depuis une copie de la v10.19.0 (le serveur sert le dossier courant).
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { makeOpt, parseSizes, startApp, openGame, openTab } from './lib-1013.mjs';
const opt = makeOpt(process.argv.slice(2));
const tag = opt('tag', 'apres'), out = resolve(opt('out', 'docs/screenshots/v10.20/telephone'));
await mkdir(out, { recursive: true });
const app = await startApp();
const TABS = [['inventory', 'equipement'], ['upgrades', 'ameliorations'], ['forge', 'forge'], ['companions', 'compagnons'], ['daybook', 'objectifs']];
for (const [w, h] of parseSizes(opt('sizes', '405x896,360x800'))) {
  const g = await openGame(app, 'endgame', w, h);
  for (const [tab, name] of TABS) {
    await openTab(g.page, tab);
    await g.page.waitForTimeout(400);
    await g.page.screenshot({ path: `${out}/${tag}-${w}x${h}-${name}.jpg`, type: 'jpeg', quality: 80 });
  }
  await g.ctx.close();
}
await app.close();
console.log('captures :', out);
