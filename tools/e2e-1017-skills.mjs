// v10.17 (B) : les touches d'attaque répondent à chaque appui.
//   node tools/e2e-1017-skills.mjs [--sizes 412x915,390x844,360x800,1366x768] [--taps 30] [--waves 10]
// B5 : au centre de chaque .skill-btn et du bouton Ultime, document.elementFromPoint() renvoie ce bouton (aucune zone de clic
//      de #boost-toggle / #boost-group hors de leur dessin).
// Appuis : vrais appuis (page.touchscreen.tap sur téléphone, souris sur PC) sur une touche prête, ennemi à portée → autant
//      de lancers (records.manualCasts) ; puis des appuis entre deux vagues (aucun ennemi à portée) → autant de lancers à
//      l'arrivée de l'ennemi. Code de sortie 1 au moindre écart.
import { makeOpt, parseSizes, startApp, openGame } from './lib-1013.mjs';

const opt = makeOpt(process.argv.slice(2));
const sizes = parseSizes(opt('sizes', '412x915,390x844,360x800,1366x768'));
const TAPS = Number(opt('taps', 30));
const WAVES = Number(opt('waves', 10));
let fails = 0;
const say = (ok, msg) => { if (!ok) fails++; console.log(`${ok ? 'OK ' : 'ÉCHEC'} ${msg}`); };

// Centre de chaque touche, et l'élément trouvé à cet endroit.
const hitTest = (page) => page.evaluate(() => {
  const out = [];
  for (const b of document.querySelectorAll('#skill-bar .skill-btn, #skill-bar .ult-btn')) {
    const r = b.getBoundingClientRect();
    if (!r.width) continue;
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const el = document.elementFromPoint(x, y);
    out.push({ who: b.dataset.skill ?? 'ultime', ok: Boolean(el && (el === b || b.contains(el))), got: el ? `${el.tagName.toLowerCase()}#${el.id}.${[...el.classList].join('.')}` : 'rien' });
  }
  return out;
});

// Une touche d'attaque sans autre lanceur : mode Manuel (pas d'auto), recharges remises à zéro entre deux appuis.
const setup = (page) => page.evaluate(() => {
  const s = __idle.state;
  s.skillAuto = false;
  s.ui.combatAssist = 'manual';
});

async function tapSkill(page, phone, id) {
  const b = await page.$(`#skill-bar .skill-btn[data-skill="${id}"]`);
  const r = await b.boundingBox();
  const x = r.x + r.width / 2, y = r.y + r.height / 2;
  if (phone) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y);
}

const app = await startApp();
for (const [w, h] of sizes) {
  const g = await openGame(app, 'endgame', w, h);
  const { page, phone } = g;
  await page.waitForSelector('#skill-bar .skill-btn', { timeout: 15000 }).catch(() => null);
  // B5
  const hits = await hitTest(page);
  say(hits.length > 0 && hits.every((x) => x.ok), `${w}x${h} B5 centre des touches : ${hits.map((x) => `${x.who}${x.ok ? '' : ` → ${x.got}`}`).join(', ') || 'aucune touche'}`);
  // Ultime forcé (bouton ajouté sans reconstruire la barre) : même contrôle.
  const ultSame = await page.evaluate(() => {
    const before = [...document.querySelectorAll('#skill-bar .skill-btn')];
    const w = __idle.world; const c = (__idle.state.companions?.equipped ?? [])[0];
    if (!c) return null;
    w.ultReady = { ...(w.ultReady ?? {}), [`${c}#0`]: true };
    return { before: before.length, id: c };
  });
  if (ultSame) {
    await page.waitForTimeout(400);
    const same = await page.evaluate((n) => { const now = [...document.querySelectorAll('#skill-bar .skill-btn')]; return now.length === n && now.every((b) => b.isConnected) && Boolean(document.querySelector('#skill-bar .ult-btn')); }, ultSame.before);
    const hits2 = await hitTest(page);
    say(same && hits2.every((x) => x.ok), `${w}x${h} Ultime ajouté sans reconstruire les touches ; centres : ${hits2.map((x) => `${x.who}${x.ok ? '' : ` → ${x.got}`}`).join(', ')}`);
  }

  await setup(page);
  const id = await page.evaluate(() => document.querySelector('#skill-bar .skill-btn')?.dataset.skill);
  if (!id) { say(false, `${w}x${h} aucune touche d'attaque`); await g.ctx.close(); continue; }
  // 1) touche prête, ennemi à portée.
  let ok = 0, tried = 0;
  for (let i = 0; i < TAPS; i++) {
    const inRange = await page.waitForFunction(() => { const w = __idle.world; const e = w.enemies?.[0]; return Boolean(e && !w.hero?.dead && e.hp > 0 && (e.engaged || e.arrived)); }, null, { timeout: 8000 }).then(() => true).catch(() => false);
    const before = await page.evaluate((sid) => { const w = __idle.world; w.skillTimers[sid] = 0; w.manualPending?.clear(); return __idle.state.records.manualCasts ?? 0; }, id);
    await page.waitForTimeout(130); // la touche s'allume
    await tapSkill(page, phone, id);
    tried++;
    const cast = await page.waitForFunction((n) => (__idle.state.records.manualCasts ?? 0) > n, before, { timeout: 6000 }).then(() => true).catch(() => false);
    if (cast) ok++;
    else if (!inRange) tried--; // pas d'ennemi du tout : appui non compté ici
    else console.log('   raté :', await page.evaluate((sid) => { const w = __idle.world; return JSON.stringify({ pending: [...(w.manualPending ?? [])], t: w.skillTimers[sid], n: w.enemies.length, dead: w.hero?.dead, ev: document.querySelector('#skill-bar .skill-btn')?.className }); }, id));
  }
  say(ok === tried && tried >= TAPS * 0.8, `${w}x${h} ${tried} appuis (${phone ? 'tactiles' : 'souris'}) ennemi à portée → ${ok} lancers`);
  // Retour visible : la touche s'enfonce.
  const pressed = await page.evaluate(() => new Promise((res) => { const b = document.querySelector('#skill-bar .skill-btn'); const r = b.getBoundingClientRect(); b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: r.left + 5, clientY: r.top + 5 })); res(b.classList.contains('pressed')); }));
  say(pressed, `${w}x${h} la touche s'enfonce à l'appui (.pressed)`);
  // 2) entre deux vagues : plus aucun ennemi, appuis gardés.
  let launched = 0, shown = 0;
  for (let i = 0; i < WAVES; i++) {
    const before = await page.evaluate((sid) => {
      const w = __idle.world;
      w.enemies.length = 0; // fin de vague : plus personne devant le héros
      w.skillTimers[sid] = 0; w.manualPending?.clear();
      return __idle.state.records.manualCasts ?? 0;
    }, id);
    await page.waitForTimeout(120);
    await tapSkill(page, phone, id);
    await page.waitForTimeout(250);
    const queued = await page.evaluate((sid) => Boolean(__idle.world.manualPending?.has(sid)) && document.querySelector(`#skill-bar .skill-btn[data-skill="${sid}"]`).classList.contains('queued'), id);
    if (queued) shown++;
    const cast = await page.waitForFunction((n) => (__idle.state.records.manualCasts ?? 0) > n, before, { timeout: 15000 }).then(() => true).catch(() => false);
    if (cast) launched++;
  }
  say(launched === WAVES, `${w}x${h} ${WAVES} appuis entre deux vagues → ${launched} lancers à l'arrivée de l'ennemi (« ✓ en attente » vu ${shown} fois)`);
  if (g.jsErrors.length) say(false, `${w}x${h} erreurs JS : ${g.jsErrors.slice(0, 3).join(' | ')}`);
  await g.ctx.close();
}
await app.close();
console.log(fails ? `${fails} échec(s)` : 'Tout est bon.');
process.exit(fails ? 1 : 0);
