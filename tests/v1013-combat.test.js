// v10.13 (lot 8, § 8) : écran de combat — événements, carte de zone à 3 lignes, quêtes, console du bas.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const css = (p) => src(p).replace(/\/\*[\s\S]*?\*\//g, '');
// Sélecteurs des règles d'un fichier CSS (on ignore les accolades des @media).
const selectors = (text) => [...text.matchAll(/(^|[}{])\s*([^@{}]+)\{/g)].map((m) => m[2].trim()).filter(Boolean).flatMap((s) => s.split(',').map((x) => x.trim()));

test('10.13 (8) : desk-hud.css et mobile-hud.css sont liés, et chaque règle reste dans son monde (PC / téléphone)', () => {
  const html = src('index.html');
  assert.match(html, /src\/ui\/desk-hud\.css/);
  assert.match(html, /src\/ui\/mobile-hud\.css/);
  const desk = selectors(css('src/ui/desk-hud.css')).filter((s) => !/^(\d+%|from|to)$/.test(s));
  assert.ok(desk.length > 40);
  for (const s of desk) assert.match(s, /^#app(#app)?(\.page-ui)?:not\(\.m-phone\)|^#app #combat-console|^#app#app\.hud-narrow/, `PC : ${s}`);
  const mob = selectors(css('src/ui/mobile-hud.css'));
  assert.ok(mob.length > 40);
  for (const s of mob) assert.match(s, /^#app(#app)?\.m-phone/, `téléphone : ${s}`);
});

test('10.13 (8.1) : événements — cadre 76 px (PC) / 36 px en grille de 4 colonnes (téléphone, 10.13.1), image contain centrée, minuteur sous le cadre, rangée dans un cadre doré', () => {
  const d = css('src/ui/desk-hud.css'), m = css('src/ui/mobile-hud.css');
  assert.match(d, /#hq-events \.hq-ev-art \{[^}]*width: 76px; height: 76px/);
  assert.match(d, /#hq-events \.hq-ev-art img \{[^}]*width: 58px; height: 58px[^}]*object-fit: contain/);
  assert.match(d, /\.hq-ev-timer \{[^}]*margin-top: -8px/);
  assert.match(m, /#hq-events \.hq-ev-art \{[^}]*width: 36px !important; height: 36px !important/);
  assert.match(m, /#hq-events \.hq-ev-art img \{[^}]*width: 28px !important; height: 28px !important/);
  assert.match(m, /#hq-events \{[^}]*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(m, /#hq-events \.hq-ev-art img \{[^}]*object-fit: contain/);
  assert.match(d, /#hq-events \.hq-ev\.ready \.hq-ev-art \{[^}]*border-color: var\(--hud-good\)/);
  assert.match(d, /#hq-events \{[^}]*border: 2px solid var\(--hud-gold\)/);
  const h = src('src/ui/hud-quests.js');
  // le minuteur n'est plus dans le cadre de l'image
  assert.match(h, /<span class="hq-ev-art"><img class="px" src="\$\{x\.art\}" alt=""><\/span>\s*<i class="hq-ev-timer/);
  assert.match(h, /x\.ready \? ' ready' : ''/);
});

test('10.13 (8.2) : carte de zone — trois lignes (titre, piste, compteurs en 3 cases égales), hauteur fixe : rien ne se chevauche', () => {
  const d = css('src/ui/desk-hud.css');
  assert.match(d, /#goals-pill \{[^}]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(d, /#zone-card \{[^}]*width: 360px[^}]*height: 82px/);
  assert.match(d, /--zone-h: 128px/);
  const ui = src('src/ui/ui.js');
  assert.match(ui, /zn-skull/);
  assert.match(ui, /class="zn-x"/);
  const g = src('src/ui/session-goals.js');
  assert.match(g, /<img class="px" src="assets\/ui\/art101\/mis_/);
});

test('10.13 (8.3) : Chemin du héros et Carnet du jour — même cadre doré de 360 px, titres en petites capitales dorées, lignes de 44 px', () => {
  const d = css('src/ui/desk-hud.css');
  assert.match(d, /#hq-left > #hq-path[^{]*\{[^}]*width: 360px[^}]*border: 2px solid var\(--hud-gold\)/);
  assert.match(d, /#hq-carnet \.hq-task \{[^}]*height: 44px/);
  assert.match(d, /text-transform: uppercase; color: var\(--hud-gold2\)/);
  assert.match(src('src/ui/hud-quests.js'), /\$\{t\.done \? '✓ ' : ''\}/);
});

test('10.13 (8.4) : console du bas — trois blocs (PC) / deux lignes (téléphone), éléments déplacés par id, sol réglé au-dessus', () => {
  const c = src('src/ui/combat-console.js');
  for (const id of ['skill-bar', 'hud', 'scene-bottom', 'env-chip', 'next-action', 'loot-bag']) assert.match(c, new RegExp(`put\\('${id}'`));
  assert.match(c, /Attaques et Ultime/);
  assert.match(c, /Vague et héros/);
  const d = css('src/ui/desk-hud.css'), m = css('src/ui/mobile-hud.css');
  assert.match(d, /#combat-console \.cc-attacks/);
  assert.match(d, /#skill-bar \.skill-btn\.big \{ width: 84px; height: 84px/);
  assert.match(d, /#next-action \{[^}]*linear-gradient\(#ffd45a, #e0a21f\)/);
  assert.match(m, /grid-template-areas: "atk seal chest" "wave wave wave"/);
  const ui = src('src/ui/ui.js');
  assert.match(ui, /buildCombatConsole\(this\)/);
  assert.match(ui, /const cc = this\.console;/);
  assert.match(ui, /id="hp-fill"|hp-fill/);
  assert.match(src('index.html'), /<i id="hp-fill"/);
});

test('10.13 (8.5) : boosts sous les événements, alignés à droite ; la bulle « Bonus du moment » reste dans l\'écran', () => {
  const d = css('src/ui/desk-hud.css');
  assert.match(d, /#boost-group \{ top: calc\(8px \+ var\(--ev-h\) \+ 8px\) !important/);
  const t = src('src/ui/tutorial.js');
  assert.match(t, /preferBelow/);
  assert.match(t, /innerWidth - 8 - bw/); // garde-fou final
  assert.match(t, /documentElement\.style\.zoom/); // le zoom de l'interface est pris en compte
});

test('10.13 (8.6) : la rangée d\'événements s\'affiche dès qu\'une partie est avancée, même à 0 s de jeu (sauvegarde chargée)', () => {
  const h = src('src/ui/hud-quests.js');
  assert.match(h, /const advanced = \(state\.records\?\.rebirths \?\? 0\) > 0/);
  assert.match(h, /\(calm\.early && !advanced\)/);
});

test('10.13 (8) : scène étroite sur PC (panneau ouvert à côté) — mise en page compacte du téléphone 10.13.0, FIGÉE (tools/hud-narrow-source.css) : le téléphone 10.13.1 (maquette t07) n\'y touche pas', () => {
  const desk = src('src/ui/desk-hud.css'), mob = src('tools/hud-narrow-source.css');
  const block = desk.slice(desk.indexOf('/* >>> hud-narrow'), desk.indexOf('/* <<< hud-narrow */'));
  assert.ok(block.length > 2000, 'bloc hud-narrow présent');
  const expected = mob.replace(/^\/\*[\s\S]*?\*\/\n/, '').replace(/#app#app\.m-phone/g, '#app#app.hud-narrow').replace(/#app\.m-phone/g, '#app#app.hud-narrow').trimEnd();
  assert.ok(block.includes(expected), 'desk-hud.css est à jour : relancer node tools/sync-hud-narrow.mjs');
  assert.match(src('src/ui/ui.js'), /const narrow = !this\.root\.classList\.contains\('m-phone'\) && area\.clientWidth < 820;/);
});

test('10.13.1 (téléphone, t07) : mobile-hud.css n\'a plus à suivre la scène étroite du PC ; le bloc figé reste celui de 10.13.0', () => {
  const m = src('src/ui/mobile-hud.css'), frozen = src('tools/hud-narrow-source.css');
  assert.notEqual(m, frozen, 'le téléphone a sa propre mise en page (grille d\'événements, console)');
  assert.match(frozen, /width: 58px !important; height: 82px/); // l'ancienne rangée d'événements (PC étroit)
  assert.match(src('tools/sync-hud-narrow.mjs'), /hud-narrow-source\.css/);
});

test('10.13.1 (téléphone, t07) : carte de zone, événements, Carnet, console — les règles du téléphone', () => {
  const m = css('src/ui/mobile-hud.css');
  assert.match(m, /--evw: 178px/);
  assert.match(m, /#zone-card \{[^}]*height: 76px/);
  assert.match(m, /#zone-card::before \{[^}]*height: var\(--pzone-h\)/);
  assert.match(m, /#hq-left > #hq-carnet \{[^}]*order: -1[^}]*border: 2px solid var\(--hud-gold\)/); // même cadre que la zone
  assert.match(m, /#auto-toggle \{[^}]*width: var\(--evw\)/);
  assert.match(m, /#combat-console #boost-group #boost-toggle/); // « Boosts » est une étiquette de la console
  assert.match(m, /#skill-bar \.skill-btn\.big \.cd::after \{[^}]*counter\(sk\)/); // numéros 1, 2, 3
  const h = src('src/ui/hud-quests.js');
  assert.match(h, /if \(this\.mphone\) return 8;/);
  assert.match(h, /hq-carnet-title" data-action="open-tab" data-value="daybook">Carnet du jour/);
  const u = src('src/ui/ui.js'), c = src('src/ui/combat-console.js');
  assert.match(u, /Boss dans \$\{n\} étape/);
  assert.match(u, /placeBoostGroup\(this\)/);
  assert.match(c, /export function placeBoostGroup/);
  assert.match(c, /classList\.contains\('m-phone'\)/); // le PC ne bouge pas
});

test('10.13.1 (téléphone, § 7) : la mini-scène des onglets remplit la largeur (téléphone seulement)', () => {
  const p = src('src/ui/page.js');
  assert.match(p, /const fill = band && document\.getElementById\('app'\)\?\.classList\.contains\('m-phone'\)/);
  assert.match(p, /fill \? Math\.min\(H, 180 \* kc\) : H \* 0\.3/);
});
