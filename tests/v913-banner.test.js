// v9.1.3 (doc4 partie B, lots 4 à 7) : bannières de 14 jours, filet, Légendaire perdu, Archives, budget B, mode monde,
// score reproductible, score en ligne (validation serveur). Perso de démonstration `demo_ssr` (drapeau coupé par défaut).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BANNER_RULES, BANNER_UNITS, UNITS, setBannersEnabled, startDemoBanner } from '../src/data/banners.js';
import { COMPANIONS } from '../src/data/companions.js';
import { BALANCE } from '../src/data/balance.js';
import { COMPANION_ROLES } from '../src/data/synergies.js';
import { AURA_COLORS } from '../src/data/auras.js';
import { createNewState, sanitizeState, SAVE_VERSION } from '../src/core/state.js';
import { featuredUnit, summon, summonOdds, summonPool } from '../src/core/gacha.js';
import { Rng } from '../src/core/rng.js';
import { archiveTargets, budget, claimReleaseGift, currentBanner, lastBanner, nextBanner, releaseIndex, startWorldRun, worldStatus } from '../src/core/banner.js';
import { companionMultiplier, companionSkillMultiplier, companionById } from '../src/core/companions.js';
import { sectionProgress } from '../src/core/encyclopedia.js';
import { createCombat, currentEncounter, step } from '../src/core/combat.js';
import { measureFarmRate } from '../src/core/offline.js';
import { TOWER_BOSSES, towerBoss } from '../src/core/tower.js';
import { BOSSES } from '../src/data/enemies.js';
import { SAVE_KEY, loadGame } from '../src/core/save.js';
import { extractScores, scoreCap } from '../server/app.mjs';

const DAY = 86400000;
const START = new Date(`${BANNER_RULES.start}T00:00:00`).getTime();
const J = (d) => START + (d - 1) * DAY + 12 * 3600000; // midi du jour J de la sortie 1
const REF = JSON.parse(readFileSync(new URL('./helpers/v913-comptes-reference.json', import.meta.url), 'utf8'));

// v9.2.8 : filet, mémoire « Légendaire perdu » et Archives remplacés par les règles du document du producteur
// (50/50 et garantie de la vedette, SSR au 100, bannière permanente avec wishlist) : tests/v928-economy.test.js.
test('drapeau coupé (défaut) : aucun perso de bannière, aucune bannière, budget 100 ; la limitée met en vedette un SSR permanent', () => {
  setBannersEnabled(false);
  assert.equal(BANNER_RULES.enabled, false);
  assert.equal(UNITS.length, COMPANIONS.length);
  assert.equal(currentBanner(J(3)), null);
  assert.equal(releaseIndex(J(3)), 0);
  assert.equal(budget(companionById('shadow_lord'), J(400)), 100);
  assert.equal(featuredUnit('limited', J(3)).rarity, 'legendary');
  assert.ok(!featuredUnit('limited', J(3)).bannerOnly);
});

test('lot 4 : bassin permanent gelé (8 R, 7 SR, 5 SSR) ; un perso de bannière n\'y entre jamais', () => {
  setBannersEnabled(false);
  const before = summonPool('permanent').map((u) => u.id);
  setBannersEnabled(true);
  const pool = summonPool('permanent');
  assert.deepEqual(pool.map((u) => u.id), before);
  const count = (r) => pool.filter((u) => u.rarity === r).length;
  assert.deepEqual([count('rare'), count('epic'), count('legendary')], [8, 7, 5]);
  assert.ok(!pool.some((u) => u.bannerOnly));
});

test('lot 4 : tout bannerOnly a un rôle (Archer, Assassin, Mage, Berserker), une aura, un sprite, et la vedette apparaît dans summonOdds', () => {
  setBannersEnabled(true);
  const art = readFileSync(new URL('../src/render/art.js', import.meta.url), 'utf8');
  for (const u of BANNER_UNITS) {
    assert.equal(u.bannerOnly, true);
    assert.ok(['archer', 'assassin', 'mage', 'berserker'].includes(COMPANION_ROLES[u.id]), `${u.id} : rôle`);
    assert.ok(AURA_COLORS[u.id], `${u.id} : aura`);
    assert.ok(art.includes(`"${u.sprite}"`) || art.includes(`${u.sprite}:`), `${u.id} : sprite ${u.sprite}`);
    assert.equal(u.rarity, 'legendary');
    assert.ok(Number.isInteger(u.release) && u.release >= 1);
  }
  const odds = summonOdds('banner', BALANCE, J(2)).find((r) => r.rarity === 'legendary');
  const f = odds.units.find((x) => x.featured);
  assert.equal(f.id, 'demo_ssr');
  assert.ok(Math.abs(f.chance - 0.01) < 1e-12, '2 % × 50 %');
  assert.ok(Math.abs(odds.chance - 0.02) < 1e-12);
  assert.equal(summonOdds('banner', BALANCE, J(2)).reduce((s, r) => s + r.chance, 0).toFixed(9), '1.000000000');
});

test('lot 4 → v9.2.8 : SSR perdu → le suivant est la vedette de la bannière ; garantie gardée d\'une bannière à l\'autre', () => {
  setBannersEnabled(true);
  const now = J(2);
  const s = createNewState(now, 7);
  s.gems = 1e6;
  s.summon.pity.limited = { ssr: 99, sr: 0, guaranteed: true };
  const r = summon(s, new Rng(4), 1, 'gems', BALANCE, 'banner', now);
  assert.equal(r[0].id, 'demo_ssr');
  assert.equal(s.summon.pity.limited.guaranteed, false, 'consommée');
  const back = sanitizeState(JSON.parse(JSON.stringify({ ...s, summon: { ...s.summon, pity: { ...s.summon.pity, limited: { ssr: 40, sr: 2, guaranteed: true } } } })), BALANCE, J(16));
  assert.deepEqual(back.summon.pity.limited, { ssr: 40, sr: 2, guaranteed: true });
});

test('lot 4 : budget B (formules) et effet sur passif, compétences, plafond soin', () => {
  setBannersEnabled(true);
  const demo = companionById('demo_ssr');
  assert.equal(budget(demo, J(3)), Math.max(107 + 1, 87 + 1));
  assert.equal(budget(demo, J(1) + 30 * 14 * DAY), 87 + 31, 'k_jour = 31');
  assert.equal(budget(companionById('shadow_lord'), J(3)), 100);
  assert.equal(budget(companionById('shadow_lord'), J(1) + 20 * 14 * DAY), 108);
  assert.equal(budget(companionById('barbarian'), J(1) + 20 * 14 * DAY), 100);
  assert.equal(budget(companionById('wisp'), J(1) + 20 * 14 * DAY), 100);
  const s = createNewState(J(3));
  s.companions.owned.demo_ssr = { stars: 1, level: 1 };
  s.companions.owned.archangel = { stars: 6, level: 20 };
  setBannersEnabled(false);
  const archHeal = companionSkillMultiplier(s, companionById('archangel'), 'heal', true);
  setBannersEnabled(true);
  const real = Date.now;
  Date.now = () => J(1) + 20 * 14 * DAY;
  try {
    assert.ok(Math.abs(companionSkillMultiplier(s, companionById('archangel'), 'heal', true) - Math.min(archHeal * 1.08, 3 * 1.08)) < 1e-9);
    assert.ok(companionMultiplier(s, 'demo_ssr') > 0);
  } finally { Date.now = real; }
});

test('lot 4 : cadeau de sortie 3 000 gemmes (30 tickets × 100), une seule fois par bannière', () => {
  setBannersEnabled(true);
  const s = createNewState(J(1));
  const g = s.gems;
  assert.equal(claimReleaseGift(s, J(1)), 3000);
  assert.equal(claimReleaseGift(s, J(9)), 0);
  assert.equal(s.gems, g + 3000);
  assert.equal(sanitizeState(JSON.parse(JSON.stringify(s)), BALANCE, J(9)).summon.gift, 1);
});

test('lot 4 : encyclopédie à 100 % sans aucun bannerOnly ; hauts faits sur les 31 unités (v9.2.9 : + 5 familiers) permanentes', () => {
  setBannersEnabled(true);
  const s = createNewState(J(3));
  for (const c of COMPANIONS) s.companions.owned[c.id] = { stars: 1, level: 1 };
  const p = sectionProgress(s, 'companions');
  assert.equal(p.found, p.total);
  assert.equal(p.total, 31);
});

test('lot 4 : sauvegarde v8 — étoiles et niveaux identiques ; perso inconnu de ce client gardé (pas de montée à 9)', () => {
  setBannersEnabled(true);
  assert.equal(SAVE_VERSION, 13); // v9.3.8 : 12 → 13 (6 places, pièces séparées) // v9.3.4 : 11 → 12 (équipement unique) // v9.3.3 : 10 → 11 (niveaux de compétence) // v9.2.0 (monde marin) : 8 → 9 (Royaume englouti, étapes converties) · v9.2.8 : 9 → 10 (économie)
  const s = createNewState(J(3));
  s.companions.owned = { shadow_lord: { stars: 6, level: 20 }, demo_ssr: { stars: 3, level: 7 }, cat: { stars: 2, level: 4 } };
  s.companions.equipped = ['shadow_lord', 'demo_ssr'];
  const raw = JSON.parse(JSON.stringify(s));
  assert.deepEqual(sanitizeState(raw, BALANCE, J(3)).companions.owned, s.companions.owned);
  // Client qui ne connaît pas ce perso (drapeau coupé, ou sortie plus ancienne) : il le garde de côté sans l'effacer.
  setBannersEnabled(false);
  const old = sanitizeState(JSON.parse(JSON.stringify(raw)), BALANCE, J(3));
  assert.equal(old.companions.owned.demo_ssr, undefined);
  assert.deepEqual(old.companions.unknown.demo_ssr, { stars: 3, level: 7 });
  assert.deepEqual(old.companions.equipped, ['shadow_lord']);
  // … et le rend tel quel au client qui le connaît (sauvegarde renvoyée par le client ancien).
  setBannersEnabled(true);
  const back = sanitizeState(JSON.parse(JSON.stringify(old)), BALANCE, J(3));
  assert.deepEqual(back.companions.owned.demo_ssr, { stars: 3, level: 7 });
  // Un format plus récent reste bloqué (garde existante).
  const st = new Map();
  const storage = { getItem: (k) => st.get(k) ?? null, setItem: (k, v) => st.set(k, v), removeItem: (k) => st.delete(k) };
  storage.setItem(SAVE_KEY, JSON.stringify({ ...raw, version: SAVE_VERSION + 1 }));
  assert.equal(loadGame(storage, BALANCE, J(3)).source, 'newer');
});

test('lot 5 : calendrier — J-7 aperçu, fin de bannière, aucun badge ni tri de recommandation dans l\'écran', () => {
  setBannersEnabled(true);
  assert.equal(nextBanner(START - 8 * DAY), null);
  assert.equal(nextBanner(START - 6 * DAY)?.unit.id, 'demo_ssr');
  assert.equal(currentBanner(J(14)).day, 14);
  assert.equal(currentBanner(J(15)), null);
  assert.equal(lastBanner(J(15)).unit.id, 'demo_ssr');
  const src = readFileSync(new URL('../src/ui/panels/summon.js', import.meta.url), 'utf8') + readFileSync(new URL('../src/ui/panels/world.js', import.meta.url), 'utf8');
  for (const word of ['recommand', 'Conseillé', 'conseillé', 'meilleur choix', 'rentable', '.sort(']) assert.ok(!src.includes(word), `aucun « ${word} »`);
});

// ——— Lot 6 : mode monde et score ———
function account(name, now) {
  const s = sanitizeState(JSON.parse(JSON.stringify(REF[name])), BALANCE, now);
  s.companions.owned = { demo_ssr: { stars: 1, level: 1 }, shadow_lord: { stars: 1, level: 1 }, wisp: { stars: 1, level: 1 } };
  s.companions.equipped = ['shadow_lord', 'demo_ssr', 'wisp'];
  return s;
}
function runUntilEnd(s, w, rng, max = 4000) {
  let ev = null;
  for (let i = 0; i < max && s.worldRun; i++) {
    step(s, w, BALANCE.simulation.tickSeconds, rng);
    ev = w.events.find((e) => e.type === 'worldEnded') ?? ev;
    w.events.length = 0;
  }
  return ev;
}

test('lot 6 : mode à part — branche de currentEncounter, campagne et Tour inchangées, neutralisé dans la mesure hors ligne', () => {
  startDemoBanner(J(9), 9);
  const s = account('moyen', J(9));
  const stage = s.stage;
  const w = createCombat(s);
  assert.ok(startWorldRun(s, w, 'demo_ssr', 'level', 1, {}, J(9)).ok);
  const enc = currentEncounter(s);
  assert.equal(enc.world, true);
  assert.equal(enc.boss, false);
  assert.equal(s.stage, stage);
  const rate = measureFarmRate(s, BALANCE, 10);
  assert.ok(rate.goldPerSecond > 0);
  assert.ok(s.worldRun, 'la mesure travaille sur une copie');
  assert.equal(TOWER_BOSSES.length, 46);
  assert.ok(TOWER_BOSSES.every((id) => BOSSES[id]));
  assert.equal(towerBoss(10), 'slime_king');
});

test('lot 6 : calendrier du monde (J1, J4, J8, J10) et affinité étendue (×6 chez lui)', () => {
  startDemoBanner(J(1), 1);
  const s = createNewState(J(1));
  assert.deepEqual([worldStatus(s, 'demo_ssr', J(1)).tiersOpen, worldStatus(s, 'demo_ssr', J(4)).tiersOpen, worldStatus(s, 'demo_ssr', J(8)).tiersOpen], [0, 3, 5]);
  assert.deepEqual([worldStatus(s, 'demo_ssr', J(9)).levelsOpen, worldStatus(s, 'demo_ssr', J(10)).levelsOpen], [9, 10]);
  assert.equal(worldStatus(s, 'demo_ssr', J(2)).trial, true);
  assert.equal(worldStatus(s, 'demo_ssr', J(20)).trial, false, 'plus d\'essai après la bannière');
  assert.equal(worldStatus(s, 'demo_ssr', J(20)).tiersOpen, 5);
  s.companions.owned.demo_ssr = { stars: 1, level: 1 };
  const c = companionById('demo_ssr');
  const out = companionSkillMultiplier(s, c, 'hit', false);
  s.worldRun = { unit: 'demo_ssr', kind: 'level', n: 1, kills: 0, damage: 0, prevEquipped: [], deadline: 1e9 };
  const home = companionSkillMultiplier(s, c, 'hit', (s.worldRun.unit === c.id));
  assert.ok(Math.abs(home / out - BALANCE.dungeonAffinity.skillMultiplier) < 1e-9);
});

test('lot 6 : score identique à entrée identique, sur deux phases différentes (minuteries et effets remis à zéro)', () => {
  startDemoBanner(J(9), 9);
  for (const name of ['bas', 'moyen']) {
    const base = account(name, J(9));
    const scores = [];
    for (const warm of [0, 23.35]) {
      const s = structuredClone(base);
      const w = createCombat(s);
      const tmp = structuredClone(base);
      const rng = new Rng(11);
      for (let t = 0; t < warm; t += BALANCE.simulation.tickSeconds) step(tmp, w, BALANCE.simulation.tickSeconds, rng); // combat en cours, autre phase
      w.events.length = 0;
      s.playSeconds = tmp.playSeconds;
      assert.ok(startWorldRun(s, w, 'demo_ssr', 'score', 1, {}, J(9)).ok);
      const ev = runUntilEnd(s, w, rng);
      assert.ok(ev.score.damage > 0);
      scores.push(ev.score.damage);
      assert.equal(s.worlds.demo_ssr.score.damage, ev.score.damage, 'record local');
      assert.deepEqual([s.worlds.demo_ssr.score.stars, s.worlds.demo_ssr.score.level], [0, 1]);
    }
    assert.equal(scores[0], scores[1], name);
  }
});

test('lot 6 : un 0★ niveau 1 offensif bat le palier 5 sur les comptes de référence bas, moyen et haut ; essai gratuit exclu du palier 5', () => {
  startDemoBanner(J(9), 9);
  for (const name of ['bas', 'moyen', 'haut']) {
    const s = account(name, J(9));
    s.worlds = { demo_ssr: { levels: 0, tiers: 4, decor: true, title: false, score: null } };
    const w = createCombat(s);
    assert.ok(startWorldRun(s, w, 'demo_ssr', 'tier', 5, {}, J(9)).ok, name);
    const ev = runUntilEnd(s, w, new Rng(3));
    assert.equal(ev?.won, true, `${name} : palier 5`);
    assert.equal(s.worlds.demo_ssr.title, true);
  }
  // Essai gratuit : palier 4 oui, palier 5 non ; l'équipe d'avant revient ; l'essai n'est pas un exemplaire.
  const t = account('moyen', J(9));
  delete t.companions.owned.demo_ssr;
  t.companions.equipped = ['shadow_lord', 'wisp'];
  t.worlds = { demo_ssr: { levels: 0, tiers: 4, decor: false, title: false, score: null } };
  const w = createCombat(t);
  assert.equal(startWorldRun(t, w, 'demo_ssr', 'tier', 5, { trial: true }, J(9)).error, 'condition');
  t.worlds.demo_ssr.tiers = 3;
  assert.ok(startWorldRun(t, w, 'demo_ssr', 'tier', 4, { trial: true }, J(9)).ok);
  assert.equal(t.companions.owned.demo_ssr.trial, true);
  const saved = sanitizeState(JSON.parse(JSON.stringify(t)), BALANCE, J(9));
  assert.equal(saved.companions.owned.demo_ssr, undefined, 'essai jamais sauvegardé comme exemplaire');
  assert.deepEqual(saved.companions.equipped, ['shadow_lord', 'wisp']);
  runUntilEnd(t, w, new Rng(2));
  assert.equal(t.companions.owned.demo_ssr, undefined);
  assert.deepEqual(t.companions.equipped, ['shadow_lord', 'wisp']);
  assert.equal(startWorldRun(t, w, 'demo_ssr', 'score', 1, { trial: true }, J(9)).error, 'score', 'score : perso possédé seulement');
});

// ——— Lot 7 : score en ligne (validation serveur) ———
test('lot 7 : scores extraits de la sauvegarde, bornés et cohérents (étoiles ≤ doublons, niveau ≤ niveau possédé, perso possédé)', () => {
  const now = Date.UTC(2026, 10, 20);
  const save = (score, owned = { stars: 4, level: 12 }) => ({ maxStage: 100, records: { bestStage: 120 }, companions: { owned: { demo_ssr: owned } }, worlds: { demo_ssr: { score } } });
  const ok = { damage: 1e12, stars: 3, level: 12, team: ['demo_ssr'], at: now - 1000 };
  assert.deepEqual(extractScores(save(ok), now), [{ unit: 'demo_ssr', damage: 1e12, stars: 3, level: 12, at: now - 1000 }]);
  assert.deepEqual(extractScores(save({ ...ok, stars: 4 }), now), [], 'plus d\'étoiles que de doublons');
  assert.deepEqual(extractScores(save({ ...ok, stars: 6 }, { stars: 6, level: 20 }), now), [], 'au-delà de 5★');
  assert.deepEqual(extractScores(save({ ...ok, level: 13 }), now), [], 'niveau supérieur au niveau possédé');
  assert.deepEqual(extractScores(save({ ...ok, damage: scoreCap(120) * 2 }), now), [], 'dégâts impossibles');
  assert.deepEqual(extractScores(save({ ...ok, damage: Number.NaN }), now), []);
  assert.deepEqual(extractScores(save(ok, { stars: 1, level: 1, trial: true }), now), [], 'essai gratuit');
  assert.deepEqual(extractScores(save({ ...ok, team: ['shadow_lord'] }), now), [], 'perso hors équipe');
  assert.deepEqual(extractScores(save({ ...ok, at: now + 3 * DAY }), now), [], 'date future');
  assert.deepEqual(extractScores({ worlds: { 'x y': { score: ok } } }, now), []);
});
