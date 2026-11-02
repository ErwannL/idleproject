// v9.1.3 (chantier 4) : Aventure, Objectifs, invocation, expéditions — logique et rendu des panneaux en Node.
import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.localStorage ??= { getItem: () => null, setItem: () => {}, removeItem: () => {} };
const ctx2d = new Proxy({}, {
  get: (t, k) => (k === 'getImageData' || k === 'createImageData'
    ? (x, y, w = 1, h = 1) => ({ data: new Uint8ClampedArray(Math.max(1, (w | 0) * (h | 0)) * 4), width: w, height: h })
    : k === 'measureText' ? () => ({ width: 1 }) : k in t ? t[k] : () => {}),
  set: (t, k, v) => { t[k] = v; return true; },
});
globalThis.document ??= { createElement: () => ({ width: 1, height: 1, getContext: () => ctx2d, toDataURL: () => 'data:' }) };

const NOW = Date.UTC(2026, 10, 2, 12);
const { createNewState } = await import('../src/core/state.js');
const { ACHIEVEMENTS, achievementGroups, claimAchievement } = await import('../src/core/achievements.js');
const { rewardIcons } = await import('../src/ui/common.js');
const contracts = (await import('../src/ui/panels/contracts.js')).default;
const summon = (await import('../src/ui/panels/summon.js')).default;
const expeditions = (await import('../src/ui/panels/expeditions.js')).default;
const tower = (await import('../src/ui/panels/tower.js')).default;
const dungeons = (await import('../src/ui/panels/dungeons.js')).default;
const campaign = (await import('../src/ui/panels/campaign.js')).default;
const { nextAction } = await import('../src/core/guide.js');

const uiWith = (view = {}, open = []) => ({ view: { open: new Set(open), closed: new Set(), ...view }, tabVisible: {}, claims: [], invalidate: () => {} });

test('A8 : hauts faits par métrique, palier prêt le plus bas, claimed par id, gemmes inchangées', () => {
  const s = createNewState(NOW);
  const groups = achievementGroups(s);
  assert.equal(groups.length, new Set(ACHIEVEMENTS.map((a) => a.metric)).size);
  assert.ok(groups.length <= 13);
  s.records.kills = 20000; // paliers 100 et 10 000 prêts
  const g = achievementGroups(s).find((x) => x.metric === 'kills');
  assert.equal(g.tier.id, 'kills1');
  assert.equal(g.readyCount, 2);
  const gems = s.gems;
  claimAchievement(s, g.tier.id);
  assert.equal(s.gems, gems + 20);
  assert.equal(s.achievements.claimed.kills1, true);
  const g2 = achievementGroups(s).find((x) => x.metric === 'kills');
  assert.equal(g2.tier.id, 'kills2');
  claimAchievement(s, 'kills2');
  const g3 = achievementGroups(s).find((x) => x.metric === 'kills');
  assert.equal(g3.tier.id, 'kills3');
  assert.equal(g3.ready, false);
  const html = contracts.render(uiWith({ missionTab: 'achievements' }), s);
  assert.equal((html.match(/class="ach[ "]/g) ?? []).length, groups.length);
  assert.match(html, /Fléau des monstres/);
});

test('A7 : rewardIcons — icône et nombre, texte complet en title et aria-label', () => {
  const html = rewardIcons({ gold: 1200, gems: 30, keys: 1 });
  assert.equal((html.match(/class="rw"/g) ?? []).length, 3);
  assert.match(html, /aria-label="\+1[\s\S]*gemmes/);
  assert.equal(rewardIcons({}), '');
  const s = createNewState(NOW);
  s.ui.goalsOpen = true;
  const html2 = contracts.render(uiWith({ missionTab: 'today' }), s);
  assert.ok(!/m-reward"/.test(html2), 'un seul emplacement par ligne');
  assert.ok(!/contrats progressent tout seuls/.test(html2), 'explication en double retirée');
});

test('Invocation : 3 bassins visibles, plus d\'onglets, probabilités derrière « ? »', () => {
  const s = createNewState(NOW);
  const html = summon.render(uiWith(), s);
  assert.equal((html.match(/data-action="summon-odds"/g) ?? []).length, 3);
  assert.ok(!/summon-pool/.test(html));
  assert.ok(!/odds-group/.test(html));
  assert.match(summon.render(uiWith({ summonOdds: 'ally' }), s), /odds-group/);
});

test('Expéditions : une ligne par place, durée commune, plus de formulaire répété', () => {
  const s = createNewState(NOW);
  s.companions.owned.cat = { level: 1, stars: 1 };
  s.companions.owned.owl = { level: 1, stars: 1 };
  const html = expeditions.render(uiWith(), s);
  assert.equal((html.match(/data-action="start-expedition"/g) ?? []).length, s.expeditions.slots.length);
  assert.ok(!/exp-dur-sel/.test(html));
  assert.match(expeditions.render(uiWith({ expPerSlot: true, expDur: 'journey' }), s), /exp-dur-sel[\s\S]*\|journey\|/);
});

test('Défis : le Défi de la semaine est jouable avant la Tour ; Donjons ne l\'affiche plus', () => {
  const s = createNewState(NOW);
  s.maxStage = 50; s.records.bestStage = 50;
  const html = tower.render(uiWith(), s);
  assert.match(html, /data-action="enter-challenge"/);
  assert.ok(!/data-action="enter-tower"/.test(html));
  assert.ok(!/enter-challenge/.test(dungeons.render(uiWith(), s)));
  s.challenge = { wave: 2, zone: 0, kills: 0 };
  assert.equal(nextAction(s).tab, 'tower');
});

test('Carte : carte peinte cliquable par monde à la place du menu déroulant', () => {
  const s = createNewState(NOW);
  s.maxStage = 75; s.stage = 74;
  const html = campaign.render(uiWith(), s);
  assert.match(html, /mini-map/);
  assert.ok(!/zone-select/.test(html));
  assert.ok((html.match(/class="map-dot/g) ?? []).length >= 10);
});
