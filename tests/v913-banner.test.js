// v9.1.3 (doc4 partie B, lots 4 à 7) : bannières de 14 jours, filet, Légendaire perdu, Archives, budget B, mode monde,
// score reproductible, score en ligne (validation serveur). Perso de démonstration `demo_ssr` (drapeau coupé par défaut).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BANNER_RULES, BANNER_UNITS, UNITS, setBannersEnabled } from '../src/data/banners.js';
import { COMPANIONS } from '../src/data/companions.js';
import { BALANCE } from '../src/data/balance.js';
import { COMPANION_ROLES } from '../src/data/synergies.js';
import { AURA_COLORS } from '../src/data/auras.js';
import { createNewState, sanitizeState, SAVE_VERSION } from '../src/core/state.js';
import { featuredUnit, summon, summonOdds, summonPool } from '../src/core/gacha.js';
import { Rng } from '../src/core/rng.js';
import { archiveTargets, budget, claimReleaseGift, currentBanner, releaseIndex, } from '../src/core/banner.js';
import { companionMultiplier, companionSkillMultiplier, companionById } from '../src/core/companions.js';
import { sectionProgress } from '../src/core/encyclopedia.js';
import { SAVE_KEY, loadGame } from '../src/core/save.js';

const DAY = 86400000;
const START = new Date(`${BANNER_RULES.start}T00:00:00`).getTime();
const J = (d) => START + (d - 1) * DAY + 12 * 3600000; // midi du jour J de la sortie 1

test('drapeau coupé (défaut) : aucun perso de bannière, aucune bannière, budget 100, bassin et rotation inchangés', () => {
  setBannersEnabled(false);
  assert.equal(BANNER_RULES.enabled, false);
  assert.equal(UNITS.length, COMPANIONS.length);
  assert.equal(currentBanner(J(3)), null);
  assert.equal(releaseIndex(J(3)), 0);
  assert.equal(budget(companionById('shadow_lord'), J(400)), 100);
  assert.equal(summon(createNewState(J(3)), new Rng(1), 1, 'gems', BALANCE, 'banner', J(3)), null, 'pas de tirage sans bannière');
});

test('lot 4 : bassin permanent gelé (8 R, 7 SR, 5 SSR) ; un perso de bannière ne décale ni le bassin ni la rotation', () => {
  setBannersEnabled(false);
  const before = summonPool('ally').map((u) => u.id);
  const weeks = Array.from({ length: 12 }, (_, i) => featuredUnit('ally', J(1) + i * 7 * DAY)?.id);
  setBannersEnabled(true);
  const pool = summonPool('ally');
  assert.deepEqual(pool.map((u) => u.id), before);
  const count = (r) => pool.filter((u) => u.rarity === r).length;
  assert.deepEqual([count('rare'), count('epic'), count('legendary')], [8, 7, 5]);
  assert.ok(!pool.some((u) => u.bannerOnly));
  assert.deepEqual(Array.from({ length: 12 }, (_, i) => featuredUnit('ally', J(1) + i * 7 * DAY)?.id), weeks);
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
  assert.ok(Math.abs(f.chance - 0.015) < 1e-12, '3 % × 50 %');
  assert.ok(Math.abs(odds.chance - 0.03) < 1e-12);
  assert.equal(summonOdds('banner', BALANCE, J(2)).reduce((s, r) => s + r.chance, 0).toFixed(9), '1.000000000');
});

function pullsTo(copies, seed, init = {}) {
  const s = createNewState(J(2), seed);
  s.gems = 1e9;
  Object.assign(s.summon, init);
  const rng = new Rng(seed);
  let n = 0;
  while ((s.companions.owned.demo_ssr?.stars ?? 0) < copies) { summon(s, rng, 1, 'gems', BALANCE, 'banner', J(2)); n += 1; }
  return { n, s };
}

test('lot 4 : filet — moyenne 32,7 ± 0,5, maximum 50 ; coût moyen du 3★ ≈ 154 (données affichées)', () => {
  setBannersEnabled(true);
  const N = 6000;
  let sum = 0;
  let max = 0;
  for (let i = 0; i < N; i++) { const { n } = pullsTo(1, 1000 + i); sum += n; max = Math.max(max, n); }
  assert.ok(Math.abs(sum / N - 32.7) <= 0.5, `moyenne ${sum / N}`);
  assert.equal(max, BANNER_RULES.netPulls);
  assert.ok(Math.abs(sum / N - BANNER_RULES.cost.first) <= 0.5);
  let third = 0;
  for (let i = 0; i < 1500; i++) third += pullsTo(4, 9000 + i).n;
  assert.ok(Math.abs(third / 1500 - BANNER_RULES.cost.third) <= 5, `3★ : ${third / 1500}`);
});

test('lot 4 : filet figé si la vedette est possédée, conservé au changement de bannière, remis à 0 à l\'obtention', () => {
  setBannersEnabled(true);
  const s = createNewState(J(2), 5);
  s.gems = 1e6;
  s.summon.net = 30;
  s.companions.owned.demo_ssr = { stars: 1, level: 1 };
  summon(s, new Rng(2), 10, 'gems', BALANCE, 'banner', J(2));
  assert.equal(s.summon.net, 30, 'figé : vedette possédée');
  // Bannière suivante (aucun perso prévu en sortie 2) : le compteur est gardé dans la sauvegarde.
  const raw = JSON.parse(JSON.stringify(s));
  assert.equal(sanitizeState(raw, BALANCE, J(16)).summon.net, 30);
  // Obtention : remis à 0.
  const t = createNewState(J(2), 6);
  t.gems = 1e6;
  t.summon.net = BANNER_RULES.netPulls - 1;
  const r = summon(t, new Rng(3), 1, 'gems', BALANCE, 'banner', J(2));
  assert.equal(r[0].id, 'demo_ssr', '50e tirage sans elle : la vedette');
  assert.equal(t.summon.net, 0);
});

test('lot 4 : Légendaire perdu → le suivant est la vedette (bannière ou Archives), mémoire consommée une fois ; garantie à 60 partagée', () => {
  setBannersEnabled(true);
  const now = J(2);
  const s = createNewState(now, 7);
  s.gems = 1e6;
  s.companions.owned.demo_ssr = { stars: 1, level: 1 }; // pas de filet : seul le hasard et la mémoire jouent
  s.summon.lostLegend = true;
  s.summon.sinceLegendary = BALANCE.summon.pity.legendaryAfter - 1; // garantie à 60 (comptée aussi en Compagnons)
  const r = summon(s, new Rng(4), 1, 'gems', BALANCE, 'banner', now);
  assert.equal(r[0].id, 'demo_ssr');
  assert.equal(s.summon.lostLegend, false, 'consommée');
  // Archives (mémoire commune) : cible au choix, Légendaire perdu sur la bannière → cible.
  const a = createNewState(J(16), 8);
  a.gems = 1e6;
  a.summon.archiveTarget = 'demo_ssr';
  a.summon.lostLegend = true;
  a.summon.sinceLegendary = 59;
  assert.equal(summon(a, new Rng(5), 1, 'gems', BALANCE, 'archive', J(16))[0].id, 'demo_ssr');
  // Garantie à 60 partagée : 59 tirages en Compagnons, le 60e sur la bannière est Légendaire.
  const p = createNewState(now, 9);
  p.gems = 1e6;
  p.summon.sinceLegendary = 59;
  assert.equal(summon(p, new Rng(6), 1, 'gems', BALANCE, 'banner', now)[0].rarity, 'legendary');
  // Mémoire posée par un Légendaire perdu, une seule fois.
  let lost = 0;
  for (let i = 0; i < 200; i++) {
    const q = createNewState(now, 100 + i);
    q.gems = 1e6;
    q.companions.owned.demo_ssr = { stars: 1, level: 1 };
    q.summon.sinceLegendary = 59;
    const first = summon(q, new Rng(200 + i), 1, 'gems', BALANCE, 'banner', now)[0];
    if (first.id === 'demo_ssr') continue;
    lost += 1;
    assert.equal(q.summon.lostLegend, true);
    q.summon.sinceLegendary = 59;
    assert.equal(summon(q, new Rng(300 + i), 1, 'gems', BALANCE, 'banner', now)[0].id, 'demo_ssr');
    assert.equal(q.summon.lostLegend, false);
  }
  assert.ok(lost > 50);
});

test('lot 4 : Archives — 5 SSR permanents + bannières finies, mêmes taux, sans filet', () => {
  setBannersEnabled(true);
  assert.deepEqual(archiveTargets(J(5)).map((u) => u.id).sort(), COMPANIONS.filter((c) => c.kind === 'ally' && c.rarity === 'legendary').map((c) => c.id).sort());
  assert.ok(archiveTargets(J(15)).some((u) => u.id === 'demo_ssr'), 'J15 : Archives');
  const s = createNewState(J(16), 3);
  s.summon.archiveTarget = 'ice_empress';
  const odds = summonOdds('archive', BALANCE, J(16), s);
  assert.equal(odds.find((r) => r.rarity === 'legendary').chance.toFixed(4), '0.0300');
  assert.equal(odds.find((r) => r.rarity === 'legendary').units.find((u) => u.featured).id, 'ice_empress');
  s.gems = 1e6;
  s.summon.net = 10;
  summon(s, new Rng(1), 10, 'gems', BALANCE, 'archive', J(16));
  assert.equal(s.summon.net, 10, 'pas de filet aux Archives');
  s.summon.archiveTarget = 'demo_ssr';
  assert.equal(summon(s, new Rng(1), 1, 'gems', BALANCE, 'archive', J(5)), null, 'pas encore aux Archives à J5');
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

test('lot 4 : encyclopédie à 100 % sans aucun bannerOnly ; hauts faits sur les 26 unités permanentes', () => {
  setBannersEnabled(true);
  const s = createNewState(J(3));
  for (const c of COMPANIONS) s.companions.owned[c.id] = { stars: 1, level: 1 };
  const p = sectionProgress(s, 'companions');
  assert.equal(p.found, p.total);
  assert.equal(p.total, 26);
});

test('lot 4 : sauvegarde v8 — étoiles et niveaux identiques ; perso inconnu de ce client gardé (pas de montée à 9)', () => {
  setBannersEnabled(true);
  assert.equal(SAVE_VERSION, 8);
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

