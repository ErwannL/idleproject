// v10.6 (docs/prompt-v10.6/PROMPT.md) : coffre hors du terrain, quêtes et événements de l'écran de jeu, Marché des
// Lueurs illustré, Prime du Héraut, Sceau du débutant, CSP de la carte de bénédiction.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

globalThis.localStorage ??= { getItem: () => null, setItem: () => {}, removeItem: () => {} };

const { createNewState } = await import('../src/core/state.js');
const { nextAction } = await import('../src/core/guide.js');
const L = await import('../src/core/lights.js');
const B = await import('../src/core/herald-bounty.js');
const { daybookTrack } = await import('../src/core/daybook.js');
const { eventRecord } = await import('../src/core/ancients.js');
const src = (p) => readFileSync(p, 'utf8');
const SMALL = new Date('2026-11-21T12:00:00').getTime(); // jour 6 du Marché des Lueurs (calendrier)
const GRAND = new Date('2026-11-05T12:00:00').getTime(); // Expédition des Anciens

test('10.6 (8) : avant l\'étape 1-10, le Sceau ne parle jamais de la Forge, de la Fusion ni du Renforcement', () => {
  for (const stage of [1, 3, 5, 7, 9]) {
    const s = createNewState(Date.now());
    s.stage = stage; s.maxStage = stage; s.records.bestStage = stage;
    s.unlocks = { done: ['equipment', 'upgrades', 'skills', 'companion'], base: { ...s.records } }; // quête en cours : la Forge
    const a = nextAction(s, { fusionReady: true, visible: {} });
    assert.ok(!/Forge|Fusion|Renforc/i.test(a?.text ?? ''), `étape ${stage} : « ${a?.text} »`);
  }
});

test('10.6 (9) : plus de onerror="…" en ligne (bloqué par la CSP), la carte de bénédiction passe par l\'écouteur commun', () => {
  assert.ok(!/onerror="/.test(src('src/ui/ui.js')));
  assert.match(src('src/ui/ui.js'), /boon-art" src="[^"]+" alt="" data-fallback="remove"/);
});

test('10.6 (3) : Marché des Lueurs — Lueurs, carte de 10 lanternes, grand prix au bout, échoppe', () => {
  const s = createNewState(SMALL);
  assert.ok(L.lightsEvent(SMALL), 'petit événement en cours le 21/11');
  assert.equal(L.lightsEvent(GRAND), null);
  assert.equal(L.lightsPath(s, SMALL).length, 10);
  assert.ok(L.lightsPath(s, SMALL).at(-1).prize, 'le grand prix est la dernière étape');
  assert.equal(L.lightsWallet(s, SMALL).earned, 0);
  const rec = eventRecord(s, SMALL);
  rec.goals.kills = 5000; rec.claimed.push('kills'); rec.goals.bosses = 12;
  const w = L.lightsWallet(s, SMALL);
  assert.equal(w.earned, 20 + 5 + 12, '5 000 monstres (20) + lanterne (5) + 12 boss');
  assert.ok(L.lightsPosition(s, SMALL) >= 3, 'le portrait avance');
  const before = s.gems;
  assert.ok(L.claimLightsStep(s, 0, SMALL));
  assert.equal(s.gems, before + 50);
  assert.equal(L.claimLightsStep(s, 0, SMALL), null, 'une seule fois');
  assert.equal(L.claimLightsStep(s, 9, SMALL), null, 'grand prix pas encore atteint');
  const shop = L.lightsShop(s, SMALL);
  assert.ok(shop.length >= 4 && shop.length <= 6);
  assert.ok(L.buyLights(s, 'tickets', SMALL));
  assert.equal(L.lightsWallet(s, SMALL).have, w.earned - 20);
  assert.equal(L.lightsWallet(s, SMALL).earned, w.earned, 'dépenser ne fait pas reculer sur la carte');
  // Grand prix : la Fée.
  rec.goals = { kills: 5000, bosses: 30, dungeons: 5, summons: 20 }; rec.claimed = ['kills', 'bosses', 'dungeons', 'summons'];
  assert.ok(L.lightsWallet(s, SMALL).earned >= L.LIGHTS_EVENT.path.at(-1).at);
  delete s.companions.owned.fairy;
  const r = L.claimLightsStep(s, 9, SMALL);
  assert.equal(r.companion, 'fairy');
  assert.ok(s.companions.owned.fairy);
});

test('10.6 (3) : chaque image du modèle d\'événement existe (affiche, lanternes, grand prix, missions, échoppe)', () => {
  const E = L.LIGHTS_EVENT;
  for (const p of Object.values(E.art)) assert.ok(existsSync(p), p);
  for (const m of Object.values(E.missions)) assert.ok(existsSync(L.lightsArt(m.art)), m.art);
  for (const i of E.shop) assert.ok(existsSync(L.lightsArt(i.art)), i.art);
  const page = src('src/ui/panels/event.js');
  for (const k of ['lt-key', 'lt-map', 'lt-tile', 'lt-shop', 'lt-key-prize']) assert.ok(page.includes(k), k);
});

test('10.6 (2.4) : Prime du Héraut — 2 au plus par jour, 6 h, refusable, remplie par un donjon gagné', () => {
  const s = createNewState(SMALL);
  s.maxStage = 200; s.records.bestStage = 200;
  assert.equal(B.maybeStartBounty(s, SMALL, 10), null, 'pas dès l\'ouverture');
  const a = B.maybeStartBounty(s, SMALL, 200);
  assert.ok(a?.name && a.left === 6 * 3600000);
  assert.equal(B.maybeStartBounty(s, SMALL + 1000, 200), null, 'une à la fois');
  assert.equal(B.claimBounty106(s, SMALL), null, 'pas encore gagnée');
  daybookTrack(s, 'dungeons', 1, SMALL + 60000);
  assert.ok(B.activeBounty(s, SMALL + 60000).done);
  const g = B.claimBounty106(s, SMALL + 60000);
  assert.equal(g.gems, B.BOUNTY.reward.gems);
  // Deuxième de la journée, après la pause ; refusée ; pas de troisième.
  const t2 = SMALL + 60000 + B.BOUNTY.gapHours * 3600000 + 1;
  assert.ok(B.maybeStartBounty(s, t2, 200));
  assert.ok(B.refuseBounty(s, t2));
  assert.equal(B.maybeStartBounty(s, t2 + 4 * 3600000, 200), null, '2 au plus par jour');
});

test('10.6 (2) : écran de jeu — Chemin du héros, Carnet en 3 lignes, colonne d\'événements, Prime ; anciens éléments rangés', () => {
  const h = src('src/ui/hud-quests.js');
  for (const k of ['hq-path', 'hq-carnet', 'hq-events', 'hq-bounty', 'Carnet du jour', 'Chemin du héros', 'slice(0, 3)', 'phone && !expanded ? 4']) assert.ok(h.includes(k), k);
  const ui = src('src/ui/ui.js');
  assert.match(ui, /for \(const id of \['quest-banner', 'rift-chip', 'bastion-tower'\]\)/);
  const css = src('src/ui/hud106.css');
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /\.calm #hq-events \.hq-ev\.hot/);
  for (const f of ['hud_event_market', 'hud_event_rift', 'hud_event_wheel', 'hud_event_arena', 'hud_event_daily_chest', 'hud_event_bastion', 'hud_bounty_frame', 'hud_bounty_stamp', 'fx_quest_done', 'fx_reward_fly', 'fx_hot_glow'])
    assert.ok(existsSync(`assets/ui/art106/${f}.png`), f);
  for (let i = 1; i <= 12; i++) assert.ok(existsSync(`assets/ui/art106/hud_quest_chapter_${i}.png`));
});
