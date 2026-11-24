// v10.13 (lot 8) : sur PC, quand un panneau s'ouvre à côté de la scène (scène de moins de 820 px), l'écran de combat prend la mise
// en page compacte du téléphone (classe `hud-narrow` sur #app, posée par ui.layoutColumn). Ce script recopie les règles de
// src/ui/mobile-hud.css (sous #app.m-phone) à la fin de src/ui/desk-hud.css, sous #app#app.hud-narrow.
// Usage : node tools/sync-hud-narrow.mjs   (à relancer après chaque changement de mobile-hud.css)
import { readFileSync, writeFileSync } from 'node:fs';
const root = new URL('../src/ui/', import.meta.url);
const START = '/* >>> hud-narrow : copie de mobile-hud.css (node tools/sync-hud-narrow.mjs), ne pas modifier à la main */';
const END = '/* <<< hud-narrow */';
const mob = readFileSync(new URL('mobile-hud.css', root), 'utf8').replace(/^\/\*[\s\S]*?\*\/\n/, '');
const block = mob.replace(/#app#app\.m-phone/g, '#app#app.hud-narrow').replace(/#app\.m-phone/g, '#app#app.hud-narrow');
let desk = readFileSync(new URL('desk-hud.css', root), 'utf8');
const i = desk.indexOf(START);
if (i >= 0) desk = desk.slice(0, i).trimEnd() + '\n';
desk += `\n${START}\n${block.trimEnd()}\n${END}\n`;
writeFileSync(new URL('desk-hud.css', root), desk);
console.log('hud-narrow : bloc recopié (' + block.split('\n').length + ' lignes)');
