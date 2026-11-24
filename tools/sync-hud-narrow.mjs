// v10.13 (lot 8) : sur PC, quand un panneau s'ouvre à côté de la scène (scène de moins de 820 px), l'écran de combat prend la mise
// en page compacte du téléphone (classe `hud-narrow` sur #app, posée par ui.layoutColumn). Ce script recopie les règles de
// tools/hud-narrow-source.css (sous #app.m-phone) à la fin de src/ui/desk-hud.css, sous #app#app.hud-narrow.
// v10.13.1 : la source est FIGÉE (c'était src/ui/mobile-hud.css en 10.13.0). Le téléphone a pris la mise en page de la maquette t07
// (src/ui/mobile-hud.css) ; la scène étroite du PC n'a pas changé d'un pixel. Ne relancer ce script que pour changer volontairement le PC.
// Usage : node tools/sync-hud-narrow.mjs
import { readFileSync, writeFileSync } from 'node:fs';
const root = new URL('../src/ui/', import.meta.url);
const source = new URL('./hud-narrow-source.css', import.meta.url);
const START = '/* >>> hud-narrow : copie de mobile-hud.css (node tools/sync-hud-narrow.mjs), ne pas modifier à la main */';
const END = '/* <<< hud-narrow */';
const mob = readFileSync(source, 'utf8').replace(/^\/\*[\s\S]*?\*\/\n/, '');
const block = mob.replace(/#app#app\.m-phone/g, '#app#app.hud-narrow').replace(/#app\.m-phone/g, '#app#app.hud-narrow');
let desk = readFileSync(new URL('desk-hud.css', root), 'utf8');
const i = desk.indexOf(START), j = desk.indexOf(END);
const tail = i >= 0 && j > i ? desk.slice(j + END.length) : ''; // ce qui suit le bloc (règles ajoutées après) est conservé
if (i >= 0) desk = desk.slice(0, i).trimEnd() + '\n';
desk += `\n${START}\n${block.trimEnd()}\n${END}${tail || '\n'}`;
writeFileSync(new URL('desk-hud.css', root), desk);
console.log('hud-narrow : bloc recopié (' + block.split('\n').length + ' lignes)');
